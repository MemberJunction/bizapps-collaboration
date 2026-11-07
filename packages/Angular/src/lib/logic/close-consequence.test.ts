import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closeConsequence, readFromPayload, type CloseConsequenceRead, type CloseConsequenceState } from './close-consequence.ts';

const ADA = 'AAAAAAAA-0000-4000-8000-000000000001';
const BEA = 'AAAAAAAA-0000-4000-8000-000000000002';
const read = (over: Partial<CloseConsequenceRead> = {}): CloseConsequenceState => ({
    status: 'read',
    read: { statusCode: 'closed', statusName: 'Closed', readOnly: true, visible: true, agentRetrieval: true, keeperUserId: ADA, keeperName: 'Ada Owner', keeperCanReopen: false, ...over },
});

describe('what closing does, in words', () => {
    it('names the status the close moves to, says it is read-only for everyone, and that Closed moves forward only', () => {
        assert.equal(
            closeConsequence(read(), BEA),
            'Closed: it becomes read-only for everyone. The assistant can still answer questions about it. Closed moves forward only, so nobody brings it back from the app.',
        );
    });

    it('leaves the assistant out when the status allows no agent retrieval, and says who can bring it back when someone can', () => {
        assert.equal(closeConsequence(read({ agentRetrieval: false, keeperCanReopen: true }), BEA), 'Closed: it becomes read-only for everyone. Ada Owner can bring it back.');
        assert.equal(closeConsequence(read({ agentRetrieval: false, keeperCanReopen: true }), ADA), 'Closed: it becomes read-only for everyone. You can bring it back.');
    });

    it("says a hidden status disappears for everyone but the keeper, and tells the viewer they won't see it", () => {
        const hidden = read({ statusCode: 'archived', statusName: 'Archived', visible: false, agentRetrieval: false });
        assert.equal(closeConsequence(hidden, BEA), "Archived: it disappears for everyone but Ada Owner. Archived moves forward only, so nobody brings it back from the app. You won't see it again.");
        assert.doesNotMatch(closeConsequence(hidden, ADA), /won't see it/);
    });

    it('says when the check of the right could not be made, and reads a type with no statuses as read-only and visible', () => {
        assert.match(closeConsequence(read({ keeperCanReopen: null }), BEA), /could not be checked/);
        assert.equal(closeConsequence(read({ statusCode: null, statusName: null }), BEA), 'It becomes read-only for everyone. The assistant can still answer questions about it. A closed space moves forward only, so nobody brings it back from the app.');
    });

    it('has words for the read in progress and for a server that could not answer', () => {
        assert.match(closeConsequence({ status: 'loading' }, BEA), /Working out/);
        assert.match(closeConsequence({ status: 'unavailable' }, BEA), /couldn't say/);
    });
});

describe('reading the server\'s payload', () => {
    it('needs a keeper, and takes the status and its attributes as given, with defaults for a type that names none', () => {
        assert.equal(readFromPayload({ StatusCode: 'closed', KeeperName: 'Ada' }), null);
        assert.deepEqual(readFromPayload({ KeeperUserID: ADA, KeeperName: 'Ada' }), { statusCode: null, statusName: null, readOnly: true, visible: true, agentRetrieval: true, keeperUserId: ADA, keeperName: 'Ada', keeperCanReopen: null });
        assert.deepEqual(
            readFromPayload({ StatusCode: 'archived', StatusName: 'Archived', ReadOnly: true, Visible: false, AgentRetrieval: false, KeeperUserID: ADA, KeeperName: 'Ada', KeeperCanReopen: false }),
            { statusCode: 'archived', statusName: 'Archived', readOnly: true, visible: false, agentRetrieval: false, keeperUserId: ADA, keeperName: 'Ada', keeperCanReopen: false },
        );
    });
});
