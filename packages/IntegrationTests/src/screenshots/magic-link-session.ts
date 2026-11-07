/**
 * A magic-link session for the screenshot script: mints a single-use invite for an email that already holds a seat, redeems it
 * against MJAPI as the API would for a browser, and returns the session token Explorer reads from `#token=`.
 *
 * Reads the database the way the world loaders do (the `.env` at the repo root) and writes the invite as the system user, the
 * way `MintSpaceLink` does. The person's seat is not touched: a seat is the invite's precondition, not its result.
 *
 *   node --env-file=.env packages/IntegrationTests/dist/screenshots/magic-link-session.js <email> [api url]
 */
import { createHash, randomBytes } from 'node:crypto';
import '@memberjunction/core-entities';
import { type BaseEntity, type UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/generic-database-provider';
import { SQLServerProviderConfigData, setupSQLServerClient } from '@memberjunction/sqlserver-dataprovider';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/collaboration-entities';
import sql from 'mssql';

/** Collaboration's application and MJ's Space Participant role, as `mint-space-link.ts` names them. */
const COLLABORATION_APPLICATION_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';
const SPACE_PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';

export interface GuestSession {
    /** The session token for Explorer's magic-link provider: open `${explorerUrl}/app/collaboration#token=${token}`. */
    token: string;
    /** The app the invite was scoped to, as the redeem reported it. */
    applicationPath: string;
}

interface RedeemResult {
    success: boolean;
    token?: string;
    applicationPath?: string;
    errorCode?: string;
    error?: string;
}

/** Mints and redeems one invite for `email`, which must already be a user. `apiUrl` is MJAPI's base, with no trailing slash. */
export async function mintGuestSession(email: string, apiUrl: string): Promise<GuestSession> {
    const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, MJ_CORE_SCHEMA } = process.env;
    const pool = await new sql.ConnectionPool({
        server: DB_HOST ?? 'localhost',
        port: Number(DB_PORT ?? 1433),
        database: DB_DATABASE,
        user: DB_USERNAME,
        password: DB_PASSWORD,
        options: { trustServerCertificate: true, encrypt: false },
    }).connect();
    try {
        const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, MJ_CORE_SCHEMA || '__mj'));
        const system = UserCache.Users.find((user: UserInfo) => (user?.Type ?? '').trim().toLowerCase() === 'owner');
        if (!system) throw new Error('No system (Owner-type) user in the database.');
        const guest = UserCache.Users.find((user: UserInfo) => (user.Email ?? '').toLowerCase() === email.toLowerCase());
        if (!guest) throw new Error(`${email} is not a user; seat them first (an invite from an owner creates the account).`);

        const rawToken = `mj_ml_${randomBytes(32).toString('hex')}`;
        const invite = await provider.GetEntityObject<BaseEntity>('MJ: Magic Link Invites', system);
        invite.NewRecord();
        invite.SetMany({
            TokenHash: createHash('sha256').update(rawToken).digest('base64url'),
            Email: email,
            ApplicationID: COLLABORATION_APPLICATION_ID,
            RoleID: SPACE_PARTICIPANT_ROLE_ID,
            ExpiresAt: new Date(Date.now() + 3600 * 1000),
            MaxUses: 1,
            UseCount: 0,
            CreatedByUserID: system.ID,
            Status: 'Active',
            IdentityMode: 'email',
            Kind: 'app-session',
        });
        if (!(await invite.Save())) throw new Error(`The invite did not save: ${invite.LatestResult?.CompleteMessage ?? ''}`);
        for (const [entityName, fields] of [
            ['MJ: Magic Link Invite Applications', { InviteID: invite.Get('ID'), ApplicationID: COLLABORATION_APPLICATION_ID }],
            ['MJ: Magic Link Invite Roles', { InviteID: invite.Get('ID'), RoleID: SPACE_PARTICIPANT_ROLE_ID }],
        ] as const) {
            const row = await provider.GetEntityObject<BaseEntity>(entityName, system);
            row.NewRecord();
            row.SetMany({ ...fields });
            if (!(await row.Save())) throw new Error(`${entityName} did not save: ${row.LatestResult?.CompleteMessage ?? ''}`);
        }

        const response = await fetch(`${apiUrl}/magic-link/redeem?format=json`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: rawToken }),
        });
        const redeemed = (await response.json()) as RedeemResult;
        if (!redeemed.success || !redeemed.token) {
            throw new Error(`The redeem failed: ${redeemed.errorCode ?? response.status} ${redeemed.error ?? ''}`.trim());
        }
        return { token: redeemed.token, applicationPath: redeemed.applicationPath ?? 'collaboration' };
    } finally {
        await pool.close();
    }
}

const runAsScript = process.argv[1]?.endsWith('magic-link-session.js');
if (runAsScript) {
    const [email, apiUrl = 'http://localhost:4117'] = process.argv.slice(2);
    if (!email) throw new Error('Give the email of a seated person.');
    const session = await mintGuestSession(email, apiUrl.replace(/\/$/, ''));
    console.log(session.token);
    process.exit(0);
}
