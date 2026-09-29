import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closeConsequence, readFromPayload, type CloseConsequenceRead, type CloseConsequenceState } from './close-consequence.ts';

const ADA = 'C1000001-0000-4000-8000-0000000000AA';
const BEA = 'C1000001-0000-4000-8000-0000000000BB';
const read = (over: Partial<CloseConsequenceRead>): CloseConsequenceState => ({
    status: 'read',
    read: { access: 'None', days: null, keeperUserId: ADA, keeperName: 'Ada Owner', keeperCanReopen: true, ...over },
});

describe('what closing a space does', () => {
    it('says read-only for everyone when access stays', () => {
        assert.equal(closeConsequence(read({ access: 'ReadOnly' }), BEA), 'It becomes read-only for everyone.');
    });

    it('says the assistant still answers when access keeps the agent', () => {
        assert.equal(closeConsequence(read({ access: 'ReadOnlyWithAgent' }), BEA), 'It becomes read-only for everyone. The assistant can still answer questions about it.');
    });

    it('names the window, and says the viewer will not see the space after it', () => {
        assert.equal(
            closeConsequence(read({ access: 'ReadOnly', days: 30 }), BEA),
            "It becomes read-only for everyone for 30 days. After that it disappears for everyone but Ada Owner, who can reopen it. After that, you won't see it.",
        );
        assert.match(closeConsequence(read({ access: 'ReadOnly', days: 1 }), ADA), /for 1 day\./);
        assert.doesNotMatch(closeConsequence(read({ access: 'ReadOnly', days: 30 }), ADA), /you won't see it/);
    });

    it('names the keeper, and tells someone else they will not see the space again', () => {
        assert.equal(closeConsequence(read({}), BEA), "It disappears for everyone but Ada Owner, who can reopen it. You won't see it again.");
    });

    it('says "you" when the viewer is the keeper, whatever the case of the ids', () => {
        assert.equal(closeConsequence(read({}), ADA.toLowerCase()), 'It disappears for everyone but you, who can reopen it.');
    });

    it('says so when the keeper cannot reopen it, with the right verb for who the keeper is', () => {
        assert.equal(
            closeConsequence(read({ keeperCanReopen: false }), BEA),
            "It disappears for everyone but Ada Owner, who holds no owner seat or lacks the right to reopen it, so no one can reopen it from the app. You won't see it again.",
        );
        assert.match(closeConsequence(read({ keeperCanReopen: false }), ADA), /but you, who hold no owner seat or lack the right to reopen it/);
    });

    it('says it could not be checked, and does not claim that no one can reopen it', () => {
        const text = closeConsequence(read({ keeperCanReopen: null }), BEA);
        assert.match(text, /could not be checked/);
        assert.doesNotMatch(text, /no one can reopen/);
    });

    it('says it is being worked out while the answer is on its way, and without the old sentence about the owner', () => {
        const text = closeConsequence({ status: 'loading' }, ADA);
        assert.equal(text, 'Working out what closing does to this space…');
    });

    it('says the server could not answer, rather than guessing', () => {
        assert.match(closeConsequence({ status: 'unavailable' }, ADA), /couldn't say what closing does/);
    });
});

describe("reading the server's answer", () => {
    it('accepts the three kinds of access, and nothing else', () => {
        assert.equal(readFromPayload({ Access: 'None', KeeperUserID: ADA, KeeperName: 'Ada' })?.access, 'None');
        assert.equal(readFromPayload({ Access: 'Everything', KeeperUserID: ADA, KeeperName: 'Ada' }), null);
        assert.equal(readFromPayload({ Access: 'None', KeeperName: 'Ada' }), null);
    });

    it('keeps an unchecked right as null, and a window as a number', () => {
        assert.deepEqual(readFromPayload({ Access: 'ReadOnly', Days: 30, KeeperUserID: ADA, KeeperName: 'Ada' }), { access: 'ReadOnly', days: 30, keeperUserId: ADA, keeperName: 'Ada', keeperCanReopen: null });
    });
});
