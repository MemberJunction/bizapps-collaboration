# @mj-biz-apps/collaboration-core-entities-server

The write gates and the server operations. Everything here runs only on the server.

- **Layer:** `runtime`.
- **In `mj-app.json`:** server, `library`. `@mj-biz-apps/collaboration-server` loads it.
- **Depends on:** `collaboration-core`, `collaboration-engine-base` and `collaboration-entities`. Peers: `@memberjunction/core`, `core-entities`, `global`, `notifications`, `storage`, `ai-agents`, `ai-core-plus` and `conversations-runtime`, and bizapps-tasks' `tasks-entities` and `tasks-entities-server`.

Reads are decided by row-level security in SQL. This package decides writes: each gate is a subclass of a generated entity class, and each check runs in `ValidateAsync`, so `Save()` returns false with the gate's message. The checks run for saves from GraphQL, MCP and server code alike.

## The gates on Collaboration's entities

Each is registered with `@RegisterClass(BaseEntity, '<entity name>')` and sets `DefaultSkipAsyncValidation` to false.

| Class | Entity | What it checks |
|---|---|---|
| `SpaceTypeEntityServer` | Space Types | *Configure Space Types* on create, update and delete; a valid `Configuration`; and a `SpaceExtensionEntity` that exists. |
| `SpaceEntityServer` | Spaces | Who may create a root or a child, edit or move a space (`authorizeSpaceWrite`), and no cycles. Settings need *Configure Spaces* and an owner seat. Closing and reopening need *Close and Reopen Spaces* and an owner seat; a close stamps the access after it and archives the space's conversations, and a reopen restores them. Only someone with *Administer Spaces* (UI, Developer and Integration by default) may create a root or move a space to the top level, change `AllowParentAssignees` or `AgentRetrieval`, or backdate a close; a new space takes both settings from its type. |
| `SpaceMemberEntityServer` | Space Members | The invitation ceiling (`refuseInvite`), the member cap, the last active owner, a member removing their own seat, an owner's approval under `InviteApproval = Approve`, and the seat's band from its role. A seat can't move to another space or person. |
| `SpaceItemEntityServer` | Space Items | The item rules and promotion stamp (`authorizeItemWrite`). A file item can only come from the upload. The signer must be able to read the record an item points at, and a subtask can't be filed at a space's root. `RecordID` is stored in MJ's canonical form. After a save that makes an item Shared, it writes the promotion's item use and the share notices. Its delete removes the item's uses and notices in the same transaction, then the stored file. |
| `ItemUseEntityServer` | Item Uses | A use is new, recorded as the caller, for an item in the space, on a band the caller can see (`authorizeUseWrite`). |
| `ShareNoticeEntityServer` | Share Notices | A notice is new, for an item in the space, to someone `shareRecipients` would tell (`authorizeNoticeWrite`). |

## The gates on bizapps-tasks' entities

The stamping and the root-task rule apply only when the caller holds `Space Participant`. The parent check and the assignment seat check apply to everyone.

| Class | Entity, priority | What it checks |
|---|---|---|
| `CollaborationTaskEntityServer` | Tasks, 100 | Extends bizapps-tasks' `TaskEntityServer`. A participant can't create a root task directly (a root is filed from the space), and their new task is stamped with their Person. When a saved task's parent changes, the task stays in its space, and a band change needs promote rights. |
| `TaskCommentEntityServer` | Task Comments, 2 | Stamps the author's Person on create. Only the author changes a comment. |
| `TaskDecisionEntityServer` | Task Decisions, 2 | Stamps the decider's Person on create. |
| `TaskAssignmentEntityServer` | Task Assignments, 2 | Stamps who assigned it on create. For a filed task, the assignee must hold a seat that reaches its space (`authorizeTaskAssignment`). |

Each gate also asks the space type's server driver (`BaseSpaceTypeServerDriver`, found through `ServerDriverRegistry`) before a save, tells it after, and notifies the lifecycle subscribers. A type that names a driver nobody registered refuses every write to its spaces. The drivers' message hooks, `ValidateMessage` and `OnMessagePosted`, aren't called yet: they wait for MemberJunction to record who wrote a message ([MJ#4789](https://github.com/MemberJunction/MJ/pull/4789)).

A class registered later with a higher priority, or with no priority, would win the same key. `reportCollaborationClasses` logs which class holds each key at startup, and logs an error on the first save if Collaboration's class lost it.

## The operations

The GraphQL resolvers in `@mj-biz-apps/collaboration-server` call these:

- **`uploadSpaceFile`** (`upload-space-file.ts`): authorizes the caller first, stores the bytes as the system user in MJ Storage through `collaborationFileStore`, then saves the space item as the caller. If the item is refused, the stored object and its file row are removed. `decideUploadBand` picks the band the upload asks for.
- **`createSpaceTask`** (`create-space-task.ts`, `file-root-task.ts`): creates a root task of the `GENERAL` type and files it in a space as the caller's item. The task and its link are written as the system user. `removeUnfiledTask` cleans up when filing fails.
- **`postSpaceMessage`** (`post-space-message.ts`): posts the caller's message to one of the space's conversations as the system user, which owns them. The caller must be able to contribute, the space must be open, an Internal Only conversation needs Team, and the message must be 1 to 4,000 characters. It runs no agent.
- **`createSpaceConversation`** (`create-space-conversation.ts`): starts a General, Topic or Internal Only conversation, under `Chats.WhoCanStart`, the seat's band and the type's driver, and syncs the seats' Edit grants.
- **`executeSpaceChatTurn`** (`execute-space-chat-turn.ts`): runs the space's agent on a saved message through MJ's `AgentRunner`, as the asking user, and writes the reply as the system user. The conversation's kind bounds what the reply may use.
- **`resolveSpaceChatHostRules`** (`resolve-space-chat-host-rules.ts`): the chat area's rules for a person in a space: allowed agents, reply mode, whom `@` offers, the history floor, and which conversations they may start.
- **`resolveCloseConsequence`** (`resolve-close-consequence.ts`): for someone who may close the space, what closing it would stamp, whose row it keeps, and whether they could reopen it (null when that couldn't be checked).
- **`resolveHomeCounts`** (`resolve-home-counts.ts`): Home's three counts for the signed-in person, across the spaces they reach, from the approved query *Collaboration Home Counts*. The query's one Query Permission is Integration's, since an MJ query isn't bound by row filters and takes whatever `UserID` it's given, so this runs it as the system user, with the person's own id.
- **`EnsureSpaceForRecord`** (`ensure-space-for-record.ts`): finds, or creates on the first call, the space of a given type anchored to another app's record.
- **`resolveSpaceAgentRetrieval`** (`space-agent-retrieval.ts`): lists what the agent may quote for a person asking from a space: the space's subtree, read as that person, then `agentMayQuote` on every candidate. It returns every decision and the spaces it searched.
- **`recordItemUse` and `recordShare`** (`library-events.ts`): write item uses, and one share notice per recipient with an in-app notification through `NotificationEngine`.

**Helpers:** `loadWriteContext` reads the rows a write needs (the target's ancestor chain, the caller's seats, the roles and the roster count) and refuses the write if a page comes back full. `requireSystemUser` and the functions in `uuid.ts` are shared by the rest.

**`CollaborationEngine`** (`CollaborationEngine.ts`) is the server's engine. It passes through to `CollaborationEngineBase` from `collaboration-engine-base` for the cached metadata and the rights, and adds the server's reads: a space's settings chain and the access a close stamps.

Each gate has a `Load…EntityServer()` function, so a bundler can't drop it. `LoadBizAppsCollaborationServer` calls them all but `LoadSpaceTypeEntityServer`; importing the package registers that gate anyway.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-core-entities-server run build
```

The build is `tsc`, into `dist/`. The tests use `node:test`, in twenty-one files, among them the gates (`space-entity-server`, `space-member-entity-server`, `space-item-entity-server`), the drivers (`server-driver-registry`, `delete-driver`, `reactions`), the chat (`execute-space-chat-turn`, `resolve-space-chat-host-rules`, `room-edit-grants`) and `resolve-close-consequence`. The root `pnpm test` builds the package, typechecks the test files with `tsconfig.test.json`, and runs them.

## Not done yet

- **Retrieval at scale.** `resolveSpaceAgentRetrieval` reads at most 2,000 spaces and 2,000 items, and refuses when a page comes back full rather than answer from part of it.
- **Bounding by participants.** The agent's search is bounded by the conversation's kind, not yet by the reach of everyone in it (the plan's D2).
