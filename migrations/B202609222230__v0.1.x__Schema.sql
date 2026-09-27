-- =============================================================================
--  BizApps Collaboration — create the schema.
--
--  Own transaction (skyway wraps each file). The sibling V file is the table
--  set. SchemaInfo, including the name prefix and the entity id band, lives
--  in metadata/schema-info and is applied with mj sync push.
--
--  Spec: plans/plan.md §4
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '__mj_BizAppsCollaboration')
    EXEC('CREATE SCHEMA __mj_BizAppsCollaboration');
GO

-- SchemaInfo lives in metadata/schema-info, matched by SchemaName.
-- CodeGen creates a row with its own id when the row is missing, so this
-- file does not insert one.
