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

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const registry = IntegrationCheckRegistry.Instance;

export const EXPECTED_BUNDLES: Record<string, number> = {
    'collab-world': 3,
    'people-fls': 4,
    'parent-assignees': 5,
    'room': 6,
    'write-gates': 5,
    'row-filters': 4,
    'library': 1,
    'agent': 6,
};

export const EXPECTED_CLIENT_BUNDLES: Record<string, number> = {
    'collab-world': 3,
    'people-fls': 4,
    'parent-assignees': 5,
    'room': 6,
    'write-gates': 5,
    'row-filters': 4,
    'library': 4,
    'agent': 6,
};

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
