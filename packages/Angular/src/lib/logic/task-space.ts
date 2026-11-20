import { NormalizeUUID, UUIDsEqual } from '@memberjunction/global';

/** A space item row that files a task, as the section reads it. */
export interface TaskSpaceItemRow {
    SpaceID: string;
    RecordID: string;
}

/** A space the person reaches, as the rail holds it. */
export interface ReachableSpace {
    ID: string;
    Name: string;
}

/**
 * The space a task opens in from My tasks: among the spaces the person reaches that file the task, the first by name,
 * then by id, which is the order Home's Open tasks list uses. Null when none of its spaces is in the rail.
 */
export function chooseTaskSpace(items: readonly TaskSpaceItemRow[], spaces: readonly ReachableSpace[]): string | null {
    const candidates: ReachableSpace[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        if (!item.SpaceID) continue;
        const key = NormalizeUUID(item.SpaceID);
        if (seen.has(key)) continue;
        seen.add(key);
        const space = spaces.find((s) => UUIDsEqual(s.ID, item.SpaceID));
        if (space) candidates.push(space);
    }
    candidates.sort((a, b) => (a.Name ?? '').localeCompare(b.Name ?? '') || NormalizeUUID(a.ID).localeCompare(NormalizeUUID(b.ID)));
    return candidates[0]?.ID ?? null;
}
