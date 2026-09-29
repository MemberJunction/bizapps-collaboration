import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { SPACE_UPLOAD_MAX_BYTES } from '@mj-biz-apps/collaboration-core';
import { configuredUploadMaxBytes } from '../dist/upload-limit.js';

describe('the largest upload this host takes', () => {
    const held = process.env.COLLABORATION_UPLOAD_MAX_BYTES;
    afterEach(() => {
        if (held === undefined) delete process.env.COLLABORATION_UPLOAD_MAX_BYTES;
        else process.env.COLLABORATION_UPLOAD_MAX_BYTES = held;
    });

    it('is the default when the setting is absent', () => {
        delete process.env.COLLABORATION_UPLOAD_MAX_BYTES;
        assert.equal(configuredUploadMaxBytes(), SPACE_UPLOAD_MAX_BYTES);
    });

    it('is the setting when it is a positive number', () => {
        process.env.COLLABORATION_UPLOAD_MAX_BYTES = '1048576';
        assert.equal(configuredUploadMaxBytes(), 1048576);
    });

    for (const bad of ['lots', '0', '-5', 'Infinity', '1.5', '3000000000', '2147483648']) {
        it(`falls back to the default for '${bad}'`, () => {
            process.env.COLLABORATION_UPLOAD_MAX_BYTES = bad;
            const logged: string[] = [];
            const spy = mock.method(console, 'error', (...args: unknown[]) => { logged.push(args.map(String).join(' ')); });
            try {
                assert.equal(configuredUploadMaxBytes(), SPACE_UPLOAD_MAX_BYTES);
            } finally {
                spy.mock.restore();
            }
            assert.ok(logged.some((line) => line.includes(`'${bad}'`)), `the refused value is logged: ${logged.join(' | ')}`);
        });
    }

    it('takes the largest number GraphQL can carry, and the default for an empty setting without a log', () => {
        process.env.COLLABORATION_UPLOAD_MAX_BYTES = '2147483647';
        assert.equal(configuredUploadMaxBytes(), 2147483647);
        process.env.COLLABORATION_UPLOAD_MAX_BYTES = '';
        assert.equal(configuredUploadMaxBytes(), SPACE_UPLOAD_MAX_BYTES);
    });
});
