#!/usr/bin/env node
/**
 * Builds this app's baseline migration (item 144): one `B…__v0.1.x__Baseline.sql` that replaces the `V…` stack.
 *
 * Run it against a database that holds MemberJunction core, bizapps-common, bizapps-tasks and THIS APP'S MIGRATIONS
 * ALONE: no `mj sync push`, no test metadata, no world. The pushes write into the same MJ rows (filters on the
 * permissions, JSON types on the fields, the participant role's grants), and a baseline must not carry them: filters,
 * permissions and JSONType settings stay JSON under `metadata/`.
 *
 * What the file holds, in order:
 *   1. The schema's DDL, introspected with MemberJunction's own baseline module (`@memberjunction/cli`): tables,
 *      defaults, checks, indexes, functions, views, procedures, triggers, foreign keys, the GRANTs on them, and every
 *      extended property. Views, procedures, triggers and GRANTs are CodeGen's; they are captured as they stand.
 *   2. CodeGen's capture, as the rows the migration stack left in MemberJunction's metadata tables: the application
 *      and its roles, the entities, their fields and value lists, their relationships (both directions), their
 *      default role permissions, and the application's entity list. Timestamps are written as GETUTCDATE(), as
 *      CodeGen writes them.
 *
 * The schema is written as `${flyway:defaultSchema}` and MJ core as `${mjSchema}`, the placeholders `mj migrate`
 * substitutes (mj.config.cjs), so the file reads like the V files it replaces.
 *
 * Usage (from the repo root, with DB_HOST / DB_PORT / DB_DATABASE and CODEGEN_DB_USERNAME / CODEGEN_DB_PASSWORD in the environment):
 *   node scripts/build-baseline.mjs --schema __mj_BizAppsCollaboration --out migrations
 *   node scripts/build-baseline.mjs --schema __mj_BizAppsCollabExamples --out packages/ExampleSpaceTypes/migrations
 *   --dry-run prints a summary and the first lines instead of writing; --stamp YYYYMMDDHHMM fixes the filename's time.
 *   --exclude-schemas a,b names the schemas built ON TOP of this one (the example types' on the Collaboration schema): a
 *   relationship between one of their entities and one of ours was written by their migration and belongs in their
 *   baseline, so it is left out of this one.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
    EmitBaselineTsql,
    FormatTsqlValue,
    IntrospectMssql,
    OpenConnection,
    QuoteIdent,
} from '@memberjunction/cli/dist/baseline/index.js';

const args = parseArgs(process.argv.slice(2));
const schema = args.schema;
if (!schema) fail('--schema is required (the app schema the baseline describes).');
const outDir = args.out ?? '.';
const version = args.version ?? '0.1';
const description = args.description ?? `BizApps Collaboration baseline for ${schema}`;
const generatedAt = args.stamp ? parseStamp(args.stamp) : new Date();
const dryRun = Boolean(args['dry-run']);
const mjSchema = process.env.MJ_CORE_SCHEMA || '__mj';
const excludedSchemas = String(args['exclude-schemas'] ?? '').split(',').map((x) => x.trim()).filter(Boolean);

// Definitions of views, procedures, defaults, checks and filtered indexes come from sys.sql_modules and friends, which show
// nothing to a login without VIEW DEFINITION: connect as CodeGen's login (db_owner), the pair `mj migrate` requires.
const { DB_HOST, DB_PORT, DB_DATABASE, DB_TRUST_SERVER_CERTIFICATE } = process.env;
const DB_USERNAME = process.env.CODEGEN_DB_USERNAME || process.env.DB_USERNAME;
const DB_PASSWORD = process.env.CODEGEN_DB_PASSWORD || process.env.DB_PASSWORD;
if (!DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) fail('DB_DATABASE and CODEGEN_DB_USERNAME / CODEGEN_DB_PASSWORD (or DB_USERNAME / DB_PASSWORD) must be set.');

const db = await OpenConnection({
    Dialect: 'mssql',
    Host: DB_HOST ?? 'localhost',
    port: Number(DB_PORT ?? 1433),
    User: DB_USERNAME,
    Password: DB_PASSWORD,
    Database: DB_DATABASE,
    encrypt: true,
    trustServerCertificate: DB_TRUST_SERVER_CERTIFICATE !== '0' && DB_TRUST_SERVER_CERTIFICATE !== 'false',
});

try {
    // ---- 1. DDL ------------------------------------------------------------------------------------------------
    const full = await IntrospectMssql(db);
    const sameSchema = (s) => (s ?? '').toLowerCase() === schema.toLowerCase();
    const snapshot = {
        ...full,
        Schemas: full.Schemas.filter((s) => sameSchema(s.name)),
        Tables: full.Tables.filter((t) => sameSchema(t.Schema)),
        Views: full.Views.filter((v) => sameSchema(v.schema)),
        Procedures: full.Procedures.filter((p) => sameSchema(p.schema)),
        Functions: full.Functions.filter((f) => sameSchema(f.schema)),
        Triggers: full.Triggers.filter((t) => sameSchema(t.schema)),
        Sequences: full.Sequences.filter((s) => sameSchema(s.schema)),
        UserDefinedTypes: full.UserDefinedTypes.filter((u) => sameSchema(u.schema ?? u.Schema)),
        ExtendedProperties: full.ExtendedProperties.filter((e) => sameSchema(e.SchemaName)),
        Principals: [],
        RoleMemberships: [],
        Permissions: full.Permissions.filter((p) => (p.targetClass === 'object' || p.targetClass === 'schema') && sameSchema(p.targetSchema)),
    };
    if (snapshot.Schemas.length !== 1) fail(`Schema ${schema} is not in ${DB_DATABASE}.`);
    if (snapshot.Tables.length === 0) fail(`Schema ${schema} has no tables in ${DB_DATABASE}.`);

    const ddl = EmitBaselineTsql({
        Snapshot: snapshot,
        DataDumps: [],
        Options: { baselineVersion: version, description, generatedAtUtc: generatedAt, includeData: false, excludedDataTables: new Set(), batchSize: 1000 },
    });

    // ---- 2. CodeGen's capture ----------------------------------------------------------------------------------
    const q = (sql) => db.query(sql);
    const lit = (v) => FormatTsqlValue(v);
    const applications = await q(`SELECT ID, Name FROM ${QuoteIdent(mjSchema)}.Application WHERE SchemaAutoAddNewEntities = ${lit(schema)} ORDER BY Name`);
    if (applications.length === 0) fail(`No MJ application names ${schema} in SchemaAutoAddNewEntities; CodeGen has not run on ${DB_DATABASE}.`);
    const appIds = applications.map((a) => lit(a.ID)).join(', ');
    const entities = await q(`SELECT ID, Name FROM ${QuoteIdent(mjSchema)}.Entity WHERE SchemaName = ${lit(schema)} ORDER BY Name`);
    if (entities.length === 0) fail(`No MJ entity lives in ${schema}; CodeGen has not run on ${DB_DATABASE}.`);
    const entityIds = entities.map((e) => lit(e.ID)).join(', ');
    const fieldIds = `SELECT ID FROM ${QuoteIdent(mjSchema)}.EntityField WHERE EntityID IN (${entityIds})`;
    const entityName = `(SELECT Name FROM ${QuoteIdent(mjSchema)}.Entity e WHERE e.ID = t.EntityID)`;
    const relatedName = `(SELECT Name FROM ${QuoteIdent(mjSchema)}.Entity e WHERE e.ID = t.RelatedEntityID)`;

    // A relationship whose other side lives in a schema built on top of this one was written by that schema's migration
    const dependents = excludedSchemas.length ? `SELECT ID FROM ${QuoteIdent(mjSchema)}.Entity WHERE SchemaName IN (${excludedSchemas.map(lit).join(', ')})` : null;
    const dependentsClause = dependents ? ` AND EntityID NOT IN (${dependents}) AND RelatedEntityID NOT IN (${dependents})` : '';

    /** Each table CodeGen writes for an app, with the rows that are this app's and a deterministic order. */
    const captures = [
        { table: 'Application', where: `ID IN (${appIds})`, order: 'Name' },
        { table: 'ApplicationRole', where: `ApplicationID IN (${appIds})`, order: `(SELECT Name FROM ${QuoteIdent(mjSchema)}.Role r WHERE r.ID = t.RoleID)` },
        { table: 'Entity', where: `ID IN (${entityIds})`, order: 'Name' },
        { table: 'ApplicationEntity', where: `EntityID IN (${entityIds})`, order: `${entityName}, Sequence` },
        { table: 'EntityField', where: `EntityID IN (${entityIds})`, order: `${entityName}, Sequence, Name` },
        { table: 'EntityFieldValue', where: `EntityFieldID IN (${fieldIds})`, order: `(SELECT e.Name + N'.' + f.Name FROM ${QuoteIdent(mjSchema)}.EntityField f JOIN ${QuoteIdent(mjSchema)}.Entity e ON e.ID = f.EntityID WHERE f.ID = t.EntityFieldID), Sequence, Value` },
        { table: 'EntityRelationship', where: `(EntityID IN (${entityIds}) OR RelatedEntityID IN (${entityIds}))${dependentsClause}`, order: `${entityName}, ${relatedName}, Sequence, ID` },
        { table: 'EntityPermission', where: `EntityID IN (${entityIds})`, order: `${entityName}, (SELECT Name FROM ${QuoteIdent(mjSchema)}.Role r WHERE r.ID = t.RoleID)` },
    ];
    const skipColumns = new Set(['__mj_createdat', '__mj_updatedat']);
    const dataParts = [];
    const counts = {};
    for (const capture of captures) {
        const cols = await q(`SELECT c.name AS name, c.is_computed AS computed FROM sys.columns c JOIN sys.tables tb ON tb.object_id = c.object_id JOIN sys.schemas s ON s.schema_id = tb.schema_id WHERE s.name = ${lit(mjSchema)} AND tb.name = ${lit(capture.table)} ORDER BY c.column_id`);
        const writable = cols.filter((c) => !c.computed && !skipColumns.has(c.name.toLowerCase())).map((c) => c.name);
        const stamped = cols.filter((c) => skipColumns.has(c.name.toLowerCase())).map((c) => c.name);
        const rows = await q(`SELECT ${writable.map((c) => `t.${QuoteIdent(c)}`).join(', ')} FROM ${QuoteIdent(mjSchema)}.${QuoteIdent(capture.table)} t WHERE ${capture.where} ORDER BY ${capture.order}`);
        counts[capture.table] = rows.length;
        if (rows.length === 0) continue;
        const columnList = [...writable, ...stamped].map(QuoteIdent).join(', ');
        const lines = [`-- ${QuoteIdent(mjSchema)}.${QuoteIdent(capture.table)}: ${rows.length} row(s)`];
        for (const row of rows) {
            const values = [...writable.map((c) => lit(row[c])), ...stamped.map(() => 'GETUTCDATE()')];
            lines.push(`INSERT INTO ${QuoteIdent(mjSchema)}.${QuoteIdent(capture.table)} (${columnList}) VALUES (${values.join(', ')});`);
        }
        dataParts.push(lines.join('\n'));
    }

    // ---- 3. Assemble --------------------------------------------------------------------------------------------
    const banner = [
        '',
        '-- =============================================================================',
        "-- GENERATED BY MemberJunction CodeGen — DO NOT EDIT BY HAND",
        '-- =============================================================================',
        `-- CodeGen's capture, as the rows the migration stack left in MemberJunction's metadata tables on ${DB_DATABASE}`,
        `-- (${entities.length} entities in ${schema}), dumped by scripts/build-baseline.mjs. Role permissions here are the`,
        '-- defaults CodeGen writes for a new entity; the filters on them, the JSON types and the other roles come from metadata/.',
        '',
        ...dataParts,
        'GO',
    ].join('\n');
    const header = [
        '-- =============================================================================',
        `--  ${description}`,
        '--',
        `--  The baseline of the ${schema} schema: one file in place of the V stack it replaces (item 144).`,
        `--  Built by scripts/build-baseline.mjs from ${DB_DATABASE}, a database that held MemberJunction core, bizapps-common,`,
        '--  bizapps-tasks and this app\'s migrations alone. Section 1 is the schema\'s DDL as MemberJunction\'s baseline module',
        '--  introspects it; section 2, under CodeGen\'s banner, is CodeGen\'s capture. Filters, permissions and JSONType',
        '--  settings stay JSON under metadata/ and are pushed with mj sync push.',
        '--',
        '--  Every object is created from empty: there is no IF NOT EXISTS, since a baseline applies only to a database',
        '--  that has none of this app\'s migrations.',
        '-- =============================================================================',
        '',
    ].join('\n');
    let text = header + ddl.replace(/-- End of baseline\.\nGO\n?$/, '') + banner + '\n-- End of baseline.\nGO\n';
    text = substitutePlaceholders(text, schema, mjSchema);

    const filename = `B${fileStamp(generatedAt)}__v${version}.x__Baseline.sql`;
    const summary = Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', ');
    const objects = `${snapshot.Tables.length} tables, ${snapshot.Views.length} views, ${snapshot.Procedures.length} procedures, ${snapshot.Functions.length} functions, ${snapshot.Triggers.length} triggers, ${snapshot.Permissions.length} grants, ${snapshot.ExtendedProperties.length} extended properties`;
    if (dryRun) {
        console.log(`[dry run] ${filename}: ${text.length.toLocaleString()} bytes, ${text.split('\n').length} lines`);
        console.log(`  DDL: ${objects}`);
        console.log(`  capture: ${summary}`);
        console.log(text.split('\n').slice(0, Number(args.head ?? 40)).join('\n'));
    } else {
        fs.mkdirSync(outDir, { recursive: true });
        const target = path.resolve(outDir, filename);
        fs.writeFileSync(target, text, 'utf8');
        console.log(`${target}: ${text.length.toLocaleString()} bytes`);
        console.log(`  DDL: ${objects}`);
        console.log(`  capture: ${summary}`);
    }
} finally {
    await db.close();
}

/** The schema as `${flyway:defaultSchema}` and MJ core as `${mjSchema}`, in identifiers and in string values alike. */
function substitutePlaceholders(text, appSchema, coreSchema) {
    const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text
        .replace(new RegExp(`\\[${escaped(appSchema)}\\]`, 'g'), '[${flyway:defaultSchema}]')
        .replace(new RegExp(`'${escaped(appSchema)}'`, 'g'), "'${flyway:defaultSchema}'")
        .replace(new RegExp(`N'${escaped(appSchema)}'`, 'g'), "N'${flyway:defaultSchema}'")
        .replace(new RegExp(`(?<![\\w\\]])${escaped(appSchema)}\\.`, 'g'), '${flyway:defaultSchema}.')
        .replace(new RegExp(`\\[${escaped(coreSchema)}\\]\\.`, 'g'), '[${mjSchema}].')
        .replace(new RegExp(`(?<![\\w\\]])${escaped(coreSchema)}\\.(?=\\[?\\w)`, 'g'), '${mjSchema}.');
}

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) out[key] = true;
        else { out[key] = next; i += 1; }
    }
    return out;
}

function parseStamp(stamp) {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(stamp);
    if (!m) fail('--stamp must be YYYYMMDDHHMM (UTC).');
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
}

function fileStamp(date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}${p(date.getUTCHours())}${p(date.getUTCMinutes())}`;
}

function fail(message) {
    console.error(message);
    process.exit(1);
}
