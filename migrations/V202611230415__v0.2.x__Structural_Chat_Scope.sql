-- =============================================================================
-- Migration: V202611230415__v0.2.x__Structural_Chat_Scope.sql
-- CS-1: Dual-dialect structural chat scope function returning (SpaceID, Band)
-- pairs via O(1) structural Audience reach predicates without roster
-- enumeration. Implemented as a pure inline table-valued function (TVF).
-- =============================================================================

-- 1. Covering filtered index on SpaceMember(UserID, Status) for O(1) UserDirectSeats lookup
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_SpaceMember_UserID_Status_Cover'
      AND object_id = OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceMember]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SpaceMember_UserID_Status_Cover]
        ON [${flyway:defaultSchema}].[SpaceMember] ([UserID], [Status])
        INCLUDE ([SpaceID], [SpaceRoleTypeID])
        WHERE ([Status] = N'Active');
END;
GO

-- Inline structural chat scope TVF (fnCollaborationChatScope)
CREATE OR ALTER FUNCTION [${flyway:defaultSchema}].[fnCollaborationChatScope]
(
    @PrimaryScopeRecordID UNIQUEIDENTIFIER,
    @UserID UNIQUEIDENTIFIER
)
RETURNS TABLE
AS
RETURN
(
    WITH UserDirectSeats AS (
        SELECT
            m.[SpaceID],
            CAST(r.[CanSeeTeamBand] AS INT) AS [CanSeeTeam],
            0 AS [Steps],
            CAST(CONVERT(VARCHAR(36), m.[SpaceID]) AS VARCHAR(MAX)) AS [Path]
        FROM [${flyway:defaultSchema}].[SpaceMember] AS m WITH (INDEX([IX_SpaceMember_UserID_Status_Cover]), FORCESEEK)
        INNER JOIN [${flyway:defaultSchema}].[Space] AS s
            ON s.[ID] = m.[SpaceID]
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS st
            ON st.[SpaceID] = s.[ID]
        INNER JOIN [${flyway:defaultSchema}].[SpaceRoleType] AS r
            ON r.[ID] = m.[SpaceRoleTypeID]
        WHERE @UserID IS NOT NULL
          AND @PrimaryScopeRecordID IS NOT NULL
          AND m.[UserID] = @UserID
          AND m.[Status] = N'Active'
          AND st.[Visible] = 1
    ),
    UserReachable AS (
        SELECT
            [SpaceID],
            [CanSeeTeam],
            [Steps],
            [Path]
        FROM UserDirectSeats

        UNION ALL

        SELECT
            child.[ID] AS [SpaceID],
            parent.[CanSeeTeam],
            parent.[Steps] + 1 AS [Steps],
            parent.[Path] + '/' + CONVERT(VARCHAR(36), child.[ID]) AS [Path]
        FROM [${flyway:defaultSchema}].[Space] AS child
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS cst
            ON cst.[SpaceID] = child.[ID]
        INNER JOIN UserReachable AS parent
            ON child.[ParentID] = parent.[SpaceID]
        WHERE child.[InheritsMembership] = 1
          AND parent.[Steps] < 32
          AND parent.[Path] NOT LIKE '%' + CONVERT(VARCHAR(36), child.[ID]) + '%'
          AND cst.[Visible] = 1
    ),
    UserEffectiveAccess AS (
        SELECT
            [SpaceID],
            [CanSeeTeam],
            ROW_NUMBER() OVER (PARTITION BY [SpaceID] ORDER BY [Steps] ASC, [CanSeeTeam] DESC) AS [rn]
        FROM UserReachable
    ),
    AnchorScope AS (
        SELECT
            sc.[SpaceID] AS [AnchorSpaceID],
            CASE
                WHEN sc.[Kind] = N'Private' AND ua.[CanSeeTeam] = 1 THEN 1
                WHEN sc.[Kind] = N'Assistant' AND sc.[OwnerUserID] = @UserID THEN 1
                ELSE 0
            END AS [AllowsTeamBand]
        FROM [${flyway:defaultSchema}].[SpaceChat] AS sc
        INNER JOIN UserEffectiveAccess AS ua
            ON ua.[SpaceID] = sc.[SpaceID]
           AND ua.[rn] = 1
        WHERE @PrimaryScopeRecordID IS NOT NULL
          AND @UserID IS NOT NULL
          AND (sc.[ID] = @PrimaryScopeRecordID OR sc.[ConversationID] = @PrimaryScopeRecordID)
          AND (sc.[Kind] <> N'Assistant' OR sc.[OwnerUserID] = @UserID)
          AND (sc.[Kind] <> N'Private' OR ua.[CanSeeTeam] = 1)

        UNION ALL

        SELECT
            s.[ID] AS [AnchorSpaceID],
            0 AS [AllowsTeamBand]
        FROM [${flyway:defaultSchema}].[Space] AS s
        INNER JOIN UserEffectiveAccess AS ua
            ON ua.[SpaceID] = s.[ID]
           AND ua.[rn] = 1
        WHERE @PrimaryScopeRecordID IS NOT NULL
          AND @UserID IS NOT NULL
          AND s.[ID] = @PrimaryScopeRecordID
          AND NOT EXISTS (
              SELECT 1
              FROM [${flyway:defaultSchema}].[SpaceChat] AS sc
              WHERE sc.[ID] = @PrimaryScopeRecordID
                 OR sc.[ConversationID] = @PrimaryScopeRecordID
          )
    ),
    AncestorCheck AS (
        SELECT
            s.[ID],
            s.[ParentID],
            s.[AgentRetrieval],
            st.[AgentRetrieval] AS [StatusAgentRetrieval],
            0 AS [Steps],
            CAST(CONVERT(VARCHAR(36), s.[ID]) AS VARCHAR(MAX)) AS [Path]
        FROM [${flyway:defaultSchema}].[Space] AS s
        INNER JOIN AnchorScope AS anc
            ON anc.[AnchorSpaceID] = s.[ID]
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS st
            ON st.[SpaceID] = s.[ID]

        UNION ALL

        SELECT
            p.[ID],
            p.[ParentID],
            p.[AgentRetrieval],
            pst.[AgentRetrieval] AS [StatusAgentRetrieval],
            ac.[Steps] + 1 AS [Steps],
            ac.[Path] + '/' + CONVERT(VARCHAR(36), p.[ID]) AS [Path]
        FROM [${flyway:defaultSchema}].[Space] AS p
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS pst
            ON pst.[SpaceID] = p.[ID]
        INNER JOIN AncestorCheck AS ac
            ON p.[ID] = ac.[ParentID]
        WHERE ac.[Steps] < 32
          AND ac.[Path] NOT LIKE '%' + CONVERT(VARCHAR(36), p.[ID]) + '%'
    ),
    Subtree AS (
        SELECT
            s.[ID] AS [SpaceID],
            anc.[AllowsTeamBand],
            0 AS [Steps],
            CAST(CONVERT(VARCHAR(36), s.[ID]) AS VARCHAR(MAX)) AS [Path]
        FROM [${flyway:defaultSchema}].[Space] AS s
        INNER JOIN AnchorScope AS anc
            ON anc.[AnchorSpaceID] = s.[ID]
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS sst
            ON sst.[SpaceID] = s.[ID]
        WHERE sst.[AgentRetrieval] = 1
          AND NOT EXISTS (
              SELECT 1
              FROM AncestorCheck AS ac
              WHERE ac.[AgentRetrieval] = N'ExcludedEntirely'
                 OR ac.[StatusAgentRetrieval] = 0
          )

        UNION ALL

        SELECT
            c.[ID] AS [SpaceID],
            p.[AllowsTeamBand],
            p.[Steps] + 1 AS [Steps],
            p.[Path] + '/' + CONVERT(VARCHAR(36), c.[ID]) AS [Path]
        FROM [${flyway:defaultSchema}].[Space] AS c
        INNER JOIN [${flyway:defaultSchema}].[fnCollaborationSpaceStatuses]() AS cst
            ON cst.[SpaceID] = c.[ID]
        INNER JOIN Subtree AS p
            ON c.[ParentID] = p.[SpaceID]
        WHERE c.[AgentRetrieval] NOT IN (N'ExcludedEntirely', N'ExcludedFromParentScope')
          AND cst.[AgentRetrieval] = 1
          AND p.[Steps] < 32
          AND p.[Path] NOT LIKE '%' + CONVERT(VARCHAR(36), c.[ID]) + '%'
    )
    SELECT DISTINCT
        sub.[SpaceID] AS [SpaceID],
        bands.[Band] AS [Band]
    FROM Subtree AS sub
    INNER JOIN UserEffectiveAccess AS ua
        ON ua.[SpaceID] = sub.[SpaceID]
       AND ua.[rn] = 1
    CROSS APPLY (
        SELECT CAST(N'Shared' AS NVARCHAR(20)) AS [Band]
        UNION ALL
        SELECT CAST(N'Team' AS NVARCHAR(20)) AS [Band]
        WHERE ua.[CanSeeTeam] = 1
          AND sub.[AllowsTeamBand] = 1
    ) AS bands
);
GO

-- 2. Role SELECT permissions for fnCollaborationChatScope
GRANT SELECT ON [${flyway:defaultSchema}].[fnCollaborationChatScope] TO [cdp_UI], [cdp_Developer], [cdp_Integration];
GO

-- 3. Extended properties documentation for fnCollaborationChatScope
IF NOT EXISTS (
    SELECT 1
    FROM sys.extended_properties
    WHERE major_id = OBJECT_ID(N'[${flyway:defaultSchema}].[fnCollaborationChatScope]')
      AND name = N'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty
        @name = N'MS_Description',
        @value = N'Inline structural chat scope TVF returning deduplicated (SpaceID, Band) pairs for a SpaceChat or Space anchor and caller UserID in O(1) with respect to audience cardinality and zero roster enumeration.',
        @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
        @level1type = N'FUNCTION', @level1name = N'fnCollaborationChatScope';
END;
GO

-- 4. CodeGen boundary























































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* No entity schema changes in this migration (inline TVF only). */
