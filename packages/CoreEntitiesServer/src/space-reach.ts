/**
 * Who reaches a space, for an operation that has a provider and a caller but no entity in hand: the space's chain to the root and the
 * caller's active seats with their roles, read as the system user, judged by Core's `membershipReaches`.
 */
import { type IMetadataProvider, RunView, type RunViewResult, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import { type MemberSnapshot, type RoleFlags, type SpaceNode } from '@mj-biz-apps/collaboration-core';
import { type SpaceRow, toNode } from './load-graph.js';
import { parseUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';

export interface SpaceReach {
    /** The space and its ancestors, nearest first. Empty when the space does not exist. */
    spaces: SpaceNode[];
    /** The caller's active seats, with their roles. */
    memberships: MemberSnapshot[];
}

interface RoleRow { ID: string; Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean }
interface MemberRow { SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: MemberSnapshot['band']; SpaceRoleTypeID: string }

const flagsOf = (role: RoleRow): RoleFlags => ({
    level: Number(role.Level),
    maxGrantableLevel: Number(role.MaxGrantableLevel),
    canInvite: !!role.CanInvite,
    canPromoteBand: !!role.CanPromoteBand,
    canSeeTeamBand: !!role.CanSeeTeamBand,
    isOwnerRole: !!role.IsOwnerRole,
    canContribute: !!role.CanContribute,
});

/** Reads the chain and the caller's seats. A read that fails throws, so the caller refuses rather than judging on a partial picture. */
export async function loadReach(provider: IMetadataProvider, user: UserInfo, spaceId: string): Promise<SpaceReach> {
    const system = (await WellKnownUserSource.Instance.GetSystemUser(provider)) ?? user;
    const rv = RunView.FromMetadataProvider(provider);
    const caller = parseUuid(user.ID);
    const start = parseUuid(spaceId);
    if (!caller || !start) return { spaces: [], memberships: [] };

    const spaces: SpaceNode[] = [];
    const seen = new Set<string>();
    let current: string | null = start;
    while (current && !seen.has(current.toLowerCase())) {
        seen.add(current.toLowerCase());
        const read: RunViewResult<SpaceRow> = await rv.RunView<SpaceRow>({
            EntityName: SPACES,
            ExtraFilter: `ID = '${current}'`,
            Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'SpaceTypeID', 'AllowParentAssignees', 'ClosedAt', 'StatusID'],
            ResultType: 'simple',
            MaxRows: 1,
        }, system);
        if (!read.Success) throw new Error(`The space ${current} could not be read: ${read.ErrorMessage ?? 'unknown error'}`);
        const row: SpaceRow | undefined = read.Results?.[0];
        if (!row) break;
        spaces.push(toNode(row));
        current = row.ParentID ? parseUuid(row.ParentID) : null;
    }

    const seats = await rv.RunView<MemberRow>({
        EntityName: MEMBERS,
        ExtraFilter: `UserID = '${caller}' AND Status = 'Active'`,
        Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
        ResultType: 'simple',
        MaxRows: 2000,
    }, system);
    if (!seats.Success) throw new Error(`The caller's seats could not be read: ${seats.ErrorMessage ?? 'unknown error'}`);
    if ((seats.Results?.length ?? 0) >= 2000) throw new Error('Refusing: the caller\'s seats came back as a full page, so the check would be incomplete.');
    const seatRows = seats.Results ?? [];
    const roleIds = [...new Set(seatRows.map((row) => parseUuid(row.SpaceRoleTypeID)).filter((id): id is string => !!id))];
    const roles = new Map<string, RoleFlags>();
    if (roleIds.length) {
        const read = await rv.RunView<RoleRow>({
            EntityName: ROLES,
            ExtraFilter: `ID IN (${roleIds.map((id) => `'${id}'`).join(', ')})`,
            Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
            ResultType: 'simple',
            MaxRows: 200,
        }, system);
        if (!read.Success) throw new Error(`The roles could not be read: ${read.ErrorMessage ?? 'unknown error'}`);
        for (const role of read.Results ?? []) roles.set((parseUuid(role.ID) ?? role.ID).toLowerCase(), flagsOf(role));
    }
    const memberships: MemberSnapshot[] = [];
    for (const row of seatRows) {
        const role = roles.get((parseUuid(row.SpaceRoleTypeID) ?? row.SpaceRoleTypeID).toLowerCase());
        if (!role) continue;
        memberships.push({ spaceId: parseUuid(row.SpaceID) ?? row.SpaceID, userId: parseUuid(row.UserID) ?? row.UserID, status: row.Status, band: row.Band, role });
    }
    return { spaces, memberships };
}
