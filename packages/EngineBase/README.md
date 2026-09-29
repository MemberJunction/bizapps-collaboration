# @mj-biz-apps/collaboration-engine-base

Collaboration's metadata engine: the space types, the role types, the app's settings, the Collaboration authorizations, and the agents, skills and knowledge sources set for the app or a type, loaded once and read without a round trip.

- **Layer:** `runtime` (L0). It runs in the browser and on the server.
- **Depends on:** `collaboration-core` and `collaboration-entities`. Peers: `@memberjunction/core`, `core-entities` and `global`.

## What's in it

**`CollaborationEngineBase`** (`src/CollaborationEngineBase.ts`), a MemberJunction `BaseEngine` (`CollaborationEngineBase.Instance`).
- **The caches.** `Config()` loads the space types, the role types (highest level first), the application settings, the authorizations and their role grants, and the space agents, skills and knowledge sources set for the app or a type, each with `CacheLocal`. MemberJunction's entity events keep them current.
- **Lookups:** `SpaceTypeById`, `SpaceTypeByCode`, `SpaceRoleTypeById`, `SpaceRoleTypeByCode`, `AuthorizationByName` and `GetApplicationSetting`, and `SpaceAgentsForType`, `SpaceAgentSkillsForType` and `SpaceKnowledgeSourcesForType` beside the app's own lists.
- **Settings.** `CollaborationSettings` reads the app's `CollaborationSettings` row and refuses one that's missing or doesn't validate (`MissingAppSettingsError`, `InvalidAppSettingsError`), so the defaults never stand in for it silently. `ResolveSettingsForSpace` resolves a space's settings from the space and its parents, its type and the app.
- **Rights,** through MemberJunction's Authorizations under the `Collaboration` root:
  - `UserCanConfigureSpaceTypes`: *Configure Space Types*.
  - `UserCanConfigureSpaces`: *Configure Spaces*, and an owner seat on the space when one is named.
  - `UserHoldsLifecycleAuthorization`, `UserCanCloseSpace` and `UserCanReopenSpace`: *Close and Reopen Spaces*, and an owner seat. A reopen finds the owner seat even when the space's access after close has ended.
  - `UserMayAdministerSpaces`: *Administer Spaces*, the rights beyond an owner's: a top-level space, the `AllowParentAssignees` and `AgentRetrieval` settings, a task for someone seated above its space, and backdating a close. UI, Developer and Integration hold it by default.
  - `FindCollaborationAuthorization` finds a child of the `Collaboration` root by name, and nothing outside it.
- **`ReachedSeat`:** the seat through which a person reaches a space, their own or one on an ancestor it inherits from, by the same walk as `membershipReaches` in `collaboration-core`.
- `COLLABORATION_APP_ID` and `COLLABORATION_SETTINGS_NAME`.

The server's `CollaborationEngine`, in `collaboration-core-entities-server`, passes through to this engine and adds the server's own reads.

## Build and test

```bash
pnpm --filter @mj-biz-apps/collaboration-engine-base run build
pnpm --filter @mj-biz-apps/collaboration-engine-base test
```

The build is `tsc`, into `dist/`. The tests use Vitest: `CollaborationEngineBase.test.ts` and `reached-seat.test.ts`, 18 in all. The root `pnpm test` runs them too.
