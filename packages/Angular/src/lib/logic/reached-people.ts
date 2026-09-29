import { UUIDsEqual } from '@memberjunction/global';
import { isPostCloseAccessPermitted } from '@mj-biz-apps/collaboration-core';

/** The fields of a space the walk up its tree reads. */
export interface TreeSpace {
    ID: string;
    Name: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    /** A closed space lets its parent's people in only while its post-close access allows it. */
    ClosedAt?: string | Date | null;
    PostCloseAccess?: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None' | null;
    PostCloseAccessDays?: number | null;
}

export interface ChainSpace {
    id: string;
    name: string;
}

/**
 * The spaces whose seats reach `spaceId`, nearest first: the space itself, then each parent while the child inherits
 * membership. A sealed space (one that doesn't inherit) stops the walk. A parent the viewer can't read still counts (its Active
 * seats are readable): it joins the chain unnamed, and the walk ends there, since nothing is known of what lies above it.
 */
export function accessChain(spaceId: string, spaces: readonly TreeSpace[]): ChainSpace[] {
    const chain: ChainSpace[] = [];
    const seen = new Set<string>();
    let current = spaces.find((s) => UUIDsEqual(s.ID, spaceId));
    while (current && !seen.has(current.ID.toLowerCase())) {
        seen.add(current.ID.toLowerCase());
        chain.push({ id: current.ID, name: current.Name });
        if (!current.InheritsMembership || !current.ParentID) break;
        const parentId: string = current.ParentID;
        const parent = spaces.find((s) => UUIDsEqual(s.ID, parentId));
        if (!parent) {
            chain.push({ id: parentId, name: '' });
            break;
        }
        // A closed parent whose post-close access has ended (or is None) no longer lets anyone in, and neither does what lies above it
        if (parent.ClosedAt && !isPostCloseAccessPermitted({
            id: parent.ID, parentId: parent.ParentID, inheritsMembership: parent.InheritsMembership, ownerId: '', agentRetrieval: 'Included',
            closedAt: parent.ClosedAt, postCloseAccess: parent.PostCloseAccess, postCloseAccessDays: parent.PostCloseAccessDays,
        })) break;
        current = parent;
    }
    return chain;
}

/** A seat with where it comes from. */
export interface ReachedSeat<T> {
    row: T;
    from: ChainSpace;
    /** True when the seat sits on an ancestor rather than on the space itself: it is shown, but changed only where it sits. */
    inherited: boolean;
    /** The person's own seat on this space when it isn't the one they reach through (an Invited or Removed one). */
    ownSeat?: T;
}

/**
 * One seat per person, the way the server counts it: the nearest ACTIVE seat along the chain. An Invited or Removed seat on the
 * space itself doesn't stop an ancestor's Active seat from counting, so it is not what the person is listed under; it is shown
 * beside them (`ownSeat`), or as its own row for a person nothing else reaches.
 */
export function nearestSeats<T extends { SpaceID: string; UserID: string; Status: string }>(rows: readonly T[], chain: readonly ChainSpace[]): ReachedSeat<T>[] {
    const byUser = new Map<string, ReachedSeat<T>>();
    chain.forEach((link, depth) => {
        for (const row of rows) {
            if (row.Status !== 'Active' || !UUIDsEqual(row.SpaceID, link.id)) continue;
            const key = row.UserID.toLowerCase();
            if (!byUser.has(key)) byUser.set(key, { row, from: link, inherited: depth > 0 });
        }
    });
    const own = chain[0];
    for (const row of own ? rows : []) {
        if (row.Status === 'Active' || !UUIDsEqual(row.SpaceID, own.id)) continue;
        const key = row.UserID.toLowerCase();
        const listed = byUser.get(key);
        if (listed) listed.ownSeat = row;
        else byUser.set(key, { row, from: own, inherited: false });
    }
    return [...byUser.values()];
}
