/**
 * Stage 3 over the wire: the turn's tools as the browser's call sees them (`ToolsJSON`), and Run space data running from a turn
 * through MJAPI.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient } from '@mj-biz-apps/collaboration-entities';
import { COLLABORATION_TEST_AGENT_ID, COLLABORATION_TEST_AGENT_NAME } from '../../agents/test-agent.js';
import { CONVERSATION_DETAIL_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext } from '../../wire.js';
import { getPersonaSubscribingProvider } from '../../persona-provider.js';
import type { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_ENTITY } from '../../entity-names.js';
import { cleanupConversation, cleanupStep, registerChecks } from '../cleanup-helpers.js';
import { attachAgentToSpace, detachTestAgent } from '../test-agent-attachment.js';

const CHAPTER_12 = 'C1000001-0000-4000-8000-000000000016';
const CHAPTER_12_STAFF = 'C1000001-0000-4000-8000-000000000019';
/** `Collaboration: Run Space Data`, as `metadata/actions/` ships it. */
const RUN_SPACE_DATA_ACTION_ID = 'EAE6CFED-E2EB-4B6E-816D-6CFE5156A5F5';
type ClientPersona = Awaited<ReturnType<typeof getPersonaClientContext>>;
const clientOf = (persona: ClientPersona): CollaborationClient => new CollaborationClient(persona.GraphQLProvider);

interface ToolsGiven { audience: string; actionIds: string[]; dataGrantNames: string[]; knowledgeSourceIds: string[]; withheld: string[] }

async function turnOverTheWire(ctx: IntegrationCheckContext, persona: ClientPersona, spaceId: string, conversationId: string, text: string) {
    const client = clientOf(persona);
    const posted = await client.PostSpaceMessage({ SpaceID: spaceId, ConversationID: conversationId, Text: text });
    Assert(posted.Success === true && !!posted.DetailID, `The message is posted over the wire: ${posted.ErrorMessage ?? ''}`);
    const turn = await client.ExecuteSpaceChatTurn({ SpaceID: spaceId, ConversationID: conversationId, UserMessageID: posted.DetailID! });
    Assert(turn.Success === true && !!turn.ToolsJSON, `The turn runs over the wire and reports its tools: ${turn.ErrorMessage ?? ''}`);
    const tools = JSON.parse(turn.ToolsJSON ?? '{}') as ToolsGiven;
    const [reply] = await FindRows<{ Message: string }>(ctx, CONVERSATION_DETAIL_ENTITY, `ID = '${turn.ReplyDetailIDs?.[0]}'`, ['Message'], undefined, { BypassCache: true });
    return { turn, tools, reply: reply?.Message ?? '' };
}

const checks: NamedCheck[] = [
    {
        Id: 'stage3.TC1',
        Name: 'TC1 — over the wire: a leader\'s General turn in chapter 12 reports a Shared audience, no action (the reminder binds ChapterID, A16) and no data',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const lena = await getPersonaClientContext(ctx, 'lena');
            const nico = await getPersonaClientContext(ctx, 'nico');
            let attachment: string | null = null;
            let conversation: { id: string; chat: string } | null = null;
            try {
                attachment = await attachAgentToSpace(ctx, COLLABORATION_TEST_AGENT_ID, CHAPTER_12);
                const started = await clientOf(nico).CreateSpaceConversation({ SpaceID: CHAPTER_12, Name: `chapter-12-tc1-${Date.now()}`, Kind: 'General' });
                Assert(started.Success === true && !!started.ConversationID, `Nico starts a General conversation over the wire: ${started.ErrorMessage ?? ''}`);
                conversation = { id: started.ConversationID!, chat: started.SpaceChatID! };
                const { tools, reply } = await turnOverTheWire(ctx, lena, CHAPTER_12, conversation.id, `@${COLLABORATION_TEST_AGENT_NAME} what can you run here?`);
                Assert(tools.audience === 'Shared', `Shared audience (${tools.audience})`);
                Assert(tools.actionIds.length === 0 && tools.dataGrantNames.length === 0, `No action and no data for the leader (${tools.actionIds.join(',')} / ${tools.dataGrantNames.join(',')})`);
                Assert(tools.withheld.some((line) => /A16/.test(line)), `The bound action is withheld: ${tools.withheld.join(' | ')}`);
                Assert(/Tools: none/.test(reply), 'The agent was told of no tools');
            } finally {
                if (conversation) await cleanupConversation(ctx.Provider, ctx.User, conversation.id, conversation.chat);
                if (attachment) await detachTestAgent(ctx, attachment);
            }
        },
    },
    {
        Id: 'stage3.TC2',
        Name: 'TC2 — over the wire: national staff\'s Internal Only turn in the staff space holds Run space data and runs the renewals query with the chapter bound',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await getPersonaClientContext(ctx, 'nico');
            let attachment: string | null = null;
            let conversation: { id: string; chat: string } | null = null;
            try {
                attachment = await attachAgentToSpace(ctx, COLLABORATION_TEST_AGENT_ID, CHAPTER_12_STAFF);
                const started = await clientOf(nico).CreateSpaceConversation({ SpaceID: CHAPTER_12_STAFF, Name: `staff-tc2-${Date.now()}`, Kind: 'Private' });
                Assert(started.Success === true && !!started.ConversationID, `Nico starts an Internal Only conversation over the wire: ${started.ErrorMessage ?? ''}`);
                conversation = { id: started.ConversationID!, chat: started.SpaceChatID! };
                const { tools, reply } = await turnOverTheWire(ctx, nico, CHAPTER_12_STAFF, conversation.id, `@${COLLABORATION_TEST_AGENT_NAME} run "Renewals by month"`);
                Assert(tools.audience === 'Team', 'Team audience');
                Assert(tools.actionIds.map((id) => id.toUpperCase()).includes(RUN_SPACE_DATA_ACTION_ID), `Run space data is given (${tools.actionIds.join(',')})`);
                Assert(tools.dataGrantNames.includes('Renewals by month'), `The renewals query is in force (${tools.dataGrantNames.join(',')})`);
                Assert(/Run space data: ok: Renewals by month: 2 rows/.test(reply), `The query ran with the chapter bound: ${reply.split('\n').pop()}`);
            } finally {
                if (conversation) await cleanupConversation(ctx.Provider, ctx.User, conversation.id, conversation.chat);
                if (attachment) await detachTestAgent(ctx, attachment);
            }
        },
    },
    {
        Id: 'stage3.TC3',
        Name: 'TC3 — the cacheInvalidation subscription is shaped per subscriber (MJ#5242, the plan\'s A12.13): a leader, who reads spaces through a row filter, hears that a space changed with no key; a Developer, who reads them unfiltered, hears the key',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await getPersonaClientContext(ctx, 'nico');
            const lenaSocket = await getPersonaSubscribingProvider(ctx, 'lena');
            const devSocket = await getPersonaSubscribingProvider(ctx, 'dev');
            const SUB = `subscription CacheInvalidation { cacheInvalidation { EntityName PrimaryKeyValues Action SourceServerID Timestamp OriginSessionID RecordData } }`;
            interface Event { EntityName: string; PrimaryKeyValues?: string | null; Action: string; RecordData?: string | null }
            const heard = { lena: [] as Event[], dev: [] as Event[] };
            const listen = (provider: typeof lenaSocket, into: Event[]) => provider.Subscribe(SUB).subscribe({
                next: (data: { cacheInvalidation?: Event }) => { const e = data?.cacheInvalidation; if (e && e.EntityName === SPACE_ENTITY) into.push(e); },
                error: () => undefined,
            });
            const subscriptions = [listen(lenaSocket, heard.lena), listen(devSocket, heard.dev)];
            const space = await nico.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, nico.User);
            Assert(await space.Load(CHAPTER_12), 'Nico loads chapter 12 over the wire');
            const before = space.Description;
            try {
                // The sockets need a moment to be acknowledged before the save, or the event is published before they listen
                await new Promise((resolve) => setTimeout(resolve, 2500));
                space.Description = `${before ?? ''} (TC3 ${Date.now()})`.trim();
                Assert(await space.Save(), `Nico saves chapter 12 over the wire: ${space.LatestResult?.CompleteMessage ?? ''}`);
                const deadline = Date.now() + 15000;
                while (Date.now() < deadline && (heard.lena.length === 0 || heard.dev.length === 0)) await new Promise((resolve) => setTimeout(resolve, 250));
                Assert(heard.dev.length > 0, `The Developer hears the save (${heard.dev.length} events)`);
                Assert(heard.lena.length > 0, `The leader hears the save too (${heard.lena.length} events)`);
                const devEvent = heard.dev[0];
                const lenaEvent = heard.lena[0];
                Assert(devEvent.Action === 'save' && lenaEvent.Action === 'save', 'Both hear a save');
                Assert(!!devEvent.PrimaryKeyValues && devEvent.PrimaryKeyValues.toUpperCase().includes(CHAPTER_12), `The Developer's event names the space (${devEvent.PrimaryKeyValues})`);
                Assert(lenaEvent.PrimaryKeyValues === null || lenaEvent.PrimaryKeyValues === undefined, `The leader's event carries no key (${lenaEvent.PrimaryKeyValues ?? 'none'})`);
                Assert(!lenaEvent.RecordData, 'The leader\'s event carries no row');
            } finally {
                for (const sub of subscriptions) sub.unsubscribe();
                lenaSocket.DisposeWebSocketResources();
                devSocket.DisposeWebSocketResources();
                await cleanupStep(async () => {
                    const restore = await nico.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, nico.User);
                    if (await restore.Load(CHAPTER_12)) { restore.Description = before; Assert(await restore.Save(), 'Chapter 12\'s description is restored'); }
                });
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage3', {
    Setup: async () => {},
    Teardown: async () => {},
});
