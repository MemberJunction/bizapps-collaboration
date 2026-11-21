---
"@mj-biz-apps/collaboration-core": patch
"@mj-biz-apps/collaboration-engine-base": patch
"@mj-biz-apps/collaboration-core-entities-server": patch
"@mj-biz-apps/collaboration-server": patch
---

Replace hardcoded role-name staff and invite-issuer checks in `mintSpaceLink` and `CollaborationEngineBase` with declarative MemberJunction Authorizations (`Issue Space Invite Links` and `Administer Spaces`), add the `check-no-role-name-auth.mjs` CI guard, and update `task-space.test.ts` fixtures for `TaskEntityServer.ValidateAsync()` compatibility.
