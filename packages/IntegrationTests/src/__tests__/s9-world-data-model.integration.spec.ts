import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BaseAction } from '@memberjunction/actions';
import type {
    ActionResultSimple,
    RunActionParams,
    ServerBoundScopeValue,
    SupportsAudienceContract,
} from '@memberjunction/actions-base';
import { AgentRunner } from '@memberjunction/ai-agents';
import type { ExecuteAgentParams, ExecuteAgentResult, MJAIAgentRunEntityExtended } from '@memberjunction/ai-core-plus';
import {
    type BaseEntity,
    CompositeKey,
    EntityFieldTSType,
    type EntityInfo,
    type IEntityDataProvider,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import {
    type ArtifactDelegateContext,
    BaseArtifactPermissionDelegate,
} from '@memberjunction/core-entities';
import { MJGlobal, RegisterClass } from '@memberjunction/global';
import {
    DEFAULT_COLLABORATION_SETTINGS,
    type Band,
    type CollaborationSettings,
} from '@mj-biz-apps/collaboration-core';
import {
    CollaborationBoundActionGrantRegistry,
    CollaborationChatWritePermissionProvider,
    CollaborationEngine,
    CollaborationSpaceItemArtifactPermissionDelegate,
    createSpaceDoc,
    decideAndPromoteSpaceDraft,
    EnsureSpaceForRecord,
    executeSpaceChatTurn,
    getSpaceApprovalTask,
    getSpaceDoc,
    listSpaceApprovalTasks,
    listSpaceDocs,
    LoadCollaborationSpaceItemArtifactPermissionDelegate,
    loadSpaceConfiguration,
    LoadSpaceAudienceActions,
    PROMOTE_SPACE_DRAFT_TO_SHARED_ACTION,
    PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION,
    resolvePerRootDeliveryPrincipal,
    resolveSpaceScopedPromptParts,
} from '@mj-biz-apps/collaboration-core-entities-server';
import type { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';

const SYSTEM_ID = '00000000-0000-4000-8000-000000000000';
const OWNER_ID = '11111111-1111-4111-8111-111111111901';
const TEAM_USER_ID = '11111111-1111-4111-8111-111111111902';
const SHARED_USER_ID = '11111111-1111-4111-8111-111111111903';
const OUTSIDER_ID = '11111111-1111-4111-8111-111111111904';
const DELIVERY_PRINCIPAL_ID = '11111111-1111-4111-8111-111111111999';

const SPACE_TYPE_ID = '22222222-2222-4222-8222-222222222901';
const OTHER_TYPE_ID = '22222222-2222-4222-8222-222222222902';
const SUBTYPE_ENTITY_NAME = 'Example Account Rooms';
const SUBTYPE_ENTITY_ID = '33333333-3333-4333-8333-333333333901';
const ANCHOR_ENTITY_ID = '33333333-3333-4333-8333-333333333902';
const ANCHOR_RECORD_ID = '44444444-4444-4444-8444-444444444901';
const OTHER_SPACE_ID = '55555555-5555-4555-8555-555555555999';

const ROLE_OWNER_ID = '66666666-6666-4666-8666-666666666901';
const ROLE_TEAM_ID = '66666666-6666-4666-8666-666666666902';
const ROLE_SHARED_ID = '66666666-6666-4666-8666-666666666903';
const ROLE_VIEWER_ID = '66666666-6666-4666-8666-666666666904';

const CHAT_GENERAL_ID = '77777777-7777-4777-8777-777777777901';
const CHAT_TEAM_PRIVATE_ID = '77777777-7777-4777-8777-777777777902';
const CONV_GENERAL_ID = '77777777-7777-4777-8777-777777777911';
const CONV_TEAM_PRIVATE_ID = '77777777-7777-4777-8777-777777777912';
const USER_MSG_ID = '77777777-7777-4777-8777-777777777921';
const AGENT_ID = '88888888-8888-4888-8888-888888888901';
const GRANT_ACTION_ID = '99999999-9999-4999-8999-999999999901';
const GRANT_ID = '99999999-9999-4999-8999-999999999902';
const PROMPT_ID = 'AAAA0000-0000-4000-8000-000000000901';

const APPROVAL_TYPE_ID = 'BBBB0000-0000-4000-8000-000000000901';
const OUTCOME_APPROVED_ID = 'CCCC0000-0000-4000-8000-000000000901';
const OUTCOME_REJECTED_ID = 'CCCC0000-0000-4000-8000-000000000902';
const MARKDOWN_DOC_TYPE_ID = 'DDDD0000-0000-4000-8000-000000000901';

const WORLD_BOUND_DRIVER = 'Collaboration: World Integration Bound Action';

@RegisterClass(BaseAction, WORLD_BOUND_DRIVER)
class WorldIntegrationBoundAction extends BaseAction {
    public static LastBoundScope: Record<string, ServerBoundScopeValue | undefined> = {};

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
        WorldIntegrationBoundAction.LastBoundScope = { ...(params.ServerBoundScopeParams ?? {}) };
        const note = params.Params.find((p) => p.Name === 'Summary')?.Value ?? '';
        const spaceId = params.Params.find((p) => p.Name === 'SpaceID')?.Value ?? '';
        return {
            Success: true,
            ResultCode: 'SUCCESS',
            Message: `WorldAction[SpaceID=${String(spaceId)}]: ${String(note)}`,
        };
    }
}

function makeUser(id: string, name: string, type: 'Owner' | 'User' = 'User'): UserInfo {
    const u: Partial<UserInfo> = {
        ID: id,
        Name: name,
        Email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        Type: type,
        IsActive: true,
        UserRoles: [],
    };
    return u as UserInfo;
}

interface StoredSpace {
    ID: string;
    Name: string;
    SpaceTypeID: string;
    OwnerID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    Status: string;
    Configuration: string | null;
}
interface StoredMember {
    ID: string;
    SpaceID: string;
    UserID: string;
    SpaceRoleTypeID: string;
    Band: Band;
    Status: string;
}
interface StoredAnchor {
    ID: string;
    SpaceID: string;
    SpaceTypeID: string;
    EntityID: string;
    RecordID: string;
    Role: string;
    IsPrimary: boolean;
    Sequence: number;
}
interface StoredChat {
    ID: string;
    SpaceID: string;
    ConversationID: string;
    Kind: string;
    Status: string;
    CreatedByUserID: string;
    AllowedAgentsMode: string;
    OwnerUserID: string | null;
}
interface StoredTask {
    ID: string;
    Name: string;
    Description: string | null;
    TypeID: string;
    Status: string;
    Priority: string;
    ParentID: string | null;
    CreatedByPersonID: string | null;
    CompletedAt: Date | null;
    CompletionNotes: string | null;
}
interface StoredLink {
    ID: string;
    TaskID: string;
    EntityID: string;
    RecordID: string;
    Description: string | null;
}
interface StoredItem {
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Band: Band;
    Folder: string | null;
    ArtifactVersionID: string | null;
    PromotedAt: Date | null;
    PromotedByUserID: string | null;
}
interface StoredArtifact {
    ID: string;
    Name: string;
    TypeID: string;
    UserID: string;
    DelegateEntityID: string | null;
    DelegateRecordID: string | null;
}
interface StoredVersion {
    ID: string;
    ArtifactID: string;
    VersionNumber: number;
    Name: string;
    ContentMode: string;
    Content: string | null;
    UserID: string;
}

const ENTITY_ID_MAP: Record<string, string> = {
    'MJ_BizApps_Collaboration: Space Types': 'E5000000-0000-4000-8000-000000000001',
    'MJ_BizApps_Collaboration: Spaces': 'E5000000-0000-4000-8000-000000000002',
    'MJ_BizApps_Collaboration: Space Members': 'E5000000-0000-4000-8000-000000000003',
    'MJ_BizApps_Collaboration: Space Anchors': 'E5000000-0000-4000-8000-000000000004',
    'MJ_BizApps_Collaboration: Space Grants': 'E5000000-0000-4000-8000-000000000005',
    'MJ_BizApps_Collaboration: Space Items': 'E5000000-0000-4000-8000-000000000006',
    'MJ_BizApps_Tasks: Tasks': 'E5000000-0000-4000-8000-000000000007',
    'MJ_BizApps_Tasks: Task Links': 'E5000000-0000-4000-8000-000000000008',
    'MJ: Artifacts': 'E5000000-0000-4000-8000-000000000009',
    'MJ: Actions': 'E5000000-0000-4000-8000-000000000010',
    'Core: Accounts': ANCHOR_ENTITY_ID,
    [SUBTYPE_ENTITY_NAME]: SUBTYPE_ENTITY_ID,
};

function okView<T>(rows: T[]): RunViewResult<T> {
    return {
        Success: true,
        Results: rows,
        UserViewRunID: '',
        RowCount: rows.length,
        TotalRowCount: rows.length,
        ExecutionTime: 1,
        ErrorMessage: '',
    };
}

function createWorldIntegrationProvider() {
    const spaces: StoredSpace[] = [];
    const members: StoredMember[] = [];
    const anchors: StoredAnchor[] = [];
    const chats: StoredChat[] = [];
    const tasks: StoredTask[] = [];
    const links: StoredLink[] = [];
    const decisions: Array<{ ID: string; TaskID: string; OutcomeID: string; DecidedByPersonID: string | null; DecisionNotes: string | null }> = [];
    const items: StoredItem[] = [];
    const artifacts: StoredArtifact[] = [];
    const versions: StoredVersion[] = [];
    const auditLogs: Array<{ status: string; details: string | null }> = [];
    const savedChatMessages: Array<{ ID: string; ConversationID: string; Message: string; UserID: string }> = [];
    const providerRefs: {
        entityProvider?: IEntityDataProvider;
        runViewProvider?: IRunViewProvider;
    } = {};
    let seq = 0;

    const nextUuid = (prefix: string): string => {
        seq += 1;
        return `${prefix}000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
    };

    const typeConfiguration = JSON.stringify({
        Chats: { WhoCanStart: 'Anyone', WhoCanWrite: 'Contributors', AgentReplyMode: 'Always', HistoryOnAdd: 'All' },
        Agents: { ListMode: 'Extend', EnableBoundActionGrants: true },
        DeliveryPrincipal: {
            UserID: DELIVERY_PRINCIPAL_ID,
            AllowedPrincipalUserIDs: [DELIVERY_PRINCIPAL_ID],
            AllowFallbackToCaller: false,
        },
        SpaceOverridable: ['DeliveryPrincipal'],
    });

    const entityByName = (name: string): EntityInfo | undefined => {
        const id = ENTITY_ID_MAP[name];
        if (!id) return undefined;
        if (name === SUBTYPE_ENTITY_NAME) {
            const info: Partial<EntityInfo> = {
                ID: SUBTYPE_ENTITY_ID,
                Name: SUBTYPE_ENTITY_NAME,
                ParentEntityFieldNames: new Set(['ID', 'Name', 'SpaceTypeID', 'OwnerID', 'ParentID', 'InheritsMembership']),
                PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier', IsPrimaryKey: true } as EntityInfo['PrimaryKeys'][number]],
                Fields: [
                    { Name: 'ID', IsPrimaryKey: true, IsVirtual: false, AllowUpdateAPI: true, Sequence: 1, TSType: EntityFieldTSType.String } as EntityInfo['Fields'][number],
                    { Name: 'AccountTier', IsPrimaryKey: false, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: true, Sequence: 2, TSType: EntityFieldTSType.String } as EntityInfo['Fields'][number],
                ],
            };
            return info as EntityInfo;
        }
        const info: Partial<EntityInfo> = {
            ID: id,
            Name: name,
            PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier', IsPrimaryKey: true } as EntityInfo['PrimaryKeys'][number]],
            Fields: [{ Name: 'ID', IsPrimaryKey: true } as EntityInfo['Fields'][number]],
        };
        return info as EntityInfo;
    };

    const getEntityObjectImpl = async <T extends BaseEntity>(
        entityName: string,
        contextUserOrKey?: UserInfo | CompositeKey,
        contextUserArg?: UserInfo,
    ): Promise<T> => {
        const effectiveUser = contextUserOrKey instanceof CompositeKey ? contextUserArg : contextUserOrKey;
        if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
            const obj = {
                ID: '',
                Name: '',
                SpaceTypeID: '',
                OwnerID: '',
                ParentID: null as string | null,
                InheritsMembership: false,
                Status: 'Active',
                Configuration: null as string | null,
                AgentRetrieval: 'Included' as const,
                ClosedAt: null as string | null,
                StatusID: null as string | null,
                LeafEntity: null as object | null,
                get ProviderToUse() {
                    return providerRefs.entityProvider;
                },
                get RunViewProviderToUse() {
                    return providerRefs.runViewProvider;
                },
                LatestResult: { CompleteMessage: '' },
                NewRecord() {
                    obj.ID = nextUuid('11');
                    return true;
                },
                async Load(id: string) {
                    const found = spaces.find((s) => s.ID.toLowerCase() === id.toLowerCase());
                    if (!found) return false;
                    Object.assign(obj, found);
                    return true;
                },
                async Save() {
                    const copy: StoredSpace = {
                        ID: obj.ID,
                        Name: obj.Name,
                        SpaceTypeID: obj.SpaceTypeID,
                        OwnerID: obj.OwnerID,
                        ParentID: obj.ParentID,
                        InheritsMembership: obj.InheritsMembership,
                        Status: obj.Status,
                        Configuration: obj.Configuration,
                    };
                    const existing = spaces.find((s) => s.ID === obj.ID);
                    if (existing) Object.assign(existing, copy);
                    else spaces.push(copy);
                    return true;
                },
                async EnsureISAChild() {
                    const leaf = {
                        EntityInfo: entityByName(SUBTYPE_ENTITY_NAME),
                        AccountTier: null as string | null,
                        LatestResult: { CompleteMessage: '' },
                        async Save() {
                            return obj.Save();
                        },
                    };
                    obj.LeafEntity = leaf;
                    return leaf as object as BaseEntity;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ_BizApps_Collaboration: Space Members') {
            const obj = {
                ID: '',
                SpaceID: '',
                UserID: '',
                SpaceRoleTypeID: '',
                Band: 'Team' as Band,
                Status: 'Active',
                LatestResult: { CompleteMessage: '' },
                NewRecord() {
                    obj.ID = nextUuid('22');
                    return true;
                },
                async Save() {
                    members.push({
                        ID: obj.ID,
                        SpaceID: obj.SpaceID,
                        UserID: obj.UserID,
                        SpaceRoleTypeID: obj.SpaceRoleTypeID,
                        Band: obj.Band,
                        Status: obj.Status,
                    });
                    return true;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ_BizApps_Collaboration: Space Anchors') {
            const obj = {
                ID: '',
                SpaceID: '',
                SpaceTypeID: '',
                EntityID: '',
                RecordID: '',
                Role: 'primary',
                IsPrimary: true,
                Sequence: 1,
                LatestResult: { CompleteMessage: '' },
                NewRecord() {
                    obj.ID = nextUuid('33');
                    return true;
                },
                async Save() {
                    if (
                        obj.IsPrimary &&
                        anchors.some(
                            (a) =>
                                a.IsPrimary &&
                                a.SpaceTypeID.toLowerCase() === obj.SpaceTypeID.toLowerCase() &&
                                a.EntityID.toLowerCase() === obj.EntityID.toLowerCase() &&
                                a.RecordID.toLowerCase() === obj.RecordID.toLowerCase(),
                        )
                    ) {
                        throw new Error("Violation of UNIQUE KEY constraint 'UQ_SpaceAnchor_PrimaryPerType' (2627).");
                    }
                    anchors.push({
                        ID: obj.ID,
                        SpaceID: obj.SpaceID,
                        SpaceTypeID: obj.SpaceTypeID,
                        EntityID: obj.EntityID,
                        RecordID: obj.RecordID,
                        Role: obj.Role,
                        IsPrimary: obj.IsPrimary,
                        Sequence: obj.Sequence,
                    });
                    return true;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ: Conversation Details') {
            const obj = {
                ID: USER_MSG_ID,
                ConversationID: CONV_GENERAL_ID,
                UserID: TEAM_USER_ID,
                Role: 'User',
                Status: 'Complete',
                Message: 'Draft summary using bound grant',
                ParentID: null as string | null,
                AgentID: null as string | null,
                HiddenToUser: false,
                IsPinned: false,
                OriginalMessageChanged: false,
                ExternalID: null as string | null,
                ProviderToUse: providerRefs.entityProvider,
                RunViewProviderToUse: providerRefs.runViewProvider,
                NewRecord() {
                    obj.ID = nextUuid('D1');
                    return true;
                },
                async Load(id: string) {
                    if (id.toLowerCase() !== USER_MSG_ID.toLowerCase()) return false;
                    obj.ID = USER_MSG_ID;
                    obj.UserID = TEAM_USER_ID;
                    return true;
                },
                async Save() {
                    savedChatMessages.push({
                        ID: obj.ID,
                        ConversationID: obj.ConversationID,
                        Message: obj.Message,
                        UserID: obj.UserID,
                    });
                    return true;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ: AI Agents') {
            const agentObj = {
                ID: AGENT_ID,
                Name: 'World Agent',
                async Load(id: string) {
                    return id.toLowerCase() === AGENT_ID.toLowerCase();
                },
            };
            return agentObj as object as T;
        }
        if (entityName === 'MJ: AI Agent Runs') {
            const runObj = {
                ID: nextUuid('88'),
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
        if (entityName === 'MJ: Artifacts') {
            const obj: StoredArtifact & {
                NewRecord: () => void;
                Load: (id: string) => Promise<boolean>;
                Save: () => Promise<boolean>;
                Delete: () => Promise<boolean>;
                ProviderToUse?: IEntityDataProvider;
                RunViewProviderToUse?: IRunViewProvider;
                LatestResult: { CompleteMessage: string };
            } = {
                ID: '',
                Name: '',
                TypeID: '',
                UserID: '',
                DelegateEntityID: null,
                DelegateRecordID: null,
                ProviderToUse: providerRefs.entityProvider,
                RunViewProviderToUse: providerRefs.runViewProvider,
                LatestResult: { CompleteMessage: '' },
                NewRecord() {
                    obj.ID = nextUuid('A1');
                },
                async Load(id: string) {
                    const found = artifacts.find((a) => a.ID.toLowerCase() === id.toLowerCase());
                    if (!found) return false;
                    Object.assign(obj, found);
                    return true;
                },
                async Save() {
                    const copy: StoredArtifact = {
                        ID: obj.ID,
                        Name: obj.Name,
                        TypeID: obj.TypeID,
                        UserID: obj.UserID,
                        DelegateEntityID: obj.DelegateEntityID,
                        DelegateRecordID: obj.DelegateRecordID,
                    };
                    const existing = artifacts.find((a) => a.ID === obj.ID);
                    if (existing) Object.assign(existing, copy);
                    else artifacts.push(copy);
                    return true;
                },
                async Delete() {
                    return true;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ: Artifact Versions') {
            const obj = {
                ID: '',
                ArtifactID: '',
                VersionNumber: 1,
                Name: '',
                ContentMode: 'Text',
                Content: null as string | null,
                UserID: '',
                LatestResult: { CompleteMessage: '' },
                NewRecord() {
                    obj.ID = nextUuid('77');
                },
                async Save() {
                    versions.push({
                        ID: obj.ID,
                        ArtifactID: obj.ArtifactID,
                        VersionNumber: obj.VersionNumber,
                        Name: obj.Name,
                        ContentMode: obj.ContentMode,
                        Content: obj.Content,
                        UserID: obj.UserID,
                    });
                    return true;
                },
                async Delete() {
                    return true;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ_BizApps_Collaboration: Space Items') {
            const obj = {
                ID: '',
                SpaceID: '',
                EntityID: '',
                RecordID: '',
                Band: 'Team' as Band,
                Folder: null as string | null,
                ArtifactVersionID: null as string | null,
                PromotedAt: null as Date | null,
                PromotedByUserID: null as string | null,
                ProviderToUse: providerImpl as object as IEntityDataProvider,
                RunViewProviderToUse: providerImpl as object as IRunViewProvider,
                LatestResult: { CompleteMessage: '' },
                NewRecord() {
                    obj.ID = nextUuid('66');
                },
                async Load(id: string) {
                    const found = items.find((i) => i.ID.toLowerCase() === id.toLowerCase());
                    if (!found) return false;
                    Object.assign(obj, found);
                    return true;
                },
                async Save() {
                    const existing = items.find((i) => i.ID === obj.ID);
                    if (obj.Band === 'Shared' && (!existing || existing.Band !== 'Shared')) {
                        obj.PromotedAt = new Date();
                        obj.PromotedByUserID = effectiveUser?.ID ?? null;
                    }
                    const copy: StoredItem = {
                        ID: obj.ID,
                        SpaceID: obj.SpaceID,
                        EntityID: obj.EntityID,
                        RecordID: obj.RecordID,
                        Band: obj.Band,
                        Folder: obj.Folder,
                        ArtifactVersionID: obj.ArtifactVersionID,
                        PromotedAt: obj.PromotedAt,
                        PromotedByUserID: obj.PromotedByUserID,
                    };
                    if (existing) Object.assign(existing, copy);
                    else items.push(copy);
                    return true;
                },
                async Delete() {
                    return true;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ_BizApps_Tasks: Tasks') {
            const obj = {
                ID: '',
                Name: '',
                Description: null as string | null,
                TypeID: '',
                Status: 'In Progress',
                Priority: 'Normal',
                ParentID: null as string | null,
                CreatedByPersonID: null as string | null,
                CompletedAt: null as Date | null,
                CompletionNotes: null as string | null,
                ProviderToUse: providerRefs.entityProvider,
                RunViewProviderToUse: providerRefs.runViewProvider,
                LatestResult: { CompleteMessage: '' },
                NewRecord() {
                    obj.ID = nextUuid('44');
                },
                async Load(id: string) {
                    const found = tasks.find((t) => t.ID.toLowerCase() === id.toLowerCase());
                    if (!found) return false;
                    Object.assign(obj, found);
                    return true;
                },
                async Save() {
                    const copy: StoredTask = {
                        ID: obj.ID,
                        Name: obj.Name,
                        Description: obj.Description,
                        TypeID: obj.TypeID,
                        Status: obj.Status,
                        Priority: obj.Priority,
                        ParentID: obj.ParentID,
                        CreatedByPersonID: obj.CreatedByPersonID,
                        CompletedAt: obj.CompletedAt,
                        CompletionNotes: obj.CompletionNotes,
                    };
                    const existing = tasks.find((t) => t.ID === obj.ID);
                    if (existing) Object.assign(existing, copy);
                    else tasks.push(copy);
                    return true;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ_BizApps_Tasks: Task Links') {
            const obj = {
                ID: '',
                TaskID: '',
                EntityID: '',
                RecordID: '',
                Description: null as string | null,
                NewRecord() {
                    obj.ID = nextUuid('55');
                },
                async Save() {
                    links.push({ ID: obj.ID, TaskID: obj.TaskID, EntityID: obj.EntityID, RecordID: obj.RecordID, Description: obj.Description });
                    return true;
                },
            };
            return obj as object as T;
        }
        if (entityName === 'MJ_BizApps_Tasks: Task Decisions') {
            const obj = {
                ID: '',
                TaskID: '',
                OutcomeID: '',
                DecidedByPersonID: null as string | null,
                DecisionNotes: null as string | null,
                NewRecord() {
                    obj.ID = nextUuid('E1');
                },
                async Save() {
                    decisions.push({ ID: obj.ID, TaskID: obj.TaskID, OutcomeID: obj.OutcomeID, DecidedByPersonID: obj.DecidedByPersonID, DecisionNotes: obj.DecisionNotes });
                    return true;
                },
            };
            return obj as object as T;
        }
        const base: Partial<BaseEntity> & {
            Load?: (id: string) => Promise<boolean>;
            NewRecord?: () => boolean;
            Save?: () => Promise<boolean>;
        } = {
            ProviderToUse: providerImpl as object as IEntityDataProvider,
            RunViewProviderToUse: providerImpl as object as IRunViewProvider,
            NewRecord() {
                return true;
            },
            async Save() {
                return true;
            },
            async Load() {
                return true;
            },
        };
        return base as T;
    };

    const runViewImpl = async <T>(params: RunViewParams): Promise<RunViewResult<T>> => {
        const filter = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : '';
        if (params.EntityName === 'MJ: Entities') {
            return okView([{ ID: ANCHOR_ENTITY_ID, Name: 'Core: Accounts' }] as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
            return okView([
                {
                    ID: SPACE_TYPE_ID,
                    Code: 'account-room',
                    Name: 'Account Room',
                    SpaceExtensionEntity: SUBTYPE_ENTITY_NAME,
                    ServerDriverClass: null,
                    Configuration: typeConfiguration,
                },
            ] as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Anchors') {
            const recMatch = filter.match(/\bRecordID\s*=\s*'([^']+)'/i);
            const spaceMatch = filter.match(/\bSpaceID\s*=\s*'([^']+)'/i);
            const matched = anchors.filter((a) => {
                if (recMatch && a.RecordID.toLowerCase() !== recMatch[1].toLowerCase()) return false;
                if (spaceMatch && a.SpaceID.toLowerCase() !== spaceMatch[1].toLowerCase()) return false;
                return true;
            });
            return okView(matched as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
            return okView(
                spaces.map((s) => ({
                    ...s,
                    AgentRetrieval: 'Included',
                    ClosedAt: null,
                    StatusID: null,
                })) as T[],
            );
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
            const userMatch = filter.match(/\bUserID\s*=\s*'([^']+)'/i);
            const matched = userMatch
                ? members.filter((m) => m.UserID.toLowerCase() === userMatch[1].toLowerCase())
                : members;
            return okView(matched as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
            return okView([
                { ID: ROLE_OWNER_ID, Code: 'Owner', Level: 100, MaxGrantableLevel: 100, IsOwnerRole: true, CanSeeTeamBand: true, CanContribute: true, CanCreateChildSpace: true, CanPromoteBand: true, CanInvite: true },
                { ID: ROLE_TEAM_ID, Code: 'Team', Level: 60, MaxGrantableLevel: 60, IsOwnerRole: false, CanSeeTeamBand: true, CanContribute: true, CanCreateChildSpace: true, CanPromoteBand: true, CanInvite: true },
                { ID: ROLE_SHARED_ID, Code: 'Shared', Level: 20, MaxGrantableLevel: 0, IsOwnerRole: false, CanSeeTeamBand: false, CanContribute: true, CanCreateChildSpace: false, CanPromoteBand: false, CanInvite: false },
                { ID: ROLE_VIEWER_ID, Code: 'Viewer', Level: 10, MaxGrantableLevel: 0, IsOwnerRole: false, CanSeeTeamBand: false, CanContribute: false, CanCreateChildSpace: false, CanPromoteBand: false, CanInvite: false },
            ] as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
            const matched = chats.filter((c) => {
                const convMatch = filter.match(/\bConversationID\s*=\s*'([^']+)'/i);
                const idMatch = filter.match(/\bID\s*=\s*'([^']+)'/i);
                if (convMatch && c.ConversationID.toLowerCase() !== convMatch[1].toLowerCase()) return false;
                if (idMatch && c.ID.toLowerCase() !== idMatch[1].toLowerCase()) return false;
                return true;
            });
            return okView(matched as T[]);
        }
        if (params.EntityName === 'MJ: Scoped Prompt Parts') {
            const rootId = spaces[0]?.ID ?? '';
            const rows = [
                {
                    ID: 'P-TYPE',
                    PromptID: PROMPT_ID,
                    PrimaryScopeEntityID: ENTITY_ID_MAP['MJ_BizApps_Collaboration: Space Types'],
                    PrimaryScopeRecordID: SPACE_TYPE_ID,
                    Name: 'TypePolicy',
                    Role: 'System',
                    Text: 'Follow subtyped room guardrails.',
                    Priority: 10,
                    Sort: 1,
                    MergeBehavior: 'Append',
                    Status: 'Active',
                },
                {
                    ID: 'P-ROOT',
                    PromptID: PROMPT_ID,
                    PrimaryScopeEntityID: ENTITY_ID_MAP['MJ_BizApps_Collaboration: Spaces'],
                    PrimaryScopeRecordID: rootId,
                    Name: 'RootContext',
                    Role: 'System',
                    Text: 'Respect per-root delivery principal rules.',
                    Priority: 20,
                    Sort: 2,
                    MergeBehavior: 'Append',
                    Status: 'Active',
                },
                {
                    ID: 'P-OTHER-SPACE',
                    PromptID: PROMPT_ID,
                    PrimaryScopeEntityID: ENTITY_ID_MAP['MJ_BizApps_Collaboration: Spaces'],
                    PrimaryScopeRecordID: OTHER_SPACE_ID,
                    Name: 'LeakedOtherSpace',
                    Role: 'System',
                    Text: 'MUST_NEVER_APPEAR',
                    Priority: 99,
                    Sort: 99,
                    MergeBehavior: 'Append',
                    Status: 'Active',
                },
                {
                    ID: 'P-OTHER-TYPE',
                    PromptID: PROMPT_ID,
                    PrimaryScopeEntityID: ENTITY_ID_MAP['MJ_BizApps_Collaboration: Space Types'],
                    PrimaryScopeRecordID: OTHER_TYPE_ID,
                    Name: 'LeakedOtherType',
                    Role: 'System',
                    Text: 'MUST_NEVER_APPEAR_TYPE',
                    Priority: 99,
                    Sort: 99,
                    MergeBehavior: 'Append',
                    Status: 'Active',
                },
            ];
            return okView(rows.filter((r) => filter.toLowerCase().includes(r.PrimaryScopeRecordID.toLowerCase())) as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Grants') {
            const rootId = spaces[0]?.ID ?? '';
            return okView([
                {
                    ID: GRANT_ID,
                    SpaceID: rootId,
                    SpaceTypeID: null,
                    Kind: 'Action',
                    Mode: 'Extend',
                    TargetEntityID: ENTITY_ID_MAP['MJ: Actions'],
                    TargetRecordID: GRANT_ACTION_ID,
                    Label: 'World Bound Action',
                    Band: 'Shared',
                    IsDefault: false,
                    Bindings: JSON.stringify({
                        SpaceID: { From: 'Space.ID' },
                        RootEntityID: { From: 'Root.EntityID' },
                        Band: { From: 'Space.Band' },
                    }),
                    Settings: null,
                    Sequence: 1,
                },
                {
                    ID: '99999999-9999-4999-8999-999999999903',
                    SpaceID: rootId,
                    SpaceTypeID: null,
                    Kind: 'Agent',
                    Mode: 'Extend',
                    TargetEntityID: 'E-AGENT',
                    TargetRecordID: AGENT_ID,
                    Label: 'World Agent',
                    Band: 'Shared',
                    IsDefault: true,
                    Bindings: null,
                    Settings: null,
                    Sequence: 1,
                },
            ] as T[]);
        }
        if (params.EntityName === 'MJ: Actions') {
            return okView([
                {
                    ID: GRANT_ACTION_ID,
                    Name: WORLD_BOUND_DRIVER,
                    Description: 'World bound integration action',
                    DriverClass: WORLD_BOUND_DRIVER,
                    Type: 'Custom',
                    Status: 'Active',
                },
            ] as T[]);
        }
        if (params.EntityName === 'MJ: Action Params') {
            return okView([
                { ActionID: GRANT_ACTION_ID, Name: 'SpaceID', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Hidden SpaceID', DefaultValue: null },
                { ActionID: GRANT_ACTION_ID, Name: 'RootEntityID', Type: 'Input', ValueType: 'Scalar', IsRequired: false, IsArray: false, Description: 'Hidden RootEntityID', DefaultValue: null },
                { ActionID: GRANT_ACTION_ID, Name: 'Band', Type: 'Input', ValueType: 'Scalar', IsRequired: false, IsArray: false, Description: 'Hidden Band', DefaultValue: null },
                { ActionID: GRANT_ACTION_ID, Name: 'Summary', Type: 'Input', ValueType: 'Scalar', IsRequired: true, IsArray: false, Description: 'Unbound summary text', DefaultValue: null },
            ] as T[]);
        }
        if (params.EntityName === 'MJ: AI Agents') {
            return okView([{ ID: AGENT_ID, Name: 'World Agent', Description: 'Test Agent', IsActive: true }] as T[]);
        }
        if (params.EntityName === 'MJ: Users') {
            const matched = filter.toLowerCase().includes(DELIVERY_PRINCIPAL_ID.toLowerCase())
                ? [{ ID: DELIVERY_PRINCIPAL_ID, Name: 'Account Delivery Principal', Email: 'delivery@example.com', Type: 'User', IsActive: true }]
                : [];
            return okView(matched as T[]);
        }
        if (params.EntityName === 'MJ: User Roles') {
            return okView([{ ID: 'UR1', UserID: DELIVERY_PRINCIPAL_ID, RoleID: ROLE_TEAM_ID, Role: 'Member' }] as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Tasks: Task Types') {
            return okView([{ ID: APPROVAL_TYPE_ID, Code: 'APPROVAL_REQUEST', Name: 'Approval Request' }] as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Tasks: Task Decision Outcomes') {
            return okView([
                { ID: OUTCOME_APPROVED_ID, Code: 'Approved', IsApproval: true },
                { ID: OUTCOME_REJECTED_ID, Code: 'Rejected', IsApproval: false },
            ] as T[]);
        }
        if (params.EntityName === 'MJ: Artifact Types') {
            return okView([{ ID: MARKDOWN_DOC_TYPE_ID, Name: 'Markdown Document' }] as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Tasks: Tasks') {
            const idMatch = filter.match(/\bID\s*=\s*'([^']+)'/i);
            const matched = idMatch ? tasks.filter((t) => t.ID.toLowerCase() === idMatch[1].toLowerCase()) : tasks;
            return okView(matched as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Tasks: Task Links') {
            const taskMatch = filter.match(/\bTaskID\s*=\s*'([^']+)'/i);
            const matched = taskMatch ? links.filter((l) => l.TaskID.toLowerCase() === taskMatch[1].toLowerCase()) : links;
            return okView(matched as T[]);
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
            const idMatch = filter.match(/\bID\s*=\s*'([^']+)'/i);
            const bandMatch = filter.match(/\bBand\s*=\s*'([^']+)'/i);
            const entityMatch = filter.match(/\bEntityID\s*=\s*'([^']+)'/i);
            const matched = items.filter((i) => {
                if (idMatch && i.ID.toLowerCase() !== idMatch[1].toLowerCase()) return false;
                if (bandMatch && i.Band !== bandMatch[1]) return false;
                if (entityMatch && i.EntityID.toLowerCase() !== entityMatch[1].toLowerCase()) return false;
                return true;
            });
            return okView(matched as T[]);
        }
        if (params.EntityName === 'MJ: Artifacts') {
            const matched = artifacts.filter((a) => filter.toLowerCase().includes(a.ID.toLowerCase()));
            return okView((matched.length > 0 ? matched : artifacts) as T[]);
        }
        if (params.EntityName === 'MJ: Artifact Versions') {
            return okView(versions as T[]);
        }
        return okView([]);
    };

    const providerImpl = {
        Entities: [] as EntityInfo[],
        CurrentUser: makeUser(OWNER_ID, 'Space Owner'),
        EntityByName: entityByName,
        EntityByID(id: string): EntityInfo | undefined {
            const entry = Object.entries(ENTITY_ID_MAP).find(([, eid]) => eid.toLowerCase() === id.toLowerCase());
            return entry ? entityByName(entry[0]) : undefined;
        },
        async BeginTransaction() {},
        async CommitTransaction() {},
        async RollbackTransaction() {},
        async CreateAuditLogRecord(_u: UserInfo, _a: string | null, _t: string, status: string, details: string | null) {
            auditLogs.push({ status, details });
            const r: Partial<BaseEntity> = {};
            return r as BaseEntity;
        },
        GetEntityObject: getEntityObjectImpl,
        RunView: runViewImpl,
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            return Promise.all(paramsList.map((p) => runViewImpl<T>(p)));
        },
    };
    providerRefs.entityProvider = providerImpl as object as IEntityDataProvider;
    providerRefs.runViewProvider = providerImpl as object as IRunViewProvider;

    return {
        provider: providerImpl as object as IMetadataProvider,
        spaces,
        members,
        anchors,
        chats,
        tasks,
        links,
        decisions,
        items,
        artifacts,
        auditLogs,
    };
}

describe('S9 Full World-Data-Model End-to-End Integration (Slice 1 + Slice 2)', () => {
    const origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
    const origSpaceTypeById = CollaborationEngine.Instance.SpaceTypeById.bind(CollaborationEngine.Instance);
    const origSpaceTypeByCode = CollaborationEngine.Instance.SpaceTypeByCode.bind(CollaborationEngine.Instance);
    const origUserMayAdministerSpaces = CollaborationEngine.Instance.UserMayAdministerSpaces.bind(CollaborationEngine.Instance);
    const origEnsureLoaded = CollaborationEngine.Instance.EnsureLoaded.bind(CollaborationEngine.Instance);
    const origEffectiveStatusForSpace = CollaborationEngine.Instance.EffectiveStatusForSpace.bind(CollaborationEngine.Instance);
    const origSpaceRoleTypeById = CollaborationEngine.Instance.SpaceRoleTypeById.bind(CollaborationEngine.Instance);
    const origRunAgent = AgentRunner.prototype.RunAgent;

    beforeEach(() => {
        LoadSpaceAudienceActions();
        LoadCollaborationSpaceItemArtifactPermissionDelegate();
        Object.defineProperty(CollaborationEngine.Instance, 'CollaborationSettings', {
            get: (): CollaborationSettings => DEFAULT_COLLABORATION_SETTINGS,
            configurable: true,
        });
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_ID, 'System', 'Owner');
        CollaborationEngine.Instance.UserMayAdministerSpaces = () => false;
        CollaborationEngine.Instance.EnsureLoaded = async () => undefined;
        CollaborationEngine.Instance.EffectiveStatusForSpace = () => undefined;
    });

    afterEach(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        CollaborationEngine.Instance.SpaceTypeById = origSpaceTypeById;
        CollaborationEngine.Instance.SpaceTypeByCode = origSpaceTypeByCode;
        CollaborationEngine.Instance.UserMayAdministerSpaces = origUserMayAdministerSpaces;
        CollaborationEngine.Instance.EnsureLoaded = origEnsureLoaded;
        CollaborationEngine.Instance.EffectiveStatusForSpace = origEffectiveStatusForSpace;
        CollaborationEngine.Instance.SpaceRoleTypeById = origSpaceRoleTypeById;
        AgentRunner.prototype.RunAgent = origRunAgent;
    });

    it('executes end-to-end S9 lifecycle: EnsureSpaceForRecord -> CS-3 chat writes -> CX-4 prompts -> CX-3 bound chat turn -> CA-1..CA-4 approval promotion -> CX-13 docs isolation', async () => {
        const harness = createWorldIntegrationProvider();
        const ownerUser = makeUser(OWNER_ID, 'Space Owner');
        const teamUser = makeUser(TEAM_USER_ID, 'Team Member');
        const sharedUser = makeUser(SHARED_USER_ID, 'Shared Participant');
        const outsiderUser = makeUser(OUTSIDER_ID, 'Outsider');
        const systemUser = makeUser(SYSTEM_ID, 'System', 'Owner');

        const accountRoomType = {
            ID: SPACE_TYPE_ID,
            Code: 'account-room',
            Name: 'Account Room',
            SpaceExtensionEntity: SUBTYPE_ENTITY_NAME,
            ServerDriverClass: null,
            Configuration: JSON.stringify({
                Chats: { WhoCanStart: 'Anyone', WhoCanWrite: 'Contributors', AgentReplyMode: 'Always', HistoryOnAdd: 'All' },
                Agents: { ListMode: 'Extend', EnableBoundActionGrants: true },
                DeliveryPrincipal: { UserID: DELIVERY_PRINCIPAL_ID, AllowedPrincipalUserIDs: [DELIVERY_PRINCIPAL_ID], AllowFallbackToCaller: false },
                SpaceOverridable: ['DeliveryPrincipal'],
            }),
        } as mjBizAppsCollaborationSpaceTypeEntity;

        CollaborationEngine.Instance.SpaceTypeById = (id) => (id?.toLowerCase() === SPACE_TYPE_ID.toLowerCase() ? accountRoomType : undefined);
        CollaborationEngine.Instance.SpaceTypeByCode = (code) => (code === 'account-room' ? accountRoomType : undefined);
        CollaborationEngine.Instance.SpaceRoleTypeById = (id) => {
            if (!id) return undefined;
            const norm = id.toLowerCase();
            if (norm === ROLE_OWNER_ID.toLowerCase()) {
                return { ID: ROLE_OWNER_ID, Code: 'Owner', Level: 100, MaxGrantableLevel: 100, IsOwnerRole: true, CanSeeTeamBand: true, CanContribute: true, CanPromoteBand: true, CanInvite: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (norm === ROLE_TEAM_ID.toLowerCase()) {
                return { ID: ROLE_TEAM_ID, Code: 'Team', Level: 60, MaxGrantableLevel: 60, IsOwnerRole: false, CanSeeTeamBand: true, CanContribute: true, CanPromoteBand: true, CanInvite: true } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (norm === ROLE_SHARED_ID.toLowerCase()) {
                return { ID: ROLE_SHARED_ID, Code: 'Shared', Level: 20, MaxGrantableLevel: 0, IsOwnerRole: false, CanSeeTeamBand: false, CanContribute: true, CanPromoteBand: false, CanInvite: false } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            if (norm === ROLE_VIEWER_ID.toLowerCase()) {
                return { ID: ROLE_VIEWER_ID, Code: 'Viewer', Level: 10, MaxGrantableLevel: 0, IsOwnerRole: false, CanSeeTeamBand: false, CanContribute: false, CanPromoteBand: false, CanInvite: false } as ReturnType<typeof origSpaceRoleTypeById>;
            }
            return undefined;
        };

        // 1. CX-1: Subtyped EnsureSpaceForRecord + idempotency
        const spaceFirst = await EnsureSpaceForRecord({
            typeCode: 'account-room',
            entityName: 'Core: Accounts',
            recordId: ANCHOR_RECORD_ID,
            spaceName: 'Acme Account Room',
            details: { AccountTier: 'Enterprise' },
            contextUser: ownerUser,
            provider: harness.provider,
        });
        const spaceSecond = await EnsureSpaceForRecord({
            typeCode: 'account-room',
            entityName: 'Core: Accounts',
            recordId: ANCHOR_RECORD_ID,
            contextUser: ownerUser,
            provider: harness.provider,
        });
        expect(spaceFirst.ID).toBe(spaceSecond.ID);
        expect(harness.spaces).toHaveLength(1);
        expect(harness.spaces[0].InheritsMembership).toBe(false);
        expect(harness.anchors).toHaveLength(1);

        // Add Team, Shared, DeliveryPrincipal, and chats
        harness.members.push(
            { ID: 'M-TEAM', SpaceID: spaceFirst.ID, UserID: TEAM_USER_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
            { ID: 'M-PRINCIPAL', SpaceID: spaceFirst.ID, UserID: DELIVERY_PRINCIPAL_ID, SpaceRoleTypeID: ROLE_TEAM_ID, Band: 'Team', Status: 'Active' },
            { ID: 'M-SHARED', SpaceID: spaceFirst.ID, UserID: SHARED_USER_ID, SpaceRoleTypeID: ROLE_SHARED_ID, Band: 'Shared', Status: 'Active' },
        );
        harness.chats.push(
            { ID: CHAT_GENERAL_ID, SpaceID: spaceFirst.ID, ConversationID: CONV_GENERAL_ID, Kind: 'General', Status: 'Active', CreatedByUserID: OWNER_ID, AllowedAgentsMode: 'Default', OwnerUserID: null },
            { ID: CHAT_TEAM_PRIVATE_ID, SpaceID: spaceFirst.ID, ConversationID: CONV_TEAM_PRIVATE_ID, Kind: 'Private', Status: 'Active', CreatedByUserID: OWNER_ID, AllowedAgentsMode: 'Default', OwnerUserID: null },
        );

        // 2. CS-3: Rule-based chat write check
        const sharedGeneralWrite = await CollaborationChatWritePermissionProvider.Instance.EvaluateWritePermission({
            Provider: harness.provider,
            ContextUser: sharedUser,
            Operation: 'create',
            ConversationID: CONV_GENERAL_ID,
            ConversationDetail: { UserID: SHARED_USER_ID, Role: 'User' },
        });
        expect(sharedGeneralWrite.Decision).toBe('Allow');

        const sharedPrivateWrite = await CollaborationChatWritePermissionProvider.Instance.EvaluateWritePermission({
            Provider: harness.provider,
            ContextUser: sharedUser,
            Operation: 'create',
            ConversationID: CONV_TEAM_PRIVATE_ID,
            ConversationDetail: { UserID: SHARED_USER_ID, Role: 'User' },
        });
        expect(sharedPrivateWrite.Decision).toBe('Deny');

        // 3. CX-4: Scoped prompt parts (SpaceType -> Root, zero cross-scope leakage)
        const promptResult = await resolveSpaceScopedPromptParts({
            provider: harness.provider,
            spaceId: spaceFirst.ID,
            promptId: PROMPT_ID,
        });
        const promptText = promptResult.parts.map((p) => p.Text).join('\n');
        expect(promptText).toContain('Follow subtyped room guardrails.');
        expect(promptText).toContain('Respect per-root delivery principal rules.');
        expect(promptText).not.toContain('MUST_NEVER_APPEAR');

        // 4. CX-3: Bound action grant resolution, turn execution, and anti-spoofing
        const loadedCfg = await loadSpaceConfiguration(harness.provider, spaceFirst.ID, { reader: systemUser });
        const resolvedGrants = await CollaborationBoundActionGrantRegistry.Instance.ResolveForTurn({
            provider: harness.provider,
            systemUser,
            spaceId: spaceFirst.ID,
            audience: 'Team',
            loadedConfiguration: loadedCfg,
            callerUser: teamUser,
        });
        const exposedActionParamNames = (resolvedGrants.exposures[0]?.ExposedParams ?? []).map((p) => p.Name);
        expect(exposedActionParamNames).toEqual(['Summary']);

        // Spoof attempt must reject deterministically & audit
        const spoofResult = await CollaborationBoundActionGrantRegistry.Instance.InvokeBoundAction({
            provider: harness.provider,
            callerUser: teamUser,
            spaceId: spaceFirst.ID,
            audience: 'Team',
            actionIdOrName: GRANT_ACTION_ID,
            callerArgs: { Summary: 'Attempted spoof', SpaceID: '99999999-9999-4999-8999-999999999999' },
            overridePolicy: 'Reject',
        });
        expect(spoofResult.Success).toBe(false);
        expect(spoofResult.ResultCode).toBe('SERVER_BOUND_SCOPE_SPOOFING');
        expect(harness.auditLogs.some((a) => (a.details ?? '').includes('SERVER_BOUND_SCOPE_SPOOFING'))).toBe(true);

        // Clean server-injected invocation
        const cleanResult = await CollaborationBoundActionGrantRegistry.Instance.InvokeBoundAction({
            provider: harness.provider,
            callerUser: teamUser,
            spaceId: spaceFirst.ID,
            audience: 'Team',
            actionIdOrName: GRANT_ACTION_ID,
            callerArgs: { Summary: 'Clean server-bound update' },
        });
        expect(cleanResult.Success).toBe(true);

        let capturedRunnerParams: ExecuteAgentParams | null = null;
        AgentRunner.prototype.RunAgent = async (params: ExecuteAgentParams): Promise<ExecuteAgentResult> => {
            capturedRunnerParams = params;
            if (params.onAgentRunCreated) {
                await params.onAgentRunCreated('99990000-0000-4000-8000-000000000001');
            }
            const runStub: Partial<MJAIAgentRunEntityExtended> = {
                ID: '99990000-0000-4000-8000-000000000001',
                Message: 'Completed world turn cleanly.',
                Status: 'Completed',
            };
            return {
                success: true,
                agentRun: runStub as MJAIAgentRunEntityExtended,
                payload: { message: 'Completed world turn cleanly.' },
            };
        };

        const turnRes = await executeSpaceChatTurn(harness.provider, teamUser, {
            spaceId: spaceFirst.ID,
            conversationId: CONV_GENERAL_ID,
            userMessageId: USER_MSG_ID,
            enableBoundActionGrants: true,
        });
        expect(turnRes).toMatchObject({ ok: true });
        const runnerParams = capturedRunnerParams as ExecuteAgentParams | null;
        expect(runnerParams?.boundActionParams?.[GRANT_ACTION_ID]?.SpaceID).toBe(spaceFirst.ID);

        // 5. CA-1..CA-4: Propose Team draft -> verify Shared privacy -> Approve via delivery principal -> verify Shared visibility
        const principalOutcome = await resolvePerRootDeliveryPrincipal({
            provider: harness.provider,
            systemUser,
            spaceId: spaceFirst.ID,
        });
        expect(principalOutcome.ok).toBe(true);
        if (principalOutcome.ok) expect(principalOutcome.principalUserId).toBe(DELIVERY_PRINCIPAL_ID);

        const proposeAction = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(
            BaseAction,
            PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION,
        );
        expect(proposeAction).toBeTruthy();
        if (!proposeAction) return;
        expect(proposeAction.SupportsAudience).toBe(true);

        const proposalRes = await proposeAction.Run({
            Action: { ID: 'A1', Name: PROPOSE_SPACE_AUDIENCE_OUTPUT_ACTION } as RunActionParams['Action'],
            ContextUser: teamUser,
            Provider: harness.provider,
            Filters: [],
            ServerBoundScopeParams: { SpaceID: spaceFirst.ID, DeliveryPrincipalID: DELIVERY_PRINCIPAL_ID, Band: 'Team' },
            Params: [
                { Name: 'SpaceID', Type: 'Input', Value: spaceFirst.ID, Bound: true },
                { Name: 'Title', Type: 'Input', Value: 'Q1 Executive Summary' },
                { Name: 'Content', Type: 'Input', Value: '# Internal Draft for Review' },
                { Name: 'Folder', Type: 'Input', Value: '/shared-ready' },
            ],
        });
        expect(proposalRes).toMatchObject({ Success: true });

        // Prior to approval: Shared participant is denied approval task enumeration & sees 0 docs (CA-3 fail-closed)
        const sharedTasksBefore = await listSpaceApprovalTasks({
            provider: harness.provider,
            callerUser: sharedUser,
            spaceId: spaceFirst.ID,
        });
        expect(sharedTasksBefore.ok).toBe(false);
        if (!sharedTasksBefore.ok) expect(sharedTasksBefore.code).toBe('PRIVACY_DENIED');

        const sharedDocsBefore = await listSpaceDocs({
            provider: harness.provider,
            callerUser: sharedUser,
            spaceId: spaceFirst.ID,
        });
        expect(sharedDocsBefore.ok).toBe(true);
        if (sharedDocsBefore.ok) expect(sharedDocsBefore.data).toHaveLength(0);

        const createdTaskId = harness.tasks[0].ID;
        const hiddenTaskGet = await getSpaceApprovalTask({
            provider: harness.provider,
            callerUser: sharedUser,
            spaceId: spaceFirst.ID,
            taskId: createdTaskId,
        });
        expect(hiddenTaskGet.ok).toBe(false);

        // Promote via CA-1 PromoteSpaceDraftToSharedAction under owner/approver -> attributed to DELIVERY_PRINCIPAL_ID
        const promoteAction = MJGlobal.Instance.ClassFactory.CreateInstance<BaseAction>(
            BaseAction,
            PROMOTE_SPACE_DRAFT_TO_SHARED_ACTION,
        );
        expect(promoteAction).toBeTruthy();
        if (!promoteAction) return;

        const promoteRes = await promoteAction.Run({
            Action: { ID: 'A2', Name: PROMOTE_SPACE_DRAFT_TO_SHARED_ACTION } as RunActionParams['Action'],
            ContextUser: ownerUser,
            Provider: harness.provider,
            Filters: [],
            ServerBoundScopeParams: { SpaceID: spaceFirst.ID, DeliveryPrincipalID: DELIVERY_PRINCIPAL_ID, Band: 'Team' },
            Params: [
                { Name: 'SpaceID', Type: 'Input', Value: spaceFirst.ID, Bound: true },
                { Name: 'TaskID', Type: 'Input', Value: createdTaskId },
                { Name: 'Decision', Type: 'Input', Value: 'Approved' },
                { Name: 'DecisionNotes', Type: 'Input', Value: 'Approved for customer release' },
            ],
        });
        expect(promoteRes).toMatchObject({ Success: true });
        expect(harness.items[0].Band).toBe('Shared');
        expect(harness.items[0].PromotedByUserID).toBe(DELIVERY_PRINCIPAL_ID);
        expect(harness.items[0].PromotedByUserID).not.toBe(OWNER_ID);

        // 6. CX-13: Create an unpromoted Team-only doc alongside the promoted Shared doc -> Shared sees ONLY Shared
        const privateDoc = await createSpaceDoc({
            provider: harness.provider,
            callerUser: teamUser,
            spaceId: spaceFirst.ID,
            title: 'Private Team Margin Sheet',
            content: '# Strictly Internal Team Doc',
            band: 'Team',
        });
        expect(privateDoc.ok).toBe(true);

        const sharedDocsAfter = await listSpaceDocs({
            provider: harness.provider,
            callerUser: sharedUser,
            spaceId: spaceFirst.ID,
        });
        expect(sharedDocsAfter.ok).toBe(true);
        if (sharedDocsAfter.ok) {
            expect(sharedDocsAfter.data).toHaveLength(1);
            expect(sharedDocsAfter.data[0].title).toBe('Q1 Executive Summary');
            expect(sharedDocsAfter.data[0].band).toBe('Shared');
        }

        // Delegate check on unpromoted Team doc vs promoted Shared doc
        const delegate = MJGlobal.Instance.ClassFactory.CreateInstance<BaseArtifactPermissionDelegate>(
            BaseArtifactPermissionDelegate,
            'MJ_BizApps_Collaboration: Space Items',
        );
        expect(delegate).toBeInstanceOf(CollaborationSpaceItemArtifactPermissionDelegate);

        if (delegate && privateDoc.ok) {
            const privateCtx: ArtifactDelegateContext = {
                Provider: harness.provider,
                DelegateEntityID: ENTITY_ID_MAP['MJ_BizApps_Collaboration: Space Items'],
                DelegateRecordID: privateDoc.data.spaceItemId,
                ArtifactID: privateDoc.data.artifactId,
                ArtifactOwnerUserID: privateDoc.data.authorUserId,
                DelegateEntityName: 'MJ_BizApps_Collaboration: Space Items',
            };
            expect(await delegate.CanRead(privateCtx, teamUser)).toBe('Allow');
            expect(await delegate.CanRead(privateCtx, sharedUser)).toBe('Deny');
            expect(await delegate.CanRead(privateCtx, outsiderUser)).toBe('Deny');
        }

        const sharedGetAttempt = privateDoc.ok
            ? await getSpaceDoc({ provider: harness.provider, callerUser: sharedUser, spaceId: spaceFirst.ID, spaceItemId: privateDoc.data.spaceItemId })
            : null;
        expect(sharedGetAttempt?.ok).toBe(false);

        // Also exercise direct decideAndPromoteSpaceDraft guard against non-Team approver
        const unauthorizedDecision = await decideAndPromoteSpaceDraft({
            provider: harness.provider,
            approverUser: sharedUser,
            spaceId: spaceFirst.ID,
            taskId: createdTaskId,
            decision: 'Rejected',
        });
        expect(unauthorizedDecision.ok).toBe(false);
    });
});
