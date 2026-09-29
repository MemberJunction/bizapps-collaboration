import { BaseEntity, LogError, ValidationErrorInfo, ValidationErrorType, type UserInfo, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { isSelfRemoval, membershipReaches, refuseInvite, ResolveSpaceRules, strandFromSavedRow, wouldStrandLastOwner } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext } from './load-graph.js';
import type { MemberChangeKind } from './base-space-type-server-driver.js';
import { failDelete, refusalOf, resolveSpaceDriver } from './space-driver-call.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { notifySpaceLifecycleSubscribers } from './space-lifecycle-subscribers.js';
import { syncRoomEditGrantsForSpace } from './room-edit-grants.js';
import { parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Members';

/**
 * The kind of change the driver hears about after a save: what validation decided, when it ran (it knows a band change from a role
 * change, which the saved row no longer shows), else the best reading of the saved row.
 */
export function reportedMemberChangeKind(decided: MemberChangeKind | null, status: string, wasNew: boolean): MemberChangeKind {
    if (decided) return decided;
    if (status === 'Removed') return 'Remove';
    return wasNew ? 'Invite' : 'RoleChange';
}

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
                // Leaving skips the invite rules, but not the type's: a type may refuse a member leaving, or react to it
                this.pendingKind = 'Remove';
                const refusedLeave = await this.judgeWithDriver(user, spaceId, 'Remove');
                return refusedLeave ? fail(result, refusedLeave.field, refusedLeave.message) : result;
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
        const isNew = !this.IsSaved;
        const statusChanged = this.Fields.some((f) => f.Name === 'Status' && f.Dirty);
        const roleChanged = this.Fields.some((f) => f.Name === 'SpaceRoleTypeID' && f.Dirty);
        const bandChanged = this.Fields.some((f) => f.Name === 'Band' && f.Dirty);
        let memberKind: MemberChangeKind = 'Invite';
        if (this.Status === 'Removed' && (statusChanged || isNew)) {
            memberKind = 'Remove';
        } else if (roleChanged) {
            memberKind = 'RoleChange';
        } else if (bandChanged) {
            memberKind = 'BandChange';
        }
        this.pendingKind = memberKind;
        const refused = await this.judgeWithDriver(user, spaceId, memberKind);
        if (refused) return fail(result, refused.field, refused.message);

        return result;
    }

    /** Asks the space type's driver to judge this seat change. Null when it accepts. */
    private async judgeWithDriver(user: UserInfo, spaceId: string, kind: MemberChangeKind): Promise<{ field: string; message: string } | null> {
        try {
            const spaceInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(spaceId, this);
            const verdict = await spaceInfo.driver.ValidateMemberChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: spaceInfo.space,
                spaceType: spaceInfo.spaceType,
                effectiveRules: ResolveSpaceRules(null, null),
                member: this,
                kind,
            });
            return verdict.ok ? null : { field: verdict.field ?? 'SpaceRoleTypeID', message: verdict.message ?? 'Member change refused by driver.' };
        } catch (driverErr) {
            return { field: 'SpaceID', message: driverErr instanceof Error ? driverErr.message : 'Member change refused: driver could not be resolved.' };
        }
    }

    /** The kind of change Validate decided on, so Save tells the driver the same thing (Dirty flags are gone after the save). */
    private pendingKind: MemberChangeKind | null = null;

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const wasNew = !this.IsSaved;
        const previousStatus = this.Fields.find((f) => f.Name === 'Status')?.OldValue as string | undefined;
        const decidedKind = this.pendingKind;
        this.pendingKind = null;
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
                    kind: reportedMemberChangeKind(decidedKind, this.Status, wasNew),
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

    /** Asks the space type's driver before a seat is deleted, as Remove. Null when it accepts. */
    private async driverRefusalForDelete(): Promise<string | null> {
        const user = this.ContextCurrentUser;
        if (!user || !this.SpaceID || !this.IsSaved) return null;
        const resolved = await resolveSpaceDriver(this, this.ProviderToUse, user, this.SpaceID);
        if (!resolved.ok) return resolved.message;
        return refusalOf(await resolved.call.driver.ValidateMemberChange({ ...resolved.call.base, member: this, kind: 'Remove' }));
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const refusal = await this.driverRefusalForDelete();
        if (refusal) return failDelete(this, refusal);
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
