import { describe, it, expect, beforeEach } from 'vitest';
import {
    AuthorizationInfo,
    BaseEntity,
    BaseRemotableOperation,
    CompositeKey,
    type DatasetItemFilterType,
    type DatasetResultType,
    EntityFieldInfo,
    EntityInfo,
    EntityPermissionInfo,
    type EntityTransactionScope,
    type IMetadataProvider,
    RowLevelSecurityFilterInfo,
    type RunQueryParams,
    type RunQueryResult,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
    UserRoleInfo,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    BaseHealthProbe,
    BaseLiveCrudVerifier,
    COLLABORATION_BOOT_ENTITY_REGISTRY,
    COLLABORATION_POLYMORPHIC_FK_SPECS,
    COLLABORATION_ROOT_AUTHORIZATION_NAME,
    COLLABORATION_SCHEMA_NAME,
    CollaborationEngine,
    CollaborationPersonaSecurityProbe,
    CollaborationPersonaSecurityVerifier,
    DISCLOSURE_SURFACES,
    type DisclosureSurface,
    LoadCollaborationSecurityAuditOperations,
    PARTICIPANT_ROLE_ID,
    PERSONA_SECURITY_PROBE_KEY,
    PERSONA_SECURITY_PROBE_OPERATION_KEY,
    PERSONA_SECURITY_VERIFIER_KEY,
    type PersonaSecurityProbeInput,
    PersonaSecurityProbeOperation,
    type PersonaSecurityProbeResult,
    type ProbeDatabaseProvider,
    type ProbeRowRecord,
} from '@mj-biz-apps/collaboration-core-entities-server';
import { LoadCollaborationIntegrationTests } from '../index.js';

const ROLE_UI_ID = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E';
const ROLE_DEVELOPER_ID = 'E1AFCCEC-6A37-EF11-86D4-000D3A4E707E';
const USER_DEV_ID = 'D2000001-0000-4000-8000-000000000013';
const USER_ADA_ID = 'D2000001-0000-4000-8000-000000000001';
const USER_BEA_ID = 'D2000001-0000-4000-8000-000000000004';
const FILTER_READ_ID = 'F1000001-0000-4000-8000-000000000001';
const FILTER_CAT_ID = 'F1000001-0000-4000-8000-000000000002';
const FILTER_SHELL_ID = 'F1000001-0000-4000-8000-000000000003';
const FILTER_WRITE_ID = 'F1000001-0000-4000-8000-000000000004';

function makeIntegrationUser(id: string, roleId: string, type: 'User' | 'Owner' = 'User'): UserInfo {
    const role = new UserRoleInfo({ UserID: id, RoleID: roleId });
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: 'Integration Probe User',
        Email: 'probe@example.com',
        Type: type,
        IsActive: true,
        UserRoles: [role],
    };
    return partial as UserInfo;
}

function createIntegrationMetadataBase(): IMetadataProvider & {
    RunView: <T>(params: RunViewParams, contextUser?: UserInfo) => Promise<RunViewResult<T>>;
} {
    const rootAuth = new AuthorizationInfo();
    rootAuth.ID = '1AB4325C-EBD6-44D3-BA0D-2916DCD3320E';
    rootAuth.Name = COLLABORATION_ROOT_AUTHORIZATION_NAME;
    rootAuth.IsActive = true;

    const adminAuth = new AuthorizationInfo();
    adminAuth.ID = 'F22C7B81-D6F8-4439-A4EB-F4C88FC1C9F1';
    adminAuth.Name = 'Administer Spaces';
    adminAuth.ParentID = rootAuth.ID;
    adminAuth.IsActive = true;
    Object.defineProperty(adminAuth, 'UserCanExecute', {
        value: (u: UserInfo) =>
            u?.UserRoles?.some(
                (r) =>
                    r.RoleID?.toLowerCase() === ROLE_DEVELOPER_ID.toLowerCase() ||
                    r.RoleID?.toLowerCase() === ROLE_UI_ID.toLowerCase(),
            ) ?? false,
    });

    const polyByEntity = new Map<string, Array<{ payload: string; disc: string }>>();
    for (const spec of COLLABORATION_POLYMORPHIC_FK_SPECS) {
        const list = polyByEntity.get(spec.EntityName.toLowerCase()) ?? [];
        list.push({ payload: spec.PayloadFieldName, disc: spec.EntityIDFieldName });
        polyByEntity.set(spec.EntityName.toLowerCase(), list);
    }

    const entities: EntityInfo[] = COLLABORATION_BOOT_ENTITY_REGISTRY.map((spec, idx) => {
        const entityId = `E0000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`;
        const entity = new EntityInfo();
        entity.ID = entityId;
        entity.Name = spec.EntityName;
        entity.SchemaName = spec.EntityName.startsWith('MJ_BizApps_Collaboration:') ? COLLABORATION_SCHEMA_NAME : '__mj';
        entity.AllowAllRowsAPI = false;

        const fields: EntityFieldInfo[] = [new EntityFieldInfo({ Name: 'ID', IsPrimaryKey: true })];
        for (const p of polyByEntity.get(spec.EntityName.toLowerCase()) ?? []) {
            fields.push(new EntityFieldInfo({ Name: p.disc }));
            fields.push(new EntityFieldInfo({ Name: p.payload, EntityIDFieldName: p.disc }));
        }
        Object.defineProperty(entity, 'Fields', { value: fields, writable: true, configurable: true });

        const perms: EntityPermissionInfo[] = [];
        if (spec.PolicyKind !== 'staff-only-denied') {
            perms.push(
                new EntityPermissionInfo({
                    EntityID: entityId,
                    RoleID: PARTICIPANT_ROLE_ID,
                    Type: 'Allow',
                    CanRead: true,
                    ReadRLSFilterID:
                        spec.PolicyKind === 'shell-deny-all'
                            ? FILTER_SHELL_ID
                            : spec.PolicyKind === 'active-catalog'
                              ? FILTER_CAT_ID
                              : FILTER_READ_ID,
                    ...(spec.PolicyKind === 'reach-scoped' && spec.RequireWriteRlsWhenWritable
                        ? {
                              CanCreate: true,
                              CanUpdate: true,
                              CreateRLSFilterID: FILTER_WRITE_ID,
                              UpdateRLSFilterID: FILTER_WRITE_ID,
                          }
                        : {}),
                }),
            );
        }
        Object.defineProperty(entity, 'Permissions', { value: perms, writable: true, configurable: true });
        return entity;
    });

    entities.push(
        new EntityInfo({ ID: 'E9990001-0000-4000-8000-000000000001', Name: 'MJ: Queries', SchemaName: '__mj' }),
        new EntityInfo({ ID: 'E9990001-0000-4000-8000-000000000002', Name: 'MJ: Datasets', SchemaName: '__mj' }),
        new EntityInfo({ ID: 'E9990001-0000-4000-8000-000000000003', Name: 'MJ: Reports', SchemaName: '__mj' }),
    );

    const filters: Array<Pick<RowLevelSecurityFilterInfo, 'ID' | 'Name' | 'FilterText'>> = [
        { ID: FILTER_READ_ID, Name: 'Read', FilterText: "(SpaceID IN (SELECT SpaceID FROM [__mj_BizAppsCollaboration].[fnCollaborationAccess](TRY_CAST('{{UserID}}' AS UNIQUEIDENTIFIER))))" },
        { ID: FILTER_CAT_ID, Name: 'Catalog', FilterText: '(IsActive = 1)' },
        { ID: FILTER_SHELL_ID, Name: 'Shell', FilterText: '(1 = 0)' },
        { ID: FILTER_WRITE_ID, Name: 'Write', FilterText: "(UserID = TRY_CAST('{{UserID}}' AS UNIQUEIDENTIFIER))" },
    ];

    const base: Partial<IMetadataProvider> & {
        RunView: <T>(params: RunViewParams) => Promise<RunViewResult<T>>;
    } = {
        Entities: entities,
        Authorizations: [rootAuth, adminAuth],
        AuthorizationRoles: [],
        EntityByName: (name: string) => entities.find((e) => e.Name.toLowerCase() === name.toLowerCase()),
        EntityByID: (id: string) => entities.find((e) => e.ID.toLowerCase() === id.toLowerCase()),
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            if (params.EntityName === 'MJ: Row Level Security Filters') {
                return { Success: true, Results: filters as T[], RowCount: filters.length, TotalRowCount: filters.length, ExecutionTime: 1, ErrorMessage: '' };
            }
            return { Success: true, Results: [] as T[], RowCount: 0, TotalRowCount: 0, ExecutionTime: 1, ErrorMessage: '' };
        },
    };
    return base as IMetadataProvider & {
        RunView: <T>(params: RunViewParams, contextUser?: UserInfo) => Promise<RunViewResult<T>>;
    };
}

function createIntegrationProbeProvider(leakSurface?: DisclosureSurface): {
    Provider: ProbeDatabaseProvider;
    GetRollbacks: () => number;
    GetCommits: () => number;
    GetResidualNotes: () => number;
} {
    const base = createIntegrationMetadataBase();
    const committedNotes = new Map<string, ProbeRowRecord>();
    let txNotes = new Map<string, ProbeRowRecord>();
    let txActive = false;
    let rollbacks = 0;
    let commits = 0;

    const provider: ProbeDatabaseProvider = Object.assign(Object.create(base), {
        get Entities() {
            return base.Entities;
        },
        get Authorizations() {
            return base.Authorizations;
        },
        get AuthorizationRoles() {
            return base.AuthorizationRoles;
        },
        EntityByName: (name: string) => base.EntityByName(name),
        EntityByID: (id: string) => base.EntityByID(id),
        async BeginEntityTransaction(): Promise<EntityTransactionScope> {
            txActive = true;
            txNotes = new Map(committedNotes);
            return {
                IsNested: false,
                async Commit(): Promise<void> {
                    commits += 1;
                    txActive = false;
                },
                async Rollback(): Promise<void> {
                    rollbacks += 1;
                    txNotes.clear();
                    txActive = false;
                },
            };
        },
        async GetEntityObject<T extends BaseEntity = BaseEntity>(entityName: string, contextUser?: UserInfo): Promise<T> {
            let id = '';
            let spaceId = '';
            const stub = {
                get ID() {
                    return id;
                },
                set ID(v: string) {
                    id = v;
                },
                set SpaceID(v: string) {
                    spaceId = v;
                },
                get PrimaryKeys() {
                    return [{ Name: 'ID', Value: id }];
                },
                get PrimaryKey() {
                    return id ? CompositeKey.FromID(id) : new CompositeKey();
                },
                NewRecord() {
                    id = 'E9990001-0000-4000-8000-000000000001';
                },
                async Save(): Promise<boolean> {
                    if (entityName === 'MJ_BizApps_Collaboration: Space Notes') {
                        const target = txActive ? txNotes : committedNotes;
                        target.set(id.toLowerCase(), { ID: id, SpaceID: spaceId });
                    }
                    return true;
                },
                async InnerLoad(key: CompositeKey): Promise<boolean> {
                    const targetId = String(key.KeyValuePairs?.[0]?.Value ?? '').toLowerCase();
                    const isParticipant = (contextUser?.UserRoles ?? []).some(
                        (r) => r.RoleID.toLowerCase() === PARTICIPANT_ROLE_ID.toLowerCase(),
                    );
                    if (leakSurface === 'direct-id-resolver' && isParticipant && entityName === 'MJ_BizApps_Collaboration: Space Notes') {
                        id = targetId;
                        return true;
                    }
                    return false;
                },
            };
            const proxyEntity: BaseEntity = Object.defineProperties(
                Object.create(null),
                Object.getOwnPropertyDescriptors(stub),
            );
            return proxyEntity as T;
        },
        async RunView<T>(params: RunViewParams, contextUser?: UserInfo): Promise<RunViewResult<T>> {
            if (params.EntityName === 'MJ: Queries') {
                return {
                    Success: true,
                    Results: [{ ID: 'Q1000001-0000-4000-8000-000000000001', Name: 'Collaboration Home Counts' }] as T[],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (params.EntityName === 'MJ: Datasets') {
                return {
                    Success: true,
                    Results: [{ ID: 'DS100001-0000-4000-8000-000000000001', Name: 'Collaboration_Bootstrap' }] as T[],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (params.EntityName === 'MJ: Reports') {
                return {
                    Success: true,
                    Results: [
                        {
                            ID: 'R1000001-0000-4000-8000-000000000001',
                            Name: 'Collaboration Activity Report',
                            QueryID: 'Q1000001-0000-4000-8000-000000000001',
                        },
                    ] as T[],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (
                leakSurface === 'all-views' &&
                params.EntityName === 'MJ_BizApps_Collaboration: Space Notes' &&
                contextUser?.ID.toLowerCase() !== USER_DEV_ID.toLowerCase()
            ) {
                const leakedNotes = [...(txActive ? txNotes : committedNotes).values()];
                return {
                    Success: true,
                    Results: (leakedNotes.length > 0 ? leakedNotes : [{ ID: 'F8B0B005-0000-4000-8000-000000000000', SpaceID: 'F8B0B002-0000-4000-8000-000000000000' }]) as T[],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            return base.RunView<T>(params, contextUser);
        },
        async RunQuery(params: RunQueryParams, contextUser?: UserInfo): Promise<RunQueryResult> {
            if (leakSurface === 'run-query' && contextUser?.ID.toLowerCase() !== USER_DEV_ID.toLowerCase()) {
                return {
                    QueryID: params.QueryID ?? 'Q1',
                    QueryName: params.QueryName ?? 'Collaboration Home Counts',
                    Success: true,
                    Results: [...(txActive ? txNotes : committedNotes).values()],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            return {
                QueryID: params.QueryID ?? 'Q1',
                QueryName: params.QueryName ?? 'Collaboration Home Counts',
                Success: false,
                Results: [],
                RowCount: 0,
                TotalRowCount: 0,
                ExecutionTime: 1,
                ErrorMessage: 'Permission denied',
            };
        },
        async GetDatasetByName(
            datasetName: string,
            _filters: DatasetItemFilterType[] | undefined,
            contextUser?: UserInfo,
        ): Promise<DatasetResultType> {
            if (leakSurface === 'dataset' && contextUser?.ID.toLowerCase() !== USER_DEV_ID.toLowerCase()) {
                return {
                    DatasetID: 'DS1',
                    DatasetName: datasetName,
                    Success: true,
                    Status: 'Success',
                    LatestUpdateDate: new Date(),
                    Results: [
                        {
                            Code: 'notes',
                            EntityName: 'MJ_BizApps_Collaboration: Space Notes',
                            EntityID: base.EntityByName('MJ_BizApps_Collaboration: Space Notes')?.ID ?? 'E1',
                            LatestUpdateDate: new Date(),
                            Results: [...(txActive ? txNotes : committedNotes).values()],
                        },
                    ],
                };
            }
            return {
                DatasetID: 'DS1',
                DatasetName: datasetName,
                Success: true,
                Status: 'Success',
                LatestUpdateDate: new Date(),
                Results: [],
            };
        },
        async Load() {
            return {};
        },
    });

    return {
        Provider: provider,
        GetRollbacks: () => rollbacks,
        GetCommits: () => commits,
        GetResidualNotes: () => committedNotes.size,
    };
}

describe('IntegrationTests: XS-3 Transactional Persona Security Probe', () => {
    const devAdmin = makeIntegrationUser(USER_DEV_ID, ROLE_DEVELOPER_ID, 'Owner');
    const adaStaff = makeIntegrationUser(USER_ADA_ID, ROLE_UI_ID, 'User');
    const beaParticipant = makeIntegrationUser(USER_BEA_ID, PARTICIPANT_ROLE_ID, 'User');

    beforeEach(() => {
        LoadCollaborationIntegrationTests();
        LoadCollaborationSecurityAuditOperations();
    });

    it('retains probe, verifier, and BaseRemotableOperation registrations through IntegrationTests & CoreEntitiesServer startup', () => {
        const probe = MJGlobal.Instance.ClassFactory.CreateInstance<BaseHealthProbe>(
            BaseHealthProbe,
            PERSONA_SECURITY_PROBE_KEY,
        );
        const verifier = MJGlobal.Instance.ClassFactory.CreateInstance<BaseLiveCrudVerifier>(
            BaseLiveCrudVerifier,
            PERSONA_SECURITY_VERIFIER_KEY,
        );
        const op = MJGlobal.Instance.ClassFactory.CreateInstance<
            BaseRemotableOperation<PersonaSecurityProbeInput, PersonaSecurityProbeResult>
        >(BaseRemotableOperation, PERSONA_SECURITY_PROBE_OPERATION_KEY);

        expect(probe).toBeInstanceOf(CollaborationPersonaSecurityProbe);
        expect(verifier).toBeInstanceOf(CollaborationPersonaSecurityVerifier);
        expect(op).toBeInstanceOf(PersonaSecurityProbeOperation);
    });

    it('runs end-to-end across CollaborationEngine and BaseRemotableOperation with unconditional rollback and catches all 5 leak vectors', async () => {
        const cleanHarness = createIntegrationProbeProvider();
        const cleanResult = await CollaborationEngine.Instance.RunPersonaSecurityProbe(
            {
                ReportExecutor: async () => ({ Success: true, Rows: [] }),
                DirectIdResolverHook: async () => null,
            },
            adaStaff,
            cleanHarness.Provider,
        );

        expect(cleanResult.Passed).toBe(true);
        expect(cleanResult.Stats.RolledBack).toBe(true);
        expect(cleanResult.Stats.ResidualCheckPassed).toBe(true);
        expect(cleanResult.Stats.EntitiesSwept).toBe(
            COLLABORATION_BOOT_ENTITY_REGISTRY.filter((e) => e.PolicyKind !== 'active-catalog').length * 2,
        );
        expect(cleanHarness.GetRollbacks()).toBe(1);
        expect(cleanHarness.GetCommits()).toBe(0);
        expect(cleanHarness.GetResidualNotes()).toBe(0);

        for (const surface of DISCLOSURE_SURFACES) {
            const leakHarness = createIntegrationProbeProvider(surface);
            const op = MJGlobal.Instance.ClassFactory.CreateInstance<
                BaseRemotableOperation<PersonaSecurityProbeInput, PersonaSecurityProbeResult>
            >(BaseRemotableOperation, PERSONA_SECURITY_PROBE_OPERATION_KEY);

            const opResult = await op!.ExecuteServer(
                {
                    ReportExecutor: async ({ PersonaKind }) => {
                        if (surface === 'report' && PersonaKind === 'external-participant') {
                            return {
                                Success: true,
                                EntityName: 'MJ_BizApps_Collaboration: Space Notes',
                                Rows: [{ ID: 'F8B0B005-0000-4000-8000-000000000000', SpaceID: 'F8B0B002-0000-4000-8000-000000000000' }],
                            };
                        }
                        return { Success: true, Rows: [] };
                    },
                    ...(surface === 'report'
                        ? {
                              FixtureMode: 'world-provided',
                              WorldFixtures: {
                                  SpaceAID: 'C1000001-0000-4000-8000-000000000002',
                                  SpaceBID: 'F8B0B002-0000-4000-8000-000000000000',
                                  ExternalParticipantUser: beaParticipant,
                                  RestrictedStaffUser: adaStaff,
                                  OutOfSpaceRecords: [
                                      {
                                          EntityName: 'MJ_BizApps_Collaboration: Space Notes',
                                          RecordIDs: ['F8B0B005-0000-4000-8000-000000000000'],
                                      },
                                  ],
                              },
                          }
                        : {}),
                },
                { provider: leakHarness.Provider, user: devAdmin, emitProgress: () => {} },
            );

            expect(opResult.Success).toBe(true);
            expect(
                opResult.Output?.Passed,
                `Expected failure on surface='${surface}', stats=${JSON.stringify(opResult.Output?.Stats)}, findings=${JSON.stringify(opResult.Output?.Findings)}`,
            ).toBe(false);
            expect(opResult.Output?.Findings.some((f) => f.Surface === surface)).toBe(true);
            expect(leakHarness.GetRollbacks()).toBe(1);
            expect(leakHarness.GetCommits()).toBe(0);
            expect(leakHarness.GetResidualNotes()).toBe(0);
        }
    });
});
