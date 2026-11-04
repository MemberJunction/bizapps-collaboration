#!/usr/bin/env node
/**
 * Ingests the Space files uploaded before uploads were wired into the content pipeline (U2) into the "Space files"
 * Upload source, so search and the space agent can read them. Run once per environment, after the migration and the
 * metadata push, against the database the environment names (DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD):
 *
 *   node scripts/backfill-space-files.mjs
 *
 * Idempotent: a file already ingested is counted and skipped, so a second run changes nothing. Exits non-zero when any
 * file failed to ingest.
 */
import sql from 'mssql';
import { WellKnownUserSource } from '@memberjunction/core';
import { setupSQLServerClient, SQLServerProviderConfigData } from '@memberjunction/sqlserver-dataprovider';
import { UserCache } from '@memberjunction/generic-database-provider';
import { LoadGeneratedEntities as LoadCommonEntities } from '@mj-biz-apps/common-entities';
import { LoadGeneratedEntities as LoadTaskEntities } from '@mj-biz-apps/tasks-entities';
import { loadModule as LoadCollabEntities, LoadCollaborationPermissionProvider } from '@mj-biz-apps/collaboration-entities';
import { backfillSpaceFiles, LoadSpaceEntityServer, LoadSpaceItemEntityServer } from '@mj-biz-apps/collaboration-core-entities-server';

LoadCommonEntities();
LoadTaskEntities();
LoadCollabEntities();
LoadCollaborationPermissionProvider();
LoadSpaceEntityServer();
LoadSpaceItemEntityServer();

const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, DB_TRUST_SERVER_CERTIFICATE, MJ_CORE_SCHEMA } = process.env;
if (!DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) {
    console.error('DB_DATABASE, DB_USERNAME and DB_PASSWORD must be set.');
    process.exit(2);
}
const pool = await new sql.ConnectionPool({
    server: DB_HOST ?? 'localhost',
    port: Number(DB_PORT ?? 1433),
    database: DB_DATABASE,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    requestTimeout: 120000,
    options: { encrypt: true, trustServerCertificate: DB_TRUST_SERVER_CERTIFICATE !== '0' && DB_TRUST_SERVER_CERTIFICATE !== 'false' },
}).connect();

let exitCode = 0;
try {
    const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, MJ_CORE_SCHEMA || '__mj'));
    await UserCache.Instance.Refresh(provider);
    const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!system) throw new Error('The system user is not available.');
    const result = await backfillSpaceFiles(provider, system);
    console.log(
        `Space files: ${result.totalItems} found, ${result.ingestedCount} ingested, ${result.alreadyIngestedCount} already ingested, ` +
            `${result.skippedMissingFileCount} skipped (file missing), ${result.failedCount} failed.`,
    );
    if (result.failedCount > 0) exitCode = 1;
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    exitCode = 1;
} finally {
    await pool.close();
}
process.exit(exitCode);
