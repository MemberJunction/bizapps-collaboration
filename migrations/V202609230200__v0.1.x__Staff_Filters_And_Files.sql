-- Staff UI sees only the spaces it reaches, and can write because the subclasses gate the write.
-- Files are scoped through SpaceItem. Conversation details follow the conversation.
-- Developer and Integration stay unfiltered. That is the operator path.

DECLARE @UI uniqueidentifier = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E';
DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @Files uniqueidentifier = (SELECT ID FROM [${mjSchema}].[Entity] WHERE Name = N'MJ: Files');

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000006')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000006', N'Collaboration: Conversation Details In Reach', N'Details whose conversation is bound to a space the caller reaches.', N'');

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET FilterText = N'(ConversationID IN (SELECT ID FROM [${mjSchema}].[Conversation] WHERE LinkedEntityID = ''3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'' AND LinkedRecordID IN (SELECT CONVERT(nvarchar(36), SpaceID) FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))))'
WHERE ID = 'C0FFEE00-0000-4000-8000-000000000006';

IF @Files IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000007')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000007', N'Collaboration: Files In Reach', N'Files that are Shared items in a space the caller reaches, or Team items their role may see.', N'');

IF @Files IS NOT NULL
    UPDATE [${mjSchema}].[RowLevelSecurityFilter]
    SET FilterText = N'(ID IN (SELECT TRY_CAST(i.RecordID AS UNIQUEIDENTIFIER) FROM [${flyway:defaultSchema}].[SpaceItem] AS i WHERE i.EntityID = ''' + CONVERT(nvarchar(36), @Files) + N''' AND ((i.Band = N''Shared'' AND i.SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))) OR i.SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)) WHERE CanSeeTeam = 1))))'
    WHERE ID = 'C0FFEE00-0000-4000-8000-000000000007';

UPDATE p SET p.ReadRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000006'
FROM [${mjSchema}].[EntityPermission] p
INNER JOIN [${mjSchema}].[Entity] e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name = N'MJ: Conversation Details';

IF @Files IS NOT NULL
    UPDATE p SET p.ReadRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000007'
    FROM [${mjSchema}].[EntityPermission] p
    WHERE p.RoleID = @Participant AND p.EntityID = @Files;

UPDATE p
SET p.CanCreate = 1, p.CanRead = 1, p.CanUpdate = 1, p.ReadRLSFilterID = src.ReadRLSFilterID
FROM [${mjSchema}].[EntityPermission] p
INNER JOIN [${mjSchema}].[EntityPermission] src
    ON src.EntityID = p.EntityID AND src.RoleID = @Participant
INNER JOIN [${mjSchema}].[Entity] e ON e.ID = p.EntityID
WHERE p.RoleID = @UI
  AND e.Name IN (N'MJ_BizApps_Collaboration: Spaces', N'MJ_BizApps_Collaboration: Space Members', N'MJ_BizApps_Collaboration: Space Items');

INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
SELECT NEWID(), src.EntityID, @UI, 1, 1, 1, 0, src.ReadRLSFilterID, N'Allow'
FROM [${mjSchema}].[EntityPermission] src
INNER JOIN [${mjSchema}].[Entity] e ON e.ID = src.EntityID
WHERE src.RoleID = @Participant
  AND e.Name IN (N'MJ_BizApps_Collaboration: Spaces', N'MJ_BizApps_Collaboration: Space Members', N'MJ_BizApps_Collaboration: Space Items')
  AND NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityPermission] p WHERE p.EntityID = src.EntityID AND p.RoleID = @UI
  );

UPDATE p SET p.CanCreate = 1
FROM [${mjSchema}].[EntityPermission] p
INNER JOIN [${mjSchema}].[Entity] e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name IN (N'MJ: Conversations', N'MJ: Conversation Details');
GO
