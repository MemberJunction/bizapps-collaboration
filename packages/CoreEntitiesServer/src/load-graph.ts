import { RunView, type UserInfo } from '@memberjunction/core';
import type { MemberSnapshot, RoleFlags, SpaceNode } from '@mj-biz-apps/collaboration-core';
import { requireUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';
const TYPES = 'MJ_BizApps_Collaboration: Space Types';

interface SpaceRow {
    ID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    OwnerID: string;
    AgentRetrieval: SpaceNode['agentRetrieval'];
    SpaceTypeID: string;
}

interface MemberRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    Status: MemberSnapshot['status'];
    Band: MemberSnapshot['band'];
    SpaceRoleTypeID: string;
}

interface RoleRow {
    ID: string;
    Level: number;
    MaxGrantableLevel: number;
    CanInvite: boolean;
    CanPromoteBand: boolean;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
}

export interface CollaborationGraph {
    spaces: SpaceNode[];
    memberships: MemberSnapshot[];
    roles: Map<string, RoleFlags>;
    typeBySpaceId: Map<string, { approval: 'Approve' | 'AutoApprove'; memberCap: number | null }>;
}

async function run<T>(entityName: string, user: UserInfo): Promise<T[]> {
    const rv = new RunView();
    const result = await rv.RunView({ EntityName: entityName, MaxRows: 5000 }, user);
    if (!result.Success) {
        throw new Error(result.ErrorMessage ?? `Could not read ${entityName}.`);
    }
    return (result.Results ?? []) as T[];
}

/**
 * The slice of the graph the write gates need. Filters are UUID-only so the
 * interpolated ExtraFilter cannot widen.
 */
export async function loadCollaborationGraph(user: UserInfo): Promise<CollaborationGraph> {
    const [spaceRows, memberRows, roleRows, typeRows] = await Promise.all([
        run<SpaceRow>(SPACES, user),
        run<MemberRow>(MEMBERS, user),
        run<RoleRow>(ROLES, user),
        run<{ ID: string; InviteApproval: 'Approve' | 'AutoApprove'; MemberCap: number | null }>(TYPES, user),
    ]);
    const roles = new Map(roleRows.map((role) => [role.ID, role]));
    const spaces: SpaceNode[] = spaceRows.map((row) => ({
        id: row.ID,
        parentId: row.ParentID,
        inheritsMembership: !!row.InheritsMembership,
        ownerId: row.OwnerID,
        agentRetrieval: row.AgentRetrieval,
    }));
    const memberships: MemberSnapshot[] = memberRows.map((row) => {
        const role = roles.get(row.SpaceRoleTypeID);
        return {
            spaceId: row.SpaceID,
            userId: row.UserID,
            status: row.Status,
            band: row.Band,
            role: {
                level: role?.Level ?? 0,
                maxGrantableLevel: role?.MaxGrantableLevel ?? 0,
                canInvite: !!role?.CanInvite,
                canPromoteBand: !!role?.CanPromoteBand,
                canSeeTeamBand: !!role?.CanSeeTeamBand,
                isOwnerRole: !!role?.IsOwnerRole,
            },
        };
    });
    const typeById = new Map(typeRows.map((row) => [row.ID, { approval: row.InviteApproval, memberCap: row.MemberCap }]));
    const typeBySpaceId = new Map(spaceRows.map((row) => [row.ID, typeById.get(row.SpaceTypeID) ?? { approval: 'Approve' as const, memberCap: null }]));
    const roles = new Map<string, RoleFlags>(roleRows.map((role) => [role.ID, {
        level: role.Level,
        maxGrantableLevel: role.MaxGrantableLevel,
        canInvite: !!role.CanInvite,
        canPromoteBand: !!role.CanPromoteBand,
        canSeeTeamBand: !!role.CanSeeTeamBand,
        isOwnerRole: !!role.IsOwnerRole,
    }]));
    return { spaces, memberships, roles, typeBySpaceId };
}

export function callerId(user: UserInfo | null | undefined): string | null {
    if (!user?.ID) {
        return null;
    }
    return requireUuid(user.ID, 'UserID');
}
