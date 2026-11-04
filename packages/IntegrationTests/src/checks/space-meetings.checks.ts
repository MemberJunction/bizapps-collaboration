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
        Name: 'SM2 — Space-linked Meeting with ensureMeetingSpaceChat surfaces in loadSpaceMeetings and buildSpaceMeetingsAgentContext, and fnCollaborationMeetingAccess enforces one-walk reach',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const [northwind] = await FindRows<{ ID: string }>(ctx, SPACE_ENTITY, "Name = 'Northwind relationship'", ['ID']);
            Assert(!!northwind, 'Northwind relationship space exists');
            const ada = await GetPersonaUser(ctx, 'ada');
            const startsAt = new Date(Date.now() + 2 * 86_400_000);
            const endsAt = new Date(startsAt.getTime() + 3_600_000);

            const people = await FindRows<{ ID: string }>(ctx, 'MJ_BizApps_Common: People', 'ID IS NOT NULL', ['ID']);
            Assert(people.length > 0, 'At least one Person exists in MJ_BizApps_Common: People');

            let meetingId: string | null = null;
            let spaceChatId: string | null = null;
            try {
                const meeting = await ctx.Provider.GetEntityObject(MEETING_ENTITY, ctx.User);
                meeting.NewRecord();
                meeting.Set('Name', 'COLLAB-CHECK Northwind Architecture Sync');
                meeting.Set('OrganizerPersonID', people[0].ID);
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

                const chatRes = await ensureMeetingSpaceChat(ctx.Provider, {
                    spaceId: northwind.ID,
                    meetingId,
                    meetingName: 'COLLAB-CHECK Northwind Architecture Sync',
                    visibility: 'Standard',
                    contextUser: ctx.User,
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

                // Verify loadSpaceMeetings
                const loaded = await loadSpaceMeetings(ctx.Provider, northwind.ID, ctx.User, { includeDetails: true });
                Assert(loaded.upcoming.some((m) => m.ID.toLowerCase() === meetingId!.toLowerCase()), 'Meeting appears in loadSpaceMeetings.upcoming');

                // Verify buildSpaceMeetingsAgentContext
                const agentCtx = await buildSpaceMeetingsAgentContext(ctx.Provider, northwind.ID, { [ada.ID]: 'Team' }, ctx.User);
                Assert((agentCtx.instructions ?? []).some((line) => line.includes('Northwind Architecture Sync')), 'buildSpaceMeetingsAgentContext includes the bound meeting title');

                // Verify fnCollaborationMeetingAccess SQL one-walk function directly
                const pool = (ctx as unknown as { Pool?: { request(): { query(sql: string): Promise<{ recordset: Array<{ MeetingID: string; CanSeeTeam: boolean }> }> } } }).Pool;
                if (pool) {
                    const adaAccess = await pool
                        .request()
                        .query(`SELECT MeetingID, CanSeeTeam FROM __mj_BizAppsCollaboration.fnCollaborationMeetingAccess('${ada.ID}') WHERE MeetingID = '${meetingId}'`);
                    Assert(adaAccess.recordset.length === 1 && adaAccess.recordset[0].CanSeeTeam === true, 'Ada (active Team space member) reaches meeting with CanSeeTeam=1 via fnCollaborationMeetingAccess');
                }
            } finally {
                if (spaceChatId) {
                    await deleteWhere(ctx.Provider, ctx.User, SPACE_CHAT_ENTITY, `ID = '${spaceChatId}'`, 'SM2 space chat');
                }
                if (meetingId) {
                    await deleteWhere(ctx.Provider, ctx.User, MEETING_LINK_ENTITY, `MeetingID = '${meetingId}'`, 'SM2 meeting link');
                    await deleteWhere(ctx.Provider, ctx.User, MEETING_ATTENDEE_ENTITY, `MeetingID = '${meetingId}'`, 'SM2 meeting attendees');
                    await deleteWhere(ctx.Provider, ctx.User, MEETING_ENTITY, `ID = '${meetingId}'`, 'SM2 meeting');
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
