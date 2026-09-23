import { BaseEntity, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { isSelfRemoval, membershipReaches, refuseInvite, wouldStrandLastOwner } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext } from './load-graph.js';
import { parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Members';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceMemberEntityServer extends mjBizAppsCollaborationSpaceMemberEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const caller = callerUuid(user);
        const invitee = parseUuid(this.UserID);
        const spaceId = parseUuid(this.SpaceID);
        const roleId = parseUuid(this.SpaceRoleTypeID);
        if (!user || !caller || !invitee || !spaceId || !roleId) {
            return fail(result, 'UserID', 'Invite refused: the user, space, and role must be real ids.');
        }

        if (this.IsSaved) {
            const dirty = this.Fields.filter((field) => field.Dirty).map((field) => field.Name);
            if (dirty.includes('SpaceID') || dirty.includes('UserID')) {
                return fail(result, 'SpaceID', 'A membership stays on the space and the person it was created for.');
            }
        }
        const previous = previousStatus(this);
        let context;
        try {
            context = await loadWriteContext(this, user, spaceId, roleId);
        } catch (error) {
            return fail(result, 'SpaceRoleTypeID', error instanceof Error ? error.message : 'Invite refused: the roster could not be read completely.');
        }
        if (this.IsSaved) {
            const mine = context.memberships.find((row) => row.userId.toLowerCase() === caller.toLowerCase() && row.spaceId.toLowerCase() === spaceId.toLowerCase());
            if (wouldStrandLastOwner({
                currentlyActiveOwner: mine?.status === 'Active' && !!mine.role.isOwnerRole,
                nextIsActive: this.Status === 'Active',
                nextIsOwner: !!context.role?.isOwnerRole,
                activeOwners: context.ownerCount,
            })) {
                return fail(result, 'Status', 'You are the last owner of this space. Seat another owner before you leave.');
            }
            const dirty = this.Fields.filter((field) => field.Dirty).map((field) => field.Name);
            if (dirty.length === 1 && dirty[0] === 'Status' && isSelfRemoval({ callerUserId: caller, inviteeUserId: invitee, nextStatus: this.Status })) {
                return result;
            }
        }
        if (!context.role) {
            return fail(result, 'SpaceRoleTypeID', 'Invite refused: that role does not exist.');
        }
        const occupied = this.IsSaved && previous && previous !== 'Removed' ? Math.max(0, context.memberCount - 1) : context.memberCount;
        const decision = refuseInvite({
            callerUserId: caller,
            inviteeUserId: invitee,
            targetSpaceId: spaceId,
            granted: context.role,
            approval: context.approval,
            memberCap: context.memberCap,
            occupied,
            spaces: context.spaces,
            memberships: context.memberships,
        });
        if (!decision.ok) {
            return fail(result, 'SpaceRoleTypeID', decision.message);
        }
        if (!this.IsSaved) {
            this.Status = decision.status;
        }
        if (this.Status === 'Active' && context.approval === 'Approve') {
            const owner = membershipReaches(context.spaces, context.memberships, caller, spaceId);
            const seatingSelf = !this.IsSaved && caller === invitee;
            if (!owner?.role.isOwnerRole && !seatingSelf) {
                return fail(result, 'Status', 'Invite refused: an owner of this space has to approve the member.');
            }
        }
        this.Band = context.role.canSeeTeamBand ? 'Team' : 'Shared';
        return result;
    }
}

function previousStatus(entity: SpaceMemberEntityServer): 'Invited' | 'Active' | 'Removed' | null {
    const field = entity.Fields?.find((candidate) => candidate.Name === 'Status');
    const value = field?.OldValue;
    if (value === 'Invited' || value === 'Active' || value === 'Removed') {
        return value;
    }
    return null;
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceMemberEntityServer(): void {
    void SpaceMemberEntityServer;
}
