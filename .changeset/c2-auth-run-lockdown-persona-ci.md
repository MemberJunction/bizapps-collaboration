---
"@mj-biz-apps/collaboration-core": patch
"@mj-biz-apps/collaboration-engine-base": patch
"@mj-biz-apps/collaboration-core-entities-server": patch
"@mj-biz-apps/collaboration-server": patch
---

Replace hardcoded role-name staff and invite-issuer checks in `mintSpaceLink` and `CollaborationEngineBase` with declarative MemberJunction Authorizations (`Issue Space Invite Links` and `Administer Spaces`), add the `check-no-role-name-auth.mjs` CI guard, update `task-space.test.ts` fixtures for `TaskEntityServer.ValidateAsync()`, lock down Space Participant writes to AI run/step/prompt-run entities outside active space chat turns (CT-7), and enable field-level security on `MJ: AI Agents` to omit `OwnerUser` and `OwnerUserID` for external Space Participants (CT-8).
