---
'@mj-biz-apps/collaboration-entities': patch
'@mj-biz-apps/collaboration-engine-base': patch
'@mj-biz-apps/collaboration-ng-widgets': patch
'@mj-biz-apps/collaboration-ng': patch
---

Collapse remaining unbatched `Promise.all([rv.RunView(...)])` and sequential `RunView` calls across `CollaborationEngineBase`, `CollaborationSpacePermissionProvider`, `space-meetings-data`, and `CollaborationSectionComponent` into single-request `rv.RunViews([...])` batches; add impersonation-safe active `ProviderToUse` tracking and user-switch cache eviction to `CollaborationEngineBase` and `CollaborationAdminEngineBase`; document the 5-Rule Performance Standard in `CLAUDE.md` and `AGENTS.md`.
