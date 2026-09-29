import { LogError } from '@memberjunction/core';
import { Ctx, Field, Int, ObjectType, Query, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { resolveHomeCounts } from '@mj-biz-apps/collaboration-core-entities-server';

@ObjectType()
export class HomeCountsPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;

    @Field(() => Int, { nullable: true })
    SharedFiles?: number;

    @Field(() => Int, { nullable: true })
    OpenTasks?: number;

    @Field(() => Int, { nullable: true })
    AwaitingApproval?: number;
}

/** What Home counts across every space the signed-in person reaches, from one approved MJ query run for them. */
@Resolver()
export class HomeCountsResolver extends ResolverBase {
    @Query(() => HomeCountsPayload)
    async GetHomeCounts(@Ctx() context: AppContext): Promise<HomeCountsPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: "Home's counts need a signed-in user." };
        try {
            const counts = await resolveHomeCounts(provider, user);
            return { Success: true, SharedFiles: counts.sharedFiles, OpenTasks: counts.openTasks, AwaitingApproval: counts.awaitingApproval };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            LogError(`GetHomeCounts failed: ${message}`);
            return { Success: false, ErrorMessage: message };
        }
    }
}
