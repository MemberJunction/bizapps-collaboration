-- A notice is for one member. The read filter is that member, inside a space
-- they reach. Create stays on, and it carries a filter, so a participant is
-- not exempt from create row-level security. The server subclasses are the
-- rest of the gate: the item is in the space, the recipient is in the share,
-- and an item use is recorded as the caller.

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Name = N'Collaboration: Notices For The Caller',
    Description = N'Share notices addressed to the caller, in spaces they reach.',
    FilterText = N'(RecipientUserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER) AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))))'
WHERE ID = 'C0FFEE00-0000-4000-8000-000000000008';
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000010')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES (
        'C0FFEE00-0000-4000-8000-000000000010',
        N'Collaboration: Notices The Caller May Send',
        N'A new notice is in a space the caller reaches, and it is not addressed to the caller.',
        N'(RecipientUserID <> TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER) AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))))'
    );
GO

UPDATE p
SET p.CreateRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000009'
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
WHERE e.Name = N'MJ_BizApps_Collaboration: Item Uses'
  AND p.RoleID IN ('AAF434FD-EF58-4857-854E-2607ACAF763B', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E');
GO

UPDATE p
SET p.CreateRLSFilterID = 'C0FFEE00-0000-4000-8000-000000000010'
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
WHERE e.Name = N'MJ_BizApps_Collaboration: Share Notices'
  AND p.RoleID IN ('AAF434FD-EF58-4857-854E-2607ACAF763B', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E');
GO

IF EXISTS (
    SELECT 1
    FROM [${mjSchema}].[EntityPermission] AS p
    INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
    WHERE p.CanCreate = 1
      AND p.CreateRLSFilterID IS NULL
      AND p.RoleID IN ('AAF434FD-EF58-4857-854E-2607ACAF763B', 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E')
      AND e.Name IN (N'MJ_BizApps_Collaboration: Share Notices', N'MJ_BizApps_Collaboration: Item Uses')
)
    THROW 50000, 'A creatable notice or item-use grant has no create filter.', 1;
GO
