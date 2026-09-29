import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    CollaborationClient,
    mjBizAppsCollaborationItemUseEntity,
    mjBizAppsCollaborationShareNoticeEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
} from '@mj-biz-apps/collaboration-entities';
import { mjBizAppsTasksTaskActivityEntity, mjBizAppsTasksTaskEntity, mjBizAppsTasksTaskLinkEntity } from '@mj-biz-apps/tasks-entities';
import {
    ITEM_USE_ENTITY,
    SHARE_NOTICE_ENTITY,
    SPACE_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    SPACE_TYPE_ENTITY,
    TASK_ACTIVITY_ENTITY,
    TASK_ENTITY,
    TASK_LINK_ENTITY,
} from '../../entity-names.js';
import { FindRows, getPersonaClientContext, getPersonaContext, SameID, View } from '../../wire.js';
import { cleanupConversation, cleanupStep, deleteRowAndConfirm, registerChecks } from '../cleanup-helpers.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';
const CLOSED_RECENT_SPACE_ID = 'C1000001-0000-4000-8000-000000000007';

async function cleanupTaskAndItem(
    ctx: IntegrationCheckContext,
    taskId: string,
    itemId: string,
): Promise<void> {
    const cleanupItem = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
    Assert(await cleanupItem.Load(itemId), `Loading space item ${itemId} for cleanup must succeed`);
    Assert(await cleanupItem.Delete(), `Deleting space item ${itemId} cleanup must succeed`);

    const rv = View(ctx);
    const linkRows = await rv.RunView<{ ID: string }>({
        EntityName: TASK_LINK_ENTITY,
        ExtraFilter: `TaskID = '${taskId}'`,
        Fields: ['ID'],
        ResultType: 'simple',
    }, ctx.User);
    if (linkRows.Success && linkRows.Results) {
        for (const r of linkRows.Results) {
            const link = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskLinkEntity>(TASK_LINK_ENTITY, ctx.User);
            Assert(await link.Load(r.ID), `Loading task link ${r.ID} for cleanup must succeed`);
            Assert(await link.Delete(), `Deleting task link ${r.ID} cleanup must succeed`);
        }
    }

    const actRows = await rv.RunView<{ ID: string }>({
        EntityName: TASK_ACTIVITY_ENTITY,
        ExtraFilter: `TaskID = '${taskId}'`,
        Fields: ['ID'],
        ResultType: 'simple',
    }, ctx.User);
    if (actRows.Success && actRows.Results) {
        for (const r of actRows.Results) {
            const act = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskActivityEntity>(TASK_ACTIVITY_ENTITY, ctx.User);
            Assert(await act.Load(r.ID), `Loading task activity ${r.ID} for cleanup must succeed`);
            Assert(await act.Delete(), `Deleting task activity ${r.ID} cleanup must succeed`);
        }
    }

    const cleanupTask = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, ctx.User);
    Assert(await cleanupTask.Load(taskId), `Loading task ${taskId} for cleanup must succeed`);
    Assert(await cleanupTask.Delete(), `Deleting task ${taskId} cleanup must succeed`);
}

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
            const sharedTaskProbe = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, ctx.User);
            Assert(await sharedTaskProbe.Load(sharedTaskId), 'Loading sharedTaskProbe must succeed over the wire');
            const taskTypeId = sharedTaskProbe.TypeID;

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
            if (taskTypeId) subUnderTeam.TypeID = taskTypeId;
            const savedTeamSub = await subUnderTeam.Save();
            Assert(!savedTeamSub, 'Bea creating subtask under Team task must fail save over the wire');
            const teamSubReason = subUnderTeam.LatestResult?.CompleteMessage ?? '';
            Assert(
                teamSubReason.includes('Access denied for new MJ_BizApps_Tasks: Tasks record'),
                `Expected Access denied refusal for subtask under Team task over the wire, got: ${teamSubReason}`,
            );

            // 3b. Bea creating a subtask under unreachable task is refused
            const subUnderUnreachable = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
            subUnderUnreachable.NewRecord();
            subUnderUnreachable.Name = 'Bea Subtask Under Unreachable Task Wire';
            subUnderUnreachable.ParentID = unreachableTaskId;
            subUnderUnreachable.Status = 'Open';
            if (taskTypeId) subUnderUnreachable.TypeID = taskTypeId;
            const savedUnreachableSub = await subUnderUnreachable.Save();
            Assert(!savedUnreachableSub, 'Bea creating subtask under unreachable space task must fail save over the wire');
            const unreachableSubReason = subUnderUnreachable.LatestResult?.CompleteMessage ?? '';
            Assert(
                unreachableSubReason.includes('Access denied for new MJ_BizApps_Tasks: Tasks record'),
                `Expected Access denied refusal for subtask under unreachable task over the wire, got: ${unreachableSubReason}`,
            );

            // 3c. Bea creating a subtask under writable Shared task is accepted
            const subUnderShared = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
            subUnderShared.NewRecord();
            subUnderShared.Name = 'Bea Subtask Under Shared Task Wire';
            subUnderShared.ParentID = sharedTaskId;
            subUnderShared.Status = 'Open';
            if (taskTypeId) subUnderShared.TypeID = taskTypeId;
            const savedSharedSub = await subUnderShared.Save();
            Assert(savedSharedSub, `Bea creating subtask under writable Shared task must succeed over the wire: ${subUnderShared.LatestResult?.CompleteMessage ?? ''}`);

            // Cleanup created subtask
            if (savedSharedSub && subUnderShared.ID) {
                const cleanupTask = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, ctx.User);
                Assert(await cleanupTask.Load(subUnderShared.ID), 'Loading created subtask for cleanup must succeed over the wire');
                const deleted = await cleanupTask.Delete();
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
            use.UsedAt = new Date();

            const saved = await use.Save();
            Assert(!saved, 'Item use by caller outside space must fail save over the wire');
            const reason = use.LatestResult?.CompleteMessage ?? '';
            Assert(
                reason.includes('The caller does not reach this space.'),
                `Expected item use outside space refusal, got: ${reason}`,
            );
        },
    },
    {
        Id: 'write-gates.WG6',
        Name: 'WG6 — write gates accepting side: authorized member writes are accepted over the wire',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');
            const beaCtx = await getPersonaContext(ctx, 'bea');

            // 1. Authorized item use: Ada reaches Discovery, recording 'open' must succeed
            let createdUseId: string | null = null;
            try {
                const items = await FindRows<{ ID: string }>(
                    ctx,
                    SPACE_ITEM_ENTITY,
                    `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                    ['ID'],
                );
                Assert(items.length > 0, 'Discovery items exist');
                const itemId = items[0].ID;

                const use = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, adaCtx.User);
                use.NewRecord();
                use.SpaceID = DISCOVERY_SPACE_ID;
                use.ItemID = itemId;
                use.UserID = adaCtx.User.ID;
                use.Kind = 'open';
                use.UsedAt = new Date();

                const savedUse = await use.Save();
                Assert(savedUse, `Item use by reaching member Ada must succeed over the wire: ${use.LatestResult?.CompleteMessage ?? ''}`);
                createdUseId = use.ID;
            } finally {
                if (createdUseId) {
                    const cleanupUse = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, ctx.User);
                    Assert(await cleanupUse.Load(createdUseId), 'Loading item use for cleanup over wire must succeed');
                    Assert(await cleanupUse.Delete(), 'Deleting item use cleanup over wire must succeed');
                }
            }

            // 2. Authorized room post over wire: Ada (staff) and Bea (outside participant) posting to Discovery room
            let wg6ConvId: string | undefined;
            let wg6ChatId: string | undefined;
            try {
                const adaClientCtx = await getPersonaClientContext(ctx, 'ada');
                const adaClient = new CollaborationClient(adaClientCtx.GraphQLProvider);
                const startRes = await adaClient.CreateSpaceConversation({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-client-wg6-general-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(startRes.Success === true && !!startRes.ConversationID, 'Start on-demand General conversation for WG6 over wire');
                wg6ConvId = startRes.ConversationID!;
                wg6ChatId = startRes.SpaceChatID;

                const adaPostRes = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: wg6ConvId,
                    Text: 'WG6 client acceptance test message from Ada (staff)',
                });
                Assert(adaPostRes.Success, `Authorized room post over wire must succeed: ${adaPostRes.ErrorMessage ?? ''}`);

                const beaClientCtx = await getPersonaClientContext(ctx, 'bea');
                const beaClient = new CollaborationClient(beaClientCtx.GraphQLProvider);
                const beaPostRes = await beaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: wg6ConvId,
                    Text: 'WG6 client acceptance test message from Bea (outside participant)',
                });
                Assert(beaPostRes.Success, `Authorized Bea room post over wire must succeed: ${beaPostRes.ErrorMessage ?? ''}`);
            } finally {
                if (wg6ConvId || wg6ChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, wg6ConvId, wg6ChatId);
                }
            }

            // 3. Status changes:
            // 3a. Status change refused over the wire for non-contributing user Dana (guest on Committee with CanContribute = false)
            const danaCtx = await getPersonaContext(ctx, 'dana');
            const taskEntity = ctx.Provider.EntityByName(TASK_ENTITY);
            Assert(!!taskEntity, 'Task entity found');
            if (!taskEntity) throw new Error('Task entity found');
            const committeeTaskItems = await FindRows<{ RecordID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${COMMITTEE_SPACE_ID}' AND EntityID = '${taskEntity.ID}' AND Band = 'Shared'`,
                ['RecordID'],
            );
            Assert(committeeTaskItems.length > 0, 'Committee shared task item found');
            const committeeTaskId = committeeTaskItems[0].RecordID.replace(/^ID\|/i, '');

            const danaTask = await danaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, danaCtx.User);
            Assert(await danaTask.Load(committeeTaskId), 'Loading committee task as guest Dana over wire must succeed');
            danaTask.Status = 'Completed';
            const danaStatusSaved = await danaTask.Save();
            Assert(!danaStatusSaved, 'Status update by guest Dana with CanContribute: false must fail save over the wire');
            const danaReason = danaTask.LatestResult?.CompleteMessage ?? '';
            Assert(
                danaReason.includes('Task refused: you do not have permission to update task status in this space.'),
                `Expected status permission refusal message for guest Dana over wire, got: ${danaReason}`,
            );

            // 3b. Status change refused in a closed space (closed-recent) over the wire
            const adaClientCtx = await getPersonaClientContext(ctx, 'ada');
            const adaClient = new CollaborationClient(adaClientCtx.GraphQLProvider);
            let closedTaskCreated: { taskId: string; itemId: string } | null = null;
            const closedRecentSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await closedRecentSpace.Load(CLOSED_RECENT_SPACE_ID), 'Load closed-recent space as Ada over wire');
            const origClosedAt = closedRecentSpace.ClosedAt;
            try {
                // Temporarily reopen closed-recent so Ada can file a root task
                closedRecentSpace.ClosedAt = null;
                Assert(await closedRecentSpace.Save(), 'Temporarily reopen closed-recent to file task over wire');

                const closedTaskRes = await adaClient.CreateSpaceTask({
                    SpaceID: CLOSED_RECENT_SPACE_ID,
                    Name: `WG6 Closed Task Client ${Date.now()}`,
                    Band: 'Shared',
                });
                Assert(closedTaskRes.Success && !!closedTaskRes.TaskID && !!closedTaskRes.ItemID, `Creating root task in closed space via client CreateSpaceTask must succeed: ${closedTaskRes.ErrorMessage ?? ''}`);
                if (!closedTaskRes.Success || !closedTaskRes.TaskID || !closedTaskRes.ItemID) throw new Error(`Creating root task in closed space failed: ${closedTaskRes.ErrorMessage ?? ''}`);
                closedTaskCreated = { taskId: closedTaskRes.TaskID, itemId: closedTaskRes.ItemID };

                // Re-close the space
                closedRecentSpace.ClosedAt = origClosedAt ?? new Date();
                Assert(await closedRecentSpace.Save(), 'Re-close closed-recent space over wire');

                const closedTask = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
                Assert(await closedTask.Load(closedTaskRes.TaskID), 'Loading task in closed space over wire must succeed');
                closedTask.Status = 'Completed';
                const closedSaved = await closedTask.Save();
                Assert(!closedSaved, 'Status update in closed space must fail save over the wire');
                const closedReason = closedTask.LatestResult?.CompleteMessage ?? '';
                Assert(
                    closedReason.includes('Task refused: cannot update a task in a closed space.'),
                    `Expected closed space status refusal message over wire, got: ${closedReason}`,
                );
            } finally {
                try {
                    if (closedTaskCreated) {
                        await cleanupTaskAndItem(ctx, closedTaskCreated.taskId, closedTaskCreated.itemId);
                    }
                } finally {
                    const restoreSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
                    Assert(await restoreSpace.Load(CLOSED_RECENT_SPACE_ID), 'Loading closed-recent space over wire to restore ClosedAt must succeed');
                    const currentTime = restoreSpace.ClosedAt instanceof Date
                        ? restoreSpace.ClosedAt.getTime()
                        : (restoreSpace.ClosedAt ? new Date(restoreSpace.ClosedAt).getTime() : null);
                    const origTime = origClosedAt instanceof Date
                        ? origClosedAt.getTime()
                        : (origClosedAt ? new Date(origClosedAt).getTime() : null);
                    if (currentTime !== origTime) {
                        restoreSpace.ClosedAt = origClosedAt;
                        Assert(await restoreSpace.Save(), 'Restoring closed-recent ClosedAt over wire must succeed');
                    }
                }
            }

            // 3c. Authorized status change: contributing member Bea updating a task status is accepted over wire
            let openTaskCreated: { taskId: string; itemId: string } | null = null;
            try {
                const taskRes = await adaClient.CreateSpaceTask({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `WG6 Task Status Acceptance Client ${Date.now()}`,
                    Band: 'Shared',
                });
                Assert(taskRes.Success && !!taskRes.TaskID && !!taskRes.ItemID, `Creating root task via client CreateSpaceTask must succeed: ${taskRes.ErrorMessage ?? ''}`);
                if (!taskRes.Success || !taskRes.TaskID || !taskRes.ItemID) throw new Error(`Creating root task via client CreateSpaceTask failed: ${taskRes.ErrorMessage ?? ''}`);
                openTaskCreated = { taskId: taskRes.TaskID, itemId: taskRes.ItemID };

                const task = await beaCtx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, beaCtx.User);
                Assert(await task.Load(taskRes.TaskID), 'Loading task for status update over wire must succeed');
                task.Status = 'Completed';
                task.PercentComplete = 100;
                const updatedStatus = await task.Save();
                Assert(updatedStatus, `Authorized status change to Completed over wire must succeed: ${task.LatestResult?.CompleteMessage ?? ''}`);
            } finally {
                if (openTaskCreated) {
                    await cleanupTaskAndItem(ctx, openTaskCreated.taskId, openTaskCreated.itemId);
                }
            }

            // 4. Settings rights over wire:
            // 4a. Space owner Ada saving AllowParentAssignees succeeds and restores
            const discoverySpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await discoverySpace.Load(DISCOVERY_SPACE_ID), 'Loading Discovery space for settings acceptance over wire must succeed');
            const originalAllow = discoverySpace.AllowParentAssignees;
            discoverySpace.AllowParentAssignees = !originalAllow;
            const savedSettings = await discoverySpace.Save();
            Assert(savedSettings, `Authorized space owner saving settings over wire must succeed: ${discoverySpace.LatestResult?.CompleteMessage ?? ''}`);
            discoverySpace.AllowParentAssignees = originalAllow;
            const restoredSettings = await discoverySpace.Save();
            Assert(restoredSettings, `Restoring space settings over wire must succeed: ${discoverySpace.LatestResult?.CompleteMessage ?? ''}`);

            // 4b. Space owner without Configure Spaces authorization (Ada) modifying Configuration is refused
            discoverySpace.Configuration = JSON.stringify({ Chats: { AgentReplyMode: 'Always' } });
            const adaConfigSaved = await discoverySpace.Save();
            Assert(!adaConfigSaved, 'Ada saving Configuration without Configure Spaces authorization must fail save over the wire');
            const adaConfigReason = discoverySpace.LatestResult?.CompleteMessage ?? '';
            Assert(
                adaConfigReason.includes("Space change refused: user lacks 'Configure Spaces' authorization or does not hold an owner role on this space."),
                `Expected Configure Spaces authorization refusal for Ada over wire, got: ${adaConfigReason}`,
            );

            // 4c. Space owner with Configure Spaces authorization (Dev) updating Configuration succeeds and restores in try/finally
            const devCtx = await getPersonaContext(ctx, 'dev');
            const ownerRoles = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            Assert(ownerRoles.length === 1, 'Owner space role type found');
            const ownerRoleId = ownerRoles[0].ID;

            const existingDevMembers = await FindRows<{ ID: string }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND UserID = '${devCtx.User.ID}'`,
                ['ID'],
            );
            let devMemberId: string | null = null;
            let devMemberCreated = false;
            // A seat Dev already held is put back the way it was; only a seat this check created is deleted
            let devSeatBefore: Pick<mjBizAppsCollaborationSpaceMemberEntity, 'SpaceRoleTypeID' | 'Band' | 'Status'> | null = null;
            if (existingDevMembers.length > 0) {
                devMemberId = existingDevMembers[0].ID;
                const devMember = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, adaCtx.User);
                Assert(await devMember.Load(devMemberId), 'Load existing Dev member on Discovery over wire');
                devSeatBefore = { SpaceRoleTypeID: devMember.SpaceRoleTypeID, Band: devMember.Band, Status: devMember.Status };
                devMember.SpaceRoleTypeID = ownerRoleId;
                devMember.Band = 'Team';
                devMember.Status = 'Active';
                Assert(await devMember.Save(), 'Update existing Dev member as owner over wire');
            } else {
                const devMember = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, adaCtx.User);
                devMember.NewRecord();
                devMember.SpaceID = DISCOVERY_SPACE_ID;
                devMember.UserID = devCtx.User.ID;
                devMember.SpaceRoleTypeID = ownerRoleId;
                devMember.Band = 'Team';
                devMember.Status = 'Active';
                Assert(await devMember.Save(), `Ada seating Dev as owner on Discovery over wire must succeed: ${devMember.LatestResult?.CompleteMessage ?? ''}`);
                devMemberId = devMember.ID;
                devMemberCreated = true;
            }

            try {
                const devDiscovery = await devCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, devCtx.User);
                Assert(await devDiscovery.Load(DISCOVERY_SPACE_ID), 'Loading Discovery space as Dev over wire must succeed');
                const devOrigConfig = devDiscovery.Configuration;
                try {
                    devDiscovery.Configuration = JSON.stringify({ Chats: { AgentReplyMode: 'MentionOnly' } });
                    const devSaved = await devDiscovery.Save();
                    Assert(devSaved, `Dev saving Configuration with Configure Spaces authorization must succeed over wire: ${devDiscovery.LatestResult?.CompleteMessage ?? ''}`);
                } finally {
                    await cleanupStep(async () => {
                        const restoreDev = await devCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, devCtx.User);
                        Assert(await restoreDev.Load(DISCOVERY_SPACE_ID), 'Loading Discovery space to restore Configuration over wire must succeed');
                        restoreDev.Configuration = devOrigConfig;
                        const restoredConfig = await restoreDev.Save();
                        Assert(restoredConfig, `Restoring Discovery Configuration as Dev over wire must succeed: ${restoreDev.LatestResult?.CompleteMessage ?? ''}`);
                        const verifyRestore = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                        Assert(await verifyRestore.Load(DISCOVERY_SPACE_ID), 'Read Discovery back after restoring its Configuration');
                        Assert(verifyRestore.Configuration === devOrigConfig, "Discovery's Configuration is back to what it was");
                    });
                }
            } finally {
                if (devMemberCreated && devMemberId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, devMemberId, "Dev's seat on Discovery");
                } else if (devMemberId && devSeatBefore) {
                    const seatBefore = devSeatBefore;
                    const seatId = devMemberId;
                    await cleanupStep(async () => {
                        const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ctx.User);
                        Assert(await seat.Load(seatId), "Reload Dev's existing seat to put it back");
                        seat.SpaceRoleTypeID = seatBefore.SpaceRoleTypeID;
                        seat.Band = seatBefore.Band;
                        seat.Status = seatBefore.Status;
                        Assert(await seat.Save(), `Putting Dev's seat back must succeed: ${seat.LatestResult?.CompleteMessage ?? ''}`);
                        const verify = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ctx.User);
                        Assert(await verify.Load(seatId), "Read Dev's seat back after restoring it");
                        Assert(
                            SameID(verify.SpaceRoleTypeID, seatBefore.SpaceRoleTypeID) && verify.Band === seatBefore.Band && verify.Status === seatBefore.Status,
                            "Dev's existing seat must be back to its original role, band and status",
                        );
                    });
                }
            }
        },
    },
    {
        Id: 'write-gates.WG7',
        Name: "WG7 — a space owner changing the space's type is refused: the change needs Configure Spaces",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const space = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Ada loads Discovery, a space she owns');
            const others = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, `ID <> '${space.SpaceTypeID}' AND IsActive = 1`, ['ID']);
            Assert(others.length > 0, 'The world has another active space type to change to');
            const originalTypeId = space.SpaceTypeID;
            space.SpaceTypeID = others[0].ID;
            const saved = await space.Save();
            Assert(!saved, "Ada, Discovery's owner, changing its type must be refused");
            Assert(
                (space.LatestResult?.CompleteMessage ?? '').includes("changing a space's type needs the 'Configure Spaces' authorization"),
                `The refusal names the missing right: ${space.LatestResult?.CompleteMessage ?? ''}`,
            );
            const after = await FindRows<{ SpaceTypeID: string }>(ctx, SPACE_ENTITY, `ID = '${DISCOVERY_SPACE_ID}'`, ['SpaceTypeID']);
            Assert(SameID(after[0]?.SpaceTypeID, originalTypeId), "Discovery's type is unchanged");
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('write-gates', {
    Setup: async () => {},
    Teardown: async () => {},
});

