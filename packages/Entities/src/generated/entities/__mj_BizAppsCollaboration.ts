import { BaseEntity, EntitySaveOptions, EntityDeleteOptions, CompositeKey, ValidationResult, ValidationErrorInfo, ValidationErrorType, Metadata, ProviderType, DatabaseProviderBase } from "@memberjunction/core";
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
});

export type mjBizAppsCollaborationSpaceItemEntityType = z.infer<typeof mjBizAppsCollaborationSpaceItemSchema>;

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
});

export type mjBizAppsCollaborationSpaceMemberEntityType = z.infer<typeof mjBizAppsCollaborationSpaceMemberSchema>;

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
    GovernancePanel: z.boolean().describe(`
        * * Field Name: GovernancePanel
        * * Display Name: Governance Panel
        * * SQL Data Type: bit
        * * Default Value: 0
        * * Description: Governance panel is on. Committees still owns motions and ballots; this only says the panel is part of the type.`),
    DefaultRetention: z.union([z.literal('Indefinite'), z.literal('Month'), z.literal('Year')]).describe(`
        * * Field Name: DefaultRetention
        * * Display Name: Default Retention
        * * SQL Data Type: nvarchar(20)
        * * Default Value: Indefinite
    * * Value List Type: List
    * * Possible Values 
    *   * Indefinite
    *   * Month
    *   * Year
        * * Description: Month, Year, or Indefinite. Used when the space itself has no Retention.`),
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
        * * Default Value: 1
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
    Retention: z.union([z.literal('Indefinite'), z.literal('Month'), z.literal('Year')]).nullable().describe(`
        * * Field Name: Retention
        * * Display Name: Retention
        * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Indefinite
    *   * Month
    *   * Year
        * * Description: Month, Year, or Indefinite. Null uses SpaceType.DefaultRetention.`),
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
    RootParentID: z.string().nullable().describe(`
        * * Field Name: RootParentID
        * * Display Name: Root Parent ID
        * * SQL Data Type: uniqueidentifier`),
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
    * * Field Name: GovernancePanel
    * * Display Name: Governance Panel
    * * SQL Data Type: bit
    * * Default Value: 0
    * * Description: Governance panel is on. Committees still owns motions and ballots; this only says the panel is part of the type.
    */
    get GovernancePanel(): boolean {
        return this.Get('GovernancePanel');
    }
    set GovernancePanel(value: boolean) {
        this.Set('GovernancePanel', value);
    }

    /**
    * * Field Name: DefaultRetention
    * * Display Name: Default Retention
    * * SQL Data Type: nvarchar(20)
    * * Default Value: Indefinite
    * * Value List Type: List
    * * Possible Values 
    *   * Indefinite
    *   * Month
    *   * Year
    * * Description: Month, Year, or Indefinite. Used when the space itself has no Retention.
    */
    get DefaultRetention(): 'Indefinite' | 'Month' | 'Year' {
        return this.Get('DefaultRetention');
    }
    set DefaultRetention(value: 'Indefinite' | 'Month' | 'Year') {
        this.Set('DefaultRetention', value);
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
}


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
    * * Default Value: 1
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
    * * Field Name: Retention
    * * Display Name: Retention
    * * SQL Data Type: nvarchar(20)
    * * Value List Type: List
    * * Possible Values 
    *   * Indefinite
    *   * Month
    *   * Year
    * * Description: Month, Year, or Indefinite. Null uses SpaceType.DefaultRetention.
    */
    get Retention(): 'Indefinite' | 'Month' | 'Year' | null {
        return this.Get('Retention');
    }
    set Retention(value: 'Indefinite' | 'Month' | 'Year' | null) {
        this.Set('Retention', value);
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
    * * Field Name: RootParentID
    * * Display Name: Root Parent ID
    * * SQL Data Type: uniqueidentifier
    */
    get RootParentID(): string | null {
        return this.Get('RootParentID');
    }
}
