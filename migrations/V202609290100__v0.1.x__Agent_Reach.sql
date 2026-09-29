-- =============================================================================
-- Agent reach: fnCollaborationSpaceAndAncestors
--
-- The spaces the caller reaches, plus every ancestor of each. A space's agent list
-- is built from its ancestors down, so an agent attached to an ancestor is one the
-- caller may run in the space they reach. The "Agents In Reach" row filter reads it.
-- =============================================================================

DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationSpaceAndAncestors];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationSpaceAndAncestors](@UserID UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN
(
    WITH Chain AS (
        SELECT a.SpaceID AS SpaceID, 0 AS Steps
        FROM [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID) AS a

        UNION ALL

        SELECT s.ParentID, c.Steps + 1
        FROM Chain AS c
        INNER JOIN [${flyway:defaultSchema}].[Space] AS s ON s.ID = c.SpaceID
        WHERE s.ParentID IS NOT NULL
          AND c.Steps < 32
    )
    SELECT DISTINCT SpaceID FROM Chain
);
GO

EXEC sp_addextendedproperty
    @name = N'MS_Description',
    @value = N'The spaces the caller reaches, plus every ancestor of each. Read by the Agents In Reach row filter: an agent attached to an ancestor space is one the caller may run in the space they reach.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'FUNCTION', @level1name = N'fnCollaborationSpaceAndAncestors';
GO
