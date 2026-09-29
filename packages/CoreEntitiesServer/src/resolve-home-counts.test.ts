import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type IMetadataProvider, type IRunQueryProvider, type UserInfo } from '@memberjunction/core';
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

const SYSTEM = '00000000-0000-0000-0000-000000000000';

describe("Home's counts", () => {
    const held = WellKnownUserSource.Instance.GetSystemUser;
    before(() => { WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: SYSTEM, Name: 'System' }) as UserInfo; });
    after(() => { WellKnownUserSource.Instance.GetSystemUser = held; });

    it('runs the approved query as the system user with the signed-in person\'s own id and no other, and returns the three counts as numbers', async () => {
        const { provider, asked } = providerAnswering({ Success: true, Results: [{ SharedFiles: '4', OpenTasks: 7, AwaitingApproval: 2 }] });
        assert.deepEqual(await resolveHomeCounts(provider, user), { sharedFiles: 4, openTasks: 7, awaitingApproval: 2 });
        assert.equal(asked.length, 1);
        assert.equal(asked[0].params.QueryName, 'Collaboration Home Counts');
        assert.equal(asked[0].who, SYSTEM, 'run as the system user: the query is for the Integration role only');
        assert.deepEqual(asked[0].params.Parameters, { UserID: user.ID }, "the acting user's own id, set on the server: no caller says whose counts they are");
    });

    it('says why when the query fails, and when it returns no row', async () => {
        await assert.rejects(resolveHomeCounts(providerAnswering({ Success: false, ErrorMessage: 'the query is not approved' }).provider, user), /the query is not approved/);
        await assert.rejects(resolveHomeCounts(providerAnswering({ Success: true, Results: [] }).provider, user), /no row/);
    });
});
