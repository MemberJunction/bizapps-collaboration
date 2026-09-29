import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { AuthorizationInfo, type EntityInfo, EntityUserPermissionInfo, type IMetadataProvider, type UserInfo, type UserRoleInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceRoleTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { CollaborationEngineBase } from '@mj-biz-apps/collaboration-engine-base';
import { SpaceEntityServer } from '../dist/SpaceEntityServer.js';
import { SpaceTypeEntityServer } from '../dist/SpaceTypeEntityServer.js';
import { toNode, type SpaceRow } from '../dist/load-graph.js';

const ROOT_AUTH_ID = '11111111-1111-4111-8111-111111111111';
const TYPES_AUTH_ID = '22222222-2222-4222-8222-222222222222';
const SPACES_AUTH_ID = '33333333-3333-4333-8333-333333333333';
const LIFECYCLE_AUTH_ID = '99999999-9999-4999-8999-999999999999';
const ADMINISTER_AUTH_ID = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
const SPACE_ID = '44444444-4444-4444-8444-444444444444';
const TYPE_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '66666666-6666-4666-8666-666666666666';
const OWNER_ROLE_ID = '77777777-7777-4777-8777-777777777777';
const MEMBER_ROLE_ID = '88888888-8888-4888-8888-888888888888';

function createMockAuthorizations(grants: {
    typesAllowedRoles: string[];
    spacesAllowedRoles: string[];
    lifecycleAllowedRoles?: string[];
    administerAllowedRoles?: string[];
}) {
    const root = new AuthorizationInfo();
    root.ID = ROOT_AUTH_ID;
    root.Name = 'Collaboration';
    root.IsActive = true;

    const typesAuth = new AuthorizationInfo();
    typesAuth.ID = TYPES_AUTH_ID;
    typesAuth.Name = 'Configure Space Types';
    typesAuth.ParentID = ROOT_AUTH_ID;
    typesAuth.IsActive = true;
    Object.defineProperty(typesAuth, 'UserCanExecute', {
        value: (user: UserInfo) => {
            return user?.UserRoles?.some(r => r.Role && grants.typesAllowedRoles.includes(r.Role)) ?? false;
        },
    });

    const spacesAuth = new AuthorizationInfo();
    spacesAuth.ID = SPACES_AUTH_ID;
    spacesAuth.Name = 'Configure Spaces';
    spacesAuth.ParentID = ROOT_AUTH_ID;
    spacesAuth.IsActive = true;
    Object.defineProperty(spacesAuth, 'UserCanExecute', {
        value: (user: UserInfo) => {
            return user?.UserRoles?.some(r => r.Role && grants.spacesAllowedRoles.includes(r.Role)) ?? false;
        },
    });

    const lifecycleAuth = new AuthorizationInfo();
    lifecycleAuth.ID = LIFECYCLE_AUTH_ID;
    lifecycleAuth.Name = 'Close and Reopen Spaces';
    lifecycleAuth.ParentID = ROOT_AUTH_ID;
    lifecycleAuth.IsActive = true;
    Object.defineProperty(lifecycleAuth, 'UserCanExecute', {
        value: (user: UserInfo) => user?.UserRoles?.some(r => r.Role && (grants.lifecycleAllowedRoles ?? []).includes(r.Role)) ?? false,
    });

    const administerAuth = new AuthorizationInfo();
    administerAuth.ID = ADMINISTER_AUTH_ID;
    administerAuth.Name = 'Administer Spaces';
    administerAuth.ParentID = ROOT_AUTH_ID;
    administerAuth.IsActive = true;
    Object.defineProperty(administerAuth, 'UserCanExecute', {
        value: (user: UserInfo) => user?.UserRoles?.some(r => r.Role && (grants.administerAllowedRoles ?? []).includes(r.Role)) ?? false,
    });

    return [root, typesAuth, spacesAuth, lifecycleAuth, administerAuth];
}

function createMockProvider(options: {
    authorizations: AuthorizationInfo[];
    isOwnerMember?: boolean;
}): IMetadataProvider {
    const provider = {
        Authorizations: options.authorizations,
        EntityByName(name: string) {
            const perm = new EntityUserPermissionInfo();
            perm.CanRead = true;
            perm.CanCreate = true;
            perm.CanUpdate = true;
            perm.CanDelete = true;
            return {
                ID: `entity-${name}`,
                Name: name,
                GetUserPermisions: () => perm,
            } as Partial<EntityInfo> as EntityInfo;
        },
        async GetEntityObject() {
            return null;
        },
        EntityByID() {
            return { ID: 'x', Name: 'x' } as Partial<EntityInfo> as EntityInfo;
        },
        async RunView(params: { EntityName: string; ExtraFilter?: string }) {
            const { EntityName } = params;
            if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                return {
                    Success: true,
                    Results: [{
                        SpaceID: SPACE_ID,
                        UserID: USER_ID,
                        Status: 'Active',
                        Band: 'Shared',
                        SpaceRoleTypeID: options.isOwnerMember ? OWNER_ROLE_ID : MEMBER_ROLE_ID,
                    }],
                };
            }
            if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                return {
                    Success: true,
                    Results: [{
                        ID: SPACE_ID,
                        ParentID: null,
                        InheritsMembership: false,
                        OwnerID: USER_ID,
                        AgentRetrieval: 'Included',
                        AllowParentAssignees: true,
                        ClosedAt: null,
                        PostCloseAccess: null,
                        PostCloseAccessDays: null,
                    }],
                };
            }
            if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                return {
                    Success: true,
                    Results: [{ ID: TYPE_ID, DriverKey: null, PostCloseAccess: 'ReadOnly', PostCloseAccessDays: 30 }],
                };
            }
            if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                return {
                    Success: true,
                    Results: [
                        { ID: OWNER_ROLE_ID, Code: 'owner', Name: 'Owner', IsOwnerRole: true },
                        { ID: MEMBER_ROLE_ID, Code: 'member', Name: 'Member', IsOwnerRole: false },
                    ],
                };
            }
            return { Success: true, Results: [] };
        },
        async RunViews(queries: Array<{ EntityName: string; ExtraFilter?: string }>) {
            return Promise.all(queries.map(q => provider.RunView(q)));
        },
    };
    return provider as Partial<IMetadataProvider> as IMetadataProvider;
}

describe('CollaborationEngine authorization checks', () => {
    const adminUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'Developer' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    const staffUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    const participantUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    const auths = createMockAuthorizations({
        typesAllowedRoles: ['Developer'],
        spacesAllowedRoles: ['Developer'],
    });

    before(async () => {
        const setupProvider = createMockProvider({ authorizations: auths });
        await CollaborationEngine.Instance.Config(true, adminUser, setupProvider);
        await CollaborationEngineBase.Instance.Config(true, adminUser, setupProvider);
    });

    it('FindCollaborationAuthorization resolves child authorizations under Collaboration root', () => {
        const provider = createMockProvider({ authorizations: auths });
        const engine = CollaborationEngineBase.Instance;
        const typesAuth = engine.FindCollaborationAuthorization('Configure Space Types', provider);
        assert.ok(typesAuth, 'Configure Space Types must be found');
        assert.equal(typesAuth?.ID, TYPES_AUTH_ID);
        assert.equal(typesAuth?.ParentID, ROOT_AUTH_ID);

        const spacesAuth = engine.FindCollaborationAuthorization('Configure Spaces', provider);
        assert.ok(spacesAuth, 'Configure Spaces must be found');
        assert.equal(spacesAuth?.ID, SPACES_AUTH_ID);
        assert.equal(spacesAuth?.ParentID, ROOT_AUTH_ID);
    });

    it('allows admin role for UserCanConfigureSpaceTypes', () => {
        const provider = createMockProvider({ authorizations: auths });
        const engine = CollaborationEngine.Instance;
        assert.equal(engine.UserCanConfigureSpaceTypes(adminUser, provider), true);
    });

    it('refuses regular staff (UI) and space participant for UserCanConfigureSpaceTypes', () => {
        const provider = createMockProvider({ authorizations: auths });
        const engine = CollaborationEngine.Instance;
        assert.equal(engine.UserCanConfigureSpaceTypes(staffUser, provider), false);
        assert.equal(engine.UserCanConfigureSpaceTypes(participantUser, provider), false);
    });

    it('refuses a space owner who lacks the Configure Spaces authorization', async () => {
        const provider = createMockProvider({ authorizations: auths, isOwnerMember: true });
        const engine = CollaborationEngine.Instance;
        // Participant or staffUser without Owner role has isOwnerMember=true on space, but lacks Configure Spaces
        const res = await engine.UserCanConfigureSpaces(staffUser, SPACE_ID, provider);
        assert.equal(res, false, 'Space owner without Configure Spaces authorization must be refused');
    });

    it('refuses a user with Configure Spaces authorization who lacks an owner role on the space', async () => {
        const provider = createMockProvider({ authorizations: auths, isOwnerMember: false });
        const engine = CollaborationEngine.Instance;
        // adminUser has Configure Spaces, but is not an owner on this specific space
        const res = await engine.UserCanConfigureSpaces(adminUser, SPACE_ID, provider);
        assert.equal(res, false, 'User with Configure Spaces but not an owner on space must be refused');
    });

    it('allows a user who has Configure Spaces authorization AND holds an owner role on the space', async () => {
        const provider = createMockProvider({ authorizations: auths, isOwnerMember: true });
        const engine = CollaborationEngine.Instance;
        const res = await engine.UserCanConfigureSpaces(adminUser, SPACE_ID, provider);
        assert.equal(res, true, 'User with Configure Spaces and owner role must be allowed');
    });
});

describe("the 'Administer Spaces' authorization", () => {
    const withRoles = (...roles: string[]) => ({ ID: USER_ID, UserRoles: roles.map((Role) => ({ Role }) as Partial<UserRoleInfo> as UserRoleInfo) }) as Partial<UserInfo> as UserInfo;
    const grantedTo = (roles: string[]) => createMockProvider({ authorizations: createMockAuthorizations({ typesAllowedRoles: [], spacesAllowedRoles: [], administerAllowedRoles: roles }) });

    it('is held through the authorization, whatever a role is called: a host that edits the grants moves who may administer', () => {
        const engine = CollaborationEngine.Instance;
        assert.equal(engine.UserMayAdministerSpaces(withRoles('UI'), grantedTo(['UI', 'Developer', 'Integration'])), true);
        assert.equal(engine.UserMayAdministerSpaces(withRoles('Space Participant'), grantedTo(['UI', 'Developer', 'Integration'])), false);
        // The grants are the host's to edit: a role no code knows by name may hold it, and the shipped roles may not
        assert.equal(engine.UserMayAdministerSpaces(withRoles('Community Manager'), grantedTo(['Community Manager'])), true);
        assert.equal(engine.UserMayAdministerSpaces(withRoles('UI'), grantedTo(['Community Manager'])), false);
    });

    it('is refused when the authorization is missing, rather than assumed', () => {
        assert.equal(CollaborationEngine.Instance.UserMayAdministerSpaces(withRoles('UI'), createMockProvider({ authorizations: [] })), false);
    });
});

describe("the close and reopen rights of a space's owner", () => {
    const participant = { ID: USER_ID, UserRoles: [{ Role: 'Space Participant' } as Partial<UserRoleInfo> as UserRoleInfo] } as Partial<UserInfo> as UserInfo;
    const grantedTo = (roles: string[]) => createMockAuthorizations({ typesAllowedRoles: [], spacesAllowedRoles: [], lifecycleAllowedRoles: roles });
    const roleTypeOf = (id: string) => id === OWNER_ROLE_ID
        ? { Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true }
        : { Level: 20, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true };

    it("holds only with the 'Close and Reopen Spaces' authorization, whatever the seat", () => {
        const engine = CollaborationEngine.Instance;
        assert.equal(engine.UserHoldsLifecycleAuthorization(participant, createMockProvider({ authorizations: grantedTo(['Space Participant']), isOwnerMember: true })), true);
        assert.equal(engine.UserHoldsLifecycleAuthorization(participant, createMockProvider({ authorizations: grantedTo(['Developer']), isOwnerMember: true })), false);
    });

    it('lets an owner with the authorization close and reopen, and refuses a member, or an owner without it', async () => {
        const engine = CollaborationEngineBase.Instance;
        const owner = createMockProvider({ authorizations: grantedTo(['Space Participant']), isOwnerMember: true });
        assert.equal(await engine.UserCanCloseSpace(participant, SPACE_ID, owner, roleTypeOf), true);
        assert.equal(await engine.UserCanReopenSpace(participant, SPACE_ID, owner, roleTypeOf), true);
        const member = createMockProvider({ authorizations: grantedTo(['Space Participant']), isOwnerMember: false });
        assert.equal(await engine.UserCanCloseSpace(participant, SPACE_ID, member, roleTypeOf), false);
        assert.equal(await engine.UserCanReopenSpace(participant, SPACE_ID, member, roleTypeOf), false);
        const unauthorized = createMockProvider({ authorizations: grantedTo([]), isOwnerMember: true });
        assert.equal(await engine.UserCanCloseSpace(participant, SPACE_ID, unauthorized, roleTypeOf), false);
        assert.equal(await engine.UserCanReopenSpace(participant, SPACE_ID, unauthorized, roleTypeOf), false);
    });

    it("keeps the post-close filter on configuring but not on reopening: an owner of a space closed with no access reopens, and does not configure", async () => {
        // 'Configure Spaces' is granted too, so the only difference between the two rights is the filter
        const spaces = createMockAuthorizations({ typesAllowedRoles: [], spacesAllowedRoles: ['Space Participant'], lifecycleAllowedRoles: ['Space Participant'] });
        const base = createMockProvider({ authorizations: spaces, isOwnerMember: true });
        const closed = Object.create(base) as IMetadataProvider;
        (closed as unknown as { RunView: unknown }).RunView = async (params: { EntityName: string; ExtraFilter?: string }) => {
            const result = await (base as unknown as { RunView: (p: unknown) => Promise<{ Results: Array<Record<string, unknown>> }> }).RunView(params);
            if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                return { ...result, Results: result.Results.map((row) => ({ ...row, ClosedAt: '2026-01-01T00:00:00Z', PostCloseAccess: 'None' })) };
            }
            return result;
        };
        const engine = CollaborationEngineBase.Instance;
        assert.equal(await engine.UserCanReopenSpace(participant, SPACE_ID, closed, roleTypeOf), true);
        assert.equal(await engine.UserCanConfigureSpaces(participant, SPACE_ID, closed, roleTypeOf), false);
        // The same owner of a space that is still open configures it
        const open = createMockProvider({ authorizations: spaces, isOwnerMember: true });
        assert.equal(await engine.UserCanConfigureSpaces(participant, SPACE_ID, open, roleTypeOf), true);
    });
});

describe('SpaceTypeEntityServer Configure Space Types enforcement', () => {
    const auths = createMockAuthorizations({
        typesAllowedRoles: ['Developer'],
        spacesAllowedRoles: ['Developer'],
    });

    const adminUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'Developer' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    const staffUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    function mockSpaceType(user: UserInfo | null, isSaved: boolean) {
        const provider = createMockProvider({ authorizations: auths });
        const type = Object.create(SpaceTypeEntityServer.prototype) as SpaceTypeEntityServer;
        Object.defineProperties(type, {
            ContextCurrentUser: { value: user, writable: true },
            IsSaved: { value: isSaved, writable: true },
            ID: { value: TYPE_ID, writable: true },
            Name: { value: 'Custom Type', writable: true },
            Configuration: { value: null, writable: true },
            Fields: { value: [{ Name: 'Name', Dirty: true }], writable: true },
            ProviderToUse: { value: provider, writable: true },
            RunViewProviderToUse: { value: provider, writable: true },
            _fieldCache: { value: new Map(), writable: true },
            _resultHistory: { value: [], writable: true },
        });
        return type;
    }

    it('refuses space type save when no user is signed in', async () => {
        const type = mockSpaceType(null, false);
        const res = await SpaceTypeEntityServer.prototype.ValidateAsync.call(type);
        assert.equal(res.Success, false);
        assert.equal(res.Errors[0]?.Message, 'Space type change refused: no signed-in user.');
    });

    it('refuses space type save when user lacks Configure Space Types', async () => {
        const type = mockSpaceType(staffUser, false);
        const res = await SpaceTypeEntityServer.prototype.ValidateAsync.call(type);
        assert.equal(res.Success, false);
        assert.equal(res.Errors[0]?.Message, "Space type change refused: user lacks 'Configure Space Types' authorization.");
    });

    it('allows space type save when user has Configure Space Types', async () => {
        const type = mockSpaceType(adminUser, false);
        const res = await SpaceTypeEntityServer.prototype.ValidateAsync.call(type);
        assert.equal(res.Success, true);
    });

    it('refuses space type delete when user lacks Configure Space Types', async () => {
        const type = mockSpaceType(staffUser, true);
        const deleted = await SpaceTypeEntityServer.prototype.Delete.call(type);
        assert.equal(deleted, false);
        assert.ok(type.LatestResult?.CompleteMessage?.includes('Configure Space Types'));
    });
});

describe('SpaceEntityServer PostCloseAccess direct write guardrails', () => {
    const auths = createMockAuthorizations({
        typesAllowedRoles: ['Developer'],
        spacesAllowedRoles: ['Developer'],
    });

    const adminUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'Developer' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    const staffUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
    } as Partial<UserInfo> as UserInfo;

    function mockSpaceWithCloseWrite(user: UserInfo, isClosing: boolean, isOwnerMember: boolean) {
        const provider = createMockProvider({ authorizations: auths, isOwnerMember });
        const space = Object.create(SpaceEntityServer.prototype) as SpaceEntityServer;
        const fields = [
            { Name: 'PostCloseAccess', Dirty: true, Value: 'ReadOnly' },
            { Name: 'OwnerID', Dirty: false },
        ];
        if (isClosing) {
            fields.push({ Name: 'ClosedAt', Dirty: true, Value: new Date().toISOString() });
        }
        Object.defineProperties(space, {
            ContextCurrentUser: { value: user, writable: true },
            IsSaved: { value: true, writable: true },
            ID: { value: SPACE_ID, writable: true },
            OwnerID: { value: USER_ID, writable: true },
            SpaceTypeID: { value: TYPE_ID, writable: true },
            ClosedAt: { value: isClosing ? new Date() : null, writable: true },
            Fields: { value: fields, writable: true },
            ProviderToUse: { value: provider, writable: true },
            RunViewProviderToUse: { value: provider, writable: true },
            _fieldCache: { value: new Map(), writable: true },
        });
        return space;
    }

    it('refuses direct write to PostCloseAccess when user lacks Configure Spaces', async () => {
        const space = mockSpaceWithCloseWrite(staffUser, false, true);
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        assert.equal(res.Success, false);
        const err = res.Errors.find((e) => e.Source === 'PostCloseAccess');
        assert.ok(err, 'Expected refusal on PostCloseAccess');
        assert.equal(err?.Message, "Space change refused: user lacks 'Configure Spaces' authorization or does not hold an owner role on this space.");
    });

    it('allows direct write to PostCloseAccess when user has Configure Spaces and is owner', async () => {
        const space = mockSpaceWithCloseWrite(adminUser, false, true);
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        const err = res.Errors.find((e) => e.Source === 'PostCloseAccess');
        assert.equal(err, undefined, 'Admin space owner should not be refused on PostCloseAccess');
    });

    it('allows PostCloseAccess write during space close even without Configure Spaces', async () => {
        const space = mockSpaceWithCloseWrite(staffUser, true, true);
        const res = await SpaceEntityServer.prototype.ValidateAsync.call(space);
        const err = res.Errors.find((e) => e.Source === 'PostCloseAccess');
        assert.equal(err, undefined, 'PostCloseAccess write during space close should be allowed');
    });
});

describe('Metadata Role Lookups Static Check', () => {
    it('verifies that every @lookup:MJ: Roles.Name=... names a valid MJ core role or role in metadata/roles', () => {
        let dir = process.cwd();
        while (!fs.existsSync(path.join(dir, 'metadata')) && path.dirname(dir) !== dir) {
            dir = path.dirname(dir);
        }
        const metadataDir = path.join(dir, 'metadata');

        function scanDir(d: string): string[] {
            const results: string[] = [];
            const entries = fs.readdirSync(d, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(d, entry.name);
                if (entry.isDirectory()) {
                    results.push(...scanDir(full));
                } else if (entry.isFile() && entry.name.endsWith('.json')) {
                    results.push(full);
                }
            }
            return results;
        }

        const allowedRoles = new Set(['UI', 'Developer', 'Integration', 'Agent Administrator']);
        const rolesDir = path.join(metadataDir, 'roles');
        if (fs.existsSync(rolesDir)) {
            const roleFiles = scanDir(rolesDir);
            for (const rf of roleFiles) {
                const parsed = JSON.parse(fs.readFileSync(rf, 'utf-8'));
                if (Array.isArray(parsed)) {
                    for (const item of parsed) {
                        if (item.fields?.Name) {
                            allowedRoles.add(item.fields.Name);
                        }
                    }
                }
            }
        }

        const files = scanDir(metadataDir);
        const lookupRegex = /@lookup:MJ:\s*Roles\.Name=([^"&}]+)/g;

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8');
            let match;
            while ((match = lookupRegex.exec(content)) !== null) {
                const roleName = match[1].trim();
                assert.ok(
                    allowedRoles.has(roleName),
                    `File ${file} references invalid role '${roleName}'. Allowed roles are: ${Array.from(allowedRoles).join(', ')}`
                );
            }
        }
    });
});

describe('toNode post-close mapping', () => {
    it('maps post-close values from row and space type', () => {
        const rowWithClose: SpaceRow = {
            ID: '11111111-2222-3333-4444-555555555555',
            ParentID: null,
            InheritsMembership: false,
            OwnerID: USER_ID,
            SpaceTypeID: TYPE_ID,
            AgentRetrieval: 'Included',
            ClosedAt: '2026-01-01T00:00:00Z',
            PostCloseAccess: 'ReadOnlyWithAgent',
            PostCloseAccessDays: 14,
        };
        const node1 = toNode(rowWithClose);
        assert.equal(node1.postCloseAccess, 'ReadOnlyWithAgent');
        assert.equal(node1.postCloseAccessDays, 14);
        assert.equal(node1.spaceTypePostCloseAccess, 'ReadOnly');
        assert.equal(node1.spaceTypePostCloseAccessDays, 30);

        const rowWithoutClose: SpaceRow = {
            ID: '22222222-3333-4444-5555-666666666666',
            ParentID: null,
            InheritsMembership: false,
            OwnerID: USER_ID,
            SpaceTypeID: TYPE_ID,
            AgentRetrieval: 'Included',
        };
        const node2 = toNode(rowWithoutClose);
        assert.equal(node2.postCloseAccess, null);
        assert.equal(node2.postCloseAccessDays, null);
        assert.equal(node2.spaceTypePostCloseAccess, 'ReadOnly');
        assert.equal(node2.spaceTypePostCloseAccessDays, 30);
    });
});

