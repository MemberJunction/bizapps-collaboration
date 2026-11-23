/**
 * NT-2 Scheduled Scoped Digest Engine, Composite Keyset `(EventTimestamp, ID)` Pagination,
 * Fail-Closed Assembly-Time Reach Verification, Checkpoint Persistence & BaseRemotableOperations.
 *
 * Browser-safe (`@mj-biz-apps/collaboration-engine-base`): dispatches non-empty digests
 * through the registered NT-1 {@link GetCollaborationCommsV2Transport} adapter.
 */

import {
    AuthorizationEvaluator,
    BaseRemotableOperation,
    type IMetadataProvider,
    type IRemoteOperationProvider,
    type RemoteOpServerContext,
    RemoteOperationError,
    RunView,
    ServerOperationScopeManager,
    type UserInfo,
    WellKnownUserSource,
} from '@memberjunction/core';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { MJGlobal, RegisterClass } from '@memberjunction/global';
import {
    advanceCompositeKeysetCursor,
    assembleScopedDigestForRecipient,
    COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
    COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY,
    type CollaborationNotificationChannel,
    type CollaborationUserNotificationPreferences,
    type CommsV2NotificationPayload,
    type CommsV2SuppressedChannel,
    computeNextDigestCheckpoint,
    createDefaultCollaborationNotificationPreferences,
    type DigestCandidateNotice,
    type DigestExcludedItemRecord,
    type DigestIncludedItem,
    type DigestItemReachVerificationSnapshot,
    type DigestRecipientScopeAccess,
    type DigestRecipientSpaceReach,
    type DigestSuppressionReason,
    type DigestTargetChatSnapshot,
    type DigestTargetItemSnapshot,
    type DigestTargetNoteSnapshot,
    isSpaceDigestCadence,
    isSpaceNoticeBand,
    isSpaceNoticeEventKind,
    type MJNotificationTypeDefaultSnapshot,
    type MJUserNotificationPreferenceSnapshot,
    type NotificationSuppressionReason,
    normalizeNoticeUuid,
    parseCollaborationNotificationPreferences,
    parseDigestTargetMetadata,
    parseNoticeTimestamp,
    sortNoticeEventsByCompositeKeyset,
    SPACE_CHATS_ENTITY_ID,
    type SpaceDigestCadence,
    type SpaceDigestCheckpointRecord,
    type SpaceDigestCheckpointStatus,
    SPACE_ITEMS_ENTITY_ID,
    SPACE_NOTES_ENTITY_ID,
    type SpaceNoticeBand,
    type SpaceNoticeCursor,
    ZERO_NOTICE_UUID,
} from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceDigestCheckpointEntity } from '@mj-biz-apps/collaboration-entities';
import {
    GetCollaborationCommsV2Transport,
    USER_NOTIFICATION_PREFERENCES_ENTITY,
    USER_NOTIFICATION_TYPES_ENTITY,
    USER_SETTINGS_ENTITY,
    type UserInfoEnginePreferenceBridge,
    USERS_ENTITY,
} from './notifications.js';
import {
    buildBatchedInFilter,
    chunkDistinctIds,
    detectAuditSqlDialect,
    quoteAuditIdentifier,
    readEverySimpleRow,
    type SqlDialect,
} from './security-audit-types.js';
import {
    SPACE_DIGEST_CHECKPOINT_ENTITY,
    SPACE_NOTICE_EVENT_ENTITY,
} from './space-notices.js';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const SPACE_ROLE_TYPES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';
const SPACE_TYPE_STATUS_ENTITY = 'MJ_BizApps_Collaboration: Space Type Status';
const SPACE_ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';
const SPACE_CHATS_ENTITY = 'MJ_BizApps_Collaboration: Space Chats';
const SPACE_NOTES_ENTITY = 'MJ_BizApps_Collaboration: Space Notes';

export const DEFAULT_DIGEST_KEYSET_PAGE_SIZE = 250;

export const RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY = 'Collaboration.RunScopedSpaceDigests';
export const PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY = 'Collaboration.PreviewScopedSpaceDigest';
export const UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY = 'Collaboration.UpdateSpaceDigestCheckpoint';

export interface SpaceDigestCheckpointDTO {
    ID: string;
    UserID: string;
    SpaceID: string | null;
    Cadence: SpaceDigestCadence;
    LastDeliveredTimestamp: string;
    LastDeliveredRecordID: string | null;
    LastDeliveredAt: string;
    ItemsIncludedCount: number;
    Status: SpaceDigestCheckpointStatus;
}

export interface RunScopedSpaceDigestsInput {
    Cadence?: SpaceDigestCadence;
    SpaceID?: string | null;
    SpaceIDs?: readonly string[];
    RecipientUserIDs?: readonly string[];
    TargetUserID?: string | null;
    IncludeChildSpaces?: boolean;
    IncludeActor?: boolean;
    DryRun?: boolean;
    ForceWindow?: boolean;
    IgnoreCadenceFilter?: boolean;
    CustomIntervalMs?: number;
    PageSize?: number;
    Now?: string;
    SinceTimestamp?: string;
    AllowedChannels?: Partial<Record<CollaborationNotificationChannel, boolean>>;
    Dialect?: SqlDialect;
}

export interface RecipientDigestExecutionOutcome {
    RecipientUserID: string;
    Cadence: SpaceDigestCadence;
    SpaceID: string | null;
    ShouldDeliver: boolean;
    SuppressionReason: DigestSuppressionReason | null;
    ChannelSuppressionReasons: NotificationSuppressionReason[];
    PermittedChannels: CollaborationNotificationChannel[];
    SuppressedChannels: CommsV2SuppressedChannel[];
    QuietHoursActive: boolean;
    Dispatched: boolean;
    DeliveredChannels: CollaborationNotificationChannel[];
    InAppNotificationID: string | null;
    ItemsIncludedCount: number;
    ExcludedItemCount: number;
    Items: DigestIncludedItem[];
    ExcludedItems: DigestExcludedItemRecord[];
    CheckpointAdvanced: boolean;
    Checkpoint: SpaceDigestCheckpointDTO | null;
    Payload: CommsV2NotificationPayload | null;
    ErrorMessage?: string;
}

export interface RunScopedSpaceDigestsResult {
    Success: boolean;
    Cadence: SpaceDigestCadence;
    WindowEndIso: string;
    PagesTraversed: number;
    TotalEventsScanned: number;
    TotalCandidateRecipients: number;
    DeliveredCount: number;
    SuppressedCount: number;
    EmptySuppressedCount: number;
    FailedCount: number;
    CheckpointsAdvancedCount: number;
    BatchedQueryCount: number;
    Outcomes: RecipientDigestExecutionOutcome[];
    ErrorMessage?: string;
}

export interface PreviewScopedSpaceDigestInput {
    Cadence?: SpaceDigestCadence;
    SpaceID?: string | null;
    SpaceIDs?: readonly string[];
    TargetUserID?: string | null;
    IncludeChildSpaces?: boolean;
    IncludeActor?: boolean;
    ForceWindow?: boolean;
    IgnoreCadenceFilter?: boolean;
    PageSize?: number;
    Now?: string;
    SinceTimestamp?: string;
    Dialect?: SqlDialect;
}

export interface PreviewScopedSpaceDigestResult {
    Success: boolean;
    RecipientUserID: string;
    Cadence: SpaceDigestCadence;
    WindowEndIso: string;
    PagesTraversed: number;
    TotalEventsScanned: number;
    BatchedQueryCount: number;
    Outcome: RecipientDigestExecutionOutcome | null;
    ErrorMessage?: string;
}

export interface UpdateSpaceDigestCheckpointInput {
    SpaceID?: string | null;
    Cadence?: SpaceDigestCadence;
    Status?: SpaceDigestCheckpointStatus;
    LastDeliveredTimestamp?: string;
    LastDeliveredRecordID?: string | null;
}

export interface UpdateSpaceDigestCheckpointResult {
    Success: boolean;
    Checkpoint: SpaceDigestCheckpointDTO | null;
    ErrorMessage?: string;
}

interface SimpleSpaceRow {
    ID: string;
    Name?: string | null;
    ParentID: string | null;
    SpaceTypeID: string;
    OwnerID: string;
    InheritsMembership: boolean;
    StatusID?: string | null;
    __mj_CreatedAt?: string | Date | null;
}

interface SimpleSpaceMemberRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    SpaceRoleTypeID: string;
    Band: string;
    Status: string;
    __mj_CreatedAt?: string | Date | null;
}

interface SimpleSpaceRoleTypeRow {
    ID: string;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
    CanContribute: boolean;
    IsActive: boolean;
}

interface SimpleSpaceTypeStatusRow {
    ID: string;
    Visible: boolean;
    ReadOnly: boolean;
}

interface SimpleSpaceNoticeEventRow {
    ID: string;
    SpaceID: string;
    ActorUserID: string | null;
    EventKind: string;
    Band: string;
    Title: string;
    Body: string | null;
    TargetEntityID: string | null;
    TargetRecordID: string | null;
    MetadataJSON: string | null;
    EventTimestamp: string | Date;
}

interface SimpleSpaceItemRow {
    ID: string;
    SpaceID: string;
    Band: string;
    EntityID?: string | null;
    RecordID?: string | null;
}

interface SimpleSpaceChatRow {
    ID: string;
    SpaceID: string;
    ConversationID?: string | null;
    Kind: string;
    Status: string;
    OwnerUserID?: string | null;
}

interface SimpleSpaceNoteRow {
    ID: string;
    SpaceID: string;
    Band: string;
    Visibility: string;
    AuthorUserID: string;
}

interface SimpleSpaceDigestCheckpointRow {
    ID: string;
    UserID: string;
    SpaceID: string | null;
    Cadence: string;
    LastDeliveredTimestamp: string | Date;
    LastDeliveredRecordID: string | null;
    LastDeliveredAt: string | Date;
    ItemsIncludedCount: number;
    Status: string;
}

interface SimpleUserRow {
    ID: string;
    Name?: string | null;
    Email?: string | null;
    Type?: string | null;
    IsActive?: boolean | null;
}

interface SimpleUserNotificationTypeRow {
    ID: string;
    Name: string;
    DefaultInApp: boolean;
    DefaultEmail: boolean;
    DefaultSMS: boolean;
    AllowUserPreference: boolean;
}

interface SimpleUserNotificationPreferenceRow {
    ID: string;
    UserID: string;
    NotificationTypeID: string;
    Enabled: boolean | null;
    InAppEnabled: boolean | null;
    EmailEnabled: boolean | null;
    SMSEnabled: boolean | null;
}

interface SimpleUserSettingRow {
    ID: string;
    UserID: string;
    Setting: string;
    Value: string | null;
}

function isRemoteOperationCapableProvider(
    provider: IMetadataProvider | undefined,
): provider is IMetadataProvider & IRemoteOperationProvider {
    return Boolean(provider && 'RouteOperation' in provider && typeof provider.RouteOperation === 'function');
}

function validateAuthenticatedMemberCaller(
    user: UserInfo | undefined,
): { ok: true; userId: string } | { ok: false; reason: string } {
    if (!user) {
        return { ok: false, reason: 'Authentication required: no acting user context.' };
    }
    if (user.IsMagicLinkAnonymous === true) {
        return { ok: false, reason: 'Anonymous magic-link sessions cannot access or execute space digests.' };
    }
    const cleanId = normalizeNoticeUuid(user.ID);
    if (!cleanId) {
        return { ok: false, reason: 'Authenticated user context does not carry a valid user ID.' };
    }
    return { ok: true, userId: cleanId };
}

async function resolvePrivilegedContextUser(provider: IMetadataProvider, fallbackUser: UserInfo): Promise<UserInfo> {
    try {
        const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
        return system ?? fallbackUser;
    } catch {
        return fallbackUser;
    }
}

function escapeSqlLiteral(value: string): string {
    return value.replace(/'/g, "''");
}

function isUserInfoEngineLoadedForUser(
    bridge: UserInfoEnginePreferenceBridge,
    userId: string,
): boolean {
    const loadedId = normalizeNoticeUuid(bridge.LoadedForUserId);
    return loadedId !== null && loadedId === userId;
}

function normalizeIsoTimestamp(value: string | Date): string {
    try {
        const parsed = parseNoticeTimestamp(value);
        return parsed.iso;
    } catch {
        return new Date(0).toISOString();
    }
}

function toCheckpointDTO(row: SimpleSpaceDigestCheckpointRow): SpaceDigestCheckpointDTO | null {
    const id = normalizeNoticeUuid(row.ID);
    const userId = normalizeNoticeUuid(row.UserID);
    if (!id || !userId || !isSpaceDigestCadence(row.Cadence)) {
        return null;
    }
    const status: SpaceDigestCheckpointStatus = row.Status === 'Paused' ? 'Paused' : 'Active';
    return {
        ID: id,
        UserID: userId,
        SpaceID: normalizeNoticeUuid(row.SpaceID),
        Cadence: row.Cadence,
        LastDeliveredTimestamp: normalizeIsoTimestamp(row.LastDeliveredTimestamp),
        LastDeliveredRecordID: normalizeNoticeUuid(row.LastDeliveredRecordID),
        LastDeliveredAt: normalizeIsoTimestamp(row.LastDeliveredAt),
        ItemsIncludedCount: typeof row.ItemsIncludedCount === 'number' ? row.ItemsIncludedCount : 0,
        Status: status,
    };
}

function earlierTimestamp(
    current: string | Date | null,
    candidate: string | Date | null | undefined,
): string | Date | null {
    if (!candidate) return current;
    let candidateMs: number;
    try {
        candidateMs = parseNoticeTimestamp(candidate).epochMs;
    } catch {
        return current;
    }
    if (!current) return candidate;
    try {
        const currentMs = parseNoticeTimestamp(current).epochMs;
        return candidateMs < currentMs ? candidate : current;
    } catch {
        return candidate;
    }
}

/**
 * Builds a dual-dialect composite `(EventTimestamp, ID) > (cursor.EventTimestamp, cursor.EventID)`
 * keyset continuation predicate without any `OFFSET`/`FETCH` clause.
 */
export function buildCompositeKeysetCursorFilter(
    cursor: SpaceNoticeCursor,
    dialect: SqlDialect,
): string {
    const tsCol = quoteAuditIdentifier('EventTimestamp', dialect);
    const idCol = quoteAuditIdentifier('ID', dialect);
    const tsIso = escapeSqlLiteral(parseNoticeTimestamp(cursor.EventTimestamp).iso);
    const idClean = normalizeNoticeUuid(cursor.EventID) ?? ZERO_NOTICE_UUID;
    return `(${tsCol} > '${tsIso}' OR (${tsCol} = '${tsIso}' AND ${idCol} > '${idClean}'))`;
}

/**
 * Builds a dual-dialect upper-bound `EventTimestamp <= windowEnd` predicate so a scheduled digest
 * run traverses a stable snapshot window even under concurrent tail insertions.
 */
export function buildCompositeKeysetUpperBoundFilter(
    windowEndIso: string,
    dialect: SqlDialect,
): string {
    const tsCol = quoteAuditIdentifier('EventTimestamp', dialect);
    const tsIso = escapeSqlLiteral(parseNoticeTimestamp(windowEndIso).iso);
    return `${tsCol} <= '${tsIso}'`;
}

export interface KeysetNoticeEventReadOptions {
    SpaceIDs?: readonly string[];
    AfterCursor?: SpaceNoticeCursor | null;
    WindowEndIso?: string;
    PageSize?: number;
    Dialect: SqlDialect;
}

export interface KeysetNoticeEventReadResult {
    Rows: SimpleSpaceNoticeEventRow[];
    PagesTraversed: number;
    QueryCount: number;
}

const NOTICE_EVENT_FIELDS = [
    'ID',
    'SpaceID',
    'ActorUserID',
    'EventKind',
    'Band',
    'Title',
    'Body',
    'TargetEntityID',
    'TargetRecordID',
    'MetadataJSON',
    'EventTimestamp',
] as const;

/**
 * Traverses ALL matching `Space Notice Events` deterministically via composite keyset pagination
 * `(EventTimestamp ASC, ID ASC)` using `RunView` (`ResultType: 'simple'`), looping until
 * exhausted with ZERO silent row caps and ZERO `OFFSET` drift.
 */
export async function readEverySpaceNoticeEventKeyset(
    rv: RunView,
    options: KeysetNoticeEventReadOptions,
    readUser: UserInfo,
): Promise<KeysetNoticeEventReadResult> {
    const pageSize =
        typeof options.PageSize === 'number' && Number.isInteger(options.PageSize) && options.PageSize > 0
            ? options.PageSize
            : DEFAULT_DIGEST_KEYSET_PAGE_SIZE;

    const spaceBatches =
        options.SpaceIDs && options.SpaceIDs.length > 0
            ? chunkDistinctIds(options.SpaceIDs)
            : [null];

    const allRows: SimpleSpaceNoticeEventRow[] = [];
    const globalSeenIds = new Set<string>();
    let totalPagesTraversed = 0;
    let totalQueryCount = 0;

    for (const spaceBatch of spaceBatches) {
        let cursor: SpaceNoticeCursor | null = options.AfterCursor ?? null;

        for (;;) {
            const predicates: string[] = [];
            if (spaceBatch) {
                predicates.push(buildBatchedInFilter('SpaceID', spaceBatch, options.Dialect));
            }
            if (options.WindowEndIso) {
                predicates.push(buildCompositeKeysetUpperBoundFilter(options.WindowEndIso, options.Dialect));
            }
            if (cursor) {
                predicates.push(buildCompositeKeysetCursorFilter(cursor, options.Dialect));
            }

            totalQueryCount += 1;
            totalPagesTraversed += 1;

            const result = await rv.RunView<SimpleSpaceNoticeEventRow>(
                {
                    EntityName: SPACE_NOTICE_EVENT_ENTITY,
                    ...(predicates.length > 0 ? { ExtraFilter: predicates.join(' AND ') } : {}),
                    Fields: [...NOTICE_EVENT_FIELDS],
                    OrderBy: 'EventTimestamp ASC, ID ASC',
                    // row-cap-ok: composite (EventTimestamp, ID) keyset page size; loops until page < pageSize with zero truncation
                    MaxRows: pageSize,
                    ResultType: 'simple',
                },
                readUser,
            );

            if (!result.Success) {
                throw new RemoteOperationError(
                    'EXECUTION_ERROR',
                    `Failed to keyset-page ${SPACE_NOTICE_EVENT_ENTITY}: ${result.ErrorMessage ?? 'unknown error'}`,
                );
            }

            const pageRows = result.Results ?? [];
            let newRowsInPage = 0;
            const prevCursorMs = cursor ? parseNoticeTimestamp(cursor.EventTimestamp).epochMs : null;

            for (const row of pageRows) {
                const rowId = normalizeNoticeUuid(row.ID);
                if (!rowId) {
                    throw new RemoteOperationError(
                        'EXECUTION_ERROR',
                        `Encountered ${SPACE_NOTICE_EVENT_ENTITY} row without a valid UUID ID during keyset pagination.`,
                    );
                }
                if (globalSeenIds.has(rowId)) {
                    const rowMs = parseNoticeTimestamp(row.EventTimestamp).epochMs;
                    const isSubMsBoundaryOverlap = prevCursorMs !== null && Math.abs(rowMs - prevCursorMs) <= 1;
                    if (isSubMsBoundaryOverlap) {
                        continue;
                    }
                    throw new RemoteOperationError(
                        'EXECUTION_ERROR',
                        `Keyset pagination detected repeated ${SPACE_NOTICE_EVENT_ENTITY} ID '${rowId}', indicating cursor non-progression.`,
                    );
                }
                globalSeenIds.add(rowId);
                allRows.push(row);
                newRowsInPage += 1;
            }

            if (pageRows.length < pageSize) {
                break;
            }

            if (newRowsInPage === 0) {
                throw new RemoteOperationError(
                    'EXECUTION_ERROR',
                    `Keyset pagination on ${SPACE_NOTICE_EVENT_ENTITY} stalled with 0 unseen rows on a full page.`,
                );
            }

            cursor = advanceCompositeKeysetCursor(cursor, pageRows);
        }
    }

    return {
        Rows: allRows,
        PagesTraversed: totalPagesTraversed,
        QueryCount: totalQueryCount,
    };
}

function canCallerRunMultiRecipientDigests(
    actingUser: UserInfo,
    provider: IMetadataProvider,
): boolean {
    if (actingUser.Type?.trim() === 'Owner') {
        return true;
    }
    const auths = provider?.Authorizations ?? [];
    const root = auths.find((a) => (a.Name ?? '').trim().toLowerCase() === 'collaboration' && !a.ParentID);
    if (!root) {
        return false;
    }
    const adminAuth = auths.find(
        (a) =>
            (a.Name ?? '').trim().toLowerCase() === 'administer spaces' &&
            normalizeNoticeUuid(a.ParentID) === normalizeNoticeUuid(root.ID),
    );
    if (!adminAuth) {
        return false;
    }
    return new AuthorizationEvaluator().UserCanExecuteWithAncestors(adminAuth, actingUser, auths);
}

async function resolveScopedSpacesAndAncestors(
    rv: RunView,
    initialSpaceIds: readonly string[],
    includeChildSpaces: boolean,
    readUser: UserInfo,
    dialect: SqlDialect,
): Promise<{
    spaceById: Map<string, SimpleSpaceRow>;
    statusById: Map<string, SimpleSpaceTypeStatusRow>;
    scopedSeedIds: string[];
    batchedQueryCount: number;
}> {
    let batchedQueryCount = 0;
    const spaceById = new Map<string, SimpleSpaceRow>();
    const initialSet = [
        ...new Set(initialSpaceIds.map((id) => normalizeNoticeUuid(id)).filter((id): id is string => id !== null)),
    ];

    for (const batch of chunkDistinctIds(initialSet)) {
        const res = await readEverySimpleRow<SimpleSpaceRow>(
            rv,
            {
                EntityName: SPACES_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'Name', 'ParentID', 'SpaceTypeID', 'OwnerID', 'InheritsMembership', 'StatusID', '__mj_CreatedAt'],
            },
            readUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load spaces for digest: ${res.error}`);
        }
        for (const row of res.rows) {
            const sid = normalizeNoticeUuid(row.ID);
            if (sid) spaceById.set(sid, row);
        }
    }

    // Optional downward BFS for inheriting child spaces when a parent space scope is requested.
    const scopedSeedSet = new Set<string>(initialSet);
    if (includeChildSpaces && initialSet.length > 0) {
        let frontier = [...initialSet];
        const visitedDown = new Set<string>();
        while (frontier.length > 0) {
            const unvisited = frontier.filter((id) => !visitedDown.has(id));
            for (const id of unvisited) visitedDown.add(id);
            frontier = [];
            for (const batch of chunkDistinctIds(unvisited)) {
                const res = await readEverySimpleRow<SimpleSpaceRow>(
                    rv,
                    {
                        EntityName: SPACES_ENTITY,
                        ExtraFilter: `${buildBatchedInFilter('ParentID', batch, dialect)} AND InheritsMembership = 1`,
                        Fields: ['ID', 'Name', 'ParentID', 'SpaceTypeID', 'OwnerID', 'InheritsMembership', 'StatusID', '__mj_CreatedAt'],
                    },
                    readUser,
                );
                batchedQueryCount += res.queryCount;
                if (!res.ok) {
                    throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load child spaces: ${res.error}`);
                }
                for (const child of res.rows) {
                    const cid = normalizeNoticeUuid(child.ID);
                    if (cid) {
                        spaceById.set(cid, child);
                        scopedSeedSet.add(cid);
                        if (!visitedDown.has(cid)) {
                            frontier.push(cid);
                        }
                    }
                }
            }
        }
    }

    // Walk upward ParentID chains for all loaded spaces with InheritsMembership = 1 in batched waves.
    let upFrontier = [...spaceById.keys()];
    const visitedUp = new Set<string>();
    while (upFrontier.length > 0) {
        const parentsToFetch: string[] = [];
        for (const sid of upFrontier) {
            if (visitedUp.has(sid)) continue;
            visitedUp.add(sid);
            const sp = spaceById.get(sid);
            if (sp?.InheritsMembership && sp.ParentID) {
                const pid = normalizeNoticeUuid(sp.ParentID);
                if (pid && !spaceById.has(pid)) {
                    parentsToFetch.push(pid);
                } else if (pid && !visitedUp.has(pid)) {
                    upFrontier.push(pid);
                }
            }
        }
        upFrontier = [];
        for (const batch of chunkDistinctIds(parentsToFetch)) {
            const res = await readEverySimpleRow<SimpleSpaceRow>(
                rv,
                {
                    EntityName: SPACES_ENTITY,
                    ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                    Fields: ['ID', 'Name', 'ParentID', 'SpaceTypeID', 'OwnerID', 'InheritsMembership', 'StatusID', '__mj_CreatedAt'],
                },
                readUser,
            );
            batchedQueryCount += res.queryCount;
            if (!res.ok) {
                throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load ancestor spaces: ${res.error}`);
            }
            for (const p of res.rows) {
                const pid = normalizeNoticeUuid(p.ID);
                if (pid) {
                    spaceById.set(pid, p);
                    upFrontier.push(pid);
                }
            }
        }
    }

    const statusIds = [...spaceById.values()]
        .map((s) => normalizeNoticeUuid(s.StatusID))
        .filter((id): id is string => id !== null);
    const statusById = new Map<string, SimpleSpaceTypeStatusRow>();
    for (const batch of chunkDistinctIds(statusIds)) {
        const res = await readEverySimpleRow<SimpleSpaceTypeStatusRow>(
            rv,
            {
                EntityName: SPACE_TYPE_STATUS_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'Visible', 'ReadOnly'],
            },
            readUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space type statuses: ${res.error}`);
        }
        for (const st of res.rows) {
            const stId = normalizeNoticeUuid(st.ID);
            if (stId) statusById.set(stId, st);
        }
    }

    return {
        spaceById,
        statusById,
        scopedSeedIds: [...scopedSeedSet],
        batchedQueryCount,
    };
}

function buildAncestorIdsBySpace(spaceById: ReadonlyMap<string, SimpleSpaceRow>): Map<string, string[]> {
    const ancestorsBySpace = new Map<string, string[]>();
    for (const spaceId of spaceById.keys()) {
        const ancestors: string[] = [];
        const seen = new Set<string>([spaceId]);
        let cursor = spaceById.get(spaceId);
        while (cursor?.InheritsMembership && cursor.ParentID) {
            const pid = normalizeNoticeUuid(cursor.ParentID);
            if (!pid || seen.has(pid)) break;
            seen.add(pid);
            ancestors.push(pid);
            cursor = spaceById.get(pid);
        }
        ancestorsBySpace.set(spaceId, ancestors);
    }
    return ancestorsBySpace;
}

async function batchVerifyTargetReferences(
    rv: RunView,
    events: readonly DigestCandidateNotice[],
    readUser: UserInfo,
    dialect: SqlDialect,
): Promise<{ snapshot: DigestItemReachVerificationSnapshot; batchedQueryCount: number }> {
    let batchedQueryCount = 0;
    const itemIds: string[] = [];
    const chatIds: string[] = [];
    const conversationIds: string[] = [];
    const noteIds: string[] = [];

    for (const ev of events) {
        const targetEntityId = normalizeNoticeUuid(ev.TargetEntityID);
        const targetRecordId = ev.TargetRecordID
            ? normalizeNoticeUuid(
                  ev.TargetRecordID.trim().toLowerCase().startsWith('id|')
                      ? ev.TargetRecordID.trim().slice(3)
                      : ev.TargetRecordID,
              )
            : null;
        if (ev.ReferencedSpaceItemID) itemIds.push(ev.ReferencedSpaceItemID);
        if (targetEntityId === SPACE_ITEMS_ENTITY_ID && targetRecordId) itemIds.push(targetRecordId);

        if (ev.ReferencedSpaceChatID) chatIds.push(ev.ReferencedSpaceChatID);
        if (targetEntityId === SPACE_CHATS_ENTITY_ID && targetRecordId) chatIds.push(targetRecordId);
        if (ev.ReferencedConversationID) conversationIds.push(ev.ReferencedConversationID);

        if (ev.ReferencedSpaceNoteID) noteIds.push(ev.ReferencedSpaceNoteID);
        if (targetEntityId === SPACE_NOTES_ENTITY_ID && targetRecordId) noteIds.push(targetRecordId);
    }

    const spaceItemsById = new Map<string, DigestTargetItemSnapshot>();
    for (const batch of chunkDistinctIds(itemIds)) {
        const res = await readEverySimpleRow<SimpleSpaceItemRow>(
            rv,
            {
                EntityName: SPACE_ITEMS_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'SpaceID', 'Band', 'EntityID', 'RecordID'],
            },
            readUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to verify target Space Items: ${res.error}`);
        }
        for (const item of res.rows) {
            const id = normalizeNoticeUuid(item.ID);
            const sid = normalizeNoticeUuid(item.SpaceID);
            if (id && sid && isSpaceNoticeBand(item.Band)) {
                spaceItemsById.set(id, {
                    ID: id,
                    SpaceID: sid,
                    Band: item.Band,
                    EntityID: normalizeNoticeUuid(item.EntityID),
                    RecordID: item.RecordID ?? null,
                });
            }
        }
    }

    const spaceChatsById = new Map<string, DigestTargetChatSnapshot>();
    const spaceChatsByConversationId = new Map<string, DigestTargetChatSnapshot>();
    const mapChatRow = (row: SimpleSpaceChatRow) => {
        const id = normalizeNoticeUuid(row.ID);
        const sid = normalizeNoticeUuid(row.SpaceID);
        if (!id || !sid) return;
        const kind: DigestTargetChatSnapshot['Kind'] =
            row.Kind === 'Assistant' || row.Kind === 'Private' || row.Kind === 'Topic' ? row.Kind : 'General';
        const status: DigestTargetChatSnapshot['Status'] = row.Status === 'Archived' ? 'Archived' : 'Active';
        const snap: DigestTargetChatSnapshot = {
            ID: id,
            SpaceID: sid,
            ConversationID: normalizeNoticeUuid(row.ConversationID),
            Kind: kind,
            Status: status,
            OwnerUserID: normalizeNoticeUuid(row.OwnerUserID),
        };
        spaceChatsById.set(id, snap);
        if (snap.ConversationID) {
            spaceChatsByConversationId.set(snap.ConversationID, snap);
        }
    };

    for (const batch of chunkDistinctIds(chatIds)) {
        const res = await readEverySimpleRow<SimpleSpaceChatRow>(
            rv,
            {
                EntityName: SPACE_CHATS_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'SpaceID', 'ConversationID', 'Kind', 'Status', 'OwnerUserID'],
            },
            readUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to verify target Space Chats: ${res.error}`);
        }
        for (const row of res.rows) mapChatRow(row);
    }

    for (const batch of chunkDistinctIds(conversationIds)) {
        const res = await readEverySimpleRow<SimpleSpaceChatRow>(
            rv,
            {
                EntityName: SPACE_CHATS_ENTITY,
                ExtraFilter: buildBatchedInFilter('ConversationID', batch, dialect),
                Fields: ['ID', 'SpaceID', 'ConversationID', 'Kind', 'Status', 'OwnerUserID'],
            },
            readUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to verify target Space Chats by ConversationID: ${res.error}`);
        }
        for (const row of res.rows) mapChatRow(row);
    }

    const spaceNotesById = new Map<string, DigestTargetNoteSnapshot>();
    for (const batch of chunkDistinctIds(noteIds)) {
        const res = await readEverySimpleRow<SimpleSpaceNoteRow>(
            rv,
            {
                EntityName: SPACE_NOTES_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'SpaceID', 'Band', 'Visibility', 'AuthorUserID'],
            },
            readUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to verify target Space Notes: ${res.error}`);
        }
        for (const note of res.rows) {
            const id = normalizeNoticeUuid(note.ID);
            const sid = normalizeNoticeUuid(note.SpaceID);
            const authorId = normalizeNoticeUuid(note.AuthorUserID);
            if (id && sid && authorId && isSpaceNoticeBand(note.Band)) {
                spaceNotesById.set(id, {
                    ID: id,
                    SpaceID: sid,
                    Band: note.Band,
                    Visibility: note.Visibility === 'Private' ? 'Private' : 'Space',
                    AuthorUserID: authorId,
                });
            }
        }
    }

    return {
        snapshot: {
            SpaceItemsById: spaceItemsById,
            SpaceChatsById: spaceChatsById,
            SpaceChatsByConversationId: spaceChatsByConversationId,
            SpaceNotesById: spaceNotesById,
        },
        batchedQueryCount,
    };
}

async function loadCheckpointRow(
    rv: RunView,
    userId: string,
    spaceId: string | null,
    cadence: SpaceDigestCadence,
    readUser: UserInfo,
    dialect: SqlDialect,
): Promise<SimpleSpaceDigestCheckpointRow | null> {
    const spaceCol = quoteAuditIdentifier('SpaceID', dialect);
    const userCol = quoteAuditIdentifier('UserID', dialect);
    const cadenceCol = quoteAuditIdentifier('Cadence', dialect);
    const spacePredicate = spaceId ? `${spaceCol} = '${spaceId}'` : `${spaceCol} IS NULL`;
    const res = await rv.RunView<SimpleSpaceDigestCheckpointRow>(
        {
            EntityName: SPACE_DIGEST_CHECKPOINT_ENTITY,
            ExtraFilter: `${userCol} = '${userId}' AND ${spacePredicate} AND ${cadenceCol} = '${escapeSqlLiteral(cadence)}'`,
            Fields: [
                'ID',
                'UserID',
                'SpaceID',
                'Cadence',
                'LastDeliveredTimestamp',
                'LastDeliveredRecordID',
                'LastDeliveredAt',
                'ItemsIncludedCount',
                'Status',
            ],
            ResultType: 'simple',
            MaxRows: 1,
        },
        readUser,
    );
    if (!res.Success) {
        throw new RemoteOperationError(
            'EXECUTION_ERROR',
            `Failed to load digest checkpoint: ${res.ErrorMessage ?? 'unknown error'}`,
        );
    }
    return res.Results?.[0] ?? null;
}

async function persistDigestCheckpointMonotonic(params: {
    provider: IMetadataProvider;
    rv: RunView;
    actingUser: UserInfo;
    privilegedUser: UserInfo;
    operationKey: string;
    recipientUserId: string;
    spaceId: string | null;
    cadence: SpaceDigestCadence;
    existingRow: SimpleSpaceDigestCheckpointRow | null;
    candidateCursor: SpaceNoticeCursor;
    itemsIncludedCount: number;
    deliveredAt: Date;
    dialect: SqlDialect;
}): Promise<{ persisted: boolean; checkpoint: SpaceDigestCheckpointDTO | null }> {
    const existingDto = params.existingRow ? toCheckpointDTO(params.existingRow) : null;
    const plan = computeNextDigestCheckpoint({
        CurrentCheckpoint: existingDto,
        CandidateCursor: params.candidateCursor,
        ItemsIncludedCount: params.itemsIncludedCount,
        DispatchSucceeded: true,
    });
    if (!plan.shouldPersist || !plan.nextTimestamp) {
        return { persisted: false, checkpoint: existingDto };
    }

    const targetDate = new Date(parseNoticeTimestamp(plan.nextTimestamp).epochMs);

    const saveAttempt = async (
        currentRow: SimpleSpaceDigestCheckpointRow | null,
    ): Promise<{ persisted: boolean; checkpoint: SpaceDigestCheckpointDTO | null }> => {
        return ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: params.operationKey,
                source: 'ServerEngine',
                allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
                userId: params.actingUser.ID,
            },
            async () => {
                const entity =
                    await params.provider.GetEntityObject<mjBizAppsCollaborationSpaceDigestCheckpointEntity>(
                        SPACE_DIGEST_CHECKPOINT_ENTITY,
                        params.privilegedUser,
                    );
                if (currentRow) {
                    const loaded = await entity.Load(currentRow.ID);
                    if (!loaded) {
                        throw new RemoteOperationError(
                            'EXECUTION_ERROR',
                            `Failed to load digest checkpoint ${currentRow.ID}.`,
                        );
                    }
                } else {
                    entity.NewRecord();
                    entity.UserID = params.recipientUserId;
                    entity.SpaceID = params.spaceId;
                    entity.Cadence = params.cadence;
                    entity.Status = 'Active';
                }

                entity.LastDeliveredTimestamp = targetDate;
                entity.LastDeliveredRecordID = plan.nextRecordId;
                entity.LastDeliveredAt = params.deliveredAt;
                entity.ItemsIncludedCount = plan.itemsIncludedCount;

                const saved = await entity.Save();
                if (!saved) {
                    if (!currentRow) {
                        const raced = await loadCheckpointRow(
                            params.rv,
                            params.recipientUserId,
                            params.spaceId,
                            params.cadence,
                            params.privilegedUser,
                            params.dialect,
                        );
                        if (raced) {
                            const racedDto = toCheckpointDTO(raced);
                            const racedPlan = computeNextDigestCheckpoint({
                                CurrentCheckpoint: racedDto,
                                CandidateCursor: params.candidateCursor,
                                ItemsIncludedCount: params.itemsIncludedCount,
                                DispatchSucceeded: true,
                            });
                            if (!racedPlan.shouldPersist) {
                                return { persisted: false, checkpoint: racedDto };
                            }
                            return saveAttempt(raced);
                        }
                    }
                    const detail = entity.LatestResult?.CompleteMessage || entity.LatestResult?.Message || 'Save failed';
                    throw new RemoteOperationError('EXECUTION_ERROR', `Failed to save digest checkpoint: ${detail}`);
                }

                return {
                    persisted: true,
                    checkpoint: {
                        ID: normalizeNoticeUuid(entity.ID) ?? entity.ID,
                        UserID: params.recipientUserId,
                        SpaceID: params.spaceId,
                        Cadence: params.cadence,
                        LastDeliveredTimestamp: targetDate.toISOString(),
                        LastDeliveredRecordID: plan.nextRecordId,
                        LastDeliveredAt: params.deliveredAt.toISOString(),
                        ItemsIncludedCount: plan.itemsIncludedCount,
                        Status: entity.Status === 'Paused' ? 'Paused' : 'Active',
                    },
                };
            },
        );
    };

    return saveAttempt(params.existingRow);
}

/**
 * NT-2 Scheduled Scoped Digest Runner:
 * - Traverses ALL eligible `Space Notice Events` via composite keyset `(EventTimestamp, ID)`
 *   pagination via `RunView` (`ResultType: 'simple'`), ZERO `OFFSET` and ZERO silent row caps.
 * - Batch-loads Spaces, ancestor chains, SpaceMembers, SpaceRoleTypes, SpaceTypeStatuses,
 *   target SpaceItems/SpaceChats/SpaceNotes, Users, NotificationTypes, UserNotificationPreferences,
 *   UserSettings (`UserInfoEngine` overlay), and SpaceDigestCheckpoints via batched `IN (...)` predicates.
 * - Re-verifies every item's reach & target access fail-closed at digest assembly time.
 * - Strictly suppresses empty digests when zero reach-verified items remain.
 * - Dispatches non-empty digests through NT-1 Comms v2 transport and advances `SpaceDigestCheckpoint` monotonically.
 */
export async function runRunScopedSpaceDigests(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: RunScopedSpaceDigestsInput = {},
    userInfoEngine: UserInfoEnginePreferenceBridge = UserInfoEngine.Instance,
): Promise<RunScopedSpaceDigestsResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }

    const cadence: SpaceDigestCadence = input.Cadence ?? 'Daily';
    if (!isSpaceDigestCadence(cadence)) {
        throw new RemoteOperationError('VALIDATION_ERROR', `Invalid digest Cadence '${String(input.Cadence)}'.`);
    }

    const nowUtc = input.Now ? new Date(input.Now) : new Date();
    if (Number.isNaN(nowUtc.getTime())) {
        throw new RemoteOperationError('VALIDATION_ERROR', 'Now must be a valid ISO timestamp when provided.');
    }
    const windowEndIso = nowUtc.toISOString();

    const requestedSpaceIdsRaw: string[] = [];
    let primaryScopedSpaceId: string | null = null;
    if (input.SpaceID) {
        const clean = normalizeNoticeUuid(input.SpaceID);
        if (!clean) {
            throw new RemoteOperationError('VALIDATION_ERROR', 'SpaceID must be a valid UUID.');
        }
        requestedSpaceIdsRaw.push(clean);
        primaryScopedSpaceId = clean;
    }
    if (input.SpaceIDs) {
        for (const raw of input.SpaceIDs) {
            const clean = normalizeNoticeUuid(raw);
            if (!clean) {
                throw new RemoteOperationError('VALIDATION_ERROR', `Invalid SpaceID '${String(raw)}'.`);
            }
            requestedSpaceIdsRaw.push(clean);
        }
        if (!primaryScopedSpaceId && requestedSpaceIdsRaw.length === 1) {
            primaryScopedSpaceId = requestedSpaceIdsRaw[0];
        }
    }

    const explicitRecipientIds: string[] = [];
    const seenExplicit = new Set<string>();
    if (input.TargetUserID) {
        const clean = normalizeNoticeUuid(input.TargetUserID);
        if (!clean) {
            throw new RemoteOperationError('VALIDATION_ERROR', 'TargetUserID must be a valid UUID.');
        }
        seenExplicit.add(clean);
        explicitRecipientIds.push(clean);
    }
    for (const rawId of input.RecipientUserIDs ?? []) {
        const clean = normalizeNoticeUuid(rawId);
        if (!clean) {
            throw new RemoteOperationError('VALIDATION_ERROR', `Invalid RecipientUserID '${String(rawId)}'.`);
        }
        if (!seenExplicit.has(clean)) {
            seenExplicit.add(clean);
            explicitRecipientIds.push(clean);
        }
    }

    const targetsOtherUsers =
        explicitRecipientIds.length === 0 ||
        explicitRecipientIds.some((id) => id !== auth.userId);
    if (targetsOtherUsers && !canCallerRunMultiRecipientDigests(actingUser, provider)) {
        throw new RemoteOperationError(
            'FORBIDDEN',
            'Only Owners or callers with Administer Spaces authorization may run digests for other members.',
        );
    }

    const dialect = input.Dialect ?? detectAuditSqlDialect(provider);
    const privilegedUser = await resolvePrivilegedContextUser(provider, actingUser);
    const rv = RunView.FromMetadataProvider(provider);
    let batchedQueryCount = 0;

    // 1. Resolve scoped spaces (and inheriting child spaces if IncludeChildSpaces) + ancestors.
    let spaceById = new Map<string, SimpleSpaceRow>();
    let statusById = new Map<string, SimpleSpaceTypeStatusRow>();
    let targetSpaceFilterIds: string[] | undefined;

    if (requestedSpaceIdsRaw.length > 0) {
        const scoped = await resolveScopedSpacesAndAncestors(
            rv,
            requestedSpaceIdsRaw,
            input.IncludeChildSpaces === true,
            privilegedUser,
            dialect,
        );
        spaceById = scoped.spaceById;
        statusById = scoped.statusById;
        targetSpaceFilterIds = scoped.scopedSeedIds;
        batchedQueryCount += scoped.batchedQueryCount;
    }

    // 2. If explicit recipients are provided and they all already have checkpoints for this scope/cadence,
    //    compute the earliest composite cursor floor so keyset pagination skips historical delivered windows.
    let lowerBoundCursor: SpaceNoticeCursor | null = null;
    if (input.SinceTimestamp) {
        lowerBoundCursor = {
            EventTimestamp: parseNoticeTimestamp(input.SinceTimestamp).iso,
            EventID: ZERO_NOTICE_UUID,
        };
    }

    const checkpointByUser = new Map<string, SimpleSpaceDigestCheckpointRow>();
    if (explicitRecipientIds.length > 0) {
        const spaceCol = quoteAuditIdentifier('SpaceID', dialect);
        const cadenceCol = quoteAuditIdentifier('Cadence', dialect);
        const cpSpacePred = primaryScopedSpaceId
            ? `${spaceCol} = '${primaryScopedSpaceId}'`
            : `${spaceCol} IS NULL`;
        for (const batch of chunkDistinctIds(explicitRecipientIds)) {
            const cpRes = await readEverySimpleRow<SimpleSpaceDigestCheckpointRow>(
                rv,
                {
                    EntityName: SPACE_DIGEST_CHECKPOINT_ENTITY,
                    ExtraFilter: `${buildBatchedInFilter('UserID', batch, dialect)} AND ${cpSpacePred} AND ${cadenceCol} = '${escapeSqlLiteral(cadence)}'`,
                    Fields: [
                        'ID',
                        'UserID',
                        'SpaceID',
                        'Cadence',
                        'LastDeliveredTimestamp',
                        'LastDeliveredRecordID',
                        'LastDeliveredAt',
                        'ItemsIncludedCount',
                        'Status',
                    ],
                },
                privilegedUser,
            );
            batchedQueryCount += cpRes.queryCount;
            if (!cpRes.ok) {
                throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load digest checkpoints: ${cpRes.error}`);
            }
            for (const row of cpRes.rows) {
                const uid = normalizeNoticeUuid(row.UserID);
                if (uid) checkpointByUser.set(uid, row);
            }
        }

        if (!lowerBoundCursor && explicitRecipientIds.every((uid) => checkpointByUser.has(uid))) {
            for (const uid of explicitRecipientIds) {
                const row = checkpointByUser.get(uid);
                if (!row) continue;
                const c: SpaceNoticeCursor = {
                    EventTimestamp: row.LastDeliveredTimestamp,
                    EventID: normalizeNoticeUuid(row.LastDeliveredRecordID) ?? ZERO_NOTICE_UUID,
                };
                if (!lowerBoundCursor) {
                    lowerBoundCursor = c;
                } else {
                    const cmp =
                        parseNoticeTimestamp(c.EventTimestamp).epochMs -
                        parseNoticeTimestamp(lowerBoundCursor.EventTimestamp).epochMs;
                    if (cmp < 0) lowerBoundCursor = c;
                }
            }
        }
    }

    // 3. Traverse ALL eligible SpaceNoticeEvent rows via composite keyset (EventTimestamp, ID) pagination.
    const keysetResult = await readEverySpaceNoticeEventKeyset(
        rv,
        {
            ...(targetSpaceFilterIds ? { SpaceIDs: targetSpaceFilterIds } : {}),
            AfterCursor: lowerBoundCursor,
            WindowEndIso: windowEndIso,
            PageSize: input.PageSize,
            Dialect: dialect,
        },
        privilegedUser,
    );
    batchedQueryCount += keysetResult.QueryCount;

    const candidateEvents: DigestCandidateNotice[] = [];
    const eventSpaceIds: string[] = [];
    for (const rawEv of keysetResult.Rows) {
        const id = normalizeNoticeUuid(rawEv.ID);
        const sid = normalizeNoticeUuid(rawEv.SpaceID);
        if (!id || !sid || !isSpaceNoticeEventKind(rawEv.EventKind) || !isSpaceNoticeBand(rawEv.Band)) {
            continue;
        }
        const meta = parseDigestTargetMetadata(rawEv.MetadataJSON);
        eventSpaceIds.push(sid);
        candidateEvents.push({
            ID: id,
            SpaceID: sid,
            ActorUserID: normalizeNoticeUuid(rawEv.ActorUserID),
            EventKind: rawEv.EventKind,
            Band: rawEv.Band,
            Title: rawEv.Title,
            Body: rawEv.Body ?? null,
            TargetEntityID: normalizeNoticeUuid(rawEv.TargetEntityID),
            TargetRecordID: rawEv.TargetRecordID ?? null,
            MetadataJSON: rawEv.MetadataJSON ?? null,
            EventTimestamp: rawEv.EventTimestamp,
            ReferencedSpaceItemID: meta.SpaceItemID,
            ReferencedSpaceChatID: meta.SpaceChatID,
            ReferencedConversationID: meta.ConversationID,
            ReferencedSpaceNoteID: meta.SpaceNoteID,
        });
    }

    // Ensure all spaces referenced by traversed events (plus their ancestors and statuses) are loaded.
    const missingEventSpaceIds = eventSpaceIds.filter((sid) => !spaceById.has(sid));
    if (missingEventSpaceIds.length > 0) {
        const resolvedEventSpaces = await resolveScopedSpacesAndAncestors(
            rv,
            missingEventSpaceIds,
            false,
            privilegedUser,
            dialect,
        );
        batchedQueryCount += resolvedEventSpaces.batchedQueryCount;
        for (const [k, v] of resolvedEventSpaces.spaceById.entries()) spaceById.set(k, v);
        for (const [k, v] of resolvedEventSpaces.statusById.entries()) statusById.set(k, v);
    }

    for (const ev of candidateEvents) {
        ev.SpaceName = spaceById.get(ev.SpaceID)?.Name ?? null;
    }

    // 4. Batch-load SpaceMembers across all spaces in the chain + discover candidate recipients.
    const allChainSpaceIds = [...spaceById.keys()];
    const memberRows: SimpleSpaceMemberRow[] = [];
    if (allChainSpaceIds.length > 0) {
        for (const spaceBatch of chunkDistinctIds(allChainSpaceIds)) {
            const mRes = await readEverySimpleRow<SimpleSpaceMemberRow>(
                rv,
                {
                    EntityName: SPACE_MEMBERS_ENTITY,
                    ExtraFilter: `${buildBatchedInFilter('SpaceID', spaceBatch, dialect)} AND Status = 'Active'`,
                    Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Band', 'Status', '__mj_CreatedAt'],
                },
                privilegedUser,
            );
            batchedQueryCount += mRes.queryCount;
            if (!mRes.ok) {
                throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load Space Members: ${mRes.error}`);
            }
            memberRows.push(...mRes.rows);
        }
    }

    const candidateRecipientSet = new Set<string>(explicitRecipientIds);
    if (explicitRecipientIds.length === 0) {
        for (const sp of spaceById.values()) {
            const ownerId = normalizeNoticeUuid(sp.OwnerID);
            if (ownerId) candidateRecipientSet.add(ownerId);
        }
        for (const m of memberRows) {
            const uid = normalizeNoticeUuid(m.UserID);
            if (uid) candidateRecipientSet.add(uid);
        }
    }
    const candidateRecipientIds = [...candidateRecipientSet];

    if (candidateRecipientIds.length === 0) {
        return {
            Success: true,
            Cadence: cadence,
            WindowEndIso: windowEndIso,
            PagesTraversed: keysetResult.PagesTraversed,
            TotalEventsScanned: candidateEvents.length,
            TotalCandidateRecipients: 0,
            DeliveredCount: 0,
            SuppressedCount: 0,
            EmptySuppressedCount: 0,
            FailedCount: 0,
            CheckpointsAdvancedCount: 0,
            BatchedQueryCount: batchedQueryCount,
            Outcomes: [],
        };
    }

    // If recipients were discovered dynamically, load their SpaceDigestCheckpoints now in one batched pass.
    if (explicitRecipientIds.length === 0) {
        const spaceCol = quoteAuditIdentifier('SpaceID', dialect);
        const cadenceCol = quoteAuditIdentifier('Cadence', dialect);
        const cpSpacePred = primaryScopedSpaceId
            ? `${spaceCol} = '${primaryScopedSpaceId}'`
            : `${spaceCol} IS NULL`;
        for (const batch of chunkDistinctIds(candidateRecipientIds)) {
            const cpRes = await readEverySimpleRow<SimpleSpaceDigestCheckpointRow>(
                rv,
                {
                    EntityName: SPACE_DIGEST_CHECKPOINT_ENTITY,
                    ExtraFilter: `${buildBatchedInFilter('UserID', batch, dialect)} AND ${cpSpacePred} AND ${cadenceCol} = '${escapeSqlLiteral(cadence)}'`,
                    Fields: [
                        'ID',
                        'UserID',
                        'SpaceID',
                        'Cadence',
                        'LastDeliveredTimestamp',
                        'LastDeliveredRecordID',
                        'LastDeliveredAt',
                        'ItemsIncludedCount',
                        'Status',
                    ],
                },
                privilegedUser,
            );
            batchedQueryCount += cpRes.queryCount;
            if (!cpRes.ok) {
                throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load digest checkpoints: ${cpRes.error}`);
            }
            for (const row of cpRes.rows) {
                const uid = normalizeNoticeUuid(row.UserID);
                if (uid) checkpointByUser.set(uid, row);
            }
        }
    }

    // 5. Batch-load SpaceRoleTypes + target SpaceItems / SpaceChats / SpaceNotes for fail-closed verification.
    const roleIds = memberRows
        .map((m) => normalizeNoticeUuid(m.SpaceRoleTypeID))
        .filter((id): id is string => id !== null);
    const roleById = new Map<string, SimpleSpaceRoleTypeRow>();
    for (const batch of chunkDistinctIds(roleIds)) {
        const rRes = await readEverySimpleRow<SimpleSpaceRoleTypeRow>(
            rv,
            {
                EntityName: SPACE_ROLE_TYPES_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute', 'IsActive'],
            },
            privilegedUser,
        );
        batchedQueryCount += rRes.queryCount;
        if (!rRes.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load Space Role Types: ${rRes.error}`);
        }
        for (const role of rRes.rows) {
            const rid = normalizeNoticeUuid(role.ID);
            if (rid) roleById.set(rid, role);
        }
    }

    const verifiedTargets = await batchVerifyTargetReferences(rv, candidateEvents, privilegedUser, dialect);
    batchedQueryCount += verifiedTargets.batchedQueryCount;

    // 6. Batch-load Users, NotificationTypes, UserNotificationPreferences, and UserSettings.
    const userById = new Map<string, SimpleUserRow>();
    for (const batch of chunkDistinctIds(candidateRecipientIds)) {
        const uRes = await readEverySimpleRow<SimpleUserRow>(
            rv,
            {
                EntityName: USERS_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'Name', 'Email', 'Type', 'IsActive'],
            },
            privilegedUser,
        );
        batchedQueryCount += uRes.queryCount;
        if (!uRes.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load recipient users: ${uRes.error}`);
        }
        for (const u of uRes.rows) {
            const uid = normalizeNoticeUuid(u.ID);
            if (uid) userById.set(uid, u);
        }
    }

    const typesRes = await readEverySimpleRow<SimpleUserNotificationTypeRow>(
        rv,
        {
            EntityName: USER_NOTIFICATION_TYPES_ENTITY,
            Fields: ['ID', 'Name', 'DefaultInApp', 'DefaultEmail', 'DefaultSMS', 'AllowUserPreference'],
        },
        privilegedUser,
    );
    batchedQueryCount += typesRes.queryCount;
    if (!typesRes.ok) {
        throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load notification types: ${typesRes.error}`);
    }

    let digestTypeDefault: MJNotificationTypeDefaultSnapshot | null = null;
    for (const t of typesRes.rows) {
        if ((t.Name ?? '').trim().toLowerCase() === COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME.toLowerCase()) {
            digestTypeDefault = {
                ID: normalizeNoticeUuid(t.ID) ?? t.ID,
                Name: t.Name,
                DefaultInApp: Boolean(t.DefaultInApp),
                DefaultEmail: Boolean(t.DefaultEmail),
                DefaultSMS: Boolean(t.DefaultSMS),
                AllowUserPreference: t.AllowUserPreference !== false,
            };
            break;
        }
    }

    const mjPrefByUser = new Map<string, MJUserNotificationPreferenceSnapshot>();
    if (digestTypeDefault) {
        for (const batch of chunkDistinctIds(candidateRecipientIds)) {
            const prefRes = await readEverySimpleRow<SimpleUserNotificationPreferenceRow>(
                rv,
                {
                    EntityName: USER_NOTIFICATION_PREFERENCES_ENTITY,
                    ExtraFilter: `${buildBatchedInFilter('UserID', batch, dialect)} AND NotificationTypeID = '${digestTypeDefault.ID}'`,
                    Fields: ['ID', 'UserID', 'NotificationTypeID', 'Enabled', 'InAppEnabled', 'EmailEnabled', 'SMSEnabled'],
                },
                privilegedUser,
            );
            batchedQueryCount += prefRes.queryCount;
            if (!prefRes.ok) {
                throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load user notification preferences: ${prefRes.error}`);
            }
            for (const p of prefRes.rows) {
                const uid = normalizeNoticeUuid(p.UserID);
                if (uid) {
                    mjPrefByUser.set(uid, {
                        UserID: uid,
                        NotificationTypeID: normalizeNoticeUuid(p.NotificationTypeID) ?? p.NotificationTypeID,
                        Enabled: p.Enabled ?? null,
                        InAppEnabled: p.InAppEnabled ?? null,
                        EmailEnabled: p.EmailEnabled ?? null,
                        SMSEnabled: p.SMSEnabled ?? null,
                    });
                }
            }
        }
    }

    const settingsPrefByUser = new Map<string, CollaborationUserNotificationPreferences>();
    for (const batch of chunkDistinctIds(candidateRecipientIds)) {
        const sRes = await readEverySimpleRow<SimpleUserSettingRow>(
            rv,
            {
                EntityName: USER_SETTINGS_ENTITY,
                ExtraFilter: `${buildBatchedInFilter('UserID', batch, dialect)} AND Setting = '${escapeSqlLiteral(COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY)}'`,
                Fields: ['ID', 'UserID', 'Setting', 'Value'],
            },
            privilegedUser,
        );
        batchedQueryCount += sRes.queryCount;
        if (!sRes.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to batch-load user notification settings: ${sRes.error}`);
        }
        for (const row of sRes.rows) {
            const uid = normalizeNoticeUuid(row.UserID);
            if (uid && row.Value) {
                settingsPrefByUser.set(uid, parseCollaborationNotificationPreferences(row.Value));
            }
        }
    }

    for (const uid of candidateRecipientIds) {
        if (isUserInfoEngineLoadedForUser(userInfoEngine, uid)) {
            const liveRaw = userInfoEngine.GetSetting(COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY);
            if (liveRaw !== undefined) {
                settingsPrefByUser.set(uid, parseCollaborationNotificationPreferences(liveRaw));
            }
        }
    }

    // Index direct memberships by (UserID, SpaceID) for O(1) reach assembly per recipient.
    const membersByUserSpace = new Map<string, Map<string, SimpleSpaceMemberRow[]>>();
    for (const m of memberRows) {
        const uid = normalizeNoticeUuid(m.UserID);
        const sid = normalizeNoticeUuid(m.SpaceID);
        if (!uid || !sid) continue;
        const userMap = membersByUserSpace.get(uid) ?? new Map<string, SimpleSpaceMemberRow[]>();
        const list = userMap.get(sid) ?? [];
        list.push(m);
        userMap.set(sid, list);
        membersByUserSpace.set(uid, userMap);
    }

    const ancestorIdsBySpace = buildAncestorIdsBySpace(spaceById);
    const targetSpaceIdSet = targetSpaceFilterIds ? new Set(targetSpaceFilterIds) : null;
    const sortedEvents = sortNoticeEventsByCompositeKeyset(candidateEvents);
    const transport = input.DryRun ? null : GetCollaborationCommsV2Transport();

    const outcomes: RecipientDigestExecutionOutcome[] = [];
    let deliveredCount = 0;
    let suppressedCount = 0;
    let emptySuppressedCount = 0;
    let failedCount = 0;
    let checkpointsAdvancedCount = 0;

    for (const recipientId of candidateRecipientIds) {
        const userRow = userById.get(recipientId);
        const isActiveUser = Boolean(userRow && userRow.IsActive !== false);
        const userSpaceMembers = membersByUserSpace.get(recipientId);

        const reachBySpace = new Map<string, DigestRecipientSpaceReach>();
        for (const [sid, space] of spaceById.entries()) {
            let isOwner = normalizeNoticeUuid(space.OwnerID) === recipientId;
            let canSeeTeam = isOwner;
            let hasReach = isOwner;
            let memberJoinedAt: string | Date | null = isOwner ? (space.__mj_CreatedAt ?? null) : null;

            let cursor: SimpleSpaceRow | undefined = space;
            const cycleGuard = new Set<string>();
            while (cursor) {
                const cursorId = normalizeNoticeUuid(cursor.ID);
                if (!cursorId || cycleGuard.has(cursorId)) break;
                cycleGuard.add(cursorId);

                if (normalizeNoticeUuid(cursor.OwnerID) === recipientId) {
                    isOwner = true;
                    canSeeTeam = true;
                    hasReach = true;
                    memberJoinedAt = earlierTimestamp(memberJoinedAt, cursor.__mj_CreatedAt);
                }

                const seats = userSpaceMembers?.get(cursorId) ?? [];
                for (const seat of seats) {
                    const roleId = normalizeNoticeUuid(seat.SpaceRoleTypeID);
                    const role = roleId ? roleById.get(roleId) : undefined;
                    if (role && role.IsActive === false) continue;
                    hasReach = true;
                    memberJoinedAt = earlierTimestamp(memberJoinedAt, seat.__mj_CreatedAt);
                    const roleTeam = role ? role.CanSeeTeamBand === true : seat.Band === 'Team';
                    const roleOwner = role ? role.IsOwnerRole === true : false;
                    if (roleTeam || roleOwner) canSeeTeam = true;
                    if (roleOwner) isOwner = true;
                }

                if (!cursor.InheritsMembership || !cursor.ParentID) break;
                const parentId = normalizeNoticeUuid(cursor.ParentID);
                cursor = parentId ? spaceById.get(parentId) : undefined;
            }

            if (!hasReach) continue;

            const statusId = normalizeNoticeUuid(space.StatusID);
            const statusRow = statusId ? statusById.get(statusId) : undefined;
            const isVisibleStatus = statusRow ? statusRow.Visible !== false : true;

            reachBySpace.set(sid, {
                SpaceID: sid,
                CanSeeTeam: canSeeTeam,
                MemberJoinedAt: memberJoinedAt,
                IsVisibleStatus: isVisibleStatus,
                IsOwner: isOwner,
            });
        }

        const existingCpRow = checkpointByUser.get(recipientId) ?? null;
        const existingCpRecord: SpaceDigestCheckpointRecord | null = existingCpRow
            ? toCheckpointDTO(existingCpRow)
            : null;

        const assembled = assembleScopedDigestForRecipient({
            Recipient: {
                UserID: recipientId,
                Name: userRow?.Name ?? null,
                Email: userRow?.Email ?? null,
                IsActiveUser: isActiveUser,
                ReachBySpace: reachBySpace,
                AncestorSpaceIDsBySpace: ancestorIdsBySpace,
                Preferences: settingsPrefByUser.get(recipientId) ?? createDefaultCollaborationNotificationPreferences(),
                MJDigestPreference: mjPrefByUser.get(recipientId) ?? null,
                Checkpoint: existingCpRecord,
            },
            Events: sortedEvents,
            Cadence: cadence,
            TargetSpaceID: primaryScopedSpaceId,
            TargetSpaceIDs: targetSpaceIdSet,
            DigestNotificationTypeDefault: digestTypeDefault,
            VerificationSnapshot: verifiedTargets.snapshot,
            AllowedChannels: input.AllowedChannels,
            NowUtc: nowUtc,
            ForceWindow: input.ForceWindow,
            IgnoreCadenceFilter: input.IgnoreCadenceFilter,
            CustomIntervalMs: input.CustomIntervalMs,
            IncludeActor: input.IncludeActor,
        });

        if (!assembled.ShouldDeliver || !assembled.Payload) {
            suppressedCount += 1;
            if (assembled.SuppressionReason === 'EmptyDigest') {
                emptySuppressedCount += 1;
            }
            outcomes.push({
                RecipientUserID: recipientId,
                Cadence: cadence,
                SpaceID: assembled.SpaceID,
                ShouldDeliver: false,
                SuppressionReason: assembled.SuppressionReason,
                ChannelSuppressionReasons: assembled.ChannelSuppressionReasons,
                PermittedChannels: assembled.PermittedChannels,
                SuppressedChannels: assembled.SuppressedChannels,
                QuietHoursActive: assembled.QuietHoursActive,
                Dispatched: false,
                DeliveredChannels: [],
                InAppNotificationID: null,
                ItemsIncludedCount: assembled.Items.length,
                ExcludedItemCount: assembled.ExcludedItems.length,
                Items: assembled.Items,
                ExcludedItems: assembled.ExcludedItems,
                CheckpointAdvanced: false,
                Checkpoint: existingCpRecord ? toCheckpointDTO(existingCpRow!) : null,
                Payload: null,
            });
            continue;
        }

        if (input.DryRun) {
            outcomes.push({
                RecipientUserID: recipientId,
                Cadence: cadence,
                SpaceID: assembled.SpaceID,
                ShouldDeliver: true,
                SuppressionReason: null,
                ChannelSuppressionReasons: assembled.ChannelSuppressionReasons,
                PermittedChannels: assembled.PermittedChannels,
                SuppressedChannels: assembled.SuppressedChannels,
                QuietHoursActive: assembled.QuietHoursActive,
                Dispatched: false,
                DeliveredChannels: [],
                InAppNotificationID: null,
                ItemsIncludedCount: assembled.Items.length,
                ExcludedItemCount: assembled.ExcludedItems.length,
                Items: assembled.Items,
                ExcludedItems: assembled.ExcludedItems,
                CheckpointAdvanced: false,
                Checkpoint: existingCpRecord ? toCheckpointDTO(existingCpRow!) : null,
                Payload: assembled.Payload,
            });
            continue;
        }

        if (!transport) {
            failedCount += 1;
            outcomes.push({
                RecipientUserID: recipientId,
                Cadence: cadence,
                SpaceID: assembled.SpaceID,
                ShouldDeliver: true,
                SuppressionReason: null,
                ChannelSuppressionReasons: assembled.ChannelSuppressionReasons,
                PermittedChannels: assembled.PermittedChannels,
                SuppressedChannels: assembled.SuppressedChannels,
                QuietHoursActive: assembled.QuietHoursActive,
                Dispatched: false,
                DeliveredChannels: [],
                InAppNotificationID: null,
                ItemsIncludedCount: assembled.Items.length,
                ExcludedItemCount: assembled.ExcludedItems.length,
                Items: assembled.Items,
                ExcludedItems: assembled.ExcludedItems,
                CheckpointAdvanced: false,
                Checkpoint: existingCpRecord ? toCheckpointDTO(existingCpRow!) : null,
                Payload: assembled.Payload,
                ErrorMessage: 'No Collaboration Comms v2 notification transport is registered.',
            });
            continue;
        }

        try {
            const dispatchResult = await transport.Dispatch({
                Payload: assembled.Payload,
                NotificationTypeDefault: digestTypeDefault,
                Provider: provider,
                ActingUser: actingUser,
                SystemUser: privilegedUser,
            });

            if (!dispatchResult.Success) {
                failedCount += 1;
                outcomes.push({
                    RecipientUserID: recipientId,
                    Cadence: cadence,
                    SpaceID: assembled.SpaceID,
                    ShouldDeliver: true,
                    SuppressionReason: null,
                    ChannelSuppressionReasons: assembled.ChannelSuppressionReasons,
                    PermittedChannels: assembled.PermittedChannels,
                    SuppressedChannels: assembled.SuppressedChannels,
                    QuietHoursActive: assembled.QuietHoursActive,
                    Dispatched: false,
                    DeliveredChannels: [],
                    InAppNotificationID: null,
                    ItemsIncludedCount: assembled.Items.length,
                    ExcludedItemCount: assembled.ExcludedItems.length,
                    Items: assembled.Items,
                    ExcludedItems: assembled.ExcludedItems,
                    CheckpointAdvanced: false,
                    Checkpoint: existingCpRecord ? toCheckpointDTO(existingCpRow!) : null,
                    Payload: assembled.Payload,
                    ...(dispatchResult.ErrorMessage ? { ErrorMessage: dispatchResult.ErrorMessage } : {}),
                });
                continue;
            }

            deliveredCount += 1;
            let checkpointAdvanced = false;
            let updatedCheckpoint: SpaceDigestCheckpointDTO | null = existingCpRow ? toCheckpointDTO(existingCpRow) : null;

            const cursorToPersist = assembled.HighestObservedCursor ?? assembled.HighestIncludedCursor;
            if (cursorToPersist) {
                const persisted = await persistDigestCheckpointMonotonic({
                    provider,
                    rv,
                    actingUser,
                    privilegedUser,
                    operationKey: RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
                    recipientUserId: recipientId,
                    spaceId: assembled.SpaceID,
                    cadence,
                    existingRow: existingCpRow,
                    candidateCursor: cursorToPersist,
                    itemsIncludedCount: assembled.Items.length,
                    deliveredAt: nowUtc,
                    dialect,
                });
                checkpointAdvanced = persisted.persisted;
                updatedCheckpoint = persisted.checkpoint;
                if (checkpointAdvanced) {
                    checkpointsAdvancedCount += 1;
                }
            }

            outcomes.push({
                RecipientUserID: recipientId,
                Cadence: cadence,
                SpaceID: assembled.SpaceID,
                ShouldDeliver: true,
                SuppressionReason: null,
                ChannelSuppressionReasons: assembled.ChannelSuppressionReasons,
                PermittedChannels: assembled.PermittedChannels,
                SuppressedChannels: assembled.SuppressedChannels,
                QuietHoursActive: assembled.QuietHoursActive,
                Dispatched: true,
                DeliveredChannels: dispatchResult.DeliveredChannels,
                InAppNotificationID: dispatchResult.InAppNotificationID ?? null,
                ItemsIncludedCount: assembled.Items.length,
                ExcludedItemCount: assembled.ExcludedItems.length,
                Items: assembled.Items,
                ExcludedItems: assembled.ExcludedItems,
                CheckpointAdvanced: checkpointAdvanced,
                Checkpoint: updatedCheckpoint,
                Payload: assembled.Payload,
            });
        } catch (error) {
            failedCount += 1;
            outcomes.push({
                RecipientUserID: recipientId,
                Cadence: cadence,
                SpaceID: assembled.SpaceID,
                ShouldDeliver: true,
                SuppressionReason: null,
                ChannelSuppressionReasons: assembled.ChannelSuppressionReasons,
                PermittedChannels: assembled.PermittedChannels,
                SuppressedChannels: assembled.SuppressedChannels,
                QuietHoursActive: assembled.QuietHoursActive,
                Dispatched: false,
                DeliveredChannels: [],
                InAppNotificationID: null,
                ItemsIncludedCount: assembled.Items.length,
                ExcludedItemCount: assembled.ExcludedItems.length,
                Items: assembled.Items,
                ExcludedItems: assembled.ExcludedItems,
                CheckpointAdvanced: false,
                Checkpoint: existingCpRow ? toCheckpointDTO(existingCpRow) : null,
                Payload: assembled.Payload,
                ErrorMessage: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return {
        Success: failedCount === 0,
        Cadence: cadence,
        WindowEndIso: windowEndIso,
        PagesTraversed: keysetResult.PagesTraversed,
        TotalEventsScanned: candidateEvents.length,
        TotalCandidateRecipients: candidateRecipientIds.length,
        DeliveredCount: deliveredCount,
        SuppressedCount: suppressedCount,
        EmptySuppressedCount: emptySuppressedCount,
        FailedCount: failedCount,
        CheckpointsAdvancedCount: checkpointsAdvancedCount,
        BatchedQueryCount: batchedQueryCount,
        Outcomes: outcomes,
    };
}

/**
 * Dry-run preview of a single member's reach-verified scoped digest without dispatching
 * Comms v2 messages or advancing `SpaceDigestCheckpoint`.
 */
export async function runPreviewScopedSpaceDigest(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: PreviewScopedSpaceDigestInput = {},
    userInfoEngine: UserInfoEnginePreferenceBridge = UserInfoEngine.Instance,
): Promise<PreviewScopedSpaceDigestResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }
    const targetUserId = input.TargetUserID ? normalizeNoticeUuid(input.TargetUserID) : auth.userId;
    if (!targetUserId) {
        throw new RemoteOperationError('VALIDATION_ERROR', 'TargetUserID must be a valid UUID.');
    }
    if (targetUserId !== auth.userId && !canCallerRunMultiRecipientDigests(actingUser, provider)) {
        throw new RemoteOperationError('FORBIDDEN', 'Cannot preview another member digest without Administer Spaces authorization.');
    }

    const res = await runRunScopedSpaceDigests(
        provider,
        actingUser,
        {
            Cadence: input.Cadence ?? 'Daily',
            SpaceID: input.SpaceID,
            SpaceIDs: input.SpaceIDs,
            TargetUserID: targetUserId,
            IncludeChildSpaces: input.IncludeChildSpaces,
            IncludeActor: input.IncludeActor,
            DryRun: true,
            ForceWindow: input.ForceWindow ?? true,
            IgnoreCadenceFilter: input.IgnoreCadenceFilter ?? true,
            PageSize: input.PageSize,
            Now: input.Now,
            SinceTimestamp: input.SinceTimestamp,
            Dialect: input.Dialect,
        },
        userInfoEngine,
    );

    return {
        Success: res.Success,
        RecipientUserID: targetUserId,
        Cadence: res.Cadence,
        WindowEndIso: res.WindowEndIso,
        PagesTraversed: res.PagesTraversed,
        TotalEventsScanned: res.TotalEventsScanned,
        BatchedQueryCount: res.BatchedQueryCount,
        Outcome: res.Outcomes[0] ?? null,
        ...(res.ErrorMessage ? { ErrorMessage: res.ErrorMessage } : {}),
    };
}

/**
 * Updates or pauses/resumes the authenticated caller's `SpaceDigestCheckpoint` monotonically.
 */
export async function runUpdateSpaceDigestCheckpoint(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: UpdateSpaceDigestCheckpointInput = {},
): Promise<UpdateSpaceDigestCheckpointResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }

    const cadence: SpaceDigestCadence = input.Cadence ?? 'Daily';
    if (!isSpaceDigestCadence(cadence)) {
        return {
            Success: false,
            Checkpoint: null,
            ErrorMessage: `Invalid digest Cadence '${String(input.Cadence)}'.`,
        };
    }

    let spaceId: string | null = null;
    if (input.SpaceID) {
        const clean = normalizeNoticeUuid(input.SpaceID);
        if (!clean) {
            return {
                Success: false,
                Checkpoint: null,
                ErrorMessage: 'SpaceID must be a valid UUID when provided.',
            };
        }
        spaceId = clean;
    }

    const status: SpaceDigestCheckpointStatus = input.Status === 'Paused' ? 'Paused' : 'Active';
    const dialect = detectAuditSqlDialect(provider);
    const privilegedUser = await resolvePrivilegedContextUser(provider, actingUser);
    const rv = RunView.FromMetadataProvider(provider);
    const existing = await loadCheckpointRow(rv, auth.userId, spaceId, cadence, privilegedUser, dialect);

    const candidateTs = input.LastDeliveredTimestamp
        ? new Date(parseNoticeTimestamp(input.LastDeliveredTimestamp).epochMs)
        : existing
          ? new Date(parseNoticeTimestamp(existing.LastDeliveredTimestamp).epochMs)
          : new Date(0);
    const candidateRecordId = input.LastDeliveredRecordID !== undefined
        ? normalizeNoticeUuid(input.LastDeliveredRecordID)
        : existing
          ? normalizeNoticeUuid(existing.LastDeliveredRecordID)
          : ZERO_NOTICE_UUID;

    const savedDto = await ServerOperationScopeManager.Instance.RunWithAuthority(
        {
            operationKey: UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
            source: 'ServerEngine',
            allowedEntities: [SPACE_DIGEST_CHECKPOINT_ENTITY],
            userId: actingUser.ID,
        },
        async () => {
            const entity = await provider.GetEntityObject<mjBizAppsCollaborationSpaceDigestCheckpointEntity>(
                SPACE_DIGEST_CHECKPOINT_ENTITY,
                privilegedUser,
            );
            if (existing) {
                const loaded = await entity.Load(existing.ID);
                if (!loaded) {
                    throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load checkpoint ${existing.ID}.`);
                }
            } else {
                entity.NewRecord();
                entity.UserID = auth.userId;
                entity.SpaceID = spaceId;
                entity.Cadence = cadence;
                entity.ItemsIncludedCount = 0;
                entity.LastDeliveredAt = new Date();
            }

            if (input.Status !== undefined) {
                entity.Status = status;
            }
            if (!existing || input.LastDeliveredTimestamp !== undefined) {
                entity.LastDeliveredTimestamp = candidateTs;
                entity.LastDeliveredRecordID = candidateRecordId;
            }

            const ok = await entity.Save();
            if (!ok) {
                const detail = entity.LatestResult?.CompleteMessage || entity.LatestResult?.Message || 'Save failed';
                throw new RemoteOperationError('EXECUTION_ERROR', `Failed to update digest checkpoint: ${detail}`);
            }

            return {
                ID: normalizeNoticeUuid(entity.ID) ?? entity.ID,
                UserID: auth.userId,
                SpaceID: spaceId,
                Cadence: cadence,
                LastDeliveredTimestamp: new Date(parseNoticeTimestamp(entity.LastDeliveredTimestamp).epochMs).toISOString(),
                LastDeliveredRecordID: normalizeNoticeUuid(entity.LastDeliveredRecordID),
                LastDeliveredAt: new Date(parseNoticeTimestamp(entity.LastDeliveredAt).epochMs).toISOString(),
                ItemsIncludedCount: entity.ItemsIncludedCount,
                Status: entity.Status === 'Paused' ? 'Paused' : 'Active',
            } satisfies SpaceDigestCheckpointDTO;
        },
    );

    return {
        Success: true,
        Checkpoint: savedDto,
    };
}

/**
 * Invokes a registered NT-2 digest {@link BaseRemotableOperation} seamlessly across both
 * server in-process callers (`ExecuteServer`) and GraphQL remote-operation providers (`RouteOperation`).
 */
export async function invokeCollaborationDigestOperation<TInput, TOutput>(
    operationKey: string,
    input: TInput,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<TOutput> {
    LoadCollaborationDigestOperations();
    const op = MJGlobal.Instance.ClassFactory.CreateInstance<BaseRemotableOperation<TInput, TOutput>>(
        BaseRemotableOperation,
        operationKey,
    );
    if (!op) {
        throw new RemoteOperationError('EXECUTION_ERROR', `Operation '${operationKey}' is not registered.`);
    }

    const result = isRemoteOperationCapableProvider(provider)
        ? await op.Execute(input, { provider, user })
        : await op.ExecuteServer(input, { provider, user, emitProgress: () => {} });

    if (!result.Success || result.Output === undefined) {
        throw new RemoteOperationError(
            result.ResultCode ?? 'EXECUTION_ERROR',
            result.ErrorMessage ?? `Operation '${operationKey}' failed.`,
        );
    }
    return result.Output;
}

@RegisterClass(BaseRemotableOperation, RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY)
export class RunScopedSpaceDigestsOperation extends BaseRemotableOperation<
    RunScopedSpaceDigestsInput,
    RunScopedSpaceDigestsResult
> {
    public override readonly OperationKey = RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return true;
    }

    public override readonly AuthorizedWriteEntities = [SPACE_DIGEST_CHECKPOINT_ENTITY] as const;

    protected override async Authorize(
        _input: RunScopedSpaceDigestsInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: RunScopedSpaceDigestsInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<RunScopedSpaceDigestsResult> {
        return runRunScopedSpaceDigests(provider, user, input ?? {});
    }
}

@RegisterClass(BaseRemotableOperation, PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY)
export class PreviewScopedSpaceDigestOperation extends BaseRemotableOperation<
    PreviewScopedSpaceDigestInput,
    PreviewScopedSpaceDigestResult
> {
    public override readonly OperationKey = PREVIEW_SCOPED_SPACE_DIGEST_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: PreviewScopedSpaceDigestInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: PreviewScopedSpaceDigestInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<PreviewScopedSpaceDigestResult> {
        return runPreviewScopedSpaceDigest(provider, user, input ?? {});
    }
}

@RegisterClass(BaseRemotableOperation, UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY)
export class UpdateSpaceDigestCheckpointOperation extends BaseRemotableOperation<
    UpdateSpaceDigestCheckpointInput,
    UpdateSpaceDigestCheckpointResult
> {
    public override readonly OperationKey = UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return true;
    }

    public override readonly AuthorizedWriteEntities = [SPACE_DIGEST_CHECKPOINT_ENTITY] as const;

    protected override async Authorize(
        _input: UpdateSpaceDigestCheckpointInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: UpdateSpaceDigestCheckpointInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<UpdateSpaceDigestCheckpointResult> {
        return runUpdateSpaceDigestCheckpoint(provider, user, input ?? {});
    }
}

/**
 * Retains all NT-2 Scoped Digest `@RegisterClass(BaseRemotableOperation, ...)` subclasses
 * against bundler tree-shaking on server and client startup.
 */
export function LoadCollaborationDigestOperations(): void {
    void RunScopedSpaceDigestsOperation;
    void PreviewScopedSpaceDigestOperation;
    void UpdateSpaceDigestCheckpointOperation;
}
