/**
 * Pure CS-4 fan-out-on-read Space Notices domain rules.
 *
 * Zero MemberJunction or database imports so the exact composite cursor ordering,
 * band reach filtering, newly joined member baseline, and monotonic watermark
 * invariants execute identically on client, server, and unit tests.
 */

export const SPACE_NOTICE_EVENT_KINDS = [
    'Share',
    'StatusChanged',
    'Mention',
    'Reply',
    'Task',
    'Approval',
    'Announcement',
    'System',
] as const;

export type SpaceNoticeEventKind = (typeof SPACE_NOTICE_EVENT_KINDS)[number];

export const SPACE_NOTICE_BANDS = ['Shared', 'Team'] as const;

export type SpaceNoticeBand = (typeof SPACE_NOTICE_BANDS)[number];

export const SPACE_DIGEST_CADENCES = ['Daily', 'Weekly', 'Immediate', 'Custom'] as const;

export type SpaceDigestCadence = (typeof SPACE_DIGEST_CADENCES)[number];

export const SPACE_DIGEST_CHECKPOINT_STATUSES = ['Active', 'Paused'] as const;

export type SpaceDigestCheckpointStatus = (typeof SPACE_DIGEST_CHECKPOINT_STATUSES)[number];

export const ZERO_NOTICE_UUID = '00000000-0000-0000-0000-000000000000';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_FRACTION_REGEX = /\.(\d+)(?:Z|[+-]\d{2}:?\d{2})?$/i;

export interface SpaceNoticeCursor {
    EventTimestamp: string | Date;
    EventID: string;
}

export interface SpaceNoticeEventRecord {
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
    EventTimestamp: string | Date;
}

export interface SpaceNoticeWatermarkRecord {
    ID?: string;
    SpaceID: string;
    UserID: string;
    LastReadEventTimestamp: string | Date;
    LastReadEventID: string | null;
    LastReadAt?: string | Date;
}

export interface SpaceNoticeFeedItem extends SpaceNoticeEventRecord {
    IsUnread: boolean;
    EventTimestampIso: string;
}

export interface SpaceNoticeReachInfo {
    SpaceID: string;
    CanSeeTeam: boolean;
    MemberJoinedAt?: string | Date | null;
}

export interface EffectiveWatermarkResolution {
    Cursor: {
        EventTimestamp: string;
        EventID: string;
    };
    Source: 'watermark' | 'member-join' | 'default-baseline' | 'epoch';
}

export interface ResolveNoticeFeedInput {
    Events: readonly SpaceNoticeEventRecord[];
    ReachBySpace: ReadonlyMap<string, SpaceNoticeReachInfo>;
    WatermarksBySpace: ReadonlyMap<string, SpaceNoticeWatermarkRecord>;
    DefaultBaselineTimestamp?: string | Date | null;
    SpaceIDFilter?: ReadonlySet<string> | null;
    EventKinds?: ReadonlySet<SpaceNoticeEventKind> | null;
    UnreadOnly?: boolean;
    Order?: 'desc' | 'asc';
    AfterCursor?: SpaceNoticeCursor | null;
    Limit?: number;
}

export interface ResolveNoticeFeedResult {
    Items: SpaceNoticeFeedItem[];
    UnreadCount: number;
    UnreadCountBySpace: Record<string, number>;
    EffectiveWatermarksBySpace: Record<string, EffectiveWatermarkResolution>;
    HasMore: boolean;
    NextCursor: SpaceNoticeCursor | null;
}

export function normalizeNoticeUuid(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') {
        return null;
    }
    const trimmed = raw.trim().toLowerCase();
    return UUID_REGEX.test(trimmed) ? trimmed : null;
}

export function isSpaceNoticeEventKind(value: string | null | undefined): value is SpaceNoticeEventKind {
    if (typeof value !== 'string') {
        return false;
    }
    return (SPACE_NOTICE_EVENT_KINDS as readonly string[]).includes(value);
}

export function isSpaceNoticeBand(value: string | null | undefined): value is SpaceNoticeBand {
    return value === 'Shared' || value === 'Team';
}

export function isSpaceDigestCadence(value: string | null | undefined): value is SpaceDigestCadence {
    if (typeof value !== 'string') {
        return false;
    }
    return (SPACE_DIGEST_CADENCES as readonly string[]).includes(value);
}

export interface ParsedNoticeTimestamp {
    epochMs: number;
    /** Sub-millisecond fractional value in 100-nanosecond ticks (0..9999) for DATETIMEOFFSET(7)/TIMESTAMPTZ parity. */
    subMs100ns: number;
    iso: string;
}

/**
 * Parses a Date or ISO-8601 timestamp string while preserving sub-millisecond precision up to 7 digits.
 */
export function parseNoticeTimestamp(raw: string | Date): ParsedNoticeTimestamp {
    if (raw instanceof Date) {
        const ms = raw.getTime();
        if (!Number.isFinite(ms)) {
            throw new Error('Invalid Date value for space notice timestamp.');
        }
        return { epochMs: ms, subMs100ns: 0, iso: raw.toISOString() };
    }
    if (typeof raw !== 'string' || raw.trim().length === 0) {
        throw new Error('Space notice timestamp must be a non-empty Date or ISO string.');
    }
    const trimmed = raw.trim();
    const parsedMs = Date.parse(trimmed);
    if (!Number.isFinite(parsedMs)) {
        throw new Error(`Invalid space notice timestamp: '${trimmed}'.`);
    }
    let subMs100ns = 0;
    const match = ISO_FRACTION_REGEX.exec(trimmed);
    if (match) {
        const padded = match[1].padEnd(7, '0').slice(0, 7);
        subMs100ns = Number.parseInt(padded.slice(3, 7), 10);
    }
    return {
        epochMs: parsedMs,
        subMs100ns: Number.isFinite(subMs100ns) ? subMs100ns : 0,
        iso: trimmed,
    };
}

/**
 * Deterministic total ordering over composite `(EventTimestamp, EventID)` cursors.
 * Returns `< 0` when `a < b`, `0` when equal, `> 0` when `a > b`.
 */
export function compareNoticeCursors(a: SpaceNoticeCursor, b: SpaceNoticeCursor): number {
    const tsA = parseNoticeTimestamp(a.EventTimestamp);
    const tsB = parseNoticeTimestamp(b.EventTimestamp);
    if (tsA.epochMs !== tsB.epochMs) {
        return tsA.epochMs < tsB.epochMs ? -1 : 1;
    }
    const idA = normalizeNoticeUuid(a.EventID) ?? ZERO_NOTICE_UUID;
    const idB = normalizeNoticeUuid(b.EventID) ?? ZERO_NOTICE_UUID;
    // Persisting a cursor via JS Date truncates DATETIMEOFFSET(7) sub-millisecond ticks to 0.
    // When both cursors identify the exact same non-zero EventID within the same millisecond,
    // treat that truncated representation as equal so the event does not remain unread.
    if (idA === idB && idA !== ZERO_NOTICE_UUID && (tsA.subMs100ns === 0 || tsB.subMs100ns === 0)) {
        return 0;
    }
    if (tsA.subMs100ns !== tsB.subMs100ns) {
        return tsA.subMs100ns < tsB.subMs100ns ? -1 : 1;
    }
    if (idA === idB) {
        return 0;
    }
    return idA < idB ? -1 : 1;
}

export function isNoticeEventVisibleToMember(
    event: Pick<SpaceNoticeEventRecord, 'SpaceID' | 'Band'>,
    reach: SpaceNoticeReachInfo | undefined,
): boolean {
    if (!reach) {
        return false;
    }
    const eventSpaceId = normalizeNoticeUuid(event.SpaceID);
    const reachSpaceId = normalizeNoticeUuid(reach.SpaceID);
    if (!eventSpaceId || !reachSpaceId || eventSpaceId !== reachSpaceId) {
        return false;
    }
    if (event.Band === 'Shared') {
        return true;
    }
    return event.Band === 'Team' && reach.CanSeeTeam;
}

/**
 * Resolves the effective read watermark cursor for a `(SpaceID, UserID)` pair.
 *
 * Precedence:
 * 1. Stored `SpaceNoticeWatermark` `(LastReadEventTimestamp, LastReadEventID)`.
 * 2. Newly joined member baseline `(MemberJoinedAt, ZERO_NOTICE_UUID)` so historical events prior to joining
 *    do not inflate unread counts while events at or after joining remain unread.
 * 3. Optional caller-provided `defaultBaselineTimestamp`.
 * 4. Unix epoch (`1970-01-01T00:00:00.000Z`, `ZERO_NOTICE_UUID`).
 */
export function resolveEffectiveWatermarkCursor(input: {
    watermark?: SpaceNoticeWatermarkRecord | null;
    memberJoinedAt?: string | Date | null;
    defaultBaselineTimestamp?: string | Date | null;
}): EffectiveWatermarkResolution {
    if (input.watermark) {
        const ts = parseNoticeTimestamp(input.watermark.LastReadEventTimestamp);
        const eventId = normalizeNoticeUuid(input.watermark.LastReadEventID) ?? ZERO_NOTICE_UUID;
        return {
            Cursor: { EventTimestamp: ts.iso, EventID: eventId },
            Source: 'watermark',
        };
    }
    if (input.memberJoinedAt !== undefined && input.memberJoinedAt !== null) {
        const ts = parseNoticeTimestamp(input.memberJoinedAt);
        return {
            Cursor: { EventTimestamp: ts.iso, EventID: ZERO_NOTICE_UUID },
            Source: 'member-join',
        };
    }
    if (input.defaultBaselineTimestamp !== undefined && input.defaultBaselineTimestamp !== null) {
        const ts = parseNoticeTimestamp(input.defaultBaselineTimestamp);
        return {
            Cursor: { EventTimestamp: ts.iso, EventID: ZERO_NOTICE_UUID },
            Source: 'default-baseline',
        };
    }
    return {
        Cursor: { EventTimestamp: '1970-01-01T00:00:00.000Z', EventID: ZERO_NOTICE_UUID },
        Source: 'epoch',
    };
}

/**
 * Returns true iff the event's `(EventTimestamp, ID)` cursor is strictly newer than the member's
 * effective watermark cursor.
 */
export function isNoticeEventUnread(
    event: Pick<SpaceNoticeEventRecord, 'ID' | 'EventTimestamp'>,
    effectiveCursor: SpaceNoticeCursor,
): boolean {
    return compareNoticeCursors(
        { EventTimestamp: event.EventTimestamp, EventID: event.ID },
        effectiveCursor,
    ) > 0;
}

/**
 * Enforces monotonic, idempotent watermark progression:
 * advances ONLY when no watermark exists yet or `candidateCursor > currentWatermark`.
 */
export function shouldAdvanceWatermark(
    currentWatermark: SpaceNoticeCursor | null | undefined,
    candidateCursor: SpaceNoticeCursor,
): boolean {
    if (!currentWatermark) {
        return true;
    }
    return compareNoticeCursors(candidateCursor, currentWatermark) > 0;
}

/**
 * Resolves per-member unread counts and read/unread feed flags purely from single-row
 * `SpaceNoticeEvent` records and per-member `SpaceNoticeWatermark` rows (CS-4 fan-out-on-read).
 */
export function resolveSpaceNoticeFeedForMember(input: ResolveNoticeFeedInput): ResolveNoticeFeedResult {
    const order = input.Order ?? 'desc';
    const unreadCountBySpace: Record<string, number> = {};
    const effectiveWatermarksBySpace: Record<string, EffectiveWatermarkResolution> = {};

    for (const [spaceKey, reach] of input.ReachBySpace.entries()) {
        const normalizedSpace = normalizeNoticeUuid(reach.SpaceID) ?? spaceKey;
        if (input.SpaceIDFilter && !input.SpaceIDFilter.has(normalizedSpace)) {
            continue;
        }
        const watermark = input.WatermarksBySpace.get(normalizedSpace) ?? null;
        effectiveWatermarksBySpace[normalizedSpace] = resolveEffectiveWatermarkCursor({
            watermark,
            memberJoinedAt: reach.MemberJoinedAt ?? null,
            defaultBaselineTimestamp: input.DefaultBaselineTimestamp ?? null,
        });
        unreadCountBySpace[normalizedSpace] = 0;
    }

    const visibleItems: SpaceNoticeFeedItem[] = [];
    let totalUnreadCount = 0;

    for (const event of input.Events) {
        const spaceId = normalizeNoticeUuid(event.SpaceID);
        const eventId = normalizeNoticeUuid(event.ID);
        if (!spaceId || !eventId) {
            continue;
        }
        if (input.SpaceIDFilter && !input.SpaceIDFilter.has(spaceId)) {
            continue;
        }
        const reach = input.ReachBySpace.get(spaceId);
        if (!isNoticeEventVisibleToMember(event, reach)) {
            continue;
        }
        if (input.EventKinds && input.EventKinds.size > 0 && !input.EventKinds.has(event.EventKind)) {
            continue;
        }

        const effective = effectiveWatermarksBySpace[spaceId] ?? resolveEffectiveWatermarkCursor({
            watermark: input.WatermarksBySpace.get(spaceId) ?? null,
            memberJoinedAt: reach?.MemberJoinedAt ?? null,
            defaultBaselineTimestamp: input.DefaultBaselineTimestamp ?? null,
        });
        effectiveWatermarksBySpace[spaceId] = effective;

        const parsedTs = parseNoticeTimestamp(event.EventTimestamp);
        const isUnread = isNoticeEventUnread(event, effective.Cursor);
        if (isUnread) {
            totalUnreadCount += 1;
            unreadCountBySpace[spaceId] = (unreadCountBySpace[spaceId] ?? 0) + 1;
        }

        if (input.UnreadOnly && !isUnread) {
            continue;
        }

        visibleItems.push({
            ...event,
            ID: eventId,
            SpaceID: spaceId,
            IsUnread: isUnread,
            EventTimestampIso: parsedTs.iso,
        });
    }

    visibleItems.sort((a, b) => {
        const cmp = compareNoticeCursors(
            { EventTimestamp: a.EventTimestamp, EventID: a.ID },
            { EventTimestamp: b.EventTimestamp, EventID: b.ID },
        );
        return order === 'desc' ? -cmp : cmp;
    });

    const afterPaged = input.AfterCursor
        ? visibleItems.filter((item) => {
            const cmp = compareNoticeCursors(
                { EventTimestamp: item.EventTimestamp, EventID: item.ID },
                input.AfterCursor!,
            );
            return order === 'desc' ? cmp < 0 : cmp > 0;
        })
        : visibleItems;

    const effectiveLimit =
        typeof input.Limit === 'number' && Number.isFinite(input.Limit) && input.Limit > 0
            ? Math.floor(input.Limit)
            : afterPaged.length;

    const pageItems = afterPaged.slice(0, effectiveLimit);
    const hasMore = afterPaged.length > pageItems.length;
    const last = pageItems.length > 0 ? pageItems[pageItems.length - 1] : null;
    const nextCursor: SpaceNoticeCursor | null = hasMore && last
        ? { EventTimestamp: last.EventTimestampIso, EventID: last.ID }
        : null;

    return {
        Items: pageItems,
        UnreadCount: totalUnreadCount,
        UnreadCountBySpace: unreadCountBySpace,
        EffectiveWatermarksBySpace: effectiveWatermarksBySpace,
        HasMore: hasMore,
        NextCursor: nextCursor,
    };
}
