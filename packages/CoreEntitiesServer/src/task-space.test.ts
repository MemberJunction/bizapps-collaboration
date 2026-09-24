import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { relevantFieldsChanged } from '../dist/task-space.js';

describe('relevantFieldsChanged', () => {
    it('checks a new record, and a saved record only when a named field is dirty', () => {
        assert.equal(relevantFieldsChanged({ IsSaved: false, Fields: [] }, ['TaskID']), true);
        assert.equal(relevantFieldsChanged({
            IsSaved: true,
            Fields: [{ Name: 'Status', Dirty: true }, { Name: 'TaskID', Dirty: false }],
        }, ['TaskID', 'AssigneeEntityID', 'AssigneeRecordID']), false);
        assert.equal(relevantFieldsChanged({
            IsSaved: true,
            Fields: [{ Name: 'AssigneeRecordID', Dirty: true }],
        }, ['TaskID', 'AssigneeEntityID', 'AssigneeRecordID']), true);
    });
});
