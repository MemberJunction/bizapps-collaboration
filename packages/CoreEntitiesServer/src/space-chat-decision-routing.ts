import { RunView, type UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import { AgentDecisionService } from '@memberjunction/ai-agents';
import {
    BuildRecentTurnParts,
    BuildRecentTurns,
    BuildRoutingQuestions,
    BuildRoutingState,
    CanAskRoutingDecision,
    CollectRoutingParticipants,
    InterpretRoutingAnswers,
    type RoutingCatalogAgent,
    type RoutingDecisionAnswers,
    type RoutingDecisionInput,
    type RoutingDecisionOutcome,
    type RoutingHistoryRow,
} from '@memberjunction/ai-core-plus';
import { parseUuid } from './uuid.js';

const DETAILS_ENTITY = 'MJ: Conversation Details';
const AGENTS_ENTITY = 'MJ: AI Agents';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';

/**
 * Server-side ceiling for `AgentDecisionService.Ask(...)` (`AIDecisionRunner` + `Default Decision`).
 * Fast token-classifier models (`Jev`, `Clef`, `SubQ`, `Kev`) return in 150–350 ms once warm, while a
 * 5 000 ms ceiling accommodates first-call `AIEngine` initialization, cold TLS handshakes, and
 * `LLM Decision` fallback models without hanging a turn indefinitely.
 */
export const SERVER_DECISION_ROUTING_TIMEOUT_MS = 5_000;

/**
 * Seam for unit tests to supply deterministic decision answers without a live model call.
 * Production callers omit this and run through `AgentDecisionService` (`AIDecisionRunner` + `Default Decision`).
 */
export type SpaceChatDecisionRunner = (params: {
    state: string;
    questions: ReturnType<typeof BuildRoutingQuestions>;
    timeoutMs: number;
    input: RoutingDecisionInput;
}) => Promise<RoutingDecisionAnswers>;

/**
 * Environment keys that back a `Decision`-type model driver or the `LLM Decision` fallback prompt's
 * chat drivers. Checked so unconfigured hosts (unit tests, CI without AI keys) report
 * `DecisionRoutingAvailable: false` and skip the 350 ms decision call.
 */
const DECISION_CREDENTIAL_ENV_PREFIXES = [
    'AI_VENDOR_API_KEY__OPENROUTERDECISION',
    'AI_VENDOR_API_KEY__OPENROUTERLLM',
    'AI_VENDOR_API_KEY__SYSTEMONEDECISION',
    'AI_VENDOR_API_KEY__SUBQDECISION',
    'AI_VENDOR_API_KEY__PERPLEXITYDECISION',
    'AI_VENDOR_API_KEY__INCEPTIONDECISION',
    'AI_VENDOR_API_KEY__CLOUDFLAREDECISION',
    'AI_VENDOR_API_KEY__OPENAIDECISION',
    'AI_VENDOR_API_KEY__CEREBRASLLM',
    'AI_VENDOR_API_KEY__FIREWORKSLLM',
    'AI_VENDOR_API_KEY__GROQLLM',
    'AI_VENDOR_API_KEY__OPENAILLM',
    'SYSTEMONE_BASE_URL',
] as const;

/**
 * Whether the server has credentials configured to run a `Decision` model on the `Default Decision`
 * prompt (any vendor decision driver or `LLM Decision`'s backing chat models).
 */
export function isDecisionRoutingAvailable(): boolean {
    for (const key of DECISION_CREDENTIAL_ENV_PREFIXES) {
        const val = process.env[key];
        if (typeof val === 'string' && val.trim().length > 0) {
            return true;
        }
    }
    return false;
}

let driversLoadedPromise: Promise<void> | null = null;

/**
 * Ensures any installed `BaseDecision` provider packages are imported once so their `@RegisterClass`
 * decorators register with `MJGlobal.Instance.ClassFactory` before `AIDecisionRunner` instantiates them.
 */
async function ensureDecisionDriversLoaded(): Promise<void> {
    if (!driversLoadedPromise) {
        const candidates = [
            '@memberjunction/ai-openrouter',
            '@memberjunction/ai-systemone',
            '@memberjunction/ai-inception',
            '@memberjunction/ai-cloudflare',
            '@memberjunction/ai-openai',
            // Fallback relative path when running inside the monorepo harness where root node_modules does not hoist provider packages
            new URL('../../../../MJ/packages/AI/Providers/OpenRouter/dist/index.js', import.meta.url).href,
            new URL('../../../../MJ/packages/AI/Providers/SystemOne/dist/index.js', import.meta.url).href,
            new URL('../../../../MJ/packages/AI/Providers/Inception/dist/index.js', import.meta.url).href,
            new URL('../../../../MJ/packages/AI/Providers/Cloudflare/dist/index.js', import.meta.url).href,
        ];
        driversLoadedPromise = Promise.allSettled(
            candidates.map((specifier) => import(specifier)),
        ).then(() => undefined);
    }
    await driversLoadedPromise;
}

export interface ResolveTurnAgentViaDecisionParams {
    view: RunView;
    system: UserInfo;
    spaceId: string;
    conversationId: string;
    userMessageId: string;
    messageText: string;
    allowedAgentIds: readonly string[];
    conversationHistoryFrom?: Date;
    timeoutMs?: number;
    decisionRunner?: SpaceChatDecisionRunner;
}

export type ResolveTurnAgentViaDecisionResult =
    | { ok: true; agentId: string; outcome: RoutingDecisionOutcome }
    | { ok: false; message: string; outcome?: RoutingDecisionOutcome };

/**
 * Evaluates an unmentioned message in a `MentionOnly` space conversation on the server using
 * MemberJunction's typed routing decision (`AllowNoAgentOption: true`) over `AgentDecisionService`
 * (`AIDecisionRunner` + the `Default Decision` prompt, which selects whichever `Decision` model is
 * configured and credentialed on the host).
 *
 * - If no allowed agent has replied in the visible conversation history yet, refuses immediately.
 * - If no decision model is configured and no test `decisionRunner` is provided, refuses immediately.
 * - If the decision returns `Verdict === 'Routed'` for an allowed participating agent, returns that `agentId`.
 * - If the decision returns `NoAgent` (human-to-human remark), is unsure, or times out, refuses.
 */
export async function resolveTurnAgentViaDecision(
    params: ResolveTurnAgentViaDecisionParams,
): Promise<ResolveTurnAgentViaDecisionResult> {
    const {
        view,
        system,
        spaceId,
        conversationId,
        userMessageId,
        messageText,
        allowedAgentIds,
        conversationHistoryFrom,
        decisionRunner,
    } = params;

    if (allowedAgentIds.length === 0) {
        return { ok: false, message: 'The message does not mention an agent.' };
    }

    if (!decisionRunner && !isDecisionRoutingAvailable()) {
        return { ok: false, message: 'The message does not mention an agent.' };
    }

    // 1. Load catalog metadata for allowed agents (Description, Status, IsRestricted are needed by CollectRoutingParticipants)
    const agentFilter = allowedAgentIds.map((id) => `'${id}'`).join(', ');
    const agentsRes = await view.RunView<RoutingCatalogAgent>({
        EntityName: AGENTS_ENTITY,
        ExtraFilter: `ID IN (${agentFilter})`,
        Fields: ['ID', 'Name', 'Description', 'Status', 'IsRestricted'],
        ResultType: 'simple',
    }, system);
    const catalogAgents: RoutingCatalogAgent[] = (agentsRes.Success ? (agentsRes.Results ?? []) : []).map((a) => ({
        ...a,
        Status: a.Status ?? 'Active',
        Description: a.Description ?? null,
        IsRestricted: a.IsRestricted ?? false,
    }));
    if (catalogAgents.length === 0) {
        return { ok: false, message: 'The message does not mention an agent.' };
    }
    const findAgent = (agentId: string): RoutingCatalogAgent | undefined =>
        catalogAgents.find((a) => UUIDsEqual(a.ID, agentId));

    // 2. Load prior conversation details (excluding the new userMessageId)
    const historyRes = await view.RunView<RoutingHistoryRow & { __mj_CreatedAt?: string | Date | null }>({
        EntityName: DETAILS_ENTITY,
        ExtraFilter: `ConversationID = '${conversationId}' AND ID <> '${userMessageId}'`,
        OrderBy: '__mj_CreatedAt ASC, Sequence ASC, ID ASC',
        Fields: ['ID', 'Role', 'AgentID', 'UserID', 'User', 'ParentID', 'Message', '__mj_CreatedAt'],
        MaxRows: 200,
        ResultType: 'simple',
    }, system);
    if (!historyRes.Success || !historyRes.Results?.length) {
        return { ok: false, message: 'The message does not mention an agent.' };
    }

    const priorRows = historyRes.Results.filter((row) => !UUIDsEqual(row.ID, userMessageId));
    const visibleHistory = conversationHistoryFrom
        ? priorRows.filter((row) => {
              if (!row.__mj_CreatedAt) return true;
              return new Date(row.__mj_CreatedAt).getTime() >= conversationHistoryFrom.getTime();
          })
        : priorRows;

    // 3. Collect participating agents that have already spoken in this conversation
    const participants = CollectRoutingParticipants(visibleHistory, null, allowedAgentIds, findAgent);
    if (participants.length === 0) {
        return { ok: false, message: 'The message does not mention an agent.' };
    }

    // 4. Resolve human speaker names from Space Members so multi-party turns carry display names
    const personNames = new Map<string, string>();
    const membersRes = await view.RunView<{ UserID: string; User?: string | null }>({
        EntityName: SPACE_MEMBERS_ENTITY,
        ExtraFilter: `SpaceID = '${spaceId}' AND Status = 'Active'`,
        Fields: ['UserID', 'User'],
        MaxRows: 500,
        ResultType: 'simple',
    }, system);
    if (membersRes.Success && membersRes.Results) {
        for (const m of membersRes.Results) {
            const uid = parseUuid(m.UserID);
            if (uid && m.User?.trim()) {
                personNames.set(uid.toLowerCase(), m.User.trim());
            }
        }
    }
    const findPersonName = (userId: string): string | undefined => {
        const normalized = parseUuid(userId)?.toLowerCase() ?? userId.trim().toLowerCase();
        return personNames.get(normalized);
    };

    const recentTurns = BuildRecentTurns(visibleHistory, findAgent, findPersonName);
    const recentTurnParts = BuildRecentTurnParts(visibleHistory, findAgent, findPersonName);

    const routingInput: RoutingDecisionInput = {
        Message: messageText,
        ContinuityAgentId: participants[0].Agent.ID,
        Participants: participants,
        ConversationManager: null,
        RecentTurns: recentTurns,
        RecentTurnParts: recentTurnParts,
        ArtifactVersions: [],
        AllowedAgentIDs: allowedAgentIds,
        AllowNoAgentOption: true,
    };

    if (!CanAskRoutingDecision(routingInput)) {
        return { ok: false, message: 'The message does not mention an agent.' };
    }

    const state = BuildRoutingState(routingInput);
    const questions = BuildRoutingQuestions(routingInput);

    // 5. Run the decision through the injected test seam or AgentDecisionService (AIDecisionRunner + Default Decision)
    const timeoutMs = params.timeoutMs ?? SERVER_DECISION_ROUTING_TIMEOUT_MS;
    let decisionAnswers: RoutingDecisionAnswers;
    if (decisionRunner) {
        try {
            decisionAnswers = await decisionRunner({
                state,
                questions,
                timeoutMs,
                input: routingInput,
            });
        } catch (err) {
            decisionAnswers = {
                Success: false,
                ErrorMessage: err instanceof Error ? err.message : String(err),
                Answers: {},
            };
        }
    } else {
        await ensureDecisionDriversLoaded();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const service = new AgentDecisionService();
            const runResult = await service.Ask({
                State: state,
                Questions: questions,
                ContextUser: system,
                CancellationToken: controller.signal,
            });
            decisionAnswers = {
                Success: runResult.success,
                ErrorMessage: runResult.errorMessage,
                Answers: runResult.Answers ?? {},
                ModelName: runResult.modelInfo?.modelName,
                ResolvedModel: runResult.DecisionResult?.ResolvedModel,
                PromptRunID: runResult.promptRun?.ID,
            };
        } catch (err) {
            decisionAnswers = {
                Success: false,
                ErrorMessage: err instanceof Error ? err.message : String(err),
                Answers: {},
            };
        } finally {
            clearTimeout(timer);
        }
    }

    const outcome = InterpretRoutingAnswers(routingInput, decisionAnswers);
    if (outcome.Verdict === 'Routed' && outcome.RoutedAgentId) {
        const routedId = parseUuid(outcome.RoutedAgentId) ?? outcome.RoutedAgentId;
        return { ok: true, agentId: routedId, outcome };
    }

    return { ok: false, message: 'The message does not mention an agent.', outcome };
}
