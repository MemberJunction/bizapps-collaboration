-- ============================================================================
-- BizApps Collaboration: SpacePage table for built-in tab layouts & custom pages
-- ============================================================================

CREATE TABLE [${flyway:defaultSchema}].[SpacePage] (
    [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_SpacePage_ID] DEFAULT (newsequentialid()),
    [SpaceID] UNIQUEIDENTIFIER NOT NULL,
    [BuiltInTab] NVARCHAR(30) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Title] NVARCHAR(200) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL,
    [IconClass] NVARCHAR(100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [Band] NVARCHAR(10) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL CONSTRAINT [DF_SpacePage_Band] DEFAULT (N'Shared'),
    [Status] NVARCHAR(20) COLLATE SQL_Latin1_General_CP1_CI_AS NOT NULL CONSTRAINT [DF_SpacePage_Status] DEFAULT (N'Published'),
    [Sequence] INT NOT NULL CONSTRAINT [DF_SpacePage_Sequence] DEFAULT (0),
    [PublishedBlocks] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [DraftBlocks] NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [DraftTitle] NVARCHAR(200) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    [PublishedByUserID] UNIQUEIDENTIFIER NULL,
    [PublishedAt] DATETIMEOFFSET(7) NULL,
    CONSTRAINT [PK_SpacePage] PRIMARY KEY CLUSTERED ([ID]),
    CONSTRAINT [FK_SpacePage_Space] FOREIGN KEY ([SpaceID]) REFERENCES [${flyway:defaultSchema}].[Space] ([ID]),
    CONSTRAINT [FK_SpacePage_PublishedByUser] FOREIGN KEY ([PublishedByUserID]) REFERENCES [${mjSchema}].[User] ([ID]),
    CONSTRAINT [CK_SpacePage_BuiltInTab] CHECK ([BuiltInTab] IS NULL OR [BuiltInTab] IN (N'Overview', N'Library', N'Data', N'Work', N'Notes', N'People')),
    CONSTRAINT [CK_SpacePage_Band] CHECK ([Band]=N'Shared' OR [Band]=N'Team'),
    CONSTRAINT [CK_SpacePage_Status] CHECK ([Status]=N'Draft' OR [Status]=N'Published')
);
GO

CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpacePage_Space_BuiltInTab]
ON [${flyway:defaultSchema}].[SpacePage] ([SpaceID], [BuiltInTab])
WHERE ([BuiltInTab] IS NOT NULL);
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'A customizable block-canvas page in a space: either the saved block layout for a built-in tab (BuiltInTab set) or a custom page in the space''s Pages tab (BuiltInTab null).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The space this page belongs to.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'SpaceID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The built-in tab this page lays out (Overview, Library, Data, Work, Notes, or People), or null for a custom page.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'BuiltInTab';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The published title of the page.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'Title';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Font Awesome icon class displayed beside the page title in the page rail and header.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'IconClass';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Team or Shared: who in the space may read the page. A Shared page never moves back to Team.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'Band';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Draft or Published lifecycle state of the page.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'Status';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Display order among pages in the space.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'Sequence';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JSON array of published canvas blocks (id, type, title, width, body, and block-specific properties).', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'PublishedBlocks';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'JSON array of unpublished draft canvas blocks while a draft is in progress.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'DraftBlocks';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'Unpublished draft title while a draft is in progress.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'DraftTitle';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'The user who most recently published this page.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'PublishedByUserID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'When this page was most recently published.', @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}', @level1type = N'TABLE', @level1name = N'SpacePage', @level2type = N'COLUMN', @level2name = N'PublishedAt';
GO

/**************************************************************************************************
 * CODEGEN OUTPUT
 **************************************************************************************************/
/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Pages */

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
         [AllowCaching],
         [TrackRecordChanges],
         [AuditRecordAccess],
         [AuditViewRuns],
         [AllowAllRowsAPI],
         [AllowCreateAPI],
         [AllowUpdateAPI],
         [AllowDeleteAPI],
         [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         'efe52365-941e-4a5a-b6e3-6733013ec9e3',
         'MJ_BizApps_Collaboration: Space Pages',
         'Space Pages',
         'A customizable block-canvas page in a space: either the saved block layout for a built-in tab (BuiltInTab set) or a custom page in the space''s Pages tab (BuiltInTab null).',
         NULL,
         'SpacePage',
         'vwSpacePages',
         '${flyway:defaultSchema}',
         1,
         1,
         0,
         1,
         0,
         0,
         0,
         1,
         1,
         1,
         1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add entity MJ_BizApps_Collaboration: Space Pages to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                    ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                    ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'efe52365-941e-4a5a-b6e3-6733013ec9e3', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Pages for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('efe52365-941e-4a5a-b6e3-6733013ec9e3' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('efe52365-941e-4a5a-b6e3-6733013ec9e3' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Pages for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('efe52365-941e-4a5a-b6e3-6733013ec9e3' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('efe52365-941e-4a5a-b6e3-6733013ec9e3' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Pages for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('efe52365-941e-4a5a-b6e3-6733013ec9e3' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('efe52365-941e-4a5a-b6e3-6733013ec9e3' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';


/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpacePage */
ALTER TABLE [${flyway:defaultSchema}].[SpacePage] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpacePage */
UPDATE [${flyway:defaultSchema}].[SpacePage] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpacePage */
ALTER TABLE [${flyway:defaultSchema}].[SpacePage] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.SpacePage */
ALTER TABLE [${flyway:defaultSchema}].[SpacePage] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpacePage___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpacePage */
ALTER TABLE [${flyway:defaultSchema}].[SpacePage] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpacePage */
UPDATE [${flyway:defaultSchema}].[SpacePage] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpacePage */
ALTER TABLE [${flyway:defaultSchema}].[SpacePage] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.SpacePage */
ALTER TABLE [${flyway:defaultSchema}].[SpacePage] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpacePage___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 15 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b09befb9-48b1-4f99-b501-e3e521ccf5d6' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'ID')) BEGIN
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
            'b09befb9-48b1-4f99-b501-e3e521ccf5d6',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c7e316d5-d4d6-45be-b907-9829c2eaf237' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'SpaceID')) BEGIN
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
            'c7e316d5-d4d6-45be-b907-9829c2eaf237',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'SpaceID',
            'Space ID',
            'The space this page belongs to.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3a50ac92-7b75-4f19-873f-bccb0b4641f5' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'BuiltInTab')) BEGIN
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
            '3a50ac92-7b75-4f19-873f-bccb0b4641f5',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'BuiltInTab',
            'Built In Tab',
            'The built-in tab this page lays out (Overview, Library, Data, Work, Notes, or People), or null for a custom page.',
            'nvarchar',
            60,
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
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '744b77d4-7545-408a-ae99-f2c767f22bc3' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'Title')) BEGIN
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
            '744b77d4-7545-408a-ae99-f2c767f22bc3',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'Title',
            'Title',
            'The published title of the page.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3703a479-0ab3-4623-a36a-1eb05a0d765c' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'IconClass')) BEGIN
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
            '3703a479-0ab3-4623-a36a-1eb05a0d765c',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'IconClass',
            'Icon Class',
            'Font Awesome icon class displayed beside the page title in the page rail and header.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5f087a4e-b521-4319-80c0-d3973c8f634b' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'Band')) BEGIN
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
            '5f087a4e-b521-4319-80c0-d3973c8f634b',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'Band',
            'Band',
            'Team or Shared: who in the space may read the page. A Shared page never moves back to Team.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8a9fe4df-9181-414a-9606-bf482d2248d6' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'Status')) BEGIN
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
            '8a9fe4df-9181-414a-9606-bf482d2248d6',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'Status',
            'Status',
            'Draft or Published lifecycle state of the page.',
            'nvarchar',
            40,
            0,
            0,
            0,
            'Published',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e20c7960-1cd9-4965-a983-95932770c839' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'Sequence')) BEGIN
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
            'e20c7960-1cd9-4965-a983-95932770c839',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'Sequence',
            'Sequence',
            'Display order among pages in the space.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '390a7fff-30ff-49e9-8de0-4f80e4754c6d' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'PublishedBlocks')) BEGIN
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
            '390a7fff-30ff-49e9-8de0-4f80e4754c6d',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'PublishedBlocks',
            'Published Blocks',
            'JSON array of published canvas blocks (id, type, title, width, body, and block-specific properties).',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c0916779-b847-495d-8fc4-755afb7ba061' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'DraftBlocks')) BEGIN
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
            'c0916779-b847-495d-8fc4-755afb7ba061',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'DraftBlocks',
            'Draft Blocks',
            'JSON array of unpublished draft canvas blocks while a draft is in progress.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '80e15a26-14b9-4352-b7de-dce07d75ed2a' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'DraftTitle')) BEGIN
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
            '80e15a26-14b9-4352-b7de-dce07d75ed2a',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'DraftTitle',
            'Draft Title',
            'Unpublished draft title while a draft is in progress.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '84a627da-4736-483b-86db-3827b83d28e2' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'PublishedByUserID')) BEGIN
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
            '84a627da-4736-483b-86db-3827b83d28e2',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'PublishedByUserID',
            'Published By User ID',
            'The user who most recently published this page.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9b5a583a-37a0-41f7-a3f4-1247f7a819b6' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'PublishedAt')) BEGIN
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
            '9b5a583a-37a0-41f7-a3f4-1247f7a819b6',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'PublishedAt',
            'Published At',
            'When this page was most recently published.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3993eb8b-6992-4bf1-836c-8448769041c2' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = '__mj_CreatedAt')) BEGIN
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
            '3993eb8b-6992-4bf1-836c-8448769041c2',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2fdd7192-d0e6-47a4-a0d6-8911f034572a' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '2fdd7192-d0e6-47a4-a0d6-8911f034572a',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
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

/* SQL text to insert entity field value with ID af30dba4-bc00-4c63-9fa2-b6d27a5375ec */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('af30dba4-bc00-4c63-9fa2-b6d27a5375ec', '3A50AC92-7B75-4F19-873F-BCCB0B4641F5', 1, 'Data', 'Data', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 323c0309-75ca-43fd-b5a1-c9534948715d */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('323c0309-75ca-43fd-b5a1-c9534948715d', '3A50AC92-7B75-4F19-873F-BCCB0B4641F5', 2, 'Library', 'Library', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID e3e954a2-fced-4875-b9a4-0c56070b50bc */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('e3e954a2-fced-4875-b9a4-0c56070b50bc', '3A50AC92-7B75-4F19-873F-BCCB0B4641F5', 3, 'Notes', 'Notes', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 733073ae-98f7-4da4-b648-f2ae3fcdb9a8 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('733073ae-98f7-4da4-b648-f2ae3fcdb9a8', '3A50AC92-7B75-4F19-873F-BCCB0B4641F5', 4, 'Overview', 'Overview', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID b2ab2e0d-fc49-40b8-a6c4-279f35ebb3e9 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('b2ab2e0d-fc49-40b8-a6c4-279f35ebb3e9', '3A50AC92-7B75-4F19-873F-BCCB0B4641F5', 5, 'People', 'People', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID faa4b9cd-d18b-466e-a9d7-eefd99ac2994 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('faa4b9cd-d18b-466e-a9d7-eefd99ac2994', '3A50AC92-7B75-4F19-873F-BCCB0B4641F5', 6, 'Work', 'Work', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 3A50AC92-7B75-4F19-873F-BCCB0B4641F5 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='3A50AC92-7B75-4F19-873F-BCCB0B4641F5';

/* SQL text to insert entity field value with ID a7323627-654a-460f-acde-fc2110d235a4 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('a7323627-654a-460f-acde-fc2110d235a4', '5F087A4E-B521-4319-80C0-D3973C8F634B', 1, 'Shared', 'Shared', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID b88cb476-5992-4d86-9f53-63c05fec9abc */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('b88cb476-5992-4d86-9f53-63c05fec9abc', '5F087A4E-B521-4319-80C0-D3973C8F634B', 2, 'Team', 'Team', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 5F087A4E-B521-4319-80C0-D3973C8F634B */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='5F087A4E-B521-4319-80C0-D3973C8F634B';

/* SQL text to insert entity field value with ID 1ff5fe3c-36ec-4494-a2ad-504fc5f2019a */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('1ff5fe3c-36ec-4494-a2ad-504fc5f2019a', '8A9FE4DF-9181-414A-9606-BF482D2248D6', 1, 'Draft', 'Draft', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 2c9996d1-b640-48ac-899d-6460e56732b8 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('2c9996d1-b640-48ac-899d-6460e56732b8', '8A9FE4DF-9181-414A-9606-BF482D2248D6', 2, 'Published', 'Published', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID 8A9FE4DF-9181-414A-9606-BF482D2248D6 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='8A9FE4DF-9181-414A-9606-BF482D2248D6';

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
                 AND e.[SchemaName] NOT IN ('sys','staging','dbo','${mjSchema}','__mj_BizAppsCollabExamples','__mj_BizAppsCommon','__mj_BizAppsTasks')
                 AND NOT EXISTS (
               SELECT 1 FROM [${mjSchema}].[EntityField] f2
               WHERE f2.[EntityID] = e.[ID]
                 AND f2.[IncludeInUserSearchAPI] = 1
            )
            ) ranked
            WHERE ranked.rn <= 3
         );


/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Pages (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'ce911b4e-f01b-4c68-b2e4-401d4699f7a1' OR ([EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND [RelatedEntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND [RelatedEntityJoinField] = 'SpaceID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('ce911b4e-f01b-4c68-b2e4-401d4699f7a1', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'EFE52365-941E-4A5A-B6E3-6733013EC9E3', 'SpaceID', 'One To Many', 1, 1, 12, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Collaboration: Space Pages (One To Many via PublishedByUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'ce98dc6f-4d27-4941-9239-e53f2e936295' OR ([EntityID] = 'E1238F34-2837-EF11-86D4-6045BDEE16E6' AND [RelatedEntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND [RelatedEntityJoinField] = 'PublishedByUserID')
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('ce98dc6f-4d27-4941-9239-e53f2e936295', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'EFE52365-941E-4A5A-B6E3-6733013EC9E3', 'PublishedByUserID', 'One To Many', 1, 1, 138, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for SpacePage */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Pages
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table SpacePage
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpacePage_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpacePage]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpacePage_SpaceID ON [${flyway:defaultSchema}].[SpacePage] ([SpaceID]);

-- Index for foreign key PublishedByUserID in table SpacePage
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpacePage_PublishedByUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpacePage]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpacePage_PublishedByUserID ON [${flyway:defaultSchema}].[SpacePage] ([PublishedByUserID]);

/* SQL text to update entity field related entity name field map for entity field ID C7E316D5-D4D6-45BE-B907-9829C2EAF237 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='C7E316D5-D4D6-45BE-B907-9829C2EAF237', @RelatedEntityNameFieldMap='Space';

/* SQL text to update entity field related entity name field map for entity field ID 84A627DA-4736-483B-86DB-3827B83D28E2 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='84A627DA-4736-483B-86DB-3827B83D28E2', @RelatedEntityNameFieldMap='PublishedByUser';


/* Base View SQL for MJ_BizApps_Collaboration: Space Pages */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Pages
-- Item: vwSpacePages
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Pages
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpacePage
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpacePages]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpacePages];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpacePages]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_PublishedByUserID.[Name] AS [PublishedByUser]
FROM
    [${flyway:defaultSchema}].[SpacePage] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[User] AS MJUser_PublishedByUserID
  ON
    [s].[PublishedByUserID] = MJUser_PublishedByUserID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpacePages] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Pages */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Pages
-- Item: Permissions for vwSpacePages
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpacePages] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Pages */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Pages
-- Item: spCreateSpacePage
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpacePage
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpacePage]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpacePage];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpacePage]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @BuiltInTab_Clear bit = 0,
    @BuiltInTab nvarchar(30) = NULL,
    @Title nvarchar(200),
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Band nvarchar(10) = NULL,
    @Status nvarchar(20) = NULL,
    @Sequence int = NULL,
    @PublishedBlocks_Clear bit = 0,
    @PublishedBlocks nvarchar(MAX) = NULL,
    @DraftBlocks_Clear bit = 0,
    @DraftBlocks nvarchar(MAX) = NULL,
    @DraftTitle_Clear bit = 0,
    @DraftTitle nvarchar(200) = NULL,
    @PublishedByUserID_Clear bit = 0,
    @PublishedByUserID uniqueidentifier = NULL,
    @PublishedAt_Clear bit = 0,
    @PublishedAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpacePage]
            (
                [ID],
                [SpaceID],
                [BuiltInTab],
                [Title],
                [IconClass],
                [Band],
                [Status],
                [Sequence],
                [PublishedBlocks],
                [DraftBlocks],
                [DraftTitle],
                [PublishedByUserID],
                [PublishedAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                CASE WHEN @BuiltInTab_Clear = 1 THEN NULL ELSE ISNULL(@BuiltInTab, NULL) END,
                @Title,
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                ISNULL(@Band, 'Shared'),
                ISNULL(@Status, 'Published'),
                ISNULL(@Sequence, 0),
                CASE WHEN @PublishedBlocks_Clear = 1 THEN NULL ELSE ISNULL(@PublishedBlocks, NULL) END,
                CASE WHEN @DraftBlocks_Clear = 1 THEN NULL ELSE ISNULL(@DraftBlocks, NULL) END,
                CASE WHEN @DraftTitle_Clear = 1 THEN NULL ELSE ISNULL(@DraftTitle, NULL) END,
                CASE WHEN @PublishedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PublishedByUserID, NULL) END,
                CASE WHEN @PublishedAt_Clear = 1 THEN NULL ELSE ISNULL(@PublishedAt, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpacePage]
            (
                [SpaceID],
                [BuiltInTab],
                [Title],
                [IconClass],
                [Band],
                [Status],
                [Sequence],
                [PublishedBlocks],
                [DraftBlocks],
                [DraftTitle],
                [PublishedByUserID],
                [PublishedAt]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                CASE WHEN @BuiltInTab_Clear = 1 THEN NULL ELSE ISNULL(@BuiltInTab, NULL) END,
                @Title,
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                ISNULL(@Band, 'Shared'),
                ISNULL(@Status, 'Published'),
                ISNULL(@Sequence, 0),
                CASE WHEN @PublishedBlocks_Clear = 1 THEN NULL ELSE ISNULL(@PublishedBlocks, NULL) END,
                CASE WHEN @DraftBlocks_Clear = 1 THEN NULL ELSE ISNULL(@DraftBlocks, NULL) END,
                CASE WHEN @DraftTitle_Clear = 1 THEN NULL ELSE ISNULL(@DraftTitle, NULL) END,
                CASE WHEN @PublishedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PublishedByUserID, NULL) END,
                CASE WHEN @PublishedAt_Clear = 1 THEN NULL ELSE ISNULL(@PublishedAt, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpacePages] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpacePage] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Pages */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpacePage] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Pages */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Pages
-- Item: spUpdateSpacePage
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpacePage
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpacePage]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpacePage];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpacePage]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @BuiltInTab_Clear bit = 0,
    @BuiltInTab nvarchar(30) = NULL,
    @Title nvarchar(200) = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Band nvarchar(10) = NULL,
    @Status nvarchar(20) = NULL,
    @Sequence int = NULL,
    @PublishedBlocks_Clear bit = 0,
    @PublishedBlocks nvarchar(MAX) = NULL,
    @DraftBlocks_Clear bit = 0,
    @DraftBlocks nvarchar(MAX) = NULL,
    @DraftTitle_Clear bit = 0,
    @DraftTitle nvarchar(200) = NULL,
    @PublishedByUserID_Clear bit = 0,
    @PublishedByUserID uniqueidentifier = NULL,
    @PublishedAt_Clear bit = 0,
    @PublishedAt datetimeoffset = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpacePage]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [BuiltInTab] = CASE WHEN @BuiltInTab_Clear = 1 THEN NULL ELSE ISNULL(@BuiltInTab, [BuiltInTab]) END,
        [Title] = ISNULL(@Title, [Title]),
        [IconClass] = CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, [IconClass]) END,
        [Band] = ISNULL(@Band, [Band]),
        [Status] = ISNULL(@Status, [Status]),
        [Sequence] = ISNULL(@Sequence, [Sequence]),
        [PublishedBlocks] = CASE WHEN @PublishedBlocks_Clear = 1 THEN NULL ELSE ISNULL(@PublishedBlocks, [PublishedBlocks]) END,
        [DraftBlocks] = CASE WHEN @DraftBlocks_Clear = 1 THEN NULL ELSE ISNULL(@DraftBlocks, [DraftBlocks]) END,
        [DraftTitle] = CASE WHEN @DraftTitle_Clear = 1 THEN NULL ELSE ISNULL(@DraftTitle, [DraftTitle]) END,
        [PublishedByUserID] = CASE WHEN @PublishedByUserID_Clear = 1 THEN NULL ELSE ISNULL(@PublishedByUserID, [PublishedByUserID]) END,
        [PublishedAt] = CASE WHEN @PublishedAt_Clear = 1 THEN NULL ELSE ISNULL(@PublishedAt, [PublishedAt]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpacePages] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpacePages]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpacePage] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpacePage table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpacePage]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpacePage];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpacePage
ON [${flyway:defaultSchema}].[SpacePage]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpacePage]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpacePage] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Pages */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpacePage] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Pages */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Pages
-- Item: spDeleteSpacePage
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpacePage
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpacePage]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpacePage];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpacePage]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpacePage]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpacePage] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Pages */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpacePage] TO [cdp_Developer], [cdp_Integration];


      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4852a657-0bda-4783-911f-be2c13f33d86' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'Space')) BEGIN
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
            '4852a657-0bda-4783-911f-be2c13f33d86',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7a39369d-2b83-462f-9523-d53851dc60ba' OR (EntityID = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3' AND Name = 'PublishedByUser')) BEGIN
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
            '7a39369d-2b83-462f-9523-d53851dc60ba',
            'EFE52365-941E-4A5A-B6E3-6733013EC9E3', -- Entity: MJ_BizApps_Collaboration: Space Pages
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'EFE52365-941E-4A5A-B6E3-6733013EC9E3'),
            'PublishedByUser',
            'Published By User',
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

/* SQL text to update existing entity fields from schema (2 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='EFE52365-941E-4A5A-B6E3-6733013EC9E3', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';


