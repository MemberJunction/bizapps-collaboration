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
CREATE SCHEMA IF NOT EXISTS __mj_BizAppsCollaboration;
SET search_path TO __mj_BizAppsCollaboration, public;

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
-- Migration: V202611220100__v0.2.x__SpaceType_TargetApplication.sql
-- CX-6: Adds optional TargetApplicationID foreign key on SpaceType so each
-- space type declares the target MJ Application invited users land in,
-- defaulting gracefully to the Collaboration application when NULL.
-- =============================================================================

ALTER TABLE __mj_BizAppsCollaboration."SpaceType"
 ADD COLUMN IF NOT EXISTS "TargetApplicationID" UUID NULL;

CREATE INDEX IF NOT EXISTS "IDX_AUTO_MJ_FKEY_SpaceType_TargetApplicationID" ON __mj_BizAppsCollaboration."SpaceType" ("TargetApplicationID");


-- ===================== Views =====================

DO $do$
DECLARE
  v_target_schema CONSTANT TEXT := '__mj_BizAppsCollaboration';
  v_target_name CONSTANT TEXT := 'vwSpaceTypes';
  vsql CONSTANT TEXT := $vsql$CREATE OR REPLACE VIEW __mj_BizAppsCollaboration."vwSpaceTypes"
AS SELECT
    s.*,
    "MJApplication_TargetApplicationID"."Name" AS "TargetApplication"
FROM
    __mj_BizAppsCollaboration."SpaceType" AS s
LEFT OUTER JOIN
    ${mjSchema}."Application" AS "MJApplication_TargetApplicationID"
  ON
    s."TargetApplicationID" = "MJApplication_TargetApplicationID"."ID"$vsql$;
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
           WHERE proname = 'spCreateSpaceType'
             AND pronamespace = '__mj_BizAppsCollaboration'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION __mj_BizAppsCollaboration."spCreateSpaceType"(
    IN p_ID UUID DEFAULT NULL,
    IN p_Code VARCHAR(40) DEFAULT NULL,
    IN p_Name VARCHAR(200) DEFAULT NULL,
    IN p_Description_Clear BOOLEAN DEFAULT FALSE,
    IN p_Description TEXT DEFAULT NULL,
    IN p_Vocabulary VARCHAR(50) DEFAULT NULL,
    IN p_Discoverability VARCHAR(20) DEFAULT NULL,
    IN p_JoinMode VARCHAR(20) DEFAULT NULL,
    IN p_MessagingPanel BOOLEAN DEFAULT NULL,
    IN p_LibraryPanel BOOLEAN DEFAULT NULL,
    IN p_WorkPanel BOOLEAN DEFAULT NULL,
    IN p_DefaultAgentRetrieval VARCHAR(30) DEFAULT NULL,
    IN p_DefaultBand VARCHAR(20) DEFAULT NULL,
    IN p_InviteApproval VARCHAR(20) DEFAULT NULL,
    IN p_MemberCap_Clear BOOLEAN DEFAULT FALSE,
    IN p_MemberCap INTEGER DEFAULT NULL,
    IN p_DisplayRank INTEGER DEFAULT NULL,
    IN p_IsActive BOOLEAN DEFAULT NULL,
    IN p_DefaultAllowParentAssignees BOOLEAN DEFAULT NULL,
    IN p_IconClass_Clear BOOLEAN DEFAULT FALSE,
    IN p_IconClass VARCHAR(100) DEFAULT NULL,
    IN p_Color_Clear BOOLEAN DEFAULT FALSE,
    IN p_Color VARCHAR(50) DEFAULT NULL,
    IN p_ServerDriverClass_Clear BOOLEAN DEFAULT FALSE,
    IN p_ServerDriverClass VARCHAR(255) DEFAULT NULL,
    IN p_UIDriverClass_Clear BOOLEAN DEFAULT FALSE,
    IN p_UIDriverClass VARCHAR(255) DEFAULT NULL,
    IN p_SpaceExtensionEntity_Clear BOOLEAN DEFAULT FALSE,
    IN p_SpaceExtensionEntity VARCHAR(255) DEFAULT NULL,
    IN p_Configuration_Clear BOOLEAN DEFAULT FALSE,
    IN p_Configuration TEXT DEFAULT NULL,
    IN p_TargetApplicationID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetApplicationID UUID DEFAULT NULL
)
RETURNS SETOF __mj_BizAppsCollaboration."vwSpaceTypes" AS
$$
DECLARE
    v_id UUID;
BEGIN
IF p_ID IS NOT NULL THEN
        -- User provided a value, use it
        INSERT INTO __mj_BizAppsCollaboration."SpaceType"
            (
                "ID",
                "Code",
                "Name",
                "Description",
                "Vocabulary",
                "Discoverability",
                "JoinMode",
                "MessagingPanel",
                "LibraryPanel",
                "WorkPanel",
                "DefaultAgentRetrieval",
                "DefaultBand",
                "InviteApproval",
                "MemberCap",
                "DisplayRank",
                "IsActive",
                "DefaultAllowParentAssignees",
                "IconClass",
                "Color",
                "ServerDriverClass",
                "UIDriverClass",
                "SpaceExtensionEntity",
                "Configuration",
                "TargetApplicationID"
            )
        VALUES
            (
                p_ID,
                p_Code,
                p_Name,
                CASE WHEN p_Description_Clear = TRUE THEN NULL ELSE COALESCE(p_Description, NULL) END,
                p_Vocabulary,
                COALESCE(p_Discoverability, 'Hidden'),
                COALESCE(p_JoinMode, 'InviteOnly'),
                COALESCE(p_MessagingPanel, TRUE),
                COALESCE(p_LibraryPanel, FALSE),
                COALESCE(p_WorkPanel, FALSE),
                COALESCE(p_DefaultAgentRetrieval, 'Included'),
                COALESCE(p_DefaultBand, 'Team'),
                COALESCE(p_InviteApproval, 'Approve'),
                CASE WHEN p_MemberCap_Clear = TRUE THEN NULL ELSE COALESCE(p_MemberCap, NULL) END,
                COALESCE(p_DisplayRank, 0),
                COALESCE(p_IsActive, TRUE),
                COALESCE(p_DefaultAllowParentAssignees, TRUE),
                CASE WHEN p_IconClass_Clear = TRUE THEN NULL ELSE COALESCE(p_IconClass, NULL) END,
                CASE WHEN p_Color_Clear = TRUE THEN NULL ELSE COALESCE(p_Color, NULL) END,
                CASE WHEN p_ServerDriverClass_Clear = TRUE THEN NULL ELSE COALESCE(p_ServerDriverClass, NULL) END,
                CASE WHEN p_UIDriverClass_Clear = TRUE THEN NULL ELSE COALESCE(p_UIDriverClass, NULL) END,
                CASE WHEN p_SpaceExtensionEntity_Clear = TRUE THEN NULL ELSE COALESCE(p_SpaceExtensionEntity, NULL) END,
                CASE WHEN p_Configuration_Clear = TRUE THEN NULL ELSE COALESCE(p_Configuration, NULL) END,
                CASE WHEN p_TargetApplicationID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetApplicationID, NULL) END
            )
        RETURNING "ID" INTO v_id;
    ELSE
        -- No value provided, let database use its default (e.g., gen_random_uuid())
        INSERT INTO __mj_BizAppsCollaboration."SpaceType"
            (
                "Code",
                "Name",
                "Description",
                "Vocabulary",
                "Discoverability",
                "JoinMode",
                "MessagingPanel",
                "LibraryPanel",
                "WorkPanel",
                "DefaultAgentRetrieval",
                "DefaultBand",
                "InviteApproval",
                "MemberCap",
                "DisplayRank",
                "IsActive",
                "DefaultAllowParentAssignees",
                "IconClass",
                "Color",
                "ServerDriverClass",
                "UIDriverClass",
                "SpaceExtensionEntity",
                "Configuration",
                "TargetApplicationID"
            )
        VALUES
            (
                p_Code,
                p_Name,
                CASE WHEN p_Description_Clear = TRUE THEN NULL ELSE COALESCE(p_Description, NULL) END,
                p_Vocabulary,
                COALESCE(p_Discoverability, 'Hidden'),
                COALESCE(p_JoinMode, 'InviteOnly'),
                COALESCE(p_MessagingPanel, TRUE),
                COALESCE(p_LibraryPanel, FALSE),
                COALESCE(p_WorkPanel, FALSE),
                COALESCE(p_DefaultAgentRetrieval, 'Included'),
                COALESCE(p_DefaultBand, 'Team'),
                COALESCE(p_InviteApproval, 'Approve'),
                CASE WHEN p_MemberCap_Clear = TRUE THEN NULL ELSE COALESCE(p_MemberCap, NULL) END,
                COALESCE(p_DisplayRank, 0),
                COALESCE(p_IsActive, TRUE),
                COALESCE(p_DefaultAllowParentAssignees, TRUE),
                CASE WHEN p_IconClass_Clear = TRUE THEN NULL ELSE COALESCE(p_IconClass, NULL) END,
                CASE WHEN p_Color_Clear = TRUE THEN NULL ELSE COALESCE(p_Color, NULL) END,
                CASE WHEN p_ServerDriverClass_Clear = TRUE THEN NULL ELSE COALESCE(p_ServerDriverClass, NULL) END,
                CASE WHEN p_UIDriverClass_Clear = TRUE THEN NULL ELSE COALESCE(p_UIDriverClass, NULL) END,
                CASE WHEN p_SpaceExtensionEntity_Clear = TRUE THEN NULL ELSE COALESCE(p_SpaceExtensionEntity, NULL) END,
                CASE WHEN p_Configuration_Clear = TRUE THEN NULL ELSE COALESCE(p_Configuration, NULL) END,
                CASE WHEN p_TargetApplicationID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetApplicationID, NULL) END
            )
        RETURNING "ID" INTO v_id;
    END IF;
    -- return the new record from the base view, which might have some calculated fields
    RETURN QUERY SELECT * FROM __mj_BizAppsCollaboration."vwSpaceTypes" WHERE "ID" = v_id;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname = 'spUpdateSpaceType'
             AND pronamespace = '__mj_BizAppsCollaboration'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION __mj_BizAppsCollaboration."spUpdateSpaceType"(
    IN p_ID UUID,
    IN p_Code VARCHAR(40) DEFAULT NULL,
    IN p_Name VARCHAR(200) DEFAULT NULL,
    IN p_Description_Clear BOOLEAN DEFAULT FALSE,
    IN p_Description TEXT DEFAULT NULL,
    IN p_Vocabulary VARCHAR(50) DEFAULT NULL,
    IN p_Discoverability VARCHAR(20) DEFAULT NULL,
    IN p_JoinMode VARCHAR(20) DEFAULT NULL,
    IN p_MessagingPanel BOOLEAN DEFAULT NULL,
    IN p_LibraryPanel BOOLEAN DEFAULT NULL,
    IN p_WorkPanel BOOLEAN DEFAULT NULL,
    IN p_DefaultAgentRetrieval VARCHAR(30) DEFAULT NULL,
    IN p_DefaultBand VARCHAR(20) DEFAULT NULL,
    IN p_InviteApproval VARCHAR(20) DEFAULT NULL,
    IN p_MemberCap_Clear BOOLEAN DEFAULT FALSE,
    IN p_MemberCap INTEGER DEFAULT NULL,
    IN p_DisplayRank INTEGER DEFAULT NULL,
    IN p_IsActive BOOLEAN DEFAULT NULL,
    IN p_DefaultAllowParentAssignees BOOLEAN DEFAULT NULL,
    IN p_IconClass_Clear BOOLEAN DEFAULT FALSE,
    IN p_IconClass VARCHAR(100) DEFAULT NULL,
    IN p_Color_Clear BOOLEAN DEFAULT FALSE,
    IN p_Color VARCHAR(50) DEFAULT NULL,
    IN p_ServerDriverClass_Clear BOOLEAN DEFAULT FALSE,
    IN p_ServerDriverClass VARCHAR(255) DEFAULT NULL,
    IN p_UIDriverClass_Clear BOOLEAN DEFAULT FALSE,
    IN p_UIDriverClass VARCHAR(255) DEFAULT NULL,
    IN p_SpaceExtensionEntity_Clear BOOLEAN DEFAULT FALSE,
    IN p_SpaceExtensionEntity VARCHAR(255) DEFAULT NULL,
    IN p_Configuration_Clear BOOLEAN DEFAULT FALSE,
    IN p_Configuration TEXT DEFAULT NULL,
    IN p_TargetApplicationID_Clear BOOLEAN DEFAULT FALSE,
    IN p_TargetApplicationID UUID DEFAULT NULL
)
RETURNS SETOF __mj_BizAppsCollaboration."vwSpaceTypes" AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
UPDATE
        __mj_BizAppsCollaboration."SpaceType"
    SET
        "Code" = COALESCE(p_Code, "Code"),
        "Name" = COALESCE(p_Name, "Name"),
        "Description" = CASE WHEN p_Description_Clear = TRUE THEN NULL ELSE COALESCE(p_Description, "Description") END,
        "Vocabulary" = COALESCE(p_Vocabulary, "Vocabulary"),
        "Discoverability" = COALESCE(p_Discoverability, "Discoverability"),
        "JoinMode" = COALESCE(p_JoinMode, "JoinMode"),
        "MessagingPanel" = COALESCE(p_MessagingPanel, "MessagingPanel"),
        "LibraryPanel" = COALESCE(p_LibraryPanel, "LibraryPanel"),
        "WorkPanel" = COALESCE(p_WorkPanel, "WorkPanel"),
        "DefaultAgentRetrieval" = COALESCE(p_DefaultAgentRetrieval, "DefaultAgentRetrieval"),
        "DefaultBand" = COALESCE(p_DefaultBand, "DefaultBand"),
        "InviteApproval" = COALESCE(p_InviteApproval, "InviteApproval"),
        "MemberCap" = CASE WHEN p_MemberCap_Clear = TRUE THEN NULL ELSE COALESCE(p_MemberCap, "MemberCap") END,
        "DisplayRank" = COALESCE(p_DisplayRank, "DisplayRank"),
        "IsActive" = COALESCE(p_IsActive, "IsActive"),
        "DefaultAllowParentAssignees" = COALESCE(p_DefaultAllowParentAssignees, "DefaultAllowParentAssignees"),
        "IconClass" = CASE WHEN p_IconClass_Clear = TRUE THEN NULL ELSE COALESCE(p_IconClass, "IconClass") END,
        "Color" = CASE WHEN p_Color_Clear = TRUE THEN NULL ELSE COALESCE(p_Color, "Color") END,
        "ServerDriverClass" = CASE WHEN p_ServerDriverClass_Clear = TRUE THEN NULL ELSE COALESCE(p_ServerDriverClass, "ServerDriverClass") END,
        "UIDriverClass" = CASE WHEN p_UIDriverClass_Clear = TRUE THEN NULL ELSE COALESCE(p_UIDriverClass, "UIDriverClass") END,
        "SpaceExtensionEntity" = CASE WHEN p_SpaceExtensionEntity_Clear = TRUE THEN NULL ELSE COALESCE(p_SpaceExtensionEntity, "SpaceExtensionEntity") END,
        "Configuration" = CASE WHEN p_Configuration_Clear = TRUE THEN NULL ELSE COALESCE(p_Configuration, "Configuration") END,
        "TargetApplicationID" = CASE WHEN p_TargetApplicationID_Clear = TRUE THEN NULL ELSE COALESCE(p_TargetApplicationID, "TargetApplicationID") END,
        "__mj_UpdatedAt" = NOW()
    WHERE
        "ID" = p_ID;

    GET DIAGNOSTICS _v_row_count = ROW_COUNT;

    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT * FROM __mj_BizAppsCollaboration."vwSpaceTypes" WHERE 1=0;
    ELSE
        RETURN QUERY SELECT * FROM __mj_BizAppsCollaboration."vwSpaceTypes" WHERE "ID" = p_ID;
    END IF;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname = 'spDeleteSpaceType'
             AND pronamespace = '__mj_BizAppsCollaboration'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION __mj_BizAppsCollaboration."spDeleteSpaceType"(
    IN p_ID UUID
)
RETURNS TABLE("_result_id" UUID) AS
$$
DECLARE
    _v_row_count INTEGER;
BEGIN
DELETE FROM
        __mj_BizAppsCollaboration."SpaceType"
    WHERE
        "ID" = p_ID;

    GET DIAGNOSTICS _v_row_count = ROW_COUNT;

    IF _v_row_count = 0 THEN
        RETURN QUERY SELECT NULL::UUID AS "_result_id";
    ELSE
        RETURN QUERY SELECT p_ID::UUID AS "_result_id";
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ===================== Triggers =====================

CREATE OR REPLACE FUNCTION __mj_BizAppsCollaboration."trgUpdateSpaceType_func"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."__mj_UpdatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trgUpdateSpaceType" ON __mj_BizAppsCollaboration."SpaceType";
CREATE TRIGGER "trgUpdateSpaceType"
    BEFORE UPDATE ON __mj_BizAppsCollaboration."SpaceType"
    FOR EACH ROW
    EXECUTE FUNCTION __mj_BizAppsCollaboration."trgUpdateSpaceType_func"();


-- ===================== Data (INSERT/UPDATE/DELETE) =====================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '0c007c4f-3020-465b-a756-05565fbbadc0' OR ("EntityID" = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND "Name" = 'TargetApplicationID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '0c007c4f-3020-465b-a756-05565fbbadc0',
        '01596359-EC4B-449C-BA16-316DE4B92A4E', -- "Entity": "MJ_BizApps_Collaboration": "Space" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
        'TargetApplicationID',
        'Target Application ID',
        'Optional target MJ Application ID that invited users land in for spaces of this type. NULL defaults to the Collaboration application.',
        'UUID',
        16,
        0,
        0,
        TRUE,
        NULL,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        'E8238F34-2837-EF11-86D4-6045BDEE16E6',
        'ID',
        FALSE,
        FALSE,
        TRUE,
        FALSE,
        FALSE,
        FALSE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityRelationship" WHERE "ID" = '3512c5f3-7060-4de8-b3b7-96af9fe0ec70' OR ("EntityID" = 'E8238F34-2837-EF11-86D4-6045BDEE16E6' AND "RelatedEntityID" = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND "RelatedEntityJoinField" = 'TargetApplicationID')
    ) THEN
        INSERT INTO ${mjSchema}."EntityRelationship" ("ID", "EntityID", "RelatedEntityID", "RelatedEntityJoinField", "Type", "BundleInAPI", "DisplayInForm", "Sequence", "__mj_CreatedAt", "__mj_UpdatedAt")
        VALUES ('3512c5f3-7060-4de8-b3b7-96af9fe0ec70', 'E8238F34-2837-EF11-86D4-6045BDEE16E6', '01596359-EC4B-449C-BA16-316DE4B92A4E', 'TargetApplicationID', 'One To Many', TRUE, TRUE, 11, NOW(), NOW());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ${mjSchema}."EntityField" WHERE "ID" = '4c942575-a258-4817-9277-83ee6e446590' OR ("EntityID" = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND "Name" = 'TargetApplication')
    ) THEN
        INSERT INTO ${mjSchema}."EntityField"
        (
        "ID",
        "EntityID",
        "Sequence",
        "Name",
        "DisplayName",
        "Description",
        "Type",
        "Length",
        "Precision",
        "Scale",
        "AllowsNull",
        "DefaultValue",
        "AutoIncrement",
        "AllowUpdateAPI",
        "IsVirtual",
        "IsComputed",
        "RelatedEntityID",
        "RelatedEntityFieldName",
        "IsNameField",
        "IncludeInUserSearchAPI",
        "IncludeRelatedEntityNameFieldInBaseView",
        "DefaultInView",
        "IsPrimaryKey",
        "IsUnique",
        "RelatedEntityDisplayType",
        "__mj_CreatedAt",
        "__mj_UpdatedAt"
        )
        VALUES
        (
        '4c942575-a258-4817-9277-83ee6e446590',
        '01596359-EC4B-449C-BA16-316DE4B92A4E', -- "Entity": "MJ_BizApps_Collaboration": "Space" "Types"
        (SELECT COALESCE(MAX("Sequence"), 0) + 1 FROM ${mjSchema}."EntityField" WHERE "EntityID" = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
        'TargetApplication',
        'Target Application',
        NULL,
        'nvarchar',
        200,
        0,
        0,
        TRUE,
        NULL,
        FALSE,
        FALSE,
        TRUE,
        FALSE,
        NULL,
        NULL,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        'Search',
        NOW(),
        NOW()
        );
    END IF;
END $$;


-- ===================== FK & CHECK Constraints =====================


-- Flush any pending deferred trigger events from prior DML so DDL below can proceed.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE __mj_BizAppsCollaboration."SpaceType"
 ADD CONSTRAINT "FK_SpaceType_TargetApplication"
    FOREIGN KEY ("TargetApplicationID") REFERENCES ${mjSchema}."Application" ("ID")
    ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;


-- ===================== Grants =====================

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsCollaboration."vwSpaceTypes" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsCollaboration."vwSpaceTypes" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsCollaboration."vwSpaceTypes" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsCollaboration."vwSpaceTypes" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: Permissions for vwSpaceTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsCollaboration."vwSpaceTypes" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsCollaboration."vwSpaceTypes" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE SELECT ON __mj_BizAppsCollaboration."vwSpaceTypes" FROM "cdp_UI"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON __mj_BizAppsCollaboration."vwSpaceTypes" TO "cdp_UI", "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: spCreateSpaceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceType
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spCreateSpaceType" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spCreateSpaceType" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spCreateSpaceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spCreate Permissions for MJ_BizApps_Collaboration: Space Types */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spCreateSpaceType" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spCreateSpaceType" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spCreateSpaceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spUpdate SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: spUpdateSpaceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceType
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spUpdateSpaceType" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spUpdateSpaceType" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spUpdateSpaceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spUpdateSpaceType" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spUpdateSpaceType" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spUpdateSpaceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: spDeleteSpaceType
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceType
------------------------------------------------------------;

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spDeleteSpaceType" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spDeleteSpaceType" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spDeleteSpaceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* spDelete Permissions for MJ_BizApps_Collaboration: Space Types */

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spDeleteSpaceType" FROM "cdp_Developer"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spDeleteSpaceType" FROM "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION __mj_BizAppsCollaboration."spDeleteSpaceType" TO "cdp_Developer", "cdp_Integration"; EXCEPTION WHEN others THEN NULL; END $$;
/* SQL text to insert 1 new entity field(s) */


-- ===================== Comments =====================

COMMENT ON COLUMN __mj_BizAppsCollaboration."SpaceType"."TargetApplicationID" IS 'Optional target MJ Application ID that invited users land in for spaces of this type. NULL defaults to the Collaboration application.';


-- ===================== Other =====================

-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* SQL text to update existing entities from schema */

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Types */
