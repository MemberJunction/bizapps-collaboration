# Reviewing the data

The sample world is `COLLAB-WORLD`. The catalog is the CSV under `packages/IntegrationTests/src/world/data/`. People and spaces have fixed ids. A reload finds the same rows. A purge deletes only rows with those ids, matched by email for the people.

`ClosedAt` values `recent` and `past` are offsets from the moment of load: 7 days ago and 400 days ago. They are not calendar dates.

`MjRole` is the MemberJunction role. `staff` gets UI. Everyone else gets only Space Participant. Harbor owns a root, so Harbor is staff.

## People

| Key | Who | Where they belong |
| --- | --- | --- |
| ada | Staff owner | Owns Northwind, Delivery, the committee, the cohort, the closed spaces, and Studio |
| sam | Staff member | Northwind, Delivery, the committee, and Studio. Sam invites Pat |
| casey | Client admin | Seated on Northwind, so Discovery is inherited. Not seated on sealed Delivery |
| bea | Client member | Discovery, and the closed sub-spaces. Cannot invite |
| dana | Outside director | The audit committee only |
| lee, rio | Learners | The spring cohort |
| nora | Staff with no space | Nowhere |
| harbor | Sibling owner | Harbor only |
| harper | Harbor client | Harbor only |
| pat | Invited guest | Committee, status Invited. Approve has a row |
| remy | Removed guest | Discovery, status Removed. Grants nothing |

## Spaces

Northwind is the relationship root. Only staff and one client admin sit on it. Discovery inherits that roster. Delivery is sealed, so it does not: Ada is seated there as owner, then Sam. An owner has to take that seat before anyone else, and the loader must do it in that order.

Delivery's agent scope is `ExcludedFromParentScope`. `Closed last year` is `ExcludedEntirely`. The other spaces are `Included`.

`Closed this month` uses retention `Month` and a close date 7 days ago, so a former client is still inside the window. `Closed last year` uses `Month` and a close date 400 days ago, so the window has passed. `Closed indefinite` leaves `Retention` empty, so the workspace type default `Indefinite` applies.

Studio uses the world-owned type `world-workshop`: `AutoApprove` and a member cap of 3. Ada and Sam leave one seat free, so a non-owner invite can auto-approve before a later invite hits the cap. Its id is `E1000001-…`, not the next migration id.

Committee and Cohort retention stay `Year`, from metadata. The loader reads those rows and does not write them. `Cohort archive` is a child of the cohort, closed 400 days ago, with `Retention` empty, so the Year default is what the check reads.

Field notes sits under Discovery, so seeing it walks two steps. Delivery room sits under sealed Delivery: Sam reaches it, and Casey, who only sits on Northwind, does not.

The flag-ceiling role is not in this world. That check creates the role inside a transaction and rolls it back, so a staff member cannot grant Team visibility on a real host.

## Loading it

```bash
pnpm --filter @mj-biz-apps/collaboration-integration-tests run build
node --env-file=.env packages/IntegrationTests/dist/world/purge-world.js
node --env-file=.env packages/IntegrationTests/dist/world/load-world.js
```

The database in that env file must already have the Collaboration migrations, the metadata push, and bizapps-common (the whole procedure, from an empty database, is in [building the database](building-the-database.md)), because the loader creates a Person for every persona and throws if `MJ_BizApps_Common: People` is missing. Each Person stores `LinkedUserID`. Discovery also gets a small plan: a Shared root, a Team root, a subtask, a dependency, assignments for Ada and Bea, and a comment from each. The committee gets a Shared root used to prove a cross-space move is refused. A purge deletes the plan's activities, comments, assignments and tasks before it deletes People.

The system user writes the users, their MemberJunction roles, the People, and the world-owned space type. Each root is created by its owner, that owner is seated, then children are created. Pat's Invited seat is saved by Sam. Remy's seat is created and then removed by Ada in the same run. Ada is not given a seat on Discovery. The load reads the database back and throws if a space, seat, status, band, or MemberJunction role disagrees with the catalog. Each persona must have exactly the one role named in the catalog.

A seat that already exists is not rewritten. If Pat were left Active by an earlier run, the read-back throws instead of repairing the row. A suite that reloads the world purges first, then loads. The purge keeps the user accounts, because a signed-in persona owns MemberJunction rows that reference them, and deletes the spaces, seats, People, and role grants.

## Files

`files.csv` is the library. The loader stores each one through `uploadSpaceFile` and passes the sample account id. When configured with real Box cloud storage via four environment variables, the integration tests store files directly in a dedicated Box test folder:
- `STORAGE_BOX_CLIENT_ID`
- `STORAGE_BOX_CLIENT_SECRET`
- `STORAGE_BOX_ENTERPRISE_ID`
- `STORAGE_BOX_ROOT_FOLDER_ID`

When Box credentials are not set, tests fall back to local directory storage. For local directory storage, the bytes live in `.local-storage` at the repo root unless `COLLAB_STORAGE_ROOT` is set. The credential is not a default API key. A purge cleans up world sample files (in Box storage or the local directory) and deletes the test account and credentials, leaving the Box provider active.

The driver is in the integration package, not the published server. Build it, then start the private API from `MJ/packages/MJAPI` with that file imported:

```bash
pnpm --filter @mj-biz-apps/collaboration-integration-tests run build
cd ../MJ/packages/MJAPI
MJAPI_PUBLIC_URL=http://127.0.0.1:4117 \
  node --import ../../../bizapps-collaboration/packages/IntegrationTests/dist/world/local-directory-storage.js \
  --env-file=/tmp/collab-host/.env \
  --disable-warning=DEP0180 \
  --experimental-specifier-resolution=node \
  --import ./register.js ./src/index.ts
```

`MJAPI_PUBLIC_URL` is the API's own address, so a redeemed session is checked against this process. The Explorer for this host is `ng serve --configuration=collab --port 4217 --host 127.0.0.1` from `MJ/packages/MJExplorer`. Open http://127.0.0.1:4217/.

Three pieces of that host live outside this repository. None of the values below are secrets.

- **The env file** names the private database and sets `GRAPHQL_PORT` to `4117`. `MJAPI_PUBLIC_URL` on the process is `http://127.0.0.1:4117`.
- **`magicLink` in that host's `mj.config.cjs`:** `enabled: true`, `grantableRoleNames` includes `Space Participant`, and `provisioningGuard` stays `block` (MemberJunction's default). Leave `restrictedRoleName` as the host's own default. Do not add `UI` to `grantableRoleNames`.
- **The Explorer `collab` configuration:** GraphQL at `http://127.0.0.1:4117/` (or `http://localhost:4117/`), and the page on port `4217`. It is a local MemberJunction setting.

A browser check for this app ignores console lines from other apps the private Explorer still loads. Those are `MJ_BizApps_FPNA: Streams not found in metadata` and the `mjo-overview-cards` component-id collision. They are not this app.

Staff accounts hold `UI`, so a magic link is not issued for them. They use the host's Auth0 sign-in. That callback has to include port `4217`, or the staff half of a signed-in run uses an Explorer whose callback is already registered and whose API is this one.

| Key | Who uploads | Where | Band |
| --- | --- | --- | --- |
| brief | Ada | Discovery, folder Briefs | Team. A PDF |
| notes | Ada | Field notes, folder Notes | Team. Plain text |
| photo | Bea | Discovery, folder Photos | Shared. A PNG. Bea cannot see Team, so the gate lands it on Shared |
| welcome | Lee | Spring cohort, folder Welcome | Shared. The claim is `text/html`. It is stored as `text/plain` |

A Shared file writes a share notice for everyone who can see it except the uploader, and an item use of kind `upload`. A Team file writes the item use and no share notice. A second load finds the same file name in the space and reads the bytes back instead of storing them again.

## The test agent

The chat checks run their agent turns on the harness's own agent, **Space Chat Test Stub**, so they need no model key. It is a row in `metadata-tests/agents`, with its own ID, and its driver answers a turn from the items the turn allowed. Neither the loader nor a check changes a shipped row: the Collaboration Space Agent keeps its shipped `DriverClass` (none), and the world's own spaces answer with it. The stub's driver is in the integration package, not in a published one.

- **Push its row** once per database, after the app's metadata: `pnpm run mj:push:tests`.
- **A bundle attaches it.** The `room` and `agent` bundles add a Space Agent row for it on the Northwind root when they start (its children inherit it) and remove the row, then read back that it is gone, when they end. A message in those checks names it by mention, `@Space Chat Test Stub`.
- **The server harness** registers the driver itself, because it loads the integration package.
- **The client harness** talks to an MJAPI, and that process runs the turns. Start it with the driver's entry imported, as with the storage driver above: `--import <repo>/packages/IntegrationTests/dist/agents/index.js`. Without it a turn fails with an agent the server cannot build, and the check says which.

The sample world seats no account of its own. An automation login that walks the app is seated by that walk's own setup, configured from its environment, or the walk runs as the personas.

Conversations, the project plan, and committee governance rows join this catalog when those stores are seeded.
