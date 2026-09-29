import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NewSpacePicks } from './new-space-picks.ts';
import { LatestOnly } from './latest-only.ts';

/** A pick that finishes when the test says so. */
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe('the kinds picked in the New space dialog', () => {
    it('lets the last pick win when an earlier one finishes after it', async () => {
        const picks = new NewSpacePicks(new LatestOnly());
        const board = deferred<string>();
        const room = deferred<string>();
        const first = picks.Pick(() => board.promise);
        const second = picks.Pick(() => room.promise);
        room.resolve('room draft');
        board.resolve('board draft');
        assert.deepEqual(await second, { status: 'current', value: 'room draft' });
        assert.deepEqual(await first, { status: 'stale' });
    });

    it('lets the only pick through, and reports its failure', async () => {
        const picks = new NewSpacePicks(new LatestOnly());
        assert.deepEqual(await picks.Pick(async () => 'draft'), { status: 'current', value: 'draft' });
        const boom = new Error('no type');
        assert.deepEqual(await picks.Pick(async () => { throw boom; }), { status: 'failed', error: boom });
    });

    it("drops a pick that fails after a later one started: its error is nobody's to show", async () => {
        const picks = new NewSpacePicks(new LatestOnly());
        const slow = deferred<string>();
        const first = picks.Pick(() => slow.promise);
        const second = picks.Pick(async () => 'second');
        slow.reject(new Error('late failure'));
        assert.deepEqual(await first, { status: 'stale' });
        assert.deepEqual(await second, { status: 'current', value: 'second' });
    });

    it('drops every pick in flight when the dialog is reset, so a draft from an earlier opening never lands in a later one', async () => {
        const picks = new NewSpacePicks(new LatestOnly());
        const slow = deferred<string>();
        const inFlight = picks.Pick(() => slow.promise);
        picks.Reset();
        slow.resolve('draft from the first opening');
        assert.deepEqual(await inFlight, { status: 'stale' });
        assert.deepEqual(await picks.Pick(async () => 'fresh'), { status: 'current', value: 'fresh' });
    });
});
