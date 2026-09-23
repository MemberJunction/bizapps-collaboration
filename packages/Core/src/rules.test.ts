import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    agentMayQuote,
    isSelfAccept,
    membershipReaches,
    parentCreatesCycle,
    promotionStamps,
    refuseInvite,
    retentionDeadline,
    visibleSpaces,
    type MemberSnapshot,
    type RoleFlags,
    type SpaceNode,
} from './rules.ts';

const ownerRole: RoleFlags = {
    level: 30,
    maxGrantableLevel: 30,
    canInvite: true,
    canPromoteBand: true,
    canSeeTeamBand: true,
    isOwnerRole: true,
};
const guestRole: RoleFlags = {
    level: 10,
    maxGrantableLevel: 10,
    canInvite: true,
    canPromoteBand: false,
    canSeeTeamBand: false,
    isOwnerRole: false,
};
const readerRole: RoleFlags = {
    level: 10,
    maxGrantableLevel: 0,
    canInvite: false,
    canPromoteBand: false,
    canSeeTeamBand: false,
    isOwnerRole: false,
};

function space(partial: Partial<SpaceNode> & Pick<SpaceNode, 'id'>): SpaceNode {
    return {
        parentId: null,
        inheritsMembership: true,
        ownerId: 'owner',
        agentRetrieval: 'Included',
        ...partial,
    };
}

function member(partial: Partial<MemberSnapshot> & Pick<MemberSnapshot, 'spaceId' | 'userId' | 'role'>): MemberSnapshot {
    return { status: 'Active', band: 'Team', ...partial };
}

const tree: SpaceNode[] = [
    space({ id: 'root', ownerId: 'ada' }),
    space({ id: 'child', parentId: 'root' }),
    space({ id: 'sealed', parentId: 'root', inheritsMembership: false }),
    space({ id: 'under-sealed', parentId: 'sealed' }),
];

describe('membershipReaches', () => {
    it('treats a direct membership as reaching that space', () => {
        const memberships = [member({ spaceId: 'child', userId: 'ada', role: ownerRole })];
        assert.equal(membershipReaches(tree, memberships, 'ada', 'child')?.spaceId, 'child');
    });

    it('walks into a child that inherits', () => {
        const memberships = [member({ spaceId: 'root', userId: 'ada', role: ownerRole })];
        assert.equal(membershipReaches(tree, memberships, 'ada', 'child')?.spaceId, 'root');
    });

    it('stops at a sealed space', () => {
        const memberships = [member({ spaceId: 'root', userId: 'ada', role: ownerRole })];
        assert.equal(membershipReaches(tree, memberships, 'ada', 'sealed'), null);
        assert.equal(membershipReaches(tree, memberships, 'ada', 'under-sealed'), null);
    });

    it('lets a direct member of a sealed space reach its inheriting children', () => {
        const memberships = [member({ spaceId: 'sealed', userId: 'bea', role: guestRole, band: 'Shared' })];
        assert.equal(membershipReaches(tree, memberships, 'bea', 'under-sealed')?.userId, 'bea');
        assert.equal(visibleSpaces(tree, memberships, 'bea').map((s) => s.id).sort().join(','), 'sealed,under-sealed');
    });

    it('ignores invited and removed rows', () => {
        const memberships = [member({ spaceId: 'root', userId: 'cy', role: ownerRole, status: 'Invited' })];
        assert.equal(membershipReaches(tree, memberships, 'cy', 'root'), null);
    });
});

describe('refuseInvite', () => {
    const base = {
        callerUserId: 'ada',
        inviteeUserId: 'bea',
        targetSpaceId: 'child',
        granted: guestRole,
        approval: 'Approve' as const,
        memberCap: null,
        spaces: tree,
        memberships: [member({ spaceId: 'root', userId: 'ada', role: ownerRole })],
    };

    it('lets a reaching member invite at or below their ceiling, as Invited', () => {
        assert.deepEqual(refuseInvite(base), { ok: true, status: 'Invited' });
    });

    it('auto-approves when the type says so', () => {
        assert.deepEqual(refuseInvite({ ...base, approval: 'AutoApprove' }), { ok: true, status: 'Active' });
    });

    it('refuses a role above the ceiling', () => {
        const decision = refuseInvite({ ...base, granted: { ...ownerRole, level: 40 } });
        assert.equal(decision.ok, false);
        if (!decision.ok) assert.equal(decision.code, 'above-ceiling');
    });

    it('refuses a role that cannot invite', () => {
        const decision = refuseInvite({
            ...base,
            memberships: [member({ spaceId: 'root', userId: 'ada', role: readerRole })],
        });
        assert.equal(decision.ok, false);
        if (!decision.ok) assert.equal(decision.code, 'cannot-invite');
    });

    it('refuses a parent member inviting into a sealed space', () => {
        const decision = refuseInvite({ ...base, targetSpaceId: 'sealed' });
        assert.equal(decision.ok, false);
        if (!decision.ok) assert.equal(decision.code, 'not-a-member');
    });

    it('lets the owner seat themselves when the roster is empty', () => {
        const decision = refuseInvite({
            ...base,
            callerUserId: 'ada',
            inviteeUserId: 'ada',
            targetSpaceId: 'root',
            granted: ownerRole,
            memberships: [],
        });
        assert.deepEqual(decision, { ok: true, status: 'Active' });
    });

    it('does not let the owner seat someone else before they are a member', () => {
        const decision = refuseInvite({ ...base, targetSpaceId: 'root', memberships: [] });
        assert.equal(decision.ok, false);
        if (!decision.ok) assert.equal(decision.code, 'not-a-member');
    });

    it('lets the invited person accept, and refuses a cycle in the tree', () => {
        assert.equal(isSelfAccept({ callerUserId: 'bea', inviteeUserId: 'bea', previousStatus: 'Invited', nextStatus: 'Active' }), true);
        assert.equal(isSelfAccept({ callerUserId: 'ada', inviteeUserId: 'bea', previousStatus: 'Invited', nextStatus: 'Active' }), false);
        assert.equal(parentCreatesCycle(tree, 'root', 'child'), true);
        assert.equal(parentCreatesCycle(tree, 'child', 'root'), false);
    });

    it('stops at the member cap', () => {
        const decision = refuseInvite({
            ...base,
            memberCap: 1,
            memberships: [
                member({ spaceId: 'root', userId: 'ada', role: ownerRole }),
                member({ spaceId: 'child', userId: 'ada', role: ownerRole }),
            ],
        });
        assert.equal(decision.ok, false);
        if (!decision.ok) assert.equal(decision.code, 'member-cap');
    });
});

describe('promotionStamps', () => {
    const spaces = tree;
    const memberships = [member({ spaceId: 'root', userId: 'ada', role: ownerRole })];

    it('clears the stamp on the team band', () => {
        const decision = promotionStamps({
            callerUserId: 'ada',
            itemSpaceId: 'child',
            nextBand: 'Team',
            now: new Date('2026-09-22T00:00:00Z'),
            spaces,
            memberships,
        });
        assert.deepEqual(decision, { ok: true, band: 'Team', promotedAt: null, promotedByUserId: null });
    });

    it('records who promoted a shared item, and when', () => {
        const now = new Date('2026-09-22T12:00:00Z');
        const decision = promotionStamps({
            callerUserId: 'ada',
            itemSpaceId: 'child',
            nextBand: 'Shared',
            now,
            spaces,
            memberships,
        });
        assert.deepEqual(decision, { ok: true, band: 'Shared', promotedAt: now, promotedByUserId: 'ada' });
    });

    it('refuses a guest who cannot promote', () => {
        const decision = promotionStamps({
            callerUserId: 'bea',
            itemSpaceId: 'child',
            nextBand: 'Shared',
            now: new Date(),
            spaces,
            memberships: [member({ spaceId: 'root', userId: 'bea', role: guestRole, band: 'Shared' })],
        });
        assert.equal(decision.ok, false);
    });
});

describe('agentMayQuote', () => {
    const spaces: SpaceNode[] = [
        space({ id: 'root' }),
        space({ id: 'notes', parentId: 'root', agentRetrieval: 'ExcludedEntirely' }),
        space({ id: 'legal', parentId: 'root', agentRetrieval: 'ExcludedFromParentScope' }),
    ];
    const base = {
        callerCanRead: true,
        callerCanSeeTeam: true,
        itemBand: 'Shared' as const,
        spaces,
    };

    it('quotes a shared item in the asked subtree', () => {
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'root', askedFromSpaceId: 'root' }), true);
    });

    it('does not quote above the space the question was asked in', () => {
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'root', askedFromSpaceId: 'legal' }), false);
    });

    it('hides the team band from a caller who cannot see it', () => {
        assert.equal(
            agentMayQuote({ ...base, callerCanSeeTeam: false, itemBand: 'Team', itemSpaceId: 'root', askedFromSpaceId: 'root' }),
            false,
        );
    });

    it('never quotes a space excluded entirely', () => {
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'notes', askedFromSpaceId: 'notes' }), false);
    });

    it('hides a parent-excluded space when the question was asked above it', () => {
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'legal', askedFromSpaceId: 'root' }), false);
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'legal', askedFromSpaceId: 'legal' }), true);
    });

    it('does not widen a caller who cannot read', () => {
        assert.equal(agentMayQuote({ ...base, callerCanRead: false, itemSpaceId: 'root', askedFromSpaceId: 'root' }), false);
    });
});

describe('retentionDeadline', () => {
    const start = new Date('2026-01-31T00:00:00Z');

    it('has no deadline when retention is indefinite', () => {
        assert.equal(retentionDeadline(start, 'Indefinite'), null);
    });

    it('adds one calendar month and one calendar year in UTC, clamping the day', () => {
        assert.equal(retentionDeadline(start, 'Month')?.toISOString(), '2026-02-28T00:00:00.000Z');
        assert.equal(retentionDeadline(new Date('2026-01-15T00:00:00Z'), 'Month')?.toISOString(), '2026-02-15T00:00:00.000Z');
        assert.equal(retentionDeadline(start, 'Year')?.toISOString(), '2027-01-31T00:00:00.000Z');
    });
});
