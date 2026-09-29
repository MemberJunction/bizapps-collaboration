import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LatestOnly } from './latest-only.ts';
import { guardedLoad, isSelectionCurrent } from './selection-guard.ts';

const SPACE = 'A1B2C3D4-0000-4000-8000-000000000001';

/** The Overview's messages read as the component runs it: newest of its kind, and its space still shown, decided by guardedLoad. */
async function loadOverview(
    guard: LatestOnly,
    state: { requestId: number; activeSpace: string; shown: string[] },
    conversation: string,
    read: () => Promise<string[]>,
): Promise<void> {
    const isLatest = guard.Begin();
    const requestId = state.requestId;
    await guardedLoad(
        () => isLatest() && isSelectionCurrent(requestId, state.requestId, SPACE, state.activeSpace),
        read,
        (rows) => { state.shown = rows.map((row) => `${conversation}:${row}`); },
    );
}

describe('two overlapping reads of the Overview messages', () => {
    it('leaves the newer read on screen when the older read finishes last', async () => {
        const guard = new LatestOnly();
        const state = { requestId: 1, activeSpace: SPACE, shown: [] as string[] };
        let releaseFirst: (rows: string[]) => void = () => undefined;
        const first = loadOverview(guard, state, 'conv-1', () => new Promise<string[]>((resolve) => { releaseFirst = resolve; }));
        await loadOverview(guard, state, 'conv-2', async () => ['newer']);
        releaseFirst(['older']);
        await first;
        assert.deepEqual(state.shown, ['conv-2:newer']);
    });

    it('applies reads that finish in order, each replacing the last', async () => {
        const guard = new LatestOnly();
        const state = { requestId: 1, activeSpace: SPACE, shown: [] as string[] };
        await loadOverview(guard, state, 'conv-1', async () => ['a']);
        await loadOverview(guard, state, 'conv-2', async () => ['b']);
        assert.deepEqual(state.shown, ['conv-2:b']);
    });

    it("writes nothing once the person has moved to another space, even for the newest read", async () => {
        const guard = new LatestOnly();
        const state = { requestId: 1, activeSpace: SPACE, shown: ['kept'] };
        let release: (rows: string[]) => void = () => undefined;
        const pending = loadOverview(guard, state, 'conv-1', () => new Promise<string[]>((resolve) => { release = resolve; }));
        state.requestId = 2;
        state.activeSpace = 'B1B2C3D4-0000-4000-8000-000000000002';
        release(['stale']);
        await pending;
        assert.deepEqual(state.shown, ['kept']);
    });
});
