/**
 * Stage 3 over the wire: the turn's tools as the browser's call sees them (`ToolsJSON`), and Run space data running from a turn
 * through MJAPI.
 */
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { CollaborationClient } from '@mj-biz-apps/collaboration-entities';
import { COLLABORATION_TEST_AGENT_ID, COLLABORATION_TEST_AGENT_NAME } from '../../agents/test-agent.js';
import { CONVERSATION_DETAIL_ENTITY } from '../../entity-names.js';
import { FindRows, getPersonaClientContext } from '../../wire.js';
import { cleanupConversation, registerChecks } from '../cleanup-helpers.js';
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
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage3', {
    Setup: async () => {},
    Teardown: async () => {},
});
