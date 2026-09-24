-- Space Participant can read the tasks filed in spaces they reach, and can
-- write them when their role can contribute. A root task is a space item.
-- Its descendants are the tasks whose RootParentID is that item. Team items
-- stay with roles that can see Team. Shared items are visible to anyone who
-- reaches the space. Catalog rows (types, roles, templates) are readable so
-- the task views can render. Creating a task requires some contributing seat;
-- the space item gate still decides the specific space.

DECLARE @Tasks uniqueidentifier;
DECLARE @TaskSchema sysname;
DECLARE @TaskView sysname;
SELECT @Tasks = ID, @TaskSchema = SchemaName, @TaskView = BaseView
FROM [${mjSchema}].[Entity]
WHERE Name = N'MJ_BizApps_Tasks: Tasks';
IF @Tasks IS NULL OR @TaskSchema IS NULL OR @TaskView IS NULL
    THROW 50000, 'MJ_BizApps_Tasks: Tasks is not installed.', 1;

DECLARE @TaskId nvarchar(36) = CONVERT(nvarchar(36), @Tasks);
DECLARE @TaskFrom nvarchar(300) = QUOTENAME(@TaskSchema) + N'.' + QUOTENAME(@TaskView);
DECLARE @Roots nvarchar(max) = N'(SELECT TRY_CAST(CASE WHEN i.RecordID LIKE N''ID|%'' THEN SUBSTRING(i.RecordID, 4, 36) ELSE i.RecordID END AS UNIQUEIDENTIFIER) FROM [${flyway:defaultSchema}].[SpaceItem] AS i WHERE i.EntityID = ''' + @TaskId + N''' AND (i.SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)) WHERE CanSeeTeam = 1) OR (i.Band = N''Shared'' AND i.SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))))))';
DECLARE @Visible nvarchar(max) = N'(ID IN ' + @Roots + N' OR RootParentID IN ' + @Roots + N')';
DECLARE @Child nvarchar(max) = N'(TaskID IN (SELECT ID FROM ' + @TaskFrom + N' WHERE ' + @Visible + N'))';
DECLARE @Contributor nvarchar(max) = N'(EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[SpaceMember] AS m INNER JOIN [${flyway:defaultSchema}].[SpaceRoleType] AS r ON r.ID = m.SpaceRoleTypeID WHERE m.UserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER) AND m.Status = N''Active'' AND r.CanContribute = 1))';
DECLARE @Update nvarchar(max) = N'(' + @Visible + N' AND ' + @Contributor + N')';
DECLARE @ChildWrite nvarchar(max) = N'(' + @Child + N' AND ' + @Contributor + N')';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000012')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000012', N'Collaboration: Tasks In Reach', N'Root tasks filed in a reachable space, and their descendants.', @Visible);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET Name = N'Collaboration: Tasks In Reach', Description = N'Root tasks filed in a reachable space, and their descendants.', FilterText = @Visible WHERE ID = 'C0FFEE00-0000-4000-8000-000000000012';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000013')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000013', N'Collaboration: Task Rows In Reach', N'Rows whose task is one the caller can see.', @Child);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET FilterText = @Child WHERE ID = 'C0FFEE00-0000-4000-8000-000000000013';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000014')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000014', N'Collaboration: Task Contributor', N'The caller holds an active seat that can add material.', @Contributor);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET FilterText = @Contributor WHERE ID = 'C0FFEE00-0000-4000-8000-000000000014';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000015')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000015', N'Collaboration: Task Catalog', N'Task types, roles, and templates. No row of the caller''s work.', N'(1 = 1)');

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000016')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000016', N'Collaboration: Tasks A Contributor May Change', N'A visible task, and the caller can add material.', @Update);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET FilterText = @Update WHERE ID = 'C0FFEE00-0000-4000-8000-000000000016';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000017')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000017', N'Collaboration: Task Rows A Contributor May Change', N'A row of a visible task, and the caller can add material.', @ChildWrite);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter] SET FilterText = @ChildWrite WHERE ID = 'C0FFEE00-0000-4000-8000-000000000017';
GO

DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @Read uniqueidentifier = 'C0FFEE00-0000-4000-8000-000000000012';
DECLARE @Child uniqueidentifier = 'C0FFEE00-0000-4000-8000-000000000013';
DECLARE @Contribute uniqueidentifier = 'C0FFEE00-0000-4000-8000-000000000014';
DECLARE @Catalog uniqueidentifier = 'C0FFEE00-0000-4000-8000-000000000015';
DECLARE @Update uniqueidentifier = 'C0FFEE00-0000-4000-8000-000000000016';
DECLARE @ChildWrite uniqueidentifier = 'C0FFEE00-0000-4000-8000-000000000017';

DECLARE @Grant TABLE (
    EntityName nvarchar(255) NOT NULL,
    CanCreate bit NOT NULL,
    CanRead bit NOT NULL,
    CanUpdate bit NOT NULL,
    CanDelete bit NOT NULL,
    ReadFilter uniqueidentifier NULL,
    CreateFilter uniqueidentifier NULL,
    UpdateFilter uniqueidentifier NULL
);

INSERT INTO @Grant VALUES
    (N'MJ_BizApps_Tasks: Tasks', 1, 1, 1, 0, @Read, @Contribute, @Update),
    (N'MJ_BizApps_Tasks: Task Links', 1, 1, 1, 0, @Child, @ChildWrite, @ChildWrite),
    (N'MJ_BizApps_Tasks: Task Assignments', 1, 1, 1, 0, @Child, @ChildWrite, @ChildWrite),
    (N'MJ_BizApps_Tasks: Task Comments', 1, 1, 1, 0, @Child, @ChildWrite, @ChildWrite),
    (N'MJ_BizApps_Tasks: Task Activities', 0, 1, 0, 0, @Child, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Dependencies', 1, 1, 1, 0, @Child, @ChildWrite, @ChildWrite),
    (N'MJ_BizApps_Tasks: Task Decisions', 1, 1, 0, 0, @Child, @ChildWrite, NULL),
    (N'MJ_BizApps_Tasks: Task Tag Links', 1, 1, 0, 0, @Child, @ChildWrite, NULL),
    (N'MJ_BizApps_Tasks: Task Types', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Type Status', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Roles', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Categories', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Tags', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Decision Outcomes', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Templates', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Template Items', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Template Item Roles', 0, 1, 0, 0, @Catalog, NULL, NULL),
    (N'MJ_BizApps_Tasks: Task Template Item Dependencies', 0, 1, 0, 0, @Catalog, NULL, NULL);

UPDATE p
SET p.CanCreate = g.CanCreate,
    p.CanRead = g.CanRead,
    p.CanUpdate = g.CanUpdate,
    p.CanDelete = g.CanDelete,
    p.ReadRLSFilterID = g.ReadFilter,
    p.CreateRLSFilterID = g.CreateFilter,
    p.UpdateRLSFilterID = g.UpdateFilter,
    p.DeleteRLSFilterID = NULL
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
INNER JOIN @Grant AS g ON g.EntityName = e.Name
WHERE p.RoleID = @Participant;

INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, CreateRLSFilterID, UpdateRLSFilterID, Type)
SELECT NEWID(), e.ID, @Participant, g.CanCreate, g.CanRead, g.CanUpdate, g.CanDelete, g.ReadFilter, g.CreateFilter, g.UpdateFilter, N'Allow'
FROM @Grant AS g
INNER JOIN [${mjSchema}].[Entity] AS e ON e.Name = g.EntityName
WHERE NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission] AS p
    WHERE p.EntityID = e.ID AND p.RoleID = @Participant
);

IF (SELECT COUNT(*) FROM [${mjSchema}].[EntityPermission] AS p
    INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
    INNER JOIN @Grant AS g ON g.EntityName = e.Name
    WHERE p.RoleID = @Participant
      AND p.CanRead = 1
      AND p.ReadRLSFilterID IS NOT NULL
      AND (p.CanCreate = 0 OR p.CreateRLSFilterID IS NOT NULL)
) <> (SELECT COUNT(*) FROM @Grant)
    THROW 50000, 'Space Participant is missing a filtered task grant.', 1;
GO
