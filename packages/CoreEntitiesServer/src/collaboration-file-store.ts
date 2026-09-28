import { LogError, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJFileEntity } from '@memberjunction/core-entities';
import { FileStorageEngine } from '@memberjunction/storage';
import type { SpaceFileStore } from './upload-space-file.js';

/**
 * The store behind UploadSpaceFile. With no account id, MemberJunction uses
 * the host's own active account. The sample loader passes its account id.
 */
export function collaborationFileStore(provider: IMetadataProvider, storageAccountId?: string): SpaceFileStore {
    return {
        async put(upload) {
            await FileStorageEngine.Instance.Config(false, upload.user, provider);
            const accountId = storageAccountId;
            const stored = await FileStorageEngine.Instance.UploadFile({
                content: Buffer.from(upload.content),
                fileName: upload.fileName,
                mimeType: upload.mimeType,
                contextUser: upload.user,
                provider,
                ...(accountId ? { storageAccountId: accountId } : {}),
            });
            return { fileId: stored.FileID, storagePath: stored.StoragePath, accountId: stored.Account.ID };
        },
        async remove(stored, storageUser) {
            return deleteStoredFile(provider, storageUser, stored);
        },
    };
}

async function deleteStoredFile(
    provider: IMetadataProvider,
    user: UserInfo,
    stored: { fileId: string; storagePath: string; accountId: string },
): Promise<boolean> {
    let objectGone = false;
    try {
        await FileStorageEngine.Instance.Config(false, user, provider);
        const driver = await FileStorageEngine.Instance.GetDriver(stored.accountId, user);
        objectGone = await driver.DeleteObject(stored.storagePath);
    } catch (error) {
        LogError(`Space file cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
    let rowGone = false;
    try {
        const file = await provider.GetEntityObject<MJFileEntity>('MJ: Files', user);
        if (await file.Load(stored.fileId)) rowGone = await file.Delete();
    } catch (error) {
        LogError(`Space file row cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!objectGone || !rowGone) LogError(`Space file cleanup incomplete for ${stored.fileId}: object=${objectGone} row=${rowGone}.`);
    return objectGone && rowGone;
}
