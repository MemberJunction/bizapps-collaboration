import { LogError, RunView, WellKnownUserSource, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { ResolveSpaceRules, type EffectiveSpaceRules, type ISpaceConfiguration, type ISpaceTypeConfiguration } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';

export const COLLABORATION_DEFAULT_AGENT_ID = '9E6D761A-197A-40AF-995B-3D3DD9BD7B9E';

export interface SpaceAgentItem {
    agentId: string;
    isDefault: boolean;
    source: 'App' | 'Type' | 'Space';
    spaceId?: string | null;
    spaceTypeId?: string | null;
}

export interface ResolvedAllowedAgentsResult {
    allowedAgentIds: string[];
    /** Null when no agent is Active, so nothing is tagged by default and the ask box has nothing to run. */
    defaultAgentId: string | null;
    agents: SpaceAgentItem[];
}

function normalizeId(id: string | null | undefined): string {
    return (id ?? '').trim().toUpperCase();
}

/**
 * Resolves the allowed agents for a space top-down:
 * 1. Collaboration app-wide defaults (SpaceAgent rows with SpaceTypeID IS NULL AND SpaceID IS NULL)
 * 2. SpaceType rows
 * 3. Root space down through the ancestor tree to the target space
 *
 * At each level, Agents.ListMode ('Extend' | 'Replace') controls inheritance:
 * - 'Extend' (default): adds that level's rows to the accumulated list
 * - 'Replace': replaces previous list with that level's rows
 * A level without rows passes the inherited list down unchanged.
 */
export async function resolveAllowedAgents(
    provider: IMetadataProvider,
    spaceId: string,
    contextUser?: UserInfo
): Promise<ResolvedAllowedAgentsResult> {
    const rv = RunView.FromMetadataProvider(provider);
    const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
    const userToUse = contextUser ?? system ?? undefined;

    interface SpaceChainNode {
        ID: string;
        ParentID: string | null;
        SpaceTypeID: string | null;
        Configuration: string | null;
    }

    // 1. Load the space and its ancestors
    const spaceResult = await rv.RunView<SpaceChainNode>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Spaces',
            ExtraFilter: `ID = '${spaceId}'`,
            Fields: ['ID', 'ParentID', 'SpaceTypeID', 'Configuration'],
            ResultType: 'simple',
        },
        userToUse
    );

    if (!spaceResult.Success || !spaceResult.Results || spaceResult.Results.length === 0) {
        throw new Error(`Space not found: ${spaceId}`);
    }

    const targetSpace = spaceResult.Results[0];
    const spaceTypeId = targetSpace.SpaceTypeID;

    // Build ancestor chain from root to target space
    const spaceChain: SpaceChainNode[] = [targetSpace];
    let currentParentId = targetSpace.ParentID;
    while (currentParentId) {
        const parentRes = await rv.RunView<SpaceChainNode>(
            {
                EntityName: 'MJ_BizApps_Collaboration: Spaces',
                ExtraFilter: `ID = '${currentParentId}'`,
                Fields: ['ID', 'ParentID', 'SpaceTypeID', 'Configuration'],
                ResultType: 'simple',
            },
            userToUse
        );
        if (parentRes.Success && parentRes.Results && parentRes.Results.length > 0) {
            const parentSpace = parentRes.Results[0];
            spaceChain.unshift(parentSpace); // Insert at beginning so root is first
            currentParentId = parentSpace.ParentID;
        } else {
            break;
        }
    }

    // Load SpaceType configuration from CollaborationEngine once without per-request full reload
    const systemUserForEngine = system ?? (await WellKnownUserSource.Instance.GetSystemUser(provider));
    await CollaborationEngine.Instance.EnsureLoaded(systemUserForEngine ?? undefined, provider);
    const spaceType = spaceTypeId ? CollaborationEngine.Instance.SpaceTypeById(spaceTypeId) : undefined;

    let typeConfig: ISpaceTypeConfiguration | null = null;
    if (spaceType?.Configuration) {
        try {
            typeConfig = JSON.parse(spaceType.Configuration) as ISpaceTypeConfiguration;
        } catch (err) {
            LogError(`Failed to parse SpaceType configuration for ${spaceTypeId}: ${err instanceof Error ? err.message : String(err)}`);
            typeConfig = null;
        }
    }

    // App-wide level from CollaborationEngine
    const appRows = CollaborationEngine.Instance.AppSpaceAgents;
    let currentList: SpaceAgentItem[] = [];

    if (appRows.length > 0) {
        currentList = appRows.map((r) => ({
            agentId: r.AgentID,
            isDefault: r.IsDefault ?? false,
            source: 'App',
        }));
    } else {
        // Built-in fallback default
        currentList = [
            {
                agentId: COLLABORATION_DEFAULT_AGENT_ID,
                isDefault: true,
                source: 'App',
            },
        ];
    }

    // Type level from CollaborationEngine
    if (spaceTypeId) {
        const typeRows = CollaborationEngine.Instance.SpaceAgentsForType(spaceTypeId);
        if (typeRows.length > 0) {
            const typeListMode = typeConfig?.Agents?.ListMode ?? 'Extend';
            const mappedType: SpaceAgentItem[] = typeRows.map((r) => ({
                agentId: r.AgentID,
                isDefault: r.IsDefault ?? false,
                source: 'Type',
                spaceTypeId,
            }));

            if (typeListMode === 'Replace') {
                currentList = mappedType;
            } else {
                // Extend: deduplicate by agentId, keeping type entry if collision
                const existingIds = new Set(mappedType.map((m) => normalizeId(m.agentId)));
                currentList = currentList.filter((c) => !existingIds.has(normalizeId(c.agentId))).concat(mappedType);
            }
        }
    }

    // 2. Query only space-level SpaceAgent rows for any space in chain
    const chainIdsSql = spaceChain.map((s) => `'${s.ID}'`).join(',');
    const agentsRes = await rv.RunView<{ ID: string; AgentID: string; SpaceID: string | null; IsDefault?: boolean }>(
        {
            EntityName: 'MJ_BizApps_Collaboration: Space Agents',
            ExtraFilter: `SpaceID IN (${chainIdsSql})`,
            Fields: ['ID', 'AgentID', 'SpaceID', 'IsDefault'],
            ResultType: 'simple',
        },
        userToUse
    );

    const spaceAgentRows = agentsRes.Success && agentsRes.Results ? agentsRes.Results : [];

    // Space levels (top-down from root to target space)
    for (const sp of spaceChain) {
        const normSpId = normalizeId(sp.ID);
        const spRows = spaceAgentRows.filter((r) => r.SpaceID && normalizeId(r.SpaceID) === normSpId);
        if (spRows.length > 0) {
            let spaceConfig: ISpaceConfiguration | null = null;
            if (sp.Configuration) {
                try {
                    spaceConfig = JSON.parse(sp.Configuration) as ISpaceConfiguration;
                } catch {
                    spaceConfig = null;
                }
            }
            const rules: EffectiveSpaceRules = ResolveSpaceRules(typeConfig, spaceConfig);
            const spaceListMode = rules.Agents.ListMode;

            const mappedSpace: SpaceAgentItem[] = spRows.map((r) => ({
                agentId: r.AgentID,
                isDefault: r.IsDefault ?? false,
                source: 'Space',
                spaceId: sp.ID,
            }));

            if (spaceListMode === 'Replace') {
                currentList = mappedSpace;
            } else {
                const existingIds = new Set(mappedSpace.map((m) => normalizeId(m.agentId)));
                currentList = currentList.filter((c) => !existingIds.has(normalizeId(c.agentId))).concat(mappedSpace);
            }
        }
    }

    // Only Active agents run. A disabled or pending agent stays out of the list, and when it was the default the next default takes
    // over, so the ask box never tags an agent that won't run.
    const activeIds = await loadActiveAgentIds(rv, userToUse, currentList.map((a) => a.agentId));
    for (const item of currentList) {
        if (!activeIds.has(normalizeId(item.agentId))) {
            LogError(`resolveAllowedAgents: agent ${item.agentId} is configured for space ${spaceId}${item.isDefault ? ' as its default' : ''} but is not Active; it is left out.`);
        }
    }
    currentList = currentList.filter((item) => activeIds.has(normalizeId(item.agentId)));
    if (currentList.length === 0) {
        // Nothing configured is Active: the shipped agent is the last resort, when it is Active itself
        const shipped = await loadActiveAgentIds(rv, userToUse, [COLLABORATION_DEFAULT_AGENT_ID]);
        if (shipped.has(normalizeId(COLLABORATION_DEFAULT_AGENT_ID))) {
            currentList = [{ agentId: COLLABORATION_DEFAULT_AGENT_ID, isDefault: true, source: 'App' }];
        }
    }

    const allowedAgentIds = currentList.map((a) => a.agentId);
    const defaultItem = currentList.find((a) => a.isDefault) ?? currentList[0];
    const defaultAgentId = defaultItem?.agentId ?? null;

    return {
        allowedAgentIds,
        defaultAgentId,
        agents: currentList,
    };
}

/** The IDs among `agentIds` whose agent is Active. A read that fails refuses, as a list that can't be checked is not one to run. */
async function loadActiveAgentIds(rv: RunView, user: UserInfo | undefined, agentIds: readonly string[]): Promise<Set<string>> {
    const ids = [...new Set(agentIds.map((id) => normalizeId(id)).filter((id) => id.length > 0))];
    if (ids.length === 0) return new Set();
    const res = await rv.RunView<{ ID: string }>(
        {
            EntityName: 'MJ: AI Agents',
            ExtraFilter: `Status = 'Active' AND ID IN (${ids.map((id) => `'${id}'`).join(',')})`,
            Fields: ['ID'],
            ResultType: 'simple',
        },
        user,
    );
    if (!res.Success) {
        LogError(`resolveAllowedAgents: could not read the agents: ${res.ErrorMessage ?? 'unknown error'}`);
        throw new Error(`Allowed agents refused: the agents could not be read: ${res.ErrorMessage ?? 'unknown error'}`);
    }
    return new Set((res.Results ?? []).map((row) => normalizeId(row.ID)));
}
