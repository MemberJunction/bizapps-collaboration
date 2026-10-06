/**
 * The server's side of the one resolver (B16, item 42): loads a space's chain once, as the system user, and hands it to Core's
 * `ResolveSpaceConfiguration`. Fails closed: a chain that cannot be read completely, a link whose configuration does not parse or
 * breaks its own type's rules, or a type that cannot be read refuses the caller instead of resolving with a link missing.
 *
 * What it reads: the space and its ancestors (one row each, nearest first); the app's and every type's grants from the engine; the
 * chain's own grants in one read; and, per kind, whether each grant's target still exists, so a grant whose target is gone is left out
 * with a log rather than offered.
 */
import { type IMetadataProvider, LogError, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import {
    type CollaborationSettings,
    type EffectiveSpaceConfiguration,
    GRANT_KIND_ENTITY,
    type GrantKind,
    type GrantRowInput,
    isGrantKind,
    ResolveSpaceConfiguration,
    type SpaceLevelInput,
    ValidateCollaborationSettings,
} from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceGrantEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { parseUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const GRANTS = 'MJ_BizApps_Collaboration: Space Grants';
const GRANT_FIELDS = ['ID', 'SpaceID', 'SpaceTypeID', 'Kind', 'Mode', 'TargetEntityID', 'TargetRecordID', 'Label', 'Band', 'IsDefault', 'Bindings', 'Settings', 'Sequence'];

/** One space on the chain, as the loader read it or as a save hands it in. */
export interface SpaceChainRow {
    ID: string;
    ParentID: string | null;
    SpaceTypeID: string | null;
    Configuration: string | null;
}

export interface LoadedSpaceConfiguration {
    configuration: EffectiveSpaceConfiguration;
    /** The space and its ancestors, nearest first. */
    chain: SpaceChainRow[];
    /** The space's type, as the engine holds it; null for a space with none. */
    type: mjBizAppsCollaborationSpaceTypeEntity | null;
    /** The space's own type configuration, parsed; null when it has none. */
    typeSettings: CollaborationSettings | null;
}

export interface LoadSpaceConfigurationOptions {
    /**
     * The space as a save holds it, before it is written: its own row stands in for the stored one (or for a row that does not
     * exist yet), and the walk continues from its ParentID. Its grants are read when it is saved already, else none.
     */
    leaf?: SpaceChainRow;
    /** Where a dropped grant is reported. Default: the error log. */
    log?: (message: string) => void;
    /** Who the reads run as. Default: the system user, since the caller may not see every ancestor or grant. */
    reader?: UserInfo;
}

function refuse(message: string): never {
    LogError(`loadSpaceConfiguration: ${message}`);
    throw new Error(`Space settings refused: ${message}`);
}

/** The parsed configuration of a type the engine holds; null when it has none. A configuration that does not parse refuses. */
export function typeSettingsOf(type: mjBizAppsCollaborationSpaceTypeEntity | null | undefined): CollaborationSettings | null {
    if (!type?.Configuration) return null;
    try {
        return typeof type.Configuration === 'string' ? (JSON.parse(type.Configuration) as CollaborationSettings) : (type.Configuration as CollaborationSettings);
    } catch (error) {
        return refuse(`the space type ${type.ID} has a configuration that does not parse: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function parseSpaceSettings(row: SpaceChainRow, typeSettings: CollaborationSettings | null): CollaborationSettings | null {
    if (!row.Configuration) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(row.Configuration);
    } catch (error) {
        return refuse(`space ${row.ID} has a configuration that does not parse: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Each link is judged by the type it was saved under: a Workspace may set what a Team may not
    const judged = ValidateCollaborationSettings(parsed, 'space', typeSettings);
    if (!judged.valid) return refuse(`space ${row.ID} has an invalid configuration: ${judged.errors.join('; ')}`);
    return parsed as CollaborationSettings;
}

async function readChain(rv: RunView, system: UserInfo | undefined, startId: string | null, leaf: SpaceChainRow | undefined): Promise<SpaceChainRow[]> {
    const chain: SpaceChainRow[] = leaf ? [leaf] : [];
    const seen = new Set<string>(leaf?.ID ? [leaf.ID.toLowerCase()] : []);
    let currentId: string | null = startId;
    while (currentId) {
        const id = parseUuid(currentId);
        if (!id) refuse(`'${currentId}' is not a valid space id.`);
        if (seen.has(id.toLowerCase())) refuse(`the chain of spaces loops at ${id}.`);
        seen.add(id.toLowerCase());
        const read = await rv.RunView<SpaceChainRow>({
            EntityName: SPACES,
            ExtraFilter: `ID = '${id}'`,
            Fields: ['ID', 'ParentID', 'SpaceTypeID', 'Configuration'],
            ResultType: 'simple',
            MaxRows: 1,
        }, system);
        if (!read.Success) refuse(`space ${id} could not be read: ${read.ErrorMessage ?? 'unknown error'}`);
        const row = read.Results?.[0];
        if (!row) refuse(`space ${id} was not found.`);
        chain.push(row);
        currentId = row.ParentID;
    }
    return chain;
}

type GrantRow = Pick<mjBizAppsCollaborationSpaceGrantEntity, 'ID' | 'SpaceID' | 'SpaceTypeID' | 'Kind' | 'Mode' | 'TargetEntityID' | 'TargetRecordID' | 'Label' | 'Band' | 'IsDefault' | 'Bindings' | 'Settings' | 'Sequence'>;

async function readSpaceGrants(rv: RunView, system: UserInfo | undefined, spaceIds: readonly string[]): Promise<GrantRow[]> {
    if (!spaceIds.length) return [];
    const read = await rv.RunView<GrantRow>({
        EntityName: GRANTS,
        ExtraFilter: `SpaceID IN (${spaceIds.map((id) => `'${id}'`).join(', ')})`,
        Fields: GRANT_FIELDS,
        ResultType: 'simple',
        MaxRows: 2000,
    }, system);
    if (!read.Success) refuse(`the spaces' grants could not be read: ${read.ErrorMessage ?? 'unknown error'}`);
    if ((read.Results?.length ?? 0) >= 2000) refuse("the spaces' grants came back as a full page, so the chain would be incomplete.");
    return read.Results ?? [];
}

/** Marks each grant whose target no longer exists, one read per kind. A read that fails refuses: a grant that cannot be checked is not offered. */
async function markTargets(rv: RunView, system: UserInfo | undefined, rows: GrantRowInput[]): Promise<void> {
    const byKind = new Map<GrantKind, GrantRowInput[]>();
    for (const row of rows) {
        if (!isGrantKind(row.Kind) || (row.Mode ?? 'Extend') === 'Remove') continue;
        const list = byKind.get(row.Kind) ?? [];
        list.push(row);
        byKind.set(row.Kind, list);
    }
    for (const [kind, list] of byKind) {
        const ids = [...new Set(list.map((row) => parseUuid(row.TargetRecordID)).filter((id): id is string => !!id))];
        const found = new Set<string>();
        if (ids.length) {
            const read = await rv.RunView<{ ID: string }>({
                EntityName: GRANT_KIND_ENTITY[kind],
                ExtraFilter: `ID IN (${ids.map((id) => `'${id}'`).join(', ')})`,
                Fields: ['ID'],
                ResultType: 'simple',
                MaxRows: 2000,
            }, system);
            if (!read.Success) refuse(`the ${kind} grants' targets could not be read: ${read.ErrorMessage ?? 'unknown error'}`);
            for (const row of read.Results ?? []) found.add((parseUuid(row.ID) ?? row.ID).toLowerCase());
        }
        for (const row of list) {
            const id = parseUuid(row.TargetRecordID);
            row.TargetExists = !!id && found.has(id.toLowerCase());
        }
    }
}

const asInput = (row: GrantRow): GrantRowInput => ({
    ID: row.ID,
    Kind: row.Kind,
    Mode: row.Mode,
    TargetEntityID: row.TargetEntityID,
    TargetRecordID: row.TargetRecordID,
    Label: row.Label ?? null,
    Band: row.Band,
    IsDefault: row.IsDefault ?? false,
    Bindings: row.Bindings ?? null,
    Settings: row.Settings ?? null,
    Sequence: row.Sequence ?? 0,
});

const sameId = (a: string | null | undefined, b: string | null | undefined): boolean => (parseUuid(a ?? '') ?? (a ?? '')).toLowerCase() === (parseUuid(b ?? '') ?? (b ?? '')).toLowerCase();

/**
 * Loads and resolves a space's configuration. `spaceId` is the space; with `options.leaf` the leaf stands in for it. Reads as the
 * system user (or `options.reader`), since the caller may not see every ancestor or grant; the caller cuts the result for its viewer.
 */
export async function loadSpaceConfiguration(provider: IMetadataProvider, spaceId: string, options: LoadSpaceConfigurationOptions = {}): Promise<LoadedSpaceConfiguration> {
    const system = options.reader ?? (await WellKnownUserSource.Instance.GetSystemUser(provider)) ?? undefined;
    const engine = CollaborationEngine.Instance;
    // The engine is loaded at startup; a load that fails here is logged, and the types it already holds are read. A type it does not
    // hold refuses below.
    try {
        await engine.EnsureLoaded(system, provider);
    } catch (error) {
        LogError(`loadSpaceConfiguration: the engine could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
    }
    const rv = RunView.FromMetadataProvider(provider);
    const log = options.log ?? ((message: string) => LogError(`loadSpaceConfiguration: ${message}`));

    const leaf = options.leaf;
    const chain = await readChain(rv, system, leaf ? leaf.ParentID : spaceId, leaf);
    if (!chain.length) refuse('there is no space to resolve.');

    // Every type on the chain is read once; a type that cannot be read, or whose configuration does not parse, refuses
    const typeSettingsById = new Map<string, CollaborationSettings | null>();
    const typeFor = (typeId: string | null | undefined): mjBizAppsCollaborationSpaceTypeEntity | null => {
        const id = parseUuid(typeId ?? '');
        if (!id) return null;
        const type = engine.SpaceTypeById(id);
        if (!type) return refuse(`the space type ${id} could not be read.`);
        if (!typeSettingsById.has(id.toLowerCase())) typeSettingsById.set(id.toLowerCase(), typeSettingsOf(type));
        return type;
    };
    const settingsOfType = (type: mjBizAppsCollaborationSpaceTypeEntity | null): CollaborationSettings | null => (type ? (typeSettingsById.get((parseUuid(type.ID) ?? type.ID).toLowerCase()) ?? null) : null);
    const type = typeFor(chain[0].SpaceTypeID);
    const typeSettings = settingsOfType(type);

    // The chain's own grants, in one read; the leaf of a save that is not written yet has none
    const storedIds = chain.map((row) => parseUuid(row.ID)).filter((id): id is string => !!id);
    const spaceGrantRows = await readSpaceGrants(rv, system, storedIds);
    const spaceGrants = spaceGrantRows.map((row) => ({ spaceId: row.SpaceID, input: asInput(row) }));
    const appGrants = engine.AppSpaceGrants.map(asInput);
    const typeGrants = type ? engine.SpaceGrantsForType(type.ID).map(asInput) : [];
    await markTargets(rv, system, [...appGrants, ...typeGrants, ...spaceGrants.map((grant) => grant.input)]);

    const spaces: SpaceLevelInput[] = chain.map((row) => ({
        ID: row.ID,
        TypeID: row.SpaceTypeID,
        Settings: parseSpaceSettings(row, settingsOfType(typeFor(row.SpaceTypeID))),
        Grants: spaceGrants.filter((grant) => sameId(grant.spaceId, row.ID)).map((grant) => grant.input),
    }));

    const configuration = ResolveSpaceConfiguration({
        App: { Settings: engine.CollaborationSettings, Grants: appGrants },
        Type: type ? { ID: type.ID, Settings: typeSettings, Grants: typeGrants } : null,
        Spaces: spaces,
        Log: log,
    });
    return { configuration, chain, type, typeSettings };
}
