import {
    type AuthorizationInfo,
    CompositeKey,
    type IMetadataProvider,
    type RunView,
    type UserInfo,
} from '@memberjunction/core';
import { CollaborationEngineBase } from './CollaborationEngineBase.js';

/** Canonical Role ID for external `Space Participant` accounts (`metadata/roles/.roles.json`). */
export const PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';

/** Canonical Collaboration database schema name (`mj-app.json`). */
export const COLLABORATION_SCHEMA_NAME = '__mj_BizAppsCollaboration';

/** Collaboration MJ Application ID (`metadata/applications/.applications.json`). */
export const COLLABORATION_APPLICATION_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';

/** Root Collaboration authorization name (`metadata/authorizations/.authorizations.json`). */
export const COLLABORATION_ROOT_AUTHORIZATION_NAME = 'Collaboration';

/** Staff-level Collaboration child authorizations (`metadata/authorizations/.authorizations.json`). */
export const STAFF_COLLABORATION_AUTHORIZATION_NAMES = [
    'Administer Spaces',
    'Issue Space Invite Links',
    'Configure Spaces',
    'Configure Space Types',
] as const;

/** Lifecycle authorization intentionally shared with space owners (`Close and Reopen Spaces`). */
export const LIFECYCLE_COLLABORATION_AUTHORIZATION_NAME = 'Close and Reopen Spaces';

/** High-privilege admin Collaboration authorizations restricted to administrative roles. */
export const ADMIN_COLLABORATION_AUTHORIZATION_NAMES = [
    'Administer Spaces',
    'Configure Space Types',
] as const;

export type SqlDialect = 'mssql' | 'postgresql';

export type AuditSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFIER_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Default batch size for `ID IN (...)` batched `RunView` lookups. */
export const DEFAULT_AUDIT_BATCH_SIZE = 200;

/** Default page size for keyset pagination via `AfterKey` (no fixed total ceiling). */
export const DEFAULT_AUDIT_PAGE_SIZE = 500;

/** Normalizes and validates a UUID string; returns lowercase UUID or `null`. */
export function normalizeAuditUuid(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!UUID_REGEX.test(trimmed)) {
        return null;
    }
    return trimmed.toLowerCase();
}

/** Strips an optional MJ composite-key prefix (`ID|...`) and returns a normalized UUID if valid. */
export function extractRecordUuid(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    const raw = trimmed.toLowerCase().startsWith('id|') ? trimmed.slice(3) : trimmed;
    return normalizeAuditUuid(raw);
}

/** Detects whether the active metadata provider targets SQL Server (`mssql`) or PostgreSQL (`postgresql`). */
export function detectAuditSqlDialect(
    provider: Pick<IMetadataProvider, 'Entities'> & { PlatformKey?: string } | null | undefined,
    explicit?: SqlDialect,
): SqlDialect {
    if (explicit) {
        return explicit;
    }
    return provider?.PlatformKey?.trim().toLowerCase() === 'postgresql' ? 'postgresql' : 'mssql';
}

/** Quotes a validated SQL identifier for the target dialect (`[Col]` for SQL Server, `"Col"` for PostgreSQL). */
export function quoteAuditIdentifier(identifier: string, dialect: SqlDialect): string {
    const clean = identifier.trim();
    if (!IDENTIFIER_REGEX.test(clean)) {
        throw new Error(`Invalid SQL identifier '${identifier}' in security audit filter.`);
    }
    return dialect === 'postgresql' ? `"${clean}"` : `[${clean}]`;
}

/** Splits an array of IDs into bounded batches, deduplicating case-insensitively. */
export function chunkDistinctIds(ids: readonly (string | null | undefined)[], batchSize: number = DEFAULT_AUDIT_BATCH_SIZE): string[][] {
    const safeBatchSize = Number.isInteger(batchSize) && batchSize > 0 ? Math.min(batchSize, 500) : DEFAULT_AUDIT_BATCH_SIZE;
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
        const clean = normalizeAuditUuid(id);
        if (clean && !seen.has(clean)) {
            seen.add(clean);
            unique.push(clean);
        }
    }
    const batches: string[][] = [];
    for (let offset = 0; offset < unique.length; offset += safeBatchSize) {
        batches.push(unique.slice(offset, offset + safeBatchSize));
    }
    return batches;
}

/** Builds a dual-dialect `ExtraFilter` `IN (...)` predicate over validated UUID values. */
export function buildBatchedInFilter(fieldName: string, ids: readonly string[], dialect: SqlDialect): string {
    const cleanIds = ids
        .map((id) => normalizeAuditUuid(id))
        .filter((id): id is string => id !== null);
    if (cleanIds.length === 0) {
        return '1 = 0';
    }
    const col = quoteAuditIdentifier(fieldName, dialect);
    return `${col} IN (${cleanIds.map((id) => `'${id}'`).join(', ')})`;
}

/** Builds a dual-dialect equality filter over a validated UUID value. */
export function buildUuidEqualsFilter(fieldName: string, id: string, dialect: SqlDialect): string {
    const clean = normalizeAuditUuid(id);
    if (!clean) {
        return '1 = 0';
    }
    return `${quoteAuditIdentifier(fieldName, dialect)} = '${clean}'`;
}

export interface SimpleRowPageQuery {
    EntityName: string;
    ExtraFilter?: string;
    Fields: readonly string[];
    PageSize?: number;
}

/**
 * Reads all matching rows using `RunView` with `ResultType: 'simple'` and deterministic `ID` keyset pagination
 * (`AfterKey`) — never returning partial results from an arbitrary cap and never hydrating `BaseEntity` rows.
 */
export async function readEverySimpleRow<T extends { ID?: string | null }>(
    rv: RunView,
    query: SimpleRowPageQuery,
    user: UserInfo,
): Promise<{ ok: true; rows: T[]; queryCount: number } | { ok: false; error: string; queryCount: number }> {
    const pageSize =
        typeof query.PageSize === 'number' && Number.isInteger(query.PageSize) && query.PageSize > 0
            ? query.PageSize
            : DEFAULT_AUDIT_PAGE_SIZE;
    const fields = query.Fields.includes('ID') ? [...query.Fields] : ['ID', ...query.Fields];
    const rows: T[] = [];
    const seen = new Set<string>();
    let afterId: string | undefined;
    let queryCount = 0;

    for (;;) {
        queryCount += 1;
        const result = await rv.RunView<T>(
            {
                EntityName: query.EntityName,
                ExtraFilter: query.ExtraFilter,
                Fields: fields,
                OrderBy: 'ID ASC',
                MaxRows: pageSize,
                ...(afterId ? { AfterKey: CompositeKey.FromID(afterId) } : {}),
                ResultType: 'simple',
            },
            user,
        );
        if (!result.Success) {
            return {
                ok: false,
                error: result.ErrorMessage ?? `RunView failed for ${query.EntityName}`,
                queryCount,
            };
        }
        const pageRows = result.Results ?? [];
        for (const row of pageRows) {
            const cleanId = normalizeAuditUuid(row.ID);
            if (cleanId) {
                if (seen.has(cleanId)) {
                    return {
                        ok: false,
                        error: `Repeated row ID '${cleanId}' encountered while keyset-paging ${query.EntityName}`,
                        queryCount,
                    };
                }
                seen.add(cleanId);
            }
            rows.push(row);
        }
        if (pageRows.length < pageSize) {
            return { ok: true, rows, queryCount };
        }
        const lastRow = pageRows[pageRows.length - 1];
        const lastId = normalizeAuditUuid(lastRow?.ID);
        if (!lastId) {
            return {
                ok: false,
                error: `Full page of ${query.EntityName} lacked a valid ID cursor for keyset continuation`,
                queryCount,
            };
        }
        afterId = lastId;
    }
}

/**
 * Checks whether a user holds the external `Space Participant` role by canonical `RoleID`
 * (never comparing against role names).
 */
export function isExternalParticipantUser(
    user: UserInfo | null | undefined,
    participantRoleId: string = PARTICIPANT_ROLE_ID,
): boolean {
    const targetRoleId = normalizeAuditUuid(participantRoleId);
    if (!user || !targetRoleId) {
        return false;
    }
    return (user.UserRoles ?? []).some((ur) => normalizeAuditUuid(ur.RoleID) === targetRoleId);
}

/**
 * Resolves whether `user` holds any Collaboration staff-admin authorization (`Administer Spaces` or
 * `Configure Space Types`) via declarative MJ Authorization metadata, and is NOT an external participant
 * or Magic Link session.
 */
export function authorizeSecurityAuditCaller(
    user: UserInfo | null | undefined,
    provider: IMetadataProvider | undefined,
    participantRoleId: string = PARTICIPANT_ROLE_ID,
): { authorized: true } | { authorized: false; reason: string } {
    if (!user || !normalizeAuditUuid(user.ID)) {
        return { authorized: false, reason: 'An authenticated user is required to invoke Collaboration security audits.' };
    }
    if (user.IsMagicLinkAnonymous || user.MagicLinkScope) {
        return { authorized: false, reason: 'Magic Link sessions cannot invoke Collaboration security audits.' };
    }
    if (isExternalParticipantUser(user, participantRoleId)) {
        return { authorized: false, reason: 'External Space Participant accounts cannot invoke Collaboration security audits.' };
    }
    if (!provider) {
        return { authorized: false, reason: 'A metadata provider is required to authorize Collaboration security audits.' };
    }
    const engine = CollaborationEngineBase.Instance;
    const canAdminister = engine.UserMayAdministerSpaces(user, provider);
    const canConfigureTypes = engine.UserCanConfigureSpaceTypes(user, provider);
    if (!canAdminister && !canConfigureTypes) {
        return {
            authorized: false,
            reason: "Caller lacks 'Administer Spaces' or 'Configure Space Types' authorization required for Collaboration security audits.",
        };
    }
    return { authorized: true };
}

/** Finds a Collaboration authorization by name strictly under the `Collaboration` root authorization. */
export function findCollaborationAuthorizationInList(
    authorizations: readonly AuthorizationInfo[],
    name: string,
): AuthorizationInfo | null {
    const normalizedRoot = COLLABORATION_ROOT_AUTHORIZATION_NAME.toLowerCase();
    const root = authorizations.find((a) => (a.Name ?? '').trim().toLowerCase() === normalizedRoot && !a.ParentID);
    if (!root) {
        return null;
    }
    const target = name.trim().toLowerCase();
    if (target === normalizedRoot) {
        return root;
    }
    return (
        authorizations.find(
            (a) =>
                (a.Name ?? '').trim().toLowerCase() === target &&
                normalizeAuditUuid(a.ParentID) === normalizeAuditUuid(root.ID),
        ) ?? null
    );
}
