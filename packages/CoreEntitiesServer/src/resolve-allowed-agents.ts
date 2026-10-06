import { LogError, RunView, type IMetadataProvider, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import type { EffectiveGrant, EffectiveSpaceConfiguration } from '@mj-biz-apps/collaboration-core';
import { loadSpaceConfiguration } from './space-configuration.js';
import { parseUuid } from './uuid.js';

/** The shipped assistant's name, as `metadata/agents/` ships it. It is found by this name, never by a typed-in id (item 42). */
export const COLLABORATION_DEFAULT_AGENT_NAME = 'Collaboration Space Agent';

export interface SpaceAgentItem {
    agentId: string;
    /** The grant the agent comes through; null for the shipped assistant standing in where nothing is configured. */
    grantId: string | null;
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

const normalizeId = (id: string | null | undefined): string => (parseUuid(id ?? '') ?? (id ?? '')).trim().toUpperCase();

function itemOf(grant: EffectiveGrant): SpaceAgentItem {
    return {
        agentId: grant.TargetRecordID,
        grantId: grant.GrantID,
        isDefault: grant.IsDefault,
        source: grant.Level,
        spaceId: grant.Level === 'Space' ? grant.LevelID : null,
        spaceTypeId: grant.Level === 'Type' ? grant.LevelID : null,
    };
}

/**
 * The agents people can talk to in a space, from the one configuration (B16, D31): the Agent grants in force, app to type to the
 * same-type run to the space, with `Extend`, `Replace` and `Remove` applied per level. Then:
 * - only Active agents run: a disabled or pending agent stays out, and when it was the default the next default takes over;
 * - with nothing configured at the app, the shipped assistant stands in at the app level, found by its name;
 * - when nothing configured is Active and no level replaced the list, the shipped assistant is the last resort, when Active itself.
 */
export async function resolveAllowedAgents(
    provider: IMetadataProvider,
    spaceId: string,
    contextUser?: UserInfo,
    loaded?: EffectiveSpaceConfiguration,
): Promise<ResolvedAllowedAgentsResult> {
    const configuration = loaded ?? (await loadSpaceConfiguration(provider, spaceId, { reader: contextUser })).configuration;
    return agentsFromConfiguration(provider, spaceId, configuration, contextUser);
}

/** The agent list off a configuration already loaded, so a caller that holds one does not load the chain twice. */
export async function agentsFromConfiguration(
    provider: IMetadataProvider,
    spaceId: string,
    configuration: EffectiveSpaceConfiguration,
    contextUser?: UserInfo,
): Promise<ResolvedAllowedAgentsResult> {
    const rv = RunView.FromMetadataProvider(provider);
    const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
    const userToUse = contextUser ?? system ?? undefined;

    let list: SpaceAgentItem[] = configuration.Grants.Agent.map(itemOf);
    const replaced = configuration.ReplacedKinds.includes('Agent');
    const appConfigured = configuration.Grants.Agent.some((grant) => grant.Level === 'App') || replaced;
    let shipped: string | null = null;
    if (!appConfigured) {
        // Nothing at the app: the shipped assistant stands in there, below whatever the type and the spaces add
        shipped = await shippedAgentId(rv, userToUse);
        if (shipped) list = [{ agentId: shipped, grantId: null, isDefault: true, source: 'App' }, ...list.filter((item) => normalizeId(item.agentId) !== normalizeId(shipped))];
    }

    // Only Active agents run
    const activeIds = await loadActiveAgentIds(rv, userToUse, list.map((item) => item.agentId));
    for (const item of list) {
        if (!activeIds.has(normalizeId(item.agentId))) {
            LogError(`resolveAllowedAgents: agent ${item.agentId} is configured for space ${spaceId}${item.isDefault ? ' as its default' : ''} but is not Active; it is left out.`);
        }
    }
    list = list.filter((item) => activeIds.has(normalizeId(item.agentId)));
    if (list.length === 0 && !replaced) {
        // Nothing configured is Active and no level replaced the list: the shipped agent is the last resort, when it is Active itself
        shipped = shipped ?? (await shippedAgentId(rv, userToUse));
        if (shipped && (await loadActiveAgentIds(rv, userToUse, [shipped])).has(normalizeId(shipped))) {
            list = [{ agentId: shipped, grantId: null, isDefault: true, source: 'App' }];
        }
    }

    // The default: the configuration's choice when it is still in the list, else the nearest flagged, else the first
    const configuredDefault = list.find((item) => item.grantId && item.grantId === configuration.DefaultAgentGrantID);
    const defaultItem = configuredDefault ?? [...list].reverse().find((item) => item.isDefault) ?? list[0];
    return {
        allowedAgentIds: list.map((item) => item.agentId),
        defaultAgentId: defaultItem?.agentId ?? null,
        agents: list,
    };
}

/** The shipped assistant's id, by its name. Null, with a log, when the agent is not in this database. */
async function shippedAgentId(rv: RunView, user: UserInfo | undefined): Promise<string | null> {
    const res = await rv.RunView<{ ID: string }>({
        EntityName: 'MJ: AI Agents',
        ExtraFilter: `Name = '${COLLABORATION_DEFAULT_AGENT_NAME.replace(/'/g, "''")}'`,
        Fields: ['ID'],
        ResultType: 'simple',
        MaxRows: 1,
    }, user);
    if (!res.Success) throw refuse(`the shipped assistant could not be read: ${res.ErrorMessage ?? 'unknown error'}`);
    const id = res.Results?.[0]?.ID ?? null;
    if (!id) LogError(`resolveAllowedAgents: no agent named "${COLLABORATION_DEFAULT_AGENT_NAME}" is in this database, so nothing stands in where no agent is configured.`);
    return id;
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

/** A refusal of the agent list: logged, and thrown by the caller, so nothing resolves with a link of the chain missing. */
function refuse(message: string): Error {
    LogError(`resolveAllowedAgents: ${message}`);
    return new Error(`Agent list refused: ${message}`);
}
