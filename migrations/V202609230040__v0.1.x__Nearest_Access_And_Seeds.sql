-- =============================================================================
-- Nearest membership access walk.
--
-- fnCollaborationAccess now keeps the membership with the fewest steps, matching
-- membershipReaches() in packages/Core. A visited path ends a cycle. MAXRECURSION
-- 32 keeps a deep or cyclic tree from erroring every read.
--
-- Space types, roles, filters, and core entity permissions live under metadata/
-- and are applied with mj sync push.
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
