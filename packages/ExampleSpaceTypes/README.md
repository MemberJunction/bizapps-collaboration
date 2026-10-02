# The example space types

An example space type that exercises the extension model end to end: a board. It's what the integration checks and the UX gallery's frame 08 run against, and a starting point for an app that adds its own kind of space. (A deal room was the second example until the plan's call 16 removed it: a deal room is not a space type Collaboration offers out of the box.)

- **Private.** None of the three packages is published, and `mj-app.json` doesn't list them.
- **Three packages, split by tier,** the way an app that adds a kind of space ships them ([the extensibility plan's § 2](../../docs/EXTENSIBILITY_PLAN.md#2-the-model)). Each has one entry, its root, so a host's class manifest never imports another tier's code:

  | Folder | Package | Layer | Holds |
  |---|---|---|---|
  | `Entities/` | `@mj-biz-apps/collaboration-example-space-types-entities` | `runtime` | The subtype entity, `ExampleBoard` (CodeGen's). A process that reads and writes the subtype but must not run the server's rules imports this alone. |
  | `Server/` | `@mj-biz-apps/collaboration-example-space-types-server` | `runtime` | The server driver, and `RESOLVER_PATHS`, which names CodeGen's GraphQL resolvers for the entity, for MJAPI. |
  | `Angular/` | `@mj-biz-apps/collaboration-example-space-types-ng` | `widgets` | The UI driver, its tabs, cards and providers, a card for every space, and CodeGen's form for the entity. |

  The server and the client package import the entities package, so loading either registers the subtype.
- **The folder itself** holds what an app's root holds: `migrations/`, `codegen-schema-info.json` and `mj.config.cjs`.
- **Depends on:**
  - the entities package: MJ's `core` and `global`, and `zod`;
  - the server package: the entities package, Collaboration's `core`, `core-entities-server` and `entities`, MJ's `core` and `global`, and `class-validator`; peer: MJ's `server`, for the resolvers;
  - the client package: the entities package, Angular 21 (`common`, `core`, `forms`), Collaboration's `core`, `entities` and `ng-widgets`, and MJ's `core`, `core-entities`, `global`, `ng-base-forms`, `ng-base-types`, `ng-entity-viewer`, `ng-link-directives` and `ng-ui-components`.

## What's in it

The type itself is a row in `metadata-tests/space-types/`, with a second test type, `example-vault`, which names no driver, and a `deleteRecord` tombstone for the retired `example-room`; `pnpm run mj:push:tests` pushes them. Each type's rules and settings are in its `Configuration`, under `Extensions.<type code>`. The board names its own table as its subtype (`SpaceExtensionEntity`), so a board is created as that subtype, and one save writes both rows.

**The board**, for boards and committees:
- **Server driver** (`ExampleBoardServerDriver`, in `Server/src/board/`): refuses a close while motions are open and the delete of an open board, refuses a Compensation sub-space that inherits membership, caps outside directors, and lets an open board's quorum rise but not fall, refusing a change whose value it can't read. It narrows who may start a conversation to owners. It also declares the board's context for an agent's run (`BuildAgentContext`), which isn't called yet.
- **UI driver** (`ExampleBoardUIDriver`, in `Angular/src/board/`): the Meetings, Papers and Motions tabs, and the Next Meeting, Agenda, Active Vote and Members cards on the Overview, each a Shared card, since Frame 08 is an outside director's view. Its details form leaves out the next meeting's date and place, which the Next Meeting card shows. It also declares header chips and actions, a settings section, new-space steps and a hook for when a space opens, which the page doesn't show or call yet.
- **Providers** (`Angular/src/board/providers.ts`): needs-you items, agenda items and header chips. Nothing in the app calls the providers yet.

**`ExampleAnySpaceNoticeCard`** (`Angular/src/`) is a card another app could add to every space type.

**Its table.** `migrations/` holds one baseline, `B202610012201__v0.1.x__Baseline.sql`: the board's own table, `ExampleBoard`, in a schema of its own, `__mj_BizAppsCollabExamples`, with CodeGen's output for it (the file is built by `scripts/build-baseline.mjs` at the repo root; see `docs/building-the-database.md`). The board's row is keyed by its space's ID, and that key is a foreign key to `Space`. The keys don't cascade: MJ deletes a subtype's row through the subtype's own `Delete()`, so its permissions, its record changes and its driver all run; a test database that applied the migration before that change keeps keys that cascade until it's built again.
- The folder has its own CodeGen config (`mj.config.cjs`), which generates only that schema, into the three packages: the entity class into `Entities/src/generated/`, the resolvers into `Server/src/generated/` and the Angular form into `Angular/src/generated/`. `codegen-schema-info.json` declares the table an IsA child of Space. The config names the entities package as the entity package, so the resolvers and the form import the entity class from it, and the server package compiles nothing of the browser's.
- Each column the subtype adds has a category (`Board Details`, `Next Meeting`), set in `metadata-tests/entity-fields/`, so the form puts those columns in sections of their own (`boardDetails`, `nextMeeting`), apart from the space's `details`, and the space's screens show those sections alone. The board's UI driver hides the next meeting's two columns, so their section is left out and the screens show `Board Details` by itself; a section that mixed hidden and shown columns couldn't be shown, and the field list would be drawn instead. Push the categories before running CodeGen for the examples: it lays out the forms by them.
- Only a test database gets the schema. Apply it before `pnpm run mj:push:tests`, which pushes the entity's permissions and its columns' categories from `metadata-tests/entity-permissions/` and `metadata-tests/entity-fields/` (see [building the database](../../docs/building-the-database.md)):

  ```bash
  pnpm run mj:migrate:examples
  ```

- A host that shows the example type lists the server package in its MJAPI's `dynamicPackages.server` (which registers the driver, and whose `RESOLVER_PATHS` adds the resolvers, so the browser can save the entity), and the client package and the entities package in its Explorer's `dynamicPackages.client` (the UI driver, the form and the entity class). Its MJAPI depends on the server package and the entities package. No package is left out of a manifest, since no entry mixes tiers. [Reviewing the data](../../docs/reviewing-the-data.md) has the settings.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-example-space-types-entities run build   # tsc
pnpm --filter @mj-biz-apps/collaboration-example-space-types-server run build     # tsc, then the resolvers (tsconfig.resolvers.json)
pnpm --filter @mj-biz-apps/collaboration-example-space-types-ng run build         # ngc
pnpm --filter @mj-biz-apps/collaboration-example-space-types-server test
pnpm --filter @mj-biz-apps/collaboration-example-space-types-ng test
```

The root `pnpm run build` builds the three with the rest. The tests typecheck each package and run Vitest: 13 in the server package (`example-server-drivers.test.ts`) and 18 in the client package (`example-ui-drivers.test.ts`). The root `pnpm test` runs both. Against a database, the `extensions` checks (EX1 to EX12) run the server driver; they and the `subtypes` checks (ST1 to ST7) create boards through their subtype, and the client's `subtypes` checks (SC1 to SC4) create and edit boards over GraphQL. `ST5`, `ST7` and `SC4` run the quorum rule on a save of only the board's own column; `ST7` saves a board built on its own, as a client's save arrives.
