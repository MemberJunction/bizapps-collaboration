import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { IMetadataProvider, IRunViewProvider, RunViewParams, RunViewResult, UserInfo } from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { loadSpaceConfiguration } from '../dist/space-configuration.js';
import { seedAppSettings } from './app-settings.test-support.ts';

const CHILD_ID = '11111111-1111-4111-8111-111111111111';
const PARENT_ID = '22222222-2222-4222-8222-222222222222';
const TYPE_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_TYPE_ID = '44444444-4444-4444-8444-444444444444';
const ACTION_ID = '55555555-5555-4555-8555-555555555555';
const GONE_ACTION_ID = '66666666-6666-4666-8666-666666666666';
const system = { ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as Partial<UserInfo> as UserInfo;

interface SpaceRow { ID: string; ParentID: string | null; SpaceTypeID: string | null; Configuration: string | null }
interface GrantRow { ID: string; SpaceID: string | null; SpaceTypeID: string | null; Kind: string; Mode: string; TargetEntityID: string; TargetRecordID: string; Band: string; IsDefault: boolean; Sequence: number; Bindings?: string | null; Settings?: string | null }

const TYPES = [
    { ID: TYPE_ID, Code: 'workspace', Configuration: JSON.stringify({ SpaceOverridable: ['Chats.WhoCanStart'] }) },
    { ID: OTHER_TYPE_ID, Code: 'team', Configuration: null },
];

/** One provider for the suite, whose reads answer from `state`; each test sets the state and reloads the engine from it. */
interface MockState { spaces: readonly SpaceRow[]; failRead?: boolean; grants?: GrantRow[]; types?: typeof TYPES }
const state: MockState = { spaces: [] };
const runView = async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
    const ok = (rows: object[]): RunViewResult<T> => ({ Success: true, Results: rows as unknown as T[], RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0, ErrorMessage: '' });
    const filter = String(params.ExtraFilter ?? '');
    if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') return ok(state.types ?? TYPES);
    if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
        if (state.failRead) return { Success: false, ErrorMessage: 'the read failed', Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 0 };
        const wanted = /'([0-9a-f-]{36})'/i.exec(filter)?.[1]?.toLowerCase();
        return ok(state.spaces.filter((row) => row.ID.toLowerCase() === wanted));
    }
    if (params.EntityName === 'MJ_BizApps_Collaboration: Space Grants') {
        const ids = [...filter.matchAll(/'([0-9a-f-]{36})'/gi)].map((m) => m[1].toLowerCase());
        const rows = state.grants ?? [];
        // The engine reads the app's and the types' rows (SpaceID IS NULL); the loader reads the chain's rows by SpaceID
        if (filter.includes('SpaceID IS NULL')) return ok(rows.filter((row) => !row.SpaceID));
        return ok(rows.filter((row) => row.SpaceID && ids.includes(row.SpaceID.toLowerCase())));
    }
    if (params.EntityName === 'MJ: Actions') {
        const ids = [...filter.matchAll(/'([0-9a-f-]{36})'/gi)].map((m) => m[1]);
        return ok(ids.filter((id) => id.toLowerCase() !== GONE_ACTION_ID.toLowerCase()).map((ID) => ({ ID })));
    }
    return ok([]);
};
const provider = {
    RunView: runView,
    RunViews: async (list: RunViewParams[]) => Promise.all(list.map((p) => runView(p))),
} as unknown as IMetadataProvider & IRunViewProvider;

/** Sets the world and reloads the engine from it. */
async function world(spaces: readonly SpaceRow[], options: Omit<MockState, 'spaces'> = {}): Promise<IMetadataProvider> {
    state.spaces = spaces;
    state.failRead = options.failRead;
    state.grants = options.grants;
    state.types = options.types;
    await CollaborationEngine.Instance.Config(true, undefined, provider);
    return provider;
}

const grant = (partial: Partial<GrantRow> & { ID: string; TargetRecordID: string }): GrantRow => ({
    SpaceID: null, SpaceTypeID: null, Kind: 'Action', Mode: 'Extend', TargetEntityID: 'E-ACTIONS', Band: 'Shared', IsDefault: false, Sequence: 0, ...partial,
});

describe('loadSpaceConfiguration', () => {
    let restoreAppSettings: () => void;
    before(() => { restoreAppSettings = seedAppSettings(); });
    after(() => restoreAppSettings());

    const goodChain: SpaceRow[] = [
        { ID: CHILD_ID, ParentID: PARENT_ID, SpaceTypeID: TYPE_ID, Configuration: null },
        { ID: PARENT_ID, ParentID: null, SpaceTypeID: TYPE_ID, Configuration: JSON.stringify({ Chats: { WhoCanStart: 'Owners' } }) },
    ];

    it('reads the chain nearest first, the type and the grants, and resolves them through the one resolver', async () => {
        const grants = [
            grant({ ID: 'g-type', TargetRecordID: ACTION_ID, SpaceTypeID: TYPE_ID }),
            grant({ ID: 'g-parent-removes', TargetRecordID: ACTION_ID, SpaceID: PARENT_ID, Mode: 'Remove' }),
            grant({ ID: 'g-child', TargetRecordID: '77777777-7777-4777-8777-777777777777', SpaceID: CHILD_ID, Band: 'Team' }),
        ];
        const provider = await world(goodChain, { grants });
        const loaded = await loadSpaceConfiguration(provider, CHILD_ID, { reader: system });
        assert.deepEqual(loaded.chain.map((row) => row.ID), [CHILD_ID, PARENT_ID]);
        assert.equal(loaded.type?.ID, TYPE_ID);
        assert.equal(loaded.configuration.Settings.Chats.WhoCanStart, 'Owners', "the same-type parent's override reaches the child");
        assert.deepEqual(loaded.configuration.Grants.Action.map((g) => g.GrantID), ['g-child'], "the parent's Remove dropped the type's grant for its subtree");
        assert.deepEqual(loaded.configuration.Chain.map((link) => link.LevelID), [null, TYPE_ID, PARENT_ID, CHILD_ID]);
    });

    it('a save hands its own row in as the leaf: the walk starts at its parent, and a row not written yet has no grants', async () => {
        const provider = await world(goodChain);
        const leaf = { ID: '', ParentID: PARENT_ID, SpaceTypeID: TYPE_ID, Configuration: JSON.stringify({ Chats: { WhoCanStart: 'Anyone' } }) };
        const loaded = await loadSpaceConfiguration(provider, '', { reader: system, leaf });
        assert.deepEqual(loaded.chain.map((row) => row.ID), ['', PARENT_ID]);
        assert.equal(loaded.configuration.Settings.Chats.WhoCanStart, 'Anyone', 'the leaf as the save holds it wins over its parent');
    });

    it('leaves out a grant whose target is gone, with a log, and keeps the rest', async () => {
        const logs: string[] = [];
        const provider = await world(goodChain, { grants: [grant({ ID: 'gone', TargetRecordID: GONE_ACTION_ID, SpaceTypeID: TYPE_ID }), grant({ ID: 'kept', TargetRecordID: ACTION_ID, SpaceTypeID: TYPE_ID })] });
        const loaded = await loadSpaceConfiguration(provider, CHILD_ID, { reader: system, log: (m) => logs.push(m) });
        assert.deepEqual(loaded.configuration.Grants.Action.map((g) => g.GrantID), ['kept']);
        assert.equal(logs.filter((m) => m.includes('gone') && m.includes('target is gone')).length, 1);
    });

    it("refuses when an ancestor's configuration does not parse", async () => {
        const rows = [goodChain[0], { ...goodChain[1], Configuration: '{ not json' }];
        const provider = await world(rows);
        await assert.rejects(loadSpaceConfiguration(provider, CHILD_ID, { reader: system }), /Space settings refused: space 22222222-2222-4222-8222-222222222222 has a configuration that does not parse/);
    });

    it('refuses a link that breaks its own type\'s rules, judged under that type', async () => {
        const rows = [goodChain[0], { ...goodChain[1], SpaceTypeID: OTHER_TYPE_ID, Configuration: JSON.stringify({ Chats: { WhoCanStart: 'Owners' } }) }];
        const provider = await world(rows);
        await assert.rejects(loadSpaceConfiguration(provider, CHILD_ID, { reader: system }), /Space settings refused: space 22222222-2222-4222-8222-222222222222 has an invalid configuration/);
    });

    it('refuses when an ancestor cannot be found, when a read fails, and when a space id is not a UUID', async () => {
        const missing = await world([goodChain[0]]);
        await assert.rejects(loadSpaceConfiguration(missing, CHILD_ID, { reader: system }), /Space settings refused: space 22222222-2222-4222-8222-222222222222 was not found/);
        const failing = await world(goodChain, { failRead: true });
        await assert.rejects(loadSpaceConfiguration(failing, CHILD_ID, { reader: system }), /Space settings refused: space 11111111-1111-4111-8111-111111111111 could not be read: the read failed/);
        await assert.rejects(loadSpaceConfiguration(await world(goodChain), "x'; DROP TABLE Space; --", { reader: system }), /is not a valid space id/);
    });

    it('refuses a type the engine does not hold', async () => {
        const rows = [{ ...goodChain[0], SpaceTypeID: '99999999-9999-4999-8999-999999999999' }, goodChain[1]];
        const provider = await world(rows);
        await assert.rejects(loadSpaceConfiguration(provider, CHILD_ID, { reader: system }), /Space settings refused: the space type 99999999-9999-4999-8999-999999999999 could not be read/);
    });
});
