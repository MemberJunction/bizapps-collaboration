import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mimeTypeForFileName } from './file-types.ts';

describe('mimeTypeForFileName: the type to record for an upload', () => {
    it('keeps the type the browser reported, without its parameters', () => {
        assert.equal(mimeTypeForFileName('notes.docx', 'application/pdf'), 'application/pdf');
        assert.equal(mimeTypeForFileName('a.csv', 'text/csv; charset=utf-8'), 'text/csv');
    });
    it('reads the extension when the browser reported nothing, whatever its case', () => {
        assert.equal(mimeTypeForFileName('Important Doc.docx', ''), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        assert.equal(mimeTypeForFileName('Deck.PPTX', null), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        assert.equal(mimeTypeForFileName('plan.md', undefined), 'text/markdown');
        assert.equal(mimeTypeForFileName('photo.JPG'), 'image/jpeg');
    });
    it('falls back to octet-stream only for an extension it does not know, or no extension', () => {
        assert.equal(mimeTypeForFileName('archive.7z', ''), 'application/octet-stream');
        assert.equal(mimeTypeForFileName('README', ''), 'application/octet-stream');
        assert.equal(mimeTypeForFileName('', ''), 'application/octet-stream');
    });
});
