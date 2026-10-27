/**
 * Stage 3, agents (B20): what a turn gives the agent, from the one configuration cut to the conversation's audience. The
 * harness's stub agent says what it was given and, asked to, runs *Run space data* the way the agent framework would, so the
 * checks read the tools off the reply the way a person reads a model's, and the action's path runs end to end.
 */
import { ActionEngineServer } from '@memberjunction/actions';
import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import type { UserInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceGrantEntity, mjBizAppsCollaborationSpaceMemberEntity, mjBizAppsCollaborationSpaceNoteEntity } from '@mj-biz-apps/collaboration-entities';
import { mjBizAppsCollabExamplesExampleBoardEntity } from '@mj-biz-apps/collaboration-example-space-types-entities';
import { createSpaceConversation, executeSpaceChatTurn, postSpaceMessage, resolveSpaceAgentRetrieval, RUN_SPACE_DATA_ACTION_ID, RUN_SPACE_DATA_ACTION_NAME } from '@mj-biz-apps/collaboration-core-entities-server';
import { COLLABORATION_TEST_AGENT_ID, COLLABORATION_TEST_AGENT_NAME } from '../agents/test-agent.js';
import { CONVERSATION_DETAIL_ENTITY, SPACE_ENTITY, SPACE_GRANT_ENTITY, SPACE_MEMBER_ENTITY, SPACE_ROLE_TYPE_ENTITY, SPACE_TYPE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser } from '../wire.js';
import { cleanupConversation, cleanupSpace, cleanupStep, registerChecks } from './cleanup-helpers.js';
import { attachAgentToSpace, detachTestAgent } from './test-agent-attachment.js';

const DISCOVERY = 'C1000001-0000-4000-8000-000000000002';
const CHAPTER_12 = 'C1000001-0000-4000-8000-000000000016';
const COLLAB_SCHEMA = '__mj_BizAppsCollaboration';
const CHAPTER_12_STAFF = 'C1000001-0000-4000-8000-000000000019';
const CHAPTER_40_RECORD = 'F1000001-0000-4000-8000-000000000040';
const QUERIES = 'MJ: Queries';
const ACTIONS = 'MJ: Actions';
const AUDIT_LOGS = 'MJ: Audit Logs';
const SEARCH_SCOPE_ENTITIES = 'MJ: Search Scope Entities';
const SPACE_NOTES = 'MJ_BizApps_Collaboration: Space Notes';
const COLLABORATION_SCOPE_ID = '6E5187CF-7E5B-447F-893D-D291994083C0';

/** Posts a message as `user` and runs its turn, returning the turn's result and the reply's text. */
async function turnAs(ctx: IntegrationCheckContext, user: UserInfo, spaceId: string, conversationId: string, text: string) {
    const posted = await postSpaceMessage(ctx.Provider, user, { spaceId, conversationId, text });
    Assert(posted.ok === true && !!posted.detailId, `The message is posted: ${posted.ok ? '' : posted.message}`);
    if (!posted.ok) throw new Error(posted.message);
    const result = await executeSpaceChatTurn(ctx.Provider, user, { spaceId, conversationId, userMessageId: posted.detailId! });
    Assert(result.ok === true, `The turn runs: ${result.ok ? '' : result.message}`);
    if (!result.ok) throw new Error(result.message);
    const [reply] = await FindRows<{ Message: string }>(ctx, CONVERSATION_DETAIL_ENTITY, `ID = '${result.replyDetailIds[0]}'`, ['Message'], undefined, { BypassCache: true });
    return { result, reply: reply?.Message ?? '' };
}

/**
 * A Team-band action grant on the space, with no binding: the one kind of Team grant a type that seats participants may carry
 * before A17 (D34 refuses a query, view, dashboard or component there). Its target is the example's reminder action, granted
 * here without the type's binding, so it is an unbound action for the audience test.
 */
async function teamActionGrantOn(ctx: IntegrationCheckContext, spaceId: string, actionName: string): Promise<{ grantId: string; actionId: string }> {
    const [action] = await FindRows<{ ID: string }>(ctx, ACTIONS, `Name = '${actionName}'`, ['ID']);
    Assert(!!action, `The action ${actionName} exists`);
    const grant = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, ctx.User);
    grant.NewRecord();
    grant.Kind = 'Action';
    grant.TargetEntityID = ctx.Provider.EntityByName(ACTIONS)!.ID;
    grant.TargetRecordID = action.ID;
    grant.SpaceID = spaceId;
    grant.Band = 'Team';
    grant.IsDefault = false;
    grant.Mode = 'Extend';
    grant.Sequence = 5;
    Assert(await grant.Save(), `A Team action grant is saved on the space: ${grant.LatestResult?.CompleteMessage ?? ''}`);
    return { grantId: grant.ID, actionId: action.ID.toUpperCase() };
}

async function deleteGrant(ctx: IntegrationCheckContext, id: string | null): Promise<void> {
    if (!id) return;
    await cleanupStep(async () => {
        const grant = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceGrantEntity>(SPACE_GRANT_ENTITY, ctx.User);
        if (await grant.Load(id)) await grant.Delete();
    });
}

const checks: NamedCheck[] = [
    {
        Id: 'stage3.T1',
        Name: 'T1 — the grants for the chat\'s audience (§ 8.1): a leader\'s General turn holds no Team grant and no bound action (A16, row 15); national staff\'s Internal Only turn on the same space holds the space\'s unbound Team action',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const lena = await GetPersonaUser(ctx, 'lena');
            const nico = await GetPersonaUser(ctx, 'nico');
            let attachment: string | null = null;
            let grantId: string | null = null;
            const conversations: Array<{ id: string; chat: string }> = [];
            try {
                attachment = await attachAgentToSpace(ctx, COLLABORATION_TEST_AGENT_ID, CHAPTER_12);
                const general = await createSpaceConversation(ctx.Provider, nico, { SpaceID: CHAPTER_12, Name: `chapter-12-t1-general-${Date.now()}`, Kind: 'General' });
                Assert(general.ok === true && !!general.conversationId, `Nico starts a General conversation: ${general.ok ? '' : general.message}`);
                if (!general.ok) throw new Error(general.message);
                conversations.push({ id: general.conversationId!, chat: general.spaceChatId! });

                // First, the type's own grant: the reminder action bound to the chapter anchor, which an agent is not given before A16
                const asLena = await turnAs(ctx, lena, CHAPTER_12, general.conversationId!, `@${COLLABORATION_TEST_AGENT_NAME} what can you run here?`);
                const tools = asLena.result.ok ? asLena.result.tools : undefined;
                Assert(tools?.audience === 'Shared', `A General conversation seats everyone, so the audience is Shared (${tools?.audience})`);
                Assert(tools !== undefined && tools.actionIds.length === 0, `No action is given: the type's reminder grant binds ChapterID (${tools?.actionIds.join(',')})`);
                Assert(tools !== undefined && tools.dataGrantNames.length === 0, `No data to run (${tools?.dataGrantNames.join(',')})`);
                Assert(tools !== undefined && tools.withheld.some((line) => /binds ChapterID/.test(line) && /A16/.test(line)), `The bound action is withheld and says why: ${tools?.withheld.join(' | ')}`);
                Assert(/Tools: none/.test(asLena.reply) && /Data: none/.test(asLena.reply), `The agent was told of no tools and no data: ${asLena.reply.split('\n').slice(-3).join(' / ')}`);

                // Then a Team grant of the same action on the space itself, with no binding: the nearest level's grant for a target
                // replaces the type's (D30), so for Team it is an unbound action, and for a Shared audience it is simply not in force
                const teamGrant = await teamActionGrantOn(ctx, CHAPTER_12, 'Example: Chapter Renewal Reminder');
                grantId = teamGrant.grantId;
                const lenaAgain = await turnAs(ctx, lena, CHAPTER_12, general.conversationId!, `@${COLLABORATION_TEST_AGENT_NAME} and now?`);
                const toolsAgain = lenaAgain.result.ok ? lenaAgain.result.tools : undefined;
                Assert(toolsAgain !== undefined && toolsAgain.actionIds.length === 0 && toolsAgain.dataGrantNames.length === 0, `The space's Team grant is not in force for a Shared audience (${toolsAgain?.actionIds.join(',')})`);
                Assert(/Tools: none/.test(lenaAgain.reply), 'The agent was still told of no tools');

                const internal = await createSpaceConversation(ctx.Provider, nico, { SpaceID: CHAPTER_12, Name: `chapter-12-t1-internal-${Date.now()}`, Kind: 'Private' });
                Assert(internal.ok === true && !!internal.conversationId, `Nico starts an Internal Only conversation: ${internal.ok ? '' : internal.message}`);
                if (!internal.ok) throw new Error(internal.message);
                conversations.push({ id: internal.conversationId!, chat: internal.spaceChatId! });
                const asNico = await turnAs(ctx, nico, CHAPTER_12, internal.conversationId!, `@${COLLABORATION_TEST_AGENT_NAME} what can you run here?`);
                const staffTools = asNico.result.ok ? asNico.result.tools : undefined;
                Assert(staffTools?.audience === 'Team', 'An Internal Only conversation seats Team');
                Assert(staffTools !== undefined && staffTools.actionIds.map((id) => id.toUpperCase()).includes(teamGrant.actionId), `The space's unbound Team action grant is in force for Team (${staffTools?.actionIds.join(',')})`);
                Assert(staffTools !== undefined && staffTools.actionIds.length === 1, `One action: the space's grant replaced the type's bound one for this target (D30), and with no data to run Run space data is not given (${staffTools?.actionIds.join(',')})`);
                Assert(staffTools !== undefined && !staffTools.actionIds.map((id) => id.toUpperCase()).includes(RUN_SPACE_DATA_ACTION_ID), 'Run space data is not given when there is nothing to run');
                Assert(staffTools !== undefined && staffTools.withheld.length === 0, `Nothing is withheld once the unbound grant stands in for the bound one (${staffTools?.withheld.join(' | ')})`);
                Assert(new RegExp(`Tools: .*${teamGrant.actionId}`, 'i').test(asNico.reply), `The agent was told of the action: ${asNico.reply.split('\n').slice(-3).join(' / ')}`);
            } finally {
                for (const c of conversations) await cleanupConversation(ctx.Provider, ctx.User, c.id, c.chat);
                await deleteGrant(ctx, grantId);
                if (attachment) await detachTestAgent(ctx, attachment);
            }
        },
    },
    {
        Id: 'stage3.T2',
        Name: 'T2 — Run space data from a turn (§ 8.3, D29): national staff\'s agent runs the staff space\'s renewals query with the chapter bound on the server and the run logged under the agent run; a value for the bound name is refused; a name not granted is refused',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const nico = await GetPersonaUser(ctx, 'nico');
            let attachment: string | null = null;
            let conversation: { id: string; chat: string } | null = null;
            try {
                attachment = await attachAgentToSpace(ctx, COLLABORATION_TEST_AGENT_ID, CHAPTER_12_STAFF);
                const started = await createSpaceConversation(ctx.Provider, nico, { SpaceID: CHAPTER_12_STAFF, Name: `staff-t2-${Date.now()}`, Kind: 'Private' });
                Assert(started.ok === true && !!started.conversationId, `Nico starts an Internal Only conversation in the staff space: ${started.ok ? '' : started.message}`);
                if (!started.ok) throw new Error(started.message);
                conversation = { id: started.conversationId!, chat: started.spaceChatId! };

                const ran = await turnAs(ctx, nico, CHAPTER_12_STAFF, conversation.id, `@${COLLABORATION_TEST_AGENT_NAME} run "Renewals by month"`);
                const tools = ran.result.ok ? ran.result.tools : undefined;
                Assert(tools !== undefined && tools.dataGrantNames.includes('Renewals by month'), `The staff type's query grant is in force under its label (${tools?.dataGrantNames.join(',')})`);
                Assert(/Run space data: ok: Renewals by month: 2 rows/.test(ran.reply), `The action ran the query with the chapter bound: ${ran.reply.split('\n').pop()}`);
                const agentRunId = ran.result.ok ? ran.result.agentRunId : undefined;
                Assert(!!agentRunId, 'The turn has an agent run');
                const [grant] = await FindRows<{ ID: string }>(ctx, SPACE_GRANT_ENTITY, "Label = 'Renewals by month' AND Kind = 'Query'", ['ID']);
                const logs = await FindRows<{ Details: string }>(ctx, AUDIT_LOGS, `RecordID = '${grant.ID}'`, ['Details'], undefined, { BypassCache: true });
                const logged = logs.map((row) => { try { return JSON.parse(row.Details) as { agentRunId?: string | null }; } catch { return {}; } });
                Assert(logged.some((row) => (row.agentRunId ?? '').toLowerCase() === agentRunId!.toLowerCase()), `The run's log row names the agent run (A2): ${logged.slice(0, 2).map((r) => r.agentRunId).join(',')}`);

                const bound = await turnAs(ctx, nico, CHAPTER_12_STAFF, conversation.id, `@${COLLABORATION_TEST_AGENT_NAME} run "Renewals by month" with {"ChapterID":"${CHAPTER_40_RECORD}"}`);
                Assert(/Run space data: refused: .*ChapterID/.test(bound.reply) && /not its to set|bound by the grant/.test(bound.reply), `A value for the bound ChapterID is refused (row 16): ${bound.reply.split('\n').pop()}`);

                const stranger = await turnAs(ctx, nico, CHAPTER_12_STAFF, conversation.id, `@${COLLABORATION_TEST_AGENT_NAME} run "Collaboration Home Counts"`);
                Assert(/Run space data: refused: .*not granted in this conversation/.test(stranger.reply), `A name not granted is refused: ${stranger.reply.split('\n').pop()}`);
            } finally {
                if (conversation) await cleanupConversation(ctx.Provider, ctx.User, conversation.id, conversation.chat);
                if (attachment) await detachTestAgent(ctx, attachment);
            }
        },
    },
    {
        Id: 'stage3.T3',
        Name: 'T3 — a private note is not used (§ 10 row 20): the owner\'s private note on chapter 12 is not among what a leader\'s shared turn may quote, and notes are not in the agent\'s search scope',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const lena = await GetPersonaUser(ctx, 'lena');
            const nico = await GetPersonaUser(ctx, 'nico');
            const title = `Private memo T3 ${Date.now()}`;
            let noteId: string | null = null;
            let attachment: string | null = null;
            let conversation: { id: string; chat: string } | null = null;
            try {
                const note = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTES, nico);
                note.NewRecord();
                note.SpaceID = CHAPTER_12;
                note.Title = title;
                note.Body = 'Dues conversation with Kai: handle quietly.';
                note.Visibility = 'Private';
                Assert(await note.Save(), `Nico writes a private note: ${note.LatestResult?.CompleteMessage ?? ''}`);
                noteId = note.ID;
                Assert(note.Band === 'Team', 'A private note sits on the Team band');

                attachment = await attachAgentToSpace(ctx, COLLABORATION_TEST_AGENT_ID, CHAPTER_12);
                const started = await createSpaceConversation(ctx.Provider, nico, { SpaceID: CHAPTER_12, Name: `chapter-12-t3-${Date.now()}`, Kind: 'General' });
                Assert(started.ok === true && !!started.conversationId, `Nico starts a General conversation: ${started.ok ? '' : started.message}`);
                if (!started.ok) throw new Error(started.message);
                conversation = { id: started.conversationId!, chat: started.spaceChatId! };
                const asLena = await turnAs(ctx, lena, CHAPTER_12, conversation.id, `@${COLLABORATION_TEST_AGENT_NAME} what do we know about Kai's dues?`);
                const names = asLena.result.ok ? (asLena.result.allowedItemNames ?? []) : [];
                Assert(!names.includes(title), `The note is not among what the turn may quote (${names.join(',')})`);
                Assert(!asLena.reply.includes(title) && !asLena.reply.includes('handle quietly'), 'The reply never mentions the note');

                const notesEntityId = ctx.Provider.EntityByName(SPACE_NOTES)?.ID;
                Assert(!!notesEntityId, 'The notes entity exists');
                const inScope = await FindRows<{ ID: string }>(ctx, SEARCH_SCOPE_ENTITIES, `SearchScopeID = '${COLLABORATION_SCOPE_ID}' AND EntityID = '${notesEntityId}'`, ['ID']);
                Assert(inScope.length === 0, 'Space Notes are not an entity of the Collaboration search scope');
            } finally {
                if (conversation) await cleanupConversation(ctx.Provider, ctx.User, conversation.id, conversation.chat);
                if (attachment) await detachTestAgent(ctx, attachment);
                if (noteId) await cleanupStep(async () => {
                    const note = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceNoteEntity>(SPACE_NOTES, nico);
                    if (await note.Load(noteId!)) await note.Delete();
                });
            }
        },
    },
    {
        Id: 'stage3.T4',
        Name: 'T4 — Run space data outside a turn refuses: with no turn context it names what it needs, and with a context it refuses a name the turn did not grant',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const engine = ActionEngineServer.Instance;
            await engine.Config(false, ctx.User, ctx.Provider);
            const action = engine.Actions.find((a) => a.Name === RUN_SPACE_DATA_ACTION_NAME);
            Assert(!!action, 'The shipped action is registered as metadata');
            const bare = await engine.RunAction({ Action: action!, ContextUser: ctx.User, Params: [{ Name: 'Name', Type: 'Input', Value: 'Renewals by month' }], Filters: [], Provider: ctx.Provider, SkipActionLog: true });
            Assert(bare.Success === false && /inside a space conversation turn/.test(bare.Message ?? ''), `No turn context, no run: ${bare.Message ?? ''}`);
            const context = { spaceId: CHAPTER_12_STAFF, conversationId: 'none', audience: 'Team', spaceData: [{ GrantID: 'G', Kind: 'Query', Name: 'Renewals by month', Description: null, Parameters: [] }] };
            const stranger = await engine.RunAction({ Action: action!, ContextUser: ctx.User, Params: [{ Name: 'Name', Type: 'Input', Value: 'Collaboration Home Counts' }], Filters: [], Context: context, Provider: ctx.Provider, SkipActionLog: true });
            Assert(stranger.Success === false && /not granted in this conversation/.test(stranger.Message ?? ''), `A name outside the turn's list is refused: ${stranger.Message ?? ''}`);
        },
    },
    {
        Id: 'stage3.T5',
        Name: 'T5 — fnCollaborationCommonAccess (item 28): the spaces every listed user reaches, Team only when every one can; an empty, malformed or unknown list gives nothing (fail closed)',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const bea = await GetPersonaUser(ctx, 'bea');
            const pool = ctx.Pool;
            Assert(!!pool, 'The server harness has a SQL connection for the function');
            if (!pool) return;
            const common = async (list: string): Promise<Array<{ SpaceID: string; CanSeeTeam: boolean }>> =>
                (await pool.request().input('list', list).query(`SELECT SpaceID, CanSeeTeam FROM [${COLLAB_SCHEMA}].[fnCollaborationCommonAccess](@list)`)).recordset;
            const access = async (userId: string): Promise<Array<{ SpaceID: string; CanSeeTeam: boolean }>> =>
                (await pool.request().input('id', userId).query(`SELECT SpaceID, CanSeeTeam FROM [${COLLAB_SCHEMA}].[fnCollaborationAccess](TRY_CAST(@id AS UNIQUEIDENTIFIER))`)).recordset;
            Assert((await common('')).length === 0, 'An empty list reaches nothing');
            Assert((await common('not-a-uuid')).length === 0, 'A malformed token reaches nothing');
            Assert((await common(`${ada.ID},not-a-uuid`)).length === 0, 'One malformed token fails the whole list closed');
            Assert((await common('00000000-0000-4000-8000-000000000000')).length === 0, 'An unknown principal reaches nothing');
            const adaAlone = await common(ada.ID);
            const adaAccess = await access(ada.ID);
            const key = (rows: Array<{ SpaceID: string; CanSeeTeam: boolean }>) => rows.map((r) => `${r.SpaceID.toUpperCase()}:${r.CanSeeTeam ? 1 : 0}`).sort().join(',');
            Assert(adaAlone.length > 0 && key(adaAlone) === key(adaAccess), `One user alone gets exactly their own reach (${adaAlone.length} spaces)`);
            const both = await common(`${ada.ID}, ${bea.ID}`);
            const beaAccess = await access(bea.ID);
            const beaById = new Map(beaAccess.map((r) => [r.SpaceID.toUpperCase(), r.CanSeeTeam]));
            const expected = adaAccess.filter((r) => beaById.has(r.SpaceID.toUpperCase())).map((r) => ({ SpaceID: r.SpaceID, CanSeeTeam: r.CanSeeTeam && !!beaById.get(r.SpaceID.toUpperCase()) }));
            Assert(key(both) === key(expected), `Two users get the intersection, Team only where both see it (${both.length} spaces)`);
            const discovery = both.find((r) => r.SpaceID.toUpperCase() === DISCOVERY);
            Assert(!!discovery && discovery.CanSeeTeam === false, 'Discovery is common to Ada and Bea, and Bea\'s Shared seat keeps it Shared');
        },
    },
    {
        Id: 'stage3.T6',
        Name: 'T6 — the retrieval half of the Owner user\'s check (item 3): an Owner-type account with no seat retrieves nothing from a space, the way its post is refused',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const remy = await GetPersonaUser(ctx, 'remy');
            const origType = remy.Type;
            try {
                remy.Type = 'Owner';
                const result = await resolveSpaceAgentRetrieval(ctx.Provider, remy, DISCOVERY);
                Assert(result.quotedItems.length === 0, `Nothing is quoted for an Owner-type user with no seat (${result.quotedItems.length})`);
                Assert(result.searchedSpaceIds.length === 0, `No space is searched for them (${result.searchedSpaceIds.length})`);
                Assert(result.callerCanSeeTeam === false, 'The type of the account gives no Team sight');
            } finally {
                remy.Type = origType;
            }
        },
    },
    {
        Id: 'stage3.T7',
        Name: 'T7 — the type\'s word reaches the turn (the extension model\'s 83): the example board\'s driver adds its instructions to a turn in a board space, and a type with nothing to add adds nothing',
        RequiresMutation: true,
        Fn: async (ctx: IntegrationCheckContext) => {
            const ada = await GetPersonaUser(ctx, 'ada');
            const [board] = await FindRows<{ ID: string }>(ctx, SPACE_TYPE_ENTITY, "Code = 'example-board'", ['ID']);
            Assert(!!board, 'The example board type exists');
            const space = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
            space.NewRecord();
            space.Name = `COLLAB-CHECK T7-Board-${Date.now()}`;
            space.SpaceTypeID = board.ID;
            space.OwnerID = ada.ID;
            space.InheritsMembership = false;
            const leaf = await space.EnsureISAChild();
            if (leaf instanceof mjBizAppsCollabExamplesExampleBoardEntity) leaf.TermName = '2026 to 2027';
            Assert(await space.Save(), `Ada creates an example board: ${space.LatestResult?.CompleteMessage ?? ''}`);
            let attachment: string | null = null;
            let conversation: { id: string; chat: string } | null = null;
            try {
                const [ownerRole] = await FindRows<{ ID: string }>(ctx, SPACE_ROLE_TYPE_ENTITY, "Code = 'owner'", ['ID']);
                const seat = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceMemberEntity>(SPACE_MEMBER_ENTITY, ada);
                seat.NewRecord();
                seat.SpaceID = space.ID;
                seat.UserID = ada.ID;
                seat.SpaceRoleTypeID = ownerRole.ID;
                seat.Band = 'Team';
                seat.Status = 'Active';
                Assert(await seat.Save(), `Ada seats herself as owner: ${seat.LatestResult?.CompleteMessage ?? ''}`);
                attachment = await attachAgentToSpace(ctx, COLLABORATION_TEST_AGENT_ID, space.ID);
                const started = await createSpaceConversation(ctx.Provider, ada, { SpaceID: space.ID, Name: `board-t7-${Date.now()}`, Kind: 'General' });
                Assert(started.ok === true && !!started.conversationId, `Ada starts a conversation in the board: ${started.ok ? '' : started.message}`);
                if (!started.ok) throw new Error(started.message);
                conversation = { id: started.conversationId!, chat: started.spaceChatId! };
                const turn = await turnAs(ctx, ada, space.ID, conversation.id, `@${COLLABORATION_TEST_AGENT_NAME} what are the rules here?`);
                Assert(/Type: .*rules of order/.test(turn.reply), `The board driver's instructions reached the turn: ${turn.reply.split('\n').find((l) => l.startsWith('Type:')) ?? '(no Type line)'}`);
                Assert(/Quorum requirement: 50%/.test(turn.reply), 'All of the driver\'s instructions are there');
            } finally {
                if (conversation) await cleanupConversation(ctx.Provider, ctx.User, conversation.id, conversation.chat);
                if (attachment) await detachTestAgent(ctx, attachment);
                await cleanupStep(async () => {
                    const closing = await ctx.Provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACE_ENTITY, ada);
                    Assert(await closing.Load(space.ID), 'The board loads to close');
                    closing.ClosedAt = new Date(Date.now() - 60_000);
                    Assert(await closing.Save(), `The board closes before it is removed: ${closing.LatestResult?.CompleteMessage ?? ''}`);
                });
                await cleanupSpace(ctx.Provider, ctx.User, space.ID);
            }
            // The chapter type has no driver of its own: the default one adds nothing
            let chapterAttachment: string | null = null;
            let chapterConversation: { id: string; chat: string } | null = null;
            const nico = await GetPersonaUser(ctx, 'nico');
            try {
                chapterAttachment = await attachAgentToSpace(ctx, COLLABORATION_TEST_AGENT_ID, CHAPTER_12);
                const started = await createSpaceConversation(ctx.Provider, nico, { SpaceID: CHAPTER_12, Name: `chapter-t7-${Date.now()}`, Kind: 'General' });
                if (!started.ok) throw new Error(started.message);
                chapterConversation = { id: started.conversationId!, chat: started.spaceChatId! };
                const turn = await turnAs(ctx, nico, CHAPTER_12, chapterConversation.id, `@${COLLABORATION_TEST_AGENT_NAME} anything to add?`);
                Assert(/Type: none/.test(turn.reply), 'A type with no driver adds nothing');
            } finally {
                if (chapterConversation) await cleanupConversation(ctx.Provider, ctx.User, chapterConversation.id, chapterConversation.chat);
                if (chapterAttachment) await detachTestAgent(ctx, chapterAttachment);
            }
        },
    },
];

registerChecks(checks);
IntegrationCheckRegistry.Instance.RegisterLifecycle('stage3', {
    Setup: async () => {},
    Teardown: async () => {},
});
