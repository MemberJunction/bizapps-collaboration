import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildConversationEntries, chooseActiveConversation } from './conversation-list.ts';

const A = 'A1B2C3D4-0000-4000-8000-000000000001';
const B = 'B1B2C3D4-0000-4000-8000-000000000002';

describe('the rail conversation list', () => {
    it('lists each conversation once, whatever the casing of its ID', () => {
        const entries = buildConversationEntries([
            { ConversationID: A, Name: 'general', Kind: 'General' },
            { ConversationID: A.toLowerCase(), Name: 'general', Kind: 'General' },
            { ConversationID: B, Name: 'internal', Kind: 'Private' },
        ]);
        assert.deepEqual(entries.map((e) => e.name), ['general', 'internal']);
    });

    it('puts an internal conversation on the Team band and the rest on Shared', () => {
        const entries = buildConversationEntries([
            { ConversationID: A, Name: 'a', Kind: 'Private' },
            { ConversationID: B, Name: 'b', Kind: 'Topic' },
        ]);
        assert.deepEqual(entries.map((e) => e.band), ['Team', 'Shared']);
    });

    it('skips a row with no conversation and names an unnamed one General', () => {
        const entries = buildConversationEntries([
            { ConversationID: '', Name: 'gone', Kind: 'General' },
            { ConversationID: A, Name: null, Kind: null },
        ]);
        assert.equal(entries.length, 1);
        assert.equal(entries[0].name, 'General');
        assert.equal(entries[0].kind, 'General');
    });
});

describe('choosing the open conversation', () => {
    const entries = buildConversationEntries([
        { ConversationID: A, Name: 'a', Kind: 'General' },
        { ConversationID: B, Name: 'b', Kind: 'General' },
    ]);

    it('opens the one asked for, matched as a UUID', () => {
        assert.equal(chooseActiveConversation(entries, B.toLowerCase())?.id, B);
    });

    it('opens the first when the one asked for is not in this space', () => {
        assert.equal(chooseActiveConversation(entries, 'C1B2C3D4-0000-4000-8000-000000000003')?.id, A);
    });

    it('opens nothing when the space has no conversation', () => {
        assert.equal(chooseActiveConversation([], A), null);
    });
});
