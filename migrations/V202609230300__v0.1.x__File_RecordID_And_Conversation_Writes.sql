-- Files match the canonical RecordID form, ID|<guid>.
-- Participants do not get CanCreate on conversations. Core's detail gate is fail-open
-- when the parent conversation does not load, so that grant is reverted.

DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @Files uniqueidentifier = (SELECT ID FROM [${mjSchema}].[Entity] WHERE Name = N'MJ: Files');

IF @Files IS NOT NULL
    UPDATE [${mjSchema}].[RowLevelSecurityFilter]
    SET Description = N'Files whose canonical RecordID is a Shared or visible Team item in a space the caller reaches.',
        FilterText = N'((N''ID|'' + CONVERT(nvarchar(36), ID)) IN (SELECT i.RecordID FROM [${flyway:defaultSchema}].[SpaceItem] AS i WHERE i.EntityID = ''' + CONVERT(nvarchar(36), @Files) + N''' AND ((i.Band = N''Shared'' AND i.SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))) OR i.SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)) WHERE CanSeeTeam = 1))))'
    WHERE ID = 'C0FFEE00-0000-4000-8000-000000000007';

UPDATE p SET p.CanCreate = 0
FROM [${mjSchema}].[EntityPermission] p
INNER JOIN [${mjSchema}].[Entity] e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant
  AND e.Name IN (N'MJ: Conversations', N'MJ: Conversation Details');
GO
