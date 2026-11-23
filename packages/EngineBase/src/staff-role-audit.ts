import {
    BaseRemotableOperation,
    type IMetadataProvider,
    type RemoteOpServerContext,
    RemoteOperationError,
    RunView,
    type UserInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    ADMIN_COLLABORATION_AUTHORIZATION_NAMES,
    type AuditSeverity,
    authorizeSecurityAuditCaller,
    buildBatchedInFilter,
    chunkDistinctIds,
    COLLABORATION_APPLICATION_ID,
    COLLABORATION_ROOT_AUTHORIZATION_NAME,
    COLLABORATION_SCHEMA_NAME,
    DEFAULT_AUDIT_BATCH_SIZE,
    detectAuditSqlDialect,
    findCollaborationAuthorizationInList,
    normalizeAuditUuid,
    PARTICIPANT_ROLE_ID,
    readEverySimpleRow,
    type SqlDialect,
    STAFF_COLLABORATION_AUTHORIZATION_NAMES,
} from './security-audit-types.js';

export const STAFF_ROLE_AUDIT_OPERATION_KEY = 'Collaboration.StaffRoleAudit';

export type StaffRoleAuditFindingCode =
    | 'OVERLAPPING_EXTERNAL_STAFF_ROLE'
    | 'PARTICIPANT_GRANTED_STAFF_AUTHORIZATION'
    | 'GLOBAL_ADMIN_ESCALATION'
    | 'ROOT_AUTHORIZATION_GRANTED'
    | 'EXTERNAL_ROLE_ADMIN_APP_ACCESS'
    | 'EXTERNAL_ROLE_EXCESSIVE_ENTITY_PERMISSION'
    | 'INACTIVE_STAFF_ROLE_BINDING'
    | 'LEAST_PRIVILEGE_BOUNDARY_VIOLATION';

export interface StaffRoleAuditInput {
    /** Optional allow-list of RoleIDs permitted to hold high-privilege admin authorizations (`Administer Spaces`, `Configure Space Types`). */
    AllowedAdminRoleIDs?: readonly string[];
    /** Optional subset of UserIDs to audit. When omitted, audits all users holding Collaboration roles/authorizations. */
    UserIDs?: readonly string[];
    /** Explicit SQL dialect override (`'mssql'` | `'postgresql'`). */
    Dialect?: SqlDialect;
    /** Batch size for `ID IN (...)` lookups (default: 200, max: 500). */
    BatchSize?: number;
    /** Canonical external participant RoleID override (defaults to `PARTICIPANT_ROLE_ID`). */
    ParticipantRoleID?: string;
}

export interface StaffRoleAuditFinding {
    Code: StaffRoleAuditFindingCode;
    Severity: AuditSeverity;
    EntityName: string;
    RecordID: string;
    UserID?: string;
    RoleID?: string;
    AuthorizationID?: string;
    Message: string;
    Remediation: string;
}

export interface StaffRoleAuditStats {
    AuthorizationsChecked: number;
    AuthorizationRolesChecked: number;
    ApplicationRolesChecked: number;
    UsersChecked: number;
    BatchedQueryCount: number;
}

export interface StaffRoleAuditResult {
    Passed: boolean;
    AuditedAt: string;
    Dialect: SqlDialect;
    Stats: StaffRoleAuditStats;
    Findings: StaffRoleAuditFinding[];
}

interface SimpleUserRoleRow {
    ID: string;
    UserID: string;
    RoleID: string;
}

interface SimpleUserRow {
    ID: string;
    Name?: string | null;
    Email?: string | null;
    Type?: string | null;
    IsActive?: boolean | null;
}

interface SimpleAuthRoleRow {
    ID: string;
    AuthorizationID: string;
    RoleID: string;
    Type: string;
}

interface SimpleAppRoleRow {
    ID: string;
    ApplicationID: string;
    RoleID: string;
    CanAccess: boolean;
    CanAdmin: boolean;
}

interface SimpleSpaceMemberRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    Band: string;
    Status: string;
}

const CATALOG_ADMIN_ENTITIES = new Set([
    'mj_bizapps_collaboration: space types',
    'mj_bizapps_collaboration: space role types',
    'mj_bizapps_collaboration: space type status',
    'mj_bizapps_collaboration: space grants',
    'mj: authorizations',
    'mj: authorization roles',
    'mj: roles',
]);

/**
 * XS-7 Staff Role Audit:
 * Verifies internal staff role assignments against least-privilege boundaries, separation from external
 * participant scopes, overlapping external+staff role bindings, and unintended global administrative escalation.
 * Uses declarative MJ Authorizations + RoleIDs (never hardcoded role names) and batched `RunView` `ResultType: 'simple'`.
 */
export async function runStaffRoleAudit(
    provider: IMetadataProvider,
    user: UserInfo,
    input: StaffRoleAuditInput = {},
): Promise<StaffRoleAuditResult> {
    const dialect = detectAuditSqlDialect(provider, input.Dialect);
    const batchSize =
        typeof input.BatchSize === 'number' && Number.isInteger(input.BatchSize) && input.BatchSize > 0
            ? Math.min(input.BatchSize, 500)
            : DEFAULT_AUDIT_BATCH_SIZE;
    const participantRoleId = normalizeAuditUuid(input.ParticipantRoleID ?? PARTICIPANT_ROLE_ID) ?? PARTICIPANT_ROLE_ID.toLowerCase();
    const allowedAdminRoleSet = input.AllowedAdminRoleIDs
        ? new Set(
              input.AllowedAdminRoleIDs
                  .map((id) => normalizeAuditUuid(id))
                  .filter((id): id is string => id !== null),
          )
        : null;

    const rv = RunView.FromMetadataProvider(provider);
    const findings: StaffRoleAuditFinding[] = [];
    let batchedQueryCount = 0;

    // 1. Inspect Collaboration Authorization hierarchy & AuthorizationRole grants
    const authorizations = provider.Authorizations ?? [];
    const rootAuth = findCollaborationAuthorizationInList(authorizations, COLLABORATION_ROOT_AUTHORIZATION_NAME);
    const staffAuthById = new Map<string, string>();
    const adminAuthIds = new Set<string>();
    const allCollaborationAuthIds: string[] = [];

    if (rootAuth) {
        const rootId = normalizeAuditUuid(rootAuth.ID);
        if (rootId) {
            allCollaborationAuthIds.push(rootId);
        }
    }
    for (const name of STAFF_COLLABORATION_AUTHORIZATION_NAMES) {
        const auth = findCollaborationAuthorizationInList(authorizations, name);
        const cleanId = normalizeAuditUuid(auth?.ID);
        if (cleanId) {
            staffAuthById.set(cleanId, name);
            allCollaborationAuthIds.push(cleanId);
            if ((ADMIN_COLLABORATION_AUTHORIZATION_NAMES as readonly string[]).includes(name)) {
                adminAuthIds.add(cleanId);
            }
        }
    }

    const authRoles: SimpleAuthRoleRow[] = [];
    if (provider.AuthorizationRoles && provider.AuthorizationRoles.length > 0) {
        const watchedSet = new Set(allCollaborationAuthIds);
        for (const ar of provider.AuthorizationRoles) {
            const aid = normalizeAuditUuid(ar.AuthorizationID);
            if (aid && watchedSet.has(aid)) {
                authRoles.push({
                    ID: ar.ID,
                    AuthorizationID: ar.AuthorizationID,
                    RoleID: ar.RoleID,
                    Type: ar.Type ?? 'Allow',
                });
            }
        }
    } else if (allCollaborationAuthIds.length > 0) {
        for (const batch of chunkDistinctIds(allCollaborationAuthIds, batchSize)) {
            const arRes = await readEverySimpleRow<SimpleAuthRoleRow>(
                rv,
                {
                    EntityName: 'MJ: Authorization Roles',
                    ExtraFilter: buildBatchedInFilter('AuthorizationID', batch, dialect),
                    Fields: ['ID', 'AuthorizationID', 'RoleID', 'Type'],
                },
                user,
            );
            batchedQueryCount += arRes.queryCount;
            if (!arRes.ok) {
                throw new Error(`XS-7 failed reading MJ: Authorization Roles: ${arRes.error}`);
            }
            authRoles.push(...arRes.rows);
        }
    }

    const staffRoleIds = new Set<string>();
    const adminRoleIds = new Set<string>();
    const rootAuthId = normalizeAuditUuid(rootAuth?.ID);

    for (const ar of authRoles) {
        const aid = normalizeAuditUuid(ar.AuthorizationID);
        const rid = normalizeAuditUuid(ar.RoleID);
        const isAllow = (ar.Type ?? 'Allow').trim().toLowerCase() !== 'deny';
        if (!aid || !rid || !isAllow) {
            continue;
        }

        // Flag granting root 'Collaboration' authorization directly (cascades all child authorizations!)
        if (rootAuthId && aid === rootAuthId) {
            findings.push({
                Code: 'ROOT_AUTHORIZATION_GRANTED',
                Severity: rid === participantRoleId ? 'Critical' : 'High',
                EntityName: 'MJ: Authorization Roles',
                RecordID: ar.ID,
                RoleID: ar.RoleID,
                AuthorizationID: ar.AuthorizationID,
                Message: `Root authorization '${COLLABORATION_ROOT_AUTHORIZATION_NAME}' is directly granted to Role '${ar.RoleID}', cascading all child staff/admin Collaboration permissions via ancestor inheritance.`,
                Remediation: 'Grant only the specific child Collaboration authorizations required by each role.',
            });
            staffRoleIds.add(rid);
            adminRoleIds.add(rid);
            continue;
        }

        const staffAuthName = staffAuthById.get(aid);
        if (staffAuthName) {
            staffRoleIds.add(rid);
            if (rid === participantRoleId) {
                findings.push({
                    Code: 'PARTICIPANT_GRANTED_STAFF_AUTHORIZATION',
                    Severity: 'Critical',
                    EntityName: 'MJ: Authorization Roles',
                    RecordID: ar.ID,
                    RoleID: ar.RoleID,
                    AuthorizationID: ar.AuthorizationID,
                    Message: `External Space Participant role '${ar.RoleID}' was granted staff authorization '${staffAuthName}'.`,
                    Remediation: 'Revoke staff Collaboration authorizations from the external Space Participant role immediately.',
                });
            }
            if (adminAuthIds.has(aid)) {
                adminRoleIds.add(rid);
                if (allowedAdminRoleSet && !allowedAdminRoleSet.has(rid)) {
                    findings.push({
                        Code: 'GLOBAL_ADMIN_ESCALATION',
                        Severity: 'Critical',
                        EntityName: 'MJ: Authorization Roles',
                        RecordID: ar.ID,
                        RoleID: ar.RoleID,
                        AuthorizationID: ar.AuthorizationID,
                        Message: `Role '${ar.RoleID}' holds high-privilege authorization '${staffAuthName}' outside the configured AllowedAdminRoleIDs least-privilege policy.`,
                        Remediation: `Remove '${staffAuthName}' from Role '${ar.RoleID}' or explicitly authorize the role in AllowedAdminRoleIDs.`,
                    });
                }
            }
        }
    }

    // 2. Inspect Collaboration Application Roles (`CanAdmin` escalation on external participant role)
    const appRolesRes = await readEverySimpleRow<SimpleAppRoleRow>(
        rv,
        {
            EntityName: 'MJ: Application Roles',
            ExtraFilter: `${buildBatchedInFilter('ApplicationID', [COLLABORATION_APPLICATION_ID], dialect)}`,
            Fields: ['ID', 'ApplicationID', 'RoleID', 'CanAccess', 'CanAdmin'],
        },
        user,
    );
    batchedQueryCount += appRolesRes.queryCount;
    if (!appRolesRes.ok) {
        throw new Error(`XS-7 failed reading MJ: Application Roles: ${appRolesRes.error}`);
    }
    for (const appRole of appRolesRes.rows) {
        const rid = normalizeAuditUuid(appRole.RoleID);
        if (rid === participantRoleId && appRole.CanAdmin) {
            findings.push({
                Code: 'EXTERNAL_ROLE_ADMIN_APP_ACCESS',
                Severity: 'Critical',
                EntityName: 'MJ: Application Roles',
                RecordID: appRole.ID,
                RoleID: appRole.RoleID,
                Message: `External Space Participant role '${appRole.RoleID}' has CanAdmin=true on the Collaboration application.`,
                Remediation: 'Set CanAdmin=false on the Space Participant ApplicationRole row.',
            });
        }
        if (appRole.CanAdmin && allowedAdminRoleSet && rid && !allowedAdminRoleSet.has(rid)) {
            findings.push({
                Code: 'GLOBAL_ADMIN_ESCALATION',
                Severity: 'High',
                EntityName: 'MJ: Application Roles',
                RecordID: appRole.ID,
                RoleID: appRole.RoleID,
                Message: `ApplicationRole '${appRole.ID}' grants CanAdmin=true to Role '${appRole.RoleID}', which is not in AllowedAdminRoleIDs.`,
                Remediation: 'Restrict Collaboration Application CanAdmin to designated administrative roles.',
            });
        }
    }

    // 3. Check Entity Permissions in metadata to ensure external participant role never holds admin/schema write or delete rights
    for (const entity of provider.Entities ?? []) {
        const entityNameLower = (entity.Name ?? '').trim().toLowerCase();
        const isCollabSchema = (entity.SchemaName ?? '').trim().toLowerCase() === COLLABORATION_SCHEMA_NAME.toLowerCase();
        if (!isCollabSchema && !CATALOG_ADMIN_ENTITIES.has(entityNameLower)) {
            continue;
        }
        for (const perm of entity.Permissions ?? []) {
            if (perm.IsDeny) {
                continue;
            }
            const rid = normalizeAuditUuid(perm.RoleID);
            if (rid !== participantRoleId) {
                continue;
            }
            if (CATALOG_ADMIN_ENTITIES.has(entityNameLower) && (perm.CanCreate || perm.CanUpdate || perm.CanDelete || (entityNameLower === 'mj_bizapps_collaboration: space grants' && perm.CanRead))) {
                findings.push({
                    Code: 'EXTERNAL_ROLE_EXCESSIVE_ENTITY_PERMISSION',
                    Severity: 'Critical',
                    EntityName: entity.Name,
                    RecordID: perm.ID ?? entity.ID,
                    RoleID: perm.RoleID,
                    Message: `External Space Participant role holds administrative permission (Read=${String(perm.CanRead)}, Create=${String(perm.CanCreate)}, Update=${String(perm.CanUpdate)}, Delete=${String(perm.CanDelete)}) on '${entity.Name}'.`,
                    Remediation: `Restrict '${entity.Name}' administrative permissions strictly to staff/admin roles.`,
                });
            } else if (isCollabSchema && perm.CanDelete && (entityNameLower === 'mj_bizapps_collaboration: spaces' || entityNameLower === 'mj_bizapps_collaboration: space members' || entityNameLower === 'mj_bizapps_collaboration: space items')) {
                findings.push({
                    Code: 'EXTERNAL_ROLE_EXCESSIVE_ENTITY_PERMISSION',
                    Severity: 'High',
                    EntityName: entity.Name,
                    RecordID: perm.ID ?? entity.ID,
                    RoleID: perm.RoleID,
                    Message: `External Space Participant role has CanDelete=true on core Collaboration entity '${entity.Name}'.`,
                    Remediation: `Set CanDelete=false for Space Participant on '${entity.Name}'.`,
                });
            }
        }
    }

    // 4. Audit UserRoles for overlapping external+staff bindings, Owner+Participant escalation, and inactive staff bindings
    const relevantRoleIds = [...new Set([participantRoleId, ...staffRoleIds, ...adminRoleIds])];
    const userRoles: SimpleUserRoleRow[] = [];

    if (input.UserIDs && input.UserIDs.length > 0) {
        for (const batch of chunkDistinctIds(input.UserIDs, batchSize)) {
            const urRes = await readEverySimpleRow<SimpleUserRoleRow>(
                rv,
                {
                    EntityName: 'MJ: User Roles',
                    ExtraFilter: buildBatchedInFilter('UserID', batch, dialect),
                    Fields: ['ID', 'UserID', 'RoleID'],
                },
                user,
            );
            batchedQueryCount += urRes.queryCount;
            if (!urRes.ok) {
                throw new Error(`XS-7 failed reading MJ: User Roles: ${urRes.error}`);
            }
            userRoles.push(...urRes.rows);
        }
    } else {
        for (const batch of chunkDistinctIds(relevantRoleIds, batchSize)) {
            const urRes = await readEverySimpleRow<SimpleUserRoleRow>(
                rv,
                {
                    EntityName: 'MJ: User Roles',
                    ExtraFilter: buildBatchedInFilter('RoleID', batch, dialect),
                    Fields: ['ID', 'UserID', 'RoleID'],
                },
                user,
            );
            batchedQueryCount += urRes.queryCount;
            if (!urRes.ok) {
                throw new Error(`XS-7 failed reading MJ: User Roles: ${urRes.error}`);
            }
            userRoles.push(...urRes.rows);
        }
    }

    const rolesByUserId = new Map<string, Set<string>>();
    for (const ur of userRoles) {
        const uid = normalizeAuditUuid(ur.UserID);
        const rid = normalizeAuditUuid(ur.RoleID);
        if (uid && rid) {
            const set = rolesByUserId.get(uid) ?? new Set<string>();
            set.add(rid);
            rolesByUserId.set(uid, set);
        }
    }

    const userMap = new Map<string, SimpleUserRow>();
    for (const batch of chunkDistinctIds([...rolesByUserId.keys()], batchSize)) {
        batchedQueryCount += 1;
        const res = await rv.RunView<SimpleUserRow>(
            {
                EntityName: 'MJ: Users',
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'Name', 'Email', 'Type', 'IsActive'],
                ResultType: 'simple',
                // row-cap-ok: bounded by deduplicated UserID batch (<= 500)
                MaxRows: batch.length,
            },
            user,
        );
        if (!res.Success) {
            throw new Error(`XS-7 failed reading MJ: Users: ${res.ErrorMessage ?? 'unknown error'}`);
        }
        for (const u of res.Results ?? []) {
            const uid = normalizeAuditUuid(u.ID);
            if (uid) {
                userMap.set(uid, u);
            }
        }
    }

    const staffUserIds: string[] = [];
    for (const [uid, roleSet] of rolesByUserId.entries()) {
        const userRow = userMap.get(uid);
        const hasParticipant = roleSet.has(participantRoleId);
        const heldStaffRoles = [...roleSet].filter((rid) => rid !== participantRoleId && staffRoleIds.has(rid));
        const heldAdminRoles = [...roleSet].filter((rid) => rid !== participantRoleId && adminRoleIds.has(rid));
        const isOwnerType = (userRow?.Type ?? '').trim().toLowerCase() === 'owner';

        if (hasParticipant && heldStaffRoles.length > 0) {
            findings.push({
                Code: 'OVERLAPPING_EXTERNAL_STAFF_ROLE',
                Severity: 'Critical',
                EntityName: 'MJ: User Roles',
                RecordID: uid,
                UserID: userRow?.ID ?? uid,
                RoleID: heldStaffRoles[0],
                Message: `User '${userRow?.Email ?? userRow?.ID ?? uid}' holds both the external Space Participant role and internal staff Collaboration role(s): ${heldStaffRoles.join(', ')}.`,
                Remediation: 'Separate external participant accounts from internal staff accounts; remove either the Space Participant role or staff roles.',
            });
        }

        if (hasParticipant && isOwnerType) {
            findings.push({
                Code: 'GLOBAL_ADMIN_ESCALATION',
                Severity: 'Critical',
                EntityName: 'MJ: Users',
                RecordID: userRow?.ID ?? uid,
                UserID: userRow?.ID ?? uid,
                RoleID: participantRoleId,
                Message: `User '${userRow?.Email ?? userRow?.ID ?? uid}' has User.Type='Owner' while holding the external Space Participant role.`,
                Remediation: 'Never assign User.Type=Owner to an external Space Participant account.',
            });
        }

        if (heldStaffRoles.length > 0 && userRow?.IsActive === false) {
            findings.push({
                Code: 'INACTIVE_STAFF_ROLE_BINDING',
                Severity: 'Medium',
                EntityName: 'MJ: Users',
                RecordID: userRow.ID,
                UserID: userRow.ID,
                RoleID: heldStaffRoles[0],
                Message: `Inactive user '${userRow.Email ?? userRow.ID}' still retains active staff Collaboration role binding(s): ${heldStaffRoles.join(', ')}.`,
                Remediation: 'Revoke staff Collaboration UserRole assignments when deactivating a staff user.',
            });
        }

        if (heldAdminRoles.length > 0 && allowedAdminRoleSet) {
            const unauthorizedAdminRoles = heldAdminRoles.filter((rid) => !allowedAdminRoleSet.has(rid));
            if (unauthorizedAdminRoles.length > 0) {
                findings.push({
                    Code: 'LEAST_PRIVILEGE_BOUNDARY_VIOLATION',
                    Severity: 'High',
                    EntityName: 'MJ: User Roles',
                    RecordID: uid,
                    UserID: userRow?.ID ?? uid,
                    RoleID: unauthorizedAdminRoles[0],
                    Message: `User '${userRow?.Email ?? userRow?.ID ?? uid}' holds admin Collaboration role(s) outside AllowedAdminRoleIDs: ${unauthorizedAdminRoles.join(', ')}.`,
                    Remediation: 'Reassign the user to a non-administrative staff role adhering to least privilege.',
                });
            }
        }

        if (heldStaffRoles.length > 0 && !hasParticipant && userRow?.IsActive !== false) {
            staffUserIds.push(uid);
        }
    }

    // 5. Verify internal staff users are not misconfigured in Shared-only seats without Team visibility when active on spaces
    if (staffUserIds.length > 0) {
        for (const batch of chunkDistinctIds(staffUserIds, batchSize)) {
            const seatRes = await readEverySimpleRow<SimpleSpaceMemberRow>(
                rv,
                {
                    EntityName: 'MJ_BizApps_Collaboration: Space Members',
                    ExtraFilter: `${buildBatchedInFilter('UserID', batch, dialect)} AND Status = 'Active'`,
                    Fields: ['ID', 'SpaceID', 'UserID', 'Band', 'Status'],
                },
                user,
            );
            batchedQueryCount += seatRes.queryCount;
            if (!seatRes.ok) {
                throw new Error(`XS-7 failed reading Space Members for staff separation check: ${seatRes.error}`);
            }
            for (const seat of seatRes.rows) {
                if (seat.Band === 'Shared') {
                    findings.push({
                        Code: 'LEAST_PRIVILEGE_BOUNDARY_VIOLATION',
                        Severity: 'Medium',
                        EntityName: 'MJ_BizApps_Collaboration: Space Members',
                        RecordID: seat.ID,
                        UserID: seat.UserID,
                        Message: `Staff user '${seat.UserID}' holds an active Space Member seat '${seat.ID}' restricted to Band='Shared', indicating a mismatched external-style seat on a staff account.`,
                        Remediation: 'Seat internal staff accounts with a Team-band role or remove extraneous external-band seats.',
                    });
                }
            }
        }
    }

    return {
        Passed: findings.length === 0,
        AuditedAt: new Date().toISOString(),
        Dialect: dialect,
        Stats: {
            AuthorizationsChecked: allCollaborationAuthIds.length,
            AuthorizationRolesChecked: authRoles.length,
            ApplicationRolesChecked: appRolesRes.rows.length,
            UsersChecked: userMap.size,
            BatchedQueryCount: batchedQueryCount,
        },
        Findings: findings,
    };
}

/**
 * Typed `BaseRemotableOperation` exposing the XS-7 Staff Role Audit.
 * Enforces server-side `ContextUser` administrative authorization and rejects Magic Link / external participant callers.
 */
@RegisterClass(BaseRemotableOperation, STAFF_ROLE_AUDIT_OPERATION_KEY)
export class StaffRoleAuditOperation extends BaseRemotableOperation<StaffRoleAuditInput, StaffRoleAuditResult> {
    public override readonly OperationKey = STAFF_ROLE_AUDIT_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: StaffRoleAuditInput,
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
        input: StaffRoleAuditInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<StaffRoleAuditResult> {
        return runStaffRoleAudit(provider, user, input ?? {});
    }
}
