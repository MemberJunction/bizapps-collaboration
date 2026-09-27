-- Phase 0 pilot rows. Not a shipped migration.
-- Set the four user ids, then run. @Commit = 0 rolls back. @Commit = 1 keeps the rows.
SET XACT_ABORT ON;
BEGIN TRAN;

DECLARE @Commit bit = 0;
DECLARE @Ada uniqueidentifier = NULL;       -- staff owner
DECLARE @Bea uniqueidentifier = NULL;       -- client on Discovery
DECLARE @Director uniqueidentifier = NULL;  -- outside director
DECLARE @Learner uniqueidentifier = NULL;   -- cohort learner
IF @Ada IS NULL OR @Bea IS NULL OR @Director IS NULL OR @Learner IS NULL
    THROW 50000, 'Set @Ada, @Bea, @Director and @Learner to real user ids before running.', 1;

DECLARE @Workspace uniqueidentifier = (SELECT TOP 1 ID FROM __mj_BizAppsCollaboration.SpaceType WHERE Code = 'workspace');
DECLARE @Committee uniqueidentifier = COALESCE((SELECT TOP 1 ID FROM __mj_BizAppsCollaboration.SpaceType WHERE Code = 'world-committee'), (SELECT TOP 1 ID FROM __mj_BizAppsCollaboration.SpaceType WHERE Code = 'committee'), @Workspace);
DECLARE @Cohort uniqueidentifier = (SELECT TOP 1 ID FROM __mj_BizAppsCollaboration.SpaceType WHERE Code = 'cohort');
DECLARE @Owner uniqueidentifier = (SELECT TOP 1 ID FROM __mj_BizAppsCollaboration.SpaceRoleType WHERE Code = 'owner');
DECLARE @Guest uniqueidentifier = (SELECT TOP 1 ID FROM __mj_BizAppsCollaboration.SpaceRoleType WHERE Code = 'guest');
DECLARE @ClientMember uniqueidentifier = (SELECT TOP 1 ID FROM __mj_BizAppsCollaboration.SpaceRoleType WHERE Code = 'client-member');
DECLARE @Engagement uniqueidentifier = NEWID();
DECLARE @Discovery uniqueidentifier = NEWID();
DECLARE @CommitteeSpace uniqueidentifier = NEWID();
DECLARE @CohortSpace uniqueidentifier = NEWID();

INSERT INTO __mj_BizAppsCollaboration.Space (ID, SpaceTypeID, Name, OwnerID, InheritsMembership, AgentRetrieval)
VALUES
    (@Engagement, @Workspace, N'Northwind engagement', @Ada, 1, N'Included'),
    (@Discovery, @Workspace, N'Discovery', @Ada, 1, N'Included'),
    (@CommitteeSpace, @Committee, N'Audit committee', @Ada, 1, N'Included'),
    (@CohortSpace, @Cohort, N'2026 cohort', @Ada, 1, N'Included');
UPDATE __mj_BizAppsCollaboration.Space SET ParentID = @Engagement WHERE ID = @Discovery;

INSERT INTO __mj_BizAppsCollaboration.SpaceMember (SpaceID, UserID, SpaceRoleTypeID, Band, Status)
VALUES
    (@Engagement, @Ada, @Owner, N'Team', N'Active'),
    (@Discovery, @Bea, @Guest, N'Shared', N'Active'),
    (@CommitteeSpace, @Ada, @Owner, N'Team', N'Active'),
    (@CommitteeSpace, @Director, @Guest, N'Shared', N'Active'),
    (@CohortSpace, @Ada, @Owner, N'Team', N'Active'),
    (@CohortSpace, @Learner, @ClientMember, N'Shared', N'Active');

DECLARE @FileEntity uniqueidentifier = (SELECT ID FROM __mj.Entity WHERE Name = N'MJ: Files');
INSERT INTO __mj_BizAppsCollaboration.SpaceItem (SpaceID, EntityID, RecordID, Band, PromotedAt, PromotedByUserID)
VALUES
    (@Discovery, @FileEntity, N'ID|' + CONVERT(nvarchar(36), NEWID()), N'Shared', SYSUTCDATETIME(), @Ada),
    (@Discovery, @FileEntity, N'ID|' + CONVERT(nvarchar(36), NEWID()), N'Team', NULL, NULL);

IF (SELECT COUNT(*) FROM __mj_BizAppsCollaboration.fnCollaborationAccess(@Bea) WHERE SpaceID = @CommitteeSpace) <> 0
    THROW 50000, 'The client reached the committee.', 1;
IF (SELECT COUNT(*) FROM __mj_BizAppsCollaboration.fnCollaborationAccess(@Director) WHERE SpaceID = @Discovery) <> 0
    THROW 50000, 'The director reached Discovery.', 1;

IF @Commit = 1 COMMIT TRAN; ELSE ROLLBACK TRAN;
