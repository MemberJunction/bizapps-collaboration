---
"@mj-biz-apps/collaboration-core": minor
"@mj-biz-apps/collaboration-engine-base": minor
"@mj-biz-apps/collaboration-core-entities-server": minor
"@mj-biz-apps/collaboration-server": minor
---

Replace hardcoded role-name staff and invite-issuer checks in `mintSpaceLink` and `CollaborationEngineBase` with declarative MemberJunction Authorizations (`Issue Space Invite Links` and `Administer Spaces`) (CT-5), add the `check-no-role-name-auth.mjs` CI guard, update `task-space.test.ts` fixtures for `TaskEntityServer.ValidateAsync()`, lock down Space Participant writes to AI run/step/prompt-run entities outside active space chat turns (CT-7), enable field-level security on `MJ: AI Agents` to omit `OwnerUser` and `OwnerUserID` for external Space Participants (CT-8), and expand the `adversarial-persona` server and client integration harness suites across tasks, meetings, content chunks, search scopes, agent runs, and multi-role non-staff personas wired into CI (CT-6).
