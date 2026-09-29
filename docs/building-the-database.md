# Building a database for Collaboration

How to get a working database, from empty, that the two integration harnesses pass on. Every step
below was needed on a database built from nothing; each workaround says why.

## What you need

- A pnpm workspace with MemberJunction and the app repos side by side, from MJ's
  [`DEV_WORKSPACE_QUICKSTART.md`](https://github.com/MemberJunction/MJ/blob/next/guides/DEV_WORKSPACE_QUICKSTART.md):
  MJ on `next`, bizapps-common, bizapps-tasks and this repo, joined by `mj dev workspace`. Install and build **only from the
  parent folder**. Never run `pnpm install` in a member, and never link a package by hand.
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
4. **This app's migrations:** `pnpm run mj:migrate`.
5. **A Create grant on row filters, in the database only.** A fresh MemberJunction database grants no role Create on
   `MJ: Row Level Security Filters`, and this app's push creates 35 of them. MemberJunction fixes this in
   [MJ#4837](https://github.com/MemberJunction/MJ/issues/4837); until that's in MJ `next`, grant it yourself, to the role the sync user holds. `mj sync push` runs as MemberJunction's system user, which holds Developer, UI and Integration; find the roles with `SELECT r.Name FROM __mj.[User] u JOIN __mj.UserRole ur ON ur.UserID = u.ID JOIN __mj.Role r ON r.ID = ur.RoleID WHERE u.Name = 'System'`. Developer is enough:

   ```sql
   UPDATE ep SET CanCreate = 1, CanUpdate = 1, CanDelete = 1
   FROM __mj.EntityPermission ep
   JOIN __mj.Entity e ON e.ID = ep.EntityID JOIN __mj.Role r ON r.ID = ep.RoleID
   WHERE e.Name = 'MJ: Row Level Security Filters' AND r.Name = 'Developer';
   ```
6. **This app's metadata, one directory at a time, in the order of `metadata/.mj-sync.json`'s `directoryOrder`.**
   A single `mj sync push --dir=metadata` fails on an empty database: the push reads authorizations, entity permissions and
   field-security flags from a cache it loads when it starts, so a rule that depends on a row created earlier in the same push
   sees nothing. Each directory's push commits, so the next one starts with a fresh cache. MemberJunction fixes this in
   [MJ#4836](https://github.com/MemberJunction/MJ/issues/4836); until that's in MJ `next`, push one directory at a time:

   ```bash
   for d in $(node -e "console.log(require('./metadata/.mj-sync.json').directoryOrder.join(' '))"); do
     mj sync push --dir=metadata --include="$d" || break
   done
   node scripts/strip-sync-blocks.mjs
   ```

   A second full `mj sync push --dir=metadata` then reports nothing to do. `strip-sync-blocks.mjs` removes the `sync` blocks the push
   writes back and restores each file's final newline; `--check` fails if either is wrong (CI runs it).
7. **The example types' own tables,** for a test database only. The board and the room keep their details in tables of their
   own, in a schema of their own, as IsA children of Space; the migration holds their CodeGen output too:

   ```bash
   mj migrate --schema __mj_BizAppsCollabExamples --dir packages/ExampleSpaceTypes/migrations
   ```

8. **The test metadata:** `pnpm run mj:push:tests` pushes the two example entities' permissions first
   (`metadata-tests/entity-permissions`), then the harness's stub agent and three example space types
   (`metadata-tests/agents` and `metadata-tests/space-types`; see [reviewing the data](reviewing-the-data.md#the-test-agent)). The
   `extensions`, `subtypes` and `lifecycle` checks need the types. Then run `node scripts/strip-sync-blocks.mjs` again: it cleans
   `metadata-tests/` too.
9. **The sample world:** build the integration package, then purge and load, as
   [reviewing the data](reviewing-the-data.md#loading-it) says.

## Running the harnesses

- **Server:** `pnpm run test:integration:server`. It needs only the database, built through step 9.
- **Client:** `pnpm run test:integration:client`. It needs an MJAPI on the same database with this app's packages loaded, started with the
  test agent's and the storage driver's entries imported (the start command is in [reviewing the data](reviewing-the-data.md#files) and [the test agent](reviewing-the-data.md#the-test-agent)), `MJ_API_KEY`, and `MJAPI_URL` or
  `GRAPHQL_PORT`. Pick a port outside the fetch specification's blocked list: Node's `fetch` refuses 4190, for one.
- Run each **from a purge and a fresh load, and then a second time** on that load.
- Unset the four `STORAGE_BOX_*` variables to store files in the local directory. A run against real Box storage depends on Box's
  latency and limits; report it on its own line.

## A database built before closing and reopening had their own authorization

Push `authorizations`, then `authorization-roles` (the loop in step 6 does both, in order), run `pnpm run mj:migrate` for any
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
