import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rosterBySeat, type MemberSnapshot, type SpaceNode } from '@mj-biz-apps/collaboration-core';
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
        assert.equal(byUser.ada.inherited, false, "Ada's seat on Field notes is nearer than Ada's seat on Northwind");
        assert.equal(byUser.casey.from.name, 'Northwind relationship');
        assert.equal(byUser.bea.from.name, 'Discovery');
    });

    it("lists only the sealed child's own seats, not the branch's or Northwind's", () => {
        const people = nearestSeats(seats, accessChain(id(15), spaces));
        assert.deepEqual(people.map((p) => p.row.UserID).sort(), ['ada', 'sam']);
        assert.ok(people.every((p) => !p.inherited));
    });

    it("keeps Sam reaching Field notes through Northwind when the guest seat Sam holds there is Removed or Invited, and carries that seat beside Sam", () => {
        const withGuest = (status: string) => [...seats, { SpaceID: id(11), UserID: 'sam', Status: status }];
        for (const status of ['Removed', 'Invited']) {
            const people = nearestSeats(withGuest(status), accessChain(id(11), spaces));
            const sam = people.find((p) => p.row.UserID === 'sam');
            assert.equal(sam?.row.Status, 'Active', status);
            assert.equal(sam?.from.name, 'Northwind relationship');
            assert.equal(sam?.ownSeat?.Status, status);
        }
    });

    it("lists a person nothing else reaches by their own Removed or Invited seat", () => {
        const people = nearestSeats(seats, accessChain(id(2), spaces));
        assert.equal(people.find((p) => p.row.UserID === 'remy')?.row.Status, 'Removed');
    });

    it("follows a parent the viewer can't read, unnamed, and stops there", () => {
        const visible = spaces.filter((s) => s.ID !== id(1));
        const chain = accessChain(id(2), visible);
        assert.deepEqual(chain.map((c) => c.name), ['Discovery', '']);
        const people = nearestSeats(seats, chain);
        assert.deepEqual(people.map((p) => p.row.UserID).sort(), ['ada', 'bea', 'casey', 'remy', 'sam']);
    });

    it("stops at a closed parent whose post-close access has ended, and keeps one whose window is still open", () => {
        const longAgo = '2020-01-01T00:00:00Z';
        const closed = (over: Partial<TreeSpace>): TreeSpace[] => spaces.map((s) => (s.ID === id(2) ? { ...s, ClosedAt: longAgo, ...over } : s));
        assert.deepEqual(accessChain(id(11), closed({ PostCloseAccess: 'None' })).map((c) => c.name), ['Field notes']);
        assert.deepEqual(accessChain(id(11), closed({ PostCloseAccess: 'ReadOnly', PostCloseAccessDays: 30 })).map((c) => c.name), ['Field notes']);
        assert.deepEqual(accessChain(id(11), closed({ PostCloseAccess: 'ReadOnly', PostCloseAccessDays: null })).map((c) => c.name), ['Field notes', 'Discovery', 'Northwind relationship']);
    });
});

describe("the section's list of who reaches a space, held against Core's", () => {
    const now = new Date();
    const daysAgo = (days: number): string => new Date(now.getTime() - days * 86_400_000).toISOString();
    const role = { level: 20, maxGrantableLevel: 10, canInvite: false, canPromoteBand: false, canSeeTeamBand: true, isOwnerRole: false, canContribute: true };

    /** The same tree in the section's shape and in Core's. */
    function trees(closed: Partial<TreeSpace>): { tree: TreeSpace[]; nodes: SpaceNode[] } {
        const tree: TreeSpace[] = [
            { ID: id(1), Name: 'Root', ParentID: null, InheritsMembership: true },
            { ID: id(2), Name: 'Middle', ParentID: id(1), InheritsMembership: true, ...closed },
            { ID: id(3), Name: 'Leaf', ParentID: id(2), InheritsMembership: true },
        ];
        const nodes: SpaceNode[] = tree.map((space) => ({
            id: space.ID, parentId: space.ParentID, inheritsMembership: space.InheritsMembership, ownerId: 'owner', agentRetrieval: 'Included',
            closedAt: space.ClosedAt ?? null, postCloseAccess: space.PostCloseAccess ?? null, postCloseAccessDays: space.PostCloseAccessDays ?? null,
        }));
        return { tree, nodes };
    }
    const rows = [seat(1, 'ada'), seat(2, 'bea'), seat(3, 'lee'), seat(1, 'bea')];
    const snapshots: MemberSnapshot[] = rows.map((row) => ({ spaceId: row.SpaceID, userId: row.UserID, status: 'Active', band: 'Team', role }));

    for (const [label, closed] of [
        ['no space closed', {}],
        ['a closed middle space with no post-close access', { ClosedAt: daysAgo(10), PostCloseAccess: 'None' as const }],
        ['a closed middle space still inside its window', { ClosedAt: daysAgo(10), PostCloseAccess: 'ReadOnly' as const, PostCloseAccessDays: 30 }],
        ['a closed middle space past its window', { ClosedAt: daysAgo(40), PostCloseAccess: 'ReadOnly' as const, PostCloseAccessDays: 30 }],
    ] as const) {
        it(`lists the same people under the same seats with ${label}`, () => {
            const { tree, nodes } = trees(closed);
            const mine = nearestSeats(rows, accessChain(id(3), tree)).map((reached) => `${reached.row.UserID}@${reached.from.id}`).sort();
            const walk = rosterBySeat(nodes, snapshots, id(3), now);
            const core = walk.groups.flatMap((group) => group.members.map((member) => `${member.userId}@${group.spaceId}`)).sort();
            assert.deepEqual(mine, core);
        });
    }
});
