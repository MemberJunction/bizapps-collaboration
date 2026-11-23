import {
    BaseEntity,
    ServerOperationScopeManager,
    ValidationErrorInfo,
    ValidationErrorType,
    type ValidationResult,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    isSpaceNoticeBand,
    isSpaceNoticeEventKind,
    parseNoticeTimestamp,
} from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceNoticeEventEntity } from '@mj-biz-apps/collaboration-entities';
import {
    PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY,
    SPACE_NOTICE_EVENT_ENTITY,
} from '@mj-biz-apps/collaboration-engine-base';
import { isSpaceParticipant } from './task-attribution.js';
import { parseUuid } from './uuid.js';

function addValidationError(result: ValidationResult, source: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(source, message, null, ValidationErrorType.Failure));
    return result;
}

/**
 * Server entity guard for `MJ_BizApps_Collaboration: Space Notice Events`.
 * Enforces structural invariants and blocks direct client mutation outside authorized server operations.
 */
@RegisterClass(BaseEntity, SPACE_NOTICE_EVENT_ENTITY)
export class SpaceNoticeEventEntityServer extends mjBizAppsCollaborationSpaceNoticeEventEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const actingUser = this.ContextCurrentUser;
        const isOwnerOrSystem = Boolean(actingUser?.Type?.trim() === 'Owner' && !isSpaceParticipant(actingUser));
        const inAuthorizedOp =
            !ServerOperationScopeManager.Instance.IsInDirectClientCrud() &&
            ServerOperationScopeManager.Instance.IsOperationActive(
                [PUBLISH_SPACE_NOTICE_EVENT_OPERATION_KEY],
                SPACE_NOTICE_EVENT_ENTITY,
                actingUser,
            );

        if (!isOwnerOrSystem && !inAuthorizedOp) {
            return addValidationError(
                result,
                'SpaceID',
                'Space Notice Events may only be persisted via Collaboration.PublishSpaceNoticeEvent or server authority.',
            );
        }

        if (!parseUuid(this.SpaceID)) {
            return addValidationError(result, 'SpaceID', 'SpaceID must be a valid UUID.');
        }

        if (!isSpaceNoticeEventKind(this.EventKind)) {
            return addValidationError(result, 'EventKind', `Invalid EventKind '${String(this.EventKind)}'.`);
        }

        if (!isSpaceNoticeBand(this.Band)) {
            return addValidationError(result, 'Band', `Invalid Band '${String(this.Band)}'.`);
        }

        const cleanTitle = (this.Title ?? '').trim();
        if (!cleanTitle || cleanTitle.length > 400) {
            return addValidationError(result, 'Title', 'Title is required and must be at most 400 characters.');
        }

        if (this.TargetEntityID !== null && this.TargetEntityID !== undefined && !parseUuid(this.TargetEntityID)) {
            return addValidationError(result, 'TargetEntityID', 'TargetEntityID must be a valid UUID when supplied.');
        }

        if (this.MetadataJSON !== null && this.MetadataJSON !== undefined && this.MetadataJSON.trim() !== '') {
            try {
                JSON.parse(this.MetadataJSON);
            } catch {
                return addValidationError(result, 'MetadataJSON', 'MetadataJSON must contain valid JSON.');
            }
        }

        try {
            parseNoticeTimestamp(this.EventTimestamp);
        } catch {
            return addValidationError(result, 'EventTimestamp', 'EventTimestamp must be a valid timestamp.');
        }

        return result;
    }
}

export function LoadSpaceNoticeEventEntityServer(): void {
    void SpaceNoticeEventEntityServer;
}
