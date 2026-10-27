# Collaboration

## Metadata

A migration carries DDL: tables, columns, views, functions, constraints, and extended properties, plus the CodeGen output appended under its banner. Metadata rows are JSON under `metadata/`. Push them with `mj sync push` while developing. The build engineer generates the release `*__Metadata_Sync.sql` from a clean database. A feature pull request never writes that file. The model, and the Open App steps that differ from core (`--schema`, the `${mjSchema}` substitution): [Release Metadata Migrations Guide](https://github.com/MemberJunction/MJ/blob/next/guides/RELEASE_METADATA_MIGRATIONS_GUIDE.md).

That covers roles, applications, authorizations and their role grants, application settings, entity permissions, row filters, field settings, navigation, notification types, permission domains, queries, and seed rows such as space types and role types. Fixed IDs stay as primary keys. A row CodeGen created with a per-host ID is matched by `@lookup` on its natural key. Do not author `sync` blocks. Filter text that names a schema follows the substitutions in bizapps-forms' `migrations/README.md`.

Every metadata record has a `primaryKey`, nested `relatedEntities` children included. That rule and the others MJ and every BizApps repo share, such as plain migration DDL and CHECK values written for people, are in MJ's [Schema and Code Authoring Guide](https://github.com/MemberJunction/MJ/blob/next/guides/SCHEMA_AND_CODE_AUTHORING_GUIDE.md), each with its reason.

## MemberJunction version

Work runs on MemberJunction's `next`, in a workspace made by `mj dev workspace` beside MemberJunction, BizApps Common and BizApps Tasks ([PR 10's plan § 2.1](plans/pr10-plan.md#21-work-on-mj-next)). Install and build from that parent folder, never in this repo. CI installs published packages, so it fails on the `next`-only types until a release is pinned. Judge a change by the workspace build, `pnpm test` and both integration harnesses.
