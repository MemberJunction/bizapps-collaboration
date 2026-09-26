import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationShareNoticeEntity,
    mjBizAppsCollaborationItemUseEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    SPACE_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_TYPE_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    SHARE_NOTICE_ENTITY,
    ITEM_USE_ENTITY,
    TASK_ENTITY,
} from '../../entity-names.js';
import { mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
import { FindRows, getPersonaContext } from '../../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';

const checks: NamedCheck[] = [
    {
        Id: 'write-gates.WG1',
        Name: 'WG1 — space write gates: cycle detection and participant root creation refused over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');

            const [workspaceType] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'workspace'", ['ID']);
            Assert(Boolean(workspaceType?.ID), 'Expected Workspace space type to exist');

            // 1. Participant (Bea) creating a root space (ParentID = null) is refused
            const rootAttempt = await beaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, beaCtx.User);
            rootAttempt.NewRecord();
            rootAttempt.Name = 'Bea Root Space';
            rootAttempt.OwnerID = beaCtx.User.ID;
            rootAttempt.SpaceTypeID = workspaceType.ID;
            rootAttempt.ParentID = null;

            const savedRoot = await rootAttempt.Save();
            if (savedRoot) {
                let undoError: string | null = null;
                try {
                    const adminSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                    if (await adminSpace.Load(rootAttempt.ID)) {
                        const deleted = await adminSpace.Delete();
                        if (!deleted) undoError = adminSpace.LatestResult?.CompleteMessage ?? 'Delete returned false';
                    }
                } catch (ue) {
                    undoError = ue instanceof Error ? ue.message : String(ue);
                }
                const msg = 'Participant creating root space must be refused over the wire' +
                    (undoError ? ` AND undo as system user also failed: ${undoError}` : '');
                Assert(false, msg);
            }
            Assert(!savedRoot, 'Participant creating root space must be refused over the wire');
            const rootReason = rootAttempt.LatestResult?.CompleteMessage ?? '';
            Assert(
                rootReason.includes('Space change refused: only a staff user may create a root, and they must own it.'),
                `Expected root space refusal message, got: ${rootReason}`,
            );

            // 2. Cycle detection: moving Northwind under Discovery (its own child)
            const space = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await space.Load(NORTHWIND_SPACE_ID), 'Load Northwind space');
            space.ParentID = DISCOVERY_SPACE_ID;

            const savedCycle = await space.Save();
            if (savedCycle) {
                let undoError: string | null = null;
                try {
                    const adminSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                    if (await adminSpace.Load(space.ID)) {
                        adminSpace.ParentID = null;
                        const reverted = await adminSpace.Save();
                        if (!reverted) undoError = adminSpace.LatestResult?.CompleteMessage ?? 'Save returned false';
                    }
                } catch (ue) {
                    undoError = ue instanceof Error ? ue.message : String(ue);
                }
                const msg = 'Moving space under its own descendant must fail save over the wire' +
                    (undoError ? ` AND undo as system user also failed: ${undoError}` : '');
                Assert(false, msg);
            }
            Assert(!savedCycle, 'Moving space under its own descendant must fail save over the wire');
            const cycleReason = space.LatestResult?.CompleteMessage ?? '';
            Assert(
                cycleReason.includes('would put the space inside its own subtree'),
                `Expected cycle message, got: ${cycleReason}`,
            );
        },
    },
    {
        Id: 'write-gates.WG2',
        Name: 'WG2 — member write gates: immutable Space/User, last owner protection over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');

            // 1. Find Ada's owner seat on Northwind
            const seats = await FindRows<{ ID: string; SpaceID: string; UserID: string; SpaceRoleTypeID: string }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                `SpaceID = '${NORTHWIND_SPACE_ID}' AND UserID = '${adaCtx.User.ID}'`,
                ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID'],
            );
            Assert(seats.length === 1, 'Ada seat found on Northwind');

            const member = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, adaCtx.User);
            Assert(await member.Load(seats[0].ID), 'Load Ada seat');

            // Attempt to change SpaceID on saved membership
            member.SpaceID = DISCOVERY_SPACE_ID;
            const savedSpace = await member.Save();
            if (savedSpace) {
                let undoError: string | null = null;
                try {
                    const adminMember = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ctx.User);
                    if (await adminMember.Load(member.ID)) {
                        adminMember.SpaceID = NORTHWIND_SPACE_ID;
                        const reverted = await adminMember.Save();
                        if (!reverted) undoError = adminMember.LatestResult?.CompleteMessage ?? 'Save returned false';
                    }
                } catch (ue) {
                    undoError = ue instanceof Error ? ue.message : String(ue);
                }
                const msg = 'Changing SpaceID on saved membership must fail over the wire' +
                    (undoError ? ` AND undo as system user also failed: ${undoError}` : '');
                Assert(false, msg);
            }
            Assert(!savedSpace, 'Changing SpaceID on saved membership must fail over the wire');
            const spaceReason = member.LatestResult?.CompleteMessage ?? '';
            Assert(
                spaceReason.includes('stays on the space and the person'),
                `Expected immutable seat message, got: ${spaceReason}`,
            );

            // Reload and attempt to remove last owner
            await member.Load(seats[0].ID);
            member.Status = 'Removed';
            const savedStrand = await member.Save();
            if (savedStrand) {
                let undoError: string | null = null;
                try {
                    const adminMember = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ctx.User);
                    if (await adminMember.Load(member.ID)) {
                        adminMember.Status = 'Active';
                        const reverted = await adminMember.Save();
                        if (!reverted) undoError = adminMember.LatestResult?.CompleteMessage ?? 'Save returned false';
                    }
                } catch (ue) {
                    undoError = ue instanceof Error ? ue.message : String(ue);
                }
                const msg = 'Removing last active owner must fail save over the wire' +
                    (undoError ? ` AND undo as system user also failed: ${undoError}` : '');
                Assert(false, msg);
            }
            Assert(!savedStrand, 'Removing last active owner must fail save over the wire');
            const strandReason = member.LatestResult?.CompleteMessage ?? '';
            Assert(
                strandReason.includes('last owner of this space'),
                `Expected last owner message, got: ${strandReason}`,
            );

            // 3. B0.1: Casey (client-admin on Northwind, ceiling 10) removing Sam (member, level 20) is refused; Ada (owner) removing Sam succeeds over the wire
            const caseyCtx = await getPersonaContext(ctx, 'casey');
            const samCtx = await getPersonaContext(ctx, 'sam');

            const samSeats = await FindRows<{ ID: string }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                `SpaceID = '${NORTHWIND_SPACE_ID}' AND UserID = '${samCtx.User.ID}'`,
                ['ID'],
            );
            Assert(samSeats.length === 1, 'Sam seat found on Northwind');
            const samSeatId = samSeats[0].ID;
            // 3. B0.1: Casey (client-admin on Northwind, ceiling 10) sets Sam's seat (member, level 20) to client-member and Removed
            const clientMemberRoles = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ROLE_TYPE_ENTITY,
                "Code = 'client-member'",
                ['ID'],
            );
            Assert(clientMemberRoles.length === 1, 'client-member role found');
            const clientMemberRoleId = clientMemberRoles[0].ID;

            const caseyMember = await caseyCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, caseyCtx.User);
            Assert(await caseyMember.Load(samSeatId), 'Load Sam seat as Casey');
            caseyMember.SpaceRoleTypeID = clientMemberRoleId;
            caseyMember.Status = 'Removed';
            const savedCaseyRemove = await caseyMember.Save();
            Assert(!savedCaseyRemove, 'Casey removing Sam must fail save over the wire due to role ceiling');
            const caseyReason = caseyMember.LatestResult?.CompleteMessage ?? '';
            Assert(
                caseyReason.includes('Invite refused: that role is above the level this member may grant.'),
                `Expected exact role ceiling refusal message over the wire, got: ${caseyReason}`,
            );

            // Ada (owner, ceiling >= 20) removes Sam
            const adaSamMember = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, adaCtx.User);
            Assert(await adaSamMember.Load(samSeatId), 'Load Sam seat as Ada');
            adaSamMember.Status = 'Removed';
            const savedAdaRemove = await adaSamMember.Save();
            Assert(savedAdaRemove, `Ada removing Sam must succeed over the wire, got error: ${adaSamMember.LatestResult?.CompleteMessage ?? ''}`);

            // Undo: Revert Sam back to Active
            adaSamMember.Status = 'Active';
            const revertedSam = await adaSamMember.Save();
            Assert(revertedSam, `Reverting Sam back to Active must succeed over the wire: ${adaSamMember.LatestResult?.CompleteMessage ?? ''}`);
        },
    },
    {
        Id: 'write-gates.WG3',
        Name: 'WG3 — item write gates: valid space/signer, subtask cannot be filed as space root over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const harperCtx = await getPersonaContext(ctx, 'harper');

            const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
            Assert(!!taskEntity, 'Task entity found');
            if (!taskEntity) throw new Error('Task entity found');

            // 1. Find a subtask in Discovery
            const subtaskRows = await FindRows<{ ID: string; ParentID: string }>(
                ctx,
                TASK_ENTITY,
                `ParentID IS NOT NULL`,
                ['ID', 'ParentID'],
            );
            Assert(subtaskRows.length > 0, 'Subtask found');
            const subtaskId = subtaskRows[0].ID;

            // Attempt to file this subtask directly as a SpaceItem
            const subtaskItem = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, adaCtx.User);
            subtaskItem.NewRecord();
            subtaskItem.SpaceID = DISCOVERY_SPACE_ID;
            subtaskItem.EntityID = taskEntity.ID;
            subtaskItem.RecordID = `ID|${subtaskId}`;
            subtaskItem.Band = 'Shared';

            const savedSubtask = await subtaskItem.Save();
            Assert(!savedSubtask, 'Filing subtask as space item must fail save over the wire');
            const subtaskReason = subtaskItem.LatestResult?.CompleteMessage ?? '';
            Assert(
                subtaskReason.includes('Item change refused: a subtask cannot be filed as a space root.'),
                `Expected subtask space root refusal, got: ${subtaskReason}`,
            );

            // 2. Signer outside space (Harper) attempting to place item in Discovery
            const harperItem = await harperCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, harperCtx.User);
            harperItem.NewRecord();
            harperItem.SpaceID = DISCOVERY_SPACE_ID;
            harperItem.EntityID = taskEntity.ID;
            harperItem.RecordID = `ID|${subtaskRows[0].ParentID}`;
            harperItem.Band = 'Shared';

            const savedHarper = await harperItem.Save();
            Assert(!savedHarper, 'Harper saving item in Discovery must fail save over the wire');
            const harperReason = harperItem.LatestResult?.CompleteMessage ?? '';
            Assert(
                harperReason.includes('Item change refused: the signer does not reach this space.'),
                `Expected signer does not reach space refusal, got: ${harperReason}`,
            );

            // 3. B0.3: Over the wire as participant Bea:
            // - a subtask under a Team task is refused
            // - a subtask under a task in a space she doesn't reach is refused
            // - a subtask under a writable Shared task is accepted
            const beaCtx = await getPersonaContext(ctx, 'bea');

            // Find Discovery Shared task (e.g. Discovery plan)
            const sharedTaskItems = await FindRows<{ RecordID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${taskEntity.ID}' AND Band = 'Shared'`,
                ['RecordID'],
            );
            Assert(sharedTaskItems.length > 0, 'Discovery shared task item found');
            const sharedTaskId = sharedTaskItems[0].RecordID.replace(/^ID\|/i, '');

            // Find Discovery Team task (e.g. Internal prep)
            const teamTaskItems = await FindRows<{ RecordID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${taskEntity.ID}' AND Band = 'Team'`,
                ['RecordID'],
            );
            Assert(teamTaskItems.length > 0, 'Discovery team task item found');
            const teamTaskId = teamTaskItems[0].RecordID.replace(/^ID\|/i, '');

            // Find unreachable task in Committee space (C1000001-0000-4000-8000-000000000004)
            const unreachableTaskItems = await FindRows<{ RecordID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = 'C1000001-0000-4000-8000-000000000004' AND EntityID = '${taskEntity.ID}'`,
                ['RecordID'],
            );
            Assert(unreachableTaskItems.length > 0, 'Unreachable committee task item found');
            const unreachableTaskId = unreachableTaskItems[0].RecordID.replace(/^ID\|/i, '');

            // 3a. Bea creating a subtask under Team task is refused
            const subUnderTeam = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
            subUnderTeam.NewRecord();
            subUnderTeam.Name = 'Bea Subtask Under Team Task Wire';
            subUnderTeam.ParentID = teamTaskId;
            subUnderTeam.Status = 'Open';
            const savedTeamSub = await subUnderTeam.Save();
            Assert(!savedTeamSub, 'Bea creating subtask under Team task must fail save over the wire');
            const teamSubReason = subUnderTeam.LatestResult?.CompleteMessage ?? '';
            Assert(
                teamSubReason.includes('Access denied for new MJ_BizApps_Tasks: Tasks record') || teamSubReason.includes('Access denied'),
                `Expected Access denied refusal for subtask under Team task over the wire, got: ${teamSubReason}`,
            );

            // 3b. Bea creating a subtask under unreachable task is refused
            const subUnderUnreachable = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
            subUnderUnreachable.NewRecord();
            subUnderUnreachable.Name = 'Bea Subtask Under Unreachable Task Wire';
            subUnderUnreachable.ParentID = unreachableTaskId;
            subUnderUnreachable.Status = 'Open';
            const savedUnreachableSub = await subUnderUnreachable.Save();
            Assert(!savedUnreachableSub, 'Bea creating subtask under unreachable space task must fail save over the wire');
            const unreachableSubReason = subUnderUnreachable.LatestResult?.CompleteMessage ?? '';
            Assert(
                unreachableSubReason.includes('Access denied for new MJ_BizApps_Tasks: Tasks record') || unreachableSubReason.includes('Access denied'),
                `Expected Access denied refusal for subtask under unreachable task over the wire, got: ${unreachableSubReason}`,
            );

            // 3c. Bea creating a subtask under writable Shared task is accepted
            const subUnderShared = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
            subUnderShared.NewRecord();
            subUnderShared.Name = 'Bea Subtask Under Shared Task Wire';
            subUnderShared.ParentID = sharedTaskId;
            subUnderShared.Status = 'Open';
            const savedSharedSub = await subUnderShared.Save();
            Assert(savedSharedSub, `Bea creating subtask under writable Shared task must succeed over the wire: ${subUnderShared.LatestResult?.CompleteMessage ?? ''}`);

            // Cleanup created subtask
            if (savedSharedSub && subUnderShared.ID) {
                const deleted = await subUnderShared.Delete();
                Assert(deleted, 'Cleanup of Bea subtask must succeed over the wire');
            }
        },
    },
    {
        Id: 'write-gates.WG4',
        Name: 'WG4 — share notice write gates: recipient must be in space roster over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const harperCtx = await getPersonaContext(ctx, 'harper');

            // Find an item in Discovery
            const items = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            Assert(items.length > 0, 'Discovery items exist');
            const itemId = items[0].ID;

            // Attempt to create ShareNotice for Harper (not in Discovery)
            const notice = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationShareNoticeEntity>(SHARE_NOTICE_ENTITY, adaCtx.User);
            notice.NewRecord();
            notice.SpaceID = DISCOVERY_SPACE_ID;
            notice.ItemID = itemId;
            notice.RecipientUserID = harperCtx.User.ID;

            const saved = await notice.Save();
            Assert(!saved, 'Share notice to user not in space roster must fail save over the wire');
            const reason = notice.LatestResult?.CompleteMessage ?? '';
            Assert(
                reason.includes('That person is not a recipient for this share.'),
                `Expected recipient refusal message, got: ${reason}`,
            );
        },
    },
    {
        Id: 'write-gates.WG5',
        Name: 'WG5 — item use write gates: caller must reach space to record use over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harperCtx = await getPersonaContext(ctx, 'harper');

            const items = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            const itemId = items[0].ID;

            const use = await harperCtx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, harperCtx.User);
            use.NewRecord();
            use.SpaceID = DISCOVERY_SPACE_ID;
            use.ItemID = itemId;
            use.UserID = harperCtx.User.ID;
            use.Kind = 'open';

            const saved = await use.Save();
            Assert(!saved, 'Item use by caller outside space must fail save over the wire');
            const reason = use.LatestResult?.CompleteMessage ?? '';
            Assert(
                reason.includes('The caller does not reach this space.'),
                `Expected item use outside space refusal, got: ${reason}`,
            );
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('write-gates', {
    Setup: async () => {},
    Teardown: async () => {},
});
