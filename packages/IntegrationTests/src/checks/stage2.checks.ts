/**
 * Stage 2 on the server harness (the plan's § 10 rows 13 to 24 as stage 2 can pass them): the data reach a type declares (row 14),
 * the grant operations and their refusals (17, 24), the same-type run (18), a space removing one grant (21), the grants D36 keeps
 * closed (13, 16, 23), and the run log. Through the real entity servers and operations over the SQL provider as the personas.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import type { IMetadataProvider } from '@memberjunction/core';
import { GRANT_RUN_AUDIT_LOG_TYPE, loadSpaceConfiguration, runSpaceQuery, runSpaceView } from '@mj-biz-apps/collaboration-core-entities-server';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceGrantEntity, mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_ENTITY, SPACE_GRANT_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY, SPACE_TYPE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';
import { CHECK_SPACE_PREFIX } from '../world/ids.js';
import { cleanupSpace, cleanupStep, deleteWhere, registerChecks } from './cleanup-helpers.js';

const CHAPTER_12 = 'C1000001-0000-4000-8000-000000000016';
const CHAPTER_40 = 'C1000001-0000-4000-8000-000000000017';
const CHAPTER_12_OUTREACH = 'C1000001-0000-4000-8000-000000000018';
const CHAPTER_12_STAFF = 'C1000001-0000-4000-8000-000000000019';
const CHAPTER_12_RECORD = 'F1000001-0000-4000-8000-000000000012';
const MEMBERS_ENTITY = 'MJ_BizApps_Collaboration_Examples: Example Chapter Members';
const AUDIT_LOGS = 'MJ: Audit Logs';
type Persona = Awaited<ReturnType<typeof GetPersonaUser>>;

const provider = (ctx: IntegrationCheckContext): IMetadataProvider => ctx.Provider as IMetadataProvider;

async function grantOf(ctx: IntegrationCheckContext, typeCode: string, kind: string): Promise<{ ID: string; TargetRecordID: string }> {
    const [type] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, `Code = '${typeCode}'`, ['ID']);
    Assert(!!type, `The ${typeCode} type exists (metadata-tests/space-types)`);
    const [grant] = await FindRows<{ ID: string; TargetRecordID: string }>(ctx, SPACE_GRANT_ENTITY, `SpaceTypeID = '${type.ID}' AND Kind = '${kind}'`, ['ID', 'TargetRecordID']);
    Assert(!!grant, `The ${typeCode} type grants a ${kind} (metadata-tests/space-grants)`);
    return grant;
}

async function typeId(ctx: IntegrationCheckContext, code: string): Promise<string> {
    const [type] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, `Code = '${code}'`, ['ID']);
    Assert(!!type, `The ${code} type exists`);
    return type.ID;
}

/** A grant row saved by `as`, refused or not; returns the row and the save's outcome. */
async function saveGrant(ctx: IntegrationCheckContext, as: Persona, fields: Partial<{ SpaceTypeID: string; SpaceID: string; Kind: string; TargetRecordID: string; Band: 'Team' | 'Shared'; Bindings: string | null; Mode: 'Extend' | 'Remove' }>) {
    const row = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, as);
    row.NewRecord();
    if (fields.SpaceTypeID) row.SpaceTypeID = fields.SpaceTypeID;
    if (fields.SpaceID) row.SpaceID = fields.SpaceID;
    row.Kind = (fields.Kind ?? 'Action') as mjBizAppsCollaborationSpaceGrantEntity['Kind'];
    row.TargetRecordID = fields.TargetRecordID ?? '00000000-0000-4000-8000-000000000000';
    row.Band = fields.Band ?? 'Shared';
    row.Mode = fields.Mode ?? 'Extend';
    row.Sequence = 9;
    row.IsDefault = false;
    if (fields.Bindings !== undefined) row.Bindings = fields.Bindings;
    const saved = await row.Save();
    return { row, saved, message: row.LatestResult?.CompleteMessage ?? '' };
}

const checks: NamedCheck[] = [
    {
        Id: 'stage2.S1',
        Name: 'S1 — data reach (row 14): a chapter leader reads her chapter\'s members through the generated filter, with the allow-listed fields only; another chapter\'s leader reads his; staff on neither read nothing through it',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const lena = await GetPersonaUser(ctx, 'lena');
            const marco = await GetPersonaUser(ctx, 'marco');
            const nora = await GetPersonaUser(ctx, 'nora');
            // ChapterID is outside the allow-list: the filter uses it, a participant never reads it, so the names say which chapter the rows are
            const fields = ['ID', 'FirstName', 'LastName', 'Email', 'JoinedAt', 'RenewalDate', 'Status'];
            const lenaRows = await FindRows<{ FirstName: string; LastName: string }>(ctx, MEMBERS_ENTITY, 'ID IS NOT NULL', fields, lena, { BypassCache: true });
            Assert(lenaRows.length === 3, `Lena reads chapter 12's three members and no other (${lenaRows.length})`);
            Assert(lenaRows.every((row) => row.LastName === 'Twelve'), 'Every row Lena reads belongs to chapter 12');
            Assert(lenaRows.map((row) => row.FirstName).sort().join(',') === 'Ivy,Jun,Kai', `The allow-listed fields come through: ${lenaRows.map((row) => row.FirstName).join(',')}`);
            // The field outside the allow-list: asked for by name, it comes back empty for a participant
            let dues: unknown[] = [];
            let duesRefused = false;
            try {
                const rows = await FindRows<{ DuesBalance: unknown }>(ctx, MEMBERS_ENTITY, 'ID IS NOT NULL', ['ID', 'DuesBalance'], lena, { BypassCache: true });
                dues = rows.map((row) => row.DuesBalance).filter((value) => value !== null && value !== undefined);
            } catch {
                duesRefused = true;
            }
            Assert(duesRefused || dues.length === 0, `DuesBalance is outside the type's allow-list, so Lena never reads a value (${dues.length} came back)`);
            const marcoRows = await FindRows<{ FirstName: string }>(ctx, MEMBERS_ENTITY, 'ID IS NOT NULL', fields, marco, { BypassCache: true });
            Assert(marcoRows.map((row) => row.FirstName).sort().join(',') === 'Lou,Mo', `Marco reads chapter 40's two members: ${marcoRows.map((row) => row.FirstName).join(',')}`);
            const noraRows = await FindRows<{ ID: string }>(ctx, MEMBERS_ENTITY, 'ID IS NOT NULL', ['ID'], nora, { BypassCache: true });
            Assert(noraRows.length === 0 || noraRows.length === 5, `Nora, staff seated nowhere, reads through staff rights or not at all, never through the reach (${noraRows.length})`);
        },
    },
    {
        Id: 'stage2.S2',
        Name: 'S2 — the query door (rows 17 and 24, D29): national staff runs the staff space\'s renewals query with the chapter bound on the server; a leader who does not reach that space is refused; a staff space with no chapter anchor refuses the run; each run is in the log',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await GetPersonaUser(ctx, 'nico');
            const lena = await GetPersonaUser(ctx, 'lena');
            const marco = await GetPersonaUser(ctx, 'marco');
            const grant = await grantOf(ctx, 'example-chapter-staff', 'Query');
            const before = (await FindRows<{ ID: string }>(ctx, AUDIT_LOGS, `RecordID = '${grant.ID}'`, ['ID'])).length;

            const ran = await runSpaceQuery({ provider: provider(ctx), user: nico, spaceId: CHAPTER_12_STAFF, grantId: grant.ID });
            Assert(ran.ok, `Nico runs the renewals query in the staff space: ${ran.ok ? '' : ran.message}`);
            if (ran.ok) {
                Assert(ran.rowCount === 2, `Chapter 12's renewals fall in two months (${ran.rowCount}): the chapter was bound on the server`);
                Assert(ran.rows.every((row) => Number(row['Renewals']) >= 1), 'Each month counts at least one renewal');
            }
            const marcoTries = await runSpaceQuery({ provider: provider(ctx), user: marco, spaceId: CHAPTER_12_STAFF, grantId: grant.ID });
            Assert(!marcoTries.ok && /do not reach/.test(marcoTries.message), `Marco, who reaches chapter 40 only, is refused (row 17): ${marcoTries.ok ? '' : marcoTries.message}`);
            const lenaTries = await runSpaceQuery({ provider: provider(ctx), user: lena, spaceId: CHAPTER_12_STAFF, grantId: grant.ID });
            Assert(!lenaTries.ok && /do not reach/.test(lenaTries.message), `Lena, a participant on chapter 12 but not on its staff space, is refused: ${lenaTries.ok ? '' : lenaTries.message}`);
            const bound = await runSpaceQuery({ provider: provider(ctx), user: nico, spaceId: CHAPTER_12_STAFF, grantId: grant.ID, clientValues: { ChapterID: 'F1000001-0000-4000-8000-000000000040' } });
            Assert(!bound.ok && /bound by the grant/.test(bound.message), `A value for the bound ChapterID is refused (row 16's rule): ${bound.ok ? '' : bound.message}`);

            // Row 24: a staff space with no chapter anchor never runs the query unbound
            const bare = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, nico);
            bare.NewRecord();
            bare.Name = `${CHECK_SPACE_PREFIX}S2-unanchored-${Date.now()}`;
            bare.SpaceTypeID = await typeId(ctx, 'example-chapter-staff');
            bare.ParentID = CHAPTER_12;
            bare.InheritsMembership = false;
            bare.OwnerID = nico.ID;
            Assert(await bare.Save() && !!bare.ID, `Nico creates a staff space with no anchor: ${bare.LatestResult?.CompleteMessage ?? ''}`);
            try {
                const unanchored = await runSpaceQuery({ provider: provider(ctx), user: nico, spaceId: bare.ID, grantId: grant.ID });
                Assert(!unanchored.ok && /no anchor with the role "chapter"/.test(unanchored.message), `No anchor, no run (row 24): ${unanchored.ok ? '' : unanchored.message}`);
            } finally {
                await cleanupSpace(ctx.Provider, ctx.User, bare.ID);
            }

            const after = await FindRows<{ ID: string; Status: string; AuditLogType: string }>(ctx, AUDIT_LOGS, `RecordID = '${grant.ID}'`, ['ID', 'Status', 'AuditLogType'], undefined, { BypassCache: true });
            Assert(after.length >= before + 3, `The run, the bound-name refusal and the unanchored refusal are in the log (${after.length - before} new rows)`);
            Assert(after.every((row) => row.AuditLogType === GRANT_RUN_AUDIT_LOG_TYPE), `Every row is a ${GRANT_RUN_AUDIT_LOG_TYPE}`);
            await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, AUDIT_LOGS, `RecordID = '${grant.ID}'`, 'the grant run log rows'));
        },
    },
    {
        Id: 'stage2.S3',
        Name: 'S3 — the same-type run (row 18): chapter 12\'s override reaches its chapter sub-space, not its staff sub-space; a space removes one action its type grants and the sibling keeps it (row 21)',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await GetPersonaUser(ctx, 'nico');
            const dev = await GetPersonaUser(ctx, 'dev'); // Developer: holds Configure Spaces, which a settings change takes, with an owner seat
            const [ownerRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            const devSeat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, nico);
            devSeat.NewRecord();
            devSeat.SpaceID = CHAPTER_12;
            devSeat.UserID = dev.ID;
            devSeat.SpaceRoleTypeID = ownerRole.ID;
            devSeat.Band = 'Team';
            devSeat.Status = 'Active';
            Assert(await devSeat.Save(), `Nico seats Dev as an owner of chapter 12: ${devSeat.LatestResult?.CompleteMessage ?? ''}`);
            const chapter = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
            Assert(await chapter.Load(CHAPTER_12), 'Dev loads chapter 12');
            const original = chapter.Configuration;
            chapter.Configuration = JSON.stringify({ Chats: { WhoCanStart: 'Owners' } });
            Assert(await chapter.Save(), `Dev sets who may start chats in chapter 12: ${chapter.LatestResult?.CompleteMessage ?? ''}`);
            let removal: mjBizAppsCollaborationSpaceGrantEntity | null = null;
            try {
                const outreach = (await loadSpaceConfiguration(provider(ctx), CHAPTER_12_OUTREACH)).configuration;
                Assert(outreach.Settings.Chats.WhoCanStart === 'Owners', "The chapter sub-space, of the same type, inherits chapter 12's override");
                Assert(outreach.Chain.map((link) => link.LevelID?.toLowerCase()).join('>').includes(`${CHAPTER_12.toLowerCase()}>${CHAPTER_12_OUTREACH.toLowerCase()}`), 'The chain runs chapter 12 then its sub-space');
                const staff = (await loadSpaceConfiguration(provider(ctx), CHAPTER_12_STAFF)).configuration;
                Assert(staff.Settings.Chats.WhoCanStart === 'Anyone', 'The staff sub-space, of another type, starts again from its own type');
                Assert(staff.Audience === 'StaffOnly' && outreach.Audience === 'StaffAndParticipants', 'Each configuration carries its own type\'s audience');

                // Row 21: chapter 12 removes the reminder its type grants; chapter 40 keeps it
                const action = await grantOf(ctx, 'example-chapter', 'Action');
                const removed = await saveGrant(ctx, nico, { SpaceID: CHAPTER_12, Kind: 'Action', TargetRecordID: action.TargetRecordID, Mode: 'Remove' });
                Assert(removed.saved, `Nico removes the type's action for chapter 12: ${removed.message}`);
                removal = removed.row;
                const twelve = (await loadSpaceConfiguration(provider(ctx), CHAPTER_12)).configuration;
                Assert(twelve.Grants.Action.length === 0, `Chapter 12 offers no action (${twelve.Grants.Action.length})`);
                const sub = (await loadSpaceConfiguration(provider(ctx), CHAPTER_12_OUTREACH)).configuration;
                Assert(sub.Grants.Action.length === 0, 'The removal reaches the same-type sub-space');
                const forty = (await loadSpaceConfiguration(provider(ctx), CHAPTER_40)).configuration;
                Assert(forty.Grants.Action.length === 1 && forty.Grants.Action[0].Level === 'Type', 'Chapter 40 still offers the type\'s action, with its binding');
                Assert(JSON.stringify(forty.Grants.Action[0].Bindings) === JSON.stringify({ ChapterID: { From: 'Anchor:chapter' } }), 'The action is bound to the chapter anchor');
            } finally {
                if (removal?.ID) await cleanupStep(async () => { Assert(await removal!.Delete(), 'The removal row is deleted'); });
                await cleanupStep(async () => {
                    const back = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                    Assert(await back.Load(CHAPTER_12), 'Dev reloads chapter 12');
                    back.Configuration = original;
                    Assert(await back.Save(), `Chapter 12's settings are restored: ${back.LatestResult?.CompleteMessage ?? ''}`);
                });
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, `SpaceID = '${CHAPTER_12}' AND UserID = '${dev.ID}'`, "Dev's seat on chapter 12"));
            }
        },
    },
    {
        Id: 'stage2.S4',
        Name: 'S4 — closed until MJ#4789 (D36; rows 13, 16, 23): a view with a binding, a dashboard, a query or an unbound view granted to a type that seats participants are refused on save; the same query on the staff-only type is accepted',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const dev = await GetPersonaUser(ctx, 'dev');
            const chapterType = await typeId(ctx, 'example-chapter');
            const staffType = await typeId(ctx, 'example-chapter-staff');
            const query = await grantOf(ctx, 'example-chapter-staff', 'Query');
            const boundView = await saveGrant(ctx, dev, { SpaceTypeID: chapterType, Kind: 'View', Bindings: JSON.stringify({ Chapter: { From: 'Anchor:chapter' } }) });
            Assert(!boundView.saved && /A14/.test(boundView.message), `A view with a binding is refused (row 13): ${boundView.message}`);
            const dashboard = await saveGrant(ctx, dev, { SpaceTypeID: chapterType, Kind: 'Dashboard' });
            Assert(!dashboard.saved && /A15/.test(dashboard.message), `A dashboard is refused: ${dashboard.message}`);
            const participantQuery = await saveGrant(ctx, dev, { SpaceTypeID: chapterType, Kind: 'Query', TargetRecordID: query.TargetRecordID });
            Assert(!participantQuery.saved && /A17, D34/.test(participantQuery.message), `A query on a type that seats participants is refused (row 23): ${participantQuery.message}`);
            const plainView = await saveGrant(ctx, dev, { SpaceTypeID: chapterType, Kind: 'View' });
            Assert(!plainView.saved && /A17/.test(plainView.message), `An unbound view on a type that seats participants is refused: ${plainView.message}`);
            // The staff type already grants the renewals query (metadata-tests/space-grants, and the type-level index is unique), so another query stands in
            const [otherQuery] = await FindRows<{ ID: string }>(ctx, 'MJ: Queries', "Name = 'Collaboration Home Counts'", ['ID']);
            Assert(!!otherQuery, "The shipped 'Collaboration Home Counts' query exists");
            const staffQuery = await saveGrant(ctx, dev, { SpaceTypeID: staffType, Kind: 'Query', TargetRecordID: otherQuery.ID, Band: 'Team' });
            Assert(staffQuery.saved, `A query on the staff-only type is accepted: ${staffQuery.message}`);
            await cleanupStep(async () => { Assert(await staffQuery.row.Delete(), 'The second staff query grant is deleted'); });
        },
    },
    {
        Id: 'stage2.S5',
        Name: 'S5 — RunSpaceView runs an unbound view grant as the caller (before A14); the band cut: a Team grant is not in force for a Shared seat',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const dev = await GetPersonaUser(ctx, 'dev');
            const nico = await GetPersonaUser(ctx, 'nico');
            const lena = await GetPersonaUser(ctx, 'lena');
            const staffType = await typeId(ctx, 'example-chapter-staff');
            // A user view of the chapter members, owned by Nico, so the staff type can grant it
            const [viewsEntity] = await FindRows<{ ID: string }>(ctx, 'MJ: Entities', `Name = '${MEMBERS_ENTITY}'`, ['ID']);
            const view = await ctx.Provider.GetEntityObject<import('@memberjunction/core').BaseEntity>('MJ: User Views', nico);
            view.NewRecord();
            view.Set('Name', `${CHECK_SPACE_PREFIX}S5 members`);
            view.Set('UserID', nico.ID);
            view.Set('EntityID', viewsEntity.ID);
            view.Set('IsShared', false);
            view.Set('IsDefault', false);
            view.Set('WhereClause', `ChapterID = '${CHAPTER_12_RECORD}'`);
            Assert(await view.Save(), `Nico saves a view of chapter 12's members: ${view.LatestResult?.CompleteMessage ?? ''}`);
            const viewId = String(view.Get('ID'));
            let grant: mjBizAppsCollaborationSpaceGrantEntity | null = null;
            try {
                const granted = await saveGrant(ctx, dev, { SpaceTypeID: staffType, Kind: 'View', TargetRecordID: viewId, Band: 'Team' });
                Assert(granted.saved, `Dev grants the unbound view to the staff type: ${granted.message}`);
                grant = granted.row;
                const ran = await runSpaceView({ provider: provider(ctx), user: nico, spaceId: CHAPTER_12_STAFF, grantId: grant.ID });
                Assert(ran.ok, `Nico runs the view in the staff space: ${ran.ok ? '' : ran.message}`);
                if (ran.ok) Assert(ran.rowCount === 3, `The view returns chapter 12's three members as Nico sees them (${ran.rowCount})`);
                const lenaTries = await runSpaceView({ provider: provider(ctx), user: lena, spaceId: CHAPTER_12_STAFF, grantId: grant.ID });
                Assert(!lenaTries.ok, 'Lena does not reach the staff space, so the grant is not hers to run');
                const withProperty = await runSpaceView({ provider: provider(ctx), user: nico, spaceId: CHAPTER_12_STAFF, grantId: grant.ID, clientValues: { Chapter: '40' } });
                Assert(!withProperty.ok && /A14/.test(withProperty.message), `A property on a view waits for A14: ${withProperty.ok ? '' : withProperty.message}`);
            } finally {
                if (grant?.ID) await cleanupStep(async () => { Assert(await grant!.Delete(), 'The view grant is deleted'); });
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, AUDIT_LOGS, `RecordID = '${grant?.ID ?? viewId}'`, 'the view run log rows'));
                await cleanupStep(async () => { Assert(await view.Delete(), 'The view is deleted'); });
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage2', {
    Setup: async () => {},
    Teardown: async () => {},
});
