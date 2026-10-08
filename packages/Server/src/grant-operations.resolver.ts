import { LogError } from '@memberjunction/core';
import { Arg, Ctx, Field, InputType, Int, Mutation, ObjectType, Query, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { getSpaceDashboard, runSpaceQuery, runSpaceView, type ClientValues } from '@mj-biz-apps/collaboration-core-entities-server';

@InputType()
export class GrantRunInput {
    @Field()
    SpaceID: string;

    @Field()
    GrantID: string;

    /** The target's own (unbound) parameters or properties, as a JSON object. A value for a bound name is refused. */
    @Field({ nullable: true })
    ValuesJSON?: string;
}

@ObjectType()
export class GrantRunRowsPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;

    /** The rows, as a JSON array. */
    @Field({ nullable: true })
    RowsJSON?: string;

    @Field(() => Int, { nullable: true })
    RowCount?: number;
}

@ObjectType()
export class SpaceDashboardPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;

    @Field({ nullable: true })
    DashboardID?: string;

    /** The bound property values, as a JSON object. */
    @Field({ nullable: true })
    PropertiesJSON?: string;
}

function parseValues(raw: string | undefined): { ok: true; values: ClientValues | null } | { ok: false; message: string } {
    if (!raw) return { ok: true, values: null };
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, message: 'Run refused: the values must be a JSON object of names and values.' };
        for (const value of Object.values(parsed as Record<string, unknown>)) {
            if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) return { ok: false, message: 'Run refused: each value must be a string, a number, a boolean or null.' };
        }
        return { ok: true, values: parsed as ClientValues };
    } catch {
        return { ok: false, message: 'Run refused: the values are not valid JSON.' };
    }
}

/** The grant operations (B17, D29), over GraphQL. */
@Resolver()
export class GrantOperationsResolver extends ResolverBase {
    @Mutation(() => GrantRunRowsPayload)
    async RunSpaceView(@Arg('input', () => GrantRunInput) input: GrantRunInput, @Ctx() context: AppContext): Promise<GrantRunRowsPayload> {
        return this.rows(input, context, 'view', (request) => runSpaceView(request));
    }

    @Mutation(() => GrantRunRowsPayload)
    async RunSpaceQuery(@Arg('input', () => GrantRunInput) input: GrantRunInput, @Ctx() context: AppContext): Promise<GrantRunRowsPayload> {
        return this.rows(input, context, 'query', (request) => runSpaceQuery(request));
    }

    @Query(() => SpaceDashboardPayload)
    async GetSpaceDashboard(@Arg('spaceId', () => String) spaceId: string, @Arg('grantId', () => String) grantId: string, @Ctx() context: AppContext): Promise<SpaceDashboardPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: 'Running a grant requires a signed-in person.' };
        try {
            // This package compiles without strictNullChecks, so the outcome's union is read through a cast rather than narrowed
            const outcome = (await getSpaceDashboard({ provider, user, spaceId, grantId })) as { ok: boolean; message?: string; dashboardId?: string; properties?: Record<string, unknown> };
            if (!outcome.ok) return { Success: false, ErrorMessage: outcome.message ?? 'Run refused.' };
            return { Success: true, DashboardID: outcome.dashboardId, PropertiesJSON: JSON.stringify(outcome.properties ?? {}) };
        } catch (error) {
            LogError(`GetSpaceDashboard failed: ${error instanceof Error ? error.message : String(error)}`);
            return { Success: false, ErrorMessage: 'Run refused.' };
        }
    }

    private async rows(input: GrantRunInput, context: AppContext, what: string, run: (request: Parameters<typeof runSpaceView>[0]) => ReturnType<typeof runSpaceView>): Promise<GrantRunRowsPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) return { Success: false, ErrorMessage: 'Running a grant requires a signed-in person.' };
        const values = parseValues(input.ValuesJSON) as { ok: boolean; message?: string; values?: ClientValues | null };
        if (!values.ok) return { Success: false, ErrorMessage: values.message ?? 'Run refused.' };
        try {
            const outcome = (await run({ provider, user, spaceId: input.SpaceID, grantId: input.GrantID, clientValues: values.values ?? null })) as { ok: boolean; message?: string; rows?: Record<string, unknown>[]; rowCount?: number };
            if (!outcome.ok) return { Success: false, ErrorMessage: outcome.message ?? 'Run refused.' };
            return { Success: true, RowsJSON: JSON.stringify(outcome.rows ?? []), RowCount: outcome.rowCount ?? 0 };
        } catch (error) {
            LogError(`Run of a ${what} grant failed: ${error instanceof Error ? error.message : String(error)}`);
            return { Success: false, ErrorMessage: 'Run refused.' };
        }
    }
}
