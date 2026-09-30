# @mj-biz-apps/collaboration-example-space-types-ng

The example space types' browser side: the board's and the deal room's UI drivers, the board's tabs, cards and providers, the room's deal summary card, a card for every space (`ExampleAnySpaceNoticeCard`), and CodeGen's forms for the two subtype entities. A host lists it, with the example entities package, in its Explorer's `dynamicPackages.client`.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `widgets`.
- **Depends on:** the example entities package, Angular 21 (`common`, `core`, `forms`), Collaboration's `core`, `entities` and `ng-widgets`, and MJ's `core`, `core-entities`, `global`, `ng-base-forms`, `ng-base-types`, `ng-entity-viewer`, `ng-link-directives` and `ng-ui-components`.
- **Build:** `pnpm --filter @mj-biz-apps/collaboration-example-space-types-ng run build` (`ngc`).
- **Tests:** `pnpm --filter @mj-biz-apps/collaboration-example-space-types-ng test`, which typechecks the package and runs Vitest: 23 tests in `example-ui-drivers.test.ts`.

The UX gallery's frame 08 draws the example board from it. [The examples' README](../README.md) has what each driver does.
