import { RunQuery } from '@memberjunction/core';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient, mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_ENTITY, SPACE_ITEM_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY, SPACE_TYPE_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext, getPersonaContext } from '../../wire.js';
import { CHECK_SPACE_PREFIX } from '../../world/ids.js';
import { cleanupSpace, registerChecks } from '../cleanup-helpers.js';

type PersonaContext = Awaited<ReturnType<typeof getPersonaContext>>;

/** The test type whose closed spaces are hidden at once: its only terminal status is Archived (metadata-tests/space-type-statuses). */
async function vaultTypeId(ctx: IntegrationCheckContext): Promise<string> {
    const [type] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'example-vault'", ['ID']);
    Assert(!!type, "The example vault type is on this host (run the test metadata push: 'mj:push:tests')");
    return type.ID;
}

async function roleId(ctx: IntegrationCheckContext, filter: string): Promise<string> {
    const [role] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, filter, ['ID']);
    Assert(!!role, `A role type matching ${filter} exists`);
    return role.ID;
}

/** Creates a space as the given persona, over the wire. `parentId` makes it a sub-space that inherits membership. */
async function createSpace(persona: PersonaContext, name: string, typeId: string, parentId: string | null): Promise<mjBizAppsCollaborationSpaceEntity> {
    const space = await persona.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, persona.User);
    space.NewRecord();
    space.Name = `${CHECK_SPACE_PREFIX}${name}`;
    space.OwnerID = persona.User.ID;
    space.SpaceTypeID = typeId;
    space.ParentID = parentId;
    space.InheritsMembership = parentId !== null;
    Assert(await space.Save(), `${persona.User.Name} creates ${name}: ${space.LatestResult?.CompleteMessage ?? ''}`);
    return space;
}

async function seat(persona: PersonaContext, spaceId: string, userId: string, spaceRoleTypeId: string, band: 'Team' | 'Shared'): Promise<void> {
    const seatRow = await persona.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, persona.User);
    seatRow.NewRecord();
    seatRow.SpaceID = spaceId;
    seatRow.UserID = userId;
    seatRow.SpaceRoleTypeID = spaceRoleTypeId;
    seatRow.Band = band;
    seatRow.Status = 'Active';
    Assert(await seatRow.Save(), `A seat for ${userId} is saved: ${seatRow.LatestResult?.CompleteMessage ?? ''}`);
}

/** Closes a space as its owner and reads it back: the row must carry a ClosedAt and the type's first terminal status. */
async function close(persona: PersonaContext, spaceId: string): Promise<void> {
    const space = await persona.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, persona.User);
    Assert(await space.Load(spaceId), 'The space to close loads');
    space.ClosedAt = new Date(Date.now() - 60_000);
    Assert(await space.Save(), `The space closes: ${space.LatestResult?.CompleteMessage ?? ''}`);
    Assert(!!space.StatusID, 'The close stamped the type\'s first terminal status on the space');
}

/** Removes what a check made: the space, its seats and what hangs on it (the harness deletes a closed space too). */
async function remove(ctx: IntegrationCheckContext, spaceId: string): Promise<void> {
    await cleanupSpace(ctx.Provider, ctx.User, spaceId);
}

const checks: NamedCheck[] = [
    {
        Id: 'lifecycle.LC1',
        Name: "LC1 — a participant who owns a space by seat, and isn't its OwnerID, loses a space closed with no post-close access; only its OwnerID reads and reopens it",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const bea = await getPersonaContext(ctx, 'bea');
            const typeId = await vaultTypeId(ctx);
            const ownerRole = await roleId(ctx, "Code = 'owner'");
            const vault = await createSpace(ada, 'LC1 vault', typeId, null);
            try {
                await seat(ada, vault.ID, ada.User.ID, ownerRole, 'Team');
                await seat(ada, vault.ID, bea.User.ID, ownerRole, 'Team');
                const beaBefore = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea.User);
                Assert(await beaBefore.Load(vault.ID), 'While the space is open, Bea, an owner by seat, reads it');

                await close(ada, vault.ID);

                // The row filter shows a space whose access ended to its OwnerID only: an owner by seat can no longer read it
                const beaAfter = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea.User);
                Assert(!(await beaAfter.Load(vault.ID)), 'A closed space with no post-close access is hidden from an owner who is not its OwnerID, so she cannot reopen it');

                // Its OwnerID keeps the row, and reopens it through the client provider
                const adaReopen = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada.User);
                Assert(await adaReopen.Load(vault.ID), "The space's OwnerID still reads it after it closed");
                adaReopen.ClosedAt = null;
                Assert(await adaReopen.Save(), `The OwnerID reopens the space: ${adaReopen.LatestResult?.CompleteMessage ?? ''}`);

                const beaReopened = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea.User);
                Assert(await beaReopened.Load(vault.ID), 'Once it is open again, Bea reads it');
            } finally {
                await remove(ctx, vault.ID);
            }
        },
    },
    {
        Id: 'lifecycle.LC2',
        Name: "LC2 — the seats of a parent closed with no post-close access are not offered under a sub-space its member reaches",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const bea = await getPersonaContext(ctx, 'bea');
            const typeId = await vaultTypeId(ctx);
            const ownerRole = await roleId(ctx, "Code = 'owner'");
            const memberRole = await roleId(ctx, 'CanSeeTeamBand = 1 AND IsOwnerRole = 0');
            const parent = await createSpace(ada, 'LC2 parent', typeId, null);
            let child: mjBizAppsCollaborationSpaceEntity | null = null;
            try {
                await seat(ada, parent.ID, ada.User.ID, ownerRole, 'Team');
                child = await createSpace(ada, 'LC2 child', typeId, parent.ID);
                await seat(ada, child.ID, bea.User.ID, memberRole, 'Team');

                const seatsOfParent = async (): Promise<number> => (await FindRows<{ ID: string }>(
                    { ...ctx, Provider: bea.Provider, User: bea.User } as IntegrationCheckContext,
                    SPACE_MEMBER_ENTITY,
                    `SpaceID = '${parent.ID}' AND Status = 'Active'`,
                    ['ID'],
                    bea.User,
                    { BypassCache: true },
                )).length;
                // Control: while the parent is open its people are readable through the child, so the read below can see them
                Assert((await seatsOfParent()) >= 1, "While the parent is open, Bea reads its seats through the sub-space she is seated on");

                await close(ada, parent.ID);
                Assert((await seatsOfParent()) === 0, 'A parent closed with no post-close access reaches no one: its seats are not offered under the sub-space');
                // The close did not cut off Bea from the sub-space she is seated on: her own seat still reads
                const ownSeats = await FindRows<{ ID: string }>(
                    { ...ctx, Provider: bea.Provider, User: bea.User } as IntegrationCheckContext,
                    SPACE_MEMBER_ENTITY,
                    `SpaceID = '${child.ID}' AND UserID = '${bea.User.ID}' AND Status = 'Active'`,
                    ['ID'],
                    bea.User,
                    { BypassCache: true },
                );
                Assert(ownSeats.length === 1, 'Bea still reads her own seat on the sub-space after the parent closed');
            } finally {
                if (child) await cleanupSpace(ctx.Provider, ctx.User, child.ID);
                await remove(ctx, parent.ID);
            }
        },
    },
    {
        Id: 'lifecycle.LC3',
        Name: 'LC3 — the server says what closing would do: the stamped access (a sub-space takes its type\'s None), whose row it keeps, and whether they can reopen it',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const adaClient = new CollaborationClient((await getPersonaClientContext(ctx, 'ada')).GraphQLProvider);
            const beaClient = new CollaborationClient((await getPersonaClientContext(ctx, 'bea')).GraphQLProvider);
            const typeId = await vaultTypeId(ctx);
            const ownerRole = await roleId(ctx, "Code = 'owner'");
            const parent = await createSpace(ada, 'LC3 parent', typeId, null);
            let child: mjBizAppsCollaborationSpaceEntity | null = null;
            try {
                await seat(ada, parent.ID, ada.User.ID, ownerRole, 'Team');
                child = await createSpace(ada, 'LC3 child', typeId, parent.ID);
                const read = await adaClient.GetCloseConsequence(child.ID);
                Assert(read.Success, `The server reads what closing does: ${read.ErrorMessage ?? ''}`);
                Assert(read.Access === 'None', `A sub-space of a vault stamps None, got ${read.Access}`);
                Assert(read.KeeperUserID?.toLowerCase() === ada.User.ID.toLowerCase(), "The keeper is the space's OwnerID");
                Assert(read.KeeperName === ada.User.Name, `The keeper is named: ${read.KeeperName}`);
                Assert(read.KeeperCanReopen === true, 'Ada holds an owner seat (through the parent) and the authorization, so she can reopen it');

                // Someone who cannot read the space is told so, not given its keeper
                const unseen = await beaClient.GetCloseConsequence(child.ID);
                Assert(!unseen.Success && /not one you can read/.test(unseen.ErrorMessage ?? ''), `A person who cannot read the space is refused for that reason: ${unseen.ErrorMessage ?? ''}`);
                Assert(unseen.KeeperName === undefined || unseen.KeeperName === null, 'and is not given its keeper');

                // Someone who can read it but may not close it (a plain member) is refused for that reason, and not given its keeper
                const memberRole = await roleId(ctx, 'CanSeeTeamBand = 1 AND IsOwnerRole = 0');
                await seat(ada, child.ID, (await getPersonaContext(ctx, 'bea')).User.ID, memberRole, 'Team');
                const member = await beaClient.GetCloseConsequence(child.ID);
                Assert(!member.Success && /Only someone who may close/.test(member.ErrorMessage ?? ''), `A member who may not close is refused for that reason: ${member.ErrorMessage ?? ''}`);
                Assert(member.KeeperName === undefined || member.KeeperName === null, 'and is not given its keeper');
            } finally {
                if (child) await cleanupSpace(ctx.Provider, ctx.User, child.ID);
                await cleanupSpace(ctx.Provider, ctx.User, parent.ID);
            }
        },
    },
    {
        Id: 'lifecycle.LC4',
        Name: "LC4 — Home's counts come from one query run for the signed-in person, and match what the person's own reads find",
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            for (const key of ['ada', 'bea']) {
                const persona = await getPersonaContext(ctx, key);
                const client = new CollaborationClient((await getPersonaClientContext(ctx, key)).GraphQLProvider);
                const counts = await client.GetHomeCounts();
                Assert(counts.Success, `${key}: the server reads Home's counts: ${counts.ErrorMessage ?? ''}`);
                const asPersona = { ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext;
                const read = (entity: string, filter: string, fields: string[]) => FindRows<{ ID: string; RecordID?: string }>(asPersona, entity, filter, fields, persona.User, { BypassCache: true });

                // Shared files: Shared items whose entity is MJ: Files, in the spaces the person reaches (their own row filters decide)
                const [filesEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', "Name = 'MJ: Files'", ['ID']);
                const files = await read(SPACE_ITEM_ENTITY, `Band = 'Shared' AND EntityID = '${filesEntity.ID}'`, ['ID']);
                Assert(counts.SharedFiles === files.length, `${key}: Shared files match their own reads (${counts.SharedFiles} vs ${files.length})`);

                // Awaiting approval: Invited seats other people wait on, in spaces where the role may invite
                const invited = await read(SPACE_MEMBER_ENTITY, `Status = 'Invited' AND UserID <> '${persona.User.ID}'`, ['ID']);
                Assert(counts.AwaitingApproval === invited.length, `${key}: invitations waiting match their own reads (${counts.AwaitingApproval} vs ${invited.length})`);

                // Open tasks: tasks filed in their spaces that are neither completed nor cancelled
                const [tasksEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', "Name = 'MJ_BizApps_Tasks: Tasks'", ['ID']);
                const items = await read(SPACE_ITEM_ENTITY, `EntityID = '${tasksEntity.ID}'`, ['ID', 'RecordID']);
                const ids = items.map((item) => (item.RecordID ?? '').replace(/^ID\|/i, '')).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
                const open = ids.length === 0 ? [] : await read('MJ_BizApps_Tasks: Tasks', `ID IN (${ids.map((id) => `'${id}'`).join(',')}) AND Status NOT IN ('Completed', 'Cancelled')`, ['ID']);
                Assert(counts.OpenTasks === open.length, `${key}: open tasks match their own reads, a cancelled task not counted (${counts.OpenTasks} vs ${open.length})`);
            }
        },
    },
    {
        Id: 'lifecycle.LC6',
        Name: "LC6 — Home's lists are the rows behind its counts: the same number up to the cut, each open task once, each invitation one the person's own reads find",
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const listLimit = 50;
            for (const key of ['ada', 'bea']) {
                const persona = await getPersonaContext(ctx, key);
                const client = new CollaborationClient((await getPersonaClientContext(ctx, key)).GraphQLProvider);
                const counts = await client.GetHomeCounts();
                const lists = await client.GetHomeLists();
                Assert(counts.Success && lists.Success, `${key}: the server reads Home's counts and lists: ${counts.ErrorMessage ?? ''} ${lists.ErrorMessage ?? ''}`);
                const invitations = lists.Invitations ?? [];
                const tasks = lists.OpenTasks ?? [];
                Assert(invitations.length === Math.min(counts.AwaitingApproval ?? -1, listLimit), `${key}: the invitations listed are the count, up to ${listLimit} (${invitations.length} vs ${counts.AwaitingApproval})`);
                Assert(tasks.length === Math.min(counts.OpenTasks ?? -1, listLimit), `${key}: the open tasks listed are the count, up to ${listLimit} (${tasks.length} vs ${counts.OpenTasks})`);
                Assert(new Set(tasks.map((task) => task.TaskID.toLowerCase())).size === tasks.length, `${key}: a task filed in two spaces is listed once`);
                Assert(tasks.every((task) => !!task.SpaceID && !!task.SpaceName), `${key}: each task names the space it opens in`);
                const asPersona = { ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext;
                const seenSeats = await FindRows<{ ID: string }>(asPersona, SPACE_MEMBER_ENTITY, "Status = 'Invited'", ['ID'], persona.User, { BypassCache: true });
                const seen = new Set(seenSeats.map((seat) => seat.ID.toLowerCase()));
                Assert(invitations.every((invitation) => seen.has(invitation.SeatID.toLowerCase()) && invitation.Person.length > 0), `${key}: every invitation listed is one their own reads find, with a name`);
            }
        },
    },
    {
        Id: 'lifecycle.LC5',
        Name: "LC5 — Home's queries can't be run directly by a participant, who could otherwise read someone else's spaces with a UserID of their choosing",
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await getPersonaClientContext(ctx, 'bea');
            const ada = await getPersonaContext(ctx, 'ada');
            for (const queryName of ['Collaboration Home Counts', 'Collaboration Home Invitations', 'Collaboration Home Open Tasks']) {
                const run = await new RunQuery(bea.GraphQLProvider).RunQuery(
                    { QueryName: queryName, CategoryPath: 'Collaboration', Parameters: { UserID: ada.User.ID } },
                    bea.User,
                ).catch((error: unknown) => ({ Success: false, ErrorMessage: error instanceof Error ? error.message : String(error), Results: [] as unknown[] }));
                Assert(!run.Success, `A participant running ${queryName} directly, for Ada, is refused`);
                Assert(/permission|not allowed|denied/i.test(run.ErrorMessage ?? ''), `The refusal says why: ${run.ErrorMessage ?? ''}`);
                Assert((run.Results ?? []).length === 0, 'and is given no rows');
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('lifecycle', {
    Setup: async () => {},
    Teardown: async () => {},
});
