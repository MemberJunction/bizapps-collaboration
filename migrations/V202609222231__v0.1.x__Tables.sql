-- =============================================================================
-- BizApps Collaboration — Baseline tables (v0.1.x)
-- =============================================================================
-- Spec: plans/plan.md §4
--
-- Five tables. Everything else (conversations, tasks, files, committees)
-- composes through SpaceItem's EntityID + RecordID. No dependency on another
-- BizApp schema.
--
-- Hand-written DDL only. Do not add __mj_CreatedAt / __mj_UpdatedAt or indexes
-- on FK columns — CodeGen owns those. Do not insert Entity or EntityField rows.
-- Type-table ROWS are not inserted here; seed via metadata/ with stable UUIDs.
-- The CodeGen emit is appended under the banner after a CodeGen run.
--
-- Placeholders:
--   ${flyway:defaultSchema}  this app
--   ${mjSchema}              MJ core (__mj)
--
-- Hierarchy columns (RootParentID, ParentIDPath, …) are NOT columns of Space.
-- CodeGen emits them on the base view when ParentID is marked IsHierarchy.
-- =============================================================================

-- =============================================================================
-- 1. TYPE TABLES
-- =============================================================================

---------------------------------------------------------------------------
-- SpaceType — vocabulary and behavior for a kind of space. The engine reads
-- these columns. A special case in code is a missing config field.
-- "Just messaging" is a type with MessagingPanel on and the other panels off.
---------------------------------------------------------------------------
CREATE TABLE ${flyway:defaultSchema}.SpaceType (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    -- Human noun for this type: workspace, committee, cohort, community.
    -- Open set. Not a check constraint.
    Vocabulary NVARCHAR(50) NOT NULL,

    Discoverability NVARCHAR(20) NOT NULL DEFAULT 'Hidden',
    JoinMode NVARCHAR(20) NOT NULL DEFAULT 'InviteOnly',

    MessagingPanel BIT NOT NULL DEFAULT 1,
    LibraryPanel BIT NOT NULL DEFAULT 0,
    WorkPanel BIT NOT NULL DEFAULT 0,
    GovernancePanel BIT NOT NULL DEFAULT 0,

    -- Applied to a new space when Space.Retention is null.
    DefaultRetention NVARCHAR(20) NOT NULL DEFAULT 'Indefinite',
    DefaultAgentRetrieval NVARCHAR(30) NOT NULL DEFAULT 'Included',
    DefaultBand NVARCHAR(20) NOT NULL DEFAULT 'Team',

    -- Who may join without an operator: the type decides, the member row records it.
    InviteApproval NVARCHAR(20) NOT NULL DEFAULT 'Approve',
    MemberCap INT NULL,

    DisplayRank INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,

    CONSTRAINT PK_SpaceType PRIMARY KEY (ID),
    CONSTRAINT UQ_SpaceType_Code UNIQUE (Code),
    CONSTRAINT CK_SpaceType_Discoverability CHECK (Discoverability IN ('Hidden', 'Listed', 'Open')),
    CONSTRAINT CK_SpaceType_JoinMode CHECK (JoinMode IN ('InviteOnly', 'RequestToJoin', 'SelfServe')),
    CONSTRAINT CK_SpaceType_DefaultRetention CHECK (DefaultRetention IN ('Month', 'Year', 'Indefinite')),
    CONSTRAINT CK_SpaceType_DefaultAgentRetrieval CHECK (DefaultAgentRetrieval IN ('Included', 'ExcludedFromParentScope', 'ExcludedEntirely')),
    CONSTRAINT CK_SpaceType_DefaultBand CHECK (DefaultBand IN ('Team', 'Shared')),
    CONSTRAINT CK_SpaceType_InviteApproval CHECK (InviteApproval IN ('Approve', 'AutoApprove')),
    CONSTRAINT CK_SpaceType_MemberCap CHECK (MemberCap IS NULL OR MemberCap > 0)
);
GO

---------------------------------------------------------------------------
-- SpaceRoleType — what a member is allowed to do. The engine reads the flags
-- and Level. It does not compare Code or Name. Same idiom as DealRole.IsOwnerRole.
--
-- Level is this role's own authority. MaxGrantableLevel is the highest Level
-- a holder of this role may grant. A role may invite only up to its own level.
---------------------------------------------------------------------------
CREATE TABLE ${flyway:defaultSchema}.SpaceRoleType (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    Code NVARCHAR(40) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,

    Level INT NOT NULL,
    MaxGrantableLevel INT NOT NULL,
    CanInvite BIT NOT NULL DEFAULT 0,
    CanPromoteBand BIT NOT NULL DEFAULT 0,
    CanSeeTeamBand BIT NOT NULL DEFAULT 0,
    IsOwnerRole BIT NOT NULL DEFAULT 0,

    DisplayRank INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,

    CONSTRAINT PK_SpaceRoleType PRIMARY KEY (ID),
    CONSTRAINT UQ_SpaceRoleType_Code UNIQUE (Code),
    CONSTRAINT CK_SpaceRoleType_Level CHECK (Level >= 0 AND MaxGrantableLevel >= 0 AND MaxGrantableLevel <= Level)
);
GO

-- =============================================================================
-- 2. SPACE
-- =============================================================================

---------------------------------------------------------------------------
-- Space — the container. One perpetual root per relationship (ParentID null);
-- sub-spaces for the work inside it. Closure lives on the sub-space (ClosedAt),
-- never by deleting the root.
--
-- ParentID is the self-referencing hierarchy key. IsHierarchy is metadata on
-- that relationship, set when the entity is registered — not a column here.
---------------------------------------------------------------------------
CREATE TABLE ${flyway:defaultSchema}.Space (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    SpaceTypeID UNIQUEIDENTIFIER NOT NULL,
    ParentID UNIQUEIDENTIFIER NULL,
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    OwnerID UNIQUEIDENTIFIER NOT NULL,

    -- 1 = members of this space are also members of its descendants.
    -- 0 = this sub-space is sealed to its own roster.
    InheritsMembership BIT NOT NULL DEFAULT 1,

    -- A human member may still read a space no agent may quote.
    AgentRetrieval NVARCHAR(30) NOT NULL DEFAULT 'Included',

    StartedAt DATETIMEOFFSET NULL,
    ClosedAt DATETIMEOFFSET NULL,
    -- Null means "use SpaceType.DefaultRetention".
    Retention NVARCHAR(20) NULL,

    CONSTRAINT PK_Space PRIMARY KEY (ID),
    CONSTRAINT FK_Space_SpaceType FOREIGN KEY (SpaceTypeID) REFERENCES ${flyway:defaultSchema}.SpaceType(ID),
    CONSTRAINT FK_Space_Parent FOREIGN KEY (ParentID) REFERENCES ${flyway:defaultSchema}.Space(ID),
    CONSTRAINT FK_Space_Owner FOREIGN KEY (OwnerID) REFERENCES ${mjSchema}.[User](ID),
    CONSTRAINT CK_Space_NoSelfParent CHECK (ParentID IS NULL OR ParentID <> ID),
    CONSTRAINT CK_Space_AgentRetrieval CHECK (AgentRetrieval IN ('Included', 'ExcludedFromParentScope', 'ExcludedEntirely')),
    CONSTRAINT CK_Space_Retention CHECK (Retention IS NULL OR Retention IN ('Month', 'Year', 'Indefinite')),
    CONSTRAINT CK_Space_ClosedAfterStart CHECK (StartedAt IS NULL OR ClosedAt IS NULL OR ClosedAt >= StartedAt)
);
GO

-- =============================================================================
-- 3. ROSTER AND ITEMS  (every row carries SpaceID, NOT NULL)
-- =============================================================================

---------------------------------------------------------------------------
-- SpaceMember — one roster for staff and outsiders. Both are MJ users.
-- The visibility band is which side of the space this person sits on.
-- Status 'Active' is what the membership filter accepts.
---------------------------------------------------------------------------
CREATE TABLE ${flyway:defaultSchema}.SpaceMember (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NOT NULL,
    SpaceRoleTypeID UNIQUEIDENTIFIER NOT NULL,
    Band NVARCHAR(20) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Invited',

    CONSTRAINT PK_SpaceMember PRIMARY KEY (ID),
    CONSTRAINT UQ_SpaceMember_Space_User UNIQUE (SpaceID, UserID),
    CONSTRAINT FK_SpaceMember_Space FOREIGN KEY (SpaceID) REFERENCES ${flyway:defaultSchema}.Space(ID),
    CONSTRAINT FK_SpaceMember_User FOREIGN KEY (UserID) REFERENCES ${mjSchema}.[User](ID),
    CONSTRAINT FK_SpaceMember_Role FOREIGN KEY (SpaceRoleTypeID) REFERENCES ${flyway:defaultSchema}.SpaceRoleType(ID),
    CONSTRAINT CK_SpaceMember_Band CHECK (Band IN ('Team', 'Shared')),
    CONSTRAINT CK_SpaceMember_Status CHECK (Status IN ('Invited', 'Active', 'Removed'))
);
GO

---------------------------------------------------------------------------
-- SpaceItem — one parent. EntityID + RecordID point at a file, conversation,
-- task, or any other record. Move an item; do not copy it. A second parent
-- would make the permission answer a union.
--
-- Team items have no promotion stamp. Shared items always do: who promoted,
-- and when.
---------------------------------------------------------------------------
CREATE TABLE ${flyway:defaultSchema}.SpaceItem (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    EntityID UNIQUEIDENTIFIER NOT NULL,
    RecordID NVARCHAR(450) NOT NULL,
    Band NVARCHAR(20) NOT NULL,
    PromotedAt DATETIMEOFFSET NULL,
    PromotedByUserID UNIQUEIDENTIFIER NULL,

    CONSTRAINT PK_SpaceItem PRIMARY KEY (ID),
    CONSTRAINT UQ_SpaceItem_Entity_Record UNIQUE (EntityID, RecordID),
    CONSTRAINT FK_SpaceItem_Space FOREIGN KEY (SpaceID) REFERENCES ${flyway:defaultSchema}.Space(ID),
    CONSTRAINT FK_SpaceItem_Entity FOREIGN KEY (EntityID) REFERENCES ${mjSchema}.Entity(ID),
    CONSTRAINT FK_SpaceItem_PromotedBy FOREIGN KEY (PromotedByUserID) REFERENCES ${mjSchema}.[User](ID),
    CONSTRAINT CK_SpaceItem_Band CHECK (Band IN ('Team', 'Shared')),
    CONSTRAINT CK_SpaceItem_Promotion CHECK (
        (Band = 'Team' AND PromotedAt IS NULL AND PromotedByUserID IS NULL)
        OR
        (Band = 'Shared' AND PromotedAt IS NOT NULL AND PromotedByUserID IS NOT NULL)
    )
);
GO

-- =============================================================================
-- 4. EXTENDED PROPERTIES
-- =============================================================================

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'BizApps Collaboration. A Space is the permission boundary and the agent retrieval boundary. Five tables; conversations, tasks, and files compose in through SpaceItem.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Kind of space: vocabulary, which panels are on, retention and agent defaults, and how outsiders join. Behavior lives in these columns, not in code branched on the name.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Stable metadata key. The engine does not branch on it.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name of the type.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Human noun for spaces of this type (workspace, committee, cohort, community). Open set.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Vocabulary';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Hidden, Listed, or Open. Modelled now; the community surface that uses Listed and Open is a later release.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Discoverability';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'InviteOnly, RequestToJoin, or SelfServe.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'JoinMode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Conversation panel is on for spaces of this type.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'MessagingPanel';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'File library panel is on.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'LibraryPanel';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Task / work panel is on.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'WorkPanel';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Governance panel is on. Committees still owns motions and ballots; this only says the panel is part of the type.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'GovernancePanel';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Month, Year, or Indefinite. Used when the space itself has no Retention.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'DefaultRetention';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Default AgentRetrieval for a new space of this type.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'DefaultAgentRetrieval';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Default Team or Shared band for a new item in a space of this type.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'DefaultBand';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Approve: a new member stays Invited until someone accepts them. AutoApprove: the server may create the member Active.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'InviteApproval';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Maximum members in one space of this type. Null means no cap.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'MemberCap';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'What a space member is allowed to do. The engine reads Level and the BIT flags. It never compares Code or Name.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'This role''s own authority. A grant must be of a role whose Level is <= the grantor''s MaxGrantableLevel.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'Level';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Highest Level this role may grant. Always <= Level.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'MaxGrantableLevel';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Holder may invite members into a space they belong to, inside their own subtree, at or below MaxGrantableLevel.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'CanInvite';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Holder may move an item from Team to Shared.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'CanPromoteBand';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Holder may read Team-band items. Shared-band items do not need this flag.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'CanSeeTeamBand';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The role that defines ownership of a space. The engine reads the flag, not the name.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'IsOwnerRole';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The container. Permission boundary and agent retrieval boundary, as a tree: one root per relationship, sub-spaces for the work inside it.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Designated name of the space.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Parent space. Null on the perpetual root. Self-reference is the hierarchy key CodeGen marks IsHierarchy.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'ParentID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'MJ user who owns the space.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'OwnerID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1: members of this space are members of its descendants. 0: this sub-space keeps its own roster.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'InheritsMembership';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Included, ExcludedFromParentScope, or ExcludedEntirely. A human may read a space that no agent may quote.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'AgentRetrieval';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When this space (usually a sub-space) started. The root outlives its children.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'StartedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When this space closed. Closure is a timestamp on the sub-space, not a delete of the root.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'ClosedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Month, Year, or Indefinite. Null uses SpaceType.DefaultRetention.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'Retention';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'One roster row per user per space. Staff and outsiders are both MJ users. Status Active is the row the membership filter accepts.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMember';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Team or Shared. Which side of the space this person sits on.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMember', @level2type = N'COLUMN', @level2name = N'Band';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Invited, Active, or Removed. New rows start Invited unless the type auto-approves.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMember', @level2type = N'COLUMN', @level2name = N'Status';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'An item in exactly one space: EntityID + RecordID, plus Team or Shared. Unique on (EntityID, RecordID) so an item cannot have two parents.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The entity the item points at. Same polymorphic pair TaskLink uses.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'EntityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Primary key of the pointed-at record, as text, matching TaskLink.RecordID.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'RecordID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Team (working material, not in the client-facing agent scope) or Shared (promoted, with an actor and a timestamp).',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'Band';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When a Shared item was promoted. Null on Team items.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'PromotedAt';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'MJ user who promoted a Shared item. Required together with PromotedAt. Null on Team items.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'PromotedByUserID';
GO




















































-- =============================================================================
-- =============================================================================
--
--   >>>  CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
--
--   Folded from migrations/codegen/CodeGen_Run_2026-09-23_00-30-29.sql.
--   Re-run CodeGen and replace everything below this banner.
--   The hand-authored DDL above is preserved.
--
-- =============================================================================
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Types */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '01596359-ec4b-449c-ba16-316de4b92a4e',
         'MJ_BizApps_Collaboration: Space Types',
         'Space Types',
         'Kind of space: vocabulary, which panels are on, retention and agent defaults, and how outsiders join. Behavior lives in these columns, not in code branched on the name.',
         NULL,
         'SpaceType',
         'vwSpaceTypes',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to create new application ${flyway:defaultSchema} */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[Application] WHERE [ID] = '94f5906b-38ab-4a9f-bfca-3d395bbbc198'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[Application] ([ID], [Name], [Description], [SchemaAutoAddNewEntities], [Path], [AutoUpdatePath], [DefaultForNewUser])
                       VALUES ('94f5906b-38ab-4a9f-bfca-3d395bbbc198', '${flyway:defaultSchema}', 'Generated for schema', '${flyway:defaultSchema}', 'mjbizappscollaboration', 1, 0)
   END;

/* Adding role UI to application ${flyway:defaultSchema} */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[ApplicationRole] WHERE [ApplicationID] = '94f5906b-38ab-4a9f-bfca-3d395bbbc198' AND [RoleID] = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[ApplicationRole]
                                 ([ApplicationID], [RoleID], [CanAccess], [CanAdmin]) VALUES
                                 ('94f5906b-38ab-4a9f-bfca-3d395bbbc198', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0)
   END;

/* Adding role Developer to application ${flyway:defaultSchema} */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[ApplicationRole] WHERE [ApplicationID] = '94f5906b-38ab-4a9f-bfca-3d395bbbc198' AND [RoleID] = 'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[ApplicationRole]
                                 ([ApplicationID], [RoleID], [CanAccess], [CanAdmin]) VALUES
                                 ('94f5906b-38ab-4a9f-bfca-3d395bbbc198', 'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1)
   END;

/* Adding role Integration to application ${flyway:defaultSchema} */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[ApplicationRole] WHERE [ApplicationID] = '94f5906b-38ab-4a9f-bfca-3d395bbbc198' AND [RoleID] = 'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[ApplicationRole]
                                 ([ApplicationID], [RoleID], [CanAccess], [CanAdmin]) VALUES
                                 ('94f5906b-38ab-4a9f-bfca-3d395bbbc198', 'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0)
   END;

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Types to application ID: '94f5906b-38ab-4a9f-bfca-3d395bbbc198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94f5906b-38ab-4a9f-bfca-3d395bbbc198', '01596359-ec4b-449c-ba16-316de4b92a4e', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94f5906b-38ab-4a9f-bfca-3d395bbbc198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Types for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('01596359-ec4b-449c-ba16-316de4b92a4e' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('01596359-ec4b-449c-ba16-316de4b92a4e' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Types for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('01596359-ec4b-449c-ba16-316de4b92a4e' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('01596359-ec4b-449c-ba16-316de4b92a4e' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Types for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('01596359-ec4b-449c-ba16-316de4b92a4e' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('01596359-ec4b-449c-ba16-316de4b92a4e' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Role Types */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         'fb6f4556-8dd1-4b41-908f-d1f6ecafa20e',
         'MJ_BizApps_Collaboration: Space Role Types',
         'Space Role Types',
         'What a space member is allowed to do. The engine reads Level and the BIT flags. It never compares Code or Name.',
         NULL,
         'SpaceRoleType',
         'vwSpaceRoleTypes',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Role Types to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'fb6f4556-8dd1-4b41-908f-d1f6ecafa20e', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Role Types for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('fb6f4556-8dd1-4b41-908f-d1f6ecafa20e' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('fb6f4556-8dd1-4b41-908f-d1f6ecafa20e' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Role Types for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('fb6f4556-8dd1-4b41-908f-d1f6ecafa20e' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('fb6f4556-8dd1-4b41-908f-d1f6ecafa20e' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Role Types for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('fb6f4556-8dd1-4b41-908f-d1f6ecafa20e' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('fb6f4556-8dd1-4b41-908f-d1f6ecafa20e' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Spaces */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '3648dc35-1dc4-4ed6-a1a6-5d87271a54db',
         'MJ_BizApps_Collaboration: Spaces',
         'Spaces',
         'The container. Permission boundary and agent retrieval boundary, as a tree: one root per relationship, sub-spaces for the work inside it.',
         NULL,
         'Space',
         'vwSpaces',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Collaboration: Spaces to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '3648dc35-1dc4-4ed6-a1a6-5d87271a54db', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Spaces for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('3648dc35-1dc4-4ed6-a1a6-5d87271a54db' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('3648dc35-1dc4-4ed6-a1a6-5d87271a54db' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Spaces for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('3648dc35-1dc4-4ed6-a1a6-5d87271a54db' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('3648dc35-1dc4-4ed6-a1a6-5d87271a54db' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Spaces for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('3648dc35-1dc4-4ed6-a1a6-5d87271a54db' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('3648dc35-1dc4-4ed6-a1a6-5d87271a54db' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Items */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '41165fec-a52b-469a-a880-3b108c39a65e',
         'MJ_BizApps_Collaboration: Space Items',
         'Space Items',
         'An item in exactly one space: EntityID + RecordID, plus Team or Shared. Unique on (EntityID, RecordID) so an item cannot have two parents.',
         NULL,
         'SpaceItem',
         'vwSpaceItems',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Items to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '41165fec-a52b-469a-a880-3b108c39a65e', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Items for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('41165fec-a52b-469a-a880-3b108c39a65e' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('41165fec-a52b-469a-a880-3b108c39a65e' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Items for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('41165fec-a52b-469a-a880-3b108c39a65e' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('41165fec-a52b-469a-a880-3b108c39a65e' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Items for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('41165fec-a52b-469a-a880-3b108c39a65e' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('41165fec-a52b-469a-a880-3b108c39a65e' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Members */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         'bfeb0850-ab22-4dcc-b13c-b82dc998e23c',
         'MJ_BizApps_Collaboration: Space Members',
         'Space Members',
         'One roster row per user per space. Staff and outsiders are both MJ users. Status Active is the row the membership filter accepts.',
         NULL,
         'SpaceMember',
         'vwSpaceMembers',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Members to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'bfeb0850-ab22-4dcc-b13c-b82dc998e23c', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Members for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('bfeb0850-ab22-4dcc-b13c-b82dc998e23c' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('bfeb0850-ab22-4dcc-b13c-b82dc998e23c' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Members for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('bfeb0850-ab22-4dcc-b13c-b82dc998e23c' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('bfeb0850-ab22-4dcc-b13c-b82dc998e23c' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Members for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('bfeb0850-ab22-4dcc-b13c-b82dc998e23c' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('bfeb0850-ab22-4dcc-b13c-b82dc998e23c' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceType */
UPDATE [${flyway:defaultSchema}].[SpaceType] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceType___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceType */
UPDATE [${flyway:defaultSchema}].[SpaceType] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceType___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceItem */
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceItem */
UPDATE [${flyway:defaultSchema}].[SpaceItem] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceItem */
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceItem */
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceItem___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceItem */
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceItem */
UPDATE [${flyway:defaultSchema}].[SpaceItem] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceItem */
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceItem */
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceItem___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.Space */
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.Space */
UPDATE [${flyway:defaultSchema}].[Space] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.Space */
ALTER TABLE [${flyway:defaultSchema}].[Space] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.Space */
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_Space___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.Space */
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.Space */
UPDATE [${flyway:defaultSchema}].[Space] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.Space */
ALTER TABLE [${flyway:defaultSchema}].[Space] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.Space */
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_Space___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceMember */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceMember */
UPDATE [${flyway:defaultSchema}].[SpaceMember] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceMember */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceMember */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceMember___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceMember */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceMember */
UPDATE [${flyway:defaultSchema}].[SpaceMember] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceMember */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceMember */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceMember___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceRoleType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceRoleType */
UPDATE [${flyway:defaultSchema}].[SpaceRoleType] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceRoleType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceRoleType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceRoleType___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceRoleType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceRoleType */
UPDATE [${flyway:defaultSchema}].[SpaceRoleType] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceRoleType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceRoleType */
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceRoleType___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 64 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3a2eedb6-3fb0-49a2-ad53-7abbf5f1bb27' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '3a2eedb6-3fb0-49a2-ad53-7abbf5f1bb27',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newsequentialid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '255c898b-8ca4-4c6f-950f-46397676f60c' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'Code')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '255c898b-8ca4-4c6f-950f-46397676f60c',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'Code',
            'Code',
            'Stable metadata key. The engine does not branch on it.',
            'nvarchar',
            80,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '57bc4fee-a9e1-4d23-a11e-85ff6467b73b' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'Name')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '57bc4fee-a9e1-4d23-a11e-85ff6467b73b',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'Name',
            'Name',
            'Display name of the type.',
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            1,
            1,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b6b0763b-9bae-40df-a8cf-0a11581b2381' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'Description')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b6b0763b-9bae-40df-a8cf-0a11581b2381',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'Description',
            'Description',
            NULL,
            'nvarchar',
            -1,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '94ec3b15-e02d-4adb-8688-32c101f424ad' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'Vocabulary')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '94ec3b15-e02d-4adb-8688-32c101f424ad',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'Vocabulary',
            'Vocabulary',
            'Human noun for spaces of this type (workspace, committee, cohort, community). Open set.',
            'nvarchar',
            100,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7045ca4f-ef10-44c4-8f26-3a40537ade62' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'Discoverability')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '7045ca4f-ef10-44c4-8f26-3a40537ade62',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'Discoverability',
            'Discoverability',
            'Hidden, Listed, or Open. Modelled now; the community surface that uses Listed and Open is a later release.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'Hidden',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4c4411a3-6f7d-4e87-b1b9-3bdc84da253d' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'JoinMode')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '4c4411a3-6f7d-4e87-b1b9-3bdc84da253d',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'JoinMode',
            'Join Mode',
            'InviteOnly, RequestToJoin, or SelfServe.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'InviteOnly',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'dd81c48e-8571-4540-80b0-7c1b4e14205d' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'MessagingPanel')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'dd81c48e-8571-4540-80b0-7c1b4e14205d',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'MessagingPanel',
            'Messaging Panel',
            'Conversation panel is on for spaces of this type.',
            'bit',
            1,
            1,
            0,
            0,
            '(1)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b7d2a463-439e-4bea-9293-c71b3678fc12' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'LibraryPanel')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b7d2a463-439e-4bea-9293-c71b3678fc12',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'LibraryPanel',
            'Library Panel',
            'File library panel is on.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b600313c-b4fc-46f6-8086-b0e8946bed2b' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'WorkPanel')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b600313c-b4fc-46f6-8086-b0e8946bed2b',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'WorkPanel',
            'Work Panel',
            'Task / work panel is on.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fc00aadd-d4c8-47eb-8983-c5c2dbebd388' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'GovernancePanel')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'fc00aadd-d4c8-47eb-8983-c5c2dbebd388',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'GovernancePanel',
            'Governance Panel',
            'Governance panel is on. Committees still owns motions and ballots; this only says the panel is part of the type.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5139c686-d6b3-4195-8df4-d639f4edd2f8' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'DefaultRetention')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '5139c686-d6b3-4195-8df4-d639f4edd2f8',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'DefaultRetention',
            'Default Retention',
            'Month, Year, or Indefinite. Used when the space itself has no Retention.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'Indefinite',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a547e641-f873-405e-8b16-889981dfe331' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'DefaultAgentRetrieval')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'a547e641-f873-405e-8b16-889981dfe331',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'DefaultAgentRetrieval',
            'Default Agent Retrieval',
            'Default AgentRetrieval for a new space of this type.',
            'nvarchar',
            60,
            0,
            0,
            0,
            'Included',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f8cef3b6-e595-4b00-848a-0467c4dd4c49' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'DefaultBand')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'f8cef3b6-e595-4b00-848a-0467c4dd4c49',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'DefaultBand',
            'Default Band',
            'Default Team or Shared band for a new item in a space of this type.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'Team',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1bc5fcab-db51-4294-b2a4-8bdefe49a9a5' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'InviteApproval')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1bc5fcab-db51-4294-b2a4-8bdefe49a9a5',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'InviteApproval',
            'Invite Approval',
            'Approve: a new member stays Invited until someone accepts them. AutoApprove: the server may create the member Active.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'Approve',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '19fa067b-221a-4655-ba4a-80044bb42a09' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'MemberCap')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '19fa067b-221a-4655-ba4a-80044bb42a09',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'MemberCap',
            'Member Cap',
            'Maximum members in one space of this type. Null means no cap.',
            'int',
            4,
            10,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a1d85470-dee9-400c-923a-613d23f4854b' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'DisplayRank')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'a1d85470-dee9-400c-923a-613d23f4854b',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'DisplayRank',
            'Display Rank',
            NULL,
            'int',
            4,
            10,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '534741d7-3d2f-4d0d-8dbb-b97cb3e1c887' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'IsActive')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '534741d7-3d2f-4d0d-8dbb-b97cb3e1c887',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'IsActive',
            'Is Active',
            NULL,
            'bit',
            1,
            1,
            0,
            0,
            '(1)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3cd76cf7-79b9-45a9-ba54-a006cc435106' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '3cd76cf7-79b9-45a9-ba54-a006cc435106',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4ed5c2c3-2b54-453b-ab3d-a179fb7b4f24' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '4ed5c2c3-2b54-453b-ab3d-a179fb7b4f24',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'da6ff4eb-d3d4-4f9d-9853-0473a63aa885' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'da6ff4eb-d3d4-4f9d-9853-0473a63aa885',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newsequentialid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fdf9d0d3-4c4c-4fdb-aa2e-653007e2402e' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'SpaceID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'fdf9d0d3-4c4c-4fdb-aa2e-653007e2402e',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'SpaceID',
            'Space ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '40b833d2-7d75-40e6-8405-6020a3238046' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'EntityID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '40b833d2-7d75-40e6-8405-6020a3238046',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'EntityID',
            'Entity ID',
            'The entity the item points at. Same polymorphic pair TaskLink uses.',
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            'E0238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '59a6af00-0046-441a-80cf-4b743ba8a8d1' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'RecordID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '59a6af00-0046-441a-80cf-4b743ba8a8d1',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'RecordID',
            'Record ID',
            'Primary key of the pointed-at record, as text, matching TaskLink.RecordID.',
            'nvarchar',
            900,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd82e6f1a-36f5-4f28-ba68-bced57f9e8b5' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'Band')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'd82e6f1a-36f5-4f28-ba68-bced57f9e8b5',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'Band',
            'Band',
            'Team (working material, not in the client-facing agent scope) or Shared (promoted, with an actor and a timestamp).',
            'nvarchar',
            40,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6a284d7e-37b3-4a5f-8aaf-e05e9aef26a0' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'PromotedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6a284d7e-37b3-4a5f-8aaf-e05e9aef26a0',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'PromotedAt',
            'Promoted At',
            'When a Shared item was promoted. Null on Team items.',
            'datetimeoffset',
            10,
            34,
            7,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '311ef033-bf80-43b2-8bbb-7313d717f872' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'PromotedByUserID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '311ef033-bf80-43b2-8bbb-7313d717f872',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'PromotedByUserID',
            'Promoted By User ID',
            'MJ user who promoted a Shared item. Required together with PromotedAt. Null on Team items.',
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            'E1238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '288432cc-18b5-49bb-afcf-9b9c8535bb7f' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '288432cc-18b5-49bb-afcf-9b9c8535bb7f',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6545b3fe-8db0-41dd-a005-a9e0d3898f36' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6545b3fe-8db0-41dd-a005-a9e0d3898f36',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2b846791-1e9f-4d9a-a270-071f9da35b86' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '2b846791-1e9f-4d9a-a270-071f9da35b86',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newsequentialid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '63d37354-8fc7-4262-b12e-3a7929a14519' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'SpaceTypeID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '63d37354-8fc7-4262-b12e-3a7929a14519',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'SpaceTypeID',
            'Space Type ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            '01596359-EC4B-449C-BA16-316DE4B92A4E',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5948f19f-70aa-49f4-bb6b-1fb059507477' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'ParentID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '5948f19f-70aa-49f4-bb6b-1fb059507477',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'ParentID',
            'Parent ID',
            'Parent space. Null on the perpetual root. Self-reference is the hierarchy key CodeGen marks IsHierarchy.',
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f3fdc584-1fcb-4938-89d7-94e599227fb8' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'Name')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'f3fdc584-1fcb-4938-89d7-94e599227fb8',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'Name',
            'Name',
            'Designated name of the space.',
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            1,
            1,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8edb58b7-9b4b-4437-831a-ee18f11a9bd3' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'Description')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '8edb58b7-9b4b-4437-831a-ee18f11a9bd3',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'Description',
            'Description',
            NULL,
            'nvarchar',
            -1,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '99904068-14a3-4618-b955-20ca18ee5047' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'OwnerID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '99904068-14a3-4618-b955-20ca18ee5047',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'OwnerID',
            'Owner ID',
            'MJ user who owns the space.',
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            'E1238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4038216f-69b6-4a90-bc29-d77515d14210' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'InheritsMembership')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '4038216f-69b6-4a90-bc29-d77515d14210',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'InheritsMembership',
            'Inherits Membership',
            '1: members of this space are members of its descendants. 0: this sub-space keeps its own roster.',
            'bit',
            1,
            1,
            0,
            0,
            '(1)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6ecc450c-640c-4f79-94d9-641aa433d358' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'AgentRetrieval')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6ecc450c-640c-4f79-94d9-641aa433d358',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'AgentRetrieval',
            'Agent Retrieval',
            'Included, ExcludedFromParentScope, or ExcludedEntirely. A human may read a space that no agent may quote.',
            'nvarchar',
            60,
            0,
            0,
            0,
            'Included',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e5152c24-1404-463b-a225-fd0609686658' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'StartedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'e5152c24-1404-463b-a225-fd0609686658',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'StartedAt',
            'Started At',
            'When this space (usually a sub-space) started. The root outlives its children.',
            'datetimeoffset',
            10,
            34,
            7,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b7f653a4-25c5-4b2b-9ab6-7c79affa8ac0' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'ClosedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b7f653a4-25c5-4b2b-9ab6-7c79affa8ac0',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'ClosedAt',
            'Closed At',
            'When this space closed. Closure is a timestamp on the sub-space, not a delete of the root.',
            'datetimeoffset',
            10,
            34,
            7,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9af06829-c0fc-4c84-8d01-bc328fc32b5f' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'Retention')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '9af06829-c0fc-4c84-8d01-bc328fc32b5f',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'Retention',
            'Retention',
            'Month, Year, or Indefinite. Null uses SpaceType.DefaultRetention.',
            'nvarchar',
            40,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '067ebb18-4cd5-4f21-9036-ee3a45b00138' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '067ebb18-4cd5-4f21-9036-ee3a45b00138',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7bc7fefb-fb4b-4a9d-ad0c-b19bec58d68e' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '7bc7fefb-fb4b-4a9d-ad0c-b19bec58d68e',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4aafff81-8843-40b3-bd77-47bd577d1662' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '4aafff81-8843-40b3-bd77-47bd577d1662',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newsequentialid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6e6e95cd-f6a2-47e0-8945-0ae5f9b02913' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'SpaceID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6e6e95cd-f6a2-47e0-8945-0ae5f9b02913',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'SpaceID',
            'Space ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6a25c49e-8466-428c-889d-6fcb7b48ecfe' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'UserID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6a25c49e-8466-428c-889d-6fcb7b48ecfe',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'UserID',
            'User ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            'E1238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '508d368e-aef1-4ffa-83dc-962109380754' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'SpaceRoleTypeID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '508d368e-aef1-4ffa-83dc-962109380754',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'SpaceRoleTypeID',
            'Space Role Type ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '17968f2e-12cb-4ffe-91a5-caad3446a8f6' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'Band')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '17968f2e-12cb-4ffe-91a5-caad3446a8f6',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'Band',
            'Band',
            'Team or Shared. Which side of the space this person sits on.',
            'nvarchar',
            40,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0e14cf05-6787-4c37-88d8-25c8d644436c' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'Status')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '0e14cf05-6787-4c37-88d8-25c8d644436c',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'Status',
            'Status',
            'Invited, Active, or Removed. New rows start Invited unless the type auto-approves.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'Invited',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1f20e1fb-18b2-4473-8889-e0e01cdc5fc2' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1f20e1fb-18b2-4473-8889-e0e01cdc5fc2',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e0cfd740-4d68-47fe-9ea5-cbacf8a0de60' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'e0cfd740-4d68-47fe-9ea5-cbacf8a0de60',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3c16bf1b-daa7-4cdf-9453-f94f75aa471b' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '3c16bf1b-daa7-4cdf-9453-f94f75aa471b',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newsequentialid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1b1a2dd3-1307-41e3-9990-97e7870b3ad5' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'Code')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1b1a2dd3-1307-41e3-9990-97e7870b3ad5',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'Code',
            'Code',
            NULL,
            'nvarchar',
            80,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7f8901b2-3230-4588-ae73-c8cc42ae4a3a' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'Name')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '7f8901b2-3230-4588-ae73-c8cc42ae4a3a',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'Name',
            'Name',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            1,
            1,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a1577c7f-daf5-4a59-ac60-bd0d182183ea' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'Description')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'a1577c7f-daf5-4a59-ac60-bd0d182183ea',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'Description',
            'Description',
            NULL,
            'nvarchar',
            -1,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '27b95589-9ee5-4dab-8b95-431e8b6e4777' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'Level')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '27b95589-9ee5-4dab-8b95-431e8b6e4777',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'Level',
            'Level',
            'This role''s own authority. A grant must be of a role whose Level is <= the grantor''s MaxGrantableLevel.',
            'int',
            4,
            10,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c4c972a0-f26f-4232-969e-3ceefc863890' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'MaxGrantableLevel')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'c4c972a0-f26f-4232-969e-3ceefc863890',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'MaxGrantableLevel',
            'Max Grantable Level',
            'Highest Level this role may grant. Always <= Level.',
            'int',
            4,
            10,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c1845a5f-a347-4b3e-81bc-78cb0778725b' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'CanInvite')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'c1845a5f-a347-4b3e-81bc-78cb0778725b',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'CanInvite',
            'Can Invite',
            'Holder may invite members into a space they belong to, inside their own subtree, at or below MaxGrantableLevel.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3f72f228-1233-4a6a-9757-f00d2f4cd4db' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'CanPromoteBand')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '3f72f228-1233-4a6a-9757-f00d2f4cd4db',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'CanPromoteBand',
            'Can Promote Band',
            'Holder may move an item from Team to Shared.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fe35df41-d4a5-41a0-8fe8-40a46c0d1604' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'CanSeeTeamBand')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'fe35df41-d4a5-41a0-8fe8-40a46c0d1604',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'CanSeeTeamBand',
            'Can See Team Band',
            'Holder may read Team-band items. Shared-band items do not need this flag.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '00b28aa0-7ea1-475f-884e-290c343ed157' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'IsOwnerRole')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '00b28aa0-7ea1-475f-884e-290c343ed157',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'IsOwnerRole',
            'Is Owner Role',
            'The role that defines ownership of a space. The engine reads the flag, not the name.',
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '01a1dfd4-b646-4fa4-9aa0-aad95df9a1ef' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'DisplayRank')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '01a1dfd4-b646-4fa4-9aa0-aad95df9a1ef',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'DisplayRank',
            'Display Rank',
            NULL,
            'int',
            4,
            10,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8917cecd-eed0-4550-8194-91db34912aba' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = 'IsActive')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '8917cecd-eed0-4550-8194-91db34912aba',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            'IsActive',
            'Is Active',
            NULL,
            'bit',
            1,
            1,
            0,
            0,
            '(1)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1122ab24-7770-49c7-8e96-59e465938bae' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1122ab24-7770-49c7-8e96-59e465938bae',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd19ba4bc-c478-41a7-862b-9fcd9fa77829' OR (EntityID = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'd19ba4bc-c478-41a7-862b-9fcd9fa77829',
            'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', -- Entity: MJ_BizApps_Collaboration: Space Role Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert entity field value with ID 05accd79-d34a-44ee-ac5a-f2fad89175fa */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('05accd79-d34a-44ee-ac5a-f2fad89175fa', '6ECC450C-640C-4F79-94D9-641AA433D358', 1, 'ExcludedEntirely', 'ExcludedEntirely', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 49d441f6-3828-44ff-b389-51933bfb7fa4 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('49d441f6-3828-44ff-b389-51933bfb7fa4', '6ECC450C-640C-4F79-94D9-641AA433D358', 2, 'ExcludedFromParentScope', 'ExcludedFromParentScope', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID de02fffd-5847-4641-a3b2-1312d6dec043 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('de02fffd-5847-4641-a3b2-1312d6dec043', '6ECC450C-640C-4F79-94D9-641AA433D358', 3, 'Included', 'Included', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 6ECC450C-640C-4F79-94D9-641AA433D358 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='6ECC450C-640C-4F79-94D9-641AA433D358';

/* SQL text to insert entity field value with ID e626f6d9-4510-4be9-b350-9934a8cc0169 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('e626f6d9-4510-4be9-b350-9934a8cc0169', '9AF06829-C0FC-4C84-8D01-BC328FC32B5F', 1, 'Indefinite', 'Indefinite', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 166094ab-8079-4ee4-a3ae-0efc085b9368 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('166094ab-8079-4ee4-a3ae-0efc085b9368', '9AF06829-C0FC-4C84-8D01-BC328FC32B5F', 2, 'Month', 'Month', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID adb5876a-cf3b-425e-8038-5d50a7c96730 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('adb5876a-cf3b-425e-8038-5d50a7c96730', '9AF06829-C0FC-4C84-8D01-BC328FC32B5F', 3, 'Year', 'Year', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 9AF06829-C0FC-4C84-8D01-BC328FC32B5F */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='9AF06829-C0FC-4C84-8D01-BC328FC32B5F';

/* SQL text to insert entity field value with ID be024823-010f-4513-851f-b25954b79067 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('be024823-010f-4513-851f-b25954b79067', '17968F2E-12CB-4FFE-91A5-CAAD3446A8F6', 1, 'Shared', 'Shared', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 97f7f262-104a-4089-830e-5a56da505751 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('97f7f262-104a-4089-830e-5a56da505751', '17968F2E-12CB-4FFE-91A5-CAAD3446A8F6', 2, 'Team', 'Team', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 17968F2E-12CB-4FFE-91A5-CAAD3446A8F6 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='17968F2E-12CB-4FFE-91A5-CAAD3446A8F6';

/* SQL text to insert entity field value with ID dd2dced3-d1e3-45ac-b4d8-7eae7b4e28c7 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('dd2dced3-d1e3-45ac-b4d8-7eae7b4e28c7', '0E14CF05-6787-4C37-88D8-25C8D644436C', 1, 'Active', 'Active', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 4f93c090-e122-4983-b84e-ef6aabdcefd7 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('4f93c090-e122-4983-b84e-ef6aabdcefd7', '0E14CF05-6787-4C37-88D8-25C8D644436C', 2, 'Invited', 'Invited', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 46ab90e4-8034-4daa-b4a2-d8cfaafc0c2a */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('46ab90e4-8034-4daa-b4a2-d8cfaafc0c2a', '0E14CF05-6787-4C37-88D8-25C8D644436C', 3, 'Removed', 'Removed', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 0E14CF05-6787-4C37-88D8-25C8D644436C */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='0E14CF05-6787-4C37-88D8-25C8D644436C';

/* SQL text to insert entity field value with ID d1069379-1134-4120-b478-3e17f1cdde26 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('d1069379-1134-4120-b478-3e17f1cdde26', 'D82E6F1A-36F5-4F28-BA68-BCED57F9E8B5', 1, 'Shared', 'Shared', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 89b90d19-e3e0-4796-905d-60b63371c474 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('89b90d19-e3e0-4796-905d-60b63371c474', 'D82E6F1A-36F5-4F28-BA68-BCED57F9E8B5', 2, 'Team', 'Team', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID D82E6F1A-36F5-4F28-BA68-BCED57F9E8B5 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='D82E6F1A-36F5-4F28-BA68-BCED57F9E8B5';

/* SQL text to insert entity field value with ID 20bad76a-ed31-4549-8a0c-f2ce6c7fcf23 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('20bad76a-ed31-4549-8a0c-f2ce6c7fcf23', '7045CA4F-EF10-44C4-8F26-3A40537ADE62', 1, 'Hidden', 'Hidden', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID cf89f66a-1074-4f4d-91cd-036dd5c952c4 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('cf89f66a-1074-4f4d-91cd-036dd5c952c4', '7045CA4F-EF10-44C4-8F26-3A40537ADE62', 2, 'Listed', 'Listed', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 903ff30b-3218-499f-9d98-e75626fa3426 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('903ff30b-3218-499f-9d98-e75626fa3426', '7045CA4F-EF10-44C4-8F26-3A40537ADE62', 3, 'Open', 'Open', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 7045CA4F-EF10-44C4-8F26-3A40537ADE62 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='7045CA4F-EF10-44C4-8F26-3A40537ADE62';

/* SQL text to insert entity field value with ID b1e149ba-553b-4aae-9cda-98c4e98927e3 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('b1e149ba-553b-4aae-9cda-98c4e98927e3', '4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D', 1, 'InviteOnly', 'InviteOnly', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 4d3cd44a-adf4-4067-a777-9921a839d7d0 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('4d3cd44a-adf4-4067-a777-9921a839d7d0', '4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D', 2, 'RequestToJoin', 'RequestToJoin', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 0ae5193e-3223-40f5-a825-cd837ac68ea6 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('0ae5193e-3223-40f5-a825-cd837ac68ea6', '4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D', 3, 'SelfServe', 'SelfServe', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D';

/* SQL text to insert entity field value with ID 6c75fb1d-c80d-4a7a-bc54-d115d592f8ca */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('6c75fb1d-c80d-4a7a-bc54-d115d592f8ca', '5139C686-D6B3-4195-8DF4-D639F4EDD2F8', 1, 'Indefinite', 'Indefinite', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID d45731f7-ab8e-4867-99f5-7d642f53f5a2 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('d45731f7-ab8e-4867-99f5-7d642f53f5a2', '5139C686-D6B3-4195-8DF4-D639F4EDD2F8', 2, 'Month', 'Month', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID fdbbbcc8-033c-4b9d-a1fd-941fe56a145d */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('fdbbbcc8-033c-4b9d-a1fd-941fe56a145d', '5139C686-D6B3-4195-8DF4-D639F4EDD2F8', 3, 'Year', 'Year', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 5139C686-D6B3-4195-8DF4-D639F4EDD2F8 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='5139C686-D6B3-4195-8DF4-D639F4EDD2F8';

/* SQL text to insert entity field value with ID 42ceab23-c947-4112-9b4a-d7e70b45a591 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('42ceab23-c947-4112-9b4a-d7e70b45a591', 'A547E641-F873-405E-8B16-889981DFE331', 1, 'ExcludedEntirely', 'ExcludedEntirely', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID a67d88ac-5b9a-4fff-91c3-5a984bab3040 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('a67d88ac-5b9a-4fff-91c3-5a984bab3040', 'A547E641-F873-405E-8B16-889981DFE331', 2, 'ExcludedFromParentScope', 'ExcludedFromParentScope', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID a6d206e6-69f3-4d42-a420-b2ef35c7733e */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('a6d206e6-69f3-4d42-a420-b2ef35c7733e', 'A547E641-F873-405E-8B16-889981DFE331', 3, 'Included', 'Included', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID A547E641-F873-405E-8B16-889981DFE331 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='A547E641-F873-405E-8B16-889981DFE331';

/* SQL text to insert entity field value with ID 211465b8-9586-44b6-bf49-c70a1703d4ed */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('211465b8-9586-44b6-bf49-c70a1703d4ed', 'F8CEF3B6-E595-4B00-848A-0467C4DD4C49', 1, 'Shared', 'Shared', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 26e7b763-87fe-4c44-a45d-03a609b4582d */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('26e7b763-87fe-4c44-a45d-03a609b4582d', 'F8CEF3B6-E595-4B00-848A-0467C4DD4C49', 2, 'Team', 'Team', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID F8CEF3B6-E595-4B00-848A-0467C4DD4C49 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='F8CEF3B6-E595-4B00-848A-0467C4DD4C49';

/* SQL text to insert entity field value with ID a5058dd6-83a3-4ac1-8c45-57e91a75480f */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('a5058dd6-83a3-4ac1-8c45-57e91a75480f', '1BC5FCAB-DB51-4294-B2A4-8BDEFE49A9A5', 1, 'Approve', 'Approve', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 3724b52e-d4bb-4533-8b63-9b99f4e2570b */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('3724b52e-d4bb-4533-8b63-9b99f4e2570b', '1BC5FCAB-DB51-4294-B2A4-8BDEFE49A9A5', 2, 'AutoApprove', 'AutoApprove', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 1BC5FCAB-DB51-4294-B2A4-8BDEFE49A9A5 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='1BC5FCAB-DB51-4294-B2A4-8BDEFE49A9A5';


/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Types -> MJ_BizApps_Collaboration: Spaces (One To Many via SpaceTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '9da4261f-e0aa-47a5-8dbb-d89de2fd939c'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('9da4261f-e0aa-47a5-8dbb-d89de2fd939c', '01596359-EC4B-449C-BA16-316DE4B92A4E', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'SpaceTypeID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Items (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '319a7fbb-dcf5-4491-b08e-3eb9bef3569b'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('319a7fbb-dcf5-4491-b08e-3eb9bef3569b', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', '41165FEC-A52B-469A-A880-3B108C39A65E', 'SpaceID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Spaces (One To Many via ParentID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '8d0b863f-7f69-4887-a692-93a66d9fb0b2'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('8d0b863f-7f69-4887-a692-93a66d9fb0b2', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'ParentID', 'One To Many', 1, 1, 2, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Members (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '9c37dbba-d86f-4ce0-8c1c-aec1d45b1ae7'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('9c37dbba-d86f-4ce0-8c1c-aec1d45b1ae7', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 'SpaceID', 'One To Many', 1, 1, 3, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Entities -> MJ_BizApps_Collaboration: Space Items (One To Many via EntityID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '782ff87d-1042-4a08-beef-85c9c19fa6b9'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('782ff87d-1042-4a08-beef-85c9c19fa6b9', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '41165FEC-A52B-469A-A880-3B108C39A65E', 'EntityID', 'One To Many', 1, 1, 96, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Collaboration: Space Items (One To Many via PromotedByUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'abbc54b5-939e-45ff-bd43-28b063e91168'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('abbc54b5-939e-45ff-bd43-28b063e91168', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', '41165FEC-A52B-469A-A880-3B108C39A65E', 'PromotedByUserID', 'One To Many', 1, 1, 121, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Collaboration: Spaces (One To Many via OwnerID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '35bd12e3-6e2f-48f3-b04d-fe69de208311'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('35bd12e3-6e2f-48f3-b04d-fe69de208311', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'OwnerID', 'One To Many', 1, 1, 122, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Collaboration: Space Members (One To Many via UserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'de5bb078-299a-4b13-95e8-7a3cead6e0aa'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('de5bb078-299a-4b13-95e8-7a3cead6e0aa', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 'UserID', 'One To Many', 1, 1, 123, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Role Types -> MJ_BizApps_Collaboration: Space Members (One To Many via SpaceRoleTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'ea35ecaa-dbae-4ae6-9e55-2e3df1d640cf'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('ea35ecaa-dbae-4ae6-9e55-2e3df1d640cf', 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 'SpaceRoleTypeID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for SpaceItem */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Items
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table SpaceItem
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceItem_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceItem]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceItem_SpaceID ON [${flyway:defaultSchema}].[SpaceItem] ([SpaceID]);

-- Index for foreign key EntityID in table SpaceItem
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceItem_EntityID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceItem]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceItem_EntityID ON [${flyway:defaultSchema}].[SpaceItem] ([EntityID]);

-- Index for foreign key PromotedByUserID in table SpaceItem
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceItem_PromotedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceItem]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceItem_PromotedByUserID ON [${flyway:defaultSchema}].[SpaceItem] ([PromotedByUserID]);

/* SQL text to update entity field related entity name field map for entity field ID FDF9D0D3-4C4C-4FDB-AA2E-653007E2402E */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='FDF9D0D3-4C4C-4FDB-AA2E-653007E2402E', @RelatedEntityNameFieldMap='Space';

/* Index for Foreign Keys for SpaceMember */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table SpaceMember
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMember_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMember]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMember_SpaceID ON [${flyway:defaultSchema}].[SpaceMember] ([SpaceID]);

-- Index for foreign key UserID in table SpaceMember
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMember_UserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMember]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMember_UserID ON [${flyway:defaultSchema}].[SpaceMember] ([UserID]);

-- Index for foreign key SpaceRoleTypeID in table SpaceMember
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMember_SpaceRoleTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMember]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMember_SpaceRoleTypeID ON [${flyway:defaultSchema}].[SpaceMember] ([SpaceRoleTypeID]);

/* SQL text to update entity field related entity name field map for entity field ID 6E6E95CD-F6A2-47E0-8945-0AE5F9B02913 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='6E6E95CD-F6A2-47E0-8945-0AE5F9B02913', @RelatedEntityNameFieldMap='Space';

/* Index for Foreign Keys for SpaceRoleType */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Role Types
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Index for Foreign Keys for SpaceType */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Index for Foreign Keys for Space */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceTypeID in table Space
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Space_SpaceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Space]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Space_SpaceTypeID ON [${flyway:defaultSchema}].[Space] ([SpaceTypeID]);

-- Index for foreign key ParentID in table Space
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Space_ParentID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Space]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Space_ParentID ON [${flyway:defaultSchema}].[Space] ([ParentID]);

-- Index for foreign key OwnerID in table Space
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Space_OwnerID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Space]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Space_OwnerID ON [${flyway:defaultSchema}].[Space] ([OwnerID]);

/* SQL text to update entity field related entity name field map for entity field ID 63D37354-8FC7-4262-B12E-3A7929A14519 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='63D37354-8FC7-4262-B12E-3A7929A14519', @RelatedEntityNameFieldMap='SpaceType';

/* Base View SQL for MJ_BizApps_Collaboration: Space Role Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Role Types
-- Item: vwSpaceRoleTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Role Types
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceRoleType
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceRoleTypes]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceRoleTypes];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceRoleTypes]
AS
SELECT
    s.*
FROM
    [${flyway:defaultSchema}].[SpaceRoleType] AS s
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceRoleTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Role Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Role Types
-- Item: Permissions for vwSpaceRoleTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceRoleTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Role Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Role Types
-- Item: spCreateSpaceRoleType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceRoleType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceRoleType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceRoleType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceRoleType]
    @ID uniqueidentifier = NULL,
    @Code nvarchar(40),
    @Name nvarchar(200),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Level int,
    @MaxGrantableLevel int,
    @CanInvite bit = NULL,
    @CanPromoteBand bit = NULL,
    @CanSeeTeamBand bit = NULL,
    @IsOwnerRole bit = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceRoleType]
            (
                [ID],
                [Code],
                [Name],
                [Description],
                [Level],
                [MaxGrantableLevel],
                [CanInvite],
                [CanPromoteBand],
                [CanSeeTeamBand],
                [IsOwnerRole],
                [DisplayRank],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @Level,
                @MaxGrantableLevel,
                ISNULL(@CanInvite, 0),
                ISNULL(@CanPromoteBand, 0),
                ISNULL(@CanSeeTeamBand, 0),
                ISNULL(@IsOwnerRole, 0),
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceRoleType]
            (
                [Code],
                [Name],
                [Description],
                [Level],
                [MaxGrantableLevel],
                [CanInvite],
                [CanPromoteBand],
                [CanSeeTeamBand],
                [IsOwnerRole],
                [DisplayRank],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @Level,
                @MaxGrantableLevel,
                ISNULL(@CanInvite, 0),
                ISNULL(@CanPromoteBand, 0),
                ISNULL(@CanSeeTeamBand, 0),
                ISNULL(@IsOwnerRole, 0),
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceRoleTypes] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceRoleType] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Role Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceRoleType] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Role Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Role Types
-- Item: spUpdateSpaceRoleType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceRoleType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceRoleType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceRoleType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceRoleType]
    @ID uniqueidentifier,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(200) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Level int = NULL,
    @MaxGrantableLevel int = NULL,
    @CanInvite bit = NULL,
    @CanPromoteBand bit = NULL,
    @CanSeeTeamBand bit = NULL,
    @IsOwnerRole bit = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceRoleType]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [Level] = ISNULL(@Level, [Level]),
        [MaxGrantableLevel] = ISNULL(@MaxGrantableLevel, [MaxGrantableLevel]),
        [CanInvite] = ISNULL(@CanInvite, [CanInvite]),
        [CanPromoteBand] = ISNULL(@CanPromoteBand, [CanPromoteBand]),
        [CanSeeTeamBand] = ISNULL(@CanSeeTeamBand, [CanSeeTeamBand]),
        [IsOwnerRole] = ISNULL(@IsOwnerRole, [IsOwnerRole]),
        [DisplayRank] = ISNULL(@DisplayRank, [DisplayRank]),
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceRoleTypes] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceRoleTypes]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceRoleType] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceRoleType table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceRoleType]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceRoleType];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceRoleType
ON [${flyway:defaultSchema}].[SpaceRoleType]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceRoleType]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceRoleType] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Role Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceRoleType] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: vwSpaceTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Types
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceType
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceTypes]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceTypes];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceTypes]
AS
SELECT
    s.*
FROM
    [${flyway:defaultSchema}].[SpaceType] AS s
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: Permissions for vwSpaceTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: spCreateSpaceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceType]
    @ID uniqueidentifier = NULL,
    @Code nvarchar(40),
    @Name nvarchar(200),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Vocabulary nvarchar(50),
    @Discoverability nvarchar(20) = NULL,
    @JoinMode nvarchar(20) = NULL,
    @MessagingPanel bit = NULL,
    @LibraryPanel bit = NULL,
    @WorkPanel bit = NULL,
    @GovernancePanel bit = NULL,
    @DefaultRetention nvarchar(20) = NULL,
    @DefaultAgentRetrieval nvarchar(30) = NULL,
    @DefaultBand nvarchar(20) = NULL,
    @InviteApproval nvarchar(20) = NULL,
    @MemberCap_Clear bit = 0,
    @MemberCap int = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceType]
            (
                [ID],
                [Code],
                [Name],
                [Description],
                [Vocabulary],
                [Discoverability],
                [JoinMode],
                [MessagingPanel],
                [LibraryPanel],
                [WorkPanel],
                [GovernancePanel],
                [DefaultRetention],
                [DefaultAgentRetrieval],
                [DefaultBand],
                [InviteApproval],
                [MemberCap],
                [DisplayRank],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @Vocabulary,
                ISNULL(@Discoverability, 'Hidden'),
                ISNULL(@JoinMode, 'InviteOnly'),
                ISNULL(@MessagingPanel, 1),
                ISNULL(@LibraryPanel, 0),
                ISNULL(@WorkPanel, 0),
                ISNULL(@GovernancePanel, 0),
                ISNULL(@DefaultRetention, 'Indefinite'),
                ISNULL(@DefaultAgentRetrieval, 'Included'),
                ISNULL(@DefaultBand, 'Team'),
                ISNULL(@InviteApproval, 'Approve'),
                CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, NULL) END,
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceType]
            (
                [Code],
                [Name],
                [Description],
                [Vocabulary],
                [Discoverability],
                [JoinMode],
                [MessagingPanel],
                [LibraryPanel],
                [WorkPanel],
                [GovernancePanel],
                [DefaultRetention],
                [DefaultAgentRetrieval],
                [DefaultBand],
                [InviteApproval],
                [MemberCap],
                [DisplayRank],
                [IsActive]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @Vocabulary,
                ISNULL(@Discoverability, 'Hidden'),
                ISNULL(@JoinMode, 'InviteOnly'),
                ISNULL(@MessagingPanel, 1),
                ISNULL(@LibraryPanel, 0),
                ISNULL(@WorkPanel, 0),
                ISNULL(@GovernancePanel, 0),
                ISNULL(@DefaultRetention, 'Indefinite'),
                ISNULL(@DefaultAgentRetrieval, 'Included'),
                ISNULL(@DefaultBand, 'Team'),
                ISNULL(@InviteApproval, 'Approve'),
                CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, NULL) END,
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceTypes] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: spUpdateSpaceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceType]
    @ID uniqueidentifier,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(200) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Vocabulary nvarchar(50) = NULL,
    @Discoverability nvarchar(20) = NULL,
    @JoinMode nvarchar(20) = NULL,
    @MessagingPanel bit = NULL,
    @LibraryPanel bit = NULL,
    @WorkPanel bit = NULL,
    @GovernancePanel bit = NULL,
    @DefaultRetention nvarchar(20) = NULL,
    @DefaultAgentRetrieval nvarchar(30) = NULL,
    @DefaultBand nvarchar(20) = NULL,
    @InviteApproval nvarchar(20) = NULL,
    @MemberCap_Clear bit = 0,
    @MemberCap int = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceType]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [Vocabulary] = ISNULL(@Vocabulary, [Vocabulary]),
        [Discoverability] = ISNULL(@Discoverability, [Discoverability]),
        [JoinMode] = ISNULL(@JoinMode, [JoinMode]),
        [MessagingPanel] = ISNULL(@MessagingPanel, [MessagingPanel]),
        [LibraryPanel] = ISNULL(@LibraryPanel, [LibraryPanel]),
        [WorkPanel] = ISNULL(@WorkPanel, [WorkPanel]),
        [GovernancePanel] = ISNULL(@GovernancePanel, [GovernancePanel]),
        [DefaultRetention] = ISNULL(@DefaultRetention, [DefaultRetention]),
        [DefaultAgentRetrieval] = ISNULL(@DefaultAgentRetrieval, [DefaultAgentRetrieval]),
        [DefaultBand] = ISNULL(@DefaultBand, [DefaultBand]),
        [InviteApproval] = ISNULL(@InviteApproval, [InviteApproval]),
        [MemberCap] = CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, [MemberCap]) END,
        [DisplayRank] = ISNULL(@DisplayRank, [DisplayRank]),
        [IsActive] = ISNULL(@IsActive, [IsActive])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceTypes] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceTypes]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceType table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceType]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceType];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceType
ON [${flyway:defaultSchema}].[SpaceType]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceType]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceType] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Role Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Role Types
-- Item: spDeleteSpaceRoleType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceRoleType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceRoleType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceRoleType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceRoleType]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceRoleType]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceRoleType] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Role Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceRoleType] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: spDeleteSpaceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceType
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceType]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceType]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Types */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update entity field related entity name field map for entity field ID 6A25C49E-8466-428C-889D-6FCB7B48ECFE */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='6A25C49E-8466-428C-889D-6FCB7B48ECFE', @RelatedEntityNameFieldMap='User';

/* SQL text to update entity field related entity name field map for entity field ID 40B833D2-7D75-40E6-8405-6020A3238046 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='40B833D2-7D75-40E6-8405-6020A3238046', @RelatedEntityNameFieldMap='Entity';

/* SQL text to update entity field related entity name field map for entity field ID 5948F19F-70AA-49F4-BB6B-1FB059507477 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='5948F19F-70AA-49F4-BB6B-1FB059507477', @RelatedEntityNameFieldMap='Parent';

/* SQL text to update entity field related entity name field map for entity field ID 311EF033-BF80-43B2-8BBB-7313D717F872 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='311EF033-BF80-43B2-8BBB-7313D717F872', @RelatedEntityNameFieldMap='PromotedByUser';

/* SQL text to update entity field related entity name field map for entity field ID 99904068-14A3-4618-B955-20CA18EE5047 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='99904068-14A3-4618-B955-20CA18EE5047', @RelatedEntityNameFieldMap='Owner';

/* SQL text to update entity field related entity name field map for entity field ID 508D368E-AEF1-4FFA-83DC-962109380754 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='508D368E-AEF1-4FFA-83DC-962109380754', @RelatedEntityNameFieldMap='SpaceRoleType';

/* Base View SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: vwSpaceMembers
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Members
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceMember
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceMembers]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceMembers];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceMembers]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_UserID.[Name] AS [User],
    mjBizAppsCollaborationSpaceRoleType_SpaceRoleTypeID.[Name] AS [SpaceRoleType]
FROM
    [${flyway:defaultSchema}].[SpaceMember] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_UserID
  ON
    [s].[UserID] = MJUser_UserID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[SpaceRoleType] AS mjBizAppsCollaborationSpaceRoleType_SpaceRoleTypeID
  ON
    [s].[SpaceRoleTypeID] = mjBizAppsCollaborationSpaceRoleType_SpaceRoleTypeID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: Permissions for vwSpaceMembers
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: spCreateSpaceMember
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceMember
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceMember]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceMember];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceMember]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @UserID uniqueidentifier,
    @SpaceRoleTypeID uniqueidentifier,
    @Band nvarchar(20),
    @Status nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceMember]
            (
                [ID],
                [SpaceID],
                [UserID],
                [SpaceRoleTypeID],
                [Band],
                [Status]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @UserID,
                @SpaceRoleTypeID,
                @Band,
                ISNULL(@Status, 'Invited')
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceMember]
            (
                [SpaceID],
                [UserID],
                [SpaceRoleTypeID],
                [Band],
                [Status]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @UserID,
                @SpaceRoleTypeID,
                @Band,
                ISNULL(@Status, 'Invited')
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceMembers] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Members */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: spUpdateSpaceMember
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceMember
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceMember]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceMember];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceMember]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @UserID uniqueidentifier = NULL,
    @SpaceRoleTypeID uniqueidentifier = NULL,
    @Band nvarchar(20) = NULL,
    @Status nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceMember]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [UserID] = ISNULL(@UserID, [UserID]),
        [SpaceRoleTypeID] = ISNULL(@SpaceRoleTypeID, [SpaceRoleTypeID]),
        [Band] = ISNULL(@Band, [Band]),
        [Status] = ISNULL(@Status, [Status])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceMembers] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceMembers]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceMember table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceMember]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceMember];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceMember
ON [${flyway:defaultSchema}].[SpaceMember]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceMember]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceMember] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Members */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: spDeleteSpaceMember
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceMember
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceMember]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceMember];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceMember]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceMember]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Members */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: vwSpaces
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Spaces
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  Space
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaces]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaces];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaces]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpaceType_SpaceTypeID.[Name] AS [SpaceType],
    mjBizAppsCollaborationSpace_ParentID.[Name] AS [Parent],
    MJUser_OwnerID.[Name] AS [Owner]
FROM
    [${flyway:defaultSchema}].[Space] AS s
INNER JOIN
    [${flyway:defaultSchema}].[SpaceType] AS mjBizAppsCollaborationSpaceType_SpaceTypeID
  ON
    [s].[SpaceTypeID] = mjBizAppsCollaborationSpaceType_SpaceTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_ParentID
  ON
    [s].[ParentID] = mjBizAppsCollaborationSpace_ParentID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_OwnerID
  ON
    [s].[OwnerID] = MJUser_OwnerID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaces] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: Permissions for vwSpaces
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaces] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: spCreateSpace
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR Space
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpace]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpace];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpace]
    @ID uniqueidentifier = NULL,
    @SpaceTypeID uniqueidentifier,
    @ParentID_Clear bit = 0,
    @ParentID uniqueidentifier = NULL,
    @Name nvarchar(200),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @OwnerID uniqueidentifier,
    @InheritsMembership bit = NULL,
    @AgentRetrieval nvarchar(30) = NULL,
    @StartedAt_Clear bit = 0,
    @StartedAt datetimeoffset = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @Retention_Clear bit = 0,
    @Retention nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[Space]
            (
                [ID],
                [SpaceTypeID],
                [ParentID],
                [Name],
                [Description],
                [OwnerID],
                [InheritsMembership],
                [AgentRetrieval],
                [StartedAt],
                [ClosedAt],
                [Retention]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceTypeID,
                CASE WHEN @ParentID_Clear = 1 THEN NULL ELSE ISNULL(@ParentID, NULL) END,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @OwnerID,
                ISNULL(@InheritsMembership, 1),
                ISNULL(@AgentRetrieval, 'Included'),
                CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @Retention_Clear = 1 THEN NULL ELSE ISNULL(@Retention, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[Space]
            (
                [SpaceTypeID],
                [ParentID],
                [Name],
                [Description],
                [OwnerID],
                [InheritsMembership],
                [AgentRetrieval],
                [StartedAt],
                [ClosedAt],
                [Retention]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceTypeID,
                CASE WHEN @ParentID_Clear = 1 THEN NULL ELSE ISNULL(@ParentID, NULL) END,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @OwnerID,
                ISNULL(@InheritsMembership, 1),
                ISNULL(@AgentRetrieval, 'Included'),
                CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @Retention_Clear = 1 THEN NULL ELSE ISNULL(@Retention, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaces] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Spaces */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: spUpdateSpace
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Space
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpace]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpace];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpace]
    @ID uniqueidentifier,
    @SpaceTypeID uniqueidentifier = NULL,
    @ParentID_Clear bit = 0,
    @ParentID uniqueidentifier = NULL,
    @Name nvarchar(200) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @OwnerID uniqueidentifier = NULL,
    @InheritsMembership bit = NULL,
    @AgentRetrieval nvarchar(30) = NULL,
    @StartedAt_Clear bit = 0,
    @StartedAt datetimeoffset = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @Retention_Clear bit = 0,
    @Retention nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Space]
    SET
        [SpaceTypeID] = ISNULL(@SpaceTypeID, [SpaceTypeID]),
        [ParentID] = CASE WHEN @ParentID_Clear = 1 THEN NULL ELSE ISNULL(@ParentID, [ParentID]) END,
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [OwnerID] = ISNULL(@OwnerID, [OwnerID]),
        [InheritsMembership] = ISNULL(@InheritsMembership, [InheritsMembership]),
        [AgentRetrieval] = ISNULL(@AgentRetrieval, [AgentRetrieval]),
        [StartedAt] = CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, [StartedAt]) END,
        [ClosedAt] = CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, [ClosedAt]) END,
        [Retention] = CASE WHEN @Retention_Clear = 1 THEN NULL ELSE ISNULL(@Retention, [Retention]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaces] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaces]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Space table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpace]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpace];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpace
ON [${flyway:defaultSchema}].[Space]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Space]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[Space] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Spaces */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: spDeleteSpace
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR Space
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpace]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpace];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpace]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[Space]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Spaces */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Space Items */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Items
-- Item: vwSpaceItems
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Items
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceItem
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceItems]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceItems];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceItems]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJEntity_EntityID.[Name] AS [Entity],
    MJUser_PromotedByUserID.[Name] AS [PromotedByUser]
FROM
    [${flyway:defaultSchema}].[SpaceItem] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[Entity] AS MJEntity_EntityID
  ON
    [s].[EntityID] = MJEntity_EntityID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_PromotedByUserID
  ON
    [s].[PromotedByUserID] = MJUser_PromotedByUserID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Items */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Items
-- Item: Permissions for vwSpaceItems
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Items */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Items
-- Item: spCreateSpaceItem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceItem
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceItem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceItem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceItem]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @EntityID uniqueidentifier,
    @RecordID nvarchar(450),
    @Band nvarchar(20),
    @PromotedAt_Clear bit = 0,
    @PromotedAt datetimeoffset = NULL,
    @PromotedByUserID_Clear bit = 0,
    @PromotedByUserID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceItem]
            (
                [ID],
                [SpaceID],
                [EntityID],
                [RecordID],
                [Band],
                [PromotedAt],
                [PromotedByUserID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @EntityID,
                @RecordID,
                @Band,
                CASE WHEN @PromotedAt_Clear = 1 THEN NULL ELSE ISNULL(@PromotedAt, NULL) END,
                CASE WHEN @PromotedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PromotedByUserID, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceItem]
            (
                [SpaceID],
                [EntityID],
                [RecordID],
                [Band],
                [PromotedAt],
                [PromotedByUserID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @EntityID,
                @RecordID,
                @Band,
                CASE WHEN @PromotedAt_Clear = 1 THEN NULL ELSE ISNULL(@PromotedAt, NULL) END,
                CASE WHEN @PromotedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PromotedByUserID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceItems] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Items */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Items */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Items
-- Item: spUpdateSpaceItem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceItem
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceItem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceItem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceItem]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @EntityID uniqueidentifier = NULL,
    @RecordID nvarchar(450) = NULL,
    @Band nvarchar(20) = NULL,
    @PromotedAt_Clear bit = 0,
    @PromotedAt datetimeoffset = NULL,
    @PromotedByUserID_Clear bit = 0,
    @PromotedByUserID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceItem]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [EntityID] = ISNULL(@EntityID, [EntityID]),
        [RecordID] = ISNULL(@RecordID, [RecordID]),
        [Band] = ISNULL(@Band, [Band]),
        [PromotedAt] = CASE WHEN @PromotedAt_Clear = 1 THEN NULL ELSE ISNULL(@PromotedAt, [PromotedAt]) END,
        [PromotedByUserID] = CASE WHEN @PromotedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PromotedByUserID, [PromotedByUserID]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceItems] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceItems]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceItem table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceItem]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceItem];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceItem
ON [${flyway:defaultSchema}].[SpaceItem]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceItem]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceItem] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Items */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Items */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Items
-- Item: spDeleteSpaceItem
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceItem
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceItem]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceItem];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceItem]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceItem]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Items */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (5 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='01596359-EC4B-449C-BA16-316DE4B92A4E,FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E,3648DC35-1DC4-4ED6-A1A6-5D87271A54DB,41165FEC-A52B-469A-A880-3B108C39A65E,BFEB0850-AB22-4DCC-B13C-B82DC998E23C', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 9 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e7bbfa79-ce0c-49b6-a985-e68c65d50b22' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'Space')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'e7bbfa79-ce0c-49b6-a985-e68c65d50b22',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'Space',
            'Space',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2a01bd43-fab4-426c-b3f3-348343f45121' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'Entity')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '2a01bd43-fab4-426c-b3f3-348343f45121',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'Entity',
            'Entity',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fa60c05a-a9ea-4754-8725-407478229bb1' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'PromotedByUser')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'fa60c05a-a9ea-4754-8725-407478229bb1',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'PromotedByUser',
            'Promoted By User',
            NULL,
            'nvarchar',
            200,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd16e1eb2-8851-4515-9601-2fe88e3baee4' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'SpaceType')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'd16e1eb2-8851-4515-9601-2fe88e3baee4',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'SpaceType',
            'Space Type',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e6b00068-b5c1-430b-a8f5-b78da1da5aa5' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'Parent')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'e6b00068-b5c1-430b-a8f5-b78da1da5aa5',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'Parent',
            'Parent',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b4a0d865-66ab-4682-a1b2-161fcc3af6bf' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'Owner')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b4a0d865-66ab-4682-a1b2-161fcc3af6bf',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'Owner',
            'Owner',
            NULL,
            'nvarchar',
            200,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6d5375d1-fa11-4951-9360-f4b822b96b02' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'Space')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6d5375d1-fa11-4951-9360-f4b822b96b02',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'Space',
            'Space',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '591deb1f-e146-43a9-962d-6402c0c45f57' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'User')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '591deb1f-e146-43a9-962d-6402c0c45f57',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'User',
            'User',
            NULL,
            'nvarchar',
            200,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1e1db29b-74bc-44bf-a492-0099d98df8f1' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'SpaceRoleType')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1e1db29b-74bc-44bf-a492-0099d98df8f1',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'SpaceRoleType',
            'Space Role Type',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* SQL text to update existing entity fields from schema (5 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='01596359-EC4B-449C-BA16-316DE4B92A4E,FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E,3648DC35-1DC4-4ED6-A1A6-5D87271A54DB,41165FEC-A52B-469A-A880-3B108C39A65E,BFEB0850-AB22-4DCC-B13C-B82DC998E23C', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

