-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Migration: V202611231630__v0.2.x__Space_Notices_And_Watermarks.pg.sql
-- Sub-Epic S10 (Slice 1): Additive dual-dialect schema foundation for:
--   1. SpaceNoticeEvent      (CS-4 O(1) fan-out-on-read space notice events)
--   2. SpaceNoticeWatermark  (CS-4 per-member monotonic composite read watermarks)
--   3. SpaceDigestCheckpoint (NT-2 deterministic keyset digest cursor checkpoints)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS __mj_bizappscollaboration;
SET search_path TO __mj_bizappscollaboration, public;
SET standard_conforming_strings = on;

-- 1. Create SpaceNoticeEvent table (1 row per space event, O(1) write amplification)
CREATE TABLE IF NOT EXISTS __mj_bizappscollaboration."SpaceNoticeEvent" (
    "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
    "SpaceID" UUID NOT NULL,
    "ActorUserID" UUID NULL,
    "EventKind" VARCHAR(50) NOT NULL,
    "Band" VARCHAR(20) NOT NULL DEFAULT 'Shared',
    "Title" VARCHAR(500) NOT NULL,
    "Body" TEXT NULL,
    "TargetEntityID" UUID NULL,
    "TargetRecordID" VARCHAR(450) NULL,
    "MetadataJSON" TEXT NULL,
    "EventTimestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "__mj_CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "__mj_UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_SpaceNoticeEvent" PRIMARY KEY ("ID"),
    CONSTRAINT "FK_SpaceNoticeEvent_Space" FOREIGN KEY ("SpaceID") REFERENCES __mj_bizappscollaboration."Space" ("ID"),
    CONSTRAINT "FK_SpaceNoticeEvent_ActorUser" FOREIGN KEY ("ActorUserID") REFERENCES ${mjSchema}."User" ("ID"),
    CONSTRAINT "FK_SpaceNoticeEvent_TargetEntity" FOREIGN KEY ("TargetEntityID") REFERENCES ${mjSchema}."Entity" ("ID"),
    CONSTRAINT "CK_SpaceNoticeEvent_EventKind" CHECK (
        "EventKind" IN ('Share', 'StatusChanged', 'Mention', 'Reply', 'Task', 'Approval', 'Announcement', 'System')
    ),
    CONSTRAINT "CK_SpaceNoticeEvent_Band" CHECK ("Band" IN ('Shared', 'Team'))
);

CREATE INDEX IF NOT EXISTS "IX_SpaceNoticeEvent_Space_EventTimestamp_ID"
    ON __mj_bizappscollaboration."SpaceNoticeEvent" ("SpaceID", "EventTimestamp", "ID");

CREATE INDEX IF NOT EXISTS "IX_SpaceNoticeEvent_Space_Band_EventTimestamp_ID"
    ON __mj_bizappscollaboration."SpaceNoticeEvent" ("SpaceID", "Band", "EventTimestamp", "ID");

CREATE INDEX IF NOT EXISTS "IX_SpaceNoticeEvent_EventTimestamp_ID"
    ON __mj_bizappscollaboration."SpaceNoticeEvent" ("EventTimestamp", "ID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_SpaceID"
    ON __mj_bizappscollaboration."SpaceNoticeEvent" ("SpaceID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_ActorUserID"
    ON __mj_bizappscollaboration."SpaceNoticeEvent" ("ActorUserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceNoticeEvent_TargetEntityID"
    ON __mj_bizappscollaboration."SpaceNoticeEvent" ("TargetEntityID");

-- 2. Create SpaceNoticeWatermark table (per-member monotonic read cursor per space)
CREATE TABLE IF NOT EXISTS __mj_bizappscollaboration."SpaceNoticeWatermark" (
    "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
    "SpaceID" UUID NOT NULL,
    "UserID" UUID NOT NULL,
    "LastReadEventTimestamp" TIMESTAMPTZ NOT NULL,
    "LastReadEventID" UUID NULL,
    "LastReadAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "__mj_CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "__mj_UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_SpaceNoticeWatermark" PRIMARY KEY ("ID"),
    CONSTRAINT "FK_SpaceNoticeWatermark_Space" FOREIGN KEY ("SpaceID") REFERENCES __mj_bizappscollaboration."Space" ("ID"),
    CONSTRAINT "FK_SpaceNoticeWatermark_User" FOREIGN KEY ("UserID") REFERENCES ${mjSchema}."User" ("ID"),
    CONSTRAINT "UQ_SpaceNoticeWatermark_Space_User" UNIQUE ("SpaceID", "UserID")
);

CREATE INDEX IF NOT EXISTS "IX_SpaceNoticeWatermark_User_Space"
    ON __mj_bizappscollaboration."SpaceNoticeWatermark" ("UserID", "SpaceID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceNoticeWatermark_SpaceID"
    ON __mj_bizappscollaboration."SpaceNoticeWatermark" ("SpaceID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceNoticeWatermark_UserID"
    ON __mj_bizappscollaboration."SpaceNoticeWatermark" ("UserID");

-- 3. Create SpaceDigestCheckpoint table (deterministic keyset checkpoint for scheduled digests)
CREATE TABLE IF NOT EXISTS __mj_bizappscollaboration."SpaceDigestCheckpoint" (
    "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
    "UserID" UUID NOT NULL,
    "SpaceID" UUID NULL,
    "Cadence" VARCHAR(20) NOT NULL DEFAULT 'Daily',
    "LastDeliveredTimestamp" TIMESTAMPTZ NOT NULL,
    "LastDeliveredRecordID" UUID NULL,
    "LastDeliveredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "ItemsIncludedCount" INTEGER NOT NULL DEFAULT 0,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Active',
    "__mj_CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "__mj_UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "PK_SpaceDigestCheckpoint" PRIMARY KEY ("ID"),
    CONSTRAINT "FK_SpaceDigestCheckpoint_User" FOREIGN KEY ("UserID") REFERENCES ${mjSchema}."User" ("ID"),
    CONSTRAINT "FK_SpaceDigestCheckpoint_Space" FOREIGN KEY ("SpaceID") REFERENCES __mj_bizappscollaboration."Space" ("ID"),
    CONSTRAINT "CK_SpaceDigestCheckpoint_Cadence" CHECK ("Cadence" IN ('Daily', 'Weekly', 'Immediate', 'Custom')),
    CONSTRAINT "CK_SpaceDigestCheckpoint_ItemsIncludedCount" CHECK ("ItemsIncludedCount" >= 0),
    CONSTRAINT "CK_SpaceDigestCheckpoint_Status" CHECK ("Status" IN ('Active', 'Paused'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_SpaceDigestCheckpoint_User_Global_Cadence"
    ON __mj_bizappscollaboration."SpaceDigestCheckpoint" ("UserID", "Cadence")
    WHERE ("SpaceID" IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_SpaceDigestCheckpoint_User_Space_Cadence"
    ON __mj_bizappscollaboration."SpaceDigestCheckpoint" ("UserID", "SpaceID", "Cadence")
    WHERE ("SpaceID" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceDigestCheckpoint_UserID"
    ON __mj_bizappscollaboration."SpaceDigestCheckpoint" ("UserID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceDigestCheckpoint_SpaceID"
    ON __mj_bizappscollaboration."SpaceDigestCheckpoint" ("SpaceID");

-- 4. PostgreSQL RLS helpers and native Row-Level Security policies
CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."fnCanReadSpaceNoticeEventRow"(
    p_user_id UUID,
    p_space_id UUID,
    p_band VARCHAR
)
RETURNS BOOLEAN AS
$$
    SELECT CASE
        WHEN p_user_id IS NULL THEN FALSE
        ELSE EXISTS (
            SELECT 1
            FROM __mj_bizappscollaboration."fnCollaborationAccess"(p_user_id) AS sa
            WHERE sa."SpaceID" = p_space_id
              AND (sa."CanSeeTeam" = TRUE OR p_band = 'Shared')
        )
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = __mj_bizappscollaboration, pg_temp;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."fnCanReadSpaceNoticeWatermarkRow"(
    p_user_id UUID,
    p_space_id UUID,
    p_row_user_id UUID
)
RETURNS BOOLEAN AS
$$
    SELECT CASE
        WHEN p_user_id IS NULL OR p_row_user_id IS NULL OR p_user_id <> p_row_user_id THEN FALSE
        ELSE EXISTS (
            SELECT 1
            FROM __mj_bizappscollaboration."fnCollaborationAccess"(p_user_id) AS sa
            WHERE sa."SpaceID" = p_space_id
        )
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = __mj_bizappscollaboration, pg_temp;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."fnCanReadSpaceDigestCheckpointRow"(
    p_user_id UUID,
    p_space_id UUID,
    p_row_user_id UUID
)
RETURNS BOOLEAN AS
$$
    SELECT CASE
        WHEN p_user_id IS NULL OR p_row_user_id IS NULL OR p_user_id <> p_row_user_id THEN FALSE
        WHEN p_space_id IS NULL THEN TRUE
        ELSE EXISTS (
            SELECT 1
            FROM __mj_bizappscollaboration."fnCollaborationAccess"(p_user_id) AS sa
            WHERE sa."SpaceID" = p_space_id
        )
    END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = __mj_bizappscollaboration, pg_temp;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."fnIsPrivilegedNoticeSession"()
RETURNS BOOLEAN AS
$$
    SELECT current_user <> 'cdp_UI'
       AND (
           LOWER(COALESCE(NULLIF(BTRIM(current_setting('app.bypass_rls', true)), ''), 'false')) = 'true'
           OR (
               (
                   current_user IN ('cdp_Integration', 'cdp_Developer')
                   OR CASE
                       WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Integration')
                       THEN pg_has_role(current_user, 'cdp_Integration', 'MEMBER')
                       ELSE FALSE
                   END
                   OR CASE
                       WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cdp_Developer')
                       THEN pg_has_role(current_user, 'cdp_Developer', 'MEMBER')
                       ELSE FALSE
                   END
               )
               AND NULLIF(BTRIM(current_setting('app.current_user_id', true)), '') IS NULL
               AND NULLIF(BTRIM(current_setting('mj.current_user_id', true)), '') IS NULL
           )
       );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."fnIsSpaceNoticeEventRowVisible"(
    p_space_id UUID,
    p_band VARCHAR
)
RETURNS BOOLEAN AS
$$
    SELECT CASE
        WHEN current_user <> 'cdp_UI'
         AND LOWER(COALESCE(NULLIF(BTRIM(current_setting('app.bypass_rls', true)), ''), 'false')) = 'true'
        THEN TRUE
        WHEN current_user = 'cdp_UI'
          OR NULLIF(BTRIM(current_setting('app.current_user_id', true)), '') IS NOT NULL
          OR NULLIF(BTRIM(current_setting('mj.current_user_id', true)), '') IS NOT NULL
        THEN __mj_bizappscollaboration."fnCanReadSpaceNoticeEventRow"(
            COALESCE(
                __mj_bizappscollaboration."fnTryParseUuid"(current_setting('app.current_user_id', true)),
                __mj_bizappscollaboration."fnTryParseUuid"(current_setting('mj.current_user_id', true))
            ),
            p_space_id,
            p_band
        )
        WHEN __mj_bizappscollaboration."fnIsPrivilegedNoticeSession"()
        THEN TRUE
        ELSE FALSE
    END;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."fnIsSpaceNoticeWatermarkRowVisible"(
    p_space_id UUID,
    p_row_user_id UUID
)
RETURNS BOOLEAN AS
$$
    SELECT CASE
        WHEN current_user <> 'cdp_UI'
         AND LOWER(COALESCE(NULLIF(BTRIM(current_setting('app.bypass_rls', true)), ''), 'false')) = 'true'
        THEN TRUE
        WHEN current_user = 'cdp_UI'
          OR NULLIF(BTRIM(current_setting('app.current_user_id', true)), '') IS NOT NULL
          OR NULLIF(BTRIM(current_setting('mj.current_user_id', true)), '') IS NOT NULL
        THEN __mj_bizappscollaboration."fnCanReadSpaceNoticeWatermarkRow"(
            COALESCE(
                __mj_bizappscollaboration."fnTryParseUuid"(current_setting('app.current_user_id', true)),
                __mj_bizappscollaboration."fnTryParseUuid"(current_setting('mj.current_user_id', true))
            ),
            p_space_id,
            p_row_user_id
        )
        WHEN __mj_bizappscollaboration."fnIsPrivilegedNoticeSession"()
        THEN TRUE
        ELSE FALSE
    END;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."fnIsSpaceDigestCheckpointRowVisible"(
    p_space_id UUID,
    p_row_user_id UUID
)
RETURNS BOOLEAN AS
$$
    SELECT CASE
        WHEN current_user <> 'cdp_UI'
         AND LOWER(COALESCE(NULLIF(BTRIM(current_setting('app.bypass_rls', true)), ''), 'false')) = 'true'
        THEN TRUE
        WHEN current_user = 'cdp_UI'
          OR NULLIF(BTRIM(current_setting('app.current_user_id', true)), '') IS NOT NULL
          OR NULLIF(BTRIM(current_setting('mj.current_user_id', true)), '') IS NOT NULL
        THEN __mj_bizappscollaboration."fnCanReadSpaceDigestCheckpointRow"(
            COALESCE(
                __mj_bizappscollaboration."fnTryParseUuid"(current_setting('app.current_user_id', true)),
                __mj_bizappscollaboration."fnTryParseUuid"(current_setting('mj.current_user_id', true))
            ),
            p_space_id,
            p_row_user_id
        )
        WHEN __mj_bizappscollaboration."fnIsPrivilegedNoticeSession"()
        THEN TRUE
        ELSE FALSE
    END;
$$ LANGUAGE sql STABLE;

ALTER TABLE __mj_bizappscollaboration."SpaceNoticeEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE __mj_bizappscollaboration."SpaceNoticeEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_space_notice_event_read_in_reach" ON __mj_bizappscollaboration."SpaceNoticeEvent";
CREATE POLICY "p_space_notice_event_read_in_reach"
    ON __mj_bizappscollaboration."SpaceNoticeEvent"
    FOR SELECT
    USING (__mj_bizappscollaboration."fnIsSpaceNoticeEventRowVisible"("SpaceID", "Band") = TRUE);

DROP POLICY IF EXISTS "p_space_notice_event_insert_server" ON __mj_bizappscollaboration."SpaceNoticeEvent";
CREATE POLICY "p_space_notice_event_insert_server"
    ON __mj_bizappscollaboration."SpaceNoticeEvent"
    FOR INSERT
    WITH CHECK (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

DROP POLICY IF EXISTS "p_space_notice_event_update_server" ON __mj_bizappscollaboration."SpaceNoticeEvent";
CREATE POLICY "p_space_notice_event_update_server"
    ON __mj_bizappscollaboration."SpaceNoticeEvent"
    FOR UPDATE
    USING (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE)
    WITH CHECK (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

DROP POLICY IF EXISTS "p_space_notice_event_delete_server" ON __mj_bizappscollaboration."SpaceNoticeEvent";
CREATE POLICY "p_space_notice_event_delete_server"
    ON __mj_bizappscollaboration."SpaceNoticeEvent"
    FOR DELETE
    USING (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

ALTER TABLE __mj_bizappscollaboration."SpaceNoticeWatermark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE __mj_bizappscollaboration."SpaceNoticeWatermark" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_space_notice_watermark_read_own" ON __mj_bizappscollaboration."SpaceNoticeWatermark";
CREATE POLICY "p_space_notice_watermark_read_own"
    ON __mj_bizappscollaboration."SpaceNoticeWatermark"
    FOR SELECT
    USING (__mj_bizappscollaboration."fnIsSpaceNoticeWatermarkRowVisible"("SpaceID", "UserID") = TRUE);

DROP POLICY IF EXISTS "p_space_notice_watermark_insert_server" ON __mj_bizappscollaboration."SpaceNoticeWatermark";
CREATE POLICY "p_space_notice_watermark_insert_server"
    ON __mj_bizappscollaboration."SpaceNoticeWatermark"
    FOR INSERT
    WITH CHECK (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

DROP POLICY IF EXISTS "p_space_notice_watermark_update_server" ON __mj_bizappscollaboration."SpaceNoticeWatermark";
CREATE POLICY "p_space_notice_watermark_update_server"
    ON __mj_bizappscollaboration."SpaceNoticeWatermark"
    FOR UPDATE
    USING (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE)
    WITH CHECK (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

DROP POLICY IF EXISTS "p_space_notice_watermark_delete_server" ON __mj_bizappscollaboration."SpaceNoticeWatermark";
CREATE POLICY "p_space_notice_watermark_delete_server"
    ON __mj_bizappscollaboration."SpaceNoticeWatermark"
    FOR DELETE
    USING (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

ALTER TABLE __mj_bizappscollaboration."SpaceDigestCheckpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE __mj_bizappscollaboration."SpaceDigestCheckpoint" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "p_space_digest_checkpoint_read_own" ON __mj_bizappscollaboration."SpaceDigestCheckpoint";
CREATE POLICY "p_space_digest_checkpoint_read_own"
    ON __mj_bizappscollaboration."SpaceDigestCheckpoint"
    FOR SELECT
    USING (__mj_bizappscollaboration."fnIsSpaceDigestCheckpointRowVisible"("SpaceID", "UserID") = TRUE);

DROP POLICY IF EXISTS "p_space_digest_checkpoint_insert_server" ON __mj_bizappscollaboration."SpaceDigestCheckpoint";
CREATE POLICY "p_space_digest_checkpoint_insert_server"
    ON __mj_bizappscollaboration."SpaceDigestCheckpoint"
    FOR INSERT
    WITH CHECK (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

DROP POLICY IF EXISTS "p_space_digest_checkpoint_update_server" ON __mj_bizappscollaboration."SpaceDigestCheckpoint";
CREATE POLICY "p_space_digest_checkpoint_update_server"
    ON __mj_bizappscollaboration."SpaceDigestCheckpoint"
    FOR UPDATE
    USING (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE)
    WITH CHECK (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

DROP POLICY IF EXISTS "p_space_digest_checkpoint_delete_server" ON __mj_bizappscollaboration."SpaceDigestCheckpoint";
CREATE POLICY "p_space_digest_checkpoint_delete_server"
    ON __mj_bizappscollaboration."SpaceDigestCheckpoint"
    FOR DELETE
    USING (__mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() = TRUE);

-- 5. CodeGen boundary























































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

-- ===================== Views =====================

CREATE OR REPLACE VIEW __mj_bizappscollaboration."vwSpaceNoticeEvents"
WITH (security_invoker = true)
AS SELECT
    s.*,
    "mjBizAppsCollaborationSpace_SpaceID"."Name" AS "Space",
    "MJUser_ActorUserID"."Name" AS "ActorUser",
    "MJEntity_TargetEntityID"."Name" AS "TargetEntity"
FROM
    __mj_bizappscollaboration."SpaceNoticeEvent" AS s
INNER JOIN
    __mj_bizappscollaboration."Space" AS "mjBizAppsCollaborationSpace_SpaceID"
  ON s."SpaceID" = "mjBizAppsCollaborationSpace_SpaceID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."User" AS "MJUser_ActorUserID"
  ON s."ActorUserID" = "MJUser_ActorUserID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Entity" AS "MJEntity_TargetEntityID"
  ON s."TargetEntityID" = "MJEntity_TargetEntityID"."ID"
WHERE
    __mj_bizappscollaboration."fnIsSpaceNoticeEventRowVisible"(s."SpaceID", s."Band") = TRUE;

CREATE OR REPLACE VIEW __mj_bizappscollaboration."vwSpaceNoticeEventsAuthorized"
WITH (security_invoker = true)
AS SELECT v.*
FROM __mj_bizappscollaboration."vwSpaceNoticeEvents" AS v;

CREATE OR REPLACE VIEW __mj_bizappscollaboration."vwSpaceNoticeWatermarks"
WITH (security_invoker = true)
AS SELECT
    s.*,
    "mjBizAppsCollaborationSpace_SpaceID"."Name" AS "Space",
    "MJUser_UserID"."Name" AS "User"
FROM
    __mj_bizappscollaboration."SpaceNoticeWatermark" AS s
INNER JOIN
    __mj_bizappscollaboration."Space" AS "mjBizAppsCollaborationSpace_SpaceID"
  ON s."SpaceID" = "mjBizAppsCollaborationSpace_SpaceID"."ID"
INNER JOIN
    ${mjSchema}."User" AS "MJUser_UserID"
  ON s."UserID" = "MJUser_UserID"."ID"
WHERE
    __mj_bizappscollaboration."fnIsSpaceNoticeWatermarkRowVisible"(s."SpaceID", s."UserID") = TRUE;

CREATE OR REPLACE VIEW __mj_bizappscollaboration."vwSpaceNoticeWatermarksAuthorized"
WITH (security_invoker = true)
AS SELECT v.*
FROM __mj_bizappscollaboration."vwSpaceNoticeWatermarks" AS v;

CREATE OR REPLACE VIEW __mj_bizappscollaboration."vwSpaceDigestCheckpoints"
WITH (security_invoker = true)
AS SELECT
    s.*,
    "MJUser_UserID"."Name" AS "User",
    "mjBizAppsCollaborationSpace_SpaceID"."Name" AS "Space"
FROM
    __mj_bizappscollaboration."SpaceDigestCheckpoint" AS s
INNER JOIN
    ${mjSchema}."User" AS "MJUser_UserID"
  ON s."UserID" = "MJUser_UserID"."ID"
LEFT OUTER JOIN
    __mj_bizappscollaboration."Space" AS "mjBizAppsCollaborationSpace_SpaceID"
  ON s."SpaceID" = "mjBizAppsCollaborationSpace_SpaceID"."ID"
WHERE
    __mj_bizappscollaboration."fnIsSpaceDigestCheckpointRowVisible"(s."SpaceID", s."UserID") = TRUE;

CREATE OR REPLACE VIEW __mj_bizappscollaboration."vwSpaceDigestCheckpointsAuthorized"
WITH (security_invoker = true)
AS SELECT v.*
FROM __mj_bizappscollaboration."vwSpaceDigestCheckpoints" AS v;

-- ===================== Stored Procedures (sp*) =====================

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spCreateSpaceNoticeEvent"(
    IN p_ID UUID DEFAULT NULL,
    IN p_SpaceID UUID DEFAULT NULL,
    IN p_ActorUserID_Clear BOOLEAN DEFAULT FALSE,
    IN p_ActorUserID UUID DEFAULT NULL,
    IN p_EventKind VARCHAR(50) DEFAULT NULL,
    IN p_Band VARCHAR(20) DEFAULT NULL,
    IN p_Title VARCHAR(500) DEFAULT NULL,
    IN p_Body_Clear BOOLEAN DEFAULT FALSE,
    IN p_Body TEXT DEFAULT NULL,
    IN p_TargetEntityID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetEntityID UUID DEFAULT NULL,
    IN p_TargetRecordID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetRecordID VARCHAR(450) DEFAULT NULL,
    IN p_MetadataJSON_Clear BOOLEAN DEFAULT FALSE,
    IN p_MetadataJSON TEXT DEFAULT NULL,
    IN p_EventTimestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF __mj_bizappscollaboration."vwSpaceNoticeEvents" AS
$$
DECLARE
    v_inserted_id UUID;
BEGIN
    IF p_ID IS NOT NULL THEN
        INSERT INTO __mj_bizappscollaboration."SpaceNoticeEvent" (
            "ID", "SpaceID", "ActorUserID", "EventKind", "Band", "Title", "Body",
            "TargetEntityID", "TargetRecordID", "MetadataJSON", "EventTimestamp"
        )
        VALUES (
            p_ID, p_SpaceID,
            CASE WHEN p_ActorUserID_Clear = TRUE THEN NULL ELSE p_ActorUserID END,
            p_EventKind, COALESCE(p_Band, 'Shared'), p_Title,
            CASE WHEN p_Body_Clear = TRUE THEN NULL ELSE p_Body END,
            CASE WHEN p_TargetEntityID_Clear = TRUE THEN NULL ELSE p_TargetEntityID END,
            CASE WHEN p_TargetRecordID_Clear = TRUE THEN NULL ELSE p_TargetRecordID END,
            CASE WHEN p_MetadataJSON_Clear = TRUE THEN NULL ELSE p_MetadataJSON END,
            COALESCE(p_EventTimestamp, NOW())
        )
        RETURNING "ID" INTO v_inserted_id;
    ELSE
        INSERT INTO __mj_bizappscollaboration."SpaceNoticeEvent" (
            "SpaceID", "ActorUserID", "EventKind", "Band", "Title", "Body",
            "TargetEntityID", "TargetRecordID", "MetadataJSON", "EventTimestamp"
        )
        VALUES (
            p_SpaceID,
            CASE WHEN p_ActorUserID_Clear = TRUE THEN NULL ELSE p_ActorUserID END,
            p_EventKind, COALESCE(p_Band, 'Shared'), p_Title,
            CASE WHEN p_Body_Clear = TRUE THEN NULL ELSE p_Body END,
            CASE WHEN p_TargetEntityID_Clear = TRUE THEN NULL ELSE p_TargetEntityID END,
            CASE WHEN p_TargetRecordID_Clear = TRUE THEN NULL ELSE p_TargetRecordID END,
            CASE WHEN p_MetadataJSON_Clear = TRUE THEN NULL ELSE p_MetadataJSON END,
            COALESCE(p_EventTimestamp, NOW())
        )
        RETURNING "ID" INTO v_inserted_id;
    END IF;
    RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceNoticeEvents" WHERE "ID" = v_inserted_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spUpdateSpaceNoticeEvent"(
    IN p_ID UUID,
    IN p_SpaceID UUID DEFAULT NULL,
    IN p_ActorUserID_Clear BOOLEAN DEFAULT FALSE,
    IN p_ActorUserID UUID DEFAULT NULL,
    IN p_EventKind VARCHAR(50) DEFAULT NULL,
    IN p_Band VARCHAR(20) DEFAULT NULL,
    IN p_Title VARCHAR(500) DEFAULT NULL,
    IN p_Body_Clear BOOLEAN DEFAULT FALSE,
    IN p_Body TEXT DEFAULT NULL,
    IN p_TargetEntityID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetEntityID UUID DEFAULT NULL,
    IN p_TargetRecordID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetRecordID VARCHAR(450) DEFAULT NULL,
    IN p_MetadataJSON_Clear BOOLEAN DEFAULT FALSE,
    IN p_MetadataJSON TEXT DEFAULT NULL,
    IN p_EventTimestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF __mj_bizappscollaboration."vwSpaceNoticeEvents" AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
    UPDATE __mj_bizappscollaboration."SpaceNoticeEvent"
    SET
        "SpaceID" = COALESCE(p_SpaceID, "SpaceID"),
        "ActorUserID" = CASE WHEN p_ActorUserID_Clear = TRUE THEN NULL ELSE COALESCE(p_ActorUserID, "ActorUserID") END,
        "EventKind" = COALESCE(p_EventKind, "EventKind"),
        "Band" = COALESCE(p_Band, "Band"),
        "Title" = COALESCE(p_Title, "Title"),
        "Body" = CASE WHEN p_Body_Clear = TRUE THEN NULL ELSE COALESCE(p_Body, "Body") END,
        "TargetEntityID" = CASE WHEN p_TargetEntityID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetEntityID, "TargetEntityID") END,
        "TargetRecordID" = CASE WHEN p_TargetRecordID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetRecordID, "TargetRecordID") END,
        "MetadataJSON" = CASE WHEN p_MetadataJSON_Clear = TRUE THEN NULL ELSE COALESCE(p_MetadataJSON, "MetadataJSON") END,
        "EventTimestamp" = COALESCE(p_EventTimestamp, "EventTimestamp")
    WHERE "ID" = p_ID;

    GET DIAGNOSTICS _v_row_count = ROW_COUNT;
    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceNoticeEvents" WHERE 1 = 0;
    ELSE
        RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceNoticeEvents" WHERE "ID" = p_ID;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spDeleteSpaceNoticeEvent"(IN p_ID UUID)
RETURNS TABLE("_result_id" UUID) AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
    DELETE FROM __mj_bizappscollaboration."SpaceNoticeEvent" WHERE "ID" = p_ID;
    GET DIAGNOSTICS _v_row_count = ROW_COUNT;
    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "_result_id";
    ELSE
        RETURN QUERY SELECT p_ID AS "_result_id";
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spCreateSpaceNoticeWatermark"(
    IN p_ID UUID DEFAULT NULL,
    IN p_SpaceID UUID DEFAULT NULL,
    IN p_UserID UUID DEFAULT NULL,
    IN p_LastReadEventTimestamp TIMESTAMPTZ DEFAULT NULL,
    IN p_LastReadEventID_Clear BOOLEAN DEFAULT FALSE,
    IN p_LastReadEventID UUID DEFAULT NULL,
    IN p_LastReadAt TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF __mj_bizappscollaboration."vwSpaceNoticeWatermarks" AS
$$
DECLARE
    v_inserted_id UUID;
BEGIN
    IF p_ID IS NOT NULL THEN
        INSERT INTO __mj_bizappscollaboration."SpaceNoticeWatermark" (
            "ID", "SpaceID", "UserID", "LastReadEventTimestamp", "LastReadEventID", "LastReadAt"
        )
        VALUES (
            p_ID, p_SpaceID, p_UserID, p_LastReadEventTimestamp,
            CASE WHEN p_LastReadEventID_Clear = TRUE THEN NULL ELSE p_LastReadEventID END,
            COALESCE(p_LastReadAt, NOW())
        )
        RETURNING "ID" INTO v_inserted_id;
    ELSE
        INSERT INTO __mj_bizappscollaboration."SpaceNoticeWatermark" (
            "SpaceID", "UserID", "LastReadEventTimestamp", "LastReadEventID", "LastReadAt"
        )
        VALUES (
            p_SpaceID, p_UserID, p_LastReadEventTimestamp,
            CASE WHEN p_LastReadEventID_Clear = TRUE THEN NULL ELSE p_LastReadEventID END,
            COALESCE(p_LastReadAt, NOW())
        )
        RETURNING "ID" INTO v_inserted_id;
    END IF;
    RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceNoticeWatermarks" WHERE "ID" = v_inserted_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spUpdateSpaceNoticeWatermark"(
    IN p_ID UUID,
    IN p_SpaceID UUID DEFAULT NULL,
    IN p_UserID UUID DEFAULT NULL,
    IN p_LastReadEventTimestamp TIMESTAMPTZ DEFAULT NULL,
    IN p_LastReadEventID_Clear BOOLEAN DEFAULT FALSE,
    IN p_LastReadEventID UUID DEFAULT NULL,
    IN p_LastReadAt TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF __mj_bizappscollaboration."vwSpaceNoticeWatermarks" AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
    UPDATE __mj_bizappscollaboration."SpaceNoticeWatermark"
    SET
        "SpaceID" = COALESCE(p_SpaceID, "SpaceID"),
        "UserID" = COALESCE(p_UserID, "UserID"),
        "LastReadEventTimestamp" = COALESCE(p_LastReadEventTimestamp, "LastReadEventTimestamp"),
        "LastReadEventID" = CASE WHEN p_LastReadEventID_Clear = TRUE THEN NULL ELSE COALESCE(p_LastReadEventID, "LastReadEventID") END,
        "LastReadAt" = COALESCE(p_LastReadAt, "LastReadAt")
    WHERE "ID" = p_ID;

    GET DIAGNOSTICS _v_row_count = ROW_COUNT;
    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceNoticeWatermarks" WHERE 1 = 0;
    ELSE
        RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceNoticeWatermarks" WHERE "ID" = p_ID;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spDeleteSpaceNoticeWatermark"(IN p_ID UUID)
RETURNS TABLE("_result_id" UUID) AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
    DELETE FROM __mj_bizappscollaboration."SpaceNoticeWatermark" WHERE "ID" = p_ID;
    GET DIAGNOSTICS _v_row_count = ROW_COUNT;
    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "_result_id";
    ELSE
        RETURN QUERY SELECT p_ID AS "_result_id";
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spCreateSpaceDigestCheckpoint"(
    IN p_ID UUID DEFAULT NULL,
    IN p_UserID UUID DEFAULT NULL,
    IN p_SpaceID_Clear BOOLEAN DEFAULT FALSE,
    IN p_SpaceID UUID DEFAULT NULL,
    IN p_Cadence VARCHAR(20) DEFAULT NULL,
    IN p_LastDeliveredTimestamp TIMESTAMPTZ DEFAULT NULL,
    IN p_LastDeliveredRecordID_Clear BOOLEAN DEFAULT FALSE,
    IN p_LastDeliveredRecordID UUID DEFAULT NULL,
    IN p_LastDeliveredAt TIMESTAMPTZ DEFAULT NULL,
    IN p_ItemsIncludedCount INTEGER DEFAULT NULL,
    IN p_Status VARCHAR(20) DEFAULT NULL
)
RETURNS SETOF __mj_bizappscollaboration."vwSpaceDigestCheckpoints" AS
$$
DECLARE
    v_inserted_id UUID;
BEGIN
    IF p_ID IS NOT NULL THEN
        INSERT INTO __mj_bizappscollaboration."SpaceDigestCheckpoint" (
            "ID", "UserID", "SpaceID", "Cadence", "LastDeliveredTimestamp",
            "LastDeliveredRecordID", "LastDeliveredAt", "ItemsIncludedCount", "Status"
        )
        VALUES (
            p_ID, p_UserID,
            CASE WHEN p_SpaceID_Clear = TRUE THEN NULL ELSE p_SpaceID END,
            COALESCE(p_Cadence, 'Daily'), p_LastDeliveredTimestamp,
            CASE WHEN p_LastDeliveredRecordID_Clear = TRUE THEN NULL ELSE p_LastDeliveredRecordID END,
            COALESCE(p_LastDeliveredAt, NOW()),
            COALESCE(p_ItemsIncludedCount, 0),
            COALESCE(p_Status, 'Active')
        )
        RETURNING "ID" INTO v_inserted_id;
    ELSE
        INSERT INTO __mj_bizappscollaboration."SpaceDigestCheckpoint" (
            "UserID", "SpaceID", "Cadence", "LastDeliveredTimestamp",
            "LastDeliveredRecordID", "LastDeliveredAt", "ItemsIncludedCount", "Status"
        )
        VALUES (
            p_UserID,
            CASE WHEN p_SpaceID_Clear = TRUE THEN NULL ELSE p_SpaceID END,
            COALESCE(p_Cadence, 'Daily'), p_LastDeliveredTimestamp,
            CASE WHEN p_LastDeliveredRecordID_Clear = TRUE THEN NULL ELSE p_LastDeliveredRecordID END,
            COALESCE(p_LastDeliveredAt, NOW()),
            COALESCE(p_ItemsIncludedCount, 0),
            COALESCE(p_Status, 'Active')
        )
        RETURNING "ID" INTO v_inserted_id;
    END IF;
    RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceDigestCheckpoints" WHERE "ID" = v_inserted_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spUpdateSpaceDigestCheckpoint"(
    IN p_ID UUID,
    IN p_UserID UUID DEFAULT NULL,
    IN p_SpaceID_Clear BOOLEAN DEFAULT FALSE,
    IN p_SpaceID UUID DEFAULT NULL,
    IN p_Cadence VARCHAR(20) DEFAULT NULL,
    IN p_LastDeliveredTimestamp TIMESTAMPTZ DEFAULT NULL,
    IN p_LastDeliveredRecordID_Clear BOOLEAN DEFAULT FALSE,
    IN p_LastDeliveredRecordID UUID DEFAULT NULL,
    IN p_LastDeliveredAt TIMESTAMPTZ DEFAULT NULL,
    IN p_ItemsIncludedCount INTEGER DEFAULT NULL,
    IN p_Status VARCHAR(20) DEFAULT NULL
)
RETURNS SETOF __mj_bizappscollaboration."vwSpaceDigestCheckpoints" AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
    UPDATE __mj_bizappscollaboration."SpaceDigestCheckpoint"
    SET
        "UserID" = COALESCE(p_UserID, "UserID"),
        "SpaceID" = CASE WHEN p_SpaceID_Clear = TRUE THEN NULL ELSE COALESCE(p_SpaceID, "SpaceID") END,
        "Cadence" = COALESCE(p_Cadence, "Cadence"),
        "LastDeliveredTimestamp" = COALESCE(p_LastDeliveredTimestamp, "LastDeliveredTimestamp"),
        "LastDeliveredRecordID" = CASE WHEN p_LastDeliveredRecordID_Clear = TRUE THEN NULL ELSE COALESCE(p_LastDeliveredRecordID, "LastDeliveredRecordID") END,
        "LastDeliveredAt" = COALESCE(p_LastDeliveredAt, "LastDeliveredAt"),
        "ItemsIncludedCount" = COALESCE(p_ItemsIncludedCount, "ItemsIncludedCount"),
        "Status" = COALESCE(p_Status, "Status")
    WHERE "ID" = p_ID;

    GET DIAGNOSTICS _v_row_count = ROW_COUNT;
    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceDigestCheckpoints" WHERE 1 = 0;
    ELSE
        RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceDigestCheckpoints" WHERE "ID" = p_ID;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spDeleteSpaceDigestCheckpoint"(IN p_ID UUID)
RETURNS TABLE("_result_id" UUID) AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
    DELETE FROM __mj_bizappscollaboration."SpaceDigestCheckpoint" WHERE "ID" = p_ID;
    GET DIAGNOSTICS _v_row_count = ROW_COUNT;
    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "_result_id";
    ELSE
        RETURN QUERY SELECT p_ID AS "_result_id";
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===================== Triggers =====================

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."trgUpdateSpaceNoticeEvent_func"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trgUpdateSpaceNoticeEvent" ON __mj_bizappscollaboration."SpaceNoticeEvent";
CREATE TRIGGER "trgUpdateSpaceNoticeEvent"
    BEFORE UPDATE ON __mj_bizappscollaboration."SpaceNoticeEvent"
    FOR EACH ROW EXECUTE FUNCTION __mj_bizappscollaboration."trgUpdateSpaceNoticeEvent_func"();

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."trgUpdateSpaceNoticeWatermark_func"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trgUpdateSpaceNoticeWatermark" ON __mj_bizappscollaboration."SpaceNoticeWatermark";
CREATE TRIGGER "trgUpdateSpaceNoticeWatermark"
    BEFORE UPDATE ON __mj_bizappscollaboration."SpaceNoticeWatermark"
    FOR EACH ROW EXECUTE FUNCTION __mj_bizappscollaboration."trgUpdateSpaceNoticeWatermark_func"();

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."trgUpdateSpaceDigestCheckpoint_func"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "trgUpdateSpaceDigestCheckpoint" ON __mj_bizappscollaboration."SpaceDigestCheckpoint";
CREATE TRIGGER "trgUpdateSpaceDigestCheckpoint"
    BEFORE UPDATE ON __mj_bizappscollaboration."SpaceDigestCheckpoint"
    FOR EACH ROW EXECUTE FUNCTION __mj_bizappscollaboration."trgUpdateSpaceDigestCheckpoint_func"();

-- ===================== Data (Entities, Fields, Values, Relationships, RLS) =====================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Entity" WHERE "ID" = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51' OR ("SchemaName" = '__mj_bizappscollaboration' AND "BaseTable" = 'SpaceNoticeEvent')) THEN
        INSERT INTO ${mjSchema}."Entity" ("ID", "Name", "DisplayName", "Description", "NameSuffix", "BaseTable", "BaseView", "SchemaName", "IncludeInAPI", "AllowUserSearchAPI", "AllowCaching", "TrackRecordChanges", "AuditRecordAccess", "AuditViewRuns", "AllowAllRowsAPI", "AllowCreateAPI", "AllowUpdateAPI", "AllowDeleteAPI", "UserViewMaxRows", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51', 'MJ_BizApps_Collaboration: Space Notice Events', 'Space Notice Events', 'Fan-out-on-read space notice event stream. Publishing an event writes a single row per space event rather than per-member inbox copies.', NULL, 'SpaceNoticeEvent', 'vwSpaceNoticeEvents', '__mj_bizappscollaboration', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE, 1000, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Entity" WHERE "ID" = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52' OR ("SchemaName" = '__mj_bizappscollaboration' AND "BaseTable" = 'SpaceNoticeWatermark')) THEN
        INSERT INTO ${mjSchema}."Entity" ("ID", "Name", "DisplayName", "Description", "NameSuffix", "BaseTable", "BaseView", "SchemaName", "IncludeInAPI", "AllowUserSearchAPI", "AllowCaching", "TrackRecordChanges", "AuditRecordAccess", "AuditViewRuns", "AllowAllRowsAPI", "AllowCreateAPI", "AllowUpdateAPI", "AllowDeleteAPI", "UserViewMaxRows", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52', 'MJ_BizApps_Collaboration: Space Notice Watermarks', 'Space Notice Watermarks', 'Per-member read watermark per space enabling O(1) fan-out-on-read unread resolution.', NULL, 'SpaceNoticeWatermark', 'vwSpaceNoticeWatermarks', '__mj_bizappscollaboration', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE, 1000, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."Entity" WHERE "ID" = 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53' OR ("SchemaName" = '__mj_bizappscollaboration' AND "BaseTable" = 'SpaceDigestCheckpoint')) THEN
        INSERT INTO ${mjSchema}."Entity" ("ID", "Name", "DisplayName", "Description", "NameSuffix", "BaseTable", "BaseView", "SchemaName", "IncludeInAPI", "AllowUserSearchAPI", "AllowCaching", "TrackRecordChanges", "AuditRecordAccess", "AuditViewRuns", "AllowAllRowsAPI", "AllowCreateAPI", "AllowUpdateAPI", "AllowDeleteAPI", "UserViewMaxRows", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53', 'MJ_BizApps_Collaboration: Space Digest Checkpoints', 'Space Digest Checkpoints', 'Keyset cursor checkpoint per recipient and cadence for scheduled scoped digest delivery.', NULL, 'SpaceDigestCheckpoint', 'vwSpaceDigestCheckpoints', '__mj_bizappscollaboration', TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, TRUE, 1000, NOW(), NOW());
    END IF;
END $$;

DO $$
DECLARE
    v_ent UUID;
BEGIN
    FOREACH v_ent IN ARRAY ARRAY['E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID] LOOP
        IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."ApplicationEntity" WHERE "ApplicationID" = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' AND "EntityID" = v_ent) THEN
            INSERT INTO ${mjSchema}."ApplicationEntity" ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
            VALUES ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', v_ent, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."ApplicationEntity" WHERE "ApplicationID" = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), NOW(), NOW());
        END IF;

        INSERT INTO ${mjSchema}."EntityPermission" ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
        SELECT v_ent, CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, FALSE, FALSE, FALSE, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityPermission" WHERE "EntityID" = v_ent AND "RoleID" = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow');

        INSERT INTO ${mjSchema}."EntityPermission" ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
        SELECT v_ent, CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityPermission" WHERE "EntityID" = v_ent AND "RoleID" = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow');

        INSERT INTO ${mjSchema}."EntityPermission" ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
        SELECT v_ent, CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityPermission" WHERE "EntityID" = v_ent AND "RoleID" = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID) AND "Type" = 'Allow');
    END LOOP;
END $$;

/* PostgreSQL-native RowLevelSecurityFilter predicates & PlatformVariants + Space Participant grants */
DO $$
DECLARE
    v_has_platform_variants BOOLEAN;
    v_participant_role_id UUID;
    v_rls RECORD;
    v_rls_id UUID;
    v_pv_json TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE LOWER(table_schema) = LOWER(REPLACE('${mjSchema}', '"', ''))
          AND table_name = 'RowLevelSecurityFilter'
          AND column_name = 'PlatformVariants'
    ) INTO v_has_platform_variants;

    SELECT "ID" INTO v_participant_role_id
    FROM ${mjSchema}."Role"
    WHERE "ID" = 'AAF434FD-EF58-4857-854E-2607ACAF763B'::UUID
       OR LOWER("Name") = 'space participant'
    LIMIT 1;

    FOR v_rls IN
        SELECT * FROM (VALUES
            ('E8B10001-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 'E8C10001-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 'Collaboration: Space Notice Events In Reach', 'Space notice events in spaces the caller reaches, filtered by Team/Shared band.', '__mj_bizappscollaboration."fnCanReadSpaceNoticeEventRow"(__mj_bizappscollaboration."fnTryParseUuid"(''{{UserID}}''), "SpaceID", "Band")'),
            ('E8B10002-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 'E8C10002-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 'Collaboration: Own Space Notice Watermarks', 'Per-member space notice watermarks owned by the caller in spaces they reach.', '__mj_bizappscollaboration."fnCanReadSpaceNoticeWatermarkRow"(__mj_bizappscollaboration."fnTryParseUuid"(''{{UserID}}''), "SpaceID", "UserID")'),
            ('E8B10003-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 'E8C10003-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 'Collaboration: Own Space Digest Checkpoints', 'Digest cursor checkpoints owned by the caller.', '__mj_bizappscollaboration."fnCanReadSpaceDigestCheckpointRow"(__mj_bizappscollaboration."fnTryParseUuid"(''{{UserID}}''), "SpaceID", "UserID")')
        ) AS t(rls_id, entity_id, perm_id, rls_name, rls_desc, pg_filter)
    LOOP
        SELECT "ID" INTO v_rls_id
        FROM ${mjSchema}."RowLevelSecurityFilter"
        WHERE "ID" = v_rls.rls_id OR "Name" = v_rls.rls_name
        LIMIT 1;

        IF v_rls_id IS NULL THEN
            v_rls_id := v_rls.rls_id;
            INSERT INTO ${mjSchema}."RowLevelSecurityFilter" ("ID", "Name", "Description", "FilterText", "__mj_CreatedAt", "__mj_UpdatedAt")
            VALUES (v_rls_id, v_rls.rls_name, v_rls.rls_desc, v_rls.pg_filter, NOW(), NOW());
        ELSE
            UPDATE ${mjSchema}."RowLevelSecurityFilter"
            SET "FilterText" = v_rls.pg_filter, "__mj_UpdatedAt" = NOW()
            WHERE "ID" = v_rls_id;
        END IF;

        IF v_has_platform_variants THEN
            v_pv_json := jsonb_build_object(
                'FilterText', jsonb_build_object('postgresql', v_rls.pg_filter),
                '_meta', jsonb_build_object('translatedBy', 'manual', 'sourceDialect', 'sqlserver', 'verified', true)
            )::TEXT;
            EXECUTE format(
                'UPDATE %I."RowLevelSecurityFilter" SET "PlatformVariants" = $1, "__mj_UpdatedAt" = NOW() WHERE "ID" = $2',
                REPLACE('${mjSchema}', '"', '')
            ) USING v_pv_json, v_rls_id;
        END IF;

        IF v_participant_role_id IS NOT NULL THEN
            INSERT INTO ${mjSchema}."EntityPermission" ("ID", "EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "ReadRLSFilterID", "__mj_CreatedAt", "__mj_UpdatedAt")
            SELECT v_rls.perm_id, v_rls.entity_id, v_participant_role_id, 'Allow', TRUE, FALSE, FALSE, FALSE, v_rls_id, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM ${mjSchema}."EntityPermission"
                WHERE "EntityID" = v_rls.entity_id AND "RoleID" = v_participant_role_id AND "Type" = 'Allow'
            );

            UPDATE ${mjSchema}."EntityPermission"
            SET "CanRead" = TRUE, "CanCreate" = FALSE, "CanUpdate" = FALSE, "CanDelete" = FALSE,
                "ReadRLSFilterID" = v_rls_id, "__mj_UpdatedAt" = NOW()
            WHERE "EntityID" = v_rls.entity_id AND "RoleID" = v_participant_role_id AND "Type" = 'Allow';
        END IF;
    END LOOP;
END $$;

/* EntityFields for SpaceNoticeEvent, SpaceNoticeWatermark, and SpaceDigestCheckpoint */
DO $$
DECLARE
    v_ef RECORD;
BEGIN
    FOR v_ef IN
        SELECT * FROM (VALUES
            -- SpaceNoticeEvent
            ('e8a10001-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 1, 'ID', 'ID', NULL, 'UUID', 16, 0, 0, FALSE, 'gen_random_uuid()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE),
            ('e8a10002-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 2, 'SpaceID', 'Space ID', 'The space in which the notice event occurred.', 'UUID', 16, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'::UUID, 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE),
            ('e8a10003-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 3, 'ActorUserID', 'Actor User ID', 'The acting user who triggered the event, or NULL for system-generated events.', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, 'E1238F34-2837-EF11-86D4-6045BDEE16E6'::UUID, 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE),
            ('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 4, 'EventKind', 'Event Kind', 'Event category: Share, StatusChanged, Mention, Reply, Task, Approval, Announcement, or System.', 'nvarchar', 100, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 5, 'Band', 'Band', 'Visibility band (Shared or Team) governing which space members may read this notice event.', 'nvarchar', 40, 0, 0, FALSE, 'Shared', FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a10006-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 6, 'Title', 'Title', 'Short domain-neutral notice headline.', 'nvarchar', 1000, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE),
            ('e8a10007-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 7, 'Body', 'Body', 'Optional detailed notice summary text.', 'nvarchar', -1, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a10008-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 8, 'TargetEntityID', 'Target Entity ID', 'Optional target MJ Entity ID for deep-linking to the underlying record (polymorphic pair with TargetRecordID).', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, 'E0238F34-2837-EF11-86D4-6045BDEE16E6'::UUID, 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE),
            ('e8a10009-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 9, 'TargetRecordID', 'Target Record ID', 'Optional canonical target record key (e.g. ID|<uuid>) paired with TargetEntityID.', 'nvarchar', 900, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a10010-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 10, 'MetadataJSON', 'Metadata JSON', 'Optional structured JSON payload carrying additional event context.', 'nvarchar', -1, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a10011-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 11, 'EventTimestamp', 'Event Timestamp', 'UTC timestamp at which the notice event occurred, used with ID as the deterministic composite keyset cursor.', 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a10012-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 12, '__mj_CreatedAt', 'Created At', NULL, 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a10013-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 13, '__mj_UpdatedAt', 'Updated At', NULL, 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a10014-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 14, 'Space', 'Space', NULL, 'nvarchar', 400, 0, 0, FALSE, NULL, FALSE, FALSE, TRUE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a10015-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 15, 'ActorUser', 'Actor User', NULL, 'nvarchar', 200, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a10016-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 16, 'TargetEntity', 'Target Entity', NULL, 'nvarchar', 510, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            -- SpaceNoticeWatermark
            ('e8a20001-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 1, 'ID', 'ID', NULL, 'UUID', 16, 0, 0, FALSE, 'gen_random_uuid()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE),
            ('e8a20002-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 2, 'SpaceID', 'Space ID', 'The space this read watermark applies to.', 'UUID', 16, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'::UUID, 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, TRUE),
            ('e8a20003-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 3, 'UserID', 'User ID', 'The member whose read watermark is tracked.', 'UUID', 16, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, 'E1238F34-2837-EF11-86D4-6045BDEE16E6'::UUID, 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, TRUE),
            ('e8a20004-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 4, 'LastReadEventTimestamp', 'Last Read Event Timestamp', 'Timestamp component of the member''s monotonic composite read watermark (LastReadEventTimestamp, LastReadEventID).', 'TIMESTAMPTZ', 10, 34, 7, FALSE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a20005-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 5, 'LastReadEventID', 'Last Read Event ID', 'Tie-breaker SpaceNoticeEvent ID component of the member''s monotonic composite read watermark.', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a20006-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 6, 'LastReadAt', 'Last Read At', 'UTC timestamp when the member last advanced this watermark.', 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a20007-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 7, '__mj_CreatedAt', 'Created At', NULL, 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a20008-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 8, '__mj_UpdatedAt', 'Updated At', NULL, 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a20009-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 9, 'Space', 'Space', NULL, 'nvarchar', 400, 0, 0, FALSE, NULL, FALSE, FALSE, TRUE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a20010-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 10, 'User', 'User', NULL, 'nvarchar', 200, 0, 0, FALSE, NULL, FALSE, FALSE, TRUE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            -- SpaceDigestCheckpoint
            ('e8a30001-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 1, 'ID', 'ID', NULL, 'UUID', 16, 0, 0, FALSE, 'gen_random_uuid()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE),
            ('e8a30002-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 2, 'UserID', 'User ID', 'The digest recipient user.', 'UUID', 16, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, 'E1238F34-2837-EF11-86D4-6045BDEE16E6'::UUID, 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, TRUE),
            ('e8a30003-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 3, 'SpaceID', 'Space ID', 'Optional specific space scope for the digest checkpoint, or NULL for a cross-space digest.', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'::UUID, 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, TRUE),
            ('e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 4, 'Cadence', 'Cadence', 'Digest cadence: Daily, Weekly, Immediate, or Custom.', 'nvarchar', 40, 0, 0, FALSE, 'Daily', FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, TRUE),
            ('e8a30005-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 5, 'LastDeliveredTimestamp', 'Last Delivered Timestamp', 'Timestamp component of the last delivered digest composite keyset cursor.', 'TIMESTAMPTZ', 10, 34, 7, FALSE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a30006-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 6, 'LastDeliveredRecordID', 'Last Delivered Record ID', 'Tie-breaker record ID component of the last delivered digest composite keyset cursor.', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a30007-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 7, 'LastDeliveredAt', 'Last Delivered At', 'UTC timestamp when the last digest delivery completed.', 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a30008-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 8, 'ItemsIncludedCount', 'Items Included Count', 'Number of reach-verified items included in the last delivered digest.', 'int', 4, 10, 0, FALSE, '((0))', FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 9, 'Status', 'Status', 'Checkpoint status: Active or Paused.', 'nvarchar', 40, 0, 0, FALSE, 'Active', FALSE, TRUE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE),
            ('e8a30010-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 10, '__mj_CreatedAt', 'Created At', NULL, 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a30011-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 11, '__mj_UpdatedAt', 'Updated At', NULL, 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, FALSE, FALSE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a30012-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 12, 'User', 'User', NULL, 'nvarchar', 200, 0, 0, FALSE, NULL, FALSE, FALSE, TRUE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
            ('e8a30013-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 13, 'Space', 'Space', NULL, 'nvarchar', 400, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, NULL::UUID, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
        ) AS f(id, ent_id, seq, name, disp, descr, ftype, flen, fprec, fscale, nulls, defval, autoinc, allowupd, isvirt, relent_id, relent_fld, isname, incl_search, incl_rel, def_view, is_pk, is_uniq)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = v_ef.id OR ("EntityID" = v_ef.ent_id AND "Name" = v_ef.name)) THEN
            INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
            VALUES (v_ef.id, v_ef.ent_id, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = v_ef.ent_id), v_ef.name, v_ef.disp, v_ef.descr, v_ef.ftype, v_ef.flen, v_ef.fprec, v_ef.fscale, v_ef.nulls, v_ef.defval, v_ef.autoinc, v_ef.allowupd, v_ef.isvirt, FALSE, v_ef.relent_id, v_ef.relent_fld, v_ef.isname, v_ef.incl_search, v_ef.incl_rel, v_ef.def_view, v_ef.is_pk, v_ef.is_uniq, 'Search', NOW(), NOW());
        END IF;
    END LOOP;
END $$;

DO $$
DECLARE
    v_val RECORD;
BEGIN
    FOR v_val IN
        SELECT * FROM (VALUES
            ('f9e10001-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 1, 'Share', 'Share'),
            ('f9e10002-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 2, 'StatusChanged', 'StatusChanged'),
            ('f9e10003-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 3, 'Mention', 'Mention'),
            ('f9e10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 4, 'Reply', 'Reply'),
            ('f9e10005-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 5, 'Task', 'Task'),
            ('f9e10006-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 6, 'Approval', 'Approval'),
            ('f9e10007-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 7, 'Announcement', 'Announcement'),
            ('f9e10008-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 8, 'System', 'System'),
            ('f9e10009-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 1, 'Shared', 'Shared'),
            ('f9e10010-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 2, 'Team', 'Team'),
            ('f9e30001-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 1, 'Daily', 'Daily'),
            ('f9e30002-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 2, 'Weekly', 'Weekly'),
            ('f9e30003-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 3, 'Immediate', 'Immediate'),
            ('f9e30004-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 4, 'Custom', 'Custom'),
            ('f9e30005-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 1, 'Active', 'Active'),
            ('f9e30006-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 2, 'Paused', 'Paused')
        ) AS v(id, ef_id, seq, val, code)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = v_val.id) THEN
            INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
            VALUES (v_val.id, v_val.ef_id, v_val.seq, v_val.val, v_val.code, NOW(), NOW());
        END IF;
    END LOOP;
    UPDATE ${mjSchema}."EntityField" SET "ValueListType" = 'List'
    WHERE "ID" IN ('e8a10004-4f50-4a6b-8c9d-0e1f2a3b4c51', 'e8a10005-4f50-4a6b-8c9d-0e1f2a3b4c51', 'e8a30004-4f50-4a6b-8c9d-0e1f2a3b4c53', 'e8a30009-4f50-4a6b-8c9d-0e1f2a3b4c53');
END $$;

DO $$
DECLARE
    v_rel RECORD;
BEGIN
    FOR v_rel IN
        SELECT * FROM (VALUES
            ('e8d10001-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 'SpaceID'),
            ('e8d10002-4f50-4a6b-8c9d-0e1f2a3b4c51'::UUID, 'E1238F34-2837-EF11-86D4-6045BDEE16E6'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C51'::UUID, 'ActorUserID'),
            ('e8d20001-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 'SpaceID'),
            ('e8d20002-4f50-4a6b-8c9d-0e1f2a3b4c52'::UUID, 'E1238F34-2837-EF11-86D4-6045BDEE16E6'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C52'::UUID, 'UserID'),
            ('e8d30001-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, 'E1238F34-2837-EF11-86D4-6045BDEE16E6'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 'UserID'),
            ('e8d30002-4f50-4a6b-8c9d-0e1f2a3b4c53'::UUID, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'::UUID, 'E8A1C2D3-4F50-4A6B-8C9D-0E1F2A3B4C53'::UUID, 'SpaceID')
        ) AS r(id, ent_id, relent_id, join_fld)
    LOOP
        IF NOT EXISTS (SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = v_rel.id OR ("EntityID" = v_rel.ent_id AND "RelatedEntityID" = v_rel.relent_id AND "RelatedEntityJoinField" = v_rel.join_fld)) THEN
            INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
            VALUES (v_rel.id, v_rel.ent_id, v_rel.relent_id, v_rel.join_fld, 'One To Many', TRUE, TRUE, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityRelationship" WHERE "EntityID" = v_rel.ent_id), NOW(), NOW());
        END IF;
    END LOOP;
END $$;

-- ===================== Grants =====================

DO $$ BEGIN GRANT USAGE ON SCHEMA __mj_bizappscollaboration TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT USAGE ON SCHEMA ${mjSchema} TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."SpaceNoticeEvent" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT INSERT, UPDATE, DELETE ON __mj_bizappscollaboration."SpaceNoticeEvent" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."SpaceNoticeWatermark" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT INSERT, UPDATE, DELETE ON __mj_bizappscollaboration."SpaceNoticeWatermark" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."SpaceDigestCheckpoint" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT INSERT, UPDATE, DELETE ON __mj_bizappscollaboration."SpaceDigestCheckpoint" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."vwSpaceNoticeEvents" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."vwSpaceNoticeEventsAuthorized" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."vwSpaceNoticeWatermarks" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."vwSpaceNoticeWatermarksAuthorized" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."vwSpaceDigestCheckpoints" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."vwSpaceDigestCheckpointsAuthorized" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."fnIsPrivilegedNoticeSession"() TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."fnCanReadSpaceNoticeEventRow"(UUID, UUID, VARCHAR) TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."fnIsSpaceNoticeEventRowVisible"(UUID, VARCHAR) TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."fnCanReadSpaceNoticeWatermarkRow"(UUID, UUID, UUID) TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."fnIsSpaceNoticeWatermarkRowVisible"(UUID, UUID) TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."fnCanReadSpaceDigestCheckpointRow"(UUID, UUID, UUID) TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."fnIsSpaceDigestCheckpointRowVisible"(UUID, UUID) TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spCreateSpaceNoticeEvent" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spUpdateSpaceNoticeEvent" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spDeleteSpaceNoticeEvent" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spCreateSpaceNoticeWatermark" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spUpdateSpaceNoticeWatermark" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spDeleteSpaceNoticeWatermark" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spCreateSpaceDigestCheckpoint" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spUpdateSpaceDigestCheckpoint" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spDeleteSpaceDigestCheckpoint" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;

-- ===================== Comments =====================

COMMENT ON TABLE __mj_bizappscollaboration."SpaceNoticeEvent" IS 'Fan-out-on-read space notice event stream. Publishing an event writes a single row per space event rather than per-member inbox copies.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."SpaceID" IS 'The space in which the notice event occurred.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."ActorUserID" IS 'The acting user who triggered the event, or NULL for system-generated events.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."EventKind" IS 'Event category: Share, StatusChanged, Mention, Reply, Task, Approval, Announcement, or System.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."Band" IS 'Visibility band (Shared or Team) governing which space members may read this notice event.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."Title" IS 'Short domain-neutral notice headline.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."Body" IS 'Optional detailed notice summary text.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."TargetEntityID" IS 'Optional target MJ Entity ID for deep-linking to the underlying record (polymorphic pair with TargetRecordID).';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."TargetRecordID" IS 'Optional canonical target record key (e.g. ID|<uuid>) paired with TargetEntityID.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."MetadataJSON" IS 'Optional structured JSON payload carrying additional event context.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeEvent"."EventTimestamp" IS 'UTC timestamp at which the notice event occurred, used with ID as the deterministic composite keyset cursor.';

COMMENT ON TABLE __mj_bizappscollaboration."SpaceNoticeWatermark" IS 'Per-member read watermark per space enabling O(1) fan-out-on-read unread resolution.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeWatermark"."SpaceID" IS 'The space this read watermark applies to.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeWatermark"."UserID" IS 'The member whose read watermark is tracked.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeWatermark"."LastReadEventTimestamp" IS 'Timestamp component of the member''s monotonic composite read watermark (LastReadEventTimestamp, LastReadEventID).';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeWatermark"."LastReadEventID" IS 'Tie-breaker SpaceNoticeEvent ID component of the member''s monotonic composite read watermark.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceNoticeWatermark"."LastReadAt" IS 'UTC timestamp when the member last advanced this watermark.';

COMMENT ON TABLE __mj_bizappscollaboration."SpaceDigestCheckpoint" IS 'Keyset cursor checkpoint per recipient and cadence for scheduled scoped digest delivery.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceDigestCheckpoint"."UserID" IS 'The digest recipient user.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceDigestCheckpoint"."SpaceID" IS 'Optional specific space scope for the digest checkpoint, or NULL for a cross-space digest.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceDigestCheckpoint"."Cadence" IS 'Digest cadence: Daily, Weekly, Immediate, or Custom.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceDigestCheckpoint"."LastDeliveredTimestamp" IS 'Timestamp component of the last delivered digest composite keyset cursor.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceDigestCheckpoint"."LastDeliveredRecordID" IS 'Tie-breaker record ID component of the last delivered digest composite keyset cursor.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceDigestCheckpoint"."LastDeliveredAt" IS 'UTC timestamp when the last digest delivery completed.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceDigestCheckpoint"."ItemsIncludedCount" IS 'Number of reach-verified items included in the last delivered digest.';
COMMENT ON COLUMN __mj_bizappscollaboration."SpaceDigestCheckpoint"."Status" IS 'Checkpoint status: Active or Paused.';
