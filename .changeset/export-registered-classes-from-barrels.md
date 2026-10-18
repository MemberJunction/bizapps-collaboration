---
"@mj-biz-apps/collaboration-entities": patch
"@mj-biz-apps/collaboration-core-entities-server": patch
---

Export `CollaborationSpacePermissionProvider`, `TaskAssignmentEntityServer`, `TaskCommentEntityServer`, and `TaskDecisionEntityServer` from their package root barrels so generated class registration manifests can import them cleanly.
