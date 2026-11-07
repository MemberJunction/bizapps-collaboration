import { UUIDsEqual } from '@memberjunction/global';

/** What the server says closing a space would do (see `GetCloseConsequence`): the status it moves to and what that allows. */
export interface CloseConsequenceRead {
    /** The code and name of the type's first terminal status (Closed); null for a type with no statuses, which reads as read-only and visible. */
    statusCode: string | null;
    statusName: string | null;
    readOnly: boolean;
    visible: boolean;
    agentRetrieval: boolean;
    keeperUserId: string;
    keeperName: string;
    /** Null when the server could not check. */
    keeperCanReopen: boolean | null;
}

/** Where the read stands: asked and not yet answered, failed, or answered. */
export type CloseConsequenceState = { status: 'loading' } | { status: 'unavailable' } | { status: 'read'; read: CloseConsequenceRead };

/** The server's answer, checked: null when it names no keeper. */
export function readFromPayload(payload: { StatusCode?: string; StatusName?: string; ReadOnly?: boolean; Visible?: boolean; AgentRetrieval?: boolean; KeeperUserID?: string; KeeperName?: string; KeeperCanReopen?: boolean }): CloseConsequenceRead | null {
    if (!payload.KeeperUserID || !payload.KeeperName) return null;
    return {
        statusCode: payload.StatusCode ?? null,
        statusName: payload.StatusName ?? null,
        readOnly: payload.ReadOnly ?? true,
        visible: payload.Visible ?? true,
        agentRetrieval: payload.AgentRetrieval ?? true,
        keeperUserId: payload.KeeperUserID,
        keeperName: payload.KeeperName,
        keeperCanReopen: payload.KeeperCanReopen ?? null,
    };
}

/**
 * What closing a space does, in words for the confirmation: the status the close moves the space to and what it allows, and who
 * keeps the space once it is hidden and whether they can bring it back. Only the space's owner (its `OwnerID`) keeps the row of a
 * hidden space. The owner is named ("you" when it is the viewer). Anyone else loses a hidden space, and is told.
 */
export function closeConsequence(state: CloseConsequenceState, viewerUserId: string | null | undefined): string {
    if (state.status === 'loading') return "Working out what closing does to this space…";
    if (state.status === 'unavailable') return "The server couldn't say what closing does to this space, so it can't be promised that anyone can reopen it.";
    const read = state.read;
    const viewerKeeps = !!viewerUserId && UUIDsEqual(viewerUserId, read.keeperUserId);
    const keeper = viewerKeeps ? 'you' : read.keeperName;
    const reopen = read.keeperCanReopen === true
        ? `${viewerKeeps ? 'You' : keeper} can bring it back.`
        : read.keeperCanReopen === false
            ? `${read.statusName ?? 'A closed space'} moves forward only, so nobody brings it back from the app.`
            : `Whether ${viewerKeeps ? 'you' : read.keeperName} can bring it back could not be checked.`;
    const agent = read.agentRetrieval ? ' The assistant can still answer questions about it.' : '';
    const named = read.statusName ? `${read.statusName}: ` : '';
    if (read.visible) {
        return `${named}it becomes read-only for everyone.${agent} ${reopen}`.replace(/^([a-z])/, (c) => c.toUpperCase());
    }
    return `${named}it disappears for everyone but ${keeper}.${agent} ${reopen}${viewerKeeps ? '' : " You won't see it again."}`.replace(/^([a-z])/, (c) => c.toUpperCase());
}
