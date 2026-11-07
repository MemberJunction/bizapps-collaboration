import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { taskAssigneeLabels, type AssigneeKind, type TaskAssignmentRow } from './task-assignee.ts';

const PEOPLE = 'people-entity';
const USERS = 'users-entity';
const kindOf = (id: string): AssigneeKind => (id === PEOPLE ? 'person' : id === USERS ? 'user' : null);
const names = {
    person: new Map([['p-ana', 'Ana Ruiz'], ['p-ben', 'Ben Okafor']]),
    user: new Map([['u-wei', 'Wei-Lin Tsai']]),
};
const row = (task: string, entity: string, record: string, status = 'Pending', at: string | null = null): TaskAssignmentRow =>
    ({ TaskID: task, AssigneeEntityID: entity, AssigneeRecordID: record, Status: status, AssignedAt: at });

describe('the assignee a Work row shows', () => {
    it('names a person or a user, matching task and record IDs in any case', () => {
        const labels = taskAssigneeLabels([row('T-1', PEOPLE, 'P-ANA'), row('t-2', USERS, 'u-wei', 'InProgress')], kindOf, names);
        assert.equal(labels.get('t-1'), 'Ana Ruiz');
        assert.equal(labels.get('t-2'), 'Wei-Lin Tsai');
    });

    it('puts whoever is still on the task before whoever finished, earliest assigned first, and counts the rest', () => {
        const labels = taskAssigneeLabels([
            row('t', PEOPLE, 'p-ana', 'Completed', '2026-01-01'),
            row('t', PEOPLE, 'p-ben', 'InProgress', '2026-03-01'),
            row('t', USERS, 'u-wei', 'Pending', '2026-02-01'),
        ], kindOf, names);
        assert.equal(labels.get('t'), 'Wei-Lin Tsai +2');
    });

    it('leaves a task with no nameable assignee out, so it reads Unassigned', () => {
        const labels = taskAssigneeLabels([row('t', 'other-entity', 'x'), row('t', PEOPLE, 'p-unknown')], kindOf, names);
        assert.equal(labels.has('t'), false);
        assert.equal(taskAssigneeLabels([], kindOf, names).size, 0);
    });

    it('counts one person once, however many rows name them', () => {
        const labels = taskAssigneeLabels([row('t', PEOPLE, 'p-ana', 'Completed'), row('t', PEOPLE, 'p-ana')], kindOf, names);
        assert.equal(labels.get('t'), 'Ana Ruiz');
    });
});
