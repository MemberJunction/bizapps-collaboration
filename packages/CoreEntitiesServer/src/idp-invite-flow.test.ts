import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    ApplicationInfo,
    AuthorizationInfo,
    AuthorizationRoleInfo,
    type EntityInfo,
    EntityUserPermissionInfo,
    type IMetadataProvider,
    RoleInfo,
    UserInfo,
    type UserRoleInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from '../dist/CollaborationEngine.js';
import { BaseSpaceTypeServerDriver } from '../dist/base-space-type-server-driver.js';
import {
    inviteSpaceMember,
    mintSpaceLink,
    resolveInvitedSeatsForUser,
    type IdpSignInNotification,
    type MagicLinkHost,
} from '../dist/mint-space-link.js';

const SYSTEM_USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_USER_ID = '22222222-2222-4222-8222-222222222222';
const NON_OWNER_MEMBER_ID = '22222222-2222-4222-8222-222222222223';
const SPACE_ALPHA_ID = '44444444-4444-4444-8444-444444444444';
const SPACE_BETA_ID = '44444444-4444-4444-8444-444444444445';
const TYPE_VENDOR_PORTAL_ID = '55555555-5555-4555-8555-555555555555';
const TYPE_DEFAULT_APP_ID = '55555555-5555-4555-8555-555555555556';
const OWNER_SPACE_ROLE_ID = '66666666-6666-4666-8666-666666666666';
const MEMBER_SPACE_ROLE_ID = '66666666-6666-4666-8666-666666666667';
const GUEST_SPACE_ROLE_ID = '77777777-7777-4777-8777-777777777777';

const ROOT_AUTH_ID = '88888888-8888-4888-8888-888888888881';
const ADMINISTER_AUTH_ID = '88888888-8888-4888-8888-888888888882';
const ISSUE_LINKS_AUTH_ID = '88888888-8888-4888-8888-888888888883';

const STAFF_ROLE_ID = '99999999-9999-4999-8999-999999999992';
const EXISTING_APP_ROLE_ID = '99999999-9999-4999-8999-999999999993';
const PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';

const COLLABORATION_APP_ID = '94f5906b-38ab-4a9f-bfca-3d395bbbc198';
const VENDOR_PORTAL_APP_ID = 'cccccccc-1111-4111-8111-111111111111';
const EXISTING_USER_ID = '33333333-3333-4333-8333-333333333331';
const STAFF_USER_ID = '33333333-3333-4333-8333-333333333332';

interface StoredUser {
    ID: string;
    Name: string;
    FirstName: string;
    LastName: string;
    Email: string;
    Type: string;
    IsActive: boolean;
}

interface StoredUserRole {
    ID: string;
    UserID: string;
    RoleID: string;
}

interface StoredUserApp {
    ID: string;
    UserID: string;
    ApplicationID: string;
    Sequence: number;
    IsActive: boolean;
}

interface StoredSeat {
    ID: string;
    SpaceID: string;
    UserID: string;
    PersonID: string | null;
    SpaceRoleTypeID: string;
    Status: 'Active' | 'Invited' | 'Removed';
    Band: 'Team' | 'Shared';
    SyncSource: string | null;
}

interface StoredSpace {
    ID: string;
    Name: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    OwnerID: string;
    AgentRetrieval: 'Included' | 'Excluded';
    SpaceTypeID: string;
    AllowParentAssignees: boolean;
    ClosedAt: null;
}

interface StoredSpaceType {
    ID: string;
    InviteApproval: 'Approve' | 'AutoApprove';
    MemberCap: number | null;
    TargetApplicationID: string | null;
    TargetApplication: string | null;
    Configuration?: string | null;
}

interface StatefulMockOptions {
    initialUsers?: StoredUser[];
    initialUserRoles?: StoredUserRole[];
    initialUserApps?: StoredUserApp[];
    initialSeats?: StoredSeat[];
    spaces?: StoredSpace[];
    spaceTypes?: StoredSpaceType[];
    failSeatSave?: boolean;
    failUserSave?: boolean;
}

function nextUuid(seq: number): string {
    const tail = seq.toString(16).padStart(12, '0');
    return `ffffffff-0000-4000-8000-${tail}`;
}

function createStatefulIdpProvider(options: StatefulMockOptions = {}) {
    let seq = 1;
    const users: StoredUser[] = [...(options.initialUsers ?? [])];
    const userRoles: StoredUserRole[] = [...(options.initialUserRoles ?? [])];
    const userApps: StoredUserApp[] = [...(options.initialUserApps ?? [])];
    const seats: StoredSeat[] = [
        ...(options.initialSeats ?? [
            {
                ID: 'aaaaaaaa-1111-4111-8111-111111111101',
                SpaceID: SPACE_ALPHA_ID,
                UserID: OWNER_USER_ID,
                PersonID: null,
                SpaceRoleTypeID: OWNER_SPACE_ROLE_ID,
                Status: 'Active',
                Band: 'Team',
                SyncSource: null,
            },
            {
                ID: 'aaaaaaaa-1111-4111-8111-111111111102',
                SpaceID: SPACE_BETA_ID,
                UserID: OWNER_USER_ID,
                PersonID: null,
                SpaceRoleTypeID: OWNER_SPACE_ROLE_ID,
                Status: 'Active',
                Band: 'Team',
                SyncSource: null,
            },
        ]),
    ];
    const spaces: StoredSpace[] = options.spaces ?? [
        {
            ID: SPACE_ALPHA_ID,
            Name: 'Acme Supplier Portal',
            ParentID: null,
            InheritsMembership: false,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            SpaceTypeID: TYPE_VENDOR_PORTAL_ID,
            AllowParentAssignees: true,
            ClosedAt: null,
        },
        {
            ID: SPACE_BETA_ID,
            Name: 'Internal Collaboration Room',
            ParentID: null,
            InheritsMembership: false,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            SpaceTypeID: TYPE_DEFAULT_APP_ID,
            AllowParentAssignees: true,
            ClosedAt: null,
        },
    ];
    const spaceTypes: StoredSpaceType[] = options.spaceTypes ?? [
        {
            ID: TYPE_VENDOR_PORTAL_ID,
            InviteApproval: 'AutoApprove',
            MemberCap: null,
            TargetApplicationID: VENDOR_PORTAL_APP_ID,
            TargetApplication: 'Vendor Portal',
        },
        {
            ID: TYPE_DEFAULT_APP_ID,
            InviteApproval: 'Approve',
            MemberCap: null,
            TargetApplicationID: null,
            TargetApplication: null,
        },
    ];
    const magicLinkInvites: Array<{ Email: string; ApplicationID: string; RoleID: string }> = [];
    const deletedRecordIds: string[] = [];

    const perm = new EntityUserPermissionInfo();
    perm.CanRead = true;
    perm.CanCreate = true;
    perm.CanUpdate = true;
    perm.CanDelete = true;

    const authRoles: AuthorizationRoleInfo[] = [
        new AuthorizationRoleInfo({
            ID: 'aaaaaaaa-0000-4000-8000-000000000001',
            AuthorizationID: ADMINISTER_AUTH_ID,
            RoleID: STAFF_ROLE_ID,
            Type: 'Allow',
        }),
        new AuthorizationRoleInfo({
            ID: 'aaaaaaaa-0000-4000-8000-000000000002',
            AuthorizationID: ISSUE_LINKS_AUTH_ID,
            RoleID: STAFF_ROLE_ID,
            Type: 'Allow',
        }),
    ];
    const authorizations: AuthorizationInfo[] = [];

    const applicationsCatalog: ApplicationInfo[] = [];
    const rolesCatalog = [
        new RoleInfo({ ID: PARTICIPANT_ROLE_ID, Name: 'Space Participant' }),
        new RoleInfo({ ID: STAFF_ROLE_ID, Name: 'Community Manager' }),
        new RoleInfo({ ID: EXISTING_APP_ROLE_ID, Name: 'Partner Analyst' }),
    ];

    function matchIdsFromFilter(filter: string): string[] | null {
        const inMatch = /IN\s*\(([^)]+)\)/i.exec(filter);
        if (inMatch) {
            return [...inMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase());
        }
        const eqMatch = /=\s*'([^']+)'/i.exec(filter);
        return eqMatch ? [eqMatch[1].toLowerCase()] : null;
    }

    const runSingleView = async (params: { EntityName: string; ExtraFilter?: string }) => {
        const filter = params.ExtraFilter ?? '';
        if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
            const ids = matchIdsFromFilter(filter);
            const matched = ids ? spaces.filter((s) => ids.includes(s.ID.toLowerCase())) : spaces;
            return { Success: true, Results: matched };
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
            const ids = matchIdsFromFilter(filter);
            const matched = ids ? spaceTypes.filter((t) => ids.includes(t.ID.toLowerCase())) : spaceTypes;
            return { Success: true, Results: matched };
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
            const allRoles = [
                {
                    ID: OWNER_SPACE_ROLE_ID,
                    Code: 'Owner',
                    Name: 'Owner',
                    Level: 100,
                    MaxGrantableLevel: 100,
                    CanInvite: true,
                    CanPromoteBand: true,
                    CanSeeTeamBand: true,
                    IsOwnerRole: true,
                    CanContribute: true,
                },
                {
                    ID: MEMBER_SPACE_ROLE_ID,
                    Code: 'Member',
                    Name: 'Member',
                    Level: 50,
                    MaxGrantableLevel: 50,
                    CanInvite: true,
                    CanPromoteBand: false,
                    CanSeeTeamBand: true,
                    IsOwnerRole: false,
                    CanContribute: true,
                },
                {
                    ID: GUEST_SPACE_ROLE_ID,
                    Code: 'Guest',
                    Name: 'Guest',
                    Level: 20,
                    MaxGrantableLevel: 0,
                    CanInvite: false,
                    CanPromoteBand: false,
                    CanSeeTeamBand: false,
                    IsOwnerRole: false,
                    CanContribute: true,
                },
            ];
            if (filter.includes('IsOwnerRole = 1')) {
                return { Success: true, Results: allRoles.filter((r) => r.IsOwnerRole) };
            }
            const ids = matchIdsFromFilter(filter);
            const matched = ids ? allRoles.filter((r) => ids.includes(r.ID.toLowerCase())) : allRoles;
            return { Success: true, Results: matched };
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
            let matched = seats;
            const spaceMatch = /SpaceID\s*=\s*'([^']+)'/i.exec(filter);
            if (spaceMatch) {
                const spaceId = spaceMatch[1].toLowerCase();
                matched = matched.filter((s) => s.SpaceID.toLowerCase() === spaceId);
            }
            const userMatch = /UserID\s*=\s*'([^']+)'/i.exec(filter);
            if (userMatch) {
                const userId = userMatch[1].toLowerCase();
                matched = matched.filter((s) => s.UserID.toLowerCase() === userId);
            }
            if (filter.includes("Status <> 'Removed'")) {
                matched = matched.filter((s) => s.Status !== 'Removed');
            } else if (filter.includes("Status = 'Active'")) {
                matched = matched.filter((s) => s.Status === 'Active');
            }
            return { Success: true, Results: matched };
        }
        if (params.EntityName === 'MJ: Users') {
            const emailMatch = /LOWER\(Email\)\s*=\s*'([^']+)'/i.exec(filter);
            if (emailMatch) {
                const targetEmail = emailMatch[1].toLowerCase();
                return { Success: true, Results: users.filter((u) => u.Email.toLowerCase() === targetEmail) };
            }
            const idMatch = /ID\s*=\s*'([^']+)'/i.exec(filter);
            if (idMatch) {
                const targetId = idMatch[1].toLowerCase();
                return { Success: true, Results: users.filter((u) => u.ID.toLowerCase() === targetId) };
            }
            return { Success: true, Results: users };
        }
        if (params.EntityName === 'MJ: User Roles') {
            const userMatch = /UserID\s*=\s*'([^']+)'/i.exec(filter);
            const targetUserId = userMatch ? userMatch[1].toLowerCase() : null;
            const matched = targetUserId
                ? userRoles.filter((r) => r.UserID.toLowerCase() === targetUserId)
                : userRoles;
            return { Success: true, Results: matched };
        }
        if (params.EntityName === 'MJ: User Applications') {
            const userMatch = /UserID\s*=\s*'([^']+)'/i.exec(filter);
            const appMatch = /ApplicationID\s*=\s*'([^']+)'/i.exec(filter);
            const matched = userApps.filter((a) => {
                if (userMatch && a.UserID.toLowerCase() !== userMatch[1].toLowerCase()) return false;
                if (appMatch && a.ApplicationID.toLowerCase() !== appMatch[1].toLowerCase()) return false;
                return true;
            });
            return { Success: true, Results: matched };
        }
        if (params.EntityName === 'MJ: Applications') {
            return {
                Success: true,
                Results: applicationsCatalog.map((a) => ({ ID: a.ID, Name: a.Name, Path: a.Path })),
            };
        }
        if (params.EntityName === 'MJ: Roles') {
            return {
                Success: true,
                Results: rolesCatalog.map((r) => ({ ID: r.ID, Name: r.Name })),
            };
        }
        if (params.EntityName === 'MJ_BizApps_Common: People') {
            return {
                Success: true,
                Results: [{ ID: 'eeeeeeee-0000-4000-8000-000000000001', Email: 'sync@vendor.test', FirstName: 'Sam', LastName: 'Vendor', Name: 'Sam Vendor', LinkedUserID: null }],
            };
        }
        return { Success: true, Results: [] };
    };

    const providerObj = {
        Applications: applicationsCatalog,
        Roles: rolesCatalog,
        Authorizations: authorizations,
        AuthorizationRoles: authRoles,
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
                let loaded: StoredUser | null = null;
                const draft: StoredUser = {
                    ID: '',
                    Name: '',
                    FirstName: '',
                    LastName: '',
                    Email: '',
                    Type: 'User',
                    IsActive: true,
                };
                return {
                    get ID() { return loaded ? loaded.ID : draft.ID; },
                    set Name(v: string) { draft.Name = v; if (loaded) loaded.Name = v; },
                    get Name() { return loaded ? loaded.Name : draft.Name; },
                    set FirstName(v: string) { draft.FirstName = v; if (loaded) loaded.FirstName = v; },
                    set LastName(v: string) { draft.LastName = v; if (loaded) loaded.LastName = v; },
                    set Email(v: string) { draft.Email = v; if (loaded) loaded.Email = v; },
                    set Type(v: string) { draft.Type = v; if (loaded) loaded.Type = v; },
                    set IsActive(v: boolean) { draft.IsActive = v; if (loaded) loaded.IsActive = v; },
                    LinkedEntityID: null,
                    LinkedRecordType: null,
                    LinkedEntityRecordID: null,
                    NewRecord() {
                        loaded = null;
                        draft.ID = nextUuid(seq++);
                    },
                    async Load(id: string) {
                        const found = users.find((u) => u.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        loaded = found;
                        return true;
                    },
                    async Save() {
                        if (options.failUserSave) return false;
                        if (!loaded) {
                            users.push({ ...draft });
                            loaded = users[users.length - 1];
                        }
                        return true;
                    },
                    async Delete() {
                        if (!loaded) return false;
                        const idx = users.findIndex((u) => u.ID === loaded?.ID);
                        if (idx >= 0) {
                            deletedRecordIds.push(users[idx].ID);
                            users.splice(idx, 1);
                            return true;
                        }
                        return false;
                    },
                };
            }
            if (entityName === 'MJ: User Roles') {
                let loaded: StoredUserRole | null = null;
                const draft: StoredUserRole = { ID: '', UserID: '', RoleID: '' };
                return {
                    get ID() { return loaded ? loaded.ID : draft.ID; },
                    set UserID(v: string) { draft.UserID = v; },
                    set RoleID(v: string) { draft.RoleID = v; },
                    NewRecord() {
                        loaded = null;
                        draft.ID = nextUuid(seq++);
                    },
                    async Load(id: string) {
                        const found = userRoles.find((r) => r.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        loaded = found;
                        return true;
                    },
                    async Save() {
                        if (!loaded) {
                            userRoles.push({ ...draft });
                            loaded = userRoles[userRoles.length - 1];
                        }
                        return true;
                    },
                    async Delete() {
                        if (!loaded) return false;
                        const idx = userRoles.findIndex((r) => r.ID === loaded?.ID);
                        if (idx >= 0) {
                            deletedRecordIds.push(userRoles[idx].ID);
                            userRoles.splice(idx, 1);
                            return true;
                        }
                        return false;
                    },
                };
            }
            if (entityName === 'MJ: User Applications') {
                let loaded: StoredUserApp | null = null;
                const draft: StoredUserApp = { ID: '', UserID: '', ApplicationID: '', Sequence: 0, IsActive: true };
                return {
                    get ID() { return loaded ? loaded.ID : draft.ID; },
                    set UserID(v: string) { draft.UserID = v; },
                    set ApplicationID(v: string) { draft.ApplicationID = v; },
                    set Sequence(v: number) { draft.Sequence = v; },
                    set IsActive(v: boolean) { draft.IsActive = v; },
                    NewRecord() {
                        loaded = null;
                        draft.ID = nextUuid(seq++);
                    },
                    async Load(id: string) {
                        const found = userApps.find((a) => a.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        loaded = found;
                        return true;
                    },
                    async Save() {
                        if (!loaded) {
                            userApps.push({ ...draft });
                            loaded = userApps[userApps.length - 1];
                        }
                        return true;
                    },
                    async Delete() {
                        if (!loaded) return false;
                        const idx = userApps.findIndex((a) => a.ID === loaded?.ID);
                        if (idx >= 0) {
                            deletedRecordIds.push(userApps[idx].ID);
                            userApps.splice(idx, 1);
                            return true;
                        }
                        return false;
                    },
                };
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Members') {
                let loaded: StoredSeat | null = null;
                const draft: StoredSeat = {
                    ID: '',
                    SpaceID: '',
                    UserID: '',
                    PersonID: null,
                    SpaceRoleTypeID: '',
                    Status: 'Active',
                    Band: 'Shared',
                    SyncSource: null,
                };
                return {
                    get ID() { return loaded ? loaded.ID : draft.ID; },
                    get Status() { return loaded ? loaded.Status : draft.Status; },
                    set Status(v: 'Active' | 'Invited' | 'Removed') {
                        draft.Status = v;
                        if (loaded) loaded.Status = v;
                    },
                    get SpaceID() { return loaded ? loaded.SpaceID : draft.SpaceID; },
                    set SpaceID(v: string) { draft.SpaceID = v; if (loaded) loaded.SpaceID = v; },
                    get UserID() { return loaded ? loaded.UserID : draft.UserID; },
                    set UserID(v: string) { draft.UserID = v; if (loaded) loaded.UserID = v; },
                    set PersonID(v: string | null) { draft.PersonID = v; if (loaded) loaded.PersonID = v; },
                    get SpaceRoleTypeID() { return loaded ? loaded.SpaceRoleTypeID : draft.SpaceRoleTypeID; },
                    set SpaceRoleTypeID(v: string) { draft.SpaceRoleTypeID = v; if (loaded) loaded.SpaceRoleTypeID = v; },
                    get Band() { return loaded ? loaded.Band : draft.Band; },
                    set Band(v: 'Team' | 'Shared') { draft.Band = v; if (loaded) loaded.Band = v; },
                    set SyncSource(v: string | null) { draft.SyncSource = v; if (loaded) loaded.SyncSource = v; },
                    NewRecord() {
                        loaded = null;
                        draft.ID = nextUuid(seq++);
                    },
                    async Load(id: string) {
                        const found = seats.find((s) => s.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        loaded = found;
                        return true;
                    },
                    async Save() {
                        if (options.failSeatSave) return false;
                        if (!loaded) {
                            seats.push({ ...draft });
                            loaded = seats[seats.length - 1];
                        }
                        return true;
                    },
                };
            }
            if (entityName === 'MJ: Magic Link Invites') {
                const draft = { Email: '', ApplicationID: '', RoleID: '' };
                return {
                    ID: nextUuid(seq++),
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
                        magicLinkInvites.push({ ...draft });
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
    applicationsCatalog.push(
        new ApplicationInfo({ ID: COLLABORATION_APP_ID, Name: 'Collaboration', Path: 'collaboration' }, provider),
        new ApplicationInfo({ ID: VENDOR_PORTAL_APP_ID, Name: 'Vendor Portal', Path: 'vendor-portal' }, provider),
    );
    authorizations.push(
        new AuthorizationInfo({ ID: ROOT_AUTH_ID, Name: 'Collaboration', ParentID: null, IsActive: true }, provider),
        new AuthorizationInfo({ ID: ADMINISTER_AUTH_ID, Name: 'Administer Spaces', ParentID: ROOT_AUTH_ID, IsActive: true }, provider),
        new AuthorizationInfo({ ID: ISSUE_LINKS_AUTH_ID, Name: 'Issue Space Invite Links', ParentID: ROOT_AUTH_ID, IsActive: true }, provider),
    );
    return { provider, users, userRoles, userApps, seats, magicLinkInvites, deletedRecordIds };
}

describe('External IdP invite flow when magicLink.enabled = false (CX-7 & CX-6)', () => {
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;

    before(() => {
        origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Type: 'Owner' }) as Partial<UserInfo> as UserInfo;
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
    });

    function buildIdpHost(
        sentNotifications: IdpSignInNotification[],
        sendResult: boolean | (() => Promise<boolean>) = true,
    ): MagicLinkHost {
        return {
            enabled: false,
            publicUrl: 'https://portal.acme.example',
            restrictedRoleName: 'Magic Link Baseline',
            grantableRoleNames: ['Space Participant'],
            inviteIssuerRoleNames: [],
            communicationProvider: 'smtp',
            fromAddress: 'invites@acme.example',
            defaultExpiresInHours: 72,
            provisioningGuard: 'block',
            sendSignInNotification: async (_system, notification) => {
                sentNotifications.push(notification);
                return typeof sendResult === 'function' ? sendResult() : sendResult;
            },
        };
    }

    it('pre-creates MJ User with Space Participant role only, SpaceType TargetApplication, SpaceMember seat, and sends sign-in notification without magic links', async () => {
        const state = createStatefulIdpProvider();
        const sentNotifications: IdpSignInNotification[] = [];
        const caller = new UserInfo(state.provider, {
            ID: OWNER_USER_ID,
            Type: 'User',
            UserRoles: [{ UserID: OWNER_USER_ID, RoleID: STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
        });

        const res = await inviteSpaceMember({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ALPHA_ID,
            email: 'supplier.user@vendor.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: buildIdpHost(sentNotifications),
        });

        assert.equal(res.ok, true);
        assert.equal(res.sent, true);
        assert.equal(res.redemptionUrl, undefined);
        assert.equal(res.notificationFailed, undefined);
        assert.equal(res.targetApplicationId, VENDOR_PORTAL_APP_ID);
        assert.equal(res.targetApplicationName, 'Vendor Portal');

        assert.equal(state.users.length, 1);
        assert.equal(state.users[0]?.Email, 'supplier.user@vendor.test');
        assert.equal(state.users[0]?.Type, 'User');
        assert.equal(state.users[0]?.IsActive, true);
        assert.equal(res.userId, state.users[0]?.ID);

        assert.deepEqual(
            state.userRoles.map((r) => ({ UserID: r.UserID, RoleID: r.RoleID })),
            [{ UserID: state.users[0].ID, RoleID: PARTICIPANT_ROLE_ID }],
        );
        assert.deepEqual(
            state.userApps.map((a) => ({ UserID: a.UserID, ApplicationID: a.ApplicationID })),
            [{ UserID: state.users[0].ID, ApplicationID: VENDOR_PORTAL_APP_ID }],
        );

        const inviteeSeat = state.seats.find((s) => s.UserID === state.users[0]?.ID);
        assert.ok(inviteeSeat);
        assert.equal(inviteeSeat.SpaceID, SPACE_ALPHA_ID);
        assert.equal(inviteeSeat.Status, 'Active');
        assert.equal(inviteeSeat.SpaceRoleTypeID, GUEST_SPACE_ROLE_ID);

        assert.equal(state.magicLinkInvites.length, 0);
        assert.equal(sentNotifications.length, 1);
        assert.equal(sentNotifications[0]?.applicationId, VENDOR_PORTAL_APP_ID);
        assert.equal(sentNotifications[0]?.applicationName, 'Vendor Portal');
        assert.equal(sentNotifications[0]?.spaceName, 'Acme Supplier Portal');
        assert.equal(sentNotifications[0]?.signInUrl, 'https://portal.acme.example/app/vendor-portal');
        assert.doesNotMatch(sentNotifications[0]?.emailDraft.body ?? '', /magic-link\/redeem/);
    });

    it('falls back gracefully to Collaboration when SpaceType.TargetApplicationID is null under magicLink.enabled = false', async () => {
        const state = createStatefulIdpProvider({
            spaceTypes: [
                {
                    ID: TYPE_DEFAULT_APP_ID,
                    InviteApproval: 'AutoApprove',
                    MemberCap: null,
                    TargetApplicationID: null,
                    TargetApplication: null,
                },
            ],
        });
        const sentNotifications: IdpSignInNotification[] = [];
        const caller = new UserInfo(state.provider, { ID: OWNER_USER_ID, Type: 'Owner' });

        const res = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_BETA_ID,
            email: 'member@partner.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: buildIdpHost(sentNotifications),
        });

        assert.equal(res.ok, true);
        assert.equal(res.sent, true);
        assert.equal(res.targetApplicationId, COLLABORATION_APP_ID);
        assert.equal(res.targetApplicationName, 'Collaboration');
        assert.equal(state.userApps[0]?.ApplicationID, COLLABORATION_APP_ID);
        assert.equal(sentNotifications[0]?.signInUrl, 'https://portal.acme.example/app/collaboration');
        assert.equal(state.magicLinkInvites.length, 0);
    });

    it('reuses an existing non-staff user without stripping prior roles and reuses an existing staff user without adding Space Participant', async () => {
        const state = createStatefulIdpProvider({
            initialUsers: [
                {
                    ID: EXISTING_USER_ID,
                    Name: 'partner@vendor.test',
                    FirstName: 'Partner',
                    LastName: 'User',
                    Email: 'partner@vendor.test',
                    Type: 'User',
                    IsActive: true,
                },
                {
                    ID: STAFF_USER_ID,
                    Name: 'staff@acme.test',
                    FirstName: 'Staff',
                    LastName: 'Admin',
                    Email: 'staff@acme.test',
                    Type: 'User',
                    IsActive: true,
                },
            ],
            initialUserRoles: [
                { ID: 'role-existing-1', UserID: EXISTING_USER_ID, RoleID: EXISTING_APP_ROLE_ID },
                { ID: 'role-staff-1', UserID: STAFF_USER_ID, RoleID: STAFF_ROLE_ID },
            ],
        });
        const sentNotifications: IdpSignInNotification[] = [];
        const caller = new UserInfo(state.provider, { ID: OWNER_USER_ID, Type: 'Owner' });

        const partnerRes = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ALPHA_ID,
            email: 'partner@vendor.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: buildIdpHost(sentNotifications),
        });
        const staffRes = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ALPHA_ID,
            email: 'staff@acme.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: buildIdpHost(sentNotifications),
        });

        assert.equal(partnerRes.ok, true);
        assert.equal(staffRes.ok, true);
        assert.equal(state.users.length, 2);

        const partnerRoles = state.userRoles.filter((r) => r.UserID === EXISTING_USER_ID).map((r) => r.RoleID);
        assert.deepEqual(partnerRoles, [EXISTING_APP_ROLE_ID, PARTICIPANT_ROLE_ID]);

        const staffRoles = state.userRoles.filter((r) => r.UserID === STAFF_USER_ID).map((r) => r.RoleID);
        assert.deepEqual(staffRoles, [STAFF_ROLE_ID]);
        assert.equal(state.deletedRecordIds.length, 0);
    });

    it('supports safe retries when sign-in notification fails and on repeated invites without duplicating users, roles, or seats', async () => {
        const state = createStatefulIdpProvider();
        const sentNotifications: IdpSignInNotification[] = [];
        const caller = new UserInfo(state.provider, { ID: OWNER_USER_ID, Type: 'Owner' });

        let shouldFail = true;
        const host = buildIdpHost(sentNotifications, async () => {
            if (shouldFail) {
                throw new Error('SMTP gateway unavailable');
            }
            return true;
        });

        const failedAttempt = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ALPHA_ID,
            email: 'retry.user@vendor.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host,
        });

        assert.equal(failedAttempt.ok, true);
        assert.equal(failedAttempt.sent, false);
        assert.equal(failedAttempt.notificationFailed, true);
        assert.equal(state.users.length, 1);
        assert.equal(state.seats.filter((s) => s.SpaceID === SPACE_ALPHA_ID).length, 2);

        shouldFail = false;
        const retryAttempt = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ALPHA_ID,
            email: 'retry.user@vendor.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host,
        });

        assert.equal(retryAttempt.ok, true);
        assert.equal(retryAttempt.sent, true);
        assert.equal(retryAttempt.notificationFailed, undefined);
        assert.equal(state.users.length, 1);
        assert.equal(state.userRoles.length, 1);
        assert.equal(state.userApps.length, 1);
        assert.equal(state.seats.filter((s) => s.SpaceID === SPACE_ALPHA_ID).length, 2);
        assert.equal(sentNotifications.length, 2);
    });

    it('rolls back newly created User, UserRole, and UserApplication rows if saving the SpaceMember seat fails', async () => {
        const state = createStatefulIdpProvider({ failSeatSave: true });
        const sentNotifications: IdpSignInNotification[] = [];
        const caller = new UserInfo(state.provider, { ID: OWNER_USER_ID, Type: 'Owner' });

        const res = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ALPHA_ID,
            email: 'rollback@vendor.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: buildIdpHost(sentNotifications),
        });

        assert.equal(res.ok, false);
        assert.equal(state.users.length, 0);
        assert.equal(state.userRoles.length, 0);
        assert.equal(state.userApps.length, 0);
        assert.equal(sentNotifications.length, 0);
    });

    it('creates an Invited seat without sending a sign-in notification when a non-owner invites onto an approval-gated type', async () => {
        const state = createStatefulIdpProvider({
            initialSeats: [
                {
                    ID: 'aaaaaaaa-1111-4111-8111-111111111102',
                    SpaceID: SPACE_BETA_ID,
                    UserID: OWNER_USER_ID,
                    PersonID: null,
                    SpaceRoleTypeID: OWNER_SPACE_ROLE_ID,
                    Status: 'Active',
                    Band: 'Team',
                    SyncSource: null,
                },
                {
                    ID: 'aaaaaaaa-1111-4111-8111-111111111103',
                    SpaceID: SPACE_BETA_ID,
                    UserID: NON_OWNER_MEMBER_ID,
                    PersonID: null,
                    SpaceRoleTypeID: MEMBER_SPACE_ROLE_ID,
                    Status: 'Active',
                    Band: 'Team',
                    SyncSource: null,
                },
            ],
        });
        const sentNotifications: IdpSignInNotification[] = [];
        const caller = new UserInfo(state.provider, { ID: NON_OWNER_MEMBER_ID, Type: 'User' });

        const res = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_BETA_ID,
            email: 'pending.approval@vendor.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: buildIdpHost(sentNotifications),
        });

        assert.equal(res.ok, true);
        assert.equal(res.sent, false);
        assert.match(res.message ?? '', /approves/i);
        assert.equal(sentNotifications.length, 0);
        assert.equal(state.magicLinkInvites.length, 0);
        const createdSeat = state.seats.find((s) => s.SpaceID === SPACE_BETA_ID && s.UserID === state.users[0]?.ID);
        assert.equal(createdSeat?.Status, 'Invited');
    });

    it('resolves seats and target applications strictly from the authenticated UserInfo and computes lockout notices when no seat is active', async () => {
        const invitedUserId = '33333333-3333-4333-8333-333333333399';
        const state = createStatefulIdpProvider({
            initialUsers: [
                {
                    ID: invitedUserId,
                    Name: 'seated@vendor.test',
                    FirstName: 'Seated',
                    LastName: 'User',
                    Email: 'seated@vendor.test',
                    Type: 'User',
                    IsActive: true,
                },
            ],
            initialSeats: [
                {
                    ID: 'seat-active-alpha',
                    SpaceID: SPACE_ALPHA_ID,
                    UserID: invitedUserId,
                    PersonID: null,
                    SpaceRoleTypeID: GUEST_SPACE_ROLE_ID,
                    Status: 'Active',
                    Band: 'Shared',
                    SyncSource: null,
                },
                {
                    ID: 'seat-invited-beta',
                    SpaceID: SPACE_BETA_ID,
                    UserID: invitedUserId,
                    PersonID: null,
                    SpaceRoleTypeID: GUEST_SPACE_ROLE_ID,
                    Status: 'Invited',
                    Band: 'Shared',
                    SyncSource: null,
                },
            ],
        });
        const verifiedUser = new UserInfo(state.provider, {
            ID: invitedUserId,
            Email: 'seated@vendor.test',
            Type: 'User',
        });

        const activeResolution = await resolveInvitedSeatsForUser({
            provider: state.provider,
            user: verifiedUser,
        });

        assert.equal(activeResolution.ok, true);
        assert.equal(activeResolution.userId, invitedUserId);
        assert.equal(activeResolution.activeSeats.length, 1);
        assert.equal(activeResolution.invitedSeats.length, 1);
        assert.equal(activeResolution.lockoutMessage, null);
        assert.equal(activeResolution.activeSeats[0]?.targetApplicationId, VENDOR_PORTAL_APP_ID);
        assert.equal(activeResolution.activeSeats[0]?.targetApplicationName, 'Vendor Portal');
        assert.equal(activeResolution.invitedSeats[0]?.targetApplicationId, COLLABORATION_APP_ID);
        assert.deepEqual(activeResolution.landingApplications.map((a) => a.id), [VENDOR_PORTAL_APP_ID]);

        // Now mark the only active seat Removed -> verified resolution prioritizes the pending Invited seat in lockout message
        state.seats[0].Status = 'Removed';
        const lockedWithInvite = await resolveInvitedSeatsForUser({
            provider: state.provider,
            user: verifiedUser,
        });
        assert.equal(lockedWithInvite.ok, true);
        assert.equal(lockedWithInvite.activeSeats.length, 0);
        assert.equal(lockedWithInvite.removedSeats.length, 1);
        assert.equal(lockedWithInvite.invitedSeats.length, 1);
        assert.ok(lockedWithInvite.lockoutMessage);
        assert.match(lockedWithInvite.lockoutMessage, /Internal Collaboration Room/);

        // When all seats are Removed -> lockout message reports the removed space
        state.seats[1].Status = 'Removed';
        const lockedRemovedOnly = await resolveInvitedSeatsForUser({
            provider: state.provider,
            user: verifiedUser,
        });
        assert.equal(lockedRemovedOnly.ok, true);
        assert.equal(lockedRemovedOnly.activeSeats.length, 0);
        assert.equal(lockedRemovedOnly.removedSeats.length, 2);
        assert.ok(lockedRemovedOnly.lockoutMessage);
        assert.match(lockedRemovedOnly.lockoutMessage, /removed/i);
    });

    it('supports BaseSpaceTypeServerDriver.SyncSeats with external IdP invite provisioning (magicLink.enabled = false)', async () => {
        const state = createStatefulIdpProvider();
        const sentNotifications: IdpSignInNotification[] = [];
        const caller = new UserInfo(state.provider, { ID: OWNER_USER_ID, Type: 'Owner' });

        const space = {
            ID: SPACE_ALPHA_ID,
            SpaceTypeID: TYPE_VENDOR_PORTAL_ID,
            OwnerID: OWNER_USER_ID,
        } as Partial<mjBizAppsCollaborationSpaceEntity> as mjBizAppsCollaborationSpaceEntity;

        const driver = new BaseSpaceTypeServerDriver();
        const result = await driver.SyncSeats(
            space,
            'crm-sync',
            [{
                PersonID: 'eeeeeeee-0000-4000-8000-000000000001',
                RoleTypeName: 'Guest',
            }],
            caller,
            state.provider,
            {
                host: buildIdpHost(sentNotifications),
            },
        );

        assert.deepEqual(result.errors, []);
        assert.equal(result.invited, 1);
        assert.equal(state.users.length, 1);
        assert.equal(state.users[0]?.Email, 'sync@vendor.test');
        assert.equal(state.magicLinkInvites.length, 0);
        assert.equal(sentNotifications.length, 1);
        assert.equal(sentNotifications[0]?.applicationId, VENDOR_PORTAL_APP_ID);
    });

    it('refuses provisioning with role-not-grantable when magicLink.enabled = false and grantableRoleNames is empty (CR-1)', async () => {
        const state = createStatefulIdpProvider();
        const sentNotifications: IdpSignInNotification[] = [];
        const caller = new UserInfo(state.provider, {
            ID: OWNER_USER_ID,
            Type: 'User',
            UserRoles: [{ UserID: OWNER_USER_ID, RoleID: STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
        });

        const emptyAllowlistRes = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ALPHA_ID,
            email: 'blocked.empty@vendor.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: {
                ...buildIdpHost(sentNotifications),
                enabled: false,
                grantableRoleNames: [],
            },
        });

        assert.equal(emptyAllowlistRes.ok, false);
        assert.equal(emptyAllowlistRes.kind, 'refused');
        assert.equal(emptyAllowlistRes.reason, 'role-not-grantable');
        assert.match(emptyAllowlistRes.message ?? '', /grantableRoleNames/i);
        assert.equal(state.users.length, 0);
        assert.equal(state.userRoles.length, 0);
        assert.equal(state.userApps.length, 0);
        assert.equal(state.seats.length, 2); // Only the 2 pre-seeded owner seats
        assert.equal(state.magicLinkInvites.length, 0);
        assert.equal(sentNotifications.length, 0);

        const missingParticipantRes = await mintSpaceLink({
            provider: state.provider,
            user: caller,
            spaceId: SPACE_ALPHA_ID,
            email: 'blocked.other@vendor.test',
            roleId: GUEST_SPACE_ROLE_ID,
            host: {
                ...buildIdpHost(sentNotifications),
                enabled: false,
                grantableRoleNames: ['Other Role'],
            },
        });

        assert.equal(missingParticipantRes.ok, false);
        assert.equal(missingParticipantRes.kind, 'refused');
        assert.equal(missingParticipantRes.reason, 'role-not-grantable');
        assert.equal(state.users.length, 0);
        assert.equal(state.userRoles.length, 0);
        assert.equal(state.userApps.length, 0);
        assert.equal(state.seats.length, 2);
        assert.equal(sentNotifications.length, 0);
    });

    it('uses input.provider SpaceType Configuration for StaffOnly refusal and StaffAndParticipants success regardless of conflicting CollaborationEngine.Instance state (CR-5)', async () => {
        const origSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);

        try {
            // 1. Global engine says StaffAndParticipants, while input.provider's Space Types row says StaffOnly -> refuse with zero writes
            CollaborationEngine.Instance.SpaceTypeById = () => ({
                ID: TYPE_VENDOR_PORTAL_ID,
                Configuration: JSON.stringify({ Seats: { Audience: 'StaffAndParticipants' } }),
            } as Partial<ReturnType<typeof origSpaceTypeById> & object> as ReturnType<typeof origSpaceTypeById>);

            const staffOnlyState = createStatefulIdpProvider({
                spaceTypes: [
                    {
                        ID: TYPE_VENDOR_PORTAL_ID,
                        InviteApproval: 'AutoApprove',
                        MemberCap: null,
                        TargetApplicationID: VENDOR_PORTAL_APP_ID,
                        TargetApplication: 'Vendor Portal',
                        Configuration: JSON.stringify({ Seats: { Audience: 'StaffOnly' } }),
                    },
                ],
            });
            const staffOnlyNotifications: IdpSignInNotification[] = [];
            const caller1 = new UserInfo(staffOnlyState.provider, {
                ID: OWNER_USER_ID,
                Type: 'User',
                UserRoles: [{ UserID: OWNER_USER_ID, RoleID: STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
            });

            const refusedRes = await mintSpaceLink({
                provider: staffOnlyState.provider,
                user: caller1,
                spaceId: SPACE_ALPHA_ID,
                email: 'staff-only-blocked@vendor.test',
                roleId: GUEST_SPACE_ROLE_ID,
                host: buildIdpHost(staffOnlyNotifications),
            });

            assert.equal(refusedRes.ok, false);
            assert.equal(refusedRes.kind, 'refused');
            assert.equal(refusedRes.reason, 'type-is-staff-only');
            assert.match(refusedRes.message ?? '', /seats staff only/i);
            assert.equal(staffOnlyState.users.length, 0);
            assert.equal(staffOnlyState.userRoles.length, 0);
            assert.equal(staffOnlyState.userApps.length, 0);
            assert.equal(staffOnlyState.seats.length, 2); // Only the 2 pre-seeded owner seats
            assert.equal(staffOnlyNotifications.length, 0);

            // 2. Global engine says StaffOnly, while input.provider's Space Types row says StaffAndParticipants -> succeed
            CollaborationEngine.Instance.SpaceTypeById = () => ({
                ID: TYPE_VENDOR_PORTAL_ID,
                Configuration: JSON.stringify({ Seats: { Audience: 'StaffOnly' } }),
            } as Partial<ReturnType<typeof origSpaceTypeById> & object> as ReturnType<typeof origSpaceTypeById>);

            const participantAllowedState = createStatefulIdpProvider({
                spaceTypes: [
                    {
                        ID: TYPE_VENDOR_PORTAL_ID,
                        InviteApproval: 'AutoApprove',
                        MemberCap: null,
                        TargetApplicationID: VENDOR_PORTAL_APP_ID,
                        TargetApplication: 'Vendor Portal',
                        Configuration: JSON.stringify({ Seats: { Audience: 'StaffAndParticipants' } }),
                    },
                ],
            });
            const allowedNotifications: IdpSignInNotification[] = [];
            const caller2 = new UserInfo(participantAllowedState.provider, {
                ID: OWNER_USER_ID,
                Type: 'User',
                UserRoles: [{ UserID: OWNER_USER_ID, RoleID: STAFF_ROLE_ID, Role: 'Community Manager' } as Partial<UserRoleInfo> as UserRoleInfo],
            });

            const allowedRes = await mintSpaceLink({
                provider: participantAllowedState.provider,
                user: caller2,
                spaceId: SPACE_ALPHA_ID,
                email: 'participants-allowed@vendor.test',
                roleId: GUEST_SPACE_ROLE_ID,
                host: buildIdpHost(allowedNotifications),
            });

            assert.equal(allowedRes.ok, true);
            assert.equal(allowedRes.sent, true);
            assert.equal(participantAllowedState.users.length, 1);
            assert.equal(participantAllowedState.userRoles.length, 1);
            assert.equal(participantAllowedState.userApps.length, 1);
            assert.equal(participantAllowedState.seats.length, 3);
            assert.equal(allowedNotifications.length, 1);
        } finally {
            CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
        }
    });
});
