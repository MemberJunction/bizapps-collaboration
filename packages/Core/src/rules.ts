/**
 * Collaboration rules. Pure. The server, the workspace, and the SQL function
 * `fnCollaborationAccess` all follow this file. A change here is a change to
 * the security model, so the tests in rules.test.ts move with it.
 *
 * The caller's own access is the ceiling. Nothing in this module grants a
 * read the caller did not already have. It only narrows.
 */

export type Band = 'Team' | 'Shared';
export type MemberStatus = 'Invited' | 'Active' | 'Removed';
export type AgentRetrieval = 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
export type Retention = 'Month' | 'Year' | 'Indefinite';
export type InviteApproval = 'Approve' | 'AutoApprove';

export interface RoleFlags {
    level: number;
    maxGrantableLevel: number;
    canInvite: boolean;
    canPromoteBand: boolean;
    canSeeTeamBand: boolean;
    isOwnerRole: boolean;
}

export interface MemberSnapshot {
    spaceId: string;
    userId: string;
    status: MemberStatus;
    band: Band;
    role: RoleFlags;
}

export interface SpaceNode {
    id: string;
    parentId: string | null;
    inheritsMembership: boolean;
    ownerId: string;
    agentRetrieval: AgentRetrieval;
}

export interface InviteRefusal {
    ok: false;
    /** Stable code. The sentence in `message` is what a person reads. */
    code:
        | 'not-signed-in'
        | 'unknown-space'
        | 'not-a-member'
        | 'cannot-invite'
        | 'above-ceiling'
        | 'sealed'
        | 'member-cap'
        | 'owner-seed';
    message: string;
}

export type InviteDecision =
    | { ok: true; status: 'Invited' | 'Active' }
    | InviteRefusal;

const ACTIVE = 'Active';

function byId(spaces: readonly SpaceNode[]): Map<string, SpaceNode> {
    return new Map(spaces.map((space) => [space.id, space]));
}

/**
 * The membership that governs `targetId` for this person.
 *
 * A direct row on the target wins. Otherwise walk to the parent, and only
 * when this space inherits. A space with `inheritsMembership` false is sealed:
 * a parent member does not reach it. The first membership found on that walk
 * is the one whose role flags apply.
 */
export function membershipReaches(
    spaces: readonly SpaceNode[],
    memberships: readonly MemberSnapshot[],
    userId: string,
    targetId: string,
): MemberSnapshot | null {
    const index = byId(spaces);
    const active = memberships.filter((member) => member.userId === userId && member.status === ACTIVE);
    let current = index.get(targetId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        const direct = active.find((member) => member.spaceId === current!.id);
        if (direct) {
            return direct;
        }
        if (!current.inheritsMembership || !current.parentId) {
            return null;
        }
        current = index.get(current.parentId);
    }
    return null;
}

/** Every space this person's active memberships reach, including sealed stops. */
export function visibleSpaces(
    spaces: readonly SpaceNode[],
    memberships: readonly MemberSnapshot[],
    userId: string,
): SpaceNode[] {
    return spaces.filter((space) => membershipReaches(spaces, memberships, userId, space.id) !== null);
}

/** The invited person may flip their own row from Invited to Active. Nobody else may, except through a new grant. */
export function isSelfAccept(input: {
    callerUserId: string | null;
    inviteeUserId: string;
    previousStatus: MemberStatus;
    nextStatus: MemberStatus;
}): boolean {
    return input.callerUserId === input.inviteeUserId
        && input.previousStatus === 'Invited'
        && input.nextStatus === 'Active';
}

/** True when setting `parentId` on `spaceId` would put the space inside its own subtree. */
export function parentCreatesCycle(spaces: readonly SpaceNode[], spaceId: string, parentId: string | null): boolean {
    if (!parentId) {
        return false;
    }
    if (parentId === spaceId) {
        return true;
    }
    const index = byId(spaces);
    let current = index.get(parentId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
        if (current.id === spaceId) {
            return true;
        }
        seen.add(current.id);
        current = current.parentId ? index.get(current.parentId) : undefined;
    }
    return false;
}

export function initialMemberStatus(approval: InviteApproval): 'Invited' | 'Active' {
    return approval === 'AutoApprove' ? 'Active' : 'Invited';
}

function countTowardCap(memberships: readonly MemberSnapshot[], spaceId: string): number {
    return memberships.filter((member) => member.spaceId === spaceId && member.status !== 'Removed').length;
}

/**
 * Whether `callerUserId` may add `inviteeUserId` to `targetSpaceId` with `granted`.
 *
 * The four clauses from the plan, plus the two that make the first row possible:
 * the owner of an empty space may seat themselves in the owner role, and a
 * member cap on the type stops the roster from growing past it.
 */
export function refuseInvite(input: {
    callerUserId: string | null;
    inviteeUserId: string;
    targetSpaceId: string;
    granted: RoleFlags;
    approval: InviteApproval;
    memberCap: number | null;
    spaces: readonly SpaceNode[];
    memberships: readonly MemberSnapshot[];
}): InviteDecision {
    if (!input.callerUserId) {
        return { ok: false, code: 'not-signed-in', message: 'Invite refused: there is no signed-in user to grant it.' };
    }
    const target = input.spaces.find((space) => space.id === input.targetSpaceId);
    if (!target) {
        return { ok: false, code: 'unknown-space', message: 'Invite refused: that space does not exist.' };
    }

    const occupied = countTowardCap(input.memberships, target.id);
    if (input.memberCap !== null && occupied >= input.memberCap) {
        return {
            ok: false,
            code: 'member-cap',
            message: `Invite refused: this space already has ${occupied} members, and its type caps the roster at ${input.memberCap}.`,
        };
    }

    const grantor = membershipReaches(input.spaces, input.memberships, input.callerUserId, target.id);
    if (!grantor) {
        const seatingSelf = input.callerUserId === input.inviteeUserId && input.callerUserId === target.ownerId && input.granted.isOwnerRole;
        const nobodyHere = occupied === 0;
        if (seatingSelf && nobodyHere) {
            return { ok: true, status: 'Active' };
        }
        return {
            ok: false,
            code: 'not-a-member',
            message: 'Invite refused: the signer is not an active member of this space.',
        };
    }

    if (!grantor.role.canInvite) {
        return { ok: false, code: 'cannot-invite', message: 'Invite refused: this role cannot invite.' };
    }
    if (input.granted.level > grantor.role.maxGrantableLevel) {
        return {
            ok: false,
            code: 'above-ceiling',
            message: 'Invite refused: that role is above the level this member may grant.',
        };
    }

    return { ok: true, status: initialMemberStatus(input.approval) };
}

export interface PromotionDecision {
    ok: true;
    band: Band;
    promotedAt: Date | null;
    promotedByUserId: string | null;
}

/**
 * Team items carry no promotion stamp. Shared items always do.
 * Moving Team → Shared requires `canPromoteBand` on a membership that reaches the item's space.
 */
export function promotionStamps(input: {
    callerUserId: string | null;
    itemSpaceId: string;
    nextBand: Band;
    now: Date;
    spaces: readonly SpaceNode[];
    memberships: readonly MemberSnapshot[];
}): PromotionDecision | InviteRefusal {
    if (input.nextBand === 'Team') {
        return { ok: true, band: 'Team', promotedAt: null, promotedByUserId: null };
    }
    if (!input.callerUserId) {
        return { ok: false, code: 'not-signed-in', message: 'Promotion refused: there is no signed-in user to record.' };
    }
    const grantor = membershipReaches(input.spaces, input.memberships, input.callerUserId, input.itemSpaceId);
    if (!grantor) {
        return { ok: false, code: 'not-a-member', message: 'Promotion refused: the signer is not an active member of this space.' };
    }
    if (!grantor.role.canPromoteBand) {
        return { ok: false, code: 'cannot-invite', message: 'Promotion refused: this role cannot move material to the shared band.' };
    }
    return {
        ok: true,
        band: 'Shared',
        promotedAt: input.now,
        promotedByUserId: input.callerUserId,
    };
}

/**
 * Retrieval for one item. The caller already passed the read ceiling
 * (`callerCanRead`). This only narrows: subtree, band, and agent policy.
 *
 * `askedFromSpaceId` is the space the question was asked in. An item is in
 * that subtree when the asked space is the item's space or an ancestor of it.
 * `ExcludedFromParentScope` drops the item when the question was asked above
 * that space. `ExcludedEntirely` drops it for every agent.
 */
export function agentMayQuote(input: {
    callerCanRead: boolean;
    callerCanSeeTeam: boolean;
    itemBand: Band;
    itemSpaceId: string;
    askedFromSpaceId: string;
    spaces: readonly SpaceNode[];
}): boolean {
    if (!input.callerCanRead) {
        return false;
    }
    if (input.itemBand === 'Team' && !input.callerCanSeeTeam) {
        return false;
    }
    const index = byId(input.spaces);
    const itemSpace = index.get(input.itemSpaceId);
    if (!itemSpace) {
        return false;
    }
    if (itemSpace.agentRetrieval === 'ExcludedEntirely') {
        return false;
    }
    const inSubtree = isAncestorOrSelf(index, input.askedFromSpaceId, input.itemSpaceId);
    if (!inSubtree) {
        return false;
    }
    if (itemSpace.agentRetrieval === 'ExcludedFromParentScope' && input.askedFromSpaceId !== input.itemSpaceId) {
        const askedIsStrictAncestor = input.askedFromSpaceId !== input.itemSpaceId && isAncestorOrSelf(index, input.askedFromSpaceId, input.itemSpaceId);
        if (askedIsStrictAncestor) {
            return false;
        }
    }
    return true;
}

function isAncestorOrSelf(index: Map<string, SpaceNode>, ancestorId: string, nodeId: string): boolean {
    let current = index.get(nodeId);
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
        if (current.id === ancestorId) {
            return true;
        }
        seen.add(current.id);
        current = current.parentId ? index.get(current.parentId) : undefined;
    }
    return false;
}

/**
 * Calendar month or calendar year from `startedAt`, in UTC. The day is clamped
 * to the last day of the target month, so 31 January plus one month is 28
 * February (or 29 in a leap year), not a spill into March. Indefinite has no deadline.
 */
export function retentionDeadline(startedAt: Date, retention: Retention): Date | null {
    if (retention === 'Indefinite') {
        return null;
    }
    return addUtcMonths(startedAt, retention === 'Month' ? 1 : 12);
}

function addUtcMonths(startedAt: Date, months: number): Date {
    const monthIndex = startedAt.getUTCMonth() + months;
    const year = startedAt.getUTCFullYear() + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(startedAt.getUTCDate(), lastDay);
    return new Date(Date.UTC(
        year,
        month,
        day,
        startedAt.getUTCHours(),
        startedAt.getUTCMinutes(),
        startedAt.getUTCSeconds(),
        startedAt.getUTCMilliseconds(),
    ));
}
