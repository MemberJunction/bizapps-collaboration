-- ============================================================================
-- BizApps Collaboration: B23 One-walk SQL access function for Space Meetings
-- ============================================================================

CREATE OR ALTER FUNCTION [${flyway:defaultSchema}].[fnCollaborationMeetingAccess](@UserID UNIQUEIDENTIFIER)
RETURNS @Reach TABLE (
    MeetingID UNIQUEIDENTIFIER NULL,
    SeriesID UNIQUEIDENTIFIER NULL,
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL,
    CanContribute BIT NOT NULL
)
AS
BEGIN
    ;WITH LinkedSpaces AS (
        SELECT
            ml.MeetingID,
            ml.SeriesID,
            a.SpaceID,
            a.CanSeeTeam,
            a.CanContribute
        FROM [__mj_BizAppsTasks].[MeetingLink] AS ml
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID) AS a
            ON a.SpaceID = TRY_CAST(CASE WHEN ml.RecordID LIKE N'ID|%' THEN SUBSTRING(ml.RecordID, 4, 36) ELSE ml.RecordID END AS UNIQUEIDENTIFIER)
        WHERE ml.EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'
    ),
    DirectAndSeriesMeetings AS (
        SELECT
            ls.MeetingID,
            ls.SeriesID,
            ls.SpaceID,
            ls.CanSeeTeam,
            ls.CanContribute
        FROM LinkedSpaces AS ls
        WHERE ls.MeetingID IS NOT NULL

        UNION ALL

        SELECT
            CAST(NULL AS UNIQUEIDENTIFIER) AS MeetingID,
            ls.SeriesID,
            ls.SpaceID,
            ls.CanSeeTeam,
            ls.CanContribute
        FROM LinkedSpaces AS ls
        WHERE ls.SeriesID IS NOT NULL

        UNION ALL

        SELECT
            m.ID AS MeetingID,
            ls.SeriesID,
            ls.SpaceID,
            ls.CanSeeTeam,
            ls.CanContribute
        FROM LinkedSpaces AS ls
        INNER JOIN [__mj_BizAppsTasks].[Meeting] AS m ON m.SeriesID = ls.SeriesID
        WHERE ls.SeriesID IS NOT NULL
    )
    INSERT INTO @Reach (MeetingID, SeriesID, SpaceID, CanSeeTeam, CanContribute)
    SELECT
        d.MeetingID,
        d.SeriesID,
        d.SpaceID,
        CAST(MAX(CAST(d.CanSeeTeam AS INT)) AS BIT) AS CanSeeTeam,
        CAST(MAX(CAST(d.CanContribute AS INT)) AS BIT) AS CanContribute
    FROM DirectAndSeriesMeetings AS d
    LEFT JOIN [__mj_BizAppsTasks].[Meeting] AS m ON m.ID = d.MeetingID
    LEFT JOIN [__mj_BizAppsTasks].[MeetingSeries] AS ms ON ms.ID = d.SeriesID AND d.MeetingID IS NULL
    WHERE
        (
            d.MeetingID IS NOT NULL
            AND (
                m.Visibility = N'Standard'
                OR EXISTS (
                    SELECT 1
                    FROM [__mj_BizAppsTasks].[MeetingAttendee] AS ma
                    WHERE ma.MeetingID = d.MeetingID
                      AND ma.UserID = @UserID
                )
            )
        )
        OR
        (
            d.MeetingID IS NULL
            AND d.SeriesID IS NOT NULL
            AND (
                ms.Visibility = N'Standard'
                OR EXISTS (
                    SELECT 1
                    FROM [__mj_BizAppsTasks].[MeetingSeriesAttendee] AS msa
                    WHERE msa.SeriesID = d.SeriesID
                      AND msa.UserID = @UserID
                )
                OR EXISTS (
                    SELECT 1
                    FROM [__mj_BizAppsCommon].[Person] AS p
                    WHERE p.ID = ms.OrganizerPersonID
                      AND p.LinkedUserID = @UserID
                )
            )
        )
    GROUP BY d.MeetingID, d.SeriesID, d.SpaceID;

    RETURN;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.extended_properties
    WHERE major_id = OBJECT_ID(N'[${flyway:defaultSchema}].[fnCollaborationMeetingAccess]')
      AND name = N'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'One-walk reach function for meetings and series linked to spaces the caller reaches through fnCollaborationAccess.',
        @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
        @level1type = N'FUNCTION', @level1name = N'fnCollaborationMeetingAccess';
END;
GO
