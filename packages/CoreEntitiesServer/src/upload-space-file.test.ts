import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UserInfo } from '@memberjunction/core';
import { uploadSpaceFile, type SpaceFileProvider, type SpaceFileStore } from './upload-space-file.ts';

const USER = { ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE1' } as UserInfo;
const FILES = '33642155-617E-4825-A2CC-F071A60F3739';

function harness(save: boolean): { provider: SpaceFileProvider; store: SpaceFileStore; removed: string[]; item: { SpaceID: string; EntityID: string; RecordID: string; Band: string; Folder: string | null; ID: string } } {
    const removed: string[] = [];
    const item = {
        ID: '',
        SpaceID: '',
        EntityID: '',
        RecordID: '',
        Band: '',
        Folder: null as string | null,
        NewRecord() { return undefined; },
        async Save() {
            this.ID = 'ITEM-1';
            return save;
        },
        LatestResult: { CompleteMessage: 'The signer cannot see this space.' },
    };
    return {
        removed,
        item,
        provider: {
            Entities: [{ Name: 'MJ: Files', ID: FILES }],
            async GetEntityObject() { return item; },
        },
        store: {
            async put() { return { fileId: 'FILE-1' }; },
            async remove(fileId) { removed.push(fileId); },
        },
    };
}

describe('uploadSpaceFile', () => {
    it('stores the file and points one item at it', async () => {
        const { provider, store, item, removed } = harness(true);
        const outcome = await uploadSpaceFile({
            user: USER,
            provider,
            store,
            spaceId: 'SPACE-1',
            folder: 'Deliverables',
            fileName: 'brief.pdf',
            mimeType: 'application/pdf',
            content: Buffer.from('hello'),
        });
        assert.deepEqual(outcome, { ok: true, itemId: 'ITEM-1', fileId: 'FILE-1' });
        assert.equal(item.SpaceID, 'SPACE-1');
        assert.equal(item.EntityID, FILES);
        assert.equal(item.RecordID, 'ID|FILE-1');
        assert.equal(item.Band, 'Team');
        assert.equal(item.Folder, 'Deliverables');
        assert.deepEqual(removed, []);
    });

    it('removes the file when the item is refused', async () => {
        const { provider, store, removed } = harness(false);
        const outcome = await uploadSpaceFile({
            user: USER,
            provider,
            store,
            spaceId: 'SPACE-1',
            folder: null,
            fileName: 'brief.pdf',
            mimeType: 'application/pdf',
            content: Buffer.from('hello'),
        });
        assert.equal(outcome.ok, false);
        assert.deepEqual(removed, ['FILE-1']);
    });

    it('does not store an empty file', async () => {
        const { provider, store, removed } = harness(true);
        let stored = false;
        store.put = async () => {
            stored = true;
            return { fileId: 'FILE-1' };
        };
        const outcome = await uploadSpaceFile({
            user: USER,
            provider,
            store,
            spaceId: 'SPACE-1',
            folder: '   ',
            fileName: '  ',
            mimeType: 'application/pdf',
            content: Buffer.alloc(0),
        });
        assert.equal(outcome.ok, false);
        assert.equal(stored, false);
        assert.deepEqual(removed, []);
    });
});
