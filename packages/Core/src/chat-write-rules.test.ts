import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    evaluateSpaceChatWriteRules,
    resolveNonLooseningWhoCanWrite,
    type ChatWriteSpaceChatSummary,
} from './chat-write-rules.ts';
import type { MemberSnapshot, RoleFlags, SpaceNode } from './rules.ts';

const OWNER_USER = '10000000-0000-4000-8000-000000000001';
const TEAM_USER = '10000000-0000-4000-8000-000000000002';
const SHARED_USER = '10000000-0000-4000-8000-000000000003';
const GUEST_USER = '10000000-0000-4000-8000-000000000004';
const OUTSIDER_USER = '10000000-0000-4000-8000-000000000005';

const ROOT_SPACE = '20000000-0000-4000-8000-000000000001';
const INHERITED_CHILD = '20000000-0000-4000-8000-000000000002';
const SEALED_CHILD = '20000000-0000-4000-8000-000000000003';
const CLOSED_SPACE = '20000000-0000-4000-8000-000000000004';

const OWNER_ROLE: RoleFlags = {
    level: 100,
    maxGrantableLevel: 100,
    canInvite: true,
    canPromoteBand: true,
    canSeeTeamBand: true,
    isOwnerRole: true,
    canContribute: true,
};
const TEAM_ROLE: RoleFlags = {
    level: 50,
    maxGrantableLevel: 40,
    canInvite: true,
    canPromoteBand: true,
    canSeeTeamBand: true,
    isOwnerRole: false,
    canContribute: true,
};
const SHARED_ROLE: RoleFlags = {
    level: 20,
    maxGrantableLevel: 0,
    canInvite: false,
    canPromoteBand: false,
    canSeeTeamBand: false,
    isOwnerRole: false,
    canContribute: true,
};
const GUEST_ROLE: RoleFlags = {
    level: 10,
    maxGrantableLevel: 0,
    canInvite: false,
    canPromoteBand: false,
    canSeeTeamBand: false,
    isOwnerRole: false,
    canContribute: false,
};

const SPACES: SpaceNode[] = [
    { id: ROOT_SPACE, parentId: null, inheritsMembership: false, ownerId: OWNER_USER, agentRetrieval: 'Included' },
    { id: INHERITED_CHILD, parentId: ROOT_SPACE, inheritsMembership: true, ownerId: OWNER_USER, agentRetrieval: 'Included' },
    { id: SEALED_CHILD, parentId: ROOT_SPACE, inheritsMembership: false, ownerId: OWNER_USER, agentRetrieval: 'Included' },
    { id: CLOSED_SPACE, parentId: null, inheritsMembership: false, ownerId: OWNER_USER, agentRetrieval: 'Included', closedAt: '2026-01-01T00:00:00Z' },
];

const MEMBERSHIPS: MemberSnapshot[] = [
    { spaceId: ROOT_SPACE, userId: OWNER_USER, status: 'Active', band: 'Team', role: OWNER_ROLE },
    { spaceId: ROOT_SPACE, userId: TEAM_USER, status: 'Active', band: 'Team', role: TEAM_ROLE },
    { spaceId: ROOT_SPACE, userId: SHARED_USER, status: 'Active', band: 'Shared', role: SHARED_ROLE },
    { spaceId: ROOT_SPACE, userId: GUEST_USER, status: 'Active', band: 'Shared', role: GUEST_ROLE },
    { spaceId: SEALED_CHILD, userId: OWNER_USER, status: 'Active', band: 'Team', role: OWNER_ROLE },
    { spaceId: CLOSED_SPACE, userId: OWNER_USER, status: 'Active', band: 'Team', role: OWNER_ROLE },
];

function makeChat(over: Partial<ChatWriteSpaceChatSummary> = {}): ChatWriteSpaceChatSummary {
    return {
        id: '30000000-0000-4000-8000-000000000001',
        spaceId: ROOT_SPACE,
        kind: 'General',
        status: 'Active',
        ownerUserId: null,
        ...over,
    };
}

describe('CS-3 pure chat write permission rules', () => {
    it('allows active contributors on General/Topic chats and denies guests and outsiders', () => {
        const chat = makeChat({ kind: 'General' });
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: SHARED_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: chat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Allow');

        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: GUEST_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: chat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Deny');

        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: OUTSIDER_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: chat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Deny');
    });

    it('enforces sealed state: parent member reaches inherited child, not sealed child', () => {
        const inheritedChat = makeChat({ spaceId: INHERITED_CHILD });
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: SHARED_USER,
            operation: 'create',
            spaceId: INHERITED_CHILD,
            spaceChat: inheritedChat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Allow');

        const sealedChat = makeChat({ spaceId: SEALED_CHILD });
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: SHARED_USER,
            operation: 'create',
            spaceId: SEALED_CHILD,
            spaceChat: sealedChat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Deny');

        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: OWNER_USER,
            operation: 'create',
            spaceId: SEALED_CHILD,
            spaceChat: sealedChat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Allow');
    });

    it('enforces Private (Team band), Assistant ownership, and ReadOnly/Archived denial', () => {
        const privateChat = makeChat({ kind: 'Private' });
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: SHARED_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: privateChat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Deny');
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: TEAM_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: privateChat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Allow');

        const assistantChat = makeChat({ kind: 'Assistant', ownerUserId: TEAM_USER });
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: OWNER_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: assistantChat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Deny');
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: TEAM_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: assistantChat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Allow');

        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: OWNER_USER,
            operation: 'create',
            spaceId: CLOSED_SPACE,
            spaceChat: makeChat({ spaceId: CLOSED_SPACE }),
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Deny');

        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: OWNER_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: makeChat({ status: 'Archived' }),
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Deny');
    });

    it('enforces non-loosening policy narrowing and fails closed on unknown policy or kind', () => {
        const narrowed = resolveNonLooseningWhoCanWrite(['Owners', 'Contributors']);
        assert.deepEqual(narrowed, { ok: true, policy: 'Owners' });

        const badPolicy = resolveNonLooseningWhoCanWrite(['Contributors', 'AnyoneAtAll']);
        assert.equal(badPolicy.ok, false);

        // Space asks for Contributors while Type requires Owners -> Owners wins (non-loosening)
        const teamDenied = evaluateSpaceChatWriteRules({
            callerUserId: TEAM_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: makeChat(),
            spaces: SPACES,
            memberships: MEMBERSHIPS,
            policyChain: ['Owners', 'Contributors'],
        });
        assert.equal(teamDenied.Decision, 'Deny');

        const ownerAllowed = evaluateSpaceChatWriteRules({
            callerUserId: OWNER_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: makeChat(),
            spaces: SPACES,
            memberships: MEMBERSHIPS,
            policyChain: ['Owners', 'Contributors'],
        });
        assert.equal(ownerAllowed.Decision, 'Allow');

        // Unknown chat kind fails closed
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: OWNER_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: makeChat({ kind: 'UnknownKind' }),
            spaces: SPACES,
            memberships: MEMBERSHIPS,
        }).Decision, 'Deny');

        // Unregistered driver fails closed
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: OWNER_USER,
            operation: 'create',
            spaceId: ROOT_SPACE,
            spaceChat: makeChat(),
            spaces: SPACES,
            memberships: MEMBERSHIPS,
            driverValidated: false,
        }).Decision, 'Deny');
    });

    it('enforces authorship or owner override on update/delete', () => {
        const chat = makeChat();
        assert.equal(evaluateSpaceChatWriteRules({
            callerUserId: SHARED_USER,
            operation: 'update',
            spaceId: ROOT_SPACE,
            spaceChat: chat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
            detailAuthorUserId: TEAM_USER,
            detailRole: 'User',
        }).Decision, 'Deny');

        const ownerDelete = evaluateSpaceChatWriteRules({
            callerUserId: OWNER_USER,
            operation: 'delete',
            spaceId: ROOT_SPACE,
            spaceChat: chat,
            spaces: SPACES,
            memberships: MEMBERSHIPS,
            detailAuthorUserId: TEAM_USER,
            detailRole: 'User',
        });
        assert.equal(ownerDelete.Decision, 'Allow');
        if (ownerDelete.Decision === 'Allow') {
            assert.equal(ownerDelete.IsOwnerOverride, true);
        }
    });
});
