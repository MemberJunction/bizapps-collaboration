/**
 * The one reading of "does this space take writes" the chat operations share (stage 1): a space's effective status, by its
 * StatusID or derived from ClosedAt for a type with no statuses, says whether it is read-only, and names itself for the refusal.
 */
import { CollaborationEngine } from './CollaborationEngine.js';

export interface SpaceStatusRow {
    StatusID?: string | null;
    SpaceTypeID?: string | null;
    ClosedAt?: string | Date | null;
}

export interface SpaceWriteRefusal {
    /** Whether the space refuses writes. */
    readOnly: boolean;
    /** The status's name ('Paused', 'Closed'); 'closed' for a closed space of a type with no statuses. */
    statusName: string;
    /** Whether the space is closed (a terminal status, or ClosedAt set). */
    closed: boolean;
}

/** Reads the space's effective status from the engine. The engine is loaded by the server at startup; callers that may run before that load it first. */
export function spaceWriteRefusal(space: SpaceStatusRow): SpaceWriteRefusal {
    const status = CollaborationEngine.Instance.EffectiveStatusForSpace(space);
    if (status) return { readOnly: !!status.ReadOnly, statusName: status.Name, closed: !!status.IsTerminal || !!space.ClosedAt };
    return { readOnly: !!space.ClosedAt, statusName: 'closed', closed: !!space.ClosedAt };
}

/** The sentence a refused write gets: the old one for a closed space, the status's name otherwise. */
export function spaceWriteRefusalMessage(refusal: SpaceWriteRefusal, what: 'message' | 'turn' | 'conversation'): string {
    if (refusal.closed) {
        return what === 'conversation' ? 'Cannot create conversation in a closed space.' : `A closed space does not take a new ${what}.`;
    }
    return what === 'conversation'
        ? `Cannot create conversation in a space that is ${refusal.statusName}.`
        : `A space that is ${refusal.statusName} does not take a new ${what}.`;
}
