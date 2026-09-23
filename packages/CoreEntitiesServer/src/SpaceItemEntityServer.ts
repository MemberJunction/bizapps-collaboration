import { BaseEntity, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { promotionStamps } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceItemEntity } from '@mj-biz-apps/collaboration-entities';
import { callerId, loadCollaborationGraph } from './load-graph.js';

const ENTITY = 'MJ_BizApps_Collaboration: Space Items';

/**
 * One parent, one band. Shared items always record who promoted them.
 * The unique key on (EntityID, RecordID) is what makes a second parent impossible.
 */
@RegisterClass(BaseEntity, ENTITY)
export class SpaceItemEntityServer extends mjBizAppsCollaborationSpaceItemEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user) {
            return fail(result, 'A signed-in user has to place an item.');
        }
        const graph = await loadCollaborationGraph(user);
        const decision = promotionStamps({
            callerUserId: callerId(user),
            itemSpaceId: this.SpaceID,
            nextBand: this.Band,
            now: new Date(),
            spaces: graph.spaces,
            memberships: graph.memberships,
        });
        if (!decision.ok) {
            return fail(result, decision.message);
        }
        this.Band = decision.band;
        if (decision.promotedAt) {
            this.PromotedAt = decision.promotedAt;
            this.PromotedByUserID = decision.promotedByUserId;
        } else {
            this.PromotedAt = null;
            this.PromotedByUserID = null;
        }
        return result;
    }
}

function fail(result: ValidationResult, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo('Band', message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadSpaceItemEntityServer(): void {
    void SpaceItemEntityServer;
}
