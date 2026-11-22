/**
 * Server persistence & fail-closed query service for relational Space Agent Source Receipts (CT-2).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import {
    type BaseEntity,
    type CompositeKey,
    type IMetadataProvider,
    LogError,
    ProviderBase,
    RunView,
    type RunViewParams,
    type RunViewResult,
    ServerOperationScopeManager,
    type TransactionGroupBase,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import {
    canReaderAccessSourceReceipt,
    type CollaborationSettings,
    DEFAULT_COLLABORATION_SETTINGS,
    type EffectiveGrant,
    isReceiptAuthorizedByLiveSources,
    isSourceReceiptBand,
    type LiveKnowledgeSourceGrantInput,
    type LiveReceiptSourceSnapshot,
    type LiveSpaceChainNodeInput,
    type LiveSpaceTypeConfigInput,
    membershipReaches,
    type MemberSnapshot,
    normalizeReceiptUuid,
    resolveEffectiveKnowledgeSourceBandsBySpace,
    type RoleFlags,
    type SourceReceiptBand,
    type SourceReceiptReachContext,
    type SpaceAgentSourceReceiptEntry,
    type SpaceNode,
    stripRecordKeyPrefix,
    type ValidatedSuppliedSourceCandidate,
} from '@mj-biz-apps/collaboration-core';
import {
    mjBizAppsCollaborationSpaceAgentSourceReceiptEntity,
    type mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType,
} from '@mj-biz-apps/collaboration-entities';
import {
    COLLABORATION_AGENT_TURN_OPERATION,
    COLLABORATION_ITEM_DELETE_OPERATION,
    COLLABORATION_SOURCE_RECEIPT_ENTITY,
    runWithCollaborationAgentTurnAuthority,
} from './ai-run-lockdown.js';
import { CollaborationEngine } from './CollaborationEngine.js';
import { toNode, type SpaceRow } from './load-graph.js';
import { readEveryRow } from './read-every-row.js';
import { isSpaceParticipant } from './task-attribution.js';
import type { TurnToolSourceHit } from './turn-tools.js';

const CONTENT_SOURCES_ENTITY = 'MJ: Content Sources';
const SPACE_CHATS_ENTITY = 'MJ_BizApps_Collaboration: Space Chats';
const SPACE_GRANTS_ENTITY = 'MJ_BizApps_Collaboration: Space Grants';
const SPACE_ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const SPACE_ROLES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';
const SPACE_TYPES_ENTITY = 'MJ_BizApps_Collaboration: Space Types';
const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const TASKS_ENTITY = 'MJ_BizApps_Tasks: Tasks';
const FILES_ENTITY = 'MJ: Files';
const LIVE_CHECK_BATCH_SIZE = 200;
const PG_ROLE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type PostgresScalar = string | number | boolean | Date | Uint8Array | object | null | undefined;
export type PostgresRow = Record<string, PostgresScalar>;
export interface HookableGetEntityObjectOptions {
    SkipNewRecord?: boolean;
    NewRecordValues?: PostgresRow;
    ParentEntity?: BaseEntity;
}
type HookableGetEntityObjectFn = <T extends BaseEntity>(
    entityName: string,
    loadKeyOrOptionsOrUser?: CompositeKey | HookableGetEntityObjectOptions | UserInfo,
    contextUser?: UserInfo,
) => Promise<T>;

export interface PostgresQueryable {
    query(sql: string, params?: PostgresScalar[]): Promise<object>;
}

export interface PostgresPoolClientLike extends PostgresQueryable {
    release?: (err?: boolean | Error) => void;
    end?: () => Promise<void>;
    destroy?: () => void;
}

export interface PostgresPoolLike {
    connect(): Promise<PostgresPoolClientLike>;
}

export interface PostgresReceiptUserContextOptions {
    /** Optional PostgreSQL role to assume within the local transaction (e.g. `cdp_UI`). */
    role?: string;
    /** Explicit system/server bypass flag; ignored when `role === 'cdp_UI'`. */
    bypassRls?: boolean;
    /** Run the transaction in `BEGIN READ ONLY` mode (aborted with `ROLLBACK`). */
    readOnly?: boolean;
    /** Optional statement timeout in milliseconds (`SET LOCAL statement_timeout`). */
    timeoutMs?: number;
}

export interface PostgresExecuteOptionsLike {
    connectionSource?: PostgresQueryable;
    ignoreAmbientTransaction?: boolean;
    readOnlyTransaction?: boolean;
    timeoutMs?: number;
    description?: string;
    ignoreLogging?: boolean;
    isMutation?: boolean;
}

export interface PostgresHookableProvider {
    PlatformKey?: string;
    CurrentUser?: UserInfo;
    DatabaseConnection?: PostgresPoolLike | PostgresQueryable;
    IsCallerInAmbientTransaction?: () => boolean;
    IsInTransaction?: boolean;
    ActiveTransactionClient?: PostgresQueryable | null;
    ExecuteSQL?: <T = PostgresRow>(
        query: string,
        parameters?: PostgresScalar[],
        options?: PostgresExecuteOptionsLike,
        contextUser?: UserInfo,
    ) => Promise<T[]>;
    ExecuteSQLBatch?: (
        queries: string[],
        parameters?: PostgresScalar[][] | PostgresExecuteOptionsLike,
        options?: PostgresExecuteOptionsLike | UserInfo,
        contextUser?: UserInfo,
    ) => Promise<PostgresRow[][]>;
    BeginTransaction?: () => Promise<void>;
    GetEntityObject?: IMetadataProvider['GetEntityObject'];
    RunView?: ProviderBase['RunView'];
    RunViews?: ProviderBase['RunViews'];
}

interface PostgresReceiptExecutionScope {
    pool: PostgresPoolLike | PostgresQueryable;
    client: PostgresQueryable;
    userId: string | null;
    bypassRls: boolean;
    role?: string;
}

const activePostgresReceiptScope = new AsyncLocalStorage<PostgresReceiptExecutionScope>();
const privilegedReceiptTargets = new AsyncLocalStorage<Set<object>>();
const hookedPostgresInstances = new WeakSet<object>();
const hookedPostgresPrototypes = new WeakSet<object>();
const hookedProviderBasePrototypes = new WeakSet<object>();
const hookedExecuteFunctions = new WeakSet<object>();
const hookedBatchFunctions = new WeakSet<object>();
const hookedBeginTxFunctions = new WeakSet<object>();

function isPostgresPool(target: PostgresPoolLike | PostgresQueryable): target is PostgresPoolLike {
    return typeof (target as PostgresPoolLike).connect === 'function';
}

function isPostgresQueryable(value: object | null | undefined): value is PostgresPoolLike | PostgresQueryable {
    if (!value) return false;
    const maybePool = value as PostgresPoolLike;
    const maybeQueryable = value as PostgresQueryable;
    return typeof maybePool.connect === 'function' || typeof maybeQueryable.query === 'function';
}

function safeProviderCurrentUser(provider: PostgresHookableProvider): UserInfo | undefined {
    try {
        return provider.CurrentUser;
    } catch {
        return undefined;
    }
}

function resolvePostgresPoolFromProvider(provider: PostgresHookableProvider): PostgresPoolLike | PostgresQueryable | null {
    const conn = provider.DatabaseConnection;
    if (conn && typeof conn === 'object' && isPostgresQueryable(conn)) {
        return conn;
    }
    return null;
}

export function isPostgresProviderCandidate(
    provider: IMetadataProvider | PostgresHookableProvider | object | null | undefined,
): provider is PostgresHookableProvider {
    if (!provider || typeof provider !== 'object') {
        return false;
    }
    const candidate = provider as PostgresHookableProvider;
    if (candidate.PlatformKey !== undefined && candidate.PlatformKey !== 'postgresql') {
        return false;
    }
    const conn = candidate.DatabaseConnection;
    return candidate.PlatformKey === 'postgresql' || (Boolean(conn) && typeof conn === 'object' && isPostgresPool(conn));
}

async function applyPostgresReceiptSessionGucs(
    client: PostgresQueryable,
    cleanUserId: string | null,
    bypassRls: boolean,
    roleName?: string,
): Promise<void> {
    if (roleName) {
        await client.query(`SET LOCAL ROLE "${roleName}"`);
    }
    if (bypassRls && roleName !== 'cdp_UI') {
        await client.query(`SET LOCAL app.bypass_rls = 'true'`);
    } else {
        await client.query('RESET app.bypass_rls');
    }
    if (cleanUserId) {
        await client.query(`SET LOCAL app.current_user_id = '${cleanUserId}'`);
        await client.query(`SET LOCAL mj.current_user_id = '${cleanUserId}'`);
    } else {
        await client.query('RESET app.current_user_id');
        await client.query('RESET mj.current_user_id');
    }
}

async function discardPostgresPoolClient(client: PostgresPoolClientLike): Promise<void> {
    try {
        if (typeof client.release === 'function') {
            client.release(true);
            return;
        }
    } catch {
        // Fall through to end/destroy
    }
    try {
        if (typeof client.end === 'function') {
            await client.end();
            return;
        }
    } catch {
        // Fall through to destroy
    }
    try {
        client.destroy?.();
    } catch {
        // Best-effort connection discard
    }
}

function isProviderInAmbientTransaction(provider: PostgresHookableProvider): boolean {
    if (typeof provider.IsCallerInAmbientTransaction === 'function') {
        try {
            return provider.IsCallerInAmbientTransaction();
        } catch {
            return false;
        }
    }
    return Boolean(provider.IsInTransaction);
}

function resolveDesiredPostgresContext(
    provider: PostgresHookableProvider,
    contextUser?: UserInfo,
): { userId: string | null; bypassRls: boolean } {
    const effectiveUser = contextUser ?? safeProviderCurrentUser(provider);
    const inClientCrud = ServerOperationScopeManager.Instance.IsInDirectClientCrud();
    const privSet = privilegedReceiptTargets.getStore();
    const isExplicitPrivileged = Boolean(
        privSet &&
        (privSet.has(provider) || (provider.DatabaseConnection && privSet.has(provider.DatabaseConnection))),
    );
    const isTurnOrCascadeOp = Boolean(
        effectiveUser &&
        !isSpaceParticipant(effectiveUser) &&
        ServerOperationScopeManager.Instance.IsOperationActive(
            [COLLABORATION_AGENT_TURN_OPERATION, COLLABORATION_ITEM_DELETE_OPERATION],
            COLLABORATION_SOURCE_RECEIPT_ENTITY,
            effectiveUser,
        ),
    );

    if (!inClientCrud && (isExplicitPrivileged || isTurnOrCascadeOp) && (!effectiveUser || !isSpaceParticipant(effectiveUser))) {
        return { userId: null, bypassRls: true };
    }

    const cleanId = effectiveUser?.ID ? normalizeReceiptUuid(effectiveUser.ID) : null;
    return { userId: cleanId, bypassRls: false };
}

/**
 * Executes `fn` inside a PostgreSQL transaction scoped to `userId` using `SET LOCAL app.current_user_id`
 * and `SET LOCAL mj.current_user_id`, and guarantees `RESET` cleanup in a `finally` block (discarding
 * the pooled client via `release(true)` / `end()` / `destroy()` if `ROLLBACK` or `RESET` fails) so
 * consecutive different-user requests on a reused pooled connection never leak user state.
 */
export async function withPostgresReceiptUserContext<T>(
    target: PostgresPoolLike | PostgresQueryable,
    userId: string | null | undefined,
    fn: (client: PostgresQueryable) => Promise<T>,
    options?: PostgresReceiptUserContextOptions,
): Promise<T> {
    const hasUserId = userId !== undefined && userId !== null && String(userId).trim().length > 0;
    const cleanUserId = hasUserId ? normalizeReceiptUuid(userId) : null;
    if (hasUserId && !cleanUserId) {
        throw new Error('Cannot establish PostgreSQL receipt user context with invalid userId UUID.');
    }

    const roleName = options?.role?.trim();
    if (roleName && !PG_ROLE_IDENTIFIER_RE.test(roleName)) {
        throw new Error(`Invalid PostgreSQL role identifier: ${roleName}`);
    }

    const effectiveBypassRls = Boolean(options?.bypassRls && roleName !== 'cdp_UI');
    const activeScope = activePostgresReceiptScope.getStore();
    if (activeScope && (activeScope.pool === target || activeScope.client === target)) {
        if (
            activeScope.userId === cleanUserId &&
            activeScope.bypassRls === effectiveBypassRls &&
            (!roleName || activeScope.role === roleName)
        ) {
            return await fn(activeScope.client);
        }

        const savepointName = 'mj_receipt_ctx_sp';
        await activeScope.client.query(`SAVEPOINT ${savepointName}`);
        try {
            await applyPostgresReceiptSessionGucs(activeScope.client, cleanUserId, effectiveBypassRls, roleName);
            const nestedScope: PostgresReceiptExecutionScope = {
                pool: target,
                client: activeScope.client,
                userId: cleanUserId,
                bypassRls: effectiveBypassRls,
                role: roleName ?? activeScope.role,
            };
            const nestedResult = await activePostgresReceiptScope.run(nestedScope, () => fn(activeScope.client));
            await activeScope.client.query(`RELEASE SAVEPOINT ${savepointName}`);
            await applyPostgresReceiptSessionGucs(activeScope.client, activeScope.userId, activeScope.bypassRls, activeScope.role);
            return nestedResult;
        } catch (err) {
            try {
                await activeScope.client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                await activeScope.client.query(`RELEASE SAVEPOINT ${savepointName}`);
            } catch {
                // Outer withPostgresReceiptUserContext transaction handles rollback and client discard
            }
            throw err;
        }
    }

    const poolClient: PostgresPoolClientLike | null = isPostgresPool(target) ? await target.connect() : null;
    const client: PostgresQueryable = poolClient ?? (target as PostgresQueryable);
    let inTransaction = false;
    let cleanupFailed = false;

    try {
        await client.query(options?.readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
        inTransaction = true;
        if (options?.timeoutMs && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
            await client.query(`SET LOCAL statement_timeout = ${Math.floor(options.timeoutMs)}`);
        }
        await applyPostgresReceiptSessionGucs(client, cleanUserId, effectiveBypassRls, roleName);

        const scope: PostgresReceiptExecutionScope = {
            pool: target,
            client,
            userId: cleanUserId,
            bypassRls: effectiveBypassRls,
            role: roleName,
        };
        const result = await activePostgresReceiptScope.run(scope, () => fn(client));
        await client.query(options?.readOnly ? 'ROLLBACK' : 'COMMIT');
        inTransaction = false;
        return result;
    } catch (err) {
        if (inTransaction) {
            try {
                await client.query('ROLLBACK');
                inTransaction = false;
            } catch {
                cleanupFailed = true;
            }
        }
        throw err;
    } finally {
        if (!cleanupFailed) {
            try {
                await client.query('RESET app.current_user_id');
                await client.query('RESET mj.current_user_id');
                await client.query('RESET app.bypass_rls');
                await client.query('RESET ROLE');
            } catch {
                cleanupFailed = true;
            }
        }
        if (poolClient) {
            if (cleanupFailed) {
                await discardPostgresPoolClient(poolClient);
            } else {
                poolClient.release?.();
            }
        }
    }
}

/**
 * Executes `fn` inside a privileged server receipt context so PostgreSQL server persistence and
 * cascade cleanup set `SET LOCAL app.bypass_rls = 'true'` on non-`cdp_UI` server connections.
 */
export async function runWithPostgresPrivilegedReceiptContext<T>(
    provider: IMetadataProvider | PostgresHookableProvider | object | null | undefined,
    fn: () => Promise<T>,
): Promise<T> {
    if (!provider || typeof provider !== 'object') {
        return fn();
    }
    ensurePostgresReceiptContextHook(provider);
    const current = privilegedReceiptTargets.getStore();
    const next = new Set<object>(current);
    next.add(provider);
    const hookable = provider as PostgresHookableProvider;
    if (hookable.DatabaseConnection && typeof hookable.DatabaseConnection === 'object') {
        next.add(hookable.DatabaseConnection);
    }
    return privilegedReceiptTargets.run(next, fn);
}

function wrapPostgresExecutionTarget(target: PostgresHookableProvider): boolean {
    let installed = false;

    const origExecuteSQL = target.ExecuteSQL;
    if (typeof origExecuteSQL === 'function' && !hookedExecuteFunctions.has(origExecuteSQL)) {
        const wrappedExecuteSQL = async function <T = PostgresRow>(
            this: PostgresHookableProvider,
            query: string,
            parameters?: PostgresScalar[],
            options?: PostgresExecuteOptionsLike,
            contextUser?: UserInfo,
        ): Promise<T[]> {
            const boundOrig: typeof origExecuteSQL = origExecuteSQL.bind(this);
            if (!isPostgresProviderCandidate(this) || options?.connectionSource) {
                return boundOrig<T>(query, parameters, options, contextUser);
            }
            if (isProviderInAmbientTransaction(this)) {
                const txClient = this.ActiveTransactionClient;
                if (txClient && typeof txClient.query === 'function') {
                    const desired = resolveDesiredPostgresContext(this, contextUser);
                    await applyPostgresReceiptSessionGucs(txClient, desired.userId, desired.bypassRls);
                }
                return boundOrig<T>(query, parameters, options, contextUser);
            }
            const pool = resolvePostgresPoolFromProvider(this);
            if (!pool) {
                return boundOrig<T>(query, parameters, options, contextUser);
            }
            const desired = resolveDesiredPostgresContext(this, contextUser);
            return withPostgresReceiptUserContext(
                pool,
                desired.userId,
                (client) =>
                    boundOrig<T>(
                        query,
                        parameters,
                        { ...options, connectionSource: client },
                        contextUser,
                    ),
                {
                    bypassRls: desired.bypassRls,
                    readOnly: options?.readOnlyTransaction,
                    timeoutMs: options?.timeoutMs,
                },
            );
        };
        hookedExecuteFunctions.add(wrappedExecuteSQL);
        target.ExecuteSQL = wrappedExecuteSQL;
        installed = true;
    }

    const origExecuteSQLBatch = target.ExecuteSQLBatch;
    if (typeof origExecuteSQLBatch === 'function' && !hookedBatchFunctions.has(origExecuteSQLBatch)) {
        const wrappedExecuteSQLBatch = async function (
            this: PostgresHookableProvider,
            queries: string[],
            parameters?: PostgresScalar[][] | PostgresExecuteOptionsLike,
            options?: PostgresExecuteOptionsLike | UserInfo,
            contextUser?: UserInfo,
        ): Promise<PostgresRow[][]> {
            if (!queries || queries.length === 0) {
                return [];
            }

            let actualParams: PostgresScalar[][] | undefined;
            let actualOptions: PostgresExecuteOptionsLike | undefined;
            let actualUser: UserInfo | undefined;

            if (Array.isArray(parameters)) {
                actualParams = parameters;
                actualOptions = options as PostgresExecuteOptionsLike | undefined;
                actualUser = contextUser;
            } else if (parameters && typeof parameters === 'object' && !('length' in parameters)) {
                actualParams = undefined;
                actualOptions = parameters as PostgresExecuteOptionsLike;
                actualUser = options as UserInfo | undefined;
            } else {
                actualParams = undefined;
                actualOptions = options as PostgresExecuteOptionsLike | undefined;
                actualUser = contextUser;
            }

            if (queries.length === 1 && typeof this.ExecuteSQL === 'function') {
                const execOptions: PostgresExecuteOptionsLike | undefined = actualOptions
                    ? {
                          description: actualOptions.description,
                          ignoreLogging: actualOptions.ignoreLogging,
                          isMutation: actualOptions.isMutation,
                          ignoreAmbientTransaction: actualOptions.ignoreAmbientTransaction,
                          connectionSource: actualOptions.connectionSource,
                          readOnlyTransaction: actualOptions.readOnlyTransaction,
                          timeoutMs: actualOptions.timeoutMs,
                      }
                    : undefined;
                const single = await this.ExecuteSQL<PostgresRow>(
                    queries[0],
                    actualParams?.[0],
                    execOptions,
                    actualUser,
                );
                return [single];
            }

            if (!isPostgresProviderCandidate(this) || actualOptions?.connectionSource) {
                return origExecuteSQLBatch.call(this, queries, parameters, options, contextUser);
            }
            if (isProviderInAmbientTransaction(this)) {
                const txClient = this.ActiveTransactionClient;
                if (txClient && typeof txClient.query === 'function') {
                    const desired = resolveDesiredPostgresContext(this, actualUser);
                    await applyPostgresReceiptSessionGucs(txClient, desired.userId, desired.bypassRls);
                }
                return origExecuteSQLBatch.call(this, queries, parameters, options, contextUser);
            }
            const pool = resolvePostgresPoolFromProvider(this);
            if (!pool) {
                return origExecuteSQLBatch.call(this, queries, parameters, options, contextUser);
            }
            const desired = resolveDesiredPostgresContext(this, actualUser);
            return withPostgresReceiptUserContext(
                pool,
                desired.userId,
                (client) =>
                    origExecuteSQLBatch.call(
                        this,
                        queries,
                        actualParams,
                        { ...actualOptions, connectionSource: client },
                        actualUser,
                    ),
                {
                    bypassRls: desired.bypassRls,
                    readOnly: actualOptions?.readOnlyTransaction,
                    timeoutMs: actualOptions?.timeoutMs,
                },
            );
        };
        hookedBatchFunctions.add(wrappedExecuteSQLBatch);
        target.ExecuteSQLBatch = wrappedExecuteSQLBatch;
        installed = true;
    }

    const origBeginTransaction = target.BeginTransaction;
    if (typeof origBeginTransaction === 'function' && !hookedBeginTxFunctions.has(origBeginTransaction)) {
        const wrappedBeginTransaction = async function (this: PostgresHookableProvider): Promise<void> {
            await origBeginTransaction.call(this);
            if (!isPostgresProviderCandidate(this)) {
                return;
            }
            const txClient = this.ActiveTransactionClient;
            if (txClient && typeof txClient.query === 'function') {
                const desired = resolveDesiredPostgresContext(this, undefined);
                if (desired.bypassRls) {
                    await applyPostgresReceiptSessionGucs(txClient, null, true);
                }
            }
        };
        hookedBeginTxFunctions.add(wrappedBeginTransaction);
        target.BeginTransaction = wrappedBeginTransaction;
        installed = true;
    }

    return installed;
}

/**
 * Installs the transaction-scoped PostgreSQL user-context execution hook directly onto a
 * `PostgreSQLDataProvider` prototype (`ExecuteSQL`, `ExecuteSQLBatch`, `BeginTransaction`).
 */
export function ensurePostgresReceiptContextPrototypeHook(proto: object | null | undefined): boolean {
    if (!proto || typeof proto !== 'object' || proto === Object.prototype) {
        return false;
    }
    if (hookedPostgresPrototypes.has(proto)) {
        return true;
    }
    const installed = wrapPostgresExecutionTarget(proto as PostgresHookableProvider);
    if (installed) {
        hookedPostgresPrototypes.add(proto);
    }
    return installed;
}

/**
 * Installs the transaction-scoped PostgreSQL user-context hook on `provider` (and its prototype
 * when `provider` is a class instance such as `PostgreSQLDataProvider`) so ordinary `RunView`,
 * `Load`, `Save`, `Delete`, and `ExecuteSQL` calls automatically establish and clean up
 * `app.current_user_id` / `mj.current_user_id` on the same checked-out connection.
 */
export function ensurePostgresReceiptContextHook(
    provider: IMetadataProvider | PostgresHookableProvider | object | null | undefined,
): boolean {
    if (!isPostgresProviderCandidate(provider)) {
        return false;
    }
    if (hookedPostgresInstances.has(provider)) {
        return true;
    }

    let hooked = false;
    const proto = Object.getPrototypeOf(provider) as object | null;
    if (proto && proto !== Object.prototype) {
        if (ensurePostgresReceiptContextPrototypeHook(proto)) {
            hooked = true;
        }
    }

    if (
        Object.prototype.hasOwnProperty.call(provider, 'ExecuteSQL') ||
        Object.prototype.hasOwnProperty.call(provider, 'ExecuteSQLBatch') ||
        !hooked
    ) {
        if (wrapPostgresExecutionTarget(provider)) {
            hooked = true;
        }
    }

    if (hooked || hookedPostgresPrototypes.has(proto ?? provider)) {
        hookedPostgresInstances.add(provider);
        return true;
    }
    return false;
}

/**
 * Hooks `ProviderBase.prototype` (`RunView`, `RunViews`, `GetEntityObject`) so any
 * `PostgreSQLDataProvider` instance created after startup is automatically instrumented
 * before its first `RunView`, `Load`, or entity operation without requiring manual caller setup.
 */
export function installPostgresReceiptProviderAutoHook(): void {
    const proto = ProviderBase?.prototype as (PostgresHookableProvider & object) | undefined;
    if (!proto || hookedProviderBasePrototypes.has(proto)) {
        return;
    }

    const origRunView = proto.RunView;
    if (typeof origRunView === 'function') {
        proto.RunView = function <T = PostgresRow>(
            this: PostgresHookableProvider,
            params: RunViewParams,
            contextUser?: UserInfo,
        ): Promise<RunViewResult<T>> {
            ensurePostgresReceiptContextHook(this);
            const bound: typeof origRunView = origRunView.bind(this);
            return bound<T>(params, contextUser);
        };
    }

    const origRunViews = proto.RunViews;
    if (typeof origRunViews === 'function') {
        proto.RunViews = function <T = PostgresRow>(
            this: PostgresHookableProvider,
            params: RunViewParams[],
            contextUser?: UserInfo,
        ): Promise<RunViewResult<T>[]> {
            ensurePostgresReceiptContextHook(this);
            const bound: typeof origRunViews = origRunViews.bind(this);
            return bound<T>(params, contextUser);
        };
    }

    const origGetEntityObject = proto.GetEntityObject;
    if (typeof origGetEntityObject === 'function') {
        const origGetEntityFn = origGetEntityObject as HookableGetEntityObjectFn;
        function wrappedGetEntityObject<T extends BaseEntity>(
            this: PostgresHookableProvider,
            entityName: string,
            contextUser?: UserInfo,
        ): Promise<T>;
        function wrappedGetEntityObject<T extends BaseEntity>(
            this: PostgresHookableProvider,
            entityName: string,
            loadKey: CompositeKey,
            contextUser?: UserInfo,
        ): Promise<T>;
        function wrappedGetEntityObject<T extends BaseEntity>(
            this: PostgresHookableProvider,
            entityName: string,
            loadKeyOrOptionsOrUser?: CompositeKey | HookableGetEntityObjectOptions | UserInfo,
            contextUser?: UserInfo,
        ): Promise<T> {
            ensurePostgresReceiptContextHook(this);
            const bound = origGetEntityFn.bind(this) as HookableGetEntityObjectFn;
            const isKeyOrOptions =
                loadKeyOrOptionsOrUser != null &&
                typeof loadKeyOrOptionsOrUser === 'object' &&
                ('KeyValuePairs' in loadKeyOrOptionsOrUser ||
                    'SkipNewRecord' in loadKeyOrOptionsOrUser ||
                    'NewRecordValues' in loadKeyOrOptionsOrUser ||
                    'ParentEntity' in loadKeyOrOptionsOrUser);
            if (arguments.length >= 3 || contextUser !== undefined || isKeyOrOptions) {
                return bound<T>(entityName, loadKeyOrOptionsOrUser, contextUser);
            }
            return bound<T>(entityName, loadKeyOrOptionsOrUser);
        }
        proto.GetEntityObject = wrappedGetEntityObject;
    }

    hookedProviderBasePrototypes.add(proto);
}

installPostgresReceiptProviderAutoHook();

interface ContentSourceRow {
    ID: string;
    Name: string | null;
}

export interface PersistSpaceAgentSourceReceiptsParams {
    provider: IMetadataProvider;
    systemUser: UserInfo;
    turnUserId: string;
    spaceChatId: string;
    conversationId: string;
    conversationDetailId: string;
    agentRunId?: string | null;
    receipts: readonly SpaceAgentSourceReceiptEntry[];
    reachContext?: SourceReceiptReachContext;
}

export type PersistSpaceAgentSourceReceiptsResult =
    | { ok: true; persistedCount: number; savedIds: string[] }
    | { ok: false; errorMessage: string };

export interface QuerySpaceAgentSourceReceiptsParams {
    provider: IMetadataProvider;
    user: UserInfo;
    conversationId: string;
    conversationDetailId?: string;
    inReachSpaceBands: ReadonlyMap<string, ReadonlySet<SourceReceiptBand>>;
    callerCanSeeTeam: boolean;
}

export interface QuerySpaceAgentSourceReceiptsResult {
    ok: boolean;
    receipts: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[];
    filteredOutCount: number;
    errorMessage?: string;
}

/**
 * Resolves only the granted in-reach knowledge sources that were actually supplied/retrieved
 * in the turn context or tool results, strictly bounded by `chatAudience`.
 */
export async function resolveSuppliedKnowledgeSources(
    provider: IMetadataProvider,
    systemUser: UserInfo,
    spaceId: string,
    knowledgeGrants: readonly EffectiveGrant[],
    knowledgeSourceIdsInForce: readonly string[],
    chatAudience: SourceReceiptBand,
    suppliedKnowledgeSourceIds?: ReadonlySet<string>,
): Promise<ValidatedSuppliedSourceCandidate[]> {
    const cleanSpaceId = normalizeReceiptUuid(spaceId);
    if (!cleanSpaceId || knowledgeSourceIdsInForce.length === 0) {
        return [];
    }
    if (suppliedKnowledgeSourceIds && suppliedKnowledgeSourceIds.size === 0) {
        return [];
    }

    const inForceSet = new Set(
        knowledgeSourceIdsInForce
            .map((id) => normalizeReceiptUuid(id))
            .filter((id): id is string => id !== null),
    );

    const eligibleGrants: Array<{ contentSourceId: string; grant: EffectiveGrant }> = [];
    for (const grant of knowledgeGrants) {
        if (chatAudience === 'Shared' && grant.Band !== 'Shared') {
            continue;
        }
        const strippedId = normalizeReceiptUuid(stripRecordKeyPrefix(grant.TargetRecordID));
        if (!strippedId || !inForceSet.has(strippedId)) {
            continue;
        }
        if (suppliedKnowledgeSourceIds && !suppliedKnowledgeSourceIds.has(strippedId)) {
            continue;
        }
        eligibleGrants.push({ contentSourceId: strippedId, grant });
    }

    if (eligibleGrants.length === 0) {
        return [];
    }

    const idFilter = eligibleGrants.map((e) => `'${e.contentSourceId}'`).join(',');
    const rv = RunView.FromMetadataProvider(provider);
    const titleById = new Map<string, string>();
    try {
        const res = await rv.RunView<ContentSourceRow>({
            EntityName: CONTENT_SOURCES_ENTITY,
            ExtraFilter: `ID IN (${idFilter})`,
            Fields: ['ID', 'Name'],
            ResultType: 'simple',
            // row-cap-ok: bounded by the configuration's granted KnowledgeSource IDs for one space
            MaxRows: 500,
        }, systemUser);
        if (res.Success && res.Results) {
            for (const row of res.Results) {
                const cid = normalizeReceiptUuid(row.ID);
                if (cid && row.Name?.trim()) {
                    titleById.set(cid, row.Name.trim());
                }
            }
        }
    } catch (err) {
        LogError(`resolveSuppliedKnowledgeSources lookup warning: ${err instanceof Error ? err.message : String(err)}`);
    }

    const candidates: ValidatedSuppliedSourceCandidate[] = [];
    const seen = new Set<string>();
    for (const { contentSourceId, grant } of eligibleGrants) {
        if (seen.has(contentSourceId)) continue;
        seen.add(contentSourceId);
        const title = titleById.get(contentSourceId) ?? grant.Label?.trim() ?? `Knowledge Source ${contentSourceId.slice(0, 8)}`;
        candidates.push({
            sourceKind: 'KnowledgeSource',
            spaceId: cleanSpaceId,
            spaceItemId: null,
            contentSourceId,
            targetEntityId: normalizeReceiptUuid(grant.TargetEntityID),
            targetRecordId: grant.TargetRecordID,
            sourceTitle: title,
            band: grant.Band,
            retrievalRank: null,
            relevanceScore: null,
            rankingMode: 'grant',
            estimatedTokens: 0,
            wasTruncated: false,
        });
    }
    return candidates;
}

/**
 * Builds the turn's `(spaceId -> allowedBands)` reach context from retrieval scope results.
 */
export function buildSourceReceiptReachContext(
    chatAudience: SourceReceiptBand,
    anchorSpaceId: string,
    allowedBandsBySpace: Readonly<Record<string, SourceReceiptBand>> | undefined,
    searchedSpaceIds: readonly string[],
): SourceReceiptReachContext {
    const inReachSpaceBands = new Map<string, Set<SourceReceiptBand>>();

    if (allowedBandsBySpace) {
        for (const [rawSpaceId, maxBand] of Object.entries(allowedBandsBySpace)) {
            const cleanId = normalizeReceiptUuid(rawSpaceId);
            if (!cleanId) continue;
            const bands = new Set<SourceReceiptBand>(['Shared']);
            if (chatAudience === 'Team' && maxBand === 'Team') {
                bands.add('Team');
            }
            inReachSpaceBands.set(cleanId, bands);
        }
    } else {
        for (const rawSpaceId of searchedSpaceIds) {
            const cleanId = normalizeReceiptUuid(rawSpaceId);
            if (!cleanId) continue;
            const bands = new Set<SourceReceiptBand>(['Shared']);
            if (chatAudience === 'Team') {
                bands.add('Team');
            }
            inReachSpaceBands.set(cleanId, bands);
        }
    }

    const cleanAnchor = normalizeReceiptUuid(anchorSpaceId);
    if (cleanAnchor && !inReachSpaceBands.has(cleanAnchor)) {
        const bands = new Set<SourceReceiptBand>(['Shared']);
        if (chatAudience === 'Team') {
            bands.add('Team');
        }
        inReachSpaceBands.set(cleanAnchor, bands);
    }

    return {
        chatAudience,
        inReachSpaceBands,
    };
}

export interface ResolveToolSuppliedSourcesParams {
    provider: IMetadataProvider;
    systemUser: UserInfo;
    toolHits: readonly TurnToolSourceHit[];
    reachContext: SourceReceiptReachContext;
    alreadySuppliedSpaceItemIds: ReadonlySet<string>;
}

export interface ResolveToolSuppliedSourcesResult {
    spaceItemCandidates: ValidatedSuppliedSourceCandidate[];
    suppliedKnowledgeSourceIds: Set<string>;
    rejectedCount: number;
}

/**
 * Resolves and fail-closed validates sources returned by in-turn search or knowledge tools
 * (e.g. `CollaborationScopedSearchAction`) against the turn's `(space, band)` reach before
 * merging them into receipt candidates.
 */
export async function resolveToolSuppliedSourceCandidates(
    params: ResolveToolSuppliedSourcesParams,
): Promise<ResolveToolSuppliedSourcesResult> {
    const spaceItemCandidates: ValidatedSuppliedSourceCandidate[] = [];
    const suppliedKnowledgeSourceIds = new Set<string>();
    let rejectedCount = 0;

    if (params.toolHits.length === 0) {
        return { spaceItemCandidates, suppliedKnowledgeSourceIds, rejectedCount };
    }

    const directSpaceItemIds = new Set<string>();
    const taskRecordIds = new Set<string>();
    const chunkIds = new Set<string>();
    const contentItemIds = new Set<string>();
    const hitBySpaceItemId = new Map<string, TurnToolSourceHit>();
    const hitByTaskRecordId = new Map<string, TurnToolSourceHit>();

    for (const hit of params.toolHits) {
        if (hit.sourceKind === 'KnowledgeSource') {
            const cid = normalizeReceiptUuid(stripRecordKeyPrefix(hit.contentSourceId ?? hit.recordId));
            if (cid) suppliedKnowledgeSourceIds.add(cid);
            continue;
        }
        const directItemId = normalizeReceiptUuid(stripRecordKeyPrefix(hit.spaceItemId));
        if (directItemId) {
            directSpaceItemIds.add(directItemId);
            if (!hitBySpaceItemId.has(directItemId)) hitBySpaceItemId.set(directItemId, hit);
            continue;
        }
        const recId = normalizeReceiptUuid(stripRecordKeyPrefix(hit.recordId));
        if (!recId) continue;
        if (hit.entityName === SPACE_ITEMS_ENTITY) {
            directSpaceItemIds.add(recId);
            if (!hitBySpaceItemId.has(recId)) hitBySpaceItemId.set(recId, hit);
        } else if (hit.entityName === TASKS_ENTITY) {
            taskRecordIds.add(recId);
            if (!hitByTaskRecordId.has(recId)) hitByTaskRecordId.set(recId, hit);
        } else if (hit.entityName === 'MJ: Content Item Chunks') {
            chunkIds.add(recId);
        } else if (hit.entityName === 'MJ: Content Items') {
            contentItemIds.add(recId);
        } else {
            const cid = normalizeReceiptUuid(stripRecordKeyPrefix(hit.contentSourceId));
            if (cid) suppliedKnowledgeSourceIds.add(cid);
        }
    }

    const rv = RunView.FromMetadataProvider(params.provider);

    // Resolve chunk -> contentItem -> ERD -> SpaceItem / ContentSource if any chunk hits arrived
    if (chunkIds.size > 0) {
        try {
            const chunkFilter = Array.from(chunkIds).map((id) => `'${id}'`).join(', ');
            const chunksRes = await rv.RunView<{ ID: string; ContentItemID: string }>({
                EntityName: 'MJ: Content Item Chunks',
                ExtraFilter: `ID IN (${chunkFilter})`,
                Fields: ['ID', 'ContentItemID'],
                ResultType: 'simple',
                // row-cap-ok: bounded by tool hit count in a single turn
                MaxRows: 500,
            }, params.systemUser);
            for (const row of chunksRes.Success && chunksRes.Results ? chunksRes.Results : []) {
                const ciId = normalizeReceiptUuid(row.ContentItemID);
                if (ciId) contentItemIds.add(ciId);
            }
        } catch (err) {
            LogError(`resolveToolSuppliedSourceCandidates chunk lookup warning: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    if (contentItemIds.size > 0) {
        try {
            const ciFilter = Array.from(contentItemIds).map((id) => `'${id}'`).join(', ');
            const ciRes = await rv.RunView<{ ID: string; ContentSourceID: string | null; EntityRecordDocumentID: string | null }>({
                EntityName: 'MJ: Content Items',
                ExtraFilter: `ID IN (${ciFilter})`,
                Fields: ['ID', 'ContentSourceID', 'EntityRecordDocumentID'],
                ResultType: 'simple',
                // row-cap-ok: bounded by tool hit count in a single turn
                MaxRows: 500,
            }, params.systemUser);
            const erdIds: string[] = [];
            for (const row of ciRes.Success && ciRes.Results ? ciRes.Results : []) {
                const csId = normalizeReceiptUuid(row.ContentSourceID);
                if (csId) suppliedKnowledgeSourceIds.add(csId);
                const erdId = normalizeReceiptUuid(row.EntityRecordDocumentID);
                if (erdId) erdIds.push(erdId);
            }
            if (erdIds.length > 0) {
                const erdFilter = erdIds.map((id) => `'${id}'`).join(', ');
                const erdRes = await rv.RunView<{ ID: string; Entity: string; RecordID: string }>({
                    EntityName: 'MJ: Entity Record Documents',
                    ExtraFilter: `ID IN (${erdFilter}) AND Entity = '${SPACE_ITEMS_ENTITY}'`,
                    Fields: ['ID', 'Entity', 'RecordID'],
                    ResultType: 'simple',
                    // row-cap-ok: bounded by tool hit count in a single turn
                    MaxRows: 500,
                }, params.systemUser);
                for (const erd of erdRes.Success && erdRes.Results ? erdRes.Results : []) {
                    const siId = normalizeReceiptUuid(stripRecordKeyPrefix(erd.RecordID));
                    if (siId) directSpaceItemIds.add(siId);
                }
            }
        } catch (err) {
            LogError(`resolveToolSuppliedSourceCandidates content item lookup warning: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    interface SpaceItemLookupRow {
        ID: string;
        SpaceID: string;
        EntityID: string;
        RecordID: string;
        Band: string;
    }

    const resolvedItems: SpaceItemLookupRow[] = [];
    if (directSpaceItemIds.size > 0) {
        const idList = Array.from(directSpaceItemIds).map((id) => `'${id}'`).join(', ');
        const siRes = await rv.RunView<SpaceItemLookupRow>({
            EntityName: SPACE_ITEMS_ENTITY,
            ExtraFilter: `ID IN (${idList})`,
            Fields: ['ID', 'SpaceID', 'EntityID', 'RecordID', 'Band'],
            ResultType: 'simple',
            // row-cap-ok: bounded by tool hit count in a single turn
            MaxRows: 500,
        }, params.systemUser);
        if (siRes.Success && siRes.Results) {
            resolvedItems.push(...siRes.Results);
        }
    }

    if (taskRecordIds.size > 0) {
        const tasksEntity = typeof params.provider.EntityByName === 'function'
            ? params.provider.EntityByName(TASKS_ENTITY)
            : undefined;
        const taskRecClauses = Array.from(taskRecordIds).flatMap((id) => [`'ID|${id}'`, `'${id}'`]).join(', ');
        const entityFilter = tasksEntity?.ID ? ` AND EntityID = '${normalizeReceiptUuid(tasksEntity.ID) ?? tasksEntity.ID}'` : '';
        const taskSiRes = await rv.RunView<SpaceItemLookupRow>({
            EntityName: SPACE_ITEMS_ENTITY,
            ExtraFilter: `RecordID IN (${taskRecClauses})${entityFilter}`,
            Fields: ['ID', 'SpaceID', 'EntityID', 'RecordID', 'Band'],
            ResultType: 'simple',
            // row-cap-ok: bounded by tool hit count in a single turn
            MaxRows: 500,
        }, params.systemUser);
        if (taskSiRes.Success && taskSiRes.Results) {
            resolvedItems.push(...taskSiRes.Results);
        }
    }

    // Resolve target titles when missing from tool hits
    const fileRecordIds = new Set<string>();
    const taskTargetIds = new Set<string>();
    const filesEntityId = typeof params.provider.EntityByName === 'function'
        ? normalizeReceiptUuid(params.provider.EntityByName(FILES_ENTITY)?.ID)
        : null;
    const tasksEntityId = typeof params.provider.EntityByName === 'function'
        ? normalizeReceiptUuid(params.provider.EntityByName(TASKS_ENTITY)?.ID)
        : null;

    for (const item of resolvedItems) {
        const targetId = normalizeReceiptUuid(stripRecordKeyPrefix(item.RecordID));
        const entId = normalizeReceiptUuid(item.EntityID);
        if (!targetId) continue;
        if (filesEntityId && entId === filesEntityId) fileRecordIds.add(targetId);
        else if (tasksEntityId && entId === tasksEntityId) taskTargetIds.add(targetId);
    }

    const titleByTargetId = new Map<string, string>();
    const lookupTitles = async (entityName: string, ids: Set<string>): Promise<void> => {
        if (ids.size === 0) return;
        try {
            const inClause = Array.from(ids).map((id) => `'${id}'`).join(', ');
            const res = await rv.RunView<{ ID: string; Name: string | null }>({
                EntityName: entityName,
                ExtraFilter: `ID IN (${inClause})`,
                Fields: ['ID', 'Name'],
                ResultType: 'simple',
                // row-cap-ok: bounded by tool hit count in a single turn
                MaxRows: 500,
            }, params.systemUser);
            for (const row of res.Success && res.Results ? res.Results : []) {
                const rid = normalizeReceiptUuid(row.ID);
                if (rid && row.Name?.trim()) titleByTargetId.set(rid, row.Name.trim());
            }
        } catch (err) {
            LogError(`resolveToolSuppliedSourceCandidates title lookup warning: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    await Promise.all([
        lookupTitles(FILES_ENTITY, fileRecordIds),
        lookupTitles(TASKS_ENTITY, taskTargetIds),
    ]);

    const seenCandidateIds = new Set<string>(params.alreadySuppliedSpaceItemIds);
    for (const item of resolvedItems) {
        const cleanItemId = normalizeReceiptUuid(item.ID);
        const cleanSpaceId = normalizeReceiptUuid(item.SpaceID);
        const band: SourceReceiptBand | null = item.Band === 'Team' ? 'Team' : item.Band === 'Shared' ? 'Shared' : null;
        if (!cleanItemId || !cleanSpaceId || !band) {
            rejectedCount += 1;
            continue;
        }
        if (!canReaderAccessSourceReceipt({ spaceId: cleanSpaceId, band }, params.reachContext)) {
            rejectedCount += 1;
            continue;
        }
        if (seenCandidateIds.has(cleanItemId)) {
            continue;
        }
        seenCandidateIds.add(cleanItemId);

        const cleanTargetId = normalizeReceiptUuid(stripRecordKeyPrefix(item.RecordID));
        const hitMeta =
            hitBySpaceItemId.get(cleanItemId) ??
            (cleanTargetId ? hitByTaskRecordId.get(cleanTargetId) : undefined);
        const title =
            (cleanTargetId ? titleByTargetId.get(cleanTargetId) : undefined) ??
            hitMeta?.title?.trim() ??
            `Item ${cleanItemId.slice(0, 8)}`;

        spaceItemCandidates.push({
            sourceKind: 'SpaceItem',
            spaceId: cleanSpaceId,
            spaceItemId: cleanItemId,
            contentSourceId: null,
            targetEntityId: normalizeReceiptUuid(item.EntityID),
            targetRecordId: item.RecordID || null,
            sourceTitle: title,
            band,
            retrievalRank: null,
            relevanceScore: hitMeta?.score ?? null,
            rankingMode: hitMeta?.rankingMode ?? 'lexical',
            estimatedTokens: 0,
            wasTruncated: false,
        });
    }

    return { spaceItemCandidates, suppliedKnowledgeSourceIds, rejectedCount };
}

function receiptNaturalKey(entry: {
    sourceKind: string;
    spaceItemId: string | null;
    contentSourceId: string | null;
}): string | null {
    if (entry.sourceKind === 'SpaceItem') {
        const id = normalizeReceiptUuid(entry.spaceItemId);
        return id ? `SpaceItem:${id}` : null;
    }
    const id = normalizeReceiptUuid(entry.contentSourceId);
    return id ? `KnowledgeSource:${id}` : null;
}

/**
 * Idempotently persists validated source receipts for an assistant message detail row.
 * Validates all UUID identifiers strictly before executing any database queries, and uses
 * keyset-paged lookup so retries update existing rows in place without truncation or duplicates.
 */
export async function persistSpaceAgentSourceReceipts(
    params: PersistSpaceAgentSourceReceiptsParams,
): Promise<PersistSpaceAgentSourceReceiptsResult> {
    const {
        provider,
        systemUser,
        turnUserId,
        spaceChatId,
        conversationId,
        conversationDetailId,
        agentRunId,
        receipts,
        reachContext,
    } = params;

    const cleanChatId = normalizeReceiptUuid(spaceChatId);
    const cleanConversationId = normalizeReceiptUuid(conversationId);
    const cleanDetailId = normalizeReceiptUuid(conversationDetailId);
    const hasAgentRunId = agentRunId !== undefined && agentRunId !== null && String(agentRunId).trim().length > 0;
    const cleanRunId = hasAgentRunId ? normalizeReceiptUuid(agentRunId) : null;

    if (!cleanChatId || !cleanConversationId || !cleanDetailId || (hasAgentRunId && !cleanRunId)) {
        return {
            ok: false,
            errorMessage: 'Cannot persist source receipts without valid UUIDs for SpaceChatID, ConversationID, ConversationDetailID, and AgentRunID.',
        };
    }

    if (receipts.length === 0) {
        return { ok: true, persistedCount: 0, savedIds: [] };
    }

    for (const entry of receipts) {
        if (!normalizeReceiptUuid(entry.spaceId)) {
            return { ok: false, errorMessage: 'Cannot persist source receipt with invalid SpaceID UUID.' };
        }
        if (entry.sourceKind === 'SpaceItem' && !normalizeReceiptUuid(entry.spaceItemId)) {
            return { ok: false, errorMessage: 'Cannot persist SpaceItem source receipt with invalid SpaceItemID UUID.' };
        }
        if (entry.sourceKind === 'KnowledgeSource' && !normalizeReceiptUuid(entry.contentSourceId)) {
            return { ok: false, errorMessage: 'Cannot persist KnowledgeSource receipt with invalid ContentSourceID UUID.' };
        }
    }

    try {
        ensurePostgresReceiptContextHook(provider);
        return await runWithCollaborationAgentTurnAuthority(turnUserId, async () => {
            return await runWithPostgresPrivilegedReceiptContext(provider, async () => {
                const rv = RunView.FromMetadataProvider(provider);
                const existingRows = await readEveryRow<{
                    ID: string;
                    SourceKind: string;
                    SpaceItemID: string | null;
                    ContentSourceID: string | null;
                }>(
                    rv,
                    {
                        EntityName: COLLABORATION_SOURCE_RECEIPT_ENTITY,
                        ExtraFilter: `ConversationDetailID = '${cleanDetailId}'`,
                        Fields: ['ID', 'SourceKind', 'SpaceItemID', 'ContentSourceID'],
                    },
                    systemUser,
                );

                const existingIdByKey = new Map<string, string>();
                for (const row of existingRows) {
                    const key = receiptNaturalKey({
                        sourceKind: row.SourceKind,
                        spaceItemId: row.SpaceItemID,
                        contentSourceId: row.ContentSourceID,
                    });
                    const cleanExistingId = normalizeReceiptUuid(row.ID);
                    if (key && cleanExistingId) {
                        existingIdByKey.set(key, cleanExistingId);
                    }
                }

                const savedIds: string[] = [];
                for (const entry of receipts) {
                    const entity = await provider.GetEntityObject<mjBizAppsCollaborationSpaceAgentSourceReceiptEntity>(
                        COLLABORATION_SOURCE_RECEIPT_ENTITY,
                        systemUser,
                    );
                    if (!entity) {
                        return { ok: false, errorMessage: 'Unable to instantiate Space Agent Source Receipt entity.' };
                    }

                    const key = receiptNaturalKey(entry);
                    const existingId = key ? existingIdByKey.get(key) : undefined;
                    if (existingId) {
                        const loaded = await entity.Load(existingId);
                        if (!loaded) {
                            return { ok: false, errorMessage: `Failed to load existing source receipt ${existingId} for retry upsert.` };
                        }
                    } else {
                        entity.NewRecord();
                    }

                    entity.SpaceID = normalizeReceiptUuid(entry.spaceId)!;
                    entity.SpaceChatID = cleanChatId;
                    entity.ConversationID = cleanConversationId;
                    entity.ConversationDetailID = cleanDetailId;
                    entity.AgentRunID = cleanRunId;
                    entity.SourceKind = entry.sourceKind;
                    entity.SpaceItemID = entry.spaceItemId;
                    entity.ContentSourceID = entry.contentSourceId;
                    entity.TargetEntityID = entry.targetEntityId;
                    entity.TargetRecordID = entry.targetRecordId;
                    entity.SourceTitle = entry.sourceTitle;
                    entity.Band = entry.band;
                    entity.WasSupplied = entry.wasSupplied;
                    entity.WasCited = entry.wasCited;
                    entity.RetrievalRank = entry.retrievalRank;
                    entity.RelevanceScore = entry.relevanceScore;
                    entity.RankingMode = entry.rankingMode;
                    entity.CitationOrdinal = entry.citationOrdinal;
                    entity.EstimatedTokens = entry.estimatedTokens;
                    entity.WasTruncated = entry.wasTruncated;
                    entity.Sequence = entry.sequence;

                    const saved = await entity.Save();
                    if (!saved || !entity.ID) {
                        return {
                            ok: false,
                            errorMessage: entity.LatestResult?.CompleteMessage ?? 'Failed to save Space Agent Source Receipt row.',
                        };
                    }
                    savedIds.push(entity.ID);
                }

                return {
                    ok: true,
                    persistedCount: savedIds.length,
                    savedIds,
                };
            });
        }, { spaceChatId: cleanChatId, ...(reachContext ? { reachContext } : {}) });
    } catch (error) {
        return {
            ok: false,
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

export interface DeleteSpaceAgentSourceReceiptsForSpaceItemParams {
    provider: IMetadataProvider;
    systemUser: UserInfo;
    spaceItemId: string;
    sharedOnly?: boolean;
    transactionGroup?: TransactionGroupBase | null;
}

/**
 * Deletes or invalidates `SpaceAgentSourceReceipt` rows referencing `spaceItemId` inside a
 * privileged server operation scope and PostgreSQL bypass-RLS transaction context.
 */
export async function deleteSpaceAgentSourceReceiptsForSpaceItem(
    params: DeleteSpaceAgentSourceReceiptsForSpaceItemParams,
): Promise<mjBizAppsCollaborationSpaceAgentSourceReceiptEntity[]> {
    const trimmedItemId = typeof params.spaceItemId === 'string' ? params.spaceItemId.trim() : '';
    const cleanItemId = normalizeReceiptUuid(trimmedItemId) ?? (/^[A-Za-z0-9_-]+$/.test(trimmedItemId) ? trimmedItemId : null);
    if (!cleanItemId) {
        return [];
    }

    ensurePostgresReceiptContextHook(params.provider);

    return runWithPostgresPrivilegedReceiptContext(params.provider, async () => {
        const rv = RunView.FromMetadataProvider(params.provider);
        const bandClause = params.sharedOnly ? ` AND Band = 'Shared'` : '';
        const receiptsRes = await rv.RunView<mjBizAppsCollaborationSpaceAgentSourceReceiptEntity>({
            EntityName: COLLABORATION_SOURCE_RECEIPT_ENTITY,
            ExtraFilter: `SpaceItemID = '${cleanItemId}'${bandClause}`,
            ResultType: 'entity_object',
            IgnoreMaxRows: true,
        }, params.systemUser);

        if (!receiptsRes || !receiptsRes.Success) {
            throw new Error(
                `Space item receipt cleanup failed to query Space Agent Source Receipts for item ${cleanItemId}: ${receiptsRes?.ErrorMessage ?? 'RunView failed'}`,
            );
        }

        const loadedReceipts = receiptsRes.Results ?? [];
        for (const receiptEntity of loadedReceipts) {
            if (params.transactionGroup) {
                receiptEntity.TransactionGroup = params.transactionGroup;
            }
            const deleted = await ServerOperationScopeManager.Instance.RunWithAuthority(
                {
                    operationKey: COLLABORATION_ITEM_DELETE_OPERATION,
                    source: 'ServerEngine',
                    allowedEntities: [COLLABORATION_SOURCE_RECEIPT_ENTITY],
                    userId: params.systemUser.ID,
                },
                () => receiptEntity.Delete(),
            );
            if (!deleted) {
                throw new Error(
                    `Space item receipt cleanup failed to delete Space Agent Source Receipt ${receiptEntity.ID}`,
                );
            }
        }

        return loadedReceipts;
    });
}

/**
 * Queries source receipts for a conversation or assistant detail with strict UUID validation,
 * deterministic keyset pagination (no 500-row truncation), and fail-closed caller `(space, band)` filtering.
 */
export async function querySpaceAgentSourceReceipts(
    params: QuerySpaceAgentSourceReceiptsParams,
): Promise<QuerySpaceAgentSourceReceiptsResult> {
    const cleanConversationId = normalizeReceiptUuid(params.conversationId);
    if (!cleanConversationId || !params.user) {
        return { ok: false, receipts: [], filteredOutCount: 0, errorMessage: 'Invalid conversation or user.' };
    }

    const hasDetailId =
        params.conversationDetailId !== undefined &&
        params.conversationDetailId !== null;
    const cleanDetailId = hasDetailId ? normalizeReceiptUuid(params.conversationDetailId) : null;
    if (hasDetailId && !cleanDetailId) {
        return { ok: false, receipts: [], filteredOutCount: 0, errorMessage: 'Invalid conversationDetailId UUID.' };
    }

    ensurePostgresReceiptContextHook(params.provider);
    const rv = RunView.FromMetadataProvider(params.provider);
    const chatRes = await rv.RunView<{ ID: string; SpaceID: string; Kind: string; OwnerUserID: string | null }>({
        EntityName: SPACE_CHATS_ENTITY,
        ExtraFilter: `ConversationID = '${cleanConversationId}'`,
        Fields: ['ID', 'SpaceID', 'Kind', 'OwnerUserID'],
        ResultType: 'simple',
        // row-cap-ok: unique ConversationID lookup on SpaceChat returns at most one row
        MaxRows: 2,
    }, params.user);

    const chat = chatRes.Success && chatRes.Results ? chatRes.Results[0] : undefined;
    if (!chat) {
        return {
            ok: false,
            receipts: [],
            filteredOutCount: 0,
            errorMessage: 'SpaceChat not in caller reach.',
        };
    }

    const chatAudience: SourceReceiptBand =
        chat.Kind === 'General' || chat.Kind === 'Topic'
            ? 'Shared'
            : params.callerCanSeeTeam
                ? 'Team'
                : 'Shared';

    if (chat.Kind === 'Private' && !params.callerCanSeeTeam) {
        return {
            ok: false,
            receipts: [],
            filteredOutCount: 0,
            errorMessage: 'Private SpaceChat is not in caller reach.',
        };
    }

    if (chat.Kind === 'Assistant') {
        const cleanUserId = normalizeReceiptUuid(params.user.ID);
        const ownerUserId = normalizeReceiptUuid(chat.OwnerUserID);
        if (!cleanUserId || !ownerUserId || cleanUserId !== ownerUserId) {
            return {
                ok: false,
                receipts: [],
                filteredOutCount: 0,
                errorMessage: 'Assistant SpaceChat belongs to another user.',
            };
        }
    }

    const detailClause = cleanDetailId ? ` AND ConversationDetailID = '${cleanDetailId}'` : '';

    let allRows: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[];
    try {
        allRows = await readEveryRow<mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType>(
            rv,
            {
                EntityName: COLLABORATION_SOURCE_RECEIPT_ENTITY,
                ExtraFilter: `ConversationID = '${cleanConversationId}'${detailClause}`,
                Fields: [
                    'ID', 'SpaceID', 'SpaceChatID', 'ConversationID', 'ConversationDetailID',
                    'AgentRunID', 'SourceKind', 'SpaceItemID', 'ContentSourceID',
                    'TargetEntityID', 'TargetRecordID', 'SourceTitle', 'Band',
                    'WasSupplied', 'WasCited', 'RetrievalRank', 'RelevanceScore',
                    'RankingMode', 'CitationOrdinal', 'EstimatedTokens', 'WasTruncated', 'Sequence',
                    '__mj_CreatedAt',
                ],
            },
            params.user,
        );
    } catch (readErr) {
        return {
            ok: false,
            receipts: [],
            filteredOutCount: 0,
            errorMessage: readErr instanceof Error ? readErr.message : String(readErr),
        };
    }

    allRows.sort((a, b) => {
        const detailCmp = (a.ConversationDetailID ?? '').localeCompare(b.ConversationDetailID ?? '');
        if (detailCmp !== 0) return detailCmp;
        const seqA = typeof a.Sequence === 'number' ? a.Sequence : 0;
        const seqB = typeof b.Sequence === 'number' ? b.Sequence : 0;
        if (seqA !== seqB) return seqA - seqB;
        return (a.ID ?? '').localeCompare(b.ID ?? '');
    });

    const reachContext: SourceReceiptReachContext = {
        chatAudience,
        inReachSpaceBands: params.inReachSpaceBands,
    };

    const liveSnapshot: LiveReceiptSourceSnapshot = {};
    const spaceItemIds = [
        ...new Set(
            allRows
                .filter((r) => r.SourceKind === 'SpaceItem')
                .map((r) => normalizeReceiptUuid(r.SpaceItemID))
                .filter((id): id is string => !!id),
        ),
    ];
    if (spaceItemIds.length > 0) {
        const spaceItemsById = new Map<string, { spaceId: string; band: SourceReceiptBand }>();
        for (let offset = 0; offset < spaceItemIds.length; offset += LIVE_CHECK_BATCH_SIZE) {
            const batch = spaceItemIds.slice(offset, offset + LIVE_CHECK_BATCH_SIZE);
            const itemsRes = await rv.RunView<{ ID: string; SpaceID: string; Band: string }>({
                EntityName: SPACE_ITEMS_ENTITY,
                ExtraFilter: `ID IN (${batch.map((id) => `'${id}'`).join(', ')})`,
                Fields: ['ID', 'SpaceID', 'Band'],
                ResultType: 'simple',
                // row-cap-ok: bounded by deduplicated SpaceItemID batch (<= 200)
                MaxRows: LIVE_CHECK_BATCH_SIZE,
            }, params.user);
            if (!itemsRes.Success || !itemsRes.Results) {
                return {
                    ok: false,
                    receipts: [],
                    filteredOutCount: 0,
                    errorMessage: itemsRes.ErrorMessage ?? 'Failed to verify live SpaceItem visibility.',
                };
            }
            for (const row of itemsRes.Results) {
                const id = normalizeReceiptUuid(row.ID);
                const itemSpaceId = normalizeReceiptUuid(row.SpaceID);
                if (id && itemSpaceId && isSourceReceiptBand(row.Band)) {
                    spaceItemsById.set(id, { spaceId: itemSpaceId, band: row.Band });
                }
            }
        }
        liveSnapshot.spaceItemsById = spaceItemsById;
    }

    const knowledgeSpaceIds = [
        ...new Set(
            allRows
                .filter((r) => r.SourceKind === 'KnowledgeSource')
                .map((r) => normalizeReceiptUuid(r.SpaceID))
                .filter((id): id is string => !!id),
        ),
    ];
    if (knowledgeSpaceIds.length > 0) {
        let grantReader = params.user;
        try {
            const resolvedSystem = await WellKnownUserSource.Instance?.GetSystemUser(params.provider);
            if (resolvedSystem) grantReader = resolvedSystem;
        } catch {
            // Fall back to caller user in mocked test providers without WellKnownUserSource initialization
        }

        let spaceNodes: Array<LiveSpaceChainNodeInput & { ID: string }> = [];
        try {
            spaceNodes = await readEveryRow<LiveSpaceChainNodeInput & { ID: string }>(
                rv,
                {
                    EntityName: SPACES_ENTITY,
                    ExtraFilter: '',
                    Fields: ['ID', 'ParentID', 'SpaceTypeID', 'Configuration'],
                },
                grantReader,
            );
        } catch (spaceErr) {
            return {
                ok: false,
                receipts: [],
                filteredOutCount: 0,
                errorMessage: spaceErr instanceof Error ? spaceErr.message : String(spaceErr),
            };
        }

        let spaceTypeRows: Array<LiveSpaceTypeConfigInput & { ID: string }> = [];
        try {
            spaceTypeRows = await readEveryRow<LiveSpaceTypeConfigInput & { ID: string }>(
                rv,
                {
                    EntityName: SPACE_TYPES_ENTITY,
                    ExtraFilter: '',
                    Fields: ['ID', 'Configuration'],
                },
                grantReader,
            );
        } catch (typeErr) {
            return {
                ok: false,
                receipts: [],
                filteredOutCount: 0,
                errorMessage: typeErr instanceof Error ? typeErr.message : String(typeErr),
            };
        }

        let grantRows: Array<LiveKnowledgeSourceGrantInput & { ID: string }>;
        try {
            grantRows = await readEveryRow<LiveKnowledgeSourceGrantInput & { ID: string }>(
                rv,
                {
                    EntityName: SPACE_GRANTS_ENTITY,
                    ExtraFilter: `Kind = 'KnowledgeSource'`,
                    Fields: ['ID', 'SpaceID', 'SpaceTypeID', 'Kind', 'Mode', 'Band', 'TargetEntityID', 'TargetRecordID', 'Sequence'],
                },
                grantReader,
            );
        } catch (grantErr) {
            return {
                ok: false,
                receipts: [],
                filteredOutCount: 0,
                errorMessage: grantErr instanceof Error ? grantErr.message : String(grantErr),
            };
        }

        let appSettings: CollaborationSettings = DEFAULT_COLLABORATION_SETTINGS;
        try {
            if (CollaborationEngine.Instance.Loaded) {
                appSettings = CollaborationEngine.Instance.CollaborationSettings;
            }
        } catch {
            // Fall back to default app settings in mocked test environments without loaded ApplicationSettings
        }

        liveSnapshot.knowledgeSourceBandsBySpace = resolveEffectiveKnowledgeSourceBandsBySpace({
            spaceIds: knowledgeSpaceIds,
            spaces: spaceNodes,
            grants: grantRows,
            spaceTypes: spaceTypeRows,
            appSettings,
        });
    }

    const allowed: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[] = [];
    let filteredOutCount = 0;

    for (const row of allRows) {
        const band = row.Band === 'Team' ? 'Team' : row.Band === 'Shared' ? 'Shared' : null;
        if (
            !band ||
            !canReaderAccessSourceReceipt({ spaceId: row.SpaceID, band }, reachContext) ||
            !isReceiptAuthorizedByLiveSources(
                {
                    spaceId: row.SpaceID,
                    sourceKind: row.SourceKind,
                    spaceItemId: row.SpaceItemID,
                    contentSourceId: row.ContentSourceID,
                    band,
                },
                liveSnapshot,
            )
        ) {
            filteredOutCount += 1;
            continue;
        }
        allowed.push(row);
    }

    return {
        ok: true,
        receipts: allowed,
        filteredOutCount,
    };
}

export interface SingleReceiptAuthorizationInput {
    ID: string;
    SpaceID: string;
    SpaceChatID: string;
    ConversationID: string;
    SourceKind: string;
    SpaceItemID: string | null | undefined;
    ContentSourceID: string | null | undefined;
    Band: string;
}

export interface VerifySingleSourceReceiptParams {
    provider: IMetadataProvider;
    user: UserInfo;
    receipt: SingleReceiptAuthorizationInput;
}

/**
 * Verifies live SpaceChat reach, caller space/band membership reach, and live underlying
 * SpaceItem / effective KnowledgeSource grant authorization for a single source receipt.
 * Always fails closed (`false`) on missing, inconsistent, or denied metadata.
 */
export async function isSingleSourceReceiptAuthorizedForUser(
    params: VerifySingleSourceReceiptParams,
): Promise<boolean> {
    const { provider, user, receipt } = params;
    const cleanUserId = normalizeReceiptUuid(user?.ID);
    const cleanSpaceId = normalizeReceiptUuid(receipt.SpaceID);
    const cleanChatId = normalizeReceiptUuid(receipt.SpaceChatID);
    const cleanConversationId = normalizeReceiptUuid(receipt.ConversationID);
    const band = receipt.Band === 'Team' ? 'Team' : receipt.Band === 'Shared' ? 'Shared' : null;
    if (!cleanUserId || !cleanSpaceId || !cleanChatId || !cleanConversationId || !band) {
        return false;
    }
    if (receipt.SourceKind !== 'SpaceItem' && receipt.SourceKind !== 'KnowledgeSource') {
        return false;
    }

    let systemReader: UserInfo = user;
    try {
        const resolvedSystem = await WellKnownUserSource.Instance?.GetSystemUser(provider);
        if (resolvedSystem) systemReader = resolvedSystem;
    } catch {
        // Fall back to caller in mocked unit test providers without WellKnownUserSource initialization
    }

    const rv = RunView.FromMetadataProvider(provider);
    const chatRes = await rv.RunView<{
        ID: string;
        SpaceID: string;
        ConversationID: string;
        Kind: string;
        OwnerUserID: string | null;
    }>({
        EntityName: SPACE_CHATS_ENTITY,
        ExtraFilter: `ID = '${cleanChatId}'`,
        Fields: ['ID', 'SpaceID', 'ConversationID', 'Kind', 'OwnerUserID'],
        ResultType: 'simple',
        // row-cap-ok: primary key lookup by SpaceChatID returns at most one row
        MaxRows: 2,
    }, systemReader);

    const chat = chatRes.Success && chatRes.Results ? chatRes.Results[0] : undefined;
    const chatSpaceId = chat ? normalizeReceiptUuid(chat.SpaceID) : null;
    if (!chat || !chatSpaceId || normalizeReceiptUuid(chat.ConversationID) !== cleanConversationId) {
        return false;
    }

    const isPrivilegedOwner = user.Type?.trim() === 'Owner' && !isSpaceParticipant(user);
    if ((chat.Kind === 'General' || chat.Kind === 'Topic') && band !== 'Shared') {
        return false;
    }
    if (!isPrivilegedOwner && chat.Kind === 'Assistant' && normalizeReceiptUuid(chat.OwnerUserID) !== cleanUserId) {
        return false;
    }

    interface SpaceGraphRow extends SpaceRow {
        Configuration?: string | null;
    }

    let spaceRows: SpaceGraphRow[];
    try {
        spaceRows = await readEveryRow<SpaceGraphRow>(
            rv,
            {
                EntityName: SPACES_ENTITY,
                ExtraFilter: '',
                Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'AllowParentAssignees', 'ClosedAt', 'StatusID', 'SpaceTypeID', 'Configuration'],
            },
            systemReader,
        );
    } catch {
        return false;
    }

    if (!isPrivilegedOwner) {
        const [membersRes, rolesRes] = await Promise.all([
            rv.RunView<{
                SpaceID: string;
                UserID: string;
                Status: string;
                Band: string;
                SpaceRoleTypeID: string;
            }>({
                EntityName: SPACE_MEMBERS_ENTITY,
                ExtraFilter: `UserID = '${cleanUserId}' AND Status = 'Active'`,
                Fields: ['SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'],
                ResultType: 'simple',
                // row-cap-ok: bounded by single user's active memberships
                MaxRows: 2000,
            }, systemReader),
            rv.RunView<{
                ID: string;
                Level: number;
                MaxGrantableLevel: number;
                CanInvite: boolean;
                CanPromoteBand: boolean;
                CanSeeTeamBand: boolean;
                IsOwnerRole: boolean;
                CanContribute: boolean;
            }>({
                EntityName: SPACE_ROLES_ENTITY,
                Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
                ResultType: 'simple',
                // row-cap-ok: bounded space role catalog
                MaxRows: 200,
            }, systemReader),
        ]);

        if (!membersRes.Success || !rolesRes.Success) {
            return false;
        }

        const roleMap = new Map<string, RoleFlags>();
        for (const r of rolesRes.Results ?? []) {
            const rid = normalizeReceiptUuid(r.ID);
            if (!rid) continue;
            roleMap.set(rid, {
                level: Number(r.Level),
                maxGrantableLevel: Number(r.MaxGrantableLevel),
                canInvite: !!r.CanInvite,
                canPromoteBand: !!r.CanPromoteBand,
                canSeeTeamBand: !!r.CanSeeTeamBand,
                isOwnerRole: !!r.IsOwnerRole,
                canContribute: !!r.CanContribute,
            });
        }

        const snapshots: MemberSnapshot[] = [];
        for (const m of membersRes.Results ?? []) {
            const roleId = normalizeReceiptUuid(m.SpaceRoleTypeID);
            const flags = roleId ? roleMap.get(roleId) : undefined;
            if (!flags) continue;
            snapshots.push({
                spaceId: m.SpaceID,
                userId: m.UserID,
                status: m.Status as MemberSnapshot['status'],
                band: m.Band as SourceReceiptBand,
                role: flags,
            });
        }

        const spaceNodes: SpaceNode[] = spaceRows.map(toNode);
        const chatReach = membershipReaches(spaceNodes, snapshots, cleanUserId, chatSpaceId);
        const receiptReach = membershipReaches(spaceNodes, snapshots, cleanUserId, cleanSpaceId);
        if (!chatReach || !receiptReach) {
            return false;
        }
        if (chat.Kind === 'Private' && !chatReach.role.canSeeTeamBand) {
            return false;
        }
        if (band === 'Team' && !receiptReach.role.canSeeTeamBand) {
            return false;
        }
    }

    const liveSnapshot: LiveReceiptSourceSnapshot = {};
    if (receipt.SourceKind === 'SpaceItem') {
        const cleanItemId = normalizeReceiptUuid(receipt.SpaceItemID);
        if (!cleanItemId) {
            return false;
        }
        const itemRes = await rv.RunView<{ ID: string; SpaceID: string; Band: string }>({
            EntityName: SPACE_ITEMS_ENTITY,
            ExtraFilter: `ID = '${cleanItemId}'`,
            Fields: ['ID', 'SpaceID', 'Band'],
            ResultType: 'simple',
            // row-cap-ok: primary key lookup by SpaceItemID returns at most one row
            MaxRows: 2,
        }, systemReader);
        if (!itemRes.Success || !itemRes.Results) {
            return false;
        }
        const spaceItemsById = new Map<string, { spaceId: string; band: SourceReceiptBand }>();
        for (const item of itemRes.Results) {
            const id = normalizeReceiptUuid(item.ID);
            const itemSpaceId = normalizeReceiptUuid(item.SpaceID);
            if (id && itemSpaceId && isSourceReceiptBand(item.Band)) {
                spaceItemsById.set(id, { spaceId: itemSpaceId, band: item.Band });
            }
        }
        liveSnapshot.spaceItemsById = spaceItemsById;
    } else {
        const cleanContentSourceId = normalizeReceiptUuid(receipt.ContentSourceID);
        if (!cleanContentSourceId) {
            return false;
        }
        let spaceTypeRows: Array<LiveSpaceTypeConfigInput & { ID: string }>;
        let grantRows: Array<LiveKnowledgeSourceGrantInput & { ID: string }>;
        try {
            spaceTypeRows = await readEveryRow<LiveSpaceTypeConfigInput & { ID: string }>(
                rv,
                {
                    EntityName: SPACE_TYPES_ENTITY,
                    ExtraFilter: '',
                    Fields: ['ID', 'Configuration'],
                },
                systemReader,
            );
            grantRows = await readEveryRow<LiveKnowledgeSourceGrantInput & { ID: string }>(
                rv,
                {
                    EntityName: SPACE_GRANTS_ENTITY,
                    ExtraFilter: `Kind = 'KnowledgeSource'`,
                    Fields: ['ID', 'SpaceID', 'SpaceTypeID', 'Kind', 'Mode', 'Band', 'TargetEntityID', 'TargetRecordID', 'Sequence'],
                },
                systemReader,
            );
        } catch {
            return false;
        }

        let appSettings: CollaborationSettings = DEFAULT_COLLABORATION_SETTINGS;
        try {
            if (CollaborationEngine.Instance.Loaded) {
                appSettings = CollaborationEngine.Instance.CollaborationSettings;
            }
        } catch {
            // Fall back to default settings in mocked test environments
        }

        liveSnapshot.knowledgeSourceBandsBySpace = resolveEffectiveKnowledgeSourceBandsBySpace({
            spaceIds: [cleanSpaceId],
            spaces: spaceRows,
            grants: grantRows,
            spaceTypes: spaceTypeRows,
            appSettings,
        });
    }

    return isReceiptAuthorizedByLiveSources(
        {
            spaceId: cleanSpaceId,
            sourceKind: receipt.SourceKind,
            spaceItemId: normalizeReceiptUuid(receipt.SpaceItemID),
            contentSourceId: normalizeReceiptUuid(receipt.ContentSourceID),
            band,
        },
        liveSnapshot,
    );
}

export interface LoadSpaceAgentSourceReceiptByIdParams {
    provider: IMetadataProvider;
    user: UserInfo;
    receiptId: string;
}

export interface LoadSpaceAgentSourceReceiptByIdResult {
    ok: boolean;
    receipt: mjBizAppsCollaborationSpaceAgentSourceReceiptEntity | null;
    errorMessage?: string;
}

/**
 * Loads a single source receipt by ID through `GetEntityObject` + `Load()` and enforces
 * fail-closed caller reach and live SpaceItem / KnowledgeSource authorization.
 */
export async function loadSpaceAgentSourceReceiptById(
    params: LoadSpaceAgentSourceReceiptByIdParams,
): Promise<LoadSpaceAgentSourceReceiptByIdResult> {
    const cleanReceiptId = normalizeReceiptUuid(params.receiptId);
    const cleanUserId = normalizeReceiptUuid(params.user?.ID);
    if (!cleanReceiptId || !cleanUserId) {
        return {
            ok: false,
            receipt: null,
            errorMessage: 'Invalid receiptId or user UUID.',
        };
    }

    ensurePostgresReceiptContextHook(params.provider);
    const entity = await params.provider.GetEntityObject<mjBizAppsCollaborationSpaceAgentSourceReceiptEntity>(
        COLLABORATION_SOURCE_RECEIPT_ENTITY,
        params.user,
    );
    if (!entity) {
        return {
            ok: false,
            receipt: null,
            errorMessage: 'Unable to instantiate Space Agent Source Receipt entity.',
        };
    }

    const loaded = await entity.Load(cleanReceiptId);
    if (!loaded) {
        return {
            ok: true,
            receipt: null,
        };
    }

    const authorized = await isSingleSourceReceiptAuthorizedForUser({
        provider: params.provider,
        user: params.user,
        receipt: {
            ID: entity.ID,
            SpaceID: entity.SpaceID,
            SpaceChatID: entity.SpaceChatID,
            ConversationID: entity.ConversationID,
            SourceKind: entity.SourceKind,
            SpaceItemID: entity.SpaceItemID,
            ContentSourceID: entity.ContentSourceID,
            Band: entity.Band,
        },
    });
    if (!authorized) {
        return {
            ok: true,
            receipt: null,
        };
    }

    return {
        ok: true,
        receipt: entity,
    };
}
