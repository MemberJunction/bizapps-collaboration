# Building a database for Collaboration

How to get a working database, from empty, that the two integration harnesses pass on. Every step
below is needed on a database built from nothing.

## What you need

- A pnpm workspace with MemberJunction and the app repos side by side, from MJ's
  [`DEV_WORKSPACE_QUICKSTART.md`](https://github.com/MemberJunction/MJ/blob/next/guides/DEV_WORKSPACE_QUICKSTART.md):
  MJ, bizapps-common, bizapps-tasks and this repo, joined by `mj dev workspace`. MJ is on `next`, at its latest
  commit. Install and build **only from the parent folder**. Never run `pnpm install` in a member, and never link a
  package by hand.
- **bizapps-common with People field-level security on.** The world's checks (FLS3) need
  `EnableFieldLevelSecurity` on `MJ_BizApps_Common: People`. It is set in common's
  `metadata/entities/.entities.json` on the branch of bizapps-common pull request 186, and on no other branch yet. Use that
  branch, or the People checks stay red.
- SQL Server, and a database name that no other agent or running host uses.

Every command below runs with the environment naming that database (`DB_DATABASE`, and the
`CODEGEN_DB_USERNAME` / `CODEGEN_DB_PASSWORD` pair, which `mj migrate` requires). Use `node <MJ>/packages/MJCLI/bin/run.js`
when `mj` is not on the path of the member you are in.

## The order

1. **MemberJunction core**, from the MJ clone (MJ's `bootstrap-clean-db` skill has the reasons):
   `mj migrate`, then `mj codegen --skipfiles`, then `mj sync push --dir=metadata --ci`, then `mj codegen --skipdb`.
   Do not commit what this regenerates in MJ.
2. **bizapps-common, then bizapps-tasks:** `mj migrate --schema <schema> --dir ./migrations` in each
   (`__mj_BizAppsCommon`, `__mj_BizAppsTasks`).
3. **Common's People setting:** from bizapps-common, `mj sync push --dir=metadata --include=entities`. A full push of common
   failed on a record of its own ("Display Name cannot be null") until common fixed that record, and pushing only this directory
   works either way. The push writes `sync` blocks back into common's files; put them back as they were.
4. **This app's migrations:** `pnpm run mj:migrate`. `migrations/` holds one baseline, `B202610012101__v0.1.x__Baseline.sql`:
   the schema's DDL and, under CodeGen's banner, CodeGen's capture as the rows it left in MJ's metadata tables. Skyway applies a
   baseline only to a database with no history for the schema; a database that ran the earlier `V` files keeps them and takes
   only the `V` files added after the baseline. See [regenerating the baseline](#regenerating-the-baseline) below.
5. **This app's metadata, in one push:**

   ```bash
   mj sync push --dir=metadata
   node scripts/strip-sync-blocks.mjs
   ```

   If the push is refused `EXECUTE permission was denied on the object 'spCreateRowLevelSecurityFilter'`, the database's
   MJ_Connect is not db_owner and MJ's Developer permission row on Row Level Security Filters has no EXECUTE grants on its create
   and update procedures (an MJ gap, reported from PR 10): grant EXECUTE on the two procedures to `cdp_Developer` as CodeGen's
   login and push again. A second `mj sync push --dir=metadata` then reports nothing to do. `strip-sync-blocks.mjs` removes the `sync` blocks the push
   writes back and restores each file's final newline; `--check` fails if either is wrong (CI runs it).
6. **The example type's own table,** for a test database only. The board keeps its details in a table of its own, in a schema of
   its own, as an IsA child of Space; its baseline, `packages/ExampleSpaceTypes/migrations/B202610012201__v0.1.x__Baseline.sql`,
   holds CodeGen's output too:

   ```bash
   pnpm run mj:migrate:examples
   ```

7. **The test metadata:** `pnpm run mj:push:tests` pushes the two example entities' permissions and the categories of their own columns first
   (`metadata-tests/entity-permissions` and `metadata-tests/entity-fields`; the categories give each subtype's columns a section of their own in its form), then the harness's stub agent and three example space types
   (`metadata-tests/agents` and `metadata-tests/space-types`; see [reviewing the data](reviewing-the-data.md#the-test-agent)). The
   `extensions`, `subtypes` and `lifecycle` checks need the types. Then run `node scripts/strip-sync-blocks.mjs` again: it cleans
   `metadata-tests/` too.
8. **The sample world:** build the integration package, then purge and load, as
   [reviewing the data](reviewing-the-data.md#loading-it) says.

## Running the harnesses

- **Server:** `pnpm run test:integration:server`. It needs only the database, built through step 8.
- **Client:** `pnpm run test:integration:client`. It needs an MJAPI on the same database with this app's packages and the example types' `/server`
  entry loaded (their drivers, and the resolvers of the two subtype entities: [reviewing the data](reviewing-the-data.md#files) has the setting), started with the
  test agent's and the storage driver's entries imported (the start command is in [reviewing the data](reviewing-the-data.md#files) and [the test agent](reviewing-the-data.md#the-test-agent)), `MJ_API_KEY`, and `MJAPI_URL` or
  `GRAPHQL_PORT`. Pick a port outside the fetch specification's blocked list: Node's `fetch` refuses 4190, for one.
- Run each **from a purge and a fresh load, and then a second time** on that load.
- Unset the four `STORAGE_BOX_*` variables to store files in the local directory. A run against real Box storage depends on Box's
  latency and limits; report it on its own line.

## A database built before closing and reopening had their own authorization

Push `authorizations`, then `authorization-roles` (a full push does both, in order), run `pnpm run mj:migrate` for any
migration added since, and restart the host so it reloads its metadata. Until then every close and reopen is refused, and the world
loader stops at its first close.

## A database built with the old catch-all agent grants

An earlier version gave Space Participant five read grants whose filter was `(1 = 1)`: they let any client read every agent and every
search scope permission, other users' names included. Narrow, per-filter grants replace them. A long-lived database still holds the old ones, `mj sync push` never deletes, and
check `agent.AG10` fails while they remain. Remove them:

```sql
DELETE ep FROM __mj.EntityPermission ep
JOIN __mj.RowLevelSecurityFilter f ON f.ID IN (ep.ReadRLSFilterID, ep.CreateRLSFilterID, ep.UpdateRLSFilterID, ep.DeleteRLSFilterID)
WHERE f.Name = 'Collaboration: Agent Catalog';
DELETE FROM __mj.RowLevelSecurityFilter WHERE Name = 'Collaboration: Agent Catalog';
```

Then restart the host so it reloads its metadata. The narrow grants that replace them ship in `metadata/` (Agents In Reach, Agent
Scope Assignments, Scope Permissions For The Caller); push `row-level-security-filters` and then `entity-permissions`.

## Regenerating the baseline

A baseline is regenerated when a stage's schema is final and its `V` files are to be collapsed (PR 10's item 144). It needs two
databases no other session uses, built from empty as above:

1. **The stack:** steps 1, 2, 4 and 6 only, with the `V` files in place and no push of ours. Then, from the repo root, with the
   environment naming that database and CodeGen's login (`CODEGEN_DB_USERNAME` / `CODEGEN_DB_PASSWORD`; a login without VIEW
   DEFINITION sees no view, procedure, default or filtered-index definitions):

   ```bash
   node scripts/build-baseline.mjs --schema __mj_BizAppsCollaboration --out migrations --stamp <latest V stamp + 1 minute> --exclude-schemas __mj_BizAppsCollabExamples
   node scripts/build-baseline.mjs --schema __mj_BizAppsCollabExamples --out packages/ExampleSpaceTypes/migrations --stamp <same rule>
   ```

   `--exclude-schemas` names the schemas built on top of the one being baselined: the relationship between Spaces and Example
   Boards was written by the examples' migration and belongs in their baseline, which runs after ours. Two runs on the same
   database are byte-identical. Delete the `V` files and the old `B` file the new one replaces.
2. **The proof:** steps 1 and 2, then steps 4 and 6 with only the new `B` files, and
   `mj baseline compare --left <stack> --right <proof> --row-compare full --ignore '^flyway_schema_history$'` from the repo root
   with the environment naming either database. Timestamps, record changes and MJ's own run logs differ; our schema's objects and
   our rows in MJ's metadata tables must not. The proof database then continues with steps 3, 5, 7 and 8 and both harnesses.

Filters, permissions and JSONType settings are not in a baseline: they stay JSON under `metadata/` and come in with step 5.

