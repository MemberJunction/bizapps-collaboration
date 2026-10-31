import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { MJConversationEntity, MJFileEntity } from '@memberjunction/core-entities';
import { mjBizAppsCollaborationSpacePageEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_CHAT_ENTITY, SPACE_ENTITY, SPACE_ITEM_ENTITY, SPACE_PAGE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser, View } from '../wire.js';
import { deleteRowAndConfirm, registerChecks } from './cleanup-helpers.js';
import { COLLABORATION_STORAGE_PROVIDER_ID } from '../world/local-storage-account.js';

const DISCOVERY_SPACE_ID = 'C1000001-0000-4000-8000-000000000002';
const HARBOR_SPACE_ID = 'C1000001-0000-4000-8000-000000000006';
const COMMITTEE_SPACE_ID = 'C1000001-0000-4000-8000-000000000004';

const checks: NamedCheck[] = [
    {
        Id: 'row-filters.RF1',
        Name: 'RF1 — Bea (Client on Discovery) sees Discovery and Field notes, but nothing from Harbor',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const view = View(ctx);

            const spaces = await view.RunView<{ ID: string; Name: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID', 'Name'],
                ResultType: 'simple',
            }, bea);

            Assert(spaces.Success, `Bea RunView Spaces failed: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Bea can see Discovery space');
            Assert(!visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Bea MUST NOT see Harbor space');
        },
    },
    {
        Id: 'row-filters.RF2',
        Name: 'RF2 — Bea sees only Shared band items; Team items (discovery-brief) are hidden',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const view = View(ctx);

            const items = await view.RunView<{ ID: string; SpaceID: string; Band: string }>({
                EntityName: SPACE_ITEM_ENTITY,
                Fields: ['ID', 'SpaceID', 'Band'],
                ResultType: 'simple',
            }, bea);

            Assert(items.Success, `Bea RunView Space Items failed: ${items.ErrorMessage ?? 'unknown'}`);
            Assert(Array.isArray(items.Results) && items.Results.length > 0, 'Bea must see at least one Shared item in Discovery');
            for (const item of items.Results ?? []) {
                Assert(item.Band === 'Shared', `Bea saw non-Shared item with band '${item.Band}'`);
            }

            // Find Team items in Discovery space and assert Bea cannot see any of them by ID
            const teamItems = await FindRows<{ ID: string }>(
                ctx,
                SPACE_ITEM_ENTITY,
                `SpaceID = '${DISCOVERY_SPACE_ID}' AND Band = 'Team'`,
                ['ID'],
            );
            Assert(teamItems.length > 0, 'At least one Team item exists in Discovery space');
            const beaVisibleItemIds = new Set((items.Results ?? []).map((i) => i.ID.toLowerCase()));
            for (const teamItem of teamItems) {
                Assert(!beaVisibleItemIds.has(teamItem.ID.toLowerCase()), `Team item ${teamItem.ID} MUST NOT be visible to Bea`);
            }
        },
    },
    {
        Id: 'row-filters.RF3',
        Name: 'RF3 — Harper (Client on Harbor) sees Harbor, but nothing from Discovery or Committee',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harper = await GetPersonaUser(ctx, 'harper');
            const view = View(ctx);

            const spaces = await view.RunView<{ ID: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID'],
                ResultType: 'simple',
            }, harper);

            Assert(spaces.Success, `Harper RunView Spaces failed: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Harper can see Harbor space');
            Assert(!visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Harper MUST NOT see Discovery space');
            Assert(!visibleIds.has(COMMITTEE_SPACE_ID.toLowerCase()), 'Harper MUST NOT see Committee space');
        },
    },
    {
        Id: 'row-filters.RF4',
        Name: 'RF4 — Dana (Director on Committee) sees Committee, but not Discovery or Harbor',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const dana = await GetPersonaUser(ctx, 'dana');
            const view = View(ctx);

            const spaces = await view.RunView<{ ID: string }>({
                EntityName: SPACE_ENTITY,
                Fields: ['ID'],
                ResultType: 'simple',
            }, dana);

            Assert(spaces.Success, `Dana RunView Spaces failed: ${spaces.ErrorMessage ?? 'unknown'}`);
            const visibleIds = new Set((spaces.Results ?? []).map((s) => s.ID.toLowerCase()));

            Assert(visibleIds.has(COMMITTEE_SPACE_ID.toLowerCase()), 'Dana can see Committee space');
            Assert(!visibleIds.has(DISCOVERY_SPACE_ID.toLowerCase()), 'Dana MUST NOT see Discovery space');
            Assert(!visibleIds.has(HARBOR_SPACE_ID.toLowerCase()), 'Dana MUST NOT see Harbor space');
        },
    },
    {
        Id: 'row-filters.RF5',
        Name: 'RF5 — Bea (outside Client on Discovery) reads Space Pages and gets Shared pages only, never a Team page',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const view = View(ctx);

            let sharedPageId: string | null = null;
            let teamPageId: string | null = null;
            try {
                const sharedPage = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpacePageEntity>(SPACE_PAGE_ENTITY, ada);
                sharedPage.NewRecord();
                sharedPage.SpaceID = DISCOVERY_SPACE_ID;
                sharedPage.Title = 'RF5 Shared Discovery Page';
                sharedPage.Band = 'Shared';
                sharedPage.Status = 'Published';
                sharedPage.Sequence = 10;
                sharedPage.PublishedBlocks = '[]';
                Assert(await sharedPage.Save(), `Ada failed to save Shared page: ${sharedPage.LatestResult?.CompleteMessage ?? 'unknown'}`);
                sharedPageId = sharedPage.ID;

                const teamPage = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpacePageEntity>(SPACE_PAGE_ENTITY, ada);
                teamPage.NewRecord();
                teamPage.SpaceID = DISCOVERY_SPACE_ID;
                teamPage.Title = 'RF5 Internal Team Discovery Page';
                teamPage.Band = 'Team';
                teamPage.Status = 'Published';
                teamPage.Sequence = 11;
                teamPage.PublishedBlocks = '[]';
                Assert(await teamPage.Save(), `Ada failed to save Team page: ${teamPage.LatestResult?.CompleteMessage ?? 'unknown'}`);
                teamPageId = teamPage.ID;

                const pages = await view.RunView<{ ID: string; SpaceID: string; Band: string; Title: string }>({
                    EntityName: SPACE_PAGE_ENTITY,
                    ExtraFilter: `SpaceID = '${DISCOVERY_SPACE_ID}'`,
                    Fields: ['ID', 'SpaceID', 'Band', 'Title'],
                    ResultType: 'simple',
                    BypassCache: true,
                }, bea);

                Assert(pages.Success, `Bea RunView Space Pages failed: ${pages.ErrorMessage ?? 'unknown'}`);
                const results = pages.Results ?? [];
                Assert(results.length > 0, 'Bea must see at least the Shared page in Discovery');
                for (const p of results) {
                    Assert(p.Band === 'Shared', `Bea saw non-Shared page '${p.Title}' with band '${p.Band}'`);
                }
                const visiblePageIds = new Set(results.map((p) => p.ID.toLowerCase()));
                Assert(visiblePageIds.has(sharedPageId.toLowerCase()), 'Bea must see the Shared page');
                Assert(!visiblePageIds.has(teamPageId.toLowerCase()), 'Bea MUST NOT see the Team page');
            } finally {
                if (sharedPageId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_PAGE_ENTITY, sharedPageId, 'RF5 Shared Space Page');
                }
                if (teamPageId) {
                    await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_PAGE_ENTITY, teamPageId, 'RF5 Team Space Page');
                }
            }
        },
    },
    {
        Id: 'row-filters.RF6',
        Name: "RF6 — a staff (UI) user reads the files, indexed documents and chats of spaces they reach, never another space's; everything outside Collaboration stays readable",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const harbor = await GetPersonaUser(ctx, 'harbor');
            const ada = await GetPersonaUser(ctx, 'ada');
            const view = View(ctx);
            const readable = async (user: typeof ada, entity: string, filter: string): Promise<number> => {
                const res = await view.RunView<{ ID: string }>({ EntityName: entity, ExtraFilter: filter, Fields: ['ID'], ResultType: 'simple', IgnoreMaxRows: true }, user);
                Assert(res.Success, `${user.Name} RunView ${entity} failed: ${res.ErrorMessage ?? 'unknown'}`);
                return (res.Results ?? []).length;
            };

            // Discovery's files: Harbor's owner (UI, Harbor only) reads none; Ada (UI, reaches Discovery) reads every one
            const filesEntity = ctx.Provider.EntityByName('MJ: Files');
            const items = await FindRows<{ RecordID: string }>(ctx, SPACE_ITEM_ENTITY, `SpaceID = '${DISCOVERY_SPACE_ID}' AND EntityID = '${filesEntity?.ID}'`, ['RecordID']);
            const fileIds = items.map((item) => item.RecordID.replace(/^ID\|/i, ''));
            Assert(fileIds.length > 0, 'Discovery holds world files');
            const inFiles = fileIds.map((id) => `'${id}'`).join(', ');
            Assert(await readable(harbor, 'MJ: Files', `ID IN (${inFiles})`) === 0, "Harbor's owner reads none of Discovery's files");
            Assert(await readable(ada, 'MJ: Files', `ID IN (${inFiles})`) === fileIds.length, "Ada reads every one of Discovery's files");

            // Their indexed documents and text, wherever the pipeline has indexed them
            const docs = `FileID IN (${inFiles})`;
            const chunks = `ContentItemID IN (SELECT ID FROM [__mj].[ContentItem] WHERE ${docs})`;
            Assert(await readable(harbor, 'MJ: Content Items', docs) === 0, "Harbor's owner reads no document indexed from Discovery");
            Assert(await readable(harbor, 'MJ: Content Item Chunks', chunks) === 0, "Harbor's owner reads no text indexed from Discovery");
            Assert(await readable(ada, 'MJ: Content Items', docs) === await readable(ctx.User, 'MJ: Content Items', docs), "Ada reads every document indexed from Discovery");

            // Discovery's chats: Harbor's owner reads none of their conversations or messages; Ada reads every one
            const chats = await FindRows<{ ConversationID: string }>(ctx, SPACE_CHAT_ENTITY, `SpaceID = '${DISCOVERY_SPACE_ID}' AND ConversationID IS NOT NULL`, ['ConversationID']);
            Assert(chats.length > 0, 'Discovery holds space chats');
            const inChats = chats.map((chat) => `'${chat.ConversationID}'`).join(', ');
            const messages = `ConversationID IN (${inChats})`;
            Assert(await readable(harbor, 'MJ: Conversations', `ID IN (${inChats})`) === 0, "Harbor's owner reads none of Discovery's chats");
            Assert(await readable(harbor, 'MJ: Conversation Details', messages) === 0, "Harbor's owner reads no message in Discovery's chats");
            Assert(await readable(ada, 'MJ: Conversations', `ID IN (${inChats})`) === chats.length, "Ada reads every one of Discovery's chats");
            Assert(await readable(ada, 'MJ: Conversation Details', messages) === await readable(ctx.User, 'MJ: Conversation Details', messages), "Ada reads every message in Discovery's chats");

            // Outside Collaboration nothing changes for a UI user. Every record link and conversation the world holds outside a
            // space stays readable (a database built from empty may hold none), and so do a file and a conversation this check
            // creates on no space, so the leg is never vacuous.
            const spaceItemsEntity = ctx.Provider.EntityByName(SPACE_ITEM_ENTITY);
            const outside = `EntityID <> '${spaceItemsEntity?.ID}'`;
            Assert((await readable(harbor, 'MJ: Entity Record Documents', outside)) === (await readable(ctx.User, 'MJ: Entity Record Documents', outside)), "Harbor's owner reads every record link outside Collaboration");
            const notChats = 'ID NOT IN (SELECT ConversationID FROM [__mj_BizAppsCollaboration].[SpaceChat] WHERE ConversationID IS NOT NULL)';
            Assert((await readable(harbor, 'MJ: Conversations', notChats)) === (await readable(ctx.User, 'MJ: Conversations', notChats)), "Harbor's owner reads every conversation outside Collaboration");

            let fileId: string | null = null;
            let conversationId: string | null = null;
            try {
                const file = await ctx.Provider.GetEntityObject<MJFileEntity>('MJ: Files', ctx.User);
                file.NewRecord();
                file.Name = 'RF6 file outside Collaboration';
                file.ProviderID = COLLABORATION_STORAGE_PROVIDER_ID;
                Assert(await file.Save(), `Saving the outside file failed: ${file.LatestResult?.CompleteMessage ?? 'unknown'}`);
                fileId = file.ID;
                const conversation = await ctx.Provider.GetEntityObject<MJConversationEntity>('MJ: Conversations', ctx.User);
                conversation.NewRecord();
                conversation.Name = 'RF6 conversation outside Collaboration';
                conversation.UserID = ctx.User.ID;
                Assert(await conversation.Save(), `Saving the outside conversation failed: ${conversation.LatestResult?.CompleteMessage ?? 'unknown'}`);
                conversationId = conversation.ID;

                Assert(await readable(harbor, 'MJ: Files', `ID = '${fileId}'`) === 1, "Harbor's owner reads a file on no space");
                Assert(await readable(harbor, 'MJ: Conversations', `ID = '${conversationId}'`) === 1, "Harbor's owner reads a conversation outside Collaboration");
            } finally {
                if (conversationId) await deleteRowAndConfirm(ctx.Provider, ctx.User, 'MJ: Conversations', conversationId, 'RF6 outside conversation');
                if (fileId) await deleteRowAndConfirm(ctx.Provider, ctx.User, 'MJ: Files', fileId, 'RF6 outside file');
            }
        },
    },
    {
        Id: 'row-filters.RF7',
        Name: "RF7 — a Shared page never carries a Team comment (every reader receives its payload), and a comment's author is whoever saved it",
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const comment = (id: string, band: string) => ({ id, band, body: 'RF7', authorName: 'The CEO', authorInitials: 'CE', createdAtLabel: 'now', status: 'Open' });
            const newSharedPage = async (comments: unknown[]) => {
                const page = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpacePageEntity>(SPACE_PAGE_ENTITY, ada);
                page.NewRecord();
                page.SpaceID = DISCOVERY_SPACE_ID;
                page.Title = 'RF7 Shared Discovery Page';
                page.Band = 'Shared';
                page.Status = 'Published';
                page.Sequence = 12;
                page.PublishedBlocks = JSON.stringify({ blocks: [], comments });
                return page;
            };

            let pageId: string | null = null;
            try {
                const refused = await newSharedPage([comment('rf7-team', 'Team')]);
                Assert(!(await refused.Save()), 'A Shared page carrying a Team comment must be refused');
                Assert(/can't carry Team comments/.test(refused.LatestResult?.CompleteMessage ?? ''), `Refused for another reason: ${refused.LatestResult?.CompleteMessage ?? 'unknown'}`);

                const page = await newSharedPage([comment('rf7-shared', 'Shared')]);
                Assert(await page.Save(), `Ada failed to save the Shared page: ${page.LatestResult?.CompleteMessage ?? 'unknown'}`);
                pageId = page.ID;
                const [row] = await FindRows<{ PublishedBlocks: string }>(ctx, SPACE_PAGE_ENTITY, `ID = '${pageId}'`, ['PublishedBlocks']);
                const stored = JSON.parse(row?.PublishedBlocks ?? '{}') as { comments?: Array<{ authorName?: string }> };
                Assert(stored.comments?.[0]?.authorName === (ada.FirstLast || ada.Name), `The comment's author is '${stored.comments?.[0]?.authorName}', not the saver`);
            } finally {
                if (pageId) await deleteRowAndConfirm(ctx.Provider, ctx.User, SPACE_PAGE_ENTITY, pageId, 'RF7 Shared Space Page');
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('row-filters', {
    Setup: async () => {},
    Teardown: async () => {},
});
