import { BaseEntity, BaseEntityResult, CompositeKey, EntityPermissionType, LogError, RunView, ValidationErrorInfo, ValidationErrorType, type IMetadataProvider, type TransactionGroupBase, type UserInfo, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { MJFileEntity } from '@memberjunction/core-entities';
import { FileStorageEngine } from '@memberjunction/storage';
import { authorizeItemWrite, ResolveSpaceRules, type Band } from '@mj-biz-apps/collaboration-core';
import { recordItemUse, recordShare } from './library-events.js';
import { mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
import {
    mjBizAppsCollaborationItemUseEntity,
    mjBizAppsCollaborationShareNoticeEntity,
    mjBizAppsCollaborationSpaceItemEntity,
} from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext, requireSystemUser } from './load-graph.js';
import { refusalOf, resolveSpaceDriver, subtypeOf } from './space-driver-call.js';
import type { ItemChangeKind } from './base-space-type-server-driver.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { notifySpaceLifecycleSubscribers } from './space-lifecycle-subscribers.js';
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

/**
 * The kind of change an item save is, decided from what changed: a new item is Add; a different space is Move; a band that became
 * Shared is Promote; any other change (a rename, a note) is Update.
 */
export function decideItemKind(change: { isNew: boolean; spaceChanged: boolean; bandChanged: boolean; band: string }): ItemChangeKind {
    if (change.isNew) return 'Add';
    if (change.spaceChanged) return 'Move';
    if (change.bandChanged && change.band === 'Shared') return 'Promote';
    return 'Update';
}

@RegisterClass(BaseEntity, ENTITY)
export class SpaceItemEntityServer extends mjBizAppsCollaborationSpaceItemEntity {
    /** What this save changes, read once. */
    private readChange(): { kind: ItemChangeKind; oldValues: Record<string, unknown>; changed: boolean } {
        const isNew = !this.IsSaved;
        return {
            kind: decideItemKind({
                isNew,
                spaceChanged: this.Fields.some((f) => f.Name === 'SpaceID' && f.Dirty),
                bandChanged: this.Fields.some((f) => f.Name === 'Band' && f.Dirty),
                band: this.Band,
            }),
            oldValues: isNew ? {} : this.dirtyOldValues(),
            changed: isNew || this.Fields.some((f) => f.Dirty),
        };
    }

    /** What `Save` read, handed to validation so a save has one reading. Validation called on its own reads for itself. */
    private readingForSave: { kind: ItemChangeKind; oldValues: Record<string, unknown>; changed: boolean } | null = null;

    /** What each changed field held before this save, by field name. System columns are left out. */
    private dirtyOldValues(): Record<string, unknown> {
        const old: Record<string, unknown> = {};
        for (const field of this.Fields) {
            if (field.Dirty && !field.Name.startsWith('__mj_')) old[field.Name] = field.OldValue;
        }
        return old;
    }

    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        // The reading `Save` took, or one taken here before the gate rewrites the band and the stamps when validation runs on its own
        const reading = this.readingForSave ?? this.readChange();
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
                const isExternal = await isExternalUrlFile(this, user);
                if (!isExternal) {
                    return fail(result, 'Item change refused: file items must be created through space upload.');
                }
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

        // Extensibility Driver Validation
        try {
            const spaceInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(spaceId, this);
            const itemKind = reading.kind;
            const oldValues = reading.oldValues;

            const driverValidation = await spaceInfo.driver.ValidateItemChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: spaceInfo.space,
                spaceType: spaceInfo.spaceType,
                effectiveRules: ResolveSpaceRules(null, null),
                subtypeEntityName: subtypeOf(spaceInfo.spaceType),
                item: this,
                kind: itemKind,
                oldValues,
            });
            if (!driverValidation.ok) {
                return fail(result, driverValidation.message ?? 'Item change refused by driver.');
            }
        } catch (driverErr) {
            return fail(result, driverErr instanceof Error ? driverErr.message : 'Item change refused: driver could not be resolved.');
        }

        return result;
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const wasNew = !this.IsSaved;
        const previousBand = this.Fields.find((field) => field.Name === 'Band')?.OldValue as Band | null | undefined;
        // One reading per save: taken here, handed to validation, used by the reaction. Dropped when the save is done.
        const own = this.readChange();
        this.readingForSave = own;
        let ok = false;
        try {
            ok = await super.Save(options);
        } finally {
            this.readingForSave = null;
        }
        const decided = own;
        const user = this.ContextCurrentUser;
        if (!ok || !user || !this.ID) return ok;
        const becameShared = this.Band === 'Shared' && (wasNew || previousBand !== 'Shared');
        try {
            if (!wasNew && becameShared) await recordItemUse(this, user, this.ID, this.SpaceID, 'promote');
            if (becameShared) await recordShare(this, user, this.ID, this.SpaceID, 'Shared');
        } catch (error) {
            LogError(`Library event was not recorded: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Nothing changed, nothing to tell: MJ's Save returns true for a clean record without writing it
        if (decided.changed) {
            let typeCode: string | undefined;
            try {
                const spaceInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(this.SpaceID, this);
                typeCode = spaceInfo.spaceType.Code;
                await spaceInfo.driver.OnItemChanged({
                    actingUser: user,
                    provider: this.ProviderToUse,
                    space: spaceInfo.space,
                    spaceType: spaceInfo.spaceType,
                    effectiveRules: ResolveSpaceRules(null, null),
                    subtypeEntityName: subtypeOf(spaceInfo.spaceType),
                    item: this,
                    kind: decided.kind,
                    oldValues: decided.oldValues,
                });
            } catch (driverErr) {
                LogError(`OnItemChanged of space type '${typeCode ?? 'not resolved'}' failed for space ${this.SpaceID} (item ${this.ID}): ${driverErr instanceof Error ? driverErr.message : String(driverErr)}`);
            }
        }

        if (becameShared) {
            notifySpaceLifecycleSubscribers(this.ProviderToUse, {
                spaceId: this.SpaceID,
                actingUserId: user.ID,
                event: 'AfterItemPromoted',
                timestamp: new Date(),
                data: { itemId: this.ID, entityId: this.EntityID, recordId: this.RecordID },
            });
        }

        return ok;
    }

    private failDelete(message: string): false {
        const result = new BaseEntityResult();
        result.Success = false;
        result.Type = 'delete';
        result.Message = message;
        this.RegisterResultHistoryEntry(result);
        return false;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        // 1. Permission check FIRST: stop immediately if the caller lacks delete permission.
        // This prevents unauthorized callers from wiping out child history (Item Uses / Share Notices)
        // before MJ's ORM check.
        try {
            this.CheckPermissions(EntityPermissionType.Delete, true);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            LogError(msg);
            return this.failDelete(msg);
        }

        const currentItemId = this.ID;
        if (!currentItemId || !this.IsSaved) {
            return super.Delete(options);
        }

        // The space type's driver judges the removal, as Remove
        const removalUser = this.ContextCurrentUser;
        if (removalUser && this.SpaceID) {
            const resolved = await resolveSpaceDriver(this, this.ProviderToUse, removalUser, this.SpaceID);
            if (!resolved.ok) return this.failDelete(resolved.message);
            const refusal = refusalOf(await resolved.call.driver.ValidateItemChange({ ...resolved.call.base, item: this, kind: 'Remove' }));
            if (refusal) return this.failDelete(refusal);
        }

        const provider = asMetadata(this.ProviderToUse);
        if (!provider) {
            const msg = `Space item delete failed: metadata provider is not available for item ${currentItemId}`;
            LogError(msg);
            return this.failDelete(msg);
        }

        // 2. Pre-compute file information BEFORE super.Delete(options) is called,
        // because super.Delete clears this.RecordID and this.EntityID upon completion.
        const filesEntity = provider.EntityByName('MJ: Files');
        const isFile = !!filesEntity && !!this.EntityID && this.EntityID.toLowerCase() === filesEntity.ID.toLowerCase();
        const rawRecId = this.RecordID;
        const rawId = isFile && rawRecId ? (rawRecId.toLowerCase().startsWith('id|') ? rawRecId.slice(3) : rawRecId) : null;
        const parsedFileId = rawId ? parseUuid(rawId) : null;

        // 3. Child deletes (Item Uses & Share Notices) and item delete run atomically in ONE transaction group.
        const isInitiator = !this.TransactionGroup;
        let tg = this.TransactionGroup;
        if (isInitiator) {
            try {
                tg = await provider.CreateTransactionGroup();
            } catch (error) {
                const msg = `Space item delete failed to create transaction group: ${error instanceof Error ? error.message : String(error)}`;
                LogError(msg);
                return this.failDelete(msg);
            }
        }

        const loadedUses: mjBizAppsCollaborationItemUseEntity[] = [];
        const loadedNotices: mjBizAppsCollaborationShareNoticeEntity[] = [];

        try {
            const system = await requireSystemUser(this);
            const rv = RunView.FromMetadataProvider(provider);

            const usesRes = await rv.RunView<mjBizAppsCollaborationItemUseEntity>({
                EntityName: 'MJ_BizApps_Collaboration: Item Uses',
                ExtraFilter: `ItemID = '${currentItemId}'`,
                ResultType: 'entity_object',
                IgnoreMaxRows: true,
            }, system);
            if (!usesRes || !usesRes.Success) {
                const msg = `Space item reference cleanup: failed to query Item Uses for item ${currentItemId}: ${usesRes?.ErrorMessage ?? 'RunView failed'}`;
                LogError(msg);
                return this.failDelete(msg);
            }

            if (usesRes.Results && usesRes.Results.length > 0) {
                for (const useEntity of usesRes.Results) {
                    loadedUses.push(useEntity);
                    useEntity.TransactionGroup = tg;
                    const queued = await useEntity.Delete();
                    if (!queued) {
                        const msg = `Space item reference cleanup: failed to queue delete for Item Use ${useEntity.ID}`;
                        LogError(msg);
                        return this.failDelete(msg);
                    }
                }
            }

            const noticesRes = await rv.RunView<mjBizAppsCollaborationShareNoticeEntity>({
                EntityName: 'MJ_BizApps_Collaboration: Share Notices',
                ExtraFilter: `ItemID = '${currentItemId}'`,
                ResultType: 'entity_object',
                IgnoreMaxRows: true,
            }, system);
            if (!noticesRes || !noticesRes.Success) {
                const msg = `Space item reference cleanup: failed to query Share Notices for item ${currentItemId}: ${noticesRes?.ErrorMessage ?? 'RunView failed'}`;
                LogError(msg);
                return this.failDelete(msg);
            }

            if (noticesRes.Results && noticesRes.Results.length > 0) {
                for (const noticeEntity of noticesRes.Results) {
                    loadedNotices.push(noticeEntity);
                    noticeEntity.TransactionGroup = tg;
                    const queued = await noticeEntity.Delete();
                    if (!queued) {
                        const msg = `Space item reference cleanup: failed to queue delete for Share Notice ${noticeEntity.ID}`;
                        LogError(msg);
                        return this.failDelete(msg);
                    }
                }
            }

            this.TransactionGroup = tg;
            const itemQueued = await super.Delete(options);
            if (!itemQueued) {
                const msg = this.LatestResult?.CompleteMessage || `Space item delete failed to queue delete for item ${currentItemId}`;
                LogError(msg);
                if (!this.LatestResult || this.LatestResult.Success) {
                    this.failDelete(msg);
                }
                return false;
            }

            if (isInitiator && tg) {
                const submitted = await tg.Submit();
                if (!submitted) {
                    const msg = `Space item delete transaction failed for item ${currentItemId}`;
                    LogError(msg);
                    return this.failDelete(msg);
                }
            } else if (!isInitiator && tg) {
                // Inside a caller's transaction group:
                // Hook file cleanup to run only when caller's transaction group commits successfully.
                if (parsedFileId && filesEntity && typeof tg.TransactionNotifications$?.subscribe === 'function') {
                    const fileIdToClean = parsedFileId;
                    const filesEntityId = filesEntity.ID;
                    const currentId = currentItemId;
                    tg.TransactionNotifications$.subscribe(async (notification) => {
                        if (notification?.success) {
                            await cleanupStoredFileIfUnreferenced(provider, this, fileIdToClean, filesEntityId, currentId);
                        }
                    });
                }
                return true;
            }
        } catch (error) {
            const msg = `Space item delete transaction failed: ${error instanceof Error ? error.message : String(error)}`;
            LogError(msg);
            return this.failDelete(msg);
        } finally {
            if (isInitiator) {
                (this as { TransactionGroup?: TransactionGroupBase }).TransactionGroup = undefined;
                for (const u of loadedUses) {
                    (u as { TransactionGroup?: TransactionGroupBase }).TransactionGroup = undefined;
                }
                for (const n of loadedNotices) {
                    (n as { TransactionGroup?: TransactionGroupBase }).TransactionGroup = undefined;
                }
            }
        }

        // 4. Stored file cleanup only runs AFTER the item delete transaction commits!
        if (parsedFileId && filesEntity) {
            await cleanupStoredFileIfUnreferenced(provider, this, parsedFileId, filesEntity.ID, currentItemId);
        }

        return true;
    }
}

async function cleanupStoredFileIfUnreferenced(
    provider: IMetadataProvider,
    contextEntity: BaseEntity,
    fileId: string,
    filesEntityId: string,
    currentItemId: string
): Promise<void> {
    try {
        const sys = await requireSystemUser(contextEntity);
        const rvw = RunView.FromMetadataProvider(provider);
        const recIdFilter = `(RecordID = 'ID|${fileId}' OR RecordID = '${fileId}')`;
        const otherItemsRes = await rvw.RunView<{ ID: string }>({
            EntityName: ENTITY,
            ExtraFilter: `EntityID = '${filesEntityId}' AND ${recIdFilter} AND ID <> '${currentItemId}'`,
            Fields: ['ID'],
            ResultType: 'simple',
        }, sys);
        if (!otherItemsRes || !otherItemsRes.Success) {
            LogError(`Space item file count query failed for ${fileId}: ${otherItemsRes?.ErrorMessage ?? 'RunView failed'}`);
            return;
        }

        const remainingCount = otherItemsRes.Results ? otherItemsRes.Results.length : 0;
        if (remainingCount === 0) {
            await cleanupStoredItemFile(provider, sys, fileId);
        }
    } catch (error) {
        LogError(`Space item file cleanup: ${error instanceof Error ? error.message : String(error)}`);
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

    // The Library's artifact over this file (stage 1): its versions name the file row, so they and their artifact go first
    try {
        const rv = RunView.FromMetadataProvider(provider);
        const versions = await rv.RunView<{ ID: string; ArtifactID: string }>({
            EntityName: 'MJ: Artifact Versions',
            ExtraFilter: `FileID = '${fileId}'`,
            Fields: ['ID', 'ArtifactID'],
            ResultType: 'simple',
            MaxRows: 100,
        }, user);
        const artifactIds = new Set<string>();
        for (const row of versions.Success ? versions.Results ?? [] : []) {
            const version = await provider.GetEntityObject<BaseEntity>('MJ: Artifact Versions', user);
            if (await version.InnerLoad(new CompositeKey([{ FieldName: 'ID', Value: row.ID }])) && (await version.Delete())) artifactIds.add(row.ArtifactID);
        }
        for (const artifactId of artifactIds) {
            const left = await rv.RunView<{ ID: string }>({ EntityName: 'MJ: Artifact Versions', ExtraFilter: `ArtifactID = '${artifactId}'`, Fields: ['ID'], ResultType: 'simple', MaxRows: 1 }, user);
            if (left.Success && (left.Results?.length ?? 0) === 0) {
                const artifact = await provider.GetEntityObject<BaseEntity>('MJ: Artifacts', user);
                if (await artifact.InnerLoad(new CompositeKey([{ FieldName: 'ID', Value: artifactId }]))) await artifact.Delete();
            }
        }
    } catch (error) {
        LogError(`Space item artifact cleanup: ${error instanceof Error ? error.message : String(error)}`);
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

const EXTERNAL_URL_PROVIDER_ID = '93dbcfc9-5b2a-48d6-9d95-e93b319c88e5';

async function isExternalUrlFile(item: SpaceItemEntityServer, user: NonNullable<SpaceItemEntityServer['ContextCurrentUser']>): Promise<boolean> {
    const provider = asMetadata(item.ProviderToUse);
    const files = provider?.EntityByName('MJ: Files');
    if (!provider || !files) return false;
    const raw = item.RecordID ?? '';
    const fileId = raw.toLowerCase().startsWith('id|') ? raw.slice(3) : raw;
    if (!fileId) return false;
    try {
        const file = await provider.GetEntityObject<MJFileEntity>(files.Name, user);
        if (await file.Load(fileId)) {
            const providerId = file.ProviderID ? parseUuid(file.ProviderID) : null;
            return providerId === EXTERNAL_URL_PROVIDER_ID;
        }
    } catch (e) {
        LogError(`isExternalUrlFile check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    return false;
}

function fail(result: ValidationResult, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo('Band', message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceItemEntityServer(): void {
    void SpaceItemEntityServer;
}
