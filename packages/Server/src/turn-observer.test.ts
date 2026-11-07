import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { turnObserverFrom, type TurnStatusPublisher } from '../dist/turn-observer.js';

/** MemberJunction's publisher, as the observer sees it: the two callbacks are handed on as they are, and each way a run ends is recorded. */
function fakePublisher() {
    const calls: Array<{ method: 'PublishFinal' | 'PublishFailure'; args: unknown[] }> = [];
    const OnProgress = () => undefined;
    const OnStreaming = () => undefined;
    const publisher: TurnStatusPublisher = {
        OnProgress,
        OnStreaming,
        PublishFinal: (...args: unknown[]) => { calls.push({ method: 'PublishFinal', args }); },
        PublishFailure: (...args: unknown[]) => { calls.push({ method: 'PublishFailure', args }); },
    } as unknown as TurnStatusPublisher;
    return { publisher, calls, OnProgress, OnStreaming };
}

describe("the turn's observer, built on MemberJunction's publisher", () => {
    it("hands the run MJ's own progress and streaming callbacks, unwrapped: nothing here builds one of MJ's messages", () => {
        const { publisher, OnProgress, OnStreaming } = fakePublisher();
        const observer = turnObserverFrom(publisher);
        assert.equal(observer.OnProgress, OnProgress);
        assert.equal(observer.OnStreaming, OnStreaming);
    });

    it("publishes a run that returned a result through PublishFinal, with the reply row's id, so the completion reaches that row", () => {
        const { publisher, calls } = fakePublisher();
        const result = { success: true, agentRun: { ID: 'run-1' }, payload: 'Done.' };
        turnObserverFrom(publisher).OnFinished?.({ replyDetailId: 'reply-1', success: true, agentRun: null, result: result as never });
        assert.deepEqual(calls, [{ method: 'PublishFinal', args: [result, 'reply-1'] }]);
    });

    it('publishes a failed run through PublishFinal too, as MJ publishes its own, when the turn failed with it', () => {
        const { publisher, calls } = fakePublisher();
        const result = { success: false, agentRun: { ID: 'run-1', ErrorMessage: 'The model refused.' } };
        turnObserverFrom(publisher).OnFinished?.({ replyDetailId: 'reply-1', success: false, agentRun: null, result: result as never, errorMessage: 'The model refused.' });
        assert.deepEqual(calls, [{ method: 'PublishFinal', args: [result, 'reply-1'] }]);
    });

    it("publishes a failure, with the reply row's id and the reason, when the turn ended without a result", () => {
        const { publisher, calls } = fakePublisher();
        turnObserverFrom(publisher).OnFinished?.({ replyDetailId: 'reply-1', success: false, agentRun: null, errorMessage: 'Failed to load agent x.' });
        assert.deepEqual(calls, [{ method: 'PublishFailure', args: ['reply-1', 'Failed to load agent x.'] }]);
    });

    it("publishes a failure when the run succeeded but the reply could not be saved: the row finished, and not well", () => {
        const { publisher, calls } = fakePublisher();
        const result = { success: true, agentRun: { ID: 'run-1' } };
        turnObserverFrom(publisher).OnFinished?.({ replyDetailId: 'reply-1', success: false, agentRun: null, result: result as never, errorMessage: 'Failed to save assistant reply' });
        assert.deepEqual(calls, [{ method: 'PublishFailure', args: ['reply-1', 'Failed to save assistant reply'] }]);
    });

    it('names a reason when the turn gave none', () => {
        const { publisher, calls } = fakePublisher();
        turnObserverFrom(publisher).OnFinished?.({ replyDetailId: 'reply-1', success: false, agentRun: null });
        assert.equal(calls[0]?.method, 'PublishFailure');
        assert.equal(typeof calls[0]?.args[1], 'string');
        assert.notEqual(calls[0]?.args[1], '');
    });
});
