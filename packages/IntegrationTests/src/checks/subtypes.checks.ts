import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { mjBizAppsCollabExamplesExampleBoardEntity } from '@mj-biz-apps/collaboration-example-space-types/server';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceMemberEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { createSpace } from '@mj-biz-apps/collaboration-core-entities-server';
import { SPACE_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY, SPACE_TYPE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';
import { CHECK_SPACE_PREFIX } from '../world/ids.js';
import { cleanupSpace, registerChecks } from './cleanup-helpers.js';

const BOARDS = 'MJ_BizApps_Collaboration_Examples: Example Boards';
const ROOMS = 'MJ_BizApps_Collaboration_Examples: Example Rooms';

async function typeId(ctx: IntegrationCheckContext, code: string): Promise<string> {
    const [row] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, `Code = '${code}'`, ['ID']);
    Assert(!!row, `The ${code} type is on this host (run "pnpm run mj:push:tests" once per database)`);
    return row.ID;
}

/** Ada seats herself as the owner of a space, so she may close it: a board can't be deleted while it is open. */
async function seatOwner(ctx: IntegrationCheckContext, spaceId: string): Promise<void> {
    const ada = await GetPersonaUser(ctx, 'ada');
    const [role] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
    const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
    seat.NewRecord();
    seat.SpaceID = spaceId;
    seat.UserID = ada.ID;
    seat.SpaceRoleTypeID = role.ID;
    seat.Band = 'Team';
    seat.Status = 'Active';
    Assert(await seat.Save(), `Ada is seated as the owner: ${seat.LatestResult?.CompleteMessage ?? ''}`);
}

/** Ada, an owner of the space, seats another person in it. */
async function seatOther(ctx: IntegrationCheckContext, spaceId: string, personaKey: string, roleFilter: string): Promise<void> {
    const ada = await GetPersonaUser(ctx, 'ada');
    const person = await GetPersonaUser(ctx, personaKey);
    const [role] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, roleFilter, ['ID']);
    const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
    seat.NewRecord();
    seat.SpaceID = spaceId;
    seat.UserID = person.ID;
    seat.SpaceRoleTypeID = role.ID;
    seat.Band = 'Team';
    seat.Status = 'Active';
    Assert(await seat.Save(), `Ada seats ${personaKey}: ${seat.LatestResult?.CompleteMessage ?? ''}`);
}

const checks: NamedCheck[] = [
    {
        Id: 'subtypes.ST1',
        Name: "ST1 — an example-board space is created as its subtype in one save (NewRecord, EnsureISAChild, Save): both rows exist, TermName edits and reloads, and deleting the space deletes both rows",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const boardType = await typeId(ctx, 'example-board');
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            space.NewRecord();
            space.Name = `${CHECK_SPACE_PREFIX}ST1 board ${Date.now()}`;
            space.SpaceTypeID = boardType;
            space.OwnerID = ada.ID;
            space.InheritsMembership = false;
            // The type says which subtype this space is: the resolver answers from the type, and the child is attached to the parent
            const child = await space.EnsureISAChild();
            Assert(!!child && child.EntityInfo.Name === BOARDS, `The space's type names ${BOARDS}, and EnsureISAChild attaches it (got ${child?.EntityInfo.Name ?? 'nothing'})`);
            const board = space.LeafEntity as mjBizAppsCollabExamplesExampleBoardEntity;
            board.TermName = '2026 to 2027';
            board.QuorumPercentage = 60;
            const savedOk = await board.Save();
            Assert(savedOk, `One save writes both tables: ${board.LatestResult?.CompleteMessage ?? ''}`);
            const id = space.ID;
            try {
                Assert((await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${id}'`, ['ID'], ada, { BypassCache: true })).length === 1, 'The Space row exists');
                const [boardRow] = await FindRows<{ ID: string; TermName: string; QuorumPercentage: number }>(ctx, BOARDS, `ID = '${id}'`, ['ID', 'TermName', 'QuorumPercentage'], ada, { BypassCache: true });
                Assert(boardRow?.TermName === '2026 to 2027' && boardRow.QuorumPercentage === 60, `The ExampleBoard row exists with its own columns: ${JSON.stringify(boardRow)}`);

                // Reload through the parent: the child is found again, and an edit of its own column saves. Dev holds Configure Spaces, and Ada seats Dev as an owner.
                await seatOwner(ctx, id);
                await seatOther(ctx, id, 'dev', "Code = 'owner'");
                const dev = await GetPersonaUser(ctx, 'dev');
                const reloaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await reloaded.Load(id), 'The space reloads');
                const leaf = reloaded.LeafEntity as mjBizAppsCollabExamplesExampleBoardEntity;
                Assert(leaf.EntityInfo.Name === BOARDS && leaf.TermName === '2026 to 2027', 'Its subtype comes back with it');
                leaf.TermName = '2027 to 2028';
                Assert(await leaf.Save(), `TermName edits: ${leaf.LatestResult?.CompleteMessage ?? ''}`);
                const again = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await again.Load(id), 'It reloads again');
                Assert((again.LeafEntity as mjBizAppsCollabExamplesExampleBoardEntity).TermName === '2027 to 2028', 'The edit is what comes back');

                // A board is closed before it is deleted; then one delete takes both rows
                again.ClosedAt = new Date(Date.now() - 60_000);
                Assert(await again.Save(), `The board closes: ${again.LatestResult?.CompleteMessage ?? ''}`);
                const doomed = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                Assert(await doomed.Load(id), 'The closed board loads for the harness user');
                await cleanupSpace(ctx.Provider, ctx.User, id);
                Assert((await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${id}'`, ['ID'], undefined, { BypassCache: true })).length === 0, 'The Space row is gone');
                Assert((await FindRows<{ ID: string }>(ctx, BOARDS, `ID = '${id}'`, ['ID'], undefined, { BypassCache: true })).length === 0, 'The ExampleBoard row is gone with it');
            } finally {
                const leftover = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${id}'`, ['ID'], undefined, { BypassCache: true });
                if (leftover.length) await cleanupSpace(ctx.Provider, ctx.User, id);
            }
        },
    },
    {
        Id: 'subtypes.ST4',
        Name: "ST4 — a change to only a subtype's own columns meets the space's rules: an owner without Configure Spaces and a plain member are refused, and Dev, an owner who holds it, is allowed",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const boardType = await typeId(ctx, 'example-board');
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            space.NewRecord();
            space.Name = `${CHECK_SPACE_PREFIX}ST4 board ${Date.now()}`;
            space.SpaceTypeID = boardType;
            space.OwnerID = ada.ID;
            space.InheritsMembership = false;
            await space.EnsureISAChild();
            (space.LeafEntity as mjBizAppsCollabExamplesExampleBoardEntity).TermName = 'Original';
            Assert(await space.LeafEntity.Save(), `Ada creates a board: ${space.LeafEntity.LatestResult?.CompleteMessage ?? ''}`);
            const id = space.ID;
            try {
                await seatOwner(ctx, id);
                await seatOther(ctx, id, 'dev', "Code = 'owner'");
                await seatOther(ctx, id, 'bea', 'CanSeeTeamBand = 1 AND IsOwnerRole = 0');
                const editAs = async (personaKey: string, term: string) => {
                    const user = await GetPersonaUser(ctx, personaKey);
                    const loaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, user);
                    Assert(await loaded.Load(id), `${personaKey} loads the board`);
                    const leaf = loaded.LeafEntity as mjBizAppsCollabExamplesExampleBoardEntity;
                    leaf.TermName = term;
                    return { saved: await leaf.Save(), message: leaf.LatestResult?.CompleteMessage ?? '' };
                };
                const termNow = async () => (await FindRows<{ TermName: string }>(ctx, BOARDS, `ID = '${id}'`, ['TermName'], undefined, { BypassCache: true }))[0]?.TermName;

                const owner = await editAs('ada', 'By Ada');
                Assert(!owner.saved && /Configure Spaces/.test(owner.message), `An owner without Configure Spaces is refused: ${owner.message}`);
                const member = await editAs('bea', 'By Bea');
                Assert(!member.saved && /Configure Spaces/.test(member.message), `A plain member is refused: ${member.message}`);
                Assert((await termNow()) === 'Original', 'Neither refused edit changed the row');
                const dev = await editAs('dev', 'By Dev');
                Assert(dev.saved, `Dev, an owner who holds Configure Spaces, is allowed: ${dev.message}`);
                Assert((await termNow()) === 'By Dev', 'and the row changed');
            } finally {
                const [closed] = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${id}' AND ClosedAt IS NOT NULL`, ['ID'], undefined, { BypassCache: true });
                if (!closed) {
                    const loaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                    if (await loaded.Load(id)) {
                        loaded.ClosedAt = new Date(Date.now() - 60_000);
                        await loaded.Save();
                    }
                }
                await cleanupSpace(ctx.Provider, ctx.User, id);
            }
        },
    },
    {
        Id: 'subtypes.ST2',
        Name: 'ST2 — a type and its subtype go together: a plain save under a subtype type, and a subtype save under a plain type, are refused; a plain type still creates a plain space',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const boardType = await typeId(ctx, 'example-board');
            const workspaceType = await typeId(ctx, 'workspace');

            // A plain Space under a type that names a subtype: refused, and nothing is written
            const plain = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            plain.NewRecord();
            plain.Name = `${CHECK_SPACE_PREFIX}ST2 plain ${Date.now()}`;
            plain.SpaceTypeID = boardType;
            plain.OwnerID = ada.ID;
            plain.InheritsMembership = false;
            const plainSaved = await plain.Save();
            if (plainSaved) await cleanupSpace(ctx.Provider, ctx.User, plain.ID);
            Assert(!plainSaved, 'A plain space under a type that names a subtype must be refused');
            Assert(/keeps its details in .*Example Boards/.test(plain.LatestResult?.CompleteMessage ?? ''), `The refusal says where the details live: ${plain.LatestResult?.CompleteMessage ?? ''}`);

            // A board saved under a type that names none: refused
            const board = await ctx.Provider.GetEntityObject<mjBizAppsCollabExamplesExampleBoardEntity>(BOARDS, ada);
            board.NewRecord();
            board.Name = `${CHECK_SPACE_PREFIX}ST2 board ${Date.now()}`;
            board.SpaceTypeID = workspaceType;
            board.OwnerID = ada.ID;
            board.InheritsMembership = false;
            board.TermName = 'x';
            const boardSaved = await board.Save();
            if (boardSaved) await cleanupSpace(ctx.Provider, ctx.User, board.ID);
            Assert(!boardSaved, 'A board saved under a type that names no subtype must be refused');
            Assert(/names no subtype/.test(board.LatestResult?.CompleteMessage ?? ''), `The refusal says the type names none: ${board.LatestResult?.CompleteMessage ?? ''}`);

            // A plain type still makes a plain space, with no subtype row
            const ok = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            ok.NewRecord();
            ok.Name = `${CHECK_SPACE_PREFIX}ST2 workspace ${Date.now()}`;
            ok.SpaceTypeID = workspaceType;
            ok.OwnerID = ada.ID;
            ok.InheritsMembership = false;
            try {
                Assert(await ok.Save(), `A plain type creates a plain space: ${ok.LatestResult?.CompleteMessage ?? ''}`);
                Assert((await FindRows<{ ID: string }>(ctx, BOARDS, `ID = '${ok.ID}'`, ['ID'], undefined, { BypassCache: true })).length === 0, 'and no subtype row');
                const loaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await loaded.Load(ok.ID) && loaded.LeafEntity === loaded, 'A plain space loads as itself');
            } finally {
                if (ok.IsSaved) await cleanupSpace(ctx.Provider, ctx.User, ok.ID);
            }
        },
    },
    {
        Id: 'subtypes.ST3',
        Name: 'ST3 — a space type may name only an entity that is an IsA child of Spaces',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const dev = await GetPersonaUser(ctx, 'dev');
            const source = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, dev);
            Assert(await source.Load(await typeId(ctx, 'example-room')), 'The example room type loads');
            const type = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, dev);
            type.NewRecord();
            type.Code = `st3-${Date.now()}`;
            type.Name = `${CHECK_SPACE_PREFIX}st3 type`;
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
            type.SpaceExtensionEntity = SPACE_TYPE_ENTITY;
            const saved = await type.Save();
            if (saved) await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, ctx.User).then(async (t) => { if (await t.Load(type.ID)) await t.Delete(); });
            Assert(!saved, 'A type naming an entity that is not a subtype of Spaces must be refused');
            Assert(/is not an IsA child of/.test(type.LatestResult?.CompleteMessage ?? ''), `The refusal says so: ${type.LatestResult?.CompleteMessage ?? ''}`);

            // The two example types name their own subtypes, and pass
            const board = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, dev);
            Assert(await board.Load(await typeId(ctx, 'example-board')), 'The board type loads');
            Assert(board.SpaceExtensionEntity === BOARDS, `The board type names ${BOARDS}`);
            const room = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(SPACE_TYPE_ENTITY, dev);
            Assert(await room.Load(await typeId(ctx, 'example-room')), 'The room type loads');
            Assert(room.SpaceExtensionEntity === ROOMS, `The room type names ${ROOMS}`);
        },
    },
    {
        Id: 'subtypes.ST5',
        Name: "ST5 — a save of only a board's own column reaches the type's driver with the old value and the new one: lowering an open board's quorum is refused, naming both, and raising it lands",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const dev = await GetPersonaUser(ctx, 'dev');
            const boardType = await typeId(ctx, 'example-board');
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            space.NewRecord();
            space.Name = `${CHECK_SPACE_PREFIX}ST5 board ${Date.now()}`;
            space.SpaceTypeID = boardType;
            space.OwnerID = ada.ID;
            space.InheritsMembership = false;
            await space.EnsureISAChild();
            const board = space.LeafEntity as mjBizAppsCollabExamplesExampleBoardEntity;
            board.TermName = 'Original';
            board.QuorumPercentage = 60;
            Assert(await board.Save(), `Ada creates a board: ${board.LatestResult?.CompleteMessage ?? ''}`);
            const id = space.ID;
            try {
                await seatOwner(ctx, id);
                await seatOther(ctx, id, 'dev', "Code = 'owner'");
                // Dev holds Configure Spaces and an owner seat, so only the driver's own rule decides
                const setQuorum = async (quorum: number) => {
                    const loaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
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
                const [closed] = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, `ID = '${id}' AND ClosedAt IS NOT NULL`, ['ID'], undefined, { BypassCache: true });
                if (!closed) {
                    const loaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                    if (await loaded.Load(id)) {
                        loaded.ClosedAt = new Date(Date.now() - 60_000);
                        await loaded.Save();
                    }
                }
                await cleanupSpace(ctx.Provider, ctx.User, id);
            }
        },
    },
    {
        Id: 'subtypes.ST6',
        Name: 'ST6 — creating a space with its subtype logs no error: neither CreateSpace nor EnsureISAChild on a new space reads a subtype row that cannot exist yet',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const boardType = await typeId(ctx, 'example-board');
            // LogError lands on console.error: everything written there while a space is created is what this check judges
            const logged: string[] = [];
            const consoleError = console.error;
            console.error = (...args: unknown[]) => { logged.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')); };
            let id: string | null = null;
            try {
                const made = await createSpace(ctx.Provider as unknown as Parameters<typeof createSpace>[0], ada, { TypeID: boardType, Name: `${CHECK_SPACE_PREFIX}ST6 board ${Date.now()}`, Details: { TermName: 'Original' } });
                Assert(made.status === 'created', `CreateSpace makes a board: ${made.status === 'refused' ? made.message : ''}`);
                id = made.status === 'created' ? made.spaceId : null;
                const fresh = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                fresh.NewRecord();
                fresh.SpaceTypeID = boardType;
                Assert(!!(await fresh.EnsureISAChild()), 'EnsureISAChild on a new space attaches its subtype');
            } finally {
                console.error = consoleError;
            }
            const loadErrors = logged.filter((line) => /load|row|IS-A|ISA/i.test(line));
            Assert(loadErrors.length === 0, `Nothing about a load or a row was logged while the space was created: ${JSON.stringify(loadErrors)}`);
            if (id) {
                const loaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                if (await loaded.Load(id)) {
                    loaded.ClosedAt = new Date(Date.now() - 60_000);
                    Assert(await loaded.Save(), `The board is closed before it is removed: ${loaded.LatestResult?.CompleteMessage ?? ''}`);
                }
                await cleanupSpace(ctx.Provider, ctx.User, id);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('subtypes', {
    Setup: async () => {},
    Teardown: async () => {},
});
