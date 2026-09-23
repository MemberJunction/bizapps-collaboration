-- Rolled-back check for one participant. Run against a database that has the Collaboration migrations.
-- It inserts fixtures, asserts what that person can see, and rolls the transaction back.
SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @User uniqueidentifier = (SELECT TOP 1 ID FROM __mj.[User] WHERE IsActive = 1);
DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @Type uniqueidentifier = 'A1000001-0000-4000-8000-000000000001';
DECLARE @Guest uniqueidentifier = 'B2000001-0000-4000-8000-000000000004';
DECLARE @Ours uniqueidentifier = NEWID();
DECLARE @Sibling uniqueidentifier = NEWID();
DECLARE @Sealed uniqueidentifier = NEWID();

IF @User IS NULL THROW 50000, 'No active user to stand in as the participant.', 1;

INSERT INTO __mj_BizAppsCollaboration.Space (ID, SpaceTypeID, Name, OwnerID, InheritsMembership, AgentRetrieval)
VALUES
    (@Ours, @Type, N'Ours', @User, 1, N'Included'),
    (@Sibling, @Type, N'Sibling', @User, 1, N'Included'),
    (@Sealed, @Type, N'Sealed', @User, 0, N'Included');
UPDATE __mj_BizAppsCollaboration.Space SET ParentID = @Ours WHERE ID = @Sealed;

INSERT INTO __mj_BizAppsCollaboration.SpaceMember (SpaceID, UserID, SpaceRoleTypeID, Band, Status)
VALUES (@Ours, @User, @Guest, N'Shared', N'Active');

INSERT INTO __mj_BizAppsCollaboration.SpaceItem (SpaceID, EntityID, RecordID, Band, PromotedAt, PromotedByUserID)
SELECT @Ours, e.ID, CONVERT(nvarchar(36), NEWID()), N'Shared', SYSUTCDATETIME(), @User
FROM __mj.Entity e WHERE e.Name = N'MJ: Files';

DECLARE @Seen int = (
    SELECT COUNT(*) FROM __mj_BizAppsCollaboration.fnCollaborationAccess(@User) a
    WHERE a.SpaceID IN (@Sibling, @Sealed)
);
IF @Seen <> 0 THROW 50000, 'Participant reached a sibling or a sealed space.', 1;

IF NOT EXISTS (SELECT 1 FROM __mj_BizAppsCollaboration.fnCollaborationAccess(@User) WHERE SpaceID = @Ours)
    THROW 50000, 'Participant cannot see their own space.', 1;

IF EXISTS (
    SELECT 1
    FROM __mj.Entity e
    WHERE e.SchemaName = N'__mj'
      AND NOT EXISTS (
          SELECT 1 FROM __mj.EntityPermission p
          WHERE p.EntityID = e.ID AND p.RoleID = @Participant AND p.ReadRLSFilterID IS NOT NULL
      )
)
    THROW 50000, 'A core entity has no participant read filter.', 1;

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
