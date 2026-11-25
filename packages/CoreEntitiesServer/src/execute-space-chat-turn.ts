import {
    BaseEntity,
    LogError,
    RunView,
    UserInfo,
    UserRoleInfo,
    type IMetadataProvider,
} from '@memberjunction/core';
import { UserCache } from '@memberjunction/generic-database-provider';
import {
    ConversationEngine,
    MJConversationDetailEntity,
    MJAIAgentRunEntity,
} from '@memberjunction/core-entities';
import { AgentRunner } from '@memberjunction/ai-agents';
import type { AgentExecutionProgressCallback, AgentExecutionStreamingCallback, ExecuteAgentParams, ExecuteAgentResult, MJAIAgentEntityExtended } from '@memberjunction/ai-core-plus';
import { MentionParser } from '@memberjunction/conversations-runtime';
import {
    audienceOfConversationKind,
    extractAndValidateSourceReceipts,
    membershipReaches,
    normalizeReceiptUuid,
    type SpaceAgentSourceReceiptEntry,
    type ValidatedSuppliedSourceCandidate,
    spaceIsReadOnly,
} from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { loadSpaceConfiguration } from './space-configuration.js';
import { COLLABORATION_SPACE_SCOPE_ID, resolveTurnTools, type SpaceTurnContext, type TurnToolSourceHit } from './turn-tools.js';
import type { AgentContextResult } from './base-space-type-server-driver.js';
import { resolveAllowedAgents } from './resolve-allowed-agents.js';
import { readEveryRow } from './read-every-row.js';
import {
    resolveSpaceAgentRetrieval,
    stripMentionMarkup,
    type SpaceAgentRetrievalStats,
    type SpaceAgentSuppliedSource,
    type SpaceAgentVectorSearchAdapter,
} from './space-agent-retrieval.js';
import { resolveSpaceChatSettings } from './resolve-space-chat-settings.js';
import { resolveSpaceDriver } from './space-driver-call.js';
import { buildSpaceMeetingsAgentContext } from './space-meetings.js';
import { resolveTurnAgentViaDecision, type ResolveTurnAgentViaDecisionParams, type SpaceChatDecisionRunner } from './space-chat-decision-routing.js';
import { parseUuid } from './uuid.js';
import { spaceWriteRefusal, spaceWriteRefusalMessage } from './space-status-gate.js';
import { runWithCollaborationAgentTurnAuthority } from './ai-run-lockdown.js';
import {
    buildSourceReceiptReachContext,
    ensurePostgresReceiptContextHook,
    persistSpaceAgentSourceReceipts,
    type ResolveSuppliedKnowledgeScopeMeta,
    resolveSuppliedKnowledgeSources,
    resolveToolSuppliedSourceCandidates,
} from './space-agent-source-receipts.js';
import {
    dispatchMultiScopeTurnSearch,
    type MultiScopeTurnSearchDispatcher,
    resolveTurnKnowledgeScopes,
} from './turn-knowledge-scopes.js';
import { resolveSpaceScopedPromptParts } from './scoped-prompt-parts.js';
import {
    buildSpaceAgentContextSystemMessage,
    isShippedCollaborationSpaceAgent,
} from './space-agent-artifact-content.js';
import type { BoundActionParamsMap } from './bound-agent-action-grants.js';

const DETAILS = 'MJ: Conversation Details';
const SPACE_CHATS = 'MJ_BizApps_Collaboration: Space Chats';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const AI_MODELS = 'MJ: AI Models';

/** Named effort level presets mapped onto MJ's 1-100 `ExecuteAgentParams.effortLevel` numeric scale. */
const NAMED_EFFORT_LEVELS: Readonly<Record<string, number>> = {
    minimal: 5,
    min: 5,
    low: 15,
    medium: 50,
    med: 50,
    high: 85,
    max: 100,
    maximum: 100,
};

/** In-memory cache of resolved active `MJ: AI Models` IDs keyed by trimmed lowercase model name. */
const spaceChatModelOverrideCache = new Map<string, string>();

/** Clears the cached `COLLABORATION_SPACE_CHAT_MODEL` name-to-ID lookup (intended for tests and runtime refreshes). */
export function clearSpaceChatModelOverrideCache(): void {
    spaceChatModelOverrideCache.clear();
}

/**
 * Parses `COLLABORATION_SPACE_CHAT_EFFORT_LEVEL` (either a named preset like `"Low"`, `"Medium"`, `"High"`,
 * or a numeric string in `[1, 100]` such as `"15"`) into the numeric `ExecuteAgentParams.effortLevel`.
 * Returns `undefined` when unset or invalid so standard agent/system effort selection stays intact.
 */
export function parseSpaceChatEffortLevel(raw: string | undefined): number | undefined {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return undefined;
    const named = NAMED_EFFORT_LEVELS[trimmed.toLowerCase()];
    if (named !== undefined) return named;
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
        const parsed = Math.round(Number(trimmed));
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) {
            return parsed;
        }
    }
    LogError(`executeSpaceChatTurn: ignoring invalid COLLABORATION_SPACE_CHAT_EFFORT_LEVEL value "${trimmed}" (expected Low/Medium/High or integer 1-100).`);
    return undefined;
}

/**
 * Resolves the active `MJ: AI Models` row matching `modelName` (case-insensitive cache per model name).
 * Returns `null` when not found or when the lookup fails so standard agent model selection remains intact.
 */
async function resolveSpaceChatModelOverrideId(
    view: RunView,
    system: UserInfo,
    modelName: string,
): Promise<string | null> {
    const trimmed = modelName.trim();
    if (!trimmed) return null;
    const cacheKey = trimmed.toLowerCase();
    const cached = spaceChatModelOverrideCache.get(cacheKey);
    if (cached) return cached;

    const escaped = trimmed.replace(/'/g, "''");
    try {
        const res = await view.RunView<{ ID: string; Name: string }>({
            EntityName: AI_MODELS,
            ExtraFilter: `Name = '${escaped}' AND IsActive = 1`,
            Fields: ['ID', 'Name'],
            MaxRows: 1,
            ResultType: 'simple',
        }, system);
        const foundId = res?.Success ? parseUuid(res.Results?.[0]?.ID) : null;
        if (!foundId) {
            LogError(`executeSpaceChatTurn: COLLABORATION_SPACE_CHAT_MODEL "${trimmed}" did not match an active MJ: AI Models row; falling back to default model selection.`);
            return null;
        }
        spaceChatModelOverrideCache.set(cacheKey, foundId);
        return foundId;
    } catch (err) {
        LogError(`executeSpaceChatTurn: failed resolving COLLABORATION_SPACE_CHAT_MODEL "${trimmed}": ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}

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
    /** The MJ AgentTurnRoute the client resolved; 'Redirect' marks the author's explicit "Ask <Agent>" on a no-agent message. */
    route?: string;
    retrievalScope?: 'ThisSpace' | 'Subtree' | 'Everything';
    /**
     * Return as soon as the reply row is written In-Progress, and run the agent after that: the caller shows the row, and the
     * observer's callbacks carry the run's progress to it. Without it the call returns when the reply is final.
     */
    background?: boolean;
    observer?: TurnObserver;
    /** Optional unit-test seam for server-side decision routing; production uses AgentDecisionService (Default Decision). */
    decisionRunner?: SpaceChatDecisionRunner;
    /** Optional Platt calibration override for unit tests using `decisionRunner` without a loaded `AIEngineBase` cache. */
    decisionCalibration?: ResolveTurnAgentViaDecisionParams['decisionCalibration'];
    /** Optional unit-test seam: the seats asked for per round trip. The seats are read to their end at any size. */
    rosterPageSize?: number;
    /** Optional top-k retrieval cap (clamped to server bounds `[1, MAX_RETRIEVAL_TOP_K]`). */
    topK?: number;
    /** Optional per-source prompt token limit (clamped to server bounds). */
    maxTokensPerSource?: number;
    /** Optional aggregate retrieval prompt token ceiling (clamped to server bounds). */
    maxContextTokens?: number;
    /** Optional vector search adapter for testing or host injection. */
    vectorSearch?: SpaceAgentVectorSearchAdapter;
    /** Optional multi-scope SearchEngine dispatcher seam for testing or host injection (CT-3). */
    multiScopeSearch?: MultiScopeTurnSearchDispatcher;
    /** Optional page size for keyset-paged `Space Items` reads. */
    itemsPageSize?: number;
    /** Optional CX-3 override enabling server-bound action grants on this turn even if space config omits Agents.EnableBoundActionGrants. */
    enableBoundActionGrants?: boolean;
}

/** Candidate item in retrieval scope for the turn (sources-in-scope chip). */
export interface SpaceAgentCitation {
    SpaceItemID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Name: string;
    Band: 'Shared' | 'Team';
}

/** What the turn gave the agent (B20), for the harness and the log: never the values, only the names and ids. */
export interface TurnToolsGiven {
    /** The conversation's audience, which cut the grants. */
    audience: 'Shared' | 'Team';
    /** The action ids the agent holds this turn: the granted ones and Run space data when there is data to run. */
    actionIds: string[];
    /** The names of the queries and views Run space data may run. */
    dataGrantNames: string[];
    /** The Content Source ids in force. */
    knowledgeSourceIds: string[];
    /** Resolved Search Scope IDs handed to the agent turn (native space scope + authorized granted extra knowledge scopes). */
    searchScopeIds?: string[];
    /** Human-readable Search Scope names corresponding to `searchScopeIds`. */
    grantedKnowledgeScopeNames?: string[];
    /** What was in force but not given, and why (D36's closures, settings MJ's run cannot take). */
    withheld: string[];
}

export type ExecuteSpaceChatTurnResult =
    | {
          ok: true;
          replyDetailIds: string[];
          agentRunId?: string;
          quotedCount?: number;
          allowedItemNames?: string[];
          citations?: SpaceAgentCitation[];
          sourceReceipts?: SpaceAgentSourceReceiptEntry[];
          rejectedCitationCount?: number;
          suppliedSources?: SpaceAgentSuppliedSource[];
          retrievalStats?: SpaceAgentRetrievalStats;
          tools?: TurnToolsGiven;
      }
    | { ok: false; message: string };

/**
 * Stored as the reply row's `ExternalID` when the turn came from the author's explicit ask (`route: 'Redirect'`), so the reply
 * shows why the agent spoke; a tagged or routed turn's reply has none. It is written in the insert that starts the turn.
 */
export const EXPLICIT_ASK_MARKER = 'collab:explicit-ask';

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
 * 7. Runs agent with ConversationHistoryFrom set to room's history floor and audience bounded. The audience is everyone with an
 *    Active seat that reaches the conversation's space, by its kind; when it cannot be read whole the turn is refused before
 *    a reply row is written, and never runs bounded by the asker alone.
 * 8. Writes reply as system user and returns real AgentRunId.
 * 9. B20: the one configuration is loaded once; the grants in force for the conversation's audience become the run's tools
 *    (`actionChanges`, Run space data's context, the knowledge sources) and the agent grant's settings become the run's.
 * 10. The type's word (the extension model's 83): its driver's `BuildAgentContext` adds instructions and data to the turn, given
 *    the chat and the bands of the people in it, so a type can leave Team-only data out when an outside person is in the chat.
 *    A driver that fails here is logged and the turn runs without its context; it never takes the turn down.
 */
export async function executeSpaceChatTurn(
    provider: IMetadataProvider,
    user: UserInfo,
    input: ExecuteSpaceChatTurnInput
): Promise<ExecuteSpaceChatTurnResult> {
    ensurePostgresReceiptContextHook(provider);
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
    if (targetNode && spaceIsReadOnly(targetNode)) {
        return { ok: false, message: targetNode.closedAt ? 'A closed space does not take a new turn.' : 'A read-only space does not take a new turn.' };
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
    const spaceRes = await view.RunView<{ ClosedAt: string | null; StatusID: string | null; SpaceTypeID: string | null; Configuration: string | null }>({
        EntityName: SPACES,
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ClosedAt', 'StatusID', 'SpaceTypeID', 'Configuration'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (!spaceRes.Success || !spaceRes.Results?.[0]) {
        return { ok: false, message: spaceRes.ErrorMessage || 'The space could not be read.' };
    }

    const targetSpace = spaceRes.Results[0];
    const refusal = spaceWriteRefusal(targetSpace);
    if (refusal.readOnly) {
        return { ok: false, message: spaceWriteRefusalMessage(refusal, 'turn') };
    }

    // 2. Verify conversation belongs to this space and is active
    const chatCheck = await view.RunView<{ ID: string; ConversationID: string; Kind: string; Status: string; OwnerUserID?: string | null }>({
        EntityName: SPACE_CHATS,
        ExtraFilter: `SpaceID = '${spaceId}' AND ConversationID = '${conversationId}' AND Status = 'Active'`,
        Fields: ['ID', 'ConversationID', 'Kind', 'Status', 'OwnerUserID'],
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
    const isOneToOneAssistant = foundChat.Kind === 'Assistant';
    if (isOneToOneAssistant && parseUuid(foundChat.OwnerUserID) !== callerId) {
        return { ok: false, message: 'Caller cannot initiate an agent turn in another member\'s assistant conversation.' };
    }

    // 'Redirect' is the MJ AgentTurnRoute used when the message's author clicks "Ask <Agent>":
    // the person redirects a "no agent" turn to the agent they picked.
    const isExplicitAsk = input.route === 'Redirect';

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

    // 5. The one configuration, loaded once for the settings, the agents and the tools (B16, B20)
    let loaded: Awaited<ReturnType<typeof loadSpaceConfiguration>>;
    try {
        loaded = await loadSpaceConfiguration(provider, spaceId);
    } catch (configurationError) {
        return { ok: false, message: configurationError instanceof Error ? configurationError.message : 'The space\'s configuration could not be resolved.' };
    }
    let chatSettings: Awaited<ReturnType<typeof resolveSpaceChatSettings>>;
    try {
        chatSettings = await resolveSpaceChatSettings(provider, spaceId, system, loaded, { isOneToOne: isOneToOneAssistant });
    } catch (settingsError) {
        return { ok: false, message: settingsError instanceof Error ? settingsError.message : 'Space settings refused.' };
    }
    const agentReplyMode = chatSettings.agentReplyMode;
    const historyOnAdd = chatSettings.historyOnAdd;

    // 6. Resolve allowed agents
    let allowed: Awaited<ReturnType<typeof resolveAllowedAgents>>;
    try {
        allowed = await resolveAllowedAgents(provider, spaceId, system, loaded.configuration);
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

    // 7a. History floor from Chats.HistoryOnAdd (Item 16) — resolved before agent continuity checks so prior replies respect the floor
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

    // 7. Mention and thread-reply rules (Item 6)
    const parser = new MentionParser();
    const parseResult = parser.parseMentions(messageText, availableAgents);
    const taggedAgentId = parseResult.agentMention?.id
        ? parseUuid(parseResult.agentMention.id)
        : null;
    const hasHumanMentionOnly = !taggedAgentId && (parseResult.userMentions?.length ?? 0) > 0;
    const parentDetailId = parseUuid(userDetail.ParentID);

    let targetAgentId: string;
    if (isExplicitAsk) {
        const requestedAgentId = parseUuid(input.agentId) ?? taggedAgentId ?? resolvedDefault;
        if (!requestedAgentId) {
            return { ok: false, message: 'No assistant is available in this space right now.' };
        }
        targetAgentId = requestedAgentId;
    } else if (taggedAgentId) {
        targetAgentId = taggedAgentId;
    } else if (hasHumanMentionOnly) {
        return { ok: false, message: 'The message is addressed to a person and does not mention an agent.' };
    } else if (parentDetailId) {
        const parentResolved = await resolveParentReplyAgent(view, system, conversationId, parentDetailId, callerId, conversationHistoryFrom);
        if (!parentResolved.ok) {
            return { ok: false, message: parentResolved.message };
        }
        if (parentResolved.agentId) {
            targetAgentId = parentResolved.agentId;
        } else if (agentReplyMode === 'Always') {
            if (!resolvedDefault) {
                return { ok: false, message: 'No assistant is available in this space right now.' };
            }
            targetAgentId = resolvedDefault;
        } else {
            return { ok: false, message: 'The message does not mention an agent.' };
        }
    } else if (agentReplyMode === 'Always') {
        if (!resolvedDefault) {
            return { ok: false, message: 'No assistant is available in this space right now.' };
        }
        targetAgentId = resolvedDefault;
    } else {
        // Under MentionOnly without a tagged agent or thread reply to AI: evaluate via server-side decision routing
        const decisionResolved = await resolveTurnAgentViaDecision({
            view,
            system,
            spaceId,
            conversationId,
            userMessageId,
            messageText,
            allowedAgentIds: allowed.allowedAgentIds,
            conversationHistoryFrom,
            decisionRunner: input.decisionRunner,
            decisionCalibration: input.decisionCalibration,
        });
        if (!decisionResolved.ok) {
            return { ok: false, message: decisionResolved.message };
        }
        targetAgentId = decisionResolved.agentId;
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

    // 7b. The turn's tools (B20 / CX-3) and authorized knowledge scopes (CT-3):
    const audience = isOneToOneAssistant
        ? (reach.role.canSeeTeamBand ? 'Team' : 'Shared')
        : audienceOfConversationKind(foundChat.Kind);
    const enableBoundActions =
        input.enableBoundActionGrants === true ||
        loaded.configuration.Settings.Agents?.EnableBoundActionGrants === true;
    let turnTools: Awaited<ReturnType<typeof resolveTurnTools>>;
    try {
        turnTools = await resolveTurnTools(provider, system, loaded.configuration, audience, targetAgentId, {
            includeBoundActions: enableBoundActions,
            spaceId,
            callerUser: user,
            loadedConfiguration: loaded,
        });
    } catch (toolsError) {
        return { ok: false, message: `The turn's tools could not be resolved: ${toolsError instanceof Error ? toolsError.message : String(toolsError)}` };
    }
    const turnKnowledgeScopes = await resolveTurnKnowledgeScopes({
        provider,
        systemUser: system,
        contextUser: user,
        configuration: loaded.configuration,
        audience,
        primaryScopeRecordId: foundChat.ID,
    });
    const toolsGiven: TurnToolsGiven = {
        audience,
        actionIds: turnTools.actionIds,
        dataGrantNames: turnTools.spaceData.map((grant) => grant.Name),
        knowledgeSourceIds: turnTools.tools.KnowledgeSourceIDs,
        searchScopeIds: turnKnowledgeScopes.searchScopeIds,
        grantedKnowledgeScopeNames: turnKnowledgeScopes.grantedScopes.map((s) => s.scopeName),
        withheld: turnTools.withheld,
    };
    // What Run space data reads when the agent calls it; the run's id is filled in once the run exists (A2)
    const turnContext: SpaceTurnContext = { spaceId, conversationId, audience, spaceData: turnTools.spaceData, agentRunId: null, toolSourceHits: [] };

    // 7c. The type's word on the turn (item 83): the people in the chat, by band, then the driver's instructions and data
    const speakerLabels = new Map<string, string>();
    if (user?.Name) {
        speakerLabels.set(callerId, user.Name);
    }
    let typeContext: AgentContextResult = { instructions: [], contextData: {} };
    try {
        // Every seat, read to its end: a viewer left out would let the type hand over what that viewer may not see
        const seats = await readEveryRow<{ ID?: string | null; UserID: string; User?: string | null; Band: string }>(view, {
            EntityName: 'MJ_BizApps_Collaboration: Space Members',
            ExtraFilter: `SpaceID = '${spaceId}' AND Status = 'Active'${audience === 'Team' ? " AND Band = 'Team'" : ''}`,
            Fields: ['ID', 'UserID', 'User', 'Band'],
        }, system, input.rosterPageSize);
        const viewerBands: Record<string, 'Team' | 'Shared'> = {};
        if (isOneToOneAssistant) {
            viewerBands[callerId.toUpperCase()] = reach.role.canSeeTeamBand ? 'Team' : 'Shared';
        } else {
            for (const seat of seats) {
                const seatUserId = parseUuid(seat.UserID) ?? seat.UserID;
                viewerBands[seatUserId.toUpperCase()] = seat.Band === 'Team' ? 'Team' : 'Shared';
                if (seat.User?.trim()) {
                    speakerLabels.set(seatUserId, seat.User.trim());
                }
            }
        }
        const built = await driver.call.driver.BuildAgentContext({ ...driver.call.base, chatId: foundChat.ID, viewerBands });
        const meetingsContext = await buildSpaceMeetingsAgentContext(provider, spaceId, viewerBands, user);
        let scopedInstructions: readonly string[] = [];
        try {
            const scopedPromptResult = await resolveSpaceScopedPromptParts({
                provider,
                systemUser: system,
                spaceId,
                audience,
                loadedConfiguration: loaded,
            });
            scopedInstructions = scopedPromptResult.instructions;
        } catch (scopedPromptErr) {
            LogError(`executeSpaceChatTurn: scoped prompt parts resolution failed for space ${spaceId}: ${scopedPromptErr instanceof Error ? scopedPromptErr.message : String(scopedPromptErr)}`);
        }
        typeContext = {
            instructions: [...scopedInstructions, ...(built?.instructions ?? []), ...(meetingsContext.instructions ?? [])],
            contextData: { ...(built?.contextData ?? {}), ...(meetingsContext.contextData ?? {}) },
        };
    } catch (contextError) {
        LogError(`executeSpaceChatTurn: the type's driver failed building the agent context for space ${spaceId}; the turn runs without it: ${contextError instanceof Error ? contextError.message : String(contextError)}`);
    }

    // 9. Bound agent to conversation audience (Item 23 / B2.3: what the room can reach)
    const requestedScope = input.retrievalScope;
    const effectiveNarrowing =
        requestedScope === 'ThisSpace'
            ? 'ThisSpace'
            : requestedScope === 'Everything' && isOneToOneAssistant
                ? 'Everything'
                : 'Subtree';
    // A turn whose audience cannot be worked out is refused before its reply row is written: it never runs bounded by the asker alone
    const rankingQuery = stripMentionMarkup(messageText);
    let retrieval: Awaited<ReturnType<typeof resolveSpaceAgentRetrieval>>;
    try {
        retrieval = await resolveSpaceAgentRetrieval(provider, user, spaceId, {
            spaceChatId: foundChat.ID,
            conversationKind: foundChat.Kind,
            participantUserIds: isOneToOneAssistant ? [callerId] : undefined,
            narrowing: effectiveNarrowing,
            rankingQuery: rankingQuery || undefined,
            topK: input.topK,
            maxTokensPerSource: input.maxTokensPerSource,
            maxContextTokens: input.maxContextTokens,
            vectorSearch: input.vectorSearch,
            rosterPageSize: input.rosterPageSize,
            itemsPageSize: input.itemsPageSize,
        });
    } catch (retrievalError) {
        const reason = retrievalError instanceof Error ? retrievalError.message : String(retrievalError);
        LogError(`executeSpaceChatTurn: the turn in space ${spaceId} is refused, since what its audience may use could not be worked out: ${reason}`);
        return { ok: false, message: reason };
    }
    if (retrieval.audienceUserIds.length === 0) {
        return { ok: false, message: 'The turn was refused: the conversation\'s audience could not be worked out from the space\'s seats.' };
    }
    const audienceQuoted = retrieval.quotedItems;
    const citations: SpaceAgentCitation[] = audienceQuoted.map((item) => ({
        SpaceItemID: item.ID,
        SpaceID: item.SpaceID,
        EntityID: item.EntityID,
        RecordID: item.RecordID,
        Name: item.Name,
        Band: item.Band,
    }));
    const participantUserIds = retrieval.audienceUserIds;

    // Re-evaluate granted knowledge scopes against every hydrated reader in the conversation's audience (CR-4: fail closed)
    interface HydratedUserRow {
        ID: string;
        Name: string | null;
        Email: string | null;
        IsActive?: boolean | null;
    }
    interface HydratedUserRoleRow {
        ID: string;
        UserID: string;
        RoleID: string;
        Role: string | null;
    }

    const normalizedParticipantIds: string[] = [];
    const seenParticipantIds = new Set<string>();
    let audienceHydrationFailed = participantUserIds.length === 0;
    for (const pid of participantUserIds) {
        const cleanPid = parseUuid(pid);
        if (!cleanPid) {
            audienceHydrationFailed = true;
            break;
        }
        const lowerPid = cleanPid.toLowerCase();
        if (!seenParticipantIds.has(lowerPid)) {
            seenParticipantIds.add(lowerPid);
            normalizedParticipantIds.push(lowerPid);
        }
    }

    const hydratedById = new Map<string, UserInfo>();
    const callerNormalized = parseUuid(user.ID)?.toLowerCase();
    if (callerNormalized) {
        hydratedById.set(callerNormalized, user);
    }
    for (const cachedUser of UserCache.Users ?? []) {
        const cachedNormalized = parseUuid(cachedUser?.ID)?.toLowerCase();
        if (cachedNormalized && !hydratedById.has(cachedNormalized)) {
            hydratedById.set(cachedNormalized, cachedUser);
        }
    }

    const missingAudienceIds = audienceHydrationFailed
        ? []
        : normalizedParticipantIds.filter((pid) => !hydratedById.has(pid));

    if (!audienceHydrationFailed && missingAudienceIds.length > 0) {
        const inClause = missingAudienceIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ');
        try {
            const [userRows, roleRows] = await Promise.all([
                readEveryRow<HydratedUserRow>(
                    view,
                    {
                        EntityName: 'MJ: Users',
                        ExtraFilter: `ID IN (${inClause})`,
                        Fields: ['ID', 'Name', 'Email', 'IsActive'],
                    },
                    system,
                    input.rosterPageSize,
                ),
                readEveryRow<HydratedUserRoleRow>(
                    view,
                    {
                        EntityName: 'MJ: User Roles',
                        ExtraFilter: `UserID IN (${inClause})`,
                        Fields: ['ID', 'UserID', 'RoleID', 'Role'],
                    },
                    system,
                    input.rosterPageSize,
                ),
            ]);

            const rolesByUserId = new Map<string, UserRoleInfo[]>();
            for (const roleRow of roleRows) {
                const uid = parseUuid(roleRow.UserID)?.toLowerCase();
                if (!uid) continue;
                const list = rolesByUserId.get(uid) ?? [];
                list.push(
                    new UserRoleInfo({
                        ID: roleRow.ID,
                        UserID: roleRow.UserID,
                        RoleID: roleRow.RoleID,
                        Role: roleRow.Role ?? undefined,
                    }),
                );
                rolesByUserId.set(uid, list);
            }

            for (const userRow of userRows) {
                const uid = parseUuid(userRow.ID)?.toLowerCase();
                if (!uid || userRow.IsActive === false) continue;
                hydratedById.set(
                    uid,
                    new UserInfo(provider, {
                        ID: userRow.ID,
                        Name: userRow.Name ?? undefined,
                        Email: userRow.Email ?? undefined,
                        IsActive: userRow.IsActive ?? true,
                        UserRoles: rolesByUserId.get(uid) ?? [],
                    }),
                );
            }
        } catch (hydrationError) {
            audienceHydrationFailed = true;
            LogError(
                `executeSpaceChatTurn: failed to hydrate missing audience users for space ${spaceId}; withholding extra knowledge scopes (fail closed): ${hydrationError instanceof Error ? hydrationError.message : String(hydrationError)}`,
            );
        }
    }

    const hydratedAudienceUsers: UserInfo[] = [];
    if (!audienceHydrationFailed) {
        for (const pid of normalizedParticipantIds) {
            const hydrated = hydratedById.get(pid);
            if (!hydrated) {
                audienceHydrationFailed = true;
                break;
            }
            hydratedAudienceUsers.push(hydrated);
        }
    }

    const allAudienceVerified =
        !audienceHydrationFailed &&
        normalizedParticipantIds.length > 0 &&
        hydratedAudienceUsers.length === normalizedParticipantIds.length;

    const audienceAuthorizedScopes = !allAudienceVerified
        ? {
              nativeScope: turnKnowledgeScopes.nativeScope,
              grantedScopes: [],
              searchScopeIds: [COLLABORATION_SPACE_SCOPE_ID],
              scopeById: new Map(),
              scopeByContentSourceId: new Map(),
              contentSourceNamesById: new Map(),
              maxBandByContentSourceId: new Map(),
              rejectedScopes: turnKnowledgeScopes.grantedScopes.map((s) => ({
                  scopeId: s.scopeId,
                  scopeName: s.scopeName,
                  reason: 'Failed closed: one or more conversation audience users could not be hydrated',
              })),
          }
        : hydratedAudienceUsers.length > 1 || hydratedAudienceUsers[0]?.ID.toLowerCase() !== callerId.toLowerCase()
            ? await resolveTurnKnowledgeScopes({
                  provider,
                  systemUser: system,
                  contextUser: user,
                  configuration: loaded.configuration,
                  audience,
                  audienceUsers: hydratedAudienceUsers,
                  primaryScopeRecordId: foundChat.ID,
              })
            : turnKnowledgeScopes;
    toolsGiven.searchScopeIds = audienceAuthorizedScopes.searchScopeIds;
    toolsGiven.grantedKnowledgeScopeNames = audienceAuthorizedScopes.grantedScopes.map((s) => s.scopeName);

    const multiScopeSearchResult = allAudienceVerified
        ? await dispatchMultiScopeTurnSearch(
              {
                  query: rankingQuery || stripMentionMarkup(messageText),
                  spaceId,
                  spaceChatId: foundChat.ID,
                  maxResults: input.topK ?? 20,
                  nativeScope: audienceAuthorizedScopes.nativeScope,
                  grantedScopes: audienceAuthorizedScopes.grantedScopes,
                  scopeById: audienceAuthorizedScopes.scopeById,
                  scopeByContentSourceId: audienceAuthorizedScopes.scopeByContentSourceId,
                  contentSourceNamesById: audienceAuthorizedScopes.contentSourceNamesById,
                  maxBandByContentSourceId: audienceAuthorizedScopes.maxBandByContentSourceId,
                  searchScopeIds: audienceAuthorizedScopes.searchScopeIds,
                  audienceUsers: hydratedAudienceUsers,
                  contextUser: user,
                  provider,
              },
              input.multiScopeSearch,
          )
        : {
              extraKnowledgeCandidates: [],
              grantedKnowledgeHits: [],
              nativeToolHits: [],
          };

    // 10. Write reply as system user (Item 5 / A19 Part 2)
    const assistantDetail = await provider.GetEntityObject<MJConversationDetailEntity>(DETAILS, system);
    assistantDetail.NewRecord();
    (assistantDetail as MJConversationDetailEntity & { MarkServerAuthoredReply?: () => void }).MarkServerAuthoredReply?.();
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
    if (isExplicitAsk) assistantDetail.ExternalID = EXPLICIT_ASK_MARKER;
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
            const assembledMessages = ConversationEngine.AssembleContextWindow(windowRows, {
                excludeDetailIds: [assistantDetail.ID],
                historyFrom: conversationHistoryFrom ?? null,
                maxTailMessages: 20,
                speakerAttribution: 'always',
                speakerLabels,
            });

            const agentEntity = await provider.GetEntityObject<MJAIAgentEntityExtended>('MJ: AI Agents', system);
            if (agentEntity && (await agentEntity.Load(targetAgentId))) {
                // Prevent cross-space global memory/note/example leakage when an ambient/global agent (such as Sage)
                // runs inside a Collaboration space turn. Mutated in memory only — NEVER call .Save() on agentEntity.
                agentEntity.InjectNotes = false;
                agentEntity.InjectExamples = false;

                const envModelName = process.env['COLLABORATION_SPACE_CHAT_MODEL']?.trim() ?? '';
                const overrideModelId = envModelName
                    ? await resolveSpaceChatModelOverrideId(view, system, envModelName)
                    : null;
                const envEffortLevel = parseSpaceChatEffortLevel(process.env['COLLABORATION_SPACE_CHAT_EFFORT_LEVEL']);
                const effectiveEffortLevel = envEffortLevel !== undefined ? envEffortLevel : turnTools.runSettings.effortLevel;

                const turnMessages = [...assembledMessages];
                if (!isShippedCollaborationSpaceAgent(agentEntity.Name, targetAgentId)) {
                    const spaceContextSystemMessage = buildSpaceAgentContextSystemMessage({
                        audience,
                        typeInstructions: typeContext.instructions ?? [],
                        allowedItems: audienceQuoted,
                        grantedKnowledgeHits: multiScopeSearchResult.grantedKnowledgeHits,
                        spaceData: turnTools.spaceData,
                        boundActions: turnTools.boundActionCatalog ?? [],
                    });
                    if (spaceContextSystemMessage) {
                        turnMessages.unshift({
                            role: 'system',
                            content: spaceContextSystemMessage,
                        });
                    }
                }

                const runner = new AgentRunner(provider);
                type SpaceExecuteAgentParams = ExecuteAgentParams & {
                    Audience?: { Mode: 'Intersection'; UserIDs: string[] };
                    boundActionParams?: BoundActionParamsMap;
                };
                const runnerParams: SpaceExecuteAgentParams = {
                    agent: agentEntity,
                    contextUser: user,
                    userId: user.ID,
                    conversationId,
                    conversationDetailId: assistantDetail.ID,
                    ConversationHistoryFrom: conversationHistoryFrom,
                    PrimaryScopeEntityName: 'MJ_BizApps_Collaboration: Space Chats',
                    PrimaryScopeRecordID: foundChat.ID,
                    // The space's native scope + authorized granted extra knowledge scopes (CT-3)
                    SearchScopeIDs: audienceAuthorizedScopes.searchScopeIds,
                    Audience: {
                        Mode: 'Intersection',
                        UserIDs: participantUserIds,
                    },
                    data: {
                        spaceId,
                        conversationId,
                        audience,
                        allowedItems: audienceQuoted,
                        suppliedSources: retrieval.suppliedSources ?? [],
                        retrievalStats: retrieval.stats,
                        // B20 / CT-3 / CX-3: what the model is told it may run, and the knowledge scopes + hits in force
                        spaceData: turnTools.spaceData,
                        ...(turnTools.boundActionCatalog ? { boundActions: turnTools.boundActionCatalog } : {}),
                        knowledgeSourceIds: turnTools.tools.KnowledgeSourceIDs,
                        grantedKnowledgeScopes: audienceAuthorizedScopes.grantedScopes.map((s) => ({
                            scopeId: s.scopeId,
                            scopeName: s.scopeName,
                            contentSourceIds: s.contentSourceIds,
                        })),
                        grantedKnowledgeHits: multiScopeSearchResult.grantedKnowledgeHits,
                        // Item 83: what the space's type adds to the turn
                        typeInstructions: typeContext.instructions ?? [],
                        typeContextData: typeContext.contextData ?? {},
                    },
                    context: turnContext,
                    ...(overrideModelId ? { override: { modelId: overrideModelId } } : {}),
                    ...(turnTools.boundActionParams && Object.keys(turnTools.boundActionParams).length > 0
                        ? { boundActionParams: turnTools.boundActionParams }
                        : {}),
                    ...(turnTools.actionChanges.length ? { actionChanges: turnTools.actionChanges } : {}),
                    ...(turnTools.runSettings.planMode !== undefined ? { planMode: turnTools.runSettings.planMode } : {}),
                    ...(effectiveEffortLevel !== undefined ? { effortLevel: effectiveEffortLevel } : {}),
                    ...(turnTools.runSettings.requestedSkillIDs.length ? { requestedSkillIDs: turnTools.runSettings.requestedSkillIDs } : {}),
                    ...(turnTools.runSettings.absoluteMaxIterations !== undefined ? { absoluteMaxIterations: turnTools.runSettings.absoluteMaxIterations } : {}),
                    ...(turnTools.runSettings.maxExecutionTimeMs !== undefined ? { maxExecutionTimeMs: turnTools.runSettings.maxExecutionTimeMs } : {}),
                    conversationMessages: turnMessages,
                    onProgress: input.observer?.OnProgress,
                    onStreaming: input.observer?.OnStreaming,
                    onAgentRunCreated: async (createdRunId: string) => {
                        agentRunId = createdRunId;
                        turnContext.agentRunId = createdRunId;
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

                const runResult = await runWithCollaborationAgentTurnAuthority(user.ID, () =>
                    runner.RunAgent(runnerParams)
                );
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

        // Validate & persist source receipts BEFORE marking assistant reply Complete (fail-closed CT-2 / CT-3 commit boundary)
        const nativeScopeMeta = audienceAuthorizedScopes.nativeScope;
        const suppliedItemCandidates: ValidatedSuppliedSourceCandidate[] =
            retrieval.suppliedSources && retrieval.suppliedSources.length > 0
                ? retrieval.suppliedSources.map((src) => ({
                      sourceKind: 'SpaceItem',
                      spaceId: src.spaceId,
                      spaceItemId: src.spaceItemId,
                      contentSourceId: null,
                      targetEntityId: src.entityId || null,
                      targetRecordId: src.recordId || null,
                      sourceTitle: src.name,
                      band: src.band,
                      retrievalRank: src.rank,
                      relevanceScore: src.score,
                      rankingMode: src.rankingMode,
                      estimatedTokens: src.estimatedTokens,
                      wasTruncated: src.truncated,
                      originatingScopeId: nativeScopeMeta.scopeId,
                      originatingScopeName: nativeScopeMeta.scopeName,
                  }))
                : audienceQuoted.map((item) => ({
                      sourceKind: 'SpaceItem',
                      spaceId: item.SpaceID,
                      spaceItemId: item.ID,
                      contentSourceId: null,
                      targetEntityId: item.EntityID || null,
                      targetRecordId: item.RecordID || null,
                      sourceTitle: item.Name,
                      band: item.Band,
                      retrievalRank: null,
                      relevanceScore: null,
                      rankingMode: 'none',
                      estimatedTokens: 0,
                      wasTruncated: false,
                      originatingScopeId: nativeScopeMeta.scopeId,
                      originatingScopeName: nativeScopeMeta.scopeName,
                  }));

        // Accumulate validated sources returned by in-turn search/knowledge tools (e.g. Scoped Search) and multi-scope search
        const stepToolHits = extractToolSourceHitsFromAgentRun(finishedResult);
        const nativeDispatchHits: TurnToolSourceHit[] = multiScopeSearchResult.nativeToolHits.map((hit) => ({
            sourceKind: 'SpaceItem',
            ...(hit.EntityName === 'MJ_BizApps_Collaboration: Space Items' ? { spaceItemId: parseUuid(hit.RecordID) } : {}),
            entityName: hit.EntityName || null,
            recordId: hit.RecordID || null,
            title: hit.Title ?? hit.RecordName ?? null,
            score: typeof hit.Score === 'number' && Number.isFinite(hit.Score) ? hit.Score : null,
            rankingMode: hit.SourceType === 'vector' ? 'vector' : 'lexical',
            originatingScopeId: hit.OriginatingScopeID ?? nativeScopeMeta.scopeId,
            originatingScopeName: hit.OriginatingScopeName ?? nativeScopeMeta.scopeName,
        }));
        const allToolHits: TurnToolSourceHit[] = [
            ...(turnContext.toolSourceHits ?? []),
            ...stepToolHits,
            ...nativeDispatchHits,
        ];

        const receiptReachContext = buildSourceReceiptReachContext(
            audience,
            spaceId,
            retrieval.allowedBandsBySpace,
            retrieval.searchedSpaceIds,
        );

        const initialItemIdSet = new Set(
            suppliedItemCandidates
                .map((c) => normalizeReceiptUuid(c.spaceItemId))
                .filter((id): id is string => id !== null),
        );
        const toolResolved = await resolveToolSuppliedSourceCandidates({
            provider,
            systemUser: system,
            toolHits: allToolHits,
            reachContext: receiptReachContext,
            alreadySuppliedSpaceItemIds: initialItemIdSet,
            nativeScope: nativeScopeMeta,
        });

        const mergedScopeByContentSource = new Map<string, ResolveSuppliedKnowledgeScopeMeta>();
        for (const [csId, scope] of audienceAuthorizedScopes.scopeByContentSourceId.entries()) {
            mergedScopeByContentSource.set(csId, { scopeId: scope.scopeId, scopeName: scope.scopeName });
        }
        for (const [csId, meta] of toolResolved.originatingScopeByContentSourceId.entries()) {
            mergedScopeByContentSource.set(csId, meta);
        }

        const extraKnowledgeSourceIdSet = new Set<string>(toolResolved.suppliedKnowledgeSourceIds);
        for (const extraCand of multiScopeSearchResult.extraKnowledgeCandidates) {
            if (extraCand.contentSourceId) {
                extraKnowledgeSourceIdSet.add(extraCand.contentSourceId);
            }
        }

        const suppliedKnowledgeCandidates = await resolveSuppliedKnowledgeSources(
            provider,
            system,
            spaceId,
            loaded.configuration.Grants.KnowledgeSource,
            toolsGiven.knowledgeSourceIds,
            audience,
            extraKnowledgeSourceIdSet,
            mergedScopeByContentSource,
        );

        const receiptExtraction = extractAndValidateSourceReceipts(
            [
                ...suppliedItemCandidates,
                ...toolResolved.spaceItemCandidates,
                ...multiScopeSearchResult.extraKnowledgeCandidates,
                ...suppliedKnowledgeCandidates,
            ],
            agentReplyText,
            receiptReachContext,
        );
        if (
            receiptExtraction.rejectedCandidates.length > 0 ||
            receiptExtraction.rejectedCitations.length > 0 ||
            toolResolved.rejectedCount > 0
        ) {
            LogError(
                `executeSpaceChatTurn: filtered ${receiptExtraction.rejectedCandidates.length} out-of-scope candidate(s), ` +
                `${toolResolved.rejectedCount} out-of-scope tool hit(s), and ` +
                `${receiptExtraction.rejectedCitations.length} unverified citation marker(s) for conversationDetail ${assistantDetail.ID}.`,
            );
        }

        const persistReceiptsResult = await persistSpaceAgentSourceReceipts({
            provider,
            systemUser: system,
            turnUserId: user.ID,
            spaceChatId: foundChat.ID,
            conversationId,
            conversationDetailId: assistantDetail.ID,
            agentRunId,
            receipts: receiptExtraction.receipts,
            reachContext: receiptReachContext,
        });
        if (persistReceiptsResult.ok === false) {
            const receiptErrMsg = `Failed to persist source receipts: ${persistReceiptsResult.errorMessage}`;
            LogError(`executeSpaceChatTurn: ${receiptErrMsg}`);
            assistantDetail.Status = 'Error';
            assistantDetail.Message = ASSISTANT_FAILED_MESSAGE;
            if (!(await assistantDetail.Save())) {
                LogError(`executeSpaceChatTurn: failed to mark the reply Error after receipt persistence failure: ${assistantDetail.LatestResult?.CompleteMessage ?? ''}`);
            }
            tellFinished({ replyDetailId: assistantDetail.ID, success: false, agentRun: finishedRun, result: finishedResult, errorMessage: receiptErrMsg });
            return { ok: false, message: receiptErrMsg };
        }

        const persistedItemIdSet = new Set(
            receiptExtraction.receipts
                .filter((r) => r.sourceKind === 'SpaceItem' && r.spaceItemId)
                .map((r) => normalizeReceiptUuid(r.spaceItemId)),
        );
        const citationsByItemId = new Map<string, SpaceAgentCitation>();
        for (const c of citations) {
            const cid = normalizeReceiptUuid(c.SpaceItemID);
            if (cid && persistedItemIdSet.has(cid)) {
                citationsByItemId.set(cid, c);
            }
        }
        for (const tc of toolResolved.spaceItemCandidates) {
            const cid = normalizeReceiptUuid(tc.spaceItemId);
            if (cid && persistedItemIdSet.has(cid) && !citationsByItemId.has(cid)) {
                citationsByItemId.set(cid, {
                    SpaceItemID: tc.spaceItemId!,
                    SpaceID: tc.spaceId,
                    EntityID: tc.targetEntityId ?? '',
                    RecordID: tc.targetRecordId ?? '',
                    Name: tc.sourceTitle,
                    Band: tc.band,
                });
            }
        }
        const validatedCitations =
            receiptExtraction.receipts.length > 0
                ? Array.from(citationsByItemId.values())
                : citations;

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
            citations: validatedCitations,
            sourceReceipts: receiptExtraction.receipts,
            rejectedCitationCount: receiptExtraction.rejectedCitations.length,
            suppliedSources: retrieval.suppliedSources,
            retrievalStats: retrieval.stats,
            tools: toolsGiven,
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
        return {
            ok: true,
            replyDetailIds: [assistantDetail.ID],
            quotedCount: audienceQuoted.length,
            allowedItemNames: audienceQuoted.map((item) => item.Name),
            citations,
            suppliedSources: retrieval.suppliedSources,
            retrievalStats: retrieval.stats,
            tools: toolsGiven,
        };
    }
    return settleTurn();
}

async function resolveParentReplyAgent(
    view: RunView,
    system: UserInfo,
    conversationId: string,
    parentDetailId: string,
    callerId: string,
    historyFrom: Date | undefined,
): Promise<{ ok: true; agentId: string | null } | { ok: false; message: string }> {
    const parentRes = await view.RunView<{ ID: string; Role: string | null; AgentID: string | null; UserID?: string | null; __mj_CreatedAt?: string | Date | null }>({
        EntityName: DETAILS,
        ExtraFilter: `ID = '${parentDetailId}' AND ConversationID = '${conversationId}'`,
        Fields: ['ID', 'Role', 'AgentID', 'UserID', '__mj_CreatedAt'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    const parentRow = parentRes.Success ? parentRes.Results?.[0] : undefined;
    if (!parentRow || (historyFrom && parentRow.__mj_CreatedAt && new Date(parentRow.__mj_CreatedAt).getTime() < historyFrom.getTime())) {
        return { ok: false, message: 'The message does not mention an agent.' };
    }
    const parentAgentId = parseUuid(parentRow.AgentID);
    if (parentRow.Role === 'AI' && parentAgentId) {
        return { ok: true, agentId: parentAgentId };
    }
    if (parentRow.Role === 'User') {
        const parentUserId = parseUuid(parentRow.UserID);
        if (parentUserId && parentUserId.toLowerCase() === callerId.toLowerCase()) {
            return { ok: true, agentId: null };
        }
        return { ok: false, message: 'The message replies to a person and does not mention an agent.' };
    }
    return { ok: false, message: 'The message does not mention an agent.' };
}

interface ParsedStepSearchItem {
    EntityName?: string | null;
    RecordID?: string | null;
    Title?: string | null;
    RecordName?: string | null;
    Score?: number | null;
    SourceType?: string | null;
    ContentSourceID?: string | null;
    SpaceItemID?: string | null;
    OriginatingScopeID?: string | null;
    OriginatingScopeName?: string | null;
    RawMetadata?: string | Record<string, string | number | boolean | null> | null;
}

interface ParsedStepOutput {
    Results?: ParsedStepSearchItem[];
    ContentSourceID?: string | null;
    KnowledgeSourceIDs?: string[];
    ScopeID_Resolved?: string | null;
    ScopeName_Resolved?: string | null;
    result?: {
        success?: boolean;
        data?: {
            Results?: ParsedStepSearchItem[];
            ContentSourceID?: string | null;
            KnowledgeSourceIDs?: string[];
            ScopeID_Resolved?: string | null;
            ScopeName_Resolved?: string | null;
        };
    };
}

function collectSearchItemsFromArray(
    rawItems: readonly ParsedStepSearchItem[],
    out: TurnToolSourceHit[],
    fallbackScopeId: string | null,
    fallbackScopeName: string | null,
): void {
    for (const item of rawItems) {
        if (!item || typeof item !== 'object') continue;
        const entityName = typeof item.EntityName === 'string' ? item.EntityName.trim() : '';
        const recordId = typeof item.RecordID === 'string' ? item.RecordID.trim() : '';
        const title =
            (typeof item.Title === 'string' && item.Title.trim()) ||
            (typeof item.RecordName === 'string' && item.RecordName.trim()) ||
            null;
        const score = typeof item.Score === 'number' && Number.isFinite(item.Score) ? item.Score : null;
        const rankingMode: TurnToolSourceHit['rankingMode'] = item.SourceType === 'vector' ? 'vector' : 'lexical';
        const itemScopeId = parseUuid(item.OriginatingScopeID) ?? fallbackScopeId;
        const itemScopeName =
            (typeof item.OriginatingScopeName === 'string' && item.OriginatingScopeName.trim()) ||
            fallbackScopeName;
        let contentSourceId = typeof item.ContentSourceID === 'string' ? parseUuid(item.ContentSourceID) : null;
        if (!contentSourceId && item.RawMetadata && typeof item.RawMetadata === 'object') {
            const rawCid = item.RawMetadata['ContentSourceID'];
            if (typeof rawCid === 'string') contentSourceId = parseUuid(rawCid);
        } else if (!contentSourceId && typeof item.RawMetadata === 'string') {
            try {
                const parsedMeta = JSON.parse(item.RawMetadata) as Record<string, string | number | boolean | null>;
                if (typeof parsedMeta['ContentSourceID'] === 'string') {
                    contentSourceId = parseUuid(parsedMeta['ContentSourceID']);
                }
            } catch {
                // ignore malformed metadata JSON
            }
        }
        const explicitSpaceItemId = typeof item.SpaceItemID === 'string' ? parseUuid(item.SpaceItemID) : null;

        if (entityName === 'MJ: Content Sources' || (contentSourceId && !recordId && !explicitSpaceItemId)) {
            const cid = contentSourceId ?? parseUuid(recordId);
            if (cid) {
                out.push({
                    sourceKind: 'KnowledgeSource',
                    contentSourceId: cid,
                    entityName: 'MJ: Content Sources',
                    recordId: recordId || cid,
                    title,
                    score,
                    rankingMode: 'grant',
                    originatingScopeId: itemScopeId,
                    originatingScopeName: itemScopeName,
                });
            }
            continue;
        }
        if (explicitSpaceItemId || recordId) {
            out.push({
                sourceKind: 'SpaceItem',
                ...(explicitSpaceItemId
                    ? { spaceItemId: explicitSpaceItemId }
                    : entityName === 'MJ_BizApps_Collaboration: Space Items'
                        ? { spaceItemId: parseUuid(recordId) }
                        : {}),
                ...(contentSourceId ? { contentSourceId } : {}),
                entityName: entityName || null,
                recordId: recordId || explicitSpaceItemId,
                title,
                score,
                rankingMode,
                originatingScopeId: itemScopeId,
                originatingScopeName: itemScopeName,
            });
        }
    }
}

function extractToolSourceHitsFromAgentRun(runResult: ExecuteAgentResult | undefined): TurnToolSourceHit[] {
    const out: TurnToolSourceHit[] = [];
    const steps = runResult?.agentRun?.Steps;
    if (!Array.isArray(steps)) {
        return out;
    }
    for (const step of steps) {
        if (!step || typeof step.OutputData !== 'string' || !step.OutputData.trim()) continue;
        let parsed: ParsedStepOutput;
        try {
            parsed = JSON.parse(step.OutputData) as ParsedStepOutput;
        } catch {
            continue;
        }
        if (!parsed || typeof parsed !== 'object') continue;
        const parsedScopeId = parseUuid(parsed.ScopeID_Resolved);
        const parsedScopeName =
            typeof parsed.ScopeName_Resolved === 'string' && parsed.ScopeName_Resolved.trim()
                ? parsed.ScopeName_Resolved.trim()
                : null;
        if (Array.isArray(parsed.Results)) {
            collectSearchItemsFromArray(parsed.Results, out, parsedScopeId, parsedScopeName);
        }
        if (parsed.result?.success !== false && parsed.result?.data) {
            const data = parsed.result.data;
            const dataScopeId = parseUuid(data.ScopeID_Resolved) ?? parsedScopeId;
            const dataScopeName =
                (typeof data.ScopeName_Resolved === 'string' && data.ScopeName_Resolved.trim()) ||
                parsedScopeName;
            if (Array.isArray(data.Results)) {
                collectSearchItemsFromArray(data.Results, out, dataScopeId, dataScopeName);
            }
            if (typeof data.ContentSourceID === 'string') {
                const cid = parseUuid(data.ContentSourceID);
                if (cid) {
                    out.push({
                        sourceKind: 'KnowledgeSource',
                        contentSourceId: cid,
                        rankingMode: 'grant',
                        originatingScopeId: dataScopeId,
                        originatingScopeName: dataScopeName,
                    });
                }
            }
            if (Array.isArray(data.KnowledgeSourceIDs)) {
                for (const rawCid of data.KnowledgeSourceIDs) {
                    const cid = parseUuid(rawCid);
                    if (cid) {
                        out.push({
                            sourceKind: 'KnowledgeSource',
                            contentSourceId: cid,
                            rankingMode: 'grant',
                            originatingScopeId: dataScopeId,
                            originatingScopeName: dataScopeName,
                        });
                    }
                }
            }
        }
        if (typeof parsed.ContentSourceID === 'string') {
            const cid = parseUuid(parsed.ContentSourceID);
            if (cid) {
                out.push({
                    sourceKind: 'KnowledgeSource',
                    contentSourceId: cid,
                    rankingMode: 'grant',
                    originatingScopeId: parsedScopeId,
                    originatingScopeName: parsedScopeName,
                });
            }
        }
        if (Array.isArray(parsed.KnowledgeSourceIDs)) {
            for (const rawCid of parsed.KnowledgeSourceIDs) {
                const cid = parseUuid(rawCid);
                if (cid) {
                    out.push({
                        sourceKind: 'KnowledgeSource',
                        contentSourceId: cid,
                        rankingMode: 'grant',
                        originatingScopeId: parsedScopeId,
                        originatingScopeName: parsedScopeName,
                    });
                }
            }
        }
    }
    return out;
}

