-- =============================================================================
-- Collaboration access.
--
--   * ParentID does not carry the IsHierarchy flag, so CodeGen emits no path
--     columns. fnCollaborationAccess is the membership walk: active rows, then children
--     that inherit. A sealed space (InheritsMembership = 0) stops the walk.
--     The same walk is membershipReaches() in packages/Core.
--   * Space Participant role, row-level security filters, entity permissions,
--     application roles, and resource types live under metadata/ and are applied
--     with mj sync push.
-- =============================================================================

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
