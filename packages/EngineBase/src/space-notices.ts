import {
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
import { MJGlobal, RegisterClass } from '@memberjunction/global';
import {
    compareNoticeCursors,
    isNoticeEventUnread,
    isNoticeEventVisibleToMember,
    isSpaceNoticeBand,
    isSpaceNoticeEventKind,
    normalizeNoticeUuid,
    type ParsedNoticeTimestamp,
    parseNoticeTimestamp,
    resolveEffectiveWatermarkCursor,
    resolveSpaceNoticeFeedForMember,
    shouldAdvanceWatermark,
    type SpaceNoticeBand,
    type SpaceNoticeCursor,
    type SpaceNoticeEventKind,
    type SpaceNoticeEventRecord,
    type SpaceNoticeFeedItem,
    type SpaceNoticeReachInfo,
    type SpaceNoticeWatermarkRecord,
    ZERO_NOTICE_UUID,
} from '@mj-biz-apps/collaboration-core';

export const DEFAULT_NOTICE_PAGE_SIZE = 50;
export const MAX_NOTICE_PAGE_SIZE = 500;
import type {
    mjBizAppsCollaborationSpaceNoticeEventEntity,
    mjBizAppsCollaborationSpaceNoticeEventEntityType,
    mjBizAppsCollaborationSpaceNoticeWatermarkEntity,
    mjBizAppsCollaborationSpaceNoticeWatermarkEntityType,
} from '@mj-biz-apps/collaboration-entities';
import {
    buildBatchedInFilter,
    buildBooleanEqualsFilter,
    buildStringEqualsFilter,
    buildUuidEqualsFilter,
    chunkDistinctIds,
    detectAuditSqlDialect,
    readEverySimpleRow,
    type SqlDialect,
} from './security-audit-types.js';

export const SPACE_NOTICE_EVENT_ENTITY = 'MJ_BizApps_Collaboration: Space Notice Events';
export const SPACE_NOTICE_WATERMARK_ENTITY = 'MJ_BizApps_Collaboration: Space Notice Watermarks';
export const SPACE_DIGEST_CHECKPOINT_ENTITY = 'MJ_BizApps_Collaboration: Space Digest Checkpoints';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const SPACE_ROLE_TYPES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';
const SPACE_TYPE_STATUS_ENTITY = 'MJ_BizApps_Collaboration: Space Type Status';

export const PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY = 'Collaboration.PublishSpaceNoticeEvent';
export const GET_SPACE_NOTICES_OPERATION_KEY = 'Collaboration.GetSpaceNotices';
export const GET_SPACE_UNREAD_NOTICE_COUNTS_OPERATION_KEY = 'Collaboration.GetSpaceUnreadNoticeCounts';
export const ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY = 'Collaboration.AdvanceSpaceNoticeWatermark';

export type SpaceNoticeEventScalarKind = mjBizAppsCollaborationSpaceNoticeEventEntityType['EventKind'];
export type SpaceNoticeEventScalarBand = mjBizAppsCollaborationSpaceNoticeEventEntityType['Band'];

export interface SpaceNoticeEventDTO {
    ID: string;
    SpaceID: string;
    ActorUserID: string | null;
    EventKind: SpaceNoticeEventKind;
    Band: SpaceNoticeBand;
    Title: string;
    Body: string | null;
    TargetEntityID: string | null;
    TargetRecordID: string | null;
    MetadataJSON: string | null;
    EventTimestamp: string;
    IsUnread: boolean;
}

export interface PublishSpaceNoticeEventInput {
    SpaceID: string;
    EventKind: SpaceNoticeEventKind;
    Band: SpaceNoticeBand;
    Title: string;
    Body?: string | null;
    TargetEntityID?: string | null;
    TargetRecordID?: string | null;
    MetadataJSON?: string | null;
    EventTimestamp?: string;
}

export interface PublishSpaceNoticeEventResult {
    Success: boolean;
    Event: SpaceNoticeEventDTO | null;
    /** Exact count of `Space Notice Events` rows written by this operation (O(1) = 1). */
    NoticeEventRowsWritten: number;
    /** Always 0 under CS-4 fan-out-on-read (no per-member inbox rows). */
    PerMemberInboxRowsWritten: number;
    ErrorMessage?: string;
}

export interface GetSpaceNoticesInput {
    SpaceID?: string;
    SpaceIDs?: readonly string[];
    UnreadOnly?: boolean;
    EventKinds?: readonly SpaceNoticeEventKind[];
    Limit?: number;
    Dialect?: SqlDialect;
}

export interface GetSpaceNoticesResult {
    Success: boolean;
    Notices: SpaceNoticeEventDTO[];
    UnreadCountBySpace: Record<string, number>;
    TotalUnreadCount: number;
    BatchedQueryCount: number;
    ErrorMessage?: string;
}

export interface GetSpaceUnreadNoticeCountsInput {
    SpaceIDs?: readonly string[];
    Dialect?: SqlDialect;
}

export interface SpaceUnreadNoticeCountSummary {
    SpaceID: string;
    UnreadCount: number;
    LatestEventTimestamp: string | null;
    LatestEventID: string | null;
    LastReadEventTimestamp: string | null;
    LastReadEventID: string | null;
    CanSeeTeamBand: boolean;
}

export interface GetSpaceUnreadNoticeCountsResult {
    Success: boolean;
    TotalUnreadCount: number;
    Spaces: SpaceUnreadNoticeCountSummary[];
    UnreadCountBySpace: Record<string, number>;
    BatchedQueryCount: number;
    ErrorMessage?: string;
}

export interface AdvanceSpaceNoticeWatermarkInput {
    SpaceID: string;
    EventID?: string | null;
    LastReadEventTimestamp?: string | null;
    LastReadEventID?: string | null;
    Dialect?: SqlDialect;
}

export interface SpaceNoticeWatermarkDTO {
    ID: string;
    SpaceID: string;
    UserID: string;
    LastReadEventTimestamp: string;
    LastReadEventID: string | null;
    LastReadAt: string;
}

export interface AdvanceSpaceNoticeWatermarkResult {
    Success: boolean;
    Advanced: boolean;
    Watermark: SpaceNoticeWatermarkDTO | null;
    ErrorMessage?: string;
}

interface SimpleSpaceRow {
    ID: string;
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

interface SimpleSpaceNoticeWatermarkRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    LastReadEventTimestamp: string | Date;
    LastReadEventID: string | null;
    LastReadAt: string | Date;
}

interface ResolvedSpaceAccess {
    spaceId: string;
    canSeeTeam: boolean;
    canContribute: boolean;
    isOwner: boolean;
    isReadOnlyStatus: boolean;
    memberJoinedAt: string | Date | null;
}

interface ResolvedReachResult {
    accessBySpace: Map<string, ResolvedSpaceAccess>;
    batchedQueryCount: number;
}

function isRemoteOperationCapableProvider(
    provider: IMetadataProvider | undefined,
): provider is IMetadataProvider & IRemoteOperationProvider {
    return Boolean(provider && 'RouteOperation' in provider && typeof provider.RouteOperation === 'function');
}

function validateAuthenticatedMemberCaller(user: UserInfo | undefined): { ok: true; userId: string } | { ok: false; reason: string } {
    if (!user) {
        return { ok: false, reason: 'Authentication required: no acting user context.' };
    }
    if (user.IsMagicLinkAnonymous === true) {
        return { ok: false, reason: 'Anonymous magic-link sessions cannot access or modify space notices.' };
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

function tryParseNoticeTimestamp(value: string | Date | null | undefined): ParsedNoticeTimestamp | null {
    if (value === null || value === undefined) {
        return null;
    }
    try {
        return parseNoticeTimestamp(value);
    } catch {
        return null;
    }
}

function normalizeIsoTimestamp(value: string | Date): string {
    const parsed = tryParseNoticeTimestamp(value);
    if (!parsed) {
        return new Date(0).toISOString();
    }
    return new Date(parsed.epochMs).toISOString();
}

function fromResolvedNoticeItem(item: SpaceNoticeFeedItem): SpaceNoticeEventDTO {
    return {
        ID: item.ID,
        SpaceID: item.SpaceID,
        ActorUserID: item.ActorUserID,
        EventKind: item.EventKind,
        Band: item.Band,
        Title: item.Title,
        Body: item.Body,
        TargetEntityID: item.TargetEntityID,
        TargetRecordID: item.TargetRecordID,
        MetadataJSON: item.MetadataJSON,
        EventTimestamp: item.EventTimestampIso,
        IsUnread: item.IsUnread,
    };
}

function toWatermarkDTO(row: SimpleSpaceNoticeWatermarkRow): SpaceNoticeWatermarkDTO | null {
    const id = normalizeNoticeUuid(row.ID);
    const spaceId = normalizeNoticeUuid(row.SpaceID);
    const userId = normalizeNoticeUuid(row.UserID);
    if (!id || !spaceId || !userId) {
        return null;
    }
    return {
        ID: id,
        SpaceID: spaceId,
        UserID: userId,
        LastReadEventTimestamp: normalizeIsoTimestamp(row.LastReadEventTimestamp),
        LastReadEventID: normalizeNoticeUuid(row.LastReadEventID),
        LastReadAt: normalizeIsoTimestamp(row.LastReadAt),
    };
}

function earlierTimestamp(
    current: string | Date | null,
    candidate: string | Date | null | undefined,
): string | Date | null {
    if (!candidate) {
        return current;
    }
    const candidateParsed = tryParseNoticeTimestamp(candidate);
    if (!candidateParsed) {
        return current;
    }
    if (!current) {
        return candidate;
    }
    const currentParsed = tryParseNoticeTimestamp(current);
    if (!currentParsed || candidateParsed.epochMs < currentParsed.epochMs) {
        return candidate;
    }
    return current;
}

export async function resolveMemberSpaceReach(
    provider: IMetadataProvider,
    readUser: UserInfo,
    actingUserId: string,
    dialect: SqlDialect,
    requestedSpaceIds?: readonly string[],
): Promise<ResolvedReachResult> {
    const rv = RunView.FromMetadataProvider(provider);
    let batchedQueryCount = 0;

    // Step 1: Load acting user's direct active SpaceMember seats and any owned Spaces in bounded queries.
    const memberRes = await readEverySimpleRow<SimpleSpaceMemberRow>(
        rv,
        {
            EntityName: SPACE_MEMBERS_ENTITY,
            ExtraFilter: `${buildUuidEqualsFilter('UserID', actingUserId, dialect)} AND ${buildStringEqualsFilter('Status', 'Active', dialect)}`,
            Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Band', 'Status', '__mj_CreatedAt'],
        },
        readUser,
    );
    batchedQueryCount += memberRes.queryCount;
    if (!memberRes.ok) {
        throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load active space memberships: ${memberRes.error}`);
    }

    const ownedSpacesRes = await readEverySimpleRow<SimpleSpaceRow>(
        rv,
        {
            EntityName: SPACES_ENTITY,
            ExtraFilter: buildUuidEqualsFilter('OwnerID', actingUserId, dialect),
            Fields: ['ID', 'ParentID', 'SpaceTypeID', 'OwnerID', 'InheritsMembership', 'StatusID', '__mj_CreatedAt'],
        },
        readUser,
    );
    batchedQueryCount += ownedSpacesRes.queryCount;
    if (!ownedSpacesRes.ok) {
        throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load owned spaces: ${ownedSpacesRes.error}`);
    }

    const directMembersBySpace = new Map<string, SimpleSpaceMemberRow[]>();
    const roleIds: string[] = [];
    const seedSpaceIds: string[] = [];

    for (const row of memberRes.rows) {
        const sid = normalizeNoticeUuid(row.SpaceID);
        if (!sid) continue;
        const list = directMembersBySpace.get(sid) ?? [];
        list.push(row);
        directMembersBySpace.set(sid, list);
        seedSpaceIds.push(sid);
        const rid = normalizeNoticeUuid(row.SpaceRoleTypeID);
        if (rid) roleIds.push(rid);
    }

    const spaceById = new Map<string, SimpleSpaceRow>();
    for (const owned of ownedSpacesRes.rows) {
        const sid = normalizeNoticeUuid(owned.ID);
        if (!sid) continue;
        spaceById.set(sid, owned);
        seedSpaceIds.push(sid);
    }

    if (requestedSpaceIds) {
        for (const rsid of requestedSpaceIds) {
            const clean = normalizeNoticeUuid(rsid);
            if (clean) seedSpaceIds.push(clean);
        }
    }

    // Step 2: Load seed Spaces and Role Types via batched ID IN (...) queries.
    const roleById = new Map<string, SimpleSpaceRoleTypeRow>();
    for (const roleBatch of chunkDistinctIds(roleIds)) {
        const res = await readEverySimpleRow<SimpleSpaceRoleTypeRow>(
            rv,
            {
                EntityName: SPACE_ROLE_TYPES_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', roleBatch, dialect),
                Fields: ['ID', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute', 'IsActive'],
            },
            readUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space role types: ${res.error}`);
        }
        for (const role of res.rows) {
            const rid = normalizeNoticeUuid(role.ID);
            if (rid) roleById.set(rid, role);
        }
    }

    const missingSeedSpaces = seedSpaceIds.filter((sid) => !spaceById.has(sid));
    for (const batch of chunkDistinctIds(missingSeedSpaces)) {
        const res = await readEverySimpleRow<SimpleSpaceRow>(
            rv,
            {
                EntityName: SPACES_ENTITY,
                ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                Fields: ['ID', 'ParentID', 'SpaceTypeID', 'OwnerID', 'InheritsMembership', 'StatusID', '__mj_CreatedAt'],
            },
            readUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load spaces: ${res.error}`);
        }
        for (const s of res.rows) {
            const sid = normalizeNoticeUuid(s.ID);
            if (sid) spaceById.set(sid, s);
        }
    }

    // Step 3: Walk upward ancestors for requested spaces (so child InheritsMembership sees ancestor seats)
    // and downward descendants from direct/owned seed spaces when space list is open-ended.
    if (requestedSpaceIds && requestedSpaceIds.length > 0) {
        let frontier: string[] = [];
        for (const rsid of requestedSpaceIds) {
            const clean = normalizeNoticeUuid(rsid);
            if (clean) frontier.push(clean);
        }
        const visitedUp = new Set<string>();
        while (frontier.length > 0) {
            const parentsToFetch: string[] = [];
            for (const sid of frontier) {
                if (visitedUp.has(sid)) continue;
                visitedUp.add(sid);
                const space = spaceById.get(sid);
                if (space?.InheritsMembership && space.ParentID) {
                    const pid = normalizeNoticeUuid(space.ParentID);
                    if (pid && !spaceById.has(pid)) {
                        parentsToFetch.push(pid);
                    } else if (pid && !visitedUp.has(pid)) {
                        frontier.push(pid);
                    }
                }
            }
            frontier = [];
            if (parentsToFetch.length > 0) {
                for (const batch of chunkDistinctIds(parentsToFetch)) {
                    const res = await readEverySimpleRow<SimpleSpaceRow>(
                        rv,
                        {
                            EntityName: SPACES_ENTITY,
                            ExtraFilter: buildBatchedInFilter('ID', batch, dialect),
                            Fields: ['ID', 'ParentID', 'SpaceTypeID', 'OwnerID', 'InheritsMembership', 'StatusID', '__mj_CreatedAt'],
                        },
                        readUser,
                    );
                    batchedQueryCount += res.queryCount;
                    if (!res.ok) {
                        throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load ancestor spaces: ${res.error}`);
                    }
                    for (const parentSpace of res.rows) {
                        const pid = normalizeNoticeUuid(parentSpace.ID);
                        if (pid) {
                            spaceById.set(pid, parentSpace);
                            frontier.push(pid);
                        }
                    }
                }
            }
        }
    } else {
        // BFS downwards from direct & owned seed spaces to discover inheriting descendants.
        let parentFrontier = [...new Set([...directMembersBySpace.keys(), ...spaceById.keys()])];
        const visitedParentIds = new Set<string>();
        while (parentFrontier.length > 0) {
            const unvisitedParents = parentFrontier.filter((pid) => !visitedParentIds.has(pid));
            for (const pid of unvisitedParents) visitedParentIds.add(pid);
            parentFrontier = [];
            for (const batch of chunkDistinctIds(unvisitedParents)) {
                const res = await readEverySimpleRow<SimpleSpaceRow>(
                    rv,
                    {
                        EntityName: SPACES_ENTITY,
                        ExtraFilter: `${buildBatchedInFilter('ParentID', batch, dialect)} AND ${buildBooleanEqualsFilter('InheritsMembership', true, dialect)}`,
                        Fields: ['ID', 'ParentID', 'SpaceTypeID', 'OwnerID', 'InheritsMembership', 'StatusID', '__mj_CreatedAt'],
                    },
                    readUser,
                );
                batchedQueryCount += res.queryCount;
                if (!res.ok) {
                    throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load inherited child spaces: ${res.error}`);
                }
                for (const child of res.rows) {
                    const cid = normalizeNoticeUuid(child.ID);
                    if (cid) {
                        spaceById.set(cid, child);
                        if (!visitedParentIds.has(cid)) {
                            parentFrontier.push(cid);
                        }
                    }
                }
            }
        }
    }

    // Step 4: Batch-load SpaceTypeStatus visibility flags for all loaded spaces that reference a StatusID.
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

    // Step 5: Compute effective reach per candidate space (direct seat, space owner, or InheritsMembership ancestor chain).
    const requestedSet = requestedSpaceIds
        ? new Set(requestedSpaceIds.map((id) => normalizeNoticeUuid(id)).filter((id): id is string => id !== null))
        : null;
    const candidateIds = requestedSet ? [...requestedSet] : [...spaceById.keys()];
    const accessBySpace = new Map<string, ResolvedSpaceAccess>();

    for (const candidateId of candidateIds) {
        const space = spaceById.get(candidateId);
        if (!space) continue;

        let isOwner = normalizeNoticeUuid(space.OwnerID) === actingUserId;
        let canSeeTeam = isOwner;
        let canContribute = isOwner;
        let hasMembershipReach = isOwner;
        let memberJoinedAt: string | Date | null = isOwner ? (space.__mj_CreatedAt ?? null) : null;

        let cursor: SimpleSpaceRow | undefined = space;
        const cycleGuard = new Set<string>();
        while (cursor) {
            const cursorId = normalizeNoticeUuid(cursor.ID);
            if (!cursorId || cycleGuard.has(cursorId)) break;
            cycleGuard.add(cursorId);

            if (normalizeNoticeUuid(cursor.OwnerID) === actingUserId) {
                isOwner = true;
                canSeeTeam = true;
                canContribute = true;
                hasMembershipReach = true;
                memberJoinedAt = earlierTimestamp(memberJoinedAt, cursor.__mj_CreatedAt);
            }

            const seats = directMembersBySpace.get(cursorId) ?? [];
            for (const seat of seats) {
                const roleId = normalizeNoticeUuid(seat.SpaceRoleTypeID);
                const role = roleId ? roleById.get(roleId) : undefined;
                if (role && role.IsActive === false) {
                    continue;
                }
                hasMembershipReach = true;
                memberJoinedAt = earlierTimestamp(memberJoinedAt, seat.__mj_CreatedAt);

                const roleTeam = role ? role.CanSeeTeamBand === true : seat.Band === 'Team';
                const roleOwner = role ? role.IsOwnerRole === true : false;
                const roleContribute = role ? role.CanContribute === true : true;
                if (roleTeam || roleOwner) {
                    canSeeTeam = true;
                }
                if (roleOwner) {
                    isOwner = true;
                }
                if (roleContribute || roleOwner) {
                    canContribute = true;
                }
            }

            if (!cursor.InheritsMembership || !cursor.ParentID) {
                break;
            }
            const parentId = normalizeNoticeUuid(cursor.ParentID);
            cursor = parentId ? spaceById.get(parentId) : undefined;
        }

        if (!hasMembershipReach) {
            continue;
        }

        const statusId = normalizeNoticeUuid(space.StatusID);
        const statusRow = statusId ? statusById.get(statusId) : undefined;
        const isVisibleStatus = statusRow ? statusRow.Visible !== false : true;
        const isReadOnlyStatus = statusRow ? statusRow.ReadOnly === true : false;

        // Hidden status spaces are reachable only by their owner.
        if (!isVisibleStatus && !isOwner) {
            continue;
        }

        accessBySpace.set(candidateId, {
            spaceId: candidateId,
            canSeeTeam,
            canContribute,
            isOwner,
            isReadOnlyStatus,
            memberJoinedAt,
        });
    }

    return { accessBySpace, batchedQueryCount };
}

/**
 * Publishes a single space notice event row (`Space Notice Events` — O(1) single-row write amplification)
 * for any space with N members, writing zero per-member inbox rows.
 */
export async function runPublishSpaceNoticeEvent(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: PublishSpaceNoticeEventInput,
): Promise<PublishSpaceNoticeEventResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }

    const spaceId = normalizeNoticeUuid(input.SpaceID);
    if (!spaceId) {
        return {
            Success: false,
            Event: null,
            NoticeEventRowsWritten: 0,
            PerMemberInboxRowsWritten: 0,
            ErrorMessage: 'SpaceID must be a valid UUID.',
        };
    }

    if (!isSpaceNoticeEventKind(input.EventKind)) {
        return {
            Success: false,
            Event: null,
            NoticeEventRowsWritten: 0,
            PerMemberInboxRowsWritten: 0,
            ErrorMessage: `Unsupported notice EventKind '${String(input.EventKind)}'.`,
        };
    }

    if (!isSpaceNoticeBand(input.Band)) {
        return {
            Success: false,
            Event: null,
            NoticeEventRowsWritten: 0,
            PerMemberInboxRowsWritten: 0,
            ErrorMessage: `Unsupported notice Band '${String(input.Band)}'.`,
        };
    }

    const cleanTitle = (input.Title ?? '').trim();
    if (!cleanTitle || cleanTitle.length > 400) {
        return {
            Success: false,
            Event: null,
            NoticeEventRowsWritten: 0,
            PerMemberInboxRowsWritten: 0,
            ErrorMessage: 'Notice Title is required and must be at most 400 characters.',
        };
    }

    const targetEntityId = input.TargetEntityID ? normalizeNoticeUuid(input.TargetEntityID) : null;
    if (input.TargetEntityID && !targetEntityId) {
        return {
            Success: false,
            Event: null,
            NoticeEventRowsWritten: 0,
            PerMemberInboxRowsWritten: 0,
            ErrorMessage: 'TargetEntityID must be a valid UUID when provided.',
        };
    }

    if (input.MetadataJSON !== undefined && input.MetadataJSON !== null && input.MetadataJSON.trim() !== '') {
        try {
            JSON.parse(input.MetadataJSON);
        } catch {
            return {
                Success: false,
                Event: null,
                NoticeEventRowsWritten: 0,
                PerMemberInboxRowsWritten: 0,
                ErrorMessage: 'MetadataJSON must be valid JSON when provided.',
            };
        }
    }

    const eventTimestamp = input.EventTimestamp ? new Date(input.EventTimestamp) : new Date();
    if (Number.isNaN(eventTimestamp.getTime())) {
        return {
            Success: false,
            Event: null,
            NoticeEventRowsWritten: 0,
            PerMemberInboxRowsWritten: 0,
            ErrorMessage: 'EventTimestamp must be a valid ISO timestamp when provided.',
        };
    }

    const dialect = detectAuditSqlDialect(provider);
    const privilegedUser = await resolvePrivilegedContextUser(provider, actingUser);
    const reach = await resolveMemberSpaceReach(provider, privilegedUser, auth.userId, dialect, [spaceId]);
    const access = reach.accessBySpace.get(spaceId);
    if (!access) {
        throw new RemoteOperationError('FORBIDDEN', `User does not have active reach to publish notices to space ${spaceId}.`);
    }

    if (access.isReadOnlyStatus && !access.isOwner) {
        throw new RemoteOperationError('FORBIDDEN', `Space ${spaceId} is currently in a read-only status.`);
    }

    if (!access.isOwner && !access.canContribute) {
        throw new RemoteOperationError('FORBIDDEN', 'Caller role does not have contribution permission in this space.');
    }

    if (input.Band === 'Team' && !access.canSeeTeam) {
        throw new RemoteOperationError('FORBIDDEN', 'Shared-band callers cannot publish Team-band space notices.');
    }

    const savedEvent = await ServerOperationScopeManager.Instance.RunWithAuthority(
        {
            operationKey: PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY,
            source: 'ServerEngine',
            allowedEntities: [SPACE_NOTICE_EVENT_ENTITY],
            userId: actingUser.ID,
        },
        async () => {
            const entity = await provider.GetEntityObject<mjBizAppsCollaborationSpaceNoticeEventEntity>(
                SPACE_NOTICE_EVENT_ENTITY,
                privilegedUser,
            );
            entity.SpaceID = spaceId;
            entity.ActorUserID = auth.userId;
            entity.EventKind = input.EventKind;
            entity.Band = input.Band;
            entity.Title = cleanTitle;
            entity.Body = input.Body ?? null;
            entity.TargetEntityID = targetEntityId;
            entity.TargetRecordID = input.TargetRecordID ?? null;
            entity.MetadataJSON = input.MetadataJSON ?? null;
            entity.EventTimestamp = eventTimestamp;

            const saved = await entity.Save();
            if (!saved) {
                const detail = entity.LatestResult?.CompleteMessage || entity.LatestResult?.Message || 'Save failed';
                throw new RemoteOperationError('EXECUTION_ERROR', `Failed to persist space notice event: ${detail}`);
            }
            return entity;
        },
    );

    const dto: SpaceNoticeEventDTO = {
        ID: normalizeNoticeUuid(savedEvent.ID) ?? savedEvent.ID,
        SpaceID: spaceId,
        ActorUserID: auth.userId,
        EventKind: savedEvent.EventKind,
        Band: savedEvent.Band,
        Title: savedEvent.Title,
        Body: savedEvent.Body ?? null,
        TargetEntityID: normalizeNoticeUuid(savedEvent.TargetEntityID),
        TargetRecordID: savedEvent.TargetRecordID ?? null,
        MetadataJSON: savedEvent.MetadataJSON ?? null,
        EventTimestamp: normalizeIsoTimestamp(savedEvent.EventTimestamp ?? eventTimestamp),
        IsUnread: false,
    };

    return {
        Success: true,
        Event: dto,
        NoticeEventRowsWritten: 1,
        PerMemberInboxRowsWritten: 0,
    };
}

/**
 * Fan-out-on-read notice query resolving unread state & band reach per member via
 * per-member watermarks (`Space Notice Watermarks`) and batched `RunView` (`ResultType: 'simple'`).
 */
export async function runGetSpaceNotices(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: GetSpaceNoticesInput = {},
): Promise<GetSpaceNoticesResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }

    const dialect = input.Dialect ?? detectAuditSqlDialect(provider);
    const privilegedUser = await resolvePrivilegedContextUser(provider, actingUser);

    const requestedIdsRaw: string[] = [];
    if (input.SpaceID) {
        const clean = normalizeNoticeUuid(input.SpaceID);
        if (!clean) {
            return {
                Success: false,
                Notices: [],
                UnreadCountBySpace: {},
                TotalUnreadCount: 0,
                BatchedQueryCount: 0,
                ErrorMessage: 'SpaceID must be a valid UUID.',
            };
        }
        requestedIdsRaw.push(clean);
    }
    if (input.SpaceIDs) {
        for (const id of input.SpaceIDs) {
            const clean = normalizeNoticeUuid(id);
            if (!clean) {
                return {
                    Success: false,
                    Notices: [],
                    UnreadCountBySpace: {},
                    TotalUnreadCount: 0,
                    BatchedQueryCount: 0,
                    ErrorMessage: `Invalid SpaceID '${String(id)}'.`,
                };
            }
            requestedIdsRaw.push(clean);
        }
    }

    const requestedFilter = requestedIdsRaw.length > 0 ? [...new Set(requestedIdsRaw)] : undefined;
    const reach = await resolveMemberSpaceReach(provider, privilegedUser, auth.userId, dialect, requestedFilter);
    let batchedQueryCount = reach.batchedQueryCount;

    const authorizedSpaceIds = [...reach.accessBySpace.keys()];
    if (authorizedSpaceIds.length === 0) {
        return {
            Success: true,
            Notices: [],
            UnreadCountBySpace: {},
            TotalUnreadCount: 0,
            BatchedQueryCount: batchedQueryCount,
        };
    }

    const rv = RunView.FromMetadataProvider(provider);
    const eventRows: SimpleSpaceNoticeEventRow[] = [];
    for (const batch of chunkDistinctIds(authorizedSpaceIds)) {
        const res = await readEverySimpleRow<SimpleSpaceNoticeEventRow>(
            rv,
            {
                EntityName: SPACE_NOTICE_EVENT_ENTITY,
                ExtraFilter: buildBatchedInFilter('SpaceID', batch, dialect),
                Fields: [
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
                ],
            },
            privilegedUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space notice events: ${res.error}`);
        }
        eventRows.push(...res.rows);
    }

    const watermarkRows: SimpleSpaceNoticeWatermarkRow[] = [];
    for (const batch of chunkDistinctIds(authorizedSpaceIds)) {
        const res = await readEverySimpleRow<SimpleSpaceNoticeWatermarkRow>(
            rv,
            {
                EntityName: SPACE_NOTICE_WATERMARK_ENTITY,
                ExtraFilter: `${buildUuidEqualsFilter('UserID', auth.userId, dialect)} AND ${buildBatchedInFilter('SpaceID', batch, dialect)}`,
                Fields: ['ID', 'SpaceID', 'UserID', 'LastReadEventTimestamp', 'LastReadEventID', 'LastReadAt'],
            },
            privilegedUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space notice watermarks: ${res.error}`);
        }
        watermarkRows.push(...res.rows);
    }

    const watermarksBySpace = new Map<string, SpaceNoticeWatermarkRecord>();
    for (const wm of watermarkRows) {
        const sid = normalizeNoticeUuid(wm.SpaceID);
        const wid = normalizeNoticeUuid(wm.ID);
        const uid = normalizeNoticeUuid(wm.UserID);
        if (!sid || !wid || !uid) continue;
        watermarksBySpace.set(sid, {
            ID: wid,
            SpaceID: sid,
            UserID: uid,
            LastReadEventTimestamp: wm.LastReadEventTimestamp,
            LastReadEventID: normalizeNoticeUuid(wm.LastReadEventID),
        });
    }

    const reachBySpace = new Map<string, SpaceNoticeReachInfo>();
    for (const [sid, acc] of reach.accessBySpace.entries()) {
        reachBySpace.set(sid, {
            SpaceID: sid,
            CanSeeTeam: acc.canSeeTeam,
            MemberJoinedAt: acc.memberJoinedAt,
        });
    }

    const validKinds =
        input.EventKinds && input.EventKinds.length > 0
            ? new Set(input.EventKinds.filter((k) => isSpaceNoticeEventKind(k)))
            : null;

    const eventRecords: SpaceNoticeEventRecord[] = [];
    for (const row of eventRows) {
        const id = normalizeNoticeUuid(row.ID);
        const spaceId = normalizeNoticeUuid(row.SpaceID);
        if (!id || !spaceId || !isSpaceNoticeEventKind(row.EventKind) || !isSpaceNoticeBand(row.Band)) {
            continue;
        }
        eventRecords.push({
            ID: id,
            SpaceID: spaceId,
            ActorUserID: normalizeNoticeUuid(row.ActorUserID),
            EventKind: row.EventKind,
            Band: row.Band,
            Title: row.Title,
            Body: row.Body ?? null,
            TargetEntityID: normalizeNoticeUuid(row.TargetEntityID),
            TargetRecordID: row.TargetRecordID ?? null,
            MetadataJSON: row.MetadataJSON ?? null,
            EventTimestamp: row.EventTimestamp,
        });
    }

    const limit =
        typeof input.Limit === 'number' && Number.isInteger(input.Limit) && input.Limit > 0
            ? Math.min(input.Limit, MAX_NOTICE_PAGE_SIZE)
            : DEFAULT_NOTICE_PAGE_SIZE;

    const feed = resolveSpaceNoticeFeedForMember({
        Events: eventRecords,
        WatermarksBySpace: watermarksBySpace,
        ReachBySpace: reachBySpace,
        ...(validKinds ? { EventKinds: validKinds } : {}),
        UnreadOnly: input.UnreadOnly === true,
        Limit: limit,
    });

    return {
        Success: true,
        Notices: feed.Items.map(fromResolvedNoticeItem),
        UnreadCountBySpace: feed.UnreadCountBySpace,
        TotalUnreadCount: feed.UnreadCount,
        BatchedQueryCount: batchedQueryCount,
    };
}

/**
 * Computes per-space unread counts & latest cursor metadata for all requested (or reachable)
 * spaces using batched `RunView` (`ResultType: 'simple'`) and per-member watermarks.
 */
export async function runGetSpaceUnreadNoticeCounts(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: GetSpaceUnreadNoticeCountsInput = {},
): Promise<GetSpaceUnreadNoticeCountsResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }

    const dialect = input.Dialect ?? detectAuditSqlDialect(provider);
    const privilegedUser = await resolvePrivilegedContextUser(provider, actingUser);

    let requestedFilter: string[] | undefined;
    if (input.SpaceIDs && input.SpaceIDs.length > 0) {
        requestedFilter = [];
        for (const id of input.SpaceIDs) {
            const clean = normalizeNoticeUuid(id);
            if (!clean) {
                return {
                    Success: false,
                    TotalUnreadCount: 0,
                    Spaces: [],
                    UnreadCountBySpace: {},
                    BatchedQueryCount: 0,
                    ErrorMessage: `Invalid SpaceID '${String(id)}'.`,
                };
            }
            requestedFilter.push(clean);
        }
        requestedFilter = [...new Set(requestedFilter)];
    }

    const reach = await resolveMemberSpaceReach(provider, privilegedUser, auth.userId, dialect, requestedFilter);
    let batchedQueryCount = reach.batchedQueryCount;
    const authorizedSpaceIds = [...reach.accessBySpace.keys()];

    if (authorizedSpaceIds.length === 0) {
        return {
            Success: true,
            TotalUnreadCount: 0,
            Spaces: [],
            UnreadCountBySpace: {},
            BatchedQueryCount: batchedQueryCount,
        };
    }

    const rv = RunView.FromMetadataProvider(provider);
    const eventRows: SimpleSpaceNoticeEventRow[] = [];
    for (const batch of chunkDistinctIds(authorizedSpaceIds)) {
        const res = await readEverySimpleRow<SimpleSpaceNoticeEventRow>(
            rv,
            {
                EntityName: SPACE_NOTICE_EVENT_ENTITY,
                ExtraFilter: buildBatchedInFilter('SpaceID', batch, dialect),
                Fields: ['ID', 'SpaceID', 'Band', 'EventTimestamp', 'EventKind', 'Title'],
            },
            privilegedUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space notice events: ${res.error}`);
        }
        eventRows.push(...res.rows);
    }

    const watermarkRows: SimpleSpaceNoticeWatermarkRow[] = [];
    for (const batch of chunkDistinctIds(authorizedSpaceIds)) {
        const res = await readEverySimpleRow<SimpleSpaceNoticeWatermarkRow>(
            rv,
            {
                EntityName: SPACE_NOTICE_WATERMARK_ENTITY,
                ExtraFilter: `${buildUuidEqualsFilter('UserID', auth.userId, dialect)} AND ${buildBatchedInFilter('SpaceID', batch, dialect)}`,
                Fields: ['ID', 'SpaceID', 'UserID', 'LastReadEventTimestamp', 'LastReadEventID', 'LastReadAt'],
            },
            privilegedUser,
        );
        batchedQueryCount += res.queryCount;
        if (!res.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load space notice watermarks: ${res.error}`);
        }
        watermarkRows.push(...res.rows);
    }

    const watermarkBySpace = new Map<string, SimpleSpaceNoticeWatermarkRow>();
    for (const wm of watermarkRows) {
        const sid = normalizeNoticeUuid(wm.SpaceID);
        if (sid) watermarkBySpace.set(sid, wm);
    }

    const eventsBySpace = new Map<string, SimpleSpaceNoticeEventRow[]>();
    for (const ev of eventRows) {
        const sid = normalizeNoticeUuid(ev.SpaceID);
        if (!sid) continue;
        const list = eventsBySpace.get(sid) ?? [];
        list.push(ev);
        eventsBySpace.set(sid, list);
    }

    const summaries: SpaceUnreadNoticeCountSummary[] = [];
    const unreadCountBySpace: Record<string, number> = {};
    let totalUnreadCount = 0;

    for (const sid of authorizedSpaceIds) {
        const access = reach.accessBySpace.get(sid);
        if (!access) continue;

        const wmRow = watermarkBySpace.get(sid);
        const memberReach: SpaceNoticeReachInfo = {
            SpaceID: sid,
            CanSeeTeam: access.canSeeTeam,
            MemberJoinedAt: access.memberJoinedAt,
        };
        const effectiveResolution = resolveEffectiveWatermarkCursor({
            watermark: wmRow
                ? {
                      ID: wmRow.ID,
                      SpaceID: sid,
                      UserID: auth.userId,
                      LastReadEventTimestamp: wmRow.LastReadEventTimestamp,
                      LastReadEventID: normalizeNoticeUuid(wmRow.LastReadEventID),
                  }
                : null,
            memberJoinedAt: access.memberJoinedAt,
        });

        let unread = 0;
        let latestCursor: { epochMs: number; id: string; iso: string } | null = null;
        for (const ev of eventsBySpace.get(sid) ?? []) {
            const evId = normalizeNoticeUuid(ev.ID);
            if (!evId || !isSpaceNoticeBand(ev.Band)) continue;
            if (!isNoticeEventVisibleToMember({ SpaceID: sid, Band: ev.Band }, memberReach)) {
                continue;
            }
            const parsed = tryParseNoticeTimestamp(ev.EventTimestamp);
            if (!parsed) continue;

            if (isNoticeEventUnread({ EventTimestamp: ev.EventTimestamp, ID: evId }, effectiveResolution.Cursor)) {
                unread += 1;
            }

            const candidate: SpaceNoticeCursor = { EventTimestamp: ev.EventTimestamp, EventID: evId };
            if (
                !latestCursor ||
                compareNoticeCursors(candidate, { EventTimestamp: latestCursor.iso, EventID: latestCursor.id }) > 0
            ) {
                latestCursor = {
                    epochMs: parsed.epochMs,
                    id: evId,
                    iso: parsed.iso,
                };
            }
        }

        unreadCountBySpace[sid] = unread;
        totalUnreadCount += unread;
        summaries.push({
            SpaceID: sid,
            UnreadCount: unread,
            LatestEventTimestamp: latestCursor?.iso ?? null,
            LatestEventID: latestCursor?.id ?? null,
            LastReadEventTimestamp: wmRow ? normalizeIsoTimestamp(wmRow.LastReadEventTimestamp) : null,
            LastReadEventID: wmRow ? normalizeNoticeUuid(wmRow.LastReadEventID) : null,
            CanSeeTeamBand: access.canSeeTeam,
        });
    }

    return {
        Success: true,
        TotalUnreadCount: totalUnreadCount,
        Spaces: summaries,
        UnreadCountBySpace: unreadCountBySpace,
        BatchedQueryCount: batchedQueryCount,
    };
}

async function loadWatermarkRowForMemberSpace(
    rv: RunView,
    spaceId: string,
    userId: string,
    readUser: UserInfo,
    dialect: SqlDialect,
): Promise<SimpleSpaceNoticeWatermarkRow | null> {
    const res = await rv.RunView<SimpleSpaceNoticeWatermarkRow>(
        {
            EntityName: SPACE_NOTICE_WATERMARK_ENTITY,
            ExtraFilter: `${buildUuidEqualsFilter('SpaceID', spaceId, dialect)} AND ${buildUuidEqualsFilter('UserID', userId, dialect)}`,
            Fields: ['ID', 'SpaceID', 'UserID', 'LastReadEventTimestamp', 'LastReadEventID', 'LastReadAt'],
            ResultType: 'simple',
            MaxRows: 1,
        },
        readUser,
    );
    if (!res.Success) {
        throw new RemoteOperationError(
            'EXECUTION_ERROR',
            `Failed to read notice watermark for space ${spaceId}: ${res.ErrorMessage ?? 'unknown error'}`,
        );
    }
    return res.Results?.[0] ?? null;
}

/**
 * Monotonically and idempotently advances the authenticated member's per-space notice watermark
 * `(LastReadEventTimestamp, LastReadEventID)`, safely handling concurrent watermark inserts.
 */
export async function runAdvanceSpaceNoticeWatermark(
    provider: IMetadataProvider,
    actingUser: UserInfo,
    input: AdvanceSpaceNoticeWatermarkInput,
): Promise<AdvanceSpaceNoticeWatermarkResult> {
    const auth = validateAuthenticatedMemberCaller(actingUser);
    if (!auth.ok) {
        throw new RemoteOperationError('FORBIDDEN', auth.reason);
    }

    const spaceId = normalizeNoticeUuid(input.SpaceID);
    if (!spaceId) {
        return {
            Success: false,
            Advanced: false,
            Watermark: null,
            ErrorMessage: 'SpaceID must be a valid UUID.',
        };
    }

    const dialect = input.Dialect ?? detectAuditSqlDialect(provider);
    const privilegedUser = await resolvePrivilegedContextUser(provider, actingUser);
    const reach = await resolveMemberSpaceReach(provider, privilegedUser, auth.userId, dialect, [spaceId]);
    const access = reach.accessBySpace.get(spaceId);
    if (!access) {
        throw new RemoteOperationError('FORBIDDEN', `User does not have active reach in space ${spaceId}.`);
    }

    const rv = RunView.FromMetadataProvider(provider);
    let targetTimestamp: string | Date;
    let targetEventId: string | null = null;

    if (input.EventID) {
        const cleanEventId = normalizeNoticeUuid(input.EventID);
        if (!cleanEventId) {
            return {
                Success: false,
                Advanced: false,
                Watermark: null,
                ErrorMessage: 'EventID must be a valid UUID when provided.',
            };
        }
        const evRes = await rv.RunView<SimpleSpaceNoticeEventRow>(
            {
                EntityName: SPACE_NOTICE_EVENT_ENTITY,
                ExtraFilter: `${buildUuidEqualsFilter('ID', cleanEventId, dialect)} AND ${buildUuidEqualsFilter('SpaceID', spaceId, dialect)}`,
                Fields: ['ID', 'SpaceID', 'Band', 'EventTimestamp'],
                ResultType: 'simple',
                MaxRows: 1,
            },
            privilegedUser,
        );
        if (!evRes.Success) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to look up target notice event: ${evRes.ErrorMessage ?? 'unknown error'}`);
        }
        const evRow = evRes.Results?.[0];
        if (!evRow) {
            return {
                Success: false,
                Advanced: false,
                Watermark: null,
                ErrorMessage: `Notice event ${cleanEventId} was not found in space ${spaceId}.`,
            };
        }
        if (
            !isSpaceNoticeBand(evRow.Band) ||
            !isNoticeEventVisibleToMember(
                { SpaceID: spaceId, Band: evRow.Band },
                { SpaceID: spaceId, CanSeeTeam: access.canSeeTeam, MemberJoinedAt: access.memberJoinedAt },
            )
        ) {
            throw new RemoteOperationError('FORBIDDEN', 'Caller cannot advance watermark to an event outside their reachable band.');
        }
        targetTimestamp = evRow.EventTimestamp;
        targetEventId = cleanEventId;
    } else if (input.LastReadEventTimestamp) {
        const parsed = tryParseNoticeTimestamp(input.LastReadEventTimestamp);
        if (!parsed) {
            return {
                Success: false,
                Advanced: false,
                Watermark: null,
                ErrorMessage: 'LastReadEventTimestamp must be a valid ISO timestamp.',
            };
        }
        targetTimestamp = parsed.iso;
        if (input.LastReadEventID) {
            const cleanCursorId = normalizeNoticeUuid(input.LastReadEventID);
            if (!cleanCursorId) {
                return {
                    Success: false,
                    Advanced: false,
                    Watermark: null,
                    ErrorMessage: 'LastReadEventID must be a valid UUID when provided.',
                };
            }
            targetEventId = cleanCursorId;
        }
    } else {
        // Default: advance to the latest visible notice event in this space (or now if none exist).
        const allRes = await readEverySimpleRow<SimpleSpaceNoticeEventRow>(
            rv,
            {
                EntityName: SPACE_NOTICE_EVENT_ENTITY,
                ExtraFilter: buildUuidEqualsFilter('SpaceID', spaceId, dialect),
                Fields: ['ID', 'SpaceID', 'Band', 'EventTimestamp'],
            },
            privilegedUser,
        );
        if (!allRes.ok) {
            throw new RemoteOperationError('EXECUTION_ERROR', `Failed to inspect latest notice event: ${allRes.error}`);
        }
        let latest: { cursor: SpaceNoticeCursor; ts: string | Date; id: string } | null = null;
        for (const ev of allRes.rows) {
            const evId = normalizeNoticeUuid(ev.ID);
            if (!evId || !isSpaceNoticeBand(ev.Band)) continue;
            if (
                !isNoticeEventVisibleToMember(
                    { SpaceID: spaceId, Band: ev.Band },
                    { SpaceID: spaceId, CanSeeTeam: access.canSeeTeam, MemberJoinedAt: access.memberJoinedAt },
                )
            ) {
                continue;
            }
            const c: SpaceNoticeCursor = { EventTimestamp: ev.EventTimestamp, EventID: evId };
            if (!latest || compareNoticeCursors(c, latest.cursor) > 0) {
                latest = { cursor: c, ts: ev.EventTimestamp, id: evId };
            }
        }
        if (latest) {
            targetTimestamp = latest.ts;
            targetEventId = latest.id;
        } else {
            targetTimestamp = new Date().toISOString();
            targetEventId = ZERO_NOTICE_UUID;
        }
    }

    const candidateCursor: SpaceNoticeCursor = {
        EventTimestamp: targetTimestamp,
        EventID: targetEventId ?? ZERO_NOTICE_UUID,
    };

    const existing = await loadWatermarkRowForMemberSpace(rv, spaceId, auth.userId, privilegedUser, dialect);
    const existingCursor: SpaceNoticeCursor | null = existing
        ? {
              EventTimestamp: existing.LastReadEventTimestamp,
              EventID: normalizeNoticeUuid(existing.LastReadEventID) ?? ZERO_NOTICE_UUID,
          }
        : null;

    if (!shouldAdvanceWatermark(existingCursor, candidateCursor)) {
        return {
            Success: true,
            Advanced: false,
            Watermark: existing ? toWatermarkDTO(existing) : null,
        };
    }

    const targetDate = new Date(parseNoticeTimestamp(targetTimestamp).epochMs);
    const now = new Date();

    const saveAttempt = async (currentRow: SimpleSpaceNoticeWatermarkRow | null): Promise<AdvanceSpaceNoticeWatermarkResult> => {
        return ServerOperationScopeManager.Instance.RunWithAuthority(
            {
                operationKey: ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY,
                source: 'ServerEngine',
                allowedEntities: [SPACE_NOTICE_WATERMARK_ENTITY],
                userId: actingUser.ID,
            },
            async () => {
                const entity = await provider.GetEntityObject<mjBizAppsCollaborationSpaceNoticeWatermarkEntity>(
                    SPACE_NOTICE_WATERMARK_ENTITY,
                    privilegedUser,
                );
                if (currentRow) {
                    const loaded = await entity.Load(currentRow.ID);
                    if (!loaded) {
                        throw new RemoteOperationError('EXECUTION_ERROR', `Failed to load watermark row ${currentRow.ID}.`);
                    }
                } else {
                    entity.SpaceID = spaceId;
                    entity.UserID = auth.userId;
                }

                entity.LastReadEventTimestamp = targetDate;
                entity.LastReadEventID = targetEventId;
                entity.LastReadAt = now;

                const saved = await entity.Save();
                if (!saved) {
                    const msg = entity.LatestResult?.CompleteMessage || entity.LatestResult?.Message || 'Watermark save failed';
                    if (!currentRow) {
                        // Concurrent insert race on UQ_SpaceNoticeWatermark_Space_User: reload winner & resolve monotonically.
                        const racedWinner = await loadWatermarkRowForMemberSpace(rv, spaceId, auth.userId, privilegedUser, dialect);
                        if (racedWinner) {
                            const racedCursor: SpaceNoticeCursor = {
                                EventTimestamp: racedWinner.LastReadEventTimestamp,
                                EventID: normalizeNoticeUuid(racedWinner.LastReadEventID) ?? ZERO_NOTICE_UUID,
                            };
                            if (!shouldAdvanceWatermark(racedCursor, candidateCursor)) {
                                return {
                                    Success: true,
                                    Advanced: false,
                                    Watermark: toWatermarkDTO(racedWinner),
                                };
                            }
                            return saveAttempt(racedWinner);
                        }
                    }
                    throw new RemoteOperationError('EXECUTION_ERROR', msg);
                }

                return {
                    Success: true,
                    Advanced: true,
                    Watermark: {
                        ID: normalizeNoticeUuid(entity.ID) ?? entity.ID,
                        SpaceID: spaceId,
                        UserID: auth.userId,
                        LastReadEventTimestamp: targetDate.toISOString(),
                        LastReadEventID: targetEventId,
                        LastReadAt: now.toISOString(),
                    },
                };
            },
        );
    };

    return saveAttempt(existing);
}

/**
 * Invokes a registered {@link BaseRemotableOperation} seamlessly across both server in-process callers
 * (`ExecuteServer`) and GraphQL remote-operation client providers (`RouteOperation`).
 */
export async function invokeCollaborationRemoteOperation<TInput, TOutput>(
    operationKey: string,
    input: TInput,
    provider: IMetadataProvider,
    user: UserInfo,
): Promise<TOutput> {
    LoadCollaborationSpaceNoticeOperations();
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

@RegisterClass(BaseRemotableOperation, PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY)
export class PublishSpaceNoticeEventOperation extends BaseRemotableOperation<
    PublishSpaceNoticeEventInput,
    PublishSpaceNoticeEventResult
> {
    public override readonly OperationKey = PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return true;
    }

    public override readonly AuthorizedWriteEntities = [SPACE_NOTICE_EVENT_ENTITY] as const;

    protected override async Authorize(
        _input: PublishSpaceNoticeEventInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: PublishSpaceNoticeEventInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<PublishSpaceNoticeEventResult> {
        return runPublishSpaceNoticeEvent(provider, user, input);
    }
}

@RegisterClass(BaseRemotableOperation, GET_SPACE_NOTICES_OPERATION_KEY)
export class GetSpaceNoticesOperation extends BaseRemotableOperation<
    GetSpaceNoticesInput,
    GetSpaceNoticesResult
> {
    public override readonly OperationKey = GET_SPACE_NOTICES_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: GetSpaceNoticesInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: GetSpaceNoticesInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<GetSpaceNoticesResult> {
        return runGetSpaceNotices(provider, user, input ?? {});
    }
}

@RegisterClass(BaseRemotableOperation, GET_SPACE_UNREAD_NOTICE_COUNTS_OPERATION_KEY)
export class GetSpaceUnreadNoticeCountsOperation extends BaseRemotableOperation<
    GetSpaceUnreadNoticeCountsInput,
    GetSpaceUnreadNoticeCountsResult
> {
    public override readonly OperationKey = GET_SPACE_UNREAD_NOTICE_COUNTS_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return false;
    }

    protected override async Authorize(
        _input: GetSpaceUnreadNoticeCountsInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: GetSpaceUnreadNoticeCountsInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<GetSpaceUnreadNoticeCountsResult> {
        return runGetSpaceUnreadNoticeCounts(provider, user, input ?? {});
    }
}

@RegisterClass(BaseRemotableOperation, ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY)
export class AdvanceSpaceNoticeWatermarkOperation extends BaseRemotableOperation<
    AdvanceSpaceNoticeWatermarkInput,
    AdvanceSpaceNoticeWatermarkResult
> {
    public override readonly OperationKey = ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY;

    public override get DisallowMagicLinkScope(): boolean {
        return true;
    }

    public override get GrantsServerWriteAuthority(): boolean {
        return true;
    }

    public override readonly AuthorizedWriteEntities = [SPACE_NOTICE_WATERMARK_ENTITY] as const;

    protected override async Authorize(
        _input: AdvanceSpaceNoticeWatermarkInput,
        user: UserInfo,
    ): Promise<boolean> {
        const auth = validateAuthenticatedMemberCaller(user);
        if (!auth.ok) {
            throw new RemoteOperationError('FORBIDDEN', auth.reason);
        }
        return true;
    }

    protected override async InternalExecute(
        input: AdvanceSpaceNoticeWatermarkInput,
        provider: IMetadataProvider,
        user: UserInfo,
        _context: RemoteOpServerContext,
    ): Promise<AdvanceSpaceNoticeWatermarkResult> {
        return runAdvanceSpaceNoticeWatermark(provider, user, input);
    }
}

/**
 * Retains all CS-4 Space Notice `@RegisterClass(BaseRemotableOperation, ...)` subclasses
 * against bundler tree-shaking on server and client startup.
 */
export function LoadCollaborationSpaceNoticeOperations(): void {
    void PublishSpaceNoticeEventOperation;
    void GetSpaceNoticesOperation;
    void GetSpaceUnreadNoticeCountsOperation;
    void AdvanceSpaceNoticeWatermarkOperation;
}
