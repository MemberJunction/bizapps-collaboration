import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    canReaderAccessSourceReceipt,
    extractAndValidateSourceReceipts,
    isReceiptAuthorizedByLiveSources,
    resolveEffectiveKnowledgeSourceBandsBySpace,
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

    it('fails closed for KnowledgeSource when snapshot is unset and resolves 3-level ancestor + ListMode=Replace + SpaceType boundary (CR-1)', () => {
        // Unset knowledgeSourceBandsBySpace must fail closed
        assert.equal(
            isReceiptAuthorizedByLiveSources(
                { spaceId: SPACE_A, sourceKind: 'KnowledgeSource', contentSourceId: CONTENT_SRC, band: 'Shared' },
                {},
            ),
            false,
        );

        const TYPE_A = '10000000-0000-4000-8000-000000000001';
        const TYPE_B = '10000000-0000-4000-8000-000000000002';
        const GP_ID = '20000000-0000-4000-8000-000000000001';
        const P_ID = '20000000-0000-4000-8000-000000000002';
        const LEAF_ID = '20000000-0000-4000-8000-000000000003';
        const P_DIFF_TYPE_ID = '20000000-0000-4000-8000-000000000004';
        const LEAF_RESTART_ID = '20000000-0000-4000-8000-000000000005';
        const LEAF_REPLACE_ID = '20000000-0000-4000-8000-000000000006';

        const KS_REMOVED_GP = '30000000-0000-4000-8000-000000000001';
        const KS_TEAM_GP = '30000000-0000-4000-8000-000000000002';
        const KS_VALID = '30000000-0000-4000-8000-000000000003';
        const KS_REPLACE_ONLY = '30000000-0000-4000-8000-000000000004';

        const spaceTypes = [
            { ID: TYPE_A, Configuration: JSON.stringify({ SpaceOverridable: ['Grants.KnowledgeSource'] }) },
            { ID: TYPE_B, Configuration: null },
        ];
        const spaces = [
            { ID: GP_ID, ParentID: null, SpaceTypeID: TYPE_A, Configuration: null },
            { ID: P_ID, ParentID: GP_ID, SpaceTypeID: TYPE_A, Configuration: null },
            { ID: LEAF_ID, ParentID: P_ID, SpaceTypeID: TYPE_A, Configuration: null },
            { ID: P_DIFF_TYPE_ID, ParentID: GP_ID, SpaceTypeID: TYPE_B, Configuration: null },
            { ID: LEAF_RESTART_ID, ParentID: P_DIFF_TYPE_ID, SpaceTypeID: TYPE_A, Configuration: null },
            {
                ID: LEAF_REPLACE_ID,
                ParentID: P_ID,
                SpaceTypeID: TYPE_A,
                Configuration: JSON.stringify({ Grants: { KnowledgeSource: { ListMode: 'Replace' } } }),
            },
        ];
        const grants = [
            { SpaceID: null, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetRecordID: KS_REMOVED_GP, Sequence: 1 },
            { SpaceID: null, SpaceTypeID: TYPE_A, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetRecordID: KS_TEAM_GP, Sequence: 2 },
            { SpaceID: null, SpaceTypeID: TYPE_A, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetRecordID: KS_VALID, Sequence: 3 },
            { SpaceID: GP_ID, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Remove', Band: 'Shared', TargetRecordID: KS_REMOVED_GP, Sequence: 1 },
            { SpaceID: GP_ID, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Team', TargetRecordID: KS_TEAM_GP, Sequence: 2 },
            { SpaceID: LEAF_REPLACE_ID, SpaceTypeID: null, Kind: 'KnowledgeSource', Mode: 'Extend', Band: 'Shared', TargetRecordID: KS_REPLACE_ONLY, Sequence: 1 },
        ];

        const effective = resolveEffectiveKnowledgeSourceBandsBySpace({
            spaceIds: [LEAF_ID, LEAF_RESTART_ID, LEAF_REPLACE_ID],
            spaces,
            grants,
            spaceTypes,
        });

        // Leaf inherits GP Remove & GP Team override over same-type chain
        assert.equal(effective.get(LEAF_ID)?.get(KS_REMOVED_GP), undefined);
        assert.equal(effective.get(LEAF_ID)?.get(KS_TEAM_GP), 'Team');
        assert.equal(effective.get(LEAF_ID)?.get(KS_VALID), 'Shared');

        // SpaceTypeID boundary restarts the run: GP's Remove/Team does NOT reach LEAF_RESTART_ID
        assert.equal(effective.get(LEAF_RESTART_ID)?.get(KS_REMOVED_GP), 'Shared');
        assert.equal(effective.get(LEAF_RESTART_ID)?.get(KS_TEAM_GP), 'Shared');
        assert.equal(effective.get(LEAF_RESTART_ID)?.get(KS_VALID), 'Shared');

        // ListMode='Replace' cuts off inherited App, SpaceType, and Grandparent grants
        assert.equal(effective.get(LEAF_REPLACE_ID)?.get(KS_VALID), undefined);
        assert.equal(effective.get(LEAF_REPLACE_ID)?.get(KS_REPLACE_ONLY), 'Shared');
    });
});
