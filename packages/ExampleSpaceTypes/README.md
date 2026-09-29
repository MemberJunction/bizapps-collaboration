# @mj-biz-apps/collaboration-example-space-types

Two example space types that exercise the extension model end to end: a board and a deal room. They're what the integration checks and the UX gallery's frame 08 run against, and a starting point for an app that adds its own kind of space.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `widgets`.
- **Two entries:** `.` for the browser (the UI drivers and their components) and `./server` for the server (the server drivers, a lifecycle subscriber and a signal provider).
- **Depends on:** Angular 21 (`common`, `core`), Collaboration's `core`, `core-entities-server`, `entities` and `ng-widgets`, and MJ's `core`, `core-entities`, `global`, `ng-base-types` and `ng-ui-components`.

## What's in it

The types themselves are rows in `metadata-tests/space-types/`, with a third, `example-vault`, which names no driver; `pnpm run mj:push:tests` pushes them. Each type's rules and settings are in its `Configuration`, under `Extensions.<type code>`.

**The board** (`src/board/`), for boards and committees:
- **Server driver** (`ExampleBoardServerDriver`): refuses a close while motions are open and the delete of an open board, refuses a Compensation sub-space that inherits membership, and caps outside directors. It sets who may start a conversation to `Contributors`, which today allows the same seats as the default, so it narrows nothing yet. It also declares the board's context for an agent's run (`BuildAgentContext`), which isn't called yet.
- **UI driver** (`ExampleBoardUIDriver`): the Meetings, Papers and Motions tabs, and the Next Meeting, Agenda, Active Vote and Members cards on the Overview. It also declares header chips and actions, a settings section, new-space steps, a details form, a refusal to hold a deal room and a hook for when a space opens, which the page doesn't show or call yet.
- **Providers** (`providers.ts`): needs-you items, agenda items and header chips. Nothing in the app calls the providers yet.

**The deal room** (`src/room/`), a space for a record another app owns:
- **Server driver** (`ExampleRoomServerDriver`): anchors only to the entities its configuration names, holds no sub-spaces, and refuses to seat someone who opted out. Its `BuildAgentContext`, which gives an agent less when a buyer is in the conversation, isn't called yet, and neither are its message hooks, which wait for MemberJunction to record who wrote a message ([MJ#4789](https://github.com/MemberJunction/MJ/pull/4789)). Its `SyncSeats` passes through to the base, which isn't built.
- **UI driver** (`ExampleRoomUIDriver`): a deal summary card on the Overview, and a check before an invite. Its check before a message isn't called yet.
- **Lifecycle subscriber** and **signal provider** (`ExampleDealRoomLifecycleSubscriber`, `ExampleDealRoomSignalProvider`).

**`ExampleAnySpaceNoticeCard`** is a card another app could add to every space type.

**`migrations/`** creates the board's and the room's own tables, `ExampleBoard` and `ExampleRoom`, keyed by the space's ID, only for the examples. Nothing applies the migration yet, and its CodeGen output isn't in it: both come with subtypes (the plan's D42).

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-example-space-types run build          # ngc, the browser entry
pnpm --filter @mj-biz-apps/collaboration-example-space-types run build:server   # tsc, the server entry
pnpm --filter @mj-biz-apps/collaboration-example-space-types test
```

The tests typecheck the package and run Vitest, 44 tests in `example-space-types.test.ts`. The root `pnpm test` runs them too, and the `extensions` checks (EX1 to EX12) run the server drivers against a database.

## Not done yet

The two tables aren't declared as IsA subtypes of Space yet, and no type names them, so a space's own data isn't created, edited or shown through the space's screens. PR 9 finishes that (the plan's D42).
