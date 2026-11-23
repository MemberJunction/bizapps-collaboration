---
"@mj-biz-apps/collaboration-core": minor
"@mj-biz-apps/collaboration-entities": minor
"@mj-biz-apps/collaboration-core-entities-server": minor
"@mj-biz-apps/collaboration-server": minor
"@mj-biz-apps/collaboration-ng-widgets": minor
"@mj-biz-apps/collaboration-ng": minor
---

Implement Sub-Epic S7 structural chat scope resolution, granted extra knowledge scope retrieval with originating scope provenance, and removal of the interim `CollaborationScopedSearchAction` override:

- **CS-1 Structural Chat Scope Function**: Add dual-dialect SQL Server and PostgreSQL migrations (`V202611230415__v0.2.x__Structural_Chat_Scope.sql` and `.pg.sql`) defining `fnCollaborationChatScope` as an inline table-valued function / `STABLE` SQL function returning deduplicated `(SpaceID, Band)` pairs via O(1) structural `Audience` reach without roster enumeration, plus strictly typed Core and CoreEntitiesServer parsers and resolvers and `agent.AG16` integration coverage.
- **CT-3 Granted Extra Knowledge Scopes & Provenance**: Add additive dual-dialect migrations (`V202611231200__v0.2.x__Source_Receipt_Originating_Scope.sql` and `.pg.sql`) adding `OriginatingScopeID` and `OriginatingScopeName` to `SpaceAgentSourceReceipt` with generated entity/GraphQL parity, resolve authorized extra knowledge scopes in space turns via batched `RunView` (`ResultType: 'simple'`), exclude unauthorized/revoked/`Team`-in-`Shared` scopes, persist provenance onto source receipts and render it in Angular receipt widgets, and add `agent.AG17` integration coverage.
- **CT-9 Scoped Search Override Removal**: Remove `CollaborationScopedSearchAction`, its barrel exports, and the `@memberjunction/core-actions` peer dependency from `@mj-biz-apps/collaboration-core-entities-server` so collaboration turns rely directly on core `ScopedSearchAction` query normalization (`NormalizeScopedSearchQuery`), while preserving `recordScopedSearchHitsOnContext` in `turn-tools.ts` and updating `release-lines.json` edge-only migration tracking.
