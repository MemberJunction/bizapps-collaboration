import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    membershipReaches,
    refuseInvite,
    type Band,
    type InviteDecision,
    type MemberSnapshot,
    type RoleFlags,
    type SpaceNode,
} from '@mj-biz-apps/collaboration-core';

export interface WorkspaceSpace extends SpaceNode {
    name: string;
    vocabulary: string;
    closedAt: string | null;
    approval?: 'Approve' | 'AutoApprove';
    memberCap?: number | null;
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
    imports: [FormsModule, NgTemplateOutlet],
    templateUrl: './space-workspace.component.html',
    styleUrl: './space-workspace.component.css',
})
export class SpaceWorkspaceComponent {
    @Input() spaces: WorkspaceSpace[] = [];
    @Input() members: (MemberSnapshot & { displayName?: string })[] = [];
    @Input() items: { id: string; spaceId: string; label: string; band: Band; kind?: 'file' | 'task' | 'conversation'; folder?: string | null }[] = [];
    @Input() roles: WorkspaceRole[] = [];
    @Input() viewerUserId: string | null = null;
    @Input() approval: 'Approve' | 'AutoApprove' = 'Approve';
    @Input() memberCap: number | null = null;

    @Output() readonly invite = new EventEmitter<{ spaceId: string; userId: string; roleId: string }>();
    @Output() readonly promote = new EventEmitter<{ itemId: string }>();
    @Output() readonly upload = new EventEmitter<{ spaceId: string; name: string; folder: string | null }>();
    @Output() readonly openItem = new EventEmitter<{ itemId: string }>();
    material: 'library' | 'work' = 'library';
    uploadName = '';
    uploadFolder = '';
    @Output() readonly approve = new EventEmitter<{ memberUserId: string; spaceId: string }>();
    @Output() readonly create = new EventEmitter<{ name: string; parentId: string | null; typeId: string }>();
    @Input() types: { id: string; name: string }[] = [];
    @Input() viewerIsStaff = false;
    @Input() conversations: { spaceId: string; id: string }[] = [];
    @Input() panels: { messaging?: boolean; library?: boolean; work?: boolean; governance?: boolean } = { messaging: true, library: true, work: true, governance: false };
    @Input() canOpenChat = false;
    @Output() readonly openConversation = new EventEmitter<string>();
    createName = '';
    createTypeId = '';
    createAtTop = false;

    selectedId: string | null = null;
    inviteUserId = '';
    inviteRoleId = '';

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
        this.selectedId = id;
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

    sendUpload(): void {
        const space = this.selected;
        if (!space || !this.uploadName.trim()) return;
        this.upload.emit({ spaceId: space.id, name: this.uploadName.trim(), folder: this.uploadFolder.trim() || null });
        this.uploadName = '';
    }

    preview(): InviteDecision | null {
        const space = this.selected;
        const role = this.roles.find((candidate) => candidate.id === this.inviteRoleId);
        if (!space || !role || !this.inviteUserId.trim()) {
            return null;
        }
        return refuseInvite({
            callerUserId: this.viewerUserId,
            inviteeUserId: this.inviteUserId.trim(),
            targetSpaceId: space.id,
            granted: role,
            approval: space.approval ?? this.approval,
            memberCap: space.memberCap ?? this.memberCap,
            spaces: this.spaces,
            memberships: this.members,
        });
    }

    sendCreate(): void {
        if (!this.createName.trim() || !this.createTypeId) return;
        const parentId = this.createAtTop || !this.selected ? null : this.selected.id;
        this.create.emit({ name: this.createName.trim(), parentId, typeId: this.createTypeId });
        this.createName = '';
    }

    sendInvite(): void {
        const space = this.selected;
        const decision = this.preview();
        if (!space || !decision?.ok) {
            return;
        }
        this.invite.emit({ spaceId: space.id, userId: this.inviteUserId.trim(), roleId: this.inviteRoleId });
        this.inviteUserId = '';
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
