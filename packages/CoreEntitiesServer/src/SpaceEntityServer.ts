import { BaseEntity, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { authorizeSpaceWrite, parentCreatesCycle } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, loadWriteContext } from './load-graph.js';
import { parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const STRUCTURAL = ['ParentID', 'OwnerID', 'AgentRetrieval', 'InheritsMembership'];

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
        const dirty = new Set(this.Fields.filter((field) => field.Dirty).map((field) => field.Name));
        const structuralChange = !this.IsSaved || STRUCTURAL.some((name) => dirty.has(name));
        if (!structuralChange) {
            return result;
        }
        const parentId = this.ParentID ? parseUuid(this.ParentID) : null;
        if (this.ParentID && !parentId) {
            return fail(result, 'ParentID', 'Space change refused: the parent id is not valid.');
        }
        const previousParent = this.Fields.find((field) => field.Name === 'ParentID')?.OldValue as string | null | undefined;
        let context;
        try {
            context = await loadWriteContext(this, user, this.ID || parentId || '', null);
        } catch (error) {
            return fail(result, 'ParentID', error instanceof Error ? error.message : 'Space change refused: the tree could not be read completely.');
        }
        const nodes = context.spaces.map((space) => space.id === this.ID ? { ...space, parentId } : space);
        if (this.ID && !nodes.some((space) => space.id === this.ID)) {
            nodes.push({
                id: this.ID,
                parentId,
                inheritsMembership: this.InheritsMembership,
                ownerId: this.OwnerID,
                agentRetrieval: this.AgentRetrieval,
            });
        }
        const decision = authorizeSpaceWrite({
            callerUserId: caller,
            spaceId: this.ID,
            nextParentId: parentId,
            previousParentId: previousParent ?? null,
            structuralChange: true,
            spaces: nodes,
            memberships: context.memberships,
        });
        if (!decision.ok) {
            return fail(result, 'ParentID', decision.message);
        }
        if (this.ID && parentCreatesCycle(nodes, this.ID, parentId)) {
            return fail(result, 'ParentID', 'This parent would put the space inside its own subtree.');
        }
        return result;
    }
}

function fail(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceEntityServer(): void {
    void SpaceEntityServer;
}
