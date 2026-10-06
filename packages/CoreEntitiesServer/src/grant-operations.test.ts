import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type EntityInfo, type IMetadataProvider, type RunViewParams, type RunViewResult, type UserInfo } from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { GRANT_RUN_AUDIT_LOG_TYPE, getSpaceDashboard, runSpaceQuery, runSpaceView } from '../dist/grant-operations.js';
import { seedAppSettings } from './app-settings.test-support.ts';

const SPACE = '11111111-1111-4111-8111-111111111111';
const TYPE = '22222222-2222-4222-8222-222222222222';
const QUERY_GRANT = '33333333-3333-4333-8333-333333333333';
const VIEW_GRANT = '44444444-4444-4444-8444-444444444444';
const BOUND_VIEW_GRANT = '55555555-5555-4555-8555-555555555555';
const DASH_GRANT = '66666666-6666-4666-8666-666666666666';
const QUERY = '77777777-7777-4777-8777-777777777777';
const VIEW = '88888888-8888-4888-8888-888888888888';
const DASHBOARD = '99999999-9999-4999-8999-999999999999';
const CHAPTER_12 = 'CCCCCCCC-0000-4000-8000-000000000012';
const ROLE_MEMBER = 'AAAAAAAA-0000-4000-8000-00000000000A';
const ROLE_STAFF = 'AAAAAAAA-0000-4000-8000-00000000000B';
const LENA = { ID: 'DDDDDDDD-0000-4000-8000-000000000001', Email: 'lena@example.test', UserRoles: [] } as unknown as UserInfo;
const MARCO = { ID: 'DDDDDDDD-0000-4000-8000-000000000002', Email: 'marco@example.test', UserRoles: [] } as unknown as UserInfo;
const NICO = { ID: 'DDDDDDDD-0000-4000-8000-000000000003', Email: 'nico@example.test', UserRoles: [] } as unknown as UserInfo;

interface Audit { user: string; type: string; status: string; details: Record<string, unknown> }

/** A world: one space of one type, three grants, Lena seated Shared, Nico seated Team, Marco not seated. */
function world(options: { auditFails?: boolean } = {}) {
    const audits: Audit[] = [];
    const queryRuns: Array<{ QueryID?: string; Parameters?: Record<string, unknown> }> = [];
    const viewRuns: Array<RunViewParams> = [];
    const ok = <T>(rows: object[]): RunViewResult<T> => ({ Success: true, Results: rows as unknown as T[], RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0, ErrorMessage: '' });
    const grants = [
        { ID: QUERY_GRANT, SpaceTypeID: TYPE, SpaceID: null, Kind: 'Query', Mode: 'Extend', TargetEntityID: 'E-Q', TargetRecordID: QUERY, Band: 'Shared', IsDefault: false, Sequence: 1, Bindings: JSON.stringify({ ChapterID: { From: 'Anchor:chapter' } }) },
        { ID: VIEW_GRANT, SpaceTypeID: TYPE, SpaceID: null, Kind: 'View', Mode: 'Extend', TargetEntityID: 'E-V', TargetRecordID: VIEW, Band: 'Team', IsDefault: false, Sequence: 2, Bindings: null },
        { ID: BOUND_VIEW_GRANT, SpaceTypeID: TYPE, SpaceID: null, Kind: 'View', Mode: 'Extend', TargetEntityID: 'E-V', TargetRecordID: VIEW, Band: 'Shared', IsDefault: false, Sequence: 3, Bindings: JSON.stringify({ Chapter: { From: 'Anchor:chapter' } }) },
        { ID: DASH_GRANT, SpaceTypeID: TYPE, SpaceID: null, Kind: 'Dashboard', Mode: 'Extend', TargetEntityID: 'E-D', TargetRecordID: DASHBOARD, Band: 'Shared', IsDefault: false, Sequence: 4, Bindings: null },
    ];
    const provider = {
        async RunView<T>(params: RunViewParams, user?: UserInfo): Promise<RunViewResult<T>> {
            const filter = String(params.ExtraFilter ?? '');
            if (params.ViewID) { viewRuns.push(params); return ok([{ ID: 'row-1', RanAs: user?.ID }]); }
            switch (params.EntityName) {
                case 'MJ_BizApps_Collaboration: Space Types': return ok([{ ID: TYPE, Code: 'example-chapter', Configuration: null }]);
                case 'MJ_BizApps_Collaboration: Spaces': return ok([{ ID: SPACE, ParentID: null, SpaceTypeID: TYPE, Configuration: null, InheritsMembership: true, OwnerID: NICO.ID, AgentRetrieval: 'Included', ClosedAt: null, StatusID: null, Name: 'Chapter 12' }]);
                case 'MJ_BizApps_Collaboration: Space Grants': return ok(filter.includes('SpaceID IS NULL') ? grants : []);
                case 'MJ_BizApps_Collaboration: Space Members': {
                    const who = /UserID = '([0-9a-f-]{36})'/i.exec(filter)?.[1]?.toLowerCase();
                    if (who === LENA.ID.toLowerCase()) return ok([{ SpaceID: SPACE, UserID: LENA.ID, Status: 'Active', Band: 'Shared', SpaceRoleTypeID: ROLE_MEMBER }]);
                    if (who === NICO.ID.toLowerCase()) return ok([{ SpaceID: SPACE, UserID: NICO.ID, Status: 'Active', Band: 'Team', SpaceRoleTypeID: ROLE_STAFF }]);
                    return ok([]);
                }
                case 'MJ_BizApps_Collaboration: Space Role Types': return ok([
                    { ID: ROLE_MEMBER, Level: 1, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true },
                    { ID: ROLE_STAFF, Level: 3, MaxGrantableLevel: 3, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
                ]);
                case 'MJ_BizApps_Collaboration: Space Anchors': return ok([{ ID: 'A1', EntityID: 'E-CH', RecordID: CHAPTER_12, Role: 'chapter' }]);
                case 'MJ: Queries': case 'MJ: User Views': case 'MJ: Dashboards': {
                    const ids = [...filter.matchAll(/'([0-9a-f-]{36})'/gi)].map((m) => m[1]);
                    return ok(ids.map((ID) => ({ ID })));
                }
                case 'MJ: Query Parameters': return ok([{ Name: 'ChapterID' }, { Name: 'Month' }]);
                default: return ok([]);
            }
        },
        async RunViews(list: RunViewParams[], user?: UserInfo) { return Promise.all(list.map((p) => provider.RunView(p, user))); },
        async RunQuery(params: { QueryID?: string; Parameters?: Record<string, unknown> }) { queryRuns.push(params); return { Success: true, Results: [{ Month: 1, Renewals: 3 }], RowCount: 1 }; },
        EntityByName(name: string): EntityInfo | null { return { ID: 'E-GRANTS', Name: name } as unknown as EntityInfo; },
        EntityByID(): EntityInfo | null { return null; },
        async CreateAuditLogRecord(user: UserInfo, _auth: string | null, type: string, status: string, details: string) {
            if (options.auditFails) return null;
            audits.push({ user: user.ID, type, status, details: JSON.parse(details) as Record<string, unknown> });
            return {};
        },
    };
    return { provider: provider as unknown as IMetadataProvider, audits, queryRuns, viewRuns };
}

describe('the grant operations (B17, D29)', () => {
    let restoreAppSettings: () => void;
    let heldAdminister: typeof CollaborationEngine.Instance.UserMayAdministerSpaces;
    let heldSystem: typeof WellKnownUserSource.Instance.GetSystemUser;
    before(() => {
        restoreAppSettings = seedAppSettings();
        heldAdminister = CollaborationEngine.Instance.UserMayAdministerSpaces.bind(CollaborationEngine.Instance);
        CollaborationEngine.Instance.UserMayAdministerSpaces = () => false;
        heldSystem = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
    });
    after(() => { restoreAppSettings(); CollaborationEngine.Instance.UserMayAdministerSpaces = heldAdminister; WellKnownUserSource.Instance.GetSystemUser = heldSystem; });

    it('RunSpaceQuery: resolves the binding on the server, runs with the bound value, and logs the caller and the bound names, not the values', async () => {
        const w = world();
        await CollaborationEngine.Instance.Config(true, undefined, w.provider);
        const outcome = await runSpaceQuery({ provider: w.provider, user: LENA, spaceId: SPACE, grantId: QUERY_GRANT, clientValues: { Month: 3 } });
        assert.equal(outcome.ok, true, (outcome as { message?: string }).message);
        assert.deepEqual(w.queryRuns, [{ QueryID: QUERY, Parameters: { Month: 3, ChapterID: CHAPTER_12 } }]);
        assert.equal(w.audits.length, 1);
        assert.equal(w.audits[0].type, GRANT_RUN_AUDIT_LOG_TYPE);
        assert.equal(w.audits[0].status, 'Success');
        assert.equal(w.audits[0].user, LENA.ID);
        assert.deepEqual(w.audits[0].details.boundNames, ['ChapterID']);
        assert.deepEqual(w.audits[0].details.boundSources, { ChapterID: 'Anchor:chapter' });
        assert.equal(JSON.stringify(w.audits[0].details).includes(CHAPTER_12), false, 'the bound value is not in the log');
    });

    it('RunSpaceQuery: refuses a client value for the bound name (A17 as the server enforces it), and for a parameter the query lacks', async () => {
        const w = world();
        await CollaborationEngine.Instance.Config(true, undefined, w.provider);
        const bound = await runSpaceQuery({ provider: w.provider, user: LENA, spaceId: SPACE, grantId: QUERY_GRANT, clientValues: { ChapterID: 40 } });
        assert.equal(bound.ok, false);
        if (!bound.ok) assert.match(bound.message, /bound by the grant/);
        const unknown = await runSpaceQuery({ provider: w.provider, user: LENA, spaceId: SPACE, grantId: QUERY_GRANT, clientValues: { Year: 2026 } });
        assert.equal(unknown.ok, false);
        if (!unknown.ok) assert.match(unknown.message, /no parameter or property named "Year"/);
        assert.equal(w.queryRuns.length, 0, 'nothing ran');
    });

    it('refuses someone who does not reach the space, and a grant outside the caller\'s band', async () => {
        const w = world();
        await CollaborationEngine.Instance.Config(true, undefined, w.provider);
        const stranger = await runSpaceQuery({ provider: w.provider, user: MARCO, spaceId: SPACE, grantId: QUERY_GRANT });
        assert.equal(stranger.ok, false);
        if (!stranger.ok) assert.match(stranger.message, /do not reach this space/);
        const teamOnly = await runSpaceView({ provider: w.provider, user: LENA, spaceId: SPACE, grantId: VIEW_GRANT });
        assert.equal(teamOnly.ok, false);
        if (!teamOnly.ok) assert.match(teamOnly.message, /no view grant with that id is in force in this space for you/);
        assert.equal(w.audits.length, 0, 'a refusal before the run is not a run');
    });

    it('RunSpaceView: runs an unbound view as the caller, so row-level security applies; a bound view and view properties wait for A14', async () => {
        const w = world();
        await CollaborationEngine.Instance.Config(true, undefined, w.provider);
        const ran = await runSpaceView({ provider: w.provider, user: NICO, spaceId: SPACE, grantId: VIEW_GRANT });
        assert.equal(ran.ok, true, (ran as { message?: string }).message);
        if (ran.ok) assert.deepEqual(ran.rows, [{ ID: 'row-1', RanAs: NICO.ID }]);
        assert.equal(w.viewRuns[0]?.ViewID, VIEW);
        const bound = await runSpaceView({ provider: w.provider, user: LENA, spaceId: SPACE, grantId: BOUND_VIEW_GRANT });
        assert.equal(bound.ok, false);
        if (!bound.ok) assert.match(bound.message, /cannot be bound to the space until MJ#4789/);
        const withProperties = await runSpaceView({ provider: w.provider, user: NICO, spaceId: SPACE, grantId: VIEW_GRANT, clientValues: { Chapter: 12 } });
        assert.equal(withProperties.ok, false);
        if (!withProperties.ok) assert.match(withProperties.message, /takes no properties until MJ#4789/);
    });

    it('GetSpaceDashboard: has no grant to return before A15', async () => {
        const w = world();
        await CollaborationEngine.Instance.Config(true, undefined, w.provider);
        const outcome = await getSpaceDashboard({ provider: w.provider, user: LENA, spaceId: SPACE, grantId: DASH_GRANT });
        assert.equal(outcome.ok, false);
        if (!outcome.ok) assert.match(outcome.message, /until MJ#4789 \(A15\)/);
    });

    it('a run that cannot be logged is refused, and an invalid id never reaches a filter', async () => {
        const w = world({ auditFails: true });
        await CollaborationEngine.Instance.Config(true, undefined, w.provider);
        const unlogged = await runSpaceQuery({ provider: w.provider, user: LENA, spaceId: SPACE, grantId: QUERY_GRANT });
        assert.equal(unlogged.ok, false);
        if (!unlogged.ok) assert.match(unlogged.message, /could not be logged/);
        const bad = await runSpaceQuery({ provider: w.provider, user: LENA, spaceId: "x'; DROP TABLE Space; --", grantId: QUERY_GRANT });
        assert.equal(bad.ok, false);
        if (!bad.ok) assert.match(bad.message, /not valid/);
    });
});
