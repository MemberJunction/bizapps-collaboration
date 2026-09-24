-- A write filter can name only real columns. RootParentID is virtual, so the
-- tree walk lives in fnCollaborationTasks, over the base Task table.
-- CanContribute is carried from the nearest seat. A write is allowed only
-- when that seat, on the task's own space, can add material and see the band.

DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationAccess];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID UNIQUEIDENTIFIER)
RETURNS @Access TABLE (
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL,
    CanInvite BIT NOT NULL,
    CanContribute BIT NOT NULL
)
AS
BEGIN
    ;WITH Direct AS (
        SELECT m.SpaceID,
               CAST(r.CanSeeTeamBand AS INT) AS CanSeeTeam,
               CAST(r.CanInvite AS INT) AS CanInvite,
               CAST(r.CanContribute AS INT) AS CanContribute,
               0 AS Steps,
               CAST(CONVERT(varchar(36), m.SpaceID) AS varchar(max)) AS Path
        FROM [${flyway:defaultSchema}].[SpaceMember] AS m
        INNER JOIN [${flyway:defaultSchema}].[SpaceRoleType] AS r ON r.ID = m.SpaceRoleTypeID
        WHERE m.UserID = @UserID
          AND m.Status = N'Active'
    ),
    Reachable AS (
        SELECT SpaceID, CanSeeTeam, CanInvite, CanContribute, Steps, Path FROM Direct
        UNION ALL
        SELECT child.ID,
               parent.CanSeeTeam,
               parent.CanInvite,
               parent.CanContribute,
               parent.Steps + 1,
               parent.Path + '/' + CONVERT(varchar(36), child.ID)
        FROM [${flyway:defaultSchema}].[Space] AS child
        INNER JOIN Reachable AS parent ON child.ParentID = parent.SpaceID
        WHERE child.InheritsMembership = 1
          AND parent.Steps < 32
          AND parent.Path NOT LIKE '%' + CONVERT(varchar(36), child.ID) + '%'
    )
    INSERT INTO @Access (SpaceID, CanSeeTeam, CanInvite, CanContribute)
    SELECT SpaceID, CAST(CanSeeTeam AS BIT), CAST(CanInvite AS BIT), CAST(CanContribute AS BIT)
    FROM (
        SELECT SpaceID, CanSeeTeam, CanInvite, CanContribute,
               ROW_NUMBER() OVER (PARTITION BY SpaceID ORDER BY Steps) AS rn
        FROM Reachable
    ) AS ranked
    WHERE rn = 1
    OPTION (MAXRECURSION 32);
    RETURN;
END;
GO

DECLARE @TaskSchema sysname;
DECLARE @TaskTable sysname;
DECLARE @Tasks uniqueidentifier;
SELECT @Tasks = ID, @TaskSchema = SchemaName, @TaskTable = BaseTable
FROM [${mjSchema}].[Entity]
WHERE Name = N'MJ_BizApps_Tasks: Tasks';
IF @Tasks IS NULL OR @TaskSchema IS NULL OR @TaskTable IS NULL
    THROW 50000, 'MJ_BizApps_Tasks: Tasks is not installed.', 1;

DECLARE @PersonSchema sysname;
DECLARE @PersonTable sysname;
SELECT @PersonSchema = SchemaName, @PersonTable = BaseTable
FROM [${mjSchema}].[Entity]
WHERE Name = N'MJ_BizApps_Common: People';
IF @PersonSchema IS NULL OR @PersonTable IS NULL
    THROW 50000, 'MJ_BizApps_Common: People is not installed.', 1;

DECLARE @TaskFrom nvarchar(300) = QUOTENAME(@TaskSchema) + N'.' + QUOTENAME(@TaskTable);
DECLARE @PersonFrom nvarchar(300) = QUOTENAME(@PersonSchema) + N'.' + QUOTENAME(@PersonTable);
DECLARE @TaskId nvarchar(36) = CONVERT(nvarchar(36), @Tasks);
DECLARE @sql nvarchar(max) = N'
CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationTasks](@UserID UNIQUEIDENTIFIER)
RETURNS @Reach TABLE (
    TaskID UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanWrite BIT NOT NULL,
    IsRoot BIT NOT NULL
)
AS
BEGIN
    ;WITH Roots AS (
        SELECT
            TRY_CAST(CASE WHEN i.RecordID LIKE N''ID|%'' THEN SUBSTRING(i.RecordID, 4, 36) ELSE i.RecordID END AS UNIQUEIDENTIFIER) AS TaskID,
            i.SpaceID,
            CASE WHEN a.CanContribute = 1 AND (i.Band = N''Shared'' OR a.CanSeeTeam = 1) THEN 1 ELSE 0 END AS CanWrite
        FROM [${flyway:defaultSchema}].[SpaceItem] AS i
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID) AS a ON a.SpaceID = i.SpaceID
        WHERE i.EntityID = ''' + @TaskId + N'''
          AND (i.Band = N''Shared'' OR a.CanSeeTeam = 1)
    ),
    Walk AS (
        SELECT TaskID, SpaceID, CanWrite, 1 AS IsRoot, 0 AS Steps,
               CAST(CONVERT(varchar(36), TaskID) AS varchar(max)) AS Path
        FROM Roots
        WHERE TaskID IS NOT NULL
        UNION ALL
        SELECT child.ID, parent.SpaceID, parent.CanWrite, 0, parent.Steps + 1,
               parent.Path + ''/'' + CONVERT(varchar(36), child.ID)
        FROM ' + @TaskFrom + N' AS child
        INNER JOIN Walk AS parent ON child.ParentID = parent.TaskID
        WHERE parent.Steps < 32
          AND parent.Path NOT LIKE ''%'' + CONVERT(varchar(36), child.ID) + ''%''
    )
    INSERT INTO @Reach (TaskID, SpaceID, CanWrite, IsRoot)
    SELECT TaskID, SpaceID, CAST(CanWrite AS BIT), CAST(IsRoot AS BIT)
    FROM (
        SELECT TaskID, SpaceID, CanWrite, IsRoot,
               ROW_NUMBER() OVER (PARTITION BY TaskID ORDER BY IsRoot DESC, Steps) AS rn
        FROM Walk
    ) AS ranked
    WHERE rn = 1
    OPTION (MAXRECURSION 32);
    RETURN;
END;';

DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationTasks];
EXEC sp_executesql @sql;
GO

DECLARE @Reach nvarchar(max) = N'[${flyway:defaultSchema}].[fnCollaborationTasks](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))';
DECLARE @Read nvarchar(max) = N'(ID IN (SELECT TaskID FROM ' + @Reach + N'))';
DECLARE @Create nvarchar(max) = N'(ParentID IN (SELECT TaskID FROM ' + @Reach + N' WHERE CanWrite = 1))';
DECLARE @Update nvarchar(max) = N'(ID IN (SELECT TaskID FROM ' + @Reach + N' WHERE CanWrite = 1) AND (ID IN (SELECT TaskID FROM ' + @Reach + N' WHERE IsRoot = 1) OR ParentID IN (SELECT TaskID FROM ' + @Reach + N' WHERE CanWrite = 1)))';
DECLARE @ChildRead nvarchar(max) = N'(TaskID IN (SELECT TaskID FROM ' + @Reach + N'))';
DECLARE @ChildWrite nvarchar(max) = N'(TaskID IN (SELECT TaskID FROM ' + @Reach + N' WHERE CanWrite = 1))';
DECLARE @DepRead nvarchar(max) = N'(TaskID IN (SELECT TaskID FROM ' + @Reach + N') AND DependsOnTaskID IN (SELECT TaskID FROM ' + @Reach + N'))';
DECLARE @DepWrite nvarchar(max) = N'(TaskID IN (SELECT TaskID FROM ' + @Reach + N' WHERE CanWrite = 1) AND DependsOnTaskID IN (SELECT TaskID FROM ' + @Reach + N' WHERE CanWrite = 1))';

DECLARE @PersonSchema sysname;
DECLARE @PersonTable sysname;
SELECT @PersonSchema = SchemaName, @PersonTable = BaseTable FROM [${mjSchema}].[Entity] WHERE Name = N'MJ_BizApps_Common: People';
DECLARE @Author nvarchar(max) = N'(PersonID IN (SELECT ID FROM ' + QUOTENAME(@PersonSchema) + N'.' + QUOTENAME(@PersonTable) + N' WHERE LinkedUserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))';
DECLARE @CommentUpdate nvarchar(max) = N'(' + @ChildWrite + N' AND ' + @Author + N')';

UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET Description = N'Tasks filed in a space the caller reaches, and the tasks under them.', FilterText = @Read WHERE ID = 'C0FFEE00-0000-4000-8000-000000000012';
UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET Description = N'Rows whose task is one the caller can see.', FilterText = @ChildRead WHERE ID = 'C0FFEE00-0000-4000-8000-000000000013';
UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET Name = N'Collaboration: Subtasks Under A Writable Parent', Description = N'A subtask whose parent the caller can write. Roots are filed by the server.', FilterText = @Create WHERE ID = 'C0FFEE00-0000-4000-8000-000000000014';
UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET Name = N'Collaboration: Tasks The Caller May Change', Description = N'A task the caller can write. A filed root may keep a parent the caller cannot write.', FilterText = @Update WHERE ID = 'C0FFEE00-0000-4000-8000-000000000016';
UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET Description = N'A row of a task the caller can write.', FilterText = @ChildWrite WHERE ID = 'C0FFEE00-0000-4000-8000-000000000017';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000018')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000018', N'Collaboration: Task Dependencies In Reach', N'Both ends of the dependency are tasks the caller can see.', @DepRead);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET FilterText = @DepRead WHERE ID = 'C0FFEE00-0000-4000-8000-000000000018';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000019')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000019', N'Collaboration: Task Dependencies A Contributor May Change', N'Both ends are tasks the caller can write.', @DepWrite);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET FilterText = @DepWrite WHERE ID = 'C0FFEE00-0000-4000-8000-000000000019';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000020')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000020', N'Collaboration: Task Comments The Author May Change', N'The caller wrote the comment, on a task they can write.', @CommentUpdate);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET FilterText = @CommentUpdate WHERE ID = 'C0FFEE00-0000-4000-8000-000000000020';
GO

DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';

UPDATE p
SET p.ReadRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000018',
    p.CreateRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000019',
    p.UpdateRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000019',
    p.DeleteRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000019',
    p.CanDelete = 1
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
WHERE e.Name = N'MJ_BizApps_Tasks: Task Dependencies'
  AND p.RoleID = @Participant;

UPDATE p
SET p.UpdateRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000020'
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
WHERE e.Name = N'MJ_BizApps_Tasks: Task Comments'
  AND p.RoleID = @Participant;

UPDATE p
SET p.CanDelete = 1,
    p.DeleteRLSFilterID = p.UpdateRLSFilterID
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
WHERE p.RoleID = @Participant
  AND e.Name IN (N'MJ_BizApps_Tasks: Task Assignments', N'MJ_BizApps_Tasks: Task Tag Links')
  AND p.UpdateRLSFilterID IS NOT NULL;

IF EXISTS (
    SELECT 1
    FROM [${mjSchema}].[EntityPermission] AS p
    INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
    WHERE p.RoleID = @Participant
      AND e.Name LIKE N'MJ_BizApps_Tasks:%'
      AND ((p.CanRead = 1 AND p.ReadRLSFilterID IS NULL)
        OR (p.CanCreate = 1 AND p.CreateRLSFilterID IS NULL)
        OR (p.CanUpdate = 1 AND p.UpdateRLSFilterID IS NULL)
        OR (p.CanDelete = 1 AND p.DeleteRLSFilterID IS NULL))
)
    THROW 50000, 'A Space Participant task grant is missing its filter.', 1;
GO
