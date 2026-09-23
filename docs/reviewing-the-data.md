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

Committee and Cohort retention stay `Year`, from the migration. The loader reads those rows and does not write them. `Cohort archive` is a child of the cohort, closed 400 days ago, with `Retention` empty, so the Year default is what the check reads.

Field notes sits under Discovery, so seeing it walks two steps. Delivery room sits under sealed Delivery: Sam reaches it, and Casey, who only sits on Northwind, does not.

The flag-ceiling role is not in this world. That check creates the role inside a transaction and rolls it back, so a staff member cannot grant Team visibility on a real host.

## Loading it

```bash
pnpm --filter @mj-biz-apps/collaboration-integration-tests run build
node --env-file=.env packages/IntegrationTests/dist/world/purge-world.js
node --env-file=.env packages/IntegrationTests/dist/world/load-world.js
```

The database in that env file must already have the Collaboration migrations and bizapps-common, because the loader creates a Person for every persona and throws if `MJ_BizApps_Common: People` is missing. Each Person stores `LinkedUserID`.

The system user writes the users, their MemberJunction roles, the People, and the world-owned space type. Each root is created by its owner, that owner is seated, then children are created. Pat's Invited seat is saved by Sam. Remy's seat is created and then removed by Ada in the same run. Ada is not given a seat on Discovery. The load reads the database back and throws if a space, seat, status, band, or MemberJunction role disagrees with the catalog. Each persona must have exactly the one role named in the catalog.

A seat that already exists is not rewritten. If Pat were left Active by an earlier run, the read-back throws instead of repairing the row. A suite that reloads the world purges first, then loads. The purge keeps the user accounts, because a signed-in persona owns MemberJunction rows that reference them, and deletes the spaces, seats, People, and role grants.

## Files

`files.csv` is the library. The loader stores each one through `uploadSpaceFile` and passes the sample account id. Every other upload leaves the account to MemberJunction, which picks the host's active account. The sample provider is inactive, so a host that also has a cloud account does not pick this directory.

The bytes live in `.local-storage` at the repo root unless `COLLAB_STORAGE_ROOT` is set. The credential is not a default API key. A purge deletes the storage paths on the world's file rows, and leaves the rest of that directory alone. The suite's host keeps only this sample account, so those paths are the files. A host that also has a cloud account is outside this suite: the purge does not delete objects in that bucket.

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

`MJAPI_PUBLIC_URL` is the API's own address, so a redeemed session is checked against this process. The Explorer for this host is `ng serve --configuration=collab --port 4217 --host 127.0.0.1` from `MJ/packages/MJExplorer`. That configuration is a local MemberJunction setting: GraphQL on port 4117 and the page on port 4217. It is not in this repository. Open http://127.0.0.1:4217/. The Auth0 callback is registered for port 4201, so sign in with a magic link from this API.

| Key | Who uploads | Where | Band |
| --- | --- | --- | --- |
| brief | Ada | Discovery, folder Briefs | Team. A PDF |
| notes | Ada | Field notes, folder Notes | Team. Plain text |
| photo | Bea | Discovery, folder Photos | Shared. A PNG. Bea cannot see Team, so the gate lands it on Shared |
| welcome | Lee | Spring cohort, folder Welcome | Shared. The claim is `text/html`. It is stored as `text/plain` |

A Shared file writes a share notice for everyone who can see it except the uploader, and an item use of kind `upload`. A Team file writes the item use and no share notice. A second load finds the same file name in the space and reads the bytes back instead of storing them again.

Conversations, the project plan, and committee governance rows join this catalog when those stores are seeded.
