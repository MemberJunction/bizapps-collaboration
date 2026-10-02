/**
 * The stage 1 gates (the plan's § 5): Space Anchors, Space Grants, Space Notes, Space Member Pins and Space Type Status, each
 * judged through its real `ValidateAsync` and `Delete` on a mocked row over a fake provider that answers the reads the gates make.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { SpaceAnchorEntityServer, releaseAnchorWrite, vouchAnchorWrite } from '../dist/SpaceAnchorEntityServer.js';
import { SpaceGrantEntityServer } from '../dist/SpaceGrantEntityServer.js';
import { SpaceNoteEntityServer } from '../dist/SpaceNoteEntityServer.js';
import { SpaceMemberPinEntityServer } from '../dist/SpaceMemberPinEntityServer.js';
import { SpaceTypeStatusEntityServer } from '../dist/SpaceTypeStatusEntityServer.js';

const SYSTEM = '00000000-0000-4000-8000-000000000000';
const ADA = 'AAAAAAAA-0000-4000-8000-000000000001';
const BEA = 'AAAAAAAA-0000-4000-8000-000000000002';
const GUEST = 'AAAAAAAA-0000-4000-8000-000000000003';
const SPACE = 'C1000001-0000-4000-8000-000000000001';
const OTHER_SPACE = 'C1000001-0000-4000-8000-000000000002';
const CLOSED_SPACE = 'C1000001-0000-4000-8000-000000000003';
const TYPE = 'B0000000-0000-4000-8000-000000000001';
const OWNER_ROLE = 'A0000000-0000-4000-8000-000000000001';
const GUEST_ROLE = 'A0000000-0000-4000-8000-000000000003';
const DEALS = 'E0000000-0000-4000-8000-00000000000D';
const AGENTS = 'E0000000-0000-4000-8000-00000000000A';
const QUERIES = 'E0000000-0000-4000-8000-00000000000B';
const NOTES_ENTITY = 'E0000000-0000-4000-8000-00000000000E';
const DEAL_1 = 'D0000000-0000-4000-8000-000000000001';
const DEAL_2 = 'D0000000-0000-4000-8000-000000000002';
const AGENT = 'F0000000-0000-4000-8000-000000000001';
const QUERY = 'F0000000-0000-4000-8000-000000000002';
const APP_GRANT = '90000000-0000-4000-8000-000000000001';
const OTHER_GRANT = '90000000-0000-4000-8000-000000000002';
const NOTE_1 = '80000000-0000-4000-8000-000000000001';
const ACTIVE = 'E1000000-0000-4000-8000-000000000001';
const PAUSED = 'E1000000-0000-4000-8000-000000000002';

type Row = Record<string, unknown>;
const user = (id: string, role: string): UserInfo => ({ ID: id, Name: id.slice(-1), UserRoles: [{ Role: role }] } as unknown as UserInfo);
const ada = user(ADA, 'UI');
const bea = user(BEA, 'UI');
const guest = user(GUEST, 'Space Participant');

const tables: Record<string, Row[]> = {
    'MJ_BizApps_Collaboration: Spaces': [
        { ID: SPACE, Name: 'Northwind', ParentID: null, InheritsMembership: true, OwnerID: ADA, SpaceTypeID: TYPE, AgentRetrieval: 'Included', ClosedAt: null, StatusID: null },
        { ID: OTHER_SPACE, Name: 'Harbor', ParentID: null, InheritsMembership: true, OwnerID: BEA, SpaceTypeID: TYPE, AgentRetrieval: 'Included', ClosedAt: null, StatusID: null },
        { ID: CLOSED_SPACE, Name: 'Closed', ParentID: null, InheritsMembership: true, OwnerID: ADA, SpaceTypeID: TYPE, AgentRetrieval: 'Included', ClosedAt: '2026-01-01T00:00:00Z', StatusID: null },
    ],
    'MJ_BizApps_Collaboration: Space Members': [
        { ID: '1', SpaceID: SPACE, UserID: ADA, Status: 'Active', Band: 'Team', SpaceRoleTypeID: OWNER_ROLE },
        { ID: '2', SpaceID: SPACE, UserID: GUEST, Status: 'Active', Band: 'Shared', SpaceRoleTypeID: GUEST_ROLE },
        { ID: '3', SpaceID: CLOSED_SPACE, UserID: ADA, Status: 'Active', Band: 'Team', SpaceRoleTypeID: OWNER_ROLE },
    ],
    'MJ_BizApps_Collaboration: Space Role Types': [
        { ID: OWNER_ROLE, Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
        { ID: GUEST_ROLE, Level: 10, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: false },
    ],
    'MJ_BizApps_Collaboration: Space Types': [{ ID: TYPE, InviteApproval: 'Approve', MemberCap: null, Configuration: null }],
    'MJ_BizApps_Collaboration: Space Anchors': [
        { ID: '70000000-0000-4000-8000-000000000001', SpaceID: OTHER_SPACE, Space: 'Harbor', SpaceTypeID: TYPE, EntityID: DEALS, RecordID: `ID|${DEAL_2}`, Role: 'primary', IsPrimary: true },
    ],
    'MJ_BizApps_Collaboration: Space Grants': [
        { ID: APP_GRANT, Kind: 'Agent', SpaceID: null, SpaceTypeID: null, TargetRecordID: AGENT },
        { ID: OTHER_GRANT, Kind: 'Agent', SpaceID: OTHER_SPACE, SpaceTypeID: null, TargetRecordID: AGENT },
    ],
    'MJ_BizApps_Collaboration: Space Notes': [{ ID: NOTE_1, SpaceID: SPACE, AuthorUserID: ADA }],
    'MJ_BizApps_Collaboration: Space Items': [{ ID: '60000000-0000-4000-8000-000000000001', SpaceID: SPACE, EntityID: DEALS, RecordID: `ID|${DEAL_1}` }],
    'MJ_BizApps_Collaboration: Space Type Status': [
        { ID: ACTIVE, SpaceTypeID: TYPE, Code: 'active', Name: 'Active', Sequence: 1, IsDefault: true, ReadOnly: false, Visible: true, AgentRetrieval: true, CanChangeAfter: true, NotifyMembersOnEnter: false, IsTerminal: false },
        { ID: PAUSED, SpaceTypeID: TYPE, Code: 'paused', Name: 'Paused', Sequence: 2, IsDefault: false, ReadOnly: true, Visible: true, AgentRetrieval: true, CanChangeAfter: true, NotifyMembersOnEnter: true, IsTerminal: false },
    ],
    'MJ: AI Agents': [{ ID: AGENT, Name: 'Sage', Status: 'Active', AcceptsSkills: 'None', MaxCostPerRun: 5 }],
    'MJ: Queries': [{ ID: QUERY, Name: 'Open deals' }],
    'MJ: Query Parameters': [{ QueryID: QUERY, Name: 'AccountID' }],
};

const entities: Record<string, { ID: string; Name: string; PrimaryKeys: Array<{ Name: string; Type: string }> }> = {
    [DEALS]: { ID: DEALS, Name: 'Sales: Deals', PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' }] },
    [AGENTS]: { ID: AGENTS, Name: 'MJ: AI Agents', PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' }] },
    [QUERIES]: { ID: QUERIES, Name: 'MJ: Queries', PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' }] },
    [NOTES_ENTITY]: { ID: NOTES_ENTITY, Name: 'MJ_BizApps_Collaboration: Space Notes', PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' }] },
};

/** A small reader of the filters the gates write: =, <>, IN, IS [NOT] NULL, AND, OR and parentheses. */
function matches(row: Row, filter: string | undefined): boolean {
    if (!filter?.trim()) return true;
    const tokens = filter.match(/\(|\)|'(?:[^']|'')*'|[A-Za-z_][A-Za-z0-9_]*|<>|=|\d+/g) ?? [];
    let at = 0;
    const peek = () => tokens[at];
    const next = () => tokens[at++];
    const value = (token: string): unknown => token.startsWith("'") ? token.slice(1, -1).replace(/''/g, "'") : /^\d+$/.test(token) ? Number(token) : token;
    const same = (a: unknown, b: unknown): boolean => {
        if (typeof b === 'number') return (a === true && b === 1) || (a === false && b === 0) || Number(a) === b;
        return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
    };
    const primary = (): boolean => {
        if (peek() === '(') { next(); const inner = or(); next(); return inner; }
        const field = next();
        const op = next();
        if (op.toUpperCase() === 'IS') {
            let negate = false;
            if (peek().toUpperCase() === 'NOT') { negate = true; next(); }
            next(); // NULL
            const isNull = row[field] === null || row[field] === undefined;
            return negate ? !isNull : isNull;
        }
        if (op.toUpperCase() === 'IN') {
            next(); // (
            const list: unknown[] = [];
            while (peek() !== ')') list.push(value(next()));
            next();
            return list.some((v) => same(row[field], v));
        }
        const rhs = value(next());
        return op === '=' ? same(row[field], rhs) : !same(row[field], rhs);
    };
    const and = (): boolean => { let left = primary(); while (peek()?.toUpperCase() === 'AND') { next(); const right = primary(); left = left && right; } return left; };
    const or = (): boolean => { let left = and(); while (peek()?.toUpperCase() === 'OR') { next(); const right = and(); left = left || right; } return left; };
    return or();
}

function fakeProvider(): IMetadataProvider {
    const runView = async (params: { EntityName: string; ExtraFilter?: string }) => {
        const rows = (tables[params.EntityName] ?? []).filter((row) => matches(row, params.ExtraFilter));
        return { Success: true, Results: rows, RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0, ErrorMessage: '' };
    };
    return {
        RunView: runView,
        RunViews: async (list: Array<{ EntityName: string; ExtraFilter?: string }>) => Promise.all(list.map(runView)),
        EntityByName: (name: string) => Object.values(entities).find((e) => e.Name === name),
        EntityByID: (id: string) => entities[id.toUpperCase()],
        GetEntityObject: async () => { throw new Error('not needed'); },
    } as unknown as IMetadataProvider;
}

/** A row of the gate's class over the fake provider: own writable properties, plain Fields, as the other gate tests mock them. */
function mockRow<T extends object>(prototype: T, who: UserInfo, values: Row, options: { saved?: boolean; dirty?: string[]; old?: Row } = {}): T {
    const row = Object.create(prototype) as T;
    const provider = fakeProvider();
    const dirty = new Set(options.dirty ?? (options.saved ? [] : Object.keys(values)));
    Object.defineProperties(row, {
        ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v, writable: true }])),
        Fields: { value: Object.entries(values).map(([Name, Value]) => ({ Name, Value, OldValue: options.old?.[Name] ?? Value, Dirty: dirty.has(Name) })), writable: true },
        ContextCurrentUser: { value: who, writable: true },
        IsSaved: { value: !!options.saved, writable: true },
        ProviderToUse: { value: provider, writable: true },
        RunViewProviderToUse: { value: provider, writable: true },
        _fieldCache: { value: new Map(), writable: true },
        _resultHistory: { value: [], writable: true },
    });
    return row;
}

const errorOn = (res: { Errors: Array<{ Source: string; Message: string }> }, field?: string) => (field ? res.Errors.find((e) => e.Source === field) : res.Errors[0])?.Message ?? '';

const rights = { configureSpaces: true, configureTypes: true };
let held: Record<string, unknown> = {};
before(() => {
    const engine = CollaborationEngine.Instance;
    held = {
        system: WellKnownUserSource.Instance.GetSystemUser, spaces: engine.UserCanConfigureSpaces, types: engine.UserCanConfigureSpaceTypes,
        ensure: engine.EnsureLoaded, typeById: engine.SpaceTypeById,
    };
    WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: SYSTEM, Name: 'System' } as UserInfo);
    engine.UserCanConfigureSpaces = async () => rights.configureSpaces;
    engine.UserCanConfigureSpaceTypes = () => rights.configureTypes;
    engine.EnsureLoaded = async () => undefined;
    engine.SpaceTypeById = ((id: string) => tables['MJ_BizApps_Collaboration: Space Types'].find((t) => String(t['ID']).toLowerCase() === id.toLowerCase())) as unknown as typeof engine.SpaceTypeById;
});
after(() => {
    const engine = CollaborationEngine.Instance;
    WellKnownUserSource.Instance.GetSystemUser = held['system'] as typeof WellKnownUserSource.Instance.GetSystemUser;
    engine.UserCanConfigureSpaces = held['spaces'] as typeof engine.UserCanConfigureSpaces;
    engine.UserCanConfigureSpaceTypes = held['types'] as typeof engine.UserCanConfigureSpaceTypes;
    engine.EnsureLoaded = held['ensure'] as typeof engine.EnsureLoaded;
    engine.SpaceTypeById = held['typeById'] as typeof engine.SpaceTypeById;
});

describe('Space Anchors: the records a space is about', () => {
    const anchor = (who: UserInfo, over: Row = {}) => mockRow(SpaceAnchorEntityServer.prototype, who, { ID: null, SpaceID: SPACE, SpaceTypeID: null, EntityID: DEALS, RecordID: `ID|${DEAL_1}`, Role: 'primary', IsPrimary: true, Sequence: 0, ...over });
    const validate = (row: object) => SpaceAnchorEntityServer.prototype.ValidateAsync.call(row);

    it('accepts a primary anchor from someone with Configure Spaces, and stamps the space\'s type on it', async () => {
        rights.configureSpaces = true;
        const row = anchor(ada);
        const res = await validate(row);
        assert.equal(res.Success, true, errorOn(res));
        assert.equal(String((row as unknown as Row)['SpaceTypeID']).toUpperCase(), TYPE);
    });

    it('refuses an entity not in the database, a key the entity does not accept, a type that is not the space\'s, and a space that does not exist', async () => {
        assert.match(errorOn(await validate(anchor(ada, { EntityID: '11111111-1111-4111-8111-111111111111' })), 'EntityID'), /not in this database/);
        assert.match(errorOn(await validate(anchor(ada, { RecordID: 'ID|not-a-uuid' })), 'RecordID'), /is not a key of Sales: Deals/);
        assert.match(errorOn(await validate(anchor(ada, { SpaceTypeID: '22222222-2222-4222-8222-222222222222' })), 'SpaceTypeID'), /must be the space's type/);
        assert.match(errorOn(await validate(anchor(ada, { SpaceID: '33333333-3333-4333-8333-333333333333' })), 'SpaceID'), /does not exist/);
    });

    it('refuses a writer without Configure Spaces, unless the type\'s driver vouches for the row in process', async () => {
        rights.configureSpaces = false;
        try {
            assert.match(errorOn(await validate(anchor(ada)), 'SpaceID'), /Configure Spaces/);
            const vouched = anchor(ada);
            vouchAnchorWrite(vouched as never);
            try {
                assert.equal((await validate(vouched)).Success, true);
            } finally {
                releaseAnchorWrite(vouched as never);
            }
        } finally {
            rights.configureSpaces = true;
        }
    });

    it('refuses a second primary anchor on a space, and a primary anchor on a record another space of the type already holds, naming that space', async () => {
        assert.match(errorOn(await validate(anchor(ada, { SpaceID: OTHER_SPACE })), 'IsPrimary'), /Harbor already has a primary anchor/);
        assert.match(errorOn(await validate(anchor(ada, { RecordID: `ID|${DEAL_2}` })), 'RecordID'), /Harbor of the same type is already anchored to this record/);
        // A second, non-primary anchor on the same record is fine: the deal's account, say
        assert.equal((await validate(anchor(ada, { RecordID: `ID|${DEAL_2}`, IsPrimary: false, Role: 'account' }))).Success, true);
    });

    it('needs a role on a non-primary anchor, and gives a primary one the role "primary"', async () => {
        assert.match(errorOn(await validate(anchor(ada, { IsPrimary: false, Role: '' })), 'Role'), /names its role/);
        const row = anchor(ada, { Role: '' });
        assert.equal((await validate(row)).Success, true);
        assert.equal((row as unknown as Row)['Role'], 'primary');
    });
});

describe('Space Grants: what the app, a type or a space offers', () => {
    const grant = (who: UserInfo, over: Row = {}) => mockRow(SpaceGrantEntityServer.prototype, who, { ID: null, SpaceTypeID: null, SpaceID: SPACE, Kind: 'Agent', TargetEntityID: null, TargetRecordID: AGENT, Label: null, Band: 'Shared', IsDefault: false, Bindings: null, Settings: null, Mode: 'Extend', Sequence: 0, ...over });
    const validate = (row: object) => SpaceGrantEntityServer.prototype.ValidateAsync.call(row);

    it("accepts a space's agent grant from an owner with Configure Spaces, and stamps the kind's entity", async () => {
        const row = grant(ada);
        const res = await validate(row);
        assert.equal(res.Success, true, errorOn(res));
        assert.equal((row as unknown as Row)['TargetEntityID'], AGENTS);
    });

    it('refuses a kind that is not one of the seven, a row that is both a type\'s and a space\'s, and a default that is not an agent', async () => {
        assert.match(errorOn(await validate(grant(ada, { Kind: 'Widget' })), 'Kind'), /not a kind of grant/);
        assert.match(errorOn(await validate(grant(ada, { SpaceTypeID: TYPE })), 'SpaceID'), /not a type's and a space's/);
        assert.match(errorOn(await validate(grant(ada, { Kind: 'Query', TargetRecordID: QUERY, IsDefault: true })), 'IsDefault'), /only an agent can be the default/);
    });

    it("refuses a target entity that is not the kind's, and a target that does not exist", async () => {
        assert.match(errorOn(await validate(grant(ada, { TargetEntityID: DEALS })), 'TargetEntityID'), /lives in MJ: AI Agents/);
        assert.match(errorOn(await validate(grant(ada, { TargetRecordID: '44444444-4444-4444-8444-444444444444' })), 'TargetRecordID'), /no MJ: AI Agents row has id/);
    });

    it("holds § 4's rules: a query goes only to a type that seats staff only (absent fails closed), a view with a binding nowhere", async () => {
        assert.match(errorOn(await validate(grant(ada, { Kind: 'Query', TargetRecordID: QUERY })), 'Kind'), /seats staff only/);
        tables['MJ_BizApps_Collaboration: Space Types'][0]['Configuration'] = JSON.stringify({ Seats: { Audience: 'StaffOnly' } });
        try {
            const ok = await validate(grant(ada, { Kind: 'Query', TargetRecordID: QUERY, Bindings: JSON.stringify({ AccountID: { From: 'Anchor:account' } }) }));
            assert.equal(ok.Success, true, errorOn(ok));
            assert.match(errorOn(await validate(grant(ada, { Kind: 'Query', TargetRecordID: QUERY, Bindings: JSON.stringify({ Nope: { Value: 1 } }) })), 'Bindings'), /names nothing the target has/);
            assert.match(errorOn(await validate(grant(ada, { Kind: 'Query', TargetRecordID: QUERY, Settings: '{}' })), 'Settings'), /only an agent grant carries settings/);
        } finally {
            tables['MJ_BizApps_Collaboration: Space Types'][0]['Configuration'] = null;
        }
    });

    it("keeps an agent's settings inside its definition: skills for an agent that accepts none, a limit above its own", async () => {
        assert.match(errorOn(await validate(grant(ada, { Settings: JSON.stringify({ Skills: ['55555555-5555-4555-8555-555555555555'] }) })), 'Settings'), /accepts none/);
        assert.match(errorOn(await validate(grant(ada, { Settings: JSON.stringify({ Limits: { MaxCostPerRun: 50 } }) })), 'Settings'), /above the agent's own/);
        assert.equal((await validate(grant(ada, { Settings: JSON.stringify({ Limits: { MaxCostPerRun: 2 }, MemoryWrites: false }) }))).Success, true);
    });

    it("asks for Configure Spaces on a space's row and Configure Space Types on the app's or a type's", async () => {
        rights.configureSpaces = false;
        rights.configureTypes = false;
        try {
            assert.match(errorOn(await validate(grant(ada)), 'SpaceID'), /Configure Spaces/);
            assert.match(errorOn(await validate(grant(ada, { SpaceID: null })), 'SpaceTypeID'), /Configure Space Types/);
        } finally {
            rights.configureSpaces = true;
            rights.configureTypes = true;
        }
        assert.equal((await validate(grant(ada, { SpaceID: null, SpaceTypeID: TYPE }))).Success, true);
    });
});

describe('Space Notes: light notes in the space', () => {
    const note = (who: UserInfo, over: Row = {}, options: Parameters<typeof mockRow>[3] = {}) => mockRow(SpaceNoteEntityServer.prototype, who, { ID: null, SpaceID: SPACE, Title: 'Agenda', Body: null, Band: 'Team', Visibility: 'Space', AuthorUserID: null, ...over }, options);
    const validate = (row: object) => SpaceNoteEntityServer.prototype.ValidateAsync.call(row);

    it('stamps the caller as the author on create, and refuses another author', async () => {
        const row = note(ada);
        assert.equal((await validate(row)).Success, true);
        assert.equal((row as unknown as Row)['AuthorUserID'], ADA.toLowerCase());
        assert.match(errorOn(await validate(note(ada, { AuthorUserID: BEA })), 'AuthorUserID'), /written as its author/);
    });

    it("refuses a Team note from a seat that can't see Team, and anything from someone who does not reach the space", async () => {
        assert.match(errorOn(await validate(note(guest)), 'Band'), /can't write a Team note/);
        assert.equal((await validate(note(guest, { Band: 'Shared' }))).Success, true);
        assert.match(errorOn(await validate(note(bea)), 'SpaceID'), /does not reach this space/);
    });

    it('refuses a note in a space whose status is read-only (here a closed space of a type with no statuses)', async () => {
        assert.match(errorOn(await validate(note(ada, { SpaceID: CLOSED_SPACE })), 'SpaceID'), /read-only in its current status/);
    });

    it("lets only the author edit: a Team note doesn't move to Shared (call 15), Shared narrows to Team, and the space stays", async () => {
        const mine = (over: Row, old: Row, dirty: string[]) => note(ada, { ID: NOTE_1, AuthorUserID: ADA, ...over }, { saved: true, old, dirty });
        assert.equal((await validate(mine({ Title: 'Agenda, revised' }, { Title: 'Agenda' }, ['Title']))).Success, true);
        assert.match(errorOn(await validate(mine({ Band: 'Shared' }, { Band: 'Team' }, ['Band'])), 'Band'), /doesn't move to Shared/);
        assert.equal((await validate(mine({ Band: 'Team' }, { Band: 'Shared' }, ['Band']))).Success, true);
        assert.match(errorOn(await validate(mine({ SpaceID: OTHER_SPACE }, { SpaceID: SPACE }, ['SpaceID'])), 'SpaceID'), /stays in its space/);
        const someoneElse = note(bea, { ID: NOTE_1, AuthorUserID: ADA, Title: 'Theirs' }, { saved: true, old: { Title: 'Agenda' }, dirty: ['Title'] });
        assert.match(errorOn(await validate(someoneElse), 'AuthorUserID'), /only the author edits/);
        const notMine = note(bea, { ID: NOTE_1, AuthorUserID: ADA });
        assert.equal(await SpaceNoteEntityServer.prototype.Delete.call(notMine), false);
    });
});

describe('Space Member Pins: what a member keeps at the top of a space', () => {
    const pin = (who: UserInfo, over: Row = {}) => mockRow(SpaceMemberPinEntityServer.prototype, who, { ID: null, SpaceID: SPACE, UserID: null, Kind: 'Record', TargetEntityID: DEALS, TargetRecordID: `ID|${DEAL_1}`, GrantID: null, Sequence: 0, ...over });
    const validate = (row: object) => SpaceMemberPinEntityServer.prototype.ValidateAsync.call(row);

    it("is the caller's own: it stamps the caller, refuses another user, and refuses someone who does not reach the space", async () => {
        const row = pin(ada);
        assert.equal((await validate(row)).Success, true, errorOn(await validate(pin(ada))));
        assert.equal((row as unknown as Row)['UserID'], ADA.toLowerCase());
        assert.match(errorOn(await validate(pin(ada, { UserID: BEA })), 'UserID'), /signed-in user's own/);
        assert.match(errorOn(await validate(pin(bea)), 'SpaceID'), /does not reach this space/);
    });

    it('pins a record only when it is in the space (an item of it, or one of its notes), and never a record with a grant', async () => {
        assert.match(errorOn(await validate(pin(ada, { TargetRecordID: `ID|${DEAL_2}` })), 'TargetRecordID'), /not in this space/);
        assert.equal((await validate(pin(ada, { TargetEntityID: NOTES_ENTITY, TargetRecordID: NOTE_1 }))).Success, true);
        assert.match(errorOn(await validate(pin(ada, { GrantID: APP_GRANT })), 'GrantID'), /names no grant/);
        assert.match(errorOn(await validate(pin(ada, { TargetRecordID: null })), 'TargetRecordID'), /names its target entity and record/);
    });

    it("pins a grant only when it is in force in the space: the app's yes, another space's no", async () => {
        assert.equal((await validate(pin(ada, { Kind: 'Grant', TargetEntityID: null, TargetRecordID: null, GrantID: APP_GRANT }))).Success, true);
        assert.match(errorOn(await validate(pin(ada, { Kind: 'Grant', TargetEntityID: null, TargetRecordID: null, GrantID: OTHER_GRANT })), 'GrantID'), /not in force in this space/);
        assert.match(errorOn(await validate(pin(ada, { Kind: 'Grant', GrantID: APP_GRANT })), 'TargetRecordID'), /names no record/);
    });

    it('is removed by its owner only', async () => {
        assert.equal(await SpaceMemberPinEntityServer.prototype.Delete.call(pin(bea, { UserID: ADA })), false);
    });
});

describe('Space Type Status: the statuses a type declares', () => {
    const status = (who: UserInfo, over: Row = {}, options: Parameters<typeof mockRow>[3] = {}) => mockRow(SpaceTypeStatusEntityServer.prototype, who, { ID: null, SpaceTypeID: TYPE, Code: 'closed', Name: 'Closed', Sequence: 3, IsDefault: false, ReadOnly: true, Visible: true, AgentRetrieval: true, CanChangeAfter: true, NotifyMembersOnEnter: true, IsTerminal: true, ...over }, options);
    const validate = (row: object) => SpaceTypeStatusEntityServer.prototype.ValidateAsync.call(row);

    it('accepts a status that keeps the type\'s list sound, from someone with Configure Space Types', async () => {
        const res = await validate(status(ada));
        assert.equal(res.Success, true, errorOn(res));
    });

    it('refuses a writer without Configure Space Types', async () => {
        rights.configureTypes = false;
        try {
            assert.match(errorOn(await validate(status(ada)), 'SpaceTypeID'), /Configure Space Types/);
        } finally {
            rights.configureTypes = true;
        }
    });

    it('refuses a list that is not sound: a second default, a repeated code or sequence, a frozen status that is not terminal', async () => {
        assert.match(errorOn(await validate(status(ada, { IsDefault: true })), 'Sequence'), /exactly one default status/);
        assert.match(errorOn(await validate(status(ada, { Code: 'paused' })), 'Sequence'), /used twice/);
        assert.match(errorOn(await validate(status(ada, { Sequence: 2 })), 'Sequence'), /Sequence 2 is used twice/);
        assert.match(errorOn(await validate(status(ada, { IsTerminal: false, CanChangeAfter: false })), 'Sequence'), /nothing could ever leave it/);
        // Editing a status judges the list with the edited row in place of the saved one
        const edited = status(ada, { ID: PAUSED, Code: 'paused', Name: 'On hold', Sequence: 2, IsTerminal: false }, { saved: true, dirty: ['Name'] });
        assert.equal((await validate(edited)).Success, true, errorOn(await validate(edited)));
    });

    it('refuses the delete of a status a space still names', async () => {
        tables['MJ_BizApps_Collaboration: Spaces'][0]['StatusID'] = PAUSED;
        try {
            const row = status(ada, { ID: PAUSED, Code: 'paused', Name: 'Paused', Sequence: 2, IsTerminal: false }, { saved: true, dirty: [] });
            assert.equal(await SpaceTypeStatusEntityServer.prototype.Delete.call(row), false);
            const history = (row as unknown as { _resultHistory: Array<{ Message: string }> })._resultHistory;
            assert.match(history[history.length - 1]?.Message ?? '', /a space is Paused/);
        } finally {
            tables['MJ_BizApps_Collaboration: Spaces'][0]['StatusID'] = null;
        }
    });
});
