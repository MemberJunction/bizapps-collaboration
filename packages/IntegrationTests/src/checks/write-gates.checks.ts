import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { createSpaceConversation, createSpaceTask, postSpaceMessage, resolveSpaceChatHostRules } from '@mj-biz-apps/collaboration-core-entities-server';
import {
    mjBizAppsCollaborationItemUseEntity,
    mjBizAppsCollaborationShareNoticeEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
} from '@mj-biz-apps/collaboration-entities';
import { mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
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
} from '../entity-names.js';
import { FindRows, GetPersonaUser, SameID } from '../wire.js';
import { CHECK_SPACE_PREFIX } from '../world/ids.js';
import { cleanupConversation, cleanupSpace, cleanupStep, deleteRowAndConfirm, deleteWhere, registerChecks } from './cleanup-helpers.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';
const CLOSED_RECENT_SPACE_ID = 'C1000001-0000-4000-8000-000000000007';

/** Removes a task a check filed and everything hung on it, each read back. A failure is reported to the running check. */
async function cleanupTaskAndItem(ctx: IntegrationCheckContext, taskId: string, itemId: string): Promise<void> {
    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, itemId, 'a WG6 space item');
    await deleteWhere(ctx.Provider, ctx.User, TASK_LINK_ENTITY, `TaskID = '${taskId}'`, 'a task link');
    await deleteWhere(ctx.Provider, ctx.User, TASK_ACTIVITY_ENTITY, `TaskID = '${taskId}'`, 'a task activity');
    await deleteRowAndConfirm(ctx.Provider, ctx.User, TASK_ENTITY, taskId, 'a WG6 task');
}

const checks: NamedCheck[] = [
    {
        Id: 'write-gates.WG1',
        Name: 'WG1 — space write gates: cycle detection and participant root creation refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            const [workspaceType] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'workspace'", ['ID']);
            Assert(Boolean(workspaceType?.ID), 'Expected Workspace space type to exist');

            // 1. Participant (Bea) creating a root space (ParentID = null) is refused
            const rootAttempt = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea);
            rootAttempt.NewRecord();
            rootAttempt.Name = `${CHECK_SPACE_PREFIX}Bea Root Space`;
            rootAttempt.OwnerID = bea.ID;
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
                const msg = 'Participant creating root space must be refused' +
                    (undoError ? ` AND undo as system user also failed: ${undoError}` : '');
                Assert(false, msg);
            }
            Assert(!savedRoot, 'Participant creating root space must be refused');
            const rootReason = rootAttempt.LatestResult?.CompleteMessage ?? '';
            Assert(
                rootReason.includes('Space change refused: only a staff user may create a root, and they must own it.'),
                `Expected root space refusal message, got: ${rootReason}`,
            );

            // 2. Cycle detection: moving Northwind under Discovery (its own child)
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
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
                const msg = 'Moving space under its own descendant must fail save' +
                    (undoError ? ` AND undo as system user also failed: ${undoError}` : '');
                Assert(false, msg);
            }
            Assert(!savedCycle, 'Moving space under its own descendant must fail save');
            const cycleReason = space.LatestResult?.CompleteMessage ?? '';
            Assert(
                cycleReason.includes('would put the space inside its own subtree'),
                `Expected cycle message, got: ${cycleReason}`,
            );
        },
    },
    {
        Id: 'write-gates.WG2',
        Name: 'WG2 — member write gates: immutable Space/User, last owner protection, self-removal',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');

            // 1. Find Ada's owner seat on Northwind
            const seats = await FindRows<{ ID: string; SpaceID: string; UserID: string; SpaceRoleTypeID: string }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                `SpaceID = '${NORTHWIND_SPACE_ID}' AND UserID = '${ada.ID}'`,
                ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID'],
            );
            Assert(seats.length === 1, 'Ada seat found on Northwind');

            const member = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
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
                const msg = 'Changing SpaceID on saved membership must fail' +
                    (undoError ? ` AND undo as system user also failed: ${undoError}` : '');
                Assert(false, msg);
            }
            Assert(!savedSpace, 'Changing SpaceID on saved membership must fail');
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
                const msg = 'Removing last active owner must fail save' +
                    (undoError ? ` AND undo as system user also failed: ${undoError}` : '');
                Assert(false, msg);
            }
            Assert(!savedStrand, 'Removing last active owner must fail save');
            const strandReason = member.LatestResult?.CompleteMessage ?? '';
            Assert(
                strandReason.includes('last owner of this space'),
                `Expected last owner message, got: ${strandReason}`,
            );

            // 3. B0.1: Casey (client-admin on Northwind, ceiling 10) removing Sam (member, level 20) is refused; Ada (owner) removing Sam succeeds
            const casey = await GetPersonaUser(ctx, 'casey');
            const sam = await GetPersonaUser(ctx, 'sam');

            const samSeats = await FindRows<{ ID: string }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                `SpaceID = '${NORTHWIND_SPACE_ID}' AND UserID = '${sam.ID}'`,
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

            const caseyMember = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, casey);
            Assert(await caseyMember.Load(samSeatId), 'Load Sam seat as Casey');
            caseyMember.SpaceRoleTypeID = clientMemberRoleId;
            caseyMember.Status = 'Removed';
            const savedCaseyRemove = await caseyMember.Save();
            Assert(!savedCaseyRemove, 'Casey removing Sam must fail save due to role ceiling');
            const caseyReason = caseyMember.LatestResult?.CompleteMessage ?? '';
            Assert(
                caseyReason.includes('Invite refused: that role is above the level this member may grant.'),
                `Expected exact role ceiling refusal message, got: ${caseyReason}`,
            );

            // Ada (owner, ceiling >= 20) removes Sam
            const adaSamMember = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
            Assert(await adaSamMember.Load(samSeatId), 'Load Sam seat as Ada');
            adaSamMember.Status = 'Removed';
            const savedAdaRemove = await adaSamMember.Save();
            Assert(savedAdaRemove, `Ada removing Sam must succeed, got error: ${adaSamMember.LatestResult?.CompleteMessage ?? ''}`);

            // Undo: Revert Sam back to Active
            adaSamMember.Status = 'Active';
            const revertedSam = await adaSamMember.Save();
            Assert(revertedSam, `Reverting Sam back to Active must succeed: ${adaSamMember.LatestResult?.CompleteMessage ?? ''}`);
        },
    },
    {
        Id: 'write-gates.WG3',
        Name: 'WG3 — item write gates: valid space/signer, subtask cannot be filed as space root',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const harper = await GetPersonaUser(ctx, 'harper'); // in Harbor, not Discovery

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
            const subtaskItem = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ada);
            subtaskItem.NewRecord();
            subtaskItem.SpaceID = DISCOVERY_SPACE_ID;
            subtaskItem.EntityID = taskEntity.ID;
            subtaskItem.RecordID = `ID|${subtaskId}`;
            subtaskItem.Band = 'Shared';

            const savedSubtask = await subtaskItem.Save();
            Assert(!savedSubtask, 'Filing subtask as space item must fail save');
            const subtaskReason = subtaskItem.LatestResult?.CompleteMessage ?? '';
            Assert(
                subtaskReason.includes('Item change refused: a subtask cannot be filed as a space root.'),
                `Expected subtask space root refusal, got: ${subtaskReason}`,
            );

            // 2. Signer outside space (Harper) attempting to place item in Discovery
            const harperItem = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, harper);
            harperItem.NewRecord();
            harperItem.SpaceID = DISCOVERY_SPACE_ID;
            harperItem.EntityID = taskEntity.ID;
            harperItem.RecordID = `ID|${subtaskRows[0].ParentID}`;
            harperItem.Band = 'Shared';

            const savedHarper = await harperItem.Save();
            Assert(!savedHarper, 'Harper saving item in Discovery must fail save');
            const harperReason = harperItem.LatestResult?.CompleteMessage ?? '';
            Assert(
                harperReason.includes('Item change refused: the signer does not reach this space.'),
                `Expected signer does not reach space refusal, got: ${harperReason}`,
            );

            // 3. B0.3: Participant (Bea) creating subtasks under various parent tasks
            const bea = await GetPersonaUser(ctx, 'bea');

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
            Assert(await sharedTaskProbe.Load(sharedTaskId), 'Loading sharedTaskProbe must succeed');
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
            const subUnderTeam = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, bea);
            subUnderTeam.NewRecord();
            subUnderTeam.Name = 'Bea Subtask Under Team Task';
            subUnderTeam.ParentID = teamTaskId;
            subUnderTeam.Status = 'Open';
            if (taskTypeId) subUnderTeam.TypeID = taskTypeId;
            const savedTeamSub = await subUnderTeam.Save();
            Assert(!savedTeamSub, 'Bea creating subtask under Team task must fail save');
            const teamSubReason = subUnderTeam.LatestResult?.CompleteMessage ?? '';
            Assert(
                teamSubReason.includes('Access denied for new MJ_BizApps_Tasks: Tasks record'),
                `Expected Access denied refusal for subtask under Team task, got: ${teamSubReason}`,
            );

            // 3b. Bea creating a subtask under unreachable task is refused
            const subUnderUnreachable = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, bea);
            subUnderUnreachable.NewRecord();
            subUnderUnreachable.Name = 'Bea Subtask Under Unreachable Task';
            subUnderUnreachable.ParentID = unreachableTaskId;
            subUnderUnreachable.Status = 'Open';
            if (taskTypeId) subUnderUnreachable.TypeID = taskTypeId;
            const savedUnreachableSub = await subUnderUnreachable.Save();
            Assert(!savedUnreachableSub, 'Bea creating subtask under unreachable space task must fail save');
            const unreachableSubReason = subUnderUnreachable.LatestResult?.CompleteMessage ?? '';
            Assert(
                unreachableSubReason.includes('Access denied for new MJ_BizApps_Tasks: Tasks record'),
                `Expected Access denied refusal for subtask under unreachable task, got: ${unreachableSubReason}`,
            );

            // 3c. Bea creating a subtask under writable Shared task is accepted
            const subUnderShared = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, bea);
            subUnderShared.NewRecord();
            subUnderShared.Name = 'Bea Subtask Under Shared Task';
            subUnderShared.ParentID = sharedTaskId;
            subUnderShared.Status = 'Open';
            if (taskTypeId) subUnderShared.TypeID = taskTypeId;
            const savedSharedSub = await subUnderShared.Save();
            Assert(savedSharedSub, `Bea creating subtask under writable Shared task must succeed: ${subUnderShared.LatestResult?.CompleteMessage ?? ''}`);

            // Cleanup created subtask
            if (savedSharedSub && subUnderShared.ID) {
                const cleanupTask = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, ctx.User);
                Assert(await cleanupTask.Load(subUnderShared.ID), 'Loading created subtask for cleanup must succeed');
                const deleted = await cleanupTask.Delete();
                Assert(deleted, 'Cleanup of Bea subtask must succeed');
            }
        },
    },
    {
        Id: 'write-gates.WG4',
        Name: 'WG4 — share notice write gates: recipient must be in space roster',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const harper = await GetPersonaUser(ctx, 'harper'); // Harper is in Harbor, not Discovery

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
            const notice = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationShareNoticeEntity>(SHARE_NOTICE_ENTITY, ada);
            notice.NewRecord();
            notice.SpaceID = DISCOVERY_SPACE_ID;
            notice.ItemID = itemId;
            notice.RecipientUserID = harper.ID;

            const saved = await notice.Save();
            Assert(!saved, 'Share notice to user not in space roster must fail save');
            const reason = notice.LatestResult?.CompleteMessage ?? '';
            Assert(
                reason.includes('That person is not a recipient for this share.'),
                `Expected recipient refusal message, got: ${reason}`,
            );
        },
    },
    {
        Id: 'write-gates.WG5',
        Name: 'WG5 — item use write gates: caller must reach space to record use',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harper = await GetPersonaUser(ctx, 'harper'); // In Harbor, not Discovery

            const items = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            const itemId = items[0].ID;

            const use = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, harper);
            use.NewRecord();
            use.SpaceID = DISCOVERY_SPACE_ID;
            use.ItemID = itemId;
            use.UserID = harper.ID;
            use.Kind = 'open';

            const saved = await use.Save();
            Assert(!saved, 'Item use by caller outside space must fail save');
            const reason = use.LatestResult?.CompleteMessage ?? '';
            Assert(
                reason.includes('The caller does not reach this space.'),
                `Expected item use outside space refusal, got: ${reason}`,
            );
        },
    },
    {
        Id: 'write-gates.WG6',
        Name: 'WG6 — write gates accepting side for PR #7: room post (staff & outside participant), status change, settings rights, and item use',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

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

                const use = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>(ITEM_USE_ENTITY, ada);
                use.NewRecord();
                use.SpaceID = DISCOVERY_SPACE_ID;
                use.ItemID = itemId;
                use.UserID = ada.ID;
                use.Kind = 'open';
                use.UsedAt = new Date();

                const savedUse = await use.Save();
                Assert(savedUse, `Item use by reaching member Ada must succeed: ${use.LatestResult?.CompleteMessage ?? ''}`);
                createdUseId = use.ID;
            } finally {
                if (createdUseId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, ITEM_USE_ENTITY, createdUseId, 'an item use');
                }
            }

            // 2. Authorized room post: staff member (Ada) and outside participant (Bea) posting to Discovery room
            let wg6ConvId: string | undefined;
            let wg6ChatId: string | undefined;
            try {
                const startRes = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-wg6-general-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(startRes.ok === true && !!startRes.conversationId, 'Start on-demand General conversation for WG6');
                wg6ConvId = startRes.conversationId!;
                wg6ChatId = startRes.spaceChatId;

                const adaPostRes = await postSpaceMessage(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: wg6ConvId,
                    text: 'WG6 acceptance test message from Ada (staff)',
                });
                Assert(adaPostRes.ok, `Authorized staff room post must succeed: ${adaPostRes.ok ? '' : adaPostRes.message}`);

                const beaPostRes = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: wg6ConvId,
                    text: 'WG6 acceptance test message from Bea (outside participant)',
                });
                Assert(beaPostRes.ok, `Authorized outside participant room post must succeed: ${beaPostRes.ok ? '' : beaPostRes.message}`);
            } finally {
                if (wg6ConvId || wg6ChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, wg6ConvId, wg6ChatId);
                }
            }

            // 3. Status changes:
            // 3a. Status change refused for non-contributing user Dana (guest on Committee with CanContribute = false)
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

            const dana = await GetPersonaUser(ctx, 'dana');
            const danaTask = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, dana);
            Assert(await danaTask.Load(committeeTaskId), 'Loading committee task as guest Dana must succeed');
            danaTask.Status = 'Completed';
            const danaStatusSaved = await danaTask.Save();
            Assert(!danaStatusSaved, 'Status update by guest Dana with CanContribute: false must fail save');
            const danaReason = danaTask.LatestResult?.CompleteMessage ?? '';
            Assert(
                danaReason.includes('Task refused: you do not have permission to update task status in this space.'),
                `Expected status permission refusal message for guest Dana, got: ${danaReason}`,
            );

            // 3b. Status change refused in a closed space (closed-recent)
            let closedTaskCreated: { taskId: string; itemId: string } | null = null;
            const closedRecentSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await closedRecentSpace.Load(CLOSED_RECENT_SPACE_ID), 'Load closed-recent space as Ada');
            const origClosedAt = closedRecentSpace.ClosedAt;
            try {
                // Temporarily reopen closed-recent so Ada can file a root task
                closedRecentSpace.ClosedAt = null;
                Assert(await closedRecentSpace.Save(), 'Temporarily reopen closed-recent to file task');

                const closedTaskRes = await createSpaceTask(ctx.Provider, ada, {
                    spaceId: CLOSED_RECENT_SPACE_ID,
                    name: `WG6 Closed Task ${Date.now()}`,
                    band: 'Shared',
                });
                Assert(closedTaskRes.ok && !!closedTaskRes.taskId && !!closedTaskRes.itemId, `Creating root task in closed space via createSpaceTask must succeed: ${closedTaskRes.ok ? '' : closedTaskRes.message}`);
                if (!closedTaskRes.ok) throw new Error(`Creating root task in closed space failed: ${closedTaskRes.message}`);
                closedTaskCreated = { taskId: closedTaskRes.taskId, itemId: closedTaskRes.itemId };

                // Re-close the space
                closedRecentSpace.ClosedAt = origClosedAt ?? new Date();
                Assert(await closedRecentSpace.Save(), 'Re-close closed-recent space');

                const closedTask = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, bea);
                Assert(await closedTask.Load(closedTaskRes.taskId), 'Loading task in closed space must succeed');
                closedTask.Status = 'Completed';
                const closedSaved = await closedTask.Save();
                Assert(!closedSaved, 'Status update in closed space must fail save');
                const closedReason = closedTask.LatestResult?.CompleteMessage ?? '';
                Assert(
                    closedReason.includes('Task refused: cannot update a task in a closed space.'),
                    `Expected closed space status refusal message, got: ${closedReason}`,
                );
            } finally {
                if (closedTaskCreated) {
                    await cleanupTaskAndItem(ctx, closedTaskCreated.taskId, closedTaskCreated.itemId);
                }
                await cleanupStep(async () => {
                    const restoreSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                    Assert(await restoreSpace.Load(CLOSED_RECENT_SPACE_ID), 'Loading closed-recent space to restore ClosedAt must succeed');
                    const currentTime = restoreSpace.ClosedAt instanceof Date
                        ? restoreSpace.ClosedAt.getTime()
                        : (restoreSpace.ClosedAt ? new Date(restoreSpace.ClosedAt).getTime() : null);
                    const origTime = origClosedAt instanceof Date
                        ? origClosedAt.getTime()
                        : (origClosedAt ? new Date(origClosedAt).getTime() : null);
                    if (currentTime !== origTime) {
                        restoreSpace.ClosedAt = origClosedAt;
                        Assert(await restoreSpace.Save(), 'Restoring closed-recent ClosedAt must succeed');
                    }
                });
            }

            // 3c. Authorized status change: contributing member Bea updating task status in open space is accepted
            let openTaskCreated: { taskId: string; itemId: string } | null = null;
            try {
                const openTaskRes = await createSpaceTask(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    name: `WG6 Task Status Acceptance ${Date.now()}`,
                    band: 'Shared',
                });
                Assert(openTaskRes.ok && !!openTaskRes.taskId && !!openTaskRes.itemId, `Creating root task via createSpaceTask must succeed: ${openTaskRes.ok ? '' : openTaskRes.message}`);
                if (!openTaskRes.ok) throw new Error(`Creating root task via createSpaceTask failed: ${openTaskRes.message}`);
                openTaskCreated = { taskId: openTaskRes.taskId, itemId: openTaskRes.itemId };

                const task = await ctx.Provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASK_ENTITY, bea);
                Assert(await task.Load(openTaskRes.taskId), 'Loading task for status update must succeed');
                task.Status = 'Completed';
                task.PercentComplete = 100;
                const updatedStatus = await task.Save();
                Assert(updatedStatus, `Authorized status change to Completed by contributing member Bea must succeed: ${task.LatestResult?.CompleteMessage ?? ''}`);
            } finally {
                if (openTaskCreated) {
                    await cleanupTaskAndItem(ctx, openTaskCreated.taskId, openTaskCreated.itemId);
                }
            }

            // 4. Settings rights:
            // 4a. Space owner Ada saving AllowParentAssignees succeeds and restores
            const discoverySpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await discoverySpace.Load(DISCOVERY_SPACE_ID), 'Loading Discovery space for settings acceptance must succeed');
            const originalAllow = discoverySpace.AllowParentAssignees;
            discoverySpace.AllowParentAssignees = !originalAllow;
            const savedSettings = await discoverySpace.Save();
            Assert(savedSettings, `Authorized space owner saving settings must succeed: ${discoverySpace.LatestResult?.CompleteMessage ?? ''}`);
            discoverySpace.AllowParentAssignees = originalAllow;
            const restoredSettings = await discoverySpace.Save();
            Assert(restoredSettings, `Restoring space settings must succeed: ${discoverySpace.LatestResult?.CompleteMessage ?? ''}`);

            // 4b. Space owner without Configure Spaces authorization (Ada) modifying Configuration is refused
            discoverySpace.Configuration = JSON.stringify({ Chats: { AgentReplyMode: 'Always' } });
            const adaConfigSaved = await discoverySpace.Save();
            Assert(!adaConfigSaved, 'Ada saving Configuration without Configure Spaces authorization must fail save');
            const adaConfigReason = discoverySpace.LatestResult?.CompleteMessage ?? '';
            Assert(
                adaConfigReason.includes("Space change refused: user lacks 'Configure Spaces' authorization or does not hold an owner role on this space."),
                `Expected Configure Spaces authorization refusal for Ada, got: ${adaConfigReason}`,
            );

            // 4c. Space owner with Configure Spaces authorization (Dev) updating Configuration succeeds and restores in try/finally
            const dev = await GetPersonaUser(ctx, 'dev');
            const ownerRoles = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            Assert(ownerRoles.length === 1, 'Owner space role type found');
            const ownerRoleId = ownerRoles[0].ID;

            const existingDevMembers = await FindRows<{ ID: string }>(
                ctx,
                SPACE_MEMBER_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND UserID = '${dev.ID}'`,
                ['ID'],
            );
            let devMemberId: string | null = null;
            let devMemberCreated = false;
            // A seat Dev already held is put back the way it was; only a seat this check created is deleted
            let devSeatBefore: Pick<mjBizAppsCollaborationSpaceMemberEntity, 'SpaceRoleTypeID' | 'Band' | 'Status'> | null = null;
            if (existingDevMembers.length > 0) {
                devMemberId = existingDevMembers[0].ID;
                const devMember = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                Assert(await devMember.Load(devMemberId), 'Load existing Dev member on Discovery');
                devSeatBefore = { SpaceRoleTypeID: devMember.SpaceRoleTypeID, Band: devMember.Band, Status: devMember.Status };
                devMember.SpaceRoleTypeID = ownerRoleId;
                devMember.Band = 'Team';
                devMember.Status = 'Active';
                Assert(await devMember.Save(), 'Update existing Dev member as owner');
            } else {
                const devMember = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                devMember.NewRecord();
                devMember.SpaceID = DISCOVERY_SPACE_ID;
                devMember.UserID = dev.ID;
                devMember.SpaceRoleTypeID = ownerRoleId;
                devMember.Band = 'Team';
                devMember.Status = 'Active';
                Assert(await devMember.Save(), `Ada seating Dev as owner on Discovery must succeed: ${devMember.LatestResult?.CompleteMessage ?? ''}`);
                devMemberId = devMember.ID;
                devMemberCreated = true;
            }

            try {
                const devDiscovery = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await devDiscovery.Load(DISCOVERY_SPACE_ID), 'Loading Discovery space as Dev must succeed');
                const devOrigConfig = devDiscovery.Configuration;
                try {
                    devDiscovery.Configuration = JSON.stringify({ Chats: { AgentReplyMode: 'MentionOnly' } });
                    const devSaved = await devDiscovery.Save();
                    Assert(devSaved, `Dev saving Configuration with Configure Spaces authorization must succeed: ${devDiscovery.LatestResult?.CompleteMessage ?? ''}`);
                } finally {
                    await cleanupStep(async () => {
                        const restoreDev = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                        Assert(await restoreDev.Load(DISCOVERY_SPACE_ID), 'Loading Discovery space to restore Configuration must succeed');
                        restoreDev.Configuration = devOrigConfig;
                        const restoredConfig = await restoreDev.Save();
                        Assert(restoredConfig, `Restoring Discovery Configuration as Dev must succeed: ${restoreDev.LatestResult?.CompleteMessage ?? ''}`);
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
            const ada = await GetPersonaUser(ctx, 'ada');
            const others = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, `ID <> (SELECT SpaceTypeID FROM [__mj_BizAppsCollaboration].[Space] WHERE ID = '${DISCOVERY_SPACE_ID}') AND IsActive = 1`, ['ID']);
            Assert(others.length > 0, 'The world has another active space type to change to');
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Ada loads Discovery, a space she owns');
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
    {
        Id: 'write-gates.WG9',
        Name: "WG9 — an owner who holds Configure Spaces changes a space's type between two types with no subtype table, and back",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const dev = await GetPersonaUser(ctx, 'dev');
            const owner = (await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']))[0]?.ID;
            Assert(!!owner, 'Owner space role type found');
            const types = await FindRows<{ ID: string; Code: string }>(ctx, SPACE_TYPE_ENTITY, "Code IN ('workspace', 'team')", ['ID', 'Code']);
            const workspace = types.find((t) => t.Code === 'workspace')?.ID;
            const team = types.find((t) => t.Code === 'team')?.ID;
            Assert(!!workspace && !!team, 'The Workspace and Team types are on this host');

            const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
            seat.NewRecord();
            seat.SpaceID = DISCOVERY_SPACE_ID;
            seat.UserID = dev.ID;
            seat.SpaceRoleTypeID = owner!;
            seat.Band = 'Team';
            seat.Status = 'Active';
            Assert(await seat.Save(), `Ada seats Dev as an owner of Discovery: ${seat.LatestResult?.CompleteMessage ?? ''}`);
            let changed = false;
            try {
                const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await space.Load(DISCOVERY_SPACE_ID), 'Dev loads Discovery');
                Assert(SameID(space.SpaceTypeID, workspace), 'Discovery starts as a Workspace');
                space.SpaceTypeID = team!;
                changed = true;
                Assert(await space.Save(), `Dev (Configure Spaces, an owner seat) changes Discovery to a Team space: ${space.LatestResult?.CompleteMessage ?? ''}`);
                const read = await FindRows<{ SpaceTypeID: string }>(ctx, SPACE_ENTITY, `ID = '${DISCOVERY_SPACE_ID}'`, ['SpaceTypeID'], undefined, { BypassCache: true });
                Assert(SameID(read[0]?.SpaceTypeID, team), "Discovery is a Team space when read back");
            } finally {
                if (changed) {
                    await cleanupStep(async () => {
                        const back = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                        Assert(await back.Load(DISCOVERY_SPACE_ID), 'Dev reloads Discovery to change it back');
                        back.SpaceTypeID = workspace!;
                        Assert(await back.Save(), `Dev changes Discovery back to a Workspace: ${back.LatestResult?.CompleteMessage ?? ''}`);
                        const verify = await FindRows<{ SpaceTypeID: string }>(ctx, SPACE_ENTITY, `ID = '${DISCOVERY_SPACE_ID}'`, ['SpaceTypeID'], undefined, { BypassCache: true });
                        Assert(SameID(verify[0]?.SpaceTypeID, workspace), 'Discovery is a Workspace again when read back');
                    });
                }
                await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, seat.ID, "Dev's seat on Discovery");
            }
        },
    },
    {
        Id: 'write-gates.WG10',
        Name: "WG10 — the member gate under an invite: an outside admin's seat for an Outside member is stored as Invited, and one above her ceiling is refused",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const casey = await GetPersonaUser(ctx, 'casey');
            const nora = await GetPersonaUser(ctx, 'nora');
            const roles = await FindRows<{ ID: string; Code: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code IN ('client-member', 'admin')", ['ID', 'Code']);
            const outsideMember = roles.find((r) => r.Code === 'client-member')?.ID;
            const admin = roles.find((r) => r.Code === 'admin')?.ID;
            Assert(!!outsideMember && !!admin, 'The Outside member and Admin roles are on this host');

            const seatFor = async (roleId: string) => {
                const member = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, casey);
                member.NewRecord();
                member.SpaceID = DISCOVERY_SPACE_ID;
                member.UserID = nora.ID;
                member.SpaceRoleTypeID = roleId;
                member.Band = 'Shared';
                member.Status = 'Active';
                return member;
            };
            try {
                // An Admin is above what Casey may grant. Tried first, while Nora holds no seat: the database's one-seat-per-person
                // rule would also refuse the save, so the check matches the ceiling's own message
                const refused = await seatFor(admin!);
                Assert(!(await refused.Save()), 'Casey seating an Admin, above her ceiling, must be refused');
                const why = refused.LatestResult?.CompleteMessage ?? '';
                Assert(/above the level this member may grant/.test(why), `The refusal names the ceiling, not a database rule: ${why}`);

                // Discovery's type approves invites, so an outside admin's Active seat is stored as Invited, waiting for an owner
                const allowed = await seatFor(outsideMember!);
                Assert(await allowed.Save(), `Casey may seat an Outside member: ${allowed.LatestResult?.CompleteMessage ?? ''}`);
                const stored = await FindRows<{ Status: string }>(ctx, SPACE_MEMBER_ENTITY, `ID = '${allowed.ID}'`, ['Status'], undefined, { BypassCache: true });
                Assert(stored[0]?.Status === 'Invited', `The seat waits for an owner's approval: stored as ${stored[0]?.Status}`);
            } finally {
                const gone = await FindRows<{ ID: string }>(ctx, SPACE_MEMBER_ENTITY, `SpaceID = '${DISCOVERY_SPACE_ID}' AND UserID = '${nora.ID}'`, ['ID'], undefined, { BypassCache: true });
                for (const row of gone) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, row.ID, "Nora's seat on Discovery");
                }
            }
        },
    },
    {
        Id: 'write-gates.WG11',
        Name: "WG11 — a Team space under a Workspace that sets what a Team may not still reads its chat rules, and takes only what a Team may inherit",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const dev = await GetPersonaUser(ctx, 'dev');
            const owner = (await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']))[0]?.ID;
            const team = (await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'team'", ['ID']))[0]?.ID;
            Assert(!!owner && !!team, 'The owner role and the Team type are on this host');

            const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
            seat.NewRecord();
            seat.SpaceID = DISCOVERY_SPACE_ID;
            seat.UserID = dev.ID;
            seat.SpaceRoleTypeID = owner!;
            seat.Band = 'Team';
            seat.Status = 'Active';
            Assert(await seat.Save(), `Ada seats Dev as an owner of Discovery: ${seat.LatestResult?.CompleteMessage ?? ''}`);
            const discovery = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
            Assert(await discovery.Load(DISCOVERY_SPACE_ID), 'Dev loads Discovery');
            const originalConfiguration = discovery.Configuration;
            let teamSpaceId: string | null = null;
            let changed = false;
            try {
                discovery.Configuration = JSON.stringify({ Agents: { ListMode: 'Replace' }, Chats: { WhoCanStart: 'Owners' } });
                changed = true;
                Assert(await discovery.Save(), `Dev sets Discovery's agent list mode and who may start chats: ${discovery.LatestResult?.CompleteMessage ?? ''}`);

                const child = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                child.NewRecord();
                child.Name = `${CHECK_SPACE_PREFIX}WG11-Team-${Date.now()}`;
                child.SpaceTypeID = team!;
                child.ParentID = DISCOVERY_SPACE_ID;
                child.OwnerID = ada.ID;
                child.InheritsMembership = true;
                Assert(await child.Save(), `Ada creates a Team space under Discovery: ${child.LatestResult?.CompleteMessage ?? ''}`);
                teamSpaceId = child.ID;

                const rules = await resolveSpaceChatHostRules(ctx.Provider, ada, teamSpaceId);
                Assert(rules.ok === true, `The Team's chat rules resolve under a Workspace that sets the list mode: ${rules.ok ? '' : rules.message}`);
            } finally {
                if (teamSpaceId) await cleanupStep(() => cleanupSpace(ctx.Provider, ctx.User, teamSpaceId!));
                if (changed) {
                    await cleanupStep(async () => {
                        const back = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                        Assert(await back.Load(DISCOVERY_SPACE_ID), 'Dev reloads Discovery to restore its settings');
                        back.Configuration = originalConfiguration;
                        Assert(await back.Save(), `Dev restores Discovery's settings: ${back.LatestResult?.CompleteMessage ?? ''}`);
                        const verify = await FindRows<{ Configuration: string | null }>(ctx, SPACE_ENTITY, `ID = '${DISCOVERY_SPACE_ID}'`, ['Configuration'], undefined, { BypassCache: true });
                        Assert((verify[0]?.Configuration ?? null) === (originalConfiguration ?? null), "Discovery's settings are back to what they were");
                    });
                }
                await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, seat.ID, "Dev's seat on Discovery");
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('write-gates', {
    Setup: async () => {},
    Teardown: async () => {},
});

