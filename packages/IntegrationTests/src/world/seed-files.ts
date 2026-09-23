/**
 * The four library files, written through uploadSpaceFile.
 * Ada's two land on Team. Bea's photo and Lee's page land on Shared,
 * which is what writes the share notices. A file that is already in the
 * space is read back instead of stored again.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { storedContentType } from '@mj-biz-apps/collaboration-core';
import { collaborationFileStore, decideUploadBand, uploadSpaceFile } from '@mj-biz-apps/collaboration-core-entities-server';
import { readCsv } from './csv.js';
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount, readStoredFile } from './local-storage-account.js';

const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const USES = 'MJ_BizApps_Collaboration: Item Uses';
const NOTICES = 'MJ_BizApps_Collaboration: Share Notices';
const FILES = 'MJ: Files';

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
);
const PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
    'utf8',
);

interface CatalogFile {
    Key: string;
    Space: string;
    Uploader: string;
    FileName: string;
    MimeType: string;
    Folder: string;
    Kind: string;
    Band: string;
}

export async function seedWorldFiles(input: {
    provider: IMetadataProvider;
    system: UserInfo;
    actor: (key: string) => UserInfo;
    spaceId: (key: string) => string;
    dataDir: string;
    rootDir: string;
}): Promise<void> {
    const rows = catalogFiles(readCsv(join(input.dataDir, 'files.csv')));
    await ensureLocalStorageAccount(input.provider, input.system, input.rootDir);
    const store = collaborationFileStore(input.provider, COLLABORATION_STORAGE_ACCOUNT_ID);
    for (const row of rows) {
        const spaceId = input.spaceId(row.Space);
        const uploader = input.actor(row.Uploader);
        const content = bytesFor(row);
        const found = await findSeeded(input.provider, input.system, spaceId, row.FileName);
        let itemId = found?.itemId ?? '';
        let fileId = found?.fileId ?? '';
        let storagePath = found?.storagePath ?? '';
        if (!found) {
            const outcome = await uploadSpaceFile({
                user: uploader,
                storageUser: input.system,
                provider: input.provider,
                store,
                spaceId,
                folder: row.Folder,
                fileName: row.FileName,
                mimeType: row.MimeType,
                content,
                gate: () => decideUploadBand(input.provider, uploader, spaceId),
            });
            if (!outcome.ok) throw new Error(`${row.Key}: ${outcome.message}`);
            itemId = outcome.itemId;
            fileId = outcome.fileId;
            const stored = await findSeeded(input.provider, input.system, spaceId, row.FileName);
            if (!stored) throw new Error(`${row.Key} was stored but the space item is not visible.`);
            storagePath = stored.storagePath;
        }
        await assertFile(input, row, spaceId, uploader.ID, itemId, storagePath, content);
    }
}

const FILE_COLUMNS = ['Key', 'Space', 'Uploader', 'FileName', 'MimeType', 'Folder', 'Kind', 'Band'] as const;

function catalogFiles(rows: Array<Record<string, string>>): CatalogFile[] {
    return rows.map((row, index) => {
        for (const column of FILE_COLUMNS) {
            if (!row[column]?.trim()) throw new Error(`files.csv row ${index + 1} is missing ${column}.`);
        }
        return {
            Key: row.Key.trim(),
            Space: row.Space.trim(),
            Uploader: row.Uploader.trim(),
            FileName: row.FileName.trim(),
            MimeType: row.MimeType.trim(),
            Folder: row.Folder.trim(),
            Kind: row.Kind.trim(),
            Band: row.Band.trim(),
        };
    });
}

export function worldStorageRoot(): string {
    const fromEnv = process.env.COLLAB_STORAGE_ROOT?.trim();
    if (fromEnv) return fromEnv;
    return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '.local-storage');
}

function bytesFor(row: CatalogFile): Uint8Array {
    if (row.Kind === 'pdf') return PDF;
    if (row.Kind === 'png') return PNG;
    if (row.Kind === 'text') return Buffer.from(`Field notes for ${row.FileName}.\n`, 'utf8');
    if (row.Kind === 'html') return Buffer.from('<!doctype html><html><body><p>Welcome to the spring cohort.</p></body></html>', 'utf8');
    throw new Error(`${row.Key} has unknown kind ${row.Kind}.`);
}

async function findSeeded(
    provider: IMetadataProvider,
    system: UserInfo,
    spaceId: string,
    fileName: string,
): Promise<{ itemId: string; fileId: string; storagePath: string; band: string; folder: string | null; contentType: string } | null> {
    const view = RunView.FromMetadataProvider(provider);
    const files = await view.RunView<{ ID: string; ContentType: string; ProviderKey: string }>({
        EntityName: FILES,
        ExtraFilter: `Name = '${fileName.replace(/'/g, "''")}'`,
        Fields: ['ID', 'ContentType', 'ProviderKey'],
        ResultType: 'simple',
    }, system);
    if (!files.Success) throw new Error(files.ErrorMessage ?? `Could not read ${fileName}.`);
    const items = await view.RunView<{ ID: string; RecordID: string; Band: string; Folder: string | null }>({
        EntityName: ITEMS,
        ExtraFilter: `SpaceID = '${spaceId}'`,
        Fields: ['ID', 'RecordID', 'Band', 'Folder'],
        ResultType: 'simple',
    }, system);
    if (!items.Success) throw new Error(items.ErrorMessage ?? 'Could not read space items.');
    const matches = (files.Results ?? []).flatMap((file) => {
        const item = (items.Results ?? []).find((candidate) => candidate.RecordID?.toLowerCase() === `id|${file.ID}`.toLowerCase());
        return item ? [{ file, item }] : [];
    });
    if (matches.length > 1) throw new Error(`${fileName} is in that space more than once.`);
    const match = matches[0];
    if (!match) return null;
    return {
        itemId: match.item.ID,
        fileId: match.file.ID,
        storagePath: match.file.ProviderKey,
        band: match.item.Band?.trim() ?? '',
        folder: match.item.Folder,
        contentType: match.file.ContentType,
    };
}

async function assertFile(
    input: { provider: IMetadataProvider; system: UserInfo },
    row: CatalogFile,
    spaceId: string,
    uploaderId: string,
    itemId: string,
    storagePath: string,
    content: Uint8Array,
): Promise<void> {
    const placed = await findSeeded(input.provider, input.system, spaceId, row.FileName);
    if (!placed) throw new Error(`${row.Key} is not in ${row.Space}.`);
    if (placed.band !== row.Band) throw new Error(`${row.Key} is on ${placed.band}. The catalog says ${row.Band}.`);
    if ((placed.folder ?? '') !== row.Folder) throw new Error(`${row.Key} is in folder ${placed.folder}. The catalog says ${row.Folder}.`);
    const storedType = storedContentType(row.MimeType);
    if (placed.contentType !== storedType) throw new Error(`${row.Key} is stored as ${placed.contentType}. It should be ${storedType}.`);
    const bytes = await readStoredFile(input.provider, input.system, COLLABORATION_STORAGE_ACCOUNT_ID, storagePath || placed.storagePath);
    if (Buffer.compare(Buffer.from(bytes), Buffer.from(content)) !== 0) throw new Error(`${row.Key} did not read back the bytes that were stored.`);
    const view = RunView.FromMetadataProvider(input.provider);
    const uses = await view.RunView<{ ID: string }>({
        EntityName: USES,
        ExtraFilter: `ItemID = '${itemId || placed.itemId}' AND UserID = '${uploaderId}' AND Kind = 'upload'`,
        Fields: ['ID'],
        MaxRows: 5,
        ResultType: 'simple',
    }, input.system);
    if (!uses.Success || !uses.Results?.length) throw new Error(`${row.Key} has no upload item use.`);
    const notices = await view.RunView<{ RecipientUserID: string }>({
        EntityName: NOTICES,
        ExtraFilter: `ItemID = '${itemId || placed.itemId}'`,
        Fields: ['RecipientUserID'],
        ResultType: 'simple',
    }, input.system);
    if (!notices.Success) throw new Error(notices.ErrorMessage ?? `${row.Key} notices could not be read.`);
    const recipients = notices.Results ?? [];
    if (row.Band === 'Team' && recipients.length) throw new Error(`${row.Key} is on Team and has ${recipients.length} share notices.`);
    if (row.Band === 'Shared' && !recipients.length) throw new Error(`${row.Key} is Shared and has no share notice.`);
    if (recipients.some((notice) => notice.RecipientUserID.toLowerCase() === uploaderId.toLowerCase())) {
        throw new Error(`${row.Key} notified the person who uploaded it.`);
    }
}


