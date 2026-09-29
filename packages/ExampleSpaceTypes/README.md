# @mj-biz-apps/collaboration-example-space-types

Two example space types that exercise the extension model end to end: a board and a deal room. They're what the integration checks and the UX gallery's frame 08 run against, and a starting point for an app that adds its own kind of space.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `widgets`.
- **Three entries:** `.` for the browser (the UI drivers and their components), `./server` for the server (the server drivers, a lifecycle subscriber and a signal provider), and `./resolvers` for a host's MJAPI (the GraphQL resolvers CodeGen writes for the two subtype entities).
- **Depends on:** Angular 21 (`common`, `core`), Collaboration's `core`, `core-entities-server`, `entities` and `ng-widgets`, MJ's `core`, `core-entities`, `global`, `ng-base-types` and `ng-ui-components`, `class-validator` and `zod`. Peer: MJ's `server`, for the resolvers.

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

**Their tables.** `migrations/` creates the board's and the room's own tables, `ExampleBoard` and `ExampleRoom`, in a schema of their own, `__mj_BizAppsCollabExamples`, followed by CodeGen's output for them. Each is keyed by its space's ID, and that key is a foreign key to `Space`.
- The package has its own CodeGen config (`mj.config.cjs`), which generates only that schema, into this package. `codegen-schema-info.json` declares both tables IsA children of Space. The entity classes and resolvers are in `src/generated/`.
- Only a test database gets the schema. Apply it before `pnpm run mj:push:tests`, which pushes the two entities' permissions from `metadata-tests/entity-permissions/` (see [building the database](../../docs/building-the-database.md)):

  ```bash
  mj migrate --schema __mj_BizAppsCollabExamples --dir packages/ExampleSpaceTypes/migrations
  ```

- A host that shows the example types loads `./resolvers` in its MJAPI, so the browser can save the two entities.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-example-space-types run build          # ngc, the browser entry
pnpm --filter @mj-biz-apps/collaboration-example-space-types run build:server   # tsc, the server entry
pnpm --filter @mj-biz-apps/collaboration-example-space-types run build:resolvers # tsc, the resolvers entry
pnpm --filter @mj-biz-apps/collaboration-example-space-types test
```

`build` and `build:server` don't build the resolvers entry; run `build:resolvers` for it. The tests typecheck the package and run Vitest, 45 tests in `example-space-types.test.ts`. The root `pnpm test` runs them too. Against a database, the `extensions` checks (EX1 to EX12) run the server drivers, and they and the `subtypes` checks (ST1 to ST3) create boards and rooms through their subtypes.

## Not done yet

The package has no Angular forms of its own for the two entities, so the space's screens draw their columns field by field (the extensibility plan's [§ 7](../../docs/EXTENSIBILITY_PLAN.md#7-isa-subtypes-and-their-forms)).
