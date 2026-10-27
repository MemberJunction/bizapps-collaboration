import { type BaseEntity, CompositeKey, LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { SPACE_UPLOAD_MAX_BYTES, storedContentType, type Band } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { recordItemUse } from './library-events.js';
import { releaseStoredFile, vouchStoredFile } from './SpaceItemEntityServer.js';

const FILES = 'MJ: Files';
const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const ARTIFACTS = 'MJ: Artifacts';
const ARTIFACT_VERSIONS = 'MJ: Artifact Versions';
const ARTIFACT_TYPES = 'MJ: Artifact Types';

/**
 * MJ's artifact type for a file, by its extension first (the server stores most uploads as octet-stream) and its media type second.
 * 'Generic Binary' when nothing fits. The names are MJ's shipped artifact types.
 */
export function artifactTypeNameFor(fileName: string, mimeType: string): string {
    const ext = (fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '');
    const mime = (mimeType ?? '').toLowerCase();
    const byExt: Record<string, string> = {
        doc: 'Word Document', docx: 'Word Document', xls: 'Excel Spreadsheet', xlsx: 'Excel Spreadsheet', csv: 'CSV', pdf: 'PDF',
        png: 'Image', jpg: 'Image', jpeg: 'Image', gif: 'Image', webp: 'Image', bmp: 'Image', svg: 'SVG Image', md: 'Markdown Document',
        json: 'JSON', html: 'HTML', htm: 'HTML', xml: 'XML', txt: 'Generic Text', mp3: 'Audio', wav: 'Audio', m4a: 'Audio', mp4: 'Video', mov: 'Video', webm: 'Video',
    };
    if (byExt[ext]) return byExt[ext];
    if (mime.startsWith('image/')) return mime === 'image/svg+xml' ? 'SVG Image' : 'Image';
    if (mime.startsWith('audio/')) return 'Audio';
    if (mime.startsWith('video/')) return 'Video';
    if (mime === 'application/pdf') return 'PDF';
    if (mime === 'application/json') return 'JSON';
    if (mime === 'text/csv') return 'CSV';
    if (mime === 'text/html') return 'HTML';
    if (mime === 'text/markdown') return 'Markdown Document';
    if (mime.startsWith('text/')) return 'Generic Text';
    return 'Generic Binary';
}

const artifactTypeIds = new Map<string, string>();

/** The id of MJ's artifact type of that name, read once per process. */
async function artifactTypeId(provider: IMetadataProvider, user: UserInfo, name: string): Promise<string> {
    const cached = artifactTypeIds.get(name);
    if (cached) return cached;
    const rows = await RunView.FromMetadataProvider(provider).RunView<{ ID: string }>({
        EntityName: ARTIFACT_TYPES,
        ExtraFilter: `Name = '${name.replace(/'/g, "''")}'`,
        Fields: ['ID'],
        ResultType: 'simple',
        MaxRows: 1,
    }, user);
    const id = rows.Success ? rows.Results?.[0]?.ID : undefined;
    if (!id) throw new Error(`MJ has no artifact type named "${name}".`);
    artifactTypeIds.set(name, id);
    return id;
}

/** The Library document as an artifact (the design doc): an Artifact and its first Artifact Version in file mode over the MJ: Files row. */
export interface StoredArtifact {
    artifactId: string;
    versionId: string;
}

async function writeArtifact(request: UploadSpaceFileRequest, stored: StoredSpaceFile, fileName: string): Promise<StoredArtifact> {
    const typeId = await artifactTypeId(request.provider, request.storageUser, artifactTypeNameFor(fileName, request.mimeType));
    const artifact = await request.provider.GetEntityObject<BaseEntity>(ARTIFACTS, request.storageUser);
    artifact.NewRecord();
    artifact.Set('Name', fileName);
    artifact.Set('TypeID', typeId);
    artifact.Set('UserID', request.user.ID);
    if (!(await artifact.Save())) throw new Error(`The artifact was not saved: ${artifact.LatestResult?.CompleteMessage ?? ''}`);
    const version = await request.provider.GetEntityObject<BaseEntity>(ARTIFACT_VERSIONS, request.storageUser);
    version.NewRecord();
    version.Set('ArtifactID', artifact.Get('ID'));
    version.Set('VersionNumber', 1);
    version.Set('Name', fileName);
    version.Set('ContentMode', 'File');
    version.Set('FileID', stored.fileId);
    version.Set('FileName', fileName);
    version.Set('MimeType', storedContentType(request.mimeType));
    version.Set('ContentSizeBytes', request.content.byteLength);
    version.Set('UserID', request.user.ID);
    if (!(await version.Save())) {
        await artifact.Delete();
        throw new Error(`The artifact version was not saved: ${version.LatestResult?.CompleteMessage ?? ''}`);
    }
    return { artifactId: String(artifact.Get('ID')), versionId: String(version.Get('ID')) };
}

async function removeArtifact(request: UploadSpaceFileRequest, artifact: StoredArtifact): Promise<void> {
    try {
        const version = await request.provider.GetEntityObject<BaseEntity>(ARTIFACT_VERSIONS, request.storageUser);
        if (await version.InnerLoad(new CompositeKey([{ FieldName: 'ID', Value: artifact.versionId }]))) await version.Delete();
        const row = await request.provider.GetEntityObject<BaseEntity>(ARTIFACTS, request.storageUser);
        if (await row.InnerLoad(new CompositeKey([{ FieldName: 'ID', Value: artifact.artifactId }]))) await row.Delete();
    } catch (error) {
        LogError(`Space file artifact cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** The bytes and the name. The store writes the MJ: Files row as the storage user. */
export interface SpaceFileUpload {
    content: Uint8Array;
    fileName: string;
    mimeType: string;
    user: UserInfo;
}

export interface StoredSpaceFile {
    fileId: string;
    storagePath: string;
    accountId: string;
}

/** Puts the bytes in MJStorage and can remove that object and its row. */
export interface SpaceFileStore {
    put(input: SpaceFileUpload): Promise<StoredSpaceFile>;
    remove(stored: StoredSpaceFile, user: UserInfo): Promise<boolean>;
}

export interface UploadSpaceFileRequest {
    /** The signed-in member. The space item is saved as this user. */
    user: UserInfo;
    /** The system user. The file row and the storage object are written as this user. */
    storageUser: UserInfo;
    provider: IMetadataProvider;
    store: SpaceFileStore;
    spaceId: string;
    folder: string | null;
    fileName: string;
    mimeType: string;
    content: Uint8Array;
    maxBytes?: number;
    /** Runs before any bytes are stored. Returns the band the item should request. */
    gate: () => Promise<{ ok: true; band: Band } | { ok: false; message: string }>;
}

export type UploadSpaceFileOutcome =
    | { ok: true; itemId: string; fileId: string; artifactVersionId: string }
    | { ok: false; message: string };

/**
 * One operation. The caller is authorized before anything is stored. The file
 * is stored as the system user, then its artifact (an Artifact and a version in
 * file mode over the file row, as the system user, owned by the caller), then the
 * space item is saved as the caller with the version on it. The item subclass is
 * told, in process, that this file was just stored, so the caller does not need
 * create rights on MJ: Files. If the item is refused, the storage object, the file
 * row and the artifact are all removed.
 */
export async function uploadSpaceFile(request: UploadSpaceFileRequest): Promise<UploadSpaceFileOutcome> {
    const fileName = request.fileName.trim();
    const folder = request.folder?.trim() || null;
    const maxBytes = request.maxBytes ?? SPACE_UPLOAD_MAX_BYTES;
    if (!fileName) {
        return { ok: false, message: 'Upload refused: the file needs a name.' };
    }
    if (folder && folder.length > 200) {
        return { ok: false, message: 'Upload refused: a folder name is at most 200 characters.' };
    }
    if (!request.content.byteLength) {
        return { ok: false, message: 'Upload refused: the file is empty.' };
    }
    if (request.content.byteLength > maxBytes) {
        return { ok: false, message: `Upload refused: files are limited to ${maxBytes} bytes.` };
    }
    const decision = await request.gate();
    if (!decision.ok) {
        return { ok: false, message: decision.message };
    }
    const files = request.provider.EntityByName(FILES);
    if (!files) {
        return { ok: false, message: 'Upload refused: MJ: Files is not in this database.' };
    }

    let stored: StoredSpaceFile;
    try {
        stored = await request.store.put({
            content: request.content,
            fileName,
            mimeType: storedContentType(request.mimeType),
            user: request.storageUser,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        LogError(`Space file upload: ${message}`);
        return { ok: false, message };
    }

    let artifact: StoredArtifact;
    try {
        artifact = await writeArtifact(request, stored, fileName);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        LogError(`Space file artifact: ${message}`);
        await removeStored(request, stored);
        return { ok: false, message };
    }

    const item = await request.provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(ITEMS, request.user);
    item.NewRecord();
    item.SpaceID = request.spaceId;
    item.EntityID = files.ID;
    item.RecordID = `ID|${stored.fileId}`;
    item.ArtifactVersionID = artifact.versionId;
    item.Band = decision.band;
    item.Folder = folder;
    vouchStoredFile(item);
    let saved = false;
    try {
        saved = await item.Save();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        LogError(`Space file item: ${message}`);
        await removeArtifact(request, artifact);
        await removeStored(request, stored);
        return { ok: false, message };
    } finally {
        releaseStoredFile(item);
    }
    if (!saved) {
        const message = item.LatestResult?.CompleteMessage || 'Upload refused: the item was not saved.';
        await removeArtifact(request, artifact);
        await removeStored(request, stored);
        return { ok: false, message };
    }
    if (item.ProviderToUse) {
        const recorded = await recordItemUse(item, request.user, item.ID, request.spaceId, 'upload');
        if (!recorded) {
            LogError('The upload was saved, but the item use was not recorded.');
        }
    }
    return { ok: true, itemId: item.ID, fileId: stored.fileId, artifactVersionId: artifact.versionId };
}

async function removeStored(request: UploadSpaceFileRequest, stored: StoredSpaceFile): Promise<void> {
    try {
        const removed = await request.store.remove(stored, request.storageUser);
        if (!removed) {
            LogError(`Space file cleanup incomplete for ${stored.fileId}.`);
        }
    } catch (error) {
        LogError(`Space file cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
}
