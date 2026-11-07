import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { notesVisibleTo } from './visible-notes.ts';

const ADA = 'A0000000-0000-4000-8000-000000000001';
const SAM = 'A0000000-0000-4000-8000-000000000002';
const rows = [
    { ID: 'n1', Visibility: 'Space' as const, AuthorUserID: ADA },
    { ID: 'n2', Visibility: 'Private' as const, AuthorUserID: ADA },
    { ID: 'n3', Visibility: 'Private' as const, AuthorUserID: SAM },
];

describe('The notes a viewer is shown', () => {
    it("keeps a space note and the viewer's own private note, and drops another person's private note", () => {
        assert.deepEqual(notesVisibleTo(rows, ADA).map((r) => r.ID), ['n1', 'n2']);
    });

    it('compares the author without regard to case, as MJ ids come back either way', () => {
        assert.deepEqual(notesVisibleTo(rows, ADA.toLowerCase()).map((r) => r.ID), ['n1', 'n2']);
    });

    it('shows a viewer with no id only the space notes', () => {
        assert.deepEqual(notesVisibleTo(rows, null).map((r) => r.ID), ['n1']);
    });
});
