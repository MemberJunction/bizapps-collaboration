import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { Metadata, RunView, type UserInfo } from '@memberjunction/core';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import type { ResourceData } from '@memberjunction/core-entities';
import type { Band, MemberSnapshot, RoleFlags } from '@mj-biz-apps/collaboration-core';
import { NoAccessComponent } from './no-access.component';
import { SpaceWorkspaceComponent, type WorkspaceRole, type WorkspaceSpace } from './space-workspace.component';

/**
 * The host the workspace was missing. One RunViews call loads the tree,
 * the roster, the material, and the role catalog. Saves go through the
 * entity subclasses, so the same rules the form previewed are the rules
 * the server enforces.
 */
@Component({
    selector: 'mj-collaboration-section',
    standalone: true,
    imports: [SpaceWorkspaceComponent, NoAccessComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
      @if (denied) {
        <mj-collaboration-no-access />
      } @else {
        <mj-collaboration-workspace
          [spaces]="spaces"
          [members]="members"
          [items]="items"
          [roles]="roles"
          [viewerUserId]="viewerId"
          (invite)="onInvite($event)"
          (promote)="onPromote($event)"
          (accept)="onAccept($event)" />
      }
    `,
})
@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')
export class CollaborationSectionResource extends BaseResourceComponent {
    spaces: WorkspaceSpace[] = [];
    members: MemberSnapshot[] = [];
    items: { id: string; spaceId: string; label: string; band: Band }[] = [];
    roles: WorkspaceRole[] = [];
    viewerId: string | null = null;
    denied = false;

    override ngOnInit(): void {
        super.ngOnInit();
        this.NotifyLoadComplete();
        void this.reload();
    }

    private user(): UserInfo | undefined {
        const current = new Metadata().CurrentUser;
        return current ?? undefined;
    }

    private async reload(): Promise<void> {
        const user = this.user();
        this.viewerId = user?.ID ?? null;
        if (!user) {
            this.denied = true;
            return;
        }
        const rv = new RunView();
        const [spaceRows, memberRows, itemRows, roleRows, typeRows] = await rv.RunViews([
            { EntityName: 'MJ_BizApps_Collaboration: Spaces', MaxRows: 500 },
            { EntityName: 'MJ_BizApps_Collaboration: Space Members', MaxRows: 2000 },
            { EntityName: 'MJ_BizApps_Collaboration: Space Items', MaxRows: 2000 },
            { EntityName: 'MJ_BizApps_Collaboration: Space Role Types', ExtraFilter: 'IsActive = 1', MaxRows: 50 },
            { EntityName: 'MJ_BizApps_Collaboration: Space Types', ExtraFilter: 'IsActive = 1', MaxRows: 50 },
        ], user);
        if (!spaceRows.Success) {
            this.denied = true;
            return;
        }
        const types = new Map((typeRows.Results ?? []).map((row: { ID: string; Vocabulary: string; InviteApproval: 'Approve' | 'AutoApprove'; MemberCap: number | null }) => [row.ID, row]));
        this.spaces = (spaceRows.Results ?? []).map((row: { ID: string; Name: string; ParentID: string | null; InheritsMembership: boolean; OwnerID: string; AgentRetrieval: WorkspaceSpace['agentRetrieval']; SpaceTypeID: string; ClosedAt: string | null }) => ({
            id: row.ID,
            name: row.Name,
            parentId: row.ParentID,
            inheritsMembership: !!row.InheritsMembership,
            ownerId: row.OwnerID,
            agentRetrieval: row.AgentRetrieval,
            vocabulary: types.get(row.SpaceTypeID)?.Vocabulary ?? 'space',
            closedAt: row.ClosedAt,
            approval: types.get(row.SpaceTypeID)?.InviteApproval ?? 'Approve',
            memberCap: types.get(row.SpaceTypeID)?.MemberCap ?? null,
        }));
        this.members = (memberRows.Results ?? []).map((row: { SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: Band; User: string; SpaceRoleTypeID: string }) => ({
            spaceId: row.SpaceID,
            userId: row.UserID,
            displayName: row.User,
            status: row.Status,
            band: row.Band,
            role: emptyRole(),
        }));
        this.roles = (roleRows.Results ?? []).map((row: RoleFlags & { ID: string; Name: string }) => ({
            id: row.ID,
            name: row.Name,
            level: row.Level,
            maxGrantableLevel: row.MaxGrantableLevel,
            canInvite: !!row.CanInvite,
            canPromoteBand: !!row.CanPromoteBand,
            canSeeTeamBand: !!row.CanSeeTeamBand,
            isOwnerRole: !!row.IsOwnerRole,
        }));
        const roleById = new Map(this.roles.map((role) => [role.id, role]));
        this.members = (memberRows.Results ?? []).map((row: { SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: Band; User: string; SpaceRoleTypeID: string }) => ({
            spaceId: row.SpaceID,
            userId: row.UserID,
            displayName: row.User,
            status: row.Status,
            band: row.Band,
            role: roleById.get(row.SpaceRoleTypeID) ?? emptyRole(),
        }));
        this.items = (itemRows.Results ?? []).map((row: { ID: string; SpaceID: string; Band: Band; RecordID: string }) => ({
            id: row.ID,
            spaceId: row.SpaceID,
            label: row.RecordID,
            band: row.Band,
        }));
        this.denied = this.spaces.length === 0 && this.members.length === 0;
    }

    async onInvite(event: { spaceId: string; userId: string; roleId: string }): Promise<void> {
        await this.saveMember(event.spaceId, event.userId, event.roleId, null);
    }

    async onAccept(event: { memberUserId: string; spaceId: string }): Promise<void> {
        await this.saveMember(event.spaceId, event.memberUserId, null, 'Active');
    }

    async onPromote(event: { itemId: string }): Promise<void> {
        const user = this.user();
        if (!user) return;
        const md = new Metadata();
        const item = await md.GetEntityObject('MJ_BizApps_Collaboration: Space Items', user);
        if (!(await item.Load(event.itemId))) return;
        item.Set('Band', 'Shared');
        await item.Save();
        await this.reload();
    }

    private async saveMember(spaceId: string, userId: string, roleId: string | null, status: 'Active' | null): Promise<void> {
        const user = this.user();
        if (!user) return;
        const md = new Metadata();
        const member = await md.GetEntityObject('MJ_BizApps_Collaboration: Space Members', user);
        member.NewRecord();
        member.Set('SpaceID', spaceId);
        member.Set('UserID', userId);
        if (roleId) member.Set('SpaceRoleTypeID', roleId);
        if (status) member.Set('Status', status);
        await member.Save();
        await this.reload();
    }

    async GetResourceDisplayName(): Promise<string> {
        return 'Spaces';
    }

    async GetResourceIconClass(): Promise<string> {
        return 'fa-solid fa-people-group';
    }
}

function emptyRole(): RoleFlags {
    return { level: 0, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false, canSeeTeamBand: false, isOwnerRole: false };
}
