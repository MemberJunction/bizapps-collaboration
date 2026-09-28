-- =============================================================================
-- Migration: V202609280100__v0.1.x__One_Room_Per_Space_Unique_Index.sql
-- Enforces one Room per space in SpaceChat via filtered unique index.
-- =============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = N'UQ_SpaceChat_SpaceID_Room' 
      AND object_id = OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceChat]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_SpaceChat_SpaceID_Room]
    ON [${flyway:defaultSchema}].[SpaceChat]([SpaceID])
    WHERE [Kind] = 'Room';
END
GO
