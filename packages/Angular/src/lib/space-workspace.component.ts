import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { LogError, RunView, type UserInfo } from '@memberjunction/core';
import { MJEnvironmentEntityExtended } from '@memberjunction/core-entities';
import { FormsModule } from '@angular/forms';
import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { ConversationsModule } from '@memberjunction/ng-conversations';
import { MJDialogActionsComponent, MJDialogComponent } from '@memberjunction/ng-ui-components';
import { TaskGanttComponent, TaskKanbanComponent, TaskPanelComponent } from '@mj-biz-apps/tasks-ng';
import {
    flagExceedsGrantor,
    membershipReaches,
    rosterBySeat,
    refuseInvite,
    type Band,
    type InviteDecision,
    type MemberSnapshot,
    type RoleFlags,
    type SpaceNode,
    SPACE_UPLOAD_MAX_BYTES,
} from '@mj-biz-apps/collaboration-core';

export interface WorkspaceSpace extends SpaceNode {
    name: string;
    vocabulary: string;
    closedAt: string | null;
    approval?: 'Approve' | 'AutoApprove';
    memberCap?: number | null;
    libraryPanel?: boolean;
    workPanel?: boolean;
    governancePanel?: boolean;
}

export interface WorkspaceRole extends RoleFlags {
    id: string;
    name: string;
}

/**
 * The space itself: a tree on the left, the roster and the material on the right.
 * It does not talk to the database. The host loads rows and sends them in.
 * Invitation uses the same `refuseInvite` the server uses, so the button and
 * the save agree before the round trip.
 */
@Component({
    selector: 'mj-collaboration-workspace',
    standalone: true,
    imports: [FormsModule, NgTemplateOutlet, ConversationsModule, MJDialogComponent, MJDialogActionsComponent, TaskPanelComponent, TaskKanbanComponent, TaskGanttComponent],
    templateUrl: './space-workspace.component.html',
    styleUrl: './space-workspace.component.css',
})
export class SpaceWorkspaceComponent implements OnChanges {
    constructor(private readonly changes: ChangeDetectorRef) {}

    @ViewChild(TaskPanelComponent) taskPanel?: TaskPanelComponent;
    @ViewChild(TaskKanbanComponent) taskBoard?: TaskKanbanComponent;
    @ViewChild(TaskGanttComponent) taskGantt?: TaskGanttComponent;
    @Input() spaces: WorkspaceSpace[] = [];
    @Input() members: (MemberSnapshot & { displayName?: string })[] = [];
    @Input() items: { id: string; spaceId: string; label: string; band: Band; kind?: 'file' | 'task' | 'conversation'; folder?: string | null; recordId?: string | null }[] = [];
    @Input() roles: WorkspaceRole[] = [];
    @Input() viewerUserId: string | null = null;
    @Input() viewerPersonId: string | null = null;
    @Input() approval: 'Approve' | 'AutoApprove' = 'Approve';
    @Input() memberCap: number | null = null;

    @Output() readonly invite = new EventEmitter<{ spaceId: string; userId: string; roleId: string }>();
    @Output() readonly mintLink = new EventEmitter<{ spaceId: string; email: string; roleId: string }>();
    @Output() readonly promote = new EventEmitter<{ itemId: string }>();
    @Output() readonly upload = new EventEmitter<{ spaceId: string; name: string; folder: string | null; mimeType: string; base64: string }>();
    @Output() readonly openItem = new EventEmitter<{ itemId: string }>();
    @Output() readonly fileTask = new EventEmitter<{ spaceId: string; name: string; band: Band }>();
    @Output() readonly postMessage = new EventEmitter<{ spaceId: string; text: string }>();
    @Output() readonly fileSubtask = new EventEmitter<{ parentId: string; name: string }>();
    pane: 'overview' | 'people' | 'library' | 'work' | 'talk' = 'overview';
    spaceQuery = '';
    createOpen = false;
    folderChoice = '';
    talkDraft = '';
    talkError = '';
    talkSaving = false;
    talkHasEarlier = false;
    talkOldest: number | null = null;
    talkMessages: MJConversationDetailEntity[] = [];
    uploadEnabled = true;
    uploadFolder = '';
    uploadMessage = '';
    private chosenFile: File | null = null;
    @Output() readonly approve = new EventEmitter<{ memberUserId: string; spaceId: string }>();
    @Output() readonly create = new EventEmitter<{ name: string; parentId: string | null; typeId: string }>();
    @Input() types: { id: string; name: string }[] = [];
    @Input() viewerIsStaff = false;
    @Input() conversations: { spaceId: string; id: string }[] = [];
    @Input() panels: { messaging?: boolean; library?: boolean; work?: boolean; governance?: boolean } = { messaging: true, library: true, work: true, governance: false };
    @Input() currentUser: UserInfo | null = null;
    @Input() environmentId = MJEnvironmentEntityExtended.DefaultEnvironmentID;
    createName = '';
    createTypeId = '';
    createAtTop = false;
    taskName = '';
    taskBand: Band = 'Shared';
    subtaskName = '';
    subtaskSaving = false;
    selectedTaskId: string | null = null;
    selectedTaskName = '';
    workView: 'list' | 'board' | 'gantt' = 'list';

    selectedId: string | null = null;
    linkEmail = '';
    linkRoleId = '';

    ngOnChanges(changes: SimpleChanges): void {
        if (!changes['spaces']) return;
        const pinned = this.spaces.some((space) => space.id === this.selectedId);
        if (pinned) return;
        const next = this.roots[0]?.id ?? null;
        if (this.selectedId && next) {
            this.select(next);
            return;
        }
        if (this.selectedId) {
            this.selectedId = null;
            this.talkDraft = '';
            this.talkMessages = [];
            this.talkOldest = null;
            this.talkHasEarlier = false;
            this.talkError = '';
            this.talkSaving = false;
            return;
        }
        this.selectedId = next;
    }

    get selected(): WorkspaceSpace | null {
        const id = this.selectedId ?? this.roots[0]?.id ?? null;
        return this.spaces.find((space) => space.id === id) ?? null;
    }

    get roots(): WorkspaceSpace[] {
        return this.spaces.filter((space) => !space.parentId || !this.spaces.some((other) => other.id === space.parentId));
    }

    children(id: string): WorkspaceSpace[] {
        return this.spaces.filter((space) => space.parentId === id);
    }

    select(id: string): void {
        if (this.selected?.id === id) return;
        this.selectedId = id;
        this.selectedTaskId = null;
        this.selectedTaskName = '';
        this.folderChoice = '';
        this.uploadFolder = '';
        this.talkDraft = '';
        this.talkMessages = [];
        this.talkOldest = null;
        this.talkHasEarlier = false;
        this.talkError = '';
        this.talkSaving = false;
        this.pane = 'overview';
        this.ensurePane();
    }

    showOverview(): void { this.pane = 'overview'; }
    showPeople(): void { this.pane = 'people'; }
    showLibrary(): void {
        this.pane = 'library';
        const folder = this.selected ? this.activeFolder(this.selected.id) : null;
        if (folder && folder !== 'Unfiled' && !this.uploadFolder.trim()) this.uploadFolder = folder;
    }
    showWork(): void { this.pane = 'work'; }
    showTalk(): void {
        this.pane = 'talk';
        void this.loadTalk();
    }

    private ensurePane(): void {
        const space = this.selected;
        if (!space) return;
        if (this.pane === 'library' && !this.libraryOn(space)) this.pane = 'overview';
        if (this.pane === 'work' && !this.workOn(space)) this.pane = 'overview';
    }

    showNode(space: WorkspaceSpace): boolean {
        const query = this.spaceQuery.trim().toLowerCase();
        if (!query) return true;
        if (space.name.toLowerCase().includes(query)) return true;
        if (this.children(space.id).some((child) => this.showNode(child))) return true;
        let parent = space.parentId;
        const seen = new Set<string>();
        while (parent && !seen.has(parent)) {
            seen.add(parent);
            const ancestor = this.spaces.find((item) => item.id === parent);
            if (!ancestor) break;
            if (ancestor.name.toLowerCase().includes(query)) return true;
            parent = ancestor.parentId ?? null;
        }
        return false;
    }

    initials(name: string): string {
        const parts = name.trim().split(/\s+/).slice(0, 2);
        const letters = parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
        return letters || '?';
    }

    avatarClass(name: string): string {
        const total = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
        return `av-${total % 4}`;
    }

    activeFolder(spaceId: string): string | null {
        const folders = this.foldersHere(spaceId);
        if (this.folderChoice && folders.includes(this.folderChoice)) return this.folderChoice;
        return folders[0] ?? null;
    }

    chooseFolder(name: string): void {
        this.folderChoice = name;
        this.uploadFolder = name === 'Unfiled' ? '' : name;
    }

    uploadHeading(): string {
        return this.uploadFolder.trim() || 'Unfiled';
    }

    spaceOption(space: WorkspaceSpace): string {
        const parent = this.parentOf(space);
        return parent ? `${parent.name} / ${space.name}` : space.name;
    }

    agentWords(value: string): string {
        if (value === 'Included') return 'Agents can use this room';
        if (value === 'ExcludedEntirely') return 'Agents skip this room';
        return 'Agents asked higher up skip this room';
    }

    async loadTalk(earlier = false): Promise<void> {
        const space = this.selected;
        const conversationId = space ? this.conversationFor(space.id) : null;
        if (!space || !conversationId || !this.currentUser) {
            this.talkMessages = [];
            this.talkHasEarlier = false;
            this.changes.markForCheck();
            return;
        }
        const older = earlier && this.talkOldest != null ? ` AND Sequence < ${this.talkOldest}` : '';
        const rows = await new RunView().RunView<MJConversationDetailEntity>({
            EntityName: 'MJ: Conversation Details',
            ExtraFilter: `ConversationID = '${conversationId}'${older}`,
            OrderBy: 'Sequence DESC',
            ResultType: 'entity_object',
            MaxRows: 200,
        }, this.currentUser);
        if (this.conversationFor(this.selected?.id ?? '') !== conversationId) return;
        if (!rows.Success) {
            this.talkError = rows.ErrorMessage || 'The conversation could not be read.';
            this.changes.markForCheck();
            return;
        }
        const page = [...(rows.Results ?? [])].reverse();
        this.talkMessages = earlier ? [...page, ...this.talkMessages] : page;
        this.talkHasEarlier = (rows.Results?.length ?? 0) === 200;
        this.talkOldest = this.talkMessages[0]?.Sequence ?? null;
        this.changes.markForCheck();
    }

    sendTalk(): void {
        const space = this.selected;
        const text = this.talkDraft.trim();
        if (this.talkSaving || !space || !text || !this.canContributeHere() || space.closedAt) return;
        this.talkSaving = true;
        this.talkError = '';
        this.postMessage.emit({ spaceId: space.id, text });
    }

    finishTalk(spaceId: string, saved: boolean, error = ''): void {
        if (this.selected?.id !== spaceId) return;
        this.talkSaving = false;
        if (saved) this.talkDraft = '';
        else this.talkError = error || 'The message was refused.';
        this.changes.markForCheck();
    }

    filesIn(spaceId: string, folder: string) {
        return this.itemsHere(spaceId, 'file').filter((item) => folder === 'Unfiled' ? !item.folder : item.folder === folder);
    }

    parentOf(space: WorkspaceSpace): WorkspaceSpace | null {
        return this.spaces.find((item) => item.id === space.parentId) ?? null;
    }

    libraryOn(space: WorkspaceSpace): boolean {
        return space.libraryPanel !== false && this.panels.library !== false;
    }

    workOn(space: WorkspaceSpace): boolean {
        return space.workPanel !== false && !!this.panels.work;
    }

    membersHere(spaceId: string): (MemberSnapshot & { displayName?: string })[] {
        return this.members.filter((member) => member.spaceId === spaceId && member.status !== 'Removed');
    }

    itemsHere(spaceId: string, kind?: 'file' | 'task' | 'conversation') {
        return this.items.filter((item) => item.spaceId === spaceId && (kind ? (item.kind ?? 'file') === kind : true));
    }

    foldersHere(spaceId: string): string[] {
        const files = this.itemsHere(spaceId, 'file');
        const named = [...new Set(files.map((item) => item.folder).filter((folder): folder is string => !!folder))].sort();
        return files.some((item) => !item.folder) ? ['Unfiled', ...named] : named;
    }

    chooseFile(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.chosenFile = input.files?.[0] ?? null;
    }

    async sendUpload(): Promise<void> {
        const space = this.selected;
        const file = this.chosenFile;
        if (!space || !file) return;
        if (file.size > SPACE_UPLOAD_MAX_BYTES) {
            this.uploadMessage = `Upload refused: files are limited to ${Math.round(SPACE_UPLOAD_MAX_BYTES / (1024 * 1024))} MB.`;
            return;
        }
        this.uploadMessage = '';
        const bytes = new Uint8Array(await file.arrayBuffer());
        this.upload.emit({
            spaceId: space.id,
            name: file.name,
            folder: this.uploadFolder.trim() || null,
            mimeType: file.type || 'application/octet-stream',
            base64: encodeBase64(bytes),
        });
        this.chosenFile = null;
    }

    grantableRoles(): WorkspaceRole[] {
        const reach = this.reach(this.selected?.id);
        if (!reach?.role.canInvite) return [];
        return this.roles.filter((role) => role.level <= reach.role.maxGrantableLevel && !flagExceedsGrantor(role, reach.role));
    }

    preview(): InviteDecision | null {
        const space = this.selected;
        const role = this.grantableRoles().find((candidate) => candidate.id === this.linkRoleId);
        const email = this.linkEmail.trim();
        if (!space || !role || !email.includes('@')) return null;
        return refuseInvite({
            callerUserId: this.viewerUserId,
            inviteeUserId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
            targetSpaceId: space.id,
            granted: role,
            approval: space.approval ?? this.approval,
            memberCap: space.memberCap ?? this.memberCap,
            spaces: this.spaces,
            memberships: this.members,
        });
    }

    sendTask(): void {
        const space = this.selected;
        const name = this.taskName.trim();
        if (!space || !name || !this.canContributeHere()) return;
        const band = this.reach(space.id)?.role.canSeeTeamBand ? this.taskBand : 'Shared';
        this.fileTask.emit({ spaceId: space.id, name, band });
        this.taskName = '';
    }

    taskScope(spaceId: string): string {
        const ids = this.itemsHere(spaceId, 'task').map((item) => sqlUuid(item.recordId)).filter((id): id is string => !!id);
        if (!ids.length) return '1 = 0';
        const list = ids.map((id) => `'${id}'`).join(', ');
        return `(ID IN (${list}) OR RootParentID IN (${list}))`;
    }

    assigneeScope(spaceId: string): string {
        const ids = new Set<string>();
        for (const member of this.members) {
            if (member.status === 'Removed' || member.status === 'Invited') continue;
            if (!membershipReaches(this.spaces, this.members, member.userId, spaceId)) continue;
            const id = sqlUuid(member.userId);
            if (id) ids.add(id);
        }
        if (!ids.size) return '1 = 0';
        return `LinkedUserID IN (${[...ids].map((id) => `'${id}'`).join(', ')})`;
    }

    showList(): void { this.workView = 'list'; }
    showBoard(): void { this.workView = 'board'; }
    showGantt(): void { this.workView = 'gantt'; }

    chooseTask(task: { ID: string; Name?: string }): void {
        this.selectedTaskId = task.ID;
        this.selectedTaskName = task.Name ?? this.selectedTaskName;
    }

    async openTask(task: string | { ID: string; Name?: string }): Promise<void> {
        const taskId = typeof task === 'string' ? task : task.ID;
        const hinted = typeof task === 'string' ? '' : (task.Name ?? '');
        this.selectedTaskId = taskId;
        if (hinted) {
            this.selectedTaskName = hinted;
        } else {
            const name = await this.lookupTaskName(taskId);
            if (this.selectedTaskId !== taskId) return;
            this.selectedTaskName = name;
        }
        this.workView = 'list';
        this.changes.detectChanges();
        this.taskPanel?.OpenDetail(taskId);
    }

    sendSubtask(): void {
        const name = this.subtaskName.trim();
        if (this.subtaskSaving || !this.selectedTaskId || !name || !this.canContributeHere()) return;
        this.subtaskSaving = true;
        this.fileSubtask.emit({ parentId: this.selectedTaskId, name });
    }

    finishSubtask(saved: boolean): void {
        this.subtaskSaving = false;
        if (saved) this.subtaskName = '';
    }

    private async lookupTaskName(taskId: string): Promise<string> {
        const id = sqlUuid(taskId);
        if (!id) return '';
        const rows = await new RunView().RunView<{ Name: string }>({
            EntityName: 'MJ_BizApps_Tasks: Tasks',
            ExtraFilter: `ID = '${id}'`,
            Fields: ['Name'],
            MaxRows: 1,
            ResultType: 'simple',
        });
        if (!rows.Success) {
            LogError(`Task name read failed for ${id}: ${rows.ErrorMessage ?? 'the task could not be read'}`);
            return '';
        }
        return rows.Results?.[0]?.Name ?? '';
    }

    refreshWork(): void {
        this.taskPanel?.Refresh();
        this.taskBoard?.Refresh();
        this.taskGantt?.Refresh();
    }

    sendCreate(): void {
        if (!this.createName.trim() || !this.createTypeId) return;
        const parentId = !this.ownsSelected() || this.createAtTop || !this.selected ? null : this.selected.id;
        this.create.emit({ name: this.createName.trim(), parentId, typeId: this.createTypeId });
        this.createName = '';
        this.createOpen = false;
    }

    sendMint(): void {
        const space = this.selected;
        const email = this.linkEmail.trim();
        if (!space || !email.includes('@') || !this.linkRoleId || !this.canInviteHere()) return;
        this.mintLink.emit({ spaceId: space.id, email, roleId: this.linkRoleId });
        this.linkEmail = '';
    }

    canCreateHere(): boolean {
        return this.viewerIsStaff || this.ownsSelected();
    }

    ownsSelected(): boolean {
        return !!this.reach(this.selected?.id)?.role.isOwnerRole;
    }

    canInviteHere(): boolean {
        return !!this.reach(this.selected?.id)?.role.canInvite;
    }

    canContributeHere(): boolean {
        return !!this.reach(this.selected?.id)?.role.canContribute;
    }

    seesTeam(spaceId: string): boolean {
        return !!this.reach(spaceId)?.role?.canSeeTeamBand;
    }

    ancestorGroups(space: WorkspaceSpace): { id: string; name: string; members: (MemberSnapshot & { displayName?: string })[] }[] {
        return rosterBySeat(this.spaces, this.members, space.id).groups
            .filter((group) => group.spaceId !== space.id)
            .map((group) => ({
                id: group.spaceId,
                name: this.spaces.find((item) => item.id === group.spaceId)?.name ?? 'the parent',
                members: group.members.map((member) => this.members.find((row) => row.userId === member.userId && row.spaceId === member.spaceId) ?? member),
            }))
            .filter((group) => group.members.length > 0);
    }

    sharesUnseenRoster(space: WorkspaceSpace): boolean {
        return rosterBySeat(this.spaces, this.members, space.id).stop === 'unloaded-parent';
    }

    private reach(spaceId: string | null | undefined) {
        if (!spaceId || !this.viewerUserId) return null;
        return membershipReaches(this.spaces, this.members, this.viewerUserId, spaceId);
    }

    viewerCanPromote(spaceId: string): boolean {
        if (!this.viewerUserId) return false;
        return !!membershipReaches(this.spaces, this.members, this.viewerUserId, spaceId)?.role.canPromoteBand;
    }

    conversationFor(spaceId: string): string | null {
        return this.conversations.find((row) => row.spaceId === spaceId)?.id ?? null;
    }

    viewerCanApprove(spaceId: string): boolean {
        if (!this.viewerUserId) return false;
        return !!membershipReaches(this.spaces, this.members, this.viewerUserId, spaceId)?.role.isOwnerRole;
    }

    depth(space: WorkspaceSpace): number {
        let depth = 0;
        let parent = space.parentId;
        const seen = new Set<string>();
        while (parent && !seen.has(parent)) {
            seen.add(parent);
            depth += 1;
            parent = this.spaces.find((candidate) => candidate.id === parent)?.parentId ?? null;
        }
        return depth;
    }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sqlUuid(value: string | null | undefined): string | null {
    const id = (value ?? '').replace(/^ID\|/i, '');
    return UUID.test(id) ? id : null;
}

function encodeBase64(bytes: Uint8Array): string {
    let binary = '';
    const step = 0x8000;
    for (let index = 0; index < bytes.length; index += step) {
        binary += String.fromCharCode(...bytes.subarray(index, index + step));
    }
    return btoa(binary);
}
