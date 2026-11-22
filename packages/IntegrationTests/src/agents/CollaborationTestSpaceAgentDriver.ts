import { RegisterClass } from '@memberjunction/global';
import { RunView, WellKnownUserSource } from '@memberjunction/core';
import { BaseAgent } from '@memberjunction/ai-agents';
import { ActionEngineServer } from '@memberjunction/actions';
import type { ActionParam } from '@memberjunction/actions-base';
import { COLLABORATION_TEST_AGENT_DRIVER_CLASS } from './test-agent.js';
import type {
    ActionChange,
    ExecuteAgentParams,
    ExecuteAgentResult,
    MJAIAgentRunEntityExtended,
    MJAIAgentRunStepEntityExtended,
    MJAIPromptRunEntityExtended,
} from '@memberjunction/ai-core-plus';
import type { mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';

/** The items the space chat turn hands an agent: what its audience may quote. */
interface AllowedItem {
    readonly Name: string;
    readonly EntityName?: string | null;
    readonly Status?: mjBizAppsTasksTaskEntity['Status'] | null;
    readonly Priority?: mjBizAppsTasksTaskEntity['Priority'] | null;
    readonly DueAt?: string | null;
    readonly PercentComplete?: number | null;
    readonly Assignees?: readonly string[];
    readonly ChunkTexts?: readonly string[];
}

/** A query or view the turn says Run space data may run (B20). */
interface SpaceDataGrant {
    readonly Name: string;
    readonly Parameters: readonly string[];
}

/** The name of the one action an agent runs granted data through, as `metadata/actions/` ships it. */
const RUN_SPACE_DATA = 'Collaboration: Run Space Data';

/**
 * The stub reads a request to run data off the message: `run "<Name>"`, with `with {"Param": value}` after it when the target
 * takes parameters. A model would decide this; the stub does what it is told, so the checks can see the action path end to end.
 */
function dataRequestIn(text: string): { name: string; values: string | null } | null {
    const match = /run\s+"([^"]+)"(?:\s+with\s+(\{.*\}))?/i.exec(text);
    return match ? { name: match[1], values: match[2] ?? null } : null;
}

/**
 * Deterministic agent driver for the harness's own test agent (see `test-agent.ts`).
 * It answers a space chat turn from the items the turn allowed, so the checks run without a
 * model key. It lives here, not in a shipped package, and no shipped agent row points at it.
 */
@RegisterClass(BaseAgent, COLLABORATION_TEST_AGENT_DRIVER_CLASS)
export class CollaborationTestSpaceAgentDriver extends BaseAgent {
    public override async Execute<C = unknown, R = unknown>(
        params: ExecuteAgentParams<C>
    ): Promise<ExecuteAgentResult<R>> {
        const provider = params.provider ?? this.ProviderToUse;
        const system = params.contextUser;
        const data = (params.data ?? {}) as { allowedItems?: readonly AllowedItem[]; spaceData?: readonly SpaceDataGrant[]; knowledgeSourceIds?: readonly string[]; typeInstructions?: readonly string[] };
        const allowedItems = data.allowedItems ?? [];

        let replyText: string;
        if (allowedItems.length > 0) {
            const list = allowedItems
                .map((item) => {
                    const chunks = (item.ChunkTexts ?? []).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
                    const chunkSuffix = chunks.length > 0 ? `: ${chunks.join(' | ')}` : '';
                    if (item.EntityName === 'MJ_BizApps_Tasks: Tasks') {
                        const owners = item.Assignees && item.Assignees.length > 0 ? item.Assignees.join(', ') : 'Unassigned';
                        const parts = [`Status: ${item.Status ?? 'Open'}`];
                        if (item.Priority) parts.push(`Priority: ${item.Priority}`);
                        parts.push(`Owner: ${owners}`);
                        if (item.DueAt) parts.push(`Due: ${item.DueAt}`);
                        return `- ${item.Name} [${parts.join(' | ')}]${chunkSuffix}`;
                    }
                    return `- ${item.Name}${chunkSuffix}`;
                })
                .join('\n');
            replyText = `Here are the available materials in this space:\n${list}`;
        } else {
            replyText = 'I found no shared materials in this space.';
        }
        // B20: say what the turn gave, so a check can read it off the reply the way a person would read a model's
        const added = (params.actionChanges ?? []).filter((change: ActionChange) => change.mode === 'add').flatMap((change: ActionChange) => change.actionIds);
        const spaceData = data.spaceData ?? [];
        replyText += `\nTools: ${added.length ? added.join(', ') : 'none'}`;
        replyText += `\nData: ${spaceData.length ? spaceData.map((g) => g.Name).join(', ') : 'none'}`;
        replyText += `\nKnowledge: ${data.knowledgeSourceIds?.length ? data.knowledgeSourceIds.join(', ') : 'none'}`;
        replyText += `\nType: ${data.typeInstructions?.length ? data.typeInstructions.join(' | ') : 'none'}`;

        const run = await provider.GetEntityObject<MJAIAgentRunEntityExtended>('MJ: AI Agent Runs', system);
        run.NewRecord();
        run.AgentID = params.agent.ID;
        const userId = params.userId ?? params.contextUser?.ID;
        if (userId) {
            run.UserID = userId;
        }
        run.ConversationID = params.conversationId ?? null;
        run.ExternalReferenceID = params.conversationDetailId ?? null;
        run.Status = 'Completed';
        run.Message = replyText;
        run.StartedAt = new Date();
        run.CompletedAt = new Date();
        run.Success = true;
        const saved = await run.Save();
        if (!saved) {
            throw new Error(`Failed to save AI Agent Run for agent ${params.agent.ID}`);
        }

        if (typeof params.onAgentRunCreated === 'function') {
            await params.onAgentRunCreated(run.ID);
        }

        // Asked to run granted data, the stub calls Run space data the way the agent framework would: with the run's context,
        // as the caller, after the run exists so the log row names it
        const lastUser = [...(params.conversationMessages ?? [])].reverse().find((m) => m.role === 'user');
        const request = dataRequestIn(typeof lastUser?.content === 'string' ? lastUser.content : '');
        if (request && system) {
            const engine = ActionEngineServer.Instance;
            await engine.Config(false, system, provider);
            const action = engine.Actions.find((a) => a.Name === RUN_SPACE_DATA);
            if (!action) {
                replyText += `\nRun space data: the action is not registered on this host.`;
            } else {
                const actionParams: ActionParam[] = [{ Name: 'Name', Type: 'Input', Value: request.name }];
                if (request.values) actionParams.push({ Name: 'Values', Type: 'Input', Value: request.values });
                const result = await engine.RunAction({ Action: action, ContextUser: system, Params: actionParams, Filters: [], Context: params.context, Provider: provider });
                replyText += `\nRun space data: ${result.Success ? 'ok' : 'refused'}: ${result.Message ?? ''}`;
            }
            run.Message = replyText;
            if (!(await run.Save())) {
                throw new Error(`Failed to update AI Agent Run ${run.ID} after running space data`);
            }
        }

        // Persist and update legitimate MJ: AI Prompt Runs and MJ: AI Agent Run Steps records
        // as the acting caller inside the server-orchestrated Space Chat Turn authority scope.
        const lookupUser = (system ? await WellKnownUserSource.Instance.GetSystemUser(provider) : null) ?? system;
        if (system && lookupUser) {
            const rv = RunView.FromMetadataProvider(provider);
            const [promptsRes, modelsRes, vendorsRes] = await Promise.all([
                rv.RunView<{ ID: string }>({ EntityName: 'MJ: AI Prompts', Fields: ['ID'], MaxRows: 1, ResultType: 'simple' }, lookupUser),
                rv.RunView<{ ID: string }>({ EntityName: 'MJ: AI Models', Fields: ['ID'], MaxRows: 1, ResultType: 'simple' }, lookupUser),
                rv.RunView<{ ID: string }>({ EntityName: 'MJ: AI Vendors', Fields: ['ID'], MaxRows: 1, ResultType: 'simple' }, lookupUser),
            ]);
            const promptId = promptsRes.Success ? promptsRes.Results?.[0]?.ID : undefined;
            const modelId = modelsRes.Success ? modelsRes.Results?.[0]?.ID : undefined;
            const vendorId = vendorsRes.Success ? vendorsRes.Results?.[0]?.ID : undefined;
            if (promptId && modelId && vendorId) {
                const promptRun = await provider.GetEntityObject<MJAIPromptRunEntityExtended>('MJ: AI Prompt Runs', system);
                promptRun.NewRecord();
                promptRun.PromptID = promptId;
                promptRun.ModelID = modelId;
                promptRun.VendorID = vendorId;
                promptRun.AgentID = params.agent.ID;
                promptRun.RunAt = new Date();
                promptRun.Success = false;
                promptRun.RunType = 'Single';
                promptRun.Messages = JSON.stringify([{ role: 'user', content: 'Space Chat Test Stub prompt' }]);
                if (!(await promptRun.Save())) {
                    throw new Error(`Failed to save AI Prompt Run for agent ${params.agent.ID}: ${promptRun.LatestResult?.CompleteMessage ?? ''}`);
                }

                const step = await provider.GetEntityObject<MJAIAgentRunStepEntityExtended>('MJ: AI Agent Run Steps', system);
                step.NewRecord();
                step.AgentRunID = run.ID;
                step.StepNumber = 1;
                step.StepType = 'Prompt';
                step.StepName = 'Space Chat Test Stub Prompt';
                step.TargetID = promptId;
                step.TargetLogID = promptRun.ID;
                step.Status = 'Running';
                step.StartedAt = new Date();
                if (!(await step.Save())) {
                    throw new Error(`Failed to save AI Agent Run Step for run ${run.ID}: ${step.LatestResult?.CompleteMessage ?? ''}`);
                }

                promptRun.CompletedAt = new Date();
                promptRun.Success = true;
                promptRun.Result = replyText;
                if (!(await promptRun.Save())) {
                    throw new Error(`Failed to update AI Prompt Run ${promptRun.ID}: ${promptRun.LatestResult?.CompleteMessage ?? ''}`);
                }

                step.Status = 'Completed';
                step.CompletedAt = new Date();
                step.Success = true;
                step.OutputData = JSON.stringify({ replyText });
                if (!(await step.Save())) {
                    throw new Error(`Failed to update AI Agent Run Step ${step.ID}: ${step.LatestResult?.CompleteMessage ?? ''}`);
                }
            }
        }

        return {
            success: true,
            agentRun: run,
            payload: replyText as R,
            errorMessage: undefined,
        };
    }
}
