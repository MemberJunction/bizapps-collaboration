import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { membershipReaches, type Band } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsTasksTaskAssignmentEntity } from '@mj-biz-apps/tasks-entities';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { asMetadata, parseUuid } from './uuid.js';

const TASKS = 'MJ_BizApps_Tasks: Tasks';
const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const PEOPLE = 'MJ_BizApps_Common: People';
const USERS = 'MJ: Users';
const SEAT_FIELDS = ['TaskID', 'AssigneeEntityID', 'AssigneeRecordID'] as const;

/** True on a new record, or when one of the named fields is dirty. */
export function relevantFieldsChanged(record: { IsSaved: boolean; Fields: ReadonlyArray<{ Name: string; Dirty?: boolean }> }, names: readonly string[]): boolean {
    if (!record.IsSaved) return true;
    return names.some((name) => record.Fields.some((field) => field.Name === name && field.Dirty));
}

/**
 * The space a task is filed in, if any. Two reads: `RootParentID` on the task
 * view is the root, and that root's space item is the filing. A task with no
 * parent is its own root.
 */
export async function filedTask(provider: IMetadataProvider, reader: UserInfo, taskId: string): Promise<{ spaceId: string; band: Band; root: boolean } | null> {
    const id = parseUuid(taskId);
    if (!id) return null;
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ RootParentID: string | null }>({
        EntityName: TASKS,
        ExtraFilter: `ID = '${id}'`,
        Fields: ['RootParentID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'the task could not be read');
    const row = rows.Results?.[0];
    if (!row) return null;
    const rootId = parseUuid(row.RootParentID);
    if (!rootId) return null;
    const item = await spaceItemFor(provider, reader, rootId);
    if (!item) return null;
    return { spaceId: item.spaceId, band: item.band, root: rootId === id };
}

export async function assigneeSeatMessage(assignment: mjBizAppsTasksTaskAssignmentEntity): Promise<string | null> {
    if (!relevantFieldsChanged(assignment, SEAT_FIELDS)) return null;
    const provider = assignment.ProviderToUse ? asMetadata(assignment.ProviderToUse) : null;
    const user = assignment.ContextCurrentUser;
    if (!provider?.EntityByName || !user || !assignment.TaskID) return null;
    try {
        const system = await requireSystemUser(assignment);
        const place = await filedTask(provider, system, assignment.TaskID);
        if (!place) return null;
        const assigneeUserId = await assigneeUser(provider, system, assignment.AssigneeEntityID, assignment.AssigneeRecordID);
        if (!assigneeUserId) return 'Assignment refused: the assignee is not a person in this space.';
        const context = await loadWriteContext(assignment, system, place.spaceId, null);
        const reach = membershipReaches(context.spaces, context.memberships, assigneeUserId, place.spaceId);
        if (!reach) return 'Assignment refused: the assignee does not hold a seat in this space.';
        if (place.band === 'Team' && !reach.role.canSeeTeamBand) return 'Assignment refused: a Team task cannot be given to someone who cannot see Team.';
        return null;
    } catch (error) {
        LogError(`Assignment seat check for task ${assignment.TaskID}: ${error instanceof Error ? error.message : String(error)}`);
        return 'Assignment refused: the space could not be read.';
    }
}

async function spaceItemFor(provider: IMetadataProvider, reader: UserInfo, taskId: string): Promise<{ spaceId: string; band: Band } | null> {
    const id = parseUuid(taskId);
    const tasks = provider.EntityByName(TASKS);
    const tasksId = parseUuid(tasks?.ID);
    if (!id || !tasksId) return null;
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ SpaceID: string; Band: Band }>({
        EntityName: ITEMS,
        ExtraFilter: `EntityID = '${tasksId}' AND (RecordID = '${id}' OR RecordID = 'ID|${id}')`,
        Fields: ['SpaceID', 'Band'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'the space item could not be read');
    const row = rows.Results?.[0];
    if (!row?.SpaceID) return null;
    return { spaceId: row.SpaceID, band: row.Band === 'Team' ? 'Team' : 'Shared' };
}

async function assigneeUser(provider: IMetadataProvider, reader: UserInfo, entityId: string, recordId: string): Promise<string | null> {
    const people = provider.EntityByName(PEOPLE);
    const users = provider.EntityByName(USERS);
    const raw = recordId.toLowerCase().startsWith('id|') ? recordId.slice(3) : recordId;
    const record = parseUuid(raw);
    const entity = parseUuid(entityId);
    if (!record || !entity) return null;
    if (users && entity === parseUuid(users.ID)) return record;
    if (!people || entity !== parseUuid(people.ID)) return null;
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ LinkedUserID: string | null }>({
        EntityName: PEOPLE,
        ExtraFilter: `ID = '${record}'`,
        Fields: ['LinkedUserID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'the person could not be read');
    return parseUuid(rows.Results?.[0]?.LinkedUserID);
}
