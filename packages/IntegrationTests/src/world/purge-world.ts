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
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { rm } from 'node:fs/promises';
import { readCsv } from './csv.js';
import { coreSchema, sqlUuid } from './ids.js';
import { worldStorageRoot } from './seed-files.js';

function storedObjectPath(root: string, providerKey: string | null): string | null {
    const cleaned = (providerKey ?? '').replace(/^[/\\]+/, '');
    if (!cleaned || cleaned.split(/[/\\]/).some((part) => part === '..' || part === '.')) return null;
    const full = resolve(root, cleaned);
    if (full !== root && !full.startsWith(root + sep)) return null;
    return full;
}

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
    const stored = await pool.request().query(`
        SELECT f.ProviderKey AS ProviderKey
        FROM [${core}].[File] AS f
        WHERE f.ID IN (
            SELECT TRY_CAST(SUBSTRING(i.RecordID, 4, 36) AS uniqueidentifier)
            FROM __mj_BizAppsCollaboration.SpaceItem AS i
            WHERE i.SpaceID IN (${spaceIds}) AND i.RecordID LIKE 'ID|%'
        )
    `);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const request = new sql.Request(transaction);
        await request.query(`
            SELECT DISTINCT TRY_CAST(SUBSTRING(RecordID, 4, 36) AS uniqueidentifier) AS FileID
            INTO #worldfiles
            FROM __mj_BizAppsCollaboration.SpaceItem
            WHERE SpaceID IN (${spaceIds}) AND RecordID LIKE 'ID|%';

            DECLARE @Tasks uniqueidentifier;
            SELECT @Tasks = ID FROM [${core}].[Entity] WHERE Name = N'MJ_BizApps_Tasks: Tasks';

            SELECT TRY_CAST(CASE WHEN i.RecordID LIKE N'ID|%' THEN SUBSTRING(i.RecordID, 4, 36) ELSE i.RecordID END AS uniqueidentifier) AS TaskID
            INTO #roots
            FROM __mj_BizAppsCollaboration.SpaceItem AS i
            WHERE i.SpaceID IN (${spaceIds}) AND i.EntityID = @Tasks;

            CREATE TABLE #tasks (ID uniqueidentifier PRIMARY KEY);
            IF OBJECT_ID('__mj_BizAppsTasks.Task') IS NOT NULL
            BEGIN
                INSERT INTO #tasks (ID)
                SELECT roots.TaskID FROM #roots AS roots
                WHERE roots.TaskID IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM #tasks AS known WHERE known.ID = roots.TaskID);
                DECLARE @added int = 1;
                WHILE @added > 0
                BEGIN
                    INSERT INTO #tasks (ID)
                    SELECT t.ID FROM __mj_BizAppsTasks.Task AS t
                    WHERE t.ParentID IN (SELECT ID FROM #tasks)
                      AND NOT EXISTS (SELECT 1 FROM #tasks AS known WHERE known.ID = t.ID);
                    SET @added = @@ROWCOUNT;
                END
                IF OBJECT_ID('__mj_BizAppsTasks.TaskActivity') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskActivity WHERE TaskID IN (SELECT ID FROM #tasks);
                IF OBJECT_ID('__mj_BizAppsTasks.TaskComment') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskComment WHERE TaskID IN (SELECT ID FROM #tasks);
                IF OBJECT_ID('__mj_BizAppsTasks.TaskAssignment') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskAssignment WHERE TaskID IN (SELECT ID FROM #tasks);
                IF OBJECT_ID('__mj_BizAppsTasks.TaskDecision') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskDecision WHERE TaskID IN (SELECT ID FROM #tasks);
                IF OBJECT_ID('__mj_BizAppsTasks.TaskDependency') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskDependency WHERE TaskID IN (SELECT ID FROM #tasks) OR DependsOnTaskID IN (SELECT ID FROM #tasks);
                IF OBJECT_ID('__mj_BizAppsTasks.TaskLink') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskLink WHERE TaskID IN (SELECT ID FROM #tasks);
                IF OBJECT_ID('__mj_BizAppsTasks.TaskTagLink') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskTagLink WHERE TaskID IN (SELECT ID FROM #tasks);
                IF OBJECT_ID('__mj_BizAppsTasks.TaskNotificationLog') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskNotificationLog WHERE TaskID IN (SELECT ID FROM #tasks);
                DELETE FROM __mj_BizAppsTasks.Task WHERE ID IN (SELECT ID FROM #tasks);
            END

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
    const root = resolve(worldStorageRoot());
    for (const row of stored.recordset as Array<{ ProviderKey: string | null }>) {
        const file = storedObjectPath(root, row.ProviderKey);
        if (!file) continue;
        await rm(file, { force: true });
        await rm(`${file}.mjmeta.json`, { force: true });
    }
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
