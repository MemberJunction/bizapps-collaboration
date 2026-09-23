import { idKey, membershipReaches, type Band, type MemberSnapshot, type SpaceNode } from './rules.ts';

export interface LibraryItem {
    id: string;
    spaceId: string;
    label: string;
    band: Band;
    kind: 'file' | 'task' | 'conversation';
    folder: string | null;
}

/** Folders are labels on the item. Collections cannot express "everyone in the space" yet. */
export function foldersIn(items: readonly LibraryItem[], spaceId: string): string[] {
    const names = new Set<string>();
    for (const item of items) {
        if (idKey(item.spaceId) === idKey(spaceId) && item.kind === 'file' && item.folder) names.add(item.folder);
    }
    return [...names].sort();
}

/** People who should hear that a Shared item landed. The promoter is not notified. */
export function shareRecipients(input: {
    spaces: readonly SpaceNode[];
    memberships: readonly MemberSnapshot[];
    spaceId: string;
    promoterUserId: string;
}): string[] {
    const people = new Set<string>();
    for (const member of input.memberships) {
        if (member.status !== 'Active' || idKey(member.userId) === idKey(input.promoterUserId)) continue;
        if (membershipReaches(input.spaces, input.memberships, member.userId, input.spaceId)) {
            people.add(member.userId);
        }
    }
    return [...people].sort();
}

export interface ItemUse {
    itemId: string;
    userId: string;
    at: Date;
    kind: 'open' | 'upload' | 'promote';
}

export function recordUse(itemId: string, userId: string, at: Date, kind: ItemUse['kind']): ItemUse {
    return { itemId, userId, at, kind };
}
