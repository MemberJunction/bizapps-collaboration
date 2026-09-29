import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countLabel, countText, invitationRows, taskRows } from './home-lists.ts';

const day = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');

describe("Home's lists", () => {
    it('shows an invitation as a row that opens the People tab of its space', () => {
        const [row] = invitationRows([{ SeatID: 's1', SpaceID: 'sp1', SpaceName: 'Northwind', Person: 'Bea', RoleName: 'Contributor', InvitedAt: '2026-09-28T10:00:00.000Z' }], day);
        assert.deepEqual(row, { key: 's1', title: 'Bea is invited as Contributor', detail: 'Invited 2026-09-28', spaceName: 'Northwind', iconClass: 'fa-solid fa-user-plus', actionLabel: 'Review on People' });
    });

    it('does not invent a date or a role for an invitation that has none', () => {
        const [row] = invitationRows([{ SeatID: 's1', SpaceID: 'sp1', SpaceName: 'Northwind', Person: 'Bea', RoleName: '', InvitedAt: null }], day);
        assert.equal(row.title, 'Bea is invited');
        assert.equal(row.detail, 'Waiting for an owner');
    });

    it('shows a task with its status, priority and due date, and skips what is missing', () => {
        const rows = taskRows([
            { TaskID: 't1', Name: 'Send the deck', Status: 'InProgress', Priority: 'High', DueAt: '2026-10-02T00:00:00.000Z', SpaceID: 'sp1', SpaceName: 'Northwind' },
            { TaskID: 't2', Name: 'Sign off', Status: 'Pending', Priority: null, DueAt: null, SpaceID: 'sp2', SpaceName: 'Board' },
            { TaskID: 't3', Name: 'Odd', Status: 'Waiting', SpaceID: 'sp2', SpaceName: 'Board' },
        ], day);
        assert.deepEqual(rows.map((r) => r.detail), ['In progress · High priority · due 2026-10-02', 'Not started', 'Waiting']);
        assert.equal(rows[0].actionLabel, 'Open in Work');
        assert.equal(rows[0].spaceName, 'Northwind');
    });

    it('shows a dash, not zero, for a count that could not be read, and says so to a screen reader', () => {
        assert.equal(countText(0, false), '0');
        assert.equal(countText(7, true), '—');
        assert.equal(countLabel(1, false, 'open task', 'open tasks'), '1 open task');
        assert.equal(countLabel(0, false, 'open task', 'open tasks'), '0 open tasks');
        assert.equal(countLabel(3, true, 'open task', 'open tasks'), 'open tasks: could not be read');
    });
});
