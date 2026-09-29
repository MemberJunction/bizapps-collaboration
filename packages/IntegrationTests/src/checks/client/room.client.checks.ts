import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient, mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { COLLABORATION_TEST_AGENT_NAME } from '../../agents/test-agent.js';
import { CONVERSATION_DETAIL_ENTITY, CONVERSATION_ENTITY, SPACE_CHAT_ENTITY, SPACE_ENTITY, SPACE_ITEM_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext, getPersonaContext, GetPersonaUser, View } from '../../wire.js';
import { cleanupConversation, cleanupSpace, cleanupStep, deleteRowAndConfirm, registerChecks, runAllSteps } from '../cleanup-helpers.js';
import { CHECK_SPACE_PREFIX } from '../../world/ids.js';
import { attachTestAgent, detachTestAgent } from '../test-agent-attachment.js';

const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';
const SEALED_BRANCH_SPACE_ID = 'C1000001-0000-4000-8000-000000000014';
const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';


const createdDetailIds: string[] = [];
let testAgentAttachmentId: string | null = null;

const checks: NamedCheck[] = [
    {
        Id: 'room.RM1',
        Name: 'RM1 — space conversation bound to system user, linked to space, and scoped to Collaboration app',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);

            const startRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm1-wire-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.Success === true && !!startRes.ConversationID && !!startRes.SpaceChatID, `Ada starts General conversation over wire for RM1: ${startRes.ErrorMessage ?? ''}`);
            const convId = startRes.ConversationID!;
            const chatId = startRes.SpaceChatID!;

            try {
                const spaceChats = await FindRows<{
                    ID: string;
                    SpaceID: string;
                    ConversationID: string;
                    Kind: string;
                    Status: string;
                }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `ID = '${chatId}'`,
                    ['ID', 'SpaceID', 'ConversationID', 'Kind', 'Status'],
                );

                Assert(spaceChats.length === 1, `Discovery Space Chat General row exists`);
                const chat = spaceChats[0];
                Assert(chat.Kind === 'General', `Space Chat Kind is General, saw ${chat.Kind}`);
                Assert(chat.Status === 'Active', `Space Chat Status is Active, saw ${chat.Status}`);

                const convs = await FindRows<{
                    ID: string;
                    UserID: string;
                    ApplicationScope: string;
                    ApplicationID: string;
                }>(
                    ctx,
                    CONVERSATION_ENTITY,
                    `ID = '${convId}'`,
                    ['ID', 'UserID', 'ApplicationScope', 'ApplicationID'],
                );
                Assert(convs.length === 1, `Discovery conversation exists`);
                const room = convs[0];
                Assert(room.ApplicationScope === 'Application', `ApplicationScope is Application, saw ${room.ApplicationScope}`);
                Assert(room.ApplicationID?.toLowerCase() === COLLABORATION_APP_ID.toLowerCase(), 'ApplicationID is Collaboration App');

                const systemUsers = await FindRows<{ ID: string }>(ctx, 'MJ: Users', "Email = 'not.set@nowhere.com'", ['ID']);
                Assert(systemUsers.length === 1, 'System user found in MJ: Users');
                Assert(room.UserID.toLowerCase() === systemUsers[0].ID.toLowerCase(), `Room conversation must be bound to system user, saw: ${room.UserID}`);
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, convId, chatId);
            }
        },
    },
    {
        Id: 'room.RM2',
        Name: "RM2 — owner's regular chat list excludes the room conversation",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);

            const startRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm2-wire-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.Success === true && !!startRes.ConversationID && !!startRes.SpaceChatID, `Ada creates conversation for RM2: ${startRes.ErrorMessage ?? ''}`);
            const roomConvId = startRes.ConversationID!;
            const chatId = startRes.SpaceChatID!;

            try {
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
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, roomConvId, chatId);
            }
        },
    },
    {
        Id: 'room.RM3',
        Name: 'RM3 — contributing seat (Ada, Bea) direct save to room succeeds over wire; non-member (Pat, Dana) is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const patCtx = await getPersonaContext(ctx, 'pat');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);

            const startRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm3-wire-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.Success === true && !!startRes.ConversationID, `Ada creates General conversation over wire for RM3: ${startRes.ErrorMessage ?? ''}`);
            const roomId = startRes.ConversationID!;
            const chatId = startRes.SpaceChatID;

            try {
                // Direct save over wire by Ada (contributing seat)
                const adaDetail = await adaCtx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, adaCtx.User);
                adaDetail.NewRecord();
                adaDetail.ConversationID = roomId;
                adaDetail.UserID = adaCtx.User.ID;
                adaDetail.Role = 'User';
                adaDetail.Message = 'Direct chat over wire by contributing member into space room';
                adaDetail.Status = 'Complete';

                const adaSaved = await adaDetail.Save();
                Assert(adaSaved && !!adaDetail.ID, `Direct conversation detail save over wire by Ada should succeed: ${adaDetail.LatestResult?.CompleteMessage ?? ''}`);

                const deleted = await adaDetail.Delete();
                Assert(deleted === true, `Ada deleting her own detail over wire should succeed: ${adaDetail.LatestResult?.CompleteMessage ?? ''}`);

                // Baseline for Bea: Bea (contributor in Discovery) direct save over wire succeeds
                const beaDetail = await beaCtx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, beaCtx.User);
                beaDetail.NewRecord();
                beaDetail.ConversationID = roomId;
                beaDetail.UserID = beaCtx.User.ID;
                beaDetail.Role = 'User';
                beaDetail.Message = 'Direct chat over wire by Bea into space room';
                beaDetail.Status = 'Complete';

                const beaSaved = await beaDetail.Save();
                Assert(beaSaved && !!beaDetail.ID, `Direct conversation detail save over wire by Bea should succeed: ${beaDetail.LatestResult?.CompleteMessage ?? ''}`);

                const beaDeleted = await beaDetail.Delete();
                Assert(beaDeleted === false, 'Bea (Space Participant) cannot delete conversation details over wire; delete must be refused');

                // Clean up Bea's message as harness user
                const cleanupBea = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, ctx.User);
                if (await cleanupBea.Load(beaDetail.ID)) {
                    const delOk = await cleanupBea.Delete();
                    Assert(delOk === true, 'Harness user delete of Bea detail over wire must succeed');
                }

                // Direct save over wire by Pat (non-contributor / invited) is refused
                const patClientCtx = await getPersonaClientContext(ctx, 'pat');
                const patDetail = await patClientCtx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, patClientCtx.User);
                patDetail.NewRecord();
                patDetail.ConversationID = roomId;
                patDetail.UserID = patClientCtx.User.ID;
                patDetail.Role = 'User';
                patDetail.Message = 'Direct chat attempt over wire by non-contributor into space room';
                patDetail.Status = 'Complete';
                const patSaved = await patDetail.Save();
                if (patSaved) {
                    const patDel = await patDetail.Delete();
                    Assert(patDel === true, 'Pat cleanup delete must succeed');
                }
                Assert(!patSaved || !patDetail.ID, 'Direct conversation detail save over wire by non-contributor (Pat) must be refused');

                const patRes = await View(patCtx).RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${roomId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, patCtx.User);
                Assert(patRes.Success, `Pat RunView failed unexpectedly: ${patRes.ErrorMessage ?? ''}`);
                Assert(
                    (patRes.Results?.length ?? 0) === 0,
                    `Pat (Invited) MUST NOT be able to view Discovery room conversation, got ${patRes.Results?.length ?? 0} rows`,
                );
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, roomId, chatId);
            }
        },
    },
    {
        Id: 'room.RM4',
        Name: 'RM4 — non-member (Remy) and invited (Pat) cannot read conversation; post-close access reads conversation',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const patCtx = await getPersonaContext(ctx, 'pat');
            const remyCtx = await getPersonaContext(ctx, 'remy');
            const caseyCtx = await getPersonaClientContext(ctx, 'casey');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);

            // 1. Create conversation on demand in Discovery
            const startRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm4-wire-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.Success === true && !!startRes.ConversationID, `Ada creates General conversation over wire for RM4: ${startRes.ErrorMessage ?? ''}`);
            const discConvId = startRes.ConversationID!;
            const discChatId = startRes.SpaceChatID;

            try {
                // Pat queries the space conversation
                const patRes = await View(patCtx).RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${discConvId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, patCtx.User);
                Assert(patRes.Success, `Pat RunView failed unexpectedly: ${patRes.ErrorMessage ?? ''}`);
                Assert(
                    (patRes.Results?.length ?? 0) === 0,
                    `Pat (Invited) MUST NOT be able to view Discovery space conversation, got ${patRes.Results?.length ?? 0} rows`,
                );

                // Remy queries the space conversation
                const remyRes = await View(remyCtx).RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${discConvId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, remyCtx.User);
                Assert(remyRes.Success, `Remy RunView failed unexpectedly: ${remyRes.ErrorMessage ?? ''}`);
                Assert(
                    (remyRes.Results?.length ?? 0) === 0,
                    `Remy (Removed) MUST NOT be able to view Discovery space conversation, got ${remyRes.Results?.length ?? 0} rows`,
                );
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, discConvId, discChatId);
            }

            // 2. Post-close access: create on-demand child space under Northwind, start conversation, close space, verify Casey reads
            const nwSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await nwSpace.Load(NORTHWIND_SPACE_ID), 'Load Northwind space');
            const typeId = nwSpace.SpaceTypeID;

            const closedTestSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            closedTestSpace.NewRecord();
            closedTestSpace.Name = `${CHECK_SPACE_PREFIX}RM4-Closed-Test-Wire-${Date.now()}`;
            closedTestSpace.SpaceTypeID = typeId;
            closedTestSpace.ParentID = NORTHWIND_SPACE_ID;
            closedTestSpace.InheritsMembership = true;
            closedTestSpace.OwnerID = adaCtx.User.ID;
            const spaceSaved = await closedTestSpace.Save();
            Assert(spaceSaved && !!closedTestSpace.ID, `Created closed test space for RM4: ${closedTestSpace.LatestResult?.CompleteMessage ?? ''}`);

            let closedConvId: string | undefined;
            try {
                const closedStartRes = await adaClient.CreateSpaceConversation({
                    SpaceID: closedTestSpace.ID,
                    Name: 'General',
                    Kind: 'General',
                });
                Assert(closedStartRes.Success === true && !!closedStartRes.ConversationID, `Ada starts General conversation in test space: ${closedStartRes.ErrorMessage ?? ''}`);
                closedConvId = closedStartRes.ConversationID!;

                // Close the space
                closedTestSpace.ClosedAt = new Date();
                const closedOk = await closedTestSpace.Save();
                Assert(closedOk, 'Ada closes test space');

                // Casey (with post-close access) reads the conversation over wire
                const caseyClosedRes = await View(caseyCtx).RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${closedConvId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, caseyCtx.User);
                Assert(caseyClosedRes.Success, `Casey RunView on closed conversation failed: ${caseyClosedRes.ErrorMessage ?? ''}`);
                Assert(
                    (caseyClosedRes.Results?.length ?? 0) === 1,
                    `Casey (with post-close access) MUST be able to view closed space conversation, got ${caseyClosedRes.Results?.length ?? 0} rows`,
                );
            } finally {
                await cleanupSpace(ctx.Provider, ctx.User, closedTestSpace.ID);
            }
        },
    },
    {
        Id: 'room.RM5',
        Name: 'RM5 — PostSpaceMessage accepts contributor (Bea) and persists message',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const client = new CollaborationClient(beaCtx.GraphQLProvider);
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);

            const startRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm5-wire-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.Success === true && !!startRes.ConversationID, `Ada creates General conversation over wire for RM5: ${startRes.ErrorMessage ?? ''}`);
            const discConvId = startRes.ConversationID!;
            const discChatId = startRes.SpaceChatID;

            let nwConvId: string | undefined;
            let nwChatId: string | undefined;
            let sealedConvId: string | undefined;
            let sealedChatId: string | undefined;
            let sealedItemId: string | undefined;

            try {
                const result = await client.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: discConvId,
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
                const adaPostRes = await adaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: discConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} summarize materials in this space`,
                });
                Assert(adaPostRes.Success === true, `Ada PostSpaceMessage failed: ${adaPostRes.ErrorMessage ?? ''}`);
                if (adaPostRes.DetailID) createdDetailIds.push(adaPostRes.DetailID);

                const adaTurnRes = await adaClient.ExecuteSpaceChatTurn({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: discConvId,
                    UserMessageID: adaPostRes.DetailID!,
                });
                Assert(adaTurnRes.Success === true, `Ada ExecuteSpaceChatTurn failed: ${adaTurnRes.ErrorMessage ?? ''}`);
                const adaAssistantDetailId = adaTurnRes.ReplyDetailIDs?.[0];
                if (adaAssistantDetailId) createdDetailIds.push(adaAssistantDetailId);

                // Read the assistant reply as Bea
                const beaReplyRes = await View(beaCtx).RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${adaAssistantDetailId}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    beaCtx.User,
                );
                Assert(beaReplyRes.Success && (beaReplyRes.Results?.length ?? 0) === 1, 'Bea can read room assistant reply over the wire');
                const replyMsg = beaReplyRes.Results![0].Message;
                Assert(replyMsg.includes('site-photo.png'), 'Room assistant reply must quote Shared file site-photo.png');
                Assert(!replyMsg.includes('discovery-brief.pdf'), 'Room assistant reply must not name Team file discovery-brief.pdf');
                Assert(!replyMsg.includes('field-notes.txt'), 'Room assistant reply must not name Team file field-notes.txt');

                // B0.2: With a Shared item in Sealed branch, Sam asks in Northwind's room over the wire, and as Casey the reply does not name it
                const samCtx = await getPersonaClientContext(ctx, 'sam');
                const caseyCtx = await getPersonaClientContext(ctx, 'casey');
                const samClient = new CollaborationClient(samCtx.GraphQLProvider);

                const uniqueFileName = `sealed-wire-${Date.now()}.txt`;
                const uploadOutcome = await samClient.UploadSpaceFile({
                    SpaceID: SEALED_BRANCH_SPACE_ID,
                    FileName: uniqueFileName,
                    MimeType: 'text/plain',
                    Base64Data: Buffer.from('Sealed branch confidential wire test plan content').toString('base64'),
                    Folder: 'Internal',
                });
                Assert(uploadOutcome.Success && !!uploadOutcome.ItemID, `Uploading file as Sam in Sealed branch over wire must succeed: ${uploadOutcome.ErrorMessage ?? ''}`);
                sealedItemId = uploadOutcome.ItemID!;

                const sealedItem = await samCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, samCtx.User);
                Assert(await sealedItem.Load(sealedItemId), 'Load uploaded sealed item over wire');
                sealedItem.Band = 'Shared';
                const promoted = await sealedItem.Save();
                Assert(promoted, 'Promoting sealed branch item to Shared over wire must succeed');

                // 1. Sam asks in Northwind's room: Casey's read must NOT name uniqueFileName
                const nwConvRes = await samClient.CreateSpaceConversation({
                    SpaceID: NORTHWIND_SPACE_ID,
                    Name: `northwind-rm5-wire-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(nwConvRes.Success === true && !!nwConvRes.ConversationID, `Sam creates General conversation in Northwind over wire: ${nwConvRes.ErrorMessage ?? ''}`);
                nwConvId = nwConvRes.ConversationID!;
                nwChatId = nwConvRes.SpaceChatID;

                const samPostRes = await samClient.PostSpaceMessage({
                    SpaceID: NORTHWIND_SPACE_ID,
                    ConversationID: nwConvId,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} summarize all materials in this space`,
                });
                Assert(samPostRes.Success === true, `Sam PostSpaceMessage in Northwind room failed: ${samPostRes.ErrorMessage ?? ''}`);
                if (samPostRes.DetailID) createdDetailIds.push(samPostRes.DetailID);

                const samTurnRes = await samClient.ExecuteSpaceChatTurn({
                    SpaceID: NORTHWIND_SPACE_ID,
                    ConversationID: nwConvId,
                    UserMessageID: samPostRes.DetailID!,
                });
                Assert(samTurnRes.Success === true, `Sam ExecuteSpaceChatTurn failed: ${samTurnRes.ErrorMessage ?? ''}`);
                const samAssistantDetailId = samTurnRes.ReplyDetailIDs?.[0];
                if (samAssistantDetailId) createdDetailIds.push(samAssistantDetailId);

                // Casey reads the assistant reply in Northwind's room
                const caseyReplyRes = await View(caseyCtx).RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${samAssistantDetailId}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    caseyCtx.User,
                );
                Assert(caseyReplyRes.Success && (caseyReplyRes.Results?.length ?? 0) === 1, 'Casey can read Northwind room assistant reply over the wire');
                const nwReplyMsg = caseyReplyRes.Results![0].Message;
                Assert(!nwReplyMsg.includes(uniqueFileName), `Northwind room assistant reply over the wire must not name sub-space Shared file ${uniqueFileName}`);

                // 2. The other half: Sam asking in Sealed branch's own room names it
                const sealedConvRes = await samClient.CreateSpaceConversation({
                    SpaceID: SEALED_BRANCH_SPACE_ID,
                    Name: `sealed-client-gen-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(sealedConvRes.Success === true && !!sealedConvRes.ConversationID, 'Sam creates General conversation in Sealed branch over wire');
                sealedConvId = sealedConvRes.ConversationID!;
                sealedChatId = sealedConvRes.SpaceChatID;

                const samSealedRes = await samClient.PostSpaceMessage({
                    SpaceID: SEALED_BRANCH_SPACE_ID,
                    ConversationID: sealedConvRes.ConversationID,
                    Text: `@${COLLABORATION_TEST_AGENT_NAME} summarize materials in this space`,
                });
                Assert(samSealedRes.Success === true, `Sam PostSpaceMessage in Sealed branch room failed: ${samSealedRes.ErrorMessage ?? ''}`);
                if (samSealedRes.DetailID) createdDetailIds.push(samSealedRes.DetailID);

                const samSealedTurnRes = await samClient.ExecuteSpaceChatTurn({
                    SpaceID: SEALED_BRANCH_SPACE_ID,
                    ConversationID: sealedConvRes.ConversationID!,
                    UserMessageID: samSealedRes.DetailID!,
                });
                Assert(samSealedTurnRes.Success === true, `Sam ExecuteSpaceChatTurn in Sealed branch failed: ${samSealedTurnRes.ErrorMessage ?? ''}`);
                const sealedAssistantDetailId = samSealedTurnRes.ReplyDetailIDs?.[0];
                if (sealedAssistantDetailId) createdDetailIds.push(sealedAssistantDetailId);

                const samSealedReplyRes = await View(samCtx).RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${sealedAssistantDetailId}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    samCtx.User,
                );
                Assert(samSealedReplyRes.Success && (samSealedReplyRes.Results?.length ?? 0) === 1, 'Sam can read Sealed branch room assistant reply over wire');
                const sealedReplyMsg = samSealedReplyRes.Results![0].Message;
                Assert(sealedReplyMsg.includes(uniqueFileName), `Sealed branch room reply over wire must name its own Shared file ${uniqueFileName}`);
            } finally {
                if (sealedItemId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_ITEM_ENTITY, sealedItemId, 'the sealed branch item');
                }
                await cleanupConversation(ctx.Provider, ctx.User, discConvId, discChatId);
                if (nwConvId || nwChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, nwConvId, nwChatId);
                }
                if (sealedConvId || sealedChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, sealedConvId, sealedChatId);
                }
            }
        },
    },
    {
        Id: 'room.RM6',
        Name: 'RM6 — PostSpaceMessage write gates: empty, length cap, closed space, and non-contributor',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const remyCtx = await getPersonaClientContext(ctx, 'remy');
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const beaClient = new CollaborationClient(beaCtx.GraphQLProvider);
            const remyClient = new CollaborationClient(remyCtx.GraphQLProvider);
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);

            const startRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm6-wire-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.Success === true && !!startRes.ConversationID, `Ada creates General conversation over wire for RM6: ${startRes.ErrorMessage ?? ''}`);
            const discConvId = startRes.ConversationID!;
            const discChatId = startRes.SpaceChatID;

            // Create on-demand closed space with a conversation to test closed-space post refusal
            const nwSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await nwSpace.Load(NORTHWIND_SPACE_ID), 'Load Northwind space for RM6');
            const typeId = nwSpace.SpaceTypeID;

            const closedSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            closedSpace.NewRecord();
            closedSpace.Name = `${CHECK_SPACE_PREFIX}RM6-Closed-Space-Wire-${Date.now()}`;
            closedSpace.SpaceTypeID = typeId;
            closedSpace.ParentID = NORTHWIND_SPACE_ID;
            closedSpace.InheritsMembership = true;
            closedSpace.OwnerID = adaCtx.User.ID;
            const closedSpaceSaved = await closedSpace.Save();
            Assert(closedSpaceSaved && !!closedSpace.ID, 'Created closed test space for RM6');

            const closedConvRes = await adaClient.CreateSpaceConversation({
                SpaceID: closedSpace.ID,
                Name: 'General',
                Kind: 'General',
            });
            Assert(closedConvRes.Success && !!closedConvRes.ConversationID, 'Created conversation in closed test space over wire');
            const closedConvId = closedConvRes.ConversationID!;

            closedSpace.ClosedAt = new Date();
            const closedOk = await closedSpace.Save();
            Assert(closedOk, 'Closed test space for RM6 over wire');

            try {
                // 0. Missing conversation ID
                const noConvRes = await beaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Text: 'Message without conversationId',
                });
                Assert(!noConvRes.Success, 'Message without conversationId must be refused');
                Assert(noConvRes.ErrorMessage === 'A conversation ID is required to post a message.', 'Correct missing conversationId message');

                // 1. Empty message
                const emptyRes = await beaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: discConvId,
                    Text: '   ',
                });
                Assert(!emptyRes.Success, 'Empty message must be refused');
                Assert(emptyRes.ErrorMessage === 'The message is empty.', `Correct empty message error, saw: ${emptyRes.ErrorMessage}`);

                // 2. Message over 4000 chars
                const longText = 'x'.repeat(4001);
                const longRes = await beaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: discConvId,
                    Text: longText,
                });
                Assert(!longRes.Success, 'Message > 4000 characters must be refused');
                Assert(longRes.ErrorMessage?.includes('limited to 4000 characters') ?? false, 'Correct length limit error');

                // 3. Closed space
                const closedRes = await adaClient.PostSpaceMessage({
                    SpaceID: closedSpace.ID,
                    ConversationID: closedConvId,
                    Text: 'Message to closed space',
                });
                Assert(!closedRes.Success && closedRes.ErrorMessage === 'A closed space does not take a new message.', `Correct closed space message, saw: ${closedRes.ErrorMessage}`);

                // 4. Non-contributor (Remy - Removed)
                const remyRes = await remyClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: discConvId,
                    Text: 'Message from removed user',
                });
                Assert(!remyRes.Success && remyRes.ErrorMessage === 'Your role on this space cannot post.', `Correct non-contributor message, saw: ${remyRes.ErrorMessage}`);
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, discConvId, discChatId);
                await cleanupSpace(ctx.Provider, ctx.User, closedSpace.ID);
            }
        },
    },
    {
        Id: 'room.RM7',
        Name: 'RM7 — Client CreateSpaceConversation: Sam starts General in Committee; Dana (Guest) is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const samCtx = await getPersonaClientContext(ctx, 'sam');
            const danaCtx = await getPersonaClientContext(ctx, 'dana');
            const samClient = new CollaborationClient(samCtx.GraphQLProvider);
            const danaClient = new CollaborationClient(danaCtx.GraphQLProvider);

            // 1. Sam starts General conversation in Committee
            const samRes = await samClient.CreateSpaceConversation({
                SpaceID: COMMITTEE_SPACE_ID,
                Name: `committee-client-sam-${Date.now()}`,
                Kind: 'General',
            });
            Assert(samRes.Success === true && !!samRes.ConversationID, `Sam can start General conversation in Committee over wire: ${samRes.ErrorMessage ?? ''}`);

            try {
                // 2. Dana (guest) is refused
                const danaRes = await danaClient.CreateSpaceConversation({
                    SpaceID: COMMITTEE_SPACE_ID,
                    Name: `committee-client-dana-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(!danaRes.Success && danaRes.ErrorMessage === 'Caller is not permitted to start a conversation in this space.', `Dana refused with correct error message, saw: ${danaRes.ErrorMessage}`);
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, samRes.ConversationID, samRes.SpaceChatID);
            }
        },
    },
    {
        Id: 'room.RM8',
        Name: 'RM8 — Client CreateSpaceConversation WhoCanStart=Owners: Sam is refused, Ada is permitted',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const samCtx = await getPersonaClientContext(ctx, 'sam');
            const devCtx = await getPersonaClientContext(ctx, 'dev');
            const dev = await GetPersonaUser(ctx, 'dev');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);
            const samClient = new CollaborationClient(samCtx.GraphQLProvider);

            const ownerRoles = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            Assert(ownerRoles.length === 1, 'Owner space role type found');
            const ownerRoleId = ownerRoles[0].ID;

            // Ada seats Dev as owner on Discovery so Dev (with Configure Spaces authorization) can configure space settings
            const devMember = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, adaCtx.User);
            devMember.NewRecord();
            devMember.SpaceID = DISCOVERY_SPACE_ID;
            devMember.UserID = dev.ID;
            devMember.SpaceRoleTypeID = ownerRoleId;
            devMember.Band = 'Team';
            devMember.Status = 'Active';
            Assert(await devMember.Save(), 'Seating Dev as owner on Discovery must succeed');

            // Discovery's configuration is NULL on a fresh world, so "restore" means writing back whatever was there, NULL included
            let configCaptured = false;
            let origConfig: string | null = null;
            let adaConvId: string | undefined;
            let adaChatId: string | undefined;
            try {
                const space = await devCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, devCtx.User);
                Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space as dev');
                origConfig = space.Configuration;
                configCaptured = true;

                const configObj = origConfig ? JSON.parse(origConfig) : {};
                configObj.Chats = { ...(configObj.Chats ?? {}), WhoCanStart: 'Owners' };
                space.Configuration = JSON.stringify(configObj);
                const saved = await space.Save();
                Assert(saved, 'Updated Discovery space config with WhoCanStart: Owners as dev');

                // Sam (contributing member, but not owner) is refused
                const samRes = await samClient.CreateSpaceConversation({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-client-sam-refused-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(!samRes.Success && samRes.ErrorMessage === 'Caller is not permitted to start a conversation in this space.', `Sam refused with correct message: ${samRes.ErrorMessage}`);

                // Ada (owner) is permitted
                const adaRes = await adaClient.CreateSpaceConversation({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-client-ada-allowed-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(adaRes.Success === true && !!adaRes.ConversationID, `Ada (owner) must be permitted over wire when WhoCanStart is Owners: ${adaRes.ErrorMessage ?? ''}`);
                adaConvId = adaRes.ConversationID;
                adaChatId = adaRes.SpaceChatID;
            } finally {
                if (adaConvId || adaChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, adaConvId, adaChatId);
                }
                if (configCaptured) {
                    await cleanupStep(async () => {
                        const restoreSpace = await devCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, devCtx.User);
                        Assert(await restoreSpace.Load(DISCOVERY_SPACE_ID), 'Reload Discovery to restore its configuration over wire');
                        restoreSpace.Configuration = origConfig;
                        Assert(await restoreSpace.Save(), `Restoring Discovery's configuration over wire must succeed: ${restoreSpace.LatestResult?.CompleteMessage ?? ''}`);
                        const verify = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                        Assert(await verify.Load(DISCOVERY_SPACE_ID), 'Read Discovery back after the restore');
                        Assert(verify.Configuration === origConfig, `Discovery's configuration must be back to ${origConfig === null ? 'NULL' : 'its original text'}`);
                    });
                }
                if (devMember.ID) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, devMember.ID, "Dev's seat on Discovery");
                }
            }
        },
    },
    {
        Id: 'room.RM9',
        Name: 'RM9 — Client: Bea reads/posts in Discovery General; refused reading, posting, or starting Private',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);
            const beaClient = new CollaborationClient(beaCtx.GraphQLProvider);

            // 1. Bea creates/starts Private conversation in Discovery — refused over wire
            const startPrivRes = await beaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-client-bea-private-${Date.now()}`,
                Kind: 'Private',
            });
            Assert(!startPrivRes.Success && startPrivRes.ErrorMessage === 'Caller cannot start a Private conversation.', `Bea refused starting Private over wire with correct message: ${startPrivRes.ErrorMessage}`);

            // 2. Ada starts on-demand General and Private conversations in Discovery over wire
            const adaGenRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-client-rm9-gen-${Date.now()}`,
                Kind: 'General',
            });
            Assert(adaGenRes.Success && !!adaGenRes.ConversationID, 'Ada starts General conversation for RM9 over wire');

            const adaPrivRes = await adaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-client-rm9-priv-${Date.now()}`,
                Kind: 'Private',
            });
            Assert(adaPrivRes.Success && !!adaPrivRes.ConversationID, 'Ada starts Private conversation for RM9 over wire');

            try {
                // 3. Bea can read General conversation over wire
                const beaGenRead = await View(beaCtx).RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${adaGenRes.ConversationID}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, beaCtx.User);
                Assert(beaGenRead.Success && (beaGenRead.Results?.length ?? 0) === 1, 'Bea can read Discovery General conversation over wire');

                // 4. Bea can post in General conversation over wire
                const beaPostGen = await beaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: adaGenRes.ConversationID!,
                    Text: 'Bea posted in General channel over wire.',
                });
                Assert(beaPostGen.Success === true && !!beaPostGen.DetailID, `Bea can post in Discovery General conversation over wire: ${beaPostGen.ErrorMessage ?? ''}`);
                if (beaPostGen.DetailID) createdDetailIds.push(beaPostGen.DetailID);

                // 5. Bea CANNOT read Private conversation over wire
                const beaPrivRead = await View(beaCtx).RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${adaPrivRes.ConversationID}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, beaCtx.User);
                Assert(beaPrivRead.Success && (beaPrivRead.Results?.length ?? 0) === 0, 'Bea CANNOT read Discovery Private conversation over wire');

                // 6. Bea CANNOT post in Private conversation over wire
                const beaPostPriv = await beaClient.PostSpaceMessage({
                    SpaceID: DISCOVERY_SPACE_ID,
                    ConversationID: adaPrivRes.ConversationID!,
                    Text: 'Bea trying to post in Private channel over wire.',
                });
                Assert(!beaPostPriv.Success && beaPostPriv.ErrorMessage === 'Caller cannot post in this internal conversation without Team visibility.', `Bea refused posting in Private over wire: ${beaPostPriv.ErrorMessage}`);
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, adaGenRes.ConversationID, adaGenRes.SpaceChatID);
                await cleanupConversation(ctx.Provider, ctx.User, adaPrivRes.ConversationID, adaPrivRes.SpaceChatID);
            }
        },
    },
    {
        Id: 'room.RM10',
        Name: 'RM10 — newly created space has zero conversations until someone starts one',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);

            const discovery = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await discovery.Load(DISCOVERY_SPACE_ID), 'Load Discovery space to read SpaceType');
            const typeId = discovery.SpaceTypeID;

            const testSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            testSpace.NewRecord();
            testSpace.Name = `${CHECK_SPACE_PREFIX}RM10-New-Space-Wire-${Date.now()}`;
            testSpace.SpaceTypeID = typeId;
            testSpace.ParentID = DISCOVERY_SPACE_ID;
            testSpace.OwnerID = adaCtx.User.ID;
            testSpace.InheritsMembership = true;
            const saved = await testSpace.Save();
            Assert(saved && !!testSpace.ID, `Created new space for RM10 over wire: ${testSpace.LatestResult?.CompleteMessage ?? ''}`);

            let startRes: { Success: boolean; ConversationID?: string; SpaceChatID?: string; ErrorMessage?: string } | undefined;
            try {
                // 1. Verify zero conversations exist initially
                const chats = await FindRows<{ ID: string }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `SpaceID = '${testSpace.ID}'`,
                    ['ID'],
                );
                Assert(chats.length === 0, `Newly created space must have zero conversations until one is started (found ${chats.length})`);

                // 2. Start a General conversation through CreateSpaceConversation over wire
                startRes = await adaClient.CreateSpaceConversation({
                    SpaceID: testSpace.ID,
                    Name: 'General',
                    Kind: 'General',
                });
                Assert(startRes.Success === true && !!startRes.ConversationID, `Starting General conversation in new space over wire must succeed: ${startRes.ErrorMessage ?? ''}`);

                // 3. Verify exactly one conversation exists now
                const chatsAfter = await FindRows<{ ID: string; Kind: string; Status: string }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `SpaceID = '${testSpace.ID}'`,
                    ['ID', 'Kind', 'Status'],
                );
                Assert(chatsAfter.length === 1, `Space must have exactly 1 conversation after start (found ${chatsAfter.length})`);
                Assert(chatsAfter[0].Kind === 'General', `Conversation kind must be General, saw ${chatsAfter[0].Kind}`);
                Assert(chatsAfter[0].Status === 'Active', `Conversation status must be Active, saw ${chatsAfter[0].Status}`);
            } finally {
                await cleanupSpace(ctx.Provider, ctx.User, testSpace.ID);
            }
        },
    },
    {
        Id: 'room.RM11',
        Name: 'RM11 — space closure revokes edit grants and refuses posts; space reopen restores conversation and edit grants',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const samCtx = await getPersonaClientContext(ctx, 'sam');
            const adaClient = new CollaborationClient(adaCtx.GraphQLProvider);
            const samClient = new CollaborationClient(samCtx.GraphQLProvider);

            const nwSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            Assert(await nwSpace.Load(NORTHWIND_SPACE_ID), 'Load Northwind space');
            const typeId = nwSpace.SpaceTypeID;

            const testSpace = await adaCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, adaCtx.User);
            testSpace.NewRecord();
            testSpace.Name = `${CHECK_SPACE_PREFIX}RM11-Close-Reopen-Wire-${Date.now()}`;
            testSpace.SpaceTypeID = typeId;
            testSpace.ParentID = NORTHWIND_SPACE_ID;
            testSpace.InheritsMembership = true;
            testSpace.OwnerID = adaCtx.User.ID;
            const saved = await testSpace.Save();
            Assert(saved && !!testSpace.ID, `Created test space for RM11 over wire: ${testSpace.LatestResult?.CompleteMessage ?? ''}`);

            let convId: string | undefined;
            let startRes: { Success: boolean; ConversationID?: string; SpaceChatID?: string; ErrorMessage?: string } | undefined;
            try {
                // 1. Start General conversation over wire
                startRes = await adaClient.CreateSpaceConversation({
                    SpaceID: testSpace.ID,
                    Name: 'General',
                    Kind: 'General',
                });
                Assert(startRes.Success === true && !!startRes.ConversationID, `Ada starts General conversation over wire: ${startRes.ErrorMessage ?? ''}`);
                convId = startRes.ConversationID!;

                // 2. Sam (contributing staff seat) posts message in open space — succeeds
                const samPost1 = await samClient.PostSpaceMessage({
                    SpaceID: testSpace.ID,
                    ConversationID: convId,
                    Text: 'Sam post before close over wire',
                });
                Assert(samPost1.Success === true && !!samPost1.DetailID, `Sam post before close must succeed: ${samPost1.ErrorMessage ?? ''}`);
                if (samPost1.DetailID) createdDetailIds.push(samPost1.DetailID);

                // 3. Ada closes the space
                testSpace.ClosedAt = new Date();
                const closedSaved = await testSpace.Save();
                Assert(closedSaved, 'Ada closes test space over wire');

                // 4. Verify conversation is archived with ArchivedOnSpaceClose = true
                const archivedChats = await FindRows<{ ID: string; Status: string; ArchivedOnSpaceClose: boolean }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `SpaceID = '${testSpace.ID}'`,
                    ['ID', 'Status', 'ArchivedOnSpaceClose'],
                );
                Assert(archivedChats.length === 1, 'Found conversation for test space');
                Assert(archivedChats[0].Status === 'Archived', `Conversation status must be Archived after close, saw ${archivedChats[0].Status}`);
                Assert(archivedChats[0].ArchivedOnSpaceClose === true, `Conversation ArchivedOnSpaceClose must be true, saw: ${archivedChats[0].ArchivedOnSpaceClose}`);

                // 5. Verify Sam's Resource Permission Edit grant is revoked
                const grantsAfterClose = await FindRows<{ ID: string }>(
                    ctx,
                    'MJ: Resource Permissions',
                    `ResourceRecordID = '${convId}' AND UserID = '${samCtx.User.ID}' AND PermissionLevel = 'Edit'`,
                    ['ID'],
                );
                Assert(grantsAfterClose.length === 0, `Sam must have NO Edit grant on archived conversation after close (found ${grantsAfterClose.length})`);

                // 6. Sam post in closed space is refused
                const samPostClosed = await samClient.PostSpaceMessage({
                    SpaceID: testSpace.ID,
                    ConversationID: convId,
                    Text: 'Sam post in closed space attempt over wire',
                });
                Assert(!samPostClosed.Success && samPostClosed.ErrorMessage === 'A closed space does not take a new message.', `Sam post in closed space refused with correct message over wire: ${samPostClosed.ErrorMessage}`);

                // 7. Ada reopens the space
                testSpace.ClosedAt = null;
                const reopenedSaved = await testSpace.Save();
                Assert(reopenedSaved, 'Ada reopens test space over wire');

                // 8. Verify conversation is restored to Active and ArchivedOnSpaceClose is false
                // The reopen restores the chat on the server, not through this client's own save, so this read must not reuse step 4's
                const restoredChats = await FindRows<{ ID: string; Status: string; ArchivedOnSpaceClose: boolean }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `SpaceID = '${testSpace.ID}'`,
                    ['ID', 'Status', 'ArchivedOnSpaceClose'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(restoredChats.length === 1, 'Found conversation for test space after reopen');
                Assert(restoredChats[0].Status === 'Active', `Conversation status must be Active after reopen, saw ${restoredChats[0].Status}`);
                Assert(restoredChats[0].ArchivedOnSpaceClose === false, `Conversation ArchivedOnSpaceClose must be false after reopen, saw: ${restoredChats[0].ArchivedOnSpaceClose}`);

                // 9. Verify Sam's Resource Permission Edit grant is restored
                const grantsAfterReopen = await FindRows<{ ID: string }>(
                    ctx,
                    'MJ: Resource Permissions',
                    `ResourceRecordID = '${convId}' AND UserID = '${samCtx.User.ID}' AND PermissionLevel = 'Edit'`,
                    ['ID'],
                    undefined,
                    { BypassCache: true },
                );
                Assert(grantsAfterReopen.length === 1, `Sam must have Edit grant restored on conversation after reopen (found ${grantsAfterReopen.length})`);

                // 10. Sam posts in reopened space — succeeds
                const samPostReopen = await samClient.PostSpaceMessage({
                    SpaceID: testSpace.ID,
                    ConversationID: convId,
                    Text: 'Sam post after reopen over wire',
                });
                Assert(samPostReopen.Success === true && !!samPostReopen.DetailID, `Sam post after reopen must succeed: ${samPostReopen.ErrorMessage ?? ''}`);
                if (samPostReopen.DetailID) createdDetailIds.push(samPostReopen.DetailID);
            } finally {
                await cleanupSpace(ctx.Provider, ctx.User, testSpace.ID);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('room', {
    // The turns run on the harness's own test agent, attached to the Northwind root for the bundle; its children inherit it.
    Setup: async (ctx: IntegrationCheckContext) => {
        testAgentAttachmentId = await attachTestAgent(ctx, NORTHWIND_SPACE_ID);
    },
    Teardown: async (ctx: IntegrationCheckContext) =>
        runAllSteps([
            async () => {
                if (testAgentAttachmentId) {
                    const attachmentId = testAgentAttachmentId;
                    testAgentAttachmentId = null;
                    await detachTestAgent(ctx, attachmentId);
                }
            },
            ...createdDetailIds.splice(0).reverse().map((id) => () => deleteRowAndConfirm(ctx.Provider, ctx.User, CONVERSATION_DETAIL_ENTITY, id, 'a message a room check posted')),
        ]),
});
