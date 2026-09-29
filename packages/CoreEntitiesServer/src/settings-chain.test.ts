import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IMetadataProvider, IRunViewProvider, RunViewParams, RunViewResult, UserInfo } from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';

const CHILD_ID = '11111111-1111-4111-8111-111111111111';
const PARENT_ID = '22222222-2222-4222-8222-222222222222';
const TYPE_ID = '33333333-3333-4333-8333-333333333333';
const system = { ID: '00000000-0000-0000-0000-000000000000', Name: 'System' } as Partial<UserInfo> as UserInfo;

interface SpaceRow {
    ID: string;
    ParentID: string | null;
    SpaceTypeID: string | null;
    Configuration: string | null;
}

/** A provider whose Spaces read answers from `rows`, or fails when `failRead` is set. */
function providerOver(rows: readonly SpaceRow[], failRead = false): IMetadataProvider {
    const runView = async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
        if (failRead) {
            return { Success: false, ErrorMessage: 'the read failed', Results: [], RowCount: 0, TotalRowCount: 0, ExecutionTime: 0 };
        }
        const wanted = /'([0-9a-f-]{36})'/i.exec(String(params.ExtraFilter))?.[1]?.toLowerCase();
        const found = rows.filter((row) => row.ID.toLowerCase() === wanted);
        return { Success: true, Results: found as unknown as T[], RowCount: found.length, TotalRowCount: found.length, ExecutionTime: 0, ErrorMessage: '' };
    };
    const provider: Partial<IMetadataProvider & IRunViewProvider> = { RunView: runView };
    return provider as IMetadataProvider;
}

describe('LoadSpaceSettingsChain fails closed', () => {
    const goodChain: SpaceRow[] = [
        { ID: CHILD_ID, ParentID: PARENT_ID, SpaceTypeID: TYPE_ID, Configuration: JSON.stringify({ Chats: { WhoCanStart: 'Owners' } }) },
        { ID: PARENT_ID, ParentID: null, SpaceTypeID: TYPE_ID, Configuration: null },
    ];

    it('returns every configuration, leaf to root, when the chain reads completely', async () => {
        const chain = await CollaborationEngine.Instance.LoadSpaceSettingsChain(CHILD_ID, providerOver(goodChain), system);
        assert.equal(chain.configs.length, 2);
        assert.deepEqual(chain.configs[0], { Chats: { WhoCanStart: 'Owners' } });
        assert.equal(chain.typeId, TYPE_ID);
    });

    it("refuses when an ancestor's configuration does not parse", async () => {
        const rows = [goodChain[0], { ...goodChain[1], Configuration: '{ not json' }];
        await assert.rejects(
            CollaborationEngine.Instance.LoadSpaceSettingsChain(CHILD_ID, providerOver(rows), system),
            /Space settings refused: space 22222222-2222-4222-8222-222222222222 has a configuration that does not parse/,
        );
    });

    it('refuses when an ancestor cannot be found', async () => {
        await assert.rejects(
            CollaborationEngine.Instance.LoadSpaceSettingsChain(CHILD_ID, providerOver([goodChain[0]]), system),
            /Space settings refused: space 22222222-2222-4222-8222-222222222222 was not found/,
        );
    });

    it('refuses when a read fails', async () => {
        await assert.rejects(
            CollaborationEngine.Instance.LoadSpaceSettingsChain(CHILD_ID, providerOver(goodChain, true), system),
            /Space settings refused: space 11111111-1111-4111-8111-111111111111 could not be read: the read failed/,
        );
    });

    it('refuses a space id that is not a UUID', async () => {
        await assert.rejects(
            CollaborationEngine.Instance.LoadSpaceSettingsChain("x'; DROP TABLE Space; --", providerOver(goodChain), system),
            /is not a valid space id/,
        );
    });
});
