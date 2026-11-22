import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    AuthorizationInfo,
    AuthorizationRoleInfo,
    type EntityInfo,
    EntityUserPermissionInfo,
    type IMetadataProvider,
    UserInfo,
    type UserRoleInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { mintSpaceLink } from '../dist/mint-space-link.js';

const SYSTEM_USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_USER_ID = '22222222-2222-4222-8222-222222222222';
const INVITEE_USER_ID = '33333333-3333-4333-8333-333333333333';
const SPACE_ID = '44444444-4444-4444-8444-444444444444';
const SPACE_TYPE_ID = '55555555-5555-4555-8555-555555555555';
const OWNER_SPACE_ROLE_ID = '66666666-6666-4666-8666-666666666666';
const GUEST_SPACE_ROLE_ID = '77777777-7777-4777-8777-777777777777';
const ROOT_AUTH_ID = '88888888-8888-4888-8888-888888888881';
const ADMINISTER_AUTH_ID = '88888888-8888-4888-8888-888888888882';
const ISSUE_LINKS_AUTH_ID = '88888888-8888-4888-8888-888888888883';

const UI_ROLE_ID = '99999999-9999-4999-8999-999999999991';
const CUSTOM_STAFF_ROLE_ID = '99999999-9999-4999-8999-999999999992';
const PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';

function createAuthMetadata(grants: {
    rootRoleIds?: string[];
    administerRoleIds?: string[];
    issueLinksRoleIds?: string[];
}): {
    Authorizations: AuthorizationInfo[];
    AuthorizationRoles: AuthorizationRoleInfo[];
    attachProvider: (provider: IMetadataProvider) => void;
} {
    const authRoles: AuthorizationRoleInfo[] = [];
    let seq = 1;
    const addRoles = (authId: string, roleIds: string[]) => {
        for (const roleId of roleIds) {
            authRoles.push(new AuthorizationRoleInfo({
                ID: `aaaaaaaa-0000-4000-8000-00000000000${seq++}`,
                AuthorizationID: authId,
                RoleID: roleId,
                Type: 'Allow',
            }));
        }
    };
    addRoles(ROOT_AUTH_ID, grants.rootRoleIds ?? []);
    addRoles(ADMINISTER_AUTH_ID, grants.administerRoleIds ?? []);
    addRoles(ISSUE_LINKS_AUTH_ID, grants.issueLinksRoleIds ?? []);

    const authorizations: AuthorizationInfo[] = [];
    const attachProvider = (provider: IMetadataProvider) => {
        authorizations.push(
            new AuthorizationInfo({ ID: ROOT_AUTH_ID, Name: 'Collaboration', ParentID: null, IsActive: true }, provider),
            new AuthorizationInfo({ ID: ADMINISTER_AUTH_ID, Name: 'Administer Spaces', ParentID: ROOT_AUTH_ID, IsActive: true }, provider),
            new AuthorizationInfo({ ID: ISSUE_LINKS_AUTH_ID, Name: 'Issue Space Invite Links', ParentID: ROOT_AUTH_ID, IsActive: true }, provider),
        );
    };

    return { Authorizations: authorizations, AuthorizationRoles: authRoles, attachProvider };
}

interface MockLinkTestOptions {
    inviteeRoleIds: string[];
    authGrants: {
        rootRoleIds?: string[];
        administerRoleIds?: string[];
        issueLinksRoleIds?: string[];
    };
}

function createMintMockProvider(options: MockLinkTestOptions) {
    const grantedUserRoles: Array<{ UserID: string; RoleID: string }> = [];
    const savedInvites: Array<{ Email: string; RoleID: string }> = [];
    const authMeta = createAuthMetadata(options.authGrants);

    const perm = new EntityUserPermissionInfo();
    perm.CanRead = true;
    perm.CanCreate = true;
    perm.CanUpdate = true;
    perm.CanDelete = true;

    const runSingleView = async (params: { EntityName: string; ExtraFilter?: string }) => {
        const { EntityName, ExtraFilter = '' } = params;
        if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
            return {
                Success: true,
                Results: [{
                    ID: SPACE_ID,
                    ParentID: null,
                    InheritsMembership: false,
                    OwnerID: OWNER_USER_ID,
                    AgentRetrieval: 'Included',
                    SpaceTypeID: SPACE_TYPE_ID,
                    AllowParentAssignees: true,
                    ClosedAt: null,
                }],
            };
        }
        if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
            return {
                Success: true,
                Results: [{ ID: SPACE_TYPE_ID, InviteApproval: 'AutoApprove', MemberCap: null }],
            };
        }
        if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
            return {
                Success: true,
                Results: [
                    {
                        ID: OWNER_SPACE_ROLE_ID,
                        Level: 100,
                        MaxGrantableLevel: 100,
                        CanInvite: true,
                        CanPromoteBand: true,
                        CanSeeTeamBand: true,
                        IsOwnerRole: true,
                        CanContribute: true,
                    },
                    {
                        ID: GUEST_SPACE_ROLE_ID,
                        Level: 20,
                        MaxGrantableLevel: 0,
                        CanInvite: false,
                        CanPromoteBand: false,
                        CanSeeTeamBand: false,
                        IsOwnerRole: false,
                        CanContribute: true,
                    },
                ],
            };
        }
        if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
            if (ExtraFilter.includes(INVITEE_USER_ID)) {
                return { Success: true, Results: [] };
            }
            return {
                Success: true,
                Results: [{
                    ID: 'seat-owner',
                    SpaceID: SPACE_ID,
                    UserID: OWNER_USER_ID,
                    SpaceRoleTypeID: OWNER_SPACE_ROLE_ID,
                    Status: 'Active',
                    Band: 'Team',
                }],
            };
        }
        if (EntityName === 'MJ: Users') {
            return { Success: true, Results: [{ ID: INVITEE_USER_ID }] };
        }
        if (EntityName === 'MJ: User Roles') {
            return {
                Success: true,
                Results: options.inviteeRoleIds.map((RoleID) => ({ RoleID })),
            };
        }
        if (EntityName === 'MJ: User Applications') {
            return { Success: true, Results: [{ ID: 'app-grant-1' }] };
        }
        return { Success: true, Results: [] };
    };

    const providerObj = {
        Authorizations: authMeta.Authorizations,
        AuthorizationRoles: authMeta.AuthorizationRoles,
        Entities: [] as EntityInfo[],
        EntityByName(name: string) {
            if (name === 'MJ_BizApps_Common: People') {
                return null;
            }
            return { ID: `entity-${name}`, Name: name, GetUserPermisions: () => perm } as Partial<EntityInfo> as EntityInfo;
        },
        EntityByID(id: string) {
            return { ID: id, Name: id } as Partial<EntityInfo> as EntityInfo;
        },
        RunView: runSingleView,
        RunViews: async (queries: Array<{ EntityName: string; ExtraFilter?: string }>) =>
            Promise.all(queries.map((q) => runSingleView(q))),
        async GetEntityObject(entityName: string) {
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                return { ProviderToUse: providerObj, RunViewProviderToUse: providerObj };
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Members') {
                const draft = { SpaceID: '', UserID: '', SpaceRoleTypeID: '', Status: 'Active', Band: 'Shared' };
                return {
                    get Status() { return draft.Status; },
                    set Status(v: string) { draft.Status = v; },
                    set SpaceID(v: string) { draft.SpaceID = v; },
                    set UserID(v: string) { draft.UserID = v; },
                    set SpaceRoleTypeID(v: string) { draft.SpaceRoleTypeID = v; },
                    set Band(v: string) { draft.Band = v; },
                    NewRecord() {},
                    async Save() { return true; },
                };
            }
            if (entityName === 'MJ: User Roles') {
                const draft = { UserID: '', RoleID: '' };
                return {
                    set UserID(v: string) { draft.UserID = v; },
                    set RoleID(v: string) { draft.RoleID = v; },
                    NewRecord() {},
                    async Save() {
                        grantedUserRoles.push({ ...draft });
                        return true;
                    },
                };
            }
            if (entityName === 'MJ: Magic Link Invites') {
                const draft = { Email: '', RoleID: '' };
                return {
                    ID: 'invite-1',
                    set TokenHash(_v: string) {},
                    set Email(v: string) { draft.Email = v; },
                    set ApplicationID(_v: string) {},
                    set RoleID(v: string) { draft.RoleID = v; },
                    set ExpiresAt(_v: Date) {},
                    set MaxUses(_v: number) {},
                    set UseCount(_v: number) {},
                    set CreatedByUserID(_v: string) {},
                    set Status(_v: string) {},
                    set IdentityMode(_v: string) {},
                    set Kind(_v: string) {},
                    NewRecord() {},
                    async Save() {
                        savedInvites.push({ ...draft });
                        return true;
                    },
                };
            }
            return {
                NewRecord() {},
                async Load() { return false; },
                async Save() { return true; },
            };
        },
    };

    const provider = providerObj as Partial<IMetadataProvider> as IMetadataProvider;
    authMeta.attachProvider(provider);
    return { provider, grantedUserRoles, savedInvites };
}

describe('mintSpaceLink declarative MJ Authorization (CT-5)', () => {
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;

    before(() => {
        origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Type: 'Owner' }) as Partial<UserInfo> as UserInfo;
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
    });

    const hostConfig = {
        enabled: true,
        publicUrl: 'http://localhost:4000',
        restrictedRoleName: 'Magic Link Baseline',
        grantableRoleNames: ['Space Participant'],
        inviteIssuerRoleNames: [],
        fromAddress: '',
        defaultExpiresInHours: 72,
        provisioningGuard: 'block' as const,
    };

    it('grants raw sign-in URL to a custom staff role holding Issue Space Invite Links authorization without matching role names', async () => {
        const { provider, savedInvites } = createMintMockProvider({
            inviteeRoleIds: [PARTICIPANT_ROLE_ID],
            authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
        });
        const caller = new UserInfo(provider, {
            ID: OWNER_USER_ID,
            Type: 'User',
            UserRoles: [{ UserID: OWNER_USER_ID, RoleID: CUSTOM_STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
        });

        const res = await mintSpaceLink({
            provider,
            user: caller,
            spaceId: SPACE_ID,
            email: 'guest@example.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: hostConfig,
        });

        assert.equal(res.ok, true);
        assert.match(res.redemptionUrl ?? '', /\/magic-link\/redeem\?token=mj_ml_/);
        assert.equal(savedInvites.length, 1);
    });

    it('grants raw sign-in URL when caller holds ancestor Collaboration authorization', async () => {
        const { provider } = createMintMockProvider({
            inviteeRoleIds: [PARTICIPANT_ROLE_ID],
            authGrants: { rootRoleIds: [CUSTOM_STAFF_ROLE_ID] },
        });
        const caller = new UserInfo(provider, {
            ID: OWNER_USER_ID,
            Type: 'User',
            UserRoles: [{ UserID: OWNER_USER_ID, RoleID: CUSTOM_STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
        });

        const res = await mintSpaceLink({
            provider,
            user: caller,
            spaceId: SPACE_ID,
            email: 'guest@example.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: hostConfig,
        });

        assert.equal(res.ok, true);
        assert.match(res.redemptionUrl ?? '', /\/magic-link\/redeem\?token=mj_ml_/);
    });

    it('withholds raw sign-in URL from UI role when Issue Space Invite Links authorization is revoked', async () => {
        const { provider, savedInvites } = createMintMockProvider({
            inviteeRoleIds: [PARTICIPANT_ROLE_ID],
            authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
        });
        const caller = new UserInfo(provider, {
            ID: OWNER_USER_ID,
            Type: 'User',
            UserRoles: [{ UserID: OWNER_USER_ID, RoleID: UI_ROLE_ID, Role: 'UI' } as Partial<UserRoleInfo> as UserRoleInfo],
        });

        const res = await mintSpaceLink({
            provider,
            user: caller,
            spaceId: SPACE_ID,
            email: 'guest@example.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: hostConfig,
        });

        assert.equal(res.ok, true);
        assert.equal(res.redemptionUrl, undefined);
        assert.equal(savedInvites.length, 0);
        assert.match(res.message ?? '', /sign-in link is not returned/i);
    });

    it('does not add Space Participant role to an invitee whose custom role holds Administer Spaces authorization', async () => {
        const { provider, grantedUserRoles } = createMintMockProvider({
            inviteeRoleIds: [CUSTOM_STAFF_ROLE_ID],
            authGrants: { administerRoleIds: [CUSTOM_STAFF_ROLE_ID], issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
        });
        const caller = new UserInfo(provider, {
            ID: OWNER_USER_ID,
            Type: 'User',
            UserRoles: [{ UserID: OWNER_USER_ID, RoleID: CUSTOM_STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
        });

        const res = await mintSpaceLink({
            provider,
            user: caller,
            spaceId: SPACE_ID,
            email: 'staff-invitee@example.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: hostConfig,
        });

        assert.equal(res.ok, true);
        assert.deepEqual(grantedUserRoles, []);
    });

    it('assigns Space Participant role to an invitee holding UI role when staff authorizations are not granted to UI', async () => {
        const { provider, grantedUserRoles } = createMintMockProvider({
            inviteeRoleIds: [UI_ROLE_ID],
            authGrants: { administerRoleIds: [CUSTOM_STAFF_ROLE_ID], issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
        });
        const caller = new UserInfo(provider, {
            ID: OWNER_USER_ID,
            Type: 'User',
            UserRoles: [{ UserID: OWNER_USER_ID, RoleID: CUSTOM_STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
        });

        const res = await mintSpaceLink({
            provider,
            user: caller,
            spaceId: SPACE_ID,
            email: 'nonstaff-ui@example.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: hostConfig,
        });

        assert.equal(res.ok, true);
        assert.deepEqual(grantedUserRoles, [{ UserID: INVITEE_USER_ID, RoleID: PARTICIPANT_ROLE_ID }]);
    });
});
