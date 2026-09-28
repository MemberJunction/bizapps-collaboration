import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { CollaborationClient, mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { CONVERSATION_ENTITY, CONVERSATION_DETAIL_ENTITY, SPACE_ITEM_ENTITY, FILE_ENTITY, SPACE_ENTITY, SPACE_CHAT_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaContext, getPersonaClientContext, View } from '../../wire.js';

const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';
const CLOSED_PAST_SPACE_ID = 'C1000001-0000-4000-8000-000000000008';
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
        Name: 'RM3 — contributing seat (Ada) direct save to room succeeds over wire; non-member (Pat) is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const adaCtx = await getPersonaClientContext(ctx, 'ada');
            const patCtx = await getPersonaContext(ctx, 'pat');

            const roomConvs = await FindRows<{ ID: string }>(
                ctx,
                CONVERSATION_ENTITY,
                `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${DISCOVERY_SPACE_ID}'`,
                ['ID'],
            );
            Assert(roomConvs.length === 1, 'Discovery room conversation exists');
            const roomId = roomConvs[0].ID;

            // Direct save over wire by Ada (contributing seat)
            const adaDetail = await adaCtx.Provider.GetEntityObject<MJConversationDetailEntity>(CONVERSATION_DETAIL_ENTITY, adaCtx.User);
            adaDetail.NewRecord();
            adaDetail.ConversationID = roomId;
            adaDetail.UserID = adaCtx.User.ID;
            adaDetail.Role = 'User';
            adaDetail.Message = 'Direct chat over wire by contributing member into space room';
            adaDetail.Status = 'Complete';

            const adaSaved = await adaDetail.Save();
            Assert(adaSaved && !!adaDetail.ID, `Direct conversation detail save over wire by contributing member should succeed: ${adaDetail.LatestResult?.CompleteMessage ?? ''}`);

            const deleted = await adaDetail.Delete();
            Assert(deleted, `Ada deleting her own detail over wire should succeed: ${adaDetail.LatestResult?.CompleteMessage ?? ''}`);

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
                await patDetail.Delete();
            }
            Assert(!patSaved || !patDetail.ID, 'Direct conversation detail save over wire by non-contributor (Pat) must be refused');

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
            const sealedItemId = uploadOutcome.ItemID!;

            const sealedItem = await samCtx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, samCtx.User);
            Assert(await sealedItem.Load(sealedItemId), 'Load uploaded sealed item over wire');
            sealedItem.Band = 'Shared';
            const promoted = await sealedItem.Save();
            Assert(promoted, 'Promoting sealed branch item to Shared over wire must succeed');

            let testError: unknown;
            try {
                // 1. Sam asks in Northwind's room: Casey's read must NOT name uniqueFileName
                const samPostRes = await samClient.PostSpaceMessage({
                    SpaceID: NORTHWIND_SPACE_ID,
                    Text: '@Assistant summarize all materials in this space',
                    ExecuteAgent: true,
                });
                Assert(samPostRes.Success === true, `Sam PostSpaceMessage in Northwind room failed: ${samPostRes.ErrorMessage ?? ''}`);
                if (samPostRes.DetailID) createdDetailIds.push(samPostRes.DetailID);
                if (samPostRes.AssistantDetailID) createdDetailIds.push(samPostRes.AssistantDetailID);

                // Casey reads the assistant reply in Northwind's room
                const caseyReplyRes = await View(caseyCtx).RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${samPostRes.AssistantDetailID}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    caseyCtx.User,
                );
                Assert(caseyReplyRes.Success && (caseyReplyRes.Results?.length ?? 0) === 1, 'Casey can read Northwind room assistant reply over the wire');
                const nwReplyMsg = caseyReplyRes.Results![0].Message;
                Assert(!nwReplyMsg.includes(uniqueFileName), `Northwind room assistant reply over the wire must not name sub-space Shared file ${uniqueFileName}`);

                // 2. The other half: Sam asking in Sealed branch's own room names it
                const samSealedRes = await samClient.PostSpaceMessage({
                    SpaceID: SEALED_BRANCH_SPACE_ID,
                    Text: '@Assistant summarize materials in this space',
                    ExecuteAgent: true,
                });
                Assert(samSealedRes.Success === true, `Sam PostSpaceMessage in Sealed branch room failed: ${samSealedRes.ErrorMessage ?? ''}`);
                if (samSealedRes.DetailID) createdDetailIds.push(samSealedRes.DetailID);
                if (samSealedRes.AssistantDetailID) createdDetailIds.push(samSealedRes.AssistantDetailID);

                const samSealedReplyRes = await View(samCtx).RunView<{ ID: string; Message: string }>(
                    {
                        EntityName: CONVERSATION_DETAIL_ENTITY,
                        ExtraFilter: `ID = '${samSealedRes.AssistantDetailID}'`,
                        Fields: ['ID', 'Message'],
                        ResultType: 'simple',
                    },
                    samCtx.User,
                );
                Assert(samSealedReplyRes.Success && (samSealedReplyRes.Results?.length ?? 0) === 1, 'Sam can read Sealed branch room assistant reply over wire');
                const sealedReplyMsg = samSealedReplyRes.Results![0].Message;
                Assert(sealedReplyMsg.includes(uniqueFileName), `Sealed branch room reply over wire must name its own Shared file ${uniqueFileName}`);
            } catch (err) {
                testError = err;
            } finally {
                if (sealedItemId) {
                    try {
                        const itemToDelete = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, ctx.User);
                        const loaded = await itemToDelete.Load(sealedItemId);
                        Assert(loaded === true, `Failed to load uploaded Sealed branch space item ${sealedItemId} over wire for cleanup`);
                        const deleted = await itemToDelete.Delete();
                        Assert(deleted === true, `Deleting uploaded Sealed branch space item over wire must succeed: ${itemToDelete.LatestResult?.CompleteMessage ?? ''}`);
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

            // 2. Dana (guest) is refused
            const danaRes = await danaClient.CreateSpaceConversation({
                SpaceID: COMMITTEE_SPACE_ID,
                Name: `committee-client-dana-${Date.now()}`,
                Kind: 'General',
            });
            Assert(!danaRes.Success, 'Dana (guest in Committee) must be refused starting a conversation over wire');
        },
    },
    {
        Id: 'room.RM8',
        Name: 'RM8 — Client CreateSpaceConversation WhoCanStart=Owners: Bea is refused, Dev is permitted',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const devCtx = await getPersonaClientContext(ctx, 'dev');
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const devClient = new CollaborationClient(devCtx.GraphQLProvider);
            const beaClient = new CollaborationClient(beaCtx.GraphQLProvider);

            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, devCtx.User);
            Assert(await space.Load(DISCOVERY_SPACE_ID), 'Load Discovery space');
            const origConfig = space.Configuration;

            try {
                const configObj = origConfig ? JSON.parse(origConfig) : {};
                configObj.Chats = { ...(configObj.Chats ?? {}), WhoCanStart: 'Owners' };
                space.Configuration = JSON.stringify(configObj);
                const saved = await space.Save();
                Assert(saved, 'Updated Discovery space config with WhoCanStart: Owners');

                // Bea (contributing member, but not owner) is refused
                const beaRes = await beaClient.CreateSpaceConversation({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-client-bea-refused-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(!beaRes.Success, 'Bea must be refused starting a conversation over wire when WhoCanStart is Owners');

                // Dev (owner) is permitted
                const devRes = await devClient.CreateSpaceConversation({
                    SpaceID: DISCOVERY_SPACE_ID,
                    Name: `discovery-client-dev-allowed-${Date.now()}`,
                    Kind: 'General',
                });
                Assert(devRes.Success === true && !!devRes.ConversationID, `Dev (owner) must be permitted over wire when WhoCanStart is Owners: ${devRes.ErrorMessage ?? ''}`);
            } finally {
                const restoreSpace = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, devCtx.User);
                if (await restoreSpace.Load(DISCOVERY_SPACE_ID)) {
                    restoreSpace.Configuration = origConfig;
                    await restoreSpace.Save();
                }
            }
        },
    },
    {
        Id: 'room.RM9',
        Name: 'RM9 — Client: Bea reads/posts in Discovery General; refused reading, posting, or starting Private',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const beaCtx = await getPersonaClientContext(ctx, 'bea');
            const beaClient = new CollaborationClient(beaCtx.GraphQLProvider);

            // 1. Bea creates/starts Private conversation in Discovery — refused over wire
            const startPrivRes = await beaClient.CreateSpaceConversation({
                SpaceID: DISCOVERY_SPACE_ID,
                Name: `discovery-client-bea-private-${Date.now()}`,
                Kind: 'Private',
            });
            Assert(!startPrivRes.Success, 'Bea must be refused starting a Private conversation over wire');

            // 2. Find Discovery General conversation and Private conversation
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

            // 3. Bea can read General conversation over wire
            const beaGenRead = await View(beaCtx).RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${generalChat!.ConversationID}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, beaCtx.User);
            Assert(beaGenRead.Success && (beaGenRead.Results?.length ?? 0) === 1, 'Bea can read Discovery General conversation over wire');

            // 4. Bea can post in General conversation over wire
            const beaPostGen = await beaClient.PostSpaceMessage({
                SpaceID: DISCOVERY_SPACE_ID,
                ConversationID: generalChat!.ConversationID,
                Text: 'Bea posted in General channel over wire.',
            });
            Assert(beaPostGen.Success === true && !!beaPostGen.DetailID, `Bea can post in Discovery General conversation over wire: ${beaPostGen.ErrorMessage ?? ''}`);
            if (beaPostGen.DetailID) createdDetailIds.push(beaPostGen.DetailID);

            // 5. Bea CANNOT read Private conversation over wire
            const beaPrivRead = await View(beaCtx).RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${privateChat!.ConversationID}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, beaCtx.User);
            Assert(beaPrivRead.Success && (beaPrivRead.Results?.length ?? 0) === 0, 'Bea CANNOT read Discovery Private conversation over wire');

            // 6. Bea CANNOT post in Private conversation over wire
            const beaPostPriv = await beaClient.PostSpaceMessage({
                SpaceID: DISCOVERY_SPACE_ID,
                ConversationID: privateChat!.ConversationID,
                Text: 'Bea trying to post in Private channel over wire.',
            });
            Assert(!beaPostPriv.Success, 'Bea must be refused posting in Discovery Private conversation over wire');
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
