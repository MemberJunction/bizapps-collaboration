import { LogError, type IMetadataProvider } from '@memberjunction/core';
import type { EffectiveSpaceConfiguration } from '@mj-biz-apps/collaboration-core';
import { loadSpaceConfiguration } from './space-configuration.js';
import { parseUuid } from './uuid.js';

const normalizeId = (id: string): string => (parseUuid(id) ?? id).trim().toUpperCase();

/**
 * The Content Sources an agent may read in a space (stage 1: the KnowledgeSource grants in force), off the one configuration (B16):
 * the app's, the type's and the same-type run's grants, with `Extend`, `Replace` and `Remove` applied per level.
 */
export async function resolveSpaceKnowledgeSources(provider: IMetadataProvider, spaceId: string, loaded?: EffectiveSpaceConfiguration): Promise<string[]> {
    const configuration = loaded ?? (await loadSpaceConfiguration(provider, spaceId)).configuration;
    const sourceIds = new Set<string>();
    for (const grant of configuration.Grants.KnowledgeSource) {
        if (grant.TargetRecordID) sourceIds.add(normalizeId(grant.TargetRecordID));
    }
    return Array.from(sourceIds);
}

/**
 * The AI Skill IDs the Agent grants in force name for a space (`Settings.Skills`, D31). A grant whose settings say 'None', or name no
 * skills, adds none. A settings document the resolver could not read was already left out, with its grant, before this.
 */
export async function resolveSpaceAgentSkills(provider: IMetadataProvider, spaceId: string, loaded?: EffectiveSpaceConfiguration): Promise<string[]> {
    const configuration = loaded ?? (await loadSpaceConfiguration(provider, spaceId)).configuration;
    const skillIds = new Set<string>();
    for (const grant of configuration.Grants.Agent) {
        const skills = grant.Settings?.Skills;
        if (!skills || skills === 'None') continue;
        if (!Array.isArray(skills)) {
            LogError(`resolveSpaceAgentSkills: grant ${grant.GrantID} names skills in a shape that is not a list; none are added.`);
            continue;
        }
        for (const id of skills) if (typeof id === 'string' && id.trim()) skillIds.add(normalizeId(id));
    }
    return Array.from(skillIds);
}
