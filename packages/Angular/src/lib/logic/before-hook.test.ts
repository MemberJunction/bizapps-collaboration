import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runBeforeHookSafely } from './before-hook.ts';

describe('running a Before hook', () => {
    it('answers true, and logs nothing, when the hook returns', () => {
        const logged: string[] = [];
        assert.equal(runBeforeHookSafely('BeforeInvite', 'example-room', 'space-1', () => undefined, (m) => logged.push(m)), true);
        assert.deepEqual(logged, []);
    });

    for (const hook of ['BeforeStartChat', 'BeforeInvite']) {
        it(`answers false and logs the hook, the type and the space when ${hook} throws`, () => {
            const logged: string[] = [];
            const ran = runBeforeHookSafely(hook, 'example-board', 'space-9', () => { throw new Error('boom'); }, (m) => logged.push(m));
            assert.equal(ran, false);
            assert.deepEqual(logged, [`${hook} of space type 'example-board' failed for space space-9: boom`]);
        });
    }

    it('names an unknown type, and reads a thrown non-error', () => {
        const logged: string[] = [];
        runBeforeHookSafely('BeforeInvite', undefined, 's', () => { throw 'nope'; }, (m) => logged.push(m));
        assert.match(logged[0], /space type 'unknown' failed for space s: nope/);
    });
});
