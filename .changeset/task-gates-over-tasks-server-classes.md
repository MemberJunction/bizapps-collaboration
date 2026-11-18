---
"@mj-biz-apps/collaboration-core-entities-server": patch
---

Collaboration's rules on task assignments and task decisions keep running beside bizapps-tasks' own. bizapps-tasks 1.11 added server classes for both entities, and only one class runs per entity, so whichever app loaded last silently dropped the other's rules: either an outside participant could assign someone seated above their space, or the approval rules on reassignment and self-approval stopped applying. Collaboration's classes now extend bizapps-tasks' classes, so both sets of rules run whatever the load order. A participant's new decision is also stamped with their own person before bizapps-tasks' self-approval rule reads who decided.
