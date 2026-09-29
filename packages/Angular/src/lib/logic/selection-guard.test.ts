import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSelectionCurrent } from './selection-guard.ts';

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

describe('a slow read that lands after a fast one', () => {
    /** The shape every loader now follows: read, check the selection, then write. */
    async function load(spaceId: string, requestId: number, state: { requestId: number; active: string; lists: string[] }, read: () => Promise<string[]>): Promise<void> {
        const rows = await read();
        if (!isSelectionCurrent(requestId, state.requestId, spaceId, state.active)) return;
        state.lists = rows;
    }

    it("leaves the newer space's lists alone when the older space's read lands last", async () => {
        const state = { requestId: 1, active: A, lists: [] as string[] };
        let releaseA: (rows: string[]) => void = () => undefined;
        const slowA = load(A, 1, state, () => new Promise<string[]>((resolve) => { releaseA = resolve; }));
        // The person moves to B before A's read returns
        state.requestId = 2;
        state.active = B;
        await load(B, 2, state, async () => ['b-item']);
        releaseA(['a-item']);
        await slowA;
        assert.deepEqual(state.lists, ['b-item']);
    });
});
