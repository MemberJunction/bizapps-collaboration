import { describe, it, expect, beforeEach } from 'vitest';
import {
    BaseEntity,
    BaseRemotableOperation,
    CompositeKey,
    type DatasetItemFilterType,
    type DatasetResultType,
    EntityInfo,
    type EntityTransactionScope,
    type IMetadataProvider,
    type RunQueryParams,
    type RunQueryResult,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import {
    BaseHealthProbe,
    BaseLiveCrudVerifier,
    COLLABORATION_BOOT_ENTITY_REGISTRY,
    CollaborationAdminEngineBase,
    CollaborationPersonaSecurityProbe,
    CollaborationPersonaSecurityVerifier,
    DISCLOSURE_SURFACES,
    type DisclosureSurface,
    HealthProbeRollbackError,
    LoadCollaborationSecurityAuditOperations,
    PARTICIPANT_ROLE_ID,
    PERSONA_SECURITY_PROBE_KEY,
    PERSONA_SECURITY_PROBE_OPERATION_KEY,
    PERSONA_SECURITY_VERIFIER_KEY,
    type PersonaSecurityProbeInput,
    PersonaSecurityProbeOperation,
    type PersonaSecurityProbeResult,
    type ProbeDatabaseProvider,
    type ProbeDatasetTarget,
    type ProbeQueryTarget,
    type ProbeReportTarget,
    type ProbeRowRecord,
    runPersonaSecurityProbe,
} from '../index.js';
import {
    buildCompliantWorldFixture,
    createWorldAuditProvider,
    makeUserInfo,
    ROLE_DEVELOPER_ID,
    ROLE_UI_ID,
    SPACE_TYPE_PROJECT_ID,
    USER_ADA_ID,
    USER_BEA_ID,
    USER_DEV_ID,
} from './audit-test-fixtures.js';

interface LeakInjectionConfig {
    LeakOnSurface?: DisclosureSurface;
    LeakPersona?: 'external-participant' | 'restricted-staff';
    LeakEntityName?: string;
    ForceRollbackFailure?: boolean;
}

interface TransactionalStoreHarness {
    Provider: ProbeDatabaseProvider;
    GetBeginCount: () => number;
    GetCommitCount: () => number;
    GetRollbackCount: () => number;
    GetPersistedSpacesCount: () => number;
    GetPersistedMembersCount: () => number;
    GetPersistedNotesCount: () => number;
    GetAllCapturedSurfaceCalls: () => string[];
    SetLeakConfig: (cfg: LeakInjectionConfig) => void;
    SpaceTypeId: string;
}

function createTransactionalProbeHarness(initialLeak: LeakInjectionConfig = {}): TransactionalStoreHarness {
    const world = buildCompliantWorldFixture('mssql');
    const baseProvider = createWorldAuditProvider(world);
    const extraMetaEntities: EntityInfo[] = [
        new EntityInfo({ ID: 'E9990001-0000-4000-8000-000000000001', Name: 'MJ: Queries', SchemaName: '__mj' }),
        new EntityInfo({ ID: 'E9990001-0000-4000-8000-000000000002', Name: 'MJ: Datasets', SchemaName: '__mj' }),
        new EntityInfo({ ID: 'E9990001-0000-4000-8000-000000000003', Name: 'MJ: Reports', SchemaName: '__mj' }),
    ];
    for (const metaEntity of extraMetaEntities) {
        if (!world.Entities.some((e) => e.Name === metaEntity.Name)) {
            world.Entities.push(metaEntity);
        }
    }
    let leakConfig: LeakInjectionConfig = { ...initialLeak };

    // Committed tables (seeded with Space Type + Space Role Types + Reports/Queries/Datasets)
    const committedSpaces = new Map<string, ProbeRowRecord>();
    const committedMembers = new Map<string, ProbeRowRecord>();
    const committedNotes = new Map<string, ProbeRowRecord>();
    const committedUsers = new Map<string, ProbeRowRecord>();
    const committedUserRoles = new Map<string, ProbeRowRecord>();

    // Active transaction overlay buffers (discarded on Rollback)
    let txActive = false;
    let txSpaces = new Map<string, ProbeRowRecord>();
    let txMembers = new Map<string, ProbeRowRecord>();
    let txNotes = new Map<string, ProbeRowRecord>();
    let txUsers = new Map<string, ProbeRowRecord>();
    let txUserRoles = new Map<string, ProbeRowRecord>();

    let beginCount = 0;
    let commitCount = 0;
    let rollbackCount = 0;
    const capturedCalls: string[] = [];
    let syntheticIdSeq = 100;

    const currentMap = (committed: Map<string, ProbeRowRecord>, tx: Map<string, ProbeRowRecord>): Map<string, ProbeRowRecord> =>
        txActive ? tx : committed;

    const isSpaceAccessibleToUser = (spaceId: string | null | undefined, user: UserInfo | undefined): boolean => {
        if (!user) return false;
        if (user.ID.toLowerCase() === USER_DEV_ID.toLowerCase()) return true;
        if (!spaceId) return false;
        const targetSpace = spaceId.toLowerCase();
        for (const m of currentMap(committedMembers, txMembers).values()) {
            const mUser = typeof m.UserID === 'string' ? m.UserID.toLowerCase() : '';
            const mSpace = typeof m.SpaceID === 'string' ? m.SpaceID.toLowerCase() : '';
            if (mUser === user.ID.toLowerCase() && mSpace === targetSpace) {
                return true;
            }
        }
        return false;
    };

    const pickOutOfSpaceSample = (): { spaceId: string; noteId: string; memberId: string } => {
        const spaces = [...currentMap(committedSpaces, txSpaces).values()];
        const spaceB = spaces.find((s) => typeof s.Name === 'string' && s.Name.includes('Space B')) ?? spaces[spaces.length - 1];
        const spaceBId = typeof spaceB?.ID === 'string' ? spaceB.ID : 'F8B0B002-0000-4000-8000-000000000002';
        const noteB = [...currentMap(committedNotes, txNotes).values()].find(
            (n) => typeof n.SpaceID === 'string' && n.SpaceID.toLowerCase() === spaceBId.toLowerCase(),
        );
        const memberB = [...currentMap(committedMembers, txMembers).values()].find(
            (m) => typeof m.SpaceID === 'string' && m.SpaceID.toLowerCase() === spaceBId.toLowerCase(),
        );
        return {
            spaceId: spaceBId,
            noteId: typeof noteB?.ID === 'string' ? noteB.ID : spaceBId,
            memberId: typeof memberB?.ID === 'string' ? memberB.ID : spaceBId,
        };
    };

    const shouldLeakForUser = (surface: DisclosureSurface, user: UserInfo | undefined): boolean => {
        if (leakConfig.LeakOnSurface !== surface || !user) return false;
        const isExt = (user.UserRoles ?? []).some((r) => r.RoleID.toLowerCase() === PARTICIPANT_ROLE_ID.toLowerCase());
        if (leakConfig.LeakPersona === 'external-participant') return isExt;
        if (leakConfig.LeakPersona === 'restricted-staff') return !isExt && user.ID.toLowerCase() !== USER_DEV_ID.toLowerCase();
        return user.ID.toLowerCase() !== USER_DEV_ID.toLowerCase();
    };

    const makeEntityStub = (entityName: string, contextUser: UserInfo | undefined): BaseEntity => {
        const entityInfo = baseProvider.EntityByName(entityName);
        const backing: Record<string, string | boolean | null | undefined> = {};
        let saved = false;

        const stub = {
            EntityInfo: entityInfo,
            get ID(): string {
                return typeof backing.ID === 'string' ? backing.ID : '';
            },
            set ID(val: string) {
                backing.ID = val;
            },
            get Name(): string {
                return typeof backing.Name === 'string' ? backing.Name : '';
            },
            set Name(val: string) {
                backing.Name = val;
            },
            get PrimaryKeys() {
                return [{ Name: 'ID', Value: backing.ID ?? null }];
            },
            get PrimaryKey() {
                return typeof backing.ID === 'string' ? CompositeKey.FromID(backing.ID) : new CompositeKey();
            },
            NewRecord() {
                syntheticIdSeq += 1;
                backing.ID = `E9000001-0000-4000-8000-${String(syntheticIdSeq).padStart(12, '0')}`;
                saved = false;
            },
            async Save(): Promise<boolean> {
                if (!backing.ID) {
                    syntheticIdSeq += 1;
                    backing.ID = `E9000001-0000-4000-8000-${String(syntheticIdSeq).padStart(12, '0')}`;
                }
                const row: ProbeRowRecord = { ...backing };
                if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                    currentMap(committedSpaces, txSpaces).set(String(backing.ID).toLowerCase(), row);
                } else if (entityName === 'MJ_BizApps_Collaboration: Space Members') {
                    currentMap(committedMembers, txMembers).set(String(backing.ID).toLowerCase(), row);
                } else if (entityName === 'MJ_BizApps_Collaboration: Space Notes') {
                    currentMap(committedNotes, txNotes).set(String(backing.ID).toLowerCase(), row);
                } else if (entityName === 'MJ: Users') {
                    currentMap(committedUsers, txUsers).set(String(backing.ID).toLowerCase(), row);
                } else if (entityName === 'MJ: User Roles') {
                    currentMap(committedUserRoles, txUserRoles).set(String(backing.ID).toLowerCase(), row);
                }
                saved = true;
                return saved;
            },
            async InnerLoad(key: CompositeKey): Promise<boolean> {
                capturedCalls.push(`direct-id:${entityName}:${contextUser?.ID ?? 'anon'}`);
                const targetId = String(key.KeyValuePairs?.[0]?.Value ?? '').toLowerCase();
                if (!targetId) return false;
                if (
                    shouldLeakForUser('direct-id-resolver', contextUser) &&
                    (!leakConfig.LeakEntityName || leakConfig.LeakEntityName === entityName)
                ) {
                    backing.ID = targetId;
                    return true;
                }
                if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                    const found = currentMap(committedSpaces, txSpaces).get(targetId);
                    if (found && isSpaceAccessibleToUser(targetId, contextUser)) {
                        backing.ID = String(found.ID);
                        return true;
                    }
                    return false;
                }
                if (entityName === 'MJ_BizApps_Collaboration: Space Notes') {
                    const found = currentMap(committedNotes, txNotes).get(targetId);
                    if (found && isSpaceAccessibleToUser(typeof found.SpaceID === 'string' ? found.SpaceID : null, contextUser)) {
                        backing.ID = String(found.ID);
                        return true;
                    }
                    return false;
                }
                return false;
            },
        };

        return new Proxy(stub, {
            set(target, prop, value) {
                if (typeof prop === 'string' && !(prop in target)) {
                    backing[prop] = value as string | boolean | null | undefined;
                    return true;
                }
                return Reflect.set(target, prop, value);
            },
            get(target, prop) {
                if (typeof prop === 'string' && !(prop in target)) {
                    return backing[prop];
                }
                return Reflect.get(target, prop);
            },
        }) as BaseEntity;
    };

    const provider: ProbeDatabaseProvider = Object.assign(Object.create(baseProvider), {
        get Entities(): EntityInfo[] {
            return baseProvider.Entities;
        },
        get Authorizations() {
            return baseProvider.Authorizations;
        },
        get AuthorizationRoles() {
            return baseProvider.AuthorizationRoles;
        },
        EntityByName: (name: string) => baseProvider.EntityByName(name),
        EntityByID: (id: string) => baseProvider.EntityByID(id),
        async BeginEntityTransaction(): Promise<EntityTransactionScope> {
            beginCount += 1;
            txActive = true;
            txSpaces = new Map(committedSpaces);
            txMembers = new Map(committedMembers);
            txNotes = new Map(committedNotes);
            txUsers = new Map(committedUsers);
            txUserRoles = new Map(committedUserRoles);

            let settled = false;
            return {
                IsNested: false,
                async Commit(): Promise<void> {
                    if (settled) return;
                    settled = true;
                    commitCount += 1;
                    txActive = false;
                },
                async Rollback(): Promise<void> {
                    if (settled) return;
                    settled = true;
                    rollbackCount += 1;
                    txSpaces.clear();
                    txMembers.clear();
                    txNotes.clear();
                    txUsers.clear();
                    txUserRoles.clear();
                    txActive = false;
                    if (leakConfig.ForceRollbackFailure) {
                        throw new Error('Simulated transaction rollback failure');
                    }
                },
            };
        },
        async GetEntityObject<T extends BaseEntity = BaseEntity>(entityName: string, contextUser?: UserInfo): Promise<T> {
            return makeEntityStub(entityName, contextUser) as T;
        },
        async RunView<T>(params: RunViewParams, contextUser?: UserInfo): Promise<RunViewResult<T>> {
            const entityName = params.EntityName ?? '';
            if (entityName === 'MJ: Row Level Security Filters') {
                return baseProvider.RunView<T>(params, contextUser);
            }
            capturedCalls.push(`runview:${entityName}:${contextUser?.ID ?? 'anon'}`);

            if (entityName === 'MJ_BizApps_Collaboration: Space Types' || entityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                return baseProvider.RunView<T>(params, contextUser);
            }
            if (entityName === 'MJ: Queries') {
                return {
                    Success: true,
                    Results: [{ ID: 'Q1000001-0000-4000-8000-000000000001', Name: 'Collaboration Home Counts' }] as T[],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (entityName === 'MJ: Datasets') {
                return {
                    Success: true,
                    Results: [{ ID: 'DS100001-0000-4000-8000-000000000001', Name: 'Collaboration_Bootstrap' }] as T[],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            if (entityName === 'MJ: Reports') {
                return {
                    Success: true,
                    Results: [
                        {
                            ID: 'R1000001-0000-4000-8000-000000000001',
                            Name: 'Collaboration Space Activity Report',
                            QueryID: 'Q1000001-0000-4000-8000-000000000001',
                        },
                    ] as T[],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }

            // Leak injection for all-views surface
            if (
                shouldLeakForUser('all-views', contextUser) &&
                (!leakConfig.LeakEntityName || leakConfig.LeakEntityName === entityName)
            ) {
                const sample = pickOutOfSpaceSample();
                const leakedRow: ProbeRowRecord = {
                    ID: entityName === 'MJ_BizApps_Collaboration: Space Notes' ? sample.noteId : sample.spaceId,
                    SpaceID: sample.spaceId,
                };
                return {
                    Success: true,
                    Results: [leakedRow] as T[],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }

            const filterRowsByExtra = (rows: ProbeRowRecord[]): ProbeRowRecord[] => {
                if (!params.ExtraFilter) return rows;
                const inMatch = /\[(\w+)\]\s+IN\s*\(([^)]*)\)/i.exec(params.ExtraFilter);
                if (inMatch) {
                    const col = inMatch[1];
                    const vals = new Set([...inMatch[2].matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase()));
                    return rows.filter((r) => vals.has(String(r[col] ?? '').toLowerCase()));
                }
                const eqMatch = /\[(\w+)\]\s*=\s*'([^']+)'/i.exec(params.ExtraFilter);
                if (eqMatch) {
                    const col = eqMatch[1];
                    const val = eqMatch[2].toLowerCase();
                    return rows.filter((r) => String(r[col] ?? '').toLowerCase() === val);
                }
                return rows;
            };

            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                const visible = filterRowsByExtra(
                    [...currentMap(committedSpaces, txSpaces).values()].filter((s) =>
                        isSpaceAccessibleToUser(typeof s.ID === 'string' ? s.ID : null, contextUser),
                    ),
                );
                return { Success: true, Results: visible as T[], RowCount: visible.length, TotalRowCount: visible.length, ExecutionTime: 1, ErrorMessage: '' };
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Notes') {
                const visible = filterRowsByExtra(
                    [...currentMap(committedNotes, txNotes).values()].filter((n) =>
                        isSpaceAccessibleToUser(typeof n.SpaceID === 'string' ? n.SpaceID : null, contextUser),
                    ),
                );
                return { Success: true, Results: visible as T[], RowCount: visible.length, TotalRowCount: visible.length, ExecutionTime: 1, ErrorMessage: '' };
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Members') {
                const visible = filterRowsByExtra(
                    [...currentMap(committedMembers, txMembers).values()].filter((m) =>
                        isSpaceAccessibleToUser(typeof m.SpaceID === 'string' ? m.SpaceID : null, contextUser),
                    ),
                );
                return { Success: true, Results: visible as T[], RowCount: visible.length, TotalRowCount: visible.length, ExecutionTime: 1, ErrorMessage: '' };
            }

            return { Success: true, Results: [] as T[], RowCount: 0, TotalRowCount: 0, ExecutionTime: 1, ErrorMessage: '' };
        },
        async RunQuery(params: RunQueryParams, contextUser?: UserInfo): Promise<RunQueryResult> {
            capturedCalls.push(`runquery:${params.QueryName ?? params.QueryID ?? ''}:${contextUser?.ID ?? 'anon'}`);
            if (shouldLeakForUser('run-query', contextUser)) {
                const sample = pickOutOfSpaceSample();
                return {
                    QueryID: params.QueryID ?? 'Q1000001-0000-4000-8000-000000000001',
                    QueryName: params.QueryName ?? 'Collaboration Home Counts',
                    Success: true,
                    Results: [{ ID: sample.noteId, SpaceID: sample.spaceId }],
                    RowCount: 1,
                    TotalRowCount: 1,
                    ExecutionTime: 1,
                    ErrorMessage: '',
                };
            }
            return {
                QueryID: params.QueryID ?? 'Q1000001-0000-4000-8000-000000000001',
                QueryName: params.QueryName ?? 'Collaboration Home Counts',
                Success: false,
                Results: [],
                RowCount: 0,
                TotalRowCount: 0,
                ExecutionTime: 1,
                ErrorMessage: 'Permission denied: caller lacks Integration role to execute stored query.',
            };
        },
        async GetDatasetByName(
            datasetName: string,
            _itemFilters?: DatasetItemFilterType[],
            contextUser?: UserInfo,
        ): Promise<DatasetResultType> {
            capturedCalls.push(`dataset:${datasetName}:${contextUser?.ID ?? 'anon'}`);
            if (shouldLeakForUser('dataset', contextUser)) {
                const sample = pickOutOfSpaceSample();
                const entityName = leakConfig.LeakEntityName ?? 'MJ_BizApps_Collaboration: Space Notes';
                return {
                    DatasetID: 'DS100001-0000-4000-8000-000000000001',
                    DatasetName: datasetName,
                    Success: true,
                    Status: 'Success',
                    LatestUpdateDate: new Date(),
                    Results: [
                        {
                            Code: 'notes',
                            EntityName: entityName,
                            EntityID: baseProvider.EntityByName(entityName)?.ID ?? 'E000',
                            LatestUpdateDate: new Date(),
                            Results: [{ ID: sample.noteId, SpaceID: sample.spaceId }],
                        },
                    ],
                };
            }
            return {
                DatasetID: 'DS100001-0000-4000-8000-000000000001',
                DatasetName: datasetName,
                Success: true,
                Status: 'Success',
                LatestUpdateDate: new Date(),
                Results: [
                    {
                        Code: 'space-types',
                        EntityName: 'MJ_BizApps_Collaboration: Space Types',
                        EntityID: baseProvider.EntityByName('MJ_BizApps_Collaboration: Space Types')?.ID ?? 'E001',
                        LatestUpdateDate: new Date(),
                        Results: [{ ID: SPACE_TYPE_PROJECT_ID, Name: 'Project' }],
                    },
                ],
            };
        },
        async Load() {
            return {};
        },
    });

    return {
        Provider: provider,
        GetBeginCount: () => beginCount,
        GetCommitCount: () => commitCount,
        GetRollbackCount: () => rollbackCount,
        GetPersistedSpacesCount: () => committedSpaces.size,
        GetPersistedMembersCount: () => committedMembers.size,
        GetPersistedNotesCount: () => committedNotes.size,
        GetAllCapturedSurfaceCalls: () => capturedCalls,
        SetLeakConfig: (cfg) => {
            leakConfig = { ...cfg };
        },
        SpaceTypeId: SPACE_TYPE_PROJECT_ID,
    };
}

describe('XS-3 Automated Cross-Surface Persona Security Probe', () => {
    const devAdmin = makeUserInfo({ ID: USER_DEV_ID, Type: 'Owner', RoleIDs: [ROLE_DEVELOPER_ID] });
    const adaStaffAdmin = makeUserInfo({ ID: USER_ADA_ID, Type: 'User', RoleIDs: [ROLE_UI_ID] });
    const beaParticipant = makeUserInfo({ ID: USER_BEA_ID, Type: 'User', RoleIDs: [PARTICIPANT_ROLE_ID] });

    beforeEach(() => {
        LoadCollaborationSecurityAuditOperations();
    });

    it('registers BaseHealthProbe, BaseLiveCrudVerifier, and BaseRemotableOperation via @RegisterClass', () => {
        const probe = MJGlobal.Instance.ClassFactory.CreateInstance<BaseHealthProbe>(
            BaseHealthProbe,
            PERSONA_SECURITY_PROBE_KEY,
        );
        const verifier = MJGlobal.Instance.ClassFactory.CreateInstance<BaseLiveCrudVerifier>(
            BaseLiveCrudVerifier,
            PERSONA_SECURITY_VERIFIER_KEY,
        );
        const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation<PersonaSecurityProbeInput, PersonaSecurityProbeResult>>(
            BaseRemotableOperation,
            PERSONA_SECURITY_PROBE_OPERATION_KEY,
        );

        expect(probe).toBeInstanceOf(CollaborationPersonaSecurityProbe);
        expect(verifier).toBeInstanceOf(CollaborationPersonaSecurityVerifier);
        expect(op).toBeInstanceOf(PersonaSecurityProbeOperation);
        expect(probe?.Mode).toBe('live-test');
        expect(probe?.SignalDefinitions[0]?.Code).toBe(PERSONA_SECURITY_PROBE_KEY);
    });

    it('sweeps all 5 surfaces cleanly for external-participant and restricted-staff personas inside WithRolledBackTransaction with zero residual fixtures', async () => {
        const harness = createTransactionalProbeHarness();
        const queries: ProbeQueryTarget[] = [{ QueryName: 'Collaboration Home Counts', CategoryPath: 'Collaboration' }];
        const datasets: ProbeDatasetTarget[] = [{ DatasetName: 'Collaboration_Bootstrap' }];
        const reports: ProbeReportTarget[] = [{ ReportName: 'Collaboration Space Activity Report' }];

        const result = await runPersonaSecurityProbe(harness.Provider, devAdmin, {
            Queries: queries,
            Datasets: datasets,
            Reports: reports,
            ReportExecutor: async () => ({ Success: true, Rows: [] }),
            DirectIdResolverHook: async () => null,
            RestrictedStaffRoleID: ROLE_UI_ID,
        });

        expect(result.Findings).toEqual([]);
        expect(result.Stats.ResidualCheckPassed).toBe(true);
        expect(result.Passed).toBe(true);
        expect(result.Stats.PersonasChecked).toBe(2);
        expect(result.Stats.SurfacesChecked).toBe(5);
        expect(result.Stats.EntitiesSwept).toBeGreaterThan(0);
        expect(result.Stats.QueriesSwept).toBeGreaterThanOrEqual(2);
        expect(result.Stats.DatasetsSwept).toBeGreaterThanOrEqual(2);
        expect(result.Stats.ReportsSwept).toBeGreaterThanOrEqual(2);
        expect(result.Stats.DirectIdsSwept).toBeGreaterThan(0);
        expect(result.Stats.SyntheticRecordsCreated).toBeGreaterThanOrEqual(6);
        expect(result.Stats.RolledBack).toBe(true);
        expect(result.Stats.ResidualCheckPassed).toBe(true);

        // Verify all 10 (2 personas x 5 surfaces) summaries passed
        expect(result.SurfaceSummaries).toHaveLength(10);
        for (const surface of DISCLOSURE_SURFACES) {
            expect(result.SurfaceSummaries.filter((s) => s.Surface === surface && s.Passed)).toHaveLength(2);
        }

        // Verify unconditional rollback: BeginEntityTransaction called 1x, Commit 0x, Rollback 1x, 0 persisted rows
        expect(harness.GetBeginCount()).toBe(1);
        expect(harness.GetCommitCount()).toBe(0);
        expect(harness.GetRollbackCount()).toBe(1);
        expect(harness.GetPersistedSpacesCount()).toBe(0);
        expect(harness.GetPersistedMembersCount()).toBe(0);
        expect(harness.GetPersistedNotesCount()).toBe(0);

        // Verify XS-2 inventory entities were swept
        const expectedNonCatalogCount = COLLABORATION_BOOT_ENTITY_REGISTRY.filter((e) => e.PolicyKind !== 'active-catalog').length;
        expect(result.Stats.EntitiesSwept).toBe(expectedNonCatalogCount * 2);
    });

    it('detects simulated data leakage in EACH of the 5 disclosure vectors with exact surface, persona, entity, and leaked record diagnostics', async () => {
        for (const surface of DISCLOSURE_SURFACES) {
            const harness = createTransactionalProbeHarness({
                LeakOnSurface: surface,
                LeakPersona: surface === 'report' || surface === 'run-query' ? 'restricted-staff' : 'external-participant',
                LeakEntityName: 'MJ_BizApps_Collaboration: Space Notes',
            });

            const result = await runPersonaSecurityProbe(harness.Provider, devAdmin, {
                RestrictedStaffRoleID: ROLE_UI_ID,
                ReportExecutor: async ({ PersonaKind }) => {
                    if (surface === 'report' && PersonaKind === 'restricted-staff') {
                        return {
                            Success: true,
                            EntityName: 'MJ_BizApps_Collaboration: Space Notes',
                            Rows: [{ ID: 'F8B0B005-0000-4000-8000-000000000000', SpaceID: 'F8B0B002-0000-4000-8000-000000000000' }],
                        };
                    }
                    return { Success: true, Rows: [] };
                },
                DirectIdResolverHook: async ({ EntityName, RecordID, PersonaKind }) => {
                    if (
                        surface === 'direct-id-resolver' &&
                        PersonaKind === 'external-participant' &&
                        EntityName === 'MJ_BizApps_Collaboration: Space Notes'
                    ) {
                        return { ID: RecordID };
                    }
                    return null;
                },
                // Provide deterministic world Space B note ID for report injection match
                ...(surface === 'report'
                    ? {
                          WorldFixtures: {
                              SpaceAID: 'C1000001-0000-4000-8000-000000000002',
                              SpaceBID: 'F8B0B002-0000-4000-8000-000000000000',
                              ExternalParticipantUser: beaParticipant,
                              RestrictedStaffUser: adaStaffAdmin,
                              OutOfSpaceRecords: [
                                  {
                                      EntityName: 'MJ_BizApps_Collaboration: Space Notes',
                                      RecordIDs: ['F8B0B005-0000-4000-8000-000000000000'],
                                  },
                              ],
                          },
                          FixtureMode: 'world-provided',
                      }
                    : {}),
            });

            expect(result.Passed, `Expected probe to fail on leaked surface '${surface}'`).toBe(false);
            const surfaceFindings = result.Findings.filter((f) => f.Surface === surface);
            expect(surfaceFindings.length, `Expected finding for surface '${surface}'`).toBeGreaterThanOrEqual(1);

            const finding = surfaceFindings[0];
            expect(finding.Surface).toBe(surface);
            expect(finding.Persona).toBe(surface === 'report' || surface === 'run-query' ? 'restricted-staff' : 'external-participant');
            expect(finding.EntityName.length).toBeGreaterThan(0);
            expect(finding.LeakedRecordIds.length).toBeGreaterThan(0);
            expect(finding.Diagnostics.length).toBeGreaterThan(10);

            // Rollback must still hold unconditionally even when leaks are detected
            expect(harness.GetCommitCount()).toBe(0);
            expect(harness.GetRollbackCount()).toBe(1);
            expect(harness.GetPersistedSpacesCount()).toBe(0);
            expect(harness.GetPersistedNotesCount()).toBe(0);
        }
    });

    it('unconditionally rolls back transactions on mid-probe exceptions and surfaces HealthProbeRollbackError if rollback fails', async () => {
        const faultHarness = createTransactionalProbeHarness();
        await expect(
            runPersonaSecurityProbe(faultHarness.Provider, devAdmin, {
                FaultInjectionBeforeSurface: 'dataset',
            }),
        ).rejects.toThrow(/Simulated mid-probe failure before dataset surface/);

        expect(faultHarness.GetBeginCount()).toBe(1);
        expect(faultHarness.GetCommitCount()).toBe(0);
        expect(faultHarness.GetRollbackCount()).toBe(1);
        expect(faultHarness.GetPersistedSpacesCount()).toBe(0);
        expect(faultHarness.GetPersistedMembersCount()).toBe(0);
        expect(faultHarness.GetPersistedNotesCount()).toBe(0);

        const rollbackFailHarness = createTransactionalProbeHarness({ ForceRollbackFailure: true });
        await expect(
            runPersonaSecurityProbe(rollbackFailHarness.Provider, devAdmin, {
                FaultInjectionBeforeSurface: 'run-query',
            }),
        ).rejects.toThrow(HealthProbeRollbackError);
    });

    it('executes via BaseHealthProbe.Evaluate, BaseLiveCrudVerifier.Verify, CollaborationAdminEngineBase, and BaseRemotableOperation while rejecting external participants', async () => {
        const harness = createTransactionalProbeHarness();
        const probe = new CollaborationPersonaSecurityProbe();
        const verifier = new CollaborationPersonaSecurityVerifier();

        const evals = await probe.Evaluate({
            DatabaseProvider: harness.Provider,
            MetadataProvider: harness.Provider,
            SystemUser: devAdmin,
            Mode: 'live-test',
            TimeoutMs: 10_000,
        });
        expect(evals).toHaveLength(1);
        expect(evals[0].DiagnosticError).toBeUndefined();
        expect(evals[0].Status).toBe('GREEN');
        expect(evals[0].ObservedMetrics.RolledBack).toBe(true);

        const verifyRes = await verifier.Verify(
            {
                DatabaseProvider: harness.Provider,
                MetadataProvider: harness.Provider,
                SystemUser: devAdmin,
                Mode: 'live-test',
                TimeoutMs: 10_000,
            },
            harness.Provider,
        );
        expect(verifyRes.Success).toBe(true);

        // CollaborationAdminEngineBase delegation & authorization checks
        const engineResult = await CollaborationAdminEngineBase.Instance.RunPersonaSecurityProbe(
            {},
            adaStaffAdmin,
            harness.Provider,
        );
        expect(engineResult.Passed).toBe(true);

        await expect(
            CollaborationAdminEngineBase.Instance.RunPersonaSecurityProbe({}, beaParticipant, harness.Provider),
        ).rejects.toThrow(/External Space Participant accounts cannot invoke/);

        // BaseRemotableOperation ClassFactory invocation & authorization check
        const op = MJGlobal.Instance.ClassFactory.CreateInstance<
            BaseRemotableOperation<PersonaSecurityProbeInput, PersonaSecurityProbeResult>
        >(BaseRemotableOperation, PERSONA_SECURITY_PROBE_OPERATION_KEY);
        expect(op).toBeDefined();

        const opDenied = await op!.ExecuteServer(
            {},
            { provider: harness.Provider, user: beaParticipant, emitProgress: () => {} },
        );
        expect(opDenied.Success).toBe(false);
        expect(opDenied.ResultCode).toBe('FORBIDDEN');

        const opAllowed = await op!.ExecuteServer(
            {},
            { provider: harness.Provider, user: adaStaffAdmin, emitProgress: () => {} },
        );
        expect(opAllowed.Success).toBe(true);
        expect(opAllowed.Output?.Passed).toBe(true);
    });
});
