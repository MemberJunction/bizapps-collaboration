import { BaseEntityResult, LogError, type BaseEntity, type IEntityDataProvider, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { ResolveSpaceRules } from '@mj-biz-apps/collaboration-core';
import type { BaseSpaceTypeServerDriver, DriverBaseContext, DriverValidationResult } from './base-space-type-server-driver.js';
import { ServerDriverRegistry } from './server-driver-registry.js';

/** The IsA child of Spaces a type names (`SpaceType.SpaceExtensionEntity`), or null: what every hook is told as `subtypeEntityName`. */
export function subtypeOf(spaceType: { SpaceExtensionEntity?: string | null } | null | undefined): string | null {
    return spaceType?.SpaceExtensionEntity?.trim() || null;
}

/** What a driver call needs: the space, its type, the driver, and the context every hook takes. */
export interface SpaceDriverCall {
    driver: BaseSpaceTypeServerDriver;
    base: DriverBaseContext;
}

export type SpaceDriverResolution = { ok: true; call: SpaceDriverCall } | { ok: false; message: string };

/**
 * Resolves the driver of a space's type. A type that names a driver nobody registered fails closed: the caller refuses the
 * write, as an entity save does. `contextEntity` is any entity from the caller's provider, which the registry reads through.
 */
export async function resolveSpaceDriver(
    contextEntity: BaseEntity,
    provider: IMetadataProvider | IEntityDataProvider,
    user: UserInfo,
    spaceId: string,
): Promise<SpaceDriverResolution> {
    try {
        const { space, spaceType, driver } = await ServerDriverRegistry.Instance.ResolveSpaceAndType(spaceId, contextEntity);
        return {
            ok: true,
            call: {
                driver,
                base: { actingUser: user, provider, space, spaceType, effectiveRules: ResolveSpaceRules(null, null), subtypeEntityName: subtypeOf(spaceType) },
            },
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'The space type\'s driver could not be resolved.';
        LogError(`resolveSpaceDriver: ${message}`);
        return { ok: false, message };
    }
}

/** A driver's verdict as a refusal message, or null when it accepts. */
export function refusalOf(verdict: DriverValidationResult): string | null {
    return verdict.ok ? null : verdict.message ?? 'The space type refused this.';
}

/** Records a refused delete on the entity's result history and returns false, as a delete that fails must. */
export function failDelete(entity: BaseEntity, message: string): false {
    const result = new BaseEntityResult();
    result.Success = false;
    result.Type = 'delete';
    result.Message = message;
    entity.RegisterResultHistoryEntry(result);
    return false;
}
