import { BaseEntity, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { parentCreatesCycle } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { loadCollaborationGraph } from './load-graph.js';

const ENTITY = 'MJ_BizApps_Collaboration: Spaces';

/** Refuses a parent that would put a space inside its own subtree. Closure stays a timestamp. */
@RegisterClass(BaseEntity, ENTITY)
export class SpaceEntityServer extends mjBizAppsCollaborationSpaceEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user || !this.ParentID) {
            return result;
        }
        const graph = await loadCollaborationGraph(user);
        const nodes = graph.spaces.map((space) => space.id === this.ID ? { ...space, parentId: this.ParentID } : space);
        if (!nodes.some((space) => space.id === this.ID)) {
            nodes.push({
                id: this.ID,
                parentId: this.ParentID,
                inheritsMembership: this.InheritsMembership,
                ownerId: this.OwnerID,
                agentRetrieval: this.AgentRetrieval,
            });
        }
        if (parentCreatesCycle(nodes, this.ID, this.ParentID)) {
            result.Success = false;
            result.Errors.push(new ValidationErrorInfo(
                'ParentID',
                'This parent would put the space inside its own subtree. Choose a parent above it, or leave the parent empty to make it a root.',
                this.ParentID,
                ValidationErrorType.Failure,
            ));
        }
        return result;
    }
}

export function LoadSpaceEntityServer(): void {
    void SpaceEntityServer;
}
