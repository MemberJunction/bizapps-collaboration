import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { LogError } from '@memberjunction/core';
import { MJFileEntity } from '@memberjunction/core-entities';
import { FileStorageEngine } from '@memberjunction/storage';
import { openMode, SPACE_UPLOAD_MAX_BYTES, storedContentType } from '@mj-biz-apps/collaboration-core';
import { collaborationFileStore, decideUploadBand, recordItemUse, requireSystemUser, uploadSpaceFile } from '@mj-biz-apps/collaboration-core-entities-server';
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

@ObjectType()
export class OpenSpaceFilePayload {
    @Field()
    Success: boolean;

    @Field({ nullable: true })
    Base64?: string;

    @Field({ nullable: true })
    MimeType?: string;

    @Field({ nullable: true })
    Mode?: string;

    @Field({ nullable: true })
    Name?: string;

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
            gate: () => decideUploadBand(provider, user, input.SpaceID),
        });
        if ('message' in outcome) {
            return { Success: false, ErrorMessage: outcome.message };
        }
        return { Success: true, ItemID: outcome.itemId, FileID: outcome.fileId };
    }
}

@Resolver()
export class OpenSpaceFileResolver extends ResolverBase {
    @Mutation(() => OpenSpaceFilePayload)
    async OpenSpaceFile(@Arg('itemId', () => String) itemId: string, @Ctx() context: AppContext): Promise<OpenSpaceFilePayload> {
        const provider = GetReadWriteProvider(context.providers);
        const user = this.GetUserFromPayload(context.userPayload);
        const item = await provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(ITEMS, user);
        if (!(await item.Load(itemId))) {
            return { Success: false, ErrorMessage: 'That item is not visible.' };
        }
        const info = provider.EntityByID(item.EntityID);
        if (info?.Name !== 'MJ: Files') {
            return { Success: false, ErrorMessage: 'This item is not a file.' };
        }
        const fileId = item.RecordID.startsWith('ID|') ? item.RecordID.slice(3) : item.RecordID;
        const file = await provider.GetEntityObject<MJFileEntity>('MJ: Files', user);
        if (!(await file.Load(fileId))) {
            return { Success: false, ErrorMessage: 'That file is not visible.' };
        }
        try {
            const system = await requireSystemUser(item);
            await FileStorageEngine.Instance.Config(false, system, provider);
            const accounts = FileStorageEngine.Instance.GetAccountsByProviderID(file.ProviderID);
            const account = accounts[0];
            if (!account) {
                return { Success: false, ErrorMessage: 'The file could not be read from storage.' };
            }
            const driver = await FileStorageEngine.Instance.GetDriver(account.ID, system);
            const path = file.ProviderKey || file.Name;
            const metadata = await driver.GetObjectMetadata({ fullPath: path });
            const maxBytes = configuredMaxBytes();
            if (metadata.size > maxBytes) {
                return { Success: false, ErrorMessage: `Open refused: files are limited to ${maxBytes} bytes.` };
            }
            const recorded = await recordItemUse(item, user, item.ID, item.SpaceID, 'open');
            if (!recorded) {
                return { Success: false, ErrorMessage: 'The open was not recorded.' };
            }
            const bytes = await driver.GetObject({ fullPath: path });
            const mime = storedContentType(file.ContentType);
            return { Success: true, Base64: Buffer.from(bytes).toString('base64'), MimeType: mime, Mode: openMode(mime), Name: file.Name };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            LogError(`OpenSpaceFile failed: ${message}`);
            return { Success: false, ErrorMessage: 'The file could not be read from storage.' };
        }
    }
}

function configuredMaxBytes(): number {
    const raw = Number(process.env.COLLABORATION_UPLOAD_MAX_BYTES);
    return Number.isFinite(raw) && raw > 0 ? raw : SPACE_UPLOAD_MAX_BYTES;
}
