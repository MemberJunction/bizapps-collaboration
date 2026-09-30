import { LogError } from '@memberjunction/core';
import { AgentRunStatusPublisher, Arg, Ctx, Field, InputType, Mutation, ObjectType, PubSub, PubSubEngine, Resolver, ResolverBase, AppContext, GetReadWriteProvider, Int, UserPayload } from '@memberjunction/server';
import { executeSpaceChatTurn, type TurnObserver } from '@mj-biz-apps/collaboration-core-entities-server';
import { turnObserverFrom } from './turn-observer.js';

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
    /** The browser that asked hears the turn on its own session, through MemberJunction's publisher. */
    private observeTurn(pubSub: PubSubEngine, userPayload: UserPayload): TurnObserver | undefined {
        if (!userPayload.sessionId) return undefined;
        return turnObserverFrom(new AgentRunStatusPublisher(pubSub, userPayload));
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
