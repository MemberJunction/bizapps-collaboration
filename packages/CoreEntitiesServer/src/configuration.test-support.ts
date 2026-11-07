import { DEFAULT_COLLABORATION_SETTINGS, type EffectiveSpaceConfiguration, ResolveSpaceConfiguration } from '@mj-biz-apps/collaboration-core';
import { ServerDriverRegistry, type SpaceForConfiguration } from '../dist/server-driver-registry.js';

/** A configuration with the app's defaults and no grants, as a space with nothing configured resolves to. */
export function defaultConfiguration(space?: Partial<SpaceForConfiguration>): EffectiveSpaceConfiguration {
    return ResolveSpaceConfiguration({
        App: { Settings: DEFAULT_COLLABORATION_SETTINGS, Grants: [] },
        Type: null,
        Spaces: [{ ID: space?.ID ?? 'space-under-test', TypeID: space?.SpaceTypeID ?? null, Settings: null, Grants: [] }],
    });
}

/**
 * Stands in for the registry's configuration loader, so a test of a save's rules does not need a readable chain behind its mock
 * provider. Returns a function that puts the loader back. `answer` may refuse, as the loader does, by throwing.
 */
export function stubConfigurationFor(answer: (space: SpaceForConfiguration) => EffectiveSpaceConfiguration = (space) => defaultConfiguration(space)): () => void {
    const registry = ServerDriverRegistry.Instance;
    const held = registry.ConfigurationFor.bind(registry);
    registry.ConfigurationFor = (async (space: SpaceForConfiguration) => answer(space)) as typeof registry.ConfigurationFor;
    return () => {
        registry.ConfigurationFor = held;
    };
}
