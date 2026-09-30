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
import { callerUuid, loadAncestorChain, mayAdminister, loadWriteContext, requireSystemUser } from './load-graph.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { failDelete, failSave, refusalOf, resolveSpaceDriver, sameSubtype, subtypeOf } from './space-driver-call.js';
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
    // A move outranks a close for the parent that receives the space. A save that closes or reopens and moves is refused in
    // validation, so this order is a second guard: if that refusal ever went, a rule on incoming children would still see the move.
    const childKind: ChildSpaceChangeKind = change.isNew ? 'CreateChild' : change.isMoving ? 'MoveChildIn' : change.isClosing ? 'CloseChild' : change.isReopening ? 'ReopenChild' : 'UpdateChild';
    return { spaceKind, childKind };
}

/**
 * A space type and its subtype go together. A type that names an IsA child of Spaces (`SpaceExtensionEntity`) creates its spaces as
 * that child: one save writes both tables, and a plain space can't be saved under it. A type that names none takes no subtype.
 * `actual` is the entity the save came through (MJ tells the parent's save which child started it), or null for a plain save.
 *
 * A saved space that already exists is judged only in the direction that can't strand it: a subtype under a type that doesn't
 * name it is always refused, but an existing plain space under a type that now names a subtype may still be edited (it has no
 * subtype row to write), where a new one may not be created. A change of type is not judged here: the two types must share a
 * subtype table, and that check names the reason.
 */
export function refuseSubtypePairing(input: { typeName: string; expected: string | null; actual: string | null; isNew: boolean; typeChanged: boolean }): string | null {
    if (input.typeChanged) return null;
    const same = (a: string | null, b: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
    if (!input.expected && input.actual) {
        return `Space type "${input.typeName}" names no subtype, so a ${input.actual} cannot be saved under it.`;
    }
    if (input.expected && input.actual && !same(input.expected, input.actual)) {
        return `Space type "${input.typeName}" names ${input.expected}, not ${input.actual}.`;
    }
    if (input.expected && !input.actual && input.isNew) {
        return `Space type "${input.typeName}" keeps its details in ${input.expected}: create the space as that (NewRecord, then Save) so one save writes both tables.`;
    }
    return null;
}

/** What a space save changes: read once, and handed to validation and to the reactions. */
interface SpaceChangeReading {
    spaceKind: SpaceChangeKind;
    childKind: ChildSpaceChangeKind;
    justClosed: boolean;
    justReopened: boolean;
    oldParentId: string | null;
    oldValues: Record<string, unknown>;
    changed: boolean;
}

@RegisterClass(BaseEntity, ENTITY)
export class SpaceEntityServer extends mjBizAppsCollaborationSpaceEntity {
    /** What each changed field held before this save, by field name. System columns are left out. */
    private dirtyOldValues(): Record<string, unknown> {
        const old: Record<string, unknown> = {};
        for (const field of this.Fields) {
            if (field.Dirty && !field.Name.startsWith('__mj_')) old[field.Name] = field.OldValue;
        }
        return old;
    }

    /** What this save changes, read once from the fields as they stand. Validation reads it before it rewrites anything, and `Save` before `super.Save()`. */
    private readChange(): SpaceChangeReading {
        const isNew = !this.IsSaved;
        const field = (name: string) => this.Fields.find((f) => f.Name === name);
        const wasClosed = !isNew && !!field('ClosedAt')?.OldValue;
        const nowClosed = !!getFieldVal<Date | null>(this, 'ClosedAt');
        // A create is never a close: a space made with a `ClosedAt` is refused in validation
        const justClosed = !isNew && !wasClosed && nowClosed;
        const justReopened = wasClosed && !nowClosed;
        const isMoving = !isNew && !!field('ParentID')?.Dirty;
        const typeField = field('SpaceTypeID');
        const typeChanged = !isNew && !!typeField?.Dirty;
        const kinds = decideSpaceKinds({ isNew, isClosing: justClosed, isReopening: justReopened, isMoving });
        return {
            ...kinds,
            justClosed,
            justReopened,
            oldParentId: isMoving ? parseUuid(String(field('ParentID')?.OldValue ?? '')) : null,
            oldValues: isNew ? {} : { ...this.dirtyOldValues(), ...(typeChanged ? { SpaceTypeID: typeField?.OldValue } : {}) },
            changed: isNew || this.Fields.some((f) => f.Dirty),
        };
    }

    /** The subtype entity this save comes through, from MJ's IsA orchestration; null for a plain save. */
    private savingAsSubtype: string | null = null;

    /** What `Save` read, handed to validation so a save has one reading. Validation called on its own reads for itself. */
    private readingForSave: SpaceChangeReading | null = null;

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
        // The reading `Save` took before the save, or, when validation is called on its own, one taken here before anything rewrites the row
        const change = this.readingForSave ?? this.readChange();
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const caller = callerUuid(user);
        if (!user || !caller) {
            return fail(result, 'OwnerID', 'Space change refused: there is no signed-in user.');
        }
        // A space that is created is created open: it closes later, so the close is a change the drivers and the chats hear
        if (!this.IsSaved && getFieldVal<Date | string | null>(this, 'ClosedAt')) {
            return fail(result, 'ClosedAt', 'Space change refused: a space is created open, and closed later.');
        }
        const dirty = this.Fields.filter((field) => field.Dirty);
        if (this.IsSaved && dirty.length === 0) {
            return result;
        }

        if (this.IsSaved) {
            const allowParentChanged = this.Fields.some((field) => field.Name === 'AllowParentAssignees' && field.Dirty);
            if (allowParentChanged && !mayAdminister(this, user)) {
                return fail(result, 'AllowParentAssignees', 'Space change refused: only someone with the Administer Spaces authorization may change the allow-parent-assignees setting.');
            }
            const agentRetrievalChanged = this.Fields.some((field) => field.Name === 'AgentRetrieval' && field.Dirty);
            if (agentRetrievalChanged && !mayAdminister(this, user)) {
                return fail(result, 'AgentRetrieval', 'Space change refused: only someone with the Administer Spaces authorization may change the agent retrieval setting.');
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

        // The type and its subtype go together (see refuseSubtypePairing)
        if (spaceType) {
            const typeFieldForPairing = this.Fields.find((f) => f.Name === 'SpaceTypeID');
            const pairing = refuseSubtypePairing({
                typeName: spaceType.Name || spaceType.Code || String(spaceType.ID),
                expected: subtypeOf(spaceType),
                actual: this.savingAsSubtype,
                isNew: !this.IsSaved,
                typeChanged: this.IsSaved && !!typeFieldForPairing?.Dirty,
            });
            if (pairing) return fail(result, 'SpaceTypeID', pairing);
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

        // Closing and reopening are governed by an authorization of their own, beside the owner seat the write rules already asked for
        if ((change.justClosed || change.justReopened)
            && !CollaborationEngine.Instance.UserHoldsLifecycleAuthorization(user, asMetadata(this.ProviderToUse) ?? Metadata.Provider)) {
            return fail(result, 'ClosedAt', `Space change refused: ${change.justClosed ? 'closing' : 'reopening'} a space needs the 'Close and Reopen Spaces' authorization and an owner seat on the space.`);
        }
        if (isClosing) {
            // One change at a time: a close that also moves the space would slip past the rules on incoming children
            if (change.oldParentId !== null || this.Fields.some((f) => f.Name === 'ParentID' && f.Dirty && this.IsSaved)) {
                return fail(result, 'ParentID', 'Space change refused: close a space and move it in separate saves.');
            }
        }
        // A closed space's date is the server's record of when it closed: only someone who may administer spaces (the world loader, tests) may restamp it
        const restamp = this.IsSaved && !!this.Fields.find((f) => f.Name === 'ClosedAt')?.OldValue && !!this.ClosedAt
            && this.Fields.some((f) => f.Name === 'ClosedAt' && f.Dirty);
        if (restamp && !mayAdminister(this, user)) {
            return fail(result, 'ClosedAt', 'Space change refused: the date a space closed cannot be changed.');
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
            const heldChildrenRefusal = await this.refuseByOwnNewType(spaceType.Configuration);
            if (heldChildrenRefusal) return fail(result, 'SpaceTypeID', heldChildrenRefusal);
            const previousType = previousTypeId ? CollaborationEngine.Instance.SpaceTypeById(previousTypeId) : undefined;
            if (!previousType) {
                return fail(result, 'SpaceTypeID', "Space change refused: the space's previous type could not be read.");
            }
            if (!sameSubtype(previousType, spaceType)) {
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
                subtypeEntityName: subtypeOf(previousType),
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
                // and refuse callers who may not administer spaces if their explicit choice differs from the type's default.
                //
                // Spaces are created on the server today, by the loader and EnsureSpaceForRecord.
                // When a new-space UI form is built, it must prefill the space type's defaults so that
                // someone who may administer spaces intentionally choosing the column default when the type's default differs can
                // be distinguished.
                const allowSpecified = this._callerSpecifiedAllowParentAssignees ||
                    (this._newRecordAllowParentAssignees !== undefined && this.AllowParentAssignees !== this._newRecordAllowParentAssignees);
                const agentSpecified = this._callerSpecifiedAgentRetrieval ||
                    (this._newRecordAgentRetrieval !== undefined && this.AgentRetrieval !== this._newRecordAgentRetrieval);

                if (!allowSpecified) {
                    this.AllowParentAssignees = defaultAllow;
                } else if (!mayAdminister(this, user) && this.AllowParentAssignees !== defaultAllow) {
                    return fail(result, 'AllowParentAssignees', 'Space change refused: only someone with the Administer Spaces authorization may change the allow-parent-assignees setting.');
                }

                if (!agentSpecified) {
                    this.AgentRetrieval = defaultAgent;
                } else if (!mayAdminister(this, user) && this.AgentRetrieval !== defaultAgent) {
                    return fail(result, 'AgentRetrieval', 'Space change refused: only someone with the Administer Spaces authorization may change the agent retrieval setting.');
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
            callerMayAdminister: mayAdminister(this, user),
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

        const { spaceKind: changeKind, childKind, oldValues } = change;

        if (driver && spaceType) {
            const driverValidation = await driver.ValidateSpaceChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: this,
                spaceType: spaceType as mjBizAppsCollaborationSpaceTypeEntity,
                effectiveRules: adjustedRules,
                subtypeEntityName: subtypeOf(spaceType),
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
                    subtypeEntityName: subtypeOf(parentInfo.spaceType),
                    childSpace: this,
                    kind: childKind,
                    oldValues,
                });
                if (!childValidation.ok) {
                    return fail(result, childValidation.field ?? 'ParentID', childValidation.message ?? 'Child space change refused by parent driver.');
                }
                // The parent's type says which types may sit under it and how many may be open (created, moved in, or retyped)
                if (isNew || isMoving || typeChanged || isReopening) {
                    const refusal = await this.refuseByParentType(parentInfo.spaceType.Configuration, parentId, spaceType?.Code);
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
                    subtypeEntityName: subtypeOf(oldParent.spaceType),
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

    /** Tells the drivers what happened. Each reaction has its own `try`, so a failing driver doesn't silence the next. */
    private async react(user: UserInfo, decided: SpaceChangeReading, tell: 'all' | 'own' = 'all'): Promise<void> {
        const base = { actingUser: user, provider: this.ProviderToUse, effectiveRules: ResolveSpaceRules(null, null) };
        // The type code is set once a reaction has resolved its type, so a failure after that names it; before that it says so
        let typeCode: string | undefined;
        const attempt = async (hook: string, run: () => Promise<void> | void): Promise<void> => {
            typeCode = undefined;
            try {
                await run();
            } catch (error) {
                LogError(`${hook} of space type '${typeCode ?? 'not resolved'}' failed for space ${this.ID}: ${error instanceof Error ? error.message : String(error)}`);
            }
        };
        await attempt('OnSpaceChanged', async () => {
            const spaceType = await ServerDriverRegistry.Instance.ResolveType(this.SpaceTypeID, this);
            typeCode = spaceType.Code;
            const driver = ServerDriverRegistry.Instance.GetDriverForType(spaceType);
            await driver.OnSpaceChanged({ ...base, space: this, spaceType, subtypeEntityName: subtypeOf(spaceType), kind: decided.spaceKind, oldValues: decided.oldValues });
        });
        if (tell === 'own') return;
        const parentId = getFieldVal<string | null>(this, 'ParentID');
        if (parentId) {
            await attempt('OnChildSpaceChanged', async () => {
                const parent = await ServerDriverRegistry.Instance.ResolveSpaceAndType(parentId, this);
                typeCode = parent.spaceType.Code;
                await parent.driver.OnChildSpaceChanged({ ...base, space: parent.space, spaceType: parent.spaceType, subtypeEntityName: subtypeOf(parent.spaceType), childSpace: this, kind: decided.childKind, oldValues: decided.oldValues });
            });
        }
        if (decided.oldParentId) {
            await attempt('OnChildSpaceChanged (MoveChildOut)', async () => {
                const left = await ServerDriverRegistry.Instance.ResolveSpaceAndType(decided.oldParentId!, this);
                typeCode = left.spaceType.Code;
                await left.driver.OnChildSpaceChanged({ ...base, space: left.space, spaceType: left.spaceType, subtypeEntityName: subtypeOf(left.spaceType), childSpace: this, kind: 'MoveChildOut', oldValues: decided.oldValues });
            });
        }
    }

    /** Judges this space against its parent's type: allowed child types, and the most open children. Null when it may sit there. */
    private async refuseByParentType(parentTypeConfiguration: string | null, parentId: string, resolvedTypeCode: string | undefined): Promise<string | null> {
        let config: CollaborationSettings | null = null;
        try {
            config = parentTypeConfiguration ? JSON.parse(parentTypeConfiguration) as CollaborationSettings : null;
        } catch (error) {
            return `The parent's type has a configuration that does not parse: ${error instanceof Error ? error.message : String(error)}`;
        }
        let open = 0;
        // A space that stays closed adds no open sub-space, so only an open one is counted against the limit
        const staysClosed = !!getFieldVal<Date | string | null>(this, 'ClosedAt') && !this.Fields.some((f) => f.Name === 'ClosedAt' && f.Dirty);
        if (config?.Children?.MaxOpen !== undefined && !staysClosed) {
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
        // The type validation already resolved is the one to name: the engine's cache may not hold a type that was just created
        return refuseChildType(config, resolvedTypeCode ?? CollaborationEngine.Instance.SpaceTypeById(this.SpaceTypeID)?.Code, open);
    }

    /** When this space's own type changes, the children it already holds must fit the new type's `Children` rules. Null when they do. */
    private async refuseByOwnNewType(newTypeConfiguration: string | null): Promise<string | null> {
        let config: CollaborationSettings | null = null;
        try {
            config = newTypeConfiguration ? JSON.parse(newTypeConfiguration) as CollaborationSettings : null;
        } catch (error) {
            return `The new type has a configuration that does not parse: ${error instanceof Error ? error.message : String(error)}`;
        }
        if (!config?.Children) return null;
        const system = await requireSystemUser(this);
        const view = new RunView(this.RunViewProviderToUse);
        const children = await view.RunView<{ SpaceTypeID: string; ClosedAt: Date | null }>({
            EntityName: ENTITY,
            ExtraFilter: `ParentID = '${this.ID}'`,
            Fields: ['SpaceTypeID', 'ClosedAt'],
            ResultType: 'simple',
        }, system);
        if (!children.Success) return `The sub-spaces could not be read: ${children.ErrorMessage ?? 'unknown error'}`;
        const rows = children.Results ?? [];
        const open = rows.filter((row) => !row.ClosedAt).length;
        const name = this.Name || 'This space';
        for (const row of rows) {
            let code: string | undefined;
            try {
                // Resolved through the registry, which reads a type the engine's cache may not hold yet
                code = (await ServerDriverRegistry.Instance.ResolveType(row.SpaceTypeID, this)).Code;
            } catch (error) {
                return `${name} holds a sub-space whose type could not be read: ${error instanceof Error ? error.message : String(error)}`;
            }
            const refusal = refuseChildType({ Children: { AllowedTypeCodes: config.Children.AllowedTypeCodes } }, code, 0);
            if (refusal) return `${name} already holds a sub-space its new type does not allow: ${refusal}`;
        }
        if (config.Children.MaxOpen !== undefined && open > config.Children.MaxOpen) {
            return `${name} already holds ${open} open sub-spaces, more than its new type allows (${config.Children.MaxOpen}).`;
        }
        return null;
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
        // A space with its subtype attached is deleted through it: core hands the delete to the subtype, which deletes its own row and
        // comes back for this one with IsParentEntityDelete, inside one transaction. The driver is asked once, when the delete reaches
        // this row, whichever side it started from.
        if (this.LeafEntity === this || options?.IsParentEntityDelete) {
            const refusal = await this.driverRefusalForDelete();
            if (refusal) return failDelete(this, refusal);
        }
        return super.Delete(options);
    }

    /** What the subtype's own columns held before this save, by name: only the columns that changed. Empty when nothing did. */
    private subtypeOldValues(): Record<string, unknown> {
        const oldValues: Record<string, unknown> = {};
        for (const field of this.LeafEntity.Fields) {
            if (field.Dirty && !field.Name.startsWith('__mj_')) oldValues[field.Name] = field.OldValue;
        }
        return oldValues;
    }

    /**
     * The space's rules for a change, for a save whose only change is in its subtype's own columns (MJ validates a parent only when
     * the parent itself changed): the right that Settings asks for, and the type's driver, told the subtype's old values.
     */
    private async refuseSubtypeOnlyChange(user: UserInfo, oldValues: Record<string, unknown>): Promise<string | null> {
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;
        if (!(await CollaborationEngine.Instance.UserCanConfigureSpaces(user, this.ID, md))) {
            return "Space change refused: changing a space's details needs the 'Configure Spaces' authorization and an owner seat on the space.";
        }
        const resolved = await resolveSpaceDriver(this, this.ProviderToUse, user, this.ID);
        if (!resolved.ok) return resolved.message;
        // The space being saved, not the stored one: its LeafEntity carries the subtype's new values, as `oldValues` carries the old
        return refusalOf(await resolved.call.driver.ValidateSpaceChange({ ...resolved.call.base, space: this, kind: 'Update', oldValues }));
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        // One reading per save: taken here, before anything changes a field, handed to validation, and used by the reactions.
        // Dropped when the save is done, so a retry starts clean.
        const own = this.readChange();
        this.readingForSave = own;
        // MJ tells a parent's save which child started it: that is the subtype this save writes (null for a plain save)
        this.savingAsSubtype = options?.ISAActiveChildEntityName ?? null;
        // The server's clock decides when a space closed. Someone who holds the Administer Spaces authorization (the world loader, tests) may backdate one; a date ahead of the
        // server, from anyone, is the server's own time (a browser's clock can run ahead of it).
        const signedIn = this.ContextCurrentUser;
        // A re-stamp of a closed space by someone who may administer spaces follows the same rule: a date ahead of the server is the server's own time
        if (signedIn && this.ClosedAt && !!this.Fields.find((f) => f.Name === 'ClosedAt')?.Dirty) {
            const sent = new Date(this.ClosedAt).getTime();
            if ((own.justClosed && !mayAdminister(this, signedIn)) || !(sent <= Date.now())) this.ClosedAt = new Date();
        }
        const justClosed = own.justClosed;
        const justReopened = own.justReopened;
        const parentChanged = this.Fields.some((f) => f.Name === 'ParentID' && f.Dirty);
        const inheritsChanged = this.Fields.some((f) => f.Name === 'InheritsMembership' && f.Dirty);
        const structureChanged = parentChanged || inheritsChanged;

        // A subtype's own columns can change with the space itself untouched: MJ then saves the space first and skips its validation,
        // so the space's rules for a change are applied here, with the subtype's changed columns and what they held. The subtype is in
        // reach whichever side the save started from: loaded through the space, or built on its own and linked back to the space it
        // made. MJ saves the parent chain whether or not the subtype is dirty, so a save that changes nothing has nothing to
        // judge, and nobody is asked or told.
        // The subtype that is saving this space has to be in reach: a space has one subtype, and MJ links the space to it. Were the
        // link missing, the subtype's changes couldn't be seen, and a change to only its columns would pass unjudged. That is an
        // invariant, checked: the save is refused rather than let through.
        if (this.savingAsSubtype && this.LeafEntity === this) {
            this.readingForSave = null;
            this.savingAsSubtype = null;
            return failSave(this, "Space change refused: the space can't see the subtype that is saving it, so its change can't be judged.");
        }
        const subtypeOldValues = this.savingAsSubtype && this.IsSaved && !own.changed ? this.subtypeOldValues() : null;
        const subtypeOnlyChange = subtypeOldValues !== null && Object.keys(subtypeOldValues).length > 0;
        if (subtypeOnlyChange) {
            const refusal = signedIn ? await this.refuseSubtypeOnlyChange(signedIn, subtypeOldValues) : 'Space change refused: there is no signed-in user.';
            if (refusal) {
                this.readingForSave = null;
                this.savingAsSubtype = null;
                return failSave(this, refusal);
            }
        }

        let ok = false;
        try {
            ok = await super.Save(options);
        } finally {
            this.readingForSave = null;
            this.savingAsSubtype = null;
        }
        const decided = own;
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

            // Nothing changed, nothing to tell: MJ's Save returns true for a clean record without writing it. A change to only the
            // subtype's columns is told to the space's own driver as an Update, as it was asked: it is no child's change to the parent's.
            if (decided.changed) await this.react(user, decided);
            else if (subtypeOnlyChange) await this.react(user, { ...decided, changed: true, spaceKind: 'Update', childKind: 'UpdateChild', oldValues: subtypeOldValues }, 'own');

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
