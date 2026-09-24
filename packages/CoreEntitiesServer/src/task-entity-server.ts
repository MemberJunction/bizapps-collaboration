import { BaseEntity, LogError, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { TaskEntityServer } from '@mj-biz-apps/tasks-entities-server';
import { requireSystemUser } from './load-graph.js';
import { callerPersonId, isSpaceParticipant } from './task-attribution.js';
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
        if (parentChanged && this.ParentID) {
            const provider = this.ProviderToUse ? asMetadata(this.ProviderToUse) : null;
            if (!provider?.EntityByName) return refuse(result, 'ParentID', 'Task refused: the space could not be read.');
            try {
                const system = await requireSystemUser(this);
                const place = await filedTask(provider, system, this.ID);
                if (place?.root) return refuse(result, 'ParentID', 'Task refused: a filed root task cannot take a parent.');
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
}
