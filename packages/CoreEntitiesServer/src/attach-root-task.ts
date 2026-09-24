import { Metadata, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { mjBizAppsTasksTaskEntity, mjBizAppsTasksTaskLinkEntity } from '@mj-biz-apps/tasks-entities';
import { mayFileRootTask, type Band } from '@mj-biz-apps/collaboration-core';
import { fileRootTask } from './file-root-task.js';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { SpaceItemEntityServer, vouchStoredFile } from './SpaceItemEntityServer.js';

const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const TASKS = 'MJ_BizApps_Tasks: Tasks';
const LINKS = 'MJ_BizApps_Tasks: Task Links';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const TYPES = 'MJ_BizApps_Tasks: Task Types';

/**
 * Creates a root task and files it in the space. The task and the TaskLink
 * are written as the system user. The space item is the caller's.
 */
export async function attachRootTask(
    provider: IMetadataProvider,
    user: UserInfo,
    input: { spaceId: string; name: string; band: Band; typeId?: string },
): Promise<{ ok: true; taskId: string; itemId: string; band: Band } | { ok: false; message: string }> {
    const metadata = provider as unknown as Metadata;
    const tasks = metadata.EntityByName?.(TASKS);
    const spaces = metadata.EntityByName?.(SPACES);
    if (!tasks || !spaces) return { ok: false, message: 'Task filing refused: the task or space entity is not installed.' };
    const typeId = input.typeId ?? await defaultTaskType(provider, user);
    if (!typeId) return { ok: false, message: 'Task filing refused: there is no task type.' };
    const probe = await provider.GetEntityObject<SpaceItemEntityServer>(ITEMS, user);
    let context;
    try {
        context = await loadWriteContext(probe, user, input.spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Task filing refused: the space could not be read.' };
    }
    const system = await requireSystemUser(probe);
    return fileRootTask(user, system, {
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
    });
}

async function defaultTaskType(provider: IMetadataProvider, user: UserInfo): Promise<string | null> {
    const { RunView } = await import('@memberjunction/core');
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ID: string }>({
        EntityName: TYPES,
        ExtraFilter: `IsActive = 1`,
        Fields: ['ID'],
        OrderBy: 'Name',
        MaxRows: 1,
        ResultType: 'simple',
    }, user);
    return rows.Success ? rows.Results?.[0]?.ID ?? null : null;
}
