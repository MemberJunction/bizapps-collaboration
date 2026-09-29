import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { mjBizAppsTasksTaskActivityEntity, mjBizAppsTasksTaskEntity, mjBizAppsTasksTaskLinkEntity } from '@mj-biz-apps/tasks-entities';
import { mayFileRootTask, type Band } from '@mj-biz-apps/collaboration-core';
import { deleteActivitiesThenTask, fileRootTask } from './file-root-task.js';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { SpaceItemEntityServer, vouchStoredFile } from './SpaceItemEntityServer.js';
import { resolveSpaceDriver } from './space-driver-call.js';
import { callerPersonId } from './task-attribution.js';
import { parseUuid } from './uuid.js';

const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const TASKS = 'MJ_BizApps_Tasks: Tasks';
const ACTIVITIES = 'MJ_BizApps_Tasks: Task Activities';
const LINKS = 'MJ_BizApps_Tasks: Task Links';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const TYPES = 'MJ_BizApps_Tasks: Task Types';
/** Seeded code. The display name can be renamed. */
const ROOT_TASK_TYPE_CODE = 'GENERAL';

/**
 * Creates a root task and files it in one space. The task and the TaskLink
 * are written as the system user. The space item is the caller's.
 */
export async function createSpaceTask(
    provider: IMetadataProvider,
    user: UserInfo,
    input: { spaceId: string; name: string; band: Band; typeId?: string },
): Promise<{ ok: true; taskId: string; itemId: string; band: Band } | { ok: false; message: string }> {
    const tasks = provider.EntityByName(TASKS);
    const spaces = provider.EntityByName(SPACES);
    if (!tasks || !spaces) return { ok: false, message: 'Task filing refused: the task or space entity is not installed.' };
    const typeId = input.typeId ?? await collaborationTaskType(provider, user);
    if (!typeId) return { ok: false, message: 'Task filing refused: the General task type is not installed.' };
    const probe = await provider.GetEntityObject<SpaceItemEntityServer>(ITEMS, user);
    let context;
    try {
        context = await loadWriteContext(probe, user, input.spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Task filing refused: the space could not be read.' };
    }
    const system = await requireSystemUser(probe);
    const authorId = await callerPersonId(probe, user);
    const filed = await fileRootTask(user, system, {
        gate: async () => mayFileRootTask({
            callerUserId: user.ID,
            spaceId: input.spaceId,
            requestedBand: input.band,
            now: new Date(),
            spaces: context.spaces,
            memberships: context.memberships,
        }),
        createTask: async (actor) => {
            const task = await provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS, actor);
            task.NewRecord();
            task.Name = input.name;
            task.TypeID = typeId;
            task.Status = 'Open';
            task.Priority = 'Medium';
            task.ParentID = null;
            if (authorId) task.CreatedByPersonID = authorId;
            if (!(await task.Save()) || !task.ID) {
                return { ok: false, message: task.LatestResult?.CompleteMessage ?? 'Task filing refused: the task could not be saved.' };
            }
            return { ok: true, taskId: task.ID };
        },
        fileItem: async (actor, taskId, band) => {
            const item = await provider.GetEntityObject<SpaceItemEntityServer>(ITEMS, actor);
            vouchStoredFile(item);
            item.NewRecord();
            item.SpaceID = input.spaceId;
            item.EntityID = tasks.ID;
            item.RecordID = taskId;
            item.Band = band;
            if (!(await item.Save()) || !item.ID) {
                return { ok: false, message: item.LatestResult?.CompleteMessage ?? 'Task filing refused: the space item could not be saved.' };
            }
            return { ok: true, itemId: item.ID };
        },
        writeLink: async (actor, taskId) => {
            const link = await provider.GetEntityObject<mjBizAppsTasksTaskLinkEntity>(LINKS, actor);
            link.NewRecord();
            link.TaskID = taskId;
            link.EntityID = spaces.ID;
            link.RecordID = input.spaceId;
            link.Description = 'Space';
            return link.Save();
        },
        undoItem: async (actor, itemId) => {
            const item = await provider.GetEntityObject<SpaceItemEntityServer>(ITEMS, actor);
            if (!(await item.Load(itemId))) return false;
            return item.Delete();
        },
        deleteTask: (actor, taskId) => removeUnfiledTask(provider, actor, taskId),
    });
    if (filed.ok) await announceTaskFiled(probe, provider, user, input.spaceId, filed.taskId, input.name, filed.band);
    return filed;
}

/** Tells the space type's driver a task was filed. A failing reaction is logged: the task is already filed. */
async function announceTaskFiled(
    probe: SpaceItemEntityServer,
    provider: IMetadataProvider,
    user: UserInfo,
    spaceId: string,
    taskId: string,
    taskTitle: string,
    band: Band,
): Promise<void> {
    const resolved = await resolveSpaceDriver(probe, provider, user, spaceId);
    if (!resolved.ok) return;
    try {
        await resolved.call.driver.OnTaskFiled({ ...resolved.call.base, taskId, taskTitle, band });
    } catch (error) {
        LogError(`OnTaskFiled failed for task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Deletes the task's activities, then the task. Both run as the given user. */
export async function removeUnfiledTask(provider: IMetadataProvider, actor: UserInfo, taskId: string): Promise<boolean> {
    const id = parseUuid(taskId);
    if (!id) return false;
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: ACTIVITIES,
        ExtraFilter: `TaskID = '${id}'`,
        Fields: ['ID'],
        MaxRows: 200,
        ResultType: 'simple',
    }, actor);
    if (!rows.Success || (rows.Results?.length ?? 0) >= 200) return false;
    return deleteActivitiesThenTask(
        (rows.Results ?? []).map((row) => row.ID),
        async (activityId) => {
            const activityKey = parseUuid(activityId);
            if (!activityKey) return false;
            const activity = await provider.GetEntityObject<mjBizAppsTasksTaskActivityEntity>(ACTIVITIES, actor);
            if (!(await activity.Load(activityKey))) return false;
            return activity.Delete();
        },
        async () => {
            const task = await provider.GetEntityObject<mjBizAppsTasksTaskEntity>(TASKS, actor);
            if (!(await task.Load(id))) return false;
            return task.Delete();
        },
    );
}

async function collaborationTaskType(provider: IMetadataProvider, user: UserInfo): Promise<string | null> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: TYPES,
        ExtraFilter: `Code = '${ROOT_TASK_TYPE_CODE}' AND IsActive = 1`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, user);
    return rows.Success ? rows.Results?.[0]?.ID ?? null : null;
}
