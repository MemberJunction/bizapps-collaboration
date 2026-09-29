import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { collaborationFileStore, createSpaceConversation, decideUploadBand, executeSpaceChatTurn, postSpaceMessage, uploadSpaceFile } from '@mj-biz-apps/collaboration-core-entities-server';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { COLLABORATION_TEST_AGENT_NAME } from '../agents/test-agent.js';
import { CONVERSATION_DETAIL_ENTITY, CONVERSATION_ENTITY, SPACE_CHAT_ENTITY, SPACE_ENTITY, SPACE_ITEM_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser, View } from '../wire.js';
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount } from '../world/local-storage-account.js';
import { worldStorageRoot } from '../world/seed-files.js';
import { cleanupConversation, cleanupSpace, cleanupStep, deleteRowAndConfirm, registerChecks } from './cleanup-helpers.js';
import { attachTestAgent, detachTestAgent } from './test-agent-attachment.js';

const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';
const SEALED_BRANCH_SPACE_ID = 'C1000001-0000-4000-8000-000000000014';
const SEALED_CHILD_SPACE_ID = 'C1000001-0000-4000-8000-000000000015';
const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';


const createdDetailIds: string[] = [];
let testAgentAttachmentId: string | null = null;

const checks: NamedCheck[] = [
    {
        Id: 'room.RM1',
        Name: 'RM1 — space conversation bound to system user, linked to space, and scoped to Collaboration app',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const startRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm1-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.ok === true && !!startRes.conversationId && !!startRes.spaceChatId, `Ada starts General conversation for RM1: ${startRes.message ?? ''}`);
            const convId = startRes.conversationId!;
            const chatId = startRes.spaceChatId!;

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

                Assert(spaceChats.length === 1, `Discovery Space Chat row exists`);
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
                const conv = convs[0];
                Assert(conv.ApplicationScope === 'Application', `ApplicationScope is Application, saw ${conv.ApplicationScope}`);
                Assert(conv.ApplicationID?.toLowerCase() === COLLABORATION_APP_ID.toLowerCase(), 'ApplicationID is Collaboration App');

                // Assert UserID is bound to the system user (not regular user)
                const systemUsers = await FindRows<{ ID: string }>(ctx, 'MJ: Users', "Email = 'not.set@nowhere.com'", ['ID']);
                Assert(systemUsers.length === 1, 'System user found in MJ: Users');
                Assert(conv.UserID.toLowerCase() === systemUsers[0].ID.toLowerCase(), `Space conversation must be bound to system user, saw: ${conv.UserID}`);
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, convId, chatId);
            }
        },
    },
    {
        Id: 'room.RM2',
        Name: "RM2 — owner's regular chat list excludes the space conversation",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const startRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm2-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.ok === true && !!startRes.conversationId && !!startRes.spaceChatId, `Ada starts General conversation for RM2: ${startRes.message ?? ''}`);
            const convId = startRes.conversationId!;
            const chatId = startRes.spaceChatId!;

            try {
                const view = View(ctx);

                // Check default chat list filter (Global / Both scopes)
                const defaultChat = await view.RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `UserID = '${ada.ID}' AND (IsArchived IS NULL OR IsArchived = 0) AND ApplicationScope IN ('Global', 'Both')`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, ada);
                Assert(defaultChat.Success, `Default chat view failed: ${defaultChat.ErrorMessage ?? ''}`);
                const foundDefault = (defaultChat.Results ?? []).some((c) => c.ID.toLowerCase() === convId.toLowerCase());
                Assert(!foundDefault, "Owner's default chat list MUST NOT contain the space conversation");

                // Check chat list when includeApplicationScoped is toggled on (drops scope clause, still filters by UserID)
                const appChat = await view.RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `UserID = '${ada.ID}' AND (IsArchived IS NULL OR IsArchived = 0)`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, ada);
                Assert(appChat.Success, `App-inclusive chat view failed: ${appChat.ErrorMessage ?? ''}`);
                const foundApp = (appChat.Results ?? []).some((c) => c.ID.toLowerCase() === convId.toLowerCase());
                Assert(!foundApp, "Owner's chat list with app scope included MUST NOT contain the space conversation (it is system-owned)");
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, convId, chatId);
            }
        },
    },
    {
        Id: 'room.RM3',
        Name: 'RM3 — contributing seat (Ada, Bea) direct save to General conversation succeeds; non-contributor (Pat, Dana) and spoofing are refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const pat = await GetPersonaUser(ctx, 'pat');
            const dana = await GetPersonaUser(ctx, 'dana');

            const startRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm3-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.ok === true && !!startRes.conversationId, `Ada starts General conversation for RM3: ${startRes.message ?? ''}`);
            const convId = startRes.conversationId!;
            const chatId = startRes.spaceChatId;

            try {
                // Direct save by Ada (contributing staff seat with Edit grant on conversation) succeeds
                const adaDetail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, ada);
                adaDetail.NewRecord();
                adaDetail.ConversationID = convId;
                adaDetail.UserID = ada.ID;
                adaDetail.Role = 'User';
                adaDetail.Message = 'Direct chat by Ada into space conversation';
                adaDetail.Status = 'Complete';

                const adaSaved = await adaDetail.Save();
                Assert(adaSaved && !!adaDetail.ID, `Direct conversation detail save by Ada should succeed: ${adaDetail.LatestResult?.CompleteMessage ?? ''}`);

                const adaDeleted = await adaDetail.Delete();
                Assert(adaDeleted === true, `Ada deleting her own detail should succeed: ${adaDetail.LatestResult?.CompleteMessage ?? ''}`);

                // Baseline for Bea: Bea (contributing client seat in Discovery with Edit grant) direct save succeeds
                const beaDetail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, bea);
                beaDetail.NewRecord();
                beaDetail.ConversationID = convId;
                beaDetail.UserID = bea.ID;
                beaDetail.Role = 'User';
                beaDetail.Message = 'Direct chat by Bea into space conversation';
                beaDetail.Status = 'Complete';

                const beaSaved = await beaDetail.Save();
                Assert(beaSaved && !!beaDetail.ID, `Direct conversation detail save by Bea should succeed: ${beaDetail.LatestResult?.CompleteMessage ?? ''}`);

                const cleanupBea = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, ctx.User);
                if (await cleanupBea.Load(beaDetail.ID)) {
                    const delOk = await cleanupBea.Delete();
                    Assert(delOk === true, 'Harness delete of Bea detail must succeed');
                }

                // Direct save by Pat (Invited / non-contributor without Edit grant) is refused
                const patDetail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, pat);
                patDetail.NewRecord();
                patDetail.ConversationID = convId;
                patDetail.UserID = pat.ID;
                patDetail.Role = 'User';
                patDetail.Message = 'Direct chat attempt by non-contributor into space conversation';
                patDetail.Status = 'Complete';

                const patSaved = await patDetail.Save();
                if (patSaved) {
                    const patDel = await patDetail.Delete();
                    Assert(patDel === true, 'Pat cleanup delete must succeed');
                }
                Assert(!patSaved || !patDetail.ID, 'Direct conversation detail save into room by non-contributor must be refused');

                // Direct save by Dana into Committee conversation (guest seat, CanContribute = false) is refused
                const sam = await GetPersonaUser(ctx, 'sam');
                const commStartRes = await createSpaceConversation(ctx.Provider, sam, {
                    SpaceID: COMMITTEE_SPACE_ID,
                    Name: `committee-rm3-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(commStartRes.ok === true && !!commStartRes.conversationId, 'Sam starts General conversation in Committee for RM3');
                const committeeConvId = commStartRes.conversationId!;
                const committeeChatId = commStartRes.spaceChatId;

                try {
                    const danaDetail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, dana);
                    danaDetail.NewRecord();
                    danaDetail.ConversationID = committeeConvId;
                    danaDetail.UserID = dana.ID;
                    danaDetail.Role = 'User';
                    danaDetail.Message = 'Dana attempting direct save in committee room';
                    danaDetail.Status = 'Complete';

                    const danaSaved = await danaDetail.Save();
                    if (danaSaved) {
                        const danaDel = await danaDetail.Delete();
                        Assert(danaDel === true, 'Dana cleanup delete must succeed');
                    }
                    Assert(!danaSaved || !danaDetail.ID, 'Direct conversation detail save into room by non-contributor (Dana in Committee) must be refused');
                } finally {
                    await cleanupConversation(ctx.Provider, ctx.User, committeeConvId, committeeChatId);
                }

                // Bea saving detail with mismatched UserID (spoofing Pat) is refused
                const beaSpoofDetail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, bea);
                beaSpoofDetail.NewRecord();
                beaSpoofDetail.ConversationID = convId;
                beaSpoofDetail.UserID = pat.ID;
                beaSpoofDetail.Role = 'User';
                beaSpoofDetail.Message = 'Bea spoofing Pat';
                beaSpoofDetail.Status = 'Complete';

                const spoofSaved = await beaSpoofDetail.Save();
                if (spoofSaved) {
                    const spoofDel = await beaSpoofDetail.Delete();
                    Assert(spoofDel === true, 'Spoof cleanup delete must succeed');
                }
                Assert(!spoofSaved || !beaSpoofDetail.ID, 'Bea saving detail with mismatched UserID must be refused');

                // Bea saving detail with Role = 'AI' is refused
                const beaAiDetail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, bea);
                beaAiDetail.NewRecord();
                beaAiDetail.ConversationID = convId;
                beaAiDetail.UserID = bea.ID;
                beaAiDetail.Role = 'AI';
                beaAiDetail.Message = 'Bea spoofing AI role';
                beaAiDetail.Status = 'Complete';

                const aiSaved = await beaAiDetail.Save();
                if (aiSaved) {
                    const aiDel = await beaAiDetail.Delete();
                    Assert(aiDel === true, 'AI cleanup delete must succeed');
                }
                Assert(!aiSaved || !beaAiDetail.ID, 'Bea saving detail with Role = AI must be refused');
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, convId, chatId);
            }
        },
    },
    {
        Id: 'room.RM4',
        Name: 'RM4 — Pat (Invited) and Remy (Removed) query space conversation and get nothing; post-close access reads conversation',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const pat = await GetPersonaUser(ctx, 'pat');
            const remy = await GetPersonaUser(ctx, 'remy');
            const casey = await GetPersonaUser(ctx, 'casey');

            // 1. Create conversation on demand in Discovery
            const startRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm4-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.ok === true && !!startRes.conversationId, `Ada starts General conversation for RM4: ${startRes.message ?? ''}`);
            const discConvId = startRes.conversationId!;
            const discChatId = startRes.spaceChatId;

            const view = View(ctx);

            try {
                // Pat queries the space conversation
                const patRes = await view.RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${discConvId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, pat);
                Assert(patRes.Success, `Pat RunView failed unexpectedly: ${patRes.ErrorMessage ?? ''}`);
                Assert(
                    (patRes.Results?.length ?? 0) === 0,
                    `Pat (Invited) MUST NOT be able to view Discovery space conversation, got ${patRes.Results?.length ?? 0} rows`,
                );

                // Remy queries the space conversation
                const remyRes = await view.RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${discConvId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, remy);
                Assert(remyRes.Success, `Remy RunView failed unexpectedly: ${remyRes.ErrorMessage ?? ''}`);
                Assert(
                    (remyRes.Results?.length ?? 0) === 0,
                    `Remy (Removed) MUST NOT be able to view Discovery space conversation, got ${remyRes.Results?.length ?? 0} rows`,
                );
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, discConvId, discChatId);
            }

            // 2. Post-close access: create on-demand child space under Northwind, start conversation, close space, verify Casey reads
            const nwSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await nwSpace.Load(NORTHWIND_SPACE_ID), 'Load Northwind space');
            const typeId = nwSpace.SpaceTypeID;

            const closedTestSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            closedTestSpace.NewRecord();
            closedTestSpace.Name = `RM4-Closed-Test-${Date.now()}`;
            closedTestSpace.SpaceTypeID = typeId;
            closedTestSpace.ParentID = NORTHWIND_SPACE_ID;
            closedTestSpace.InheritsMembership = true;
            closedTestSpace.OwnerID = ada.ID;
            const spaceSaved = await closedTestSpace.Save();
            Assert(spaceSaved && !!closedTestSpace.ID, `Created closed test space for RM4: ${closedTestSpace.LatestResult?.CompleteMessage ?? ''}`);

            let closedConvId: string | undefined;
            try {
                const closedStartRes = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: closedTestSpace.ID,
                    Name: 'General',
                    Kind: 'General',
                });
                Assert(closedStartRes.ok === true && !!closedStartRes.conversationId, `Ada starts General conversation in test space: ${closedStartRes.message ?? ''}`);
                closedConvId = closedStartRes.conversationId!;

                // Close the space
                closedTestSpace.ClosedAt = new Date();
                const closedOk = await closedTestSpace.Save();
                Assert(closedOk, 'Ada closes test space');

                // Casey (with post-close access) reads the conversation
                const caseyClosedRes = await view.RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${closedConvId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, casey);
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
            const bea = await GetPersonaUser(ctx, 'bea');
            const ada = await GetPersonaUser(ctx, 'ada');

            const startRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm5-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.ok === true && !!startRes.conversationId, `Ada starts General conversation for RM5: ${startRes.message ?? ''}`);
            const discConvId = startRes.conversationId!;
            const discChatId = startRes.spaceChatId;

            let nwConvId: string | undefined;
            let nwChatId: string | undefined;
            let sealedConvId: string | undefined;
            let sealedChatId: string | undefined;
            let sealedItemId: string | undefined;

            try {
                const result = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: discConvId,
                    text: 'Hello from Bea in the Discovery space room!',
                });

                if (!result.ok) {
                    throw new Error(`PostSpaceMessage by Bea failed: ${result.message}`);
                }
                Assert(!!result.detailId, 'PostSpaceMessage returned a detailId');
                if (result.detailId) {
                    createdDetailIds.push(result.detailId);
                }

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

                // B0.2: Ada asks with executeAgent: true, and as Bea, the reply in Discovery room does not quote Team files
                const adaRes = await postSpaceMessage(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: discConvId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} summarize materials in this space`,
                });
                Assert(adaRes.ok === true, 'Ada postSpaceMessage succeeds');
                if (!adaRes.ok) throw new Error(`Ada postSpaceMessage failed: ${adaRes.message}`);
                if (adaRes.detailId) createdDetailIds.push(adaRes.detailId);

                const adaTurnRes = await executeSpaceChatTurn(ctx.Provider, ada, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: discConvId,
                    userMessageId: adaRes.detailId!,
                });
                Assert(adaTurnRes.ok === true, 'Ada executeSpaceChatTurn succeeds');
                if (!adaTurnRes.ok) throw new Error(`Ada executeSpaceChatTurn failed: ${adaTurnRes.message}`);
                const adaAssistantDetailId = adaTurnRes.replyDetailIds[0];
                if (adaAssistantDetailId) createdDetailIds.push(adaAssistantDetailId);

                // Read the assistant reply as Bea
                const view = View(ctx);
                const beaReplyRes = await view.RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${adaAssistantDetailId}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    bea,
                );
                Assert(beaReplyRes.Success && (beaReplyRes.Results?.length ?? 0) === 1, 'Bea can read room assistant reply');
                const replyMsg = beaReplyRes.Results![0].Message;
                Assert(replyMsg.includes('site-photo.png'), 'Room assistant reply must quote Shared file site-photo.png');
                Assert(!replyMsg.includes('discovery-brief.pdf'), 'Room assistant reply must not name Team file discovery-brief.pdf');
                Assert(!replyMsg.includes('field-notes.txt'), 'Room assistant reply must not name Team file field-notes.txt');

                // B0.2: With a Shared item in Sealed branch, Sam asks in Northwind's room, and as Casey the reply does not name it
                const sam = await GetPersonaUser(ctx, 'sam');
                const casey = await GetPersonaUser(ctx, 'casey');

                await ensureLocalStorageAccount(ctx.Provider, ctx.User, worldStorageRoot());
                const store = collaborationFileStore(ctx.Provider, COLLABORATION_STORAGE_ACCOUNT_ID);
                const uniqueFileName = `sealed-branch-plan-${Date.now()}.txt`;

                const uploadOutcome = await uploadSpaceFile({
                    user: sam,
                    storageUser: ctx.User,
                    provider: ctx.Provider,
                    store,
                    spaceId: SEALED_BRANCH_SPACE_ID,
                    folder: 'Internal',
                    fileName: uniqueFileName,
                    mimeType: 'text/plain',
                    content: Buffer.from('Sealed branch confidential test plan content'),
                    gate: () => decideUploadBand(ctx.Provider, sam, SEALED_BRANCH_SPACE_ID),
                });
                Assert(uploadOutcome.ok, `Uploading file as Sam in Sealed branch must succeed: ${uploadOutcome.ok ? '' : uploadOutcome.message}`);
                if (!uploadOutcome.ok) throw new Error(`Upload failed: ${uploadOutcome.message}`);

                sealedItemId = uploadOutcome.itemId;
                const sealedItem = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, sam);
                Assert(await sealedItem.Load(sealedItemId), 'Load uploaded sealed item');
                sealedItem.Band = 'Shared';
                const promoted = await sealedItem.Save();
                Assert(promoted, 'Promoting sealed branch item to Shared must succeed');

                // 1. Sam asks in Northwind's room: Casey's read must NOT name uniqueFileName
                const nwConvRes = await createSpaceConversation(ctx.Provider, sam, {
                    SpaceID: NORTHWIND_SPACE_ID,
                    Name: `northwind-rm5-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(nwConvRes.ok === true && !!nwConvRes.conversationId, `Sam starts General conversation in Northwind for RM5: ${nwConvRes.message ?? ''}`);
                nwConvId = nwConvRes.conversationId!;
                nwChatId = nwConvRes.spaceChatId;

                const samPostRes = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: NORTHWIND_SPACE_ID,
                    conversationId: nwConvId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} summarize all materials in this space`,
                });
                Assert(samPostRes.ok === true, 'Sam postSpaceMessage in Northwind room succeeds');
                if (!samPostRes.ok) throw new Error(`Sam postSpaceMessage failed: ${samPostRes.message}`);
                if (samPostRes.detailId) createdDetailIds.push(samPostRes.detailId);

                const samTurnRes = await executeSpaceChatTurn(ctx.Provider, sam, {
                    spaceId: NORTHWIND_SPACE_ID,
                    conversationId: nwConvId,
                    userMessageId: samPostRes.detailId!,
                });
                Assert(samTurnRes.ok === true, 'Sam executeSpaceChatTurn in Northwind room succeeds');
                if (!samTurnRes.ok) throw new Error(`Sam executeSpaceChatTurn failed: ${samTurnRes.message}`);
                const samAssistantDetailId = samTurnRes.replyDetailIds[0];
                if (samAssistantDetailId) createdDetailIds.push(samAssistantDetailId);

                // Casey reads the assistant reply in Northwind's room
                const caseyReplyRes = await view.RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${samAssistantDetailId}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    casey,
                );
                Assert(caseyReplyRes.Success && (caseyReplyRes.Results?.length ?? 0) === 1, 'Casey can read Northwind room assistant reply');
                const nwReplyMsg = caseyReplyRes.Results![0].Message;
                Assert(!nwReplyMsg.includes(uniqueFileName), `Northwind room assistant reply must not name sub-space Shared file ${uniqueFileName}`);

                // 2. The other half: Sam asking in Sealed branch's own room names it
                const sealedConvRes = await createSpaceConversation(ctx.Provider, sam, {
                    SpaceID: SEALED_BRANCH_SPACE_ID,
                    Name: `sealed-branch-gen-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(sealedConvRes.ok && !!sealedConvRes.conversationId, 'Sam creates General conversation in Sealed branch');
                sealedConvId = sealedConvRes.conversationId!;
                sealedChatId = sealedConvRes.spaceChatId;

                const samSealedRes = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: SEALED_BRANCH_SPACE_ID,
                    conversationId: sealedConvId,
                    text: `@${COLLABORATION_TEST_AGENT_NAME} summarize materials in this space`,
                });
                Assert(samSealedRes.ok === true, 'Sam postSpaceMessage in Sealed branch room succeeds');
                if (!samSealedRes.ok) throw new Error(`Sam postSpaceMessage failed: ${samSealedRes.message}`);
                if (samSealedRes.detailId) createdDetailIds.push(samSealedRes.detailId);

                const samSealedTurnRes = await executeSpaceChatTurn(ctx.Provider, sam, {
                    spaceId: SEALED_BRANCH_SPACE_ID,
                    conversationId: sealedConvId,
                    userMessageId: samSealedRes.detailId!,
                });
                Assert(samSealedTurnRes.ok === true, 'Sam executeSpaceChatTurn in Sealed branch room succeeds');
                if (!samSealedTurnRes.ok) throw new Error(`Sam executeSpaceChatTurn in Sealed branch failed: ${samSealedTurnRes.message}`);
                const sealedAssistantDetailId = samSealedTurnRes.replyDetailIds[0];
                if (sealedAssistantDetailId) createdDetailIds.push(sealedAssistantDetailId);

                const samSealedReplyRes = await view.RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${sealedAssistantDetailId}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    sam,
                );
                Assert(samSealedReplyRes.Success && (samSealedReplyRes.Results?.length ?? 0) === 1, 'Sam can read Sealed branch room assistant reply');
                const sealedReplyMsg = samSealedReplyRes.Results![0].Message;
                Assert(sealedReplyMsg.includes(uniqueFileName), `Sealed branch room reply must name its own Shared file ${uniqueFileName}`);
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
            const bea = await GetPersonaUser(ctx, 'bea');
            const remy = await GetPersonaUser(ctx, 'remy');
            const ada = await GetPersonaUser(ctx, 'ada');

            const startRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm6-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.ok === true && !!startRes.conversationId, `Ada starts General conversation for RM6: ${startRes.message ?? ''}`);
            const discConvId = startRes.conversationId!;
            const discChatId = startRes.spaceChatId;

            // Create on-demand closed space with a conversation to test closed-space post refusal
            const nwSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await nwSpace.Load(NORTHWIND_SPACE_ID), 'Load Northwind space for RM6');
            const typeId = nwSpace.SpaceTypeID;

            const closedSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            closedSpace.NewRecord();
            closedSpace.Name = `RM6-Closed-Space-${Date.now()}`;
            closedSpace.SpaceTypeID = typeId;
            closedSpace.ParentID = NORTHWIND_SPACE_ID;
            closedSpace.InheritsMembership = true;
            closedSpace.OwnerID = ada.ID;
            const closedSpaceSaved = await closedSpace.Save();
            Assert(closedSpaceSaved && !!closedSpace.ID, 'Created closed test space for RM6');

            const closedConvRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: closedSpace.ID,
                Name: 'General',
                Kind: 'General',
            });
            Assert(closedConvRes.ok && !!closedConvRes.conversationId, 'Created conversation in closed test space');
            const closedConvId = closedConvRes.conversationId!;

            closedSpace.ClosedAt = new Date();
            const closedOk = await closedSpace.Save();
            Assert(closedOk, 'Closed test space for RM6');

            try {
                // 0. Missing conversation ID
                const noConvRes = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    text: 'Message without conversationId',
                });
                Assert(!noConvRes.ok && noConvRes.message === 'A conversation ID is required to post a message.', 'Correct missing conversationId message');

                // 1. Empty message
                const emptyRes = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: discConvId,
                    text: '   ',
                });
                Assert(!emptyRes.ok && emptyRes.message === 'The message is empty.', 'Correct empty message error');

                // 2. Message over 4000 chars
                const longText = 'x'.repeat(4001);
                const longRes = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: discConvId,
                    text: longText,
                });
                Assert(!longRes.ok && longRes.message.includes('limited to 4000 characters'), 'Correct length limit error');

                // 3. Closed space
                const closedRes = await postSpaceMessage(ctx.Provider, ada, {
                    spaceId: closedSpace.ID,
                    conversationId: closedConvId,
                    text: 'Message to closed space',
                });
                Assert(!closedRes.ok && closedRes.message === 'A closed space does not take a new message.', `Correct closed space message, saw: ${!closedRes.ok ? closedRes.message : ''}`);

                // 4. Non-contributor (Remy - Removed)
                const remyRes = await postSpaceMessage(ctx.Provider, remy, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: discConvId,
                    text: 'Message from removed user',
                });
                Assert(!remyRes.ok && remyRes.message === 'Your role on this space cannot post.', `Correct non-contributor message, saw: ${!remyRes.ok ? remyRes.message : ''}`);

                // 5. Owner-type user with no seat must be refused
                const origType = remy.Type;
                try {
                    remy.Type = 'Owner';
                    const ownerOutsiderRes = await postSpaceMessage(ctx.Provider, remy, {
                        spaceId: DISCOVERY_SPACE_ID,
                        conversationId: discConvId,
                        text: 'Message from Owner with no seat',
                    });
                    Assert(!ownerOutsiderRes.ok && ownerOutsiderRes.message === 'Your role on this space cannot post.', `Correct outsider message, saw: ${!ownerOutsiderRes.ok ? ownerOutsiderRes.message : ''}`);
                } finally {
                    remy.Type = origType;
                }

                // 6. Conversation not belonging to this space
                const foreignConvRes = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    text: 'Message with mismatched conversation ID',
                    conversationId: '00000000-0000-0000-0000-000000000001',
                });
                Assert(!foreignConvRes.ok && foreignConvRes.message === 'The conversation does not belong to this space.', 'Correct mismatched conversation error');
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, discConvId, discChatId);
                await cleanupSpace(ctx.Provider, ctx.User, closedSpace.ID);
            }
        },
    },
    {
        Id: 'room.RM7',
        Name: 'RM7 — createSpaceConversation: Sam starts General in Committee; Dana (Guest) is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const sam = await GetPersonaUser(ctx, 'sam');
            const dana = await GetPersonaUser(ctx, 'dana');

            // 1. Sam (contributing member in committee) starts a General conversation
            const samRes = await createSpaceConversation(ctx.Provider, sam, {
                SpaceID: COMMITTEE_SPACE_ID,
                Name: `committee-sam-${Date.now()}`,
                Kind: 'General',
            });
            Assert(samRes.ok === true && !!samRes.conversationId, `Sam can start a General conversation in Committee: ${samRes.message ?? ''}`);

            try {
                // 2. Dana (guest, non-contributor in committee) is refused starting a conversation
                const danaRes = await createSpaceConversation(ctx.Provider, dana, {
                    SpaceID: COMMITTEE_SPACE_ID,
                    Name: `committee-dana-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(!danaRes.ok && danaRes.message === 'Caller is not permitted to start a conversation in this space.', `Dana refused with correct message, saw: ${!danaRes.ok ? danaRes.message : ''}`);
            } finally {
                await cleanupConversation(ctx.Provider, ctx.User, samRes.conversationId, samRes.spaceChatId);
            }
        },
    },
    {
        Id: 'room.RM8',
        Name: 'RM8 — createSpaceConversation WhoCanStart=Owners: Sam is refused, Ada is permitted',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');
            const dev = await GetPersonaUser(ctx, 'dev');

            const ownerRoles = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
            Assert(ownerRoles.length === 1, 'Owner space role type found');
            const ownerRoleId = ownerRoles[0].ID;

            // Ada seats Dev as owner on Discovery so Dev (with Configure Spaces authorization) can configure space settings
            const devMember = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
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
                const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space as dev');
                origConfig = space.Configuration;
                configCaptured = true;

                const configObj = origConfig ? JSON.parse(origConfig) : {};
                configObj.Chats = { ...(configObj.Chats ?? {}), WhoCanStart: 'Owners' };
                space.Configuration = JSON.stringify(configObj);
                const saved = await space.Save();
                Assert(saved, 'Updated Discovery space config with WhoCanStart: Owners as dev');

                // Sam (contributing member, but not owner) is refused
                const samRes = await createSpaceConversation(ctx.Provider, sam, {
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-sam-refused-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(!samRes.ok && samRes.message === 'Caller is not permitted to start a conversation in this space.', `Sam refused with correct message: ${!samRes.ok ? samRes.message : ''}`);

                // Ada (owner) is permitted
                const adaRes = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-ada-allowed-${Date.now()}`,
                    Kind: 'General',
                });
                adaConvId = adaRes.conversationId;
                adaChatId = adaRes.spaceChatId;
                Assert(adaRes.ok === true && !!adaRes.conversationId, `Ada (owner) must be permitted when WhoCanStart is Owners: ${adaRes.message ?? ''}`);
            } finally {
                if (adaConvId || adaChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, adaConvId, adaChatId);
                }
                if (configCaptured) {
                    await cleanupStep(async () => {
                        const restoreSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                        Assert(await restoreSpace.Load(DISCOVERY_SPACE_ID), 'Reload Discovery to restore its configuration');
                        restoreSpace.Configuration = origConfig;
                        Assert(await restoreSpace.Save(), `Restoring Discovery's configuration must succeed: ${restoreSpace.LatestResult?.CompleteMessage ?? ''}`);
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
        Name: 'RM9 — Bea reads/posts in Discovery General conversation; refused reading, posting, or starting Private',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');

            // 1. Bea creates/starts a Private conversation in Discovery — REFUSED because she cannot see Team
            const startPrivRes = await createSpaceConversation(ctx.Provider, bea, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-bea-private-${Date.now()}`,
                Kind: 'Private',
            });
            Assert(!startPrivRes.ok && startPrivRes.message === 'Caller cannot start a Private conversation.', `Bea refused starting Private with correct message: ${!startPrivRes.ok ? startPrivRes.message : ''}`);

            // 2. Ada starts on-demand General and Private conversations in Discovery
            const adaGenRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm9-gen-${Date.now()}`,
                Kind: 'General',
            });
            Assert(adaGenRes.ok && !!adaGenRes.conversationId, 'Ada starts General conversation for RM9');

            const adaPrivRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm9-priv-${Date.now()}`,
                Kind: 'Private',
            });
            Assert(adaPrivRes.ok && !!adaPrivRes.conversationId, 'Ada starts Private conversation for RM9');

            const view = View(ctx);
            let beaDetailId: string | undefined;

            try {
                // 3. Bea can read General conversation
                const beaGenRead = await view.RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${adaGenRes.conversationId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, bea);
                Assert(beaGenRead.Success && (beaGenRead.Results?.length ?? 0) === 1, 'Bea can read Discovery General conversation');

                // 4. Bea can post in General conversation
                const beaPostGen = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: adaGenRes.conversationId!,
                    text: 'Bea posted in General channel.',
                });
                Assert(beaPostGen.ok === true, 'Bea can post in Discovery General conversation');
                if (!beaPostGen.ok) throw new Error(beaPostGen.message);
                beaDetailId = beaPostGen.detailId;

                // 5. Bea CANNOT read Private conversation
                const beaPrivRead = await view.RunView<{ ID: string }>({
                    EntityName: CONVERSATION_ENTITY,
                    ExtraFilter: `ID = '${adaPrivRes.conversationId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, bea);
                Assert(beaPrivRead.Success && (beaPrivRead.Results?.length ?? 0) === 0, 'Bea CANNOT read Discovery Private conversation');

                // 6. Bea CANNOT post in Private conversation
                const beaPostPriv = await postSpaceMessage(ctx.Provider, bea, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: adaPrivRes.conversationId!,
                    text: 'Bea trying to post in Private channel.',
                });
                Assert(!beaPostPriv.ok && beaPostPriv.message === 'Caller cannot post in this internal conversation without Team visibility.', `Bea refused posting in Private with correct message: ${!beaPostPriv.ok ? beaPostPriv.message : ''}`);
            } finally {
                if (beaDetailId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, CONVERSATION_DETAIL_ENTITY, beaDetailId, "Bea's message");
                }
                await cleanupConversation(ctx.Provider, ctx.User, adaGenRes.conversationId, adaGenRes.spaceChatId);
                await cleanupConversation(ctx.Provider, ctx.User, adaPrivRes.conversationId, adaPrivRes.spaceChatId);
            }
        },
    },
    {
        Id: 'room.RM10',
        Name: 'RM10 — newly created space has zero conversations until someone starts one',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');

            // Find a SpaceType to use
            const discovery = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await discovery.Load(DISCOVERY_SPACE_ID), 'Load Discovery space to read SpaceType');
            const typeId = discovery.SpaceTypeID;

            const testSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            testSpace.NewRecord();
            testSpace.Name = `RM10-New-Space-${Date.now()}`;
            testSpace.SpaceTypeID = typeId;
            testSpace.ParentID = DISCOVERY_SPACE_ID;
            testSpace.OwnerID = ada.ID;
            testSpace.InheritsMembership = true;
            const saved = await testSpace.Save();
            Assert(saved && !!testSpace.ID, `Created new space for RM10: ${testSpace.LatestResult?.CompleteMessage ?? ''}`);

            let startRes: { ok: boolean; conversationId?: string; spaceChatId?: string; message?: string } | undefined;
            try {
                // 1. Verify zero conversations exist initially
                const chats = await FindRows<{ ID: string }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `SpaceID = '${testSpace.ID}'`,
                    ['ID'],
                );
                Assert(chats.length === 0, `Newly created space must have zero conversations until one is started (found ${chats.length})`);

                // 2. Start a General conversation through createSpaceConversation
                startRes = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: testSpace.ID,
                    Name: 'General',
                    Kind: 'General',
                });
                Assert(startRes.ok === true && !!startRes.conversationId, `Starting General conversation in new space must succeed: ${startRes.message ?? ''}`);

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
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');

            // Find SpaceType from Northwind
            const nwSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await nwSpace.Load(NORTHWIND_SPACE_ID), 'Load Northwind space');
            const typeId = nwSpace.SpaceTypeID;

            // Create child space under Northwind (Sam inherits contributing Team membership)
            const testSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            testSpace.NewRecord();
            testSpace.Name = `RM11-Close-Reopen-${Date.now()}`;
            testSpace.SpaceTypeID = typeId;
            testSpace.ParentID = NORTHWIND_SPACE_ID;
            testSpace.InheritsMembership = true;
            testSpace.OwnerID = ada.ID;
            const saved = await testSpace.Save();
            Assert(saved && !!testSpace.ID, `Created test space for RM11: ${testSpace.LatestResult?.CompleteMessage ?? ''}`);

            let convId: string | undefined;
            let startRes: { ok: boolean; conversationId?: string; spaceChatId?: string; message?: string } | undefined;
            try {
                // 1. Start General conversation
                startRes = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: testSpace.ID,
                    Name: 'General',
                    Kind: 'General',
                });
                Assert(startRes.ok === true && !!startRes.conversationId, `Ada starts General conversation: ${startRes.message ?? ''}`);
                convId = startRes.conversationId!;

                // 2. Sam (contributing staff seat) posts message in open space — succeeds
                const samPost1 = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: testSpace.ID,
                    conversationId: convId,
                    text: 'Sam post before close',
                });
                Assert(samPost1.ok === true && !!samPost1.detailId, `Sam post before close must succeed: ${samPost1.ok ? '' : samPost1.message}`);
                if (samPost1.ok && samPost1.detailId) createdDetailIds.push(samPost1.detailId);

                // 3. Ada closes the space
                testSpace.ClosedAt = new Date();
                const closedSaved = await testSpace.Save();
                Assert(closedSaved, 'Ada closes test space');

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
                    `ResourceRecordID = '${convId}' AND UserID = '${sam.ID}' AND PermissionLevel = 'Edit'`,
                    ['ID'],
                );
                Assert(grantsAfterClose.length === 0, `Sam must have NO Edit grant on archived conversation after close (found ${grantsAfterClose.length})`);

                // 6. Sam post in closed space is refused
                const samPostClosed = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: testSpace.ID,
                    conversationId: convId,
                    text: 'Sam post in closed space attempt',
                });
                Assert(!samPostClosed.ok && samPostClosed.message === 'A closed space does not take a new message.', `Sam post in closed space refused with correct message, saw: ${!samPostClosed.ok ? samPostClosed.message : ''}`);

                // 7. Ada reopens the space
                testSpace.ClosedAt = null;
                const reopenedSaved = await testSpace.Save();
                Assert(reopenedSaved, 'Ada reopens test space');

                // 8. Verify conversation is restored to Active and ArchivedOnSpaceClose is false
                const restoredChats = await FindRows<{ ID: string; Status: string; ArchivedOnSpaceClose: boolean }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `SpaceID = '${testSpace.ID}'`,
                    ['ID', 'Status', 'ArchivedOnSpaceClose'],
                );
                Assert(restoredChats.length === 1, 'Found conversation for test space after reopen');
                Assert(restoredChats[0].Status === 'Active', `Conversation status must be Active after reopen, saw ${restoredChats[0].Status}`);
                Assert(restoredChats[0].ArchivedOnSpaceClose === false, `Conversation ArchivedOnSpaceClose must be false after reopen, saw: ${restoredChats[0].ArchivedOnSpaceClose}`);

                // 9. Verify Sam's Resource Permission Edit grant is restored
                const grantsAfterReopen = await FindRows<{ ID: string }>(
                    ctx,
                    'MJ: Resource Permissions',
                    `ResourceRecordID = '${convId}' AND UserID = '${sam.ID}' AND PermissionLevel = 'Edit'`,
                    ['ID'],
                );
                Assert(grantsAfterReopen.length === 1, `Sam must have Edit grant restored on conversation after reopen (found ${grantsAfterReopen.length})`);

                // 10. Sam posts in reopened space — succeeds
                const samPostReopen = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: testSpace.ID,
                    conversationId: convId,
                    text: 'Sam post after reopen',
                });
                Assert(samPostReopen.ok === true && !!samPostReopen.detailId, `Sam post after reopen must succeed: ${samPostReopen.ok ? '' : samPostReopen.message}`);
                if (samPostReopen.ok && samPostReopen.detailId) createdDetailIds.push(samPostReopen.detailId);
            } finally {
                await cleanupSpace(ctx.Provider, ctx.User, testSpace.ID);
            }
        },
    },
    {
        Id: 'room.RM12',
        Name: "RM12 — a parent's narrowing override binds a sealed child whoever asks: a seat that cannot see the parent is refused under WhoCanStart=Owners",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');
            const dev = await GetPersonaUser(ctx, 'dev');
            const nora = await GetPersonaUser(ctx, 'nora');

            const roles = await FindRows<{ ID: string; Code: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code IN ('owner', 'member')", ['ID', 'Code']);
            const ownerRoleId = roles.find((r) => r.Code === 'owner')?.ID;
            const memberRoleId = roles.find((r) => r.Code === 'member')?.ID;
            Assert(!!ownerRoleId && !!memberRoleId, 'Owner and member space role types found');

            const seat = async (as: typeof ada, spaceId: string, userId: string, roleId: string) => {
                const member = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, as);
                member.NewRecord();
                member.SpaceID = spaceId;
                member.UserID = userId;
                member.SpaceRoleTypeID = roleId;
                member.Band = 'Team';
                member.Status = 'Active';
                Assert(await member.Save(), `Seating ${userId} on ${spaceId}: ${member.LatestResult?.CompleteMessage ?? ''}`);
                return member.ID;
            };

            const seatIds: string[] = [];
            let configCaptured = false;
            let originalConfig: string | null = null;
            let samConvId: string | undefined;
            let samChatId: string | undefined;
            try {
                // Dev, who holds Configure Spaces, owns Northwind for the check. Nora reaches the sealed child and nothing above it.
                seatIds.push(await seat(ada, NORTHWIND_SPACE_ID, dev.ID, ownerRoleId!));
                seatIds.push(await seat(sam, SEALED_CHILD_SPACE_ID, nora.ID, memberRoleId!));

                const northwind = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                Assert(await northwind.Load(NORTHWIND_SPACE_ID), 'Dev loads Northwind');
                originalConfig = northwind.Configuration;
                configCaptured = true;
                const config = originalConfig ? JSON.parse(originalConfig) : {};
                config.Chats = { ...(config.Chats ?? {}), WhoCanStart: 'Owners' };
                northwind.Configuration = JSON.stringify(config);
                Assert(await northwind.Save(), `Dev narrows Northwind to WhoCanStart=Owners: ${northwind.LatestResult?.CompleteMessage ?? ''}`);

                // Nora cannot read Northwind, so a chain read as her would skip its override and let her start a chat
                const noraRes = await createSpaceConversation(ctx.Provider, nora, { SpaceID: SEALED_CHILD_SPACE_ID, Name: `sealed-nora-${Date.now()}`, Kind: 'General' });
                Assert(
                    !noraRes.ok && noraRes.message === 'Caller is not permitted to start a conversation in this space.',
                    `Nora, a member who cannot see Northwind, is refused under Northwind's WhoCanStart=Owners: ${noraRes.ok ? 'she was allowed' : noraRes.message}`,
                );
                if (noraRes.ok) {
                    await cleanupConversation(ctx.Provider, ctx.User, noraRes.conversationId, noraRes.spaceChatId);
                }

                // Sam owns the sealed child, so the same override lets him
                const samRes = await createSpaceConversation(ctx.Provider, sam, { SpaceID: SEALED_CHILD_SPACE_ID, Name: `sealed-sam-${Date.now()}`, Kind: 'General' });
                samConvId = samRes.conversationId;
                samChatId = samRes.spaceChatId;
                Assert(samRes.ok === true, `Sam, the sealed child's owner, may start a conversation: ${samRes.message ?? ''}`);
            } finally {
                if (samConvId || samChatId) {
                    await cleanupConversation(ctx.Provider, ctx.User, samConvId, samChatId);
                }
                if (configCaptured) {
                    await cleanupStep(async () => {
                        const restore = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, dev);
                        Assert(await restore.Load(NORTHWIND_SPACE_ID), 'Reload Northwind to restore its configuration');
                        restore.Configuration = originalConfig;
                        Assert(await restore.Save(), `Restoring Northwind's configuration: ${restore.LatestResult?.CompleteMessage ?? ''}`);
                        const verify = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                        Assert(await verify.Load(NORTHWIND_SPACE_ID), 'Read Northwind back after the restore');
                        Assert(verify.Configuration === originalConfig, "Northwind's configuration is back to what it was");
                    });
                }
                for (const id of seatIds.reverse()) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_MEMBER_ENTITY, id, 'the RM12 seat');
                }
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
    Teardown: async (ctx: IntegrationCheckContext) => {
        if (testAgentAttachmentId) {
            const attachmentId = testAgentAttachmentId;
            testAgentAttachmentId = null;
            await detachTestAgent(ctx, attachmentId);
        }
        // Clean up messages created in RM5
        while (createdDetailIds.length > 0) {
            const id = createdDetailIds.pop();
            if (id) {
                const detail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, ctx.User);
                if (await detail.Load(id)) {
                    const deleted = await detail.Delete();
                    if (!deleted) {
                        const err = detail.LatestResult?.CompleteMessage ?? 'Delete returned false';
                        console.error(`room Teardown failed to delete detail ${id}: ${err}`);
                        throw new Error(`room Teardown failed to delete detail ${id}: ${err}`);
                    }
                }
            }
        }
    },
});
