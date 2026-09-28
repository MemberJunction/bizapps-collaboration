-- =============================================================================
-- Migration: V202609280200__v0.1.x__Retire_Room_Kind.sql
-- Retires 'Room' kind: turns any Room row into General, drops filtered unique
-- index, and narrows SpaceChat.Kind CHECK constraint to ('General', 'Private', 'Topic').
-- =============================================================================

-- 1. Drop filtered unique index if present
IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = N'UQ_SpaceChat_SpaceID_Room' 
      AND object_id = OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceChat]')
)
BEGIN
    DROP INDEX [UQ_SpaceChat_SpaceID_Room] ON [${flyway:defaultSchema}].[SpaceChat];
END
GO

-- 2. Turn existing Room rows into General
UPDATE [${flyway:defaultSchema}].[SpaceChat]
SET [Kind] = 'General'
WHERE [Kind] = 'Room';
GO

-- 3. Drop existing CHECK constraint and replace with narrowed CHECK constraint
IF EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE name = N'CK_SpaceChat_Kind'
      AND parent_object_id = OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceChat]')
)
BEGIN
    ALTER TABLE [${flyway:defaultSchema}].[SpaceChat]
    DROP CONSTRAINT [CK_SpaceChat_Kind];
END
GO

ALTER TABLE [${flyway:defaultSchema}].[SpaceChat]
ADD CONSTRAINT [CK_SpaceChat_Kind] CHECK ([Kind] IN ('General', 'Private', 'Topic'));
GO

-- 4. Clean up EntityFieldValue entry for 'Room'
DELETE FROM [__mj].[EntityFieldValue]
WHERE [ID] = 'A140F5A8-9A5C-4459-B7A1-2602F3A2CA11'
   OR ([EntityFieldID] = 'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C' AND [Value] = 'Room');
GO
