---
"@mj-biz-apps/collaboration-ng": patch
---

The space Work tab shows each task's assignee and due date. It read `AssignedTo` and `TargetEndDate`, which Tasks doesn't have, so every row said Unassigned with no due date. It now reads `DueAt`, and takes assignees from Task Assignments: a People record (or an IS-A subtype of People) or a User, whoever is still on the task first, with "+N" when there are more.
