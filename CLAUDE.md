# Collaboration

## Metadata

A migration carries DDL: tables, columns, views, functions, constraints, and extended properties, plus the CodeGen output appended under its banner. Metadata rows are JSON under `metadata/`. Push them with `mj sync push` while developing. The build engineer generates the release `*__Metadata_Sync.sql` from a clean database. A feature pull request never writes that file. The model, and the Open App steps that differ from core (`--schema`, the `${mjSchema}` substitution): [Release Metadata Migrations Guide](https://github.com/MemberJunction/MJ/blob/next/guides/RELEASE_METADATA_MIGRATIONS_GUIDE.md).

That covers roles, applications, authorizations and their role grants, application settings, entity permissions, row filters, field settings, navigation, notification types, permission domains, queries, and seed rows such as space types and role types. Fixed IDs stay as primary keys. A row CodeGen created with a per-host ID is matched by `@lookup` on its natural key. Do not author `sync` blocks. Filter text that names a schema follows the substitutions in bizapps-forms' `migrations/README.md`.

Every metadata record has a `primaryKey`, nested `relatedEntities` children included. That rule and the others MJ and every BizApps repo share, such as plain migration DDL and CHECK values written for people, are in MJ's [Schema and Code Authoring Guide](https://github.com/MemberJunction/MJ/blob/next/guides/SCHEMA_AND_CODE_AUTHORING_GUIDE.md), each with its reason.

## MemberJunction version

Work runs on MemberJunction's `next`, in a workspace made by `mj dev workspace` beside MemberJunction, BizApps Common and BizApps Tasks ([PR 10's plan § 2.1](plans/pr10-plan.md#21-work-on-mj-next)). Install and build from that parent folder, never in this repo. CI installs published packages, so it fails on the `next`-only types until a release is pinned. Judge a change by the workspace build, `pnpm test` and both integration harnesses.

## Release lines

`next` is built on MJ Edge and never publishes. Production releases come from release lines (`lts/<MJ major.minor>`), listed in `release-lines.json`. Land every change on `next` first, then add a `backport lts/X.Y` label; a PR that adds a migration needs a label for every open line, or its files listed as edge-only in `release-lines.json`. Never open a PR straight into a line or into `main`. Full rules, publishing and the line cut: [guides/RELEASE_LINES.md](guides/RELEASE_LINES.md).

## Performance & Caching Standard (5 Non-Negotiable Rules)

See also [`AGENTS.md`](AGENTS.md). Every engine, server driver, Angular widget, and Explorer resource in `bizapps-collaboration` MUST adhere to these 5 rules:

1. **`BaseEngine` (`BaseSingleton`) for Bounded Reference/Taxonomy Metadata:** Cache bounded lookup/config tables (`Space Types`, `Space Type Status`, `Space Role Types`, `Application Settings` on `CollaborationEngineBase`; staff-only `Authorizations`, `Authorization Roles`, app/type `Space Grants` on `CollaborationAdminEngineBase`) via `BaseEnginePropertyConfig` (`AutoRefresh: true`) with O(1) lookup maps cleared in `AdditionalLoading()` — never re-query them via `RunView` per widget mount.
2. **Multi-Provider & Impersonation Safety:** Override `ProviderToUse` to follow the active provider passed to `Config()` / `Metadata.Provider`; auto-evict per-user caches (`ClearUserCaches()`) whenever `userId` changes (persona switch / impersonation); set `CacheLocal: false` on any RLS-filtered entity so IndexedDB never leaks across users; gate optional/staff-only queries on `EntityInfo.GetUserPermisions(user)?.CanRead` (or isolate staff-only entities in `CollaborationAdminEngineBase`).
3. **Mandatory `rv.RunViews([...])` Single-Request Batching:** Never fire `Promise.all([new RunView().RunView(...), ...])` (N separate HTTP requests) or multi-hop `ParentID` loops when `RootParentID` exists. Use `RunView.FromMetadataProvider(this.ProviderToUse).RunViews([...])` with `ResultType: 'simple'` + narrow `Fields`.
4. **`ConversationEngine`-Style Bounded Container Caching:** Never cache unbounded transactional tables globally or cache arbitrary `ExtraFilter` SQL list views. Cache only bounded container windows/subtrees (e.g., per-`SpaceID`, per-`ConversationID`, per-`RootParentID`, or per-user reachable space/seat caches) with `BaseEntity` event invalidation + explicit `InvalidateSpaceCache()` / `ClearUserCaches()` + persona-switch eviction.
5. **RLS-Safe Two-Step Entity Reads:** Never write raw SQL subqueries against RLS-filtered base views (`vw*`) inside `ExtraFilter`; read the RLS-protected entity via `RunView` first, then pass `ID IN (...)`.
