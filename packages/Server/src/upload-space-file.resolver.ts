import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { LogError, type UserInfo } from '@memberjunction/core';
import { FileStorageEngine } from '@memberjunction/storage';
import { uploadSpaceFile, type SpaceFileProvider } from '@mj-biz-apps/collaboration-core-entities-server';

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
 * Opening the file stays on MJ's GetFileContents query, which reads the bytes
 * back through the same storage engine after the file filter allows it.
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
        const outcome = await uploadSpaceFile({
            user,
            provider: provider as unknown as SpaceFileProvider,
            store: {
                async put(upload) {
                    await FileStorageEngine.Instance.Config(false, upload.user, provider);
                    const stored = await FileStorageEngine.Instance.UploadFile({
                        content: Buffer.from(upload.content),
                        fileName: upload.fileName,
                        mimeType: upload.mimeType,
                        contextUser: upload.user,
                        provider,
                    });
                    return { fileId: stored.FileID };
                },
                async remove(fileId, contextUser) {
                    await deleteStoredFile(provider, contextUser, fileId);
                },
            },
            spaceId: input.SpaceID,
            folder: input.Folder ?? null,
            fileName: input.FileName,
            mimeType: input.MimeType,
            content: new Uint8Array(Buffer.from(input.Base64Data ?? '', 'base64')),
        });
        if ('message' in outcome) {
            return { Success: false, ErrorMessage: outcome.message };
        }
        return { Success: true, ItemID: outcome.itemId, FileID: outcome.fileId };
    }
}

async function deleteStoredFile(provider: ReturnType<typeof GetReadWriteProvider>, user: UserInfo, fileId: string): Promise<void> {
    try {
        const file = await provider.GetEntityObject('MJ: Files', user) as unknown as { Load(id: string): Promise<boolean>; Delete(): Promise<boolean> };
        if (await file.Load(fileId)) {
            await file.Delete();
        }
    } catch (error) {
        LogError(`Space file cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
}
