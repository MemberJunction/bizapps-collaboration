/**
 * Collaboration storage account configuration. Supports dedicated Box cloud
 * storage when Box credentials are present in the environment, and cleanly
 * falls back to local directory storage when cloud credentials are not configured.
 */
import { RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJCredentialEntity, MJFileStorageAccountEntity, MJFileStorageProviderEntity } from '@memberjunction/core-entities';
import { FileStorageEngine, type StorageProviderConfig } from '@memberjunction/storage';
import { COLLABORATION_STORAGE_DRIVER_KEY } from './local-directory-storage.js';

export const COLLABORATION_STORAGE_PROVIDER_ID = 'F3000001-0000-4000-8000-000000000001';
export const COLLABORATION_STORAGE_ACCOUNT_ID = 'F3000001-0000-4000-8000-000000000002';
export const COLLABORATION_BOX_PROVIDER_ID = 'CEB9433E-F36B-1410-8DA0-00021F8B792E';

const PROVIDERS = 'MJ: File Storage Providers';
const ACCOUNTS = 'MJ: File Storage Accounts';
const CREDENTIALS = 'MJ: Credentials';
const CREDENTIAL_TYPES = 'MJ: Credential Types';
const CREDENTIAL_NAME = 'Collaboration local directory';
const BOX_CREDENTIAL_NAME = 'Collaboration Box Storage';
const PROVIDER_NAME = 'Collaboration Local';
const ACCOUNT_NAME = 'Collaboration local';
const BOX_ACCOUNT_NAME = 'Collaboration Box';

export interface BoxStorageConfig extends StorageProviderConfig {
    clientID: string;
    clientSecret: string;
    enterpriseID: string;
    rootFolderID: string;
}

export function getBoxStorageConfig(): BoxStorageConfig | null {
    const clientID = process.env.STORAGE_BOX_CLIENT_ID?.trim();
    const clientSecret = process.env.STORAGE_BOX_CLIENT_SECRET?.trim();
    const enterpriseID = process.env.STORAGE_BOX_ENTERPRISE_ID?.trim();
    const rootFolderID = process.env.STORAGE_BOX_ROOT_FOLDER_ID?.trim();
    if (!clientID || !clientSecret || !enterpriseID || !rootFolderID) return null;
    return { clientID, clientSecret, enterpriseID, rootFolderID };
}

export async function ensureLocalStorageAccount(provider: IMetadataProvider, system: UserInfo, rootDir: string): Promise<string> {
    const boxConfig = getBoxStorageConfig();
    if (boxConfig) {
        return ensureBoxStorageAccount(provider, system, boxConfig);
    }
    return ensureLocalDirectoryStorageAccount(provider, system, rootDir);
}

export async function readStoredFile(provider: IMetadataProvider, system: UserInfo, accountId: string, storagePath: string): Promise<Buffer> {
    await FileStorageEngine.Instance.Config(false, system, provider);
    const driver = await FileStorageEngine.Instance.GetDriver(accountId, system);
    return driver.GetObject({ fullPath: storagePath });
}

export async function storedFileExists(provider: IMetadataProvider, system: UserInfo, accountId: string, storagePath: string): Promise<boolean> {
    await FileStorageEngine.Instance.Config(false, system, provider);
    const driver = await FileStorageEngine.Instance.GetDriver(accountId, system);
    return driver.ObjectExists(storagePath);
}

async function ensureBoxStorageAccount(provider: IMetadataProvider, system: UserInfo, boxConfig: BoxStorageConfig): Promise<string> {
    await ensureBoxProvider(provider, system);
    const credentialId = await ensureBoxCredential(provider, system, boxConfig);
    await ensureBoxAccount(provider, system, credentialId);
    await FileStorageEngine.Instance.Config(true, system, provider);
    return COLLABORATION_STORAGE_ACCOUNT_ID;
}

async function ensureBoxProvider(provider: IMetadataProvider, system: UserInfo): Promise<void> {
    const record = await provider.GetEntityObject<MJFileStorageProviderEntity>(PROVIDERS, system);
    if (await rowExists(provider, system, PROVIDERS, COLLABORATION_BOX_PROVIDER_ID)) {
        if (!(await record.Load(COLLABORATION_BOX_PROVIDER_ID))) throw new Error('Could not load Box storage provider.');
    } else {
        record.NewRecord();
        record.ID = COLLABORATION_BOX_PROVIDER_ID;
        record.Name = 'Box.com';
        record.Description = 'Box.com cloud storage provider';
        record.ServerDriverKey = 'Box.com Storage';
        record.ClientDriverKey = 'Box.com Storage';
        record.Priority = 100;
        record.SupportsSearch = true;
        record.RequiresOAuth = true;
    }
    record.IsActive = true;
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save Box storage provider.');
}

async function ensureBoxCredential(provider: IMetadataProvider, system: UserInfo, boxConfig: BoxStorageConfig): Promise<string> {
    const view = RunView.FromMetadataProvider(provider);
    const type = await view.RunView<{ ID: string }>({
        EntityName: CREDENTIAL_TYPES,
        ExtraFilter: `Name = 'OAuth2 Client Credentials' OR Name = 'Box.com OAuth' OR Name = 'API Key'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    const typeId = type.Results?.[0]?.ID;
    if (!type.Success || !typeId) throw new Error('MJ: Credential Types has no matching type for Box storage.');

    const existing = await view.RunView<{ ID: string }>({
        EntityName: CREDENTIALS,
        ExtraFilter: `Name = '${BOX_CREDENTIAL_NAME}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!existing.Success) throw new Error(existing.ErrorMessage ?? 'Could not read storage credentials.');

    const values = JSON.stringify(boxConfig);
    const record = await provider.GetEntityObject<MJCredentialEntity>(CREDENTIALS, system);
    if (existing.Results?.[0]?.ID) {
        if (!(await record.Load(existing.Results[0].ID))) throw new Error('Could not load the Box storage credential.');
        record.Values = values;
        record.IsDefault = false;
        record.IsActive = true;
        if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not update the Box storage credential.');
        return record.ID;
    }
    record.NewRecord();
    record.CredentialTypeID = typeId;
    record.Name = BOX_CREDENTIAL_NAME;
    record.Description = 'Box cloud storage credentials for Collaboration integration tests.';
    record.Values = values;
    record.IsDefault = false;
    record.IsActive = true;
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the Box storage credential.');
    return record.ID;
}

async function ensureBoxAccount(provider: IMetadataProvider, system: UserInfo, credentialId: string): Promise<void> {
    const record = await provider.GetEntityObject<MJFileStorageAccountEntity>(ACCOUNTS, system);
    if (await rowExists(provider, system, ACCOUNTS, COLLABORATION_STORAGE_ACCOUNT_ID)) {
        if (!(await record.Load(COLLABORATION_STORAGE_ACCOUNT_ID))) throw new Error('Could not load the storage account.');
    } else {
        record.NewRecord();
        record.ID = COLLABORATION_STORAGE_ACCOUNT_ID;
    }
    record.Name = BOX_ACCOUNT_NAME;
    record.Description = 'Collaboration sample world files stored in Box dedicated test folder.';
    record.ProviderID = COLLABORATION_BOX_PROVIDER_ID;
    record.CredentialID = credentialId;
    record.IncludeInGlobalSearch = false;
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the Box storage account.');
}

async function ensureLocalDirectoryStorageAccount(provider: IMetadataProvider, system: UserInfo, rootDir: string): Promise<string> {
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
    const credentialId = await ensureLocalCredential(provider, system, typeId, root);
    await ensureLocalProvider(provider, system, root);
    await ensureLocalAccount(provider, system, credentialId);
    await FileStorageEngine.Instance.Config(true, system, provider);
    return COLLABORATION_STORAGE_ACCOUNT_ID;
}

async function ensureLocalCredential(provider: IMetadataProvider, system: UserInfo, typeId: string, rootDir: string): Promise<string> {
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

async function ensureLocalProvider(provider: IMetadataProvider, system: UserInfo, rootDir: string): Promise<void> {
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
    record.IsActive = true;
    record.SupportsSearch = false;
    record.RequiresOAuth = false;
    record.Configuration = JSON.stringify({ rootDir });
    if (!(await record.Save())) throw new Error(record.LatestResult?.CompleteMessage ?? 'Could not save the local storage provider.');
}

async function ensureLocalAccount(provider: IMetadataProvider, system: UserInfo, credentialId: string): Promise<void> {
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
