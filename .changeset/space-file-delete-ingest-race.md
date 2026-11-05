---
"@mj-biz-apps/collaboration-core-entities-server": patch
---

Deleting a space file right after uploading it no longer leaves the file row behind. The upload's content-pipeline ingest runs alongside the delete and could attach its Content Item after the delete had detached the file's items, so the row's delete failed on `FK_ContentItem_File`. The delete now detaches again and retries the row once.
