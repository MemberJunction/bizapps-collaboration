import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { railFlags } from './rail-flags.ts';

describe('the space tree', () => {
    it('dims and locks a closed space, and leaves an open one alone', () => {
        assert.deepEqual(railFlags({ ClosedAt: '2026-09-01T00:00:00Z' }), { isDim: true, isLocked: true });
        assert.deepEqual(railFlags({ ClosedAt: null }), { isDim: false, isLocked: false });
        assert.deepEqual(railFlags({}), { isDim: false, isLocked: false });
    });
});
