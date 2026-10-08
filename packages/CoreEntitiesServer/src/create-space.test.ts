import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { EntityFieldTSType, WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import { createSpace as create } from '../dist/create-space.js';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';

const USER = { ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE9', Name: 'Ada' } as UserInfo;
const TYPE_ID = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE1';
const SPACE_ID = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE2';
const OWNER_ROLE = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE3';

interface Setup { spaceSaves?: boolean; seatSaves?: boolean; hasSubtype?: boolean; type?: object | undefined; ownerRole?: object | undefined }

/** A provider that hands out a space (with its subtype, if asked) and a seat, and records the transaction and what was written. */
function providerFor(setup: Setup) {
    const log: string[] = [];
    const set: Record<string, unknown> = {};
    const seat: Record<string, unknown> = {
        NewRecord: () => undefined,
        Save: async () => { log.push('seat save'); return setup.seatSaves ?? true; },
        LatestResult: { CompleteMessage: 'seat refused' },
    };
    const leaf = {
        EntityInfo: {
            Fields: [
                { Name: 'ID', DisplayNameOrName: 'ID', IsPrimaryKey: true, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: false, DefaultValue: null, Sequence: 1, TSType: 'string' },
                { Name: 'Name', DisplayNameOrName: 'Name', IsPrimaryKey: false, IsVirtual: true, AllowUpdateAPI: true, AllowsNull: false, DefaultValue: null, Sequence: 2, TSType: 'string' },
                { Name: 'TermName', DisplayNameOrName: 'Term', IsPrimaryKey: false, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: false, DefaultValue: null, Sequence: 3, TSType: 'string' },
                { Name: 'NextMeeting', DisplayNameOrName: 'Next meeting', IsPrimaryKey: false, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: true, DefaultValue: null, Sequence: 4, TSType: EntityFieldTSType.Date },
            ],
            ParentEntityFieldNames: new Set(['Name', 'Description']),
            Name: 'Example Boards',
        },
        Set: (name: string, value: unknown) => { set[name] = value; },
        Save: async () => { log.push('space save'); return setup.spaceSaves ?? true; },
        LatestResult: { CompleteMessage: 'A board may not sit here.' },
    };
    const space: Record<string, unknown> = {
        ID: SPACE_ID,
        NewRecord: () => undefined,
        EnsureISAChild: async () => (setup.hasSubtype ? leaf : null),
        Save: async () => { log.push('space save'); return setup.spaceSaves ?? true; },
        LatestResult: { CompleteMessage: 'A board may not sit here.' },
    };
    space['LeafEntity'] = setup.hasSubtype ? leaf : space;
    const provider = {
        GetEntityObject: async (name: string) => (name.endsWith('Spaces') ? space : seat),
        BeginTransaction: async () => { log.push('begin'); },
        CommitTransaction: async () => { log.push('commit'); },
        RollbackTransaction: async () => { log.push('rollback'); },
    };
    return { provider, log, space, seat, set };
}

/** The fake provider stands in for the SQL provider: the operation needs only what the fake has. */
const createSpace = (provider: object, user: UserInfo, input: Parameters<typeof create>[2]) => create(provider as Parameters<typeof create>[0], user, input);

describe('making a space and its owner seat', () => {
    let heldSystem: typeof WellKnownUserSource.Instance.GetSystemUser;
    const engine = CollaborationEngine.Instance;
    let held: { config: typeof engine.Config; type: typeof engine.SpaceTypeById; role: typeof engine.SpaceRoleTypeByCode };
    let type: object | undefined;
    let ownerRole: object | undefined;

    before(() => {
        heldSystem = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as UserInfo);
        held = { config: engine.Config.bind(engine), type: engine.SpaceTypeById.bind(engine), role: engine.SpaceRoleTypeByCode.bind(engine) };
        engine.Config = (async () => undefined) as unknown as typeof engine.Config;
        engine.SpaceTypeById = ((id: string) => (id.toLowerCase() === TYPE_ID.toLowerCase() ? type : undefined)) as unknown as typeof engine.SpaceTypeById;
        engine.SpaceRoleTypeByCode = ((code: string) => (code === 'owner' ? ownerRole : undefined)) as unknown as typeof engine.SpaceRoleTypeByCode;
    });
    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = heldSystem;
        engine.Config = held.config;
        engine.SpaceTypeById = held.type;
        engine.SpaceRoleTypeByCode = held.role;
    });
    const usual = () => { type = { ID: TYPE_ID, Name: 'Board', IsActive: true }; ownerRole = { ID: OWNER_ROLE }; };

    it('writes the space and the seat in one transaction, seating the person as an active owner on the Team band', async () => {
        usual();
        const { provider, log, space, seat } = providerFor({ hasSubtype: true });
        // D22: the creator chooses whether the space inherits its parent's members; a top-level space says so itself
        const result = await createSpace(provider, USER, { TypeID: TYPE_ID, Name: '  2026 Board ', Description: ' the board ', InheritsMembership: false, Details: { TermName: '2026' } });
        assert.deepEqual(result, { status: 'created', spaceId: SPACE_ID });
        assert.deepEqual(log, ['begin', 'space save', 'seat save', 'commit']);
        assert.deepEqual([space['Name'], space['Description'], space['OwnerID'], space['SpaceTypeID'], space['InheritsMembership']], ['2026 Board', 'the board', USER.ID, TYPE_ID, false]);
        assert.deepEqual([seat['SpaceID'], seat['UserID'], seat['SpaceRoleTypeID'], seat['Band'], seat['Status']], [SPACE_ID, USER.ID, OWNER_ROLE, 'Team', 'Active']);
    });

    it('puts a sub-space under its parent with the inheritance the creator chose, and refuses a parent id that is not one', async () => {
        usual();
        const PARENT = 'C0000000-0000-4000-8000-00000000000A';
        const { provider, space } = providerFor({ hasSubtype: false });
        const result = await createSpace(provider, USER, { TypeID: TYPE_ID, Name: 'Discovery', ParentID: PARENT, InheritsMembership: true });
        assert.deepEqual(result, { status: 'created', spaceId: SPACE_ID });
        assert.deepEqual([space['ParentID'], space['InheritsMembership']], [PARENT, true]);
        const bad = await createSpace(providerFor({ hasSubtype: false }).provider, USER, { TypeID: TYPE_ID, Name: 'Discovery', ParentID: 'not-an-id' });
        assert.deepEqual(bad, { status: 'refused', message: 'The parent space id is not valid.' });
    });

    it("sets the subtype's own columns, turning a date's text into a date", async () => {
        usual();
        const { provider, set } = providerFor({ hasSubtype: true });
        await createSpace(provider, USER, { TypeID: TYPE_ID, Name: 'B', Details: { TermName: '2026', NextMeeting: '2026-10-02T00:00:00.000Z' } });
        assert.equal(set['TermName'], '2026');
        assert.ok(set['NextMeeting'] instanceof Date && set['NextMeeting'].toISOString() === '2026-10-02T00:00:00.000Z');
    });

    it("refuses a detail the subtype doesn't add (the space's own columns, the key, an unknown name), before anything is written", async () => {
        usual();
        for (const field of ['Name', 'ID', 'Nonsense', '__mj_CreatedAt']) {
            const { provider, log } = providerFor({ hasSubtype: true });
            const result = await createSpace(provider, USER, { TypeID: TYPE_ID, Name: 'B', Details: { [field]: 'x' } });
            assert.equal(result.status, 'refused');
            assert.deepEqual(log, [], `${field}: nothing was started`);
        }
        const plain = providerFor({ hasSubtype: false });
        assert.equal((await createSpace(plain.provider, USER, { TypeID: TYPE_ID, Name: 'B', Details: { TermName: 'x' } })).status, 'refused');
    });

    it("rolls back, and never seats anyone, when the space is refused, and says the space's words", async () => {
        usual();
        const { provider, log } = providerFor({ hasSubtype: true, spaceSaves: false });
        assert.deepEqual(await createSpace(provider, USER, { TypeID: TYPE_ID, Name: 'B' }), { status: 'refused', message: 'A board may not sit here.' });
        assert.deepEqual(log, ['begin', 'space save', 'rollback']);
    });

    it('rolls back the space when the seat is refused, so no space is left that nobody is seated on', async () => {
        usual();
        const { provider, log } = providerFor({ hasSubtype: false, seatSaves: false });
        const result = await createSpace(provider, USER, { TypeID: TYPE_ID, Name: 'B' });
        assert.deepEqual(result, { status: 'refused', message: "You could not be seated as the space's owner: seat refused" });
        assert.deepEqual(log, ['begin', 'space save', 'seat save', 'rollback']);
    });

    it('refuses a bad type, an inactive type, an empty name and a missing owner role, without starting anything', async () => {
        usual();
        const started = providerFor({});
        assert.equal((await createSpace(started.provider, USER, { TypeID: 'nope', Name: 'B' })).status, 'refused');
        assert.equal((await createSpace(started.provider, USER, { TypeID: TYPE_ID, Name: '   ' })).status, 'refused');
        type = { ID: TYPE_ID, Name: 'Board', IsActive: false, DefaultInheritsMembership: false };
        assert.match((await createSpace(started.provider, USER, { TypeID: TYPE_ID, Name: 'B' }) as { message: string }).message, /not available/);
        usual();
        ownerRole = undefined;
        assert.match((await createSpace(started.provider, USER, { TypeID: TYPE_ID, Name: 'B' }) as { message: string }).message, /owner role/);
        assert.deepEqual(started.log, []);
    });
});
