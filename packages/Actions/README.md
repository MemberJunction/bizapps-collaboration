# @mj-biz-apps/collaboration-actions

CodeGen's action subclasses for Collaboration.

- **Layer:** `runtime`.
- **In `mj-app.json`:** shared, `library`.
- **Peers:** `@memberjunction/actions`, `@memberjunction/actions-base`, `@memberjunction/core` and `@memberjunction/global`.

## What's in it

`src/generated/action_subclasses.ts`, written by CodeGen. Never edit it by hand. Collaboration defines no actions yet, so the file holds only CodeGen's header and imports.

Hand-written server behavior lives in `@mj-biz-apps/collaboration-core-entities-server` and `@mj-biz-apps/collaboration-server`, so this package stays safe to load in a browser.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-actions run build
```

The build is `tsc`, into `dist/`. There are no tests.
