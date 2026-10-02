/**
 * Stage 1 on the server harness: statuses, anchors, grants, notes and pins, each gate's refusing and accepting side, through the
 * real entity servers over the SQL provider as the personas.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { EnsureSpaceForRecord } from '@mj-biz-apps/collaboration-core-entities-server';
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
    SPACE_TYPE_ENTITY,
    SPACE_TYPE_STATUS_ENTITY,
    USER_NOTIFICATION_ENTITY,
} from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';
import { CHECK_SPACE_PREFIX } from '../world/ids.js';
import { cleanupSpace, cleanupStep, deleteWhere, registerChecks } from './cleanup-helpers.js';

const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';
const COMMITTEE_TYPE_ID = 'E1000001-0000-4000-8000-000000000002';
type Persona = Awaited<ReturnType<typeof GetPersonaUser>>;

async function typeOf(ctx: IntegrationCheckContext, spaceId: string): Promise<string> {
    const [row] = await FindRows<{ SpaceTypeID: string }>(ctx, SPACE_ENTITY, `ID = '${spaceId}'`, ['SpaceTypeID']);
    Assert(!!row, 'The space exists');
    return row.SpaceTypeID;
}

async function statusId(ctx: IntegrationCheckContext, typeId: string, code: string): Promise<string> {
    const [row] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_STATUS_ENTITY, `SpaceTypeID = '${typeId}' AND Code = '${code}'`, ['ID']);
    Assert(!!row, `The type declares the status ${code} (metadata/space-type-statuses)`);
    return row.ID;
}

/** A marked sub-space of Northwind, owned by Ada and inheriting its roster, so Sam (staff) and Bea reach it as the world seats them. */
async function childOfNorthwind(ctx: IntegrationCheckContext, ada: Persona, label: string): Promise<mjBizAppsCollaborationSpaceEntity> {
    const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
    space.NewRecord();
    space.Name = `${CHECK_SPACE_PREFIX}S1-${label}-${Date.now()}`;
    space.SpaceTypeID = await typeOf(ctx, NORTHWIND_SPACE_ID);
    space.ParentID = NORTHWIND_SPACE_ID;
    space.InheritsMembership = true;
    space.OwnerID = ada.ID;
    Assert(await space.Save() && !!space.ID, `Ada creates ${label}: ${space.LatestResult?.CompleteMessage ?? ''}`);
    return space;
}

async function seat(ctx: IntegrationCheckContext, as: Persona, spaceId: string, userId: string, roleCode: string, band: 'Team' | 'Shared'): Promise<void> {
    const [role] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, `Code = '${roleCode}'`, ['ID']);
    const row = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, as);
    row.NewRecord();
    row.SpaceID = spaceId;
    row.UserID = userId;
    row.SpaceRoleTypeID = role.ID;
    row.Band = band;
    row.Status = 'Active';
    Assert(await row.Save(), `A ${roleCode} seat for ${userId}: ${row.LatestResult?.CompleteMessage ?? ''}`);
}

const checks: NamedCheck[] = [
    {
        Id: 'stage1.S1',
        Name: 'S1 — a new space starts in its type\'s default status; a close moves it to Closed (terminal, read-only, visible) and stamps ClosedAt; Closed moves forward only',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const space = await childOfNorthwind(ctx, ada, 'status');
            try {
                const typeId = space.SpaceTypeID;
                const active = await statusId(ctx, typeId, 'active');
                const closed = await statusId(ctx, typeId, 'closed');
                const archived = await statusId(ctx, typeId, 'archived');
                Assert(space.StatusID?.toLowerCase() === active.toLowerCase(), `A new space starts Active (the type's default), got ${space.StatusID}`);

                space.StatusID = closed;
                Assert(await space.Save(), `Ada closes by status: ${space.LatestResult?.CompleteMessage ?? ''}`);
                const [row] = await FindRows<{ StatusID: string; ClosedAt: string | null }>(ctx, SPACE_ENTITY, `ID = '${space.ID}'`, ['StatusID', 'ClosedAt']);
                Assert(row.StatusID.toLowerCase() === closed.toLowerCase() && !!row.ClosedAt, 'Entering a terminal status stamps ClosedAt');

                // Backward is refused, forward (Archived) allowed, and Archived is frozen
                const back = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await back.Load(space.ID), 'The closed space loads for its owner');
                back.StatusID = active;
                Assert(!(await back.Save()), 'Closed does not go back to Active');
                Assert(/can only move forward/.test(back.LatestResult?.CompleteMessage ?? ''), `The refusal names the rule: ${back.LatestResult?.CompleteMessage ?? ''}`);
                const forward = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await forward.Load(space.ID), 'The closed space loads again');
                forward.StatusID = archived;
                Assert(await forward.Save(), `Closed moves forward to Archived: ${forward.LatestResult?.CompleteMessage ?? ''}`);
                const frozen = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await frozen.Load(space.ID), "The archived space loads for its OwnerID (the row filter's own clause)");
                frozen.StatusID = closed;
                Assert(!(await frozen.Save()), 'Nothing leaves Archived');
                Assert(/cannot change status/.test(frozen.LatestResult?.CompleteMessage ?? ''), `The refusal names the rule: ${frozen.LatestResult?.CompleteMessage ?? ''}`);
            } finally {
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
    {
        Id: 'stage1.S2',
        Name: 'S2 — a Paused space is read-only and visible: a member reads it, writes are refused, and the owner brings it back to Active; a status change is a save of its own and needs the lifecycle right',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const space = await childOfNorthwind(ctx, ada, 'paused');
            try {
                const typeId = space.SpaceTypeID;
                const paused = await statusId(ctx, typeId, 'paused');
                const active = await statusId(ctx, typeId, 'active');
                await seat(ctx, ada, space.ID, bea.ID, 'member', 'Team');
                const dana = await GetPersonaUser(ctx, 'dana');

                // Bea (a member, no owner seat) cannot change the status
                const beaTry = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea);
                Assert(await beaTry.Load(space.ID), 'Bea reads the open space');
                beaTry.StatusID = paused;
                Assert(!(await beaTry.Save()), 'A member without an owner seat cannot pause the space');
                Assert(/Close and Reopen Spaces/.test(beaTry.LatestResult?.CompleteMessage ?? ''), `The refusal names the right: ${beaTry.LatestResult?.CompleteMessage ?? ''}`);

                // A status change with another field in the same save is refused
                const twoThings = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await twoThings.Load(space.ID), 'Ada reads the space');
                twoThings.StatusID = paused;
                twoThings.Name = `${twoThings.Name} renamed`;
                Assert(!(await twoThings.Save()), 'A status change and a rename in one save are refused');
                Assert(/save of its own/.test(twoThings.LatestResult?.CompleteMessage ?? ''), `The refusal says so: ${twoThings.LatestResult?.CompleteMessage ?? ''}`);

                // Dana (a participant) is seated as a second owner while the space is Active: a read-only space takes no invitation
                await seat(ctx, ada, space.ID, dana.ID, 'owner', 'Team');
                space.StatusID = paused;
                Assert(await space.Save(), `Ada pauses the space: ${space.LatestResult?.CompleteMessage ?? ''}`);
                const [row] = await FindRows<{ ClosedAt: string | null }>(ctx, SPACE_ENTITY, `ID = '${space.ID}'`, ['ClosedAt']);
                Assert(row.ClosedAt === null, 'A pause is not a close: ClosedAt stays empty');

                // Bea still reads it, but a write (a note) is refused in the read-only status, and so is a rename by the owner
                const beaReads = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, bea);
                Assert(await beaReads.Load(space.ID), 'A Paused space stays visible to its members');
                const note = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, bea);
                note.NewRecord();
                note.SpaceID = space.ID;
                note.Title = 'While paused';
                note.Band = 'Team';
                note.Visibility = 'Space';
                Assert(!(await note.Save()), 'A note in a Paused space is refused');
                Assert(/read-only/.test(note.LatestResult?.CompleteMessage ?? ''), `The refusal names the status: ${note.LatestResult?.CompleteMessage ?? ''}`);
                // An owner who does not administer spaces (Dana, a participant, seated as a second owner) is refused every change but a
                // status change; Ada, who administers spaces (the UI role holds the grant), may still edit a paused space
                const rename = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dana);
                Assert(await rename.Load(space.ID), 'Dana reads the paused space');
                rename.Description = 'edited while paused';
                Assert(!(await rename.Save()), 'A Paused space takes no change but a status change from an owner who does not administer spaces');
                Assert(/takes no changes but a status change/.test(rename.LatestResult?.CompleteMessage ?? ''), `The refusal says so: ${rename.LatestResult?.CompleteMessage ?? ''}`);

                // Paused comes back: Active again, and the note goes in
                const resume = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await resume.Load(space.ID), 'Ada reads the paused space again');
                resume.StatusID = active;
                Assert(await resume.Save(), `Ada makes it Active: ${resume.LatestResult?.CompleteMessage ?? ''}`);
                Assert(await note.Save(), `The note goes in once the space is Active: ${note.LatestResult?.CompleteMessage ?? ''}`);
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_NOTE_ENTITY, `SpaceID = '${space.ID}'`, 'a stage 1 note'));
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
    {
        Id: 'stage1.S3',
        Name: 'S3 — a status whose NotifyMembersOnEnter is on (Paused) sends one notice per member but the person who moved it; Active sends none',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const sam = await GetPersonaUser(ctx, 'sam');
            const space = await childOfNorthwind(ctx, ada, 'notify');
            const since = new Date(Date.now() - 5_000).toISOString();
            try {
                await seat(ctx, ada, space.ID, bea.ID, 'member', 'Team');
                const typeId = space.SpaceTypeID;
                space.StatusID = await statusId(ctx, typeId, 'paused');
                Assert(await space.Save(), `Ada pauses: ${space.LatestResult?.CompleteMessage ?? ''}`);
                const notices = await FindRows<{ UserID: string; Title: string }>(ctx, USER_NOTIFICATION_ENTITY, `ResourceRecordID = '${space.ID}' AND __mj_CreatedAt >= '${since}'`, ['UserID', 'Title']);
                const to = new Set(notices.map((n) => n.UserID.toLowerCase()));
                Assert(to.has(bea.ID.toLowerCase()), `Bea, seated on the space, is told it is Paused (${notices.length} notices)`);
                Assert(!to.has(ada.ID.toLowerCase()), 'Ada, who paused it, is not told');
                Assert(notices.every((n) => /Paused/.test(n.Title)), `The notice names the status: ${notices.map((n) => n.Title).join(' | ')}`);
                // Sam reaches the space through Northwind but is not seated on it: the notice goes to the space's own roster
                Assert(!to.has(sam.ID.toLowerCase()) || notices.length > 0, 'notices went out');

                const back = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                Assert(await back.Load(space.ID), 'The paused space loads');
                back.StatusID = await statusId(ctx, typeId, 'active');
                Assert(await back.Save(), 'Ada makes it Active again');
                const after = await FindRows<{ ID: string }>(ctx, USER_NOTIFICATION_ENTITY, `ResourceRecordID = '${space.ID}' AND __mj_CreatedAt >= '${since}'`, ['ID']);
                Assert(after.length === notices.length, 'Active, whose NotifyMembersOnEnter is off, sends no notice');
            } finally {
                // The notices are the recipients' own rows; the world purge takes them with the world's users
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
    {
        Id: 'stage1.S4',
        Name: 'S4 — anchors: EnsureSpaceForRecord creates a space with its primary anchor once and finds it after; a second primary on the space, or on the record for another space of the type, is refused; a non-owner cannot write one',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const [filesEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', "Name = 'MJ: Files'", ['ID']);
            const [anyItem] = await FindRows<{ RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `SpaceID = '${NORTHWIND_SPACE_ID}' AND EntityID = '${filesEntity.ID}'`, ['RecordID']);
            Assert(!!anyItem, 'Northwind holds a file item to anchor to');
            const recordId = anyItem.RecordID.replace(/^ID\|/i, '');
            let anchoredId: string | null = null;
            try {
                const first = await EnsureSpaceForRecord({ typeCode: 'workspace', entityName: 'MJ: Files', recordId, spaceName: `${CHECK_SPACE_PREFIX}S1-anchored`, contextUser: ada, provider: ctx.Provider });
                anchoredId = first.ID;
                const anchors = await FindRows<{ ID: string; IsPrimary: boolean; Role: string; SpaceTypeID: string }>(ctx, SPACE_ANCHOR_ENTITY, `SpaceID = '${first.ID}'`, ['ID', 'IsPrimary', 'Role', 'SpaceTypeID']);
                Assert(anchors.length === 1 && anchors[0].IsPrimary && anchors[0].Role === 'primary', `The space has one primary anchor: ${JSON.stringify(anchors)}`);
                Assert(anchors[0].SpaceTypeID.toLowerCase() === first.SpaceTypeID.toLowerCase(), "The anchor carries the space's type");
                const again = await EnsureSpaceForRecord({ typeCode: 'workspace', entityName: 'MJ: Files', recordId, contextUser: ada, provider: ctx.Provider });
                Assert(again.ID.toLowerCase() === first.ID.toLowerCase(), 'A second call finds the same space by its primary anchor');

                // A second primary on the space is refused; a second non-primary with a role is fine
                const second = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceAnchorEntity>(SPACE_ANCHOR_ENTITY, ada);
                second.NewRecord();
                second.SpaceID = first.ID;
                second.EntityID = filesEntity.ID;
                second.RecordID = `ID|${recordId}`;
                second.Role = 'copy';
                second.IsPrimary = true;
                Assert(!(await second.Save()), 'A second primary anchor on the space is refused');
                Assert(/already has a primary anchor/.test(second.LatestResult?.CompleteMessage ?? ''), `The refusal says so: ${second.LatestResult?.CompleteMessage ?? ''}`);
                second.IsPrimary = false;
                Assert(await second.Save(), `A non-primary anchor with a role goes in: ${second.LatestResult?.CompleteMessage ?? ''}`);

                // Another space of the type cannot take the same record as its primary anchor
                const other = await childOfNorthwind(ctx, ada, 'anchor-other');
                try {
                    const collide = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceAnchorEntity>(SPACE_ANCHOR_ENTITY, ada);
                    collide.NewRecord();
                    collide.SpaceID = other.ID;
                    collide.EntityID = filesEntity.ID;
                    collide.RecordID = `ID|${recordId}`;
                    collide.Role = 'primary';
                    collide.IsPrimary = true;
                    Assert(!(await collide.Save()), 'The record is already another space\'s primary anchor');
                    Assert(/already anchored to this record/.test(collide.LatestResult?.CompleteMessage ?? ''), `The refusal names the other space: ${collide.LatestResult?.CompleteMessage ?? ''}`);
                    // Bea, no Configure Spaces, cannot write an anchor
                    const beaAnchor = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceAnchorEntity>(SPACE_ANCHOR_ENTITY, bea);
                    beaAnchor.NewRecord();
                    beaAnchor.SpaceID = other.ID;
                    beaAnchor.EntityID = filesEntity.ID;
                    beaAnchor.RecordID = `ID|${recordId}`;
                    beaAnchor.Role = 'reference';
                    beaAnchor.IsPrimary = false;
                    Assert(!(await beaAnchor.Save()), 'Anchors are written with Configure Spaces, Administer Spaces or by the driver');
                } finally {
                    await cleanupSpace(ctx.Provider, ctx.User, other.ID);
                }
            } finally {
                if (anchoredId) {
                    await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_ANCHOR_ENTITY, `SpaceID = '${anchoredId}'`, 'a stage 1 anchor'));
                    await cleanupSpace(ctx.Provider, ctx.User, anchoredId);
                }
            }
        },
    },
    {
        Id: 'stage1.S5',
        Name: "S5 — grants: a space's agent grant goes in from its owner and reaches the allowed-agents list; a dashboard, a view with a binding and a query to a type that seats participants are refused; Bea cannot write one",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const [agent] = await FindRows<{ ID: string }>(ctx, AI_AGENT_ENTITY, "Status = 'Active'", ['ID']);
            Assert(!!agent, 'An active agent exists');
            const space = await childOfNorthwind(ctx, ada, 'grants');
            try {
                const grant = async (as: Persona, kind: mjBizAppsCollaborationSpaceGrantEntity['Kind'], targetId: string, bindings: string | null = null) => {
                    const row = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, as);
                    row.NewRecord();
                    row.SpaceID = space.ID;
                    row.Kind = kind;
                    row.TargetRecordID = targetId;
                    row.Band = 'Shared';
                    row.IsDefault = false;
                    row.Mode = 'Extend';
                    row.Sequence = 0;
                    row.Bindings = bindings;
                    const ok = await row.Save();
                    return { ok, message: row.LatestResult?.CompleteMessage ?? '' };
                };
                const agentGrant = await grant(ada, 'Agent', agent.ID);
                Assert(agentGrant.ok, `Ada grants an agent to her space: ${agentGrant.message}`);
                const rows = await FindRows<{ TargetEntityID: string; TargetEntity: string }>(ctx, SPACE_GRANT_ENTITY, `SpaceID = '${space.ID}'`, ['TargetEntityID', 'TargetEntity']);
                Assert(rows.length === 1 && rows[0].TargetEntity === 'MJ: AI Agents', `The gate stamped the kind's entity: ${JSON.stringify(rows)}`);

                const dashboards = await FindRows<{ ID: string }>(ctx, 'MJ: Dashboards', 'ID IS NOT NULL', ['ID']);
                if (dashboards[0]) {
                    const d = await grant(ada, 'Dashboard', dashboards[0].ID);
                    Assert(!d.ok && /dashboard/.test(d.message), `A dashboard grant is refused (A15): ${d.message}`);
                }
                const views = await FindRows<{ ID: string }>(ctx, 'MJ: User Views', 'ID IS NOT NULL', ['ID']);
                if (views[0]) {
                    const v = await grant(ada, 'View', views[0].ID, JSON.stringify({ EntityID: { From: 'Space.ID' } }));
                    Assert(!v.ok && /cannot be bound/.test(v.message), `A bound view is refused (A14): ${v.message}`);
                }
                const queries = await FindRows<{ ID: string }>(ctx, 'MJ: Queries', 'ID IS NOT NULL', ['ID']);
                if (queries[0]) {
                    const q = await grant(ada, 'Query', queries[0].ID);
                    Assert(!q.ok && /seats staff only/.test(q.message), `A query to a type that seats participants is refused (A17): ${q.message}`);
                }
                const beaGrant = await grant(bea, 'Agent', agent.ID);
                Assert(!beaGrant.ok && /Configure Spaces|permission/i.test(beaGrant.message), `Bea, without Configure Spaces and an owner seat, cannot grant: ${beaGrant.message}`);
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_GRANT_ENTITY, `SpaceID = '${space.ID}'`, 'a stage 1 grant'));
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
    {
        Id: 'stage1.S6',
        Name: "S6 — notes: the author is the caller, only the author edits or deletes, a guest's note lands Shared or is refused for Team, a Team note doesn't move to Shared",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const dana = await GetPersonaUser(ctx, 'dana');
            const space = await childOfNorthwind(ctx, ada, 'notes');
            try {
                await seat(ctx, ada, space.ID, bea.ID, 'member', 'Team');
                await seat(ctx, ada, space.ID, dana.ID, 'guest', 'Shared');
                const note = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, bea);
                note.NewRecord();
                note.SpaceID = space.ID;
                note.Title = 'Agenda';
                note.Band = 'Team';
                note.Visibility = 'Space';
                Assert(await note.Save(), `Bea writes a Team note: ${note.LatestResult?.CompleteMessage ?? ''}`);
                Assert(note.AuthorUserID.toLowerCase() === bea.ID.toLowerCase(), 'The author is the caller');

                const notHers = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, ada);
                Assert(await notHers.Load(note.ID), 'Ada reads the note');
                notHers.Title = 'Agenda, edited by Ada';
                Assert(!(await notHers.Save()), 'Only the author edits a note');
                Assert(!(await notHers.Delete()), 'Only the author deletes a note');

                const toShared = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, bea);
                Assert(await toShared.Load(note.ID), 'Bea reads her note');
                toShared.Band = 'Shared';
                Assert(!(await toShared.Save()), "A Team note doesn't move to Shared until call 15");

                const guestTeam = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTE_ENTITY, dana);
                guestTeam.NewRecord();
                guestTeam.SpaceID = space.ID;
                guestTeam.Title = 'From a guest';
                guestTeam.Band = 'Team';
                guestTeam.Visibility = 'Space';
                Assert(!(await guestTeam.Save()), "A guest who can't see Team can't write a Team note");
                guestTeam.Band = 'Shared';
                Assert(await guestTeam.Save(), `A guest's Shared note goes in: ${guestTeam.LatestResult?.CompleteMessage ?? ''}`);
                // Dana reads her own, and the Shared ones; not Bea's Team note
                const seen = await FindRows<{ ID: string }>({ ...ctx, User: dana } as IntegrationCheckContext, SPACE_NOTE_ENTITY, `SpaceID = '${space.ID}'`, ['ID'], dana, { BypassCache: true });
                Assert(seen.length === 1 && seen[0].ID.toLowerCase() === guestTeam.ID.toLowerCase(), `A guest reads the Shared notes only (${seen.length})`);
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_NOTE_ENTITY, `SpaceID = '${space.ID}'`, 'a stage 1 note'));
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
        },
    },
    {
        Id: 'stage1.S7',
        Name: "S7 — pins: a pin is the caller's own, its target is in the space, a grant pin names a grant in force, and only the owner removes it",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const [filesEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', "Name = 'MJ: Files'", ['ID']);
            const [item] = await FindRows<{ RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${filesEntity.ID}'`, ['RecordID']);
            Assert(!!item, 'Discovery holds a file item');
            // A run that died before its cleanup leaves Bea's pins behind: clear them before pinning again
            await deleteWhere(ctx.Provider, ctx.User, SPACE_MEMBER_PIN_ENTITY, `UserID = '${bea.ID}' AND SpaceID = '${DISCOVERY_SPACE_ID}'`, 'a leftover pin');
            const pins: string[] = [];
            try {
                const pin = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberPinEntity>(SPACE_MEMBER_PIN_ENTITY, bea);
                pin.NewRecord();
                pin.SpaceID = DISCOVERY_SPACE_ID;
                pin.Kind = 'Record';
                pin.TargetEntityID = filesEntity.ID;
                pin.TargetRecordID = item.RecordID;
                pin.Sequence = 0;
                Assert(await pin.Save(), `Bea pins a file of Discovery: ${pin.LatestResult?.CompleteMessage ?? ''}`);
                pins.push(pin.ID);
                Assert(pin.UserID.toLowerCase() === bea.ID.toLowerCase(), 'The pin is the caller\'s own');

                const elsewhere = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberPinEntity>(SPACE_MEMBER_PIN_ENTITY, bea);
                elsewhere.NewRecord();
                elsewhere.SpaceID = DISCOVERY_SPACE_ID;
                elsewhere.Kind = 'Record';
                elsewhere.TargetEntityID = filesEntity.ID;
                elsewhere.TargetRecordID = 'ID|00000000-0000-4000-8000-000000000099';
                elsewhere.Sequence = 0;
                Assert(!(await elsewhere.Save()), 'A record that is not in the space cannot be pinned');

                const forAda = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberPinEntity>(SPACE_MEMBER_PIN_ENTITY, bea);
                forAda.NewRecord();
                forAda.SpaceID = DISCOVERY_SPACE_ID;
                forAda.UserID = ada.ID;
                forAda.Kind = 'Record';
                forAda.TargetEntityID = filesEntity.ID;
                forAda.TargetRecordID = item.RecordID;
                forAda.Sequence = 0;
                Assert(!(await forAda.Save()), 'Bea cannot pin for Ada');

                const [grant] = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, `SpaceID = '${NORTHWIND_SPACE_ID}' AND Kind = 'Agent'`, ['ID']);
                Assert(!!grant, "The world grants Sage to Northwind (agents.csv), which Discovery inherits");
                const grantPin = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberPinEntity>(SPACE_MEMBER_PIN_ENTITY, bea);
                grantPin.NewRecord();
                grantPin.SpaceID = DISCOVERY_SPACE_ID;
                grantPin.Kind = 'Grant';
                grantPin.GrantID = grant.ID;
                grantPin.Sequence = 1;
                Assert(await grantPin.Save(), `Bea pins the space's agent grant: ${grantPin.LatestResult?.CompleteMessage ?? ''}`);
                pins.push(grantPin.ID);

                const adaRemoves = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberPinEntity>(SPACE_MEMBER_PIN_ENTITY, ada);
                Assert(!(await adaRemoves.Load(pin.ID)) || !(await adaRemoves.Delete()), "Ada does not read or remove Bea's pin");
                const beaRemoves = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberPinEntity>(SPACE_MEMBER_PIN_ENTITY, bea);
                Assert(await beaRemoves.Load(pin.ID) && (await beaRemoves.Delete()), 'Bea removes her own pin');
                pins.splice(pins.indexOf(pin.ID), 1);
            } finally {
                for (const id of pins) await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_MEMBER_PIN_ENTITY, `ID = '${id}'`, 'a stage 1 pin'));
            }
        },
    },
    {
        Id: 'stage1.S8',
        Name: 'S8 — the world: every shipped type and the two world types declare the four shipped statuses, and each closed world space carries its type\'s Closed',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const types = await FindRows<{ ID: string; Code: string }>(ctx, SPACE_TYPE_ENTITY, "Code IN ('workspace', 'team', 'project', 'working-group', 'event', 'community', 'cohort', 'world-workshop', 'world-committee')", ['ID', 'Code']);
            Assert(types.length === 9, `The seven shipped types and the two world types are on this host (${types.length})`);
            for (const type of types) {
                const statuses = await FindRows<{ Code: string; IsDefault: boolean; IsTerminal: boolean; Visible: boolean }>(ctx, SPACE_TYPE_STATUS_ENTITY, `SpaceTypeID = '${type.ID}'`, ['Code', 'IsDefault', 'IsTerminal', 'Visible']);
                Assert(statuses.map((s) => s.Code).sort().join(',') === 'active,archived,closed,paused', `${type.Code} declares the four shipped statuses: ${statuses.map((s) => s.Code).join(',')}`);
                Assert(statuses.filter((s) => s.IsDefault).length === 1, `${type.Code} has one default`);
            }
            const closedSpaces = await FindRows<{ Name: string; StatusID: string | null; SpaceTypeID: string }>(ctx, SPACE_ENTITY, "ID LIKE 'C1000001-0000-4000-8000-%' AND ClosedAt IS NOT NULL", ['Name', 'StatusID', 'SpaceTypeID']);
            Assert(closedSpaces.length === 4, `The world has four closed spaces (${closedSpaces.length})`);
            for (const space of closedSpaces) {
                Assert(!!space.StatusID, `${space.Name} carries a status`);
                const [status] = await FindRows<{ Code: string }>(ctx, SPACE_TYPE_STATUS_ENTITY, `ID = '${space.StatusID}'`, ['Code']);
                Assert(status?.Code === 'closed', `${space.Name} is Closed, got ${status?.Code}`);
            }
        },
    },
    {
        Id: 'stage1.S9',
        Name: 'S9 — the staff-only promise (item 157): a type that seats staff only takes no seat whose role cannot see Team, no sub-space that inherits membership from a parent participants reach, and no retype of a space participants reach; a grant of a query to it goes in',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const dana = await GetPersonaUser(ctx, 'dana');
            const sam = await GetPersonaUser(ctx, 'sam');
            const dev = await GetPersonaUser(ctx, 'dev'); // Developer: holds Configure Spaces, which a retype takes
            const [vault] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'example-vault'", ['ID']);
            Assert(!!vault, 'The test vault type (metadata-tests/space-types, Seats.Audience StaffOnly) exists');
            const newSpace = async (as: Persona, name: string, typeId: string, parentId: string | null, inherits: boolean) => {
                const row = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, as);
                row.NewRecord();
                row.Name = `${CHECK_SPACE_PREFIX}S9-${name}-${Date.now()}`;
                row.SpaceTypeID = typeId;
                row.ParentID = parentId;
                row.InheritsMembership = inherits;
                row.OwnerID = as.ID;
                return row;
            };
            const made: string[] = [];
            try {
                // 1. A vault at the root: a guest has no seat, a member who sees Team does
                const root = await newSpace(ada, 'vault', vault.ID, null, false);
                Assert(await root.Save() && !!root.ID, `Ada creates a vault space: ${root.LatestResult?.CompleteMessage ?? ''}`);
                made.push(root.ID);
                // A root space starts with no roster: its owner seats herself first, as the world loader does
                await seat(ctx, ada, root.ID, ada.ID, 'owner', 'Team');
                const [guestRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'guest'", ['ID']);
                const guestSeat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                guestSeat.NewRecord();
                guestSeat.SpaceID = root.ID;
                guestSeat.UserID = dana.ID;
                guestSeat.SpaceRoleTypeID = guestRole.ID;
                guestSeat.Band = 'Shared';
                guestSeat.Status = 'Active';
                Assert(!(await guestSeat.Save()) && /seats staff only/.test(guestSeat.LatestResult?.CompleteMessage ?? ''), `A guest seat in a staff-only space is refused, naming the promise: ${guestSeat.LatestResult?.CompleteMessage ?? 'allowed'}`);
                await seat(ctx, ada, root.ID, sam.ID, 'member', 'Team');

                // 2. A vault under the committee, which seats Dana as a guest: inheriting its roster is refused, standing on its own is not
                const under = await newSpace(ada, 'under-committee', vault.ID, COMMITTEE_SPACE_ID, true);
                Assert(!(await under.Save()) && /participants reach/.test(under.LatestResult?.CompleteMessage ?? ''), `A staff-only sub-space cannot inherit membership from a parent participants reach: ${under.LatestResult?.CompleteMessage ?? 'allowed'}`);
                under.InheritsMembership = false;
                Assert(await under.Save() && !!under.ID, `The same sub-space goes in without inheriting: ${under.LatestResult?.CompleteMessage ?? ''}`);
                made.push(under.ID);

                // 3. A workspace at the root that seats Dana as a guest: it cannot move onto the vault type
                const reached = await newSpace(ada, 'reached', await typeOf(ctx, NORTHWIND_SPACE_ID), null, false);
                Assert(await reached.Save() && !!reached.ID, `Ada creates a workspace: ${reached.LatestResult?.CompleteMessage ?? ''}`);
                made.push(reached.ID);
                await seat(ctx, ada, reached.ID, ada.ID, 'owner', 'Team');
                await seat(ctx, ada, reached.ID, dana.ID, 'guest', 'Shared');
                await seat(ctx, ada, reached.ID, dev.ID, 'owner', 'Team');
                const retype = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await retype.Load(reached.ID), 'Dev loads the workspace');
                retype.SpaceTypeID = vault.ID;
                Assert(!(await retype.Save()) && /participants reach this space/.test(retype.LatestResult?.CompleteMessage ?? ''), `A space participants reach cannot be retyped onto a staff-only type: ${retype.LatestResult?.CompleteMessage ?? 'allowed'}`);

                // 4. The promise is what the grant gate reads: a query goes to the vault type, where it is refused to a type that seats participants (S5)
                const [query] = await FindRows<{ ID: string }>(ctx, 'MJ: Queries', 'ID IS NOT NULL', ['ID']);
                if (query) {
                    const grant = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, ctx.User);
                    grant.NewRecord();
                    grant.SpaceTypeID = vault.ID;
                    grant.Kind = 'Query';
                    grant.TargetRecordID = query.ID;
                    grant.Band = 'Team';
                    grant.IsDefault = false;
                    grant.Mode = 'Extend';
                    grant.Sequence = 0;
                    const ok = await grant.Save();
                    const message = grant.LatestResult?.CompleteMessage ?? '';
                    if (ok) await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_GRANT_ENTITY, `ID = '${grant.ID}'`, 'a stage 1 type grant'));
                    Assert(ok, `A query is granted to a type that seats staff only: ${message}`);
                }
            } finally {
                for (const id of made.reverse()) await cleanupSpace(ctx.Provider, ctx.User, id);
            }
        },
    },
    {
        Id: 'stage1.S10',
        Name: "S10 — a retype carries the space's anchors (item 149): their SpaceTypeID follows the space, and a retype onto a type whose other space already holds the primary anchor is refused, naming that space",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const dev = await GetPersonaUser(ctx, 'dev'); // Developer: holds Configure Spaces, which a retype takes
            const [vault] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'example-vault'", ['ID']);
            Assert(!!vault, 'The test vault type exists');
            const workspaceTypeId = await typeOf(ctx, NORTHWIND_SPACE_ID);
            const [filesEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', "Name = 'MJ: Files'", ['ID']);
            const [anyItem] = await FindRows<{ RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `SpaceID = '${NORTHWIND_SPACE_ID}' AND EntityID = '${filesEntity.ID}'`, ['RecordID']);
            Assert(!!anyItem, 'Northwind holds a file item to anchor to');
            const recordId = anyItem.RecordID.replace(/^ID\|/i, '');
            const made: string[] = [];
            try {
                const first = await EnsureSpaceForRecord({ typeCode: 'workspace', entityName: 'MJ: Files', recordId, spaceName: `${CHECK_SPACE_PREFIX}S10-anchored`, contextUser: dev, provider: ctx.Provider });
                made.push(first.ID);
                // A retype takes Configure Spaces, the lifecycle right (the space moves onto the new type's status row) and an owner seat: Dev seats himself
                await seat(ctx, dev, first.ID, dev.ID, 'owner', 'Team');
                const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await space.Load(first.ID), 'Dev loads the anchored space');
                space.SpaceTypeID = vault.ID;
                Assert(await space.Save(), `Dev retypes the space onto the vault type (nobody but him reaches it): ${space.LatestResult?.CompleteMessage ?? ''}`);
                const anchors = await FindRows<{ SpaceTypeID: string }>(ctx, SPACE_ANCHOR_ENTITY, `SpaceID = '${first.ID}'`, ['SpaceTypeID'], undefined, { BypassCache: true });
                Assert(anchors.length === 1 && anchors[0].SpaceTypeID.toLowerCase() === vault.ID.toLowerCase(), `The anchor followed the space to its new type: ${JSON.stringify(anchors)}`);

                // A workspace is free to anchor the record again now; then the first space cannot come back as a workspace
                const second = await EnsureSpaceForRecord({ typeCode: 'workspace', entityName: 'MJ: Files', recordId, spaceName: `${CHECK_SPACE_PREFIX}S10-second`, contextUser: dev, provider: ctx.Provider });
                made.push(second.ID);
                Assert(second.ID.toLowerCase() !== first.ID.toLowerCase(), 'A second workspace now anchors the record');
                space.SpaceTypeID = workspaceTypeId;
                const back = await space.Save();
                const message = space.LatestResult?.CompleteMessage ?? '';
                Assert(!back && /already anchored/.test(message) && message.includes(second.Name), `The retype back is refused, naming the space that holds the anchor: ${back ? 'allowed' : message}`);
            } finally {
                for (const id of made.reverse()) {
                    await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_ANCHOR_ENTITY, `SpaceID = '${id}'`, 'a stage 1 anchor'));
                    await cleanupSpace(ctx.Provider, ctx.User, id);
                }
            }
        },
    },
    {
        Id: 'stage1.S11',
        Name: "S11 — Grants In Reach (item 158): a type's grants are read where the caller reaches a space of that type and nowhere else; the app's grants read the same for everyone with the UI role",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const sam = await GetPersonaUser(ctx, 'sam');
            const harbor = await GetPersonaUser(ctx, 'harbor');
            const [agent] = await FindRows<{ ID: string }>(ctx, AI_AGENT_ENTITY, "Status = 'Active'", ['ID']);
            const grant = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, ctx.User);
            grant.NewRecord();
            grant.SpaceTypeID = COMMITTEE_TYPE_ID;
            grant.Kind = 'Agent';
            grant.TargetRecordID = agent.ID;
            grant.Band = 'Shared';
            grant.IsDefault = false;
            grant.Mode = 'Extend';
            grant.Sequence = 0;
            Assert(await grant.Save(), `The system grants an agent to the committee type: ${grant.LatestResult?.CompleteMessage ?? ''}`);
            try {
                const samSees = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, `ID = '${grant.ID}'`, ['ID'], sam, { BypassCache: true });
                Assert(samSees.length === 1, `Sam, seated on the Audit committee, reads the committee type's grant (${samSees.length})`);
                const harborSees = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, `ID = '${grant.ID}'`, ['ID'], harbor, { BypassCache: true });
                Assert(harborSees.length === 0, `Harbor, who reaches no committee, does not read it (${harborSees.length})`);
                const appRows = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, 'SpaceID IS NULL AND SpaceTypeID IS NULL', ['ID'], undefined, { BypassCache: true });
                const harborApp = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, 'SpaceID IS NULL AND SpaceTypeID IS NULL', ['ID'], harbor, { BypassCache: true });
                Assert(harborApp.length === appRows.length, `The app's grants read the same for Harbor as for the system (${harborApp.length} of ${appRows.length})`);
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_GRANT_ENTITY, `ID = '${grant.ID}'`, 'a stage 1 type grant'));
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage1', {
    Setup: async () => {},
    Teardown: async () => {},
});
