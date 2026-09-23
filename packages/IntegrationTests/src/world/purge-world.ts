/**
 * Delete COLLAB-WORLD app rows, by the ids in the catalog.
 *
 * User accounts stay. A signed-in persona owns MemberJunction rows (a
 * workspace, settings, an application grant) that reference the user, and
 * deleting the user rolls the purge back. The loader finds those fixed ids
 * again. Role grants are removed so the next load can require exactly the
 * catalog role. People are removed and created again.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { rm } from 'node:fs/promises';
import { readCsv } from './csv.js';
import { coreSchema, sqlUuid } from './ids.js';
import { worldStorageRoot } from './seed-files.js';

function dataDir(): string {
    const here = dirname(fileURLToPath(import.meta.url));
    const beside = join(here, 'data');
    return existsSync(join(beside, 'spaces.csv')) ? beside : join(here, '..', '..', 'src', 'world', 'data');
}

function idList(rows: Array<Record<string, string>>, label: string): string {
    return rows.map((row) => sqlUuid(row.ID, label)).join(',');
}

export async function purgeWorld(): Promise<void> {
    const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
    if (!DB_HOST || !DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) throw new Error('Set DB_HOST, DB_DATABASE, DB_USERNAME and DB_PASSWORD.');
    const dir = dataDir();
    const userIds = idList(readCsv(join(dir, 'personas.csv')), 'persona');
    const spaceIds = idList(readCsv(join(dir, 'spaces.csv')), 'space');
    const typeIds = idList(readCsv(join(dir, 'types.csv')), 'space type');
    const core = coreSchema();
    const pool = await sql.connect({
        server: DB_HOST,
        port: Number(DB_PORT ?? 1433),
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
            SELECT DISTINCT TRY_CAST(SUBSTRING(RecordID, 4, 36) AS uniqueidentifier) AS FileID
            INTO #worldfiles
            FROM __mj_BizAppsCollaboration.SpaceItem
            WHERE SpaceID IN (${spaceIds}) AND RecordID LIKE 'ID|%';

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

            SELECT ID INTO #conv FROM [${core}].Conversation WHERE UserID IN (${userIds}) OR LinkedRecordID IN (${spaceIds});
            UPDATE conversation SET LastConversationID = NULL
            FROM [${core}].Conversation AS conversation
            WHERE conversation.ID IN (SELECT ID FROM #conv)
               OR conversation.LastConversationID IN (SELECT ID FROM #conv);
            DELETE FROM [${core}].ConversationDetail WHERE ConversationID IN (SELECT ID FROM #conv) OR UserID IN (${userIds});
            DELETE FROM [${core}].Conversation WHERE ID IN (SELECT ID FROM #conv);

            IF OBJECT_ID('__mj_BizAppsCommon.Person') IS NOT NULL
                DELETE FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds});
            DELETE FROM [${core}].UserRole WHERE UserID IN (${userIds});

            DELETE FROM [${core}].FileEntityRecordLink WHERE FileID IN (SELECT FileID FROM #worldfiles WHERE FileID IS NOT NULL);
            DELETE FROM [${core}].[File] WHERE ID IN (SELECT FileID FROM #worldfiles WHERE FileID IS NOT NULL);
        `);
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
    await rm(worldStorageRoot(), { recursive: true, force: true });
    console.log(`COLLAB-WORLD app rows purged from ${DB_DATABASE}. The user accounts were kept.`);
    await pool.close();
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    purgeWorld().then(() => process.exit(0)).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
