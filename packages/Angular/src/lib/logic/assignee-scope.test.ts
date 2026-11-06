import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RoleFlags } from '@mj-biz-apps/collaboration-core';
import { assignableUsers, assigneeScopeFilter } from './assignee-scope.ts';

const SPACE = 'C1000001-0000-4000-8000-000000000002';
const PARENT = 'C1000001-0000-4000-8000-000000000001';
const flags = (over: Partial<RoleFlags>): RoleFlags => ({
    level: 20, maxGrantableLevel: 10, canInvite: true, canPromoteBand: false, canSeeTeamBand: true, isOwnerRole: false, canContribute: true, ...over,
});
const seats = [
    { userId: 'sam', seatSpaceId: SPACE, role: flags({}) },
    { userId: 'bea', seatSpaceId: SPACE, role: flags({ canSeeTeamBand: false }) },
    { userId: 'ada', seatSpaceId: PARENT, role: flags({ isOwnerRole: true, canPromoteBand: true }) },
];

describe('who a task in a space may be given to', () => {
    it('offers everyone seated in the space for a Shared task when parent assignees are allowed', () => {
        assert.deepEqual(assignableUsers(seats, { taskSpaceId: SPACE, taskBand: 'Shared', allowParentAssignees: true, callerMayAdminister: false }), ['sam', 'bea', 'ada']);
    });

    it('skips anyone who cannot see Team for a Team task', () => {
        assert.deepEqual(assignableUsers(seats, { taskSpaceId: SPACE, taskBand: 'Team', allowParentAssignees: true, callerMayAdminister: false }), ['sam', 'ada']);
    });

    it('skips seats above the space when the space disallows parent assignees, unless the caller administers spaces', () => {
        assert.deepEqual(assignableUsers(seats, { taskSpaceId: SPACE, taskBand: 'Shared', allowParentAssignees: false, callerMayAdminister: false }), ['sam', 'bea']);
        assert.deepEqual(assignableUsers(seats, { taskSpaceId: SPACE, taskBand: 'Shared', allowParentAssignees: false, callerMayAdminister: true }), ['sam', 'bea', 'ada']);
    });
});

describe('the assignee picker filter', () => {
    it('names the people, once each', () => {
        assert.equal(assigneeScopeFilter(['p1', 'p2', 'p1']), "ID IN ('p1', 'p2')");
    });

    it('matches nobody when there is nobody, never the empty scope the panel reads as everyone', () => {
        assert.equal(assigneeScopeFilter([]), '1 = 0');
        assert.equal(assigneeScopeFilter(['', ' ']), '1 = 0');
    });
});
