---
'@mj-biz-apps/collaboration-core': minor
'@mj-biz-apps/collaboration-entities': minor
'@mj-biz-apps/collaboration-core-entities-server': minor
'@mj-biz-apps/collaboration-server': minor
'@mj-biz-apps/collaboration-ng': minor
---

Add nullable `TargetApplicationID` to `SpaceType` (dual-dialect SQL Server & PostgreSQL migrations and updated metadata/generated entity schemas) so space invites target the declared MJ Application with graceful Collaboration fallback (`CX-6`), and add first-class external IdP invite provisioning and server-verified seat resolution when `magicLink.enabled` is false (`CX-7`).
