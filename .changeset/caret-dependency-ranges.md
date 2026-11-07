---
"@mj-biz-apps/collaboration-actions": patch
"@mj-biz-apps/collaboration-ng": patch
"@mj-biz-apps/collaboration-ng-widgets": patch
"@mj-biz-apps/collaboration-core-entities-server": patch
"@mj-biz-apps/collaboration-engine-base": patch
"@mj-biz-apps/collaboration-entities": patch
"@mj-biz-apps/collaboration-server": patch
---

Dependency and peer ranges are caret floors at the version they pinned before (`^6.2.0-edge.7` for MemberJunction, `^3.25.76` for zod), so a host on a later release in the same major satisfies them instead of installing a second copy. The workspace still resolves the same versions: the `@memberjunction/*` override in `pnpm-workspace.yaml` holds MJ at 6.2.0-edge.7.
