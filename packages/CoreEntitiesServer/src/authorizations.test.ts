import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AuthorizationInfo, type EntityInfo, EntityUserPermissionInfo, type IMetadataProvider, type UserInfo, type UserRoleInfo } from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { SpaceEntityServer } from '../dist/SpaceEntityServer.js';
import { SpaceTypeEntityServer } from '../dist/SpaceTypeEntityServer.js';

const ROOT_AUTH_ID = '11111111-1111-4111-8111-111111111111';
const TYPES_AUTH_ID = '22222222-2222-4222-8222-222222222222';
const SPACES_AUTH_ID = '33333333-3333-4333-8333-333333333333';
const SPACE_ID = '44444444-4444-4444-8444-444444444444';
const TYPE_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '66666666-6666-4666-8666-666666666666';
const OWNER_ROLE_ID = '77777777-7777-4777-8777-777777777777';
const MEMBER_ROLE_ID = '88888888-8888-4888-8888-888888888888';

function createMockAuthorizations(grants: {
    typesAllowedRoles: string[];
    spacesAllowedRoles: string[];
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

    return [root, typesAuth, spacesAuth];
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
                    Results: [{ SpaceRoleTypeID: options.isOwnerMember ? OWNER_ROLE_ID : MEMBER_ROLE_ID }],
                };
            }
            if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                return {
                    Success: true,
                    Results: [{ ID: TYPE_ID, DriverKey: null }],
                };
            }
            if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                return {
                    Success: true,
                    Results: [{ ID: OWNER_ROLE_ID, IsOwnerRole: options.isOwnerMember ? true : false }],
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

describe('CollaborationEngine authorization checks (Item 56)', () => {
    const adminUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'Owner' } as Partial<UserRoleInfo> as UserRoleInfo],
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
        typesAllowedRoles: ['Owner', 'Developer'],
        spacesAllowedRoles: ['Owner', 'Developer'],
    });

    it('FindCollaborationAuthorization resolves child authorizations under Collaboration root', () => {
        const provider = createMockProvider({ authorizations: auths });
        const engine = CollaborationEngine.Instance;
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

describe('SpaceTypeEntityServer Configure Space Types enforcement (Item 56)', () => {
    const auths = createMockAuthorizations({
        typesAllowedRoles: ['Owner', 'Developer'],
        spacesAllowedRoles: ['Owner', 'Developer'],
    });

    const adminUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'Owner' } as Partial<UserRoleInfo> as UserRoleInfo],
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
    });
});

describe('SpaceEntityServer PostCloseAccess direct write guardrails (Item 56 / Item 12)', () => {
    const auths = createMockAuthorizations({
        typesAllowedRoles: ['Owner', 'Developer'],
        spacesAllowedRoles: ['Owner', 'Developer'],
    });

    const adminUser = {
        ID: USER_ID,
        UserRoles: [{ Role: 'Owner' } as Partial<UserRoleInfo> as UserRoleInfo],
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
});
