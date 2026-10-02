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
-- The create and update procedures of a table that only lost columns still name them. CodeGen regenerates an entity's
-- procedures when it finds the entity changed, and it learns that from the Entity Field rows it has to delete; but the
-- metadata refresh mj migrate runs right after the migrations deletes those rows first, so CodeGen sees nothing to do.
-- A procedure that is missing it does recreate. Space and Space Item gain a column in this migration and are
-- regenerated for that reason; Space Type is not, so its procedures go here.
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spCreateSpaceType];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spUpdateSpaceType];
GO
-- The three grant tables SpaceGrant replaces. CodeGen's objects for them go first (their views and procedures would
-- otherwise outlive the tables and break the metadata refresh that follows a migrate), then the entity rows CodeGen
-- registered and everything that hung on them (the list MJ's spDeleteEntityWithCoreDependencies uses; spelled out here
-- because a database built from a 6.2 baseline does not carry that procedure), then the tables.
DROP VIEW IF EXISTS [${flyway:defaultSchema}].[vwSpaceAgents];
DROP VIEW IF EXISTS [${flyway:defaultSchema}].[vwSpaceAgentSkills];
DROP VIEW IF EXISTS [${flyway:defaultSchema}].[vwSpaceKnowledgeSources];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spCreateSpaceAgent];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spUpdateSpaceAgent];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spDeleteSpaceAgent];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spCreateSpaceAgentSkill];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spUpdateSpaceAgentSkill];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spDeleteSpaceAgentSkill];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spCreateSpaceKnowledgeSource];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spUpdateSpaceKnowledgeSource];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spDeleteSpaceKnowledgeSource];
GO
DECLARE @gone TABLE (ID UNIQUEIDENTIFIER NOT NULL);
INSERT INTO @gone (ID)
SELECT ID FROM [${mjSchema}].[Entity]
WHERE Name IN (N'MJ_BizApps_Collaboration: Space Agent Skills', N'MJ_BizApps_Collaboration: Space Agents', N'MJ_BizApps_Collaboration: Space Knowledge Sources');
DELETE FROM [${mjSchema}].[EntityFieldValue] WHERE EntityFieldID IN (SELECT ID FROM [${mjSchema}].[EntityField] WHERE EntityID IN (SELECT ID FROM @gone));
DELETE FROM [${mjSchema}].[EntitySetting] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[EntityField] WHERE EntityID IN (SELECT ID FROM @gone) OR RelatedEntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[EntityPermission] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[EntityRelationship] WHERE EntityID IN (SELECT ID FROM @gone) OR RelatedEntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[UserApplicationEntity] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[ApplicationEntity] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[RecordChange] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[AuditLog] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[UserViewCategory] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[UserView] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[EntityDocument] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[DatasetItem] WHERE EntityID IN (SELECT ID FROM @gone);
DELETE FROM [${mjSchema}].[Entity] WHERE ID IN (SELECT ID FROM @gone);
GO
DROP TABLE IF EXISTS [${flyway:defaultSchema}].[SpaceAgentSkill];
DROP TABLE IF EXISTS [${flyway:defaultSchema}].[SpaceAgent];
DROP TABLE IF EXISTS [${flyway:defaultSchema}].[SpaceKnowledgeSource];
GO

-- =============================================================================
-- 9. The base views the dropped columns leave invalid
-- =============================================================================
-- mj migrate refreshes the schema's metadata right after the migrations run, before CodeGen regenerates the views, and
-- that refresh reads them. vwSpaces joined the anchor entity by a column that is gone, and vwSpaceTypes' cached column
-- list still counts the five dropped columns. Both are rewritten here as CodeGen writes them, so the refresh finds them
-- valid; CodeGen regenerates them again in its own pass.
DROP VIEW IF EXISTS [${flyway:defaultSchema}].[vwSpaces];
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
GO
EXEC sp_refreshview N'[${flyway:defaultSchema}].[vwSpaceTypes]';
GO


















































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================
-- Two runs on COLLAB_S1_STAGE1, a database built from empty: the first after the DDL above (the new entities,
-- Space.StatusID, SpaceItem.ArtifactVersionID), the second after the Space Type procedures were dropped (see section 8).

-- ---- CodeGen_Run_2026-10-02_02-14-52.sql ----
/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Type Status */

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
         '106df2b5-df08-48ee-a0e1-26c329dc0343',
         'MJ_BizApps_Collaboration: Space Type Status',
         'Space Type Status',
         'A status a space type offers its spaces: Active, Paused, Closed and Archived ship for every type; a type may add its own. A space is in exactly one of its type''s statuses (Space.StatusID) and may only choose among them. The attributes say what a space in the status allows; the type''s driver may still refuse a change.',
         NULL,
         'SpaceTypeStatus',
         'vwSpaceTypeStatus',
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

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Type Status to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '106df2b5-df08-48ee-a0e1-26c329dc0343', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Type Status for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('106df2b5-df08-48ee-a0e1-26c329dc0343' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('106df2b5-df08-48ee-a0e1-26c329dc0343' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Type Status for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('106df2b5-df08-48ee-a0e1-26c329dc0343' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('106df2b5-df08-48ee-a0e1-26c329dc0343' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Type Status for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('106df2b5-df08-48ee-a0e1-26c329dc0343' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('106df2b5-df08-48ee-a0e1-26c329dc0343' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Anchors */

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
         '8b50058d-b5dc-4ae6-9990-17a5eb5b3a09',
         'MJ_BizApps_Collaboration: Space Anchors',
         'Space Anchors',
         'A record a space is about (D26: a space may have several). The primary anchor is the one EnsureSpaceForRecord finds a space by; one per space, and one space per (type, record) as primary.',
         NULL,
         'SpaceAnchor',
         'vwSpaceAnchors',
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

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Anchors to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '8b50058d-b5dc-4ae6-9990-17a5eb5b3a09', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Anchors for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('8b50058d-b5dc-4ae6-9990-17a5eb5b3a09' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('8b50058d-b5dc-4ae6-9990-17a5eb5b3a09' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Anchors for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('8b50058d-b5dc-4ae6-9990-17a5eb5b3a09' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('8b50058d-b5dc-4ae6-9990-17a5eb5b3a09' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Anchors for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('8b50058d-b5dc-4ae6-9990-17a5eb5b3a09' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('8b50058d-b5dc-4ae6-9990-17a5eb5b3a09' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Grants */

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
         'a7873deb-9b74-4e27-a95f-d84ca74f7b75',
         'MJ_BizApps_Collaboration: Space Grants',
         'Space Grants',
         'Something the app, a space type or a space offers in its spaces (D27''s seven kinds): an agent, an action, a query, a view, a dashboard, a component or a knowledge source, with the band that may use it, bindings from the space to the target''s parameters, and an agent''s narrowed settings. Replaces SpaceAgent, SpaceAgentSkill and SpaceKnowledgeSource.',
         NULL,
         'SpaceGrant',
         'vwSpaceGrants',
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

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Grants to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'a7873deb-9b74-4e27-a95f-d84ca74f7b75', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Grants for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('a7873deb-9b74-4e27-a95f-d84ca74f7b75' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('a7873deb-9b74-4e27-a95f-d84ca74f7b75' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Grants for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('a7873deb-9b74-4e27-a95f-d84ca74f7b75' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('a7873deb-9b74-4e27-a95f-d84ca74f7b75' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Grants for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('a7873deb-9b74-4e27-a95f-d84ca74f7b75' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('a7873deb-9b74-4e27-a95f-d84ca74f7b75' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Notes */

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
         'cb59dea7-2155-4a33-b836-adf2b268d2e9',
         'MJ_BizApps_Collaboration: Space Notes',
         'Space Notes',
         'A light note in a space (B21): the space''s own row on a band, not a library item, so the move-and-promote rules do not apply and it needs no ItemUse. Private notes are the author''s alone.',
         NULL,
         'SpaceNote',
         'vwSpaceNotes',
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

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Notes to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'cb59dea7-2155-4a33-b836-adf2b268d2e9', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Notes for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('cb59dea7-2155-4a33-b836-adf2b268d2e9' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('cb59dea7-2155-4a33-b836-adf2b268d2e9' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Notes for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('cb59dea7-2155-4a33-b836-adf2b268d2e9' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('cb59dea7-2155-4a33-b836-adf2b268d2e9' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Notes for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('cb59dea7-2155-4a33-b836-adf2b268d2e9' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('cb59dea7-2155-4a33-b836-adf2b268d2e9' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Member Pins */

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
         '1dde95b7-60b7-4a08-a886-57550b425c58',
         'MJ_BizApps_Collaboration: Space Member Pins',
         'Space Member Pins',
         'Something a member keeps at the top of a space (B22): a record of the space (an item, a note, a task) or one of the space''s grants (a view, a dashboard, a component). The member''s own; Home lists pins from the spaces they still reach.',
         NULL,
         'SpaceMemberPin',
         'vwSpaceMemberPins',
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

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Member Pins to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '1dde95b7-60b7-4a08-a886-57550b425c58', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Member Pins for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('1dde95b7-60b7-4a08-a886-57550b425c58' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('1dde95b7-60b7-4a08-a886-57550b425c58' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Member Pins for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('1dde95b7-60b7-4a08-a886-57550b425c58' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('1dde95b7-60b7-4a08-a886-57550b425c58' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Member Pins for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('1dde95b7-60b7-4a08-a886-57550b425c58' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('1dde95b7-60b7-4a08-a886-57550b425c58' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceAnchor */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceAnchor */
UPDATE [${flyway:defaultSchema}].[SpaceAnchor] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceAnchor */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceAnchor */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAnchor___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceAnchor */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceAnchor */
UPDATE [${flyway:defaultSchema}].[SpaceAnchor] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceAnchor */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceAnchor */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAnchor___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceTypeStatus */
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceTypeStatus */
UPDATE [${flyway:defaultSchema}].[SpaceTypeStatus] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceTypeStatus */
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceTypeStatus */
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceTypeStatus___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceTypeStatus */
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceTypeStatus */
UPDATE [${flyway:defaultSchema}].[SpaceTypeStatus] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceTypeStatus */
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceTypeStatus */
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceTypeStatus___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceMemberPin */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceMemberPin */
UPDATE [${flyway:defaultSchema}].[SpaceMemberPin] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceMemberPin */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceMemberPin */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceMemberPin___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceMemberPin */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceMemberPin */
UPDATE [${flyway:defaultSchema}].[SpaceMemberPin] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceMemberPin */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceMemberPin */
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceMemberPin___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceNote */
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceNote */
UPDATE [${flyway:defaultSchema}].[SpaceNote] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceNote */
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceNote */
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceNote___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceNote */
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceNote */
UPDATE [${flyway:defaultSchema}].[SpaceNote] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceNote */
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceNote */
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceNote___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceGrant */
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceGrant */
UPDATE [${flyway:defaultSchema}].[SpaceGrant] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceGrant */
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpaceGrant */
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceGrant___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceGrant */
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceGrant */
UPDATE [${flyway:defaultSchema}].[SpaceGrant] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceGrant */
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpaceGrant */
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceGrant___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 60 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6fc4047c-6d66-4fac-8d60-d5791524572a' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'ID')) BEGIN
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
            '6fc4047c-6d66-4fac-8d60-d5791524572a',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '817b73b0-ffac-455d-8893-7e10f469014b' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'SpaceID')) BEGIN
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
            '817b73b0-ffac-455d-8893-7e10f469014b',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
            'SpaceID',
            'Space ID',
            'The space.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0ddf6f20-20ed-4c75-b444-73206eb07bae' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'SpaceTypeID')) BEGIN
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
            '0ddf6f20-20ed-4c75-b444-73206eb07bae',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
            'SpaceTypeID',
            'Space Type ID',
            'The space''s type, denormalized so the primary-per-type index can hold; the server keeps it equal to the space''s and rewrites it when the type changes.',
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'bff04097-ae6c-4c41-8d7e-d48642b145d5' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'EntityID')) BEGIN
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
            'bff04097-ae6c-4c41-8d7e-d48642b145d5',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
            'EntityID',
            'Entity ID',
            'The entity of the anchored record.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5c49d87b-ed1d-4fab-8850-142e50d844f7' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'RecordID')) BEGIN
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
            '5c49d87b-ed1d-4fab-8850-142e50d844f7',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
            'RecordID',
            'Record ID',
            'The record''s key, in the canonical shape SpaceItem.RecordID uses.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e7b101bf-c210-493d-9816-4ed9ad7156d0' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'Role')) BEGIN
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
            'e7b101bf-c210-493d-9816-4ed9ad7156d0',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
            'Role',
            'Role',
            'What the record is to the space, in the type''s vocabulary: chapter, sponsor, event. Data reach (D28) names an anchor by this role.',
            'nvarchar',
            200,
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
            0,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c401f73a-35bc-4683-8e2c-63236208e6ce' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'IsPrimary')) BEGIN
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
            'c401f73a-35bc-4683-8e2c-63236208e6ce',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
            'IsPrimary',
            'Is Primary',
            'The one anchor a space is found by. At most one per space.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '13e3b6ea-79ef-4557-ab91-3b80a12d2d9f' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'Sequence')) BEGIN
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
            '13e3b6ea-79ef-4557-ab91-3b80a12d2d9f',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
            'Sequence',
            'Sequence',
            'Display order among the space''s anchors.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '01286846-9149-4f89-ba84-d5b543b8a8ce' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = '__mj_CreatedAt')) BEGIN
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
            '01286846-9149-4f89-ba84-d5b543b8a8ce',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ac7512d0-7725-4cde-b701-ecacf0cbd4a9' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = '__mj_UpdatedAt')) BEGIN
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
            'ac7512d0-7725-4cde-b701-ecacf0cbd4a9',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2748d3dc-84fd-453b-abac-0f9ebdd32cef' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'ID')) BEGIN
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
            '2748d3dc-84fd-453b-abac-0f9ebdd32cef',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'cf239f2a-ecd3-4025-a1d3-ba2299af289e' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'SpaceTypeID')) BEGIN
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
            'cf239f2a-ecd3-4025-a1d3-ba2299af289e',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'SpaceTypeID',
            'Space Type ID',
            'The type this status belongs to.',
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fe2fe2a2-b6b4-464d-a325-d9b1aa38ad2e' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'Code')) BEGIN
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
            'fe2fe2a2-b6b4-464d-a325-d9b1aa38ad2e',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'Code',
            'Code',
            'The status''s key within its type: active, paused, closed, archived, or a type''s own.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6e2f5e31-bc68-4214-88f3-b46f127d29f8' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'Name')) BEGIN
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
            '6e2f5e31-bc68-4214-88f3-b46f127d29f8',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'Name',
            'Name',
            'What the status is called on screen.',
            'nvarchar',
            200,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5e75efba-c997-40ec-a0a5-2836f845780b' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'Sequence')) BEGIN
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
            '5e75efba-c997-40ec-a0a5-2836f845780b',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'Sequence',
            'Sequence',
            'The definitive order of the type''s statuses, for display and for the rule that a terminal status may only move forward.',
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a91daccb-84cd-42be-a8a1-5416a3416741' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'IsDefault')) BEGIN
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
            'a91daccb-84cd-42be-a8a1-5416a3416741',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'IsDefault',
            'Is Default',
            'The status a new space of the type starts in; one per type.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '455af773-9854-4e89-80f1-6cf1d71e4c99' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'ReadOnly')) BEGIN
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
            '455af773-9854-4e89-80f1-6cf1d71e4c99',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'ReadOnly',
            'Read Only',
            'Members may read but not post, upload, assign or edit while the space is in this status.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '791bcf97-4b92-4c0e-8433-3f04a8e8f070' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'Visible')) BEGIN
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
            '791bcf97-4b92-4c0e-8433-3f04a8e8f070',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'Visible',
            'Visible',
            'The space is listed and reachable by its members; off hides it from everyone but its owner and staff.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e4c4890d-6bd6-41b6-8a47-9d84726051dd' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'AgentRetrieval')) BEGIN
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
            'e4c4890d-6bd6-41b6-8a47-9d84726051dd',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'AgentRetrieval',
            'Agent Retrieval',
            'An agent may quote the space''s material while it is in this status.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '75e44ecc-a6c3-459d-8c47-99ba872a781e' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'CanChangeAfter')) BEGIN
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
            '75e44ecc-a6c3-459d-8c47-99ba872a781e',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'CanChangeAfter',
            'Can Change After',
            'Once a space reaches this status it may still move to another; off freezes it there. A frozen status must be terminal.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a4202261-6735-45a1-abb5-ec730deeff80' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'NotifyMembersOnEnter')) BEGIN
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
            'a4202261-6735-45a1-abb5-ec730deeff80',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'NotifyMembersOnEnter',
            'Notify Members On Enter',
            'Entering this status sends the space''s "status changed" notice, one per member, through MJ''s notification chain.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '22f0885b-ff3f-4ce0-8384-e49363a59efe' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'IsTerminal')) BEGIN
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
            '22f0885b-ff3f-4ce0-8384-e49363a59efe',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
            'IsTerminal',
            'Is Terminal',
            'Entering this status stamps Space.ClosedAt; retention and the closed views count from it. From a terminal status a space may move only to a higher Sequence, never back to an open one.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '881b9530-aa4a-40de-8b6a-be92ba611313' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = '__mj_CreatedAt')) BEGIN
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
            '881b9530-aa4a-40de-8b6a-be92ba611313',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '158680b6-fd22-4ae1-ad2e-ea57338b6a49' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '158680b6-fd22-4ae1-ad2e-ea57338b6a49',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0a0c811b-7a58-4b90-b5f9-a67d4d06c706' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'ArtifactVersionID')) BEGIN
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
            '0a0c811b-7a58-4b90-b5f9-a67d4d06c706',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'ArtifactVersionID',
            'Artifact Version ID',
            'For a document in the Library: the MJ Artifact Version (ContentMode File) wrapping the MJ: Files row the item points at, so the document has a type, a viewer and versions. NULL for items that are not files. Artifact Permissions are not used by the Library; the roster is the one sharing model.',
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
            'AEB408D2-162A-49AE-9DC2-DBE9A21A3C01',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e556a94c-dc78-47da-9313-5f299a4b2840' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'ID')) BEGIN
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
            'e556a94c-dc78-47da-9313-5f299a4b2840',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7ddb7d3f-7dd6-44c2-8ec4-b941adf567d7' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'SpaceID')) BEGIN
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
            '7ddb7d3f-7dd6-44c2-8ec4-b941adf567d7',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
            'SpaceID',
            'Space ID',
            'The space the pin is in.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8e465bea-bc4d-4bdf-8d0e-ed1657e549b3' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'UserID')) BEGIN
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
            '8e465bea-bc4d-4bdf-8d0e-ed1657e549b3',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
            'UserID',
            'User ID',
            'Whose pin it is: the caller.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '12be73d4-06f7-4830-b2cf-4a30f73b74c7' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'Kind')) BEGIN
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
            '12be73d4-06f7-4830-b2cf-4a30f73b74c7',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
            'Kind',
            'Kind',
            'Record: a record of the space by entity and key. Grant: one of the space''s grants.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6851483e-7f66-4721-96fa-c929f5a4b360' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'TargetEntityID')) BEGIN
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
            '6851483e-7f66-4721-96fa-c929f5a4b360',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
            'TargetEntityID',
            'Target Entity ID',
            'For a Record pin: the record''s entity.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a4b6e207-6e4d-4650-8c58-bb70b2804594' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'TargetRecordID')) BEGIN
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
            'a4b6e207-6e4d-4650-8c58-bb70b2804594',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
            'TargetRecordID',
            'Target Record ID',
            'For a Record pin: the record''s key.',
            'nvarchar',
            900,
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '174948a1-7c29-4022-a28e-2408f55341bc' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'GrantID')) BEGIN
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
            '174948a1-7c29-4022-a28e-2408f55341bc',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
            'GrantID',
            'Grant ID',
            'For a Grant pin: the grant in force for the member''s space and band.',
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
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3d22b40b-0123-4d7f-8035-d7c05445c4ec' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'Sequence')) BEGIN
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
            '3d22b40b-0123-4d7f-8035-d7c05445c4ec',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
            'Sequence',
            'Sequence',
            'The member''s order of pins.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '95f3c607-d797-4c8c-b69f-903c722bead4' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = '__mj_CreatedAt')) BEGIN
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
            '95f3c607-d797-4c8c-b69f-903c722bead4',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd6e974d9-6691-4d3f-bc0e-fd5ad5901ed4' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = '__mj_UpdatedAt')) BEGIN
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
            'd6e974d9-6691-4d3f-bc0e-fd5ad5901ed4',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0af47b63-da30-4680-8091-e06be3f2c0b5' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'StatusID')) BEGIN
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
            '0af47b63-da30-4680-8091-e06be3f2c0b5',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'StatusID',
            'Status ID',
            'The status the space is in, one of its type''s (SpaceTypeStatus). NULL until the server stamps it: then the type''s default while ClosedAt is null, and the type''s first terminal status once ClosedAt is set, as fnCollaborationSpaceStatuses derives it.',
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
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'bdca0ba4-c979-4cc3-b1dd-3582495e0906' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'ID')) BEGIN
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
            'bdca0ba4-c979-4cc3-b1dd-3582495e0906',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2c525dbc-bff7-47a5-9619-bc9251dbefe1' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'SpaceID')) BEGIN
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
            '2c525dbc-bff7-47a5-9619-bc9251dbefe1',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
            'SpaceID',
            'Space ID',
            'The space the note belongs to.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'da23b4f8-f051-4396-8bf5-1c893749efaa' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'Title')) BEGIN
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
            'da23b4f8-f051-4396-8bf5-1c893749efaa',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
            'Title',
            'Title',
            'The note''s title.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'eec0c3ff-1b29-491a-847a-b2ee3d8dc712' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'Body')) BEGIN
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
            'eec0c3ff-1b29-491a-847a-b2ee3d8dc712',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
            'Body',
            'Body',
            'The note''s body, Markdown.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ad6a55d3-8f26-4d9f-a277-3c8e92755ba9' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'Band')) BEGIN
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
            'ad6a55d3-8f26-4d9f-a277-3c8e92755ba9',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
            'Band',
            'Band',
            'Team or Shared: who in the space may read it. A Team note moves to Shared only when the plan''s call 15 allows it.',
            'nvarchar',
            20,
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8c2b6090-02c5-4c9e-bd3f-9ce0a99e25b9' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'Visibility')) BEGIN
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
            '8c2b6090-02c5-4c9e-bd3f-9ce0a99e25b9',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
            'Visibility',
            'Visibility',
            'Space: the band reads it. Private: the author alone, and then the band is Team.',
            'nvarchar',
            20,
            0,
            0,
            0,
            'Space',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '51c8f841-53dc-4021-95af-019317d0b7ba' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'AuthorUserID')) BEGIN
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
            '51c8f841-53dc-4021-95af-019317d0b7ba',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
            'AuthorUserID',
            'Author User ID',
            'Who wrote the note: the caller on create, and the only one who edits or deletes it.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2a78ff01-77ee-4f81-a04b-c587ef24e345' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = '__mj_CreatedAt')) BEGIN
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
            '2a78ff01-77ee-4f81-a04b-c587ef24e345',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8bcf1254-e7b9-48d0-bf6c-50d8a8f267f7' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '8bcf1254-e7b9-48d0-bf6c-50d8a8f267f7',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e32aee83-1c7f-4021-9263-4870cc31afef' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'ID')) BEGIN
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
            'e32aee83-1c7f-4021-9263-4870cc31afef',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f67ea75a-ddbb-4329-a306-00f95a0d3827' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'SpaceTypeID')) BEGIN
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
            'f67ea75a-ddbb-4329-a306-00f95a0d3827',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'SpaceTypeID',
            'Space Type ID',
            'The type the grant belongs to; null with SpaceID null is the app''s own row.',
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
            '01596359-EC4B-449C-BA16-316DE4B92A4E',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0bc6c9f2-eac4-4695-9a62-57a997cee92a' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'SpaceID')) BEGIN
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
            '0bc6c9f2-eac4-4695-9a62-57a997cee92a',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'SpaceID',
            'Space ID',
            'The space the grant belongs to; never set together with SpaceTypeID.',
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b6d77525-17fc-45c7-8f09-832d53239799' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'Kind')) BEGIN
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
            'b6d77525-17fc-45c7-8f09-832d53239799',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'Kind',
            'Kind',
            'Agent, Action, Query, View, Dashboard, Component or KnowledgeSource. TargetEntityID must be the kind''s entity.',
            'nvarchar',
            60,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'db82e528-4e7a-45db-933b-cc7d5523053e' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'TargetEntityID')) BEGIN
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
            'db82e528-4e7a-45db-933b-cc7d5523053e',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'TargetEntityID',
            'Target Entity ID',
            'The target''s entity: MJ: AI Agents, MJ: Actions, MJ: Queries, MJ: User Views, MJ: Dashboards, MJ: Components or MJ: Content Sources, by Kind.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '060a8c3e-0e88-4df9-929d-ef02eba052e0' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'TargetRecordID')) BEGIN
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
            '060a8c3e-0e88-4df9-929d-ef02eba052e0',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'TargetRecordID',
            'Target Record ID',
            'The target record''s key.',
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
            0,
            0,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1a069960-dbca-4255-96a3-b15e43916698' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'Label')) BEGIN
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
            '1a069960-dbca-4255-96a3-b15e43916698',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'Label',
            'Label',
            'What the space calls the target; null uses the target''s own name.',
            'nvarchar',
            400,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '26914bff-ee45-4659-825c-c8fc1871d1c1' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'Band')) BEGIN
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
            '26914bff-ee45-4659-825c-c8fc1871d1c1',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'Band',
            'Band',
            'The band that may use the grant (D31). A Team grant is not offered in a chat where anyone cannot see Team.',
            'nvarchar',
            20,
            0,
            0,
            0,
            'Shared',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'bd9aaaa7-2a0c-438e-bf38-4e7ae0427352' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'IsDefault')) BEGIN
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
            'bd9aaaa7-2a0c-438e-bf38-4e7ae0427352',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'IsDefault',
            'Is Default',
            'For an Agent grant: the agent a chat at this level starts with. One per level.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0f31358b-bd5e-4305-b125-49b7fdfb1cd1' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'Bindings')) BEGIN
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
            '0f31358b-bd5e-4305-b125-49b7fdfb1cd1',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'Bindings',
            'Bindings',
            'JSON (SpaceGrantBindings): the target''s parameter or property names mapped to where each value comes from: an anchor by role, a column of the space, a configuration key, the user, or a literal (D27).',
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
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '656f486f-6113-4ef7-8f50-c58204997a04' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'Settings')) BEGIN
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
            '656f486f-6113-4ef7-8f50-c58204997a04',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'Settings',
            'Settings',
            'JSON (AgentGrantSettings) for an Agent grant: skills, plan mode, effort, memory writes and per-run limits, each only narrowing the agent''s own definition (D31). Null for the other kinds.',
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
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '304ad3ab-bd76-42fe-ae49-f1edcae5b55c' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'Mode')) BEGIN
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
            '304ad3ab-bd76-42fe-ae49-f1edcae5b55c',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'Mode',
            'Mode',
            'Extend adds the target at this level; Remove takes a target granted above out of this level''s list (D30).',
            'nvarchar',
            20,
            0,
            0,
            0,
            'Extend',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '944f76cd-93c3-4c2f-81da-105444404bcd' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'Sequence')) BEGIN
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
            '944f76cd-93c3-4c2f-81da-105444404bcd',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'Sequence',
            'Sequence',
            'Display order within the level.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2f8725c4-cf06-465a-8ff6-b8f05373c11e' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = '__mj_CreatedAt')) BEGIN
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
            '2f8725c4-cf06-465a-8ff6-b8f05373c11e',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '532e5c01-30e3-4a72-b091-baf379a4ad42' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '532e5c01-30e3-4a72-b091-baf379a4ad42',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
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

/* SQL text to insert entity field value with ID 202341d4-9094-4c1c-9527-855e9b40e3de */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('202341d4-9094-4c1c-9527-855e9b40e3de', 'B6D77525-17FC-45C7-8F09-832D53239799', 1, 'Action', 'Action', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID b443309a-84ae-427e-ac8b-6206142ff490 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('b443309a-84ae-427e-ac8b-6206142ff490', 'B6D77525-17FC-45C7-8F09-832D53239799', 2, 'Agent', 'Agent', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID d82dab23-a5a7-49d1-a79b-b07bb943e215 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('d82dab23-a5a7-49d1-a79b-b07bb943e215', 'B6D77525-17FC-45C7-8F09-832D53239799', 3, 'Component', 'Component', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 6ac4d86e-6597-4cf8-8974-3298dcd21dfd */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('6ac4d86e-6597-4cf8-8974-3298dcd21dfd', 'B6D77525-17FC-45C7-8F09-832D53239799', 4, 'Dashboard', 'Dashboard', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 1de03d24-7456-4f28-890c-b25221ed8e5d */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('1de03d24-7456-4f28-890c-b25221ed8e5d', 'B6D77525-17FC-45C7-8F09-832D53239799', 5, 'KnowledgeSource', 'KnowledgeSource', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 757236cf-1f09-47cb-976b-736df03157a3 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('757236cf-1f09-47cb-976b-736df03157a3', 'B6D77525-17FC-45C7-8F09-832D53239799', 6, 'Query', 'Query', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID f21f075f-1ddb-4c87-8c4b-6016ed56255e */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('f21f075f-1ddb-4c87-8c4b-6016ed56255e', 'B6D77525-17FC-45C7-8F09-832D53239799', 7, 'View', 'View', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID B6D77525-17FC-45C7-8F09-832D53239799 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='B6D77525-17FC-45C7-8F09-832D53239799';

/* SQL text to insert entity field value with ID 838771a4-ed8b-4161-9a69-fee13f1a9ad0 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('838771a4-ed8b-4161-9a69-fee13f1a9ad0', '26914BFF-EE45-4659-825C-C8FC1871D1C1', 1, 'Shared', 'Shared', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID e7b830bf-0340-4f0e-a839-dcc7e30b2460 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('e7b830bf-0340-4f0e-a839-dcc7e30b2460', '26914BFF-EE45-4659-825C-C8FC1871D1C1', 2, 'Team', 'Team', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 26914BFF-EE45-4659-825C-C8FC1871D1C1 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='26914BFF-EE45-4659-825C-C8FC1871D1C1';

/* SQL text to insert entity field value with ID 73f66846-7cee-43e3-98f9-b03df7516d54 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('73f66846-7cee-43e3-98f9-b03df7516d54', '304AD3AB-BD76-42FE-AE49-F1EDCAE5B55C', 1, 'Extend', 'Extend', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 7f501955-6a94-44f9-9b18-bbd91b67ebaa */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('7f501955-6a94-44f9-9b18-bbd91b67ebaa', '304AD3AB-BD76-42FE-AE49-F1EDCAE5B55C', 2, 'Remove', 'Remove', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 304AD3AB-BD76-42FE-AE49-F1EDCAE5B55C */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='304AD3AB-BD76-42FE-AE49-F1EDCAE5B55C';

/* SQL text to insert entity field value with ID 19e0604e-7013-4157-bc7c-f0d7fa1684e1 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('19e0604e-7013-4157-bc7c-f0d7fa1684e1', 'AD6A55D3-8F26-4D9F-A277-3C8E92755BA9', 1, 'Shared', 'Shared', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID a62336b0-cf07-4f19-9c1f-84df920ea648 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('a62336b0-cf07-4f19-9c1f-84df920ea648', 'AD6A55D3-8F26-4D9F-A277-3C8E92755BA9', 2, 'Team', 'Team', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID AD6A55D3-8F26-4D9F-A277-3C8E92755BA9 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='AD6A55D3-8F26-4D9F-A277-3C8E92755BA9';

/* SQL text to insert entity field value with ID e2be5caa-d037-44ca-8223-af7a10a06c22 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('e2be5caa-d037-44ca-8223-af7a10a06c22', '8C2B6090-02C5-4C9E-BD3F-9CE0A99E25B9', 1, 'Private', 'Private', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 3c6b9eb2-4193-495c-9a0a-08d718a1509d */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('3c6b9eb2-4193-495c-9a0a-08d718a1509d', '8C2B6090-02C5-4C9E-BD3F-9CE0A99E25B9', 2, 'Space', 'Space', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 8C2B6090-02C5-4C9E-BD3F-9CE0A99E25B9 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='8C2B6090-02C5-4C9E-BD3F-9CE0A99E25B9';

/* SQL text to insert entity field value with ID ffb095f7-0ca9-4866-9722-d5894510caa5 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('ffb095f7-0ca9-4866-9722-d5894510caa5', '12BE73D4-06F7-4830-B2CF-4A30F73B74C7', 1, 'Grant', 'Grant', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID e64ab2ce-62e4-41a6-b7d8-d1d164f4ce7c */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('e64ab2ce-62e4-41a6-b7d8-d1d164f4ce7c', '12BE73D4-06F7-4830-B2CF-4A30F73B74C7', 2, 'Record', 'Record', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 12BE73D4-06F7-4830-B2CF-4A30F73B74C7 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='12BE73D4-06F7-4830-B2CF-4A30F73B74C7';

/* Deterministic search-flag hygiene — seed name fields */

         UPDATE [${mjSchema}].[EntityField]
         SET [IncludeInUserSearchAPI] = 1,
             [UserSearchPredicateAPI] = 'BeginsWith'
         WHERE [ID] IN (
            SELECT ranked.[ID] FROM (
               SELECT f.[ID],
                      ROW_NUMBER() OVER (
                         PARTITION BY f.[EntityID]
                         ORDER BY f.[Sequence], f.[Name]
                      ) AS rn
               FROM [${mjSchema}].[EntityField] f
               INNER JOIN [${mjSchema}].[Entity] e ON e.[ID] = f.[EntityID]
               WHERE LOWER(f.[Name]) IN ('name','title','firstname','lastname','middlename','displayname','fullname','label')
                 AND f.[AutoUpdateIncludeInUserSearchAPI] = 1
                 AND f.[IncludeInUserSearchAPI] = 0
                 AND ISNULL(f.[IsPrimaryKey], 0) = 0
                 AND ISNULL(f.[IsVirtual], 0) = 0
                 AND LOWER(f.[Type]) IN ('nvarchar','varchar','char','nchar')
                 AND ISNULL(f.[Length], 0) <> -1
                 AND e.[VirtualEntity] = 0
                 AND e.[AllowUserSearchAPI] = 1
                 AND ISNULL(e.[FullTextSearchEnabled], 0) = 0
                 AND NOT ((e.[Name] = 'Logs' OR e.[Name] LIKE '% Logs') OR (e.[Name] = 'Log' OR e.[Name] LIKE '% Log') OR (e.[Name] = 'Runs' OR e.[Name] LIKE '% Runs') OR (e.[Name] = 'Run' OR e.[Name] LIKE '% Run') OR (e.[Name] = 'Run History' OR e.[Name] LIKE '% Run History') OR (e.[Name] = 'Run Steps' OR e.[Name] LIKE '% Run Steps') OR (e.[Name] = 'Run Messages' OR e.[Name] LIKE '% Run Messages') OR (e.[Name] = 'Execution Logs' OR e.[Name] LIKE '% Execution Logs') OR (e.[Name] = 'Details' OR e.[Name] LIKE '% Details') OR (e.[Name] = 'Detail' OR e.[Name] LIKE '% Detail') OR (e.[Name] = 'Lines' OR e.[Name] LIKE '% Lines') OR (e.[Name] = 'Line' OR e.[Name] LIKE '% Line') OR (e.[Name] = 'Items' OR e.[Name] LIKE '% Items') OR (e.[Name] = 'Item' OR e.[Name] LIKE '% Item') OR (e.[Name] = 'Steps' OR e.[Name] LIKE '% Steps') OR (e.[Name] = 'Step' OR e.[Name] LIKE '% Step') OR (e.[Name] = 'Params' OR e.[Name] LIKE '% Params') OR (e.[Name] = 'Param' OR e.[Name] LIKE '% Param') OR (e.[Name] = 'Mappings' OR e.[Name] LIKE '% Mappings') OR (e.[Name] = 'Mapping' OR e.[Name] LIKE '% Mapping') OR (e.[Name] = 'Audit' OR e.[Name] LIKE 'Audit %' OR e.[Name] LIKE '% Audit' OR e.[Name] LIKE '% Audit %') OR (e.[Name] = 'Record Change' OR e.[Name] LIKE 'Record Change %' OR e.[Name] LIKE '% Record Change' OR e.[Name] LIKE '% Record Change %'))
                 AND e.[SchemaName] NOT IN ('sys','staging','dbo','${mjSchema}','${mjSchema}_BizAppsCommon','${mjSchema}_BizAppsTasks')
                 AND NOT EXISTS (
               SELECT 1 FROM [${mjSchema}].[EntityField] f2
               WHERE f2.[EntityID] = e.[ID]
                 AND f2.[IncludeInUserSearchAPI] = 1
            )
            ) ranked
            WHERE ranked.rn <= 3
         );

/* Deterministic search-flag hygiene — clear AllowUserSearchAPI */

         UPDATE [${mjSchema}].[Entity]
         SET [AllowUserSearchAPI] = 0
         WHERE [ID] IN (
            SELECT e.[ID]
            FROM [${mjSchema}].[Entity] e
            WHERE e.[AllowUserSearchAPI] = 1
              AND e.[AutoUpdateAllowUserSearchAPI] = 1
              AND e.[VirtualEntity] = 0
              AND ISNULL(e.[FullTextSearchEnabled], 0) = 0
              AND e.[SchemaName] NOT IN ('sys','staging','dbo','${mjSchema}','${mjSchema}_BizAppsCommon','${mjSchema}_BizAppsTasks')
              AND NOT EXISTS (
               SELECT 1 FROM [${mjSchema}].[EntityField] f2
               WHERE f2.[EntityID] = e.[ID]
                 AND f2.[IncludeInUserSearchAPI] = 1
            )
         );


/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Type Status -> MJ_BizApps_Collaboration: Spaces (One To Many via StatusID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'ff1a837e-dda9-4648-8e60-a432895d1d19'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('ff1a837e-dda9-4648-8e60-a432895d1d19', '106DF2B5-DF08-48EE-A0E1-26C329DC0343', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'StatusID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Types -> MJ_BizApps_Collaboration: Space Anchors (One To Many via SpaceTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'ca823ed3-22db-41de-85af-16c4bcf7d49c'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('ca823ed3-22db-41de-85af-16c4bcf7d49c', '01596359-EC4B-449C-BA16-316DE4B92A4E', '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 'SpaceTypeID', 'One To Many', 1, 1, 2, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Types -> MJ_BizApps_Collaboration: Space Type Status (One To Many via SpaceTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'd38c78bc-0be9-4263-8a8b-9147dc64a21b'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('d38c78bc-0be9-4263-8a8b-9147dc64a21b', '01596359-EC4B-449C-BA16-316DE4B92A4E', '106DF2B5-DF08-48EE-A0E1-26C329DC0343', 'SpaceTypeID', 'One To Many', 1, 1, 3, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Types -> MJ_BizApps_Collaboration: Space Grants (One To Many via SpaceTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '80d1d4cf-91ab-4e9e-bbb7-a2e26ffbaa8a'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('80d1d4cf-91ab-4e9e-bbb7-a2e26ffbaa8a', '01596359-EC4B-449C-BA16-316DE4B92A4E', 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 'SpaceTypeID', 'One To Many', 1, 1, 4, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Anchors (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '7fbb5eb4-25fb-4156-9d3f-eab125e98159'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('7fbb5eb4-25fb-4156-9d3f-eab125e98159', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 'SpaceID', 'One To Many', 1, 1, 7, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Member Pins (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '34db92cd-e313-490c-86b5-798d71841766'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('34db92cd-e313-490c-86b5-798d71841766', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', '1DDE95B7-60B7-4A08-A886-57550B425C58', 'SpaceID', 'One To Many', 1, 1, 8, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Notes (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '1919c03b-e33c-4053-b110-ac6731f4c4f2'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('1919c03b-e33c-4053-b110-ac6731f4c4f2', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 'SpaceID', 'One To Many', 1, 1, 9, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Grants (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'dbc6807a-c089-45d4-82ef-28221acbb213'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('dbc6807a-c089-45d4-82ef-28221acbb213', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 'SpaceID', 'One To Many', 1, 1, 10, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Entities -> MJ_BizApps_Collaboration: Space Anchors (One To Many via EntityID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '79afc009-befe-43be-85c2-5d5b5b647db6'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('79afc009-befe-43be-85c2-5d5b5b647db6', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 'EntityID', 'One To Many', 1, 1, 86, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Entities -> MJ_BizApps_Collaboration: Space Member Pins (One To Many via TargetEntityID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'dbbad564-4c48-4f2e-aee9-b002889c5f81'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('dbbad564-4c48-4f2e-aee9-b002889c5f81', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '1DDE95B7-60B7-4A08-A886-57550B425C58', 'TargetEntityID', 'One To Many', 1, 1, 87, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Entities -> MJ_BizApps_Collaboration: Space Grants (One To Many via TargetEntityID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '659406ad-e775-46cd-856f-c7b59f6c5443'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('659406ad-e775-46cd-856f-c7b59f6c5443', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 'TargetEntityID', 'One To Many', 1, 1, 88, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Collaboration: Space Member Pins (One To Many via UserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '05c9d60d-27af-409e-9f73-cf609f548c68'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('05c9d60d-27af-409e-9f73-cf609f548c68', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', '1DDE95B7-60B7-4A08-A886-57550B425C58', 'UserID', 'One To Many', 1, 1, 117, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Collaboration: Space Notes (One To Many via AuthorUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '6f2e2e36-f1b1-4719-8c33-e1e35e2ec06d'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('6f2e2e36-f1b1-4719-8c33-e1e35e2ec06d', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 'AuthorUserID', 'One To Many', 1, 1, 118, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Grants -> MJ_BizApps_Collaboration: Space Member Pins (One To Many via GrantID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'a20c2b6c-6803-4a14-9fd5-86ac05380a7f'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('a20c2b6c-6803-4a14-9fd5-86ac05380a7f', 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', '1DDE95B7-60B7-4A08-A886-57550B425C58', 'GrantID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Artifact Versions -> MJ_BizApps_Collaboration: Space Items (One To Many via ArtifactVersionID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '8326ef38-089d-4bfc-b3f0-edaf47bf74b8'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('8326ef38-089d-4bfc-b3f0-edaf47bf74b8', 'AEB408D2-162A-49AE-9DC2-DBE9A21A3C01', '41165FEC-A52B-469A-A880-3B108C39A65E', 'ArtifactVersionID', 'One To Many', 1, 1, 7, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for SpaceAnchor */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Anchors
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table SpaceAnchor
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAnchor_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAnchor]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAnchor_SpaceID ON [${flyway:defaultSchema}].[SpaceAnchor] ([SpaceID]);

-- Index for foreign key SpaceTypeID in table SpaceAnchor
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAnchor_SpaceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAnchor]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAnchor_SpaceTypeID ON [${flyway:defaultSchema}].[SpaceAnchor] ([SpaceTypeID]);

-- Index for foreign key EntityID in table SpaceAnchor
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAnchor_EntityID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAnchor]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAnchor_EntityID ON [${flyway:defaultSchema}].[SpaceAnchor] ([EntityID]);

/* SQL text to update entity field related entity name field map for entity field ID 817B73B0-FFAC-455D-8893-7E10F469014B */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='817B73B0-FFAC-455D-8893-7E10F469014B', @RelatedEntityNameFieldMap='Space';

/* Index for Foreign Keys for SpaceGrant */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Grants
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceTypeID in table SpaceGrant
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceGrant_SpaceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceGrant]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceGrant_SpaceTypeID ON [${flyway:defaultSchema}].[SpaceGrant] ([SpaceTypeID]);

-- Index for foreign key SpaceID in table SpaceGrant
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceGrant_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceGrant]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceGrant_SpaceID ON [${flyway:defaultSchema}].[SpaceGrant] ([SpaceID]);

-- Index for foreign key TargetEntityID in table SpaceGrant
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceGrant_TargetEntityID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceGrant]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceGrant_TargetEntityID ON [${flyway:defaultSchema}].[SpaceGrant] ([TargetEntityID]);

/* SQL text to update entity field related entity name field map for entity field ID F67EA75A-DDBB-4329-A306-00F95A0D3827 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='F67EA75A-DDBB-4329-A306-00F95A0D3827', @RelatedEntityNameFieldMap='SpaceType';

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

-- Index for foreign key ArtifactVersionID in table SpaceItem
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceItem_ArtifactVersionID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceItem]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceItem_ArtifactVersionID ON [${flyway:defaultSchema}].[SpaceItem] ([ArtifactVersionID]);

/* SQL text to update entity field related entity name field map for entity field ID 0A0C811B-7A58-4B90-B5F9-A67D4D06C706 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='0A0C811B-7A58-4B90-B5F9-A67D4D06C706', @RelatedEntityNameFieldMap='ArtifactVersion';

/* Index for Foreign Keys for SpaceMemberPin */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Member Pins
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table SpaceMemberPin
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMemberPin_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMemberPin]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMemberPin_SpaceID ON [${flyway:defaultSchema}].[SpaceMemberPin] ([SpaceID]);

-- Index for foreign key UserID in table SpaceMemberPin
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMemberPin_UserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMemberPin]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMemberPin_UserID ON [${flyway:defaultSchema}].[SpaceMemberPin] ([UserID]);

-- Index for foreign key TargetEntityID in table SpaceMemberPin
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMemberPin_TargetEntityID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMemberPin]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMemberPin_TargetEntityID ON [${flyway:defaultSchema}].[SpaceMemberPin] ([TargetEntityID]);

-- Index for foreign key GrantID in table SpaceMemberPin
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMemberPin_GrantID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMemberPin]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMemberPin_GrantID ON [${flyway:defaultSchema}].[SpaceMemberPin] ([GrantID]);

/* SQL text to update entity field related entity name field map for entity field ID 7DDB7D3F-7DD6-44C2-8EC4-B941ADF567D7 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='7DDB7D3F-7DD6-44C2-8EC4-B941ADF567D7', @RelatedEntityNameFieldMap='Space';

/* SQL text to update entity field related entity name field map for entity field ID 0BC6C9F2-EAC4-4695-9A62-57A997CEE92A */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='0BC6C9F2-EAC4-4695-9A62-57A997CEE92A', @RelatedEntityNameFieldMap='Space';

/* SQL text to update entity field related entity name field map for entity field ID 0DDF6F20-20ED-4C75-B444-73206EB07BAE */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='0DDF6F20-20ED-4C75-B444-73206EB07BAE', @RelatedEntityNameFieldMap='SpaceType';

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
    MJUser_PromotedByUserID.[Name] AS [PromotedByUser],
    MJArtifactVersion_ArtifactVersionID.[Name] AS [ArtifactVersion]
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
LEFT OUTER JOIN
    [${mjSchema}].[ArtifactVersion] AS MJArtifactVersion_ArtifactVersionID
  ON
    [s].[ArtifactVersionID] = MJArtifactVersion_ArtifactVersionID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_UI]
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

REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_UI]
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
    @PromotedByUserID uniqueidentifier = NULL,
    @Folder_Clear bit = 0,
    @Folder nvarchar(200) = NULL,
    @ArtifactVersionID_Clear bit = 0,
    @ArtifactVersionID uniqueidentifier = NULL
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
                [PromotedByUserID],
                [Folder],
                [ArtifactVersionID]
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
                CASE WHEN @PromotedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PromotedByUserID, NULL) END,
                CASE WHEN @Folder_Clear = 1 THEN NULL ELSE ISNULL(@Folder, NULL) END,
                CASE WHEN @ArtifactVersionID_Clear = 1 THEN NULL ELSE ISNULL(@ArtifactVersionID, NULL) END
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
                [PromotedByUserID],
                [Folder],
                [ArtifactVersionID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @EntityID,
                @RecordID,
                @Band,
                CASE WHEN @PromotedAt_Clear = 1 THEN NULL ELSE ISNULL(@PromotedAt, NULL) END,
                CASE WHEN @PromotedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PromotedByUserID, NULL) END,
                CASE WHEN @Folder_Clear = 1 THEN NULL ELSE ISNULL(@Folder, NULL) END,
                CASE WHEN @ArtifactVersionID_Clear = 1 THEN NULL ELSE ISNULL(@ArtifactVersionID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceItems] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Items */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_UI]
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
    @PromotedByUserID uniqueidentifier = NULL,
    @Folder_Clear bit = 0,
    @Folder nvarchar(200) = NULL,
    @ArtifactVersionID_Clear bit = 0,
    @ArtifactVersionID uniqueidentifier = NULL
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
        [PromotedByUserID] = CASE WHEN @PromotedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PromotedByUserID, [PromotedByUserID]) END,
        [Folder] = CASE WHEN @Folder_Clear = 1 THEN NULL ELSE ISNULL(@Folder, [Folder]) END,
        [ArtifactVersionID] = CASE WHEN @ArtifactVersionID_Clear = 1 THEN NULL ELSE ISNULL(@ArtifactVersionID, [ArtifactVersionID]) END
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

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] FROM [cdp_UI]
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

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] FROM [cdp_UI]
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
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Items */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update entity field related entity name field map for entity field ID 8E465BEA-BC4D-4BDF-8D0E-ED1657E549B3 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='8E465BEA-BC4D-4BDF-8D0E-ED1657E549B3', @RelatedEntityNameFieldMap='User';

/* SQL text to update entity field related entity name field map for entity field ID BFF04097-AE6C-4C41-8D7E-D48642B145D5 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='BFF04097-AE6C-4C41-8D7E-D48642B145D5', @RelatedEntityNameFieldMap='Entity';

/* SQL text to update entity field related entity name field map for entity field ID DB82E528-4E7A-45DB-933B-CC7D5523053E */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='DB82E528-4E7A-45DB-933B-CC7D5523053E', @RelatedEntityNameFieldMap='TargetEntity';

/* SQL text to update entity field related entity name field map for entity field ID 6851483E-7F66-4721-96FA-C929F5A4B360 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='6851483E-7F66-4721-96FA-C929F5A4B360', @RelatedEntityNameFieldMap='TargetEntity';

/* Base View SQL for MJ_BizApps_Collaboration: Space Anchors */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Anchors
-- Item: vwSpaceAnchors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Anchors
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceAnchor
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceAnchors]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceAnchors];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceAnchors]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    mjBizAppsCollaborationSpaceType_SpaceTypeID.[Name] AS [SpaceType],
    MJEntity_EntityID.[Name] AS [Entity]
FROM
    [${flyway:defaultSchema}].[SpaceAnchor] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[SpaceType] AS mjBizAppsCollaborationSpaceType_SpaceTypeID
  ON
    [s].[SpaceTypeID] = mjBizAppsCollaborationSpaceType_SpaceTypeID.[ID]
INNER JOIN
    [${mjSchema}].[Entity] AS MJEntity_EntityID
  ON
    [s].[EntityID] = MJEntity_EntityID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAnchors] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Anchors */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Anchors
-- Item: Permissions for vwSpaceAnchors
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAnchors] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Anchors */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Anchors
-- Item: spCreateSpaceAnchor
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceAnchor
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceAnchor]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceAnchor];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceAnchor]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @SpaceTypeID uniqueidentifier,
    @EntityID uniqueidentifier,
    @RecordID nvarchar(450),
    @Role nvarchar(100),
    @IsPrimary bit = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceAnchor]
            (
                [ID],
                [SpaceID],
                [SpaceTypeID],
                [EntityID],
                [RecordID],
                [Role],
                [IsPrimary],
                [Sequence]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @SpaceTypeID,
                @EntityID,
                @RecordID,
                @Role,
                ISNULL(@IsPrimary, 0),
                ISNULL(@Sequence, 0)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceAnchor]
            (
                [SpaceID],
                [SpaceTypeID],
                [EntityID],
                [RecordID],
                [Role],
                [IsPrimary],
                [Sequence]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @SpaceTypeID,
                @EntityID,
                @RecordID,
                @Role,
                ISNULL(@IsPrimary, 0),
                ISNULL(@Sequence, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceAnchors] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAnchor] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Anchors */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAnchor] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Anchors */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Anchors
-- Item: spUpdateSpaceAnchor
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceAnchor
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceAnchor]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceAnchor];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceAnchor]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @SpaceTypeID uniqueidentifier = NULL,
    @EntityID uniqueidentifier = NULL,
    @RecordID nvarchar(450) = NULL,
    @Role nvarchar(100) = NULL,
    @IsPrimary bit = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceAnchor]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [SpaceTypeID] = ISNULL(@SpaceTypeID, [SpaceTypeID]),
        [EntityID] = ISNULL(@EntityID, [EntityID]),
        [RecordID] = ISNULL(@RecordID, [RecordID]),
        [Role] = ISNULL(@Role, [Role]),
        [IsPrimary] = ISNULL(@IsPrimary, [IsPrimary]),
        [Sequence] = ISNULL(@Sequence, [Sequence])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceAnchors] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceAnchors]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAnchor] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceAnchor table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceAnchor]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceAnchor];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceAnchor
ON [${flyway:defaultSchema}].[SpaceAnchor]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceAnchor]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceAnchor] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Anchors */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAnchor] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Anchors */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Anchors
-- Item: spDeleteSpaceAnchor
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceAnchor
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceAnchor]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceAnchor];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceAnchor]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceAnchor]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAnchor] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Anchors */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAnchor] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Space Member Pins */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Member Pins
-- Item: vwSpaceMemberPins
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Member Pins
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceMemberPin
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceMemberPins]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceMemberPins];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceMemberPins]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_UserID.[Name] AS [User],
    MJEntity_TargetEntityID.[Name] AS [TargetEntity]
FROM
    [${flyway:defaultSchema}].[SpaceMemberPin] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_UserID
  ON
    [s].[UserID] = MJUser_UserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Entity] AS MJEntity_TargetEntityID
  ON
    [s].[TargetEntityID] = MJEntity_TargetEntityID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMemberPins] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Member Pins */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Member Pins
-- Item: Permissions for vwSpaceMemberPins
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMemberPins] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Member Pins */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Member Pins
-- Item: spCreateSpaceMemberPin
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceMemberPin
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceMemberPin]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceMemberPin];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceMemberPin]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @UserID uniqueidentifier,
    @Kind nvarchar(20),
    @TargetEntityID_Clear bit = 0,
    @TargetEntityID uniqueidentifier = NULL,
    @TargetRecordID_Clear bit = 0,
    @TargetRecordID nvarchar(450) = NULL,
    @GrantID_Clear bit = 0,
    @GrantID uniqueidentifier = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceMemberPin]
            (
                [ID],
                [SpaceID],
                [UserID],
                [Kind],
                [TargetEntityID],
                [TargetRecordID],
                [GrantID],
                [Sequence]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @UserID,
                @Kind,
                CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE ISNULL(@TargetEntityID, NULL) END,
                CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE ISNULL(@TargetRecordID, NULL) END,
                CASE WHEN @GrantID_Clear = 1 THEN NULL ELSE ISNULL(@GrantID, NULL) END,
                ISNULL(@Sequence, 0)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceMemberPin]
            (
                [SpaceID],
                [UserID],
                [Kind],
                [TargetEntityID],
                [TargetRecordID],
                [GrantID],
                [Sequence]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @UserID,
                @Kind,
                CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE ISNULL(@TargetEntityID, NULL) END,
                CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE ISNULL(@TargetRecordID, NULL) END,
                CASE WHEN @GrantID_Clear = 1 THEN NULL ELSE ISNULL(@GrantID, NULL) END,
                ISNULL(@Sequence, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceMemberPins] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMemberPin] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Member Pins */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMemberPin] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Member Pins */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Member Pins
-- Item: spUpdateSpaceMemberPin
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceMemberPin
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceMemberPin]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceMemberPin];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceMemberPin]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @UserID uniqueidentifier = NULL,
    @Kind nvarchar(20) = NULL,
    @TargetEntityID_Clear bit = 0,
    @TargetEntityID uniqueidentifier = NULL,
    @TargetRecordID_Clear bit = 0,
    @TargetRecordID nvarchar(450) = NULL,
    @GrantID_Clear bit = 0,
    @GrantID uniqueidentifier = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceMemberPin]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [UserID] = ISNULL(@UserID, [UserID]),
        [Kind] = ISNULL(@Kind, [Kind]),
        [TargetEntityID] = CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE ISNULL(@TargetEntityID, [TargetEntityID]) END,
        [TargetRecordID] = CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE ISNULL(@TargetRecordID, [TargetRecordID]) END,
        [GrantID] = CASE WHEN @GrantID_Clear = 1 THEN NULL ELSE ISNULL(@GrantID, [GrantID]) END,
        [Sequence] = ISNULL(@Sequence, [Sequence])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceMemberPins] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceMemberPins]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMemberPin] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceMemberPin table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceMemberPin]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceMemberPin];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceMemberPin
ON [${flyway:defaultSchema}].[SpaceMemberPin]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceMemberPin]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceMemberPin] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Member Pins */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMemberPin] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Member Pins */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Member Pins
-- Item: spDeleteSpaceMemberPin
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceMemberPin
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceMemberPin]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceMemberPin];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceMemberPin]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceMemberPin]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMemberPin] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Member Pins */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMemberPin] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Space Grants */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Grants
-- Item: vwSpaceGrants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Grants
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceGrant
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceGrants]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceGrants];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceGrants]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpaceType_SpaceTypeID.[Name] AS [SpaceType],
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJEntity_TargetEntityID.[Name] AS [TargetEntity]
FROM
    [${flyway:defaultSchema}].[SpaceGrant] AS s
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[SpaceType] AS mjBizAppsCollaborationSpaceType_SpaceTypeID
  ON
    [s].[SpaceTypeID] = mjBizAppsCollaborationSpaceType_SpaceTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[Entity] AS MJEntity_TargetEntityID
  ON
    [s].[TargetEntityID] = MJEntity_TargetEntityID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceGrants] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Grants */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Grants
-- Item: Permissions for vwSpaceGrants
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceGrants] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Grants */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Grants
-- Item: spCreateSpaceGrant
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceGrant
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceGrant]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceGrant];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceGrant]
    @ID uniqueidentifier = NULL,
    @SpaceTypeID_Clear bit = 0,
    @SpaceTypeID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL,
    @Kind nvarchar(30),
    @TargetEntityID uniqueidentifier,
    @TargetRecordID nvarchar(450),
    @Label_Clear bit = 0,
    @Label nvarchar(200) = NULL,
    @Band nvarchar(10) = NULL,
    @IsDefault bit = NULL,
    @Bindings_Clear bit = 0,
    @Bindings nvarchar(MAX) = NULL,
    @Settings_Clear bit = 0,
    @Settings nvarchar(MAX) = NULL,
    @Mode nvarchar(10) = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceGrant]
            (
                [ID],
                [SpaceTypeID],
                [SpaceID],
                [Kind],
                [TargetEntityID],
                [TargetRecordID],
                [Label],
                [Band],
                [IsDefault],
                [Bindings],
                [Settings],
                [Mode],
                [Sequence]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, NULL) END,
                CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, NULL) END,
                @Kind,
                @TargetEntityID,
                @TargetRecordID,
                CASE WHEN @Label_Clear = 1 THEN NULL ELSE ISNULL(@Label, NULL) END,
                ISNULL(@Band, 'Shared'),
                ISNULL(@IsDefault, 0),
                CASE WHEN @Bindings_Clear = 1 THEN NULL ELSE ISNULL(@Bindings, NULL) END,
                CASE WHEN @Settings_Clear = 1 THEN NULL ELSE ISNULL(@Settings, NULL) END,
                ISNULL(@Mode, 'Extend'),
                ISNULL(@Sequence, 0)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceGrant]
            (
                [SpaceTypeID],
                [SpaceID],
                [Kind],
                [TargetEntityID],
                [TargetRecordID],
                [Label],
                [Band],
                [IsDefault],
                [Bindings],
                [Settings],
                [Mode],
                [Sequence]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, NULL) END,
                CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, NULL) END,
                @Kind,
                @TargetEntityID,
                @TargetRecordID,
                CASE WHEN @Label_Clear = 1 THEN NULL ELSE ISNULL(@Label, NULL) END,
                ISNULL(@Band, 'Shared'),
                ISNULL(@IsDefault, 0),
                CASE WHEN @Bindings_Clear = 1 THEN NULL ELSE ISNULL(@Bindings, NULL) END,
                CASE WHEN @Settings_Clear = 1 THEN NULL ELSE ISNULL(@Settings, NULL) END,
                ISNULL(@Mode, 'Extend'),
                ISNULL(@Sequence, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceGrants] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceGrant] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Grants */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceGrant] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Grants */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Grants
-- Item: spUpdateSpaceGrant
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceGrant
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceGrant]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceGrant];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceGrant]
    @ID uniqueidentifier,
    @SpaceTypeID_Clear bit = 0,
    @SpaceTypeID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL,
    @Kind nvarchar(30) = NULL,
    @TargetEntityID uniqueidentifier = NULL,
    @TargetRecordID nvarchar(450) = NULL,
    @Label_Clear bit = 0,
    @Label nvarchar(200) = NULL,
    @Band nvarchar(10) = NULL,
    @IsDefault bit = NULL,
    @Bindings_Clear bit = 0,
    @Bindings nvarchar(MAX) = NULL,
    @Settings_Clear bit = 0,
    @Settings nvarchar(MAX) = NULL,
    @Mode nvarchar(10) = NULL,
    @Sequence int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceGrant]
    SET
        [SpaceTypeID] = CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, [SpaceTypeID]) END,
        [SpaceID] = CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, [SpaceID]) END,
        [Kind] = ISNULL(@Kind, [Kind]),
        [TargetEntityID] = ISNULL(@TargetEntityID, [TargetEntityID]),
        [TargetRecordID] = ISNULL(@TargetRecordID, [TargetRecordID]),
        [Label] = CASE WHEN @Label_Clear = 1 THEN NULL ELSE ISNULL(@Label, [Label]) END,
        [Band] = ISNULL(@Band, [Band]),
        [IsDefault] = ISNULL(@IsDefault, [IsDefault]),
        [Bindings] = CASE WHEN @Bindings_Clear = 1 THEN NULL ELSE ISNULL(@Bindings, [Bindings]) END,
        [Settings] = CASE WHEN @Settings_Clear = 1 THEN NULL ELSE ISNULL(@Settings, [Settings]) END,
        [Mode] = ISNULL(@Mode, [Mode]),
        [Sequence] = ISNULL(@Sequence, [Sequence])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceGrants] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceGrants]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceGrant] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceGrant table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceGrant]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceGrant];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceGrant
ON [${flyway:defaultSchema}].[SpaceGrant]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceGrant]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceGrant] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Grants */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceGrant] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Grants */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Grants
-- Item: spDeleteSpaceGrant
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceGrant
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceGrant]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceGrant];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceGrant]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceGrant]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceGrant] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Grants */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceGrant] TO [cdp_Developer], [cdp_Integration];

/* Index for Foreign Keys for SpaceNote */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Notes
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table SpaceNote
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceNote_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceNote]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceNote_SpaceID ON [${flyway:defaultSchema}].[SpaceNote] ([SpaceID]);

-- Index for foreign key AuthorUserID in table SpaceNote
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceNote_AuthorUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceNote]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceNote_AuthorUserID ON [${flyway:defaultSchema}].[SpaceNote] ([AuthorUserID]);

/* SQL text to update entity field related entity name field map for entity field ID 2C525DBC-BFF7-47A5-9619-BC9251DBEFE1 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='2C525DBC-BFF7-47A5-9619-BC9251DBEFE1', @RelatedEntityNameFieldMap='Space';

/* Index for Foreign Keys for SpaceTypeStatus */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Type Status
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceTypeID in table SpaceTypeStatus
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceTypeStatus_SpaceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceTypeStatus]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceTypeStatus_SpaceTypeID ON [${flyway:defaultSchema}].[SpaceTypeStatus] ([SpaceTypeID]);

/* SQL text to update entity field related entity name field map for entity field ID CF239F2A-ECD3-4025-A1D3-BA2299AF289E */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='CF239F2A-ECD3-4025-A1D3-BA2299AF289E', @RelatedEntityNameFieldMap='SpaceType';

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

-- Index for foreign key StatusID in table Space
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Space_StatusID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Space]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Space_StatusID ON [${flyway:defaultSchema}].[Space] ([StatusID]);

/* SQL text to update entity field related entity name field map for entity field ID 0AF47B63-DA30-4680-8091-E06BE3F2C0B5 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='0AF47B63-DA30-4680-8091-E06BE3F2C0B5', @RelatedEntityNameFieldMap='Status';

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
    MJUser_OwnerID.[Name] AS [Owner],
    mjBizAppsCollaborationSpaceTypeStatus_StatusID.[Name] AS [Status]
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
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[SpaceTypeStatus] AS mjBizAppsCollaborationSpaceTypeStatus_StatusID
  ON
    [s].[StatusID] = mjBizAppsCollaborationSpaceTypeStatus_StatusID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_UI]
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

REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_UI]
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
    @AllowParentAssignees bit = NULL,
    @PlannedCloseAt_Clear bit = 0,
    @PlannedCloseAt datetimeoffset = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Color_Clear bit = 0,
    @Color nvarchar(50) = NULL,
    @BackgroundImageURL_Clear bit = 0,
    @BackgroundImageURL nvarchar(1000) = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL,
    @StatusID_Clear bit = 0,
    @StatusID uniqueidentifier = NULL
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
                [AllowParentAssignees],
                [PlannedCloseAt],
                [IconClass],
                [Color],
                [BackgroundImageURL],
                [Configuration],
                [StatusID]
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
                ISNULL(@InheritsMembership, 0),
                ISNULL(@AgentRetrieval, 'Included'),
                CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                ISNULL(@AllowParentAssignees, 1),
                CASE WHEN @PlannedCloseAt_Clear = 1 THEN NULL ELSE ISNULL(@PlannedCloseAt, NULL) END,
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, NULL) END,
                CASE WHEN @BackgroundImageURL_Clear = 1 THEN NULL ELSE ISNULL(@BackgroundImageURL, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END,
                CASE WHEN @StatusID_Clear = 1 THEN NULL ELSE ISNULL(@StatusID, NULL) END
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
                [AllowParentAssignees],
                [PlannedCloseAt],
                [IconClass],
                [Color],
                [BackgroundImageURL],
                [Configuration],
                [StatusID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceTypeID,
                CASE WHEN @ParentID_Clear = 1 THEN NULL ELSE ISNULL(@ParentID, NULL) END,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @OwnerID,
                ISNULL(@InheritsMembership, 0),
                ISNULL(@AgentRetrieval, 'Included'),
                CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                ISNULL(@AllowParentAssignees, 1),
                CASE WHEN @PlannedCloseAt_Clear = 1 THEN NULL ELSE ISNULL(@PlannedCloseAt, NULL) END,
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, NULL) END,
                CASE WHEN @BackgroundImageURL_Clear = 1 THEN NULL ELSE ISNULL(@BackgroundImageURL, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END,
                CASE WHEN @StatusID_Clear = 1 THEN NULL ELSE ISNULL(@StatusID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaces] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Spaces */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_UI]
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
    @AllowParentAssignees bit = NULL,
    @PlannedCloseAt_Clear bit = 0,
    @PlannedCloseAt datetimeoffset = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Color_Clear bit = 0,
    @Color nvarchar(50) = NULL,
    @BackgroundImageURL_Clear bit = 0,
    @BackgroundImageURL nvarchar(1000) = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL,
    @StatusID_Clear bit = 0,
    @StatusID uniqueidentifier = NULL
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
        [AllowParentAssignees] = ISNULL(@AllowParentAssignees, [AllowParentAssignees]),
        [PlannedCloseAt] = CASE WHEN @PlannedCloseAt_Clear = 1 THEN NULL ELSE ISNULL(@PlannedCloseAt, [PlannedCloseAt]) END,
        [IconClass] = CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, [IconClass]) END,
        [Color] = CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, [Color]) END,
        [BackgroundImageURL] = CASE WHEN @BackgroundImageURL_Clear = 1 THEN NULL ELSE ISNULL(@BackgroundImageURL, [BackgroundImageURL]) END,
        [Configuration] = CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, [Configuration]) END,
        [StatusID] = CASE WHEN @StatusID_Clear = 1 THEN NULL ELSE ISNULL(@StatusID, [StatusID]) END
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

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_UI]
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

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_UI]
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
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Spaces */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update entity field related entity name field map for entity field ID 51C8F841-53DC-4021-95AF-019317D0B7BA */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='51C8F841-53DC-4021-95AF-019317D0B7BA', @RelatedEntityNameFieldMap='AuthorUser';

/* Base View SQL for MJ_BizApps_Collaboration: Space Type Status */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Type Status
-- Item: vwSpaceTypeStatus
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Type Status
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceTypeStatus
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceTypeStatus]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceTypeStatus];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceTypeStatus]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpaceType_SpaceTypeID.[Name] AS [SpaceType]
FROM
    [${flyway:defaultSchema}].[SpaceTypeStatus] AS s
INNER JOIN
    [${flyway:defaultSchema}].[SpaceType] AS mjBizAppsCollaborationSpaceType_SpaceTypeID
  ON
    [s].[SpaceTypeID] = mjBizAppsCollaborationSpaceType_SpaceTypeID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypeStatus] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Type Status */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Type Status
-- Item: Permissions for vwSpaceTypeStatus
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypeStatus] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Type Status */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Type Status
-- Item: spCreateSpaceTypeStatus
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceTypeStatus
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceTypeStatus]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceTypeStatus];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceTypeStatus]
    @ID uniqueidentifier = NULL,
    @SpaceTypeID uniqueidentifier,
    @Code nvarchar(40),
    @Name nvarchar(100),
    @Sequence int,
    @IsDefault bit = NULL,
    @ReadOnly bit = NULL,
    @Visible bit = NULL,
    @AgentRetrieval bit = NULL,
    @CanChangeAfter bit = NULL,
    @NotifyMembersOnEnter bit = NULL,
    @IsTerminal bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceTypeStatus]
            (
                [ID],
                [SpaceTypeID],
                [Code],
                [Name],
                [Sequence],
                [IsDefault],
                [ReadOnly],
                [Visible],
                [AgentRetrieval],
                [CanChangeAfter],
                [NotifyMembersOnEnter],
                [IsTerminal]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceTypeID,
                @Code,
                @Name,
                @Sequence,
                ISNULL(@IsDefault, 0),
                ISNULL(@ReadOnly, 0),
                ISNULL(@Visible, 1),
                ISNULL(@AgentRetrieval, 1),
                ISNULL(@CanChangeAfter, 1),
                ISNULL(@NotifyMembersOnEnter, 0),
                ISNULL(@IsTerminal, 0)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceTypeStatus]
            (
                [SpaceTypeID],
                [Code],
                [Name],
                [Sequence],
                [IsDefault],
                [ReadOnly],
                [Visible],
                [AgentRetrieval],
                [CanChangeAfter],
                [NotifyMembersOnEnter],
                [IsTerminal]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceTypeID,
                @Code,
                @Name,
                @Sequence,
                ISNULL(@IsDefault, 0),
                ISNULL(@ReadOnly, 0),
                ISNULL(@Visible, 1),
                ISNULL(@AgentRetrieval, 1),
                ISNULL(@CanChangeAfter, 1),
                ISNULL(@NotifyMembersOnEnter, 0),
                ISNULL(@IsTerminal, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceTypeStatus] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceTypeStatus] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Type Status */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceTypeStatus] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Type Status */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Type Status
-- Item: spUpdateSpaceTypeStatus
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceTypeStatus
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceTypeStatus]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceTypeStatus];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceTypeStatus]
    @ID uniqueidentifier,
    @SpaceTypeID uniqueidentifier = NULL,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(100) = NULL,
    @Sequence int = NULL,
    @IsDefault bit = NULL,
    @ReadOnly bit = NULL,
    @Visible bit = NULL,
    @AgentRetrieval bit = NULL,
    @CanChangeAfter bit = NULL,
    @NotifyMembersOnEnter bit = NULL,
    @IsTerminal bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceTypeStatus]
    SET
        [SpaceTypeID] = ISNULL(@SpaceTypeID, [SpaceTypeID]),
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Sequence] = ISNULL(@Sequence, [Sequence]),
        [IsDefault] = ISNULL(@IsDefault, [IsDefault]),
        [ReadOnly] = ISNULL(@ReadOnly, [ReadOnly]),
        [Visible] = ISNULL(@Visible, [Visible]),
        [AgentRetrieval] = ISNULL(@AgentRetrieval, [AgentRetrieval]),
        [CanChangeAfter] = ISNULL(@CanChangeAfter, [CanChangeAfter]),
        [NotifyMembersOnEnter] = ISNULL(@NotifyMembersOnEnter, [NotifyMembersOnEnter]),
        [IsTerminal] = ISNULL(@IsTerminal, [IsTerminal])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceTypeStatus] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceTypeStatus]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceTypeStatus] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceTypeStatus table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceTypeStatus]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceTypeStatus];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceTypeStatus
ON [${flyway:defaultSchema}].[SpaceTypeStatus]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceTypeStatus]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceTypeStatus] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Type Status */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceTypeStatus] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Type Status */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Type Status
-- Item: spDeleteSpaceTypeStatus
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceTypeStatus
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceTypeStatus]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceTypeStatus];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceTypeStatus]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceTypeStatus]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceTypeStatus] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Type Status */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceTypeStatus] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Space Notes */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Notes
-- Item: vwSpaceNotes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Notes
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceNote
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceNotes]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceNotes];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceNotes]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_AuthorUserID.[Name] AS [AuthorUser]
FROM
    [${flyway:defaultSchema}].[SpaceNote] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_AuthorUserID
  ON
    [s].[AuthorUserID] = MJUser_AuthorUserID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceNotes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Notes */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Notes
-- Item: Permissions for vwSpaceNotes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceNotes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Notes */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Notes
-- Item: spCreateSpaceNote
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceNote
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceNote]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceNote];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceNote]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @Title nvarchar(200),
    @Body_Clear bit = 0,
    @Body nvarchar(MAX) = NULL,
    @Band nvarchar(10) = NULL,
    @Visibility nvarchar(10) = NULL,
    @AuthorUserID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceNote]
            (
                [ID],
                [SpaceID],
                [Title],
                [Body],
                [Band],
                [Visibility],
                [AuthorUserID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @Title,
                CASE WHEN @Body_Clear = 1 THEN NULL ELSE ISNULL(@Body, NULL) END,
                ISNULL(@Band, 'Team'),
                ISNULL(@Visibility, 'Space'),
                @AuthorUserID
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceNote]
            (
                [SpaceID],
                [Title],
                [Body],
                [Band],
                [Visibility],
                [AuthorUserID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @Title,
                CASE WHEN @Body_Clear = 1 THEN NULL ELSE ISNULL(@Body, NULL) END,
                ISNULL(@Band, 'Team'),
                ISNULL(@Visibility, 'Space'),
                @AuthorUserID
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceNotes] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceNote] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Notes */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceNote] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Notes */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Notes
-- Item: spUpdateSpaceNote
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceNote
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceNote]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceNote];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceNote]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @Title nvarchar(200) = NULL,
    @Body_Clear bit = 0,
    @Body nvarchar(MAX) = NULL,
    @Band nvarchar(10) = NULL,
    @Visibility nvarchar(10) = NULL,
    @AuthorUserID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceNote]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [Title] = ISNULL(@Title, [Title]),
        [Body] = CASE WHEN @Body_Clear = 1 THEN NULL ELSE ISNULL(@Body, [Body]) END,
        [Band] = ISNULL(@Band, [Band]),
        [Visibility] = ISNULL(@Visibility, [Visibility]),
        [AuthorUserID] = ISNULL(@AuthorUserID, [AuthorUserID])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceNotes] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceNotes]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceNote] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceNote table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceNote]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceNote];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceNote
ON [${flyway:defaultSchema}].[SpaceNote]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceNote]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceNote] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Notes */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceNote] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Notes */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Notes
-- Item: spDeleteSpaceNote
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceNote
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceNote]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceNote];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceNote]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceNote]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceNote] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Notes */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceNote] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (7 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='106DF2B5-DF08-48EE-A0E1-26C329DC0343,8B50058D-B5DC-4AE6-9990-17A5EB5B3A09,A7873DEB-9B74-4E27-A95F-D84CA74F7B75,CB59DEA7-2155-4A33-B836-ADF2B268D2E9,1DDE95B7-60B7-4A08-A886-57550B425C58,41165FEC-A52B-469A-A880-3B108C39A65E,3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 14 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'be3092cf-636e-4328-a101-5d0485cddaf6' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'Space')) BEGIN
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
            'be3092cf-636e-4328-a101-5d0485cddaf6',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '974dc2c6-6474-4847-a454-c8ee9293b021' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'SpaceType')) BEGIN
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
            '974dc2c6-6474-4847-a454-c8ee9293b021',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7f230bc1-9f25-478f-b3eb-1e8804ab6911' OR (EntityID = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09' AND Name = 'Entity')) BEGIN
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
            '7f230bc1-9f25-478f-b3eb-1e8804ab6911',
            '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', -- Entity: MJ_BizApps_Collaboration: Space Anchors
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '8B50058D-B5DC-4AE6-9990-17A5EB5B3A09'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9daf4af1-cfdd-4b93-8ac1-79af5294928e' OR (EntityID = '106DF2B5-DF08-48EE-A0E1-26C329DC0343' AND Name = 'SpaceType')) BEGIN
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
            '9daf4af1-cfdd-4b93-8ac1-79af5294928e',
            '106DF2B5-DF08-48EE-A0E1-26C329DC0343', -- Entity: MJ_BizApps_Collaboration: Space Type Status
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '106DF2B5-DF08-48EE-A0E1-26C329DC0343'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3bf69a67-493d-48bb-95c6-fba53a5a27cd' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'ArtifactVersion')) BEGIN
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
            '3bf69a67-493d-48bb-95c6-fba53a5a27cd',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'ArtifactVersion',
            'Artifact Version',
            NULL,
            'nvarchar',
            510,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a673d3a5-f8de-4543-bada-7de6f65a9aaa' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'Space')) BEGIN
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
            'a673d3a5-f8de-4543-bada-7de6f65a9aaa',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '92b7bf80-5057-4d55-a272-f5a0c4bad464' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'User')) BEGIN
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
            '92b7bf80-5057-4d55-a272-f5a0c4bad464',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1bbe87c3-2127-4d11-a636-301a34e1f7fa' OR (EntityID = '1DDE95B7-60B7-4A08-A886-57550B425C58' AND Name = 'TargetEntity')) BEGIN
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
            '1bbe87c3-2127-4d11-a636-301a34e1f7fa',
            '1DDE95B7-60B7-4A08-A886-57550B425C58', -- Entity: MJ_BizApps_Collaboration: Space Member Pins
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '1DDE95B7-60B7-4A08-A886-57550B425C58'),
            'TargetEntity',
            'Target Entity',
            NULL,
            'nvarchar',
            510,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3edb6a48-4f1b-48ef-b487-216cb3108cc4' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'Status')) BEGIN
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
            '3edb6a48-4f1b-48ef-b487-216cb3108cc4',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'Status',
            'Status',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '10967f82-e8f3-429a-9e29-b71c39e736e7' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'Space')) BEGIN
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
            '10967f82-e8f3-429a-9e29-b71c39e736e7',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4f3f0fea-877c-477e-977d-ad7d516c355d' OR (EntityID = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9' AND Name = 'AuthorUser')) BEGIN
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
            '4f3f0fea-877c-477e-977d-ad7d516c355d',
            'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', -- Entity: MJ_BizApps_Collaboration: Space Notes
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CB59DEA7-2155-4A33-B836-ADF2B268D2E9'),
            'AuthorUser',
            'Author User',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'da259578-995c-4a52-b44f-a99d79b1dca5' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'SpaceType')) BEGIN
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
            'da259578-995c-4a52-b44f-a99d79b1dca5',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'SpaceType',
            'Space Type',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c4cd652e-85a8-4b76-88c2-578fc0ffb1bf' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'Space')) BEGIN
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
            'c4cd652e-85a8-4b76-88c2-578fc0ffb1bf',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'Space',
            'Space',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7211f241-2d97-4056-8b09-2c459b2b7dcc' OR (EntityID = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75' AND Name = 'TargetEntity')) BEGIN
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
            '7211f241-2d97-4056-8b09-2c459b2b7dcc',
            'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', -- Entity: MJ_BizApps_Collaboration: Space Grants
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'A7873DEB-9B74-4E27-A95F-D84CA74F7B75'),
            'TargetEntity',
            'Target Entity',
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

/* SQL text to update existing entity fields from schema (7 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='106DF2B5-DF08-48EE-A0E1-26C329DC0343,8B50058D-B5DC-4AE6-9990-17A5EB5B3A09,A7873DEB-9B74-4E27-A95F-D84CA74F7B75,CB59DEA7-2155-4A33-B836-ADF2B268D2E9,1DDE95B7-60B7-4A08-A886-57550B425C58,41165FEC-A52B-469A-A880-3B108C39A65E,3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

-- ---- CodeGen_Run_2026-10-02_02-23-45.sql ----
/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

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
    @DefaultAgentRetrieval nvarchar(30) = NULL,
    @DefaultBand nvarchar(20) = NULL,
    @InviteApproval nvarchar(20) = NULL,
    @MemberCap_Clear bit = 0,
    @MemberCap int = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL,
    @DefaultAllowParentAssignees bit = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Color_Clear bit = 0,
    @Color nvarchar(50) = NULL,
    @ServerDriverClass_Clear bit = 0,
    @ServerDriverClass nvarchar(255) = NULL,
    @UIDriverClass_Clear bit = 0,
    @UIDriverClass nvarchar(255) = NULL,
    @SpaceExtensionEntity_Clear bit = 0,
    @SpaceExtensionEntity nvarchar(255) = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL
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
                [DefaultAgentRetrieval],
                [DefaultBand],
                [InviteApproval],
                [MemberCap],
                [DisplayRank],
                [IsActive],
                [DefaultAllowParentAssignees],
                [IconClass],
                [Color],
                [ServerDriverClass],
                [UIDriverClass],
                [SpaceExtensionEntity],
                [Configuration]
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
                ISNULL(@DefaultAgentRetrieval, 'Included'),
                ISNULL(@DefaultBand, 'Team'),
                ISNULL(@InviteApproval, 'Approve'),
                CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, NULL) END,
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1),
                ISNULL(@DefaultAllowParentAssignees, 1),
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, NULL) END,
                CASE WHEN @ServerDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@ServerDriverClass, NULL) END,
                CASE WHEN @UIDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@UIDriverClass, NULL) END,
                CASE WHEN @SpaceExtensionEntity_Clear = 1 THEN NULL ELSE ISNULL(@SpaceExtensionEntity, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END
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
                [DefaultAgentRetrieval],
                [DefaultBand],
                [InviteApproval],
                [MemberCap],
                [DisplayRank],
                [IsActive],
                [DefaultAllowParentAssignees],
                [IconClass],
                [Color],
                [ServerDriverClass],
                [UIDriverClass],
                [SpaceExtensionEntity],
                [Configuration]
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
                ISNULL(@DefaultAgentRetrieval, 'Included'),
                ISNULL(@DefaultBand, 'Team'),
                ISNULL(@InviteApproval, 'Approve'),
                CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, NULL) END,
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1),
                ISNULL(@DefaultAllowParentAssignees, 1),
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, NULL) END,
                CASE WHEN @ServerDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@ServerDriverClass, NULL) END,
                CASE WHEN @UIDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@UIDriverClass, NULL) END,
                CASE WHEN @SpaceExtensionEntity_Clear = 1 THEN NULL ELSE ISNULL(@SpaceExtensionEntity, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END
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
    @DefaultAgentRetrieval nvarchar(30) = NULL,
    @DefaultBand nvarchar(20) = NULL,
    @InviteApproval nvarchar(20) = NULL,
    @MemberCap_Clear bit = 0,
    @MemberCap int = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL,
    @DefaultAllowParentAssignees bit = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Color_Clear bit = 0,
    @Color nvarchar(50) = NULL,
    @ServerDriverClass_Clear bit = 0,
    @ServerDriverClass nvarchar(255) = NULL,
    @UIDriverClass_Clear bit = 0,
    @UIDriverClass nvarchar(255) = NULL,
    @SpaceExtensionEntity_Clear bit = 0,
    @SpaceExtensionEntity nvarchar(255) = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL
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
        [DefaultAgentRetrieval] = ISNULL(@DefaultAgentRetrieval, [DefaultAgentRetrieval]),
        [DefaultBand] = ISNULL(@DefaultBand, [DefaultBand]),
        [InviteApproval] = ISNULL(@InviteApproval, [InviteApproval]),
        [MemberCap] = CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, [MemberCap]) END,
        [DisplayRank] = ISNULL(@DisplayRank, [DisplayRank]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [DefaultAllowParentAssignees] = ISNULL(@DefaultAllowParentAssignees, [DefaultAllowParentAssignees]),
        [IconClass] = CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, [IconClass]) END,
        [Color] = CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, [Color]) END,
        [ServerDriverClass] = CASE WHEN @ServerDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@ServerDriverClass, [ServerDriverClass]) END,
        [UIDriverClass] = CASE WHEN @UIDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@UIDriverClass, [UIDriverClass]) END,
        [SpaceExtensionEntity] = CASE WHEN @SpaceExtensionEntity_Clear = 1 THEN NULL ELSE ISNULL(@SpaceExtensionEntity, [SpaceExtensionEntity]) END,
        [Configuration] = CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, [Configuration]) END
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
