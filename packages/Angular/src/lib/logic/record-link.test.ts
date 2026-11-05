import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recordLinkKeyPairs } from './record-link.ts';

describe('a record link read against the entity primary key', () => {
    it('takes one value per key field, composite keys included', () => {
        assert.deepEqual(recordLinkKeyPairs({ ID: 'task-9' }, ['ID']), [{ FieldName: 'ID', Value: 'task-9' }]);
        assert.deepEqual(recordLinkKeyPairs({ OrderID: 'ord-1', LineNumber: 4 }, ['OrderID', 'LineNumber']), [
            { FieldName: 'OrderID', Value: 'ord-1' },
            { FieldName: 'LineNumber', Value: '4' },
        ]);
    });

    it('lets a lowercase id stand in for ID, and ignores fields that are not part of the key', () => {
        assert.deepEqual(recordLinkKeyPairs({ id: 'k', Status: 'Open' }, ['ID']), [{ FieldName: 'ID', Value: 'k' }]);
    });

    it('opens nothing for an entity with no key fields (an unknown entity) or a link missing part of its key', () => {
        assert.equal(recordLinkKeyPairs({ ID: 'task-9' }, []), null);
        assert.equal(recordLinkKeyPairs({ OrderID: 'ord-1' }, ['OrderID', 'LineNumber']), null);
        assert.equal(recordLinkKeyPairs({ ID: '' }, ['ID']), null);
    });
});
