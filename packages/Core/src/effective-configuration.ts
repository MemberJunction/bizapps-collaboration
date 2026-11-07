/**
 * The one configuration resolver (B16, D30, D31): the app's defaults, the space's type, the same-type run of ancestors top down,
 * then the space, into one `EffectiveSpaceConfiguration` the server, the browser and the agent path all read. Pure: the caller
 * loads the chain (as the system user, once) and hands it in; nothing here touches a database.
 *
 * The same-type run is the unbroken line of ancestors directly above the space that have the space's type. A sub-space of the
 * same type inherits its parent's overrides; one of another type starts again from its own type; a same-type space further down
 * starts a new run (D30). `SpaceOverridable` still says which keys a level below the type may set.
 *
 * Grants combine per kind: `Extend` adds a level's rows, `Replace` keeps only them, and a `Remove` row drops one inherited grant
 * by its target. A grant whose target is gone, or whose bindings or settings do not parse, is left out with a log: that only narrows.
 */
import {
    type CollaborationSettings,
    type DataReachDeclaration,
    type EffectiveSpaceRules,
    ResolveCollaborationSettings,
    type ResolvedCollaborationSettings,
    typeSeatsAudience,
} from './configuration.ts';
import { type AgentGrantSettings, type GrantKind, GRANT_KINDS, type SpaceGrantBindings, isGrantKind } from './grants.ts';

export type ConfigurationLevel = 'App' | 'Type' | 'Space';
export type GrantMode = 'Extend' | 'Remove';
export type SeatsAudience = 'StaffOnly' | 'StaffAndParticipants';

/** One `Space Grants` row as a level holds it. `Bindings` and `Settings` may still be the JSON text the row stores. */
export interface GrantRowInput {
    ID: string;
    Kind: string;
    Mode: string | null | undefined;
    TargetEntityID: string;
    TargetRecordID: string;
    Label?: string | null;
    Band: string;
    IsDefault?: boolean | null;
    Bindings?: SpaceGrantBindings | string | null;
    Settings?: AgentGrantSettings | string | null;
    Sequence?: number | null;
    /** False when the caller found the target gone. Absent means it was not checked, so the grant stands. */
    TargetExists?: boolean;
}

export interface ConfigurationLevelInput {
    Settings: CollaborationSettings | null | undefined;
    Grants: readonly GrantRowInput[];
}

export interface SpaceLevelInput extends ConfigurationLevelInput {
    ID: string;
    /** The space's type. The same-type run is judged on it. */
    TypeID: string | null | undefined;
}

export interface ResolveSpaceConfigurationInput {
    /** The app's row. Missing, the resolver throws `MissingAppSettingsError` as `ResolveCollaborationSettings` does. */
    App: ConfigurationLevelInput;
    /** The space's type; null for a space with none. */
    Type: (ConfigurationLevelInput & { ID: string }) | null;
    /** The space and its ancestors, nearest first: the space itself, its parent, and so on to the root. */
    Spaces: readonly SpaceLevelInput[];
    /** Where a dropped grant or a Remove that removed nothing is reported. Default: nowhere. */
    Log?: (message: string) => void;
}

export interface EffectiveGrant {
    GrantID: string;
    Kind: GrantKind;
    TargetEntityID: string;
    TargetRecordID: string;
    Label: string | null;
    Band: 'Team' | 'Shared';
    IsDefault: boolean;
    Sequence: number;
    Bindings: SpaceGrantBindings;
    Settings: AgentGrantSettings | null;
    /** Where the grant came from, for the settings screen and the logs. */
    Level: ConfigurationLevel;
    LevelID: string | null;
}

export interface EffectiveConfigurationLink {
    Level: ConfigurationLevel;
    LevelID: string | null;
}

export interface EffectiveSpaceConfiguration {
    /** D20's keys, resolved down the chain. */
    Settings: ResolvedCollaborationSettings;
    /** Who the type seats (item 142). Absent or unreadable fails closed to StaffAndParticipants. */
    Audience: SeatsAudience;
    /** Per kind, inherited first, each level's rows in Sequence order. Every kind has a list, empty or not. */
    Grants: Record<GrantKind, EffectiveGrant[]>;
    /** The agent grant the ask box tags: the nearest level's IsDefault row, else the first agent grant, else null. */
    DefaultAgentGrantID: string | null;
    /** The type's declarations (D28). */
    DataReach: DataReachDeclaration[];
    /** The levels that made this configuration, lowest first: the app, the type, the same-type run top down, the space. */
    Chain: EffectiveConfigurationLink[];
    /** The kinds some level replaced rather than extended, so a caller knows the app's list was set aside on purpose. */
    ReplacedKinds: GrantKind[];
}

const normalizeId = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();

/** The space and the ancestors directly above it that share its type, nearest first; stops at the first ancestor of another type. */
export function sameTypeRun(spaces: readonly SpaceLevelInput[]): SpaceLevelInput[] {
    if (!spaces.length) return [];
    const typeKey = normalizeId(spaces[0].TypeID);
    const run: SpaceLevelInput[] = [spaces[0]];
    for (let i = 1; i < spaces.length; i += 1) {
        if (normalizeId(spaces[i].TypeID) !== typeKey) break;
        run.push(spaces[i]);
    }
    return run;
}

/** Whether a space may set `dottedKey`, by its type's `SpaceOverridable`: the key itself, or its first segment, listed. */
function spaceMaySet(typeSettings: CollaborationSettings | null | undefined, dottedKey: string): boolean {
    const overridable = new Set(typeSettings?.SpaceOverridable ?? []);
    if (overridable.has(dottedKey)) return true;
    return overridable.has(dottedKey.split('.')[0]);
}

/** The list mode a level applies to one kind. The type's own; a space's only where the type lets it; the app's is always Extend over nothing. */
function listModeAt(level: ConfigurationLevel, settings: CollaborationSettings | null | undefined, typeSettings: CollaborationSettings | null | undefined, kind: GrantKind): 'Extend' | 'Replace' {
    if (level === 'App' || !settings) return 'Extend';
    const own = settings.Grants?.[kind]?.ListMode ?? (kind === 'Agent' ? settings.Agents?.ListMode : undefined);
    if (!own) return 'Extend';
    if (level === 'Type') return own;
    const allowed = spaceMaySet(typeSettings, `Grants.${kind}`) || (kind === 'Agent' && spaceMaySet(typeSettings, 'Agents.ListMode'));
    return allowed ? own : 'Extend';
}

function parseJson<T>(raw: T | string | null | undefined, what: string, grantId: string, log: (message: string) => void): { ok: true; value: T | null } | { ok: false } {
    if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
    if (typeof raw !== 'string') return { ok: true, value: raw };
    try {
        const parsed = JSON.parse(raw) as T;
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            log(`Grant ${grantId} is left out: its ${what} is not an object.`);
            return { ok: false };
        }
        return { ok: true, value: parsed };
    } catch {
        log(`Grant ${grantId} is left out: its ${what} does not parse.`);
        return { ok: false };
    }
}

const targetKey = (row: { TargetEntityID: string; TargetRecordID: string }): string => `${normalizeId(row.TargetEntityID)}|${normalizeId(row.TargetRecordID)}`;

/** One level's rows of one kind, in Sequence order, as effective grants; Remove rows apart. Rows that cannot stand are logged and dropped. */
function levelRows(level: ConfigurationLevel, levelId: string | null, rows: readonly GrantRowInput[], kind: GrantKind, log: (message: string) => void): { extend: EffectiveGrant[]; remove: GrantRowInput[] } {
    const ofKind = rows.filter((row) => row.Kind === kind).slice().sort((a, b) => (a.Sequence ?? 0) - (b.Sequence ?? 0));
    const extend: EffectiveGrant[] = [];
    const remove: GrantRowInput[] = [];
    for (const row of ofKind) {
        const mode = (row.Mode ?? 'Extend').trim();
        if (mode === 'Remove') {
            remove.push(row);
            continue;
        }
        if (mode !== 'Extend') {
            log(`Grant ${row.ID} is left out: its mode "${mode}" is not Extend or Remove.`);
            continue;
        }
        if (row.TargetExists === false) {
            log(`Grant ${row.ID} (${kind} ${row.TargetRecordID}) is left out: its target is gone.`);
            continue;
        }
        if (row.Band !== 'Team' && row.Band !== 'Shared') {
            log(`Grant ${row.ID} is left out: its band "${String(row.Band)}" is not Team or Shared.`);
            continue;
        }
        const bindings = parseJson<SpaceGrantBindings>(row.Bindings, 'bindings', row.ID, log);
        if (!bindings.ok) continue;
        const settings = parseJson<AgentGrantSettings>(row.Settings, 'settings', row.ID, log);
        if (!settings.ok) continue;
        extend.push({
            GrantID: row.ID,
            Kind: kind,
            TargetEntityID: row.TargetEntityID,
            TargetRecordID: row.TargetRecordID,
            Label: row.Label ?? null,
            Band: row.Band,
            IsDefault: !!row.IsDefault,
            Sequence: row.Sequence ?? 0,
            Bindings: bindings.value ?? {},
            Settings: kind === 'Agent' ? settings.value : null,
            Level: level,
            LevelID: levelId,
        });
    }
    return { extend, remove };
}

/**
 * Applies one level to the list inherited so far: `Replace` keeps only the level's rows; `Extend` adds them, a row for a target
 * already in the list taking that target's place; then each `Remove` drops the inherited grant with its target.
 */
function applyLevel(inherited: EffectiveGrant[], level: { extend: EffectiveGrant[]; remove: GrantRowInput[] }, mode: 'Extend' | 'Replace', log: (message: string) => void, levelName: string): EffectiveGrant[] {
    let list: EffectiveGrant[];
    if (mode === 'Replace') {
        list = level.extend.slice();
    } else {
        const added = new Set(level.extend.map(targetKey));
        list = inherited.filter((grant) => !added.has(targetKey(grant))).concat(level.extend);
    }
    for (const row of level.remove) {
        const key = targetKey(row);
        const before = list.length;
        list = list.filter((grant) => targetKey(grant) !== key);
        if (list.length === before) log(`Remove grant ${row.ID} at ${levelName} removes nothing: no ${row.Kind} grant of ${row.TargetRecordID} reaches it.`);
    }
    return list;
}

/** D30's chain, resolved. */
export function ResolveSpaceConfiguration(input: ResolveSpaceConfigurationInput): EffectiveSpaceConfiguration {
    const log = input.Log ?? (() => undefined);
    const run = sameTypeRun(input.Spaces);
    const typeSettings = input.Type?.Settings ?? null;

    // The settings: the same-type run's configurations nearest first, the type, the app (the keys a space may set come from the type)
    const settings = ResolveCollaborationSettings({
        spaces: run.map((space) => space.Settings ?? null),
        type: typeSettings,
        app: input.App.Settings ?? undefined,
    });

    // The levels, lowest first: the app, the type, the run top down, the space
    const levels: Array<{ level: ConfigurationLevel; id: string | null; settings: CollaborationSettings | null | undefined; rows: readonly GrantRowInput[]; name: string }> = [
        { level: 'App', id: null, settings: input.App.Settings, rows: input.App.Grants, name: 'the app' },
    ];
    if (input.Type) levels.push({ level: 'Type', id: input.Type.ID, settings: input.Type.Settings, rows: input.Type.Grants, name: `type ${input.Type.ID}` });
    for (const space of [...run].reverse()) {
        levels.push({ level: 'Space', id: space.ID, settings: space.Settings, rows: space.Grants, name: `space ${space.ID}` });
    }

    const grants = {} as Record<GrantKind, EffectiveGrant[]>;
    const replacedKinds: GrantKind[] = [];
    for (const kind of GRANT_KINDS) {
        let list: EffectiveGrant[] = [];
        for (const level of levels) {
            const rows = levelRows(level.level, level.id, level.rows, kind, log);
            if (!rows.extend.length && !rows.remove.length) continue;
            const mode = listModeAt(level.level, level.settings, typeSettings, kind);
            if (mode === 'Replace' && !replacedKinds.includes(kind)) replacedKinds.push(kind);
            list = applyLevel(list, rows, mode, log, level.name);
        }
        grants[kind] = list;
    }
    for (const level of levels) {
        for (const row of level.rows) {
            if (!isGrantKind(row.Kind)) log(`Grant ${row.ID} at ${level.name} is left out: "${String(row.Kind)}" is not a kind of grant.`);
        }
    }

    const agents = grants.Agent;
    const flagged = [...agents].reverse().find((grant) => grant.IsDefault);
    const defaultAgentGrantId = flagged?.GrantID ?? agents[0]?.GrantID ?? null;

    return {
        Settings: settings,
        Audience: typeSeatsAudience(typeSettings),
        Grants: grants,
        DefaultAgentGrantID: defaultAgentGrantId,
        DataReach: Array.isArray(typeSettings?.DataReach) ? typeSettings.DataReach.slice() : [],
        Chain: levels.map((level) => ({ Level: level.level, LevelID: level.id })),
        ReplacedKinds: replacedKinds,
    };
}

/** The drivers' view of the settings (`EffectiveSpaceRules`), read off the one configuration. */
export function RulesOf(configuration: EffectiveSpaceConfiguration): EffectiveSpaceRules {
    return {
        Chats: { ...configuration.Settings.Chats },
        Agents: { ...configuration.Settings.Agents },
        Labels: configuration.Settings.Labels,
        Extensions: { ...configuration.Settings.Extensions },
    };
}

export interface ConfigurationViewer {
    /** Whether the viewer sees the Team band in this space. */
    canSeeTeam: boolean;
    /** Whether the viewer may read the whole document: staff with the settings authorizations. */
    full: boolean;
}

/**
 * The configuration as one viewer may see it (B16): the grants in force for their band, with each grant's bindings removed, since
 * a binding names where a value comes from and the browser never fills one in. A full viewer gets the document as it is.
 */
export function CutConfigurationForViewer(configuration: EffectiveSpaceConfiguration, viewer: ConfigurationViewer): EffectiveSpaceConfiguration {
    if (viewer.full) return configuration;
    const grants = {} as Record<GrantKind, EffectiveGrant[]>;
    for (const kind of GRANT_KINDS) {
        grants[kind] = configuration.Grants[kind]
            .filter((grant) => viewer.canSeeTeam || grant.Band === 'Shared')
            .map((grant) => ({ ...grant, Bindings: {} }));
    }
    const defaultStillThere = grants.Agent.some((grant) => grant.GrantID === configuration.DefaultAgentGrantID);
    return {
        ...configuration,
        Grants: grants,
        DefaultAgentGrantID: defaultStillThere ? configuration.DefaultAgentGrantID : (grants.Agent[0]?.GrantID ?? null),
        DataReach: configuration.DataReach.filter((reach) => viewer.canSeeTeam || reach.Band === 'Shared'),
    };
}

/** The grants of one kind a viewer may use: in force in the space, and on a band they can see. */
export function GrantsForViewer(configuration: EffectiveSpaceConfiguration, kind: GrantKind, canSeeTeam: boolean): EffectiveGrant[] {
    return configuration.Grants[kind].filter((grant) => canSeeTeam || grant.Band === 'Shared');
}
