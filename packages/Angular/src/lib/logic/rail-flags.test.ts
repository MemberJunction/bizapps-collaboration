import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { railFlags, railModeFor } from './rail-flags.ts';

describe('the space tree', () => {
    it('dims and locks a closed space, and leaves an open one alone', () => {
        assert.deepEqual(railFlags({ ClosedAt: '2026-09-01T00:00:00Z' }), { isDim: true, isLocked: true });
        assert.deepEqual(railFlags({ ClosedAt: null }), { isDim: false, isLocked: false });
        assert.deepEqual(railFlags({}), { isDim: false, isLocked: false });
    });
});

describe('the rail mode follows the page', () => {
    it('keeps the home rail on Home, Inbox, My tasks and Recent files', () => {
        for (const view of ['home', 'inbox', 'tasks', 'files']) assert.equal(railModeFor(view), 'home', view);
    });

    it('shows the space rail on a space', () => {
        assert.equal(railModeFor('space'), 'space');
    });
});
