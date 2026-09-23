-- Rolled-back check for one participant. Run against a database that has the Collaboration migrations.
-- It inserts fixtures, asserts what that person can see, and rolls the transaction back.
SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @User uniqueidentifier = (SELECT TOP 1 ID FROM __mj.[User] WHERE IsActive = 1);
DECLARE @Other uniqueidentifier = (SELECT TOP 1 ID FROM __mj.[User] WHERE IsActive = 1 AND ID <> @User);
DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @Type uniqueidentifier = 'A1000001-0000-4000-8000-000000000001';
DECLARE @Guest uniqueidentifier = 'B2000001-0000-4000-8000-000000000004';
DECLARE @Ours uniqueidentifier = NEWID();
DECLARE @Sibling uniqueidentifier = NEWID();
DECLARE @Sealed uniqueidentifier = NEWID();

IF @User IS NULL OR @Other IS NULL THROW 50000, 'Need two active users for the persona.', 1;

INSERT INTO __mj_BizAppsCollaboration.Space (ID, SpaceTypeID, Name, OwnerID, InheritsMembership, AgentRetrieval)
VALUES
    (@Ours, @Type, N'Ours', @User, 1, N'Included'),
    (@Sibling, @Type, N'Sibling', @Other, 1, N'Included'),
    (@Sealed, @Type, N'Sealed', @Other, 0, N'Included');
UPDATE __mj_BizAppsCollaboration.Space SET ParentID = @Ours WHERE ID = @Sealed;

INSERT INTO __mj_BizAppsCollaboration.SpaceMember (SpaceID, UserID, SpaceRoleTypeID, Band, Status)
VALUES (@Ours, @User, @Guest, N'Shared', N'Active');

DECLARE @File uniqueidentifier = NEWID();
INSERT INTO __mj.[File] (ID, Name, ProviderID, Status)
VALUES (@File, N'Persona file', 'C4B9433E-F36B-1410-8DA0-00021F8B792E', N'Active');
INSERT INTO __mj_BizAppsCollaboration.SpaceItem (SpaceID, EntityID, RecordID, Band, PromotedAt, PromotedByUserID)
SELECT @Ours, e.ID, N'ID|' + CONVERT(nvarchar(36), @File), N'Shared', SYSUTCDATETIME(), @User
FROM __mj.Entity e WHERE e.Name = N'MJ: Files';
INSERT INTO __mj_BizAppsCollaboration.SpaceItem (SpaceID, EntityID, RecordID, Band)
SELECT @Ours, e.ID, N'ID|' + CONVERT(nvarchar(36), NEWID()), N'Team'
FROM __mj.Entity e WHERE e.Name = N'MJ: Files';

DECLARE @Convo uniqueidentifier = NEWID();
DECLARE @OtherConvo uniqueidentifier = NEWID();
DECLARE @Detail uniqueidentifier = NEWID();
INSERT INTO __mj.Conversation (ID, Name, UserID, LinkedEntityID, LinkedRecordID)
VALUES
    (@Convo, N'Ours', @Other, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', CONVERT(nvarchar(36), @Ours)),
    (@OtherConvo, N'Sibling', @Other, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', CONVERT(nvarchar(36), @Sibling));
INSERT INTO __mj.ConversationDetail (ID, ConversationID, Role, Message, HiddenToUser, IsPinned, Status, OriginalMessageChanged, Sequence)
VALUES (@Detail, @Convo, N'User', N'Hello', 0, 0, N'Complete', 0, 1);

DECLARE @Seen int = (
    SELECT COUNT(*) FROM __mj_BizAppsCollaboration.fnCollaborationAccess(@User) a
    WHERE a.SpaceID IN (@Sibling, @Sealed)
);
IF @Seen <> 0 THROW 50000, 'Participant reached a sibling or a sealed space.', 1;

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCollaboration.fnCollaborationAccess(@User) WHERE SpaceID = @Ours)
    THROW 50000, 'Participant cannot see their own space.', 1;

IF EXISTS (
    SELECT 1
    FROM __mj.EntityPermission p
    INNER JOIN __mj.Entity e ON e.ID = p.EntityID
    WHERE p.CanRead = 1 AND p.ReadRLSFilterID IS NULL
      AND (
          (p.RoleID = @Participant)
          OR (p.RoleID = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AND e.Name IN (
              N'MJ_BizApps_Collaboration: Spaces',
              N'MJ_BizApps_Collaboration: Space Members',
              N'MJ_BizApps_Collaboration: Space Items',
              N'MJ_BizApps_Collaboration: Share Notices',
              N'MJ_BizApps_Collaboration: Item Uses'))
      )
)
    THROW 50000, 'A readable participant or UI row has no filter.', 1;

DECLARE @uid nvarchar(36) = CONVERT(nvarchar(36), @User);
DECLARE @n int;
DECLARE @pred nvarchar(max);
DECLARE @countSql nvarchar(max);

SELECT @pred = REPLACE(REPLACE(f.FilterText, '{{UserID}}', @uid), '{{ScopeResourceID}}', N'')
FROM __mj.RowLevelSecurityFilter f
INNER JOIN __mj.EntityPermission p ON p.ReadRLSFilterID = f.ID
INNER JOIN __mj.Entity e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name = N'MJ_BizApps_Collaboration: Spaces';
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj_BizAppsCollaboration.vwSpaces WHERE ID = @id AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@id uniqueidentifier, @out int OUTPUT', @Ours, @n OUTPUT;
IF @n <> 1 THROW 50000, 'Spaces filter did not return the persona space.', 1;
EXEC sys.sp_executesql @countSql, N'@id uniqueidentifier, @out int OUTPUT', @Sibling, @n OUTPUT;
IF @n <> 0 THROW 50000, 'Spaces filter returned the sibling.', 1;
EXEC sys.sp_executesql @countSql, N'@id uniqueidentifier, @out int OUTPUT', @Sealed, @n OUTPUT;
IF @n <> 0 THROW 50000, 'Spaces filter returned the sealed space.', 1;

SELECT @pred = REPLACE(REPLACE(f.FilterText, '{{UserID}}', @uid), '{{ScopeResourceID}}', N'')
FROM __mj.RowLevelSecurityFilter f
INNER JOIN __mj.EntityPermission p ON p.ReadRLSFilterID = f.ID
INNER JOIN __mj.Entity e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name = N'MJ_BizApps_Collaboration: Space Items';
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj_BizAppsCollaboration.vwSpaceItems WHERE Band = N''Shared'' AND SpaceID = @ours AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@ours uniqueidentifier, @out int OUTPUT', @Ours, @n OUTPUT;
IF @n <> 1 THROW 50000, 'Items filter did not return the shared file.', 1;
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj_BizAppsCollaboration.vwSpaceItems WHERE Band = N''Team'' AND SpaceID = @ours AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@ours uniqueidentifier, @out int OUTPUT', @Ours, @n OUTPUT;
IF @n <> 0 THROW 50000, 'Items filter returned the team item to a guest.', 1;

SELECT @pred = REPLACE(REPLACE(f.FilterText, '{{UserID}}', @uid), '{{ScopeResourceID}}', N'')
FROM __mj.RowLevelSecurityFilter f
INNER JOIN __mj.EntityPermission p ON p.ReadRLSFilterID = f.ID
INNER JOIN __mj.Entity e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name = N'MJ: Files';
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj.vwFiles WHERE ID = @file AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@file uniqueidentifier, @out int OUTPUT', @File, @n OUTPUT;
IF @n <> 1 THROW 50000, 'Files filter did not return the persona file.', 1;

SELECT @pred = REPLACE(REPLACE(f.FilterText, '{{UserID}}', @uid), '{{ScopeResourceID}}', N'')
FROM __mj.RowLevelSecurityFilter f
INNER JOIN __mj.EntityPermission p ON p.ReadRLSFilterID = f.ID
INNER JOIN __mj.Entity e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name = N'MJ: Conversations';
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj.vwConversations WHERE ID = @id AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@id uniqueidentifier, @out int OUTPUT', @Convo, @n OUTPUT;
IF @n <> 1 THROW 50000, 'Conversations filter missed the bound conversation.', 1;
EXEC sys.sp_executesql @countSql, N'@id uniqueidentifier, @out int OUTPUT', @OtherConvo, @n OUTPUT;
IF @n <> 0 THROW 50000, 'Conversations filter returned the sibling conversation.', 1;

SELECT @pred = REPLACE(REPLACE(f.FilterText, '{{UserID}}', @uid), '{{ScopeResourceID}}', N'')
FROM __mj.RowLevelSecurityFilter f
INNER JOIN __mj.EntityPermission p ON p.ReadRLSFilterID = f.ID
INNER JOIN __mj.Entity e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name = N'MJ: Conversation Details';
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj.vwConversationDetails WHERE ID = @id AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@id uniqueidentifier, @out int OUTPUT', @Detail, @n OUTPUT;
IF @n <> 1 THROW 50000, 'Conversation details filter missed the bound detail.', 1;

DECLARE @Item uniqueidentifier = (
    SELECT TOP 1 ID FROM __mj_BizAppsCollaboration.SpaceItem WHERE SpaceID = @Ours AND Band = N'Shared'
);
INSERT INTO __mj_BizAppsCollaboration.ShareNotice (SpaceID, ItemID, RecipientUserID)
VALUES (@Ours, @Item, @User), (@Sibling, @Item, @Other);
INSERT INTO __mj_BizAppsCollaboration.ItemUse (ItemID, UserID, UsedAt, Kind, SpaceID)
VALUES
    (@Item, @User, SYSUTCDATETIME(), N'open', @Ours),
    (@Item, @Other, SYSUTCDATETIME(), N'open', @Ours);

SELECT @pred = REPLACE(REPLACE(f.FilterText, '{{UserID}}', @uid), '{{ScopeResourceID}}', N'')
FROM __mj.RowLevelSecurityFilter f
INNER JOIN __mj.EntityPermission p ON p.ReadRLSFilterID = f.ID
INNER JOIN __mj.Entity e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name = N'MJ_BizApps_Collaboration: Share Notices';
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj_BizAppsCollaboration.vwShareNotices WHERE SpaceID = @ours AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@ours uniqueidentifier, @out int OUTPUT', @Ours, @n OUTPUT;
IF @n <> 1 THROW 50000, 'Notices filter did not return the notice in reach.', 1;
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj_BizAppsCollaboration.vwShareNotices WHERE SpaceID = @sibling AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@sibling uniqueidentifier, @out int OUTPUT', @Sibling, @n OUTPUT;
IF @n <> 0 THROW 50000, 'Notices filter returned the sibling notice.', 1;

SELECT @pred = REPLACE(REPLACE(f.FilterText, '{{UserID}}', @uid), '{{ScopeResourceID}}', N'')
FROM __mj.RowLevelSecurityFilter f
INNER JOIN __mj.EntityPermission p ON p.ReadRLSFilterID = f.ID
INNER JOIN __mj.Entity e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant AND e.Name = N'MJ_BizApps_Collaboration: Item Uses';
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj_BizAppsCollaboration.vwItemUses WHERE UserID = @user AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@user uniqueidentifier, @out int OUTPUT', @User, @n OUTPUT;
IF @n <> 1 THROW 50000, 'Item uses filter did not return the caller''s use.', 1;
SET @countSql = N'SELECT @out = COUNT(*) FROM __mj_BizAppsCollaboration.vwItemUses WHERE UserID = @other AND ' + @pred;
EXEC sys.sp_executesql @countSql, N'@other uniqueidentifier, @out int OUTPUT', @Other, @n OUTPUT;
IF @n <> 0 THROW 50000, 'Item uses filter returned someone else''s use.', 1;

DECLARE @Filter nvarchar(max), @Name nvarchar(255), @Schema sysname, @View sysname, @sql nvarchar(max);
DECLARE filters CURSOR LOCAL FAST_FORWARD FOR
    SELECT f.Name, e.SchemaName, e.BaseView, f.FilterText
    FROM __mj.RowLevelSecurityFilter f
    INNER JOIN __mj.EntityPermission p ON p.ReadRLSFilterID = f.ID
    INNER JOIN __mj.Entity e ON e.ID = p.EntityID
    WHERE p.RoleID = @Participant AND f.FilterText IS NOT NULL;
OPEN filters;
FETCH NEXT FROM filters INTO @Name, @Schema, @View, @Filter;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'SELECT TOP 0 * FROM ' + QUOTENAME(@Schema) + N'.' + QUOTENAME(@View)
        + N' WHERE ' + REPLACE(REPLACE(@Filter, '{{UserID}}', CONVERT(nvarchar(36), @User)), '{{ScopeResourceID}}', N'');
    BEGIN TRY
        EXEC sys.sp_executesql @sql;
    END TRY
    BEGIN CATCH
        DECLARE @msg nvarchar(400) = CONCAT('Filter failed: ', @Name, ' — ', ERROR_MESSAGE());
        THROW 50000, @msg, 1;
    END CATCH
    FETCH NEXT FROM filters INTO @Name, @Schema, @View, @Filter;
END
CLOSE filters;
DEALLOCATE filters;

ROLLBACK TRAN;
