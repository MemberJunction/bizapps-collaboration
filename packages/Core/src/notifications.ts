/**
 * Pure NT-1 Comms v2 Notification Routing & User Notification Preference domain rules.
 *
 * Zero MemberJunction or database imports so preference evaluation, timezone-aware
 * quiet-hour windows, muted space/item overrides, and strictly typed Comms v2 payload
 * construction run identically in the browser, server, and `node:test`.
 */

import { isSpaceNoticeBand, normalizeNoticeUuid, type SpaceNoticeBand } from './space-notices.ts';

export const NT1_NOTIFICATION_EVENT_TYPES = [
    'Mention',
    'Reply',
    'Share',
    'StatusChanged',
    'Task',
    'Approval',
] as const;

export type CollaborationNotificationEventType = (typeof NT1_NOTIFICATION_EVENT_TYPES)[number];

export const COLLABORATION_NOTIFICATION_CHANNELS = ['InApp', 'Email', 'SMS', 'Chat'] as const;

export type CollaborationNotificationChannel = (typeof COLLABORATION_NOTIFICATION_CHANNELS)[number];

export const COLLABORATION_NOTIFICATION_PREFERENCES_SETTING_KEY = 'Collaboration.NotificationPreferences';

export const COLLABORATION_SPACE_RESOURCE_TYPE_ID = '33642155-617E-4825-A2CC-F071A60F3739';

export const NT1_NOTIFICATION_TYPE_NAMES: Readonly<Record<CollaborationNotificationEventType, string>> = {
    Mention: 'Collaboration: Mention',
    Reply: 'Collaboration: Reply',
    Share: 'Collaboration Share',
    StatusChanged: 'Collaboration: Space Status Changed',
    Task: 'Collaboration: Task',
    Approval: 'Collaboration: Approval',
};

export type NotificationSuppressionReason =
    | 'NoSpaceReach'
    | 'ExcludedActor'
    | 'MasterDisabled'
    | 'EventTypeUnsubscribed'
    | 'SpaceMuted'
    | 'ItemMuted'
    | 'QuietHoursActive'
    | 'ChannelOptedOut'
    | 'MissingContactAddress';

export interface CollaborationChannelPreferences {
    InApp?: boolean | null;
    Email?: boolean | null;
    SMS?: boolean | null;
    Chat?: boolean | null;
}

export interface CollaborationQuietHoursPreference {
    Enabled: boolean;
    /** 24-hour local start time (`HH:mm`), e.g. `22:00`. */
    StartTime: string;
    /** 24-hour local end time (`HH:mm`), e.g. `07:00`. Supports windows wrapping across midnight. */
    EndTime: string;
    /** IANA timezone identifier, e.g. `America/Chicago` or `UTC`. */
    Timezone: string;
    /** Channels suppressed during active quiet hours. Defaults to `['Email', 'SMS', 'Chat']`. */
    SuppressedChannels?: readonly CollaborationNotificationChannel[];
}

export interface CollaborationEventSubscriptionPreference {
    Enabled: boolean;
    Channels?: CollaborationChannelPreferences;
}

export interface CollaborationScopeMuteOverride {
    Muted?: boolean;
    Channels?: CollaborationChannelPreferences;
}

export interface CollaborationUserNotificationPreferences {
    Enabled: boolean;
    Channels: {
        InApp: boolean | null;
        Email: boolean | null;
        SMS: boolean | null;
        Chat: boolean | null;
    };
    EventSubscriptions: Partial<Record<CollaborationNotificationEventType, boolean | CollaborationEventSubscriptionPreference>>;
    QuietHours: CollaborationQuietHoursPreference | null;
    MutedSpaceIDs: readonly string[];
    MutedItemKeys: readonly string[];
    SpaceOverrides: Readonly<Record<string, CollaborationScopeMuteOverride>>;
    PreferredTimezone: string | null;
}

export interface CollaborationUserNotificationPreferencesPatch {
    Enabled?: boolean;
    Channels?: CollaborationChannelPreferences;
    EventSubscriptions?: Partial<Record<CollaborationNotificationEventType, boolean | CollaborationEventSubscriptionPreference | null>>;
    QuietHours?: CollaborationQuietHoursPreference | null;
    MutedSpaceIDs?: readonly string[];
    MuteSpaceIDsToAdd?: readonly string[];
    MuteSpaceIDsToRemove?: readonly string[];
    MutedItemKeys?: readonly string[];
    MuteItemKeysToAdd?: readonly string[];
    MuteItemKeysToRemove?: readonly string[];
    SpaceOverrides?: Readonly<Record<string, CollaborationScopeMuteOverride | null>>;
    PreferredTimezone?: string | null;
}

export interface CollaborationNotificationResourceConfig {
    SpaceID?: string;
    EventType?: CollaborationNotificationEventType;
    ConversationID?: string | null;
    ConversationDetailID?: string | null;
    TaskID?: string | null;
    ItemID?: string | null;
    TargetEntityID?: string | null;
    TargetRecordID?: string | null;
    DeepLinkUrl?: string | null;
}

export interface CollaborationNotificationMetadata {
    FromStatus?: string | null;
    ToStatus?: string | null;
    TaskStatus?: string | null;
    ApprovalOutcome?: string | null;
    MentionExcerpt?: string | null;
    ReplyExcerpt?: string | null;
    ItemName?: string | null;
    DeepLinkUrl?: string | null;
}

export interface CollaborationNotificationEvent {
    EventType: CollaborationNotificationEventType;
    SpaceID: string;
    SpaceName?: string | null;
    Band: SpaceNoticeBand;
    ActorUserID?: string | null;
    ActorName?: string | null;
    Title: string;
    Body?: string | null;
    TargetEntityID?: string | null;
    TargetRecordID?: string | null;
    ResourceTypeID?: string | null;
    ResourceRecordID?: string | null;
    ResourceConfiguration?: CollaborationNotificationResourceConfig | null;
    Metadata?: CollaborationNotificationMetadata | null;
    OccurredAt?: string | Date;
    NotificationTypeNameOverride?: string | null;
    /** Subtractive channel ceiling (explicit `false` disables a channel; `true`/`undefined` defers to preferences). */
    AllowedChannels?: Partial<Record<CollaborationNotificationChannel, boolean>>;
}

export interface MJNotificationTypeDefaultSnapshot {
    ID: string;
    Name: string;
    DefaultInApp: boolean;
    DefaultEmail: boolean;
    DefaultSMS: boolean;
    AllowUserPreference: boolean;
}

export interface MJUserNotificationPreferenceSnapshot {
    UserID: string;
    NotificationTypeID: string;
    Enabled: boolean | null;
    InAppEnabled: boolean | null;
    EmailEnabled: boolean | null;
    SMSEnabled: boolean | null;
}

export interface CollaborationRecipientCandidate {
    UserID: string;
    Name?: string | null;
    Email?: string | null;
    Phone?: string | null;
    ChatHandle?: string | null;
    HasSpaceReach: boolean;
    CanSeeTeamBand: boolean;
    Preferences?: CollaborationUserNotificationPreferences | null;
    MJPreferenceRow?: MJUserNotificationPreferenceSnapshot | null;
}

export type CommsV2TemplateScalar = string | number | boolean | null;
export type CommsV2TemplateData = Record<string, CommsV2TemplateScalar>;

export interface CommsV2NotificationPayload {
    EventType: CollaborationNotificationEventType;
    NotificationTypeName: string;
    RecipientUserID: string;
    RecipientEmail: string | null;
    RecipientPhone: string | null;
    RecipientChatHandle: string | null;
    RecipientName: string | null;
    SpaceID: string;
    SpaceName: string | null;
    Band: SpaceNoticeBand;
    Title: string;
    Subject: string;
    Message: string;
    Channels: {
        InApp: boolean;
        Email: boolean;
        SMS: boolean;
        Chat: boolean;
    };
    ResourceTypeID: string;
    ResourceRecordID: string;
    ResourceConfiguration: CollaborationNotificationResourceConfig;
    TemplateData: CommsV2TemplateData;
    OccurredAtIso: string;
}

export interface CommsV2ChannelDecision {
    Channel: CollaborationNotificationChannel;
    Permitted: boolean;
    Reason: NotificationSuppressionReason | null;
}

export interface CommsV2SuppressedChannel {
    Channel: CollaborationNotificationChannel;
    Reason: NotificationSuppressionReason;
}

export interface CommsV2RecipientEvaluationResult {
    RecipientUserID: string;
    Permitted: boolean;
    PermittedChannels: CollaborationNotificationChannel[];
    SuppressedChannels: CommsV2SuppressedChannel[];
    ChannelDecisions: Readonly<Record<CollaborationNotificationChannel, CommsV2ChannelDecision>>;
    SuppressionReasons: NotificationSuppressionReason[];
    QuietHoursActive: boolean;
    Payload: CommsV2NotificationPayload | null;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
    [key: string]: JsonValue | undefined;
}

const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isCollaborationNotificationEventType(
    value: string | null | undefined,
): value is CollaborationNotificationEventType {
    if (typeof value !== 'string') {
        return false;
    }
    return (NT1_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

export function isCollaborationNotificationChannel(
    value: string | null | undefined,
): value is CollaborationNotificationChannel {
    if (typeof value !== 'string') {
        return false;
    }
    return (COLLABORATION_NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

export function createDefaultCollaborationNotificationPreferences(): CollaborationUserNotificationPreferences {
    return {
        Enabled: true,
        Channels: {
            InApp: null,
            Email: null,
            SMS: null,
            Chat: null,
        },
        EventSubscriptions: {},
        QuietHours: null,
        MutedSpaceIDs: [],
        MutedItemKeys: [],
        SpaceOverrides: {},
        PreferredTimezone: null,
    };
}

function asJsonObject(value: JsonValue | undefined): JsonObject | null {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return null;
}

function readOptionalBooleanOrNull(value: JsonValue | undefined): boolean | null | undefined {
    if (value === null) return null;
    if (typeof value === 'boolean') return value;
    return undefined;
}

function normalizeChannelPrefs(input: CollaborationChannelPreferences | undefined | null): {
    InApp: boolean | null;
    Email: boolean | null;
    SMS: boolean | null;
    Chat: boolean | null;
} {
    return {
        InApp: typeof input?.InApp === 'boolean' ? input.InApp : null,
        Email: typeof input?.Email === 'boolean' ? input.Email : null,
        SMS: typeof input?.SMS === 'boolean' ? input.SMS : null,
        Chat: typeof input?.Chat === 'boolean' ? input.Chat : null,
    };
}

function normalizeSparseChannelPrefs(
    input: CollaborationChannelPreferences | undefined | null,
): CollaborationChannelPreferences | undefined {
    if (!input) return undefined;
    const out: CollaborationChannelPreferences = {};
    let hasKey = false;
    for (const ch of COLLABORATION_NOTIFICATION_CHANNELS) {
        const val = input[ch];
        if (typeof val === 'boolean' || val === null) {
            out[ch] = val;
            hasKey = true;
        }
    }
    return hasKey ? out : undefined;
}

function normalizeMutedItemKey(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const uuid = normalizeNoticeUuid(trimmed);
    if (uuid) return uuid;
    const pipeIdx = trimmed.indexOf('|');
    if (pipeIdx > 0) {
        const left = trimmed.slice(0, pipeIdx).trim().toLowerCase();
        const right = trimmed.slice(pipeIdx + 1).trim().toLowerCase();
        if (left && right) {
            return `${left}|${right}`;
        }
    }
    return trimmed.toLowerCase();
}

export function buildMutedItemKey(
    targetEntityId: string | null | undefined,
    targetRecordId: string | null | undefined,
): string | null {
    const cleanRecord = normalizeMutedItemKey(targetRecordId);
    if (!cleanRecord) return null;
    const cleanEntity = normalizeNoticeUuid(targetEntityId) ?? targetEntityId?.trim().toLowerCase() ?? null;
    return cleanEntity ? `${cleanEntity}|${cleanRecord}` : cleanRecord;
}

function normalizeQuietHours(input: CollaborationQuietHoursPreference | null | undefined): CollaborationQuietHoursPreference | null {
    if (!input) return null;
    const startMin = parseTimeOfDayMinutes(input.StartTime);
    const endMin = parseTimeOfDayMinutes(input.EndTime);
    if (startMin === null || endMin === null) {
        return null;
    }
    const timezone = typeof input.Timezone === 'string' && input.Timezone.trim() ? input.Timezone.trim() : 'UTC';
    const suppressed =
        Array.isArray(input.SuppressedChannels) && input.SuppressedChannels.length > 0
            ? [...new Set(input.SuppressedChannels.filter((c): c is CollaborationNotificationChannel => isCollaborationNotificationChannel(c)))]
            : (['Email', 'SMS', 'Chat'] as CollaborationNotificationChannel[]);
    return {
        Enabled: Boolean(input.Enabled),
        StartTime: input.StartTime.trim(),
        EndTime: input.EndTime.trim(),
        Timezone: timezone,
        SuppressedChannels: suppressed,
    };
}

export function normalizeCollaborationNotificationPreferences(
    input: Partial<CollaborationUserNotificationPreferences> | null | undefined,
): CollaborationUserNotificationPreferences {
    const defaults = createDefaultCollaborationNotificationPreferences();
    if (!input) return defaults;

    const mutedSpacesSet = new Set<string>();
    for (const raw of input.MutedSpaceIDs ?? []) {
        const clean = normalizeNoticeUuid(raw);
        if (clean) mutedSpacesSet.add(clean);
    }

    const mutedItemsSet = new Set<string>();
    for (const raw of input.MutedItemKeys ?? []) {
        const clean = normalizeMutedItemKey(raw);
        if (clean) mutedItemsSet.add(clean);
    }

    const eventSubscriptions: Partial<
        Record<CollaborationNotificationEventType, boolean | CollaborationEventSubscriptionPreference>
    > = {};
    if (input.EventSubscriptions) {
        for (const eventType of NT1_NOTIFICATION_EVENT_TYPES) {
            const sub = input.EventSubscriptions[eventType];
            if (typeof sub === 'boolean') {
                eventSubscriptions[eventType] = sub;
            } else if (sub && typeof sub === 'object') {
                const channels = normalizeSparseChannelPrefs(sub.Channels);
                eventSubscriptions[eventType] = channels
                    ? { Enabled: sub.Enabled !== false, Channels: channels }
                    : { Enabled: sub.Enabled !== false };
            }
        }
    }

    const spaceOverrides: Record<string, CollaborationScopeMuteOverride> = {};
    if (input.SpaceOverrides) {
        for (const [rawSpaceId, override] of Object.entries(input.SpaceOverrides)) {
            const cleanSpaceId = normalizeNoticeUuid(rawSpaceId);
            if (!cleanSpaceId || !override) continue;
            const channels = normalizeSparseChannelPrefs(override.Channels);
            const normalizedOverride: CollaborationScopeMuteOverride = {};
            if (typeof override.Muted === 'boolean') {
                normalizedOverride.Muted = override.Muted;
            }
            if (channels) {
                normalizedOverride.Channels = channels;
            }
            if (normalizedOverride.Muted !== undefined || normalizedOverride.Channels !== undefined) {
                spaceOverrides[cleanSpaceId] = normalizedOverride;
            }
        }
    }

    const tz = typeof input.PreferredTimezone === 'string' && input.PreferredTimezone.trim()
        ? input.PreferredTimezone.trim()
        : null;

    return {
        Enabled: input.Enabled !== false,
        Channels: normalizeChannelPrefs(input.Channels),
        EventSubscriptions: eventSubscriptions,
        QuietHours: normalizeQuietHours(input.QuietHours),
        MutedSpaceIDs: [...mutedSpacesSet],
        MutedItemKeys: [...mutedItemsSet],
        SpaceOverrides: spaceOverrides,
        PreferredTimezone: tz,
    };
}

function parseJsonChannelPrefs(obj: JsonObject | null): CollaborationChannelPreferences | undefined {
    if (!obj) return undefined;
    const result: CollaborationChannelPreferences = {};
    let hasValue = false;
    for (const ch of COLLABORATION_NOTIFICATION_CHANNELS) {
        const v = readOptionalBooleanOrNull(obj[ch]);
        if (v !== undefined) {
            result[ch] = v;
            hasValue = true;
        }
    }
    return hasValue ? result : undefined;
}

export function parseCollaborationNotificationPreferences(
    raw: string | null | undefined,
): CollaborationUserNotificationPreferences {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
        return createDefaultCollaborationNotificationPreferences();
    }
    let parsed: JsonValue;
    try {
        parsed = JSON.parse(raw) as JsonValue;
    } catch {
        return createDefaultCollaborationNotificationPreferences();
    }
    const root = asJsonObject(parsed);
    if (!root) {
        return createDefaultCollaborationNotificationPreferences();
    }

    const channelsObj = asJsonObject(root['Channels']);
    const channels = normalizeChannelPrefs(parseJsonChannelPrefs(channelsObj));

    const eventSubscriptions: Partial<
        Record<CollaborationNotificationEventType, boolean | CollaborationEventSubscriptionPreference>
    > = {};
    const subsObj = asJsonObject(root['EventSubscriptions']);
    if (subsObj) {
        for (const eventType of NT1_NOTIFICATION_EVENT_TYPES) {
            const rawSub = subsObj[eventType];
            if (typeof rawSub === 'boolean') {
                eventSubscriptions[eventType] = rawSub;
            } else {
                const subObj = asJsonObject(rawSub);
                if (subObj) {
                    const subChannels = parseJsonChannelPrefs(asJsonObject(subObj['Channels']));
                    eventSubscriptions[eventType] = subChannels
                        ? { Enabled: subObj['Enabled'] !== false, Channels: subChannels }
                        : { Enabled: subObj['Enabled'] !== false };
                }
            }
        }
    }

    let quietHours: CollaborationQuietHoursPreference | null = null;
    const qhObj = asJsonObject(root['QuietHours']);
    if (qhObj) {
        const start = typeof qhObj['StartTime'] === 'string' ? qhObj['StartTime'] : '';
        const end = typeof qhObj['EndTime'] === 'string' ? qhObj['EndTime'] : '';
        const tz = typeof qhObj['Timezone'] === 'string' ? qhObj['Timezone'] : 'UTC';
        const suppressedRaw = Array.isArray(qhObj['SuppressedChannels']) ? qhObj['SuppressedChannels'] : [];
        const suppressed: CollaborationNotificationChannel[] = [];
        for (const entry of suppressedRaw) {
            if (typeof entry === 'string' && isCollaborationNotificationChannel(entry)) {
                suppressed.push(entry);
            }
        }
        quietHours = normalizeQuietHours({
            Enabled: qhObj['Enabled'] === true,
            StartTime: start,
            EndTime: end,
            Timezone: tz,
            ...(suppressed.length > 0 ? { SuppressedChannels: suppressed } : {}),
        });
    }

    const mutedSpaces: string[] = [];
    if (Array.isArray(root['MutedSpaceIDs'])) {
        for (const entry of root['MutedSpaceIDs']) {
            if (typeof entry === 'string') {
                mutedSpaces.push(entry);
            }
        }
    }

    const mutedItems: string[] = [];
    if (Array.isArray(root['MutedItemKeys'])) {
        for (const entry of root['MutedItemKeys']) {
            if (typeof entry === 'string') {
                mutedItems.push(entry);
            }
        }
    }

    const spaceOverrides: Record<string, CollaborationScopeMuteOverride> = {};
    const overridesObj = asJsonObject(root['SpaceOverrides']);
    if (overridesObj) {
        for (const [spaceId, val] of Object.entries(overridesObj)) {
            const ovObj = asJsonObject(val);
            if (!ovObj) continue;
            const ovChannels = parseJsonChannelPrefs(asJsonObject(ovObj['Channels']));
            spaceOverrides[spaceId] = {
                ...(typeof ovObj['Muted'] === 'boolean' ? { Muted: ovObj['Muted'] } : {}),
                ...(ovChannels ? { Channels: ovChannels } : {}),
            };
        }
    }

    return normalizeCollaborationNotificationPreferences({
        Enabled: root['Enabled'] !== false,
        Channels: channels,
        EventSubscriptions: eventSubscriptions,
        QuietHours: quietHours,
        MutedSpaceIDs: mutedSpaces,
        MutedItemKeys: mutedItems,
        SpaceOverrides: spaceOverrides,
        PreferredTimezone: typeof root['PreferredTimezone'] === 'string' ? root['PreferredTimezone'] : null,
    });
}

export function serializeCollaborationNotificationPreferences(
    preferences: CollaborationUserNotificationPreferences,
): string {
    return JSON.stringify(normalizeCollaborationNotificationPreferences(preferences));
}

export function mergeCollaborationNotificationPreferences(
    current: CollaborationUserNotificationPreferences,
    patch: CollaborationUserNotificationPreferencesPatch,
): CollaborationUserNotificationPreferences {
    const base = normalizeCollaborationNotificationPreferences(current);

    const nextChannels = {
        InApp: patch.Channels?.InApp !== undefined ? patch.Channels.InApp : base.Channels.InApp,
        Email: patch.Channels?.Email !== undefined ? patch.Channels.Email : base.Channels.Email,
        SMS: patch.Channels?.SMS !== undefined ? patch.Channels.SMS : base.Channels.SMS,
        Chat: patch.Channels?.Chat !== undefined ? patch.Channels.Chat : base.Channels.Chat,
    };

    const nextSubs: Partial<
        Record<CollaborationNotificationEventType, boolean | CollaborationEventSubscriptionPreference>
    > = { ...base.EventSubscriptions };
    if (patch.EventSubscriptions) {
        for (const eventType of NT1_NOTIFICATION_EVENT_TYPES) {
            const val = patch.EventSubscriptions[eventType];
            if (val === null) {
                delete nextSubs[eventType];
            } else if (val !== undefined) {
                nextSubs[eventType] = val;
            }
        }
    }

    const mutedSpaces = new Set<string>(
        patch.MutedSpaceIDs !== undefined
            ? patch.MutedSpaceIDs.map((s) => normalizeNoticeUuid(s)).filter((s): s is string => s !== null)
            : base.MutedSpaceIDs,
    );
    for (const s of patch.MuteSpaceIDsToAdd ?? []) {
        const clean = normalizeNoticeUuid(s);
        if (clean) mutedSpaces.add(clean);
    }
    for (const s of patch.MuteSpaceIDsToRemove ?? []) {
        const clean = normalizeNoticeUuid(s);
        if (clean) mutedSpaces.delete(clean);
    }

    const mutedItems = new Set<string>(
        patch.MutedItemKeys !== undefined
            ? patch.MutedItemKeys.map((k) => normalizeMutedItemKey(k)).filter((k): k is string => k !== null)
            : base.MutedItemKeys,
    );
    for (const k of patch.MuteItemKeysToAdd ?? []) {
        const clean = normalizeMutedItemKey(k);
        if (clean) mutedItems.add(clean);
    }
    for (const k of patch.MuteItemKeysToRemove ?? []) {
        const clean = normalizeMutedItemKey(k);
        if (clean) mutedItems.delete(clean);
    }

    const nextSpaceOverrides: Record<string, CollaborationScopeMuteOverride> = { ...base.SpaceOverrides };
    if (patch.SpaceOverrides) {
        for (const [rawId, ov] of Object.entries(patch.SpaceOverrides)) {
            const cleanId = normalizeNoticeUuid(rawId);
            if (!cleanId) continue;
            if (ov === null) {
                delete nextSpaceOverrides[cleanId];
            } else {
                nextSpaceOverrides[cleanId] = ov;
            }
        }
    }

    return normalizeCollaborationNotificationPreferences({
        Enabled: patch.Enabled !== undefined ? patch.Enabled : base.Enabled,
        Channels: nextChannels,
        EventSubscriptions: nextSubs,
        QuietHours: patch.QuietHours !== undefined ? patch.QuietHours : base.QuietHours,
        MutedSpaceIDs: [...mutedSpaces],
        MutedItemKeys: [...mutedItems],
        SpaceOverrides: nextSpaceOverrides,
        PreferredTimezone:
            patch.PreferredTimezone !== undefined ? patch.PreferredTimezone : base.PreferredTimezone,
    });
}

export function parseTimeOfDayMinutes(hhmm: string): number | null {
    if (typeof hhmm !== 'string') return null;
    const match = TIME_HHMM_REGEX.exec(hhmm.trim());
    if (!match) return null;
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    return hours * 60 + minutes;
}

export function resolveLocalMinutesInTimezone(
    nowUtc: Date,
    timezone: string | null | undefined,
): { minutesSinceMidnight: number; resolvedTimezone: string } {
    const candidateTz = typeof timezone === 'string' && timezone.trim() ? timezone.trim() : 'UTC';
    const tryFormat = (tz: string): number | null => {
        try {
            const fmt = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hourCycle: 'h23',
                hour: '2-digit',
                minute: '2-digit',
            });
            const parts = fmt.formatToParts(nowUtc);
            const hourPart = parts.find((p) => p.type === 'hour')?.value;
            const minPart = parts.find((p) => p.type === 'minute')?.value;
            if (hourPart === undefined || minPart === undefined) return null;
            const hour = Number.parseInt(hourPart, 10) % 24;
            const minute = Number.parseInt(minPart, 10);
            if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
            return hour * 60 + minute;
        } catch {
            return null;
        }
    };

    const resolved = tryFormat(candidateTz);
    if (resolved !== null) {
        return { minutesSinceMidnight: resolved, resolvedTimezone: candidateTz };
    }
    const utcFallback = tryFormat('UTC') ?? nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
    return { minutesSinceMidnight: utcFallback, resolvedTimezone: 'UTC' };
}

export function isWithinQuietHours(
    quietHours: CollaborationQuietHoursPreference | null | undefined,
    nowUtc: Date,
    fallbackTimezone?: string | null,
): {
    active: boolean;
    resolvedTimezone: string;
    suppressedChannels: ReadonlySet<CollaborationNotificationChannel>;
} {
    const defaultSuppressed = new Set<CollaborationNotificationChannel>(['Email', 'SMS', 'Chat']);
    if (!quietHours || !quietHours.Enabled) {
        return {
            active: false,
            resolvedTimezone: fallbackTimezone?.trim() || 'UTC',
            suppressedChannels: defaultSuppressed,
        };
    }

    const startMinutes = parseTimeOfDayMinutes(quietHours.StartTime);
    const endMinutes = parseTimeOfDayMinutes(quietHours.EndTime);
    if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
        return {
            active: false,
            resolvedTimezone: quietHours.Timezone || fallbackTimezone || 'UTC',
            suppressedChannels: defaultSuppressed,
        };
    }

    const suppressedList =
        quietHours.SuppressedChannels && quietHours.SuppressedChannels.length > 0
            ? quietHours.SuppressedChannels
            : (['Email', 'SMS', 'Chat'] as const);
    const suppressedChannels = new Set<CollaborationNotificationChannel>(suppressedList);

    const targetTz = quietHours.Timezone?.trim() || fallbackTimezone?.trim() || 'UTC';
    const { minutesSinceMidnight, resolvedTimezone } = resolveLocalMinutesInTimezone(nowUtc, targetTz);

    const active =
        startMinutes < endMinutes
            ? minutesSinceMidnight >= startMinutes && minutesSinceMidnight < endMinutes
            : minutesSinceMidnight >= startMinutes || minutesSinceMidnight < endMinutes;

    return { active, resolvedTimezone, suppressedChannels };
}

function resolveNotificationTypeName(event: CollaborationNotificationEvent): string {
    const override = event.NotificationTypeNameOverride?.trim();
    if (override) return override;
    return NT1_NOTIFICATION_TYPE_NAMES[event.EventType];
}

function resolveOccurredAtIso(occurredAt: string | Date | undefined): string {
    if (!occurredAt) return new Date().toISOString();
    const d = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildCommsV2NotificationPayload(params: {
    Event: CollaborationNotificationEvent;
    Recipient: CollaborationRecipientCandidate;
    Channels: { InApp: boolean; Email: boolean; SMS: boolean; Chat: boolean };
    NotificationTypeName?: string;
}): CommsV2NotificationPayload {
    const event = params.Event;
    const recipient = params.Recipient;
    const spaceId = normalizeNoticeUuid(event.SpaceID) ?? event.SpaceID;
    const resourceTypeId = normalizeNoticeUuid(event.ResourceTypeID) ?? COLLABORATION_SPACE_RESOURCE_TYPE_ID;
    const resourceRecordId = event.ResourceRecordID?.trim() || spaceId;
    const occurredAtIso = resolveOccurredAtIso(event.OccurredAt);
    const notificationTypeName = params.NotificationTypeName ?? resolveNotificationTypeName(event);
    const cleanTitle = event.Title.trim();
    const messageBody = (event.Body ?? '').trim() || cleanTitle;
    const spaceName = event.SpaceName?.trim() || null;
    const actorName = event.ActorName?.trim() || null;
    const subject = spaceName ? `[${spaceName}] ${cleanTitle}` : cleanTitle;

    const resourceConfiguration: CollaborationNotificationResourceConfig = {
        SpaceID: spaceId,
        EventType: event.EventType,
        ...(event.ResourceConfiguration ?? {}),
        ...(event.TargetEntityID && !event.ResourceConfiguration?.TargetEntityID
            ? { TargetEntityID: event.TargetEntityID }
            : {}),
        ...(event.TargetRecordID && !event.ResourceConfiguration?.TargetRecordID
            ? { TargetRecordID: event.TargetRecordID }
            : {}),
        ...(event.Metadata?.DeepLinkUrl && !event.ResourceConfiguration?.DeepLinkUrl
            ? { DeepLinkUrl: event.Metadata.DeepLinkUrl }
            : {}),
    };

    const templateData: CommsV2TemplateData = {
        EventType: event.EventType,
        NotificationTypeName: notificationTypeName,
        SpaceID: spaceId,
        SpaceName: spaceName,
        Band: event.Band,
        ActorUserID: normalizeNoticeUuid(event.ActorUserID),
        ActorName: actorName,
        RecipientUserID: normalizeNoticeUuid(recipient.UserID) ?? recipient.UserID,
        RecipientName: recipient.Name?.trim() || null,
        Title: cleanTitle,
        Body: messageBody,
        OccurredAtIso: occurredAtIso,
        TargetEntityID: normalizeNoticeUuid(event.TargetEntityID),
        TargetRecordID: event.TargetRecordID ?? null,
        FromStatus: event.Metadata?.FromStatus ?? null,
        ToStatus: event.Metadata?.ToStatus ?? null,
        TaskStatus: event.Metadata?.TaskStatus ?? null,
        ApprovalOutcome: event.Metadata?.ApprovalOutcome ?? null,
        MentionExcerpt: event.Metadata?.MentionExcerpt ?? null,
        ReplyExcerpt: event.Metadata?.ReplyExcerpt ?? null,
        ItemName: event.Metadata?.ItemName ?? null,
        DeepLinkUrl: event.Metadata?.DeepLinkUrl ?? resourceConfiguration.DeepLinkUrl ?? null,
    };

    const recipientEmail = recipient.Email?.trim() || null;
    const recipientPhone = recipient.Phone?.trim() || null;
    const recipientChatHandle = recipient.ChatHandle?.trim() || recipientEmail;

    return {
        EventType: event.EventType,
        NotificationTypeName: notificationTypeName,
        RecipientUserID: normalizeNoticeUuid(recipient.UserID) ?? recipient.UserID,
        RecipientEmail: recipientEmail,
        RecipientPhone: recipientPhone,
        RecipientChatHandle: recipientChatHandle,
        RecipientName: recipient.Name?.trim() || null,
        SpaceID: spaceId,
        SpaceName: spaceName,
        Band: event.Band,
        Title: cleanTitle,
        Subject: subject,
        Message: messageBody,
        Channels: { ...params.Channels },
        ResourceTypeID: resourceTypeId,
        ResourceRecordID: resourceRecordId,
        ResourceConfiguration: resourceConfiguration,
        TemplateData: templateData,
        OccurredAtIso: occurredAtIso,
    };
}

function buildAllSuppressedResult(
    recipientUserId: string,
    reason: NotificationSuppressionReason,
    quietHoursActive: boolean = false,
): CommsV2RecipientEvaluationResult {
    const decisions: Record<CollaborationNotificationChannel, CommsV2ChannelDecision> = {
        InApp: { Channel: 'InApp', Permitted: false, Reason: reason },
        Email: { Channel: 'Email', Permitted: false, Reason: reason },
        SMS: { Channel: 'SMS', Permitted: false, Reason: reason },
        Chat: { Channel: 'Chat', Permitted: false, Reason: reason },
    };
    const suppressed: CommsV2SuppressedChannel[] = COLLABORATION_NOTIFICATION_CHANNELS.map((ch) => ({
        Channel: ch,
        Reason: reason,
    }));
    return {
        RecipientUserID: recipientUserId,
        Permitted: false,
        PermittedChannels: [],
        SuppressedChannels: suppressed,
        ChannelDecisions: decisions,
        SuppressionReasons: [reason],
        QuietHoursActive: quietHoursActive,
        Payload: null,
    };
}

function matchesMutedItem(event: CollaborationNotificationEvent, mutedKeys: readonly string[]): boolean {
    if (mutedKeys.length === 0) return false;
    const mutedSet = new Set(mutedKeys.map((k) => normalizeMutedItemKey(k)).filter((k): k is string => k !== null));
    const candidates: Array<string | null> = [
        normalizeMutedItemKey(event.TargetRecordID),
        normalizeMutedItemKey(event.ResourceRecordID),
        buildMutedItemKey(event.TargetEntityID, event.TargetRecordID),
        normalizeMutedItemKey(event.ResourceConfiguration?.ItemID),
        normalizeMutedItemKey(event.ResourceConfiguration?.TaskID),
        normalizeMutedItemKey(event.ResourceConfiguration?.ConversationDetailID),
    ];
    return candidates.some((c) => c !== null && mutedSet.has(c));
}

function resolveBaseChannelEnabled(
    channel: CollaborationNotificationChannel,
    mjType: MJNotificationTypeDefaultSnapshot | null | undefined,
): boolean {
    if (!mjType) {
        return channel === 'InApp';
    }
    switch (channel) {
        case 'InApp':
            return mjType.DefaultInApp;
        case 'Email':
            return mjType.DefaultEmail;
        case 'SMS':
            return mjType.DefaultSMS;
        case 'Chat':
            return false;
    }
}

function readMJPreferenceChannel(
    channel: CollaborationNotificationChannel,
    mjPref: MJUserNotificationPreferenceSnapshot | null | undefined,
): boolean | null {
    if (!mjPref) return null;
    switch (channel) {
        case 'InApp':
            return typeof mjPref.InAppEnabled === 'boolean' ? mjPref.InAppEnabled : null;
        case 'Email':
            return typeof mjPref.EmailEnabled === 'boolean' ? mjPref.EmailEnabled : null;
        case 'SMS':
            return typeof mjPref.SMSEnabled === 'boolean' ? mjPref.SMSEnabled : null;
        case 'Chat':
            return null;
    }
}

function hasContactForChannel(
    channel: CollaborationNotificationChannel,
    recipient: CollaborationRecipientCandidate,
): boolean {
    switch (channel) {
        case 'InApp':
            return true;
        case 'Email':
            return Boolean(recipient.Email?.trim());
        case 'SMS':
            return Boolean(recipient.Phone?.trim());
        case 'Chat':
            return Boolean(recipient.ChatHandle?.trim() || recipient.Email?.trim());
    }
}

/**
 * Pure NT-1 preference & reach evaluation for a single recipient.
 * Strictly enforces space/band reach, master opt-out, space/item mutes, event subscriptions,
 * channel opt-outs, contact availability, and timezone-aware quiet hours BEFORE any Comms v2 dispatch.
 */
export function evaluateNotificationPreferencesForRecipient(input: {
    Event: CollaborationNotificationEvent;
    Recipient: CollaborationRecipientCandidate;
    NotificationTypeDefault?: MJNotificationTypeDefaultSnapshot | null;
    AncestorSpaceIDs?: readonly string[];
    NowUtc?: Date;
    IncludeActor?: boolean;
}): CommsV2RecipientEvaluationResult {
    const event = input.Event;
    const recipient = input.Recipient;
    const recipientId = normalizeNoticeUuid(recipient.UserID) ?? recipient.UserID;
    const spaceId = normalizeNoticeUuid(event.SpaceID) ?? event.SpaceID;
    const actorId = normalizeNoticeUuid(event.ActorUserID);

    if (!isSpaceNoticeBand(event.Band) || !recipient.HasSpaceReach || (event.Band === 'Team' && !recipient.CanSeeTeamBand)) {
        return buildAllSuppressedResult(recipientId, 'NoSpaceReach');
    }

    if (!input.IncludeActor && actorId && actorId === recipientId) {
        return buildAllSuppressedResult(recipientId, 'ExcludedActor');
    }

    const prefs = recipient.Preferences
        ? normalizeCollaborationNotificationPreferences(recipient.Preferences)
        : createDefaultCollaborationNotificationPreferences();
    const mjPref = recipient.MJPreferenceRow ?? null;
    const mjType = input.NotificationTypeDefault ?? null;

    if (prefs.Enabled === false || mjPref?.Enabled === false) {
        return buildAllSuppressedResult(recipientId, 'MasterDisabled');
    }

    const spaceOverride = prefs.SpaceOverrides[spaceId];
    const explicitlyUnmuted = spaceOverride?.Muted === false;
    const isDirectlyMuted = prefs.MutedSpaceIDs.includes(spaceId) || spaceOverride?.Muted === true;
    const isAncestorMuted =
        !explicitlyUnmuted &&
        (input.AncestorSpaceIDs ?? []).some((rawAncestorId) => {
            const aid = normalizeNoticeUuid(rawAncestorId);
            if (!aid) return false;
            return prefs.MutedSpaceIDs.includes(aid) || prefs.SpaceOverrides[aid]?.Muted === true;
        });
    if (isDirectlyMuted || isAncestorMuted) {
        return buildAllSuppressedResult(recipientId, 'SpaceMuted');
    }

    if (matchesMutedItem(event, prefs.MutedItemKeys)) {
        return buildAllSuppressedResult(recipientId, 'ItemMuted');
    }

    const eventSub = prefs.EventSubscriptions[event.EventType];
    if (eventSub === false || (typeof eventSub === 'object' && eventSub !== null && eventSub.Enabled === false)) {
        return buildAllSuppressedResult(recipientId, 'EventTypeUnsubscribed');
    }

    const allowUserPref = mjType ? mjType.AllowUserPreference !== false : true;
    const nowUtc = input.NowUtc ?? new Date();
    const quiet = isWithinQuietHours(prefs.QuietHours, nowUtc, prefs.PreferredTimezone);

    const channelDecisions: Record<CollaborationNotificationChannel, CommsV2ChannelDecision> = {
        InApp: { Channel: 'InApp', Permitted: false, Reason: 'ChannelOptedOut' },
        Email: { Channel: 'Email', Permitted: false, Reason: 'ChannelOptedOut' },
        SMS: { Channel: 'SMS', Permitted: false, Reason: 'ChannelOptedOut' },
        Chat: { Channel: 'Chat', Permitted: false, Reason: 'ChannelOptedOut' },
    };

    const permittedChannels: CollaborationNotificationChannel[] = [];
    const suppressedChannels: CommsV2SuppressedChannel[] = [];
    const suppressionReasonsSet = new Set<NotificationSuppressionReason>();

    const eventSubChannels = typeof eventSub === 'object' && eventSub !== null ? eventSub.Channels : undefined;

    for (const channel of COLLABORATION_NOTIFICATION_CHANNELS) {
        let enabled = resolveBaseChannelEnabled(channel, mjType);

        if (allowUserPref) {
            const mjVal = readMJPreferenceChannel(channel, mjPref);
            if (mjVal !== null) {
                enabled = mjVal;
            }
            const globalPrefVal = prefs.Channels[channel];
            if (globalPrefVal !== null) {
                enabled = globalPrefVal;
            }
            const spaceChannelVal = spaceOverride?.Channels?.[channel];
            if (typeof spaceChannelVal === 'boolean') {
                enabled = spaceChannelVal;
            }
            const eventChannelVal = eventSubChannels?.[channel];
            if (typeof eventChannelVal === 'boolean') {
                enabled = eventChannelVal;
            }
        }

        // Subtractive ceiling from caller/event (can only turn off, never escalate past preference)
        if (event.AllowedChannels && event.AllowedChannels[channel] === false) {
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
            suppressionReasonsSet.add(suppressReason);
        }
    }

    const payload =
        permittedChannels.length > 0
            ? buildCommsV2NotificationPayload({
                  Event: event,
                  Recipient: recipient,
                  NotificationTypeName: mjType?.Name ?? resolveNotificationTypeName(event),
                  Channels: {
                      InApp: channelDecisions.InApp.Permitted,
                      Email: channelDecisions.Email.Permitted,
                      SMS: channelDecisions.SMS.Permitted,
                      Chat: channelDecisions.Chat.Permitted,
                  },
              })
            : null;

    return {
        RecipientUserID: recipientId,
        Permitted: permittedChannels.length > 0,
        PermittedChannels: permittedChannels,
        SuppressedChannels: suppressedChannels,
        ChannelDecisions: channelDecisions,
        SuppressionReasons: [...suppressionReasonsSet],
        QuietHoursActive: quiet.active,
        Payload: payload,
    };
}
