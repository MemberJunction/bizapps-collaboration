import { BaseEntity, LogError, RunView, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { MJConversationEntity } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { authorizeSpaceWrite, chainsForSpaceWrite, membershipReaches, parentCreatesCycle, planSpaceWrite } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, isStaffUser, loadAncestorChain, loadWriteContext, requireSystemUser } from './load-graph.js';
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

        const allowParentChanged = this.Fields.some((field) => field.Name === 'AllowParentAssignees' && field.Dirty);
        if (allowParentChanged && !isStaffUser(user)) {
            return fail(result, 'AllowParentAssignees', 'Space change refused: only staff may change the allow-parent-assignees setting.');
        }
        const agentRetrievalChanged = this.Fields.some((field) => field.Name === 'AgentRetrieval' && field.Dirty);
        if (agentRetrievalChanged && !isStaffUser(user)) {
            return fail(result, 'AgentRetrieval', 'Space change refused: only staff may change the agent retrieval setting.');
        }

        if (!this.IsSaved && this.SpaceTypeID) {
            const typeId = parseUuid(this.SpaceTypeID);
            if (typeId) {
                try {
                    const rv = new RunView(this.RunViewProviderToUse);
                    const typeRows = await rv.RunView<{ DefaultAllowParentAssignees: boolean; DefaultAgentRetrieval: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely' }>({
                        EntityName: 'MJ_BizApps_Collaboration: Space Types',
                        ExtraFilter: `ID = '${typeId}'`,
                        Fields: ['DefaultAllowParentAssignees', 'DefaultAgentRetrieval'],
                        MaxRows: 1,
                        ResultType: 'simple',
                    }, user);
                    if (typeRows.Success && typeRows.Results?.[0]) {
                        const spaceType = typeRows.Results[0];
                        const defaultAllow = spaceType.DefaultAllowParentAssignees !== undefined ? !!spaceType.DefaultAllowParentAssignees : true;
                        const defaultAgent = spaceType.DefaultAgentRetrieval ?? 'Included';

                        const allowDirty = this.Fields.some((f) => f.Name === 'AllowParentAssignees' && f.Dirty);
                        const agentDirty = this.Fields.some((f) => f.Name === 'AgentRetrieval' && f.Dirty);

                        if (!allowDirty) {
                            this.AllowParentAssignees = defaultAllow;
                        }
                        if (!agentDirty) {
                            this.AgentRetrieval = defaultAgent;
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
                } catch {
                    // Pass through on lookup error
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
        return result;
    }

    public override async Save(options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
        const ok = await super.Save(options);
        if (ok && this.ContextCurrentUser && this.ID) {
            try {
                await ensureConversation(this, this.ContextCurrentUser);
            } catch (error) {
                LogError(`Space conversation was not bound: ${error instanceof Error ? error.message : String(error)}`);
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

export function LoadSpaceEntityServer(): void {
    void SpaceEntityServer;
}
