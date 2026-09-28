import { BaseEntity, LogError, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { isSelfRemoval, membershipReaches, refuseInvite, ResolveSpaceRules, strandFromSavedRow, wouldStrandLastOwner } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext } from './load-graph.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { notifySpaceLifecycleSubscribers } from './space-lifecycle-subscribers.js';
import { syncRoomEditGrantsForSpace } from './room-edit-grants.js';
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
            const oldRole = this.IsSaved ? parseUuid(String(this.Fields.find((field) => field.Name === 'SpaceRoleTypeID')?.OldValue ?? '')) : null;
            context = await loadWriteContext(this, user, spaceId, roleId, oldRole);
        } catch (error) {
            return fail(result, 'SpaceRoleTypeID', error instanceof Error ? error.message : 'Invite refused: the roster could not be read completely.');
        }
        if (this.IsSaved) {
            const oldRoleId = parseUuid(String(this.Fields.find((field) => field.Name === 'SpaceRoleTypeID')?.OldValue ?? roleId));
            const savedIsOwner = !!(oldRoleId && context.roles.get(oldRoleId)?.isOwnerRole);
            if (wouldStrandLastOwner(strandFromSavedRow({
                savedStatus: previous ?? this.Status,
                savedIsOwner,
                nextStatus: this.Status,
                nextIsOwner: !!context.role?.isOwnerRole,
                activeOwners: context.ownerCount,
            }))) {
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
        const currentRoleId = this.IsSaved ? parseUuid(String(this.Fields.find((field) => field.Name === 'SpaceRoleTypeID')?.OldValue ?? roleId)) : null;
        const currentRole = currentRoleId ? context.roles.get(currentRoleId) ?? null : null;
        const decision = refuseInvite({
            callerUserId: caller,
            inviteeUserId: invitee,
            targetSpaceId: spaceId,
            granted: context.role,
            currentRole,
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

        // Extensibility Driver Validation
        try {
            const spaceInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(spaceId, this);
            const isNew = !this.IsSaved;
            const statusChanged = this.Fields.some((f) => f.Name === 'Status' && f.Dirty);
            const roleChanged = this.Fields.some((f) => f.Name === 'SpaceRoleTypeID' && f.Dirty);
            const bandChanged = this.Fields.some((f) => f.Name === 'Band' && f.Dirty);

            let memberKind: 'Invite' | 'RoleChange' | 'BandChange' | 'Remove' = 'Invite';
            if (this.Status === 'Removed' && (statusChanged || isNew)) {
                memberKind = 'Remove';
            } else if (roleChanged) {
                memberKind = 'RoleChange';
            } else if (bandChanged) {
                memberKind = 'BandChange';
            } else if (isNew) {
                memberKind = 'Invite';
            }

            const driverValidation = await spaceInfo.driver.ValidateMemberChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: spaceInfo.space,
                spaceType: spaceInfo.spaceType,
                effectiveRules: ResolveSpaceRules(null, null),
                member: this,
                kind: memberKind,
            });
            if (!driverValidation.ok) {
                return fail(result, driverValidation.field ?? 'SpaceRoleTypeID', driverValidation.message ?? 'Member change refused by driver.');
            }
        } catch (driverErr) {
            return fail(result, 'SpaceID', driverErr instanceof Error ? driverErr.message : 'Member change refused: driver could not be resolved.');
        }

        return result;
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const wasNew = !this.IsSaved;
        const previousStatus = this.Fields.find((f) => f.Name === 'Status')?.OldValue as string | undefined;
        const ok = await super.Save(options);
        if (ok && this.ContextCurrentUser && this.SpaceID) {
            const user = this.ContextCurrentUser;
            try {
                const spaceInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(this.SpaceID, this);
                await spaceInfo.driver.OnMemberChanged({
                    actingUser: user,
                    provider: this.ProviderToUse,
                    space: spaceInfo.space,
                    spaceType: spaceInfo.spaceType,
                    effectiveRules: ResolveSpaceRules(null, null),
                    member: this,
                    kind: this.Status === 'Removed' ? 'Remove' : wasNew ? 'Invite' : 'RoleChange',
                });
            } catch (driverErr) {
                LogError(`Member driver reaction failed: ${driverErr instanceof Error ? driverErr.message : String(driverErr)}`);
            }

            const becameActive = this.Status === 'Active' && (wasNew || previousStatus !== 'Active');
            const becameRemoved = this.Status === 'Removed' && previousStatus !== 'Removed';

            if (becameActive) {
                notifySpaceLifecycleSubscribers(this.ProviderToUse, {
                    spaceId: this.SpaceID,
                    actingUserId: user.ID,
                    event: 'AfterMemberAdded',
                    timestamp: new Date(),
                    data: { memberId: this.ID, userId: this.UserID, personId: this.PersonID },
                });
            } else if (becameRemoved) {
                notifySpaceLifecycleSubscribers(this.ProviderToUse, {
                    spaceId: this.SpaceID,
                    actingUserId: user.ID,
                    event: 'AfterMemberRemoved',
                    timestamp: new Date(),
                    data: { memberId: this.ID, userId: this.UserID, personId: this.PersonID },
                });
            }

            try {
                const syncRes = await syncRoomEditGrantsForSpace(this.ProviderToUse, this.SpaceID);
                if (!syncRes.ok) {
                    LogError(`Room edit grants sync failed on member change for space ${this.SpaceID}: ${syncRes.message ?? ''}`);
                }
            } catch (syncErr) {
                LogError(`Room edit grants sync failed on member change for space ${this.SpaceID}: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`);
            }
        }
        return ok;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const spaceId = this.SpaceID;
        const provider = this.ProviderToUse;
        const ok = await super.Delete(options);
        if (ok && spaceId) {
            try {
                const syncRes = await syncRoomEditGrantsForSpace(provider, spaceId);
                if (!syncRes.ok) {
                    LogError(`Room edit grants sync failed on member delete for space ${spaceId}: ${syncRes.message ?? ''}`);
                }
            } catch (syncErr) {
                LogError(`Room edit grants sync failed on member delete for space ${spaceId}: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`);
            }
        }
        return ok;
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
