import { Arg, Ctx, Field, InputType, Int, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { type Band, type NoteVisibility } from '@mj-biz-apps/collaboration-core';
import { promoteSpaceNoteToDoc } from '@mj-biz-apps/collaboration-core-entities-server';

@InputType()
export class PromoteSpaceNoteToDocInput {
    @Field()
    SpaceID: string;

    @Field({ nullable: true })
    NoteID?: string;

    @Field({ nullable: true })
    Title?: string;

    @Field({ nullable: true })
    Body?: string;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    Visibility?: string;

    @Field({ nullable: true })
    Folder?: string;
}

@ObjectType()
export class PromoteSpaceNoteToDocPayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    SpaceItemID?: string;

    @Field({ nullable: true })
    ArtifactID?: string;

    @Field({ nullable: true })
    VersionID?: string;

    @Field(() => Int, { nullable: true })
    VersionNumber?: number;

    @Field({ nullable: true })
    Title?: string;

    @Field({ nullable: true })
    Band?: string;

    @Field({ nullable: true })
    Visibility?: string;

    @Field({ nullable: true })
    Folder?: string;

    @Field({ nullable: true })
    DelegateEntityID?: string;

    @Field({ nullable: true })
    DelegateRecordID?: string;

    @Field({ nullable: true })
    ArtifactTypeName?: string;

    @Field({ nullable: true })
    ContentMode?: string;

    @Field({ nullable: true })
    SourceNoteID?: string;

    @Field({ nullable: true })
    ErrorCode?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/**
 * Promotes a SpaceNote ("Turn into document") into a native, editable `MJ: Artifacts`
 * (`Markdown Document`) + v1 `MJ: Artifact Versions` + `SpaceItem` with fail-closed
 * `DelegateEntityID` / `DelegateRecordID` permission delegation via `promoteSpaceNoteToDoc`.
 */
@Resolver()
export class PromoteSpaceNoteToDocResolver extends ResolverBase {
    @Mutation(() => PromoteSpaceNoteToDocPayload)
    async PromoteSpaceNoteToDoc(
        @Arg('input', () => PromoteSpaceNoteToDocInput) input: PromoteSpaceNoteToDocInput,
        @Ctx() context: AppContext,
    ): Promise<PromoteSpaceNoteToDocPayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);

        if (input.Band != null && input.Band !== 'Team' && input.Band !== 'Shared') {
            return {
                Success: false,
                ErrorCode: 'INVALID_INPUT',
                ErrorMessage: 'Promotion refused: Band must be Team or Shared.',
            };
        }
        if (input.Visibility != null && input.Visibility !== 'Space' && input.Visibility !== 'Private') {
            return {
                Success: false,
                ErrorCode: 'INVALID_INPUT',
                ErrorMessage: 'Promotion refused: Visibility must be Space or Private.',
            };
        }

        const resolvedBand: Band = input.Band === 'Shared' ? 'Shared' : 'Team';
        const resolvedVisibility: NoteVisibility = input.Visibility === 'Private' ? 'Private' : 'Space';
        const trimmedNoteId = (input.NoteID ?? '').trim();

        const outcome = await promoteSpaceNoteToDoc({
            provider,
            callerUser: user,
            spaceId: input.SpaceID,
            ...(trimmedNoteId ? { noteId: trimmedNoteId } : {
                note: {
                    SpaceID: input.SpaceID,
                    Title: input.Title ?? null,
                    Body: input.Body ?? null,
                    Band: resolvedBand,
                    Visibility: resolvedVisibility,
                    AuthorUserID: user.ID,
                },
            }),
            ...(input.Folder !== undefined ? { folder: input.Folder } : {}),
        });

        if ('code' in outcome) {
            return {
                Success: false,
                ErrorCode: outcome.code,
                ErrorMessage: outcome.message,
            };
        }

        const doc = outcome.data;
        return {
            Success: true,
            SpaceItemID: doc.spaceItemId,
            ArtifactID: doc.artifactId,
            VersionID: doc.versionId,
            VersionNumber: doc.versionNumber,
            Title: doc.title,
            Band: doc.band,
            Visibility: doc.visibility,
            Folder: doc.folder ?? undefined,
            DelegateEntityID: doc.delegateEntityId,
            DelegateRecordID: doc.delegateRecordId,
            ArtifactTypeName: doc.artifactTypeName,
            ContentMode: doc.contentMode,
            SourceNoteID: doc.sourceNoteId ?? undefined,
        };
    }
}
