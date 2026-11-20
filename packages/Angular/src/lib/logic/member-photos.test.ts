import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { photosByUser } from './member-photos.ts';

describe("each member's photo", () => {
    it("draws a user's own photo before the one on their People record, as MJ's chat does", () => {
        const photos = photosByUser(
            [{ ID: 'U-ADA', UserImageURL: 'https://example.test/ada-user.jpg' }],
            [{ LinkedUserID: 'u-ada', PhotoURL: 'https://example.test/ada-person.jpg' }],
        );
        assert.equal(photos.get('u-ada'), 'https://example.test/ada-user.jpg');
    });

    it("falls back to the People record's photo for a user with none, and for a user the reader could not read", () => {
        const photos = photosByUser(
            [{ ID: 'u-sam', UserImageURL: null }],
            [
                { LinkedUserID: 'u-sam', PhotoURL: 'https://example.test/sam-person.jpg' },
                { LinkedUserID: 'U-CASEY', PhotoURL: 'https://example.test/casey-person.jpg' },
            ],
        );
        assert.equal(photos.get('u-sam'), 'https://example.test/sam-person.jpg');
        assert.equal(photos.get('u-casey'), 'https://example.test/casey-person.jpg');
    });

    it('leaves a member with no photo anywhere, and a People record no user is linked to, without an entry', () => {
        const photos = photosByUser([{ ID: 'u-bea' }], [{ LinkedUserID: 'u-bea', PhotoURL: null }, { LinkedUserID: null, PhotoURL: 'https://example.test/nobody.jpg' }]);
        assert.equal(photos.size, 0);
    });
});
