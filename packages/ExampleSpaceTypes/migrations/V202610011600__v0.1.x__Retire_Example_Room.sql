-- =============================================================================
-- Migration: V202610011600__v0.1.x__Retire_Example_Room.sql
-- Schema: ${flyway:defaultSchema}  (__mj_BizAppsCollabExamples)
--
-- Retires the example deal room. Call 16 of the plan: a deal room is not one of the space types Collaboration offers
-- out of the box, so the example goes rather than being reshaped. example-board stays, and is the one example subtype.
--
-- Drops ExampleRoom, the IsA child of Space that V202609290300 created, with its view, procedures and trigger, and
-- removes the entity CodeGen registered for it, with every row that hangs on that entity (the list MJ's own
-- spDeleteEntityWithCoreDependencies uses, for the tables an entity of this shape can have rows in).
--
-- Run with:  pnpm run mj:migrate:examples   (mj migrate --schema __mj_BizAppsCollabExamples --dir packages/ExampleSpaceTypes/migrations)
--
-- The example-room Space Type row is test metadata (metadata-tests/space-types/), removed by its deleteRecord tombstone on
-- the next `pnpm run mj:push:tests`. A space of that type would hold a row here: no test world has one, and this
-- migration stops rather than run over one.
-- =============================================================================

-- 1. Nothing may still specialise a space as a room
IF OBJECT_ID(N'${flyway:defaultSchema}.ExampleRoom', N'U') IS NOT NULL
BEGIN
    DECLARE @rooms INT;
    EXEC sp_executesql N'SELECT @n = COUNT(*) FROM [${flyway:defaultSchema}].[ExampleRoom]', N'@n INT OUTPUT', @n = @rooms OUTPUT;
    IF @rooms > 0
        THROW 50000, N'ExampleRoom still has rows: remove the spaces of the example-room type before retiring it.', 1;
END;
GO

-- 2. The room's database objects, in dependency order
DROP TRIGGER IF EXISTS [${flyway:defaultSchema}].[trgUpdateExampleRoom];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spCreateExampleRoom];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spUpdateExampleRoom];
DROP PROCEDURE IF EXISTS [${flyway:defaultSchema}].[spDeleteExampleRoom];
DROP VIEW IF EXISTS [${flyway:defaultSchema}].[vwExampleRooms];
DROP TABLE IF EXISTS [${flyway:defaultSchema}].[ExampleRoom];
GO

-- 3. The entity MJ knew it by, and everything that hangs on it
DECLARE @EntityID UNIQUEIDENTIFIER = 'C03A093E-6205-4392-8402-2D0C4D867AB5'; -- MJ_BizApps_Collaboration_Examples: Example Rooms
DELETE FROM [${mjSchema}].[EntityFieldValue] WHERE [EntityFieldID] IN (SELECT [ID] FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @EntityID);
DELETE FROM [${mjSchema}].[EntitySetting] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[EntityField] WHERE [EntityID] = @EntityID OR [RelatedEntityID] = @EntityID;
DELETE FROM [${mjSchema}].[EntityPermission] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[EntityRelationship] WHERE [EntityID] = @EntityID OR [RelatedEntityID] = @EntityID;
DELETE FROM [${mjSchema}].[UserApplicationEntity] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[ApplicationEntity] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[RecordChange] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[AuditLog] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[UserViewCategory] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[UserView] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[EntityDocument] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[DatasetItem] WHERE [EntityID] = @EntityID;
DELETE FROM [${mjSchema}].[Entity] WHERE [ID] = @EntityID;
GO
