/**
 * An owner mints one resource-share link for a space.
 *
 * MemberJunction's POST /magic-link/create does not take a resource id, and it
 * only lets an Owner-type user mint. This writes the same invite row that
 * endpoint writes: the token is `mj_ml_` plus random bytes, stored as the
 * SHA-256 base64url hash redemption already looks up. The row is Kind
 * resource-share, so redemption puts the space id on the session and the
 * space filter can admit that one space.
 *
 * The system user saves the invite. The space owner is CreatedByUserID, so
 * the link stops working if that owner is deactivated. A non-owner is refused
 * before any row is written.
 */
import { createHash, randomBytes } from 'node:crypto';
import { Metadata, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import '@memberjunction/core-entities';
import { MJMagicLinkInviteEntity } from '@memberjunction/core-entities';
import '@mj-biz-apps/common-entities';
import { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';
import { mayMintSpaceLink } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from '@mj-biz-apps/collaboration-core-entities-server';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const INVITES = 'MJ: Magic Link Invites';
const USERS = 'MJ: Users';
const PEOPLE = 'MJ_BizApps_Common: People';
const APPLICATION_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';
const PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';
const SPACE_RESOURCE_TYPE_ID = '33642155-617E-4825-A2CC-F071A60F3739';

export interface MintSpaceLinkResult {
    ok: boolean;
    redemptionUrl?: string;
    inviteId?: string;
    message?: string;
}

export async function mintSpaceLink(input: {
    provider: IMetadataProvider;
    user: UserInfo;
    spaceId: string;
    email: string;
    publicUrl: string;
}): Promise<MintSpaceLinkResult> {
    const email = input.email.trim();
    if (!email.includes('@') || email.includes(' ')) {
        return { ok: false, message: 'Link refused: enter an email address.' };
    }
    const space = await input.provider.GetEntityObject(SPACES, input.user);
    let context;
    try {
        context = await loadWriteContext(space, input.user, input.spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Link refused: the roster could not be read.' };
    }
    const decision = mayMintSpaceLink({
        callerUserId: input.user.ID,
        targetSpaceId: input.spaceId,
        spaces: context.spaces,
        memberships: context.memberships,
    });
    if (decision.ok === false) return { ok: false, message: decision.message };

    const system = await requireSystemUser(space);
    await ensurePerson(input.provider, system, email);
    const rawToken = `mj_ml_${randomBytes(32).toString('hex')}`;
    const invite = await input.provider.GetEntityObject<MJMagicLinkInviteEntity>(INVITES, system);
    invite.NewRecord();
    invite.TokenHash = createHash('sha256').update(rawToken).digest('base64url');
    invite.Email = email;
    invite.ApplicationID = APPLICATION_ID;
    invite.RoleID = PARTICIPANT_ROLE_ID;
    invite.ExpiresAt = new Date(Date.now() + 72 * 3600 * 1000);
    invite.MaxUses = 1;
    invite.UseCount = 0;
    invite.CreatedByUserID = input.user.ID;
    invite.Status = 'Active';
    invite.IdentityMode = 'email';
    invite.Kind = 'resource-share';
    invite.ResourceTypeID = SPACE_RESOURCE_TYPE_ID;
    invite.ResourceID = input.spaceId;
    if (!(await invite.Save())) {
        return { ok: false, message: invite.LatestResult?.CompleteMessage ?? 'Link refused: the invite could not be saved.' };
    }
    const base = input.publicUrl.replace(/\/$/, '');
    return { ok: true, inviteId: invite.ID, redemptionUrl: `${base}/magic-link/redeem?token=${encodeURIComponent(rawToken)}` };
}

async function ensurePerson(provider: IMetadataProvider, system: UserInfo, email: string): Promise<void> {
    if (!new Metadata().EntityByName(PEOPLE)) return;
    const view = new RunView();
    const users = await view.RunView<{ ID: string; Name: string }>({
        EntityName: USERS,
        ExtraFilter: `Email = '${email.replace(/'/g, "''")}'`,
        Fields: ['ID', 'Name'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    const account = users.Results?.[0];
    if (!users.Success || !account) return;
    const existing = await view.RunView<{ ID: string }>({
        EntityName: PEOPLE,
        ExtraFilter: `LinkedUserID = '${account.ID}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!existing.Success || existing.Results?.length) return;
    const parts = (account.Name || email).trim().split(/\s+/);
    const person = await provider.GetEntityObject<mjBizAppsCommonPersonEntity>(PEOPLE, system);
    person.NewRecord();
    person.FirstName = parts[0] || 'Member';
    person.LastName = parts.slice(1).join(' ') || 'Member';
    person.Email = email;
    person.LinkedUserID = account.ID;
    if (!(await person.Save())) {
        throw new Error(person.LatestResult?.CompleteMessage ?? 'Link refused: the person record could not be saved.');
    }
}
