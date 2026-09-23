import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FileStorageEngine } from '@memberjunction/storage';
import { collaborationFileStore } from '../dist/collaboration-file-store.js';

describe('collaborationFileStore', () => {
    it('passes no account id, so the host account stays in charge', async () => {
        const engine = FileStorageEngine.Instance;
        const upload = engine.UploadFile.bind(engine);
        const configure = engine.Config.bind(engine);
        let accountId: string | undefined = 'sent';
        engine.Config = async () => undefined;
        engine.UploadFile = async (options) => {
            accountId = options.storageAccountId;
            return { FileID: 'file', StoragePath: 'path', Account: { ID: 'account' }, Provider: { ID: 'provider' } } as Awaited<ReturnType<typeof upload>>;
        };
        try {
            await collaborationFileStore({} as never).put({
                content: new Uint8Array([1]),
                fileName: 'notes.txt',
                mimeType: 'text/plain',
                user: { ID: 'user' } as never,
            });
        } finally {
            engine.UploadFile = upload;
            engine.Config = configure;
        }
        assert.equal(accountId, undefined);
    });
});
