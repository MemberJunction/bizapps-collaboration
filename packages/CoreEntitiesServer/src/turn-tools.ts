/**
 * The tools of an agent turn, on the server (B20): Core's `turnToolsFor` decides from the one configuration and the audience;
 * this reads what the decision needs from the database (the targets' names, a query's parameters, the agent's own actions) and
 * shapes it for MJ's run: `actionChanges`, the per-turn data grants the model is told about, and the run's context for
 * *Run space data*. Everything is read as the system user: the caller never sees a target they could not reach, since the
 * grants were cut to the audience first.
 */
import { LogError, LogStatus, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import type { ActionChange } from '@memberjunction/ai-core-plus';
import {
    agentGrantFor,
    agentRunSettingsFor,
    type AgentRunSettings,
    type ChatAudience,
    type EffectiveGrant,
    type EffectiveSpaceConfiguration,
    turnToolsFor,
    type TurnTools,
} from '@mj-biz-apps/collaboration-core';

/** The shipped *Collaboration: Run Space Data* action, as `metadata/actions/` ships it. */
export const RUN_SPACE_DATA_ACTION_ID = 'EAE6CFED-E2EB-4B6E-816D-6CFE5156A5F5';
export const RUN_SPACE_DATA_ACTION_NAME = 'Collaboration: Run Space Data';

/** One query or view the turn may run through *Run space data*: what the model is told, and what the action checks against. */
export interface TurnSpaceDataGrant {
    GrantID: string;
    Kind: 'Query' | 'View';
    /** The name the model uses: the grant's label, else the target's own name. */
    Name: string;
    Description: string | null;
    /** The target's own parameters the model may set: a query's parameters less the bound ones; a view has none. */
    Parameters: string[];
}

/** What *Run space data* reads from the run's context: the space, the conversation and the grants in force for this turn. */
export interface SpaceTurnContext {
    spaceId: string;
    conversationId: string;
    audience: ChatAudience;
    spaceData: TurnSpaceDataGrant[];
    /** Set once the run exists, so the action's log row names it (A2). */
    agentRunId?: string | null;
}

export interface ResolvedTurnTools {
    tools: TurnTools;
    spaceData: TurnSpaceDataGrant[];
    /** The action ids given to the agent, Run space data included when there is data to run. */
    actionIds: string[];
    actionChanges: ActionChange[];
    runSettings: AgentRunSettings;
    /** The agent grant the turn runs under, or null for the shipped stand-in. */
    agentGrant: EffectiveGrant | null;
    /** What was withheld and why, for the turn's result and the log. */
    withheld: string[];
}

const QUERIES = 'MJ: Queries';
const QUERY_PARAMETERS = 'MJ: Query Parameters';
const USER_VIEWS = 'MJ: User Views';
const AGENT_ACTIONS = 'MJ: AI Agent Actions';

const esc = (value: string): string => value.replace(/'/g, "''");
const idList = (ids: readonly string[]): string => ids.map((id) => `'${esc(id)}'`).join(', ');

/**
 * Resolves a turn's tools: the grants in force for the audience, the data grants described for the model, the action changes
 * that limit the agent to Collaboration's own action and the granted ones, and the run settings from the agent's grant.
 */
export async function resolveTurnTools(
    provider: IMetadataProvider,
    system: UserInfo,
    configuration: EffectiveSpaceConfiguration,
    audience: ChatAudience,
    targetAgentId: string,
): Promise<ResolvedTurnTools> {
    const tools = turnToolsFor(configuration, audience);
    const rv = RunView.FromMetadataProvider(provider);
    const withheld: string[] = [];
    for (const held of tools.WithheldActions) {
        withheld.push(`action grant ${held.grant.GrantID} binds ${held.boundNames.join(', ')} and waits for A16`);
    }
    for (const view of tools.WithheldViews) {
        withheld.push(`view grant ${view.GrantID} binds a property and waits for A14`);
    }

    const spaceData = await describeDataGrants(rv, system, tools.DataGrants);

    // The agent's own configured actions: anything not granted here is removed for this run, so the agent holds only
    // Collaboration's action and the granted ones (B20, step 2)
    const given = new Set<string>(tools.Actions.map((grant) => grant.TargetRecordID.trim().toUpperCase()));
    if (spaceData.length) given.add(RUN_SPACE_DATA_ACTION_ID);
    const own = await rv.RunView<{ ActionID: string }>({
        EntityName: AGENT_ACTIONS,
        ExtraFilter: `AgentID = '${esc(targetAgentId)}' AND Status = 'Active'`,
        Fields: ['ActionID'],
        ResultType: 'simple',
        MaxRows: 500,
    }, system);
    if (!own.Success) LogError(`resolveTurnTools: the agent's own actions could not be read, so none is removed: ${own.ErrorMessage ?? 'unknown error'}`);
    const ownIds = new Set<string>((own.Results ?? []).map((row) => row.ActionID.trim().toUpperCase()));
    const toRemove = [...ownIds].filter((id) => !given.has(id));
    const toAdd = [...given].filter((id) => !ownIds.has(id));

    const actionChanges: ActionChange[] = [];
    if (toRemove.length) actionChanges.push({ scope: 'root', mode: 'remove', actionIds: toRemove });
    if (toAdd.length) actionChanges.push({ scope: 'root', mode: 'add', actionIds: toAdd });

    const agentGrant = agentGrantFor(configuration, targetAgentId, audience);
    const runSettings = agentRunSettingsFor(agentGrant);
    for (const name of runSettings.closed) withheld.push(`agent grant ${agentGrant?.GrantID ?? ''} sets ${name}, which MJ's run takes no parameter for yet`);
    if (withheld.length) LogStatus(`resolveTurnTools: withheld this turn: ${withheld.join('; ')}`);

    return { tools, spaceData, actionIds: [...given], actionChanges, runSettings, agentGrant, withheld };
}

/** The data grants as the model and the action see them: names, descriptions and the parameters the model may set. */
async function describeDataGrants(rv: RunView, system: UserInfo, grants: readonly EffectiveGrant[]): Promise<TurnSpaceDataGrant[]> {
    if (!grants.length) return [];
    const queryIds = grants.filter((g) => g.Kind === 'Query').map((g) => g.TargetRecordID);
    const viewIds = grants.filter((g) => g.Kind === 'View').map((g) => g.TargetRecordID);
    const names = new Map<string, { Name: string; Description: string | null }>();
    const parameters = new Map<string, string[]>();

    if (queryIds.length) {
        const queries = await rv.RunView<{ ID: string; Name: string; Description: string | null }>({ EntityName: QUERIES, ExtraFilter: `ID IN (${idList(queryIds)})`, Fields: ['ID', 'Name', 'Description'], ResultType: 'simple', MaxRows: 500 }, system);
        if (!queries.Success) throw new Error(`The granted queries could not be read: ${queries.ErrorMessage ?? 'unknown error'}`);
        for (const row of queries.Results ?? []) names.set(row.ID.toUpperCase(), { Name: row.Name, Description: row.Description ?? null });
        const params = await rv.RunView<{ QueryID: string; Name: string }>({ EntityName: QUERY_PARAMETERS, ExtraFilter: `QueryID IN (${idList(queryIds)})`, Fields: ['QueryID', 'Name'], OrderBy: 'Name', ResultType: 'simple', MaxRows: 2000 }, system);
        if (!params.Success) throw new Error(`The granted queries' parameters could not be read: ${params.ErrorMessage ?? 'unknown error'}`);
        for (const row of params.Results ?? []) {
            const list = parameters.get(row.QueryID.toUpperCase()) ?? [];
            list.push(row.Name);
            parameters.set(row.QueryID.toUpperCase(), list);
        }
    }
    if (viewIds.length) {
        const views = await rv.RunView<{ ID: string; Name: string; Description: string | null }>({ EntityName: USER_VIEWS, ExtraFilter: `ID IN (${idList(viewIds)})`, Fields: ['ID', 'Name', 'Description'], ResultType: 'simple', MaxRows: 500 }, system);
        if (!views.Success) throw new Error(`The granted views could not be read: ${views.ErrorMessage ?? 'unknown error'}`);
        for (const row of views.Results ?? []) names.set(row.ID.toUpperCase(), { Name: row.Name, Description: row.Description ?? null });
    }

    const out: TurnSpaceDataGrant[] = [];
    for (const grant of grants) {
        const target = names.get(grant.TargetRecordID.toUpperCase());
        if (!target) {
            // A grant whose target is gone was dropped by the resolver already; one the system user cannot read is left out here too
            LogError(`resolveTurnTools: the target of ${grant.Kind.toLowerCase()} grant ${grant.GrantID} could not be read; it is not offered this turn.`);
            continue;
        }
        const bound = new Set(Object.keys(grant.Bindings ?? {}).map((name) => name.toLowerCase()));
        const own = grant.Kind === 'Query' ? (parameters.get(grant.TargetRecordID.toUpperCase()) ?? []).filter((name) => !bound.has(name.toLowerCase())) : [];
        out.push({ GrantID: grant.GrantID, Kind: grant.Kind as 'Query' | 'View', Name: grant.Label?.trim() || target.Name, Description: target.Description, Parameters: own });
    }
    return out;
}

/** The grant a name points at, for *Run space data*: exact first, then case-insensitive, then by grant id. */
export function findSpaceDataGrant(spaceData: readonly TurnSpaceDataGrant[], name: string): TurnSpaceDataGrant | null {
    const wanted = name.trim();
    return spaceData.find((g) => g.Name === wanted)
        ?? spaceData.find((g) => g.Name.toLowerCase() === wanted.toLowerCase())
        ?? spaceData.find((g) => g.GrantID.toLowerCase() === wanted.toLowerCase())
        ?? null;
}
