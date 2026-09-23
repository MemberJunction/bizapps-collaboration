import { RunView, type UserInfo } from '@memberjunction/core';
import type { BaseEntity } from '@memberjunction/core';
import type { MemberSnapshot, RoleFlags, SpaceNode } from '@mj-biz-apps/collaboration-core';
import { parseUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';
const TYPES = 'MJ_BizApps_Collaboration: Space Types';

export interface WriteContext {
    spaces: SpaceNode[];
    memberships: MemberSnapshot[];
    role: RoleFlags | null;
    approval: 'Approve' | 'AutoApprove';
    memberCap: number | null;
    memberCount: number;
}

interface SpaceRow {
    ID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    OwnerID: string;
    AgentRetrieval: SpaceNode['agentRetrieval'];
    SpaceTypeID: string;
}

function toNode(row: SpaceRow): SpaceNode {
    return {
        id: row.ID,
        parentId: row.ParentID,
        inheritsMembership: !!row.InheritsMembership,
        ownerId: row.OwnerID,
        agentRetrieval: row.AgentRetrieval,
    };
}

function runViewFor(entity: BaseEntity): RunView {
    const provider = entity.ProviderToUse;
    // ProviderBase is both the entity provider and the view provider. The interfaces
    // are split, so this checks for the method instead of casting through unknown.
    if (!('RunViews' in provider)) {
        throw new Error('The entity provider cannot run views.');
    }
    return new RunView(provider);
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
async function chain(rv: RunView, startId: string, user: UserInfo): Promise<SpaceNode[]> {
    const nodes: SpaceNode[] = [];
    let current: string | null = startId;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
        seen.add(current);
        const rows = await one<SpaceRow>(rv, SPACES, `ID = '${current}'`, user);
        const row = rows[0];
        if (!row) {
            break;
        }
        nodes.push(toNode(row));
        current = row.ParentID;
    }
    return nodes;
}

/**
 * The rows a write needs: the target chain, the caller's memberships, the
 * granted role, and the target's roster count. Not the whole estate.
 */
export async function loadWriteContext(entity: BaseEntity, user: UserInfo, spaceId: string, roleId: string | null): Promise<WriteContext> {
    const rv = runViewFor(entity);
    const caller = parseUuid(user.ID);
    const space = parseUuid(spaceId);
    if (!caller || !space) {
        return { spaces: [], memberships: [], role: null, approval: 'Approve', memberCap: null, memberCount: 0 };
    }
    const results = await rv.RunViews([
        { EntityName: MEMBERS, ExtraFilter: `UserID = '${caller}'`, MaxRows: 2000 },
        { EntityName: ROLES, ExtraFilter: roleId && parseUuid(roleId) ? `ID = '${parseUuid(roleId)}'` : '1 = 0', MaxRows: 5 },
        { EntityName: MEMBERS, ExtraFilter: `SpaceID = '${space}' AND Status <> 'Removed'`, MaxRows: 2000 },
    ], user);
    for (const result of results) {
        if (!result.Success) {
            throw new Error(result.ErrorMessage ?? 'Could not read the space graph.');
        }
        if ((result.Results?.length ?? 0) >= 2000) {
            throw new Error('Refusing the write: a roster page came back full, so the check would be incomplete.');
        }
    }
    const spaces = await chain(rv, space, user);
    const typeId = spaces[0] ? (await one<{ SpaceTypeID: string }>(rv, SPACES, `ID = '${space}'`, user))[0]?.SpaceTypeID : null;
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
        for (const role of loaded) {
            roleLookup.set(role.ID, flags(role));
        }
    }
    const granted = roleRows[0] ? flags(roleRows[0]) : null;
    return {
        spaces,
        memberships: memberRows.map((row) => ({
            spaceId: row.SpaceID,
            userId: row.UserID,
            status: row.Status,
            band: row.Band,
            role: roleLookup.get(row.SpaceRoleTypeID) ?? emptyRole(),
        })),
        role: granted,
        approval: typeRows[0]?.InviteApproval ?? 'Approve',
        memberCap: typeRows[0]?.MemberCap ?? null,
        memberCount: (results[2].Results ?? []).length,
    };
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

function emptyRole(): RoleFlags {
    return { level: 0, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false, canSeeTeamBand: false, isOwnerRole: false, canContribute: false };
}

export function callerUuid(user: UserInfo | null | undefined): string | null {
    return parseUuid(user?.ID);
}
