import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    WellKnownUserSource,
    type BaseEntity,
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import {
    CollaborationChatWritePermissionProvider,
    CollaborationEngine,
    RegisterCollaborationChatWritePermissionProvider,
    ResetCollaborationChatWritePermissionRegistrationForTests,
} from '../../dist/index.js';

const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
const OWNER_USER_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_CONTRIBUTOR_ID = '11111111-1111-4111-8111-111111111112';
const SHARED_CONTRIBUTOR_ID = '11111111-1111-4111-8111-111111111113';
const VIEWER_USER_ID = '11111111-1111-4111-8111-111111111114';
const PARENT_ONLY_USER_ID = '11111111-1111-4111-8111-111111111115';
const OUTSIDER_USER_ID = '11111111-1111-4111-8111-111111111116';

const TYPE_STANDARD_ID = '22222222-2222-4222-8222-222222222201';
const TYPE_BAD_DRIVER_ID = '22222222-2222-4222-8222-222222222202';
const TYPE_MALFORMED_ID = '22222222-2222-4222-8222-222222222203';

const ROOT_SPACE_ID = '33333333-3333-4333-8333-333333333301';
const SEALED_CHILD_SPACE_ID = '33333333-3333-4333-8333-333333333302';
const INHERITING_CHILD_SPACE_ID = '33333333-3333-4333-8333-333333333303';
const CLOSED_SPACE_ID = '33333333-3333-4333-8333-333333333304';
const TEAM_LOOSEN_CHILD_ID = '33333333-3333-4333-8333-333333333305';
const UNREGISTERED_DRIVER_SPACE_ID = '33333333-3333-4333-8333-333333333306';
const MALFORMED_SPACE_CFG_ID = '33333333-3333-4333-8333-333333333307';
const MALFORMED_TYPE_CFG_SPACE_ID = '33333333-3333-4333-8333-333333333308';

const CONV_ROOT_GENERAL = '44444444-4444-4444-8444-444444444401';
const CONV_SEALED_GENERAL = '44444444-4444-4444-8444-444444444402';
const CONV_INHERITING_GENERAL = '44444444-4444-4444-8444-444444444403';
const CONV_PRIVATE_TEAM = '44444444-4444-4444-8444-444444444404';
const CONV_ASSISTANT = '44444444-4444-4444-8444-444444444405';
const CONV_CLOSED = '44444444-4444-4444-8444-444444444406';
const CONV_LOOSENED_CHILD = '44444444-4444-4444-8444-444444444407';
const CONV_UNREGISTERED_DRIVER = '44444444-4444-4444-8444-444444444408';
const CONV_MALFORMED_SPACE_CFG = '44444444-4444-4444-8444-444444444409';
const CONV_MALFORMED_TYPE_CFG = '44444444-4444-4444-8444-444444444410';
const CONV_UNRELATED = '44444444-4444-4444-8444-444444444499';

const ROLE_OWNER_ID = '55555555-5555-4555-8555-555555555501';
const ROLE_TEAM_CONTRIBUTOR_ID = '55555555-5555-4555-8555-555555555504';
const ROLE_CONTRIBUTOR_ID = '55555555-5555-4555-8555-555555555502';
const ROLE_VIEWER_ID = '55555555-5555-4555-8555-555555555503';

interface RecordedQuery {
    entityName: string;
    extraFilter: string;
    resultType: string | undefined;
}

function makeUser(id: string, type: 'User' | 'Owner' = 'User'): UserInfo {
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: `User ${id.slice(-2)}`,
        Email: `user-${id.slice(-2)}@example.com`,
        Type: type,
        IsActive: true,
    };
    return partial as UserInfo;
}

function asFilterString(extraFilter: RunViewParams['ExtraFilter']): string {
    return typeof extraFilter === 'string' ? extraFilter : String(extraFilter ?? '');
}

function extractInIds(filter: string, column: string): string[] {
    const match = filter.match(new RegExp(`${column}\\s+IN\\s*\\(([^)]+)\\)`, 'i'));
    if (!match) return [];
    return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase());
}

function extractEq(filter: string, column: string): string | null {
    const match = filter.match(new RegExp(`${column}\\s*=\\s*'([^']+)'`, 'i'));
    return match ? match[1].toLowerCase() : null;
}

function createPermissionTestProvider(options?: { failEntityName?: string }) {
    const queries: RecordedQuery[] = [];
    let entityLoads = 0;

    const chats = [
        { ID: 'c-1', SpaceID: ROOT_SPACE_ID, ConversationID: CONV_ROOT_GENERAL, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'c-2', SpaceID: SEALED_CHILD_SPACE_ID, ConversationID: CONV_SEALED_GENERAL, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'c-3', SpaceID: INHERITING_CHILD_SPACE_ID, ConversationID: CONV_INHERITING_GENERAL, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'c-4', SpaceID: ROOT_SPACE_ID, ConversationID: CONV_PRIVATE_TEAM, Kind: 'Private', Status: 'Active', OwnerUserID: OWNER_USER_ID },
        { ID: 'c-5', SpaceID: ROOT_SPACE_ID, ConversationID: CONV_ASSISTANT, Kind: 'Assistant', Status: 'Active', OwnerUserID: OWNER_USER_ID },
        { ID: 'c-6', SpaceID: CLOSED_SPACE_ID, ConversationID: CONV_CLOSED, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'c-7', SpaceID: TEAM_LOOSEN_CHILD_ID, ConversationID: CONV_LOOSENED_CHILD, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'c-8', SpaceID: UNREGISTERED_DRIVER_SPACE_ID, ConversationID: CONV_UNREGISTERED_DRIVER, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'c-9', SpaceID: MALFORMED_SPACE_CFG_ID, ConversationID: CONV_MALFORMED_SPACE_CFG, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'c-10', SpaceID: MALFORMED_TYPE_CFG_SPACE_ID, ConversationID: CONV_MALFORMED_TYPE_CFG, Kind: 'General', Status: 'Active', OwnerUserID: null },
    ];

    const spaces = [
        {
            ID: ROOT_SPACE_ID,
            ParentID: null,
            InheritsMembership: false,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null,
            StatusID: null,
            SpaceTypeID: TYPE_STANDARD_ID,
            Configuration: JSON.stringify({ Chats: { WhoCanWrite: 'Contributors' } }),
        },
        {
            ID: SEALED_CHILD_SPACE_ID,
            ParentID: ROOT_SPACE_ID,
            InheritsMembership: false,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            AllowParentAssignees: false,
            ClosedAt: null,
            StatusID: null,
            SpaceTypeID: TYPE_STANDARD_ID,
            Configuration: null,
        },
        {
            ID: INHERITING_CHILD_SPACE_ID,
            ParentID: ROOT_SPACE_ID,
            InheritsMembership: true,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null,
            StatusID: null,
            SpaceTypeID: TYPE_STANDARD_ID,
            Configuration: null,
        },
        {
            ID: CLOSED_SPACE_ID,
            ParentID: null,
            InheritsMembership: false,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: '2026-01-01T00:00:00Z',
            StatusID: null,
            SpaceTypeID: TYPE_STANDARD_ID,
            Configuration: null,
        },
        {
            ID: TEAM_LOOSEN_CHILD_ID,
            ParentID: ROOT_SPACE_ID,
            InheritsMembership: true,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null,
            StatusID: null,
            SpaceTypeID: TYPE_STANDARD_ID,
            Configuration: JSON.stringify({ Chats: { WhoCanWrite: 'Contributors' } }),
        },
        {
            ID: UNREGISTERED_DRIVER_SPACE_ID,
            ParentID: null,
            InheritsMembership: false,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null,
            StatusID: null,
            SpaceTypeID: TYPE_BAD_DRIVER_ID,
            Configuration: null,
        },
        {
            ID: MALFORMED_SPACE_CFG_ID,
            ParentID: null,
            InheritsMembership: false,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null,
            StatusID: null,
            SpaceTypeID: TYPE_STANDARD_ID,
            Configuration: '{bad-json',
        },
        {
            ID: MALFORMED_TYPE_CFG_SPACE_ID,
            ParentID: null,
            InheritsMembership: false,
            OwnerID: OWNER_USER_ID,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null,
            StatusID: null,
            SpaceTypeID: TYPE_MALFORMED_ID,
            Configuration: null,
        },
    ];

    const spaceTypes = [
        { ID: TYPE_STANDARD_ID, Code: 'STD', Name: 'Standard', ServerDriverClass: null, Configuration: JSON.stringify({ Chats: { WhoCanWrite: 'Contributors' } }) },
        { ID: TYPE_BAD_DRIVER_ID, Code: 'BAD', Name: 'MissingDriver', ServerDriverClass: 'NonExistentDriverClass_NeverRegistered', Configuration: null },
        { ID: TYPE_MALFORMED_ID, Code: 'MAL', Name: 'MalformedType', ServerDriverClass: null, Configuration: '{not-valid-json' },
    ];

    const members = [
        { ID: 'm-1', SpaceID: ROOT_SPACE_ID, UserID: OWNER_USER_ID, SpaceRoleTypeID: ROLE_OWNER_ID, Band: 'Team', Status: 'Active' },
        { ID: 'm-2', SpaceID: ROOT_SPACE_ID, UserID: TEAM_CONTRIBUTOR_ID, SpaceRoleTypeID: ROLE_TEAM_CONTRIBUTOR_ID, Band: 'Team', Status: 'Active' },
        { ID: 'm-3', SpaceID: ROOT_SPACE_ID, UserID: SHARED_CONTRIBUTOR_ID, SpaceRoleTypeID: ROLE_CONTRIBUTOR_ID, Band: 'Shared', Status: 'Active' },
        { ID: 'm-4', SpaceID: ROOT_SPACE_ID, UserID: VIEWER_USER_ID, SpaceRoleTypeID: ROLE_VIEWER_ID, Band: 'Shared', Status: 'Active' },
        { ID: 'm-5', SpaceID: ROOT_SPACE_ID, UserID: PARENT_ONLY_USER_ID, SpaceRoleTypeID: ROLE_TEAM_CONTRIBUTOR_ID, Band: 'Team', Status: 'Active' },
    ];

    const roles = [
        { ID: ROLE_OWNER_ID, Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
        { ID: ROLE_TEAM_CONTRIBUTOR_ID, Level: 30, MaxGrantableLevel: 20, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true },
        { ID: ROLE_CONTRIBUTOR_ID, Level: 20, MaxGrantableLevel: 20, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true },
        { ID: ROLE_VIEWER_ID, Level: 10, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: false },
    ];

    const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
        EntityByID(): EntityInfo | undefined {
            return undefined;
        },
        async GetEntityObject<T>(entityName: string): Promise<T> {
            const obj = {
                async Load(): Promise<boolean> {
                    if (entityName !== 'MJ_BizApps_Collaboration: Space Types') {
                        entityLoads += 1;
                    }
                    return false;
                },
            };
            return obj as Partial<BaseEntity> as T;
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            const filter = asFilterString(params.ExtraFilter);
            queries.push({
                entityName: params.EntityName ?? '',
                extraFilter: filter,
                resultType: params.ResultType,
            });
            if (options?.failEntityName && params.EntityName === options.failEntityName) {
                return {
                    Success: false,
                    Results: [],
                    UserViewRunID: '',
                    RowCount: 0,
                    TotalRowCount: 0,
                    ExecutionTime: 0,
                    ErrorMessage: 'Simulated database failure',
                };
            }
            const ok = (rows: T[]): RunViewResult<T> => ({
                Success: true,
                Results: rows,
                UserViewRunID: '',
                RowCount: rows.length,
                TotalRowCount: rows.length,
                ExecutionTime: 0,
                ErrorMessage: '',
            });

            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                const convId = extractEq(filter, 'ConversationID');
                return ok(chats.filter((c) => c.ConversationID.toLowerCase() === convId) as T[]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                const spaceId = extractEq(filter, 'ID');
                return ok(spaces.filter((s) => s.ID.toLowerCase() === spaceId) as T[]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                const typeId = extractEq(filter, 'ID');
                return ok(spaceTypes.filter((t) => t.ID.toLowerCase() === typeId) as T[]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                const spaceIds = extractInIds(filter, 'SpaceID');
                const userId = extractEq(filter, 'UserID');
                return ok(
                    members.filter(
                        (m) =>
                            spaceIds.includes(m.SpaceID.toLowerCase()) &&
                            m.UserID.toLowerCase() === userId &&
                            m.Status === 'Active',
                    ) as T[],
                );
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                const roleIds = extractInIds(filter, 'ID');
                return ok(roles.filter((r) => roleIds.includes(r.ID.toLowerCase())) as T[]);
            }
            return ok([]);
        },
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            return Promise.all(paramsList.map((p) => this.RunView!<T>(p)));
        },
    };

    return {
        provider: providerObj as IMetadataProvider,
        queries,
        getEntityLoads: () => entityLoads,
        spaces,
    };
}

describe('CS-3 CollaborationChatWritePermissionProvider', () => {
    let heldSystem: typeof WellKnownUserSource.Instance.GetSystemUser;
    let heldIsSystem: typeof WellKnownUserSource.Instance.IsSystemUser;
    const engine = CollaborationEngine.Instance;
    let heldEnsureLoaded: typeof engine.EnsureLoaded;
    let heldSpaceTypeById: typeof engine.SpaceTypeById;
    let heldStatusReach: typeof engine.StatusReachForSpace;
    let heldSettingsDesc: PropertyDescriptor | undefined;
    let appWhoCanWrite: 'Contributors' | 'TeamOnly' | 'Owners' | undefined = undefined;
    let typeOverrideWhoCanWrite: 'Contributors' | 'TeamOnly' | 'Owners' | null = null;

    const providerInstance = CollaborationChatWritePermissionProvider.Instance;

    before(() => {
        heldSystem = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        heldIsSystem = WellKnownUserSource.Instance.IsSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_ID, 'Owner');
        WellKnownUserSource.Instance.IsSystemUser = (u: UserInfo) => u.ID === SYSTEM_ID;

        heldEnsureLoaded = engine.EnsureLoaded.bind(engine);
        heldSpaceTypeById = engine.SpaceTypeById.bind(engine);
        heldStatusReach = engine.StatusReachForSpace.bind(engine);
        heldSettingsDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(engine), 'CollaborationSettings');

        engine.EnsureLoaded = async () => undefined;
        engine.StatusReachForSpace = (row) => ({
            ReadOnly: Boolean(row.ClosedAt),
            Visible: true,
            AgentRetrieval: true,
        });
        engine.SpaceTypeById = (id: string | null | undefined) => {
            if (!id) return undefined;
            if (id.toLowerCase() === TYPE_STANDARD_ID.toLowerCase()) {
                const st: Partial<mjBizAppsCollaborationSpaceTypeEntity> = {
                    ID: TYPE_STANDARD_ID,
                    Code: 'STD',
                    Name: 'Standard',
                    ServerDriverClass: null,
                    Configuration: typeOverrideWhoCanWrite
                        ? JSON.stringify({ Chats: { WhoCanWrite: typeOverrideWhoCanWrite } })
                        : JSON.stringify({ Chats: { WhoCanWrite: 'Contributors' } }),
                };
                return st as mjBizAppsCollaborationSpaceTypeEntity;
            }
            return undefined;
        };
        Object.defineProperty(engine, 'CollaborationSettings', {
            configurable: true,
            get: () => (appWhoCanWrite ? { Chats: { WhoCanWrite: appWhoCanWrite } } : {}),
        });
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = heldSystem;
        WellKnownUserSource.Instance.IsSystemUser = heldIsSystem;
        engine.EnsureLoaded = heldEnsureLoaded;
        engine.SpaceTypeById = heldSpaceTypeById;
        engine.StatusReachForSpace = heldStatusReach;
        if (heldSettingsDesc) {
            Object.defineProperty(engine, 'CollaborationSettings', heldSettingsDesc);
        }
        ResetCollaborationChatWritePermissionRegistrationForTests();
    });

    it('abstains for system user and non-collaboration conversations', async () => {
        const { provider } = createPermissionTestProvider();

        const sysVerdict = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(SYSTEM_ID, 'Owner'),
            Operation: 'create',
            ConversationID: CONV_ROOT_GENERAL,
        });
        assert.equal(sysVerdict.Decision, 'Abstain');

        const unrelatedVerdict = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(OUTSIDER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_UNRELATED,
        });
        assert.equal(unrelatedVerdict.Decision, 'Abstain');
    });

    it('allows active contributor, denies viewer/outsider, and enforces sealed vs inherited boundaries', async () => {
        const { provider } = createPermissionTestProvider();

        const allowContributor = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(SHARED_CONTRIBUTOR_ID),
            Operation: 'create',
            ConversationID: CONV_ROOT_GENERAL,
        });
        assert.equal(allowContributor.Decision, 'Allow');

        const denyViewer = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(VIEWER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_ROOT_GENERAL,
        });
        assert.equal(denyViewer.Decision, 'Deny');

        const denyOutsider = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(OUTSIDER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_ROOT_GENERAL,
        });
        assert.equal(denyOutsider.Decision, 'Deny');

        const denySealedParentMember = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(PARENT_ONLY_USER_ID),
            Operation: 'create',
            ConversationID: CONV_SEALED_GENERAL,
        });
        assert.equal(denySealedParentMember.Decision, 'Deny');

        const allowInheritedParentMember = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(PARENT_ONLY_USER_ID),
            Operation: 'create',
            ConversationID: CONV_INHERITING_GENERAL,
        });
        assert.equal(allowInheritedParentMember.Decision, 'Allow');
    });

    it('enforces Private (Team band), Assistant (Owner/server reply), Closed status, and update/delete authorship', async () => {
        const { provider } = createPermissionTestProvider();

        const denySharedInPrivate = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(SHARED_CONTRIBUTOR_ID),
            Operation: 'create',
            ConversationID: CONV_PRIVATE_TEAM,
        });
        assert.equal(denySharedInPrivate.Decision, 'Deny');

        const allowTeamInPrivate = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(TEAM_CONTRIBUTOR_ID),
            Operation: 'create',
            ConversationID: CONV_PRIVATE_TEAM,
        });
        assert.equal(allowTeamInPrivate.Decision, 'Allow');

        const denyContributorInAssistant = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(TEAM_CONTRIBUTOR_ID),
            Operation: 'create',
            ConversationID: CONV_ASSISTANT,
        });
        assert.equal(denyContributorInAssistant.Decision, 'Deny');

        const allowOwnerInAssistant = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(OWNER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_ASSISTANT,
        });
        assert.equal(allowOwnerInAssistant.Decision, 'Allow');

        const denyClosed = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(OWNER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_CLOSED,
        });
        assert.equal(denyClosed.Decision, 'Deny');

        const denyUpdateOtherAuthor = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(TEAM_CONTRIBUTOR_ID),
            Operation: 'update',
            ConversationID: CONV_ROOT_GENERAL,
            ConversationDetail: { UserID: SHARED_CONTRIBUTOR_ID, Role: 'user' },
        });
        assert.equal(denyUpdateOtherAuthor.Decision, 'Deny');

        const allowOwnerDeleteOther = await providerInstance.EvaluateWritePermission({
            Provider: provider,
            ContextUser: makeUser(OWNER_USER_ID),
            Operation: 'delete',
            ConversationID: CONV_ROOT_GENERAL,
            ConversationDetail: { UserID: SHARED_CONTRIBUTOR_ID, Role: 'user' },
        });
        assert.equal(allowOwnerDeleteOther.Decision, 'Allow');
    });

    it('enforces non-loosening WhoCanWrite policy hierarchy across App -> SpaceType -> Space', async () => {
        const { provider } = createPermissionTestProvider();
        typeOverrideWhoCanWrite = 'TeamOnly';
        try {
            const denySharedDespiteChildLoosen = await providerInstance.EvaluateWritePermission({
                Provider: provider,
                ContextUser: makeUser(SHARED_CONTRIBUTOR_ID),
                Operation: 'create',
                ConversationID: CONV_LOOSENED_CHILD,
            });
            assert.equal(denySharedDespiteChildLoosen.Decision, 'Deny');

            const allowTeamUnderTeamOnly = await providerInstance.EvaluateWritePermission({
                Provider: provider,
                ContextUser: makeUser(TEAM_CONTRIBUTOR_ID),
                Operation: 'create',
                ConversationID: CONV_LOOSENED_CHILD,
            });
            assert.equal(allowTeamUnderTeamOnly.Decision, 'Allow');

            appWhoCanWrite = 'Owners';
            const denyTeamWhenAppRequiresOwners = await providerInstance.EvaluateWritePermission({
                Provider: provider,
                ContextUser: makeUser(TEAM_CONTRIBUTOR_ID),
                Operation: 'create',
                ConversationID: CONV_LOOSENED_CHILD,
            });
            assert.equal(denyTeamWhenAppRequiresOwners.Decision, 'Deny');
        } finally {
            appWhoCanWrite = undefined;
            typeOverrideWhoCanWrite = null;
        }
    });

    it('fails closed on unregistered driver, malformed config JSON, and RunView failures while batching RunView simple queries', async () => {
        const normal = createPermissionTestProvider();

        const badDriver = await providerInstance.EvaluateWritePermission({
            Provider: normal.provider,
            ContextUser: makeUser(OWNER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_UNREGISTERED_DRIVER,
        });
        assert.equal(badDriver.Decision, 'Deny');

        const badSpaceCfg = await providerInstance.EvaluateWritePermission({
            Provider: normal.provider,
            ContextUser: makeUser(OWNER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_MALFORMED_SPACE_CFG,
        });
        assert.equal(badSpaceCfg.Decision, 'Deny');

        const badTypeCfg = await providerInstance.EvaluateWritePermission({
            Provider: normal.provider,
            ContextUser: makeUser(OWNER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_MALFORMED_TYPE_CFG,
        });
        assert.equal(badTypeCfg.Decision, 'Deny');

        normal.queries.length = 0;
        const allowInherited = await providerInstance.EvaluateWritePermission({
            Provider: normal.provider,
            ContextUser: makeUser(PARENT_ONLY_USER_ID),
            Operation: 'create',
            ConversationID: CONV_INHERITING_GENERAL,
        });
        assert.equal(allowInherited.Decision, 'Allow');
        assert.equal(normal.getEntityLoads(), 0, 'zero N+1 entity hydrations for members/roles');
        assert.equal(normal.queries.every((q) => q.resultType === 'simple'), true);
        const memberQueries = normal.queries.filter((q) => q.entityName === 'MJ_BizApps_Collaboration: Space Members');
        const roleQueries = normal.queries.filter((q) => q.entityName === 'MJ_BizApps_Collaboration: Space Role Types');
        assert.equal(memberQueries.length, 1);
        assert.match(memberQueries[0].extraFilter, /SpaceID IN \(/);
        assert.equal(roleQueries.length, 1);
        assert.match(roleQueries[0].extraFilter, /ID IN \(/);

        const failedDb = createPermissionTestProvider({ failEntityName: 'MJ_BizApps_Collaboration: Space Members' });
        const dbFailureVerdict = await providerInstance.EvaluateWritePermission({
            Provider: failedDb.provider,
            ContextUser: makeUser(OWNER_USER_ID),
            Operation: 'create',
            ConversationID: CONV_ROOT_GENERAL,
        });
        assert.equal(dbFailureVerdict.Decision, 'Deny');

        ResetCollaborationChatWritePermissionRegistrationForTests();
        const registered = RegisterCollaborationChatWritePermissionProvider();
        assert.equal(typeof registered, 'boolean');
    });
});
