import { LogError, type UserInfo } from '@memberjunction/core';

const FILES = 'MJ: Files';
const ITEMS = 'MJ_BizApps_Collaboration: Space Items';

/** The bytes and the name. The store writes the MJ: Files row. */
export interface SpaceFileUpload {
    content: Uint8Array;
    fileName: string;
    mimeType: string;
    user: UserInfo;
}

/** Puts the bytes in MJStorage and can remove that file if the item is refused. */
export interface SpaceFileStore {
    put(input: SpaceFileUpload): Promise<{ fileId: string }>;
    remove(fileId: string, user: UserInfo): Promise<void>;
}

interface ItemRecord {
    NewRecord(): void;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Band: string;
    Folder: string | null;
    ID: string;
    Save(): Promise<boolean>;
    LatestResult?: { CompleteMessage?: string };
}

/** Enough of the metadata provider to register the item against MJ: Files. */
export interface SpaceFileProvider {
    Entities: { Name: string; ID: string }[];
    GetEntityObject(entityName: string, contextUser?: UserInfo): Promise<ItemRecord>;
}

export interface UploadSpaceFileRequest {
    user: UserInfo;
    provider: SpaceFileProvider;
    store: SpaceFileStore;
    spaceId: string;
    folder: string | null;
    fileName: string;
    mimeType: string;
    content: Uint8Array;
}

export type UploadSpaceFileOutcome =
    | { ok: true; itemId: string; fileId: string }
    | { ok: false; message: string };

/**
 * One operation. The file is stored, then the space item is saved.
 * The item's band is a request for Team; the item subclass rewrites it
 * when the caller cannot see that band. If the item is refused, the file
 * is removed so it is not left outside the space.
 */
export async function uploadSpaceFile(request: UploadSpaceFileRequest): Promise<UploadSpaceFileOutcome> {
    const fileName = request.fileName.trim();
    const folder = request.folder?.trim() || null;
    if (!fileName) {
        return { ok: false, message: 'Upload refused: the file needs a name.' };
    }
    if (folder && folder.length > 200) {
        return { ok: false, message: 'Upload refused: a folder name is at most 200 characters.' };
    }
    if (!request.content.length) {
        return { ok: false, message: 'Upload refused: the file is empty.' };
    }
    const files = request.provider.Entities.find((entity) => entity.Name === FILES);
    if (!files) {
        return { ok: false, message: 'Upload refused: MJ: Files is not in this database.' };
    }

    let stored: { fileId: string };
    try {
        stored = await request.store.put({
            content: request.content,
            fileName,
            mimeType: request.mimeType || 'application/octet-stream',
            user: request.user,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        LogError(`Space file upload: ${message}`);
        return { ok: false, message };
    }

    const item = await request.provider.GetEntityObject(ITEMS, request.user);
    item.NewRecord();
    item.SpaceID = request.spaceId;
    item.EntityID = files.ID;
    item.RecordID = `ID|${stored.fileId}`;
    item.Band = 'Team';
    item.Folder = folder;
    let saved = false;
    try {
        saved = await item.Save();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        LogError(`Space file item: ${message}`);
        await removeStored(request, stored.fileId);
        return { ok: false, message };
    }
    if (!saved) {
        const message = item.LatestResult?.CompleteMessage || 'Upload refused: the item was not saved.';
        await removeStored(request, stored.fileId);
        return { ok: false, message };
    }
    return { ok: true, itemId: item.ID, fileId: stored.fileId };
}

async function removeStored(request: UploadSpaceFileRequest, fileId: string): Promise<void> {
    try {
        await request.store.remove(fileId, request.user);
    } catch (error) {
        LogError(`Space file cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
}
