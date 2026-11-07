#!/usr/bin/env node
/**
 * Generates the metadata a type's data reach needs (the plan's B18, D28). It reads every type's `Configuration.DataReach` from
 * `metadata/space-types/` and `metadata-tests/space-types/`, checks each declaration against the database's metadata (the entity
 * exists, the path's column exists and a hop is a real foreign key, every listed field exists), and writes, per declared entity:
 *
 *   - one Space Participant row-level security filter, which ORs every type's clause for that entity: the rows whose path value is
 *     the RecordID of an anchor with the declared role, on a space of that type the caller reaches through fnCollaborationAccess,
 *     and, for a Team declaration, only where the caller sees Team;
 *   - the Space Participant read grant on the entity, carrying that filter;
 *   - the participant's field permissions: Allow for each listed field, Deny for every other readable field of the entity (its keys
 *     and MJ's own columns aside). MJ writes an Allow row for every field when a role gains read on an entity whose field-level flag
 *     is on, so the allow-list has to deny the rest in so many words. The rows are pushed BEFORE the entity's flag (see the
 *     directoryOrder in metadata-tests): MJ's snapshot skips a (field, role) pair that already has a row, and a later generated row
 *     would collide with a snapshot row on the (field, role) unique key. The script warns about an entity whose flag is off: turning it
 *     on is the owning app's call (the example turns its own on).
 *
 * A shipped type's output goes under metadata/, a test type's under metadata-tests/. Nothing is generated at runtime: the files are
 * reviewed and pushed like any other metadata.
 *
 *   node scripts/generate-data-reach-filters.mjs            # writes the files
 *   node scripts/generate-data-reach-filters.mjs --check    # exits 1 when the committed files differ from what it would write (CI)
 *   node scripts/generate-data-reach-filters.mjs --dry-run  # prints what it would write
 *
 * Needs the database the types are pushed to: DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD (as mj sync push does).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const args = new Set(process.argv.slice(2));
const check = args.has('--check');
const dryRun = args.has('--dry-run');

const COLLAB_SCHEMA = '__mj_BizAppsCollaboration';
const PARTICIPANT_ROLE = 'Space Participant';
const ROOTS = [
    { root: 'metadata', types: 'metadata/space-types/.space-types.json' },
    { root: 'metadata-tests', types: 'metadata-tests/space-types/.space-types.json' },
];

/** A deterministic v4-shaped id from a seed, as generate-core-permissions.mjs makes them, so a regeneration changes nothing it need not. */
function idFrom(seed) {
    const hash = createHash('md5').update(seed).digest('hex');
    return [hash.substring(0, 8), hash.substring(8, 12), '4' + hash.substring(13, 16), '8' + hash.substring(17, 20), hash.substring(20, 32)].join('-').toUpperCase();
}

function readTypes(file) {
    const path = resolve(repoRoot, file);
    if (!existsSync(path)) return [];
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    return rows.filter((row) => row?.fields && !row.deleteRecord);
}

/** The declarations, with where they came from. */
function collectDeclarations() {
    const declarations = [];
    const problems = [];
    for (const { root, types } of ROOTS) {
        for (const row of readTypes(types)) {
            const typeId = row.primaryKey?.ID;
            const code = row.fields.Code;
            const reach = row.fields.Configuration?.DataReach;
            if (!reach) continue;
            if (!Array.isArray(reach)) { problems.push(`${code}: DataReach must be an array.`); continue; }
            reach.forEach((declaration, index) => {
                const at = `${code} DataReach[${index}]`;
                if (!declaration || typeof declaration !== 'object') { problems.push(`${at}: not an object.`); return; }
                const { Entity, Path, AnchorRole, Band, Fields } = declaration;
                if (typeof Entity !== 'string' || !Entity.trim()) problems.push(`${at}: Entity is required.`);
                if (typeof Path !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(Path)) problems.push(`${at}: Path must be a column, or one hop: Column.Column.`);
                if (typeof AnchorRole !== 'string' || !AnchorRole.trim()) problems.push(`${at}: AnchorRole is required.`);
                if (Band !== 'Team' && Band !== 'Shared') problems.push(`${at}: Band must be Team or Shared.`);
                if (!Array.isArray(Fields) || !Fields.length || Fields.some((f) => typeof f !== 'string' || !f.trim())) problems.push(`${at}: Fields must be a non-empty list of field names.`);
                declarations.push({ root, typeId, code, at, Entity, Path, AnchorRole, Band, Fields: Array.isArray(Fields) ? Fields : [] });
            });
        }
    }
    return { declarations, problems };
}

async function connect() {
    const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD, DB_TRUST_SERVER_CERTIFICATE } = process.env;
    if (!DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) throw new Error('DB_DATABASE, DB_USERNAME and DB_PASSWORD must be set: the declarations are checked against the database.');
    return new sql.ConnectionPool({
        server: DB_HOST ?? 'localhost',
        port: Number(DB_PORT ?? 1433),
        database: DB_DATABASE,
        user: DB_USERNAME,
        password: DB_PASSWORD,
        requestTimeout: 60000,
        options: { encrypt: true, trustServerCertificate: DB_TRUST_SERVER_CERTIFICATE !== '0' && DB_TRUST_SERVER_CERTIFICATE !== 'false' },
    }).connect();
}

/** The database's metadata for one entity: its table, its fields with their types, and the related entity each foreign key points at. */
async function describeEntity(pool, name) {
    const entity = (await pool.request().input('name', sql.NVarChar(255), name).query(
        'SELECT ID, Name, SchemaName, BaseTable, EnableFieldLevelSecurity FROM __mj.Entity WHERE Name = @name',
    )).recordset[0];
    if (!entity) return null;
    const fields = (await pool.request().input('id', sql.UniqueIdentifier, entity.ID).query(
        'SELECT f.Name, f.Type, f.IsPrimaryKey, f.RelatedEntityID, re.Name AS RelatedEntity, re.SchemaName AS RelatedSchema, re.BaseTable AS RelatedTable, f.RelatedEntityFieldName FROM __mj.EntityField f LEFT JOIN __mj.Entity re ON re.ID = f.RelatedEntityID WHERE f.EntityID = @id',
    )).recordset;
    return { ...entity, fields };
}

const quote = (name) => `[${name.replace(/]/g, ']]')}]`;

/** The anchor subquery: the record ids of anchors with the role, on reachable spaces of the type (Team: where the caller sees Team). */
function anchorIds(declaration) {
    const team = declaration.Band === 'Team' ? ' AND f.CanSeeTeam = 1' : '';
    return `SELECT a.RecordID FROM [${COLLAB_SCHEMA}].[SpaceAnchor] AS a INNER JOIN [${COLLAB_SCHEMA}].[fnCollaborationAccess](TRY_CAST('{{UserID}}' AS UNIQUEIDENTIFIER)) AS f ON f.SpaceID = a.SpaceID INNER JOIN [${COLLAB_SCHEMA}].[Space] AS s ON s.ID = a.SpaceID WHERE a.Role = N'${declaration.AnchorRole.replace(/'/g, "''")}' AND s.SpaceTypeID = '${declaration.typeId}'${team}`;
}

/** An anchor's RecordID is spelled `<PK>|<value>`; the value is what the path's column holds. */
const recordValue = (column, type) => {
    const value = `SUBSTRING(x.RecordID, CHARINDEX('|', x.RecordID) + 1, 450)`;
    return type.toLowerCase() === 'uniqueidentifier' ? `TRY_CAST(${value} AS UNIQUEIDENTIFIER)` : value;
};

/** One type's clause for one entity. */
function clauseFor(declaration, entity, related) {
    const [first, second] = declaration.Path.split('.');
    const column = entity.fields.find((f) => f.Name.toLowerCase() === first.toLowerCase());
    const ids = `SELECT ${recordValue(column.Name, second ? related.column.Type : column.Type)} FROM (${anchorIds(declaration)}) AS x`;
    if (!second) return `${quote(column.Name)} IN (${ids})`;
    const pk = related.entity.fields.find((f) => f.IsPrimaryKey);
    return `${quote(column.Name)} IN (SELECT r.${quote(pk.Name)} FROM [${related.entity.SchemaName}].[${related.entity.BaseTable}] AS r WHERE r.${quote(related.column.Name)} IN (${ids}))`;
}

async function main() {
    const { declarations, problems } = collectDeclarations();
    if (!declarations.length && !problems.length) {
        console.log('No type declares a data reach; nothing to generate.');
        return finish([]);
    }
    const pool = await connect();
    const entities = new Map();
    const perEntity = new Map(); // entity name → { root, entity, clauses: [], fields: Set, declarations: [] }
    const warnings = [];
    try {
        for (const declaration of declarations) {
            if (!declaration.Entity) continue;
            let entity = entities.get(declaration.Entity);
            if (entity === undefined) {
                entity = await describeEntity(pool, declaration.Entity);
                entities.set(declaration.Entity, entity);
            }
            if (!entity) { problems.push(`${declaration.at}: no entity named "${declaration.Entity}".`); continue; }
            const [first, second] = declaration.Path.split('.');
            const column = entity.fields.find((f) => f.Name.toLowerCase() === first.toLowerCase());
            if (!column) { problems.push(`${declaration.at}: ${entity.Name} has no column ${first}.`); continue; }
            let related = null;
            if (second) {
                if (!column.RelatedEntityID) { problems.push(`${declaration.at}: ${first} is not a foreign key, so the hop ${declaration.Path} is not real.`); continue; }
                let relatedEntity = entities.get(column.RelatedEntity);
                if (relatedEntity === undefined) { relatedEntity = await describeEntity(pool, column.RelatedEntity); entities.set(column.RelatedEntity, relatedEntity); }
                const relatedColumn = relatedEntity?.fields.find((f) => f.Name.toLowerCase() === second.toLowerCase());
                if (!relatedEntity || !relatedColumn) { problems.push(`${declaration.at}: ${column.RelatedEntity} has no column ${second}.`); continue; }
                related = { entity: relatedEntity, column: relatedColumn };
            }
            for (const field of declaration.Fields) {
                if (!entity.fields.some((f) => f.Name.toLowerCase() === field.toLowerCase())) problems.push(`${declaration.at}: ${entity.Name} has no field ${field}.`);
            }
            const bucket = perEntity.get(entity.Name) ?? { root: declaration.root, entity, clauses: [], fields: new Set(), declarations: [] };
            if (bucket.root !== declaration.root) { problems.push(`${declaration.at}: ${entity.Name} is declared by a shipped type and by a test type; one filter per entity lives in one place.`); continue; }
            bucket.clauses.push(clauseFor(declaration, entity, related));
            for (const field of declaration.Fields) bucket.fields.add(entity.fields.find((f) => f.Name.toLowerCase() === field.toLowerCase())?.Name ?? field);
            bucket.declarations.push(declaration);
            perEntity.set(entity.Name, bucket);
            if (!entity.EnableFieldLevelSecurity) warnings.push(`${entity.Name}: EnableFieldLevelSecurity is off, so the field allow-list does not deny anything yet; the app that owns the entity turns it on in its own metadata.`);
        }
    } finally {
        await pool.close();
    }
    if (problems.length) {
        for (const problem of problems) console.error(`✖ ${problem}`);
        process.exit(1);
    }
    for (const warning of warnings) console.warn(`⚠ ${warning}`);

    // The files, per metadata root
    const outputs = new Map(); // root → { filters: [], permissions: [], fieldPermissions: [] }
    for (const [name, bucket] of [...perEntity.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const out = outputs.get(bucket.root) ?? { filters: [], permissions: [], fieldPermissions: [] };
        const filterName = `Collaboration: Data Reach - ${name}`;
        const types = bucket.declarations.map((d) => `${d.code} (${d.Band}, ${d.Path} -> Anchor:${d.AnchorRole})`).join('; ');
        out.filters.push({
            primaryKey: { ID: idFrom(`MJ_DATA_REACH_FILTER:${name}`) },
            fields: {
                Name: filterName,
                Description: `Generated by scripts/generate-data-reach-filters.mjs from the types' DataReach declarations (D28): the ${name} rows whose path value is the record of an anchor on a space the caller reaches, for ${types}. Do not edit by hand.`,
                FilterText: `(${bucket.clauses.join(' OR ')})`,
            },
        });
        out.permissions.push({
            primaryKey: { ID: idFrom(`MJ_DATA_REACH_PERMISSION:${name}`) },
            fields: {
                EntityID: `@lookup:MJ: Entities.Name=${name}`,
                RoleID: `@lookup:MJ: Roles.Name=${PARTICIPANT_ROLE}`,
                Type: 'Allow',
                CanCreate: 0,
                CanRead: 1,
                CanUpdate: 0,
                CanDelete: 0,
                ReadRLSFilterID: `@lookup:MJ: Row Level Security Filters.Name=${filterName}`,
            },
        });
        // Every readable field of the entity gets a row: the listed ones Allow, the rest Deny, so MJ's snapshot of Allow rows cannot widen the list
        const allowed = new Set([...bucket.fields].map((f) => f.toLowerCase()));
        const everyField = bucket.entity.fields.filter((f) => !f.IsPrimaryKey && !f.Name.startsWith('__mj_')).map((f) => f.Name).sort();
        for (const field of everyField) {
            out.fieldPermissions.push({
                primaryKey: { ID: idFrom(`MJ_DATA_REACH_FIELD:${name}:${field}`) },
                fields: {
                    EntityFieldID: `@lookup:MJ: Entity Fields.Name=${field}&Entity=${name}`,
                    RoleID: `@lookup:MJ: Roles.Name=${PARTICIPANT_ROLE}`,
                    ReadAccess: allowed.has(field.toLowerCase()) ? 'Allow' : 'Deny',
                    UpdateAccess: 'No Access',
                    CreateAccess: 'No Access',
                },
            });
        }
        outputs.set(bucket.root, out);
    }
    const files = [];
    for (const [root, out] of outputs) {
        files.push({ path: `${root}/row-level-security-filters/.data-reach-filters.json`, rows: out.filters, sync: syncFile('MJ: Row Level Security Filters', '.data-reach-filters.json', "Name LIKE 'Collaboration: Data Reach - %'") });
        files.push({ path: `${root}/entity-permissions/.data-reach-permissions.json`, rows: out.permissions, sync: null });
        files.push({ path: `${root}/entity-field-permissions/.data-reach-field-permissions.json`, rows: out.fieldPermissions, sync: syncFile('MJ: Entity Field Permissions', '.data-reach-field-permissions.json', "RoleID='AAF434FD-EF58-4857-854E-2607ACAF763B'") });
    }
    return finish(files);
}

function syncFile(entity, newFileName, filter) {
    return {
        entity,
        filePattern: '**/.*.json',
        defaults: {},
        pull: {
            createNewFileIfNotFound: true, newFileName, appendRecordsToExistingFile: true, updateExistingRecords: true, preserveFields: [], excludeFields: [],
            mergeStrategy: 'merge', backupBeforeUpdate: true, backupDirectory: '.backups', filter, externalizeFields: [], ignoreNullFields: true, ignoreVirtualFields: true, lookupFields: {}, relatedEntities: {},
        },
    };
}

/** Writes, checks or prints the files. Exit 1 under --check when any differs. */
function finish(files) {
    let stale = 0;
    for (const file of files) {
        const path = resolve(repoRoot, file.path);
        const text = JSON.stringify(file.rows, null, 2) + '\n';
        const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
        const dir = dirname(path);
        const syncPath = resolve(dir, '.mj-sync.json');
        if (dryRun) { console.log(`--- ${file.path}\n${text}`); continue; }
        if (check) {
            // `mj sync push` appends a `sync` block to each row it pushes (CI checks after the push), so the comparison ignores those blocks
            if (withoutSyncBlocks(current) !== text) {
                console.error(`✖ ${file.path} is ${current === null ? 'missing' : 'stale'}: run node scripts/generate-data-reach-filters.mjs`);
                if (current !== null) console.error(firstDifference(withoutSyncBlocks(current), text));
                stale += 1;
            } else console.log(`✓ ${file.path}`);
            continue;
        }
        mkdirSync(dir, { recursive: true });
        if (file.sync && !existsSync(syncPath)) writeFileSync(syncPath, JSON.stringify(file.sync, null, 2) + '\n');
        if (current !== text) { writeFileSync(path, text); console.log(`wrote ${file.path} (${file.rows.length} rows)`); }
        else console.log(`unchanged ${file.path}`);
    }
    if (check && stale) process.exit(1);
}

/** The file's rows as the generator writes them: without the `sync` block the push adds. Unparseable text is compared as it is. */
function withoutSyncBlocks(text) {
    if (text === null) return null;
    try {
        const rows = JSON.parse(text);
        if (!Array.isArray(rows)) return text;
        return JSON.stringify(rows.map(({ sync, ...row }) => row), null, 2) + '\n';
    } catch {
        return text;
    }
}

/** The first line where two texts differ, for the CI log. */
function firstDifference(current, expected) {
    const a = current.split('\n');
    const b = expected.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        if (a[i] !== b[i]) return `  line ${i + 1}:\n    on disk:  ${a[i] ?? '(end of file)'}\n    expected: ${b[i] ?? '(end of file)'}`;
    }
    return '  (the texts differ only in length)';
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
