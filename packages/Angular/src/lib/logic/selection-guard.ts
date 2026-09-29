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
