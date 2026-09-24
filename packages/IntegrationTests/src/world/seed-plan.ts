/**
 * Discovery's project plan, filed through the same gates as the Work tab.
 * Ada files the roots. Bea, a client member, adds the subtask, the assignment
 * and a comment. The read-back tries the three moves the gate refuses.
 */
import { LogError, Metadata, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import {
    mjBizAppsTasksTaskAssignmentEntity,
    mjBizAppsTasksTaskCommentEntity,
    mjBizAppsTasksTaskDependencyEntity,
    mjBizAppsTasksTaskEntity,
} from '@mj-biz-apps/tasks-entities';
import { createSpaceTask, LoadCollaborationTaskEntityServer, LoadTaskAttributionEntityServer, requireSystemUser } from '@mj-biz-apps/collaboration-core-entities-server';

const TASKS = 'MJ_BizApps_Tasks: Tasks';
const COMMENTS = 'MJ_BizApps_Tasks: Task Comments';
const ASSIGNMENTS = 'MJ_BizApps_Tasks: Task Assignments';
const DEPENDENCIES = 'MJ_BizApps_Tasks: Task Dependencies';
const PEOPLE = 'MJ_BizApps_Common: People';

export async function seedWorldPlan(input: {
    provider: IMetadataProvider;
    actor: (key: string) => UserInfo;
    spaceId: (key: string) => string;
}): Promise<void> {
    LoadCollaborationTaskEntityServer();
    LoadTaskAttributionEntityServer();
    const ada = input.actor('ada');
    const bea = input.actor('bea');
    const discovery = input.spaceId('discovery');
    const committee = input.spaceId('committee');
    const plan = await filedRoot(input.provider, ada, discovery, 'Discovery plan', 'Shared');
    const prep = await filedRoot(input.provider, ada, discovery, 'Internal prep', 'Team');
    const audit = await filedRoot(input.provider, ada, committee, 'Audit plan', 'Shared');
    const visit = await subtask(input.provider, bea, plan, 'Site visit');
    const adaPerson = await personId(input.provider, ada, ada.ID);
    await whenAllowed(input.provider, ada, ASSIGNMENTS, (actor) => assign(input.provider, actor, plan, adaPerson));
    await assign(input.provider, bea, visit, await personId(input.provider, bea, bea.ID));
    await depend(input.provider, bea, visit, plan);
    await comment(input.provider, bea, visit, 'The site visit is on the plan.', await personId(input.provider, bea, bea.ID));
    await whenAllowed(input.provider, ada, COMMENTS, (actor) => comment(input.provider, actor, plan, 'Staff note on the plan.', adaPerson));
    await expectRefusal(input.provider, bea, visit, null, 'stays in the space');
    await expectRefusal(input.provider, bea, visit, audit, 'stays in the space');
    await expectRefusal(input.provider, bea, visit, prep, 'promote rights');
    await expectParent(input.provider, bea, visit, plan);
    const visible = await taskIds(input.provider, bea, `(ID IN ('${plan}', '${visit}', '${audit}', '${prep}'))`);
    if (!visible.has(plan.toLowerCase()) || !visible.has(visit.toLowerCase())) throw new Error('Bea cannot see the Discovery plan.');
    if (visible.has(audit.toLowerCase()) || visible.has(prep.toLowerCase())) throw new Error('Bea can see a task outside Discovery Shared.');
}

async function whenAllowed(provider: IMetadataProvider, preferred: UserInfo, entityName: string, write: (actor: UserInfo) => Promise<void>): Promise<void> {
    try {
        await write(preferred);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/permission/i.test(message)) throw error;
        LogError(`86: ${preferred.Name || preferred.ID} cannot create ${entityName} until bizapps-tasks grants the UI role create and update. Saving as the system user.`);
        const probe = await new Metadata().GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS, preferred);
        await write(await requireSystemUser(probe));
    }
}

async function filedRoot(provider: IMetadataProvider, actor: UserInfo, spaceId: string, name: string, band: 'Shared' | 'Team'): Promise<string> {
    const existing = await findFiledTask(provider, actor, spaceId, name);
    if (existing) return existing;
    const created = await createSpaceTask(provider, actor, { spaceId, name, band });
    if (!created.ok) throw new Error(created.message);
    return created.taskId;
}

async function findFiledTask(provider: IMetadataProvider, actor: UserInfo, spaceId: string, name: string): Promise<string | null> {
    const tasks = provider.EntityByName(TASKS);
    if (!tasks?.ID) throw new Error('Tasks is not installed.');
    const view = RunView.FromMetadataProvider(provider);
    const items = await view.RunView<{ RecordID: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Items',
        ExtraFilter: `SpaceID = '${spaceId}' AND EntityID = '${tasks.ID}'`,
        Fields: ['RecordID'],
        MaxRows: 200,
        ResultType: 'simple',
    }, actor);
    if (!items.Success) throw new Error(items.ErrorMessage ?? 'Could not read the space items.');
    if ((items.Results?.length ?? 0) >= 200) throw new Error('Refusing the plan: the space has a full page of task items.');
    const ids = (items.Results ?? []).map((row) => {
        const raw = (row.RecordID ?? '').replace(/^ID\|/i, '');
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ? raw : null;
    }).filter((id): id is string => !!id);
    if (!ids.length) return null;
    const rows = await view.RunView<{ ID: string }>({
        EntityName: TASKS,
        ExtraFilter: `ID IN (${ids.map((id) => `'${id}'`).join(', ')}) AND Name = N'${name.replace(/'/g, "''")}'`,
        MaxRows: 1,
        ResultType: 'simple',
    }, actor);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? `Could not read ${name}.`);
    return rows.Results?.[0]?.ID ?? null;
}

async function subtask(provider: IMetadataProvider, actor: UserInfo, parentId: string, name: string): Promise<string> {
    const existing = await findChild(provider, actor, parentId, name);
    if (existing) return existing;
    const task = await new Metadata().GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS, actor);
    const parent = await new Metadata().GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS, actor);
    if (!(await parent.Load(parentId))) throw new Error(`Could not read ${parentId}.`);
    task.NewRecord();
    task.Name = name;
    task.ParentID = parentId;
    task.TypeID = parent.TypeID;
    task.Status = 'Open';
    task.Priority = parent.Priority;
    if (!(await task.Save()) || !task.ID) throw new Error(task.LatestResult?.CompleteMessage ?? `Could not save ${name}.`);
    return task.ID;
}

async function assign(provider: IMetadataProvider, actor: UserInfo, taskId: string, assigneeId: string): Promise<void> {
    const people = provider.EntityByName(PEOPLE);
    if (!people) throw new Error('People is not installed.');
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: ASSIGNMENTS,
        ExtraFilter: `TaskID = '${taskId}' AND AssigneeRecordID = '${assigneeId}'`,
        MaxRows: 1,
        ResultType: 'simple',
    }, actor);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'Could not read assignments.');
    if (rows.Results?.length) return;
    const row = await new Metadata().GetEntityObject<mjBizAppsTasksTaskAssignmentEntity>(ASSIGNMENTS, actor);
    row.NewRecord();
    row.TaskID = taskId;
    row.AssigneeEntityID = people.ID;
    row.AssigneeRecordID = assigneeId;
    if (!(await row.Save())) throw new Error(row.LatestResult?.CompleteMessage ?? 'Could not save the assignment.');
}

async function depend(provider: IMetadataProvider, actor: UserInfo, taskId: string, dependsOn: string): Promise<void> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: DEPENDENCIES,
        ExtraFilter: `TaskID = '${taskId}' AND DependsOnTaskID = '${dependsOn}'`,
        MaxRows: 1,
        ResultType: 'simple',
    }, actor);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'Could not read dependencies.');
    if (rows.Results?.length) return;
    const row = await new Metadata().GetEntityObject<mjBizAppsTasksTaskDependencyEntity>(DEPENDENCIES, actor);
    row.NewRecord();
    row.TaskID = taskId;
    row.DependsOnTaskID = dependsOn;
    if (!(await row.Save())) throw new Error(row.LatestResult?.CompleteMessage ?? 'Could not save the dependency.');
}

async function comment(provider: IMetadataProvider, actor: UserInfo, taskId: string, content: string, authorId: string): Promise<void> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: COMMENTS,
        ExtraFilter: `TaskID = '${taskId}' AND Content = N'${content.replace(/'/g, "''")}'`,
        MaxRows: 1,
        ResultType: 'simple',
    }, actor);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'Could not read comments.');
    if (rows.Results?.length) return;
    const row = await new Metadata().GetEntityObject<mjBizAppsTasksTaskCommentEntity>(COMMENTS, actor);
    row.NewRecord();
    row.TaskID = taskId;
    row.Content = content;
    row.PersonID = authorId;
    if (!(await row.Save())) throw new Error(row.LatestResult?.CompleteMessage ?? 'Could not save the comment.');
}

async function expectRefusal(provider: IMetadataProvider, actor: UserInfo, taskId: string, parentId: string | null, phrase: string): Promise<void> {
    const task = await new Metadata().GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS, actor);
    if (!(await task.Load(taskId))) throw new Error('Could not reload the subtask for the refused move.');
    task.ParentID = parentId;
    const saved = await task.Save();
    const message = task.LatestResult?.CompleteMessage ?? '';
    if (saved || !message.includes(phrase)) throw new Error(`Expected a refusal containing "${phrase}", got ${saved ? 'a save' : message || 'no message'}.`);
}

async function expectParent(provider: IMetadataProvider, actor: UserInfo, taskId: string, parentId: string): Promise<void> {
    const task = await new Metadata().GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS, actor);
    if (!(await task.Load(taskId))) throw new Error('Could not reload the subtask.');
    if ((task.ParentID ?? '').toLowerCase() !== parentId.toLowerCase()) throw new Error('The refused moves changed the subtask parent.');
}

async function personId(provider: IMetadataProvider, actor: UserInfo, userId: string): Promise<string> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: PEOPLE,
        ExtraFilter: `LinkedUserID = '${userId}'`,
        MaxRows: 1,
        ResultType: 'simple',
    }, actor);
    const id = rows.Results?.[0]?.ID;
    if (!rows.Success || !id) throw new Error(rows.ErrorMessage ?? `No Person linked to ${userId}.`);
    return id;
}

async function findChild(provider: IMetadataProvider, actor: UserInfo, parentId: string, name: string): Promise<string | null> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: TASKS,
        ExtraFilter: `ParentID = '${parentId}' AND Name = N'${name.replace(/'/g, "''")}'`,
        MaxRows: 1,
        ResultType: 'simple',
    }, actor);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? `Could not read ${name}.`);
    return rows.Results?.[0]?.ID ?? null;
}

async function taskIds(provider: IMetadataProvider, actor: UserInfo, filter: string): Promise<Set<string>> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: TASKS,
        ExtraFilter: filter,
        MaxRows: 20,
        ResultType: 'simple',
    }, actor);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'Could not read the plan.');
    return new Set((rows.Results ?? []).map((row) => row.ID.toLowerCase()));
}
