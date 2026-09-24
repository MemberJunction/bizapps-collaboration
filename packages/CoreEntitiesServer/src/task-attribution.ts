import { BaseEntity, LogError, RunView, ValidationErrorInfo, ValidationErrorType, type UserInfo, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { mjBizAppsTasksTaskAssignmentEntity, mjBizAppsTasksTaskCommentEntity, mjBizAppsTasksTaskDecisionEntity } from '@mj-biz-apps/tasks-entities';
import { requireSystemUser } from './load-graph.js';
import { assigneeSeatMessage } from './task-space.js';
import { asMetadata } from './uuid.js';

const PEOPLE = 'MJ_BizApps_Common: People';
const PARTICIPANT_ROLE_ID = 'AAF434FD-EF58-4857-854E-2607ACAF763B';

/**
 * These gates run for every save of the entity, at priority 2, so they sit
 * above bizapps-tasks' generated classes. A later tasks subclass at the same
 * priority or lower would be shadowed. The checks apply only when the caller
 * holds Space Participant, matched by role id. Everyone else keeps
 * bizapps-tasks' own rules. Stamping happens on create only.
 */
export function isSpaceParticipant(user: UserInfo): boolean {
    return (user.UserRoles ?? []).some((role) => (role.RoleID ?? '').toLowerCase() === PARTICIPANT_ROLE_ID.toLowerCase());
}

@RegisterClass(BaseEntity, 'MJ_BizApps_Tasks: Task Comments', 2)
export class TaskCommentEntityServer extends mjBizAppsTasksTaskCommentEntity {
    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user || !isSpaceParticipant(user)) return result;
        const personId = await callerPersonId(this, user);
        if (!this.IsSaved) {
            if (!personId) return refuse(result, 'Comment refused: the signer has no person record.');
            this.PersonID = personId;
            return result;
        }
        const previous = this.Fields.find((field) => field.Name === 'PersonID')?.OldValue as string | null | undefined;
        if (!personId || (previous && previous.toLowerCase() !== personId.toLowerCase())) {
            return refuse(result, 'Comment refused: only the author can change it.');
        }
        if (previous) this.PersonID = previous;
        return result;
    }
}

@RegisterClass(BaseEntity, 'MJ_BizApps_Tasks: Task Decisions', 2)
export class TaskDecisionEntityServer extends mjBizAppsTasksTaskDecisionEntity {
    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        if (!user || !isSpaceParticipant(user) || this.IsSaved) return result;
        const personId = await callerPersonId(this, user);
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
        if (user && isSpaceParticipant(user) && !this.IsSaved) {
            const personId = await callerPersonId(this, user);
            if (!personId) return refuse(result, 'Assignment refused: the signer has no person record.');
            this.AssignedByPersonID = personId;
        }
        const seat = await assigneeSeatMessage(this);
        if (seat) return refuse(result, seat);
        return result;
    }
}

export async function callerPersonId(entity: BaseEntity, user: UserInfo): Promise<string | null> {
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
