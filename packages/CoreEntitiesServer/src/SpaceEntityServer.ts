import { BaseEntity, LogError, Metadata, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { authorizeSpaceWrite, membershipReaches, parentCreatesCycle, planSpaceWrite } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext } from './load-graph.js';
import { parseUuid } from './uuid.js';

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
        const parentToLoad = kind === 'create-child' || kind === 'move' ? parentId : hereId;
        let context;
        try {
            context = await loadWriteContext(this, user, parentToLoad || this.ID, null);
        } catch (error) {
            return fail(result, 'ParentID', error instanceof Error ? error.message : 'Space change refused: the tree could not be read completely.');
        }
        let destination = context;
        if (kind === 'move' && parentId) {
            try {
                destination = await loadWriteContext(this, user, parentId, null);
            } catch (error) {
                return fail(result, 'ParentID', error instanceof Error ? error.message : 'Space change refused: the destination could not be read.');
            }
        }
        const here = hereId ? membershipReaches(context.spaces, context.memberships, caller, hereId) : null;
        const onParent = parentId ? membershipReaches(destination.spaces, destination.memberships, caller, parentId) : null;
        const decision = authorizeSpaceWrite({
            kind,
            callerUserId: caller,
            callerIsStaff: isStaff(user),
            nextOwnerId: this.OwnerID,
            here,
            onParent,
        });
        if (!decision.ok) {
            return fail(result, 'ParentID', decision.message);
        }
        const nodes = [...context.spaces, ...destination.spaces.filter((space) => !context.spaces.some((have) => have.id === space.id))];
        if (this.ID && parentCreatesCycle(nodes.map((space) => space.id === this.ID ? { ...space, parentId } : space), this.ID, parentId)) {
            return fail(result, 'ParentID', 'This parent would put the space inside its own subtree.');
        }
        return result;
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

SpaceEntityServer.prototype.Save = async function (this: SpaceEntityServer, options?: Parameters<BaseEntity['Save']>[0]): Promise<boolean> {
    const creating = !this.IsSaved;
    const ok = await mjBizAppsCollaborationSpaceEntity.prototype.Save.call(this, options);
    if (!ok || !creating || !this.ContextCurrentUser || !this.ID) {
        return ok;
    }
    try {
        const conversation = await new Metadata().GetEntityObject('MJ: Conversations', this.ContextCurrentUser);
        conversation.NewRecord();
        conversation.Set('Name', this.Name);
        conversation.Set('LinkedEntityID', SPACES_ENTITY_ID);
        conversation.Set('LinkedRecordID', this.ID);
        await conversation.Save();
    } catch (error) {
        LogError(`Space conversation was not bound: ${error instanceof Error ? error.message : String(error)}`);
    }
    return true;
};

export function LoadSpaceEntityServer(): void {
    void SpaceEntityServer;
}
