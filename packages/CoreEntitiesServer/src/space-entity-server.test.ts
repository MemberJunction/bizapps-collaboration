import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UserInfo } from '@memberjunction/core';
import { isStaffUser, STAFF_ROLES } from '../dist/load-graph.js';
import { SpaceEntityServer } from '../dist/SpaceEntityServer.js';

describe('isStaffUser', () => {
    it('returns true for UI, Developer, and Integration roles', () => {
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'UI' }] } as UserInfo), true);
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Developer' }] } as UserInfo), true);
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Integration' }] } as UserInfo), true);
    });

    it('returns false for Space Participant, empty roles, or null', () => {
        assert.equal(isStaffUser({ UserRoles: [{ Role: 'Space Participant' }] } as UserInfo), false);
        assert.equal(isStaffUser({ UserRoles: [] } as UserInfo), false);
        assert.equal(isStaffUser(null), false);
        assert.equal(isStaffUser(undefined), false);
    });
});

describe('SpaceEntityServer staff-only edit gate', () => {
    const participantUser = {
        ID: '11111111-1111-4111-8111-111111111111',
        UserRoles: [{ Role: 'Space Participant' }],
    } as unknown as UserInfo;

    const staffUser = {
        ID: '22222222-2222-4222-8222-222222222222',
        UserRoles: [{ Role: 'UI' }],
    } as unknown as UserInfo;

    function mockSpace(user: UserInfo, isSaved: boolean, dirtyFieldName: string) {
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        Object.defineProperties(space, {
            ContextCurrentUser: { value: user, writable: true },
            IsSaved: { value: isSaved, writable: true },
            ID: { value: '33333333-3333-4333-8333-333333333333', writable: true },
            OwnerID: { value: user.ID, writable: true },
            ParentID: { value: null, writable: true },
            Fields: {
                value: [
                    { Name: dirtyFieldName, Dirty: true, OldValue: false, Value: true },
                    { Name: 'OwnerID', Dirty: false },
                ],
                writable: true,
            },
        });
        return space;
    }

    it('refuses a participant owner editing AllowParentAssignees', async () => {
        const space = mockSpace(participantUser, true, 'AllowParentAssignees');
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'AllowParentAssignees');
        assert.ok(err, 'Expected error on AllowParentAssignees');
        assert.equal(err?.Message, 'Space change refused: only staff may change the allow-parent-assignees setting.');
    });

    it('refuses a participant owner editing AgentRetrieval', async () => {
        const space = mockSpace(participantUser, true, 'AgentRetrieval');
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'AgentRetrieval');
        assert.ok(err, 'Expected error on AgentRetrieval');
        assert.equal(err?.Message, 'Space change refused: only staff may change the agent retrieval setting.');
    });

    it('allows staff to edit AllowParentAssignees without setting refusal', async () => {
        const space = mockSpace(staffUser, true, 'AllowParentAssignees');
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        const err = res.Errors.find((e) => e.Source === 'AllowParentAssignees');
        assert.equal(err, undefined, 'Staff should not be refused for AllowParentAssignees');
    });

    it('allows staff to edit AgentRetrieval without setting refusal', async () => {
        const space = mockSpace(staffUser, true, 'AgentRetrieval');
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        const err = res.Errors.find((e) => e.Source === 'AgentRetrieval');
        assert.equal(err, undefined, 'Staff should not be refused for AgentRetrieval');
    });
});
