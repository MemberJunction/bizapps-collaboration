-- ============================================================================
-- MemberJunction PostgreSQL Migration
-- Converted from SQL Server using TypeScript conversion pipeline
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schema
--
-- The schema name is emitted UNQUOTED, so PostgreSQL folds it to lowercase. That is deliberate and
-- self-consistent: everything downstream in a converted migration refers to it unquoted too, so
-- both definition and lookup land on the same folded name.
--
-- DOWNSTREAM NOTE for the build engineer: a PostgreSQL database that was populated by an EARLIER
-- converter — one that emitted a quoted, case-preserved name — already holds that mixed-case
-- schema: for a target named MySchema_Name, the quoted "MySchema_Name". Re-converting against
-- that database creates a SECOND, empty schema myschema_name rather than reusing the existing
-- one, because IF NOT EXISTS compares the folded name and finds no match. The repo's own committed
-- migrations-pg files are unaffected (the only quoted CREATE SCHEMAs there are the four pg_dump
-- baselines, which this path does not produce), so this is an open-app / downstream concern, not
-- one for this repo's Flyway history.
CREATE SCHEMA IF NOT EXISTS __mj_bizappscollaboration;
SET search_path TO __mj_bizappscollaboration, public;

-- Ensure backslashes in string literals are treated literally (not as escape sequences)
SET standard_conforming_strings = on;

-- NOTE: Earlier converter versions made INTEGER to BOOLEAN cast implicit by
-- modifying the system catalog so SS-style INSERT INTO bool_col VALUES (1)
-- would work. That modification required pg_catalog write privileges, which
-- managed PG (RDS, Aurora, Cloud SQL, Azure) does not grant. As of v5.30 all
-- bulk INSERTs are emitted with native TRUE/FALSE values directly, so the
-- cast modification is no longer needed. Removed to support managed-PG
-- installs out of the box.


-- ===================== DDL: Tables, PKs, Indexes =====================

-- =============================================================================
-- Migration: V202611211945__v0.2.x__Space_Agent_Source_Receipts.sql
-- Adds SpaceAgentSourceReceipt for CT-2 queryable relational source receipts
-- per space agent message, recording supplied space items and knowledge sources
-- as well as specifically cited sources within strict (space, band) reach.
-- =============================================================================

-- Ensure prerequisite Collaboration tables exist when executed standalone
CREATE TABLE IF NOT EXISTS __mj_bizappscollaboration."Space" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "Name" VARCHAR(200) NOT NULL DEFAULT '',
 CONSTRAINT "PK_Space" PRIMARY KEY ("ID")
);

CREATE TABLE IF NOT EXISTS __mj_bizappscollaboration."SpaceChat" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "Name" VARCHAR(200) NOT NULL DEFAULT '',
 CONSTRAINT "PK_SpaceChat" PRIMARY KEY ("ID")
);

CREATE TABLE IF NOT EXISTS __mj_bizappscollaboration."SpaceItem" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 CONSTRAINT "PK_SpaceItem" PRIMARY KEY ("ID")
);

-- 1. Create SpaceAgentSourceReceipt table
CREATE TABLE IF NOT EXISTS __mj_bizappscollaboration."SpaceAgentSourceReceipt" (
 "ID" UUID NOT NULL DEFAULT gen_random_uuid(),
 "SpaceID" UUID NOT NULL,
 "SpaceChatID" UUID NOT NULL,
 "ConversationID" UUID NOT NULL,
 "ConversationDetailID" UUID NOT NULL,
 "AgentRunID" UUID NULL,
 "SourceKind" VARCHAR(30) NOT NULL,
 "SpaceItemID" UUID NULL,
 "ContentSourceID" UUID NULL,
 "TargetEntityID" UUID NULL,
 "TargetRecordID" VARCHAR(450) NULL,
 "SourceTitle" VARCHAR(500) NOT NULL,
 "Band" VARCHAR(20) NOT NULL,
 "WasSupplied" BOOLEAN NOT NULL DEFAULT TRUE,
 "WasCited" BOOLEAN NOT NULL DEFAULT FALSE,
 "RetrievalRank" INTEGER NULL,
 "RelevanceScore" DECIMAL(12, 6) NULL,
 "RankingMode" VARCHAR(20) NOT NULL DEFAULT 'none',
 "CitationOrdinal" INTEGER NULL,
 "EstimatedTokens" INTEGER NOT NULL DEFAULT 0,
 "WasTruncated" BOOLEAN NOT NULL DEFAULT FALSE,
 "Sequence" INTEGER NOT NULL DEFAULT 1,
 "__mj_CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "__mj_UpdatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT "PK_SpaceAgentSourceReceipt" PRIMARY KEY ("ID"),
 CONSTRAINT "FK_SpaceAgentSourceReceipt_Space" FOREIGN KEY ("SpaceID") REFERENCES __mj_bizappscollaboration."Space" ("ID"),
 CONSTRAINT "FK_SpaceAgentSourceReceipt_SpaceChat" FOREIGN KEY ("SpaceChatID") REFERENCES __mj_bizappscollaboration."SpaceChat" ("ID"),
 CONSTRAINT "FK_SpaceAgentSourceReceipt_Conversation" FOREIGN KEY ("ConversationID") REFERENCES ${mjSchema}."Conversation" ("ID"),
 CONSTRAINT "FK_SpaceAgentSourceReceipt_ConversationDetail" FOREIGN KEY ("ConversationDetailID") REFERENCES ${mjSchema}."ConversationDetail" ("ID"),
 CONSTRAINT "FK_SpaceAgentSourceReceipt_AgentRun" FOREIGN KEY ("AgentRunID") REFERENCES ${mjSchema}."AIAgentRun" ("ID"),
 CONSTRAINT "FK_SpaceAgentSourceReceipt_SpaceItem" FOREIGN KEY ("SpaceItemID") REFERENCES __mj_bizappscollaboration."SpaceItem" ("ID"),
 CONSTRAINT "FK_SpaceAgentSourceReceipt_ContentSource" FOREIGN KEY ("ContentSourceID") REFERENCES ${mjSchema}."ContentSource" ("ID"),
 CONSTRAINT "FK_SpaceAgentSourceReceipt_TargetEntity" FOREIGN KEY ("TargetEntityID") REFERENCES ${mjSchema}."Entity" ("ID"),
 CONSTRAINT "CK_SpaceAgentSourceReceipt_SourceKind" CHECK ("SourceKind" = 'SpaceItem' OR "SourceKind" = 'KnowledgeSource'),
 CONSTRAINT "CK_SpaceAgentSourceReceipt_SourceTarget" CHECK (
 ("SourceKind" = 'SpaceItem' AND "SpaceItemID" IS NOT NULL AND "ContentSourceID" IS NULL)
 OR ("SourceKind" = 'KnowledgeSource' AND "ContentSourceID" IS NOT NULL AND "SpaceItemID" IS NULL)
 ),
 CONSTRAINT "CK_SpaceAgentSourceReceipt_Band" CHECK ("Band" = 'Shared' OR "Band" = 'Team'),
 CONSTRAINT "CK_SpaceAgentSourceReceipt_RankingMode" CHECK ("RankingMode" = 'vector' OR "RankingMode" = 'lexical' OR "RankingMode" = 'grant' OR "RankingMode" = 'none'),
 CONSTRAINT "CK_SpaceAgentSourceReceipt_CitationOrdinal" CHECK (
 ("WasCited" =FALSE AND "CitationOrdinal" IS NULL)
 OR ("WasCited" =TRUE AND "CitationOrdinal" >= (1))
 ),
 CONSTRAINT "CK_SpaceAgentSourceReceipt_RetrievalRank" CHECK ("RetrievalRank" IS NULL OR "RetrievalRank" >= (1)),
 CONSTRAINT "CK_SpaceAgentSourceReceipt_EstimatedTokens" CHECK ("EstimatedTokens" >= (0)),
 CONSTRAINT "CK_SpaceAgentSourceReceipt_Sequence" CHECK ("Sequence" >= (1))
);

-- 2. Idempotency & lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_SpaceAgentSourceReceipt_Detail_SpaceItem"
ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("ConversationDetailID", "SpaceItemID")
WHERE ("SpaceItemID" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_SpaceAgentSourceReceipt_Detail_ContentSource"
ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("ConversationDetailID", "ContentSourceID")
WHERE ("ContentSourceID" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "IX_SpaceAgentSourceReceipt_ConversationDetail"
ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("ConversationDetailID", "WasCited", "Sequence");

CREATE INDEX IF NOT EXISTS "IX_SpaceAgentSourceReceipt_Space_Band"
ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("SpaceID", "Band", "ConversationID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceID" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("SpaceID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceChatID" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("SpaceChatID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ConversationID" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("ConversationID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ConversationDetailID" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("ConversationDetailID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_AgentRunID" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("AgentRunID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_SpaceItemID" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("SpaceItemID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_ContentSourceID" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("ContentSourceID");

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceAgentSourceReceipt_TargetEntityID" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt" ("TargetEntityID");























































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Agent Source Receipts */

-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_bizappscollaboration';
  v_target_name CONSTANT TEXT := 'vwSpaceAgentSourceReceipts';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_bizappscollaboration."vwSpaceAgentSourceReceipts"
AS SELECT
    s.*,
    "mjBizAppsCollaborationSpace_SpaceID"."Name" AS "Space",
    "mjBizAppsCollaborationSpaceChat_SpaceChatID"."Name" AS "SpaceChat",
    "MJConversation_ConversationID"."Name" AS "Conversation",
    "MJContentSource_ContentSourceID"."Name" AS "ContentSource",
    "MJEntity_TargetEntityID"."Name" AS "TargetEntity"
FROM
    __mj_bizappscollaboration."SpaceAgentSourceReceipt" AS s
INNER JOIN
    __mj_bizappscollaboration."Space" AS "mjBizAppsCollaborationSpace_SpaceID"
  ON
    s."SpaceID" = "mjBizAppsCollaborationSpace_SpaceID"."ID"
INNER JOIN
    __mj_bizappscollaboration."SpaceChat" AS "mjBizAppsCollaborationSpaceChat_SpaceChatID"
  ON
    s."SpaceChatID" = "mjBizAppsCollaborationSpaceChat_SpaceChatID"."ID"
INNER JOIN
    ${mjSchema}."Conversation" AS "MJConversation_ConversationID"
  ON
    s."ConversationID" = "MJConversation_ConversationID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."ContentSource" AS "MJContentSource_ContentSourceID"
  ON
    s."ContentSourceID" = "MJContentSource_ContentSourceID"."ID"
LEFT OUTER JOIN
    ${mjSchema}."Entity" AS "MJEntity_TargetEntityID"
  ON
    s."TargetEntityID" = "MJEntity_TargetEntityID"."ID"$vsql$;
  v_target_oid OID;
  v_dep RECORD;
  v_captured JSONB[] := ARRAY[]::JSONB[];
  v_n INTEGER;
BEGIN
  EXECUTE vsql;
EXCEPTION WHEN invalid_table_definition THEN
  -- Column list changed; need CASCADE. Preserve dependent views first.
  SELECT c.oid INTO v_target_oid
  FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = v_target_schema AND c.relname = v_target_name AND c.relkind = 'v';
  IF v_target_oid IS NOT NULL THEN
    FOR v_dep IN
      WITH RECURSIVE deps AS (
        SELECT c.oid, c.relname AS name, n.nspname AS schema, 1 AS depth
        FROM pg_rewrite r
        JOIN pg_depend d ON d.objid = r.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE d.refobjid = v_target_oid AND d.deptype = 'n'
          AND c.oid <> v_target_oid AND c.relkind = 'v'
        UNION
        SELECT c.oid, c.relname, n.nspname, p.depth + 1
        FROM deps p
        JOIN pg_rewrite r ON TRUE
        JOIN pg_depend d ON d.objid = r.oid AND d.refobjid = p.oid
        JOIN pg_class c ON c.oid = r.ev_class
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind = 'v' AND c.oid <> p.oid
      )
      SELECT oid, name, schema, MAX(depth) AS max_depth,
             pg_catalog.pg_get_viewdef(oid, true) AS viewdef
      FROM deps GROUP BY oid, name, schema
      ORDER BY MAX(depth) ASC
    LOOP
      v_captured := v_captured || jsonb_build_object(
        'schema', v_dep.schema, 'name', v_dep.name, 'def', v_dep.viewdef);
    END LOOP;
  END IF;
  EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v_target_schema, v_target_name);
  EXECUTE vsql;
  IF v_captured IS NOT NULL AND array_length(v_captured, 1) > 0 THEN
    FOR v_n IN 1..array_length(v_captured, 1) LOOP
      BEGIN
        EXECUTE format('CREATE VIEW %I.%I AS %s',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', v_captured[v_n]->>'def');
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Could not restore dependent view %.%: %',
          v_captured[v_n]->>'schema', v_captured[v_n]->>'name', SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$do$;


-- ===================== Stored Procedures (sp*) =====================

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname = 'spCreateSpaceAgentSourceReceipt'
             AND pronamespace = '__mj_bizappscollaboration'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spCreateSpaceAgentSourceReceipt"(
    IN p_ID UUID DEFAULT NULL,
    IN p_SpaceID UUID DEFAULT NULL,
    IN p_SpaceChatID UUID DEFAULT NULL,
    IN p_ConversationID UUID DEFAULT NULL,
    IN p_ConversationDetailID UUID DEFAULT NULL,
    IN p_AgentRunID_Clear BOOLEAN DEFAULT FALSE,
    IN p_AgentRunID UUID DEFAULT NULL,
    IN p_SourceKind VARCHAR(30) DEFAULT NULL,
    IN p_SpaceItemID_Clear BOOLEAN DEFAULT FALSE,
    IN p_SpaceItemID UUID DEFAULT NULL,
    IN p_ContentSourceID_Clear BOOLEAN DEFAULT FALSE,
    IN p_ContentSourceID UUID DEFAULT NULL,
    IN p_TargetEntityID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetEntityID UUID DEFAULT NULL,
    IN p_TargetRecordID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetRecordID VARCHAR(450) DEFAULT NULL,
    IN p_SourceTitle VARCHAR(500) DEFAULT NULL,
    IN p_Band VARCHAR(20) DEFAULT NULL,
    IN p_WasSupplied BOOLEAN DEFAULT NULL,
    IN p_WasCited BOOLEAN DEFAULT NULL,
    IN p_RetrievalRank_Clear BOOLEAN DEFAULT FALSE,
    IN p_RetrievalRank INTEGER DEFAULT NULL,
    IN p_RelevanceScore_Clear BOOLEAN DEFAULT FALSE,
    IN p_RelevanceScore NUMERIC(12,6) DEFAULT NULL,
    IN p_RankingMode VARCHAR(20) DEFAULT NULL,
    IN p_CitationOrdinal_Clear BOOLEAN DEFAULT FALSE,
    IN p_CitationOrdinal INTEGER DEFAULT NULL,
    IN p_EstimatedTokens INTEGER DEFAULT NULL,
    IN p_WasTruncated BOOLEAN DEFAULT NULL,
    IN p_Sequence INTEGER DEFAULT NULL
)
RETURNS SETOF __mj_bizappscollaboration."vwSpaceAgentSourceReceipts" AS
$$
DECLARE
    v_inserted_id UUID;
BEGIN
IF p_ID IS NOT NULL THEN
        INSERT INTO __mj_bizappscollaboration."SpaceAgentSourceReceipt"
            (
                "ID",
                "SpaceID",
                "SpaceChatID",
                "ConversationID",
                "ConversationDetailID",
                "AgentRunID",
                "SourceKind",
                "SpaceItemID",
                "ContentSourceID",
                "TargetEntityID",
                "TargetRecordID",
                "SourceTitle",
                "Band",
                "WasSupplied",
                "WasCited",
                "RetrievalRank",
                "RelevanceScore",
                "RankingMode",
                "CitationOrdinal",
                "EstimatedTokens",
                "WasTruncated",
                "Sequence"
            )
        VALUES
            (
                p_ID,
                p_SpaceID,
                p_SpaceChatID,
                p_ConversationID,
                p_ConversationDetailID,
                CASE WHEN p_AgentRunID_Clear = TRUE THEN NULL ELSE COALESCE(p_AgentRunID, NULL) END,
                p_SourceKind,
                CASE WHEN p_SpaceItemID_Clear = TRUE THEN NULL ELSE COALESCE(p_SpaceItemID, NULL) END,
                CASE WHEN p_ContentSourceID_Clear = TRUE THEN NULL ELSE COALESCE(p_ContentSourceID, NULL) END,
                CASE WHEN p_TargetEntityID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetEntityID, NULL) END,
                CASE WHEN p_TargetRecordID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetRecordID, NULL) END,
                p_SourceTitle,
                p_Band,
                COALESCE(p_WasSupplied, TRUE),
                COALESCE(p_WasCited, FALSE),
                CASE WHEN p_RetrievalRank_Clear = TRUE THEN NULL ELSE COALESCE(p_RetrievalRank, NULL) END,
                CASE WHEN p_RelevanceScore_Clear = TRUE THEN NULL ELSE COALESCE(p_RelevanceScore, NULL) END,
                COALESCE(p_RankingMode, 'none'),
                CASE WHEN p_CitationOrdinal_Clear = TRUE THEN NULL ELSE COALESCE(p_CitationOrdinal, NULL) END,
                COALESCE(p_EstimatedTokens, 0),
                COALESCE(p_WasTruncated, FALSE),
                COALESCE(p_Sequence, 1)
            )
        RETURNING "ID" INTO v_inserted_id;
    ELSE
        INSERT INTO __mj_bizappscollaboration."SpaceAgentSourceReceipt"
            (
                "SpaceID",
                "SpaceChatID",
                "ConversationID",
                "ConversationDetailID",
                "AgentRunID",
                "SourceKind",
                "SpaceItemID",
                "ContentSourceID",
                "TargetEntityID",
                "TargetRecordID",
                "SourceTitle",
                "Band",
                "WasSupplied",
                "WasCited",
                "RetrievalRank",
                "RelevanceScore",
                "RankingMode",
                "CitationOrdinal",
                "EstimatedTokens",
                "WasTruncated",
                "Sequence"
            )
        VALUES
            (
                p_SpaceID,
                p_SpaceChatID,
                p_ConversationID,
                p_ConversationDetailID,
                CASE WHEN p_AgentRunID_Clear = TRUE THEN NULL ELSE COALESCE(p_AgentRunID, NULL) END,
                p_SourceKind,
                CASE WHEN p_SpaceItemID_Clear = TRUE THEN NULL ELSE COALESCE(p_SpaceItemID, NULL) END,
                CASE WHEN p_ContentSourceID_Clear = TRUE THEN NULL ELSE COALESCE(p_ContentSourceID, NULL) END,
                CASE WHEN p_TargetEntityID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetEntityID, NULL) END,
                CASE WHEN p_TargetRecordID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetRecordID, NULL) END,
                p_SourceTitle,
                p_Band,
                COALESCE(p_WasSupplied, TRUE),
                COALESCE(p_WasCited, FALSE),
                CASE WHEN p_RetrievalRank_Clear = TRUE THEN NULL ELSE COALESCE(p_RetrievalRank, NULL) END,
                CASE WHEN p_RelevanceScore_Clear = TRUE THEN NULL ELSE COALESCE(p_RelevanceScore, NULL) END,
                COALESCE(p_RankingMode, 'none'),
                CASE WHEN p_CitationOrdinal_Clear = TRUE THEN NULL ELSE COALESCE(p_CitationOrdinal, NULL) END,
                COALESCE(p_EstimatedTokens, 0),
                COALESCE(p_WasTruncated, FALSE),
                COALESCE(p_Sequence, 1)
            )
        RETURNING "ID" INTO v_inserted_id;
    END IF;
    RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceAgentSourceReceipts" WHERE "ID" = v_inserted_id;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname = 'spUpdateSpaceAgentSourceReceipt'
             AND pronamespace = '__mj_bizappscollaboration'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spUpdateSpaceAgentSourceReceipt"(
    IN p_ID UUID,
    IN p_SpaceID UUID DEFAULT NULL,
    IN p_SpaceChatID UUID DEFAULT NULL,
    IN p_ConversationID UUID DEFAULT NULL,
    IN p_ConversationDetailID UUID DEFAULT NULL,
    IN p_AgentRunID_Clear BOOLEAN DEFAULT FALSE,
    IN p_AgentRunID UUID DEFAULT NULL,
    IN p_SourceKind VARCHAR(30) DEFAULT NULL,
    IN p_SpaceItemID_Clear BOOLEAN DEFAULT FALSE,
    IN p_SpaceItemID UUID DEFAULT NULL,
    IN p_ContentSourceID_Clear BOOLEAN DEFAULT FALSE,
    IN p_ContentSourceID UUID DEFAULT NULL,
    IN p_TargetEntityID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetEntityID UUID DEFAULT NULL,
    IN p_TargetRecordID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetRecordID VARCHAR(450) DEFAULT NULL,
    IN p_SourceTitle VARCHAR(500) DEFAULT NULL,
    IN p_Band VARCHAR(20) DEFAULT NULL,
    IN p_WasSupplied BOOLEAN DEFAULT NULL,
    IN p_WasCited BOOLEAN DEFAULT NULL,
    IN p_RetrievalRank_Clear BOOLEAN DEFAULT FALSE,
    IN p_RetrievalRank INTEGER DEFAULT NULL,
    IN p_RelevanceScore_Clear BOOLEAN DEFAULT FALSE,
    IN p_RelevanceScore NUMERIC(12,6) DEFAULT NULL,
    IN p_RankingMode VARCHAR(20) DEFAULT NULL,
    IN p_CitationOrdinal_Clear BOOLEAN DEFAULT FALSE,
    IN p_CitationOrdinal INTEGER DEFAULT NULL,
    IN p_EstimatedTokens INTEGER DEFAULT NULL,
    IN p_WasTruncated BOOLEAN DEFAULT NULL,
    IN p_Sequence INTEGER DEFAULT NULL
)
RETURNS SETOF __mj_bizappscollaboration."vwSpaceAgentSourceReceipts" AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
UPDATE
        __mj_bizappscollaboration."SpaceAgentSourceReceipt"
    SET
        "SpaceID" = COALESCE(p_SpaceID, "SpaceID"),
        "SpaceChatID" = COALESCE(p_SpaceChatID, "SpaceChatID"),
        "ConversationID" = COALESCE(p_ConversationID, "ConversationID"),
        "ConversationDetailID" = COALESCE(p_ConversationDetailID, "ConversationDetailID"),
        "AgentRunID" = CASE WHEN p_AgentRunID_Clear = TRUE THEN NULL ELSE COALESCE(p_AgentRunID, "AgentRunID") END,
        "SourceKind" = COALESCE(p_SourceKind, "SourceKind"),
        "SpaceItemID" = CASE WHEN p_SpaceItemID_Clear = TRUE THEN NULL ELSE COALESCE(p_SpaceItemID, "SpaceItemID") END,
        "ContentSourceID" = CASE WHEN p_ContentSourceID_Clear = TRUE THEN NULL ELSE COALESCE(p_ContentSourceID, "ContentSourceID") END,
        "TargetEntityID" = CASE WHEN p_TargetEntityID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetEntityID, "TargetEntityID") END,
        "TargetRecordID" = CASE WHEN p_TargetRecordID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetRecordID, "TargetRecordID") END,
        "SourceTitle" = COALESCE(p_SourceTitle, "SourceTitle"),
        "Band" = COALESCE(p_Band, "Band"),
        "WasSupplied" = COALESCE(p_WasSupplied, "WasSupplied"),
        "WasCited" = COALESCE(p_WasCited, "WasCited"),
        "RetrievalRank" = CASE WHEN p_RetrievalRank_Clear = TRUE THEN NULL ELSE COALESCE(p_RetrievalRank, "RetrievalRank") END,
        "RelevanceScore" = CASE WHEN p_RelevanceScore_Clear = TRUE THEN NULL ELSE COALESCE(p_RelevanceScore, "RelevanceScore") END,
        "RankingMode" = COALESCE(p_RankingMode, "RankingMode"),
        "CitationOrdinal" = CASE WHEN p_CitationOrdinal_Clear = TRUE THEN NULL ELSE COALESCE(p_CitationOrdinal, "CitationOrdinal") END,
        "EstimatedTokens" = COALESCE(p_EstimatedTokens, "EstimatedTokens"),
        "WasTruncated" = COALESCE(p_WasTruncated, "WasTruncated"),
        "Sequence" = COALESCE(p_Sequence, "Sequence")
    WHERE
        "ID" = p_ID;

    GET DIAGNOSTICS _v_row_count = ROW_COUNT;

    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceAgentSourceReceipts" WHERE 1=0;
    ELSE
        RETURN QUERY SELECT * FROM __mj_bizappscollaboration."vwSpaceAgentSourceReceipts" WHERE "ID" = p_ID;
    END IF;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname = 'spDeleteSpaceAgentSourceReceipt'
             AND pronamespace = '__mj_bizappscollaboration'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."spDeleteSpaceAgentSourceReceipt"(
    IN p_ID UUID
)
RETURNS TABLE("_result_id" UUID) AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
DELETE FROM
        __mj_bizappscollaboration."SpaceAgentSourceReceipt"
    WHERE
        "ID" = p_ID;

    GET DIAGNOSTICS _v_row_count = ROW_COUNT;

    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "_result_id";
    ELSE
        RETURN QUERY SELECT p_ID AS "_result_id";
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ===================== Triggers =====================

CREATE OR REPLACE FUNCTION __mj_bizappscollaboration."trgUpdateSpaceAgentSourceReceipt_func"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trgUpdateSpaceAgentSourceReceipt" ON __mj_bizappscollaboration."SpaceAgentSourceReceipt";
CREATE TRIGGER "trgUpdateSpaceAgentSourceReceipt"
    BEFORE UPDATE ON __mj_bizappscollaboration."SpaceAgentSourceReceipt"
    FOR EACH ROW
    EXECUTE FUNCTION __mj_bizappscollaboration."trgUpdateSpaceAgentSourceReceipt_func"();


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."Entity" WHERE "ID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' OR ("SchemaName" = '__mj_bizappscollaboration' AND "BaseTable" = 'SpaceAgentSourceReceipt')
    ) THEN
        INSERT INTO ${mjSchema}."Entity" (
        "ID",
        "Name",
        "DisplayName",
        "Description",
        "NameSuffix",
        "BaseTable",
        "BaseView",
        "SchemaName",
        "IncludeInAPI",
        "AllowUserSearchAPI",
        "AllowCaching",
        "TrackRecordChanges",
        "AuditRecordAccess",
        "AuditViewRuns",
        "AllowAllRowsAPI",
        "AllowCreateAPI",
        "AllowUpdateAPI",
        "AllowDeleteAPI",
        "UserViewMaxRows",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES (
        'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31',
        'MJ_BizApps_Collaboration: Space Agent Source Receipts',
        'Space Agent Source Receipts',
        'Relational provenance receipt on a space agent answer message, recording each in-reach space item or knowledge source supplied to the turn and whether it was cited in the answer.',
        NULL,
        'SpaceAgentSourceReceipt',
        'vwSpaceAgentSourceReceipts',
        '__mj_bizappscollaboration',
        TRUE,
        TRUE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        TRUE,
        TRUE,
        TRUE,
        1000,
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."ApplicationEntity"
        WHERE "ApplicationID" = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'
        AND "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'
    ) THEN
        INSERT INTO ${mjSchema}."ApplicationEntity"
        ("ApplicationID", "EntityID", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES
        (
        '94F5906B-38AB-4A9F-BFCA-3D395BBBC198',
        'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31',
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."ApplicationEntity" WHERE "ApplicationID" = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'),
        NOW(),
        NOW()
        );
    END IF;
END $$;

INSERT INTO ${mjSchema}."EntityPermission"
    ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS UUID), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, FALSE, FALSE, FALSE, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ${mjSchema}."EntityPermission"
    WHERE "EntityID" = CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS UUID)
      AND "RoleID" = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID)
      AND "Type" = 'Allow'
);

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agent Source Receipts for role Developer */

INSERT INTO ${mjSchema}."EntityPermission"
    ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS UUID), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ${mjSchema}."EntityPermission"
    WHERE "EntityID" = CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS UUID)
      AND "RoleID" = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID)
      AND "Type" = 'Allow'
);

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agent Source Receipts for role Integration */

INSERT INTO ${mjSchema}."EntityPermission"
    ("EntityID", "RoleID", "Type", "CanRead", "CanCreate", "CanUpdate", "CanDelete", "__mj_CreatedAt", "__mj_UpdatedAt")
SELECT CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS UUID), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID), 'Allow', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM ${mjSchema}."EntityPermission"
    WHERE "EntityID" = CAST('A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AS UUID)
      AND "RoleID" = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS UUID)
      AND "Type" = 'Allow'
);

/* SQL text to update existing entities from schema */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000001-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'ID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000001-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ID', 'ID', NULL, 'UUID', 16, 0, 0, FALSE, 'gen_random_uuid()', FALSE, FALSE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000002-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'SpaceID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000002-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SpaceID', 'Space ID', 'The space that owns the source (for SpaceItem) or the chat anchor space (for KnowledgeSource).', 'UUID', 16, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, FALSE, '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000003-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'SpaceChatID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000003-7d3f-4e8a-9b12-4C6D8E0F2A31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SpaceChatID', 'Space Chat ID', 'The SpaceChat record in which the agent turn ran.', 'UUID', 16, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, FALSE, '75E3ED25-C46B-45C1-96F7-91578D88DBE2', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000004-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'ConversationID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000004-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ConversationID', 'Conversation ID', 'The MJ Conversation in which the agent message was authored.', 'UUID', 16, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, FALSE, '13248F34-2837-EF11-86D4-6045BDEE16E6', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000005-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'ConversationDetailID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000005-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ConversationDetailID', 'Conversation Detail ID', 'The assistant ConversationDetail message this receipt belongs to.', 'UUID', 16, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, FALSE, '12248F34-2837-EF11-86D4-6045BDEE16E6', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, TRUE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000006-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'AgentRunID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000006-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'AgentRunID', 'Agent Run ID', 'The AI Agent Run associated with this answer turn, when available.', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, '5190AF93-4C39-4429-BDAA-0AEB492A0256', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'SourceKind')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SourceKind', 'Source Kind', 'Discriminator identifying whether the source is a SpaceItem or a KnowledgeSource.', 'nvarchar', 60, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000008-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'SpaceItemID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000008-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SpaceItemID', 'Space Item ID', 'The in-reach SpaceItem supplied or cited when SourceKind is SpaceItem.', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, '41165FEC-A52B-469A-A880-3B108C39A65E', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, TRUE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000009-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'ContentSourceID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000009-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ContentSourceID', 'Content Source ID', 'The in-reach ContentSource supplied or cited when SourceKind is KnowledgeSource.', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, TRUE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000010-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'TargetEntityID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000010-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'TargetEntityID', 'Target Entity ID', 'The underlying target MJ Entity ID for this source (polymorphic pair with TargetRecordID).', 'UUID', 16, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, 'E0238F34-2837-EF11-86D4-6045BDEE16E6', 'ID', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000011-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'TargetRecordID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000011-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'TargetRecordID', 'Target Record ID', 'The canonical target record key (e.g. ID|<uuid>) for opening the in-reach source.', 'nvarchar', 900, 0, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000012-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'SourceTitle')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000012-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SourceTitle', 'Source Title', 'Display title of the validated in-reach source captured at turn execution time.', 'nvarchar', 1000, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, FALSE, NULL, NULL, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'Band')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'Band', 'Band', 'Visibility band of the source (Shared or Team), strictly bounded by the chat audience.', 'nvarchar', 40, 0, 0, FALSE, NULL, FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000014-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'WasSupplied')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000014-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'WasSupplied', 'Was Supplied', 'True when this source was supplied into the agent turn prompt or tools context.', 'BOOLEAN', 1, 1, 0, FALSE, '((1))', FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000015-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'WasCited')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000015-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'WasCited', 'Was Cited', 'True when this in-reach source was specifically cited in the generated agent answer.', 'BOOLEAN', 1, 1, 0, FALSE, '((0))', FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, TRUE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000016-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'RetrievalRank')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000016-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'RetrievalRank', 'Retrieval Rank', '1-based retrieval rank assigned during bounded top-k retrieval.', 'int', 4, 10, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000017-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'RelevanceScore')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000017-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'RelevanceScore', 'Relevance Score', 'Relevance score computed by vector search or lexical BM25 fallback.', 'decimal', 9, 12, 6, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'RankingMode')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'RankingMode', 'Ranking Mode', 'How the source was selected for the turn: vector, lexical, grant, or none.', 'nvarchar', 40, 0, 0, FALSE, 'none', FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000019-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'CitationOrdinal')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000019-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'CitationOrdinal', 'Citation Ordinal', '1-based citation order within the generated answer when WasCited is true.', 'int', 4, 10, 0, TRUE, NULL, FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000020-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'EstimatedTokens')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000020-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'EstimatedTokens', 'Estimated Tokens', 'Estimated prompt tokens consumed by this source under the bounded context budget.', 'int', 4, 10, 0, FALSE, '((0))', FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000021-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'WasTruncated')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000021-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'WasTruncated', 'Was Truncated', 'True when source content was truncated to fit the per-source token ceiling.', 'BOOLEAN', 1, 1, 0, FALSE, '((0))', FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000022-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'Sequence')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000022-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'Sequence', 'Sequence', 'Deterministic display sequence of the receipt on the assistant message.', 'int', 4, 10, 0, FALSE, '((1))', FALSE, TRUE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000023-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = '__mj_CreatedAt')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000023-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), '__mj_CreatedAt', 'Created At', NULL, 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, FALSE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000024-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = '__mj_UpdatedAt')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000024-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), '__mj_UpdatedAt', 'Updated At', NULL, 'TIMESTAMPTZ', 10, 34, 7, FALSE, 'NOW()', FALSE, FALSE, FALSE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000025-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'Space')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000025-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'Space', 'Space', NULL, 'nvarchar', 400, 0, 0, FALSE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000026-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'SpaceChat')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000026-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'SpaceChat', 'Space Chat', NULL, 'nvarchar', 510, 0, 0, FALSE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000027-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'Conversation')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000027-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'Conversation', 'Conversation', NULL, 'nvarchar', 510, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000028-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'ContentSource')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000028-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'ContentSource', 'Content Source', NULL, 'nvarchar', 510, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = 'b1000029-7d3f-4e8a-9b12-4c6d8e0f2a31' OR ("EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "Name" = 'TargetEntity')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField" ("ID", "EntityID", "Sequence", "Name", "DisplayName", "Description", "Type", "Length", "Precision", "Scale", "AllowsNull", "DefaultValue", "AutoIncrement", "AllowUpdateAPI", "IsVirtual", "IsComputed", "RelatedEntityID", "RelatedEntityFieldName", "IsNameField", "IncludeInUserSearchAPI", "IncludeRelatedEntityNameFieldInBaseView", "DefaultInView", "IsPrimaryKey", "IsUnique", "RelatedEntityDisplayType", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('b1000029-7d3f-4e8a-9b12-4c6d8e0f2a31', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31'), 'TargetEntity', 'Target Entity', NULL, 'nvarchar', 510, 0, 0, TRUE, NULL, FALSE, FALSE, TRUE, FALSE, NULL, NULL, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 'Search', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = 'c1000001-7d3f-4e8a-9b12-4c6d8e0f2a31'
    ) THEN
        INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c1000001-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 1, 'SpaceItem', 'SpaceItem', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = 'c1000002-7d3f-4e8a-9b12-4c6d8e0f2a31'
    ) THEN
        INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c1000002-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 2, 'KnowledgeSource', 'KnowledgeSource', NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField" SET "ValueListType" = 'List' WHERE "ID" = 'b1000007-7d3f-4e8a-9b12-4c6d8e0f2a31';

/* Value list entries for Band */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = 'c1000003-7d3f-4e8a-9b12-4c6d8e0f2a31'
    ) THEN
        INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c1000003-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31', 1, 'Shared', 'Shared', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = 'c1000004-7d3f-4e8a-9b12-4c6d8e0f2a31'
    ) THEN
        INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c1000004-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31', 2, 'Team', 'Team', NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField" SET "ValueListType" = 'List' WHERE "ID" = 'b1000013-7d3f-4e8a-9b12-4c6d8e0f2a31';

/* Value list entries for RankingMode */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = 'c1000005-7d3f-4e8a-9b12-4c6d8e0f2a31'
    ) THEN
        INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c1000005-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 1, 'vector', 'vector', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = 'c1000006-7d3f-4e8a-9b12-4c6d8e0f2a31'
    ) THEN
        INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c1000006-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 2, 'lexical', 'lexical', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = 'c1000007-7d3f-4e8a-9b12-4c6d8e0f2a31'
    ) THEN
        INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 3, 'grant', 'grant', NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityFieldValue" WHERE "ID" = 'c1000008-7d3f-4e8a-9b12-4c6d8e0f2a31'
    ) THEN
        INSERT INTO ${mjSchema}."EntityFieldValue" ("ID", "EntityFieldID", "Sequence", "Value", "Code", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('c1000008-7d3f-4e8a-9b12-4c6d8e0f2a31', 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31', 4, 'none', 'none', NOW(), NOW());
    END IF;
END $$;

UPDATE ${mjSchema}."EntityField" SET "ValueListType" = 'List' WHERE "ID" = 'b1000018-7d3f-4e8a-9b12-4c6d8e0f2a31';

/* Create Entity Relationships */

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship"
        WHERE "ID" = 'd1000001-7d3f-4e8a-9b12-4c6d8e0f2a31'
        OR ("EntityID" = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND "RelatedEntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "RelatedEntityJoinField" = 'SpaceID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d1000001-7d3f-4e8a-9b12-4c6d8e0f2a31', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'SpaceID', 'One To Many', TRUE, TRUE, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityRelationship" WHERE "EntityID" = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'), NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship"
        WHERE "ID" = 'd1000002-7d3f-4e8a-9b12-4c6d8e0f2a31'
        OR ("EntityID" = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND "RelatedEntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "RelatedEntityJoinField" = 'SpaceChatID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d1000002-7d3f-4e8a-9b12-4c6d8e0f2a31', '75E3ED25-C46B-45C1-96F7-91578D88DBE2', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'SpaceChatID', 'One To Many', TRUE, TRUE, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityRelationship" WHERE "EntityID" = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'), NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship"
        WHERE "ID" = 'd1000003-7d3f-4e8a-9b12-4c6d8e0f2a31'
        OR ("EntityID" = '13248F34-2837-EF11-86D4-6045BDEE16E6' AND "RelatedEntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "RelatedEntityJoinField" = 'ConversationID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d1000003-7d3f-4e8a-9b12-4c6d8e0f2a31', '13248F34-2837-EF11-86D4-6045BDEE16E6', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'ConversationID', 'One To Many', TRUE, TRUE, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityRelationship" WHERE "EntityID" = '13248F34-2837-EF11-86D4-6045BDEE16E6'), NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship"
        WHERE "ID" = 'd1000004-7d3f-4e8a-9b12-4c6d8e0f2a31'
        OR ("EntityID" = '12248F34-2837-EF11-86D4-6045BDEE16E6' AND "RelatedEntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "RelatedEntityJoinField" = 'ConversationDetailID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d1000004-7d3f-4e8a-9b12-4c6d8e0f2a31', '12248F34-2837-EF11-86D4-6045BDEE16E6', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'ConversationDetailID', 'One To Many', TRUE, TRUE, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityRelationship" WHERE "EntityID" = '12248F34-2837-EF11-86D4-6045BDEE16E6'), NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship"
        WHERE "ID" = 'd1000005-7d3f-4e8a-9b12-4c6d8e0f2a31'
        OR ("EntityID" = '5190AF93-4C39-4429-BDAA-0AEB492A0256' AND "RelatedEntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "RelatedEntityJoinField" = 'AgentRunID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d1000005-7d3f-4e8a-9b12-4c6d8e0f2a31', '5190AF93-4C39-4429-BDAA-0AEB492A0256', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'AgentRunID', 'One To Many', TRUE, TRUE, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityRelationship" WHERE "EntityID" = '5190AF93-4C39-4429-BDAA-0AEB492A0256'), NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship"
        WHERE "ID" = 'd1000006-7d3f-4e8a-9b12-4c6d8e0f2a31'
        OR ("EntityID" = '41165FEC-A52B-469A-A880-3B108C39A65E' AND "RelatedEntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "RelatedEntityJoinField" = 'SpaceItemID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d1000006-7d3f-4e8a-9b12-4c6d8e0f2a31', '41165FEC-A52B-469A-A880-3B108C39A65E', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'SpaceItemID', 'One To Many', TRUE, TRUE, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityRelationship" WHERE "EntityID" = '41165FEC-A52B-469A-A880-3B108C39A65E'), NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship"
        WHERE "ID" = 'd1000007-7d3f-4e8a-9b12-4c6d8e0f2a31'
        OR ("EntityID" = 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22' AND "RelatedEntityID" = 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31' AND "RelatedEntityJoinField" = 'ContentSourceID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('d1000007-7d3f-4e8a-9b12-4c6d8e0f2a31', 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22', 'A9B4C2E1-7D3F-4E8A-9B12-4C6D8E0F2A31', 'ContentSourceID', 'One To Many', TRUE, TRUE, (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityRelationship" WHERE "EntityID" = 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22'), NOW(), NOW());
    END IF;
END $$;


-- ===================== Grants =====================

DO $$ BEGIN GRANT SELECT ON __mj_bizappscollaboration."vwSpaceAgentSourceReceipts" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spCreateSpaceAgentSourceReceipt" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spUpdateSpaceAgentSourceReceipt" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_bizappscollaboration."spDeleteSpaceAgentSourceReceipt" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
-- ===================== Comments =====================

COMMENT ON TABLE __mj_bizappscollaboration."SpaceAgentSourceReceipt" IS 'Relational provenance receipt on a space agent answer message, recording each in-reach space item or knowledge source supplied to the turn and whether it was cited in the answer.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."SpaceID" IS 'The space that owns the source (for SpaceItem) or the chat anchor space (for KnowledgeSource).';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."SpaceChatID" IS 'The SpaceChat record in which the agent turn ran.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."ConversationID" IS 'The MJ Conversation in which the agent message was authored.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."ConversationDetailID" IS 'The assistant ConversationDetail message this receipt belongs to.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."AgentRunID" IS 'The AI Agent Run associated with this answer turn, when available.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."SourceKind" IS 'Discriminator identifying whether the source is a SpaceItem or a KnowledgeSource.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."SpaceItemID" IS 'The in-reach SpaceItem supplied or cited when SourceKind is SpaceItem.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."ContentSourceID" IS 'The in-reach ContentSource supplied or cited when SourceKind is KnowledgeSource.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."TargetEntityID" IS 'The underlying target MJ Entity ID for this source (polymorphic pair with TargetRecordID).';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."TargetRecordID" IS 'The canonical target record key (e.g. ID|<uuid>) for opening the in-reach source.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."SourceTitle" IS 'Display title of the validated in-reach source captured at turn execution time.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."Band" IS 'Visibility band of the source (Shared or Team), strictly bounded by the chat audience.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."WasSupplied" IS 'True when this source was supplied into the agent turn prompt or tools context.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."WasCited" IS 'True when this in-reach source was specifically cited in the generated agent answer.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."RetrievalRank" IS '1-based retrieval rank assigned during bounded top-k retrieval.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."RelevanceScore" IS 'Relevance score computed by vector search or lexical BM25 fallback.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."RankingMode" IS 'How the source was selected for the turn: vector, lexical, grant, or none.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."CitationOrdinal" IS '1-based citation order within the generated answer when WasCited is true.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."EstimatedTokens" IS 'Estimated prompt tokens consumed by this source under the bounded context budget.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."WasTruncated" IS 'True when source content was truncated to fit the per-source token ceiling.';

COMMENT ON COLUMN __mj_bizappscollaboration."SpaceAgentSourceReceipt"."Sequence" IS 'Deterministic display sequence of the receipt on the assistant message.';

-- ===================== Other =====================
