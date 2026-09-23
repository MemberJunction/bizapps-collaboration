import { BaseEntity, LogError, RunView, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { MJConversationEntity } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { authorizeSpaceWrite, membershipReaches, parentCreatesCycle, planSpaceWrite } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadAncestorChain, loadWriteContext, requireSystemUser } from './load-graph.js';
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
        const parentId = this.ParentID ? parseUuid(this.ParentID) : null;
        if (this.ParentID && !parentId) {
            return fail(result, 'ParentID', 'Space change refused: the parent id is not valid.');
        }
        const previousParent = (this.Fields.find((field) => field.Name === 'ParentID')?.OldValue as string | null | undefined) ?? null;
        const kind = planSpaceWrite({ isNew: !this.IsSaved, previousParentId: previousParent, nextParentId: parentId });
        const hereId = this.IsSaved ? this.ID : null;
        let hereContext: Awaited<ReturnType<typeof loadWriteContext>> | null = null;
        let destination: Awaited<ReturnType<typeof loadWriteContext>> | null = null;
        try {
            if (hereId) {
                hereContext = await loadWriteContext(this, user, hereId, null);
            }
            if (parentId) {
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
            callerIsStaff: isStaff(user),
            nextOwnerId: this.OwnerID,
            toRoot: kind === 'move' && !parentId,
            here,
            onParent,
        });
        if (!decision.ok) {
            return fail(result, 'ParentID', decision.message);
        }
        let systemNodes: Awaited<ReturnType<typeof loadAncestorChain>> = [];
        try {
            const system = await requireSystemUser(this);
            const cycleRoot = parentId || this.ID;
            if (cycleRoot) {
                systemNodes = await loadAncestorChain(this, cycleRoot, system);
            }
        } catch (error) {
            return fail(result, 'ParentID', error instanceof Error ? error.message : 'Space change refused: the system user could not read the tree.');
        }
        const hereSpaces = hereContext?.spaces ?? [];
        const nodes = [...systemNodes, ...hereSpaces.filter((space) => !systemNodes.some((have) => have.id === space.id))];
        if (this.ID && parentCreatesCycle(nodes.map((space) => space.id === this.ID ? { ...space, parentId } : space), this.ID, parentId)) {
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

const STAFF = new Set(['UI', 'Developer', 'Integration']);

function isStaff(user: { UserRoles?: { Role?: string }[] }): boolean {
    return (user.UserRoles ?? []).some((role) => !!role.Role && STAFF.has(role.Role));
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';

async function ensureConversation(space: SpaceEntityServer, user: NonNullable<SpaceEntityServer['ContextCurrentUser']>): Promise<void> {
    const metadata = asMetadata(space.ProviderToUse);
    if (!metadata) {
        LogError('Space conversation was not bound: the provider cannot create entities.');
        return;
    }
    const system = await requireSystemUser(space);
    const existing = await new RunView(space.RunViewProviderToUse).RunView({
        EntityName: 'MJ: Conversations',
        ExtraFilter: `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${space.ID}'`,
        MaxRows: 1,
    }, system);
    if (!existing.Success) {
        LogError(`Space conversation was not bound: ${existing.ErrorMessage ?? 'the lookup failed'}`);
        return;
    }
    if ((existing.Results?.length ?? 0) > 0) {
        return;
    }
    const conversation = await metadata.GetEntityObject<MJConversationEntity>('MJ: Conversations', user);
    conversation.NewRecord();
    conversation.UserID = space.OwnerID;
    conversation.Name = space.Name;
    conversation.LinkedEntityID = SPACES_ENTITY_ID;
    conversation.LinkedRecordID = space.ID;
    const saved = await conversation.Save();
    if (!saved) {
        LogError(`Space conversation was not bound: ${conversation.LatestResult?.CompleteMessage ?? 'save returned false'}`);
    }
}

export function LoadSpaceEntityServer(): void {
    void SpaceEntityServer;
}
