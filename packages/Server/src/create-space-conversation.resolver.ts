import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { createSpaceConversation } from '@mj-biz-apps/collaboration-core-entities-server';

@InputType()
export class CreateSpaceConversationInput {
    @Field()
    SpaceID: string;

    @Field()
    Name: string;

    @Field({ nullable: true })
    Kind?: string;
}

@ObjectType()
export class CreateSpaceConversationPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ConversationID?: string;

    @Field({ nullable: true })
    SpaceChatID?: string;

    @Field({ nullable: true })
    Name?: string;

    @Field({ nullable: true })
    Kind?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/**
 * Creates a conversation and corresponding space chat inside a space.
 */
@Resolver()
export class CreateSpaceConversationResolver extends ResolverBase {
    @Mutation(() => CreateSpaceConversationPayload)
    async CreateSpaceConversation(
        @Arg('input', () => CreateSpaceConversationInput) input: CreateSpaceConversationInput,
        @Ctx() context: AppContext,
    ): Promise<CreateSpaceConversationPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: 'Creating a conversation requires a signed-in person.' };
        try {
            const kind = (input.Kind === 'Room' || input.Kind === 'General' || input.Kind === 'Topic' || input.Kind === 'Private')
                ? input.Kind
                : undefined;
            const result = await createSpaceConversation(provider, user, {
                SpaceID: input.SpaceID,
                Name: input.Name,
                Kind: kind,
            });
            if (result.ok === false) {
                return { Success: false, ErrorMessage: result.message };
            }
            return {
                Success: true,
                ConversationID: result.conversationId,
                SpaceChatID: result.spaceChatId,
                Name: result.name,
                Kind: result.kind,
            };
        } catch (error) {
            LogError(`CreateSpaceConversation failed for space ${input.SpaceID}: ${error instanceof Error ? error.message : String(error)}`);
            return { Success: false, ErrorMessage: 'Creating conversation failed.' };
        }
    }
}
