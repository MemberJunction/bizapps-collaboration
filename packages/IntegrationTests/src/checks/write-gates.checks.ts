import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationShareNoticeEntity,
    mjBizAppsCollaborationItemUseEntity,
} from '@mj-biz-apps/collaboration-entities';
import { mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
import {
    SPACE_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_ITEM_ENTITY,
    SHARE_NOTICE_ENTITY,
    ITEM_USE_ENTITY,
    TASK_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';

const checks: NamedCheck[] = [
    {
        Id: 'write-gates.WG1',
        Name: 'WG1 — space write gates: cycle detection and participant root creation refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            // 1. Participant (Bea) creating a root space (ParentID = null) is refused
            const rootAttempt = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea);
            rootAttempt.NewRecord();
            rootAttempt.Name = 'Bea Root Space';
            rootAttempt.OwnerID = bea.ID;
            rootAttempt.SpaceTypeID = 'A1000001-0000-4000-8000-000000000001'; // workspace type
            rootAttempt.ParentID = null;

            const savedRoot = await rootAttempt.Save();
            if (savedRoot) {
                try {
                    await rootAttempt.Delete();
                } catch {
                    // rollback cleanup
                }
                Assert(false, 'Participant creating root space must be refused');
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
                try {
                    space.ParentID = null;
                    await space.Save();
                } catch {
                    // rollback cleanup
                }
                Assert(false, 'Moving space under its own descendant must fail save');
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
                try {
                    member.SpaceID = NORTHWIND_SPACE_ID;
                    await member.Save();
                } catch {
                    // rollback cleanup
                }
                Assert(false, 'Changing SpaceID on saved membership must fail');
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
                try {
                    member.Status = 'Active';
                    await member.Save();
                } catch {
                    // rollback cleanup
                }
                Assert(false, 'Removing last active owner must fail save');
            }
            Assert(!savedStrand, 'Removing last active owner must fail save');
            const strandReason = member.LatestResult?.CompleteMessage ?? '';
            Assert(
                strandReason.includes('last owner of this space'),
                `Expected last owner message, got: ${strandReason}`,
            );
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
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('write-gates', {
    Setup: async () => {},
    Teardown: async () => {},
});

