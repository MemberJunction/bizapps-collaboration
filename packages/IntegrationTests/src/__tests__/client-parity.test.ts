import { describe, expect, it } from 'vitest';
import { BaseEntity } from '@memberjunction/core';
import { MJGlobal } from '@memberjunction/global';
import { IntegrationCheckRegistry } from '@memberjunction/testing-integration';
import {
    mjBizAppsCollaborationItemUseEntity,
    mjBizAppsCollaborationShareNoticeEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
} from '@mj-biz-apps/collaboration-entities';
import { TaskEntity } from '@mj-biz-apps/tasks-entities';
import { LoadCollaborationClientIntegrationTests } from '../client-index.js';
import { EXPECTED_CLIENT_BUNDLES } from '../expected-bundles.js';

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

    it('creates generated entity classes without loading server subclasses', () => {
        const factory = MJGlobal.Instance.ClassFactory;
        const expectedClasses: Record<string, string> = {
            'MJ_BizApps_Collaboration: Spaces': mjBizAppsCollaborationSpaceEntity.name,
            'MJ_BizApps_Collaboration: Space Members': mjBizAppsCollaborationSpaceMemberEntity.name,
            'MJ_BizApps_Collaboration: Space Items': mjBizAppsCollaborationSpaceItemEntity.name,
            'MJ_BizApps_Collaboration: Share Notices': mjBizAppsCollaborationShareNoticeEntity.name,
            'MJ_BizApps_Collaboration: Item Uses': mjBizAppsCollaborationItemUseEntity.name,
            'MJ_BizApps_Tasks: Tasks': TaskEntity.name,
        };

        for (const [entityName, expectedClassName] of Object.entries(expectedClasses)) {
            const reg = factory.GetRegistration(BaseEntity, entityName);
            expect(reg, `registration for ${entityName} must exist`).toBeDefined();
            const subClassName = reg?.SubClass?.name;
            expect(subClassName).toBe(expectedClassName);
            expect(subClassName?.endsWith('Server')).toBe(false);
        }
    });
});
