import { BaseEntity, EntitySaveOptions, EntityDeleteOptions, CompositeKey, ValidationResult, ValidationErrorInfo, ValidationErrorType, Metadata, ProviderType, DatabaseProviderBase, RunView } from "@memberjunction/core";
import { RegisterClass } from "@memberjunction/global";
import { z } from "zod";

     
 
/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Item Uses
 */
export const mjBizAppsCollaborationItemUseSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    ItemID: z.string().describe(`
        * * Field Name: ItemID
        * * Display Name: Item ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Items (vwSpaceItems.ID)
        * * Description: The space item that was used.`),
    UserID: z.string().describe(`
        * * Field Name: UserID
        * * Display Name: User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: The member who opened, uploaded, or promoted the item.`),
    UsedAt: z.date().describe(`
        * * Field Name: UsedAt
        * * Display Name: Used At
        * * SQL Data Type: datetimeoffset
        * * Description: When the use happened.`),
    Kind: z.union([z.literal('open'), z.literal('promote'), z.literal('upload')]).describe(`
        * * Field Name: Kind
        * * Display Name: Kind
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * open
    *   * promote
    *   * upload
        * * Description: open, upload, or promote.`),
    SpaceID: z.string().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: The space the use happened in. Required so the read filter can keep the row inside spaces the caller reaches.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    User: z.string().describe(`
        * * Field Name: User
        * * Display Name: User
        * * SQL Data Type: nvarchar(100)`),
    Space: z.string().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsCollaborationItemUseEntityType = z.infer<typeof mjBizAppsCollaborationItemUseSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Share Notices
 */
export const mjBizAppsCollaborationShareNoticeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceID: z.string().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: The space the notice belongs to. The read filter keeps a caller inside spaces they reach.`),
    ItemID: z.string().describe(`
        * * Field Name: ItemID
        * * Display Name: Item ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Items (vwSpaceItems.ID)
        * * Description: The space item that was shared.`),
    RecipientUserID: z.string().describe(`
        * * Field Name: RecipientUserID
        * * Display Name: Recipient User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: The member the notice is for.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Space: z.string().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
    RecipientUser: z.string().describe(`
        * * Field Name: RecipientUser
        * * Display Name: Recipient User
        * * SQL Data Type: nvarchar(100)`),
});

export type mjBizAppsCollaborationShareNoticeEntityType = z.infer<typeof mjBizAppsCollaborationShareNoticeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Anchors
 */
export const mjBizAppsCollaborationSpaceAnchorSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceID: z.string().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: The space.`),
    SpaceTypeID: z.string().describe(`
        * * Field Name: SpaceTypeID
        * * Display Name: Space Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Types (vwSpaceTypes.ID)
        * * Description: The space's type, denormalized so the primary-per-type index can hold; the server keeps it equal to the space's and rewrites it when the type changes.`),
    EntityID: z.string().describe(`
        * * Field Name: EntityID
        * * Display Name: Entity ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
        * * Description: The entity of the anchored record.`),
    RecordID: z.string().describe(`
        * * Field Name: RecordID
        * * Display Name: Record ID
        * * SQL Data Type: nvarchar(450)
        * * Description: The record's key, in the canonical shape SpaceItem.RecordID uses.`),
    Role: z.string().describe(`
        * * Field Name: Role
        * * Display Name: Role
        * * SQL Data Type: nvarchar(100)
        * * Description: What the record is to the space, in the type's vocabulary: chapter, sponsor, event. Data reach (D28) names an anchor by this role.`),
    IsPrimary: z.boolean().describe(`
        * * Field Name: IsPrimary
        * * Display Name: Is Primary
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: The one anchor a space is found by. At most one per space.`),
    Sequence: z.number().describe(`
        * * Field Name: Sequence
        * * Display Name: Sequence
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: Display order among the space's anchors.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Space: z.string().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
    SpaceType: z.string().describe(`
        * * Field Name: SpaceType
        * * Display Name: Space Type
        * * SQL Data Type: nvarchar(200)`),
    Entity: z.string().describe(`
        * * Field Name: Entity
        * * Display Name: Entity
        * * SQL Data Type: nvarchar(255)`),
});

export type mjBizAppsCollaborationSpaceAnchorEntityType = z.infer<typeof mjBizAppsCollaborationSpaceAnchorSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Chats
 */
export const mjBizAppsCollaborationSpaceChatSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newid()`),
    SpaceID: z.string().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)`),
    ConversationID: z.string().describe(`
        * * Field Name: ConversationID
        * * Display Name: Conversation ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Conversations (vwConversations.ID)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(255)`),
    Subject: z.string().nullable().describe(`
        * * Field Name: Subject
        * * Display Name: Subject
        * * SQL Data Type: nvarchar(500)`),
    Kind: z.union([z.literal('General'), z.literal('Private'), z.literal('Topic')]).describe(`
        * * Field Name: Kind
        * * Display Name: Kind
        * * SQL Data Type: nvarchar(50)
        * * Default Value: General
    * * Value List Type: List
    * * Possible Values 
    *   * General
    *   * Private
    *   * Topic`),
    Status: z.union([z.literal('Active'), z.literal('Archived')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(50)
        * * Default Value: Active
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Archived`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    ArchivedOnSpaceClose: z.boolean().describe(`
        * * Field Name: ArchivedOnSpaceClose
        * * Display Name: Archived On Space Close
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Indicates whether this space chat conversation was archived when its space was closed so it can be restored on reopen.`),
    Space: z.string().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
    Conversation: z.string().nullable().describe(`
        * * Field Name: Conversation
        * * Display Name: Conversation
        * * SQL Data Type: nvarchar(255)`),
});

export type mjBizAppsCollaborationSpaceChatEntityType = z.infer<typeof mjBizAppsCollaborationSpaceChatSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Grants
 */
export const mjBizAppsCollaborationSpaceGrantSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceTypeID: z.string().nullable().describe(`
        * * Field Name: SpaceTypeID
        * * Display Name: Space Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Types (vwSpaceTypes.ID)
        * * Description: The type the grant belongs to; null with SpaceID null is the app's own row.`),
    SpaceID: z.string().nullable().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: The space the grant belongs to; never set together with SpaceTypeID.`),
    Kind: z.union([z.literal('Action'), z.literal('Agent'), z.literal('Component'), z.literal('Dashboard'), z.literal('KnowledgeSource'), z.literal('Query'), z.literal('View')]).describe(`
        * * Field Name: Kind
        * * Display Name: Kind
        * * SQL Data Type: nvarchar(30)
    * * Value List Type: List
    * * Possible Values 
    *   * Action
    *   * Agent
    *   * Component
    *   * Dashboard
    *   * KnowledgeSource
    *   * Query
    *   * View
        * * Description: Agent, Action, Query, View, Dashboard, Component or KnowledgeSource. TargetEntityID must be the kind's entity.`),
    TargetEntityID: z.string().describe(`
        * * Field Name: TargetEntityID
        * * Display Name: Target Entity ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
        * * Description: The target's entity: MJ: AI Agents, MJ: Actions, MJ: Queries, MJ: User Views, MJ: Dashboards, MJ: Components or MJ: Content Sources, by Kind.`),
    TargetRecordID: z.string().describe(`
        * * Field Name: TargetRecordID
        * * Display Name: Target Record ID
        * * SQL Data Type: nvarchar(450)
        * * Description: The target record's key.`),
    Label: z.string().nullable().describe(`
        * * Field Name: Label
        * * Display Name: Label
        * * SQL Data Type: nvarchar(200)
        * * Description: What the space calls the target; null uses the target's own name.`),
    Band: z.union([z.literal('Shared'), z.literal('Team')]).describe(`
        * * Field Name: Band
        * * Display Name: Band
        * * SQL Data Type: nvarchar(10)
        * * Default Value: Shared
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
        * * Description: The band that may use the grant (D31). A Team grant is not offered in a chat where anyone cannot see Team.`),
    IsDefault: z.boolean().describe(`
        * * Field Name: IsDefault
        * * Display Name: Is Default
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: For an Agent grant: the agent a chat at this level starts with. One per level.`),
    Bindings: z.any().nullable().describe(`
        * * Field Name: Bindings
        * * Display Name: Bindings
        * * SQL Data Type: nvarchar(MAX)
        * * JSON Type: mjBizAppsCollaborationSpaceGrantEntity_SpaceGrantBindings
        * * Description: JSON (SpaceGrantBindings): the target's parameter or property names mapped to where each value comes from: an anchor by role, a column of the space, a configuration key, the user, or a literal (D27).`),
    Settings: z.any().nullable().describe(`
        * * Field Name: Settings
        * * Display Name: Settings
        * * SQL Data Type: nvarchar(MAX)
        * * JSON Type: mjBizAppsCollaborationSpaceGrantEntity_AgentGrantSettings
        * * Description: JSON (AgentGrantSettings) for an Agent grant: skills, plan mode, effort, memory writes and per-run limits, each only narrowing the agent's own definition (D31). Null for the other kinds.`),
    Mode: z.union([z.literal('Extend'), z.literal('Remove')]).describe(`
        * * Field Name: Mode
        * * Display Name: Mode
        * * SQL Data Type: nvarchar(10)
        * * Default Value: Extend
    * * Value List Type: List
    * * Possible Values 
    *   * Extend
    *   * Remove
        * * Description: Extend adds the target at this level; Remove takes a target granted above out of this level's list (D30).`),
    Sequence: z.number().describe(`
        * * Field Name: Sequence
        * * Display Name: Sequence
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: Display order within the level.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    SpaceType: z.string().nullable().describe(`
        * * Field Name: SpaceType
        * * Display Name: Space Type
        * * SQL Data Type: nvarchar(200)`),
    Space: z.string().nullable().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
    TargetEntity: z.string().describe(`
        * * Field Name: TargetEntity
        * * Display Name: Target Entity
        * * SQL Data Type: nvarchar(255)`),
});

export type mjBizAppsCollaborationSpaceGrantEntityType = z.infer<typeof mjBizAppsCollaborationSpaceGrantSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Items
 */
export const mjBizAppsCollaborationSpaceItemSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceID: z.string().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)`),
    EntityID: z.string().describe(`
        * * Field Name: EntityID
        * * Display Name: Entity ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
        * * Description: The entity the item points at. Same polymorphic pair TaskLink uses.`),
    RecordID: z.string().describe(`
        * * Field Name: RecordID
        * * Display Name: Record ID
        * * SQL Data Type: nvarchar(450)
        * * Description: Primary key of the pointed-at record, as text, matching TaskLink.RecordID.`),
    Band: z.union([z.literal('Shared'), z.literal('Team')]).describe(`
        * * Field Name: Band
        * * Display Name: Band
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
        * * Description: Team (working material, not in the client-facing agent scope) or Shared (promoted, with an actor and a timestamp).`),
    PromotedAt: z.date().nullable().describe(`
        * * Field Name: PromotedAt
        * * Display Name: Promoted At
        * * SQL Data Type: datetimeoffset
        * * Description: When a Shared item was promoted. Null on Team items.`),
    PromotedByUserID: z.string().nullable().describe(`
        * * Field Name: PromotedByUserID
        * * Display Name: Promoted By User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: MJ user who promoted a Shared item. Required together with PromotedAt. Null on Team items.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Folder: z.string().nullable().describe(`
        * * Field Name: Folder
        * * Display Name: Folder
        * * SQL Data Type: nvarchar(200)
        * * Description: Folder label inside the space. Null means Unfiled. Collections cannot say everyone in the space, so the folder lives on the item.`),
    ArtifactVersionID: z.string().nullable().describe(`
        * * Field Name: ArtifactVersionID
        * * Display Name: Artifact Version ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Artifact Versions (vwArtifactVersions.ID)
        * * Description: For a document in the Library: the MJ Artifact Version (ContentMode File) wrapping the MJ: Files row the item points at, so the document has a type, a viewer and versions. NULL for items that are not files. Artifact Permissions are not used by the Library; the roster is the one sharing model.`),
    Space: z.string().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
    Entity: z.string().describe(`
        * * Field Name: Entity
        * * Display Name: Entity
        * * SQL Data Type: nvarchar(255)`),
    PromotedByUser: z.string().nullable().describe(`
        * * Field Name: PromotedByUser
        * * Display Name: Promoted By User
        * * SQL Data Type: nvarchar(100)`),
    ArtifactVersion: z.string().nullable().describe(`
        * * Field Name: ArtifactVersion
        * * Display Name: Artifact Version
        * * SQL Data Type: nvarchar(255)`),
});

export type mjBizAppsCollaborationSpaceItemEntityType = z.infer<typeof mjBizAppsCollaborationSpaceItemSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Member Pins
 */
export const mjBizAppsCollaborationSpaceMemberPinSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceID: z.string().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: The space the pin is in.`),
    UserID: z.string().describe(`
        * * Field Name: UserID
        * * Display Name: User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: Whose pin it is: the caller.`),
    Kind: z.union([z.literal('Grant'), z.literal('Record')]).describe(`
        * * Field Name: Kind
        * * Display Name: Kind
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Grant
    *   * Record
        * * Description: Record: a record of the space by entity and key. Grant: one of the space's grants.`),
    TargetEntityID: z.string().nullable().describe(`
        * * Field Name: TargetEntityID
        * * Display Name: Target Entity ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
        * * Description: For a Record pin: the record's entity.`),
    TargetRecordID: z.string().nullable().describe(`
        * * Field Name: TargetRecordID
        * * Display Name: Target Record ID
        * * SQL Data Type: nvarchar(450)
        * * Description: For a Record pin: the record's key.`),
    GrantID: z.string().nullable().describe(`
        * * Field Name: GrantID
        * * Display Name: Grant ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Grants (vwSpaceGrants.ID)
        * * Description: For a Grant pin: the grant in force for the member's space and band.`),
    Sequence: z.number().describe(`
        * * Field Name: Sequence
        * * Display Name: Sequence
        * * SQL Data Type: int
        * * Default Value: 0
        * * Description: The member's order of pins.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Space: z.string().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
    User: z.string().describe(`
        * * Field Name: User
        * * Display Name: User
        * * SQL Data Type: nvarchar(100)`),
    TargetEntity: z.string().nullable().describe(`
        * * Field Name: TargetEntity
        * * Display Name: Target Entity
        * * SQL Data Type: nvarchar(255)`),
});

export type mjBizAppsCollaborationSpaceMemberPinEntityType = z.infer<typeof mjBizAppsCollaborationSpaceMemberPinSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Members
 */
export const mjBizAppsCollaborationSpaceMemberSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceID: z.string().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)`),
    UserID: z.string().describe(`
        * * Field Name: UserID
        * * Display Name: User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)`),
    SpaceRoleTypeID: z.string().describe(`
        * * Field Name: SpaceRoleTypeID
        * * Display Name: Space Role Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Role Types (vwSpaceRoleTypes.ID)`),
    Band: z.union([z.literal('Shared'), z.literal('Team')]).describe(`
        * * Field Name: Band
        * * Display Name: Band
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
        * * Description: Team or Shared. Set by the server from the role: CanSeeTeamBand seats the person on Team, otherwise Shared. The filter reads the role, not this column.`),
    Status: z.union([z.literal('Active'), z.literal('Invited'), z.literal('Removed')]).describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Invited
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Invited
    *   * Removed
        * * Description: Invited, Active, or Removed. New rows start Invited unless the type auto-approves.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    SyncSource: z.string().nullable().describe(`
        * * Field Name: SyncSource
        * * Display Name: Sync Source
        * * SQL Data Type: nvarchar(100)`),
    PersonID: z.string().nullable().describe(`
        * * Field Name: PersonID
        * * Display Name: Person ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Common: People (vwPeople.ID)`),
    Space: z.string().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
    User: z.string().describe(`
        * * Field Name: User
        * * Display Name: User
        * * SQL Data Type: nvarchar(100)`),
    SpaceRoleType: z.string().describe(`
        * * Field Name: SpaceRoleType
        * * Display Name: Space Role Type
        * * SQL Data Type: nvarchar(200)`),
    Person: z.string().nullable().describe(`
        * * Field Name: Person
        * * Display Name: Person
        * * SQL Data Type: nvarchar(201)`),
});

export type mjBizAppsCollaborationSpaceMemberEntityType = z.infer<typeof mjBizAppsCollaborationSpaceMemberSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Notes
 */
export const mjBizAppsCollaborationSpaceNoteSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceID: z.string().describe(`
        * * Field Name: SpaceID
        * * Display Name: Space ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: The space the note belongs to.`),
    Title: z.string().describe(`
        * * Field Name: Title
        * * Display Name: Title
        * * SQL Data Type: nvarchar(200)
        * * Description: The note's title.`),
    Body: z.string().nullable().describe(`
        * * Field Name: Body
        * * Display Name: Body
        * * SQL Data Type: nvarchar(MAX)
        * * Description: The note's body, Markdown.`),
    Band: z.union([z.literal('Shared'), z.literal('Team')]).describe(`
        * * Field Name: Band
        * * Display Name: Band
        * * SQL Data Type: nvarchar(10)
        * * Default Value: Team
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
        * * Description: Team or Shared: who in the space may read it. A Team note moves to Shared only when the plan's call 15 allows it.`),
    Visibility: z.union([z.literal('Private'), z.literal('Space')]).describe(`
        * * Field Name: Visibility
        * * Display Name: Visibility
        * * SQL Data Type: nvarchar(10)
        * * Default Value: Space
    * * Value List Type: List
    * * Possible Values 
    *   * Private
    *   * Space
        * * Description: Space: the band reads it. Private: the author alone, and then the band is Team.`),
    AuthorUserID: z.string().describe(`
        * * Field Name: AuthorUserID
        * * Display Name: Author User ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: Who wrote the note: the caller on create, and the only one who edits or deletes it.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    Space: z.string().describe(`
        * * Field Name: Space
        * * Display Name: Space
        * * SQL Data Type: nvarchar(200)`),
    AuthorUser: z.string().describe(`
        * * Field Name: AuthorUser
        * * Display Name: Author User
        * * SQL Data Type: nvarchar(100)`),
});

export type mjBizAppsCollaborationSpaceNoteEntityType = z.infer<typeof mjBizAppsCollaborationSpaceNoteSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Role Types
 */
export const mjBizAppsCollaborationSpaceRoleTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    Level: z.number().describe(`
        * * Field Name: Level
        * * Display Name: Level
        * * SQL Data Type: int
        * * Description: This role's own authority. A grant must be of a role whose Level is <= the grantor's MaxGrantableLevel.`),
    MaxGrantableLevel: z.number().describe(`
        * * Field Name: MaxGrantableLevel
        * * Display Name: Max Grantable Level
        * * SQL Data Type: int
        * * Description: Highest Level this role may grant. Always <= Level.`),
    CanInvite: z.boolean().describe(`
        * * Field Name: CanInvite
        * * Display Name: Can Invite
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Holder may invite members into a space they belong to, inside their own subtree, at or below MaxGrantableLevel.`),
    CanPromoteBand: z.boolean().describe(`
        * * Field Name: CanPromoteBand
        * * Display Name: Can Promote Band
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Holder may move an item from Team to Shared.`),
    CanSeeTeamBand: z.boolean().describe(`
        * * Field Name: CanSeeTeamBand
        * * Display Name: Can See Team Band
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Holder may read Team-band items. Shared-band items do not need this flag.`),
    IsOwnerRole: z.boolean().describe(`
        * * Field Name: IsOwnerRole
        * * Display Name: Is Owner Role
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: The role that defines ownership of a space. The engine reads the flag, not the name.`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    CanContribute: z.boolean().describe(`
        * * Field Name: CanContribute
        * * Display Name: Can Contribute
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: 1 if the role may contribute content (create, update, or post items, tasks, and messages); 0 for read-only roles.`),
});

export type mjBizAppsCollaborationSpaceRoleTypeEntityType = z.infer<typeof mjBizAppsCollaborationSpaceRoleTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Type Status
 */
export const mjBizAppsCollaborationSpaceTypeStatusSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceTypeID: z.string().describe(`
        * * Field Name: SpaceTypeID
        * * Display Name: Space Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Types (vwSpaceTypes.ID)
        * * Description: The type this status belongs to.`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)
        * * Description: The status's key within its type: active, paused, closed, archived, or a type's own.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(100)
        * * Description: What the status is called on screen.`),
    Sequence: z.number().describe(`
        * * Field Name: Sequence
        * * Display Name: Sequence
        * * SQL Data Type: int
        * * Description: The definitive order of the type's statuses, for display and for the rule that a terminal status may only move forward.`),
    IsDefault: z.boolean().describe(`
        * * Field Name: IsDefault
        * * Display Name: Is Default
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: The status a new space of the type starts in; one per type.`),
    ReadOnly: z.boolean().describe(`
        * * Field Name: ReadOnly
        * * Display Name: Read Only
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Members may read but not post, upload, assign or edit while the space is in this status.`),
    Visible: z.boolean().describe(`
        * * Field Name: Visible
        * * Display Name: Visible
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: The space is listed and reachable by its members; off hides it from everyone but its owner and staff.`),
    AgentRetrieval: z.boolean().describe(`
        * * Field Name: AgentRetrieval
        * * Display Name: Agent Retrieval
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: An agent may quote the space's material while it is in this status.`),
    CanChangeAfter: z.boolean().describe(`
        * * Field Name: CanChangeAfter
        * * Display Name: Can Change After
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Once a space reaches this status it may still move to another; off freezes it there. A frozen status must be terminal.`),
    NotifyMembersOnEnter: z.boolean().describe(`
        * * Field Name: NotifyMembersOnEnter
        * * Display Name: Notify Members On Enter
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Entering this status sends the space's "status changed" notice, one per member, through MJ's notification chain.`),
    IsTerminal: z.boolean().describe(`
        * * Field Name: IsTerminal
        * * Display Name: Is Terminal
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Entering this status stamps Space.ClosedAt; retention and the closed views count from it. From a terminal status a space may move only to a higher Sequence, never back to an open one.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    SpaceType: z.string().describe(`
        * * Field Name: SpaceType
        * * Display Name: Space Type
        * * SQL Data Type: nvarchar(200)`),
});

export type mjBizAppsCollaborationSpaceTypeStatusEntityType = z.infer<typeof mjBizAppsCollaborationSpaceTypeStatusSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Space Types
 */
export const mjBizAppsCollaborationSpaceTypeSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    Code: z.string().describe(`
        * * Field Name: Code
        * * Display Name: Code
        * * SQL Data Type: nvarchar(40)
        * * Description: Stable metadata key. The engine does not branch on it.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Display name of the type.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    Vocabulary: z.string().describe(`
        * * Field Name: Vocabulary
        * * Display Name: Vocabulary
        * * SQL Data Type: nvarchar(50)
        * * Description: Human noun for spaces of this type (workspace, committee, cohort, community). Open set.`),
    Discoverability: z.union([z.literal('Hidden'), z.literal('Listed'), z.literal('Open')]).describe(`
        * * Field Name: Discoverability
        * * Display Name: Discoverability
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Hidden
    * * Value List Type: List
    * * Possible Values 
    *   * Hidden
    *   * Listed
    *   * Open
        * * Description: Hidden, Listed, or Open. Modelled now; the community surface that uses Listed and Open is a later release.`),
    JoinMode: z.union([z.literal('InviteOnly'), z.literal('RequestToJoin'), z.literal('SelfServe')]).describe(`
        * * Field Name: JoinMode
        * * Display Name: Join Mode
        * * SQL Data Type: nvarchar(20)
        * * Default Value: InviteOnly
    * * Value List Type: List
    * * Possible Values 
    *   * InviteOnly
    *   * RequestToJoin
    *   * SelfServe
        * * Description: InviteOnly, RequestToJoin, or SelfServe.`),
    MessagingPanel: z.boolean().describe(`
        * * Field Name: MessagingPanel
        * * Display Name: Messaging Panel
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Conversation panel is on for spaces of this type.`),
    LibraryPanel: z.boolean().describe(`
        * * Field Name: LibraryPanel
        * * Display Name: Library Panel
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: File library panel is on.`),
    WorkPanel: z.boolean().describe(`
        * * Field Name: WorkPanel
        * * Display Name: Work Panel
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Task / work panel is on.`),
    DefaultAgentRetrieval: z.union([z.literal('ExcludedEntirely'), z.literal('ExcludedFromParentScope'), z.literal('Included')]).describe(`
        * * Field Name: DefaultAgentRetrieval
        * * Display Name: Default Agent Retrieval
        * * SQL Data Type: nvarchar(30)
        * * Default Value: Included
    * * Value List Type: List
    * * Possible Values 
    *   * ExcludedEntirely
    *   * ExcludedFromParentScope
    *   * Included
        * * Description: Default AgentRetrieval for a new space of this type.`),
    DefaultBand: z.union([z.literal('Shared'), z.literal('Team')]).describe(`
        * * Field Name: DefaultBand
        * * Display Name: Default Band
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Team
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
        * * Description: Default Team or Shared band for a new item in a space of this type.`),
    InviteApproval: z.union([z.literal('Approve'), z.literal('AutoApprove')]).describe(`
        * * Field Name: InviteApproval
        * * Display Name: Invite Approval
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Approve
    * * Value List Type: List
    * * Possible Values 
    *   * Approve
    *   * AutoApprove
        * * Description: Approve: a new member stays Invited until an owner of the space sets them Active. AutoApprove: the server creates the member Active. The invited person does not activate themselves.`),
    MemberCap: z.number().nullable().describe(`
        * * Field Name: MemberCap
        * * Display Name: Member Cap
        * * SQL Data Type: int
        * * Description: Maximum members in one space of this type. Null means no cap.`),
    DisplayRank: z.number().describe(`
        * * Field Name: DisplayRank
        * * Display Name: Display Rank
        * * SQL Data Type: int
        * * Default Value: 0`),
    IsActive: z.boolean().describe(`
        * * Field Name: IsActive
        * * Display Name: Is Active
        * * SQL Data Type: bit
        * * Default Value: 1`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    DefaultAllowParentAssignees: z.boolean().describe(`
        * * Field Name: DefaultAllowParentAssignees
        * * Display Name: Default Allow Parent Assignees
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: Default AllowParentAssignees setting for new spaces of this type.`),
    IconClass: z.string().nullable().describe(`
        * * Field Name: IconClass
        * * Display Name: Icon Class
        * * SQL Data Type: nvarchar(100)
        * * Description: Font Awesome icon class representing the space type (e.g., fa-solid fa-compass).`),
    Color: z.string().nullable().describe(`
        * * Field Name: Color
        * * Display Name: Color
        * * SQL Data Type: nvarchar(50)
        * * Description: Hex color code representing the space type (e.g., #0076b6).`),
    ServerDriverClass: z.string().nullable().describe(`
        * * Field Name: ServerDriverClass
        * * Display Name: Server Driver Class
        * * SQL Data Type: nvarchar(255)`),
    UIDriverClass: z.string().nullable().describe(`
        * * Field Name: UIDriverClass
        * * Display Name: UI Driver Class
        * * SQL Data Type: nvarchar(255)`),
    SpaceExtensionEntity: z.string().nullable().describe(`
        * * Field Name: SpaceExtensionEntity
        * * Display Name: Space Extension Entity
        * * SQL Data Type: nvarchar(255)`),
    Configuration: z.any().nullable().describe(`
        * * Field Name: Configuration
        * * Display Name: Configuration
        * * SQL Data Type: nvarchar(MAX)
        * * JSON Type: mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings`),
});

export type mjBizAppsCollaborationSpaceTypeEntityType = z.infer<typeof mjBizAppsCollaborationSpaceTypeSchema>;

/**
 * zod schema definition for the entity MJ_BizApps_Collaboration: Spaces
 */
export const mjBizAppsCollaborationSpaceSchema = z.object({
    ID: z.string().describe(`
        * * Field Name: ID
        * * Display Name: ID
        * * SQL Data Type: uniqueidentifier
        * * Default Value: newsequentialid()`),
    SpaceTypeID: z.string().describe(`
        * * Field Name: SpaceTypeID
        * * Display Name: Space Type ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Types (vwSpaceTypes.ID)`),
    ParentID: z.string().nullable().describe(`
        * * Field Name: ParentID
        * * Display Name: Parent ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
        * * Description: Parent space. Null on a root. It does not carry the IsHierarchy flag, so CodeGen emits no path columns.`),
    Name: z.string().describe(`
        * * Field Name: Name
        * * Display Name: Name
        * * SQL Data Type: nvarchar(200)
        * * Description: Designated name of the space.`),
    Description: z.string().nullable().describe(`
        * * Field Name: Description
        * * Display Name: Description
        * * SQL Data Type: nvarchar(MAX)`),
    OwnerID: z.string().describe(`
        * * Field Name: OwnerID
        * * Display Name: Owner ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
        * * Description: MJ user who owns the space.`),
    InheritsMembership: z.boolean().describe(`
        * * Field Name: InheritsMembership
        * * Display Name: Inherits Membership
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: 1: members of this space are members of its descendants. 0: this sub-space keeps its own roster.`),
    AgentRetrieval: z.union([z.literal('ExcludedEntirely'), z.literal('ExcludedFromParentScope'), z.literal('Included')]).describe(`
        * * Field Name: AgentRetrieval
        * * Display Name: Agent Retrieval
        * * SQL Data Type: nvarchar(30)
        * * Default Value: Included
    * * Value List Type: List
    * * Possible Values 
    *   * ExcludedEntirely
    *   * ExcludedFromParentScope
    *   * Included
        * * Description: Included, ExcludedFromParentScope, or ExcludedEntirely. A human may read a space that no agent may quote.`),
    StartedAt: z.date().nullable().describe(`
        * * Field Name: StartedAt
        * * Display Name: Started At
        * * SQL Data Type: datetimeoffset
        * * Description: When this space (usually a sub-space) started. The root outlives its children.`),
    ClosedAt: z.date().nullable().describe(`
        * * Field Name: ClosedAt
        * * Display Name: Closed At
        * * SQL Data Type: datetimeoffset
        * * Description: When this space closed. Closure is a timestamp on the sub-space, not a delete of the root.`),
    __mj_CreatedAt: z.date().describe(`
        * * Field Name: __mj_CreatedAt
        * * Display Name: Created At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    __mj_UpdatedAt: z.date().describe(`
        * * Field Name: __mj_UpdatedAt
        * * Display Name: Updated At
        * * SQL Data Type: datetimeoffset
        * * Default Value: getutcdate()`),
    AllowParentAssignees: z.boolean().describe(`
        * * Field Name: AllowParentAssignees
        * * Display Name: Allow Parent Assignees
        * * SQL Data Type: bit
        * * Default Value: 1
        * * Description: 1 if participants in this space may assign people seated on ancestor spaces whose membership reaches this space; 0 to restrict assignment to seats in this space or below. Only staff may change this switch.`),
    PlannedCloseAt: z.date().nullable().describe(`
        * * Field Name: PlannedCloseAt
        * * Display Name: Planned Close At
        * * SQL Data Type: datetimeoffset
        * * Description: Target or planned close date/time for the space. Actual closure is recorded in ClosedAt.`),
    IconClass: z.string().nullable().describe(`
        * * Field Name: IconClass
        * * Display Name: Icon Class
        * * SQL Data Type: nvarchar(100)
        * * Description: Font Awesome icon class representing the space (e.g., fa-solid fa-folder-tree, fa-solid fa-briefcase). Overrides SpaceType.IconClass if set.`),
    Color: z.string().nullable().describe(`
        * * Field Name: Color
        * * Display Name: Color
        * * SQL Data Type: nvarchar(50)
        * * Description: Hex color code representing the space (e.g., #0076b6, #10b981). Overrides SpaceType.Color if set.`),
    BackgroundImageURL: z.string().nullable().describe(`
        * * Field Name: BackgroundImageURL
        * * Display Name: Background Image URL
        * * SQL Data Type: nvarchar(1000)
        * * Description: URL of an optional hero banner or background image displayed in the space header and overview.`),
    Configuration: z.any().nullable().describe(`
        * * Field Name: Configuration
        * * Display Name: Configuration
        * * SQL Data Type: nvarchar(MAX)
        * * JSON Type: mjBizAppsCollaborationSpaceEntity_CollaborationSettings`),
    StatusID: z.string().nullable().describe(`
        * * Field Name: StatusID
        * * Display Name: Status ID
        * * SQL Data Type: uniqueidentifier
        * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Type Status (vwSpaceTypeStatus.ID)
        * * Description: The status the space is in, one of its type's (SpaceTypeStatus). NULL until the server stamps it: then the type's default while ClosedAt is null, and the type's first terminal status once ClosedAt is set, as fnCollaborationSpaceStatuses derives it.`),
    SpaceType: z.string().describe(`
        * * Field Name: SpaceType
        * * Display Name: Space Type
        * * SQL Data Type: nvarchar(200)`),
    Parent: z.string().nullable().describe(`
        * * Field Name: Parent
        * * Display Name: Parent
        * * SQL Data Type: nvarchar(200)`),
    Owner: z.string().describe(`
        * * Field Name: Owner
        * * Display Name: Owner
        * * SQL Data Type: nvarchar(100)`),
    Status: z.string().nullable().describe(`
        * * Field Name: Status
        * * Display Name: Status
        * * SQL Data Type: nvarchar(100)`),
});

export type mjBizAppsCollaborationSpaceEntityType = z.infer<typeof mjBizAppsCollaborationSpaceSchema>;
 
 

/**
 * MJ_BizApps_Collaboration: Item Uses - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: ItemUse
 * * Base View: vwItemUses
 * * @description A record that a member opened, uploaded, or promoted an item.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Item Uses')
export class mjBizAppsCollaborationItemUseEntity extends BaseEntity<mjBizAppsCollaborationItemUseEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Item Uses record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Item Uses record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationItemUseEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: ItemID
    * * Display Name: Item ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Items (vwSpaceItems.ID)
    * * Description: The space item that was used.
    */
    get ItemID(): string {
        return this.Get('ItemID');
    }
    set ItemID(value: string) {
        this.Set('ItemID', value);
    }

    /**
    * * Field Name: UserID
    * * Display Name: User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: The member who opened, uploaded, or promoted the item.
    */
    get UserID(): string {
        return this.Get('UserID');
    }
    set UserID(value: string) {
        this.Set('UserID', value);
    }

    /**
    * * Field Name: UsedAt
    * * Display Name: Used At
    * * SQL Data Type: datetimeoffset
    * * Description: When the use happened.
    */
    get UsedAt(): Date {
        return this.Get('UsedAt');
    }
    set UsedAt(value: Date) {
        this.Set('UsedAt', value);
    }

    /**
    * * Field Name: Kind
    * * Display Name: Kind
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * open
    *   * promote
    *   * upload
    * * Description: open, upload, or promote.
    */
    get Kind(): 'open' | 'promote' | 'upload' {
        return this.Get('Kind');
    }
    set Kind(value: 'open' | 'promote' | 'upload') {
        this.Set('Kind', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: The space the use happened in. Required so the read filter can keep the row inside spaces the caller reaches.
    */
    get SpaceID(): string {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: User
    * * Display Name: User
    * * SQL Data Type: nvarchar(100)
    */
    get User(): string {
        return this.Get('User');
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string {
        return this.Get('Space');
    }
}


/**
 * MJ_BizApps_Collaboration: Share Notices - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: ShareNotice
 * * Base View: vwShareNotices
 * * @description A notice that an item in this space was shared with a member.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Share Notices')
export class mjBizAppsCollaborationShareNoticeEntity extends BaseEntity<mjBizAppsCollaborationShareNoticeEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Share Notices record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Share Notices record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationShareNoticeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: The space the notice belongs to. The read filter keeps a caller inside spaces they reach.
    */
    get SpaceID(): string {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: ItemID
    * * Display Name: Item ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Items (vwSpaceItems.ID)
    * * Description: The space item that was shared.
    */
    get ItemID(): string {
        return this.Get('ItemID');
    }
    set ItemID(value: string) {
        this.Set('ItemID', value);
    }

    /**
    * * Field Name: RecipientUserID
    * * Display Name: Recipient User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: The member the notice is for.
    */
    get RecipientUserID(): string {
        return this.Get('RecipientUserID');
    }
    set RecipientUserID(value: string) {
        this.Set('RecipientUserID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string {
        return this.Get('Space');
    }

    /**
    * * Field Name: RecipientUser
    * * Display Name: Recipient User
    * * SQL Data Type: nvarchar(100)
    */
    get RecipientUser(): string {
        return this.Get('RecipientUser');
    }
}


/**
 * MJ_BizApps_Collaboration: Space Anchors - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceAnchor
 * * Base View: vwSpaceAnchors
 * * @description A record a space is about (D26: a space may have several). The primary anchor is the one EnsureSpaceForRecord finds a space by; one per space, and one space per (type, record) as primary.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Anchors')
export class mjBizAppsCollaborationSpaceAnchorEntity extends BaseEntity<mjBizAppsCollaborationSpaceAnchorEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Anchors record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Anchors record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceAnchorEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: The space.
    */
    get SpaceID(): string {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: SpaceTypeID
    * * Display Name: Space Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Types (vwSpaceTypes.ID)
    * * Description: The space's type, denormalized so the primary-per-type index can hold; the server keeps it equal to the space's and rewrites it when the type changes.
    */
    get SpaceTypeID(): string {
        return this.Get('SpaceTypeID');
    }
    set SpaceTypeID(value: string) {
        this.Set('SpaceTypeID', value);
    }

    /**
    * * Field Name: EntityID
    * * Display Name: Entity ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
    * * Description: The entity of the anchored record.
    */
    get EntityID(): string {
        return this.Get('EntityID');
    }
    set EntityID(value: string) {
        this.Set('EntityID', value);
    }

    /**
    * * Field Name: RecordID
    * * Display Name: Record ID
    * * SQL Data Type: nvarchar(450)
    * * Description: The record's key, in the canonical shape SpaceItem.RecordID uses.
    */
    get RecordID(): string {
        return this.Get('RecordID');
    }
    set RecordID(value: string) {
        this.Set('RecordID', value);
    }

    /**
    * * Field Name: Role
    * * Display Name: Role
    * * SQL Data Type: nvarchar(100)
    * * Description: What the record is to the space, in the type's vocabulary: chapter, sponsor, event. Data reach (D28) names an anchor by this role.
    */
    get Role(): string {
        return this.Get('Role');
    }
    set Role(value: string) {
        this.Set('Role', value);
    }

    /**
    * * Field Name: IsPrimary
    * * Display Name: Is Primary
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: The one anchor a space is found by. At most one per space.
    */
    get IsPrimary(): boolean {
        return this.Get('IsPrimary');
    }
    set IsPrimary(value: boolean) {
        this.Set('IsPrimary', value);
    }

    /**
    * * Field Name: Sequence
    * * Display Name: Sequence
    * * SQL Data Type: int
    * * Default Value: 0
    * * Description: Display order among the space's anchors.
    */
    get Sequence(): number {
        return this.Get('Sequence');
    }
    set Sequence(value: number) {
        this.Set('Sequence', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string {
        return this.Get('Space');
    }

    /**
    * * Field Name: SpaceType
    * * Display Name: Space Type
    * * SQL Data Type: nvarchar(200)
    */
    get SpaceType(): string {
        return this.Get('SpaceType');
    }

    /**
    * * Field Name: Entity
    * * Display Name: Entity
    * * SQL Data Type: nvarchar(255)
    */
    get Entity(): string {
        return this.Get('Entity');
    }
}


/**
 * MJ_BizApps_Collaboration: Space Chats - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceChat
 * * Base View: vwSpaceChats
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Chats')
export class mjBizAppsCollaborationSpaceChatEntity extends BaseEntity<mjBizAppsCollaborationSpaceChatEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Chats record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Chats record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceChatEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    */
    get SpaceID(): string {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: ConversationID
    * * Display Name: Conversation ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Conversations (vwConversations.ID)
    */
    get ConversationID(): string {
        return this.Get('ConversationID');
    }
    set ConversationID(value: string) {
        this.Set('ConversationID', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(255)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Subject
    * * Display Name: Subject
    * * SQL Data Type: nvarchar(500)
    */
    get Subject(): string | null {
        return this.Get('Subject');
    }
    set Subject(value: string | null) {
        this.Set('Subject', value);
    }

    /**
    * * Field Name: Kind
    * * Display Name: Kind
    * * SQL Data Type: nvarchar(50)
    * * Default Value: General
    * * Value List Type: List
    * * Possible Values 
    *   * General
    *   * Private
    *   * Topic
    */
    get Kind(): 'General' | 'Private' | 'Topic' {
        return this.Get('Kind');
    }
    set Kind(value: 'General' | 'Private' | 'Topic') {
        this.Set('Kind', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(50)
    * * Default Value: Active
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Archived
    */
    get Status(): 'Active' | 'Archived' {
        return this.Get('Status');
    }
    set Status(value: 'Active' | 'Archived') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: ArchivedOnSpaceClose
    * * Display Name: Archived On Space Close
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Indicates whether this space chat conversation was archived when its space was closed so it can be restored on reopen.
    */
    get ArchivedOnSpaceClose(): boolean {
        return this.Get('ArchivedOnSpaceClose');
    }
    set ArchivedOnSpaceClose(value: boolean) {
        this.Set('ArchivedOnSpaceClose', value);
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string {
        return this.Get('Space');
    }

    /**
    * * Field Name: Conversation
    * * Display Name: Conversation
    * * SQL Data Type: nvarchar(255)
    */
    get Conversation(): string | null {
        return this.Get('Conversation');
    }
}


/**
 * A space grant's bindings (MJ_BizApps_Collaboration: Space Grants.Bindings): the target's parameter or property names mapped
 * to where each value comes from (D27). The source of truth is packages/Core/src/grants.ts; this copy is what CodeGen reads.
 */

/** Where a bound value comes from (D27). A literal is a `Value`; anything else is resolved on the server. */
export type mjBizAppsCollaborationSpaceGrantEntity_BindingExpression =
    | { From: `Anchor:${string}` | `Space.${string}` | `Config:${string}` | 'User.ID' | 'User.Email' | 'User.PersonID' }
    | { Value: string | number | boolean };

/** A grant's bindings: a parameter or property name of the target, mapped to where its value comes from. */
export type mjBizAppsCollaborationSpaceGrantEntity_SpaceGrantBindings = Record<string, mjBizAppsCollaborationSpaceGrantEntity_BindingExpression>;

/**
 * An agent grant's settings (MJ_BizApps_Collaboration: Space Grants.Settings): each may only narrow the agent's own definition
 * (D31, item 148). The source of truth is packages/Core/src/grants.ts; this copy is what CodeGen reads.
 */

/** An agent grant's settings (D31). Each can only narrow what the agent's own definition allows (item 148). */
export interface mjBizAppsCollaborationSpaceGrantEntity_AgentGrantSettings {
    /** The skills this space's chats may use: none, or skills the agent accepts. Absent means the agent's own. */
    Skills?: 'None' | string[];
    /** Off, allowed or required; only where the agent sets SupportsPlanMode. */
    PlanMode?: 'Off' | 'Allowed' | 'Required';
    EffortLevel?: number;
    /** Whether the agent may write memory notes in this space. */
    MemoryWrites?: boolean;
    /** Per-run limits, each at most the agent's own, named as MJ's agent columns are. */
    Limits?: Partial<Record<mjBizAppsCollaborationSpaceGrantEntity_AgentLimitName, number>>;
}

export const AGENT_LIMIT_NAMES = ['MaxCostPerRun', 'MaxTokensPerRun', 'MaxIterationsPerRun', 'MaxTimePerRun'] as const;
export type mjBizAppsCollaborationSpaceGrantEntity_AgentLimitName = (typeof AGENT_LIMIT_NAMES)[number];

/**
 * MJ_BizApps_Collaboration: Space Grants - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceGrant
 * * Base View: vwSpaceGrants
 * * @description Something the app, a space type or a space offers in its spaces (D27's seven kinds): an agent, an action, a query, a view, a dashboard, a component or a knowledge source, with the band that may use it, bindings from the space to the target's parameters, and an agent's narrowed settings. Replaces SpaceAgent, SpaceAgentSkill and SpaceKnowledgeSource.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Grants')
export class mjBizAppsCollaborationSpaceGrantEntity extends BaseEntity<mjBizAppsCollaborationSpaceGrantEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Grants record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Grants record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceGrantEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceTypeID
    * * Display Name: Space Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Types (vwSpaceTypes.ID)
    * * Description: The type the grant belongs to; null with SpaceID null is the app's own row.
    */
    get SpaceTypeID(): string | null {
        return this.Get('SpaceTypeID');
    }
    set SpaceTypeID(value: string | null) {
        this.Set('SpaceTypeID', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: The space the grant belongs to; never set together with SpaceTypeID.
    */
    get SpaceID(): string | null {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string | null) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: Kind
    * * Display Name: Kind
    * * SQL Data Type: nvarchar(30)
    * * Value List Type: List
    * * Possible Values 
    *   * Action
    *   * Agent
    *   * Component
    *   * Dashboard
    *   * KnowledgeSource
    *   * Query
    *   * View
    * * Description: Agent, Action, Query, View, Dashboard, Component or KnowledgeSource. TargetEntityID must be the kind's entity.
    */
    get Kind(): 'Action' | 'Agent' | 'Component' | 'Dashboard' | 'KnowledgeSource' | 'Query' | 'View' {
        return this.Get('Kind');
    }
    set Kind(value: 'Action' | 'Agent' | 'Component' | 'Dashboard' | 'KnowledgeSource' | 'Query' | 'View') {
        this.Set('Kind', value);
    }

    /**
    * * Field Name: TargetEntityID
    * * Display Name: Target Entity ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
    * * Description: The target's entity: MJ: AI Agents, MJ: Actions, MJ: Queries, MJ: User Views, MJ: Dashboards, MJ: Components or MJ: Content Sources, by Kind.
    */
    get TargetEntityID(): string {
        return this.Get('TargetEntityID');
    }
    set TargetEntityID(value: string) {
        this.Set('TargetEntityID', value);
    }

    /**
    * * Field Name: TargetRecordID
    * * Display Name: Target Record ID
    * * SQL Data Type: nvarchar(450)
    * * Description: The target record's key.
    */
    get TargetRecordID(): string {
        return this.Get('TargetRecordID');
    }
    set TargetRecordID(value: string) {
        this.Set('TargetRecordID', value);
    }

    /**
    * * Field Name: Label
    * * Display Name: Label
    * * SQL Data Type: nvarchar(200)
    * * Description: What the space calls the target; null uses the target's own name.
    */
    get Label(): string | null {
        return this.Get('Label');
    }
    set Label(value: string | null) {
        this.Set('Label', value);
    }

    /**
    * * Field Name: Band
    * * Display Name: Band
    * * SQL Data Type: nvarchar(10)
    * * Default Value: Shared
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
    * * Description: The band that may use the grant (D31). A Team grant is not offered in a chat where anyone cannot see Team.
    */
    get Band(): 'Shared' | 'Team' {
        return this.Get('Band');
    }
    set Band(value: 'Shared' | 'Team') {
        this.Set('Band', value);
    }

    /**
    * * Field Name: IsDefault
    * * Display Name: Is Default
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: For an Agent grant: the agent a chat at this level starts with. One per level.
    */
    get IsDefault(): boolean {
        return this.Get('IsDefault');
    }
    set IsDefault(value: boolean) {
        this.Set('IsDefault', value);
    }

    /**
    * * Field Name: Bindings
    * * Display Name: Bindings
    * * SQL Data Type: nvarchar(MAX)
    * * JSON Type: mjBizAppsCollaborationSpaceGrantEntity_SpaceGrantBindings
    * * Description: JSON (SpaceGrantBindings): the target's parameter or property names mapped to where each value comes from: an anchor by role, a column of the space, a configuration key, the user, or a literal (D27).
    */
    get Bindings(): string | null {
        return this.Get('Bindings');
    }
    set Bindings(value: string | null) {
        this.Set('Bindings', value);
    }

    private _BindingsObject_cached: mjBizAppsCollaborationSpaceGrantEntity_SpaceGrantBindings | null | undefined = undefined;
    private _BindingsObject_lastRaw: string | null = null;
    /**
    * Typed accessor for Bindings — returns parsed JSON as mjBizAppsCollaborationSpaceGrantEntity_SpaceGrantBindings.
    * Uses lazy parsing with cache invalidation when the underlying raw value changes.
    */
    get BindingsObject(): mjBizAppsCollaborationSpaceGrantEntity_SpaceGrantBindings | null {
        const raw = this.Bindings;
        if (raw !== this._BindingsObject_lastRaw) {
            this._BindingsObject_cached = raw ? JSON.parse(raw) : null;
            this._BindingsObject_lastRaw = raw;
        }
        return this._BindingsObject_cached!;
    }
    set BindingsObject(value: mjBizAppsCollaborationSpaceGrantEntity_SpaceGrantBindings | null) {
        const raw = value ? JSON.stringify(value) : null;
        this.Bindings = raw;
        this._BindingsObject_cached = value;
        this._BindingsObject_lastRaw = raw;
    }

    /**
    * * Field Name: Settings
    * * Display Name: Settings
    * * SQL Data Type: nvarchar(MAX)
    * * JSON Type: mjBizAppsCollaborationSpaceGrantEntity_AgentGrantSettings
    * * Description: JSON (AgentGrantSettings) for an Agent grant: skills, plan mode, effort, memory writes and per-run limits, each only narrowing the agent's own definition (D31). Null for the other kinds.
    */
    get Settings(): string | null {
        return this.Get('Settings');
    }
    set Settings(value: string | null) {
        this.Set('Settings', value);
    }

    private _SettingsObject_cached: mjBizAppsCollaborationSpaceGrantEntity_AgentGrantSettings | null | undefined = undefined;
    private _SettingsObject_lastRaw: string | null = null;
    /**
    * Typed accessor for Settings — returns parsed JSON as mjBizAppsCollaborationSpaceGrantEntity_AgentGrantSettings.
    * Uses lazy parsing with cache invalidation when the underlying raw value changes.
    */
    get SettingsObject(): mjBizAppsCollaborationSpaceGrantEntity_AgentGrantSettings | null {
        const raw = this.Settings;
        if (raw !== this._SettingsObject_lastRaw) {
            this._SettingsObject_cached = raw ? JSON.parse(raw) : null;
            this._SettingsObject_lastRaw = raw;
        }
        return this._SettingsObject_cached!;
    }
    set SettingsObject(value: mjBizAppsCollaborationSpaceGrantEntity_AgentGrantSettings | null) {
        const raw = value ? JSON.stringify(value) : null;
        this.Settings = raw;
        this._SettingsObject_cached = value;
        this._SettingsObject_lastRaw = raw;
    }

    /**
    * * Field Name: Mode
    * * Display Name: Mode
    * * SQL Data Type: nvarchar(10)
    * * Default Value: Extend
    * * Value List Type: List
    * * Possible Values 
    *   * Extend
    *   * Remove
    * * Description: Extend adds the target at this level; Remove takes a target granted above out of this level's list (D30).
    */
    get Mode(): 'Extend' | 'Remove' {
        return this.Get('Mode');
    }
    set Mode(value: 'Extend' | 'Remove') {
        this.Set('Mode', value);
    }

    /**
    * * Field Name: Sequence
    * * Display Name: Sequence
    * * SQL Data Type: int
    * * Default Value: 0
    * * Description: Display order within the level.
    */
    get Sequence(): number {
        return this.Get('Sequence');
    }
    set Sequence(value: number) {
        this.Set('Sequence', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: SpaceType
    * * Display Name: Space Type
    * * SQL Data Type: nvarchar(200)
    */
    get SpaceType(): string | null {
        return this.Get('SpaceType');
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string | null {
        return this.Get('Space');
    }

    /**
    * * Field Name: TargetEntity
    * * Display Name: Target Entity
    * * SQL Data Type: nvarchar(255)
    */
    get TargetEntity(): string {
        return this.Get('TargetEntity');
    }
}


/**
 * MJ_BizApps_Collaboration: Space Items - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceItem
 * * Base View: vwSpaceItems
 * * @description An item in exactly one space: EntityID + RecordID, plus Team or Shared. Unique on (EntityID, RecordID) so an item cannot have two parents.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Items')
export class mjBizAppsCollaborationSpaceItemEntity extends BaseEntity<mjBizAppsCollaborationSpaceItemEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Items record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Items record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceItemEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    */
    get SpaceID(): string {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: EntityID
    * * Display Name: Entity ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
    * * Description: The entity the item points at. Same polymorphic pair TaskLink uses.
    */
    get EntityID(): string {
        return this.Get('EntityID');
    }
    set EntityID(value: string) {
        this.Set('EntityID', value);
    }

    /**
    * * Field Name: RecordID
    * * Display Name: Record ID
    * * SQL Data Type: nvarchar(450)
    * * Description: Primary key of the pointed-at record, as text, matching TaskLink.RecordID.
    */
    get RecordID(): string {
        return this.Get('RecordID');
    }
    set RecordID(value: string) {
        this.Set('RecordID', value);
    }

    /**
    * * Field Name: Band
    * * Display Name: Band
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
    * * Description: Team (working material, not in the client-facing agent scope) or Shared (promoted, with an actor and a timestamp).
    */
    get Band(): 'Shared' | 'Team' {
        return this.Get('Band');
    }
    set Band(value: 'Shared' | 'Team') {
        this.Set('Band', value);
    }

    /**
    * * Field Name: PromotedAt
    * * Display Name: Promoted At
    * * SQL Data Type: datetimeoffset
    * * Description: When a Shared item was promoted. Null on Team items.
    */
    get PromotedAt(): Date | null {
        return this.Get('PromotedAt');
    }
    set PromotedAt(value: Date | null) {
        this.Set('PromotedAt', value);
    }

    /**
    * * Field Name: PromotedByUserID
    * * Display Name: Promoted By User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: MJ user who promoted a Shared item. Required together with PromotedAt. Null on Team items.
    */
    get PromotedByUserID(): string | null {
        return this.Get('PromotedByUserID');
    }
    set PromotedByUserID(value: string | null) {
        this.Set('PromotedByUserID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Folder
    * * Display Name: Folder
    * * SQL Data Type: nvarchar(200)
    * * Description: Folder label inside the space. Null means Unfiled. Collections cannot say everyone in the space, so the folder lives on the item.
    */
    get Folder(): string | null {
        return this.Get('Folder');
    }
    set Folder(value: string | null) {
        this.Set('Folder', value);
    }

    /**
    * * Field Name: ArtifactVersionID
    * * Display Name: Artifact Version ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Artifact Versions (vwArtifactVersions.ID)
    * * Description: For a document in the Library: the MJ Artifact Version (ContentMode File) wrapping the MJ: Files row the item points at, so the document has a type, a viewer and versions. NULL for items that are not files. Artifact Permissions are not used by the Library; the roster is the one sharing model.
    */
    get ArtifactVersionID(): string | null {
        return this.Get('ArtifactVersionID');
    }
    set ArtifactVersionID(value: string | null) {
        this.Set('ArtifactVersionID', value);
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string {
        return this.Get('Space');
    }

    /**
    * * Field Name: Entity
    * * Display Name: Entity
    * * SQL Data Type: nvarchar(255)
    */
    get Entity(): string {
        return this.Get('Entity');
    }

    /**
    * * Field Name: PromotedByUser
    * * Display Name: Promoted By User
    * * SQL Data Type: nvarchar(100)
    */
    get PromotedByUser(): string | null {
        return this.Get('PromotedByUser');
    }

    /**
    * * Field Name: ArtifactVersion
    * * Display Name: Artifact Version
    * * SQL Data Type: nvarchar(255)
    */
    get ArtifactVersion(): string | null {
        return this.Get('ArtifactVersion');
    }
}


/**
 * MJ_BizApps_Collaboration: Space Member Pins - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceMemberPin
 * * Base View: vwSpaceMemberPins
 * * @description Something a member keeps at the top of a space (B22): a record of the space (an item, a note, a task) or one of the space's grants (a view, a dashboard, a component). The member's own; Home lists pins from the spaces they still reach.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Member Pins')
export class mjBizAppsCollaborationSpaceMemberPinEntity extends BaseEntity<mjBizAppsCollaborationSpaceMemberPinEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Member Pins record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Member Pins record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceMemberPinEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: The space the pin is in.
    */
    get SpaceID(): string {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: UserID
    * * Display Name: User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: Whose pin it is: the caller.
    */
    get UserID(): string {
        return this.Get('UserID');
    }
    set UserID(value: string) {
        this.Set('UserID', value);
    }

    /**
    * * Field Name: Kind
    * * Display Name: Kind
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Grant
    *   * Record
    * * Description: Record: a record of the space by entity and key. Grant: one of the space's grants.
    */
    get Kind(): 'Grant' | 'Record' {
        return this.Get('Kind');
    }
    set Kind(value: 'Grant' | 'Record') {
        this.Set('Kind', value);
    }

    /**
    * * Field Name: TargetEntityID
    * * Display Name: Target Entity ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Entities (vwEntities.ID)
    * * Description: For a Record pin: the record's entity.
    */
    get TargetEntityID(): string | null {
        return this.Get('TargetEntityID');
    }
    set TargetEntityID(value: string | null) {
        this.Set('TargetEntityID', value);
    }

    /**
    * * Field Name: TargetRecordID
    * * Display Name: Target Record ID
    * * SQL Data Type: nvarchar(450)
    * * Description: For a Record pin: the record's key.
    */
    get TargetRecordID(): string | null {
        return this.Get('TargetRecordID');
    }
    set TargetRecordID(value: string | null) {
        this.Set('TargetRecordID', value);
    }

    /**
    * * Field Name: GrantID
    * * Display Name: Grant ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Grants (vwSpaceGrants.ID)
    * * Description: For a Grant pin: the grant in force for the member's space and band.
    */
    get GrantID(): string | null {
        return this.Get('GrantID');
    }
    set GrantID(value: string | null) {
        this.Set('GrantID', value);
    }

    /**
    * * Field Name: Sequence
    * * Display Name: Sequence
    * * SQL Data Type: int
    * * Default Value: 0
    * * Description: The member's order of pins.
    */
    get Sequence(): number {
        return this.Get('Sequence');
    }
    set Sequence(value: number) {
        this.Set('Sequence', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string {
        return this.Get('Space');
    }

    /**
    * * Field Name: User
    * * Display Name: User
    * * SQL Data Type: nvarchar(100)
    */
    get User(): string {
        return this.Get('User');
    }

    /**
    * * Field Name: TargetEntity
    * * Display Name: Target Entity
    * * SQL Data Type: nvarchar(255)
    */
    get TargetEntity(): string | null {
        return this.Get('TargetEntity');
    }
}


/**
 * MJ_BizApps_Collaboration: Space Members - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceMember
 * * Base View: vwSpaceMembers
 * * @description One roster row per user per space. Staff and outsiders are both MJ users. Status Active is the row the membership filter accepts.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Members')
export class mjBizAppsCollaborationSpaceMemberEntity extends BaseEntity<mjBizAppsCollaborationSpaceMemberEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Members record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Members record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceMemberEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    */
    get SpaceID(): string {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: UserID
    * * Display Name: User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    */
    get UserID(): string {
        return this.Get('UserID');
    }
    set UserID(value: string) {
        this.Set('UserID', value);
    }

    /**
    * * Field Name: SpaceRoleTypeID
    * * Display Name: Space Role Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Role Types (vwSpaceRoleTypes.ID)
    */
    get SpaceRoleTypeID(): string {
        return this.Get('SpaceRoleTypeID');
    }
    set SpaceRoleTypeID(value: string) {
        this.Set('SpaceRoleTypeID', value);
    }

    /**
    * * Field Name: Band
    * * Display Name: Band
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
    * * Description: Team or Shared. Set by the server from the role: CanSeeTeamBand seats the person on Team, otherwise Shared. The filter reads the role, not this column.
    */
    get Band(): 'Shared' | 'Team' {
        return this.Get('Band');
    }
    set Band(value: 'Shared' | 'Team') {
        this.Set('Band', value);
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Invited
    * * Value List Type: List
    * * Possible Values 
    *   * Active
    *   * Invited
    *   * Removed
    * * Description: Invited, Active, or Removed. New rows start Invited unless the type auto-approves.
    */
    get Status(): 'Active' | 'Invited' | 'Removed' {
        return this.Get('Status');
    }
    set Status(value: 'Active' | 'Invited' | 'Removed') {
        this.Set('Status', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: SyncSource
    * * Display Name: Sync Source
    * * SQL Data Type: nvarchar(100)
    */
    get SyncSource(): string | null {
        return this.Get('SyncSource');
    }
    set SyncSource(value: string | null) {
        this.Set('SyncSource', value);
    }

    /**
    * * Field Name: PersonID
    * * Display Name: Person ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Common: People (vwPeople.ID)
    */
    get PersonID(): string | null {
        return this.Get('PersonID');
    }
    set PersonID(value: string | null) {
        this.Set('PersonID', value);
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string {
        return this.Get('Space');
    }

    /**
    * * Field Name: User
    * * Display Name: User
    * * SQL Data Type: nvarchar(100)
    */
    get User(): string {
        return this.Get('User');
    }

    /**
    * * Field Name: SpaceRoleType
    * * Display Name: Space Role Type
    * * SQL Data Type: nvarchar(200)
    */
    get SpaceRoleType(): string {
        return this.Get('SpaceRoleType');
    }

    /**
    * * Field Name: Person
    * * Display Name: Person
    * * SQL Data Type: nvarchar(201)
    */
    get Person(): string | null {
        return this.Get('Person');
    }
}


/**
 * MJ_BizApps_Collaboration: Space Notes - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceNote
 * * Base View: vwSpaceNotes
 * * @description A light note in a space (B21): the space's own row on a band, not a library item, so the move-and-promote rules do not apply and it needs no ItemUse. Private notes are the author's alone.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Notes')
export class mjBizAppsCollaborationSpaceNoteEntity extends BaseEntity<mjBizAppsCollaborationSpaceNoteEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Notes record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Notes record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceNoteEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceID
    * * Display Name: Space ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: The space the note belongs to.
    */
    get SpaceID(): string {
        return this.Get('SpaceID');
    }
    set SpaceID(value: string) {
        this.Set('SpaceID', value);
    }

    /**
    * * Field Name: Title
    * * Display Name: Title
    * * SQL Data Type: nvarchar(200)
    * * Description: The note's title.
    */
    get Title(): string {
        return this.Get('Title');
    }
    set Title(value: string) {
        this.Set('Title', value);
    }

    /**
    * * Field Name: Body
    * * Display Name: Body
    * * SQL Data Type: nvarchar(MAX)
    * * Description: The note's body, Markdown.
    */
    get Body(): string | null {
        return this.Get('Body');
    }
    set Body(value: string | null) {
        this.Set('Body', value);
    }

    /**
    * * Field Name: Band
    * * Display Name: Band
    * * SQL Data Type: nvarchar(10)
    * * Default Value: Team
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
    * * Description: Team or Shared: who in the space may read it. A Team note moves to Shared only when the plan's call 15 allows it.
    */
    get Band(): 'Shared' | 'Team' {
        return this.Get('Band');
    }
    set Band(value: 'Shared' | 'Team') {
        this.Set('Band', value);
    }

    /**
    * * Field Name: Visibility
    * * Display Name: Visibility
    * * SQL Data Type: nvarchar(10)
    * * Default Value: Space
    * * Value List Type: List
    * * Possible Values 
    *   * Private
    *   * Space
    * * Description: Space: the band reads it. Private: the author alone, and then the band is Team.
    */
    get Visibility(): 'Private' | 'Space' {
        return this.Get('Visibility');
    }
    set Visibility(value: 'Private' | 'Space') {
        this.Set('Visibility', value);
    }

    /**
    * * Field Name: AuthorUserID
    * * Display Name: Author User ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: Who wrote the note: the caller on create, and the only one who edits or deletes it.
    */
    get AuthorUserID(): string {
        return this.Get('AuthorUserID');
    }
    set AuthorUserID(value: string) {
        this.Set('AuthorUserID', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: Space
    * * Display Name: Space
    * * SQL Data Type: nvarchar(200)
    */
    get Space(): string {
        return this.Get('Space');
    }

    /**
    * * Field Name: AuthorUser
    * * Display Name: Author User
    * * SQL Data Type: nvarchar(100)
    */
    get AuthorUser(): string {
        return this.Get('AuthorUser');
    }
}


/**
 * MJ_BizApps_Collaboration: Space Role Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceRoleType
 * * Base View: vwSpaceRoleTypes
 * * @description What a space member is allowed to do. The engine reads Level and the BIT flags. It never compares Code or Name.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Role Types')
export class mjBizAppsCollaborationSpaceRoleTypeEntity extends BaseEntity<mjBizAppsCollaborationSpaceRoleTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Role Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Role Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceRoleTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: Level
    * * Display Name: Level
    * * SQL Data Type: int
    * * Description: This role's own authority. A grant must be of a role whose Level is <= the grantor's MaxGrantableLevel.
    */
    get Level(): number {
        return this.Get('Level');
    }
    set Level(value: number) {
        this.Set('Level', value);
    }

    /**
    * * Field Name: MaxGrantableLevel
    * * Display Name: Max Grantable Level
    * * SQL Data Type: int
    * * Description: Highest Level this role may grant. Always <= Level.
    */
    get MaxGrantableLevel(): number {
        return this.Get('MaxGrantableLevel');
    }
    set MaxGrantableLevel(value: number) {
        this.Set('MaxGrantableLevel', value);
    }

    /**
    * * Field Name: CanInvite
    * * Display Name: Can Invite
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Holder may invite members into a space they belong to, inside their own subtree, at or below MaxGrantableLevel.
    */
    get CanInvite(): boolean {
        return this.Get('CanInvite');
    }
    set CanInvite(value: boolean) {
        this.Set('CanInvite', value);
    }

    /**
    * * Field Name: CanPromoteBand
    * * Display Name: Can Promote Band
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Holder may move an item from Team to Shared.
    */
    get CanPromoteBand(): boolean {
        return this.Get('CanPromoteBand');
    }
    set CanPromoteBand(value: boolean) {
        this.Set('CanPromoteBand', value);
    }

    /**
    * * Field Name: CanSeeTeamBand
    * * Display Name: Can See Team Band
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Holder may read Team-band items. Shared-band items do not need this flag.
    */
    get CanSeeTeamBand(): boolean {
        return this.Get('CanSeeTeamBand');
    }
    set CanSeeTeamBand(value: boolean) {
        this.Set('CanSeeTeamBand', value);
    }

    /**
    * * Field Name: IsOwnerRole
    * * Display Name: Is Owner Role
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: The role that defines ownership of a space. The engine reads the flag, not the name.
    */
    get IsOwnerRole(): boolean {
        return this.Get('IsOwnerRole');
    }
    set IsOwnerRole(value: boolean) {
        this.Set('IsOwnerRole', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: CanContribute
    * * Display Name: Can Contribute
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: 1 if the role may contribute content (create, update, or post items, tasks, and messages); 0 for read-only roles.
    */
    get CanContribute(): boolean {
        return this.Get('CanContribute');
    }
    set CanContribute(value: boolean) {
        this.Set('CanContribute', value);
    }
}


/**
 * MJ_BizApps_Collaboration: Space Type Status - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceTypeStatus
 * * Base View: vwSpaceTypeStatus
 * * @description A status a space type offers its spaces: Active, Paused, Closed and Archived ship for every type; a type may add its own. A space is in exactly one of its type's statuses (Space.StatusID) and may only choose among them. The attributes say what a space in the status allows; the type's driver may still refuse a change.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Type Status')
export class mjBizAppsCollaborationSpaceTypeStatusEntity extends BaseEntity<mjBizAppsCollaborationSpaceTypeStatusEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Type Status record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Type Status record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceTypeStatusEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceTypeID
    * * Display Name: Space Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Types (vwSpaceTypes.ID)
    * * Description: The type this status belongs to.
    */
    get SpaceTypeID(): string {
        return this.Get('SpaceTypeID');
    }
    set SpaceTypeID(value: string) {
        this.Set('SpaceTypeID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    * * Description: The status's key within its type: active, paused, closed, archived, or a type's own.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(100)
    * * Description: What the status is called on screen.
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Sequence
    * * Display Name: Sequence
    * * SQL Data Type: int
    * * Description: The definitive order of the type's statuses, for display and for the rule that a terminal status may only move forward.
    */
    get Sequence(): number {
        return this.Get('Sequence');
    }
    set Sequence(value: number) {
        this.Set('Sequence', value);
    }

    /**
    * * Field Name: IsDefault
    * * Display Name: Is Default
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: The status a new space of the type starts in; one per type.
    */
    get IsDefault(): boolean {
        return this.Get('IsDefault');
    }
    set IsDefault(value: boolean) {
        this.Set('IsDefault', value);
    }

    /**
    * * Field Name: ReadOnly
    * * Display Name: Read Only
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Members may read but not post, upload, assign or edit while the space is in this status.
    */
    get ReadOnly(): boolean {
        return this.Get('ReadOnly');
    }
    set ReadOnly(value: boolean) {
        this.Set('ReadOnly', value);
    }

    /**
    * * Field Name: Visible
    * * Display Name: Visible
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: The space is listed and reachable by its members; off hides it from everyone but its owner and staff.
    */
    get Visible(): boolean {
        return this.Get('Visible');
    }
    set Visible(value: boolean) {
        this.Set('Visible', value);
    }

    /**
    * * Field Name: AgentRetrieval
    * * Display Name: Agent Retrieval
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: An agent may quote the space's material while it is in this status.
    */
    get AgentRetrieval(): boolean {
        return this.Get('AgentRetrieval');
    }
    set AgentRetrieval(value: boolean) {
        this.Set('AgentRetrieval', value);
    }

    /**
    * * Field Name: CanChangeAfter
    * * Display Name: Can Change After
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Once a space reaches this status it may still move to another; off freezes it there. A frozen status must be terminal.
    */
    get CanChangeAfter(): boolean {
        return this.Get('CanChangeAfter');
    }
    set CanChangeAfter(value: boolean) {
        this.Set('CanChangeAfter', value);
    }

    /**
    * * Field Name: NotifyMembersOnEnter
    * * Display Name: Notify Members On Enter
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Entering this status sends the space's "status changed" notice, one per member, through MJ's notification chain.
    */
    get NotifyMembersOnEnter(): boolean {
        return this.Get('NotifyMembersOnEnter');
    }
    set NotifyMembersOnEnter(value: boolean) {
        this.Set('NotifyMembersOnEnter', value);
    }

    /**
    * * Field Name: IsTerminal
    * * Display Name: Is Terminal
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Entering this status stamps Space.ClosedAt; retention and the closed views count from it. From a terminal status a space may move only to a higher Sequence, never back to an open one.
    */
    get IsTerminal(): boolean {
        return this.Get('IsTerminal');
    }
    set IsTerminal(value: boolean) {
        this.Set('IsTerminal', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: SpaceType
    * * Display Name: Space Type
    * * SQL Data Type: nvarchar(200)
    */
    get SpaceType(): string {
        return this.Get('SpaceType');
    }
}


/**
 * Collaboration's settings shape (MJ_BizApps_Collaboration: Space Types.Configuration and Spaces.Configuration): one shape at
 * every level, the app's, a type's and a space's, resolved most-specific-first within SpaceOverridable (D20). The source of truth
 * is packages/Core/src/configuration.ts; this copy is what CodeGen reads.
 */

export type mjBizAppsCollaborationSpaceTypeEntity_ConfigurationValue =
    | string
    | number
    | boolean
    | null
    | mjBizAppsCollaborationSpaceTypeEntity_ConfigurationValue[]
    | { [key: string]: mjBizAppsCollaborationSpaceTypeEntity_ConfigurationValue };

/**
 * The single typed settings shape for BizApps Collaboration at every level
 * (App, SpaceType, Space, SubSpace).
 */
export interface mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings {
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
    DataReach?: mjBizAppsCollaborationSpaceTypeEntity_DataReachDeclaration[];
    /** Behavior switches that the type's own drivers read, keyed by app. */
    Extensions?: Record<string, Record<string, mjBizAppsCollaborationSpaceTypeEntity_ConfigurationValue>>;
}

/** One entity a type's participants may read, by a path to an anchor role (D28). */
export interface mjBizAppsCollaborationSpaceTypeEntity_DataReachDeclaration {
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
    const d = declaration as Partial<mjBizAppsCollaborationSpaceTypeEntity_DataReachDeclaration>;
    const errors: string[] = [];
    if (typeof d.Entity !== 'string' || d.Entity.trim() === '') errors.push(`${at}.Entity must name an entity.`);
    if (typeof d.Path !== 'string' || d.Path.trim() === '') errors.push(`${at}.Path must name a column, or one hop: Column.Column.`);
    else if (d.Path.split('.').length > 2 || d.Path.split('.').some((part) => part.trim() === '')) errors.push(`${at}.Path "${d.Path}" may have at most one hop.`);
    if (typeof d.AnchorRole !== 'string' || d.AnchorRole.trim() === '') errors.push(`${at}.AnchorRole must name an anchor role.`);
    if (d.Band !== 'Team' && d.Band !== 'Shared') errors.push(`${at}.Band must be Team or Shared.`);
    if (!Array.isArray(d.Fields) || d.Fields.length === 0 || d.Fields.some((f) => typeof f !== 'string' || f.trim() === '')) errors.push(`${at}.Fields must list at least one field.`);
    return errors;
}

export interface mjBizAppsCollaborationSpaceTypeEntity_ISpaceRules extends mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings {}
export interface mjBizAppsCollaborationSpaceTypeEntity_ISpaceTypeConfiguration extends mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings {}
export interface mjBizAppsCollaborationSpaceTypeEntity_ISpaceConfiguration extends mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings {}

/**
 * MJ_BizApps_Collaboration: Space Types - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: SpaceType
 * * Base View: vwSpaceTypes
 * * @description Kind of space: vocabulary, which panels are on, retention and agent defaults, and how outsiders join. Behavior lives in these columns, not in code branched on the name.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Space Types')
export class mjBizAppsCollaborationSpaceTypeEntity extends BaseEntity<mjBizAppsCollaborationSpaceTypeEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Space Types record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Space Types record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceTypeEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: Code
    * * Display Name: Code
    * * SQL Data Type: nvarchar(40)
    * * Description: Stable metadata key. The engine does not branch on it.
    */
    get Code(): string {
        return this.Get('Code');
    }
    set Code(value: string) {
        this.Set('Code', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    * * Description: Display name of the type.
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: Vocabulary
    * * Display Name: Vocabulary
    * * SQL Data Type: nvarchar(50)
    * * Description: Human noun for spaces of this type (workspace, committee, cohort, community). Open set.
    */
    get Vocabulary(): string {
        return this.Get('Vocabulary');
    }
    set Vocabulary(value: string) {
        this.Set('Vocabulary', value);
    }

    /**
    * * Field Name: Discoverability
    * * Display Name: Discoverability
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Hidden
    * * Value List Type: List
    * * Possible Values 
    *   * Hidden
    *   * Listed
    *   * Open
    * * Description: Hidden, Listed, or Open. Modelled now; the community surface that uses Listed and Open is a later release.
    */
    get Discoverability(): 'Hidden' | 'Listed' | 'Open' {
        return this.Get('Discoverability');
    }
    set Discoverability(value: 'Hidden' | 'Listed' | 'Open') {
        this.Set('Discoverability', value);
    }

    /**
    * * Field Name: JoinMode
    * * Display Name: Join Mode
    * * SQL Data Type: nvarchar(20)
    * * Default Value: InviteOnly
    * * Value List Type: List
    * * Possible Values 
    *   * InviteOnly
    *   * RequestToJoin
    *   * SelfServe
    * * Description: InviteOnly, RequestToJoin, or SelfServe.
    */
    get JoinMode(): 'InviteOnly' | 'RequestToJoin' | 'SelfServe' {
        return this.Get('JoinMode');
    }
    set JoinMode(value: 'InviteOnly' | 'RequestToJoin' | 'SelfServe') {
        this.Set('JoinMode', value);
    }

    /**
    * * Field Name: MessagingPanel
    * * Display Name: Messaging Panel
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Conversation panel is on for spaces of this type.
    */
    get MessagingPanel(): boolean {
        return this.Get('MessagingPanel');
    }
    set MessagingPanel(value: boolean) {
        this.Set('MessagingPanel', value);
    }

    /**
    * * Field Name: LibraryPanel
    * * Display Name: Library Panel
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: File library panel is on.
    */
    get LibraryPanel(): boolean {
        return this.Get('LibraryPanel');
    }
    set LibraryPanel(value: boolean) {
        this.Set('LibraryPanel', value);
    }

    /**
    * * Field Name: WorkPanel
    * * Display Name: Work Panel
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Task / work panel is on.
    */
    get WorkPanel(): boolean {
        return this.Get('WorkPanel');
    }
    set WorkPanel(value: boolean) {
        this.Set('WorkPanel', value);
    }

    /**
    * * Field Name: DefaultAgentRetrieval
    * * Display Name: Default Agent Retrieval
    * * SQL Data Type: nvarchar(30)
    * * Default Value: Included
    * * Value List Type: List
    * * Possible Values 
    *   * ExcludedEntirely
    *   * ExcludedFromParentScope
    *   * Included
    * * Description: Default AgentRetrieval for a new space of this type.
    */
    get DefaultAgentRetrieval(): 'ExcludedEntirely' | 'ExcludedFromParentScope' | 'Included' {
        return this.Get('DefaultAgentRetrieval');
    }
    set DefaultAgentRetrieval(value: 'ExcludedEntirely' | 'ExcludedFromParentScope' | 'Included') {
        this.Set('DefaultAgentRetrieval', value);
    }

    /**
    * * Field Name: DefaultBand
    * * Display Name: Default Band
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Team
    * * Value List Type: List
    * * Possible Values 
    *   * Shared
    *   * Team
    * * Description: Default Team or Shared band for a new item in a space of this type.
    */
    get DefaultBand(): 'Shared' | 'Team' {
        return this.Get('DefaultBand');
    }
    set DefaultBand(value: 'Shared' | 'Team') {
        this.Set('DefaultBand', value);
    }

    /**
    * * Field Name: InviteApproval
    * * Display Name: Invite Approval
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Approve
    * * Value List Type: List
    * * Possible Values 
    *   * Approve
    *   * AutoApprove
    * * Description: Approve: a new member stays Invited until an owner of the space sets them Active. AutoApprove: the server creates the member Active. The invited person does not activate themselves.
    */
    get InviteApproval(): 'Approve' | 'AutoApprove' {
        return this.Get('InviteApproval');
    }
    set InviteApproval(value: 'Approve' | 'AutoApprove') {
        this.Set('InviteApproval', value);
    }

    /**
    * * Field Name: MemberCap
    * * Display Name: Member Cap
    * * SQL Data Type: int
    * * Description: Maximum members in one space of this type. Null means no cap.
    */
    get MemberCap(): number | null {
        return this.Get('MemberCap');
    }
    set MemberCap(value: number | null) {
        this.Set('MemberCap', value);
    }

    /**
    * * Field Name: DisplayRank
    * * Display Name: Display Rank
    * * SQL Data Type: int
    * * Default Value: 0
    */
    get DisplayRank(): number {
        return this.Get('DisplayRank');
    }
    set DisplayRank(value: number) {
        this.Set('DisplayRank', value);
    }

    /**
    * * Field Name: IsActive
    * * Display Name: Is Active
    * * SQL Data Type: bit
    * * Default Value: 1
    */
    get IsActive(): boolean {
        return this.Get('IsActive');
    }
    set IsActive(value: boolean) {
        this.Set('IsActive', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: DefaultAllowParentAssignees
    * * Display Name: Default Allow Parent Assignees
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: Default AllowParentAssignees setting for new spaces of this type.
    */
    get DefaultAllowParentAssignees(): boolean {
        return this.Get('DefaultAllowParentAssignees');
    }
    set DefaultAllowParentAssignees(value: boolean) {
        this.Set('DefaultAllowParentAssignees', value);
    }

    /**
    * * Field Name: IconClass
    * * Display Name: Icon Class
    * * SQL Data Type: nvarchar(100)
    * * Description: Font Awesome icon class representing the space type (e.g., fa-solid fa-compass).
    */
    get IconClass(): string | null {
        return this.Get('IconClass');
    }
    set IconClass(value: string | null) {
        this.Set('IconClass', value);
    }

    /**
    * * Field Name: Color
    * * Display Name: Color
    * * SQL Data Type: nvarchar(50)
    * * Description: Hex color code representing the space type (e.g., #0076b6).
    */
    get Color(): string | null {
        return this.Get('Color');
    }
    set Color(value: string | null) {
        this.Set('Color', value);
    }

    /**
    * * Field Name: ServerDriverClass
    * * Display Name: Server Driver Class
    * * SQL Data Type: nvarchar(255)
    */
    get ServerDriverClass(): string | null {
        return this.Get('ServerDriverClass');
    }
    set ServerDriverClass(value: string | null) {
        this.Set('ServerDriverClass', value);
    }

    /**
    * * Field Name: UIDriverClass
    * * Display Name: UI Driver Class
    * * SQL Data Type: nvarchar(255)
    */
    get UIDriverClass(): string | null {
        return this.Get('UIDriverClass');
    }
    set UIDriverClass(value: string | null) {
        this.Set('UIDriverClass', value);
    }

    /**
    * * Field Name: SpaceExtensionEntity
    * * Display Name: Space Extension Entity
    * * SQL Data Type: nvarchar(255)
    */
    get SpaceExtensionEntity(): string | null {
        return this.Get('SpaceExtensionEntity');
    }
    set SpaceExtensionEntity(value: string | null) {
        this.Set('SpaceExtensionEntity', value);
    }

    /**
    * * Field Name: Configuration
    * * Display Name: Configuration
    * * SQL Data Type: nvarchar(MAX)
    * * JSON Type: mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings
    */
    get Configuration(): string | null {
        return this.Get('Configuration');
    }
    set Configuration(value: string | null) {
        this.Set('Configuration', value);
    }

    private _ConfigurationObject_cached: mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings | null | undefined = undefined;
    private _ConfigurationObject_lastRaw: string | null = null;
    /**
    * Typed accessor for Configuration — returns parsed JSON as mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings.
    * Uses lazy parsing with cache invalidation when the underlying raw value changes.
    */
    get ConfigurationObject(): mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings | null {
        const raw = this.Configuration;
        if (raw !== this._ConfigurationObject_lastRaw) {
            this._ConfigurationObject_cached = raw ? JSON.parse(raw) : null;
            this._ConfigurationObject_lastRaw = raw;
        }
        return this._ConfigurationObject_cached!;
    }
    set ConfigurationObject(value: mjBizAppsCollaborationSpaceTypeEntity_CollaborationSettings | null) {
        const raw = value ? JSON.stringify(value) : null;
        this.Configuration = raw;
        this._ConfigurationObject_cached = value;
        this._ConfigurationObject_lastRaw = raw;
    }
}


/**
 * Collaboration's settings shape (MJ_BizApps_Collaboration: Space Types.Configuration and Spaces.Configuration): one shape at
 * every level, the app's, a type's and a space's, resolved most-specific-first within SpaceOverridable (D20). The source of truth
 * is packages/Core/src/configuration.ts; this copy is what CodeGen reads.
 */

export type mjBizAppsCollaborationSpaceEntity_ConfigurationValue =
    | string
    | number
    | boolean
    | null
    | mjBizAppsCollaborationSpaceEntity_ConfigurationValue[]
    | { [key: string]: mjBizAppsCollaborationSpaceEntity_ConfigurationValue };

/**
 * The single typed settings shape for BizApps Collaboration at every level
 * (App, SpaceType, Space, SubSpace).
 */
export interface mjBizAppsCollaborationSpaceEntity_CollaborationSettings {
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
    DataReach?: mjBizAppsCollaborationSpaceEntity_DataReachDeclaration[];
    /** Behavior switches that the type's own drivers read, keyed by app. */
    Extensions?: Record<string, Record<string, mjBizAppsCollaborationSpaceEntity_ConfigurationValue>>;
}

/** One entity a type's participants may read, by a path to an anchor role (D28). */
export interface mjBizAppsCollaborationSpaceEntity_DataReachDeclaration {
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
    const d = declaration as Partial<mjBizAppsCollaborationSpaceEntity_DataReachDeclaration>;
    const errors: string[] = [];
    if (typeof d.Entity !== 'string' || d.Entity.trim() === '') errors.push(`${at}.Entity must name an entity.`);
    if (typeof d.Path !== 'string' || d.Path.trim() === '') errors.push(`${at}.Path must name a column, or one hop: Column.Column.`);
    else if (d.Path.split('.').length > 2 || d.Path.split('.').some((part) => part.trim() === '')) errors.push(`${at}.Path "${d.Path}" may have at most one hop.`);
    if (typeof d.AnchorRole !== 'string' || d.AnchorRole.trim() === '') errors.push(`${at}.AnchorRole must name an anchor role.`);
    if (d.Band !== 'Team' && d.Band !== 'Shared') errors.push(`${at}.Band must be Team or Shared.`);
    if (!Array.isArray(d.Fields) || d.Fields.length === 0 || d.Fields.some((f) => typeof f !== 'string' || f.trim() === '')) errors.push(`${at}.Fields must list at least one field.`);
    return errors;
}

export interface mjBizAppsCollaborationSpaceEntity_ISpaceRules extends mjBizAppsCollaborationSpaceEntity_CollaborationSettings {}
export interface mjBizAppsCollaborationSpaceEntity_ISpaceTypeConfiguration extends mjBizAppsCollaborationSpaceEntity_CollaborationSettings {}
export interface mjBizAppsCollaborationSpaceEntity_ISpaceConfiguration extends mjBizAppsCollaborationSpaceEntity_CollaborationSettings {}

/**
 * MJ_BizApps_Collaboration: Spaces - strongly typed entity sub-class
 * * Schema: __mj_BizAppsCollaboration
 * * Base Table: Space
 * * Base View: vwSpaces
 * * @description The container. Permission boundary and agent retrieval boundary, as a tree: one root per relationship, sub-spaces for the work inside it.
 * * Primary Key: ID
 * @extends {BaseEntity}
 * @class
 * @public
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Collaboration: Spaces')
export class mjBizAppsCollaborationSpaceEntity extends BaseEntity<mjBizAppsCollaborationSpaceEntityType> {
    /**
    * Loads the MJ_BizApps_Collaboration: Spaces record from the database
    * @param ID: string - primary key value to load the MJ_BizApps_Collaboration: Spaces record.
    * @param EntityRelationshipsToLoad - (optional) the relationships to load
    * @returns {Promise<boolean>} - true if successful, false otherwise
    * @public
    * @async
    * @memberof mjBizAppsCollaborationSpaceEntity
    * @method
    * @override
    */
    public async Load(ID: string, EntityRelationshipsToLoad?: string[]) : Promise<boolean> {
        const compositeKey: CompositeKey = new CompositeKey();
        compositeKey.KeyValuePairs.push({ FieldName: 'ID', Value: ID });
        return await super.InnerLoad(compositeKey, EntityRelationshipsToLoad);
    }

    /**
    * * Field Name: ID
    * * Display Name: ID
    * * SQL Data Type: uniqueidentifier
    * * Default Value: newsequentialid()
    */
    get ID(): string {
        return this.Get('ID');
    }
    set ID(value: string) {
        this.Set('ID', value);
    }

    /**
    * * Field Name: SpaceTypeID
    * * Display Name: Space Type ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Types (vwSpaceTypes.ID)
    */
    get SpaceTypeID(): string {
        return this.Get('SpaceTypeID');
    }
    set SpaceTypeID(value: string) {
        this.Set('SpaceTypeID', value);
    }

    /**
    * * Field Name: ParentID
    * * Display Name: Parent ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Spaces (vwSpaces.ID)
    * * Description: Parent space. Null on a root. It does not carry the IsHierarchy flag, so CodeGen emits no path columns.
    */
    get ParentID(): string | null {
        return this.Get('ParentID');
    }
    set ParentID(value: string | null) {
        this.Set('ParentID', value);
    }

    /**
    * * Field Name: Name
    * * Display Name: Name
    * * SQL Data Type: nvarchar(200)
    * * Description: Designated name of the space.
    */
    get Name(): string {
        return this.Get('Name');
    }
    set Name(value: string) {
        this.Set('Name', value);
    }

    /**
    * * Field Name: Description
    * * Display Name: Description
    * * SQL Data Type: nvarchar(MAX)
    */
    get Description(): string | null {
        return this.Get('Description');
    }
    set Description(value: string | null) {
        this.Set('Description', value);
    }

    /**
    * * Field Name: OwnerID
    * * Display Name: Owner ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ: Users (vwUsers.ID)
    * * Description: MJ user who owns the space.
    */
    get OwnerID(): string {
        return this.Get('OwnerID');
    }
    set OwnerID(value: string) {
        this.Set('OwnerID', value);
    }

    /**
    * * Field Name: InheritsMembership
    * * Display Name: Inherits Membership
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: 1: members of this space are members of its descendants. 0: this sub-space keeps its own roster.
    */
    get InheritsMembership(): boolean {
        return this.Get('InheritsMembership');
    }
    set InheritsMembership(value: boolean) {
        this.Set('InheritsMembership', value);
    }

    /**
    * * Field Name: AgentRetrieval
    * * Display Name: Agent Retrieval
    * * SQL Data Type: nvarchar(30)
    * * Default Value: Included
    * * Value List Type: List
    * * Possible Values 
    *   * ExcludedEntirely
    *   * ExcludedFromParentScope
    *   * Included
    * * Description: Included, ExcludedFromParentScope, or ExcludedEntirely. A human may read a space that no agent may quote.
    */
    get AgentRetrieval(): 'ExcludedEntirely' | 'ExcludedFromParentScope' | 'Included' {
        return this.Get('AgentRetrieval');
    }
    set AgentRetrieval(value: 'ExcludedEntirely' | 'ExcludedFromParentScope' | 'Included') {
        this.Set('AgentRetrieval', value);
    }

    /**
    * * Field Name: StartedAt
    * * Display Name: Started At
    * * SQL Data Type: datetimeoffset
    * * Description: When this space (usually a sub-space) started. The root outlives its children.
    */
    get StartedAt(): Date | null {
        return this.Get('StartedAt');
    }
    set StartedAt(value: Date | null) {
        this.Set('StartedAt', value);
    }

    /**
    * * Field Name: ClosedAt
    * * Display Name: Closed At
    * * SQL Data Type: datetimeoffset
    * * Description: When this space closed. Closure is a timestamp on the sub-space, not a delete of the root.
    */
    get ClosedAt(): Date | null {
        return this.Get('ClosedAt');
    }
    set ClosedAt(value: Date | null) {
        this.Set('ClosedAt', value);
    }

    /**
    * * Field Name: __mj_CreatedAt
    * * Display Name: Created At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_CreatedAt(): Date {
        return this.Get('__mj_CreatedAt');
    }

    /**
    * * Field Name: __mj_UpdatedAt
    * * Display Name: Updated At
    * * SQL Data Type: datetimeoffset
    * * Default Value: getutcdate()
    */
    get __mj_UpdatedAt(): Date {
        return this.Get('__mj_UpdatedAt');
    }

    /**
    * * Field Name: AllowParentAssignees
    * * Display Name: Allow Parent Assignees
    * * SQL Data Type: bit
    * * Default Value: 1
    * * Description: 1 if participants in this space may assign people seated on ancestor spaces whose membership reaches this space; 0 to restrict assignment to seats in this space or below. Only staff may change this switch.
    */
    get AllowParentAssignees(): boolean {
        return this.Get('AllowParentAssignees');
    }
    set AllowParentAssignees(value: boolean) {
        this.Set('AllowParentAssignees', value);
    }

    /**
    * * Field Name: PlannedCloseAt
    * * Display Name: Planned Close At
    * * SQL Data Type: datetimeoffset
    * * Description: Target or planned close date/time for the space. Actual closure is recorded in ClosedAt.
    */
    get PlannedCloseAt(): Date | null {
        return this.Get('PlannedCloseAt');
    }
    set PlannedCloseAt(value: Date | null) {
        this.Set('PlannedCloseAt', value);
    }

    /**
    * * Field Name: IconClass
    * * Display Name: Icon Class
    * * SQL Data Type: nvarchar(100)
    * * Description: Font Awesome icon class representing the space (e.g., fa-solid fa-folder-tree, fa-solid fa-briefcase). Overrides SpaceType.IconClass if set.
    */
    get IconClass(): string | null {
        return this.Get('IconClass');
    }
    set IconClass(value: string | null) {
        this.Set('IconClass', value);
    }

    /**
    * * Field Name: Color
    * * Display Name: Color
    * * SQL Data Type: nvarchar(50)
    * * Description: Hex color code representing the space (e.g., #0076b6, #10b981). Overrides SpaceType.Color if set.
    */
    get Color(): string | null {
        return this.Get('Color');
    }
    set Color(value: string | null) {
        this.Set('Color', value);
    }

    /**
    * * Field Name: BackgroundImageURL
    * * Display Name: Background Image URL
    * * SQL Data Type: nvarchar(1000)
    * * Description: URL of an optional hero banner or background image displayed in the space header and overview.
    */
    get BackgroundImageURL(): string | null {
        return this.Get('BackgroundImageURL');
    }
    set BackgroundImageURL(value: string | null) {
        this.Set('BackgroundImageURL', value);
    }

    /**
    * * Field Name: Configuration
    * * Display Name: Configuration
    * * SQL Data Type: nvarchar(MAX)
    * * JSON Type: mjBizAppsCollaborationSpaceEntity_CollaborationSettings
    */
    get Configuration(): string | null {
        return this.Get('Configuration');
    }
    set Configuration(value: string | null) {
        this.Set('Configuration', value);
    }

    private _ConfigurationObject_cached: mjBizAppsCollaborationSpaceEntity_CollaborationSettings | null | undefined = undefined;
    private _ConfigurationObject_lastRaw: string | null = null;
    /**
    * Typed accessor for Configuration — returns parsed JSON as mjBizAppsCollaborationSpaceEntity_CollaborationSettings.
    * Uses lazy parsing with cache invalidation when the underlying raw value changes.
    */
    get ConfigurationObject(): mjBizAppsCollaborationSpaceEntity_CollaborationSettings | null {
        const raw = this.Configuration;
        if (raw !== this._ConfigurationObject_lastRaw) {
            this._ConfigurationObject_cached = raw ? JSON.parse(raw) : null;
            this._ConfigurationObject_lastRaw = raw;
        }
        return this._ConfigurationObject_cached!;
    }
    set ConfigurationObject(value: mjBizAppsCollaborationSpaceEntity_CollaborationSettings | null) {
        const raw = value ? JSON.stringify(value) : null;
        this.Configuration = raw;
        this._ConfigurationObject_cached = value;
        this._ConfigurationObject_lastRaw = raw;
    }

    /**
    * * Field Name: StatusID
    * * Display Name: Status ID
    * * SQL Data Type: uniqueidentifier
    * * Related Entity/Foreign Key: MJ_BizApps_Collaboration: Space Type Status (vwSpaceTypeStatus.ID)
    * * Description: The status the space is in, one of its type's (SpaceTypeStatus). NULL until the server stamps it: then the type's default while ClosedAt is null, and the type's first terminal status once ClosedAt is set, as fnCollaborationSpaceStatuses derives it.
    */
    get StatusID(): string | null {
        return this.Get('StatusID');
    }
    set StatusID(value: string | null) {
        this.Set('StatusID', value);
    }

    /**
    * * Field Name: SpaceType
    * * Display Name: Space Type
    * * SQL Data Type: nvarchar(200)
    */
    get SpaceType(): string {
        return this.Get('SpaceType');
    }

    /**
    * * Field Name: Parent
    * * Display Name: Parent
    * * SQL Data Type: nvarchar(200)
    */
    get Parent(): string | null {
        return this.Get('Parent');
    }

    /**
    * * Field Name: Owner
    * * Display Name: Owner
    * * SQL Data Type: nvarchar(100)
    */
    get Owner(): string {
        return this.Get('Owner');
    }

    /**
    * * Field Name: Status
    * * Display Name: Status
    * * SQL Data Type: nvarchar(100)
    */
    get Status(): string | null {
        return this.Get('Status');
    }
}
