/**
 * Pure NT-2 Scheduled Scoped Digest domain rules.
 *
 * Zero MemberJunction or database imports so deterministic `(EventTimestamp, ID)`
 * composite keyset cursor progression, fail-closed per-item reach verification,
 * empty-digest suppression, cadence scheduling, and plain-text Comms v2 digest
 * payload assembly execute identically in client, server, and `node:test`.
 */

import {
    COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
    COLLABORATION_NOTIFICATION_CHANNELS,
    COLLABORATION_SPACE_RESOURCE_TYPE_ID,
    type CollaborationChannelPreferences,
    type CollaborationDigestPreferences,
    type CollaborationNotificationChannel,
    type CollaborationUserNotificationPreferences,
    type CommsV2ChannelDecision,
    type CommsV2NotificationPayload,
    type CommsV2SuppressedChannel,
    createDefaultCollaborationNotificationPreferences,
    hasContactForChannel,
    isCollaborationNotificationEventType,
    isWithinQuietHours,
    matchesMutedItem,
    type MJNotificationTypeDefaultSnapshot,
    type MJUserNotificationPreferenceSnapshot,
    normalizeCollaborationNotificationPreferences,
    type NotificationSuppressionReason,
    readMJPreferenceChannel,
    resolveBaseChannelEnabled,
    resolveEffectiveDigestPreferences,
} from './notifications.ts';
import {
    compareNoticeCursors,
    isNoticeEventVisibleToMember,
    isSpaceDigestCadence,
    isSpaceNoticeBand,
    isSpaceNoticeEventKind,
    normalizeNoticeUuid,
    parseNoticeTimestamp,
    shouldAdvanceWatermark,
    type SpaceDigestCadence,
    type SpaceDigestCheckpointStatus,
    type SpaceNoticeBand,
    type SpaceNoticeCursor,
    type SpaceNoticeEventKind,
    type SpaceNoticeEventRecord,
    type SpaceNoticeReachInfo,
    ZERO_NOTICE_UUID,
} from './space-notices.ts';

export const SPACE_ITEMS_ENTITY_ID = '41165fec-a52b-469a-a880-3b108c39a65e';
export const SPACE_CHATS_ENTITY_ID = '75e3ed25-c46b-45c1-96f7-91578d88dbe2';
export const SPACE_NOTES_ENTITY_ID = 'cb59dea7-2155-4a33-b836-adf2b268d2e9';

export const DIGEST_CADENCE_INTERVAL_MS: Readonly<Record<SpaceDigestCadence, number>> = {
    Immediate: 0,
    Daily: 24 * 60 * 60 * 1000,
    Weekly: 7 * 24 * 60 * 60 * 1000,
    Custom: 24 * 60 * 60 * 1000,
};

export interface SpaceDigestCheckpointRecord {
    ID?: string;
    UserID: string;
    SpaceID: string | null;
    Cadence: SpaceDigestCadence;
    LastDeliveredTimestamp: string | Date;
    LastDeliveredRecordID: string | null;
    LastDeliveredAt: string | Date;
    ItemsIncludedCount: number;
    Status: SpaceDigestCheckpointStatus;
}

export interface DigestTargetItemSnapshot {
    ID: string;
    SpaceID: string;
    Band: SpaceNoticeBand;
    EntityID?: string | null;
    RecordID?: string | null;
}

export interface DigestTargetChatSnapshot {
    ID: string;
    SpaceID: string;
    ConversationID?: string | null;
    Kind: 'Assistant' | 'General' | 'Private' | 'Topic';
    Status: 'Active' | 'Archived';
    OwnerUserID?: string | null;
}

export interface DigestTargetNoteSnapshot {
    ID: string;
    SpaceID: string;
    Band: SpaceNoticeBand;
    Visibility: 'Private' | 'Space';
    AuthorUserID: string;
}

export interface DigestItemReachVerificationSnapshot {
    SpaceItemsById?: ReadonlyMap<string, DigestTargetItemSnapshot>;
    SpaceChatsById?: ReadonlyMap<string, DigestTargetChatSnapshot>;
    SpaceChatsByConversationId?: ReadonlyMap<string, DigestTargetChatSnapshot>;
    SpaceNotesById?: ReadonlyMap<string, DigestTargetNoteSnapshot>;
}

export interface DigestCandidateNotice extends SpaceNoticeEventRecord {
    SpaceName?: string | null;
    /** Optional pre-parsed target references extracted from MetadataJSON. */
    ReferencedSpaceItemID?: string | null;
    ReferencedSpaceChatID?: string | null;
    ReferencedConversationID?: string | null;
    ReferencedSpaceNoteID?: string | null;
}

export interface DigestRecipientSpaceReach extends SpaceNoticeReachInfo {
    IsVisibleStatus?: boolean;
    IsOwner?: boolean;
}

export interface DigestRecipientScopeAccess {
    UserID: string;
    Name?: string | null;
    Email?: string | null;
    Phone?: string | null;
    ChatHandle?: string | null;
    IsActiveUser: boolean;
    ReachBySpace: ReadonlyMap<string, DigestRecipientSpaceReach>;
    AncestorSpaceIDsBySpace?: ReadonlyMap<string, readonly string[]>;
    Preferences?: CollaborationUserNotificationPreferences | null;
    MJDigestPreference?: MJUserNotificationPreferenceSnapshot | null;
    Checkpoint?: SpaceDigestCheckpointRecord | null;
}

export type DigestItemExclusionReason =
    | 'InvalidEvent'
    | 'NoSpaceReach'
    | 'HiddenSpace'
    | 'TeamBandRestricted'
    | 'TargetItemMissing'
    | 'TargetItemRestricted'
    | 'TargetChatMissing'
    | 'TargetChatRestricted'
    | 'TargetNoteMissing'
    | 'TargetNoteRestricted'
    | 'BeforeMemberJoined'
    | 'AlreadyDelivered'
    | 'ExcludedActor'
    | 'SpaceMuted'
    | 'ItemMuted'
    | 'EventTypeUnsubscribed'
    | 'SpaceCadenceOff';

export type DigestSuppressionReason =
    | 'UserInactive'
    | 'CheckpointPaused'
    | 'DigestOptedOut'
    | 'CadenceMismatch'
    | 'WindowNotDue'
    | 'EmptyDigest'
    | NotificationSuppressionReason;

export interface DigestExcludedItemRecord {
    EventID: string;
    SpaceID: string;
    Reason: DigestItemExclusionReason;
}

export interface DigestIncludedItem {
    EventID: string;
    SpaceID: string;
    SpaceName: string | null;
    EventKind: SpaceNoticeEventKind;
    Band: SpaceNoticeBand;
    Title: string;
    Summary: string | null;
    EventTimestampIso: string;
    TargetEntityID: string | null;
    TargetRecordID: string | null;
}

export interface AssembleDigestForRecipientInput {
    Recipient: DigestRecipientScopeAccess;
    Events: readonly DigestCandidateNotice[];
    Cadence: SpaceDigestCadence;
    TargetSpaceID?: string | null;
    TargetSpaceIDs?: ReadonlySet<string> | null;
    DigestNotificationTypeDefault?: MJNotificationTypeDefaultSnapshot | null;
    VerificationSnapshot?: DigestItemReachVerificationSnapshot;
    AllowedChannels?: Partial<Record<CollaborationChannelPreferences extends never ? never : CollaborationNotificationChannel, boolean>>;
    NowUtc?: Date;
    ForceWindow?: boolean;
    IgnoreCadenceFilter?: boolean;
    CustomIntervalMs?: number;
    IncludeActor?: boolean;
}

export interface AssembleDigestForRecipientResult {
    RecipientUserID: string;
    Cadence: SpaceDigestCadence;
    SpaceID: string | null;
    ShouldDeliver: boolean;
    SuppressionReason: DigestSuppressionReason | null;
    ChannelSuppressionReasons: NotificationSuppressionReason[];
    PermittedChannels: CollaborationNotificationChannel[];
    SuppressedChannels: CommsV2SuppressedChannel[];
    QuietHoursActive: boolean;
    Items: DigestIncludedItem[];
    ExcludedItems: DigestExcludedItemRecord[];
    HighestObservedCursor: SpaceNoticeCursor | null;
    HighestIncludedCursor: SpaceNoticeCursor | null;
    Payload: CommsV2NotificationPayload | null;
}

interface ParsedDigestTargetMetadata {
    SpaceItemID: string | null;
    SpaceChatID: string | null;
    ConversationID: string | null;
    SpaceNoteID: string | null;
    ItemID: string | null;
    TaskID: string | null;
    ConversationDetailID: string | null;
    DeepLinkUrl: string | null;
}

type JsonScalar = string | number | boolean | null;
type JsonNode = JsonScalar | JsonRecord | JsonNode[];
interface JsonRecord {
    [key: string]: JsonNode | undefined;
}

/**
 * Strips raw Markdown syntax (`###`, `**`, `__`, code fences, inline code, links)
 * so rendered digest titles and body summaries never leak raw Markdown tokens.
 */
export function stripRawMarkdownSyntaxForDigest(raw: string | null | undefined): string {
    if (typeof raw !== 'string') return '';
    let text = raw.replace(/\r\n/g, '\n');
    text = text.replace(/```[\s\S]*?```/g, (block) => {
        const inner = block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
        return inner.trim();
    });
    text = text.replace(/`([^`]*)`/g, '$1');
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    text = text.replace(/^\s{0,3}>\s?/gm, '');
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    text = text.replace(/~~(.*?)~~/g, '$1');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

export function stripRecordKeyPrefixIfPresent(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const withoutPrefix = trimmed.toLowerCase().startsWith('id|') ? trimmed.slice(3).trim() : trimmed;
    return normalizeNoticeUuid(withoutPrefix);
}

export function parseDigestTargetMetadata(metadataJson: string | null | undefined): ParsedDigestTargetMetadata {
    const empty: ParsedDigestTargetMetadata = {
        SpaceItemID: null,
        SpaceChatID: null,
        ConversationID: null,
        SpaceNoteID: null,
        ItemID: null,
        TaskID: null,
        ConversationDetailID: null,
        DeepLinkUrl: null,
    };
    if (typeof metadataJson !== 'string' || metadataJson.trim().length === 0) {
        return empty;
    }
    let parsed: JsonNode;
    try {
        parsed = JSON.parse(metadataJson) as JsonNode;
    } catch {
        return empty;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return empty;
    }
    const readUuidField = (key: string): string | null => {
        const v = parsed[key];
        return typeof v === 'string' ? stripRecordKeyPrefixIfPresent(v) : null;
    };
    const readStringField = (key: string): string | null => {
        const v = parsed[key];
        return typeof v === 'string' && v.trim() ? v.trim() : null;
    };
    return {
        SpaceItemID: readUuidField('SpaceItemID') ?? readUuidField('spaceItemId'),
        SpaceChatID: readUuidField('SpaceChatID') ?? readUuidField('spaceChatId'),
        ConversationID: readUuidField('ConversationID') ?? readUuidField('conversationId'),
        SpaceNoteID: readUuidField('SpaceNoteID') ?? readUuidField('spaceNoteId'),
        ItemID: readUuidField('ItemID') ?? readUuidField('itemId'),
        TaskID: readUuidField('TaskID') ?? readUuidField('taskId'),
        ConversationDetailID: readUuidField('ConversationDetailID') ?? readUuidField('conversationDetailId'),
        DeepLinkUrl: readStringField('DeepLinkUrl') ?? readStringField('deepLinkUrl'),
    };
}

/**
 * Deterministic total ascending ordering over composite `(EventTimestamp, ID)` keyset cursors.
 */
export function sortNoticeEventsByCompositeKeyset<T extends Pick<SpaceNoticeEventRecord, 'ID' | 'EventTimestamp'>>(
    events: readonly T[],
): T[] {
    return [...events].sort((a, b) =>
        compareNoticeCursors(
            { EventTimestamp: a.EventTimestamp, EventID: a.ID },
            { EventTimestamp: b.EventTimestamp, EventID: b.ID },
        ),
    );
}

export function isNoticeStrictlyAfterCursor(
    event: Pick<SpaceNoticeEventRecord, 'ID' | 'EventTimestamp'>,
    cursor: SpaceNoticeCursor | null | undefined,
): boolean {
    if (!cursor) return true;
    return (
        compareNoticeCursors(
            { EventTimestamp: event.EventTimestamp, EventID: event.ID },
            cursor,
        ) > 0
    );
}

export function isNoticeAtOrBeforeCursor(
    event: Pick<SpaceNoticeEventRecord, 'ID' | 'EventTimestamp'>,
    cursor: SpaceNoticeCursor,
): boolean {
    return (
        compareNoticeCursors(
            { EventTimestamp: event.EventTimestamp, EventID: event.ID },
            cursor,
        ) <= 0
    );
}

/**
 * Advances a composite keyset `(EventTimestamp, ID)` cursor from a non-empty ascending page,
 * throwing if the page does not strictly advance past `previousCursor`.
 */
export function advanceCompositeKeysetCursor(
    previousCursor: SpaceNoticeCursor | null | undefined,
    pageEvents: readonly Pick<SpaceNoticeEventRecord, 'ID' | 'EventTimestamp'>[],
): SpaceNoticeCursor | null {
    if (pageEvents.length === 0) {
        return previousCursor ?? null;
    }
    const last = pageEvents[pageEvents.length - 1];
    const cleanId = normalizeNoticeUuid(last.ID);
    if (!cleanId) {
        throw new Error('Composite keyset cursor cannot advance from a row without a valid UUID ID.');
    }
    const parsedTs = parseNoticeTimestamp(last.EventTimestamp);
    const nextCursor: SpaceNoticeCursor = {
        EventTimestamp: parsedTs.iso,
        EventID: cleanId,
    };
    if (previousCursor && compareNoticeCursors(nextCursor, previousCursor) <= 0) {
        throw new Error(
            `Composite keyset cursor failed to advance monotonically (${parsedTs.iso}, ${cleanId}).`,
        );
    }
    return nextCursor;
}

/**
 * Evaluates whether a digest window is due for a given cadence and checkpoint.
 */
export function isDigestScheduleWindowDue(input: {
    Cadence: SpaceDigestCadence;
    Checkpoint?: SpaceDigestCheckpointRecord | null;
    NowUtc?: Date;
    ForceWindow?: boolean;
    CustomIntervalMs?: number;
}): { due: boolean; reason: 'WindowNotDue' | 'CheckpointPaused' | null } {
    if (input.Checkpoint?.Status === 'Paused') {
        return { due: false, reason: 'CheckpointPaused' };
    }
    if (input.ForceWindow || input.Cadence === 'Immediate') {
        return { due: true, reason: null };
    }
    if (!input.Checkpoint) {
        return { due: true, reason: null };
    }
    const nowMs = (input.NowUtc ?? new Date()).getTime();
    const lastDeliveredMs = parseNoticeTimestamp(input.Checkpoint.LastDeliveredAt).epochMs;
    const intervalMs =
        input.Cadence === 'Custom' && typeof input.CustomIntervalMs === 'number' && input.CustomIntervalMs >= 0
            ? input.CustomIntervalMs
            : DIGEST_CADENCE_INTERVAL_MS[input.Cadence];
    if (nowMs - lastDeliveredMs < intervalMs) {
        return { due: false, reason: 'WindowNotDue' };
    }
    return { due: true, reason: null };
}

function resolveDigestCandidateVerification(
    event: DigestCandidateNotice,
    recipient: DigestRecipientScopeAccess,
    reach: DigestRecipientSpaceReach,
    snapshot: DigestItemReachVerificationSnapshot | undefined,
    parsedMeta: ParsedDigestTargetMetadata,
): DigestItemExclusionReason | null {
    const recipientId = normalizeNoticeUuid(recipient.UserID) ?? recipient.UserID;
    const eventSpaceId = normalizeNoticeUuid(event.SpaceID) ?? event.SpaceID;
    const targetEntityId = normalizeNoticeUuid(event.TargetEntityID);
    const targetRecordUuid = stripRecordKeyPrefixIfPresent(event.TargetRecordID);

    // 1. SpaceItem verification (direct TargetEntityID = Space Items, or ReferencedSpaceItemID)
    const candidateSpaceItemId =
        event.ReferencedSpaceItemID ??
        parsedMeta.SpaceItemID ??
        (targetEntityId === SPACE_ITEMS_ENTITY_ID ? targetRecordUuid : null);

    if (candidateSpaceItemId && snapshot?.SpaceItemsById) {
        const item = snapshot.SpaceItemsById.get(candidateSpaceItemId);
        if (!item) {
            return 'TargetItemMissing';
        }
        if (normalizeNoticeUuid(item.SpaceID) !== eventSpaceId) {
            return 'TargetItemRestricted';
        }
        if (item.Band === 'Team' && !reach.CanSeeTeam) {
            return 'TargetItemRestricted';
        }
    }

    // 2. SpaceChat verification (direct TargetEntityID = Space Chats, or ReferencedSpaceChatID / ConversationID)
    const candidateSpaceChatId =
        event.ReferencedSpaceChatID ??
        parsedMeta.SpaceChatID ??
        (targetEntityId === SPACE_CHATS_ENTITY_ID ? targetRecordUuid : null);
    const candidateConversationId = event.ReferencedConversationID ?? parsedMeta.ConversationID;

    if (candidateSpaceChatId && snapshot?.SpaceChatsById) {
        const chat = snapshot.SpaceChatsById.get(candidateSpaceChatId);
        if (!chat) {
            return 'TargetChatMissing';
        }
        if (normalizeNoticeUuid(chat.SpaceID) !== eventSpaceId || chat.Status === 'Archived') {
            return 'TargetChatRestricted';
        }
        if (chat.Kind === 'Private' && !reach.CanSeeTeam) {
            return 'TargetChatRestricted';
        }
        if (chat.Kind === 'Assistant' && normalizeNoticeUuid(chat.OwnerUserID) !== recipientId) {
            return 'TargetChatRestricted';
        }
    } else if (candidateConversationId && snapshot?.SpaceChatsByConversationId) {
        const chat = snapshot.SpaceChatsByConversationId.get(candidateConversationId);
        if (!chat) {
            return 'TargetChatMissing';
        }
        if (normalizeNoticeUuid(chat.SpaceID) !== eventSpaceId || chat.Status === 'Archived') {
            return 'TargetChatRestricted';
        }
        if (chat.Kind === 'Private' && !reach.CanSeeTeam) {
            return 'TargetChatRestricted';
        }
        if (chat.Kind === 'Assistant' && normalizeNoticeUuid(chat.OwnerUserID) !== recipientId) {
            return 'TargetChatRestricted';
        }
    }

    // 3. SpaceNote verification (direct TargetEntityID = Space Notes, or ReferencedSpaceNoteID)
    const candidateSpaceNoteId =
        event.ReferencedSpaceNoteID ??
        parsedMeta.SpaceNoteID ??
        (targetEntityId === SPACE_NOTES_ENTITY_ID ? targetRecordUuid : null);

    if (candidateSpaceNoteId && snapshot?.SpaceNotesById) {
        const note = snapshot.SpaceNotesById.get(candidateSpaceNoteId);
        if (!note) {
            return 'TargetNoteMissing';
        }
        if (normalizeNoticeUuid(note.SpaceID) !== eventSpaceId) {
            return 'TargetNoteRestricted';
        }
        if (note.Visibility === 'Private' && normalizeNoticeUuid(note.AuthorUserID) !== recipientId) {
            return 'TargetNoteRestricted';
        }
        if (note.Band === 'Team' && !reach.CanSeeTeam) {
            return 'TargetNoteRestricted';
        }
    }

    return null;
}

/**
 * Fail-closed per-item reach and preference verification evaluated at digest assembly time.
 * Every space membership, status visibility, band, target item/chat/note reach,
 * join-time baseline, checkpoint cursor, mute, and event subscription rule is re-verified.
 */
export function verifyDigestItemReachForRecipient(input: {
    Event: DigestCandidateNotice;
    Recipient: DigestRecipientScopeAccess;
    TargetSpaceIDs?: ReadonlySet<string> | null;
    VerificationSnapshot?: DigestItemReachVerificationSnapshot;
    DigestPreferences?: CollaborationDigestPreferences;
    IncludeActor?: boolean;
}): { ok: true; item: DigestIncludedItem } | { ok: false; exclusion: DigestExcludedItemRecord } {
    const event = input.Event;
    const recipient = input.Recipient;
    const eventId = normalizeNoticeUuid(event.ID);
    const spaceId = normalizeNoticeUuid(event.SpaceID);
    const recipientId = normalizeNoticeUuid(recipient.UserID) ?? recipient.UserID;

    const fail = (reason: DigestItemExclusionReason): { ok: false; exclusion: DigestExcludedItemRecord } => ({
        ok: false,
        exclusion: {
            EventID: eventId ?? event.ID,
            SpaceID: spaceId ?? event.SpaceID,
            Reason: reason,
        },
    });

    if (!eventId || !spaceId || !isSpaceNoticeEventKind(event.EventKind) || !isSpaceNoticeBand(event.Band)) {
        return fail('InvalidEvent');
    }

    if (input.TargetSpaceIDs && input.TargetSpaceIDs.size > 0 && !input.TargetSpaceIDs.has(spaceId)) {
        return fail('NoSpaceReach');
    }

    const reach = recipient.ReachBySpace.get(spaceId);
    if (!reach) {
        return fail('NoSpaceReach');
    }

    if (reach.IsVisibleStatus === false && !reach.IsOwner) {
        return fail('HiddenSpace');
    }

    if (!isNoticeEventVisibleToMember({ SpaceID: spaceId, Band: event.Band }, reach)) {
        return fail('TeamBandRestricted');
    }

    const prefs = recipient.Preferences
        ? normalizeCollaborationNotificationPreferences(recipient.Preferences)
        : createDefaultCollaborationNotificationPreferences();
    const digestPrefs = input.DigestPreferences ?? resolveEffectiveDigestPreferences(prefs);

    if (digestPrefs.SpaceCadences?.[spaceId] === 'Off') {
        return fail('SpaceCadenceOff');
    }

    if (reach.MemberJoinedAt !== undefined && reach.MemberJoinedAt !== null) {
        const joinCursor: SpaceNoticeCursor = {
            EventTimestamp: reach.MemberJoinedAt,
            EventID: ZERO_NOTICE_UUID,
        };
        if (isNoticeAtOrBeforeCursor({ ID: eventId, EventTimestamp: event.EventTimestamp }, joinCursor)) {
            return fail('BeforeMemberJoined');
        }
    }

    if (recipient.Checkpoint) {
        const cpCursor: SpaceNoticeCursor = {
            EventTimestamp: recipient.Checkpoint.LastDeliveredTimestamp,
            EventID: normalizeNoticeUuid(recipient.Checkpoint.LastDeliveredRecordID) ?? ZERO_NOTICE_UUID,
        };
        if (isNoticeAtOrBeforeCursor({ ID: eventId, EventTimestamp: event.EventTimestamp }, cpCursor)) {
            return fail('AlreadyDelivered');
        }
    }

    const actorId = normalizeNoticeUuid(event.ActorUserID);
    if (!input.IncludeActor && actorId && actorId === recipientId) {
        return fail('ExcludedActor');
    }

    const spaceOverride = prefs.SpaceOverrides[spaceId];
    const explicitlyUnmuted = spaceOverride?.Muted === false;
    const isDirectlyMuted = prefs.MutedSpaceIDs.includes(spaceId) || spaceOverride?.Muted === true;
    const ancestors = recipient.AncestorSpaceIDsBySpace?.get(spaceId) ?? [];
    const isAncestorMuted =
        !explicitlyUnmuted &&
        ancestors.some((rawAncestor) => {
            const aid = normalizeNoticeUuid(rawAncestor);
            if (!aid) return false;
            return prefs.MutedSpaceIDs.includes(aid) || prefs.SpaceOverrides[aid]?.Muted === true;
        });
    if (isDirectlyMuted || isAncestorMuted) {
        return fail('SpaceMuted');
    }

    const parsedMeta = parseDigestTargetMetadata(event.MetadataJSON);
    const mutedMatch = matchesMutedItem(
        {
            TargetEntityID: event.TargetEntityID,
            TargetRecordID: event.TargetRecordID,
            ResourceRecordID: event.TargetRecordID,
            ResourceConfiguration: {
                ItemID: parsedMeta.ItemID ?? parsedMeta.SpaceItemID,
                TaskID: parsedMeta.TaskID,
                ConversationDetailID: parsedMeta.ConversationDetailID,
            },
        },
        prefs.MutedItemKeys,
    );
    if (mutedMatch) {
        return fail('ItemMuted');
    }

    if (isCollaborationNotificationEventType(event.EventKind)) {
        const sub = prefs.EventSubscriptions[event.EventKind];
        if (sub === false || (typeof sub === 'object' && sub !== null && sub.Enabled === false)) {
            return fail('EventTypeUnsubscribed');
        }
    }

    const targetFailure = resolveDigestCandidateVerification(
        event,
        recipient,
        reach,
        input.VerificationSnapshot,
        parsedMeta,
    );
    if (targetFailure) {
        return fail(targetFailure);
    }

    const parsedTs = parseNoticeTimestamp(event.EventTimestamp);
    const cleanTitle = stripRawMarkdownSyntaxForDigest(event.Title);
    const cleanBody = stripRawMarkdownSyntaxForDigest(event.Body);

    return {
        ok: true,
        item: {
            EventID: eventId,
            SpaceID: spaceId,
            SpaceName: event.SpaceName?.trim() || null,
            EventKind: event.EventKind,
            Band: event.Band,
            Title: cleanTitle || event.Title.trim(),
            Summary: cleanBody || null,
            EventTimestampIso: parsedTs.iso,
            TargetEntityID: normalizeNoticeUuid(event.TargetEntityID),
            TargetRecordID: event.TargetRecordID ?? null,
        },
    };
}

function buildDigestSummaryText(
    items: readonly DigestIncludedItem[],
    cadence: SpaceDigestCadence,
): { title: string; subject: string; message: string; spaceCount: number } {
    const spaceMap = new Map<string, { label: string; count: number; titles: string[] }>();
    for (const item of items) {
        const entry = spaceMap.get(item.SpaceID) ?? {
            label: item.SpaceName ?? `Space ${item.SpaceID.slice(0, 8)}`,
            count: 0,
            titles: [],
        };
        entry.count += 1;
        if (entry.titles.length < 3) {
            entry.titles.push(item.Title);
        }
        spaceMap.set(item.SpaceID, entry);
    }

    const spaceCount = spaceMap.size;
    const itemLabel = items.length === 1 ? '1 update' : `${items.length} updates`;
    const spaceLabel = spaceCount === 1 ? '1 space' : `${spaceCount} spaces`;
    const title = `${cadence} Collaboration Digest: ${itemLabel} across ${spaceLabel}`;
    const subject = title;

    const lines: string[] = [];
    for (const group of spaceMap.values()) {
        const groupCountLabel = group.count === 1 ? '1 update' : `${group.count} updates`;
        const preview = group.titles.join('; ');
        lines.push(`${group.label} (${groupCountLabel}): ${preview}`);
    }
    const message = lines.join(' | ');
    return { title, subject, message, spaceCount };
}

/**
 * Assembles a reach-verified scoped digest for a single recipient, enforcing:
 * - User active status, master opt-out, digest opt-out, cadence preference, and checkpoint pause
 * - Fail-closed per-item reach/band/target/mute verification at digest assembly time
 * - Strict empty-digest suppression whenever zero reach-verified items remain
 * - Channel preference & timezone-aware quiet-hour evaluation before Comms v2 dispatch.
 */
export function assembleScopedDigestForRecipient(
    input: AssembleDigestForRecipientInput,
): AssembleDigestForRecipientResult {
    const recipient = input.Recipient;
    const recipientId = normalizeNoticeUuid(recipient.UserID) ?? recipient.UserID;
    const scopedSpaceId = input.TargetSpaceID ? normalizeNoticeUuid(input.TargetSpaceID) : null;
    const nowUtc = input.NowUtc ?? new Date();

    const emptyResult = (
        reason: DigestSuppressionReason,
        opts?: {
            excluded?: DigestExcludedItemRecord[];
            highestObserved?: SpaceNoticeCursor | null;
            channelDecisions?: {
                permitted: CollaborationNotificationChannel[];
                suppressed: CommsV2SuppressedChannel[];
                channelReasons: NotificationSuppressionReason[];
                quietActive: boolean;
            };
        },
    ): AssembleDigestForRecipientResult => ({
        RecipientUserID: recipientId,
        Cadence: input.Cadence,
        SpaceID: scopedSpaceId,
        ShouldDeliver: false,
        SuppressionReason: reason,
        ChannelSuppressionReasons: opts?.channelDecisions?.channelReasons ?? [],
        PermittedChannels: opts?.channelDecisions?.permitted ?? [],
        SuppressedChannels: opts?.channelDecisions?.suppressed ?? [],
        QuietHoursActive: opts?.channelDecisions?.quietActive ?? false,
        Items: [],
        ExcludedItems: opts?.excluded ?? [],
        HighestObservedCursor: opts?.highestObserved ?? null,
        HighestIncludedCursor: null,
        Payload: null,
    });

    if (!recipient.IsActiveUser) {
        return emptyResult('UserInactive');
    }

    const prefs = recipient.Preferences
        ? normalizeCollaborationNotificationPreferences(recipient.Preferences)
        : createDefaultCollaborationNotificationPreferences();
    const mjPref = recipient.MJDigestPreference ?? null;
    const mjType = input.DigestNotificationTypeDefault ?? null;

    if (prefs.Enabled === false || mjPref?.Enabled === false) {
        return emptyResult('MasterDisabled');
    }

    const digestPrefs = resolveEffectiveDigestPreferences(prefs);
    if (!digestPrefs.Enabled) {
        return emptyResult('DigestOptedOut');
    }

    const effectiveCadence =
        (scopedSpaceId ? digestPrefs.SpaceCadences?.[scopedSpaceId] : undefined) ?? digestPrefs.Cadence;
    if (effectiveCadence === 'Off') {
        return emptyResult('DigestOptedOut');
    }
    if (!input.IgnoreCadenceFilter && effectiveCadence !== input.Cadence) {
        return emptyResult('CadenceMismatch');
    }

    const scheduleCheck = isDigestScheduleWindowDue({
        Cadence: input.Cadence,
        Checkpoint: recipient.Checkpoint,
        NowUtc: nowUtc,
        ForceWindow: input.ForceWindow,
        CustomIntervalMs: input.CustomIntervalMs,
    });
    if (!scheduleCheck.due) {
        return emptyResult(scheduleCheck.reason ?? 'WindowNotDue');
    }

    const sortedEvents = sortNoticeEventsByCompositeKeyset(input.Events);
    let highestObservedCursor: SpaceNoticeCursor | null = null;
    if (sortedEvents.length > 0) {
        const lastEv = sortedEvents[sortedEvents.length - 1];
        const lastId = normalizeNoticeUuid(lastEv.ID);
        if (lastId) {
            highestObservedCursor = {
                EventTimestamp: parseNoticeTimestamp(lastEv.EventTimestamp).iso,
                EventID: lastId,
            };
        }
    }

    const includedItems: DigestIncludedItem[] = [];
    const excludedItems: DigestExcludedItemRecord[] = [];
    let highestIncludedCursor: SpaceNoticeCursor | null = null;

    for (const ev of sortedEvents) {
        const verdict = verifyDigestItemReachForRecipient({
            Event: ev,
            Recipient: recipient,
            TargetSpaceIDs: input.TargetSpaceIDs,
            VerificationSnapshot: input.VerificationSnapshot,
            DigestPreferences: digestPrefs,
            IncludeActor: input.IncludeActor,
        });
        if (!verdict.ok) {
            excludedItems.push(verdict.exclusion);
            continue;
        }
        includedItems.push(verdict.item);
        highestIncludedCursor = {
            EventTimestamp: verdict.item.EventTimestampIso,
            EventID: verdict.item.EventID,
        };
    }

    // Strict empty-digest suppression: never dispatch a digest with zero verified items.
    if (includedItems.length === 0) {
        return emptyResult('EmptyDigest', {
            excluded: excludedItems,
            highestObserved: highestObservedCursor,
        });
    }

    // Evaluate Comms v2 delivery channels for the digest notification type.
    const allowUserPref = mjType ? mjType.AllowUserPreference !== false : true;
    const quiet = isWithinQuietHours(prefs.QuietHours, nowUtc, prefs.PreferredTimezone);
    const spaceChannelOverrides = scopedSpaceId ? prefs.SpaceOverrides[scopedSpaceId]?.Channels : undefined;

    const channelDecisions: Record<CollaborationNotificationChannel, CommsV2ChannelDecision> = {
        InApp: { Channel: 'InApp', Permitted: false, Reason: 'ChannelOptedOut' },
        Email: { Channel: 'Email', Permitted: false, Reason: 'ChannelOptedOut' },
        SMS: { Channel: 'SMS', Permitted: false, Reason: 'ChannelOptedOut' },
        Chat: { Channel: 'Chat', Permitted: false, Reason: 'ChannelOptedOut' },
    };
    const permittedChannels: CollaborationNotificationChannel[] = [];
    const suppressedChannels: CommsV2SuppressedChannel[] = [];
    const channelReasonsSet = new Set<NotificationSuppressionReason>();

    for (const channel of COLLABORATION_NOTIFICATION_CHANNELS) {
        let enabled = mjType
            ? resolveBaseChannelEnabled(channel, mjType)
            : channel === 'InApp' || channel === 'Email';

        if (allowUserPref) {
            const mjVal = readMJPreferenceChannel(channel, mjPref);
            if (mjVal !== null) enabled = mjVal;

            const globalPrefVal = prefs.Channels[channel];
            if (globalPrefVal !== null) enabled = globalPrefVal;

            const digestChannelVal = digestPrefs.Channels?.[channel];
            if (typeof digestChannelVal === 'boolean') enabled = digestChannelVal;

            const spaceOverrideVal = spaceChannelOverrides?.[channel];
            if (typeof spaceOverrideVal === 'boolean') enabled = spaceOverrideVal;
        }

        if (input.AllowedChannels && input.AllowedChannels[channel] === false) {
            enabled = false;
        }

        let suppressReason: NotificationSuppressionReason | null = null;
        if (!enabled) {
            suppressReason = 'ChannelOptedOut';
        } else if (!hasContactForChannel(channel, recipient)) {
            suppressReason = 'MissingContactAddress';
        } else if (quiet.active && quiet.suppressedChannels.has(channel)) {
            suppressReason = 'QuietHoursActive';
        }

        if (suppressReason === null) {
            channelDecisions[channel] = { Channel: channel, Permitted: true, Reason: null };
            permittedChannels.push(channel);
        } else {
            channelDecisions[channel] = { Channel: channel, Permitted: false, Reason: suppressReason };
            suppressedChannels.push({ Channel: channel, Reason: suppressReason });
            channelReasonsSet.add(suppressReason);
        }
    }

    if (permittedChannels.length === 0) {
        const primaryReason: DigestSuppressionReason = quiet.active
            ? 'QuietHoursActive'
            : channelReasonsSet.has('ChannelOptedOut')
              ? 'ChannelOptedOut'
              : 'MissingContactAddress';
        return {
            RecipientUserID: recipientId,
            Cadence: input.Cadence,
            SpaceID: scopedSpaceId,
            ShouldDeliver: false,
            SuppressionReason: primaryReason,
            ChannelSuppressionReasons: [...channelReasonsSet],
            PermittedChannels: [],
            SuppressedChannels: suppressedChannels,
            QuietHoursActive: quiet.active,
            Items: includedItems,
            ExcludedItems: excludedItems,
            HighestObservedCursor: highestObservedCursor,
            HighestIncludedCursor: highestIncludedCursor,
            Payload: null,
        };
    }

    const summary = buildDigestSummaryText(includedItems, input.Cadence);
    const primarySpaceId = scopedSpaceId ?? includedItems[0].SpaceID;
    const primarySpaceName = scopedSpaceId ? includedItems[0].SpaceName : null;
    const highestBand: SpaceNoticeBand = includedItems.some((item) => item.Band === 'Team') ? 'Team' : 'Shared';
    const recipientEmail = recipient.Email?.trim() || null;
    const recipientPhone = recipient.Phone?.trim() || null;
    const recipientChatHandle = recipient.ChatHandle?.trim() || recipientEmail;
    const nowIso = nowUtc.toISOString();

    const payload: CommsV2NotificationPayload = {
        EventType: 'Digest',
        NotificationTypeName: mjType?.Name ?? COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
        RecipientUserID: recipientId,
        RecipientEmail: recipientEmail,
        RecipientPhone: recipientPhone,
        RecipientChatHandle: recipientChatHandle,
        RecipientName: recipient.Name?.trim() || null,
        SpaceID: primarySpaceId,
        SpaceName: primarySpaceName,
        Band: highestBand,
        Title: summary.title,
        Subject: summary.subject,
        Message: summary.message,
        Channels: {
            InApp: channelDecisions.InApp.Permitted,
            Email: channelDecisions.Email.Permitted,
            SMS: channelDecisions.SMS.Permitted,
            Chat: channelDecisions.Chat.Permitted,
        },
        ResourceTypeID: COLLABORATION_SPACE_RESOURCE_TYPE_ID,
        ResourceRecordID: primarySpaceId,
        ResourceConfiguration: {
            SpaceID: primarySpaceId,
            EventType: 'Digest',
        },
        TemplateData: {
            EventType: 'Digest',
            NotificationTypeName: mjType?.Name ?? COLLABORATION_DIGEST_NOTIFICATION_TYPE_NAME,
            Cadence: input.Cadence,
            SpaceID: primarySpaceId,
            SpaceName: primarySpaceName,
            ItemCount: includedItems.length,
            SpaceCount: summary.spaceCount,
            RecipientUserID: recipientId,
            RecipientName: recipient.Name?.trim() || null,
            Title: summary.title,
            Body: summary.message,
            OccurredAtIso: nowIso,
            CursorTimestamp: highestIncludedCursor?.EventTimestamp
                ? String(highestIncludedCursor.EventTimestamp)
                : nowIso,
            CursorEventID: highestIncludedCursor?.EventID ?? null,
        },
        OccurredAtIso: nowIso,
    };

    return {
        RecipientUserID: recipientId,
        Cadence: input.Cadence,
        SpaceID: scopedSpaceId,
        ShouldDeliver: true,
        SuppressionReason: null,
        ChannelSuppressionReasons: [...channelReasonsSet],
        PermittedChannels: permittedChannels,
        SuppressedChannels: suppressedChannels,
        QuietHoursActive: quiet.active,
        Items: includedItems,
        ExcludedItems: excludedItems,
        HighestObservedCursor: highestObservedCursor,
        HighestIncludedCursor: highestIncludedCursor,
        Payload: payload,
    };
}

/**
 * Computes whether and how a `SpaceDigestCheckpoint` should monotonically advance
 * after a digest assembly/dispatch attempt completes.
 */
export function computeNextDigestCheckpoint(input: {
    CurrentCheckpoint?: SpaceDigestCheckpointRecord | null;
    CandidateCursor: SpaceNoticeCursor | null;
    ItemsIncludedCount: number;
    DispatchSucceeded: boolean;
    AllowAdvanceOnEmpty?: boolean;
}): {
    shouldPersist: boolean;
    nextTimestamp: string | null;
    nextRecordId: string | null;
    itemsIncludedCount: number;
} {
    if (!input.DispatchSucceeded && input.ItemsIncludedCount > 0) {
        return { shouldPersist: false, nextTimestamp: null, nextRecordId: null, itemsIncludedCount: 0 };
    }
    if (input.ItemsIncludedCount === 0 && !input.AllowAdvanceOnEmpty) {
        return { shouldPersist: false, nextTimestamp: null, nextRecordId: null, itemsIncludedCount: 0 };
    }
    if (!input.CandidateCursor) {
        return { shouldPersist: false, nextTimestamp: null, nextRecordId: null, itemsIncludedCount: 0 };
    }

    const currentCursor: SpaceNoticeCursor | null = input.CurrentCheckpoint
        ? {
              EventTimestamp: input.CurrentCheckpoint.LastDeliveredTimestamp,
              EventID: normalizeNoticeUuid(input.CurrentCheckpoint.LastDeliveredRecordID) ?? ZERO_NOTICE_UUID,
          }
        : null;

    if (!shouldAdvanceWatermark(currentCursor, input.CandidateCursor)) {
        return { shouldPersist: false, nextTimestamp: null, nextRecordId: null, itemsIncludedCount: 0 };
    }

    const parsedTs = parseNoticeTimestamp(input.CandidateCursor.EventTimestamp);
    const cleanId = normalizeNoticeUuid(input.CandidateCursor.EventID);

    return {
        shouldPersist: true,
        nextTimestamp: parsedTs.iso,
        nextRecordId: cleanId,
        itemsIncludedCount: Math.max(0, Math.floor(input.ItemsIncludedCount)),
    };
}
