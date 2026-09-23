-- Descriptions for the library tables. CodeGen reads these onto the entity
-- rows during the metadata refresh that follows the capture migration.
-- SpaceItem.Folder is already described.

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A notice that an item in this space was shared with a member.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ShareNotice';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The space the notice belongs to. The read filter keeps a caller inside spaces they reach.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ShareNotice',
    @level2type = N'COLUMN', @level2name = N'SpaceID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The space item that was shared.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ShareNotice',
    @level2type = N'COLUMN', @level2name = N'ItemID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The member the notice is for.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ShareNotice',
    @level2type = N'COLUMN', @level2name = N'RecipientUserID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'A record that a member opened, uploaded, or promoted an item.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ItemUse';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The space item that was used.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ItemUse',
    @level2type = N'COLUMN', @level2name = N'ItemID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The member who opened, uploaded, or promoted the item.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ItemUse',
    @level2type = N'COLUMN', @level2name = N'UserID';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'When the use happened.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ItemUse',
    @level2type = N'COLUMN', @level2name = N'UsedAt';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'open, upload, or promote.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ItemUse',
    @level2type = N'COLUMN', @level2name = N'Kind';
GO

EXEC sp_addextendedproperty @name = N'MS_Description',
    @value = N'The space the use happened in. Required so the read filter can keep the row inside spaces the caller reaches.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'ItemUse',
    @level2type = N'COLUMN', @level2name = N'SpaceID';
GO
