/**
 * The rules the browser's drivers read for a space (B16, D30): the one resolver, run over the chain the browser can see. The
 * same-type run is walked up through the spaces already loaded; an ancestor the viewer cannot see ends the walk, which can only
 * leave an override out, never add one. The server stays the judge of every write; this feeds the tabs, the labels and the
 * drivers' switches.
 */
import { UUIDsEqual } from '@memberjunction/global';
import {
    type CollaborationSettings,
    type EffectiveSpaceRules,
    ResolveSpaceConfiguration,
    RulesOf,
    type SpaceLevelInput,
} from '@mj-biz-apps/collaboration-core';
import type { CollaborationEngineBase } from '@mj-biz-apps/collaboration-engine-base';

export interface SpaceRowForRules {
    ID: string;
    ParentID?: string | null;
    SpaceTypeID: string;
    Configuration?: string | null;
}

function parseSettings(raw: string | null | undefined, what: string): CollaborationSettings | null {
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CollaborationSettings;
    } catch (error) {
        throw new Error(`${what} has a configuration that does not parse: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/** Throws when a configuration on the chain, or the type's, does not parse, or when the app's row is missing. */
export function rulesForSpace(space: SpaceRowForRules, loaded: readonly SpaceRowForRules[], engine: Pick<CollaborationEngineBase, 'SpaceTypeById' | 'CollaborationSettings'>): EffectiveSpaceRules {
    const chain: SpaceLevelInput[] = [];
    const seen = new Set<string>();
    let current: SpaceRowForRules | undefined = space;
    while (current && !seen.has(current.ID.toLowerCase())) {
        seen.add(current.ID.toLowerCase());
        chain.push({ ID: current.ID, TypeID: current.SpaceTypeID, Settings: parseSettings(current.Configuration, `space ${current.ID}`), Grants: [] });
        const parentId: string | null | undefined = current.ParentID;
        current = parentId ? loaded.find((row) => UUIDsEqual(row.ID, parentId)) : undefined;
    }
    const type = engine.SpaceTypeById(space.SpaceTypeID);
    const configuration = ResolveSpaceConfiguration({
        App: { Settings: engine.CollaborationSettings, Grants: [] },
        Type: type ? { ID: type.ID, Settings: parseSettings(type.Configuration, `space type ${type.ID}`), Grants: [] } : null,
        Spaces: chain,
    });
    return RulesOf(configuration);
}
