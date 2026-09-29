import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closeConsequence, type CloseConsequenceRead } from './close-consequence.ts';

const ADA = 'C1000001-0000-4000-8000-0000000000AA';
const BEA = 'C1000001-0000-4000-8000-0000000000BB';
const read = (over: Partial<CloseConsequenceRead>): CloseConsequenceRead => ({ access: 'None', days: null, keeperUserId: ADA, keeperName: 'Ada Owner', keeperCanReopen: true, ...over });

describe('what closing a space does', () => {
    it('says read-only for everyone when access stays', () => {
        assert.equal(closeConsequence(read({ access: 'ReadOnly' }), BEA), 'It becomes read-only for everyone.');
        assert.equal(closeConsequence(read({ access: 'ReadOnlyWithAgent' }), BEA), 'It becomes read-only for everyone.');
    });

    it('names the window, and who keeps the space after it', () => {
        assert.equal(
            closeConsequence(read({ access: 'ReadOnly', days: 30 }), BEA),
            "It becomes read-only for everyone for 30 days. After that it disappears for everyone but Ada Owner, who can reopen it. You won't see it again.",
        );
        assert.match(closeConsequence(read({ access: 'ReadOnly', days: 1 }), ADA), /for 1 day\./);
    });

    it('names the keeper, and tells someone else they will not see the space again', () => {
        assert.equal(closeConsequence(read({}), BEA), "It disappears for everyone but Ada Owner, who can reopen it. You won't see it again.");
    });

    it('says "you" when the viewer is the keeper, whatever the case of the ids', () => {
        assert.equal(closeConsequence(read({}), ADA.toLowerCase()), 'It disappears for everyone but you, who can reopen it.');
    });

    it('says so when the keeper cannot reopen it: no one can, from the app', () => {
        assert.equal(
            closeConsequence(read({ keeperCanReopen: false }), BEA),
            "It disappears for everyone but Ada Owner, who holds no owner seat or lacks the right to reopen it, so no one can reopen it from the app. You won't see it again.",
        );
        assert.match(closeConsequence(read({ keeperCanReopen: false }), ADA), /but you, who holds no owner seat/);
    });

    it('says the server could not answer, rather than guessing', () => {
        assert.match(closeConsequence(null, ADA), /couldn't say what closing does/);
    });
});
