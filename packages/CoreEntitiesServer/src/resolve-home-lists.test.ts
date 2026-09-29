import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type IMetadataProvider, type IRunQueryProvider, type UserInfo } from '@memberjunction/core';
import { resolveHomeLists } from '../dist/resolve-home-lists.js';

const user = { ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE5', Name: 'Ada' } as unknown as UserInfo;
const SYSTEM = '00000000-0000-0000-0000-000000000000';

/** A provider that answers each named query as told, and records who each was run for. */
function providerAnswering(answers: Record<string, object>) {
    const asked: Array<{ query?: string; parameters?: unknown; who?: string }> = [];
    const provider = {
        async RunQuery(params: { QueryName?: string; Parameters?: unknown }, who?: UserInfo) {
            asked.push({ query: params.QueryName, parameters: params.Parameters, who: who?.ID });
            return answers[params.QueryName ?? ''] ?? { Success: false, ErrorMessage: 'no such query' };
        },
    } as unknown as IMetadataProvider & IRunQueryProvider;
    return { provider, asked };
}

const seat = { SeatID: 's1', SpaceID: 'sp1', SpaceName: 'Northwind', Person: 'Bea', RoleName: 'Contributor', InvitedAt: '2026-09-28T10:00:00.000Z' };
const task = { TaskID: 't1', TaskName: 'Send the deck', Status: 'InProgress', Priority: 'High', DueAt: new Date('2026-10-02T00:00:00.000Z'), SpaceID: 'sp1', SpaceName: 'Northwind' };

describe("Home's lists", () => {
    const held = WellKnownUserSource.Instance.GetSystemUser;
    before(() => { WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: SYSTEM, Name: 'System' }) as UserInfo; });
    after(() => { WellKnownUserSource.Instance.GetSystemUser = held; });

    it("runs both approved queries as the system user with the signed-in person's own id, and shapes the rows", async () => {
        const { provider, asked } = providerAnswering({
            'Collaboration Home Invitations': { Success: true, Results: [seat] },
            'Collaboration Home Open Tasks': { Success: true, Results: [task] },
        });
        const lists = await resolveHomeLists(provider, user);
        assert.deepEqual(asked.map((a) => a.query).sort(), ['Collaboration Home Invitations', 'Collaboration Home Open Tasks']);
        for (const a of asked) {
            assert.equal(a.who, SYSTEM);
            assert.deepEqual(a.parameters, { UserID: user.ID });
        }
        assert.deepEqual(lists.invitations, [{ seatId: 's1', spaceId: 'sp1', spaceName: 'Northwind', person: 'Bea', roleName: 'Contributor', invitedAt: '2026-09-28T10:00:00.000Z' }]);
        assert.deepEqual(lists.openTasks, [{ taskId: 't1', name: 'Send the deck', status: 'InProgress', priority: 'High', dueAt: '2026-10-02T00:00:00.000Z', spaceId: 'sp1', spaceName: 'Northwind' }]);
    });

    it('gives an invitation with no name or role, and a task with no due date, without inventing anything', async () => {
        const { provider } = providerAnswering({
            'Collaboration Home Invitations': { Success: true, Results: [{ ...seat, Person: null, RoleName: null, InvitedAt: null }] },
            'Collaboration Home Open Tasks': { Success: true, Results: [{ ...task, DueAt: null, Priority: null }] },
        });
        const lists = await resolveHomeLists(provider, user);
        assert.equal(lists.invitations[0].person, 'Someone');
        assert.equal(lists.invitations[0].roleName, '');
        assert.equal(lists.invitations[0].invitedAt, null);
        assert.equal(lists.openTasks[0].dueAt, null);
        assert.equal(lists.openTasks[0].priority, null);
    });

    it('says which list could not be read', async () => {
        await assert.rejects(
            resolveHomeLists(providerAnswering({ 'Collaboration Home Invitations': { Success: false, ErrorMessage: 'not approved' }, 'Collaboration Home Open Tasks': { Success: true, Results: [] } }).provider, user),
            /Home's invitations could not be read: not approved/,
        );
        await assert.rejects(
            resolveHomeLists(providerAnswering({ 'Collaboration Home Invitations': { Success: true, Results: [] }, 'Collaboration Home Open Tasks': { Success: false, ErrorMessage: 'gone' } }).provider, user),
            /Home's open tasks could not be read: gone/,
        );
    });
});
