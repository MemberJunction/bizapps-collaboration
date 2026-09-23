-- Share Notices and Item Uses. CodeGen grants UI, Developer, and Integration.
-- Developer and Integration stay unfiltered. That is the operator path.
-- Space Participant and UI get a filter on every readable row. A NULL filter
-- exempts the role from row-level security.

DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @UI uniqueidentifier = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E';

DECLARE @Grants TABLE (
    EntityName nvarchar(255) NOT NULL,
    FilterID uniqueidentifier NOT NULL
);

INSERT INTO @Grants (EntityName, FilterID)
VALUES
    (N'MJ_BizApps_Collaboration: Share Notices', 'C0FFEE00-0000-4000-8000-000000000008'),
    (N'MJ_BizApps_Collaboration: Item Uses', 'C0FFEE00-0000-4000-8000-000000000009');

IF (SELECT COUNT(*) FROM @Grants AS g INNER JOIN [${mjSchema}].[Entity] AS e ON e.Name = g.EntityName) <> 2
    THROW 50000, 'Share Notices or Item Uses is not registered. Run the CodeGen capture first.', 1;

INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
SELECT NEWID(), e.ID, @Participant, 1, 1, 0, 0, g.FilterID, N'Allow'
FROM @Grants AS g
INNER JOIN [${mjSchema}].[Entity] AS e ON e.Name = g.EntityName
WHERE NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission] AS p
    WHERE p.EntityID = e.ID AND p.RoleID = @Participant
);

UPDATE p
SET p.CanCreate = 1,
    p.CanRead = 1,
    p.CanUpdate = 0,
    p.CanDelete = 0,
    p.ReadRLSFilterID = g.FilterID
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
INNER JOIN @Grants AS g ON g.EntityName = e.Name
WHERE p.RoleID = @Participant;

INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
SELECT NEWID(), e.ID, @UI, 1, 1, 0, 0, g.FilterID, N'Allow'
FROM @Grants AS g
INNER JOIN [${mjSchema}].[Entity] AS e ON e.Name = g.EntityName
WHERE NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission] AS p
    WHERE p.EntityID = e.ID AND p.RoleID = @UI
);

UPDATE p
SET p.CanCreate = 1,
    p.CanRead = 1,
    p.CanUpdate = 0,
    p.CanDelete = 0,
    p.ReadRLSFilterID = g.FilterID
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
INNER JOIN @Grants AS g ON g.EntityName = e.Name
WHERE p.RoleID = @UI;

IF EXISTS (
    SELECT 1
    FROM [${mjSchema}].[EntityPermission] AS p
    INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
    WHERE p.CanRead = 1
      AND p.ReadRLSFilterID IS NULL
      AND (
          p.RoleID = @Participant
          OR (p.RoleID = @UI AND e.Name IN (
              N'MJ_BizApps_Collaboration: Spaces',
              N'MJ_BizApps_Collaboration: Space Members',
              N'MJ_BizApps_Collaboration: Space Items',
              N'MJ_BizApps_Collaboration: Share Notices',
              N'MJ_BizApps_Collaboration: Item Uses'))
      )
)
    THROW 50000, 'A readable participant or UI row has no filter.', 1;
GO
