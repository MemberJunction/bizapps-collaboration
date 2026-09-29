import { UUIDsEqual } from '@memberjunction/global';

/** What the server says closing a space would do (see `GetCloseConsequence`). */
export interface CloseConsequenceRead {
    access: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None';
    days: number | null;
    keeperUserId: string;
    keeperName: string;
    /** Null when the server could not check. */
    keeperCanReopen: boolean | null;
}

/** Where the read stands: asked and not yet answered, failed, or answered. */
export type CloseConsequenceState = { status: 'loading' } | { status: 'unavailable' } | { status: 'read'; read: CloseConsequenceRead };

const ACCESS_KINDS: readonly string[] = ['ReadOnly', 'ReadOnlyWithAgent', 'None'];

/** The server's answer, checked: null when the access it names is not one of the three. */
export function readFromPayload(payload: { Access?: string; Days?: number; KeeperUserID?: string; KeeperName?: string; KeeperCanReopen?: boolean }): CloseConsequenceRead | null {
    if (!payload.Access || !ACCESS_KINDS.includes(payload.Access) || !payload.KeeperUserID || !payload.KeeperName) return null;
    return {
        access: payload.Access as CloseConsequenceRead['access'],
        days: payload.Days ?? null,
        keeperUserId: payload.KeeperUserID,
        keeperName: payload.KeeperName,
        keeperCanReopen: payload.KeeperCanReopen ?? null,
    };
}

/**
 * What closing a space does, in words for the confirmation: the post-close access the close will stamp, and, once access has
 * ended, who keeps the space and whether they can reopen it. Only the space's owner (its `OwnerID`) keeps the row of a space whose
 * access has ended. The owner is named ("you" when it is the viewer). Anyone else loses the space when access ends, and is told.
 */
export function closeConsequence(state: CloseConsequenceState, viewerUserId: string | null | undefined): string {
    if (state.status === 'loading') return "Working out what closing does to this space…";
    if (state.status === 'unavailable') return "The server couldn't say what closing does to this space, so it can't be promised that anyone can reopen it.";
    const read = state.read;
    const viewerKeeps = !!viewerUserId && UUIDsEqual(viewerUserId, read.keeperUserId);
    const keeper = viewerKeeps ? 'you' : read.keeperName;
    const holds = viewerKeeps ? 'hold' : 'holds';
    const reopen = read.keeperCanReopen === true
        ? `${keeper}, who can reopen it`
        : read.keeperCanReopen === false
            ? `${keeper}, who ${holds} no owner seat or lack${viewerKeeps ? '' : 's'} the right to reopen it, so no one can reopen it from the app`
            : `${keeper}, though whether ${viewerKeeps ? 'you' : 'they'} can reopen it could not be checked`;
    const agent = read.access === 'ReadOnlyWithAgent' ? ' The assistant can still answer questions about it.' : '';
    if (read.access === 'ReadOnly' || read.access === 'ReadOnlyWithAgent') {
        if (read.days === null || read.days === undefined) return `It becomes read-only for everyone.${agent}`;
        const window = `${read.days} ${read.days === 1 ? 'day' : 'days'}`;
        return `It becomes read-only for everyone for ${window}.${agent} After that it disappears for everyone but ${reopen}.${viewerKeeps ? '' : " After that, you won't see it."}`;
    }
    return `It disappears for everyone but ${reopen}.${viewerKeeps ? '' : " You won't see it again."}`;
}
