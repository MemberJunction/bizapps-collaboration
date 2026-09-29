-- =============================================================================
-- Migration: V202609290300__v0.1.x__Example_Space_Types_Tables.sql
-- Schema: ${flyway:defaultSchema}  (__mj_BizAppsCollabExamples)
--
-- The tables behind the two example space types, example-board and example-room, as IsA children of
-- Collaboration's Space: each row shares its primary key with the Space row it specialises, and holds only what
-- is its own. They live in a schema of their own, outside the shipped packages: this repo's CodeGen config writes
-- the shipped schema into the published packages, and these tables are not for shipping.
--
-- CodeGen adds the __mj_CreatedAt and __mj_UpdatedAt columns, so they are not written here.
-- Run with:  mj migrate --schema __mj_BizAppsCollabExamples --dir packages/ExampleSpaceTypes/migrations
-- =============================================================================

IF OBJECT_ID(N'${flyway:defaultSchema}.ExampleBoard', N'U') IS NULL
BEGIN
    CREATE TABLE [${flyway:defaultSchema}].[ExampleBoard] (
        [ID] UNIQUEIDENTIFIER NOT NULL,
        [TermName] NVARCHAR(100) NOT NULL,
        [MeetingCadence] NVARCHAR(100) NULL,
        [NextMeetingDate] DATETIMEOFFSET NULL,
        [NextMeetingLocation] NVARCHAR(255) NULL,
        [QuorumPercentage] INT NOT NULL CONSTRAINT [DF_ExampleBoard_Quorum] DEFAULT (50),
        [BoardCharterUrl] NVARCHAR(500) NULL,
        CONSTRAINT [PK_ExampleBoard] PRIMARY KEY CLUSTERED ([ID] ASC),
        CONSTRAINT [FK_ExampleBoard_Space] FOREIGN KEY ([ID]) REFERENCES [__mj_BizAppsCollaboration].[Space] ([ID]) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'${flyway:defaultSchema}.ExampleRoom', N'U') IS NULL
BEGIN
    CREATE TABLE [${flyway:defaultSchema}].[ExampleRoom] (
        [ID] UNIQUEIDENTIFIER NOT NULL,
        [DealID] NVARCHAR(100) NOT NULL,
        [AccountName] NVARCHAR(255) NOT NULL,
        [DealStage] NVARCHAR(50) NOT NULL,
        [CloseDate] DATETIMEOFFSET NULL,
        [DealValue] DECIMAL(18, 2) NULL,
        [WinProbability] INT NULL,
        CONSTRAINT [PK_ExampleRoom] PRIMARY KEY CLUSTERED ([ID] ASC),
        CONSTRAINT [FK_ExampleRoom_Space] FOREIGN KEY ([ID]) REFERENCES [__mj_BizAppsCollaboration].[Space] ([ID]) ON DELETE CASCADE
    );
END;
GO

-- What each column is, for anyone reading the schema and for the entity documentation CodeGen carries into the app
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A board: a space of the example-board type, with the terms its members sit under. Shares its primary key with the Space row it specialises.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleBoard';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The Space this board specialises: the same value as Space.ID.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleBoard', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The term the board sits for, for example "2026 to 2027".', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleBoard', @level2type = N'COLUMN', @level2name = N'TermName';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'How often the board meets, in words: "Monthly", "First Tuesday".', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleBoard', @level2type = N'COLUMN', @level2name = N'MeetingCadence';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the next meeting is.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleBoard', @level2type = N'COLUMN', @level2name = N'NextMeetingDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Where the next meeting is.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleBoard', @level2type = N'COLUMN', @level2name = N'NextMeetingLocation';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The percentage of members who must attend for a vote to count. Defaults to 50.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleBoard', @level2type = N'COLUMN', @level2name = N'QuorumPercentage';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A link to the board charter.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleBoard', @level2type = N'COLUMN', @level2name = N'BoardCharterUrl';

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A deal room: a space of the example-room type, holding what is known about one deal. Shares its primary key with the Space row it specialises.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleRoom';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The Space this deal room specialises: the same value as Space.ID.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleRoom', @level2type = N'COLUMN', @level2name = N'ID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The deal, as the system that owns it names it.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleRoom', @level2type = N'COLUMN', @level2name = N'DealID';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The account the deal is with.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleRoom', @level2type = N'COLUMN', @level2name = N'AccountName';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The stage the deal is at, in the seller''s words.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleRoom', @level2type = N'COLUMN', @level2name = N'DealStage';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When the deal is expected to close.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleRoom', @level2type = N'COLUMN', @level2name = N'CloseDate';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'What the deal is worth.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleRoom', @level2type = N'COLUMN', @level2name = N'DealValue';
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The seller''s estimate of the chance of winning, as a percentage.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'ExampleRoom', @level2type = N'COLUMN', @level2name = N'WinProbability';
GO


















































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Collaboration_Examples: Example Boards */

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
         'ce573816-2129-4dcd-aaf4-fe837f1a0c57',
         'MJ_BizApps_Collaboration_Examples: Example Boards',
         'Example Boards',
         'A board: a space of the example-board type, with the terms its members sit under. Shares its primary key with the Space row it specialises.',
         NULL,
         'ExampleBoard',
         'vwExampleBoards',
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
      SELECT 1 FROM [${mjSchema}].[Application] WHERE [ID] = 'fff92204-28dc-4ff4-83c6-81dc7d8a46b2'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[Application] ([ID], [Name], [Description], [SchemaAutoAddNewEntities], [Path], [AutoUpdatePath], [DefaultForNewUser])
                       VALUES ('fff92204-28dc-4ff4-83c6-81dc7d8a46b2', '${flyway:defaultSchema}', 'Generated for schema', '${flyway:defaultSchema}', 'mjbizappscollabexamples', 1, 0)
   END;

/* Adding role UI to application ${flyway:defaultSchema} */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[ApplicationRole] WHERE [ApplicationID] = 'fff92204-28dc-4ff4-83c6-81dc7d8a46b2' AND [RoleID] = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[ApplicationRole]
                                 ([ApplicationID], [RoleID], [CanAccess], [CanAdmin]) VALUES
                                 ('fff92204-28dc-4ff4-83c6-81dc7d8a46b2', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0)
   END;

/* Adding role Developer to application ${flyway:defaultSchema} */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[ApplicationRole] WHERE [ApplicationID] = 'fff92204-28dc-4ff4-83c6-81dc7d8a46b2' AND [RoleID] = 'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[ApplicationRole]
                                 ([ApplicationID], [RoleID], [CanAccess], [CanAdmin]) VALUES
                                 ('fff92204-28dc-4ff4-83c6-81dc7d8a46b2', 'DEAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 1)
   END;

/* Adding role Integration to application ${flyway:defaultSchema} */
IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[ApplicationRole] WHERE [ApplicationID] = 'fff92204-28dc-4ff4-83c6-81dc7d8a46b2' AND [RoleID] = 'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[ApplicationRole]
                                 ([ApplicationID], [RoleID], [CanAccess], [CanAdmin]) VALUES
                                 ('fff92204-28dc-4ff4-83c6-81dc7d8a46b2', 'DFAFCCEC-6A37-EF11-86D4-000D3A4E707E', 1, 0)
   END;

/* SQL generated to add new entity MJ_BizApps_Collaboration_Examples: Example Boards to application ID: 'fff92204-28dc-4ff4-83c6-81dc7d8a46b2' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('fff92204-28dc-4ff4-83c6-81dc7d8a46b2', 'ce573816-2129-4dcd-aaf4-fe837f1a0c57', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'fff92204-28dc-4ff4-83c6-81dc7d8a46b2'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration_Examples: Example Boards for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('ce573816-2129-4dcd-aaf4-fe837f1a0c57' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('ce573816-2129-4dcd-aaf4-fe837f1a0c57' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration_Examples: Example Boards for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('ce573816-2129-4dcd-aaf4-fe837f1a0c57' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('ce573816-2129-4dcd-aaf4-fe837f1a0c57' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration_Examples: Example Boards for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('ce573816-2129-4dcd-aaf4-fe837f1a0c57' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('ce573816-2129-4dcd-aaf4-fe837f1a0c57' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration_Examples: Example Rooms */

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
         'c03a093e-6205-4392-8402-2d0c4d867ab5',
         'MJ_BizApps_Collaboration_Examples: Example Rooms',
         'Example Rooms',
         'A deal room: a space of the example-room type, holding what is known about one deal. Shares its primary key with the Space row it specialises.',
         NULL,
         'ExampleRoom',
         'vwExampleRooms',
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

/* SQL generated to add new entity MJ_BizApps_Collaboration_Examples: Example Rooms to application ID: 'FFF92204-28DC-4FF4-83C6-81DC7D8A46B2' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('FFF92204-28DC-4FF4-83C6-81DC7D8A46B2', 'c03a093e-6205-4392-8402-2d0c4d867ab5', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = 'FFF92204-28DC-4FF4-83C6-81DC7D8A46B2'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration_Examples: Example Rooms for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('c03a093e-6205-4392-8402-2d0c4d867ab5' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('c03a093e-6205-4392-8402-2d0c4d867ab5' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration_Examples: Example Rooms for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('c03a093e-6205-4392-8402-2d0c4d867ab5' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('c03a093e-6205-4392-8402-2d0c4d867ab5' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration_Examples: Example Rooms for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('c03a093e-6205-4392-8402-2d0c4d867ab5' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('c03a093e-6205-4392-8402-2d0c4d867ab5' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExampleRoom */
ALTER TABLE [${flyway:defaultSchema}].[ExampleRoom] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExampleRoom */
UPDATE [${flyway:defaultSchema}].[ExampleRoom] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExampleRoom */
ALTER TABLE [${flyway:defaultSchema}].[ExampleRoom] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExampleRoom */
ALTER TABLE [${flyway:defaultSchema}].[ExampleRoom] ADD CONSTRAINT [DF___mj_BizAppsCollabExamples_ExampleRoom___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExampleRoom */
ALTER TABLE [${flyway:defaultSchema}].[ExampleRoom] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExampleRoom */
UPDATE [${flyway:defaultSchema}].[ExampleRoom] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExampleRoom */
ALTER TABLE [${flyway:defaultSchema}].[ExampleRoom] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExampleRoom */
ALTER TABLE [${flyway:defaultSchema}].[ExampleRoom] ADD CONSTRAINT [DF___mj_BizAppsCollabExamples_ExampleRoom___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExampleBoard */
ALTER TABLE [${flyway:defaultSchema}].[ExampleBoard] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExampleBoard */
UPDATE [${flyway:defaultSchema}].[ExampleBoard] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExampleBoard */
ALTER TABLE [${flyway:defaultSchema}].[ExampleBoard] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ExampleBoard */
ALTER TABLE [${flyway:defaultSchema}].[ExampleBoard] ADD CONSTRAINT [DF___mj_BizAppsCollabExamples_ExampleBoard___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExampleBoard */
ALTER TABLE [${flyway:defaultSchema}].[ExampleBoard] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExampleBoard */
UPDATE [${flyway:defaultSchema}].[ExampleBoard] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExampleBoard */
ALTER TABLE [${flyway:defaultSchema}].[ExampleBoard] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ExampleBoard */
ALTER TABLE [${flyway:defaultSchema}].[ExampleBoard] ADD CONSTRAINT [DF___mj_BizAppsCollabExamples_ExampleBoard___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 18 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4f3d0fb8-2604-4fda-ba5c-41a1c60bcf26' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'ID')) BEGIN
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
            '4f3d0fb8-2604-4fda-ba5c-41a1c60bcf26',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'ID',
            'ID',
            'The Space this deal room specialises: the same value as Space.ID.',
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            0,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'da19e8ae-2a1f-4deb-9e9e-611285dc810d' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'DealID')) BEGIN
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
            'da19e8ae-2a1f-4deb-9e9e-611285dc810d',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'DealID',
            'Deal ID',
            'The deal, as the system that owns it names it.',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3f92bd73-b5a5-4747-a2e7-084002d01a63' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'AccountName')) BEGIN
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
            '3f92bd73-b5a5-4747-a2e7-084002d01a63',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'AccountName',
            'Account Name',
            'The account the deal is with.',
            'nvarchar',
            510,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9f55fe03-4d9d-4af1-bec8-be34eb768211' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'DealStage')) BEGIN
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
            '9f55fe03-4d9d-4af1-bec8-be34eb768211',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'DealStage',
            'Deal Stage',
            'The stage the deal is at, in the seller''s words.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e50b08b4-b5a3-44e9-ae2e-bf5cc58867b2' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'CloseDate')) BEGIN
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
            'e50b08b4-b5a3-44e9-ae2e-bf5cc58867b2',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'CloseDate',
            'Close Date',
            'When the deal is expected to close.',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a8f8a66b-3b5a-4187-9aa9-7672294832cc' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'DealValue')) BEGIN
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
            'a8f8a66b-3b5a-4187-9aa9-7672294832cc',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'DealValue',
            'Deal Value',
            'What the deal is worth.',
            'decimal',
            9,
            18,
            2,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7fa3cb73-7c4c-4816-8d19-c2b1a0763e33' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'WinProbability')) BEGIN
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
            '7fa3cb73-7c4c-4816-8d19-c2b1a0763e33',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'WinProbability',
            'Win Probability',
            'The seller''s estimate of the chance of winning, as a percentage.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '25d0d804-1e13-4e6a-a61f-18e11a3d9cc1' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = '__mj_CreatedAt')) BEGIN
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
            '25d0d804-1e13-4e6a-a61f-18e11a3d9cc1',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0f563c0f-fb19-43b9-bd3a-fdbee6ede045' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '0f563c0f-fb19-43b9-bd3a-fdbee6ede045',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '479f5e9e-c317-44af-9a4d-e865df544e35' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'ID')) BEGIN
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
            '479f5e9e-c317-44af-9a4d-e865df544e35',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'ID',
            'ID',
            'The Space this board specialises: the same value as Space.ID.',
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            0,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '71006302-7658-4a57-b5c6-554e24990b36' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'TermName')) BEGIN
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
            '71006302-7658-4a57-b5c6-554e24990b36',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'TermName',
            'Term Name',
            'The term the board sits for, for example "2026 to 2027".',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2b755ad7-4321-499e-9e44-52e72093c845' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'MeetingCadence')) BEGIN
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
            '2b755ad7-4321-499e-9e44-52e72093c845',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'MeetingCadence',
            'Meeting Cadence',
            'How often the board meets, in words: "Monthly", "First Tuesday".',
            'nvarchar',
            200,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '65b6bc73-9340-4329-b3f8-451176f194fd' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'NextMeetingDate')) BEGIN
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
            '65b6bc73-9340-4329-b3f8-451176f194fd',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'NextMeetingDate',
            'Next Meeting Date',
            'When the next meeting is.',
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2ad1e33c-81c2-4bc3-8ce5-c5cd426b5ba8' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'NextMeetingLocation')) BEGIN
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
            '2ad1e33c-81c2-4bc3-8ce5-c5cd426b5ba8',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'NextMeetingLocation',
            'Next Meeting Location',
            'Where the next meeting is.',
            'nvarchar',
            510,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3465838c-cef1-49ee-9751-c9ab0abbee4b' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'QuorumPercentage')) BEGIN
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
            '3465838c-cef1-49ee-9751-c9ab0abbee4b',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'QuorumPercentage',
            'Quorum Percentage',
            'The percentage of members who must attend for a vote to count. Defaults to 50.',
            'int',
            4,
            10,
            0,
            0,
            '(50)',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2cd0a793-062f-40be-835b-54e8c9afea62' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'BoardCharterUrl')) BEGIN
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
            '2cd0a793-062f-40be-835b-54e8c9afea62',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'BoardCharterUrl',
            'Board Charter Url',
            'A link to the board charter.',
            'nvarchar',
            1000,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '939216b9-c98c-4f24-95f3-11dde471322c' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = '__mj_CreatedAt')) BEGIN
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
            '939216b9-c98c-4f24-95f3-11dde471322c',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'cda4ea97-a851-46e0-b1ef-bf57808b3de3' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = '__mj_UpdatedAt')) BEGIN
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
            'cda4ea97-a851-46e0-b1ef-bf57808b3de3',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
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
              AND e.[SchemaName] NOT IN ('sys','staging','dbo','${mjSchema}','${mjSchema}_BizAppsCollaboration','${mjSchema}_BizAppsCommon','${mjSchema}_BizAppsTasks')
              AND NOT EXISTS (
               SELECT 1 FROM [${mjSchema}].[EntityField] f2
               WHERE f2.[EntityID] = e.[ID]
                 AND f2.[IncludeInUserSearchAPI] = 1
            )
         );


/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration_Examples: Example Rooms (One To Many via ID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'bb462c5e-aa96-4b14-ae8a-9e43ad12a711'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('bb462c5e-aa96-4b14-ae8a-9e43ad12a711', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'C03A093E-6205-4392-8402-2D0C4D867AB5', 'ID', 'One To Many', 1, 1, 10, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration_Examples: Example Boards (One To Many via ID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '629e09f8-067c-4300-bcd8-b474179371b8'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('629e09f8-067c-4300-bcd8-b474179371b8', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'CE573816-2129-4DCD-AAF4-FE837F1A0C57', 'ID', 'One To Many', 1, 1, 11, GETUTCDATE(), GETUTCDATE())
   END;

/* Set IS-A ParentID for "MJ_BizApps_Collaboration_Examples: Example Boards" → "MJ_BizApps_Collaboration: Spaces" */
UPDATE [${mjSchema}].[Entity]
                                  SET [__mj_UpdatedAt]=GETUTCDATE(),
                                      [ParentID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'
                                  WHERE [ID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57';

/* Set IS-A ParentID for "MJ_BizApps_Collaboration_Examples: Example Rooms" → "MJ_BizApps_Collaboration: Spaces" */
UPDATE [${mjSchema}].[Entity]
                                  SET [__mj_UpdatedAt]=GETUTCDATE(),
                                      [ParentID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'
                                  WHERE [ID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5';

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for ExampleBoard */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Index for Foreign Keys for ExampleRoom */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Base View SQL for MJ_BizApps_Collaboration_Examples: Example Boards */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
-- Item: vwExampleBoards
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration_Examples: Example Boards
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  ExampleBoard
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwExampleBoards]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwExampleBoards];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwExampleBoards]
AS
SELECT
    e.*,
    ${mjSchema}_isa_p1.[SpaceTypeID],
    ${mjSchema}_isa_p1.[ParentID],
    ${mjSchema}_isa_p1.[Name],
    ${mjSchema}_isa_p1.[Description],
    ${mjSchema}_isa_p1.[OwnerID],
    ${mjSchema}_isa_p1.[InheritsMembership],
    ${mjSchema}_isa_p1.[AgentRetrieval],
    ${mjSchema}_isa_p1.[StartedAt],
    ${mjSchema}_isa_p1.[ClosedAt],
    ${mjSchema}_isa_p1.[Retention],
    ${mjSchema}_isa_p1.[AllowParentAssignees],
    ${mjSchema}_isa_p1.[PlannedCloseAt],
    ${mjSchema}_isa_p1.[IconClass],
    ${mjSchema}_isa_p1.[Color],
    ${mjSchema}_isa_p1.[BackgroundImageURL],
    ${mjSchema}_isa_p1.[Configuration],
    ${mjSchema}_isa_p1.[AnchorEntityID],
    ${mjSchema}_isa_p1.[AnchorRecordID],
    ${mjSchema}_isa_p1.[PostCloseAccess],
    ${mjSchema}_isa_p1.[PostCloseAccessDays]
FROM
    [${flyway:defaultSchema}].[ExampleBoard] AS e
INNER JOIN
    [${mjSchema}_BizAppsCollaboration].[Space] AS ${mjSchema}_isa_p1
  ON
    [e].[ID] = ${mjSchema}_isa_p1.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwExampleBoards] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration_Examples: Example Boards */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
-- Item: Permissions for vwExampleBoards
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwExampleBoards] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration_Examples: Example Boards */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
-- Item: spCreateExampleBoard
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR ExampleBoard
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateExampleBoard]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateExampleBoard];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateExampleBoard]
    @ID uniqueidentifier = NULL,
    @TermName nvarchar(100),
    @MeetingCadence_Clear bit = 0,
    @MeetingCadence nvarchar(100) = NULL,
    @NextMeetingDate_Clear bit = 0,
    @NextMeetingDate datetimeoffset = NULL,
    @NextMeetingLocation_Clear bit = 0,
    @NextMeetingLocation nvarchar(255) = NULL,
    @QuorumPercentage int = NULL,
    @BoardCharterUrl_Clear bit = 0,
    @BoardCharterUrl nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ActualID UNIQUEIDENTIFIER = ISNULL(@ID, NEWID())
    INSERT INTO
    [${flyway:defaultSchema}].[ExampleBoard]
        (
            [TermName],
                [MeetingCadence],
                [NextMeetingDate],
                [NextMeetingLocation],
                [QuorumPercentage],
                [BoardCharterUrl],
                [ID]
        )
    VALUES
        (
            @TermName,
                CASE WHEN @MeetingCadence_Clear = 1 THEN NULL ELSE ISNULL(@MeetingCadence, NULL) END,
                CASE WHEN @NextMeetingDate_Clear = 1 THEN NULL ELSE ISNULL(@NextMeetingDate, NULL) END,
                CASE WHEN @NextMeetingLocation_Clear = 1 THEN NULL ELSE ISNULL(@NextMeetingLocation, NULL) END,
                ISNULL(@QuorumPercentage, 50),
                CASE WHEN @BoardCharterUrl_Clear = 1 THEN NULL ELSE ISNULL(@BoardCharterUrl, NULL) END,
                @ActualID
        )
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwExampleBoards] WHERE [ID] = @ActualID
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateExampleBoard] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration_Examples: Example Boards */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateExampleBoard] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration_Examples: Example Boards */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
-- Item: spUpdateExampleBoard
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR ExampleBoard
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateExampleBoard]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateExampleBoard];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateExampleBoard]
    @ID uniqueidentifier,
    @TermName nvarchar(100) = NULL,
    @MeetingCadence_Clear bit = 0,
    @MeetingCadence nvarchar(100) = NULL,
    @NextMeetingDate_Clear bit = 0,
    @NextMeetingDate datetimeoffset = NULL,
    @NextMeetingLocation_Clear bit = 0,
    @NextMeetingLocation nvarchar(255) = NULL,
    @QuorumPercentage int = NULL,
    @BoardCharterUrl_Clear bit = 0,
    @BoardCharterUrl nvarchar(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ExampleBoard]
    SET
        [TermName] = ISNULL(@TermName, [TermName]),
        [MeetingCadence] = CASE WHEN @MeetingCadence_Clear = 1 THEN NULL ELSE ISNULL(@MeetingCadence, [MeetingCadence]) END,
        [NextMeetingDate] = CASE WHEN @NextMeetingDate_Clear = 1 THEN NULL ELSE ISNULL(@NextMeetingDate, [NextMeetingDate]) END,
        [NextMeetingLocation] = CASE WHEN @NextMeetingLocation_Clear = 1 THEN NULL ELSE ISNULL(@NextMeetingLocation, [NextMeetingLocation]) END,
        [QuorumPercentage] = ISNULL(@QuorumPercentage, [QuorumPercentage]),
        [BoardCharterUrl] = CASE WHEN @BoardCharterUrl_Clear = 1 THEN NULL ELSE ISNULL(@BoardCharterUrl, [BoardCharterUrl]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwExampleBoards] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwExampleBoards]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateExampleBoard] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the ExampleBoard table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateExampleBoard]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateExampleBoard];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateExampleBoard
ON [${flyway:defaultSchema}].[ExampleBoard]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ExampleBoard]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[ExampleBoard] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration_Examples: Example Boards */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateExampleBoard] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration_Examples: Example Rooms */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
-- Item: vwExampleRooms
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration_Examples: Example Rooms
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  ExampleRoom
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwExampleRooms]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwExampleRooms];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwExampleRooms]
AS
SELECT
    e.*,
    ${mjSchema}_isa_p1.[SpaceTypeID],
    ${mjSchema}_isa_p1.[ParentID],
    ${mjSchema}_isa_p1.[Name],
    ${mjSchema}_isa_p1.[Description],
    ${mjSchema}_isa_p1.[OwnerID],
    ${mjSchema}_isa_p1.[InheritsMembership],
    ${mjSchema}_isa_p1.[AgentRetrieval],
    ${mjSchema}_isa_p1.[StartedAt],
    ${mjSchema}_isa_p1.[ClosedAt],
    ${mjSchema}_isa_p1.[Retention],
    ${mjSchema}_isa_p1.[AllowParentAssignees],
    ${mjSchema}_isa_p1.[PlannedCloseAt],
    ${mjSchema}_isa_p1.[IconClass],
    ${mjSchema}_isa_p1.[Color],
    ${mjSchema}_isa_p1.[BackgroundImageURL],
    ${mjSchema}_isa_p1.[Configuration],
    ${mjSchema}_isa_p1.[AnchorEntityID],
    ${mjSchema}_isa_p1.[AnchorRecordID],
    ${mjSchema}_isa_p1.[PostCloseAccess],
    ${mjSchema}_isa_p1.[PostCloseAccessDays]
FROM
    [${flyway:defaultSchema}].[ExampleRoom] AS e
INNER JOIN
    [${mjSchema}_BizAppsCollaboration].[Space] AS ${mjSchema}_isa_p1
  ON
    [e].[ID] = ${mjSchema}_isa_p1.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwExampleRooms] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration_Examples: Example Rooms */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
-- Item: Permissions for vwExampleRooms
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwExampleRooms] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration_Examples: Example Rooms */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
-- Item: spCreateExampleRoom
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR ExampleRoom
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateExampleRoom]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateExampleRoom];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateExampleRoom]
    @ID uniqueidentifier = NULL,
    @DealID nvarchar(100),
    @AccountName nvarchar(255),
    @DealStage nvarchar(50),
    @CloseDate_Clear bit = 0,
    @CloseDate datetimeoffset = NULL,
    @DealValue_Clear bit = 0,
    @DealValue decimal(18, 2) = NULL,
    @WinProbability_Clear bit = 0,
    @WinProbability int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ActualID UNIQUEIDENTIFIER = ISNULL(@ID, NEWID())
    INSERT INTO
    [${flyway:defaultSchema}].[ExampleRoom]
        (
            [DealID],
                [AccountName],
                [DealStage],
                [CloseDate],
                [DealValue],
                [WinProbability],
                [ID]
        )
    VALUES
        (
            @DealID,
                @AccountName,
                @DealStage,
                CASE WHEN @CloseDate_Clear = 1 THEN NULL ELSE ISNULL(@CloseDate, NULL) END,
                CASE WHEN @DealValue_Clear = 1 THEN NULL ELSE ISNULL(@DealValue, NULL) END,
                CASE WHEN @WinProbability_Clear = 1 THEN NULL ELSE ISNULL(@WinProbability, NULL) END,
                @ActualID
        )
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwExampleRooms] WHERE [ID] = @ActualID
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateExampleRoom] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration_Examples: Example Rooms */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateExampleRoom] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration_Examples: Example Rooms */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
-- Item: spUpdateExampleRoom
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR ExampleRoom
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateExampleRoom]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateExampleRoom];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateExampleRoom]
    @ID uniqueidentifier,
    @DealID nvarchar(100) = NULL,
    @AccountName nvarchar(255) = NULL,
    @DealStage nvarchar(50) = NULL,
    @CloseDate_Clear bit = 0,
    @CloseDate datetimeoffset = NULL,
    @DealValue_Clear bit = 0,
    @DealValue decimal(18, 2) = NULL,
    @WinProbability_Clear bit = 0,
    @WinProbability int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ExampleRoom]
    SET
        [DealID] = ISNULL(@DealID, [DealID]),
        [AccountName] = ISNULL(@AccountName, [AccountName]),
        [DealStage] = ISNULL(@DealStage, [DealStage]),
        [CloseDate] = CASE WHEN @CloseDate_Clear = 1 THEN NULL ELSE ISNULL(@CloseDate, [CloseDate]) END,
        [DealValue] = CASE WHEN @DealValue_Clear = 1 THEN NULL ELSE ISNULL(@DealValue, [DealValue]) END,
        [WinProbability] = CASE WHEN @WinProbability_Clear = 1 THEN NULL ELSE ISNULL(@WinProbability, [WinProbability]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwExampleRooms] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwExampleRooms]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateExampleRoom] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the ExampleRoom table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateExampleRoom]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateExampleRoom];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateExampleRoom
ON [${flyway:defaultSchema}].[ExampleRoom]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[ExampleRoom]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[ExampleRoom] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration_Examples: Example Rooms */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateExampleRoom] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration_Examples: Example Boards */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
-- Item: spDeleteExampleBoard
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR ExampleBoard
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteExampleBoard]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteExampleBoard];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteExampleBoard]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[ExampleBoard]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteExampleBoard] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration_Examples: Example Boards */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteExampleBoard] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration_Examples: Example Rooms */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
-- Item: spDeleteExampleRoom
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR ExampleRoom
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteExampleRoom]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteExampleRoom];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteExampleRoom]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[ExampleRoom]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteExampleRoom] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration_Examples: Example Rooms */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteExampleRoom] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (2 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='CE573816-2129-4DCD-AAF4-FE837F1A0C57,C03A093E-6205-4392-8402-2D0C4D867AB5', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 40 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1c5400d7-94f1-44bd-ba08-d7df2c0aaaad' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'SpaceTypeID')) BEGIN
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
            '1c5400d7-94f1-44bd-ba08-d7df2c0aaaad',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '71317269-9413-4bfe-a3e5-d4005e6384b0' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'ParentID')) BEGIN
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
            '71317269-9413-4bfe-a3e5-d4005e6384b0',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'ParentID',
            'Parent ID',
            NULL,
            'uniqueidentifier',
            16,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '76e00843-17f5-4c13-9aea-1932b363a332' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'Name')) BEGIN
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
            '76e00843-17f5-4c13-9aea-1932b363a332',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
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
            0,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0a095728-41da-4bcf-9e9c-aa520749ef83' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'Description')) BEGIN
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
            '0a095728-41da-4bcf-9e9c-aa520749ef83',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '49890f3b-62dd-4eed-9da3-d617cfe15b00' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'OwnerID')) BEGIN
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
            '49890f3b-62dd-4eed-9da3-d617cfe15b00',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'OwnerID',
            'Owner ID',
            NULL,
            'uniqueidentifier',
            16,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '675864d5-621e-416b-a1ce-b2fb3a8dcf37' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'InheritsMembership')) BEGIN
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
            '675864d5-621e-416b-a1ce-b2fb3a8dcf37',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'InheritsMembership',
            'Inherits Membership',
            NULL,
            'bit',
            1,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1e101296-14b1-4a00-93ee-4cc3c4cee443' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'AgentRetrieval')) BEGIN
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
            '1e101296-14b1-4a00-93ee-4cc3c4cee443',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'AgentRetrieval',
            'Agent Retrieval',
            NULL,
            'nvarchar',
            60,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '80773c3b-6a52-43f3-8cf3-7157ac1cf34f' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'StartedAt')) BEGIN
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
            '80773c3b-6a52-43f3-8cf3-7157ac1cf34f',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'StartedAt',
            'Started At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ac4be99e-2b1a-47ba-bdb5-9f25ecae6af1' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'ClosedAt')) BEGIN
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
            'ac4be99e-2b1a-47ba-bdb5-9f25ecae6af1',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'ClosedAt',
            'Closed At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '159d184d-e761-4385-a9a6-5ae7c0d652a8' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'Retention')) BEGIN
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
            '159d184d-e761-4385-a9a6-5ae7c0d652a8',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'Retention',
            'Retention',
            NULL,
            'nvarchar',
            40,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '466a462e-8a17-4de2-88dd-6fa744d253ac' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'AllowParentAssignees')) BEGIN
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
            '466a462e-8a17-4de2-88dd-6fa744d253ac',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'AllowParentAssignees',
            'Allow Parent Assignees',
            NULL,
            'bit',
            1,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7b9f2a09-3862-4942-9514-84fbceaf6c0e' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'PlannedCloseAt')) BEGIN
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
            '7b9f2a09-3862-4942-9514-84fbceaf6c0e',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'PlannedCloseAt',
            'Planned Close At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1b16f0b4-7b42-490f-b3f1-303096872ba8' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'IconClass')) BEGIN
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
            '1b16f0b4-7b42-490f-b3f1-303096872ba8',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'IconClass',
            'Icon Class',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '14ab29de-09d6-4157-8ba9-964b3ff6c98a' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'Color')) BEGIN
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
            '14ab29de-09d6-4157-8ba9-964b3ff6c98a',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'Color',
            'Color',
            NULL,
            'nvarchar',
            100,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0029e537-cfcc-4d0c-8094-c2b1feb0f42d' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'BackgroundImageURL')) BEGIN
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
            '0029e537-cfcc-4d0c-8094-c2b1feb0f42d',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'BackgroundImageURL',
            'Background Image URL',
            NULL,
            'nvarchar',
            2000,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f39eea94-427c-4dfd-a26c-4c83c8f804f4' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'Configuration')) BEGIN
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
            'f39eea94-427c-4dfd-a26c-4c83c8f804f4',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'Configuration',
            'Configuration',
            NULL,
            'nvarchar',
            -1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ff9dfd2a-5467-44aa-96e2-beb28c127b8b' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'AnchorEntityID')) BEGIN
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
            'ff9dfd2a-5467-44aa-96e2-beb28c127b8b',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'AnchorEntityID',
            'Anchor Entity ID',
            NULL,
            'uniqueidentifier',
            16,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '146153c8-aab2-4b24-8877-f00de01abd89' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'AnchorRecordID')) BEGIN
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
            '146153c8-aab2-4b24-8877-f00de01abd89',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'AnchorRecordID',
            'Anchor Record ID',
            NULL,
            'nvarchar',
            900,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f5f7e437-cdeb-43e1-a651-e9199e8d56c7' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'PostCloseAccess')) BEGIN
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
            'f5f7e437-cdeb-43e1-a651-e9199e8d56c7',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'PostCloseAccess',
            'Post Close Access',
            NULL,
            'nvarchar',
            40,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '75b117d5-006e-442b-8690-edb5d2d3f437' OR (EntityID = 'C03A093E-6205-4392-8402-2D0C4D867AB5' AND Name = 'PostCloseAccessDays')) BEGIN
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
            '75b117d5-006e-442b-8690-edb5d2d3f437',
            'C03A093E-6205-4392-8402-2D0C4D867AB5', -- Entity: MJ_BizApps_Collaboration_Examples: Example Rooms
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'C03A093E-6205-4392-8402-2D0C4D867AB5'),
            'PostCloseAccessDays',
            'Post Close Access Days',
            NULL,
            'int',
            4,
            10,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3f10f9d2-3297-49e3-a4e8-be3be1168e16' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'SpaceTypeID')) BEGIN
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
            '3f10f9d2-3297-49e3-a4e8-be3be1168e16',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a99da16d-5eec-47dc-ae83-7d0aad017962' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'ParentID')) BEGIN
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
            'a99da16d-5eec-47dc-ae83-7d0aad017962',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'ParentID',
            'Parent ID',
            NULL,
            'uniqueidentifier',
            16,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b59136e3-baf7-479b-a076-f2f315a59ca2' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'Name')) BEGIN
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
            'b59136e3-baf7-479b-a076-f2f315a59ca2',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
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
            0,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b1217e8f-9906-49e1-a57c-1379a106de04' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'Description')) BEGIN
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
            'b1217e8f-9906-49e1-a57c-1379a106de04',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9734de40-e014-4c38-8c20-f41c9485a4b8' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'OwnerID')) BEGIN
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
            '9734de40-e014-4c38-8c20-f41c9485a4b8',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'OwnerID',
            'Owner ID',
            NULL,
            'uniqueidentifier',
            16,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0702028a-6928-4606-870f-93c49d4fb1af' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'InheritsMembership')) BEGIN
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
            '0702028a-6928-4606-870f-93c49d4fb1af',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'InheritsMembership',
            'Inherits Membership',
            NULL,
            'bit',
            1,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2abb28e4-2415-47e9-b48f-d7c425dbae3e' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'AgentRetrieval')) BEGIN
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
            '2abb28e4-2415-47e9-b48f-d7c425dbae3e',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'AgentRetrieval',
            'Agent Retrieval',
            NULL,
            'nvarchar',
            60,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b6b6ca71-f62e-4c1e-9e8e-0fbb5ee2ccfd' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'StartedAt')) BEGIN
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
            'b6b6ca71-f62e-4c1e-9e8e-0fbb5ee2ccfd',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'StartedAt',
            'Started At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2d8bf0b1-d302-46f7-8c2c-9b85c2437164' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'ClosedAt')) BEGIN
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
            '2d8bf0b1-d302-46f7-8c2c-9b85c2437164',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'ClosedAt',
            'Closed At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ed919b2d-b275-4a31-a7fc-cc20de6e7048' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'Retention')) BEGIN
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
            'ed919b2d-b275-4a31-a7fc-cc20de6e7048',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'Retention',
            'Retention',
            NULL,
            'nvarchar',
            40,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '77df11ab-dd7c-4416-93ea-a163afc8ffd4' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'AllowParentAssignees')) BEGIN
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
            '77df11ab-dd7c-4416-93ea-a163afc8ffd4',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'AllowParentAssignees',
            'Allow Parent Assignees',
            NULL,
            'bit',
            1,
            1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8bd6abeb-25d4-41ab-95c9-d735c2a669cc' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'PlannedCloseAt')) BEGIN
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
            '8bd6abeb-25d4-41ab-95c9-d735c2a669cc',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'PlannedCloseAt',
            'Planned Close At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '342f0c2b-5263-4040-a882-d912fa7575b1' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'IconClass')) BEGIN
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
            '342f0c2b-5263-4040-a882-d912fa7575b1',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'IconClass',
            'Icon Class',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0fa840bf-1373-43da-a564-a861964a3634' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'Color')) BEGIN
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
            '0fa840bf-1373-43da-a564-a861964a3634',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'Color',
            'Color',
            NULL,
            'nvarchar',
            100,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5ee974ba-f0aa-4665-b056-82f447fd15a2' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'BackgroundImageURL')) BEGIN
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
            '5ee974ba-f0aa-4665-b056-82f447fd15a2',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'BackgroundImageURL',
            'Background Image URL',
            NULL,
            'nvarchar',
            2000,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '33419ea2-64c2-465d-9ab8-59f7f791bab2' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'Configuration')) BEGIN
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
            '33419ea2-64c2-465d-9ab8-59f7f791bab2',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'Configuration',
            'Configuration',
            NULL,
            'nvarchar',
            -1,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a66f0c0a-b17e-49a9-9149-68cbaca36d2e' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'AnchorEntityID')) BEGIN
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
            'a66f0c0a-b17e-49a9-9149-68cbaca36d2e',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'AnchorEntityID',
            'Anchor Entity ID',
            NULL,
            'uniqueidentifier',
            16,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b00a1123-0443-49d6-95d8-2718185713c8' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'AnchorRecordID')) BEGIN
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
            'b00a1123-0443-49d6-95d8-2718185713c8',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'AnchorRecordID',
            'Anchor Record ID',
            NULL,
            'nvarchar',
            900,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '14f46ec0-db9a-427f-a38d-e878ebb2af27' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'PostCloseAccess')) BEGIN
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
            '14f46ec0-db9a-427f-a38d-e878ebb2af27',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'PostCloseAccess',
            'Post Close Access',
            NULL,
            'nvarchar',
            40,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3aabc372-693e-4574-bc8d-dec034672a64' OR (EntityID = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57' AND Name = 'PostCloseAccessDays')) BEGIN
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
            '3aabc372-693e-4574-bc8d-dec034672a64',
            'CE573816-2129-4DCD-AAF4-FE837F1A0C57', -- Entity: MJ_BizApps_Collaboration_Examples: Example Boards
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'CE573816-2129-4DCD-AAF4-FE837F1A0C57'),
            'PostCloseAccessDays',
            'Post Close Access Days',
            NULL,
            'int',
            4,
            10,
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

/* SQL text to update existing entity fields from schema (2 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='CE573816-2129-4DCD-AAF4-FE837F1A0C57,C03A093E-6205-4392-8402-2D0C4D867AB5', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Update IS-A parent field SpaceTypeID on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='3F10F9D2-3297-49E3-A4E8-BE3BE1168E16';

/* Update IS-A parent field ParentID on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='A99DA16D-5EEC-47DC-AE83-7D0AAD017962';

/* Update IS-A parent field Name on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=400,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='B59136E3-BAF7-479B-A076-F2F315A59CA2';

/* Update IS-A parent field Description on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=-1,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='B1217E8F-9906-49E1-A57C-1379A106DE04';

/* Update IS-A parent field OwnerID on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='9734DE40-E014-4C38-8C20-F41C9485A4B8';

/* Update IS-A parent field InheritsMembership on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='bit',
                      [Length]=1,
                      [Precision]=1,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='0702028A-6928-4606-870F-93C49D4FB1AF';

/* Update IS-A parent field AgentRetrieval on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=60,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='2ABB28E4-2415-47E9-B48F-D7C425DBAE3E';

/* Update IS-A parent field StartedAt on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='datetimeoffset',
                      [Length]=10,
                      [Precision]=34,
                      [Scale]=7,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='B6B6CA71-F62E-4C1E-9E8E-0FBB5EE2CCFD';

/* Update IS-A parent field ClosedAt on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='datetimeoffset',
                      [Length]=10,
                      [Precision]=34,
                      [Scale]=7,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='2D8BF0B1-D302-46F7-8C2C-9B85C2437164';

/* Update IS-A parent field Retention on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=40,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='ED919B2D-B275-4A31-A7FC-CC20DE6E7048';

/* Update IS-A parent field AllowParentAssignees on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='bit',
                      [Length]=1,
                      [Precision]=1,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='77DF11AB-DD7C-4416-93EA-A163AFC8FFD4';

/* Update IS-A parent field PlannedCloseAt on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='datetimeoffset',
                      [Length]=10,
                      [Precision]=34,
                      [Scale]=7,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='8BD6ABEB-25D4-41AB-95C9-D735C2A669CC';

/* Update IS-A parent field IconClass on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=200,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='342F0C2B-5263-4040-A882-D912FA7575B1';

/* Update IS-A parent field Color on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=100,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='0FA840BF-1373-43DA-A564-A861964A3634';

/* Update IS-A parent field BackgroundImageURL on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=2000,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='5EE974BA-F0AA-4665-B056-82F447FD15A2';

/* Update IS-A parent field Configuration on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=-1,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='33419EA2-64C2-465D-9AB8-59F7F791BAB2';

/* Update IS-A parent field AnchorEntityID on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='A66F0C0A-B17E-49A9-9149-68CBACA36D2E';

/* Update IS-A parent field AnchorRecordID on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=900,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='B00A1123-0443-49D6-95D8-2718185713C8';

/* Update IS-A parent field PostCloseAccess on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=40,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='14F46EC0-DB9A-427F-A38D-E878EBB2AF27';

/* Update IS-A parent field PostCloseAccessDays on MJ_BizApps_Collaboration_Examples: Example Boards */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='int',
                      [Length]=4,
                      [Precision]=10,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='3AABC372-693E-4574-BC8D-DEC034672A64';

/* Update entity timestamp for MJ_BizApps_Collaboration_Examples: Example Boards after IS-A field sync */
UPDATE [${mjSchema}].[Entity] SET [__mj_UpdatedAt]=GETUTCDATE() WHERE ID='CE573816-2129-4DCD-AAF4-FE837F1A0C57';

/* Update IS-A parent field SpaceTypeID on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='1C5400D7-94F1-44BD-BA08-D7DF2C0AAAAD';

/* Update IS-A parent field ParentID on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='71317269-9413-4BFE-A3E5-D4005E6384B0';

/* Update IS-A parent field Name on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=400,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='76E00843-17F5-4C13-9AEA-1932B363A332';

/* Update IS-A parent field Description on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=-1,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='0A095728-41DA-4BCF-9E9C-AA520749EF83';

/* Update IS-A parent field OwnerID on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='49890F3B-62DD-4EED-9DA3-D617CFE15B00';

/* Update IS-A parent field InheritsMembership on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='bit',
                      [Length]=1,
                      [Precision]=1,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='675864D5-621E-416B-A1CE-B2FB3A8DCF37';

/* Update IS-A parent field AgentRetrieval on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=60,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='1E101296-14B1-4A00-93EE-4CC3C4CEE443';

/* Update IS-A parent field StartedAt on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='datetimeoffset',
                      [Length]=10,
                      [Precision]=34,
                      [Scale]=7,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='80773C3B-6A52-43F3-8CF3-7157AC1CF34F';

/* Update IS-A parent field ClosedAt on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='datetimeoffset',
                      [Length]=10,
                      [Precision]=34,
                      [Scale]=7,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='AC4BE99E-2B1A-47BA-BDB5-9F25ECAE6AF1';

/* Update IS-A parent field Retention on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=40,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='159D184D-E761-4385-A9A6-5AE7C0D652A8';

/* Update IS-A parent field AllowParentAssignees on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='bit',
                      [Length]=1,
                      [Precision]=1,
                      [Scale]=0,
                      [AllowsNull]=0,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='466A462E-8A17-4DE2-88DD-6FA744D253AC';

/* Update IS-A parent field PlannedCloseAt on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='datetimeoffset',
                      [Length]=10,
                      [Precision]=34,
                      [Scale]=7,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='7B9F2A09-3862-4942-9514-84FBCEAF6C0E';

/* Update IS-A parent field IconClass on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=200,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='1B16F0B4-7B42-490F-B3F1-303096872BA8';

/* Update IS-A parent field Color on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=100,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='14AB29DE-09D6-4157-8BA9-964B3FF6C98A';

/* Update IS-A parent field BackgroundImageURL on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=2000,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='0029E537-CFCC-4D0C-8094-C2B1FEB0F42D';

/* Update IS-A parent field Configuration on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=-1,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='F39EEA94-427C-4DFD-A26C-4C83C8F804F4';

/* Update IS-A parent field AnchorEntityID on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='uniqueidentifier',
                      [Length]=16,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='FF9DFD2A-5467-44AA-96E2-BEB28C127B8B';

/* Update IS-A parent field AnchorRecordID on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=900,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='146153C8-AAB2-4B24-8877-F00DE01ABD89';

/* Update IS-A parent field PostCloseAccess on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='nvarchar',
                      [Length]=40,
                      [Precision]=0,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='F5F7E437-CDEB-43E1-A651-E9199E8D56C7';

/* Update IS-A parent field PostCloseAccessDays on MJ_BizApps_Collaboration_Examples: Example Rooms */
UPDATE [${mjSchema}].[EntityField]
                  SET [IsVirtual]=1,
                      [Type]='int',
                      [Length]=4,
                      [Precision]=10,
                      [Scale]=0,
                      [AllowsNull]=1,
                      [AllowUpdateAPI]=1
                  WHERE [ID]='75B117D5-006E-442B-8690-EDB5D2D3F437';

/* Update entity timestamp for MJ_BizApps_Collaboration_Examples: Example Rooms after IS-A field sync */
UPDATE [${mjSchema}].[Entity] SET [__mj_UpdatedAt]=GETUTCDATE() WHERE ID='C03A093E-6205-4392-8402-2D0C4D867AB5';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

