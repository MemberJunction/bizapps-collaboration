import { BaseEntity, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { isSelfAccept, refuseInvite } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { callerId, loadCollaborationGraph } from './load-graph.js';
import { requireUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Members';

/**
 * The invitation ceiling. Write-side row-level security is unused across
 * MemberJunction, so the four clauses live here, where generated Create and
 * Update both pass.
 */
@RegisterClass(BaseEntity, ENTITY)
export class SpaceMemberEntityServer extends mjBizAppsCollaborationSpaceMemberEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user) {
            return fail(result, 'UserID', 'Invite refused: there is no signed-in user to grant it.');
        }

        const caller = callerId(user);
        const invitee = requireUuid(this.UserID, 'UserID');
        const spaceId = requireUuid(this.SpaceID, 'SpaceID');
        const previous = this.IsSaved ? previousStatus(this) : null;
        if (previous && isSelfAccept({ callerUserId: caller, inviteeUserId: invitee, previousStatus: previous, nextStatus: this.Status })) {
            return result;
        }

        const graph = await loadCollaborationGraph(user);
        const granted = graph.roles.get(requireUuid(this.SpaceRoleTypeID, 'SpaceRoleTypeID'));
        if (!granted) {
            return fail(result, 'SpaceRoleTypeID', 'Invite refused: that role does not exist.');
        }
        const type = graph.typeBySpaceId.get(spaceId) ?? { approval: 'Approve' as const, memberCap: null };
        const decision = refuseInvite({
            callerUserId: caller,
            inviteeUserId: invitee,
            targetSpaceId: spaceId,
            granted,
            approval: type.approval,
            memberCap: type.memberCap,
            spaces: graph.spaces,
            memberships: graph.memberships.filter((row) => row.userId !== invitee || row.spaceId !== spaceId),
        });
        if (!decision.ok) {
            return fail(result, 'SpaceRoleTypeID', decision.message);
        }
        if (!this.IsSaved) {
            this.Status = decision.status;
        }
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
