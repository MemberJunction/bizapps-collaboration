# Collaboration

## Metadata

A migration carries DDL: tables, columns, views, functions, constraints, and extended properties, plus the CodeGen output appended under its banner. Metadata rows are JSON under `metadata/`. Push them with `mj sync push` while developing. The build engineer generates the release `*__Metadata_Sync.sql` from a clean database. A feature pull request never writes that file.

That covers roles, applications, entity permissions, row filters, field settings, navigation, notification types, permission domains, and seed rows such as space types and role types. Fixed IDs stay as primary keys. A row CodeGen created with a per-host ID is matched by `@lookup` on its natural key. Do not author `sync` blocks. Filter text that names a schema follows the substitutions in bizapps-forms' `migrations/README.md`.
