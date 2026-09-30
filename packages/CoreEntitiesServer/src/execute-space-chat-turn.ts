import {
    BaseEntity,
    LogError,
    RunView,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import {
    ConversationEngine,
    MJConversationDetailEntity,
    MJAIAgentRunEntity,
} from '@memberjunction/core-entities';
import { AgentRunner } from '@memberjunction/ai-agents';
import type { AgentExecutionProgressCallback, AgentExecutionStreamingCallback, ExecuteAgentParams, ExecuteAgentResult, MJAIAgentEntityExtended } from '@memberjunction/ai-core-plus';
import { MentionParser } from '@memberjunction/conversations-runtime';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { resolveAllowedAgents, COLLABORATION_DEFAULT_AGENT_ID } from './resolve-allowed-agents.js';
import { resolveSpaceAgentRetrieval } from './space-agent-retrieval.js';
import { resolveSpaceChatSettings } from './resolve-space-chat-settings.js';
import { filterRoomReplyItems } from './post-space-message.js';
import { resolveSpaceDriver } from './space-driver-call.js';
import { parseUuid } from './uuid.js';

const DETAILS = 'MJ: Conversation Details';
const SPACE_CHATS = 'MJ_BizApps_Collaboration: Space Chats';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';

/** How a turn ended, told to whoever is watching it once its reply row is final. */
export interface TurnOutcome {
    /** The reply row: In-Progress while the agent worked, Complete or Error now. */
    replyDetailId: string;
    success: boolean;
    /** The agent's run, when it got as far as making one. */
    agentRun: MJAIAgentRunEntity | null;
    /** What the agent's run returned, when it returned: the partial result and the completion are published from it. */
    result?: ExecuteAgentResult;
    /** The reason, when it failed. It is for the log and for whoever watches: the conversation itself says only that the assistant could not answer. */
    errorMessage?: string;
}

/**
 * Who is watching a turn, when it doesn't end before the call returns (`background`): the run's progress and streamed text as they
 * happen, and its end. The caller hands them on to the browser that asked (MemberJunction's chat area follows the reply row from them).
 */
export interface TurnObserver {
    OnProgress?: AgentExecutionProgressCallback;
    OnStreaming?: AgentExecutionStreamingCallback;
    OnFinished?: (outcome: TurnOutcome) => void;
}

export interface ExecuteSpaceChatTurnInput {
    spaceId: string;
    conversationId: string;
    userMessageId: string;
    agentId?: string;
    /**
     * Return as soon as the reply row is written In-Progress, and run the agent after that: the caller shows the row, and the
     * observer's callbacks carry the run's progress to it. Without it the call returns when the reply is final.
     */
    background?: boolean;
    observer?: TurnObserver;
}

export type ExecuteSpaceChatTurnResult =
    | { ok: true; replyDetailIds: string[]; agentRunId?: string; quotedCount?: number; allowedItemNames?: string[] }
    | { ok: false; message: string };

/** What everyone in the space reads when a turn fails; the cause goes to the log, not to the conversation. */
const ASSISTANT_FAILED_MESSAGE = 'The assistant could not answer that. Please try again.';

/**
 * Executes a server turn for an agent in a space's chat.
 *
 * Verifies all security and context boundaries against the persisted user message:
 * 1. Caller reaches the space and can contribute (closed spaces refuse).
 * 2. conversationId belongs to this space.
 * 3. userMessageId exists, matches the conversation, and was authored by the caller.
 * 4. Checks that the user message does not already have an agent run (refuses if read fails).
 * 5. Mention rule: decide from saved message alone via MentionParser. Under Always without tag,
 *    runs space default agent. Under MentionOnly without tag, refuses.
 * 6. Client's agentId is treated only as a consistency check.
 * 7. Runs agent with ConversationHistoryFrom set to room's history floor and audience bounded.
 * 8. Writes reply as system user and returns real AgentRunId.
 */
export async function executeSpaceChatTurn(
    provider: IMetadataProvider,
    user: UserInfo,
    input: ExecuteSpaceChatTurnInput
): Promise<ExecuteSpaceChatTurnResult> {
    // Two calls for one message can both pass the "already replied" reads before either writes its reply, so a message is
    // claimed here for the length of its turn. This holds within one server; a second server would need a database constraint.
    const claim = parseUuid(input.userMessageId);
    if (claim) {
        if (turnsInFlight.has(claim)) {
            return { ok: false, message: 'This message has already been processed by an agent turn.' };
        }
        turnsInFlight.add(claim);
    }
    // A turn that runs on after the call returns keeps its claim until it ends
    const handoff = { released: false, release: () => { if (claim) turnsInFlight.delete(claim); }, runsOn: false };
    try {
        return await runClaimedTurn(provider, user, input, handoff);
    } finally {
        if (!handoff.runsOn) handoff.release();
    }
}

/** Messages whose turn is running now. */
const turnsInFlight = new Set<string>();

async function runClaimedTurn(
    provider: IMetadataProvider,
    user: UserInfo,
    input: ExecuteSpaceChatTurnInput,
    handoff: { release: () => void; runsOn: boolean },
): Promise<ExecuteSpaceChatTurnResult> {
    const spaceId = parseUuid(input.spaceId);
    const conversationId = parseUuid(input.conversationId);
    const userMessageId = parseUuid(input.userMessageId);
    const callerId = parseUuid(user?.ID);

    if (!spaceId || !conversationId || !userMessageId || !callerId) {
        return { ok: false, message: 'Invalid turn parameters: space, conversation, message, and caller IDs are required.' };
    }

    const probe = await provider.GetEntityObject<BaseEntity>(SPACES, user);
    let context;
    try {
        context = await loadWriteContext(probe, user, spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'The space could not be read.' };
    }

    const targetNode = context.spaces.find((s) => s.id.toLowerCase() === spaceId.toLowerCase());
    if (targetNode?.closedAt) {
        return { ok: false, message: 'A closed space does not take a new turn.' };
    }

    const reach = membershipReaches(context.spaces, context.memberships, callerId, spaceId);
    if (!reach?.role.canContribute) {
        return { ok: false, message: 'Your role on this space cannot run an agent turn.' };
    }

    const system = await requireSystemUser(probe);
    const view = RunView.FromMetadataProvider(provider);

    // A type whose driver is missing refuses the turn (fail closed)
    const driver = await resolveSpaceDriver(probe, provider, user, spaceId);
    if (!driver.ok) return { ok: false, message: driver.message };

    // 1. Verify space is open
    const spaceRes = await view.RunView<{ ClosedAt: string | null; SpaceTypeID: string | null; Configuration: string | null }>({
        EntityName: SPACES,
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ClosedAt', 'SpaceTypeID', 'Configuration'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (!spaceRes.Success || !spaceRes.Results?.[0]) {
        return { ok: false, message: spaceRes.ErrorMessage || 'The space could not be read.' };
    }

    const targetSpace = spaceRes.Results[0];
    if (targetSpace.ClosedAt) {
        return { ok: false, message: 'A closed space does not take a new turn.' };
    }

    // 2. Verify conversation belongs to this space and is active
    const chatCheck = await view.RunView<{ ID: string; ConversationID: string; Kind: string; Status: string }>({
        EntityName: SPACE_CHATS,
        ExtraFilter: `SpaceID = '${spaceId}' AND ConversationID = '${conversationId}' AND Status = 'Active'`,
        Fields: ['ID', 'ConversationID', 'Kind', 'Status'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (!chatCheck.Success || !chatCheck.Results?.[0]) {
        return { ok: false, message: 'Only active conversations in this space accept agent turns.' };
    }

    const foundChat = chatCheck.Results[0];
    if (foundChat.Kind === 'Private' && !reach.role.canSeeTeamBand) {
        return { ok: false, message: 'Caller cannot initiate an agent turn in an internal conversation without Team visibility.' };
    }

    // 3. Load persisted user message
    const userDetail = await provider.GetEntityObject<MJConversationDetailEntity>(DETAILS, system);
    if (!(await userDetail.Load(userMessageId))) {
        return { ok: false, message: 'The specified message could not be loaded.' };
    }

    if (parseUuid(userDetail.ConversationID) !== conversationId) {
        return { ok: false, message: 'The message does not belong to this conversation.' };
    }

    if (parseUuid(userDetail.UserID) !== callerId || userDetail.Role !== 'User') {
        return { ok: false, message: 'Only messages authored by the caller can initiate an agent turn.' };
    }

    // 4. Refuse a second turn on a message that already has an agent run or reply detail; refuse when read fails (Items 5 & 22)
    const detailCheck = await view.RunView<{ ID: string }>({
        EntityName: DETAILS,
        ExtraFilter: `ParentID = '${userMessageId}' AND Role = 'AI'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (!detailCheck.Success) {
        return { ok: false, message: detailCheck.ErrorMessage || 'Could not verify reply status for this message.' };
    }

    if ((detailCheck.Results?.length ?? 0) > 0) {
        return { ok: false, message: 'This message has already been processed by an agent turn.' };
    }

    const runCheck = await view.RunView<{ ID: string }>({
        EntityName: 'MJ: AI Agent Runs',
        ExtraFilter: `ExternalReferenceID = '${userMessageId}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (!runCheck.Success) {
        return { ok: false, message: runCheck.ErrorMessage || 'Could not verify agent run status for this message.' };
    }

    if ((runCheck.Results?.length ?? 0) > 0) {
        return { ok: false, message: 'This message has already been processed by an agent turn.' };
    }

    // 5. Unified settings resolution (Item 16)
    let chatSettings: Awaited<ReturnType<typeof resolveSpaceChatSettings>>;
    try {
        chatSettings = await resolveSpaceChatSettings(provider, spaceId, system);
    } catch (settingsError) {
        return { ok: false, message: settingsError instanceof Error ? settingsError.message : 'Space settings refused.' };
    }
    const agentReplyMode = chatSettings.agentReplyMode;
    const historyOnAdd = chatSettings.historyOnAdd;

    // 6. Resolve allowed agents
    let allowed: Awaited<ReturnType<typeof resolveAllowedAgents>>;
    try {
        allowed = await resolveAllowedAgents(provider, spaceId, system);
    } catch (agentsError) {
        return { ok: false, message: agentsError instanceof Error ? agentsError.message : 'Allowed agents refused.' };
    }
    const resolvedDefault = parseUuid(allowed.defaultAgentId);

    // Load agent entities for allowed agents to supply MentionParser
    let availableAgents: MJAIAgentEntityExtended[] = [];
    if (allowed.allowedAgentIds.length > 0) {
        const agentFilter = allowed.allowedAgentIds.map((id) => `'${id}'`).join(', ');
        const agentsRes = await view.RunView<MJAIAgentEntityExtended>({
            EntityName: 'MJ: AI Agents',
            ExtraFilter: `ID IN (${agentFilter})`,
            Fields: ['ID', 'Name'],
            ResultType: 'entity_object',
        }, system);
        if (agentsRes.Success && agentsRes.Results) {
            availableAgents = agentsRes.Results;
        }
    }

    const messageText = userDetail.Message ?? '';

    // 7. Mention rule: decide from saved message alone using MentionParser (Item 6)
    const parser = new MentionParser();
    const parseResult = parser.parseMentions(messageText, availableAgents);
    const taggedAgentId = parseResult.agentMention?.id
        ? parseUuid(parseResult.agentMention.id)
        : null;

    let targetAgentId: string;
    if (taggedAgentId) {
        targetAgentId = taggedAgentId;
    } else if (agentReplyMode === 'Always') {
        if (!resolvedDefault) {
            return { ok: false, message: 'No assistant is available in this space right now.' };
        }
        targetAgentId = resolvedDefault;
    } else {
        // Under MentionOnly without a tagged agent: refuse!
        return { ok: false, message: 'The message does not mention an agent.' };
    }

    // Treat client's agentId strictly as a check (Item 6)
    if (input.agentId) {
        const clientAgentId = parseUuid(input.agentId);
        if (clientAgentId && clientAgentId.toLowerCase() !== targetAgentId.toLowerCase()) {
            return { ok: false, message: 'The requested agent does not match the resolved agent for this message.' };
        }
    }

    const isAgentAllowed = allowed.allowedAgentIds.some(
        (id) => (parseUuid(id) ?? '').toLowerCase() === targetAgentId.toLowerCase()
    );
    if (!isAgentAllowed) {
        return { ok: false, message: `The agent ${targetAgentId} is not allowed in this space.` };
    }

    // 8. History floor from Chats.HistoryOnAdd (Item 16)
    let conversationHistoryFrom: Date | undefined;
    if (historyOnAdd !== 'All' && reach) {
        const memberRowRes = await view.RunView<{ __mj_CreatedAt: string | Date | null }>({
            EntityName: 'MJ_BizApps_Collaboration: Space Members',
            ExtraFilter: `SpaceID = '${reach.spaceId}' AND UserID = '${callerId}' AND Status = 'Active'`,
            Fields: ['__mj_CreatedAt'],
            MaxRows: 1,
            ResultType: 'simple',
        }, system);
        if (memberRowRes.Success && memberRowRes.Results?.[0]?.__mj_CreatedAt) {
            conversationHistoryFrom = new Date(memberRowRes.Results[0].__mj_CreatedAt);
        }
    }

    // 9. Bound agent to conversation audience (Item 23)
    const retrieval = await resolveSpaceAgentRetrieval(provider, user, spaceId);
    const normSpaceId = spaceId.trim().toUpperCase();
    const audienceQuoted = foundChat.Kind === 'Private'
        ? retrieval.quotedItems.filter((item) => (item.Band === 'Shared' || item.Band === 'Team') && item.SpaceID.trim().toUpperCase() === normSpaceId)
        : filterRoomReplyItems(retrieval.quotedItems, spaceId);

    // 10. Write reply as system user (Item 5)
    const assistantDetail = await provider.GetEntityObject<MJConversationDetailEntity>(DETAILS, system);
    assistantDetail.NewRecord();
    assistantDetail.ConversationID = conversationId;
    assistantDetail.UserID = system.ID;
    assistantDetail.AgentID = targetAgentId;
    assistantDetail.Role = 'AI';
    assistantDetail.Status = 'In-Progress';
    assistantDetail.ParentID = userMessageId;
    assistantDetail.HiddenToUser = false;
    assistantDetail.IsPinned = false;
    assistantDetail.OriginalMessageChanged = false;
    assistantDetail.Message = '⏳ Starting...';
    if (!(await assistantDetail.Save()) || !assistantDetail.ID) {
        const errMsg = assistantDetail.LatestResult?.CompleteMessage ?? 'Failed to initialize assistant detail record.';
        LogError(`executeSpaceChatTurn: ${errMsg}`);
        return { ok: false, message: ASSISTANT_FAILED_MESSAGE };
    }

    /** The observer hears how the turn ended, once; a fault in it never becomes the turn's own. */
    let finishedTold = false;
    /** The run and its result once the agent has answered, kept outside the turn so a throw after the run still reports them. */
    let finishedRun: MJAIAgentRunEntity | null = null;
    let finishedResult: ExecuteAgentResult | undefined;
    const tellFinished = (outcome: TurnOutcome): void => {
        finishedTold = true;
        try {
            input.observer?.OnFinished?.(outcome);
        } catch (observerError) {
            LogError(`executeSpaceChatTurn: the turn's observer failed: ${observerError instanceof Error ? observerError.message : String(observerError)}`);
        }
    };

    const finishTurn = async (): Promise<ExecuteSpaceChatTurnResult> => {
        let agentSuccess = false;
        let agentErrorMessage: string | null = null;
        let agentRunId: string | undefined;
        let agentReplyText: string | null = null;

        try {
            // Load fresh window rows through ConversationEngine inside try so failures mark row Error (Item 5)
            const windowRows = await ConversationEngine.LoadWindowRowsFresh(
                conversationId,
                user,
                provider,
                conversationHistoryFrom
            );
            const assembledWindow = ConversationEngine.AssembleContextWindow(windowRows, {
                excludeDetailIds: [assistantDetail.ID],
                historyFrom: conversationHistoryFrom ?? null,
                maxTailMessages: 20,
            });
            const assembledMessages: ExecuteAgentParams['conversationMessages'] = assembledWindow.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            const agentEntity = await provider.GetEntityObject<MJAIAgentEntityExtended>('MJ: AI Agents', system);
            if (agentEntity && (await agentEntity.Load(targetAgentId))) {
                const runner = new AgentRunner(provider);
                const runnerParams: ExecuteAgentParams = {
                    agent: agentEntity,
                    contextUser: user,
                    userId: user.ID,
                    conversationId,
                    conversationDetailId: assistantDetail.ID,
                    ConversationHistoryFrom: conversationHistoryFrom,
                    PrimaryScopeEntityName: 'MJ_BizApps_Collaboration: Space Chats',
                    PrimaryScopeRecordID: foundChat.ID,
                    data: {
                        spaceId,
                        conversationId,
                        audience: foundChat.Kind === 'Private' ? 'Team' : 'Shared',
                        allowedItems: audienceQuoted,
                    },
                    conversationMessages: assembledMessages,
                    onProgress: input.observer?.OnProgress,
                    onStreaming: input.observer?.OnStreaming,
                    onAgentRunCreated: async (createdRunId: string) => {
                        agentRunId = createdRunId;
                        try {
                            const runObj = await provider.GetEntityObject<MJAIAgentRunEntity>('MJ: AI Agent Runs', system);
                            if (runObj && (await runObj.Load(createdRunId))) {
                                runObj.ExternalReferenceID = userMessageId;
                                const stampSaved = await runObj.Save();
                                if (!stampSaved) {
                                    LogError(`executeSpaceChatTurn: failed to stamp ExternalReferenceID: ${runObj.LatestResult?.CompleteMessage ?? ''}`);
                                }
                            }
                        } catch (stampErr) {
                            LogError(`executeSpaceChatTurn: failed to stamp ExternalReferenceID: ${stampErr}`);
                        }
                    },
                };

                const runResult = await runner.RunAgent(runnerParams);
                finishedResult = runResult ?? undefined;
                if (runResult?.agentRun?.ID) {
                    agentRunId = runResult.agentRun.ID;
                    finishedRun = runResult.agentRun;
                }

                if (runResult?.success) {
                    agentSuccess = true;
                    agentReplyText =
                        runResult.agentRun?.Message ||
                        (typeof runResult.payload === 'string' ? runResult.payload : null) ||
                        'Completed successfully.';
                } else {
                    agentErrorMessage =
                        runResult?.agentRun?.ErrorMessage ||
                        runResult?.errorMessage ||
                        'Agent execution did not produce a result.';
                    LogError(`executeSpaceChatTurn: the agent run failed: ${agentErrorMessage}`);
                }
            } else {
                agentErrorMessage = `Failed to load agent ${targetAgentId}.`;
                LogError(`executeSpaceChatTurn: ${agentErrorMessage}`);
            }
        } catch (agentErr) {
            agentErrorMessage = agentErr instanceof Error ? agentErr.message : String(agentErr);
            LogError(`executeSpaceChatTurn: AgentRunner execution error: ${agentErrorMessage}`);
        }

        if (!agentSuccess || !agentReplyText) {
            assistantDetail.Status = 'Error';
            assistantDetail.Message = ASSISTANT_FAILED_MESSAGE;
            const errorSaved = await assistantDetail.Save();
            if (!errorSaved) {
                LogError(`executeSpaceChatTurn: failed to save assistant error status: ${assistantDetail.LatestResult?.CompleteMessage ?? ''}`);
            }
            tellFinished({ replyDetailId: assistantDetail.ID, success: false, agentRun: finishedRun, result: finishedResult, errorMessage: agentErrorMessage ?? ASSISTANT_FAILED_MESSAGE });
            return { ok: false, message: ASSISTANT_FAILED_MESSAGE };
        }

        // Save final assistant reply as system user
        assistantDetail.Status = 'Complete';
        assistantDetail.Message = agentReplyText;
        if (!(await assistantDetail.Save()) || !assistantDetail.ID) {
            const errMsg = assistantDetail.LatestResult?.CompleteMessage ?? 'Failed to save assistant reply';
            LogError(`executeSpaceChatTurn: failed to save assistant reply: ${errMsg}`);
            // Don't leave the reply at In-Progress: mark it Error, so the conversation shows the turn failed
            assistantDetail.Status = 'Error';
            assistantDetail.Message = ASSISTANT_FAILED_MESSAGE;
            if (!(await assistantDetail.Save())) {
                LogError(`executeSpaceChatTurn: failed to mark the reply Error after its save failed: ${assistantDetail.LatestResult?.CompleteMessage ?? ''}`);
            }
            tellFinished({ replyDetailId: assistantDetail.ID, success: false, agentRun: finishedRun, result: finishedResult, errorMessage: errMsg });
            return { ok: false, message: errMsg };
        }

        tellFinished({ replyDetailId: assistantDetail.ID, success: true, agentRun: finishedRun, result: finishedResult });
        return {
            ok: true,
            replyDetailIds: [assistantDetail.ID],
            agentRunId,
            quotedCount: audienceQuoted.length,
            allowedItemNames: audienceQuoted.map((item) => item.Name),
        };
    };

    /**
     * The turn, held to its promise even when something throws after the reply row was written (a `Save()` throws when the database
     * can't be reached): the row is marked Error, once, and the observer is told the turn failed, with the row's id and the run when
     * there is one, since the chat reads a completion's run. Without that a reply would stay In-Progress in the conversation and on
     * screen, since the chat follows it only through the published completion.
     */
    const settleTurn = async (): Promise<ExecuteSpaceChatTurnResult> => {
        try {
            return await finishTurn();
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            LogError(`executeSpaceChatTurn: the turn threw after its reply row was written: ${reason}`);
            try {
                assistantDetail.Status = 'Error';
                assistantDetail.Message = ASSISTANT_FAILED_MESSAGE;
                if (!(await assistantDetail.Save())) {
                    LogError(`executeSpaceChatTurn: failed to mark the reply Error after the turn threw: ${assistantDetail.LatestResult?.CompleteMessage ?? ''}`);
                }
            } catch (markError) {
                LogError(`executeSpaceChatTurn: failed to mark the reply Error after the turn threw: ${markError instanceof Error ? markError.message : String(markError)}`);
            }
            if (!finishedTold) tellFinished({ replyDetailId: assistantDetail.ID, success: false, agentRun: finishedRun, result: finishedResult, errorMessage: reason });
            return { ok: false, message: ASSISTANT_FAILED_MESSAGE };
        }
    };

    if (input.background) {
        // The reply row is written and the call returns; the agent runs on, and its end is told to the observer
        handoff.runsOn = true;
        void settleTurn().finally(handoff.release);
        return { ok: true, replyDetailIds: [assistantDetail.ID], quotedCount: audienceQuoted.length, allowedItemNames: audienceQuoted.map((item) => item.Name) };
    }
    return settleTurn();
}
