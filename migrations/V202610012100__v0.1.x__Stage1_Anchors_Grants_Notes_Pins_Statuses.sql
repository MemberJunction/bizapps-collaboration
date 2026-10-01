-- =============================================================================
-- Stage 1: the schema (plans/pr10-plan.md § 5; the stage 1 design comment and its revision on PR #10; the design doc
-- "Hierarchical Notification Settings" for statuses and the Library's artifact link)
-- =============================================================================
--
-- New tables: SpaceAnchor (B14, D26), SpaceGrant (B15, D27, D30, D31), SpaceNote (B21, D33), SpaceMemberPin (B22, D32),
-- SpaceTypeStatus (the statuses a type declares; a space chooses among them). New columns: Space.StatusID,
-- SpaceItem.ArtifactVersionID (a Library document is an Artifact Version in file mode over its MJ: Files row).
--
-- Gone (item 144): Space.AnchorEntityID and AnchorRecordID (anchors are rows now); SpaceAgent, SpaceAgentSkill and
-- SpaceKnowledgeSource (grants are one table now), with the entity rows CodeGen registered for them; Space.PostCloseAccess,
-- Space.PostCloseAccessDays, SpaceType.PostCloseAccess and SpaceType.PostCloseAccessDays (a closed space's reach is its
-- status's Visible and ReadOnly); SpaceType.DefaultInheritsMembership (D22: the creator chooses); SpaceType.DefaultRetention
-- and Space.Retention (nothing enforced them); SpaceType.GovernancePanel (nothing read it).
--
-- The access functions that read post-close access now read the space's effective status, through
-- fnCollaborationSpaceStatuses: the status the space names, else (while a space is unstamped) its type's default status
-- when it is open and its type's first terminal status when ClosedAt is set, else (a type with no statuses yet) open =
-- writable and visible, closed = read-only and visible.
--
-- Space.StatusID stays NULL-able: a type's statuses are metadata rows, pushed after the migrations run, so the migration
-- cannot stamp them. The server stamps StatusID on a space's next save and derives it until then, exactly as the function does.
--
-- Hand-written DDL only. No __mj_ columns, no foreign-key indexes, no Entity or EntityField rows: CodeGen owns those and its
-- output is appended under the banner below after a run on a database built from scratch. The statuses of the shipped
-- types, the new row-level filters, permissions, JSON types and the notification type are metadata under metadata/.
--
-- Placeholders: ${flyway:defaultSchema} this app; ${mjSchema} MJ core.
-- =============================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- =============================================================================
-- 1. SpaceTypeStatus
-- =============================================================================
CREATE TABLE ${flyway:defaultSchema}.SpaceTypeStatus (
    ID                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SpaceTypeStatus_ID DEFAULT (NEWSEQUENTIALID()),
    SpaceTypeID          UNIQUEIDENTIFIER NOT NULL,
    Code                 NVARCHAR(40)     NOT NULL,
    Name                 NVARCHAR(100)    NOT NULL,
    Sequence             INT              NOT NULL,
    IsDefault            BIT              NOT NULL CONSTRAINT DF_SpaceTypeStatus_IsDefault DEFAULT (0),
    ReadOnly             BIT              NOT NULL CONSTRAINT DF_SpaceTypeStatus_ReadOnly DEFAULT (0),
    Visible              BIT              NOT NULL CONSTRAINT DF_SpaceTypeStatus_Visible DEFAULT (1),
    AgentRetrieval       BIT              NOT NULL CONSTRAINT DF_SpaceTypeStatus_AgentRetrieval DEFAULT (1),
    CanChangeAfter       BIT              NOT NULL CONSTRAINT DF_SpaceTypeStatus_CanChangeAfter DEFAULT (1),
    NotifyMembersOnEnter BIT              NOT NULL CONSTRAINT DF_SpaceTypeStatus_NotifyMembersOnEnter DEFAULT (0),
    IsTerminal           BIT              NOT NULL CONSTRAINT DF_SpaceTypeStatus_IsTerminal DEFAULT (0),
    CONSTRAINT PK_SpaceTypeStatus PRIMARY KEY (ID),
    CONSTRAINT FK_SpaceTypeStatus_SpaceType FOREIGN KEY (SpaceTypeID) REFERENCES ${flyway:defaultSchema}.SpaceType(ID),
    CONSTRAINT UQ_SpaceTypeStatus_Type_Code UNIQUE (SpaceTypeID, Code),
    CONSTRAINT UQ_SpaceTypeStatus_Type_Sequence UNIQUE (SpaceTypeID, Sequence),
    CONSTRAINT CK_SpaceTypeStatus_Code CHECK (LEN(LTRIM(RTRIM(Code))) > 0),
    -- A status nothing can leave must be an end: a non-terminal status with CanChangeAfter off would strand a space
    CONSTRAINT CK_SpaceTypeStatus_FrozenIsTerminal CHECK (IsTerminal = 1 OR CanChangeAfter = 1)
);
GO
-- One default status per type
CREATE UNIQUE INDEX UQ_SpaceTypeStatus_Default ON ${flyway:defaultSchema}.SpaceTypeStatus (SpaceTypeID) WHERE IsDefault = 1;
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A status a space type offers its spaces: Active, Paused, Closed and Archived ship for every type; a type may add its own. A space is in exactly one of its type''s statuses (Space.StatusID) and may only choose among them. The attributes say what a space in the status allows; the type''s driver may still refuse a change.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The type this status belongs to.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'SpaceTypeID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The status''s key within its type: active, paused, closed, archived, or a type''s own.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'Code';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What the status is called on screen.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'Name';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The definitive order of the type''s statuses, for display and for the rule that a terminal status may only move forward.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'Sequence';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The status a new space of the type starts in; one per type.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'IsDefault';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Members may read but not post, upload, assign or edit while the space is in this status.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'ReadOnly';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space is listed and reachable by its members; off hides it from everyone but its owner and staff.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'Visible';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'An agent may quote the space''s material while it is in this status.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'AgentRetrieval';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Once a space reaches this status it may still move to another; off freezes it there. A frozen status must be terminal.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'CanChangeAfter';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Entering this status sends the space''s "status changed" notice, one per member, through MJ''s notification chain.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'NotifyMembersOnEnter';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Entering this status stamps Space.ClosedAt; retention and the closed views count from it. From a terminal status a space may move only to a higher Sequence, never back to an open one.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'IsTerminal';
GO

-- =============================================================================
-- 2. Space.StatusID, SpaceItem.ArtifactVersionID
-- =============================================================================
ALTER TABLE ${flyway:defaultSchema}.Space ADD StatusID UNIQUEIDENTIFIER NULL;
GO
ALTER TABLE ${flyway:defaultSchema}.Space ADD CONSTRAINT FK_Space_Status FOREIGN KEY (StatusID) REFERENCES ${flyway:defaultSchema}.SpaceTypeStatus(ID);
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The status the space is in, one of its type''s (SpaceTypeStatus). NULL until the server stamps it: then the type''s default while ClosedAt is null, and the type''s first terminal status once ClosedAt is set, as fnCollaborationSpaceStatuses derives it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'StatusID';
GO

ALTER TABLE ${flyway:defaultSchema}.SpaceItem ADD ArtifactVersionID UNIQUEIDENTIFIER NULL;
GO
ALTER TABLE ${flyway:defaultSchema}.SpaceItem ADD CONSTRAINT FK_SpaceItem_ArtifactVersion FOREIGN KEY (ArtifactVersionID) REFERENCES ${mjSchema}.ArtifactVersion(ID);
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For a document in the Library: the MJ Artifact Version (ContentMode File) wrapping the MJ: Files row the item points at, so the document has a type, a viewer and versions. NULL for items that are not files. Artifact Permissions are not used by the Library; the roster is the one sharing model.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'ArtifactVersionID';
GO

-- =============================================================================
-- 3. SpaceAnchor (B14, D26): the records a space is about
-- =============================================================================
CREATE TABLE ${flyway:defaultSchema}.SpaceAnchor (
    ID          UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SpaceAnchor_ID DEFAULT (NEWSEQUENTIALID()),
    SpaceID     UNIQUEIDENTIFIER NOT NULL,
    SpaceTypeID UNIQUEIDENTIFIER NOT NULL,
    EntityID    UNIQUEIDENTIFIER NOT NULL,
    RecordID    NVARCHAR(450)    NOT NULL,
    Role        NVARCHAR(100)    NOT NULL,
    IsPrimary   BIT              NOT NULL CONSTRAINT DF_SpaceAnchor_IsPrimary DEFAULT (0),
    Sequence    INT              NOT NULL CONSTRAINT DF_SpaceAnchor_Sequence DEFAULT (0),
    CONSTRAINT PK_SpaceAnchor PRIMARY KEY (ID),
    CONSTRAINT FK_SpaceAnchor_Space FOREIGN KEY (SpaceID) REFERENCES ${flyway:defaultSchema}.Space(ID),
    CONSTRAINT FK_SpaceAnchor_SpaceType FOREIGN KEY (SpaceTypeID) REFERENCES ${flyway:defaultSchema}.SpaceType(ID),
    CONSTRAINT FK_SpaceAnchor_Entity FOREIGN KEY (EntityID) REFERENCES ${mjSchema}.Entity(ID),
    CONSTRAINT UQ_SpaceAnchor_Space_Entity_Record_Role UNIQUE (SpaceID, EntityID, RecordID, Role),
    CONSTRAINT CK_SpaceAnchor_Role CHECK (LEN(LTRIM(RTRIM(Role))) > 0)
);
GO
CREATE UNIQUE INDEX UQ_SpaceAnchor_Primary ON ${flyway:defaultSchema}.SpaceAnchor (SpaceID) WHERE IsPrimary = 1;
CREATE UNIQUE INDEX UQ_SpaceAnchor_PrimaryPerType ON ${flyway:defaultSchema}.SpaceAnchor (SpaceTypeID, EntityID, RecordID) WHERE IsPrimary = 1;
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A record a space is about (D26: a space may have several). The primary anchor is the one EnsureSpaceForRecord finds a space by; one per space, and one space per (type, record) as primary.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'SpaceID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space''s type, denormalized so the primary-per-type index can hold; the server keeps it equal to the space''s and rewrites it when the type changes.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'SpaceTypeID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The entity of the anchored record.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'EntityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The record''s key, in the canonical shape SpaceItem.RecordID uses.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'RecordID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What the record is to the space, in the type''s vocabulary: chapter, sponsor, event. Data reach (D28) names an anchor by this role.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'Role';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The one anchor a space is found by. At most one per space.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'IsPrimary';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display order among the space''s anchors.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'Sequence';
GO

-- =============================================================================
-- 4. SpaceGrant (B15, D27, D30, D31): what the app, a type or a space offers
-- =============================================================================
CREATE TABLE ${flyway:defaultSchema}.SpaceGrant (
    ID             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SpaceGrant_ID DEFAULT (NEWSEQUENTIALID()),
    SpaceTypeID    UNIQUEIDENTIFIER NULL,
    SpaceID        UNIQUEIDENTIFIER NULL,
    Kind           NVARCHAR(30)     NOT NULL,
    TargetEntityID UNIQUEIDENTIFIER NOT NULL,
    TargetRecordID NVARCHAR(450)    NOT NULL,
    Label          NVARCHAR(200)    NULL,
    Band           NVARCHAR(10)     NOT NULL CONSTRAINT DF_SpaceGrant_Band DEFAULT (N'Shared'),
    IsDefault      BIT              NOT NULL CONSTRAINT DF_SpaceGrant_IsDefault DEFAULT (0),
    Bindings       NVARCHAR(MAX)    NULL,
    Settings       NVARCHAR(MAX)    NULL,
    Mode           NVARCHAR(10)     NOT NULL CONSTRAINT DF_SpaceGrant_Mode DEFAULT (N'Extend'),
    Sequence       INT              NOT NULL CONSTRAINT DF_SpaceGrant_Sequence DEFAULT (0),
    CONSTRAINT PK_SpaceGrant PRIMARY KEY (ID),
    CONSTRAINT FK_SpaceGrant_SpaceType FOREIGN KEY (SpaceTypeID) REFERENCES ${flyway:defaultSchema}.SpaceType(ID),
    CONSTRAINT FK_SpaceGrant_Space FOREIGN KEY (SpaceID) REFERENCES ${flyway:defaultSchema}.Space(ID),
    CONSTRAINT FK_SpaceGrant_TargetEntity FOREIGN KEY (TargetEntityID) REFERENCES ${mjSchema}.Entity(ID),
    CONSTRAINT CK_SpaceGrant_Scope CHECK (NOT (SpaceTypeID IS NOT NULL AND SpaceID IS NOT NULL)),
    CONSTRAINT CK_SpaceGrant_Kind CHECK (Kind IN (N'Agent', N'Action', N'Query', N'View', N'Dashboard', N'Component', N'KnowledgeSource')),
    CONSTRAINT CK_SpaceGrant_Band CHECK (Band IN (N'Team', N'Shared')),
    CONSTRAINT CK_SpaceGrant_Mode CHECK (Mode IN (N'Extend', N'Remove')),
    CONSTRAINT CK_SpaceGrant_DefaultIsAgent CHECK (IsDefault = 0 OR Kind = N'Agent')
);
GO
-- One level grants a thing once (item 145), and one default agent per level
CREATE UNIQUE INDEX UQ_SpaceGrant_App ON ${flyway:defaultSchema}.SpaceGrant (Kind, TargetEntityID, TargetRecordID) WHERE SpaceTypeID IS NULL AND SpaceID IS NULL;
CREATE UNIQUE INDEX UQ_SpaceGrant_Type ON ${flyway:defaultSchema}.SpaceGrant (SpaceTypeID, Kind, TargetEntityID, TargetRecordID) WHERE SpaceTypeID IS NOT NULL;
CREATE UNIQUE INDEX UQ_SpaceGrant_Space ON ${flyway:defaultSchema}.SpaceGrant (SpaceID, Kind, TargetEntityID, TargetRecordID) WHERE SpaceID IS NOT NULL;
CREATE UNIQUE INDEX UQ_SpaceGrant_DefaultAgent_App ON ${flyway:defaultSchema}.SpaceGrant (Kind) WHERE IsDefault = 1 AND SpaceTypeID IS NULL AND SpaceID IS NULL;
CREATE UNIQUE INDEX UQ_SpaceGrant_DefaultAgent_Type ON ${flyway:defaultSchema}.SpaceGrant (SpaceTypeID) WHERE IsDefault = 1 AND SpaceTypeID IS NOT NULL;
CREATE UNIQUE INDEX UQ_SpaceGrant_DefaultAgent_Space ON ${flyway:defaultSchema}.SpaceGrant (SpaceID) WHERE IsDefault = 1 AND SpaceID IS NOT NULL;
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Something the app, a space type or a space offers in its spaces (D27''s seven kinds): an agent, an action, a query, a view, a dashboard, a component or a knowledge source, with the band that may use it, bindings from the space to the target''s parameters, and an agent''s narrowed settings. Replaces SpaceAgent, SpaceAgentSkill and SpaceKnowledgeSource.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The type the grant belongs to; null with SpaceID null is the app''s own row.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'SpaceTypeID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space the grant belongs to; never set together with SpaceTypeID.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'SpaceID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Agent, Action, Query, View, Dashboard, Component or KnowledgeSource. TargetEntityID must be the kind''s entity.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Kind';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The target''s entity: MJ: AI Agents, MJ: Actions, MJ: Queries, MJ: User Views, MJ: Dashboards, MJ: Components or MJ: Content Sources, by Kind.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'TargetEntityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The target record''s key.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'TargetRecordID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What the space calls the target; null uses the target''s own name.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Label';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The band that may use the grant (D31). A Team grant is not offered in a chat where anyone cannot see Team.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Band';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For an Agent grant: the agent a chat at this level starts with. One per level.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'IsDefault';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JSON (SpaceGrantBindings): the target''s parameter or property names mapped to where each value comes from: an anchor by role, a column of the space, a configuration key, the user, or a literal (D27).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Bindings';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JSON (AgentGrantSettings) for an Agent grant: skills, plan mode, effort, memory writes and per-run limits, each only narrowing the agent''s own definition (D31). Null for the other kinds.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Settings';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Extend adds the target at this level; Remove takes a target granted above out of this level''s list (D30).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Mode';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display order within the level.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Sequence';
GO

-- =============================================================================
-- 5. SpaceNote (B21, D33): light notes in the space
-- =============================================================================
CREATE TABLE ${flyway:defaultSchema}.SpaceNote (
    ID           UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SpaceNote_ID DEFAULT (NEWSEQUENTIALID()),
    SpaceID      UNIQUEIDENTIFIER NOT NULL,
    Title        NVARCHAR(200)    NOT NULL,
    Body         NVARCHAR(MAX)    NULL,
    Band         NVARCHAR(10)     NOT NULL CONSTRAINT DF_SpaceNote_Band DEFAULT (N'Team'),
    Visibility   NVARCHAR(10)     NOT NULL CONSTRAINT DF_SpaceNote_Visibility DEFAULT (N'Space'),
    AuthorUserID UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_SpaceNote PRIMARY KEY (ID),
    CONSTRAINT FK_SpaceNote_Space FOREIGN KEY (SpaceID) REFERENCES ${flyway:defaultSchema}.Space(ID),
    CONSTRAINT FK_SpaceNote_Author FOREIGN KEY (AuthorUserID) REFERENCES ${mjSchema}.[User](ID),
    CONSTRAINT CK_SpaceNote_Band CHECK (Band IN (N'Team', N'Shared')),
    CONSTRAINT CK_SpaceNote_Visibility CHECK (Visibility IN (N'Space', N'Private')),
    -- A private note has no audience to share with
    CONSTRAINT CK_SpaceNote_PrivateIsTeam CHECK (Visibility = N'Space' OR Band = N'Team')
);
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A light note in a space (B21): the space''s own row on a band, not a library item, so the move-and-promote rules do not apply and it needs no ItemUse. Private notes are the author''s alone.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space the note belongs to.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'SpaceID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The note''s title.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'Title';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The note''s body, Markdown.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'Body';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Team or Shared: who in the space may read it. A Team note moves to Shared only when the plan''s call 15 allows it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'Band';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Space: the band reads it. Private: the author alone, and then the band is Team.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'Visibility';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Who wrote the note: the caller on create, and the only one who edits or deletes it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'AuthorUserID';
GO

-- =============================================================================
-- 6. SpaceMemberPin (B22, D32): what a member keeps at the top of a space
-- =============================================================================
CREATE TABLE ${flyway:defaultSchema}.SpaceMemberPin (
    ID             UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_SpaceMemberPin_ID DEFAULT (NEWSEQUENTIALID()),
    SpaceID        UNIQUEIDENTIFIER NOT NULL,
    UserID         UNIQUEIDENTIFIER NOT NULL,
    Kind           NVARCHAR(20)     NOT NULL,
    TargetEntityID UNIQUEIDENTIFIER NULL,
    TargetRecordID NVARCHAR(450)    NULL,
    GrantID        UNIQUEIDENTIFIER NULL,
    Sequence       INT              NOT NULL CONSTRAINT DF_SpaceMemberPin_Sequence DEFAULT (0),
    CONSTRAINT PK_SpaceMemberPin PRIMARY KEY (ID),
    CONSTRAINT FK_SpaceMemberPin_Space FOREIGN KEY (SpaceID) REFERENCES ${flyway:defaultSchema}.Space(ID),
    CONSTRAINT FK_SpaceMemberPin_User FOREIGN KEY (UserID) REFERENCES ${mjSchema}.[User](ID),
    CONSTRAINT FK_SpaceMemberPin_TargetEntity FOREIGN KEY (TargetEntityID) REFERENCES ${mjSchema}.Entity(ID),
    CONSTRAINT FK_SpaceMemberPin_Grant FOREIGN KEY (GrantID) REFERENCES ${flyway:defaultSchema}.SpaceGrant(ID),
    CONSTRAINT CK_SpaceMemberPin_Kind CHECK (Kind IN (N'Record', N'Grant')),
    CONSTRAINT CK_SpaceMemberPin_Target CHECK (
        (Kind = N'Record' AND TargetEntityID IS NOT NULL AND TargetRecordID IS NOT NULL AND GrantID IS NULL)
        OR (Kind = N'Grant' AND GrantID IS NOT NULL AND TargetEntityID IS NULL AND TargetRecordID IS NULL)
    )
);
GO
CREATE UNIQUE INDEX UQ_SpaceMemberPin_Record ON ${flyway:defaultSchema}.SpaceMemberPin (SpaceID, UserID, TargetEntityID, TargetRecordID) WHERE Kind = N'Record';
CREATE UNIQUE INDEX UQ_SpaceMemberPin_Grant ON ${flyway:defaultSchema}.SpaceMemberPin (SpaceID, UserID, GrantID) WHERE Kind = N'Grant';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Something a member keeps at the top of a space (B22): a record of the space (an item, a note, a task) or one of the space''s grants (a view, a dashboard, a component). The member''s own; Home lists pins from the spaces they still reach.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space the pin is in.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'SpaceID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whose pin it is: the caller.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'UserID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Record: a record of the space by entity and key. Grant: one of the space''s grants.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'Kind';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For a Record pin: the record''s entity.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'TargetEntityID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For a Record pin: the record''s key.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'TargetRecordID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For a Grant pin: the grant in force for the member''s space and band.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'GrantID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The member''s order of pins.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'Sequence';
GO

-- =============================================================================
-- 7. The effective status of every space, and the access functions on it
-- =============================================================================
-- The status a space names, else what it would be stamped with: its type's default while open, its type's first
-- terminal status once ClosedAt is set; a type with no statuses yet reads as open = writable and visible, closed =
-- read-only and visible. One row per space. Inline, so the access functions join it.
DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses];
GO
CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]()
RETURNS TABLE
AS
RETURN
    SELECT s.ID AS SpaceID,
           COALESCE(named.ID, derived.ID) AS StatusID,
           CAST(COALESCE(named.ReadOnly, derived.ReadOnly, CASE WHEN s.ClosedAt IS NULL THEN 0 ELSE 1 END) AS BIT) AS ReadOnly,
           CAST(COALESCE(named.Visible, derived.Visible, 1) AS BIT) AS Visible,
           CAST(COALESCE(named.AgentRetrieval, derived.AgentRetrieval, 1) AS BIT) AS AgentRetrieval,
           CAST(COALESCE(named.IsTerminal, derived.IsTerminal, CASE WHEN s.ClosedAt IS NULL THEN 0 ELSE 1 END) AS BIT) AS IsTerminal
    FROM [${flyway:defaultSchema}].[Space] AS s
    LEFT JOIN [${flyway:defaultSchema}].[SpaceTypeStatus] AS named ON named.ID = s.StatusID
    OUTER APPLY (
        SELECT TOP 1 d.ID, d.ReadOnly, d.Visible, d.AgentRetrieval, d.IsTerminal
        FROM [${flyway:defaultSchema}].[SpaceTypeStatus] AS d
        WHERE d.SpaceTypeID = s.SpaceTypeID
          AND ((s.ClosedAt IS NULL AND d.IsDefault = 1) OR (s.ClosedAt IS NOT NULL AND d.IsTerminal = 1))
        ORDER BY d.Sequence
    ) AS derived;
GO

-- fnCollaborationAccess: a member reaches a space whose effective status is Visible; a read-only status takes CanInvite
-- and CanContribute away. Post-close access and its days window are gone: a Closed space stays readable until it is Archived.
DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationAccess];
GO
CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID UNIQUEIDENTIFIER)
RETURNS @Access TABLE (
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL,
    CanInvite BIT NOT NULL,
    CanContribute BIT NOT NULL
)
AS
BEGIN
    ;WITH Direct AS (
        SELECT m.SpaceID,
               CAST(r.CanSeeTeamBand AS INT) AS CanSeeTeam,
               CAST(r.CanInvite AS INT) AS CanInvite,
               CAST(r.CanContribute AS INT) AS CanContribute,
               0 AS Steps,
               CAST(CONVERT(varchar(36), m.SpaceID) AS varchar(max)) AS Path,
               st.ReadOnly
        FROM [${flyway:defaultSchema}].[SpaceMember] AS m
        INNER JOIN [${flyway:defaultSchema}].[Space] AS s ON s.ID = m.SpaceID
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS st ON st.SpaceID = s.ID
        INNER JOIN [${flyway:defaultSchema}].[SpaceRoleType] AS r ON r.ID = m.SpaceRoleTypeID
        WHERE m.UserID = @UserID
          AND m.Status = N'Active'
          AND st.Visible = 1
    ),
    Reachable AS (
        SELECT SpaceID,
               CanSeeTeam,
               CASE WHEN ReadOnly = 1 THEN 0 ELSE CanInvite END AS CanInvite,
               CASE WHEN ReadOnly = 1 THEN 0 ELSE CanContribute END AS CanContribute,
               Steps,
               Path
        FROM Direct

        UNION ALL

        SELECT child.ID,
               parent.CanSeeTeam,
               CASE WHEN cst.ReadOnly = 1 THEN 0 ELSE parent.CanInvite END,
               CASE WHEN cst.ReadOnly = 1 THEN 0 ELSE parent.CanContribute END,
               parent.Steps + 1,
               parent.Path + '/' + CONVERT(varchar(36), child.ID)
        FROM [${flyway:defaultSchema}].[Space] AS child
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS cst ON cst.SpaceID = child.ID
        INNER JOIN Reachable AS parent ON child.ParentID = parent.SpaceID
        WHERE child.InheritsMembership = 1
          AND parent.Steps < 32
          AND parent.Path NOT LIKE '%' + CONVERT(varchar(36), child.ID) + '%'
          AND cst.Visible = 1
    )
    INSERT INTO @Access (SpaceID, CanSeeTeam, CanInvite, CanContribute)
    SELECT SpaceID, CAST(CanSeeTeam AS BIT), CAST(CanInvite AS BIT), CAST(CanContribute AS BIT)
    FROM (
        SELECT SpaceID, CanSeeTeam, CanInvite, CanContribute,
               ROW_NUMBER() OVER (PARTITION BY SpaceID ORDER BY Steps) AS rn
        FROM Reachable
    ) AS ranked
    WHERE rn = 1
    OPTION (MAXRECURSION 32);

    RETURN;
END;
GO

-- fnCollaborationAncestorMembers: the walk starts from an open (not read-only) space the viewer reaches and climbs through
-- ancestors whose effective status is Visible, judged as fnCollaborationAccess judges them.
DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationAncestorMembers];
GO
CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationAncestorMembers](@UserID UNIQUEIDENTIFIER)
RETURNS @Members TABLE (
    MemberID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NOT NULL,
    SpaceID UNIQUEIDENTIFIER NOT NULL
)
AS
BEGIN
    ;WITH AncestorWalk AS (
        SELECT p.ID AS AncestorSpaceID,
               1 AS Steps,
               CAST(CONVERT(varchar(36), s.ID) + '/' + CONVERT(varchar(36), p.ID) AS varchar(max)) AS Path
        FROM [${flyway:defaultSchema}].[Space] AS s
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID) AS a ON a.SpaceID = s.ID
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS sst ON sst.SpaceID = s.ID
        INNER JOIN [${flyway:defaultSchema}].[Space] AS p ON p.ID = s.ParentID
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS pst ON pst.SpaceID = p.ID
        WHERE s.AllowParentAssignees = 1
          AND s.InheritsMembership = 1
          AND sst.ReadOnly = 0
          AND pst.Visible = 1

        UNION ALL

        SELECT gp.ID,
               w.Steps + 1,
               w.Path + '/' + CONVERT(varchar(36), gp.ID)
        FROM AncestorWalk AS w
        INNER JOIN [${flyway:defaultSchema}].[Space] AS cur ON cur.ID = w.AncestorSpaceID
        INNER JOIN [${flyway:defaultSchema}].[Space] AS gp ON gp.ID = cur.ParentID
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS gpst ON gpst.SpaceID = gp.ID
        WHERE cur.InheritsMembership = 1
          AND w.Steps < 32
          AND w.Path NOT LIKE '%' + CONVERT(varchar(36), gp.ID) + '%'
          AND gpst.Visible = 1
    )
    INSERT INTO @Members (MemberID, UserID, SpaceID)
    SELECT DISTINCT m.ID, m.UserID, m.SpaceID
    FROM [${flyway:defaultSchema}].[SpaceMember] AS m
    INNER JOIN AncestorWalk AS w ON w.AncestorSpaceID = m.SpaceID
    WHERE m.Status = N'Active';

    RETURN;
END;
GO

-- =============================================================================
-- 8. What goes (item 144)
-- =============================================================================
-- Space: the anchor columns (anchors are rows now) and post-close access (a status now)
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IDX_AUTO_MJ_FKEY_Space_AnchorEntityID' AND object_id = OBJECT_ID(N'[${flyway:defaultSchema}].[Space]'))
    DROP INDEX [IDX_AUTO_MJ_FKEY_Space_AnchorEntityID] ON [${flyway:defaultSchema}].[Space];
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Space_AnchorEntity')
    ALTER TABLE [${flyway:defaultSchema}].[Space] DROP CONSTRAINT [FK_Space_AnchorEntity];
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Space_PostCloseAccess')
    ALTER TABLE [${flyway:defaultSchema}].[Space] DROP CONSTRAINT [CK_Space_PostCloseAccess];
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_Space_Retention')
    ALTER TABLE [${flyway:defaultSchema}].[Space] DROP CONSTRAINT [CK_Space_Retention];
GO
-- Inline defaults carry generated names: find and drop them before the columns go
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql = @sql + N'ALTER TABLE [${flyway:defaultSchema}].[' + OBJECT_NAME(dc.parent_object_id) + N'] DROP CONSTRAINT [' + dc.name + N'];' + CHAR(10)
FROM sys.default_constraints AS dc
INNER JOIN sys.columns AS c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE (dc.parent_object_id = OBJECT_ID(N'[${flyway:defaultSchema}].[Space]') AND c.name IN (N'AnchorEntityID', N'AnchorRecordID', N'PostCloseAccess', N'PostCloseAccessDays', N'Retention'))
   OR (dc.parent_object_id = OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceType]') AND c.name IN (N'PostCloseAccess', N'PostCloseAccessDays', N'DefaultInheritsMembership', N'GovernancePanel', N'DefaultRetention'));
IF @sql <> N'' EXEC sp_executesql @sql;
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] DROP COLUMN [AnchorEntityID], [AnchorRecordID], [PostCloseAccess], [PostCloseAccessDays], [Retention];
GO
-- SpaceType: post-close access, the inherit default (D22: the creator chooses), retention (nothing enforced it), the panel nothing read
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_SpaceType_PostCloseAccess')
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType] DROP CONSTRAINT [CK_SpaceType_PostCloseAccess];
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_SpaceType_DefaultRetention')
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType] DROP CONSTRAINT [CK_SpaceType_DefaultRetention];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] DROP COLUMN [PostCloseAccess], [PostCloseAccessDays], [DefaultInheritsMembership], [GovernancePanel], [DefaultRetention];
GO
-- The three grant tables SpaceGrant replaces, with the entity rows CodeGen registered for them and everything that hung on those
DECLARE @EntityID UNIQUEIDENTIFIER;
DECLARE names CURSOR LOCAL FAST_FORWARD FOR
    SELECT ID FROM [${mjSchema}].[Entity]
    WHERE Name IN (N'MJ_BizApps_Collaboration: Space Agent Skills', N'MJ_BizApps_Collaboration: Space Agents', N'MJ_BizApps_Collaboration: Space Knowledge Sources');
OPEN names;
FETCH NEXT FROM names INTO @EntityID;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC [${mjSchema}].[spDeleteEntityWithCoreDependencies] @EntityID = @EntityID;
    FETCH NEXT FROM names INTO @EntityID;
END
CLOSE names;
DEALLOCATE names;
GO
DROP TABLE IF EXISTS [${flyway:defaultSchema}].[SpaceAgentSkill];
DROP TABLE IF EXISTS [${flyway:defaultSchema}].[SpaceAgent];
DROP TABLE IF EXISTS [${flyway:defaultSchema}].[SpaceKnowledgeSource];
GO
