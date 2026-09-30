import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient, mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
// The subtype's entity classes, and nothing else the package loads: the server's drivers would register server rules in this client process
import { mjBizAppsCollabExamplesExampleBoardEntity } from '@mj-biz-apps/collaboration-example-space-types/entities';

void mjBizAppsCollabExamplesExampleBoardEntity;
import { SPACE_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY, SPACE_TYPE_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext, getPersonaContext } from '../../wire.js';
import { CHECK_SPACE_PREFIX } from '../../world/ids.js';
import { cleanupSpace, registerChecks } from '../cleanup-helpers.js';

const BOARDS = 'MJ_BizApps_Collaboration_Examples: Example Boards';

type PersonaContext = Awaited<ReturnType<typeof getPersonaContext>>;

async function boardTypeId(ctx: IntegrationCheckContext): Promise<string> {
    const [type] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'example-board'", ['ID']);
    Assert(!!type, "The example board type is on this host (run the test metadata push: 'mj:push:tests')");
    return type.ID;
}

/** Ada, an owner of the space, seats another person over the wire. */
async function seatOther(ada: PersonaContext, spaceId: string, userId: string, roleFilter: string, ctx: IntegrationCheckContext): Promise<void> {
    const [role] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, roleFilter, ['ID']);
    const seat = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada.User);
    seat.NewRecord();
    seat.SpaceID = spaceId;
    seat.UserID = userId;
    seat.SpaceRoleTypeID = role.ID;
    seat.Band = 'Team';
    seat.Status = 'Active';
    Assert(await seat.Save(), `A seat is saved: ${seat.LatestResult?.CompleteMessage ?? ''}`);
}

/** Closes a space as its owner (an open board is not deleted), then removes it and what hangs on it. */
async function closeAndRemove(ctx: IntegrationCheckContext, ada: PersonaContext, spaceId: string): Promise<void> {
    const space = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada.User);
    if (await space.Load(spaceId) && !space.ClosedAt) {
        space.ClosedAt = new Date(Date.now() - 60_000);
        await space.Save();
    }
    await cleanupSpace(ctx.Provider, ctx.User, spaceId);
}

const checks: NamedCheck[] = [
    {
        Id: 'subtypes.SC1',
        Name: 'SC1 — CreateSpace makes a board and seats its maker as an active owner in one transaction: both rows exist, with the details sent',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const client = new CollaborationClient((await getPersonaClientContext(ctx, 'ada')).GraphQLProvider);
            const name = `${CHECK_SPACE_PREFIX}SC1 board ${Date.now()}`;
            const made = await client.CreateSpace({ TypeID: await boardTypeId(ctx), Name: name, Description: 'made over the wire', Details: { TermName: '2026 to 2027', QuorumPercentage: 60, NextMeetingDate: '2026-10-02T15:00:00.000Z' } });
            Assert(made.Success && !!made.SpaceID, `CreateSpace succeeds: ${made.ErrorMessage ?? ''}`);
            const id = made.SpaceID as string;
            try {
                const [space] = await FindRows<{ ID: string; Name: string; OwnerID: string; Description: string }>(ctx, SPACE_ENTITY, `ID = '${id}'`, ['ID', 'Name', 'OwnerID', 'Description'], undefined, { BypassCache: true });
                Assert(space?.Name === name && space.Description === 'made over the wire' && space.OwnerID.toLowerCase() === ada.User.ID.toLowerCase(), `The space row is the one asked for, owned by Ada: ${JSON.stringify(space)}`);
                const [board] = await FindRows<{ TermName: string; QuorumPercentage: number; NextMeetingDate: Date | string | null }>(ctx, BOARDS, `ID = '${id}'`, ['TermName', 'QuorumPercentage', 'NextMeetingDate'], undefined, { BypassCache: true });
                Assert(board?.TermName === '2026 to 2027' && board.QuorumPercentage === 60, `The subtype row holds the details: ${JSON.stringify(board)}`);
                Assert(!!board.NextMeetingDate && new Date(board.NextMeetingDate).toISOString() === '2026-10-02T15:00:00.000Z', `A date sent as text is stored as that date: ${String(board.NextMeetingDate)}`);
                const seats = await FindRows<{ UserID: string; Status: string; Band: string; SpaceRoleTypeID: string }>(ctx, SPACE_MEMBER_ENTITY, `SpaceID = '${id}'`, ['UserID', 'Status', 'Band', 'SpaceRoleTypeID'], undefined, { BypassCache: true });
                const [ownerRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
                Assert(seats.length === 1 && seats[0].UserID.toLowerCase() === ada.User.ID.toLowerCase() && seats[0].Status.trim() === 'Active' && seats[0].Band.trim() === 'Team' && seats[0].SpaceRoleTypeID.toLowerCase() === ownerRole.ID.toLowerCase(), `Ada is the one seat: an active owner on the Team band: ${JSON.stringify(seats)}`);
            } finally {
                await closeAndRemove(ctx, ada, id);
            }
        },
    },
    {
        Id: 'subtypes.SC2',
        Name: "SC2 — CreateSpace refuses what a space can't be made from, and leaves nothing behind: a missing required detail, a detail the subtype doesn't add, and a person who doesn't hold Administer Spaces",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const typeId = await boardTypeId(ctx);
            const adaClient = new CollaborationClient((await getPersonaClientContext(ctx, 'ada')).GraphQLProvider);
            const beaClient = new CollaborationClient((await getPersonaClientContext(ctx, 'bea')).GraphQLProvider);
            const stamp = Date.now();
            const named = (label: string) => `${CHECK_SPACE_PREFIX}SC2 ${label} ${stamp}`;
            const left = async (label: string) => (await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `Name = '${named(label)}'`, ['ID'], undefined, { BypassCache: true })).length;

            const noTerm = await adaClient.CreateSpace({ TypeID: typeId, Name: named('no term'), Details: { QuorumPercentage: 60 } });
            Assert(!noTerm.Success, 'A board without its required TermName is refused');
            Assert((await left('no term')) === 0, 'and no space is left behind');

            const unknown = await adaClient.CreateSpace({ TypeID: typeId, Name: named('unknown'), Details: { TermName: 'x', Name: 'sneaked in' } });
            Assert(!unknown.Success && /not a detail/.test(unknown.ErrorMessage ?? ''), `A detail that is the space's own column is refused, saying so: ${unknown.ErrorMessage ?? ''}`);
            Assert((await left('unknown')) === 0, 'and no space is left behind');

            const notAdmin = await beaClient.CreateSpace({ TypeID: typeId, Name: named('bea'), Details: { TermName: 'x' } });
            Assert(!notAdmin.Success && /Administer Spaces/.test(notAdmin.ErrorMessage ?? ''), `Someone without Administer Spaces cannot make a top-level space: ${notAdmin.ErrorMessage ?? ''}`);
            Assert((await left('bea')) === 0, 'and no space is left behind');

            const noName = await adaClient.CreateSpace({ TypeID: typeId, Name: '   ' });
            Assert(!noName.Success, 'A space needs a name');
        },
    },
    {
        Id: 'subtypes.SC3',
        Name: "SC3 — over the wire, a board's own columns are saved only by an owner who holds Configure Spaces: Dev's save lands, an owner without it and a plain member are refused, and the row is unchanged",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const dev = await getPersonaContext(ctx, 'dev');
            const bea = await getPersonaContext(ctx, 'bea');
            const client = new CollaborationClient((await getPersonaClientContext(ctx, 'ada')).GraphQLProvider);
            const made = await client.CreateSpace({ TypeID: await boardTypeId(ctx), Name: `${CHECK_SPACE_PREFIX}SC3 board ${Date.now()}`, Details: { TermName: 'Original' } });
            Assert(made.Success && !!made.SpaceID, `CreateSpace succeeds: ${made.ErrorMessage ?? ''}`);
            const id = made.SpaceID as string;
            try {
                await seatOther(ada, id, dev.User.ID, "Code = 'owner'", ctx);
                await seatOther(ada, id, bea.User.ID, 'CanSeeTeamBand = 1 AND IsOwnerRole = 0', ctx);
                const editAs = async (persona: PersonaContext, term: string) => {
                    const loaded = await persona.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, persona.User);
                    Assert(await loaded.Load(id), `${persona.User.Name} loads the board`);
                    const leaf = loaded.LeafEntity as mjBizAppsCollabExamplesExampleBoardEntity;
                    Assert(leaf.EntityInfo.Name === BOARDS, `${persona.User.Name} gets the board's subtype through the space: ${leaf.EntityInfo.Name}`);
                    leaf.TermName = term;
                    return { saved: await leaf.Save(), message: leaf.LatestResult?.CompleteMessage ?? '' };
                };
                const termNow = async () => (await FindRows<{ TermName: string }>(ctx, BOARDS, `ID = '${id}'`, ['TermName'], undefined, { BypassCache: true }))[0]?.TermName;

                const owner = await editAs(ada, 'By Ada');
                Assert(!owner.saved && /Configure Spaces/.test(owner.message), `An owner without Configure Spaces is refused: ${owner.message}`);
                const member = await editAs(bea, 'By Bea');
                Assert(!member.saved && /Configure Spaces/.test(member.message), `A plain member is refused: ${member.message}`);
                Assert((await termNow()) === 'Original', 'Neither refused save changed the row');
                const allowed = await editAs(dev, 'By Dev');
                Assert(allowed.saved, `Dev, an owner who holds Configure Spaces, saves: ${allowed.message}`);
                Assert((await termNow()) === 'By Dev', 'and the row changed');
            } finally {
                await closeAndRemove(ctx, ada, id);
            }
        },
    },
    {
        Id: 'subtypes.SC4',
        Name: "SC4 — a client's save of only a board's own column reaches the type's driver with the old value and the new one: lowering an open board's quorum is refused, naming both, and raising it lands",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const dev = await getPersonaContext(ctx, 'dev');
            const client = new CollaborationClient((await getPersonaClientContext(ctx, 'ada')).GraphQLProvider);
            const made = await client.CreateSpace({ TypeID: await boardTypeId(ctx), Name: `${CHECK_SPACE_PREFIX}SC4 board ${Date.now()}`, Details: { TermName: 'Original', QuorumPercentage: 60 } });
            Assert(made.Success && !!made.SpaceID, `CreateSpace succeeds: ${made.ErrorMessage ?? ''}`);
            const id = made.SpaceID as string;
            try {
                await seatOther(ada, id, dev.User.ID, "Code = 'owner'", ctx);
                // Dev holds Configure Spaces and an owner seat, so only the driver's own rule decides
                const setQuorum = async (quorum: number) => {
                    const loaded = await dev.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev.User);
                    Assert(await loaded.Load(id), 'Dev loads the board');
                    const leaf = loaded.LeafEntity as mjBizAppsCollabExamplesExampleBoardEntity;
                    leaf.QuorumPercentage = quorum;
                    return { saved: await leaf.Save(), message: leaf.LatestResult?.CompleteMessage ?? '' };
                };
                const quorumNow = async () => (await FindRows<{ QuorumPercentage: number }>(ctx, BOARDS, `ID = '${id}'`, ['QuorumPercentage'], undefined, { BypassCache: true }))[0]?.QuorumPercentage;

                const lowered = await setQuorum(50);
                Assert(!lowered.saved && /60% to 50%/.test(lowered.message), `Lowering the quorum is refused by the driver, which names the old value and the new one: ${lowered.message}`);
                Assert((await quorumNow()) === 60, 'The refused save changed nothing');
                const raised = await setQuorum(75);
                Assert(raised.saved, `Raising the quorum is allowed: ${raised.message}`);
                Assert((await quorumNow()) === 75, 'and the row changed');
            } finally {
                await closeAndRemove(ctx, ada, id);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('subtypes', {
    Setup: async () => {},
    Teardown: async () => {},
});
