import { BaseEntity, type FieldValueCollection, type IMetadataProvider, LogError, Metadata, RunView, type RunViewParams, type RunViewResult, type UserInfo, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { MJConversationEntity } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import {
    authorizeSpaceWrite,
    chainsForSpaceWrite,
    membershipReaches,
    parentCreatesCycle,
    planSpaceWrite,
    ResolveSpaceRules,
    ValidateCollaborationSettings,
    type CollaborationSettings,
    type ISpaceConfiguration,
    type ISpaceTypeConfiguration,
} from '@mj-biz-apps/collaboration-core';
import {
    mjBizAppsCollaborationSpaceChatEntity,
    mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import { type BaseSpaceTypeServerDriver } from './base-space-type-server-driver.js';
import { CollaborationEngine } from './CollaborationEngine.js';
import { callerUuid, isStaffUser, loadAncestorChain, loadWriteContext, requireSystemUser } from './load-graph.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { notifySpaceLifecycleSubscribers } from './space-lifecycle-subscribers.js';
import { syncRoomEditGrantsForSpace } from './room-edit-grants.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Spaces';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceEntityServer extends mjBizAppsCollaborationSpaceEntity {
    private _callerSpecifiedAllowParentAssignees = false;
    private _callerSpecifiedAgentRetrieval = false;
    private _newRecordAllowParentAssignees: boolean | null | undefined = undefined;
    private _newRecordAgentRetrieval: mjBizAppsCollaborationSpaceEntity['AgentRetrieval'] | null | undefined = undefined;

    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override NewRecord(newValues?: FieldValueCollection): boolean {
        const hasAllowInNewValues = newValues?.KeyValuePairs?.some((kv) => kv.FieldName === 'AllowParentAssignees') ?? false;
        const hasAgentInNewValues = newValues?.KeyValuePairs?.some((kv) => kv.FieldName === 'AgentRetrieval') ?? false;
        this._callerSpecifiedAllowParentAssignees = hasAllowInNewValues;
        this._callerSpecifiedAgentRetrieval = hasAgentInNewValues;
        const res = super.NewRecord(newValues);
        this._newRecordAllowParentAssignees = hasAllowInNewValues ? undefined : this.AllowParentAssignees;
        this._newRecordAgentRetrieval = hasAgentInNewValues ? undefined : this.AgentRetrieval;
        return res;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const caller = callerUuid(user);
        if (!user || !caller) {
            return fail(result, 'OwnerID', 'Space change refused: there is no signed-in user.');
        }
        const dirty = this.Fields.filter((field) => field.Dirty);
        if (this.IsSaved && dirty.length === 0) {
            return result;
        }

        if (this.IsSaved) {
            const allowParentChanged = this.Fields.some((field) => field.Name === 'AllowParentAssignees' && field.Dirty);
            if (allowParentChanged && !isStaffUser(user)) {
                return fail(result, 'AllowParentAssignees', 'Space change refused: only staff may change the allow-parent-assignees setting.');
            }
            const agentRetrievalChanged = this.Fields.some((field) => field.Name === 'AgentRetrieval' && field.Dirty);
            if (agentRetrievalChanged && !isStaffUser(user)) {
                return fail(result, 'AgentRetrieval', 'Space change refused: only staff may change the agent retrieval setting.');
            }
        }

        const rawTypeId = getFieldVal<string>(this, 'SpaceTypeID');
        const typeId = rawTypeId ? parseUuid(String(rawTypeId)) : null;

        if (!this.IsSaved && !typeId) {
            return fail(result, 'SpaceTypeID', 'Space change refused: the space type id is not valid.');
        }

        let spaceType: mjBizAppsCollaborationSpaceTypeEntity | null = null;
        if (typeId) {
            const effectiveMd = asMetadata(this.ProviderToUse) ?? (Metadata.Provider as IMetadataProvider | undefined);
            if (effectiveMd && typeof effectiveMd.EntityByName === 'function') {
                try {
                    await CollaborationEngine.Instance.EnsureLoaded(user, effectiveMd);
                } catch (e) {
                    LogError(`Space change refused: failed to load CollaborationEngine: ${e instanceof Error ? e.message : String(e)}`);
                    return fail(result, 'SpaceTypeID', 'Space change refused: the space type could not be read.');
                }
            }
            let found = CollaborationEngine.Instance.SpaceTypeById(typeId);
            if (!found && effectiveMd && typeof effectiveMd.EntityByName === 'function') {
                try {
                    const typeObj = await effectiveMd.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(
                        'MJ_BizApps_Collaboration: Space Types',
                        user
                    );
                    if (await typeObj.Load(typeId)) {
                        found = typeObj;
                    }
                } catch (e) {
                    LogError(`Space change refused: failed to load space type ${typeId}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            if (!found) {
                LogError(`Space change refused: space type ${typeId} could not be read from engine`);
                return fail(result, 'SpaceTypeID', 'Space change refused: the space type could not be read.');
            }
            spaceType = found;
        }

        let typeConfig: ISpaceTypeConfiguration | null = null;
        if (spaceType?.Configuration) {
            try {
                typeConfig = JSON.parse(spaceType.Configuration) as ISpaceTypeConfiguration;
            } catch {
                // Ignore parse errors on type configuration in space save
            }
        }

        let parsedSpaceConfig: CollaborationSettings | null = null;
        const rawConfig = getFieldVal<string>(this, 'Configuration');
        if (rawConfig) {
            try {
                parsedSpaceConfig = JSON.parse(rawConfig) as CollaborationSettings;
            } catch {
                return fail(result, 'Configuration', 'Space configuration must be valid JSON.');
            }

            const configValidation = ValidateCollaborationSettings(
                parsedSpaceConfig,
                'space',
                typeConfig as CollaborationSettings
            );
            if (!configValidation.valid) {
                return fail(result, 'Configuration', `Invalid space configuration: ${configValidation.errors.join('; ')}`);
            }

            if (parsedSpaceConfig.StorageAccountID) {
                const storageCheck = CollaborationEngine.Instance.ValidateStorageAccountActive(parsedSpaceConfig.StorageAccountID);
                if (!storageCheck.valid) {
                    return fail(result, 'Configuration', storageCheck.error ?? 'Configured storage account does not exist or is not active.');
                }
            }
        }

        const configDirty = this.Fields.some((f) => f.Name === 'Configuration' && f.Dirty);
        const closeFieldsDirty = this.Fields.some((f) => (f.Name === 'PostCloseAccess' || f.Name === 'PostCloseAccessDays') && f.Dirty);
        const isClosing = this.Fields.some((f) => f.Name === 'ClosedAt' && f.Dirty) && !!this.ClosedAt;
        const isReopening = this.Fields.some((f) => f.Name === 'ClosedAt' && f.Dirty) && !this.ClosedAt;

        if (isClosing) {
            const closedDate = new Date(this.ClosedAt!).getTime();
            if (closedDate > Date.now()) {
                return fail(result, 'ClosedAt', 'Space change refused: ClosedAt cannot be in the future.');
            }
        }

        if (isReopening) {
            const otherDirty = this.Fields.filter((f) => f.Dirty && f.Name !== 'ClosedAt' && !f.Name.startsWith('__mj_'));
            if (otherDirty.length > 0) {
                return fail(result, otherDirty[0].Name, 'Space change refused: reopening a space cannot modify other fields simultaneously.');
            }
        }

        if (configDirty || (closeFieldsDirty && !isClosing)) {
            const canConfig = await CollaborationEngine.Instance.UserCanConfigureSpaces(
                user,
                this.IsSaved ? this.ID : null,
                asMetadata(this.ProviderToUse) ?? Metadata.Provider
            );
            if (!canConfig) {
                const errorField = closeFieldsDirty && !isClosing ? 'PostCloseAccess' : 'Configuration';
                return fail(result, errorField, "Space change refused: user lacks 'Configure Spaces' authorization or does not hold an owner role on this space.");
            }
        }

        let driver: BaseSpaceTypeServerDriver | null = null;
        if (spaceType) {
            try {
                driver = ServerDriverRegistry.Instance.GetDriverForType(spaceType);
            } catch (driverErr) {
                return fail(result, 'SpaceTypeID', driverErr instanceof Error ? driverErr.message : 'Space change refused: driver could not be resolved.');
            }
        }

        const effectiveRules = ResolveSpaceRules(typeConfig, parsedSpaceConfig as ISpaceConfiguration);
        const adjustedRules = driver && spaceType
            ? await driver.AdjustRules(
                { actingUser: user, provider: this.ProviderToUse, space: this, spaceType, effectiveRules },
                effectiveRules
            )
            : effectiveRules;

        if (!this.IsSaved) {
            if (spaceType) {
                const defaultAllow = spaceType.DefaultAllowParentAssignees !== undefined ? !!spaceType.DefaultAllowParentAssignees : true;
                const defaultAgent = spaceType.DefaultAgentRetrieval ?? 'Included';

                // Treat AllowParentAssignees and AgentRetrieval as unspecified while they still hold
                // the value NewRecord() gave them without an explicit caller assignment in NewRecord().
                // Apply the space type's defaults when unspecified. If an explicit value was set, keep it,
                // and refuse non-staff callers if their explicit choice differs from the type's default.
                //
                // Spaces are created on the server today, by the loader and EnsureSpaceForRecord.
                // When a new-space UI form is built, it must prefill the space type's defaults so that
                // staff intentionally choosing the column default when the type's default differs can
                // be distinguished.
                const allowSpecified = this._callerSpecifiedAllowParentAssignees ||
                    (this._newRecordAllowParentAssignees !== undefined && this.AllowParentAssignees !== this._newRecordAllowParentAssignees);
                const agentSpecified = this._callerSpecifiedAgentRetrieval ||
                    (this._newRecordAgentRetrieval !== undefined && this.AgentRetrieval !== this._newRecordAgentRetrieval);

                if (!allowSpecified) {
                    this.AllowParentAssignees = defaultAllow;
                } else if (!isStaffUser(user) && this.AllowParentAssignees !== defaultAllow) {
                    return fail(result, 'AllowParentAssignees', 'Space change refused: only staff may change the allow-parent-assignees setting.');
                }

                if (!agentSpecified) {
                    this.AgentRetrieval = defaultAgent;
                } else if (!isStaffUser(user) && this.AgentRetrieval !== defaultAgent) {
                    return fail(result, 'AgentRetrieval', 'Space change refused: only staff may change the agent retrieval setting.');
                }
            }
        }
        const spaceId = this.ID ? parseUuid(this.ID) : null;
        if (this.ID && !spaceId) {
            return fail(result, 'ID', 'Space change refused: the space id is not valid.');
        }
        const ownerId = parseUuid(this.OwnerID);
        if (!ownerId) {
            return fail(result, 'OwnerID', 'Space change refused: the owner id is not valid.');
        }
        const parentId = this.ParentID ? parseUuid(this.ParentID) : null;
        if (this.ParentID && !parentId) {
            return fail(result, 'ParentID', 'Space change refused: the parent id is not valid.');
        }
        const previousRaw = this.Fields.find((field) => field.Name === 'ParentID')?.OldValue as string | null | undefined;
        const previousParent = previousRaw ? parseUuid(String(previousRaw)) : null;
        if (previousRaw && !previousParent) {
            return fail(result, 'ParentID', 'Space change refused: the saved parent id is not valid.');
        }
        const kind = planSpaceWrite({ isNew: !this.IsSaved, previousParentId: previousParent, nextParentId: parentId });
        const toRoot = kind === 'move' && !parentId;
        const chains = chainsForSpaceWrite(kind, toRoot);
        const hereId = this.IsSaved ? spaceId : null;
        let hereContext: Awaited<ReturnType<typeof loadWriteContext>> | null = null;
        let destination: Awaited<ReturnType<typeof loadWriteContext>> | null = null;
        try {
            if (chains.here && hereId) {
                hereContext = await loadWriteContext(this, user, hereId, null);
            }
            if (chains.destination && parentId) {
                destination = await loadWriteContext(this, user, parentId, null);
            }
        } catch (error) {
            return fail(result, 'ParentID', error instanceof Error ? error.message : 'Space change refused: the tree could not be read completely.');
        }
        const here = hereId && hereContext ? membershipReaches(hereContext.spaces, hereContext.memberships, caller, hereId, new Date(), isReopening) : null;
        const onParent = parentId && destination ? membershipReaches(destination.spaces, destination.memberships, caller, parentId) : null;
        const decision = authorizeSpaceWrite({
            kind,
            callerUserId: caller,
            callerIsStaff: isStaffUser(user),
            nextOwnerId: ownerId,
            toRoot,
            here,
            onParent,
        });
        if (!decision.ok) {
            return fail(result, 'ParentID', decision.message);
        }
        let systemNodes: Awaited<ReturnType<typeof loadAncestorChain>> = [];
        try {
            const system = await requireSystemUser(this);
            const cycleRoot = parentId || spaceId;
            if (cycleRoot) {
                systemNodes = await loadAncestorChain(this, cycleRoot, system);
            }
        } catch (error) {
            return fail(result, 'ParentID', error instanceof Error ? error.message : 'Space change refused: the system user could not read the tree.');
        }
        const hereSpaces = hereContext?.spaces ?? [];
        const nodes = [...systemNodes, ...hereSpaces.filter((space) => !systemNodes.some((have) => have.id === space.id))];
        if (spaceId && parentCreatesCycle(nodes.map((space) => space.id === spaceId ? { ...space, parentId } : space), spaceId, parentId)) {
            return fail(result, 'ParentID', 'This parent would put the space inside its own subtree.');
        }

        const isNew = !this.IsSaved;
        const isMoving = this.Fields.some((f) => f.Name === 'ParentID' && f.Dirty);

        if (isClosing) {
            const postClose = await CollaborationEngine.Instance.ResolvePostCloseAccessForSpace({
                spaceId: this.ID,
                currentConfig: parsedSpaceConfig,
                parentId: this.ParentID,
                spaceTypeId: this.SpaceTypeID,
                provider: asMetadata(this.ProviderToUse) ?? Metadata.Provider,
                contextUser: user,
            });
            this.PostCloseAccess = postClose.access;
            this.PostCloseAccessDays = postClose.days;
        }

        const changeKind = isNew ? 'Create' : isClosing ? 'Close' : isReopening ? 'Reopen' : isMoving ? 'Move' : 'Update';

        if (driver && spaceType) {
            const driverValidation = await driver.ValidateSpaceChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: this,
                spaceType: spaceType as mjBizAppsCollaborationSpaceTypeEntity,
                effectiveRules: adjustedRules,
                kind: changeKind,
            });
            if (!driverValidation.ok) {
                return fail(result, driverValidation.field ?? 'ID', driverValidation.message ?? 'Space change refused by driver.');
            }
        }

        if (parentId) {
            try {
                const parentInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(parentId, this);
                const childValidation = await parentInfo.driver.ValidateChildSpaceChange({
                    actingUser: user,
                    provider: this.ProviderToUse,
                    space: parentInfo.space,
                    spaceType: parentInfo.spaceType,
                    effectiveRules: ResolveSpaceRules(null, null),
                    childSpace: this,
                    kind: isNew ? 'CreateChild' : 'MoveChildIn',
                });
                if (!childValidation.ok) {
                    return fail(result, childValidation.field ?? 'ParentID', childValidation.message ?? 'Child space change refused by parent driver.');
                }
            } catch (err) {
                return fail(result, 'ParentID', err instanceof Error ? err.message : 'Could not validate with parent driver.');
            }
        }

        return result;
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const wasClosed = !!this.Fields.find((f) => f.Name === 'ClosedAt')?.OldValue;
        const isNowClosed = !!this.ClosedAt;
        const justClosed = !wasClosed && isNowClosed;

        const parentChanged = this.Fields.some((f) => f.Name === 'ParentID' && f.Dirty);
        const inheritsChanged = this.Fields.some((f) => f.Name === 'InheritsMembership' && f.Dirty);
        const structureChanged = parentChanged || inheritsChanged;

        const ok = await super.Save(options);
        if (ok && this.ContextCurrentUser && this.ID) {
            const user = this.ContextCurrentUser;
            try {
                await ensureConversation(this, user);
            } catch (error) {
                LogError(`Space conversation was not bound: ${error instanceof Error ? error.message : String(error)}`);
            }

            if (structureChanged) {
                try {
                    await syncRoomEditGrantsForSpace(this.ProviderToUse, this.ID);
                } catch (syncErr) {
                    LogError(`Room edit grants sync failed on space structure change: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`);
                }
            }

            try {
                const spaceType = await ServerDriverRegistry.Instance.ResolveType(this.SpaceTypeID, this);
                const driver = ServerDriverRegistry.Instance.GetDriverForType(spaceType);
                await driver.OnSpaceChanged({
                    actingUser: user,
                    provider: this.ProviderToUse,
                    space: this,
                    spaceType,
                    effectiveRules: ResolveSpaceRules(null, null),
                    kind: justClosed ? 'Close' : 'Update',
                });

                if (this.ParentID) {
                    const parentInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(this.ParentID, this);
                    await parentInfo.driver.OnChildSpaceChanged({
                        actingUser: user,
                        provider: this.ProviderToUse,
                        space: parentInfo.space,
                        spaceType: parentInfo.spaceType,
                        effectiveRules: ResolveSpaceRules(null, null),
                        childSpace: this,
                        kind: 'CreateChild',
                    });
                }
            } catch (driverErr) {
                LogError(`Space driver reaction failed: ${driverErr instanceof Error ? driverErr.message : String(driverErr)}`);
            }

            if (justClosed) {
                notifySpaceLifecycleSubscribers(this.ProviderToUse, {
                    spaceId: this.ID,
                    actingUserId: user.ID,
                    event: 'AfterSpaceClosed',
                    timestamp: new Date(),
                });
            }
        }
        return ok;
    }
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';

async function ensureConversation(space: SpaceEntityServer, user: NonNullable<SpaceEntityServer['ContextCurrentUser']>): Promise<void> {
    const metadata = asMetadata(space.ProviderToUse);
    if (!metadata) {
        LogError('Space conversation was not bound: the provider cannot create entities.');
        return;
    }
    const system = await requireSystemUser(space);
    const targetStatus: mjBizAppsCollaborationSpaceChatEntity['Status'] = space.ClosedAt ? 'Archived' : 'Active';

    // 1. Find existing Room for this space by its Space Chats row (Kind = 'Room')
    const chatExisting = await new RunView(space.RunViewProviderToUse).RunView<{ ID: string; ConversationID: string; Status: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Chats',
        ExtraFilter: `SpaceID = '${space.ID}' AND Kind = 'Room'`,
        Fields: ['ID', 'ConversationID', 'Status'],
        OrderBy: '__mj_CreatedAt ASC',
        ResultType: 'simple',
        MaxRows: 1,
    }, system);
    if (!chatExisting.Success) {
        LogError(`Space chat room lookup failed: ${chatExisting.ErrorMessage ?? 'the lookup failed'}`);
        return;
    }

    const foundChat = chatExisting.Results?.[0];
    if (foundChat) {
        // On later saves, only set the row's status if changed
        if (foundChat.Status !== targetStatus) {
            const spaceChat = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>('MJ_BizApps_Collaboration: Space Chats', system);
            if (await spaceChat.Load(foundChat.ID)) {
                spaceChat.Status = targetStatus;
                const chatSaved = await spaceChat.Save();
                if (!chatSaved) {
                    LogError(`Space chat room status was not updated: ${spaceChat.LatestResult?.CompleteMessage ?? 'save returned false'}`);
                } else {
                    await syncRoomEditGrantsForSpace(metadata, space.ID);
                }
            } else {
                LogError(`Space chat room load failed for ID ${foundChat.ID}`);
            }
        }
        return;
    }

    // 2. Create the room when the space is created (no existing Room Space Chat)
    const conversation = await metadata.GetEntityObject<MJConversationEntity>('MJ: Conversations', system);
    conversation.NewRecord();
    conversation.LinkedEntityID = SPACES_ENTITY_ID;
    conversation.LinkedRecordID = space.ID;
    conversation.UserID = system.ID;
    conversation.Name = space.Name;
    conversation.ApplicationScope = 'Application';
    conversation.ApplicationID = COLLABORATION_APP_ID;

    const spaceChat = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>('MJ_BizApps_Collaboration: Space Chats', system);
    spaceChat.NewRecord();
    spaceChat.SpaceID = space.ID;
    spaceChat.ConversationID = conversation.ID;
    spaceChat.Name = space.Name;
    spaceChat.Kind = 'Room';
    spaceChat.Status = targetStatus;

    if (typeof metadata.CreateTransactionGroup === 'function') {
        const tg = await metadata.CreateTransactionGroup();
        conversation.TransactionGroup = tg;
        spaceChat.TransactionGroup = tg;
        await conversation.Save();
        await spaceChat.Save();
        const submitted = await tg.Submit();
        if (!submitted || !conversation.ID || !spaceChat.ID) {
            const msg = conversation.LatestResult?.CompleteMessage || spaceChat.LatestResult?.CompleteMessage || 'Failed to submit room creation transaction.';
            LogError(`Space conversation transaction failed for space ${space.ID}: ${msg}`);
            return;
        }
        await syncRoomEditGrantsForSpace(metadata, space.ID);
    } else {
        const convSaved = await conversation.Save();
        if (!convSaved || !conversation.ID) {
            LogError(`Space conversation was not bound: ${conversation.LatestResult?.CompleteMessage ?? 'save returned false'}`);
            return;
        }
        spaceChat.ConversationID = conversation.ID;
        const chatSaved = await spaceChat.Save();
        if (!chatSaved) {
            LogError(`Space chat room was not bound: ${spaceChat.LatestResult?.CompleteMessage ?? 'save returned false'}`);
            const deleted = await conversation.Delete();
            if (!deleted) {
                LogError(`Failed to cleanup unbound conversation ${conversation.ID}: ${conversation.LatestResult?.CompleteMessage ?? 'delete returned false'}`);
            }
        } else {
            await syncRoomEditGrantsForSpace(metadata, space.ID);
        }
    }
}

function getFieldVal<T>(entity: BaseEntity, name: string): T | undefined {
    const f = entity.Fields?.find((field) => field.Name === name);
    if (f !== undefined) return f.Value as T;
    const desc = Object.getOwnPropertyDescriptor(entity, name);
    if (desc && 'value' in desc) return desc.value as T;
    return undefined;
}

export function LoadSpaceEntityServer(): void {
    void SpaceEntityServer;
}
