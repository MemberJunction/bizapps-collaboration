-- =============================================================================
-- ItemUse records which space the use happened in.
--
-- Folder description for SpaceItem.
-- Row-level security filters for share notices and item uses live under metadata/
-- and are applied with mj sync push.
-- =============================================================================

IF COL_LENGTH('${flyway:defaultSchema}.ItemUse', 'SpaceID') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ADD SpaceID UNIQUEIDENTIFIER NULL;
GO

UPDATE u
SET u.SpaceID = i.SpaceID
FROM [${flyway:defaultSchema}].[ItemUse] AS u
INNER JOIN [${flyway:defaultSchema}].[SpaceItem] AS i ON i.ID = u.ItemID
WHERE u.SpaceID IS NULL;
GO

IF EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[ItemUse] WHERE SpaceID IS NULL)
    DELETE FROM [${flyway:defaultSchema}].[ItemUse] WHERE SpaceID IS NULL;
GO

ALTER TABLE [${flyway:defaultSchema}].[ItemUse] ALTER COLUMN SpaceID UNIQUEIDENTIFIER NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ItemUse_Space')
    ALTER TABLE [${flyway:defaultSchema}].[ItemUse]
        ADD CONSTRAINT FK_ItemUse_Space FOREIGN KEY (SpaceID) REFERENCES [${flyway:defaultSchema}].[Space](ID);
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'Folder label inside the space. Null means Unfiled. Collections cannot say everyone in the space, so the folder lives on the item.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'SpaceItem',
    @level2type = N'COLUMN', @level2name = N'Folder';
GO
