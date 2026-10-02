/**
 * Stage 1 over the wire: the personas act through MJAPI (GraphQL), so the row filters and the gates are seen as a browser sees them.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    mjBizAppsCollaborationSpaceAnchorEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceGrantEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceMemberPinEntity,
    mjBizAppsCollaborationSpaceNoteEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    AI_AGENT_ENTITY,
    SPACE_ANCHOR_ENTITY,
    SPACE_ENTITY,
    SPACE_GRANT_ENTITY,
    SPACE_ITEM_ENTITY,
    SPACE_MEMBER_ENTITY,
    SPACE_MEMBER_PIN_ENTITY,
    SPACE_NOTE_ENTITY,
    SPACE_ROLE_TYPE_ENTITY,
    SPACE_TYPE_STATUS_ENTITY,
} from '../../entity-names.js';
import { FindRows, getPersonaContext } from '../../wire.js';
import { CHECK_SPACE_PREFIX } from '../../world/ids.js';
import { cleanupSpace, cleanupStep, deleteWhere, registerChecks } from '../cleanup-helpers.js';

const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
type Persona = Awaited<ReturnType<typeof getPersonaContext>>;

const asPersona = (ctx: IntegrationCheckContext, persona: Persona): IntegrationCheckContext => ({ ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext);

async function statusId(ctx: IntegrationCheckContext, typeId: string, code: string): Promise<string> {
    const [row] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_STATUS_ENTITY, `SpaceTypeID = '${typeId}' AND Code = '${code}'`, ['ID']);
    Assert(!!row, `The type declares the status ${code}`);
    return row.ID;
}

/** A marked sub-space of Northwind, created over the wire by Ada, inheriting Northwind's roster. */
async function childOfNorthwind(ctx: IntegrationCheckContext, ada: Persona, label: string): Promise<mjBizAppsCollaborationSpaceEntity> {
    const [northwind] = await FindRows<{ SpaceTypeID: string }>(ctx, SPACE_ENTITY, `ID = '${NORTHWIND_SPACE_ID}'`, ['SpaceTypeID']);
    const space = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada.User);
    space.NewRecord();
    space.Name = `${CHECK_SPACE_PREFIX}S1C-${label}-${Date.now()}`;
    space.SpaceTypeID = northwind.SpaceTypeID;
    space.ParentID = NORTHWIND_SPACE_ID;
    space.InheritsMembership = true;
    space.OwnerID = ada.User.ID;
    Assert(await space.Save() && !!space.ID, `Ada creates ${label} over the wire: ${space.LatestResult?.CompleteMessage ?? ''}`);
    return space;
}

async function seat(ctx: IntegrationCheckContext, as: Persona, spaceId: string, userId: string, roleCode: string, band: 'Team' | 'Shared'): Promise<void> {
    const [role] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, `Code = '${roleCode}'`, ['ID']);
    const row = await as.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, as.User);
    row.NewRecord();
    row.SpaceID = spaceId;
    row.UserID = userId;
    row.SpaceRoleTypeID = role.ID;
    row.Band = band;
    row.Status = 'Active';
    Assert(await row.Save(), `A ${roleCode} seat: ${row.LatestResult?.CompleteMessage ?? ''}`);
}

const checks: NamedCheck[] = [
    {
        Id: 'stage1.SC1',
        Name: 'SC1 — over the wire: a participant reads the statuses of the active types, and none of the grants',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await getPersonaContext(ctx, 'bea');
            const [northwind] = await FindRows<{ SpaceTypeID: string }>(ctx, SPACE_ENTITY, `ID = '${NORTHWIND_SPACE_ID}'`, ['SpaceTypeID']);
            const statuses = await FindRows<{ Code: string }>(asPersona(ctx, bea), SPACE_TYPE_STATUS_ENTITY, `SpaceTypeID = '${northwind.SpaceTypeID}'`, ['Code'], bea.User, { BypassCache: true });
            Assert(statuses.map((s) => s.Code).sort().join(',') === 'active,archived,closed,paused', `Bea reads the workspace type's four statuses: ${statuses.map((s) => s.Code).join(',')}`);
            let grants: unknown[] = [];
            let refused = false;
            try {
                grants = await FindRows<{ ID: string }>(asPersona(ctx, bea), SPACE_GRANT_ENTITY, 'ID IS NOT NULL', ['ID'], bea.User, { BypassCache: true });
            } catch {
                refused = true;
            }
            Assert(refused || grants.length === 0, `A participant reads no grant (${grants.length})`);
        },
    },
    {
        Id: 'stage1.SC2',
        Name: 'SC2 — over the wire: the owner pauses a space, a member still reads it but cannot write, the owner makes it Active again; a close is terminal',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const bea = await getPersonaContext(ctx, 'bea');
            const space = await childOfNorthwind(ctx, ada, 'status');
            try {
                const typeId = space.SpaceTypeID;
                await seat(ctx, ada, space.ID, bea.User.ID, 'member', 'Team');
                space.StatusID = await statusId(ctx, typeId, 'paused');
                Assert(await space.Save(), `Ada pauses over the wire: ${space.LatestResult?.CompleteMessage ?? ''}`);
                const beaReads = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea.User);
                Assert(await beaReads.Load(space.ID), 'Bea reads the Paused space');
                const note = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, bea.User);
                note.NewRecord();
                note.SpaceID = space.ID;
                note.AuthorUserID = bea.User.ID; // over the wire the client's required-field check runs before the server stamps the caller
                note.Title = 'While paused';
                note.Band = 'Team';
                note.Visibility = 'Space';
                Assert(!(await note.Save()), 'A note in a Paused space is refused over the wire');
                space.StatusID = await statusId(ctx, typeId, 'active');
                Assert(await space.Save(), `Ada makes it Active: ${space.LatestResult?.CompleteMessage ?? ''}`);
                Assert(await note.Save(), `The note goes in once Active: ${note.LatestResult?.CompleteMessage ?? ''}`);

                space.ClosedAt = new Date(Date.now() - 60_000);
                Assert(await space.Save(), `Ada closes: ${space.LatestResult?.CompleteMessage ?? ''}`);
                const [row] = await FindRows<{ StatusID: string }>(ctx, SPACE_ENTITY, `ID = '${space.ID}'`, ['StatusID']);
                const closed = await statusId(ctx, typeId, 'closed');
                Assert(row.StatusID.toLowerCase() === closed.toLowerCase(), 'The close moved the space to Closed');
                space.ClosedAt = null;
                Assert(!(await space.Save()), 'Closed is not reopened');
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_NOTE_ENTITY, `SpaceID = '${space.ID}'`, 'a stage 1 note'));
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
    {
        Id: 'stage1.SC3',
        Name: 'SC3 — over the wire: anchors are read for the spaces a participant reaches and no other; only Configure Spaces writes them',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const bea = await getPersonaContext(ctx, 'bea');
            const dana = await getPersonaContext(ctx, 'dana');
            const [filesEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', "Name = 'MJ: Files'", ['ID']);
            const [item] = await FindRows<{ RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `SpaceID = '${NORTHWIND_SPACE_ID}' AND EntityID = '${filesEntity.ID}'`, ['RecordID']);
            const space = await childOfNorthwind(ctx, ada, 'anchors');
            try {
                await seat(ctx, ada, space.ID, bea.User.ID, 'member', 'Team');
                // Ada (Configure Spaces through the UI role, owner of the space) writes an anchor over the wire
                const anchor = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceAnchorEntity>(SPACE_ANCHOR_ENTITY, ada.User);
                anchor.NewRecord();
                anchor.SpaceID = space.ID;
                anchor.SpaceTypeID = space.SpaceTypeID; // the client's required-field check runs before the server stamps the type
                anchor.EntityID = filesEntity.ID;
                anchor.RecordID = item.RecordID;
                anchor.Role = 'primary';
                anchor.IsPrimary = true;
                anchor.Sequence = 0;
                Assert(await anchor.Save(), `Ada anchors the space: ${anchor.LatestResult?.CompleteMessage ?? ''}`);
                // Bea, seated in the space, reads its anchor; Dana, seated elsewhere, does not
                const beaSees = await FindRows<{ ID: string }>(asPersona(ctx, bea), SPACE_ANCHOR_ENTITY, `SpaceID = '${space.ID}'`, ['ID'], bea.User, { BypassCache: true });
                Assert(beaSees.length === 1, `Bea reads the anchor of a space she reaches (${beaSees.length})`);
                const danaSees = await FindRows<{ ID: string }>(asPersona(ctx, dana), SPACE_ANCHOR_ENTITY, `SpaceID = '${space.ID}'`, ['ID'], dana.User, { BypassCache: true });
                Assert(danaSees.length === 0, `Dana, who does not reach the space, reads none (${danaSees.length})`);
                // Bea, a participant, cannot write one
                const beaAnchor = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceAnchorEntity>(SPACE_ANCHOR_ENTITY, bea.User);
                beaAnchor.NewRecord();
                beaAnchor.SpaceID = space.ID;
                beaAnchor.SpaceTypeID = space.SpaceTypeID;
                beaAnchor.EntityID = filesEntity.ID;
                beaAnchor.RecordID = item.RecordID;
                beaAnchor.Role = 'reference';
                beaAnchor.IsPrimary = false;
                beaAnchor.Sequence = 1;
                Assert(!(await beaAnchor.Save()), 'A participant cannot write an anchor');
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_ANCHOR_ENTITY, `SpaceID = '${space.ID}'`, 'a stage 1 anchor'));
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
    {
        Id: 'stage1.SC4',
        Name: "SC4 — over the wire: a guest's note lands Shared and a Team note is refused; the author alone edits; a guest reads only the Shared notes",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const bea = await getPersonaContext(ctx, 'bea');
            const dana = await getPersonaContext(ctx, 'dana');
            const space = await childOfNorthwind(ctx, ada, 'notes');
            try {
                await seat(ctx, ada, space.ID, bea.User.ID, 'member', 'Team');
                await seat(ctx, ada, space.ID, dana.User.ID, 'guest', 'Shared');
                const teamNote = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, bea.User);
                teamNote.NewRecord();
                teamNote.SpaceID = space.ID;
                teamNote.AuthorUserID = bea.User.ID;
                teamNote.Title = 'Team only';
                teamNote.Band = 'Team';
                teamNote.Visibility = 'Space';
                Assert(await teamNote.Save(), `Bea writes a Team note: ${teamNote.LatestResult?.CompleteMessage ?? ''}`);
                const guestTeam = await dana.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, dana.User);
                guestTeam.NewRecord();
                guestTeam.SpaceID = space.ID;
                guestTeam.AuthorUserID = dana.User.ID;
                guestTeam.Title = 'From Dana';
                guestTeam.Band = 'Team';
                guestTeam.Visibility = 'Space';
                Assert(!(await guestTeam.Save()), 'A guest cannot write a Team note');
                guestTeam.Band = 'Shared';
                Assert(await guestTeam.Save(), `A guest's Shared note goes in: ${guestTeam.LatestResult?.CompleteMessage ?? ''}`);
                const danaSees = await FindRows<{ ID: string }>(asPersona(ctx, dana), SPACE_NOTE_ENTITY, `SpaceID = '${space.ID}'`, ['ID'], dana.User, { BypassCache: true });
                Assert(danaSees.length === 1 && danaSees[0].ID.toLowerCase() === guestTeam.ID.toLowerCase(), `Dana reads the Shared note only (${danaSees.length})`);
                const edit = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, ada.User);
                Assert(await edit.Load(guestTeam.ID), "Ada reads Dana's note");
                edit.Title = 'Edited by Ada';
                Assert(!(await edit.Save()), 'Only the author edits a note');
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_NOTE_ENTITY, `SpaceID = '${space.ID}'`, 'a stage 1 note'));
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
    {
        Id: 'stage1.SC5',
        Name: "SC5 — over the wire: a pin is the caller's own and reads back to its owner only; a pin of a record outside the space is refused",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await getPersonaContext(ctx, 'bea');
            const sam = await getPersonaContext(ctx, 'sam');
            const [filesEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', "Name = 'MJ: Files'", ['ID']);
            const [item] = await FindRows<{ RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${filesEntity.ID}'`, ['RecordID']);
            let pinId: string | null = null;
            await deleteWhere(ctx.Provider, ctx.User, SPACE_MEMBER_PIN_ENTITY, `UserID = '${bea.User.ID}' AND SpaceID = '${DISCOVERY_SPACE_ID}'`, 'a leftover pin');
            try {
                const pin = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberPinEntity>(SPACE_MEMBER_PIN_ENTITY, bea.User);
                pin.NewRecord();
                pin.SpaceID = DISCOVERY_SPACE_ID;
                pin.UserID = bea.User.ID; // the client's required-field check runs before the server stamps the caller
                pin.Kind = 'Record';
                pin.TargetEntityID = filesEntity.ID;
                pin.TargetRecordID = item.RecordID;
                pin.Sequence = 0;
                Assert(await pin.Save(), `Bea pins over the wire: ${pin.LatestResult?.CompleteMessage ?? ''}`);
                pinId = pin.ID;
                const beaSees = await FindRows<{ ID: string }>(asPersona(ctx, bea), SPACE_MEMBER_PIN_ENTITY, `ID = '${pin.ID}'`, ['ID'], bea.User, { BypassCache: true });
                Assert(beaSees.length === 1, 'Bea reads her pin');
                const samSees = await FindRows<{ ID: string }>(asPersona(ctx, sam), SPACE_MEMBER_PIN_ENTITY, `ID = '${pin.ID}'`, ['ID'], sam.User, { BypassCache: true });
                Assert(samSees.length === 0, "Sam does not read Bea's pin");
                const outside = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberPinEntity>(SPACE_MEMBER_PIN_ENTITY, bea.User);
                outside.NewRecord();
                outside.SpaceID = DISCOVERY_SPACE_ID;
                outside.UserID = bea.User.ID;
                outside.Kind = 'Record';
                outside.TargetEntityID = filesEntity.ID;
                outside.TargetRecordID = 'ID|00000000-0000-4000-8000-000000000099';
                outside.Sequence = 1;
                Assert(!(await outside.Save()), 'A record outside the space cannot be pinned');
            } finally {
                if (pinId) await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_MEMBER_PIN_ENTITY, `ID = '${pinId}'`, 'a stage 1 pin'));
            }
        },
    },
    {
        Id: 'stage1.SC6',
        Name: "SC6 — over the wire: the owner grants an agent to her space and the ask box lists it; a participant's grant is refused",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaContext(ctx, 'ada');
            const bea = await getPersonaContext(ctx, 'bea');
            const [agent] = await FindRows<{ ID: string }>(ctx, AI_AGENT_ENTITY, "Status = 'Active'", ['ID']);
            const [agentsEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', `Name = '${AI_AGENT_ENTITY}'`, ['ID']);
            const space = await childOfNorthwind(ctx, ada, 'grants');
            try {
                const grant = await ada.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, ada.User);
                grant.NewRecord();
                grant.SpaceID = space.ID;
                grant.Kind = 'Agent';
                grant.TargetEntityID = agentsEntity.ID; // the client's required-field check runs before the server stamps the kind's entity
                grant.TargetRecordID = agent.ID;
                grant.Band = 'Shared';
                grant.IsDefault = false;
                grant.Mode = 'Extend';
                grant.Sequence = 0;
                Assert(await grant.Save(), `Ada grants an agent over the wire: ${grant.LatestResult?.CompleteMessage ?? ''}`);
                const beaGrant = await bea.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, bea.User);
                beaGrant.NewRecord();
                beaGrant.SpaceID = space.ID;
                beaGrant.Kind = 'Agent';
                beaGrant.TargetEntityID = agentsEntity.ID;
                beaGrant.TargetRecordID = agent.ID;
                beaGrant.Band = 'Shared';
                beaGrant.IsDefault = false;
                beaGrant.Mode = 'Extend';
                beaGrant.Sequence = 1;
                Assert(!(await beaGrant.Save()), 'A participant cannot grant');
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_GRANT_ENTITY, `SpaceID = '${space.ID}'`, 'a stage 1 grant'));
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage1', {
    Setup: async () => {},
    Teardown: async () => {},
});
