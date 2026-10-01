/**
 * Collaboration's settings shape (MJ_BizApps_Collaboration: Space Types.Configuration and Spaces.Configuration): one shape at
 * every level, the app's, a type's and a space's, resolved most-specific-first within SpaceOverridable (D20). The source of truth
 * is packages/Core/src/configuration.ts; this copy is what CodeGen reads.
 */

export type ConfigurationValue =
    | string
    | number
    | boolean
    | null
    | ConfigurationValue[]
    | { [key: string]: ConfigurationValue };

/**
 * The single typed settings shape for BizApps Collaboration at every level
 * (App, SpaceType, Space, SubSpace).
 */
export interface CollaborationSettings {
    /** Target storage account ID for file uploads. Resolves hierarchically. */
    StorageAccountID?: string | null;
    /** Access level permitted after a space closes. App default is 'ReadOnly'. */
    PostCloseAccess?: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None';
    /** Duration in days after closing before post-close access lapses. null = indefinite. */
    PostCloseAccessDays?: number | null;
    /** Chat behavior rules. */
    Chats?: {
        /** Who may start a chat. Default 'Anyone': anyone whose seat can post (a guest who can't post can't start one either). 'Owners' narrows it to owners. */
        WhoCanStart?: 'Anyone' | 'Owners';
        /** When an agent replies. Default 'MentionOrOneToOne'. */
        AgentReplyMode?: 'MentionOrOneToOne' | 'MentionOnly' | 'Always';
        /** The choice preselected when someone is added to an existing chat. Default 'None'. */
        HistoryOnAdd?: 'None' | 'All' | 'Since';
    };
    /** Agent inheritance rules. */
    Agents?: {
        /** How this level's SpaceAgent rows combine with the list above. Default 'Extend'. */
        ListMode?: 'Extend' | 'Replace';
    };
    /** Word overrides, e.g. { Tabs: { Library: 'Papers', People: 'Members' } }. */
    Labels?: {
        Tabs?: Record<string, string>;
    };
    /** Types that may be created under a space of this type. */
    Children?: {
        AllowedTypeCodes?: string[];
        MaxOpen?: number;
    };
    /** Dotted keys a space may override, for example 'StorageAccountID', 'Chats.WhoCanStart'. */
    SpaceOverridable?: string[];
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
export function validateDataReachDeclaration(declaration: unknown, index: number): string[] {
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
