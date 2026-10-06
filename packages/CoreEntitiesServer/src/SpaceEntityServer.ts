import { BaseEntity, type FieldValueCollection, type IMetadataProvider, LogError, Metadata, RunView, type RunViewParams, type RunViewResult, type UserInfo, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    authorizeSpaceWrite,
    chainsForSpaceWrite,
    membershipReaches,
    parentCreatesCycle,
    refuseChildType,
    planSpaceWrite,
    RulesOf,
    statusChangeRefusal,
    ValidateCollaborationSettings,
    type CollaborationSettings,
    type ISpaceConfiguration,
    type ISpaceTypeConfiguration,
    type SpaceTypeStatusAttributes,
    typeSeatsAudience,
} from '@mj-biz-apps/collaboration-core';
import {
    mjBizAppsCollaborationSpaceAnchorEntity,
    mjBizAppsCollaborationSpaceChatEntity,
    mjBizAppsCollaborationSpaceEntity,
    type mjBizAppsCollaborationSpaceTypeEntity,
    type mjBizAppsCollaborationSpaceTypeStatusEntity,
} from '@mj-biz-apps/collaboration-entities';
import { type BaseSpaceTypeServerDriver, type ChildSpaceChangeKind, type SpaceChangeKind } from './base-space-type-server-driver.js';
import { CollaborationEngine } from './CollaborationEngine.js';
import { callerUuid, loadAncestorChain, mayAdminister, loadWriteContext, requireSystemUser } from './load-graph.js';
import { primaryAnchorCollision } from './SpaceAnchorEntityServer.js';
import { spaceSeatsParticipants } from './space-audience.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { failDelete, failSave, refusalOf, resolveSpaceDriver, sameSubtype, subtypeOf, driverBaseContext } from './space-driver-call.js';
import { notifySpaceLifecycleSubscribers } from './space-lifecycle-subscribers.js';
import { syncRoomEditGrantsForSpace } from './room-edit-grants.js';
import { notifySpaceStatusChange } from './space-status-notices.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Spaces';

/**
 * The kinds of change a space save is, for the space's own driver and for its parent's: a create; a close (the space enters a
 * terminal status); a reopen (it leaves a read-only status for a writable one); another status change; a move (only when the
 * parent changed); else an update. A child's rename is an UpdateChild, so rules on children still see it; so is a status change
 * that is neither a close nor a reopen.
 */
export function decideSpaceKinds(change: { isNew: boolean; isClosing: boolean; isReopening: boolean; isStatusChange?: boolean; isMoving: boolean }): { spaceKind: SpaceChangeKind; childKind: ChildSpaceChangeKind } {
    const spaceKind: SpaceChangeKind = change.isNew ? 'Create' : change.isClosing ? 'Close' : change.isReopening ? 'Reopen' : change.isStatusChange ? 'StatusChange' : change.isMoving ? 'Move' : 'Update';
    // A move outranks a close for the parent that receives the space. A save that changes status and moves is refused in
    // validation, so this order is a second guard: if that refusal ever went, a rule on incoming children would still see the move.
    const childKind: ChildSpaceChangeKind = change.isNew ? 'CreateChild' : change.isMoving ? 'MoveChildIn' : change.isClosing ? 'CloseChild' : change.isReopening ? 'ReopenChild' : 'UpdateChild';
    return { spaceKind, childKind };
}

/** A status row as the rules read it. */
function statusAttributes(status: mjBizAppsCollaborationSpaceTypeStatusEntity): SpaceTypeStatusAttributes {
    return {
        ID: status.ID, Code: status.Code, Name: status.Name, Sequence: Number(status.Sequence), IsDefault: !!status.IsDefault, ReadOnly: !!status.ReadOnly,
        Visible: !!status.Visible, AgentRetrieval: !!status.AgentRetrieval, CanChangeAfter: !!status.CanChangeAfter, NotifyMembersOnEnter: !!status.NotifyMembersOnEnter, IsTerminal: !!status.IsTerminal,
    };
}

const sameId = (a: string | null | undefined, b: string | null | undefined): boolean => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

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

/**
 * What a space save changes: read once from the fields, refined by validation once the type's statuses are known (the status the
 * space leaves and enters, whether that is a close or a reopen), and handed to the reactions.
 */
interface SpaceChangeReading {
    spaceKind: SpaceChangeKind;
    childKind: ChildSpaceChangeKind;
    justClosed: boolean;
    justReopened: boolean;
    /** What the ClosedAt field asked for, the old way: set on an open space, or cleared on a closed one. */
    closeRequested: boolean;
    reopenRequested: boolean;
    /** The status the space leaves and the one it enters, as validation resolved them; null for a type with no statuses. */
    statusFrom: SpaceTypeStatusAttributes | null;
    statusTo: SpaceTypeStatusAttributes | null;
    /** Whether the save moves the space to another status (a stamp of the status an unstamped space already derived is no move). */
    statusChanged: boolean;
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
        const closedDirty = !isNew && !!field('ClosedAt')?.Dirty;
        // A create is never a close: a space made with a `ClosedAt` is refused in validation
        const closeRequested = closedDirty && !wasClosed && nowClosed;
        const reopenRequested = closedDirty && wasClosed && !nowClosed;
        const statusDirty = !isNew && !!field('StatusID')?.Dirty;
        const isMoving = !isNew && !!field('ParentID')?.Dirty;
        const typeField = field('SpaceTypeID');
        const typeChanged = !isNew && !!typeField?.Dirty;
        // A first reading, from the fields alone; validation refines it once the type's statuses are known
        const kinds = decideSpaceKinds({ isNew, isClosing: closeRequested, isReopening: reopenRequested, isStatusChange: statusDirty && !closeRequested && !reopenRequested, isMoving });
        return {
            ...kinds,
            justClosed: closeRequested,
            justReopened: reopenRequested,
            closeRequested,
            reopenRequested,
            statusFrom: null,
            statusTo: null,
            statusChanged: statusDirty || closedDirty,
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
        const isMoving = this.IsSaved && this.Fields.some((f) => f.Name === 'ParentID' && f.Dirty);
        const typeField = this.Fields.find((f) => f.Name === 'SpaceTypeID');
        const typeChanged = this.IsSaved && !!typeField?.Dirty;
        const previousTypeId = typeChanged && typeField?.OldValue ? parseUuid(String(typeField.OldValue)) : null;
        const md = asMetadata(this.ProviderToUse) ?? Metadata.Provider;

        // ── Statuses (stage 1) ────────────────────────────────────────────────────────────────────────────────────────────
        // The status the space is in as the row stood, and the one this save puts it in: the one it names; on a retype the new
        // type's status with the same code, else its default; the old way, by ClosedAt alone, read as a move to the type's first
        // terminal status or back to its default; for a new space its type's default. A type with no statuses yet reads from
        // ClosedAt alone, as the access functions do.
        const engine = CollaborationEngine.Instance;
        const statusField = this.Fields.find((f) => f.Name === 'StatusID');
        const closedField = this.Fields.find((f) => f.Name === 'ClosedAt');
        const statusDirty = this.IsSaved && !!statusField?.Dirty;
        const closedDirty = this.IsSaved && !!closedField?.Dirty;
        const statusIdNow = getFieldVal<string | null>(this, 'StatusID') ?? null;
        const closedAtNow = getFieldVal<Date | string | null>(this, 'ClosedAt') ?? null;
        const fromEntity = this.IsSaved ? engine.EffectiveStatusForSpace({
            StatusID: statusDirty ? (statusField?.OldValue as string | null | undefined) : statusIdNow,
            SpaceTypeID: previousTypeId ?? typeId,
            ClosedAt: closedDirty ? (closedField?.OldValue as string | Date | null | undefined) : closedAtNow,
        }) : undefined;
        let toEntity: mjBizAppsCollaborationSpaceTypeStatusEntity | undefined;
        let statusRefusalField = 'StatusID';
        if (!this.IsSaved) {
            if (statusIdNow) {
                toEntity = engine.StatusById(statusIdNow);
                if (!toEntity || !sameId(toEntity.SpaceTypeID, typeId)) return fail(result, 'StatusID', "Space change refused: the status is not one of the space type's.");
                if (toEntity.IsTerminal) return fail(result, 'StatusID', 'Space change refused: a space is created open, and closed later.');
            } else {
                toEntity = engine.DefaultStatusForType(typeId);
                if (toEntity) setFieldVal(this, 'StatusID', toEntity.ID);
            }
        } else if (typeChanged) {
            if (fromEntity && !fromEntity.CanChangeAfter && !mayAdminister(this, user)) {
                return fail(result, 'SpaceTypeID', `Space change refused: a space that is ${fromEntity.Name} cannot change.`);
            }
            if (statusDirty && statusIdNow) {
                toEntity = engine.StatusById(statusIdNow);
                if (!toEntity || !sameId(toEntity.SpaceTypeID, typeId)) return fail(result, 'StatusID', "Space change refused: the status is not one of the new type's.");
            } else {
                toEntity = engine.StatusByCode(typeId, fromEntity?.Code) ?? engine.DefaultStatusForType(typeId);
                if (!sameId(toEntity?.ID, statusIdNow) && (toEntity || statusIdNow)) setFieldVal(this, 'StatusID', toEntity?.ID ?? null);
            }
        } else if (statusDirty) {
            if (!statusIdNow) return fail(result, 'StatusID', "Space change refused: a space's status is one of its type's; it cannot be cleared.");
            toEntity = engine.StatusById(statusIdNow);
            if (!toEntity || !sameId(toEntity.SpaceTypeID, typeId)) return fail(result, 'StatusID', "Space change refused: the status is not one of the space type's.");
        } else if (closedDirty) {
            statusRefusalField = 'ClosedAt';
            if (change.closeRequested) toEntity = engine.FirstTerminalStatusForType(typeId);
            else if (change.reopenRequested) toEntity = engine.DefaultStatusForType(typeId);
            else toEntity = fromEntity;
            if (toEntity && (change.closeRequested || change.reopenRequested)) setFieldVal(this, 'StatusID', toEntity.ID);
        } else {
            toEntity = fromEntity;
        }
        const from = fromEntity ? statusAttributes(fromEntity) : null;
        const to = toEntity ? statusAttributes(toEntity) : null;
        const statusMoves = this.IsSaved && !!to && (!from || !sameId(from.ID, to.ID));
        if (statusMoves && to && from && !typeChanged) {
            const refusal = statusChangeRefusal(from, to);
            if (refusal) return fail(result, statusRefusalField, `Space change refused: ${refusal.message}`);
        }
        // Closing and reopening, and every other status change, are governed by an authorization of their own, beside the owner
        // seat the write rules ask for; the seat is found with the status filter off, so the owner of a hidden space is still its owner
        const legacyLifecycle = this.IsSaved && !to && (change.closeRequested || change.reopenRequested);
        if ((statusMoves || legacyLifecycle) && !(await engine.UserCanChangeSpaceStatus(user, this.ID, md))) {
            return fail(result, statusRefusalField, "Space change refused: changing a space's status needs the 'Close and Reopen Spaces' authorization and an owner seat on the space.");
        }
        if ((statusMoves || legacyLifecycle) && !typeChanged) {
            // One change at a time: a status change that also moved the space would slip past the rules on incoming children, and one
            // that also edited it would let an edit into a read-only space
            const otherDirty = this.Fields.filter((f) => f.Dirty && f.Name !== 'StatusID' && f.Name !== 'ClosedAt' && !f.Name.startsWith('__mj_'));
            if (otherDirty.length > 0) {
                return fail(result, otherDirty[0].Name, otherDirty[0].Name === 'ParentID'
                    ? "Space change refused: change a space's status and move it in separate saves."
                    : "Space change refused: a status change is a save of its own; change the other fields separately.");
            }
        } else if (this.IsSaved && from?.ReadOnly && !mayAdminister(this, user)) {
            // A read-only status takes every write but a status change away
            const edited = this.Fields.filter((f) => f.Dirty && !f.Name.startsWith('__mj_'));
            if (edited.length > 0) return fail(result, edited[0].Name, `Space change refused: the space is ${from.Name} and takes no changes but a status change.`);
        }
        // Entering a terminal status stamps ClosedAt with the server's clock; someone who may administer spaces (the world loader,
        // tests) may backdate it, and a date ahead of the server is the server's own time
        const entersTerminal = statusMoves && !!to?.IsTerminal && !from?.IsTerminal;
        const stampClose = entersTerminal || (legacyLifecycle && change.closeRequested);
        if (stampClose) {
            const sent = closedDirty && closedAtNow ? new Date(closedAtNow).getTime() : Number.NaN;
            if (!(closedDirty && mayAdminister(this, user) && Number.isFinite(sent) && sent <= Date.now())) setFieldVal(this, 'ClosedAt', new Date());
        } else if (closedDirty && closedAtNow && !change.closeRequested) {
            // A closed space's date is the server's record of when it closed: only someone who may administer spaces may restamp it
            if (!mayAdminister(this, user)) return fail(result, 'ClosedAt', 'Space change refused: the date a space closed cannot be changed.');
            if (new Date(closedAtNow).getTime() > Date.now()) setFieldVal(this, 'ClosedAt', new Date());
        }
        if (to && !to.IsTerminal && getFieldVal<Date | string | null>(this, 'ClosedAt') && (statusMoves || typeChanged)) setFieldVal(this, 'ClosedAt', null);
        // The reading, refined: what the drivers and the reactions are told
        change.statusFrom = from;
        change.statusTo = to;
        change.statusChanged = statusMoves;
        change.justClosed = stampClose;
        change.justReopened = (statusMoves && !!from?.ReadOnly && !!to && !to.ReadOnly) || (legacyLifecycle && change.reopenRequested);
        const refined = decideSpaceKinds({ isNew: !this.IsSaved, isClosing: change.justClosed, isReopening: change.justReopened, isStatusChange: statusMoves && !change.justClosed && !change.justReopened, isMoving });
        change.spaceKind = refined.spaceKind;
        change.childKind = refined.childKind;
        const isReopening = change.justReopened;

        if (configDirty) {
            const canConfig = await CollaborationEngine.Instance.UserCanConfigureSpaces(
                user,
                this.IsSaved ? this.ID : null,
                md
            );
            if (!canConfig) {
                return fail(result, 'Configuration', "Space change refused: user lacks 'Configure Spaces' authorization or does not hold an owner role on this space.");
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
        if (typeChanged && spaceType) {
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
            if (previousType.Configuration) {
                try {
                    JSON.parse(previousType.Configuration) as ISpaceTypeConfiguration;
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
            let previousConfiguration;
            try {
                previousConfiguration = await ServerDriverRegistry.Instance.ConfigurationFor({ ID: this.ID, ParentID: parseUuid(String(getFieldVal<string | null>(this, 'ParentID') ?? '')) ?? null, SpaceTypeID: previousTypeId, Configuration: rawConfig ?? null }, this.ProviderToUse);
            } catch (chainErr) {
                return fail(result, 'SpaceTypeID', chainErr instanceof Error ? chainErr.message : "Space change refused: the space's configuration under its previous type could not be resolved.");
            }
            const previousJudgement = await previousDriver.ValidateSpaceChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: this,
                spaceType: previousType,
                configuration: previousConfiguration,
                effectiveRules: RulesOf(previousConfiguration),
                subtypeEntityName: subtypeOf(previousType),
                kind: 'Update',
                oldValues: { SpaceTypeID: previousTypeId },
            });
            if (!previousJudgement.ok) {
                return fail(result, previousJudgement.field ?? 'SpaceTypeID', previousJudgement.message ?? 'Space change refused by the previous type\'s driver.');
            }
        }

        // The one configuration (B16): the app, the type, the same-type run and this space as the save holds it, before it is written
        let configuration;
        try {
            configuration = await ServerDriverRegistry.Instance.ConfigurationFor({ ID: this.ID, ParentID: parseUuid(String(getFieldVal<string | null>(this, 'ParentID') ?? '')) ?? null, SpaceTypeID: typeId, Configuration: rawConfig ?? null }, this.ProviderToUse);
        } catch (chainErr) {
            return fail(result, 'Configuration', chainErr instanceof Error ? chainErr.message : "Space change refused: the space's configuration could not be resolved.");
        }
        const effectiveRules = RulesOf(configuration);
        const adjustedRules = driver && spaceType
            ? await driver.AdjustRules(
                { actingUser: user, provider: this.ProviderToUse, space: this, spaceType, configuration, effectiveRules },
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
        const here = hereId && hereContext ? membershipReaches(hereContext.spaces, hereContext.memberships, caller, hereId, new Date(), statusMoves || legacyLifecycle) : null;
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
        const { spaceKind: changeKind, childKind, oldValues } = change;
        const statusChange = change.statusChanged || change.justClosed || change.justReopened
            ? { fromCode: change.statusFrom?.Code ?? null, toCode: change.statusTo?.Code ?? null }
            : undefined;

        if (driver && spaceType) {
            const driverValidation = await driver.ValidateSpaceChange({
                actingUser: user,
                provider: this.ProviderToUse,
                space: this,
                spaceType: spaceType as mjBizAppsCollaborationSpaceTypeEntity,
                configuration,
                effectiveRules: adjustedRules,
                subtypeEntityName: subtypeOf(spaceType),
                kind: changeKind,
                oldValues,
                statusChange,
            });
            if (!driverValidation.ok) {
                return fail(result, driverValidation.field ?? 'ID', driverValidation.message ?? 'Space change refused by driver.');
            }
        }

        if (parentId) {
            try {
                const parentInfo = await ServerDriverRegistry.Instance.ResolveSpaceAndType(parentId, this);
                const childValidation = await parentInfo.driver.ValidateChildSpaceChange({
                    ...(await driverBaseContext(this.ProviderToUse, user, parentInfo.space, parentInfo.spaceType, parentInfo.configuration)),
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
                    ...(await driverBaseContext(this.ProviderToUse, user, oldParent.space, oldParent.spaceType, oldParent.configuration)),
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

        // ── The staff-only promise (item 157) and the anchors a retype carries (item 149) ────────────────────────────────────────
        // A type that seats staff only may carry grants of a view, a query or a component, so none of its spaces may be reached by
        // a participant: a space of the type does not inherit membership from a parent that participants reach (at create, and when
        // the parent, the inheritance or the type changes), and a space that participants reach does not move onto such a type. And a
        // retype keeps the space's anchors, so it is refused where another space of the new type already holds its primary anchor.
        {
            const staffOnly = typeSeatsAudience((typeConfig ?? null) as CollaborationSettings | null) === 'StaffOnly';
            const parentNow = parseUuid(String(getFieldVal<string>(this, 'ParentID') ?? ''));
            const inheritsNow = !!getFieldVal<boolean>(this, 'InheritsMembership');
            const inheritsDirty = this.IsSaved && this.Fields.some((f) => f.Name === 'InheritsMembership' && f.Dirty);
            const parentDirty = this.IsSaved && this.Fields.some((f) => f.Name === 'ParentID' && f.Dirty);
            const savedId = this.IsSaved ? parseUuid(String(getFieldVal<string>(this, 'ID') ?? '')) : null;
            const needsPromise = staffOnly && ((inheritsNow && !!parentNow && (!this.IsSaved || inheritsDirty || parentDirty || typeChanging)) || (typeChanging && !!savedId));
            if (needsPromise || (typeChanging && savedId && typeId)) {
                let system: UserInfo;
                try {
                    system = await requireSystemUser(this);
                } catch (error) {
                    return fail(result, 'SpaceTypeID', `Space change refused: the system user could not read the roster: ${error instanceof Error ? error.message : String(error)}`);
                }
                const rv = new RunView(this.RunViewProviderToUse);
                if (staffOnly && inheritsNow && parentNow && (!this.IsSaved || inheritsDirty || parentDirty || typeChanging)) {
                    try {
                        if (await spaceSeatsParticipants(rv, system, parentNow)) {
                            return fail(result, 'InheritsMembership', 'Space change refused: a space of a type that seats staff only cannot inherit membership from a parent that participants reach.');
                        }
                    } catch (error) {
                        return fail(result, 'InheritsMembership', `Space change refused: the parent's roster could not be read: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                if (staffOnly && typeChanging && savedId) {
                    try {
                        if (await spaceSeatsParticipants(rv, system, savedId)) {
                            return fail(result, 'SpaceTypeID', 'Space change refused: participants reach this space, and the new type seats staff only.');
                        }
                    } catch (error) {
                        return fail(result, 'SpaceTypeID', `Space change refused: the roster could not be read: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                if (typeChanging && savedId && typeId) {
                    try {
                        const collision = await primaryAnchorCollision(rv, system, savedId, typeId);
                        if (collision) {
                            return fail(result, 'SpaceTypeID', `Space change refused: ${collision.space} of the new type is already anchored to ${collision.entity} ${collision.recordId}; a record anchors one space of a type.`);
                        }
                    } catch (error) {
                        return fail(result, 'SpaceTypeID', `Space change refused: the anchors could not be read: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
        }

        return result;
    }

    /**
     * Tells the drivers what happened. Each reaction has its own `try`, so a failing driver doesn't silence the next; what failed is
     * logged and returned, so a scoped save can take itself back (item 35).
     */
    private async react(user: UserInfo, decided: SpaceChangeReading, tell: 'all' | 'own' = 'all'): Promise<string[]> {
        const base = { actingUser: user, provider: this.ProviderToUse };
        const failures: string[] = [];
        // The type code is set once a reaction has resolved its type, so a failure after that names it; before that it says so
        let typeCode: string | undefined;
        const attempt = async (hook: string, run: () => Promise<void> | void): Promise<void> => {
            typeCode = undefined;
            try {
                await run();
            } catch (error) {
                const message = `${hook} of space type '${typeCode ?? 'not resolved'}' failed for space ${this.ID}: ${error instanceof Error ? error.message : String(error)}`;
                LogError(message);
                failures.push(message);
            }
        };
        await attempt('OnSpaceChanged', async () => {
            const spaceType = await ServerDriverRegistry.Instance.ResolveType(this.SpaceTypeID, this);
            typeCode = spaceType.Code;
            const driver = ServerDriverRegistry.Instance.GetDriverForType(spaceType);
            const statusChange = decided.statusChanged || decided.justClosed || decided.justReopened
                ? { fromCode: decided.statusFrom?.Code ?? null, toCode: decided.statusTo?.Code ?? null }
                : undefined;
            await driver.OnSpaceChanged({ ...base, ...(await driverBaseContext(this.ProviderToUse, user, this, spaceType)), kind: decided.spaceKind, oldValues: decided.oldValues, statusChange });
        });
        if (tell === 'own') return failures;
        const parentId = getFieldVal<string | null>(this, 'ParentID');
        if (parentId) {
            await attempt('OnChildSpaceChanged', async () => {
                const parent = await ServerDriverRegistry.Instance.ResolveSpaceAndType(parentId, this);
                typeCode = parent.spaceType.Code;
                await parent.driver.OnChildSpaceChanged({ ...base, ...(await driverBaseContext(this.ProviderToUse, user, parent.space, parent.spaceType, parent.configuration)), childSpace: this, kind: decided.childKind, oldValues: decided.oldValues });
            });
        }
        if (decided.oldParentId) {
            await attempt('OnChildSpaceChanged (MoveChildOut)', async () => {
                const left = await ServerDriverRegistry.Instance.ResolveSpaceAndType(decided.oldParentId!, this);
                typeCode = left.spaceType.Code;
                await left.driver.OnChildSpaceChanged({ ...base, ...(await driverBaseContext(this.ProviderToUse, user, left.space, left.spaceType, left.configuration)), childSpace: this, kind: 'MoveChildOut', oldValues: decided.oldValues });
            });
        }
        return failures;
    }

    /** The code of this space's type, for the lifecycle subscribers that listen to some types only (item 86). Null when it cannot be read. */
    private async typeCodeForSubscribers(): Promise<string | null> {
        try {
            return (await ServerDriverRegistry.Instance.ResolveType(this.SpaceTypeID, this)).Code ?? null;
        } catch {
            return null;
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

    /** A retype's anchors follow the space (item 149): their SpaceTypeID is rewritten as the system user, after the space is saved. */
    private async carryAnchorsToType(typeId: string): Promise<void> {
        const ANCHORS = 'MJ_BizApps_Collaboration: Space Anchors';
        try {
            const system = await requireSystemUser(this);
            const view = new RunView(this.RunViewProviderToUse);
            const anchors = await view.RunView<{ ID: string }>({
                EntityName: ANCHORS,
                ExtraFilter: `SpaceID = '${this.ID}' AND SpaceTypeID <> '${typeId}'`,
                Fields: ['ID'],
                ResultType: 'simple',
            }, system);
            if (!anchors.Success) {
                LogError(`The anchors of space ${this.ID} could not be read after its retype: ${anchors.ErrorMessage ?? 'unknown error'}`);
                return;
            }
            const md = asMetadata(this.ProviderToUse) ?? new Metadata();
            for (const row of anchors.Results ?? []) {
                const anchor = await md.GetEntityObject<mjBizAppsCollaborationSpaceAnchorEntity>(ANCHORS, system);
                if (!(await anchor.Load(row.ID))) continue;
                anchor.SpaceTypeID = typeId;
                if (!(await anchor.Save())) LogError(`Anchor ${row.ID} did not follow space ${this.ID} to its new type: ${anchor.LatestResult?.CompleteMessage ?? ''}`);
            }
        } catch (error) {
            LogError(`The anchors of space ${this.ID} did not follow its retype: ${error instanceof Error ? error.message : String(error)}`);
        }
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
        const status = CollaborationEngine.Instance.EffectiveStatusForSpace({
            StatusID: getFieldVal<string | null>(this, 'StatusID'),
            SpaceTypeID: getFieldVal<string | null>(this, 'SpaceTypeID'),
            ClosedAt: getFieldVal<Date | string | null>(this, 'ClosedAt'),
        });
        if (status?.ReadOnly && !mayAdminister(this, user)) {
            return `Space change refused: the space is ${status.Name} and takes no changes but a status change.`;
        }
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
        // The server's clock decides when a space closed. Someone who holds the Administer Spaces authorization (the world loader, tests) may
        // backdate one; a date ahead of the server, from anyone, is the server's own time (a browser's clock can run ahead of it). A
        // re-stamp of a closed space by someone who may administer spaces follows the same rule. Validation applies the rule again as the
        // space enters a terminal status by its StatusID alone, with no ClosedAt sent.
        const signedIn = this.ContextCurrentUser;
        if (signedIn && this.ClosedAt && !!this.Fields.find((f) => f.Name === 'ClosedAt')?.Dirty) {
            const sent = new Date(this.ClosedAt).getTime();
            if ((own.closeRequested && !mayAdminister(this, signedIn)) || !(sent <= Date.now())) this.ClosedAt = new Date();
        }
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

        // A retype carries the space's anchors (item 149): their SpaceTypeID follows the space once it is saved
        const retypedTo = this.IsSaved && this.Fields.some((f) => f.Name === 'SpaceTypeID' && f.Dirty) ? parseUuid(String(getFieldVal<string>(this, 'SpaceTypeID') ?? '')) : null;

        // The save, what follows it and the drivers' reactions are one transaction (item 35): a reaction that throws rolls the whole
        // save back, and the lifecycle subscribers, queued for the commit, never hear of it. A provider without entity transactions
        // (a test's stand-in) runs the same steps unscoped, where a failing reaction is logged and the save stands, as before.
        const scope = await beginScope(this.ProviderToUse);
        try {
            const outcome = await this.saveInScope(options, own, structureChanged, subtypeOnlyChange, subtypeOldValues, retypedTo, scope !== null);
            if (scope) await (outcome ? scope.Commit() : scope.Rollback());
            return outcome;
        } catch (error) {
            if (scope) await scope.Rollback();
            throw error;
        }
    }

    /** The save and everything it entails, inside the scope `Save` opened. Returns what the save returns, or false when a reaction refused it. */
    private async saveInScope(
        options: Parameters<BaseEntity['Save']>[0] | undefined,
        own: SpaceChangeReading,
        structureChanged: boolean,
        subtypeOnlyChange: boolean,
        subtypeOldValues: Record<string, unknown> | null,
        retypedTo: string | null,
        scoped: boolean,
    ): Promise<boolean> {
        let ok = false;
        try {
            ok = await super.Save(options);
        } finally {
            this.readingForSave = null;
            this.savingAsSubtype = null;
        }
        // Validation refined the reading (the statuses the space left and entered): read it after the save, not before
        const decided = own;
        const justClosed = decided.justClosed;
        const justReopened = decided.justReopened;
        if (ok && this.ContextCurrentUser && this.ID) {
            const user = this.ContextCurrentUser;
            if (retypedTo) await this.carryAnchorsToType(retypedTo);
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
                    // The conversation grants stay as they are: a closed space refuses posts through its status, and taking the grants
                    // away and giving them back sent a share notice per member each time (finding 2)
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
            let reactionFailures: string[] = [];
            if (decided.changed) reactionFailures = await this.react(user, decided);
            else if (subtypeOnlyChange) reactionFailures = await this.react(user, { ...decided, changed: true, spaceKind: 'Update', childKind: 'UpdateChild', oldValues: subtypeOldValues ?? {} }, 'own');
            // Inside a transaction a failed reaction takes the save back with it (item 35); every driver was still told
            if (reactionFailures.length && scoped) return failSave(this, `Space change refused: ${reactionFailures[0]}`);

            const spaceTypeCode = await this.typeCodeForSubscribers();

            if (justClosed) {
                notifySpaceLifecycleSubscribers(this.ProviderToUse, {
                    spaceId: this.ID,
                    spaceTypeCode,
                    actingUserId: user.ID,
                    event: 'AfterSpaceClosed',
                    timestamp: new Date(),
                });
            }
            if (decided.statusChanged && decided.statusTo) {
                notifySpaceLifecycleSubscribers(this.ProviderToUse, {
                    spaceId: this.ID,
                    spaceTypeCode,
                    actingUserId: user.ID,
                    event: 'AfterSpaceStatusChanged',
                    timestamp: new Date(),
                    data: { fromStatusCode: decided.statusFrom?.Code ?? null, toStatusCode: decided.statusTo.Code, toStatusId: decided.statusTo.ID ?? null },
                });
                // One notice per member, when the status asks for it (Paused and Closed by default); the person who moved it gets none
                if (decided.statusTo.NotifyMembersOnEnter) {
                    await notifySpaceStatusChange(this, {
                        spaceId: this.ID,
                        spaceName: this.Name || 'A space',
                        actor: user,
                        fromStatusName: decided.statusFrom?.Name ?? null,
                        toStatusName: decided.statusTo.Name,
                    });
                }
            }
        }
        return ok;
    }
}

/** MJ's entity transaction scope, where the provider has one (`SupportsEntityTransactions`); null where it has not. */
async function beginScope(provider: unknown): Promise<{ Commit(): Promise<void>; Rollback(): Promise<void> } | null> {
    const candidate = provider as { SupportsEntityTransactions?: boolean; BeginEntityTransaction?: () => Promise<{ Commit(): Promise<void>; Rollback(): Promise<void> }> } | null;
    if (!candidate?.SupportsEntityTransactions || typeof candidate.BeginEntityTransaction !== 'function') return null;
    return candidate.BeginEntityTransaction();
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

/** Writes a field the way `getFieldVal` reads it: through the entity's own setter, or onto a plain field or own property. */
function setFieldVal(entity: BaseEntity, name: string, value: unknown): void {
    const desc = Object.getOwnPropertyDescriptor(entity, name);
    if (desc && 'value' in desc) {
        (entity as unknown as Record<string, unknown>)[name] = value;
        const f = entity.Fields?.find((field) => field.Name === name);
        if (f) (f as unknown as { Value: unknown }).Value = value;
        return;
    }
    (entity as unknown as Record<string, unknown>)[name] = value;
}

export function LoadSpaceEntityServer(): void {
    void SpaceEntityServer;
}
