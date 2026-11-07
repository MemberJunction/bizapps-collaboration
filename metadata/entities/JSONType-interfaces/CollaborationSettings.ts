/**
 * Collaboration's settings shape (MJ_BizApps_Collaboration: Space Types.Configuration and Spaces.Configuration): one shape at
 * every level, the app's, a type's and a space's, resolved most-specific-first within SpaceOverridable (D20). The source of truth
 * is packages/Core/src/configuration.ts; this copy is what CodeGen reads, and it holds types only: CodeGen inlines it into the
 * generated entities file once per field that names it, so a function or a constant here would be declared twice.
 */

/** D27's seven kinds of thing a grant can offer (packages/Core/src/grants.ts). */
export type GrantKind = 'Agent' | 'Action' | 'Query' | 'View' | 'Dashboard' | 'Component' | 'KnowledgeSource';

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

export interface ISpaceRules extends CollaborationSettings {}
export interface ISpaceTypeConfiguration extends CollaborationSettings {}
export interface ISpaceConfiguration extends CollaborationSettings {}
