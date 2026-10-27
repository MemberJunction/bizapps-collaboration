#!/usr/bin/env node
/**
 * Runs one .sql file against the database the environment names (DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD),
 * batch by batch on lines that are exactly GO, and prints what the server says. Exits non-zero on the first error, so
 * `scripts/persona-check.sql` (which THROWs on a failed assertion and rolls itself back) can gate CI:
 *
 *   node scripts/run-sql-file.mjs scripts/persona-check.sql
 */
import { readFileSync } from 'node:fs';
import sql from 'mssql';

const file = process.argv[2];
if (!file) {
    console.error('usage: node scripts/run-sql-file.mjs <file.sql>');
    process.exit(2);
}
const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, DB_TRUST_SERVER_CERTIFICATE } = process.env;
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
try {
    for (const batch of readFileSync(file, 'utf8').split(/^GO\s*$/m)) {
        if (!batch.trim()) continue;
        const request = pool.request();
        request.on('info', (info) => console.log(info.message));
        const result = await request.batch(batch);
        for (const rows of result.recordsets ?? []) if (rows.length) console.table(rows);
    }
    console.log(`${file}: OK`);
} catch (error) {
    console.error(`${file}: FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
} finally {
    await pool.close();
}
