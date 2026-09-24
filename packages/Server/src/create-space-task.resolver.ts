import { LogError, type IMetadataProvider } from '@memberjunction/core';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { createSpaceTask } from '@mj-biz-apps/collaboration-core-entities-server';
import type { Band } from '@mj-biz-apps/collaboration-core';

@InputType()
export class CreateSpaceTaskInput {
    @Field()
    SpaceID: string;

    @Field()
    Name: string;

    @Field()
    Band: string;
}

@ObjectType()
export class CreateSpaceTaskPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    TaskID?: string;

    @Field({ nullable: true })
    ItemID?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/**
 * Files a new root task in one space. The task is created as the system user
 * and the space item is the caller's, which is the only way a participant
 * gets a parentless task.
 */
@Resolver()
export class CreateSpaceTaskResolver extends ResolverBase {
    @Mutation(() => CreateSpaceTaskPayload)
    async CreateSpaceTask(
        @Arg('input', () => CreateSpaceTaskInput) input: CreateSpaceTaskInput,
        @Ctx() context: AppContext,
    ): Promise<CreateSpaceTaskPayload> {
        const band: Band | null = input.Band === 'Team' || input.Band === 'Shared' ? input.Band : null;
        const name = (input.Name ?? '').trim();
        if (!band || !name) return { Success: false, ErrorMessage: 'Task filing refused: the task needs a name and a band.' };
        const provider = GetReadWriteProvider(context.providers) as unknown as IMetadataProvider;
        const user = this.GetUserFromPayload(context.userPayload);
        try {
            const result = await createSpaceTask(provider, user, { spaceId: input.SpaceID, name, band });
            if (result.ok === false) return { Success: false, ErrorMessage: result.message };
            return { Success: true, TaskID: result.taskId, ItemID: result.itemId };
        } catch (error) {
            LogError(error);
            return { Success: false, ErrorMessage: 'Task filing refused.' };
        }
    }
}
