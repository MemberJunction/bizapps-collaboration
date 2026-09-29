# @mj-biz-apps/collaboration-integration-tests

Collaboration's integration checks, and the sample world they run against.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `runtime`.
- **Depends on:** Collaboration's `core`, `entities`, `core-entities-server` and `example-space-types` packages from the workspace; MJ's `core`, `core-entities`, `global`, `generic-database-provider`, `graphql-dataprovider`, `sqlserver-dataprovider`, `api-keys`, `storage`, `testing-integration`, `ai-agents`, `ai-core-plus`, `ai-engine-base` and `search-engine`; bizapps-common's and bizapps-tasks' entity packages; and `mssql`.

## What's in it

**Check bundles.** Each check registers on MJ's `IntegrationCheckRegistry`, and each bundle registers a `Setup` and a `Teardown`. A `Teardown` removes what its checks created, and fails the run when it can't.

| Bundle | Server checks | Client checks | What it covers |
|---|---|---|---|
| `collab-world` | 3 | 3 | The world loaded as the catalog says |
| `people-fls` | 3 | 3 | What a participant reads of People |
| `parent-assignees` | 6 | 6 | Assigning people seated above a space, with the switch on and off |
| `room` | 12 | 11 | A space's conversations: who reads and starts them, posting, agent replies, and close and reopen |
| `write-gates` | 10 | 8 | The gates on spaces, seats, items, share notices and item uses, invitations and a change of type |
| `extensions` | 12 | none | The example types' drivers, and `Children` rules (EX1 to EX12) |
| `row-filters` | 4 | 4 | What each persona reads |
| `library` | 6 | 8 | The seeded items, uploads and deletes |
| `agent` | 10 | 7 | The agent's bounded retrieval, its search scope, and turns on the stub agent |
| `features` | 5 | 5 | Space styling, tasks as items, message history and nesting |
| `lifecycle` | none | 3 | A close with no access after it: who keeps the row and can reopen it, a closed parent's seats, and `GetCloseConsequence` (LC1 to LC3) |

- **Server bundles** (`src/checks/`, entry `src/index.ts`) run in process with Collaboration's server classes loaded.
- **Client bundles** (`src/checks/client/`, entry `src/client-index.ts`, exported as `./client`) run over GraphQL. They load no server package. `src/persona-provider.ts` signs in as each persona with a user API key it creates.
- `src/expected-bundles.ts` holds the expected counts. `scripts/assert-check-count.mjs` reads it to fail a run that ran fewer checks.
- `src/wire.ts` and `src/entity-names.ts` hold the helpers and entity names the checks share.
- The repo's `mj.config.cjs` points `testing.checkModules` at this package. `metadata-tests/` holds the stub agent and the example space types the checks need (`pnpm run mj:push:tests`), and `mj test` suite records for eight of the server bundles (COL-00 to COL-07; not `extensions`, `features` or `lifecycle`).
- `src/agents/` is the stub agent's driver, **Space Chat Test Stub**, so agent turns need no model key.

**The sample world,** `COLLAB-WORLD` (`src/world/`):
- the catalog is CSV under `src/world/data/`: 13 personas, 15 spaces, 30 seats, 15 files and two space types of the world's own;
- `load-world.ts` loads it through the entity gates, and `purge-world.ts` deletes only its own rows;
- `seed-plan.ts` adds a small task plan, and `seed-files.ts` stores the world's files in a local directory storage account (`local-directory-storage.ts`, `local-storage-account.ts`).

[`docs/reviewing-the-data.md`](../../docs/reviewing-the-data.md) describes the people and spaces, and how to load the world.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-integration-tests run build
pnpm --filter @mj-biz-apps/collaboration-integration-tests test
```

The build compiles the example types' server entry, runs `tsc`, then copies the world's CSV into `dist/`. The unit tests use Vitest, 52 in all:
- `registry-parity.test.ts` and `client-parity.test.ts`: each entry registers exactly the expected bundles, checks and lifecycles, and the client entry loads no server class;
- `cleanup-reporting.test.ts`: a check reports its own error before its clean-up's, and a failed clean-up fails the check.

**Running the checks** needs a database with Collaboration's migrations, its metadata, the test metadata and the world loaded ([building the database](../../docs/building-the-database.md)). The client checks also need a running MJAPI with Collaboration's server package loaded, started with the stub agent's and the storage driver's entries imported, plus `MJ_API_KEY`, and `MJAPI_URL` or `GRAPHQL_PORT` ([running the harnesses](../../docs/building-the-database.md#running-the-harnesses)). Run each harness from a purge and a fresh load, then again on that load. From the repo root:

```bash
pnpm run test:integration:server
pnpm run test:integration:client
pnpm run test:integration          # both
```

`node test-harnesses/integration.mjs <bundle>` runs one server bundle, without the count assertion.

## Not done yet

- A check for every gate's accepting side, for tasks, invitations, share notices, item uses and band promotion. Some exist (WG6, WG8); the plan lists the rest.
- The agent turns run on the stub agent, not a model.
- The subtype path (an example type's own table as an IsA child of Space) isn't exercised end to end yet; PR 9 adds it (the plan's D42).
