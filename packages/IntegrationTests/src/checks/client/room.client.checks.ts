import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { CollaborationClient } from '@mj-biz-apps/collaboration-entities';
import { CONVERSATION_ENTITY, CONVERSATION_DETAIL_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaContext, getPersonaClientContext, View } from '../../wire.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const CLOSED_PAST_SPACE_ID = 'C1000001-0000-4000-8000-000000000008';
const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';

const createdDetailIds: string[] = [];

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

            const systemUsers = await FindRows<{ ID: string }>(ctx, 'MJ: Users', "Email = 'not.set@nowhere.com'", ['ID']);
            Assert(systemUsers.length === 1, 'System user found in MJ: Users');
            Assert(room.UserID.toLowerCase() === systemUsers[0].ID.toLowerCase(), `Room conversation must be bound to system user, saw: ${room.UserID}`);
        },
    },
    {
        Id: 'room.RM2',
        Name: "RM2 — owner's regular chat list excludes the room conversation",
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaContext(ctx, 'ada');

            const roomConvs = await FindRows<{ ID: string }>(
                ctx,
                CONVERSATION_ENTITY,
                `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            Assert(roomConvs.length === 1, 'Discovery room conversation exists');
            const roomConvId = roomConvs[0].ID;

            const res = await View(adaCtx).RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${roomConvId}' AND UserID = '${adaCtx.User.ID}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, adaCtx.User);

            Assert(res.Success, `RunView failed unexpectedly: ${res.ErrorMessage ?? ''}`);
            Assert(
                (res.Results?.length ?? 0) === 0,
                `Room conversation MUST NOT appear in Ada's personal conversation list, got ${res.Results?.length ?? 0} rows`,
            );
        },
    },
    {
        Id: 'room.RM3',
        Name: 'RM3 — non-member (Pat) cannot read the room conversation',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const patCtx = await getPersonaContext(ctx, 'pat');

            const patRes = await View(patCtx).RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${DISCOVERY_SPACE_ID}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, patCtx.User);
            Assert(patRes.Success, `Pat RunView failed unexpectedly: ${patRes.ErrorMessage ?? ''}`);
            Assert(
                (patRes.Results?.length ?? 0) === 0,
                `Pat (Invited) MUST NOT be able to view Discovery room conversation, got ${patRes.Results?.length ?? 0} rows`,
            );
        },
    },
    {
        Id: 'room.RM4',
        Name: 'RM4 — non-member (Remy) cannot read the room conversation',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const remyCtx = await getPersonaContext(ctx, 'remy');

            const remyRes = await View(remyCtx).RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${DISCOVERY_SPACE_ID}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, remyCtx.User);
            Assert(remyRes.Success, `Remy RunView failed unexpectedly: ${remyRes.ErrorMessage ?? ''}`);
            Assert(
                (remyRes.Results?.length ?? 0) === 0,
                `Remy (Removed) MUST NOT be able to view Discovery room conversation, got ${remyRes.Results?.length ?? 0} rows`,
            );
        },
    },
    {
        Id: 'room.RM5',
        Name: 'RM5 — PostSpaceMessage accepts contributor (Bea) and persists message',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const client = new CollaborationClient(beaCtx.GraphQLProvider);

            const result = await client.PostSpaceMessage({
                SpaceID: DISCOVERY_SPACE_ID,
                Text: 'Hello from Bea in the Discovery space room!',
            });

            Assert(result.Success === true, `PostSpaceMessage by Bea failed: ${result.ErrorMessage ?? ''}`);
            Assert(!!result.DetailID, 'PostSpaceMessage returned a DetailID');
            if (result.DetailID) {
                createdDetailIds.push(result.DetailID);
            }

            const details = await FindRows<{ ID: string; Message: string; UserID: string }>(
                ctx,
                CONVERSATION_DETAIL_ENTITY,
                `ID = '${result.DetailID}'`,
                ['ID', 'Message', 'UserID'],
            );
            Assert(details.length === 1, 'Posted message detail found');
            Assert(details[0].Message === 'Hello from Bea in the Discovery space room!', 'Message text matches');
            Assert(details[0].UserID.toLowerCase() === beaCtx.User.ID.toLowerCase(), 'Message UserID is Bea');

            // B0.2: Ada asks with ExecuteAgent: true, and as Bea, the reply in Discovery room does not quote Team files
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);
            const adaResult = await adaClient.PostSpaceMessage({
                SpaceID: DISCOVERY_SPACE_ID,
                Text: '@Assistant summarize materials in this space',
                ExecuteAgent: true,
            });
            Assert(adaResult.Success === true, `Ada PostSpaceMessage failed: ${adaResult.ErrorMessage ?? ''}`);
            if (adaResult.DetailID) createdDetailIds.push(adaResult.DetailID);
            if (adaResult.AssistantDetailID) createdDetailIds.push(adaResult.AssistantDetailID);

            // Read the assistant reply as Bea
            const beaReplyRes = await View(beaCtx).RunView<{ ID: string; Message: string }>(
                {
                    EntityName: CONVERSATION_DETAIL_ENTITY,
                    ExtraFilter: `ID = '${adaResult.AssistantDetailID}'`,
                    Fields: ['ID', 'Message'],
                    ResultType: 'simple',
                },
                beaCtx.User,
            );
            Assert(beaReplyRes.Success && (beaReplyRes.Results?.length ?? 0) === 1, 'Bea can read room assistant reply over the wire');
            const replyMsg = beaReplyRes.Results![0].Message;
            Assert(!replyMsg.includes('discovery-brief.pdf'), 'Room assistant reply must not name Team file discovery-brief.pdf');
            Assert(!replyMsg.includes('field-notes.txt'), 'Room assistant reply must not name Team file field-notes.txt');
        },
    },
    {
        Id: 'room.RM6',
        Name: 'RM6 — PostSpaceMessage write gates: empty, length cap, closed space, and non-contributor',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const remyCtx = await getPersonaClientContext(ctx, 'remy');
            const beaClient = new CollaborationClient(beaCtx.GraphQLProvider);
            const remyClient = new CollaborationClient(remyCtx.GraphQLProvider);

            // 1. Empty message
            const emptyRes = await beaClient.PostSpaceMessage({
                SpaceID: DISCOVERY_SPACE_ID,
                Text: '   ',
            });
            Assert(!emptyRes.Success, 'Empty message must be refused');
            Assert(emptyRes.ErrorMessage === 'The message is empty.', `Correct empty message error, saw: ${emptyRes.ErrorMessage}`);

            // 2. Message over 4000 chars
            const longText = 'x'.repeat(4001);
            const longRes = await beaClient.PostSpaceMessage({
                SpaceID: DISCOVERY_SPACE_ID,
                Text: longText,
            });
            Assert(!longRes.Success, 'Message > 4000 characters must be refused');
            Assert(longRes.ErrorMessage?.includes('limited to 4000 characters') ?? false, 'Correct length limit error');

            // 3. Closed space
            const closedRes = await beaClient.PostSpaceMessage({
                SpaceID: CLOSED_PAST_SPACE_ID,
                Text: 'Message to closed space',
            });
            Assert(!closedRes.Success, 'Message to closed space must be refused');

            // 4. Non-contributor (Remy - Removed)
            const remyRes = await remyClient.PostSpaceMessage({
                SpaceID: DISCOVERY_SPACE_ID,
                Text: 'Message from removed user',
            });
            Assert(!remyRes.Success, 'Message from removed user must be refused');
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('room', {
    Setup: async () => {},
    Teardown: async (ctx: IntegrationCheckContext) => {
        while (createdDetailIds.length > 0) {
            const id = createdDetailIds.pop();
            if (id) {
                const detail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, ctx.User);
                if (await detail.Load(id)) {
                    const deleted = await detail.Delete();
                    if (!deleted) {
                        const err = detail.LatestResult?.CompleteMessage ?? 'Delete returned false';
                        console.error(`room client Teardown failed to delete detail ${id}: ${err}`);
                        throw new Error(`room client Teardown failed to delete detail ${id}: ${err}`);
                    }
                }
            }
        }
    },
});
