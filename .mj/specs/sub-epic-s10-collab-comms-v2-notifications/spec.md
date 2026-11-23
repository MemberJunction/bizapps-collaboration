# Sub-Epic S10: Fan-Out-on-Read Space Notices, Comms v2 Notifications & Reach-Verified Scoped Digests

Engineering specification for Sub-Epic S10 in `MemberJunction/bizapps-collaboration` (trunk branch `next`, BUSL-1.1, 100% generic domain-neutral naming).

## Implemented Slices

### Slice 1 — CS-4 Fan-Out-on-Read Space Notices & Dual-Dialect Schema
- **Dual-Dialect Additive Schema (`migrations/` & `migrations-pg/`)**: `SpaceNoticeEvent`, `SpaceNoticeWatermark`, and `SpaceDigestCheckpoint` with composite `(EventTimestamp, ID)` ordering, unique per-member `(SpaceID, UserID)` watermarks, and matching RLS/permission metadata.
- **Pure Rules (`packages/Core/src/space-notices.ts`)**: Deterministic composite cursor comparison, newly joined member baseline (`MemberJoinedAt`), monotonic watermark progression, and Team/Shared band filtering.
- **Server Guards & `BaseRemotableOperation` RPCs (`packages/EngineBase/src/space-notices.ts`, `packages/CoreEntitiesServer/src/SpaceNotice*EntityServer.ts`)**: `Collaboration.PublishSpaceNoticeEvent` (`O(1)` single-row write), `Collaboration.GetSpaceNotices`, `Collaboration.GetSpaceUnreadNoticeCounts`, and `Collaboration.AdvanceSpaceNoticeWatermark`.

### Slice 2 — NT-1 Comms v2 Notification Routing & User Preference Enforcement
- **Typed NT-1 Contracts & Pure Evaluator (`packages/Core/src/notifications.ts`)**:
  - Covers all 6 NT-1 event types: `Mention`, `Reply`, `Share`, `StatusChanged`, `Task`, and `Approval` across channels `InApp`, `Email`, `SMS`, and `Chat`.
  - Evaluates master switch, MJ `UserNotificationType` defaults, `MJ: User Notification Preferences`, `Collaboration.NotificationPreferences` (`UserInfoEngine`), per-event subscriptions, muted spaces (with inherited ancestor propagation) and muted items, subtractive `AllowedChannels` ceilings, contact availability, and timezone-aware quiet hours (including overnight windows across midnight).
- **Batched Multi-Recipient Router & `BaseRemotableOperation` RPCs (`packages/EngineBase/src/notifications.ts`)**:
  - Zero N+1 lookups: batches `SpaceMembers`, `SpaceRoleTypes`, `MJ: Users`, `MJ: User Notification Types`, `MJ: User Notification Preferences`, and `MJ: User Settings` via `RunView` (`ResultType: 'simple'`, `ID IN (...)` / `UserID IN (...)`).
  - Reads/writes current-user preferences via `UserInfoEngine.Instance.GetSetting` / `SetSettingDebounced` + `FlushPendingSettings()` (zero `localStorage` / `sessionStorage`) with safe multi-user `RunView` / entity persistence fallback on the server.
  - Exposes `Collaboration.RouteNotifications`, `Collaboration.GetNotificationPreferences`, and `Collaboration.UpdateNotificationPreferences`.
- **MJ Comms v2 Transport Bridge (`packages/CoreEntitiesServer/src/comms-v2-notifications.ts`, `packages/Server/src/comms-v2-bridge.ts`)**:
  - `MJCommsV2NotificationTransport` routes preference-permitted notifications to `@memberjunction/notifications` (`NotificationEngine`) and `@memberjunction/communication-engine` (`CommunicationEngine`) via injectable transport and direct-message dispatcher hooks.

## Verification Gates
- Strict zero-`any` / zero-`unknown` / zero-`.Get()`/`.Set()` check: `node scripts/check-strict-types.mjs --self-test && node scripts/check-strict-types.mjs`
- Registered `@RegisterClass` exports, row caps, no role-name auth, downstream domain-neutral naming, metadata sync-block hygiene, and `mj standards check`: all green in `pnpm test` and CI.
