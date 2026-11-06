import { LogError } from '@memberjunction/core';
import {
    AppContext,
    Arg,
    Ctx,
    Field,
    GetReadWriteProvider,
    InputType,
    Mutation,
    ObjectType,
    Resolver,
    ResolverBase,
} from '@memberjunction/server';
import { createSpaceMeeting } from '@mj-biz-apps/collaboration-core-entities-server';

@InputType()
export class CreateSpaceMeetingInput {
    @Field()
    SpaceID: string;

    @Field()
    Name: string;

    @Field()
    StartsAt: string;

    @Field()
    EndsAt: string;

    @Field()
    TimeZone: string;

    @Field({ nullable: true })
    Description?: string;

    @Field({ nullable: true })
    TypeID?: string;

    @Field({ nullable: true })
    LocationType?: string;

    @Field({ nullable: true })
    Location?: string;

    @Field({ nullable: true })
    VideoJoinURL?: string;

    @Field({ nullable: true })
    Visibility?: string;
}

@ObjectType()
export class CreateSpaceMeetingPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    MeetingID?: string;

    @Field({ nullable: true })
    LinkID?: string;

    @Field({ nullable: true })
    ItemID?: string;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/**
 * Schedules a meeting in a space (`MJ_BizApps_Tasks: Meetings` + `MJ_BizApps_Tasks: Meeting Links`)
 * as the system user after checking the caller's space write context, lets `MeetingEntityServer`
 * add the organizer's attendee row, and files a `SpaceItem` as the caller.
 */
@Resolver()
export class CreateSpaceMeetingResolver extends ResolverBase {
    @Mutation(() => CreateSpaceMeetingPayload)
    async CreateSpaceMeeting(
        @Arg('input', () => CreateSpaceMeetingInput) input: CreateSpaceMeetingInput,
        @Ctx() context: AppContext
    ): Promise<CreateSpaceMeetingPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) {
            return {
                Success: false,
                ErrorMessage: 'Meeting scheduling refused: there is no signed-in user.',
            };
        }

        const locationType = (input.LocationType ?? 'Virtual') as
            | 'Virtual'
            | 'InPerson'
            | 'Hybrid'
            | 'Phone';
        const visibility = (input.Visibility ?? 'Standard') as 'Standard' | 'Private';

        try {
            const result = await createSpaceMeeting(provider, user, {
                spaceId: input.SpaceID,
                name: input.Name,
                startsAt: input.StartsAt,
                endsAt: input.EndsAt,
                timeZone: input.TimeZone,
                description: input.Description ?? null,
                typeId: input.TypeID ?? null,
                locationType,
                location: input.Location ?? null,
                videoJoinUrl: input.VideoJoinURL ?? null,
                visibility,
            });
            if (result.ok === false) {
                return { Success: false, ErrorMessage: result.message };
            }
            return {
                Success: true,
                MeetingID: result.meetingId,
                LinkID: result.linkId,
                ItemID: result.itemId ?? undefined,
                Band: result.band,
            };
        } catch (error) {
            LogError(
                `CreateSpaceMeeting failed for space ${input.SpaceID} and user ${user.ID}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return { Success: false, ErrorMessage: 'Meeting scheduling refused.' };
        }
    }
}
