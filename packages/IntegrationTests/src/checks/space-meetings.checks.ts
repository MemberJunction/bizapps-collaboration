import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import {
    BaseSpaceTypeServerDriver,
    buildSpaceMeetingsAgentContext,
    COLLABORATION_SPACES_ENTITY_ID,
    ensureMeetingSpaceChat,
    loadSpaceMeetings,
    MEETING_SUBJECT_PREFIX,
} from '@mj-biz-apps/collaboration-core-entities-server';
import type { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_CHAT_ENTITY, SPACE_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';
import { deleteWhere, registerChecks } from './cleanup-helpers.js';

const MEETING_ENTITY = 'MJ_BizApps_Tasks: Meetings';
const MEETING_ATTENDEE_ENTITY = 'MJ_BizApps_Tasks: Meeting Attendees';
const MEETING_LINK_ENTITY = 'MJ_BizApps_Tasks: Meeting Links';

class TestRosterSyncDriver extends BaseSpaceTypeServerDriver {}

const checks: NamedCheck[] = [
    {
        Id: 'space-meetings.SM1',
        Name: 'SM1 — BaseSpaceTypeServerDriver.SyncSeats adds, updates, and removes seats for its SyncSource without touching manual seats',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const [auditRow] = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, "Name = 'Audit committee'", ['ID']);
            Assert(!!auditRow, 'Audit committee space exists');
            const auditSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
            Assert(await auditSpace.Load(auditRow.ID), 'Audit committee space loads');

            const roles = await FindRows<{ Name: string }>(
                ctx,
                SPACE_ROLE_TYPE_ENTITY,
                'IsOwnerRole = 0 AND IsActive = 1',
                ['Name'],
            );
            Assert(roles.length >= 2, `Expected >= 2 global non-owner SpaceRoleTypes, found ${roles.length}`);
            const ada = await GetPersonaUser(ctx, 'ada');
            const nora = await GetPersonaUser(ctx, 'nora');
            const driver = new TestRosterSyncDriver();
            const syncSource = 'test:sm1-roster';

            try {
                // 1. Add Nora via SyncSeats on Audit committee (acting as Ada, the space owner)
                const added = await driver.SyncSeats(
                    auditSpace,
                    syncSource,
                    [
                        {
                            UserID: nora.ID,
                            RoleTypeName: roles[0].Name,
                        },
                    ],
                    ada,
                    ctx.Provider,
                );
                Assert(added.added === 1 && added.updated === 0 && added.removed === 0, `Expected 1 added, got ${JSON.stringify(added)}`);

                // 2. Update Nora's role to the second global role
                const updated = await driver.SyncSeats(
                    auditSpace,
                    syncSource,
                    [
                        {
                            UserID: nora.ID,
                            RoleTypeName: roles[1].Name,
                        },
                    ],
                    ada,
                    ctx.Provider,
                );
                Assert(updated.added === 0 && updated.updated === 1 && updated.removed === 0, `Expected 1 updated, got ${JSON.stringify(updated)}`);

                // 3. Remove Nora by syncing empty desired list; manual seats on Audit committee stay untouched
                const manualBefore = await FindRows<{ ID: string }>(
                    ctx,
                    SPACE_MEMBER_ENTITY,
                    `SpaceID = '${auditSpace.ID}' AND SyncSource IS NULL AND Status = 'Active'`,
                    ['ID'],
                );
                const removed = await driver.SyncSeats(auditSpace, syncSource, [], ada, ctx.Provider);
                Assert(removed.removed === 1, `Expected 1 removed, got ${JSON.stringify(removed)}`);
                const manualAfter = await FindRows<{ ID: string }>(
                    ctx,
                    SPACE_MEMBER_ENTITY,
                    `SpaceID = '${auditSpace.ID}' AND SyncSource IS NULL AND Status = 'Active'`,
                    ['ID'],
                );
                Assert(manualAfter.length === manualBefore.length, 'Manual seats on Audit committee remain untouched');
            } finally {
                await deleteWhere(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, `SyncSource = '${syncSource}'`, 'SM1 synced seats');
            }
        },
    },
    {
        Id: 'space-meetings.SM2',
        Name: 'SM2 — Space-linked Standard and Private Meetings enforce attendee-only private visibility across fnCollaborationMeetingAccess, loadSpaceMeetings, and buildSpaceMeetingsAgentContext',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const [northwind] = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, "Name = 'Northwind relationship'", ['ID']);
            Assert(!!northwind, 'Northwind relationship space exists');
            const ada = await GetPersonaUser(ctx, 'ada');
            const casey = await GetPersonaUser(ctx, 'casey');
            const dana = await GetPersonaUser(ctx, 'dana');
            const sam = await GetPersonaUser(ctx, 'sam');
            const nora = await GetPersonaUser(ctx, 'nora');
            const startsAt = new Date(Date.now() + 2 * 86_400_000);
            const endsAt = new Date(startsAt.getTime() + 3_600_000);

            const people = await FindRows<{ ID: string; Email?: string | null }>(
                ctx,
                'MJ_BizApps_Common: People',
                'ID IS NOT NULL',
                ['ID', 'Email'],
            );
            Assert(people.length > 0, 'At least one Person exists in MJ_BizApps_Common: People');
            const adaPerson = people.find((p) => (p.Email ?? '').toLowerCase() === (ada.Email ?? '').toLowerCase());
            const organizerPersonId = adaPerson?.ID ?? people[0].ID;

            let meetingId: string | null = null;
            let privateMeetingId: string | null = null;
            let spaceChatId: string | null = null;
            try {
                // 1. Standard meeting linked to Northwind relationship
                const meeting = await ctx.Provider.GetEntityObject(MEETING_ENTITY, ctx.User);
                meeting.NewRecord();
                meeting.Set('Name', 'COLLAB-CHECK Northwind Architecture Sync');
                meeting.Set('OrganizerPersonID', organizerPersonId);
                meeting.Set('StartsAt', startsAt);
                meeting.Set('EndsAt', endsAt);
                meeting.Set('TimeZone', 'America/Chicago');
                meeting.Set('Status', 'Scheduled');
                meeting.Set('LocationType', 'Virtual');
                meeting.Set('Visibility', 'Standard');
                Assert(await meeting.Save(), `Save meeting: ${meeting.LatestResult?.CompleteMessage ?? ''}`);
                meetingId = String(meeting.Get('ID'));

                const link = await ctx.Provider.GetEntityObject(MEETING_LINK_ENTITY, ctx.User);
                link.NewRecord();
                link.Set('MeetingID', meetingId);
                link.Set('EntityID', COLLABORATION_SPACES_ENTITY_ID);
                link.Set('RecordID', northwind.ID);
                Assert(await link.Save(), `Save MeetingLink: ${link.LatestResult?.CompleteMessage ?? ''}`);

                // 2. Private meeting linked to Northwind relationship where only Ada is an attendee (Sam is on Team band but not an attendee)
                const privMeeting = await ctx.Provider.GetEntityObject(MEETING_ENTITY, ctx.User);
                privMeeting.NewRecord();
                privMeeting.Set('Name', 'COLLAB-CHECK Northwind Executive Session');
                privMeeting.Set('OrganizerPersonID', organizerPersonId);
                privMeeting.Set('StartsAt', startsAt);
                privMeeting.Set('EndsAt', endsAt);
                privMeeting.Set('TimeZone', 'America/Chicago');
                privMeeting.Set('Status', 'Scheduled');
                privMeeting.Set('LocationType', 'Virtual');
                privMeeting.Set('Visibility', 'Private');
                Assert(await privMeeting.Save(), `Save private meeting: ${privMeeting.LatestResult?.CompleteMessage ?? ''}`);
                privateMeetingId = String(privMeeting.Get('ID'));

                const privLink = await ctx.Provider.GetEntityObject(MEETING_LINK_ENTITY, ctx.User);
                privLink.NewRecord();
                privLink.Set('MeetingID', privateMeetingId);
                privLink.Set('EntityID', COLLABORATION_SPACES_ENTITY_ID);
                privLink.Set('RecordID', northwind.ID);
                Assert(await privLink.Save(), `Save Private MeetingLink: ${privLink.LatestResult?.CompleteMessage ?? ''}`);

                const adaAttendee = await ctx.Provider.GetEntityObject(MEETING_ATTENDEE_ENTITY, ctx.User);
                adaAttendee.NewRecord();
                adaAttendee.Set('MeetingID', privateMeetingId);
                adaAttendee.Set('UserID', ada.ID);
                adaAttendee.Set('Email', ada.Email || 'ada@example.com');
                adaAttendee.Set('Role', 'Required');
                adaAttendee.Set('ResponseStatus', 'Accepted');
                adaAttendee.Set('AttendanceStatus', 'Unknown');
                Assert(await adaAttendee.Save(), `Save Ada attendee on private meeting: ${adaAttendee.LatestResult?.CompleteMessage ?? ''}`);

                // 3. ensureMeetingSpaceChat as persona Ada (routes through createSpaceConversation & driver gate)
                const chatRes = await ensureMeetingSpaceChat(ctx.Provider, {
                    spaceId: northwind.ID,
                    meetingId,
                    meetingName: 'COLLAB-CHECK Northwind Architecture Sync',
                    visibility: 'Standard',
                    contextUser: ada,
                });
                Assert(chatRes.ok, `ensureMeetingSpaceChat ok: ${!chatRes.ok ? chatRes.message : ''}`);
                if (chatRes.ok) {
                    spaceChatId = chatRes.spaceChatId;
                }

                // Verify SpaceChat Subject binding
                const chats = await FindRows<{ ID: string; Subject: string; Kind: string }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `ID = '${spaceChatId}'`,
                    ['ID', 'Subject', 'Kind'],
                );
                Assert(chats.length === 1 && chats[0].Subject.toLowerCase() === `${MEETING_SUBJECT_PREFIX}${meetingId.toLowerCase()}`, 'SpaceChat Subject is bound to meeting:<MeetingID>');

                // Verify loadSpaceMeetings as persona Ada
                const loaded = await loadSpaceMeetings(ctx.Provider, northwind.ID, ada, { includeDetails: true });
                Assert(loaded.upcoming.some((m) => m.ID.toLowerCase() === meetingId!.toLowerCase()), 'Standard meeting appears in loadSpaceMeetings.upcoming for Ada');

                // Verify RunView (FindRows) and loadSpaceMeetings RLS enforcement for Space Participant personas:
                // - Casey (Space Participant seated on Northwind, non-attendee of Private meeting) sees Standard meeting (1) and NOT Private meeting (0)
                const caseyMeetings = await FindRows<{ ID: string }>(
                    ctx,
                    MEETING_ENTITY,
                    `ID IN ('${meetingId}', '${privateMeetingId}')`,
                    ['ID'],
                    casey,
                    { BypassCache: true },
                );
                Assert(
                    caseyMeetings.length === 1 && caseyMeetings[0].ID.toLowerCase() === meetingId.toLowerCase(),
                    `Casey (seated Space Participant, non-attendee) sees Standard meeting only via RunView (got ${JSON.stringify(caseyMeetings)})`,
                );
                const caseyLoaded = await loadSpaceMeetings(ctx.Provider, northwind.ID, casey, { includeDetails: true });
                Assert(
                    caseyLoaded.upcoming.some((m) => m.ID.toLowerCase() === meetingId!.toLowerCase()) &&
                        !caseyLoaded.upcoming.some((m) => m.ID.toLowerCase() === privateMeetingId!.toLowerCase()),
                    'Casey loadSpaceMeetings includes Standard meeting and excludes Private meeting',
                );

                // - Sam (Team member on Northwind, non-attendee of Private meeting) sees Standard meeting (1) and NOT Private meeting (0) via RunView
                const samMeetings = await FindRows<{ ID: string }>(
                    ctx,
                    MEETING_ENTITY,
                    `ID IN ('${meetingId}', '${privateMeetingId}')`,
                    ['ID'],
                    sam,
                    { BypassCache: true },
                );
                Assert(
                    samMeetings.length === 1 && samMeetings[0].ID.toLowerCase() === meetingId.toLowerCase(),
                    `Sam (Team member, non-attendee) sees Standard meeting only and NOT Private meeting via RunView (got ${JSON.stringify(samMeetings)})`,
                );

                // - Dana (Space Participant not seated on Northwind) sees 0 rows via RunView and loadSpaceMeetings
                const danaMeetings = await FindRows<{ ID: string }>(
                    ctx,
                    MEETING_ENTITY,
                    `ID IN ('${meetingId}', '${privateMeetingId}')`,
                    ['ID'],
                    dana,
                    { BypassCache: true },
                );
                Assert(
                    danaMeetings.length === 0,
                    `Dana (Space Participant outsider to Northwind) sees 0 meetings via RunView (got ${JSON.stringify(danaMeetings)})`,
                );
                const danaLoaded = await loadSpaceMeetings(ctx.Provider, northwind.ID, dana, { includeDetails: true });
                Assert(danaLoaded.meetings.length === 0, `Dana sees 0 meetings via loadSpaceMeetings (got ${danaLoaded.meetings.length})`);

                // Verify buildSpaceMeetingsAgentContext as persona Ada:
                // - When Ada is the only viewer (attendee of Private meeting), both Standard and Private meetings are included
                const adaSoloCtx = await buildSpaceMeetingsAgentContext(ctx.Provider, northwind.ID, { [ada.ID]: 'Team' }, ada);
                Assert((adaSoloCtx.instructions ?? []).some((line) => line.includes('Northwind Architecture Sync')), 'Ada solo agent context includes Standard meeting');
                Assert((adaSoloCtx.instructions ?? []).some((line) => line.includes('Northwind Executive Session')), 'Ada solo agent context includes Private meeting where Ada is attendee');

                // - Negative case: when Sam (Team member, NOT an attendee of Private meeting) is also in viewerBands, Private meeting is excluded
                const adaAndSamCtx = await buildSpaceMeetingsAgentContext(ctx.Provider, northwind.ID, { [ada.ID]: 'Team', [sam.ID]: 'Team' }, ada);
                Assert((adaAndSamCtx.instructions ?? []).some((line) => line.includes('Northwind Architecture Sync')), 'Ada+Sam agent context includes Standard meeting');
                Assert(
                    !(adaAndSamCtx.instructions ?? []).some((line) => line.includes('Northwind Executive Session')),
                    `Ada+Sam agent context excludes Private meeting because Sam is not an attendee (loaded=${JSON.stringify(loaded.meetings.map((m) => ({ Name: m.Name, Visibility: m.Visibility })))} instructions=${JSON.stringify(adaAndSamCtx.instructions)})`,
                );

                // Verify fnCollaborationMeetingAccess SQL one-walk function directly for positive and negative persona cases
                const pool = (ctx as unknown as { Pool?: { request(): { query(sql: string): Promise<{ recordset: Array<{ MeetingID: string; CanSeeTeam: boolean }> }> } } }).Pool;
                if (pool) {
                    const adaAccess = await pool
                        .request()
                        .query(`SELECT MeetingID, CanSeeTeam FROM __mj_BizAppsCollaboration.fnCollaborationMeetingAccess('${ada.ID}') WHERE MeetingID IN ('${meetingId}', '${privateMeetingId}')`);
                    Assert(adaAccess.recordset.length === 2, `Ada (attendee) reaches both Standard and Private meetings via fnCollaborationMeetingAccess (got ${adaAccess.recordset.length})`);

                    const samAccess = await pool
                        .request()
                        .query(`SELECT MeetingID, CanSeeTeam FROM __mj_BizAppsCollaboration.fnCollaborationMeetingAccess('${sam.ID}') WHERE MeetingID IN ('${meetingId}', '${privateMeetingId}')`);
                    Assert(
                        samAccess.recordset.length === 1 && samAccess.recordset[0].MeetingID.toLowerCase() === meetingId.toLowerCase(),
                        `Sam (Team member but non-attendee) reaches Standard meeting only and NOT Private meeting via fnCollaborationMeetingAccess (got ${JSON.stringify(samAccess.recordset)})`,
                    );

                    const noraAccess = await pool
                        .request()
                        .query(`SELECT MeetingID FROM __mj_BizAppsCollaboration.fnCollaborationMeetingAccess('${nora.ID}') WHERE MeetingID IN ('${meetingId}', '${privateMeetingId}')`);
                    Assert(noraAccess.recordset.length === 0, `Nora (non-member of Northwind) reaches neither meeting via fnCollaborationMeetingAccess (got ${noraAccess.recordset.length})`);
                }
            } finally {
                if (spaceChatId) {
                    const chats = await FindRows<{ ConversationID: string }>(ctx, SPACE_CHAT_ENTITY, `ID = '${spaceChatId}'`, ['ConversationID']);
                    await deleteWhere(ctx.Provider, ctx.User, SPACE_CHAT_ENTITY, `ID = '${spaceChatId}'`, 'SM2 space chat');
                    if (chats[0]?.ConversationID) {
                        await deleteWhere(ctx.Provider, ctx.User, 'MJ: Resource Permissions', `ResourceRecordID = '${chats[0].ConversationID}'`, 'SM2 chat permissions');
                        await deleteWhere(ctx.Provider, ctx.User, 'MJ: Conversations', `ID = '${chats[0].ConversationID}'`, 'SM2 conversation');
                    }
                }
                for (const mId of [meetingId, privateMeetingId]) {
                    if (mId) {
                        await deleteWhere(ctx.Provider, ctx.User, MEETING_LINK_ENTITY, `MeetingID = '${mId}'`, 'SM2 meeting link');
                        await deleteWhere(ctx.Provider, ctx.User, MEETING_ATTENDEE_ENTITY, `MeetingID = '${mId}'`, 'SM2 meeting attendees');
                        await deleteWhere(ctx.Provider, ctx.User, MEETING_ENTITY, `ID = '${mId}'`, 'SM2 meeting');
                    }
                }
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('space-meetings', {
    Setup: async () => {},
    Teardown: async () => {},
});
