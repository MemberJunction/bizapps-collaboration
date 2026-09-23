import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Resolver, ResolverBase, AppContext, GetReadWriteProvider } from '@memberjunction/server';
import { LogError, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJFileEntity } from '@memberjunction/core-entities';
import { FileStorageEngine } from '@memberjunction/storage';
import { authorizeItemWrite, membershipReaches, openMode, requestedItemBand, SPACE_UPLOAD_MAX_BYTES, storedContentType, type Band } from '@mj-biz-apps/collaboration-core';
import { recordItemUse, requireSystemUser, uploadSpaceFile, loadWriteContext } from '@mj-biz-apps/collaboration-core-entities-server';
import { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceItemEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';

const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const TYPES = 'MJ_BizApps_Collaboration: Space Types';

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
                    return { fileId: stored.FileID, storagePath: stored.StoragePath, accountId: stored.Account.ID };
                },
                async remove(stored, storageUser) {
                    return deleteStoredFile(provider, storageUser, stored);
                },
            },
            spaceId: input.SpaceID,
            folder: input.Folder ?? null,
            fileName: input.FileName,
            mimeType: input.MimeType,
            content: new Uint8Array(Buffer.from(input.Base64Data ?? '', 'base64')),
            maxBytes,
            gate: () => prepareUpload(provider, user, input.SpaceID),
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

async function prepareUpload(provider: IMetadataProvider, user: UserInfo, spaceId: string): Promise<{ ok: true; band: Band } | { ok: false; message: string }> {
    const item = await provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(ITEMS, user);
    const space = await provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACES, user);
    if (!(await space.Load(spaceId))) {
        return { ok: false, message: 'Upload refused: that space is not visible.' };
    }
    const type = await provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(TYPES, user);
    if (!(await type.Load(space.SpaceTypeID))) {
        return { ok: false, message: 'Upload refused: the space type could not be read.' };
    }
    const context = await loadWriteContext(item, user, spaceId, null);
    const reach = membershipReaches(context.spaces, context.memberships, user.ID, spaceId);
    if (!reach) {
        return { ok: false, message: 'Upload refused: the signer does not reach this space.' };
    }
    const requested = requestedItemBand(type.DefaultBand, reach.role.canSeeTeamBand, reach.role.canPromoteBand);
    const decision = authorizeItemWrite({
        callerUserId: user.ID,
        previousSpaceId: null,
        nextSpaceId: spaceId,
        previousBand: null,
        nextBand: requested,
        now: new Date(),
        spaces: context.spaces,
        memberships: context.memberships,
    });
    if ('message' in decision) {
        return { ok: false, message: decision.message };
    }
    return { ok: true, band: decision.band };
}

function configuredMaxBytes(): number {
    const raw = Number(process.env.COLLABORATION_UPLOAD_MAX_BYTES);
    return Number.isFinite(raw) && raw > 0 ? raw : SPACE_UPLOAD_MAX_BYTES;
}

async function deleteStoredFile(
    provider: IMetadataProvider,
    user: UserInfo,
    stored: { fileId: string; storagePath: string; accountId: string },
): Promise<boolean> {
    let objectGone = false;
    try {
        await FileStorageEngine.Instance.Config(false, user, provider);
        const driver = await FileStorageEngine.Instance.GetDriver(stored.accountId, user);
        objectGone = await driver.DeleteObject(stored.storagePath);
    } catch (error) {
        LogError(`Space file cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
    let rowGone = false;
    try {
        const file = await provider.GetEntityObject<MJFileEntity>('MJ: Files', user);
        if (await file.Load(stored.fileId)) {
            rowGone = await file.Delete();
        }
    } catch (error) {
        LogError(`Space file row cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!objectGone || !rowGone) {
        LogError(`Space file cleanup incomplete for ${stored.fileId}: object=${objectGone} row=${rowGone}.`);
    }
    return objectGone && rowGone;
}
