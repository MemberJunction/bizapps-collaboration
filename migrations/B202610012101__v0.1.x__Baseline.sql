-- =============================================================================
--  BizApps Collaboration baseline for __mj_BizAppsCollaboration
--
--  The baseline of the __mj_BizAppsCollaboration schema: one file in place of the V stack it replaces (item 144).
--  Built by scripts/build-baseline.mjs from COLLAB_S1_STACK, a database that held MemberJunction core, bizapps-common,
--  bizapps-tasks and this app's migrations alone. Section 1 is the schema's DDL as MemberJunction's baseline module
--  introspects it; section 2, under CodeGen's banner, is CodeGen's capture. Filters, permissions and JSONType
--  settings stay JSON under metadata/ and are pushed with mj sync push.
--
--  Every object is created from empty: there is no IF NOT EXISTS, since a baseline applies only to a database
--  that has none of this app's migrations.
-- =============================================================================
-- ============================================================================
-- BizApps Collaboration baseline for __mj_BizAppsCollaboration
-- Baseline version : v0.1.x
-- Generated at     : 2026-10-01T21:01:00Z
-- Generator        : @memberjunction/cli baseline build
-- ============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- Schemas
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'${flyway:defaultSchema}')
    EXEC('CREATE SCHEMA [${flyway:defaultSchema}]');
GO

-- Tables

CREATE TABLE [${flyway:defaultSchema}].[ItemUse] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [ItemID] UNIQUEIDENTIFIER NOT NULL,
    [UserID] UNIQUEIDENTIFIER NOT NULL,
    [UsedAt] DATETIMEOFFSET(7) NOT NULL,
    [Kind] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_ItemUse] PRIMARY KEY CLUSTERED ([ID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[ShareNotice] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [ItemID] UNIQUEIDENTIFIER NOT NULL,
    [RecipientUserID] UNIQUEIDENTIFIER NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_ShareNotice] PRIMARY KEY CLUSTERED ([ID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[Space] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceTypeID] UNIQUEIDENTIFIER NOT NULL,
    [ParentID] UNIQUEIDENTIFIER NULL,
    [Name] NVARCHAR(200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Description] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [OwnerID] UNIQUEIDENTIFIER NOT NULL,
    [InheritsMembership] BIT NOT NULL,
    [AgentRetrieval] NVARCHAR(30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [StartedAt] DATETIMEOFFSET(7) NULL,
    [ClosedAt] DATETIMEOFFSET(7) NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    [AllowParentAssignees] BIT NOT NULL,
    [PlannedCloseAt] DATETIMEOFFSET(7) NULL,
    [IconClass] NVARCHAR(100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Color] NVARCHAR(50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [BackgroundImageURL] NVARCHAR(1000) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Configuration] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [StatusID] UNIQUEIDENTIFIER NULL,
    CONSTRAINT [PK_Space] PRIMARY KEY CLUSTERED ([ID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceAnchor] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceTypeID] UNIQUEIDENTIFIER NOT NULL,
    [EntityID] UNIQUEIDENTIFIER NOT NULL,
    [RecordID] NVARCHAR(450) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Role] NVARCHAR(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [IsPrimary] BIT NOT NULL,
    [Sequence] INT NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_SpaceAnchor] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [UQ_SpaceAnchor_Space_Entity_Record_Role] UNIQUE NONCLUSTERED ([SpaceID], [EntityID], [RecordID], [Role])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceChat] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [ConversationID] UNIQUEIDENTIFIER NOT NULL,
    [Name] NVARCHAR(255) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Subject] NVARCHAR(500) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Kind] NVARCHAR(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Status] NVARCHAR(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    [ArchivedOnSpaceClose] BIT NOT NULL,
    CONSTRAINT [PK_SpaceChat] PRIMARY KEY CLUSTERED ([ID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceGrant] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceTypeID] UNIQUEIDENTIFIER NULL,
    [SpaceID] UNIQUEIDENTIFIER NULL,
    [Kind] NVARCHAR(30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [TargetEntityID] UNIQUEIDENTIFIER NOT NULL,
    [TargetRecordID] NVARCHAR(450) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Label] NVARCHAR(200) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Band] NVARCHAR(10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [IsDefault] BIT NOT NULL,
    [Bindings] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Settings] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Mode] NVARCHAR(10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Sequence] INT NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_SpaceGrant] PRIMARY KEY CLUSTERED ([ID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceItem] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [EntityID] UNIQUEIDENTIFIER NOT NULL,
    [RecordID] NVARCHAR(450) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Band] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [PromotedAt] DATETIMEOFFSET(7) NULL,
    [PromotedByUserID] UNIQUEIDENTIFIER NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    [Folder] NVARCHAR(200) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [ArtifactVersionID] UNIQUEIDENTIFIER NULL,
    CONSTRAINT [PK_SpaceItem] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [UQ_SpaceItem_Entity_Record] UNIQUE NONCLUSTERED ([EntityID], [RecordID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceMember] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [UserID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceRoleTypeID] UNIQUEIDENTIFIER NOT NULL,
    [Band] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Status] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    [SyncSource] NVARCHAR(100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [PersonID] UNIQUEIDENTIFIER NULL,
    CONSTRAINT [PK_SpaceMember] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [UQ_SpaceMember_Space_User] UNIQUE NONCLUSTERED ([SpaceID], [UserID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceMemberPin] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [UserID] UNIQUEIDENTIFIER NOT NULL,
    [Kind] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [TargetEntityID] UNIQUEIDENTIFIER NULL,
    [TargetRecordID] NVARCHAR(450) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [GrantID] UNIQUEIDENTIFIER NULL,
    [Sequence] INT NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_SpaceMemberPin] PRIMARY KEY CLUSTERED ([ID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceNote] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [Title] NVARCHAR(200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Body] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Band] NVARCHAR(10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Visibility] NVARCHAR(10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [AuthorUserID] UNIQUEIDENTIFIER NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_SpaceNote] PRIMARY KEY CLUSTERED ([ID])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceRoleType] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [Code] NVARCHAR(40) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Name] NVARCHAR(200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Description] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Level] INT NOT NULL,
    [MaxGrantableLevel] INT NOT NULL,
    [CanInvite] BIT NOT NULL,
    [CanPromoteBand] BIT NOT NULL,
    [CanSeeTeamBand] BIT NOT NULL,
    [IsOwnerRole] BIT NOT NULL,
    [DisplayRank] INT NOT NULL,
    [IsActive] BIT NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    [CanContribute] BIT NOT NULL,
    CONSTRAINT [PK_SpaceRoleType] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [UQ_SpaceRoleType_Code] UNIQUE NONCLUSTERED ([Code])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceType] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [Code] NVARCHAR(40) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Name] NVARCHAR(200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Description] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Vocabulary] NVARCHAR(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Discoverability] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [JoinMode] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [MessagingPanel] BIT NOT NULL,
    [LibraryPanel] BIT NOT NULL,
    [WorkPanel] BIT NOT NULL,
    [DefaultAgentRetrieval] NVARCHAR(30) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [DefaultBand] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [InviteApproval] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [MemberCap] INT NULL,
    [DisplayRank] INT NOT NULL,
    [IsActive] BIT NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    [DefaultAllowParentAssignees] BIT NOT NULL,
    [IconClass] NVARCHAR(100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Color] NVARCHAR(50) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [ServerDriverClass] NVARCHAR(255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [UIDriverClass] NVARCHAR(255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [SpaceExtensionEntity] NVARCHAR(255) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Configuration] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    CONSTRAINT [PK_SpaceType] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [UQ_SpaceType_Code] UNIQUE NONCLUSTERED ([Code])
);
GO

CREATE TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] (
    [ID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceTypeID] UNIQUEIDENTIFIER NOT NULL,
    [Code] NVARCHAR(40) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Name] NVARCHAR(100) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Sequence] INT NOT NULL,
    [IsDefault] BIT NOT NULL,
    [ReadOnly] BIT NOT NULL,
    [Visible] BIT NOT NULL,
    [AgentRetrieval] BIT NOT NULL,
    [CanChangeAfter] BIT NOT NULL,
    [NotifyMembersOnEnter] BIT NOT NULL,
    [IsTerminal] BIT NOT NULL,
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL,
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL,
    CONSTRAINT [PK_SpaceTypeStatus] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [UQ_SpaceTypeStatus_Type_Code] UNIQUE NONCLUSTERED ([SpaceTypeID], [Code]),
    CONSTRAINT [UQ_SpaceTypeStatus_Type_Sequence] UNIQUE NONCLUSTERED ([SpaceTypeID], [Sequence])
);
GO

-- Default constraints
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [DF__ItemUse__ID__7510A974] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_ItemUse___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_ItemUse___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD CONSTRAINT [DF__ShareNotice__ID__6F57D01E] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_ShareNotice___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_ShareNotice___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [DF__Space__ID__29B97BDD] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [DF_Space_InheritsMembership] DEFAULT ((0)) FOR [InheritsMembership];
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [DF__Space__AgentRetr__2BA1C44F] DEFAULT ('Included') FOR [AgentRetrieval];
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_Space___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_Space___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [DF_Space_AllowParentAssignees] DEFAULT ((1)) FOR [AllowParentAssignees];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [DF_SpaceAnchor_ID] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [DF_SpaceAnchor_IsPrimary] DEFAULT ((0)) FOR [IsPrimary];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [DF_SpaceAnchor_Sequence] DEFAULT ((0)) FOR [Sequence];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAnchor___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAnchor___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [DF__SpaceChat__ID__3125937B] DEFAULT (newid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [DF_SpaceChat_Kind] DEFAULT ('General') FOR [Kind];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [DF_SpaceChat_Status] DEFAULT ('Active') FOR [Status];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceChat___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceChat___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [DF_SpaceChat_ArchivedOnSpaceClose] DEFAULT ((0)) FOR [ArchivedOnSpaceClose];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF_SpaceGrant_ID] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF_SpaceGrant_Band] DEFAULT (N'Shared') FOR [Band];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF_SpaceGrant_IsDefault] DEFAULT ((0)) FOR [IsDefault];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF_SpaceGrant_Mode] DEFAULT (N'Extend') FOR [Mode];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF_SpaceGrant_Sequence] DEFAULT ((0)) FOR [Sequence];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceGrant___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceGrant___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [DF__SpaceItem__ID__3FA8BCFC] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceItem___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceItem___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [DF__SpaceMember__ID__361F52C2] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [DF__SpaceMemb__Statu__371376FB] DEFAULT ('Invited') FOR [Status];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceMember___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceMember___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [DF_SpaceMemberPin_ID] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [DF_SpaceMemberPin_Sequence] DEFAULT ((0)) FOR [Sequence];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceMemberPin___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceMemberPin___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [DF_SpaceNote_ID] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [DF_SpaceNote_Band] DEFAULT (N'Team') FOR [Band];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [DF_SpaceNote_Visibility] DEFAULT (N'Space') FOR [Visibility];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceNote___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceNote___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF__SpaceRoleTyp__ID__203011A3] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF__SpaceRole__CanIn__212435DC] DEFAULT ((0)) FOR [CanInvite];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF__SpaceRole__CanPr__22185A15] DEFAULT ((0)) FOR [CanPromoteBand];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF__SpaceRole__CanSe__230C7E4E] DEFAULT ((0)) FOR [CanSeeTeamBand];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF__SpaceRole__IsOwn__2400A287] DEFAULT ((0)) FOR [IsOwnerRole];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF__SpaceRole__Displ__24F4C6C0] DEFAULT ((0)) FOR [DisplayRank];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF__SpaceRole__IsAct__25E8EAF9] DEFAULT ((1)) FOR [IsActive];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceRoleType___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceRoleType___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [DF_SpaceRoleType_CanContribute] DEFAULT ((0)) FOR [CanContribute];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__ID__0A40D084] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__Disco__0B34F4BD] DEFAULT ('Hidden') FOR [Discoverability];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__JoinM__0C2918F6] DEFAULT ('InviteOnly') FOR [JoinMode];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__Messa__0D1D3D2F] DEFAULT ((1)) FOR [MessagingPanel];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__Libra__0E116168] DEFAULT ((0)) FOR [LibraryPanel];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__WorkP__0F0585A1] DEFAULT ((0)) FOR [WorkPanel];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__Defau__11E1F24C] DEFAULT ('Included') FOR [DefaultAgentRetrieval];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__Defau__12D61685] DEFAULT ('Team') FOR [DefaultBand];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__Invit__13CA3ABE] DEFAULT ('Approve') FOR [InviteApproval];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__Displ__14BE5EF7] DEFAULT ((0)) FOR [DisplayRank];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF__SpaceType__IsAct__15B28330] DEFAULT ((1)) FOR [IsActive];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceType___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceType___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [DF_SpaceType_DefaultAllowParentAssignees] DEFAULT ((1)) FOR [DefaultAllowParentAssignees];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF_SpaceTypeStatus_ID] DEFAULT (newsequentialid()) FOR [ID];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF_SpaceTypeStatus_IsDefault] DEFAULT ((0)) FOR [IsDefault];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF_SpaceTypeStatus_ReadOnly] DEFAULT ((0)) FOR [ReadOnly];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF_SpaceTypeStatus_Visible] DEFAULT ((1)) FOR [Visible];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF_SpaceTypeStatus_AgentRetrieval] DEFAULT ((1)) FOR [AgentRetrieval];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF_SpaceTypeStatus_CanChangeAfter] DEFAULT ((1)) FOR [CanChangeAfter];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF_SpaceTypeStatus_NotifyMembersOnEnter] DEFAULT ((0)) FOR [NotifyMembersOnEnter];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF_SpaceTypeStatus_IsTerminal] DEFAULT ((0)) FOR [IsTerminal];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceTypeStatus___mj_CreatedAt] DEFAULT (getutcdate()) FOR [__mj_CreatedAt];
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceTypeStatus___mj_UpdatedAt] DEFAULT (getutcdate()) FOR [__mj_UpdatedAt];
GO

-- Check constraints
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [CK_ItemUse_Kind] CHECK ([Kind]='promote' OR [Kind]='upload' OR [Kind]='open');
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [CK_Space_AgentRetrieval] CHECK ([AgentRetrieval]='ExcludedEntirely' OR [AgentRetrieval]='ExcludedFromParentScope' OR [AgentRetrieval]='Included');
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [CK_Space_ClosedAfterStart] CHECK ([StartedAt] IS NULL OR [ClosedAt] IS NULL OR [ClosedAt]>=[StartedAt]);
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [CK_Space_NoSelfParent] CHECK ([ParentID] IS NULL OR [ParentID]<>[ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [CK_SpaceAnchor_Role] CHECK (len(ltrim(rtrim([Role])))>(0));
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [CK_SpaceChat_Kind] CHECK ([Kind]='Topic' OR [Kind]='Private' OR [Kind]='General');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [CK_SpaceChat_Status] CHECK ([Status]='Archived' OR [Status]='Active');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [CK_SpaceGrant_Band] CHECK ([Band]=N'Shared' OR [Band]=N'Team');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [CK_SpaceGrant_DefaultIsAgent] CHECK ([IsDefault]=(0) OR [Kind]=N'Agent');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [CK_SpaceGrant_Kind] CHECK ([Kind]=N'KnowledgeSource' OR [Kind]=N'Component' OR [Kind]=N'Dashboard' OR [Kind]=N'View' OR [Kind]=N'Query' OR [Kind]=N'Action' OR [Kind]=N'Agent');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [CK_SpaceGrant_Mode] CHECK ([Mode]=N'Remove' OR [Mode]=N'Extend');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [CK_SpaceGrant_Scope] CHECK (NOT ([SpaceTypeID] IS NOT NULL AND [SpaceID] IS NOT NULL));
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [CK_SpaceItem_Band] CHECK ([Band]='Shared' OR [Band]='Team');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [CK_SpaceItem_Promotion] CHECK ([Band]='Team' AND [PromotedAt] IS NULL AND [PromotedByUserID] IS NULL OR [Band]='Shared' AND [PromotedAt] IS NOT NULL AND [PromotedByUserID] IS NOT NULL);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [CK_SpaceMember_Band] CHECK ([Band]='Shared' OR [Band]='Team');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [CK_SpaceMember_Status] CHECK ([Status]='Removed' OR [Status]='Active' OR [Status]='Invited');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [CK_SpaceMemberPin_Kind] CHECK ([Kind]=N'Grant' OR [Kind]=N'Record');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [CK_SpaceMemberPin_Target] CHECK ([Kind]=N'Record' AND [TargetEntityID] IS NOT NULL AND [TargetRecordID] IS NOT NULL AND [GrantID] IS NULL OR [Kind]=N'Grant' AND [GrantID] IS NOT NULL AND [TargetEntityID] IS NULL AND [TargetRecordID] IS NULL);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [CK_SpaceNote_Band] CHECK ([Band]=N'Shared' OR [Band]=N'Team');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [CK_SpaceNote_PrivateIsTeam] CHECK ([Visibility]=N'Space' OR [Band]=N'Team');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [CK_SpaceNote_Visibility] CHECK ([Visibility]=N'Private' OR [Visibility]=N'Space');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType] ADD CONSTRAINT [CK_SpaceRoleType_Level] CHECK ([Level]>=(0) AND [MaxGrantableLevel]>=(0) AND [MaxGrantableLevel]<=[Level]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [CK_SpaceType_DefaultAgentRetrieval] CHECK ([DefaultAgentRetrieval]='ExcludedEntirely' OR [DefaultAgentRetrieval]='ExcludedFromParentScope' OR [DefaultAgentRetrieval]='Included');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [CK_SpaceType_DefaultBand] CHECK ([DefaultBand]='Shared' OR [DefaultBand]='Team');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [CK_SpaceType_Discoverability] CHECK ([Discoverability]='Open' OR [Discoverability]='Listed' OR [Discoverability]='Hidden');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [CK_SpaceType_InviteApproval] CHECK ([InviteApproval]='AutoApprove' OR [InviteApproval]='Approve');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [CK_SpaceType_JoinMode] CHECK ([JoinMode]='SelfServe' OR [JoinMode]='RequestToJoin' OR [JoinMode]='InviteOnly');
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceType] ADD CONSTRAINT [CK_SpaceType_MemberCap] CHECK ([MemberCap] IS NULL OR [MemberCap]>(0));
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [CK_SpaceTypeStatus_Code] CHECK (len(ltrim(rtrim([Code])))>(0));
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [CK_SpaceTypeStatus_FrozenIsTerminal] CHECK ([IsTerminal]=(1) OR [CanChangeAfter]=(1));
GO

-- Indexes
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_ItemUse_ItemID] ON [${flyway:defaultSchema}].[ItemUse] ([ItemID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_ItemUse_SpaceID] ON [${flyway:defaultSchema}].[ItemUse] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_ItemUse_UserID] ON [${flyway:defaultSchema}].[ItemUse] ([UserID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_ShareNotice_ItemID] ON [${flyway:defaultSchema}].[ShareNotice] ([ItemID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_ShareNotice_RecipientUserID] ON [${flyway:defaultSchema}].[ShareNotice] ([RecipientUserID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_ShareNotice_SpaceID] ON [${flyway:defaultSchema}].[ShareNotice] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_Space_OwnerID] ON [${flyway:defaultSchema}].[Space] ([OwnerID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_Space_ParentID] ON [${flyway:defaultSchema}].[Space] ([ParentID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_Space_SpaceTypeID] ON [${flyway:defaultSchema}].[Space] ([SpaceTypeID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_Space_StatusID] ON [${flyway:defaultSchema}].[Space] ([StatusID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceAnchor_EntityID] ON [${flyway:defaultSchema}].[SpaceAnchor] ([EntityID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceAnchor_SpaceID] ON [${flyway:defaultSchema}].[SpaceAnchor] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceAnchor_SpaceTypeID] ON [${flyway:defaultSchema}].[SpaceAnchor] ([SpaceTypeID]);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceAnchor_Primary] ON [${flyway:defaultSchema}].[SpaceAnchor] ([SpaceID]) WHERE ([IsPrimary]=(1));
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceAnchor_PrimaryPerType] ON [${flyway:defaultSchema}].[SpaceAnchor] ([SpaceTypeID], [EntityID], [RecordID]) WHERE ([IsPrimary]=(1));
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceChat_ConversationID] ON [${flyway:defaultSchema}].[SpaceChat] ([ConversationID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceChat_SpaceID] ON [${flyway:defaultSchema}].[SpaceChat] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceGrant_SpaceID] ON [${flyway:defaultSchema}].[SpaceGrant] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceGrant_SpaceTypeID] ON [${flyway:defaultSchema}].[SpaceGrant] ([SpaceTypeID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceGrant_TargetEntityID] ON [${flyway:defaultSchema}].[SpaceGrant] ([TargetEntityID]);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceGrant_App] ON [${flyway:defaultSchema}].[SpaceGrant] ([Kind], [TargetEntityID], [TargetRecordID]) WHERE ([SpaceTypeID] IS NULL AND [SpaceID] IS NULL);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceGrant_DefaultAgent_App] ON [${flyway:defaultSchema}].[SpaceGrant] ([Kind]) WHERE ([IsDefault]=(1) AND [SpaceTypeID] IS NULL AND [SpaceID] IS NULL);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceGrant_DefaultAgent_Space] ON [${flyway:defaultSchema}].[SpaceGrant] ([SpaceID]) WHERE ([IsDefault]=(1) AND [SpaceID] IS NOT NULL);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceGrant_DefaultAgent_Type] ON [${flyway:defaultSchema}].[SpaceGrant] ([SpaceTypeID]) WHERE ([IsDefault]=(1) AND [SpaceTypeID] IS NOT NULL);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceGrant_Space] ON [${flyway:defaultSchema}].[SpaceGrant] ([SpaceID], [Kind], [TargetEntityID], [TargetRecordID]) WHERE ([SpaceID] IS NOT NULL);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceGrant_Type] ON [${flyway:defaultSchema}].[SpaceGrant] ([SpaceTypeID], [Kind], [TargetEntityID], [TargetRecordID]) WHERE ([SpaceTypeID] IS NOT NULL);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceItem_ArtifactVersionID] ON [${flyway:defaultSchema}].[SpaceItem] ([ArtifactVersionID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceItem_EntityID] ON [${flyway:defaultSchema}].[SpaceItem] ([EntityID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceItem_PromotedByUserID] ON [${flyway:defaultSchema}].[SpaceItem] ([PromotedByUserID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceItem_SpaceID] ON [${flyway:defaultSchema}].[SpaceItem] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceMember_PersonID] ON [${flyway:defaultSchema}].[SpaceMember] ([PersonID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceMember_SpaceID] ON [${flyway:defaultSchema}].[SpaceMember] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceMember_SpaceRoleTypeID] ON [${flyway:defaultSchema}].[SpaceMember] ([SpaceRoleTypeID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceMember_UserID] ON [${flyway:defaultSchema}].[SpaceMember] ([UserID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceMemberPin_GrantID] ON [${flyway:defaultSchema}].[SpaceMemberPin] ([GrantID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceMemberPin_SpaceID] ON [${flyway:defaultSchema}].[SpaceMemberPin] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceMemberPin_TargetEntityID] ON [${flyway:defaultSchema}].[SpaceMemberPin] ([TargetEntityID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceMemberPin_UserID] ON [${flyway:defaultSchema}].[SpaceMemberPin] ([UserID]);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceMemberPin_Grant] ON [${flyway:defaultSchema}].[SpaceMemberPin] ([SpaceID], [UserID], [GrantID]) WHERE ([Kind]=N'Grant');
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceMemberPin_Record] ON [${flyway:defaultSchema}].[SpaceMemberPin] ([SpaceID], [UserID], [TargetEntityID], [TargetRecordID]) WHERE ([Kind]=N'Record');
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceNote_AuthorUserID] ON [${flyway:defaultSchema}].[SpaceNote] ([AuthorUserID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceNote_SpaceID] ON [${flyway:defaultSchema}].[SpaceNote] ([SpaceID]);
GO
CREATE NONCLUSTERED INDEX [IDX_AUTO_MJ_FKEY_SpaceTypeStatus_SpaceTypeID] ON [${flyway:defaultSchema}].[SpaceTypeStatus] ([SpaceTypeID]);
GO
CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceTypeStatus_Default] ON [${flyway:defaultSchema}].[SpaceTypeStatus] ([SpaceTypeID]) WHERE ([IsDefault]=(1));
GO

-- Functions
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
CREATE FUNCTION [${flyway:defaultSchema}].[fnSpaceParentID_GetRootID]
(
    @RecordID uniqueidentifier,
    @ParentID uniqueidentifier
)
RETURNS TABLE
AS
RETURN
(
    WITH CTE_RootParent AS (
        SELECT
            [ID],
            [ParentID],
            [ID] AS [RootParentID],
            0 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[Space]
        WHERE
            [ID] = COALESCE(@ParentID, @RecordID)

        UNION ALL

        SELECT
            c.[ID],
            c.[ParentID],
            c.[ID] AS [RootParentID],
            p.[Depth] + 1 AS [Depth]
        FROM
            [${flyway:defaultSchema}].[Space] c
        INNER JOIN
            CTE_RootParent p ON c.[ID] = p.[ParentID]
        WHERE
            p.[Depth] < 100
    )
    SELECT TOP 1
        [RootParentID] AS RootID
    FROM
        CTE_RootParent
    WHERE
        [ParentID] IS NULL
    ORDER BY
        [RootParentID]
);
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
-- 2. fnCollaborationCommonAccess: fail closed on malformed list or unknown principal
CREATE   FUNCTION [${flyway:defaultSchema}].[fnCollaborationCommonAccess](@UserIDs NVARCHAR(MAX))
RETURNS @Common TABLE (
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL
)
AS
BEGIN
    IF @UserIDs IS NULL OR LTRIM(RTRIM(@UserIDs)) = ''
        RETURN;

    -- Fail closed if ANY token in @UserIDs is not a valid UUID (or not 36 chars)
    IF EXISTS (
        SELECT 1
        FROM STRING_SPLIT(@UserIDs, ',')
        WHERE TRY_CAST(LTRIM(RTRIM(value)) AS UNIQUEIDENTIFIER) IS NULL
           OR LTRIM(RTRIM(value)) = ''
           OR LEN(LTRIM(RTRIM(value))) <> 36
    )
        RETURN;

    DECLARE @UserCount INT;
    SELECT @UserCount = COUNT(DISTINCT CAST(LTRIM(RTRIM(value)) AS UNIQUEIDENTIFIER))
    FROM STRING_SPLIT(@UserIDs, ',');

    IF @UserCount = 0
        RETURN;

    ;WITH UserAccess AS (
        SELECT u.UserID, a.SpaceID, a.CanSeeTeam
        FROM (
            SELECT DISTINCT CAST(LTRIM(RTRIM(value)) AS UNIQUEIDENTIFIER) AS UserID
            FROM STRING_SPLIT(@UserIDs, ',')
        ) AS u
        CROSS APPLY [${flyway:defaultSchema}].[fnCollaborationAccess](u.UserID) AS a
    )
    INSERT INTO @Common (SpaceID, CanSeeTeam)
    SELECT SpaceID,
           CASE WHEN MIN(CAST(CanSeeTeam AS INT)) = 1 THEN 1 ELSE 0 END AS CanSeeTeam
    FROM UserAccess
    GROUP BY SpaceID
    HAVING COUNT(DISTINCT UserID) = @UserCount;

    RETURN;
END;
GO
CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationSpaceAndAncestors](@UserID UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN
(
    WITH Chain AS (
        SELECT a.SpaceID AS SpaceID, 0 AS Steps
        FROM [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID) AS a

        UNION ALL

        SELECT s.ParentID, c.Steps + 1
        FROM Chain AS c
        INNER JOIN [${flyway:defaultSchema}].[Space] AS s ON s.ID = c.SpaceID
        WHERE s.ParentID IS NOT NULL
          AND c.Steps < 32
    )
    SELECT DISTINCT SpaceID FROM Chain
);
GO
CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationTasks](@UserID UNIQUEIDENTIFIER)
RETURNS @Reach TABLE (
    TaskID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanWrite BIT NOT NULL,
    IsRoot BIT NOT NULL
)
AS
BEGIN
    ;WITH Roots AS (
        SELECT
            TRY_CAST(CASE WHEN i.RecordID LIKE N'ID|%' THEN SUBSTRING(i.RecordID, 4, 36) ELSE i.RecordID END AS UNIQUEIDENTIFIER) AS TaskID,
            i.SpaceID,
            CASE WHEN a.CanContribute = 1 AND (i.Band = N'Shared' OR a.CanSeeTeam = 1) THEN 1 ELSE 0 END AS CanWrite
        FROM [${flyway:defaultSchema}].[SpaceItem] AS i
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID) AS a ON a.SpaceID = i.SpaceID
        WHERE i.EntityID = 'B348FFA2-B1A7-4AC2-B6FD-F4E0C0697466'
          AND (i.Band = N'Shared' OR a.CanSeeTeam = 1)
    ),
    Walk AS (
        SELECT TaskID, SpaceID, CanWrite, 1 AS IsRoot, 0 AS Steps,
               CAST(CONVERT(varchar(36), TaskID) AS varchar(max)) AS Path
        FROM Roots
        WHERE TaskID IS NOT NULL
        UNION ALL
        SELECT child.ID, parent.SpaceID, parent.CanWrite, 0, parent.Steps + 1,
               parent.Path + '/' + CONVERT(varchar(36), child.ID)
        FROM [__mj_BizAppsTasks].[Task] AS child
        INNER JOIN Walk AS parent ON child.ParentID = parent.TaskID
        WHERE parent.Steps < 32
          AND parent.Path NOT LIKE '%' + CONVERT(varchar(36), child.ID) + '%'
    )
    INSERT INTO @Reach (TaskID, SpaceID, CanWrite, IsRoot)
    SELECT TaskID, SpaceID, CAST(CanWrite AS BIT), CAST(IsRoot AS BIT)
    FROM (
        SELECT TaskID, SpaceID, CanWrite, IsRoot,
               ROW_NUMBER() OVER (PARTITION BY TaskID ORDER BY IsRoot DESC, Steps) AS rn
        FROM Walk
    ) AS ranked
    WHERE rn = 1
    OPTION (MAXRECURSION 32);
    RETURN;
END;
GO

-- Views
GO
CREATE VIEW [${flyway:defaultSchema}].[vwItemUses]
AS
SELECT
    i.*,
    MJUser_UserID.[Name] AS [User],
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space]
FROM
    [${flyway:defaultSchema}].[ItemUse] AS i
INNER JOIN
    [${mjSchema}].[User] AS MJUser_UserID
  ON
    [i].[UserID] = MJUser_UserID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [i].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
GO
CREATE VIEW [${flyway:defaultSchema}].[vwShareNotices]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_RecipientUserID.[Name] AS [RecipientUser]
FROM
    [${flyway:defaultSchema}].[ShareNotice] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_RecipientUserID
  ON
    [s].[RecipientUserID] = MJUser_RecipientUserID.[ID]
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
CREATE VIEW [${flyway:defaultSchema}].[vwSpaceChats]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJConversation_ConversationID.[Name] AS [Conversation]
FROM
    [${flyway:defaultSchema}].[SpaceChat] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[Conversation] AS MJConversation_ConversationID
  ON
    [s].[ConversationID] = MJConversation_ConversationID.[ID]
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
CREATE VIEW [${flyway:defaultSchema}].[vwSpaceMembers]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_UserID.[Name] AS [User],
    mjBizAppsCollaborationSpaceRoleType_SpaceRoleTypeID.[Name] AS [SpaceRoleType],
    mjBizAppsCommonPerson_PersonID.[DisplayName] AS [Person]
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
LEFT OUTER JOIN
    [__mj_BizAppsCommon].[Person] AS mjBizAppsCommonPerson_PersonID
  ON
    [s].[PersonID] = mjBizAppsCommonPerson_PersonID.[ID]
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
CREATE VIEW [${flyway:defaultSchema}].[vwSpaceRoleTypes]
AS
SELECT
    s.*
FROM
    [${flyway:defaultSchema}].[SpaceRoleType] AS s
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
CREATE VIEW [${flyway:defaultSchema}].[vwSpaceTypes]
AS
SELECT
    s.*
FROM
    [${flyway:defaultSchema}].[SpaceType] AS s
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

-- Procedures
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateItemUse]
    @ID uniqueidentifier = NULL,
    @ItemID uniqueidentifier,
    @UserID uniqueidentifier,
    @UsedAt datetimeoffset,
    @Kind nvarchar(20),
    @SpaceID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[ItemUse]
            (
                [ID],
                [ItemID],
                [UserID],
                [UsedAt],
                [Kind],
                [SpaceID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @ItemID,
                @UserID,
                @UsedAt,
                @Kind,
                @SpaceID
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[ItemUse]
            (
                [ItemID],
                [UserID],
                [UsedAt],
                [Kind],
                [SpaceID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ItemID,
                @UserID,
                @UsedAt,
                @Kind,
                @SpaceID
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwItemUses] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateShareNotice]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @ItemID uniqueidentifier,
    @RecipientUserID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[ShareNotice]
            (
                [ID],
                [SpaceID],
                [ItemID],
                [RecipientUserID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @ItemID,
                @RecipientUserID
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[ShareNotice]
            (
                [SpaceID],
                [ItemID],
                [RecipientUserID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @ItemID,
                @RecipientUserID
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwShareNotices] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
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
CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteItemUse]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[ItemUse]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteShareNotice]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[ShareNotice]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
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
CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateItemUse]
    @ID uniqueidentifier,
    @ItemID uniqueidentifier = NULL,
    @UserID uniqueidentifier = NULL,
    @UsedAt datetimeoffset = NULL,
    @Kind nvarchar(20) = NULL,
    @SpaceID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ItemUse]
    SET
        [ItemID] = ISNULL(@ItemID, [ItemID]),
        [UserID] = ISNULL(@UserID, [UserID]),
        [UsedAt] = ISNULL(@UsedAt, [UsedAt]),
        [Kind] = ISNULL(@Kind, [Kind]),
        [SpaceID] = ISNULL(@SpaceID, [SpaceID])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwItemUses] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwItemUses]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateShareNotice]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @ItemID uniqueidentifier = NULL,
    @RecipientUserID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ShareNotice]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [ItemID] = ISNULL(@ItemID, [ItemID]),
        [RecipientUserID] = ISNULL(@RecipientUserID, [RecipientUserID])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwShareNotices] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwShareNotices]
                                    WHERE
                                        [ID] = @ID
                                    
END
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
CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceChat]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @ConversationID uniqueidentifier,
    @Name nvarchar(255),
    @Subject_Clear bit = 0,
    @Subject nvarchar(500) = NULL,
    @Kind nvarchar(50) = NULL,
    @Status nvarchar(50) = NULL,
    @ArchivedOnSpaceClose bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceChat]
            (
                [ID],
                [SpaceID],
                [ConversationID],
                [Name],
                [Subject],
                [Kind],
                [Status],
                [ArchivedOnSpaceClose]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @ConversationID,
                @Name,
                CASE WHEN @Subject_Clear = 1 THEN NULL ELSE ISNULL(@Subject, NULL) END,
                ISNULL(@Kind, 'General'),
                ISNULL(@Status, 'Active'),
                ISNULL(@ArchivedOnSpaceClose, 0)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceChat]
            (
                [SpaceID],
                [ConversationID],
                [Name],
                [Subject],
                [Kind],
                [Status],
                [ArchivedOnSpaceClose]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @ConversationID,
                @Name,
                CASE WHEN @Subject_Clear = 1 THEN NULL ELSE ISNULL(@Subject, NULL) END,
                ISNULL(@Kind, 'General'),
                ISNULL(@Status, 'Active'),
                ISNULL(@ArchivedOnSpaceClose, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceChats] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
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
CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceMember]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @UserID uniqueidentifier,
    @SpaceRoleTypeID uniqueidentifier,
    @Band nvarchar(20),
    @Status nvarchar(20) = NULL,
    @SyncSource_Clear bit = 0,
    @SyncSource nvarchar(100) = NULL,
    @PersonID_Clear bit = 0,
    @PersonID uniqueidentifier = NULL
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
                [Status],
                [SyncSource],
                [PersonID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @UserID,
                @SpaceRoleTypeID,
                @Band,
                ISNULL(@Status, 'Invited'),
                CASE WHEN @SyncSource_Clear = 1 THEN NULL ELSE ISNULL(@SyncSource, NULL) END,
                CASE WHEN @PersonID_Clear = 1 THEN NULL ELSE ISNULL(@PersonID, NULL) END
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
                [Status],
                [SyncSource],
                [PersonID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @UserID,
                @SpaceRoleTypeID,
                @Band,
                ISNULL(@Status, 'Invited'),
                CASE WHEN @SyncSource_Clear = 1 THEN NULL ELSE ISNULL(@SyncSource, NULL) END,
                CASE WHEN @PersonID_Clear = 1 THEN NULL ELSE ISNULL(@PersonID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceMembers] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
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
    @IsActive bit = NULL,
    @CanContribute bit = NULL
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
                [IsActive],
                [CanContribute]
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
                ISNULL(@IsActive, 1),
                ISNULL(@CanContribute, 0)
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
                [IsActive],
                [CanContribute]
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
                ISNULL(@IsActive, 1),
                ISNULL(@CanContribute, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceRoleTypes] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
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
CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceChat]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceChat]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
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
CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceChat]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @ConversationID uniqueidentifier = NULL,
    @Name nvarchar(255) = NULL,
    @Subject_Clear bit = 0,
    @Subject nvarchar(500) = NULL,
    @Kind nvarchar(50) = NULL,
    @Status nvarchar(50) = NULL,
    @ArchivedOnSpaceClose bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceChat]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [ConversationID] = ISNULL(@ConversationID, [ConversationID]),
        [Name] = ISNULL(@Name, [Name]),
        [Subject] = CASE WHEN @Subject_Clear = 1 THEN NULL ELSE ISNULL(@Subject, [Subject]) END,
        [Kind] = ISNULL(@Kind, [Kind]),
        [Status] = ISNULL(@Status, [Status]),
        [ArchivedOnSpaceClose] = ISNULL(@ArchivedOnSpaceClose, [ArchivedOnSpaceClose])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceChats] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceChats]
                                    WHERE
                                        [ID] = @ID
                                    
END
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
CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceMember]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @UserID uniqueidentifier = NULL,
    @SpaceRoleTypeID uniqueidentifier = NULL,
    @Band nvarchar(20) = NULL,
    @Status nvarchar(20) = NULL,
    @SyncSource_Clear bit = 0,
    @SyncSource nvarchar(100) = NULL,
    @PersonID_Clear bit = 0,
    @PersonID uniqueidentifier = NULL
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
        [Status] = ISNULL(@Status, [Status]),
        [SyncSource] = CASE WHEN @SyncSource_Clear = 1 THEN NULL ELSE ISNULL(@SyncSource, [SyncSource]) END,
        [PersonID] = CASE WHEN @PersonID_Clear = 1 THEN NULL ELSE ISNULL(@PersonID, [PersonID]) END
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
    @IsActive bit = NULL,
    @CanContribute bit = NULL
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
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [CanContribute] = ISNULL(@CanContribute, [CanContribute])
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

-- Triggers
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateItemUse
ON [${flyway:defaultSchema}].[ItemUse]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ItemUse]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[ItemUse] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateShareNotice
ON [${flyway:defaultSchema}].[ShareNotice]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ShareNotice]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[ShareNotice] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
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
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceChat
ON [${flyway:defaultSchema}].[SpaceChat]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceChat]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceChat] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
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

-- Foreign keys
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [FK_ItemUse_Item] FOREIGN KEY ([ItemID]) REFERENCES [${flyway:defaultSchema}].[SpaceItem] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [FK_ItemUse_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [FK_ItemUse_User] FOREIGN KEY ([UserID]) REFERENCES [${mjSchema}].[User] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD CONSTRAINT [FK_ShareNotice_Item] FOREIGN KEY ([ItemID]) REFERENCES [${flyway:defaultSchema}].[SpaceItem] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD CONSTRAINT [FK_ShareNotice_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD CONSTRAINT [FK_ShareNotice_User] FOREIGN KEY ([RecipientUserID]) REFERENCES [${mjSchema}].[User] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [FK_Space_Owner] FOREIGN KEY ([OwnerID]) REFERENCES [${mjSchema}].[User] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [FK_Space_Parent] FOREIGN KEY ([ParentID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [FK_Space_SpaceType] FOREIGN KEY ([SpaceTypeID]) REFERENCES [${flyway:defaultSchema}].[SpaceType] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[Space] ADD CONSTRAINT [FK_Space_Status] FOREIGN KEY ([StatusID]) REFERENCES [${flyway:defaultSchema}].[SpaceTypeStatus] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [FK_SpaceAnchor_Entity] FOREIGN KEY ([EntityID]) REFERENCES [${mjSchema}].[Entity] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [FK_SpaceAnchor_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceAnchor] ADD CONSTRAINT [FK_SpaceAnchor_SpaceType] FOREIGN KEY ([SpaceTypeID]) REFERENCES [${flyway:defaultSchema}].[SpaceType] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [FK_SpaceChat_Conversation] FOREIGN KEY ([ConversationID]) REFERENCES [${mjSchema}].[Conversation] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [FK_SpaceChat_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [FK_SpaceGrant_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [FK_SpaceGrant_SpaceType] FOREIGN KEY ([SpaceTypeID]) REFERENCES [${flyway:defaultSchema}].[SpaceType] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceGrant] ADD CONSTRAINT [FK_SpaceGrant_TargetEntity] FOREIGN KEY ([TargetEntityID]) REFERENCES [${mjSchema}].[Entity] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [FK_SpaceItem_ArtifactVersion] FOREIGN KEY ([ArtifactVersionID]) REFERENCES [${mjSchema}].[ArtifactVersion] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [FK_SpaceItem_Entity] FOREIGN KEY ([EntityID]) REFERENCES [${mjSchema}].[Entity] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [FK_SpaceItem_PromotedBy] FOREIGN KEY ([PromotedByUserID]) REFERENCES [${mjSchema}].[User] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD CONSTRAINT [FK_SpaceItem_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [FK_SpaceMember_Person] FOREIGN KEY ([PersonID]) REFERENCES [__mj_BizAppsCommon].[Person] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [FK_SpaceMember_Role] FOREIGN KEY ([SpaceRoleTypeID]) REFERENCES [${flyway:defaultSchema}].[SpaceRoleType] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [FK_SpaceMember_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMember] ADD CONSTRAINT [FK_SpaceMember_User] FOREIGN KEY ([UserID]) REFERENCES [${mjSchema}].[User] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [FK_SpaceMemberPin_Grant] FOREIGN KEY ([GrantID]) REFERENCES [${flyway:defaultSchema}].[SpaceGrant] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [FK_SpaceMemberPin_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [FK_SpaceMemberPin_TargetEntity] FOREIGN KEY ([TargetEntityID]) REFERENCES [${mjSchema}].[Entity] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceMemberPin] ADD CONSTRAINT [FK_SpaceMemberPin_User] FOREIGN KEY ([UserID]) REFERENCES [${mjSchema}].[User] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [FK_SpaceNote_Author] FOREIGN KEY ([AuthorUserID]) REFERENCES [${mjSchema}].[User] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceNote] ADD CONSTRAINT [FK_SpaceNote_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]);
GO
ALTER TABLE [${flyway:defaultSchema}].[SpaceTypeStatus] ADD CONSTRAINT [FK_SpaceTypeStatus_SpaceType] FOREIGN KEY ([SpaceTypeID]) REFERENCES [${flyway:defaultSchema}].[SpaceType] ([ID]);
GO

-- Permissions
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateItemUse] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateShareNotice] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAnchor] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceChat] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceGrant] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMemberPin] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceNote] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceRoleType] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceTypeStatus] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteItemUse] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteShareNotice] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAnchor] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceChat] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceGrant] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMemberPin] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceNote] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceRoleType] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceTypeStatus] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateItemUse] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateShareNotice] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAnchor] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceChat] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceGrant] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMemberPin] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceNote] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceRoleType] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceTypeStatus] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwItemUses] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwShareNotices] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAnchors] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceChats] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceGrants] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMemberPins] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceNotes] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceRoleTypes] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaces] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypeStatus] TO [cdp_Developer];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] TO [cdp_Developer];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateItemUse] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateShareNotice] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAnchor] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceChat] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceGrant] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMemberPin] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceNote] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceRoleType] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceTypeStatus] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteItemUse] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteShareNotice] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAnchor] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceChat] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceGrant] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceItem] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMemberPin] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceNote] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceRoleType] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceTypeStatus] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateItemUse] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateShareNotice] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAnchor] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceChat] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceGrant] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMemberPin] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceNote] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceRoleType] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceTypeStatus] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwItemUses] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwShareNotices] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAnchors] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceChats] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceGrants] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMemberPins] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceNotes] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceRoleTypes] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaces] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypeStatus] TO [cdp_Integration];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] TO [cdp_Integration];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] TO [cdp_UI];
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwItemUses] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwShareNotices] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAnchors] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceChats] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceGrants] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMemberPins] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceNotes] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceRoleTypes] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaces] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypeStatus] TO [cdp_UI];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] TO [cdp_UI];
GO

-- Extended properties (descriptions etc.)
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The spaces the caller reaches, plus every ancestor of each. Read by the Agents In Reach row filter: an agent attached to an ancestor space is one the caller may run in the space they reach.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'FUNCTION', @level1name = N'fnCollaborationSpaceAndAncestors';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space item that was used.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ItemUse', @level2type = N'COLUMN', @level2name = N'ItemID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'open, upload, or promote.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ItemUse', @level2type = N'COLUMN', @level2name = N'Kind';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space the use happened in. Required so the read filter can keep the row inside spaces the caller reaches.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ItemUse', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the use happened.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ItemUse', @level2type = N'COLUMN', @level2name = N'UsedAt';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The member who opened, uploaded, or promoted the item.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ItemUse', @level2type = N'COLUMN', @level2name = N'UserID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A record that a member opened, uploaded, or promoted an item.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ItemUse';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space item that was shared.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ShareNotice', @level2type = N'COLUMN', @level2name = N'ItemID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The member the notice is for.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ShareNotice', @level2type = N'COLUMN', @level2name = N'RecipientUserID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space the notice belongs to. The read filter keeps a caller inside spaces they reach.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ShareNotice', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A notice that an item in this space was shared with a member.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ShareNotice';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The entity of the anchored record.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'EntityID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The one anchor a space is found by. At most one per space.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'IsPrimary';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The record''s key, in the canonical shape SpaceItem.RecordID uses.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'RecordID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What the record is to the space, in the type''s vocabulary: chapter, sponsor, event. Data reach (D28) names an anchor by this role.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'Role';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display order among the space''s anchors.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'Sequence';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space''s type, denormalized so the primary-per-type index can hold; the server keeps it equal to the space''s and rewrites it when the type changes.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor', @level2type = N'COLUMN', @level2name = N'SpaceTypeID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A record a space is about (D26: a space may have several). The primary anchor is the one EnsureSpaceForRecord finds a space by; one per space, and one space per (type, record) as primary.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceAnchor';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Indicates whether this space chat conversation was archived when its space was closed so it can be restored on reopen.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceChat', @level2type = N'COLUMN', @level2name = N'ArchivedOnSpaceClose';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The band that may use the grant (D31). A Team grant is not offered in a chat where anyone cannot see Team.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Band';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JSON (SpaceGrantBindings): the target''s parameter or property names mapped to where each value comes from: an anchor by role, a column of the space, a configuration key, the user, or a literal (D27).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Bindings';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For an Agent grant: the agent a chat at this level starts with. One per level.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'IsDefault';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Agent, Action, Query, View, Dashboard, Component or KnowledgeSource. TargetEntityID must be the kind''s entity.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Kind';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What the space calls the target; null uses the target''s own name.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Label';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Extend adds the target at this level; Remove takes a target granted above out of this level''s list (D30).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Mode';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display order within the level.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Sequence';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JSON (AgentGrantSettings) for an Agent grant: skills, plan mode, effort, memory writes and per-run limits, each only narrowing the agent''s own definition (D31). Null for the other kinds.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'Settings';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space the grant belongs to; never set together with SpaceTypeID.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The type the grant belongs to; null with SpaceID null is the app''s own row.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'SpaceTypeID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The target''s entity: MJ: AI Agents, MJ: Actions, MJ: Queries, MJ: User Views, MJ: Dashboards, MJ: Components or MJ: Content Sources, by Kind.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'TargetEntityID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The target record''s key.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant', @level2type = N'COLUMN', @level2name = N'TargetRecordID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Something the app, a space type or a space offers in its spaces (D27''s seven kinds): an agent, an action, a query, a view, a dashboard, a component or a knowledge source, with the band that may use it, bindings from the space to the target''s parameters, and an agent''s narrowed settings. Replaces SpaceAgent, SpaceAgentSkill and SpaceKnowledgeSource.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceGrant';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For a document in the Library: the MJ Artifact Version (ContentMode File) wrapping the MJ: Files row the item points at, so the document has a type, a viewer and versions. NULL for items that are not files. Artifact Permissions are not used by the Library; the roster is the one sharing model.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'ArtifactVersionID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Team (working material, not in the client-facing agent scope) or Shared (promoted, with an actor and a timestamp).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'Band';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The entity the item points at. Same polymorphic pair TaskLink uses.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'EntityID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Folder label inside the space. Null means Unfiled. Collections cannot say everyone in the space, so the folder lives on the item.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'Folder';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When a Shared item was promoted. Null on Team items.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'PromotedAt';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'MJ user who promoted a Shared item. Required together with PromotedAt. Null on Team items.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'PromotedByUserID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Primary key of the pointed-at record, as text, matching TaskLink.RecordID.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem', @level2type = N'COLUMN', @level2name = N'RecordID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'An item in exactly one space: EntityID + RecordID, plus Team or Shared. Unique on (EntityID, RecordID) so an item cannot have two parents.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceItem';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For a Grant pin: the grant in force for the member''s space and band.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'GrantID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Record: a record of the space by entity and key. Grant: one of the space''s grants.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'Kind';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The member''s order of pins.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'Sequence';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space the pin is in.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For a Record pin: the record''s entity.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'TargetEntityID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'For a Record pin: the record''s key.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'TargetRecordID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Whose pin it is: the caller.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin', @level2type = N'COLUMN', @level2name = N'UserID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Something a member keeps at the top of a space (B22): a record of the space (an item, a note, a task) or one of the space''s grants (a view, a dashboard, a component). The member''s own; Home lists pins from the spaces they still reach.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMemberPin';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Team or Shared. Set by the server from the role: CanSeeTeamBand seats the person on Team, otherwise Shared. The filter reads the role, not this column.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMember', @level2type = N'COLUMN', @level2name = N'Band';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Invited, Active, or Removed. New rows start Invited unless the type auto-approves.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMember', @level2type = N'COLUMN', @level2name = N'Status';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'One roster row per user per space. Staff and outsiders are both MJ users. Status Active is the row the membership filter accepts.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceMember';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Who wrote the note: the caller on create, and the only one who edits or deletes it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'AuthorUserID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Team or Shared: who in the space may read it. A Team note moves to Shared only when the plan''s call 15 allows it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'Band';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The note''s body, Markdown.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'Body';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space the note belongs to.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The note''s title.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'Title';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Space: the band reads it. Private: the author alone, and then the band is Team.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote', @level2type = N'COLUMN', @level2name = N'Visibility';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A light note in a space (B21): the space''s own row on a band, not a library item, so the move-and-promote rules do not apply and it needs no ItemUse. Private notes are the author''s alone.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNote';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1 if the role may contribute content (create, update, or post items, tasks, and messages); 0 for read-only roles.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'CanContribute';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Holder may invite members into a space they belong to, inside their own subtree, at or below MaxGrantableLevel.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'CanInvite';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Holder may move an item from Team to Shared.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'CanPromoteBand';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Holder may read Team-band items. Shared-band items do not need this flag.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'CanSeeTeamBand';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The role that defines ownership of a space. The engine reads the flag, not the name.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'IsOwnerRole';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'This role''s own authority. A grant must be of a role whose Level is <= the grantor''s MaxGrantableLevel.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'Level';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Highest Level this role may grant. Always <= Level.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType', @level2type = N'COLUMN', @level2name = N'MaxGrantableLevel';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What a space member is allowed to do. The engine reads Level and the BIT flags. It never compares Code or Name.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceRoleType';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'An agent may quote the space''s material while it is in this status.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'AgentRetrieval';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Once a space reaches this status it may still move to another; off freezes it there. A frozen status must be terminal.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'CanChangeAfter';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The status''s key within its type: active, paused, closed, archived, or a type''s own.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'Code';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The status a new space of the type starts in; one per type.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'IsDefault';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Entering this status stamps Space.ClosedAt; retention and the closed views count from it. From a terminal status a space may move only to a higher Sequence, never back to an open one.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'IsTerminal';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What the status is called on screen.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'Name';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Entering this status sends the space''s "status changed" notice, one per member, through MJ''s notification chain.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'NotifyMembersOnEnter';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Members may read but not post, upload, assign or edit while the space is in this status.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'ReadOnly';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The definitive order of the type''s statuses, for display and for the rule that a terminal status may only move forward.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'Sequence';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The type this status belongs to.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'SpaceTypeID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space is listed and reachable by its members; off hides it from everyone but its owner and staff.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus', @level2type = N'COLUMN', @level2name = N'Visible';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A status a space type offers its spaces: Active, Paused, Closed and Archived ship for every type; a type may add its own. A space is in exactly one of its type''s statuses (Space.StatusID) and may only choose among them. The attributes say what a space in the status allows; the type''s driver may still refuse a change.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceTypeStatus';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Stable metadata key. The engine does not branch on it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Code';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Hex color code representing the space type (e.g., #0076b6).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Color';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Default AgentRetrieval for a new space of this type.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'DefaultAgentRetrieval';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Default AllowParentAssignees setting for new spaces of this type.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'DefaultAllowParentAssignees';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Default Team or Shared band for a new item in a space of this type.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'DefaultBand';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Hidden, Listed, or Open. Modelled now; the community surface that uses Listed and Open is a later release.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Discoverability';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Font Awesome icon class representing the space type (e.g., fa-solid fa-compass).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'IconClass';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Approve: a new member stays Invited until an owner of the space sets them Active. AutoApprove: the server creates the member Active. The invited person does not activate themselves.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'InviteApproval';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'InviteOnly, RequestToJoin, or SelfServe.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'JoinMode';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'File library panel is on.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'LibraryPanel';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Maximum members in one space of this type. Null means no cap.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'MemberCap';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Conversation panel is on for spaces of this type.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'MessagingPanel';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display name of the type.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Name';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Human noun for spaces of this type (workspace, committee, cohort, community). Open set.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'Vocabulary';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Task / work panel is on.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType', @level2type = N'COLUMN', @level2name = N'WorkPanel';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Kind of space: vocabulary, which panels are on, retention and agent defaults, and how outsiders join. Behavior lives in these columns, not in code branched on the name.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceType';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Included, ExcludedFromParentScope, or ExcludedEntirely. A human may read a space that no agent may quote.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'AgentRetrieval';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1 if participants in this space may assign people seated on ancestor spaces whose membership reaches this space; 0 to restrict assignment to seats in this space or below. Only staff may change this switch.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'AllowParentAssignees';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'URL of an optional hero banner or background image displayed in the space header and overview.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'BackgroundImageURL';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When this space closed. Closure is a timestamp on the sub-space, not a delete of the root.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'ClosedAt';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Hex color code representing the space (e.g., #0076b6, #10b981). Overrides SpaceType.Color if set.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'Color';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Font Awesome icon class representing the space (e.g., fa-solid fa-folder-tree, fa-solid fa-briefcase). Overrides SpaceType.IconClass if set.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'IconClass';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'1: members of this space are members of its descendants. 0: this sub-space keeps its own roster.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'InheritsMembership';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Designated name of the space.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'Name';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'MJ user who owns the space.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'OwnerID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Parent space. Null on a root. It does not carry the IsHierarchy flag, so CodeGen emits no path columns.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'ParentID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Target or planned close date/time for the space. Actual closure is recorded in ClosedAt.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'PlannedCloseAt';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When this space (usually a sub-space) started. The root outlives its children.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'StartedAt';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The status the space is in, one of its type''s (SpaceTypeStatus). NULL until the server stamps it: then the type''s default while ClosedAt is null, and the type''s first terminal status once ClosedAt is set, as fnCollaborationSpaceStatuses derives it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space', @level2type = N'COLUMN', @level2name = N'StatusID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The container. Permission boundary and agent retrieval boundary, as a tree: one root per relationship, sub-spaces for the work inside it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'Space';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'MemberJunction: BizApps Collaboration. Spaces are the permission and retrieval boundary. Conversations, tasks, and files compose in through SpaceItem.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}';
GO


-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================
-- CodeGen's capture, as the rows the migration stack left in MemberJunction's metadata tables on COLLAB_S1_STACK
-- (13 entities in __mj_BizAppsCollaboration), dumped by scripts/build-baseline.mjs. Role permissions here are the
-- defaults CodeGen writes for a new entity; the filters on them, the JSON types and the other roles come from metadata/.

-- [${mjSchema}].[Application]: 1 row(s)
INSERT INTO [${mjSchema}].[Application] ([ID], [Name], [Description], [Icon], [DefaultForNewUser], [SchemaAutoAddNewEntities], [Color], [DefaultNavItems], [ClassName], [DefaultSequence], [Status], [NavigationStyle], [TopNavLocation], [HideNavBarIconWhenActive], [Path], [AutoUpdatePath], [AgentSettings], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'${flyway:defaultSchema}', N'Generated for schema', NULL, 0, N'${flyway:defaultSchema}', NULL, NULL, NULL, 100, N'Active', N'App Switcher', NULL, 0, N'mjbizappscollaboration', 1, NULL, GETUTCDATE(), GETUTCDATE());
-- [${mjSchema}].[ApplicationRole]: 3 row(s)
INSERT INTO [${mjSchema}].[ApplicationRole] ([ID], [ApplicationID], [RoleID], [CanAccess], [CanAdmin], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'CB5F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationRole] ([ID], [ApplicationID], [RoleID], [CanAccess], [CanAdmin], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D25F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationRole] ([ID], [ApplicationID], [RoleID], [CanAccess], [CanAdmin], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C45F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0, GETUTCDATE(), GETUTCDATE());
-- [${mjSchema}].[Entity]: 13 row(s)
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', NULL, N'MJ_BizApps_Collaboration: Item Uses', NULL, N'A record that a member opened, uploaded, or promoted an item.', 1, N'ItemUse', N'vwItemUses', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Item Uses', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'AEC10B96-8D9E-485A-9AAF-968E3105B506', NULL, N'MJ_BizApps_Collaboration: Share Notices', NULL, N'A notice that an item in this space was shared with a member.', 1, N'ShareNotice', N'vwShareNotices', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Share Notices', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', NULL, N'MJ_BizApps_Collaboration: Space Anchors', NULL, N'A record a space is about (D26: a space may have several). The primary anchor is the one EnsureSpaceForRecord finds a space by; one per space, and one space per (type, record) as primary.', 1, N'SpaceAnchor', N'vwSpaceAnchors', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Anchors', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', NULL, N'MJ_BizApps_Collaboration: Space Chats', NULL, NULL, 1, N'SpaceChat', N'vwSpaceChats', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Chats', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', NULL, N'MJ_BizApps_Collaboration: Space Grants', NULL, N'Something the app, a space type or a space offers in its spaces (D27''s seven kinds): an agent, an action, a query, a view, a dashboard, a component or a knowledge source, with the band that may use it, bindings from the space to the target''s parameters, and an agent''s narrowed settings. Replaces SpaceAgent, SpaceAgentSkill and SpaceKnowledgeSource.', 1, N'SpaceGrant', N'vwSpaceGrants', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Grants', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'41165FEC-A52B-469A-A880-3B108C39A65E', NULL, N'MJ_BizApps_Collaboration: Space Items', NULL, N'An item in exactly one space: EntityID + RecordID, plus Team or Shared. Unique on (EntityID, RecordID) so an item cannot have two parents.', 1, N'SpaceItem', N'vwSpaceItems', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Items', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1DDE95B7-60B7-4A08-A886-57550B425C58', NULL, N'MJ_BizApps_Collaboration: Space Member Pins', NULL, N'Something a member keeps at the top of a space (B22): a record of the space (an item, a note, a task) or one of the space''s grants (a view, a dashboard, a component). The member''s own; Home lists pins from the spaces they still reach.', 1, N'SpaceMemberPin', N'vwSpaceMemberPins', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Member Pins', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', NULL, N'MJ_BizApps_Collaboration: Space Members', NULL, N'One roster row per user per space. Staff and outsiders are both MJ users. Status Active is the row the membership filter accepts.', 1, N'SpaceMember', N'vwSpaceMembers', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Members', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', NULL, N'MJ_BizApps_Collaboration: Space Notes', NULL, N'A light note in a space (B21): the space''s own row on a band, not a library item, so the move-and-promote rules do not apply and it needs no ItemUse. Private notes are the author''s alone.', 1, N'SpaceNote', N'vwSpaceNotes', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Notes', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', NULL, N'MJ_BizApps_Collaboration: Space Role Types', NULL, N'What a space member is allowed to do. The engine reads Level and the BIT flags. It never compares Code or Name.', 1, N'SpaceRoleType', N'vwSpaceRoleTypes', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Role Types', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', NULL, N'MJ_BizApps_Collaboration: Space Type Status', NULL, N'A status a space type offers its spaces: Active, Paused, Closed and Archived ship for every type; a type may add its own. A space is in exactly one of its type''s statuses (Space.StatusID) and may only choose among them. The attributes say what a space in the status allows; the type''s driver may still refuse a change.', 1, N'SpaceTypeStatus', N'vwSpaceTypeStatus', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Type Status', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'01596359-EC4B-449C-BA16-316DE4B92A4E', NULL, N'MJ_BizApps_Collaboration: Space Types', NULL, N'Kind of space: vocabulary, which panels are on, retention and agent defaults, and how outsiders join. Behavior lives in these columns, not in code branched on the name.', 1, N'SpaceType', N'vwSpaceTypes', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Space Types', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[Entity] ([ID], [ParentID], [Name], [NameSuffix], [Description], [AutoUpdateDescription], [BaseTable], [BaseView], [BaseViewGenerated], [SchemaName], [VirtualEntity], [TrackRecordChanges], [AuditRecordAccess], [AuditViewRuns], [IncludeInAPI], [AllowAllRowsAPI], [AllowUpdateAPI], [AllowCreateAPI], [AllowDeleteAPI], [CustomResolverAPI], [AllowUserSearchAPI], [FullTextSearchEnabled], [FullTextCatalog], [FullTextCatalogGenerated], [FullTextIndex], [FullTextIndexGenerated], [FullTextSearchFunction], [FullTextSearchFunctionGenerated], [UserViewMaxRows], [spCreate], [spUpdate], [spDelete], [spCreateGenerated], [spUpdateGenerated], [spDeleteGenerated], [CascadeDeletes], [DeleteType], [AllowRecordMerge], [spMatch], [RelationshipDefaultDisplayType], [UserFormGenerated], [EntityObjectSubclassName], [EntityObjectSubclassImport], [PreferredCommunicationField], [Icon], [ScopeDefault], [RowsToPackWithSchema], [RowsToPackSampleMethod], [RowsToPackSampleCount], [RowsToPackSampleOrder], [AutoRowCountFrequency], [RowCount], [RowCountRunAt], [Status], [DisplayName], [AllowMultipleSubtypes], [AutoUpdateFullTextSearch], [AutoUpdateAllowUserSearchAPI], [TrustServerCacheCompletely], [SupportsGeoCoding], [AutoUpdateSupportsGeoCoding], [AllowCaching], [DetectExternalChanges], [ExternalDataSourceID], [ExternalObjectName], [GeneratedBaseViewName], [AllowDirectSQLInsert], [AllowDirectSQLUpdate], [AllowDirectSQLDelete], [Configuration], [SubtypeSelector], [EnableFieldLevelSecurity], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', NULL, N'MJ_BizApps_Collaboration: Spaces', NULL, N'The container. Permission boundary and agent retrieval boundary, as a tree: one root per relationship, sub-spaces for the work inside it.', 1, N'Space', N'vwSpaces', 1, N'${flyway:defaultSchema}', 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, NULL, 1, NULL, 1, NULL, 1, 1000, NULL, NULL, NULL, 1, 1, 1, 0, N'Hard', 0, NULL, N'Search', 1, NULL, NULL, NULL, NULL, NULL, N'None', N'random', 0, NULL, NULL, NULL, NULL, N'Active', N'Spaces', 0, 1, 1, 1, 0, 1, 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, 0, GETUTCDATE(), GETUTCDATE());
-- [${mjSchema}].[ApplicationEntity]: 13 row(s)
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7A604E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 7, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'66604E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 6, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'49614E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 10, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8B604E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 8, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'59614E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 11, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2D604E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'41165FEC-A52B-469A-A880-3B108C39A65E', 4, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'79614E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 13, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'49604E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 5, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'69614E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 12, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F55F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 2, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'39614E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 9, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D95F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 1, 1, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[ApplicationEntity] ([ID], [ApplicationID], [EntityID], [Sequence], [DefaultForNewUser], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'11604E3E-F36B-1410-89A8-007AA2BDA0B9', N'94F5906B-38AB-4A9F-BFCA-3D395BBBC198', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 3, 1, GETUTCDATE(), GETUTCDATE());
-- [${mjSchema}].[EntityField]: 192 row(s)
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'933F62A7-C2E6-430A-B91B-348E77A991D9', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B536E74F-D6BA-481F-B8DE-D2AB2619669B', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 2, N'ItemID', N'Item ID', N'The space item that was used.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'41165FEC-A52B-469A-A880-3B108C39A65E', N'ID', 1, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E6794A01-1526-40A6-A1AE-BE4940B6A495', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 3, N'UserID', N'User ID', N'The member who opened, uploaded, or promoted the item.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E1238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'User', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'146CDEDA-C97C-4BC9-B17C-B1A1417B5EB5', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 4, N'UsedAt', N'Used At', N'When the use happened.', 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 100, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F1850061-8742-4CC6-A6C9-FCCF557D9EB1', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 5, N'Kind', N'Kind', N'open, upload, or promote.', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, NULL, 0, N'List', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'83607058-BC03-4A4F-8283-064F88A6824E', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 6, N'SpaceID', N'Space ID', N'The space the use happened in. Required so the read filter can keep the row inside spaces the caller reaches.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3B917508-C5FA-4C2D-ABA7-D1E72CFE24FE', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 7, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'5852F3A9-E974-4FC0-BD5D-9AA00BF79C8B', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 8, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6504CCA6-5691-4C33-9951-A3082B093048', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 9, N'User', N'User', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'514B7BD8-305F-49B6-87F7-A271FEEA7063', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 10, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7C65C7AB-BD2A-4EF1-B7DD-27DB69C522ED', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C51D518D-D106-4403-857A-9C2F9C59E53F', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 2, N'SpaceID', N'Space ID', N'The space the notice belongs to. The read filter keeps a caller inside spaces they reach.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8D1219C0-03AB-4282-B12D-7F1C9264CC5A', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 3, N'ItemID', N'Item ID', N'The space item that was shared.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'41165FEC-A52B-469A-A880-3B108C39A65E', N'ID', 1, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C51F17DC-EE2A-44A2-B454-B1E8513F6FB7', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 4, N'RecipientUserID', N'Recipient User ID', N'The member the notice is for.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E1238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'RecipientUser', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'9C96F52B-F438-4D1E-90FB-8566722FB847', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 5, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 1, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'ABB1DAC4-0D22-4EA2-94A3-279EB30484B7', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 6, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'42FFACCC-9742-4E2E-A648-A37EDDDF366E', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 7, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'926697FF-4689-437D-91A0-9CB965092FBE', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 8, N'RecipientUser', N'Recipient User', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6FC4047C-6D66-4FAC-8D60-D5791524572A', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'817B73B0-FFAC-455D-8893-7E10F469014B', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 2, N'SpaceID', N'Space ID', N'The space.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'0DDF6F20-20ED-4C75-B444-73206EB07BAE', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 3, N'SpaceTypeID', N'Space Type ID', N'The space''s type, denormalized so the primary-per-type index can hold; the server keeps it equal to the space''s and rewrites it when the type changes.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'01596359-EC4B-449C-BA16-316DE4B92A4E', N'ID', 1, N'SpaceType', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'BFF04097-AE6C-4C41-8D7E-D48642B145D5', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 4, N'EntityID', N'Entity ID', N'The entity of the anchored record.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E0238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'Entity', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'5C49D87B-ED1D-4FAB-8850-142E50D844F7', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 5, N'RecordID', N'Record ID', N'The record''s key, in the canonical shape SpaceItem.RecordID uses.', 1, 0, 1, NULL, N'nvarchar', 900, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E7B101BF-C210-493D-9816-4ED9AD7156D0', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 6, N'Role', N'Role', N'What the record is to the space, in the type''s vocabulary: chapter, sponsor, event. Data reach (D28) names an anchor by this role.', 1, 0, 1, NULL, N'nvarchar', 200, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C401F73A-35BC-4683-8E2C-63236208E6CE', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 7, N'IsPrimary', N'Is Primary', N'The one anchor a space is found by. At most one per space.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'13E3B6EA-79EF-4557-AB91-3B80A12D2D9F', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 8, N'Sequence', N'Sequence', N'Display order among the space''s anchors.', 1, 0, 0, NULL, N'int', 4, 10, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'01286846-9149-4F89-BA84-D5B543B8A8CE', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 9, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'AC7512D0-7725-4CDE-B701-ECACF0CBD4A9', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 10, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'BE3092CF-636E-4328-A101-5D0485CDDAF6', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 11, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'974DC2C6-6474-4847-A454-C8EE9293B021', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 12, N'SpaceType', N'Space Type', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7F230BC1-9F25-478F-B3EB-1E8804AB6911', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 13, N'Entity', N'Entity', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'5C95E84F-EABD-4A47-B67D-3FD86979EC07', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6D59D0FC-A8B8-43CF-B410-B89FF83BEABD', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 2, N'SpaceID', N'Space ID', NULL, 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'06F163A0-715A-4648-BD10-E716BDB75B95', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 3, N'ConversationID', N'Conversation ID', NULL, 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'13248F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'Conversation', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6D622643-972E-42B6-A507-76ABD15B38B4', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 4, N'Name', N'Name', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 1, 0, NULL, 1, N'Details', 0, 1, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'46EE73DF-2F73-4211-B1EE-240FB8032126', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 5, N'Subject', N'Subject', NULL, 1, 0, 0, NULL, N'nvarchar', 1000, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 6, N'Kind', N'Kind', NULL, 1, 0, 0, NULL, N'nvarchar', 100, 0, 0, 0, N'(''General'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D3FF7771-EEB6-46D1-A1CF-7D5977142EE1', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 7, N'Status', N'Status', NULL, 1, 0, 0, NULL, N'nvarchar', 100, 0, 0, 0, N'(''Active'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B397A9D5-E541-4EBA-AC9C-95E65580366F', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 8, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'49744E6E-D2D1-47D4-AD96-1A0D4EDCF97A', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 9, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E2F00C2E-9D8A-46DB-B817-27DC913A2211', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 10, N'ArchivedOnSpaceClose', N'Archived On Space Close', N'Indicates whether this space chat conversation was archived when its space was closed so it can be restored on reopen.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8419B7CE-F8AD-4F4C-9185-9BEC254528CD', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 11, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'95383DC4-B9C3-4549-8104-86289E1DA95B', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 12, N'Conversation', N'Conversation', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E32AEE83-1C7F-4021-9263-4870CC31AFEF', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F67EA75A-DDBB-4329-A306-00F95A0D3827', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 2, N'SpaceTypeID', N'Space Type ID', N'The type the grant belongs to; null with SpaceID null is the app''s own row.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'01596359-EC4B-449C-BA16-316DE4B92A4E', N'ID', 1, N'SpaceType', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'0BC6C9F2-EAC4-4695-9A62-57A997CEE92A', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 3, N'SpaceID', N'Space ID', N'The space the grant belongs to; never set together with SpaceTypeID.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B6D77525-17FC-45C7-8F09-832D53239799', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 4, N'Kind', N'Kind', N'Agent, Action, Query, View, Dashboard, Component or KnowledgeSource. TargetEntityID must be the kind''s entity.', 1, 0, 1, NULL, N'nvarchar', 60, 0, 0, 0, NULL, 0, N'List', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DB82E528-4E7A-45DB-933B-CC7D5523053E', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 5, N'TargetEntityID', N'Target Entity ID', N'The target''s entity: MJ: AI Agents, MJ: Actions, MJ: Queries, MJ: User Views, MJ: Dashboards, MJ: Components or MJ: Content Sources, by Kind.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E0238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'TargetEntity', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'060A8C3E-0E88-4DF9-929D-EF02EBA052E0', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 6, N'TargetRecordID', N'Target Record ID', N'The target record''s key.', 1, 0, 1, NULL, N'nvarchar', 900, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1A069960-DBCA-4255-96A3-B15E43916698', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 7, N'Label', N'Label', N'What the space calls the target; null uses the target''s own name.', 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 1, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'BeginsWith', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'26914BFF-EE45-4659-825C-C8FC1871D1C1', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 8, N'Band', N'Band', N'The band that may use the grant (D31). A Team grant is not offered in a chat where anyone cannot see Team.', 1, 0, 0, NULL, N'nvarchar', 20, 0, 0, 0, N'(N''Shared'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'BD9AAAA7-2A0C-438E-BF38-4E7AE0427352', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 9, N'IsDefault', N'Is Default', N'For an Agent grant: the agent a chat at this level starts with. One per level.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'0F31358B-BD5E-4305-B125-49B7FDFB1CD1', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 10, N'Bindings', N'Bindings', N'JSON (SpaceGrantBindings): the target''s parameter or property names mapped to where each value comes from: an anchor by role, a column of the space, a configuration key, the user, or a literal (D27).', 1, 0, 0, NULL, N'nvarchar', -1, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'656F486F-6113-4EF7-8F50-C58204997A04', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 11, N'Settings', N'Settings', N'JSON (AgentGrantSettings) for an Agent grant: skills, plan mode, effort, memory writes and per-run limits, each only narrowing the agent''s own definition (D31). Null for the other kinds.', 1, 0, 0, NULL, N'nvarchar', -1, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'304AD3AB-BD76-42FE-AE49-F1EDCAE5B55C', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 12, N'Mode', N'Mode', N'Extend adds the target at this level; Remove takes a target granted above out of this level''s list (D30).', 1, 0, 0, NULL, N'nvarchar', 20, 0, 0, 0, N'(N''Extend'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'944F76CD-93C3-4C2F-81DA-105444404BCD', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 13, N'Sequence', N'Sequence', N'Display order within the level.', 1, 0, 0, NULL, N'int', 4, 10, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2F8725C4-CF06-465A-8FF6-B8F05373C11E', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 14, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'532E5C01-30E3-4A72-B091-BAF379A4AD42', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 15, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DA259578-995C-4A52-B44F-A99D79B1DCA5', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 16, N'SpaceType', N'Space Type', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C4CD652E-85A8-4B76-88C2-578FC0FFB1BF', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 17, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7211F241-2D97-4056-8B09-2C459B2B7DCC', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 18, N'TargetEntity', N'Target Entity', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DA6FF4EB-D3D4-4F9D-9853-0473A63AA885', N'41165FEC-A52B-469A-A880-3B108C39A65E', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FDF9D0D3-4C4C-4FDB-AA2E-653007E2402E', N'41165FEC-A52B-469A-A880-3B108C39A65E', 2, N'SpaceID', N'Space ID', NULL, 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'40B833D2-7D75-40E6-8405-6020A3238046', N'41165FEC-A52B-469A-A880-3B108C39A65E', 3, N'EntityID', N'Entity ID', N'The entity the item points at. Same polymorphic pair TaskLink uses.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E0238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'Entity', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'59A6AF00-0046-441A-80CF-4B743BA8A8D1', N'41165FEC-A52B-469A-A880-3B108C39A65E', 4, N'RecordID', N'Record ID', N'Primary key of the pointed-at record, as text, matching TaskLink.RecordID.', 1, 0, 1, NULL, N'nvarchar', 900, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D82E6F1A-36F5-4F28-BA68-BCED57F9E8B5', N'41165FEC-A52B-469A-A880-3B108C39A65E', 5, N'Band', N'Band', N'Team (working material, not in the client-facing agent scope) or Shared (promoted, with an actor and a timestamp).', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, NULL, 0, N'List', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6A284D7E-37B3-4A5F-8AAF-E05E9AEF26A0', N'41165FEC-A52B-469A-A880-3B108C39A65E', 6, N'PromotedAt', N'Promoted At', N'When a Shared item was promoted. Null on Team items.', 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 100, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'311EF033-BF80-43B2-8BBB-7313D717F872', N'41165FEC-A52B-469A-A880-3B108C39A65E', 7, N'PromotedByUserID', N'Promoted By User ID', N'MJ user who promoted a Shared item. Required together with PromotedAt. Null on Team items.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E1238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'PromotedByUser', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'288432CC-18B5-49BB-AFCF-9B9C8535BB7F', N'41165FEC-A52B-469A-A880-3B108C39A65E', 8, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6545B3FE-8DB0-41DD-A005-A9E0D3898F36', N'41165FEC-A52B-469A-A880-3B108C39A65E', 9, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FFB8109C-C1F4-4DF4-97AE-6BACF7E6A095', N'41165FEC-A52B-469A-A880-3B108C39A65E', 10, N'Folder', N'Folder', N'Folder label inside the space. Null means Unfiled. Collections cannot say everyone in the space, so the folder lives on the item.', 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'0A0C811B-7A58-4B90-B5F9-A67D4D06C706', N'41165FEC-A52B-469A-A880-3B108C39A65E', 11, N'ArtifactVersionID', N'Artifact Version ID', N'For a document in the Library: the MJ Artifact Version (ContentMode File) wrapping the MJ: Files row the item points at, so the document has a type, a viewer and versions. NULL for items that are not files. Artifact Permissions are not used by the Library; the roster is the one sharing model.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'AEB408D2-162A-49AE-9DC2-DBE9A21A3C01', N'ID', 1, N'ArtifactVersion', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E7BBFA79-CE0C-49B6-A985-E68C65D50B22', N'41165FEC-A52B-469A-A880-3B108C39A65E', 12, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2A01BD43-FAB4-426C-B3F3-348343F45121', N'41165FEC-A52B-469A-A880-3B108C39A65E', 13, N'Entity', N'Entity', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FA60C05A-A9EA-4754-8725-407478229BB1', N'41165FEC-A52B-469A-A880-3B108C39A65E', 14, N'PromotedByUser', N'Promoted By User', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3BF69A67-493D-48BB-95C6-FBA53A5A27CD', N'41165FEC-A52B-469A-A880-3B108C39A65E', 15, N'ArtifactVersion', N'Artifact Version', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E556A94C-DC78-47DA-9313-5F299A4B2840', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7DDB7D3F-7DD6-44C2-8EC4-B941ADF567D7', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 2, N'SpaceID', N'Space ID', N'The space the pin is in.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8E465BEA-BC4D-4BDF-8D0E-ED1657E549B3', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 3, N'UserID', N'User ID', N'Whose pin it is: the caller.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E1238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'User', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'12BE73D4-06F7-4830-B2CF-4A30F73B74C7', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 4, N'Kind', N'Kind', N'Record: a record of the space by entity and key. Grant: one of the space''s grants.', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, NULL, 0, N'List', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6851483E-7F66-4721-96FA-C929F5A4B360', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 5, N'TargetEntityID', N'Target Entity ID', N'For a Record pin: the record''s entity.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E0238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'TargetEntity', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A4B6E207-6E4D-4650-8C58-BB70B2804594', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 6, N'TargetRecordID', N'Target Record ID', N'For a Record pin: the record''s key.', 1, 0, 1, NULL, N'nvarchar', 900, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'174948A1-7C29-4022-A28E-2408F55341BC', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 7, N'GrantID', N'Grant ID', N'For a Grant pin: the grant in force for the member''s space and band.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', N'ID', 1, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3D22B40B-0123-4D7F-8035-D7C05445C4EC', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 8, N'Sequence', N'Sequence', N'The member''s order of pins.', 1, 0, 0, NULL, N'int', 4, 10, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'95F3C607-D797-4C8C-B69F-903C722BEAD4', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 9, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D6E974D9-6691-4D3F-BC0E-FD5AD5901ED4', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 10, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A673D3A5-F8DE-4543-BADA-7DE6F65A9AAA', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 11, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'92B7BF80-5057-4D55-A272-F5A0C4BAD464', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 12, N'User', N'User', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1BBE87C3-2127-4D11-A636-301A34E1F7FA', N'1DDE95B7-60B7-4A08-A886-57550B425C58', 13, N'TargetEntity', N'Target Entity', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'4AAFFF81-8843-40B3-BD77-47BD577D1662', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6E6E95CD-F6A2-47E0-8945-0AE5F9B02913', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 2, N'SpaceID', N'Space ID', NULL, 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6A25C49E-8466-428C-889D-6FCB7B48ECFE', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 3, N'UserID', N'User ID', NULL, 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E1238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'User', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'508D368E-AEF1-4FFA-83DC-962109380754', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 4, N'SpaceRoleTypeID', N'Space Role Type ID', NULL, 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', N'ID', 1, N'SpaceRoleType', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'17968F2E-12CB-4FFE-91A5-CAAD3446A8F6', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 5, N'Band', N'Band', N'Team or Shared. Set by the server from the role: CanSeeTeamBand seats the person on Team, otherwise Shared. The filter reads the role, not this column.', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, NULL, 0, N'List', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'0E14CF05-6787-4C37-88D8-25C8D644436C', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 6, N'Status', N'Status', N'Invited, Active, or Removed. New rows start Invited unless the type auto-approves.', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, N'(''Invited'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1F20E1FB-18B2-4473-8889-E0E01CDC5FC2', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 7, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E0CFD740-4D68-47FE-9EA5-CBACF8A0DE60', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 8, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7B50FB27-82C2-4F86-B4B2-0A32915ACF23', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 9, N'SyncSource', N'Sync Source', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1522BBFC-D0C2-4E5F-9C71-B2A3459A8A35', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 10, N'PersonID', N'Person ID', NULL, 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F', N'ID', 1, N'Person', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6D5375D1-FA11-4951-9360-F4B822B96B02', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 11, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'591DEB1F-E146-43A9-962D-6402C0C45F57', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 12, N'User', N'User', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1E1DB29B-74BC-44BF-A492-0099D98DF8F1', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 13, N'SpaceRoleType', N'Space Role Type', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'92472EEA-8E63-4413-BE93-3109ED25C76B', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 14, N'Person', N'Person', NULL, 1, 0, 0, NULL, N'nvarchar', 402, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'BDCA0BA4-C979-4CC3-B1DD-3582495E0906', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2C525DBC-BFF7-47A5-9619-BC9251DBEFE1', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 2, N'SpaceID', N'Space ID', N'The space the note belongs to.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Space', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DA23B4F8-F051-4396-8BF5-1C893749EFAA', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 3, N'Title', N'Title', N'The note''s title.', 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 1, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'BeginsWith', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'EEC0C3FF-1B29-491A-847A-B2EE3D8DC712', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 4, N'Body', N'Body', N'The note''s body, Markdown.', 1, 0, 0, NULL, N'nvarchar', -1, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'AD6A55D3-8F26-4D9F-A277-3C8E92755BA9', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 5, N'Band', N'Band', N'Team or Shared: who in the space may read it. A Team note moves to Shared only when the plan''s call 15 allows it.', 1, 0, 0, NULL, N'nvarchar', 20, 0, 0, 0, N'(N''Team'')', 0, N'List', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8C2B6090-02C5-4C9E-BD3F-9CE0A99E25B9', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 6, N'Visibility', N'Visibility', N'Space: the band reads it. Private: the author alone, and then the band is Team.', 1, 0, 0, NULL, N'nvarchar', 20, 0, 0, 0, N'(N''Space'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'51C8F841-53DC-4021-95AF-019317D0B7BA', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 7, N'AuthorUserID', N'Author User ID', N'Who wrote the note: the caller on create, and the only one who edits or deletes it.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E1238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'AuthorUser', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2A78FF01-77EE-4F81-A04B-C587EF24E345', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 8, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8BCF1254-E7B9-48D0-BF6C-50D8A8F267F7', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 9, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'10967F82-E8F3-429A-9E29-B71C39E736E7', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 10, N'Space', N'Space', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'4F3F0FEA-877C-477E-977D-AD7D516C355D', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 11, N'AuthorUser', N'Author User', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3C16BF1B-DAA7-4CDF-9453-F94F75AA471B', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1B1A2DD3-1307-41E3-9990-97E7870B3AD5', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 2, N'Code', N'Code', NULL, 1, 0, 1, NULL, N'nvarchar', 80, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7F8901B2-3230-4588-AE73-C8CC42AE4A3A', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 3, N'Name', N'Name', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 1, 0, NULL, 1, N'Details', 0, 1, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A1577C7F-DAF5-4A59-AC60-BD0D182183EA', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 4, N'Description', N'Description', NULL, 1, 0, 0, NULL, N'nvarchar', -1, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'27B95589-9EE5-4DAB-8B95-431E8B6E4777', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 5, N'Level', N'Level', N'This role''s own authority. A grant must be of a role whose Level is <= the grantor''s MaxGrantableLevel.', 1, 0, 0, NULL, N'int', 4, 10, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C4C972A0-F26F-4232-969E-3CEEFC863890', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 6, N'MaxGrantableLevel', N'Max Grantable Level', N'Highest Level this role may grant. Always <= Level.', 1, 0, 0, NULL, N'int', 4, 10, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C1845A5F-A347-4B3E-81BC-78CB0778725B', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 7, N'CanInvite', N'Can Invite', N'Holder may invite members into a space they belong to, inside their own subtree, at or below MaxGrantableLevel.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3F72F228-1233-4A6A-9757-F00D2F4CD4DB', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 8, N'CanPromoteBand', N'Can Promote Band', N'Holder may move an item from Team to Shared.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FE35DF41-D4A5-41A0-8FE8-40A46C0D1604', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 9, N'CanSeeTeamBand', N'Can See Team Band', N'Holder may read Team-band items. Shared-band items do not need this flag.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'00B28AA0-7EA1-475F-884E-290C343ED157', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 10, N'IsOwnerRole', N'Is Owner Role', N'The role that defines ownership of a space. The engine reads the flag, not the name.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'01A1DFD4-B646-4FA4-9AA0-AAD95DF9A1EF', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 11, N'DisplayRank', N'Display Rank', NULL, 1, 0, 0, NULL, N'int', 4, 10, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8917CECD-EED0-4550-8194-91DB34912ABA', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 12, N'IsActive', N'Is Active', NULL, 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((1))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1122AB24-7770-49C7-8E96-59E465938BAE', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 13, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D19BA4BC-C478-41A7-862B-9FCD9FA77829', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 14, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7DDD0E2E-5781-4008-825E-805BA799979E', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 15, N'CanContribute', N'Can Contribute', N'1 if the role may contribute content (create, update, or post items, tasks, and messages); 0 for read-only roles.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2748D3DC-84FD-453B-ABAC-0F9EBDD32CEF', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'CF239F2A-ECD3-4025-A1D3-BA2299AF289E', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 2, N'SpaceTypeID', N'Space Type ID', N'The type this status belongs to.', 1, 0, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'01596359-EC4B-449C-BA16-316DE4B92A4E', N'ID', 1, N'SpaceType', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FE2FE2A2-B6B4-464D-A325-D9B1AA38AD2E', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 3, N'Code', N'Code', N'The status''s key within its type: active, paused, closed, archived, or a type''s own.', 1, 0, 1, NULL, N'nvarchar', 80, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6E2F5E31-BC68-4214-88F3-B46F127D29F8', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 4, N'Name', N'Name', N'What the status is called on screen.', 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 1, 0, NULL, 1, N'Details', 0, 1, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'5E75EFBA-C997-40EC-A0A5-2836F845780B', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 5, N'Sequence', N'Sequence', N'The definitive order of the type''s statuses, for display and for the rule that a terminal status may only move forward.', 1, 0, 1, NULL, N'int', 4, 10, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A91DACCB-84CD-42BE-A8A1-5416A3416741', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 6, N'IsDefault', N'Is Default', N'The status a new space of the type starts in; one per type.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'455AF773-9854-4E89-80F1-6CF1D71E4C99', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 7, N'ReadOnly', N'Read Only', N'Members may read but not post, upload, assign or edit while the space is in this status.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'791BCF97-4B92-4C0E-8433-3F04A8E8F070', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 8, N'Visible', N'Visible', N'The space is listed and reachable by its members; off hides it from everyone but its owner and staff.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((1))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E4C4890D-6BD6-41B6-8A47-9D84726051DD', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 9, N'AgentRetrieval', N'Agent Retrieval', N'An agent may quote the space''s material while it is in this status.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((1))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'75E44ECC-A6C3-459D-8C47-99BA872A781E', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 10, N'CanChangeAfter', N'Can Change After', N'Once a space reaches this status it may still move to another; off freezes it there. A frozen status must be terminal.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((1))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A4202261-6735-45A1-ABB5-EC730DEEFF80', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 11, N'NotifyMembersOnEnter', N'Notify Members On Enter', N'Entering this status sends the space''s "status changed" notice, one per member, through MJ''s notification chain.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'22F0885B-FF3F-4CE0-8384-E49363A59EFE', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 12, N'IsTerminal', N'Is Terminal', N'Entering this status stamps Space.ClosedAt; retention and the closed views count from it. From a terminal status a space may move only to a higher Sequence, never back to an open one.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'881B9530-AA4A-40DE-8B6A-BE92BA611313', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 13, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'158680B6-FD22-4AE1-AD2E-EA57338B6A49', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 14, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'9DAF4AF1-CFDD-4B93-8AC1-79AF5294928E', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 15, N'SpaceType', N'Space Type', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3A2EEDB6-3FB0-49A2-AD53-7ABBF5F1BB27', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'255C898B-8CA4-4C6F-950F-46397676F60C', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 2, N'Code', N'Code', N'Stable metadata key. The engine does not branch on it.', 1, 0, 1, NULL, N'nvarchar', 80, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'57BC4FEE-A9E1-4D23-A11E-85FF6467B73B', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 3, N'Name', N'Name', N'Display name of the type.', 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 1, 0, NULL, 1, N'Details', 0, 1, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B6B0763B-9BAE-40DF-A8CF-0A11581B2381', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 4, N'Description', N'Description', NULL, 1, 0, 0, NULL, N'nvarchar', -1, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'94EC3B15-E02D-4ADB-8688-32C101F424AD', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 5, N'Vocabulary', N'Vocabulary', N'Human noun for spaces of this type (workspace, committee, cohort, community). Open set.', 1, 0, 0, NULL, N'nvarchar', 100, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7045CA4F-EF10-44C4-8F26-3A40537ADE62', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 6, N'Discoverability', N'Discoverability', N'Hidden, Listed, or Open. Modelled now; the community surface that uses Listed and Open is a later release.', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, N'(''Hidden'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 7, N'JoinMode', N'Join Mode', N'InviteOnly, RequestToJoin, or SelfServe.', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, N'(''InviteOnly'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DD81C48E-8571-4540-80B0-7C1B4E14205D', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 8, N'MessagingPanel', N'Messaging Panel', N'Conversation panel is on for spaces of this type.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((1))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B7D2A463-439E-4BEA-9293-C71B3678FC12', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 9, N'LibraryPanel', N'Library Panel', N'File library panel is on.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B600313C-B4FC-46F6-8086-B0E8946BED2B', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 10, N'WorkPanel', N'Work Panel', N'Task / work panel is on.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A547E641-F873-405E-8B16-889981DFE331', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 11, N'DefaultAgentRetrieval', N'Default Agent Retrieval', N'Default AgentRetrieval for a new space of this type.', 1, 0, 0, NULL, N'nvarchar', 60, 0, 0, 0, N'(''Included'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F8CEF3B6-E595-4B00-848A-0467C4DD4C49', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 12, N'DefaultBand', N'Default Band', N'Default Team or Shared band for a new item in a space of this type.', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, N'(''Team'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1BC5FCAB-DB51-4294-B2A4-8BDEFE49A9A5', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 13, N'InviteApproval', N'Invite Approval', N'Approve: a new member stays Invited until an owner of the space sets them Active. AutoApprove: the server creates the member Active. The invited person does not activate themselves.', 1, 0, 0, NULL, N'nvarchar', 40, 0, 0, 0, N'(''Approve'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'19FA067B-221A-4655-BA4A-80044BB42A09', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 14, N'MemberCap', N'Member Cap', N'Maximum members in one space of this type. Null means no cap.', 1, 0, 0, NULL, N'int', 4, 10, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A1D85470-DEE9-400C-923A-613D23F4854B', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 15, N'DisplayRank', N'Display Rank', NULL, 1, 0, 0, NULL, N'int', 4, 10, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 50, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'534741D7-3D2F-4D0D-8DBB-B97CB3E1C887', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 16, N'IsActive', N'Is Active', NULL, 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((1))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3CD76CF7-79B9-45A9-BA54-A006CC435106', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 17, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'4ED5C2C3-2B54-453B-AB3D-A179FB7B4F24', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 18, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'99115B9C-2F45-4B34-904B-0F1967D2AA9B', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 19, N'DefaultAllowParentAssignees', N'Default Allow Parent Assignees', N'Default AllowParentAssignees setting for new spaces of this type.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((1))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'89081D51-BC22-4251-94A9-759EF5EBFAB8', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 20, N'IconClass', N'Icon Class', N'Font Awesome icon class representing the space type (e.g., fa-solid fa-compass).', 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3D61333B-37E0-4F4D-A130-E34B81AD383E', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 21, N'Color', N'Color', N'Hex color code representing the space type (e.g., #0076b6).', 1, 0, 0, NULL, N'nvarchar', 100, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'EF99326C-0130-45DA-8972-2CA490A19DAC', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 22, N'ServerDriverClass', N'Server Driver Class', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'AFB29E92-8A48-4004-96BE-37510BAF6FFF', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 23, N'UIDriverClass', N'UI Driver Class', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F83E6039-BD20-46B6-8E44-39E88AFE84A0', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 24, N'SpaceExtensionEntity', N'Space Extension Entity', NULL, 1, 0, 0, NULL, N'nvarchar', 510, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E4C8FC04-6663-4A37-98AB-1F1279931BC0', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 25, N'Configuration', N'Configuration', NULL, 1, 0, 0, NULL, N'nvarchar', -1, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2B846791-1E9F-4D9A-A270-071F9DA35B86', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 1, N'ID', N'ID', NULL, 1, 1, 1, NULL, N'uniqueidentifier', 16, 0, 0, 0, N'(newsequentialid())', 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'63D37354-8FC7-4262-B12E-3A7929A14519', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 2, N'SpaceTypeID', N'Space Type ID', NULL, 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'01596359-EC4B-449C-BA16-316DE4B92A4E', N'ID', 1, N'SpaceType', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'5948F19F-70AA-49F4-BB6B-1FB059507477', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 3, N'ParentID', N'Parent ID', N'Parent space. Null on a root. It does not carry the IsHierarchy flag, so CodeGen emits no path columns.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'ID', 1, N'Parent', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F3FDC584-1FCB-4938-89D7-94E599227FB8', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 4, N'Name', N'Name', N'Designated name of the space.', 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 1, 0, NULL, 1, N'Details', 0, 1, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8EDB58B7-9B4B-4437-831A-EE18F11A9BD3', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 5, N'Description', N'Description', NULL, 1, 0, 0, NULL, N'nvarchar', -1, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 1, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'99904068-14A3-4618-B955-20CA18EE5047', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 6, N'OwnerID', N'Owner ID', N'MJ user who owns the space.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'E1238F34-2837-EF11-86D4-6045BDEE16E6', N'ID', 1, N'Owner', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'4038216F-69B6-4A90-BC29-D77515D14210', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 7, N'InheritsMembership', N'Inherits Membership', N'1: members of this space are members of its descendants. 0: this sub-space keeps its own roster.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((0))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6ECC450C-640C-4F79-94D9-641AA433D358', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 8, N'AgentRetrieval', N'Agent Retrieval', N'Included, ExcludedFromParentScope, or ExcludedEntirely. A human may read a space that no agent may quote.', 1, 0, 0, NULL, N'nvarchar', 60, 0, 0, 0, N'(''Included'')', 0, N'List', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E5152C24-1404-463B-A225-FD0609686658', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 9, N'StartedAt', N'Started At', N'When this space (usually a sub-space) started. The root outlives its children.', 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 100, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B7F653A4-25C5-4B2B-9AB6-7C79AFFA8AC0', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 10, N'ClosedAt', N'Closed At', N'When this space closed. Closure is a timestamp on the sub-space, not a delete of the root.', 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 100, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'067EBB18-4CD5-4F21-9036-EE3A45B00138', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 11, N'__mj_CreatedAt', N'Created At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7BC7FEFB-FB4B-4A9D-AD0C-B19BEC58D68E', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 12, N'__mj_UpdatedAt', N'Updated At', NULL, 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 0, N'(getutcdate())', 0, N'None', NULL, NULL, 0, NULL, 100, 0, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'60473939-F7F8-4229-BD85-BB3C139EB2AA', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 13, N'AllowParentAssignees', N'Allow Parent Assignees', N'1 if participants in this space may assign people seated on ancestor spaces whose membership reaches this space; 0 to restrict assignment to seats in this space or below. Only staff may change this switch.', 1, 0, 0, NULL, N'bit', 1, 1, 0, 0, N'((1))', 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2CD61756-C226-4F27-8E6E-E4CC61C7A6ED', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 14, N'PlannedCloseAt', N'Planned Close At', N'Target or planned close date/time for the space. Actual closure is recorded in ClosedAt.', 1, 0, 0, NULL, N'datetimeoffset', 10, 34, 7, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 100, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D826EF6D-6A39-42B9-814F-B69BD5D085B9', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 15, N'IconClass', N'Icon Class', N'Font Awesome icon class representing the space (e.g., fa-solid fa-folder-tree, fa-solid fa-briefcase). Overrides SpaceType.IconClass if set.', 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'9DCCC224-4BFC-4241-B6BF-F11D2083024B', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 16, N'Color', N'Color', N'Hex color code representing the space (e.g., #0076b6, #10b981). Overrides SpaceType.Color if set.', 1, 0, 0, NULL, N'nvarchar', 100, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8B513405-1966-4719-B1C3-CE08FA87BF21', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 17, N'BackgroundImageURL', N'Background Image URL', N'URL of an optional hero banner or background image displayed in the space header and overview.', 1, 0, 0, NULL, N'nvarchar', 2000, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'265475D6-4092-4555-9AB0-48584F98F3BA', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 18, N'Configuration', N'Configuration', NULL, 1, 0, 0, NULL, N'nvarchar', -1, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'0AF47B63-DA30-4680-8091-E06BE3F2C0B5', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 19, N'StatusID', N'Status ID', N'The status the space is in, one of its type''s (SpaceTypeStatus). NULL until the server stamps it: then the type''s default while ClosedAt is null, and the type''s first terminal status once ClosedAt is set, as fnCollaborationSpaceStatuses derives it.', 1, 0, 0, NULL, N'uniqueidentifier', 16, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 1, 1, 0, 0, NULL, 1, N'Details', 0, 0, N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', N'ID', 1, N'Status', N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D16E1EB2-8851-4515-9601-2FE88E3BAEE4', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 20, N'SpaceType', N'Space Type', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E6B00068-B5C1-430B-A8F5-B78DA1DA5AA5', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 21, N'Parent', N'Parent', NULL, 1, 0, 0, NULL, N'nvarchar', 400, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B4A0D865-66AB-4682-A1B2-161FCC3AF6BF', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 22, N'Owner', N'Owner', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 0, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [AutoUpdateDescription], [IsPrimaryKey], [IsUnique], [Category], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [ValueListType], [ExtendedType], [CodeType], [DefaultInView], [ViewCellTemplate], [DefaultColumnWidth], [AllowUpdateAPI], [AllowUpdateInView], [IncludeInUserSearchAPI], [FullTextSearchEnabled], [UserSearchParamFormatAPI], [IncludeInGeneratedForm], [GeneratedFormSection], [IsVirtual], [IsNameField], [RelatedEntityID], [RelatedEntityFieldName], [IncludeRelatedEntityNameFieldInBaseView], [RelatedEntityNameFieldMap], [RelatedEntityDisplayType], [EntityIDFieldName], [ScopeDefault], [AutoUpdateRelatedEntityInfo], [ValuesToPackWithSchema], [Status], [AutoUpdateIsNameField], [AutoUpdateDefaultInView], [AutoUpdateCategory], [AutoUpdateDisplayName], [AutoUpdateIncludeInUserSearchAPI], [Encrypt], [EncryptionKeyID], [AllowDecryptInAPI], [SendEncryptedValue], [IsSoftPrimaryKey], [IsSoftForeignKey], [RelatedEntityJoinFields], [JSONType], [JSONTypeIsArray], [JSONTypeDefinition], [UserSearchPredicateAPI], [AutoUpdateUserSearchPredicate], [AutoUpdateFullTextSearch], [AutoUpdateExtendedType], [IsComputed], [EmbeddedRecord], [Configuration], [RelatedEntityFilter], [RelatedEntityOrderBy], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3EDB6A48-4F1B-48EF-B487-216CB3108CC4', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 23, N'Status', N'Status', NULL, 1, 0, 0, NULL, N'nvarchar', 200, 0, 0, 1, NULL, 0, N'None', NULL, NULL, 0, NULL, 150, 0, 1, 0, 0, NULL, 1, N'Details', 1, 0, NULL, NULL, 0, NULL, N'Search', NULL, NULL, 1, N'Auto', N'Active', 1, 1, 1, 1, 1, 0, NULL, 0, 0, 0, 0, NULL, NULL, 0, NULL, N'Contains', 1, 1, 1, 0, NULL, NULL, NULL, NULL, GETUTCDATE(), GETUTCDATE());
-- [${mjSchema}].[EntityFieldValue]: 48 row(s)
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C42A8810-91E1-427E-B822-7ADCC0F3C6BE', N'F1850061-8742-4CC6-A6C9-FCCF557D9EB1', 1, N'open', N'open', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F6016A18-9615-475F-9924-E10E8B188CCA', N'F1850061-8742-4CC6-A6C9-FCCF557D9EB1', 2, N'promote', N'promote', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3CB0DA6E-EAE7-4B2F-9228-C9B9DB1C0A22', N'F1850061-8742-4CC6-A6C9-FCCF557D9EB1', 3, N'upload', N'upload', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'34425842-E27B-4BC1-B6A7-8920D4AE03BA', N'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C', 1, N'General', N'General', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'49D4845C-3432-48D8-8B53-760A7B468D7E', N'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C', 2, N'Private', N'Private', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D40C8FF6-EC0B-488A-9CC7-2464A132601D', N'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C', 3, N'Topic', N'Topic', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8B2F8EAB-1940-49C9-ACFE-A33B6DEF2571', N'D3FF7771-EEB6-46D1-A1CF-7D5977142EE1', 1, N'Active', N'Active', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'C2663101-D5A7-4570-BCFD-C03F6F7AA6FB', N'D3FF7771-EEB6-46D1-A1CF-7D5977142EE1', 2, N'Archived', N'Archived', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'838771A4-ED8B-4161-9A69-FEE13F1A9AD0', N'26914BFF-EE45-4659-825C-C8FC1871D1C1', 1, N'Shared', N'Shared', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E7B830BF-0340-4F0E-A839-DCC7E30B2460', N'26914BFF-EE45-4659-825C-C8FC1871D1C1', 2, N'Team', N'Team', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'202341D4-9094-4C1C-9527-855E9B40E3DE', N'B6D77525-17FC-45C7-8F09-832D53239799', 1, N'Action', N'Action', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B443309A-84AE-427E-AC8B-6206142FF490', N'B6D77525-17FC-45C7-8F09-832D53239799', 2, N'Agent', N'Agent', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D82DAB23-A5A7-49D1-A79B-B07BB943E215', N'B6D77525-17FC-45C7-8F09-832D53239799', 3, N'Component', N'Component', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6AC4D86E-6597-4CF8-8974-3298DCD21DFD', N'B6D77525-17FC-45C7-8F09-832D53239799', 4, N'Dashboard', N'Dashboard', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1DE03D24-7456-4F28-890C-B25221ED8E5D', N'B6D77525-17FC-45C7-8F09-832D53239799', 5, N'KnowledgeSource', N'KnowledgeSource', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'757236CF-1F09-47CB-976B-736DF03157A3', N'B6D77525-17FC-45C7-8F09-832D53239799', 6, N'Query', N'Query', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F21F075F-1DDB-4C87-8C4B-6016ED56255E', N'B6D77525-17FC-45C7-8F09-832D53239799', 7, N'View', N'View', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'73F66846-7CEE-43E3-98F9-B03DF7516D54', N'304AD3AB-BD76-42FE-AE49-F1EDCAE5B55C', 1, N'Extend', N'Extend', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7F501955-6A94-44F9-9B18-BBD91B67EBAA', N'304AD3AB-BD76-42FE-AE49-F1EDCAE5B55C', 2, N'Remove', N'Remove', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D1069379-1134-4120-B478-3E17F1CDDE26', N'D82E6F1A-36F5-4F28-BA68-BCED57F9E8B5', 1, N'Shared', N'Shared', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'89B90D19-E3E0-4796-905D-60B63371C474', N'D82E6F1A-36F5-4F28-BA68-BCED57F9E8B5', 2, N'Team', N'Team', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FFB095F7-0CA9-4866-9722-D5894510CAA5', N'12BE73D4-06F7-4830-B2CF-4A30F73B74C7', 1, N'Grant', N'Grant', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E64AB2CE-62E4-41A6-B7D8-D1D164F4CE7C', N'12BE73D4-06F7-4830-B2CF-4A30F73B74C7', 2, N'Record', N'Record', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'BE024823-010F-4513-851F-B25954B79067', N'17968F2E-12CB-4FFE-91A5-CAAD3446A8F6', 1, N'Shared', N'Shared', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'97F7F262-104A-4089-830E-5A56DA505751', N'17968F2E-12CB-4FFE-91A5-CAAD3446A8F6', 2, N'Team', N'Team', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DD2DCED3-D1E3-45AC-B4D8-7EAE7B4E28C7', N'0E14CF05-6787-4C37-88D8-25C8D644436C', 1, N'Active', N'Active', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'4F93C090-E122-4983-B84E-EF6AABDCEFD7', N'0E14CF05-6787-4C37-88D8-25C8D644436C', 2, N'Invited', N'Invited', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'46AB90E4-8034-4DAA-B4A2-D8CFAAFC0C2A', N'0E14CF05-6787-4C37-88D8-25C8D644436C', 3, N'Removed', N'Removed', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'19E0604E-7013-4157-BC7C-F0D7FA1684E1', N'AD6A55D3-8F26-4D9F-A277-3C8E92755BA9', 1, N'Shared', N'Shared', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A62336B0-CF07-4F19-9C1F-84DF920EA648', N'AD6A55D3-8F26-4D9F-A277-3C8E92755BA9', 2, N'Team', N'Team', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E2BE5CAA-D037-44CA-8223-AF7A10A06C22', N'8C2B6090-02C5-4C9E-BD3F-9CE0A99E25B9', 1, N'Private', N'Private', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3C6B9EB2-4193-495C-9A0A-08D718A1509D', N'8C2B6090-02C5-4C9E-BD3F-9CE0A99E25B9', 2, N'Space', N'Space', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'42CEAB23-C947-4112-9B4A-D7E70B45A591', N'A547E641-F873-405E-8B16-889981DFE331', 1, N'ExcludedEntirely', N'ExcludedEntirely', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A67D88AC-5B9A-4FFF-91C3-5A984BAB3040', N'A547E641-F873-405E-8B16-889981DFE331', 2, N'ExcludedFromParentScope', N'ExcludedFromParentScope', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A6D206E6-69F3-4D42-A420-B2EF35C7733E', N'A547E641-F873-405E-8B16-889981DFE331', 3, N'Included', N'Included', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'211465B8-9586-44B6-BF49-C70A1703D4ED', N'F8CEF3B6-E595-4B00-848A-0467C4DD4C49', 1, N'Shared', N'Shared', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'26E7B763-87FE-4C44-A45D-03A609B4582D', N'F8CEF3B6-E595-4B00-848A-0467C4DD4C49', 2, N'Team', N'Team', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'20BAD76A-ED31-4549-8A0C-F2CE6C7FCF23', N'7045CA4F-EF10-44C4-8F26-3A40537ADE62', 1, N'Hidden', N'Hidden', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'CF89F66A-1074-4F4D-91CD-036DD5C952C4', N'7045CA4F-EF10-44C4-8F26-3A40537ADE62', 2, N'Listed', N'Listed', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'903FF30B-3218-499F-9D98-E75626FA3426', N'7045CA4F-EF10-44C4-8F26-3A40537ADE62', 3, N'Open', N'Open', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A5058DD6-83A3-4AC1-8C45-57E91A75480F', N'1BC5FCAB-DB51-4294-B2A4-8BDEFE49A9A5', 1, N'Approve', N'Approve', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3724B52E-D4BB-4533-8B63-9B99F4E2570B', N'1BC5FCAB-DB51-4294-B2A4-8BDEFE49A9A5', 2, N'AutoApprove', N'AutoApprove', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'B1E149BA-553B-4AAE-9CDA-98C4E98927E3', N'4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D', 1, N'InviteOnly', N'InviteOnly', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'4D3CD44A-ADF4-4067-A777-9921A839D7D0', N'4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D', 2, N'RequestToJoin', N'RequestToJoin', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'0AE5193E-3223-40F5-A825-CD837AC68EA6', N'4C4411A3-6F7D-4E87-B1B9-3BDC84DA253D', 3, N'SelfServe', N'SelfServe', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'05ACCD79-D34A-44EE-AC5A-F2FAD89175FA', N'6ECC450C-640C-4F79-94D9-641AA433D358', 1, N'ExcludedEntirely', N'ExcludedEntirely', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'49D441F6-3828-44FF-B389-51933BFB7FA4', N'6ECC450C-640C-4F79-94D9-641AA433D358', 2, N'ExcludedFromParentScope', N'ExcludedFromParentScope', NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [Description], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DE02FFFD-5847-4641-A3B2-1312D6DEC043', N'6ECC450C-640C-4F79-94D9-641AA433D358', 3, N'Included', N'Included', NULL, GETUTCDATE(), GETUTCDATE());
-- [${mjSchema}].[EntityRelationship]: 33 row(s)
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8326EF38-089D-4BFC-B3F0-EDAF47BF74B8', N'AEB408D2-162A-49AE-9DC2-DBE9A21A3C01', 7, N'41165FEC-A52B-469A-A880-3B108C39A65E', 1, 0, N'One To Many         ', NULL, N'ArtifactVersionID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'EDC5AF66-EA3B-4F8E-BCE3-7AE2650EEE95', N'13248F34-2837-EF11-86D4-6045BDEE16E6', 10, N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 1, 0, N'One To Many         ', NULL, N'ConversationID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'79AFC009-BEFE-43BE-85C2-5D5B5B647DB6', N'E0238F34-2837-EF11-86D4-6045BDEE16E6', 86, N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 1, 0, N'One To Many         ', NULL, N'EntityID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'659406AD-E775-46CD-856F-C7B59F6C5443', N'E0238F34-2837-EF11-86D4-6045BDEE16E6', 88, N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 1, 0, N'One To Many         ', NULL, N'TargetEntityID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'782FF87D-1042-4A08-BEEF-85C9C19FA6B9', N'E0238F34-2837-EF11-86D4-6045BDEE16E6', 96, N'41165FEC-A52B-469A-A880-3B108C39A65E', 1, 0, N'One To Many         ', NULL, N'EntityID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DBBAD564-4C48-4F2E-AEE9-B002889C5F81', N'E0238F34-2837-EF11-86D4-6045BDEE16E6', 87, N'1DDE95B7-60B7-4A08-A886-57550B425C58', 1, 0, N'One To Many         ', NULL, N'TargetEntityID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'30AFA998-D738-4003-A04B-AD11520F4011', N'E1238F34-2837-EF11-86D4-6045BDEE16E6', 124, N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 1, 0, N'One To Many         ', NULL, N'UserID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'330D4906-CE10-453E-A9D6-AEECABA6D70F', N'E1238F34-2837-EF11-86D4-6045BDEE16E6', 125, N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 1, 0, N'One To Many         ', NULL, N'RecipientUserID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'ABBC54B5-939E-45FF-BD43-28B063E91168', N'E1238F34-2837-EF11-86D4-6045BDEE16E6', 121, N'41165FEC-A52B-469A-A880-3B108C39A65E', 1, 0, N'One To Many         ', NULL, N'PromotedByUserID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'05C9D60D-27AF-409E-9F73-CF609F548C68', N'E1238F34-2837-EF11-86D4-6045BDEE16E6', 117, N'1DDE95B7-60B7-4A08-A886-57550B425C58', 1, 0, N'One To Many         ', NULL, N'UserID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DE5BB078-299A-4B13-95E8-7A3CEAD6E0AA', N'E1238F34-2837-EF11-86D4-6045BDEE16E6', 123, N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 1, 0, N'One To Many         ', NULL, N'UserID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6F2E2E36-F1B1-4719-8C33-E1E35E2EC06D', N'E1238F34-2837-EF11-86D4-6045BDEE16E6', 118, N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 1, 0, N'One To Many         ', NULL, N'AuthorUserID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'35BD12E3-6E2F-48F3-B04D-FE69DE208311', N'E1238F34-2837-EF11-86D4-6045BDEE16E6', 122, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 1, 0, N'One To Many         ', NULL, N'OwnerID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'A20C2B6C-6803-4A14-9FD5-86AC05380A7F', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 1, N'1DDE95B7-60B7-4A08-A886-57550B425C58', 1, 0, N'One To Many         ', NULL, N'GrantID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E61FBB1A-C900-4D7E-83C7-31CC8C92F18F', N'41165FEC-A52B-469A-A880-3B108C39A65E', 1, N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 1, 0, N'One To Many         ', NULL, N'ItemID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6BB84812-9924-43F1-8670-CD1684673945', N'41165FEC-A52B-469A-A880-3B108C39A65E', 2, N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 1, 0, N'One To Many         ', NULL, N'ItemID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'EA35ECAA-DBAE-4AE6-9E55-2E3DF1D640CF', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 1, N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 1, 0, N'One To Many         ', NULL, N'SpaceRoleTypeID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FF1A837E-DDA9-4648-8E60-A432895D1D19', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 1, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 1, 0, N'One To Many         ', NULL, N'StatusID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'CA823ED3-22DB-41DE-85AF-16C4BCF7D49C', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 2, N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 1, 0, N'One To Many         ', NULL, N'SpaceTypeID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'80D1D4CF-91AB-4E9E-BBB7-A2E26FFBAA8A', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 4, N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 1, 0, N'One To Many         ', NULL, N'SpaceTypeID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'D38C78BC-0BE9-4263-8A8B-9147DC64A21B', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 3, N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', 1, 0, N'One To Many         ', NULL, N'SpaceTypeID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'9DA4261F-E0AA-47A5-8DBB-D89DE2FD939C', N'01596359-EC4B-449C-BA16-316DE4B92A4E', 1, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 1, 0, N'One To Many         ', NULL, N'SpaceTypeID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'2A138611-5A86-48BA-9D19-96E5B0CAE4FA', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 4, N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'81A26308-C7B8-4979-ADF2-F4218FE28DA2', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 5, N'AEC10B96-8D9E-485A-9AAF-968E3105B506', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7FBB5EB4-25FB-4156-9D3F-EAB125E98159', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 7, N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'F69018A9-DB96-4126-8B90-5FE2ADBAF5C1', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 8, N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'DBC6807A-C089-45D4-82EF-28221ACBB213', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 10, N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'319A7FBB-DCF5-4491-B08E-3EB9BEF3569B', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 1, N'41165FEC-A52B-469A-A880-3B108C39A65E', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'34DB92CD-E313-490C-86B5-798D71841766', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 8, N'1DDE95B7-60B7-4A08-A886-57550B425C58', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'9C37DBBA-D86F-4CE0-8C1C-AEC1D45B1AE7', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 3, N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1919C03B-E33C-4053-B110-AC6731F4C4F2', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 9, N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', 1, 0, N'One To Many         ', NULL, N'SpaceID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8D0B863F-7F69-4887-A692-93A66D9FB0B2', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 2, N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 1, 0, N'One To Many         ', NULL, N'ParentID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [Sequence], [RelatedEntityID], [BundleInAPI], [IncludeInParentAllQuery], [Type], [EntityKeyField], [RelatedEntityJoinField], [JoinView], [JoinEntityJoinField], [JoinEntityInverseJoinField], [DisplayInForm], [DisplayLocation], [DisplayName], [DisplayIconType], [DisplayIcon], [DisplayUserViewID], [DisplayComponentID], [DisplayComponentConfiguration], [AutoUpdateFromSchema], [AdditionalFieldsToInclude], [AutoUpdateAdditionalFieldsToInclude], [RelatedRecordCollection], [Configuration], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'20595A1F-F9B0-4BF5-B52C-5A07F19FC187', N'7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F', 44, N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 1, 0, N'One To Many         ', NULL, N'PersonID', NULL, NULL, NULL, 1, N'After Field Tabs', NULL, N'Related Entity Icon', NULL, NULL, NULL, NULL, 1, NULL, 1, NULL, NULL, GETUTCDATE(), GETUTCDATE());
-- [${mjSchema}].[EntityPermission]: 39 row(s)
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'84604E3E-F36B-1410-89A8-007AA2BDA0B9', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'89604E3E-F36B-1410-89A8-007AA2BDA0B9', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7F604E3E-F36B-1410-89A8-007AA2BDA0B9', N'30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'70604E3E-F36B-1410-89A8-007AA2BDA0B9', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'75604E3E-F36B-1410-89A8-007AA2BDA0B9', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6B604E3E-F36B-1410-89A8-007AA2BDA0B9', N'AEC10B96-8D9E-485A-9AAF-968E3105B506', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'51614E3E-F36B-1410-89A8-007AA2BDA0B9', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'55614E3E-F36B-1410-89A8-007AA2BDA0B9', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'4D614E3E-F36B-1410-89A8-007AA2BDA0B9', N'8B50058D-B5DC-4AE6-9990-17A5EB5B3A09', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8F604E3E-F36B-1410-89A8-007AA2BDA0B9', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'91604E3E-F36B-1410-89A8-007AA2BDA0B9', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'8D604E3E-F36B-1410-89A8-007AA2BDA0B9', N'75E3ED25-C46B-45C1-96F7-91578D88DBE2', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'61614E3E-F36B-1410-89A8-007AA2BDA0B9', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'65614E3E-F36B-1410-89A8-007AA2BDA0B9', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'5D614E3E-F36B-1410-89A8-007AA2BDA0B9', N'A7873DEB-9B74-4E27-A95F-D84CA74F7B75', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3B604E3E-F36B-1410-89A8-007AA2BDA0B9', N'41165FEC-A52B-469A-A880-3B108C39A65E', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'42604E3E-F36B-1410-89A8-007AA2BDA0B9', N'41165FEC-A52B-469A-A880-3B108C39A65E', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'34604E3E-F36B-1410-89A8-007AA2BDA0B9', N'41165FEC-A52B-469A-A880-3B108C39A65E', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'81614E3E-F36B-1410-89A8-007AA2BDA0B9', N'1DDE95B7-60B7-4A08-A886-57550B425C58', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'85614E3E-F36B-1410-89A8-007AA2BDA0B9', N'1DDE95B7-60B7-4A08-A886-57550B425C58', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'7D614E3E-F36B-1410-89A8-007AA2BDA0B9', N'1DDE95B7-60B7-4A08-A886-57550B425C58', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'57604E3E-F36B-1410-89A8-007AA2BDA0B9', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'5E604E3E-F36B-1410-89A8-007AA2BDA0B9', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'50604E3E-F36B-1410-89A8-007AA2BDA0B9', N'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'71614E3E-F36B-1410-89A8-007AA2BDA0B9', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'75614E3E-F36B-1410-89A8-007AA2BDA0B9', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'6D614E3E-F36B-1410-89A8-007AA2BDA0B9', N'CB59DEA7-2155-4A33-B836-ADF2B268D2E9', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'03604E3E-F36B-1410-89A8-007AA2BDA0B9', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'0A604E3E-F36B-1410-89A8-007AA2BDA0B9', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'FC5F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'41614E3E-F36B-1410-89A8-007AA2BDA0B9', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'45614E3E-F36B-1410-89A8-007AA2BDA0B9', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'3D614E3E-F36B-1410-89A8-007AA2BDA0B9', N'106DF2B5-DF08-48EE-A0E1-26C329DC0343', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E75F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'01596359-EC4B-449C-BA16-316DE4B92A4E', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'EE5F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'01596359-EC4B-449C-BA16-316DE4B92A4E', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'E05F4E3E-F36B-1410-89A8-007AA2BDA0B9', N'01596359-EC4B-449C-BA16-316DE4B92A4E', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'1F604E3E-F36B-1410-89A8-007AA2BDA0B9', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'26604E3E-F36B-1410-89A8-007AA2BDA0B9', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1, 1, 1, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
INSERT INTO [${mjSchema}].[EntityPermission] ([ID], [EntityID], [RoleID], [CanCreate], [CanRead], [CanUpdate], [CanDelete], [ReadRLSFilterID], [CreateRLSFilterID], [UpdateRLSFilterID], [DeleteRLSFilterID], [Type], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES (N'18604E3E-F36B-1410-89A8-007AA2BDA0B9', N'3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', N'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 0, 1, 0, 0, NULL, NULL, NULL, NULL, N'Allow', GETUTCDATE(), GETUTCDATE());
GO
-- End of baseline.
GO
