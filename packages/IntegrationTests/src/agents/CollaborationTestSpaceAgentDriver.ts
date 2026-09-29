import { RegisterClass } from '@memberjunction/global';
import { BaseAgent } from '@memberjunction/ai-agents';
import { COLLABORATION_TEST_AGENT_DRIVER_CLASS } from './test-agent.js';
import type { ExecuteAgentParams, ExecuteAgentResult, MJAIAgentRunEntityExtended } from '@memberjunction/ai-core-plus';

/** The items the space chat turn hands an agent: what its audience may quote. */
interface AllowedItem {
    readonly Name: string;
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
        const data = (params.data ?? {}) as { allowedItems?: readonly AllowedItem[] };
        const allowedItems = data.allowedItems ?? [];

        let replyText: string;
        if (allowedItems.length > 0) {
            const list = allowedItems.map((item) => `- ${item.Name}`).join('\n');
            replyText = `Here are the available materials in this space:\n${list}`;
        } else {
            replyText = 'I found no shared materials in this space.';
        }

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

        return {
            success: true,
            agentRun: run,
            payload: replyText as R,
            errorMessage: undefined,
        };
    }
}
