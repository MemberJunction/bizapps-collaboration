-- Space Participant can boot Explorer.
--
-- The shell reads workspaces, gets none back from the empty filter, and creates
-- a Default workspace. That save was refused, so the loading screen stayed up.
-- These six stores are the caller's own rows. Workspace Items has no UserID, so
-- it is limited through the workspace. A null filter would exempt the operation,
-- so read, create, update and delete each carry a filter.

DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @Own nvarchar(36) = N'C0FFEE00-0000-4000-8000-000000000003';
DECLARE @Items nvarchar(36) = N'C0FFEE00-0000-4000-8000-000000000011';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = @Items)
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES (
        @Items,
        N'Collaboration: Own Workspace Items',
        N'Items in a workspace the caller owns.',
        N'(WorkspaceID IN (SELECT ID FROM [${mjSchema}].[Workspace] WHERE UserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))'
    );
GO

DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @Own nvarchar(36) = N'C0FFEE00-0000-4000-8000-000000000003';
DECLARE @Items nvarchar(36) = N'C0FFEE00-0000-4000-8000-000000000011';

UPDATE p
SET p.CanCreate = 1,
    p.CanRead = 1,
    p.CanUpdate = 1,
    p.CanDelete = 1,
    p.ReadRLSFilterID = CASE WHEN e.Name = N'MJ: Workspace Items' THEN @Items ELSE @Own END,
    p.CreateRLSFilterID = CASE WHEN e.Name = N'MJ: Workspace Items' THEN @Items ELSE @Own END,
    p.UpdateRLSFilterID = CASE WHEN e.Name = N'MJ: Workspace Items' THEN @Items ELSE @Own END,
    p.DeleteRLSFilterID = CASE WHEN e.Name = N'MJ: Workspace Items' THEN @Items ELSE @Own END
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant
  AND e.Name IN (
      N'MJ: Workspaces',
      N'MJ: Workspace Items',
      N'MJ: User Settings',
      N'MJ: User Favorites',
      N'MJ: User Record Logs',
      N'MJ: User Notification Preferences'
  );

IF (SELECT COUNT(*) FROM [${mjSchema}].[EntityPermission] AS p
    INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
    WHERE p.RoleID = @Participant
      AND e.Name IN (
          N'MJ: Workspaces', N'MJ: Workspace Items', N'MJ: User Settings',
          N'MJ: User Favorites', N'MJ: User Record Logs', N'MJ: User Notification Preferences'
      )
      AND p.CanCreate = 1 AND p.CanUpdate = 1 AND p.CanDelete = 1
      AND p.ReadRLSFilterID IS NOT NULL AND p.CreateRLSFilterID IS NOT NULL
      AND p.UpdateRLSFilterID IS NOT NULL AND p.DeleteRLSFilterID IS NOT NULL
   ) <> 6
    THROW 50000, 'Space Participant is missing a filtered workspace grant.', 1;
GO
