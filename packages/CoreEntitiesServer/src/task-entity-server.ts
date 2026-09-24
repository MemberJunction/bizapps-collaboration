import { BaseEntity, LogError, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { TaskEntityServer } from '@mj-biz-apps/tasks-entities-server';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { callerPersonId, isSpaceParticipant, noteCollaborationRequest, reportCollaborationClasses } from './task-attribution.js';
import { filedTask } from './task-space.js';
import { asMetadata } from './uuid.js';

/**
 * Sits above bizapps-tasks' server class. That class registers with no
 * explicit priority, and the client task class is priority 1. Importing
 * TaskEntityServer registers it first; 100 stays above it.
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Tasks: Tasks', 100)
export class CollaborationTaskEntityServer extends TaskEntityServer {
    public override async ValidateAsync(): Promise<ValidationResult> {
        noteCollaborationRequest();
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user) return result;
        if (!this.IsSaved && isSpaceParticipant(user)) {
            if (!this.ParentID) return refuse(result, 'ParentID', 'Task refused: a root task is filed from the space.');
            const personId = await callerPersonId(this, user);
            if (!personId) return refuse(result, 'CreatedByPersonID', 'Task refused: the signer has no person record.');
            this.CreatedByPersonID = personId;
        }
        const parentChanged = this.IsSaved && !!this.Fields.find((field) => field.Name === 'ParentID')?.Dirty;
        if (parentChanged) {
            const provider = this.ProviderToUse ? asMetadata(this.ProviderToUse) : null;
            if (!provider?.EntityByName) return refuse(result, 'ParentID', 'Task refused: the space could not be read.');
            try {
                const system = await requireSystemUser(this);
                const place = await filedTask(provider, system, this.ID);
                if (this.ParentID) {
                    if (place?.root) return refuse(result, 'ParentID', 'Task refused: a filed root task cannot take a parent.');
                    const parent = await filedTask(provider, system, this.ParentID);
                    if ((place?.spaceId ?? null) !== (parent?.spaceId ?? null)) {
                        return refuse(result, 'ParentID', 'Task refused: a task stays in the space it was filed in.');
                    }
                    if (place && parent && place.band !== parent.band) {
                        const context = await loadWriteContext(this, user, place.spaceId, null);
                        const reach = membershipReaches(context.spaces, context.memberships, user.ID, place.spaceId);
                        if (!reach?.role.canPromoteBand) return refuse(result, 'ParentID', 'Task refused: changing a task between Shared and Team takes promote rights.');
                    }
                } else if (place && !place.root) {
                    return refuse(result, 'ParentID', 'Task refused: a task stays in the space it was filed in.');
                }
            } catch (error) {
                LogError(`Filed root check for task ${this.ID}: ${error instanceof Error ? error.message : String(error)}`);
                return refuse(result, 'ParentID', 'Task refused: the space could not be read.');
            }
        }
        return result;
    }
}

function refuse(result: ValidationResult, field: string, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo(field, message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadCollaborationTaskEntityServer(): void {
    void CollaborationTaskEntityServer;
    reportCollaborationClasses('startup');
}
