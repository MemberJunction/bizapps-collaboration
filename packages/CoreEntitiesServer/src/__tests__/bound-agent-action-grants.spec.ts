import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams, ServerBoundScopeValue, SupportsAudienceContract } from '@memberjunction/actions-base';
import { AgentRunner } from '@memberjunction/ai-agents';
import type { ExecuteAgentParams, ExecuteAgentResult, MJAIAgentRunEntityExtended } from '@memberjunction/ai-core-plus';
import {
    AuthorizationInfo,
    BaseEntity,
    type EntityInfo,
    type IEntityDataProvider,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
    UserRoleInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    CollaborationBoundActionGrantRegistry,
    CollaborationEngine,
    executeSpaceChatTurn,
    resolveTurnTools,
    SCOPED_SEARCH_ACTION_ID,
} from '../../dist/index.js';
import { seedAppSettings } from '../app-settings.test-support.ts';

const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000000';
const OWNER_USER_ID = '11111111-1111-4111-8111-111111111101';
const TEAM_USER_ID = '11111111-1111-4111-8111-111111111102';
const SHARED_USER_ID = '11111111-1111-4111-8111-111111111103';
const PRINCIPAL_USER_ID = '11111111-1111-4111-8111-111111111199';
const SPACE_TYPE_ID = '22222222-2222-4222-8222-222222222201';
const ROOT_SPACE_ID = '33333333-3333-4333-8333-333333333301';
const ANCHOR_ENTITY_ID = '44444444-4444-4444-8444-444444444401';
const ANCHOR_RECORD_ID = '55555555-5555-4555-8555-555555555501';
const ROLE_TEAM_ID = '66666666-6666-4666-8666-666666666601';
const ROLE_SHARED_ID = '66666666-6666-4666-8666-666666666602';
const AGENT_ID = '77777777-7777-4777-8777-777777777701';
const CONVERSATION_ID = '88888888-8888-4888-8888-888888888801';
const SPACE_CHAT_ID = '88888888-8888-4888-8888-888888888802';
const USER_MSG_ID = '88888888-8888-4888-8888-888888888803';
const BOUND_ACTION_ID = '99999999-9999-4999-8999-999999999901';
const TEAM_BOUND_ACTION_ID = '99999999-9999-4999-8999-999999999902';
const GRANT_SHARED_ID = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
const GRANT_TEAM_ID = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAB';

const TEST_DRIVER_NAME = 'Collaboration: Test Bound Echo Action';

class TestBoundEchoAction extends BaseAction {
    public static LastCapturedParams: ActionParam[] = [];
    public static LastServerBoundScope: Record<string, ServerBoundScopeValue | undefined> = {};

    public override get SupportsAudience(): boolean {
        return true;
    }

    public override get AudienceContract(): SupportsAudienceContract {
        return {
            SupportsAudience: true,
            SupportedModes: ['Intersection', 'ScopeCommonReach'],
        };
    }

    protected override async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        TestBoundEchoAction.LastCapturedParams = [...params.Params];
        TestBoundEchoAction.LastServerBoundScope = { ...(params.ServerBoundScopeParams ?? {}) };
        const userNote = params.Params.find((p) => p.Name === 'UserNote')?.Value ?? '';
        const spaceId = params.Params.find((p) => p.Name === 'SpaceID')?.Value ?? '';
        return {
            Success: true,
            ResultCode: 'SUCCESS',
            Message: `Executed with SpaceID=${String(spaceId)}, UserNote=${String(userNote)}`,
        };
    }
}
RegisterClass(BaseAction, TEST_DRIVER_NAME)(TestBoundEchoAction);

function makeUser(id: string, name: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: name,
        Email: `${name.toLowerCase()}@example.com`,
        Type: type,
        IsActive: true,
        UserRoles: [],
    };
    return partial as UserInfo;
}

interface AuditEntry {
    details: string | null;
    status: string;
}

function createBoundGrantMockProvider() {
    const auditLogs: AuditEntry[] = [];
    const savedDetails: Array<{ ID: string; Message: string; Status: string }> = [];
    let detailSeq = 0;

    const typeConfig = JSON.stringify({
        Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'Always', HistoryOnAdd: 'All' },
        Agents: { ListMode: 'Extend', EnableBoundActionGrants: true },
        DeliveryPrincipal: { UserID: PRINCIPAL_USER_ID, AllowFallbackToCaller: false },
    });

    const providerImpl: Partial<IMetadataProvider & IRunViewProvider> & {
        CreateAuditLogRecord: (
            user: UserInfo,
            authName: string | null,
            auditLogTypeName: string,
            status: string,
            details: string | null,
        ) => Promise<BaseEntity | null>;
    } = {
        Entities: [],
        CurrentUser: makeUser(OWNER_USER_ID, 'Owner'),
        EntityByName(name: string): EntityInfo | undefined {
            const map: Record<string, string> = {
                'MJ_BizApps_Collaboration: Spaces': 'E0000000-0000-4000-8000-000000000001',
                'MJ_BizApps_Collaboration: Space Grants': 'E0000000-0000-4000-8000-000000000002',
                'MJ: Actions': 'E0000000-0000-4000-8000-000000000003',
                [ANCHOR_ENTITY_ID]: ANCHOR_ENTITY_ID,
            };
            const id = map[name];
            if (!id) return undefined;
            const info: Partial<EntityInfo> = { ID: id, Name: name, PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' } as EntityInfo['PrimaryKeys'][number]], Fields: [] };
            return info as EntityInfo;
        },
        EntityByID(id: string): EntityInfo | undefined {
            if (id.toUpperCase() === ANCHOR_ENTITY_ID) {
                const info: Partial<EntityInfo> = {
                    ID: ANCHOR_ENTITY_ID,
                    Name: 'Core: Accounts',
                    PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' } as EntityInfo['PrimaryKeys'][number]],
                    Fields: [{ Name: 'ID' } as EntityInfo['Fields'][number]],
                };
                return info as EntityInfo;
            }
            return undefined;
        },
        async GetEntityObject<T extends BaseEntity>(entityName: string): Promise<T> {
            if (entityName === 'MJ: Conversation Details') {
                const state = {
                    ID: USER_MSG_ID,
                    ConversationID: CONVERSATION_ID,
                    UserID: TEAM_USER_ID,
                    Role: 'User',
                    Status: 'Complete',
                    Message: 'Please run the bound action',
                    ParentID: null as string | null,
                    AgentID: null as string | null,
                    HiddenToUser: false,
                    IsPinned: false,
                    OriginalMessageChanged: false,
                    ExternalID: null as string | null,
                    NewRecord() {
                        detailSeq += 1;
                        state.ID = `88888888-8888-4888-8888-00000000010${detailSeq}`;
                    },
                    async Load(id: string) {
                        return id.toLowerCase() === USER_MSG_ID.toLowerCase();
                    },
                    async Save() {
                        savedDetails.push({ ID: state.ID, Message: state.Message, Status: state.Status });
                        return true;
                    },
                };
                return state as object as T;
            }
            if (entityName === 'MJ: AI Agents') {
                const agentObj = {
                    ID: AGENT_ID,
                    Name: 'Space Assistant',
                    async Load(id: string) {
                        return id.toLowerCase() === AGENT_ID.toLowerCase();
                    },
                };
                return agentObj as object as T;
            }
            if (entityName === 'MJ: AI Agent Runs') {
                const runObj = {
                    ID: '99990000-0000-4000-8000-000000000001',
                    ExternalReferenceID: null as string | null,
                    async Load() {
                        return true;
                    },
                    async Save() {
                        return true;
                    },
                };
                return runObj as object as T;
            }
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                const spaceObj = {
                    ID: ROOT_SPACE_ID,
                    SpaceTypeID: SPACE_TYPE_ID,
                    OwnerID: OWNER_USER_ID,
                    ParentID: null as string | null,
                    Name: 'Root Space',
                    ProviderToUse: providerImpl as object as IEntityDataProvider,
                    RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                    async Load(id: string) {
                        return id.toLowerCase() === ROOT_SPACE_ID.toLowerCase();
                    },
                };
                return spaceObj as object as T;
            }
            const base: Partial<BaseEntity> & { Load?: (id: string) => Promise<boolean> } = {
                ProviderToUse: providerImpl as object as IEntityDataProvider,
                RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                async Load() {
                    return true;
                },
            };
            return base as T;
        },
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            return Promise.all(paramsList.map((p) => providerImpl.RunView!<T>(p)));
        },
        async CreateAuditLogRecord(_user, _auth, _type, status, details) {
            auditLogs.push({ status, details });
            const row: Partial<BaseEntity> = {};
            return row as BaseEntity;
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
                case 'MJ_BizApps_Collaboration: Spaces':
                    return ok([
                        {
                            ID: ROOT_SPACE_ID,
                            ParentID: null,
                            SpaceTypeID: SPACE_TYPE_ID,
                            OwnerID: OWNER_USER_ID,
                            InheritsMembership: false,
                            AgentRetrieval: 'Included',
                            ClosedAt: null,
                            StatusID: null,
                            Configuration: null,
                            Name: 'Root Space',
                        },
                    ]);
                case 'MJ_BizApps_Collaboration: Space Types':
                    return ok([{ ID: SPACE_TYPE_ID, Code: 'subtyped', Name: 'Subtyped', Configuration: typeConfig }]);
                case 'MJ_BizApps_Collaboration: Space Members':
                    return ok([
                        { ID: 'M1', SpaceID: ROOT_SPACE_ID, UserID: TEAM_USER_ID, User: 'Team User', SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
                        { ID: 'M2', SpaceID: ROOT_SPACE_ID, UserID: SHARED_USER_ID, User: 'Shared User', SpaceRoleTypeID: ROLE_SHARED_ID, Band: 'Shared', Status: 'Active' },
                    ]);
                case 'MJ_BizApps_Collaboration: Space Role Types':
                    return ok([
                        { ID: ROLE_TEAM_ID, Level: 80, MaxGrantableLevel: 80, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
                        { ID: ROLE_SHARED_ID, Level: 20, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true },
                    ]);
                case 'MJ_BizApps_Collaboration: Space Anchors':
                    return ok([
                        { ID: 'A1', SpaceID: ROOT_SPACE_ID, EntityID: ANCHOR_ENTITY_ID, RecordID: `ID|${ANCHOR_RECORD_ID}`, Role: 'primary', IsPrimary: true },
                    ]);
                case 'MJ_BizApps_Collaboration: Space Grants':
                    return ok([
                        {
                            ID: GRANT_SHARED_ID,
                            SpaceID: ROOT_SPACE_ID,
                            SpaceTypeID: null,
                            Kind: 'Action',
                            Mode: 'Extend',
                            TargetEntityID: 'E0000000-0000-4000-8000-000000000003',
                            TargetRecordID: BOUND_ACTION_ID,
                            Label: 'Echo Bound Shared Action',
                            Band: 'Shared',
                            IsDefault: false,
                            Bindings: JSON.stringify({
                                AccountID: { From: 'Anchor:primary' },
                                DeliveryPrincipalID: { From: 'DeliveryPrincipal.ID' },
                            }),
                            Settings: null,
                            Sequence: 1,
                        },
                        {
                            ID: GRANT_TEAM_ID,
                            SpaceID: ROOT_SPACE_ID,
                            SpaceTypeID: null,
                            Kind: 'Action',
                            Mode: 'Extend',
                            TargetEntityID: 'E0000000-0000-4000-8000-000000000003',
                            TargetRecordID: TEAM_BOUND_ACTION_ID,
                            Label: 'Team Bound Action',
                            Band: 'Team',
                            IsDefault: false,
                            Bindings: JSON.stringify({ SpaceID: { From: 'Space.ID' } }),
                            Settings: null,
                            Sequence: 2,
                        },
                        {
                            ID: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAC',
                            SpaceID: ROOT_SPACE_ID,
                            SpaceTypeID: null,
                            Kind: 'Agent',
                            Mode: 'Extend',
                            TargetEntityID: 'E-AGENT',
                            TargetRecordID: AGENT_ID,
                            Label: 'Space Assistant',
                            Band: 'Shared',
                            IsDefault: true,
                            Bindings: null,
                            Settings: null,
                            Sequence: 1,
                        },
                    ]);
                case 'MJ: Actions':
                    return ok([
                        {
                            ID: BOUND_ACTION_ID,
                            Name: TEST_DRIVER_NAME,
                            Description: 'Bound echo action for space agents',
                            DriverClass: TEST_DRIVER_NAME,
                            Type: 'Custom',
                            Status: 'Active',
                        },
                        {
                            ID: TEAM_BOUND_ACTION_ID,
                            Name: TEST_DRIVER_NAME,
                            Description: 'Team-only bound action',
                            DriverClass: TEST_DRIVER_NAME,
                            Type: 'Custom',
                            Status: 'Active',
                        },
                    ]);
                case 'MJ: Action Params':
                    return ok([
                        { ActionID: BOUND_ACTION_ID, Name: 'SpaceID', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Hidden space', DefaultValue: null },
                        { ActionID: BOUND_ACTION_ID, Name: 'RootEntityID', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Hidden entity', DefaultValue: null },
                        { ActionID: BOUND_ACTION_ID, Name: 'RootRecordID', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Hidden record', DefaultValue: null },
                        { ActionID: BOUND_ACTION_ID, Name: 'Band', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Hidden band', DefaultValue: null },
                        { ActionID: BOUND_ACTION_ID, Name: 'DeliveryPrincipalID', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Hidden principal', DefaultValue: null },
                        { ActionID: BOUND_ACTION_ID, Name: 'AccountID', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Hidden anchor', DefaultValue: null },
                        { ActionID: BOUND_ACTION_ID, Name: 'UserNote', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'User message note', DefaultValue: null },
                        { ActionID: TEAM_BOUND_ACTION_ID, Name: 'SpaceID', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Hidden space', DefaultValue: null },
                        { ActionID: TEAM_BOUND_ACTION_ID, Name: 'UserNote', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'User message note', DefaultValue: null },
                    ]);
                case 'MJ: Users':
                    return ok([
                        { ID: PRINCIPAL_USER_ID, Name: 'Root Delivery Principal', Email: 'principal@example.com', Type: 'User', IsActive: true },
                        { ID: TEAM_USER_ID, Name: 'Team User', Email: 'team@example.com', Type: 'User', IsActive: true },
                    ]);
                case 'MJ: User Roles':
                    return ok([{ ID: 'UR1', UserID: PRINCIPAL_USER_ID, RoleID: ROLE_TEAM_ID, Role: 'Member' }]);
                case 'MJ_BizApps_Collaboration: Space Chats':
                    return ok([{ ID: SPACE_CHAT_ID, ConversationID: CONVERSATION_ID, Kind: 'General', Status: 'Active', OwnerUserID: null }]);
                case 'MJ: Conversation Details':
                    return ok([]);
                case 'MJ: AI Agent Runs':
                case 'MJ: AI Agent Actions':
                case 'MJ_BizApps_Collaboration: Space Items':
                case 'MJ: Scoped Prompt Parts':
                    return ok([]);
                case 'MJ: AI Agents':
                    return ok([{ ID: AGENT_ID, Name: 'Space Assistant' }]);
                default:
                    return ok([]);
            }
        },
    };

    return {
        provider: providerImpl as IMetadataProvider,
        auditLogs,
        savedDetails,
    };
}

describe('CX-3: bound-agent-action-grants.spec.ts', () => {
    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let origRunAgent: typeof AgentRunner.prototype.RunAgent;
    let origEngineSpaceTypeById: typeof CollaborationEngine.Instance.SpaceTypeById;
    let origEngineRoleById: typeof CollaborationEngine.Instance.SpaceRoleTypeById;
    let origEngineStatusForSpace: typeof CollaborationEngine.Instance.EffectiveStatusForSpace;
    let origEngineEnsureLoaded: typeof CollaborationEngine.Instance.EnsureLoaded;
    let origMayAdminister: typeof CollaborationEngine.Instance.UserMayAdministerSpaces;
    let restoreAppSettings: () => void;

    before(() => {
        restoreAppSettings = seedAppSettings();
        origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_USER_ID, 'System', 'Owner');
        origRunAgent = AgentRunner.prototype.RunAgent;
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
                return {
                    ID: ROLE_TEAM_ID,
                    Level: 80,
                    MaxGrantableLevel: 80,
                    CanInvite: true,
                    CanPromoteBand: true,
                    CanSeeTeamBand: true,
                    IsOwnerRole: true,
                    CanContribute: true,
                } as ReturnType<typeof CollaborationEngine.Instance.SpaceRoleTypeById>;
            }
            if (id === ROLE_SHARED_ID) {
                return {
                    ID: ROLE_SHARED_ID,
                    Level: 20,
                    MaxGrantableLevel: 0,
                    CanInvite: false,
                    CanPromoteBand: false,
                    CanSeeTeamBand: false,
                    IsOwnerRole: false,
                    CanContribute: true,
                } as ReturnType<typeof CollaborationEngine.Instance.SpaceRoleTypeById>;
            }
            return undefined;
        };
    });

    after(() => {
        restoreAppSettings();
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        AgentRunner.prototype.RunAgent = origRunAgent;
        CollaborationEngine.Instance.SpaceTypeById = origEngineSpaceTypeById;
        CollaborationEngine.Instance.SpaceRoleTypeById = origEngineRoleById;
        CollaborationEngine.Instance.EffectiveStatusForSpace = origEngineStatusForSpace;
        CollaborationEngine.Instance.EnsureLoaded = origEngineEnsureLoaded;
        CollaborationEngine.Instance.UserMayAdministerSpaces = origMayAdminister;
    });

    it('strips all hidden bound parameters from agent-visible schemas and respects Shared vs Team audience cut', async () => {
        const { provider } = createBoundGrantMockProvider();
        const teamUser = makeUser(TEAM_USER_ID, 'TeamUser');
        const systemUser = makeUser(SYSTEM_USER_ID, 'System', 'Owner');

        const { loadSpaceConfiguration } = await import('../../dist/space-configuration.js');
        const loaded = await loadSpaceConfiguration(provider, ROOT_SPACE_ID, { reader: systemUser });

        const sharedTurn = await CollaborationBoundActionGrantRegistry.Instance.ResolveForTurn({
            provider,
            systemUser,
            spaceId: ROOT_SPACE_ID,
            audience: 'Shared',
            loadedConfiguration: loaded,
            callerUser: teamUser,
        });

        assert.equal(sharedTurn.exposures.length, 1);
        const sharedExposure = sharedTurn.exposures[0];
        assert.deepEqual(
            sharedExposure.ExposedParams.map((p) => p.Name),
            ['UserNote'],
        );
        assert.equal('SpaceID' in sharedExposure.ToolSchema.parameters.properties, false);
        assert.equal('RootEntityID' in sharedExposure.ToolSchema.parameters.properties, false);
        assert.equal('RootRecordID' in sharedExposure.ToolSchema.parameters.properties, false);
        assert.equal('Band' in sharedExposure.ToolSchema.parameters.properties, false);
        assert.equal('DeliveryPrincipalID' in sharedExposure.ToolSchema.parameters.properties, false);
        assert.equal('AccountID' in sharedExposure.ToolSchema.parameters.properties, false);
        assert.equal(sharedExposure.HiddenBoundParamNames.length, 6);

        const boundForAgent = sharedTurn.boundActionParams[BOUND_ACTION_ID];
        assert.ok(boundForAgent);
        assert.equal(boundForAgent['SpaceID'], ROOT_SPACE_ID);
        assert.equal(boundForAgent['AccountID'], ANCHOR_RECORD_ID);
        assert.equal(boundForAgent['DeliveryPrincipalID'], PRINCIPAL_USER_ID);

        const teamTurn = await CollaborationBoundActionGrantRegistry.Instance.ResolveForTurn({
            provider,
            systemUser,
            spaceId: ROOT_SPACE_ID,
            audience: 'Team',
            loadedConfiguration: loaded,
            callerUser: teamUser,
        });
        assert.equal(teamTurn.exposures.length, 2);
    });

    it('rejects caller/agent spoofing of hidden bound parameters and logs to audit log', async () => {
        const { provider, auditLogs } = createBoundGrantMockProvider();
        const teamUser = makeUser(TEAM_USER_ID, 'TeamUser');

        const spoofAttempt = await CollaborationBoundActionGrantRegistry.Instance.InvokeBoundAction({
            provider,
            callerUser: teamUser,
            spaceId: ROOT_SPACE_ID,
            audience: 'Shared',
            actionIdOrName: BOUND_ACTION_ID,
            callerArgs: {
                UserNote: 'Legit note',
                spaceid: '00000000-0000-4000-8000-999999999999',
                AccountID: 'SPOOFED-ACCOUNT',
            },
            overridePolicy: 'Reject',
        });

        assert.equal(spoofAttempt.Success, false);
        assert.equal(spoofAttempt.ResultCode, 'SERVER_BOUND_SCOPE_SPOOFING');
        assert.equal(auditLogs.some((l) => l.status === 'Failed' && (l.details ?? '').includes('SERVER_BOUND_SCOPE_SPOOFING')), true);
    });

    it('injects server-bound values exclusively on dispatch and supports StripAndInject override policy', async () => {
        const { provider, auditLogs } = createBoundGrantMockProvider();
        const teamUser = makeUser(TEAM_USER_ID, 'TeamUser');

        const cleanInvoke = await CollaborationBoundActionGrantRegistry.Instance.InvokeBoundAction({
            provider,
            callerUser: teamUser,
            spaceId: ROOT_SPACE_ID,
            audience: 'Shared',
            actionIdOrName: BOUND_ACTION_ID,
            callerArgs: { UserNote: 'Quarterly summary' },
        });
        assert.equal(cleanInvoke.Success, true);
        assert.equal(TestBoundEchoAction.LastServerBoundScope['SpaceID'], ROOT_SPACE_ID);
        assert.equal(TestBoundEchoAction.LastServerBoundScope['AccountID'], ANCHOR_RECORD_ID);
        assert.equal(TestBoundEchoAction.LastServerBoundScope['DeliveryPrincipalID'], PRINCIPAL_USER_ID);

        const stripInvoke = await CollaborationBoundActionGrantRegistry.Instance.InvokeBoundAction({
            provider,
            callerUser: teamUser,
            spaceId: ROOT_SPACE_ID,
            audience: 'Shared',
            actionIdOrName: BOUND_ACTION_ID,
            callerArgs: { UserNote: 'Overwritten spoof', SpaceID: 'EVIL-SPACE', Band: 'Team' },
            overridePolicy: 'StripAndInject',
        });
        assert.equal(stripInvoke.Success, true);
        assert.equal(TestBoundEchoAction.LastServerBoundScope['SpaceID'], ROOT_SPACE_ID);
        assert.equal(TestBoundEchoAction.LastServerBoundScope['Band'], 'Shared');
        assert.equal(auditLogs.some((l) => l.status === 'Success' && (l.details ?? '').includes('strippedSpoofedNames')), true);
    });

    it('denies Team-band bound action grants when invoked by a Shared-band participant', async () => {
        const { provider } = createBoundGrantMockProvider();
        const sharedUser = makeUser(SHARED_USER_ID, 'SharedUser');

        const denied = await CollaborationBoundActionGrantRegistry.Instance.InvokeBoundAction({
            provider,
            callerUser: sharedUser,
            spaceId: ROOT_SPACE_ID,
            audience: 'Team',
            actionIdOrName: TEAM_BOUND_ACTION_ID,
            callerArgs: { UserNote: 'Should fail' },
        });
        assert.equal(denied.Success, false);
        assert.equal(denied.ResultCode, 'UNAUTHORIZED');
    });

    it('wires boundActionParams and redacted boundActions catalog into executeSpaceChatTurn when enabled', async () => {
        const { provider } = createBoundGrantMockProvider();
        const teamUser = makeUser(TEAM_USER_ID, 'TeamUser');
        let capturedRunnerParams: ExecuteAgentParams | null = null;

        AgentRunner.prototype.RunAgent = async (params: ExecuteAgentParams): Promise<ExecuteAgentResult> => {
            capturedRunnerParams = params;
            if (params.onAgentRunCreated) {
                await params.onAgentRunCreated('99990000-0000-4000-8000-000000000001');
            }
            const runStub: Partial<MJAIAgentRunEntityExtended> = {
                ID: '99990000-0000-4000-8000-000000000001',
                Message: 'Agent turn completed cleanly.',
                Status: 'Completed',
            };
            return {
                success: true,
                agentRun: runStub as MJAIAgentRunEntityExtended,
                payload: { message: 'Agent turn completed cleanly.' },
            };
        };

        const turnResult = await executeSpaceChatTurn(provider, teamUser, {
            spaceId: ROOT_SPACE_ID,
            conversationId: CONVERSATION_ID,
            userMessageId: USER_MSG_ID,
            enableBoundActionGrants: true,
        });

        assert.equal(turnResult.ok, true, turnResult.ok ? '' : turnResult.message);
        assert.ok(capturedRunnerParams);
        const rp = capturedRunnerParams as ExecuteAgentParams;
        assert.ok(rp.boundActionParams);
        assert.equal(rp.boundActionParams[BOUND_ACTION_ID]['SpaceID'], ROOT_SPACE_ID);
        assert.equal(rp.boundActionParams[BOUND_ACTION_ID]['AccountID'], ANCHOR_RECORD_ID);
        assert.equal(turnResult.ok ? turnResult.tools?.actionIds.includes(SCOPED_SEARCH_ACTION_ID) : false, true);
        assert.equal(turnResult.ok ? turnResult.tools?.actionIds.includes(BOUND_ACTION_ID) : false, true);

        const dataObj = rp.data as { boundActions?: Array<{ parameters: Array<{ Name: string }> }> };
        assert.ok(Array.isArray(dataObj.boundActions));
        assert.deepEqual(
            dataObj.boundActions[0].parameters.map((p) => p.Name),
            ['UserNote'],
        );

        // Preserve Slice 1 default behavior when includeBoundActions is omitted
        const { loadSpaceConfiguration } = await import('../../dist/space-configuration.js');
        const loaded = await loadSpaceConfiguration(provider, ROOT_SPACE_ID, { reader: makeUser(SYSTEM_USER_ID, 'System', 'Owner') });
        const legacyTools = await resolveTurnTools(provider, makeUser(SYSTEM_USER_ID, 'System', 'Owner'), loaded.configuration, 'Shared', AGENT_ID);
        assert.equal(legacyTools.withheld.some((w) => w.includes('waits for A16')), true);
    });
});
