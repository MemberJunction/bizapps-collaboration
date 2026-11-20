import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WellKnownUserSource, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import {
    COLLABORATION_SPACES_ENTITY_ID,
    SpaceMeetingsAgendaProvider,
    buildSpaceMeetingsAgentContext,
    createSpaceMeeting,
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

        // Meeting that does not belong to SPACE_ID is refused
        const unlinkedMeeting = await ensureMeetingSpaceChat(provider, {
            spaceId: SPACE_ID,
            meetingId: '33333333-3333-4333-8333-333333333399',
            meetingName: 'Unlinked Meeting',
            visibility: 'Standard',
            contextUser: USER,
        });
        assert.deepEqual(unlinkedMeeting, {
            ok: false,
            message: 'Meeting chat refused: this meeting does not belong to this space.',
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

    it('createSpaceMeeting writes Meeting + MeetingLink as system user, enforces band promotion rules, and rolls back on failure', async () => {
        const SYSTEM_USER = { ID: '00000000-0000-4000-8000-000000000000', Name: 'System' } as UserInfo;
        const TEAM_MEMBER = { ID: '11111111-1111-4111-8111-111111111120', Name: 'Bea' } as UserInfo;
        const OUTSIDE_CONTRIBUTOR = { ID: '11111111-1111-4111-8111-111111111121', Name: 'Casey' } as UserInfo;
        const READ_ONLY_GUEST = { ID: '11111111-1111-4111-8111-111111111122', Name: 'Guest' } as UserInfo;
        const PERSON_ADA = '55555555-5555-4555-8555-555555555551';
        const PERSON_BEA = '55555555-5555-4555-8555-555555555550';
        const PERSON_CASEY = '55555555-5555-4555-8555-555555555552';
        const OWNER_ROLE = '66666666-6666-4666-8666-666666666661';
        const MEMBER_ROLE = '66666666-6666-4666-8666-666666666660';
        const CLIENT_ROLE = '66666666-6666-4666-8666-666666666662';
        const GUEST_ROLE = '66666666-6666-4666-8666-666666666663';
        const SPACE_TYPE_ID = '77777777-7777-4777-8777-777777777771';
        const MEETINGS_ENTITY_ID = '88888888-8888-4888-8888-888888888881';

        const savedMeetings: Array<{ actorId: string; draft: Record<string, unknown> }> = [];
        const deletedMeetingIds: string[] = [];
        const deletedAttendeeIds: string[] = [];
        const savedLinks: Array<{ actorId: string; draft: Record<string, unknown> }> = [];
        const deletedLinkIds: string[] = [];
        const savedItems: Array<{ actorId: string; draft: Record<string, unknown> }> = [];
        let refuseSpaceItem = false;

        const origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser;
        WellKnownUserSource.Instance.GetSystemUser = async () => SYSTEM_USER;

        try {
            const runView = async (params: { EntityName: string; ExtraFilter?: string }) => {
                const f = params.ExtraFilter ?? '';
                if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return {
                        Success: true,
                        Results: [
                            {
                                ID: SPACE_ID,
                                ParentID: null,
                                InheritsMembership: true,
                                OwnerID: USER.ID,
                                AgentRetrieval: 'Included',
                                SpaceTypeID: SPACE_TYPE_ID,
                                ClosedAt: null,
                                StatusID: null,
                            },
                        ],
                    };
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    const allMembers = [
                        {
                            ID: 'm-1',
                            SpaceID: SPACE_ID,
                            UserID: USER.ID,
                            Status: 'Active',
                            Band: 'Team',
                            SpaceRoleTypeID: OWNER_ROLE,
                        },
                        {
                            ID: 'm-bea',
                            SpaceID: SPACE_ID,
                            UserID: TEAM_MEMBER.ID,
                            Status: 'Active',
                            Band: 'Team',
                            SpaceRoleTypeID: MEMBER_ROLE,
                        },
                        {
                            ID: 'm-2',
                            SpaceID: SPACE_ID,
                            UserID: OUTSIDE_CONTRIBUTOR.ID,
                            Status: 'Active',
                            Band: 'Shared',
                            SpaceRoleTypeID: CLIENT_ROLE,
                        },
                        {
                            ID: 'm-3',
                            SpaceID: SPACE_ID,
                            UserID: READ_ONLY_GUEST.ID,
                            Status: 'Active',
                            Band: 'Shared',
                            SpaceRoleTypeID: GUEST_ROLE,
                        },
                    ];
                    if (f.includes(`UserID = '${USER.ID.toLowerCase()}'`)) {
                        return { Success: true, Results: [allMembers[0]] };
                    }
                    if (f.includes(`UserID = '${TEAM_MEMBER.ID.toLowerCase()}'`)) {
                        return { Success: true, Results: [allMembers[1]] };
                    }
                    if (f.includes(`UserID = '${OUTSIDE_CONTRIBUTOR.ID.toLowerCase()}'`)) {
                        return { Success: true, Results: [allMembers[2]] };
                    }
                    if (f.includes(`UserID = '${READ_ONLY_GUEST.ID.toLowerCase()}'`)) {
                        return { Success: true, Results: [allMembers[3]] };
                    }
                    return { Success: true, Results: allMembers };
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return {
                        Success: true,
                        Results: [
                            {
                                ID: OWNER_ROLE,
                                Level: 40,
                                MaxGrantableLevel: 40,
                                CanInvite: true,
                                CanPromoteBand: true,
                                CanSeeTeamBand: true,
                                IsOwnerRole: true,
                                CanContribute: true,
                            },
                            {
                                ID: MEMBER_ROLE,
                                Level: 30,
                                MaxGrantableLevel: 20,
                                CanInvite: false,
                                CanPromoteBand: false,
                                CanSeeTeamBand: true,
                                IsOwnerRole: false,
                                CanContribute: true,
                            },
                            {
                                ID: CLIENT_ROLE,
                                Level: 20,
                                MaxGrantableLevel: 20,
                                CanInvite: false,
                                CanPromoteBand: false,
                                CanSeeTeamBand: false,
                                IsOwnerRole: false,
                                CanContribute: true,
                            },
                            {
                                ID: GUEST_ROLE,
                                Level: 10,
                                MaxGrantableLevel: 10,
                                CanInvite: false,
                                CanPromoteBand: false,
                                CanSeeTeamBand: false,
                                IsOwnerRole: false,
                                CanContribute: false,
                            },
                        ],
                    };
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                    return {
                        Success: true,
                        Results: [{ ID: SPACE_TYPE_ID, InviteApproval: 'Approve', MemberCap: null }],
                    };
                }
                if (params.EntityName === 'MJ_BizApps_Common: People') {
                    if (f.includes(USER.ID)) {
                        return { Success: true, Results: [{ ID: PERSON_ADA }] };
                    }
                    if (f.includes(TEAM_MEMBER.ID)) {
                        return { Success: true, Results: [{ ID: PERSON_BEA }] };
                    }
                    if (f.includes(OUTSIDE_CONTRIBUTOR.ID)) {
                        return { Success: true, Results: [{ ID: PERSON_CASEY }] };
                    }
                }
                if (params.EntityName === 'MJ_BizApps_Tasks: Meeting Attendees') {
                    return {
                        Success: true,
                        Results: [{ ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' }],
                    };
                }
                return { Success: true, Results: [] };
            };

            const provider: Record<string, unknown> = {
                RunView: runView,
                RunViews: async (queries: Array<{ EntityName: string; ExtraFilter?: string }>) =>
                    Promise.all(queries.map(runView)),
                EntityByID: () => null,
                EntityByName: (name: string) => {
                    if (name === 'MJ_BizApps_Tasks: Meetings') {
                        return { ID: MEETINGS_ENTITY_ID, Name: 'MJ_BizApps_Tasks: Meetings' };
                    }
                    if (name === 'MJ_BizApps_Collaboration: Spaces') {
                        return { ID: COLLABORATION_SPACES_ENTITY_ID, Name: 'MJ_BizApps_Collaboration: Spaces' };
                    }
                    return null;
                },
                GetEntityObject: async (entityName: string, actor?: UserInfo) => {
                    const actorId = actor?.ID ?? 'unknown';
                    if (entityName === 'MJ_BizApps_Collaboration: Space Items') {
                        const draft: Record<string, unknown> = {};
                        return {
                            ProviderToUse: provider,
                            RunViewProviderToUse: provider,
                            get ID() {
                                return draft.ID as string;
                            },
                            set SpaceID(v: string) {
                                draft.SpaceID = v;
                            },
                            set EntityID(v: string) {
                                draft.EntityID = v;
                            },
                            set RecordID(v: string) {
                                draft.RecordID = v;
                            },
                            set Band(v: string) {
                                draft.Band = v;
                            },
                            NewRecord() {
                                draft.ID = `item-${savedItems.length + 1}`;
                            },
                            async Save() {
                                if (refuseSpaceItem) return false;
                                savedItems.push({ actorId, draft: { ...draft } });
                                return true;
                            },
                        };
                    }
                    if (entityName === 'MJ_BizApps_Tasks: Meeting Attendees') {
                        let loadedId = '';
                        return {
                            async Load(id: string) {
                                loadedId = id;
                                return true;
                            },
                            async Delete() {
                                deletedAttendeeIds.push(loadedId);
                                return true;
                            },
                        };
                    }
                    if (entityName === 'MJ_BizApps_Tasks: Meetings') {
                        const draft: Record<string, unknown> = {};
                        return {
                            get ID() {
                                return draft.ID as string;
                            },
                            set Name(v: string) {
                                draft.Name = v;
                            },
                            set Description(v: string | null) {
                                draft.Description = v;
                            },
                            set TypeID(v: string | null) {
                                draft.TypeID = v;
                            },
                            set StartsAt(v: Date) {
                                draft.StartsAt = v;
                            },
                            set EndsAt(v: Date) {
                                draft.EndsAt = v;
                            },
                            set TimeZone(v: string) {
                                draft.TimeZone = v;
                            },
                            set Status(v: string) {
                                draft.Status = v;
                            },
                            set LocationType(v: string) {
                                draft.LocationType = v;
                            },
                            set Location(v: string | null) {
                                draft.Location = v;
                            },
                            set VideoJoinURL(v: string | null) {
                                draft.VideoJoinURL = v;
                            },
                            set Visibility(v: string) {
                                draft.Visibility = v;
                            },
                            set OrganizerPersonID(v: string) {
                                draft.OrganizerPersonID = v;
                            },
                            set CreatedByPersonID(v: string | null) {
                                draft.CreatedByPersonID = v;
                            },
                            NewRecord() {
                                draft.ID = `99999999-9999-4999-8999-99999999999${savedMeetings.length + 1}`;
                            },
                            async Load(id: string) {
                                draft.ID = id;
                                return true;
                            },
                            async Save() {
                                savedMeetings.push({ actorId, draft: { ...draft } });
                                return true;
                            },
                            async Delete() {
                                deletedMeetingIds.push(draft.ID as string);
                                return true;
                            },
                        };
                    }
                    if (entityName === 'MJ_BizApps_Tasks: Meeting Links') {
                        const draft: Record<string, unknown> = {};
                        return {
                            get ID() {
                                return draft.ID as string;
                            },
                            set MeetingID(v: string) {
                                draft.MeetingID = v;
                            },
                            set EntityID(v: string) {
                                draft.EntityID = v;
                            },
                            set RecordID(v: string) {
                                draft.RecordID = v;
                            },
                            set Description(v: string | null) {
                                draft.Description = v;
                            },
                            NewRecord() {
                                draft.ID = `link-${savedLinks.length + 1}`;
                            },
                            async Save() {
                                savedLinks.push({ actorId, draft: { ...draft } });
                                return true;
                            },
                            async Delete() {
                                deletedLinkIds.push(draft.ID as string);
                                return true;
                            },
                        };
                    }
                    return null;
                },
            };

            const typedProvider = provider as unknown as IMetadataProvider;

            // 1. Validation refusal when end <= start
            const invalidDates = await createSpaceMeeting(typedProvider, USER, {
                spaceId: SPACE_ID,
                name: 'Bad Dates',
                startsAt: '2026-12-10T16:00:00.000Z',
                endsAt: '2026-12-10T15:00:00.000Z',
                timeZone: 'America/Chicago',
            });
            assert.equal(invalidDates.ok, false);

            // 2. Read-only guest seat is refused
            const guestRefused = await createSpaceMeeting(typedProvider, READ_ONLY_GUEST, {
                spaceId: SPACE_ID,
                name: 'Guest Attempt',
                startsAt: '2026-12-10T15:00:00.000Z',
                endsAt: '2026-12-10T16:00:00.000Z',
                timeZone: 'America/Chicago',
            });
            assert.equal(guestRefused.ok, false);

            // 3. Outside contributor cannot schedule a Private meeting
            const privateRefused = await createSpaceMeeting(typedProvider, OUTSIDE_CONTRIBUTOR, {
                spaceId: SPACE_ID,
                name: 'Outside Private Attempt',
                startsAt: '2026-12-10T15:00:00.000Z',
                endsAt: '2026-12-10T16:00:00.000Z',
                timeZone: 'America/Chicago',
                visibility: 'Private',
            });
            assert.equal(privateRefused.ok, false);

            // 4. Team member who sees Team but lacks CanPromoteBand is refused when scheduling a Standard (Shared) meeting
            const memberStdRefused = await createSpaceMeeting(typedProvider, TEAM_MEMBER, {
                spaceId: SPACE_ID,
                name: 'Member Standard Attempt',
                startsAt: '2026-12-10T15:00:00.000Z',
                endsAt: '2026-12-10T16:00:00.000Z',
                timeZone: 'America/Chicago',
                visibility: 'Standard',
            });
            assert.equal(memberStdRefused.ok, false);
            if (!memberStdRefused.ok) {
                assert.match(memberStdRefused.message, /cannot change the band/i);
            }
            assert.equal(savedMeetings.length, 0, 'no meeting row should be written when the band gate refuses');

            // 5. Same Team member CAN schedule a Private (Team) meeting
            const memberPrivCreated = await createSpaceMeeting(typedProvider, TEAM_MEMBER, {
                spaceId: SPACE_ID,
                name: 'Member Private Sync',
                startsAt: '2026-12-10T15:00:00.000Z',
                endsAt: '2026-12-10T16:00:00.000Z',
                timeZone: 'America/Chicago',
                visibility: 'Private',
            });
            assert.equal(memberPrivCreated.ok, true);
            if (memberPrivCreated.ok) {
                assert.equal(memberPrivCreated.band, 'Team');
                assert.equal(memberPrivCreated.itemId, 'item-1');
            }
            assert.equal(savedMeetings.length, 1);
            assert.equal(savedMeetings[0].draft.OrganizerPersonID, PERSON_BEA);
            assert.equal(savedItems.length, 1);
            assert.equal(savedItems[0].actorId, TEAM_MEMBER.ID);
            assert.equal(savedItems[0].draft.Band, 'Team');

            // 6. Outside contributor schedules a Standard meeting -> system writes Meeting + MeetingLink, caller files Shared SpaceItem
            const createdStd = await createSpaceMeeting(typedProvider, OUTSIDE_CONTRIBUTOR, {
                spaceId: SPACE_ID,
                name: 'Client Sync',
                startsAt: '2026-12-10T15:00:00.000Z',
                endsAt: '2026-12-10T16:00:00.000Z',
                timeZone: 'America/Chicago',
                visibility: 'Standard',
                videoJoinUrl: 'https://zoom.us/j/999',
            });
            assert.equal(createdStd.ok, true);
            if (createdStd.ok) {
                assert.equal(createdStd.band, 'Shared');
                assert.equal(createdStd.itemId, 'item-2');
            }
            assert.equal(savedMeetings.length, 2);
            assert.equal(savedMeetings[1].actorId, SYSTEM_USER.ID);
            assert.equal(savedMeetings[1].draft.OrganizerPersonID, PERSON_CASEY);
            assert.equal(savedMeetings[1].draft.CreatedByPersonID, PERSON_CASEY);
            assert.equal(savedLinks.length, 2);
            assert.equal(savedLinks[1].actorId, SYSTEM_USER.ID);
            assert.equal(savedItems.length, 2);
            assert.equal(savedItems[1].actorId, OUTSIDE_CONTRIBUTOR.ID);
            assert.equal(savedItems[1].draft.Band, 'Shared');

            // 7. When SpaceItem save fails, createSpaceMeeting rolls back link, organizer attendee row, and meeting
            refuseSpaceItem = true;
            const rollbackResult = await createSpaceMeeting(typedProvider, USER, {
                spaceId: SPACE_ID,
                name: 'Rollback Prep',
                startsAt: '2026-12-11T15:00:00.000Z',
                endsAt: '2026-12-11T16:00:00.000Z',
                timeZone: 'America/Chicago',
                visibility: 'Private',
            });
            assert.equal(rollbackResult.ok, false);
            assert.equal(deletedLinkIds.length, 1);
            assert.equal(deletedAttendeeIds.length, 1);
            assert.equal(deletedMeetingIds.length, 1);
        } finally {
            WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        }
    });
});
