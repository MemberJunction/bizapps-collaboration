/**
 * Seats the harness's stub agent on a space for the screenshot script (stage 3), the way a check does: a space-level Agent
 * grant saved through the server classes as the system user, and removed again afterwards. Reads the database the way
 * `magic-link-session.ts` does (the `.env` at the repo root).
 */
import '@memberjunction/core-entities';
import { type BaseEntity, CompositeKey, RunView, type UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/generic-database-provider';
import { SQLServerProviderConfigData, setupSQLServerClient } from '@memberjunction/sqlserver-dataprovider';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/collaboration-entities';
import sql from 'mssql';
import { COLLABORATION_TEST_AGENT_ID } from '../agents/test-agent.js';

const SPACE_GRANTS = 'MJ_BizApps_Collaboration: Space Grants';
const AI_AGENTS = 'MJ: AI Agents';

async function withProvider<T>(work: (provider: Awaited<ReturnType<typeof setupSQLServerClient>>, system: UserInfo) => Promise<T>): Promise<T> {
    const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, MJ_CORE_SCHEMA } = process.env;
    const pool = await new sql.ConnectionPool({
        server: DB_HOST ?? 'localhost', port: Number(DB_PORT ?? 1433), database: DB_DATABASE, user: DB_USERNAME, password: DB_PASSWORD,
        options: { trustServerCertificate: true, encrypt: false },
    }).connect();
    try {
        const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, MJ_CORE_SCHEMA || '__mj'));
        const system = UserCache.Users.find((user: UserInfo) => (user?.Type ?? '').trim().toLowerCase() === 'owner');
        if (!system) throw new Error('No system (Owner-type) user in the database.');
        return await work(provider, system);
    } finally {
        await pool.close();
    }
}

/** Grants the stub agent in `spaceId` (Shared band), as the space's default agent when asked, and returns the grant's id; an existing grant is reused. */
export async function attachStubAgent(spaceId: string, isDefault = false): Promise<string> {
    return withProvider(async (provider, system) => {
        const found = await RunView.FromMetadataProvider(provider).RunView<{ ID: string }>({
            EntityName: SPACE_GRANTS,
            ExtraFilter: `SpaceID = '${spaceId}' AND Kind = 'Agent' AND TargetRecordID = '${COLLABORATION_TEST_AGENT_ID}'`,
            Fields: ['ID'], ResultType: 'simple', MaxRows: 1,
        }, system);
        if (found.Success && found.Results?.[0]) return found.Results[0].ID;
        const grant = await provider.GetEntityObject<BaseEntity>(SPACE_GRANTS, system);
        grant.NewRecord();
        grant.SetMany({
            Kind: 'Agent',
            TargetEntityID: provider.EntityByName(AI_AGENTS)!.ID,
            TargetRecordID: COLLABORATION_TEST_AGENT_ID,
            SpaceID: spaceId,
            Band: 'Shared',
            IsDefault: isDefault,
            Mode: 'Extend',
            Sequence: 0,
        });
        if (!(await grant.Save())) throw new Error(`The stub agent's grant did not save: ${grant.LatestResult?.CompleteMessage ?? ''}`);
        return grant.Get('ID') as string;
    });
}

/** Removes a grant `attachStubAgent` made. */
export async function detachStubAgent(grantId: string): Promise<void> {
    await withProvider(async (provider, system) => {
        const grant = await provider.GetEntityObject<BaseEntity>(SPACE_GRANTS, system);
        if (await grant.InnerLoad(new CompositeKey([{ FieldName: 'ID', Value: grantId }]))) await grant.Delete();
    });
}
