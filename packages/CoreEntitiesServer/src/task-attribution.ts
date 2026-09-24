import { BaseEntity, LogError, RunView, ValidationErrorInfo, ValidationErrorType, type UserInfo, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsTasksTaskAssignmentEntity, mjBizAppsTasksTaskCommentEntity, mjBizAppsTasksTaskDecisionEntity } from '@mj-biz-apps/tasks-entities';
import { requireSystemUser } from './load-graph.js';
import { asMetadata } from './uuid.js';

const PEOPLE = 'MJ_BizApps_Common: People';

/**
 * Comments, decisions, and assignments record the caller's own person.
 * A comment can be changed only by its author. Participants have no way
 * to write these rows as someone else.
 */
@RegisterClass(BaseEntity, 'MJ_BizApps_Tasks: Task Comments', 2)
export class TaskCommentEntityServer extends mjBizAppsTasksTaskCommentEntity {
    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user) return refuse(result, 'Comment refused: there is no signed-in user.');
        const personId = await personFor(this, user);
        if (!personId) return refuse(result, 'Comment refused: the signer has no person record.');
        const previous = this.Fields.find((field) => field.Name === 'PersonID')?.OldValue as string | null | undefined;
        if (this.IsSaved && previous && previous.toLowerCase() !== personId.toLowerCase()) {
            return refuse(result, 'Comment refused: only the author can change it.');
        }
        this.PersonID = personId;
        return result;
    }
}

@RegisterClass(BaseEntity, 'MJ_BizApps_Tasks: Task Decisions', 2)
export class TaskDecisionEntityServer extends mjBizAppsTasksTaskDecisionEntity {
    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user) return refuse(result, 'Decision refused: there is no signed-in user.');
        const personId = await personFor(this, user);
        if (!personId) return refuse(result, 'Decision refused: the signer has no person record.');
        this.DecidedByPersonID = personId;
        return result;
    }
}

@RegisterClass(BaseEntity, 'MJ_BizApps_Tasks: Task Assignments', 2)
export class TaskAssignmentEntityServer extends mjBizAppsTasksTaskAssignmentEntity {
    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user) return refuse(result, 'Assignment refused: there is no signed-in user.');
        const personId = await personFor(this, user);
        if (!personId) return refuse(result, 'Assignment refused: the signer has no person record.');
        this.AssignedByPersonID = personId;
        return result;
    }
}

async function personFor(entity: BaseEntity, user: UserInfo): Promise<string | null> {
    try {
        const system = await requireSystemUser(entity);
        const provider = asMetadata(entity.ProviderToUse);
        if (!provider) return null;
        const view = RunView.FromMetadataProvider(provider);
        const rows = await view.RunView<{ ID: string }>({
            EntityName: PEOPLE,
            ExtraFilter: `LinkedUserID = '${user.ID}'`,
            Fields: ['ID'],
            MaxRows: 1,
            ResultType: 'simple',
        }, system);
        return rows.Success ? rows.Results?.[0]?.ID ?? null : null;
    } catch (error) {
        LogError(`Task person lookup: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

function refuse(result: ValidationResult, message: string): ValidationResult {
    result.Success = false;
    result.Errors.push(new ValidationErrorInfo('PersonID', message, null, ValidationErrorType.Failure));
    return result;
}

export function LoadTaskAttributionEntityServer(): void {
    void TaskCommentEntityServer;
    void TaskDecisionEntityServer;
    void TaskAssignmentEntityServer;
}
