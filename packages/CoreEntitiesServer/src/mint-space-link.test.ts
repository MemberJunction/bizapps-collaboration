import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    ApplicationInfo,
    AuthorizationInfo,
    AuthorizationRoleInfo,
    type EntityInfo,
    EntityUserPermissionInfo,
    type IMetadataProvider,
    Metadata,
    RoleInfo,
    UserInfo,
    type UserRoleInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { mintSpaceLink, type IdpSignInNotification } from '../dist/mint-space-link.js';

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
const COLLABORATION_APP_ID = '94f5906b-38ab-4a9f-bfca-3d395bbbc198';
const VENDOR_PORTAL_APP_ID = 'cccccccc-1111-4111-8111-111111111111';

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
    targetApplicationId?: string | null;
    targetApplicationName?: string | null;
    spaceTypeConfiguration?: string | null;
    applications?: Array<{ ID: string; Name: string; Path?: string | null }>;
    roles?: Array<{ ID: string; Name: string }>;
}

function createMintMockProvider(options: MockLinkTestOptions) {
    const savedUsers: Array<{ Email: string }> = [];
    const grantedUserRoles: Array<{ UserID: string; RoleID: string }> = [];
    const grantedUserApps: Array<{ UserID: string; ApplicationID: string }> = [];
    const savedSeats: Array<{ SpaceID: string; UserID: string; SpaceRoleTypeID: string; Status: string; Band: string }> = [];
    const savedInvites: Array<{ Email: string; RoleID: string; ApplicationID: string }> = [];
    const savedInviteApps: Array<{ InviteID: string; ApplicationID: string }> = [];
    const savedInviteRoles: Array<{ InviteID: string; RoleID: string }> = [];
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
                    Name: 'Deal Room Alpha',
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
                Results: [{
                    ID: SPACE_TYPE_ID,
                    InviteApproval: 'AutoApprove',
                    MemberCap: null,
                    TargetApplicationID: options.targetApplicationId ?? null,
                    TargetApplication: options.targetApplicationName ?? null,
                    Configuration: options.spaceTypeConfiguration ?? null,
                }],
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
            const hasRequestedApp = options.targetApplicationId
                ? ExtraFilter.toLowerCase().includes(options.targetApplicationId.toLowerCase())
                : ExtraFilter.toLowerCase().includes(COLLABORATION_APP_ID.toLowerCase());
            return { Success: true, Results: hasRequestedApp && !options.targetApplicationId ? [{ ID: 'app-grant-1' }] : [] };
        }
        if (EntityName === 'MJ: Applications') {
            return { Success: true, Results: options.applications ?? [] };
        }
        if (EntityName === 'MJ: Roles') {
            return { Success: true, Results: options.roles ?? [] };
        }
        return { Success: true, Results: [] };
    };

    const providerApplications: ApplicationInfo[] = [];
    const providerRoles = (options.roles ?? []).map((role) => new RoleInfo({
        ID: role.ID,
        Name: role.Name,
    }));

    const providerObj = {
        Applications: providerApplications,
        Roles: providerRoles,
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
            if (entityName === 'MJ: Users') {
                const draft = { Email: '' };
                return {
                    ID: INVITEE_USER_ID,
                    set Name(_v: string) {},
                    set Email(v: string) { draft.Email = v; },
                    set FirstName(_v: string) {},
                    set LastName(_v: string) {},
                    set Type(_v: string) {},
                    set IsActive(_v: boolean) {},
                    NewRecord() {},
                    async Save() {
                        savedUsers.push({ ...draft });
                        return true;
                    },
                };
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
                    async Save() {
                        savedSeats.push({ ...draft });
                        return true;
                    },
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
            if (entityName === 'MJ: User Applications') {
                const draft = { UserID: '', ApplicationID: '' };
                return {
                    set UserID(v: string) { draft.UserID = v; },
                    set ApplicationID(v: string) { draft.ApplicationID = v; },
                    set Sequence(_v: number) {},
                    set IsActive(_v: boolean) {},
                    NewRecord() {},
                    async Save() {
                        grantedUserApps.push({ ...draft });
                        return true;
                    },
                };
            }
            if (entityName === 'MJ: Magic Link Invites') {
                const draft = { Email: '', RoleID: '', ApplicationID: '' };
                return {
                    ID: 'invite-1',
                    set TokenHash(_v: string) {},
                    set Email(v: string) { draft.Email = v; },
                    set ApplicationID(v: string) { draft.ApplicationID = v; },
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
            if (entityName === 'MJ: Magic Link Invite Applications') {
                const draft = { InviteID: '', ApplicationID: '' };
                return {
                    set InviteID(v: string) { draft.InviteID = v; },
                    set ApplicationID(v: string) { draft.ApplicationID = v; },
                    NewRecord() {},
                    async Save() {
                        savedInviteApps.push({ ...draft });
                        return true;
                    },
                };
            }
            if (entityName === 'MJ: Magic Link Invite Roles') {
                const draft = { InviteID: '', RoleID: '' };
                return {
                    set InviteID(v: string) { draft.InviteID = v; },
                    set RoleID(v: string) { draft.RoleID = v; },
                    NewRecord() {},
                    async Save() {
                        savedInviteRoles.push({ ...draft });
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
    for (const app of options.applications ?? []) {
        providerApplications.push(new ApplicationInfo({
            ID: app.ID,
            Name: app.Name,
            Path: app.Path ?? undefined,
        }, provider));
    }
    authMeta.attachProvider(provider);
    return { provider, savedUsers, grantedUserRoles, grantedUserApps, savedSeats, savedInvites, savedInviteApps, savedInviteRoles };
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

    it('uses SpaceType.TargetApplicationID for app grants, invite rows, and invite email copy (CX-6)', async () => {
        const sentEmails: Array<{ subject: string; body: string }> = [];
        const customParticipantRoleId = 'dddddddd-1111-4111-8111-111111111111';
        const { provider, grantedUserRoles, grantedUserApps, savedInvites, savedInviteApps, savedInviteRoles } = createMintMockProvider({
            inviteeRoleIds: [],
            authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
            targetApplicationId: VENDOR_PORTAL_APP_ID,
            targetApplicationName: 'Vendor Portal',
            applications: [
                { ID: COLLABORATION_APP_ID, Name: 'Collaboration', Path: 'collaboration' },
                { ID: VENDOR_PORTAL_APP_ID, Name: 'Vendor Portal', Path: 'vendor-portal' },
            ],
            roles: [
                { ID: customParticipantRoleId, Name: 'Space Participant' },
            ],
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
            email: 'vendor@example.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: {
                ...hostConfig,
                communicationProvider: 'smtp',
                fromAddress: 'noreply@example.test',
                sendInviteEmail: async (_system, _providerName, email) => {
                    sentEmails.push({ subject: email.subject, body: email.body });
                    return true;
                },
            },
        });

        assert.equal(res.ok, true);
        assert.equal(res.sent, true);
        assert.equal(res.targetApplicationId, VENDOR_PORTAL_APP_ID);
        assert.equal(res.targetApplicationName, 'Vendor Portal');
        assert.deepEqual(grantedUserRoles, [{ UserID: INVITEE_USER_ID, RoleID: customParticipantRoleId }]);
        assert.deepEqual(grantedUserApps, [{ UserID: INVITEE_USER_ID, ApplicationID: VENDOR_PORTAL_APP_ID }]);
        assert.equal(savedInvites[0]?.ApplicationID, VENDOR_PORTAL_APP_ID);
        assert.equal(savedInvites[0]?.RoleID, customParticipantRoleId);
        assert.deepEqual(savedInviteApps, [{ InviteID: 'invite-1', ApplicationID: VENDOR_PORTAL_APP_ID }]);
        assert.deepEqual(savedInviteRoles, [{ InviteID: 'invite-1', RoleID: customParticipantRoleId }]);
        assert.match(sentEmails[0]?.subject ?? '', /Vendor Portal/);
        assert.doesNotMatch(sentEmails[0]?.subject ?? '', /Collaboration/);
    });

    it('falls back gracefully to Collaboration when SpaceType.TargetApplicationID is null (CX-6)', async () => {
        const { provider, savedInvites, savedInviteApps } = createMintMockProvider({
            inviteeRoleIds: [PARTICIPANT_ROLE_ID],
            authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
            targetApplicationId: null,
            applications: [
                { ID: COLLABORATION_APP_ID, Name: 'Collaboration', Path: 'collaboration' },
            ],
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
        assert.equal(res.targetApplicationId, COLLABORATION_APP_ID);
        assert.equal(res.targetApplicationName, 'Collaboration');
        assert.equal(savedInvites[0]?.ApplicationID, COLLABORATION_APP_ID);
        assert.deepEqual(savedInviteApps, [{ InviteID: 'invite-1', ApplicationID: COLLABORATION_APP_ID }]);
    });

    it('resolves roles, applications, and SpaceTypes exclusively from input.provider without leaking Metadata.Provider or CollaborationEngine.Instance (CR-5)', async () => {
        const isolatedParticipantRoleId = 'eeeeeeee-1111-4111-8111-111111111111';
        const conflictingGlobalRoleId = '99999999-aaaa-4aaa-8aaa-999999999999';
        const conflictingGlobalAppId = 'bbbbbbbb-aaaa-4aaa-8aaa-bbbbbbbbbbbb';
        const isolatedCustomAppId = 'cccccccc-2222-4222-8222-222222222222';

        const prevProviderDescriptor = Object.getOwnPropertyDescriptor(Metadata, 'Provider');
        const conflictingGlobalProvider = {
            Roles: [new RoleInfo({ ID: conflictingGlobalRoleId, Name: 'Space Participant' })],
            Applications: [] as ApplicationInfo[],
            Authorizations: [],
            AuthorizationRoles: [],
        } as Partial<IMetadataProvider> as IMetadataProvider;
        (conflictingGlobalProvider.Applications as ApplicationInfo[]).push(
            new ApplicationInfo({ ID: COLLABORATION_APP_ID, Name: 'Global Conflicting Collab', Path: 'global-wrong' }, conflictingGlobalProvider),
            new ApplicationInfo({ ID: conflictingGlobalAppId, Name: 'Global Conflicting Portal', Path: 'global-portal-wrong' }, conflictingGlobalProvider),
        );
        Object.defineProperty(Metadata, 'Provider', {
            configurable: true,
            get: () => conflictingGlobalProvider,
        });

        const origSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);
        CollaborationEngine.Instance.SpaceTypeById = () => ({
            ID: SPACE_TYPE_ID,
            TargetApplicationID: conflictingGlobalAppId,
            TargetApplication: 'Global Conflicting Portal',
        } as Partial<ReturnType<typeof origSpaceTypeById> & object> as ReturnType<typeof origSpaceTypeById>);

        try {
            // Case A: input.provider has empty Roles/Applications caches and SpaceType.TargetApplicationID = null in RunView
            const isolatedNullTarget = createMintMockProvider({
                inviteeRoleIds: [],
                authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
                targetApplicationId: null,
                targetApplicationName: null,
                applications: [
                    { ID: COLLABORATION_APP_ID, Name: 'Isolated Collaboration', Path: 'isolated-collab' },
                    { ID: isolatedCustomAppId, Name: 'Isolated Portal', Path: 'isolated-portal' },
                ],
                roles: [
                    { ID: isolatedParticipantRoleId, Name: 'Space Participant' },
                ],
            });
            // Clear in-memory caches on input.provider so only input.provider's RunView supplies Roles/Applications
            (isolatedNullTarget.provider as { Roles: RoleInfo[] }).Roles = [];
            (isolatedNullTarget.provider as { Applications: ApplicationInfo[] }).Applications = [];

            const caller = new UserInfo(isolatedNullTarget.provider, {
                ID: OWNER_USER_ID,
                Type: 'User',
                UserRoles: [{ UserID: OWNER_USER_ID, RoleID: CUSTOM_STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
            });

            const sentEmails: Array<{ subject: string; body: string }> = [];
            const resDefault = await mintSpaceLink({
                provider: isolatedNullTarget.provider,
                user: caller,
                spaceId: SPACE_ID,
                email: 'isolated.default@example.test',
                roleId: GUEST_SPACE_ROLE_ID,
                host: {
                    ...hostConfig,
                    communicationProvider: 'smtp',
                    fromAddress: 'noreply@isolated.test',
                    sendInviteEmail: async (_system, _providerName, email) => {
                        sentEmails.push({ subject: email.subject, body: email.body });
                        return true;
                    },
                },
            });

            assert.equal(resDefault.ok, true);
            assert.equal(resDefault.targetApplicationId, COLLABORATION_APP_ID);
            assert.equal(resDefault.targetApplicationName, 'Isolated Collaboration');
            assert.deepEqual(isolatedNullTarget.grantedUserRoles, [{ UserID: INVITEE_USER_ID, RoleID: isolatedParticipantRoleId }]);
            assert.deepEqual(isolatedNullTarget.savedInviteApps, [{ InviteID: 'invite-1', ApplicationID: COLLABORATION_APP_ID }]);
            assert.equal(isolatedNullTarget.savedInvites[0]?.RoleID, isolatedParticipantRoleId);
            assert.equal(isolatedNullTarget.savedInvites[0]?.ApplicationID, COLLABORATION_APP_ID);
            assert.match(sentEmails[0]?.subject ?? '', /Isolated Collaboration/);
            assert.doesNotMatch(sentEmails[0]?.subject ?? '', /Global Conflicting/);

            // Case B: input.provider has empty Roles/Applications caches and SpaceType.TargetApplicationID = isolatedCustomAppId under IdP mode
            const isolatedCustomTarget = createMintMockProvider({
                inviteeRoleIds: [],
                authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
                targetApplicationId: isolatedCustomAppId,
                targetApplicationName: 'Isolated Portal',
                applications: [
                    { ID: COLLABORATION_APP_ID, Name: 'Isolated Collaboration', Path: 'isolated-collab' },
                    { ID: isolatedCustomAppId, Name: 'Isolated Portal', Path: 'isolated-portal' },
                ],
                roles: [
                    { ID: isolatedParticipantRoleId, Name: 'Space Participant' },
                ],
            });
            (isolatedCustomTarget.provider as { Roles: RoleInfo[] }).Roles = [];
            (isolatedCustomTarget.provider as { Applications: ApplicationInfo[] }).Applications = [];

            const notifications: IdpSignInNotification[] = [];
            const resCustom = await mintSpaceLink({
                provider: isolatedCustomTarget.provider,
                user: caller,
                spaceId: SPACE_ID,
                email: 'isolated.custom@example.test',
                roleId: GUEST_SPACE_ROLE_ID,
                host: {
                    ...hostConfig,
                    enabled: false,
                    idpInvites: true,
                    publicUrl: 'https://portal.isolated.test',
                    sendSignInNotification: async (_system, notification) => {
                        notifications.push(notification);
                        return true;
                    },
                },
            });

            assert.equal(resCustom.ok, true);
            assert.equal(resCustom.sent, true);
            assert.equal(resCustom.targetApplicationId, isolatedCustomAppId);
            assert.equal(resCustom.targetApplicationName, 'Isolated Portal');
            assert.deepEqual(isolatedCustomTarget.grantedUserRoles, [{ UserID: INVITEE_USER_ID, RoleID: isolatedParticipantRoleId }]);
            assert.deepEqual(isolatedCustomTarget.grantedUserApps, [{ UserID: INVITEE_USER_ID, ApplicationID: isolatedCustomAppId }]);
            assert.equal(notifications.length, 1);
            assert.equal(notifications[0]?.signInUrl, 'https://portal.isolated.test/app/isolated-portal');
            assert.equal(notifications[0]?.applicationName, 'Isolated Portal');
        } finally {
            CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
            if (prevProviderDescriptor) {
                Object.defineProperty(Metadata, 'Provider', prevProviderDescriptor);
            }
        }
    });

    it('refuses invite as type-is-staff-only with zero writes when input.provider SpaceType is StaffOnly even if global CollaborationEngine.Instance says StaffAndParticipants (CR-5)', async () => {
        const origSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);
        CollaborationEngine.Instance.SpaceTypeById = () => ({
            ID: SPACE_TYPE_ID,
            Configuration: JSON.stringify({ Seats: { Audience: 'StaffAndParticipants' } }),
        } as Partial<ReturnType<typeof origSpaceTypeById> & object> as ReturnType<typeof origSpaceTypeById>);

        try {
            const state = createMintMockProvider({
                inviteeRoleIds: [],
                authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
                spaceTypeConfiguration: JSON.stringify({ Seats: { Audience: 'StaffOnly' } }),
            });
            const caller = new UserInfo(state.provider, {
                ID: OWNER_USER_ID,
                Type: 'User',
                UserRoles: [{ UserID: OWNER_USER_ID, RoleID: CUSTOM_STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
            });

            const res = await mintSpaceLink({
                provider: state.provider,
                user: caller,
                spaceId: SPACE_ID,
                email: 'blocked-staffonly@example.test',
                roleId: GUEST_SPACE_ROLE_ID,
                host: hostConfig,
            });

            assert.equal(res.ok, false);
            assert.equal(res.kind, 'refused');
            assert.equal(res.reason, 'type-is-staff-only');
            assert.match(res.message ?? '', /seats staff only/i);
            assert.deepEqual(state.savedUsers, []);
            assert.deepEqual(state.grantedUserRoles, []);
            assert.deepEqual(state.grantedUserApps, []);
            assert.deepEqual(state.savedSeats, []);
            assert.deepEqual(state.savedInvites, []);
        } finally {
            CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
        }
    });

    it('succeeds when input.provider SpaceType is StaffAndParticipants even if global CollaborationEngine.Instance says StaffOnly (CR-5)', async () => {
        const origSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);
        CollaborationEngine.Instance.SpaceTypeById = () => ({
            ID: SPACE_TYPE_ID,
            Configuration: JSON.stringify({ Seats: { Audience: 'StaffOnly' } }),
        } as Partial<ReturnType<typeof origSpaceTypeById> & object> as ReturnType<typeof origSpaceTypeById>);

        try {
            const state = createMintMockProvider({
                inviteeRoleIds: [PARTICIPANT_ROLE_ID],
                authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
                spaceTypeConfiguration: JSON.stringify({ Seats: { Audience: 'StaffAndParticipants' } }),
            });
            const caller = new UserInfo(state.provider, {
                ID: OWNER_USER_ID,
                Type: 'User',
                UserRoles: [{ UserID: OWNER_USER_ID, RoleID: CUSTOM_STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
            });

            const res = await mintSpaceLink({
                provider: state.provider,
                user: caller,
                spaceId: SPACE_ID,
                email: 'allowed-participants@example.test',
                roleId: GUEST_SPACE_ROLE_ID,
                host: hostConfig,
            });

            assert.equal(res.ok, true);
            assert.match(res.redemptionUrl ?? '', /\/magic-link\/redeem\?token=mj_ml_/);
            assert.equal(state.savedSeats.length, 1);
            assert.equal(state.savedInvites.length, 1);
        } finally {
            CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
        }
    });

    it('matches TargetApplicationID, Application.ID, and Role.ID case-insensitively via UUIDsEqual (CR-C4-UUID-COMPARISON)', async () => {
        const lowerCustomAppId = 'bb000000-0000-4000-8000-000000000088';
        const upperCustomAppId = lowerCustomAppId.toUpperCase();
        const lowerParticipantRoleId = PARTICIPANT_ROLE_ID.toLowerCase();
        const state = createMintMockProvider({
            inviteeRoleIds: [lowerParticipantRoleId],
            authGrants: { issueLinksRoleIds: [CUSTOM_STAFF_ROLE_ID] },
            targetApplicationId: lowerCustomAppId,
            targetApplicationName: 'Deal Rooms',
            applications: [
                { ID: COLLABORATION_APP_ID.toLowerCase(), Name: 'Collaboration', Path: 'collaboration' },
                { ID: upperCustomAppId, Name: 'Deal Rooms', Path: 'deal-rooms' },
            ],
            roles: [
                { ID: lowerParticipantRoleId, Name: 'Space Participant' },
            ],
        });
        const caller = new UserInfo(state.provider, {
            ID: OWNER_USER_ID,
            Type: 'User',
            UserRoles: [{ UserID: OWNER_USER_ID, RoleID: CUSTOM_STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
        });

        const notifications: IdpSignInNotification[] = [];
        const res = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ID.toLowerCase(),
            email: 'mixedcase-uuid@example.test',
            roleId: GUEST_SPACE_ROLE_ID.toLowerCase(),
            host: {
                ...hostConfig,
                enabled: false,
                idpInvites: true,
                publicUrl: 'https://portal.example.test',
                sendSignInNotification: async (_system, notification) => {
                    notifications.push(notification);
                    return true;
                },
            },
        });

        assert.equal(res.ok, true);
        assert.equal(res.sent, true);
        assert.equal(res.targetApplicationId, lowerCustomAppId);
        assert.equal(res.targetApplicationName, 'Deal Rooms');
        assert.equal(notifications[0]?.signInUrl, 'https://portal.example.test/app/deal-rooms');
        // No duplicate MJ: User Role grant when invitee already holds the lowercase participant role ID
        assert.deepEqual(state.grantedUserRoles, []);
    });
});
