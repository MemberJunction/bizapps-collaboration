import type { UserInfo } from '@memberjunction/core';
import type { Band } from '@mj-biz-apps/collaboration-core';

export interface FileRootTaskSteps {
    gate: () => Promise<{ ok: true; band: Band } | { ok: false; message: string }>;
    /** The system user creates the task, because a participant cannot read an unfiled task. */
    createTask: (system: UserInfo) => Promise<{ ok: true; taskId: string } | { ok: false; message: string }>;
    /** The caller files the item. The operation vouches for that one item. */
    fileItem: (user: UserInfo, taskId: string, band: Band) => Promise<{ ok: true; itemId: string } | { ok: false; message: string }>;
    /** The system user writes the TaskLink. */
    writeLink: (system: UserInfo, taskId: string) => Promise<boolean>;
    /** The system user removes the item when the link does not save. */
    undoItem: (system: UserInfo, itemId: string) => Promise<boolean>;
}

/**
 * Creates a root task and files it in one space. The task is created and the
 * link is written as the system user. The space item is the caller's, vouched
 * so the item gate does not demand they already be able to read the task.
 */
export async function fileRootTask(
    user: UserInfo,
    system: UserInfo,
    steps: FileRootTaskSteps,
): Promise<{ ok: true; taskId: string; itemId: string; band: Band } | { ok: false; message: string }> {
    const decision = await steps.gate();
    if (!decision.ok) return decision;
    const created = await steps.createTask(system);
    if (!created.ok) return created;
    const filed = await steps.fileItem(user, created.taskId, decision.band);
    if (!filed.ok) return filed;
    if (await steps.writeLink(system, created.taskId)) {
        return { ok: true, taskId: created.taskId, itemId: filed.itemId, band: decision.band };
    }
    const undone = await steps.undoItem(system, filed.itemId);
    return {
        ok: false,
        message: undone
            ? 'Task filing refused: the task link could not be saved. The space item was removed.'
            : 'Task filing refused: the task link could not be saved, and the space item could not be removed.',
    };
}
