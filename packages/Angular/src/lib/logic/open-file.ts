/** What opening a library file needs from its host. */
export interface OpenFileHost {
    /** Opens MemberJunction's own viewer for the file. Null when this screen has no navigation to do it with. */
    open: ((fileId: string) => void) | null;
    /** Records that the person opened the item. True when the record was saved. */
    recordOpen: (itemId: string) => Promise<boolean>;
}

export interface OpenFileTarget {
    /** The space item's ID. */
    id: string;
    /** The file's ID. */
    fileId?: string | null;
}

export type OpenFileOutcome =
    | { ok: true; recorded: boolean }
    | { ok: false; message: string };

/**
 * Opens a library file in MemberJunction's viewer, which loads it as the caller (so the band decides what opens), then records
 * the open once. There is no second way in: a file that can't be opened here says so.
 */
export async function openSpaceFile(host: OpenFileHost, target: OpenFileTarget): Promise<OpenFileOutcome> {
    if (!target.fileId) return { ok: false, message: 'This item has no file to open.' };
    if (!host.open) return { ok: false, message: 'Files open in the MemberJunction viewer, and this screen has none to open them in.' };
    host.open(target.fileId);
    return { ok: true, recorded: await host.recordOpen(target.id) };
}

/** The fields of the item-use row an open writes, or null when the person or the space isn't known. */
export function openUseFields(itemId: string, spaceId: string | null | undefined, userId: string | null | undefined, now: Date):
    { ItemID: string; SpaceID: string; UserID: string; UsedAt: Date; Kind: 'open' } | null {
    if (!itemId || !spaceId || !userId) return null;
    return { ItemID: itemId, SpaceID: spaceId, UserID: userId, UsedAt: now, Kind: 'open' };
}
