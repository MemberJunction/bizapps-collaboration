import { BaseEntity, type FieldValueCollection, type IMetadataProvider, LogError, Metadata, RunView, type RunViewParams, type RunViewResult, type UserInfo, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    authorizeSpaceWrite,
    chainsForSpaceWrite,
    membershipReaches,
    parentCreatesCycle,
    refuseChildType,
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
import { type BaseSpaceTypeServerDriver, type ChildSpaceChangeKind, type SpaceChangeKind } from './base-space-type-server-driver.js';
import { CollaborationEngine } from './CollaborationEngine.js';
import { callerUuid, isStaffUser, loadAncestorChain, loadWriteContext, requireSystemUser } from './load-graph.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { failDelete, refusalOf, resolveSpaceDriver } from './space-driver-call.js';
import { notifySpaceLifecycleSubscribers } from './space-lifecycle-subscribers.js';
import { syncRoomEditGrantsForSpace } from './room-edit-grants.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Spaces';

/**
 * The kinds of change a space save is, for the space's own driver and for its parent's: a create; a close; a reopen; a move
 * (only when the parent changed); else an update. A child's rename is an UpdateChild, so rules on children still see it.
 */
export function decideSpaceKinds(change: { isNew: boolean; isClosing: boolean; isReopening: boolean; isMoving: boolean }): { spaceKind: SpaceChangeKind; childKind: ChildSpaceChangeKind } {
    const spaceKind: SpaceChangeKind = change.isNew ? 'Create' : change.isClosing ? 'Close' : change.isReopening ? 'Reopen' : change.isMoving ? 'Move' : 'Update';
    const childKind: ChildSpaceChangeKind = change.isNew ? 'CreateChild' : change.isClosing ? 'CloseChild' : change.isMoving ? 'MoveChildIn' : 'UpdateChild';
    return { spaceKind, childKind };
}

@RegisterClass(BaseEntity, ENTITY)
export class SpaceEntityServer extends mjBizAppsCollaborationSpaceEntity {
    /** What validation decided about this save, for the reaction that follows it. */
    private decidedChange: { spaceKind: SpaceChangeKind; childKind: ChildSpaceChangeKind; oldValues: Record<string, unknown> } | null = null;

    /** What each changed field held before this save, by field name. System columns are left out. */
    private dirtyOldValues(): Record<string, unknown> {
        const old: Record<string, unknown> = {};
        for (const field of this.Fields) {
            if (field.Dirty && !field.Name.startsWith('__mj_')) old[field.Name] = field.OldValue;
        }
        return old;
    }

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

        // A new space needs a valid type, and so does a saved one whose type is being changed: skipping the type's checks
        // because the new id doesn't resolve would let the change through unchecked
        const typeChanging = this.IsSaved && this.Fields.some((f) => f.Name === 'SpaceTypeID' && f.Dirty);
        if ((!this.IsSaved || typeChanging) && !typeId) {
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
            } catch (parseErr) {
                // Fails closed: saving under a type whose narrowing can't be read would loosen it
                LogError(`Space change refused: space type ${spaceType.ID} has a configuration that does not parse: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
                return fail(result, 'SpaceTypeID', "Space change refused: the space type's configuration does not parse.");
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

        // A change of type moves the space out from under its old type's rules, so it takes the same right as a
        // configuration change, a subtype table both types share, and the judgement of both types' drivers.
        const typeField = this.Fields.find((f) => f.Name === 'SpaceTypeID');
        const typeChanged = this.IsSaved && !!typeField?.Dirty;
        const previousTypeId = typeChanged && typeField?.OldValue ? parseUuid(String(typeField.OldValue)) : null;
        if (typeChanged && spaceType) {
            const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
            if (!(await CollaborationEngine.Instance.UserCanConfigureSpaces(user, this.ID, md))) {
                return fail(result, 'SpaceTypeID', "Space change refused: changing a space's type needs the 'Configure Spaces' authorization and an owner seat on the space.");
            }
            const previousType = previousTypeId ? CollaborationEngine.Instance.SpaceTypeById(previousTypeId) : undefined;
            if (!previousType) {
                return fail(result, 'SpaceTypeID', "Space change refused: the space's previous type could not be read.");
            }
            if ((previousType.SpaceExtensionEntity ?? null) !== (spaceType.SpaceExtensionEntity ?? null)) {
                return fail(result, 'SpaceTypeID', 'Space change refused: the two types do not share a subtype table, so the space cannot move between them.');
            }
            let previousConfig: ISpaceTypeConfiguration | null = null;
            if (previousType.Configuration) {
                try {
                    previousConfig = JSON.parse(previousType.Configuration) as ISpaceTypeConfiguration;
                } catch (parseErr) {
                    LogError(`Space change refused: type ${previousType.ID} has a configuration that does not parse: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
                    return fail(result, 'SpaceTypeID', "Space change refused: the previous type's configuration does not parse.");
                }
            }
            let previousDriver: BaseSpaceTypeServerDriver;
            try {
                previousDriver = ServerDriverRegistry.Instance.GetDriverForType(previousType);
            } catch (driverErr) {
                return fail(result, 'SpaceTypeID', driverErr instanceof Error ? driverErr.message : "Space change refused: the previous type's driver could not be resolved.");
            }
            const previousJudgement = await previousDriver.ValidateSpaceChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: this,
                spaceType: previousType,
                effectiveRules: ResolveSpaceRules(previousConfig, parsedSpaceConfig as ISpaceConfiguration),
                kind: 'Update',
                oldValues: { SpaceTypeID: previousTypeId },
            });
            if (!previousJudgement.ok) {
                return fail(result, previousJudgement.field ?? 'SpaceTypeID', previousJudgement.message ?? 'Space change refused by the previous type\'s driver.');
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
            let postClose: Awaited<ReturnType<typeof CollaborationEngine.Instance.ResolvePostCloseAccessForSpace>>;
            try {
                postClose = await CollaborationEngine.Instance.ResolvePostCloseAccessForSpace({
                    spaceId: this.ID,
                    currentConfig: parsedSpaceConfig,
                    parentId: this.ParentID,
                    spaceTypeId: this.SpaceTypeID,
                    provider: asMetadata(this.ProviderToUse) ?? Metadata.Provider,
                    contextUser: await requireSystemUser(this),
                });
            } catch (settingsError) {
                return fail(result, 'ClosedAt', settingsError instanceof Error ? settingsError.message : 'Space settings refused.');
            }
            this.PostCloseAccess = postClose.access;
            this.PostCloseAccessDays = postClose.days;
        }

        const { spaceKind: changeKind, childKind } = decideSpaceKinds({ isNew, isClosing, isReopening, isMoving });
        const oldValues = isNew ? {} : { ...this.dirtyOldValues(), ...(typeChanged ? { SpaceTypeID: previousTypeId } : {}) };
        // Decided once, here, and handed to the reaction after the save: the saved row no longer shows what changed
        this.decidedChange = { spaceKind: changeKind, childKind, oldValues };

        if (driver && spaceType) {
            const driverValidation = await driver.ValidateSpaceChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: this,
                spaceType: spaceType as mjBizAppsCollaborationSpaceTypeEntity,
                effectiveRules: adjustedRules,
                kind: changeKind,
                oldValues,
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
                    kind: childKind,
                    oldValues,
                });
                if (!childValidation.ok) {
                    return fail(result, childValidation.field ?? 'ParentID', childValidation.message ?? 'Child space change refused by parent driver.');
                }
                // The parent's type says which types may sit under it and how many may be open (created, moved in, or retyped)
                if (isNew || isMoving || typeChanged) {
                    const refusal = await this.refuseByParentType(parentInfo.spaceType.Configuration, parentId);
                    if (refusal) return fail(result, typeChanged && !isMoving && !isNew ? 'SpaceTypeID' : 'ParentID', refusal);
                }
            } catch (err) {
                return fail(result, 'ParentID', err instanceof Error ? err.message : 'Could not validate with parent driver.');
            }
        }

        // A move also asks the parent the space is leaving
        const oldParentId = isMoving ? parseUuid(String(this.Fields.find((f) => f.Name === 'ParentID')?.OldValue ?? '')) : null;
        if (oldParentId) {
            try {
                const oldParent = await ServerDriverRegistry.Instance.ResolveSpaceAndType(oldParentId, this);
                const outValidation = await oldParent.driver.ValidateChildSpaceChange({
                    actingUser: user,
                    provider: this.ProviderToUse,
                    space: oldParent.space,
                    spaceType: oldParent.spaceType,
                    effectiveRules: ResolveSpaceRules(null, null),
                    childSpace: this,
                    kind: 'MoveChildOut',
                    oldValues,
                });
                if (!outValidation.ok) {
                    return fail(result, outValidation.field ?? 'ParentID', outValidation.message ?? 'Child space change refused by the parent it leaves.');
                }
            } catch (err) {
                return fail(result, 'ParentID', err instanceof Error ? err.message : 'Could not validate with the parent it leaves.');
            }
        }

        return result;
    }

    /** Judges this space against its parent's type: allowed child types, and the most open children. Null when it may sit there. */
    private async refuseByParentType(parentTypeConfiguration: string | null, parentId: string): Promise<string | null> {
        let config: CollaborationSettings | null = null;
        try {
            config = parentTypeConfiguration ? JSON.parse(parentTypeConfiguration) as CollaborationSettings : null;
        } catch (error) {
            return `The parent's type has a configuration that does not parse: ${error instanceof Error ? error.message : String(error)}`;
        }
        let open = 0;
        if (config?.Children?.MaxOpen !== undefined) {
            const system = await requireSystemUser(this);
            const view = new RunView(this.RunViewProviderToUse);
            const siblings = await view.RunView<{ ID: string }>({
                EntityName: ENTITY,
                ExtraFilter: `ParentID = '${parentId}' AND ClosedAt IS NULL${this.IsSaved ? ` AND ID <> '${this.ID}'` : ''}`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, system);
            if (!siblings.Success) return `The open sub-spaces could not be counted: ${siblings.ErrorMessage ?? 'unknown error'}`;
            open = siblings.Results?.length ?? 0;
        }
        return refuseChildType(config, CollaborationEngine.Instance.SpaceTypeById(this.SpaceTypeID)?.Code, open);
    }

    /**
     * Asks the type's driver before the space is deleted (Delete on the space, and DeleteChild on its parent's driver).
     * Null when both accept.
     */
    private async driverRefusalForDelete(): Promise<string | null> {
        const user = this.ContextCurrentUser;
        if (!user || !this.IsSaved || !this.ID) return null;
        const own = await resolveSpaceDriver(this, this.ProviderToUse, user, this.ID);
        if (!own.ok) return own.message;
        const ownRefusal = refusalOf(await own.call.driver.ValidateSpaceChange({ ...own.call.base, kind: 'Delete' }));
        if (ownRefusal) return ownRefusal;
        const parentId = parseUuid(this.ParentID);
        if (!parentId) return null;
        const parent = await resolveSpaceDriver(this, this.ProviderToUse, user, parentId);
        if (!parent.ok) return parent.message;
        return refusalOf(await parent.call.driver.ValidateChildSpaceChange({ ...parent.call.base, childSpace: this, kind: 'DeleteChild' }));
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const refusal = await this.driverRefusalForDelete();
        if (refusal) return failDelete(this, refusal);
        return super.Delete(options);
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const wasClosed = !!this.Fields.find((f) => f.Name === 'ClosedAt')?.OldValue;
        const isNowClosed = !!this.ClosedAt;
        const justClosed = !wasClosed && isNowClosed;
        const justReopened = wasClosed && !isNowClosed;

        const parentChanged = this.Fields.some((f) => f.Name === 'ParentID' && f.Dirty);
        const inheritsChanged = this.Fields.some((f) => f.Name === 'InheritsMembership' && f.Dirty);
        const structureChanged = parentChanged || inheritsChanged;

        // What validation decided is taken and cleared before the save, so a second save of this object starts clean
        const decided = this.decidedChange;
        this.decidedChange = null;

        const ok = await super.Save(options);
        if (ok && this.ContextCurrentUser && this.ID) {
            const user = this.ContextCurrentUser;
            if (justClosed) {
                try {
                    const system = await requireSystemUser(this);
                    const view = new RunView(this.RunViewProviderToUse);
                    const chatsRes = await view.RunView<{ ID: string }>({
                        EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                        ExtraFilter: `SpaceID = '${this.ID}' AND Status = 'Active'`,
                        Fields: ['ID'],
                        ResultType: 'simple',
                    }, system);
                    if (!chatsRes.Success) {
                        LogError(`Failed to read active space chats on space close for space ${this.ID}: ${chatsRes.ErrorMessage ?? 'Unknown error'}`);
                    } else if (chatsRes.Results) {
                        const md = asMetadata(this.ProviderToUse) ?? new Metadata();
                        for (const row of chatsRes.Results) {
                            const chatObj = await md.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>('MJ_BizApps_Collaboration: Space Chats', system);
                            if (await chatObj.Load(row.ID)) {
                                chatObj.Status = 'Archived';
                                chatObj.ArchivedOnSpaceClose = true;
                                const chatSaved = await chatObj.Save();
                                if (!chatSaved) {
                                    LogError(`Failed to archive space chat ${row.ID}: ${chatObj.LatestResult?.CompleteMessage ?? ''}`);
                                }
                            }
                        }
                    }
                    const syncRes = await syncRoomEditGrantsForSpace(this.ProviderToUse, this.ID);
                    if (!syncRes.ok) {
                        LogError(`Room edit grants sync failed on space close for space ${this.ID}: ${syncRes.message ?? ''}`);
                    }
                } catch (closeErr) {
                    LogError(`Failed to archive space chats on space close: ${closeErr instanceof Error ? closeErr.message : String(closeErr)}`);
                }
            } else if (justReopened) {
                try {
                    const system = await requireSystemUser(this);
                    const view = new RunView(this.RunViewProviderToUse);
                    const chatsRes = await view.RunView<{ ID: string }>({
                        EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                        ExtraFilter: `SpaceID = '${this.ID}' AND Status = 'Archived' AND ArchivedOnSpaceClose = 1`,
                        Fields: ['ID'],
                        ResultType: 'simple',
                    }, system);
                    if (!chatsRes.Success) {
                        LogError(`Failed to read archived space chats on space reopen for space ${this.ID}: ${chatsRes.ErrorMessage ?? 'Unknown error'}`);
                    } else if (chatsRes.Results) {
                        const md = asMetadata(this.ProviderToUse) ?? new Metadata();
                        for (const row of chatsRes.Results) {
                            const chatObj = await md.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>('MJ_BizApps_Collaboration: Space Chats', system);
                            if (await chatObj.Load(row.ID)) {
                                chatObj.Status = 'Active';
                                chatObj.ArchivedOnSpaceClose = false;
                                const chatSaved = await chatObj.Save();
                                if (!chatSaved) {
                                    LogError(`Failed to restore space chat ${row.ID}: ${chatObj.LatestResult?.CompleteMessage ?? ''}`);
                                }
                            }
                        }
                    }
                    const syncRes = await syncRoomEditGrantsForSpace(this.ProviderToUse, this.ID);
                    if (!syncRes.ok) {
                        LogError(`Room edit grants sync failed on space reopen for space ${this.ID}: ${syncRes.message ?? ''}`);
                    }
                } catch (reopenErr) {
                    LogError(`Failed to restore space chats on space reopen: ${reopenErr instanceof Error ? reopenErr.message : String(reopenErr)}`);
                }
            }

            if (structureChanged) {
                try {
                    const syncRes = await syncRoomEditGrantsForSpace(this.ProviderToUse, this.ID);
                    if (!syncRes.ok) {
                        LogError(`Room edit grants sync failed on space structure change for space ${this.ID}: ${syncRes.message ?? ''}`);
                    }
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
                    kind: decided?.spaceKind ?? (justClosed ? 'Close' : justReopened ? 'Reopen' : 'Update'),
                    oldValues: decided?.oldValues,
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
                        kind: decided?.childKind ?? 'UpdateChild',
                        oldValues: decided?.oldValues,
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
