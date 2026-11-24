import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    advanceCompositeKeysetCursor,
    assembleScopedDigestForRecipient,
    computeNextDigestCheckpoint,
    isDigestScheduleWindowDue,
    sortNoticeEventsByCompositeKeyset,
    SPACE_CHATS_ENTITY_ID,
    SPACE_ITEMS_ENTITY_ID,
    SPACE_NOTES_ENTITY_ID,
    stripRawMarkdownSyntaxForDigest,
    type DigestCandidateNotice,
    type DigestRecipientScopeAccess,
} from './space-digests.ts';
import {
    createDefaultCollaborationNotificationPreferences,
    mergeCollaborationNotificationPreferences,
    parseCollaborationNotificationPreferences,
    serializeCollaborationNotificationPreferences,
} from './notifications.ts';

const SPACE_A = '11111111-1111-4111-8111-111111111101';
const SPACE_B = '11111111-1111-4111-8111-111111111102';
const SPACE_PARENT = '11111111-1111-4111-8111-111111111100';
const USER_1 = '22222222-2222-4222-8222-222222222201';
const ACTOR_1 = '22222222-2222-4222-8222-222222222299';
const ITEM_1 = '33333333-3333-4333-8333-333333333301';
const ITEM_2 = '33333333-3333-4333-8333-333333333302';
const CHAT_1 = '44444444-4444-4444-8444-444444444401';
const NOTE_1 = '55555555-5555-4555-8555-555555555501';

function makeEvent(over: Partial<DigestCandidateNotice> & { ID: string }): DigestCandidateNotice {
    return {
        SpaceID: SPACE_A,
        SpaceName: 'Alpha Engagement',
        ActorUserID: ACTOR_1,
        EventKind: 'Share',
        Band: 'Shared',
        Title: 'Shared update',
        Body: 'Summary details',
        TargetEntityID: null,
        TargetRecordID: null,
        MetadataJSON: null,
        EventTimestamp: '2026-11-23T10:00:00.000Z',
        ...over,
    };
}

function makeRecipient(over: Partial<DigestRecipientScopeAccess> = {}): DigestRecipientScopeAccess {
    return {
        UserID: USER_1,
        Name: 'Taylor Reed',
        Email: 'taylor@example.com',
        Phone: '+15551112222',
        ChatHandle: 'taylor.reed',
        IsActiveUser: true,
        ReachBySpace: new Map([
            [SPACE_A, { SpaceID: SPACE_A, CanSeeTeam: false, IsVisibleStatus: true, IsOwner: false }],
        ]),
        Preferences: createDefaultCollaborationNotificationPreferences(),
        Checkpoint: null,
        ...over,
    };
}

describe('NT-2 pure scoped digest rules & fail-closed verification', () => {
    it('sorts and advances composite (EventTimestamp, ID) keyset cursors deterministically under identical timestamps', () => {
        const events = [
            makeEvent({ ID: '00000000-0000-4000-8000-000000000003', EventTimestamp: '2026-11-23T10:00:00.000Z' }),
            makeEvent({ ID: '00000000-0000-4000-8000-000000000001', EventTimestamp: '2026-11-23T10:00:00.000Z' }),
            makeEvent({ ID: '00000000-0000-4000-8000-000000000002', EventTimestamp: '2026-11-23T10:00:00.000Z' }),
            makeEvent({ ID: '00000000-0000-4000-8000-000000000000', EventTimestamp: '2026-11-23T10:00:01.000Z' }),
        ];

        const sorted = sortNoticeEventsByCompositeKeyset(events);
        assert.deepEqual(
            sorted.map((e) => e.ID),
            [
                '00000000-0000-4000-8000-000000000001',
                '00000000-0000-4000-8000-000000000002',
                '00000000-0000-4000-8000-000000000003',
                '00000000-0000-4000-8000-000000000000',
            ],
        );

        const c1 = advanceCompositeKeysetCursor(null, sorted.slice(0, 2));
        assert.deepEqual(c1, {
            EventTimestamp: '2026-11-23T10:00:00.000Z',
            EventID: '00000000-0000-4000-8000-000000000002',
        });

        const c2 = advanceCompositeKeysetCursor(c1, sorted.slice(2, 4));
        assert.deepEqual(c2, {
            EventTimestamp: '2026-11-23T10:00:01.000Z',
            EventID: '00000000-0000-4000-8000-000000000000',
        });

        // Non-advancing page cursor throws rather than looping infinitely
        assert.throws(() => advanceCompositeKeysetCursor(c2, sorted.slice(0, 2)));
    });

    it('fails closed at digest assembly time when space reach, band, item, chat, or note access is revoked or restricted', () => {
        const events: DigestCandidateNotice[] = [
            // 1. Valid Shared item event -> INCLUDED
            makeEvent({
                ID: 'aaaaaaaa-0000-4000-8000-000000000001',
                TargetEntityID: SPACE_ITEMS_ENTITY_ID,
                TargetRecordID: `ID|${ITEM_1}`,
                Title: '### Q4 Deliverable **Ready**',
                Body: 'See [brief](https://example.com) and `v2` notes.',
                EventTimestamp: '2026-11-23T10:01:00.000Z',
            }),
            // 2. Notice looks Shared, but underlying SpaceItem moved to Team band -> EXCLUDED (TargetItemRestricted)
            makeEvent({
                ID: 'aaaaaaaa-0000-4000-8000-000000000002',
                TargetEntityID: SPACE_ITEMS_ENTITY_ID,
                TargetRecordID: ITEM_2,
                EventTimestamp: '2026-11-23T10:02:00.000Z',
            }),
            // 3. Underlying SpaceItem deleted -> EXCLUDED (TargetItemMissing)
            makeEvent({
                ID: 'aaaaaaaa-0000-4000-8000-000000000003',
                TargetEntityID: SPACE_ITEMS_ENTITY_ID,
                TargetRecordID: '33333333-3333-4333-8333-333333333399',
                EventTimestamp: '2026-11-23T10:03:00.000Z',
            }),
            // 4. SpaceChat became Private -> EXCLUDED (TargetChatRestricted)
            makeEvent({
                ID: 'aaaaaaaa-0000-4000-8000-000000000004',
                TargetEntityID: SPACE_CHATS_ENTITY_ID,
                TargetRecordID: CHAT_1,
                EventTimestamp: '2026-11-23T10:04:00.000Z',
            }),
            // 5. SpaceNote is Private to another author -> EXCLUDED (TargetNoteRestricted)
            makeEvent({
                ID: 'aaaaaaaa-0000-4000-8000-000000000005',
                TargetEntityID: SPACE_NOTES_ENTITY_ID,
                TargetRecordID: NOTE_1,
                EventTimestamp: '2026-11-23T10:05:00.000Z',
            }),
            // 6. Space B membership revoked (not in ReachBySpace) -> EXCLUDED (NoSpaceReach)
            makeEvent({
                ID: 'aaaaaaaa-0000-4000-8000-000000000006',
                SpaceID: SPACE_B,
                EventTimestamp: '2026-11-23T10:06:00.000Z',
            }),
            // 7. Team-band notice on Space A for Shared-only user -> EXCLUDED (TeamBandRestricted)
            makeEvent({
                ID: 'aaaaaaaa-0000-4000-8000-000000000007',
                Band: 'Team',
                EventTimestamp: '2026-11-23T10:07:00.000Z',
            }),
        ];

        const result = assembleScopedDigestForRecipient({
            Recipient: makeRecipient(),
            Events: events,
            Cadence: 'Daily',
            NowUtc: new Date('2026-11-23T12:00:00.000Z'),
            VerificationSnapshot: {
                SpaceItemsById: new Map([
                    [ITEM_1, { ID: ITEM_1, SpaceID: SPACE_A, Band: 'Shared' }],
                    [ITEM_2, { ID: ITEM_2, SpaceID: SPACE_A, Band: 'Team' }],
                ]),
                SpaceChatsById: new Map([
                    [CHAT_1, { ID: CHAT_1, SpaceID: SPACE_A, Kind: 'Private', Status: 'Active', OwnerUserID: null }],
                ]),
                SpaceNotesById: new Map([
                    [NOTE_1, { ID: NOTE_1, SpaceID: SPACE_A, Band: 'Team', Visibility: 'Private', AuthorUserID: ACTOR_1 }],
                ]),
            },
        });

        assert.equal(result.ShouldDeliver, true);
        assert.equal(result.Items.length, 1);
        assert.equal(result.Items[0].EventID, 'aaaaaaaa-0000-4000-8000-000000000001');
        // Zero raw Markdown syntax leaks in digest payload/summary
        assert.equal(result.Items[0].Title, 'Q4 Deliverable Ready');
        assert.equal(result.Items[0].Summary, 'See brief and v2 notes.');
        assert.ok(result.Payload);
        assert.ok(!result.Payload.Message.includes('###'));
        assert.ok(!result.Payload.Message.includes('**'));
        assert.equal(result.ExcludedItems.length, 6);
        assert.deepEqual(
            result.ExcludedItems.map((e) => e.Reason),
            [
                'TargetItemRestricted',
                'TargetItemMissing',
                'TargetChatRestricted',
                'TargetNoteRestricted',
                'NoSpaceReach',
                'TeamBandRestricted',
            ],
        );
    });

    it('strictly suppresses empty digests when zero reach-verified items remain', () => {
        const result = assembleScopedDigestForRecipient({
            Recipient: makeRecipient({
                ReachBySpace: new Map(), // membership revoked before digest ran
            }),
            Events: [
                makeEvent({ ID: 'aaaaaaaa-0000-4000-8000-000000000010' }),
            ],
            Cadence: 'Daily',
        });

        assert.equal(result.ShouldDeliver, false);
        assert.equal(result.SuppressionReason, 'EmptyDigest');
        assert.equal(result.Items.length, 0);
        assert.equal(result.Payload, null);
    });

    it('enforces Digest preferences, muted ancestor spaces, quiet hours, schedule windows, and monotonic checkpoints', () => {
        const merged = mergeCollaborationNotificationPreferences(
            createDefaultCollaborationNotificationPreferences(),
            {
                Digest: {
                    Enabled: true,
                    Cadence: 'Weekly',
                    Channels: { InApp: true, Email: true, SMS: false, Chat: false },
                    SpaceCadences: { [SPACE_B]: 'Off' },
                },
                MuteSpaceIDsToAdd: [SPACE_PARENT],
                QuietHours: {
                    Enabled: true,
                    StartTime: '22:00',
                    EndTime: '07:00',
                    Timezone: 'UTC',
                    SuppressedChannels: ['Email', 'SMS', 'Chat'],
                },
            },
        );
        const roundTripped = parseCollaborationNotificationPreferences(
            serializeCollaborationNotificationPreferences(merged),
        );
        assert.equal(roundTripped.Digest?.Cadence, 'Weekly');
        assert.equal(roundTripped.Digest?.SpaceCadences?.[SPACE_B], 'Off');

        // Cadence mismatch (Daily requested, recipient prefers Weekly)
        const mismatch = assembleScopedDigestForRecipient({
            Recipient: makeRecipient({ Preferences: roundTripped }),
            Events: [makeEvent({ ID: 'aaaaaaaa-0000-4000-8000-000000000020' })],
            Cadence: 'Daily',
        });
        assert.equal(mismatch.ShouldDeliver, false);
        assert.equal(mismatch.SuppressionReason, 'CadenceMismatch');

        // Muted ancestor suppresses child SPACE_A item -> EmptyDigest
        const mutedAncestor = assembleScopedDigestForRecipient({
            Recipient: makeRecipient({
                Preferences: roundTripped,
                AncestorSpaceIDsBySpace: new Map([[SPACE_A, [SPACE_PARENT]]]),
            }),
            Events: [makeEvent({ ID: 'aaaaaaaa-0000-4000-8000-000000000021' })],
            Cadence: 'Weekly',
        });
        assert.equal(mutedAncestor.ShouldDeliver, false);
        assert.equal(mutedAncestor.SuppressionReason, 'EmptyDigest');
        assert.equal(mutedAncestor.ExcludedItems[0].Reason, 'SpaceMuted');

        // Quiet hours suppress Email while keeping InApp during 23:00 UTC
        const unmutedPrefs = mergeCollaborationNotificationPreferences(roundTripped, {
            MuteSpaceIDsToRemove: [SPACE_PARENT],
        });
        const quietDigest = assembleScopedDigestForRecipient({
            Recipient: makeRecipient({ Preferences: unmutedPrefs }),
            Events: [makeEvent({ ID: 'aaaaaaaa-0000-4000-8000-000000000022' })],
            Cadence: 'Weekly',
            NowUtc: new Date('2026-11-23T23:00:00.000Z'),
        });
        assert.equal(quietDigest.ShouldDeliver, true);
        assert.equal(quietDigest.QuietHoursActive, true);
        assert.deepEqual(quietDigest.PermittedChannels, ['InApp']);

        // Schedule window not due before 7 days have elapsed
        const notDue = isDigestScheduleWindowDue({
            Cadence: 'Weekly',
            Checkpoint: {
                UserID: USER_1,
                SpaceID: null,
                Cadence: 'Weekly',
                LastDeliveredTimestamp: '2026-11-20T00:00:00.000Z',
                LastDeliveredRecordID: 'aaaaaaaa-0000-4000-8000-000000000022',
                LastDeliveredAt: '2026-11-20T00:00:00.000Z',
                ItemsIncludedCount: 1,
                Status: 'Active',
            },
            NowUtc: new Date('2026-11-23T00:00:00.000Z'),
        });
        assert.equal(notDue.due, false);
        assert.equal(notDue.reason, 'WindowNotDue');

        // Checkpoint never advances on failed dispatch, advances monotonically on success
        const failedCp = computeNextDigestCheckpoint({
            CurrentCheckpoint: null,
            CandidateCursor: quietDigest.HighestIncludedCursor,
            ItemsIncludedCount: 1,
            DispatchSucceeded: false,
        });
        assert.equal(failedCp.shouldPersist, false);

        const okCp = computeNextDigestCheckpoint({
            CurrentCheckpoint: null,
            CandidateCursor: quietDigest.HighestIncludedCursor,
            ItemsIncludedCount: 1,
            DispatchSucceeded: true,
        });
        assert.equal(okCp.shouldPersist, true);
        assert.equal(okCp.nextRecordId, 'aaaaaaaa-0000-4000-8000-000000000022');
    });

    it('strips markdown formatting cleanly from digest snippets', () => {
        assert.equal(
            stripRawMarkdownSyntaxForDigest('## Heading\n**Bold** and _italic_ with [link](https://x.test) and ```ts\nconst x = 1;\n```'),
            'Heading Bold and italic with link and const x = 1;',
        );
    });
});
