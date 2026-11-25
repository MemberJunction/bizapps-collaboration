---
'@mj-biz-apps/collaboration-engine-base': minor
'@mj-biz-apps/collaboration-ng-widgets': minor
'@mj-biz-apps/collaboration-ng': minor
---

Add fail-closed Row-Level Security filters and `EntityPermission` grants for `Space Participant` (and `UI`) across `MJ: Artifact Types`, `MJ: Artifacts`, `MJ: Artifact Versions`, `MJ: Artifact Version Attributes`, `MJ: Artifact Permissions`, `MJ: Artifact Uses`, `MJ: Conversation Detail Artifacts`, `MJ: Collection Artifacts`, `MJ: Conversation Artifacts`, and caller-own RSVP updates on `MJ_BizApps_Tasks: Meeting Attendees`.

Upgrade `<mjc-space-meetings-tab>` to compose `@mj-biz-apps/tasks-ng-widgets` (`<bizapps-meeting-list>`, `<bizapps-meeting-header>`, `<bizapps-meeting-agenda>`, `<bizapps-meeting-people>`, `<bizapps-meeting-notes>`, `<bizapps-meeting-followups>`, and `<bizapps-meeting-live>`) with an in-place slide-over meeting detail and live runner drawer, inline RSVP persistence, recursive sub-space rollup (`IncludeSubSpaces`), and strict `Shared`/`Team` band and read-only external-viewer isolation.
