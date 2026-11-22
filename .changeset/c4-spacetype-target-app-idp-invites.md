---
'@mj-biz-apps/collaboration-core': minor
'@mj-biz-apps/collaboration-entities': minor
'@mj-biz-apps/collaboration-core-entities-server': minor
'@mj-biz-apps/collaboration-server': minor
'@mj-biz-apps/collaboration-ng': minor
---

Add nullable `TargetApplicationID` to `SpaceType` (`ON DELETE SET NULL`, dual-dialect SQL Server & PostgreSQL migrations and updated metadata/generated entity schemas) so space invites target the declared MJ Application with graceful Collaboration fallback (`CX-6`), and add opt-in external IdP invite provisioning (`magicLink.idpInvites: true`, default off, enforcing `grantableRoleNames` on both paths) and server-verified seat resolution (`CX-7`).
