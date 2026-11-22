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

    /** What happened, on success: seated, Invited awaiting approval, already seated, whether a link went out. */
    @Field({ nullable: true })
    Message?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;

    @Field({ nullable: true })
    NotificationFailed?: boolean;

    @Field({ nullable: true })
    TargetApplicationID?: string;
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
        const idpInvites =
            (magic != null && 'idpInvites' in magic && magic.idpInvites === true) ||
            process.env.MAGIC_LINK_IDP_INVITES === 'true' ||
            process.env.COLLABORATION_IDP_INVITES === 'true';
        const publicUrl = configInfo.publicUrl
            || (configInfo.baseUrl
                ? `${configInfo.baseUrl}${configInfo.graphqlPort ? `:${configInfo.graphqlPort}` : ''}${configInfo.graphqlRootPath || ''}`
                : '');
        try {
            const result = await mintSpaceLink({
                provider,
                user,
                spaceId: input.SpaceID,
                email: input.Email,
                roleId: input.RoleID,
                host: {
                    enabled: !!magic?.enabled,
                    idpInvites,
                    publicUrl,
                    restrictedRoleName: magic?.restrictedRoleName || 'Magic Link Baseline',
                    grantableRoleNames: magic?.grantableRoleNames ?? [],
                    inviteIssuerRoleNames: magic?.inviteIssuerRoleNames ?? [],
                    communicationProvider: magic?.communicationProvider,
                    fromAddress: magic?.fromAddress ?? '',
                    defaultExpiresInHours: magic?.defaultExpiresInHours ?? 72,
                    provisioningGuard: magic?.provisioningGuard === 'warn' ? 'warn' : 'block',
                },
            });
            if (!result.ok) return { Success: false, Sent: false, ErrorMessage: result.message };
            return {
                Success: true,
                Sent: !!result.sent,
                RedemptionUrl: result.redemptionUrl,
                Message: result.message,
                NotificationFailed: result.notificationFailed,
                TargetApplicationID: result.targetApplicationId,
            };
        } catch (error) {
            LogError(error);
            return { Success: false, Sent: false, ErrorMessage: 'Invite refused.' };
        }
    }
}
