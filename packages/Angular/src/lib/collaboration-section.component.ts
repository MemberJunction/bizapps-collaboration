import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { CompositeKey, EntityRecordNameInput, Metadata, RunView, type UserInfo } from '@memberjunction/core';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { ApplicationManager } from '@memberjunction/ng-base-application';
import type { ResourceData } from '@memberjunction/core-entities';
import type { Band, MemberSnapshot, RoleFlags } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
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
        @if (message) { <p class="verdict">{{ message }}</p> }
        <mj-collaboration-workspace
          [spaces]="spaces"
          [members]="members"
          [items]="items"
          [roles]="roles"
          [types]="types"
          [conversations]="conversations"
          [canOpenChat]="canOpenChat"
          (openConversation)="openConversation($event)"
          [viewerUserId]="viewerId"
          [viewerIsStaff]="viewerIsStaff"
          (invite)="onInvite($event)"
          (approve)="onApprove($event)"
          (promote)="onPromote($event)"
          (create)="onCreate($event)" />
      }
    `,
})
@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')
export class CollaborationSectionResource extends BaseResourceComponent {
    spaces: WorkspaceSpace[] = [];
    members: MemberSnapshot[] = [];
    items: { id: string; spaceId: string; label: string; band: Band }[] = [];
    roles: WorkspaceRole[] = [];
    types: { id: string; name: string }[] = [];
    conversations: { spaceId: string; id: string }[] = [];
    get canOpenChat(): boolean {
        return !!this.apps.GetAppByName('Chat');
    }

    openConversation(id: string): void {
        const chat = this.apps.GetAppByName('Chat');
        if (!chat) return;
        this.navigationService.OpenNavItemByName('Conversations', { conversationId: id }, chat.ID);
    }
    viewerId: string | null = null;
    viewerIsStaff = false;
    denied = false;
    message = '';
    private readonly changes = inject(ChangeDetectorRef);
    private readonly apps = inject(ApplicationManager);

    override ngOnInit(): void {
        super.ngOnInit();
        void this.reload().finally(() => {
            this.NotifyLoadComplete();
            this.changes.markForCheck();
        });
    }

    private user(): UserInfo | undefined {
        const current = new Metadata().CurrentUser;
        return current ?? undefined;
    }

    private async reload(): Promise<void> {
        const user = this.user();
        this.viewerId = user?.ID ?? null;
        this.viewerIsStaff = (user?.UserRoles ?? []).some((role) => role.Role === 'UI' || role.Role === 'Developer' || role.Role === 'Integration');
        if (!user) {
            this.denied = true;
            this.changes.markForCheck();
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
            this.changes.markForCheck();
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
        this.roles = (roleRows.Results ?? []).map((row: { ID: string; Name: string; Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean }) => ({
            id: row.ID,
            name: row.Name,
            level: row.Level,
            maxGrantableLevel: row.MaxGrantableLevel,
            canInvite: !!row.CanInvite,
            canPromoteBand: !!row.CanPromoteBand,
            canSeeTeamBand: !!row.CanSeeTeamBand,
            isOwnerRole: !!row.IsOwnerRole,
            canContribute: !!row.CanContribute,
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
        const itemSource = (itemRows.Results ?? []) as { ID: string; SpaceID: string; Band: Band; RecordID: string; Entity?: string; EntityID?: string }[];
        const md = new Metadata();
        const lookups: EntityRecordNameInput[] = [];
        for (const row of itemSource) {
            const info = row.EntityID ? md.EntityByID(row.EntityID) : undefined;
            if (!info || !row.RecordID) continue;
            const input = new EntityRecordNameInput();
            input.EntityName = info.Name;
            input.CompositeKey = CompositeKey.FromURLSegment(info, row.RecordID);
            lookups.push(input);
        }
        const names = lookups.length ? await md.GetEntityRecordNames(lookups, user) : [];
        const nameByKey = new Map(names.filter((name) => name.Success && name.RecordName).map((name) => [`${name.EntityName}|${name.CompositeKey?.ToRecordID?.() ?? ''}`, name.RecordName as string]));
        this.items = itemSource.map((row) => ({
            id: row.ID,
            spaceId: row.SpaceID,
            label: nameByKey.get(`${row.Entity}|${row.RecordID}`) || row.RecordID,
            band: row.Band,
        }));
        const linked = await new RunView().RunView({
            EntityName: 'MJ: Conversations',
            ExtraFilter: `LinkedEntityID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB'`,
            MaxRows: 500,
        }, user);
        this.conversations = ((linked.Results ?? []) as { ID: string; LinkedRecordID: string }[])
            .filter((row) => row.LinkedRecordID)
            .map((row) => ({ spaceId: row.LinkedRecordID, id: row.ID }));
        this.types = (typeRows.Results ?? []).map((row: { ID: string; Name: string }) => ({ id: row.ID, name: row.Name }));
        this.denied = false;
        this.changes.markForCheck();
    }

    async onInvite(event: { spaceId: string; userId: string; roleId: string }): Promise<void> {
        await this.saveMember(event.spaceId, event.userId, event.roleId);
    }

    async onApprove(event: { memberUserId: string; spaceId: string }): Promise<void> {
        const user = this.user();
        if (!user) return;
        const found = await new RunView().RunView({
            EntityName: 'MJ_BizApps_Collaboration: Space Members',
            ExtraFilter: `SpaceID = '${event.spaceId}' AND UserID = '${event.memberUserId}' AND Status = 'Invited'`,
            MaxRows: 1,
        }, user);
        const id = (found.Results?.[0] as { ID?: string } | undefined)?.ID;
        if (!id) {
            this.message = 'That invitation is not on this space.';
            this.changes.markForCheck();
            return;
        }
        const member = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>('MJ_BizApps_Collaboration: Space Members', user);
        if (!(await member.Load(id))) return;
        member.Status = 'Active';
        await this.finish(member);
    }

    async onPromote(event: { itemId: string }): Promise<void> {
        const user = this.user();
        if (!user) return;
        const item = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>('MJ_BizApps_Collaboration: Space Items', user);
        if (!(await item.Load(event.itemId))) return;
        item.Band = 'Shared';
        await this.finish(item);
    }

    async onCreate(event: { name: string; parentId: string | null; typeId: string }): Promise<void> {
        const user = this.user();
        if (!user) return;
        const space = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceEntity>('MJ_BizApps_Collaboration: Spaces', user);
        space.NewRecord();
        space.Name = event.name;
        space.OwnerID = user.ID;
        space.SpaceTypeID = event.typeId;
        if (event.parentId) space.ParentID = event.parentId;
        await this.finish(space);
    }

    private async saveMember(spaceId: string, userId: string, roleId: string | null): Promise<void> {
        const user = this.user();
        if (!user || !roleId) return;
        const member = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>('MJ_BizApps_Collaboration: Space Members', user);
        member.NewRecord();
        member.SpaceID = spaceId;
        member.UserID = userId;
        member.SpaceRoleTypeID = roleId;
        await this.finish(member);
    }

    private async finish(record: { Save: () => Promise<boolean>; LatestResult?: { CompleteMessage?: string } }): Promise<void> {
        const ok = await record.Save();
        this.message = ok ? '' : (record.LatestResult?.CompleteMessage ?? 'The save was refused.');
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
    return { level: 0, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false, canSeeTeamBand: false, isOwnerRole: false, canContribute: false };
}
