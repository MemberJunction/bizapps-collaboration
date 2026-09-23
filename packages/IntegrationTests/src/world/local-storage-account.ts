/**
 * The sample world's storage account. The provider stays inactive so a host
 * that also has a cloud account does not pick this directory for other uploads.
 * The loader passes the account id itself.
 */
import { RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJCredentialEntity, MJFileStorageAccountEntity, MJFileStorageProviderEntity } from '@memberjunction/core-entities';
import { FileStorageEngine } from '@memberjunction/storage';
import { COLLABORATION_STORAGE_DRIVER_KEY } from './local-directory-storage.js';

export const COLLABORATION_STORAGE_PROVIDER_ID = 'F3000001-0000-4000-8000-000000000001';
export const COLLABORATION_STORAGE_ACCOUNT_ID = 'F3000001-0000-4000-8000-000000000002';

const PROVIDERS = 'MJ: File Storage Providers';
const ACCOUNTS = 'MJ: File Storage Accounts';
const CREDENTIALS = 'MJ: Credentials';
const CREDENTIAL_TYPES = 'MJ: Credential Types';
const CREDENTIAL_NAME = 'Collaboration local directory';
const PROVIDER_NAME = 'Collaboration Local';
const ACCOUNT_NAME = 'Collaboration local';

export async function ensureLocalStorageAccount(provider: IMetadataProvider, system: UserInfo, rootDir: string): Promise<string> {
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
        const current = typeof record.Values === 'string' ? record.Values : JSON.stringify(record.Values ?? {});
        if (!current.includes(rootDir)) {
            record.Values = values;
            record.IsDefault = false;
            record.IsActive = true;
            if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not update the local storage credential.');
        }
        return record.ID;
    }
    record.NewRecord();
    record.CredentialTypeID = typeId;
    record.Name = CREDENTIAL_NAME;
    record.Description = 'Directory for Collaboration sample files. Not a cloud credential.';
    record.Values = values;
    record.IsDefault = false;
    record.IsActive = true;
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the local storage credential.');
    return record.ID;
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
        record.ID = COLLABORATION_STORAGE_PROVIDER_ID;
    }
    record.Name = PROVIDER_NAME;
    record.Description = 'Files for the Collaboration sample world, stored in a directory on this host.';
    record.ServerDriverKey = COLLABORATION_STORAGE_DRIVER_KEY;
    record.ClientDriverKey = COLLABORATION_STORAGE_DRIVER_KEY;
    record.Priority = 100;
    record.IsActive = false;
    record.SupportsSearch = false;
    record.RequiresOAuth = false;
    record.Configuration = JSON.stringify({ rootDir });
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the local storage provider.');
}

async function ensureAccount(provider: IMetadataProvider, system: UserInfo, credentialId: string): Promise<void> {
    const record = await provider.GetEntityObject<MJFileStorageAccountEntity>(ACCOUNTS, system);
    if (await rowExists(provider, system, ACCOUNTS, COLLABORATION_STORAGE_ACCOUNT_ID)) {
        if (!(await record.Load(COLLABORATION_STORAGE_ACCOUNT_ID))) throw new Error('Could not load the local storage account.');
    } else {
        record.NewRecord();
        record.ID = COLLABORATION_STORAGE_ACCOUNT_ID;
    }
    record.Name = ACCOUNT_NAME;
    record.Description = 'The Collaboration sample world stores its files here.';
    record.ProviderID = COLLABORATION_STORAGE_PROVIDER_ID;
    record.CredentialID = credentialId;
    record.IncludeInGlobalSearch = false;
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the local storage account.');
}
