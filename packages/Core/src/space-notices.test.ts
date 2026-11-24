import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    compareNoticeCursors,
    isNoticeEventUnread,
    isNoticeEventVisibleToMember,
    resolveEffectiveWatermarkCursor,
    resolveSpaceNoticeFeedForMember,
    shouldAdvanceWatermark,
    type SpaceNoticeEventRecord,
    type SpaceNoticeReachInfo,
    type SpaceNoticeWatermarkRecord,
    ZERO_NOTICE_UUID,
} from './space-notices.ts';

const SPACE_A = '11111111-1111-4111-8111-111111111111';
const SPACE_B = '22222222-2222-4222-8222-222222222222';
const USER_TEAM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_SHARED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const EVT_1 = '00000001-0000-4000-8000-000000000001';
const EVT_2 = '00000002-0000-4000-8000-000000000002';
const EVT_3 = '00000003-0000-4000-8000-000000000003';
const EVT_4 = '00000004-0000-4000-8000-000000000004';

function makeEvent(over: Partial<SpaceNoticeEventRecord> & { ID: string }): SpaceNoticeEventRecord {
    return {
        SpaceID: SPACE_A,
        ActorUserID: USER_TEAM,
        EventKind: 'Announcement',
        Band: 'Shared',
        Title: 'Space notice',
        Body: null,
        TargetEntityID: null,
        TargetRecordID: null,
        MetadataJSON: null,
        EventTimestamp: '2026-11-23T12:00:00.000Z',
        ...over,
        ID: over.ID,
    };
}

describe('CS-4 space notices pure rules', () => {
    it('enforces deterministic composite (EventTimestamp, EventID) tie-breaking and sub-ms precision', () => {
        const sameTs = '2026-11-23T12:00:00.1234567Z';
        assert.ok(
            compareNoticeCursors(
                { EventTimestamp: sameTs, EventID: EVT_1 },
                { EventTimestamp: sameTs, EventID: EVT_2 },
            ) < 0,
        );
        assert.equal(
            compareNoticeCursors(
                { EventTimestamp: sameTs, EventID: EVT_2.toUpperCase() },
                { EventTimestamp: sameTs, EventID: EVT_2 },
            ),
            0,
        );
        // Sub-millisecond ordering: .1234567 > .1234560
        assert.ok(
            compareNoticeCursors(
                { EventTimestamp: '2026-11-23T12:00:00.1234567Z', EventID: EVT_1 },
                { EventTimestamp: '2026-11-23T12:00:00.1234560Z', EventID: EVT_4 },
            ) > 0,
        );
        // Sub-millisecond DATETIMEOFFSET(7) tick truncation: Date-truncated watermark (.123Z)
        // referencing the exact same EventID must treat that exact event as read while keeping newer sub-ms events unread.
        const subMsEvent = makeEvent({ ID: EVT_1, EventTimestamp: '2026-11-23T12:00:00.1234567Z' });
        const laterSubMsEvent = makeEvent({ ID: EVT_2, EventTimestamp: '2026-11-23T12:00:00.1239000Z' });
        const truncatedWatermark = { EventTimestamp: new Date('2026-11-23T12:00:00.123Z'), EventID: EVT_1 };
        const subMsCursor = { EventTimestamp: subMsEvent.EventTimestamp, EventID: subMsEvent.ID };
        assert.equal(compareNoticeCursors(subMsCursor, truncatedWatermark), 0);
        assert.equal(isNoticeEventUnread(subMsEvent, truncatedWatermark), false);
        assert.equal(shouldAdvanceWatermark(truncatedWatermark, subMsCursor), false);
        assert.equal(isNoticeEventUnread(laterSubMsEvent, truncatedWatermark), true);
    });

    it('resolves identical-timestamp watermark boundaries accurately', () => {
        const ts = '2026-11-23T12:00:00.000Z';
        const e1 = makeEvent({ ID: EVT_1, EventTimestamp: ts });
        const e2 = makeEvent({ ID: EVT_2, EventTimestamp: ts });
        const e3 = makeEvent({ ID: EVT_3, EventTimestamp: ts });

        const watermarkAtE2 = { EventTimestamp: ts, EventID: EVT_2 };
        assert.equal(isNoticeEventUnread(e1, watermarkAtE2), false);
        assert.equal(isNoticeEventUnread(e2, watermarkAtE2), false);
        assert.equal(isNoticeEventUnread(e3, watermarkAtE2), true);
    });

    it('bounds newly joined members by MemberJoinedAt so pre-join history does not inflate unread counts', () => {
        const joinTs = '2026-11-23T12:00:00.000Z';
        const preJoin = makeEvent({ ID: EVT_1, EventTimestamp: '2026-11-23T11:59:59.999Z' });
        const atJoin = makeEvent({ ID: EVT_2, EventTimestamp: joinTs });
        const postJoin = makeEvent({ ID: EVT_3, EventTimestamp: '2026-11-23T12:05:00.000Z' });

        const effective = resolveEffectiveWatermarkCursor({
            watermark: null,
            memberJoinedAt: joinTs,
        });
        assert.equal(effective.Source, 'member-join');
        assert.equal(effective.Cursor.EventID, ZERO_NOTICE_UUID);

        assert.equal(isNoticeEventUnread(preJoin, effective.Cursor), false);
        assert.equal(isNoticeEventUnread(atJoin, effective.Cursor), true);
        assert.equal(isNoticeEventUnread(postJoin, effective.Cursor), true);
    });

    it('enforces monotonic and idempotent watermark advancement', () => {
        const cur = { EventTimestamp: '2026-11-23T12:00:00.000Z', EventID: EVT_2 };
        assert.equal(shouldAdvanceWatermark(null, cur), true);
        assert.equal(shouldAdvanceWatermark(cur, { EventTimestamp: '2026-11-23T12:00:00.000Z', EventID: EVT_2 }), false);
        assert.equal(shouldAdvanceWatermark(cur, { EventTimestamp: '2026-11-23T12:00:00.000Z', EventID: EVT_1 }), false);
        assert.equal(shouldAdvanceWatermark(cur, { EventTimestamp: '2026-11-23T11:59:00.000Z', EventID: EVT_4 }), false);
        assert.equal(shouldAdvanceWatermark(cur, { EventTimestamp: '2026-11-23T12:00:00.000Z', EventID: EVT_3 }), true);
        assert.equal(shouldAdvanceWatermark(cur, { EventTimestamp: '2026-11-23T12:01:00.000Z', EventID: EVT_1 }), true);
    });

    it('isolates Team-band events from Shared-only members and supports deterministic keyset paging', () => {
        const events: SpaceNoticeEventRecord[] = [
            makeEvent({ ID: EVT_1, SpaceID: SPACE_A, Band: 'Shared', EventTimestamp: '2026-11-23T10:00:00.000Z' }),
            makeEvent({ ID: EVT_2, SpaceID: SPACE_A, Band: 'Team', EventTimestamp: '2026-11-23T11:00:00.000Z' }),
            makeEvent({ ID: EVT_3, SpaceID: SPACE_A, Band: 'Shared', EventTimestamp: '2026-11-23T12:00:00.000Z' }),
            makeEvent({ ID: EVT_4, SpaceID: SPACE_B, Band: 'Shared', EventTimestamp: '2026-11-23T13:00:00.000Z' }),
        ];

        assert.equal(isNoticeEventVisibleToMember(events[1], { SpaceID: SPACE_A, CanSeeTeam: false }), false);
        assert.equal(isNoticeEventVisibleToMember(events[1], { SpaceID: SPACE_A, CanSeeTeam: true }), true);

        const sharedReach = new Map<string, SpaceNoticeReachInfo>([
            [SPACE_A, { SpaceID: SPACE_A, CanSeeTeam: false }],
        ]);
        const sharedWatermarks = new Map<string, SpaceNoticeWatermarkRecord>([
            [
                SPACE_A,
                {
                    SpaceID: SPACE_A,
                    UserID: USER_SHARED,
                    LastReadEventTimestamp: '2026-11-23T10:00:00.000Z',
                    LastReadEventID: EVT_1,
                },
            ],
        ]);

        const page1 = resolveSpaceNoticeFeedForMember({
            Events: events,
            ReachBySpace: sharedReach,
            WatermarksBySpace: sharedWatermarks,
            Limit: 1,
        });
        assert.equal(page1.UnreadCount, 1);
        assert.equal(page1.UnreadCountBySpace[SPACE_A], 1);
        assert.equal(page1.Items.length, 1);
        assert.equal(page1.Items[0].ID, EVT_3);
        assert.equal(page1.Items[0].IsUnread, true);
        assert.equal(page1.HasMore, true);
        assert.ok(page1.NextCursor);

        const page2 = resolveSpaceNoticeFeedForMember({
            Events: events,
            ReachBySpace: sharedReach,
            WatermarksBySpace: sharedWatermarks,
            AfterCursor: page1.NextCursor,
            Limit: 1,
        });
        assert.equal(page2.Items.length, 1);
        assert.equal(page2.Items[0].ID, EVT_1);
        assert.equal(page2.Items[0].IsUnread, false);
        assert.equal(page2.HasMore, false);
        assert.equal(page2.NextCursor, null);
    });
});
