# @mj-biz-apps/collaboration-example-space-types-entities

The example space type's subtype entity, `ExampleBoard`, as CodeGen writes it for the examples' own schema. It's an IsA child of Spaces, so a space of the board type is created and saved as its subtype. Importing the package registers it.

- **Private.** It's never published, and `mj-app.json` doesn't list it.
- **Layer:** `runtime`, for the server and the browser.
- **Depends on:** MJ's `core` and `global`, and `zod`.
- **Build:** `pnpm --filter @mj-biz-apps/collaboration-example-space-types-entities run build` (`tsc`).

The example server and client packages import it. [The examples' README](../README.md) has the type, its table and how a host loads it.
