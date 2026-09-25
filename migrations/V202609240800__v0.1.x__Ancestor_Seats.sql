-- =============================================================================
-- Ancestor member reach: fnCollaborationAncestorMembers
--
-- Returns active seats on ancestor spaces that reach a space the caller reaches,
-- when that space has AllowParentAssignees = 1 and inherits membership.
-- Intermediate spaces require InheritsMembership = 1 for the membership chain
-- to flow down; their AllowParentAssignees setting governs only tasks filed
-- directly in those intermediate spaces.
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
        SELECT s.ParentID AS AncestorSpaceID,
               1 AS Steps,
               CAST(CONVERT(varchar(36), s.ID) + '/' + CONVERT(varchar(36), s.ParentID) AS varchar(max)) AS Path
        FROM [${flyway:defaultSchema}].[Space] AS s
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID) AS a ON a.SpaceID = s.ID
        WHERE s.AllowParentAssignees = 1
          AND s.InheritsMembership = 1
          AND s.ParentID IS NOT NULL
          AND s.ClosedAt IS NULL

        UNION ALL

        SELECT parent.ParentID,
               w.Steps + 1,
               w.Path + '/' + CONVERT(varchar(36), parent.ParentID)
        FROM AncestorWalk AS w
        INNER JOIN [${flyway:defaultSchema}].[Space] AS parent ON parent.ID = w.AncestorSpaceID
        WHERE parent.InheritsMembership = 1
          AND parent.ClosedAt IS NULL
          AND parent.ParentID IS NOT NULL
          AND w.Steps < 32
          AND w.Path NOT LIKE '%' + CONVERT(varchar(36), parent.ParentID) + '%'
    )
    INSERT INTO @Members (MemberID, UserID, SpaceID)
    SELECT DISTINCT m.ID, m.UserID, m.SpaceID
    FROM [${flyway:defaultSchema}].[SpaceMember] AS m
    INNER JOIN AncestorWalk AS w ON w.AncestorSpaceID = m.SpaceID
    WHERE m.Status = N'Active';

    RETURN;
END;
GO
