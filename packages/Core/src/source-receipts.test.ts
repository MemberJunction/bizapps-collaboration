import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    canReaderAccessSourceReceipt,
    extractAndValidateSourceReceipts,
    type SourceReceiptReachContext,
    type ValidatedSuppliedSourceCandidate,
} from './source-receipts.ts';

const SPACE_A = '11111111-1111-4111-8111-111111111111';
const SPACE_B = '22222222-2222-4222-8222-222222222222';
const ITEM_SHARED = 'aaaaaaaa-1111-4111-8111-111111111111';
const ITEM_TEAM = 'bbbbbbbb-1111-4111-8111-111111111111';
const ITEM_OTHER_SPACE = 'cccccccc-1111-4111-8111-111111111111';
const CONTENT_SRC = 'dddddddd-1111-4111-8111-111111111111';
const TARGET_ENTITY = 'eeeeeeee-1111-4111-8111-111111111111';

function buildCandidate(overrides: Partial<ValidatedSuppliedSourceCandidate>): ValidatedSuppliedSourceCandidate {
    return {
        sourceKind: 'SpaceItem',
        spaceId: SPACE_A,
        spaceItemId: ITEM_SHARED,
        contentSourceId: null,
        targetEntityId: TARGET_ENTITY,
        targetRecordId: `ID|${ITEM_SHARED}`,
        sourceTitle: 'Q3 Roadmap Brief',
        band: 'Shared',
        retrievalRank: 1,
        relevanceScore: 0.9125,
        rankingMode: 'lexical',
        estimatedTokens: 120,
        wasTruncated: false,
        ...overrides,
    };
}

describe('Core source receipts domain validation', () => {
    it('tracks supplied vs cited sources accurately for in-reach SpaceItem and KnowledgeSource', () => {
        const reach: SourceReceiptReachContext = {
            chatAudience: 'Team',
            inReachSpaceBands: new Map([
                [SPACE_A, new Set(['Shared', 'Team'] as const)],
            ]),
        };

        const candidates: ValidatedSuppliedSourceCandidate[] = [
            buildCandidate({
                spaceItemId: ITEM_SHARED,
                sourceTitle: 'Q3 Roadmap Brief',
                band: 'Shared',
                retrievalRank: 1,
            }),
            buildCandidate({
                sourceKind: 'KnowledgeSource',
                spaceItemId: null,
                contentSourceId: CONTENT_SRC,
                targetEntityId: null,
                targetRecordId: `ID|${CONTENT_SRC}`,
                sourceTitle: 'Finance Policy Handbook',
                band: 'Team',
                retrievalRank: null,
                relevanceScore: null,
                rankingMode: 'grant',
                estimatedTokens: 0,
            }),
            buildCandidate({
                spaceItemId: ITEM_TEAM,
                sourceTitle: 'Uncited Meeting Deck',
                band: 'Team',
                retrievalRank: 2,
                relevanceScore: 0.45,
            }),
        ];

        const reply = `Per [source:${CONTENT_SRC}] Finance Policy Handbook, see also Q3 Roadmap Brief.`;
        const result = extractAndValidateSourceReceipts(candidates, reply, reach);

        assert.equal(result.rejectedCandidates.length, 0);
        assert.equal(result.rejectedCitations.length, 0);
        assert.equal(result.receipts.length, 3);

        const knowledge = result.receipts.find(r => r.contentSourceId === CONTENT_SRC)!;
        assert.equal(knowledge.wasSupplied, true);
        assert.equal(knowledge.wasCited, true);
        assert.equal(knowledge.citationOrdinal, 1);

        const roadmap = result.receipts.find(r => r.spaceItemId === ITEM_SHARED)!;
        assert.equal(roadmap.wasSupplied, true);
        assert.equal(roadmap.wasCited, true);
        assert.equal(roadmap.citationOrdinal, 2);

        const uncited = result.receipts.find(r => r.spaceItemId === ITEM_TEAM)!;
        assert.equal(uncited.wasSupplied, true);
        assert.equal(uncited.wasCited, false);
        assert.equal(uncited.citationOrdinal, null);
    });

    it('fails closed against Team items in a Shared chat, cross-space items, and hallucinated/injected markers', () => {
        const sharedReach: SourceReceiptReachContext = {
            chatAudience: 'Shared',
            inReachSpaceBands: new Map([
                [SPACE_A, new Set(['Shared', 'Team'] as const)],
            ]),
        };

        const candidates: ValidatedSuppliedSourceCandidate[] = [
            buildCandidate({
                spaceItemId: ITEM_SHARED,
                sourceTitle: 'Public Welcome Note',
                band: 'Shared',
            }),
            buildCandidate({
                spaceItemId: ITEM_TEAM,
                sourceTitle: 'Confidential Layoff Plan',
                band: 'Team',
            }),
            buildCandidate({
                spaceId: SPACE_B,
                spaceItemId: ITEM_OTHER_SPACE,
                sourceTitle: 'Other Space Secret',
                band: 'Shared',
            }),
        ];

        const reply = [
            'Check Public Welcome Note.',
            `Also [source:${ITEM_TEAM}] Confidential Layoff Plan`,
            `and [cite:${ITEM_OTHER_SPACE}] and [source:99999999-9999-4999-8999-999999999999].`,
        ].join(' ');

        const result = extractAndValidateSourceReceipts(candidates, reply, sharedReach);

        assert.equal(result.receipts.length, 1);
        assert.equal(result.receipts[0]?.spaceItemId, ITEM_SHARED);
        assert.equal(result.receipts[0]?.wasCited, true);

        assert.equal(result.rejectedCandidates.length, 2);
        assert.equal(result.rejectedCitations.length, 3);
    });

    it('enforces canReaderAccessSourceReceipt consistently on reads', () => {
        const outsiderReach: SourceReceiptReachContext = {
            chatAudience: 'Shared',
            inReachSpaceBands: new Map([
                [SPACE_A, new Set(['Shared'] as const)],
            ]),
        };
        assert.equal(canReaderAccessSourceReceipt({ spaceId: SPACE_A, band: 'Shared' }, outsiderReach), true);
        assert.equal(canReaderAccessSourceReceipt({ spaceId: SPACE_A, band: 'Team' }, outsiderReach), false);
        assert.equal(canReaderAccessSourceReceipt({ spaceId: SPACE_B, band: 'Shared' }, outsiderReach), false);
    });
});
