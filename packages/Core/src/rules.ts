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
    /** May place and move items. Guest is false. Client members are true without the team band. */
    canContribute: boolean;
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

function idKey(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function byId(spaces: readonly SpaceNode[]): Map<string, SpaceNode> {
    return new Map(spaces.map((space) => [idKey(space.id), space]));
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
    const active = memberships.filter((member) => idKey(member.userId) === idKey(userId) && member.status === ACTIVE);
    let current = index.get(idKey(targetId));
    const seen = new Set<string>();
    while (current && !seen.has(idKey(current.id))) {
        seen.add(idKey(current.id));
        const direct = active.find((member) => idKey(member.spaceId) === idKey(current!.id));
        if (direct) {
            return direct;
        }
        if (!current.inheritsMembership || !current.parentId) {
            return null;
        }
        current = index.get(idKey(current.parentId));
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

/** A person may set their own roster row to Removed. They may not change anything else that way. */
export function isSelfRemoval(input: { callerUserId: string | null; inviteeUserId: string; nextStatus: MemberStatus }): boolean {
    return idKey(input.callerUserId) !== '' && idKey(input.callerUserId) === idKey(input.inviteeUserId) && input.nextStatus === 'Removed';
}

/** The last Active owner cannot leave. After that, nobody can manage the space. */
export function leavingWouldStrand(input: { isOwner: boolean; activeOwners: number }): boolean {
    return input.isOwner && input.activeOwners <= 1;
}

/**
 * True when this save takes the last Active owner out of ownership,
 * whether by status, by role, or by both at once.
 */
/**
 * Build the last-owner check from the row being saved, not from the person editing.
 * The saved status and saved owner flag are the database values. The next values are the save.
 */
export function strandFromSavedRow(input: {
    savedStatus: MemberStatus;
    savedIsOwner: boolean;
    nextStatus: MemberStatus;
    nextIsOwner: boolean;
    activeOwners: number;
}): { currentlyActiveOwner: boolean; nextIsActive: boolean; nextIsOwner: boolean; activeOwners: number } {
    return {
        currentlyActiveOwner: input.savedStatus === 'Active' && input.savedIsOwner,
        nextIsActive: input.nextStatus === 'Active',
        nextIsOwner: input.nextIsOwner,
        activeOwners: input.activeOwners,
    };
}

export function wouldStrandLastOwner(input: {
    currentlyActiveOwner: boolean;
    nextIsActive: boolean;
    nextIsOwner: boolean;
    activeOwners: number;
}): boolean {
    if (!input.currentlyActiveOwner) {
        return false;
    }
    const staysOwner = input.nextIsActive && input.nextIsOwner;
    return !staysOwner && input.activeOwners <= 1;
}

/** True when setting `parentId` on `spaceId` would put the space inside its own subtree. */
export function parentCreatesCycle(spaces: readonly SpaceNode[], spaceId: string, parentId: string | null): boolean {
    if (!parentId) {
        return false;
    }
    if (idKey(parentId) === idKey(spaceId)) {
        return true;
    }
    const index = byId(spaces);
    let current = index.get(idKey(parentId));
    const seen = new Set<string>();
    while (current && !seen.has(idKey(current.id))) {
        if (idKey(current.id) === idKey(spaceId)) {
            return true;
        }
        seen.add(idKey(current.id));
        current = current.parentId ? index.get(idKey(current.parentId)) : undefined;
    }
    return false;
}

export type SpaceWriteKind = 'create-root' | 'create-child' | 'edit' | 'move';

/** Which chains a space write loads. `here` is the space as it stands. `destination` is the new parent. */
export function chainsForSpaceWrite(kind: SpaceWriteKind, toRoot = false): { here: boolean; destination: boolean } {
    if (kind === 'create-root') return { here: false, destination: false };
    if (kind === 'create-child') return { here: false, destination: true };
    if (kind === 'edit') return { here: true, destination: false };
    return { here: true, destination: !toRoot };
}

/**
 * Which space the write is authorized against. Creating a child is authorized
 * on the parent, because the new row has no roster yet. A move checks the
 * space as it is now and the destination parent separately.
 */
export function planSpaceWrite(input: {
    isNew: boolean;
    previousParentId: string | null;
    nextParentId: string | null;
}): SpaceWriteKind {
    if (input.isNew) {
        return input.nextParentId ? 'create-child' : 'create-root';
    }
    if ((input.previousParentId ?? null) !== (input.nextParentId ?? null)) {
        return 'move';
    }
    return 'edit';
}

/**
 * Create a child: owner of the parent. Create a root: staff, and the caller is
 * the owner they are about to be. Edit or move: owner of the space as it stands.
 * A move also requires owner of the destination parent. Participants do not create roots.
 */
export function authorizeSpaceWrite(input: {
    kind: SpaceWriteKind;
    callerUserId: string | null;
    callerIsStaff: boolean;
    nextOwnerId: string;
    /** True when a move clears ParentID. Staff and the current owner may do that. */
    toRoot?: boolean;
    /** Reaching membership on the space being edited, before the move. Null on create. */
    here: MemberSnapshot | null;
    /** Reaching membership on the destination parent. */
    onParent: MemberSnapshot | null;
}): InviteRefusal | { ok: true } {
    if (!input.callerUserId) {
        return { ok: false, code: 'not-signed-in', message: 'Space change refused: there is no signed-in user.' };
    }
    if (input.kind === 'create-root') {
        if (!input.callerIsStaff || input.nextOwnerId !== input.callerUserId) {
            return { ok: false, code: 'cannot-invite', message: 'Space change refused: only a staff user may create a root, and they must own it.' };
        }
        return { ok: true };
    }
    if (input.kind === 'create-child') {
        if (!input.onParent?.role.isOwnerRole) {
            return { ok: false, code: 'not-a-member', message: 'Space change refused: only an owner of the parent may create a space under it.' };
        }
        return { ok: true };
    }
    if (!input.here?.role.isOwnerRole) {
        return { ok: false, code: 'cannot-invite', message: 'Space change refused: only an owner of this space may change it.' };
    }
    if (input.kind === 'move' && input.toRoot) {
        if (!input.callerIsStaff) {
            return { ok: false, code: 'cannot-invite', message: 'Space change refused: only a staff user may move a space to the top level.' };
        }
        return { ok: true };
    }
    if (input.kind === 'move' && !input.onParent?.role.isOwnerRole) {
        return { ok: false, code: 'not-a-member', message: 'Space change refused: only an owner of the destination parent may move a space there.' };
    }
    return { ok: true };
}

/**
 * Placing, moving, or demoting an item. The caller must reach every space
 * involved. Leaving the shared band, or entering it, requires CanPromoteBand.
 * A shared item that stays shared does not rewrite the promotion stamp.
 */
export function authorizeItemWrite(input: {
    callerUserId: string | null;
    previousSpaceId: string | null;
    nextSpaceId: string;
    previousBand: Band | null;
    nextBand: Band;
    now: Date;
    spaces: readonly SpaceNode[];
    memberships: readonly MemberSnapshot[];
}): PromotionDecision | InviteRefusal {
    if (!input.callerUserId) {
        return { ok: false, code: 'not-signed-in', message: 'Item change refused: there is no signed-in user.' };
    }
    const next = membershipReaches(input.spaces, input.memberships, input.callerUserId, input.nextSpaceId);
    if (!next) {
        return { ok: false, code: 'not-a-member', message: 'Item change refused: the signer does not reach this space.' };
    }
    if (!next.role.canContribute) {
        return { ok: false, code: 'cannot-invite', message: 'Item change refused: this role cannot add or move material.' };
    }
    const crossesSpace = !!input.previousSpaceId && idKey(input.previousSpaceId) !== idKey(input.nextSpaceId);
    if (crossesSpace && input.previousSpaceId) {
        const previous = membershipReaches(input.spaces, input.memberships, input.callerUserId, input.previousSpaceId);
        if (!previous) {
            return { ok: false, code: 'not-a-member', message: 'Item change refused: the signer does not reach the space this item is leaving.' };
        }
    }
    const sharedMove = crossesSpace && input.previousBand === 'Shared' && input.nextBand === 'Shared';
    if (sharedMove && !next.role.canPromoteBand) {
        return { ok: false, code: 'cannot-invite', message: 'Item change refused: moving shared material to another space requires promote rights there.' };
    }
    const enteringShared = input.nextBand === 'Shared' && input.previousBand !== 'Shared';
    const leavingShared = input.previousBand === 'Shared' && input.nextBand === 'Team';
    if ((enteringShared || leavingShared) && !next.role.canPromoteBand) {
        return { ok: false, code: 'cannot-invite', message: 'Item change refused: this role cannot change the band.' };
    }
    if (input.nextBand === 'Team') {
        return { ok: true, band: 'Team', promotedAt: null, promotedByUserId: null, rewriteStamp: true };
    }
    if (enteringShared || sharedMove) {
        return { ok: true, band: 'Shared', promotedAt: input.now, promotedByUserId: input.callerUserId, rewriteStamp: true };
    }
    return { ok: true, band: 'Shared', promotedAt: null, promotedByUserId: null, rewriteStamp: false };
}

export function initialMemberStatus(approval: InviteApproval): 'Invited' | 'Active' {
    return approval === 'AutoApprove' ? 'Active' : 'Invited';
}

/** A granted flag the grantor does not hold is a wider role, even when its level is lower. */
export function flagExceedsGrantor(granted: RoleFlags, grantor: RoleFlags): string | null {
    if (granted.canSeeTeamBand && !grantor.canSeeTeamBand) return 'see the team band';
    if (granted.canPromoteBand && !grantor.canPromoteBand) return 'promote to the shared band';
    if (granted.canInvite && !grantor.canInvite) return 'invite';
    if (granted.isOwnerRole && !grantor.isOwnerRole) return 'own the space';
    if (granted.canContribute && !grantor.canContribute) return 'add material';
    return null;
}

function countTowardCap(memberships: readonly MemberSnapshot[], spaceId: string): number {
    return memberships.filter((member) => idKey(member.spaceId) === idKey(spaceId) && member.status !== 'Removed').length;
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
    /** When set, the roster size already counted by the server. Otherwise counted from memberships. */
    occupied?: number;
    spaces: readonly SpaceNode[];
    memberships: readonly MemberSnapshot[];
}): InviteDecision {
    if (!input.callerUserId) {
        return { ok: false, code: 'not-signed-in', message: 'Invite refused: there is no signed-in user to grant it.' };
    }
    const target = input.spaces.find((space) => idKey(space.id) === idKey(input.targetSpaceId));
    if (!target) {
        return { ok: false, code: 'unknown-space', message: 'Invite refused: that space does not exist.' };
    }

    const occupied = input.occupied ?? countTowardCap(input.memberships, target.id);
    if (input.memberCap !== null && occupied >= input.memberCap) {
        return {
            ok: false,
            code: 'member-cap',
            message: `Invite refused: this space already has ${occupied} members, and its type caps the roster at ${input.memberCap}.`,
        };
    }

    const grantor = membershipReaches(input.spaces, input.memberships, input.callerUserId, target.id);
    if (!grantor) {
        const seatingSelf = idKey(input.callerUserId) === idKey(input.inviteeUserId) && idKey(input.callerUserId) === idKey(target.ownerId) && input.granted.isOwnerRole;
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
    const flagGap = flagExceedsGrantor(input.granted, grantor.role);
    if (flagGap) {
        return {
            ok: false,
            code: 'above-ceiling',
            message: `Invite refused: the granted role can ${flagGap}, and the signer cannot.`,
        };
    }

    const status = input.approval === 'AutoApprove' || grantor.role.isOwnerRole ? 'Active' : 'Invited';
    return { ok: true, status };
}

export interface PromotionDecision {
    ok: true;
    band: Band;
    promotedAt: Date | null;
    promotedByUserId: string | null;
    /** False when a Shared item stays Shared: the existing stamp is the audit record. */
    rewriteStamp: boolean;
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
        return { ok: true, band: 'Team', promotedAt: null, promotedByUserId: null, rewriteStamp: true };
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
        rewriteStamp: true,
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
    const itemSpace = index.get(idKey(input.itemSpaceId));
    if (!itemSpace) {
        return false;
    }
    if (!isAncestorOrSelf(index, input.askedFromSpaceId, input.itemSpaceId)) {
        return false;
    }
    let current: SpaceNode | undefined = itemSpace;
    const seen = new Set<string>();
    while (current && !seen.has(idKey(current.id))) {
        if (current.agentRetrieval === 'ExcludedEntirely') {
            return false;
        }
        seen.add(idKey(current.id));
        current = current.parentId ? index.get(idKey(current.parentId)) : undefined;
    }
    current = itemSpace;
    const between = new Set<string>();
    while (current && idKey(current.id) !== idKey(input.askedFromSpaceId) && !between.has(idKey(current.id))) {
        if (current.agentRetrieval === 'ExcludedFromParentScope') {
            return false;
        }
        between.add(idKey(current.id));
        current = current.parentId ? index.get(idKey(current.parentId)) : undefined;
    }
    return true;
}

function isAncestorOrSelf(index: Map<string, SpaceNode>, ancestorId: string, nodeId: string): boolean {
    let current = index.get(idKey(nodeId));
    const seen = new Set<string>();
    while (current && !seen.has(idKey(current.id))) {
        if (idKey(current.id) === idKey(ancestorId)) {
            return true;
        }
        seen.add(idKey(current.id));
        current = current.parentId ? index.get(idKey(current.parentId)) : undefined;
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
