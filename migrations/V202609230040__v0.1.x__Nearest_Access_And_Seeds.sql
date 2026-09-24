-- =============================================================================
-- Nearest membership, seeds, and shell grants.
--
-- fnCollaborationAccess now keeps the membership with the fewest steps, matching
-- membershipReaches() in packages/Core. A visited path ends a cycle. MAXRECURSION
-- 32 keeps a deep or cyclic tree from erroring every read.
--
-- Space types and roles are seeded here because a host only runs migrations.
-- The same rows are in metadata/ for a developer sync.
--
-- Space Participant receives CanRead on every __mj entity with a 1 = 0 filter.
-- The grant is present, so the shell's all-or-nothing preflight does not stop,
-- and it discloses no rows. Permission ids are assigned by the host because the
-- inventory is that host's core entity set.
-- =============================================================================

CREATE OR ALTER FUNCTION [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID UNIQUEIDENTIFIER)
RETURNS @Access TABLE (
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL
)
AS
BEGIN
    ;WITH Direct AS (
        SELECT m.SpaceID,
               CAST(r.CanSeeTeamBand AS INT) AS CanSeeTeam,
               0 AS Steps,
               CAST(CONVERT(varchar(36), m.SpaceID) AS varchar(max)) AS Path
        FROM [${flyway:defaultSchema}].[SpaceMember] AS m
        INNER JOIN [${flyway:defaultSchema}].[SpaceRoleType] AS r ON r.ID = m.SpaceRoleTypeID
        WHERE m.UserID = @UserID
          AND m.Status = N'Active'
    ),
    Reachable AS (
        SELECT SpaceID, CanSeeTeam, Steps, Path FROM Direct
        UNION ALL
        SELECT child.ID,
               parent.CanSeeTeam,
               parent.Steps + 1,
               parent.Path + '/' + CONVERT(varchar(36), child.ID)
        FROM [${flyway:defaultSchema}].[Space] AS child
        INNER JOIN Reachable AS parent ON child.ParentID = parent.SpaceID
        WHERE child.InheritsMembership = 1
          AND parent.Steps < 32
          AND parent.Path NOT LIKE '%' + CONVERT(varchar(36), child.ID) + '%'
    )
    INSERT INTO @Access (SpaceID, CanSeeTeam)
    SELECT SpaceID, CAST(CanSeeTeam AS BIT)
    FROM (
        SELECT SpaceID, CanSeeTeam,
               ROW_NUMBER() OVER (PARTITION BY SpaceID ORDER BY Steps) AS rn
        FROM Reachable
    ) AS ranked
    WHERE rn = 1
    OPTION (MAXRECURSION 32);
    RETURN;
END;
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000001')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000001', N'Collaboration: Shell Empty', N'Present and empty. A participant can boot the shell without reading core rows.', N'(1 = 0)');
GO

INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
SELECT NEWID(), e.ID, 'AAF434FD-EF58-4857-854E-2607ACAF763B', 0, 1, 0, 0, 'C0FFEE00-0000-4000-8000-000000000001', N'Allow'
FROM [${mjSchema}].[Entity] AS e
WHERE e.SchemaName = N'__mj'
  AND NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityPermission] AS p
      WHERE p.EntityID = e.ID AND p.RoleID = 'AAF434FD-EF58-4857-854E-2607ACAF763B'
  );
GO

-- Types. Stable ids so every host agrees.
IF NOT EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[SpaceType] WHERE ID = 'A1000001-0000-4000-8000-000000000001')
    INSERT INTO [${flyway:defaultSchema}].[SpaceType]
        (ID, Code, Name, Vocabulary, Discoverability, JoinMode, MessagingPanel, LibraryPanel, WorkPanel, GovernancePanel, DefaultRetention, DefaultAgentRetrieval, DefaultBand, InviteApproval)
    VALUES
        ('A1000001-0000-4000-8000-000000000001', N'workspace', N'Workspace', N'workspace', N'Hidden', N'InviteOnly', 1, 1, 1, 0, N'Indefinite', N'Included', N'Team', N'Approve'),
        ('A1000001-0000-4000-8000-000000000002', N'committee', N'Committee', N'committee', N'Listed', N'InviteOnly', 1, 1, 1, 1, N'Year', N'Included', N'Team', N'Approve'),
        ('A1000001-0000-4000-8000-000000000003', N'cohort', N'Cohort', N'cohort', N'Listed', N'RequestToJoin', 1, 1, 1, 0, N'Year', N'Included', N'Shared', N'Approve');
GO

IF NOT EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[SpaceRoleType] WHERE ID = 'B2000001-0000-4000-8000-000000000001')
    INSERT INTO [${flyway:defaultSchema}].[SpaceRoleType]
        (ID, Code, Name, Level, MaxGrantableLevel, CanInvite, CanPromoteBand, CanSeeTeamBand, IsOwnerRole)
    VALUES
        ('B2000001-0000-4000-8000-000000000001', N'owner', N'Owner', 40, 40, 1, 1, 1, 1),
        ('B2000001-0000-4000-8000-000000000002', N'admin', N'Admin', 30, 20, 1, 1, 1, 0),
        ('B2000001-0000-4000-8000-000000000003', N'member', N'Member', 20, 10, 1, 0, 1, 0),
        ('B2000001-0000-4000-8000-000000000004', N'guest', N'Guest', 10, 0, 0, 0, 0, 0);
GO
