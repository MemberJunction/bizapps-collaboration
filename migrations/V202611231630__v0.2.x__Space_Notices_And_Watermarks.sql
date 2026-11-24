-- =============================================================================
-- Migration: V202611231630__v0.2.x__Space_Notices_And_Watermarks.sql
-- Sub-Epic S10 (Slice 1): Additive dual-dialect schema foundation for:
--   1. SpaceNoticeEvent      (CS-4 O(1) fan-out-on-read space notice events)
--   2. SpaceNoticeWatermark  (CS-4 per-member monotonic composite read watermarks)
--   3. SpaceDigestCheckpoint (NT-2 deterministic keyset digest cursor checkpoints)
-- =============================================================================

-- 1. Create SpaceNoticeEvent table (1 row per space event, O(1) write amplification)
CREATE TABLE [${flyway:defaultSchema}].[SpaceNoticeEvent] (
    [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_SpaceNoticeEvent_ID] DEFAULT (newsequentialid()),
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [ActorUserID] UNIQUEIDENTIFIER NULL,
    [EventKind] NVARCHAR(50) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Band] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL CONSTRAINT [DF_SpaceNoticeEvent_Band] DEFAULT (N'Shared'),
    [Title] NVARCHAR(500) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [Body] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [TargetEntityID] UNIQUEIDENTIFIER NULL,
    [TargetRecordID] NVARCHAR(450) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [MetadataJSON] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [EventTimestamp] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF_SpaceNoticeEvent_EventTimestamp] DEFAULT (getutcdate()),
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceNoticeEvent___mj_CreatedAt] DEFAULT (getutcdate()),
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceNoticeEvent___mj_UpdatedAt] DEFAULT (getutcdate()),
    CONSTRAINT [PK_SpaceNoticeEvent] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [FK_SpaceNoticeEvent_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]),
    CONSTRAINT [FK_SpaceNoticeEvent_ActorUser] FOREIGN KEY ([ActorUserID]) REFERENCES [${mjSchema}].[User] ([ID]),
    CONSTRAINT [FK_SpaceNoticeEvent_TargetEntity] FOREIGN KEY ([TargetEntityID]) REFERENCES [${mjSchema}].[Entity] ([ID]),
    CONSTRAINT [CK_SpaceNoticeEvent_EventKind] CHECK (
        [EventKind] = N'Share'
        OR [EventKind] = N'StatusChanged'
        OR [EventKind] = N'Mention'
        OR [EventKind] = N'Reply'
        OR [EventKind] = N'Task'
        OR [EventKind] = N'Approval'
        OR [EventKind] = N'Announcement'
        OR [EventKind] = N'System'
    ),
    CONSTRAINT [CK_SpaceNoticeEvent_Band] CHECK ([Band] = N'Shared' OR [Band] = N'Team')
);
GO

CREATE NONCLUSTERED INDEX [IX_SpaceNoticeEvent_Space_EventTimestamp_ID]
    ON [${flyway:defaultSchema}].[SpaceNoticeEvent] ([SpaceID], [EventTimestamp], [ID]);
GO

CREATE NONCLUSTERED INDEX [IX_SpaceNoticeEvent_Space_Band_EventTimestamp_ID]
    ON [${flyway:defaultSchema}].[SpaceNoticeEvent] ([SpaceID], [Band], [EventTimestamp], [ID]);
GO

CREATE NONCLUSTERED INDEX [IX_SpaceNoticeEvent_EventTimestamp_ID]
    ON [${flyway:defaultSchema}].[SpaceNoticeEvent] ([EventTimestamp], [ID]);
GO

-- 2. Create SpaceNoticeWatermark table (per-member monotonic read cursor per space)
CREATE TABLE [${flyway:defaultSchema}].[SpaceNoticeWatermark] (
    [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_SpaceNoticeWatermark_ID] DEFAULT (newsequentialid()),
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [UserID] UNIQUEIDENTIFIER NOT NULL,
    [LastReadEventTimestamp] DATETIMEOFFSET(7) NOT NULL,
    [LastReadEventID] UNIQUEIDENTIFIER NULL,
    [LastReadAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF_SpaceNoticeWatermark_LastReadAt] DEFAULT (getutcdate()),
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceNoticeWatermark___mj_CreatedAt] DEFAULT (getutcdate()),
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceNoticeWatermark___mj_UpdatedAt] DEFAULT (getutcdate()),
    CONSTRAINT [PK_SpaceNoticeWatermark] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [FK_SpaceNoticeWatermark_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]),
    CONSTRAINT [FK_SpaceNoticeWatermark_User] FOREIGN KEY ([UserID]) REFERENCES [${mjSchema}].[User] ([ID]),
    CONSTRAINT [UQ_SpaceNoticeWatermark_Space_User] UNIQUE NONCLUSTERED ([SpaceID], [UserID])
);
GO

CREATE NONCLUSTERED INDEX [IX_SpaceNoticeWatermark_User_Space]
    ON [${flyway:defaultSchema}].[SpaceNoticeWatermark] ([UserID], [SpaceID]);
GO

-- 3. Create SpaceDigestCheckpoint table (deterministic keyset checkpoint for scheduled digests)
CREATE TABLE [${flyway:defaultSchema}].[SpaceDigestCheckpoint] (
    [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_SpaceDigestCheckpoint_ID] DEFAULT (newsequentialid()),
    [UserID] UNIQUEIDENTIFIER NOT NULL,
    [SpaceID] UNIQUEIDENTIFIER NULL,
    [Cadence] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL CONSTRAINT [DF_SpaceDigestCheckpoint_Cadence] DEFAULT (N'Daily'),
    [LastDeliveredTimestamp] DATETIMEOFFSET(7) NOT NULL,
    [LastDeliveredRecordID] UNIQUEIDENTIFIER NULL,
    [LastDeliveredAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF_SpaceDigestCheckpoint_LastDeliveredAt] DEFAULT (getutcdate()),
    [ItemsIncludedCount] INT NOT NULL CONSTRAINT [DF_SpaceDigestCheckpoint_ItemsIncludedCount] DEFAULT ((0)),
    [Status] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL CONSTRAINT [DF_SpaceDigestCheckpoint_Status] DEFAULT (N'Active'),
    [__mj_CreatedAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceDigestCheckpoint___mj_CreatedAt] DEFAULT (getutcdate()),
    [__mj_UpdatedAt] DATETIMEOFFSET(7) NOT NULL CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceDigestCheckpoint___mj_UpdatedAt] DEFAULT (getutcdate()),
    CONSTRAINT [PK_SpaceDigestCheckpoint] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [FK_SpaceDigestCheckpoint_User] FOREIGN KEY ([UserID]) REFERENCES [${mjSchema}].[User] ([ID]),
    CONSTRAINT [FK_SpaceDigestCheckpoint_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]),
    CONSTRAINT [CK_SpaceDigestCheckpoint_Cadence] CHECK (
        [Cadence] = N'Daily'
        OR [Cadence] = N'Weekly'
        OR [Cadence] = N'Immediate'
        OR [Cadence] = N'Custom'
    ),
    CONSTRAINT [CK_SpaceDigestCheckpoint_ItemsIncludedCount] CHECK ([ItemsIncludedCount] >= (0)),
    CONSTRAINT [CK_SpaceDigestCheckpoint_Status] CHECK ([Status] = N'Active' OR [Status] = N'Paused')
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceDigestCheckpoint_User_Global_Cadence]
    ON [${flyway:defaultSchema}].[SpaceDigestCheckpoint] ([UserID], [Cadence])
    WHERE ([SpaceID] IS NULL);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceDigestCheckpoint_User_Space_Cadence]
    ON [${flyway:defaultSchema}].[SpaceDigestCheckpoint] ([UserID], [SpaceID], [Cadence])
    WHERE ([SpaceID] IS NOT NULL);
GO

-- 4. Extended properties for tables and columns
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Fan-out-on-read space notice event stream. Publishing an event writes a single row per space event rather than per-member inbox copies.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space in which the notice event occurred.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The acting user who triggered the event, or NULL for system-generated events.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'ActorUserID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Event category: Share, StatusChanged, Mention, Reply, Task, Approval, Announcement, or System.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'EventKind';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Visibility band (Shared or Team) governing which space members may read this notice event.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'Band';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Short domain-neutral notice headline.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'Title';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional detailed notice summary text.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'Body';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional target MJ Entity ID for deep-linking to the underlying record (polymorphic pair with TargetRecordID).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'TargetEntityID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional canonical target record key (e.g. ID|<uuid>) paired with TargetEntityID.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'TargetRecordID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional structured JSON payload carrying additional event context.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'MetadataJSON';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'UTC timestamp at which the notice event occurred, used with ID as the deterministic composite keyset cursor.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeEvent', @level2type = N'COLUMN', @level2name = N'EventTimestamp';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Per-member read watermark per space enabling O(1) fan-out-on-read unread resolution.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeWatermark';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space this read watermark applies to.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeWatermark', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The member whose read watermark is tracked.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeWatermark', @level2type = N'COLUMN', @level2name = N'UserID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Timestamp component of the member''s monotonic composite read watermark (LastReadEventTimestamp, LastReadEventID).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeWatermark', @level2type = N'COLUMN', @level2name = N'LastReadEventTimestamp';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Tie-breaker SpaceNoticeEvent ID component of the member''s monotonic composite read watermark.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeWatermark', @level2type = N'COLUMN', @level2name = N'LastReadEventID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'UTC timestamp when the member last advanced this watermark.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceNoticeWatermark', @level2type = N'COLUMN', @level2name = N'LastReadAt';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Keyset cursor checkpoint per recipient and cadence for scheduled scoped digest delivery.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The digest recipient user.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint', @level2type = N'COLUMN', @level2name = N'UserID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Optional specific space scope for the digest checkpoint, or NULL for a cross-space digest.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Digest cadence: Daily, Weekly, Immediate, or Custom.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint', @level2type = N'COLUMN', @level2name = N'Cadence';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Timestamp component of the last delivered digest composite keyset cursor.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint', @level2type = N'COLUMN', @level2name = N'LastDeliveredTimestamp';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Tie-breaker record ID component of the last delivered digest composite keyset cursor.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint', @level2type = N'COLUMN', @level2name = N'LastDeliveredRecordID';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'UTC timestamp when the last digest delivery completed.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint', @level2type = N'COLUMN', @level2name = N'LastDeliveredAt';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Number of reach-verified items included in the last delivered digest.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint', @level2type = N'COLUMN', @level2name = N'ItemsIncludedCount';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Checkpoint status: Active or Paused.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpaceDigestCheckpoint', @level2type = N'COLUMN', @level2name = N'Status';
GO

-- 5. CodeGen boundary























































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Notice Events */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[Entity] WHERE [ID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' OR ([SchemaName] = '${flyway:defaultSchema}' AND [BaseTable] = 'SpaceNoticeEvent'))
BEGIN
    INSERT INTO [${mjSchema}].[Entity] (
        [ID], [Name], [DisplayName], [Description], [NameSuffix], [BaseTable], [BaseView], [SchemaName],
        [IncludeInAPI], [AllowUserSearchAPI], [AllowCaching], [TrackRecordChanges], [AuditRecordAccess],
        [AuditViewRuns], [AllowAllRowsAPI], [AllowCreateAPI], [AllowUpdateAPI], [AllowDeleteAPI],
        [UserViewMaxRows], [__mj_CreatedAt], [__mj_UpdatedAt]
    )
    VALUES (
        'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51',
        'MJ_BizApps_Collaboration: Space Notice Events',
        'Space Notice Events',
        'Fan-out-on-read space notice event stream. Publishing an event writes a single row per space event rather than per-member inbox copies.',
        NULL, 'SpaceNoticeEvent', 'vwSpaceNoticeEvents', '${flyway:defaultSchema}',
        1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1000, GETUTCDATE(), GETUTCDATE()
    );
END;

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Notice Watermarks */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[Entity] WHERE [ID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' OR ([SchemaName] = '${flyway:defaultSchema}' AND [BaseTable] = 'SpaceNoticeWatermark'))
BEGIN
    INSERT INTO [${mjSchema}].[Entity] (
        [ID], [Name], [DisplayName], [Description], [NameSuffix], [BaseTable], [BaseView], [SchemaName],
        [IncludeInAPI], [AllowUserSearchAPI], [AllowCaching], [TrackRecordChanges], [AuditRecordAccess],
        [AuditViewRuns], [AllowAllRowsAPI], [AllowCreateAPI], [AllowUpdateAPI], [AllowDeleteAPI],
        [UserViewMaxRows], [__mj_CreatedAt], [__mj_UpdatedAt]
    )
    VALUES (
        'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52',
        'MJ_BizApps_Collaboration: Space Notice Watermarks',
        'Space Notice Watermarks',
        'Per-member read watermark per space enabling O(1) fan-out-on-read unread resolution.',
        NULL, 'SpaceNoticeWatermark', 'vwSpaceNoticeWatermarks', '${flyway:defaultSchema}',
        1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1000, GETUTCDATE(), GETUTCDATE()
    );
END;

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Digest Checkpoints */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[Entity] WHERE [ID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' OR ([SchemaName] = '${flyway:defaultSchema}' AND [BaseTable] = 'SpaceDigestCheckpoint'))
BEGIN
    INSERT INTO [${mjSchema}].[Entity] (
        [ID], [Name], [DisplayName], [Description], [NameSuffix], [BaseTable], [BaseView], [SchemaName],
        [IncludeInAPI], [AllowUserSearchAPI], [AllowCaching], [TrackRecordChanges], [AuditRecordAccess],
        [AuditViewRuns], [AllowAllRowsAPI], [AllowCreateAPI], [AllowUpdateAPI], [AllowDeleteAPI],
        [UserViewMaxRows], [__mj_CreatedAt], [__mj_UpdatedAt]
    )
    VALUES (
        'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53',
        'MJ_BizApps_Collaboration: Space Digest Checkpoints',
        'Space Digest Checkpoints',
        'Keyset cursor checkpoint per recipient and cadence for scheduled scoped digest delivery.',
        NULL, 'SpaceDigestCheckpoint', 'vwSpaceDigestCheckpoints', '${flyway:defaultSchema}',
        1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1000, GETUTCDATE(), GETUTCDATE()
    );
END;

/* Add entities to Collaboration application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' AND [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51')
    INSERT INTO [${mjSchema}].[ApplicationEntity] ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' AND [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52')
    INSERT INTO [${mjSchema}].[ApplicationEntity] ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' AND [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53')
    INSERT INTO [${mjSchema}].[ApplicationEntity] ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* EntityPermissions for UI (read-only; RLS attached via metadata), Developer, and Integration */
INSERT INTO [${mjSchema}].[EntityPermission] ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT e.[ID], r.[RoleID], 'Allow', 1, r.[CanWrite], r.[CanWrite], r.[CanWrite], GETUTCDATE(), GETUTCDATE()
FROM (VALUES
    (CAST('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AS uniqueidentifier)),
    (CAST('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AS uniqueidentifier)),
    (CAST('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AS uniqueidentifier))
) AS e([ID])
CROSS JOIN (VALUES
    (CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 0),
    (CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 1),
    (CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 1)
) AS r([RoleID], [CanWrite])
WHERE NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission] AS ep
    WHERE ep.[EntityID] = e.[ID] AND ep.[RoleID] = r.[RoleID] AND ep.[Type] = 'Allow'
);

EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* EntityFields for SpaceNoticeEvent */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10001-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'ID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10001-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'ID', 'ID', NULL, 'uniqueidentifier', 16, 0, 0, 0, 'newsequentialid()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 1, 1, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10002-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'SpaceID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10002-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'SpaceID', 'Space ID', 'The space in which the notice event occurred.', 'uniqueidentifier', 16, 0, 0, 0, NULL, 0, 1, 0, 0, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'ID', 0, 0, 1, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10003-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'ActorUserID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10003-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'ActorUserID', 'Actor User ID', 'The acting user who triggered the event, or NULL for system-generated events.', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'ID', 0, 0, 1, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'EventKind'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'EventKind', 'Event Kind', 'Event category: Share, StatusChanged, Mention, Reply, Task, Approval, Announcement, or System.', 'nvarchar', 100, 0, 0, 0, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'Band'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'Band', 'Band', 'Visibility band (Shared or Team) governing which space members may read this notice event.', 'nvarchar', 40, 0, 0, 0, 'Shared', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10006-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'Title'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10006-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'Title', 'Title', 'Short domain-neutral notice headline.', 'nvarchar', 1000, 0, 0, 0, NULL, 0, 1, 0, 0, NULL, NULL, 1, 1, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10007-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'Body'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10007-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'Body', 'Body', 'Optional detailed notice summary text.', 'nvarchar', -1, 0, 0, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10008-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'TargetEntityID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10008-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'TargetEntityID', 'Target Entity ID', 'Optional target MJ Entity ID for deep-linking to the underlying record (polymorphic pair with TargetRecordID).', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'ID', 0, 0, 1, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10009-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'TargetRecordID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10009-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'TargetRecordID', 'Target Record ID', 'Optional canonical target record key (e.g. ID|<uuid>) paired with TargetEntityID.', 'nvarchar', 900, 0, 0, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10010-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'MetadataJSON'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10010-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'MetadataJSON', 'Metadata JSON', 'Optional structured JSON payload carrying additional event context.', 'nvarchar', -1, 0, 0, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10011-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'EventTimestamp'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10011-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'EventTimestamp', 'Event Timestamp', 'UTC timestamp at which the notice event occurred, used with ID as the deterministic composite keyset cursor.', 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10012-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = '__mj_CreatedAt'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10012-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), '__mj_CreatedAt', 'Created At', NULL, 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10013-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = '__mj_UpdatedAt'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10013-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), '__mj_UpdatedAt', 'Updated At', NULL, 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10014-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'Space'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10014-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'Space', 'Space', NULL, 'nvarchar', 400, 0, 0, 0, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10015-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'ActorUser'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10015-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'ActorUser', 'Actor User', NULL, 'nvarchar', 200, 0, 0, 1, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a10016-4f50-4a6b-8c9d-0e1f2a3b4c51' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND Name = 'TargetEntity'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a10016-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'), 'TargetEntity', 'Target Entity', NULL, 'nvarchar', 510, 0, 0, 1, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

/* EntityFields for SpaceNoticeWatermark */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20001-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = 'ID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20001-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), 'ID', 'ID', NULL, 'uniqueidentifier', 16, 0, 0, 0, 'newsequentialid()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 1, 1, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20002-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = 'SpaceID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20002-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), 'SpaceID', 'Space ID', 'The space this read watermark applies to.', 'uniqueidentifier', 16, 0, 0, 0, NULL, 0, 1, 0, 0, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'ID', 0, 0, 1, 0, 0, 1, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20003-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = 'UserID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20003-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), 'UserID', 'User ID', 'The member whose read watermark is tracked.', 'uniqueidentifier', 16, 0, 0, 0, NULL, 0, 1, 0, 0, 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'ID', 0, 0, 1, 0, 0, 1, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20004-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = 'LastReadEventTimestamp'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20004-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), 'LastReadEventTimestamp', 'Last Read Event Timestamp', 'Timestamp component of the member''s monotonic composite read watermark (LastReadEventTimestamp, LastReadEventID).', 'datetimeoffset', 10, 34, 7, 0, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20005-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = 'LastReadEventID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20005-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), 'LastReadEventID', 'Last Read Event ID', 'Tie-breaker SpaceNoticeEvent ID component of the member''s monotonic composite read watermark.', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20006-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = 'LastReadAt'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20006-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), 'LastReadAt', 'Last Read At', 'UTC timestamp when the member last advanced this watermark.', 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20007-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = '__mj_CreatedAt'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20007-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), '__mj_CreatedAt', 'Created At', NULL, 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20008-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = '__mj_UpdatedAt'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20008-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), '__mj_UpdatedAt', 'Updated At', NULL, 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20009-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = 'Space'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20009-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), 'Space', 'Space', NULL, 'nvarchar', 400, 0, 0, 0, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a20010-4f50-4a6b-8c9d-0e1f2a3b4c52' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND Name = 'User'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a20010-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'), 'User', 'User', NULL, 'nvarchar', 200, 0, 0, 0, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

/* EntityFields for SpaceDigestCheckpoint */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30001-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'ID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30001-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'ID', 'ID', NULL, 'uniqueidentifier', 16, 0, 0, 0, 'newsequentialid()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 1, 1, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30002-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'UserID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30002-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'UserID', 'User ID', 'The digest recipient user.', 'uniqueidentifier', 16, 0, 0, 0, NULL, 0, 1, 0, 0, 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'ID', 0, 0, 1, 0, 0, 1, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30003-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'SpaceID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30003-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'SpaceID', 'Space ID', 'Optional specific space scope for the digest checkpoint, or NULL for a cross-space digest.', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'ID', 0, 0, 1, 0, 0, 1, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'Cadence'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'Cadence', 'Cadence', 'Digest cadence: Daily, Weekly, Immediate, or Custom.', 'nvarchar', 40, 0, 0, 0, 'Daily', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 1, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30005-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'LastDeliveredTimestamp'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30005-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'LastDeliveredTimestamp', 'Last Delivered Timestamp', 'Timestamp component of the last delivered digest composite keyset cursor.', 'datetimeoffset', 10, 34, 7, 0, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30006-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'LastDeliveredRecordID'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30006-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'LastDeliveredRecordID', 'Last Delivered Record ID', 'Tie-breaker record ID component of the last delivered digest composite keyset cursor.', 'uniqueidentifier', 16, 0, 0, 1, NULL, 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30007-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'LastDeliveredAt'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30007-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'LastDeliveredAt', 'Last Delivered At', 'UTC timestamp when the last digest delivery completed.', 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30008-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'ItemsIncludedCount'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30008-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'ItemsIncludedCount', 'Items Included Count', 'Number of reach-verified items included in the last delivered digest.', 'int', 4, 10, 0, 0, '((0))', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'Status'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'Status', 'Status', 'Checkpoint status: Active or Paused.', 'nvarchar', 40, 0, 0, 0, 'Active', 0, 1, 0, 0, NULL, NULL, 0, 0, 0, 1, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30010-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = '__mj_CreatedAt'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30010-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), '__mj_CreatedAt', 'Created At', NULL, 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30011-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = '__mj_UpdatedAt'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30011-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), '__mj_UpdatedAt', 'Updated At', NULL, 'datetimeoffset', 10, 34, 7, 0, 'getutcdate()', 0, 0, 0, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30012-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'User'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30012-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'User', 'User', NULL, 'nvarchar', 200, 0, 0, 0, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e8a30013-4f50-4a6b-8c9d-0e1f2a3b4c53' OR (EntityID = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND Name = 'Space'))
    INSERT INTO [${mjSchema}].[EntityField] ([ID], [EntityID], [Sequence], [Name], [DisplayName], [Description], [Type], [Length], [Precision], [Scale], [AllowsNull], [DefaultValue], [AutoIncrement], [AllowUpdateAPI], [IsVirtual], [IsComputed], [RelatedEntityID], [RelatedEntityFieldName], [IsNameField], [IncludeInUserSearchAPI], [IncludeRelatedEntityNameFieldInBaseView], [DefaultInView], [IsPrimaryKey], [IsUnique], [RelatedEntityDisplayType], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8a30013-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'), 'Space', 'Space', NULL, 'nvarchar', 400, 0, 0, 1, NULL, 0, 0, 1, 0, NULL, NULL, 0, 0, 0, 0, 0, 0, 'Search', GETUTCDATE(), GETUTCDATE());

EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Value list entries */
INSERT INTO [${mjSchema}].[EntityFieldValue] ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
SELECT v.[ID], v.[EntityFieldID], v.[Sequence], v.[Value], v.[Code], GETUTCDATE(), GETUTCDATE()
FROM (VALUES
    (CAST('f9e10001-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 1, 'Share', 'Share'),
    (CAST('f9e10002-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 2, 'StatusChanged', 'StatusChanged'),
    (CAST('f9e10003-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 3, 'Mention', 'Mention'),
    (CAST('f9e10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 4, 'Reply', 'Reply'),
    (CAST('f9e10005-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 5, 'Task', 'Task'),
    (CAST('f9e10006-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 6, 'Approval', 'Approval'),
    (CAST('f9e10007-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 7, 'Announcement', 'Announcement'),
    (CAST('f9e10008-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 8, 'System', 'System'),
    (CAST('f9e10009-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 1, 'Shared', 'Shared'),
    (CAST('f9e10010-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), CAST('e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51' AS uniqueidentifier), 2, 'Team', 'Team'),
    (CAST('f9e30001-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), CAST('e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), 1, 'Daily', 'Daily'),
    (CAST('f9e30002-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), CAST('e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), 2, 'Weekly', 'Weekly'),
    (CAST('f9e30003-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), CAST('e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), 3, 'Immediate', 'Immediate'),
    (CAST('f9e30004-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), CAST('e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), 4, 'Custom', 'Custom'),
    (CAST('f9e30005-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), CAST('e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), 1, 'Active', 'Active'),
    (CAST('f9e30006-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), CAST('e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53' AS uniqueidentifier), 2, 'Paused', 'Paused')
) AS v([ID], [EntityFieldID], [Sequence], [Value], [Code])
WHERE NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityFieldValue] AS efv WHERE efv.[ID] = v.[ID]);

UPDATE [${mjSchema}].[EntityField] SET [ValueListType] = 'List'
WHERE [ID] IN (
    'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51',
    'e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51',
    'e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53',
    'e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53'
);

/* Entity Relationships */
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e8d10001-4f50-4a6b-8c9d-0e1f2a3b4c51' OR ([EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND [RelatedEntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND [RelatedEntityJoinField] = 'SpaceID'))
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8d10001-4f50-4a6b-8c9d-0e1f2a3b4c51', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', 'SpaceID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'), GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e8d10002-4f50-4a6b-8c9d-0e1f2a3b4c51' OR ([EntityID] = 'E1238F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' AND [RelatedEntityJoinField] = 'ActorUserID'))
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8d10002-4f50-4a6b-8c9d-0e1f2a3b4c51', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', 'ActorUserID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = 'E1238F34-2837-EF11-86D4-6045BDEE16E6'), GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e8d20001-4f50-4a6b-8c9d-0e1f2a3b4c52' OR ([EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND [RelatedEntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND [RelatedEntityJoinField] = 'SpaceID'))
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8d20001-4f50-4a6b-8c9d-0e1f2a3b4c52', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', 'SpaceID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'), GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e8d20002-4f50-4a6b-8c9d-0e1f2a3b4c52' OR ([EntityID] = 'E1238F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' AND [RelatedEntityJoinField] = 'UserID'))
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8d20002-4f50-4a6b-8c9d-0e1f2a3b4c52', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', 'UserID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = 'E1238F34-2837-EF11-86D4-6045BDEE16E6'), GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e8d30001-4f50-4a6b-8c9d-0e1f2a3b4c53' OR ([EntityID] = 'E1238F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND [RelatedEntityJoinField] = 'UserID'))
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8d30001-4f50-4a6b-8c9d-0e1f2a3b4c53', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', 'UserID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = 'E1238F34-2837-EF11-86D4-6045BDEE16E6'), GETUTCDATE(), GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e8d30002-4f50-4a6b-8c9d-0e1f2a3b4c53' OR ([EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND [RelatedEntityID] = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' AND [RelatedEntityJoinField] = 'SpaceID'))
    INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
    VALUES ('e8d30002-4f50-4a6b-8c9d-0e1f2a3b4c53', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', 'SpaceID', 'One To Many', 1, 1, (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'), GETUTCDATE(), GETUTCDATE());

EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Foreign key indexes */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_SpaceID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceNoticeEvent]'))
    CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_SpaceID ON [${flyway:defaultSchema}].[SpaceNoticeEvent] ([SpaceID]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_ActorUserID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceNoticeEvent]'))
    CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_ActorUserID ON [${flyway:defaultSchema}].[SpaceNoticeEvent] ([ActorUserID]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_TargetEntityID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceNoticeEvent]'))
    CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_TargetEntityID ON [${flyway:defaultSchema}].[SpaceNoticeEvent] ([TargetEntityID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceNoticeWatermark_SpaceID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceNoticeWatermark]'))
    CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceNoticeWatermark_SpaceID ON [${flyway:defaultSchema}].[SpaceNoticeWatermark] ([SpaceID]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceNoticeWatermark_UserID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceNoticeWatermark]'))
    CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceNoticeWatermark_UserID ON [${flyway:defaultSchema}].[SpaceNoticeWatermark] ([UserID]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceDigestCheckpoint_UserID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceDigestCheckpoint]'))
    CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceDigestCheckpoint_UserID ON [${flyway:defaultSchema}].[SpaceDigestCheckpoint] ([UserID]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceDigestCheckpoint_SpaceID' AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceDigestCheckpoint]'))
    CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceDigestCheckpoint_SpaceID ON [${flyway:defaultSchema}].[SpaceDigestCheckpoint] ([SpaceID]);

/* Update related entity name field maps */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='e8a10002-4f50-4a6b-8c9d-0e1f2a3b4c51', @RelatedEntityNameFieldMap='Space';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='e8a10003-4f50-4a6b-8c9d-0e1f2a3b4c51', @RelatedEntityNameFieldMap='ActorUser';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='e8a10008-4f50-4a6b-8c9d-0e1f2a3b4c51', @RelatedEntityNameFieldMap='TargetEntity';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='e8a20002-4f50-4a6b-8c9d-0e1f2a3b4c52', @RelatedEntityNameFieldMap='Space';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='e8a20003-4f50-4a6b-8c9d-0e1f2a3b4c52', @RelatedEntityNameFieldMap='User';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='e8a30002-4f50-4a6b-8c9d-0e1f2a3b4c53', @RelatedEntityNameFieldMap='User';
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='e8a30003-4f50-4a6b-8c9d-0e1f2a3b4c53', @RelatedEntityNameFieldMap='Space';

/* Base View SQL for SpaceNoticeEvent */
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceNoticeEvents]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceNoticeEvents];
GO
CREATE VIEW [${flyway:defaultSchema}].[vwSpaceNoticeEvents]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_ActorUserID.[Name] AS [ActorUser],
    MJEntity_TargetEntityID.[Name] AS [TargetEntity]
FROM
    [${flyway:defaultSchema}].[SpaceNoticeEvent] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_ActorUserID
  ON [s].[ActorUserID] = MJUser_ActorUserID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Entity] AS MJEntity_TargetEntityID
  ON [s].[TargetEntityID] = MJEntity_TargetEntityID.[ID];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceNoticeEvents] TO [cdp_UI], [cdp_Developer], [cdp_Integration];
GO

/* spCreate, spUpdate, Trigger, spDelete for SpaceNoticeEvent */
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceNoticeEvent]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceNoticeEvent];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceNoticeEvent]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @ActorUserID_Clear bit = 0,
    @ActorUserID uniqueidentifier = NULL,
    @EventKind nvarchar(50),
    @Band nvarchar(20) = NULL,
    @Title nvarchar(500),
    @Body_Clear bit = 0,
    @Body nvarchar(MAX) = NULL,
    @TargetEntityID_Clear bit = 0,
    @TargetEntityID uniqueidentifier = NULL,
    @TargetRecordID_Clear bit = 0,
    @TargetRecordID nvarchar(450) = NULL,
    @MetadataJSON_Clear bit = 0,
    @MetadataJSON nvarchar(MAX) = NULL,
    @EventTimestamp datetimeoffset(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER);
    IF @ID IS NOT NULL
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[SpaceNoticeEvent] (
            [ID], [SpaceID], [ActorUserID], [EventKind], [Band], [Title], [Body],
            [TargetEntityID], [TargetRecordID], [MetadataJSON], [EventTimestamp]
        )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES (
            @ID, @SpaceID,
            CASE WHEN @ActorUserID_Clear = 1 THEN NULL ELSE @ActorUserID END,
            @EventKind, ISNULL(@Band, N'Shared'), @Title,
            CASE WHEN @Body_Clear = 1 THEN NULL ELSE @Body END,
            CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE @TargetEntityID END,
            CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE @TargetRecordID END,
            CASE WHEN @MetadataJSON_Clear = 1 THEN NULL ELSE @MetadataJSON END,
            ISNULL(@EventTimestamp, GETUTCDATE())
        );
    END
    ELSE
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[SpaceNoticeEvent] (
            [SpaceID], [ActorUserID], [EventKind], [Band], [Title], [Body],
            [TargetEntityID], [TargetRecordID], [MetadataJSON], [EventTimestamp]
        )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES (
            @SpaceID,
            CASE WHEN @ActorUserID_Clear = 1 THEN NULL ELSE @ActorUserID END,
            @EventKind, ISNULL(@Band, N'Shared'), @Title,
            CASE WHEN @Body_Clear = 1 THEN NULL ELSE @Body END,
            CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE @TargetEntityID END,
            CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE @TargetRecordID END,
            CASE WHEN @MetadataJSON_Clear = 1 THEN NULL ELSE @MetadataJSON END,
            ISNULL(@EventTimestamp, GETUTCDATE())
        );
    END
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceNoticeEvents] WHERE [ID] = (SELECT [ID] FROM @InsertedRow);
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceNoticeEvent] TO [cdp_Developer], [cdp_Integration];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceNoticeEvent]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceNoticeEvent];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceNoticeEvent]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @ActorUserID_Clear bit = 0,
    @ActorUserID uniqueidentifier = NULL,
    @EventKind nvarchar(50) = NULL,
    @Band nvarchar(20) = NULL,
    @Title nvarchar(500) = NULL,
    @Body_Clear bit = 0,
    @Body nvarchar(MAX) = NULL,
    @TargetEntityID_Clear bit = 0,
    @TargetEntityID uniqueidentifier = NULL,
    @TargetRecordID_Clear bit = 0,
    @TargetRecordID nvarchar(450) = NULL,
    @MetadataJSON_Clear bit = 0,
    @MetadataJSON nvarchar(MAX) = NULL,
    @EventTimestamp datetimeoffset(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [${flyway:defaultSchema}].[SpaceNoticeEvent]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [ActorUserID] = CASE WHEN @ActorUserID_Clear = 1 THEN NULL ELSE ISNULL(@ActorUserID, [ActorUserID]) END,
        [EventKind] = ISNULL(@EventKind, [EventKind]),
        [Band] = ISNULL(@Band, [Band]),
        [Title] = ISNULL(@Title, [Title]),
        [Body] = CASE WHEN @Body_Clear = 1 THEN NULL ELSE ISNULL(@Body, [Body]) END,
        [TargetEntityID] = CASE WHEN @TargetEntityID_Clear = 1 THEN NULL ELSE ISNULL(@TargetEntityID, [TargetEntityID]) END,
        [TargetRecordID] = CASE WHEN @TargetRecordID_Clear = 1 THEN NULL ELSE ISNULL(@TargetRecordID, [TargetRecordID]) END,
        [MetadataJSON] = CASE WHEN @MetadataJSON_Clear = 1 THEN NULL ELSE ISNULL(@MetadataJSON, [MetadataJSON]) END,
        [EventTimestamp] = ISNULL(@EventTimestamp, [EventTimestamp])
    WHERE [ID] = @ID;

    IF @@ROWCOUNT = 0
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceNoticeEvents] WHERE 1 = 0;
    ELSE
        SELECT * FROM [${flyway:defaultSchema}].[vwSpaceNoticeEvents] WHERE [ID] = @ID;
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceNoticeEvent] TO [cdp_Developer], [cdp_Integration];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceNoticeEvent]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceNoticeEvent];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceNoticeEvent
ON [${flyway:defaultSchema}].[SpaceNoticeEvent]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [${flyway:defaultSchema}].[SpaceNoticeEvent]
    SET __mj_UpdatedAt = GETUTCDATE()
    FROM [${flyway:defaultSchema}].[SpaceNoticeEvent] AS _organicTable
    INNER JOIN INSERTED AS I ON _organicTable.[ID] = I.[ID];
END;
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceNoticeEvent]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceNoticeEvent];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceNoticeEvent]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [${flyway:defaultSchema}].[SpaceNoticeEvent] WHERE [ID] = @ID;
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID];
    ELSE
        SELECT @ID AS [ID];
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceNoticeEvent] TO [cdp_Developer], [cdp_Integration];
GO

/* Base View SQL for SpaceNoticeWatermark */
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceNoticeWatermarks]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceNoticeWatermarks];
GO
CREATE VIEW [${flyway:defaultSchema}].[vwSpaceNoticeWatermarks]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_UserID.[Name] AS [User]
FROM
    [${flyway:defaultSchema}].[SpaceNoticeWatermark] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_UserID
  ON [s].[UserID] = MJUser_UserID.[ID];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceNoticeWatermarks] TO [cdp_UI], [cdp_Developer], [cdp_Integration];
GO

/* spCreate, spUpdate, Trigger, spDelete for SpaceNoticeWatermark */
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceNoticeWatermark]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceNoticeWatermark];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceNoticeWatermark]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @UserID uniqueidentifier,
    @LastReadEventTimestamp datetimeoffset(7),
    @LastReadEventID_Clear bit = 0,
    @LastReadEventID uniqueidentifier = NULL,
    @LastReadAt datetimeoffset(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER);
    IF @ID IS NOT NULL
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[SpaceNoticeWatermark] (
            [ID], [SpaceID], [UserID], [LastReadEventTimestamp], [LastReadEventID], [LastReadAt]
        )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES (
            @ID, @SpaceID, @UserID, @LastReadEventTimestamp,
            CASE WHEN @LastReadEventID_Clear = 1 THEN NULL ELSE @LastReadEventID END,
            ISNULL(@LastReadAt, GETUTCDATE())
        );
    END
    ELSE
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[SpaceNoticeWatermark] (
            [SpaceID], [UserID], [LastReadEventTimestamp], [LastReadEventID], [LastReadAt]
        )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES (
            @SpaceID, @UserID, @LastReadEventTimestamp,
            CASE WHEN @LastReadEventID_Clear = 1 THEN NULL ELSE @LastReadEventID END,
            ISNULL(@LastReadAt, GETUTCDATE())
        );
    END
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceNoticeWatermarks] WHERE [ID] = (SELECT [ID] FROM @InsertedRow);
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceNoticeWatermark] TO [cdp_Developer], [cdp_Integration];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceNoticeWatermark]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceNoticeWatermark];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceNoticeWatermark]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @UserID uniqueidentifier = NULL,
    @LastReadEventTimestamp datetimeoffset(7) = NULL,
    @LastReadEventID_Clear bit = 0,
    @LastReadEventID uniqueidentifier = NULL,
    @LastReadAt datetimeoffset(7) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [${flyway:defaultSchema}].[SpaceNoticeWatermark]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [UserID] = ISNULL(@UserID, [UserID]),
        [LastReadEventTimestamp] = ISNULL(@LastReadEventTimestamp, [LastReadEventTimestamp]),
        [LastReadEventID] = CASE WHEN @LastReadEventID_Clear = 1 THEN NULL ELSE ISNULL(@LastReadEventID, [LastReadEventID]) END,
        [LastReadAt] = ISNULL(@LastReadAt, [LastReadAt])
    WHERE [ID] = @ID;

    IF @@ROWCOUNT = 0
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceNoticeWatermarks] WHERE 1 = 0;
    ELSE
        SELECT * FROM [${flyway:defaultSchema}].[vwSpaceNoticeWatermarks] WHERE [ID] = @ID;
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceNoticeWatermark] TO [cdp_Developer], [cdp_Integration];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceNoticeWatermark]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceNoticeWatermark];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceNoticeWatermark
ON [${flyway:defaultSchema}].[SpaceNoticeWatermark]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [${flyway:defaultSchema}].[SpaceNoticeWatermark]
    SET __mj_UpdatedAt = GETUTCDATE()
    FROM [${flyway:defaultSchema}].[SpaceNoticeWatermark] AS _organicTable
    INNER JOIN INSERTED AS I ON _organicTable.[ID] = I.[ID];
END;
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceNoticeWatermark]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceNoticeWatermark];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceNoticeWatermark]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [${flyway:defaultSchema}].[SpaceNoticeWatermark] WHERE [ID] = @ID;
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID];
    ELSE
        SELECT @ID AS [ID];
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceNoticeWatermark] TO [cdp_Developer], [cdp_Integration];
GO

/* Base View SQL for SpaceDigestCheckpoint */
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceDigestCheckpoints]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceDigestCheckpoints];
GO
CREATE VIEW [${flyway:defaultSchema}].[vwSpaceDigestCheckpoints]
AS
SELECT
    s.*,
    MJUser_UserID.[Name] AS [User],
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space]
FROM
    [${flyway:defaultSchema}].[SpaceDigestCheckpoint] AS s
INNER JOIN
    [${mjSchema}].[User] AS MJUser_UserID
  ON [s].[UserID] = MJUser_UserID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID];
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceDigestCheckpoints] TO [cdp_UI], [cdp_Developer], [cdp_Integration];
GO

/* spCreate, spUpdate, Trigger, spDelete for SpaceDigestCheckpoint */
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceDigestCheckpoint]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceDigestCheckpoint];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceDigestCheckpoint]
    @ID uniqueidentifier = NULL,
    @UserID uniqueidentifier,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL,
    @Cadence nvarchar(20) = NULL,
    @LastDeliveredTimestamp datetimeoffset(7),
    @LastDeliveredRecordID_Clear bit = 0,
    @LastDeliveredRecordID uniqueidentifier = NULL,
    @LastDeliveredAt datetimeoffset(7) = NULL,
    @ItemsIncludedCount int = NULL,
    @Status nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER);
    IF @ID IS NOT NULL
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[SpaceDigestCheckpoint] (
            [ID], [UserID], [SpaceID], [Cadence], [LastDeliveredTimestamp],
            [LastDeliveredRecordID], [LastDeliveredAt], [ItemsIncludedCount], [Status]
        )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES (
            @ID, @UserID,
            CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE @SpaceID END,
            ISNULL(@Cadence, N'Daily'), @LastDeliveredTimestamp,
            CASE WHEN @LastDeliveredRecordID_Clear = 1 THEN NULL ELSE @LastDeliveredRecordID END,
            ISNULL(@LastDeliveredAt, GETUTCDATE()),
            ISNULL(@ItemsIncludedCount, 0),
            ISNULL(@Status, N'Active')
        );
    END
    ELSE
    BEGIN
        INSERT INTO [${flyway:defaultSchema}].[SpaceDigestCheckpoint] (
            [UserID], [SpaceID], [Cadence], [LastDeliveredTimestamp],
            [LastDeliveredRecordID], [LastDeliveredAt], [ItemsIncludedCount], [Status]
        )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES (
            @UserID,
            CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE @SpaceID END,
            ISNULL(@Cadence, N'Daily'), @LastDeliveredTimestamp,
            CASE WHEN @LastDeliveredRecordID_Clear = 1 THEN NULL ELSE @LastDeliveredRecordID END,
            ISNULL(@LastDeliveredAt, GETUTCDATE()),
            ISNULL(@ItemsIncludedCount, 0),
            ISNULL(@Status, N'Active')
        );
    END
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceDigestCheckpoints] WHERE [ID] = (SELECT [ID] FROM @InsertedRow);
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceDigestCheckpoint] TO [cdp_Developer], [cdp_Integration];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceDigestCheckpoint]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceDigestCheckpoint];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceDigestCheckpoint]
    @ID uniqueidentifier,
    @UserID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL,
    @Cadence nvarchar(20) = NULL,
    @LastDeliveredTimestamp datetimeoffset(7) = NULL,
    @LastDeliveredRecordID_Clear bit = 0,
    @LastDeliveredRecordID uniqueidentifier = NULL,
    @LastDeliveredAt datetimeoffset(7) = NULL,
    @ItemsIncludedCount int = NULL,
    @Status nvarchar(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [${flyway:defaultSchema}].[SpaceDigestCheckpoint]
    SET
        [UserID] = ISNULL(@UserID, [UserID]),
        [SpaceID] = CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, [SpaceID]) END,
        [Cadence] = ISNULL(@Cadence, [Cadence]),
        [LastDeliveredTimestamp] = ISNULL(@LastDeliveredTimestamp, [LastDeliveredTimestamp]),
        [LastDeliveredRecordID] = CASE WHEN @LastDeliveredRecordID_Clear = 1 THEN NULL ELSE ISNULL(@LastDeliveredRecordID, [LastDeliveredRecordID]) END,
        [LastDeliveredAt] = ISNULL(@LastDeliveredAt, [LastDeliveredAt]),
        [ItemsIncludedCount] = ISNULL(@ItemsIncludedCount, [ItemsIncludedCount]),
        [Status] = ISNULL(@Status, [Status])
    WHERE [ID] = @ID;

    IF @@ROWCOUNT = 0
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceDigestCheckpoints] WHERE 1 = 0;
    ELSE
        SELECT * FROM [${flyway:defaultSchema}].[vwSpaceDigestCheckpoints] WHERE [ID] = @ID;
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceDigestCheckpoint] TO [cdp_Developer], [cdp_Integration];
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceDigestCheckpoint]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceDigestCheckpoint];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceDigestCheckpoint
ON [${flyway:defaultSchema}].[SpaceDigestCheckpoint]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [${flyway:defaultSchema}].[SpaceDigestCheckpoint]
    SET __mj_UpdatedAt = GETUTCDATE()
    FROM [${flyway:defaultSchema}].[SpaceDigestCheckpoint] AS _organicTable
    INNER JOIN INSERTED AS I ON _organicTable.[ID] = I.[ID];
END;
GO

IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceDigestCheckpoint]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceDigestCheckpoint];
GO
CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceDigestCheckpoint]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM [${flyway:defaultSchema}].[SpaceDigestCheckpoint] WHERE [ID] = @ID;
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID];
    ELSE
        SELECT @ID AS [ID];
END;
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceDigestCheckpoint] TO [cdp_Developer], [cdp_Integration];
GO
