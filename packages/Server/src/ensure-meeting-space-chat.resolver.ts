import { LogError, RunView } from '@memberjunction/core';
import { NormalizeUUID } from '@memberjunction/global';
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
import { ensureMeetingSpaceChat } from '@mj-biz-apps/collaboration-core-entities-server';

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

@InputType()
export class EnsureMeetingSpaceChatInput {
    @Field()
    SpaceID: string;

    @Field()
    MeetingID: string;

    @Field({ nullable: true })
    MeetingName?: string;

    @Field({ nullable: true })
    Visibility?: string;
}

@ObjectType()
export class EnsureMeetingSpaceChatPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    SpaceChatID?: string;

    @Field({ nullable: true })
    ConversationID?: string;

    @Field({ nullable: true })
    Created?: boolean;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/**
 * Finds or creates a `SpaceChat` (`Subject = 'meeting:<MeetingID>'`) for a meeting in a space.
 */
@Resolver()
export class EnsureMeetingSpaceChatResolver extends ResolverBase {
    @Mutation(() => EnsureMeetingSpaceChatPayload)
    async EnsureMeetingSpaceChat(
        @Arg('input', () => EnsureMeetingSpaceChatInput) input: EnsureMeetingSpaceChatInput,
        @Ctx() context: AppContext
    ): Promise<EnsureMeetingSpaceChatPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (!user) {
            return {
                Success: false,
                ErrorMessage: 'Meeting chat refused: there is no signed-in user.',
            };
        }

        const cleanSpaceId = NormalizeUUID(input.SpaceID);
        const cleanMeetingId = NormalizeUUID(input.MeetingID);
        if (!cleanSpaceId || !UUID.test(cleanSpaceId) || !cleanMeetingId || !UUID.test(cleanMeetingId)) {
            return {
                Success: false,
                ErrorMessage: 'A valid space ID and meeting ID are required.',
            };
        }

        try {
            const view = RunView.FromMetadataProvider(provider);
            const meetingRes = await view.RunView<{
                ID: string;
                Name: string;
                Visibility?: 'Standard' | 'Private';
            }>(
                {
                    EntityName: 'MJ_BizApps_Tasks: Meetings',
                    ExtraFilter: `ID = '${cleanMeetingId}'`,
                    Fields: ['ID', 'Name', 'Visibility'],
                    MaxRows: 1,
                    ResultType: 'simple',
                },
                user
            );
            const meetingRow = meetingRes.Success ? meetingRes.Results?.[0] : undefined;
            if (!meetingRow) {
                return {
                    Success: false,
                    ErrorMessage: 'Meeting chat refused: the meeting was not found, or you may not see it.',
                };
            }

            const meetingName = input.MeetingName?.trim() || meetingRow.Name || 'Meeting Discussion';
            const visibility: 'Standard' | 'Private' =
                meetingRow.Visibility === 'Private' || input.Visibility === 'Private'
                    ? 'Private'
                    : 'Standard';

            const result = await ensureMeetingSpaceChat(provider, {
                spaceId: cleanSpaceId,
                meetingId: cleanMeetingId,
                meetingName,
                visibility,
                contextUser: user,
            });
            if (result.ok === false) {
                return { Success: false, ErrorMessage: result.message };
            }
            return {
                Success: true,
                SpaceChatID: result.spaceChatId,
                ConversationID: result.conversationId,
                Created: result.created,
            };
        } catch (error) {
            LogError(
                `EnsureMeetingSpaceChat failed for space ${input.SpaceID} and meeting ${input.MeetingID}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return { Success: false, ErrorMessage: 'Meeting chat creation failed.' };
        }
    }
}
