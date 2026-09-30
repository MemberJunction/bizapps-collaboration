# @mj-biz-apps/collaboration-example-space-types-entities

The example space types' two subtype entities, `ExampleBoard` and `ExampleRoom`, as CodeGen writes them for the examples' own schema. They're IsA children of Spaces, so a space of either type is created and saved as its subtype. Importing the package registers them.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `runtime`, for the server and the browser.
- **Depends on:** MJ's `core` and `global`, and `zod`.
- **Build:** `pnpm --filter @mj-biz-apps/collaboration-example-space-types-entities run build` (`tsc`).

The example server and client packages import it. [The examples' README](../README.md) has the types, their tables and how a host loads them.
