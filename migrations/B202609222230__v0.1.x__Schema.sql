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

-- Prefix here MUST match mj.config.cjs NameRulesBySchema once that file exists.
-- The trailing space after the colon is part of the prefix.
IF NOT EXISTS (SELECT 1 FROM __mj.SchemaInfo WHERE SchemaName = '__mj_BizAppsCollaboration')
INSERT INTO __mj.SchemaInfo
(
  ID,
  SchemaName,
  EntityIDMin, EntityIDMax,
  Comments,
  Description,
  EntityNamePrefix, EntityNameSuffix
)
VALUES
(
  'f7b56b24-8ea7-46e2-9ede-1b9fee78f6c3',
  '__mj_BizAppsCollaboration',
  10100001, 10199999,
  NULL,
  'MemberJunction: BizApps Collaboration — Spaces, the permission and retrieval boundary',
  'MJ_BizApps_Collaboration: ', NULL
);
GO
