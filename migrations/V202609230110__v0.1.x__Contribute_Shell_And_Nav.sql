-- =============================================================================
-- SpaceRoleType.CanContribute column and extended properties.
--
-- CanContribute is the read/write tier.
-- Roles, permissions, filters, and application navigation live under metadata/
-- and are applied with mj sync push.
-- =============================================================================

IF COL_LENGTH('${flyway:defaultSchema}.SpaceRoleType', 'CanContribute') IS NULL
    ALTER TABLE [${flyway:defaultSchema}].[SpaceRoleType]
        ADD CanContribute BIT NOT NULL CONSTRAINT DF_SpaceRoleType_CanContribute DEFAULT (0);
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
