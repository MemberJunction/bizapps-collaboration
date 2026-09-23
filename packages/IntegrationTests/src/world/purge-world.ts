/**
 * Delete only COLLAB-WORLD rows, by the ids in the catalog.
 * Seats, items, notices, and uses go before spaces. People, user roles,
 * and users go last. Nothing outside those ids is deleted.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { readCsv } from './csv.js';

function dataDir(): string {
    const here = dirname(fileURLToPath(import.meta.url));
    const beside = join(here, 'data');
    return existsSync(join(beside, 'spaces.csv')) ? beside : join(here, '..', '..', 'src', 'world', 'data');
}

export async function purgeWorld(): Promise<void> {
    const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
    if (!DB_HOST || !DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) throw new Error('Set DB_HOST, DB_DATABASE, DB_USERNAME and DB_PASSWORD.');
    const dir = dataDir();
    const personas = readCsv(join(dir, 'personas.csv'));
    const spaces = readCsv(join(dir, 'spaces.csv'));
    const types = readCsv(join(dir, 'types.csv'));
    const userIds = personas.map((row) => `'${row.ID}'`).join(',');
    const spaceIds = spaces.map((row) => `'${row.ID}'`).join(',');
    const typeIds = types.map((row) => `'${row.ID}'`).join(',');
    const pool = await sql.connect({
        server: DB_HOST,
        port: Number(process.env.DB_PORT ?? 1433),
        database: DB_DATABASE,
        user: DB_USERNAME,
        password: DB_PASSWORD,
        options: { trustServerCertificate: true, encrypt: false },
    });
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const request = new sql.Request(transaction);
        await request.query(`
            DELETE FROM __mj_BizAppsCollaboration.ShareNotice WHERE SpaceID IN (${spaceIds}) OR RecipientUserID IN (${userIds});
            DELETE FROM __mj_BizAppsCollaboration.ItemUse WHERE SpaceID IN (${spaceIds}) OR UserID IN (${userIds});
            DELETE FROM __mj_BizAppsCollaboration.SpaceMember WHERE SpaceID IN (${spaceIds}) OR UserID IN (${userIds});
            DELETE FROM __mj_BizAppsCollaboration.SpaceItem WHERE SpaceID IN (${spaceIds});
            WHILE EXISTS (
                SELECT 1 FROM __mj_BizAppsCollaboration.Space AS child
                WHERE child.ID IN (${spaceIds})
                  AND child.ParentID IN (SELECT ID FROM __mj_BizAppsCollaboration.Space WHERE ID IN (${spaceIds}))
            )
                DELETE FROM __mj_BizAppsCollaboration.Space
                WHERE ID IN (${spaceIds})
                  AND ID NOT IN (
                      SELECT ParentID FROM __mj_BizAppsCollaboration.Space
                      WHERE ParentID IN (${spaceIds})
                  );
            DELETE FROM __mj_BizAppsCollaboration.Space WHERE ID IN (${spaceIds});
            DELETE FROM __mj_BizAppsCollaboration.SpaceType WHERE ID IN (${typeIds});

            SELECT ID INTO #conv FROM __mj.Conversation WHERE UserID IN (${userIds}) OR LinkedRecordID IN (${spaceIds});
            UPDATE conversation SET LastConversationID = NULL
            FROM __mj.Conversation AS conversation
            WHERE conversation.ID IN (SELECT ID FROM #conv)
               OR conversation.LastConversationID IN (SELECT ID FROM #conv);
            DELETE FROM __mj.ConversationDetail WHERE ConversationID IN (SELECT ID FROM #conv) OR UserID IN (${userIds});
            DELETE FROM __mj.Conversation WHERE ID IN (SELECT ID FROM #conv);

            DELETE FROM __mj.RecordChange WHERE UserID IN (${userIds});
            DELETE FROM __mj.UserNotification WHERE UserID IN (${userIds});
            DELETE FROM __mj.AuditLog WHERE UserID IN (${userIds});
            IF OBJECT_ID('__mj_BizAppsCommon.Person') IS NOT NULL
                DELETE FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds});
            DELETE FROM __mj.UserRole WHERE UserID IN (${userIds});
            DELETE FROM __mj.[User] WHERE ID IN (${userIds});
        `);
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
    console.log(`COLLAB-WORLD purged from ${DB_DATABASE}.`);
    await pool.close();
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    purgeWorld().then(() => process.exit(0)).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
