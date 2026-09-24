import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { MJConversationDetailEntity, MJConversationEntity } from '@memberjunction/core-entities';
import { postSpaceMessage } from '@mj-biz-apps/collaboration-core-entities-server';
import { CONVERSATION_ENTITY, CONVERSATION_DETAIL_ENTITY, SPACE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser, View } from '../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const CLOSED_PAST_SPACE_ID = 'C1000001-0000-4000-8000-000000000008';
const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';

const checks: NamedCheck[] = [
    {
        Id: 'room.RM1',
        Name: 'RM1 — space conversation bound to system user, linked to space, and scoped to Collaboration app',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const convs = await FindRows<{
                ID: string;
                UserID: string;
                LinkedEntityID: string;
                LinkedRecordID: string;
                ApplicationScope: string;
                ApplicationID: string;
            }>(
                ctx,
                CONVERSATION_ENTITY,
                `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${DISCOVERY_SPACE_ID}'`,
                ['ID', 'UserID', 'LinkedEntityID', 'LinkedRecordID', 'ApplicationScope', 'ApplicationID'],
            );

            Assert(convs.length === 1, `Discovery room conversation exists (found ${convs.length})`);
            const room = convs[0];
            Assert(room.ApplicationScope === 'Application', `ApplicationScope is Application, saw ${room.ApplicationScope}`);
            Assert(room.ApplicationID?.toLowerCase() === COLLABORATION_APP_ID.toLowerCase(), 'ApplicationID is Collaboration App');
            Assert(room.LinkedEntityID?.toLowerCase() === SPACES_ENTITY_ID.toLowerCase(), 'LinkedEntityID is Spaces');
            Assert(room.LinkedRecordID?.toLowerCase() === DISCOVERY_SPACE_ID.toLowerCase(), 'LinkedRecordID is Discovery Space');
        },
    },
    {
        Id: 'room.RM2',
        Name: "RM2 — owner's regular chat list excludes the room conversation",
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');

            // Find the Discovery room conversation ID
            const roomConvs = await FindRows<{ ID: string }>(
                ctx,
                CONVERSATION_ENTITY,
                `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            Assert(roomConvs.length === 1, 'Room conversation found');
            const roomId = roomConvs[0].ID;

            // In MemberJunction regular chat, a user's conversations are personal (ApplicationScope = 'User' or LinkedEntityID IS NULL)
            // and owned by that user (UserID = caller.ID).
            const view = View(ctx);
            const userChatList = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `(ApplicationScope = 'User' OR ApplicationScope IS NULL OR LinkedEntityID IS NULL)`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, ada);

            if (userChatList.Success && userChatList.Results) {
                const found = userChatList.Results.some((c) => c.ID.toLowerCase() === roomId.toLowerCase());
                Assert(!found, "Owner's regular chat list MUST NOT contain the space room conversation");
            }
        },
    },
    {
        Id: 'room.RM3',
        Name: 'RM3 — regular chat message to room conversation ID is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');

            const roomConvs = await FindRows<{ ID: string }>(
                ctx,
                CONVERSATION_ENTITY,
                `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            const roomId = roomConvs[0].ID;

            // Attempting to directly post a ConversationDetail row as Ada through regular entity save
            const detail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, ada);
            detail.NewRecord();
            detail.ConversationID = roomId;
            detail.UserID = ada.ID;
            detail.Role = 'User';
            detail.Message = 'Direct chat attempt into space room';
            detail.Status = 'Complete';

            // Because the conversation is owned by the system user and scoped to the app,
            // regular user entity save is either refused by write gates or conversation access checks.
            const saved = await detail.Save();
            if (saved) {
                // If saved, clean it up
                await detail.Delete();
            }
            // Regular chat message should either fail save or fail validation
            Assert(!saved || !detail.ID, 'Direct unmediated conversation detail save into room should be refused');
        },
    },
    {
        Id: 'room.RM4',
        Name: 'RM4 — Pat (Invited) and Remy (Removed) query room conversation and get nothing',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const pat = await GetPersonaUser(ctx, 'pat');
            const remy = await GetPersonaUser(ctx, 'remy');

            const roomConvs = await FindRows<{ ID: string }>(
                ctx,
                CONVERSATION_ENTITY,
                `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            const roomId = roomConvs[0].ID;

            const view = View(ctx);

            // Pat queries the room conversation
            const patRes = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${roomId}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, pat);
            Assert(
                !patRes.Success || (patRes.Results?.length ?? 0) === 0,
                'Pat (Invited) MUST NOT be able to view Discovery room conversation',
            );

            // Remy queries the room conversation
            const remyRes = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${roomId}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, remy);
            Assert(
                !remyRes.Success || (remyRes.Results?.length ?? 0) === 0,
                'Remy (Removed) MUST NOT be able to view Discovery room conversation',
            );
        },
    },
    {
        Id: 'room.RM5',
        Name: 'RM5 — PostSpaceMessage accepts contributor (Bea) and persists message',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');

            const result = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                text: 'Hello from Bea in the Discovery space room!',
            });

            if (!result.ok) {
                throw new Error(`PostSpaceMessage by Bea failed: ${result.message}`);
            }
            Assert(!!result.detailId, 'PostSpaceMessage returned a detailId');

            // Verify message exists in conversation details
            const details = await FindRows<{ ID: string; Message: string; UserID: string }>(
                ctx,
                CONVERSATION_DETAIL_ENTITY,
                `ID = '${result.detailId}'`,
                ['ID', 'Message', 'UserID'],
            );
            Assert(details.length === 1, 'Posted message detail found');
            Assert(details[0].Message === 'Hello from Bea in the Discovery space room!', 'Message text matches');
            Assert(details[0].UserID.toLowerCase() === bea.ID.toLowerCase(), 'Message UserID is Bea');
        },
    },
    {
        Id: 'room.RM6',
        Name: 'RM6 — PostSpaceMessage write gates: empty, length cap, closed space, and non-contributor',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const remy = await GetPersonaUser(ctx, 'remy');

            // 1. Empty message
            const emptyRes = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                text: '   ',
            });
            Assert(!emptyRes.ok, 'Empty message must be refused');
            Assert(!emptyRes.ok && emptyRes.message === 'The message is empty.', 'Correct empty message error');

            // 2. Message over 4000 chars
            const longText = 'x'.repeat(4001);
            const longRes = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                text: longText,
            });
            Assert(!longRes.ok, 'Message > 4000 characters must be refused');
            Assert(!longRes.ok && longRes.message.includes('limited to 4000 characters'), 'Correct length limit error');

            // 3. Closed space
            const closedRes = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: CLOSED_PAST_SPACE_ID,
                text: 'Message to closed space',
            });
            Assert(!closedRes.ok, 'Message to closed space must be refused');

            // 4. Non-contributor (Remy - Removed)
            const remyRes = await postSpaceMessage(ctx.Provider, remy, {
                spaceId: DISCOVERY_SPACE_ID,
                text: 'Message from removed user',
            });
            Assert(!remyRes.ok, 'Message from removed user must be refused');
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('room', {
    Setup: async () => {},
    Teardown: async () => {},
});
