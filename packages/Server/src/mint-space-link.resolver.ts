import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { mintSpaceLink } from './mint-space-link.js';

@InputType()
export class MintSpaceLinkInput {
    @Field()
    SpaceID: string;

    @Field()
    Email: string;
}

@ObjectType()
export class MintSpaceLinkPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    RedemptionUrl?: string;

    @Field({ nullable: true })
    InviteID?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

@Resolver()
export class MintSpaceLinkResolver extends ResolverBase {
    @Mutation(() => MintSpaceLinkPayload)
    async MintSpaceLink(
        @Arg('input', () => MintSpaceLinkInput) input: MintSpaceLinkInput,
        @Ctx() context: AppContext,
    ): Promise<MintSpaceLinkPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        const port = process.env.GRAPHQL_PORT || '4117';
        const publicUrl = process.env.MJAPI_PUBLIC_URL || `http://127.0.0.1:${port}`;
        try {
            const result = await mintSpaceLink({ provider, user, spaceId: input.SpaceID, email: input.Email, publicUrl });
            if (!result.ok) return { Success: false, ErrorMessage: result.message };
            return { Success: true, RedemptionUrl: result.redemptionUrl, InviteID: result.inviteId };
        } catch (error) {
            return { Success: false, ErrorMessage: error instanceof Error ? error.message : 'Link refused.' };
        }
    }
}
