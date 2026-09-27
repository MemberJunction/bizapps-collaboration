-- =============================================================================
-- Migration: V202609262200__v0.1.x__Extensibility_Schema_And_Tables.sql
--
-- Adds:
-- 1. SpaceType extensibility columns:
--    - ServerDriverClass, UIDriverClass, SpaceExtensionEntity, Configuration,
--      DefaultInheritsMembership, PostCloseAccess, PostCloseAccessDays
-- 2. Space extensibility columns:
--    - Configuration, AnchorEntityID, AnchorRecordID, PostCloseAccess, PostCloseAccessDays
-- 3. SpaceMember sync and person columns:
--    - SyncSource, PersonID
-- 4. New tables:
--    - SpaceChat
--    - SpaceAgent
--    - SpaceAgentSkill
--    - SpaceKnowledgeSource
-- 5. Updated fnCollaborationAccess (post-close access rules) and fnCollaborationCommonAccess
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SpaceType columns
-- -----------------------------------------------------------------------------
IF COL_LENGTH('${flyway:defaultSchema}.SpaceType', 'ServerDriverClass') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType]
        ADD [ServerDriverClass] NVARCHAR(255) NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.SpaceType', 'UIDriverClass') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType]
        ADD [UIDriverClass] NVARCHAR(255) NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.SpaceType', 'SpaceExtensionEntity') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType]
        ADD [SpaceExtensionEntity] NVARCHAR(255) NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.SpaceType', 'Configuration') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType]
        ADD [Configuration] NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.SpaceType', 'DefaultInheritsMembership') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType]
        ADD [DefaultInheritsMembership] BIT NOT NULL CONSTRAINT DF_SpaceType_DefaultInheritsMembership DEFAULT 1;
GO

IF COL_LENGTH('${flyway:defaultSchema}.SpaceType', 'PostCloseAccess') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType]
        ADD [PostCloseAccess] NVARCHAR(20) NOT NULL CONSTRAINT DF_SpaceType_PostCloseAccess DEFAULT 'None';
GO

IF COL_LENGTH('${flyway:defaultSchema}.SpaceType', 'PostCloseAccessDays') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType]
        ADD [PostCloseAccessDays] INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_SpaceType_PostCloseAccess')
    ALTER TABLE [${flyway:defaultSchema}].[SpaceType]
        ADD CONSTRAINT CK_SpaceType_PostCloseAccess CHECK ([PostCloseAccess] IN ('None', 'ReadOnly', 'ReadOnlyWithAgent'));
GO

-- -----------------------------------------------------------------------------
-- 2. Space columns
-- -----------------------------------------------------------------------------
IF COL_LENGTH('${flyway:defaultSchema}.Space', 'Configuration') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[Space]
        ADD [Configuration] NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.Space', 'AnchorEntityID') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[Space]
        ADD [AnchorEntityID] UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.Space', 'AnchorRecordID') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[Space]
        ADD [AnchorRecordID] NVARCHAR(450) NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.Space', 'PostCloseAccess') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[Space]
        ADD [PostCloseAccess] NVARCHAR(20) NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.Space', 'PostCloseAccessDays') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[Space]
        ADD [PostCloseAccessDays] INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Space_PostCloseAccess')
    ALTER TABLE [${flyway:defaultSchema}].[Space]
        ADD CONSTRAINT CK_Space_PostCloseAccess CHECK ([PostCloseAccess] IS NULL OR [PostCloseAccess] IN ('None', 'ReadOnly', 'ReadOnlyWithAgent'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Space_AnchorEntity')
    ALTER TABLE [${flyway:defaultSchema}].[Space]
        ADD CONSTRAINT FK_Space_AnchorEntity FOREIGN KEY ([AnchorEntityID]) REFERENCES [__mj].[Entity]([ID]);
GO

-- -----------------------------------------------------------------------------
-- 3. SpaceMember columns
-- -----------------------------------------------------------------------------
IF COL_LENGTH('${flyway:defaultSchema}.SpaceMember', 'SyncSource') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceMember]
        ADD [SyncSource] NVARCHAR(100) NULL;
GO

IF COL_LENGTH('${flyway:defaultSchema}.SpaceMember', 'PersonID') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceMember]
        ADD [PersonID] UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_SpaceMember_Person')
    ALTER TABLE [${flyway:defaultSchema}].[SpaceMember]
        ADD CONSTRAINT FK_SpaceMember_Person FOREIGN KEY ([PersonID]) REFERENCES [__mj_BizAppsCommon].[Person]([ID]);
GO

-- -----------------------------------------------------------------------------
-- 4. New tables: SpaceChat, SpaceAgent, SpaceAgentSkill, SpaceKnowledgeSource
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceChat]', N'U') IS NULL
BEGIN
    CREATE TABLE [${flyway:defaultSchema}].[SpaceChat] (
        [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SpaceChat PRIMARY KEY DEFAULT NEWID(),
        [SpaceID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SpaceChat_Space FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[Space]([ID]),
        [ConversationID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SpaceChat_Conversation FOREIGN KEY REFERENCES [__mj].[Conversation]([ID]),
        [Name] NVARCHAR(255) NOT NULL,
        [Subject] NVARCHAR(500) NULL,
        [Kind] NVARCHAR(50) NOT NULL CONSTRAINT DF_SpaceChat_Kind DEFAULT 'General',
        [Status] NVARCHAR(50) NOT NULL CONSTRAINT DF_SpaceChat_Status DEFAULT 'Active',
        [__mj_CreatedAt] DATETIMEOFFSET NOT NULL CONSTRAINT DF_SpaceChat___mj_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL CONSTRAINT DF_SpaceChat___mj_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT CK_SpaceChat_Kind CHECK ([Kind] IN ('General', 'Private', 'Room', 'Topic')),
        CONSTRAINT CK_SpaceChat_Status CHECK ([Status] IN ('Active', 'Archived'))
    );
END
GO

IF OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceAgent]', N'U') IS NULL
BEGIN
    CREATE TABLE [${flyway:defaultSchema}].[SpaceAgent] (
        [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SpaceAgent PRIMARY KEY DEFAULT NEWID(),
        [AgentID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SpaceAgent_Agent FOREIGN KEY REFERENCES [__mj].[AIAgent]([ID]),
        [SpaceTypeID] UNIQUEIDENTIFIER NULL CONSTRAINT FK_SpaceAgent_SpaceType FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[SpaceType]([ID]),
        [SpaceID] UNIQUEIDENTIFIER NULL CONSTRAINT FK_SpaceAgent_Space FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[Space]([ID]),
        [IsDefault] BIT NOT NULL CONSTRAINT DF_SpaceAgent_IsDefault DEFAULT 0,
        [__mj_CreatedAt] DATETIMEOFFSET NOT NULL CONSTRAINT DF_SpaceAgent___mj_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL CONSTRAINT DF_SpaceAgent___mj_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT CK_SpaceAgent_Scope CHECK (NOT ([SpaceTypeID] IS NOT NULL AND [SpaceID] IS NOT NULL))
    );
END
GO

IF OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceAgentSkill]', N'U') IS NULL
BEGIN
    CREATE TABLE [${flyway:defaultSchema}].[SpaceAgentSkill] (
        [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SpaceAgentSkill PRIMARY KEY DEFAULT NEWID(),
        [SkillID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SpaceAgentSkill_Skill FOREIGN KEY REFERENCES [__mj].[AISkill]([ID]),
        [SpaceTypeID] UNIQUEIDENTIFIER NULL CONSTRAINT FK_SpaceAgentSkill_SpaceType FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[SpaceType]([ID]),
        [SpaceID] UNIQUEIDENTIFIER NULL CONSTRAINT FK_SpaceAgentSkill_Space FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[Space]([ID]),
        [__mj_CreatedAt] DATETIMEOFFSET NOT NULL CONSTRAINT DF_SpaceAgentSkill___mj_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL CONSTRAINT DF_SpaceAgentSkill___mj_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT CK_SpaceAgentSkill_Scope CHECK (NOT ([SpaceTypeID] IS NOT NULL AND [SpaceID] IS NOT NULL))
    );
END
GO

IF OBJECT_ID(N'[${flyway:defaultSchema}].[SpaceKnowledgeSource]', N'U') IS NULL
BEGIN
    CREATE TABLE [${flyway:defaultSchema}].[SpaceKnowledgeSource] (
        [ID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_SpaceKnowledgeSource PRIMARY KEY DEFAULT NEWID(),
        [ContentSourceID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_SpaceKnowledgeSource_ContentSource FOREIGN KEY REFERENCES [__mj].[ContentSource]([ID]),
        [SpaceTypeID] UNIQUEIDENTIFIER NULL CONSTRAINT FK_SpaceKnowledgeSource_SpaceType FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[SpaceType]([ID]),
        [SpaceID] UNIQUEIDENTIFIER NULL CONSTRAINT FK_SpaceKnowledgeSource_Space FOREIGN KEY REFERENCES [${flyway:defaultSchema}].[Space]([ID]),
        [__mj_CreatedAt] DATETIMEOFFSET NOT NULL CONSTRAINT DF_SpaceKnowledgeSource___mj_CreatedAt DEFAULT SYSDATETIMEOFFSET(),
        [__mj_UpdatedAt] DATETIMEOFFSET NOT NULL CONSTRAINT DF_SpaceKnowledgeSource___mj_UpdatedAt DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT CK_SpaceKnowledgeSource_Scope CHECK (NOT ([SpaceTypeID] IS NOT NULL AND [SpaceID] IS NOT NULL))
    );
END
GO

-- -----------------------------------------------------------------------------
-- 5. Updated fnCollaborationAccess & new fnCollaborationCommonAccess
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationAccess];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationAccess](@UserID UNIQUEIDENTIFIER)
RETURNS @Access TABLE (
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL,
    CanInvite BIT NOT NULL,
    CanContribute BIT NOT NULL
)
AS
BEGIN
    ;WITH Direct AS (
        SELECT m.SpaceID,
               CAST(r.CanSeeTeamBand AS INT) AS CanSeeTeam,
               CAST(r.CanInvite AS INT) AS CanInvite,
               CAST(r.CanContribute AS INT) AS CanContribute,
               0 AS Steps,
               CAST(CONVERT(varchar(36), m.SpaceID) AS varchar(max)) AS Path,
               s.ClosedAt,
               COALESCE(s.PostCloseAccess, st.PostCloseAccess, N'None') AS PostCloseAccess,
               COALESCE(s.PostCloseAccessDays, st.PostCloseAccessDays) AS PostCloseAccessDays
        FROM [${flyway:defaultSchema}].[SpaceMember] AS m
        INNER JOIN [${flyway:defaultSchema}].[Space] AS s ON s.ID = m.SpaceID
        INNER JOIN [${flyway:defaultSchema}].[SpaceType] AS st ON st.ID = s.SpaceTypeID
        INNER JOIN [${flyway:defaultSchema}].[SpaceRoleType] AS r ON r.ID = m.SpaceRoleTypeID
        WHERE m.UserID = @UserID
          AND m.Status = N'Active'
          AND (
              s.ClosedAt IS NULL
              OR (
                  COALESCE(s.PostCloseAccess, st.PostCloseAccess, N'None') IN (N'ReadOnly', N'ReadOnlyWithAgent')
                  AND (
                      COALESCE(s.PostCloseAccessDays, st.PostCloseAccessDays) IS NULL
                      OR DATEDIFF(day, s.ClosedAt, GETUTCDATE()) <= COALESCE(s.PostCloseAccessDays, st.PostCloseAccessDays)
                  )
              )
          )
    ),
    Reachable AS (
        SELECT SpaceID,
               CanSeeTeam,
               CASE WHEN ClosedAt IS NOT NULL THEN 0 ELSE CanInvite END AS CanInvite,
               CASE WHEN ClosedAt IS NOT NULL THEN 0 ELSE CanContribute END AS CanContribute,
               Steps,
               Path
        FROM Direct

        UNION ALL

        SELECT child.ID,
               parent.CanSeeTeam,
               CASE WHEN child.ClosedAt IS NOT NULL THEN 0 ELSE parent.CanInvite END,
               CASE WHEN child.ClosedAt IS NOT NULL THEN 0 ELSE parent.CanContribute END,
               parent.Steps + 1,
               parent.Path + '/' + CONVERT(varchar(36), child.ID)
        FROM [${flyway:defaultSchema}].[Space] AS child
        INNER JOIN [${flyway:defaultSchema}].[SpaceType] AS cst ON cst.ID = child.SpaceTypeID
        INNER JOIN Reachable AS parent ON child.ParentID = parent.SpaceID
        WHERE child.InheritsMembership = 1
          AND parent.Steps < 32
          AND parent.Path NOT LIKE '%' + CONVERT(varchar(36), child.ID) + '%'
          AND (
              child.ClosedAt IS NULL
              OR (
                  COALESCE(child.PostCloseAccess, cst.PostCloseAccess, N'None') IN (N'ReadOnly', N'ReadOnlyWithAgent')
                  AND (
                      COALESCE(child.PostCloseAccessDays, cst.PostCloseAccessDays) IS NULL
                      OR DATEDIFF(day, child.ClosedAt, GETUTCDATE()) <= COALESCE(child.PostCloseAccessDays, cst.PostCloseAccessDays)
                  )
              )
          )
    )
    INSERT INTO @Access (SpaceID, CanSeeTeam, CanInvite, CanContribute)
    SELECT SpaceID, CAST(CanSeeTeam AS BIT), CAST(CanInvite AS BIT), CAST(CanContribute AS BIT)
    FROM (
        SELECT SpaceID, CanSeeTeam, CanInvite, CanContribute,
               ROW_NUMBER() OVER (PARTITION BY SpaceID ORDER BY Steps) AS rn
        FROM Reachable
    ) AS ranked
    WHERE rn = 1
    OPTION (MAXRECURSION 32);

    RETURN;
END;
GO

DROP FUNCTION IF EXISTS [${flyway:defaultSchema}].[fnCollaborationCommonAccess];
GO

CREATE FUNCTION [${flyway:defaultSchema}].[fnCollaborationCommonAccess](@UserIDs NVARCHAR(MAX))
RETURNS @Common TABLE (
    SpaceID UNIQUEIDENTIFIER NOT NULL,
    CanSeeTeam BIT NOT NULL
)
AS
BEGIN
    DECLARE @UserCount INT;

    ;WITH ParsedUsers AS (
        SELECT DISTINCT TRY_CAST(LTRIM(RTRIM(value)) AS UNIQUEIDENTIFIER) AS UserID
        FROM STRING_SPLIT(@UserIDs, ',')
        WHERE TRY_CAST(LTRIM(RTRIM(value)) AS UNIQUEIDENTIFIER) IS NOT NULL
    )
    SELECT @UserCount = COUNT(*) FROM ParsedUsers;

    IF @UserCount = 0
        RETURN;

    ;WITH UserAccess AS (
        SELECT u.UserID, a.SpaceID, a.CanSeeTeam
        FROM (
            SELECT DISTINCT TRY_CAST(LTRIM(RTRIM(value)) AS UNIQUEIDENTIFIER) AS UserID
            FROM STRING_SPLIT(@UserIDs, ',')
            WHERE TRY_CAST(LTRIM(RTRIM(value)) AS UNIQUEIDENTIFIER) IS NOT NULL
        ) AS u
        CROSS APPLY [${flyway:defaultSchema}].[fnCollaborationAccess](u.UserID) AS a
    )
    INSERT INTO @Common (SpaceID, CanSeeTeam)
    SELECT SpaceID,
           CASE WHEN MIN(CAST(CanSeeTeam AS INT)) = 1 THEN 1 ELSE 0 END AS CanSeeTeam
    FROM UserAccess
    GROUP BY SpaceID
    HAVING COUNT(DISTINCT UserID) = @UserCount;

    RETURN;
END;
GO




















































-- =============================================================================
-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND
-- =============================================================================

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Chats */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '75e3ed25-c46b-45c1-96f7-91578d88dbe2',
         'MJ_BizApps_Collaboration: Space Chats',
         'Space Chats',
         NULL,
         NULL,
         'SpaceChat',
         'vwSpaceChats',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Chats to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '75e3ed25-c46b-45c1-96f7-91578d88dbe2', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Chats for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('75e3ed25-c46b-45c1-96f7-91578d88dbe2' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('75e3ed25-c46b-45c1-96f7-91578d88dbe2' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Chats for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('75e3ed25-c46b-45c1-96f7-91578d88dbe2' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('75e3ed25-c46b-45c1-96f7-91578d88dbe2' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Chats for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('75e3ed25-c46b-45c1-96f7-91578d88dbe2' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('75e3ed25-c46b-45c1-96f7-91578d88dbe2' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Agent Skills */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         'bde57e94-891d-4948-ab8d-3a7cbdcff4e3',
         'MJ_BizApps_Collaboration: Space Agent Skills',
         'Space Agent Skills',
         NULL,
         NULL,
         'SpaceAgentSkill',
         'vwSpaceAgentSkills',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Agent Skills to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', 'bde57e94-891d-4948-ab8d-3a7cbdcff4e3', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agent Skills for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('bde57e94-891d-4948-ab8d-3a7cbdcff4e3' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('bde57e94-891d-4948-ab8d-3a7cbdcff4e3' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agent Skills for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('bde57e94-891d-4948-ab8d-3a7cbdcff4e3' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('bde57e94-891d-4948-ab8d-3a7cbdcff4e3' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agent Skills for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('bde57e94-891d-4948-ab8d-3a7cbdcff4e3' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('bde57e94-891d-4948-ab8d-3a7cbdcff4e3' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Agents */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '56476128-c105-4118-a722-af72f81a7960',
         'MJ_BizApps_Collaboration: Space Agents',
         'Space Agents',
         NULL,
         NULL,
         'SpaceAgent',
         'vwSpaceAgents',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Agents to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '56476128-c105-4118-a722-af72f81a7960', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agents for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('56476128-c105-4118-a722-af72f81a7960' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('56476128-c105-4118-a722-af72f81a7960' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agents for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('56476128-c105-4118-a722-af72f81a7960' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('56476128-c105-4118-a722-af72f81a7960' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Agents for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('56476128-c105-4118-a722-af72f81a7960' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('56476128-c105-4118-a722-af72f81a7960' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to create new entity MJ_BizApps_Collaboration: Space Knowledge Sources */

      INSERT INTO [${mjSchema}].[Entity] (
         [ID],
         [Name],
         [DisplayName],
         [Description],
         [NameSuffix],
         [BaseTable],
         [BaseView],
         [SchemaName],
         [IncludeInAPI],
         [AllowUserSearchAPI],
         [AllowCaching]
         , [TrackRecordChanges]
         , [AuditRecordAccess]
         , [AuditViewRuns]
         , [AllowAllRowsAPI]
         , [AllowCreateAPI]
         , [AllowUpdateAPI]
         , [AllowDeleteAPI]
         , [UserViewMaxRows]
         , [__mj_CreatedAt]
         , [__mj_UpdatedAt]
      )
      VALUES (
         '157106bd-1938-4eef-8798-05baf047dfd2',
         'MJ_BizApps_Collaboration: Space Knowledge Sources',
         'Space Knowledge Sources',
         NULL,
         NULL,
         'SpaceKnowledgeSource',
         'vwSpaceKnowledgeSources',
         '${flyway:defaultSchema}',
         1,
         1,
         0
         , 1
         , 0
         , 0
         , 0
         , 1
         , 1
         , 1
         , 1000
         , GETUTCDATE()
         , GETUTCDATE()
      );

/* SQL generated to add new entity MJ_BizApps_Collaboration: Space Knowledge Sources to application ID: '94F5906B-38AB-4A9F-BFCA-3D395BBBC198' */
INSERT INTO [${mjSchema}].[ApplicationEntity]
                                       ([ApplicationID], [EntityID], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt]) VALUES
                                       ('94F5906B-38AB-4A9F-BFCA-3D395BBBC198', '157106bd-1938-4eef-8798-05baf047dfd2', (SELECT COALESCE(MAX([Sequence]),0)+1 FROM [${mjSchema}].[ApplicationEntity] WHERE [ApplicationID] = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198'), GETUTCDATE(), GETUTCDATE());

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Knowledge Sources for role UI */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('157106bd-1938-4eef-8798-05baf047dfd2' AS uniqueidentifier), CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 0, 0, 0, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('157106bd-1938-4eef-8798-05baf047dfd2' AS uniqueidentifier) AND [RoleID] = CAST('E0AFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Knowledge Sources for role Developer */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('157106bd-1938-4eef-8798-05baf047dfd2' AS uniqueidentifier), CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('157106bd-1938-4eef-8798-05baf047dfd2' AS uniqueidentifier) AND [RoleID] = CAST('DEAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL generated to add new permission for entity MJ_BizApps_Collaboration: Space Knowledge Sources for role Integration */
INSERT INTO [${mjSchema}].[EntityPermission]
                ([EntityID], [RoleID], [Type], [CanRead], [CanCreate], [CanUpdate], [CanDelete], [__mj_CreatedAt], [__mj_UpdatedAt])
              SELECT CAST('157106bd-1938-4eef-8798-05baf047dfd2' AS uniqueidentifier), CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier), 'Allow', 1, 1, 1, 1, GETUTCDATE(), GETUTCDATE()
              WHERE NOT EXISTS (
                SELECT 1 FROM [${mjSchema}].[EntityPermission]
                WHERE [EntityID] = CAST('157106bd-1938-4eef-8798-05baf047dfd2' AS uniqueidentifier) AND [RoleID] = CAST('DFAFCCEC-6A37-EF11-86D4-000D3A4E707E' AS uniqueidentifier) AND [Type] = 'Allow'
              );

/* SQL text to update existing entities from schema */
EXEC [${mjSchema}].[spUpdateExistingEntitiesFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to drop default existing default constraints in entity ${flyway:defaultSchema}.SpaceKnowledgeSource */
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = d.name
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE s.name = '${flyway:defaultSchema}'
AND t.name = 'SpaceKnowledgeSource'
AND c.name = '__mj_CreatedAt';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [${flyway:defaultSchema}].[SpaceKnowledgeSource] DROP CONSTRAINT ' + @constraintName);
END;
GO

/* SQL text to add default constraint for special date field __mj_CreatedAt in entity ${flyway:defaultSchema}.SpaceKnowledgeSource */
ALTER TABLE [${flyway:defaultSchema}].[SpaceKnowledgeSource] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceKnowledgeSource___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];

/* SQL text to drop default existing default constraints in entity ${flyway:defaultSchema}.SpaceKnowledgeSource */
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = d.name
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE s.name = '${flyway:defaultSchema}'
AND t.name = 'SpaceKnowledgeSource'
AND c.name = '__mj_UpdatedAt';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [${flyway:defaultSchema}].[SpaceKnowledgeSource] DROP CONSTRAINT ' + @constraintName);
END;
GO

/* SQL text to add default constraint for special date field __mj_UpdatedAt in entity ${flyway:defaultSchema}.SpaceKnowledgeSource */
ALTER TABLE [${flyway:defaultSchema}].[SpaceKnowledgeSource] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceKnowledgeSource___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];

/* SQL text to drop default existing default constraints in entity ${flyway:defaultSchema}.SpaceAgentSkill */
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = d.name
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE s.name = '${flyway:defaultSchema}'
AND t.name = 'SpaceAgentSkill'
AND c.name = '__mj_CreatedAt';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [${flyway:defaultSchema}].[SpaceAgentSkill] DROP CONSTRAINT ' + @constraintName);
END;
GO

/* SQL text to add default constraint for special date field __mj_CreatedAt in entity ${flyway:defaultSchema}.SpaceAgentSkill */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAgentSkill] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAgentSkill___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];

/* SQL text to drop default existing default constraints in entity ${flyway:defaultSchema}.SpaceAgentSkill */
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = d.name
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE s.name = '${flyway:defaultSchema}'
AND t.name = 'SpaceAgentSkill'
AND c.name = '__mj_UpdatedAt';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [${flyway:defaultSchema}].[SpaceAgentSkill] DROP CONSTRAINT ' + @constraintName);
END;
GO

/* SQL text to add default constraint for special date field __mj_UpdatedAt in entity ${flyway:defaultSchema}.SpaceAgentSkill */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAgentSkill] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAgentSkill___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];

/* SQL text to drop default existing default constraints in entity ${flyway:defaultSchema}.SpaceChat */
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = d.name
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE s.name = '${flyway:defaultSchema}'
AND t.name = 'SpaceChat'
AND c.name = '__mj_CreatedAt';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] DROP CONSTRAINT ' + @constraintName);
END;
GO

/* SQL text to add default constraint for special date field __mj_CreatedAt in entity ${flyway:defaultSchema}.SpaceChat */
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceChat___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];

/* SQL text to drop default existing default constraints in entity ${flyway:defaultSchema}.SpaceChat */
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = d.name
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE s.name = '${flyway:defaultSchema}'
AND t.name = 'SpaceChat'
AND c.name = '__mj_UpdatedAt';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] DROP CONSTRAINT ' + @constraintName);
END;
GO

/* SQL text to add default constraint for special date field __mj_UpdatedAt in entity ${flyway:defaultSchema}.SpaceChat */
ALTER TABLE [${flyway:defaultSchema}].[SpaceChat] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceChat___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];

/* SQL text to drop default existing default constraints in entity ${flyway:defaultSchema}.SpaceAgent */
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = d.name
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE s.name = '${flyway:defaultSchema}'
AND t.name = 'SpaceAgent'
AND c.name = '__mj_CreatedAt';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [${flyway:defaultSchema}].[SpaceAgent] DROP CONSTRAINT ' + @constraintName);
END;
GO

/* SQL text to add default constraint for special date field __mj_CreatedAt in entity ${flyway:defaultSchema}.SpaceAgent */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAgent] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAgent___mj_CreatedAt] DEFAULT GETUTCDATE() FOR [__mj_CreatedAt];

/* SQL text to drop default existing default constraints in entity ${flyway:defaultSchema}.SpaceAgent */
DECLARE @constraintName NVARCHAR(255);

SELECT @constraintName = d.name
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.default_constraints d ON c.default_object_id = d.object_id
WHERE s.name = '${flyway:defaultSchema}'
AND t.name = 'SpaceAgent'
AND c.name = '__mj_UpdatedAt';

IF @constraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE [${flyway:defaultSchema}].[SpaceAgent] DROP CONSTRAINT ' + @constraintName);
END;
GO

/* SQL text to add default constraint for special date field __mj_UpdatedAt in entity ${flyway:defaultSchema}.SpaceAgent */
ALTER TABLE [${flyway:defaultSchema}].[SpaceAgent] ADD CONSTRAINT [DF___mj_BizAppsCollaboration_SpaceAgent___mj_UpdatedAt] DEFAULT GETUTCDATE() FOR [__mj_UpdatedAt];

/* SQL text to insert 42 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fa72e9c4-4236-4fbe-951c-996c05e89026' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'fa72e9c4-4236-4fbe-951c-996c05e89026',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '22dcc888-2945-4d0a-b5b3-4710b692c859' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = 'ContentSourceID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '22dcc888-2945-4d0a-b5b3-4710b692c859',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            'ContentSourceID',
            'Content Source ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            'B420FF22-0E66-EF11-A752-C0A5E8ACCB22',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0d7c68c1-b1e0-4b3c-b3db-85a7384560fa' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = 'SpaceTypeID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '0d7c68c1-b1e0-4b3c-b3db-85a7384560fa',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            'SpaceTypeID',
            'Space Type ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            '01596359-EC4B-449C-BA16-316DE4B92A4E',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2b04f4a3-3b4a-4e7d-85e2-1c4f85ab50a1' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = 'SpaceID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '2b04f4a3-3b4a-4e7d-85e2-1c4f85ab50a1',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            'SpaceID',
            'Space ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5279b90f-8162-44f9-88c7-00f97021fc09' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '5279b90f-8162-44f9-88c7-00f97021fc09',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5a8f9ccb-0d9d-4cde-aaa2-010aac9a8231' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '5a8f9ccb-0d9d-4cde-aaa2-010aac9a8231',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ef99326c-0130-45da-8972-2ca490a19dac' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'ServerDriverClass')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'ef99326c-0130-45da-8972-2ca490a19dac',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'ServerDriverClass',
            'Server Driver Class',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'afb29e92-8a48-4004-96be-37510baf6fff' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'UIDriverClass')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'afb29e92-8a48-4004-96be-37510baf6fff',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'UIDriverClass',
            'UI Driver Class',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f83e6039-bd20-46b6-8e44-39e88afe84a0' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'SpaceExtensionEntity')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'f83e6039-bd20-46b6-8e44-39e88afe84a0',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'SpaceExtensionEntity',
            'Space Extension Entity',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e4c8fc04-6663-4a37-98ab-1f1279931bc0' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'Configuration')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'e4c8fc04-6663-4a37-98ab-1f1279931bc0',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'Configuration',
            'Configuration',
            NULL,
            'nvarchar',
            -1,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a586c6ec-7692-45cf-a265-347898b1bd20' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'DefaultInheritsMembership')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'a586c6ec-7692-45cf-a265-347898b1bd20',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'DefaultInheritsMembership',
            'Default Inherits Membership',
            NULL,
            'bit',
            1,
            1,
            0,
            0,
            '(1)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b8388a5c-5c32-47af-9cc4-7c9be70c1cce' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'PostCloseAccess')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b8388a5c-5c32-47af-9cc4-7c9be70c1cce',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'PostCloseAccess',
            'Post Close Access',
            NULL,
            'nvarchar',
            40,
            0,
            0,
            0,
            'None',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '0aea9243-7bbc-4d30-8c99-74773b679f1d' OR (EntityID = '01596359-EC4B-449C-BA16-316DE4B92A4E' AND Name = 'PostCloseAccessDays')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '0aea9243-7bbc-4d30-8c99-74773b679f1d',
            '01596359-EC4B-449C-BA16-316DE4B92A4E', -- Entity: MJ_BizApps_Collaboration: Space Types
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '01596359-EC4B-449C-BA16-316DE4B92A4E'),
            'PostCloseAccessDays',
            'Post Close Access Days',
            NULL,
            'int',
            4,
            10,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '089d97ec-046c-426b-b653-fbf808abefb7' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '089d97ec-046c-426b-b653-fbf808abefb7',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '989b5b18-fcc6-4b31-8159-b3325c078872' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = 'SkillID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '989b5b18-fcc6-4b31-8159-b3325c078872',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            'SkillID',
            'Skill ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            '1D52DE84-DD3F-4E46-8D2B-574B70080BB4',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6052d9c2-fc0d-42d8-aa83-551e436ce065' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = 'SpaceTypeID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6052d9c2-fc0d-42d8-aa83-551e436ce065',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            'SpaceTypeID',
            'Space Type ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            '01596359-EC4B-449C-BA16-316DE4B92A4E',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1041a156-dd55-4b06-8b04-df5477b3c5f3' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = 'SpaceID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1041a156-dd55-4b06-8b04-df5477b3c5f3',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            'SpaceID',
            'Space ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'fdff81e3-f6f8-452e-8864-fda8d2b833e7' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'fdff81e3-f6f8-452e-8864-fda8d2b833e7',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7fb0f57e-7237-4cc3-9743-1e9ff84bb02c' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '7fb0f57e-7237-4cc3-9743-1e9ff84bb02c',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '265475d6-4092-4555-9ab0-48584f98f3ba' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'Configuration')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '265475d6-4092-4555-9ab0-48584f98f3ba',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'Configuration',
            'Configuration',
            NULL,
            'nvarchar',
            -1,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f27d0c6f-650c-4b15-b564-7bc8fe1d4e72' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'AnchorEntityID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'f27d0c6f-650c-4b15-b564-7bc8fe1d4e72',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'AnchorEntityID',
            'Anchor Entity ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            'E0238F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'aff7302c-6841-4118-9ec1-c4ecccf471c8' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'AnchorRecordID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'aff7302c-6841-4118-9ec1-c4ecccf471c8',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'AnchorRecordID',
            'Anchor Record ID',
            NULL,
            'nvarchar',
            900,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b9b2c19a-0032-499f-ba4d-cdc3a0903627' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'PostCloseAccess')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b9b2c19a-0032-499f-ba4d-cdc3a0903627',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'PostCloseAccess',
            'Post Close Access',
            NULL,
            'nvarchar',
            40,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '4c0cbab9-cfec-4b51-bd0e-13e11a6a5583' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'PostCloseAccessDays')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '4c0cbab9-cfec-4b51-bd0e-13e11a6a5583',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'PostCloseAccessDays',
            'Post Close Access Days',
            NULL,
            'int',
            4,
            10,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '5c95e84f-eabd-4a47-b67d-3fd86979ec07' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '5c95e84f-eabd-4a47-b67d-3fd86979ec07',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6d59d0fc-a8b8-43cf-b410-b89ff83beabd' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'SpaceID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6d59d0fc-a8b8-43cf-b410-b89ff83beabd',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'SpaceID',
            'Space ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '06f163a0-715a-4648-bd10-e716bdb75b95' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'ConversationID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '06f163a0-715a-4648-bd10-e716bdb75b95',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'ConversationID',
            'Conversation ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            '13248F34-2837-EF11-86D4-6045BDEE16E6',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '6d622643-972e-42b6-a507-76abd15b38b4' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'Name')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '6d622643-972e-42b6-a507-76abd15b38b4',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'Name',
            'Name',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            1,
            1,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '46ee73df-2f73-4211-b1ee-240fb8032126' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'Subject')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '46ee73df-2f73-4211-b1ee-240fb8032126',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'Subject',
            'Subject',
            NULL,
            'nvarchar',
            1000,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'a4a7c50e-be15-4e6d-8415-6b7a2a981f8c' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'Kind')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'a4a7c50e-be15-4e6d-8415-6b7a2a981f8c',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'Kind',
            'Kind',
            NULL,
            'nvarchar',
            100,
            0,
            0,
            0,
            'General',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'd3ff7771-eeb6-46d1-a1cf-7d5977142ee1' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'Status')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'd3ff7771-eeb6-46d1-a1cf-7d5977142ee1',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'Status',
            'Status',
            NULL,
            'nvarchar',
            100,
            0,
            0,
            0,
            'Active',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b397a9d5-e541-4eba-ac9c-95e65580366f' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b397a9d5-e541-4eba-ac9c-95e65580366f',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '49744e6e-d2d1-47d4-ad96-1a0d4edcf97a' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '49744e6e-d2d1-47d4-ad96-1a0d4edcf97a',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '3df4014b-b51d-4187-93de-1521be61220e' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = 'ID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '3df4014b-b51d-4187-93de-1521be61220e',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            'ID',
            'ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            'newid()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            1,
            1,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c159ddd2-4af0-4f48-8439-ab1042ba9ab6' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = 'AgentID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'c159ddd2-4af0-4f48-8439-ab1042ba9ab6',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            'AgentID',
            'Agent ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            0,
            NULL,
            0,
            1,
            0,
            0,
            'CDB135CC-6D3C-480B-90AE-25B7805F82C1',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1003f072-725f-4807-be9a-1e862b2a987a' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = 'SpaceTypeID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1003f072-725f-4807-be9a-1e862b2a987a',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            'SpaceTypeID',
            'Space Type ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            '01596359-EC4B-449C-BA16-316DE4B92A4E',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b2326bb1-c37d-4c6d-9e52-163c05245bf7' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = 'SpaceID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b2326bb1-c37d-4c6d-9e52-163c05245bf7',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            'SpaceID',
            'Space ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'b5a2dbb7-a32d-4ab5-99a4-e1a048b955f3' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = 'IsDefault')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'b5a2dbb7-a32d-4ab5-99a4-e1a048b955f3',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            'IsDefault',
            'Is Default',
            NULL,
            'bit',
            1,
            1,
            0,
            0,
            '(0)',
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            1,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'f75ef549-1dac-4c73-987f-551e1450d8eb' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = '__mj_CreatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'f75ef549-1dac-4c73-987f-551e1450d8eb',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            '__mj_CreatedAt',
            'Created At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '49468886-9bd9-4b20-ac3f-326537615443' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = '__mj_UpdatedAt')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '49468886-9bd9-4b20-ac3f-326537615443',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            '__mj_UpdatedAt',
            'Updated At',
            NULL,
            'datetimeoffset',
            10,
            34,
            7,
            0,
            'getutcdate()',
            0,
            0,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '7b50fb27-82c2-4f86-b4b2-0a32915acf23' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'SyncSource')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '7b50fb27-82c2-4f86-b4b2-0a32915acf23',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'SyncSource',
            'Sync Source',
            NULL,
            'nvarchar',
            200,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1522bbfc-d0c2-4e5f-9c71-b2a3459a8a35' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'PersonID')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1522bbfc-d0c2-4e5f-9c71-b2a3459a8a35',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'PersonID',
            'Person ID',
            NULL,
            'uniqueidentifier',
            16,
            0,
            0,
            1,
            NULL,
            0,
            1,
            0,
            0,
            '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F',
            'ID',
            0,
            0,
            1,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* SQL text to update existing entity fields from schema */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert entity field value with ID e1d68634-457a-449e-b8a0-b7dd9b8713f8 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('e1d68634-457a-449e-b8a0-b7dd9b8713f8', 'B8388A5C-5C32-47AF-9CC4-7C9BE70C1CCE', 1, 'None', 'None', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID d90037d4-9980-44a6-b7fb-5dc1e95f8345 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('d90037d4-9980-44a6-b7fb-5dc1e95f8345', 'B8388A5C-5C32-47AF-9CC4-7C9BE70C1CCE', 2, 'ReadOnly', 'ReadOnly', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 9b8f6124-6859-4bcc-b33d-8b7477b48387 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('9b8f6124-6859-4bcc-b33d-8b7477b48387', 'B8388A5C-5C32-47AF-9CC4-7C9BE70C1CCE', 3, 'ReadOnlyWithAgent', 'ReadOnlyWithAgent', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID B8388A5C-5C32-47AF-9CC4-7C9BE70C1CCE */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='B8388A5C-5C32-47AF-9CC4-7C9BE70C1CCE';

/* SQL text to insert entity field value with ID 2939b65e-1507-40e7-92f9-63390a6076e3 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('2939b65e-1507-40e7-92f9-63390a6076e3', 'B9B2C19A-0032-499F-BA4D-CDC3A0903627', 1, 'None', 'None', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID f1a667e1-3abd-40d5-8122-a2149278dae5 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('f1a667e1-3abd-40d5-8122-a2149278dae5', 'B9B2C19A-0032-499F-BA4D-CDC3A0903627', 2, 'ReadOnly', 'ReadOnly', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 25529711-c6a6-45e8-84fd-919c68af6779 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('25529711-c6a6-45e8-84fd-919c68af6779', 'B9B2C19A-0032-499F-BA4D-CDC3A0903627', 3, 'ReadOnlyWithAgent', 'ReadOnlyWithAgent', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID B9B2C19A-0032-499F-BA4D-CDC3A0903627 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='B9B2C19A-0032-499F-BA4D-CDC3A0903627';

/* SQL text to insert entity field value with ID 34425842-e27b-4bc1-b6a7-8920d4ae03ba */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('34425842-e27b-4bc1-b6a7-8920d4ae03ba', 'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C', 1, 'General', 'General', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID 49d4845c-3432-48d8-8b53-760a7b468d7e */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('49d4845c-3432-48d8-8b53-760a7b468d7e', 'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C', 2, 'Private', 'Private', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID a140f5a8-9a5c-4459-b7a1-2602f3a2ca11 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('a140f5a8-9a5c-4459-b7a1-2602f3a2ca11', 'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C', 3, 'Room', 'Room', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID d40c8ff6-ec0b-488a-9cc7-2464a132601d */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('d40c8ff6-ec0b-488a-9cc7-2464a132601d', 'A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C', 4, 'Topic', 'Topic', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='A4A7C50E-BE15-4E6D-8415-6B7A2A981F8C';

/* SQL text to insert entity field value with ID 8b2f8eab-1940-49c9-acfe-a33b6def2571 */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('8b2f8eab-1940-49c9-acfe-a33b6def2571', 'D3FF7771-EEB6-46D1-A1CF-7D5977142EE1', 1, 'Active', 'Active', GETUTCDATE(), GETUTCDATE());

/* SQL text to insert entity field value with ID c2663101-d5a7-4570-bcfd-c03f6f7aa6fb */
INSERT INTO [${mjSchema}].[EntityFieldValue]
                                       ([ID], [EntityFieldID], [Sequence], [Value], [Code], [__mj_CreatedAt], [__mj_UpdatedAt])
                                    VALUES
                                       ('c2663101-d5a7-4570-bcfd-c03f6f7aa6fb', 'D3FF7771-EEB6-46D1-A1CF-7D5977142EE1', 2, 'Archived', 'Archived', GETUTCDATE(), GETUTCDATE());

/* SQL text to update ValueListType for entity field ID D3FF7771-EEB6-46D1-A1CF-7D5977142EE1 */
UPDATE [${mjSchema}].[EntityField] SET ValueListType='List' WHERE ID='D3FF7771-EEB6-46D1-A1CF-7D5977142EE1';


/* Create Entity Relationship: MJ: AI Agents -> MJ_BizApps_Collaboration: Space Agents (One To Many via AgentID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '1049d2d6-00e5-4108-831d-6b18a42fd867'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('1049d2d6-00e5-4108-831d-6b18a42fd867', 'CDB135CC-6D3C-480B-90AE-25B7805F82C1', '56476128-C105-4118-A722-AF72F81A7960', 'AgentID', 'One To Many', 1, 1, 41, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Types -> MJ_BizApps_Collaboration: Space Knowledge Sources (One To Many via SpaceTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'beca9d60-e433-4b29-8173-44d3cb74a49d'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('beca9d60-e433-4b29-8173-44d3cb74a49d', '01596359-EC4B-449C-BA16-316DE4B92A4E', '157106BD-1938-4EEF-8798-05BAF047DFD2', 'SpaceTypeID', 'One To Many', 1, 1, 2, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Types -> MJ_BizApps_Collaboration: Space Agent Skills (One To Many via SpaceTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'e0b325d3-481e-4961-b459-6dc05ddc9e7d'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('e0b325d3-481e-4961-b459-6dc05ddc9e7d', '01596359-EC4B-449C-BA16-316DE4B92A4E', 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', 'SpaceTypeID', 'One To Many', 1, 1, 3, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Space Types -> MJ_BizApps_Collaboration: Space Agents (One To Many via SpaceTypeID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '310e859e-1bb0-4939-8072-4ada18f92275'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('310e859e-1bb0-4939-8072-4ada18f92275', '01596359-EC4B-449C-BA16-316DE4B92A4E', '56476128-C105-4118-A722-AF72F81A7960', 'SpaceTypeID', 'One To Many', 1, 1, 4, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: AI Skills -> MJ_BizApps_Collaboration: Space Agent Skills (One To Many via SkillID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '287c2299-64df-4f80-96fc-a7d765a6eb70'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('287c2299-64df-4f80-96fc-a7d765a6eb70', '1D52DE84-DD3F-4E46-8D2B-574B70080BB4', 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', 'SkillID', 'One To Many', 1, 1, 8, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Knowledge Sources (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '09ee80d4-fafa-4251-ae4a-d086a821dde4'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('09ee80d4-fafa-4251-ae4a-d086a821dde4', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', '157106BD-1938-4EEF-8798-05BAF047DFD2', 'SpaceID', 'One To Many', 1, 1, 6, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Agent Skills (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '9a194881-4647-4b53-8ee4-a6fd4ee4d865'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('9a194881-4647-4b53-8ee4-a6fd4ee4d865', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', 'SpaceID', 'One To Many', 1, 1, 7, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Chats (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'f69018a9-db96-4126-8b90-5fe2adbaf5c1'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('f69018a9-db96-4126-8b90-5fe2adbaf5c1', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', '75E3ED25-C46B-45C1-96F7-91578D88DBE2', 'SpaceID', 'One To Many', 1, 1, 8, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ_BizApps_Collaboration: Spaces -> MJ_BizApps_Collaboration: Space Agents (One To Many via SpaceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'ec482fc2-85ea-4454-b4a6-8f8e671a086a'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('ec482fc2-85ea-4454-b4a6-8f8e671a086a', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', '56476128-C105-4118-A722-AF72F81A7960', 'SpaceID', 'One To Many', 1, 1, 9, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ: Entities -> MJ_BizApps_Collaboration: Spaces (One To Many via AnchorEntityID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '349c1b2e-8caa-4058-a354-2ca13ee88fec'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('349c1b2e-8caa-4058-a354-2ca13ee88fec', 'E0238F34-2837-EF11-86D4-6045BDEE16E6', '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', 'AnchorEntityID', 'One To Many', 1, 1, 103, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Conversations -> MJ_BizApps_Collaboration: Space Chats (One To Many via ConversationID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'edc5af66-ea3b-4f8e-bce3-7ae2650eee95'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('edc5af66-ea3b-4f8e-bce3-7ae2650eee95', '13248F34-2837-EF11-86D4-6045BDEE16E6', '75E3ED25-C46B-45C1-96F7-91578D88DBE2', 'ConversationID', 'One To Many', 1, 1, 10, GETUTCDATE(), GETUTCDATE())
   END;


/* Create Entity Relationship: MJ: Content Sources -> MJ_BizApps_Collaboration: Space Knowledge Sources (One To Many via ContentSourceID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = 'a3e2c625-b035-4116-8f26-c0eb839d8a3c'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('a3e2c625-b035-4116-8f26-c0eb839d8a3c', 'B420FF22-0E66-EF11-A752-C0A5E8ACCB22', '157106BD-1938-4EEF-8798-05BAF047DFD2', 'ContentSourceID', 'One To Many', 1, 1, 6, GETUTCDATE(), GETUTCDATE())
   END;
                    
/* Create Entity Relationship: MJ_BizApps_Common: People -> MJ_BizApps_Collaboration: Space Members (One To Many via PersonID) */
   IF NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityRelationship] WHERE [ID] = '20595a1f-f9b0-4bf5-b52c-5a07f19fc187'
   )
   BEGIN
      INSERT INTO [${mjSchema}].[EntityRelationship] ([ID], [EntityID], [RelatedEntityID], [RelatedEntityJoinField], [Type], [BundleInAPI], [DisplayInForm], [Sequence], [__mj_CreatedAt], [__mj_UpdatedAt])
                    VALUES ('20595a1f-f9b0-4bf5-b52c-5a07f19fc187', '7A94ADA9-7880-4FAE-97D8-DB0E934C3F5F', 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', 'PersonID', 'One To Many', 1, 1, 44, GETUTCDATE(), GETUTCDATE())
   END;

/* SQL text to sync schema info from database schemas */
EXEC [${mjSchema}].[spUpdateSchemaInfoFromDatabase] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

/* Index for Foreign Keys for SpaceAgentSkill */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agent Skills
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SkillID in table SpaceAgentSkill
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSkill_SkillID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSkill]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSkill_SkillID ON [${flyway:defaultSchema}].[SpaceAgentSkill] ([SkillID]);

-- Index for foreign key SpaceTypeID in table SpaceAgentSkill
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSkill_SpaceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSkill]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSkill_SpaceTypeID ON [${flyway:defaultSchema}].[SpaceAgentSkill] ([SpaceTypeID]);

-- Index for foreign key SpaceID in table SpaceAgentSkill
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgentSkill_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgentSkill]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgentSkill_SpaceID ON [${flyway:defaultSchema}].[SpaceAgentSkill] ([SpaceID]);

/* SQL text to update entity field related entity name field map for entity field ID 989B5B18-FCC6-4B31-8159-B3325C078872 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='989B5B18-FCC6-4B31-8159-B3325C078872', @RelatedEntityNameFieldMap='Skill';

/* Index for Foreign Keys for SpaceAgent */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agents
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key AgentID in table SpaceAgent
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgent_AgentID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgent]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgent_AgentID ON [${flyway:defaultSchema}].[SpaceAgent] ([AgentID]);

-- Index for foreign key SpaceTypeID in table SpaceAgent
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgent_SpaceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgent]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgent_SpaceTypeID ON [${flyway:defaultSchema}].[SpaceAgent] ([SpaceTypeID]);

-- Index for foreign key SpaceID in table SpaceAgent
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceAgent_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceAgent]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceAgent_SpaceID ON [${flyway:defaultSchema}].[SpaceAgent] ([SpaceID]);

/* SQL text to update entity field related entity name field map for entity field ID C159DDD2-4AF0-4F48-8439-AB1042BA9AB6 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='C159DDD2-4AF0-4F48-8439-AB1042BA9AB6', @RelatedEntityNameFieldMap='Agent';

/* Index for Foreign Keys for SpaceChat */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Chats
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table SpaceChat
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceChat_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceChat]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceChat_SpaceID ON [${flyway:defaultSchema}].[SpaceChat] ([SpaceID]);

-- Index for foreign key ConversationID in table SpaceChat
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceChat_ConversationID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceChat]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceChat_ConversationID ON [${flyway:defaultSchema}].[SpaceChat] ([ConversationID]);

/* SQL text to update entity field related entity name field map for entity field ID 6D59D0FC-A8B8-43CF-B410-B89FF83BEABD */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='6D59D0FC-A8B8-43CF-B410-B89FF83BEABD', @RelatedEntityNameFieldMap='Space';

/* Index for Foreign Keys for SpaceKnowledgeSource */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key ContentSourceID in table SpaceKnowledgeSource
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceKnowledgeSource_ContentSourceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceKnowledgeSource]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceKnowledgeSource_ContentSourceID ON [${flyway:defaultSchema}].[SpaceKnowledgeSource] ([ContentSourceID]);

-- Index for foreign key SpaceTypeID in table SpaceKnowledgeSource
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceKnowledgeSource_SpaceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceKnowledgeSource]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceKnowledgeSource_SpaceTypeID ON [${flyway:defaultSchema}].[SpaceKnowledgeSource] ([SpaceTypeID]);

-- Index for foreign key SpaceID in table SpaceKnowledgeSource
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceKnowledgeSource_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceKnowledgeSource]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceKnowledgeSource_SpaceID ON [${flyway:defaultSchema}].[SpaceKnowledgeSource] ([SpaceID]);

/* SQL text to update entity field related entity name field map for entity field ID 22DCC888-2945-4D0A-B5B3-4710B692C859 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='22DCC888-2945-4D0A-B5B3-4710B692C859', @RelatedEntityNameFieldMap='ContentSource';

/* Index for Foreign Keys for SpaceMember */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceID in table SpaceMember
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMember_SpaceID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMember]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMember_SpaceID ON [${flyway:defaultSchema}].[SpaceMember] ([SpaceID]);

-- Index for foreign key UserID in table SpaceMember
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMember_UserID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMember]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMember_UserID ON [${flyway:defaultSchema}].[SpaceMember] ([UserID]);

-- Index for foreign key SpaceRoleTypeID in table SpaceMember
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMember_SpaceRoleTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMember]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMember_SpaceRoleTypeID ON [${flyway:defaultSchema}].[SpaceMember] ([SpaceRoleTypeID]);

-- Index for foreign key PersonID in table SpaceMember
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_SpaceMember_PersonID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[SpaceMember]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_SpaceMember_PersonID ON [${flyway:defaultSchema}].[SpaceMember] ([PersonID]);

/* SQL text to update entity field related entity name field map for entity field ID 1522BBFC-D0C2-4E5F-9C71-B2A3459A8A35 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='1522BBFC-D0C2-4E5F-9C71-B2A3459A8A35', @RelatedEntityNameFieldMap='Person';

/* SQL text to update entity field related entity name field map for entity field ID 6052D9C2-FC0D-42D8-AA83-551E436CE065 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='6052D9C2-FC0D-42D8-AA83-551E436CE065', @RelatedEntityNameFieldMap='SpaceType';

/* SQL text to update entity field related entity name field map for entity field ID 1003F072-725F-4807-BE9A-1E862B2A987A */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='1003F072-725F-4807-BE9A-1E862B2A987A', @RelatedEntityNameFieldMap='SpaceType';

/* SQL text to update entity field related entity name field map for entity field ID 0D7C68C1-B1E0-4B3C-B3DB-85A7384560FA */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='0D7C68C1-B1E0-4B3C-B3DB-85A7384560FA', @RelatedEntityNameFieldMap='SpaceType';

/* SQL text to update entity field related entity name field map for entity field ID 06F163A0-715A-4648-BD10-E716BDB75B95 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='06F163A0-715A-4648-BD10-E716BDB75B95', @RelatedEntityNameFieldMap='Conversation';

/* Base View SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: vwSpaceMembers
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Members
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceMember
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceMembers]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceMembers];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceMembers]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJUser_UserID.[Name] AS [User],
    mjBizAppsCollaborationSpaceRoleType_SpaceRoleTypeID.[Name] AS [SpaceRoleType],
    mjBizAppsCommonPerson_PersonID.[DisplayName] AS [Person]
FROM
    [${flyway:defaultSchema}].[SpaceMember] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_UserID
  ON
    [s].[UserID] = MJUser_UserID.[ID]
INNER JOIN
    [${flyway:defaultSchema}].[SpaceRoleType] AS mjBizAppsCollaborationSpaceRoleType_SpaceRoleTypeID
  ON
    [s].[SpaceRoleTypeID] = mjBizAppsCollaborationSpaceRoleType_SpaceRoleTypeID.[ID]
LEFT OUTER JOIN
    [${mjSchema}_BizAppsCommon].[Person] AS mjBizAppsCommonPerson_PersonID
  ON
    [s].[PersonID] = mjBizAppsCommonPerson_PersonID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: Permissions for vwSpaceMembers
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceMembers] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: spCreateSpaceMember
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceMember
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceMember]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceMember];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceMember]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @UserID uniqueidentifier,
    @SpaceRoleTypeID uniqueidentifier,
    @Band nvarchar(20),
    @Status nvarchar(20) = NULL,
    @SyncSource_Clear bit = 0,
    @SyncSource nvarchar(100) = NULL,
    @PersonID_Clear bit = 0,
    @PersonID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceMember]
            (
                [ID],
                [SpaceID],
                [UserID],
                [SpaceRoleTypeID],
                [Band],
                [Status],
                [SyncSource],
                [PersonID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @UserID,
                @SpaceRoleTypeID,
                @Band,
                ISNULL(@Status, 'Invited'),
                CASE WHEN @SyncSource_Clear = 1 THEN NULL ELSE ISNULL(@SyncSource, NULL) END,
                CASE WHEN @PersonID_Clear = 1 THEN NULL ELSE ISNULL(@PersonID, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceMember]
            (
                [SpaceID],
                [UserID],
                [SpaceRoleTypeID],
                [Band],
                [Status],
                [SyncSource],
                [PersonID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @UserID,
                @SpaceRoleTypeID,
                @Band,
                ISNULL(@Status, 'Invited'),
                CASE WHEN @SyncSource_Clear = 1 THEN NULL ELSE ISNULL(@SyncSource, NULL) END,
                CASE WHEN @PersonID_Clear = 1 THEN NULL ELSE ISNULL(@PersonID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceMembers] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Members */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceMember] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: spUpdateSpaceMember
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceMember
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceMember]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceMember];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceMember]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @UserID uniqueidentifier = NULL,
    @SpaceRoleTypeID uniqueidentifier = NULL,
    @Band nvarchar(20) = NULL,
    @Status nvarchar(20) = NULL,
    @SyncSource_Clear bit = 0,
    @SyncSource nvarchar(100) = NULL,
    @PersonID_Clear bit = 0,
    @PersonID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceMember]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [UserID] = ISNULL(@UserID, [UserID]),
        [SpaceRoleTypeID] = ISNULL(@SpaceRoleTypeID, [SpaceRoleTypeID]),
        [Band] = ISNULL(@Band, [Band]),
        [Status] = ISNULL(@Status, [Status]),
        [SyncSource] = CASE WHEN @SyncSource_Clear = 1 THEN NULL ELSE ISNULL(@SyncSource, [SyncSource]) END,
        [PersonID] = CASE WHEN @PersonID_Clear = 1 THEN NULL ELSE ISNULL(@PersonID, [PersonID]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceMembers] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceMembers]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] TO [cdp_UI], [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceMember table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceMember]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceMember];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceMember
ON [${flyway:defaultSchema}].[SpaceMember]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceMember]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceMember] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Members */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceMember] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Members */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Members
-- Item: spDeleteSpaceMember
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceMember
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceMember]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceMember];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceMember]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceMember]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Members */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceMember] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update entity field related entity name field map for entity field ID 2B04F4A3-3B4A-4E7D-85E2-1C4F85AB50A1 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='2B04F4A3-3B4A-4E7D-85E2-1C4F85AB50A1', @RelatedEntityNameFieldMap='Space';

/* Base View SQL for MJ_BizApps_Collaboration: Space Chats */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Chats
-- Item: vwSpaceChats
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Chats
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceChat
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceChats]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceChats];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceChats]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space],
    MJConversation_ConversationID.[Name] AS [Conversation]
FROM
    [${flyway:defaultSchema}].[SpaceChat] AS s
INNER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
INNER JOIN
    [${mjSchema}].[Conversation] AS MJConversation_ConversationID
  ON
    [s].[ConversationID] = MJConversation_ConversationID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceChats] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Chats */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Chats
-- Item: Permissions for vwSpaceChats
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceChats] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Chats */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Chats
-- Item: spCreateSpaceChat
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceChat
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceChat]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceChat];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceChat]
    @ID uniqueidentifier = NULL,
    @SpaceID uniqueidentifier,
    @ConversationID uniqueidentifier,
    @Name nvarchar(255),
    @Subject_Clear bit = 0,
    @Subject nvarchar(500) = NULL,
    @Kind nvarchar(50) = NULL,
    @Status nvarchar(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceChat]
            (
                [ID],
                [SpaceID],
                [ConversationID],
                [Name],
                [Subject],
                [Kind],
                [Status]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceID,
                @ConversationID,
                @Name,
                CASE WHEN @Subject_Clear = 1 THEN NULL ELSE ISNULL(@Subject, NULL) END,
                ISNULL(@Kind, 'General'),
                ISNULL(@Status, 'Active')
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceChat]
            (
                [SpaceID],
                [ConversationID],
                [Name],
                [Subject],
                [Kind],
                [Status]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceID,
                @ConversationID,
                @Name,
                CASE WHEN @Subject_Clear = 1 THEN NULL ELSE ISNULL(@Subject, NULL) END,
                ISNULL(@Kind, 'General'),
                ISNULL(@Status, 'Active')
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceChats] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceChat] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Chats */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceChat] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Chats */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Chats
-- Item: spUpdateSpaceChat
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceChat
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceChat]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceChat];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceChat]
    @ID uniqueidentifier,
    @SpaceID uniqueidentifier = NULL,
    @ConversationID uniqueidentifier = NULL,
    @Name nvarchar(255) = NULL,
    @Subject_Clear bit = 0,
    @Subject nvarchar(500) = NULL,
    @Kind nvarchar(50) = NULL,
    @Status nvarchar(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceChat]
    SET
        [SpaceID] = ISNULL(@SpaceID, [SpaceID]),
        [ConversationID] = ISNULL(@ConversationID, [ConversationID]),
        [Name] = ISNULL(@Name, [Name]),
        [Subject] = CASE WHEN @Subject_Clear = 1 THEN NULL ELSE ISNULL(@Subject, [Subject]) END,
        [Kind] = ISNULL(@Kind, [Kind]),
        [Status] = ISNULL(@Status, [Status])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceChats] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceChats]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceChat] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceChat table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceChat]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceChat];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceChat
ON [${flyway:defaultSchema}].[SpaceChat]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceChat]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceChat] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Chats */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceChat] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Chats */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Chats
-- Item: spDeleteSpaceChat
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceChat
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceChat]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceChat];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceChat]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceChat]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceChat] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Chats */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceChat] TO [cdp_Developer], [cdp_Integration];

/* SQL text to update entity field related entity name field map for entity field ID B2326BB1-C37D-4C6D-9E52-163C05245BF7 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='B2326BB1-C37D-4C6D-9E52-163C05245BF7', @RelatedEntityNameFieldMap='Space';

/* SQL text to update entity field related entity name field map for entity field ID 1041A156-DD55-4B06-8B04-DF5477B3C5F3 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='1041A156-DD55-4B06-8B04-DF5477B3C5F3', @RelatedEntityNameFieldMap='Space';

/* Base View SQL for MJ_BizApps_Collaboration: Space Knowledge Sources */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
-- Item: vwSpaceKnowledgeSources
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Knowledge Sources
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceKnowledgeSource
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceKnowledgeSources]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceKnowledgeSources];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceKnowledgeSources]
AS
SELECT
    s.*,
    MJContentSource_ContentSourceID.[Name] AS [ContentSource],
    mjBizAppsCollaborationSpaceType_SpaceTypeID.[Name] AS [SpaceType],
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space]
FROM
    [${flyway:defaultSchema}].[SpaceKnowledgeSource] AS s
INNER JOIN
    [${mjSchema}].[ContentSource] AS MJContentSource_ContentSourceID
  ON
    [s].[ContentSourceID] = MJContentSource_ContentSourceID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[SpaceType] AS mjBizAppsCollaborationSpaceType_SpaceTypeID
  ON
    [s].[SpaceTypeID] = mjBizAppsCollaborationSpaceType_SpaceTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceKnowledgeSources] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Knowledge Sources */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
-- Item: Permissions for vwSpaceKnowledgeSources
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceKnowledgeSources] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Knowledge Sources */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
-- Item: spCreateSpaceKnowledgeSource
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceKnowledgeSource
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceKnowledgeSource]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceKnowledgeSource];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceKnowledgeSource]
    @ID uniqueidentifier = NULL,
    @ContentSourceID uniqueidentifier,
    @SpaceTypeID_Clear bit = 0,
    @SpaceTypeID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceKnowledgeSource]
            (
                [ID],
                [ContentSourceID],
                [SpaceTypeID],
                [SpaceID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @ContentSourceID,
                CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, NULL) END,
                CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceKnowledgeSource]
            (
                [ContentSourceID],
                [SpaceTypeID],
                [SpaceID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ContentSourceID,
                CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, NULL) END,
                CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceKnowledgeSources] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceKnowledgeSource] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Knowledge Sources */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceKnowledgeSource] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Knowledge Sources */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
-- Item: spUpdateSpaceKnowledgeSource
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceKnowledgeSource
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceKnowledgeSource]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceKnowledgeSource];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceKnowledgeSource]
    @ID uniqueidentifier,
    @ContentSourceID uniqueidentifier = NULL,
    @SpaceTypeID_Clear bit = 0,
    @SpaceTypeID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceKnowledgeSource]
    SET
        [ContentSourceID] = ISNULL(@ContentSourceID, [ContentSourceID]),
        [SpaceTypeID] = CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, [SpaceTypeID]) END,
        [SpaceID] = CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, [SpaceID]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceKnowledgeSources] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceKnowledgeSources]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceKnowledgeSource] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceKnowledgeSource table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceKnowledgeSource]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceKnowledgeSource];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceKnowledgeSource
ON [${flyway:defaultSchema}].[SpaceKnowledgeSource]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceKnowledgeSource]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceKnowledgeSource] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Knowledge Sources */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceKnowledgeSource] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Knowledge Sources */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
-- Item: spDeleteSpaceKnowledgeSource
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceKnowledgeSource
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceKnowledgeSource]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceKnowledgeSource];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceKnowledgeSource]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceKnowledgeSource]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceKnowledgeSource] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Knowledge Sources */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceKnowledgeSource] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Space Agents */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agents
-- Item: vwSpaceAgents
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Agents
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceAgent
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceAgents]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceAgents];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceAgents]
AS
SELECT
    s.*,
    MJAIAgent_AgentID.[Name] AS [Agent],
    mjBizAppsCollaborationSpaceType_SpaceTypeID.[Name] AS [SpaceType],
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space]
FROM
    [${flyway:defaultSchema}].[SpaceAgent] AS s
INNER JOIN
    [${mjSchema}].[AIAgent] AS MJAIAgent_AgentID
  ON
    [s].[AgentID] = MJAIAgent_AgentID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[SpaceType] AS mjBizAppsCollaborationSpaceType_SpaceTypeID
  ON
    [s].[SpaceTypeID] = mjBizAppsCollaborationSpaceType_SpaceTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAgents] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Agents */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agents
-- Item: Permissions for vwSpaceAgents
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAgents] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Agents */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agents
-- Item: spCreateSpaceAgent
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceAgent
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceAgent]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceAgent];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceAgent]
    @ID uniqueidentifier = NULL,
    @AgentID uniqueidentifier,
    @SpaceTypeID_Clear bit = 0,
    @SpaceTypeID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL,
    @IsDefault bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceAgent]
            (
                [ID],
                [AgentID],
                [SpaceTypeID],
                [SpaceID],
                [IsDefault]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @AgentID,
                CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, NULL) END,
                CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, NULL) END,
                ISNULL(@IsDefault, 0)
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceAgent]
            (
                [AgentID],
                [SpaceTypeID],
                [SpaceID],
                [IsDefault]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @AgentID,
                CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, NULL) END,
                CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, NULL) END,
                ISNULL(@IsDefault, 0)
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceAgents] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAgent] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Agents */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAgent] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Agents */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agents
-- Item: spUpdateSpaceAgent
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceAgent
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceAgent]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceAgent];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceAgent]
    @ID uniqueidentifier,
    @AgentID uniqueidentifier = NULL,
    @SpaceTypeID_Clear bit = 0,
    @SpaceTypeID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL,
    @IsDefault bit = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceAgent]
    SET
        [AgentID] = ISNULL(@AgentID, [AgentID]),
        [SpaceTypeID] = CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, [SpaceTypeID]) END,
        [SpaceID] = CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, [SpaceID]) END,
        [IsDefault] = ISNULL(@IsDefault, [IsDefault])
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceAgents] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceAgents]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAgent] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceAgent table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceAgent]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceAgent];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceAgent
ON [${flyway:defaultSchema}].[SpaceAgent]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceAgent]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceAgent] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Agents */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAgent] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Agents */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agents
-- Item: spDeleteSpaceAgent
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceAgent
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceAgent]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceAgent];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceAgent]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceAgent]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAgent] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Agents */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAgent] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Space Agent Skills */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agent Skills
-- Item: vwSpaceAgentSkills
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Agent Skills
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceAgentSkill
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceAgentSkills]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceAgentSkills];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceAgentSkills]
AS
SELECT
    s.*,
    MJAISkill_SkillID.[Name] AS [Skill],
    mjBizAppsCollaborationSpaceType_SpaceTypeID.[Name] AS [SpaceType],
    mjBizAppsCollaborationSpace_SpaceID.[Name] AS [Space]
FROM
    [${flyway:defaultSchema}].[SpaceAgentSkill] AS s
INNER JOIN
    [${mjSchema}].[AISkill] AS MJAISkill_SkillID
  ON
    [s].[SkillID] = MJAISkill_SkillID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[SpaceType] AS mjBizAppsCollaborationSpaceType_SpaceTypeID
  ON
    [s].[SpaceTypeID] = mjBizAppsCollaborationSpaceType_SpaceTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_SpaceID
  ON
    [s].[SpaceID] = mjBizAppsCollaborationSpace_SpaceID.[ID]
GO
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAgentSkills] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Agent Skills */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agent Skills
-- Item: Permissions for vwSpaceAgentSkills
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceAgentSkills] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Space Agent Skills */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agent Skills
-- Item: spCreateSpaceAgentSkill
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR SpaceAgentSkill
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceAgentSkill]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceAgentSkill];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceAgentSkill]
    @ID uniqueidentifier = NULL,
    @SkillID uniqueidentifier,
    @SpaceTypeID_Clear bit = 0,
    @SpaceTypeID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceAgentSkill]
            (
                [ID],
                [SkillID],
                [SpaceTypeID],
                [SpaceID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SkillID,
                CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, NULL) END,
                CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceAgentSkill]
            (
                [SkillID],
                [SpaceTypeID],
                [SpaceID]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SkillID,
                CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, NULL) END,
                CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceAgentSkills] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAgentSkill] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Agent Skills */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceAgentSkill] TO [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Space Agent Skills */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agent Skills
-- Item: spUpdateSpaceAgentSkill
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR SpaceAgentSkill
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceAgentSkill]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceAgentSkill];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceAgentSkill]
    @ID uniqueidentifier,
    @SkillID uniqueidentifier = NULL,
    @SpaceTypeID_Clear bit = 0,
    @SpaceTypeID uniqueidentifier = NULL,
    @SpaceID_Clear bit = 0,
    @SpaceID uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceAgentSkill]
    SET
        [SkillID] = ISNULL(@SkillID, [SkillID]),
        [SpaceTypeID] = CASE WHEN @SpaceTypeID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceTypeID, [SpaceTypeID]) END,
        [SpaceID] = CASE WHEN @SpaceID_Clear = 1 THEN NULL ELSE ISNULL(@SpaceID, [SpaceID]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceAgentSkills] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceAgentSkills]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAgentSkill] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceAgentSkill table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceAgentSkill]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceAgentSkill];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceAgentSkill
ON [${flyway:defaultSchema}].[SpaceAgentSkill]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceAgentSkill]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceAgentSkill] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Agent Skills */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceAgentSkill] TO [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Space Agent Skills */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Agent Skills
-- Item: spDeleteSpaceAgentSkill
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR SpaceAgentSkill
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceAgentSkill]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceAgentSkill];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceAgentSkill]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceAgentSkill]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAgentSkill] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Agent Skills */

GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceAgentSkill] TO [cdp_Developer], [cdp_Integration];

/* Index for Foreign Keys for SpaceType */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------;

/* Index for Foreign Keys for Space */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: Index for Foreign Keys
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------
-- Index for foreign key SpaceTypeID in table Space
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Space_SpaceTypeID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Space]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Space_SpaceTypeID ON [${flyway:defaultSchema}].[Space] ([SpaceTypeID]);

-- Index for foreign key ParentID in table Space
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Space_ParentID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Space]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Space_ParentID ON [${flyway:defaultSchema}].[Space] ([ParentID]);

-- Index for foreign key OwnerID in table Space
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Space_OwnerID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Space]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Space_OwnerID ON [${flyway:defaultSchema}].[Space] ([OwnerID]);

-- Index for foreign key AnchorEntityID in table Space
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IDX_AUTO_MJ_FKEY_Space_AnchorEntityID' 
    AND object_id = OBJECT_ID('[${flyway:defaultSchema}].[Space]')
)
CREATE INDEX IDX_AUTO_MJ_FKEY_Space_AnchorEntityID ON [${flyway:defaultSchema}].[Space] ([AnchorEntityID]);

/* SQL text to update entity field related entity name field map for entity field ID F27D0C6F-650C-4B15-B564-7BC8FE1D4E72 */
EXEC [${mjSchema}].[spUpdateEntityFieldRelatedEntityNameFieldMap] @EntityFieldID='F27D0C6F-650C-4B15-B564-7BC8FE1D4E72', @RelatedEntityNameFieldMap='AnchorEntity';

/* Base View SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: vwSpaceTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Space Types
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  SpaceType
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaceTypes]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaceTypes];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaceTypes]
AS
SELECT
    s.*
FROM
    [${flyway:defaultSchema}].[SpaceType] AS s
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Space Types */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Space Types
-- Item: Permissions for vwSpaceTypes
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] FROM [cdp_Developer]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] FROM [cdp_UI]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaceTypes] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

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
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpaceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpaceType]
    @ID uniqueidentifier = NULL,
    @Code nvarchar(40),
    @Name nvarchar(200),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Vocabulary nvarchar(50),
    @Discoverability nvarchar(20) = NULL,
    @JoinMode nvarchar(20) = NULL,
    @MessagingPanel bit = NULL,
    @LibraryPanel bit = NULL,
    @WorkPanel bit = NULL,
    @GovernancePanel bit = NULL,
    @DefaultRetention nvarchar(20) = NULL,
    @DefaultAgentRetrieval nvarchar(30) = NULL,
    @DefaultBand nvarchar(20) = NULL,
    @InviteApproval nvarchar(20) = NULL,
    @MemberCap_Clear bit = 0,
    @MemberCap int = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL,
    @DefaultAllowParentAssignees bit = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Color_Clear bit = 0,
    @Color nvarchar(50) = NULL,
    @ServerDriverClass_Clear bit = 0,
    @ServerDriverClass nvarchar(255) = NULL,
    @UIDriverClass_Clear bit = 0,
    @UIDriverClass nvarchar(255) = NULL,
    @SpaceExtensionEntity_Clear bit = 0,
    @SpaceExtensionEntity nvarchar(255) = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL,
    @DefaultInheritsMembership bit = NULL,
    @PostCloseAccess nvarchar(20) = NULL,
    @PostCloseAccessDays_Clear bit = 0,
    @PostCloseAccessDays int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[SpaceType]
            (
                [ID],
                [Code],
                [Name],
                [Description],
                [Vocabulary],
                [Discoverability],
                [JoinMode],
                [MessagingPanel],
                [LibraryPanel],
                [WorkPanel],
                [GovernancePanel],
                [DefaultRetention],
                [DefaultAgentRetrieval],
                [DefaultBand],
                [InviteApproval],
                [MemberCap],
                [DisplayRank],
                [IsActive],
                [DefaultAllowParentAssignees],
                [IconClass],
                [Color],
                [ServerDriverClass],
                [UIDriverClass],
                [SpaceExtensionEntity],
                [Configuration],
                [DefaultInheritsMembership],
                [PostCloseAccess],
                [PostCloseAccessDays]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @Vocabulary,
                ISNULL(@Discoverability, 'Hidden'),
                ISNULL(@JoinMode, 'InviteOnly'),
                ISNULL(@MessagingPanel, 1),
                ISNULL(@LibraryPanel, 0),
                ISNULL(@WorkPanel, 0),
                ISNULL(@GovernancePanel, 0),
                ISNULL(@DefaultRetention, 'Indefinite'),
                ISNULL(@DefaultAgentRetrieval, 'Included'),
                ISNULL(@DefaultBand, 'Team'),
                ISNULL(@InviteApproval, 'Approve'),
                CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, NULL) END,
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1),
                ISNULL(@DefaultAllowParentAssignees, 1),
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, NULL) END,
                CASE WHEN @ServerDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@ServerDriverClass, NULL) END,
                CASE WHEN @UIDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@UIDriverClass, NULL) END,
                CASE WHEN @SpaceExtensionEntity_Clear = 1 THEN NULL ELSE ISNULL(@SpaceExtensionEntity, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END,
                ISNULL(@DefaultInheritsMembership, 1),
                ISNULL(@PostCloseAccess, 'None'),
                CASE WHEN @PostCloseAccessDays_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccessDays, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[SpaceType]
            (
                [Code],
                [Name],
                [Description],
                [Vocabulary],
                [Discoverability],
                [JoinMode],
                [MessagingPanel],
                [LibraryPanel],
                [WorkPanel],
                [GovernancePanel],
                [DefaultRetention],
                [DefaultAgentRetrieval],
                [DefaultBand],
                [InviteApproval],
                [MemberCap],
                [DisplayRank],
                [IsActive],
                [DefaultAllowParentAssignees],
                [IconClass],
                [Color],
                [ServerDriverClass],
                [UIDriverClass],
                [SpaceExtensionEntity],
                [Configuration],
                [DefaultInheritsMembership],
                [PostCloseAccess],
                [PostCloseAccessDays]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @Code,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @Vocabulary,
                ISNULL(@Discoverability, 'Hidden'),
                ISNULL(@JoinMode, 'InviteOnly'),
                ISNULL(@MessagingPanel, 1),
                ISNULL(@LibraryPanel, 0),
                ISNULL(@WorkPanel, 0),
                ISNULL(@GovernancePanel, 0),
                ISNULL(@DefaultRetention, 'Indefinite'),
                ISNULL(@DefaultAgentRetrieval, 'Included'),
                ISNULL(@DefaultBand, 'Team'),
                ISNULL(@InviteApproval, 'Approve'),
                CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, NULL) END,
                ISNULL(@DisplayRank, 0),
                ISNULL(@IsActive, 1),
                ISNULL(@DefaultAllowParentAssignees, 1),
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, NULL) END,
                CASE WHEN @ServerDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@ServerDriverClass, NULL) END,
                CASE WHEN @UIDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@UIDriverClass, NULL) END,
                CASE WHEN @SpaceExtensionEntity_Clear = 1 THEN NULL ELSE ISNULL(@SpaceExtensionEntity, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END,
                ISNULL(@DefaultInheritsMembership, 1),
                ISNULL(@PostCloseAccess, 'None'),
                CASE WHEN @PostCloseAccessDays_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccessDays, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaceTypes] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] TO [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Space Types */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpaceType] TO [cdp_Developer], [cdp_Integration];

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
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpaceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpaceType]
    @ID uniqueidentifier,
    @Code nvarchar(40) = NULL,
    @Name nvarchar(200) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @Vocabulary nvarchar(50) = NULL,
    @Discoverability nvarchar(20) = NULL,
    @JoinMode nvarchar(20) = NULL,
    @MessagingPanel bit = NULL,
    @LibraryPanel bit = NULL,
    @WorkPanel bit = NULL,
    @GovernancePanel bit = NULL,
    @DefaultRetention nvarchar(20) = NULL,
    @DefaultAgentRetrieval nvarchar(30) = NULL,
    @DefaultBand nvarchar(20) = NULL,
    @InviteApproval nvarchar(20) = NULL,
    @MemberCap_Clear bit = 0,
    @MemberCap int = NULL,
    @DisplayRank int = NULL,
    @IsActive bit = NULL,
    @DefaultAllowParentAssignees bit = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Color_Clear bit = 0,
    @Color nvarchar(50) = NULL,
    @ServerDriverClass_Clear bit = 0,
    @ServerDriverClass nvarchar(255) = NULL,
    @UIDriverClass_Clear bit = 0,
    @UIDriverClass nvarchar(255) = NULL,
    @SpaceExtensionEntity_Clear bit = 0,
    @SpaceExtensionEntity nvarchar(255) = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL,
    @DefaultInheritsMembership bit = NULL,
    @PostCloseAccess nvarchar(20) = NULL,
    @PostCloseAccessDays_Clear bit = 0,
    @PostCloseAccessDays int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceType]
    SET
        [Code] = ISNULL(@Code, [Code]),
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [Vocabulary] = ISNULL(@Vocabulary, [Vocabulary]),
        [Discoverability] = ISNULL(@Discoverability, [Discoverability]),
        [JoinMode] = ISNULL(@JoinMode, [JoinMode]),
        [MessagingPanel] = ISNULL(@MessagingPanel, [MessagingPanel]),
        [LibraryPanel] = ISNULL(@LibraryPanel, [LibraryPanel]),
        [WorkPanel] = ISNULL(@WorkPanel, [WorkPanel]),
        [GovernancePanel] = ISNULL(@GovernancePanel, [GovernancePanel]),
        [DefaultRetention] = ISNULL(@DefaultRetention, [DefaultRetention]),
        [DefaultAgentRetrieval] = ISNULL(@DefaultAgentRetrieval, [DefaultAgentRetrieval]),
        [DefaultBand] = ISNULL(@DefaultBand, [DefaultBand]),
        [InviteApproval] = ISNULL(@InviteApproval, [InviteApproval]),
        [MemberCap] = CASE WHEN @MemberCap_Clear = 1 THEN NULL ELSE ISNULL(@MemberCap, [MemberCap]) END,
        [DisplayRank] = ISNULL(@DisplayRank, [DisplayRank]),
        [IsActive] = ISNULL(@IsActive, [IsActive]),
        [DefaultAllowParentAssignees] = ISNULL(@DefaultAllowParentAssignees, [DefaultAllowParentAssignees]),
        [IconClass] = CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, [IconClass]) END,
        [Color] = CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, [Color]) END,
        [ServerDriverClass] = CASE WHEN @ServerDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@ServerDriverClass, [ServerDriverClass]) END,
        [UIDriverClass] = CASE WHEN @UIDriverClass_Clear = 1 THEN NULL ELSE ISNULL(@UIDriverClass, [UIDriverClass]) END,
        [SpaceExtensionEntity] = CASE WHEN @SpaceExtensionEntity_Clear = 1 THEN NULL ELSE ISNULL(@SpaceExtensionEntity, [SpaceExtensionEntity]) END,
        [Configuration] = CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, [Configuration]) END,
        [DefaultInheritsMembership] = ISNULL(@DefaultInheritsMembership, [DefaultInheritsMembership]),
        [PostCloseAccess] = ISNULL(@PostCloseAccess, [PostCloseAccess]),
        [PostCloseAccessDays] = CASE WHEN @PostCloseAccessDays_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccessDays, [PostCloseAccessDays]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaceTypes] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaceTypes]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] TO [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the SpaceType table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpaceType]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpaceType];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpaceType
ON [${flyway:defaultSchema}].[SpaceType]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[SpaceType]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[SpaceType] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Space Types */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpaceType] TO [cdp_Developer], [cdp_Integration];

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
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpaceType]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceType];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpaceType]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[SpaceType]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Space Types */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpaceType] TO [cdp_Developer], [cdp_Integration];

/* Base View SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: vwSpaces
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- BASE VIEW FOR ENTITY:      MJ_BizApps_Collaboration: Spaces
-----               SCHEMA:      ${flyway:defaultSchema}
-----               BASE TABLE:  Space
-----               PRIMARY KEY: ID
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[vwSpaces]', 'V') IS NOT NULL
    DROP VIEW [${flyway:defaultSchema}].[vwSpaces];
GO

CREATE VIEW [${flyway:defaultSchema}].[vwSpaces]
AS
SELECT
    s.*,
    mjBizAppsCollaborationSpaceType_SpaceTypeID.[Name] AS [SpaceType],
    mjBizAppsCollaborationSpace_ParentID.[Name] AS [Parent],
    MJUser_OwnerID.[Name] AS [Owner],
    MJEntity_AnchorEntityID.[Name] AS [AnchorEntity]
FROM
    [${flyway:defaultSchema}].[Space] AS s
INNER JOIN
    [${flyway:defaultSchema}].[SpaceType] AS mjBizAppsCollaborationSpaceType_SpaceTypeID
  ON
    [s].[SpaceTypeID] = mjBizAppsCollaborationSpaceType_SpaceTypeID.[ID]
LEFT OUTER JOIN
    [${flyway:defaultSchema}].[Space] AS mjBizAppsCollaborationSpace_ParentID
  ON
    [s].[ParentID] = mjBizAppsCollaborationSpace_ParentID.[ID]
INNER JOIN
    [${mjSchema}].[User] AS MJUser_OwnerID
  ON
    [s].[OwnerID] = MJUser_OwnerID.[ID]
LEFT OUTER JOIN
    [${mjSchema}].[Entity] AS MJEntity_AnchorEntityID
  ON
    [s].[AnchorEntityID] = MJEntity_AnchorEntityID.[ID]
GO
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_Developer]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaces] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* Base View Permissions SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: Permissions for vwSpaces
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_Integration]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_UI]
REVOKE SELECT ON [${flyway:defaultSchema}].[vwSpaces] FROM [cdp_Developer]
GRANT SELECT ON [${flyway:defaultSchema}].[vwSpaces] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: spCreateSpace
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- CREATE PROCEDURE FOR Space
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spCreateSpace]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spCreateSpace];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spCreateSpace]
    @ID uniqueidentifier = NULL,
    @SpaceTypeID uniqueidentifier,
    @ParentID_Clear bit = 0,
    @ParentID uniqueidentifier = NULL,
    @Name nvarchar(200),
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @OwnerID uniqueidentifier,
    @InheritsMembership bit = NULL,
    @AgentRetrieval nvarchar(30) = NULL,
    @StartedAt_Clear bit = 0,
    @StartedAt datetimeoffset = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @Retention_Clear bit = 0,
    @Retention nvarchar(20) = NULL,
    @AllowParentAssignees bit = NULL,
    @PlannedCloseAt_Clear bit = 0,
    @PlannedCloseAt datetimeoffset = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Color_Clear bit = 0,
    @Color nvarchar(50) = NULL,
    @BackgroundImageURL_Clear bit = 0,
    @BackgroundImageURL nvarchar(1000) = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL,
    @AnchorEntityID_Clear bit = 0,
    @AnchorEntityID uniqueidentifier = NULL,
    @AnchorRecordID_Clear bit = 0,
    @AnchorRecordID nvarchar(450) = NULL,
    @PostCloseAccess_Clear bit = 0,
    @PostCloseAccess nvarchar(20) = NULL,
    @PostCloseAccessDays_Clear bit = 0,
    @PostCloseAccessDays int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @InsertedRow TABLE ([ID] UNIQUEIDENTIFIER)

    IF @ID IS NOT NULL
    BEGIN
        -- User provided a value, use it
        INSERT INTO [${flyway:defaultSchema}].[Space]
            (
                [ID],
                [SpaceTypeID],
                [ParentID],
                [Name],
                [Description],
                [OwnerID],
                [InheritsMembership],
                [AgentRetrieval],
                [StartedAt],
                [ClosedAt],
                [Retention],
                [AllowParentAssignees],
                [PlannedCloseAt],
                [IconClass],
                [Color],
                [BackgroundImageURL],
                [Configuration],
                [AnchorEntityID],
                [AnchorRecordID],
                [PostCloseAccess],
                [PostCloseAccessDays]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @ID,
                @SpaceTypeID,
                CASE WHEN @ParentID_Clear = 1 THEN NULL ELSE ISNULL(@ParentID, NULL) END,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @OwnerID,
                ISNULL(@InheritsMembership, 1),
                ISNULL(@AgentRetrieval, 'Included'),
                CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @Retention_Clear = 1 THEN NULL ELSE ISNULL(@Retention, NULL) END,
                ISNULL(@AllowParentAssignees, 1),
                CASE WHEN @PlannedCloseAt_Clear = 1 THEN NULL ELSE ISNULL(@PlannedCloseAt, NULL) END,
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, NULL) END,
                CASE WHEN @BackgroundImageURL_Clear = 1 THEN NULL ELSE ISNULL(@BackgroundImageURL, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END,
                CASE WHEN @AnchorEntityID_Clear = 1 THEN NULL ELSE ISNULL(@AnchorEntityID, NULL) END,
                CASE WHEN @AnchorRecordID_Clear = 1 THEN NULL ELSE ISNULL(@AnchorRecordID, NULL) END,
                CASE WHEN @PostCloseAccess_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccess, NULL) END,
                CASE WHEN @PostCloseAccessDays_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccessDays, NULL) END
            )
    END
    ELSE
    BEGIN
        -- No value provided, let database use its default (e.g., NEWSEQUENTIALID())
        INSERT INTO [${flyway:defaultSchema}].[Space]
            (
                [SpaceTypeID],
                [ParentID],
                [Name],
                [Description],
                [OwnerID],
                [InheritsMembership],
                [AgentRetrieval],
                [StartedAt],
                [ClosedAt],
                [Retention],
                [AllowParentAssignees],
                [PlannedCloseAt],
                [IconClass],
                [Color],
                [BackgroundImageURL],
                [Configuration],
                [AnchorEntityID],
                [AnchorRecordID],
                [PostCloseAccess],
                [PostCloseAccessDays]
            )
        OUTPUT INSERTED.[ID] INTO @InsertedRow
        VALUES
            (
                @SpaceTypeID,
                CASE WHEN @ParentID_Clear = 1 THEN NULL ELSE ISNULL(@ParentID, NULL) END,
                @Name,
                CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, NULL) END,
                @OwnerID,
                ISNULL(@InheritsMembership, 1),
                ISNULL(@AgentRetrieval, 'Included'),
                CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, NULL) END,
                CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, NULL) END,
                CASE WHEN @Retention_Clear = 1 THEN NULL ELSE ISNULL(@Retention, NULL) END,
                ISNULL(@AllowParentAssignees, 1),
                CASE WHEN @PlannedCloseAt_Clear = 1 THEN NULL ELSE ISNULL(@PlannedCloseAt, NULL) END,
                CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, NULL) END,
                CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, NULL) END,
                CASE WHEN @BackgroundImageURL_Clear = 1 THEN NULL ELSE ISNULL(@BackgroundImageURL, NULL) END,
                CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, NULL) END,
                CASE WHEN @AnchorEntityID_Clear = 1 THEN NULL ELSE ISNULL(@AnchorEntityID, NULL) END,
                CASE WHEN @AnchorRecordID_Clear = 1 THEN NULL ELSE ISNULL(@AnchorRecordID, NULL) END,
                CASE WHEN @PostCloseAccess_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccess, NULL) END,
                CASE WHEN @PostCloseAccessDays_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccessDays, NULL) END
            )
    END
    -- return the new record from the base view, which might have some calculated fields
    SELECT * FROM [${flyway:defaultSchema}].[vwSpaces] WHERE [ID] = (SELECT [ID] FROM @InsertedRow)
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spCreate Permissions for MJ_BizApps_Collaboration: Spaces */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spCreateSpace] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spUpdate SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: spUpdateSpace
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- UPDATE PROCEDURE FOR Space
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spUpdateSpace]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spUpdateSpace];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spUpdateSpace]
    @ID uniqueidentifier,
    @SpaceTypeID uniqueidentifier = NULL,
    @ParentID_Clear bit = 0,
    @ParentID uniqueidentifier = NULL,
    @Name nvarchar(200) = NULL,
    @Description_Clear bit = 0,
    @Description nvarchar(MAX) = NULL,
    @OwnerID uniqueidentifier = NULL,
    @InheritsMembership bit = NULL,
    @AgentRetrieval nvarchar(30) = NULL,
    @StartedAt_Clear bit = 0,
    @StartedAt datetimeoffset = NULL,
    @ClosedAt_Clear bit = 0,
    @ClosedAt datetimeoffset = NULL,
    @Retention_Clear bit = 0,
    @Retention nvarchar(20) = NULL,
    @AllowParentAssignees bit = NULL,
    @PlannedCloseAt_Clear bit = 0,
    @PlannedCloseAt datetimeoffset = NULL,
    @IconClass_Clear bit = 0,
    @IconClass nvarchar(100) = NULL,
    @Color_Clear bit = 0,
    @Color nvarchar(50) = NULL,
    @BackgroundImageURL_Clear bit = 0,
    @BackgroundImageURL nvarchar(1000) = NULL,
    @Configuration_Clear bit = 0,
    @Configuration nvarchar(MAX) = NULL,
    @AnchorEntityID_Clear bit = 0,
    @AnchorEntityID uniqueidentifier = NULL,
    @AnchorRecordID_Clear bit = 0,
    @AnchorRecordID nvarchar(450) = NULL,
    @PostCloseAccess_Clear bit = 0,
    @PostCloseAccess nvarchar(20) = NULL,
    @PostCloseAccessDays_Clear bit = 0,
    @PostCloseAccessDays int = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Space]
    SET
        [SpaceTypeID] = ISNULL(@SpaceTypeID, [SpaceTypeID]),
        [ParentID] = CASE WHEN @ParentID_Clear = 1 THEN NULL ELSE ISNULL(@ParentID, [ParentID]) END,
        [Name] = ISNULL(@Name, [Name]),
        [Description] = CASE WHEN @Description_Clear = 1 THEN NULL ELSE ISNULL(@Description, [Description]) END,
        [OwnerID] = ISNULL(@OwnerID, [OwnerID]),
        [InheritsMembership] = ISNULL(@InheritsMembership, [InheritsMembership]),
        [AgentRetrieval] = ISNULL(@AgentRetrieval, [AgentRetrieval]),
        [StartedAt] = CASE WHEN @StartedAt_Clear = 1 THEN NULL ELSE ISNULL(@StartedAt, [StartedAt]) END,
        [ClosedAt] = CASE WHEN @ClosedAt_Clear = 1 THEN NULL ELSE ISNULL(@ClosedAt, [ClosedAt]) END,
        [Retention] = CASE WHEN @Retention_Clear = 1 THEN NULL ELSE ISNULL(@Retention, [Retention]) END,
        [AllowParentAssignees] = ISNULL(@AllowParentAssignees, [AllowParentAssignees]),
        [PlannedCloseAt] = CASE WHEN @PlannedCloseAt_Clear = 1 THEN NULL ELSE ISNULL(@PlannedCloseAt, [PlannedCloseAt]) END,
        [IconClass] = CASE WHEN @IconClass_Clear = 1 THEN NULL ELSE ISNULL(@IconClass, [IconClass]) END,
        [Color] = CASE WHEN @Color_Clear = 1 THEN NULL ELSE ISNULL(@Color, [Color]) END,
        [BackgroundImageURL] = CASE WHEN @BackgroundImageURL_Clear = 1 THEN NULL ELSE ISNULL(@BackgroundImageURL, [BackgroundImageURL]) END,
        [Configuration] = CASE WHEN @Configuration_Clear = 1 THEN NULL ELSE ISNULL(@Configuration, [Configuration]) END,
        [AnchorEntityID] = CASE WHEN @AnchorEntityID_Clear = 1 THEN NULL ELSE ISNULL(@AnchorEntityID, [AnchorEntityID]) END,
        [AnchorRecordID] = CASE WHEN @AnchorRecordID_Clear = 1 THEN NULL ELSE ISNULL(@AnchorRecordID, [AnchorRecordID]) END,
        [PostCloseAccess] = CASE WHEN @PostCloseAccess_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccess, [PostCloseAccess]) END,
        [PostCloseAccessDays] = CASE WHEN @PostCloseAccessDays_Clear = 1 THEN NULL ELSE ISNULL(@PostCloseAccessDays, [PostCloseAccessDays]) END
    WHERE
        [ID] = @ID

    -- Check if the update was successful
    IF @@ROWCOUNT = 0
        -- Nothing was updated, return no rows, but column structure from base view intact, semantically correct this way.
        SELECT TOP 0 * FROM [${flyway:defaultSchema}].[vwSpaces] WHERE 1=0
    ELSE
        -- Return the updated record so the caller can see the updated values and any calculated fields
        SELECT
                                        *
                                    FROM
                                        [${flyway:defaultSchema}].[vwSpaces]
                                    WHERE
                                        [ID] = @ID
                                    
END
GO

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] TO [cdp_UI], [cdp_Developer], [cdp_Integration]
GO

------------------------------------------------------------
----- TRIGGER FOR __mj_UpdatedAt field for the Space table
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[trgUpdateSpace]', 'TR') IS NOT NULL
    DROP TRIGGER [${flyway:defaultSchema}].[trgUpdateSpace];
GO
CREATE TRIGGER [${flyway:defaultSchema}].trgUpdateSpace
ON [${flyway:defaultSchema}].[Space]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE
        [${flyway:defaultSchema}].[Space]
    SET
        __mj_UpdatedAt = GETUTCDATE()
    FROM
        [${flyway:defaultSchema}].[Space] AS _organicTable
    INNER JOIN
        INSERTED AS I ON
        _organicTable.[ID] = I.[ID];
END;
GO

/* spUpdate Permissions for MJ_BizApps_Collaboration: Spaces */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_Integration]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] FROM [cdp_UI]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spUpdateSpace] TO [cdp_UI], [cdp_Developer], [cdp_Integration];

/* spDelete SQL for MJ_BizApps_Collaboration: Spaces */
-----------------------------------------------------------------
-- SQL Code Generation
-- Entity: MJ_BizApps_Collaboration: Spaces
-- Item: spDeleteSpace
--
-- This was generated by the MemberJunction CodeGen tool.
-- This file should NOT be edited by hand.
-----------------------------------------------------------------

------------------------------------------------------------
----- DELETE PROCEDURE FOR Space
------------------------------------------------------------
IF OBJECT_ID('[${flyway:defaultSchema}].[spDeleteSpace]', 'P') IS NOT NULL
    DROP PROCEDURE [${flyway:defaultSchema}].[spDeleteSpace];
GO

CREATE PROCEDURE [${flyway:defaultSchema}].[spDeleteSpace]
    @ID uniqueidentifier
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM
        [${flyway:defaultSchema}].[Space]
    WHERE
        [ID] = @ID


    -- Check if the delete was successful
    IF @@ROWCOUNT = 0
        SELECT NULL AS [ID] -- Return NULL for all primary key fields to indicate no record was deleted
    ELSE
        SELECT @ID AS [ID] -- Return the primary key values to indicate we successfully deleted the record
END
GO
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] TO [cdp_Developer], [cdp_Integration];

/* spDelete Permissions for MJ_BizApps_Collaboration: Spaces */

REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] FROM [cdp_Developer]
REVOKE EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] FROM [cdp_Integration]
GRANT EXECUTE ON [${flyway:defaultSchema}].[spDeleteSpace] TO [cdp_Developer], [cdp_Integration];

/* SQL text to delete unneeded entity fields (7 scoped entities) */
EXEC [${mjSchema}].[spDeleteUnneededEntityFields] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='75E3ED25-C46B-45C1-96F7-91578D88DBE2,BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3,56476128-C105-4118-A722-AF72F81A7960,157106BD-1938-4EEF-8798-05BAF047DFD2,01596359-EC4B-449C-BA16-316DE4B92A4E,3648DC35-1DC4-4ED6-A1A6-5D87271A54DB,BFEB0850-AB22-4DCC-B13C-B82DC998E23C', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to insert 13 new entity field(s) */

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'e991a897-eb3d-4032-b583-ee09eeaf4dbe' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = 'ContentSource')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'e991a897-eb3d-4032-b583-ee09eeaf4dbe',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            'ContentSource',
            'Content Source',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'ecd765ea-3b0e-428d-94f1-b905205aac4f' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = 'SpaceType')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'ecd765ea-3b0e-428d-94f1-b905205aac4f',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            'SpaceType',
            'Space Type',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '492ef5df-894d-4cdf-891e-41e177d413b0' OR (EntityID = '157106BD-1938-4EEF-8798-05BAF047DFD2' AND Name = 'Space')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '492ef5df-894d-4cdf-891e-41e177d413b0',
            '157106BD-1938-4EEF-8798-05BAF047DFD2', -- Entity: MJ_BizApps_Collaboration: Space Knowledge Sources
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '157106BD-1938-4EEF-8798-05BAF047DFD2'),
            'Space',
            'Space',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '251db325-12e0-47b6-954a-07001f74ea2e' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = 'Skill')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '251db325-12e0-47b6-954a-07001f74ea2e',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            'Skill',
            'Skill',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '382565d7-3fc5-4d33-a2dd-a71e115da62d' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = 'SpaceType')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '382565d7-3fc5-4d33-a2dd-a71e115da62d',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            'SpaceType',
            'Space Type',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '1cd9c8c7-c317-4ca7-afd3-2528bc7d4fa5' OR (EntityID = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3' AND Name = 'Space')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '1cd9c8c7-c317-4ca7-afd3-2528bc7d4fa5',
            'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3', -- Entity: MJ_BizApps_Collaboration: Space Agent Skills
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3'),
            'Space',
            'Space',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '562139c5-e1cb-4461-b86d-b33e0d591c01' OR (EntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB' AND Name = 'AnchorEntity')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '562139c5-e1cb-4461-b86d-b33e0d591c01',
            '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB', -- Entity: MJ_BizApps_Collaboration: Spaces
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'),
            'AnchorEntity',
            'Anchor Entity',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '8419b7ce-f8ad-4f4c-9185-9bec254528cd' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'Space')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '8419b7ce-f8ad-4f4c-9185-9bec254528cd',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'Space',
            'Space',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            0,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '95383dc4-b9c3-4549-8104-86289e1da95b' OR (EntityID = '75E3ED25-C46B-45C1-96F7-91578D88DBE2' AND Name = 'Conversation')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '95383dc4-b9c3-4549-8104-86289e1da95b',
            '75E3ED25-C46B-45C1-96F7-91578D88DBE2', -- Entity: MJ_BizApps_Collaboration: Space Chats
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '75E3ED25-C46B-45C1-96F7-91578D88DBE2'),
            'Conversation',
            'Conversation',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '2b77bb37-b86b-4730-a91b-59a017680a77' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = 'Agent')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '2b77bb37-b86b-4730-a91b-59a017680a77',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            'Agent',
            'Agent',
            NULL,
            'nvarchar',
            510,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = 'c0f97e7a-5430-4107-8e54-5727b445ae11' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = 'SpaceType')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            'c0f97e7a-5430-4107-8e54-5727b445ae11',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            'SpaceType',
            'Space Type',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '51db9e75-5874-4cb0-91f8-cb908c4f667d' OR (EntityID = '56476128-C105-4118-A722-AF72F81A7960' AND Name = 'Space')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '51db9e75-5874-4cb0-91f8-cb908c4f667d',
            '56476128-C105-4118-A722-AF72F81A7960', -- Entity: MJ_BizApps_Collaboration: Space Agents
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = '56476128-C105-4118-A722-AF72F81A7960'),
            'Space',
            'Space',
            NULL,
            'nvarchar',
            400,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

      IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[EntityField] WHERE ID = '92472eea-8e63-4413-be93-3109ed25c76b' OR (EntityID = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C' AND Name = 'Person')) BEGIN
         INSERT INTO [${mjSchema}].[EntityField]
         (
            [ID],
            [EntityID],
            [Sequence],
            [Name],
            [DisplayName],
            [Description],
            [Type],
            [Length],
            [Precision],
            [Scale],
            [AllowsNull],
            [DefaultValue],
            [AutoIncrement],
            [AllowUpdateAPI],
            [IsVirtual],
            [IsComputed],
            [RelatedEntityID],
            [RelatedEntityFieldName],
            [IsNameField],
            [IncludeInUserSearchAPI],
            [IncludeRelatedEntityNameFieldInBaseView],
            [DefaultInView],
            [IsPrimaryKey],
            [IsUnique],
            [RelatedEntityDisplayType],
            [__mj_CreatedAt],
            [__mj_UpdatedAt]
         )
         VALUES
         (
            '92472eea-8e63-4413-be93-3109ed25c76b',
            'BFEB0850-AB22-4DCC-B13C-B82DC998E23C', -- Entity: MJ_BizApps_Collaboration: Space Members
            (SELECT COALESCE(MAX([Sequence]), 0) + 1 FROM [${mjSchema}].[EntityField] WHERE [EntityID] = 'BFEB0850-AB22-4DCC-B13C-B82DC998E23C'),
            'Person',
            'Person',
            NULL,
            'nvarchar',
            402,
            0,
            0,
            1,
            NULL,
            0,
            0,
            1,
            0,
            NULL,
            NULL,
            0,
            0,
            0,
            0,
            0,
            0,
            'Search',
            GETUTCDATE(),
            GETUTCDATE()
         )
      END;

/* SQL text to update existing entity fields from schema (7 scoped entities) */
EXEC [${mjSchema}].[spUpdateExistingEntityFieldsFromSchema] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @EntityIDs='75E3ED25-C46B-45C1-96F7-91578D88DBE2,BDE57E94-891D-4948-AB8D-3A7CBDCFF4E3,56476128-C105-4118-A722-AF72F81A7960,157106BD-1938-4EEF-8798-05BAF047DFD2,01596359-EC4B-449C-BA16-316DE4B92A4E,3648DC35-1DC4-4ED6-A1A6-5D87271A54DB,BFEB0850-AB22-4DCC-B13C-B82DC998E23C', @IncludedSchemaNames='${flyway:defaultSchema}';

/* SQL text to set default column width where needed */
EXEC [${mjSchema}].[spSetDefaultColumnWidthWhereNeeded] @ExcludedSchemaNames='sys,staging,dbo,${mjSchema}', @IncludedSchemaNames='${flyway:defaultSchema}';

