/**
 * Space statuses (stage 1): a space type declares its statuses, each with the attributes that say what a space in that
 * status allows; a space chooses among its type's and cannot add one. These are the pure rules; the server's gate and
 * the screens read them. Nothing here touches a database.
 */

/** One row of `Space Type Statuses`, as the rules need it. */
export interface SpaceTypeStatusAttributes {
    ID?: string;
    Code: string;
    Name: string;
    /** The definitive order of a type's statuses. A terminal status may only move forward in it. */
    Sequence: number;
    /** Where a new space of the type starts; one per type. */
    IsDefault: boolean;
    /** Members may read but not post, upload, assign or edit. */
    ReadOnly: boolean;
    /** The space is listed and reachable by its members; off hides it except from owners and staff. */
    Visible: boolean;
    /** An agent may quote the space's material while it is in this status. */
    AgentRetrieval: boolean;
    /** Once a space reaches this status it may still move to another; off freezes it there. */
    CanChangeAfter: boolean;
    /** Send the space's "status changed" notice, one per member, on entering it. */
    NotifyMembersOnEnter: boolean;
    /** Entering it stamps ClosedAt; retention and the closed views count from it. */
    IsTerminal: boolean;
}

/** The four statuses every shipped type starts with (Ian, Oct 1), in sequence order. */
export const SHIPPED_STATUSES: readonly Omit<SpaceTypeStatusAttributes, 'ID'>[] = [
    { Code: 'active', Name: 'Active', Sequence: 1, IsDefault: true, ReadOnly: false, Visible: true, AgentRetrieval: true, CanChangeAfter: true, NotifyMembersOnEnter: false, IsTerminal: false },
    { Code: 'paused', Name: 'Paused', Sequence: 2, IsDefault: false, ReadOnly: true, Visible: true, AgentRetrieval: true, CanChangeAfter: true, NotifyMembersOnEnter: true, IsTerminal: false },
    { Code: 'closed', Name: 'Closed', Sequence: 3, IsDefault: false, ReadOnly: true, Visible: true, AgentRetrieval: true, CanChangeAfter: true, NotifyMembersOnEnter: true, IsTerminal: true },
    { Code: 'archived', Name: 'Archived', Sequence: 4, IsDefault: false, ReadOnly: true, Visible: false, AgentRetrieval: false, CanChangeAfter: false, NotifyMembersOnEnter: false, IsTerminal: true },
];

/** The status a new space of the type starts in: the one marked default, else the lowest in sequence. */
export function defaultStatus<T extends SpaceTypeStatusAttributes>(statuses: readonly T[]): T | null {
    if (statuses.length === 0) return null;
    return statuses.find((s) => s.IsDefault) ?? [...statuses].sort((a, b) => a.Sequence - b.Sequence)[0];
}

export type StatusChangeRefusalCode = 'same' | 'frozen' | 'terminal-backward' | 'other-type';

export interface StatusChangeRefusal {
    code: StatusChangeRefusalCode;
    message: string;
}

/**
 * Whether a space may move from one status to another, by the type's attributes alone; the type's driver may still refuse.
 * Null means the move is allowed. A move to the same status is refused as a no-op so callers do not stamp or notify twice.
 */
export function statusChangeRefusal(from: SpaceTypeStatusAttributes, to: SpaceTypeStatusAttributes): StatusChangeRefusal | null {
    if (from.Code === to.Code) return { code: 'same', message: `The space is already ${to.Name}.` };
    if (!from.CanChangeAfter) return { code: 'frozen', message: `A space that is ${from.Name} cannot change status.` };
    if (from.IsTerminal && to.Sequence <= from.Sequence) {
        return { code: 'terminal-backward', message: `A space that is ${from.Name} can only move forward, not back to ${to.Name}.` };
    }
    return null;
}

/** The statuses a space in `from` may move to, in sequence order. */
export function reachableStatuses<T extends SpaceTypeStatusAttributes>(from: T, statuses: readonly T[]): T[] {
    return [...statuses].sort((a, b) => a.Sequence - b.Sequence).filter((to) => statusChangeRefusal(from, to) === null);
}

/** Whether a write (a post, an upload, an assignment, an edit) is allowed in a space of this status. */
export function statusAllowsWrites(status: SpaceTypeStatusAttributes | null | undefined): boolean {
    return !!status && !status.ReadOnly;
}

/** Checks a type's status list as a whole: one default, distinct codes and sequences, and at least one status. */
export function validateStatusList(statuses: readonly SpaceTypeStatusAttributes[]): string[] {
    const errors: string[] = [];
    if (statuses.length === 0) return ['A space type needs at least one status.'];
    const defaults = statuses.filter((s) => s.IsDefault);
    if (defaults.length !== 1) errors.push(`A space type needs exactly one default status; this one has ${defaults.length}.`);
    const codes = new Set<string>();
    const sequences = new Set<number>();
    for (const s of statuses) {
        const code = s.Code.trim().toLowerCase();
        if (code === '') errors.push('A status needs a code.');
        if (codes.has(code)) errors.push(`Status code "${s.Code}" is used twice.`);
        codes.add(code);
        if (sequences.has(s.Sequence)) errors.push(`Sequence ${s.Sequence} is used twice.`);
        sequences.add(s.Sequence);
        if (!s.IsTerminal && !s.CanChangeAfter) errors.push(`Status "${s.Code}" is not terminal yet cannot change after; nothing could ever leave it.`);
    }
    return errors;
}
