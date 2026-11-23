import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { BaseAction } from '@memberjunction/actions';
import type { RunActionParams } from '@memberjunction/actions-base';
import {
    type BaseEntity,
    CompositeKey,
    type EntityInfo,
    type IEntityDataProvider,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    CollaborationEngine,
    LoadSpaceAudienceActions,
    MANAGE_SPACE_DOC_ACTION,
    ManageSpaceDocAction,
    PROMOTE_SPACE_DRAFT_TO_SHARED_ACTION,
    PromoteSpaceDraftToSharedAction,
    PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION,
    ProposeSpaceAudienceOutputAction,
    PUBLISH_SPACE_SHARED_UPDATE_ACTION,
    PublishSpaceSharedUpdateAction,
    resolvePerRootDeliveryPrincipal,
    type SpaceRunActionParams,
} from '../../dist/index.js';
import { seedAppSettings } from '../app-settings.test-support.ts';

const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';
const OWNER_ID = '11111111-1111-4111-8111-111111111201';
const APPROVER_ID = '11111111-1111-4111-8111-111111111202';
const SHARED_ID = '11111111-1111-4111-8111-111111111203';
const PRINCIPAL_ID = '11111111-1111-4111-8111-111111111299';
const INACTIVE_PRINCIPAL_ID = '11111111-1111-4111-8111-111111111298';
const ROOT_SPACE_ID = '22222222-2222-4222-8222-222222222201';
const SUB_SPACE_ID = '22222222-2222-4222-8222-222222222202';
const UNCONFIGURED_SPACE_ID = '22222222-2222-4222-8222-222222222203';
const SPACE_TYPE_ID = '33333333-3333-4333-8333-333333333301';
const UNCONFIGURED_TYPE_ID = '33333333-3333-4333-8333-333333333302';
const ROLE_TEAM_ID = '44444444-4444-4444-8444-444444444401';
const ROLE_SHARED_ID = '44444444-4444-4444-8444-444444444402';
const CONVERSATION_ID = '55555555-5555-4555-8555-555555555501';
const SPACE_CHAT_ID = '55555555-5555-4555-8555-555555555502';

function makeUser(id: string, name: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const u: Partial<UserInfo> = { ID: id, Name: name, Email: `${name.toLowerCase()}@example.com`, Type: type, IsActive: true, UserRoles: [] };
    return u as UserInfo;
}

function createSupportsAudienceHarness(options: { inactivePrincipal?: boolean } = {}) {
    const savedMessages: Array<{ UserID: string; Message: string; ConversationID: string }> = [];

    const typeConfig = JSON.stringify({
        Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'Always', HistoryOnAdd: 'All' },
        Agents: { ListMode: 'Extend' },
        DeliveryPrincipal: {
            UserID: PRINCIPAL_ID,
            AllowedPrincipalUserIDs: [PRINCIPAL_ID],
            AllowFallbackToCaller: false,
        },
        SpaceOverridable: ['DeliveryPrincipal'],
    });

    const providerImpl: Partial<IMetadataProvider & IRunViewProvider> = {
        Entities: [],
        EntityByName(name: string): EntityInfo | undefined {
            const ids: Record<string, string> = {
                'MJ_BizApps_Collaboration: Spaces': 'E1000000-0000-4000-8000-000000000001',
                'MJ: Conversation Details': 'E1000000-0000-4000-8000-000000000002',
                'MJ: Artifacts': 'E1000000-0000-4000-8000-000000000003',
                'MJ_BizApps_Collaboration: Space Items': 'E1000000-0000-4000-8000-000000000004',
            };
            const id = ids[name];
            if (!id) return undefined;
            const info: Partial<EntityInfo> = { ID: id, Name: name, PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' } as EntityInfo['PrimaryKeys'][number]], Fields: [] };
            return info as EntityInfo;
        },
        EntityByID(): EntityInfo | undefined {
            return undefined;
        },
        GetEntityObject: (async <T extends BaseEntity>(
            entityName: string,
            contextUserOrKey?: UserInfo | CompositeKey,
            contextUserArg?: UserInfo,
        ): Promise<T> => {
            const contextUser = contextUserOrKey instanceof CompositeKey ? contextUserArg : contextUserOrKey;
            if (entityName === 'MJ: Conversation Details') {
                const detail = {
                    ID: 'D-NEW-1',
                    ConversationID: '',
                    UserID: contextUser?.ID ?? '',
                    Role: 'User',
                    Status: 'Complete',
                    Message: '',
                    NewRecord() {
                        detail.ID = `D-${savedMessages.length + 1}`;
                    },
                    async Save() {
                        savedMessages.push({
                            UserID: detail.UserID,
                            Message: detail.Message,
                            ConversationID: detail.ConversationID,
                        });
                        return true;
                    },
                };
                return detail as object as T;
            }
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                const sp = {
                    ID: ROOT_SPACE_ID,
                    SpaceTypeID: SPACE_TYPE_ID,
                    OwnerID: OWNER_ID,
                    ParentID: null as string | null,
                    Name: 'Root Space',
                    ProviderToUse: providerImpl as object as IEntityDataProvider,
                    RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                    async Load() {
                        return true;
                    },
                };
                return sp as object as T;
            }
            const base: Partial<BaseEntity> & { Load?: (id: string) => Promise<boolean> } = {
                ProviderToUse: providerImpl as object as IEntityDataProvider,
                RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                async Load() {
                    return true;
                },
            };
            return base as T;
        }) as object as IMetadataProvider['GetEntityObject'],
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            return Promise.all(paramsList.map((p) => providerImpl.RunView!<T>(p)));
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            const ok = (rows: object[]): RunViewResult<T> => ({
                Success: true,
                Results: rows as object as T[],
                RowCount: rows.length,
                TotalRowCount: rows.length,
                ExecutionTime: 0,
                ErrorMessage: '',
            });

            switch (params.EntityName) {
                case 'MJ_BizApps_Collaboration: Spaces': {
                    const f = String(params.ExtraFilter ?? '');
                    if (f.includes(SUB_SPACE_ID)) {
                        return ok([{ ID: SUB_SPACE_ID, ParentID: ROOT_SPACE_ID, SpaceTypeID: SPACE_TYPE_ID, OwnerID: OWNER_ID, InheritsMembership: true, AgentRetrieval: 'Included', ClosedAt: null, StatusID: null, Configuration: null }]);
                    }
                    if (f.includes(UNCONFIGURED_SPACE_ID)) {
                        return ok([{ ID: UNCONFIGURED_SPACE_ID, ParentID: null, SpaceTypeID: UNCONFIGURED_TYPE_ID, OwnerID: OWNER_ID, InheritsMembership: false, AgentRetrieval: 'Included', ClosedAt: null, StatusID: null, Configuration: null }]);
                    }
                    return ok([{ ID: ROOT_SPACE_ID, ParentID: null, SpaceTypeID: SPACE_TYPE_ID, OwnerID: OWNER_ID, InheritsMembership: false, AgentRetrieval: 'Included', ClosedAt: null, StatusID: null, Configuration: null }]);
                }
                case 'MJ_BizApps_Collaboration: Space Types': {
                    const f = String(params.ExtraFilter ?? '');
                    if (f.includes(UNCONFIGURED_TYPE_ID)) {
                        return ok([{ ID: UNCONFIGURED_TYPE_ID, Code: 'unconfigured', Name: 'Unconfigured', Configuration: null }]);
                    }
                    return ok([{ ID: SPACE_TYPE_ID, Code: 'subtyped', Name: 'Subtyped', Configuration: typeConfig }]);
                }
                case 'MJ_BizApps_Collaboration: Space Members':
                    return ok([
                        { ID: 'M1', SpaceID: ROOT_SPACE_ID, UserID: APPROVER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                        { ID: 'M2', SpaceID: ROOT_SPACE_ID, UserID: PRINCIPAL_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                        { ID: 'M3', SpaceID: ROOT_SPACE_ID, UserID: SHARED_ID, SpaceRoleTypeID: ROLE_SHARED_ID, Band: 'Shared', Status: 'Active' },
                        { ID: 'M4', SpaceID: UNCONFIGURED_SPACE_ID, UserID: APPROVER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                    ]);
                case 'MJ_BizApps_Collaboration: Space Role Types':
                    return ok([
                        { ID: ROLE_TEAM_ID, Level: 80, MaxGrantableLevel: 80, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
                        { ID: ROLE_SHARED_ID, Level: 20, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true },
                    ]);
                case 'MJ_BizApps_Collaboration: Space Anchors':
                    return ok([]);
                case 'MJ: Users': {
                    const f = String(params.ExtraFilter ?? '').toLowerCase();
                    if (f.includes(INACTIVE_PRINCIPAL_ID.toLowerCase()) || options.inactivePrincipal) {
                        return ok([{ ID: PRINCIPAL_ID, Name: 'Inactive Principal', Email: 'inactive@example.com', Type: 'User', IsActive: false }]);
                    }
                    return ok([{ ID: PRINCIPAL_ID, Name: 'Per-Root Principal', Email: 'principal@example.com', Type: 'User', IsActive: true }]);
                }
                case 'MJ: User Roles':
                    return ok([{ ID: 'UR1', UserID: PRINCIPAL_ID, RoleID: ROLE_TEAM_ID, Role: 'Member' }]);
                case 'MJ_BizApps_Collaboration: Space Chats':
                    return ok([{ ID: SPACE_CHAT_ID, ConversationID: CONVERSATION_ID, Kind: 'General', Status: 'Active', OwnerUserID: null }]);
                default:
                    return ok([]);
            }
        },
    };

    return { provider: providerImpl as IMetadataProvider, savedMessages };
}

describe('CA-1 & CA-4: supports-audience-actions.spec.ts', () => {
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let origEngineSpaceTypeById: typeof CollaborationEngine.Instance.SpaceTypeById;
    let origEngineRoleById: typeof CollaborationEngine.Instance.SpaceRoleTypeById;
    let origEngineStatusForSpace: typeof CollaborationEngine.Instance.EffectiveStatusForSpace;
    let origEngineEnsureLoaded: typeof CollaborationEngine.Instance.EnsureLoaded;
    let origMayAdminister: typeof CollaborationEngine.Instance.UserMayAdministerSpaces;
    let restoreAppSettings: () => void;

    before(() => {
        LoadSpaceAudienceActions();
        restoreAppSettings = seedAppSettings();
        origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_ID, 'System', 'Owner');
        origEngineSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);
        origEngineRoleById = CollaborationEngine.Instance.SpaceRoleTypeById.bind(CollaborationEngine.Instance);
        origEngineStatusForSpace = CollaborationEngine.Instance.EffectiveStatusForSpace.bind(CollaborationEngine.Instance);
        origEngineEnsureLoaded = CollaborationEngine.Instance.EnsureLoaded.bind(CollaborationEngine.Instance);
        origMayAdminister = CollaborationEngine.Instance.UserMayAdministerSpaces.bind(CollaborationEngine.Instance);

        CollaborationEngine.Instance.EnsureLoaded = async () => undefined;
        CollaborationEngine.Instance.UserMayAdministerSpaces = () => false;
        CollaborationEngine.Instance.SpaceTypeById = () => undefined;
        CollaborationEngine.Instance.EffectiveStatusForSpace = () => undefined;
        CollaborationEngine.Instance.SpaceRoleTypeById = (id: string | null | undefined) => {
            if (id === ROLE_TEAM_ID) {
                return { ID: ROLE_TEAM_ID, Level: 80, MaxGrantableLevel: 80, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true } as ReturnType<typeof CollaborationEngine.Instance.SpaceRoleTypeById>;
            }
            if (id === ROLE_SHARED_ID) {
                return { ID: ROLE_SHARED_ID, Level: 20, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true } as ReturnType<typeof CollaborationEngine.Instance.SpaceRoleTypeById>;
            }
            return undefined;
        };
    });

    after(() => {
        restoreAppSettings();
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        CollaborationEngine.Instance.SpaceTypeById = origEngineSpaceTypeById;
        CollaborationEngine.Instance.SpaceRoleTypeById = origEngineRoleById;
        CollaborationEngine.Instance.EffectiveStatusForSpace = origEngineStatusForSpace;
        CollaborationEngine.Instance.EnsureLoaded = origEngineEnsureLoaded;
        CollaborationEngine.Instance.UserMayAdministerSpaces = origMayAdminister;
    });

    it('registers all standard SupportsAudience BaseAction subclasses in ClassFactory with AudienceContract', () => {
        const names = [
            PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION,
            PROMOTE_SPACE_DRAFT_TO_SHARED_ACTION,
            PUBLISH_SPACE_SHARED_UPDATE_ACTION,
            MANAGE_SPACE_DOC_ACTION,
        ];
        for (const name of names) {
            const reg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseAction, name);
            assert.ok(reg, `Missing BaseAction ClassFactory registration for ${name}`);
        }
        const propose = new ProposeSpaceAudienceOutputAction();
        const promote = new PromoteSpaceDraftToSharedAction();
        const publish = new PublishSpaceSharedUpdateAction();
        const manageDocs = new ManageSpaceDocAction();

        assert.equal(propose.SupportsAudience, true);
        assert.equal(promote.SupportsAudience, true);
        assert.equal(publish.SupportsAudience, true);
        assert.equal(manageDocs.SupportsAudience, true);
        assert.equal(propose.AudienceContract.SupportsAudience, true);
        assert.equal(publish.AudienceContract.HiddenScopeParams?.some((p) => p.ParamName === 'DeliveryPrincipalID'), true);
    });

    it('CA-4: resolves per-root delivery principal across hierarchy and fails closed when missing or inactive', async () => {
        const { provider } = createSupportsAudienceHarness();
        const resolved = await resolvePerRootDeliveryPrincipal({
            provider,
            spaceId: SUB_SPACE_ID,
        });
        assert.equal(resolved.ok, true);
        if (resolved.ok) {
            assert.equal(resolved.principalUserId, PRINCIPAL_ID);
            assert.equal(resolved.rootSpaceId, ROOT_SPACE_ID);
        }

        const missing = await resolvePerRootDeliveryPrincipal({
            provider,
            spaceId: UNCONFIGURED_SPACE_ID,
        });
        assert.equal(missing.ok, false);

        const inactiveHarness = createSupportsAudienceHarness({ inactivePrincipal: true });
        const inactive = await resolvePerRootDeliveryPrincipal({
            provider: inactiveHarness.provider,
            spaceId: ROOT_SPACE_ID,
        });
        assert.equal(inactive.ok, false);
    });

    it('PublishSpaceSharedUpdateAction rejects spoofed SpaceID/DeliveryPrincipalID and attributes delivery to per-root principal', async () => {
        const { provider, savedMessages } = createSupportsAudienceHarness();
        const approver = makeUser(APPROVER_ID, 'Approver');
        const sharedReader = makeUser(SHARED_ID, 'SharedReader');
        const action = new PublishSpaceSharedUpdateAction();

        // Spoofing attempt must be rejected
        const spoofed = await action.Run({
            Action: { ID: 'A1', Name: PUBLISH_SPACE_SHARED_UPDATE_ACTION } as RunActionParams['Action'],
            ContextUser: approver,
            Provider: provider,
            Filters: [],
            Params: [
                { Name: 'SpaceID', Type: 'Input', Value: ROOT_SPACE_ID },
                { Name: 'Message', Type: 'Input', Value: 'Spoof attempt' },
            ],
            ServerBoundScopeParams: { SpaceID: ROOT_SPACE_ID },
        } as SpaceRunActionParams);
        assert.equal(spoofed.Success, false);
        assert.equal(spoofed.ResultCode, 'SERVER_BOUND_SCOPE_SPOOFING');

        // Clean server-bound execution must deliver attributed to PRINCIPAL_ID (never APPROVER_ID)
        const clean = await action.Run({
            Action: { ID: 'A1', Name: PUBLISH_SPACE_SHARED_UPDATE_ACTION } as RunActionParams['Action'],
            ContextUser: approver,
            Provider: provider,
            Filters: [],
            Params: [
                { Name: 'Message', Type: 'Input', Value: 'Published Shared Announcement' },
                { Name: 'ConversationID', Type: 'Input', Value: CONVERSATION_ID },
            ],
            ServerBoundScopeParams: { SpaceID: ROOT_SPACE_ID },
            Audience: { Readers: [approver, sharedReader] },
        } as SpaceRunActionParams);
        assert.equal(clean.Success, true, clean.Message);
        assert.equal(savedMessages.length, 1);
        assert.equal(savedMessages[0].UserID, PRINCIPAL_ID);
        assert.notEqual(savedMessages[0].UserID, APPROVER_ID);

        // Fail closed when audience includes a reader who does not reach the space
        const outsider = makeUser('99999999-9999-4999-8999-999999999999', 'Outsider');
        const badAudience = await action.Run({
            Action: { ID: 'A1', Name: PUBLISH_SPACE_SHARED_UPDATE_ACTION } as RunActionParams['Action'],
            ContextUser: approver,
            Provider: provider,
            Filters: [],
            Params: [{ Name: 'Message', Type: 'Input', Value: 'Should fail' }],
            ServerBoundScopeParams: { SpaceID: ROOT_SPACE_ID },
            Audience: { Readers: [approver, outsider] },
        } as SpaceRunActionParams);
        assert.equal(badAudience.Success, false);
        assert.equal(badAudience.ResultCode, 'AUDIENCE_VALIDATION_FAILED');
    });
});
