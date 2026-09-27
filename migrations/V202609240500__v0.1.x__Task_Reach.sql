-- =============================================================================
-- Task reach functions: fnCollaborationAccess and fnCollaborationTasks.
--
-- A write filter can name only real columns. RootParentID is virtual, so the
-- tree walk lives in fnCollaborationTasks, over the base Task table.
-- CanContribute is carried from the nearest seat.
--
-- Row-level security filters and task entity permissions live under metadata/
-- and are applied with mj sync push.
-- =============================================================================

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
