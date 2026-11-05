import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { noteDocument, noteFileName, notePromotionVerdict, promotionConsequence } from './notes.ts';

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
        const text = promotionConsequence({ Title: 'Q3 plan' }, 'Chapter members');
        assert.match(text, /"Q3 plan" will be visible to Chapter members/);
        assert.match(text, /not undone/);
    });
});

describe('noteDocument', () => {
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
});
