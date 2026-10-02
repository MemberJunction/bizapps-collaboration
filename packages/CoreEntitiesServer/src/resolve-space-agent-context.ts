import { RunView, WellKnownUserSource, type IMetadataProvider } from '@memberjunction/core';
import type { AgentGrantSettings } from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceGrantEntity } from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine } from './CollaborationEngine.js';

const GRANTS = 'MJ_BizApps_Collaboration: Space Grants';

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

/** The grants of one kind in force for a space: the app's, its type's, and the rows of every space on the chain from the root down. */
async function grantsInForce(
    provider: IMetadataProvider,
    spaceId: string,
    kind: 'Agent' | 'KnowledgeSource',
): Promise<Array<Pick<mjBizAppsCollaborationSpaceGrantEntity, 'ID' | 'TargetRecordID' | 'Settings' | 'SpaceID' | 'SpaceTypeID'>>> {
    const chain = await loadSpaceHierarchy(provider, spaceId);
    const target = chain[chain.length - 1];
    const spaceTypeId = target.SpaceTypeID;

    const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
    await CollaborationEngine.Instance.EnsureLoaded(system ?? undefined, provider);
    const rows: Array<Pick<mjBizAppsCollaborationSpaceGrantEntity, 'ID' | 'TargetRecordID' | 'Settings' | 'SpaceID' | 'SpaceTypeID'>> = [
        ...CollaborationEngine.Instance.AppGrantsOfKind(kind),
        ...(spaceTypeId ? CollaborationEngine.Instance.TypeGrantsOfKind(spaceTypeId, kind) : []),
    ];

    const chainIdsSql = chain.map((s) => `'${s.ID}'`).join(',');
    const rv = RunView.FromMetadataProvider(provider);
    const res = await rv.RunView<Pick<mjBizAppsCollaborationSpaceGrantEntity, 'ID' | 'TargetRecordID' | 'Settings' | 'SpaceID' | 'SpaceTypeID'>>(
        {
            EntityName: GRANTS,
            ExtraFilter: `Kind = '${kind}' AND SpaceID IN (${chainIdsSql})`,
            Fields: ['ID', 'TargetRecordID', 'Settings', 'SpaceID', 'SpaceTypeID'],
            ResultType: 'simple',
        }
    );
    if (res.Success && res.Results) rows.push(...res.Results);
    return rows;
}

/**
 * Resolves all bound Content Source IDs for a space (stage 1: the KnowledgeSource grants in force), combining:
 * 1. App and type-level grants from CollaborationEngine
 * 2. Space-level grants along the hierarchy from root to target space
 */
export async function resolveSpaceKnowledgeSources(
    provider: IMetadataProvider,
    spaceId: string
): Promise<string[]> {
    const sourceIds = new Set<string>();
    for (const grant of await grantsInForce(provider, spaceId, 'KnowledgeSource')) {
        if (grant.TargetRecordID) sourceIds.add(normalizeId(grant.TargetRecordID));
    }
    return Array.from(sourceIds);
}

/**
 * Resolves all AI Skill IDs the Agent grants in force name for a space (`Settings.Skills`, D31), combining:
 * 1. App and type-level grants from CollaborationEngine
 * 2. Space-level grants along the hierarchy from root to target space
 * A grant whose settings say 'None', or name no skills, adds none.
 */
export async function resolveSpaceAgentSkills(
    provider: IMetadataProvider,
    spaceId: string
): Promise<string[]> {
    const skillIds = new Set<string>();
    for (const grant of await grantsInForce(provider, spaceId, 'Agent')) {
        if (!grant.Settings) continue;
        let settings: AgentGrantSettings;
        try {
            settings = JSON.parse(grant.Settings) as AgentGrantSettings;
        } catch {
            continue;
        }
        if (Array.isArray(settings.Skills)) {
            for (const id of settings.Skills) if (typeof id === 'string' && id.trim()) skillIds.add(normalizeId(id));
        }
    }
    return Array.from(skillIds);
}
