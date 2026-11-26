import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    DEFAULT_NOTE_DOCUMENT_FOLDER,
    DEFAULT_NOTE_DOCUMENT_TITLE,
    formatNoteMarkdownDocument,
    MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME,
    NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE,
    NOTE_PROMOTED_AUDIT_LOG_TYPE,
    noteDocument,
    noteFileName,
    notePromotionVerdict,
    noteToArtifactDocument,
    noteTurnIntoDocumentVerdict,
    normalizeNoteDocumentBody,
    normalizeNoteDocumentTitle,
    promotionConsequence,
    resolveNoteDocumentBand,
} from './notes.ts';

const role = (canPromoteBand: boolean) => ({ canPromoteBand, canSeeTeamBand: true });

describe('notePromotionVerdict (call 15)', () => {
    const teamNote = { Band: 'Team' as const, Visibility: 'Space' as const, AuthorUserID: 'A' };
    it('the owner promotes', () => {
        assert.deepEqual(notePromotionVerdict({ userId: 'O', isSpaceOwner: true, role: role(false) }, teamNote), { ok: true });
    });
    it('a seat whose role may promote the band promotes', () => {
        assert.deepEqual(notePromotionVerdict({ userId: 'L', isSpaceOwner: false, role: role(true) }, teamNote), { ok: true });
    });
    it('an administrator promotes without a seat', () => {
        assert.deepEqual(notePromotionVerdict({ userId: 'S', isSpaceOwner: false, role: null, administers: true }, teamNote), { ok: true });
    });
    it('a member may not, nor the author by being the author', () => {
        const verdict = notePromotionVerdict({ userId: 'A', isSpaceOwner: false, role: role(false) }, teamNote);
        assert.equal(verdict.ok, false);
        assert.equal(!verdict.ok && verdict.reason, 'not-allowed');
    });
    it('a private note is not promoted', () => {
        const verdict = notePromotionVerdict({ userId: 'O', isSpaceOwner: true, role: role(true) }, { ...teamNote, Visibility: 'Private' });
        assert.equal(!verdict.ok && verdict.reason, 'private');
    });
    it('a Shared note is not promoted again', () => {
        const verdict = notePromotionVerdict({ userId: 'O', isSpaceOwner: true, role: role(true) }, { ...teamNote, Band: 'Shared' });
        assert.equal(!verdict.ok && verdict.reason, 'already-shared');
    });
    it('the consequence names the audience and says it is not undone', () => {
        assert.equal(NOTE_PROMOTED_AUDIT_LOG_TYPE, 'Collaboration: Note Promoted');
        const text = promotionConsequence({ Title: 'Q3 plan' }, 'Chapter members');
        assert.match(text, /"Q3 plan" will be visible to Chapter members/);
        assert.match(text, /not undone/);
    });
});

describe('noteDocument (backward-compatible helper exports)', () => {
    it('names the file from the title and writes Markdown with the title as its heading', () => {
        const doc = noteDocument({ Title: 'Renewal push: Q3 (draft)', Body: 'Call the lapsed members.\r\n\r\nThen report.' });
        assert.equal(doc.fileName, 'renewal-push-q3-draft.md');
        assert.equal(doc.mimeType, 'text/markdown');
        assert.equal(doc.content, '# Renewal push: Q3 (draft)\n\nCall the lapsed members.\n\nThen report.\n');
    });
    it('an empty body gives the heading alone; an unusable title gives note.md', () => {
        assert.equal(noteDocument({ Title: 'Agenda', Body: null }).content, '# Agenda\n\n');
        assert.equal(noteFileName('???'), 'note.md');
        assert.equal(noteFileName('Café menu'), 'cafe-menu.md');
    });
    it('falls back deterministically to Untitled Note for empty or whitespace-only titles', () => {
        const blank = noteDocument({ Title: '   \t\n  ', Body: '   ' });
        assert.equal(blank.fileName, 'note.md');
        assert.equal(blank.mimeType, 'text/markdown');
        assert.equal(blank.content, `# ${DEFAULT_NOTE_DOCUMENT_TITLE}\n\n`);
    });
});

describe('normalizeNoteDocumentTitle, normalizeNoteDocumentBody, and formatNoteMarkdownDocument', () => {
    it('handles null, undefined, empty, and whitespace-only titles and bodies deterministically', () => {
        assert.equal(normalizeNoteDocumentTitle(null), DEFAULT_NOTE_DOCUMENT_TITLE);
        assert.equal(normalizeNoteDocumentTitle(undefined), DEFAULT_NOTE_DOCUMENT_TITLE);
        assert.equal(normalizeNoteDocumentTitle('   '), DEFAULT_NOTE_DOCUMENT_TITLE);
        assert.equal(normalizeNoteDocumentTitle('   ', 'Custom Fallback'), 'Custom Fallback');
        assert.equal(normalizeNoteDocumentTitle('  ', '   '), DEFAULT_NOTE_DOCUMENT_TITLE);
        assert.equal(normalizeNoteDocumentTitle('  Kickoff Notes  '), 'Kickoff Notes');

        assert.equal(normalizeNoteDocumentBody(null), '');
        assert.equal(normalizeNoteDocumentBody('  \r\n  '), '');
        assert.equal(normalizeNoteDocumentBody('  ', 'Initial summary.\r\nLine two.'), 'Initial summary.\nLine two.');
        assert.equal(normalizeNoteDocumentBody('Line 1\r\nLine 2\rLine 3'), 'Line 1\nLine 2\nLine 3');

        const formatted = formatNoteMarkdownDocument('', '   ', { fallbackTitle: 'Meeting Brief', fallbackBody: 'TBD' });
        assert.deepEqual(formatted, { title: 'Meeting Brief', content: '# Meeting Brief\n\nTBD\n' });
    });
});

describe('resolveNoteDocumentBand and noteToArtifactDocument', () => {
    const spaceId = '22222222-2222-4222-8222-222222222401';
    const noteId = '77777777-7777-4777-8777-777777777401';

    it('inherits Team and Shared bands for Space-visibility notes and locks Private notes to Team', () => {
        assert.equal(resolveNoteDocumentBand({ Band: 'Team', Visibility: 'Space' }), 'Team');
        assert.equal(resolveNoteDocumentBand({ Band: 'Shared', Visibility: 'Space' }), 'Shared');
        assert.equal(resolveNoteDocumentBand({ Band: 'Team', Visibility: 'Private' }), 'Team');
        assert.equal(resolveNoteDocumentBand({ Band: 'Shared', Visibility: 'Private' }), 'Team');
    });

    it('builds native Markdown Document MJ: Artifacts draft for Team-band SpaceNote', () => {
        const draft = noteToArtifactDocument({
            ID: noteId,
            SpaceID: spaceId,
            Title: 'Internal Deal Strategy',
            Body: 'Keep margin floor at 28%.\r\n\r\nConfirm with finance.',
            Band: 'Team',
            Visibility: 'Space',
            AuthorUserID: '11111111-1111-4111-8111-111111111401',
        });
        assert.equal(draft.spaceId, spaceId);
        assert.equal(draft.sourceNoteId, noteId);
        assert.equal(draft.title, 'Internal Deal Strategy');
        assert.equal(draft.content, '# Internal Deal Strategy\n\nKeep margin floor at 28%.\n\nConfirm with finance.\n');
        assert.equal(draft.band, 'Team');
        assert.equal(draft.visibility, 'Space');
        assert.equal(draft.folder, DEFAULT_NOTE_DOCUMENT_FOLDER);
        assert.equal(draft.artifactTypeName, MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME);
        assert.equal(draft.contentMode, NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE);
        assert.equal(draft.mimeType, 'text/markdown');
        assert.equal(draft.fileName, 'internal-deal-strategy.md');
    });

    it('builds native Markdown Document draft for Shared-band SpaceNote with custom folder or null unfiled folder', () => {
        const customFolderDraft = noteToArtifactDocument(
            {
                SpaceID: spaceId,
                Title: 'Kickoff Recap',
                Body: 'Agreed on Phase 1 milestones.',
                Band: 'Shared',
                Visibility: 'Space',
            },
            { folder: 'Deliverables' },
        );
        assert.equal(customFolderDraft.band, 'Shared');
        assert.equal(customFolderDraft.visibility, 'Space');
        assert.equal(customFolderDraft.folder, 'Deliverables');
        assert.equal(customFolderDraft.sourceNoteId, null);

        const unfiledDraft = noteToArtifactDocument(
            {
                SpaceID: spaceId,
                Title: '   ',
                Body: null,
                Band: 'Shared',
                Visibility: 'Space',
            },
            { folder: null },
        );
        assert.equal(unfiledDraft.title, DEFAULT_NOTE_DOCUMENT_TITLE);
        assert.equal(unfiledDraft.content, `# ${DEFAULT_NOTE_DOCUMENT_TITLE}\n\n`);
        assert.equal(unfiledDraft.folder, null);
        assert.equal(unfiledDraft.fileName, 'note.md');
    });

    it('locks Private note drafts to Team band while preserving Visibility=Private', () => {
        const draft = noteToArtifactDocument({
            ID: noteId,
            SpaceID: spaceId,
            Title: 'My Prep Notes',
            Body: 'Call buyer Thursday.',
            Band: 'Shared',
            Visibility: 'Private',
        });
        assert.equal(draft.band, 'Team');
        assert.equal(draft.visibility, 'Private');
    });
});

describe('noteTurnIntoDocumentVerdict', () => {
    const teamContributor = { canSeeTeamBand: true, canContribute: true };
    const teamViewer = { canSeeTeamBand: true, canContribute: false };
    const sharedContributor = { canSeeTeamBand: false, canContribute: true };
    const sharedViewer = { canSeeTeamBand: false, canContribute: false };

    it('allows Team contributor on Team and Shared Space notes', () => {
        assert.deepEqual(
            noteTurnIntoDocumentVerdict(
                { userId: 'u-team', isSpaceOwner: false, role: teamContributor },
                { Band: 'Team', Visibility: 'Space', AuthorUserID: 'u-other' },
            ),
            { ok: true, effectiveBand: 'Team', visibility: 'Space' },
        );
        assert.deepEqual(
            noteTurnIntoDocumentVerdict(
                { userId: 'u-team', isSpaceOwner: false, role: teamContributor },
                { Band: 'Shared', Visibility: 'Space', AuthorUserID: 'u-other' },
            ),
            { ok: true, effectiveBand: 'Shared', visibility: 'Space' },
        );
    });

    it('allows Shared contributor on Shared notes but denies Team notes (band isolation)', () => {
        assert.deepEqual(
            noteTurnIntoDocumentVerdict(
                { userId: 'u-shared', isSpaceOwner: false, role: sharedContributor },
                { Band: 'Shared', Visibility: 'Space', AuthorUserID: 'u-team' },
            ),
            { ok: true, effectiveBand: 'Shared', visibility: 'Space' },
        );
        const denied = noteTurnIntoDocumentVerdict(
            { userId: 'u-shared', isSpaceOwner: false, role: sharedContributor },
            { Band: 'Team', Visibility: 'Space', AuthorUserID: 'u-team' },
        );
        assert.equal(denied.ok, false);
        assert.equal(!denied.ok && denied.reason, 'band-isolated');
    });

    it('restricts Private notes strictly to their author (or space administrator) on the Team band', () => {
        const authorOk = noteTurnIntoDocumentVerdict(
            { userId: 'U-AUTHOR', isSpaceOwner: false, role: teamContributor },
            { Band: 'Team', Visibility: 'Private', AuthorUserID: 'u-author' },
        );
        assert.deepEqual(authorOk, { ok: true, effectiveBand: 'Team', visibility: 'Private' });

        const otherTeamDenied = noteTurnIntoDocumentVerdict(
            { userId: 'u-peer', isSpaceOwner: true, role: teamContributor },
            { Band: 'Team', Visibility: 'Private', AuthorUserID: 'u-author' },
        );
        assert.equal(otherTeamDenied.ok, false);
        assert.equal(!otherTeamDenied.ok && otherTeamDenied.reason, 'not-author');

        const adminAllowed = noteTurnIntoDocumentVerdict(
            { userId: 'u-admin', isSpaceOwner: false, role: null, administers: true },
            { Band: 'Team', Visibility: 'Private', AuthorUserID: 'u-author' },
        );
        assert.deepEqual(adminAllowed, { ok: true, effectiveBand: 'Team', visibility: 'Private' });
    });

    it('refuses outsiders, non-contributors, and read-only spaces fail-closed', () => {
        const readOnly = noteTurnIntoDocumentVerdict(
            { userId: 'u-owner', isSpaceOwner: true, role: teamContributor, spaceReadOnly: true },
            { Band: 'Shared', Visibility: 'Space', AuthorUserID: 'u-owner' },
        );
        assert.equal(readOnly.ok, false);
        assert.equal(!readOnly.ok && readOnly.reason, 'read-only');

        const outsider = noteTurnIntoDocumentVerdict(
            { userId: 'u-out', isSpaceOwner: false, role: null },
            { Band: 'Shared', Visibility: 'Space', AuthorUserID: 'u-owner' },
        );
        assert.equal(outsider.ok, false);
        assert.equal(!outsider.ok && outsider.reason, 'not-allowed');

        const viewerDenied = noteTurnIntoDocumentVerdict(
            { userId: 'u-view', isSpaceOwner: false, role: teamViewer },
            { Band: 'Team', Visibility: 'Space', AuthorUserID: 'u-owner' },
        );
        assert.equal(viewerDenied.ok, false);
        assert.equal(!viewerDenied.ok && viewerDenied.reason, 'not-allowed');

        const sharedViewerDenied = noteTurnIntoDocumentVerdict(
            { userId: 'u-sview', isSpaceOwner: false, role: sharedViewer },
            { Band: 'Shared', Visibility: 'Space', AuthorUserID: 'u-owner' },
        );
        assert.equal(sharedViewerDenied.ok, false);
        assert.equal(!sharedViewerDenied.ok && sharedViewerDenied.reason, 'not-allowed');
    });
});
