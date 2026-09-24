-- A filed root keeps an empty parent, so its plan cannot be grafted into
-- another space. Tag-link removal uses the write filter directly. The earlier
-- delete grant skipped tag links because they had no update filter.

DECLARE @Reach nvarchar(400) = N'[${flyway:defaultSchema}].[fnCollaborationTasks](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))';
DECLARE @Update nvarchar(max) = N'(ID IN (SELECT TaskID FROM ' + @Reach + N' WHERE CanWrite = 1) AND ((ID IN (SELECT TaskID FROM ' + @Reach + N' WHERE IsRoot = 1) AND ParentID IS NULL) OR (ID NOT IN (SELECT TaskID FROM ' + @Reach + N' WHERE IsRoot = 1) AND ParentID IN (SELECT TaskID FROM ' + @Reach + N' WHERE CanWrite = 1))))';

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Name = N'Collaboration: Tasks The Caller May Change',
    Description = N'A filed root stays parentless. Any other task needs a writable parent.',
    FilterText = @Update
WHERE ID = 'C0FFEE00-0000-4000-8000-000000000016';

UPDATE p
SET p.CanDelete = 1,
    p.DeleteRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000017'
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
WHERE e.Name = N'MJ_BizApps_Tasks: Task Tag Links'
  AND p.RoleID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';

IF EXISTS (
    SELECT 1
    FROM [${mjSchema}].[EntityPermission] AS p
    INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
    WHERE e.Name = N'MJ_BizApps_Tasks: Task Tag Links'
      AND p.RoleID = 'AAF434FD-EF58-4857-854E-2607ACAF763B'
      AND (p.CanDelete = 0 OR p.DeleteRLSFilterID IS NULL)
)
    THROW 50000, 'Task Tag Links still cannot be deleted by a participant.', 1;
GO
