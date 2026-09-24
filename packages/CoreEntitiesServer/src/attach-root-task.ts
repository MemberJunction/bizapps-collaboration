import { BaseEntity, Metadata, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { mayFileRootTask, type Band } from '@mj-biz-apps/collaboration-core';
import { SpaceItemEntityServer } from './SpaceItemEntityServer.js';
import { loadWriteContext } from './load-graph.js';

const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const TASKS = 'MJ_BizApps_Tasks: Tasks';
const LINKS = 'MJ_BizApps_Tasks: Task Links';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';

/**
 * Files an existing task as one space's root item, and links the task back
 * to that space. The space item is unique on the task, so the task cannot
 * be the root of a second space. The link is the TaskLink primitive.
 */
export async function attachRootTask(
    provider: IMetadataProvider,
    user: UserInfo,
    input: { spaceId: string; taskId: string; band: Band },
): Promise<{ ok: true; itemId: string; band: Band } | { ok: false; message: string }> {
    const tasks = new Metadata().EntityByName(TASKS);
    const spaces = new Metadata().EntityByName(SPACES);
    if (!tasks || !spaces) return { ok: false, message: 'Task filing refused: the task or space entity is not installed.' };
    const item = await provider.GetEntityObject<SpaceItemEntityServer>(ITEMS, user);
    let context;
    try {
        context = await loadWriteContext(item, user, input.spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'Task filing refused: the space could not be read.' };
    }
    const decision = mayFileRootTask({
        callerUserId: user.ID,
        spaceId: input.spaceId,
        requestedBand: input.band,
        now: new Date(),
        spaces: context.spaces,
        memberships: context.memberships,
    });
    if (!decision.ok) return { ok: false, message: decision.message };
    item.NewRecord();
    item.SpaceID = input.spaceId;
    item.EntityID = tasks.ID;
    item.RecordID = input.taskId;
    item.Band = decision.band;
    if (!(await item.Save()) || !item.ID) {
        return { ok: false, message: item.LatestResult?.CompleteMessage ?? 'Task filing refused: the space item could not be saved.' };
    }
    const link = await provider.GetEntityObject<BaseEntity>(LINKS, user);
    link.NewRecord();
    link.Set('TaskID', input.taskId);
    link.Set('EntityID', spaces.ID);
    link.Set('RecordID', input.spaceId);
    link.Set('Description', 'Space');
    if (!(await link.Save())) {
        await item.Delete();
        return { ok: false, message: link.LatestResult?.CompleteMessage ?? 'Task filing refused: the task link could not be saved.' };
    }
    return { ok: true, itemId: item.ID, band: decision.band };
}
