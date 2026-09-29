import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, Int, ObjectType, Query, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { resolveCloseConsequence } from '@mj-biz-apps/collaboration-core-entities-server';

@ObjectType()
export class CloseConsequencePayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;

    /** ReadOnly, ReadOnlyWithAgent or None: what the close would stamp on the space. */
    @Field({ nullable: true })
    Access?: string;

    @Field(() => Int, { nullable: true })
    Days?: number;

    @Field({ nullable: true })
    KeeperUserID?: string;

    @Field({ nullable: true })
    KeeperName?: string;

    @Field({ nullable: true })
    KeeperCanReopen?: boolean;
}

/** What closing a space would do: the post-close access it stamps, who keeps the space once its access ends, and whether they can reopen it. */
@Resolver()
export class CloseConsequenceResolver extends ResolverBase {
    @Query(() => CloseConsequencePayload)
    async GetCloseConsequence(
        @Arg('spaceId', () => String) spaceId: string,
        @Ctx() context: AppContext,
    ): Promise<CloseConsequencePayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: 'Reading what closing does requires a signed-in user.' };
        try {
            const result = await resolveCloseConsequence(provider, user, spaceId);
            return {
                Success: true,
                Access: result.access,
                Days: result.days ?? undefined,
                KeeperUserID: result.keeperUserId,
                KeeperName: result.keeperName,
                KeeperCanReopen: result.keeperCanReopen ?? undefined,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            LogError(`GetCloseConsequence failed: ${message}`);
            return { Success: false, ErrorMessage: message };
        }
    }
}
