/**
 * Server consumption helpers for the CS-1 dual-dialect structural chat scope function
 * (`fnCollaborationChatScope`) across SQL Server and PostgreSQL.
 */

import { DatabaseProviderBase, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import {
    parseStructuralChatScopeRows,
    type RawStructuralChatScopeRow,
    type StructuralChatScopeResolution,
} from '@mj-biz-apps/collaboration-core';
import { parseUuid } from './uuid.js';

export const COLLABORATION_CHAT_SCOPE_FUNCTION_NAME = 'fnCollaborationChatScope';
export const COLLABORATION_SCHEMA_TSQL = '__mj_BizAppsCollaboration';
export const COLLABORATION_SCHEMA_PG = '__mj_bizappscollaboration';

export type StructuralChatScopeDialect = 'mssql' | 'postgresql';

export type StructuralChatScopeSqlParam = string | number | boolean | null;

export interface StructuralChatScopeExecuteOptions {
    description?: string;
    readOnlyTransaction?: boolean;
}

export interface StructuralChatScopeExecutableProvider {
    PlatformKey?: string;
    ExecuteSQL?: (
        query: string,
        parameters?: StructuralChatScopeSqlParam[],
        options?: StructuralChatScopeExecuteOptions,
        contextUser?: UserInfo,
    ) => Promise<RawStructuralChatScopeRow[]>;
}

export interface ResolveStructuralChatScopeParams {
    provider: DatabaseProviderBase | (IMetadataProvider & StructuralChatScopeExecutableProvider);
    primaryScopeRecordId: string;
    userId: string;
    contextUser?: UserInfo;
    dialect?: StructuralChatScopeDialect;
}

export interface BuiltStructuralChatScopeQuery {
    dialect: StructuralChatScopeDialect;
    sql: string;
    parameters: [string, string];
}

/**
 * Determines the SQL dialect to target from an explicit override or provider `PlatformKey`.
 */
export function detectStructuralChatScopeDialect(
    provider: Pick<StructuralChatScopeExecutableProvider, 'PlatformKey'>,
    explicitDialect?: StructuralChatScopeDialect,
): StructuralChatScopeDialect {
    if (explicitDialect) {
        return explicitDialect;
    }
    return provider.PlatformKey?.trim().toLowerCase() === 'postgresql' ? 'postgresql' : 'mssql';
}

/**
 * Builds a parameterized read-only SQL query invoking `fnCollaborationChatScope` for the given dialect.
 * Returns `null` if either UUID argument is invalid (fail closed).
 */
export function buildStructuralChatScopeQuery(
    dialect: StructuralChatScopeDialect,
    primaryScopeRecordId: string,
    userId: string,
): BuiltStructuralChatScopeQuery | null {
    const cleanPrimaryId = parseUuid(primaryScopeRecordId);
    const cleanUserId = parseUuid(userId);
    if (!cleanPrimaryId || !cleanUserId) {
        return null;
    }

    if (dialect === 'postgresql') {
        return {
            dialect,
            sql: `SELECT "SpaceID"::text AS "SpaceID", "Band" FROM ${COLLABORATION_SCHEMA_PG}."${COLLABORATION_CHAT_SCOPE_FUNCTION_NAME}"($1::uuid, $2::uuid) ORDER BY "SpaceID" ASC, "Band" ASC`,
            parameters: [cleanPrimaryId, cleanUserId],
        };
    }

    return {
        dialect,
        sql: `SELECT CONVERT(NVARCHAR(36), [SpaceID]) AS [SpaceID], [Band] FROM [${COLLABORATION_SCHEMA_TSQL}].[${COLLABORATION_CHAT_SCOPE_FUNCTION_NAME}](@p0, @p1) ORDER BY [SpaceID] ASC, [Band] ASC`,
        parameters: [cleanPrimaryId, cleanUserId],
    };
}

/**
 * Invokes `fnCollaborationChatScope` via the active database provider and returns strictly typed,
 * deduplicated `(SpaceID, Band)` reach pairs. Fails closed to an empty reach when either UUID is invalid.
 */
export async function resolveStructuralChatScope(
    params: ResolveStructuralChatScopeParams,
): Promise<StructuralChatScopeResolution> {
    const dialect = detectStructuralChatScopeDialect(params.provider, params.dialect);
    const querySpec = buildStructuralChatScopeQuery(dialect, params.primaryScopeRecordId, params.userId);
    if (!querySpec) {
        return parseStructuralChatScopeRows([]);
    }

    if (params.provider instanceof DatabaseProviderBase) {
        const rows = await params.provider.ExecuteSQL<RawStructuralChatScopeRow>(
            querySpec.sql,
            querySpec.parameters,
            {
                description: 'Collaboration structural chat scope (CS-1)',
                readOnlyTransaction: true,
            },
            params.contextUser,
        );
        return parseStructuralChatScopeRows(Array.isArray(rows) ? rows : []);
    }

    if (typeof params.provider.ExecuteSQL !== 'function') {
        throw new Error('Structural chat scope resolution requires a provider implementing ExecuteSQL.');
    }

    const rows = await params.provider.ExecuteSQL(
        querySpec.sql,
        querySpec.parameters,
        {
            description: 'Collaboration structural chat scope (CS-1)',
            readOnlyTransaction: true,
        },
        params.contextUser,
    );
    return parseStructuralChatScopeRows(Array.isArray(rows) ? rows : []);
}
