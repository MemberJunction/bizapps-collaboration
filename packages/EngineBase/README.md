# @mj-biz-apps/collaboration-engine-base

Collaboration's metadata engines: `CollaborationEngineBase` holds the space types, the role types and the app's settings, which every seated person reads; `CollaborationAdminEngineBase` holds the authorization catalog and the agents, skills and knowledge sources set for the app or a type, which only staff read. Each is loaded once and read without a round trip.

- **Layer:** `runtime` (L0). It runs in the browser and on the server.
- **Depends on:** `collaboration-core` and `collaboration-entities`. Peers: `@memberjunction/core`, `core-entities` and `global`.

## What's in it

**`CollaborationEngineBase`** (`src/CollaborationEngineBase.ts`), a MemberJunction `BaseEngine` (`CollaborationEngineBase.Instance`).
- **The caches.** `CollaborationEngineBase.Config()` loads the space types, their statuses (in sequence order), the role types (highest level first) and the application settings; `CollaborationAdminEngineBase.Config()` loads the authorizations and their role grants, and the grants the app and the types offer (`Space Grants` with no space). Each with `CacheLocal`; MemberJunction's entity events keep them current. MemberJunction loads an engine's entities all or nothing, so the split keeps a Space Participant, who reads none of the admin engine's rows, from losing the base engine too: the admin engine is then empty and `IsPermissionConstrained`, which its readers treat as none.
- **Lookups:** `SpaceTypeById`, `SpaceTypeByCode`, `SpaceRoleTypeById`, `SpaceRoleTypeByCode` and `GetApplicationSetting` on the base engine; `StatusById`, `StatusesForType`, `StatusByCode`, `DefaultStatusForType`, `FirstTerminalStatusForType`, `EffectiveStatusForSpace` and `StatusReachForSpace` for the statuses; `AuthorizationByName`, and `SpaceGrantsForType`, `AppGrantsOfKind` and `TypeGrantsOfKind` beside `AppSpaceGrants`, on the admin engine.
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
