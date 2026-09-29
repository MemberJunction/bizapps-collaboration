/**
 * Server harness for Collaboration integration checks.
 *
 *   node test-harnesses/integration.mjs
 *   node test-harnesses/integration.mjs room
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import sql from 'mssql';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '.env'), quiet: true });
dotenv.config({ path: path.resolve(here, '../../MJ/.env'), quiet: true });

process.env.MJ_INTEGRATION_TEST = '1';
process.env.RUN_MUTATION_TESTS = process.env.RUN_MUTATION_TESTS ?? '1';

const ALL_BUNDLES = [
    'collab-world',
    'people-fls',
    'parent-assignees',
    'room',
    'write-gates',
    'extensions',
    'row-filters',
    'library',
    'agent',
    'features',
];

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('-'));

const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
const pool = await new sql.ConnectionPool({
    server: DB_HOST || 'localhost',
    port: Number(DB_PORT ?? 1433),
    database: DB_DATABASE,
    user: DB_USERNAME,
    password: DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: false },
    pool: { max: 10, min: 1 },
    requestTimeout: 60_000,
}).connect();

await import('../packages/IntegrationTests/dist/index.js');
const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { UserCache } = await import('@memberjunction/generic-database-provider');
const provider = await setupSQLServerClient(
    new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'),
);
await UserCache.Instance.Refresh(pool);
const user = UserCache.Users.find((u) => u?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
if (!user) throw new Error('No context user in UserCache.');

const { IntegrationCheckRegistry } = await import('@memberjunction/testing-integration');

const registry = IntegrationCheckRegistry.Instance;
const ctx = { User: user, Provider: provider, Pool: pool, Schema: process.env.MJ_CORE_SCHEMA || '__mj', Storage: undefined, UserCache };
const requested = only.length ? only : ALL_BUNDLES;
let pass = 0;
let fail = 0;

console.log(`\n  Collaboration integration SERVER (SQLServerDataProvider → ${DB_HOST}:${DB_PORT ?? 1433}/${DB_DATABASE})\n`);

for (const request of requested) {
    const [bundle, localId] = request.includes('.') ? request.split('.') : [request, null];
    const checks = registry.GetBundle(bundle).filter((c) => !localId || c.Id === request);
    if (!checks.length) {
        console.error(`  unknown: ${request}`);
        fail += 1;
        continue;
    }
    const lifecycle = registry.GetLifecycle(bundle);
    try {
        if (lifecycle) await lifecycle.Setup(ctx);
        for (const check of checks) {
            const t = Date.now();
            try {
                await check.Fn(ctx);
                console.log(`  ok   ${check.Id.padEnd(28)} ${Date.now() - t}ms  ${check.Name}`);
                pass += 1;
            } catch (err) {
                console.error(`  FAIL ${check.Id.padEnd(28)} ${Date.now() - t}ms  ${err instanceof Error ? err.message : String(err)}`);
                if (process.env.IT_VERBOSE === '1' && err instanceof Error) console.error(err.stack);
                fail += 1;
            }
        }
    } catch (err) {
        console.error(`  FAIL ${bundle}.<setup>             ${err instanceof Error ? err.message : String(err)}`);
        fail += 1;
    } finally {
        if (lifecycle) {
            try {
                await lifecycle.Teardown(ctx);
            } catch (e) {
                console.error(`  FAIL ${bundle}.<teardown>          ${e instanceof Error ? e.message : String(e)}`);
                fail += 1;
            }
        }
    }
}

await pool.close();
console.log(`\n  ${pass} passed / ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
