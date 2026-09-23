import { LogError, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { SPACE_UPLOAD_MAX_BYTES, storedContentType, type Band } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { releaseStoredFile, vouchStoredFile } from './SpaceItemEntityServer.js';

const FILES = 'MJ: Files';
const ITEMS = 'MJ_BizApps_Collaboration: Space Items';

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
    | { ok: true; itemId: string; fileId: string }
    | { ok: false; message: string };

/**
 * One operation. The caller is authorized before anything is stored. The file
 * is stored as the system user, then the space item is saved as the caller.
 * The item subclass is told, in process, that this file was just stored, so
 * the caller does not need create rights on MJ: Files. If the item is refused,
 * the storage object and the file row are both removed.
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

    const item = await request.provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(ITEMS, request.user);
    item.NewRecord();
    item.SpaceID = request.spaceId;
    item.EntityID = files.ID;
    item.RecordID = `ID|${stored.fileId}`;
    item.Band = decision.band;
    item.Folder = folder;
    vouchStoredFile(stored.fileId);
    let saved = false;
    try {
        saved = await item.Save();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        LogError(`Space file item: ${message}`);
        await removeStored(request, stored);
        return { ok: false, message };
    } finally {
        releaseStoredFile(stored.fileId);
    }
    if (!saved) {
        const message = item.LatestResult?.CompleteMessage || 'Upload refused: the item was not saved.';
        await removeStored(request, stored);
        return { ok: false, message };
    }
    return { ok: true, itemId: item.ID, fileId: stored.fileId };
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
