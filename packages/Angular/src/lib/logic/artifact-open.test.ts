/**
 * SPDX-License-Identifier: BUSL-1.1
 *
 * Pure unit tests for Collaboration's in-place artifact resolution helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    artifactIconClass,
    detectArtifactFileKind,
    extractArtifactIdFromRecordLink,
    isArtifactEntityName,
    parsePinTarget,
} from './artifact-open.ts';
import { resolveSourceReceiptOpenTarget } from './source-receipts.ts';
import type { LibraryRowModel, SpaceChatAnswerSourceReceipt } from '@mj-biz-apps/collaboration-ng-widgets';

const ARTIFACT_ENTITY_ID = 'aa111111-2222-4333-8444-555566667777';

function buildReceipt(overrides: Partial<SpaceChatAnswerSourceReceipt> = {}): SpaceChatAnswerSourceReceipt {
    return {
        id: 'r-1',
        conversationDetailId: 'd-1',
        spaceId: 'sp-1',
        sourceKind: 'SpaceItem',
        spaceItemId: 'si-1',
        contentSourceId: null,
        targetEntityId: null,
        targetRecordId: null,
        sourceTitle: 'Board Presentation',
        band: 'Shared',
        wasSupplied: true,
        wasCited: true,
        retrievalRank: 1,
        relevanceScore: 0.9,
        rankingMode: 'vector',
        citationOrdinal: 1,
        estimatedTokens: 200,
        wasTruncated: false,
        sequence: 1,
        ...overrides,
    };
}

describe('artifact-open pure helpers', () => {
    it('recognizes MJ: Artifacts entity names case-insensitively', () => {
        assert.equal(isArtifactEntityName('MJ: Artifacts'), true);
        assert.equal(isArtifactEntityName('  mj: artifacts '), true);
        assert.equal(isArtifactEntityName('MJ: Files'), false);
        assert.equal(isArtifactEntityName(null), false);
    });

    it('parses pin targets cleanly', () => {
        assert.deepEqual(parsePinTarget('artifact:1111-2222'), { kind: 'artifact', id: '1111-2222' });
        assert.deepEqual(parsePinTarget('item:3333-4444'), { kind: 'item', id: '3333-4444' });
        assert.deepEqual(parsePinTarget('note:5555'), { kind: 'note', id: '5555' });
        assert.deepEqual(parsePinTarget('bare'), { kind: 'bare', id: '' });
    });

    it('maps artifact types and filenames to file kinds and icons', () => {
        assert.equal(detectArtifactFileKind('Deck', 'Presentation'), 'ppt');
        assert.equal(artifactIconClass('Presentation', 'Deck'), 'fa-solid fa-file-powerpoint');
        assert.equal(detectArtifactFileKind('Policy.pdf', 'PDF'), 'pdf');
        assert.equal(artifactIconClass('PDF', 'Policy.pdf'), 'fa-solid fa-file-pdf');
        assert.equal(detectArtifactFileKind('Budget', 'Spreadsheet'), 'xls');
        assert.equal(detectArtifactFileKind('Brief', 'Markdown Document'), 'doc');
        assert.equal(artifactIconClass('Markdown Document', 'Brief'), 'fa-solid fa-file-lines');
    });

    it('extracts Artifact IDs from durable MJ: Artifacts record links and ignores other entities', () => {
        assert.equal(extractArtifactIdFromRecordLink({ entityName: 'MJ: Artifacts', keys: { ID: 'art-1' } }), 'art-1');
        assert.equal(extractArtifactIdFromRecordLink({ entityName: 'mj: artifacts', keys: { id: 'art-2' } }), 'art-2');
        assert.equal(extractArtifactIdFromRecordLink({ entityName: 'MJ: Files', keys: { ID: 'file-1' } }), null);
        assert.equal(extractArtifactIdFromRecordLink({ entityName: 'MJ: Artifacts', keys: {} }), null);
    });

    it('routes SpaceItem source receipts pointing to MJ: Artifacts to artifact-slideover', () => {
        const directTarget = resolveSourceReceiptOpenTarget(
            buildReceipt({
                targetEntityId: ARTIFACT_ENTITY_ID,
                targetRecordId: 'ID|art-direct-1',
                sourceTitle: 'Quarterly Deck',
            }),
            'sp-1',
            [],
            true,
            ARTIFACT_ENTITY_ID,
        );
        assert.deepEqual(directTarget, {
            kind: 'artifact-slideover',
            artifactId: 'art-direct-1',
            title: 'Quarterly Deck',
        });

        const rows: LibraryRowModel[] = [
            {
                id: 'si-1',
                artifactId: 'art-from-row',
                entityName: 'MJ: Artifacts',
                kind: 'doc',
                name: 'Strategy Memo',
                folder: 'General',
                band: 'Shared',
                who: 'Dana',
                when: 'Today',
            },
        ];
        const viaLibraryTarget = resolveSourceReceiptOpenTarget(buildReceipt(), 'sp-1', rows, true, null);
        assert.deepEqual(viaLibraryTarget, {
            kind: 'artifact-slideover',
            artifactId: 'art-from-row',
            title: 'Strategy Memo',
        });
    });
});
