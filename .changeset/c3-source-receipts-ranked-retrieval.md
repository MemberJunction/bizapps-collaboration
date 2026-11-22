---
"@mj-biz-apps/collaboration-core": minor
"@mj-biz-apps/collaboration-entities": minor
"@mj-biz-apps/collaboration-engine-base": minor
"@mj-biz-apps/collaboration-core-entities-server": minor
"@mj-biz-apps/collaboration-server": minor
"@mj-biz-apps/collaboration-ng": minor
---

Implement CT-4 bounded top-k ranked relevance retrieval and CT-2 relational source receipts schema, dual-dialect migrations, and fail-closed turn persistence:

- **CT-4 Ranked Retrieval**: Remove the 2,000-item refusal limit in `resolveSpaceAgentRetrieval` and `executeSpaceChatTurn`, enforce strict `(space, band)` reach pre-filtering prior to scoring/vector querying, support host vector search with deterministic BM25 lexical fallback, guarantee constant-budget `O(k)` prompt token limits across 50,000+ items, and emit structured `suppliedSources` and `retrievalStats` metadata.
- **CT-2 Relational Source Receipts**: Add SQL Server and PostgreSQL migrations for `SpaceAgentSourceReceipt`, `release-lines.json` edge tracking, RLS filter `Collaboration: Source Receipts In Reach` and entity permissions, pure Core validation rules, generated Entities/Server/Angular artifacts, `SpaceAgentSourceReceiptEntityServer` guards, idempotent fail-closed receipt persistence and query filtering in `executeSpaceChatTurn`, and source receipts audit tests.
