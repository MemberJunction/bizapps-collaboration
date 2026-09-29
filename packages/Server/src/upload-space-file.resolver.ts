import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { SPACE_UPLOAD_MAX_BYTES, type Band } from '@mj-biz-apps/collaboration-core';
import { collaborationFileStore, decideUploadBand, requireSystemUser, uploadSpaceFile } from '@mj-biz-apps/collaboration-core-entities-server';
import { mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';

const ITEMS = 'MJ_BizApps_Collaboration: Space Items';

@InputType()
export class UploadSpaceFileInput {
    @Field()
    SpaceID: string;

    @Field()
    FileName: string;

    @Field()
    MimeType: string;

    @Field()
    Base64Data: string;

    @Field({ nullable: true })
    Folder?: string;

    /** Shared or Team: the band the person chose. Left out, the space type's default applies. */
    @Field({ nullable: true })
    Band?: string;
}

@ObjectType()
export class UploadSpaceFilePayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    ItemID?: string;

    @Field({ nullable: true })
    FileID?: string;

    @Field({ nullable: true })
    ErrorMessage?: string;
}

/**
 * Creates the MJ: Files row through MJStorage and the space item in one call.
 * The caller is authorized before any bytes move. The file is stored as the
 * system user. Opening the file stays on MJ's GetFileContents query.
 */
@Resolver()
export class UploadSpaceFileResolver extends ResolverBase {
    @Mutation(() => UploadSpaceFilePayload)
    async UploadSpaceFile(
        @Arg('input', () => UploadSpaceFileInput) input: UploadSpaceFileInput,
        @Ctx() context: AppContext,
    ): Promise<UploadSpaceFilePayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        if (input.Band != null && input.Band !== 'Shared' && input.Band !== 'Team') {
            return { Success: false, ErrorMessage: 'Upload refused: the band must be Shared or Team.' };
        }
        const chosenBand: Band | null = input.Band === 'Shared' || input.Band === 'Team' ? input.Band : null;
        const maxBytes = configuredMaxBytes();
        if ((input.Base64Data?.length ?? 0) > Math.ceil(maxBytes * 4 / 3) + 8) {
            return { Success: false, ErrorMessage: `Upload refused: files are limited to ${maxBytes} bytes.` };
        }
        const probe = await provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(ITEMS, user);
        const system = await requireSystemUser(probe);
        const outcome = await uploadSpaceFile({
            user,
            storageUser: system,
            provider,
            store: collaborationFileStore(provider),
            spaceId: input.SpaceID,
            folder: input.Folder ?? null,
            fileName: input.FileName,
            mimeType: input.MimeType,
            content: new Uint8Array(Buffer.from(input.Base64Data ?? '', 'base64')),
            maxBytes,
            gate: () => decideUploadBand(provider, user, input.SpaceID, chosenBand),
        });
        if ('message' in outcome) {
            return { Success: false, ErrorMessage: outcome.message };
        }
        return { Success: true, ItemID: outcome.itemId, FileID: outcome.fileId };
    }
}

function configuredMaxBytes(): number {
    const raw = Number(process.env.COLLABORATION_UPLOAD_MAX_BYTES);
    return Number.isFinite(raw) && raw > 0 ? raw : SPACE_UPLOAD_MAX_BYTES;
}
