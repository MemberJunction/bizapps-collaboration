-- =============================================================================
-- Ancestor member reach, with the post-close check at every hop
--
-- fnCollaborationAncestorMembers returned the active seats of an ancestor without asking whether that ancestor's post-close
-- access had ended: the first hop checked only the child's ClosedAt, and a later hop only that the space it stood on was open.
-- So a parent closed with no post-close access still had its people listed under a child a viewer reaches, and offered as
-- assignees there, while fnCollaborationAccess (and Core's membershipReaches) say the parent no longer reaches anyone.
--
-- Every ancestor the walk reaches must now be open, or closed with post-close access that is still running, judged exactly as
-- fnCollaborationAccess judges it (the space's own value, else its type's, else None; the days window from the same fallback).
-- A closed ancestor whose access is still running keeps its seats and the walk goes on above it, as it does there.
-- =============================================================================

DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationAncestorMembers];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationAncestorMembers](@UserID UNIQUEIDENTIFIER)
RETURNS @Members TABLE (
    MemberID UNIQUEIDENTIFIER NOT NULL,
    UserID UNIQUEIDENTIFIER NOT NULL,
    SpaceID UNIQUEIDENTIFIER NOT NULL
)
AS
BEGIN
    ;WITH AncestorWalk AS (
        SELECT p.ID AS AncestorSpaceID,
               1 AS Steps,
               CAST(CONVERT(varchar(36), s.ID) + '/' + CONVERT(varchar(36), p.ID) AS varchar(max)) AS Path
        FROM [${flyway:defaultSchema}].[Space] AS s
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID) AS a ON a.SpaceID = s.ID
        INNER JOIN [${flyway:defaultSchema}].[Space] AS p ON p.ID = s.ParentID
        INNER JOIN [${flyway:defaultSchema}].[SpaceType] AS pt ON pt.ID = p.SpaceTypeID
        WHERE s.AllowParentAssignees = 1
          AND s.InheritsMembership = 1
          AND s.ClosedAt IS NULL
          AND (
              p.ClosedAt IS NULL
              OR (
                  COALESCE(p.PostCloseAccess, pt.PostCloseAccess, N'None') IN (N'ReadOnly', N'ReadOnlyWithAgent')
                  AND (
                      COALESCE(p.PostCloseAccessDays, pt.PostCloseAccessDays) IS NULL
                      OR DATEDIFF(day, p.ClosedAt, GETUTCDATE()) <= COALESCE(p.PostCloseAccessDays, pt.PostCloseAccessDays)
                  )
              )
          )

        UNION ALL

        SELECT gp.ID,
               w.Steps + 1,
               w.Path + '/' + CONVERT(varchar(36), gp.ID)
        FROM AncestorWalk AS w
        INNER JOIN [${flyway:defaultSchema}].[Space] AS cur ON cur.ID = w.AncestorSpaceID
        INNER JOIN [${flyway:defaultSchema}].[Space] AS gp ON gp.ID = cur.ParentID
        INNER JOIN [${flyway:defaultSchema}].[SpaceType] AS gpt ON gpt.ID = gp.SpaceTypeID
        WHERE cur.InheritsMembership = 1
          AND w.Steps < 32
          AND w.Path NOT LIKE '%' + CONVERT(varchar(36), gp.ID) + '%'
          AND (
              gp.ClosedAt IS NULL
              OR (
                  COALESCE(gp.PostCloseAccess, gpt.PostCloseAccess, N'None') IN (N'ReadOnly', N'ReadOnlyWithAgent')
                  AND (
                      COALESCE(gp.PostCloseAccessDays, gpt.PostCloseAccessDays) IS NULL
                      OR DATEDIFF(day, gp.ClosedAt, GETUTCDATE()) <= COALESCE(gp.PostCloseAccessDays, gpt.PostCloseAccessDays)
                  )
              )
          )
    )
    INSERT INTO @Members (MemberID, UserID, SpaceID)
    SELECT DISTINCT m.ID, m.UserID, m.SpaceID
    FROM [${flyway:defaultSchema}].[SpaceMember] AS m
    INNER JOIN AncestorWalk AS w ON w.AncestorSpaceID = m.SpaceID
    WHERE m.Status = N'Active';

    RETURN;
END;
GO
