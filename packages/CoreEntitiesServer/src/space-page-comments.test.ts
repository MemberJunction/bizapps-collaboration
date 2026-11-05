import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { authorInitials, hasTeamComment, stampCommentAuthors } from '../dist/space-page-comments.js';

const payload = (comments: unknown[]): string => JSON.stringify({ blocks: [], comments });
const ADA = { name: 'Ada Lovelace', initials: 'AL' };

describe('hasTeamComment', () => {
    it('finds a Team comment, and only that', () => {
        assert.equal(hasTeamComment(payload([{ id: 'a', band: 'Shared' }, { id: 'b', band: 'Team' }])), true);
        assert.equal(hasTeamComment(payload([{ id: 'a', band: 'Shared' }])), false);
    });

    it('sees no comments in an empty, legacy (blocks array) or unreadable payload', () => {
        assert.equal(hasTeamComment(null), false);
        assert.equal(hasTeamComment('[{"id":"blk"}]'), false);
        assert.equal(hasTeamComment('{not json'), false);
    });
});

describe('stampCommentAuthors', () => {
    it("sets a new comment's author to the saving user, whatever the client claimed", () => {
        const raw = payload([{ id: 'new', band: 'Shared', authorName: 'The CEO', authorInitials: 'CE', body: 'hi' }]);
        const out = JSON.parse(stampCommentAuthors(raw, [null], ADA) as string);
        assert.deepEqual(out.comments[0], { id: 'new', band: 'Shared', authorName: 'Ada Lovelace', authorInitials: 'AL', body: 'hi' });
    });

    it("keeps a stored comment's author when a later save rewrites it", () => {
        const before = payload([{ id: 'old', authorName: 'Bea Client', authorInitials: 'BC' }]);
        const raw = payload([{ id: 'old', authorName: 'Ada Lovelace', authorInitials: 'AL', status: 'Resolved' }]);
        const out = JSON.parse(stampCommentAuthors(raw, [null, before], ADA) as string);
        assert.deepEqual(out.comments[0], { id: 'old', authorName: 'Bea Client', authorInitials: 'BC', status: 'Resolved' });
    });

    it('returns the payload untouched when every author is already right, or there is no payload', () => {
        const raw = payload([{ id: 'new', authorName: 'Ada Lovelace', authorInitials: 'AL' }]);
        assert.equal(stampCommentAuthors(raw, [], ADA), raw);
        assert.equal(stampCommentAuthors(null, [], ADA), null);
        assert.equal(stampCommentAuthors('[{"id":"blk"}]', [], ADA), '[{"id":"blk"}]');
    });
});

describe('authorInitials', () => {
    it('takes the first letter of the first two words, as the client does', () => {
        assert.equal(authorInitials('Ada Lovelace King'), 'AL');
        assert.equal(authorInitials(''), 'ME');
    });
});
