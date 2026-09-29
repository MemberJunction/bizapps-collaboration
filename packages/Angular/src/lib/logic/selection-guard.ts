import { UUIDsEqual } from '@memberjunction/global';

/**
 * Whether a load that started for `spaceId` under `requestId` may still write. A later selection bumps the current request,
 * and a load is stale once the request has moved on or the active space is no longer the one it read.
 * Spaces are compared as UUIDs: the URL keeps the casing it was given and the rows keep the database's.
 */
export function isSelectionCurrent(
    requestId: number,
    currentRequestId: number,
    spaceId: string,
    activeSpaceId: string | null | undefined,
): boolean {
    return requestId === currentRequestId && !!activeSpaceId && UUIDsEqual(activeSpaceId, spaceId);
}

/**
 * Reads, then writes only if the load is still the one that should write. Every loader follows this order, and the check comes
 * after the read because that is where the person can have moved on. Returns whether it wrote.
 */
export async function guardedLoad<T>(mayWrite: () => boolean, read: () => Promise<T>, write: (value: T) => void): Promise<boolean> {
    const value = await read();
    if (!mayWrite()) return false;
    write(value);
    return true;
}
