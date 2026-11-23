import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateSpaceChatWriteRules, type ChatWriteSpaceChatSummary } from './chat-write-rules.ts';
import type { MemberSnapshot, RoleFlags, SpaceNode } from './rules.ts';
import { resolveScopedPromptParts } from './scoped-prompt-parts.ts';
import {
    assertSubstrateContractPassed,
    runCollaborationSubstrateContractTests,
    SUBSTRATE_CONTRACT_VERSION,
    type CollaborationSubstrateContract,
    type SubstrateEnsureSpaceResult,
} from './substrate-contract.ts';

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

describe('CX-10 reusable substrate contract bundle (pure reference substrate)', () => {
    it('passes all 8 scenarios against a compliant reference substrate implementation', async () => {
        const report = await runCollaborationSubstrateContractTests(async ({ ids }): Promise<CollaborationSubstrateContract> => {
            const spacesByAnchorKey = new Map<string, SubstrateEnsureSpaceResult>();
            let spaceSeq = 0;

            const spaces: SpaceNode[] = [
                { id: ids.openGeneralSpaceId, parentId: null, inheritsMembership: false, ownerId: ids.ownerUserId, agentRetrieval: 'Included' },
                { id: ids.sealedChildSpaceId, parentId: ids.openGeneralSpaceId, inheritsMembership: false, ownerId: ids.ownerUserId, agentRetrieval: 'Included' },
                { id: ids.privateChatSpaceId, parentId: null, inheritsMembership: false, ownerId: ids.ownerUserId, agentRetrieval: 'Included' },
                { id: ids.assistantChatSpaceId, parentId: null, inheritsMembership: false, ownerId: ids.ownerUserId, agentRetrieval: 'Included' },
                { id: ids.closedSpaceId, parentId: null, inheritsMembership: false, ownerId: ids.ownerUserId, agentRetrieval: 'Included', closedAt: '2026-01-01T00:00:00Z' },
                { id: ids.ownersOnlyPolicySpaceId, parentId: null, inheritsMembership: false, ownerId: ids.ownerUserId, agentRetrieval: 'Included' },
            ];

            const memberships: MemberSnapshot[] = [
                { spaceId: ids.openGeneralSpaceId, userId: ids.ownerUserId, status: 'Active', band: 'Team', role: OWNER_ROLE },
                { spaceId: ids.openGeneralSpaceId, userId: ids.teamContributorUserId, status: 'Active', band: 'Team', role: TEAM_ROLE },
                { spaceId: ids.openGeneralSpaceId, userId: ids.sharedContributorUserId, status: 'Active', band: 'Shared', role: SHARED_ROLE },
                { spaceId: ids.openGeneralSpaceId, userId: ids.guestReadOnlyUserId, status: 'Active', band: 'Shared', role: GUEST_ROLE },
                { spaceId: ids.privateChatSpaceId, userId: ids.ownerUserId, status: 'Active', band: 'Team', role: OWNER_ROLE },
                { spaceId: ids.privateChatSpaceId, userId: ids.teamContributorUserId, status: 'Active', band: 'Team', role: TEAM_ROLE },
                { spaceId: ids.privateChatSpaceId, userId: ids.sharedContributorUserId, status: 'Active', band: 'Shared', role: SHARED_ROLE },
                { spaceId: ids.assistantChatSpaceId, userId: ids.ownerUserId, status: 'Active', band: 'Team', role: OWNER_ROLE },
                { spaceId: ids.assistantChatSpaceId, userId: ids.teamContributorUserId, status: 'Active', band: 'Team', role: TEAM_ROLE },
                { spaceId: ids.closedSpaceId, userId: ids.ownerUserId, status: 'Active', band: 'Team', role: OWNER_ROLE },
                { spaceId: ids.ownersOnlyPolicySpaceId, userId: ids.ownerUserId, status: 'Active', band: 'Team', role: OWNER_ROLE },
                { spaceId: ids.ownersOnlyPolicySpaceId, userId: ids.teamContributorUserId, status: 'Active', band: 'Team', role: TEAM_ROLE },
            ];

            const chats = new Map<string, ChatWriteSpaceChatSummary>([
                [ids.openGeneralConversationId, { id: 'c1', spaceId: ids.openGeneralSpaceId, kind: 'General', status: 'Active' }],
                [ids.sealedChildConversationId, { id: 'c2', spaceId: ids.sealedChildSpaceId, kind: 'General', status: 'Active' }],
                [ids.privateChatConversationId, { id: 'c3', spaceId: ids.privateChatSpaceId, kind: 'Private', status: 'Active' }],
                [ids.assistantChatConversationId, { id: 'c4', spaceId: ids.assistantChatSpaceId, kind: 'Assistant', status: 'Active', ownerUserId: ids.ownerUserId }],
                [ids.closedSpaceConversationId, { id: 'c5', spaceId: ids.closedSpaceId, kind: 'General', status: 'Active' }],
                [ids.ownersOnlyPolicyConversationId, { id: 'c6', spaceId: ids.ownersOnlyPolicySpaceId, kind: 'General', status: 'Active' }],
                [ids.unknownKindConversationId, { id: 'c7', spaceId: ids.openGeneralSpaceId, kind: 'UnknownCustom', status: 'Active' }],
            ]);

            return {
                contractVersion: SUBSTRATE_CONTRACT_VERSION,
                async ensureSpaceForRecord(req) {
                    const key = `${req.typeCode}|${req.entityName}|${req.recordId}`.toLowerCase();
                    const existing = spacesByAnchorKey.get(key);
                    if (existing) {
                        return { ...existing, created: false };
                    }
                    await Promise.resolve();
                    const winner = spacesByAnchorKey.get(key);
                    if (winner) {
                        return { ...winner, created: false };
                    }
                    spaceSeq += 1;
                    const created: SubstrateEnsureSpaceResult = {
                        spaceId: `90000000-0000-4000-8000-${String(spaceSeq).padStart(12, '0')}`,
                        spaceTypeId: req.typeCode === ids.subtypedTypeCode ? ids.subtypedTypeId : ids.plainTypeId,
                        inheritsMembership: req.inheritsMembership ?? false,
                        ownerUserId: req.callerUserId,
                        ownerSeatAssigned: true,
                        subtypeEntityName: req.typeCode === ids.subtypedTypeCode ? ids.subtypeEntityName : null,
                        anchorRole: req.anchorRole ?? 'primary',
                        created: true,
                    };
                    spacesByAnchorKey.set(key, created);
                    return created;
                },
                async evaluateChatWritePermission(req) {
                    const chat = chats.get(req.conversationId) ?? null;
                    const policies = req.spaceId === ids.ownersOnlyPolicySpaceId ? ['Owners', 'Contributors'] : [];
                    return evaluateSpaceChatWriteRules({
                        callerUserId: req.callerUserId,
                        operation: req.operation,
                        spaceId: req.spaceId,
                        spaceChat: chat,
                        spaces,
                        memberships,
                        policyChain: policies,
                        detailAuthorUserId: req.detailAuthorUserId,
                        detailRole: req.detailRole,
                        isServerAuthoredReply: req.isServerAuthoredReply,
                    });
                },
                async resolveScopedPromptParts(req) {
                    return resolveScopedPromptParts(req.candidates ?? [], {
                        spaceTypeId: req.spaceTypeId,
                        rootSpaceId: req.rootSpaceId,
                        spaceId: req.spaceId,
                        promptId: req.promptId,
                        audience: req.audience,
                        secondaryScopes: req.secondaryScopes,
                    });
                },
            };
        });

        assert.equal(report.passed, true);
        assert.equal(report.totalScenarios, 8);
        assert.equal(report.passedScenarios, 8);
        assertSubstrateContractPassed(report);
    });
});
