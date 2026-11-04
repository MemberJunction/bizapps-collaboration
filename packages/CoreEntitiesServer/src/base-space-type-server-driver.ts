/**
 * BaseSpaceTypeServerDriver
 * Extensibility plan § 5.
 */

import { createHash, randomBytes } from 'node:crypto';
import { type IEntityDataProvider, type IMetadataProvider, LogError, RunView, type UserInfo } from '@memberjunction/core';
import type {
    MJMagicLinkInviteApplicationEntity,
    MJMagicLinkInviteEntity,
    MJMagicLinkInviteRoleEntity,
    MJUserApplicationEntity,
    MJUserEntity,
    MJUserRoleEntity,
} from '@memberjunction/core-entities';
import { ResolvePersonIDForUser, ResolveUserIDForPerson } from '@mj-biz-apps/common-entities';
import { type EffectiveSpaceConfiguration, type EffectiveSpaceRules } from '@mj-biz-apps/collaboration-core';
import {
    type mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceItemEntity,
    type mjBizAppsCollaborationSpaceMemberEntity,
    type mjBizAppsCollaborationSpaceRoleTypeEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { requireSystemUser } from './load-graph.js';
import { asMetadata, parseUuid } from './uuid.js';

export interface DriverValidationResult {
    ok: boolean;
    message?: string;
    field?: string;
}

export interface DriverBaseContext {
    actingUser: UserInfo;
    provider: IMetadataProvider | IEntityDataProvider;
    space: mjBizAppsCollaborationSpaceEntity;
    spaceType: mjBizAppsCollaborationSpaceTypeEntity;
    /** The one configuration in force for the space (B16, D30): its settings, grants, audience and data reach. */
    configuration: EffectiveSpaceConfiguration;
    /** The settings as rules, read off `configuration`; `AdjustRules` may narrow them. */
    effectiveRules: EffectiveSpaceRules;
    subtypeEntityName?: string | null;
}

/**
 * What a change to a space means to the space's own driver. A kind is what the save asked for, read before anything rewrites the
 * row: a create; a close (the space enters a terminal status, stamping `ClosedAt`); a reopen (it leaves a read-only status for a
 * writable one); any other status change (stage 1: Active to Paused, Closed to Archived); a move (the parent changed); else an
 * update. A status change that also moves the space is refused, so no save is two of these.
 */
export type SpaceChangeKind = 'Create' | 'Update' | 'Move' | 'Close' | 'Reopen' | 'StatusChange' | 'Delete';

export interface SpaceChangeContext extends DriverBaseContext {
    kind: SpaceChangeKind;
    oldValues?: Record<string, unknown>;
    /** For a Close, a Reopen or a StatusChange: the status codes the space leaves and enters (null for a type with no statuses). */
    statusChange?: { fromCode: string | null; toCode: string | null };
}

/**
 * What a change to a sub-space means to its parent's driver. A `MoveChildIn` and a `MoveChildOut` are one save seen from the two
 * parents: the one it joins hears the first, the one it leaves the second. A `ReopenChild` is a closed sub-space becoming open
 * again. A save that closes and moves a space at once is refused, so no save is both.
 *
 * A rule on which sub-spaces may sit under a space has to judge every kind that leaves a sub-space open under it: `CreateChild`,
 * `MoveChildIn` and `ReopenChild`, and `UpdateChild` for a retype or a rename. Judging only `CreateChild` lets a move or a reopen
 * walk around the rule.
 */
export type ChildSpaceChangeKind = 'CreateChild' | 'UpdateChild' | 'ReopenChild' | 'MoveChildIn' | 'MoveChildOut' | 'CloseChild' | 'DeleteChild';

export interface ChildSpaceChangeContext extends DriverBaseContext {
    childSpace: mjBizAppsCollaborationSpaceEntity;
    kind: ChildSpaceChangeKind;
    /** What the child's changed fields held before this save. Empty for a create. */
    oldValues?: Record<string, unknown>;
}

/**
 * What a change to a seat means to the driver, from what the save asked for. A new seat is an `Invite`, or a `Remove` when it is
 * made Removed. A saved seat whose status becomes Active or Invited is an `Invite` too: an approval, a reinstatement or a re-invitation is the seat coming
 * into being, not a route the driver hears. Otherwise a status made Removed is a `Remove`, and a role or a band edit is a `RoleChange`
 * or a `BandChange`. The kind is what was asked for: a band the gate puts back still reaches the driver as a `BandChange`. A save
 * that touches none of status, role and band raises no seat reaction.
 *
 * A rule on who may hold a seat has to judge every kind that leaves someone holding it: `Invite`, `RoleChange` and `BandChange`
 * (and not only `Invite`). Judging only an invitation lets a role change walk around the rule.
 */
export type MemberChangeKind = 'Invite' | 'RoleChange' | 'BandChange' | 'Remove';

export interface MemberChangeContext extends DriverBaseContext {
    member: mjBizAppsCollaborationSpaceMemberEntity;
    kind: MemberChangeKind;
    oldValues?: Record<string, unknown>;
}

/**
 * What a change to an item means to the driver: a new item is `Add`; a different space is `Move`; a band that became Shared is
 * `Promote`; any other change (a rename, a note) is `Update`. `Remove` is a delete.
 */
export type ItemChangeKind = 'Add' | 'Update' | 'Promote' | 'Move' | 'Remove';

export interface ItemChangeContext extends DriverBaseContext {
    item: mjBizAppsCollaborationSpaceItemEntity;
    kind: ItemChangeKind;
    oldValues?: Record<string, unknown>;
}

export interface ChatChangeContext extends DriverBaseContext {
    chatName: string;
    chatKind: 'General' | 'Topic' | 'Private' | 'Assistant';
    isNew: boolean;
}

export interface MessageValidationContext extends DriverBaseContext {
    chatId: string;
    messageText: string;
}

export interface MessageContext extends DriverBaseContext {
    chatId: string;
    messageId: string;
    messageText: string;
}

export interface AgentContextParams extends DriverBaseContext {
    chatId: string;
    viewerBands: Record<string, 'Team' | 'Shared'>;
}

export interface AgentContextResult {
    instructions?: string[];
    contextData?: Record<string, unknown>;
}

export interface TaskFiledContext extends DriverBaseContext {
    taskId: string;
    taskTitle: string;
    band: 'Team' | 'Shared';
}

export interface AnchorContext {
    actingUser: UserInfo;
    provider: IMetadataProvider;
    spaceType: mjBizAppsCollaborationSpaceTypeEntity;
    entityName: string;
    recordId: string;
}

export interface PersonSeatInput {
    PersonID?: string | null;
    UserID?: string | null;
    Email?: string | null;
    RoleTypeName: string;
}

export interface SyncSeatsResult {
    added: number;
    updated: number;
    removed: number;
    invited: number;
    errors: string[];
}

export class BaseSpaceTypeServerDriver {
    /** Adjust or narrow the effective space rules. */
    public AdjustRules(
        _ctx: DriverBaseContext,
        rules: EffectiveSpaceRules
    ): Promise<EffectiveSpaceRules> | EffectiveSpaceRules {
        return rules;
    }

    /**
     * Validate a change to the space itself.
     *
     * A change to only the columns of the space's subtype (a board's term, a deal's stage) is judged here too, as kind `Update`:
     * `oldValues` names the subtype's changed columns and what they held, `subtypeEntityName` names the subtype, and the new values
     * are on the space's `LeafEntity`. That holds whether the subtype was saved through a loaded space or from a client over the wire.
     */
    public ValidateSpaceChange(
        _ctx: SpaceChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /**
     * React to a change to the space. It runs after the space's own save returns, and a failure is logged and the save stands. It
     * does not run after a commit when the save is part of a larger transaction: a space saved through its subtype (MJ's IsA save
     * wraps both rows) and `CreateSpace` run it inside that transaction, and for a change to only the subtype's columns before the
     * subtype's own row is written. Outside work (email, HTTP) belongs in `provider.RunAfterCommit`, which runs once the whole
     * transaction has committed. A change to only the subtype's columns is told here alone, not to the parent's driver, with the
     * same context as `ValidateSpaceChange` gave.
     */
    public OnSpaceChanged(_ctx: SpaceChangeContext): Promise<void> | void {}

    /** Validate a child space under this space (runs on parent's type driver). */
    public ValidateChildSpaceChange(
        _ctx: ChildSpaceChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to a child space change (runs on parent's type driver). */
    public OnChildSpaceChanged(_ctx: ChildSpaceChangeContext): Promise<void> | void {}

    /** Validate a member change. */
    public ValidateMemberChange(
        _ctx: MemberChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to a member change. */
    public OnMemberChanged(_ctx: MemberChangeContext): Promise<void> | void {}

    /** Validate an item change. */
    public ValidateItemChange(
        _ctx: ItemChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to an item change. */
    public OnItemChanged(_ctx: ItemChangeContext): Promise<void> | void {}

    /** Validate a chat creation or change. */
    public ValidateChatChange(
        _ctx: ChatChangeContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** Validate a message before posting. */
    public ValidateMessage(
        _ctx: MessageValidationContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** React to a posted message. */
    public OnMessagePosted(_ctx: MessageContext): Promise<void> | void {}

    /** Build agent context for a turn. */
    public BuildAgentContext(
        _ctx: AgentContextParams
    ): Promise<AgentContextResult> | AgentContextResult {
        return { instructions: [], contextData: {} };
    }

    /** React when a task is filed in the space. */
    public OnTaskFiled(_ctx: TaskFiledContext): Promise<void> | void {}

    /** Validate whether the caller can open an anchored space for a record. */
    public ValidateAnchor(
        _ctx: AnchorContext
    ): Promise<DriverValidationResult> | DriverValidationResult {
        return { ok: true };
    }

    /** Resolve parent space ID for an anchored space (null for root). */
    public ResolveAnchorParent(
        _ctx: AnchorContext
    ): Promise<string | null> | string | null {
        return null;
    }

    /**
     * Helper to sync seats from an external roster.
     * Modifies only seats with the matching SyncSource.
     */
    public async SyncSeats(
        space: mjBizAppsCollaborationSpaceEntity,
        source: string,
        people: PersonSeatInput[],
        actingUser: UserInfo,
        provider: IMetadataProvider
    ): Promise<SyncSeatsResult> {
        const result: SyncSeatsResult = {
            added: 0,
            updated: 0,
            removed: 0,
            invited: 0,
            errors: [],
        };

        const spaceId = parseUuid(space?.ID);
        const cleanSource = (source ?? '').trim();
        if (!spaceId || !cleanSource) {
            result.errors.push('SyncSeats requires a valid space ID and sync source.');
            return result;
        }

        const view = RunView.FromMetadataProvider(provider);
        let rosterReader = actingUser;
        try {
            rosterReader = await requireSystemUser(space);
        } catch {
            rosterReader = actingUser;
        }
        const roles = await loadSpaceRoleTypes(view, rosterReader);
        const existingSeatsResult = await view.RunView<{
            ID: string;
            UserID: string;
            PersonID?: string | null;
            SpaceRoleTypeID: string;
            Status: 'Active' | 'Invited' | 'Removed';
            Band?: 'Team' | 'Shared';
            SyncSource?: string | null;
        }>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                ExtraFilter: `SpaceID = '${spaceId}'`,
                ResultType: 'simple',
            },
            rosterReader
        );
        if (!existingSeatsResult.Success) {
            result.errors.push(existingSeatsResult.ErrorMessage ?? 'Could not read existing space members.');
            return result;
        }

        const existingByUser = new Map<
            string,
            {
                ID: string;
                UserID: string;
                PersonID?: string | null;
                SpaceRoleTypeID: string;
                Status: 'Active' | 'Invited' | 'Removed';
                Band?: 'Team' | 'Shared';
                SyncSource?: string | null;
            }
        >();
        for (const row of existingSeatsResult.Results ?? []) {
            const uid = parseUuid(row.UserID);
            if (uid) {
                existingByUser.set(uid, row);
            }
        }

        const desiredByUser = new Map<
            string,
            {
                userId: string;
                personId: string | null;
                roleId: string;
                band: 'Team' | 'Shared';
            }
        >();

        for (const seatInput of people ?? []) {
            const role = matchSpaceRoleType(roles, seatInput.RoleTypeName, space.SpaceTypeID);
            if (!role) {
                result.errors.push(`Unknown space role type '${seatInput.RoleTypeName}'.`);
                continue;
            }

            let personId = parseUuid(seatInput.PersonID);
            let userId = parseUuid(seatInput.UserID);
            let email = seatInput.Email?.trim() || null;

            if (!userId && personId) {
                try {
                    const resolvedUserId = await ResolveUserIDForPerson(personId, provider, actingUser);
                    userId = parseUuid(resolvedUserId);
                } catch {
                    // Fallback to direct People lookup below when provider.Entities is not populated on a test double
                }

                if (!userId || !email) {
                    const personLookup = await view.RunView<{
                        ID: string;
                        Email?: string | null;
                        LinkedUserID?: string | null;
                    }>(
                        {
                            EntityName: 'MJ_BizApps_Common: People',
                            ExtraFilter: `ID = '${personId}'`,
                            Fields: ['ID', 'Email', 'LinkedUserID'],
                            MaxRows: 1,
                            ResultType: 'simple',
                        },
                        actingUser
                    );
                    if (personLookup.Success && personLookup.Results?.[0]) {
                        const pRow = personLookup.Results[0];
                        if (!userId && pRow.LinkedUserID) {
                            userId = parseUuid(pRow.LinkedUserID);
                        }
                        if (!email && pRow.Email?.trim()) {
                            email = pRow.Email.trim();
                        }
                    }
                }
            }

            if (userId && !personId) {
                try {
                    const userEntity = await provider.GetEntityObject<MJUserEntity>('MJ: Users', actingUser);
                    if (userEntity && typeof userEntity.Load === 'function' && (await userEntity.Load(userId))) {
                        const resolvedPersonId = await ResolvePersonIDForUser(userEntity, provider, actingUser);
                        personId = parseUuid(resolvedPersonId);
                    }
                } catch {
                    // Non-fatal
                }
            }

            if (!userId && email) {
                const safeEmail = email.replace(/'/g, "''");
                const userLookup = await view.RunView<{ ID: string }>(
                    {
                        EntityName: 'MJ: Users',
                        ExtraFilter: `Email = '${safeEmail}'`,
                        Fields: ['ID'],
                        MaxRows: 1,
                        ResultType: 'simple',
                    },
                    actingUser
                );
                if (userLookup.Success && userLookup.Results?.[0]?.ID) {
                    userId = parseUuid(userLookup.Results[0].ID);
                }
            }

            if (!userId) {
                if (email && email.includes('@')) {
                    const inviteOutcome = await recordPendingEmailInvite({
                        provider,
                        view,
                        email,
                        spaceId,
                        personId,
                        roleId: role.ID,
                        band: role.CanSeeTeamBand ? 'Team' : 'Shared',
                        syncSource: cleanSource,
                        actingUser,
                        systemUser: rosterReader,
                        existingByUser,
                    });
                    if (inviteOutcome.ok) {
                        result.invited += 1;
                        if (inviteOutcome.provisionedUserId) {
                            desiredByUser.set(inviteOutcome.provisionedUserId, {
                                userId: inviteOutcome.provisionedUserId,
                                personId,
                                roleId: role.ID,
                                band: role.CanSeeTeamBand ? 'Team' : 'Shared',
                            });
                        }
                    } else if (inviteOutcome.error) {
                        result.errors.push(inviteOutcome.error);
                    }
                } else {
                    result.errors.push(
                        `Cannot sync seat for ${personId ?? 'unknown person'}: no linked MJ User and no valid email address.`
                    );
                }
                continue;
            }

            desiredByUser.set(userId, {
                userId,
                personId,
                roleId: role.ID,
                band: role.CanSeeTeamBand ? 'Team' : 'Shared',
            });
        }

        // Add or update desired seats
        for (const [userId, desired] of desiredByUser.entries()) {
            const existing = existingByUser.get(userId);
            if (!existing) {
                try {
                    const member = await provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
                        'MJ_BizApps_Collaboration: Space Members',
                        actingUser
                    );
                    member.NewRecord();
                    member.SpaceID = space.ID;
                    member.UserID = desired.userId;
                    member.SpaceRoleTypeID = desired.roleId;
                    member.Band = desired.band;
                    member.Status = 'Active';
                    member.SyncSource = cleanSource;
                    if (desired.personId) {
                        member.PersonID = desired.personId;
                    }
                    if (await member.Save()) {
                        result.added += 1;
                    } else {
                        result.errors.push(
                            member.LatestResult?.CompleteMessage ?? `Failed to add seat for user ${desired.userId}.`
                        );
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    LogError(`SyncSeats add failed for user ${desired.userId}: ${msg}`);
                    result.errors.push(msg);
                }
                continue;
            }

            const existingSource = (existing.SyncSource ?? '').trim();
            const isSameSource = existingSource === cleanSource;
            const wasRemoved = existing.Status === 'Removed';

            // Never touch an active or invited seat owned by a different source or invited manually
            if (!isSameSource && !wasRemoved) {
                continue;
            }

            const roleChanged = parseUuid(existing.SpaceRoleTypeID) !== parseUuid(desired.roleId);
            const statusChanged = existing.Status !== 'Active';
            const sourceChanged = existingSource !== cleanSource;
            const personChanged = !!(desired.personId && parseUuid(existing.PersonID) !== desired.personId);

            if (!roleChanged && !statusChanged && !sourceChanged && !personChanged) {
                continue;
            }

            try {
                const member = await provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
                    'MJ_BizApps_Collaboration: Space Members',
                    actingUser
                );
                const loaded = typeof member.Load === 'function' ? await member.Load(existing.ID) : true;
                if (!loaded) {
                    result.errors.push(`Could not load existing seat ${existing.ID}.`);
                    continue;
                }
                member.SpaceRoleTypeID = desired.roleId;
                member.Band = desired.band;
                member.Status = 'Active';
                member.SyncSource = cleanSource;
                if (desired.personId) {
                    member.PersonID = desired.personId;
                }
                if (await member.Save()) {
                    if (wasRemoved) {
                        result.added += 1;
                    } else {
                        result.updated += 1;
                    }
                } else {
                    result.errors.push(
                        member.LatestResult?.CompleteMessage ?? `Failed to update seat ${existing.ID}.`
                    );
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                LogError(`SyncSeats update failed for seat ${existing.ID}: ${msg}`);
                result.errors.push(msg);
            }
        }

        // Remove seats from this SyncSource that are no longer in the incoming roster
        for (const [userId, existing] of existingByUser.entries()) {
            const existingSource = (existing.SyncSource ?? '').trim();
            if (existingSource !== cleanSource || existing.Status === 'Removed') {
                continue;
            }
            if (desiredByUser.has(userId)) {
                continue;
            }

            try {
                const member = await provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
                    'MJ_BizApps_Collaboration: Space Members',
                    actingUser
                );
                const loaded = typeof member.Load === 'function' ? await member.Load(existing.ID) : true;
                if (!loaded) {
                    result.errors.push(`Could not load seat ${existing.ID} for removal.`);
                    continue;
                }
                member.Status = 'Removed';
                if (await member.Save()) {
                    result.removed += 1;
                } else {
                    result.errors.push(
                        member.LatestResult?.CompleteMessage ?? `Failed to remove seat ${existing.ID}.`
                    );
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                LogError(`SyncSeats remove failed for seat ${existing.ID}: ${msg}`);
                result.errors.push(msg);
            }
        }

        return result;
    }
}

interface SpaceRoleRow {
    ID: string;
    Name: string;
    Code?: string | null;
    SpaceTypeID?: string | null;
    CanSeeTeamBand?: boolean;
}

async function loadSpaceRoleTypes(view: RunView, actingUser: UserInfo): Promise<SpaceRoleRow[]> {
    const res = await view.RunView<SpaceRoleRow>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Space Role Types',
            ResultType: 'simple',
        },
        actingUser
    );
    if (res.Success && (res.Results?.length ?? 0) > 0) {
        return res.Results ?? [];
    }
    if (CollaborationEngine.Instance.Loaded) {
        return CollaborationEngine.Instance.SpaceRoleTypes.map((r: mjBizAppsCollaborationSpaceRoleTypeEntity) => ({
            ID: r.ID,
            Name: r.Name,
            Code: r.Code,
            CanSeeTeamBand: r.CanSeeTeamBand,
        }));
    }
    return [];
}

function matchSpaceRoleType(
    roles: readonly SpaceRoleRow[],
    roleTypeName: string,
    spaceTypeId: string | null | undefined
): SpaceRoleRow | null {
    const needle = (roleTypeName ?? '').trim().toLowerCase();
    if (!needle) return null;
    const targetTypeId = parseUuid(spaceTypeId);
    const matching = roles.filter(
        (r) =>
            (r.Name ?? '').trim().toLowerCase() === needle ||
            (r.Code ?? '').trim().toLowerCase() === needle ||
            parseUuid(r.ID) === parseUuid(roleTypeName)
    );
    if (matching.length === 0) return null;
    if (targetTypeId) {
        const typeSpecific = matching.find((r) => parseUuid(r.SpaceTypeID) === targetTypeId);
        if (typeSpecific) return typeSpecific;
    }
    const globalRole = matching.find((r) => !r.SpaceTypeID);
    return globalRole ?? matching[0];
}

const COLLABORATION_APPLICATION_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';
const SPACE_PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
const DEFAULT_INVITE_EXPIRY_HOURS = 72;

async function recordPendingEmailInvite(params: {
    provider: IMetadataProvider;
    view: RunView;
    email: string;
    spaceId: string;
    personId: string | null;
    roleId: string;
    band: 'Team' | 'Shared';
    syncSource: string;
    actingUser: UserInfo;
    systemUser: UserInfo;
    existingByUser: Map<
        string,
        {
            ID: string;
            UserID: string;
            PersonID?: string | null;
            SpaceRoleTypeID: string;
            Status: 'Active' | 'Invited' | 'Removed';
            Band?: 'Team' | 'Shared';
            SyncSource?: string | null;
        }
    >;
}): Promise<{ ok: boolean; provisionedUserId?: string; error?: string }> {
    const { provider, view, email, spaceId, personId, roleId, band, syncSource, actingUser, systemUser, existingByUser } = params;
    try {
        let provisionedUserId: string | undefined;

        // Provision account + role + app + seat when MJ: Users is available on the provider (mirrors mintSpaceLink)
        const account = await provider.GetEntityObject<MJUserEntity>('MJ: Users', systemUser);
        if (account && typeof account.NewRecord === 'function' && typeof account.Save === 'function') {
            account.NewRecord();
            account.Name = email;
            account.Email = email;
            account.FirstName = 'Guest';
            account.LastName = email;
            account.Type = 'User';
            account.IsActive = true;
            if (await account.Save()) {
                const newUserId = parseUuid(account.ID);
                if (newUserId) {
                    provisionedUserId = newUserId;
                    const userRole = await provider.GetEntityObject<MJUserRoleEntity>('MJ: User Roles', systemUser);
                    if (userRole && typeof userRole.NewRecord === 'function' && typeof userRole.Save === 'function') {
                        userRole.NewRecord();
                        userRole.UserID = newUserId;
                        userRole.RoleID = SPACE_PARTICIPANT_ROLE_ID;
                        await userRole.Save();
                    }
                    const userApp = await provider.GetEntityObject<MJUserApplicationEntity>('MJ: User Applications', systemUser);
                    if (userApp && typeof userApp.NewRecord === 'function' && typeof userApp.Save === 'function') {
                        userApp.NewRecord();
                        userApp.UserID = newUserId;
                        userApp.ApplicationID = COLLABORATION_APPLICATION_ID;
                        userApp.Sequence = 0;
                        userApp.IsActive = true;
                        await userApp.Save();
                    }
                    const seat = await provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
                        'MJ_BizApps_Collaboration: Space Members',
                        actingUser
                    );
                    if (seat && typeof seat.NewRecord === 'function' && typeof seat.Save === 'function') {
                        seat.NewRecord();
                        seat.SpaceID = spaceId;
                        seat.UserID = newUserId;
                        seat.SpaceRoleTypeID = roleId;
                        seat.Band = band;
                        seat.Status = 'Active';
                        seat.SyncSource = syncSource;
                        if (personId) {
                            seat.PersonID = personId;
                        }
                        if (await seat.Save()) {
                            existingByUser.set(newUserId, {
                                ID: seat.ID,
                                UserID: newUserId,
                                PersonID: personId,
                                SpaceRoleTypeID: roleId,
                                Status: 'Active',
                                Band: band,
                                SyncSource: syncSource,
                            });
                        }
                    }
                }
            }
        }

        const safeEmail = email.replace(/'/g, "''");
        const existing = await view.RunView<{ ID: string }>(
            {
                EntityName: 'MJ: Magic Link Invites',
                ExtraFilter: `Email = '${safeEmail}' AND Status = 'Active'`,
                Fields: ['ID'],
                MaxRows: 1,
                ResultType: 'simple',
            },
            systemUser
        );
        if (existing.Success && (existing.Results?.length ?? 0) > 0) {
            return { ok: true, provisionedUserId };
        }

        const invite = await provider.GetEntityObject<MJMagicLinkInviteEntity>(
            'MJ: Magic Link Invites',
            systemUser
        );
        if (!invite || typeof invite.NewRecord !== 'function' || typeof invite.Save !== 'function') {
            return { ok: false, error: `Magic link invite entity is not available for ${email}.` };
        }

        const rawToken = `mj_ml_${randomBytes(32).toString('hex')}`;
        invite.NewRecord();
        invite.TokenHash = createHash('sha256').update(rawToken).digest('base64url');
        invite.Email = email;
        invite.ApplicationID = COLLABORATION_APPLICATION_ID;
        invite.RoleID = SPACE_PARTICIPANT_ROLE_ID;
        invite.ExpiresAt = new Date(Date.now() + DEFAULT_INVITE_EXPIRY_HOURS * 3600 * 1000);
        invite.MaxUses = 1;
        invite.UseCount = 0;
        invite.CreatedByUserID = actingUser.ID;
        invite.Status = 'Active';
        invite.IdentityMode = 'email';
        invite.Kind = 'app-session';

        const saved = await invite.Save();
        if (!saved) {
            const msg = invite.LatestResult?.CompleteMessage ?? `Failed to save magic link invite for ${email}.`;
            return { ok: false, error: msg };
        }

        if (invite.ID) {
            const inviteApp = await provider.GetEntityObject<MJMagicLinkInviteApplicationEntity>(
                'MJ: Magic Link Invite Applications',
                systemUser
            );
            if (inviteApp && typeof inviteApp.NewRecord === 'function' && typeof inviteApp.Save === 'function') {
                inviteApp.NewRecord();
                inviteApp.InviteID = invite.ID;
                inviteApp.ApplicationID = COLLABORATION_APPLICATION_ID;
                await inviteApp.Save();
            }
            const inviteRole = await provider.GetEntityObject<MJMagicLinkInviteRoleEntity>(
                'MJ: Magic Link Invite Roles',
                systemUser
            );
            if (inviteRole && typeof inviteRole.NewRecord === 'function' && typeof inviteRole.Save === 'function') {
                inviteRole.NewRecord();
                inviteRole.InviteID = invite.ID;
                inviteRole.RoleID = SPACE_PARTICIPANT_ROLE_ID;
                await inviteRole.Save();
            }
        }

        return { ok: true, provisionedUserId };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        LogError(`SyncSeats invite failed for ${email}: ${msg}`);
        return { ok: false, error: msg };
    }
}
void requireSystemUser;
void asMetadata;
