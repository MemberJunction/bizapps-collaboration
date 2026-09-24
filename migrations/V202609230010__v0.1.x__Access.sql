-- =============================================================================
-- Collaboration access.
--
--   * ParentID is a hierarchy (EntityField.Configuration). The view columns
--     and traversal functions are emitted by the next CodeGen run.
--   * fnCollaborationAccess is the membership walk: active rows, then children
--     that inherit. A sealed space (InheritsMembership = 0) stops the walk.
--     The same walk is membershipReaches() in packages/Core.
--   * One role, Space Participant, with a filter on every collaboration entity.
--     The filter is never NULL. A NULL filter on any role the person holds
--     would exempt them from row-level security entirely.
--   * The owner of a space can read it before the first roster row exists,
--     which is what lets them seat themselves.
-- =============================================================================

UPDATE [${mjSchema}].[EntityField]
SET [Configuration] = N'{"Hierarchy":{"IsHierarchy":true}}'
WHERE [ID] = '5948F19F-70AA-49F4-BB6B-1FB059507477'
  AND [Name] = N'ParentID';
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID UNIQUEIDENTIFIER)
RETURNS @Access TABLE (
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL
)
AS
BEGIN
    ;WITH Direct AS (
        SELECT m.SpaceID,
               CAST(r.CanSeeTeamBand AS INT) AS CanSeeTeam,
               0 AS Steps
        FROM [${flyway:defaultSchema}].[SpaceMember] AS m
        INNER JOIN [${flyway:defaultSchema}].[SpaceRoleType] AS r ON r.ID = m.SpaceRoleTypeID
        WHERE m.UserID = @UserID
          AND m.Status = N'Active'
    ),
    Reachable AS (
        SELECT SpaceID, CanSeeTeam, Steps FROM Direct
        UNION ALL
        SELECT child.ID, parent.CanSeeTeam, parent.Steps + 1
        FROM [${flyway:defaultSchema}].[Space] AS child
        INNER JOIN Reachable AS parent ON child.ParentID = parent.SpaceID
        WHERE child.InheritsMembership = 1
    )
    INSERT INTO @Access (SpaceID, CanSeeTeam)
    SELECT SpaceID,
           CAST(COALESCE(MAX(CASE WHEN Steps = 0 THEN CanSeeTeam END), MAX(CanSeeTeam)) AS BIT)
    FROM Reachable
    GROUP BY SpaceID;
    RETURN;
END;
GO

-- Spaces. Owner, reaching member, or a magic-link scope aimed at this space.
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = '58B6738B-13FA-4DE7-9F89-DF300C916C27')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('58B6738B-13FA-4DE7-9F89-DF300C916C27', N'Collaboration: Visible Spaces', N'', N'');

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Name = N'Collaboration: Visible Spaces',
    Description = N'A space the caller owns, a space their active membership reaches, or the one space a magic-link scope names. Parenthesised so it ANDs onto any other filter the caller holds. TRY_CAST so a missing user id matches nothing instead of raising a conversion error.',
    FilterText = N'(OwnerID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER) OR ID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))) OR CAST(ID AS NVARCHAR(450)) = ''{{ScopeResourceID}}'')'
WHERE ID = '58B6738B-13FA-4DE7-9F89-DF300C916C27';
GO

-- Members. Their own rows (so an invitee can see the invite) plus rosters of spaces they reach.
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = '7D2320C1-4106-434B-A789-15E34C3B0F15')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('7D2320C1-4106-434B-A789-15E34C3B0F15', N'Collaboration: Visible Members', N'', N'');

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Name = N'Collaboration: Visible Members',
    Description = N'The caller''s own roster rows, active seats on spaces they reach, and invited or removed seats where their reaching role can invite.',
    FilterText = N'((Status = N''Active'' AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))) OR UserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER) OR (Status IN (N''Invited'', N''Removed'') AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)) WHERE CanInvite = 1)))'
WHERE ID = '7D2320C1-4106-434B-A789-15E34C3B0F15';
GO

-- Items. Shared when the space is visible. Team only when the reaching membership may see the team band. Magic-link scope sees Shared only.
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = '03CB9211-930A-4964-950F-A542F8971217')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('03CB9211-930A-4964-950F-A542F8971217', N'Collaboration: Visible Items', N'', N'');

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Name = N'Collaboration: Visible Items',
    Description = N'Shared items in a visible space, team items only when the reaching role has CanSeeTeamBand, and shared items in the one space a magic link names.',
    FilterText = N'((SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)) WHERE CanSeeTeam = 1) OR (Band = N''Shared'' AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))))) OR (Band = N''Shared'' AND CAST(SpaceID AS NVARCHAR(450)) = ''{{ScopeResourceID}}''))'
WHERE ID = '03CB9211-930A-4964-950F-A542F8971217';
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = '1BFCFDB6-EC62-49A8-801F-651902327D71')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('1BFCFDB6-EC62-49A8-801F-651902327D71', N'Collaboration: Active Space Types', N'', N'');

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Name = N'Collaboration: Active Space Types',
    Description = N'Space types are vocabulary, not content. Active types are readable. The filter is present so the role is not exempt from row-level security.',
    FilterText = N'(IsActive = 1)'
WHERE ID = '1BFCFDB6-EC62-49A8-801F-651902327D71';
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = '8F228922-83F0-4E92-821C-F1E00BE3192A')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('8F228922-83F0-4E92-821C-F1E00BE3192A', N'Collaboration: Active Space Roles', N'', N'');

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Name = N'Collaboration: Active Space Roles',
    Description = N'Role types are the flags the engine reads. Active roles are readable. The filter is present so the role is not exempt from row-level security.',
    FilterText = N'(IsActive = 1)'
WHERE ID = '8F228922-83F0-4E92-821C-F1E00BE3192A';
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[Role] WHERE ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B')
    INSERT INTO [${mjSchema}].[Role] (ID, Name, Description, SQLName)
    VALUES (
        'AAF434FD-EF58-4857-854E-2607ACAF763B',
        N'Space Participant',
        N'A person invited into a space. Not the UI role. Row-level security on this role is the boundary.',
        NULL
    );
GO

-- Space Participant's application role lives in metadata/application-roles.
-- No other migration names that row.

-- Entity permissions. Create and update are on, so an invited admin can write.
-- The server subclasses are the write gate. Read carries the filter.
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityPermission] WHERE ID = 'E3EE031B-0B0C-4935-BF6C-DE22281BD14D')
    INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
    VALUES ('E3EE031B-0B0C-4935-BF6C-DE22281BD14D', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'AAF434FD-EF58-4857-854E-2607ACAF763B', 1, 1, 1, 0, '58B6738B-13FA-4DE7-9F89-DF300C916C27', N'Allow');
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityPermission] WHERE ID = '5D227F12-5D91-4BDB-843F-EBF6FE30F388')
    INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
    VALUES ('5D227F12-5D91-4BDB-843F-EBF6FE30F388', 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 'AAF434FD-EF58-4857-854E-2607ACAF763B', 1, 1, 1, 0, '7D2320C1-4106-434B-A789-15E34C3B0F15', N'Allow');
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityPermission] WHERE ID = 'F08EA474-6842-40A0-895F-5DCBAFFA9208')
    INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
    VALUES ('F08EA474-6842-40A0-895F-5DCBAFFA9208', '41165FEC-A52B-469A-A880-3B108C39A65E', 'AAF434FD-EF58-4857-854E-2607ACAF763B', 1, 1, 1, 0, '03CB9211-930A-4964-950F-A542F8971217', N'Allow');
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityPermission] WHERE ID = '6F1C9E2A-4B7D-4F3A-8C91-0D5E7A2B4C18')
    INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
    VALUES ('6F1C9E2A-4B7D-4F3A-8C91-0D5E7A2B4C18', '01596359-EC4B-449C-BA16-316DE4B92A4E', 'AAF434FD-EF58-4857-854E-2607ACAF763B', 0, 1, 0, 0, '1BFCFDB6-EC62-49A8-801F-651902327D71', N'Allow');
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityPermission] WHERE ID = '9A0B1C2D-3E4F-4506-8A7B-1C2D3E4F5061')
    INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
    VALUES ('9A0B1C2D-3E4F-4506-8A7B-1C2D3E4F5061', 'FB6F4556-8DD1-4B41-908F-D1F6ECAFA20E', 'AAF434FD-EF58-4857-854E-2607ACAF763B', 0, 1, 0, 0, '8F228922-83F0-4E92-821C-F1E00BE3192A', N'Allow');
GO

-- The Space resource type lives in metadata/resource-types.
-- No other migration names that row.
