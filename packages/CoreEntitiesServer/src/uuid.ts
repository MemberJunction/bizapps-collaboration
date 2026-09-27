import type { IMetadataProvider } from '@memberjunction/core';
import { NormalizeUUID } from '@memberjunction/global';

/** ProviderBase is an IMetadataProvider. Its declared type is not. */
export function asMetadata(provider: object): IMetadataProvider | null {
    if (!provider) return null;
    const candidate = provider as Partial<IMetadataProvider>;
    if (typeof candidate.GetEntityObject !== 'function' || typeof candidate.EntityByID !== 'function') {
        return null;
    }
    return candidate as IMetadataProvider;
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Null when the value is not a UUID. Compared lowercase so SQL Server and callers agree. */
export function parseUuid(value: string | null | undefined): string | null {
    const normalized = NormalizeUUID(value);
    if (!normalized || !UUID.test(normalized)) {
        return null;
    }
    return normalized;
}
