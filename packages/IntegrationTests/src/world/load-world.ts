/**
 * Load COLLAB-WORLD through the entity gates and commit it.
 *
 * The system user writes users, their MemberJunction roles, People, and the
 * world-owned space type. Every space is saved by its owner. Every other seat
 * is saved by a member the gate accepts. An owner's invite is always Active,
 * so an Invited seat is created by a non-owner who can invite. A Removed seat
 * is created and then removed by the owner in the same run.
 *
 * An owner who already reaches a space through its parent may grant another
 * owner seat. This loader does not do that. It seats only the catalog.
 *
 * `recent` is 7 days before this run. `past` is 400 days. Any other word throws.
 *
 * A seat that already exists is left as it is. A drifted seat fails the
 * read-back instead of being repaired, so a suite reloads by purging first.
 * The purge keeps the user accounts.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Metadata, RunView, type UserInfo } from '@memberjunction/core';
import '@memberjunction/core-entities';
import { MJUserEntity, MJUserRoleEntity } from '@memberjunction/core-entities';
import { UserCache } from '@memberjunction/generic-database-provider';
import { SQLServerDataProvider, SQLServerProviderConfigData, setupSQLServerClient } from '@memberjunction/sqlserver-dataprovider';
import '@mj-biz-apps/common-entities';
import { mjBizAppsCommonPersonEntity } from '@mj-biz-apps/common-entities';
import '@mj-biz-apps/collaboration-entities';
import {
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    CollaborationEngine,
    LoadItemUseEntityServer,
    LoadShareNoticeEntityServer,
    LoadSpaceEntityServer,
    LoadSpaceItemEntityServer,
    LoadSpaceMemberEntityServer,
    createSpaceConversation,
    postSpaceMessage,
    syncRoomEditGrantsForSpace,
} from '@mj-biz-apps/collaboration-core-entities-server';
import sql from 'mssql';
import { readCsv } from './csv.js';
import { sqlUuid } from './ids.js';
import { seedWorldFiles, worldStorageRoot } from './seed-files.js';
import { seedWorldPlan } from './seed-plan.js';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const TYPES = 'MJ_BizApps_Collaboration: Space Types';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';
const USERS = 'MJ: Users';
const USER_ROLES = 'MJ: User Roles';
const PEOPLE = 'MJ_BizApps_Common: People';

type Row = Record<string, string>;
type Persona = Row & { id: string; roleId: string };

function dataDir(): string {
    const here = dirname(fileURLToPath(import.meta.url));
    const beside = join(here, 'data');
    return existsSync(join(beside, 'spaces.csv')) ? beside : join(here, '..', '..', 'src', 'world', 'data');
}

function closedAt(word: string): Date | null {
    if (!word) return null;
    if (word !== 'recent' && word !== 'past') throw new Error(`Unknown ClosedAt "${word}". Use recent, past, or leave it empty.`);
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (word === 'recent' ? 7 : 400));
    return date;
}

function quote(value: string): string {
    return value.replace(/'/g, "''");
}

async function memberStatus(provider: SQLServerDataProvider, id: string | null, user: UserInfo): Promise<string | null> {
    if (!id) return null;
    const view = RunView.FromMetadataProvider(provider);
    const result = await view.RunView<{ Status: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Members',
        ExtraFilter: `ID = '${id}'`,
        Fields: ['Status'],
        MaxRows: 1,
        ResultType: 'simple',
    }, user);
    return result.Success ? result.Results?.[0]?.Status?.trim() ?? null : null;
}

async function findId(provider: SQLServerDataProvider, entityName: string, filter: string, user: UserInfo): Promise<string | null> {
    const view = RunView.FromMetadataProvider(provider);
    const result = await view.RunView<{ ID: string }>({ EntityName: entityName, ExtraFilter: filter, Fields: ['ID'], MaxRows: 1, ResultType: 'simple' }, user);
    if (!result.Success) throw new Error(`${entityName}: ${result.ErrorMessage ?? 'the read failed'}`);
    return result.Results?.[0]?.ID ?? null;
}

function requireMap(map: Map<string, string>, key: string, label: string): string {
    const value = map.get(key);
    if (!value) throw new Error(`Unknown ${label} ${key}.`);
    return value;
}

export async function loadWorld(): Promise<void> {
    const { DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD } = process.env;
    if (!DB_HOST || !DB_DATABASE || !DB_USERNAME || !DB_PASSWORD) throw new Error('Set DB_HOST, DB_DATABASE, DB_USERNAME and DB_PASSWORD.');
    const pool = await new sql.ConnectionPool({
        server: DB_HOST,
        port: Number(DB_PORT ?? 1433),
        database: DB_DATABASE,
        user: DB_USERNAME,
        password: DB_PASSWORD,
        options: { trustServerCertificate: true, encrypt: false },
    }).connect();
    const provider = await setupSQLServerClient(new SQLServerProviderConfigData(pool, process.env.MJ_CORE_SCHEMA || '__mj'));
    const owner = UserCache.Users.find((user) => user?.Type?.trim().toLowerCase() === 'owner');
    if (!owner) throw new Error('No Owner-type user. The loader will not guess.');
    const system: UserInfo = owner;
    if (!new Metadata().EntityByName(PEOPLE)) {
        throw new Error(`${PEOPLE} is not in this database. Install bizapps-common before loading the world.`);
    }
    // Common.LogActivity stays unloaded. On this one shared provider its post-commit
    // save interleaves with the entity save and rolls the user back.
    LoadSpaceEntityServer();
    LoadSpaceMemberEntityServer();
    LoadSpaceItemEntityServer();
    LoadItemUseEntityServer();
    LoadShareNoticeEntityServer();
    const dir = dataDir();
    const personas = readCsv(join(dir, 'personas.csv'));
    const typeRows = readCsv(join(dir, 'types.csv'));
    const spaceRows = readCsv(join(dir, 'spaces.csv'));
    const memberRows = readCsv(join(dir, 'members.csv'));

    const people = new Map<string, Persona>();
    for (const persona of personas) {
        const byEmail = await findId(provider, USERS, `Email = '${quote(persona.Email)}'`, system);
        const byId = await findId(provider, USERS, `ID = '${persona.ID}'`, system);
        if (byEmail && byId && byEmail.toLowerCase() !== byId.toLowerCase()) {
            throw new Error(`${persona.Email} is already a different user than ${persona.ID}.`);
        }
        if (byEmail && !byId) throw new Error(`${persona.Email} already belongs to ${byEmail}, not catalog id ${persona.ID}.`);
        if (byId && !byEmail) throw new Error(`${persona.ID} already exists with a different email than ${persona.Email}.`);
        let id = byId ?? byEmail;
        if (!id) {
            const user = await new Metadata().GetEntityObject<MJUserEntity>(USERS, system);
            user.NewRecord();
            user.ID = persona.ID;
            user.Name = `${persona.FirstName} ${persona.LastName}`;
            user.Email = persona.Email;
            user.Type = 'User';
            user.IsActive = true;
            if (!(await user.Save())) throw new Error(`user ${persona.Key}: ${user.LatestResult?.CompleteMessage ?? 'save failed'}`);
            id = user.ID;
        } else {
            const existing = await new Metadata().GetEntityObject<MJUserEntity>(USERS, system);
            if (!(await existing.Load(id))) throw new Error(`Could not load user ${persona.Key}.`);
            if (!existing.IsActive) {
                existing.IsActive = true;
                if (!(await existing.Save())) throw new Error(`user ${persona.Key}: could not activate the account.`);
            }
        }
        const roleId = await findId(provider, 'MJ: Roles', `Name = '${quote(persona.MjRole)}'`, system);
        if (!roleId) throw new Error(`Missing MemberJunction role ${persona.MjRole}.`);
        if (!(await findId(provider, USER_ROLES, `UserID = '${id}' AND RoleID = '${roleId}'`, system))) {
            const link = await new Metadata().GetEntityObject<MJUserRoleEntity>(USER_ROLES, system);
            link.NewRecord();
            link.UserID = id;
            link.RoleID = roleId;
            if (!(await link.Save())) throw new Error(`role ${persona.Key}: ${link.LatestResult?.CompleteMessage ?? 'save failed'}`);
        }
        const personId = await findId(provider, PEOPLE, `LinkedUserID = '${id}'`, system);
        if (!personId) {
            const person = await new Metadata().GetEntityObject<mjBizAppsCommonPersonEntity>(PEOPLE, system);
            person.NewRecord();
            person.FirstName = persona.FirstName;
            person.LastName = persona.LastName;
            person.Email = persona.Email;
            person.LinkedUserID = id;
            if (!(await person.Save())) throw new Error(`person ${persona.Key}: ${person.LatestResult?.CompleteMessage ?? 'save failed'}`);
        }
        people.set(persona.Key, { ...persona, id, roleId });
    }
    await UserCache.Instance.Refresh(provider);
    const actor = (key: string): UserInfo => {
        const id = people.get(key)?.id;
        if (!id) throw new Error(`Unknown persona ${key}.`);
        const cached = UserCache.Users.find((user) => user.ID.toLowerCase() === id.toLowerCase());
        if (!cached) throw new Error(`User cache has no ${key} after refresh.`);
        return cached;
    };

    const types = new Map<string, string>();
    for (const code of ['workspace', 'cohort']) {
        const id = await findId(provider, TYPES, `Code = '${code}'`, system);
        if (!id) throw new Error(`Seeded type ${code} is missing. Run the Collaboration migrations first.`);
        types.set(code, id);
    }
    for (const type of typeRows) {
        const record = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(TYPES, system);
        const existing = await findId(provider, TYPES, `ID = '${type.ID}'`, system);
        if (existing) {
            if (!(await record.Load(existing))) throw new Error(`Could not load type ${type.Key}.`);
        } else {
            record.NewRecord();
            record.ID = type.ID;
        }
        record.Code = type.Code;
        record.Name = type.Name;
        record.Vocabulary = type.Name;
        record.InviteApproval = type.InviteApproval as 'Approve' | 'AutoApprove';
        record.MemberCap = type.MemberCap ? Number(type.MemberCap) : null;
        record.DefaultRetention = type.DefaultRetention as 'Month' | 'Year' | 'Indefinite';
        if (!(await record.Save())) throw new Error(`type ${type.Key}: ${record.LatestResult?.CompleteMessage ?? 'save failed'}`);
        types.set(type.Key, record.ID);
    }
    await CollaborationEngine.Instance.Config(true, system, provider);

    const roles = new Map<string, string>();
    for (const code of ['owner', 'admin', 'member', 'guest', 'client-admin', 'client-member']) {
        const id = await findId(provider, ROLES, `Code = '${code}'`, system);
        if (!id) throw new Error(`Seeded role ${code} is missing.`);
        roles.set(code, id);
    }

    const spaceIds = new Map<string, string>();
    const seated = new Set<string>();
    const seatKey = (spaceKey: string, personKey: string) => `${spaceKey}\0${personKey}`;

    const saveSpace = async (space: Row) => {
        const typeId = requireMap(types, space.Type, 'space type');
        const parentSpace = space.Parent ? spaceRows.find((item) => item.Key === space.Parent) : null;
        const creator = parentSpace ? actor(parentSpace.Owner) : actor(space.Owner);
        const existing = await findId(provider, SPACES, `ID = '${space.ID}'`, system);
        const record = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceEntity>(
            SPACES,
            existing ? actor(space.Owner) : creator
        );
        if (existing) {
            if (!(await record.Load(existing))) throw new Error(`Could not load space ${space.Key}.`);
        } else {
            record.NewRecord();
            record.ID = space.ID;
        }
        record.Name = space.Name;
        record.SpaceTypeID = typeId;
        record.OwnerID = people.get(space.Owner)?.id ?? '';
        if (!record.OwnerID) throw new Error(`Space ${space.Key} names unknown owner ${space.Owner}.`);
        record.ParentID = space.Parent ? requireMap(spaceIds, space.Parent, 'parent space') : null;
        record.InheritsMembership = space.InheritsMembership === '1';
        record.AgentRetrieval = space.AgentRetrieval as 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
        record.ClosedAt = null;
        record.Retention = (space.Retention || null) as 'Month' | 'Year' | 'Indefinite' | null;
        record.IconClass = space.IconClass || null;
        record.Color = space.Color || null;
        record.BackgroundImageURL = space.BackgroundImageURL || null;
        if (!(await record.Save())) throw new Error(`space ${space.Key}: ${record.LatestResult?.CompleteMessage ?? 'save failed'}`);
        spaceIds.set(space.Key, record.ID);
    };

    async function saveMember(row: Row): Promise<void> {
        const spaceId = spaceIds.get(row.Space);
        const userId = people.get(row.Person)?.id;
        if (!spaceId || !userId) throw new Error(`Bad member row ${row.Person} on ${row.Space}.`);
        const roleId = requireMap(roles, row.Role, 'role');
        const space = spaceRows.find((item) => item.Key === row.Space);
        if (!space) throw new Error(`Member row names unknown space ${row.Space}.`);
        const inviter = row.Status === 'Invited' ? nonOwnerInviter(row.Space) : space.Owner;
        // The space's own owner seats themselves first; any other owner is seated by the space's owner
        const who = actor(row.Role === 'owner' && row.Person === space.Owner ? row.Person : inviter);
        let record = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(MEMBERS, who);
        const existing = await findId(provider, MEMBERS, `SpaceID = '${spaceId}' AND UserID = '${userId}'`, system);
        if (!existing) {
            record.NewRecord();
            record.SpaceID = spaceId;
            record.UserID = userId;
            record.SpaceRoleTypeID = roleId;
            record.Band = row.Band as 'Team' | 'Shared';
            record.Status = 'Active';
            if (!(await record.Save())) throw new Error(`member ${row.Person} on ${row.Space}: ${record.LatestResult?.CompleteMessage ?? 'save failed'}`);
            if (row.Status !== 'Removed' && record.Status.trim() !== row.Status) {
                throw new Error(`${row.Person} on ${row.Space} saved as ${record.Status.trim()}, catalog says ${row.Status}.`);
            }
        }
        if (row.Status === 'Removed') {
            const id = existing ?? await findId(provider, MEMBERS, `SpaceID = '${spaceId}' AND UserID = '${userId}'`, system);
            const current = await memberStatus(provider, id, system);
            if (current !== 'Removed') {
                record = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(MEMBERS, actor(space.Owner));
                if (!id || !(await record.Load(id))) throw new Error(`Could not reload ${row.Person} on ${row.Space} to remove them.`);
                record.Status = 'Removed';
                if (!(await record.Save())) throw new Error(`remove ${row.Person} on ${row.Space}: ${record.LatestResult?.CompleteMessage ?? 'save failed'}`);
            }
        }
        seated.add(seatKey(row.Space, row.Person));
    }

    function nonOwnerInviter(spaceKey: string): string {
        const member = memberRows.find((row) => row.Space === spaceKey && row.Role === 'member' && row.Status === 'Active' && seated.has(seatKey(spaceKey, row.Person)));
        if (!member) throw new Error(`${spaceKey} has an Invited seat but no active member who can invite is seated yet.`);
        return member.Person;
    }

    const pending = [...spaceRows];
    while (pending.length) {
        const ready = pending.filter((space) => !space.Parent || spaceIds.has(space.Parent));
        if (!ready.length) throw new Error(`Could not order spaces: ${pending.map((space) => space.Key).join(', ')}`);
        for (const space of ready) {
            pending.splice(pending.indexOf(space), 1);
            await saveSpace(space);
        }
        for (const space of ready) {
            for (const row of memberRows.filter((member) => member.Space === space.Key && member.Role === 'owner')) {
                await saveMember(row);
            }
        }
    }
    for (const row of memberRows.filter((member) => member.Role !== 'owner')) await saveMember(row);

    // One General conversation in Studio, Sealed child and Closed this month: the chat area draws its composer (and a closed
    // space's banner) only for an open conversation. Closed this month's is made before the close below, which archives it.
    await seedSpaceConversations('studio', 'ada', 'sam', true);
    await seedSpaceConversations('sealed-child', 'sam', 'ada', true);
    await seedSpaceConversations('closed-recent', 'ada', 'bea', true);

    for (const space of spaceRows.filter((s) => s.ClosedAt)) {
        const spaceId = spaceIds.get(space.Key);
        const parentSpace = space.Parent ? spaceRows.find((item) => item.Key === space.Parent) : null;
        const creator = parentSpace ? actor(parentSpace.Owner) : actor(space.Owner);
        const record = await new Metadata().GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACES, creator);
        if (spaceId && (await record.Load(spaceId))) {
            record.ClosedAt = closedAt(space.ClosedAt);
            if (!(await record.Save())) throw new Error(`closing space ${space.Key}: ${record.LatestResult?.CompleteMessage ?? 'save failed'}`);
        }
    }

    await seedWorldPlan({
        provider,
        actor,
        spaceId: (key) => {
            const id = spaceIds.get(key);
            if (!id) throw new Error(`Unknown space ${key}.`);
            return id;
        },
    });

    await seedWorldFiles({
        provider,
        system,
        actor,
        spaceId: (key) => {
            const id = spaceIds.get(key);
            if (!id) throw new Error(`Unknown space ${key}.`);
            return id;
        },
        dataDir: dir,
        rootDir: worldStorageRoot(),
    });


    async function seedSpaceConversations(
        spaceKey: string,
        teamActorKey: string,
        otherActorKey: string,
        generalOnly = false,
    ) {
        const targetSpaceId = spaceIds.get(spaceKey);
        if (!targetSpaceId) {
            throw new Error(`seedSpaceConversations: space ${spaceKey} not found`);
        }
        const spaceId: string = targetSpaceId;
        const view = RunView.FromMetadataProvider(provider);

        async function ensureConvoAndPosts(
            name: string,
            kind: 'General' | 'Topic' | 'Private',
            creatorKey: string,
            posts: Array<{ actorKey: string; text: string }>
        ) {
            const existingRes = await view.RunView<{ ID: string; ConversationID: string }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                ExtraFilter: `SpaceID = '${spaceId}' AND Name = '${name}' AND Kind = '${kind}' AND Status = 'Active'`,
                Fields: ['ID', 'ConversationID'],
                ResultType: 'simple',
                MaxRows: 1,
            }, system);
            if (!existingRes.Success) {
                throw new Error(`Failed to lookup existing space chat for ${name} in space ${spaceKey}: ${existingRes.ErrorMessage ?? 'unknown error'}`);
            }
            let convId: string | undefined = existingRes.Results?.[0]?.ConversationID;
            if (!convId) {
                const res = await createSpaceConversation(provider, actor(creatorKey), {
                    SpaceID: spaceId,
                    Name: name,
                    Kind: kind,
                });
                if (!res.ok || !res.conversationId) {
                    throw new Error(`Failed to create conversation ${name} in space ${spaceKey}: ${res.message}`);
                }
                convId = res.conversationId;
                const activeConvId: string = convId;
                for (const p of posts) {
                    const postRes = await postSpaceMessage(provider, actor(p.actorKey), {
                        spaceId,
                        conversationId: activeConvId,
                        text: p.text,
                    });
                    if (!postRes.ok) {
                        throw new Error(`Failed to post message in ${name} by ${p.actorKey}: ${postRes.message}`);
                    }
                }
            }
        }

        // 1. General conversation
        await ensureConvoAndPosts(
            `${spaceKey}-general`,
            'General',
            teamActorKey,
            [
                { actorKey: otherActorKey, text: `Thanks @{"type":"user","id":"${actor(teamActorKey).ID}","name":"${teamActorKey}"}! Looking forward to collaborating in ${spaceKey}.` },
                { actorKey: teamActorKey, text: `Let's keep discussions and general updates posted here.` },
            ]
        );

        // Spaces the UI pass opens need a conversation to show the composer, and a closed one its archived chat
        if (generalOnly) return;

        // 2. Topic conversation
        await ensureConvoAndPosts(
            `${spaceKey}-deliverables`,
            'Topic',
            teamActorKey,
            [
                { actorKey: otherActorKey, text: 'We are preparing the draft documentation for this workstream.' },
                { actorKey: teamActorKey, text: 'Sounds great, will review the draft once uploaded.' },
            ]
        );

        // 3. Private / Internal Only conversation (team members only)
        await ensureConvoAndPosts(
            `${spaceKey}-internal`,
            'Private',
            teamActorKey,
            [
                { actorKey: 'sam', text: 'Internal sync: reviewed preliminary findings and resource allocations.' },
                { actorKey: teamActorKey, text: 'Confirmed. Internal findings will remain in this private channel.' },
            ]
        );
    }

    await seedSpaceConversations('discovery', 'ada', 'bea');
    await seedSpaceConversations('northwind', 'ada', 'casey');
    await seedSpaceConversations('committee', 'ada', 'sam');

    for (const spaceId of spaceIds.values()) {
        const syncRes = await syncRoomEditGrantsForSpace(provider, spaceId);
        if (!syncRes.ok) {
            throw new Error(`Failed to sync room edit grants for space ${spaceId}: ${syncRes.message}`);
        }
    }

    await assertCatalog(provider, system, spaceRows, memberRows, personas, people, spaceIds, types, roles);
    console.log(`COLLAB-WORLD loaded into ${DB_DATABASE}. ${spaceRows.length} spaces, ${memberRows.length} seats, and the catalog files match.`);
    console.log('The system user wrote the users, their MemberJunction roles, the People rows, and the world-owned space type.');
    console.log('Each space was saved by its owner. Invited seats were saved by a non-owner who can invite. Removed seats were created, then removed by the owner.');
    await pool.close();
}

function asBool(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
}

function closedAgeDays(value: unknown): number | null {
    if (value == null || value === '') return null;
    const time = value instanceof Date ? value.getTime() : Date.parse(String(value));
    if (Number.isNaN(time)) throw new Error(`Unreadable ClosedAt ${String(value)}.`);
    return (Date.now() - time) / 86_400_000;
}

async function assertCatalog(
    provider: SQLServerDataProvider,
    user: UserInfo,
    spaceRows: Row[],
    memberRows: Row[],
    personas: Row[],
    people: Map<string, Persona>,
    spaceIds: Map<string, string>,
    types: Map<string, string>,
    roles: Map<string, string>,
): Promise<void> {
    const view = RunView.FromMetadataProvider(provider);
    for (const persona of personas) {
        const linked = people.get(persona.Key)?.id;
        if (!linked) throw new Error(`Missing user for ${persona.Key}.`);
        const person = await view.RunView<{ ID: string; LinkedUserID: string; FirstName: string; LastName: string }>({
            EntityName: PEOPLE,
            ExtraFilter: `LinkedUserID = '${linked}'`,
            Fields: ['ID', 'LinkedUserID', 'FirstName', 'LastName'],
            MaxRows: 1,
            ResultType: 'simple',
        }, user);
        if (!person.Success || !person.Results?.length) throw new Error(`No Person linked to ${persona.Key}.`);
        const row = person.Results[0];
        if (row.FirstName?.trim() !== persona.FirstName || row.LastName?.trim() !== persona.LastName) {
            throw new Error(`Person ${persona.Key} is ${row.FirstName} ${row.LastName}.`);
        }
    }
    const grants = await view.RunView<{ UserID: string; RoleID: string }>({
        EntityName: USER_ROLES,
        ExtraFilter: `UserID IN (${[...people.values()].map((persona) => sqlUuid(persona.id, persona.Key)).join(',')})`,
        Fields: ['UserID', 'RoleID'],
        ResultType: 'simple',
    }, user);
    if (!grants.Success) throw new Error(grants.ErrorMessage ?? 'Could not read MemberJunction roles.');
    for (const persona of people.values()) {
        const mine = (grants.Results ?? []).filter((grant) => grant.UserID.toLowerCase() === persona.id.toLowerCase());
        const expected = persona.roleId.toLowerCase();
        if (mine.length !== 1 || mine[0].RoleID.toLowerCase() !== expected) {
            throw new Error(`${persona.Key} has ${mine.length} MemberJunction roles. The catalog grants only ${persona.MjRole}.`);
        }
    }
    const accounts = await view.RunView<{ ID: string; IsActive: boolean | number }>({
        EntityName: USERS,
        ExtraFilter: `ID IN (${[...people.values()].map((persona) => sqlUuid(persona.id, persona.Key)).join(',')})`,
        Fields: ['ID', 'IsActive'],
        ResultType: 'simple',
    }, user);
    if (!accounts.Success) throw new Error(accounts.ErrorMessage ?? 'Could not read the accounts.');
    for (const persona of people.values()) {
        const account = (accounts.Results ?? []).find((row) => row.ID.toLowerCase() === persona.id.toLowerCase());
        const active = account?.IsActive === true || account?.IsActive === 1;
        if (!active) throw new Error(`${persona.Key} is not an active account.`);
    }
    const spaces = await view.RunView<{
        ID: string;
        Name: string;
        ParentID: string | null;
        OwnerID: string;
        SpaceTypeID: string;
        InheritsMembership: boolean;
        AgentRetrieval: string;
        Retention: string | null;
        ClosedAt: string | Date | null;
    }>({
        EntityName: SPACES,
        ExtraFilter: `ID IN (${spaceRows.map((row) => `'${row.ID}'`).join(',')})`,
        Fields: ['ID', 'Name', 'ParentID', 'OwnerID', 'SpaceTypeID', 'InheritsMembership', 'AgentRetrieval', 'Retention', 'ClosedAt'],
        ResultType: 'simple',
    }, user);
    if (!spaces.Success || spaces.Results?.length !== spaceRows.length) {
        throw new Error(`Expected ${spaceRows.length} spaces, read ${spaces.Results?.length ?? 0}. ${spaces.ErrorMessage ?? ''}`);
    }
    for (const row of spaceRows) {
        const found = spaces.Results?.find((space) => space.ID.toLowerCase() === row.ID.toLowerCase());
        if (!found) throw new Error(`Missing space ${row.Key}.`);
        const parentId = row.Parent ? spaceIds.get(row.Parent) ?? null : null;
        const foundParent = found.ParentID ? found.ParentID.toLowerCase() : null;
        if (found.Name?.trim() !== row.Name) throw new Error(`${row.Key} is named ${found.Name}.`);
        if (foundParent !== (parentId ? parentId.toLowerCase() : null)) throw new Error(`${row.Key} parent does not match the catalog.`);
        if (found.OwnerID.toLowerCase() !== people.get(row.Owner)!.id.toLowerCase()) throw new Error(`${row.Key} owner does not match the catalog.`);
        if (found.SpaceTypeID.toLowerCase() !== requireMap(types, row.Type, 'space type').toLowerCase()) throw new Error(`${row.Key} type does not match the catalog.`);
        if (asBool(found.InheritsMembership) !== (row.InheritsMembership === '1')) throw new Error(`${row.Key} inheritance does not match the catalog.`);
        if (String(found.AgentRetrieval).trim() !== row.AgentRetrieval) throw new Error(`${row.Key} agent retrieval is ${found.AgentRetrieval}.`);
        if ((found.Retention?.trim() || null) !== (row.Retention || null)) throw new Error(`${row.Key} retention is ${found.Retention}.`);
        const age = closedAgeDays(found.ClosedAt);
        const expected = row.ClosedAt === 'recent' ? 7 : row.ClosedAt === 'past' ? 400 : null;
        if (expected === null) {
            if (age !== null) throw new Error(`${row.Key} is closed and the catalog leaves it open.`);
        } else if (age === null || Math.abs(age - expected) > 0.5) {
            throw new Error(`${row.Key} closed age is ${age}, catalog says ${row.ClosedAt}.`);
        }
    }
    const members = await view.RunView<{ SpaceID: string; UserID: string; Status: string; Band: string; SpaceRoleTypeID: string }>({
        EntityName: MEMBERS,
        ExtraFilter: `SpaceID IN (${[...spaceIds.values()].map((id) => `'${id}'`).join(',')})`,
        Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
        ResultType: 'simple',
    }, user);
    if (!members.Success) throw new Error(members.ErrorMessage ?? 'Could not read the roster.');
    if ((members.Results?.length ?? 0) !== memberRows.length) {
        throw new Error(`Expected ${memberRows.length} seats, read ${members.Results?.length ?? 0}.`);
    }
    const seenSeats = new Set<string>();
    for (const member of members.Results ?? []) {
        const key = `${member.SpaceID.toLowerCase()}:${member.UserID.toLowerCase()}`;
        if (seenSeats.has(key)) {
            throw new Error(`Duplicate seat found for SpaceID ${member.SpaceID} and UserID ${member.UserID}.`);
        }
        seenSeats.add(key);
    }
    for (const row of memberRows) {
        const expectedSpaceId = spaceIds.get(row.Space)!.toLowerCase();
        const expectedUserId = people.get(row.Person)!.id.toLowerCase();
        const matches = members.Results?.filter((member) => member.SpaceID.toLowerCase() === expectedSpaceId && member.UserID.toLowerCase() === expectedUserId) ?? [];
        if (matches.length === 0) throw new Error(`Missing seat ${row.Person} on ${row.Space}.`);
        if (matches.length > 1) throw new Error(`Duplicate seat ${row.Person} on ${row.Space}.`);
        const found = matches[0];
        if (found.Status.trim() !== row.Status || found.Band.trim() !== row.Band) {
            throw new Error(`${row.Person} on ${row.Space} is ${found.Status.trim()} ${found.Band.trim()}, catalog says ${row.Status} ${row.Band}.`);
        }
        if (found.SpaceRoleTypeID.toLowerCase() !== requireMap(roles, row.Role, 'role').toLowerCase()) {
            throw new Error(`${row.Person} on ${row.Space} has the wrong role.`);
        }
    }

    const chatsCheck = await view.RunView<{ ID: string; SpaceID: string; Name: string; Kind: string; Status: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Chats',
        ExtraFilter: `SpaceID IN (${['discovery', 'northwind', 'committee', 'studio', 'sealed-child'].map(k => `'${spaceIds.get(k)}'`).join(',')}) AND Status = 'Active'`,
        Fields: ['ID', 'SpaceID', 'Name', 'Kind', 'Status'],
        ResultType: 'simple',
    }, user);
    if (!chatsCheck.Success || !chatsCheck.Results) {
        throw new Error(`Failed to query space chats: ${chatsCheck?.ErrorMessage || 'unknown error'}`);
    }
    const expectedChats = [
        { space: 'discovery', name: 'discovery-general', kind: 'General' },
        { space: 'discovery', name: 'discovery-deliverables', kind: 'Topic' },
        { space: 'discovery', name: 'discovery-internal', kind: 'Private' },
        { space: 'northwind', name: 'northwind-general', kind: 'General' },
        { space: 'northwind', name: 'northwind-deliverables', kind: 'Topic' },
        { space: 'northwind', name: 'northwind-internal', kind: 'Private' },
        { space: 'committee', name: 'committee-general', kind: 'General' },
        { space: 'committee', name: 'committee-deliverables', kind: 'Topic' },
        { space: 'committee', name: 'committee-internal', kind: 'Private' },
        { space: 'studio', name: 'studio-general', kind: 'General' },
        { space: 'sealed-child', name: 'sealed-child-general', kind: 'General' },
    ];
    if (chatsCheck.Results.length !== expectedChats.length) {
        throw new Error(`Expected ${expectedChats.length} active space chats, found ${chatsCheck.Results.length}.`);
    }
    const closedChat = await view.RunView<{ Status: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Chats',
        ExtraFilter: `SpaceID = '${spaceIds.get('closed-recent')}' AND Name = 'closed-recent-general'`,
        Fields: ['Status'],
        ResultType: 'simple',
    }, user);
    if (!closedChat.Success || closedChat.Results?.[0]?.Status?.trim() !== 'Archived') {
        throw new Error(`Closed this month's conversation must exist and be Archived by the close, saw ${JSON.stringify(closedChat.Results)}.`);
    }
    for (const ec of expectedChats) {
        const sid = spaceIds.get(ec.space);
        const matches = chatsCheck.Results.filter(c => c.SpaceID.toLowerCase() === sid?.toLowerCase() && c.Name === ec.name && c.Kind === ec.kind);
        if (matches.length === 0) {
            throw new Error(`Missing expected space chat ${ec.name} (${ec.kind}) in space ${ec.space}.`);
        }
        if (matches.length > 1) {
            throw new Error(`Duplicate space chat ${ec.name} (${ec.kind}) in space ${ec.space}.`);
        }
    }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    loadWorld().then(() => process.exit(0)).catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
