# @mj-biz-apps/collaboration-server

The server bootstrap: the function MJAPI calls at startup, and the GraphQL resolvers.

- **Layer:** `runtime`.
- **In `mj-app.json`:** server, `bootstrap`, with `startupExport` `LoadBizAppsCollaborationServer`.
- **Depends on:** `collaboration-actions`, `collaboration-core`, `collaboration-core-entities-server`, `collaboration-entities` and `class-validator`. Peers: `@memberjunction/server`, `core`, `core-entities`, `global`, `generic-database-provider`, `storage`, `communication-engine` and `communication-types`, and `@mj-biz-apps/common-entities` (People are read directly).

## What's in it

**`src/index.ts`**
- Imports the entity and action packages, then the server gates, so the gates' subclasses replace the generated classes.
- `LoadBizAppsCollaborationServer()` calls the gates' `Load…` functions and `LoadSpaceSubtypeResolver`, so they aren't tree-shaken. It doesn't call `LoadSpaceTypeEntityServer` yet; importing the package registers that gate anyway.
- `RESOLVER_PATHS` lists the resolver files for the host's schema builder. Importing a resolver isn't enough for MJAPI to serve it.
- Also exports `mintSpaceLink`.

**The generated resolvers** (`src/generated/`, from CodeGen): read and write resolvers for the eleven entities. Never edit them by hand.

**Seven mutations and four queries,** each a thin resolver over an operation in `collaboration-core-entities-server` or `mint-space-link.ts`:

| Operation | Input | What it does |
|---|---|---|
| `CreateSpace` | `TypeID`, `Name`, `Description?`, `Details?` | Makes a top-level space of a type, through its subtype when the type names one, and seats the caller as its active owner on the Team band, in one transaction: a refusal of either leaves nothing behind. The space's own rules apply, so it needs `Administer Spaces`. `Details` is a JSON object of the subtype's own columns; any other name is refused. |
| `MintSpaceLink` | `SpaceID`, `Email`, `RoleID` | Seats a person by email. The seat is saved through the member gate, so the invitation ceiling, approval and cap apply. It creates the MJ user and Person when needed, grants `Space Participant`, and issues a one-use magic link of kind `app-session` for an Active seat. The link is emailed, returned to a host issuer, or withheld (see the host's `magicLink` settings in the root README). |
| `UploadSpaceFile` | `SpaceID`, `FileName`, `MimeType`, `Base64Data`, `Folder`, `Band?` | Stores the file and files it as a space item, in the band the person chose (Shared or Team; a band the seat cannot hold is refused), or the space type's default when none is chosen. Refuses a file over the cap: 10 MB, or `COLLABORATION_UPLOAD_MAX_BYTES` when set. |
| `CreateSpaceTask` | `SpaceID`, `Name`, `Band` | Creates a root task and files it in the space. |
| `PostSpaceMessage` | `SpaceID`, `Text`, `ConversationID?` | Posts the caller's message to one of the space's conversations, as the system user, which owns them. An Internal Only conversation needs a seat that sees Team. It runs no agent. |
| `CreateSpaceConversation` | `SpaceID`, `Name`, `Kind?` | Starts a conversation in the space: General (the default), Topic, or Internal Only (`Private`), under `Chats.WhoCanStart`, the seat's band and the type's driver. |
| `ExecuteSpaceChatTurn` | `SpaceID`, `ConversationID`, `UserMessageID`, `AgentID?` | Runs the space's agent on a saved message, as the asking user, and writes the reply. The conversation's kind bounds what the reply may use. |
| `GetSpaceChatHostRules` (query) | `spaceId`, `conversationId?` | The chat area's rules for this person here: the allowed agents and the default, the reply mode, whom `@` offers, the history floor, and whether they may start a conversation and of which kinds. |
| `GetCloseConsequence` (query) | `spaceId` | For someone who may close the space, what closing it would do: the access it would stamp, whose row it keeps, and whether they could reopen it. |
| `GetHomeCounts` (query) | none | Home's counts for the signed-in person, across the spaces they reach: the Shared files, the open tasks and the invitations waiting on an owner (each file and task counted once), from one approved query. Only the Integration role may run that query, so the server runs it as the system user, with the person's own id. |
| `GetHomeLists` (query) | none | The rows behind those counts, up to 50 of each: the invitations waiting (with their space, for a link to that space's People tab) and the open tasks (each once, under the first of the person's spaces by name). Two approved queries with the same rules as the counts, run the same way. |

**`src/mint-space-link.ts`** holds the invitation logic behind `MintSpaceLink`. Its header says why the link is an app session rather than a resource share: access ends when the seat is removed.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-server run build
```

The build is `tsc`, into `dist/`. Its `test` script runs `upload-limit.test.ts` (the upload cap), and so does the root `pnpm test`. The operations it calls are tested in `collaboration-core-entities-server`, and the client harness in `test-harnesses/` calls them over GraphQL.
