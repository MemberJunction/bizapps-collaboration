/**
 * An email invitation is a seat, saved through the member gate.
 *
 * When magic links are enabled on the host (`host.enabled === true`), the sign-in link only proves
 * who the person is. It is an app session, not a resource share, so access ends when the seat is
 * removed. The raw URL is emailed to that address, or returned to a host issuer.
 *
 * When magic links are turned off (`host.enabled === false`, e.g., Auth0 / WorkOS external IdP),
 * the invite pre-creates the MJ User (assigned the Space Participant role only) and SpaceMember
 * seat, grants access to the SpaceType's target MJ Application (falling back gracefully when not
 * overridden), and dispatches a sign-in notification without requiring or minting a magic link.
 */
import { createHash, randomBytes } from 'node:crypto';
import { type BaseEntity, LogError, Metadata, RunView, type IMetadataProvider, UserInfo, WellKnownUserSource } from '@memberjunction/core';
import '@memberjunction/core-entities';
import {
    MJMagicLinkInviteApplicationEntity,
    MJMagicLinkInviteEntity,
    MJMagicLinkInviteRoleEntity,
    MJUserApplicationEntity,
    MJUserEntity,
    MJUserRoleEntity,
} from '@memberjunction/core-entities';
import { UserCache } from '@memberjunction/generic-database-provider';
import { NotificationEngine } from '@memberjunction/notifications';
import '@mj-biz-apps/common-entities';
import { IsPeopleEntity, mjBizAppsCommonPersonEntity, ResolvePersonIDForUser } from '@mj-biz-apps/common-entities';
import {
    callerMayReceiveLink,
    idpInviteEmail,
    inviteEmail,
    linkHandoff,
    lockoutMessage,
    magicLinkBlocksAccount,
    membershipReaches,
    refuseInvite,
    resolveTargetApplicationId,
    type InviteEmail,
} from '@mj-biz-apps/collaboration-core';
import { COLLABORATION_APP_ID } from '@mj-biz-apps/collaboration-engine-base';
import { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { spaceTypeConfigurationAudience } from './space-audience.js';
import { asMetadata, parseUuid } from './uuid.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_TYPES = 'MJ_BizApps_Collaboration: Space Types';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const INVITES = 'MJ: Magic Link Invites';
const USERS = 'MJ: Users';
const USER_ROLES = 'MJ: User Roles';
const USER_APPS = 'MJ: User Applications';
const APPLICATIONS = 'MJ: Applications';
const ROLES = 'MJ: Roles';
const PEOPLE = 'MJ_BizApps_Common: People';
const SPACE_RESOURCE = '33642155-617E-4825-A2CC-F071A60F3739';
const DEFAULT_PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
const DEFAULT_PARTICIPANT_ROLE_NAME = 'Space Participant';
const PLACEHOLDER_USER = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SPACE_INVITE_NOTIFICATION_TYPE = 'Collaboration: Space Invite';

export interface ResolvedTargetApplication {
    id: string;
    name: string;
    path: string | null;
}

export interface IdpSignInNotification {
    userId: string;
    email: string;
    spaceId: string;
    spaceName: string | null;
    applicationId: string;
    applicationName: string;
    applicationPath: string | null;
    signInUrl: string;
    emailDraft: InviteEmail;
}

export interface MagicLinkHost {
    enabled: boolean;
    publicUrl: string;
    restrictedRoleName: string;
    grantableRoleNames: readonly string[];
    inviteIssuerRoleNames: readonly string[];
    communicationProvider?: string;
    fromAddress: string;
    defaultExpiresInHours: number;
    /** MJ's default is block. warn still issues a link MJ will redeem with a warning. */
    provisioningGuard: 'block' | 'warn';
    /** Optional host-level fallback MJ Application ID when a SpaceType does not override TargetApplicationID. */
    defaultApplicationId?: string;
    sendInviteEmail?: (system: UserInfo, providerName: string, message: InviteEmail) => Promise<boolean>;
    /** Optional notification handler used when magic links are disabled (`enabled: false`) for external IdP sign-in. */
    sendSignInNotification?: (system: UserInfo, notification: IdpSignInNotification) => Promise<boolean>;
}

export interface MintSpaceLinkResult {
    ok: boolean;
    kind?: 'refused';
    reason?: 'role-not-grantable' | 'type-is-staff-only';
    sent?: boolean;
    redemptionUrl?: string;
    message?: string;
    userId?: string;
    linkFailed?: boolean;
    notificationFailed?: boolean;
    targetApplicationId?: string;
    targetApplicationName?: string;
}

export interface ResolvedInvitedSeat {
    seatId: string;
    spaceId: string;
    spaceName: string;
    spaceTypeId: string;
    status: 'Active' | 'Invited' | 'Removed';
    band: 'Team' | 'Shared';
    roleId: string;
    targetApplicationId: string;
    targetApplicationName: string;
    targetApplicationPath: string | null;
}

export interface ResolveInvitedSeatsResult {
    ok: boolean;
    userId: string | null;
    email: string | null;
    seats: ResolvedInvitedSeat[];
    activeSeats: ResolvedInvitedSeat[];
    invitedSeats: ResolvedInvitedSeat[];
    removedSeats: ResolvedInvitedSeat[];
    landingApplications: ResolvedTargetApplication[];
    lockoutMessage: string | null;
    message?: string;
}

let hostProvider: (() => MagicLinkHost) | null = null;

export function setMagicLinkHostProvider(fn: (() => MagicLinkHost) | null): void {
    hostProvider = fn;
}

export function resolveMagicLinkHost(override?: Partial<MagicLinkHost>): MagicLinkHost {
    const base: MagicLinkHost = hostProvider
        ? hostProvider()
        : {
              enabled: process.env.MAGIC_LINK_ENABLED !== 'false',
              publicUrl: process.env.PUBLIC_URL || 'http://localhost:4000',
              restrictedRoleName: process.env.MAGIC_LINK_RESTRICTED_ROLE || 'Magic Link Baseline',
              grantableRoleNames: ['Space Participant'],
              inviteIssuerRoleNames: [],
              communicationProvider: process.env.MAGIC_LINK_COMM_PROVIDER || undefined,
              fromAddress: process.env.MAGIC_LINK_FROM_ADDRESS || '',
              defaultExpiresInHours: 72,
              provisioningGuard: 'block',
          };
    return override ? { ...base, ...override } : base;
}

type SqlProvider = IMetadataProvider & {
    BeginTransaction?: () => Promise<void>;
    CommitTransaction?: () => Promise<void>;
    RollbackTransaction?: () => Promise<void>;
};

interface ResolvedParticipantRole {
    id: string;
    name: string;
}

/**
 * Invites a person into a space: provisions or reuses their MJ User and SpaceMember seat, grants the
 * SpaceType's target MJ Application (falling back gracefully when unset), and either mints a magic link
 * (`host.enabled === true`) or sends an external-IdP sign-in notification (`host.enabled === false`).
 */
export async function mintSpaceLink(input: {
    provider: IMetadataProvider;
    user: UserInfo;
    spaceId: string;
    email: string;
    roleId: string;
    host?: MagicLinkHost;
    syncSource?: string | null;
    personId?: string | null;
}): Promise<MintSpaceLinkResult> {
    const host = input.host ?? resolveMagicLinkHost();
    const email = input.email.trim();
    if (!email.includes('@') || /\s/.test(email)) return { ok: false, message: 'Invite refused: enter an email address.' };
    if (!UUID.test(input.spaceId) || !UUID.test(input.roleId)) return { ok: false, message: 'Invite refused: the space and role must be real ids.' };

    const rawSpace = await input.provider.GetEntityObject<BaseEntity>(SPACES, input.user);
    const space = rawSpace ?? null;

    let context;
    try {
        context = await loadWriteContext(space, input.user, input.spaceId, input.roleId, null, input.provider);
    } catch (error) {
        LogError(error);
        return { ok: false, message: 'Invite refused: the roster could not be read.' };
    }
    const granted = context.role;
    if (!granted) return { ok: false, message: 'Invite refused: that role is not on this host.' };
    // The staff-only promise (item 157): a type that seats staff only issues no Space Participant invite
    if (spaceTypeConfigurationAudience(context.typeConfiguration) === 'StaffOnly') {
        return {
            ok: false,
            kind: 'refused',
            reason: 'type-is-staff-only',
            message: "Invite refused: this space's type seats staff only, so no Space Participant link is issued for it.",
        };
    }

    const system = await requireSystemUserForInvite(input.provider, space);
    const participantRole = await resolveParticipantRole(input.provider, system);
    if (!roleGrantable(participantRole.name, host.restrictedRoleName, host.grantableRoleNames)) {
        return {
            ok: false,
            kind: 'refused',
            reason: 'role-not-grantable',
            message: `Invite refused: this host has not opted in to granting ${participantRole.name}. Add it to magicLink.grantableRoleNames.`,
        };
    }

    const found = await findUserId(input.provider, email, system);
    if (found.ok === false) return { ok: false, message: found.message };
    const existingId = found.id;
    const preview = refuseInvite({
        callerUserId: input.user.ID,
        inviteeUserId: existingId ?? PLACEHOLDER_USER,
        targetSpaceId: input.spaceId,
        granted,
        approval: context.approval,
        memberCap: context.memberCap,
        occupied: context.memberCount,
        spaces: context.spaces,
        memberships: context.memberships,
    });
    if (preview.ok === false) return { ok: false, message: preview.message };

    const targetApp = await resolveTargetApplication(input.provider, system, {
        typeId: context.typeId,
        typeTargetApplicationId: context.targetApplicationId,
        typeTargetApplicationName: context.targetApplicationName,
        hostDefaultApplicationId: host.defaultApplicationId,
    });

    let accountId = existingId;
    let createdUser = false;
    if (!accountId) {
        const created = await createAccount(input.provider, system, email, participantRole.id, targetApp.id);
        if (created.ok === false) return { ok: false, message: created.message };
        accountId = created.id;
        createdUser = true;
    }

    const seated = await findSeat(input.provider, input.spaceId, accountId, system);
    if (seated.ok === false) {
        if (createdUser) await deleteNewAccount(input.provider, system, accountId);
        await refreshUsers(input.provider);
        return { ok: false, message: seated.message };
    }
    const callerIsOwner = !!membershipReaches(context.spaces, context.memberships, input.user.ID, input.spaceId)?.role.isOwnerRole;
    const band = granted.canSeeTeamBand ? 'Team' : 'Shared';
    let status = seated.status;
    const restoring = status === 'Removed';
    if (!status || restoring) {
        const written = await writeSeat(input, accountId, band, preview.status, restoring ? seated.id : null);
        if (written.ok === false) {
            if (createdUser) await deleteNewAccount(input.provider, system, accountId);
            await refreshUsers(input.provider);
            return { ok: false, message: written.message };
        }
        status = written.status;
    } else if (status === 'Active' && !callerIsOwner) {
        return {
            ok: true,
            sent: false,
            userId: accountId,
            targetApplicationId: targetApp.id,
            targetApplicationName: targetApp.name,
            message: host.enabled
                ? 'They are already seated. The owner sends the sign-in link.'
                : 'They are already seated. The owner sends the sign-in notification.',
        };
    }
    if ((!seated.status || restoring) && status !== preview.status) {
        const grant = await grantAfterSeat(input.provider, system, accountId, participantRole.id, targetApp.id);
        const mismatch = `The seat was saved as ${status}. The gate had decided ${preview.status}.`;
        return {
            ok: true,
            sent: false,
            userId: accountId,
            targetApplicationId: targetApp.id,
            targetApplicationName: targetApp.name,
            message: grant ?? mismatch,
        };
    }
    const access = await grantAfterSeat(input.provider, system, accountId, participantRole.id, targetApp.id);
    if (access) {
        return {
            ok: true,
            sent: false,
            userId: accountId,
            targetApplicationId: targetApp.id,
            targetApplicationName: targetApp.name,
            message: access,
        };
    }
    try {
        await ensurePerson(input.provider, system, accountId, email, input.personId);
    } catch (error) {
        LogError(error);
        return {
            ok: true,
            sent: false,
            userId: accountId,
            targetApplicationId: targetApp.id,
            targetApplicationName: targetApp.name,
            message: 'The seat was saved. The person record was not.',
        };
    }
    if (status === 'Invited') {
        return {
            ok: true,
            sent: false,
            userId: accountId,
            targetApplicationId: targetApp.id,
            targetApplicationName: targetApp.name,
            message: host.enabled
                ? 'They are seated as Invited. The sign-in link waits until an owner approves them. The owner can send it again after that.'
                : 'They are seated as Invited. The sign-in notification waits until an owner approves them. The owner can send it again after that.',
        };
    }

    if (!host.enabled) {
        const notified = await deliverIdpSignInNotification({
            provider: input.provider,
            host,
            system,
            userId: accountId,
            email,
            spaceId: input.spaceId,
            spaceName: context.spaceName ?? null,
            targetApp,
        });
        return {
            ...notified,
            userId: accountId,
            targetApplicationId: targetApp.id,
            targetApplicationName: targetApp.name,
        };
    }

    const invitee = (UserCache.Users ?? []).find((user) => (user?.Email ?? '').trim().toLowerCase() === email.toLowerCase());
    if (invitee && magicLinkBlocksAccount({
        userType: invitee.Type,
        roleNames: (invitee.UserRoles ?? []).map((role) => role.Role ?? ''),
        restrictedRoleName: host.restrictedRoleName,
        grantableRoleNames: host.grantableRoleNames,
        invitedRoleName: participantRole.name,
        provisioningGuard: host.provisioningGuard,
    })) {
        return {
            ok: true,
            sent: false,
            userId: accountId,
            targetApplicationId: targetApp.id,
            targetApplicationName: targetApp.name,
            message: "They are seated. This account signs in with the host's sign-in. A magic link would be refused, so none was issued.",
        };
    }
    const delivered = await deliverLink(
        { provider: input.provider, user: input.user, host },
        system,
        email,
        targetApp,
        participantRole.id,
    );
    return {
        ...delivered,
        userId: accountId,
        targetApplicationId: targetApp.id,
        targetApplicationName: targetApp.name,
    };
}

/** Semantic alias for {@link mintSpaceLink} covering both magic-link and external-IdP invite flows. */
export const inviteSpaceMember = mintSpaceLink;

/**
 * Resolves a verified user's SpaceMember seats and target MJ Application landing routes strictly from the
 * server-authenticated `UserInfo` (never trusting client-supplied user IDs or email fields).
 */
export async function resolveInvitedSeatsForUser(input: {
    provider: IMetadataProvider;
    user: UserInfo;
    defaultApplicationId?: string;
}): Promise<ResolveInvitedSeatsResult> {
    const verifiedUserId = parseUuid(input.user?.ID);
    const verifiedEmail = input.user?.Email?.trim() || null;
    if (!verifiedUserId) {
        return {
            ok: false,
            userId: null,
            email: verifiedEmail,
            seats: [],
            activeSeats: [],
            invitedSeats: [],
            removedSeats: [],
            landingApplications: [],
            lockoutMessage: lockoutMessage([]),
            message: 'Seat resolution refused: there is no signed-in user.',
        };
    }

    const rv = RunView.FromMetadataProvider(input.provider);
    const system = await trySystemUser(input.provider) ?? input.user;
    const memberResult = await rv.RunView<{
        ID: string;
        SpaceID: string;
        UserID: string;
        SpaceRoleTypeID: string;
        Status: 'Active' | 'Invited' | 'Removed';
        Band: 'Team' | 'Shared';
    }>(
        {
            EntityName: MEMBERS,
            ExtraFilter: `UserID = '${verifiedUserId}'`,
            Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Status', 'Band'],
            MaxRows: 2000, // row-cap-ok: refuses on a full page
            ResultType: 'simple',
        },
        system,
    );
    if (!memberResult.Success) {
        return {
            ok: false,
            userId: verifiedUserId,
            email: verifiedEmail,
            seats: [],
            activeSeats: [],
            invitedSeats: [],
            removedSeats: [],
            landingApplications: [],
            lockoutMessage: lockoutMessage([]),
            message: memberResult.ErrorMessage ?? 'Seat resolution failed: memberships could not be read.',
        };
    }
    const memberRows = memberResult.Results ?? [];
    if (memberRows.length >= 2000) {
        return {
            ok: false,
            userId: verifiedUserId,
            email: verifiedEmail,
            seats: [],
            activeSeats: [],
            invitedSeats: [],
            removedSeats: [],
            landingApplications: [],
            lockoutMessage: lockoutMessage([]),
            message: 'Seat resolution refused: membership page returned full.',
        };
    }
    if (memberRows.length === 0) {
        return {
            ok: true,
            userId: verifiedUserId,
            email: verifiedEmail,
            seats: [],
            activeSeats: [],
            invitedSeats: [],
            removedSeats: [],
            landingApplications: [],
            lockoutMessage: lockoutMessage([]),
        };
    }

    const spaceIds = [...new Set(memberRows.map((r) => parseUuid(r.SpaceID)).filter((id): id is string => !!id))];
    const spaceMap = new Map<string, { ID: string; Name: string; SpaceTypeID: string }>();
    if (spaceIds.length > 0) {
        const spaceFilter = `ID IN (${spaceIds.map((id) => `'${id}'`).join(', ')})`;
        const spaceResult = await rv.RunView<{ ID: string; Name: string; SpaceTypeID: string }>(
            {
                EntityName: SPACES,
                ExtraFilter: spaceFilter,
                Fields: ['ID', 'Name', 'SpaceTypeID'],
                MaxRows: 2000, // row-cap-ok: refuses on a full page
                ResultType: 'simple',
            },
            system,
        );
        if (!spaceResult.Success) {
            return {
                ok: false,
                userId: verifiedUserId,
                email: verifiedEmail,
                seats: [],
                activeSeats: [],
                invitedSeats: [],
                removedSeats: [],
                landingApplications: [],
                lockoutMessage: lockoutMessage([]),
                message: spaceResult.ErrorMessage ?? 'Seat resolution failed: spaces could not be read.',
            };
        }
        if ((spaceResult.Results?.length ?? 0) >= 2000) {
            return {
                ok: false,
                userId: verifiedUserId,
                email: verifiedEmail,
                seats: [],
                activeSeats: [],
                invitedSeats: [],
                removedSeats: [],
                landingApplications: [],
                lockoutMessage: lockoutMessage([]),
                message: 'Seat resolution refused: space page returned full.',
            };
        }
        for (const row of spaceResult.Results ?? []) {
            const id = parseUuid(row.ID);
            if (id) spaceMap.set(id.toLowerCase(), row);
        }
    }

    const typeIds = [...new Set([...spaceMap.values()].map((s) => parseUuid(s.SpaceTypeID)).filter((id): id is string => !!id))];
    const typeMap = new Map<string, { ID: string; TargetApplicationID?: string | null; TargetApplication?: string | null }>();
    if (typeIds.length > 0) {
        const typeFilter = `ID IN (${typeIds.map((id) => `'${id}'`).join(', ')})`;
        const typeResult = await rv.RunView<{ ID: string; TargetApplicationID?: string | null; TargetApplication?: string | null }>(
            {
                EntityName: SPACE_TYPES,
                ExtraFilter: typeFilter,
                Fields: ['ID', 'TargetApplicationID', 'TargetApplication'],
                MaxRows: 2000, // row-cap-ok: refuses on a full page
                ResultType: 'simple',
            },
            system,
        );
        if (typeResult.Success) {
            if ((typeResult.Results?.length ?? 0) >= 2000) {
                return {
                    ok: false,
                    userId: verifiedUserId,
                    email: verifiedEmail,
                    seats: [],
                    activeSeats: [],
                    invitedSeats: [],
                    removedSeats: [],
                    landingApplications: [],
                    lockoutMessage: lockoutMessage([]),
                    message: 'Seat resolution refused: space type page returned full.',
                };
            }
            for (const row of typeResult.Results ?? []) {
                const id = parseUuid(row.ID);
                if (id) typeMap.set(id.toLowerCase(), row);
            }
        }
    }

    const resolvedAppCache = new Map<string, ResolvedTargetApplication>();
    const seats: ResolvedInvitedSeat[] = [];
    for (const member of memberRows) {
        const spaceId = parseUuid(member.SpaceID);
        if (!spaceId) continue;
        const spaceRow = spaceMap.get(spaceId.toLowerCase());
        const spaceTypeId = parseUuid(spaceRow?.SpaceTypeID ?? '') ?? '';
        const typeRow = spaceTypeId ? typeMap.get(spaceTypeId.toLowerCase()) : undefined;
        const cacheKey = `${spaceTypeId.toLowerCase()}|${(typeRow?.TargetApplicationID ?? '').toLowerCase()}`;
        let targetApp = resolvedAppCache.get(cacheKey);
        if (!targetApp) {
            targetApp = await resolveTargetApplication(input.provider, system, {
                typeId: spaceTypeId || null,
                typeTargetApplicationId: typeRow?.TargetApplicationID ?? null,
                typeTargetApplicationName: typeRow?.TargetApplication ?? null,
                hostDefaultApplicationId: input.defaultApplicationId,
            });
            resolvedAppCache.set(cacheKey, targetApp);
        }
        const statusTrimmed = member.Status?.trim();
        const status: 'Active' | 'Invited' | 'Removed' =
            statusTrimmed === 'Invited' ? 'Invited' : statusTrimmed === 'Removed' ? 'Removed' : 'Active';
        seats.push({
            seatId: member.ID,
            spaceId,
            spaceName: spaceRow?.Name?.trim() || '',
            spaceTypeId,
            status,
            band: member.Band === 'Team' ? 'Team' : 'Shared',
            roleId: member.SpaceRoleTypeID,
            targetApplicationId: targetApp.id,
            targetApplicationName: targetApp.name,
            targetApplicationPath: targetApp.path,
        });
    }

    const activeSeats = seats.filter((s) => s.status === 'Active');
    const invitedSeats = seats.filter((s) => s.status === 'Invited');
    const removedSeats = seats.filter((s) => s.status === 'Removed');
    const landingAppsMap = new Map<string, ResolvedTargetApplication>();
    for (const s of activeSeats) {
        const key = s.targetApplicationId.toLowerCase();
        if (!landingAppsMap.has(key)) {
            landingAppsMap.set(key, {
                id: s.targetApplicationId,
                name: s.targetApplicationName,
                path: s.targetApplicationPath,
            });
        }
    }

    return {
        ok: true,
        userId: verifiedUserId,
        email: verifiedEmail,
        seats,
        activeSeats,
        invitedSeats,
        removedSeats,
        landingApplications: [...landingAppsMap.values()],
        lockoutMessage:
            activeSeats.length === 0
                ? lockoutMessage(seats.map((s) => ({ spaceName: s.spaceName, status: s.status })))
                : null,
    };
}

async function deliverIdpSignInNotification(
    input: {
        provider: IMetadataProvider;
        host: MagicLinkHost;
        system: UserInfo;
        userId: string;
        email: string;
        spaceId: string;
        spaceName: string | null;
        targetApp: ResolvedTargetApplication;
    },
): Promise<MintSpaceLinkResult> {
    const signInUrl = buildSignInUrl(input.host.publicUrl, input.targetApp.path);
    if (!signInUrl) {
        return {
            ok: true,
            sent: false,
            notificationFailed: true,
            message: 'They are seated. This host has no public URL, so a sign-in notification was not sent. Retry after configuring publicUrl.',
        };
    }

    const emailDraft = idpInviteEmail({
        from: input.host.fromAddress,
        to: input.email,
        signInUrl,
        applicationName: input.targetApp.name,
        spaceName: input.spaceName,
    });
    const notification: IdpSignInNotification = {
        userId: input.userId,
        email: input.email,
        spaceId: input.spaceId,
        spaceName: input.spaceName,
        applicationId: input.targetApp.id,
        applicationName: input.targetApp.name,
        applicationPath: input.targetApp.path,
        signInUrl,
        emailDraft,
    };

    if (input.host.sendSignInNotification) {
        try {
            const delivered = await input.host.sendSignInNotification(input.system, notification);
            if (delivered) {
                await trySendInAppInviteNotification(input.provider, input.system, notification);
                return {
                    ok: true,
                    sent: true,
                    message: `They are seated. A sign-in notification for ${input.targetApp.name} was sent to their email.`,
                };
            }
            return {
                ok: true,
                sent: false,
                notificationFailed: true,
                message: 'They are seated, but the sign-in notification could not be sent. Retry the invite to resend it.',
            };
        } catch (error) {
            LogError(`IdP sign-in notification failed for ${input.email}: ${error instanceof Error ? error.message : String(error)}`);
            return {
                ok: true,
                sent: false,
                notificationFailed: true,
                message: 'They are seated, but the sign-in notification failed to send. Retry the invite to resend it.',
            };
        }
    }

    if (input.host.communicationProvider && input.host.fromAddress && input.host.sendInviteEmail) {
        try {
            const sent = await input.host.sendInviteEmail(input.system, input.host.communicationProvider, emailDraft);
            if (sent) {
                await trySendInAppInviteNotification(input.provider, input.system, notification);
                return {
                    ok: true,
                    sent: true,
                    message: `They are seated. A sign-in notification for ${input.targetApp.name} was sent to their email.`,
                };
            }
            return {
                ok: true,
                sent: false,
                notificationFailed: true,
                message: 'They are seated, but the sign-in notification email did not send. Retry the invite to resend it.',
            };
        } catch (error) {
            LogError(`IdP sign-in notification email failed for ${input.email}: ${error instanceof Error ? error.message : String(error)}`);
            return {
                ok: true,
                sent: false,
                notificationFailed: true,
                message: 'They are seated, but the sign-in notification email failed to send. Retry the invite to resend it.',
            };
        }
    }

    const inAppSent = await trySendInAppInviteNotification(input.provider, input.system, notification);
    if (inAppSent) {
        return {
            ok: true,
            sent: true,
            message: `They are seated. An in-app sign-in notification for ${input.targetApp.name} was created; they can sign in with their organization account.`,
        };
    }

    return {
        ok: true,
        sent: false,
        message: `They are seated. This host has no email channel, so no email notification was sent. They can sign in to ${input.targetApp.name} with their organization account.`,
    };
}

async function trySendInAppInviteNotification(
    provider: IMetadataProvider,
    system: UserInfo,
    notification: IdpSignInNotification,
): Promise<boolean> {
    try {
        await NotificationEngine.Instance.Config(false, system, provider);
        const location = notification.spaceName ? `"${notification.spaceName}" in ${notification.applicationName}` : notification.applicationName;
        const result = await NotificationEngine.Instance.SendNotification(
            {
                userId: notification.userId,
                typeNameOrId: SPACE_INVITE_NOTIFICATION_TYPE,
                title: `You've been invited to ${notification.applicationName}`,
                message: `You were invited to ${location}. Sign in with your organization account at ${notification.signInUrl}.`,
                resourceTypeId: SPACE_RESOURCE,
                resourceRecordId: notification.spaceId,
                forceDeliveryChannels: { inApp: true, email: false, sms: false },
            },
            system,
        );
        return !!result?.success && !!result?.deliveryChannels?.inApp;
    } catch {
        return false;
    }
}

function buildSignInUrl(publicUrl: string, appPath: string | null): string {
    const base = (publicUrl ?? '').trim().replace(/\/$/, '');
    if (!base) return '';
    const cleanPath = (appPath ?? '').trim().replace(/^\/+|\/+$/g, '');
    return cleanPath ? `${base}/app/${cleanPath}` : base;
}

async function deliverLink(
    input: {
        provider: IMetadataProvider;
        user: UserInfo;
        host: MagicLinkHost;
    },
    system: UserInfo,
    email: string,
    targetApp: ResolvedTargetApplication,
    participantRoleId: string,
): Promise<MintSpaceLinkResult> {
    const authProvider = resolveAuthProvider(input.provider);
    const callerAuthorized = authProvider ? CollaborationEngine.Instance.UserCanIssueSpaceInviteLinks(input.user, authProvider) : false;
    const issuer = callerMayReceiveLink({
        userType: input.user.Type,
        roleNames: (input.user.UserRoles ?? []).map((role) => role.Role ?? '').filter((name) => name.length > 0),
        issuerRoleNames: input.host.inviteIssuerRoleNames,
        callerAuthorized,
    });
    const handoff = linkHandoff({ emailChannel: !!input.host.communicationProvider, callerIsIssuer: issuer });
    if (handoff === 'withhold') {
        return { ok: true, sent: false, message: 'They are seated. This host has no email channel, so a sign-in link is not returned. They use the host sign-in, or an Owner sends one.' };
    }
    const base = input.host.publicUrl.replace(/\/$/, '');
    if (!base) return { ok: true, sent: false, message: 'They are seated. This host has no public URL, so a sign-in link was not created.' };
    const rawToken = `mj_ml_${randomBytes(32).toString('hex')}`;
    const invite = await input.provider.GetEntityObject<MJMagicLinkInviteEntity>(INVITES, system);
    invite.NewRecord();
    invite.TokenHash = createHash('sha256').update(rawToken).digest('base64url');
    invite.Email = email;
    invite.ApplicationID = targetApp.id;
    invite.RoleID = participantRoleId;
    invite.ExpiresAt = new Date(Date.now() + input.host.defaultExpiresInHours * 3600 * 1000);
    invite.MaxUses = 1;
    invite.UseCount = 0;
    invite.CreatedByUserID = input.user.ID;
    invite.Status = 'Active';
    invite.IdentityMode = 'email';
    invite.Kind = 'app-session';
    if (!(await invite.Save())) return { ok: true, sent: false, linkFailed: true, message: 'The seat was saved. The sign-in link could not be saved.' };
    await writeChildRows(input.provider, system, invite.ID, targetApp.id, participantRoleId);
    const redemptionUrl = `${base}/magic-link/redeem?token=${encodeURIComponent(rawToken)}`;
    if (handoff === 'email') {
        const draft = inviteEmail({
            from: input.host.fromAddress,
            to: email,
            url: redemptionUrl,
            applicationName: targetApp.name,
        });
        const sent =
            input.host.fromAddress && input.host.sendInviteEmail
                ? await input.host.sendInviteEmail(system, input.host.communicationProvider ?? '', draft)
                : false;
        if (sent) return { ok: true, sent: true, message: 'They are seated. The sign-in link was sent to their email.' };
        if (issuer) return { ok: true, sent: false, redemptionUrl, message: 'They are seated. The email did not send.' };
        return { ok: true, sent: false, message: 'They are seated. The email did not send, and the link was not returned.' };
    }
    return { ok: true, sent: false, redemptionUrl, message: 'They are seated. This host has no email channel, so the sign-in link is here.' };
}

async function resolveParticipantRole(provider: IMetadataProvider, system: UserInfo): Promise<ResolvedParticipantRole> {
    const candidates = provider.Roles ?? [];
    const matched =
        candidates.find((role) => role.ID?.toLowerCase() === DEFAULT_PARTICIPANT_ROLE_ID.toLowerCase()) ??
        candidates.find((role) => (role.Name ?? '').trim().toLowerCase() === DEFAULT_PARTICIPANT_ROLE_NAME.toLowerCase());
    if (matched?.ID) {
        return {
            id: matched.ID,
            name: matched.Name?.trim() || DEFAULT_PARTICIPANT_ROLE_NAME,
        };
    }

    try {
        const view = RunView.FromMetadataProvider(provider);
        const rows = await view.RunView<{ ID: string; Name: string }>(
            {
                EntityName: ROLES,
                ExtraFilter: `ID = '${DEFAULT_PARTICIPANT_ROLE_ID}' OR Name = '${DEFAULT_PARTICIPANT_ROLE_NAME}'`,
                Fields: ['ID', 'Name'],
                MaxRows: 2, // row-cap-ok: bounded role lookup by ID or unique name
                ResultType: 'simple',
            },
            system,
        );
        if (rows.Success && rows.Results?.length) {
            const byId = rows.Results.find((r) => r.ID?.toLowerCase() === DEFAULT_PARTICIPANT_ROLE_ID.toLowerCase());
            const byName = rows.Results.find((r) => (r.Name ?? '').trim().toLowerCase() === DEFAULT_PARTICIPANT_ROLE_NAME.toLowerCase());
            const chosen = byId ?? byName ?? rows.Results[0];
            if (chosen?.ID && parseUuid(chosen.ID)) {
                return {
                    id: chosen.ID,
                    name: chosen.Name?.trim() || DEFAULT_PARTICIPANT_ROLE_NAME,
                };
            }
        }
    } catch {
        // Mock providers that do not seed MJ: Roles fall back to the canonical Space Participant ID
    }

    return {
        id: DEFAULT_PARTICIPANT_ROLE_ID,
        name: DEFAULT_PARTICIPANT_ROLE_NAME,
    };
}

async function resolveTargetApplication(
    provider: IMetadataProvider,
    system: UserInfo,
    params: {
        typeId?: string | null;
        typeTargetApplicationId?: string | null;
        typeTargetApplicationName?: string | null;
        hostDefaultApplicationId?: string | null;
    },
): Promise<ResolvedTargetApplication> {
    let typeTargetId = parseUuid(params.typeTargetApplicationId ?? '');
    let typeTargetName = params.typeTargetApplicationName?.trim() || '';

    // When SpaceType target was not supplied by the caller, query SpaceType exclusively from the supplied provider.
    if (params.typeTargetApplicationId === undefined && params.typeId && parseUuid(params.typeId)) {
        try {
            const view = RunView.FromMetadataProvider(provider);
            const typeRows = await view.RunView<{ ID: string; TargetApplicationID?: string | null; TargetApplication?: string | null }>(
                {
                    EntityName: SPACE_TYPES,
                    ExtraFilter: `ID = '${parseUuid(params.typeId)}'`,
                    Fields: ['ID', 'TargetApplicationID', 'TargetApplication'],
                    MaxRows: 1,
                    ResultType: 'simple',
                },
                system,
            );
            if (typeRows.Success && typeRows.Results?.length) {
                const typeRow =
                    typeRows.Results.find((r) => r.ID?.toLowerCase() === params.typeId!.toLowerCase()) ??
                    typeRows.Results[0];
                typeTargetId = parseUuid(typeRow?.TargetApplicationID ?? '');
                if (!typeTargetName && typeRow?.TargetApplication?.trim()) {
                    typeTargetName = typeRow.TargetApplication.trim();
                }
            }
        } catch {
            // Mock providers without MJ_BizApps_Collaboration: Space Types fall back gracefully below
        }
    }

    const hostDefaultId = parseUuid(params.hostDefaultApplicationId ?? '');
    const knownApps = provider.Applications ?? [];
    let collabApp: { ID?: string; Name?: string | null; Path?: string | null } | undefined =
        knownApps.find((app) => app.ID?.toLowerCase() === COLLABORATION_APP_ID.toLowerCase()) ??
        knownApps.find((app) => (app.Name ?? '').trim().toLowerCase() === 'collaboration');

    let loadedAppRows: Array<{ ID: string; Name?: string | null; Path?: string | null }> | null = null;
    if (!typeTargetId && !hostDefaultId && !collabApp) {
        try {
            const view = RunView.FromMetadataProvider(provider);
            const rows = await view.RunView<{ ID: string; Name?: string | null; Path?: string | null }>(
                {
                    EntityName: APPLICATIONS,
                    ExtraFilter: `ID = '${COLLABORATION_APP_ID}' OR Name = 'Collaboration'`,
                    Fields: ['ID', 'Name', 'Path'],
                    MaxRows: 2, // row-cap-ok: bounded lookup for Collaboration app by ID or unique name
                    ResultType: 'simple',
                },
                system,
            );
            if (rows.Success && rows.Results?.length) {
                loadedAppRows = rows.Results;
                const matchedCollab =
                    rows.Results.find((r) => r.ID?.toLowerCase() === COLLABORATION_APP_ID.toLowerCase()) ??
                    rows.Results.find((r) => (r.Name ?? '').trim().toLowerCase() === 'collaboration');
                if (matchedCollab?.ID && parseUuid(matchedCollab.ID)) {
                    collabApp = matchedCollab;
                }
            }
        } catch {
            // Mock providers without MJ: Applications fall back gracefully below
        }
    }

    const fallbackAppId = hostDefaultId ?? (collabApp?.ID ? parseUuid(collabApp.ID) : null) ?? COLLABORATION_APP_ID;
    const appId = resolveTargetApplicationId(typeTargetId, fallbackAppId);
    const matchedApp =
        knownApps.find((app) => app.ID?.toLowerCase() === appId.toLowerCase()) ??
        (collabApp && collabApp.ID?.toLowerCase() === appId.toLowerCase() ? collabApp : undefined);

    let appName = (typeTargetId && typeTargetName) || matchedApp?.Name?.trim() || '';
    let appPath: string | null = matchedApp?.Path?.trim() || null;

    if (!appName || appPath === null) {
        try {
            let candidateRows = loadedAppRows;
            if (!candidateRows) {
                const view = RunView.FromMetadataProvider(provider);
                const rows = await view.RunView<{ ID: string; Name?: string | null; Path?: string | null }>(
                    {
                        EntityName: APPLICATIONS,
                        ExtraFilter: `ID = '${appId}'`,
                        Fields: ['ID', 'Name', 'Path'],
                        MaxRows: 1,
                        ResultType: 'simple',
                    },
                    system,
                );
                candidateRows = rows.Success ? rows.Results ?? [] : [];
            }
            if (candidateRows.length > 0) {
                const row = candidateRows.find((r) => r.ID?.toLowerCase() === appId.toLowerCase()) ?? candidateRows[0];
                if (row) {
                    if (!appName && row.Name?.trim()) appName = row.Name.trim();
                    if (appPath === null && row.Path?.trim()) appPath = row.Path.trim();
                }
            }
        } catch {
            // Mock providers without MJ: Applications fall back gracefully below
        }
    }

    if (!appName) {
        appName = appId.toLowerCase() === COLLABORATION_APP_ID.toLowerCase() ? 'Collaboration' : 'the application';
    }

    return { id: appId, name: appName, path: appPath };
}

async function requireSystemUserForInvite(provider: IMetadataProvider, space: BaseEntity | null): Promise<UserInfo> {
    const resolved = asMetadata(provider);
    if (resolved) {
        const system = await WellKnownUserSource.Instance.GetSystemUser(resolved);
        if (system) return system;
    }
    if (space) {
        return requireSystemUser(space);
    }
    throw new Error('Refusing the write: the system user is not available, so the roster cannot be counted.');
}

async function trySystemUser(provider: IMetadataProvider): Promise<UserInfo | null> {
    const resolved = asMetadata(provider);
    if (!resolved) return null;
    try {
        return await WellKnownUserSource.Instance.GetSystemUser(resolved);
    } catch {
        return null;
    }
}

function roleGrantable(roleName: string, restrictedRoleName: string, grantable: readonly string[]): boolean {
    const target = roleName.trim().toLowerCase();
    const allowed = new Set([restrictedRoleName.trim().toLowerCase(), ...grantable.map((name) => name.trim().toLowerCase())]);
    return !!target && allowed.has(target);
}

async function refreshUsers(provider: IMetadataProvider): Promise<void> {
    try {
        await UserCache.Instance.Refresh(provider as Parameters<UserCache['Refresh']>[0]);
    } catch (error) {
        LogError(error);
    }
}

async function findUserId(provider: IMetadataProvider, email: string, user: UserInfo): Promise<{ ok: true; id: string | null } | { ok: false; message: string }> {
    const view = RunView.FromMetadataProvider(provider);
    const normalizedEmail = email.trim().toLowerCase().replace(/'/g, "''");
    const rows = await view.RunView<{ ID: string }>({
        EntityName: USERS,
        ExtraFilter: `LOWER(Email) = '${normalizedEmail}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, user);
    if (!rows.Success) return { ok: false, message: 'Invite refused: the account could not be read.' };
    return { ok: true, id: rows.Results?.[0]?.ID ?? null };
}

async function findSeat(provider: IMetadataProvider, spaceId: string, userId: string, user: UserInfo): Promise<{ ok: true; id: string | null; status: string | null } | { ok: false; message: string }> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string; Status: string }>({
        EntityName: MEMBERS,
        ExtraFilter: `SpaceID = '${spaceId}' AND UserID = '${userId}'`,
        Fields: ['ID', 'Status'],
        MaxRows: 1,
        ResultType: 'simple',
    }, user);
    if (!rows.Success) return { ok: false, message: 'Invite refused: the roster could not be read.' };
    const row = rows.Results?.[0];
    return { ok: true, id: row?.ID ?? null, status: row?.Status?.trim() ?? null };
}

async function writeSeat(
    input: { provider: IMetadataProvider; user: UserInfo; spaceId: string; roleId: string; syncSource?: string | null; personId?: string | null },
    accountId: string,
    band: 'Team' | 'Shared',
    decided: 'Invited' | 'Active',
    existingId: string | null,
): Promise<{ ok: true; status: string } | { ok: false; message: string }> {
    const member = await input.provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(MEMBERS, input.user);
    if (existingId) {
        if (!(await member.Load(existingId))) return { ok: false, message: 'Invite refused: the removed seat could not be read.' };
        member.SpaceRoleTypeID = input.roleId;
        member.Status = decided;
        member.Band = band;
    } else {
        member.NewRecord();
        member.SpaceID = input.spaceId;
        member.UserID = accountId;
        member.SpaceRoleTypeID = input.roleId;
        member.Status = decided;
        member.Band = band;
    }
    if (input.syncSource !== undefined) {
        member.SyncSource = input.syncSource;
    }
    if (input.personId) {
        member.PersonID = input.personId;
    }
    if (!(await member.Save())) {
        return { ok: false, message: member.LatestResult?.CompleteMessage ?? 'Invite refused: the seat could not be saved.' };
    }
    return { ok: true, status: member.Status.trim() };
}

/** Grants after the seat exists. Returns a message when the grant fails. */
async function grantAfterSeat(
    provider: IMetadataProvider,
    system: UserInfo,
    accountId: string,
    participantRoleId: string,
    targetApplicationId: string,
): Promise<string | null> {
    const access = await ensureAccess(provider, system, accountId, participantRoleId, targetApplicationId);
    await refreshUsers(provider);
    if (access.ok === false) return `The seat was saved. ${access.message}`;
    return null;
}

async function createAccount(
    provider: IMetadataProvider,
    system: UserInfo,
    email: string,
    participantRoleId: string,
    targetApplicationId: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
    const db = provider as SqlProvider;
    if (db.BeginTransaction) await db.BeginTransaction();
    try {
        const account = await provider.GetEntityObject<MJUserEntity>(USERS, system);
        account.NewRecord();
        account.Name = email;
        account.Email = email;
        account.FirstName = 'Guest';
        account.LastName = email;
        account.Type = 'User';
        account.IsActive = true;
        if (!(await account.Save())) throw new Error(account.LatestResult?.CompleteMessage ?? 'The account could not be created.');
        const role = await provider.GetEntityObject<MJUserRoleEntity>(USER_ROLES, system);
        role.NewRecord();
        role.UserID = account.ID;
        role.RoleID = participantRoleId;
        if (!(await role.Save())) throw new Error(role.LatestResult?.CompleteMessage ?? 'Space Participant could not be granted.');
        const app = await provider.GetEntityObject<MJUserApplicationEntity>(USER_APPS, system);
        app.NewRecord();
        app.UserID = account.ID;
        app.ApplicationID = targetApplicationId;
        app.Sequence = 0;
        app.IsActive = true;
        if (!(await app.Save())) throw new Error(app.LatestResult?.CompleteMessage ?? 'The application could not be granted.');
        if (db.CommitTransaction) await db.CommitTransaction();
        return { ok: true, id: account.ID };
    } catch (error) {
        if (db.RollbackTransaction) await db.RollbackTransaction();
        LogError(error);
        return { ok: false, message: 'Invite refused: the account could not be created.' };
    }
}

function resolveAuthProvider(provider: IMetadataProvider): IMetadataProvider | undefined {
    return provider.Authorizations !== undefined ? provider : undefined;
}

async function ensureAccess(
    provider: IMetadataProvider,
    system: UserInfo,
    userId: string,
    participantRoleId: string,
    targetApplicationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
    const view = RunView.FromMetadataProvider(provider);
    const links = await view.RunView<{ RoleID: string }>({
        EntityName: USER_ROLES,
        ExtraFilter: `UserID = '${userId}'`,
        Fields: ['RoleID'],
        MaxRows: 2000, // row-cap-ok: user roles per single user bounded well below 2000
        ResultType: 'simple',
    }, system);
    if (!links.Success) return { ok: false, message: 'Invite refused: the account roles could not be read.' };
    const roleIds = (links.Results ?? []).map((row) => row.RoleID).filter((id) => UUID.test(id));
    const hasParticipant = roleIds.some((id) => id.toLowerCase() === participantRoleId.toLowerCase());
    if (!hasParticipant) {
        const authProvider = resolveAuthProvider(provider);
        const hasStaffAuthorization = authProvider
            ? CollaborationEngine.Instance.UserHasStaffAuthorization(
                  new UserInfo(authProvider, {
                      ID: userId,
                      UserRoles: roleIds.map((roleId) => ({ UserID: userId, RoleID: roleId })),
                  }),
                  authProvider,
              )
            : false;
        if (!hasStaffAuthorization) {
            const role = await provider.GetEntityObject<MJUserRoleEntity>(USER_ROLES, system);
            role.NewRecord();
            role.UserID = userId;
            role.RoleID = participantRoleId;
            if (!(await role.Save())) return { ok: false, message: 'The account exists. Space Participant could not be granted.' };
        }
    }
    const apps = await view.RunView<{ ID: string }>({
        EntityName: USER_APPS,
        ExtraFilter: `UserID = '${userId}' AND ApplicationID = '${targetApplicationId}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!apps.Success) return { ok: false, message: 'Invite refused: the application grant could not be read.' };
    if (!apps.Results?.length) {
        const app = await provider.GetEntityObject<MJUserApplicationEntity>(USER_APPS, system);
        app.NewRecord();
        app.UserID = userId;
        app.ApplicationID = targetApplicationId;
        app.Sequence = 0;
        app.IsActive = true;
        if (!(await app.Save())) return { ok: false, message: 'The account exists. The application could not be granted.' };
    }
    return { ok: true };
}

async function deleteNewAccount(provider: IMetadataProvider, system: UserInfo, userId: string): Promise<void> {
    const view = RunView.FromMetadataProvider(provider);
    const roles = await view.RunView<{ ID: string }>({
        EntityName: USER_ROLES,
        ExtraFilter: `UserID = '${userId}'`,
        Fields: ['ID'],
        MaxRows: 2000, // row-cap-ok: cleanup for single newly-created user
        ResultType: 'simple',
    }, system);
    for (const row of roles.Results ?? []) {
        const role = await provider.GetEntityObject<MJUserRoleEntity>(USER_ROLES, system);
        if ((await role.Load(row.ID)) && !(await role.Delete())) LogError(`Could not delete role grant ${row.ID}.`);
    }
    const apps = await view.RunView<{ ID: string }>({
        EntityName: USER_APPS,
        ExtraFilter: `UserID = '${userId}'`,
        Fields: ['ID'],
        MaxRows: 2000, // row-cap-ok: cleanup for single newly-created user
        ResultType: 'simple',
    }, system);
    for (const row of apps.Results ?? []) {
        const app = await provider.GetEntityObject<MJUserApplicationEntity>(USER_APPS, system);
        if ((await app.Load(row.ID)) && !(await app.Delete())) LogError(`Could not delete application grant ${row.ID}.`);
    }
    const account = await provider.GetEntityObject<MJUserEntity>(USERS, system);
    if ((await account.Load(userId)) && !(await account.Delete())) LogError(`Could not delete the new account ${userId}.`);
}

/**
 * Gives the account a Person when it has none. Writes both `People.LinkedUserID` (the active 1:1
 * security-principal bridge restored in `bizapps-common#349`) and, when the account is not already
 * linked to a record outside People, the user's own People link (`LinkedRecordType = 'Person'`,
 * `LinkedEntityID` = People, `LinkedEntityRecordID` = the Person).
 */
async function ensurePerson(provider: IMetadataProvider, system: UserInfo, userId: string, email: string, existingPersonId?: string | null): Promise<void> {
    const people = typeof provider.EntityByName === 'function'
        ? provider.EntityByName(PEOPLE)
        : provider.Entities?.find((e) => e.Name === PEOPLE);
    if (!people) return;
    const account = await provider.GetEntityObject<MJUserEntity>(USERS, system);
    if (!account || typeof account.Load !== 'function') return;
    if (!(await account.Load(userId))) throw new Error('The account could not be read.');
    if (await ResolvePersonIDForUser(account, provider, system)) return;
    const linkedElsewhere = !!account.LinkedEntityID && !IsPeopleEntity(
        typeof provider.EntityByID === 'function'
            ? provider.EntityByID(account.LinkedEntityID)
            : provider.Entities?.find((e) => e.ID === account.LinkedEntityID)
    );
    const person = await provider.GetEntityObject<mjBizAppsCommonPersonEntity>(PEOPLE, system);
    if (!person) return;
    let loadedExisting = false;
    if (existingPersonId && typeof person.Load === 'function' && (await person.Load(existingPersonId))) {
        loadedExisting = true;
        person.LinkedUserID = userId;
        if (!person.Email) person.Email = email;
        if (!(await person.Save())) throw new Error(person.LatestResult?.CompleteMessage ?? 'Person save failed.');
    } else {
        const parts = (account.Name || email).trim().split(/\s+/);
        person.NewRecord();
        person.FirstName = parts[0] || 'Member';
        person.LastName = parts.slice(1).join(' ') || 'Member';
        person.Email = email;
        person.LinkedUserID = userId;
        if (!(await person.Save())) throw new Error(person.LatestResult?.CompleteMessage ?? 'Person save failed.');
    }
    if (linkedElsewhere) return;
    account.LinkedRecordType = 'Person';
    account.LinkedEntityID = people.ID;
    account.LinkedEntityRecordID = person.ID;
    if (!(await account.Save())) {
        const message = account.LatestResult?.CompleteMessage ?? 'The account could not be linked to its person record.';
        if (!loadedExisting && typeof person.Delete === 'function' && !(await person.Delete())) {
            LogError(`Could not delete the unlinked person record ${person.ID}.`);
        }
        throw new Error(message);
    }
    await refreshUsers(provider);
}

async function writeChildRows(
    provider: IMetadataProvider,
    system: UserInfo,
    inviteId: string,
    targetApplicationId: string,
    participantRoleId: string,
): Promise<void> {
    const app = await provider.GetEntityObject<MJMagicLinkInviteApplicationEntity>('MJ: Magic Link Invite Applications', system);
    if (app && typeof app.NewRecord === 'function' && typeof app.Save === 'function') {
        app.NewRecord();
        app.InviteID = inviteId;
        app.ApplicationID = targetApplicationId;
        if (!(await app.Save())) LogError(app.LatestResult?.CompleteMessage ?? 'Invite application row was not saved.');
    }
    const role = await provider.GetEntityObject<MJMagicLinkInviteRoleEntity>('MJ: Magic Link Invite Roles', system);
    if (role && typeof role.NewRecord === 'function' && typeof role.Save === 'function') {
        role.NewRecord();
        role.InviteID = inviteId;
        role.RoleID = participantRoleId;
        if (!(await role.Save())) LogError(role.LatestResult?.CompleteMessage ?? 'Invite role row was not saved.');
    }
}
