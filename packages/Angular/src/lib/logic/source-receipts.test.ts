import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType } from '@mj-biz-apps/collaboration-entities';
import {
    buildClientReceiptReachContext,
    filterAndMapSourceReceipts,
    mergeAnswerSourceReceipts,
    parseTurnSourceReceiptsPayload,
    resolveSourceReceiptOpenTarget,
} from './source-receipts.ts';

const SPACE_A = '11111111-1111-4111-8111-111111111111';
const SPACE_B = '22222222-2222-4222-8222-222222222222';
const SPACE_OUTSIDE = '33333333-3333-4333-8333-333333333333';
const DETAIL_1 = 'aaaa1111-1111-4111-8111-111111111111';
const ITEM_SHARED = 'bbbb1111-1111-4111-8111-111111111111';
const ITEM_TEAM = 'bbbb2222-2222-4222-8222-222222222222';
const CONTENT_SRC = 'cccc1111-1111-4111-8111-111111111111';

function makeEntityRow(overrides: Partial<mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType>): mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType {
    return {
        ID: 'dddd1111-1111-4111-8111-111111111111',
        SpaceID: SPACE_A,
        SpaceChatID: 'eeee1111-1111-4111-8111-111111111111',
        ConversationID: 'ffff1111-1111-4111-8111-111111111111',
        ConversationDetailID: DETAIL_1,
        AgentRunID: null,
        SourceKind: 'SpaceItem',
        SpaceItemID: ITEM_SHARED,
        ContentSourceID: null,
        TargetEntityID: null,
        TargetRecordID: null,
        SourceTitle: 'FY2026 Audit Committee Pack.pdf',
        Band: 'Shared',
        WasSupplied: true,
        WasCited: true,
        RetrievalRank: 1,
        RelevanceScore: 0.92,
        RankingMode: 'lexical',
        CitationOrdinal: 1,
        EstimatedTokens: 280,
        WasTruncated: false,
        Sequence: 1,
        __mj_CreatedAt: new Date(),
        __mj_UpdatedAt: new Date(),
        Space: 'Audit Committee',
        SpaceChat: 'General',
        Conversation: 'General',
        ContentSource: null,
        TargetEntity: null,
        ...overrides,
    };
}

describe('Space chat source receipts client logic (CT-2)', () => {
    it('enforces fail-closed (space, band) filtering on persisted receipts and strips markdown syntax from titles', () => {
        const sharedReach = buildClientReceiptReachContext({
            chatAudience: 'Shared',
            activeSpaceId: SPACE_A,
            canSeeTeamOnActiveSpace: true,
            reachableSpaces: [{ id: SPACE_B, canSeeTeam: true }],
        });

        const rows = [
            makeEntityRow({
                ID: 'r-shared',
                SourceTitle: '### **FY2026 Audit Pack** [source:bbbb1111-1111-4111-8111-111111111111]',
                Band: 'Shared',
            }),
            makeEntityRow({
                ID: 'r-team-leak',
                SpaceItemID: ITEM_TEAM,
                SourceTitle: 'Internal Draft Fee Memo.docx',
                Band: 'Team',
                CitationOrdinal: 2,
            }),
            makeEntityRow({
                ID: 'r-other-space',
                SpaceID: SPACE_OUTSIDE,
                SourceTitle: 'Out of Scope Space Doc.pdf',
                Band: 'Shared',
                CitationOrdinal: 3,
            }),
        ];

        const filtered = filterAndMapSourceReceipts(rows, sharedReach);
        assert.equal(filtered.length, 1);
        assert.equal(filtered[0].id, 'r-shared');
        assert.equal(filtered[0].sourceTitle, 'FY2026 Audit Pack');
        assert.equal(filtered[0].band, 'Shared');
    });

    it('permits both Team and Shared receipts in Team-audience chats for spaces where the caller sees Team', () => {
        const teamReach = buildClientReceiptReachContext({
            chatAudience: 'Team',
            activeSpaceId: SPACE_A,
            canSeeTeamOnActiveSpace: true,
        });

        const rows = [
            makeEntityRow({ ID: 'r1', Band: 'Shared', CitationOrdinal: 1 }),
            makeEntityRow({ ID: 'r2', SpaceItemID: ITEM_TEAM, Band: 'Team', SourceTitle: 'Internal Memo.docx', CitationOrdinal: 2 }),
        ];

        const filtered = filterAndMapSourceReceipts(rows, teamReach);
        assert.equal(filtered.length, 2);
        assert.deepEqual(filtered.map((r) => r.band), ['Shared', 'Team']);
    });

    it('parses SourceReceiptsJSON payload and merges cleanly by ConversationDetailID', () => {
        const reach = buildClientReceiptReachContext({
            chatAudience: 'Shared',
            activeSpaceId: SPACE_A,
            canSeeTeamOnActiveSpace: false,
        });

        const payload = JSON.stringify([
            {
                sourceKind: 'SpaceItem',
                spaceId: SPACE_A,
                spaceItemId: ITEM_SHARED,
                contentSourceId: null,
                targetEntityId: null,
                targetRecordId: null,
                sourceTitle: 'Board Charter.pdf',
                band: 'Shared',
                wasSupplied: true,
                wasCited: true,
                retrievalRank: 1,
                relevanceScore: 0.88,
                rankingMode: 'vector',
                citationOrdinal: 1,
                estimatedTokens: 310,
                wasTruncated: false,
                sequence: 1,
            },
            {
                sourceKind: 'SpaceItem',
                spaceId: SPACE_A,
                spaceItemId: ITEM_TEAM,
                contentSourceId: null,
                targetEntityId: null,
                targetRecordId: null,
                sourceTitle: 'Confidential Team Sheet.xlsx',
                band: 'Team',
                wasSupplied: true,
                wasCited: true,
                retrievalRank: 2,
                relevanceScore: 0.91,
                rankingMode: 'vector',
                citationOrdinal: 2,
                estimatedTokens: 200,
                wasTruncated: false,
                sequence: 2,
            },
        ]);

        const parsed = parseTurnSourceReceiptsPayload(payload, DETAIL_1, reach);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].sourceTitle, 'Board Charter.pdf');
        assert.equal(parsed[0].rankingMode, 'vector');

        const merged = mergeAnswerSourceReceipts(parsed, [
            { ...parsed[0], sourceTitle: 'Board Charter Updated.pdf' },
        ]);
        assert.equal(merged.length, 1);
        assert.equal(merged[0].sourceTitle, 'Board Charter Updated.pdf');
    });

    it('resolves open targets for active-space SpaceItems, cross-space SpaceItems, and KnowledgeSources', () => {
        const libraryRows = [
            { id: ITEM_SHARED, kind: 'pdf', name: 'Board Charter.pdf', folder: 'General', band: 'Shared' as const, who: 'Ada', when: 'Today' },
        ];

        const activeTarget = resolveSourceReceiptOpenTarget({
            id: 'r1',
            conversationDetailId: DETAIL_1,
            spaceId: SPACE_A,
            sourceKind: 'SpaceItem',
            spaceItemId: ITEM_SHARED,
            contentSourceId: null,
            targetEntityId: null,
            targetRecordId: null,
            sourceTitle: 'Board Charter.pdf',
            band: 'Shared',
            wasSupplied: true,
            wasCited: true,
            retrievalRank: 1,
            relevanceScore: 0.9,
            rankingMode: 'lexical',
            citationOrdinal: 1,
            estimatedTokens: 120,
            wasTruncated: false,
            sequence: 1,
        }, SPACE_A, libraryRows, true);
        assert.deepEqual(activeTarget, { kind: 'library-preview', spaceItemId: ITEM_SHARED });

        const crossSpaceTarget = resolveSourceReceiptOpenTarget({
            id: 'r2',
            conversationDetailId: DETAIL_1,
            spaceId: SPACE_B,
            sourceKind: 'SpaceItem',
            spaceItemId: '99999999-1111-4111-8111-111111111111',
            contentSourceId: null,
            targetEntityId: null,
            targetRecordId: null,
            sourceTitle: 'Subspace Memo.docx',
            band: 'Shared',
            wasSupplied: true,
            wasCited: true,
            retrievalRank: 2,
            relevanceScore: 0.75,
            rankingMode: 'lexical',
            citationOrdinal: 2,
            estimatedTokens: 140,
            wasTruncated: false,
            sequence: 2,
        }, SPACE_A, libraryRows, true);
        assert.deepEqual(crossSpaceTarget, {
            kind: 'space-item',
            spaceId: SPACE_B,
            spaceItemId: '99999999-1111-4111-8111-111111111111',
        });

        const knowledgeTarget = resolveSourceReceiptOpenTarget({
            id: 'r3',
            conversationDetailId: DETAIL_1,
            spaceId: SPACE_A,
            sourceKind: 'KnowledgeSource',
            spaceItemId: null,
            contentSourceId: CONTENT_SRC,
            targetEntityId: null,
            targetRecordId: `ID|${CONTENT_SRC}`,
            sourceTitle: 'External Audit Standards KB',
            band: 'Shared',
            wasSupplied: true,
            wasCited: true,
            retrievalRank: null,
            relevanceScore: null,
            rankingMode: 'grant',
            citationOrdinal: 3,
            estimatedTokens: 0,
            wasTruncated: false,
            sequence: 3,
        }, SPACE_A, libraryRows, true);
        assert.deepEqual(knowledgeTarget, {
            kind: 'entity-record',
            entityName: 'MJ: Content Sources',
            recordId: CONTENT_SRC,
        });
    });

    it('rejects malformed or cross-kind-inconsistent entries in parseTurnSourceReceiptsPayload (CR-9)', () => {
        const reach = buildClientReceiptReachContext({
            chatAudience: 'Shared',
            activeSpaceId: SPACE_A,
            canSeeTeamOnActiveSpace: false,
        });

        const payload = JSON.stringify([
            {
                sourceKind: 'SpaceItem',
                spaceId: 'not-a-uuid',
                spaceItemId: ITEM_SHARED,
                contentSourceId: null,
                sourceTitle: 'Bad SpaceID',
                band: 'Shared',
            },
            {
                sourceKind: 'SpaceItem',
                spaceId: SPACE_A,
                spaceItemId: null,
                contentSourceId: null,
                sourceTitle: 'Missing SpaceItemID',
                band: 'Shared',
            },
            {
                sourceKind: 'KnowledgeSource',
                spaceId: SPACE_A,
                spaceItemId: ITEM_SHARED,
                contentSourceId: CONTENT_SRC,
                sourceTitle: 'Cross-Kind Collision',
                band: 'Shared',
            },
            {
                sourceKind: 'SpaceItem',
                spaceId: SPACE_A,
                spaceItemId: ITEM_SHARED,
                contentSourceId: null,
                sourceTitle: '   ',
                band: 'Shared',
            },
            {
                sourceKind: 'KnowledgeSource',
                spaceId: SPACE_A,
                spaceItemId: null,
                contentSourceId: CONTENT_SRC,
                sourceTitle: 'Valid External Guide',
                band: 'Shared',
                wasSupplied: true,
                wasCited: true,
                citationOrdinal: 1,
                rankingMode: 'grant',
                estimatedTokens: 0,
                wasTruncated: false,
                sequence: 1,
            },
        ]);

        const parsed = parseTurnSourceReceiptsPayload(payload, DETAIL_1, reach);
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].sourceKind, 'KnowledgeSource');
        assert.equal(parsed[0].contentSourceId, CONTENT_SRC);
    });
});
