import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IMetadataProvider, IRunQueryProvider, UserInfo } from '@memberjunction/core';
import { resolveHomeCounts } from '../dist/resolve-home-counts.js';

const user = { ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE5', Name: 'Ada' } as unknown as UserInfo;

/** A provider whose query run answers as told, and records what it was asked and for whom. */
function providerAnswering(result: object) {
    const asked: Array<{ params: { QueryName?: string; CategoryPath?: string; Parameters?: unknown }; who?: string }> = [];
    const provider = {
        async RunQuery(params: { QueryName?: string; CategoryPath?: string; Parameters?: unknown }, who?: UserInfo) {
            asked.push({ params, who: who?.ID });
            return result;
        },
    } as unknown as IMetadataProvider & IRunQueryProvider;
    return { provider, asked };
}

describe("Home's counts", () => {
    it('runs the approved query for the signed-in person, with their own id, and returns the three counts as numbers', async () => {
        const { provider, asked } = providerAnswering({ Success: true, Results: [{ SharedFiles: '4', OpenTasks: 7, AwaitingApproval: 2 }] });
        assert.deepEqual(await resolveHomeCounts(provider, user), { sharedFiles: 4, openTasks: 7, awaitingApproval: 2 });
        assert.equal(asked.length, 1);
        assert.equal(asked[0].params.QueryName, 'Collaboration Home Counts');
        assert.equal(asked[0].who, user.ID);
        assert.deepEqual(asked[0].params.Parameters, { UserID: user.ID }, "the acting user's own id, set on the server: no caller says whose counts they are");
    });

    it('says why when the query fails, and when it returns no row', async () => {
        await assert.rejects(resolveHomeCounts(providerAnswering({ Success: false, ErrorMessage: 'the query is not approved' }).provider, user), /the query is not approved/);
        await assert.rejects(resolveHomeCounts(providerAnswering({ Success: true, Results: [] }).provider, user), /no row/);
    });
});
