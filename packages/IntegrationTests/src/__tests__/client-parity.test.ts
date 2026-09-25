import { describe, expect, it } from 'vitest';
import { IntegrationCheckRegistry } from '@memberjunction/testing-integration';
import { LoadCollaborationClientIntegrationTests } from '../client-index.js';

const EXPECTED_CLIENT_BUNDLES: Record<string, number> = {
    'collab-world': 3,
    'people-fls': 4,
    'parent-assignees': 5,
    'room': 6,
    'write-gates': 5,
    'row-filters': 4,
    'library': 4,
    'agent': 6,
};

LoadCollaborationClientIntegrationTests();

const registry = IntegrationCheckRegistry.Instance;
const FRAMEWORK_BUNDLES = new Set(['self-test']);
const ourBundles = () => registry.GetBundleNames().filter((b) => !FRAMEWORK_BUNDLES.has(b));

describe('Client IntegrationCheckRegistry parity (client-index)', () => {
    it('registers exactly the expected client bundles', () => {
        expect(ourBundles().sort()).toEqual(Object.keys(EXPECTED_CLIENT_BUNDLES).sort());
    });

    for (const [bundle, count] of Object.entries(EXPECTED_CLIENT_BUNDLES)) {
        it(`${bundle} has exactly ${count} client checks with unique IDs`, () => {
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
