-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Migration: V202611230415__v0.2.x__Structural_Chat_Scope.pg.sql
-- CS-1: Dual-dialect structural chat scope function returning (SpaceID, Band)
-- pairs via O(1) structural Audience reach predicates without roster
-- enumeration. Implemented as a pure LANGUAGE sql STABLE set-returning function.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS __mj_bizappscollaboration;
SET search_path TO __mj_bizappscollaboration, public;
SET standard_conforming_strings = on;

-- 1. Set-returning SQL structural chat scope function (fnCollaborationChatScope)
CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."fnCollaborationChatScope"(
    p_primary_scope_record_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    "SpaceID" UUID,
    "Band" VARCHAR(20)
) AS
$$
    WITH RECURSIVE UserDirectSeats AS (
        SELECT
            m."SpaceID",
            CASE WHEN r."CanSeeTeamBand" = TRUE THEN 1 ELSE 0 END AS "CanSeeTeam",
            0 AS "Steps",
            m."SpaceID"::TEXT AS "Path"
        FROM __mj_bizappscollaboration."SpaceMember" AS m
        INNER JOIN __mj_bizappscollaboration."Space" AS s
            ON s."ID" = m."SpaceID"
        INNER JOIN __mj_bizappscollaboration."fnCollaborationSpaceStatuses"() AS st
            ON st."SpaceID" = s."ID"
        INNER JOIN __mj_bizappscollaboration."SpaceRoleType" AS r
            ON r."ID" = m."SpaceRoleTypeID"
        WHERE p_user_id IS NOT NULL
          AND p_primary_scope_record_id IS NOT NULL
          AND m."UserID" = p_user_id
          AND m."Status" = 'Active'
          AND st."Visible" = TRUE
    ),
    UserReachable AS (
        SELECT
            "SpaceID",
            "CanSeeTeam",
            "Steps",
            "Path"
        FROM UserDirectSeats

        UNION ALL

        SELECT
            child."ID" AS "SpaceID",
            parent."CanSeeTeam",
            parent."Steps" + 1 AS "Steps",
            parent."Path" || '/' || child."ID"::TEXT AS "Path"
        FROM __mj_bizappscollaboration."Space" AS child
        INNER JOIN __mj_bizappscollaboration."fnCollaborationSpaceStatuses"() AS cst
            ON cst."SpaceID" = child."ID"
        INNER JOIN UserReachable AS parent
            ON child."ParentID" = parent."SpaceID"
        WHERE child."InheritsMembership" = TRUE
          AND parent."Steps" < 32
          AND parent."Path" NOT LIKE '%' || child."ID"::TEXT || '%'
          AND cst."Visible" = TRUE
    ),
    UserEffectiveAccess AS (
        SELECT
            "SpaceID",
            "CanSeeTeam",
            ROW_NUMBER() OVER (PARTITION BY "SpaceID" ORDER BY "Steps" ASC, "CanSeeTeam" DESC) AS rn
        FROM UserReachable
    ),
    AnchorScope AS (
        SELECT
            sc."SpaceID" AS "AnchorSpaceID",
            CASE
                WHEN sc."Kind" = 'Private' AND ua."CanSeeTeam" = 1 THEN 1
                WHEN sc."Kind" = 'Assistant' AND sc."OwnerUserID" = p_user_id THEN 1
                ELSE 0
            END AS "AllowsTeamBand"
        FROM __mj_bizappscollaboration."SpaceChat" AS sc
        INNER JOIN UserEffectiveAccess AS ua
            ON ua."SpaceID" = sc."SpaceID"
           AND ua.rn = 1
        WHERE p_primary_scope_record_id IS NOT NULL
          AND p_user_id IS NOT NULL
          AND (sc."ID" = p_primary_scope_record_id OR sc."ConversationID" = p_primary_scope_record_id)
          AND (sc."Kind" <> 'Assistant' OR sc."OwnerUserID" = p_user_id)
          AND (sc."Kind" <> 'Private' OR ua."CanSeeTeam" = 1)

        UNION ALL

        SELECT
            s."ID" AS "AnchorSpaceID",
            0 AS "AllowsTeamBand"
        FROM __mj_bizappscollaboration."Space" AS s
        INNER JOIN UserEffectiveAccess AS ua
            ON ua."SpaceID" = s."ID"
           AND ua.rn = 1
        WHERE p_primary_scope_record_id IS NOT NULL
          AND p_user_id IS NOT NULL
          AND s."ID" = p_primary_scope_record_id
          AND NOT EXISTS (
              SELECT 1
              FROM __mj_bizappscollaboration."SpaceChat" AS sc
              WHERE sc."ID" = p_primary_scope_record_id
                 OR sc."ConversationID" = p_primary_scope_record_id
          )
    ),
    AncestorCheck AS (
        SELECT
            s."ID",
            s."ParentID",
            s."AgentRetrieval",
            st."AgentRetrieval" AS "StatusAgentRetrieval",
            0 AS "Steps",
            s."ID"::TEXT AS "Path"
        FROM __mj_bizappscollaboration."Space" AS s
        INNER JOIN AnchorScope AS anc
            ON anc."AnchorSpaceID" = s."ID"
        INNER JOIN __mj_bizappscollaboration."fnCollaborationSpaceStatuses"() AS st
            ON st."SpaceID" = s."ID"

        UNION ALL

        SELECT
            p."ID",
            p."ParentID",
            p."AgentRetrieval",
            pst."AgentRetrieval" AS "StatusAgentRetrieval",
            ac."Steps" + 1 AS "Steps",
            ac."Path" || '/' || p."ID"::TEXT AS "Path"
        FROM __mj_bizappscollaboration."Space" AS p
        INNER JOIN __mj_bizappscollaboration."fnCollaborationSpaceStatuses"() AS pst
            ON pst."SpaceID" = p."ID"
        INNER JOIN AncestorCheck AS ac
            ON p."ID" = ac."ParentID"
        WHERE ac."Steps" < 32
          AND ac."Path" NOT LIKE '%' || p."ID"::TEXT || '%'
    ),
    Subtree AS (
        SELECT
            s."ID" AS "SpaceID",
            anc."AllowsTeamBand",
            0 AS "Steps",
            s."ID"::TEXT AS "Path"
        FROM __mj_bizappscollaboration."Space" AS s
        INNER JOIN AnchorScope AS anc
            ON anc."AnchorSpaceID" = s."ID"
        INNER JOIN __mj_bizappscollaboration."fnCollaborationSpaceStatuses"() AS sst
            ON sst."SpaceID" = s."ID"
        WHERE sst."AgentRetrieval" = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM AncestorCheck AS ac
              WHERE ac."AgentRetrieval" = 'ExcludedEntirely'
                 OR ac."StatusAgentRetrieval" = FALSE
          )

        UNION ALL

        SELECT
            c."ID" AS "SpaceID",
            p."AllowsTeamBand",
            p."Steps" + 1 AS "Steps",
            p."Path" || '/' || c."ID"::TEXT AS "Path"
        FROM __mj_bizappscollaboration."Space" AS c
        INNER JOIN __mj_bizappscollaboration."fnCollaborationSpaceStatuses"() AS cst
            ON cst."SpaceID" = c."ID"
        INNER JOIN Subtree AS p
            ON c."ParentID" = p."SpaceID"
        WHERE c."AgentRetrieval" NOT IN ('ExcludedEntirely', 'ExcludedFromParentScope')
          AND cst."AgentRetrieval" = TRUE
          AND p."Steps" < 32
          AND p."Path" NOT LIKE '%' || c."ID"::TEXT || '%'
    )
    SELECT DISTINCT
        sub."SpaceID" AS "SpaceID",
        bands."Band"::VARCHAR(20) AS "Band"
    FROM Subtree AS sub
    INNER JOIN UserEffectiveAccess AS ua
        ON ua."SpaceID" = sub."SpaceID"
       AND ua.rn = 1
    CROSS JOIN LATERAL (
        SELECT 'Shared'::VARCHAR(20) AS "Band"
        UNION ALL
        SELECT 'Team'::VARCHAR(20) AS "Band"
        WHERE ua."CanSeeTeam" = 1
          AND sub."AllowsTeamBand" = 1
    ) AS bands;
$$ LANGUAGE sql STABLE;

-- 2. Role EXECUTE permissions for fnCollaborationChatScope
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."fnCollaborationChatScope"(UUID, UUID) TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;

-- 3. Function documentation comment for fnCollaborationChatScope
COMMENT ON FUNCTION __mj_bizappscollaboration."fnCollaborationChatScope"(UUID, UUID) IS 'Set-returning SQL structural chat scope function returning deduplicated (SpaceID, Band) pairs for a SpaceChat or Space anchor and caller UserID in O(1) with respect to audience cardinality and zero roster enumeration.';

-- 4. CodeGen boundary























































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* No entity schema changes in this migration (SQL function only). */
