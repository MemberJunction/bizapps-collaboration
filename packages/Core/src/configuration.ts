import { GRANT_KINDS, isGrantKind, type GrantKind } from './grants.ts';
/**
 * Configuration interfaces and rule resolution for Space, SpaceType, and App.
 * Follows the extensibility plan § 4 and punch list 2 items 55, 12, 6.
 */

/** A JSON value, for settings that a type's own drivers define. */
export type ConfigurationValue =
    | string
    | number
    | boolean
    | null
    | ConfigurationValue[]
    | { [key: string]: ConfigurationValue };

/** Strictly-typed input candidate for configuration validation helpers (zero `any`/`unknown`). */
export type ConfigurationJsonInput =
    | CollaborationSettings
    | object
    | string
    | number
    | boolean
    | null
    | undefined;

type RawConfigValue =
    | ConfigurationValue
    | object
    | undefined;

type RawConfigObject = Record<string, RawConfigValue>;

/** Write policy for space chats: non-loosening across Type -> Root -> Space. */
export type ChatWhoCanWrite = 'Contributors' | 'TeamOnly' | 'Owners';

/** Per-root delivery principal configuration (CA-4): non-loosening across Type -> Root -> Space. */
export interface DeliveryPrincipalConfig {
    /** Configured MJ User ID attributed to promoted / outbound SupportsAudience outputs for this root. */
    UserID?: string | null;
    /** Optional allowlist of permitted principal User IDs (sub-spaces may narrow, never widen). */
    AllowedPrincipalUserIDs?: string[];
    /** Must remain false/undefined: never silently fall back to the approving user's personal identity. */
    AllowFallbackToCaller?: false;
}

/** Declarative scoped prompt part entry that may live in SpaceType/Space configuration. */
export interface ScopedPromptPartConfigEntry {
    ID?: string | null;
    PromptID?: string | null;
    Name: string;
    Role?: 'System' | 'User' | 'Assistant';
    Text: string;
    Sort?: number;
    Priority?: number;
    MergeBehavior?: 'Override' | 'Append';
    Status?: 'Active' | 'Provisional' | 'Archived';
    Band?: 'Team' | 'Shared';
}

/**
 * The single typed settings shape for BizApps Collaboration at every level
 * (App, SpaceType, Space, SubSpace).
 */
export interface CollaborationSettings {
    /** Target storage account ID for file uploads. Resolves hierarchically. */
    StorageAccountID?: string | null;
    /** Chat behavior rules. */
    Chats?: {
        /** Who may start a chat. Default 'Anyone': anyone whose seat can post (a guest who can't post can't start one either). 'Owners' narrows it to owners. */
        WhoCanStart?: 'Anyone' | 'Owners';
        /** Who may post writes in space chats (non-loosening narrowing across Type -> Root -> Space). Default 'Contributors'. */
        WhoCanWrite?: ChatWhoCanWrite;
        /** When an agent replies. Default 'MentionOrOneToOne'. */
        AgentReplyMode?: 'MentionOrOneToOne' | 'MentionOnly' | 'Always';
        /** The choice preselected when someone is added to an existing chat. Default 'None'. */
        HistoryOnAdd?: 'None' | 'All' | 'Since';
    };
    /** Optional scoped prompt part declarations at this level (CX-4). */
    PromptParts?: ScopedPromptPartConfigEntry[];
    /** Agent inheritance rules. */
    Agents?: {
        /** How this level's SpaceAgent rows combine with the list above. Default 'Extend'. */
        ListMode?: 'Extend' | 'Replace';
        /** When true, action grants with server-side bindings are exposed to space agents with hidden bound params stripped (CX-3). */
        EnableBoundActionGrants?: boolean;
    };
    /** Per-root delivery principal configuration (CA-4). */
    DeliveryPrincipal?: DeliveryPrincipalConfig;
    /** Word overrides: tab labels, e.g. { Tabs: { Library: 'Papers', People: 'Members' } }, and the two bands' names (item 53). */
    Labels?: {
        Tabs?: Record<string, string>;
        Bands?: { Team?: string; Shared?: string };
    };
    /** Types that may be created under a space of this type. */
    Children?: {
        AllowedTypeCodes?: string[];
        MaxOpen?: number;
    };
    /** Dotted keys a space may override, for example 'StorageAccountID', 'Chats.WhoCanStart'. */
    SpaceOverridable?: string[];
    /** Who a type seats (item 142). 'StaffOnly' lets the type carry grants of a view, query or component; absent means 'StaffAndParticipants', which fails closed. A type's key; a space may not set it. */
    Seats?: {
        Audience?: 'StaffOnly' | 'StaffAndParticipants';
    };
    /** How this level's grants of each kind combine with the level above (D30). Default 'Extend'. */
    Grants?: Partial<Record<GrantKind, { ListMode?: 'Extend' | 'Replace' }>>;
    /** The entities a type's participants may read through an anchor (D28). A type's declaration; a space has none. */
    DataReach?: DataReachDeclaration[];
    /** Behavior switches that the type's own drivers read, keyed by app. */
    Extensions?: Record<string, Record<string, ConfigurationValue>>;
}

/** One entity a type's participants may read, by a path to an anchor role (D28). */
export interface DataReachDeclaration {
    /** The MJ entity name. */
    Entity: string;
    /** A column of Entity, or one foreign-key hop: 'MemberID.ChapterID'. */
    Path: string;
    AnchorRole: string;
    Band: 'Team' | 'Shared';
    /** The allow-list of fields participants may read. */
    Fields: string[];
}

/** Checks one DataReach declaration; the errors name the index so a list of them reads well. */
export function validateDataReachDeclaration(declaration: ConfigurationJsonInput, index: number): string[] {
    const at = `DataReach[${index}]`;
    if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) return [`${at} must be an object.`];
    const d = declaration as Partial<DataReachDeclaration>;
    const errors: string[] = [];
    if (typeof d.Entity !== 'string' || d.Entity.trim() === '') errors.push(`${at}.Entity must name an entity.`);
    if (typeof d.Path !== 'string' || d.Path.trim() === '') errors.push(`${at}.Path must name a column, or one hop: Column.Column.`);
    else if (d.Path.split('.').length > 2 || d.Path.split('.').some((part) => part.trim() === '')) errors.push(`${at}.Path "${d.Path}" may have at most one hop.`);
    if (typeof d.AnchorRole !== 'string' || d.AnchorRole.trim() === '') errors.push(`${at}.AnchorRole must name an anchor role.`);
    if (d.Band !== 'Team' && d.Band !== 'Shared') errors.push(`${at}.Band must be Team or Shared.`);
    if (!Array.isArray(d.Fields) || d.Fields.length === 0 || d.Fields.some((f) => typeof f !== 'string' || f.trim() === '')) errors.push(`${at}.Fields must list at least one field.`);
    return errors;
}

export interface ISpaceRules extends CollaborationSettings {}
export interface ISpaceTypeConfiguration extends CollaborationSettings {}
export interface ISpaceConfiguration extends CollaborationSettings {}

export interface EffectiveSpaceRules {
    Chats: {
        WhoCanStart: 'Anyone' | 'Owners';
        AgentReplyMode: 'MentionOrOneToOne' | 'MentionOnly' | 'Always';
        HistoryOnAdd: 'None' | 'All' | 'Since';
    };
    Agents: {
        ListMode: 'Extend' | 'Replace';
        EnableBoundActionGrants?: boolean;
    };
    DeliveryPrincipal?: {
        UserID: string | null;
        AllowedPrincipalUserIDs?: string[];
        AllowFallbackToCaller: false;
    };
    Labels?: { Tabs?: Record<string, string> };
    Extensions: Record<string, Record<string, ConfigurationValue>>;
}

export const DEFAULT_SPACE_RULES: EffectiveSpaceRules = {
    Chats: {
        WhoCanStart: 'Anyone',
        AgentReplyMode: 'MentionOrOneToOne',
        HistoryOnAdd: 'None',
    },
    Agents: {
        ListMode: 'Extend',
    },
    Labels: undefined,
    Extensions: {},
};

/**
 * Validates a SpaceTypeConfiguration object structure.
 */
export function validateSpaceTypeConfiguration(config: ConfigurationJsonInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { valid: false, errors: ['Configuration must be a non-null object.'] };
    }

    const c = config as ISpaceTypeConfiguration;

    if (c.Chats) {
        if (c.Chats.WhoCanStart && !['Anyone', 'Owners'].includes(c.Chats.WhoCanStart)) {
            errors.push(`Invalid Chats.WhoCanStart: ${c.Chats.WhoCanStart}`);
        }
        if (c.Chats.WhoCanWrite && !['Contributors', 'TeamOnly', 'Owners'].includes(c.Chats.WhoCanWrite)) {
            errors.push(`Invalid Chats.WhoCanWrite: ${c.Chats.WhoCanWrite}`);
        }
        if (c.Chats.AgentReplyMode && !['MentionOrOneToOne', 'MentionOnly', 'Always'].includes(c.Chats.AgentReplyMode)) {
            errors.push(`Invalid Chats.AgentReplyMode: ${c.Chats.AgentReplyMode}`);
        }
        if (c.Chats.HistoryOnAdd && !['None', 'All', 'Since'].includes(c.Chats.HistoryOnAdd)) {
            errors.push(`Invalid Chats.HistoryOnAdd: ${c.Chats.HistoryOnAdd}`);
        }
    }

    if (c.Agents) {
        if (c.Agents.ListMode && !['Extend', 'Replace'].includes(c.Agents.ListMode)) {
            errors.push(`Invalid Agents.ListMode: ${c.Agents.ListMode}`);
        }
    }

    if (c.Children) {
        if (c.Children.AllowedTypeCodes && !Array.isArray(c.Children.AllowedTypeCodes)) {
            errors.push('Children.AllowedTypeCodes must be an array of strings.');
        }
        if (c.Children.MaxOpen !== undefined && (typeof c.Children.MaxOpen !== 'number' || c.Children.MaxOpen < 0)) {
            errors.push('Children.MaxOpen must be a non-negative number.');
        }
    }

    if (c.SpaceOverridable && !Array.isArray(c.SpaceOverridable)) {
        errors.push('SpaceOverridable must be an array of strings.');
    }

    if (c.Grants !== undefined) {
        if (!c.Grants || typeof c.Grants !== 'object' || Array.isArray(c.Grants)) errors.push('Grants must be an object keyed by grant kind.');
        else {
            for (const [kind, rule] of Object.entries(c.Grants)) {
                if (!isGrantKind(kind)) errors.push(`Grants.${kind}: not a grant kind (${GRANT_KINDS.join(', ')}).`);
                else if (rule?.ListMode !== undefined && !['Extend', 'Replace'].includes(rule.ListMode)) errors.push(`Invalid Grants.${kind}.ListMode: ${String(rule.ListMode)}`);
            }
        }
    }

    if (c.DataReach !== undefined) {
        if (!Array.isArray(c.DataReach)) errors.push('DataReach must be an array of declarations.');
        else c.DataReach.forEach((d, i) => errors.push(...validateDataReachDeclaration(d, i)));
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates a SpaceConfiguration against allowed overridable keys from its SpaceType.
 */
export function validateSpaceConfiguration(
    spaceConfig: ConfigurationJsonInput,
    typeConfig: ISpaceTypeConfiguration | null | undefined
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!spaceConfig) return { valid: true, errors: [] };

    if (typeof spaceConfig !== 'object' || Array.isArray(spaceConfig)) {
        return { valid: false, errors: ['Space Configuration must be an object.'] };
    }

    const sc = spaceConfig as ISpaceConfiguration;
    const overridable = new Set(typeConfig?.SpaceOverridable ?? []);

    if (sc.Chats?.WhoCanStart && !overridable.has('Chats.WhoCanStart')) {
        errors.push("Chats.WhoCanStart cannot be overridden by space: not in type's SpaceOverridable.");
    }
    if (sc.Chats?.WhoCanWrite && !overridable.has('Chats.WhoCanWrite') && !overridable.has('Chats')) {
        errors.push("Chats.WhoCanWrite cannot be overridden by space: not in type's SpaceOverridable.");
    }
    if (sc.Chats?.AgentReplyMode && !overridable.has('Chats.AgentReplyMode')) {
        errors.push("Chats.AgentReplyMode cannot be overridden by space: not in type's SpaceOverridable.");
    }
    if (sc.Chats?.HistoryOnAdd && !overridable.has('Chats.HistoryOnAdd')) {
        errors.push("Chats.HistoryOnAdd cannot be overridden by space: not in type's SpaceOverridable.");
    }
    if (sc.PromptParts !== undefined && !overridable.has('PromptParts')) {
        errors.push("PromptParts cannot be overridden by space: not in type's SpaceOverridable.");
    }
    if (sc.Agents?.ListMode && !overridable.has('Agents.ListMode')) {
        errors.push("Agents.ListMode cannot be overridden by space: not in type's SpaceOverridable.");
    }

    if (sc.DataReach !== undefined) {
        errors.push("DataReach is a type's declaration; a space cannot declare its own.");
    }
    if (sc.Grants) {
        for (const kind of Object.keys(sc.Grants)) {
            if (!overridable.has(`Grants.${kind}`) && !overridable.has('Grants')) {
                errors.push(`Grants.${kind} cannot be overridden by space: not in type's SpaceOverridable.`);
            }
        }
    }

    if (sc.Extensions) {
        for (const appName of Object.keys(sc.Extensions)) {
            if (!overridable.has(`Extensions.${appName}`) && !overridable.has('Extensions')) {
                errors.push(`Extensions.${appName} cannot be overridden by space: not in type's SpaceOverridable.`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

export class MissingAppSettingsError extends Error {
    constructor(
        message: string = 'Collaboration application settings row is missing in MJ: Application Settings. Seed metadata/application-settings/.application-settings.json or configure via Collaboration Settings.'
    ) {
        super(message);
        this.name = 'MissingAppSettingsError';
    }
}

export interface ResolveCollaborationSettingsParams {
    /** Spaces in leaf-to-root order: [subSpace, parentSpace, ..., rootSpace]. */
    spaces?: Array<CollaborationSettings | null | undefined>;
    /** The space's type configuration. */
    type?: CollaborationSettings | null | undefined;
    /** The app-wide configuration row from MJ Application Settings. */
    app?: CollaborationSettings | null | undefined;
}

export interface ResolvedCollaborationSettings {
    StorageAccountID: string | null;
    Chats: {
        WhoCanStart: 'Anyone' | 'Owners';
        WhoCanWrite?: ChatWhoCanWrite;
        AgentReplyMode: 'MentionOrOneToOne' | 'MentionOnly' | 'Always';
        HistoryOnAdd: 'None' | 'All' | 'Since';
    };
    Agents: {
        ListMode: 'Extend' | 'Replace';
        EnableBoundActionGrants?: boolean;
    };
    DeliveryPrincipal?: {
        UserID: string | null;
        AllowedPrincipalUserIDs?: string[];
        AllowFallbackToCaller: false;
    };
    Labels?: {
        Tabs?: Record<string, string>;
        Bands?: { Team?: string; Shared?: string };
    };
    Children?: {
        AllowedTypeCodes?: string[];
        MaxOpen?: number;
    };
    Extensions: Record<string, Record<string, ConfigurationValue>>;
}

export const DEFAULT_COLLABORATION_SETTINGS: ResolvedCollaborationSettings = {
    StorageAccountID: null,
    Chats: {
        WhoCanStart: 'Anyone',
        AgentReplyMode: 'MentionOrOneToOne',
        HistoryOnAdd: 'None',
    },
    Agents: {
        ListMode: 'Extend',
    },
    Labels: undefined,
    Extensions: {},
};

const KNOWN_SETTINGS_KEYS = new Set([
    'StorageAccountID',
    'Chats',
    'PromptParts',
    'Agents',
    'DeliveryPrincipal',
    'Labels',
    'Children',
    'SpaceOverridable',
    'Seats',
    'Grants',
    'DataReach',
    'Extensions',
]);

const CONFIG_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates any CollaborationSettings JSON object against the shape and rules.
 * Refuses unknown keys, wrong enum/data values, and enforces SpaceOverridable on space level.
 */
export function ValidateCollaborationSettings(
    config: ConfigurationJsonInput,
    level: 'app' | 'type' | 'space',
    typeConfig?: CollaborationSettings | null
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return { valid: false, errors: ['Configuration must be a non-null object.'] };
    }

    const c = config as RawConfigObject;

    for (const key of Object.keys(c)) {
        if (!KNOWN_SETTINGS_KEYS.has(key)) {
            errors.push(`Unknown settings key: ${key}`);
        }
    }

    if (c['StorageAccountID'] !== undefined && c['StorageAccountID'] !== null && typeof c['StorageAccountID'] !== 'string') {
        errors.push('StorageAccountID must be a string or null.');
    }

    if (c['Chats'] !== undefined) {
        if (!c['Chats'] || typeof c['Chats'] !== 'object' || Array.isArray(c['Chats'])) {
            errors.push('Chats must be an object.');
        } else {
            const chats = c['Chats'] as RawConfigObject;
            for (const k of Object.keys(chats)) {
                if (!['WhoCanStart', 'WhoCanWrite', 'AgentReplyMode', 'HistoryOnAdd'].includes(k)) {
                    errors.push(`Unknown Chats key: ${k}`);
                }
            }
            if (chats['WhoCanStart'] !== undefined && !['Anyone', 'Owners'].includes(chats['WhoCanStart'] as string)) {
                errors.push(`Invalid Chats.WhoCanStart: ${String(chats['WhoCanStart'])}`);
            }
            if (chats['WhoCanWrite'] !== undefined && !['Contributors', 'TeamOnly', 'Owners'].includes(chats['WhoCanWrite'] as string)) {
                errors.push(`Invalid Chats.WhoCanWrite: ${String(chats['WhoCanWrite'])}`);
            }
            if (chats['AgentReplyMode'] !== undefined && !['MentionOrOneToOne', 'MentionOnly', 'Always'].includes(chats['AgentReplyMode'] as string)) {
                errors.push(`Invalid Chats.AgentReplyMode: ${String(chats['AgentReplyMode'])}`);
            }
            if (chats['HistoryOnAdd'] !== undefined && !['None', 'All', 'Since'].includes(chats['HistoryOnAdd'] as string)) {
                errors.push(`Invalid Chats.HistoryOnAdd: ${String(chats['HistoryOnAdd'])}`);
            }
        }
    }

    if (c['PromptParts'] !== undefined) {
        if (!Array.isArray(c['PromptParts'])) {
            errors.push('PromptParts must be an array.');
        } else {
            const entries = c['PromptParts'] as Array<Record<string, ConfigurationValue> | null | undefined>;
            entries.forEach((entry, index) => {
                if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                    errors.push(`PromptParts[${index}] must be an object.`);
                    return;
                }
                if (typeof entry['Name'] !== 'string' || !entry['Name'].trim()) {
                    errors.push(`PromptParts[${index}].Name must be a non-empty string.`);
                }
                if (typeof entry['Text'] !== 'string' || !entry['Text'].trim()) {
                    errors.push(`PromptParts[${index}].Text must be a non-empty string.`);
                }
                if (entry['Role'] !== undefined && !['System', 'User', 'Assistant'].includes(String(entry['Role']))) {
                    errors.push(`PromptParts[${index}].Role must be System, User, or Assistant.`);
                }
                if (entry['MergeBehavior'] !== undefined && !['Override', 'Append'].includes(String(entry['MergeBehavior']))) {
                    errors.push(`PromptParts[${index}].MergeBehavior must be Override or Append.`);
                }
                if (entry['Status'] !== undefined && !['Active', 'Provisional', 'Archived'].includes(String(entry['Status']))) {
                    errors.push(`PromptParts[${index}].Status must be Active, Provisional, or Archived.`);
                }
                if (entry['Band'] !== undefined && !['Team', 'Shared'].includes(String(entry['Band']))) {
                    errors.push(`PromptParts[${index}].Band must be Team or Shared.`);
                }
            });
        }
    }

    if (c['Agents'] !== undefined) {
        if (!c['Agents'] || typeof c['Agents'] !== 'object' || Array.isArray(c['Agents'])) {
            errors.push('Agents must be an object.');
        } else {
            const agents = c['Agents'] as RawConfigObject;
            for (const k of Object.keys(agents)) {
                if (!['ListMode', 'EnableBoundActionGrants'].includes(k)) {
                    errors.push(`Unknown Agents key: ${k}`);
                }
            }
            if (agents['ListMode'] !== undefined && !['Extend', 'Replace'].includes(agents['ListMode'] as string)) {
                errors.push(`Invalid Agents.ListMode: ${String(agents['ListMode'])}`);
            }
            if (agents['EnableBoundActionGrants'] !== undefined && typeof agents['EnableBoundActionGrants'] !== 'boolean') {
                errors.push('Agents.EnableBoundActionGrants must be a boolean.');
            }
        }
    }

    if (c['DeliveryPrincipal'] !== undefined) {
        const dp = c['DeliveryPrincipal'] as DeliveryPrincipalConfig | null;
        if (!dp || typeof dp !== 'object' || Array.isArray(dp)) {
            errors.push('DeliveryPrincipal must be an object.');
        } else {
            for (const k of Object.keys(dp)) {
                if (!['UserID', 'AllowedPrincipalUserIDs', 'AllowFallbackToCaller'].includes(k)) {
                    errors.push(`Unknown DeliveryPrincipal key: ${k}`);
                }
            }
            if (dp.UserID !== undefined && dp.UserID !== null && (typeof dp.UserID !== 'string' || !CONFIG_UUID_RE.test(dp.UserID.trim()))) {
                errors.push('DeliveryPrincipal.UserID must be a valid UUID string or null.');
            }
            if (dp.AllowedPrincipalUserIDs !== undefined) {
                if (!Array.isArray(dp.AllowedPrincipalUserIDs) || dp.AllowedPrincipalUserIDs.some((id) => typeof id !== 'string' || !CONFIG_UUID_RE.test(id.trim()))) {
                    errors.push('DeliveryPrincipal.AllowedPrincipalUserIDs must be an array of valid UUID strings.');
                }
            }
            if (dp.AllowFallbackToCaller !== undefined && dp.AllowFallbackToCaller !== false) {
                errors.push('DeliveryPrincipal.AllowFallbackToCaller cannot be true; fallback to caller identity is forbidden.');
            }
        }
    }

    if (c['Labels'] !== undefined) {
        if (!c['Labels'] || typeof c['Labels'] !== 'object' || Array.isArray(c['Labels'])) {
            errors.push('Labels must be an object.');
        } else {
            const labels = c['Labels'] as RawConfigObject;
            if (labels['Tabs'] !== undefined) {
                if (!labels['Tabs'] || typeof labels['Tabs'] !== 'object' || Array.isArray(labels['Tabs'])) {
                    errors.push('Labels.Tabs must be an object.');
                }
            }
            if (labels['Bands'] !== undefined) {
                const bands = labels['Bands'] as RawConfigObject | null;
                if (!bands || typeof bands !== 'object' || Array.isArray(bands)) errors.push('Labels.Bands must be an object.');
                else {
                    for (const [band, name] of Object.entries(bands)) {
                        if (band !== 'Team' && band !== 'Shared') errors.push(`Labels.Bands.${band}: the bands are Team and Shared.`);
                        else if (typeof name !== 'string' || !name.trim()) errors.push(`Labels.Bands.${band} must be a non-empty string.`);
                    }
                }
            }
        }
    }

    if (c['Children'] !== undefined) {
        if (!c['Children'] || typeof c['Children'] !== 'object' || Array.isArray(c['Children'])) {
            errors.push('Children must be an object.');
        } else {
            const ch = c['Children'] as RawConfigObject;
            if (ch['AllowedTypeCodes'] !== undefined && !Array.isArray(ch['AllowedTypeCodes'])) {
                errors.push('Children.AllowedTypeCodes must be an array of strings.');
            }
            if (ch['MaxOpen'] !== undefined && (typeof ch['MaxOpen'] !== 'number' || ch['MaxOpen'] < 0 || !Number.isInteger(ch['MaxOpen']))) {
                errors.push('Children.MaxOpen must be a non-negative integer.');
            }
        }
    }

    if (c['SpaceOverridable'] !== undefined && !Array.isArray(c['SpaceOverridable'])) {
        errors.push('SpaceOverridable must be an array of strings.');
    }

    if (c['Seats'] !== undefined) {
        const seats = c['Seats'] as RawConfigObject | null;
        if (!seats || typeof seats !== 'object' || Array.isArray(seats)) {
            errors.push('Seats must be an object.');
        } else if (seats['Audience'] !== undefined && !['StaffOnly', 'StaffAndParticipants'].includes(seats['Audience'] as string)) {
            errors.push(`Seats.Audience must be StaffOnly or StaffAndParticipants, not ${String(seats['Audience'])}.`);
        }
    }

    if (c['Extensions'] !== undefined) {
        if (!c['Extensions'] || typeof c['Extensions'] !== 'object' || Array.isArray(c['Extensions'])) {
            errors.push('Extensions must be an object.');
        }
    }

    // Stage 1's keys: how grants combine per kind (D30), and what a type's participants reach (D28)
    if (c['Grants'] !== undefined) {
        const grants = c['Grants'];
        if (!grants || typeof grants !== 'object' || Array.isArray(grants)) errors.push('Grants must be an object keyed by grant kind.');
        else {
            for (const [kind, rule] of Object.entries(grants as Record<string, { ListMode?: RawConfigValue } | null>)) {
                if (!isGrantKind(kind)) errors.push(`Grants.${kind}: not a grant kind (${GRANT_KINDS.join(', ')}).`);
                else if (rule?.ListMode !== undefined && !['Extend', 'Replace'].includes(rule.ListMode as string)) errors.push(`Invalid Grants.${kind}.ListMode: ${String(rule.ListMode)}`);
            }
        }
    }
    if (c['DataReach'] !== undefined) {
        if (!Array.isArray(c['DataReach'])) errors.push('DataReach must be an array of declarations.');
        else (c['DataReach'] as ConfigurationJsonInput[]).forEach((declaration, index) => errors.push(...validateDataReachDeclaration(declaration, index)));
    }

    if (level === 'app') {
        // The app's row sets every key: a key left out would silently fall back to the code's default, and then a typo or a
        // half-written row would look like a working configuration (extensibility plan § 4)
        const requiredKeys: Array<[string, RawConfigValue]> = [
            ['Chats.WhoCanStart', (c['Chats'] as RawConfigObject | undefined)?.['WhoCanStart']],
            ['Chats.AgentReplyMode', (c['Chats'] as RawConfigObject | undefined)?.['AgentReplyMode']],
            ['Chats.HistoryOnAdd', (c['Chats'] as RawConfigObject | undefined)?.['HistoryOnAdd']],
            ['Agents.ListMode', (c['Agents'] as RawConfigObject | undefined)?.['ListMode']],
        ];
        for (const [key, value] of requiredKeys) {
            if (value === undefined) errors.push(`The application's settings must set ${key}.`);
        }
    }

    if (level === 'space') {
        const overridable = new Set(typeConfig?.SpaceOverridable ?? []);
        // Keys that only a type or the app can hold: on a space they would do nothing, so they are refused instead
        for (const typeOnly of ['Children', 'SpaceOverridable', 'Seats', 'DataReach']) {
            if (c[typeOnly] !== undefined) errors.push(`${typeOnly} cannot be set on a space: it belongs to the space type.`);
        }
        const isAllowed = (dottedKey: string): boolean => {
            if (overridable.has(dottedKey)) return true;
            const prefix = dottedKey.split('.')[0];
            return overridable.has(prefix);
        };

        if (c['StorageAccountID'] !== undefined && !isAllowed('StorageAccountID')) {
            errors.push("StorageAccountID cannot be overridden by space: not in type's SpaceOverridable.");
        }
        if (c['Chats'] && typeof c['Chats'] === 'object') {
            const chats = c['Chats'] as RawConfigObject;
            if (chats['WhoCanStart'] !== undefined && !isAllowed('Chats.WhoCanStart')) {
                errors.push("Chats.WhoCanStart cannot be overridden by space: not in type's SpaceOverridable.");
            }
            if (chats['WhoCanWrite'] !== undefined && !isAllowed('Chats.WhoCanWrite')) {
                errors.push("Chats.WhoCanWrite cannot be overridden by space: not in type's SpaceOverridable.");
            }
            if (chats['AgentReplyMode'] !== undefined && !isAllowed('Chats.AgentReplyMode')) {
                errors.push("Chats.AgentReplyMode cannot be overridden by space: not in type's SpaceOverridable.");
            }
            if (chats['HistoryOnAdd'] !== undefined && !isAllowed('Chats.HistoryOnAdd')) {
                errors.push("Chats.HistoryOnAdd cannot be overridden by space: not in type's SpaceOverridable.");
            }
        }
        if (c['PromptParts'] !== undefined && !isAllowed('PromptParts')) {
            errors.push("PromptParts cannot be overridden by space: not in type's SpaceOverridable.");
        }
        if (c['Agents'] && typeof c['Agents'] === 'object') {
            const agents = c['Agents'] as RawConfigObject;
            if (agents['ListMode'] !== undefined && !isAllowed('Agents.ListMode')) {
                errors.push("Agents.ListMode cannot be overridden by space: not in type's SpaceOverridable.");
            }
            if (agents['EnableBoundActionGrants'] !== undefined && !isAllowed('Agents.EnableBoundActionGrants')) {
                errors.push("Agents.EnableBoundActionGrants cannot be overridden by space: not in type's SpaceOverridable.");
            }
        }
        if (c['DeliveryPrincipal'] !== undefined) {
            if (!isAllowed('DeliveryPrincipal') && !isAllowed('DeliveryPrincipal.UserID')) {
                errors.push("DeliveryPrincipal cannot be overridden by space: not in type's SpaceOverridable.");
            } else {
                const spaceDp = c['DeliveryPrincipal'] as DeliveryPrincipalConfig | null;
                const typeAllowed = typeConfig?.DeliveryPrincipal?.AllowedPrincipalUserIDs;
                if (spaceDp?.AllowedPrincipalUserIDs !== undefined) {
                    if (!typeAllowed || spaceDp.AllowedPrincipalUserIDs.some((id) => !typeAllowed.some((tId) => tId.toLowerCase() === id.toLowerCase()))) {
                        errors.push('DeliveryPrincipal.AllowedPrincipalUserIDs on a space cannot widen the space type allowlist.');
                    }
                }
                if (spaceDp?.UserID && typeAllowed && typeAllowed.length > 0) {
                    const match = typeAllowed.some((tId) => tId.toLowerCase() === spaceDp.UserID!.toLowerCase());
                    if (!match) {
                        errors.push('DeliveryPrincipal.UserID on a space must belong to the space type AllowedPrincipalUserIDs.');
                    }
                }
            }
        }
        if (c['Grants'] && typeof c['Grants'] === 'object') {
            for (const kind of Object.keys(c['Grants'] as object)) {
                if (!isAllowed(`Grants.${kind}`)) errors.push(`Grants.${kind} cannot be overridden by space: not in type's SpaceOverridable.`);
            }
        }
        if (c['Extensions'] && typeof c['Extensions'] === 'object') {
            for (const appName of Object.keys(c['Extensions'])) {
                if (!isAllowed(`Extensions.${appName}`) && !isAllowed('Extensions')) {
                    errors.push(`Extensions.${appName} cannot be overridden by space: not in type's SpaceOverridable.`);
                }
            }
        }
        if (c['Labels'] !== undefined) {
            // Checked the way the resolver reads it: each Labels key on its own ('Labels' allows them all, 'Labels.Tabs' the tabs)
            const labels = c['Labels'];
            if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
                errors.push('Labels must be an object.');
            } else {
                for (const key of Object.keys(labels)) {
                    if (key !== 'Tabs' && key !== 'Bands') errors.push(`Unknown Labels key: ${key}`);
                    else if (!isAllowed(`Labels.${key}`)) errors.push(`Labels.${key} cannot be overridden by space: not in type's SpaceOverridable.`);
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Pure hierarchical resolver:
 * sub-space -> parent spaces -> type -> app.
 * First set value wins for each key.
 * Enforces type.SpaceOverridable on all space-level values.
 * Throws MissingAppSettingsError if app configuration is missing.
 */
export function ResolveCollaborationSettings(
    params: ResolveCollaborationSettingsParams
): ResolvedCollaborationSettings {
    if (!params.app) {
        throw new MissingAppSettingsError();
    }

    const typeConfig = params.type;
    const appConfig = params.app;
    const spaces = (params.spaces ?? []).filter((s): s is CollaborationSettings => !!s);
    const overridable = new Set(typeConfig?.SpaceOverridable ?? []);

    const isOverridable = (dottedKey: string): boolean => {
        if (overridable.has(dottedKey)) return true;
        const prefix = dottedKey.split('.')[0];
        return overridable.has(prefix);
    };

    const resolveScalar = <T>(
        dottedKey: string,
        getter: (s: CollaborationSettings) => T | undefined,
        fallback: T
    ): T => {
        if (isOverridable(dottedKey)) {
            for (const s of spaces) {
                const val = getter(s);
                if (val !== undefined) return val;
            }
        }
        if (typeConfig) {
            const val = getter(typeConfig);
            if (val !== undefined) return val;
        }
        const appVal = getter(appConfig);
        if (appVal !== undefined) return appVal;
        return fallback;
    };

    const storageAccountId = resolveScalar(
        'StorageAccountID',
        s => s.StorageAccountID,
        DEFAULT_COLLABORATION_SETTINGS.StorageAccountID
    );

    const whoCanStart = resolveScalar(
        'Chats.WhoCanStart',
        s => s.Chats?.WhoCanStart,
        DEFAULT_COLLABORATION_SETTINGS.Chats.WhoCanStart
    );

    const whoCanWriteRank = (val: ChatWhoCanWrite | undefined): number => {
        if (val === 'Owners') return 2;
        if (val === 'TeamOnly') return 1;
        if (val === 'Contributors') return 0;
        return -1;
    };
    const writeCandidates: Array<ChatWhoCanWrite | undefined> = [
        appConfig.Chats?.WhoCanWrite,
        typeConfig?.Chats?.WhoCanWrite,
        ...(isOverridable('Chats.WhoCanWrite') ? [...spaces].reverse().map((s) => s.Chats?.WhoCanWrite) : []),
    ];
    let whoCanWrite: ChatWhoCanWrite | undefined;
    for (const candidate of writeCandidates) {
        if (!candidate) continue;
        if (!whoCanWrite || whoCanWriteRank(candidate) > whoCanWriteRank(whoCanWrite)) {
            whoCanWrite = candidate;
        }
    }

    const agentReplyMode = resolveScalar(
        'Chats.AgentReplyMode',
        s => s.Chats?.AgentReplyMode,
        DEFAULT_COLLABORATION_SETTINGS.Chats.AgentReplyMode
    );

    const historyOnAdd = resolveScalar(
        'Chats.HistoryOnAdd',
        s => s.Chats?.HistoryOnAdd,
        DEFAULT_COLLABORATION_SETTINGS.Chats.HistoryOnAdd
    );

    const listMode = resolveScalar(
        'Agents.ListMode',
        s => s.Agents?.ListMode,
        DEFAULT_COLLABORATION_SETTINGS.Agents.ListMode
    );
    const enableBoundActionGrants = resolveScalar(
        'Agents.EnableBoundActionGrants',
        s => s.Agents?.EnableBoundActionGrants,
        undefined
    );

    const resolveDeliveryPrincipal = (): ResolvedCollaborationSettings['DeliveryPrincipal'] => {
        // Non-loosening: type/app allowlist acts as ceiling if specified.
        const typeAllowed = typeConfig?.DeliveryPrincipal?.AllowedPrincipalUserIDs ?? appConfig.DeliveryPrincipal?.AllowedPrincipalUserIDs;
        let allowedPrincipalUserIDs: string[] | undefined = typeAllowed ? [...typeAllowed] : undefined;
        let resolvedUserId: string | null = null;
        if (isOverridable('DeliveryPrincipal') || isOverridable('DeliveryPrincipal.UserID')) {
            for (const s of spaces) {
                const candidate = s.DeliveryPrincipal?.UserID;
                if (candidate && (!allowedPrincipalUserIDs || allowedPrincipalUserIDs.some((a) => a.toLowerCase() === candidate.toLowerCase()))) {
                    resolvedUserId = candidate;
                    break;
                }
            }
        }
        if (!resolvedUserId && typeConfig?.DeliveryPrincipal?.UserID) {
            resolvedUserId = typeConfig.DeliveryPrincipal.UserID;
        }
        if (!resolvedUserId && appConfig.DeliveryPrincipal?.UserID) {
            resolvedUserId = appConfig.DeliveryPrincipal.UserID;
        }
        if (!resolvedUserId && !allowedPrincipalUserIDs) return undefined;
        return {
            UserID: resolvedUserId,
            ...(allowedPrincipalUserIDs ? { AllowedPrincipalUserIDs: allowedPrincipalUserIDs } : {}),
            AllowFallbackToCaller: false,
        };
    };
    const deliveryPrincipal = resolveDeliveryPrincipal();

    // Tab keys merge without regard to case: the app's 'Library' and a type's 'library' are one key, and the nearer level wins
    const mergeTabs = (into: Record<string, string>, from: Record<string, string> | undefined): Record<string, string> => {
        const merged = { ...into };
        for (const [key, label] of Object.entries(from ?? {})) {
            for (const existing of Object.keys(merged)) {
                if (existing.toLowerCase().trim() === key.toLowerCase().trim()) delete merged[existing];
            }
            merged[key.toLowerCase().trim()] = label;
        }
        return merged;
    };
    let tabs: Record<string, string> | undefined = mergeTabs(mergeTabs({}, appConfig.Labels?.Tabs), typeConfig?.Labels?.Tabs);
    if (isOverridable('Labels.Tabs') || isOverridable('Labels')) {
        for (const s of [...spaces].reverse()) {
            if (s.Labels?.Tabs) {
                tabs = mergeTabs(tabs, s.Labels.Tabs);
            }
        }
    }
    if (Object.keys(tabs).length === 0) {
        tabs = undefined;
    }
    // The bands' names: the nearest value wins per band; a space's only where the type lets it (item 53)
    const bandLevels: Array<CollaborationSettings | null | undefined> = [...(isOverridable('Labels.Bands') || isOverridable('Labels') ? spaces : []), typeConfig, appConfig];
    const bandName = (band: 'Team' | 'Shared'): string | undefined => {
        for (const level of bandLevels) {
            const name = level?.Labels?.Bands?.[band];
            if (typeof name === 'string' && name.trim()) return name;
        }
        return undefined;
    };
    const teamName = bandName('Team');
    const sharedName = bandName('Shared');
    const bands = teamName || sharedName ? { ...(teamName ? { Team: teamName } : {}), ...(sharedName ? { Shared: sharedName } : {}) } : undefined;

    const extensions: Record<string, Record<string, ConfigurationValue>> = {
        ...(appConfig.Extensions ?? {}),
        ...(typeConfig?.Extensions ?? {}),
    };
    for (const s of [...spaces].reverse()) {
        if (s.Extensions) {
            for (const [appName, ext] of Object.entries(s.Extensions)) {
                if (isOverridable(`Extensions.${appName}`) || isOverridable('Extensions')) {
                    extensions[appName] = {
                        ...(extensions[appName] ?? {}),
                        ...ext,
                    };
                }
            }
        }
    }

    return {
        StorageAccountID: storageAccountId,
        Chats: {
            WhoCanStart: whoCanStart,
            ...(whoCanWrite ? { WhoCanWrite: whoCanWrite } : {}),
            AgentReplyMode: agentReplyMode,
            HistoryOnAdd: historyOnAdd,
        },
        Agents: {
            ListMode: listMode,
            ...(enableBoundActionGrants !== undefined ? { EnableBoundActionGrants: enableBoundActionGrants } : {}),
        },
        ...(deliveryPrincipal ? { DeliveryPrincipal: deliveryPrincipal } : {}),
        Labels: tabs || bands ? { ...(tabs ? { Tabs: tabs } : {}), ...(bands ? { Bands: bands } : {}) } : undefined,
        Children: typeConfig?.Children,
        Extensions: extensions,
    };
}

/**
 * Whether a space of `childTypeCode` may sit under a space whose type has `parentTypeConfig`. A type that lists no
 * `Children.AllowedTypeCodes` allows any child; a listed (even empty) list allows exactly those. `MaxOpen` caps the open children.
 * Returns the refusal, or null.
 */
export function refuseChildType(
    parentTypeConfig: CollaborationSettings | null | undefined,
    childTypeCode: string | null | undefined,
    openSiblings: number,
): string | null {
    const children = parentTypeConfig?.Children;
    if (!children) return null;
    const allowed = children.AllowedTypeCodes;
    if (allowed) {
        const code = (childTypeCode ?? '').toLowerCase().trim();
        if (!allowed.some((candidate) => candidate.toLowerCase().trim() === code)) {
            return allowed.length === 0
                ? 'This kind of space cannot contain sub-spaces.'
                : `A space of type "${childTypeCode ?? 'unknown'}" cannot sit under this kind of space (allowed: ${allowed.join(', ')}).`;
        }
    }
    if (children.MaxOpen !== undefined && openSiblings >= children.MaxOpen) {
        return `This space already holds ${openSiblings} open sub-spaces, the most its type allows (${children.MaxOpen}).`;
    }
    return null;
}

/** Who a type seats, as its configuration says; absent fails closed to 'StaffAndParticipants' (item 142). */
export function typeSeatsAudience(typeConfig: CollaborationSettings | null | undefined): 'StaffOnly' | 'StaffAndParticipants' {
    return typeConfig?.Seats?.Audience === 'StaffOnly' ? 'StaffOnly' : 'StaffAndParticipants';
}
