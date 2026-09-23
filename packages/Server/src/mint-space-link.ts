/**
 * An email invitation is a seat, saved through the member gate.
 *
 * The sign-in link only proves who the person is. It is an app session, not a
 * resource share, so access ends when the seat is removed. The raw URL is
 * emailed to that address, or returned to a host issuer. A space owner who is
 * neither does not receive it. A seat that is still Invited does not get a link.
 */
import { createHash, randomBytes } from 'node:crypto';
import { LogError, Metadata, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import '@memberjunction/core-entities';
import {
    MJMagicLinkInviteApplicationEntity,
    MJMagicLinkInviteEntity,
    MJMagicLinkInviteRoleEntity,
    MJUserApplicationEntity,
    MJUserEntity,
    MJUserRoleEntity,
} from '@memberjunction/core-entities';
import { CommunicationEngine } from '@memberjunction/communication-engine';
import { Message } from '@memberjunction/communication-types';
import { UserCache } from '@memberjunction/generic-database-provider';
import '@mj-biz-apps/common-entities';
import { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';
import { callerMayReceiveLink, handInviteToEngine, inviteEmail, linkHandoff, refuseInvite } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { loadWriteContext, requireSystemUser } from '@mj-biz-apps/collaboration-core-entities-server';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const INVITES = 'MJ: Magic Link Invites';
const USERS = 'MJ: Users';
const USER_ROLES = 'MJ: User Roles';
const USER_APPS = 'MJ: User Applications';
const ROLES = 'MJ: Roles';
const PEOPLE = 'MJ_BizApps_Common: People';
const APPLICATION_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';
const PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
const PLACEHOLDER_USER = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
const STAFF = new Set(['ui', 'developer', 'integration']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MagicLinkHost {
    enabled: boolean;
    publicUrl: string;
    restrictedRoleName: string;
    grantableRoleNames: readonly string[];
    inviteIssuerRoleNames: readonly string[];
    communicationProvider?: string;
    fromAddress: string;
    defaultExpiresInHours: number;
}

export interface MintSpaceLinkResult {
    ok: boolean;
    sent?: boolean;
    redemptionUrl?: string;
    message?: string;
}

type SqlProvider = IMetadataProvider & {
    BeginTransaction?: () => Promise<void>;
    CommitTransaction?: () => Promise<void>;
    RollbackTransaction?: () => Promise<void>;
};

export async function mintSpaceLink(input: {
    provider: IMetadataProvider;
    user: UserInfo;
    spaceId: string;
    email: string;
    roleId: string;
    host: MagicLinkHost;
}): Promise<MintSpaceLinkResult> {
    const email = input.email.trim();
    if (!email.includes('@') || /\s/.test(email)) return { ok: false, message: 'Invite refused: enter an email address.' };
    if (!UUID.test(input.spaceId) || !UUID.test(input.roleId)) return { ok: false, message: 'Invite refused: the space and role must be real ids.' };
    if (!input.host.enabled) return { ok: false, message: 'Invite refused: magic links are turned off on this host.' };
    const metadata = new Metadata();
    const participant = metadata.Roles?.find((role) => role.ID.toLowerCase() === PARTICIPANT_ROLE_ID.toLowerCase());
    const participantName = participant?.Name ?? 'Space Participant';
    if (!roleGrantable(participantName, input.host.restrictedRoleName, input.host.grantableRoleNames)) {
        return { ok: false, message: 'Invite refused: this host has not opted in to granting Space Participant. Add it to magicLink.grantableRoleNames.' };
    }

    const space = await input.provider.GetEntityObject(SPACES, input.user);
    let context;
    try {
        context = await loadWriteContext(space, input.user, input.spaceId, input.roleId);
    } catch (error) {
        LogError(error);
        return { ok: false, message: 'Invite refused: the roster could not be read.' };
    }
    const granted = context.role;
    if (!granted) return { ok: false, message: 'Invite refused: that role is not on this host.' };
    const system = await requireSystemUser(space);
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

    let accountId = existingId;
    let createdUser = false;
    if (!accountId) {
        const created = await createAccount(input.provider, system, email);
        if (created.ok === false) return { ok: false, message: created.message };
        accountId = created.id;
        createdUser = true;
    }
    const access = await ensureAccess(input.provider, system, accountId);
    if (access.ok === false) {
        if (createdUser) await deleteNewAccount(input.provider, system, accountId);
        await refreshUsers(input.provider);
        return { ok: false, message: access.message };
    }
    await refreshUsers(input.provider);

    const seated = await findSeat(input.provider, input.spaceId, accountId, system);
    if (seated.ok === false) {
        if (createdUser) await deleteNewAccount(input.provider, system, accountId);
        await refreshUsers(input.provider);
        return { ok: false, message: seated.message };
    }
    const existingSeat = seated.status;
    let status = existingSeat;
    if (!status) {
        const member = await input.provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(MEMBERS, input.user);
        member.NewRecord();
        member.SpaceID = input.spaceId;
        member.UserID = accountId;
        member.SpaceRoleTypeID = input.roleId;
        member.Status = 'Active';
        member.Band = granted.canSeeTeamBand ? 'Team' : 'Shared';
        if (!(await member.Save())) {
            if (createdUser) await deleteNewAccount(input.provider, system, accountId);
            await refreshUsers(input.provider);
            return { ok: false, message: member.LatestResult?.CompleteMessage ?? 'Invite refused: the seat could not be saved.' };
        }
        status = member.Status.trim();
    }
    if (status !== preview.status && !existingSeat) {
        return { ok: true, sent: false, message: `The seat was saved as ${status}. The gate had decided ${preview.status}.` };
    }
    try {
        await ensurePerson(input.provider, system, accountId, email);
    } catch (error) {
        LogError(error);
        return { ok: true, sent: false, message: 'The seat was saved. The person record was not.' };
    }
    if (status === 'Invited') {
        return { ok: true, sent: false, message: 'They are seated as Invited. The sign-in link waits until an owner approves them. The owner can send it again after that.' };
    }
    return deliverLink(input, system, email);
}

async function deliverLink(input: {
    provider: IMetadataProvider;
    user: UserInfo;
    host: MagicLinkHost;
}, system: UserInfo, email: string): Promise<MintSpaceLinkResult> {
    const issuer = callerMayReceiveLink({
        userType: input.user.Type,
        roleNames: (input.user.UserRoles ?? []).map((role) => role.Role ?? '').filter((name) => name.length > 0),
        issuerRoleNames: input.host.inviteIssuerRoleNames,
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
    invite.ApplicationID = APPLICATION_ID;
    invite.RoleID = PARTICIPANT_ROLE_ID;
    invite.ExpiresAt = new Date(Date.now() + input.host.defaultExpiresInHours * 3600 * 1000);
    invite.MaxUses = 1;
    invite.UseCount = 0;
    invite.CreatedByUserID = input.user.ID;
    invite.Status = 'Active';
    invite.IdentityMode = 'email';
    invite.Kind = 'app-session';
    if (!(await invite.Save())) return { ok: true, sent: false, message: 'The seat was saved. The sign-in link could not be saved.' };
    await writeChildRows(input.provider, system, invite.ID);
    const redemptionUrl = `${base}/magic-link/redeem?token=${encodeURIComponent(rawToken)}`;
    if (handoff === 'email') {
        const draft = inviteEmail({ from: input.host.fromAddress, to: email, url: redemptionUrl });
        const sent = input.host.fromAddress ? await handInviteToEngine({
            SendSingleMessage: async (providerName, type, message) => {
                const engine = CommunicationEngine.Instance;
                await engine.Config(false, system);
                const mail = new Message();
                mail.From = message.from;
                mail.To = message.to;
                mail.Subject = message.subject;
                mail.Body = message.body;
                return engine.SendSingleMessage(providerName, type, mail);
            },
        }, input.host.communicationProvider ?? '', draft) : false;
        if (sent) return { ok: true, sent: true, message: 'They are seated. The sign-in link was sent to their email.' };
        if (issuer) return { ok: true, sent: false, redemptionUrl, message: 'They are seated. The email did not send.' };
        return { ok: true, sent: false, message: 'They are seated. The email did not send, and the link was not returned.' };
    }
    return { ok: true, sent: false, redemptionUrl, message: 'They are seated. This host has no email channel, so the sign-in link is here.' };
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
    const rows = await view.RunView<{ ID: string }>({
        EntityName: USERS,
        ExtraFilter: `Email = '${email.replace(/'/g, "''")}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, user);
    if (!rows.Success) return { ok: false, message: 'Invite refused: the account could not be read.' };
    return { ok: true, id: rows.Results?.[0]?.ID ?? null };
}

async function findSeat(provider: IMetadataProvider, spaceId: string, userId: string, user: UserInfo): Promise<{ ok: true; status: string | null } | { ok: false; message: string }> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ Status: string }>({
        EntityName: MEMBERS,
        ExtraFilter: `SpaceID = '${spaceId}' AND UserID = '${userId}'`,
        Fields: ['Status'],
        MaxRows: 1,
        ResultType: 'simple',
    }, user);
    if (!rows.Success) return { ok: false, message: 'Invite refused: the roster could not be read.' };
    return { ok: true, status: rows.Results?.[0]?.Status?.trim() ?? null };
}

async function createAccount(provider: IMetadataProvider, system: UserInfo, email: string): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
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
        role.RoleID = PARTICIPANT_ROLE_ID;
        if (!(await role.Save())) throw new Error(role.LatestResult?.CompleteMessage ?? 'Space Participant could not be granted.');
        const app = await provider.GetEntityObject<MJUserApplicationEntity>(USER_APPS, system);
        app.NewRecord();
        app.UserID = account.ID;
        app.ApplicationID = APPLICATION_ID;
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

async function ensureAccess(provider: IMetadataProvider, system: UserInfo, userId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const view = RunView.FromMetadataProvider(provider);
    const links = await view.RunView<{ RoleID: string }>({
        EntityName: USER_ROLES,
        ExtraFilter: `UserID = '${userId}'`,
        Fields: ['RoleID'],
        ResultType: 'simple',
    }, system);
    if (!links.Success) return { ok: false, message: 'Invite refused: the account roles could not be read.' };
    const roleIds = (links.Results ?? []).map((row) => row.RoleID).filter((id) => UUID.test(id));
    const names = roleIds.length ? await view.RunView<{ Name: string }>({
        EntityName: ROLES,
        ExtraFilter: `ID IN (${roleIds.map((id) => `'${id}'`).join(',')})`,
        Fields: ['Name'],
        ResultType: 'simple',
    }, system) : { Success: true, Results: [] as { Name: string }[] };
    if (!names.Success) return { ok: false, message: 'Invite refused: the account roles could not be read.' };
    const staff = (names.Results ?? []).some((row) => STAFF.has(row.Name.trim().toLowerCase()));
    const hasParticipant = roleIds.some((id) => id.toLowerCase() === PARTICIPANT_ROLE_ID.toLowerCase());
    if (!hasParticipant && !staff) {
        const role = await provider.GetEntityObject<MJUserRoleEntity>(USER_ROLES, system);
        role.NewRecord();
        role.UserID = userId;
        role.RoleID = PARTICIPANT_ROLE_ID;
        if (!(await role.Save())) return { ok: false, message: 'The account exists. Space Participant could not be granted.' };
    }
    const apps = await view.RunView<{ ID: string }>({
        EntityName: USER_APPS,
        ExtraFilter: `UserID = '${userId}' AND ApplicationID = '${APPLICATION_ID}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!apps.Success) return { ok: false, message: 'Invite refused: the application grant could not be read.' };
    if (!apps.Results?.length) {
        const app = await provider.GetEntityObject<MJUserApplicationEntity>(USER_APPS, system);
        app.NewRecord();
        app.UserID = userId;
        app.ApplicationID = APPLICATION_ID;
        app.Sequence = 0;
        app.IsActive = true;
        if (!(await app.Save())) return { ok: false, message: 'The account exists. The application could not be granted.' };
    }
    return { ok: true };
}

async function deleteNewAccount(provider: IMetadataProvider, system: UserInfo, userId: string): Promise<void> {
    const view = RunView.FromMetadataProvider(provider);
    const roles = await view.RunView<{ ID: string }>({ EntityName: USER_ROLES, ExtraFilter: `UserID = '${userId}'`, Fields: ['ID'], ResultType: 'simple' }, system);
    for (const row of roles.Results ?? []) {
        const role = await provider.GetEntityObject<MJUserRoleEntity>(USER_ROLES, system);
        if ((await role.Load(row.ID)) && !(await role.Delete())) LogError(`Could not delete role grant ${row.ID}.`);
    }
    const apps = await view.RunView<{ ID: string }>({ EntityName: USER_APPS, ExtraFilter: `UserID = '${userId}'`, Fields: ['ID'], ResultType: 'simple' }, system);
    for (const row of apps.Results ?? []) {
        const app = await provider.GetEntityObject<MJUserApplicationEntity>(USER_APPS, system);
        if ((await app.Load(row.ID)) && !(await app.Delete())) LogError(`Could not delete application grant ${row.ID}.`);
    }
    const account = await provider.GetEntityObject<MJUserEntity>(USERS, system);
    if ((await account.Load(userId)) && !(await account.Delete())) LogError(`Could not delete the new account ${userId}.`);
}

async function ensurePerson(provider: IMetadataProvider, system: UserInfo, userId: string, email: string): Promise<void> {
    if (!new Metadata().EntityByName(PEOPLE)) return;
    const view = RunView.FromMetadataProvider(provider);
    const existing = await view.RunView<{ ID: string }>({
        EntityName: PEOPLE,
        ExtraFilter: `LinkedUserID = '${userId}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!existing.Success) throw new Error(existing.ErrorMessage ?? 'The person record could not be read.');
    if (existing.Results?.length) return;
    const account = await provider.GetEntityObject<MJUserEntity>(USERS, system);
    const name = (await account.Load(userId)) ? account.Name : email;
    const parts = (name || email).trim().split(/\s+/);
    const person = await provider.GetEntityObject<mjBizAppsCommonPersonEntity>(PEOPLE, system);
    person.NewRecord();
    person.FirstName = parts[0] || 'Member';
    person.LastName = parts.slice(1).join(' ') || 'Member';
    person.Email = email;
    person.LinkedUserID = userId;
    if (!(await person.Save())) throw new Error(person.LatestResult?.CompleteMessage ?? 'Person save failed.');
}

async function writeChildRows(provider: IMetadataProvider, system: UserInfo, inviteId: string): Promise<void> {
    const app = await provider.GetEntityObject<MJMagicLinkInviteApplicationEntity>('MJ: Magic Link Invite Applications', system);
    app.NewRecord();
    app.InviteID = inviteId;
    app.ApplicationID = APPLICATION_ID;
    if (!(await app.Save())) LogError(app.LatestResult?.CompleteMessage ?? 'Invite application row was not saved.');
    const role = await provider.GetEntityObject<MJMagicLinkInviteRoleEntity>('MJ: Magic Link Invite Roles', system);
    role.NewRecord();
    role.InviteID = inviteId;
    role.RoleID = PARTICIPANT_ROLE_ID;
    if (!(await role.Save())) LogError(role.LatestResult?.CompleteMessage ?? 'Invite role row was not saved.');
}
