/**
 * GraphQL-wire dispatcher for Collaboration. Does not load *Server subclasses.
 *
 *   node test-harnesses/integration-client.mjs
 *   node test-harnesses/integration-client.mjs room
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

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
    'row-filters',
    'library',
    'agent',
];

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('-'));

const { bootstrapIntegrationClient } = await import('@memberjunction/testing-integration/client');
const { Metadata } = await import('@memberjunction/core');
const { IntegrationCheckRegistry } = await import('@memberjunction/testing-integration/registry');

await bootstrapIntegrationClient();
await import('../packages/IntegrationTests/dist/client-index.js');

const provider = Metadata.Provider;
const user = provider.CurrentUser;
if (!user) throw new Error('No CurrentUser — check MJ_API_KEY and MJAPI.');

const ctx = { User: user, Provider: provider, Schema: process.env.MJ_CORE_SCHEMA || '__mj', Storage: undefined };
const registry = IntegrationCheckRegistry.Instance;
const requested = only.length ? only : ALL_BUNDLES;
let pass = 0;
let fail = 0;

console.log(`\n  Collaboration integration CLIENT (GraphQL → ${process.env.MJAPI_URL ?? `http://localhost:${process.env.GRAPHQL_PORT ?? 4000}`})\n`);

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
            await lifecycle.Teardown(ctx).catch((e) => console.warn(`  teardown warn: ${e?.message}`));
        }
    }
}

const { cleanupPersonaProviders } = await import('../packages/IntegrationTests/dist/wire.js');
await cleanupPersonaProviders(ctx).catch((e) => console.warn(`  persona cleanup warn: ${e?.message}`));

console.log(`\n  ${pass} passed / ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
