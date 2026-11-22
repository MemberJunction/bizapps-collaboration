---
"@mj-biz-apps/collaboration-core": minor
"@mj-biz-apps/collaboration-entities": minor
"@mj-biz-apps/collaboration-engine-base": minor
"@mj-biz-apps/collaboration-core-entities-server": minor
"@mj-biz-apps/collaboration-server": minor
"@mj-biz-apps/collaboration-ng-widgets": minor
"@mj-biz-apps/collaboration-ng": minor
---

Implement CT-4 bounded top-k ranked relevance retrieval and CT-2 relational source receipts schema, dual-dialect migrations, fail-closed turn persistence, and Space Chat UI source citation chips:

- **CT-4 Ranked Retrieval**: Remove the 2,000-item refusal limit in `resolveSpaceAgentRetrieval` and `executeSpaceChatTurn`, enforce strict `(space, band)` reach pre-filtering prior to scoring/vector querying via `HostSearchEngineVectorAdapter` (`SpaceChat` primary scope + `AllowedSpaceItemIDs` / `AllowedBandsBySpaceID` / `SecondaryScopes`), support full-corpus chunk-text and task-assignee lexical candidate discovery across 50,000+ items, guarantee unconditional per-source and aggregate `O(k)` prompt token ceilings (covering assignees, titles, metadata, and the first item), and emit structured `suppliedSources` and `retrievalStats` metadata.
- **CT-2 Relational Source Receipts**: Add SQL Server and PostgreSQL migrations for `SpaceAgentSourceReceipt`, `release-lines.json` edge tracking, balanced RLS filter `Collaboration: Source Receipts In Reach` and entity permissions, pure Core UUID & receipt validation rules (`isValidReceiptUuid`, `assertValidReceiptUuid`), generated Entities/Server/Angular artifacts (`OnPush`), `SpaceAgentSourceReceiptEntityServer.ValidateAsync` cross-scope + turn-authority enforcement, `SpaceAgentSourceReceiptEntityServer.InnerLoad` & generated single-record GraphQL resolver live-source authorization, automatic transaction-scoped PostgreSQL provider user-context hook (`ensurePostgresReceiptContextHook`) with dirty-connection pool discard (`release(true)`/`end()`), keyset-paginated `LoadSpaceAgentSourceReceiptsForConversation` & `querySpaceAgentSourceReceipts`, turn tool-hit source provenance tracking (`TurnToolSourceHit` / `recordScopedSearchHitsOnContext`), and comprehensive security/scale audit tests.
- **CT-2 Space Chat UI Source Citation Chips**: Add `CollabAnswerSourceReceiptsComponent` (`mjc-answer-source-receipts`) and wire per-answer source citation chips, inspectable provenance receipt drawer, fail-closed `(space, band)` UI filtering, and cited source opening into `CollabSpaceChatComponent` and `CollaborationSectionResource`, verified by Angular unit/render tests and Playwright E2E tests.
