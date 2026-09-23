# migrations/

Skyway (Flyway-compatible) migrations for `__mj_BizAppsCollaboration`.

    B<YYYYMMDDHHMM>__v<app-version>__<Description>.sql   schema + SchemaInfo (own transaction)
    V<YYYYMMDDHHMM>__v<app-version>__<Description>.sql   tables and constraints

The B file creates the schema and the `__mj.SchemaInfo` row CodeGen reads for the entity-name prefix `MJ_BizApps_Collaboration: `. It runs in its own transaction, so the V file can create tables against that schema.

The V file is hand-written DDL only: business columns, checks, and foreign keys. Do **not** add `__mj_CreatedAt` / `__mj_UpdatedAt`, indexes on foreign keys, or `Entity` / `EntityField` rows. CodeGen owns those. After CodeGen, its emit is appended under the banner in the V file — it is not authored by hand.

Use `${flyway:defaultSchema}` for this app's objects and `${mjSchema}` for MJ core. `CREATE SCHEMA` and the `SchemaInfo.SchemaName` value stay the literal `__mj_BizAppsCollaboration`.

Type-table **rows** (`SpaceType`, `SpaceRoleType`) are not inserted here. They ship later as `metadata/` with stable UUIDs.

Spec: [`plans/plan.md`](../plans/plan.md) §4.
