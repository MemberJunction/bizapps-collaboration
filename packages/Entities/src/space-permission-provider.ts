/**
 * Permission domain for a space. Loaded with the entity package, so Explorer
 * and the API both register it. Reads go through the caller's provider.
 * The system user is not used. A space id that is not a UUID never reaches SQL.
 */
import {
    Metadata,
    PermissionProviderBase,
    RunView,
    type IMetadataProvider,
    type NormalizedPermission,
    type PermissionAction,
    type PermissionCheckResult,
    type UserInfo,
} from '@memberjunction/core';
import { NormalizeUUID, RegisterClass } from '@memberjunction/global';
import { rosterActions, type MemberSnapshot, type RoleFlags, type RosterAction, type SpaceNode } from '@mj-biz-apps/collaboration-core';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';
const DOMAIN = 'Collaboration Spaces';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 100000;

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

    async CheckPermission(user: UserInfo, resourceType: string, resourceId: string | null, action: PermissionAction, provider?: IMetadataProvider): Promise<PermissionCheckResult> {
        if (resourceType && resourceType !== 'Space') {
            return { Allowed: false, DomainName: DOMAIN, Reason: 'This domain only answers for a space.' };
        }
        const spaceId = asUuid(resourceId);
        if (!spaceId) return { Allowed: false, DomainName: DOMAIN, Reason: 'Name a real space id.' };
        const actions = await actionsFor(user, spaceId, provider);
        const allowed = actions.includes(action as RosterAction);
        return { Allowed: allowed, DomainName: DOMAIN, Reason: allowed ? `The roster grants ${action}.` : `The roster does not grant ${action}.` };
    }

    async GetEffectivePermissions(user: UserInfo, resourceType: string, resourceId: string, provider?: IMetadataProvider): Promise<NormalizedPermission[]> {
        if (resourceType && resourceType !== 'Space') return [];
        const spaceId = asUuid(resourceId);
        if (!spaceId) return [];
        const actions = await actionsFor(user, spaceId, provider);
        if (!actions.length) return [];
        return [this.permission(spaceId, user.ID, user.Name, actions)];
    }

    async GetUserResources(user: UserInfo, resourceType?: string, provider?: IMetadataProvider): Promise<NormalizedPermission[]> {
        if (resourceType && resourceType !== 'Space') return [];
        const userId = asUuid(user.ID);
        if (!userId) return [];
        const view = viewFor(provider);
        const spaces = await view.RunView<{ ID: string; Name: string }>({
            EntityName: SPACES,
            ExtraFilter: `ID IN (SELECT SpaceID FROM __mj_BizAppsCollaboration.fnCollaborationAccess('${userId}'))`,
            Fields: ['ID', 'Name'],
            ResultType: 'simple',
            MaxRows: PAGE,
        }, user);
        if (!spaces.Success) return [];
        if ((spaces.Results?.length ?? 0) >= PAGE) return [];
        const graph = await rosterGraph(user, userId, provider);
        const results: NormalizedPermission[] = [];
        for (const space of spaces.Results ?? []) {
            const actions = rosterActions({ callerUserId: user.ID, spaceId: space.ID, spaces: graph.spaces, memberships: graph.memberships });
            if (!actions.length) continue;
            results.push(this.permission(space.ID, user.ID, user.Name, actions));
        }
        return results;
    }

    async GetResourcePermissions(resourceType: string, resourceId: string, provider?: IMetadataProvider): Promise<NormalizedPermission[]> {
        if (resourceType && resourceType !== 'Space') return [];
        const spaceId = asUuid(resourceId);
        const caller = new Metadata().CurrentUser;
        if (!spaceId || !caller) return [];
        const graph = await rosterGraph(caller, spaceId, provider);
        const people = new Map<string, string>();
        for (const member of graph.memberships) people.set(member.userId.toLowerCase(), member.userId);
        const results: NormalizedPermission[] = [];
        for (const userId of people.values()) {
            const actions = rosterActions({ callerUserId: userId, spaceId, spaces: graph.spaces, memberships: graph.memberships });
            if (!actions.length) continue;
            results.push(this.permission(spaceId, userId, undefined, actions));
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

function asUuid(value: string | null | undefined): string | null {
    const normalized = NormalizeUUID(value);
    return normalized && UUID.test(normalized) ? normalized : null;
}

function viewFor(provider?: IMetadataProvider): RunView {
    return provider ? RunView.FromMetadataProvider(provider) : new RunView();
}

async function actionsFor(user: UserInfo, spaceId: string, provider?: IMetadataProvider): Promise<RosterAction[]> {
    const graph = await rosterGraph(user, spaceId, provider);
    return rosterActions({ callerUserId: user.ID, spaceId, spaces: graph.spaces, memberships: graph.memberships });
}

async function rosterGraph(user: UserInfo, spaceId: string, provider?: IMetadataProvider): Promise<{ spaces: SpaceNode[]; memberships: MemberSnapshot[] }> {
    const view = viewFor(provider);
    const spaces: SpaceNode[] = [];
    const spaceIds: string[] = [];
    let current: string | null = spaceId;
    const seen = new Set<string>();
    while (current && !seen.has(current.toLowerCase())) {
        const id = asUuid(current);
        if (!id) break;
        seen.add(id.toLowerCase());
        const rows = await view.RunView<{ ID: string; ParentID: string | null; InheritsMembership: boolean; OwnerID: string; AgentRetrieval: SpaceNode['agentRetrieval'] }>({
            EntityName: SPACES,
            ExtraFilter: `ID = '${id}'`,
            Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval'],
            MaxRows: 1,
            ResultType: 'simple',
        }, user);
        const row = rows.Results?.[0];
        if (!rows.Success || !row) break;
        spaces.push({
            id: row.ID,
            parentId: row.ParentID,
            inheritsMembership: !!row.InheritsMembership,
            ownerId: row.OwnerID,
            agentRetrieval: row.AgentRetrieval,
        });
        spaceIds.push(row.ID);
        current = row.ParentID;
    }
    if (!spaceIds.length) return { spaces, memberships: [] };
    const members = await view.RunView<{ SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: MemberSnapshot['band']; SpaceRoleTypeID: string }>({
        EntityName: MEMBERS,
        ExtraFilter: `SpaceID IN (${spaceIds.map((id) => `'${asUuid(id)}'`).join(',')}) AND Status = 'Active'`,
        Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
        ResultType: 'simple',
        MaxRows: PAGE,
    }, user);
    if ((members.Results?.length ?? 0) >= PAGE) return { spaces, memberships: [] };
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
            level: Number(role.Level),
            maxGrantableLevel: Number(role.MaxGrantableLevel),
            canInvite: !!role.CanInvite,
            canPromoteBand: !!role.CanPromoteBand,
            canSeeTeamBand: !!role.CanSeeTeamBand,
            isOwnerRole: !!role.IsOwnerRole,
            canContribute: !!role.CanContribute,
        });
    }
    const empty: RoleFlags = { level: 0, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false, canSeeTeamBand: false, isOwnerRole: false, canContribute: false };
    const memberships = (members.Results ?? []).map((member) => ({
        spaceId: member.SpaceID,
        userId: member.UserID,
        status: member.Status,
        band: member.Band,
        role: flags.get(member.SpaceRoleTypeID.toLowerCase()) ?? empty,
    }));
    return { spaces, memberships };
}

export function LoadCollaborationPermissionProvider(): void {
    void CollaborationSpacePermissionProvider;
}
