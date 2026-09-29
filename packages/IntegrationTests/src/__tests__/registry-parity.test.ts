import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IntegrationCheckRegistry } from '@memberjunction/testing-integration';

import '../checks/collab-world.checks.js';
import '../checks/people-fls.checks.js';
import '../checks/parent-assignees.checks.js';
import '../checks/room.checks.js';
import '../checks/write-gates.checks.js';
import '../checks/row-filters.checks.js';
import '../checks/library.checks.js';
import '../checks/agent.checks.js';
import '../checks/features.checks.js';
import '../checks/extensions.checks.js';
import '../checks/subtypes.checks.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const registry = IntegrationCheckRegistry.Instance;

import { EXPECTED_BUNDLES, EXPECTED_CLIENT_BUNDLES } from '../expected-bundles.js';
export { EXPECTED_BUNDLES, EXPECTED_CLIENT_BUNDLES };

const FRAMEWORK_BUNDLES = new Set(['self-test']);
const ourBundles = () => registry.GetBundleNames().filter((b) => !FRAMEWORK_BUNDLES.has(b));

describe('IntegrationCheckRegistry parity', () => {
    it('registers exactly the expected bundles', () => {
        expect(ourBundles().sort()).toEqual(Object.keys(EXPECTED_BUNDLES).sort());
    });

    for (const [bundle, count] of Object.entries(EXPECTED_BUNDLES)) {
        it(`${bundle} has exactly ${count} checks with unique IDs`, () => {
            const checks = registry.GetBundle(bundle);
            expect(checks).toHaveLength(count);
            expect(new Set(checks.map((c) => c.Id)).size).toBe(count);

            for (const check of checks) {
                expect(check.Id.startsWith(`${bundle}.`)).toBe(true);
                expect(check.Name.length).toBeGreaterThan(5);
                expect(typeof check.Fn).toBe('function');
            }
        });

        it(`${bundle} registers a lifecycle`, () => {
            const lifecycle = registry.GetLifecycle(bundle);
            expect(lifecycle).toBeDefined();
            expect(typeof lifecycle!.Setup).toBe('function');
            expect(typeof lifecycle!.Teardown).toBe('function');
        });
    }
});
