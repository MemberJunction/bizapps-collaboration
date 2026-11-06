import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseTaskSpace } from './task-space.ts';

const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';
const SEALED = 'C1000001-0000-4000-8000-000000000015';
const spaces = [
    { ID: NORTHWIND, Name: 'Northwind relationship' },
    { ID: DISCOVERY, Name: 'Discovery' },
];

describe('the space a task opens in from My tasks', () => {
    it('is the space the task is filed in', () => {
        assert.equal(chooseTaskSpace([{ SpaceID: NORTHWIND, RecordID: 'ID|t1' }], spaces), NORTHWIND);
    });

    it('is the first by name when the task is filed in more than one, the order Home uses', () => {
        const items = [
            { SpaceID: NORTHWIND, RecordID: 'ID|t1' },
            { SpaceID: DISCOVERY, RecordID: 'ID|t1' },
        ];
        assert.equal(chooseTaskSpace(items, spaces), DISCOVERY);
    });

    it('matches a space whatever the casing of its id', () => {
        assert.equal(chooseTaskSpace([{ SpaceID: NORTHWIND.toLowerCase(), RecordID: 'ID|t1' }], spaces), NORTHWIND);
    });

    it('is nothing when none of the task\'s spaces is in the rail', () => {
        assert.equal(chooseTaskSpace([{ SpaceID: SEALED, RecordID: 'ID|t1' }], spaces), null);
        assert.equal(chooseTaskSpace([], spaces), null);
    });
});
