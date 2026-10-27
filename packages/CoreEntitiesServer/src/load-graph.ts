import { Metadata, RunView, WellKnownUserSource, type UserInfo } from '@memberjunction/core';
import type { BaseEntity } from '@memberjunction/core';
import { membershipReaches, type MemberSnapshot, type RoleFlags, type SpaceNode } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { asMetadata, parseUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';
const TYPES = 'MJ_BizApps_Collaboration: Space Types';

export interface WriteContext {
    spaces: SpaceNode[];
    memberships: MemberSnapshot[];
    role: RoleFlags | null;
    roles: Map<string, RoleFlags>;
    approval: 'Approve' | 'AutoApprove';
    memberCap: number | null;
    memberCount: number;
    ownerCount: number;
    /** The target space's type, for the rules that read the type's promise (item 157). */
    typeId?: string | null;
}

export interface SpaceRow {
    ID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    OwnerID: string;
    AgentRetrieval: SpaceNode['agentRetrieval'];
    SpaceTypeID: string;
    AllowParentAssignees?: boolean;
    ClosedAt?: string | Date | null;
    StatusID?: string | null;
}

export function toNode(row: SpaceRow): SpaceNode {
    return {
        id: parseUuid(row.ID) ?? row.ID,
        parentId: row.ParentID ? parseUuid(row.ParentID) : null,
        inheritsMembership: !!row.InheritsMembership,
        ownerId: parseUuid(row.OwnerID) ?? row.OwnerID,
        agentRetrieval: row.AgentRetrieval,
        allowParentAssignees: row.AllowParentAssignees !== undefined ? !!row.AllowParentAssignees : true,
        closedAt: row.ClosedAt ? String(row.ClosedAt) : null,
        // The space's effective status, from the engine's statuses; null for a type with none, which the rules read from ClosedAt alone
        status: CollaborationEngine.Instance.StatusReachForSpace(row),
    };
}

function runViewFor(entity: BaseEntity): RunView {
    return new RunView(entity.RunViewProviderToUse);
}

async function one<T>(rv: RunView, entityName: string, filter: string, user: UserInfo): Promise<T[]> {
    const result = await rv.RunView<T>({ EntityName: entityName, ExtraFilter: filter, MaxRows: 2000 }, user);
    if (!result.Success) {
        throw new Error(result.ErrorMessage ?? `Could not read ${entityName}.`);
    }
    if ((result.Results?.length ?? 0) >= 2000) {
        throw new Error(`Refusing the write: ${entityName} returned a full page, so the check would be incomplete.`);
    }
    return result.Results ?? [];
}

/** Ancestors of `startId`, including it, following ParentID. Stops if a parent is not visible. */
async function chain(rv: RunView, startId: string, user: UserInfo): Promise<{ nodes: SpaceNode[]; typeId: string | null }> {
    const nodes: SpaceNode[] = [];
    let typeId: string | null = null;
    let current: string | null = startId;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
        seen.add(current);
        const rows: SpaceRow[] = await one<SpaceRow>(rv, SPACES, `ID = '${current}'`, user);
        const row: SpaceRow | undefined = rows[0];
        if (!row) {
            break;
        }
        if (!typeId) {
            typeId = row.SpaceTypeID;
        }
        nodes.push(toNode(row));
        current = row.ParentID;
    }
    return { nodes, typeId };
}

/**
 * The rows a write needs: the target chain, the caller's memberships, the
 * granted role, and the target's roster count. Not the whole estate.
 */
export async function loadWriteContext(entity: BaseEntity, user: UserInfo, spaceId: string, roleId: string | null, previousRoleId: string | null = null): Promise<WriteContext> {
    const rv = runViewFor(entity);
    const caller = parseUuid(user.ID);
    const space = parseUuid(spaceId);
    if (!caller || !space) {
        return { spaces: [], memberships: [], role: null, roles: new Map(), approval: 'Approve', memberCap: null, memberCount: 0, ownerCount: 0, typeId: null };
    }
    const results = await rv.RunViews([
        { EntityName: MEMBERS, ExtraFilter: `UserID = '${caller}'`, MaxRows: 2000 },
        { EntityName: ROLES, ExtraFilter: roleFilter(roleId, previousRoleId), MaxRows: 5 },
    ], user);
    for (const result of results) {
        if (!result.Success) {
            throw new Error(result.ErrorMessage ?? 'Could not read the space graph.');
        }
        if ((result.Results?.length ?? 0) >= 2000) {
            throw new Error('Refusing the write: a roster page came back full, so the check would be incomplete.');
        }
    }
    const system = await requireSystemUser(entity);
    const counted = await one<{ ID: string }>(rv, MEMBERS, `SpaceID = '${space}' AND Status <> 'Removed'`, system);
    const ownerRoles = await one<{ ID: string }>(rv, ROLES, 'IsOwnerRole = 1', system);
    const ownerIds = ownerRoles.map((role) => `'${role.ID}'`).join(', ');
    const owners = ownerIds
        ? await one<{ ID: string }>(rv, MEMBERS, `SpaceID = '${space}' AND Status = 'Active' AND SpaceRoleTypeID IN (${ownerIds})`, system)
        : [];
    const walked = await chain(rv, space, system);
    const spaces = walked.nodes;
    const typeId = walked.typeId;
    const typeRows = typeId && parseUuid(typeId)
        ? await one<{ InviteApproval: 'Approve' | 'AutoApprove'; MemberCap: number | null }>(rv, TYPES, `ID = '${parseUuid(typeId)}'`, user)
        : [];
    const memberRows = (results[0].Results ?? []) as { SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: MemberSnapshot['band']; SpaceRoleTypeID: string }[];
    const roleRows = (results[1].Results ?? []) as { Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean; ID: string }[];
    const roleIds = [...new Set(memberRows.map((row) => row.SpaceRoleTypeID).filter((id) => parseUuid(id)))];
    const roleLookup = new Map<string, RoleFlags>();
    if (roleIds.length) {
        const loaded = await one<{ ID: string; Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean }>(
            rv,
            ROLES,
            `ID IN (${roleIds.map((id) => `'${id}'`).join(',')})`,
            user,
        );
        roleRows.push(...loaded);
    }
    for (const role of roleRows) {
        const id = parseUuid(role.ID);
        if (id) roleLookup.set(id, flags(role));
    }
    const granted = parseUuid(roleId) ? roleLookup.get(parseUuid(roleId) ?? '') ?? null : null;
    return {
        spaces,
        memberships: memberRows.map((row) => ({
            spaceId: parseUuid(row.SpaceID) ?? row.SpaceID,
            userId: parseUuid(row.UserID) ?? row.UserID,
            status: row.Status,
            band: row.Band,
            role: roleLookup.get(parseUuid(row.SpaceRoleTypeID) ?? '') ?? emptyRole(),
        })),
        role: roleId ? (roleLookup.get(parseUuid(roleId) ?? '') ?? granted) : granted,
        roles: roleLookup,
        approval: typeRows[0]?.InviteApproval ?? 'Approve',
        memberCap: typeRows[0]?.MemberCap ?? null,
        memberCount: counted.length,
        ownerCount: owners.length,
        typeId: typeId ? parseUuid(typeId) : null,
    };
}

function roleFilter(roleId: string | null, previousRoleId: string | null): string {
    const ids = [parseUuid(roleId), parseUuid(previousRoleId)].filter((id): id is string => !!id);
    if (!ids.length) return '1 = 0';
    return `ID IN (${ids.map((id) => `'${id}'`).join(', ')})`;
}

function flags(role: { Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean }): RoleFlags {
    return {
        level: role.Level,
        maxGrantableLevel: role.MaxGrantableLevel,
        canInvite: !!role.CanInvite,
        canPromoteBand: !!role.CanPromoteBand,
        canSeeTeamBand: !!role.CanSeeTeamBand,
        isOwnerRole: !!role.IsOwnerRole,
        canContribute: !!role.CanContribute,
    };
}

/**
 * The seat that governs `spaceId` for `memberUserId`. `reader` is who the
 * query runs as, and is not the member. A full page is refused rather than
 * treated as the whole roster.
 */
export async function loadMemberReach(entity: BaseEntity, reader: UserInfo, memberUserId: string, spaceId: string): Promise<MemberSnapshot | null> {
    const member = parseUuid(memberUserId);
    const space = parseUuid(spaceId);
    if (!member || !space) return null;
    const rv = runViewFor(entity);
    const memberRows = await one<{ SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: MemberSnapshot['band']; SpaceRoleTypeID: string }>(
        rv,
        MEMBERS,
        `UserID = '${member}' AND Status = 'Active'`,
        reader,
    );
    const roleIds = [...new Set(memberRows.map((row) => parseUuid(row.SpaceRoleTypeID)).filter((id): id is string => !!id))];
    const roleRows = roleIds.length
        ? await one<{ ID: string; Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean }>(
            rv,
            ROLES,
            `ID IN (${roleIds.map((id) => `'${id}'`).join(',')})`,
            reader,
        )
        : [];
    const roleLookup = new Map<string, RoleFlags>();
    for (const role of roleRows) {
        const id = parseUuid(role.ID);
        if (id) roleLookup.set(id, flags(role));
    }
    const walked = await chain(rv, space, reader);
    return membershipReaches(walked.nodes, memberRows.map((row) => ({
        spaceId: parseUuid(row.SpaceID) ?? row.SpaceID,
        userId: parseUuid(row.UserID) ?? row.UserID,
        status: row.Status,
        band: row.Band,
        role: roleLookup.get(parseUuid(row.SpaceRoleTypeID) ?? '') ?? emptyRole(),
    })), member, space);
}

export async function requireSystemUser(entity: BaseEntity): Promise<UserInfo> {
    const provider = asMetadata(entity.ProviderToUse);
    const system = provider ? await WellKnownUserSource.Instance.GetSystemUser(provider) : null;
    if (!system) {
        throw new Error('Refusing the write: the system user is not available, so the roster cannot be counted.');
    }
    return system;
}

export async function loadAncestorChain(entity: BaseEntity, spaceId: string, user: UserInfo): Promise<SpaceNode[]> {
    const walked = await chain(runViewFor(entity), parseUuid(spaceId) ?? spaceId, user);
    return walked.nodes;
}

function emptyRole(): RoleFlags {
    return { level: 0, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false, canSeeTeamBand: false, isOwnerRole: false, canContribute: false };
}

export function callerUuid(user: UserInfo | null | undefined): string | null {
    return parseUuid(user?.ID);
}

/**
 * Whether the user holds the 'Administer Spaces' authorization, read through the entity's own provider. No check anywhere looks at
 * a role's name: the UI, Developer and Integration roles hold it by default, and a host edits the grants.
 */
export function mayAdminister(entity: BaseEntity, user: UserInfo | null | undefined): boolean {
    if (!user) return false;
    return CollaborationEngine.Instance.UserMayAdministerSpaces(user, asMetadata(entity.ProviderToUse) ?? Metadata.Provider);
}
