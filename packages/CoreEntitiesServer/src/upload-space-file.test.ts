import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import type { Band } from '@mj-biz-apps/collaboration-core';
import { uploadSpaceFile, type SpaceFileStore, type StoredSpaceFile } from '../dist/upload-space-file.js';

const USER = { ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE1' } as UserInfo;
const SYSTEM = { ID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE9' } as UserInfo;
const FILES = '33642155-617E-4825-A2CC-F071A60F3739';

function harness(save: boolean, band: Band = 'Team') {
    const removed: StoredSpaceFile[] = [];
    const storedAs: UserInfo[] = [];
    const mimeTypes: string[] = [];
    const item = {
        ID: '',
        SpaceID: '',
        EntityID: '',
        RecordID: '',
        ArtifactVersionID: null as string | null,
        Band: '' as Band,
        Folder: null as string | null,
        NewRecord() { return undefined; },
        async Save() {
            this.ID = 'ITEM-1';
            return save;
        },
        LatestResult: { CompleteMessage: 'The signer cannot see this space.' },
    };
    /** The Library's artifact (the design doc): an Artifact and a version in file mode over the file row, written as the system user. */
    const artifactRows: Array<{ entity: string; values: Record<string, unknown>; as: UserInfo | undefined }> = [];
    const artifactDeletes: string[] = [];
    function artifactRow(entity: string, as: UserInfo | undefined) {
        const values: Record<string, unknown> = {};
        return {
            NewRecord() { return undefined; },
            Set(name: string, value: unknown) { values[name] = value; },
            Get(name: string) { return values[name]; },
            async Save() { values['ID'] = entity === 'MJ: Artifacts' ? 'ARTIFACT-1' : 'VERSION-1'; artifactRows.push({ entity, values, as }); return true; },
            async InnerLoad() { return true; },
            async Delete() { artifactDeletes.push(entity); return true; },
            LatestResult: { CompleteMessage: '' },
        };
    }
    let puts = 0;
    const store: SpaceFileStore = {
        async put(input) {
            puts += 1;
            storedAs.push(input.user);
            mimeTypes.push(input.mimeType);
            return { fileId: 'FILE-1', storagePath: 'artifacts/brief.pdf', accountId: 'ACCOUNT-1' };
        },
        async remove(stored) {
            removed.push(stored);
            return true;
        },
    };
    const provider = {
        EntityByName(name: string) {
            return name === 'MJ: Files' ? { ID: FILES } : undefined;
        },
        async GetEntityObject(entity: string, as?: UserInfo) {
            if (entity === 'MJ: Artifacts' || entity === 'MJ: Artifact Versions') return artifactRow(entity, as);
            return item;
        },
        async RunView(params: { EntityName: string; ExtraFilter?: string }) {
            if (params.EntityName === 'MJ: Artifact Types') return { Success: true, Results: [{ ID: `TYPE:${/Name = '([^']*)'/.exec(params.ExtraFilter ?? '')?.[1] ?? ''}` }] };
            return { Success: true, Results: [] };
        },
    } as unknown as IMetadataProvider;
    return { provider, store, item, removed, storedAs, mimeTypes, puts: () => puts, band, artifactRows, artifactDeletes };
}

const base = {
    spaceId: 'SPACE-1',
    folder: 'Deliverables',
    fileName: 'brief.pdf',
    mimeType: 'application/pdf',
    content: Buffer.from('hello'),
};

describe('uploadSpaceFile', () => {
    it('stores the file as the system user and points one item at the requested band', async () => {
        const { provider, store, item, removed, storedAs, artifactRows } = harness(true, 'Shared');
        const outcome = await uploadSpaceFile({
            user: USER,
            storageUser: SYSTEM,
            provider,
            store,
            ...base,
            gate: async () => ({ ok: true, band: 'Shared' }),
        });
        assert.deepEqual(outcome, { ok: true, itemId: 'ITEM-1', fileId: 'FILE-1', artifactVersionId: 'VERSION-1' });
        assert.equal(item.SpaceID, 'SPACE-1');
        assert.equal(item.EntityID, FILES);
        assert.equal(item.RecordID, 'ID|FILE-1');
        assert.equal(item.ArtifactVersionID, 'VERSION-1');
        // The artifact: MJ's PDF type, owned by the caller, written as the system user; its version in file mode over the file row
        assert.deepEqual(artifactRows.map((row) => row.entity), ['MJ: Artifacts', 'MJ: Artifact Versions']);
        assert.equal(artifactRows[0].values['TypeID'], 'TYPE:PDF');
        assert.equal(artifactRows[0].values['UserID'], USER.ID);
        assert.equal(artifactRows[0].as, SYSTEM);
        assert.deepEqual(
            [artifactRows[1].values['ArtifactID'], artifactRows[1].values['ContentMode'], artifactRows[1].values['FileID'], artifactRows[1].values['FileName'], artifactRows[1].values['ContentSizeBytes']],
            ['ARTIFACT-1', 'File', 'FILE-1', 'brief.pdf', 5],
        );
        assert.equal(item.Band, 'Shared');
        assert.equal(item.Folder, 'Deliverables');
        assert.equal(storedAs[0], SYSTEM);
        assert.deepEqual(removed, []);
    });

    it('does not store bytes when the caller is refused', async () => {
        const { provider, store, puts } = harness(true);
        const outcome = await uploadSpaceFile({
            user: USER,
            storageUser: SYSTEM,
            provider,
            store,
            ...base,
            gate: async () => ({ ok: false, message: 'Upload refused: the signer does not reach this space.' }),
        });
        assert.equal(outcome.ok, false);
        assert.equal(puts(), 0);
    });

    it('removes the stored file and the artifact when the item is refused', async () => {
        const { provider, store, removed, artifactDeletes } = harness(false);
        const outcome = await uploadSpaceFile({
            user: USER,
            storageUser: SYSTEM,
            provider,
            store,
            ...base,
            gate: async () => ({ ok: true, band: 'Team' }),
        });
        assert.equal(outcome.ok, false);
        assert.deepEqual(artifactDeletes, ['MJ: Artifact Versions', 'MJ: Artifacts']);
        assert.equal(removed.length, 1);
        assert.equal(removed[0].fileId, 'FILE-1');
        assert.equal(removed[0].storagePath, 'artifacts/brief.pdf');
    });

    it('does not store an empty file or one over the cap', async () => {
        const { provider, store, puts } = harness(true);
        const empty = await uploadSpaceFile({
            user: USER,
            storageUser: SYSTEM,
            provider,
            store,
            ...base,
            content: Buffer.alloc(0),
            gate: async () => ({ ok: true, band: 'Team' }),
        });
        const huge = await uploadSpaceFile({
            user: USER,
            storageUser: SYSTEM,
            provider,
            store,
            ...base,
            content: Buffer.from('hello'),
            maxBytes: 4,
            gate: async () => ({ ok: true, band: 'Team' }),
        });
        assert.equal(empty.ok, false);
        assert.equal(huge.ok, false);
        assert.equal(puts(), 0);
    });

    it('stores text/html as text/plain', async () => {
        const { provider, store, mimeTypes } = harness(true);
        await uploadSpaceFile({
            user: USER,
            storageUser: SYSTEM,
            provider,
            store,
            ...base,
            mimeType: 'text/html',
            gate: async () => ({ ok: true, band: 'Team' }),
        });
        assert.deepEqual(mimeTypes, ['text/plain']);
    });
});

describe('artifactTypeNameFor', () => {
    it("names MJ's artifact type from the extension first, then the media type, else Generic Binary", async () => {
        const { artifactTypeNameFor } = await import('../dist/upload-space-file.js');
        assert.equal(artifactTypeNameFor('Notes.DOCX', 'application/octet-stream'), 'Word Document');
        assert.equal(artifactTypeNameFor('sheet.xlsx', 'application/octet-stream'), 'Excel Spreadsheet');
        assert.equal(artifactTypeNameFor('brief.pdf', 'application/pdf'), 'PDF');
        assert.equal(artifactTypeNameFor('photo', 'image/png'), 'Image');
        assert.equal(artifactTypeNameFor('readme.md', 'text/markdown'), 'Markdown Document');
        assert.equal(artifactTypeNameFor('data.bin', 'application/octet-stream'), 'Generic Binary');
    });
});
