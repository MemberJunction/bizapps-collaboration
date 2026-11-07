import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { createSpace } from '@mj-biz-apps/collaboration-core-entities-server';

@InputType()
export class CreateSpaceInput {
    @Field()
    TypeID: string;

    @Field()
    Name: string;

    @Field({ nullable: true })
    Description?: string;

    /** The parent, for a sub-space. Absent for a top-level space. */
    @Field({ nullable: true })
    ParentID?: string;

    /** D22: whether the sub-space's members come from its parent. Read only with a parent; default true. */
    @Field({ nullable: true })
    InheritsMembership?: boolean;

    /** The subtype's own columns, as JSON text: an object of field name to value. */
    @Field({ nullable: true })
    Details?: string;
}

@ObjectType()
export class CreateSpacePayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    SpaceID?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/** Makes a space of a type, top-level or under a parent, and seats the signed-in person as its owner, in one transaction. */
@Resolver()
export class CreateSpaceResolver extends ResolverBase {
    @Mutation(() => CreateSpacePayload)
    async CreateSpace(@Arg('input', () => CreateSpaceInput) input: CreateSpaceInput, @Ctx() context: AppContext): Promise<CreateSpacePayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: 'Creating a space requires a signed-in person.' };
        let details: Record<string, unknown> | null = null;
        if (input.Details) {
            try {
                const parsed: unknown = JSON.parse(input.Details);
                if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
                details = parsed as Record<string, unknown>;
            } catch {
                return { Success: false, ErrorMessage: 'The details must be a JSON object of field names and values.' };
            }
        }
        try {
            const result = await createSpace(provider, user, { TypeID: input.TypeID, Name: input.Name, Description: input.Description, ParentID: input.ParentID ?? null, InheritsMembership: input.InheritsMembership ?? undefined, Details: details });
            return result.status === 'created' ? { Success: true, SpaceID: result.spaceId } : { Success: false, ErrorMessage: result.message };
        } catch (error) {
            // What went wrong is for the log: an unexpected error's own text is not for the browser
            LogError(`CreateSpace failed: ${error instanceof Error ? error.message : String(error)}`);
            return { Success: false, ErrorMessage: 'The space could not be created.' };
        }
    }
}
