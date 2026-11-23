import {
    BaseRemotableOperation,
    type EntityInfo,
    type EntityPermissionInfo,
    type IMetadataProvider,
    type RemoteOpServerContext,
    RemoteOperationError,
    RunView,
    type UserInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    type AuditSeverity,
    authorizeSecurityAuditCaller,
    buildBatchedInFilter,
    chunkDistinctIds,
    COLLABORATION_SCHEMA_NAME,
    DEFAULT_AUDIT_BATCH_SIZE,
    detectAuditSqlDialect,
    normalizeAuditUuid,
    PARTICIPANT_ROLE_ID,
    type SqlDialect,
} from './security-audit-types.js';

export const BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY = 'Collaboration.BootEntityGrantInventory';

export type BootEntityGrantPolicyKind =
    | 'reach-scoped'
    | 'active-catalog'
    | 'shell-deny-all'
    | 'staff-only-denied';

export interface BootEntityGrantPolicySpec {
    EntityName: string;
    BootSource:
        | 'CollaborationEngineBase'
        | 'CollaborationAdminEngineBase'
        | 'CollaborationSchema'
        | 'ParticipantGrant'
        | 'ExplorerShellBoot';
    PolicyKind: BootEntityGrantPolicyKind;
    /** Whether `Space Participant` writes (`CanCreate` / `CanUpdate`) require an explicit write RLS filter (vs. server entity gate). */
    RequireWriteRlsWhenWritable: boolean;
    /** Whether a `ReadRLSFilterID` is also expected on UI/staff permissions (`metadata/entities/.ui-role-permissions.json`). */
    RequireUiRoleReadFilter?: boolean;
}

export interface PolymorphicFkSpec {
    EntityName: string;
    PayloadFieldName: string;
    EntityIDFieldName: string;
}

/**
 * Authoritative polymorphic FK declarations matching `metadata/entities/.polymorphic-fk-entity-fields.json`.
 */
export const COLLABORATION_POLYMORPHIC_FK_SPECS: readonly PolymorphicFkSpec[] = [
    { EntityName: 'MJ_BizApps_Collaboration: Space Anchors', PayloadFieldName: 'RecordID', EntityIDFieldName: 'EntityID' },
    { EntityName: 'MJ_BizApps_Collaboration: Space Grants', PayloadFieldName: 'TargetRecordID', EntityIDFieldName: 'TargetEntityID' },
    { EntityName: 'MJ_BizApps_Collaboration: Space Items', PayloadFieldName: 'RecordID', EntityIDFieldName: 'EntityID' },
    { EntityName: 'MJ_BizApps_Collaboration: Space Member Pins', PayloadFieldName: 'TargetRecordID', EntityIDFieldName: 'TargetEntityID' },
    { EntityName: 'MJ_BizApps_Collaboration: Space Agent Source Receipts', PayloadFieldName: 'TargetRecordID', EntityIDFieldName: 'TargetEntityID' },
];

/**
 * 100% enumerated Collaboration boot-loaded and Space Participant-accessible entity inventory grounded in:
 * - `CollaborationEngineBase.Config` & `CollaborationAdminEngineBase.Config`
 * - `packages/Entities/src/generated/entities/__mj_BizAppsCollaboration.ts` (all 14 Collaboration schema entities)
 * - `metadata/entity-permissions/.entity-permissions.json` & `.core-entity-permissions.json`
 * - `metadata/entities/.ui-role-permissions.json`
 */
export const COLLABORATION_BOOT_ENTITY_REGISTRY: readonly BootEntityGrantPolicySpec[] = [
    // CollaborationEngineBase boot entities
    { EntityName: 'MJ_BizApps_Collaboration: Space Types', BootSource: 'CollaborationEngineBase', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Type Status', BootSource: 'CollaborationEngineBase', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Role Types', BootSource: 'CollaborationEngineBase', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Application Settings', BootSource: 'CollaborationEngineBase', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },

    // CollaborationAdminEngineBase boot entities (staff-only)
    { EntityName: 'MJ: Authorizations', BootSource: 'CollaborationAdminEngineBase', PolicyKind: 'staff-only-denied', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Authorization Roles', BootSource: 'CollaborationAdminEngineBase', PolicyKind: 'staff-only-denied', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Grants', BootSource: 'CollaborationAdminEngineBase', PolicyKind: 'staff-only-denied', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },

    // Remaining Collaboration schema entities
    { EntityName: 'MJ_BizApps_Collaboration: Spaces', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: false, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Members', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: false, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Items', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: false, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Share Notices', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Item Uses', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Chats', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Anchors', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Notes', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Member Pins', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ_BizApps_Collaboration: Space Agent Source Receipts', BootSource: 'CollaborationSchema', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },

    // Cross-schema entities granted to Space Participant (`metadata/entity-permissions/.entity-permissions.json`)
    { EntityName: 'MJ_BizApps_Common: People', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Users', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: User Roles', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: User Applications', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: User Settings', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: User Notifications', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Application Roles', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Conversations', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ: Conversation Details', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ: Conversation Branches', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Files', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ: Workspaces', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Workspace Items', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: User Favorites', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: User Record Logs', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: User Notification Preferences', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: AI Agents', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: AI Agent Search Scopes', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Search Scope Permissions', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Entity Record Documents', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ: Content Items', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ: Content Item Chunks', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true, RequireUiRoleReadFilter: true },
    { EntityName: 'MJ: AI Agent Runs', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: AI Agent Run Steps', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: AI Prompt Runs', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: false },
    { EntityName: 'MJ_BizApps_Tasks: Tasks', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Links', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Assignments', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Comments', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Activities', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Dependencies', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Decisions', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Tag Links', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Types', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Type Status', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Roles', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Categories', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Tags', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Decision Outcomes', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Templates', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Template Items', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Template Item Roles', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Task Template Item Dependencies', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meetings', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meeting Series', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meeting Attendees', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meeting Series Attendees', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meeting Agenda Items', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meeting Notes', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meeting Links', BootSource: 'ParticipantGrant', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meeting Types', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Meeting Agenda Item Types', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ_BizApps_Tasks: Video Providers', BootSource: 'ParticipantGrant', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },

    // Explorer shell boot entities (`metadata/entity-permissions/.core-entity-permissions.json`)
    { EntityName: 'MJ: User Notification Types', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Applications', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Artifact Types', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Resource Types', BootSource: 'ExplorerShellBoot', PolicyKind: 'active-catalog', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Resource Permissions', BootSource: 'ExplorerShellBoot', PolicyKind: 'reach-scoped', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: User Views', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: View Types', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Entity Relationship Display Components', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Dashboards', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Dashboard Part Types', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Dashboard User Preferences', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Dashboard User States', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Dashboard Categories', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Dashboard Permissions', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Dashboard Category Permissions', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
    { EntityName: 'MJ: Dashboard Category Links', BootSource: 'ExplorerShellBoot', PolicyKind: 'shell-deny-all', RequireWriteRlsWhenWritable: true },
];

export type BootEntityGrantInventoryFindingCode =
    | 'UNREGISTERED_COLLABORATION_ENTITY'
    | 'MISSING_ENTITY_METADATA'
    | 'ALLOW_ALL_ROWS_ENABLED'
    | 'MISSING_READ_PERMISSION'
    | 'MISSING_READ_RLS_FILTER'
    | 'OVERLY_PERMISSIVE_RLS_FILTER'
    | 'OVERLY_PERMISSIVE_SHELL_FILTER'
    | 'PARTICIPANT_HAS_ADMIN_READ'
    | 'OVERLY_PERMISSIVE_WRITE_GRANT'
    | 'MISSING_WRITE_RLS_FILTER'
    | 'MISSING_DELETE_RLS_FILTER'
    | 'MISSING_UI_ROLE_READ_FILTER'
    | 'MISSING_ENTITY_ID_FIELD_NAME'
    | 'INVALID_ENTITY_ID_FIELD_NAME';

export interface BootEntityGrantInventoryInput {
    /** Canonical external participant RoleID override (defaults to `PARTICIPANT_ROLE_ID`). */
    ParticipantRoleID?: string;
    /** Optional restricted staff RoleIDs to also verify scoped read filters on (e.g., standard UI role ID). */
    RestrictedStaffRoleIDs?: readonly string[];
    /** When true (default), requires every entity in `COLLABORATION_BOOT_ENTITY_REGISTRY` to exist in `provider.Entities`. */
    RequireAllRegisteredEntitiesPresent?: boolean;
    /** Explicit SQL dialect override (`'mssql'` | `'postgresql'`). */
    Dialect?: SqlDialect;
    /** Batch size for `ID IN (...)` RLS filter lookups (default: 200, max: 500). */
    BatchSize?: number;
}

export interface BootEntityGrantAuditEntry {
    EntityName: string;
    BootSource: string;
    PolicyKind: BootEntityGrantPolicyKind;
    PresentInMetadata: boolean;
    AllowAllRowsAPI: boolean | null;
    ParticipantCanRead: boolean;
    ParticipantReadFilterID: string | null;
    ParticipantReadFilterText: string | null;
    PolymorphicFieldsChecked: number;
    Passed: boolean;
}

export interface BootEntityGrantInventoryFinding {
    Code: BootEntityGrantInventoryFindingCode;
    Severity: AuditSeverity;
    EntityName: string;
    RoleID?: string;
    FieldName?: string;
    EntityIDFieldName?: string;
    Message: string;
    Remediation: string;
}

export interface BootEntityGrantInventoryResult {
    Passed: boolean;
    AuditedAt: string;
    Dialect: SqlDialect;
    TotalEntitiesChecked: number;
    Entities: BootEntityGrantAuditEntry[];
    Findings: BootEntityGrantInventoryFinding[];
}

interface SimpleRlsFilterRow {
    ID: string;
    Name?: string | null;
    FilterText?: string | null;
}

/** Strips outer whitespace/parentheses and collapses spaces for deterministic SQL predicate inspection. */
export function normalizeRlsFilterText(sqlText: string | null | undefined): string {
    if (!sqlText) {
        return '';
    }
    let cleaned = sqlText.trim().replace(/\s+/g, ' ').toLowerCase();
    while (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        let depth = 0;
        let balancedOuter = true;
        for (let i = 0; i < cleaned.length; i += 1) {
            if (cleaned[i] === '(') depth += 1;
            else if (cleaned[i] === ')') depth -= 1;
            if (depth === 0 && i < cleaned.length - 1) {
                balancedOuter = false;
                break;
            }
        }
        if (!balancedOuter) {
            break;
        }
        cleaned = cleaned.slice(1, -1).trim();
    }
    return cleaned;
}

/** Returns true when an RLS filter predicate is tautological / overly permissive (e.g. `1 = 1`, `TRUE`, `0 = 0`). */
export function isOverlyPermissiveFilterText(sqlText: string | null | undefined): boolean {
    const norm = normalizeRlsFilterText(sqlText);
    if (!norm) {
        return true;
    }
    return (
        norm === '1=1' ||
        norm === '1 = 1' ||
        norm === 'true' ||
        norm === '0=0' ||
        norm === '0 = 0' ||
        norm === 'id is not null' ||
        norm === '[id] is not null' ||
        norm === '"id" is not null'
    );
}

/** Returns true when an RLS filter predicate enforces deny-all (`1 = 0` or `FALSE`). */
export function isDenyAllFilterText(sqlText: string | null | undefined): boolean {
    const norm = normalizeRlsFilterText(sqlText);
    return norm === '1=0' || norm === '1 = 0' || norm === 'false';
}

function getEffectiveFilterText(
    perm: EntityPermissionInfo,
    type: 'Read' | 'Create' | 'Update' | 'Delete',
    filterMap: Map<string, SimpleRlsFilterRow>,
): { filterId: string | null; filterText: string | null } {
    const filterId =
        type === 'Read'
            ? perm.ReadRLSFilterID
            : type === 'Create'
              ? perm.CreateRLSFilterID
              : type === 'Update'
                ? perm.UpdateRLSFilterID
                : perm.DeleteRLSFilterID;
    const cleanId = normalizeAuditUuid(filterId);
    if (!cleanId) {
        return { filterId: null, filterText: null };
    }
    const fromRunView = filterMap.get(cleanId)?.FilterText;
    if (typeof fromRunView === 'string' && fromRunView.trim().length > 0) {
        return { filterId: cleanId, filterText: fromRunView };
    }
    const obj =
        type === 'Read'
            ? perm.ReadRLSFilterObject
            : type === 'Create'
              ? perm.CreateRLSFilterObject
              : type === 'Update'
                ? perm.UpdateRLSFilterObject
                : perm.DeleteRLSFilterObject;
    return {
        filterId: cleanId,
        filterText: obj?.FilterText ?? null,
    };
}

/**
 * XS-2 Boot Entity Grant Filter Inventory:
 * Enumerates 100% of boot-loaded and Collaboration entities, verifies scoped RLS grant filters for
 * `Space Participant` and restricted staff roles, validates `AllowAllRowsAPI = false`, and validates
 * `EntityField.EntityIDFieldName` integrity for all polymorphic FKs.
 */
export async function runBootEntityGrantInventory(
    provider: IMetadataProvider,
    user: UserInfo,
    input: BootEntityGrantInventoryInput = {},
): Promise<BootEntityGrantInventoryResult> {
    const dialect = detectAuditSqlDialect(provider, input.Dialect);
    const batchSize =
        typeof input.BatchSize === 'number' && Number.isInteger(input.BatchSize) && input.BatchSize > 0
            ? Math.min(input.BatchSize, 500)
            : DEFAULT_AUDIT_BATCH_SIZE;
    const participantRoleId = normalizeAuditUuid(input.ParticipantRoleID ?? PARTICIPANT_ROLE_ID) ?? PARTICIPANT_ROLE_ID.toLowerCase();
    const restrictedStaffRoleIds = new Set(
        (input.RestrictedStaffRoleIDs ?? [])
            .map((id) => normalizeAuditUuid(id))
            .filter((id): id is string => id !== null && id !== participantRoleId),
    );
    const requireAllPresent = input.RequireAllRegisteredEntitiesPresent !== false;
    const rv = RunView.FromMetadataProvider(provider);

    const entityMap = new Map<string, EntityInfo>();
    for (const e of provider.Entities ?? []) {
        if (e.Name) {
            entityMap.set(e.Name.trim().toLowerCase(), e);
        }
    }

    // Build combined registry + any extra Collaboration schema entities or entities granted to Space Participant
    const policyByEntityLower = new Map<string, BootEntityGrantPolicySpec>();
    for (const spec of COLLABORATION_BOOT_ENTITY_REGISTRY) {
        policyByEntityLower.set(spec.EntityName.trim().toLowerCase(), spec);
    }

    const findings: BootEntityGrantInventoryFinding[] = [];
    const filterIdsToLoad = new Set<string>();

    for (const e of provider.Entities ?? []) {
        const nameLower = (e.Name ?? '').trim().toLowerCase();
        const isCollabSchema =
            (e.SchemaName ?? '').trim().toLowerCase() === COLLABORATION_SCHEMA_NAME.toLowerCase() ||
            nameLower.startsWith('mj_bizapps_collaboration:');
        const hasParticipantPerm = (e.Permissions ?? []).some(
            (p) => !p.IsDeny && normalizeAuditUuid(p.RoleID) === participantRoleId,
        );
        if ((isCollabSchema || hasParticipantPerm) && !policyByEntityLower.has(nameLower)) {
            findings.push({
                Code: 'UNREGISTERED_COLLABORATION_ENTITY',
                Severity: 'Critical',
                EntityName: e.Name,
                Message: `Entity '${e.Name}' is in the Collaboration schema or granted to Space Participant, but is missing from the boot entity grant filter registry.`,
                Remediation: 'Register an explicit scoped grant filter policy for this entity in COLLABORATION_BOOT_ENTITY_REGISTRY and metadata/entity-permissions.',
            });
            policyByEntityLower.set(nameLower, {
                EntityName: e.Name,
                BootSource: 'CollaborationSchema',
                PolicyKind: 'reach-scoped',
                RequireWriteRlsWhenWritable: true,
            });
        }
        for (const p of e.Permissions ?? []) {
            for (const fid of [p.ReadRLSFilterID, p.CreateRLSFilterID, p.UpdateRLSFilterID, p.DeleteRLSFilterID]) {
                const clean = normalizeAuditUuid(fid);
                if (clean) {
                    filterIdsToLoad.add(clean);
                }
            }
        }
    }

    // Batch-load Row Level Security Filter texts via RunView ResultType: 'simple' when filter IDs exist
    const filterMap = new Map<string, SimpleRlsFilterRow>();
    for (const batch of chunkDistinctIds([...filterIdsToLoad], batchSize)) {
        const res = await rv.RunView<SimpleRlsFilterRow>(
            {
                EntityName: 'MJ: Row Level Security Filters',
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'Name', 'FilterText'],
                ResultType: 'simple',
                // row-cap-ok: bounded by deduplicated RLSFilterID batch (<= 500)
                MaxRows: batch.length,
            },
            user,
        );
        if (res.Success) {
            for (const row of res.Results ?? []) {
                const cleanId = normalizeAuditUuid(row.ID);
                if (cleanId) {
                    filterMap.set(cleanId, row);
                }
            }
        }
    }

    const polymorphicSpecsByEntity = new Map<string, PolymorphicFkSpec[]>();
    for (const pSpec of COLLABORATION_POLYMORPHIC_FK_SPECS) {
        const key = pSpec.EntityName.trim().toLowerCase();
        const list = polymorphicSpecsByEntity.get(key) ?? [];
        list.push(pSpec);
        polymorphicSpecsByEntity.set(key, list);
    }

    const entries: BootEntityGrantAuditEntry[] = [];

    for (const [nameLower, spec] of policyByEntityLower.entries()) {
        const entity = entityMap.get(nameLower);
        const beforeCount = findings.length;

        if (!entity) {
            if (requireAllPresent) {
                findings.push({
                    Code: 'MISSING_ENTITY_METADATA',
                    Severity: 'High',
                    EntityName: spec.EntityName,
                    Message: `Boot-loaded entity '${spec.EntityName}' (${spec.BootSource}) is absent from Metadata.Entities.`,
                    Remediation: 'Ensure migrations and metadata sync are applied before booting Collaboration.',
                });
            }
            entries.push({
                EntityName: spec.EntityName,
                BootSource: spec.BootSource,
                PolicyKind: spec.PolicyKind,
                PresentInMetadata: false,
                AllowAllRowsAPI: null,
                ParticipantCanRead: false,
                ParticipantReadFilterID: null,
                ParticipantReadFilterText: null,
                PolymorphicFieldsChecked: 0,
                Passed: findings.length === beforeCount,
            });
            continue;
        }

        // 1. Check AllowAllRowsAPI on Collaboration schema entities
        const isCollabSchema = (entity.SchemaName ?? '').trim().toLowerCase() === COLLABORATION_SCHEMA_NAME.toLowerCase();
        if (isCollabSchema && entity.AllowAllRowsAPI) {
            findings.push({
                Code: 'ALLOW_ALL_ROWS_ENABLED',
                Severity: 'Critical',
                EntityName: entity.Name,
                Message: `Collaboration entity '${entity.Name}' has AllowAllRowsAPI=true, exposing unfiltered GraphQL All... queries.`,
                Remediation: `Set AllowAllRowsAPI=0 on '${entity.Name}' in entity metadata.`,
            });
        }

        // 2. Validate Space Participant permissions & RLS filters
        const participantPerms = (entity.Permissions ?? []).filter(
            (p) => !p.IsDeny && normalizeAuditUuid(p.RoleID) === participantRoleId,
        );
        const participantReadPerm = participantPerms.find((p) => p.CanRead);
        let participantReadFilterId: string | null = null;
        let participantReadFilterText: string | null = null;

        if (spec.PolicyKind === 'staff-only-denied') {
            for (const p of participantPerms) {
                if (p.CanRead || p.CanCreate || p.CanUpdate || p.CanDelete) {
                    findings.push({
                        Code: 'PARTICIPANT_HAS_ADMIN_READ',
                        Severity: 'Critical',
                        EntityName: entity.Name,
                        RoleID: p.RoleID,
                        Message: `Staff-only entity '${entity.Name}' grants permissions to external Space Participant role.`,
                        Remediation: `Revoke Space Participant EntityPermission rows on '${entity.Name}'.`,
                    });
                }
            }
        } else {
            if (!participantReadPerm) {
                findings.push({
                    Code: 'MISSING_READ_PERMISSION',
                    Severity: 'High',
                    EntityName: entity.Name,
                    RoleID: participantRoleId,
                    Message: `Boot entity '${entity.Name}' (${spec.PolicyKind}) lacks a Space Participant read permission with a scoped RLS filter.`,
                    Remediation: `Add a Space Participant EntityPermission row on '${entity.Name}' bound to a scoped ReadRLSFilterID.`,
                });
            } else {
                const resolvedRead = getEffectiveFilterText(participantReadPerm, 'Read', filterMap);
                participantReadFilterId = resolvedRead.filterId;
                participantReadFilterText = resolvedRead.filterText;

                if (!resolvedRead.filterId) {
                    findings.push({
                        Code: 'MISSING_READ_RLS_FILTER',
                        Severity: 'Critical',
                        EntityName: entity.Name,
                        RoleID: participantReadPerm.RoleID,
                        Message: `Space Participant CanRead=1 on '${entity.Name}' has no ReadRLSFilterID.`,
                        Remediation: `Bind a scoped ReadRLSFilterID to the Space Participant EntityPermission on '${entity.Name}'.`,
                    });
                } else if (spec.PolicyKind === 'shell-deny-all') {
                    if (resolvedRead.filterText !== null && !isDenyAllFilterText(resolvedRead.filterText)) {
                        findings.push({
                            Code: 'OVERLY_PERMISSIVE_SHELL_FILTER',
                            Severity: 'Critical',
                            EntityName: entity.Name,
                            RoleID: participantReadPerm.RoleID,
                            Message: `Shell boot entity '${entity.Name}' must use a deny-all (1 = 0) filter for Space Participant, found '${resolvedRead.filterText}'.`,
                            Remediation: "Assign 'Collaboration: Shell Empty' (FilterText: '(1 = 0)') as ReadRLSFilterID.",
                        });
                    }
                } else if (spec.PolicyKind === 'reach-scoped') {
                    if (resolvedRead.filterText !== null && isOverlyPermissiveFilterText(resolvedRead.filterText)) {
                        findings.push({
                            Code: 'OVERLY_PERMISSIVE_RLS_FILTER',
                            Severity: 'Critical',
                            EntityName: entity.Name,
                            RoleID: participantReadPerm.RoleID,
                            Message: `Reach-scoped entity '${entity.Name}' has an overly permissive ReadRLSFilterID ('${resolvedRead.filterText}').`,
                            Remediation: `Replace the tautological ReadRLSFilterID on '${entity.Name}' with a user/space-reach scoped RLS predicate.`,
                        });
                    }
                }
            }

            // Write & Delete RLS filter checks for Space Participant
            for (const p of participantPerms) {
                if ((spec.PolicyKind === 'active-catalog' || spec.PolicyKind === 'shell-deny-all') && (p.CanCreate || p.CanUpdate || p.CanDelete)) {
                    findings.push({
                        Code: 'OVERLY_PERMISSIVE_WRITE_GRANT',
                        Severity: 'Critical',
                        EntityName: entity.Name,
                        RoleID: p.RoleID,
                        Message: `Catalog/shell entity '${entity.Name}' (${spec.PolicyKind}) must not allow Space Participant writes or deletes.`,
                        Remediation: `Set CanCreate=0, CanUpdate=0, CanDelete=0 on '${entity.Name}' for Space Participant.`,
                    });
                }
                if (p.CanDelete) {
                    const resolvedDel = getEffectiveFilterText(p, 'Delete', filterMap);
                    if (!resolvedDel.filterId) {
                        findings.push({
                            Code: 'MISSING_DELETE_RLS_FILTER',
                            Severity: 'Critical',
                            EntityName: entity.Name,
                            RoleID: p.RoleID,
                            Message: `Space Participant CanDelete=1 on '${entity.Name}' has no DeleteRLSFilterID.`,
                            Remediation: `Attach a scoped DeleteRLSFilterID or disable CanDelete on '${entity.Name}'.`,
                        });
                    } else if (resolvedDel.filterText !== null && isOverlyPermissiveFilterText(resolvedDel.filterText)) {
                        findings.push({
                            Code: 'OVERLY_PERMISSIVE_RLS_FILTER',
                            Severity: 'Critical',
                            EntityName: entity.Name,
                            RoleID: p.RoleID,
                            Message: `Space Participant DeleteRLSFilterID on '${entity.Name}' is overly permissive ('${resolvedDel.filterText}').`,
                            Remediation: `Scope DeleteRLSFilterID on '${entity.Name}' strictly to caller-owned/reached rows.`,
                        });
                    }
                }
                if (spec.RequireWriteRlsWhenWritable && (p.CanCreate || p.CanUpdate)) {
                    if (p.CanCreate) {
                        const resolvedCreate = getEffectiveFilterText(p, 'Create', filterMap);
                        if (!resolvedCreate.filterId) {
                            findings.push({
                                Code: 'MISSING_WRITE_RLS_FILTER',
                                Severity: 'Critical',
                                EntityName: entity.Name,
                                RoleID: p.RoleID,
                                Message: `Space Participant CanCreate=1 on '${entity.Name}' has no CreateRLSFilterID.`,
                                Remediation: `Attach a scoped CreateRLSFilterID on '${entity.Name}'.`,
                            });
                        } else if (resolvedCreate.filterText !== null && isOverlyPermissiveFilterText(resolvedCreate.filterText)) {
                            findings.push({
                                Code: 'OVERLY_PERMISSIVE_RLS_FILTER',
                                Severity: 'Critical',
                                EntityName: entity.Name,
                                RoleID: p.RoleID,
                                Message: `Space Participant CreateRLSFilterID on '${entity.Name}' is overly permissive ('${resolvedCreate.filterText}').`,
                                Remediation: `Scope CreateRLSFilterID on '${entity.Name}' strictly to authorized rows.`,
                            });
                        }
                    }
                    if (p.CanUpdate) {
                        const resolvedUpdate = getEffectiveFilterText(p, 'Update', filterMap);
                        if (!resolvedUpdate.filterId) {
                            findings.push({
                                Code: 'MISSING_WRITE_RLS_FILTER',
                                Severity: 'Critical',
                                EntityName: entity.Name,
                                RoleID: p.RoleID,
                                Message: `Space Participant CanUpdate=1 on '${entity.Name}' has no UpdateRLSFilterID.`,
                                Remediation: `Attach a scoped UpdateRLSFilterID on '${entity.Name}'.`,
                            });
                        } else if (resolvedUpdate.filterText !== null && isOverlyPermissiveFilterText(resolvedUpdate.filterText)) {
                            findings.push({
                                Code: 'OVERLY_PERMISSIVE_RLS_FILTER',
                                Severity: 'Critical',
                                EntityName: entity.Name,
                                RoleID: p.RoleID,
                                Message: `Space Participant UpdateRLSFilterID on '${entity.Name}' is overly permissive ('${resolvedUpdate.filterText}').`,
                                Remediation: `Scope UpdateRLSFilterID on '${entity.Name}' strictly to authorized rows.`,
                            });
                        }
                    }
                }
            }
        }

        // 3. Restricted staff role read-filter verification (when caller specifies RestrictedStaffRoleIDs)
        if (spec.RequireUiRoleReadFilter && restrictedStaffRoleIds.size > 0) {
            for (const staffRoleId of restrictedStaffRoleIds) {
                const staffPerm = (entity.Permissions ?? []).find(
                    (p) => !p.IsDeny && normalizeAuditUuid(p.RoleID) === staffRoleId && p.CanRead,
                );
                if (staffPerm) {
                    const resolvedStaffRead = getEffectiveFilterText(staffPerm, 'Read', filterMap);
                    if (!resolvedStaffRead.filterId) {
                        findings.push({
                            Code: 'MISSING_UI_ROLE_READ_FILTER',
                            Severity: 'Critical',
                            EntityName: entity.Name,
                            RoleID: staffPerm.RoleID,
                            Message: `Restricted staff role '${staffPerm.RoleID}' has CanRead=1 on '${entity.Name}' without a ReadRLSFilterID.`,
                            Remediation: `Apply the space-scoped ReadRLSFilterID from metadata/entities/.ui-role-permissions.json onto '${entity.Name}'.`,
                        });
                    } else if (resolvedStaffRead.filterText !== null && isOverlyPermissiveFilterText(resolvedStaffRead.filterText)) {
                        findings.push({
                            Code: 'OVERLY_PERMISSIVE_RLS_FILTER',
                            Severity: 'Critical',
                            EntityName: entity.Name,
                            RoleID: staffPerm.RoleID,
                            Message: `Restricted staff role '${staffPerm.RoleID}' on '${entity.Name}' has an overly permissive ReadRLSFilterID ('${resolvedStaffRead.filterText}').`,
                            Remediation: `Scope ReadRLSFilterID on '${entity.Name}' to reachable spaces or outside-Collaboration rows.`,
                        });
                    }
                }
            }
        }

        // 4. Polymorphic FK `EntityIDFieldName` integrity verification
        let polymorphicFieldsChecked = 0;
        const requiredPolySpecs = polymorphicSpecsByEntity.get(nameLower) ?? [];
        for (const pSpec of requiredPolySpecs) {
            polymorphicFieldsChecked += 1;
            const field = entity.Fields.find(
                (f) => f.Name.trim().toLowerCase() === pSpec.PayloadFieldName.toLowerCase(),
            );
            const discriminatorExists = entity.Fields.some(
                (f) => f.Name.trim().toLowerCase() === pSpec.EntityIDFieldName.toLowerCase(),
            );
            if (!field || !field.EntityIDFieldName || field.EntityIDFieldName.trim().toLowerCase() !== pSpec.EntityIDFieldName.toLowerCase()) {
                findings.push({
                    Code: 'MISSING_ENTITY_ID_FIELD_NAME',
                    Severity: 'Critical',
                    EntityName: entity.Name,
                    FieldName: pSpec.PayloadFieldName,
                    EntityIDFieldName: pSpec.EntityIDFieldName,
                    Message: `Polymorphic field '${entity.Name}.${pSpec.PayloadFieldName}' must declare EntityIDFieldName='${pSpec.EntityIDFieldName}' in EntityField metadata.`,
                    Remediation: `Sync metadata/entities/.polymorphic-fk-entity-fields.json so '${pSpec.PayloadFieldName}.EntityIDFieldName' equals '${pSpec.EntityIDFieldName}'.`,
                });
            } else if (!discriminatorExists) {
                findings.push({
                    Code: 'INVALID_ENTITY_ID_FIELD_NAME',
                    Severity: 'High',
                    EntityName: entity.Name,
                    FieldName: field.Name,
                    EntityIDFieldName: field.EntityIDFieldName,
                    Message: `Entity '${entity.Name}' field '${field.Name}' references missing discriminator field '${field.EntityIDFieldName}'.`,
                    Remediation: `Ensure discriminator column '${field.EntityIDFieldName}' exists on '${entity.Name}'.`,
                });
            }
        }

        // Also validate any additional fields on the entity carrying `EntityIDFieldName`
        for (const field of entity.Fields) {
            if (!field.EntityIDFieldName || field.EntityIDFieldName.trim().length === 0) {
                continue;
            }
            const alreadyChecked = requiredPolySpecs.some(
                (s) => s.PayloadFieldName.toLowerCase() === field.Name.trim().toLowerCase(),
            );
            if (!alreadyChecked) {
                polymorphicFieldsChecked += 1;
                const disc = field.EntityIDFieldName.trim();
                const exists = entity.Fields.some((f) => f.Name.trim().toLowerCase() === disc.toLowerCase());
                if (!exists) {
                    findings.push({
                        Code: 'INVALID_ENTITY_ID_FIELD_NAME',
                        Severity: 'High',
                        EntityName: entity.Name,
                        FieldName: field.Name,
                        EntityIDFieldName: disc,
                        Message: `Entity '${entity.Name}' field '${field.Name}' declares EntityIDFieldName='${disc}', which is absent from Entity.Fields.`,
                        Remediation: `Correct EntityIDFieldName on '${entity.Name}.${field.Name}' to a valid EntityID column.`,
                    });
                }
            }
        }

        entries.push({
            EntityName: entity.Name,
            BootSource: spec.BootSource,
            PolicyKind: spec.PolicyKind,
            PresentInMetadata: true,
            AllowAllRowsAPI: !!entity.AllowAllRowsAPI,
            ParticipantCanRead: !!participantReadPerm,
            ParticipantReadFilterID: participantReadFilterId,
            ParticipantReadFilterText: participantReadFilterText,
            PolymorphicFieldsChecked: polymorphicFieldsChecked,
            Passed: findings.length === beforeCount,
        });
    }

    return {
        Passed: findings.length === 0,
        AuditedAt: new Date().toISOString(),
        Dialect: dialect,
        TotalEntitiesChecked: entries.length,
        Entities: entries,
        Findings: findings,
    };
}

/**
 * Typed `BaseRemotableOperation` exposing the XS-2 Boot Entity Grant Filter Inventory.
 * Enforces server-side `ContextUser` administrative authorization and rejects Magic Link / external participant callers.
 */
@RegisterClass(BaseRemotableOperation, BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY)
export class BootEntityGrantInventoryOperation extends BaseRemotableOperation<
    BootEntityGrantInventoryInput,
    BootEntityGrantInventoryResult
> {
    public override readonly OperationKey = BOOT_ENTITY_GRANT_INVENTORY_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: BootEntityGrantInventoryInput,
        user: UserInfo,
        context?: RemoteOpServerContext,
    ): Promise<boolean> {
        const auth = authorizeSecurityAuditCaller(user, context?.provider);
        if (!auth.authorized) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: BootEntityGrantInventoryInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<BootEntityGrantInventoryResult> {
        return runBootEntityGrantInventory(provider, user, input ?? {});
    }
}
