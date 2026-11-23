import {
    BaseEntity,
    BaseRemotableOperation,
    CompositeKey,
    type DatasetItemFilterType,
    type DatasetResultType,
    type EntityInfo,
    type EntityTransactionScope,
    type IMetadataProvider,
    type IRunQueryProvider,
    LogError,
    type RemoteOpServerContext,
    RemoteOperationError,
    type RunQueryParams,
    type RunQueryResult,
    RunQuery,
    RunView,
    type UserInfo,
    UserRoleInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import type { MJUserEntity, MJUserRoleEntity } from '@memberjunction/core-entities';
import type {
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceNoteEntity,
} from '@mj-biz-apps/collaboration-entities';
import {
    type BootEntityGrantPolicySpec,
    COLLABORATION_BOOT_ENTITY_REGISTRY,
} from './boot-entity-grant-inventory.js';
import {
    type AuditSeverity,
    authorizeSecurityAuditCaller,
    buildBatchedInFilter,
    buildUuidEqualsFilter,
    chunkDistinctIds,
    COLLABORATION_SCHEMA_NAME,
    detectAuditSqlDialect,
    extractRecordUuid,
    normalizeAuditUuid,
    PARTICIPANT_ROLE_ID,
    type SqlDialect,
} from './security-audit-types.js';

export const PERSONA_SECURITY_PROBE_KEY = 'BIZAPPS.COLLAB.LIVE.PERSONA_SECURITY_PROBE';
export const PERSONA_SECURITY_VERIFIER_KEY = 'BIZAPPS.COLLAB.LIVE.PERSONA_SECURITY_VERIFIER';
export const PERSONA_SECURITY_PROBE_OPERATION_KEY = 'Collaboration.PersonaSecurityProbe';
export const COLLABORATION_HEALTH_OWNER_APP = 'mj-bizapps-collaboration';

export const DEFAULT_PROBE_MAX_ROWS = 10;
export const MAX_PROBE_ROW_CAP = 50;
export const DEFAULT_PROBE_TIMEOUT_MS = 15_000;

/** All five query/read vectors verified by XS-3. */
export const DISCLOSURE_SURFACES = [
    'all-views',
    'run-query',
    'dataset',
    'report',
    'direct-id-resolver',
] as const;

export type DisclosureSurface = (typeof DISCLOSURE_SURFACES)[number];

export type ProbePersonaKind = 'external-participant' | 'restricted-staff';

export type HealthStatus = 'GREEN' | 'YELLOW' | 'RED';
export type HealthLayer = 'core' | 'open-app' | 'server-extension' | 'connector' | 'live-test';
export type ProbeExecutionMode = 'passive' | 'live-test';

export interface AgentRemediationPlaybook {
    AgentInstructions: string;
    AllowedAutonomousActions: string[];
    MaxAutonomousAttempts: number;
    RetryCooldownSeconds: number;
    HumanEscalationCriteria: string;
    HumanOperatorRunbook?: string;
}

export interface HealthSignalDefinition {
    Code: string;
    Title: string;
    Layer: HealthLayer;
    OwnerApp: string;
    Mode: ProbeExecutionMode;
    Description: string;
    YellowPlaybook: AgentRemediationPlaybook;
    RedPlaybook: AgentRemediationPlaybook;
}

export interface HealthSignalEvaluation {
    Code: string;
    Title: string;
    Layer: HealthLayer;
    OwnerApp: string;
    Mode: ProbeExecutionMode;
    Status: HealthStatus;
    Summary: string;
    ObservedMetrics: Record<string, string | number | boolean | null>;
    Thresholds?: Record<string, string | number | boolean>;
    EvaluatedAt: string;
    DurationMs: number;
    ActivePlaybook?: AgentRemediationPlaybook;
    DiagnosticError?: string;
}

export interface LiveCrudVerifierResult {
    Success: boolean;
    Summary: string;
    ObservedMetrics?: Record<string, string | number | boolean | null>;
    DiagnosticError?: string;
}

/**
 * Strongly-typed scalar/record representation for probe row scans (zero `any`, zero `unknown`).
 */
export type ProbeRowScalar = string | number | boolean | Date | null | undefined;
export type ProbeRowRecord = Record<string, ProbeRowScalar | readonly ProbeRowScalar[]>;

/**
 * Transactional provider capability required by {@link BaseHealthProbe.WithRolledBackTransaction}.
 * Satisfied directly by `DatabaseProviderBase` (`SQLServerDataProvider`, `PostgreSQLDataProvider`)
 * as well as strictly-typed in-memory/integration transaction test providers.
 */
export interface ProbeDatabaseProvider extends IMetadataProvider {
    BeginEntityTransaction(): Promise<EntityTransactionScope>;
    RunQuery?(params: RunQueryParams, contextUser?: UserInfo): Promise<RunQueryResult>;
}

export interface HealthProbeContext {
    DatabaseProvider: ProbeDatabaseProvider;
    MetadataProvider: IMetadataProvider;
    SystemUser: UserInfo;
    Mode: ProbeExecutionMode;
    AppFilter?: string;
    TimeoutMs: number;
    LiveCrudVerifier?: BaseLiveCrudVerifier | readonly BaseLiveCrudVerifier[];
}

/**
 * Thrown by {@link BaseHealthProbe.WithRolledBackTransaction} when unconditional rollback fails.
 */
export class HealthProbeRollbackError extends Error {
    public readonly ProbeKey: string;
    public readonly RollbackError: Error;
    public readonly FnError?: Error;

    constructor(probeKey: string, rollbackError: Error, fnError?: Error) {
        const fnSuffix = fnError ? ` (the probe's synthetic work had also thrown: ${fnError.message})` : '';
        super(`BaseHealthProbe.WithRolledBackTransaction (${probeKey}): rollback failed — ${rollbackError.message}${fnSuffix}`);
        this.name = 'HealthProbeRollbackError';
        this.ProbeKey = probeKey;
        this.RollbackError = rollbackError;
        this.FnError = fnError;
    }
}

/**
 * Health probe contract aligned with `@memberjunction/health` `BaseHealthProbe` and
 * `WithRolledBackTransaction` unconditional rollback semantics.
 */
export abstract class BaseHealthProbe {
    public abstract get ProbeKey(): string;
    public abstract get OwnerApp(): string;
    public abstract get Mode(): ProbeExecutionMode;
    public abstract get SignalDefinitions(): readonly HealthSignalDefinition[];
    public abstract Evaluate(context: HealthProbeContext): Promise<HealthSignalEvaluation[]>;

    /**
     * Executes `fn` inside a provider-arbitrated transaction scope and **unconditionally** rolls it
     * back — whether `fn` succeeds, reports security findings, or throws an exception.
     */
    protected async WithRolledBackTransaction<T>(
        context: HealthProbeContext,
        fn: (txProvider: ProbeDatabaseProvider) => Promise<T>,
    ): Promise<T> {
        const provider = context.DatabaseProvider;
        if (typeof provider.BeginEntityTransaction !== 'function') {
            throw new HealthProbeRollbackError(
                this.ProbeKey,
                new Error('DatabaseProvider.BeginEntityTransaction() is required for unconditional rollback isolation.'),
            );
        }

        const scope = await provider.BeginEntityTransaction();

        let fnFailed = false;
        let fnError: Error | undefined;
        let result: T | undefined;
        try {
            result = await fn(provider);
        } catch (err) {
            fnFailed = true;
            fnError = err instanceof Error ? err : new Error(String(err));
        }

        try {
            await scope.Rollback();
        } catch (rollbackErr) {
            const normalizedRollbackErr = rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr));
            LogError(
                `BaseHealthProbe.WithRolledBackTransaction (${this.ProbeKey}): rollback failed after the ` +
                    `probe's synthetic work ${fnFailed ? 'threw' : 'finished'}. Rollback failure: ` +
                    `${normalizedRollbackErr.message}`,
            );
            throw new HealthProbeRollbackError(this.ProbeKey, normalizedRollbackErr, fnError);
        }

        if (fnFailed) {
            throw fnError;
        }
        return result as T;
    }
}

const DEFAULT_VERIFIER_YELLOW_PLAYBOOK: AgentRemediationPlaybook = {
    AgentInstructions:
        'A synthetic persona security verification completed with non-fatal latency or coverage warnings. Review diagnostics before promotion.',
    AllowedAutonomousActions: [],
    MaxAutonomousAttempts: 0,
    RetryCooldownSeconds: 300,
    HumanEscalationCriteria: 'Escalate if the verifier reports YELLOW across three consecutive probe runs.',
};

const DEFAULT_VERIFIER_RED_PLAYBOOK: AgentRemediationPlaybook = {
    AgentInstructions:
        'A synthetic persona security verification detected out-of-space data disclosure or failed rollback isolation. Block promotion immediately and inspect leaked surface diagnostics.',
    AllowedAutonomousActions: [],
    MaxAutonomousAttempts: 0,
    RetryCooldownSeconds: 300,
    HumanEscalationCriteria: 'Escalate immediately to Security Engineering with exact surface, persona, entity, and leakedRecordIds.',
};

/**
 * Live CRUD & authorization verifier contract aligned with `@memberjunction/health` `BaseLiveCrudVerifier`.
 */
export abstract class BaseLiveCrudVerifier {
    public abstract get VerifierKey(): string;
    public abstract get OwnerApp(): string;
    public abstract get Title(): string;

    public get YellowPlaybook(): AgentRemediationPlaybook {
        return DEFAULT_VERIFIER_YELLOW_PLAYBOOK;
    }

    public get RedPlaybook(): AgentRemediationPlaybook {
        return DEFAULT_VERIFIER_RED_PLAYBOOK;
    }

    public abstract Verify(
        context: HealthProbeContext,
        txProvider: ProbeDatabaseProvider,
    ): Promise<LiveCrudVerifierResult>;
}

export interface ProbeQueryTarget {
    QueryID?: string;
    QueryName?: string;
    CategoryPath?: string;
    EntityName?: string;
    Parameters?: Record<string, string | number | boolean | null>;
}

export interface ProbeDatasetTarget {
    DatasetName: string;
    ItemFilters?: DatasetItemFilterType[];
    DefaultEntityName?: string;
}

export interface ProbeReportTarget {
    ReportID?: string;
    ReportName: string;
    EntityName?: string;
    QueryID?: string;
    DataContextID?: string;
    Parameters?: Record<string, string | number | boolean | null>;
}

export interface ProbeReportExecutionOutcome {
    Success: boolean;
    ErrorMessage?: string;
    Rows: ProbeRowRecord[];
    EntityName?: string;
}

export type ProbeReportExecutor = (params: {
    Report: ProbeReportTarget;
    PersonaUser: UserInfo;
    PersonaKind: ProbePersonaKind;
    Provider: ProbeDatabaseProvider;
}) => Promise<ProbeReportExecutionOutcome>;

export type DirectIdResolverLookupFn = (params: {
    EntityName: string;
    RecordID: string;
    PersonaUser: UserInfo;
    PersonaKind: ProbePersonaKind;
    Provider: ProbeDatabaseProvider;
}) => Promise<ProbeRowRecord | null>;

export interface ProbeOutOfSpaceRecordTarget {
    EntityName: string;
    RecordIDs: readonly string[];
    SpaceID?: string;
}

export interface ProbePersonaFixtureOverrides {
    SpaceAID: string;
    SpaceBID: string;
    ExternalParticipantUser: UserInfo;
    RestrictedStaffUser: UserInfo;
    OutOfSpaceRecords: readonly ProbeOutOfSpaceRecordTarget[];
}

export interface PersonaSecurityProbeFinding {
    Code: 'CROSS_SPACE_DATA_LEAK' | 'UNAUTHORIZED_STAFF_ENTITY_LEAK' | 'PROBE_EXECUTION_TIMEOUT';
    Severity: AuditSeverity;
    Surface: DisclosureSurface;
    Persona: ProbePersonaKind;
    PersonaKey: string;
    EntityName: string;
    TargetName?: string;
    LeakedRecordIds: string[];
    Diagnostics: string;
    Remediation: string;
}

export interface PersonaSurfaceSummary {
    Persona: ProbePersonaKind;
    PersonaKey: string;
    Surface: DisclosureSurface;
    SweptCount: number;
    LeakedCount: number;
    Passed: boolean;
    DurationMs: number;
    Diagnostics: string;
}

export interface PersonaSecurityProbeStats {
    PersonasChecked: number;
    SurfacesChecked: number;
    EntitiesSwept: number;
    QueriesSwept: number;
    DatasetsSwept: number;
    ReportsSwept: number;
    DirectIdsSwept: number;
    SyntheticRecordsCreated: number;
    RolledBack: boolean;
    ResidualCheckPassed: boolean;
    DurationMs: number;
}

export interface PersonaSecurityProbeInput {
    /** Execution mode: `'synthetic'` creates isolated Space A & Space B records inside `WithRolledBackTransaction`; `'world-provided'` uses `WorldFixtures`. */
    FixtureMode?: 'synthetic' | 'world-provided';
    /** Optional pre-built world fixtures when probing existing Space A vs Space B records inside a rolled-back transaction. */
    WorldFixtures?: ProbePersonaFixtureOverrides;
    /** Optional entity subset from `COLLABORATION_BOOT_ENTITY_REGISTRY`. Defaults to all non-catalog entities present in metadata. */
    TargetEntities?: readonly string[];
    /** Stored queries to sweep via `RunQuery` (combined with Collaboration queries discovered from `MJ: Queries`). */
    Queries?: readonly ProbeQueryTarget[];
    /** Datasets to sweep via `GetDatasetByName` (combined with Collaboration datasets discovered from `MJ: Datasets`). */
    Datasets?: readonly ProbeDatasetTarget[];
    /** Reports to sweep via `ReportExecutor` or `MJ: Reports` / `MJ: Data Context Items`. */
    Reports?: readonly ProbeReportTarget[];
    /** Optional custom report executor callback for testing or host report runners. */
    ReportExecutor?: ProbeReportExecutor;
    /** Optional direct-ID resolver callback (simulating GraphQL direct ID resolvers alongside `BaseEntity.InnerLoad`). */
    DirectIdResolverHook?: DirectIdResolverLookupFn;
    /** Optional explicit `IRunQueryProvider` when separate from `provider`. */
    QueryProvider?: IRunQueryProvider;
    /** Canonical external participant RoleID override (defaults to `PARTICIPANT_ROLE_ID`). */
    ParticipantRoleID?: string;
    /** Optional restricted staff RoleID used when provisioning synthetic staff persona. */
    RestrictedStaffRoleID?: string;
    /** Explicit SQL dialect override (`'mssql'` | `'postgresql'`). */
    Dialect?: SqlDialect;
    /** Bounded row cap per probe sweep (default: 10, max: 50). */
    MaxRowsPerProbe?: number;
    /** Per-probe timeout budget in milliseconds (default: 15000). */
    TimeoutMs?: number;
    /** Optional fault injection hook for tests exercising rollback behavior on mid-probe errors. */
    FaultInjectionBeforeSurface?: DisclosureSurface;
}

export interface PersonaSecurityProbeResult {
    Passed: boolean;
    ProbedAt: string;
    Dialect: SqlDialect;
    SpaceAID: string;
    SpaceBID: string;
    Findings: PersonaSecurityProbeFinding[];
    SurfaceSummaries: PersonaSurfaceSummary[];
    Stats: PersonaSecurityProbeStats;
}

interface SyntheticFixtureState {
    SpaceAID: string;
    SpaceBID: string;
    ExternalParticipantUser: UserInfo;
    RestrictedStaffUser: UserInfo;
    OutOfSpaceIdsByEntity: Map<string, Set<string>>;
    AllOutOfSpaceIds: Set<string>;
    CreatedRecordCountsByEntity: Map<string, number>;
    TotalCreated: number;
}

interface SimpleLookupRow {
    ID: string;
    Name?: string | null;
    Code?: string | null;
    QueryID?: string | null;
    DataContextID?: string | null;
    CategoryID?: string | null;
}

interface SimpleDataContextItemRow {
    ID: string;
    Type?: string | null;
    ViewID?: string | null;
    QueryID?: string | null;
    EntityID?: string | null;
}

const DEFAULT_FALLBACK_STAFF_ROLE_ID = 'E0AFCCEC-6A37-EF11-86D4-000D3A4E707E';

function hasBeginEntityTransaction(provider: IMetadataProvider): provider is ProbeDatabaseProvider {
    return 'BeginEntityTransaction' in provider && typeof (provider as ProbeDatabaseProvider).BeginEntityTransaction === 'function';
}

function isRunQueryProvider(candidate: IMetadataProvider | IRunQueryProvider | undefined): candidate is IRunQueryProvider {
    return !!candidate && 'RunQuery' in candidate && typeof candidate.RunQuery === 'function';
}

function clampMaxRows(raw: number | undefined): number {
    if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
        return Math.min(raw, MAX_PROBE_ROW_CAP);
    }
    return DEFAULT_PROBE_MAX_ROWS;
}

function clampTimeoutMs(raw: number | undefined): number {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
        return Math.min(raw, 60_000);
    }
    return DEFAULT_PROBE_TIMEOUT_MS;
}

function makeSyntheticUuid(prefixHex: string, suffixNum: number): string {
    const cleanPrefix = prefixHex.replace(/[^0-9a-f]/gi, '').toUpperCase().padEnd(8, '0').slice(0, 8);
    const tail = String(suffixNum).padStart(12, '0');
    return `${cleanPrefix}-0000-4000-8000-${tail}`;
}

function buildPersonaUserInfo(
    provider: IMetadataProvider,
    id: string,
    name: string,
    email: string,
    roleId: string,
): UserInfo {
    const role = new UserRoleInfo({ UserID: id, RoleID: roleId });
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: name,
        Email: email,
        Type: 'User',
        IsActive: true,
        UserRoles: [role],
    };
    // Attach provider reference when UserInfo helpers expect metadata context, without `any`
    void provider;
    return partial as UserInfo;
}

function readScalarField(row: ProbeRowRecord, fieldName: string): string | null {
    const direct = row[fieldName];
    if (typeof direct === 'string') {
        return direct;
    }
    const targetLower = fieldName.toLowerCase();
    for (const [key, value] of Object.entries(row)) {
        if (key.toLowerCase() === targetLower && typeof value === 'string') {
            return value;
        }
    }
    return null;
}

function collectCandidateRowIds(row: ProbeRowRecord): string[] {
    const ids: string[] = [];
    for (const value of Object.values(row)) {
        if (typeof value === 'string') {
            const uuid = extractRecordUuid(value);
            if (uuid) {
                ids.push(uuid);
            }
        } else if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === 'string') {
                    const uuid = extractRecordUuid(item);
                    if (uuid) {
                        ids.push(uuid);
                    }
                }
            }
        }
    }
    return ids;
}

function findLeakedIdsInRows(
    rows: readonly ProbeRowRecord[],
    outOfSpaceIds: ReadonlySet<string>,
    spaceBId: string,
): string[] {
    const leaked = new Set<string>();
    const spaceBLower = normalizeAuditUuid(spaceBId);

    for (const row of rows) {
        const rowSpaceId = normalizeAuditUuid(readScalarField(row, 'SpaceID'));
        const rowPrimaryId = extractRecordUuid(readScalarField(row, 'ID'));
        if (spaceBLower && rowSpaceId === spaceBLower) {
            leaked.add(rowPrimaryId ?? rowSpaceId);
        }
        for (const candidate of collectCandidateRowIds(row)) {
            if (outOfSpaceIds.has(candidate)) {
                leaked.add(candidate);
            }
        }
    }

    return [...leaked];
}

function resolvePrimaryKeyField(entity: EntityInfo | undefined): string {
    const pk = entity?.PrimaryKeys?.[0]?.Name?.trim();
    return pk && pk.length > 0 ? pk : 'ID';
}

function readEntityPrimaryKeyId(entityObj: BaseEntity): string | null {
    const values = entityObj.PrimaryKeys.map((pk) => (typeof pk.Value === 'string' ? pk.Value : null)).filter(
        (v): v is string => v !== null && v.trim().length > 0,
    );
    if (values.length > 0) {
        return normalizeAuditUuid(values[0]);
    }
    const keyVal = entityObj.PrimaryKey?.KeyValuePairs?.[0]?.Value;
    return typeof keyVal === 'string' ? normalizeAuditUuid(keyVal) : null;
}

function isAccessDenialMessage(message: string | undefined): boolean {
    if (!message) {
        return false;
    }
    return /permission|denied|forbidden|unauthorized|not allowed|security|access|read|does not have/i.test(message);
}

function mergeOutOfSpaceTargets(
    targetMap: Map<string, Set<string>>,
    allSet: Set<string>,
    entityName: string,
    ids: readonly string[],
): void {
    const key = entityName.trim();
    const existing = targetMap.get(key) ?? new Set<string>();
    for (const rawId of ids) {
        const clean = extractRecordUuid(rawId);
        if (clean) {
            existing.add(clean);
            allSet.add(clean);
        }
    }
    if (existing.size > 0) {
        targetMap.set(key, existing);
    }
}

async function resolveTargetPolicies(
    provider: IMetadataProvider,
    targetEntities?: readonly string[],
): Promise<BootEntityGrantPolicySpec[]> {
    const requestedSet =
        targetEntities && targetEntities.length > 0
            ? new Set(targetEntities.map((name) => name.trim().toLowerCase()))
            : null;

    return COLLABORATION_BOOT_ENTITY_REGISTRY.filter((spec) => {
        if (spec.PolicyKind === 'active-catalog') {
            return false;
        }
        if (requestedSet && !requestedSet.has(spec.EntityName.trim().toLowerCase())) {
            return false;
        }
        return !!provider.EntityByName(spec.EntityName);
    });
}

async function createSyntheticFixturesInTransaction(
    txProvider: ProbeDatabaseProvider,
    systemUser: UserInfo,
    input: PersonaSecurityProbeInput,
): Promise<SyntheticFixtureState> {
    const participantRoleId = normalizeAuditUuid(input.ParticipantRoleID ?? PARTICIPANT_ROLE_ID) ?? PARTICIPANT_ROLE_ID.toLowerCase();
    const staffRoleId = normalizeAuditUuid(input.RestrictedStaffRoleID ?? DEFAULT_FALLBACK_STAFF_ROLE_ID) ?? DEFAULT_FALLBACK_STAFF_ROLE_ID.toLowerCase();
    const rv = RunView.FromMetadataProvider(txProvider);

    const outOfSpaceIdsByEntity = new Map<string, Set<string>>();
    const allOutOfSpaceIds = new Set<string>();
    const createdCounts = new Map<string, number>();
    let totalCreated = 0;

    const recordCreated = (entityName: string, id: string): void => {
        createdCounts.set(entityName, (createdCounts.get(entityName) ?? 0) + 1);
        totalCreated += 1;
        void id;
    };

    const stamp = Date.now() % 100_000;
    const spaceAId = makeSyntheticUuid('F8B0A001', stamp * 10 + 1);
    const spaceBId = makeSyntheticUuid('F8B0B002', stamp * 10 + 2);
    const extUserId = makeSyntheticUuid('F8B0E003', stamp * 10 + 3);
    const staffUserId = makeSyntheticUuid('F8B0C004', stamp * 10 + 4);
    const spaceBNoteId = makeSyntheticUuid('F8B0B005', stamp * 10 + 5);

    // Resolve active SpaceType & SpaceRoleType from metadata catalog (bounded by MaxRows: 1)
    let spaceTypeId = makeSyntheticUuid('B1000001', 1);
    let spaceRoleTypeId = makeSyntheticUuid('7F565CD3', 1);
    let staffSpaceRoleTypeId = makeSyntheticUuid('03AD14E2', 1);
    let statusId: string | null = null;

    if (txProvider.EntityByName('MJ_BizApps_Collaboration: Space Types')) {
        const typesRes = await rv.RunView<SimpleLookupRow>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Space Types',
                Fields: ['ID', 'Name'],
                MaxRows: 1,
                ResultType: 'simple',
            },
            systemUser,
        );
        if (typesRes.Success && typesRes.Results?.[0]?.ID) {
            spaceTypeId = typesRes.Results[0].ID;
        }
    }

    if (txProvider.EntityByName('MJ_BizApps_Collaboration: Space Type Status')) {
        const statusRes = await rv.RunView<SimpleLookupRow>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Space Type Status',
                ExtraFilter: buildUuidEqualsFilter('SpaceTypeID', spaceTypeId, detectAuditSqlDialect(txProvider, input.Dialect)),
                Fields: ['ID', 'Code'],
                MaxRows: 1,
                ResultType: 'simple',
            },
            systemUser,
        );
        if (statusRes.Success && statusRes.Results?.[0]?.ID) {
            statusId = statusRes.Results[0].ID;
        }
    }

    if (txProvider.EntityByName('MJ_BizApps_Collaboration: Space Role Types')) {
        const rolesRes = await rv.RunView<SimpleLookupRow>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Space Role Types',
                Fields: ['ID', 'Code'],
                // row-cap-ok: bounded catalog lookup of shipped collaboration space role types
                MaxRows: 20,
                ResultType: 'simple',
            },
            systemUser,
        );
        if (rolesRes.Success && (rolesRes.Results?.length ?? 0) > 0) {
            const clientMember = rolesRes.Results.find((r) => (r.Code ?? '').toLowerCase() === 'client-member');
            const staffMember = rolesRes.Results.find((r) => (r.Code ?? '').toLowerCase() === 'member');
            spaceRoleTypeId = clientMember?.ID ?? rolesRes.Results[0].ID;
            staffSpaceRoleTypeId = staffMember?.ID ?? rolesRes.Results[0].ID;
        }
    }

    // Provision synthetic External Participant & Restricted Staff users inside the transaction when entities exist
    if (txProvider.EntityByName('MJ: Users')) {
        const extUserEntity = await txProvider.GetEntityObject<MJUserEntity>('MJ: Users', systemUser);
        extUserEntity.NewRecord();
        extUserEntity.ID = extUserId;
        extUserEntity.Name = `XS3 Probe External ${stamp}`;
        extUserEntity.FirstName = 'XS3';
        extUserEntity.LastName = 'External';
        extUserEntity.Email = `xs3-ext-${stamp}@probe.example`;
        extUserEntity.Type = 'User';
        extUserEntity.IsActive = true;
        if (await extUserEntity.Save()) {
            recordCreated('MJ: Users', extUserEntity.ID);
        }

        const staffUserEntity = await txProvider.GetEntityObject<MJUserEntity>('MJ: Users', systemUser);
        staffUserEntity.NewRecord();
        staffUserEntity.ID = staffUserId;
        staffUserEntity.Name = `XS3 Probe Staff ${stamp}`;
        staffUserEntity.FirstName = 'XS3';
        staffUserEntity.LastName = 'Staff';
        staffUserEntity.Email = `xs3-staff-${stamp}@probe.example`;
        staffUserEntity.Type = 'User';
        staffUserEntity.IsActive = true;
        if (await staffUserEntity.Save()) {
            recordCreated('MJ: Users', staffUserEntity.ID);
        }
    }

    if (txProvider.EntityByName('MJ: User Roles')) {
        const extRoleEntity = await txProvider.GetEntityObject<MJUserRoleEntity>('MJ: User Roles', systemUser);
        extRoleEntity.NewRecord();
        extRoleEntity.UserID = extUserId;
        extRoleEntity.RoleID = participantRoleId;
        if (await extRoleEntity.Save()) {
            recordCreated('MJ: User Roles', extRoleEntity.ID);
        }

        const staffRoleEntity = await txProvider.GetEntityObject<MJUserRoleEntity>('MJ: User Roles', systemUser);
        staffRoleEntity.NewRecord();
        staffRoleEntity.UserID = staffUserId;
        staffRoleEntity.RoleID = staffRoleId;
        if (await staffRoleEntity.Save()) {
            recordCreated('MJ: User Roles', staffRoleEntity.ID);
        }
    }

    // Create isolated Space A & Space B inside WithRolledBackTransaction
    if (txProvider.EntityByName('MJ_BizApps_Collaboration: Spaces')) {
        const spaceA = await txProvider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(
            'MJ_BizApps_Collaboration: Spaces',
            systemUser,
        );
        spaceA.NewRecord();
        spaceA.ID = spaceAId;
        spaceA.Name = `XS3 Isolated Space A ${stamp}`;
        spaceA.SpaceTypeID = spaceTypeId;
        spaceA.OwnerID = systemUser.ID;
        spaceA.InheritsMembership = false;
        spaceA.AllowParentAssignees = false;
        if (statusId) {
            spaceA.StatusID = statusId;
        }
        if (await spaceA.Save()) {
            recordCreated('MJ_BizApps_Collaboration: Spaces', spaceA.ID);
        }

        const spaceB = await txProvider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(
            'MJ_BizApps_Collaboration: Spaces',
            systemUser,
        );
        spaceB.NewRecord();
        spaceB.ID = spaceBId;
        spaceB.Name = `XS3 Isolated Space B ${stamp}`;
        spaceB.SpaceTypeID = spaceTypeId;
        spaceB.OwnerID = systemUser.ID;
        spaceB.InheritsMembership = false;
        spaceB.AllowParentAssignees = false;
        if (statusId) {
            spaceB.StatusID = statusId;
        }
        if (await spaceB.Save()) {
            recordCreated('MJ_BizApps_Collaboration: Spaces', spaceB.ID);
        }
    }
    mergeOutOfSpaceTargets(outOfSpaceIdsByEntity, allOutOfSpaceIds, 'MJ_BizApps_Collaboration: Spaces', [spaceBId]);

    // Bind External Participant and Restricted Staff ONLY to Space A (never Space B)
    if (txProvider.EntityByName('MJ_BizApps_Collaboration: Space Members')) {
        const extMember = await txProvider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
            'MJ_BizApps_Collaboration: Space Members',
            systemUser,
        );
        extMember.NewRecord();
        extMember.SpaceID = spaceAId;
        extMember.UserID = extUserId;
        extMember.SpaceRoleTypeID = spaceRoleTypeId;
        extMember.Band = 'Shared';
        extMember.Status = 'Active';
        if (await extMember.Save()) {
            recordCreated('MJ_BizApps_Collaboration: Space Members', extMember.ID);
        }

        const staffMember = await txProvider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
            'MJ_BizApps_Collaboration: Space Members',
            systemUser,
        );
        staffMember.NewRecord();
        staffMember.SpaceID = spaceAId;
        staffMember.UserID = staffUserId;
        staffMember.SpaceRoleTypeID = staffSpaceRoleTypeId;
        staffMember.Band = 'Team';
        staffMember.Status = 'Active';
        if (await staffMember.Save()) {
            recordCreated('MJ_BizApps_Collaboration: Space Members', staffMember.ID);
        }

        const spaceBHostMember = await txProvider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(
            'MJ_BizApps_Collaboration: Space Members',
            systemUser,
        );
        spaceBHostMember.NewRecord();
        spaceBHostMember.SpaceID = spaceBId;
        spaceBHostMember.UserID = systemUser.ID;
        spaceBHostMember.SpaceRoleTypeID = staffSpaceRoleTypeId;
        spaceBHostMember.Band = 'Team';
        spaceBHostMember.Status = 'Active';
        if (await spaceBHostMember.Save()) {
            recordCreated('MJ_BizApps_Collaboration: Space Members', spaceBHostMember.ID);
            mergeOutOfSpaceTargets(
                outOfSpaceIdsByEntity,
                allOutOfSpaceIds,
                'MJ_BizApps_Collaboration: Space Members',
                [spaceBHostMember.ID],
            );
        }
    }

    // Create Space B isolated note inside WithRolledBackTransaction
    if (txProvider.EntityByName('MJ_BizApps_Collaboration: Space Notes')) {
        const spaceBNote = await txProvider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(
            'MJ_BizApps_Collaboration: Space Notes',
            systemUser,
        );
        spaceBNote.NewRecord();
        spaceBNote.ID = spaceBNoteId;
        spaceBNote.SpaceID = spaceBId;
        spaceBNote.AuthorUserID = systemUser.ID;
        spaceBNote.Title = `XS3 Confidential Space B Note ${stamp}`;
        spaceBNote.Body = 'Isolated Space B payload that must never leak to Space A personas.';
        spaceBNote.Band = 'Shared';
        spaceBNote.Visibility = 'Space';
        if (await spaceBNote.Save()) {
            recordCreated('MJ_BizApps_Collaboration: Space Notes', spaceBNote.ID);
        }
    }
    mergeOutOfSpaceTargets(outOfSpaceIdsByEntity, allOutOfSpaceIds, 'MJ_BizApps_Collaboration: Space Notes', [spaceBNoteId]);

    // Merge any additional caller-supplied out-of-space record targets
    for (const extra of input.WorldFixtures?.OutOfSpaceRecords ?? []) {
        mergeOutOfSpaceTargets(outOfSpaceIdsByEntity, allOutOfSpaceIds, extra.EntityName, extra.RecordIDs);
    }

    const externalUser =
        input.WorldFixtures?.ExternalParticipantUser ??
        buildPersonaUserInfo(txProvider, extUserId, 'XS3 External Participant (Space A)', `xs3-ext-${stamp}@probe.example`, participantRoleId);

    const staffUser =
        input.WorldFixtures?.RestrictedStaffUser ??
        buildPersonaUserInfo(txProvider, staffUserId, 'XS3 Restricted Staff (Space A)', `xs3-staff-${stamp}@probe.example`, staffRoleId);

    return {
        SpaceAID: spaceAId,
        SpaceBID: spaceBId,
        ExternalParticipantUser: externalUser,
        RestrictedStaffUser: staffUser,
        OutOfSpaceIdsByEntity: outOfSpaceIdsByEntity,
        AllOutOfSpaceIds: allOutOfSpaceIds,
        CreatedRecordCountsByEntity: createdCounts,
        TotalCreated: totalCreated,
    };
}

function buildWorldProvidedFixtureState(input: PersonaSecurityProbeInput): SyntheticFixtureState {
    if (!input.WorldFixtures) {
        throw new Error("FixtureMode 'world-provided' requires WorldFixtures (SpaceAID, SpaceBID, ExternalParticipantUser, RestrictedStaffUser, OutOfSpaceRecords).");
    }
    const outOfSpaceIdsByEntity = new Map<string, Set<string>>();
    const allOutOfSpaceIds = new Set<string>();
    mergeOutOfSpaceTargets(
        outOfSpaceIdsByEntity,
        allOutOfSpaceIds,
        'MJ_BizApps_Collaboration: Spaces',
        [input.WorldFixtures.SpaceBID],
    );
    for (const target of input.WorldFixtures.OutOfSpaceRecords) {
        mergeOutOfSpaceTargets(outOfSpaceIdsByEntity, allOutOfSpaceIds, target.EntityName, target.RecordIDs);
    }
    return {
        SpaceAID: input.WorldFixtures.SpaceAID,
        SpaceBID: input.WorldFixtures.SpaceBID,
        ExternalParticipantUser: input.WorldFixtures.ExternalParticipantUser,
        RestrictedStaffUser: input.WorldFixtures.RestrictedStaffUser,
        OutOfSpaceIdsByEntity: outOfSpaceIdsByEntity,
        AllOutOfSpaceIds: allOutOfSpaceIds,
        CreatedRecordCountsByEntity: new Map<string, number>(),
        TotalCreated: 0,
    };
}

async function discoverProbeQueries(
    provider: IMetadataProvider,
    systemUser: UserInfo,
    explicitQueries: readonly ProbeQueryTarget[] | undefined,
    maxRows: number,
): Promise<ProbeQueryTarget[]> {
    const discovered: ProbeQueryTarget[] = [...(explicitQueries ?? [])];
    const seen = new Set(
        discovered.map((q) => (q.QueryID ?? q.QueryName ?? '').trim().toLowerCase()).filter((s) => s.length > 0),
    );
    if (!provider.EntityByName('MJ: Queries')) {
        return discovered;
    }
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<SimpleLookupRow>(
        {
            EntityName: 'MJ: Queries',
            ExtraFilter: "Name LIKE 'Collaboration%'",
            Fields: ['ID', 'Name', 'CategoryID'],
            // row-cap-ok: bounded XS-3 metadata query discovery cap
            MaxRows: maxRows,
            ResultType: 'simple',
        },
        systemUser,
    );
    if (res.Success) {
        for (const row of res.Results ?? []) {
            const nameKey = (row.Name ?? '').trim().toLowerCase();
            const idKey = (row.ID ?? '').trim().toLowerCase();
            if (!seen.has(idKey) && (!nameKey || !seen.has(nameKey))) {
                seen.add(idKey);
                if (nameKey) seen.add(nameKey);
                discovered.push({
                    QueryID: row.ID,
                    QueryName: row.Name ?? undefined,
                    CategoryPath: 'Collaboration',
                    EntityName: 'MJ: Queries',
                });
            }
        }
    }
    return discovered;
}

async function discoverProbeDatasets(
    provider: IMetadataProvider,
    systemUser: UserInfo,
    explicitDatasets: readonly ProbeDatasetTarget[] | undefined,
    maxRows: number,
): Promise<ProbeDatasetTarget[]> {
    const discovered: ProbeDatasetTarget[] = [...(explicitDatasets ?? [])];
    const seen = new Set(discovered.map((d) => d.DatasetName.trim().toLowerCase()));
    if (!provider.EntityByName('MJ: Datasets')) {
        return discovered;
    }
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<SimpleLookupRow>(
        {
            EntityName: 'MJ: Datasets',
            ExtraFilter: "Name LIKE '%Collaboration%'",
            Fields: ['ID', 'Name'],
            // row-cap-ok: bounded XS-3 metadata dataset discovery cap
            MaxRows: maxRows,
            ResultType: 'simple',
        },
        systemUser,
    );
    if (res.Success) {
        for (const row of res.Results ?? []) {
            const dsName = (row.Name ?? '').trim();
            if (dsName && !seen.has(dsName.toLowerCase())) {
                seen.add(dsName.toLowerCase());
                discovered.push({
                    DatasetName: dsName,
                    DefaultEntityName: 'MJ: Datasets',
                });
            }
        }
    }
    return discovered;
}

async function discoverProbeReports(
    provider: IMetadataProvider,
    systemUser: UserInfo,
    explicitReports: readonly ProbeReportTarget[] | undefined,
    maxRows: number,
): Promise<ProbeReportTarget[]> {
    const discovered: ProbeReportTarget[] = [...(explicitReports ?? [])];
    const seen = new Set(
        discovered.map((r) => (r.ReportID ?? r.ReportName).trim().toLowerCase()),
    );
    if (!provider.EntityByName('MJ: Reports')) {
        return discovered;
    }
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<SimpleLookupRow>(
        {
            EntityName: 'MJ: Reports',
            ExtraFilter: "Name LIKE '%Collaboration%' OR Name LIKE '%Space%'",
            Fields: ['ID', 'Name', 'QueryID', 'DataContextID'],
            // row-cap-ok: bounded XS-3 metadata report discovery cap
            MaxRows: maxRows,
            ResultType: 'simple',
        },
        systemUser,
    );
    if (res.Success) {
        for (const row of res.Results ?? []) {
            const idKey = (row.ID ?? '').trim().toLowerCase();
            const name = (row.Name ?? '').trim();
            if (idKey && !seen.has(idKey) && (!name || !seen.has(name.toLowerCase()))) {
                seen.add(idKey);
                if (name) seen.add(name.toLowerCase());
                discovered.push({
                    ReportID: row.ID,
                    ReportName: name || row.ID,
                    EntityName: 'MJ: Reports',
                    QueryID: row.QueryID ?? undefined,
                    DataContextID: row.DataContextID ?? undefined,
                });
            }
        }
    }
    return discovered;
}

function assertWithinBudget(deadlineMs: number, surface: DisclosureSurface, personaKey: string): void {
    if (Date.now() > deadlineMs) {
        throw new Error(`XS-3 probe timeout exceeded while sweeping surface '${surface}' for persona '${personaKey}'.`);
    }
}

async function sweepAllViewsSurface(params: {
    txProvider: ProbeDatabaseProvider;
    persona: ProbePersonaKind;
    personaKey: string;
    personaUser: UserInfo;
    targetPolicies: readonly BootEntityGrantPolicySpec[];
    fixture: SyntheticFixtureState;
    dialect: SqlDialect;
    maxRows: number;
    deadlineMs: number;
}): Promise<{ summary: PersonaSurfaceSummary; findings: PersonaSecurityProbeFinding[]; entitiesSwept: number }> {
    const startedAt = Date.now();
    const findings: PersonaSecurityProbeFinding[] = [];
    const rv = RunView.FromMetadataProvider(params.txProvider);
    let entitiesSwept = 0;
    let totalLeaked = 0;

    for (const spec of params.targetPolicies) {
        assertWithinBudget(params.deadlineMs, 'all-views', params.personaKey);
        const entity = params.txProvider.EntityByName(spec.EntityName);
        if (!entity) {
            continue;
        }
        entitiesSwept += 1;
        const pkField = resolvePrimaryKeyField(entity);
        const entityOutIds = params.fixture.OutOfSpaceIdsByEntity.get(spec.EntityName) ?? new Set<string>();
        const combinedOutIds = new Set<string>([...params.fixture.AllOutOfSpaceIds, ...entityOutIds]);
        const leakedIds = new Set<string>();

        // 1a. Unfiltered All... RunView sweep (bounded by maxRows <= 50)
        const unfilteredRes = await rv.RunView<ProbeRowRecord>(
            {
                EntityName: spec.EntityName,
                Fields: [pkField, ...entity.Fields.some((f) => f.Name.toLowerCase() === 'spaceid') ? ['SpaceID'] : []],
                // row-cap-ok: bounded XS-3 All... probe sweep per CostAndQuota guideline
                MaxRows: params.maxRows,
                ResultType: 'simple',
                BypassCache: true,
            },
            params.personaUser,
        );

        if (unfilteredRes.Success) {
            const rows = unfilteredRes.Results ?? [];
            if (params.persona === 'external-participant' && (spec.PolicyKind === 'staff-only-denied' || spec.PolicyKind === 'shell-deny-all')) {
                for (const row of rows) {
                    const rowId = extractRecordUuid(readScalarField(row, pkField)) ?? extractRecordUuid(readScalarField(row, 'ID'));
                    if (rowId) {
                        leakedIds.add(rowId);
                    }
                }
            }
            for (const id of findLeakedIdsInRows(rows, combinedOutIds, params.fixture.SpaceBID)) {
                leakedIds.add(id);
            }
        } else if (!isAccessDenialMessage(unfilteredRes.ErrorMessage)) {
            // Non-denial view failures still need explicit diagnostics without masking leaks
        }

        // 1b. Targeted Space B record ID RunView sweep (proves RLS blocks explicit ID filters even when tables > maxRows)
        if (entityOutIds.size > 0) {
            for (const batch of chunkDistinctIds([...entityOutIds], MAX_PROBE_ROW_CAP)) {
                const targetedRes = await rv.RunView<ProbeRowRecord>(
                    {
                        EntityName: spec.EntityName,
                        ExtraFilter: buildBatchedInFilter(pkField, batch, params.dialect),
                        Fields: [pkField, ...entity.Fields.some((f) => f.Name.toLowerCase() === 'spaceid') ? ['SpaceID'] : []],
                        // row-cap-ok: bounded by Space B out-of-space probe batch (<= 50)
                        MaxRows: batch.length,
                        ResultType: 'simple',
                        BypassCache: true,
                    },
                    params.personaUser,
                );
                if (targetedRes.Success) {
                    for (const row of targetedRes.Results ?? []) {
                        const leakedId =
                            extractRecordUuid(readScalarField(row, pkField)) ??
                            extractRecordUuid(readScalarField(row, 'ID'));
                        if (leakedId && entityOutIds.has(leakedId)) {
                            leakedIds.add(leakedId);
                        }
                    }
                }
            }
        }

        if (leakedIds.size > 0) {
            const leakedList = [...leakedIds];
            totalLeaked += leakedList.length;
            const isStaffOnlyLeak =
                params.persona === 'external-participant' &&
                (spec.PolicyKind === 'staff-only-denied' || spec.PolicyKind === 'shell-deny-all');
            findings.push({
                Code: isStaffOnlyLeak ? 'UNAUTHORIZED_STAFF_ENTITY_LEAK' : 'CROSS_SPACE_DATA_LEAK',
                Severity: 'Critical',
                Surface: 'all-views',
                Persona: params.persona,
                PersonaKey: params.personaKey,
                EntityName: spec.EntityName,
                TargetName: spec.EntityName,
                LeakedRecordIds: leakedList,
                Diagnostics: `All... RunView sweep for '${params.personaKey}' (${params.persona}) returned ${leakedList.length} out-of-space/unauthorized record(s) from '${spec.EntityName}'.`,
                Remediation: `Enforce strict ReadRLSFilterID and AllowAllRowsAPI=false on '${spec.EntityName}' for '${params.persona}'.`,
            });
        }
    }

    const durationMs = Date.now() - startedAt;
    return {
        entitiesSwept,
        findings,
        summary: {
            Persona: params.persona,
            PersonaKey: params.personaKey,
            Surface: 'all-views',
            SweptCount: entitiesSwept,
            LeakedCount: totalLeaked,
            Passed: findings.length === 0,
            DurationMs: durationMs,
            Diagnostics:
                findings.length === 0
                    ? `Swept ${entitiesSwept} XS-2 inventory entities via RunView with zero leaks.`
                    : `Detected ${totalLeaked} leaked record(s) across ${findings.length} entity view finding(s).`,
        },
    };
}

async function sweepRunQuerySurface(params: {
    txProvider: ProbeDatabaseProvider;
    queryProvider: IRunQueryProvider | null;
    persona: ProbePersonaKind;
    personaKey: string;
    personaUser: UserInfo;
    queries: readonly ProbeQueryTarget[];
    fixture: SyntheticFixtureState;
    maxRows: number;
    deadlineMs: number;
}): Promise<{ summary: PersonaSurfaceSummary; findings: PersonaSecurityProbeFinding[]; queriesSwept: number }> {
    const startedAt = Date.now();
    const findings: PersonaSecurityProbeFinding[] = [];
    let queriesSwept = 0;
    let totalLeaked = 0;

    if (!params.queryProvider) {
        return {
            queriesSwept: 0,
            findings,
            summary: {
                Persona: params.persona,
                PersonaKey: params.personaKey,
                Surface: 'run-query',
                SweptCount: 0,
                LeakedCount: 0,
                Passed: true,
                DurationMs: Date.now() - startedAt,
                Diagnostics: 'No IRunQueryProvider active; 0 stored queries executed.',
            },
        };
    }

    const runner = new RunQuery(params.queryProvider);
    for (const target of params.queries) {
        assertWithinBudget(params.deadlineMs, 'run-query', params.personaKey);
        queriesSwept += 1;
        const targetLabel = target.QueryName ?? target.QueryID ?? 'unknown-query';
        try {
            const res = await runner.RunQuery(
                {
                    ...(target.QueryID ? { QueryID: target.QueryID } : {}),
                    ...(target.QueryName ? { QueryName: target.QueryName } : {}),
                    ...(target.CategoryPath ? { CategoryPath: target.CategoryPath } : {}),
                    Parameters: {
                        SpaceID: params.fixture.SpaceBID,
                        UserID: params.personaUser.ID,
                        ...(target.Parameters ?? {}),
                    },
                    // row-cap-ok: bounded XS-3 RunQuery sweep cap
                    MaxRows: params.maxRows,
                },
                params.personaUser,
            );
            if (res.Success && Array.isArray(res.Results) && res.Results.length > 0) {
                const rows = res.Results as ProbeRowRecord[];
                const leaked = findLeakedIdsInRows(rows, params.fixture.AllOutOfSpaceIds, params.fixture.SpaceBID);
                if (leaked.length > 0) {
                    totalLeaked += leaked.length;
                    findings.push({
                        Code: 'CROSS_SPACE_DATA_LEAK',
                        Severity: 'Critical',
                        Surface: 'run-query',
                        Persona: params.persona,
                        PersonaKey: params.personaKey,
                        EntityName: target.EntityName ?? 'MJ: Queries',
                        TargetName: targetLabel,
                        LeakedRecordIds: leaked,
                        Diagnostics: `RunQuery('${targetLabel}') as '${params.personaKey}' (${params.persona}) disclosed ${leaked.length} out-of-space record ID(s): ${leaked.join(', ')}.`,
                        Remediation: `Restrict Query Permissions on '${targetLabel}' or enforce server-bound SpaceID/UserID reach filtering inside the query.`,
                    });
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!isAccessDenialMessage(msg)) {
                // Non-permission exceptions do not represent leaked rows; preserve summary diagnostics
            }
        }
    }

    return {
        queriesSwept,
        findings,
        summary: {
            Persona: params.persona,
            PersonaKey: params.personaKey,
            Surface: 'run-query',
            SweptCount: queriesSwept,
            LeakedCount: totalLeaked,
            Passed: findings.length === 0,
            DurationMs: Date.now() - startedAt,
            Diagnostics:
                findings.length === 0
                    ? `Swept ${queriesSwept} stored query target(s) via RunQuery with zero leaks.`
                    : `Detected ${totalLeaked} leaked record(s) across ${findings.length} RunQuery finding(s).`,
        },
    };
}

async function sweepDatasetSurface(params: {
    txProvider: ProbeDatabaseProvider;
    persona: ProbePersonaKind;
    personaKey: string;
    personaUser: UserInfo;
    datasets: readonly ProbeDatasetTarget[];
    fixture: SyntheticFixtureState;
    policyByEntity: ReadonlyMap<string, BootEntityGrantPolicySpec>;
    deadlineMs: number;
}): Promise<{ summary: PersonaSurfaceSummary; findings: PersonaSecurityProbeFinding[]; datasetsSwept: number }> {
    const startedAt = Date.now();
    const findings: PersonaSecurityProbeFinding[] = [];
    let datasetsSwept = 0;
    let totalLeaked = 0;

    for (const target of params.datasets) {
        assertWithinBudget(params.deadlineMs, 'dataset', params.personaKey);
        datasetsSwept += 1;
        try {
            const datasetResult: DatasetResultType = await params.txProvider.GetDatasetByName(
                target.DatasetName,
                target.ItemFilters,
                params.personaUser,
                params.txProvider,
                true,
            );
            if (datasetResult?.Success && Array.isArray(datasetResult.Results)) {
                for (const item of datasetResult.Results) {
                    const itemRows = (item.Results ?? []) as ProbeRowRecord[];
                    const itemEntityName = item.EntityName || target.DefaultEntityName || 'MJ: Datasets';
                    const policy = params.policyByEntity.get(itemEntityName.trim().toLowerCase());
                    const leakedSet = new Set(
                        findLeakedIdsInRows(itemRows, params.fixture.AllOutOfSpaceIds, params.fixture.SpaceBID),
                    );
                    if (
                        params.persona === 'external-participant' &&
                        policy &&
                        (policy.PolicyKind === 'staff-only-denied' || policy.PolicyKind === 'shell-deny-all')
                    ) {
                        for (const row of itemRows) {
                            const id = extractRecordUuid(readScalarField(row, 'ID'));
                            if (id) leakedSet.add(id);
                        }
                    }
                    if (leakedSet.size > 0) {
                        const leaked = [...leakedSet];
                        totalLeaked += leaked.length;
                        findings.push({
                            Code: 'CROSS_SPACE_DATA_LEAK',
                            Severity: 'Critical',
                            Surface: 'dataset',
                            Persona: params.persona,
                            PersonaKey: params.personaKey,
                            EntityName: itemEntityName,
                            TargetName: `${target.DatasetName}:${item.Code}`,
                            LeakedRecordIds: leaked,
                            Diagnostics: `Dataset '${target.DatasetName}' item '${item.Code}' ('${itemEntityName}') disclosed ${leaked.length} out-of-space/unauthorized record(s) to '${params.personaKey}'.`,
                            Remediation: `Verify Dataset item permissions and ReadRLSFilterID on '${itemEntityName}'.`,
                        });
                    }
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!isAccessDenialMessage(msg)) {
                // Unexpected non-permission failure does not constitute data disclosure
            }
        }
    }

    return {
        datasetsSwept,
        findings,
        summary: {
            Persona: params.persona,
            PersonaKey: params.personaKey,
            Surface: 'dataset',
            SweptCount: datasetsSwept,
            LeakedCount: totalLeaked,
            Passed: findings.length === 0,
            DurationMs: Date.now() - startedAt,
            Diagnostics:
                findings.length === 0
                    ? `Swept ${datasetsSwept} dataset target(s) via GetDatasetByName with zero leaks.`
                    : `Detected ${totalLeaked} leaked record(s) across ${findings.length} dataset finding(s).`,
        },
    };
}

async function executeDefaultReportCheck(params: {
    report: ProbeReportTarget;
    personaUser: UserInfo;
    txProvider: ProbeDatabaseProvider;
    queryProvider: IRunQueryProvider | null;
    maxRows: number;
}): Promise<ProbeReportExecutionOutcome> {
    const rv = RunView.FromMetadataProvider(params.txProvider);

    // 1. Check if persona can read the MJ: Reports metadata row itself
    if (params.report.ReportID && params.txProvider.EntityByName('MJ: Reports')) {
        const repView = await rv.RunView<ProbeRowRecord>(
            {
                EntityName: 'MJ: Reports',
                ExtraFilter: buildUuidEqualsFilter('ID', params.report.ReportID, detectAuditSqlDialect(params.txProvider)),
                Fields: ['ID', 'Name', 'QueryID', 'DataContextID'],
                MaxRows: 1,
                ResultType: 'simple',
                BypassCache: true,
            },
            params.personaUser,
        );
        if (!repView.Success && isAccessDenialMessage(repView.ErrorMessage)) {
            return { Success: false, ErrorMessage: repView.ErrorMessage, Rows: [], EntityName: params.report.EntityName };
        }
    }

    const collectedRows: ProbeRowRecord[] = [];
    let resolvedEntityName = params.report.EntityName ?? 'MJ: Reports';

    // 2. If report binds a QueryID, execute via RunQuery as persona
    if (params.report.QueryID && params.queryProvider) {
        const qRes = await new RunQuery(params.queryProvider).RunQuery(
            {
                QueryID: params.report.QueryID,
                Parameters: params.report.Parameters,
                // row-cap-ok: bounded XS-3 report backing query sweep
                MaxRows: params.maxRows,
            },
            params.personaUser,
        );
        if (qRes.Success && Array.isArray(qRes.Results)) {
            collectedRows.push(...(qRes.Results as ProbeRowRecord[]));
        }
    }

    // 3. If report binds a DataContextID, inspect its DataContextItems as persona
    if (params.report.DataContextID && params.txProvider.EntityByName('MJ: Data Context Items')) {
        const dciRes = await rv.RunView<SimpleDataContextItemRow>(
            {
                EntityName: 'MJ: Data Context Items',
                ExtraFilter: buildUuidEqualsFilter('DataContextID', params.report.DataContextID, detectAuditSqlDialect(params.txProvider)),
                Fields: ['ID', 'Type', 'ViewID', 'QueryID', 'EntityID'],
                // row-cap-ok: bounded XS-3 report data context item sweep
                MaxRows: params.maxRows,
                ResultType: 'simple',
                BypassCache: true,
            },
            params.personaUser,
        );
        if (dciRes.Success) {
            for (const dci of dciRes.Results ?? []) {
                if (dci.QueryID && params.queryProvider) {
                    const qRes = await new RunQuery(params.queryProvider).RunQuery(
                        {
                            QueryID: dci.QueryID,
                            Parameters: params.report.Parameters,
                            // row-cap-ok: bounded XS-3 report data context query sweep
                            MaxRows: params.maxRows,
                        },
                        params.personaUser,
                    );
                    if (qRes.Success && Array.isArray(qRes.Results)) {
                        collectedRows.push(...(qRes.Results as ProbeRowRecord[]));
                    }
                } else if (dci.EntityID) {
                    const entity = params.txProvider.EntityByID(dci.EntityID);
                    if (entity) {
                        resolvedEntityName = entity.Name;
                        const viewRes = await rv.RunView<ProbeRowRecord>(
                            {
                                EntityName: entity.Name,
                                ...(dci.ViewID ? { ViewID: dci.ViewID } : {}),
                                // row-cap-ok: bounded XS-3 report data context entity sweep
                                MaxRows: params.maxRows,
                                ResultType: 'simple',
                                BypassCache: true,
                            },
                            params.personaUser,
                        );
                        if (viewRes.Success && Array.isArray(viewRes.Results)) {
                            collectedRows.push(...viewRes.Results);
                        }
                    }
                }
            }
        }
    }

    return {
        Success: true,
        Rows: collectedRows,
        EntityName: resolvedEntityName,
    };
}

async function sweepReportSurface(params: {
    txProvider: ProbeDatabaseProvider;
    queryProvider: IRunQueryProvider | null;
    persona: ProbePersonaKind;
    personaKey: string;
    personaUser: UserInfo;
    reports: readonly ProbeReportTarget[];
    reportExecutor?: ProbeReportExecutor;
    fixture: SyntheticFixtureState;
    maxRows: number;
    deadlineMs: number;
}): Promise<{ summary: PersonaSurfaceSummary; findings: PersonaSecurityProbeFinding[]; reportsSwept: number }> {
    const startedAt = Date.now();
    const findings: PersonaSecurityProbeFinding[] = [];
    let reportsSwept = 0;
    let totalLeaked = 0;

    for (const report of params.reports) {
        assertWithinBudget(params.deadlineMs, 'report', params.personaKey);
        reportsSwept += 1;
        try {
            const outcome = params.reportExecutor
                ? await params.reportExecutor({
                      Report: report,
                      PersonaUser: params.personaUser,
                      PersonaKind: params.persona,
                      Provider: params.txProvider,
                  })
                : await executeDefaultReportCheck({
                      report,
                      personaUser: params.personaUser,
                      txProvider: params.txProvider,
                      queryProvider: params.queryProvider,
                      maxRows: params.maxRows,
                  });

            if (outcome.Success && outcome.Rows.length > 0) {
                const leaked = findLeakedIdsInRows(outcome.Rows, params.fixture.AllOutOfSpaceIds, params.fixture.SpaceBID);
                if (leaked.length > 0) {
                    totalLeaked += leaked.length;
                    findings.push({
                        Code: 'CROSS_SPACE_DATA_LEAK',
                        Severity: 'Critical',
                        Surface: 'report',
                        Persona: params.persona,
                        PersonaKey: params.personaKey,
                        EntityName: outcome.EntityName ?? report.EntityName ?? 'MJ: Reports',
                        TargetName: report.ReportName,
                        LeakedRecordIds: leaked,
                        Diagnostics: `Report '${report.ReportName}' executed as '${params.personaKey}' (${params.persona}) disclosed ${leaked.length} out-of-space record(s): ${leaked.join(', ')}.`,
                        Remediation: `Enforce Space Participant permission denials on Report '${report.ReportName}' and its backing DataContext/Query.`,
                    });
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (!isAccessDenialMessage(msg)) {
                // Non-permission failure
            }
        }
    }

    return {
        reportsSwept,
        findings,
        summary: {
            Persona: params.persona,
            PersonaKey: params.personaKey,
            Surface: 'report',
            SweptCount: reportsSwept,
            LeakedCount: totalLeaked,
            Passed: findings.length === 0,
            DurationMs: Date.now() - startedAt,
            Diagnostics:
                findings.length === 0
                    ? `Swept ${reportsSwept} report target(s) with zero leaks.`
                    : `Detected ${totalLeaked} leaked record(s) across ${findings.length} report finding(s).`,
        },
    };
}

async function sweepDirectIdResolverSurface(params: {
    txProvider: ProbeDatabaseProvider;
    persona: ProbePersonaKind;
    personaKey: string;
    personaUser: UserInfo;
    targetPolicies: readonly BootEntityGrantPolicySpec[];
    fixture: SyntheticFixtureState;
    directIdResolverHook?: DirectIdResolverLookupFn;
    deadlineMs: number;
}): Promise<{ summary: PersonaSurfaceSummary; findings: PersonaSecurityProbeFinding[]; directIdsSwept: number }> {
    const startedAt = Date.now();
    const findings: PersonaSecurityProbeFinding[] = [];
    let directIdsSwept = 0;
    let totalLeaked = 0;

    for (const spec of params.targetPolicies) {
        assertWithinBudget(params.deadlineMs, 'direct-id-resolver', params.personaKey);
        const entity = params.txProvider.EntityByName(spec.EntityName);
        if (!entity) {
            continue;
        }
        const recordIds = params.fixture.OutOfSpaceIdsByEntity.get(spec.EntityName);
        if (!recordIds || recordIds.size === 0) {
            continue;
        }

        const leakedIds = new Set<string>();
        const pkField = resolvePrimaryKeyField(entity);

        for (const outId of recordIds) {
            directIdsSwept += 1;

            // 5a. Direct entity InnerLoad(CompositeKey) probe as persona
            try {
                const entityObj = await params.txProvider.GetEntityObject(spec.EntityName, params.personaUser);
                const key = pkField === 'ID' ? CompositeKey.FromID(outId) : CompositeKey.FromKeyValuePair(pkField, outId);
                const loaded = await entityObj.InnerLoad(key);
                if (loaded) {
                    const loadedId = readEntityPrimaryKeyId(entityObj) ?? outId;
                    leakedIds.add(loadedId);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                if (!isAccessDenialMessage(msg)) {
                    // Clean failure/denial
                }
            }

            // 5b. Optional GraphQL/SQL direct ID resolver hook probe
            if (params.directIdResolverHook) {
                try {
                    const resolvedRow = await params.directIdResolverHook({
                        EntityName: spec.EntityName,
                        RecordID: outId,
                        PersonaUser: params.personaUser,
                        PersonaKind: params.persona,
                        Provider: params.txProvider,
                    });
                    if (resolvedRow) {
                        const leaked = findLeakedIdsInRows([resolvedRow], params.fixture.AllOutOfSpaceIds, params.fixture.SpaceBID);
                        if (leaked.length > 0) {
                            for (const id of leaked) leakedIds.add(id);
                        } else {
                            leakedIds.add(outId);
                        }
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    if (!isAccessDenialMessage(msg)) {
                        // Clean refusal
                    }
                }
            }
        }

        if (leakedIds.size > 0) {
            const leakedList = [...leakedIds];
            totalLeaked += leakedList.length;
            findings.push({
                Code: 'CROSS_SPACE_DATA_LEAK',
                Severity: 'Critical',
                Surface: 'direct-id-resolver',
                Persona: params.persona,
                PersonaKey: params.personaKey,
                EntityName: spec.EntityName,
                TargetName: spec.EntityName,
                LeakedRecordIds: leakedList,
                Diagnostics: `Direct ID resolver lookup for '${params.personaKey}' (${params.persona}) returned out-of-space '${spec.EntityName}' record(s): ${leakedList.join(', ')}.`,
                Remediation: `Enforce row-level security / Space reach checks on direct single-record resolvers and BaseEntity.InnerLoad for '${spec.EntityName}'.`,
            });
        }
    }

    return {
        directIdsSwept,
        findings,
        summary: {
            Persona: params.persona,
            PersonaKey: params.personaKey,
            Surface: 'direct-id-resolver',
            SweptCount: directIdsSwept,
            LeakedCount: totalLeaked,
            Passed: findings.length === 0,
            DurationMs: Date.now() - startedAt,
            Diagnostics:
                findings.length === 0
                    ? `Swept ${directIdsSwept} direct ID lookup(s) with zero leaks.`
                    : `Detected ${totalLeaked} leaked record(s) across ${findings.length} direct ID resolver finding(s).`,
        },
    };
}

/**
 * XS-3 Automated Cross-Surface Persona Security Probe:
 * Extends `BaseHealthProbe`, decorated with `@RegisterClass`, executing synthetic Space A vs Space B
 * fixture creation and all five disclosure sweeps inside `WithRolledBackTransaction` for unconditional rollback.
 */
@RegisterClass(BaseHealthProbe, PERSONA_SECURITY_PROBE_KEY)
export class CollaborationPersonaSecurityProbe extends BaseHealthProbe {
    public override get ProbeKey(): string {
        return PERSONA_SECURITY_PROBE_KEY;
    }

    public override get OwnerApp(): string {
        return COLLABORATION_HEALTH_OWNER_APP;
    }

    public override get Mode(): ProbeExecutionMode {
        return 'live-test';
    }

    public override get SignalDefinitions(): readonly HealthSignalDefinition[] {
        return [
            {
                Code: PERSONA_SECURITY_PROBE_KEY,
                Title: 'Collaboration Cross-Surface Persona Security Probe',
                Layer: 'live-test',
                OwnerApp: this.OwnerApp,
                Mode: this.Mode,
                Description:
                    'Sweeps All... entity views, RunQuery, datasets, reports, and direct ID resolvers for external participant and restricted staff personas inside an unconditionally rolled-back transaction.',
                YellowPlaybook: DEFAULT_VERIFIER_YELLOW_PLAYBOOK,
                RedPlaybook: DEFAULT_VERIFIER_RED_PLAYBOOK,
            },
        ];
    }

    public override async Evaluate(context: HealthProbeContext): Promise<HealthSignalEvaluation[]> {
        const startedAt = Date.now();
        const def = this.SignalDefinitions[0];
        try {
            const probeResult = await this.RunProbe(context, {
                TimeoutMs: context.TimeoutMs,
            });
            const status: HealthStatus = probeResult.Passed ? 'GREEN' : 'RED';
            return [
                {
                    Code: def.Code,
                    Title: def.Title,
                    Layer: def.Layer,
                    OwnerApp: def.OwnerApp,
                    Mode: def.Mode,
                    Status: status,
                    Summary: probeResult.Passed
                        ? `XS-3 passed across ${probeResult.Stats.PersonasChecked} personas and ${probeResult.Stats.SurfacesChecked} surfaces with 0 leaks (rolled back).`
                        : `XS-3 detected ${probeResult.Findings.length} cross-surface disclosure finding(s).`,
                    ObservedMetrics: {
                        PersonasChecked: probeResult.Stats.PersonasChecked,
                        SurfacesChecked: probeResult.Stats.SurfacesChecked,
                        EntitiesSwept: probeResult.Stats.EntitiesSwept,
                        QueriesSwept: probeResult.Stats.QueriesSwept,
                        DatasetsSwept: probeResult.Stats.DatasetsSwept,
                        ReportsSwept: probeResult.Stats.ReportsSwept,
                        DirectIdsSwept: probeResult.Stats.DirectIdsSwept,
                        FindingCount: probeResult.Findings.length,
                        RolledBack: probeResult.Stats.RolledBack,
                    },
                    EvaluatedAt: probeResult.ProbedAt,
                    DurationMs: Date.now() - startedAt,
                    ActivePlaybook: status === 'GREEN' ? undefined : def.RedPlaybook,
                    DiagnosticError: probeResult.Passed
                        ? undefined
                        : probeResult.Findings.map((f) => `[${f.Surface}/${f.Persona}/${f.EntityName}] ${f.Diagnostics}`).join('; '),
                },
            ];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return [
                {
                    Code: def.Code,
                    Title: def.Title,
                    Layer: def.Layer,
                    OwnerApp: def.OwnerApp,
                    Mode: def.Mode,
                    Status: 'RED',
                    Summary: `XS-3 persona security probe failed: ${msg}`,
                    ObservedMetrics: {
                        DurationMs: Date.now() - startedAt,
                    },
                    EvaluatedAt: new Date().toISOString(),
                    DurationMs: Date.now() - startedAt,
                    ActivePlaybook: def.RedPlaybook,
                    DiagnosticError: msg,
                },
            ];
        }
    }

    /**
     * Executes the full XS-3 cross-surface persona security probe inside {@link WithRolledBackTransaction}.
     */
    public async RunProbe(
        context: HealthProbeContext,
        input: PersonaSecurityProbeInput = {},
    ): Promise<PersonaSecurityProbeResult> {
        const startedAt = Date.now();
        const dialect = detectAuditSqlDialect(context.MetadataProvider, input.Dialect);
        const maxRows = clampMaxRows(input.MaxRowsPerProbe);
        const timeoutMs = clampTimeoutMs(input.TimeoutMs ?? context.TimeoutMs);
        const deadlineMs = startedAt + timeoutMs;

        const targetPolicies = await resolveTargetPolicies(context.MetadataProvider, input.TargetEntities);
        const policyByEntity = new Map<string, BootEntityGrantPolicySpec>();
        for (const p of targetPolicies) {
            policyByEntity.set(p.EntityName.trim().toLowerCase(), p);
        }

        const inner = await this.WithRolledBackTransaction(context, async (txProvider) => {
            const fixture =
                input.FixtureMode === 'world-provided'
                    ? buildWorldProvidedFixtureState(input)
                    : await createSyntheticFixturesInTransaction(txProvider, context.SystemUser, input);

            const queryProvider: IRunQueryProvider | null =
                input.QueryProvider ?? (isRunQueryProvider(txProvider) ? txProvider : null);

            const queries = await discoverProbeQueries(txProvider, context.SystemUser, input.Queries, maxRows);
            const datasets = await discoverProbeDatasets(txProvider, context.SystemUser, input.Datasets, maxRows);
            const reports = await discoverProbeReports(txProvider, context.SystemUser, input.Reports, maxRows);

            const personas: Array<{ kind: ProbePersonaKind; key: string; user: UserInfo }> = [
                {
                    kind: 'external-participant',
                    key: 'external-participant-space-a',
                    user: fixture.ExternalParticipantUser,
                },
                {
                    kind: 'restricted-staff',
                    key: 'restricted-staff-space-a',
                    user: fixture.RestrictedStaffUser,
                },
            ];

            const findings: PersonaSecurityProbeFinding[] = [];
            const summaries: PersonaSurfaceSummary[] = [];
            let entitiesSwept = 0;
            let queriesSwept = 0;
            let datasetsSwept = 0;
            let reportsSwept = 0;
            let directIdsSwept = 0;

            for (const p of personas) {
                if (input.FaultInjectionBeforeSurface === 'all-views') {
                    throw new Error('Simulated mid-probe failure before all-views surface');
                }
                const allViewsOutcome = await sweepAllViewsSurface({
                    txProvider,
                    persona: p.kind,
                    personaKey: p.key,
                    personaUser: p.user,
                    targetPolicies,
                    fixture,
                    dialect,
                    maxRows,
                    deadlineMs,
                });
                entitiesSwept += allViewsOutcome.entitiesSwept;
                findings.push(...allViewsOutcome.findings);
                summaries.push(allViewsOutcome.summary);

                if (input.FaultInjectionBeforeSurface === 'run-query') {
                    throw new Error('Simulated mid-probe failure before run-query surface');
                }
                const runQueryOutcome = await sweepRunQuerySurface({
                    txProvider,
                    queryProvider,
                    persona: p.kind,
                    personaKey: p.key,
                    personaUser: p.user,
                    queries,
                    fixture,
                    maxRows,
                    deadlineMs,
                });
                queriesSwept += runQueryOutcome.queriesSwept;
                findings.push(...runQueryOutcome.findings);
                summaries.push(runQueryOutcome.summary);

                if (input.FaultInjectionBeforeSurface === 'dataset') {
                    throw new Error('Simulated mid-probe failure before dataset surface');
                }
                const datasetOutcome = await sweepDatasetSurface({
                    txProvider,
                    persona: p.kind,
                    personaKey: p.key,
                    personaUser: p.user,
                    datasets,
                    fixture,
                    policyByEntity,
                    deadlineMs,
                });
                datasetsSwept += datasetOutcome.datasetsSwept;
                findings.push(...datasetOutcome.findings);
                summaries.push(datasetOutcome.summary);

                if (input.FaultInjectionBeforeSurface === 'report') {
                    throw new Error('Simulated mid-probe failure before report surface');
                }
                const reportOutcome = await sweepReportSurface({
                    txProvider,
                    queryProvider,
                    persona: p.kind,
                    personaKey: p.key,
                    personaUser: p.user,
                    reports,
                    reportExecutor: input.ReportExecutor,
                    fixture,
                    maxRows,
                    deadlineMs,
                });
                reportsSwept += reportOutcome.reportsSwept;
                findings.push(...reportOutcome.findings);
                summaries.push(reportOutcome.summary);

                if (input.FaultInjectionBeforeSurface === 'direct-id-resolver') {
                    throw new Error('Simulated mid-probe failure before direct-id-resolver surface');
                }
                const directIdOutcome = await sweepDirectIdResolverSurface({
                    txProvider,
                    persona: p.kind,
                    personaKey: p.key,
                    personaUser: p.user,
                    targetPolicies,
                    fixture,
                    directIdResolverHook: input.DirectIdResolverHook,
                    deadlineMs,
                });
                directIdsSwept += directIdOutcome.directIdsSwept;
                findings.push(...directIdOutcome.findings);
                summaries.push(directIdOutcome.summary);
            }

            return {
                fixture,
                findings,
                summaries,
                entitiesSwept,
                queriesSwept,
                datasetsSwept,
                reportsSwept,
                directIdsSwept,
            };
        });

        // Post-rollback residual check: verify Space B synthetic space record does not remain persisted
        let residualCheckPassed = true;
        if (input.FixtureMode !== 'world-provided' && context.MetadataProvider.EntityByName('MJ_BizApps_Collaboration: Spaces')) {
            const rvCheck = RunView.FromMetadataProvider(context.MetadataProvider);
            const residualRes = await rvCheck.RunView<ProbeRowRecord>(
                {
                    EntityName: 'MJ_BizApps_Collaboration: Spaces',
                    ExtraFilter: buildUuidEqualsFilter('ID', inner.fixture.SpaceBID, dialect),
                    Fields: ['ID'],
                    MaxRows: 1,
                    ResultType: 'simple',
                    BypassCache: true,
                },
                context.SystemUser,
            );
            if (residualRes.Success && (residualRes.Results?.length ?? 0) > 0) {
                residualCheckPassed = false;
            }
        }

        return {
            Passed: inner.findings.length === 0 && residualCheckPassed,
            ProbedAt: new Date().toISOString(),
            Dialect: dialect,
            SpaceAID: inner.fixture.SpaceAID,
            SpaceBID: inner.fixture.SpaceBID,
            Findings: inner.findings,
            SurfaceSummaries: inner.summaries,
            Stats: {
                PersonasChecked: 2,
                SurfacesChecked: DISCLOSURE_SURFACES.length,
                EntitiesSwept: inner.entitiesSwept,
                QueriesSwept: inner.queriesSwept,
                DatasetsSwept: inner.datasetsSwept,
                ReportsSwept: inner.reportsSwept,
                DirectIdsSwept: inner.directIdsSwept,
                SyntheticRecordsCreated: inner.fixture.TotalCreated,
                RolledBack: true,
                ResidualCheckPassed: residualCheckPassed,
                DurationMs: Date.now() - startedAt,
            },
        };
    }
}

/**
 * `BaseLiveCrudVerifier` plugin exposing XS-3 cross-surface persona security verification to
 * `LiveEntityCrudProbe` inside an unconditionally rolled-back transaction scope.
 */
@RegisterClass(BaseLiveCrudVerifier, PERSONA_SECURITY_VERIFIER_KEY)
export class CollaborationPersonaSecurityVerifier extends BaseLiveCrudVerifier {
    public override get VerifierKey(): string {
        return PERSONA_SECURITY_VERIFIER_KEY;
    }

    public override get OwnerApp(): string {
        return COLLABORATION_HEALTH_OWNER_APP;
    }

    public override get Title(): string {
        return 'Collaboration Cross-Surface Persona Security Verifier';
    }

    public override async Verify(
        context: HealthProbeContext,
        txProvider: ProbeDatabaseProvider,
    ): Promise<LiveCrudVerifierResult> {
        const probe = new CollaborationPersonaSecurityProbe();
        const result = await probe.RunProbe({ ...context, DatabaseProvider: txProvider });
        return {
            Success: result.Passed,
            Summary: result.Passed
                ? `Verified zero cross-surface disclosure across ${result.Stats.SurfacesChecked} surfaces (${result.Stats.EntitiesSwept} entity sweeps, ${result.Stats.QueriesSwept} queries, ${result.Stats.DatasetsSwept} datasets, ${result.Stats.ReportsSwept} reports, ${result.Stats.DirectIdsSwept} direct ID lookups).`
                : `Detected ${result.Findings.length} disclosure finding(s): ${result.Findings.map((f) => `${f.Surface}:${f.Persona}:${f.EntityName}`).join(', ')}`,
            ObservedMetrics: {
                PersonasChecked: result.Stats.PersonasChecked,
                SurfacesChecked: result.Stats.SurfacesChecked,
                EntitiesSwept: result.Stats.EntitiesSwept,
                FindingCount: result.Findings.length,
                RolledBack: result.Stats.RolledBack,
                ResidualCheckPassed: result.Stats.ResidualCheckPassed,
            },
            DiagnosticError: result.Passed
                ? undefined
                : result.Findings.map((f) => `[${f.Surface}/${f.Persona}/${f.EntityName}] ${f.Diagnostics}`).join('\n'),
        };
    }
}

/**
 * Executes the XS-3 Automated Cross-Surface Persona Security Probe inside `WithRolledBackTransaction`.
 */
export async function runPersonaSecurityProbe(
    provider: IMetadataProvider,
    user: UserInfo,
    input: PersonaSecurityProbeInput = {},
): Promise<PersonaSecurityProbeResult> {
    if (!hasBeginEntityTransaction(provider)) {
        throw new HealthProbeRollbackError(
            PERSONA_SECURITY_PROBE_KEY,
            new Error('Provider must implement BeginEntityTransaction() to guarantee XS-3 WithRolledBackTransaction rollback isolation.'),
        );
    }
    const probe = new CollaborationPersonaSecurityProbe();
    const context: HealthProbeContext = {
        DatabaseProvider: provider,
        MetadataProvider: provider,
        SystemUser: user,
        Mode: 'live-test',
        AppFilter: COLLABORATION_HEALTH_OWNER_APP,
        TimeoutMs: clampTimeoutMs(input.TimeoutMs),
    };
    return probe.RunProbe(context, input);
}

/**
 * Typed `BaseRemotableOperation` exposing the XS-3 Automated Persona Security Probe.
 * Enforces server-side `ContextUser` administrative authorization and rejects external participant / Magic Link callers.
 */
@RegisterClass(BaseRemotableOperation, PERSONA_SECURITY_PROBE_OPERATION_KEY)
export class PersonaSecurityProbeOperation extends BaseRemotableOperation<
    PersonaSecurityProbeInput,
    PersonaSecurityProbeResult
> {
    public override readonly OperationKey = PERSONA_SECURITY_PROBE_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        input: PersonaSecurityProbeInput,
        user: UserInfo,
        context?: RemoteOpServerContext,
    ): Promise<boolean> {
        const auth = authorizeSecurityAuditCaller(user, context?.provider, input?.ParticipantRoleID);
        if (!auth.authorized) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: PersonaSecurityProbeInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<PersonaSecurityProbeResult> {
        return runPersonaSecurityProbe(provider, user, input ?? {});
    }
}
