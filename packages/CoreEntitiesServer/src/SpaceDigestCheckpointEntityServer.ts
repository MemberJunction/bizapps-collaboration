import {
    BaseEntity,
    ValidationErrorInfo,
    ValidationErrorType,
    type ValidationResult,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    isSpaceDigestCadence,
    parseNoticeTimestamp,
} from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceDigestCheckpointEntity } from '@mj-biz-apps/collaboration-entities';
import { SPACE_DIGEST_CHECKPOINT_ENTITY } from '@mj-biz-apps/collaboration-engine-base';
import { callerUuid } from './load-graph.js';
import { isSpaceParticipant } from './task-attribution.js';
import { parseUuid } from './uuid.js';

function addValidationError(result: ValidationResult, source: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(source, message, null, ValidationErrorType.Failure));
    return result;
}

/**
 * Server entity guard for `MJ_BizApps_Collaboration: Space Digest Checkpoints`.
 * Enforces self-ownership, valid cadence/status values, and non-negative delivery counts.
 */
@RegisterClass(BaseEntity, SPACE_DIGEST_CHECKPOINT_ENTITY)
export class SpaceDigestCheckpointEntityServer extends mjBizAppsCollaborationSpaceDigestCheckpointEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const actingUser = this.ContextCurrentUser;
        const caller = callerUuid(actingUser);
        const isOwnerOrSystem = Boolean(actingUser?.Type?.trim() === 'Owner' && !isSpaceParticipant(actingUser));

        const userId = parseUuid(this.UserID);
        if (!userId) {
            return addValidationError(result, 'UserID', 'UserID must be a valid UUID.');
        }

        if (!isOwnerOrSystem && (!caller || caller !== userId)) {
            return addValidationError(
                result,
                'UserID',
                'Digest checkpoints can only be persisted for the authenticated member or by system authority.',
            );
        }

        if (this.SpaceID !== null && this.SpaceID !== undefined && !parseUuid(this.SpaceID)) {
            return addValidationError(result, 'SpaceID', 'SpaceID must be a valid UUID when supplied.');
        }

        if (!isSpaceDigestCadence(this.Cadence)) {
            return addValidationError(result, 'Cadence', `Invalid digest Cadence '${String(this.Cadence)}'.`);
        }

        if (this.Status !== 'Active' && this.Status !== 'Paused') {
            return addValidationError(result, 'Status', `Invalid digest checkpoint Status '${String(this.Status)}'.`);
        }

        if (typeof this.ItemsIncludedCount !== 'number' || this.ItemsIncludedCount < 0) {
            return addValidationError(result, 'ItemsIncludedCount', 'ItemsIncludedCount must be zero or greater.');
        }

        try {
            parseNoticeTimestamp(this.LastDeliveredTimestamp);
        } catch {
            return addValidationError(result, 'LastDeliveredTimestamp', 'LastDeliveredTimestamp must be a valid timestamp.');
        }

        return result;
    }
}

export function LoadSpaceDigestCheckpointEntityServer(): void {
    void SpaceDigestCheckpointEntityServer;
}
