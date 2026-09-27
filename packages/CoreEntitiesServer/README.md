# @mj-biz-apps/collaboration-core-entities-server

The write gates and the server operations. Everything here runs only on the server.

- **Layer:** `runtime`.
- **In `mj-app.json`:** server, `library`. `@mj-biz-apps/collaboration-server` loads it.
- **Depends on:** `collaboration-core` and `collaboration-entities`. Peers: `@memberjunction/core`, `core-entities`, `global`, `notifications` and `storage`, and bizapps-tasks' `tasks-entities` and `tasks-entities-server`.

Reads are decided by row-level security in SQL. This package decides writes: each gate is a subclass of a generated entity class, and each check runs in `ValidateAsync`, so `Save()` returns false with the gate's message. The checks run for saves from GraphQL, MCP and server code alike.

## The gates on Collaboration's entities

Each is registered with `@RegisterClass(BaseEntity, '<entity name>')` and sets `DefaultSkipAsyncValidation` to false.

| Class | Entity | What it checks |
|---|---|---|
| `SpaceEntityServer` | Spaces | Who may create a root or a child, edit or move a space (`authorizeSpaceWrite`), and no cycles. Only staff may change `AllowParentAssignees` or `AgentRetrieval`; a new space takes both from its type. After a save it binds the space's room: an MJ conversation owned by the system user and scoped to the Collaboration application. |
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

A class registered later with a higher priority, or with no priority, would win the same key. `reportCollaborationClasses` logs which class holds each key at startup, and logs an error on the first save if Collaboration's class lost it.

## The operations

The GraphQL resolvers in `@mj-biz-apps/collaboration-server` call these:

- **`uploadSpaceFile`** (`upload-space-file.ts`): authorizes the caller first, stores the bytes as the system user in MJ Storage through `collaborationFileStore`, then saves the space item as the caller. If the item is refused, the stored object and its file row are removed. `decideUploadBand` picks the band the upload asks for.
- **`createSpaceTask`** (`create-space-task.ts`, `file-root-task.ts`): creates a root task of the `GENERAL` type and files it in a space as the caller's item. The task and its link are written as the system user. `removeUnfiledTask` cleans up when filing fails.
- **`postSpaceMessage`** (`post-space-message.ts`): posts a message to the room as the system user, naming the caller. The caller must be able to contribute, the space must be open, and the message must be 1 to 4,000 characters. With `executeAgent`, it also posts the assistant's reply.
- **`resolveSpaceAgentRetrieval`** (`space-agent-retrieval.ts`): lists what the agent may quote for a person asking from a space: the space's subtree, read as that person, then `agentMayQuote` on every candidate. It returns every decision and the spaces it searched.
- **`recordItemUse` and `recordShare`** (`library-events.ts`): write item uses, and one share notice per recipient with an in-app notification through `NotificationEngine`.

**Helpers:** `loadWriteContext` reads the rows a write needs (the target's ancestor chain, the caller's seats, the roles and the roster count) and refuses the write if a page comes back full. `requireSystemUser` and the functions in `uuid.ts` are shared by the rest.

Each gate has a `Load…EntityServer()` function, so a bundler can't drop it. `LoadBizAppsCollaborationServer` calls them all.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-core-entities-server run build
```

The build is `tsc`, into `dist/`. The tests use `node:test`, 48 in eight files: `load-graph`, `upload-space-file`, `collaboration-file-store`, `file-root-task`, `task-space`, `space-entity-server`, `space-agent-retrieval` and `space-item-entity-server`. The root `pnpm test` builds the package, typechecks the test files with `tsconfig.test.json`, and runs them.

## Not done yet

- **The agent run.** With `executeAgent`, the reply is a fixed sentence listing the names of the items the asker may quote. No model runs, and the GraphQL mutation never sets `executeAgent`; only the server harness does.
- **Retrieval at scale.** `resolveSpaceAgentRetrieval` reads at most 2,000 spaces and 2,000 items, and doesn't say when it hits that cap.
