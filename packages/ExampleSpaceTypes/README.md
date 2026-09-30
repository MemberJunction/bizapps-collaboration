# @mj-biz-apps/collaboration-example-space-types

Two example space types that exercise the extension model end to end: a board and a deal room. They're what the integration checks and the UX gallery's frame 08 run against, and a starting point for an app that adds its own kind of space.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `widgets`.
- **Four entries:** `.` for the browser (the UI drivers and their components, and CodeGen's forms for the two subtype entities), `./server` for the server (the server drivers, a lifecycle subscriber, a signal provider, and `RESOLVER_PATHS`, which names the resolvers entry for MJAPI), `./resolvers` for a host's MJAPI (the GraphQL resolvers CodeGen writes for the two subtype entities), and `./entities` for a process that reads and writes the subtypes but must not run the server's rules (the entity classes only).
- **Depends on:** Angular 21 (`common`, `core`, `forms`), Collaboration's `core`, `core-entities-server`, `entities` and `ng-widgets`, MJ's `core`, `core-entities`, `global`, `ng-base-forms`, `ng-base-types`, `ng-entity-viewer`, `ng-link-directives` and `ng-ui-components`, `class-validator` and `zod`. Peer: MJ's `server`, for the resolvers.

## What's in it

The types themselves are rows in `metadata-tests/space-types/`, with a third, `example-vault`, which names no driver; `pnpm run mj:push:tests` pushes them. Each type's rules and settings are in its `Configuration`, under `Extensions.<type code>`. The board and the room name their own tables as their subtype (`SpaceExtensionEntity`), so a space of either is created as that subtype, and one save writes both rows.

**The board** (`src/board/`), for boards and committees:
- **Server driver** (`ExampleBoardServerDriver`): refuses a close while motions are open and the delete of an open board, refuses a Compensation sub-space that inherits membership, and caps outside directors. It narrows who may start a conversation to owners. It also declares the board's context for an agent's run (`BuildAgentContext`), which isn't called yet.
- **UI driver** (`ExampleBoardUIDriver`): the Meetings, Papers and Motions tabs, and the Next Meeting, Agenda, Active Vote and Members cards on the Overview, each a Shared card, since Frame 08 is an outside director's view. Its details form leaves out the next meeting's date and place, which the Next Meeting card shows. It also declares header chips and actions, a settings section, new-space steps, a refusal to hold a deal room and a hook for when a space opens, which the page doesn't show or call yet.
- **Providers** (`providers.ts`): needs-you items, agenda items and header chips. Nothing in the app calls the providers yet.

**The deal room** (`src/room/`), a space for a record another app owns:
- **Server driver** (`ExampleRoomServerDriver`): anchors only to the entities its configuration names, holds no sub-spaces, and refuses to seat someone who opted out. Its `BuildAgentContext`, which gives an agent less when a buyer is in the conversation, isn't called yet, and neither are its message hooks, which wait for MemberJunction to record who wrote a message ([MJ#4789](https://github.com/MemberJunction/MJ/pull/4789)). Its `SyncSeats` passes through to the base, which isn't built.
- **UI driver** (`ExampleRoomUIDriver`): a deal summary card on the Overview, and a check before an invite. Its check before a message isn't called yet.
- **Lifecycle subscriber** and **signal provider** (`ExampleDealRoomLifecycleSubscriber`, `ExampleDealRoomSignalProvider`).

**`ExampleAnySpaceNoticeCard`** is a card another app could add to every space type.

**Their tables.** `migrations/` creates the board's and the room's own tables, `ExampleBoard` and `ExampleRoom`, in a schema of their own, `__mj_BizAppsCollabExamples`, followed by CodeGen's output for them. Each is keyed by its space's ID, and that key is a foreign key to `Space`. The keys don't cascade: MJ deletes a subtype's row through the subtype's own `Delete()`, so its permissions, its record changes and its driver all run; a test database that applied the migration before that change keeps keys that cascade until it's built again.
- The package has its own CodeGen config (`mj.config.cjs`), which generates only that schema, into this package. `codegen-schema-info.json` declares both tables IsA children of Space. The entity classes, the resolvers and the Angular forms are in `src/generated/`. The config names the `./entities` entry as the entity package, so the resolvers import only the entity classes, and neither server build compiles a file of the browser entry.
- Each column a subtype adds has a category (`Board Details`, `Next Meeting`, `Deal Details`), set in `metadata-tests/entity-fields/`, so each form puts those columns in sections of their own (`boardDetails`, `nextMeeting`, `dealDetails`), apart from the space's `details`, and the space's screens show those sections alone. The board's UI driver hides the next meeting's two columns, so their section is left out and the screens show `Board Details` by itself; a section that mixed hidden and shown columns couldn't be shown, and the field list would be drawn instead. Push the categories before running CodeGen for the package: it lays out the forms by them.
- Only a test database gets the schema. Apply it before `pnpm run mj:push:tests`, which pushes the two entities' permissions and their columns' categories from `metadata-tests/entity-permissions/` and `metadata-tests/entity-fields/` (see [building the database](../../docs/building-the-database.md)):

  ```bash
  pnpm run mj:migrate:examples
  ```

- A host that shows the example types lists `./server` in its MJAPI's `dynamicPackages.server` (which registers the drivers, and whose `RESOLVER_PATHS` adds the resolvers, so the browser can save the two entities) and `.` in its Explorer's `dynamicPackages.client` (the UI drivers and the forms). [Reviewing the data](../../docs/reviewing-the-data.md) has the settings.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-example-space-types run build          # ngc, the browser entry, then the resolvers entry
pnpm --filter @mj-biz-apps/collaboration-example-space-types run build:server   # tsc, the server and entities entries, then the resolvers entry
pnpm --filter @mj-biz-apps/collaboration-example-space-types test
```

Both builds make `dist/resolvers.js`. The tests typecheck the package and run Vitest, 45 tests in `example-space-types.test.ts`. The root `pnpm test` runs them too. Against a database, the `extensions` checks (EX1 to EX12) run the server drivers; they and the `subtypes` checks (ST1 to ST4) create boards and rooms through their subtypes, and the client's `subtypes` checks (SC1 to SC3) create and edit boards over GraphQL.
