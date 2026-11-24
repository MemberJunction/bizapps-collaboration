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
    isSpaceDigestCadence,
    normalizeNoticeUuid,
    parseNoticeTimestamp,
    ZERO_NOTICE_UUID,
} from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationSpaceDigestCheckpointEntity } from '@mj-biz-apps/collaboration-entities';
import {
    buildUuidEqualsFilter,
    detectAuditSqlDialect,
    RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY,
    SPACE_DIGEST_CHECKPOINT_ENTITY,
    UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY,
} from '@mj-biz-apps/collaboration-engine-base';
import { callerUuid, requireSystemUser } from './load-graph.js';
import { isSpaceParticipant } from './task-attribution.js';
import { asMetadata, parseUuid } from './uuid.js';

interface PersistedCheckpointCursorRow {
    ID: string;
    LastDeliveredTimestamp: string | Date;
    LastDeliveredRecordID: string | null;
}

function addValidationError(result: ValidationResult, source: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(source, message, null, ValidationErrorType.Failure));
    return result;
}

/**
 * Server entity guard for `MJ_BizApps_Collaboration: Space Digest Checkpoints`.
 * Enforces self-ownership, server operation write authority, valid cadence/status values,
 * non-negative delivery counts, and strictly monotonic `(LastDeliveredTimestamp, LastDeliveredRecordID)` progression.
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
        const inRunDigestsOp =
            !ServerOperationScopeManager.Instance.IsInDirectClientCrud() &&
            ServerOperationScopeManager.Instance.IsOperationActive(
                [RUN_SCOPED_SPACE_DIGESTS_OPERATION_KEY],
                SPACE_DIGEST_CHECKPOINT_ENTITY,
                actingUser,
            );
        const inUpdateCheckpointOp =
            !ServerOperationScopeManager.Instance.IsInDirectClientCrud() &&
            ServerOperationScopeManager.Instance.IsOperationActive(
                [UPDATE_SPACE_DIGEST_CHECKPOINT_OPERATION_KEY],
                SPACE_DIGEST_CHECKPOINT_ENTITY,
                actingUser,
            );
        const inAuthorizedOp = inRunDigestsOp || inUpdateCheckpointOp;

        if (!isOwnerOrSystem && !inAuthorizedOp) {
            return addValidationError(
                result,
                'UserID',
                'Space Digest Checkpoints may only be persisted via Collaboration.RunScopedSpaceDigests, Collaboration.UpdateSpaceDigestCheckpoint, or server authority.',
            );
        }

        const userId = parseUuid(this.UserID);
        if (!userId) {
            return addValidationError(result, 'UserID', 'UserID must be a valid UUID.');
        }

        if (!isOwnerOrSystem && !inRunDigestsOp && (!caller || caller !== userId)) {
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

        if (
            this.LastDeliveredRecordID !== null &&
            this.LastDeliveredRecordID !== undefined &&
            !parseUuid(this.LastDeliveredRecordID)
        ) {
            return addValidationError(
                result,
                'LastDeliveredRecordID',
                'LastDeliveredRecordID must be a valid UUID when provided.',
            );
        }

        // Enforce monotonic progression against any existing persisted checkpoint row.
        const savedId = parseUuid(this.ID);
        if (this.IsSaved && savedId) {
            try {
                const system = await requireSystemUser(this);
                const dialect = detectAuditSqlDialect(asMetadata(this.ProviderToUse));
                const existingRes = await new RunView(this.RunViewProviderToUse).RunView<PersistedCheckpointCursorRow>(
                    {
                        EntityName: SPACE_DIGEST_CHECKPOINT_ENTITY,
                        ExtraFilter: buildUuidEqualsFilter('ID', savedId, dialect),
                        Fields: ['ID', 'LastDeliveredTimestamp', 'LastDeliveredRecordID'],
                        ResultType: 'simple',
                        MaxRows: 1,
                    },
                    system,
                );
                const currentRow = existingRes.Results?.[0];
                if (currentRow) {
                    const cmp = compareNoticeCursors(
                        {
                            EventTimestamp: this.LastDeliveredTimestamp,
                            EventID: normalizeNoticeUuid(this.LastDeliveredRecordID) ?? ZERO_NOTICE_UUID,
                        },
                        {
                            EventTimestamp: currentRow.LastDeliveredTimestamp,
                            EventID: normalizeNoticeUuid(currentRow.LastDeliveredRecordID) ?? ZERO_NOTICE_UUID,
                        },
                    );
                    if (cmp < 0) {
                        return addValidationError(
                            result,
                            'LastDeliveredTimestamp',
                            'Digest checkpoint regression is forbidden: LastDeliveredTimestamp/LastDeliveredRecordID must advance monotonically.',
                        );
                    }
                }
            } catch (error) {
                return addValidationError(
                    result,
                    'LastDeliveredTimestamp',
                    error instanceof Error ? error.message : 'Unable to verify monotonic checkpoint constraint.',
                );
            }
        }

        return result;
    }
}

export function LoadSpaceDigestCheckpointEntityServer(): void {
    void SpaceDigestCheckpointEntityServer;
}
