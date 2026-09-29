import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { checkTree, findNames } from './check-downstream-names.mjs';

describe('the downstream-name gate', () => {
    it('fails on a planted name in each of its forms', () => {
        for (const line of ["import x from '@mj-biz-apps/sales-entities';", 'see bizapps-committees for the roster', "EntityName: 'MJ_BizApps_Orders: Orders'"]) {
            assert.equal(findNames(line, 'a.ts').length, 1, line);
        }
    });

    it('lets upstream apps and plain words through', () => {
        for (const line of ["import x from '@mj-biz-apps/common-entities';", "'MJ_BizApps_Tasks: Tasks'", 'the sales of the year', 'a committee of three']) {
            assert.equal(findNames(line, 'a.ts').length, 0, line);
        }
    });

    it('scans a tree, and skips the example package and test files', () => {
        const root = mkdtempSync(join(tmpdir(), 'gate-'));
        mkdirSync(join(root, 'packages', 'Core'), { recursive: true });
        mkdirSync(join(root, 'packages', 'ExampleSpaceTypes'), { recursive: true });
        writeFileSync(join(root, 'packages', 'Core', 'a.ts'), "export const x = '@mj-biz-apps/sales-entities';\n");
        writeFileSync(join(root, 'packages', 'Core', 'a.test.ts'), "export const x = '@mj-biz-apps/sales-entities';\n");
        writeFileSync(join(root, 'packages', 'ExampleSpaceTypes', 'b.ts'), "export const x = '@mj-biz-apps/sales-entities';\n");
        const problems = checkTree([join(root, 'packages')]);
        assert.equal(problems.length, 1);
        assert.match(problems[0], /Core\/a\.ts:1/);
    });
});
