import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closeConsequence } from './close-consequence.ts';

describe('what closing a space does', () => {
    it('says read-only for everyone when access stays', () => {
        assert.equal(closeConsequence('ReadOnly', null), 'It becomes read-only for everyone.');
        assert.equal(closeConsequence('ReadOnlyWithAgent', undefined), 'It becomes read-only for everyone.');
    });

    it('names the window, and says who keeps the space after it', () => {
        assert.match(closeConsequence('ReadOnly', 30), /read-only for everyone for 30 days\. After that it disappears for everyone but its owner, who can reopen it\./);
        assert.match(closeConsequence('ReadOnly', 1), /for 1 day\./);
    });

    it('says it disappears for everyone but its owner when there is no post-close access', () => {
        assert.equal(closeConsequence('None', null), 'It disappears for everyone but its owner, who can reopen it.');
        assert.equal(closeConsequence(null, null), 'It disappears for everyone but its owner, who can reopen it.');
    });
});
