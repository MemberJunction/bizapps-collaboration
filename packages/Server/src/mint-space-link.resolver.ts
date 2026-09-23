import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider, configInfo } from '@memberjunction/server';
import { mintSpaceLink } from './mint-space-link.js';

@InputType()
export class MintSpaceLinkInput {
    @Field()
    SpaceID: string;

    @Field()
    Email: string;

    @Field()
    RoleID: string;
}

@ObjectType()
export class MintSpaceLinkPayload {
    @Field()
    Success: boolean;

    @Field()
    Sent: boolean;

    @Field({ nullable: true })
    RedemptionUrl?: string;

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
        const magic = configInfo.magicLink;
        const publicUrl = configInfo.publicUrl || `${configInfo.baseUrl}:${configInfo.graphqlPort}${configInfo.graphqlRootPath || ''}`;
        try {
            const result = await mintSpaceLink({
                provider,
                user,
                spaceId: input.SpaceID,
                email: input.Email,
                roleId: input.RoleID,
                host: {
                    enabled: !!magic?.enabled,
                    publicUrl,
                    restrictedRoleName: magic?.restrictedRoleName || 'Magic Link Baseline',
                    grantableRoleNames: magic?.grantableRoleNames ?? [],
                    inviteIssuerRoleNames: magic?.inviteIssuerRoleNames ?? [],
                    communicationProvider: magic?.communicationProvider,
                    defaultExpiresInHours: magic?.defaultExpiresInHours ?? 72,
                },
            });
            if (!result.ok) return { Success: false, Sent: false, ErrorMessage: result.message };
            return { Success: true, Sent: !!result.sent, RedemptionUrl: result.redemptionUrl, ErrorMessage: result.message };
        } catch (error) {
            LogError(error);
            return { Success: false, Sent: false, ErrorMessage: 'Invite refused.' };
        }
    }
}
