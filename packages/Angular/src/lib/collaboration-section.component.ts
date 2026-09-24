import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject, ViewChild } from '@angular/core';
import { RegisterClass } from '@memberjunction/global';
import { CompositeKey, EntityRecordNameInput, LogError, Metadata, RunView, type UserInfo } from '@memberjunction/core';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import type { ResourceData } from '@memberjunction/core-entities';
import { MJEnvironmentEntityExtended } from '@memberjunction/core-entities';
import { lockoutMessage, openMode, type Band, type MemberSnapshot, type RoleFlags } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceMemberEntity, type mjBizAppsCollaborationSpaceItemEntityType } from '@mj-biz-apps/collaboration-entities';
import { mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
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
    styles: [`
      :host { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
      mj-collaboration-workspace { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
    `],
    template: `
      @if (denied) {
        <mj-collaboration-no-access [detail]="lockout" />
      } @else {
        @if (message) { <p class="verdict">{{ message }}</p> }
        <mj-collaboration-workspace
          [spaces]="spaces"
          [members]="members"
          [items]="items"
          [roles]="roles"
          [types]="types"
          [conversations]="conversations"
          [currentUser]="viewer"
          [environmentId]="environmentId"
          [viewerUserId]="viewerId"
          [viewerPersonId]="viewerPersonId"
          [viewerIsStaff]="viewerIsStaff"
          (invite)="onInvite($event)"
          (mintLink)="onMintLink($event)"
          (approve)="onApprove($event)"
          (promote)="onPromote($event)"
          (create)="onCreate($event)"
          (upload)="onUpload($event)"
          (fileTask)="onFileTask($event)"
          (postMessage)="onPostMessage($event)"
          (fileSubtask)="onFileSubtask($event)"
          (openItem)="onOpenItem($event)" />
      }
    `,
})
@RegisterClass(BaseResourceComponent, 'CollaborationSectionResource')
export class CollaborationSectionResource extends BaseResourceComponent {
    @ViewChild(SpaceWorkspaceComponent) workspace?: SpaceWorkspaceComponent;
    spaces: WorkspaceSpace[] = [];
    members: MemberSnapshot[] = [];
    items: { id: string; spaceId: string; label: string; band: Band; kind: 'file' | 'task' | 'conversation'; folder: string | null; recordId: string | null }[] = [];
    roles: WorkspaceRole[] = [];
    types: { id: string; name: string }[] = [];
    conversations: { spaceId: string; id: string }[] = [];
    viewer: UserInfo | null = null;
    readonly environmentId = MJEnvironmentEntityExtended.DefaultEnvironmentID;
    viewerId: string | null = null;
    viewerPersonId: string | null = null;
    viewerIsStaff = false;
    denied = false;
    lockout = lockoutMessage([]);
    message = '';
    private readonly changes = inject(ChangeDetectorRef);
    override ngOnInit(): void {
        super.ngOnInit();
        void this.reload().finally(() => {
            this.NotifyLoadComplete();
            this.changes.markForCheck();
        });
    }

    private gql(): ((query: string, variables: unknown) => Promise<Record<string, unknown>>) | null {
        const provider = Metadata.Provider as { ExecuteGQL?: (query: string, variables: unknown) => Promise<Record<string, unknown>> } | undefined;
        if (!provider?.ExecuteGQL) return null;
        return provider.ExecuteGQL.bind(provider);
    }

    private async personFor(user: UserInfo): Promise<string | null> {
        const id = (user.ID ?? '').replace(/[{}]/g, '');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
        const rows = await new RunView().RunView<{ ID: string }>({
            EntityName: 'MJ_BizApps_Common: People',
            ExtraFilter: `LinkedUserID = '${id}'`,
            Fields: ['ID'],
            MaxRows: 1,
            ResultType: 'simple',
        }, user);
        if (!rows.Success) {
            LogError(`Person lookup failed for user ${id}: ${rows.ErrorMessage ?? 'the People read failed'}`);
            return null;
        }
        return rows.Results?.[0]?.ID ?? null;
    }

    private user(): UserInfo | undefined {
        const current = new Metadata().CurrentUser;
        return current ?? undefined;
    }

    private async reload(): Promise<void> {
        const user = this.user();
        this.viewer = user ?? null;
        this.viewerId = user?.ID ?? null;
        this.viewerPersonId = user ? await this.personFor(user) : null;
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
        const types = new Map((typeRows.Results ?? []).map((row: { ID: string; Vocabulary: string; InviteApproval: 'Approve' | 'AutoApprove'; MemberCap: number | null; LibraryPanel?: boolean; WorkPanel?: boolean; GovernancePanel?: boolean }) => [row.ID, row]));
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
            libraryPanel: types.get(row.SpaceTypeID)?.LibraryPanel !== false,
            workPanel: !!types.get(row.SpaceTypeID)?.WorkPanel,
            governancePanel: !!types.get(row.SpaceTypeID)?.GovernancePanel,
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
        const itemSource = (itemRows.Results ?? []) as (Pick<mjBizAppsCollaborationSpaceItemEntityType, 'ID' | 'SpaceID' | 'Band' | 'RecordID' | 'Folder'> & { Entity?: string; EntityID?: string })[];
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
            kind: row.Entity === 'MJ_BizApps_Tasks: Tasks' ? 'task' as const : row.Entity === 'MJ: Conversations' ? 'conversation' as const : 'file' as const,
            folder: row.Folder,
            recordId: row.RecordID,
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
        const ownSeats = (memberRows.Results ?? [])
            .filter((row: { UserID: string }) => row.UserID?.toLowerCase() === user.ID.toLowerCase())
            .map((row: { Status: string; Space?: string }) => ({ status: row.Status ?? '', spaceName: row.Space ?? '' }));
        if (!this.viewerIsStaff && this.spaces.length === 0) {
            this.denied = true;
            this.lockout = lockoutMessage(ownSeats);
        } else {
            this.denied = false;
        }
        this.changes.markForCheck();
    }

    async onMintLink(event: { spaceId: string; email: string; roleId: string }): Promise<void> {
        const gql = this.gql();
        if (!gql) {
            this.message = 'An invite needs the API connection.';
            this.changes.markForCheck();
            return;
        }
        try {
            const result = await gql(`mutation MintSpaceLink($input: MintSpaceLinkInput!) {
                MintSpaceLink(input: $input) { Success Sent RedemptionUrl ErrorMessage }
            }`, { input: { SpaceID: event.spaceId, Email: event.email, RoleID: event.roleId } });
            const payload = result?.MintSpaceLink as { Success?: boolean; RedemptionUrl?: string; ErrorMessage?: string } | undefined;
            this.message = payload?.Success
                ? [payload.ErrorMessage, payload.RedemptionUrl].filter((part) => !!part).join(' ')
                : (payload?.ErrorMessage || 'Invite refused.');
            if (payload?.Success) await this.reload();
        } catch {
            this.message = 'Invite refused.';
        }
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

    async onUpload(event: { spaceId: string; name: string; folder: string | null; mimeType: string; base64: string }): Promise<void> {
        const gql = this.gql();
        if (!gql) {
            this.message = 'Upload needs the API connection.';
            this.changes.markForCheck();
            return;
        }
        try {
            const result = await gql(`mutation UploadSpaceFile($input: UploadSpaceFileInput!) {
                UploadSpaceFile(input: $input) { Success ItemID ErrorMessage }
            }`, {
                input: { SpaceID: event.spaceId, FileName: event.name, MimeType: event.mimeType, Base64Data: event.base64, Folder: event.folder },
            });
            const payload = result?.UploadSpaceFile as { Success?: boolean; ErrorMessage?: string } | undefined;
            this.message = payload?.Success ? '' : (payload?.ErrorMessage || 'The upload was refused.');
            if (payload?.Success) await this.reload();
        } catch (error) {
            this.message = error instanceof Error ? error.message : 'The upload was refused.';
        }
        this.changes.markForCheck();
    }

    async onFileTask(event: { spaceId: string; name: string; band: 'Team' | 'Shared' }): Promise<void> {
        const gql = this.gql();
        if (!gql) {
            this.message = 'A task needs the API connection.';
            this.changes.markForCheck();
            return;
        }
        try {
            const result = await gql(`mutation CreateSpaceTask($input: CreateSpaceTaskInput!) {
                CreateSpaceTask(input: $input) { Success TaskID ErrorMessage }
            }`, { input: { SpaceID: event.spaceId, Name: event.name, Band: event.band } });
            const payload = result?.CreateSpaceTask as { Success?: boolean; ErrorMessage?: string } | undefined;
            this.message = payload?.Success ? '' : (payload?.ErrorMessage || 'The task was refused.');
            if (payload?.Success) await this.reload();
        } catch (error) {
            this.message = error instanceof Error ? error.message : 'The task was refused.';
        }
        this.changes.markForCheck();
    }

    async onPostMessage(event: { spaceId: string; text: string }): Promise<void> {
        const gql = this.gql();
        const workspace = this.workspace;
        if (!gql || !workspace) {
            this.message = 'A message needs the API connection.';
            this.changes.markForCheck();
            return;
        }
        try {
            const result = await gql(`mutation PostSpaceMessage($input: PostSpaceMessageInput!) {
                PostSpaceMessage(input: $input) { Success DetailID ErrorMessage }
            }`, { input: { SpaceID: event.spaceId, Text: event.text } });
            const payload = result?.PostSpaceMessage as { Success?: boolean; ErrorMessage?: string } | undefined;
            const saved = !!payload?.Success;
            workspace.finishTalk(saved, saved ? '' : (payload?.ErrorMessage || 'The message was refused.'));
            if (saved) await workspace.loadTalk();
        } catch (error) {
            workspace.finishTalk(false, error instanceof Error ? error.message : 'The message was refused.');
        }
        this.changes.markForCheck();
    }

    async onFileSubtask(event: { parentId: string; name: string }): Promise<void> {
        let saved = false;
        try {
            const user = this.user();
            if (!user) {
                this.message = 'A subtask needs the signed-in user.';
                return;
            }
            const parent = await new Metadata().GetEntityObject<mjBizAppsTasksTaskEntity>('MJ_BizApps_Tasks: Tasks', user);
            if (!(await parent.Load(event.parentId))) {
                this.message = 'That task could not be read.';
                return;
            }
            const task = await new Metadata().GetEntityObject<mjBizAppsTasksTaskEntity>('MJ_BizApps_Tasks: Tasks', user);
            task.NewRecord();
            task.Name = event.name.trim();
            task.ParentID = event.parentId;
            task.TypeID = parent.TypeID;
            task.Status = 'Open';
            task.Priority = parent.Priority;
            saved = await task.Save();
            this.message = saved ? '' : (task.LatestResult?.CompleteMessage || 'The subtask was refused.');
            if (saved) this.workspace?.refreshWork();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'The subtask was refused.';
            LogError(`Subtask save failed for parent ${event.parentId}: ${message}`);
            this.message = message;
        } finally {
            this.workspace?.finishSubtask(saved);
            this.changes.markForCheck();
        }
    }

    async onOpenItem(event: { itemId: string }): Promise<void> {
        const user = this.user();
        const gql = this.gql();
        if (!user || !gql) return;
        const item = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>('MJ_BizApps_Collaboration: Space Items', user);
        if (!(await item.Load(event.itemId))) return;
        const info = new Metadata().EntityByID(item.EntityID);
        if (info?.Name !== 'MJ: Files') {
            this.message = 'This item is not a file.';
            this.changes.markForCheck();
            return;
        }
        try {
            const result = await gql(`mutation OpenSpaceFile($itemId: String!) {
                OpenSpaceFile(itemId: $itemId) { Success Base64 MimeType Name ErrorMessage }
            }`, { itemId: event.itemId });
            const payload = result?.OpenSpaceFile as { Success?: boolean; Base64?: string; MimeType?: string; Name?: string; ErrorMessage?: string } | undefined;
            if (!payload?.Success || !payload.Base64) {
                this.message = payload?.ErrorMessage || 'The file could not be opened.';
                this.changes.markForCheck();
                return;
            }
            const raw = atob(payload.Base64);
            const bytes = new Uint8Array(raw.length);
            for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
            presentFile(bytes, payload.MimeType, payload.Name || 'download');
            this.message = '';
        } catch (error) {
            this.message = error instanceof Error ? error.message : 'The file could not be opened.';
        }
        this.changes.markForCheck();
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

function presentFile(bytes: Uint8Array, claimedType: string | undefined, name: string): void {
    const mode = openMode(claimedType);
    const type = mode === 'inline' ? (claimedType ?? '').split(';')[0].trim().toLowerCase() : mode === 'text' ? 'text/plain' : 'application/octet-stream';
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type }));
    if (mode === 'download') {
        const link = document.createElement('a');
        link.href = url;
        link.download = name || 'download';
        link.click();
        URL.revokeObjectURL(url);
        return;
    }
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
