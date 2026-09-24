import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UserInfo } from '@memberjunction/core';
import { fileRootTask } from '../dist/file-root-task.js';

const user = { ID: 'user' } as UserInfo;
const system = { ID: 'system' } as UserInfo;

describe('fileRootTask', () => {
    it('creates the task and writes the link as the system user, and files the item as the caller', async () => {
        const actors: string[] = [];
        const outcome = await fileRootTask(user, system, {
            gate: async () => ({ ok: true, band: 'Shared' }),
            createTask: async (actor) => {
                actors.push(`create:${actor.ID}`);
                return { ok: true, taskId: 'task-1' };
            },
            fileItem: async (actor, taskId, band) => {
                actors.push(`file:${actor.ID}:${taskId}:${band}`);
                return { ok: true, itemId: 'item-1' };
            },
            writeLink: async (actor, taskId) => {
                actors.push(`link:${actor.ID}:${taskId}`);
                return true;
            },
            undoItem: async () => false,
        });
        assert.deepEqual(outcome, { ok: true, taskId: 'task-1', itemId: 'item-1', band: 'Shared' });
        assert.deepEqual(actors, ['create:system', 'file:user:task-1:Shared', 'link:system:task-1']);
    });

    it('removes the item with the system user when the link does not save', async () => {
        let undone = '';
        const outcome = await fileRootTask(user, system, {
            gate: async () => ({ ok: true, band: 'Team' }),
            createTask: async () => ({ ok: true, taskId: 'task-1' }),
            fileItem: async () => ({ ok: true, itemId: 'item-1' }),
            writeLink: async () => false,
            undoItem: async (actor, itemId) => {
                undone = `${actor.ID}:${itemId}`;
                return true;
            },
        });
        assert.equal(outcome.ok, false);
        assert.match(outcome.ok ? '' : outcome.message, /space item was removed/);
        assert.equal(undone, 'system:item-1');
    });

    it('says so when the item cannot be removed', async () => {
        const outcome = await fileRootTask(user, system, {
            gate: async () => ({ ok: true, band: 'Team' }),
            createTask: async () => ({ ok: true, taskId: 'task-1' }),
            fileItem: async () => ({ ok: true, itemId: 'item-1' }),
            writeLink: async () => false,
            undoItem: async () => false,
        });
        assert.equal(outcome.ok, false);
        assert.match(outcome.ok ? '' : outcome.message, /could not be removed/);
    });
});
