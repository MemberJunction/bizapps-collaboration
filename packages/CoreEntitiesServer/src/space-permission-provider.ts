/**
 * Permission domain for a space. The answer comes from the roster, the same
 * reach walk the filters use. Read follows an active membership. Update and
 * Share follow the owner role.
 */
import {
    Metadata,
    PermissionProviderBase,
    RunView,
    type NormalizedPermission,
    type PermissionAction,
    type PermissionCheckResult,
    type UserInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { rosterActions, type MemberSnapshot, type RoleFlags, type RosterAction, type SpaceNode } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { parseUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';
const DOMAIN = 'Collaboration Spaces';

type SpaceRow = {
    ID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    OwnerID: string;
    AgentRetrieval: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
};

@RegisterClass(PermissionProviderBase, 'CollaborationSpacePermissionProvider')
export class CollaborationSpacePermissionProvider extends PermissionProviderBase {
    readonly DomainName = DOMAIN;
    readonly Description = 'Who reaches a Collaboration space, read from the roster.';
    readonly SupportedGranteeTypes = ['User' as const];
    readonly SupportedActions: PermissionAction[] = ['Read', 'Update', 'Share'];
    readonly SupportsDeny = false;

    override GetResourceTypes(): string[] {
        return ['Space'];
    }

    async CheckPermission(user: UserInfo, resourceType: string, resourceId: string | null, action: PermissionAction): Promise<PermissionCheckResult> {
        if (resourceType && resourceType !== 'Space') {
            return { Allowed: false, DomainName: DOMAIN, Reason: 'This domain only answers for a space.' };
        }
        if (!resourceId) {
            return { Allowed: false, DomainName: DOMAIN, Reason: 'Name the space.' };
        }
        const actions = await actionsFor(user, resourceId);
        const allowed = actions.includes(action as RosterAction);
        return {
            Allowed: allowed,
            DomainName: DOMAIN,
            Reason: allowed ? `The roster grants ${action}.` : `The roster does not grant ${action}.`,
        };
    }

    async GetEffectivePermissions(user: UserInfo, resourceType: string, resourceId: string): Promise<NormalizedPermission[]> {
        if (resourceType && resourceType !== 'Space') return [];
        const actions = await actionsFor(user, resourceId);
        if (!actions.length) return [];
        return [this.permission(resourceId, user.ID, user.Name, actions)];
    }

    async GetUserResources(user: UserInfo): Promise<NormalizedPermission[]> {
        const view = new RunView();
        const mine = await view.RunView<{ SpaceID: string }>({
            EntityName: MEMBERS,
            ExtraFilter: `UserID = '${user.ID}' AND Status = 'Active'`,
            Fields: ['SpaceID'],
            ResultType: 'simple',
            MaxRows: 500,
        }, user);
        if (!mine.Success) return [];
        const results: NormalizedPermission[] = [];
        const seen = new Set<string>();
        for (const row of mine.Results ?? []) {
            const spaceId = row.SpaceID;
            if (!spaceId || seen.has(spaceId.toLowerCase())) continue;
            seen.add(spaceId.toLowerCase());
            results.push(...await this.GetEffectivePermissions(user, 'Space', spaceId));
        }
        return results;
    }

    async GetResourcePermissions(resourceType: string, resourceId: string): Promise<NormalizedPermission[]> {
        if (resourceType && resourceType !== 'Space') return [];
        const probe = await new Metadata().GetEntityObject(SPACES);
        const system = await requireSystemUser(probe);
        const graph = await rosterGraph(system, resourceId);
        const people = new Map<string, string>();
        for (const member of graph.memberships) people.set(member.userId.toLowerCase(), member.userId);
        const results: NormalizedPermission[] = [];
        for (const userId of people.values()) {
            const actions = rosterActions({ callerUserId: userId, spaceId: resourceId, spaces: graph.spaces, memberships: graph.memberships });
            if (!actions.length) continue;
            results.push(this.permission(resourceId, userId, undefined, actions));
        }
        return results;
    }

    private permission(resourceId: string, userId: string, name: string | undefined, actions: RosterAction[]): NormalizedPermission {
        return this.buildNormalizedPermission({
            resourceType: 'Space',
            resourceId,
            granteeType: 'User',
            granteeId: userId,
            granteeName: name,
            actions,
        });
    }
}

async function actionsFor(user: UserInfo, spaceId: string): Promise<RosterAction[]> {
    const probe = await new Metadata().GetEntityObject(SPACES, user);
    const context = await loadWriteContext(probe, user, spaceId, null);
    return rosterActions({
        callerUserId: user.ID,
        spaceId,
        spaces: context.spaces,
        memberships: context.memberships,
    });
}

async function rosterGraph(user: UserInfo, spaceId: string): Promise<{ spaces: SpaceNode[]; memberships: MemberSnapshot[] }> {
    const view = new RunView();
    const spaces: SpaceNode[] = [];
    const spaceIds: string[] = [];
    let current: string | null = spaceId;
    const seen = new Set<string>();
    while (current && !seen.has(current.toLowerCase())) {
        seen.add(current.toLowerCase());
        const rows: { Success: boolean; Results?: SpaceRow[] } = await view.RunView<SpaceRow>({
            EntityName: SPACES,
            ExtraFilter: `ID = '${current}'`,
            Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval'],
            MaxRows: 1,
            ResultType: 'simple',
        }, user);
        const row: SpaceRow | undefined = rows.Results?.[0];
        if (!rows.Success || !row) break;
        spaces.push({
            id: parseUuid(row.ID) ?? row.ID,
            parentId: row.ParentID ? parseUuid(row.ParentID) : null,
            inheritsMembership: !!row.InheritsMembership,
            ownerId: parseUuid(row.OwnerID) ?? row.OwnerID,
            agentRetrieval: row.AgentRetrieval,
        });
        spaceIds.push(row.ID);
        current = row.ParentID;
    }
    if (!spaceIds.length) return { spaces, memberships: [] };
    const members = await view.RunView<{ SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: MemberSnapshot['band']; SpaceRoleTypeID: string }>({
        EntityName: MEMBERS,
        ExtraFilter: `SpaceID IN (${spaceIds.map((id) => `'${id}'`).join(',')}) AND Status = 'Active'`,
        Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
        ResultType: 'simple',
        MaxRows: 500,
    }, user);
    const roles = await view.RunView<{ ID: string; Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute: boolean }>({
        EntityName: ROLES,
        ExtraFilter: 'ID IS NOT NULL',
        Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
        ResultType: 'simple',
        MaxRows: 50,
    }, user);
    const flags = new Map<string, RoleFlags>();
    for (const role of roles.Results ?? []) {
        flags.set(role.ID.toLowerCase(), {
            level: role.Level,
            maxGrantableLevel: role.MaxGrantableLevel,
            canInvite: !!role.CanInvite,
            canPromoteBand: !!role.CanPromoteBand,
            canSeeTeamBand: !!role.CanSeeTeamBand,
            isOwnerRole: !!role.IsOwnerRole,
            canContribute: !!role.CanContribute,
        });
    }
    const empty: RoleFlags = { level: 0, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false, canSeeTeamBand: false, isOwnerRole: false, canContribute: false };
    const memberships = (members.Results ?? []).map((member) => ({
        spaceId: parseUuid(member.SpaceID) ?? member.SpaceID,
        userId: parseUuid(member.UserID) ?? member.UserID,
        status: member.Status,
        band: member.Band,
        role: flags.get(member.SpaceRoleTypeID.toLowerCase()) ?? empty,
    }));
    return { spaces, memberships };
}

export function LoadCollaborationPermissionProvider(): void {
    void CollaborationSpacePermissionProvider;
}
