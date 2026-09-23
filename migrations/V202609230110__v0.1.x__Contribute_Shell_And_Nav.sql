-- =============================================================================
-- Contribute flag, client roles, shell grants that are not empty, and the nav item.
--
-- CanContribute is the read/write tier. Guest stays false. Client admin can
-- invite without the team band. Client member can add material without inviting.
--
-- The blanket 1 = 0 grant from the previous migration is replaced for the
-- shell rows a participant must actually read. Application Roles uses (1 = 1),
-- a present filter, so the role is not exempt from row-level security.
-- Re-running the INSERT at the bottom is safe: NOT EXISTS skips rows that exist.
-- A later MJ upgrade needs that statement run again. It is repeated here as the
-- procedure a host can re-apply.
-- =============================================================================

IF COL_LENGTH('${flyway:defaultSchema}.SpaceRoleType', 'CanContribute') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType]
        ADD CanContribute BIT NOT NULL CONSTRAINT DF_SpaceRoleType_CanContribute DEFAULT (0);
GO

UPDATE [${flyway:defaultSchema}].[SpaceRoleType]
SET CanContribute = 1
WHERE Code IN (N'owner', N'admin', N'member');
GO

IF NOT EXISTS (SELECT 1 FROM [${flyway:defaultSchema}].[SpaceRoleType] WHERE ID = 'B2000001-0000-4000-8000-000000000005')
    INSERT INTO [${flyway:defaultSchema}].[SpaceRoleType]
        (ID, Code, Name, Level, MaxGrantableLevel, CanInvite, CanPromoteBand, CanSeeTeamBand, IsOwnerRole, CanContribute)
    VALUES
        ('B2000001-0000-4000-8000-000000000005', N'client-admin', N'Client admin', 20, 10, 1, 0, 0, 0, 1),
        ('B2000001-0000-4000-8000-000000000006', N'client-member', N'Client member', 10, 0, 0, 0, 0, 0, 1);
GO

EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'Team or Shared. Set by the server from the role: CanSeeTeamBand seats the person on Team, otherwise Shared. The filter reads the role, not this column.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'SpaceMember',
    @level2type = N'COLUMN', @level2name = N'Band';
GO

EXEC sp_updateextendedproperty @name = N'MS_Description',
    @value = N'Approve: a new member stays Invited until an owner of the space sets them Active. AutoApprove: the server creates the member Active. The invited person does not activate themselves.',
    @level0type = N'SCHEMA', @level0name = N'${flyway:defaultSchema}',
    @level1type = N'TABLE', @level1name = N'SpaceType',
    @level2type = N'COLUMN', @level2name = N'InviteApproval';
GO

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000002')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000002', N'Collaboration: Own User', N'The caller''s own user row.', N'(ID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))');
GO
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000003')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000003', N'Collaboration: Own User Child', N'Rows owned by the caller, keyed UserID.', N'(UserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))');
GO
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000004')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000004', N'Collaboration: All Application Roles', N'Application role rows name which role may open which app. The filter is present so the participant is not exempt from row-level security.', N'(1 = 1)');
GO
IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000005')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000005', N'Collaboration: Conversations In Reach', N'Conversations bound to a space the caller reaches.', N'(LinkedEntityID = ''3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'' AND LinkedRecordID IN (SELECT CONVERT(nvarchar(36), SpaceID) FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER))))');
GO

UPDATE p
SET p.ReadRLSFilterID = f.FilterID
FROM [${mjSchema}].[EntityPermission] AS p
INNER JOIN [${mjSchema}].[Entity] AS e ON e.ID = p.EntityID
INNER JOIN (VALUES
    (N'MJ: Users', 'C0FFEE00-0000-4000-8000-000000000002'),
    (N'MJ: User Roles', 'C0FFEE00-0000-4000-8000-000000000003'),
    (N'MJ: User Applications', 'C0FFEE00-0000-4000-8000-000000000003'),
    (N'MJ: User Settings', 'C0FFEE00-0000-4000-8000-000000000003'),
    (N'MJ: Application Roles', 'C0FFEE00-0000-4000-8000-000000000004'),
    (N'MJ: Conversations', 'C0FFEE00-0000-4000-8000-000000000005'),
    (N'MJ: Files', 'C0FFEE00-0000-4000-8000-000000000003')
) AS f(EntityName, FilterID) ON f.EntityName = e.Name
WHERE p.RoleID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
GO

-- Repeatable. A core entity added by a later MJ upgrade gets an empty read
-- until this statement is applied again. NOT EXISTS keeps it safe to re-run.
INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
SELECT NEWID(), e.ID, 'AAF434FD-EF58-4857-854E-2607ACAF763B', 0, 1, 0, 0, 'C0FFEE00-0000-4000-8000-000000000001', N'Allow'
FROM [${mjSchema}].[Entity] AS e
WHERE e.SchemaName = N'${mjSchema}'
  AND NOT EXISTS (
      SELECT 1 FROM [${mjSchema}].[EntityPermission] AS p
      WHERE p.EntityID = e.ID AND p.RoleID = 'AAF434FD-EF58-4857-854E-2607ACAF763B'
  );
GO

UPDATE [${mjSchema}].[Application]
SET Name = N'Collaboration',
    Description = N'Spaces for client, committee, and cohort work.',
    Icon = N'fa-solid fa-people-group',
    DefaultNavItems = N'[{"Label":"Spaces","Icon":"fa-solid fa-people-group","ResourceType":"Custom","DriverClass":"CollaborationSectionResource","isDefault":true}]'
WHERE ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';
GO
