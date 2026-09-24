import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { LocalDirectoryStorage } from './dist/world/local-directory-storage.js';

describe('local directory storage', () => {
    it('writes a file and reads the same bytes back', async () => {
        const root = await mkdtemp(join(tmpdir(), 'collab-storage-'));
        try {
            const driver = new LocalDirectoryStorage();
            await driver.initialize({ rootDir: root });
            const body = Buffer.from('field notes');
            assert.equal(await driver.PutObject('notes/field-notes.txt', body, 'text/plain'), true);
            assert.deepEqual(await driver.GetObject({ fullPath: 'notes/field-notes.txt' }), body);
            const meta = await driver.GetObjectMetadata({ fullPath: 'notes/field-notes.txt' });
            assert.equal(meta.contentType, 'text/plain');
            assert.equal(meta.size, body.length);
            assert.equal(await driver.DeleteObject('notes/field-notes.txt'), true);
            assert.equal(await driver.ObjectExists('notes/field-notes.txt'), false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it('refuses a path that leaves the account directory', async () => {
        const root = await mkdtemp(join(tmpdir(), 'collab-storage-'));
        try {
            const driver = new LocalDirectoryStorage();
            await driver.initialize({ rootDir: root });
            await assert.rejects(() => driver.PutObject('../outside.txt', Buffer.from('no'), 'text/plain'));
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
