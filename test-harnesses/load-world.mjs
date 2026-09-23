#!/usr/bin/env node
/**
 * Load COLLAB-WORLD through the entity gates and commit it.
 *
 * Owners are seated before anyone else. A root is created by its owner.
 * A child is created by an owner of the parent. Rows the gates refuse,
 * such as a second owner seat on a space the owner already reaches, are
 * saved as the system user and listed at the end.
 *
 * ClosedAt words are offsets from this run: recent is 7 days, past is 400.
 *
 * Usage: node --env-file=.env test-harnesses/load-world.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sql from 'mssql';

const require = createRequire(import.meta.url);
const { UserCache } = createRequire(require.resolve('@memberjunction/sqlserver-dataprovider/package.json'))(
    '@memberjunction/generic-database-provider',
);

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'packages/IntegrationTests/src/world/data');
const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const TYPES = 'MJ_BizApps_Collaboration: Space Types';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';
const systemRows = [];

function csv(name) {
    const lines = readFileSync(join(dataDir, name), 'utf8').split(/\r?\n/).filter((line) => line.trim());
    const headers = lines[0].split(',').map((cell) => cell.trim());
    return lines.slice(1).map((line) => {
        const cells = line.split(',').map((cell) => cell.trim());
        return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    });
}

function closedAt(word) {
    if (!word) return null;
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (word === 'recent' ? 7 : 400));
    return date;
}

const { setupSQLServerClient, SQLServerProviderConfigData } = await import('@memberjunction/sqlserver-dataprovider');
const { Metadata, RunView } = await import('@memberjunction/core');

const pool = await new sql.ConnectionPool({
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    options: { trustServerCertificate: true, encrypt: false },
}).connect();
const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
await UserCache.Instance.Refresh(pool);
const system = UserCache.Users.find((user) => user?.Type?.trim().toLowerCase() === 'owner') ?? UserCache.Users[0];
if (!system) throw new Error('No system user.');
await import('@mj-biz-apps/collaboration-server').then((mod) => mod.LoadBizAppsCollaborationServer());

async function findId(entityName, filter, user = system) {
    const view = new RunView(provider);
    const result = await view.RunView({ EntityName: entityName, ExtraFilter: filter, Fields: ['ID'], MaxRows: 1, ResultType: 'simple' }, user);
    if (!result.Success) throw new Error(`${entityName}: ${result.ErrorMessage}`);
    return result.Results?.[0]?.ID ?? null;
}

async function save(entityName, id, fields, user, label, allowSystem = true) {
    const entity = await new Metadata().GetEntityObject(entityName, user);
    const existing = id ? await findId(entityName, `ID = '${id}'`, system) : null;
    if (existing) {
        if (!(await entity.Load(existing))) throw new Error(`Could not load ${label}`);
    } else {
        entity.NewRecord();
        if (id) entity.Set('ID', id);
    }
    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) entity.Set(key, value);
    }
    if (await entity.Save()) return { id: entity.Get('ID'), system: user === system };
    const message = entity.LatestResult?.Errors?.map((error) => error.Message).join('; ') || entity.LatestResult?.CompleteMessage || 'save failed';
    if (!allowSystem || user === system) throw new Error(`${label}: ${message}`);
    systemRows.push(`${label}: ${message}`);
    return save(entityName, id, fields, system, label, false);
}

const personas = csv('personas.csv');
const people = new Map();
for (const persona of personas) {
    let id = await findId('MJ: Users', `Email = '${persona.Email.replace(/'/g, "''")}'`);
    if (!id) {
        const created = await save('MJ: Users', persona.ID, {
            Name: `${persona.FirstName} ${persona.LastName}`,
            Email: persona.Email,
            Type: 'User',
        }, system, `user ${persona.Key}`);
        id = created.id;
    }
    const roleId = await findId('MJ: Roles', `Name = '${persona.MjRole.replace(/'/g, "''")}'`);
    if (!roleId) throw new Error(`Missing role ${persona.MjRole}`);
    const linked = await findId('MJ: User Roles', `UserID = '${id}' AND RoleID = '${roleId}'`);
    if (!linked) {
        await save('MJ: User Roles', null, { UserID: id, RoleID: roleId }, system, `role ${persona.Key}`);
    }
    people.set(persona.Key, { ...persona, id });
}
await UserCache.Instance.Refresh(pool);
function asUser(key) {
    const id = people.get(key).id;
    return UserCache.Users.find((user) => user.ID.toLowerCase() === id.toLowerCase()) ?? { ID: id, Name: key };
}

const types = new Map();
for (const code of ['workspace', 'committee', 'cohort']) {
    const id = await findId(TYPES, `Code = '${code}'`);
    if (!id) throw new Error(`Seeded type ${code} is missing. Run the migrations first.`);
    types.set(code, id);
}
for (const type of csv('types.csv')) {
    const saved = await save(TYPES, type.ID, {
        Code: type.Code,
        Name: type.Name,
        Vocabulary: type.Name,
        InviteApproval: type.InviteApproval,
        MemberCap: type.MemberCap ? Number(type.MemberCap) : null,
        DefaultRetention: type.DefaultRetention,
    }, system, `type ${type.Key}`);
    types.set(type.Key, saved.id);
}

const roles = new Map();
for (const code of ['owner', 'admin', 'member', 'guest', 'client-admin', 'client-member']) {
    const id = await findId(ROLES, `Code = '${code}'`);
    if (!id) throw new Error(`Seeded role ${code} is missing.`);
    roles.set(code, id);
}

const spaces = csv('spaces.csv');
const byKey = new Map(spaces.map((space) => [space.Key, space]));
const spaceIds = new Map();

async function createSpace(space) {
    const owner = asUser(space.Owner);
    const saved = await save(SPACES, space.ID, {
        Name: space.Name,
        SpaceTypeID: types.get(space.Type),
        OwnerID: people.get(space.Owner).id,
        ParentID: space.Parent ? spaceIds.get(space.Parent) : null,
        InheritsMembership: space.InheritsMembership === '1',
        AgentRetrieval: space.AgentRetrieval,
        ClosedAt: closedAt(space.ClosedAt),
        Retention: space.Retention || null,
    }, owner, `space ${space.Key}`);
    spaceIds.set(space.Key, saved.id);
}

async function seatOwner(space) {
    const existing = await findId(MEMBERS, `SpaceID = '${spaceIds.get(space.Key)}' AND UserID = '${people.get(space.Owner).id}'`);
    if (existing) return;
    await save(MEMBERS, null, {
        SpaceID: spaceIds.get(space.Key),
        UserID: people.get(space.Owner).id,
        SpaceRoleTypeID: roles.get('owner'),
        Band: 'Team',
        Status: 'Active',
    }, asUser(space.Owner), `owner seat ${space.Owner} on ${space.Key}`);
}

for (const space of spaces.filter((row) => !row.Parent)) {
    await createSpace(space);
    await seatOwner(space);
}
const pending = spaces.filter((row) => row.Parent);
while (pending.length) {
    const ready = pending.filter((space) => spaceIds.has(space.Parent));
    if (!ready.length) throw new Error(`Could not order spaces: ${pending.map((space) => space.Key).join(', ')}`);
    for (const space of ready) {
        pending.splice(pending.indexOf(space), 1);
        await createSpace(space);
        await seatOwner(space);
    }
}

const members = csv('members.csv');
const ownersFirst = [...members.filter((row) => row.Role === 'owner'), ...members.filter((row) => row.Role !== 'owner')];
for (const row of ownersFirst) {
    const space = byKey.get(row.Space);
    const actor = row.Role === 'owner' && row.Status === 'Active' ? asUser(row.Person) : asUser(space.Owner);
    const existing = await findId(MEMBERS, `SpaceID = '${spaceIds.get(row.Space)}' AND UserID = '${people.get(row.Person).id}'`);
    await save(MEMBERS, existing, {
        SpaceID: spaceIds.get(row.Space),
        UserID: people.get(row.Person).id,
        SpaceRoleTypeID: roles.get(row.Role),
        Band: row.Band,
        Status: row.Status,
    }, actor, `member ${row.Person} on ${row.Space}`);
}

console.log(`COLLAB-WORLD loaded into ${process.env.DB_DATABASE}.`);
if (systemRows.length) {
    console.log('Saved as the system user:');
    for (const line of systemRows) console.log(`  ${line}`);
} else {
    console.log('Every row passed the gate as the acting member.');
}
await pool.close();
