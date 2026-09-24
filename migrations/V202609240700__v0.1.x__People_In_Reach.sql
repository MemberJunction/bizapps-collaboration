-- Space Participant can read the People they might assign or see named on a
-- task: their own person, and people linked to a user with an active seat on
-- a space they reach. The row still includes email, phone, date of birth and
-- gender. Field permissions are not narrowed.

DECLARE @People uniqueidentifier;
SELECT @People = ID FROM [${mjSchema}].[Entity] WHERE Name = N'MJ_BizApps_Common: People';
IF @People IS NULL
    THROW 50000, 'MJ_BizApps_Common: People is not installed.', 1;

DECLARE @Filter nvarchar(max) = N'(LinkedUserID = TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER) OR LinkedUserID IN (SELECT m.UserID FROM [${flyway:defaultSchema}].[SpaceMember] AS m WHERE m.Status = N''Active'' AND m.SpaceID IN (SELECT SpaceID FROM [${flyway:defaultSchema}].[fnCollaborationAccess](TRY_CAST(''{{UserID}}'' AS UNIQUEIDENTIFIER)))))';

IF NOT EXISTS (SELECT 1 FROM [${mjSchema}].[RowLevelSecurityFilter] WHERE ID = 'C0FFEE00-0000-4000-8000-000000000021')
    INSERT INTO [${mjSchema}].[RowLevelSecurityFilter] (ID, Name, Description, FilterText)
    VALUES ('C0FFEE00-0000-4000-8000-000000000021', N'Collaboration: People In Reach', N'The caller''s own person, and people linked to a user with an active seat on a space the caller reaches.', @Filter);
ELSE
    UPDATE [${mjSchema}].[RowLevelSecurityFilter]
    SET Name = N'Collaboration: People In Reach',
        Description = N'The caller''s own person, and people linked to a user with an active seat on a space the caller reaches.',
        FilterText = @Filter
    WHERE ID = 'C0FFEE00-0000-4000-8000-000000000021';

DECLARE @Participant uniqueidentifier = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
DECLARE @FilterId uniqueidentifier = 'C0FFEE00-0000-4000-8000-000000000021';

UPDATE p
SET p.CanCreate = 0,
    p.CanRead = 1,
    p.CanUpdate = 0,
    p.CanDelete = 0,
    p.ReadRLSFilterID = @FilterId,
    p.CreateRLSFilterID = NULL,
    p.UpdateRLSFilterID = NULL,
    p.DeleteRLSFilterID = NULL
FROM [${mjSchema}].[EntityPermission] AS p
WHERE p.EntityID = @People AND p.RoleID = @Participant;

INSERT INTO [${mjSchema}].[EntityPermission] (ID, EntityID, RoleID, CanCreate, CanRead, CanUpdate, CanDelete, ReadRLSFilterID, Type)
SELECT NEWID(), @People, @Participant, 0, 1, 0, 0, @FilterId, N'Allow'
WHERE NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission] AS p
    WHERE p.EntityID = @People AND p.RoleID = @Participant
);

IF NOT EXISTS (
    SELECT 1 FROM [${mjSchema}].[EntityPermission]
    WHERE EntityID = @People AND RoleID = @Participant
      AND CanRead = 1 AND CanCreate = 0 AND CanUpdate = 0 AND CanDelete = 0
      AND ReadRLSFilterID = @FilterId
)
    THROW 50000, 'Space Participant is missing the filtered People read.', 1;
GO
