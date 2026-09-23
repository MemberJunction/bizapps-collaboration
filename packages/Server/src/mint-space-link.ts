/**
 * An email invitation is a seat, saved through the member gate.
 *
 * The sign-in link only proves who the person is. It is an app session, not a
 * resource share, so access ends when the seat is removed. The raw URL is
 * emailed to that address, or returned to a host issuer. A space owner who is
 * neither does not receive it.
 */
import { createHash, randomBytes } from 'node:crypto';
import { LogError, Metadata, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import '@memberjunction/core-entities';
import {
    MJMagicLinkInviteApplicationEntity,
    MJMagicLinkInviteEntity,
    MJMagicLinkInviteRoleEntity,
    MJUserEntity,
} from '@memberjunction/core-entities';
import '@mj-biz-apps/common-entities';
import { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';
import { callerMayReceiveLink, linkHandoff, refuseInvite } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { loadWriteContext, requireSystemUser } from '@mj-biz-apps/collaboration-core-entities-server';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const INVITES = 'MJ: Magic Link Invites';
const USERS = 'MJ: Users';
const PEOPLE = 'MJ_BizApps_Common: People';
const APPLICATION_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';
const PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MagicLinkHost {
    enabled: boolean;
    publicUrl: string;
    restrictedRoleName: string;
    grantableRoleNames: readonly string[];
    inviteIssuerRoleNames: readonly string[];
    communicationProvider?: string;
    defaultExpiresInHours: number;
}

export interface MintSpaceLinkResult {
    ok: boolean;
    sent?: boolean;
    redemptionUrl?: string;
    message?: string;
}

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
        return { ok: false, message: 'Invite refused: this host has not opted in to granting Space Participant.' };
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
    let accountId = await findUserId(input.provider, email, system);
    let createdUser = false;
    if (!accountId) {
        const account = await input.provider.GetEntityObject<MJUserEntity>(USERS, system);
        account.NewRecord();
        account.Name = email.split('@')[0] || 'Member';
        account.Email = email;
        account.Type = 'User';
        if (!(await account.Save())) return { ok: false, message: 'Invite refused: the account could not be created.' };
        accountId = account.ID;
        createdUser = true;
    }
    const decision = refuseInvite({
        callerUserId: input.user.ID,
        inviteeUserId: accountId,
        targetSpaceId: input.spaceId,
        granted,
        approval: context.approval,
        memberCap: context.memberCap,
        occupied: context.memberCount,
        spaces: context.spaces,
        memberships: context.memberships,
    });
    if (decision.ok === false) {
        if (createdUser) await deleteNewUser(input.provider, system, accountId);
        return { ok: false, message: decision.message };
    }
    const member = await input.provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(MEMBERS, input.user);
    member.NewRecord();
    member.SpaceID = input.spaceId;
    member.UserID = accountId;
    member.SpaceRoleTypeID = input.roleId;
    member.Status = 'Active';
    member.Band = granted.canSeeTeamBand ? 'Team' : 'Shared';
    if (!(await member.Save())) {
        if (createdUser) await deleteNewUser(input.provider, system, accountId);
        return { ok: false, message: member.LatestResult?.CompleteMessage ?? 'Invite refused: the seat could not be saved.' };
    }
    if (member.Status.trim() !== decision.status) {
        return { ok: false, message: `Invite refused: the seat saved as ${member.Status.trim()}.` };
    }
    try {
        await ensurePerson(input.provider, system, accountId, email);
    } catch (error) {
        LogError(error);
        return { ok: false, message: 'Invite refused: the person record could not be saved.' };
    }

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
    if (!(await invite.Save())) return { ok: false, message: 'They are seated. The sign-in link could not be saved.' };
    await writeChildRows(input.provider, system, invite.ID);
    const redemptionUrl = `${base}/magic-link/redeem?token=${encodeURIComponent(rawToken)}`;
    if (handoff === 'email') {
        const sent = await sendInvite(input.host.communicationProvider ?? '', email, redemptionUrl, system);
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

async function findUserId(provider: IMetadataProvider, email: string, user: UserInfo): Promise<string | null> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: USERS,
        ExtraFilter: `Email = '${email.replace(/'/g, "''")}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, user);
    return rows.Success ? rows.Results?.[0]?.ID ?? null : null;
}

async function deleteNewUser(provider: IMetadataProvider, system: UserInfo, userId: string): Promise<void> {
    const account = await provider.GetEntityObject<MJUserEntity>(USERS, system);
    if (await account.Load(userId)) await account.Delete();
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
    if (!existing.Success || existing.Results?.length) return;
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

async function sendInvite(providerName: string, email: string, redemptionUrl: string, user: UserInfo): Promise<boolean> {
    try {
        const engineModule = await import('@memberjunction/' + 'communication-engine') as {
            CommunicationEngine: { Instance: { Config: (force: boolean, user: UserInfo) => Promise<void>; SendSingleMessage: (provider: string, type: string, message: object) => Promise<{ Success?: boolean }> } };
        };
        const messageModule = await import('@memberjunction/' + 'communication-types') as { Message: new () => { To: string; Subject: string; Body: string } };
        const engine = engineModule.CommunicationEngine.Instance;
        await engine.Config(false, user);
        const message = new messageModule.Message();
        message.To = email;
        message.Subject = "You've been invited to Collaboration";
        message.Body = `Open this link to sign in:\n\n${redemptionUrl}\n\nThis link is single-use and will expire.`;
        const result = await engine.SendSingleMessage(providerName, 'Email', message);
        return !!result?.Success;
    } catch (error) {
        LogError(error);
        return false;
    }
}
