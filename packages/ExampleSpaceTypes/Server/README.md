# @mj-biz-apps/collaboration-example-space-types-server

The example space type's server side: the board's server driver, and `RESOLVER_PATHS`, which names CodeGen's GraphQL resolvers for the subtype entity. MJAPI reads that export off every server package it loads, so a host that lists this package in `dynamicPackages.server` can save a board's own columns.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `runtime`.
- **Depends on:** the example entities package, Collaboration's `core`, `core-entities-server` and `entities`, MJ's `core` and `global`, and `class-validator`. Peer: MJ's `server`, for the resolvers.
- **Build:** `pnpm --filter @mj-biz-apps/collaboration-example-space-types-server run build` (`tsc`, then the resolvers through `tsconfig.resolvers.json`).
- **Tests:** `pnpm --filter @mj-biz-apps/collaboration-example-space-types-server test`, which typechecks the package and runs Vitest: 13 tests in `example-server-drivers.test.ts`.

[The examples' README](../README.md) has what the driver does and how a host loads the package.
