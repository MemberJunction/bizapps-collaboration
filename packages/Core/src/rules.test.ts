import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    agentMayQuote,
    authorizeItemWrite,
    authorizeSpaceWrite,
    isSelfRemoval,
    membershipReaches,
    parentCreatesCycle,
    planSpaceWrite,
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
    canContribute: true,
};
const guestRole: RoleFlags = {
    level: 10,
    maxGrantableLevel: 10,
    canInvite: true,
    canPromoteBand: false,
    canSeeTeamBand: false,
    isOwnerRole: false,
    canContribute: false,
};
const readerRole: RoleFlags = {
    level: 10,
    maxGrantableLevel: 0,
    canInvite: false,
    canPromoteBand: false,
    canSeeTeamBand: false,
    isOwnerRole: false,
    canContribute: false,
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
        assert.deepEqual(refuseInvite(base), { ok: true, status: 'Active' });
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
        assert.equal(isSelfRemoval({ callerUserId: 'bea', inviteeUserId: 'bea', nextStatus: 'Removed' }), true);
        assert.equal(isSelfRemoval({ callerUserId: 'ada', inviteeUserId: 'bea', nextStatus: 'Removed' }), false);
        assert.equal(parentCreatesCycle(tree, 'root', 'child'), true);
        assert.equal(parentCreatesCycle(tree, 'child', 'root'), false);
    });

    it('refuses the owner reseating themselves when the roster is not empty', () => {
        const decision = refuseInvite({
            ...base,
            callerUserId: 'ada',
            inviteeUserId: 'ada',
            targetSpaceId: 'child',
            granted: ownerRole,
            memberships: [],
            occupied: 2,
        });
        assert.equal(decision.ok, false);
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
        assert.deepEqual(decision, { ok: true, band: 'Team', promotedAt: null, promotedByUserId: null, rewriteStamp: true });
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
        assert.deepEqual(decision, { ok: true, band: 'Shared', promotedAt: now, promotedByUserId: 'ada', rewriteStamp: true });
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

describe('flag ceiling', () => {
    const wideGuest: RoleFlags = { ...guestRole, level: 10, canSeeTeamBand: true, canPromoteBand: true };
    it('refuses a lower level that can see the team band the grantor cannot', () => {
        const decision = refuseInvite({
            callerUserId: 'bea',
            inviteeUserId: 'cy',
            targetSpaceId: 'child',
            granted: wideGuest,
            approval: 'Approve',
            memberCap: null,
            spaces: tree,
            memberships: [member({ spaceId: 'root', userId: 'bea', role: { ...guestRole, level: 50 }, band: 'Shared' })],
        });
        assert.equal(decision.ok, false);
        if (!decision.ok) assert.equal(decision.code, 'above-ceiling');
    });
});

describe('space writes', () => {
    const here = member({ spaceId: 'child', userId: 'ada', role: ownerRole });
    const onRoot = member({ spaceId: 'root', userId: 'ada', role: ownerRole });
    it('lets staff create a root they will own', () => {
        assert.equal(planSpaceWrite({ isNew: true, previousParentId: null, nextParentId: null }), 'create-root');
        assert.equal(authorizeSpaceWrite({ kind: 'create-root', callerUserId: 'ada', callerIsStaff: true, nextOwnerId: 'ada', here: null, onParent: null }).ok, true);
    });
    it('refuses a participant creating a root', () => {
        assert.equal(authorizeSpaceWrite({ kind: 'create-root', callerUserId: 'ada', callerIsStaff: false, nextOwnerId: 'ada', here: null, onParent: null }).ok, false);
    });
    it('lets an owner of the parent create a child', () => {
        assert.equal(planSpaceWrite({ isNew: true, previousParentId: null, nextParentId: 'root' }), 'create-child');
        assert.equal(authorizeSpaceWrite({ kind: 'create-child', callerUserId: 'ada', callerIsStaff: false, nextOwnerId: 'ada', here: null, onParent: onRoot }).ok, true);
    });
    it('lets an owner edit in place and move under a parent they own', () => {
        assert.equal(planSpaceWrite({ isNew: false, previousParentId: 'root', nextParentId: 'root' }), 'edit');
        assert.equal(authorizeSpaceWrite({ kind: 'edit', callerUserId: 'ada', callerIsStaff: false, nextOwnerId: 'ada', here, onParent: null }).ok, true);
        assert.equal(planSpaceWrite({ isNew: false, previousParentId: 'root', nextParentId: 'legal' }), 'move');
        assert.equal(authorizeSpaceWrite({ kind: 'move', callerUserId: 'ada', callerIsStaff: true, nextOwnerId: 'ada', here, onParent: onRoot }).ok, true);
    });
    it('refuses a move under a descendant and a guest edit', () => {
        assert.equal(parentCreatesCycle(tree, 'root', 'child'), true);
        const guest = member({ spaceId: 'child', userId: 'bea', role: guestRole, band: 'Shared' });
        assert.equal(authorizeSpaceWrite({ kind: 'edit', callerUserId: 'bea', callerIsStaff: false, nextOwnerId: 'ada', here: guest, onParent: null }).ok, false);
        assert.equal(authorizeSpaceWrite({ kind: 'move', callerUserId: 'ada', callerIsStaff: true, nextOwnerId: 'ada', here, onParent: null }).ok, false);
    });
});

describe('item writes', () => {
    const now = new Date('2026-09-22T00:00:00Z');
    const memberships = [member({ spaceId: 'root', userId: 'ada', role: ownerRole })];
    const base = { callerUserId: 'ada', now, spaces: tree, memberships };
    it('refuses placing an item in a space the caller does not reach', () => {
        assert.equal(authorizeItemWrite({ ...base, callerUserId: 'cy', previousSpaceId: null, nextSpaceId: 'child', previousBand: null, nextBand: 'Team' }).ok, false);
    });
    it('requires promote to demote', () => {
        const decision = authorizeItemWrite({
            ...base,
            callerUserId: 'bea',
            previousSpaceId: 'child',
            nextSpaceId: 'child',
            previousBand: 'Shared',
            nextBand: 'Team',
            memberships: [member({ spaceId: 'root', userId: 'bea', role: guestRole, band: 'Shared' })],
        });
        assert.equal(decision.ok, false);
    });
    it('does not rewrite the stamp when a shared item stays shared', () => {
        const decision = authorizeItemWrite({ ...base, previousSpaceId: 'child', nextSpaceId: 'child', previousBand: 'Shared', nextBand: 'Shared' });
        assert.equal(decision.ok && decision.rewriteStamp, false);
    });
    it('stamps a new shared item and clears a team item', () => {
        const shared = authorizeItemWrite({ ...base, previousSpaceId: null, nextSpaceId: 'child', previousBand: null, nextBand: 'Shared' });
        assert.equal(shared.ok && shared.rewriteStamp, true);
        const team = authorizeItemWrite({ ...base, previousSpaceId: 'child', nextSpaceId: 'child', previousBand: 'Shared', nextBand: 'Team' });
        assert.equal(team.ok && team.band, 'Team');
    });
    it('requires reach on both spaces for a move', () => {
        const decision = authorizeItemWrite({ ...base, previousSpaceId: 'sealed', nextSpaceId: 'child', previousBand: 'Team', nextBand: 'Team' });
        assert.equal(decision.ok, false);
    });
});

describe('agent exclusion covers descendants', () => {
    const spaces: SpaceNode[] = [
        space({ id: 'root' }),
        space({ id: 'econ', parentId: 'root', agentRetrieval: 'ExcludedEntirely' }),
        space({ id: 'econ-q3', parentId: 'econ' }),
        space({ id: 'legal', parentId: 'root', agentRetrieval: 'ExcludedFromParentScope' }),
        space({ id: 'legal-memo', parentId: 'legal' }),
    ];
    const base = { callerCanRead: true, callerCanSeeTeam: true, itemBand: 'Shared' as const, spaces };
    it('excludes a descendant of an entirely excluded space', () => {
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'econ-q3', askedFromSpaceId: 'root' }), false);
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'econ-q3', askedFromSpaceId: 'econ-q3' }), false);
    });
    it('excludes a memo under a parent-excluded space when asked from above', () => {
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'legal-memo', askedFromSpaceId: 'root' }), false);
        assert.equal(agentMayQuote({ ...base, itemSpaceId: 'legal-memo', askedFromSpaceId: 'legal' }), true);
    });
});

describe('external participant persona', () => {
    const sibling: SpaceNode[] = [
        space({ id: 'root' }),
        space({ id: 'theirs', parentId: 'root' }),
        space({ id: 'ours', parentId: 'root' }),
    ];
    const memberships = [member({ spaceId: 'ours', userId: 'guest', role: guestRole, band: 'Shared' })];
    it('sees only its own space, and not the team band', () => {
        assert.deepEqual(visibleSpaces(sibling, memberships, 'guest').map((s) => s.id), ['ours']);
        assert.equal(agentMayQuote({
            callerCanRead: true,
            callerCanSeeTeam: false,
            itemBand: 'Team',
            itemSpaceId: 'ours',
            askedFromSpaceId: 'ours',
            spaces: sibling,
        }), false);
        assert.equal(agentMayQuote({
            callerCanRead: false,
            callerCanSeeTeam: false,
            itemBand: 'Shared',
            itemSpaceId: 'theirs',
            askedFromSpaceId: 'root',
            spaces: sibling,
        }), false);
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
