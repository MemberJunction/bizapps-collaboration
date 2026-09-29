import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guardedLoad, isSelectionCurrent } from './selection-guard.ts';

const A = 'A1B2C3D4-0000-4000-8000-000000000001';
const B = 'B1B2C3D4-0000-4000-8000-000000000002';

describe('a load for a selected space', () => {
    it('may write while its selection is the current one, whatever the ID casing', () => {
        assert.equal(isSelectionCurrent(3, 3, A, A.toLowerCase()), true);
    });

    it('may not write once a later selection has started', () => {
        assert.equal(isSelectionCurrent(3, 4, A, A), false);
    });

    it('may not write once the person is in another space, even with the same request number', () => {
        assert.equal(isSelectionCurrent(3, 3, A, B), false);
    });

    it('may not write when no space is active', () => {
        assert.equal(isSelectionCurrent(3, 3, A, ''), false);
        assert.equal(isSelectionCurrent(3, 3, A, null), false);
    });
});

describe('guardedLoad', () => {
    it("leaves the newer space's lists alone when the older space's read lands last", async () => {
        const state = { requestId: 1, active: A, lists: [] as string[] };
        let releaseA: (rows: string[]) => void = () => undefined;
        const slowA = guardedLoad(
            () => isSelectionCurrent(1, state.requestId, A, state.active),
            () => new Promise<string[]>((resolve) => { releaseA = resolve; }),
            (rows) => { state.lists = rows; },
        );
        // The person moves to B before A's read returns
        state.requestId = 2;
        state.active = B;
        await guardedLoad(() => isSelectionCurrent(2, state.requestId, B, state.active), async () => ['b-item'], (rows) => { state.lists = rows; });
        releaseA(['a-item']);
        assert.equal(await slowA, false, 'the stale load did not write');
        assert.deepEqual(state.lists, ['b-item']);
    });

    it('writes when its selection is still the current one', async () => {
        const state = { requestId: 1, active: A, lists: [] as string[] };
        const wrote = await guardedLoad(() => isSelectionCurrent(1, state.requestId, A, state.active), async () => ['a-item'], (rows) => { state.lists = rows; });
        assert.equal(wrote, true);
        assert.deepEqual(state.lists, ['a-item']);
    });

    it('does not write when the read fails, and lets the failure through', async () => {
        let wrote = false;
        await assert.rejects(
            guardedLoad(() => true, async () => { throw new Error('the read failed'); }, () => { wrote = true; }),
            /the read failed/,
        );
        assert.equal(wrote, false);
    });
});
