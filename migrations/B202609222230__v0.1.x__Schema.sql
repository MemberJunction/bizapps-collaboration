-- =============================================================================
--  BizApps Collaboration — schema creation and CodeGen schema registration.
--
--  Own transaction (skyway wraps each file). The sibling V file is the table
--  set. This row is what CodeGen reads for entity name prefixes and must not
--  be regenerated away.
--
--  Entity IDs sit in a dedicated band so this app does not share 1–1000000
--  with other BizApps installed in the same database.
--
--  Spec: plans/plan.md §4
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '__mj_BizAppsCollaboration')
    EXEC('CREATE SCHEMA __mj_BizAppsCollaboration');
GO

-- SchemaInfo lives in metadata/schema-info, matched by SchemaName.
-- CodeGen creates a row with its own id when the row is missing, so this
-- file does not insert one.
