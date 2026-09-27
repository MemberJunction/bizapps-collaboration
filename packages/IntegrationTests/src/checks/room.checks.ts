import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { MJConversationDetailEntity, MJConversationEntity } from '@memberjunction/core-entities';
import { postSpaceMessage, uploadSpaceFile, decideUploadBand, collaborationFileStore } from '@mj-biz-apps/collaboration-core-entities-server';
import { mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { CONVERSATION_ENTITY, CONVERSATION_DETAIL_ENTITY, SPACE_ENTITY, SPACE_ITEM_ENTITY, FILE_ENTITY, SPACE_CHAT_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser, View } from '../wire.js';
import { COLLABORATION_STORAGE_ACCOUNT_ID, ensureLocalStorageAccount } from '../world/local-storage-account.js';
import { worldStorageRoot } from '../world/seed-files.js';

const NORTHWIND_SPACE_ID = 'C1000001-0000-4000-8000-000000000001';
const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
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

            // Assert UserID is bound to the system user (not regular user)
            const systemUsers = await FindRows<{ ID: string }>(ctx, 'MJ: Users', "Email = 'not.set@nowhere.com'", ['ID']);
            Assert(systemUsers.length === 1, 'System user found in MJ: Users');
            Assert(room.UserID.toLowerCase() === systemUsers[0].ID.toLowerCase(), `Room conversation must be bound to system user, saw: ${room.UserID}`);

            // Assert Space Chat room row exists for room conversation
            const spaceChats = await FindRows<{
                ID: string;
                SpaceID: string;
                ConversationID: string;
                Kind: string;
                Status: string;
            }>(
                ctx,
                SPACE_CHAT_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND ConversationID = '${room.ID}'`,
                ['ID', 'SpaceID', 'ConversationID', 'Kind', 'Status'],
            );
            Assert(spaceChats.length === 1, `Discovery Space Chat room row exists (found ${spaceChats.length})`);
            Assert(spaceChats[0].Kind === 'Room', `Space Chat Kind is Room, saw ${spaceChats[0].Kind}`);
            Assert(spaceChats[0].Status === 'Active', `Space Chat Status is Active, saw ${spaceChats[0].Status}`);
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

            const view = View(ctx);

            // Check default chat list filter (Global / Both scopes)
            const defaultChat = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `UserID = '${ada.ID}' AND (IsArchived IS NULL OR IsArchived = 0) AND ApplicationScope IN ('Global', 'Both')`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, ada);
            Assert(defaultChat.Success, `Default chat view failed: ${defaultChat.ErrorMessage ?? ''}`);
            const foundDefault = (defaultChat.Results ?? []).some((c) => c.ID.toLowerCase() === roomId.toLowerCase());
            Assert(!foundDefault, "Owner's default chat list MUST NOT contain the space room conversation");

            // Check chat list when includeApplicationScoped is toggled on (drops scope clause, still filters by UserID)
            const appChat = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `UserID = '${ada.ID}' AND (IsArchived IS NULL OR IsArchived = 0)`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, ada);
            Assert(appChat.Success, `App-inclusive chat view failed: ${appChat.ErrorMessage ?? ''}`);
            const foundApp = (appChat.Results ?? []).some((c) => c.ID.toLowerCase() === roomId.toLowerCase());
            Assert(!foundApp, "Owner's chat list with app scope included MUST NOT contain the room conversation (it is system-owned)");
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
            Assert(patRes.Success, `Pat RunView failed unexpectedly: ${patRes.ErrorMessage ?? ''}`);
            Assert(
                (patRes.Results?.length ?? 0) === 0,
                `Pat (Invited) MUST NOT be able to view Discovery room conversation, got ${patRes.Results?.length ?? 0} rows`,
            );

            // Remy queries the room conversation
            const remyRes = await view.RunView<{ ID: string }>({
                EntityName: CONVERSATION_ENTITY,
                ExtraFilter: `ID = '${roomId}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, remy);
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
            const bea = await GetPersonaUser(ctx, 'bea');

            const result = await postSpaceMessage(ctx.Provider, bea, {
                spaceId: DISCOVERY_SPACE_ID,
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
            const ada = await GetPersonaUser(ctx, 'ada');
            const adaRes = await postSpaceMessage(ctx.Provider, ada, {
                spaceId: DISCOVERY_SPACE_ID,
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

            try {
                // 1. Sam asks in Northwind's room: Casey's read must NOT name uniqueFileName
                const samPostRes = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: NORTHWIND_SPACE_ID,
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
                const samSealedRes = await postSpaceMessage(ctx.Provider, sam, {
                    spaceId: SEALED_BRANCH_SPACE_ID,
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
            } finally {
                if (sealedItemId) {
                    const itemToDelete = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(SPACE_ITEM_ENTITY, sam);
                    if (await itemToDelete.Load(sealedItemId)) {
                        const deleted = await itemToDelete.Delete();
                        Assert(deleted === true, 'Deleting uploaded Sealed branch space item must succeed');
                    }
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

            // 5. Item 3: Owner-type user with no seat must be refused
            const origType = remy.Type;
            try {
                remy.Type = 'Owner';
                const ownerOutsiderRes = await postSpaceMessage(ctx.Provider, remy, {
                    spaceId: DISCOVERY_SPACE_ID,
                    text: 'Message from Owner with no seat',
                });
                Assert(!ownerOutsiderRes.ok, 'Owner-type user with no seat must be refused a post');
            } finally {
                remy.Type = origType;
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
