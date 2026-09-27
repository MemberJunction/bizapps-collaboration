/**
 * ServerDriverRegistry
 * Resolves and caches BaseSpaceTypeServerDriver instances using BaseSingleton and ClassFactory.
 * Follows extensibility plan § 5.
 */

import { type BaseEntity } from '@memberjunction/core';
import { BaseSingleton, MJGlobal } from '@memberjunction/global';
import { type mjBizAppsCollaborationSpaceEntity, type mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import { BaseSpaceTypeServerDriver } from './base-space-type-server-driver.js';
import { requireSystemUser } from './load-graph.js';
import { asMetadata } from './uuid.js';

export class ServerDriverRegistry extends BaseSingleton<ServerDriverRegistry> {
    private drivers = new Map<string, BaseSpaceTypeServerDriver>();
    private defaultDriver = new BaseSpaceTypeServerDriver();

    protected constructor() {
        super();
    }

    public static get Instance(): ServerDriverRegistry {
        return super.getInstance<ServerDriverRegistry>();
    }

    /**
     * Resolves the server driver for a space type.
     * - If ServerDriverClass is not set, returns the default driver.
     * - If ServerDriverClass is set, resolves via MJGlobal.Instance.ClassFactory.TryCreateInstance.
     * - If the named class is not registered (attempt.Resolved === false), throws an error to fail closed.
     */
    public GetDriverForType(type: mjBizAppsCollaborationSpaceTypeEntity): BaseSpaceTypeServerDriver {
        const className = type.ServerDriverClass?.trim();
        if (!className) {
            return this.defaultDriver;
        }

        const cached = this.drivers.get(className);
        if (cached) {
            return cached;
        }

        const attempt = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseSpaceTypeServerDriver>(
            BaseSpaceTypeServerDriver,
            className
        );
        if (!attempt || !attempt.Resolved || !attempt.Instance) {
            throw new Error(
                `Space driver class "${className}" is not registered on the server. Writes to spaces of type "${type.Code ?? type.Name ?? type.ID}" are refused.`
            );
        }

        this.drivers.set(className, attempt.Instance);
        return attempt.Instance;
    }

    /** Clears the driver cache (called when space type metadata is modified). */
    public ClearCache(): void {
        this.drivers.clear();
    }

    /**
     * Loads a SpaceType by ID and returns the entity.
     */
    public async ResolveType(typeId: string, contextEntity: BaseEntity): Promise<mjBizAppsCollaborationSpaceTypeEntity> {
        const sys = await requireSystemUser(contextEntity);
        const metadata = asMetadata(contextEntity.ProviderToUse);
        if (!metadata) throw new Error('Metadata provider not available');
        const entity = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>('MJ_BizApps_Collaboration: Space Types', sys);
        if (!await entity.Load(typeId)) {
            throw new Error(`Space type "${typeId}" could not be loaded.`);
        }
        return entity;
    }

    /**
     * Loads a Space and its SpaceType by space ID, returning both and the resolved driver.
     */
    public async ResolveSpaceAndType(spaceId: string, contextEntity: BaseEntity): Promise<{
        space: mjBizAppsCollaborationSpaceEntity;
        spaceType: mjBizAppsCollaborationSpaceTypeEntity;
        driver: BaseSpaceTypeServerDriver;
    }> {
        const sys = await requireSystemUser(contextEntity);
        const metadata = asMetadata(contextEntity.ProviderToUse);
        if (!metadata) throw new Error('Metadata provider not available');
        const space = await metadata.GetEntityObject<mjBizAppsCollaborationSpaceEntity>('MJ_BizApps_Collaboration: Spaces', sys);
        if (!await space.Load(spaceId)) {
            throw new Error(`Space "${spaceId}" could not be loaded.`);
        }
        const spaceType = await this.ResolveType(space.SpaceTypeID, contextEntity);
        const driver = this.GetDriverForType(spaceType);
        return { space, spaceType, driver };
    }
}
