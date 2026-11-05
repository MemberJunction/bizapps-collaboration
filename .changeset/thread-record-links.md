---
"@mj-biz-apps/collaboration-ng-widgets": patch
"@mj-biz-apps/collaboration-ng": patch
---

A record link an agent writes into a thread reply now shows as a link that opens the record, and behaves as in MJ's chat: an open icon beside the name the agent wrote, or the link's own name when it has one. The thread view printed it as "@mention". Links are read the way MJ's `ConversationUtility` reads them, so composite keys, a lowercase `id`, nested `keys` and braces in a name all work, and the host opens a record against the entity's own primary key.
