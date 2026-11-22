---
"@mj-biz-apps/collaboration-core-entities-server": minor
---

Implement CT-4 bounded top-k ranked relevance retrieval in `resolveSpaceAgentRetrieval` and `executeSpaceChatTurn`: remove the 2,000-item refusal limit, enforce strict `(space, band)` reach pre-filtering prior to scoring/vector querying, support host vector search with automatic deterministic BM25 lexical fallback, guarantee constant-budget `O(k)` prompt token limits across 50,000+ items, and emit structured `suppliedSources` and `retrievalStats` metadata.
