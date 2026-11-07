/**
 * A conversation with one agent turn in it, made for the screenshot script (stage 3) the way the server makes them: as the
 * person named, through Collaboration's own operations, so the browser then shows the reply the turn wrote. Reads the database
 * the way `magic-link-session.ts` does (the `.env` at the repo root).
 */
import '@memberjunction/core-entities';
import { type BaseEntity, CompositeKey, RunView, type UserInfo } from '@memberjunction/core';
import { UserCache } from '@memberjunction/generic-database-provider';
import { SQLServerProviderConfigData, setupSQLServerClient } from '@memberjunction/sqlserver-dataprovider';
import '@mj-biz-apps/common-entities';
import '@mj-biz-apps/collaboration-entities';
import { createSpaceConversation, executeSpaceChatTurn, postSpaceMessage } from '@mj-biz-apps/collaboration-core-entities-server';
import sql from 'mssql';
import '../agents/index.js';

export interface TurnMade {
    conversationId: string;
    spaceChatId: string;
    replyText: string;
}

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

/** Starts a conversation of `kind` in the space as `email`, posts `text` and runs its turn; the reply's text comes back with the ids. */
export async function askAs(email: string, spaceId: string, kind: 'General' | 'Private', text: string): Promise<TurnMade> {
    return withProvider(async (provider, system) => {
        const user = UserCache.Users.find((u: UserInfo) => (u.Email ?? '').toLowerCase() === email.toLowerCase());
        if (!user) throw new Error(`${email} is not a user in this database.`);
        const started = await createSpaceConversation(provider, user, { SpaceID: spaceId, Name: text.length > 50 ? `${text.slice(0, 47)}...` : text, Kind: kind });
        if (!started.ok || !started.conversationId || !started.spaceChatId) throw new Error(`The conversation did not start: ${started.ok ? '' : started.message}`);
        const posted = await postSpaceMessage(provider, user, { spaceId, conversationId: started.conversationId, text });
        if (!posted.ok || !posted.detailId) throw new Error(`The message was not posted: ${posted.ok ? '' : posted.message}`);
        const turn = await executeSpaceChatTurn(provider, user, { spaceId, conversationId: started.conversationId, userMessageId: posted.detailId });
        if (!turn.ok) throw new Error(`The turn was refused: ${turn.message}`);
        const rows = await RunView.FromMetadataProvider(provider).RunView<{ Message: string }>({ EntityName: 'MJ: Conversation Details', ExtraFilter: `ID = '${turn.replyDetailIds[0]}'`, Fields: ['Message'], ResultType: 'simple', MaxRows: 1 }, system);
        return { conversationId: started.conversationId, spaceChatId: started.spaceChatId, replyText: rows.Results?.[0]?.Message ?? '' };
    });
}

/** Removes a conversation `askAs` made, with what hangs on it, as the system user. */
export async function removeConversation(conversationId: string): Promise<void> {
    await withProvider(async (provider, system) => {
        const rv = RunView.FromMetadataProvider(provider);
        const byConversation = `ConversationID = '${conversationId}'`;
        const steps: Array<[string, string]> = [
            ['MJ: AI Agent Runs', byConversation],
            ['MJ_BizApps_Collaboration: Space Chats', byConversation],
            ['MJ: Conversation Details', byConversation],
            ['MJ: Resource Permissions', `ResourceRecordID = '${conversationId}'`],
        ];
        for (const [entityName, filter] of steps) {
            const rows = await rv.RunView<{ ID: string }>({ EntityName: entityName, ExtraFilter: filter, Fields: ['ID'], ResultType: 'simple', MaxRows: 500 }, system);
            for (const row of rows.Results ?? []) {
                const entity = await provider.GetEntityObject<BaseEntity>(entityName, system);
                if (await entity.InnerLoad(new CompositeKey([{ FieldName: 'ID', Value: row.ID }]))) await entity.Delete();
            }
        }
        const conversation = await provider.GetEntityObject<BaseEntity>('MJ: Conversations', system);
        if (await conversation.InnerLoad(new CompositeKey([{ FieldName: 'ID', Value: conversationId }]))) await conversation.Delete();
    });
}
