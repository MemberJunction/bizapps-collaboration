import {
    BaseEntity,
    RunView,
    ServerOperationScopeManager,
    ValidationErrorInfo,
    ValidationErrorType,
    type ValidationResult,
} from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import {
    compareNoticeCursors,
    normalizeNoticeUuid,
    parseNoticeTimestamp,
    ZERO_NOTICE_UUID,
} from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceNoticeWatermarkEntity } from '@mj-biz-apps/collaboration-entities';
import {
    ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY,
    SPACE_NOTICE_WATERMARK_ENTITY,
} from '@mj-biz-apps/collaboration-engine-base';
import { callerUuid, requireSystemUser } from './load-graph.js';
import { isSpaceParticipant } from './task-attribution.js';
import { parseUuid } from './uuid.js';

interface PersistedWatermarkCursorRow {
    ID: string;
    LastReadEventTimestamp: string | Date;
    LastReadEventID: string | null;
}

function addValidationError(result: ValidationResult, source: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(source, message, null, ValidationErrorType.Failure));
    return result;
}

/**
 * Server entity guard for `MJ_BizApps_Collaboration: Space Notice Watermarks`.
 * Enforces member self-ownership, server operation authority, and strictly monotonic watermark progression.
 */
@RegisterClass(BaseEntity, SPACE_NOTICE_WATERMARK_ENTITY)
export class SpaceNoticeWatermarkEntityServer extends mjBizAppsCollaborationSpaceNoticeWatermarkEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const actingUser = this.ContextCurrentUser;
        const caller = callerUuid(actingUser);
        const isOwnerOrSystem = Boolean(actingUser?.Type?.trim() === 'Owner' && !isSpaceParticipant(actingUser));
        const inAuthorizedOp =
            !ServerOperationScopeManager.Instance.IsInDirectClientCrud() &&
            ServerOperationScopeManager.Instance.IsOperationActive(
                [ADVANCE_SPACE_NOTICE_WATERMARK_OPERATION_KEY],
                SPACE_NOTICE_WATERMARK_ENTITY,
                actingUser,
            );

        const spaceId = parseUuid(this.SpaceID);
        const userId = parseUuid(this.UserID);
        if (!spaceId) {
            return addValidationError(result, 'SpaceID', 'SpaceID must be a valid UUID.');
        }
        if (!userId) {
            return addValidationError(result, 'UserID', 'UserID must be a valid UUID.');
        }

        if (!isOwnerOrSystem && !inAuthorizedOp) {
            if (!caller || caller !== userId) {
                return addValidationError(
                    result,
                    'UserID',
                    'Space Notice Watermarks can only be updated by the owning member or authorized server operation.',
                );
            }
        }

        try {
            parseNoticeTimestamp(this.LastReadEventTimestamp);
        } catch {
            return addValidationError(result, 'LastReadEventTimestamp', 'LastReadEventTimestamp must be a valid timestamp.');
        }

        if (this.LastReadEventID !== null && this.LastReadEventID !== undefined && !parseUuid(this.LastReadEventID)) {
            return addValidationError(result, 'LastReadEventID', 'LastReadEventID must be a valid UUID when provided.');
        }

        // Enforce monotonic progression against any existing persisted watermark row.
        if (this.IsSaved && parseUuid(this.ID)) {
            try {
                const system = await requireSystemUser(this);
                const existingRes = await new RunView(this.RunViewProviderToUse).RunView<PersistedWatermarkCursorRow>(
                    {
                        EntityName: SPACE_NOTICE_WATERMARK_ENTITY,
                        ExtraFilter: `ID = '${parseUuid(this.ID)}'`,
                        Fields: ['ID', 'LastReadEventTimestamp', 'LastReadEventID'],
                        ResultType: 'simple',
                        MaxRows: 1,
                    },
                    system,
                );
                const currentRow = existingRes.Results?.[0];
                if (currentRow) {
                    const cmp = compareNoticeCursors(
                        {
                            EventTimestamp: this.LastReadEventTimestamp,
                            EventID: normalizeNoticeUuid(this.LastReadEventID) ?? ZERO_NOTICE_UUID,
                        },
                        {
                            EventTimestamp: currentRow.LastReadEventTimestamp,
                            EventID: normalizeNoticeUuid(currentRow.LastReadEventID) ?? ZERO_NOTICE_UUID,
                        },
                    );
                    if (cmp < 0) {
                        return addValidationError(
                            result,
                            'LastReadEventTimestamp',
                            'Notice watermark regression is forbidden: LastReadEventTimestamp/LastReadEventID must advance monotonically.',
                        );
                    }
                }
            } catch (error) {
                return addValidationError(
                    result,
                    'LastReadEventTimestamp',
                    error instanceof Error ? error.message : 'Unable to verify monotonic watermark constraint.',
                );
            }
        }

        return result;
    }
}

export function LoadSpaceNoticeWatermarkEntityServer(): void {
    void SpaceNoticeWatermarkEntityServer;
}
