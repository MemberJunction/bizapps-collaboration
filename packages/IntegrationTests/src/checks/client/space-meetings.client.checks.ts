/**
 * Space Meetings over the GraphQL wire: scheduling a meeting in a space (`CreateSpaceMeeting`)
 * and ensuring its linked `meeting:<ID>` space chat (`EnsureMeetingSpaceChat`), exercised both
 * as the space owner (`ada`) and as an outside contributor (`casey`) who holds `CanCreate: 0`
 * on `MJ_BizApps_Tasks: Meetings` directly.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient } from '@mj-biz-apps/collaboration-entities';
import { SPACE_CHAT_ENTITY, SPACE_ITEM_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext } from '../../wire.js';
import { cleanupConversation, deleteWhere, registerChecks } from '../cleanup-helpers.js';

const NORTHWIND = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';
const MEETING_ENTITY = 'MJ_BizApps_Tasks: Meetings';
const MEETING_ATTENDEE_ENTITY = 'MJ_BizApps_Tasks: Meeting Attendees';
const MEETING_LINK_ENTITY = 'MJ_BizApps_Tasks: Meeting Links';
const SHARE_NOTICE_ENTITY = 'MJ_BizApps_Collaboration: Share Notices';
const MARK = 'COLLAB-CHECK space-meetings wire';

type ClientPersona = Awaited<ReturnType<typeof getPersonaClientContext>>;
const asPersona = (ctx: IntegrationCheckContext, persona: ClientPersona): IntegrationCheckContext =>
    ({ ...ctx, Provider: persona.Provider, User: persona.User } as IntegrationCheckContext);
const clientOf = (persona: ClientPersona): CollaborationClient => new CollaborationClient(persona.GraphQLProvider);

async function cleanupMeeting(ctx: IntegrationCheckContext, meetingId: string | null): Promise<void> {
    if (!meetingId) return;
    const items = await FindRows<{ ID: string }>(
        ctx,
        SPACE_ITEM_ENTITY,
        `RecordID IN ('${meetingId}', 'ID|${meetingId}')`,
        ['ID'],
        undefined,
        { BypassCache: true },
    );
    for (const item of items) {
        await deleteWhere(ctx.Provider, ctx.User, SHARE_NOTICE_ENTITY, `ItemID = '${item.ID}'`, 'space meeting share notice');
    }
    await deleteWhere(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, `RecordID IN ('${meetingId}', 'ID|${meetingId}')`, 'space meeting item');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_LINK_ENTITY, `MeetingID = '${meetingId}'`, 'space meeting link');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_ATTENDEE_ENTITY, `MeetingID = '${meetingId}'`, 'space meeting attendees');
    await deleteWhere(ctx.Provider, ctx.User, MEETING_ENTITY, `ID = '${meetingId}'`, 'space meeting');
}

const checks: NamedCheck[] = [
    {
        Id: 'space-meetings.SMC1',
        Name: 'SMC1 — over the wire: Ada schedules a Standard meeting via CreateSpaceMeeting and opens its meeting:<ID> chat via EnsureMeetingSpaceChat',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const casey = await getPersonaClientContext(ctx, 'casey');
            const startsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
            const endsAt = new Date(Date.now() + 2 * 86_400_000 + 3_600_000).toISOString();

            let meetingId: string | null = null;
            let conversationId: string | null = null;
            let spaceChatId: string | null = null;
            try {
                const created = await clientOf(ada).CreateSpaceMeeting({
                    SpaceID: NORTHWIND,
                    Name: `${MARK} Kickoff`,
                    Description: 'Walkthrough of Q4 deliverables',
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    VideoJoinURL: 'https://meet.example.com/kickoff',
                    Visibility: 'Standard',
                });
                Assert(
                    created.Success === true && !!created.MeetingID,
                    `Ada schedules a Standard meeting over the wire: ${created.ErrorMessage ?? ''}`,
                );
                meetingId = created.MeetingID!;

                const caseySees = await FindRows<{ ID: string; Name: string }>(
                    asPersona(ctx, casey),
                    MEETING_ENTITY,
                    `ID = '${meetingId}'`,
                    ['ID', 'Name'],
                    casey.User,
                    { BypassCache: true },
                );
                Assert(caseySees.length === 1, 'Casey reads the Standard meeting on Northwind over the wire');

                const items = await FindRows<{ ID: string; Band: string }>(
                    ctx,
                    SPACE_ITEM_ENTITY,
                    `SpaceID = '${NORTHWIND}' AND RecordID IN ('${meetingId}', 'ID|${meetingId}')`,
                    ['ID', 'Band'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(items.length === 1 && items[0].Band === 'Shared', `Meeting Space Item is filed on Shared band (got ${JSON.stringify(items)})`);

                const chatFirst = await clientOf(ada).EnsureMeetingSpaceChat({
                    SpaceID: NORTHWIND,
                    MeetingID: meetingId,
                    MeetingName: `${MARK} Kickoff`,
                    Visibility: 'Standard',
                });
                Assert(
                    chatFirst.Success === true && !!chatFirst.ConversationID && !!chatFirst.SpaceChatID && chatFirst.Created === true,
                    `EnsureMeetingSpaceChat creates the meeting thread: ${chatFirst.ErrorMessage ?? ''}`,
                );
                conversationId = chatFirst.ConversationID!;
                spaceChatId = chatFirst.SpaceChatID!;

                const chatSecond = await clientOf(casey).EnsureMeetingSpaceChat({
                    SpaceID: NORTHWIND,
                    MeetingID: meetingId,
                    MeetingName: `${MARK} Kickoff`,
                    Visibility: 'Standard',
                });
                Assert(
                    chatSecond.Success === true &&
                        chatSecond.ConversationID?.toLowerCase() === conversationId.toLowerCase() &&
                        chatSecond.Created === false,
                    `EnsureMeetingSpaceChat reuses the existing meeting thread for Casey: ${JSON.stringify(chatSecond)}`,
                );

                const [spaceChat] = await FindRows<{ Subject: string }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `ID = '${spaceChatId}'`,
                    ['Subject'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(
                    !!spaceChat && spaceChat.Subject.toLowerCase() === `meeting:${meetingId.toLowerCase()}`,
                    `Space Chat Subject is meeting:<MeetingID> (got ${spaceChat?.Subject})`,
                );
            } finally {
                if (conversationId || spaceChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, conversationId, spaceChatId);
                }
                await cleanupMeeting(ctx, meetingId);
            }
        },
    },
    {
        Id: 'space-meetings.SMC2',
        Name: 'SMC2 — over the wire: Casey schedules Standard and is refused on Private; Sam (Team member without promote) schedules Private and is refused on Standard; cross-space chat binding and outsider Dana are refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await getPersonaClientContext(ctx, 'ada');
            const sam = await getPersonaClientContext(ctx, 'sam');
            const casey = await getPersonaClientContext(ctx, 'casey');
            const dana = await getPersonaClientContext(ctx, 'dana');
            const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
            const endsAt = new Date(Date.now() + 3 * 86_400_000 + 3_600_000).toISOString();

            let meetingId: string | null = null;
            let samMeetingId: string | null = null;
            try {
                const visibleRes = await clientOf(casey).CreateSpaceMeeting({
                    SpaceID: NORTHWIND,
                    Name: `${MARK} Client Sync`,
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    Visibility: 'Standard',
                });
                Assert(
                    visibleRes.Success === true && !!visibleRes.MeetingID,
                    `Casey (outside contributor) schedules a Standard meeting over the wire: ${visibleRes.ErrorMessage ?? ''}`,
                );
                meetingId = visibleRes.MeetingID!;

                const privateRefused = await clientOf(casey).CreateSpaceMeeting({
                    SpaceID: NORTHWIND,
                    Name: `${MARK} Secret Team Sync`,
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    Visibility: 'Private',
                });
                Assert(
                    privateRefused.Success === false && /only team members/i.test(privateRefused.ErrorMessage ?? ''),
                    `Casey is refused when scheduling a Private (Team-only) meeting: ${privateRefused.ErrorMessage ?? ''}`,
                );

                const samStandardRefused = await clientOf(sam).CreateSpaceMeeting({
                    SpaceID: NORTHWIND,
                    Name: `${MARK} Sam Unpromoted Standard`,
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    Visibility: 'Standard',
                });
                Assert(
                    samStandardRefused.Success === false && /cannot change the band/i.test(samStandardRefused.ErrorMessage ?? ''),
                    `Sam (Team member without promote rights) is refused when scheduling a Standard (Shared-band) meeting: ${samStandardRefused.ErrorMessage ?? ''}`,
                );

                const samPrivateCreated = await clientOf(sam).CreateSpaceMeeting({
                    SpaceID: NORTHWIND,
                    Name: `${MARK} Sam Team Sync`,
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    Visibility: 'Private',
                });
                Assert(
                    samPrivateCreated.Success === true && !!samPrivateCreated.MeetingID,
                    `Sam schedules a Private (Team-band) meeting over the wire: ${samPrivateCreated.ErrorMessage ?? ''}`,
                );
                samMeetingId = samPrivateCreated.MeetingID!;

                const crossSpaceRefused = await clientOf(ada).EnsureMeetingSpaceChat({
                    SpaceID: DISCOVERY,
                    MeetingID: meetingId,
                    MeetingName: `${MARK} Client Sync`,
                    Visibility: 'Standard',
                });
                Assert(
                    crossSpaceRefused.Success === false && /does not belong to this space/i.test(crossSpaceRefused.ErrorMessage ?? ''),
                    `EnsureMeetingSpaceChat refuses a meeting that belongs to another space: ${crossSpaceRefused.ErrorMessage ?? ''}`,
                );

                const danaRefusedCreate = await clientOf(dana).CreateSpaceMeeting({
                    SpaceID: NORTHWIND,
                    Name: `${MARK} Outsider Sync`,
                    StartsAt: startsAt,
                    EndsAt: endsAt,
                    TimeZone: 'America/Chicago',
                    LocationType: 'Virtual',
                    Visibility: 'Standard',
                });
                Assert(
                    danaRefusedCreate.Success === false && /not reach/i.test(danaRefusedCreate.ErrorMessage ?? ''),
                    `Dana (outsider) is refused from CreateSpaceMeeting: ${danaRefusedCreate.ErrorMessage ?? ''}`,
                );

                const danaRefusedChat = await clientOf(dana).EnsureMeetingSpaceChat({
                    SpaceID: NORTHWIND,
                    MeetingID: meetingId,
                    MeetingName: `${MARK} Client Sync`,
                    Visibility: 'Standard',
                });
                Assert(
                    danaRefusedChat.Success === false,
                    `Dana (outsider) is refused from EnsureMeetingSpaceChat: ${JSON.stringify(danaRefusedChat)}`,
                );
            } finally {
                await cleanupMeeting(ctx, samMeetingId);
                await cleanupMeeting(ctx, meetingId);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('space-meetings', {
    Setup: async () => {},
    Teardown: async () => {},
});
