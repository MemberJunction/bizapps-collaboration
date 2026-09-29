import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openSpaceFile, openUseFields } from './open-file.ts';

const target = { id: 'item-1', fileId: 'file-1' };

describe('opening a library file', () => {
    it('opens the file in the viewer and records the open once', async () => {
        const opened: string[] = [];
        const recorded: string[] = [];
        const outcome = await openSpaceFile(
            { open: (id) => opened.push(id), recordOpen: async (id) => { recorded.push(id); return true; } },
            target,
        );
        assert.deepEqual(outcome, { ok: true, recorded: true });
        assert.deepEqual(opened, ['file-1']);
        assert.deepEqual(recorded, ['item-1']);
    });

    it('still opens when the open could not be recorded, and says it was not', async () => {
        const outcome = await openSpaceFile({ open: () => undefined, recordOpen: async () => false }, target);
        assert.deepEqual(outcome, { ok: true, recorded: false });
    });

    it('says so when the screen has no viewer to open the file in, and records nothing', async () => {
        let recorded = 0;
        const outcome = await openSpaceFile({ open: null, recordOpen: async () => { recorded++; return true; } }, target);
        assert.equal(outcome.ok, false);
        assert.equal(recorded, 0);
    });

    it('opens nothing for an item with no file', async () => {
        let opened = 0;
        const outcome = await openSpaceFile({ open: () => { opened++; }, recordOpen: async () => true }, { id: 'item-2', fileId: null });
        assert.equal(outcome.ok, false);
        assert.equal(opened, 0);
    });
});

describe('the item use an open writes', () => {
    const now = new Date('2026-09-29T00:00:00Z');

    it('names the item, the space, the person and the time', () => {
        assert.deepEqual(openUseFields('item-1', 'space-1', 'user-1', now), { ItemID: 'item-1', SpaceID: 'space-1', UserID: 'user-1', UsedAt: now, Kind: 'open' });
    });

    it('is nothing when the person or the space is not known (never an empty user ID)', () => {
        assert.equal(openUseFields('item-1', 'space-1', '', now), null);
        assert.equal(openUseFields('item-1', null, 'user-1', now), null);
        assert.equal(openUseFields('', 'space-1', 'user-1', now), null);
    });
});
