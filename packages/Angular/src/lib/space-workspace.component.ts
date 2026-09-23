import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
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
    @Input() members: MemberSnapshot[] = [];
    @Input() items: { id: string; spaceId: string; label: string; band: Band }[] = [];
    @Input() roles: WorkspaceRole[] = [];
    @Input() viewerUserId: string | null = null;
    @Input() approval: 'Approve' | 'AutoApprove' = 'Approve';
    @Input() memberCap: number | null = null;

    @Output() readonly invite = new EventEmitter<{ spaceId: string; userId: string; roleId: string }>();
    @Output() readonly promote = new EventEmitter<{ itemId: string }>();
    @Output() readonly accept = new EventEmitter<{ memberUserId: string; spaceId: string }>();

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

    membersHere(spaceId: string): MemberSnapshot[] {
        return this.members.filter((member) => member.spaceId === spaceId && member.status !== 'Removed');
    }

    itemsHere(spaceId: string): { id: string; spaceId: string; label: string; band: Band }[] {
        return this.items.filter((item) => item.spaceId === spaceId);
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
            approval: this.approval,
            memberCap: this.memberCap,
            spaces: this.spaces,
            memberships: this.members,
        });
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
