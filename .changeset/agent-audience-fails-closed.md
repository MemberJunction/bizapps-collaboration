---
"@mj-biz-apps/collaboration-core-entities-server": patch
"@mj-biz-apps/collaboration-core": patch
---

A space chat turn is refused when its audience cannot be read whole. Before, a failed read of the spaces, roles or seats let the turn run bounded by the asker alone, and the roster was every Active seat in the database, cut at 5,000 rows. Now the seats read are those on the conversation's space, on the ancestors it inherits membership from and on the spaces below it, read to their end by keyset paging, and a failed or unfinishable read refuses the turn before a reply row is written. The seats handed to a type's `BuildAgentContext` are read to their end as well.
