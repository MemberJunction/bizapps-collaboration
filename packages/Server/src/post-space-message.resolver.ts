import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { postSpaceMessage } from '@mj-biz-apps/collaboration-core-entities-server';

@InputType()
export class PostSpaceMessageInput {
    @Field()
    SpaceID: string;

    @Field()
    Text: string;

    @Field({ nullable: true })
    ExecuteAgent?: boolean;
}

@ObjectType()
export class PostSpaceMessagePayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    DetailID?: string;

    @Field({ nullable: true })
    AssistantDetailID?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/**
 * Adds a human message to the space's conversation. The row is written as
 * the system user and names the caller. If ExecuteAgent is true, invokes the
 * Collaboration Space Agent server-side.
 */
@Resolver()
export class PostSpaceMessageResolver extends ResolverBase {
    @Mutation(() => PostSpaceMessagePayload)
    async PostSpaceMessage(
        @Arg('input', () => PostSpaceMessageInput) input: PostSpaceMessageInput,
        @Ctx() context: AppContext,
    ): Promise<PostSpaceMessagePayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: 'The message needs a signed-in person.' };
        try {
            const result = await postSpaceMessage(provider, user, {
                spaceId: input.SpaceID,
                text: input.Text ?? '',
                executeAgent: input.ExecuteAgent,
            });
            if (result.ok === false) return { Success: false, ErrorMessage: result.message };
            return {
                Success: true,
                DetailID: result.detailId,
                AssistantDetailID: result.assistantDetailId,
            };
        } catch (error) {
            LogError(`PostSpaceMessage failed for space ${input.SpaceID} and user ${user.ID}: ${error instanceof Error ? error.message : String(error)}`);
            return { Success: false, ErrorMessage: 'The message was refused.' };
        }
    }
}
