---
"@mj-biz-apps/collaboration-core-entities-server": patch
---

`SyncSeats` resolves a roster's role by the role type's ID, then its code, then its name. It no longer reads `SpaceRoleType.SpaceTypeID`, a column that does not exist (role types are global), so the choice between two matching roles no longer falls to whichever was read first: a code wins over another role's name, and a name that more than one role carries is reported as an error instead of seating the person in one of them.
