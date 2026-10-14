import { BaseEntityResult, LogError, type BaseEntity, type IEntityDataProvider, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { type EffectiveSpaceConfiguration, RulesOf } from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import type { BaseSpaceTypeServerDriver, DriverBaseContext, DriverValidationResult } from './base-space-type-server-driver.js';
import { ServerDriverRegistry } from './server-driver-registry.js';

/** The IsA child of Spaces a type names (`SpaceType.SpaceExtensionEntity`), or null: what every hook is told as `subtypeEntityName`. */
export function subtypeOf(spaceType: { SpaceExtensionEntity?: string | null } | null | undefined): string | null {
    return spaceType?.SpaceExtensionEntity?.trim() || null;
}

/** Whether two types name the same subtype (or both none), trimmed and without regard to case, as `refuseSubtypePairing` compares. */
export function sameSubtype(a: { SpaceExtensionEntity?: string | null } | null | undefined, b: { SpaceExtensionEntity?: string | null } | null | undefined): boolean {
    return (subtypeOf(a) ?? '').toLowerCase() === (subtypeOf(b) ?? '').toLowerCase();
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
        const { space, spaceType, driver, configuration } = await ServerDriverRegistry.Instance.ResolveSpaceAndType(spaceId, contextEntity);
        return {
            ok: true,
            call: { driver, base: await driverBaseContext(provider, user, space, spaceType, configuration) },
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'The space type\'s driver could not be resolved.';
        LogError(`resolveSpaceDriver: ${message}`);
        return { ok: false, message };
    }
}

/**
 * The context every hook takes, for a stored space: its one configuration, loaded here (as the system user), and the rules read off
 * it. A chain that cannot be read throws, so the write it was judging is refused.
 */
export async function driverBaseContext(
    provider: IMetadataProvider | IEntityDataProvider,
    user: UserInfo,
    space: mjBizAppsCollaborationSpaceEntity,
    spaceType: mjBizAppsCollaborationSpaceTypeEntity,
    loaded?: EffectiveSpaceConfiguration,
): Promise<DriverBaseContext> {
    const configuration = loaded ?? (await ServerDriverRegistry.Instance.ConfigurationFor(space, provider));
    return { actingUser: user, provider, space, spaceType, configuration, effectiveRules: RulesOf(configuration), subtypeEntityName: subtypeOf(spaceType) };
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

/** Records a refused save on the entity's result history and returns false, as a save that fails must. */
export function failSave(entity: BaseEntity, message: string): false {
    const result = new BaseEntityResult();
    result.Success = false;
    result.Type = entity.IsSaved ? 'update' : 'create';
    result.Message = message;
    entity.RegisterResultHistoryEntry(result);
    return false;
}
