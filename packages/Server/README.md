# @mj-biz-apps/collaboration-server

The server bootstrap: the function MJAPI calls at startup, and the GraphQL resolvers.

- **Layer:** `runtime`.
- **In `mj-app.json`:** server, `bootstrap`, with `startupExport` `LoadBizAppsCollaborationServer`.
- **Depends on:** `collaboration-actions`, `collaboration-core`, `collaboration-core-entities-server`, `collaboration-entities` and `class-validator`. Peers: `@memberjunction/server`, `core`, `core-entities`, `global`, `generic-database-provider`, `storage`, `communication-engine` and `communication-types`, and `@mj-biz-apps/common-entities` (People are read directly).

## What's in it

**`src/index.ts`**
- Imports the entity and action packages, then the server gates, so the gates' subclasses replace the generated classes.
- `LoadBizAppsCollaborationServer()` calls each gate's `Load…` function, so none is tree-shaken.
- `RESOLVER_PATHS` lists the resolver files for the host's schema builder. Importing a resolver isn't enough for MJAPI to serve it.
- Also exports `mintSpaceLink`.

**The generated resolvers** (`src/generated/`, from CodeGen): read and write resolvers for the seven entities. Never edit them by hand.

**Five mutations,** each a thin resolver over an operation in `collaboration-core-entities-server` or `mint-space-link.ts`:

| Mutation | Input | What it does |
|---|---|---|
| `MintSpaceLink` | `SpaceID`, `Email`, `RoleID` | Seats a person by email. The seat is saved through the member gate, so the invitation ceiling, approval and cap apply. It creates the MJ user and Person when needed, grants `Space Participant`, and issues a one-use magic link of kind `app-session` for an Active seat. The link is emailed, returned to a host issuer, or withheld (see the host's `magicLink` settings in the root README). |
| `UploadSpaceFile` | `SpaceID`, `FileName`, `MimeType`, `Base64Data`, `Folder` | Stores the file and files it as a space item. Refuses a file over the cap: 10 MB, or `COLLABORATION_UPLOAD_MAX_BYTES` when set. |
| `OpenSpaceFile` | `itemId` | Loads the item and its file as the caller, records an `open` item use, and returns the bytes with the stored type and how the browser may show it. |
| `CreateSpaceTask` | `SpaceID`, `Name`, `Band` | Creates a root task and files it in the space. |
| `PostSpaceMessage` | `SpaceID`, `Text`, `ConversationID?`, `ExecuteAgent?` | Posts the caller's message to the space's room, optionally running the agent when requested or triggered. |

**`src/mint-space-link.ts`** holds the invitation logic behind `MintSpaceLink`. Its header says why the link is an app session rather than a resource share: access ends when the seat is removed.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-server run build
```

The build is `tsc`, into `dist/`. The package has no unit tests. The operations it calls are tested in `collaboration-core-entities-server`, and the client harness in `test-harnesses/` calls `UploadSpaceFile`, `CreateSpaceTask` and `PostSpaceMessage` over GraphQL.
