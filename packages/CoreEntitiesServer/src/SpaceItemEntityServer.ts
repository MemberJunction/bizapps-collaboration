import { BaseEntity, CompositeKey, LogError, RunView, ValidationErrorInfo, ValidationErrorType, type IMetadataProvider, type UserInfo, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { MJFileEntity } from '@memberjunction/core-entities';
import { FileStorageEngine } from '@memberjunction/storage';
import { authorizeItemWrite, type Band } from '@mj-biz-apps/collaboration-core';
import { recordItemUse, recordShare } from './library-events.js';
import { mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
import {
    mjBizAppsCollaborationItemUseEntity,
    mjBizAppsCollaborationShareNoticeEntity,
    mjBizAppsCollaborationSpaceItemEntity,
} from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext, requireSystemUser } from './load-graph.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Items';

/** The item object this upload created. Another request's item cannot match it. */
const vouchedItems = new WeakSet<object>();

export function vouchStoredFile(item: object): void {
    vouchedItems.add(item);
}

export function releaseStoredFile(item: object): void {
    vouchedItems.delete(item);
}

@RegisterClass(BaseEntity, ENTITY)
export class SpaceItemEntityServer extends mjBizAppsCollaborationSpaceItemEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const caller = callerUuid(user);
        const spaceId = parseUuid(this.SpaceID);
        if (!user || !caller || !spaceId) {
            return fail(result, 'Item change refused: the signer and the space must be real ids.');
        }
        const filesEntity = asMetadata(this.ProviderToUse)?.EntityByName('MJ: Files');
        const isFile = !!filesEntity && !!this.EntityID && this.EntityID.toLowerCase() === filesEntity.ID.toLowerCase();
        if (isFile) {
            const isNewFilePointer = !this.IsSaved || this.Fields.some((f) => f.Dirty && (f.Name === 'EntityID' || f.Name === 'RecordID'));
            if (isNewFilePointer && !vouchedItems.has(this)) {
                return fail(result, 'Item change refused: file items must be created through space upload.');
            }
        }
        const previousRaw = this.Fields.find((field) => field.Name === 'SpaceID')?.OldValue as string | null | undefined;
        const previousSpace = previousRaw ? parseUuid(String(previousRaw)) : null;
        if (previousRaw && !previousSpace) {
            return fail(result, 'Item change refused: the saved space id is not valid.');
        }
        const previousBand = this.Fields.find((field) => field.Name === 'Band')?.OldValue as Band | null | undefined;
        let context;
        try {
            context = await loadWriteContext(this, user, spaceId, null);
        } catch (error) {
            return fail(result, error instanceof Error ? error.message : 'Item change refused: the space could not be read completely.');
        }
        let spaces = context.spaces;
        if (previousSpace && previousSpace !== spaceId && parseUuid(previousSpace)) {
            try {
                const previous = await loadWriteContext(this, user, previousSpace, null);
                spaces = [...spaces, ...previous.spaces.filter((space) => !spaces.some((have) => have.id === space.id))];
                context.memberships.push(...previous.memberships);
            } catch (error) {
                return fail(result, error instanceof Error ? error.message : 'Item change refused: the previous space could not be read.');
            }
        }
        const decision = authorizeItemWrite({
            callerUserId: caller,
            previousSpaceId: this.IsSaved ? (previousSpace ?? spaceId) : null,
            nextSpaceId: spaceId,
            previousBand: this.IsSaved ? (previousBand ?? this.Band) : null,
            nextBand: this.Band,
            now: new Date(),
            spaces,
            memberships: context.memberships,
        });
        if (!decision.ok) {
            return fail(result, decision.message);
        }
        const canonical = canonicalRecordId(this);
        if (canonical) {
            this.RecordID = canonical;
        }
        const readable = await callerCanReadTarget(this, user);
        if (!readable) {
            return fail(result, 'Item change refused: the signer cannot read the record this item points at.');
        }
        const parented = await filedTaskHasParent(this, user);
        if (parented) {
            return fail(result, 'Item change refused: a subtask cannot be filed as a space root.');
        }
        this.Band = decision.band;
        if (decision.rewriteStamp) {
            this.PromotedAt = decision.promotedAt;
            this.PromotedByUserID = decision.promotedByUserId;
        } else {
            const at = this.Fields.find((field) => field.Name === 'PromotedAt');
            const by = this.Fields.find((field) => field.Name === 'PromotedByUserID');
            if (at) this.PromotedAt = (at.OldValue as Date | null) ?? null;
            if (by) this.PromotedByUserID = (by.OldValue as string | null) ?? null;
        }
        return result;
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const wasNew = !this.IsSaved;
        const previousBand = this.Fields.find((field) => field.Name === 'Band')?.OldValue as Band | null | undefined;
        const ok = await super.Save(options);
        const user = this.ContextCurrentUser;
        if (!ok || !user || !this.ID) return ok;
        const becameShared = this.Band === 'Shared' && (wasNew || previousBand !== 'Shared');
        try {
            if (!wasNew && becameShared) await recordItemUse(this, user, this.ID, this.SpaceID, 'promote');
            if (becameShared) await recordShare(this, user, this.ID, this.SpaceID, 'Shared');
        } catch (error) {
            LogError(`Library event was not recorded: ${error instanceof Error ? error.message : String(error)}`);
        }
        return ok;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const provider = asMetadata(this.ProviderToUse);
        const filesEntity = provider?.EntityByName('MJ: Files');
        const isFile = !!filesEntity && !!this.EntityID && this.EntityID.toLowerCase() === filesEntity.ID.toLowerCase();
        const rawRecId = this.RecordID;
        const rawId = isFile && rawRecId ? (rawRecId.toLowerCase().startsWith('id|') ? rawRecId.slice(3) : rawRecId) : null;
        const parsedFileId = rawId ? parseUuid(rawId) : null;
        const currentItemId = this.ID;

        if (currentItemId && provider) {
            try {
                const system = await requireSystemUser(this);
                const rv = RunView.FromMetadataProvider(provider);
                const uses = await rv.RunView<{ ID: string }>({
                    EntityName: 'MJ_BizApps_Collaboration: Item Uses',
                    ExtraFilter: `ItemID = '${currentItemId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, system);
                if (uses?.Success && uses.Results) {
                    for (const u of uses.Results) {
                        const useEntity = await provider.GetEntityObject<mjBizAppsCollaborationItemUseEntity>('MJ_BizApps_Collaboration: Item Uses', system);
                        if (await useEntity.Load(u.ID)) {
                            await useEntity.Delete();
                        }
                    }
                }
                const notices = await rv.RunView<{ ID: string }>({
                    EntityName: 'MJ_BizApps_Collaboration: Share Notices',
                    ExtraFilter: `ItemID = '${currentItemId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, system);
                if (notices?.Success && notices.Results) {
                    for (const n of notices.Results) {
                        const noticeEntity = await provider.GetEntityObject<mjBizAppsCollaborationShareNoticeEntity>('MJ_BizApps_Collaboration: Share Notices', system);
                        if (await noticeEntity.Load(n.ID)) {
                            await noticeEntity.Delete();
                        }
                    }
                }
            } catch (error) {
                LogError(`Space item reference cleanup: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        const ok = await super.Delete(options);
        if (!ok) return false;

        if (parsedFileId && provider && filesEntity) {
            try {
                const system = await requireSystemUser(this);
                const rv = RunView.FromMetadataProvider(provider);
                const recIdFilter = `(RecordID = 'ID|${parsedFileId}' OR RecordID = '${parsedFileId}')`;
                const otherItemsRes = await rv.RunView<{ ID: string }>({
                    EntityName: ENTITY,
                    ExtraFilter: `EntityID = '${filesEntity.ID}' AND ${recIdFilter} AND ID <> '${currentItemId}'`,
                    Fields: ['ID'],
                    ResultType: 'simple',
                }, system);

                if (!otherItemsRes || !otherItemsRes.Success) {
                    LogError(`Space item file count query failed for ${parsedFileId}: ${otherItemsRes?.ErrorMessage ?? 'RunView failed'}`);
                    return ok;
                }

                const remainingCount = otherItemsRes.Results ? otherItemsRes.Results.length : 0;
                if (remainingCount === 0) {
                    await cleanupStoredItemFile(provider, system, parsedFileId);
                }
            } catch (error) {
                LogError(`Space item file cleanup: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return ok;
    }
}

async function cleanupStoredItemFile(provider: IMetadataProvider, user: UserInfo, fileId: string): Promise<void> {
    let storagePath: string | null = null;
    let accountId: string | null = null;
    let fileEntity: MJFileEntity | null = null;

    try {
        fileEntity = await provider.GetEntityObject<MJFileEntity>('MJ: Files', user);
        if (await fileEntity.Load(fileId)) {
            storagePath = fileEntity.ProviderKey;
            const providerId = fileEntity.ProviderID;
            await FileStorageEngine.Instance.Config(false, user, provider);
            const accounts = FileStorageEngine.Instance.GetAccountsByProviderID(providerId);
            const resolved = accounts[0] ? { account: accounts[0] } : FileStorageEngine.Instance.ResolveStorageAccount();
            if (resolved) {
                accountId = resolved.account.ID;
            }
        }
    } catch (error) {
        LogError(`Space item file lookup: ${error instanceof Error ? error.message : String(error)}`);
    }

    let objectGone = false;
    if (storagePath && accountId) {
        try {
            const driver = await FileStorageEngine.Instance.GetDriver(accountId, user);
            objectGone = await driver.DeleteObject(storagePath);
        } catch (error) {
            LogError(`Space item storage cleanup: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    let rowGone = false;
    if (fileEntity && fileEntity.IsSaved) {
        try {
            rowGone = await fileEntity.Delete();
        } catch (error) {
            LogError(`Space item file row cleanup: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if ((storagePath && !objectGone) || !rowGone) {
        LogError(`Space item file cleanup incomplete for ${fileId}: object=${objectGone} row=${rowGone}.`);
    }
}

function canonicalRecordId(item: SpaceItemEntityServer): string | null {
    const provider = asMetadata(item.ProviderToUse);
    const entityId = parseUuid(item.EntityID);
    if (!provider || !entityId || !item.RecordID) {
        return null;
    }
    const info = provider.EntityByID(entityId);
    if (!info) {
        return null;
    }
    try {
        return CompositeKey.FromURLSegment(info, item.RecordID).ToRecordID();
    } catch (error) {
        LogError(`Space item record id: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

async function filedTaskHasParent(item: SpaceItemEntityServer, user: NonNullable<SpaceItemEntityServer['ContextCurrentUser']>): Promise<boolean> {
    const provider = asMetadata(item.ProviderToUse);
    const tasks = provider?.EntityByName('MJ_BizApps_Tasks: Tasks');
    const entityId = parseUuid(item.EntityID);
    if (!provider || !tasks || !entityId || entityId.toLowerCase() !== tasks.ID.toLowerCase()) return false;
    const raw = item.RecordID ?? '';
    const taskId = raw.toLowerCase().startsWith('id|') ? raw.slice(3) : raw;
    if (!taskId) return false;
    const task = await provider.GetEntityObject<mjBizAppsTasksTaskEntity>(tasks.Name, user);
    if (!(await task.Load(taskId))) return false;
    return !!task.ParentID;
}

async function callerCanReadTarget(item: SpaceItemEntityServer, user: NonNullable<SpaceItemEntityServer['ContextCurrentUser']>): Promise<boolean> {
    const entityId = parseUuid(item.EntityID);
    if (!entityId || !item.RecordID) {
        return false;
    }
    const provider = asMetadata(item.ProviderToUse);
    if (!provider) {
        LogError('Space item target check: the provider has no entity metadata.');
        return false;
    }
    const info = provider.EntityByID(entityId);
    if (!info) {
        return false;
    }
    if (vouchedItems.has(item)) {
        return true;
    }
    let key: CompositeKey;
    try {
        key = CompositeKey.FromURLSegment(info, item.RecordID);
    } catch (error) {
        LogError(`Space item target check: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
    try {
        const record = await provider.GetEntityObject(info.Name, user);
        return await record.InnerLoad(key);
    } catch (error) {
        LogError(`Space item target check: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

function fail(result: ValidationResult, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo('Band', message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceItemEntityServer(): void {
    void SpaceItemEntityServer;
}
