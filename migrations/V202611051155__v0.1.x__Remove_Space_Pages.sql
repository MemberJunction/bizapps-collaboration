-- ============================================================================
-- BizApps Collaboration: remove Space Pages
--
-- The page editor that used this table is not in the approved UI
-- (docs/ux/IMPLEMENTATION_PLAN.md), so its back end goes too. The table's
-- procedures and view go first, then the table, which takes its trigger,
-- indexes, constraints and extended properties with it. CodeGen then sees the
-- base table is gone and prunes the entity's metadata through
-- spDeleteEntityWithCoreDependencies (the CodeGen output below).
-- ============================================================================

DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spDeleteSpacePage];
GO

DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spUpdateSpacePage];
GO

DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spCreateSpacePage];
GO

DROP VIEW IF EXISTS [${flyway:defaultSchema}].[vwSpacePages];
GO

DROP TABLE IF EXISTS [${flyway:defaultSchema}].[SpacePage];
GO

/**************************************************************************************************
 * CODEGEN OUTPUT
 **************************************************************************************************/
/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to remove entity MJ_BizApps_Collaboration: Space Pages */
EXEC [${mjSchema}].[spDeleteEntityWithCoreDependencies] @EntityID='EFE52365-941E-4A5A-B6E3-6733013EC9E3';

/* SQL text to remove view ${flyway:defaultSchema}.vwSpacePages */
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpacePages]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpacePages];

/* SQL text to remove procedure ${flyway:defaultSchema}.spCreateSpacePage */
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpacePage]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpacePage];

/* SQL text to remove procedure ${flyway:defaultSchema}.spDeleteSpacePage */
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpacePage]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpacePage];

/* SQL text to remove procedure ${flyway:defaultSchema}.spUpdateSpacePage */
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpacePage]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpacePage];
