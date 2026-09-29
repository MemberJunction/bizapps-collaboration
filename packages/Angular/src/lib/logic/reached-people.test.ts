import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { accessChain, nearestSeats, type TreeSpace } from './reached-people.ts';

const id = (n: number): string => `C1000001-0000-4000-8000-${String(n).padStart(12, '0')}`;
const spaces: TreeSpace[] = [
    { ID: id(1), Name: 'Northwind relationship', ParentID: null, InheritsMembership: true },
    { ID: id(2), Name: 'Discovery', ParentID: id(1), InheritsMembership: true },
    { ID: id(11), Name: 'Field notes', ParentID: id(2), InheritsMembership: true },
    { ID: id(14), Name: 'Sealed branch', ParentID: id(1), InheritsMembership: false },
    { ID: id(15), Name: 'Sealed child', ParentID: id(14), InheritsMembership: false },
];
const seat = (space: number, user: string, status = 'Active') => ({ SpaceID: id(space), UserID: user, Status: status });
const seats = [
    seat(1, 'ada'), seat(1, 'sam'), seat(1, 'casey'),
    seat(2, 'bea'), seat(2, 'remy', 'Removed'),
    seat(11, 'ada'),
    seat(14, 'sam'), seat(15, 'sam'), seat(15, 'ada'),
];

describe('who reaches a space', () => {
    it('walks up while each space inherits, nearest first', () => {
        assert.deepEqual(accessChain(id(11), spaces).map((s) => s.name), ['Field notes', 'Discovery', 'Northwind relationship']);
    });

    it('stops at a sealed space', () => {
        assert.deepEqual(accessChain(id(15), spaces).map((s) => s.name), ['Sealed child']);
    });

    it('lists Discovery through Northwind: Ada, Sam and Casey are reached, Bea and Remy sit on it', () => {
        const people = nearestSeats(seats, accessChain(id(2), spaces));
        const byUser = Object.fromEntries(people.map((p) => [p.row.UserID, p]));
        assert.deepEqual(Object.keys(byUser).sort(), ['ada', 'bea', 'casey', 'remy', 'sam']);
        assert.equal(byUser.bea.inherited, false);
        assert.equal(byUser.ada.inherited, true);
        assert.equal(byUser.ada.from.name, 'Northwind relationship');
    });

    it('lists Field notes with Ada on it and Bea, Casey and Sam reached through its parents', () => {
        const people = nearestSeats(seats, accessChain(id(11), spaces));
        const byUser = Object.fromEntries(people.map((p) => [p.row.UserID, p]));
        assert.equal(byUser.ada.inherited, false, "Ada's own seat is nearer than the one she holds on Northwind");
        assert.equal(byUser.casey.from.name, 'Northwind relationship');
        assert.equal(byUser.bea.from.name, 'Discovery');
    });

    it("lists only the sealed child's own seats, not the branch's or Northwind's", () => {
        const people = nearestSeats(seats, accessChain(id(15), spaces));
        assert.deepEqual(people.map((p) => p.row.UserID).sort(), ['ada', 'sam']);
        assert.ok(people.every((p) => !p.inherited));
    });
});
