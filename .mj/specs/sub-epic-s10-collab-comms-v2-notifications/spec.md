# Sub-Epic S10: Fan-Out-on-Read Space Notices, Comms v2 Notifications & Reach-Verified Scoped Digests

Engineering specification for Sub-Epic S10 in `MemberJunction/bizapps-collaboration` (trunk branch `next`, BUSL-1.1, 100% generic domain-neutral naming).

## Implemented Slices

### Slice 1 — CS-4 Fan-Out-on-Read Space Notices & Dual-Dialect Schema
- **Dual-Dialect Additive Schema (`migrations/V202611231630__v0.2.x__Space_Notices_And_Watermarks.sql` & `migrations-pg/V202611231630__v0.2.x__Space_Notices_And_Watermarks.pg.sql`)**:
  - `SpaceNoticeEvent`: single-row-per-event (`O(1)` write amplification) with composite `(EventTimestamp, ID)` indexes (`IX_SpaceNoticeEvent_Space_EventTimestamp_ID`, `IX_SpaceNoticeEvent_Space_Band_EventTimestamp_ID`, `IX_SpaceNoticeEvent_EventTimestamp_ID`) and `Team`/`Shared` band constraints.
  - `SpaceNoticeWatermark`: unique per-member `(SpaceID, UserID)` monotonic read cursor `(LastReadEventTimestamp, LastReadEventID)`.
  - `SpaceDigestCheckpoint`: per-recipient `(UserID, SpaceID, Cadence)` keyset checkpoint (`LastDeliveredTimestamp`, `LastDeliveredRecordID`, `LastDeliveredAt`, `ItemsIncludedCount`, `Status` in `Active | Paused`).
  - Matching RLS filters (`Collaboration: Space Notice Events In Reach`, `Collaboration: Own Space Notice Watermarks`, `Collaboration: Own Space Digest Checkpoints`), UI/Participant permissions, and generated Angular forms/GraphQL schemas.
- **Pure Rules (`packages/Core/src/space-notices.ts`)**: Deterministic composite `(EventTimestamp, EventID)` cursor comparison with sub-millisecond `DATETIMEOFFSET(7)` / `TIMESTAMPTZ` precision, newly joined member baseline (`MemberJoinedAt`), monotonic watermark progression, and `Team`/`Shared` band filtering.
- **Server Guards & `BaseRemotableOperation` RPCs (`packages/EngineBase/src/space-notices.ts`, `packages/CoreEntitiesServer/src/SpaceNotice*EntityServer.ts`)**: `Collaboration.PublishSpaceNoticeEvent` (`O(1)` single-row write), `Collaboration.GetSpaceNotices`, `Collaboration.GetSpaceUnreadNoticeCounts`, and `Collaboration.AdvanceSpaceNoticeWatermark`.

### Slice 2 — NT-1 Comms v2 Notification Routing & User Preference Enforcement
- **Typed NT-1 Contracts & Pure Evaluator (`packages/Core/src/notifications.ts`)**:
  - Covers all 6 NT-1 event types: `Mention`, `Reply`, `Share`, `StatusChanged`, `Task`, and `Approval` across channels `InApp`, `Email`, `SMS`, and `Chat`, plus `Collaboration: Digest` preferences (`Enabled`, `Cadence`, `Channels`, `SpaceCadences`).
  - Evaluates master switch, MJ `UserNotificationType` defaults, `MJ: User Notification Preferences`, `Collaboration.NotificationPreferences` (`UserInfoEngine`), per-event subscriptions, muted spaces (with inherited ancestor propagation) and muted items, subtractive `AllowedChannels` ceilings, contact availability, and timezone-aware quiet hours (including overnight windows across midnight).
- **Batched Multi-Recipient Router & `BaseRemotableOperation` RPCs (`packages/EngineBase/src/notifications.ts`)**:
  - Zero N+1 lookups: batches `SpaceMembers`, `SpaceRoleTypes`, `MJ: Users`, `MJ: User Notification Types`, `MJ: User Notification Preferences`, and `MJ: User Settings` via `RunView` (`ResultType: 'simple'`, `ID IN (...)` / `UserID IN (...)`).
  - Reads/writes current-user preferences via `UserInfoEngine.Instance.GetSetting` / `SetSettingDebounced` + `FlushPendingSettings()` (zero `localStorage` / `sessionStorage`) with safe multi-user `RunView` / entity persistence fallback on the server.
  - Exposes `Collaboration.RouteNotifications`, `Collaboration.GetNotificationPreferences`, and `Collaboration.UpdateNotificationPreferences`.
- **MJ Comms v2 Transport Bridge (`packages/CoreEntitiesServer/src/comms-v2-notifications.ts`, `packages/Server/src/comms-v2-bridge.ts`)**:
  - `MJCommsV2NotificationTransport` routes preference-permitted notifications to `@memberjunction/notifications` (`NotificationEngine`) and `@memberjunction/communication-engine` (`CommunicationEngine`).

### Slice 3 — NT-2 Reach-Verified Keyset Scoped Digests
- **Pure Digest Assembly & Fail-Closed Reach Rules (`packages/Core/src/space-digests.ts`)**:
  - Deterministic composite `(EventTimestamp, ID)` ordering and monotonic keyset cursor progression (`sortNoticeEventsByCompositeKeyset`, `advanceCompositeKeysetCursor`).
  - Fail-closed per-item reach verification (`verifyDigestItemReachForRecipient`) evaluated at digest assembly time: re-verifies active space membership, inherited ancestor spaces, space status visibility (`Visible`), `Team`/`Shared` band reach, target `SpaceItem` / `SpaceChat` / `SpaceNote` existence & visibility, member join baseline, checkpoint cursor, muted spaces/items, and event subscriptions.
  - Strict empty-digest suppression (`EmptyDigest`): whenever zero reach-verified items remain after filtering, no digest payload is built and zero Comms v2 dispatches occur.
  - Sanitized plain-text digest summaries (`stripRawMarkdownSyntaxForDigest`) ensuring zero raw Markdown syntax leaks in rendered notifications, and monotonic checkpoint advancement (`computeNextDigestCheckpoint`) that never advances on failed dispatch.
- **Keyset Paging Engine & `BaseRemotableOperation` RPCs (`packages/EngineBase/src/space-digests.ts`, `packages/CoreEntitiesServer/src/CollaborationEngine.ts`)**:
  - `readEverySpaceNoticeEventKeyset`: traverses all eligible `SpaceNoticeEvent` records in a stable `[cursor, windowEnd]` window via `RunView` (`ResultType: 'simple'`, `OrderBy: 'EventTimestamp ASC, ID ASC'`, dual-dialect composite `(EventTimestamp, ID)` keyset predicate) — zero `OFFSET`/`FETCH` and zero silent row caps.
  - Batches all space hierarchy, status, membership, role, target item/chat/note, user, notification type/preference, user setting (`UserInfoEngine` overlay), and `SpaceDigestCheckpoint` lookups via `IN (...)` predicates with zero N+1 loops.
  - Exposes `Collaboration.RunScopedSpaceDigests`, `Collaboration.PreviewScopedSpaceDigest`, and `Collaboration.UpdateSpaceDigestCheckpoint` (`BaseRemotableOperation` subclasses retained by `LoadCollaborationDigestOperations()` and `LoadBizAppsCollaborationServer()`).

## Verification Gates
- Strict zero-`any` / zero-`unknown` / zero-`.Get()`/`.Set()` check: `node scripts/check-strict-types.mjs --self-test && node scripts/check-strict-types.mjs`
- Registered `@RegisterClass` exports, row caps (`check-row-caps`), no role-name auth (`check-no-role-name-auth`), downstream domain-neutral naming (`check-downstream-names`), metadata sync-block hygiene (`strip-sync-blocks --check`), dependency model (`check-dependency-model`), migration parity scripts, and `mj standards check`: enforced in `pnpm test` and `.github/workflows/ci.yml`.

## Critical User Journeys

### CUJ-1 — Space Member in a High-Fan-Out Space (CS-4)
1. An announcement or space event is published to a space with thousands of members.
2. A single `SpaceNoticeEvent` row is persisted (`O(1)` write amplification) without writing per-member notice copies.
3. The member opens the space notices feed (`Collaboration.GetSpaceNotices` / `Collaboration.GetSpaceUnreadNoticeCounts`) and sees the event as unread relative to their personal `SpaceNoticeWatermark` (or deterministic `MemberJoinedAt` baseline when no watermark exists yet).
4. The member marks notices read (`Collaboration.AdvanceSpaceNoticeWatermark`), monotonically advancing their personal `(LastReadEventTimestamp, LastReadEventID)` cursor without affecting other members.

### CUJ-2 — Collaborator with Custom Notification Preferences (NT-1)
1. The collaborator configures channel opt-outs, timezone-aware quiet hours, muted spaces/items, and event-type subscriptions stored via `UserInfoEngine` (`Collaboration.NotificationPreferences`) and `MJ: User Notification Preferences`.
2. Colleagues trigger `Mention`, `Reply`, `Share`, `StatusChanged`, `Task`, and `Approval` events.
3. NT-1 (`Collaboration.RouteNotifications`) batch-resolves preferences via `RunView` (`ResultType: 'simple'`, `ID IN (...)` / `UserID IN (...)`) and dispatches only permitted channels and event types via `MJCommsV2NotificationTransport` (`NotificationEngine` + `CommunicationEngine`), guaranteeing zero notifications on muted or opted-out channels and zero `localStorage`/`sessionStorage` usage.

### CUJ-3 — Digest Recipient Whose Space Access Changes (NT-2)
1. Multiple scoped collaboration items accumulate across multiple pages since the previous `SpaceDigestCheckpoint` window.
2. Before the scheduled digest runs, the user's membership or item-level access is revoked for a restricted space (or a Team-band item becomes unreachable).
3. NT-2 (`Collaboration.RunScopedSpaceDigests` / `Collaboration.PreviewScopedSpaceDigest`) traverses all candidate events via deterministic composite `(EventTimestamp, ID)` keyset pagination (`RunView` `ResultType: 'simple'`, zero `OFFSET`, zero silent row caps) and runs batched assembly-time reach verification per recipient and item.
4. All accessible items across every keyset page are included, revoked or unauthorized items are strictly excluded, outbound delivery is suppressed (`EmptyDigest`) if zero accessible items remain, and `SpaceDigestCheckpoint` advances monotonically only after Comms v2 dispatch succeeds.
