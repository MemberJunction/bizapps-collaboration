import { RegisterClass } from '@memberjunction/global';
import { BaseAgent } from '@memberjunction/ai-agents';
import type { ExecuteAgentParams, ExecuteAgentResult, MJAIAgentRunEntityExtended } from '@memberjunction/ai-core-plus';
import type { SpaceAgentCandidateItem } from './space-agent-retrieval.js';

/**
 * Deterministic agent driver for Collaboration Space Agent.
 * Answers space chat inquiries deterministically from the retrieved allowed items,
 * allowing integration tests and CI to execute without requiring external LLM model keys.
 */
@RegisterClass(BaseAgent, 'CollaborationSpaceAgentDriver')
export class CollaborationSpaceAgentDriver extends BaseAgent {
    public override async Execute<C = unknown, R = unknown>(
        params: ExecuteAgentParams<C>
    ): Promise<ExecuteAgentResult<R>> {
        const provider = params.provider ?? this.ProviderToUse;
        const system = params.contextUser;
        const data = (params.data ?? {}) as { allowedItems?: readonly SpaceAgentCandidateItem[] };
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
