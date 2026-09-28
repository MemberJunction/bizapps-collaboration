import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { MJConversationDetailEntity, MJConversationEntity } from '@memberjunction/core-entities';
import { postSpaceMessage, uploadSpaceFile, decideUploadBand, collaborationFileStore, createSpaceConversation } from '@mj-biz-apps/collaboration-core-entities-server';
import { mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceMemberEntity } from '@mj-biz-apps/collaboration-entities';
import { CONVERSATION_ENTITY, CONVERSATION_DETAIL_ENTITY, SPACE_ENTITY, SPACE_ITEM_ENTITY, FILE_ENTITY, SPACE_CHAT_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser, View } from '../wire.js';
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount } from '../world/local-storage-account.js';
import { worldStorageRoot } from '../world/seed-files.js';

const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const CLOSED_PAST_SPACE_ID = 'C1000001-0000-4000-8000-000000000008';
const CLOSED_RECENT_SPACE_ID = 'C1000001-0000-4000-8000-000000000007';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';
const SEALED_BRANCH_SPACE_ID = 'C1000001-0000-4000-8000-000000000014';
const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';

const createdDetailIds: string[] = [];

const checks: NamedCheck[] = [
    {
        Id: 'room.RM1',
        Name: 'RM1 — space conversation bound to system user, linked to space, and scoped to Collaboration app',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const spaceChats = await FindRows<{
                ID: string;
                SpaceID: string;
                ConversationID: string;
                Kind: string;
                Status: string;
            }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND Kind = 'General'`,
                ['ID', 'SpaceID', 'ConversationID', 'Kind', 'Status'],
            );

            Assert(spaceChats.length >= 1, `Discovery Space Chat General row exists (found ${spaceChats.length})`);
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
                `ID = '${chat.ConversationID}'`,
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
        },
    },
    {
        Id: 'room.RM2',
        Name: "RM2 — owner's regular chat list excludes the space conversation",
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');

            // Find Discovery General conversation ID
            const spaceChats = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND Kind = 'General'`,
                ['ConversationID'],
            );
            Assert(spaceChats.length >= 1, 'Discovery General conversation found');
            const convId = spaceChats[0].ConversationID;

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
        },
    },
    {
        Id: 'room.RM3',
        Name: 'RM3 — contributing seat (Ada) direct save to General conversation succeeds; non-contributor (Pat, Dana) and spoofing are refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const pat = await GetPersonaUser(ctx, 'pat');
            const dana = await GetPersonaUser(ctx, 'dana');

            const startRes = await createSpaceConversation(ctx.Provider, ada, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-rm3-${Date.now()}`,
                Kind: 'General',
            });
            Assert(startRes.ok === true && !!startRes.conversationId, `Ada starts General conversation for RM3: ${startRes.message ?? ''}`);
            const convId = startRes.conversationId!;

            // Direct save by Ada (contributing seat with Edit grant on conversation) succeeds
            const adaDetail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, ada);
            adaDetail.NewRecord();
            adaDetail.ConversationID = convId;
            adaDetail.UserID = ada.ID;
            adaDetail.Role = 'User';
            adaDetail.Message = 'Direct chat by contributing member into space conversation';
            adaDetail.Status = 'Complete';

            const adaSaved = await adaDetail.Save();
            Assert(adaSaved && !!adaDetail.ID, `Direct conversation detail save by contributing member should succeed: ${adaDetail.LatestResult?.CompleteMessage ?? ''}`);

            // Clean up Ada's message and verify deletion succeeds
            const adaDeleted = await adaDetail.Delete();
            Assert(adaDeleted, `Ada deleting her own detail should succeed: ${adaDetail.LatestResult?.CompleteMessage ?? ''}`);

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
                await patDetail.Delete();
            }
            Assert(!patSaved || !patDetail.ID, 'Direct conversation detail save into room by non-contributor must be refused');

            // Direct save by Dana into Committee conversation (guest seat, CanContribute = false) is refused
            const committeeChats = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${COMMITTEE_SPACE_ID}' AND Kind = 'General' AND Status = 'Active'`,
                ['ConversationID'],
            );
            Assert(committeeChats.length >= 1, 'Committee General conversation found');
            const committeeConvId = committeeChats[0].ConversationID;

            const danaDetail = await ctx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, dana);
            danaDetail.NewRecord();
            danaDetail.ConversationID = committeeConvId;
            danaDetail.UserID = dana.ID;
            danaDetail.Role = 'User';
            danaDetail.Message = 'Dana attempting direct save in committee room';
            danaDetail.Status = 'Complete';

            const danaSaved = await danaDetail.Save();
            if (danaSaved) {
                await danaDetail.Delete();
            }
            Assert(!danaSaved || !danaDetail.ID, 'Direct conversation detail save into room by non-contributor (Dana in Committee) must be refused');

            const bea = await GetPersonaUser(ctx, 'bea');

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
                await beaSpoofDetail.Delete();
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
                await beaAiDetail.Delete();
            }
            Assert(!aiSaved || !beaAiDetail.ID, 'Bea saving detail with Role = AI must be refused');
        },
    },
    {
        Id: 'room.RM4',
        Name: 'RM4 — Pat (Invited) and Remy (Removed) query space conversation and get nothing; post-close access reads conversation',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const pat = await GetPersonaUser(ctx, 'pat');
            const remy = await GetPersonaUser(ctx, 'remy');

            const discChats = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND Kind = 'General'`,
                ['ConversationID'],
            );
            Assert(discChats.length >= 1, 'Discovery General conversation found');
            const convId = discChats[0].ConversationID;

            const view = View(ctx);

            // Pat queries the space conversation
            const patRes = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${convId}'`,
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
                ExtraFilter: `ID = '${convId}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, remy);
            Assert(remyRes.Success, `Remy RunView failed unexpectedly: ${remyRes.ErrorMessage ?? ''}`);
            Assert(
                (remyRes.Results?.length ?? 0) === 0,
                `Remy (Removed) MUST NOT be able to view Discovery space conversation, got ${remyRes.Results?.length ?? 0} rows`,
            );

            // Assertion that someone with post-close access reads the conversation of a closed space (closed-recent)
            const closedChats = await FindRows<{ ConversationID: string }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${CLOSED_RECENT_SPACE_ID}'`,
                ['ConversationID'],
            );
            Assert(closedChats.length >= 1, 'Closed-recent space conversation found');
            const closedConvId = closedChats[0].ConversationID;

            const casey = await GetPersonaUser(ctx, 'casey');
            const caseyClosedRes = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${closedConvId}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, casey);
            Assert(caseyClosedRes.Success, `Casey RunView on closed-recent conversation failed: ${caseyClosedRes.ErrorMessage ?? ''}`);
            Assert(
                (caseyClosedRes.Results?.length ?? 0) === 1,
                `Casey (with post-close access) MUST be able to view closed-recent space conversation, got ${caseyClosedRes.Results?.length ?? 0} rows`,
            );
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
                text: '@Assistant summarize materials in this space',
                executeAgent: true,
            });
            Assert(adaRes.ok === true, 'Ada postSpaceMessage with executeAgent succeeds');
            if (!adaRes.ok) throw new Error(`Ada postSpaceMessage failed: ${adaRes.message}`);
            if (adaRes.detailId) createdDetailIds.push(adaRes.detailId);
            if (adaRes.assistantDetailId) createdDetailIds.push(adaRes.assistantDetailId);

            // Read the assistant reply as Bea
            const view = View(ctx);
            const beaReplyRes = await view.RunView<{ ID: string; Message: string }>(
                {
                    EntityName: CONVERSATION_DETAIL_ENTITY,
                    ExtraFilter: `ID = '${adaRes.assistantDetailId}'`,
                    Fields: ['ID', 'Message'],
                    ResultType: 'simple',
                },
                bea,
            );
            Assert(beaReplyRes.Success && (beaReplyRes.Results?.length ?? 0) === 1, 'Bea can read room assistant reply');
            const replyMsg = beaReplyRes.Results![0].Message;
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

            const sealedItemId = uploadOutcome.itemId;
            const sealedItem = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, sam);
            Assert(await sealedItem.Load(sealedItemId), 'Load uploaded sealed item');
            sealedItem.Band = 'Shared';
            const promoted = await sealedItem.Save();
            Assert(promoted, 'Promoting sealed branch item to Shared must succeed');

            let testError: unknown;
            try {
                // 1. Sam asks in Northwind's room: Casey's read must NOT name uniqueFileName
                const nwConvRes = await createSpaceConversation(ctx.Provider, sam, {
                    SpaceID: NORTHWIND_SPACE_ID,
                    Name: `northwind-rm5-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(nwConvRes.ok === true && !!nwConvRes.conversationId, `Sam starts General conversation in Northwind for RM5: ${nwConvRes.message ?? ''}`);
                const nwConvId = nwConvRes.conversationId!;

                const samPostRes = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: NORTHWIND_SPACE_ID,
                    conversationId: nwConvId,
                    text: '@Assistant summarize all materials in this space',
                    executeAgent: true,
                });
                Assert(samPostRes.ok === true, 'Sam postSpaceMessage in Northwind room succeeds');
                if (!samPostRes.ok) throw new Error(`Sam postSpaceMessage failed: ${samPostRes.message}`);
                if (samPostRes.detailId) createdDetailIds.push(samPostRes.detailId);
                if (samPostRes.assistantDetailId) createdDetailIds.push(samPostRes.assistantDetailId);

                // Casey reads the assistant reply in Northwind's room
                const caseyReplyRes = await view.RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${samPostRes.assistantDetailId}'`,
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

                const samSealedRes = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: SEALED_BRANCH_SPACE_ID,
                    conversationId: sealedConvRes.conversationId,
                    text: '@Assistant summarize materials in this space',
                    executeAgent: true,
                });
                Assert(samSealedRes.ok === true, 'Sam postSpaceMessage in Sealed branch room succeeds');
                if (!samSealedRes.ok) throw new Error(`Sam postSpaceMessage failed: ${samSealedRes.message}`);
                if (samSealedRes.detailId) createdDetailIds.push(samSealedRes.detailId);
                if (samSealedRes.assistantDetailId) createdDetailIds.push(samSealedRes.assistantDetailId);

                const samSealedReplyRes = await view.RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${samSealedRes.assistantDetailId}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    sam,
                );
                Assert(samSealedReplyRes.Success && (samSealedReplyRes.Results?.length ?? 0) === 1, 'Sam can read Sealed branch room assistant reply');
                const sealedReplyMsg = samSealedReplyRes.Results![0].Message;
                Assert(sealedReplyMsg.includes(uniqueFileName), `Sealed branch room reply must name its own Shared file ${uniqueFileName}`);
            } catch (err) {
                testError = err;
            } finally {
                if (sealedItemId) {
                    try {
                        const itemToDelete = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
                        const loaded = await itemToDelete.Load(sealedItemId);
                        Assert(loaded === true, `Failed to load uploaded Sealed branch space item ${sealedItemId} for cleanup`);
                        const deleted = await itemToDelete.Delete();
                        Assert(deleted === true, `Deleting uploaded Sealed branch space item ${sealedItemId} must succeed: ${itemToDelete.LatestResult?.CompleteMessage ?? ''}`);
                    } catch (cleanupErr) {
                        if (!testError) {
                            throw cleanupErr;
                        } else {
                            console.error(`Cleanup failed after test error: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`);
                        }
                    }
                }
                if (testError) {
                    throw testError;
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

            // 0. Missing conversation ID
            const noConvRes = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                text: 'Message without conversationId',
            });
            Assert(!noConvRes.ok, 'Message without conversationId must be refused');
            Assert(!noConvRes.ok && noConvRes.message === 'A conversation ID is required to post a message.', 'Correct missing conversationId message');

            // 1. Empty message
            const emptyRes = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                conversationId: discConvId,
                text: '   ',
            });
            Assert(!emptyRes.ok, 'Empty message must be refused');
            Assert(!emptyRes.ok && emptyRes.message === 'The message is empty.', 'Correct empty message error');

            // 2. Message over 4000 chars
            const longText = 'x'.repeat(4001);
            const longRes = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                conversationId: discConvId,
                text: longText,
            });
            Assert(!longRes.ok, 'Message > 4000 characters must be refused');
            Assert(!longRes.ok && longRes.message.includes('limited to 4000 characters'), 'Correct length limit error');

            // 3. Closed space
            const closedRes = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: CLOSED_PAST_SPACE_ID,
                conversationId: discConvId,
                text: 'Message to closed space',
            });
            Assert(!closedRes.ok, 'Message to closed space must be refused');

            // 4. Non-contributor (Remy - Removed)
            const remyRes = await postSpaceMessage(ctx.Provider, remy, {
                spaceId: DISCOVERY_SPACE_ID,
                conversationId: discConvId,
                text: 'Message from removed user',
            });
            Assert(!remyRes.ok, 'Message from removed user must be refused');

            // 5. Owner-type user with no seat must be refused
            const origType = remy.Type;
            try {
                remy.Type = 'Owner';
                const ownerOutsiderRes = await postSpaceMessage(ctx.Provider, remy, {
                    spaceId: DISCOVERY_SPACE_ID,
                    conversationId: discConvId,
                    text: 'Message from Owner with no seat',
                });
                Assert(!ownerOutsiderRes.ok, 'User with Owner account type and no space seat must be refused a post');
            } finally {
                remy.Type = origType;
            }

            // 6. Conversation not belonging to this space
            const foreignConvRes = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                text: 'Message with mismatched conversation ID',
                conversationId: '00000000-0000-0000-0000-000000000001',
            });
            Assert(!foreignConvRes.ok, 'Conversation not belonging to space must be refused');
            Assert(!foreignConvRes.ok && foreignConvRes.message === 'The conversation does not belong to this space.', 'Correct mismatched conversation error');
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

            // 2. Dana (guest, non-contributor in committee) is refused starting a conversation
            const danaRes = await createSpaceConversation(ctx.Provider, dana, {
                SpaceID: COMMITTEE_SPACE_ID,
                Name: `committee-dana-${Date.now()}`,
                Kind: 'General',
            });
            Assert(!danaRes.ok, 'Dana (guest in Committee) must be refused starting a conversation');
        },
    },
    {
        Id: 'room.RM8',
        Name: 'RM8 — createSpaceConversation WhoCanStart=Owners: Sam is refused, Ada is permitted',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const sam = await GetPersonaUser(ctx, 'sam');

            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space as Ada');
            const origConfig = space.Configuration;

            try {
                const configObj = origConfig ? JSON.parse(origConfig) : {};
                configObj.Chats = { ...(configObj.Chats ?? {}), WhoCanStart: 'Owners' };
                space.Configuration = JSON.stringify(configObj);
                const saved = await space.Save();
                Assert(saved, 'Updated Discovery space config with WhoCanStart: Owners');

                // Sam (contributing member, but not owner) is refused
                const samRes = await createSpaceConversation(ctx.Provider, sam, {
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-sam-refused-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(!samRes.ok, 'Sam (non-owner) must be refused starting a conversation when WhoCanStart is Owners');

                // Ada (owner) is permitted
                const adaRes = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-ada-allowed-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(adaRes.ok === true && !!adaRes.conversationId, `Ada (owner) must be permitted when WhoCanStart is Owners: ${adaRes.message ?? ''}`);
            } finally {
                const restoreSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                if (await restoreSpace.Load(DISCOVERY_SPACE_ID)) {
                    restoreSpace.Configuration = origConfig;
                    const restored = await restoreSpace.Save();
                    Assert(restored, 'Restoring original Discovery space configuration must succeed');
                }
            }
        },
    },
    {
        Id: 'room.RM9',
        Name: 'RM9 — Bea reads/posts in Discovery General conversation; refused reading, posting, or starting Private',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');

            // 1. Bea creates/starts a Private conversation in Discovery — REFUSED because she cannot see Team
            const startPrivRes = await createSpaceConversation(ctx.Provider, bea, {
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-bea-private-${Date.now()}`,
                Kind: 'Private',
            });
            Assert(!startPrivRes.ok, 'Bea (outside member, cannot see Team) must be refused starting a Private conversation');

            // 2. Find Discovery General conversation and Private conversation seeded by world loader
            const spaceChats = await FindRows<{
                ID: string;
                SpaceID: string;
                ConversationID: string;
                Kind: string;
            }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND Status = 'Active'`,
                ['ID', 'SpaceID', 'ConversationID', 'Kind'],
            );

            const generalChat = spaceChats.find((c) => c.Kind === 'General');
            const privateChat = spaceChats.find((c) => c.Kind === 'Private');
            Assert(!!generalChat, 'Discovery General conversation found');
            Assert(!!privateChat, 'Discovery Private conversation found');

            const view = View(ctx);

            // 3. Bea can read General conversation
            const beaGenRead = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${generalChat!.ConversationID}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, bea);
            Assert(beaGenRead.Success && (beaGenRead.Results?.length ?? 0) === 1, 'Bea can read Discovery General conversation');

            // 4. Bea can post in General conversation
            const beaPostGen = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                conversationId: generalChat!.ConversationID,
                text: 'Bea posted in General channel.',
            });
            if (!beaPostGen.ok) {
                throw new Error(`Bea can post in Discovery General conversation failed: ${beaPostGen.message}`);
            }
            Assert(beaPostGen.ok === true && !!beaPostGen.detailId, 'Bea can post in Discovery General conversation');
            createdDetailIds.push(beaPostGen.detailId);

            // 5. Bea CANNOT read Private conversation
            const beaPrivRead = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${privateChat!.ConversationID}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, bea);
            Assert(beaPrivRead.Success && (beaPrivRead.Results?.length ?? 0) === 0, 'Bea CANNOT read Discovery Private conversation');

            // 6. Bea CANNOT post in Private conversation
            const beaPostPriv = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
                conversationId: privateChat!.ConversationID,
                text: 'Bea trying to post in Private channel.',
            });
            Assert(!beaPostPriv.ok, 'Bea must be refused posting in Discovery Private conversation');
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
            const saved = await testSpace.Save();
            Assert(saved && !!testSpace.ID, `Created new space for RM10: ${testSpace.LatestResult?.CompleteMessage ?? ''}`);

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
                const startRes = await createSpaceConversation(ctx.Provider, ada, {
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
                const adminSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                if (await adminSpace.Load(testSpace.ID)) {
                    await adminSpace.Delete();
                }
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
            const saved = await testSpace.Save();
            Assert(saved && !!testSpace.ID, `Created test space for RM11: ${testSpace.LatestResult?.CompleteMessage ?? ''}`);

            try {
                // 1. Start General conversation
                const startRes = await createSpaceConversation(ctx.Provider, ada, {
                    SpaceID: testSpace.ID,
                    Name: 'General',
                    Kind: 'General',
                });
                Assert(startRes.ok === true && !!startRes.conversationId, `Ada starts General conversation: ${startRes.message ?? ''}`);
                const convId = startRes.conversationId!;

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

                // 4. Verify conversation is archived with [ArchivedOnClose]
                const archivedChats = await FindRows<{ ID: string; Status: string; Subject: string }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `SpaceID = '${testSpace.ID}'`,
                    ['ID', 'Status', 'Subject'],
                );
                Assert(archivedChats.length === 1, 'Found conversation for test space');
                Assert(archivedChats[0].Status === 'Archived', `Conversation status must be Archived after close, saw ${archivedChats[0].Status}`);
                Assert(archivedChats[0].Subject?.includes('[ArchivedOnClose]'), 'Conversation Subject must be tagged with [ArchivedOnClose]');

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
                Assert(!samPostClosed.ok, 'Sam post in closed space must be refused');

                // 7. Ada reopens the space
                testSpace.ClosedAt = null;
                const reopenedSaved = await testSpace.Save();
                Assert(reopenedSaved, 'Ada reopens test space');

                // 8. Verify conversation is restored to Active and tag is stripped
                const restoredChats = await FindRows<{ ID: string; Status: string; Subject: string }>(
                    ctx,
                    SPACE_CHAT_ENTITY,
                    `SpaceID = '${testSpace.ID}'`,
                    ['ID', 'Status', 'Subject'],
                );
                Assert(restoredChats.length === 1, 'Found conversation for test space after reopen');
                Assert(restoredChats[0].Status === 'Active', `Conversation status must be Active after reopen, saw ${restoredChats[0].Status}`);
                Assert(!restoredChats[0].Subject?.includes('[ArchivedOnClose]'), 'Conversation Subject must NOT have [ArchivedOnClose] tag after reopen');

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
                const adminSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ctx.User);
                if (await adminSpace.Load(testSpace.ID)) {
                    await adminSpace.Delete();
                }
            }
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('room', {
    Setup: async () => {},
    Teardown: async (ctx: IntegrationCheckContext) => {
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
