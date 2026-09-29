import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveDriverSafely } from './ui-driver-safe.ts';

describe("creating a space type's UI driver", () => {
    it('returns the driver that was created, and reports nothing', () => {
        const errors: unknown[] = [];
        assert.equal(resolveDriverSafely(() => 'board', () => 'default', (e) => errors.push(e)), 'board');
        assert.deepEqual(errors, []);
    });

    it("falls back to the default driver, and reports the error, when the type's driver's constructor throws", () => {
        const errors: unknown[] = [];
        const driver = resolveDriverSafely<string>(() => { throw new Error('constructor failed'); }, () => 'default', (e) => errors.push(e));
        assert.equal(driver, 'default');
        assert.equal((errors[0] as Error).message, 'constructor failed');
    });
});
