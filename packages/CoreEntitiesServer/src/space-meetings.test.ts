import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import {
    SpaceMeetingsAgendaProvider,
    buildSpaceMeetingsAgentContext,
    ensureMeetingSpaceChat,
    loadSpaceMeetings,
    meetingChatSubject,
    parseMeetingIdFromSubject,
} from '../dist/space-meetings.js';

const USER = { ID: '11111111-1111-4111-8111-111111111111', Name: 'Ada' } as UserInfo;
const ATTENDEE_2 = '11111111-1111-4111-8111-111111111112';
const NON_ATTENDEE_TEAM = '11111111-1111-4111-8111-111111111119';
const SPACE_ID = '22222222-2222-4222-8222-222222222222';
const MEETING_STD = '33333333-3333-4333-8333-333333333331';
const MEETING_PRIV = '33333333-3333-4333-8333-333333333332';
const MEETING_PAST = '33333333-3333-4333-8333-333333333333';
const SERIES_ID = '44444444-4444-4444-8444-444444444444';

function createMeetingsProvider() {
    const savedConversations: Record<string, unknown>[] = [];
    const savedChats: Record<string, unknown>[] = [];

    const provider = {
        RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
            if (params.EntityName === 'MJ_BizApps_Tasks: Meeting Links') {
                return {
                    Success: true,
                    Results: [
                        { ID: 'link-1', MeetingID: MEETING_STD, SeriesID: null, RecordID: SPACE_ID },
                        { ID: 'link-2', MeetingID: MEETING_PRIV, SeriesID: null, RecordID: `ID|${SPACE_ID}` },
                        { ID: 'link-3', MeetingID: null, SeriesID: SERIES_ID, RecordID: SPACE_ID },
                    ],
                };
            }
            if (params.EntityName === 'MJ_BizApps_Tasks: Meetings') {
                return {
                    Success: true,
                    Results: [
                        {
                            ID: MEETING_STD,
                            Name: 'Q4 Kickoff',
                            Description: 'Standard meeting',
                            SeriesID: null,
                            StartsAt: '2026-12-01T15:00:00.000Z',
                            EndsAt: '2026-12-01T16:00:00.000Z',
                            TimeZone: 'America/Chicago',
                            Status: 'Scheduled',
                            LocationType: 'Virtual',
                            Location: null,
                            VideoJoinURL: 'https://zoom.us/j/123',
                            Visibility: 'Standard',
                        },
                        {
                            ID: MEETING_PRIV,
                            Name: 'Executive Session',
                            Description: 'Private session',
                            SeriesID: null,
                            StartsAt: '2026-12-02T15:00:00.000Z',
                            EndsAt: '2026-12-02T16:00:00.000Z',
                            TimeZone: 'America/Chicago',
                            Status: 'Scheduled',
                            LocationType: 'Virtual',
                            Location: null,
                            VideoJoinURL: 'https://zoom.us/j/456',
                            Visibility: 'Private',
                        },
                        {
                            ID: MEETING_PAST,
                            Name: 'Series Occurrence 1',
                            Description: null,
                            SeriesID: SERIES_ID,
                            StartsAt: '2026-10-01T15:00:00.000Z',
                            EndsAt: '2026-10-01T16:00:00.000Z',
                            TimeZone: 'America/Chicago',
                            Status: 'Completed',
                            LocationType: 'InPerson',
                            Location: 'Room 101',
                            VideoJoinURL: null,
                            Visibility: 'Standard',
                        },
                    ],
                };
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                const filter = params.ExtraFilter ?? '';
                if (filter.includes(`Subject = '${meetingChatSubject(MEETING_STD)}'`)) {
                    return {
                        Success: true,
                        Results: [{ ID: 'chat-std', ConversationID: 'conv-std', Subject: meetingChatSubject(MEETING_STD) }],
                    };
                }
                if (filter.includes("Subject LIKE 'meeting:%'")) {
                    return {
                        Success: true,
                        Results: [{ ID: 'chat-std', ConversationID: 'conv-std', Subject: meetingChatSubject(MEETING_STD) }],
                    };
                }
                return { Success: true, Results: [] };
            }
            if (params.EntityName === 'MJ_BizApps_Tasks: Meeting Agenda Items') {
                return {
                    Success: true,
                    Results: [
                        {
                            ID: 'ag-1',
                            MeetingID: MEETING_STD,
                            Name: 'Budget Review',
                            Sequence: 10,
                            DurationMinutes: 30,
                            Status: 'Planned',
                            Outcome: null,
                        },
                        {
                            ID: 'ag-2',
                            MeetingID: MEETING_PRIV,
                            Name: 'Confidential Personnel Review',
                            Sequence: 10,
                            DurationMinutes: 30,
                            Status: 'Planned',
                            Outcome: null,
                        },
                    ],
                };
            }
            if (params.EntityName === 'MJ_BizApps_Tasks: Meeting Notes') {
                return {
                    Success: true,
                    Results: [
                        {
                            ID: 'note-1',
                            MeetingID: MEETING_STD,
                            Kind: 'Summary',
                            Title: 'Kickoff Notes',
                            Body: 'Approved roadmap.',
                            Status: 'Final',
                            Source: 'AI',
                        },
                    ],
                };
            }
            if (params.EntityName === 'MJ_BizApps_Tasks: Meeting Attendees') {
                return {
                    Success: true,
                    Results: [
                        { ID: 'att-1', MeetingID: MEETING_PRIV, UserID: USER.ID },
                        { ID: 'att-2', MeetingID: MEETING_PRIV, UserID: ATTENDEE_2 },
                    ],
                };
            }
            return { Success: true, Results: [] };
        },
        GetEntityObject: async (entityName: string) => {
            if (entityName === 'MJ: Conversations') {
                const draft: Record<string, unknown> = {};
                return {
                    get ID() { return draft.ID as string; },
                    set Name(v: string) { draft.Name = v; },
                    set UserID(v: string) { draft.UserID = v; },
                    set Status(v: string) { draft.Status = v; },
                    NewRecord() {
                        draft.ID = 'conv-new-1';
                    },
                    async Save() {
                        savedConversations.push({ ...draft });
                        return true;
                    },
                };
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Chats') {
                const draft: Record<string, unknown> = {};
                return {
                    get ID() { return draft.ID as string; },
                    set SpaceID(v: string) { draft.SpaceID = v; },
                    set ConversationID(v: string) { draft.ConversationID = v; },
                    set Name(v: string) { draft.Name = v; },
                    set Subject(v: string | null) { draft.Subject = v; },
                    set Kind(v: string) { draft.Kind = v; },
                    set Status(v: string) { draft.Status = v; },
                    NewRecord() {
                        draft.ID = 'chat-new-1';
                    },
                    async Save() {
                        savedChats.push({ ...draft });
                        return true;
                    },
                };
            }
            return null;
        },
    };

    return {
        provider: provider as unknown as IMetadataProvider,
        savedConversations,
        savedChats,
    };
}

describe('space-meetings (B23)', () => {
    it('formats and parses meeting chat subjects cleanly', () => {
        const subject = meetingChatSubject(MEETING_STD.toUpperCase());
        assert.equal(subject, `meeting:${MEETING_STD.toLowerCase()}`);
        assert.equal(parseMeetingIdFromSubject(subject), MEETING_STD.toLowerCase());
        assert.equal(parseMeetingIdFromSubject('general:topic'), null);
    });

    it('loads space meetings (direct and series occurrences), attaches SpaceChat, and splits upcoming vs past', async () => {
        const { provider } = createMeetingsProvider();
        const res = await loadSpaceMeetings(provider, SPACE_ID, USER, {
            includeDetails: true,
            now: new Date('2026-11-15T00:00:00.000Z'),
        });

        assert.equal(res.meetings.length, 3);
        assert.equal(res.upcoming.length, 2);
        assert.equal(res.past.length, 1);

        const std = res.upcoming.find((m) => m.ID === MEETING_STD);
        assert.ok(std);
        assert.equal(std.VideoJoinURL, 'https://zoom.us/j/123');
        assert.equal(std.SpaceChatID, 'chat-std');
        assert.equal(std.ConversationID, 'conv-std');
        assert.equal(std.AgendaItems?.length, 1);
        assert.equal(std.Notes?.length, 1);
    });

    it('reuses an existing SpaceChat for a meeting or routes creation through createSpaceConversation (respecting driver refusal)', async () => {
        const { provider, savedChats } = createMeetingsProvider();

        // Existing chat for MEETING_STD
        const existing = await ensureMeetingSpaceChat(provider, {
            spaceId: SPACE_ID,
            meetingId: MEETING_STD,
            meetingName: 'Q4 Kickoff',
            visibility: 'Standard',
            contextUser: USER,
        });
        assert.deepEqual(existing, {
            ok: true,
            spaceChatId: 'chat-std',
            conversationId: 'conv-std',
            created: false,
        });

        // New chat for MEETING_PRIV -> Kind = 'Private', Subject = meeting:<id>
        const created = await ensureMeetingSpaceChat(provider, {
            spaceId: SPACE_ID,
            meetingId: MEETING_PRIV,
            meetingName: 'Executive Session',
            visibility: 'Private',
            contextUser: USER,
            createConversation: async (_p, _u, input) => {
                savedChats.push({ ...input });
                return {
                    ok: true,
                    spaceChatId: 'chat-new-1',
                    conversationId: 'conv-new-1',
                    name: input.Name,
                    kind: input.Kind,
                };
            },
        });
        assert.deepEqual(created, {
            ok: true,
            spaceChatId: 'chat-new-1',
            conversationId: 'conv-new-1',
            created: true,
        });
        assert.equal(savedChats.length, 1);
        assert.equal(savedChats[0].Kind, 'Private');
        assert.equal(savedChats[0].Subject, meetingChatSubject(MEETING_PRIV));

        // Space type driver refuses chat creation via createSpaceConversation
        const refused = await ensureMeetingSpaceChat(provider, {
            spaceId: SPACE_ID,
            meetingId: MEETING_PRIV,
            meetingName: 'Executive Session',
            visibility: 'Private',
            contextUser: USER,
            createConversation: async () => ({
                ok: false,
                message: 'This space type does not allow private meeting threads.',
            }),
        });
        assert.deepEqual(refused, {
            ok: false,
            message: 'This space type does not allow private meeting threads.',
        });
    });

    it('includes a Private meeting in agent context only when all viewers are Team-band attendees of that meeting', async () => {
        const { provider } = createMeetingsProvider();

        // Chat where all viewers are Team-band attendees of MEETING_PRIV -> sees all 3 meetings
        const attendeeCtx = await buildSpaceMeetingsAgentContext(
            provider,
            SPACE_ID,
            { [USER.ID]: 'Team', [ATTENDEE_2]: 'Team' },
            USER
        );
        const attendeeMeetings = (attendeeCtx.contextData?.spaceMeetings ?? []) as Array<{ ID: string; Visibility: string }>;
        assert.equal(attendeeMeetings.length, 3);
        assert.ok(attendeeMeetings.some((m) => m.ID === MEETING_PRIV));

        // Chat with a Team-band member who is NOT an attendee of MEETING_PRIV -> Private meeting is hidden
        const nonAttendeeTeamCtx = await buildSpaceMeetingsAgentContext(
            provider,
            SPACE_ID,
            { [USER.ID]: 'Team', [NON_ATTENDEE_TEAM]: 'Team' },
            USER
        );
        const nonAttendeeMeetings = (nonAttendeeTeamCtx.contextData?.spaceMeetings ?? []) as Array<{ ID: string; Visibility: string }>;
        assert.equal(nonAttendeeMeetings.length, 2);
        assert.ok(nonAttendeeMeetings.every((m) => m.Visibility === 'Standard'));
        assert.ok(!nonAttendeeTeamCtx.instructions?.[0]?.includes('Executive Session'));

        // Mixed chat with a Shared-band participant -> Private meeting is hidden
        const sharedCtx = await buildSpaceMeetingsAgentContext(
            provider,
            SPACE_ID,
            { [USER.ID]: 'Team', [ATTENDEE_2]: 'Shared' },
            USER
        );
        const sharedMeetings = (sharedCtx.contextData?.spaceMeetings ?? []) as Array<{ ID: string; Visibility: string }>;
        assert.equal(sharedMeetings.length, 2);
        assert.ok(sharedMeetings.every((m) => m.Visibility === 'Standard'));
        assert.ok(!sharedCtx.instructions?.[0]?.includes('Executive Session'));
    });

    it('provides upcoming meetings to Collaboration Coming Up via SpaceMeetingsAgendaProvider', async () => {
        const { provider } = createMeetingsProvider();
        const agendaProvider = new SpaceMeetingsAgendaProvider();
        const items = await agendaProvider.getItemsForSpaces({
            spaceIds: [SPACE_ID],
            viewerId: USER.ID,
            provider,
        });
        assert.equal(items.length, 2);
        assert.equal(items[0].title, 'Q4 Kickoff');
        assert.equal(items[0].metadata?.videoJoinUrl, 'https://zoom.us/j/123');
    });
});
