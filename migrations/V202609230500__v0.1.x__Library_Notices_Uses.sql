-- Phase 2. Folders live on the item because Collections cannot say
-- "everyone in this space". A share writes a notice. Opening an item writes a use.

IF COL_LENGTH('${flyway:defaultSchema}.SpaceItem', 'Folder') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceItem] ADD Folder NVARCHAR(200) NULL;
GO

IF OBJECT_ID('${flyway:defaultSchema}.ShareNotice', 'U') IS NULL
CREATE TABLE [${flyway:defaultSchema}].[ShareNotice] (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    ItemID UNIQUEIDENTIFIER NOT NULL,
    RecipientUserID UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_ShareNotice PRIMARY KEY (ID),
    CONSTRAINT FK_ShareNotice_Space FOREIGN KEY (SpaceID) REFERENCES [${flyway:defaultSchema}].[Space](ID),
    CONSTRAINT FK_ShareNotice_Item FOREIGN KEY (ItemID) REFERENCES [${flyway:defaultSchema}].[SpaceItem](ID),
    CONSTRAINT FK_ShareNotice_User FOREIGN KEY (RecipientUserID) REFERENCES [${mjSchema}].[User](ID)
);
GO

IF OBJECT_ID('${flyway:defaultSchema}.ItemUse', 'U') IS NULL
CREATE TABLE [${flyway:defaultSchema}].[ItemUse] (
    ID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    ItemID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NOT NULL,
    UsedAt DATETIMEOFFSET NOT NULL,
    Kind NVARCHAR(20) NOT NULL,
    CONSTRAINT PK_ItemUse PRIMARY KEY (ID),
    CONSTRAINT FK_ItemUse_Item FOREIGN KEY (ItemID) REFERENCES [${flyway:defaultSchema}].[SpaceItem](ID),
    CONSTRAINT FK_ItemUse_User FOREIGN KEY (UserID) REFERENCES [${mjSchema}].[User](ID),
    CONSTRAINT CK_ItemUse_Kind CHECK (Kind IN ('open', 'upload', 'promote'))
);
GO
