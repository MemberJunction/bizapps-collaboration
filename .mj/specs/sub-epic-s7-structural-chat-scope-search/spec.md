# Sub-Epic S7: Structural Chat Scope Function, Granted Search Scopes & Scoped Search Override Removal

## Overview

Sub-Epic S7 upgrades collaboration chat authorization and knowledge retrieval across three coordinated capabilities using 100% domain-neutral BUSL-1.1 naming and strict TypeScript typing (`0` `any`, `0` `unknown`, `0` `BaseEntity.Get()/Set()`):

1. **CS-1 — Structural Chat Scope Function (`fnCollaborationChatScope`)**: Evaluates `(SpaceID, Band)` reach for a `(PrimaryScopeRecordID, UserID)` pair in `O(1)` relative to audience size without roster enumeration.
2. **CT-3 — Granted Extra Knowledge Scopes & Originating Scope Provenance**: Expands space-turn retrieval to authorized granted extra knowledge scopes via batched `RunView` (`ResultType: 'simple'`) and persists `OriginatingScopeID` and `OriginatingScopeName` onto every `SpaceAgentSourceReceipt`.
3. **CT-9 — Removal of `CollaborationScopedSearchAction` Override**: Removes the interim `__Scoped_Search` action override and `@memberjunction/core-actions` peer dependency so core `ScopedSearchAction` (`NormalizeScopedSearchQuery`) executes natively without override interference.

## Architecture & Changes

### 1. CS-1: Dual-Dialect Structural Chat Scope Function
- **SQL Server**: `migrations/V202611230415__v0.2.x__Structural_Chat_Scope.sql` creates `[${flyway:defaultSchema}].[fnCollaborationChatScope](@PrimaryScopeRecordID UNIQUEIDENTIFIER, @UserID UNIQUEIDENTIFIER)` as an inline table-valued function (`RETURNS TABLE AS RETURN (...)`) returning deduplicated `(SpaceID, Band)` pairs.
- **PostgreSQL**: `migrations-pg/V202611230415__v0.2.x__Structural_Chat_Scope.pg.sql` creates the matching `LANGUAGE sql STABLE` function returning `TABLE("SpaceID" UUID, "Band" TEXT)` with exact parity on `Shared` / `Team` audience rules, `InheritsMembership` traversal, and `Assistant` / `Private` / `General` chat constraints.
- **TypeScript**: `packages/Core/src/chat-scope.ts` and `packages/CoreEntitiesServer/src/structural-chat-scope.ts` provide typed row parsers, normalization, and parameterized SQL invocation helpers.

### 2. CT-3: Granted Extra Knowledge Scopes & Source Receipt Provenance
- **Additive Schema**: `migrations/V202611231200__v0.2.x__Source_Receipt_Originating_Scope.sql` and `.pg.sql` add nullable `OriginatingScopeID` (`UNIQUEIDENTIFIER` / `UUID`) and `OriginatingScopeName` (`NVARCHAR(200)` / `VARCHAR(200)`) to `SpaceAgentSourceReceipt`, regenerating `vwSpaceAgentSourceReceipts`, CRUD stored procedures/functions, and `packages/Entities` + `packages/Server` GraphQL parity artifacts.
- **Server Resolution & Dispatch**: `packages/CoreEntitiesServer/src/turn-knowledge-scopes.ts` resolves granted extra knowledge scopes strictly from persisted `SpaceGrant` rows, validates `MJ: Search Scopes` and `MJ: Search Scope Permissions` across the conversation audience via batched `RunView` (`ResultType: 'simple'`), rejects revoked (`Mode = 'Remove'`) and `Team`-band-in-`Shared`-chat scopes, executes bounded multi-scope search, and stamps `OriginatingScopeID` / `OriginatingScopeName` onto receipts persisted via `TransactionGroup`.
- **UI & Prompt Templates**: `packages/Angular`, `packages/AngularWidgets`, and `metadata/templates/.collaboration-ask-template.json` surface granted scope hits and originating scope names in source receipt chips/drawers.

### 3. CT-9: `CollaborationScopedSearchAction` Removal
- Removed `packages/CoreEntitiesServer/src/CollaborationScopedSearchAction.ts`, its barrel exports (`CollaborationScopedSearchAction`, `LoadCollaborationScopedSearchAction`, `unquoteSpaceSearch`, `unwrapPhraseQuotes`), and the `@memberjunction/core-actions` peer dependency from `packages/CoreEntitiesServer/package.json`.
- Retained `recordScopedSearchHitsOnContext` in `packages/CoreEntitiesServer/src/turn-tools.ts` for turn context hit accumulation alongside `extractToolSourceHitsFromAgentRun` in `execute-space-chat-turn.ts`.
- Verified `MJGlobal.Instance.ClassFactory.GetRegistration(BaseAction, '__Scoped_Search')` resolves directly to core `ScopedSearchAction`, with quoted and unquoted search queries normalized via core `NormalizeScopedSearchQuery`.

## Release Metadata & CI Verification

- `release-lines.json`: Added `V202611230415__v0.2.x__Structural_Chat_Scope.sql` and `V202611231200__v0.2.x__Source_Receipt_Originating_Scope.sql` to `next.edgeOnlyMigrations`.
- `.changeset/s7-structural-scope-search.md`: Documents the `minor` release bump across all modified publishable `@mj-biz-apps/collaboration-*` packages.
- `.github/workflows/`: Verified `ci.yml`, `changes.yml`, `release-lines-gates.yml`, and `repo-checks.yml` enforce build, unit tests, static gates (`strip-sync-blocks`, `check-mj-tokens`, `check-downstream-names`, `check-mj-inputs`, `check-registered-exports`, `check-no-role-name-auth`, `check-row-caps`, `mj standards check`), migration validation, and world-data-model integration checks on PRs targeting `next`.

## Critical User Journeys & Verification Criteria

1. **Large Structural Audience Space Turn**: A participant in a collaboration space governed by a large structural `Audience` submits a turn spanning the native space scope and a granted extra knowledge scope; `fnCollaborationChatScope` resolves `(SpaceID, Band)` in `O(1)` without roster enumeration, core `ScopedSearchAction` handles quoted/unquoted queries cleanly, and emitted `SpaceAgentSourceReceipt` rows persist accurate `OriginatingScopeID` and `OriginatingScopeName`.
2. **Scope & Band Isolation Boundary**: A user outside the structural `Audience` receives zero `(SpaceID, Band)` rows; unauthorized, revoked (`Mode = 'Remove'`), or `Team`-band scopes in a `Shared` chat are excluded from `SearchScopeIDs` and produce zero unauthorized receipts.
3. **CI & Release Gate Compliance**: `pnpm run build`, `pnpm test`, `pnpm run mj:standards`, `node scripts/strip-sync-blocks.mjs --check`, `release-lines.mjs validate`, `check-backport.mjs labels`, `check-migration-changeset.sh`, and `check-dependency-model.mjs` all pass with zero errors.
