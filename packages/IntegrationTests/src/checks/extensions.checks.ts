import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { RegisterClass } from '@memberjunction/global';
import {
    BaseSpaceTypeServerDriver,
    createSpaceConversation,
    createSpaceTask,
    ServerDriverRegistry,
    type ChatChangeContext,
    type DriverValidationResult,
    type TaskFiledContext,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { ExampleBoardServerDriver, ExampleRoomServerDriver } from '@mj-biz-apps/collaboration-example-space-types/server';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceMemberEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_ENTITY, SPACE_ITEM_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY, SPACE_TYPE_ENTITY, TASK_ACTIVITY_ENTITY, TASK_ENTITY, TASK_LINK_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';
import { CHECK_SPACE_PREFIX } from '../world/ids.js';
import { cleanupConversation, cleanupSpace, cleanupStep, deleteRowAndConfirm, deleteWhere, registerChecks } from './cleanup-helpers.js';

/** The two test-only types (`metadata-tests/space-types`): each names the example package's driver of the same key. */
async function loadTypeByCode(ctx: IntegrationCheckContext, code: string): Promise<mjBizAppsCollaborationSpaceTypeEntity> {
    const rows = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, `Code = '${code}'`, ['ID']);
    Assert(rows.length === 1, `The ${code} test type is on this host (run "pnpm run mj:push:tests" once per database)`);
    const type = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, ctx.User);
    Assert(await type.Load(rows[0].ID), `The ${code} type loads`);
    return type;
}

interface NewSpace {
    name: string;
    typeId: string;
    parentId?: string | null;
    inherits?: boolean;
}

/** Saves a marked space as the given user. Returns the entity, whose Save result the caller reads. */
async function newSpace(ctx: IntegrationCheckContext, owner: Awaited<ReturnType<typeof GetPersonaUser>>, spec: NewSpace): Promise<mjBizAppsCollaborationSpaceEntity> {
    const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, owner);
    space.NewRecord();
    space.Name = `${CHECK_SPACE_PREFIX}${spec.name}-${Date.now()}`;
    space.SpaceTypeID = spec.typeId;
    space.ParentID = spec.parentId ?? null;
    space.OwnerID = owner.ID;
    space.InheritsMembership = spec.inherits ?? false;
    return space;
}

/** Seats the owner on their own empty space, as the rules allow, so the space has a roster to build under. */
async function seatOwner(ctx: IntegrationCheckContext, owner: Awaited<ReturnType<typeof GetPersonaUser>>, spaceId: string): Promise<void> {
    const roles = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
    const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, owner);
    seat.NewRecord();
    seat.SpaceID = spaceId;
    seat.UserID = owner.ID;
    seat.SpaceRoleTypeID = roles[0].ID;
    seat.Band = 'Team';
    seat.Status = 'Active';
    Assert(await seat.Save(), `The owner seats themselves: ${seat.LatestResult?.CompleteMessage ?? ''}`);
}

/** Closes a space and then removes it: an example board refuses the delete of an open board. */
async function closeAndRemove(ctx: IntegrationCheckContext, spaceId: string): Promise<void> {
    await cleanupStep(async () => {
        // An owner closes a space, so Ada does (each space here has her seated as its owner)
        const ada = await GetPersonaUser(ctx, 'ada');
        const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
        Assert(await space.Load(spaceId), 'The space to close loads');
        if (!space.ClosedAt) {
            space.ClosedAt = new Date(Date.now() - 60_000);
            Assert(await space.Save(), `The space closes before it is removed: ${space.LatestResult?.CompleteMessage ?? ''}`);
        }
    });
    await cleanupSpace(ctx.Provider, ctx.User, spaceId);
}

/** What the EX5 and EX6 driver was asked, so a check can see the hook ran. */
const asked = { taskFiled: [] as string[], chatKinds: [] as string[] };

/** A test driver: it refuses a Topic conversation, and records the tasks filed in its spaces. */
@RegisterClass(BaseSpaceTypeServerDriver, 'ex5-spy')
class Ex5SpyDriver extends BaseSpaceTypeServerDriver {
    public override ValidateChatChange(ctx: ChatChangeContext): DriverValidationResult {
        asked.chatKinds.push(ctx.chatKind);
        return ctx.chatKind === 'Topic' ? { ok: false, message: 'The EX5 driver does not take Topic conversations.' } : { ok: true };
    }

    public override OnTaskFiled(ctx: TaskFiledContext): void {
        asked.taskFiled.push(ctx.taskId);
    }
}

/** Creates a marked test type (as Dev, who holds Configure Space Types) that names the given server driver. */
async function newTestType(ctx: IntegrationCheckContext, label: string, driver: string): Promise<mjBizAppsCollaborationSpaceTypeEntity> {
    const dev = await GetPersonaUser(ctx, 'dev');
    const source = await loadTypeByCode(ctx, 'example-room');
    const type = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, dev);
    type.NewRecord();
    type.Code = `${label}-${Date.now()}`;
    type.Name = `${CHECK_SPACE_PREFIX}${label} type`;
    type.Vocabulary = 'room';
    type.Discoverability = source.Discoverability;
    type.JoinMode = source.JoinMode;
    type.MessagingPanel = true;
    type.LibraryPanel = true;
    type.WorkPanel = true;
    type.DefaultRetention = source.DefaultRetention;
    type.DefaultAgentRetrieval = source.DefaultAgentRetrieval;
    type.DefaultAllowParentAssignees = source.DefaultAllowParentAssignees;
    type.DefaultBand = source.DefaultBand;
    type.InviteApproval = source.InviteApproval;
    type.IsActive = true;
    type.ServerDriverClass = driver;
    Assert(await type.Save(), `Dev (Configure Space Types) creates the ${label} type: ${type.LatestResult?.CompleteMessage ?? ''}`);
    ServerDriverRegistry.Instance.ClearCache();
    return type;
}

/** Removes a conversation a check started, with its Space Chat row, read back. */
async function cleanupConversationById(ctx: IntegrationCheckContext, conversationId: string): Promise<void> {
    const chats = await FindRows<{ ID: string }>(ctx, 'MJ_BizApps_Collaboration: Space Chats', `ConversationID = '${conversationId}'`, ['ID']);
    await cleanupConversation(ctx.Provider, ctx.User, conversationId, chats[0]?.ID);
}

/** Removes a task a check filed and what hangs on it, each read back. */
async function cleanupTaskFiled(ctx: IntegrationCheckContext, taskId: string, itemId: string): Promise<void> {
    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, itemId, 'an EX6 space item');
    await deleteWhere(ctx.Provider, ctx.User, TASK_LINK_ENTITY, `TaskID = '${taskId}'`, 'a task link');
    await deleteWhere(ctx.Provider, ctx.User, TASK_ACTIVITY_ENTITY, `TaskID = '${taskId}'`, 'a task activity');
    await deleteRowAndConfirm(ctx.Provider, ctx.User, TASK_ENTITY, taskId, 'an EX6 task');
}

const checks: NamedCheck[] = [
    {
        Id: 'extensions.EX1',
        Name: 'EX1 — the real driver registry resolves both example drivers from their type rows, and refuses a type naming a driver that is not registered',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const board = await loadTypeByCode(ctx, 'example-board');
            const room = await loadTypeByCode(ctx, 'example-room');
            const registry = ServerDriverRegistry.Instance;
            Assert(registry.GetDriverForType(board) instanceof ExampleBoardServerDriver, 'example-board resolves to the board driver');
            Assert(registry.GetDriverForType(room) instanceof ExampleRoomServerDriver, 'example-room resolves to the room driver');

            const unregistered = await loadTypeByCode(ctx, 'example-board');
            unregistered.ServerDriverClass = 'no-such-driver';
            let refusal = '';
            try {
                registry.GetDriverForType(unregistered);
            } catch (error) {
                refusal = error instanceof Error ? error.message : String(error);
            }
            Assert(/not registered/.test(refusal), `A type naming an unregistered driver is refused: ${refusal}`);
        },
    },
    {
        Id: 'extensions.EX2',
        Name: "EX2 — the board's driver refuses a Compensation sub-space that inherits membership, at creation and on a later save, and lets a sealed one through",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const board = await loadTypeByCode(ctx, 'example-board');
            const parent = await newSpace(ctx, ada, { name: 'EX2-Board', typeId: board.ID });
            Assert(await parent.Save(), `Ada creates an example board: ${parent.LatestResult?.CompleteMessage ?? ''}`);
            const created: string[] = [parent.ID];
            try {
                await seatOwner(ctx, ada, parent.ID);
                const inheriting = await newSpace(ctx, ada, { name: 'EX2-Compensation-inherits', typeId: board.ID, parentId: parent.ID, inherits: true });
                inheriting.Name = `${CHECK_SPACE_PREFIX}Compensation committee ${Date.now()}`;
                Assert(!(await inheriting.Save()), 'A Compensation sub-committee that inherits membership must be refused');
                const why = inheriting.LatestResult?.CompleteMessage ?? '';
                Assert(/Sealed sub-committees/.test(why), `The board's own message comes back: ${why}`);

                const sealed = await newSpace(ctx, ada, { name: 'EX2-Compensation-sealed', typeId: board.ID, parentId: parent.ID, inherits: false });
                sealed.Name = `${CHECK_SPACE_PREFIX}Compensation committee ${Date.now()}`;
                Assert(await sealed.Save(), `The same sub-committee, sealed, is accepted: ${sealed.LatestResult?.CompleteMessage ?? ''}`);
                created.unshift(sealed.ID);
                await seatOwner(ctx, ada, sealed.ID);

                // Saved sealed, it may not later be switched to inherit: an update of a child is judged too, not only its creation
                const later = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await later.Load(sealed.ID), 'The sealed sub-committee loads');
                later.InheritsMembership = true;
                Assert(!(await later.Save()), 'Switching a sealed Compensation committee to inherit membership must be refused');
                Assert(/Sealed sub-committees/.test(later.LatestResult?.CompleteMessage ?? ''), `The board's message comes back: ${later.LatestResult?.CompleteMessage ?? ''}`);
            } finally {
                for (const id of created) await closeAndRemove(ctx, id);
            }
        },
    },
    {
        Id: 'extensions.EX3',
        Name: 'EX3 — an example room refuses any sub-space',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const room = await loadTypeByCode(ctx, 'example-room');
            const parent = await newSpace(ctx, ada, { name: 'EX3-Room', typeId: room.ID });
            Assert(await parent.Save(), `Ada creates an example room: ${parent.LatestResult?.CompleteMessage ?? ''}`);
            try {
                await seatOwner(ctx, ada, parent.ID);
                const child = await newSpace(ctx, ada, { name: 'EX3-Child', typeId: room.ID, parentId: parent.ID });
                Assert(!(await child.Save()), 'A sub-space under a room must be refused');
                const why = child.LatestResult?.CompleteMessage ?? '';
                Assert(/cannot contain child spaces/.test(why), `The room's own message comes back: ${why}`);
            } finally {
                await closeAndRemove(ctx, parent.ID);
            }
        },
    },
    {
        Id: 'extensions.EX4',
        Name: 'EX4 — a type that names a driver nobody registered refuses every write to its spaces',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const broken = await newTestType(ctx, 'EX4', 'ex4-not-registered');
            try {
                ServerDriverRegistry.Instance.ClearCache();
                const space = await newSpace(ctx, ada, { name: 'EX4-Space', typeId: broken.ID });
                const saved = await space.Save();
                Assert(!saved, 'A space of a type whose driver is not registered must be refused');
                const why = space.LatestResult?.CompleteMessage ?? '';
                Assert(/not registered/.test(why), `The refusal names the missing driver: ${why}`);
            } finally {
                await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_TYPE_ENTITY, broken.ID, 'the EX4 test type');
            }
        },
    },
    {
        Id: 'extensions.EX5',
        Name: "EX5 — starting a conversation asks the type's driver, and a type whose driver has gone missing cannot start one",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const type = await newTestType(ctx, 'EX5', 'ex5-spy');
            const space = await newSpace(ctx, ada, { name: 'EX5-Space', typeId: type.ID });
            Assert(await space.Save(), `Ada creates a space of the spy type: ${space.LatestResult?.CompleteMessage ?? ''}`);
            let conversationId: string | undefined;
            try {
                await seatOwner(ctx, ada, space.ID);
                asked.chatKinds.length = 0;
                const topic = await createSpaceConversation(ctx.Provider, ada, { SpaceID: space.ID, Name: 'Topic talk', Kind: 'Topic' });
                Assert(!topic.ok && /does not take Topic/.test(topic.message ?? ''), `The driver's refusal comes back: ${topic.message ?? ''}`);
                const general = await createSpaceConversation(ctx.Provider, ada, { SpaceID: space.ID, Name: 'General talk', Kind: 'General' });
                Assert(general.ok === true, `A General conversation the driver accepts is created: ${general.message ?? ''}`);
                conversationId = general.conversationId;
                Assert(asked.chatKinds.join(',') === 'Topic,General', `The driver was asked about each start, in order: ${asked.chatKinds.join(',')}`);

                // The type now names a driver nobody registered: fail closed, for a new conversation too
                const dev = await GetPersonaUser(ctx, 'dev');
                const editable = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, dev);
                Assert(await editable.Load(type.ID), 'Dev reloads the spy type');
                editable.ServerDriverClass = 'ex5-gone';
                Assert(await editable.Save(), `Dev points the type at a driver that is not registered: ${editable.LatestResult?.CompleteMessage ?? ''}`);
                ServerDriverRegistry.Instance.ClearCache();
                const orphan = await createSpaceConversation(ctx.Provider, ada, { SpaceID: space.ID, Name: 'Orphan talk', Kind: 'General' });
                Assert(!orphan.ok && /not registered/.test(orphan.message ?? ''), `A missing driver refuses the start: ${orphan.message ?? ''}`);
            } finally {
                await cleanupStep(async () => {
                    // A type whose driver is missing refuses every write, the cleanup's deletes too: put the driver back first
                    const dev = await GetPersonaUser(ctx, 'dev');
                    const restore = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, dev);
                    Assert(await restore.Load(type.ID), 'Dev reloads the spy type to put its driver back');
                    restore.ServerDriverClass = 'ex5-spy';
                    Assert(await restore.Save(), `Dev restores the driver: ${restore.LatestResult?.CompleteMessage ?? ''}`);
                    ServerDriverRegistry.Instance.ClearCache();
                });
                if (conversationId) await cleanupConversationById(ctx, conversationId);
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
                await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_TYPE_ENTITY, type.ID, 'the EX5 test type');
            }
        },
    },
    {
        Id: 'extensions.EX6',
        Name: "EX6 — filing a task tells the type's driver",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const type = await newTestType(ctx, 'EX6', 'ex5-spy');
            const space = await newSpace(ctx, ada, { name: 'EX6-Space', typeId: type.ID });
            Assert(await space.Save(), `Ada creates a space of the spy type: ${space.LatestResult?.CompleteMessage ?? ''}`);
            let filed: { taskId: string; itemId: string } | null = null;
            try {
                await seatOwner(ctx, ada, space.ID);
                asked.taskFiled.length = 0;
                const result = await createSpaceTask(ctx.Provider, ada, { spaceId: space.ID, name: 'EX6 task', band: 'Team' });
                Assert(result.ok === true, `Ada files a task: ${result.ok ? '' : result.message}`);
                if (result.ok) filed = { taskId: result.taskId, itemId: result.itemId };
                Assert(filed !== null && asked.taskFiled.length === 1 && asked.taskFiled[0] === filed.taskId, `OnTaskFiled ran once, for that task: ${asked.taskFiled.join(',')}`);
            } finally {
                if (filed) await cleanupTaskFiled(ctx, filed.taskId, filed.itemId);
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
                await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_TYPE_ENTITY, type.ID, 'the EX6 test type');
            }
        },
    },
    {
        Id: 'extensions.EX7',
        Name: 'EX7 — the board refuses a close while motions are open and the delete of an open board, and both go through once they are clear',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const board = await loadTypeByCode(ctx, 'example-board');
            const space = await newSpace(ctx, ada, { name: 'EX7-Board', typeId: board.ID });
            Assert(await space.Save(), `Ada creates an example board: ${space.LatestResult?.CompleteMessage ?? ''}`);
            try {
                await seatOwner(ctx, ada, space.ID);
                // Motions open (a setting the type lets a space hold): the board can't be closed, and can once none are
                // Dev holds Configure Spaces; Ada seats Dev as an owner of this board so the settings can be saved
                const dev = await GetPersonaUser(ctx, 'dev');
                const ownerRole = (await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']))[0].ID;
                const devSeat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                devSeat.NewRecord();
                devSeat.SpaceID = space.ID;
                devSeat.UserID = dev.ID;
                devSeat.SpaceRoleTypeID = ownerRole;
                devSeat.Band = 'Team';
                devSeat.Status = 'Active';
                Assert(await devSeat.Save(), `Ada seats Dev as owner: ${devSeat.LatestResult?.CompleteMessage ?? ''}`);
                const withMotions = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await withMotions.Load(space.ID), 'The board loads for Dev');
                withMotions.Configuration = JSON.stringify({ Extensions: { 'example-board': { OpenMotions: 2 } } });
                Assert(await withMotions.Save(), `The type lets a board hold OpenMotions: ${withMotions.LatestResult?.CompleteMessage ?? ''}`);
                withMotions.ClosedAt = new Date(Date.now() - 60_000);
                Assert(!(await withMotions.Save()), 'A board with motions open must not close');
                Assert(/motions are open/.test(withMotions.LatestResult?.CompleteMessage ?? ''), `The board's own message comes back: ${withMotions.LatestResult?.CompleteMessage ?? ''}`);
                const noMotions = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await noMotions.Load(space.ID), 'The board reloads');
                noMotions.Configuration = JSON.stringify({ Extensions: { 'example-board': { OpenMotions: 0 } } });
                Assert(await noMotions.Save(), `OpenMotions goes back to none: ${noMotions.LatestResult?.CompleteMessage ?? ''}`);

                const open = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                Assert(await open.Load(space.ID), 'The board loads');
                Assert(!(await open.Delete()), 'The delete of an open board must be refused');
                const why = open.LatestResult?.CompleteMessage ?? '';
                Assert(/Close it first/.test(why), `The board's own message comes back: ${why}`);
                const still = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${space.ID}'`, ['ID'], undefined, { BypassCache: true });
                Assert(still.length === 1, 'The refused delete left the board in place');
            } finally {
                await closeAndRemove(ctx, space.ID);
            }
            const gone = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${space.ID}'`, ['ID'], undefined, { BypassCache: true });
            Assert(gone.length === 0, 'Closed, the board deletes');
        },
    },
    {
        Id: 'extensions.EX8',
        Name: "EX8 — a type's Children.AllowedTypeCodes is enforced: nothing may sit under a cohort, and a workspace may hold a project",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const types = await FindRows<{ ID: string; Code: string }>(ctx, SPACE_TYPE_ENTITY, "Code IN ('project', 'workspace')", ['ID', 'Code']);
            const project = types.find((t) => t.Code === 'project')?.ID;
            Assert(!!project, 'The Project type is on this host');
            const COHORT = 'C1000001-0000-4000-8000-000000000005';
            const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';
            const underCohort = await newSpace(ctx, ada, { name: 'EX8-under-cohort', typeId: project!, parentId: COHORT, inherits: true });
            Assert(!(await underCohort.Save()), 'A project under a cohort must be refused');
            Assert(/cannot contain sub-spaces/.test(underCohort.LatestResult?.CompleteMessage ?? ''), `The refusal names the rule: ${underCohort.LatestResult?.CompleteMessage ?? ''}`);
            const underWorkspace = await newSpace(ctx, ada, { name: 'EX8-under-workspace', typeId: project!, parentId: DISCOVERY, inherits: true });
            Assert(await underWorkspace.Save(), `A project under a workspace is accepted: ${underWorkspace.LatestResult?.CompleteMessage ?? ''}`);
            await cleanupSpace(ctx.Provider, ctx.User, underWorkspace.ID);
        },
    },
    {
        Id: 'extensions.EX9',
        Name: "EX9 — a type's Children.MaxOpen caps the open sub-spaces, and a reopen counts like a create",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const board = await loadTypeByCode(ctx, 'example-board');
            const parent = await newSpace(ctx, ada, { name: 'EX9-Board', typeId: board.ID });
            Assert(await parent.Save(), `Ada creates an example board: ${parent.LatestResult?.CompleteMessage ?? ''}`);
            const created: string[] = [parent.ID];
            try {
                await seatOwner(ctx, ada, parent.ID);
                const first = await newSpace(ctx, ada, { name: 'EX9-first', typeId: board.ID, parentId: parent.ID });
                Assert(await first.Save(), `The first open sub-space fits: ${first.LatestResult?.CompleteMessage ?? ''}`);
                created.unshift(first.ID);
                await seatOwner(ctx, ada, first.ID);
                const second = await newSpace(ctx, ada, { name: 'EX9-second', typeId: board.ID, parentId: parent.ID });
                Assert(!(await second.Save()), 'A second open sub-space must be refused (MaxOpen is 1)');
                Assert(/most its type allows \(1\)/.test(second.LatestResult?.CompleteMessage ?? ''), `The refusal names the cap: ${second.LatestResult?.CompleteMessage ?? ''}`);

                // Close the first, file a second in its place, then try to reopen the first: over the cap again
                const closing = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await closing.Load(first.ID), 'The first sub-space loads');
                closing.ClosedAt = new Date(Date.now() - 60_000);
                Assert(await closing.Save(), `The first sub-space closes: ${closing.LatestResult?.CompleteMessage ?? ''}`);
                const replacement = await newSpace(ctx, ada, { name: 'EX9-replacement', typeId: board.ID, parentId: parent.ID });
                Assert(await replacement.Save(), `A sub-space fits once the first is closed: ${replacement.LatestResult?.CompleteMessage ?? ''}`);
                created.unshift(replacement.ID);
                await seatOwner(ctx, ada, replacement.ID);
                const reopening = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await reopening.Load(first.ID), 'The closed sub-space loads');
                reopening.ClosedAt = null;
                Assert(!(await reopening.Save()), 'Reopening it would take the board past MaxOpen, and must be refused');
            } finally {
                for (const id of created) await closeAndRemove(ctx, id);
            }
        },
    },
    {
        Id: 'extensions.EX10',
        Name: 'EX10 — a close and a move in one save are refused, so a sealed rule on incoming children cannot be walked around',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const board = await loadTypeByCode(ctx, 'example-board');
            const first = await newSpace(ctx, ada, { name: 'EX10-A', typeId: board.ID });
            const second = await newSpace(ctx, ada, { name: 'EX10-B', typeId: board.ID });
            Assert(await first.Save() && await second.Save(), 'Ada creates two example boards');
            const created: string[] = [first.ID, second.ID];
            try {
                await seatOwner(ctx, ada, first.ID);
                await seatOwner(ctx, ada, second.ID);
                const child = await newSpace(ctx, ada, { name: 'EX10-child', typeId: board.ID, parentId: first.ID });
                Assert(await child.Save(), `The sub-committee is created: ${child.LatestResult?.CompleteMessage ?? ''}`);
                created.unshift(child.ID);
                await seatOwner(ctx, ada, child.ID);
                const both = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await both.Load(child.ID), 'The sub-committee loads');
                both.ParentID = second.ID;
                both.ClosedAt = new Date(Date.now() - 60_000);
                Assert(!(await both.Save()), 'Moving and closing in one save must be refused');
                Assert(/separate saves/.test(both.LatestResult?.CompleteMessage ?? ''), `The refusal says why: ${both.LatestResult?.CompleteMessage ?? ''}`);
            } finally {
                for (const id of created) await closeAndRemove(ctx, id);
            }
        },
    },
    {
        Id: 'extensions.EX11',
        Name: "EX11 — MaxOpen holds for a move into a full board, a closed space may still move under one, and a retype the parent's list leaves out is refused",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const board = await loadTypeByCode(ctx, 'example-board');
            const room = await loadTypeByCode(ctx, 'example-room');
            const parent = await newSpace(ctx, ada, { name: 'EX11-Board', typeId: board.ID });
            const outsider = await newSpace(ctx, ada, { name: 'EX11-Outsider', typeId: board.ID });
            Assert(await parent.Save() && await outsider.Save(), 'Ada creates two example boards');
            const created: string[] = [parent.ID, outsider.ID];
            try {
                await seatOwner(ctx, ada, parent.ID);
                await seatOwner(ctx, ada, outsider.ID);
                const held = await newSpace(ctx, ada, { name: 'EX11-held', typeId: board.ID, parentId: parent.ID });
                Assert(await held.Save(), `The board's one open sub-space fits: ${held.LatestResult?.CompleteMessage ?? ''}`);
                created.unshift(held.ID);
                await seatOwner(ctx, ada, held.ID);

                // A move into a board at its cap is refused
                const moving = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await moving.Load(outsider.ID), 'The outside board loads');
                moving.ParentID = parent.ID;
                Assert(!(await moving.Save()), 'Moving an open board under a full board must be refused');
                Assert(/most its type allows \(1\)/.test(moving.LatestResult?.CompleteMessage ?? ''), `The refusal names the cap: ${moving.LatestResult?.CompleteMessage ?? ''}`);

                // A closed space adds no open sub-space, so it may move under the same board
                const closing = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await closing.Load(outsider.ID), 'The outside board loads again');
                closing.ClosedAt = new Date(Date.now() - 60_000);
                Assert(await closing.Save(), `The outside board closes: ${closing.LatestResult?.CompleteMessage ?? ''}`);
                const filing = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await filing.Load(outsider.ID), 'The closed board loads');
                filing.ParentID = parent.ID;
                Assert(await filing.Save(), `A closed board may move under a full one: ${filing.LatestResult?.CompleteMessage ?? ''}`);
                // Now a sub-space of the parent, so it is removed before it
                created.splice(created.indexOf(outsider.ID), 1);
                created.unshift(outsider.ID);

                // The board lists only boards, so a sub-space cannot become a room
                const retype = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await retype.Load(held.ID), 'The open sub-space loads');
                retype.SpaceTypeID = room.ID;
                Assert(!(await retype.Save()), 'Retyping a sub-space to a type its parent does not list must be refused');
            } finally {
                for (const id of created) await closeAndRemove(ctx, id);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('extensions', {
    Setup: async () => {},
    Teardown: async () => {},
});
