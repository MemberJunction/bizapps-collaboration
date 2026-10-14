import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, ObjectType, Query, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { getSpaceConfigurationForUser } from '@mj-biz-apps/collaboration-core-entities-server';

@ObjectType()
export class SpaceConfigurationPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;

    /** The `EffectiveSpaceConfiguration` document, as JSON, cut to the caller: their band's grants with bindings removed, or the whole document for staff with the settings authorizations. */
    @Field({ nullable: true })
    ConfigurationJSON?: string;

    @Field()
    CanSeeTeam: boolean;

    /** Whether the caller got the whole document. */
    @Field()
    Full: boolean;
}

/** A space's effective configuration (B16, D30), cut to the caller. */
@Resolver()
export class GetSpaceConfigurationResolver extends ResolverBase {
    @Query(() => SpaceConfigurationPayload)
    async GetSpaceConfiguration(
        @Arg('spaceId', () => String) spaceId: string,
        @Ctx() context: AppContext,
    ): Promise<SpaceConfigurationPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: "Reading a space's configuration requires a signed-in user.", CanSeeTeam: false, Full: false };
        try {
            const outcome = await getSpaceConfigurationForUser(provider, user, spaceId);
            if (!outcome.ok || !outcome.configuration) return { Success: false, ErrorMessage: outcome.message ?? 'Configuration refused.', CanSeeTeam: false, Full: false };
            return { Success: true, ConfigurationJSON: JSON.stringify(outcome.configuration), CanSeeTeam: outcome.canSeeTeam, Full: outcome.full };
        } catch (error) {
            LogError(error);
            return { Success: false, ErrorMessage: 'Configuration refused.', CanSeeTeam: false, Full: false };
        }
    }
}
