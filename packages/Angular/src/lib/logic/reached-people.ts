import { UUIDsEqual } from '@memberjunction/global';

/** The fields of a space the walk up its tree reads. */
export interface TreeSpace {
    ID: string;
    Name: string;
    ParentID: string | null;
    InheritsMembership: boolean;
}

export interface ChainSpace {
    id: string;
    name: string;
}

/**
 * The spaces whose seats reach `spaceId`, nearest first: the space itself, then each parent while the child inherits
 * membership. A sealed space (one that doesn't inherit) stops the walk, and so does a parent that can't be found.
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
        current = spaces.find((s) => UUIDsEqual(s.ID, parentId));
    }
    return chain;
}

/** A seat with where it comes from. */
export interface ReachedSeat<T> {
    row: T;
    from: ChainSpace;
    /** True when the seat sits on an ancestor rather than on the space itself: it is shown, but changed only where it sits. */
    inherited: boolean;
}

/**
 * One seat per person: the nearest one along the chain. A nearer seat shadows a farther one, so a person removed on the space
 * itself doesn't reappear through its parent.
 */
export function nearestSeats<T extends { SpaceID: string; UserID: string }>(rows: readonly T[], chain: readonly ChainSpace[]): ReachedSeat<T>[] {
    const byUser = new Map<string, ReachedSeat<T>>();
    chain.forEach((link, depth) => {
        for (const row of rows) {
            if (!UUIDsEqual(row.SpaceID, link.id)) continue;
            const key = row.UserID.toLowerCase();
            if (!byUser.has(key)) byUser.set(key, { row, from: link, inherited: depth > 0 });
        }
    });
    return [...byUser.values()];
}
