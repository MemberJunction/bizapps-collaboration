import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CompositeKey } from '@memberjunction/core';
import {
    buildPromotedDocumentLibraryRow,
    buildPromoteSpaceNoteInput,
    evaluateNoteTurnIntoDocument,
    navigateToPromotedArtifactDocument,
    parsePromoteSpaceNotePayload,
    upsertPromotedDocumentRow,
} from './note-to-document.ts';

const SPACE_ID = '11111111-1111-4111-8111-111111111111';
const NOTE_ID = '22222222-2222-4222-8222-222222222222';
const AUTHOR_ID = '33333333-3333-4333-8333-333333333333';
const ARTIFACT_ID = '44444444-4444-4444-8444-444444444444';
const ITEM_ID = '55555555-5555-4555-8555-555555555555';
const VERSION_ID = '66666666-6666-4666-8666-666666666666';

describe('note-to-document pure Angular workspace logic', () => {
    it('normalizes empty/untitled notes and locks Private notes to Team band', () => {
        const built = buildPromoteSpaceNoteInput(SPACE_ID, {
            id: NOTE_ID,
            title: '   ',
            body: 'Line 1\r\nLine 2',
            band: 'Shared',
            visibility: 'Private',
            authorUserId: AUTHOR_ID,
        });
        assert.equal(built.ok, true);
        if (!built.ok) return;
        assert.equal(built.normalizedTitle, 'Untitled Note');
        assert.equal(built.effectiveBand, 'Team');
        assert.equal(built.input.SpaceID, SPACE_ID);
        assert.equal(built.input.NoteID, NOTE_ID);
        assert.equal(built.input.Band, 'Team');
        assert.equal(built.input.Visibility, 'Private');
        assert.equal(built.input.Folder, 'Notes');
    });

    it('rejects missing spaceId cleanly without throwing', () => {
        const built = buildPromoteSpaceNoteInput('  ', {
            id: NOTE_ID,
            title: 'Brief',
            body: 'Body',
            band: 'Team',
            visibility: 'Space',
            authorUserId: AUTHOR_ID,
        });
        assert.equal(built.ok, false);
    });

    it('enforces Core noteTurnIntoDocumentVerdict for read-only, private, and Shared-band participants', () => {
        const denied = evaluateNoteTurnIntoDocument(
            {
                userId: AUTHOR_ID,
                isSpaceOwner: false,
                role: { canSeeTeamBand: false, canContribute: true },
            },
            { band: 'Team', visibility: 'Space', authorUserId: AUTHOR_ID },
        );
        assert.equal(denied.ok, false);

        const allowed = evaluateNoteTurnIntoDocument(
            {
                userId: AUTHOR_ID,
                isSpaceOwner: false,
                role: { canSeeTeamBand: true, canContribute: true },
            },
            { band: 'Team', visibility: 'Private', authorUserId: AUTHOR_ID },
        );
        assert.equal(allowed.ok, true);
    });

    it('parses server payloads fail-closed when incomplete or errored', () => {
        const failed = parsePromoteSpaceNotePayload(
            { Success: false, ErrorMessage: 'Space is closed' },
            'Untitled Note',
            'Team',
            'Space',
            NOTE_ID,
        );
        assert.equal(failed.ok, false);

        const missingIds = parsePromoteSpaceNotePayload(
            { Success: true, ArtifactID: ARTIFACT_ID },
            'Untitled Note',
            'Team',
            'Space',
            NOTE_ID,
        );
        assert.equal(missingIds.ok, false);

        const ok = parsePromoteSpaceNotePayload(
            {
                Success: true,
                SpaceItemID: ITEM_ID,
                ArtifactID: ARTIFACT_ID,
                VersionID: VERSION_ID,
                VersionNumber: 1,
                Title: 'Q4 Briefing',
                Band: 'Shared',
                Visibility: 'Space',
                Folder: 'Notes',
                DelegateEntityID: 'ent-items',
                DelegateRecordID: ITEM_ID,
                ArtifactTypeName: 'Markdown Document',
                ContentMode: 'Text',
                SourceNoteID: NOTE_ID,
            },
            'Q4 Briefing',
            'Shared',
            'Space',
            NOTE_ID,
        );
        assert.equal(ok.ok, true);
        if (!ok.ok) return;
        assert.equal(ok.data.artifactId, ARTIFACT_ID);
        assert.equal(ok.data.spaceItemId, ITEM_ID);
        assert.equal(ok.data.artifactTypeName, 'Markdown Document');
        assert.equal(ok.data.contentMode, 'Text');
    });

    it('routes via NavigationService.OpenArtifact first, then OpenEntityRecord, then slideover fallback', () => {
        const calls: string[] = [];
        const mode1 = navigateToPromotedArtifactDocument(
            { artifactId: ARTIFACT_ID, title: 'Discovery Notes', versionNumber: 1 },
            {
                navigationService: {
                    OpenArtifact: (id, name) => {
                        calls.push(`openArtifact:${id}:${name}`);
                        return 'tab-1';
                    },
                    OpenEntityRecord: () => {
                        calls.push('openEntity');
                        return 'tab-2';
                    },
                },
            },
        );
        assert.equal(mode1, 'navigation-artifact');
        assert.deepEqual(calls, [`openArtifact:${ARTIFACT_ID}:Discovery Notes`]);

        const entityCalls: Array<{ entity: string; id: string }> = [];
        const mode2 = navigateToPromotedArtifactDocument(
            { artifactId: ARTIFACT_ID, title: 'Discovery Notes' },
            {
                navigationService: {
                    OpenEntityRecord: (entity, key: CompositeKey) => {
                        entityCalls.push({ entity, id: String(key.GetValueByFieldName('ID')) });
                        return 'tab-3';
                    },
                },
            },
        );
        assert.equal(mode2, 'navigation-entity');
        assert.deepEqual(entityCalls, [{ entity: 'MJ: Artifacts', id: ARTIFACT_ID }]);

        const slideoverCalls: string[] = [];
        const mode3 = navigateToPromotedArtifactDocument(
            { artifactId: ARTIFACT_ID, title: 'Discovery Notes', versionNumber: 1 },
            {
                navigationService: null,
                openSlideover: (req) => slideoverCalls.push(`${req.artifactId}:${req.canEdit}`),
                canEdit: true,
            },
        );
        assert.equal(mode3, 'slideover');
        assert.deepEqual(slideoverCalls, [`${ARTIFACT_ID}:true`]);
    });

    it('upserts promoted document row at the top of libraryRows cleanly without duplicates', () => {
        const parsed = parsePromoteSpaceNotePayload(
            {
                Success: true,
                SpaceItemID: ITEM_ID,
                ArtifactID: ARTIFACT_ID,
                VersionID: VERSION_ID,
                VersionNumber: 1,
                Title: 'Promoted Note',
                Band: 'Team',
                Visibility: 'Space',
                Folder: 'Notes',
            },
            'Promoted Note',
            'Team',
            'Space',
            NOTE_ID,
        );
        assert.equal(parsed.ok, true);
        if (!parsed.ok) return;
        const row = buildPromotedDocumentLibraryRow(parsed.data, 'Ada Lovell', 'Just now', '2026-11-26T19:00:00Z');
        const updated = upsertPromotedDocumentRow(
            [
                {
                    id: 'other-1',
                    name: 'Existing Deck',
                    folder: 'Deliverables',
                    band: 'Shared',
                    who: 'Sam',
                    when: 'Yesterday',
                    kind: 'ppt',
                },
                {
                    id: ITEM_ID,
                    artifactId: ARTIFACT_ID,
                    name: 'Stale',
                    folder: 'Notes',
                    band: 'Team',
                    who: 'Ada',
                    when: 'Earlier',
                    kind: 'doc',
                },
            ],
            row,
        );
        assert.equal(updated.length, 2);
        assert.equal(updated[0].artifactId, ARTIFACT_ID);
        assert.equal(updated[0].entityName, 'MJ: Artifacts');
        assert.equal(updated[0].name, 'Promoted Note');
    });
});
