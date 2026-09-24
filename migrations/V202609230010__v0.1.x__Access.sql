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

-- The role, the filters, the grants, and the Space resource type live under metadata/.
-- Push them with mj sync push. The function above stays here because it is DDL.
