import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJCredentialEntity, MJFileEntity, MJFileStorageAccountEntity, MJFileStorageProviderEntity } from '@memberjunction/core-entities';
import { FileStorageEngine } from '@memberjunction/storage';
import { COLLABORATION_STORAGE_DRIVER_KEY } from './local-directory-storage.js';
import type { SpaceFileStore } from './upload-space-file.js';

export const COLLABORATION_STORAGE_PROVIDER_ID = 'F3000001-0000-4000-8000-000000000001';
export const COLLABORATION_STORAGE_ACCOUNT_ID = 'F3000001-0000-4000-8000-000000000002';

const PROVIDERS = 'MJ: File Storage Providers';
const ACCOUNTS = 'MJ: File Storage Accounts';
const CREDENTIALS = 'MJ: Credentials';
const CREDENTIAL_TYPES = 'MJ: Credential Types';
const CREDENTIAL_NAME = 'Collaboration local directory';
const PROVIDER_NAME = 'Collaboration Local';
const ACCOUNT_NAME = 'Collaboration local';

/**
 * One local account, found again on the next load. The credential holds the
 * directory. It is not a default API key, so other hosts do not pick it up.
 * Returns the account id UploadFile should use.
 */
export async function ensureLocalStorageAccount(
    provider: IMetadataProvider,
    system: UserInfo,
    rootDir: string,
): Promise<string> {
    const root = rootDir.trim();
    if (!root) throw new Error('Local storage needs a directory.');
    const view = RunView.FromMetadataProvider(provider);
    const type = await view.RunView<{ ID: string }>({
        EntityName: CREDENTIAL_TYPES,
        ExtraFilter: `Name = 'API Key'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    const typeId = type.Results?.[0]?.ID;
    if (!type.Success || !typeId) throw new Error('MJ: Credential Types has no API Key type.');

    const credentialId = await ensureCredential(provider, system, typeId, root);
    await ensureProvider(provider, system, root);
    await ensureAccount(provider, system, credentialId);
    await FileStorageEngine.Instance.Config(true, system, provider);
    return COLLABORATION_STORAGE_ACCOUNT_ID;
}

export async function readStoredFile(provider: IMetadataProvider, system: UserInfo, accountId: string, storagePath: string): Promise<Buffer> {
    await FileStorageEngine.Instance.Config(false, system, provider);
    const driver = await FileStorageEngine.Instance.GetDriver(accountId, system);
    return driver.GetObject({ fullPath: storagePath });
}

/** The store UploadSpaceFile uses. The account id is the local directory account. */
export function collaborationFileStore(provider: IMetadataProvider): SpaceFileStore {
    return {
        async put(upload) {
            await FileStorageEngine.Instance.Config(false, upload.user, provider);
            const stored = await FileStorageEngine.Instance.UploadFile({
                content: Buffer.from(upload.content),
                fileName: upload.fileName,
                mimeType: upload.mimeType,
                contextUser: upload.user,
                provider,
                storageAccountId: COLLABORATION_STORAGE_ACCOUNT_ID,
            });
            return { fileId: stored.FileID, storagePath: stored.StoragePath, accountId: stored.Account.ID };
        },
        async remove(stored, storageUser) {
            return deleteStoredFile(provider, storageUser, stored);
        },
    };
}

async function ensureCredential(provider: IMetadataProvider, system: UserInfo, typeId: string, rootDir: string): Promise<string> {
    const view = RunView.FromMetadataProvider(provider);
    const existing = await view.RunView<{ ID: string }>({
        EntityName: CREDENTIALS,
        ExtraFilter: `Name = '${CREDENTIAL_NAME}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!existing.Success) throw new Error(existing.ErrorMessage ?? 'Could not read storage credentials.');
    const values = JSON.stringify({ apiKey: 'local-directory', rootDir });
    const record = await provider.GetEntityObject<MJCredentialEntity>(CREDENTIALS, system);
    if (existing.Results?.[0]?.ID) {
        if (!(await record.Load(existing.Results[0].ID))) throw new Error('Could not load the local storage credential.');
        const current = typeof record.Get('Values') === 'string' ? record.Get('Values') : JSON.stringify(record.Get('Values') ?? {});
        if (!String(current).includes(rootDir)) {
            record.Set('Values', values);
            record.Set('IsDefault', false);
            record.Set('IsActive', true);
            if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not update the local storage credential.');
        }
        return record.Get('ID');
    }
    record.NewRecord();
    record.Set('CredentialTypeID', typeId);
    record.Set('Name', CREDENTIAL_NAME);
    record.Set('Description', 'Directory for Collaboration sample files. Not a cloud credential.');
    record.Set('Values', values);
    record.Set('IsDefault', false);
    record.Set('IsActive', true);
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the local storage credential.');
    return record.Get('ID');
}

async function rowExists(provider: IMetadataProvider, system: UserInfo, entityName: string, id: string): Promise<boolean> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: entityName,
        ExtraFilter: `ID = '${id}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? `Could not read ${entityName}.`);
    return !!rows.Results?.length;
}

async function ensureProvider(provider: IMetadataProvider, system: UserInfo, rootDir: string): Promise<void> {
    const record = await provider.GetEntityObject<MJFileStorageProviderEntity>(PROVIDERS, system);
    if (await rowExists(provider, system, PROVIDERS, COLLABORATION_STORAGE_PROVIDER_ID)) {
        if (!(await record.Load(COLLABORATION_STORAGE_PROVIDER_ID))) throw new Error('Could not load the local storage provider.');
    } else {
        record.NewRecord();
        record.Set('ID', COLLABORATION_STORAGE_PROVIDER_ID);
    }
    record.Set('Name', PROVIDER_NAME);
    record.Set('Description', 'Files for Collaboration, stored in a directory on this host.');
    record.Set('ServerDriverKey', COLLABORATION_STORAGE_DRIVER_KEY);
    record.Set('ClientDriverKey', COLLABORATION_STORAGE_DRIVER_KEY);
    record.Set('Priority', 100);
    record.Set('IsActive', true);
    record.Set('SupportsSearch', false);
    record.Set('RequiresOAuth', false);
    record.Set('Configuration', JSON.stringify({ rootDir }));
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the local storage provider.');
}

async function ensureAccount(provider: IMetadataProvider, system: UserInfo, credentialId: string): Promise<void> {
    const record = await provider.GetEntityObject<MJFileStorageAccountEntity>(ACCOUNTS, system);
    if (await rowExists(provider, system, ACCOUNTS, COLLABORATION_STORAGE_ACCOUNT_ID)) {
        if (!(await record.Load(COLLABORATION_STORAGE_ACCOUNT_ID))) throw new Error('Could not load the local storage account.');
    } else {
        record.NewRecord();
        record.Set('ID', COLLABORATION_STORAGE_ACCOUNT_ID);
    }
    record.Set('Name', ACCOUNT_NAME);
    record.Set('Description', 'The Collaboration sample world stores its files here.');
    record.Set('ProviderID', COLLABORATION_STORAGE_PROVIDER_ID);
    record.Set('CredentialID', credentialId);
    record.Set('IncludeInGlobalSearch', false);
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the local storage account.');
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
