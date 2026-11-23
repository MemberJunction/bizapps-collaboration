import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildMutedItemKey,
    COLLABORATION_NOTIFICATION_CHANNELS,
    createDefaultCollaborationNotificationPreferences,
    evaluateNotificationPreferencesForRecipient,
    isWithinQuietHours,
    mergeCollaborationNotificationPreferences,
    NT1_NOTIFICATION_EVENT_TYPES,
    NT1_NOTIFICATION_TYPE_NAMES,
    parseCollaborationNotificationPreferences,
    serializeCollaborationNotificationPreferences,
    type CollaborationNotificationEvent,
    type CollaborationRecipientCandidate,
    type MJNotificationTypeDefaultSnapshot,
} from './notifications.ts';

const SPACE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SPACE_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RECIPIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ENTITY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECORD_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function baseRecipient(
    over: Partial<CollaborationRecipientCandidate> = {},
): CollaborationRecipientCandidate {
    return {
        UserID: RECIPIENT_ID,
        Name: 'Jordan Lee',
        Email: 'jordan@example.com',
        Phone: '+15551234567',
        ChatHandle: 'jordan.lee',
        HasSpaceReach: true,
        CanSeeTeamBand: true,
        Preferences: {
            ...createDefaultCollaborationNotificationPreferences(),
            Channels: { InApp: true, Email: true, SMS: false, Chat: false },
        },
        ...over,
    };
}

function baseEvent(over: Partial<CollaborationNotificationEvent> = {}): CollaborationNotificationEvent {
    return {
        EventType: 'Mention',
        SpaceID: SPACE_ID,
        SpaceName: 'Client Engagement',
        Band: 'Shared',
        ActorUserID: ACTOR_ID,
        ActorName: 'Alex Morgan',
        Title: 'Alex mentioned you',
        Body: 'Please review the updated scope.',
        TargetEntityID: ENTITY_ID,
        TargetRecordID: RECORD_ID,
        OccurredAt: '2026-11-23T15:00:00.000Z',
        ...over,
    };
}

describe('NT-1 Comms v2 notification preference & payload pure rules', () => {
    it('builds typed Comms v2 payloads across all 6 NT-1 event types', () => {
        const recipient = baseRecipient({
            Preferences: {
                ...createDefaultCollaborationNotificationPreferences(),
                Channels: { InApp: true, Email: true, SMS: true, Chat: true },
            },
        });

        for (const eventType of NT1_NOTIFICATION_EVENT_TYPES) {
            const event = baseEvent({
                EventType: eventType,
                Title: `Event ${eventType}`,
                Metadata: {
                    FromStatus: eventType === 'StatusChanged' ? 'Active' : null,
                    ToStatus: eventType === 'StatusChanged' ? 'Paused' : null,
                    TaskStatus: eventType === 'Task' ? 'In Progress' : null,
                    ApprovalOutcome: eventType === 'Approval' ? 'Approved' : null,
                    MentionExcerpt: eventType === 'Mention' ? '@jordan check section 2' : null,
                    ReplyExcerpt: eventType === 'Reply' ? 'Looks good to me' : null,
                    ItemName: eventType === 'Share' ? 'Q4 Brief.pdf' : null,
                    DeepLinkUrl: 'https://app.example.com/spaces/1',
                },
            });
            const result = evaluateNotificationPreferencesForRecipient({
                Event: event,
                Recipient: recipient,
                NowUtc: new Date('2026-11-23T15:00:00.000Z'),
            });

            assert.equal(result.Permitted, true);
            assert.deepEqual(result.PermittedChannels, [...COLLABORATION_NOTIFICATION_CHANNELS]);
            assert.ok(result.Payload);
            assert.equal(result.Payload.EventType, eventType);
            assert.equal(result.Payload.NotificationTypeName, NT1_NOTIFICATION_TYPE_NAMES[eventType]);
            assert.equal(result.Payload.RecipientEmail, 'jordan@example.com');
            assert.equal(result.Payload.RecipientPhone, '+15551234567');
            assert.equal(result.Payload.TemplateData['EventType'], eventType);
            assert.equal(result.Payload.TemplateData['SpaceID'], SPACE_ID);
            assert.equal(result.Payload.Subject, `[Client Engagement] Event ${eventType}`);
        }
    });

    it('parses, merges, and serializes preferences safely', () => {
        const initial = parseCollaborationNotificationPreferences(null);
        assert.equal(initial.Enabled, true);

        const merged = mergeCollaborationNotificationPreferences(initial, {
            Channels: { InApp: true, Email: false },
            EventSubscriptions: {
                StatusChanged: false,
                Mention: { Enabled: true, Channels: { Email: true } },
            },
            MuteSpaceIDsToAdd: [SPACE_ID.toUpperCase()],
            MuteItemKeysToAdd: [buildMutedItemKey(ENTITY_ID, RECORD_ID) ?? ''],
            QuietHours: {
                Enabled: true,
                StartTime: '22:00',
                EndTime: '07:00',
                Timezone: 'America/Chicago',
            },
            PreferredTimezone: 'America/Chicago',
        });

        const roundTripped = parseCollaborationNotificationPreferences(
            serializeCollaborationNotificationPreferences(merged),
        );
        assert.equal(roundTripped.Channels.InApp, true);
        assert.equal(roundTripped.Channels.Email, false);
        assert.equal(roundTripped.EventSubscriptions.StatusChanged, false);
        assert.deepEqual(roundTripped.MutedSpaceIDs, [SPACE_ID]);
        assert.deepEqual(roundTripped.MutedItemKeys, [`${ENTITY_ID}|${RECORD_ID}`]);
        assert.equal(roundTripped.QuietHours?.StartTime, '22:00');
        assert.equal(roundTripped.QuietHours?.Timezone, 'America/Chicago');

        const unmuted = mergeCollaborationNotificationPreferences(roundTripped, {
            MuteSpaceIDsToRemove: [SPACE_ID],
            MuteItemKeysToRemove: [`${ENTITY_ID}|${RECORD_ID}`],
        });
        assert.deepEqual(unmuted.MutedSpaceIDs, []);
        assert.deepEqual(unmuted.MutedItemKeys, []);
    });

    it('evaluates overnight quiet-hour windows accurately across timezones', () => {
        const chicagoOvernight = {
            Enabled: true,
            StartTime: '22:00',
            EndTime: '07:00',
            Timezone: 'America/Chicago', // UTC-6 in November
        };

        // 04:30 UTC = 22:30 America/Chicago (inside 22:00 -> 07:00)
        assert.equal(isWithinQuietHours(chicagoOvernight, new Date('2026-11-23T04:30:00.000Z')).active, true);
        // 12:30 UTC = 06:30 America/Chicago (inside 22:00 -> 07:00)
        assert.equal(isWithinQuietHours(chicagoOvernight, new Date('2026-11-23T12:30:00.000Z')).active, true);
        // 13:00 UTC = 07:00 America/Chicago (exact end boundary -> exclusive, outside)
        assert.equal(isWithinQuietHours(chicagoOvernight, new Date('2026-11-23T13:00:00.000Z')).active, false);
        // 18:00 UTC = 12:00 America/Chicago (midday -> outside)
        assert.equal(isWithinQuietHours(chicagoOvernight, new Date('2026-11-23T18:00:00.000Z')).active, false);

        // Same instant (12:30 UTC) in Asia/Tokyo (UTC+9 = 21:30 JST) is NOT in 22:00 -> 07:00
        const tokyoOvernight = { ...chicagoOvernight, Timezone: 'Asia/Tokyo' };
        assert.equal(isWithinQuietHours(tokyoOvernight, new Date('2026-11-23T12:30:00.000Z')).active, false);
        // 13:30 UTC = 22:30 JST (inside)
        assert.equal(isWithinQuietHours(tokyoOvernight, new Date('2026-11-23T13:30:00.000Z')).active, true);
    });

    it('suppresses quiet-hour external channels while allowing InApp unless configured otherwise', () => {
        const recipient = baseRecipient({
            Preferences: {
                ...createDefaultCollaborationNotificationPreferences(),
                Channels: { InApp: true, Email: true, SMS: true, Chat: true },
                QuietHours: {
                    Enabled: true,
                    StartTime: '22:00',
                    EndTime: '07:00',
                    Timezone: 'UTC',
                    SuppressedChannels: ['Email', 'SMS', 'Chat'],
                },
            },
        });

        const duringQuiet = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({ EventType: 'Reply' }),
            Recipient: recipient,
            NowUtc: new Date('2026-11-23T23:30:00.000Z'),
        });

        assert.equal(duringQuiet.QuietHoursActive, true);
        assert.equal(duringQuiet.Permitted, true);
        assert.deepEqual(duringQuiet.PermittedChannels, ['InApp']);
        assert.equal(duringQuiet.ChannelDecisions.Email.Reason, 'QuietHoursActive');
        assert.equal(duringQuiet.ChannelDecisions.SMS.Reason, 'QuietHoursActive');
        assert.equal(duringQuiet.ChannelDecisions.Chat.Reason, 'QuietHoursActive');
        assert.deepEqual(duringQuiet.Payload?.Channels, {
            InApp: true,
            Email: false,
            SMS: false,
            Chat: false,
        });

        const silenceAllDuringQuiet = baseRecipient({
            Preferences: {
                ...recipient.Preferences!,
                QuietHours: {
                    Enabled: true,
                    StartTime: '22:00',
                    EndTime: '07:00',
                    Timezone: 'UTC',
                    SuppressedChannels: ['InApp', 'Email', 'SMS', 'Chat'],
                },
            },
        });
        const allSuppressed = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({ EventType: 'Reply' }),
            Recipient: silenceAllDuringQuiet,
            NowUtc: new Date('2026-11-23T23:30:00.000Z'),
        });
        assert.equal(allSuppressed.Permitted, false);
        assert.equal(allSuppressed.Payload, null);
    });

    it('enforces master switch, event subscriptions, muted spaces/items, band reach, and AllowUserPreference', () => {
        // 1. Muted space
        const mutedSpace = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({ SpaceID: SPACE_ID }),
            Recipient: baseRecipient({
                Preferences: {
                    ...createDefaultCollaborationNotificationPreferences(),
                    MutedSpaceIDs: [SPACE_ID],
                },
            }),
        });
        assert.equal(mutedSpace.Permitted, false);
        assert.deepEqual(mutedSpace.SuppressionReasons, ['SpaceMuted']);

        // 2. Muted item via EntityID|RecordID
        const mutedItem = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({ TargetEntityID: ENTITY_ID, TargetRecordID: RECORD_ID }),
            Recipient: baseRecipient({
                Preferences: {
                    ...createDefaultCollaborationNotificationPreferences(),
                    MutedItemKeys: [`${ENTITY_ID}|${RECORD_ID}`],
                },
            }),
        });
        assert.equal(mutedItem.Permitted, false);
        assert.deepEqual(mutedItem.SuppressionReasons, ['ItemMuted']);

        // 3. Unsubscribed event type
        const unsubscribed = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({ EventType: 'StatusChanged' }),
            Recipient: baseRecipient({
                Preferences: {
                    ...createDefaultCollaborationNotificationPreferences(),
                    EventSubscriptions: { StatusChanged: false },
                },
            }),
        });
        assert.equal(unsubscribed.Permitted, false);
        assert.deepEqual(unsubscribed.SuppressionReasons, ['EventTypeUnsubscribed']);

        // 4. Shared-only user cannot receive Team-band notifications
        const teamIsolation = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({ Band: 'Team', SpaceID: OTHER_SPACE_ID }),
            Recipient: baseRecipient({ CanSeeTeamBand: false }),
        });
        assert.equal(teamIsolation.Permitted, false);
        assert.deepEqual(teamIsolation.SuppressionReasons, ['NoSpaceReach']);

        // 5. Subtractive AllowedChannels ceiling never escalates past preference
        const ceiling = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({
                AllowedChannels: { Email: false, SMS: true },
            }),
            Recipient: baseRecipient({
                Preferences: {
                    ...createDefaultCollaborationNotificationPreferences(),
                    Channels: { InApp: true, Email: true, SMS: false, Chat: false },
                },
            }),
        });
        assert.deepEqual(ceiling.PermittedChannels, ['InApp']);

        // 6. Type with AllowUserPreference=false ignores channel opt-outs
        const lockedType: MJNotificationTypeDefaultSnapshot = {
            ID: '99999999-9999-4999-8999-999999999999',
            Name: 'Collaboration: Approval',
            DefaultInApp: true,
            DefaultEmail: true,
            DefaultSMS: false,
            AllowUserPreference: false,
        };
        const lockedRes = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({ EventType: 'Approval' }),
            Recipient: baseRecipient({
                Preferences: {
                    ...createDefaultCollaborationNotificationPreferences(),
                    Channels: { InApp: false, Email: false, SMS: true, Chat: true },
                },
            }),
            NotificationTypeDefault: lockedType,
        });
        assert.deepEqual(lockedRes.PermittedChannels, ['InApp', 'Email']);
    });

    it('suppresses external channels when recipient lacks contact address', () => {
        const res = evaluateNotificationPreferencesForRecipient({
            Event: baseEvent({ EventType: 'Task' }),
            Recipient: baseRecipient({
                Email: null,
                Phone: null,
                ChatHandle: null,
                Preferences: {
                    ...createDefaultCollaborationNotificationPreferences(),
                    Channels: { InApp: true, Email: true, SMS: true, Chat: true },
                },
            }),
        });
        assert.deepEqual(res.PermittedChannels, ['InApp']);
        assert.equal(res.ChannelDecisions.Email.Reason, 'MissingContactAddress');
        assert.equal(res.ChannelDecisions.SMS.Reason, 'MissingContactAddress');
        assert.equal(res.ChannelDecisions.Chat.Reason, 'MissingContactAddress');
    });
});
