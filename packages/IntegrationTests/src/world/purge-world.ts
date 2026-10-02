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
import { CHECK_SPACE_PREFIX, coreSchema, INVITEE_EMAIL_DOMAIN, sqlUuid } from './ids.js';
import { worldStorageRoot } from './seed-files.js';
import { BoxFileStorage } from '@memberjunction/storage';
import { COLLABORATION_STORAGE_ACCOUNT_ID, COLLABORATION_STORAGE_PROVIDER_ID, getBoxStorageConfig } from './local-storage-account.js';

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

/**
 * The SQL that removes every file on the Collaboration storage provider, not only the world's. The purge deletes the
 * provider itself, and a `File` row that still points at it blocks that delete (finding 16 of the browser pass: three
 * uploads into a space that was not the world's stopped the purge, and the loader then ran over a half-purged
 * database). Anything on this provider is test data on a test host, so it goes: the space items that show it in any
 * space, with their uses and share notices, its record links, then the row. Runs inside the purge's transaction, after
 * the world's own items are gone and before the provider is deleted.
 */
export function providerFilesPurgeSql(core: string, providerId: string): string {
    return `
            SELECT ID AS FileID INTO #providerfiles FROM [${core}].[File] WHERE ProviderID = '${providerId}';
            SELECT i.ID INTO #strayitems FROM __mj_BizAppsCollaboration.SpaceItem AS i
            WHERE i.RecordID LIKE 'ID|%' AND TRY_CAST(SUBSTRING(i.RecordID, 4, 36) AS uniqueidentifier) IN (SELECT FileID FROM #providerfiles);
            DELETE FROM __mj_BizAppsCollaboration.ItemUse WHERE ItemID IN (SELECT ID FROM #strayitems);
            DELETE FROM __mj_BizAppsCollaboration.ShareNotice WHERE ItemID IN (SELECT ID FROM #strayitems);
            DELETE FROM __mj_BizAppsCollaboration.SpaceItem WHERE ID IN (SELECT ID FROM #strayitems);
            -- A Library document is an Artifact Version in file mode over its file row (stage 1): the version and its artifact go before the file
            SELECT v.ID AS VersionID, v.ArtifactID INTO #fileversions FROM [${core}].ArtifactVersion AS v WHERE v.FileID IN (SELECT FileID FROM #providerfiles);
            DELETE FROM [${core}].ArtifactVersion WHERE ID IN (SELECT VersionID FROM #fileversions);
            DELETE FROM [${core}].Artifact WHERE ID IN (SELECT ArtifactID FROM #fileversions) AND NOT EXISTS (SELECT 1 FROM [${core}].ArtifactVersion AS left_ WHERE left_.ArtifactID = Artifact.ID);
            DELETE FROM [${core}].FileEntityRecordLink WHERE FileID IN (SELECT FileID FROM #providerfiles);
            DELETE FROM [${core}].[File] WHERE ID IN (SELECT FileID FROM #providerfiles);`;
}

export async function purgeWorld(): Promise<void> {
    const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
    if (!DB_HOST || !DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) throw new Error('Set DB_HOST, DB_DATABASE, DB_USERNAME and DB_PASSWORD.');
    const dir = dataDir();
    const userIds = idList(readCsv(join(dir, 'personas.csv')), 'persona');
    const worldSpaceIds = idList(readCsv(join(dir, 'spaces.csv')), 'space');
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
    // Spaces a check created and did not clean up (its run died first) go with the world; they carry the check marker
    // Only those a check could have made: owned by a world persona, and either a root or a child of a world space
    const personaIds = readCsv(join(dir, 'personas.csv')).map((row) => sqlUuid(row.ID, 'persona')).join(',');
    const markedSpaces = await pool.request()
        .input('prefix', sql.NVarChar, `${CHECK_SPACE_PREFIX.replace(/[%_[]/g, '[$&]')}%`)
        .query<{ ID: string }>(
            `SELECT ID FROM __mj_BizAppsCollaboration.Space WHERE Name LIKE @prefix AND OwnerID IN (${personaIds}) AND (ParentID IS NULL OR ParentID IN (${worldSpaceIds}))`,
        );
    const spaceIds = [worldSpaceIds, ...(markedSpaces.recordset ?? []).map((row) => sqlUuid(row.ID, 'check space'))].join(',');
    // Every file on the Collaboration provider goes with the provider, the world's and any other upload a test host holds
    const stored = await pool.request().query<{ ProviderKey: string | null; Name: string; IsWorld: number }>(`
        SELECT f.ProviderKey AS ProviderKey, f.Name AS Name,
               CASE WHEN f.ID IN (
                   SELECT TRY_CAST(SUBSTRING(i.RecordID, 4, 36) AS uniqueidentifier)
                   FROM __mj_BizAppsCollaboration.SpaceItem AS i
                   WHERE i.SpaceID IN (${spaceIds}) AND i.RecordID LIKE 'ID|%'
               ) THEN 1 ELSE 0 END AS IsWorld
        FROM [${core}].[File] AS f
        WHERE f.ProviderID = '${COLLABORATION_STORAGE_PROVIDER_ID}'
    `);
    const strays = (stored.recordset ?? []).filter((row) => !row.IsWorld).map((row) => row.Name);
    if (strays.length > 0) {
        console.log(`Removing ${strays.length} file(s) on the Collaboration provider that are not the world's: ${strays.join(', ')}`);
    }
    const foreignSpaces = await pool.request().query<{ ID: string; Name: string }>(`
        SELECT ID, Name FROM __mj_BizAppsCollaboration.Space WHERE ParentID IN (${spaceIds}) AND ID NOT IN (${spaceIds});
    `);
    if (foreignSpaces.recordset && foreignSpaces.recordset.length > 0) {
        const names = foreignSpaces.recordset.map((r: { ID: string; Name: string }) => `'${r.Name}' (${r.ID})`).join(', ');
        throw new Error(`Purge refused: foreign child spaces found under world spaces: ${names}`);
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const request = new sql.Request(transaction);
        await request.query(`
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
                    DELETE FROM __mj_BizAppsTasks.TaskActivity WHERE TaskID IN (SELECT ID FROM #tasks) OR TaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds})));
                IF OBJECT_ID('__mj_BizAppsTasks.TaskComment') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskComment WHERE TaskID IN (SELECT ID FROM #tasks) OR TaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds})));
                IF OBJECT_ID('__mj_BizAppsTasks.TaskAssignment') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskAssignment WHERE TaskID IN (SELECT ID FROM #tasks) OR TaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds}))) OR AssigneeRecordID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds}));
                IF OBJECT_ID('__mj_BizAppsTasks.TaskDecision') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskDecision WHERE TaskID IN (SELECT ID FROM #tasks) OR TaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds})));
                IF OBJECT_ID('__mj_BizAppsTasks.TaskDependency') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskDependency WHERE TaskID IN (SELECT ID FROM #tasks) OR DependsOnTaskID IN (SELECT ID FROM #tasks) OR TaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds}))) OR DependsOnTaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds})));
                IF OBJECT_ID('__mj_BizAppsTasks.TaskLink') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskLink WHERE TaskID IN (SELECT ID FROM #tasks) OR TaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds})));
                IF OBJECT_ID('__mj_BizAppsTasks.TaskTagLink') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskTagLink WHERE TaskID IN (SELECT ID FROM #tasks) OR TaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds})));
                IF OBJECT_ID('__mj_BizAppsTasks.TaskNotificationLog') IS NOT NULL
                    DELETE FROM __mj_BizAppsTasks.TaskNotificationLog WHERE TaskID IN (SELECT ID FROM #tasks) OR TaskID IN (SELECT ID FROM __mj_BizAppsTasks.Task WHERE CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds})));
                DELETE FROM __mj_BizAppsTasks.Task WHERE ID IN (SELECT ID FROM #tasks) OR CreatedByPersonID IN (SELECT ID FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds}));
            END

            CREATE TABLE #chatConvs (ID UNIQUEIDENTIFIER);
            IF OBJECT_ID('__mj_BizAppsCollaboration.SpaceChat') IS NOT NULL
                INSERT INTO #chatConvs (ID)
                SELECT ConversationID FROM __mj_BizAppsCollaboration.SpaceChat WHERE SpaceID IN (${spaceIds}) AND ConversationID IS NOT NULL;

            DELETE FROM __mj_BizAppsCollaboration.ShareNotice WHERE SpaceID IN (${spaceIds}) OR RecipientUserID IN (${userIds});
            DELETE FROM __mj_BizAppsCollaboration.ItemUse WHERE SpaceID IN (${spaceIds}) OR UserID IN (${userIds});
            DELETE FROM __mj_BizAppsCollaboration.SpaceMember WHERE SpaceID IN (${spaceIds}) OR UserID IN (${userIds});
            -- Stage 1's rows on the world's spaces: grants, anchors, notes and pins (a pin's grant goes with the grants)
            IF OBJECT_ID('__mj_BizAppsCollaboration.SpaceMemberPin') IS NOT NULL
                DELETE FROM __mj_BizAppsCollaboration.SpaceMemberPin WHERE SpaceID IN (${spaceIds}) OR UserID IN (${userIds});
            IF OBJECT_ID('__mj_BizAppsCollaboration.SpaceNote') IS NOT NULL
                DELETE FROM __mj_BizAppsCollaboration.SpaceNote WHERE SpaceID IN (${spaceIds}) OR AuthorUserID IN (${userIds});
            IF OBJECT_ID('__mj_BizAppsCollaboration.SpaceGrant') IS NOT NULL
                DELETE FROM __mj_BizAppsCollaboration.SpaceGrant WHERE SpaceID IN (${spaceIds}) OR SpaceTypeID IN (${typeIds});
            IF OBJECT_ID('__mj_BizAppsCollaboration.SpaceAnchor') IS NOT NULL
                DELETE FROM __mj_BizAppsCollaboration.SpaceAnchor WHERE SpaceID IN (${spaceIds}) OR SpaceTypeID IN (${typeIds});
            IF OBJECT_ID('__mj_BizAppsCollaboration.SpaceTypeStatus') IS NOT NULL
            BEGIN
                UPDATE __mj_BizAppsCollaboration.Space SET StatusID = NULL WHERE ID IN (${spaceIds});
                DELETE FROM __mj_BizAppsCollaboration.SpaceTypeStatus WHERE SpaceTypeID IN (${typeIds});
            END
            DELETE FROM __mj_BizAppsCollaboration.SpaceChat WHERE SpaceID IN (${spaceIds});
            DELETE FROM __mj_BizAppsCollaboration.SpaceItem WHERE SpaceID IN (${spaceIds});
            -- The example subtype's rows go before the spaces they specialise: their keys are foreign keys to Space, with no cascade
            IF OBJECT_ID('__mj_BizAppsCollabExamples.ExampleBoard') IS NOT NULL
                DELETE FROM __mj_BizAppsCollabExamples.ExampleBoard WHERE ID IN (${spaceIds});
            UPDATE __mj_BizAppsCollaboration.Space SET ParentID = NULL WHERE ID IN (${spaceIds});
            DELETE FROM __mj_BizAppsCollaboration.Space WHERE ID IN (${spaceIds});
            DELETE FROM __mj_BizAppsCollaboration.SpaceType WHERE ID IN (${typeIds});

            SELECT ID INTO #conv FROM [${core}].Conversation WHERE UserID IN (${userIds}) OR LinkedRecordID IN (${spaceIds}) OR ID IN (SELECT ID FROM #chatConvs);
            SELECT ID INTO #details FROM [${core}].ConversationDetail WHERE ConversationID IN (SELECT ID FROM #conv) OR UserID IN (${userIds});

            IF OBJECT_ID('__mj_BizAppsCollaboration.SpaceChat') IS NOT NULL
                DELETE FROM __mj_BizAppsCollaboration.SpaceChat WHERE SpaceID IN (${spaceIds}) OR ConversationID IN (SELECT ID FROM #conv);

            IF OBJECT_ID('[${core}].AIAgentRun') IS NOT NULL
                UPDATE [${core}].AIAgentRun SET ConversationDetailID = NULL WHERE ConversationDetailID IN (SELECT ID FROM #details);

            IF OBJECT_ID('[${core}].AIAgentExample') IS NOT NULL
                UPDATE [${core}].AIAgentExample SET SourceConversationDetailID = NULL, SourceConversationID = NULL WHERE SourceConversationDetailID IN (SELECT ID FROM #details) OR SourceConversationID IN (SELECT ID FROM #conv);

            IF OBJECT_ID('[${core}].AIAgentNote') IS NOT NULL
                UPDATE [${core}].AIAgentNote SET SourceConversationDetailID = NULL WHERE SourceConversationDetailID IN (SELECT ID FROM #details);

            IF OBJECT_ID('[${core}].ConversationDetailArtifact') IS NOT NULL
                DELETE FROM [${core}].ConversationDetailArtifact WHERE ConversationDetailID IN (SELECT ID FROM #details);

            IF OBJECT_ID('[${core}].AIAgentSession') IS NOT NULL
                UPDATE [${core}].AIAgentSession SET ConversationID = NULL WHERE ConversationID IN (SELECT ID FROM #conv);

            UPDATE [${core}].ConversationDetail SET ParentID = NULL WHERE ID IN (SELECT ID FROM #details);
            DELETE FROM [${core}].ConversationDetail WHERE ID IN (SELECT ID FROM #details);

            UPDATE conversation SET LastConversationID = NULL
            FROM [${core}].Conversation AS conversation
            WHERE conversation.ID IN (SELECT ID FROM #conv)
               OR conversation.LastConversationID IN (SELECT ID FROM #conv);

            IF OBJECT_ID('[${core}].ResourcePermission') IS NOT NULL
                DELETE FROM [${core}].ResourcePermission WHERE ResourceRecordID IN (SELECT ID FROM #conv) OR UserID IN (${userIds});

            DELETE FROM [${core}].Conversation WHERE ID IN (SELECT ID FROM #conv);

            IF OBJECT_ID('__mj_BizAppsCommon.Person') IS NOT NULL
                DELETE FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (${userIds});
            DELETE FROM [${core}].UserRole WHERE UserID IN (${userIds});

            -- Accounts an invite check made: the system user can't delete their notifications, so the purge does, with the rest of what hangs on them
            SELECT ID INTO #invitees FROM [${core}].[User] WHERE Email LIKE '%@${INVITEE_EMAIL_DOMAIN.replace(/'/g, "''")}';
            DELETE FROM [${core}].UserNotification WHERE UserID IN (SELECT ID FROM #invitees);
            DELETE FROM __mj_BizAppsCollaboration.ShareNotice WHERE RecipientUserID IN (SELECT ID FROM #invitees);
            DELETE FROM __mj_BizAppsCollaboration.ItemUse WHERE UserID IN (SELECT ID FROM #invitees);
            DELETE FROM __mj_BizAppsCollaboration.SpaceMember WHERE UserID IN (SELECT ID FROM #invitees);
            IF OBJECT_ID('__mj_BizAppsCommon.Person') IS NOT NULL
                DELETE FROM __mj_BizAppsCommon.Person WHERE LinkedUserID IN (SELECT ID FROM #invitees);
            DELETE FROM [${core}].UserRole WHERE UserID IN (SELECT ID FROM #invitees);
            DELETE FROM [${core}].UserApplication WHERE UserID IN (SELECT ID FROM #invitees);
            DELETE FROM [${core}].MagicLinkInviteRole WHERE InviteID IN (SELECT ID FROM [${core}].MagicLinkInvite WHERE Email LIKE '%@${INVITEE_EMAIL_DOMAIN.replace(/'/g, "''")}');
            DELETE FROM [${core}].MagicLinkInviteApplication WHERE InviteID IN (SELECT ID FROM [${core}].MagicLinkInvite WHERE Email LIKE '%@${INVITEE_EMAIL_DOMAIN.replace(/'/g, "''")}');
            DELETE FROM [${core}].MagicLinkInvite WHERE Email LIKE '%@${INVITEE_EMAIL_DOMAIN.replace(/'/g, "''")}';
            DELETE FROM [${core}].[User] WHERE ID IN (SELECT ID FROM #invitees);

${providerFilesPurgeSql(core, COLLABORATION_STORAGE_PROVIDER_ID)}
            DELETE FROM [${core}].FileStorageAccount WHERE ID = '${COLLABORATION_STORAGE_ACCOUNT_ID}';
            DELETE FROM [${core}].Credential WHERE Name IN ('Collaboration local directory', 'Collaboration Box Storage');
            DELETE FROM [${core}].FileStorageProvider WHERE ID = '${COLLABORATION_STORAGE_PROVIDER_ID}';
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
    const boxConfig = getBoxStorageConfig();
    if (boxConfig) {
        try {
            const boxStorage = new BoxFileStorage();
            await boxStorage.initialize(boxConfig);
            for (const row of stored.recordset as Array<{ ProviderKey: string | null }>) {
                if (row.ProviderKey) {
                    try {
                        await boxStorage.DeleteObject(row.ProviderKey);
                    } catch (deleteError) {
                        console.error(`Box storage cleanup could not delete ${row.ProviderKey}: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
                    }
                }
            }
        } catch (boxError) {
            console.error('Box storage cleanup during purge encountered an issue:', boxError);
        }
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
