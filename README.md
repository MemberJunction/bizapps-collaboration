<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://github.com/MemberJunction/MJ/raw/main/MJ_logo_dark.png">
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/MemberJunction/MJ/raw/main/MJ_logo.webp">
    <img alt="MemberJunction" src="https://github.com/MemberJunction/MJ/raw/main/MJ_logo.webp" width="220">
  </picture>
</p>

<h1 align="center">BizApps Collaboration</h1>

<p align="center">
  Spaces for client, committee and cohort work, as a <a href="https://github.com/MemberJunction/MJ">MemberJunction</a> Open App.
</p>

<p align="center">
  <a href="#what-collaboration-is">What it is</a> &middot;
  <a href="#packages">Packages</a> &middot;
  <a href="#installing-it-on-a-host">Installing</a> &middot;
  <a href="#development">Development</a> &middot;
  <a href="#migrations-metadata-and-codegen">Migrations and metadata</a> &middot;
  <a href="#testing">Testing</a> &middot;
  <a href="#documents">Documents</a> &middot;
  <a href="#status">Status</a>
</p>

---

Collaboration is a free MemberJunction Open App. Its manifest is [`mj-app.json`](mj-app.json): the app `mj-bizapps-collaboration`, version 0.1.0, schema `__mj_BizAppsCollaboration`. Version 0.1 hasn't been released yet.

## What Collaboration is

**A space** is a bounded group of people, some of them from outside the firm, working on a bounded set of material. A client engagement, an association committee and a learning cohort are all spaces. What differs between them is a **space type**, which is a metadata row, not code.

**Spaces form a tree.** A root lasts as long as the relationship, such as a client. Sub-spaces hold the work inside it: engagements, workstreams, committees, cohorts. Closing a sub-space sets `ClosedAt`. The root stays open.

**Seats.** A seat (`SpaceMember`) puts one MJ user on one space with one role (`SpaceRoleType`). Staff and outside people sit on the same roster. The engine reads the role's flags, never its name:
- `CanInvite` and `MaxGrantableLevel`: who a member may invite, and at what level;
- `CanPromoteBand` and `CanSeeTeamBand`: see the bands below;
- `CanContribute`: may add and move material;
- `IsOwnerRole`: may change the space.

**Bands.** Every item in a space is on one of two bands:
- **Team:** the firm's working material. Only a role with `CanSeeTeamBand` sees it.
- **Shared:** everyone who reaches the space sees it.

Moving an item from Team to Shared is a promotion. It needs `CanPromoteBand`, and the item records who promoted it and when.

**Inherited or sealed sub-spaces.** A seat reaches its space and every sub-space below it that inherits membership (`InheritsMembership = 1`). A sealed sub-space (`InheritsMembership = 0`) is reached only by its own seats. The same walk runs in three places: `membershipReaches` in `packages/Core`, the server's write gates, and the SQL function `fnCollaborationAccess`.

**The library.** A space item (`SpaceItem`) points at any MJ record through `EntityID` and `RecordID`, such as a file, a task or a conversation. Each record is in at most one space. Files are uploaded through the `UploadSpaceFile` operation into MJ Storage. Opening a file records an item use. Sharing an item notifies the people who reach the space.

**Tasks** are bizapps-tasks tasks. A root task is filed in a space as an item, and its subtasks belong to the same space.

**The room.** Each space has one MJ conversation, linked to it by `LinkedEntityID` and `LinkedRecordID` and owned by the system user. Members post through the `PostSpaceMessage` operation. The `Space Participant` role can read the room but can't create conversation rows itself.

**The agent.** `metadata/` defines one agent for spaces, with its prompt, skills and search scope. The retrieval module that bounds what it may quote is in `packages/CoreEntitiesServer`. No model runs yet: the room's assistant reply is a fixed sentence (see [Status](#status)).

**Who reads what** is decided in SQL, by row-level security filters. Every read grant the `Space Participant` role holds has a filter, and MJ's `UI` role reads Collaboration's own entities through the same filters. Writes are checked by server subclasses of the entities. The rules are in [How Collaboration works](docs/HOW_THE_SYSTEM_WORKS.md).

## Packages

There are nine packages under `packages/`, plus the Playwright project in `e2e/`. Each package declares its layer in `mjUILayer`, and MJ's `ui-layers` check enforces the layers ([`.mj-standards.json`](.mj-standards.json)).

| Folder | npm name | Layer | In `mj-app.json` | What it holds |
|---|---|---|---|---|
| [`Core`](packages/Core/README.md) | `@mj-biz-apps/collaboration-core` | `runtime` (L0) | shared, library | The rules as pure functions, the view models and the extension contracts |
| [`Entities`](packages/Entities/README.md) | `@mj-biz-apps/collaboration-entities` | `runtime` (L0) | shared, library | The generated entity classes, the typed GraphQL client and the permission domain |
| [`Actions`](packages/Actions/README.md) | `@mj-biz-apps/collaboration-actions` | `runtime` | shared, library | CodeGen's action subclasses (none yet) |
| [`CoreEntitiesServer`](packages/CoreEntitiesServer/README.md) | `@mj-biz-apps/collaboration-core-entities-server` | `runtime` | server, library | The write gates and the server operations |
| [`Server`](packages/Server/README.md) | `@mj-biz-apps/collaboration-server` | `runtime` | server, bootstrap | `LoadBizAppsCollaborationServer` and the GraphQL resolvers |
| [`AngularWidgets`](packages/AngularWidgets/README.md) | `@mj-biz-apps/collaboration-ng-widgets` | `widgets` (L1, L2) | client, library | Angular widgets that work in any Angular app |
| [`Angular`](packages/Angular/README.md) | `@mj-biz-apps/collaboration-ng` | `surface` (L3) | client, bootstrap | `LoadBizAppsCollaborationClient`, the Explorer resource and the generated forms |
| [`UXGallery`](packages/UXGallery/README.md) | `@mj-biz-apps/collaboration-ux-gallery` | `shell` | not listed (private) | An Angular app that draws the design frames from fixtures, for the visual tests |
| [`IntegrationTests`](packages/IntegrationTests/README.md) | `@mj-biz-apps/collaboration-integration-tests` | `runtime` | not listed (private) | The integration check bundles and the sample world |

**The layers** follow MJ's UI layering guide:
- **L0** is TypeScript with no Angular.
- **L1 and L2** are widgets and composites. They never import `@angular/router`, `@memberjunction/ng-shared` or an Explorer package, and never navigate.
- **L3** is the only layer that touches Explorer.

The UI's own plan is [`docs/ux/IMPLEMENTATION_PLAN.md`](docs/ux/IMPLEMENTATION_PLAN.md).

## Installing it on a host

**Requirements,** from `mj-app.json`:
- MemberJunction `>=6.1.2 <7.0.0`;
- bizapps-common `>=5.46.0 <6.0.0` and bizapps-tasks `>=1.5.0 <2.0.0`;
- SQL Server. The access functions and the row-level security filters are T-SQL. PostgreSQL isn't supported yet, and there is no `migrations-pg/` folder.

**What a host gets:** the migrations under `migrations/`, and the npm packages the manifest lists. MJAPI loads `LoadBizAppsCollaborationServer`, and MJExplorer loads `LoadBizAppsCollaborationClient`. The host's own MJAPI and MJExplorer run the app; this repo ships no API or Explorer app of its own.

**Email invitations** need MJ's magic links. `MintSpaceLink` reads the host's `magicLink` settings:
- `enabled` must be true, and `Space Participant` must be in `grantableRoleNames`;
- leave `restrictedRoleName` as the host's own default, so other apps are unchanged;
- `communicationProvider` and `fromAddress` let it email the sign-in link;
- without an email channel, the raw link is returned only to an Owner-type user or to a role in `inviteIssuerRoleNames`. A space owner who is neither gets the seat and no link;
- `defaultExpiresInHours` sets the link's lifetime (72 when unset).

**Never give a space participant MJ's `UI` role.** Row-level security fails open for a user with any unfiltered grant on an entity, and `UI` carries many of them.

## Development

This is a pnpm 10 workspace: [`pnpm-workspace.yaml`](pnpm-workspace.yaml) lists `packages/*` and `e2e`. CI uses Node 22.

```bash
pnpm install --frozen-lockfile
pnpm run build            # every package under packages/
pnpm test                 # the unit tests (see Testing)
pnpm --filter @mj-biz-apps/collaboration-core run build   # one package
```

Add a dependency to the package's own `package.json`, then run `pnpm install` at the root. The published packages declare MJ as peer dependencies with caret ranges, and pin the exact version they build against (6.1.3 today) in `devDependencies`.

**Database settings** come from the environment, read by [`mj.config.cjs`](mj.config.cjs): `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_TRUST_SERVER_CERTIFICATE` and `MJ_CORE_SCHEMA`. The integration harnesses also read a `.env` at the repo root, then `../MJ/.env`.

## Migrations, metadata and CodeGen

**Migrations** are in `migrations/`, run by Skyway: one baseline (`B202609222230…Schema.sql`) and fifteen versioned files.
- A migration carries DDL (tables, columns, views, functions, constraints, extended properties) and the CodeGen output appended below it.
- Placeholders: `${flyway:defaultSchema}` for this app's schema and `${mjSchema}` for MJ core.
- Apply them with `pnpm run mj:migrate`, which runs `mj migrate --schema __mj_BizAppsCollaboration`.

**Metadata** rows are JSON under `metadata/`:
- the space types and role types;
- the `Space Participant` role and its application role, and the application with its nav item;
- entity permissions for the participant role and for MJ's `UI` role, and the field rules on People;
- the row-level security filters;
- the schema info, the resource type, the permission domain and the notification type;
- the agent, with its prompt, template, skills, search scope, query and query category.
- Push them while developing with `pnpm run mj:push` (`mj sync push --dir=metadata`).
- Don't commit `sync` blocks. `scripts/strip-sync-blocks.mjs` removes them.
- A migration never writes metadata rows. A feature pull request never writes a `*__Metadata_Sync.sql` either: the build engineer generates one for each release, from a clean database.

**CodeGen** is configured in `mj.config.cjs`. It generates only `__mj_BizAppsCollaboration` (`includeSchemas`), with entity names prefixed `MJ_BizApps_Collaboration: `. It writes the entity classes, the GraphQL resolvers, the Angular forms, the action subclasses and the schema JSON in `Schema Files/`. Never edit a `generated/` folder by hand.

**Upgrading MJ.** `Space Participant` gets an empty read (`1 = 0`) on the core entities that MJ's startup engines load. That list changes between MJ versions, so regenerate it on every upgrade:

```bash
node scripts/generate-core-permissions.mjs
pnpm run mj:push
```

## Testing

**Unit tests:** `pnpm test` runs 191 tests: 89 in Core, 48 in CoreEntitiesServer, 37 in IntegrationTests and 17 in AngularWidgets. Along the way it builds CoreEntitiesServer and IntegrationTests, and typechecks the CoreEntitiesServer test files.

**Integration checks** run against a real database with the migrations, the metadata and the sample world loaded. [`docs/reviewing-the-data.md`](docs/reviewing-the-data.md) describes the world and how to load it.
- **Server harness:** `pnpm run test:integration:server` runs `test-harnesses/integration.mjs`, in process, with the server classes loaded. Eight bundles, 38 checks.
- **Client harness:** `pnpm run test:integration:client` runs `test-harnesses/integration-client.mjs` over GraphQL, against a running MJAPI that has this app's server package loaded. It signs in as each persona with a user API key, and loads no server package itself. Eight bundles, 39 checks.
- `pnpm run test:integration` runs both. `scripts/assert-check-count.mjs` fails a run when fewer checks ran than `expected-bundles.ts` declares.
- `metadata-tests/` holds the `BizApps Collaboration Integration` suite records for `mj test`, and `mj.config.cjs` points `testing.checkModules` at the check package.

**Persona check:** [`scripts/persona-check.sql`](scripts/persona-check.sql) inserts fixtures for one participant, asserts what that person can see, and rolls back. Run it by hand against a database with the migrations and metadata.

**Visual test:** `pnpm run test:e2e` runs the Playwright spec in `e2e/specs/`. It serves the UX gallery and compares frame 02's chrome with `docs/ux/screens/02-space-overview.png`. The budget is 100 pixels on CI. The full-frame comparison is marked as an expected failure until slice A builds the frame's body.

**Standards and tokens:** `pnpm exec mj standards check` runs MJ's `ui-layers` check. `node scripts/check-mj-tokens.mjs` checks that every `--mj-*` token the packages use exists in MJ's token sheet.

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) installs, builds, runs the unit tests, the token check and the standards check, syntax-checks both integration harnesses, runs the visual test, and uploads `e2e/test-results/` as an artifact. It doesn't run the integration checks or the persona check, because it has no database.

## Documents

| Document | What it covers |
|---|---|
| [`plans/plan.md`](plans/plan.md) | The plan: the model, the security doctrine, the roadmap and the open decisions |
| [`docs/HOW_THE_SYSTEM_WORKS.md`](docs/HOW_THE_SYSTEM_WORKS.md) | The rules the rules module, the server and the database share |
| [`docs/EXTENSIBILITY_PLAN.md`](docs/EXTENSIBILITY_PLAN.md) | Space types as plug-ins, with chats, history and agents |
| [`docs/ux/README.md`](docs/ux/README.md) | The UX storyboard: fourteen frames and what each shows |
| [`docs/ux/IMPLEMENTATION_PLAN.md`](docs/ux/IMPLEMENTATION_PLAN.md) | How the UI is built: packages and layers, components, data, visual tests, order of work |
| [`docs/reviewing-the-data.md`](docs/reviewing-the-data.md) | The sample world's people and spaces |

## Status

**Built in this wave:**
- The seven entities (`SpaceType`, `Space`, `SpaceMember`, `SpaceRoleType`, `SpaceItem`, `ItemUse`, `ShareNotice`) and the access functions `fnCollaborationAccess`, `fnCollaborationTasks` and `fnCollaborationAncestorMembers`.
- The `Space Participant` role, with a row-level security filter on every entity it reads, field rules on People, and empty reads for the core entities the shell loads.
- The write gates for spaces, seats, items, item uses, share notices and bizapps-tasks' tasks, comments, decisions and assignments.
- Invitations by email link, the library (upload, open, promotion, share notices, item uses), tasks filed in spaces, and the room.
- The agent's metadata and its bounded retrieval module.
- Every metadata row moved out of the migrations into `metadata/` JSON.
- The tests: the unit tests, both integration harnesses, the persona check and the visual test.
- The new UI's first steps: the scaffold, the widgets package, the UX gallery, and frame 02's chrome matching its target on CI.

**Not built yet:**
- The agent run. The room's reply is a fixed sentence, and no model runs.
- The space page and its tabs. `CollaborationSectionResource` is an empty page for now; slice A builds frames 02 to 04.
- The extension points. `BaseSpaceTab`, `BaseSpaceOverviewCard` and the three provider classes in `collaboration-core` exist, but no code loads them yet.
- PostgreSQL.

What comes next, and in what order, is in [`plans/plan.md`](plans/plan.md).

## License

Not chosen. Distribution is free; the license is an open decision in the plan. Until it's settled, `mj-app.json` and the published packages say `UNLICENSED`, and the repo has no `LICENSE` file.
