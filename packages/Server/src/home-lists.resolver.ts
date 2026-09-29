import { LogError } from '@memberjunction/core';
import { Ctx, Field, ObjectType, Query, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { resolveHomeLists } from '@mj-biz-apps/collaboration-core-entities-server';

@ObjectType()
export class HomeInvitationPayload {
    @Field()
    SeatID: string;

    @Field()
    SpaceID: string;

    @Field()
    SpaceName: string;

    @Field()
    Person: string;

    @Field()
    RoleName: string;

    @Field({ nullable: true })
    InvitedAt?: string;
}

@ObjectType()
export class HomeOpenTaskPayload {
    @Field()
    TaskID: string;

    @Field()
    Name: string;

    @Field()
    Status: string;

    @Field({ nullable: true })
    Priority?: string;

    @Field({ nullable: true })
    DueAt?: string;

    @Field()
    SpaceID: string;

    @Field()
    SpaceName: string;
}

@ObjectType()
export class HomeListsPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;

    @Field(() => [HomeInvitationPayload], { nullable: true })
    Invitations?: HomeInvitationPayload[];

    @Field(() => [HomeOpenTaskPayload], { nullable: true })
    OpenTasks?: HomeOpenTaskPayload[];
}

/** The rows behind Home's counts: the invitations waiting and the open tasks across the signed-in person's spaces. */
@Resolver()
export class HomeListsResolver extends ResolverBase {
    @Query(() => HomeListsPayload)
    async GetHomeLists(@Ctx() context: AppContext): Promise<HomeListsPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: "Home's lists need a signed-in user." };
        try {
            const lists = await resolveHomeLists(provider, user);
            return {
                Success: true,
                Invitations: lists.invitations.map((i) => ({ SeatID: i.seatId, SpaceID: i.spaceId, SpaceName: i.spaceName, Person: i.person, RoleName: i.roleName, InvitedAt: i.invitedAt ?? undefined })),
                OpenTasks: lists.openTasks.map((t) => ({ TaskID: t.taskId, Name: t.name, Status: t.status, Priority: t.priority ?? undefined, DueAt: t.dueAt ?? undefined, SpaceID: t.spaceId, SpaceName: t.spaceName })),
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            LogError(`GetHomeLists failed: ${message}`);
            return { Success: false, ErrorMessage: message };
        }
    }
}
