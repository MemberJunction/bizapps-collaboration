import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    allowedBandsForSpace,
    hasStructuralChatScopeAccess,
    isStructuralChatScopeBand,
    normalizeChatScopeUuid,
    parseStructuralChatScopeRows,
    toMutableSpaceBandsMap,
    type RawStructuralChatScopeRow,
} from './chat-scope.ts';

const SPACE_A = 'C1000001-0000-4000-8000-000000000001';
const SPACE_B = 'C1000001-0000-4000-8000-000000000002';

describe('chat-scope pure helpers (CS-1)', () => {
    it('returns empty resolution on empty reach and filters malformed UUIDs or invalid bands', () => {
        const empty = parseStructuralChatScopeRows([]);
        assert.deepEqual(empty.pairs, []);
        assert.deepEqual(empty.spaceIds, []);
        assert.equal(empty.bandsBySpaceId.size, 0);
        assert.equal(empty.maxBandBySpaceId.size, 0);
        assert.equal(hasStructuralChatScopeAccess(empty, SPACE_A, 'Shared'), false);
        assert.deepEqual(allowedBandsForSpace(empty, SPACE_A), []);

        const malformed: RawStructuralChatScopeRow[] = [
            { SpaceID: 'not-a-uuid', Band: 'Shared' },
            { SpaceID: SPACE_A, Band: 'Private' },
            { SpaceID: null, Band: 'Team' },
            { SpaceID: SPACE_A, Band: null },
        ];
        const parsedMalformed = parseStructuralChatScopeRows(malformed);
        assert.deepEqual(parsedMalformed.pairs, []);
        assert.deepEqual(parsedMalformed.spaceIds, []);
    });

    it('handles multi-band spaces, PostgreSQL lowercase column folding, deduplication, and deterministic ordering', () => {
        const rows: RawStructuralChatScopeRow[] = [
            { SpaceID: SPACE_B.toUpperCase(), Band: 'Team' },
            { spaceid: SPACE_A.toUpperCase(), band: 'Shared' },
            { space_id: SPACE_B.toLowerCase(), band: 'Shared' },
            { SpaceID: SPACE_B.toLowerCase(), Band: 'Team' },
            { SpaceID: ` ${SPACE_A.toLowerCase()} `, Band: ' Shared ' },
        ];

        const resolution = parseStructuralChatScopeRows(rows);
        assert.deepEqual(resolution.spaceIds, [SPACE_A.toLowerCase(), SPACE_B.toLowerCase()]);
        assert.deepEqual(resolution.pairs, [
            { SpaceID: SPACE_A.toLowerCase(), Band: 'Shared' },
            { SpaceID: SPACE_B.toLowerCase(), Band: 'Shared' },
            { SpaceID: SPACE_B.toLowerCase(), Band: 'Team' },
        ]);

        assert.equal(resolution.maxBandBySpaceId.get(SPACE_A.toLowerCase()), 'Shared');
        assert.equal(resolution.maxBandBySpaceId.get(SPACE_B.toLowerCase()), 'Team');

        assert.equal(hasStructuralChatScopeAccess(resolution, SPACE_A, 'Shared'), true);
        assert.equal(hasStructuralChatScopeAccess(resolution, SPACE_A, 'Team'), false);
        assert.equal(hasStructuralChatScopeAccess(resolution, SPACE_B, 'Shared'), true);
        assert.equal(hasStructuralChatScopeAccess(resolution, SPACE_B, 'Team'), true);
        assert.equal(hasStructuralChatScopeAccess(resolution, 'bad-uuid', 'Shared'), false);

        assert.deepEqual(allowedBandsForSpace(resolution, SPACE_A), ['Shared']);
        assert.deepEqual(allowedBandsForSpace(resolution, SPACE_B), ['Shared', 'Team']);
        assert.deepEqual(allowedBandsForSpace(resolution, 'invalid'), []);

        const mutable = toMutableSpaceBandsMap(resolution);
        assert.deepEqual(Array.from(mutable.get(SPACE_B.toLowerCase()) ?? []).sort(), ['Shared', 'Team']);
    });

    it('validates bands and UUIDs strictly', () => {
        assert.equal(isStructuralChatScopeBand('Shared'), true);
        assert.equal(isStructuralChatScopeBand('Team'), true);
        assert.equal(isStructuralChatScopeBand('shared'), false);
        assert.equal(isStructuralChatScopeBand(null), false);
        assert.equal(normalizeChatScopeUuid(`  ${SPACE_A}  `), SPACE_A.toLowerCase());
        assert.equal(normalizeChatScopeUuid("' OR '1'='1"), null);
    });
});
