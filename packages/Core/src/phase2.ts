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

export type LibraryDecision = { ok: true } | { ok: false; message: string };

function refuse(message: string): LibraryDecision {
    return { ok: false, message };
}

/**
 * An item use is an audit row. It is created as the caller, for an item in
 * the space, and only when the caller can see that item's band.
 */
export function authorizeUseWrite(input: {
    callerUserId: string;
    userId: string;
    spaceId: string;
    itemSpaceId: string | null;
    itemBand: Band | null;
    spaces: readonly SpaceNode[];
    memberships: readonly MemberSnapshot[];
    isNew: boolean;
}): LibraryDecision {
    if (!input.isNew) {
        return refuse('Item uses are not edited.');
    }
    if (idKey(input.userId) !== idKey(input.callerUserId)) {
        return refuse('An item use is recorded as the caller.');
    }
    if (!input.itemSpaceId || idKey(input.itemSpaceId) !== idKey(input.spaceId)) {
        return refuse('The item is not in this space.');
    }
    const reach = membershipReaches(input.spaces, input.memberships, input.callerUserId, input.spaceId);
    if (!reach) {
        return refuse('The caller does not reach this space.');
    }
    if (input.itemBand === 'Team' && !reach.role.canSeeTeamBand) {
        return refuse('The caller cannot record a use of a Team item.');
    }
    return { ok: true };
}

/**
 * A share notice is addressed to one member. The caller must reach the space,
 * the item must be in that space, and the recipient must be someone
 * `shareRecipients` would tell. A Team item is not offered to someone who
 * cannot see Team.
 */
export function authorizeNoticeWrite(input: {
    callerUserId: string;
    recipientUserId: string;
    spaceId: string;
    itemSpaceId: string | null;
    itemBand: Band | null;
    spaces: readonly SpaceNode[];
    memberships: readonly MemberSnapshot[];
    isNew: boolean;
}): LibraryDecision {
    if (!input.isNew) {
        return refuse('Share notices are not edited.');
    }
    const caller = membershipReaches(input.spaces, input.memberships, input.callerUserId, input.spaceId);
    if (!caller) {
        return refuse('The caller does not reach this space.');
    }
    if (!input.itemSpaceId || idKey(input.itemSpaceId) !== idKey(input.spaceId)) {
        return refuse('The item is not in this space.');
    }
    if (input.itemBand === 'Team' && !caller.role.canSeeTeamBand) {
        return refuse('The caller cannot share a Team item.');
    }
    const allowed = shareRecipients({
        spaces: input.spaces,
        memberships: input.memberships,
        spaceId: input.spaceId,
        promoterUserId: input.callerUserId,
    });
    if (!allowed.some((id) => idKey(id) === idKey(input.recipientUserId))) {
        return refuse('That person is not a recipient for this share.');
    }
    if (input.itemBand === 'Team') {
        const recipient = membershipReaches(input.spaces, input.memberships, input.recipientUserId, input.spaceId);
        if (!recipient?.role.canSeeTeamBand) {
            return refuse('A Team item is not shared with someone who cannot see Team.');
        }
    }
    return { ok: true };
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
