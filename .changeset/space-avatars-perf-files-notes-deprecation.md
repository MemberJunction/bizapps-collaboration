---
"@mj-biz-apps/collaboration-entities": minor
"@mj-biz-apps/collaboration-engine-base": minor
"@mj-biz-apps/collaboration-core-entities-server": minor
"@mj-biz-apps/collaboration-server": minor
"@mj-biz-apps/collaboration-ng-widgets": minor
"@mj-biz-apps/collaboration-ng": minor
---

Add optional `Space.ImageURL` column (`V202611252359__v0.2.x__Space_ImageURL.sql`) and end-to-end Space Avatar Studio (`<mjc-space-avatar-studio>` with AI generation & iterative refinement to 128x128 WebP, Icon & Color picker, and Upload / URL) embedded in New Space Dialog and Space Settings, with `[ImageUrl]` rendering across all space surfaces (`mjc-type-tile`, header, rail, overview, home list, and home directory).

Add per-user memoized caching in `CollaborationEngineBase` (reachable spaces, caller memberships, and `ReachedSeat` with automatic reset on user change and explicit invalidation) and overhaul `CollaborationSectionComponent.selectSpaceBody()` to batch Stage-1/Stage-2 `RunViews`, deduplicate `Space` / `Space Items` / `Overview` message reads, and lazy-load tab-specific heavy data (`Work` assignees/dependencies, `Settings` anchors, `Chat` host rules and source receipts).

Rename the built-in `Library` tab label to `Files`, streamline `CollabSpaceLibraryComponent` (eliminate dead right grid column when drawer is closed, collapse single-collection rail with top Smart View pills, move upload disclosure behind a compact info toggle, and deduplicate workspace docs when a custom Docs Studio tab is present), deprecate `MJ_BizApps_Collaboration: Space Notes` in metadata, remove the legacy `Notes` tab, and replace remaining `"room"` search/filter strings in `SpaceMeetingsTabComponent`.
