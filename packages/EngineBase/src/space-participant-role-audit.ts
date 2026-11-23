import {
    BaseRemotableOperation,
    type EntityFieldInfo,
    type EntityInfo,
    type IMetadataProvider,
    type RemoteOpServerContext,
    RemoteOperationError,
    RunView,
    type UserInfo,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { type CollaborationSettings, typeSeatsAudience } from '@mj-biz-apps/collaboration-core';
import {
    type AuditSeverity,
    authorizeSecurityAuditCaller,
    buildBatchedInFilter,
    chunkDistinctIds,
    COLLABORATION_SCHEMA_NAME,
    DEFAULT_AUDIT_BATCH_SIZE,
    detectAuditSqlDialect,
    extractRecordUuid,
    findCollaborationAuthorizationInList,
    normalizeAuditUuid,
    PARTICIPANT_ROLE_ID,
    quoteAuditIdentifier,
    readEverySimpleRow,
    type SqlDialect,
    STAFF_COLLABORATION_AUTHORIZATION_NAMES,
} from './security-audit-types.js';

export const SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY = 'Collaboration.SpaceParticipantRoleAudit';

export type SpaceParticipantRoleAuditFindingCode =
    | 'ELEVATED_EXTERNAL_ROLE'
    | 'EXTERNAL_TEAM_BAND_EXPOSURE'
    | 'EXTERNAL_ON_STAFF_ONLY_SPACE'
    | 'CROSS_SPACE_ROLE_LEAK'
    | 'EXTERNAL_SPACE_OWNER'
    | 'BAND_ROLE_MISMATCH'
    | 'INVALID_SPACE_BINDING'
    | 'ORPHANED_SPACE_BINDING'
    | 'INACTIVE_MEMBER_ACCOUNT'
    | 'INACTIVE_SPACE_ROLE_TYPE'
    | 'INVALID_POLYMORPHIC_METADATA'
    | 'INVALID_POLYMORPHIC_LINK'
    | 'ORPHANED_POLYMORPHIC_LINK'
    | 'CROSS_SPACE_POLYMORPHIC_LINK';

export interface SpaceParticipantRoleAuditInput {
    /** Optional subset of Space IDs to audit. When omitted, audits all active Space Members. */
    SpaceIDs?: readonly string[];
    /** Whether to audit polymorphic FK links via `EntityField.EntityIDFieldName` metadata (default: true). */
    IncludePolymorphicLinkCheck?: boolean;
    /** Explicit SQL dialect override (`'mssql'` | `'postgresql'`); auto-detected from provider when omitted. */
    Dialect?: SqlDialect;
    /** Batch size for `ID IN (...)` lookups (default: 200, max: 500). */
    BatchSize?: number;
    /** Canonical external participant RoleID override (defaults to `PARTICIPANT_ROLE_ID`). */
    ParticipantRoleID?: string;
}

export interface SpaceParticipantRoleAuditFinding {
    Code: SpaceParticipantRoleAuditFindingCode;
    Severity: AuditSeverity;
    EntityName: string;
    RecordID: string;
    SpaceID?: string;
    UserID?: string;
    FieldName?: string;
    EntityIDFieldName?: string;
    Message: string;
    Remediation: string;
}

export interface SpaceParticipantRoleAuditStats {
    MembersChecked: number;
    SpacesChecked: number;
    UsersChecked: number;
    PolymorphicEntitiesChecked: number;
    PolymorphicLinksChecked: number;
    BatchedQueryCount: number;
}

export interface SpaceParticipantRoleAuditResult {
    Passed: boolean;
    AuditedAt: string;
    Dialect: SqlDialect;
    Stats: SpaceParticipantRoleAuditStats;
    Findings: SpaceParticipantRoleAuditFinding[];
}

interface SimpleSpaceMemberRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    SpaceRoleTypeID: string;
    Band: string;
    Status: string;
}

interface SimpleSpaceRow {
    ID: string;
    Name?: string | null;
    ParentID: string | null;
    SpaceTypeID: string;
    InheritsMembership: boolean;
    OwnerID: string;
    StatusID?: string | null;
    ClosedAt?: string | Date | null;
}

interface SimpleSpaceTypeRow {
    ID: string;
    Code?: string | null;
    Name?: string | null;
    Configuration?: string | null;
    IsActive?: boolean | null;
}

interface SimpleSpaceRoleTypeRow {
    ID: string;
    Code?: string | null;
    Name?: string | null;
    Level: number;
    MaxGrantableLevel: number;
    CanInvite: boolean;
    CanPromoteBand: boolean;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
    CanContribute: boolean;
    IsActive?: boolean | null;
}

interface SimpleUserRow {
    ID: string;
    Name?: string | null;
    Email?: string | null;
    Type?: string | null;
    IsActive?: boolean | null;
}

interface SimpleUserRoleRow {
    ID: string;
    UserID: string;
    RoleID: string;
}

interface SimpleAuthRoleRow {
    ID: string;
    AuthorizationID: string;
    RoleID: string;
    Type: string;
}

interface SimplePolymorphicRow {
    ID: string;
    SpaceID?: string | null;
    [field: string]: string | number | boolean | null | undefined;
}

interface SimpleTargetRow {
    ID?: string | null;
    SpaceID?: string | null;
    [field: string]: string | number | boolean | null | undefined;
}

function parseSpaceTypeAudience(configuration: string | null | undefined): 'StaffOnly' | 'StaffAndParticipants' {
    if (!configuration) {
        return 'StaffAndParticipants';
    }
    try {
        return typeSeatsAudience(JSON.parse(configuration) as CollaborationSettings);
    } catch {
        return 'StaffAndParticipants';
    }
}

function isCollaborationPolymorphicEntity(entity: EntityInfo): boolean {
    const schema = (entity.SchemaName ?? '').trim().toLowerCase();
    const name = (entity.Name ?? '').trim().toLowerCase();
    return schema === COLLABORATION_SCHEMA_NAME.toLowerCase() || name.startsWith('mj_bizapps_collaboration:');
}

function resolvePrimaryKeyFieldName(entity: EntityInfo): string {
    const pk = entity.Fields.find((f) => f.IsPrimaryKey);
    return pk?.Name ?? 'ID';
}

function readRowStringField(
    row: Record<string, string | number | boolean | null | undefined>,
    fieldName: string,
): string | null {
    const raw = row[fieldName];
    if (typeof raw !== 'string') {
        return null;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * XS-1 Space Participant Role Audit:
 * Inspects Space Members, Spaces, Space Types, Space Role Types, Users, User Roles, and polymorphic links
 * (strictly via `EntityField.EntityIDFieldName` metadata, never column-name guessing) using `RunView` with
 * `ResultType: 'simple'` and batched `ExtraFilter` (`ID IN (...)`) with dual-dialect SQL parity.
 */
export async function runSpaceParticipantRoleAudit(
    provider: IMetadataProvider,
    user: UserInfo,
    input: SpaceParticipantRoleAuditInput = {},
): Promise<SpaceParticipantRoleAuditResult> {
    const dialect = detectAuditSqlDialect(provider, input.Dialect);
    const batchSize =
        typeof input.BatchSize === 'number' && Number.isInteger(input.BatchSize) && input.BatchSize > 0
            ? Math.min(input.BatchSize, 500)
            : DEFAULT_AUDIT_BATCH_SIZE;
    const participantRoleId = normalizeAuditUuid(input.ParticipantRoleID ?? PARTICIPANT_ROLE_ID) ?? PARTICIPANT_ROLE_ID.toLowerCase();
    const rv = RunView.FromMetadataProvider(provider);
    const findings: SpaceParticipantRoleAuditFinding[] = [];
    let batchedQueryCount = 0;

    // 1. Load Space Members (filtered by SpaceIDs if provided, else all non-Removed members via keyset paging)
    const members: SimpleSpaceMemberRow[] = [];
    const nonRemovedStatusFilter = `${quoteAuditIdentifier('Status', dialect)} <> 'Removed'`;
    if (input.SpaceIDs && input.SpaceIDs.length > 0) {
        const spaceBatches = chunkDistinctIds(input.SpaceIDs, batchSize);
        for (const batch of spaceBatches) {
            const spaceFilter = `${buildBatchedInFilter('SpaceID', batch, dialect)} AND ${nonRemovedStatusFilter}`;
            const pageRes = await readEverySimpleRow<SimpleSpaceMemberRow>(
                rv,
                {
                    EntityName: 'MJ_BizApps_Collaboration: Space Members',
                    ExtraFilter: spaceFilter,
                    Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Band', 'Status'],
                },
                user,
            );
            batchedQueryCount += pageRes.queryCount;
            if (!pageRes.ok) {
                throw new Error(`XS-1 Space Participant Role Audit failed reading Space Members: ${pageRes.error}`);
            }
            members.push(...pageRes.rows);
        }
    } else {
        const pageRes = await readEverySimpleRow<SimpleSpaceMemberRow>(
            rv,
            {
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                ExtraFilter: nonRemovedStatusFilter,
                Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Band', 'Status'],
            },
            user,
        );
        batchedQueryCount += pageRes.queryCount;
        if (!pageRes.ok) {
            throw new Error(`XS-1 Space Participant Role Audit failed reading Space Members: ${pageRes.error}`);
        }
        members.push(...pageRes.rows);
    }

    // 2. Batch-load referenced Space Role Types
    const roleTypeIds = members.map((m) => m.SpaceRoleTypeID);
    const roleTypeMap = new Map<string, SimpleSpaceRoleTypeRow>();
    for (const batch of chunkDistinctIds(roleTypeIds, batchSize)) {
        batchedQueryCount += 1;
        const res = await rv.RunView<SimpleSpaceRoleTypeRow>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Space Role Types',
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: [
                    'ID',
                    'Code',
                    'Name',
                    'Level',
                    'MaxGrantableLevel',
                    'CanInvite',
                    'CanPromoteBand',
                    'CanSeeTeamBand',
                    'IsOwnerRole',
                    'CanContribute',
                    'IsActive',
                ],
                ResultType: 'simple',
                // row-cap-ok: bounded by deduplicated SpaceRoleTypeID batch (<= 500)
                MaxRows: batch.length,
            },
            user,
        );
        if (!res.Success) {
            throw new Error(`XS-1 failed reading Space Role Types: ${res.ErrorMessage ?? 'unknown error'}`);
        }
        for (const rt of res.Results ?? []) {
            const cleanId = normalizeAuditUuid(rt.ID);
            if (cleanId) {
                roleTypeMap.set(cleanId, rt);
            }
        }
    }

    // 3. Batch-load referenced Spaces (plus their ancestor/descendant inheritance chain)
    const spaceMap = new Map<string, SimpleSpaceRow>();
    const childrenByParentId = new Map<string, SimpleSpaceRow[]>();
    const initialSpaceIds = new Set<string>();
    for (const m of members) {
        const sid = normalizeAuditUuid(m.SpaceID);
        if (sid) {
            initialSpaceIds.add(sid);
        }
    }
    for (const sid of input.SpaceIDs ?? []) {
        const clean = normalizeAuditUuid(sid);
        if (clean) {
            initialSpaceIds.add(clean);
        }
    }

    let pendingSpaceIds = [...initialSpaceIds];
    if (!input.SpaceIDs || input.SpaceIDs.length === 0) {
        const allSpacesRes = await readEverySimpleRow<SimpleSpaceRow>(
            rv,
            {
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                Fields: ['ID', 'Name', 'ParentID', 'SpaceTypeID', 'InheritsMembership', 'OwnerID', 'StatusID', 'ClosedAt'],
            },
            user,
        );
        batchedQueryCount += allSpacesRes.queryCount;
        if (!allSpacesRes.ok) {
            throw new Error(`XS-1 failed reading Spaces: ${allSpacesRes.error}`);
        }
        for (const sp of allSpacesRes.rows) {
            const cleanId = normalizeAuditUuid(sp.ID);
            if (cleanId) {
                spaceMap.set(cleanId, sp);
                const pid = normalizeAuditUuid(sp.ParentID);
                if (pid) {
                    const list = childrenByParentId.get(pid) ?? [];
                    list.push(sp);
                    childrenByParentId.set(pid, list);
                }
            }
        }
        pendingSpaceIds = [];
    }

    while (pendingSpaceIds.length > 0) {
        const nextLevelIds: string[] = [];
        for (const batch of chunkDistinctIds(pendingSpaceIds, batchSize)) {
            batchedQueryCount += 1;
            const res = await rv.RunView<SimpleSpaceRow>(
                {
                    EntityName: 'MJ_BizApps_Collaboration: Spaces',
                    ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                    Fields: ['ID', 'Name', 'ParentID', 'SpaceTypeID', 'InheritsMembership', 'OwnerID', 'StatusID', 'ClosedAt'],
                    ResultType: 'simple',
                    // row-cap-ok: bounded by deduplicated SpaceID batch (<= 500)
                    MaxRows: batch.length,
                },
                user,
            );
            if (!res.Success) {
                throw new Error(`XS-1 failed reading Spaces: ${res.ErrorMessage ?? 'unknown error'}`);
            }
            for (const sp of res.Results ?? []) {
                const cleanId = normalizeAuditUuid(sp.ID);
                if (cleanId) {
                    spaceMap.set(cleanId, sp);
                    const parentId = normalizeAuditUuid(sp.ParentID);
                    if (parentId && !spaceMap.has(parentId)) {
                        nextLevelIds.push(parentId);
                    }
                }
            }
        }
        pendingSpaceIds = nextLevelIds;
    }

    // Also batch-load direct child spaces of all audited spaces when scoped to SpaceIDs to detect inheritance leaks downward
    if (input.SpaceIDs && input.SpaceIDs.length > 0 && spaceMap.size > 0) {
        for (const batch of chunkDistinctIds([...spaceMap.keys()], batchSize)) {
            const childRes = await readEverySimpleRow<SimpleSpaceRow>(
                rv,
                {
                    EntityName: 'MJ_BizApps_Collaboration: Spaces',
                    ExtraFilter: buildBatchedInFilter('ParentID', batch, dialect),
                    Fields: ['ID', 'Name', 'ParentID', 'SpaceTypeID', 'InheritsMembership', 'OwnerID', 'StatusID', 'ClosedAt'],
                },
                user,
            );
            batchedQueryCount += childRes.queryCount;
            if (!childRes.ok) {
                throw new Error(`XS-1 failed reading child Spaces: ${childRes.error}`);
            }
            for (const child of childRes.rows) {
                const cid = normalizeAuditUuid(child.ID);
                const pid = normalizeAuditUuid(child.ParentID);
                if (cid && !spaceMap.has(cid)) {
                    spaceMap.set(cid, child);
                }
                if (pid) {
                    const list = childrenByParentId.get(pid) ?? [];
                    list.push(child);
                    childrenByParentId.set(pid, list);
                }
            }
        }
    }

    // 4. Batch-load referenced Space Types
    const typeMap = new Map<string, SimpleSpaceTypeRow>();
    const spaceTypeIds = [...spaceMap.values()].map((s) => s.SpaceTypeID);
    for (const batch of chunkDistinctIds(spaceTypeIds, batchSize)) {
        batchedQueryCount += 1;
        const res = await rv.RunView<SimpleSpaceTypeRow>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Space Types',
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'Code', 'Name', 'Configuration', 'IsActive'],
                ResultType: 'simple',
                // row-cap-ok: bounded by deduplicated SpaceTypeID batch (<= 500)
                MaxRows: batch.length,
            },
            user,
        );
        if (!res.Success) {
            throw new Error(`XS-1 failed reading Space Types: ${res.ErrorMessage ?? 'unknown error'}`);
        }
        for (const st of res.Results ?? []) {
            const cleanId = normalizeAuditUuid(st.ID);
            if (cleanId) {
                typeMap.set(cleanId, st);
            }
        }
    }

    // 5. Batch-load referenced Users (both members and space OwnerIDs) and User Roles
    const allUserIds = [
        ...members.map((m) => m.UserID),
        ...[...spaceMap.values()].map((s) => s.OwnerID),
    ];
    const userMap = new Map<string, SimpleUserRow>();
    for (const batch of chunkDistinctIds(allUserIds, batchSize)) {
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
            throw new Error(`XS-1 failed reading Users: ${res.ErrorMessage ?? 'unknown error'}`);
        }
        for (const u of res.Results ?? []) {
            const cleanId = normalizeAuditUuid(u.ID);
            if (cleanId) {
                userMap.set(cleanId, u);
            }
        }
    }

    const userRoleIdsMap = new Map<string, Set<string>>();
    for (const batch of chunkDistinctIds(allUserIds, batchSize)) {
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
            throw new Error(`XS-1 failed reading User Roles: ${urRes.error}`);
        }
        for (const ur of urRes.rows) {
            const uid = normalizeAuditUuid(ur.UserID);
            const rid = normalizeAuditUuid(ur.RoleID);
            if (uid && rid) {
                const set = userRoleIdsMap.get(uid) ?? new Set<string>();
                set.add(rid);
                userRoleIdsMap.set(uid, set);
            }
        }
    }

    // Determine which RoleIDs hold staff-level Collaboration authorizations via metadata (never hardcoded role names)
    const staffAuthRoleIds = new Set<string>();
    const authorizations = provider.Authorizations ?? [];
    const staffAuthIds = new Set<string>();
    for (const authName of STAFF_COLLABORATION_AUTHORIZATION_NAMES) {
        const auth = findCollaborationAuthorizationInList(authorizations, authName);
        const cleanAuthId = normalizeAuditUuid(auth?.ID);
        if (cleanAuthId) {
            staffAuthIds.add(cleanAuthId);
        }
    }
    if (staffAuthIds.size > 0) {
        if (provider.AuthorizationRoles && provider.AuthorizationRoles.length > 0) {
            for (const ar of provider.AuthorizationRoles) {
                const aid = normalizeAuditUuid(ar.AuthorizationID);
                const rid = normalizeAuditUuid(ar.RoleID);
                const isAllow = (ar.Type ?? 'Allow').trim().toLowerCase() !== 'deny';
                if (aid && rid && isAllow && staffAuthIds.has(aid)) {
                    staffAuthRoleIds.add(rid);
                }
            }
        } else {
            for (const batch of chunkDistinctIds([...staffAuthIds], batchSize)) {
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
                if (arRes.ok) {
                    for (const ar of arRes.rows) {
                        const rid = normalizeAuditUuid(ar.RoleID);
                        const isAllow = (ar.Type ?? 'Allow').trim().toLowerCase() !== 'deny';
                        if (rid && isAllow) {
                            staffAuthRoleIds.add(rid);
                        }
                    }
                }
            }
        }
    }

    const isExternalOnlyUser = (uid: string): boolean => {
        const roles = userRoleIdsMap.get(uid);
        if (!roles || !roles.has(participantRoleId)) {
            return false;
        }
        const userRow = userMap.get(uid);
        if ((userRow?.Type ?? '').trim().toLowerCase() === 'owner') {
            return false;
        }
        for (const rid of roles) {
            if (rid !== participantRoleId && staffAuthRoleIds.has(rid)) {
                return false;
            }
        }
        return true;
    };

    const holdsParticipantRole = (uid: string): boolean => {
        return userRoleIdsMap.get(uid)?.has(participantRoleId) ?? false;
    };

    // 6. Evaluate Space Owner external check
    for (const [spaceId, space] of spaceMap.entries()) {
        const ownerId = normalizeAuditUuid(space.OwnerID);
        if (!ownerId) {
            findings.push({
                Code: 'INVALID_SPACE_BINDING',
                Severity: 'High',
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                RecordID: space.ID,
                SpaceID: space.ID,
                Message: `Space '${space.Name ?? space.ID}' has an invalid or missing OwnerID.`,
                Remediation: 'Assign a valid active internal staff OwnerID on the Space record.',
            });
            continue;
        }
        if (isExternalOnlyUser(ownerId)) {
            findings.push({
                Code: 'EXTERNAL_SPACE_OWNER',
                Severity: 'High',
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                RecordID: space.ID,
                SpaceID: space.ID,
                UserID: ownerId,
                Message: `External Space Participant '${ownerId}' is assigned as OwnerID of Space '${space.Name ?? space.ID}'.`,
                Remediation: 'Reassign Space.OwnerID to an internal staff user.',
            });
        }
    }

    // 7. Evaluate every Space Member binding
    for (const member of members) {
        const spaceId = normalizeAuditUuid(member.SpaceID);
        const userId = normalizeAuditUuid(member.UserID);
        const roleTypeId = normalizeAuditUuid(member.SpaceRoleTypeID);
        const space = spaceId ? spaceMap.get(spaceId) : undefined;
        const memberUser = userId ? userMap.get(userId) : undefined;
        const roleType = roleTypeId ? roleTypeMap.get(roleTypeId) : undefined;

        if (!spaceId || !space) {
            findings.push({
                Code: 'ORPHANED_SPACE_BINDING',
                Severity: 'High',
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                RecordID: member.ID,
                SpaceID: member.SpaceID,
                UserID: member.UserID,
                Message: `Space Member '${member.ID}' references missing Space '${member.SpaceID}'.`,
                Remediation: 'Remove or deactivate the orphaned Space Member seat.',
            });
            continue;
        }

        if (!userId || !memberUser) {
            findings.push({
                Code: 'ORPHANED_SPACE_BINDING',
                Severity: 'High',
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                RecordID: member.ID,
                SpaceID: space.ID,
                UserID: member.UserID,
                Message: `Space Member '${member.ID}' references missing User '${member.UserID}'.`,
                Remediation: 'Remove or deactivate the orphaned Space Member seat.',
            });
            continue;
        }

        if (memberUser.IsActive === false && member.Status === 'Active') {
            findings.push({
                Code: 'INACTIVE_MEMBER_ACCOUNT',
                Severity: 'Medium',
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                RecordID: member.ID,
                SpaceID: space.ID,
                UserID: memberUser.ID,
                Message: `Active Space Member seat '${member.ID}' is bound to inactive user '${memberUser.ID}'.`,
                Remediation: "Transition the Space Member status to 'Removed' when a user account is deactivated.",
            });
        }

        if (!roleTypeId || !roleType) {
            findings.push({
                Code: 'INVALID_SPACE_BINDING',
                Severity: 'High',
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                RecordID: member.ID,
                SpaceID: space.ID,
                UserID: memberUser.ID,
                Message: `Space Member '${member.ID}' references missing SpaceRoleType '${member.SpaceRoleTypeID}'.`,
                Remediation: 'Assign a valid active SpaceRoleTypeID to the Space Member.',
            });
            continue;
        }

        if (roleType.IsActive === false && member.Status === 'Active') {
            findings.push({
                Code: 'INACTIVE_SPACE_ROLE_TYPE',
                Severity: 'Medium',
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                RecordID: member.ID,
                SpaceID: space.ID,
                UserID: memberUser.ID,
                Message: `Active Space Member '${member.ID}' uses inactive SpaceRoleType '${roleType.Name ?? roleType.ID}'.`,
                Remediation: 'Reassign the seat to an active SpaceRoleType.',
            });
        }

        // Band vs RoleType flag consistency
        if (member.Band === 'Team' && !roleType.CanSeeTeamBand) {
            findings.push({
                Code: 'BAND_ROLE_MISMATCH',
                Severity: 'Critical',
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                RecordID: member.ID,
                SpaceID: space.ID,
                UserID: memberUser.ID,
                Message: `Space Member '${member.ID}' has Band='Team' while SpaceRoleType '${roleType.Name ?? roleType.ID}' forbids CanSeeTeamBand.`,
                Remediation: "Downgrade SpaceMember.Band to 'Shared' or assign a Team-authorized role to internal staff.",
            });
        }

        const isParticipant = holdsParticipantRole(userId);
        const isExternal = isExternalOnlyUser(userId);
        const spaceType = typeMap.get(normalizeAuditUuid(space.SpaceTypeID) ?? '');
        const audience = parseSpaceTypeAudience(spaceType?.Configuration);

        if (isExternal) {
            // External participant must never hold elevated space role capabilities
            if (roleType.IsOwnerRole || roleType.CanSeeTeamBand || roleType.CanPromoteBand) {
                findings.push({
                    Code: 'ELEVATED_EXTERNAL_ROLE',
                    Severity: 'Critical',
                    EntityName: 'MJ_BizApps_Collaboration: Space Members',
                    RecordID: member.ID,
                    SpaceID: space.ID,
                    UserID: memberUser.ID,
                    Message: `External participant '${memberUser.ID}' holds elevated role '${roleType.Name ?? roleType.Code ?? roleType.ID}' (IsOwnerRole=${String(roleType.IsOwnerRole)}, CanSeeTeamBand=${String(roleType.CanSeeTeamBand)}, CanPromoteBand=${String(roleType.CanPromoteBand)}).`,
                    Remediation: 'Assign an external-safe SpaceRoleType (CanSeeTeamBand=false, CanPromoteBand=false, IsOwnerRole=false) such as client-admin, client-member, or guest.',
                });
            }

            if (member.Band === 'Team') {
                findings.push({
                    Code: 'EXTERNAL_TEAM_BAND_EXPOSURE',
                    Severity: 'Critical',
                    EntityName: 'MJ_BizApps_Collaboration: Space Members',
                    RecordID: member.ID,
                    SpaceID: space.ID,
                    UserID: memberUser.ID,
                    Message: `External participant '${memberUser.ID}' is seated in Band='Team' on Space '${space.Name ?? space.ID}'.`,
                    Remediation: "External participants must remain strictly in Band='Shared'.",
                });
            }

            if (audience === 'StaffOnly') {
                findings.push({
                    Code: 'EXTERNAL_ON_STAFF_ONLY_SPACE',
                    Severity: 'Critical',
                    EntityName: 'MJ_BizApps_Collaboration: Space Members',
                    RecordID: member.ID,
                    SpaceID: space.ID,
                    UserID: memberUser.ID,
                    Message: `External participant '${memberUser.ID}' is seated on StaffOnly Space '${space.Name ?? space.ID}' (SpaceType '${spaceType?.Name ?? spaceType?.Code ?? space.SpaceTypeID}').`,
                    Remediation: 'Remove the external participant seat from StaffOnly spaces or move the collaboration into a StaffAndParticipants space.',
                });
            }

            // Cross-space role leak via inheritance into StaffOnly child spaces
            if (member.Status === 'Active') {
                const queue = [...(childrenByParentId.get(spaceId) ?? [])];
                const visited = new Set<string>();
                while (queue.length > 0) {
                    const child = queue.shift()!;
                    const childId = normalizeAuditUuid(child.ID);
                    if (!childId || visited.has(childId)) {
                        continue;
                    }
                    visited.add(childId);
                    if (child.InheritsMembership) {
                        const childType = typeMap.get(normalizeAuditUuid(child.SpaceTypeID) ?? '');
                        if (parseSpaceTypeAudience(childType?.Configuration) === 'StaffOnly') {
                            findings.push({
                                Code: 'CROSS_SPACE_ROLE_LEAK',
                                Severity: 'Critical',
                                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                                RecordID: member.ID,
                                SpaceID: child.ID,
                                UserID: memberUser.ID,
                                Message: `External participant seat '${member.ID}' on parent Space '${space.Name ?? space.ID}' inherits into StaffOnly child Space '${child.Name ?? child.ID}'.`,
                                Remediation: 'Set InheritsMembership=false on the StaffOnly child space or remove the external seat from the parent space.',
                            });
                        }
                        for (const grandChild of childrenByParentId.get(childId) ?? []) {
                            queue.push(grandChild);
                        }
                    }
                }
            }
        } else if (isParticipant && member.Band === 'Team') {
            findings.push({
                Code: 'EXTERNAL_TEAM_BAND_EXPOSURE',
                Severity: 'High',
                EntityName: 'MJ_BizApps_Collaboration: Space Members',
                RecordID: member.ID,
                SpaceID: space.ID,
                UserID: memberUser.ID,
                Message: `User '${memberUser.ID}' holds Space Participant role and is seated in Band='Team' on Space '${space.Name ?? space.ID}'.`,
                Remediation: 'Separate staff and external participant accounts before granting Team band access.',
            });
        }
    }

    // 8. Polymorphic FK link integrity via EntityField.EntityIDFieldName metadata (never heuristic guessing)
    let polymorphicEntitiesChecked = 0;
    let polymorphicLinksChecked = 0;
    if (input.IncludePolymorphicLinkCheck !== false) {
        const collabEntities = (provider.Entities ?? []).filter(isCollaborationPolymorphicEntity);
        const targetRecordGroups = new Map<string, Array<{
            sourceEntityName: string;
            sourceRowId: string;
            sourceSpaceId: string | null;
            fieldName: string;
            entityIdFieldName: string;
            targetRecordUuid: string;
        }>>();

        for (const entity of collabEntities) {
            const polyFields: EntityFieldInfo[] = entity.Fields.filter(
                (f) => typeof f.EntityIDFieldName === 'string' && f.EntityIDFieldName.trim().length > 0,
            );
            if (polyFields.length === 0) {
                continue;
            }
            polymorphicEntitiesChecked += 1;

            const validPolyPairs: Array<{ payloadField: string; discriminatorField: string }> = [];
            for (const pf of polyFields) {
                const discriminatorName = pf.EntityIDFieldName.trim();
                const discriminatorExists = entity.Fields.some(
                    (candidate) => candidate.Name.trim().toLowerCase() === discriminatorName.toLowerCase(),
                );
                if (!discriminatorExists) {
                    findings.push({
                        Code: 'INVALID_POLYMORPHIC_METADATA',
                        Severity: 'High',
                        EntityName: entity.Name,
                        RecordID: entity.ID,
                        FieldName: pf.Name,
                        EntityIDFieldName: discriminatorName,
                        Message: `Entity '${entity.Name}' field '${pf.Name}' declares EntityIDFieldName='${discriminatorName}', which does not exist on '${entity.Name}'.`,
                        Remediation: 'Fix EntityField.EntityIDFieldName metadata to point to the valid discriminator EntityID field.',
                    });
                    continue;
                }
                validPolyPairs.push({ payloadField: pf.Name, discriminatorField: discriminatorName });
            }

            if (validPolyPairs.length === 0) {
                continue;
            }

            const hasSpaceIdField = entity.Fields.some((f) => f.Name.trim().toLowerCase() === 'spaceid');
            const selectFields = [
                resolvePrimaryKeyFieldName(entity),
                ...(hasSpaceIdField ? ['SpaceID'] : []),
                ...new Set(validPolyPairs.flatMap((pair) => [pair.payloadField, pair.discriminatorField])),
            ];

            const polyRows: SimplePolymorphicRow[] = [];
            if (hasSpaceIdField && input.SpaceIDs && input.SpaceIDs.length > 0) {
                for (const batch of chunkDistinctIds(input.SpaceIDs, batchSize)) {
                    const res = await readEverySimpleRow<SimplePolymorphicRow>(
                        rv,
                        {
                            EntityName: entity.Name,
                            ExtraFilter: buildBatchedInFilter('SpaceID', batch, dialect),
                            Fields: selectFields,
                        },
                        user,
                    );
                    batchedQueryCount += res.queryCount;
                    if (!res.ok) {
                        throw new Error(`XS-1 failed reading polymorphic rows from ${entity.Name}: ${res.error}`);
                    }
                    polyRows.push(...res.rows);
                }
            } else {
                const res = await readEverySimpleRow<SimplePolymorphicRow>(
                    rv,
                    {
                        EntityName: entity.Name,
                        Fields: selectFields,
                    },
                    user,
                );
                batchedQueryCount += res.queryCount;
                if (!res.ok) {
                    throw new Error(`XS-1 failed reading polymorphic rows from ${entity.Name}: ${res.error}`);
                }
                polyRows.push(...res.rows);
            }

            for (const row of polyRows) {
                const sourceSpaceId = hasSpaceIdField ? normalizeAuditUuid(readRowStringField(row, 'SpaceID')) : null;
                for (const pair of validPolyPairs) {
                    const rawPayload = readRowStringField(row, pair.payloadField);
                    const rawDiscriminator = readRowStringField(row, pair.discriminatorField);
                    if (!rawPayload && !rawDiscriminator) {
                        continue;
                    }
                    polymorphicLinksChecked += 1;

                    if (rawPayload && !rawDiscriminator) {
                        findings.push({
                            Code: 'INVALID_POLYMORPHIC_LINK',
                            Severity: 'High',
                            EntityName: entity.Name,
                            RecordID: row.ID,
                            ...(sourceSpaceId ? { SpaceID: sourceSpaceId } : {}),
                            FieldName: pair.payloadField,
                            EntityIDFieldName: pair.discriminatorField,
                            Message: `Polymorphic field '${entity.Name}.${pair.payloadField}' is populated ('${rawPayload}') without discriminator '${pair.discriminatorField}'.`,
                            Remediation: `Populate '${pair.discriminatorField}' via EntityIDFieldName metadata or remove the invalid link.`,
                        });
                        continue;
                    }

                    const targetEntityUuid = normalizeAuditUuid(rawDiscriminator);
                    const targetEntityInfo = targetEntityUuid ? provider.EntityByID(targetEntityUuid) : undefined;
                    if (!targetEntityInfo) {
                        findings.push({
                            Code: 'INVALID_POLYMORPHIC_LINK',
                            Severity: 'High',
                            EntityName: entity.Name,
                            RecordID: row.ID,
                            ...(sourceSpaceId ? { SpaceID: sourceSpaceId } : {}),
                            FieldName: pair.payloadField,
                            EntityIDFieldName: pair.discriminatorField,
                            Message: `Discriminator '${entity.Name}.${pair.discriminatorField}' references unknown EntityID '${rawDiscriminator ?? ''}'.`,
                            Remediation: 'Ensure discriminator references a valid MJ Entity ID.',
                        });
                        continue;
                    }

                    if (!rawPayload) {
                        continue;
                    }

                    const targetRecordUuid = extractRecordUuid(rawPayload);
                    if (!targetRecordUuid) {
                        findings.push({
                            Code: 'INVALID_POLYMORPHIC_LINK',
                            Severity: 'Medium',
                            EntityName: entity.Name,
                            RecordID: row.ID,
                            ...(sourceSpaceId ? { SpaceID: sourceSpaceId } : {}),
                            FieldName: pair.payloadField,
                            EntityIDFieldName: pair.discriminatorField,
                            Message: `Polymorphic target '${entity.Name}.${pair.payloadField}' value '${rawPayload}' is not a valid UUID/ID|<uuid> key.`,
                            Remediation: 'Store canonical UUID or ID|<uuid> keys in polymorphic TargetRecordID/RecordID columns.',
                        });
                        continue;
                    }

                    const group = targetRecordGroups.get(targetEntityInfo.Name) ?? [];
                    group.push({
                        sourceEntityName: entity.Name,
                        sourceRowId: row.ID,
                        sourceSpaceId,
                        fieldName: pair.payloadField,
                        entityIdFieldName: pair.discriminatorField,
                        targetRecordUuid,
                    });
                    targetRecordGroups.set(targetEntityInfo.Name, group);
                }
            }
        }

        // Batch-verify every referenced target record exists and respects space boundaries
        for (const [targetEntityName, refs] of targetRecordGroups.entries()) {
            const targetEntity = provider.EntityByName(targetEntityName);
            const targetPkField = targetEntity ? resolvePrimaryKeyFieldName(targetEntity) : 'ID';
            const targetHasSpaceId = targetEntity?.Fields.some((f) => f.Name.trim().toLowerCase() === 'spaceid') ?? false;
            const targetFields = targetHasSpaceId ? [targetPkField, 'SpaceID'] : [targetPkField];
            const foundTargets = new Map<string, SimpleTargetRow>();

            for (const batch of chunkDistinctIds(refs.map((r) => r.targetRecordUuid), batchSize)) {
                batchedQueryCount += 1;
                const res = await rv.RunView<SimpleTargetRow>(
                    {
                        EntityName: targetEntityName,
                        ExtraFilter: buildBatchedInFilter(targetPkField, batch, dialect),
                        Fields: targetFields,
                        ResultType: 'simple',
                        // row-cap-ok: bounded by deduplicated polymorphic target ID batch (<= 500)
                        MaxRows: batch.length,
                    },
                    user,
                );
                if (!res.Success) {
                    throw new Error(`XS-1 failed verifying polymorphic targets on ${targetEntityName}: ${res.ErrorMessage ?? 'unknown error'}`);
                }
                for (const tRow of res.Results ?? []) {
                    const tid = normalizeAuditUuid(readRowStringField(tRow, targetPkField) ?? tRow.ID);
                    if (tid) {
                        foundTargets.set(tid, tRow);
                    }
                }
            }

            for (const ref of refs) {
                const targetRow = foundTargets.get(ref.targetRecordUuid);
                if (!targetRow) {
                    findings.push({
                        Code: 'ORPHANED_POLYMORPHIC_LINK',
                        Severity: 'High',
                        EntityName: ref.sourceEntityName,
                        RecordID: ref.sourceRowId,
                        ...(ref.sourceSpaceId ? { SpaceID: ref.sourceSpaceId } : {}),
                        FieldName: ref.fieldName,
                        EntityIDFieldName: ref.entityIdFieldName,
                        Message: `Polymorphic link '${ref.sourceEntityName}.${ref.fieldName}' points to missing '${targetEntityName}' record '${ref.targetRecordUuid}'.`,
                        Remediation: 'Remove the orphaned polymorphic link or restore the referenced record.',
                    });
                    continue;
                }

                // Cross-space leak check: if both source and target live in Space-scoped Collaboration entities, SpaceIDs must match
                const targetSpaceId = normalizeAuditUuid(targetRow.SpaceID);
                if (ref.sourceSpaceId && targetSpaceId && ref.sourceSpaceId !== targetSpaceId) {
                    findings.push({
                        Code: 'CROSS_SPACE_POLYMORPHIC_LINK',
                        Severity: 'Critical',
                        EntityName: ref.sourceEntityName,
                        RecordID: ref.sourceRowId,
                        SpaceID: ref.sourceSpaceId,
                        FieldName: ref.fieldName,
                        EntityIDFieldName: ref.entityIdFieldName,
                        Message: `Cross-space polymorphic link in '${ref.sourceEntityName}' (Space '${ref.sourceSpaceId}') references '${targetEntityName}' record '${ref.targetRecordUuid}' belonging to Space '${targetSpaceId}'.`,
                        Remediation: 'Restrict polymorphic Space links to target records owned by the same Space.',
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
            MembersChecked: members.length,
            SpacesChecked: spaceMap.size,
            UsersChecked: userMap.size,
            PolymorphicEntitiesChecked: polymorphicEntitiesChecked,
            PolymorphicLinksChecked: polymorphicLinksChecked,
            BatchedQueryCount: batchedQueryCount,
        },
        Findings: findings,
    };
}

/**
 * Typed `BaseRemotableOperation` exposing the XS-1 Space Participant Role Audit.
 * Enforces server-side `ContextUser` administrative authorization and rejects Magic Link / external participant callers.
 */
@RegisterClass(BaseRemotableOperation, SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY)
export class SpaceParticipantRoleAuditOperation extends BaseRemotableOperation<
    SpaceParticipantRoleAuditInput,
    SpaceParticipantRoleAuditResult
> {
    public override readonly OperationKey = SPACE_PARTICIPANT_ROLE_AUDIT_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: SpaceParticipantRoleAuditInput,
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
        input: SpaceParticipantRoleAuditInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<SpaceParticipantRoleAuditResult> {
        return runSpaceParticipantRoleAudit(provider, user, input ?? {});
    }
}
