# BizApps Collaboration — Agent Development Guide (`AGENTS.md`)

This repository is the **BizApps Collaboration** MemberJunction Open App. All coding agents (Claude Code, Codex, Cursor, Antigravity, Gemini CLI) MUST follow [`CLAUDE.md`](CLAUDE.md), MJ's [Schema and Code Authoring Guide](https://github.com/MemberJunction/MJ/blob/next/guides/SCHEMA_AND_CODE_AUTHORING_GUIDE.md), and the standards below.

## Critical Coding & Security Rules

1. **No `any` or lazy `unknown`** — never use `: any`, `as any`, `<any>`, or `unknown` as a shortcut.
2. **No `.Get()` / `.Set()` on typed entities** — always use strongly-typed generated entity properties and derive value-list unions from entity types (`Entity['Field']`).
3. **Use `BaseSingleton` for all singletons** — extend `BaseEngine<T>` or `BaseSingleton<T>` from `@memberjunction/global`.
4. **No cross-package re-exports** — import types/classes from the defining package.
5. **Persist user preferences via `UserInfoEngine.Instance`** — never `localStorage` or `sessionStorage`.
6. **Modern Angular** — `@if`/`@for`/`@switch`, `inject()`, semantic `--mj-*` design tokens (no hardcoded hex), `<mj-loading>`, call `NotifyLoadComplete()` in `BaseResourceComponent`.
7. **Fail-closed security & Band isolation** — never leak `Team`-band items, chats, tasks, meetings, or source receipts to `Shared`-band (`Space Participant`) viewers; never edit protected files under `ci/`.
8. **Metadata & Migrations** — PRs carry physical DDL migrations + declarative JSON under `metadata/` (never hand-written `*__Metadata_Sync.sql`). Every metadata record and nested `relatedEntities` child carries a `primaryKey`.
9. **Safe git & merge strategy** — PRs target `next`; never commit/push directly to `next`/`main`; merge PRs with merge commits (`gh pr merge --merge`), never `--squash`.

## Canonical 5-Rule Performance & Caching Standard

1. **`BaseEngine` (`BaseSingleton`) for Bounded Reference/Taxonomy Metadata:** Cache bounded lookup/config tables (`Space Types`, `Space Type Status`, `Space Role Types`, `Application Settings` on `CollaborationEngineBase`; staff-only `Authorizations`, `Authorization Roles`, app/type `Space Grants` on `CollaborationAdminEngineBase`) via `BaseEnginePropertyConfig` (`AutoRefresh: true`) with O(1) lookup maps cleared in `AdditionalLoading()` — never re-query via `RunView` per widget mount.
2. **Multi-Provider & Impersonation Safety:** Override `ProviderToUse` to follow the active provider passed to `Config()` / `Metadata.Provider`; auto-evict per-user caches (`ClearUserCaches()`) whenever `userId` changes; set `CacheLocal: false` on any RLS-filtered entity; gate optional/staff-only queries on `EntityInfo.GetUserPermisions(user)?.CanRead`.
3. **Mandatory `rv.RunViews([...])` Single-Request Batching:** Never fire `Promise.all([new RunView().RunView(...), ...])` (N separate HTTP requests) or multi-hop `ParentID` loops when `RootParentID` exists. Use `RunView.FromMetadataProvider(this.ProviderToUse).RunViews([...])` with `ResultType: 'simple'` + narrow `Fields`.
4. **`ConversationEngine`-Style Bounded Container Caching:** Never cache unbounded transactional tables globally or cache arbitrary `ExtraFilter` SQL list views. Cache only bounded container windows/subtrees (e.g., per-`SpaceID`, per-`ConversationID`, per-`RootParentID`, or per-user reachable space/seat caches) with `BaseEntity` event invalidation + explicit `InvalidateSpaceCache()` / `ClearUserCaches()` + persona-switch eviction.
5. **RLS-Safe Two-Step Entity Reads:** Never write raw SQL subqueries against RLS-filtered base views (`vw*`) inside `ExtraFilter`; read the RLS-protected entity via `RunView` first, then pass `ID IN (...)`.

## MJ Docs (`MJ: Artifacts`) vs. `MJ: Comments` vs. Quick Notes

Before adding any narrative text, collaborative document, note, or discussion feature, consult [`MJ/guides/MJ_DOCS_COMMENTS_AND_NOTES_GUIDE.md`](https://github.com/MemberJunction/MJ/blob/next/guides/MJ_DOCS_COMMENTS_AND_NOTES_GUIDE.md) and choose the right primitive:

- **MJ Docs (`MJ: Artifacts` `Markdown Document`)**: Use for versioned, editable, collaborative documents backed by `MJ: Artifacts` + `MJ: Artifact Versions` (`ContentMode: 'Text'`) and `SpaceItem.ArtifactVersionID` with `Artifact.DelegateEntityID` / `DelegateRecordID` permission delegation (`CollaborationSpaceItemArtifactPermissionDelegate` / `ArtifactPermissionEngine`). Never create bespoke `*Document` tables or upload static `.md` files via `upload-space-file.ts` for editable documents.
- **`MJ: Comments`**: Use for threaded record-level or field-level discussions anchored to an entity record (`MJ: Comments` IS-A `MJ: Conversations`, `@mentions`, resolution tracking, automatic RLS/FLS).
- **Quick Notes (`SpaceNote`)**: Use for lightweight, ephemeral space notes (`Team`, `Shared`, or author-only `Private`) that can be promoted on demand into native editable MJ Docs via **Turn into document** (`promoteSpaceNoteToDoc` / `CollaborationClient.PromoteSpaceNoteToDoc`), inheriting `SpaceID`, `Band` (`Private` locked to `Team`), `Visibility`, and `DelegateEntityID`/`DelegateRecordID` delegation.
- **Lightweight Relational Column**: Use plain `nvarchar(N)` columns only for short, structured single-value text (`<= 500` chars).
