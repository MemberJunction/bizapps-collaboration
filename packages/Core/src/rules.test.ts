import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    agentMayQuote,
    authorizeItemWrite,
    authorizeTaskAssignment,
    mayFileRootTask,
    authorizeSpaceWrite,
    chainsForSpaceWrite,
    isSelfRemoval,
    leavingWouldStrand,
    wouldStrandLastOwner,
    callerMayReceiveLink,
    handInviteToEngine,
    inviteEmail,
    linkHandoff,
    lockoutMessage,
    magicLinkBlocksAccount,
    resourcesFromRoster,
    membershipReaches,
    rosterActions,
    rosterBySeat,
    parentCreatesCycle,
    planSpaceWrite,
    promotionStamps,
    refuseInvite,
    strandFromSavedRow,
    retentionDeadline,
    visibleSpaces,
    type InviteEmail,
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
    space({ id: 'grandchild', parentId: 'child' }),
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

describe('magic link and roster permission', () => {
    const memberships = [
        member({ spaceId: 'root', userId: 'ada', role: ownerRole }),
        member({ spaceId: 'root', userId: 'sam', role: readerRole, band: 'Shared' }),
    ];

    it('withholds the sign-in link from a space owner who is not a host issuer', () => {
        assert.equal(callerMayReceiveLink({ userType: 'User', roleNames: ['UI'], issuerRoleNames: [] }), false);
        assert.equal(callerMayReceiveLink({ userType: 'Owner', roleNames: [], issuerRoleNames: [] }), true);
        assert.equal(callerMayReceiveLink({ userType: 'User', roleNames: ['UI'], issuerRoleNames: ['UI'] }), true);
        assert.equal(linkHandoff({ emailChannel: false, callerIsIssuer: false }), 'withhold');
        assert.equal(linkHandoff({ emailChannel: false, callerIsIssuer: true }), 'show');
        assert.equal(linkHandoff({ emailChannel: true, callerIsIssuer: false }), 'email');
    });

    it('lists the spaces Sam reaches, including children he is not seated on', () => {
        const samTree: SpaceNode[] = [
            space({ id: 'northwind', ownerId: 'ada' }),
            space({ id: 'discovery', parentId: 'northwind' }),
            space({ id: 'field-notes', parentId: 'discovery' }),
            space({ id: 'delivery', parentId: 'northwind', inheritsMembership: false }),
            space({ id: 'delivery-room', parentId: 'delivery' }),
        ];
        const samSeats = [
            member({ spaceId: 'northwind', userId: 'sam', role: readerRole }),
            member({ spaceId: 'delivery', userId: 'sam', role: readerRole }),
        ];
        const names = new Map(resourcesFromRoster({ callerUserId: 'sam', spaces: samTree, memberships: samSeats }).map((row) => [row.spaceId, row.actions]));
        assert.ok(names.has('discovery'));
        assert.ok(names.has('field-notes'));
        assert.ok(names.has('delivery-room'));
        assert.deepEqual(names.get('discovery'), ['Read']);
    });

    it('does not issue a link MJ would refuse, unless the host warns instead', () => {
        const staff = {
            userType: 'User',
            roleNames: ['UI'],
            restrictedRoleName: 'Space Participant',
            grantableRoleNames: ['Space Participant'],
            invitedRoleName: 'Space Participant',
        };
        assert.equal(magicLinkBlocksAccount({ ...staff, provisioningGuard: 'block' }), true);
        assert.equal(magicLinkBlocksAccount({ ...staff, provisioningGuard: 'warn' }), false);
        assert.equal(magicLinkBlocksAccount({ ...staff, userType: 'Owner', roleNames: [], provisioningGuard: 'block' }), true);
        assert.equal(magicLinkBlocksAccount({
            userType: 'User',
            roleNames: ['Space Participant'],
            restrictedRoleName: 'Space Participant',
            grantableRoleNames: ['Space Participant'],
            invitedRoleName: 'Space Participant',
            provisioningGuard: 'block',
        }), false);
    });

    it('names an invited seat and a removed seat on the no-access page', () => {
        assert.equal(
            lockoutMessage([{ spaceName: 'Audit committee', status: 'Invited' }]),
            "Your invite to Audit committee is waiting for an owner's approval.",
        );
        assert.equal(
            lockoutMessage([{ spaceName: 'Discovery', status: 'Removed' }]),
            'Your seat on Discovery was removed.',
        );
        assert.match(lockoutMessage([]), /invite your account/);
    });

    it('sends the invite email with a from address and the link', async () => {
        const sent: InviteEmail[] = [];
        const message = inviteEmail({ from: 'invites@example.com', to: 'bea@example.com', url: 'http://host/magic-link/redeem?token=abc' });
        const ok = await handInviteToEngine({
            SendSingleMessage: async (_provider, _type, email) => {
                sent.push(email);
                return { Success: true };
            },
        }, 'smtp', message);
        assert.equal(ok, true);
        assert.equal(sent[0]?.from, 'invites@example.com');
        assert.equal(sent[0]?.to, 'bea@example.com');
        assert.match(sent[0]?.body ?? '', /token=abc/);
    });

    it('grants read to a member who reaches the space, and update to the owner', () => {
        assert.deepEqual(rosterActions({ callerUserId: 'sam', spaceId: 'child', spaces: tree, memberships }), ['Read']);
        assert.deepEqual(rosterActions({ callerUserId: 'ada', spaceId: 'sealed', spaces: tree, memberships }), []);
        assert.deepEqual(rosterActions({ callerUserId: 'ada', spaceId: 'child', spaces: tree, memberships }), ['Read', 'Update', 'Share']);
    });
});

describe('rosterBySeat', () => {
    const seated = [
        member({ spaceId: 'root', userId: 'ada', role: ownerRole }),
        member({ spaceId: 'child', userId: 'bea', role: readerRole, band: 'Shared' }),
        member({ spaceId: 'grandchild', userId: 'lee', role: readerRole, band: 'Shared' }),
        member({ spaceId: 'sealed', userId: 'sam', role: ownerRole }),
    ];

    it('lists a three-level chain by the seat, nearest first', () => {
        const walk = rosterBySeat(tree, seated, 'grandchild');
        assert.equal(walk.stop, 'root');
        assert.deepEqual(walk.groups.map((group) => group.spaceId), ['grandchild', 'child', 'root']);
        assert.deepEqual(walk.groups[2].members.map((member) => member.userId), ['ada']);
    });

    it('lists a person once, under their nearest seat', () => {
        const both = [...seated, member({ spaceId: 'child', userId: 'ada', role: ownerRole })];
        const walk = rosterBySeat(tree, both, 'grandchild');
        const seats = walk.groups.flatMap((group) => group.members.filter((member) => member.userId === 'ada').map(() => group.spaceId));
        assert.deepEqual(seats, ['child']);
    });

    it('stops the list at a sealed space', () => {
        const walk = rosterBySeat(tree, seated, 'under-sealed');
        assert.equal(walk.stop, 'sealed');
        assert.deepEqual(walk.groups.map((group) => group.spaceId), ['sealed']);
        assert.equal(membershipReaches(tree, seated, 'ada', 'under-sealed'), null);
        assert.equal(membershipReaches(tree, seated, 'sam', 'under-sealed')?.userId, 'sam');
    });

    it('reports a parent the viewer was not given, the way a row filter hides it', () => {
        const visible = tree.filter((space) => space.id === 'child' || space.id === 'grandchild');
        const visibleMembers = seated.filter((member) => member.spaceId === 'child' || member.spaceId === 'grandchild');
        const walk = rosterBySeat(visible, visibleMembers, 'grandchild');
        assert.equal(walk.stop, 'unloaded-parent');
        assert.deepEqual(walk.groups.map((group) => group.spaceId), ['grandchild', 'child']);
        assert.equal(membershipReaches(visible, visibleMembers, 'ada', 'grandchild'), null);
        assert.equal(membershipReaches(visible, visibleMembers, 'bea', 'grandchild')?.userId, 'bea');
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

    it('seats the owner when the ids differ only by case', () => {
        const decision = refuseInvite({
            ...base,
            callerUserId: 'ADA',
            inviteeUserId: 'ada',
            targetSpaceId: 'ROOT',
            granted: ownerRole,
            memberships: [],
            spaces: tree.map((space) => space.id === 'root' ? { ...space, id: 'Root', ownerId: 'Ada' } : space),
        });
        assert.deepEqual(decision, { ok: true, status: 'Active' });
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
    it('treats mixed-case parent ids as the same parent, and mixed-case owners as the same person', () => {
        const parent = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee2';
        const owner = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1';
        assert.equal(planSpaceWrite({ isNew: false, previousParentId: parent.toUpperCase(), nextParentId: parent }), 'edit');
        assert.equal(authorizeSpaceWrite({
            kind: 'create-root',
            callerUserId: owner,
            callerIsStaff: true,
            nextOwnerId: owner.toUpperCase(),
            here: null,
            onParent: null,
        }).ok, true);
    });
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
    it('lets staff move a space to the top level and refuses an owner who is not staff', () => {
        assert.deepEqual(chainsForSpaceWrite('move', true), { here: true, destination: false });
        assert.deepEqual(chainsForSpaceWrite('move', false), { here: true, destination: true });
        assert.equal(authorizeSpaceWrite({ kind: 'move', callerUserId: 'ada', callerIsStaff: true, nextOwnerId: 'ada', toRoot: true, here, onParent: null }).ok, true);
        assert.equal(authorizeSpaceWrite({ kind: 'move', callerUserId: 'ada', callerIsStaff: false, nextOwnerId: 'ada', toRoot: true, here, onParent: null }).ok, false);
    });
    it('refuses a move under a descendant and a guest edit', () => {
        assert.equal(parentCreatesCycle(tree, 'root', 'child'), true);
        const guest = member({ spaceId: 'child', userId: 'bea', role: guestRole, band: 'Shared' });
        assert.equal(authorizeSpaceWrite({ kind: 'edit', callerUserId: 'bea', callerIsStaff: false, nextOwnerId: 'ada', here: guest, onParent: null }).ok, false);
        assert.equal(authorizeSpaceWrite({ kind: 'move', callerUserId: 'ada', callerIsStaff: true, nextOwnerId: 'ada', here, onParent: null }).ok, false);
    });
});

describe('filing a root task', () => {
    const now = new Date('2026-09-22T00:00:00Z');
    it('refuses a guest', () => {
        const decision = mayFileRootTask({
            callerUserId: 'bea',
            spaceId: 'child',
            requestedBand: 'Team',
            now,
            spaces: tree,
            memberships: [member({ spaceId: 'child', userId: 'bea', role: guestRole, band: 'Shared' })],
        });
        assert.equal(decision.ok, false);
    });
    it('files a client member on Shared when they ask for Team', () => {
        const decision = mayFileRootTask({
            callerUserId: 'bea',
            spaceId: 'child',
            requestedBand: 'Team',
            now,
            spaces: tree,
            memberships: [member({ spaceId: 'child', userId: 'bea', role: { ...guestRole, canContribute: true }, band: 'Shared' })],
        });
        assert.equal(decision.ok, true);
        if (decision.ok) assert.equal(decision.band, 'Shared');
    });
    it('keeps Team when the caller can see it', () => {
        const decision = mayFileRootTask({
            callerUserId: 'ada',
            spaceId: 'child',
            requestedBand: 'Team',
            now,
            spaces: tree,
            memberships: [member({ spaceId: 'root', userId: 'ada', role: ownerRole })],
        });
        assert.equal(decision.ok, true);
        if (decision.ok) assert.equal(decision.band, 'Team');
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
    it('re-stamps a shared move and refuses it without promote rights', () => {
        const client: RoleFlags = { ...guestRole, canContribute: true, canPromoteBand: false };
        const refused = authorizeItemWrite({
            ...base, callerUserId: 'bea', previousSpaceId: 'child', nextSpaceId: 'root', previousBand: 'Shared', nextBand: 'Shared',
            memberships: [member({ spaceId: 'root', userId: 'bea', role: client, band: 'Shared' })],
        });
        assert.equal(refused.ok, false);
        const allowed = authorizeItemWrite({ ...base, previousSpaceId: 'child', nextSpaceId: 'root', previousBand: 'Shared', nextBand: 'Shared' });
        assert.equal(allowed.ok && allowed.rewriteStamp, true);
    });
    it('keeps a non-owner invite Invited under Approve', () => {
        const admin: RoleFlags = { ...ownerRole, isOwnerRole: false, level: 30, maxGrantableLevel: 20 };
        const decision = refuseInvite({
            callerUserId: 'bea', inviteeUserId: 'cy', targetSpaceId: 'child', granted: guestRole,
            approval: 'Approve', memberCap: null, spaces: tree,
            memberships: [member({ spaceId: 'root', userId: 'bea', role: admin })],
        });
        assert.deepEqual(decision, { ok: true, status: 'Invited' });
    });
    it('refuses the last owner leaving', () => {
        assert.equal(leavingWouldStrand({ isOwner: true, activeOwners: 1 }), true);
        assert.equal(leavingWouldStrand({ isOwner: true, activeOwners: 2 }), false);
        assert.equal(leavingWouldStrand({ isOwner: false, activeOwners: 1 }), false);
        assert.equal(wouldStrandLastOwner({ currentlyActiveOwner: true, nextIsActive: true, nextIsOwner: false, activeOwners: 1 }), true);
        assert.equal(wouldStrandLastOwner({ currentlyActiveOwner: true, nextIsActive: false, nextIsOwner: true, activeOwners: 1 }), true);
        assert.equal(wouldStrandLastOwner({ currentlyActiveOwner: true, nextIsActive: false, nextIsOwner: false, activeOwners: 2 }), false);
        const approve = strandFromSavedRow({ savedStatus: 'Invited', savedIsOwner: false, nextStatus: 'Active', nextIsOwner: false, activeOwners: 1 });
        assert.equal(wouldStrandLastOwner(approve), false);
        const removeGuest = strandFromSavedRow({ savedStatus: 'Active', savedIsOwner: false, nextStatus: 'Removed', nextIsOwner: false, activeOwners: 1 });
        assert.equal(wouldStrandLastOwner(removeGuest), false);
        const demoteSelf = strandFromSavedRow({ savedStatus: 'Active', savedIsOwner: true, nextStatus: 'Active', nextIsOwner: false, activeOwners: 1 });
        assert.equal(wouldStrandLastOwner(demoteSelf), true);
        const coOwner = strandFromSavedRow({ savedStatus: 'Active', savedIsOwner: true, nextStatus: 'Removed', nextIsOwner: true, activeOwners: 2 });
        assert.equal(wouldStrandLastOwner(coOwner), false);
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
    it('treats mixed-case ids the same as lowercase', () => {
        const upper: SpaceNode[] = [
            space({ id: 'ROOT', agentRetrieval: 'ExcludedEntirely' }),
            space({ id: 'CHILD', parentId: 'ROOT' }),
        ];
        const baseQuote = { callerCanRead: true, callerCanSeeTeam: true, itemBand: 'Shared' as const };
        assert.equal(agentMayQuote({ ...baseQuote, itemSpaceId: 'child', askedFromSpaceId: 'root', spaces: upper }), false);
        const between: SpaceNode[] = [
            space({ id: 'ROOT' }),
            space({ id: 'MID', parentId: 'ROOT', agentRetrieval: 'ExcludedFromParentScope' }),
            space({ id: 'CHILD', parentId: 'MID' }),
        ];
        assert.equal(agentMayQuote({ ...baseQuote, itemSpaceId: 'child', askedFromSpaceId: 'root', spaces: between }), false);
        const included: SpaceNode[] = [
            space({ id: 'ROOT' }),
            space({ id: 'CHILD', parentId: 'ROOT' }),
        ];
        assert.equal(agentMayQuote({ ...baseQuote, itemSpaceId: 'CHILD', askedFromSpaceId: 'ROOT', spaces: included }), true);
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

describe('authorizeTaskAssignment', () => {
    const teamMemberRole: RoleFlags = { ...guestRole, canSeeTeamBand: true, canContribute: true };
    const sharedOnlyRole: RoleFlags = { ...guestRole, canSeeTeamBand: false, canContribute: true };

    it('allows a participant to assign an ancestor member when AllowParentAssignees is on', () => {
        const decision = authorizeTaskAssignment({
            callerIsStaff: false,
            taskSpaceId: 'discovery',
            assigneeSeatSpaceId: 'northwind',
            allowParentAssignees: true,
            taskBand: 'Shared',
            assigneeRole: teamMemberRole,
        });
        assert.equal(decision.ok, true);
    });

    it('refuses a participant assigning an ancestor member when AllowParentAssignees is off', () => {
        const decision = authorizeTaskAssignment({
            callerIsStaff: false,
            taskSpaceId: 'discovery',
            assigneeSeatSpaceId: 'northwind',
            allowParentAssignees: false,
            taskBand: 'Shared',
            assigneeRole: teamMemberRole,
        });
        assert.equal(decision.ok, false);
        if (!decision.ok) {
            assert.equal(decision.message, 'Assignment refused: participants may not assign people seated above this space.');
        }
    });

    it('allows a participant to assign someone seated in the same space even when AllowParentAssignees is off', () => {
        const decision = authorizeTaskAssignment({
            callerIsStaff: false,
            taskSpaceId: 'discovery',
            assigneeSeatSpaceId: 'discovery',
            allowParentAssignees: false,
            taskBand: 'Shared',
            assigneeRole: teamMemberRole,
        });
        assert.equal(decision.ok, true);
    });

    it('allows staff to assign an ancestor member even when AllowParentAssignees is off', () => {
        const decision = authorizeTaskAssignment({
            callerIsStaff: true,
            taskSpaceId: 'discovery',
            assigneeSeatSpaceId: 'northwind',
            allowParentAssignees: false,
            taskBand: 'Shared',
            assigneeRole: teamMemberRole,
        });
        assert.equal(decision.ok, true);
    });

    it('refuses assignment of a Team task to someone who cannot see Team', () => {
        const decision = authorizeTaskAssignment({
            callerIsStaff: true,
            taskSpaceId: 'discovery',
            assigneeSeatSpaceId: 'discovery',
            allowParentAssignees: true,
            taskBand: 'Team',
            assigneeRole: sharedOnlyRole,
        });
        assert.equal(decision.ok, false);
        if (!decision.ok) {
            assert.equal(decision.message, 'Assignment refused: a Team task cannot be given to someone who cannot see Team.');
        }
    });
});

