import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { MJGlobal } from '@memberjunction/global';
import { BaseSpaceLifecycleSubscriber, notifySpaceLifecycleSubscribers, subscriberHears, type SpaceLifecyclePayload } from '../dist/space-lifecycle-subscribers.js';

const heard: Array<{ who: string; event: string; space: string }> = [];

class HearsEverything extends BaseSpaceLifecycleSubscriber {
    public OnEvent(payload: SpaceLifecyclePayload): void {
        heard.push({ who: 'every', event: payload.event, space: payload.spaceId });
    }
}

class HearsBoards extends BaseSpaceLifecycleSubscriber {
    public override readonly ForTypeCodes = ['Example-Board'];
    public OnEvent(payload: SpaceLifecyclePayload): void {
        heard.push({ who: 'boards', event: payload.event, space: payload.spaceId });
    }
}

class Throws extends BaseSpaceLifecycleSubscriber {
    public OnEvent(): void {
        throw new Error('this subscriber is broken');
    }
}

// Registered the way `@RegisterClass` does, since a test run with type stripping cannot use decorators
MJGlobal.Instance.ClassFactory.Register(BaseSpaceLifecycleSubscriber, HearsEverything, 'test-every-type');
MJGlobal.Instance.ClassFactory.Register(BaseSpaceLifecycleSubscriber, HearsBoards, 'test-boards-only');
MJGlobal.Instance.ClassFactory.Register(BaseSpaceLifecycleSubscriber, Throws, 'test-throws');

/** A provider that queues post-commit work and runs it only when told to, as MJ's does at the commit. */
function providerWithCommitQueue(): { provider: { RunAfterCommit(task: () => Promise<void> | void, description?: string): void }; commit(): Promise<void>; queued(): number } {
    const tasks: Array<() => Promise<void> | void> = [];
    return {
        provider: { RunAfterCommit: (task) => { tasks.push(task); } },
        commit: async () => { for (const task of tasks.splice(0)) await task(); },
        queued: () => tasks.length,
    };
}

const payload = (spaceTypeCode: string | null, event: SpaceLifecyclePayload['event'] = 'AfterSpaceClosed'): SpaceLifecyclePayload => ({
    spaceId: 'S1', spaceTypeCode, actingUserId: 'U1', event, timestamp: new Date(),
});

describe('space lifecycle subscribers (items 37, 86 and 47)', () => {
    let logs: string[] = [];
    let heldError: typeof console.error;
    before(() => { heldError = console.error; console.error = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); }; });
    after(() => { console.error = heldError; });

    it('subscriberHears: no types named means every type; named types match without regard to case; a space with no readable type is heard by nobody that names types', () => {
        assert.equal(subscriberHears({}, 'anything'), true);
        assert.equal(subscriberHears({ ForTypeCodes: ['example-board'] }, 'Example-Board'), true);
        assert.equal(subscriberHears({ ForTypeCodes: ['example-board'] }, 'workspace'), false);
        assert.equal(subscriberHears({ ForTypeCodes: ['example-board'] }, null), false);
        assert.equal(subscriberHears({}, null), true);
    });

    it('runs only after the commit, and not at all when the save is rolled back', async () => {
        heard.length = 0;
        const queue = providerWithCommitQueue();
        notifySpaceLifecycleSubscribers(queue.provider as never, payload('workspace'));
        assert.equal(queue.queued(), 1, 'the work is queued for the commit');
        assert.equal(heard.length, 0, 'nothing has heard anything before the commit');
        await queue.commit();
        assert.deepEqual(heard.map((h) => h.who), ['every'], 'only the subscriber that names no types hears a workspace');

        heard.length = 0;
        const rolledBack = providerWithCommitQueue();
        notifySpaceLifecycleSubscribers(rolledBack.provider as never, payload('workspace'));
        // No commit: the queue is dropped with the transaction
        assert.equal(heard.length, 0);
    });

    it('a subscriber that names types hears those types only, found through the registrations, not through any type naming it', async () => {
        heard.length = 0;
        const queue = providerWithCommitQueue();
        notifySpaceLifecycleSubscribers(queue.provider as never, payload('example-board', 'AfterMemberAdded'));
        await queue.commit();
        assert.deepEqual(heard.map((h) => h.who).sort(), ['boards', 'every']);
        assert.ok(MJGlobal.Instance.ClassFactory.GetAllRegistrations(BaseSpaceLifecycleSubscriber).some((reg) => reg.Key === 'test-boards-only'));
    });

    it('a subscriber that throws is logged and does not silence the next; a provider with no commit hook is logged and dispatches nothing', async () => {
        heard.length = 0;
        logs = [];
        const queue = providerWithCommitQueue();
        notifySpaceLifecycleSubscribers(queue.provider as never, payload('example-board'));
        await queue.commit();
        assert.deepEqual(heard.map((h) => h.who).sort(), ['boards', 'every']);
        assert.ok(logs.some((line) => line.includes('[test-throws] failed') && line.includes('this subscriber is broken')));

        logs = [];
        notifySpaceLifecycleSubscribers({} as never, payload('workspace'));
        assert.ok(logs.some((line) => line.includes('does not support RunAfterCommit')));
    });
});
