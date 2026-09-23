-- Pending invites are visible to the invited person and to roles that can invite.
-- A Removed seat stays visible only to that person. fnCollaborationAccess gains
-- CanInvite from the nearest seat, the same way it already carries CanSeeTeam.

DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationAccess];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID UNIQUEIDENTIFIER)
RETURNS @Access TABLE (
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL,
    CanInvite BIT NOT NULL
)
AS
BEGIN
    ;WITH Direct AS (
        SELECT m.SpaceID,
               CAST(r.CanSeeTeamBand AS INT) AS CanSeeTeam,
               CAST(r.CanInvite AS INT) AS CanInvite,
               0 AS Steps,
               CAST(CONVERT(varchar(36), m.SpaceID) AS varchar(max)) AS Path
        FROM [${flyway:defaultSchema}].[SpaceMember] AS m
        INNER JOIN [${flyway:defaultSchema}].[SpaceRoleType] AS r ON r.ID = m.SpaceRoleTypeID
        WHERE m.UserID = @UserID
          AND m.Status = N'Active'
    ),
    Reachable AS (
        SELECT SpaceID, CanSeeTeam, CanInvite, Steps, Path FROM Direct
        UNION ALL
        SELECT child.ID,
               parent.CanSeeTeam,
               parent.CanInvite,
               parent.Steps + 1,
               parent.Path + '/' + CONVERT(varchar(36), child.ID)
        FROM [${flyway:defaultSchema}].[Space] AS child
        INNER JOIN Reachable AS parent ON child.ParentID = parent.SpaceID
        WHERE child.InheritsMembership = 1
          AND parent.Steps < 32
          AND parent.Path NOT LIKE '%' + CONVERT(varchar(36), child.ID) + '%'
    )
    INSERT INTO @Access (SpaceID, CanSeeTeam, CanInvite)
    SELECT SpaceID, CAST(CanSeeTeam AS BIT), CAST(CanInvite AS BIT)
    FROM (
        SELECT SpaceID, CanSeeTeam, CanInvite,
               ROW_NUMBER() OVER (PARTITION BY SpaceID ORDER BY Steps) AS rn
        FROM Reachable
    ) AS ranked
    WHERE rn = 1
    OPTION (MAXRECURSION 32);
    RETURN;
END;
GO

UPDATE [${mjSchema}].[RowLevelSecurityFilter]
SET Description = N'The caller''s own roster rows, active seats on spaces they reach, and pending invites where their reaching role can invite.',
    FilterText = N'((Status = N''Active'' AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))) OR UserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER) OR (Status = N''Invited'' AND SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)) WHERE CanInvite = 1)))'
WHERE ID = '7D2320C1-4106-434B-A789-15E34C3B0F15';
GO
