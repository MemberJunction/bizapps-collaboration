# @mj-biz-apps/collaboration-integration-tests

Collaboration's integration checks, and the sample world they run against.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `runtime`.
- **Depends on:** Collaboration's `core`, `entities` and `core-entities-server` packages from the workspace; MJ's `core`, `core-entities`, `global`, `generic-database-provider`, `graphql-dataprovider`, `sqlserver-dataprovider`, `api-keys`, `storage`, `testing-integration`, `ai-engine-base` and `search-engine`; bizapps-common's and bizapps-tasks' entity packages; and `mssql`.

## What's in it

**Check bundles.** Each check registers on MJ's `IntegrationCheckRegistry`, and each bundle registers a `Setup` and a `Teardown`. A `Teardown` removes what its checks created, and fails the run when it can't.

| Bundle | Server checks | Client checks | What it covers |
|---|---|---|---|
| `collab-world` | 3 | 3 | The world loaded as the catalog says |
| `people-fls` | 4 | 4 | What a participant reads of People |
| `parent-assignees` | 6 | 6 | Assigning people seated above a space, with the switch on and off |
| `room` | 6 | 6 | The room's binding, who can read it, and posting to it |
| `write-gates` | 5 | 5 | The gates on spaces, seats, items, share notices and item uses |
| `row-filters` | 4 | 4 | What each persona reads |
| `library` | 4 | 5 | The seeded items, uploads (client only) and deletes |
| `agent` | 6 | 6 | The agent's bounded retrieval and its search scope |

- **Server bundles** (`src/checks/`, entry `src/index.ts`) run in process with Collaboration's server classes loaded.
- **Client bundles** (`src/checks/client/`, entry `src/client-index.ts`, exported as `./client`) run over GraphQL. They load no server package. `src/persona-provider.ts` signs in as each persona with a user API key it creates.
- `src/expected-bundles.ts` holds the expected counts. `scripts/assert-check-count.mjs` reads it to fail a run that ran fewer checks.
- `src/wire.ts` and `src/entity-names.ts` hold the helpers and entity names the checks share.
- The repo's `mj.config.cjs` points `testing.checkModules` at this package, and `metadata-tests/` holds the matching suite records for `mj test`.

**The sample world,** `COLLAB-WORLD` (`src/world/`):
- the catalog is CSV under `src/world/data/`: 12 personas, 15 spaces, 29 seats, 5 files and one space type of the world's own;
- `load-world.ts` loads it through the entity gates, and `purge-world.ts` deletes only its own rows;
- `seed-plan.ts` adds a small task plan, and `seed-files.ts` stores the world's files in a local directory storage account (`local-directory-storage.ts`, `local-storage-account.ts`).

[`docs/reviewing-the-data.md`](../../docs/reviewing-the-data.md) describes the people and spaces, and how to load the world.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-integration-tests run build
pnpm --filter @mj-biz-apps/collaboration-integration-tests test
```

The build is `tsc`, then a copy of the world's CSV into `dist/`. The unit tests use Vitest, 37 in all:
- `registry-parity.test.ts` and `client-parity.test.ts`: each entry registers exactly the expected bundles, checks and lifecycles, and the client entry loads no server class;
- `local-directory-storage.test.ts`: the local storage writes and reads back a file, and refuses a path outside its directory.

**Running the checks** needs a database with Collaboration's migrations, its metadata and the world loaded. The client checks also need a running MJAPI with Collaboration's server package loaded. From the repo root:

```bash
pnpm run test:integration:server
pnpm run test:integration:client
pnpm run test:integration          # both
```

## Not done yet

- Checks for every gate's accepting side, for tasks, invites, share notices and item uses, and for band promotion, and a Playwright suite that signs in as each persona. The plan lists them.
- The agent checks test the retrieval module and its scope, not an agent run, since no model runs yet.
