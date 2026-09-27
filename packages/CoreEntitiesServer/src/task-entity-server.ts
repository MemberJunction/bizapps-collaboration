import { BaseEntity, BaseEntityResult, LogError, ValidationErrorInfo, ValidationErrorType, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { TaskEntityServer } from '@mj-biz-apps/tasks-entities-server';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { callerPersonId, isSpaceParticipant, reportCollaborationClasses, watchCollaborationClasses } from './task-attribution.js';
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
        if (!this.IsSaved && this.ParentID) {
            const provider = this.ProviderToUse ? asMetadata(this.ProviderToUse) : null;
            if (provider?.EntityByName) {
                try {
                    const system = await requireSystemUser(this);
                    const parentPlace = await filedTask(provider, system, this.ParentID);
                    if (parentPlace?.closedAt) {
                        return refuse(result, 'ParentID', 'Task refused: cannot create a task in a closed space.');
                    }
                } catch (error) {
                    LogError(`Space task check for new task parent ${this.ParentID}: ${error instanceof Error ? error.message : String(error)}`);
                    return refuse(result, 'ParentID', 'Task refused: the space could not be read.');
                }
            }
        }
        const anyFieldChanged = this.IsSaved && this.Fields.some((field) => field.Dirty);
        if (anyFieldChanged) {
            const statusDirty = !!this.Fields.find((field) => field.Name === 'Status')?.Dirty;
            const taskTypeStatusDirty = !!this.Fields.find((field) => field.Name === 'TaskTypeStatusID')?.Dirty;
            const statusChanged = statusDirty || taskTypeStatusDirty;
            const parentChanged = !!this.Fields.find((field) => field.Name === 'ParentID')?.Dirty;
            const dirtyStatusField = statusDirty ? 'Status' : 'TaskTypeStatusID';
            const dirtyField = statusChanged ? dirtyStatusField : parentChanged ? 'ParentID' : (this.Fields.find((field) => field.Dirty)?.Name ?? 'Name');
            const provider = this.ProviderToUse ? asMetadata(this.ProviderToUse) : null;
            if (!provider?.EntityByName) return refuse(result, dirtyField, 'Task refused: the space could not be read.');
            try {
                const system = await requireSystemUser(this);
                const place = await filedTask(provider, system, this.ID);
                if (place) {
                    if (place.closedAt) {
                        return refuse(result, dirtyField, 'Task refused: cannot update a task in a closed space.');
                    }
                    if (statusChanged) {
                        const context = await loadWriteContext(this, user, place.spaceId, null);
                        const reach = membershipReaches(context.spaces, context.memberships, user.ID, place.spaceId);
                        if (!reach?.role.canContribute) {
                            return refuse(result, dirtyStatusField, 'Task refused: you do not have permission to update task status in this space.');
                        }
                    }
                }
                if (parentChanged) {
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
                }
            } catch (error) {
                LogError(`Space task check for task ${this.ID}: ${error instanceof Error ? error.message : String(error)}`);
                return refuse(result, dirtyField, 'Task refused: the space could not be read.');
            }
        }
        return result;
    }

    private failDelete(message: string): false {
        const result = new BaseEntityResult();
        result.Success = false;
        result.Type = 'delete';
        result.Message = message;
        this.RegisterResultHistoryEntry(result);
        return false;
    }

    public override async Delete(options?: Parameters<BaseEntity['Delete']>[0]): Promise<boolean> {
        const provider = this.ProviderToUse ? asMetadata(this.ProviderToUse) : null;
        if (provider?.EntityByName && this.ID) {
            try {
                const system = await requireSystemUser(this);
                const place = await filedTask(provider, system, this.ID);
                if (place?.closedAt) {
                    const msg = 'Task delete refused: cannot delete a task in a closed space.';
                    LogError(msg);
                    return this.failDelete(msg);
                }
            } catch (error) {
                LogError(`Space task check on delete for task ${this.ID}: ${error instanceof Error ? error.message : String(error)}`);
                return this.failDelete('Task delete refused: the space could not be read.');
            }
        }
        return super.Delete(options);
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
    watchCollaborationClasses();
}
