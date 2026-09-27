import type { IMetadataProvider } from '@memberjunction/core';
import { Metadata, RunView } from '@memberjunction/core';
import type {
    mjBizAppsCollaborationSpaceAgentSkillEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceKnowledgeSourceEntity,
} from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';

function normalizeId(id: string): string {
    return id.trim().toUpperCase();
}

/**
 * Builds the ancestor chain of spaces from root down to the target space.
 */
async function loadSpaceHierarchy(
    provider: IMetadataProvider,
    spaceId: string
): Promise<mjBizAppsCollaborationSpaceEntity[]> {
    const rv = RunView.FromMetadataProvider(provider);
    const spaceResult = await rv.RunView<mjBizAppsCollaborationSpaceEntity>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Spaces',
            ExtraFilter: `ID = '${spaceId}'`,
            ResultType: 'entity_object',
        }
    );

    if (!spaceResult.Success || !spaceResult.Results || spaceResult.Results.length === 0) {
        throw new Error(`Space not found: ${spaceId}`);
    }

    const targetSpace = spaceResult.Results[0];
    const chain: mjBizAppsCollaborationSpaceEntity[] = [targetSpace];
    let parentId = targetSpace.ParentID;

    while (parentId) {
        const parentRes = await rv.RunView<mjBizAppsCollaborationSpaceEntity>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                ExtraFilter: `ID = '${parentId}'`,
                ResultType: 'entity_object',
            }
        );
        if (parentRes.Success && parentRes.Results && parentRes.Results.length > 0) {
            const p = parentRes.Results[0];
            chain.unshift(p);
            parentId = p.ParentID;
        } else {
            break;
        }
    }
    return chain;
}

/**
 * Resolves all bound Content Source IDs for a space, combining:
 * 1. App and Type-level knowledge sources from CollaborationEngine
 * 2. Space-level knowledge sources along the hierarchy from root to target space
 */
export async function resolveSpaceKnowledgeSources(
    provider: IMetadataProvider,
    spaceId: string
): Promise<string[]> {
    const chain = await loadSpaceHierarchy(provider, spaceId);
    const target = chain[chain.length - 1];
    const spaceTypeId = target.SpaceTypeID;

    if (provider && (!CollaborationEngine.Instance.Loaded || provider !== Metadata.Provider)) {
        await CollaborationEngine.Instance.Config(true, undefined, provider);
    } else {
        await CollaborationEngine.Instance.EnsureLoaded(undefined, provider);
    }
    const sourceIds = new Set<string>();

    for (const ks of CollaborationEngine.Instance.AppSpaceKnowledgeSources) {
        if (ks.ContentSourceID) {
            sourceIds.add(normalizeId(ks.ContentSourceID));
        }
    }

    if (spaceTypeId) {
        for (const ks of CollaborationEngine.Instance.SpaceKnowledgeSourcesForType(spaceTypeId)) {
            if (ks.ContentSourceID) {
                sourceIds.add(normalizeId(ks.ContentSourceID));
            }
        }
    }

    const chainIdsSql = chain.map((s) => `'${s.ID}'`).join(',');
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<mjBizAppsCollaborationSpaceKnowledgeSourceEntity>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Space Knowledge Sources',
            ExtraFilter: `SpaceID IN (${chainIdsSql})`,
            ResultType: 'entity_object',
        }
    );

    const rows = res.Success && res.Results ? res.Results : [];
    for (const r of rows) {
        if (r.ContentSourceID) {
            sourceIds.add(normalizeId(r.ContentSourceID));
        }
    }
    return Array.from(sourceIds);
}

/**
 * Resolves all bound AI Skill IDs for a space, combining:
 * 1. App and Type-level skills from CollaborationEngine
 * 2. Space-level skills along the hierarchy from root to target space
 */
export async function resolveSpaceAgentSkills(
    provider: IMetadataProvider,
    spaceId: string
): Promise<string[]> {
    const chain = await loadSpaceHierarchy(provider, spaceId);
    const target = chain[chain.length - 1];
    const spaceTypeId = target.SpaceTypeID;

    if (provider && (!CollaborationEngine.Instance.Loaded || provider !== Metadata.Provider)) {
        await CollaborationEngine.Instance.Config(true, undefined, provider);
    } else {
        await CollaborationEngine.Instance.EnsureLoaded(undefined, provider);
    }
    const skillIds = new Set<string>();

    for (const sk of CollaborationEngine.Instance.AppSpaceAgentSkills) {
        if (sk.SkillID) {
            skillIds.add(normalizeId(sk.SkillID));
        }
    }

    if (spaceTypeId) {
        for (const sk of CollaborationEngine.Instance.SpaceAgentSkillsForType(spaceTypeId)) {
            if (sk.SkillID) {
                skillIds.add(normalizeId(sk.SkillID));
            }
        }
    }

    const chainIdsSql = chain.map((s) => `'${s.ID}'`).join(',');
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<mjBizAppsCollaborationSpaceAgentSkillEntity>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Space Agent Skills',
            ExtraFilter: `SpaceID IN (${chainIdsSql})`,
            ResultType: 'entity_object',
        }
    );

    const rows = res.Success && res.Results ? res.Results : [];
    for (const r of rows) {
        if (r.SkillID) {
            skillIds.add(normalizeId(r.SkillID));
        }
    }
    return Array.from(skillIds);
}
