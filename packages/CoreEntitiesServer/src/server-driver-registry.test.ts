import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MJGlobal } from '@memberjunction/global';
import type { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { BaseSpaceTypeServerDriver } from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';

class RegistryTestDriver extends BaseSpaceTypeServerDriver {}
MJGlobal.Instance.ClassFactory.Register(BaseSpaceTypeServerDriver, RegistryTestDriver, 'registry-test-driver');

const typeNaming = (driver: string | null, code = 'test-type'): mjBizAppsCollaborationSpaceTypeEntity =>
    ({ Code: code, Name: code, ID: 'type-1', ServerDriverClass: driver }) as unknown as mjBizAppsCollaborationSpaceTypeEntity;

describe('ServerDriverRegistry.GetDriverForType', () => {
    it('gives the default driver to a type that names none', () => {
        const registry = ServerDriverRegistry.Instance;
        for (const naming of [null, '', '   ']) {
            const driver = registry.GetDriverForType(typeNaming(naming));
            assert.equal(driver.constructor, BaseSpaceTypeServerDriver, `named "${naming}"`);
        }
    });

    it('resolves a registered driver by its key, and hands back the same instance next time', () => {
        const registry = ServerDriverRegistry.Instance;
        registry.ClearCache();
        const first = registry.GetDriverForType(typeNaming('registry-test-driver'));
        assert.ok(first instanceof RegistryTestDriver);
        assert.equal(registry.GetDriverForType(typeNaming('registry-test-driver')), first);
        registry.ClearCache();
        assert.notEqual(registry.GetDriverForType(typeNaming('registry-test-driver')), first, 'a cleared cache builds a new one');
    });

    it('refuses a type whose named driver is not registered, saying which type and which class', () => {
        const registry = ServerDriverRegistry.Instance;
        registry.ClearCache();
        assert.throws(
            () => registry.GetDriverForType(typeNaming('no-such-driver', 'orphan-type')),
            /"no-such-driver" is not registered.*"orphan-type"/,
        );
    });
});
