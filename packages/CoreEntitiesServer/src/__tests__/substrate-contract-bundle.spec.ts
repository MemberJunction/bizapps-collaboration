import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    EntityFieldTSType,
    WellKnownUserSource,
    type BaseEntity,
    type EntityFieldInfo,
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import {
    assertSubstrateContractPassed,
    registerCollaborationSubstrateContractTests,
    runCollaborationSubstrateContractTests,
    type CollaborationSubstrateContract,
    type SubstrateContractTestContext,
} from '@mj-biz-apps/collaboration-core';
import type {
    mjBizAppsCollaborationSpaceAnchorEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceRoleTypeEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    CollaborationEngine,
    createCollaborationServerSubstrate,
} from '../../dist/index.js';

const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
const OWNER_ROLE_ID = 'B2000001-0000-4000-8000-000000000001';
const TEAM_CONTRIBUTOR_ROLE_ID = 'B2000001-0000-4000-8000-000000000004';
const CONTRIBUTOR_ROLE_ID = 'B2000001-0000-4000-8000-000000000002';
const VIEWER_ROLE_ID = 'B2000001-0000-4000-8000-000000000003';
const ANCHOR_ENTITY_ID = 'D2000001-0000-4000-8000-000000000001';
const SPACE_TYPES_ENTITY_ID = 'D2000001-0000-4000-8000-000000000002';
const SPACES_ENTITY_ID = 'D2000001-0000-4000-8000-000000000003';

function makeUser(id: string, name: string, type: 'User' | 'Owner' = 'User'): UserInfo {
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: name,
        Email: `${name.toLowerCase()}@example.com`,
        Type: type,
        IsActive: true,
    };
    return partial as UserInfo;
}

function makeField(partial: Partial<EntityFieldInfo>): EntityFieldInfo {
    return partial as EntityFieldInfo;
}

function asFilterString(extraFilter: RunViewParams['ExtraFilter']): string {
    return typeof extraFilter === 'string' ? extraFilter : String(extraFilter ?? '');
}

function extractEq(filter: string, col: string): string | null {
    const m = filter.match(new RegExp(`${col}\\s*=\\s*'([^']+)'`, 'i'));
    return m ? m[1].toLowerCase() : null;
}

function extractInIds(filter: string, col: string): string[] {
    const m = filter.match(new RegExp(`${col}\\s+IN\\s*\\(([^)]+)\\)`, 'i'));
    if (!m) return [];
    return [...m[1].matchAll(/'([^']+)'/g)].map((g) => g[1].toLowerCase());
}

function buildContractServerSubstrate(context: SubstrateContractTestContext): CollaborationSubstrateContract {
    const { ids } = context;

    CollaborationEngine.Instance.SpaceTypeById = (id: string | null | undefined) => {
        const lower = id?.toLowerCase();
        if (lower === ids.subtypedTypeId.toLowerCase()) {
            const t: Partial<mjBizAppsCollaborationSpaceTypeEntity> = {
                ID: ids.subtypedTypeId,
                Code: ids.subtypedTypeCode,
                Name: 'Contract Subtyped',
                SpaceExtensionEntity: ids.subtypeEntityName,
                ServerDriverClass: null,
                Configuration: JSON.stringify({ Chats: { WhoCanWrite: 'Contributors' } }),
            };
            return t as mjBizAppsCollaborationSpaceTypeEntity;
        }
        if (lower === ids.plainTypeId.toLowerCase()) {
            const t: Partial<mjBizAppsCollaborationSpaceTypeEntity> = {
                ID: ids.plainTypeId,
                Code: ids.plainTypeCode,
                Name: 'Contract Plain',
                SpaceExtensionEntity: null,
                ServerDriverClass: null,
                Configuration: JSON.stringify({ Chats: { WhoCanWrite: 'Contributors' } }),
            };
            return t as mjBizAppsCollaborationSpaceTypeEntity;
        }
        return undefined;
    };

    const users = new Map<string, UserInfo>([
        [ids.ownerUserId, makeUser(ids.ownerUserId, 'Owner')],
        [ids.teamContributorUserId, makeUser(ids.teamContributorUserId, 'TeamContributor')],
        [ids.sharedContributorUserId, makeUser(ids.sharedContributorUserId, 'SharedContributor')],
        [ids.guestReadOnlyUserId, makeUser(ids.guestReadOnlyUserId, 'GuestViewer')],
        [ids.outsiderUserId, makeUser(ids.outsiderUserId, 'Outsider')],
    ]);

    const spaces = [
        {
            ID: ids.openGeneralSpaceId,
            Name: 'Open General',
            ParentID: null as string | null,
            InheritsMembership: false,
            OwnerID: ids.ownerUserId,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            SpaceTypeID: ids.subtypedTypeId,
            Configuration: null as string | null,
        },
        {
            ID: ids.sealedChildSpaceId,
            Name: 'Sealed Child',
            ParentID: ids.openGeneralSpaceId,
            InheritsMembership: false,
            OwnerID: ids.ownerUserId,
            AgentRetrieval: 'Included',
            AllowParentAssignees: false,
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            SpaceTypeID: ids.subtypedTypeId,
            Configuration: null as string | null,
        },
        {
            ID: ids.privateChatSpaceId,
            Name: 'Private Space',
            ParentID: null as string | null,
            InheritsMembership: false,
            OwnerID: ids.ownerUserId,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            SpaceTypeID: ids.subtypedTypeId,
            Configuration: null as string | null,
        },
        {
            ID: ids.assistantChatSpaceId,
            Name: 'Assistant Space',
            ParentID: null as string | null,
            InheritsMembership: false,
            OwnerID: ids.ownerUserId,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            SpaceTypeID: ids.subtypedTypeId,
            Configuration: null as string | null,
        },
        {
            ID: ids.closedSpaceId,
            Name: 'Closed Space',
            ParentID: null as string | null,
            InheritsMembership: false,
            OwnerID: ids.ownerUserId,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: '2026-01-01T00:00:00Z',
            StatusID: null as string | null,
            SpaceTypeID: ids.subtypedTypeId,
            Configuration: null as string | null,
        },
        {
            ID: ids.ownersOnlyPolicySpaceId,
            Name: 'Owners Only Policy Space',
            ParentID: null as string | null,
            InheritsMembership: false,
            OwnerID: ids.ownerUserId,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            SpaceTypeID: ids.subtypedTypeId,
            Configuration: JSON.stringify({ Chats: { WhoCanWrite: 'Owners' } }),
        },
        {
            ID: ids.rootSpaceAId,
            Name: 'Root A',
            ParentID: null as string | null,
            InheritsMembership: false,
            OwnerID: ids.ownerUserId,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            SpaceTypeID: ids.subtypedTypeId,
            Configuration: null as string | null,
        },
        {
            ID: ids.childSpaceAId,
            Name: 'Child A',
            ParentID: ids.rootSpaceAId,
            InheritsMembership: true,
            OwnerID: ids.ownerUserId,
            AgentRetrieval: 'Included',
            AllowParentAssignees: true,
            ClosedAt: null as string | null,
            StatusID: null as string | null,
            SpaceTypeID: ids.subtypedTypeId,
            Configuration: null as string | null,
        },
    ];

    const seedSeatSpaces = [ids.openGeneralSpaceId, ids.privateChatSpaceId, ids.assistantChatSpaceId, ids.closedSpaceId, ids.ownersOnlyPolicySpaceId];
    const members: Array<{
        ID: string;
        SpaceID: string;
        UserID: string;
        SpaceRoleTypeID: string;
        Band: 'Team' | 'Shared';
        Status: 'Active';
    }> = [];
    let seatCounter = 0;
    for (const sId of seedSeatSpaces) {
        members.push(
            { ID: `m-${++seatCounter}`, SpaceID: sId, UserID: ids.ownerUserId, SpaceRoleTypeID: OWNER_ROLE_ID, Band: 'Team', Status: 'Active' },
            { ID: `m-${++seatCounter}`, SpaceID: sId, UserID: ids.teamContributorUserId, SpaceRoleTypeID: TEAM_CONTRIBUTOR_ROLE_ID, Band: 'Team', Status: 'Active' },
            { ID: `m-${++seatCounter}`, SpaceID: sId, UserID: ids.sharedContributorUserId, SpaceRoleTypeID: CONTRIBUTOR_ROLE_ID, Band: 'Shared', Status: 'Active' },
            { ID: `m-${++seatCounter}`, SpaceID: sId, UserID: ids.guestReadOnlyUserId, SpaceRoleTypeID: VIEWER_ROLE_ID, Band: 'Shared', Status: 'Active' },
        );
    }

    const roles = [
        { ID: OWNER_ROLE_ID, Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
        { ID: TEAM_CONTRIBUTOR_ROLE_ID, Level: 30, MaxGrantableLevel: 20, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: true, IsOwnerRole: false, CanContribute: true },
        { ID: CONTRIBUTOR_ROLE_ID, Level: 20, MaxGrantableLevel: 20, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true },
        { ID: VIEWER_ROLE_ID, Level: 10, MaxGrantableLevel: 0, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: false },
    ];

    const chats = [
        { ID: 'ch-1', SpaceID: ids.openGeneralSpaceId, ConversationID: ids.openGeneralConversationId, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'ch-2', SpaceID: ids.sealedChildSpaceId, ConversationID: ids.sealedChildConversationId, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'ch-3', SpaceID: ids.privateChatSpaceId, ConversationID: ids.privateChatConversationId, Kind: 'Private', Status: 'Active', OwnerUserID: ids.ownerUserId },
        { ID: 'ch-4', SpaceID: ids.assistantChatSpaceId, ConversationID: ids.assistantChatConversationId, Kind: 'Assistant', Status: 'Active', OwnerUserID: ids.ownerUserId },
        { ID: 'ch-5', SpaceID: ids.closedSpaceId, ConversationID: ids.closedSpaceConversationId, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'ch-6', SpaceID: ids.ownersOnlyPolicySpaceId, ConversationID: ids.ownersOnlyPolicyConversationId, Kind: 'General', Status: 'Active', OwnerUserID: null },
        { ID: 'ch-7', SpaceID: ids.openGeneralSpaceId, ConversationID: ids.unknownKindConversationId, Kind: 'UnknownKind', Status: 'Active', OwnerUserID: null },
    ];

    const anchors: Array<{
        ID: string;
        SpaceID: string;
        SpaceTypeID: string;
        EntityID: string;
        RecordID: string;
        Role: string;
        IsPrimary: boolean;
        Sequence: number;
    }> = [];

    const anchorEntityInfo: Partial<EntityInfo> = {
        ID: ANCHOR_ENTITY_ID,
        Name: ids.anchorEntityName,
        Fields: [
            makeField({ Name: 'ID', IsPrimaryKey: true, Type: 'uniqueidentifier', AllowUpdateAPI: true, Sequence: 1, TSType: EntityFieldTSType.String }),
        ],
        PrimaryKeys: [
            makeField({ Name: 'ID', IsPrimaryKey: true, Type: 'uniqueidentifier', AllowUpdateAPI: true, Sequence: 1, TSType: EntityFieldTSType.String }),
        ],
    };

    const subtypeEntityInfo: Partial<EntityInfo> = {
        ID: 'D2000001-0000-4000-8000-000000000009',
        Name: ids.subtypeEntityName,
        Fields: [
            makeField({ Name: 'ID', IsPrimaryKey: true, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: false, DefaultValue: '', Sequence: 1, TSType: EntityFieldTSType.String }),
        ],
        PrimaryKeys: [],
        ParentEntityFieldNames: new Set(['ID', 'Name']),
    };

    let idSeq = 0;
    let concurrentBarrierRemaining = 8;
    const concurrentWaiters: Array<() => void> = [];
    const nextId = (prefix: string) => {
        idSeq += 1;
        return `${prefix}00001-0000-4000-8000-${idSeq.toString(16).padStart(12, '0')}`;
    };

    const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
        EntityByID(id: string): EntityInfo | undefined {
            return id.toLowerCase() === ANCHOR_ENTITY_ID.toLowerCase()
                ? (anchorEntityInfo as EntityInfo)
                : undefined;
        },
        EntityByName(name: string): EntityInfo | undefined {
            if (name === 'MJ_BizApps_Collaboration: Space Types') {
                return { ID: SPACE_TYPES_ENTITY_ID, Name: name } as EntityInfo;
            }
            if (name === 'MJ_BizApps_Collaboration: Spaces') {
                return { ID: SPACES_ENTITY_ID, Name: name } as EntityInfo;
            }
            return undefined;
        },
        async GetEntityObject<T>(entityName: string): Promise<T> {
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                let currentTypeId = '';
                const s: Partial<mjBizAppsCollaborationSpaceEntity> & {
                    NewRecord: () => boolean;
                    Load: (id: string) => Promise<boolean>;
                    Save: () => Promise<boolean>;
                    Delete: () => Promise<boolean>;
                    EnsureISAChild: () => Promise<BaseEntity | null>;
                    LeafEntity?: BaseEntity;
                } = {
                    ID: '',
                    Name: '',
                    SpaceTypeID: '',
                    OwnerID: '',
                    ParentID: null,
                    InheritsMembership: false,
                    NewRecord() {
                        this.ID = nextId('F4');
                        return true;
                    },
                    async Load(id: string): Promise<boolean> {
                        const found = spaces.find((row) => row.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        this.ID = found.ID;
                        this.Name = found.Name;
                        this.SpaceTypeID = found.SpaceTypeID;
                        this.OwnerID = found.OwnerID;
                        this.ParentID = found.ParentID;
                        this.InheritsMembership = found.InheritsMembership;
                        currentTypeId = found.SpaceTypeID;
                        return true;
                    },
                    async Save(): Promise<boolean> {
                        currentTypeId = s.SpaceTypeID ?? currentTypeId;
                        if (!spaces.some((row) => row.ID === s.ID)) {
                            spaces.push({
                                ID: s.ID ?? nextId('F4'),
                                Name: s.Name ?? '',
                                ParentID: s.ParentID ?? null,
                                InheritsMembership: Boolean(s.InheritsMembership),
                                OwnerID: s.OwnerID ?? ids.ownerUserId,
                                AgentRetrieval: 'Included',
                                AllowParentAssignees: true,
                                ClosedAt: null,
                                StatusID: null,
                                SpaceTypeID: s.SpaceTypeID ?? ids.plainTypeId,
                                Configuration: null,
                            });
                        }
                        return true;
                    },
                    async Delete(): Promise<boolean> {
                        const idx = spaces.findIndex((row) => row.ID === s.ID);
                        if (idx >= 0) spaces.splice(idx, 1);
                        return true;
                    },
                    async EnsureISAChild(): Promise<BaseEntity | null> {
                        if ((s.SpaceTypeID ?? currentTypeId).toLowerCase() !== ids.subtypedTypeId.toLowerCase()) {
                            return null;
                        }
                        const leafObj = {
                            EntityInfo: subtypeEntityInfo as EntityInfo,
                            LatestResult: { CompleteMessage: '' },
                            async Save(): Promise<boolean> {
                                return s.Save();
                            },
                        };
                        const typedLeaf = leafObj as Partial<BaseEntity> as BaseEntity;
                        s.LeafEntity = typedLeaf;
                        return typedLeaf;
                    },
                };
                s.LeafEntity = s as Partial<BaseEntity> as BaseEntity;
                return s as Partial<BaseEntity> as T;
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Members') {
                const m = {
                    ID: '',
                    SpaceID: '',
                    UserID: '',
                    SpaceRoleTypeID: '',
                    Band: 'Team' as 'Team' | 'Shared',
                    Status: 'Active' as 'Active',
                    LatestResult: { CompleteMessage: '' },
                    NewRecord(): boolean {
                        this.ID = nextId('F5');
                        return true;
                    },
                    async Save(): Promise<boolean> {
                        members.push({
                            ID: m.ID || nextId('F5'),
                            SpaceID: m.SpaceID,
                            UserID: m.UserID,
                            SpaceRoleTypeID: m.SpaceRoleTypeID,
                            Band: m.Band,
                            Status: 'Active',
                        });
                        return true;
                    },
                    async Delete(): Promise<boolean> {
                        const idx = members.findIndex((row) => row.ID === m.ID);
                        if (idx >= 0) members.splice(idx, 1);
                        return true;
                    },
                };
                return m as Partial<mjBizAppsCollaborationSpaceMemberEntity> as T;
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Anchors') {
                const a = {
                    ID: '',
                    SpaceID: '',
                    SpaceTypeID: '',
                    EntityID: '',
                    RecordID: '',
                    Role: 'primary',
                    IsPrimary: true,
                    Sequence: 0,
                    LatestResult: { CompleteMessage: '' },
                    NewRecord(): boolean {
                        this.ID = nextId('F6');
                        return true;
                    },
                    async Save(): Promise<boolean> {
                        const conflict = anchors.find(
                            (existing) =>
                                existing.IsPrimary &&
                                existing.SpaceTypeID.toLowerCase() === a.SpaceTypeID.toLowerCase() &&
                                existing.EntityID.toLowerCase() === a.EntityID.toLowerCase() &&
                                existing.RecordID.toLowerCase() === a.RecordID.toLowerCase(),
                        );
                        if (conflict) {
                            throw new Error('Duplicate UQ_SpaceAnchor_PrimaryPerType violation (SQL 2627)');
                        }
                        anchors.push({
                            ID: a.ID || nextId('F6'),
                            SpaceID: a.SpaceID,
                            SpaceTypeID: a.SpaceTypeID,
                            EntityID: a.EntityID,
                            RecordID: a.RecordID,
                            Role: a.Role,
                            IsPrimary: Boolean(a.IsPrimary),
                            Sequence: a.Sequence,
                        });
                        return true;
                    },
                };
                return a as Partial<mjBizAppsCollaborationSpaceAnchorEntity> as T;
            }
            throw new Error(`Unexpected entity lookup: ${entityName}`);
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            const filter = asFilterString(params.ExtraFilter);
            const ok = (rows: T[]): RunViewResult<T> => ({
                Success: true,
                Results: rows,
                UserViewRunID: '',
                RowCount: rows.length,
                TotalRowCount: rows.length,
                ExecutionTime: 0,
                ErrorMessage: '',
            });
            if (params.EntityName === 'MJ: Entities') {
                const n = extractEq(filter, 'Name');
                return ok(n === ids.anchorEntityName.toLowerCase() ? ([{ ID: ANCHOR_ENTITY_ID }] as T[]) : []);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                const code = extractEq(filter, 'Code');
                const id = extractEq(filter, 'ID');
                if (code === ids.subtypedTypeCode.toLowerCase() || id === ids.subtypedTypeId.toLowerCase()) {
                    return ok([
                        {
                            ID: ids.subtypedTypeId,
                            Code: ids.subtypedTypeCode,
                            Name: 'Contract Subtyped',
                            SpaceExtensionEntity: ids.subtypeEntityName,
                            ServerDriverClass: null,
                            Configuration: JSON.stringify({ Chats: { WhoCanWrite: 'Contributors' } }),
                        },
                    ] as T[]);
                }
                if (code === ids.plainTypeCode.toLowerCase() || id === ids.plainTypeId.toLowerCase()) {
                    return ok([
                        {
                            ID: ids.plainTypeId,
                            Code: ids.plainTypeCode,
                            Name: 'Contract Plain',
                            SpaceExtensionEntity: null,
                            ServerDriverClass: null,
                            Configuration: JSON.stringify({ Chats: { WhoCanWrite: 'Contributors' } }),
                        },
                    ] as T[]);
                }
                return ok([]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                if (filter.includes("Code = 'owner'")) {
                    return ok([{ ID: OWNER_ROLE_ID }] as T[]);
                }
                const roleIds = extractInIds(filter, 'ID');
                return ok(roles.filter((r) => roleIds.includes(r.ID.toLowerCase())) as T[]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Anchors') {
                const recId = extractEq(filter, 'RecordID');
                if (recId === ids.concurrentRecordId.toLowerCase() && concurrentBarrierRemaining > 0 && filter.includes('IsPrimary = 1')) {
                    concurrentBarrierRemaining -= 1;
                    if (concurrentBarrierRemaining === 0) {
                        for (const resolve of concurrentWaiters.splice(0)) resolve();
                    } else {
                        await new Promise<void>((resolve) => {
                            concurrentWaiters.push(resolve);
                        });
                    }
                }
                const stId = extractEq(filter, 'SpaceTypeID');
                return ok(
                    anchors
                        .filter(
                            (a) =>
                                a.IsPrimary &&
                                a.SpaceTypeID.toLowerCase() === stId &&
                                a.RecordID.toLowerCase() === recId,
                        )
                        .map((a) => ({ SpaceID: a.SpaceID })) as T[],
                );
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                const convId = extractEq(filter, 'ConversationID');
                return ok(chats.filter((c) => c.ConversationID.toLowerCase() === convId) as T[]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                const spaceId = extractEq(filter, 'ID');
                return ok(spaces.filter((s) => s.ID.toLowerCase() === spaceId) as T[]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                const spaceIds = extractInIds(filter, 'SpaceID');
                const userId = extractEq(filter, 'UserID');
                return ok(
                    members.filter(
                        (m) => spaceIds.includes(m.SpaceID.toLowerCase()) && m.UserID.toLowerCase() === userId,
                    ) as T[],
                );
            }
            return ok([]);
        },
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            return Promise.all(paramsList.map((p) => this.RunView!<T>(p)));
        },
    };

    return createCollaborationServerSubstrate({
        provider: providerObj as IMetadataProvider,
        resolveUser: (userId) => users.get(userId),
        systemUser: makeUser(SYSTEM_ID, 'System', 'Owner'),
    });
}

describe('CX-10 Substrate Contract Bundle against Collaboration Server Adapter', () => {
    let heldSystem: typeof WellKnownUserSource.Instance.GetSystemUser;
    let heldIsSystem: typeof WellKnownUserSource.Instance.IsSystemUser;
    const engine = CollaborationEngine.Instance;
    let heldEnsureLoaded: typeof engine.EnsureLoaded;
    let heldTypeById: typeof engine.SpaceTypeById;
    let heldRoleByCode: typeof engine.SpaceRoleTypeByCode;
    let heldStatusReach: typeof engine.StatusReachForSpace;
    let heldSettingsDesc: PropertyDescriptor | undefined;

    before(() => {
        heldSystem = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        heldIsSystem = WellKnownUserSource.Instance.IsSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_ID, 'System', 'Owner');
        WellKnownUserSource.Instance.IsSystemUser = (u: UserInfo) => u.ID === SYSTEM_ID;

        heldEnsureLoaded = engine.EnsureLoaded.bind(engine);
        heldTypeById = engine.SpaceTypeById.bind(engine);
        heldRoleByCode = engine.SpaceRoleTypeByCode.bind(engine);
        heldStatusReach = engine.StatusReachForSpace.bind(engine);
        heldSettingsDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(engine), 'CollaborationSettings');

        engine.EnsureLoaded = async () => undefined;
        engine.StatusReachForSpace = (row) => ({
            ReadOnly: Boolean(row.ClosedAt),
            Visible: true,
            AgentRetrieval: true,
        });
        engine.SpaceRoleTypeByCode = (code: string | null | undefined) => {
            if (code === 'owner') {
                const r: Partial<mjBizAppsCollaborationSpaceRoleTypeEntity> = { ID: OWNER_ROLE_ID, Code: 'owner' };
                return r as mjBizAppsCollaborationSpaceRoleTypeEntity;
            }
            return undefined;
        };
        Object.defineProperty(engine, 'CollaborationSettings', {
            configurable: true,
            get: () => ({}),
        });
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = heldSystem;
        WellKnownUserSource.Instance.IsSystemUser = heldIsSystem;
        engine.EnsureLoaded = heldEnsureLoaded;
        engine.SpaceTypeById = heldTypeById;
        engine.SpaceRoleTypeByCode = heldRoleByCode;
        engine.StatusReachForSpace = heldStatusReach;
        if (heldSettingsDesc) {
            Object.defineProperty(engine, 'CollaborationSettings', heldSettingsDesc);
        }
    });

    it('passes runCollaborationSubstrateContractTests and assertSubstrateContractPassed end-to-end', async () => {
        const report = await runCollaborationSubstrateContractTests((ctx) => buildContractServerSubstrate(ctx));
        assertSubstrateContractPassed(report);
        assert.equal(report.failedScenarios, 0);
        assert.equal(report.passedScenarios, report.totalScenarios);
    });

    registerCollaborationSubstrateContractTests(describe, it, (ctx) => buildContractServerSubstrate(ctx));
});
