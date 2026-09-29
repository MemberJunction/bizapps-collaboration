import { LogError } from '@memberjunction/core';
import type { MJAIAgentRunEntity } from '@memberjunction/core-entities';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, PubSub, PubSubEngine, Resolver, ResolverBase, AppContext, GetReadWriteProvider, Int, UserPayload } from '@memberjunction/server';
import { executeSpaceChatTurn, type TurnObserver, type TurnOutcome } from '@mj-biz-apps/collaboration-core-entities-server';

/** The steps MemberJunction's chat shows as live status; the rest of a run's progress is start-up noise. */
const SIGNIFICANT_STEPS: readonly string[] = ['prompt_execution', 'action_execution', 'subagent_execution', 'decision_processing'];

@InputType()
export class ExecuteSpaceChatTurnInput {
    @Field()
    SpaceID: string;

    @Field()
    ConversationID: string;

    @Field()
    UserMessageID: string;

    @Field({ nullable: true })
    AgentID?: string;

    /** Answer once the reply row is written In-Progress; the run goes on, and its progress and text reach this session. */
    @Field({ nullable: true })
    Background?: boolean;
}

@ObjectType()
export class ExecuteSpaceChatTurnPayload {
    @Field()
    Success: boolean;

    @Field(() => [String], { nullable: true })
    ReplyDetailIDs?: string[];

    @Field({ nullable: true })
    AgentRunID?: string;

    @Field(() => Int, { nullable: true })
    QuotedCount?: number;

    @Field(() => [String], { nullable: true })
    AllowedItemNames?: string[];

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/**
 * Runs a server turn for an agent on a persisted user message in a space conversation.
 */
@Resolver()
export class ExecuteSpaceChatTurnResolver extends ResolverBase {
    /**
     * Hands a turn's progress, streamed text and end to the browser that asked, in the messages MemberJunction's own agent
     * resolver publishes on the caller's session: MJ's chat follows the reply row from them, so a space's reply shows the same
     * live status and steps as any other conversation's.
     */
    private observeTurn(pubSub: PubSubEngine, userPayload: UserPayload): TurnObserver {
        const sessionId = userPayload.sessionId;
        if (!sessionId) return {};
        const runRef: { current: MJAIAgentRunEntity | null } = { current: null };
        const publish = (data: Record<string, unknown>): void => {
            this.PublishStatusUpdate(pubSub, sessionId, JSON.stringify({ resolver: 'RunAIAgentResolver', type: data.type === 'progress' ? 'ExecutionProgress' : 'StreamingContent', status: 'ok', data }), userPayload);
        };
        const onProgress: NonNullable<TurnObserver['OnProgress']> = (progress) => {
            const carried = progress.metadata?.agentRun as MJAIAgentRunEntity | undefined;
            if (carried) runRef.current = carried;
            const run = carried ?? runRef.current;
            if (!run || !SIGNIFICANT_STEPS.includes(progress.step)) return;
            publish({
                sessionId,
                agentRunId: run.ID,
                type: 'progress',
                agentRun: run.GetAll(),
                progress: {
                    currentStep: progress.step,
                    percentage: progress.percentage,
                    message: progress.message,
                    agentName: progress.metadata?.agentName as string | undefined,
                    agentType: progress.metadata?.agentType as string | undefined,
                    stepCount: progress.metadata?.stepCount as number | undefined,
                    hierarchicalStep: progress.metadata?.hierarchicalStep as string | undefined,
                },
                timestamp: new Date(),
            });
        };
        const onStreaming: NonNullable<TurnObserver['OnStreaming']> = (chunk) => {
            const run = runRef.current;
            if (!run) return;
            publish({
                sessionId,
                agentRunId: run.ID,
                type: 'streaming',
                agentRun: run.GetAll(),
                streaming: { content: chunk.content, isPartial: !chunk.isComplete, stepName: chunk.stepType, agentName: chunk.modelName, kind: chunk.kind },
                timestamp: new Date(),
            });
        };
        const onFinished = (outcome: TurnOutcome): void => {
            publish({
                sessionId,
                agentRunId: outcome.agentRun?.ID ?? runRef.current?.ID ?? 'unknown',
                type: 'complete',
                timestamp: new Date(),
                conversationDetailId: outcome.replyDetailId,
                success: outcome.success,
                errorMessage: outcome.errorMessage,
            });
        };
        return { OnProgress: onProgress, OnStreaming: onStreaming, OnFinished: onFinished };
    }

    @Mutation(() => ExecuteSpaceChatTurnPayload)
    async ExecuteSpaceChatTurn(
        @Arg('input', () => ExecuteSpaceChatTurnInput) input: ExecuteSpaceChatTurnInput,
        @Ctx() context: AppContext,
        @PubSub() pubSub: PubSubEngine,
    ): Promise<ExecuteSpaceChatTurnPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: 'The chat turn needs a signed-in person.' };
        try {
            const result = await executeSpaceChatTurn(provider, user, {
                spaceId: input.SpaceID,
                conversationId: input.ConversationID,
                userMessageId: input.UserMessageID,
                agentId: input.AgentID,
                // A background turn answers at once, and the run's progress and text reach the browser as they happen
                background: input.Background === true,
                observer: input.Background === true ? this.observeTurn(pubSub, context.userPayload) : undefined,
            });
            if (result.ok === false) {
                return { Success: false, ErrorMessage: result.message };
            }
            return {
                Success: true,
                ReplyDetailIDs: result.replyDetailIds,
                AgentRunID: result.agentRunId,
                QuotedCount: result.quotedCount,
                AllowedItemNames: result.allowedItemNames,
            };
        } catch (error) {
            LogError(`ExecuteSpaceChatTurn failed for space ${input.SpaceID} and message ${input.UserMessageID}: ${error instanceof Error ? error.message : String(error)}`);
            return { Success: false, ErrorMessage: 'The turn was refused.' };
        }
    }
}
