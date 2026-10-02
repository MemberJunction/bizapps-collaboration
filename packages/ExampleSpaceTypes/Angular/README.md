# @mj-biz-apps/collaboration-example-space-types-ng

The example space type's browser side: the board's UI driver, its tabs, cards and providers, a card for every space (`ExampleAnySpaceNoticeCard`), and CodeGen's form for the subtype entity. A host lists it, with the example entities package, in its Explorer's `dynamicPackages.client`.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `widgets`.
- **Depends on:** the example entities package, Angular 21 (`common`, `core`, `forms`), Collaboration's `core`, `entities` and `ng-widgets`, and MJ's `core`, `core-entities`, `global`, `ng-base-forms`, `ng-base-types`, `ng-entity-viewer`, `ng-link-directives` and `ng-ui-components`.
- **Build:** `pnpm --filter @mj-biz-apps/collaboration-example-space-types-ng run build` (`ngc`).
- **Tests:** `pnpm --filter @mj-biz-apps/collaboration-example-space-types-ng test`, which typechecks the package and runs Vitest: 18 tests in `example-ui-drivers.test.ts`.

The UX gallery's frame 08 draws the example board from it. [The examples' README](../README.md) has what the driver does.
