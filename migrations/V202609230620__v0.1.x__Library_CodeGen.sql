-- CodeGen capture for Share Notices, Item Uses, and SpaceItem.Folder.
-- The tables, the Folder column, and the two read filters already exist.
-- This file is the metadata, views, and procedures CodeGen emitted.
-- Table descriptions are the previous migration. The metadata refresh after
-- this file copies them onto the entity rows. Participant filters are next.
-- Developer and Integration stay unfiltered.



















































-- =============================================================================
-- =============================================================================
--
--   >>>  CODEGEN OUTPUT — GENERATED CODE BELOW THIS LINE. DO NOT EDIT BY HAND.
--
--   Folded from migrations/codegen/CodeGen_Run_2026-09-23_15-15-44.sql.
--   Re-run CodeGen and replace everything below this banner.
--   The hand-authored note above is preserved.
--
-- =============================================================================
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Collaboration: Share Notices */

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
         'aec10b96-8d9e-485a-9aaf-968e3105b506',
         'MJ_BizApps_Collaboration: Share Notices',
         'Share Notices',
         NULL,
         NULL,
         'ShareNotice',
         'vwShareNotices',
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

/* SQL generated to add new entity MJ_BizApps_Collaboration: Share Notices to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'aec10b96-8d9e-485a-9aaf-968e3105b506', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Share Notices for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('aec10b96-8d9e-485a-9aaf-968e3105b506' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('aec10b96-8d9e-485a-9aaf-968e3105b506' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Share Notices for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('aec10b96-8d9e-485a-9aaf-968e3105b506' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('aec10b96-8d9e-485a-9aaf-968e3105b506' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Share Notices for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('aec10b96-8d9e-485a-9aaf-968e3105b506' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('aec10b96-8d9e-485a-9aaf-968e3105b506' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Item Uses */

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
         '30a2c585-555b-4cdb-bff6-5a5e84ead2af',
         'MJ_BizApps_Collaboration: Item Uses',
         'Item Uses',
         NULL,
         NULL,
         'ItemUse',
         'vwItemUses',
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

/* SQL generated to add new entity MJ_BizApps_Collaboration: Item Uses to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '30a2c585-555b-4cdb-bff6-5a5e84ead2af', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Item Uses for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('30a2c585-555b-4cdb-bff6-5a5e84ead2af' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('30a2c585-555b-4cdb-bff6-5a5e84ead2af' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Item Uses for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('30a2c585-555b-4cdb-bff6-5a5e84ead2af' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('30a2c585-555b-4cdb-bff6-5a5e84ead2af' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Item Uses for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('30a2c585-555b-4cdb-bff6-5a5e84ead2af' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('30a2c585-555b-4cdb-bff6-5a5e84ead2af' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ItemUse */
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ItemUse */
UPDATE [${flyway:defaultSchema}].[ItemUse] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ItemUse */
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ItemUse */
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_ItemUse___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ItemUse */
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ItemUse */
UPDATE [${flyway:defaultSchema}].[ItemUse] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ItemUse */
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ItemUse */
ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_ItemUse___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ShareNotice */
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD [__mj_CreatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ShareNotice */
UPDATE [${flyway:defaultSchema}].[ShareNotice] SET [__mj_CreatedAt] = GETUTCDATE() WHERE [__mj_CreatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ShareNotice */
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ALTER COLUMN [__mj_CreatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_CreatedAt to entity ${flyway:defaultSchema}.ShareNotice */
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_ShareNotice___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ShareNotice */
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD [__mj_UpdatedAt] DATETIMEOFFSET NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ShareNotice */
UPDATE [${flyway:defaultSchema}].[ShareNotice] SET [__mj_UpdatedAt] = GETUTCDATE() WHERE [__mj_UpdatedAt] IS NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ShareNotice */
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ALTER COLUMN [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL;
GO

/* SQL text to add special date field __mj_UpdatedAt to entity ${flyway:defaultSchema}.ShareNotice */
ALTER TABLE [${flyway:defaultSchema}].[ShareNotice] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_ShareNotice___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];
GO

/* SQL text to insert 15 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ffb8109c-c1f4-4df4-97ae-6bacf7e6a095' OR (EntityID = '41165FEC-A52B-469A-A880-3B108C39A65E' AND Name = 'Folder')) BEGIN
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
            'ffb8109c-c1f4-4df4-97ae-6bacf7e6a095',
            '41165FEC-A52B-469A-A880-3B108C39A65E', -- Entity: MJ_BizApps_Collaboration: Space Items
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '41165FEC-A52B-469A-A880-3B108C39A65E'),
            'Folder',
            'Folder',
            'Folder label inside the space. Null means Unfiled. Collections cannot say everyone in the space, so the folder lives on the item.',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '933f62a7-c2e6-430a-b91b-348e77a991d9' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = 'ID')) BEGIN
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
            '933f62a7-c2e6-430a-b91b-348e77a991d9',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b536e74f-d6ba-481f-b8de-d2ab2619669b' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = 'ItemID')) BEGIN
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
            'b536e74f-d6ba-481f-b8de-d2ab2619669b',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
            'ItemID',
            'Item ID',
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
            '41165FEC-A52B-469A-A880-3B108C39A65E',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e6794a01-1526-40a6-a1ae-be4940b6a495' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = 'UserID')) BEGIN
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
            'e6794a01-1526-40a6-a1ae-be4940b6a495',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
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
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '146cdeda-c97c-4bc9-b17c-b1a1417b5eb5' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = 'UsedAt')) BEGIN
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
            '146cdeda-c97c-4bc9-b17c-b1a1417b5eb5',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
            'UsedAt',
            'Used At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f1850061-8742-4cc6-a6c9-fccf557d9eb1' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = 'Kind')) BEGIN
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
            'f1850061-8742-4cc6-a6c9-fccf557d9eb1',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
            'Kind',
            'Kind',
            NULL,
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '83607058-bc03-4a4f-8283-064f88a6824e' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = 'SpaceID')) BEGIN
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
            '83607058-bc03-4a4f-8283-064f88a6824e',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3b917508-c5fa-4c2d-aba7-d1e72cfe24fe' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = '__mj_CreatedAt')) BEGIN
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
            '3b917508-c5fa-4c2d-aba7-d1e72cfe24fe',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5852f3a9-e974-4fc0-bd5d-9aa00bf79c8b' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = '__mj_UpdatedAt')) BEGIN
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
            '5852f3a9-e974-4fc0-bd5d-9aa00bf79c8b',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7c65c7ab-bd2a-4ef1-b7dd-27db69c522ed' OR (EntityID = 'AEC10B96-8D9E-485A-9AAF-968E3105B506' AND Name = 'ID')) BEGIN
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
            '7c65c7ab-bd2a-4ef1-b7dd-27db69c522ed',
            'AEC10B96-8D9E-485A-9AAF-968E3105B506', -- Entity: MJ_BizApps_Collaboration: Share Notices
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'AEC10B96-8D9E-485A-9AAF-968E3105B506'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c51d518d-d106-4403-857a-9c2f9c59e53f' OR (EntityID = 'AEC10B96-8D9E-485A-9AAF-968E3105B506' AND Name = 'SpaceID')) BEGIN
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
            'c51d518d-d106-4403-857a-9c2f9c59e53f',
            'AEC10B96-8D9E-485A-9AAF-968E3105B506', -- Entity: MJ_BizApps_Collaboration: Share Notices
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'AEC10B96-8D9E-485A-9AAF-968E3105B506'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8d1219c0-03ab-4282-b12d-7f1c9264cc5a' OR (EntityID = 'AEC10B96-8D9E-485A-9AAF-968E3105B506' AND Name = 'ItemID')) BEGIN
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
            '8d1219c0-03ab-4282-b12d-7f1c9264cc5a',
            'AEC10B96-8D9E-485A-9AAF-968E3105B506', -- Entity: MJ_BizApps_Collaboration: Share Notices
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'AEC10B96-8D9E-485A-9AAF-968E3105B506'),
            'ItemID',
            'Item ID',
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
            '41165FEC-A52B-469A-A880-3B108C39A65E',
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c51f17dc-ee2a-44a2-b454-b1e8513f6fb7' OR (EntityID = 'AEC10B96-8D9E-485A-9AAF-968E3105B506' AND Name = 'RecipientUserID')) BEGIN
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
            'c51f17dc-ee2a-44a2-b454-b1e8513f6fb7',
            'AEC10B96-8D9E-485A-9AAF-968E3105B506', -- Entity: MJ_BizApps_Collaboration: Share Notices
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'AEC10B96-8D9E-485A-9AAF-968E3105B506'),
            'RecipientUserID',
            'Recipient User ID',
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
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '9c96f52b-f438-4d1e-90fb-8566722fb847' OR (EntityID = 'AEC10B96-8D9E-485A-9AAF-968E3105B506' AND Name = '__mj_CreatedAt')) BEGIN
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
            '9c96f52b-f438-4d1e-90fb-8566722fb847',
            'AEC10B96-8D9E-485A-9AAF-968E3105B506', -- Entity: MJ_BizApps_Collaboration: Share Notices
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'AEC10B96-8D9E-485A-9AAF-968E3105B506'),
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
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'abb1dac4-0d22-4ea2-94a3-279eb30484b7' OR (EntityID = 'AEC10B96-8D9E-485A-9AAF-968E3105B506' AND Name = '__mj_UpdatedAt')) BEGIN
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
            'abb1dac4-0d22-4ea2-94a3-279eb30484b7',
            'AEC10B96-8D9E-485A-9AAF-968E3105B506', -- Entity: MJ_BizApps_Collaboration: Share Notices
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'AEC10B96-8D9E-485A-9AAF-968E3105B506'),
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

/* SQL text to insert entity field value with ID c42a8810-91e1-427e-b822-7adcc0f3c6be */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('c42a8810-91e1-427e-b822-7adcc0f3c6be', 'F1850061-8742-4CC6-A6C9-FCCF557D9EB1', 1, 'open', 'open', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID f6016a18-9615-475f-9924-e10e8b188cca */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('f6016a18-9615-475f-9924-e10e8b188cca', 'F1850061-8742-4CC6-A6C9-FCCF557D9EB1', 2, 'promote', 'promote', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 3cb0da6e-eae7-4b2f-9228-c9b9db1c0a22 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('3cb0da6e-eae7-4b2f-9228-c9b9db1c0a22', 'F1850061-8742-4CC6-A6C9-FCCF557D9EB1', 3, 'upload', 'upload', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID F1850061-8742-4CC6-A6C9-FCCF557D9EB1 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='F1850061-8742-4CC6-A6C9-FCCF557D9EB1';


/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Items -> MJ_BizApps_Collaboration: Item Uses (One To Many via ItemID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e61fbb1a-c900-4d7e-83c7-31cc8c92f18f'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('e61fbb1a-c900-4d7e-83c7-31cc8c92f18f', '41165FEC-A52B-469A-A880-3B108C39A65E', '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 'ItemID', 'One To Many', 1, 1, 1, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Items -> MJ_BizApps_Collaboration: Share Notices (One To Many via ItemID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '6bb84812-9924-43f1-8670-cd1684673945'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('6bb84812-9924-43f1-8670-cd1684673945', '41165FEC-A52B-469A-A880-3B108C39A65E', 'AEC10B96-8D9E-485A-9AAF-968E3105B506', 'ItemID', 'One To Many', 1, 1, 2, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Item Uses (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '2a138611-5a86-48ba-9d19-96e5b0cae4fa'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('2a138611-5a86-48ba-9d19-96e5b0cae4fa', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 'SpaceID', 'One To Many', 1, 1, 4, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Share Notices (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '81a26308-c7b8-4979-adf2-f4218fe28da2'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('81a26308-c7b8-4979-adf2-f4218fe28da2', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'AEC10B96-8D9E-485A-9AAF-968E3105B506', 'SpaceID', 'One To Many', 1, 1, 5, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Collaboration: Item Uses (One To Many via UserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '30afa998-d738-4003-a04b-ad11520f4011'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('30afa998-d738-4003-a04b-ad11520f4011', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', 'UserID', 'One To Many', 1, 1, 124, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Users -> MJ_BizApps_Collaboration: Share Notices (One To Many via RecipientUserID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '330d4906-ce10-453e-a9d6-aeecaba6d70f'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('330d4906-ce10-453e-a9d6-aeecaba6d70f', 'E1238F34-2837-EF11-86D4-6045BDEE16E6', 'AEC10B96-8D9E-485A-9AAF-968E3105B506', 'RecipientUserID', 'One To Many', 1, 1, 125, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for ItemUse */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Item Uses
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key ItemID in table ItemUse
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_ItemUse_ItemID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[ItemUse]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_ItemUse_ItemID ON [${flyway:defaultSchema}].[ItemUse] ([ItemID]);

-- Index for foreign key UserID in table ItemUse
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_ItemUse_UserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[ItemUse]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_ItemUse_UserID ON [${flyway:defaultSchema}].[ItemUse] ([UserID]);

-- Index for foreign key SpaceID in table ItemUse
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_ItemUse_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[ItemUse]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_ItemUse_SpaceID ON [${flyway:defaultSchema}].[ItemUse] ([SpaceID]);

/* SQL text to update entity field related entity name field map for entity field ID E6794A01-1526-40A6-A1AE-BE4940B6A495 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='E6794A01-1526-40A6-A1AE-BE4940B6A495', @RelatedEntityNameFieldMap='User';

/* Index for Foreign Keys for ShareNotice */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Share Notices
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table ShareNotice
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_ShareNotice_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[ShareNotice]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_ShareNotice_SpaceID ON [${flyway:defaultSchema}].[ShareNotice] ([SpaceID]);

-- Index for foreign key ItemID in table ShareNotice
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_ShareNotice_ItemID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[ShareNotice]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_ShareNotice_ItemID ON [${flyway:defaultSchema}].[ShareNotice] ([ItemID]);

-- Index for foreign key RecipientUserID in table ShareNotice
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_ShareNotice_RecipientUserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[ShareNotice]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_ShareNotice_RecipientUserID ON [${flyway:defaultSchema}].[ShareNotice] ([RecipientUserID]);

/* SQL text to update entity field related entity name field map for entity field ID C51D518D-D106-4403-857A-9C2F9C59E53F */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='C51D518D-D106-4403-857A-9C2F9C59E53F', @RelatedEntityNameFieldMap='Space';

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
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_Integration]
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

REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceItems] FROM [cdp_Integration]
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
    @Folder nvarchar(200) = NULL
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
                [Folder]
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
                CASE WHEN @Folder_Clear = 1 THEN NULL ELSE ISNULL(@Folder, NULL) END
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
                [Folder]
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
                CASE WHEN @Folder_Clear = 1 THEN NULL ELSE ISNULL(@Folder, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceItems] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Items */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceItem] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

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
    @Folder nvarchar(200) = NULL
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
        [Folder] = CASE WHEN @Folder_Clear = 1 THEN NULL ELSE ISNULL(@Folder, [Folder]) END
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] TO [cdp_UI], [cdp_Developer], [cdp_Integration]
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceItem] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

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

/* SQL text to update entity field related entity name field map for entity field ID 83607058-BC03-4A4F-8283-064F88A6824E */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='83607058-BC03-4A4F-8283-064F88A6824E', @RelatedEntityNameFieldMap='Space';

/* SQL text to update entity field related entity name field map for entity field ID C51F17DC-EE2A-44A2-B454-B1E8513F6FB7 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='C51F17DC-EE2A-44A2-B454-B1E8513F6FB7', @RelatedEntityNameFieldMap='RecipientUser';

/* Base View SQL for MJ_BizApps_Collaboration: Item Uses */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Item Uses
-- Item: vwItemUses
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Item Uses
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  ItemUse
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwItemUses]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwItemUses];
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
GRANT SELECT ON [${flyway:defaultSchema}].[vwItemUses] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Item Uses */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Item Uses
-- Item: Permissions for vwItemUses
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwItemUses] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Item Uses */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Item Uses
-- Item: spCreateItemUse
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR ItemUse
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateItemUse]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateItemUse];
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateItemUse] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Item Uses */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateItemUse] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Item Uses */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Item Uses
-- Item: spUpdateItemUse
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR ItemUse
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateItemUse]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateItemUse];
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

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateItemUse] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the ItemUse table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateItemUse]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateItemUse];
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

/* spUpdate Permissions for MJ_BizApps_Collaboration: Item Uses */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateItemUse] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Item Uses */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Item Uses
-- Item: spDeleteItemUse
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR ItemUse
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteItemUse]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteItemUse];
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteItemUse] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Item Uses */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteItemUse] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Share Notices */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Share Notices
-- Item: vwShareNotices
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Share Notices
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  ShareNotice
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwShareNotices]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwShareNotices];
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
GRANT SELECT ON [${flyway:defaultSchema}].[vwShareNotices] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Share Notices */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Share Notices
-- Item: Permissions for vwShareNotices
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwShareNotices] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Share Notices */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Share Notices
-- Item: spCreateShareNotice
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR ShareNotice
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateShareNotice]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateShareNotice];
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateShareNotice] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Share Notices */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateShareNotice] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Share Notices */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Share Notices
-- Item: spUpdateShareNotice
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR ShareNotice
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateShareNotice]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateShareNotice];
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

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateShareNotice] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the ShareNotice table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateShareNotice]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateShareNotice];
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

/* spUpdate Permissions for MJ_BizApps_Collaboration: Share Notices */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateShareNotice] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Share Notices */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Share Notices
-- Item: spDeleteShareNotice
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR ShareNotice
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteShareNotice]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteShareNotice];
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
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteShareNotice] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Share Notices */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteShareNotice] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (3 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='AEC10B96-8D9E-485A-9AAF-968E3105B506,30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF,41165FEC-A52B-469A-A880-3B108C39A65E', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 4 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6504cca6-5691-4c33-9951-a3082b093048' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = 'User')) BEGIN
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
            '6504cca6-5691-4c33-9951-a3082b093048',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '514b7bd8-305f-49b6-87f7-a271feea7063' OR (EntityID = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF' AND Name = 'Space')) BEGIN
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
            '514b7bd8-305f-49b6-87f7-a271feea7063',
            '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF', -- Entity: MJ_BizApps_Collaboration: Item Uses
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '42ffaccc-9742-4e2e-a648-a37edddf366e' OR (EntityID = 'AEC10B96-8D9E-485A-9AAF-968E3105B506' AND Name = 'Space')) BEGIN
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
            '42ffaccc-9742-4e2e-a648-a37edddf366e',
            'AEC10B96-8D9E-485A-9AAF-968E3105B506', -- Entity: MJ_BizApps_Collaboration: Share Notices
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'AEC10B96-8D9E-485A-9AAF-968E3105B506'),
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

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '926697ff-4689-437d-91a0-9cb965092fbe' OR (EntityID = 'AEC10B96-8D9E-485A-9AAF-968E3105B506' AND Name = 'RecipientUser')) BEGIN
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
            '926697ff-4689-437d-91a0-9cb965092fbe',
            'AEC10B96-8D9E-485A-9AAF-968E3105B506', -- Entity: MJ_BizApps_Collaboration: Share Notices
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'AEC10B96-8D9E-485A-9AAF-968E3105B506'),
            'RecipientUser',
            'Recipient User',
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

/* SQL text to update existing entity fields from schema (3 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='AEC10B96-8D9E-485A-9AAF-968E3105B506,30A2C585-555B-4CDB-BFF6-5A5E84EAD2AF,41165FEC-A52B-469A-A880-3B108C39A65E', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

