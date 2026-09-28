import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider, Int } from '@memberjunction/server';
import { executeSpaceChatTurn } from '@mj-biz-apps/collaboration-core-entities-server';

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
 * Runs a server turn for an agent on a persisted user message in a space's active Room.
 */
@Resolver()
export class ExecuteSpaceChatTurnResolver extends ResolverBase {
    @Mutation(() => ExecuteSpaceChatTurnPayload)
    async ExecuteSpaceChatTurn(
        @Arg('input', () => ExecuteSpaceChatTurnInput) input: ExecuteSpaceChatTurnInput,
        @Ctx() context: AppContext,
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
