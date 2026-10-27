/**
 * Stage 2 over the wire: the personas act through MJAPI (GraphQL) and the typed client, so the row filters, the grant operations and
 * the configuration cut are seen as a browser sees them.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient } from '@mj-biz-apps/collaboration-entities';
import type { EffectiveSpaceConfiguration } from '@mj-biz-apps/collaboration-core';
import { SPACE_GRANT_ENTITY, SPACE_TYPE_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext } from '../../wire.js';
import { cleanupSpace, cleanupStep, deleteWhere, registerChecks } from '../cleanup-helpers.js';

const CHAPTER_12 = 'C1000001-0000-4000-8000-000000000016';
const CHAPTER_40 = 'C1000001-0000-4000-8000-000000000017';
const CHAPTER_12_STAFF = 'C1000001-0000-4000-8000-000000000019';
const CHAPTER_12_RECORD = 'F1000001-0000-4000-8000-000000000012';
const CHAPTER_40_RECORD = 'F1000001-0000-4000-8000-000000000040';
const MEMBERS_ENTITY = 'MJ_BizApps_Collaboration_Examples: Example Chapter Members';
const CHAPTERS_ENTITY = 'MJ_BizApps_Collaboration_Examples: Example Chapters';
const AUDIT_LOGS = 'MJ: Audit Logs';
type ClientPersona = Awaited<ReturnType<typeof getPersonaClientContext>>;

const asPersona = (ctx: IntegrationCheckContext, persona: ClientPersona): IntegrationCheckContext => ({ ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext);
const clientOf = (persona: ClientPersona): CollaborationClient => new CollaborationClient(persona.GraphQLProvider);

async function queryGrantId(ctx: IntegrationCheckContext): Promise<string> {
    const [type] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'example-chapter-staff'", ['ID']);
    const [grant] = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, `SpaceTypeID = '${type.ID}' AND Kind = 'Query'`, ['ID']);
    Assert(!!grant, 'The staff type grants the renewals query');
    return grant.ID;
}

const checks: NamedCheck[] = [
    {
        Id: 'stage2.SC1',
        Name: 'SC1 — over the wire (row 14): Lena reads chapter 12\'s members through the generated filter and no field outside the allow-list; Marco reads chapter 40\'s',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const lena = await getPersonaClientContext(ctx, 'lena');
            const marco = await getPersonaClientContext(ctx, 'marco');
            const rows = await FindRows<{ FirstName: string; LastName: string; DuesBalance?: unknown }>(asPersona(ctx, lena), MEMBERS_ENTITY, 'ID IS NOT NULL', ['ID', 'FirstName', 'LastName', 'DuesBalance'], lena.User, { BypassCache: true });
            Assert(rows.length === 3 && rows.every((row) => row.LastName === 'Twelve'), `Lena reads chapter 12's three members over the wire (${rows.length}: ${rows.map((row) => row.FirstName).join(',')})`);
            Assert(rows.every((row) => row.DuesBalance === null || row.DuesBalance === undefined), 'DuesBalance, outside the allow-list, comes back empty over the wire');
            const marcoRows = await FindRows<{ FirstName: string }>(asPersona(ctx, marco), MEMBERS_ENTITY, 'ID IS NOT NULL', ['ID', 'FirstName'], marco.User, { BypassCache: true });
            Assert(marcoRows.map((row) => row.FirstName).sort().join(',') === 'Lou,Mo', `Marco reads chapter 40's members: ${marcoRows.map((row) => row.FirstName).join(',')}`);
        },
    },
    {
        Id: 'stage2.SC2',
        Name: 'SC2 — over the wire: RunSpaceQuery runs for national staff in the staff space with the chapter bound on the server; a value for the bound name is refused and logged (row 16); a leader who does not reach the space is refused (row 17)',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await getPersonaClientContext(ctx, 'nico');
            const marco = await getPersonaClientContext(ctx, 'marco');
            const grantId = await queryGrantId(ctx);
            const before = (await FindRows<{ ID: string }>(ctx, AUDIT_LOGS, `RecordID = '${grantId}'`, ['ID'])).length;
            try {
                const ran = await clientOf(nico).RunSpaceQuery({ SpaceID: CHAPTER_12_STAFF, GrantID: grantId });
                Assert(ran.Success, `Nico runs the renewals query over the wire: ${ran.ErrorMessage ?? ''}`);
                Assert(ran.RowCount === 2, `Two months of renewals for chapter 12 (${ran.RowCount})`);
                const rows = JSON.parse(ran.RowsJSON ?? '[]') as Array<{ Renewals: number }>;
                Assert(rows.length === 2 && rows.every((row) => Number(row.Renewals) >= 1), 'The rows came back as JSON');
                const bound = await clientOf(nico).RunSpaceQuery({ SpaceID: CHAPTER_12_STAFF, GrantID: grantId, ValuesJSON: JSON.stringify({ ChapterID: CHAPTER_40_RECORD }) });
                Assert(!bound.Success && /bound by the grant/.test(bound.ErrorMessage ?? ''), `A value for ChapterID is refused (row 16): ${bound.ErrorMessage ?? ''}`);
                const marcoTries = await clientOf(marco).RunSpaceQuery({ SpaceID: CHAPTER_12_STAFF, GrantID: grantId });
                Assert(!marcoTries.Success && /do not reach/.test(marcoTries.ErrorMessage ?? ''), `Marco is refused (row 17): ${marcoTries.ErrorMessage ?? ''}`);
                const dashboard = await clientOf(nico).GetSpaceDashboard(CHAPTER_12_STAFF, grantId);
                Assert(!dashboard.Success, 'No dashboard is returned before A15 (the grant is a query, and no dashboard is granted anyway)');
                const after = (await FindRows<{ ID: string }>(ctx, AUDIT_LOGS, `RecordID = '${grantId}'`, ['ID'], undefined, { BypassCache: true })).length;
                Assert(after >= before + 2, `The run and the refused attempt are logged (${after - before} new rows)`);
            } finally {
                await cleanupStep(() => deleteWhere(ctx.Provider, ctx.User, AUDIT_LOGS, `RecordID = '${grantId}'`, 'the grant run log rows'));
            }
        },
    },
    {
        Id: 'stage2.SC3',
        Name: 'SC3 — over the wire: GetSpaceConfiguration gives a leader her band\'s grants with the bindings removed and the Shared reach; the owner gets the whole document; someone who does not reach the space gets none',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const lena = await getPersonaClientContext(ctx, 'lena');
            const nico = await getPersonaClientContext(ctx, 'nico');
            const marco = await getPersonaClientContext(ctx, 'marco');
            const cut = await clientOf(lena).GetSpaceConfiguration(CHAPTER_12);
            Assert(cut.Success && !!cut.ConfigurationJSON, `Lena reads chapter 12's configuration: ${cut.ErrorMessage ?? ''}`);
            const lenaSees = JSON.parse(cut.ConfigurationJSON!) as EffectiveSpaceConfiguration;
            Assert(cut.Full === false && cut.CanSeeTeam === false, 'Lena gets the cut document, on the Shared band');
            Assert(lenaSees.Grants.Action.length === 1 && Object.keys(lenaSees.Grants.Action[0].Bindings).length === 0, 'The reminder action is listed for her, with its bindings removed');
            Assert(lenaSees.DataReach.length === 1 && lenaSees.DataReach[0].Band === 'Shared', 'The Shared reach is listed');
            Assert(lenaSees.Settings.Labels?.Bands?.Shared === 'Chapter members', `The type's band names come through: ${JSON.stringify(lenaSees.Settings.Labels)}`);
            const full = await clientOf(nico).GetSpaceConfiguration(CHAPTER_12);
            Assert(full.Success && full.Full === true, `Nico, the owner with the settings authorizations, gets the whole document: ${full.ErrorMessage ?? ''}`);
            const nicoSees = JSON.parse(full.ConfigurationJSON!) as EffectiveSpaceConfiguration;
            Assert(JSON.stringify(nicoSees.Grants.Action[0].Bindings) === JSON.stringify({ ChapterID: { From: 'Anchor:chapter' } }), 'The owner sees the binding');
            const none = await clientOf(marco).GetSpaceConfiguration(CHAPTER_12);
            Assert(!none.Success && /do not reach/.test(none.ErrorMessage ?? ''), `Marco gets no document: ${none.ErrorMessage ?? ''}`);
        },
    },
    {
        Id: 'stage2.SC4',
        Name: 'SC4 — over the wire: EnsureSpaceForRecord opens the staff space for a chapter once, finds it the second time, and refuses someone who cannot update the record (item 85)',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await getPersonaClientContext(ctx, 'nico');
            const lena = await getPersonaClientContext(ctx, 'lena');
            let spaceId: string | null = null;
            try {
                const first = await clientOf(nico).EnsureSpaceForRecord({ TypeCode: 'example-chapter-staff', EntityName: CHAPTERS_ENTITY, RecordID: CHAPTER_40_RECORD, SpaceName: 'Chapter 40 staff (SC4)', InheritsMembership: false });
                Assert(first.Success && !!first.SpaceID, `Nico opens the staff space for chapter 40: ${first.ErrorMessage ?? ''}`);
                spaceId = first.SpaceID!;
                const again = await clientOf(nico).EnsureSpaceForRecord({ TypeCode: 'example-chapter-staff', EntityName: CHAPTERS_ENTITY, RecordID: CHAPTER_40_RECORD });
                Assert(again.Success && again.SpaceID?.toLowerCase() === spaceId.toLowerCase(), 'The second call finds the same space');
                const refused = await clientOf(lena).EnsureSpaceForRecord({ TypeCode: 'example-chapter-staff', EntityName: CHAPTERS_ENTITY, RecordID: CHAPTER_12_RECORD });
                Assert(!refused.Success && /cannot update|cannot open|refused/i.test(refused.ErrorMessage ?? ''), `Lena, who cannot update chapters, is refused: ${refused.ErrorMessage ?? ''}`);
            } finally {
                if (spaceId) await cleanupSpace(ctx.Provider, ctx.User, spaceId);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage2', {
    Setup: async () => {},
    Teardown: async () => {},
});
