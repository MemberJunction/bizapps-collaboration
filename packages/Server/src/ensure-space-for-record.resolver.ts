import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { ensureSpaceForRecordForUser, parseSpaceDetailsJson } from '@mj-biz-apps/collaboration-core-entities-server';

@InputType()
export class EnsureSpaceForRecordInput {
    /** The space type's code. */
    @Field()
    TypeCode: string;

    /** The anchored record's entity, by name. */
    @Field()
    EntityName: string;

    @Field()
    RecordID: string;

    /** The new space's name, the first time. Absent, the type's name and the record id. */
    @Field({ nullable: true })
    SpaceName?: string;

    /** The anchor's role, for a type whose spaces anchor to more than one record. Default 'primary'. */
    @Field({ nullable: true })
    AnchorRole?: string;

    /** Whether the new space's members come from its parent. Default false (sealed posture). */
    @Field({ nullable: true })
    InheritsMembership?: boolean;

    /** Optional subtype-specific columns as a JSON object string. */
    @Field({ nullable: true })
    Details?: string;
}

@ObjectType()
export class EnsureSpaceForRecordPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/** The space of a type anchored to a record, created the first time (item 85). Needs update rights on the record. */
@Resolver()
export class EnsureSpaceForRecordResolver extends ResolverBase {
    @Mutation(() => EnsureSpaceForRecordPayload)
    async EnsureSpaceForRecord(@Arg('input', () => EnsureSpaceForRecordInput) input: EnsureSpaceForRecordInput, @Ctx() context: AppContext): Promise<EnsureSpaceForRecordPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: 'Opening a space for a record requires a signed-in person.' };
        const parsedDetails = parseSpaceDetailsJson(input.Details);
        if (!parsedDetails.ok) {
            return { Success: false, ErrorMessage: parsedDetails.message };
        }
        try {
            const outcome = await ensureSpaceForRecordForUser(provider, user, {
                TypeCode: input.TypeCode,
                EntityName: input.EntityName,
                RecordID: input.RecordID,
                SpaceName: input.SpaceName,
                AnchorRole: input.AnchorRole,
                InheritsMembership: input.InheritsMembership,
                Details: parsedDetails.details,
            });
            return outcome.ok ? { Success: true, SpaceID: outcome.spaceId } : { Success: false, ErrorMessage: outcome.message ?? 'Space refused.' };
        } catch (error) {
            LogError(`EnsureSpaceForRecord failed: ${error instanceof Error ? error.message : String(error)}`);
            return { Success: false, ErrorMessage: 'The space could not be opened.' };
        }
    }
}
