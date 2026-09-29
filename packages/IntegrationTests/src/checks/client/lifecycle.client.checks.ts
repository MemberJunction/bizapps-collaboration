import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY, SPACE_TYPE_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaContext } from '../../wire.js';
import { CHECK_SPACE_PREFIX } from '../../world/ids.js';
import { cleanupSpace, cleanupStep, registerChecks } from '../cleanup-helpers.js';

type PersonaContext = Awaited<ReturnType<typeof getPersonaContext>>;

/** The test type whose spaces close with no post-close access at all (`Configuration.PostCloseAccess` is None). */
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

/** Closes a space as its owner and reads it back: the row must carry a ClosedAt, and 'None' post-close access. */
async function close(persona: PersonaContext, spaceId: string): Promise<void> {
    const space = await persona.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, persona.User);
    Assert(await space.Load(spaceId), 'The space to close loads');
    space.ClosedAt = new Date(Date.now() - 60_000);
    Assert(await space.Save(), `The space closes: ${space.LatestResult?.CompleteMessage ?? ''}`);
    Assert(space.PostCloseAccess === 'None', `The close wrote the resolved post-close access (None), got ${space.PostCloseAccess}`);
}

/** Removes what a check made: reopen (so the harness can delete it), then delete the space and its seats. */
async function remove(ctx: IntegrationCheckContext, spaceId: string): Promise<void> {
    await cleanupStep(async () => {
        const staff = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
        if (await staff.Load(spaceId) && staff.ClosedAt) {
            staff.ClosedAt = null;
            await staff.Save();
        }
    });
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
            } finally {
                if (child) await cleanupSpace(ctx.Provider, ctx.User, child.ID);
                await remove(ctx, parent.ID);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('lifecycle', {
    Setup: async () => {},
    Teardown: async () => {},
});
