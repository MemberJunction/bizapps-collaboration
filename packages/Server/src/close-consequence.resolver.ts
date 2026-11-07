import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, ObjectType, Query, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { resolveCloseConsequence } from '@mj-biz-apps/collaboration-core-entities-server';

@ObjectType()
export class CloseConsequencePayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;

    /** The status the close moves the space to (its type's first terminal status), by code and name; null for a type with no statuses. */
    @Field({ nullable: true })
    StatusCode?: string;

    @Field({ nullable: true })
    StatusName?: string;

    /** What that status allows: members read but don't write; the space stays listed; an agent may quote it. */
    @Field({ nullable: true })
    ReadOnly?: boolean;

    @Field({ nullable: true })
    Visible?: boolean;

    @Field({ nullable: true })
    AgentRetrieval?: boolean;

    @Field({ nullable: true })
    KeeperUserID?: string;

    @Field({ nullable: true })
    KeeperName?: string;

    @Field({ nullable: true })
    KeeperCanReopen?: boolean;
}

/** What closing a space would do: the status it moves to and what that allows, who keeps the space once it is hidden, and whether they can reopen it. */
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
                StatusCode: result.status?.Code,
                StatusName: result.status?.Name,
                ReadOnly: result.readOnly,
                Visible: result.visible,
                AgentRetrieval: result.agentRetrieval,
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
