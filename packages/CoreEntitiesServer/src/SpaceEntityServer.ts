import { BaseEntity, LogError, RunView, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { MJConversationEntity } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import {
    authorizeSpaceWrite,
    chainsForSpaceWrite,
    membershipReaches,
    parentCreatesCycle,
    planSpaceWrite,
    ResolveSpaceRules,
    validateSpaceConfiguration,
    type ISpaceConfiguration,
    type ISpaceTypeConfiguration,
} from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceEntity, type mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { type BaseSpaceTypeServerDriver } from './base-space-type-server-driver.js';
import { callerUuid, isStaffUser, loadAncestorChain, loadWriteContext, requireSystemUser } from './load-graph.js';
import { ServerDriverRegistry } from './server-driver-registry.js';
import { notifySpaceLifecycleSubscribers } from './space-lifecycle-subscribers.js';
import { asMetadata, parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Spaces';

@RegisterClass(BaseEntity, ENTITY)
export class SpaceEntityServer extends mjBizAppsCollaborationSpaceEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
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

        let spaceType: {
            ID: string;
            Code?: string;
            Name?: string;
            DefaultAllowParentAssignees?: boolean;
            DefaultAgentRetrieval?: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
            Configuration?: string | null;
            ServerDriverClass?: string | null;
            DefaultInheritsMembership?: boolean;
            PostCloseAccess?: mjBizAppsCollaborationSpaceTypeEntity['PostCloseAccess'];
            PostCloseAccessDays?: number | null;
        } | null = null;

        if (typeId) {
            try {
                const system = await requireSystemUser(this);
                const rv = new RunView(this.RunViewProviderToUse);
                const typeRows = await rv.RunView<{
                    ID: string;
                    Code?: string;
                    Name?: string;
                    DefaultAllowParentAssignees: boolean;
                    DefaultAgentRetrieval: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely';
                    Configuration?: string | null;
                    ServerDriverClass?: string | null;
                    DefaultInheritsMembership?: boolean;
                    PostCloseAccess?: mjBizAppsCollaborationSpaceTypeEntity['PostCloseAccess'];
                    PostCloseAccessDays?: number | null;
                }>({
                    EntityName: 'MJ_BizApps_Collaboration: Space Types',
                    ExtraFilter: `ID = '${typeId}'`,
                    Fields: ['ID', 'Code', 'Name', 'DefaultAllowParentAssignees', 'DefaultAgentRetrieval', 'Configuration', 'ServerDriverClass', 'DefaultInheritsMembership', 'PostCloseAccess', 'PostCloseAccessDays'],
                    MaxRows: 1,
                    ResultType: 'simple',
                }, system);
                if (!typeRows.Success || !typeRows.Results?.[0]) {
                    LogError(`Space change refused: space type ${typeId} could not be read: ${typeRows.ErrorMessage ?? 'no rows returned'}`);
                    return fail(result, 'SpaceTypeID', 'Space change refused: the space type could not be read.');
                }
                spaceType = typeRows.Results[0];
            } catch (err) {
                LogError(`Space change refused: error reading space type ${typeId}: ${err instanceof Error ? err.message : String(err)}`);
                return fail(result, 'SpaceTypeID', 'Space change refused: the space type could not be read.');
            }
        }

        let typeConfig: ISpaceTypeConfiguration | null = null;
        if (spaceType?.Configuration) {
            try {
                typeConfig = JSON.parse(spaceType.Configuration) as ISpaceTypeConfiguration;
            } catch {
                // Ignore parse errors on type configuration in space save
            }
        }

        let parsedSpaceConfig: ISpaceConfiguration | null = null;
        const rawConfig = getFieldVal<string>(this, 'Configuration');
        if (rawConfig) {
            try {
                parsedSpaceConfig = JSON.parse(rawConfig) as ISpaceConfiguration;
            } catch {
                return fail(result, 'Configuration', 'Space configuration must be valid JSON.');
            }

            const configValidation = validateSpaceConfiguration(parsedSpaceConfig, typeConfig);
            if (!configValidation.valid) {
                return fail(result, 'Configuration', `Invalid space configuration: ${configValidation.errors.join('; ')}`);
            }

            const configDirty = this.Fields.some((f) => f.Name === 'Configuration' && f.Dirty);
            if (this.IsSaved && configDirty) {
                const isOwner = this.OwnerID && caller.toLowerCase() === this.OwnerID.toLowerCase();
                const isStaff = isStaffUser(user);
                let isAdminRole = false;
                if (typeConfig?.Admin?.RoleNames && user.UserRoles) {
                    const adminRoles = new Set(typeConfig.Admin.RoleNames.map((r) => r.toLowerCase()));
                    isAdminRole = user.UserRoles.some((r) => !!r.Role && adminRoles.has(r.Role.toLowerCase()));
                }
                if (!isOwner && !isStaff && !isAdminRole) {
                    return fail(result, 'Configuration', 'Space change refused: only space owners, staff, or designated admin roles may modify space configuration.');
                }
            }
        }

        let driver: BaseSpaceTypeServerDriver | null = null;
        if (spaceType) {
            try {
                driver = ServerDriverRegistry.Instance.GetDriverForType(spaceType as mjBizAppsCollaborationSpaceTypeEntity);
            } catch (driverErr) {
                return fail(result, 'SpaceTypeID', driverErr instanceof Error ? driverErr.message : 'Space change refused: driver could not be resolved.');
            }
        }

        const effectiveRules = ResolveSpaceRules(typeConfig, parsedSpaceConfig);
        const adjustedRules = driver
            ? await driver.AdjustRules(
                { actingUser: user, provider: this.ProviderToUse, space: this, spaceType: spaceType as mjBizAppsCollaborationSpaceTypeEntity, effectiveRules },
                effectiveRules
            )
            : effectiveRules;

        if (!this.IsSaved && spaceType) {
            const defaultAllow = spaceType.DefaultAllowParentAssignees !== undefined ? !!spaceType.DefaultAllowParentAssignees : true;
            const defaultAgent = spaceType.DefaultAgentRetrieval ?? 'Included';

            const allowDirty = this.Fields.some((f) => f.Name === 'AllowParentAssignees' && f.Dirty);
            const agentDirty = this.Fields.some((f) => f.Name === 'AgentRetrieval' && f.Dirty);
            const inheritsDirty = this.Fields.some((f) => f.Name === 'InheritsMembership' && f.Dirty);
            const postCloseDirty = this.Fields.some((f) => f.Name === 'PostCloseAccess' && f.Dirty);

            if (!allowDirty) {
                this.AllowParentAssignees = defaultAllow;
            }
            if (!agentDirty) {
                this.AgentRetrieval = defaultAgent;
            }
            if (!inheritsDirty && spaceType.DefaultInheritsMembership !== undefined) {
                this.InheritsMembership = !!spaceType.DefaultInheritsMembership;
            }
            if (!postCloseDirty && spaceType.PostCloseAccess) {
                this.PostCloseAccess = spaceType.PostCloseAccess;
                this.PostCloseAccessDays = spaceType.PostCloseAccessDays ?? null;
            }

            if (!isStaffUser(user)) {
                if (this.AllowParentAssignees !== defaultAllow) {
                    return fail(result, 'AllowParentAssignees', 'Space change refused: only staff may change the allow-parent-assignees setting.');
                }
                if (this.AgentRetrieval !== defaultAgent) {
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
        const here = hereId && hereContext ? membershipReaches(hereContext.spaces, hereContext.memberships, caller, hereId) : null;
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
        const isClosing = this.Fields.some((f) => f.Name === 'ClosedAt' && f.Dirty) && !!this.ClosedAt;
        const isReopening = this.Fields.some((f) => f.Name === 'ClosedAt' && f.Dirty) && !this.ClosedAt;
        const isMoving = this.Fields.some((f) => f.Name === 'ParentID' && f.Dirty);

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

        const ok = await super.Save(options);
        if (ok && this.ContextCurrentUser && this.ID) {
            const user = this.ContextCurrentUser;
            try {
                await ensureConversation(this, user);
            } catch (error) {
                LogError(`Space conversation was not bound: ${error instanceof Error ? error.message : String(error)}`);
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
    const existing = await new RunView(space.RunViewProviderToUse).RunView<{ ID: string }>({
        EntityName: 'MJ: Conversations',
        ExtraFilter: `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${space.ID}'`,
        Fields: ['ID'],
        ResultType: 'simple',
        MaxRows: 1,
    }, system);
    if (!existing.Success) {
        LogError(`Space conversation was not bound: ${existing.ErrorMessage ?? 'the lookup failed'}`);
        return;
    }
    const found = existing.Results?.[0]?.ID;
    const conversation = await metadata.GetEntityObject<MJConversationEntity>('MJ: Conversations', system);
    if (found) {
        if (!(await conversation.Load(found))) {
            LogError(`Space conversation was not bound: ${found} could not be read.`);
            return;
        }
    } else {
        conversation.NewRecord();
        conversation.LinkedEntityID = SPACES_ENTITY_ID;
        conversation.LinkedRecordID = space.ID;
    }
    const alreadyBound = !!found
        && conversation.UserID?.toLowerCase() === system.ID.toLowerCase()
        && conversation.ApplicationScope === 'Application'
        && conversation.ApplicationID?.toLowerCase() === COLLABORATION_APP_ID.toLowerCase()
        && conversation.Name === space.Name;
    if (alreadyBound) return;
    conversation.UserID = system.ID;
    conversation.Name = space.Name;
    conversation.ApplicationScope = 'Application';
    conversation.ApplicationID = COLLABORATION_APP_ID;
    const saved = await conversation.Save();
    if (!saved) {
        LogError(`Space conversation was not bound: ${conversation.LatestResult?.CompleteMessage ?? 'save returned false'}`);
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
