import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { mjBizAppsCollabExamplesExampleBoardEntity } from '@mj-biz-apps/collaboration-example-space-types/server';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceMemberEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
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

                // Reload through the parent: the child is found again, and an edit of its own column saves
                await seatOwner(ctx, id);
                const reloaded = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
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
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('subtypes', {
    Setup: async () => {},
    Teardown: async () => {},
});
