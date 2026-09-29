import { UUIDsEqual } from '@memberjunction/global';

/** What the subtype rules read of an entity: its identity, its IsA parent, and who may read it under which row filter. */
export interface SubtypeEntityShape {
    ID: string;
    Name: string;
    ParentID: string | null;
    Permissions: ReadonlyArray<{ RoleID: string; Role?: string | null; CanRead: boolean; ReadRLSFilterID: string | null }>;
}

/**
 * Whether an entity a space type names as its subtype may be one. It must be an IsA child of Spaces (directly or through another
 * child), and every role that can read it must read it under the same row filter Spaces gives that role, and be able to read
 * Spaces at all. Otherwise a subtype's own table would show a person a space's details the space's row filter hides from them:
 * CodeGen gives a new entity an unfiltered read, and another app may declare a Space subtype without Collaboration.
 * Null when it may be one; else why not.
 */
export function refuseSubtypeEntity(
    spaces: SubtypeEntityShape,
    subtype: SubtypeEntityShape,
    entityById: (id: string) => SubtypeEntityShape | undefined,
): string | null {
    let isChild = false;
    let parentId = subtype.ParentID;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId.toLowerCase())) {
        seen.add(parentId.toLowerCase());
        if (UUIDsEqual(parentId, spaces.ID)) { isChild = true; break; }
        parentId = entityById(parentId)?.ParentID ?? null;
    }
    if (!isChild) return `"${subtype.Name}" is not an IsA child of ${spaces.Name}: declare it one before a space type names it.`;

    for (const permission of subtype.Permissions.filter((p) => p.CanRead)) {
        const role = permission.Role || permission.RoleID;
        const onSpaces = spaces.Permissions.find((p) => UUIDsEqual(p.RoleID, permission.RoleID));
        if (!onSpaces?.CanRead) {
            return `"${subtype.Name}" lets ${role} read it, but ${role} cannot read ${spaces.Name}: a subtype is read only by those who read the space.`;
        }
        if (!sameFilter(onSpaces.ReadRLSFilterID, permission.ReadRLSFilterID)) {
            return `"${subtype.Name}" is read by ${role} without the row filter ${spaces.Name} gives that role, so it would show details of spaces the person cannot see. Give its read the same filter.`;
        }
    }
    return null;
}

function sameFilter(left: string | null, right: string | null): boolean {
    if (!left && !right) return true;
    if (!left || !right) return false;
    return UUIDsEqual(left, right);
}
