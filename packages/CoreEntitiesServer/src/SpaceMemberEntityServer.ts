import { BaseEntity, LogError, ValidationErrorInfo, ValidationErrorType, type UserInfo, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { isSelfRemoval, membershipReaches, refuseInvite, strandFromSavedRow, wouldStrandLastOwner } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext } from './load-graph.js';
import { spaceTypeAudience } from './space-audience.js';
import type { MemberChangeKind } from './base-space-type-server-driver.js';
import { failDelete, refusalOf, resolveSpaceDriver, driverBaseContext, subtypeOf } from './space-driver-call.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { notifySpaceLifecycleSubscribers } from './space-lifecycle-subscribers.js';
import { syncRoomEditGrantsForSpace } from './room-edit-grants.js';
import { parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Members';

/**
 * The kind of change a seat save is, from what the save asked for. A new seat is an Invite (a Remove when made Removed), and so is
 * a seat whose status becomes Active or Invited: an approval, a reinstatement or a re-invitation. Otherwise a status made Removed is a Remove, and a role or a band
 * edit is a RoleChange or a BandChange. A save that touches none of these is no seat change and has no kind.
 */
export function decideMemberKind(change: { isNew: boolean; status: string; statusChanged: boolean; roleChanged: boolean; bandChanged: boolean }): MemberChangeKind | null {
    // A new seat, whatever else is dirty: the gate derives its band and status itself
    if (change.isNew) return change.status === 'Removed' ? 'Remove' : 'Invite';
    if (change.statusChanged && change.status === 'Removed') return 'Remove';
    // A seat that comes back into being (approved, reinstated, or made Invited again) is an Invite
    if (change.statusChanged && (change.status === 'Active' || change.status === 'Invited')) return 'Invite';
    if (change.roleChanged) return 'RoleChange';
    if (change.bandChanged) return 'BandChange';
    return null;
}

/** What a seat save changes: its kind (none when it touches no status, role or band), what the fields held, and whether it is a change. */
interface SeatChangeReading {
    kind: MemberChangeKind | null;
    oldValues: Record<string, unknown>;
    changed: boolean;
}

@RegisterClass(BaseEntity, ENTITY)
export class SpaceMemberEntityServer extends mjBizAppsCollaborationSpaceMemberEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        // The reading `Save` took, or one taken here before the gate rewrites the status and the band when validation runs on its own
        const reading = this.readingForSave ?? this.readChange();
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
                return fail(result, 'Status', "This is the space's last owner seat. Seat another owner first.");
            }
            const dirty = this.Fields.filter((field) => field.Dirty).map((field) => field.Name);
            if (dirty.length === 1 && dirty[0] === 'Status' && isSelfRemoval({ callerUserId: caller, inviteeUserId: invitee, nextStatus: this.Status })) {
                // Leaving skips the invite rules, but not the type's: a type may refuse a member leaving, or react to it
                const refusedLeave = await this.judgeWithDriver(user, spaceId, 'Remove', reading.oldValues);
                return refusedLeave ? fail(result, refusedLeave.field, refusedLeave.message) : result;
            }
        }
        if (!context.role) {
            return fail(result, 'SpaceRoleTypeID', 'Invite refused: that role does not exist.');
        }
        // The staff-only promise (item 157): a type that seats staff only takes no seat whose role cannot see the Team band
        if (!context.role.canSeeTeamBand && this.Status !== 'Removed' && (!this.IsSaved || this.Fields.some((field) => (field.Name === 'SpaceRoleTypeID' || field.Name === 'Status') && field.Dirty))) {
            if (spaceTypeAudience(context.typeId) === 'StaffOnly') {
                return fail(result, 'SpaceRoleTypeID', "Invite refused: this space's type seats staff only, so a role that cannot see the Team band has no seat here.");
            }
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

        // Extensibility Driver Validation: only for a change to the seat itself
        if (reading.kind) {
            const refused = await this.judgeWithDriver(user, spaceId, reading.kind, reading.oldValues);
            if (refused) return fail(result, refused.field, refused.message);
        }

        return result;
    }

    /** Asks the space type's driver to judge this seat change. Null when it accepts. */
    private async judgeWithDriver(user: UserInfo, spaceId: string, kind: MemberChangeKind, oldValues?: Record<string, unknown>): Promise<{ field: string; message: string } | null> {
        try {
            const spaceInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(spaceId, this);
            const verdict = await spaceInfo.driver.ValidateMemberChange({
                ...(await driverBaseContext(this.ProviderToUse, user, spaceInfo.space, spaceInfo.spaceType, spaceInfo.configuration)),
                member: this,
                kind,
                oldValues,
            });
            return verdict.ok ? null : { field: verdict.field ?? 'SpaceRoleTypeID', message: verdict.message ?? 'Member change refused by driver.' };
        } catch (driverErr) {
            return { field: 'SpaceID', message: driverErr instanceof Error ? driverErr.message : 'Member change refused: driver could not be resolved.' };
        }
    }

    private isFieldDirty(name: string): boolean {
        return this.Fields.some((f) => f.Name === name && f.Dirty);
    }

    /** What this save changes, read once. */
    private readChange(): SeatChangeReading {
        const isNew = !this.IsSaved;
        const kind = this.currentKind();
        return { kind, oldValues: isNew ? {} : this.dirtyOldValues(), changed: kind !== null };
    }

    /** What `Save` read, handed to validation so a save has one reading. Validation called on its own reads for itself. */
    private readingForSave: SeatChangeReading | null = null;

    /** The kind of change this save is, from its dirty fields. */
    private currentKind(): MemberChangeKind | null {
        return decideMemberKind({
            isNew: !this.IsSaved,
            status: this.Status,
            statusChanged: this.isFieldDirty('Status'),
            roleChanged: this.isFieldDirty('SpaceRoleTypeID'),
            bandChanged: this.isFieldDirty('Band'),
        });
    }

    /** What each changed field held before this save, by field name. System columns are left out. */
    private dirtyOldValues(): Record<string, unknown> {
        const old: Record<string, unknown> = {};
        for (const field of this.Fields) {
            if (field.Dirty && !field.Name.startsWith('__mj_')) old[field.Name] = field.OldValue;
        }
        return old;
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const wasNew = !this.IsSaved;
        const previousStatus = this.Fields.find((f) => f.Name === 'Status')?.OldValue as string | undefined;
        // One reading per save: taken here, before the gate rewrites anything, handed to validation, and used by the reaction.
        // Dropped when the save is done, so a retry starts clean.
        const own = this.readChange();
        this.readingForSave = own;
        let ok = false;
        try {
            ok = await super.Save(options);
        } finally {
            this.readingForSave = null;
        }
        const decided = own;
        if (ok && this.ContextCurrentUser && this.SpaceID) {
            const user = this.ContextCurrentUser;
            // Nothing changed, nothing to tell: MJ's Save returns true for a clean record without writing it
            let spaceTypeCodeForSubscribers: string | null = null;
            if (decided.changed && decided.kind) {
                let typeCodeOfSeat: string | undefined;
                try {
                    const spaceInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(this.SpaceID, this);
                    typeCodeOfSeat = spaceInfo.spaceType.Code;
                    spaceTypeCodeForSubscribers = typeCodeOfSeat ?? null;
                    await spaceInfo.driver.OnMemberChanged({
                        ...(await driverBaseContext(this.ProviderToUse, user, spaceInfo.space, spaceInfo.spaceType, spaceInfo.configuration)),
                        member: this,
                        kind: decided.kind,
                        oldValues: decided.oldValues,
                    });
                } catch (driverErr) {
                    LogError(`OnMemberChanged of space type '${typeCodeOfSeat ?? 'not resolved'}' failed for space ${this.SpaceID} (seat ${this.ID}): ${driverErr instanceof Error ? driverErr.message : String(driverErr)}`);
                }
            }

            const becameActive = this.Status === 'Active' && (wasNew || previousStatus !== 'Active');
            const becameRemoved = this.Status === 'Removed' && previousStatus !== 'Removed';

            if (becameActive) {
                notifySpaceLifecycleSubscribers(this.ProviderToUse, {
                    spaceId: this.SpaceID,
                    spaceTypeCode: spaceTypeCodeForSubscribers,
                    actingUserId: user.ID,
                    event: 'AfterMemberAdded',
                    timestamp: new Date(),
                    data: { memberId: this.ID, userId: this.UserID, personId: this.PersonID },
                });
            } else if (becameRemoved) {
                notifySpaceLifecycleSubscribers(this.ProviderToUse, {
                    spaceId: this.SpaceID,
                    spaceTypeCode: spaceTypeCodeForSubscribers,
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
