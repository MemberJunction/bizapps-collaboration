import type { IMetadataProvider } from '@memberjunction/core';
import { RunView } from '@memberjunction/core';
import type {
    mjBizAppsCollaborationSpaceAgentSkillEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceKnowledgeSourceEntity,
} from '@mj-biz-apps/collaboration-entities';

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
 * 1. Type-level knowledge sources (SpaceTypeID = space.SpaceTypeID AND SpaceID IS NULL)
 * 2. Space-level knowledge sources along the hierarchy from root to target space
 */
export async function resolveSpaceKnowledgeSources(
    provider: IMetadataProvider,
    spaceId: string
): Promise<string[]> {
    const chain = await loadSpaceHierarchy(provider, spaceId);
    const target = chain[chain.length - 1];
    const spaceTypeId = target.SpaceTypeID;

    const chainIdsSql = chain.map((s) => `'${s.ID}'`).join(',');
    const extraFilter = spaceTypeId
        ? `(SpaceTypeID = '${spaceTypeId}' AND SpaceID IS NULL) OR (SpaceID IN (${chainIdsSql}))`
        : `(SpaceID IN (${chainIdsSql}))`;

    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<mjBizAppsCollaborationSpaceKnowledgeSourceEntity>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Space Knowledge Sources',
            ExtraFilter: extraFilter,
            ResultType: 'entity_object',
        }
    );

    const rows = res.Success && res.Results ? res.Results : [];
    const sourceIds = new Set<string>();
    for (const r of rows) {
        if (r.ContentSourceID) {
            sourceIds.add(normalizeId(r.ContentSourceID));
        }
    }
    return Array.from(sourceIds);
}

/**
 * Resolves all bound AI Skill IDs for a space, combining:
 * 1. Type-level skills (SpaceTypeID = space.SpaceTypeID AND SpaceID IS NULL)
 * 2. Space-level skills along the hierarchy from root to target space
 */
export async function resolveSpaceAgentSkills(
    provider: IMetadataProvider,
    spaceId: string
): Promise<string[]> {
    const chain = await loadSpaceHierarchy(provider, spaceId);
    const target = chain[chain.length - 1];
    const spaceTypeId = target.SpaceTypeID;

    const chainIdsSql = chain.map((s) => `'${s.ID}'`).join(',');
    const extraFilter = spaceTypeId
        ? `(SpaceTypeID = '${spaceTypeId}' AND SpaceID IS NULL) OR (SpaceID IN (${chainIdsSql}))`
        : `(SpaceID IN (${chainIdsSql}))`;

    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<mjBizAppsCollaborationSpaceAgentSkillEntity>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Space Agent Skills',
            ExtraFilter: extraFilter,
            ResultType: 'entity_object',
        }
    );

    const rows = res.Success && res.Results ? res.Results : [];
    const skillIds = new Set<string>();
    for (const r of rows) {
        if (r.SkillID) {
            skillIds.add(normalizeId(r.SkillID));
        }
    }
    return Array.from(skillIds);
}
