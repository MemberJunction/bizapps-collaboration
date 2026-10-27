/**
 * What an agent turn may use in a space (B20, D30, D31): the grants in force for the conversation's audience, cut to tools.
 * Pure: the server loads the configuration and reads the targets; this decides. The rules:
 * - a General or Topic conversation is everyone who reaches the space, so only Shared grants are in force; an Internal Only
 *   conversation seats Team, so Team grants are too (#8's plan § 8.1);
 * - an action grant with a binding is not given to an agent before A16 (D36): the model would be asked for a value the server
 *   must fix. It is withheld, with its bound names, for the log;
 * - granted queries and unbound views are what *Run space data* may run (B17); a view with a binding waits for A14;
 * - a dashboard or a component is never a tool (row 19);
 * - knowledge sources are the Content Sources granted.
 */
import type { EffectiveGrant, EffectiveSpaceConfiguration } from './effective-configuration.js';
import type { AgentGrantSettings } from './grants.js';

/** Who a conversation seats: everyone who reaches the space (Shared) or those who see Team. */
export type ChatAudience = 'Shared' | 'Team';

export interface WithheldAction {
    grant: EffectiveGrant;
    /** The parameter names the grant binds, which is why it is withheld before A16. */
    boundNames: string[];
}

export interface TurnTools {
    Audience: ChatAudience;
    /** The action grants given to the agent: in force for the audience, with no binding. */
    Actions: EffectiveGrant[];
    /** The action grants in force but withheld because they bind a parameter (A16). */
    WithheldActions: WithheldAction[];
    /** The query and view grants *Run space data* may run for this audience. */
    DataGrants: EffectiveGrant[];
    /** The view grants in force but not runnable before A14 (they bind a property). */
    WithheldViews: EffectiveGrant[];
    /** The Content Source ids granted for this audience, in configuration order, each once. */
    KnowledgeSourceIDs: string[];
}

const inForce = (grants: readonly EffectiveGrant[], audience: ChatAudience): EffectiveGrant[] =>
    grants.filter((grant) => audience === 'Team' || grant.Band === 'Shared');

const boundNamesOf = (grant: EffectiveGrant): string[] => Object.keys(grant.Bindings ?? {});

/** The tools of a turn, from the one configuration and the conversation's audience. */
export function turnToolsFor(configuration: EffectiveSpaceConfiguration, audience: ChatAudience): TurnTools {
    const actions = inForce(configuration.Grants.Action, audience);
    const views = inForce(configuration.Grants.View, audience);
    const knowledge: string[] = [];
    for (const grant of inForce(configuration.Grants.KnowledgeSource, audience)) {
        const id = grant.TargetRecordID.trim().toUpperCase();
        if (id && !knowledge.includes(id)) knowledge.push(id);
    }
    return {
        Audience: audience,
        Actions: actions.filter((grant) => boundNamesOf(grant).length === 0),
        WithheldActions: actions.filter((grant) => boundNamesOf(grant).length > 0).map((grant) => ({ grant, boundNames: boundNamesOf(grant) })),
        DataGrants: [...inForce(configuration.Grants.Query, audience), ...views.filter((grant) => boundNamesOf(grant).length === 0)],
        WithheldViews: views.filter((grant) => boundNamesOf(grant).length > 0),
        KnowledgeSourceIDs: knowledge,
    };
}

/** The audience of a conversation from its kind: Internal Only (`Private`) seats Team, the rest seat everyone. */
export function audienceOfConversationKind(kind: string | null | undefined): ChatAudience {
    return (kind ?? '').trim().toLowerCase() === 'private' ? 'Team' : 'Shared';
}

/** The agent grant a turn runs under: the nearest level's grant for that agent among those in force, or null for the stand-in. */
export function agentGrantFor(configuration: EffectiveSpaceConfiguration, agentId: string, audience: ChatAudience): EffectiveGrant | null {
    const wanted = agentId.trim().toUpperCase();
    const matching = inForce(configuration.Grants.Agent, audience).filter((grant) => grant.TargetRecordID.trim().toUpperCase() === wanted);
    // Inherited first, each level after: the last match is the nearest level's
    return matching.length ? matching[matching.length - 1] : null;
}

/** What the agent grant's settings set on the run, and what they cannot set yet. */
export interface AgentRunSettings {
    /** Required forces a plan; Off forbids one; Allowed leaves it to the agent. */
    planMode?: boolean;
    effortLevel?: number;
    /** The skills the grant names; none when it says 'None' or names none. */
    requestedSkillIDs: string[];
    /** MaxIterationsPerRun, as the run's hard cap. */
    absoluteMaxIterations?: number;
    /** MaxTimePerRun, in seconds on the grant, as the run's limit in milliseconds. */
    maxExecutionTimeMs?: number;
    /** Settings the grant carries that MJ's run takes no parameter for yet, named for the log and the push note. */
    closed: string[];
}

/** Maps an agent grant's settings (D31) onto MJ's run parameters; a null grant gives the agent's own defaults. */
export function agentRunSettingsFor(grant: Pick<EffectiveGrant, 'Settings'> | null | undefined): AgentRunSettings {
    const settings: AgentGrantSettings | null = grant?.Settings ?? null;
    const out: AgentRunSettings = { requestedSkillIDs: [], closed: [] };
    if (!settings) return out;
    if (settings.PlanMode === 'Required') out.planMode = true;
    else if (settings.PlanMode === 'Off') out.planMode = false;
    if (typeof settings.EffortLevel === 'number' && Number.isFinite(settings.EffortLevel)) out.effortLevel = settings.EffortLevel;
    if (Array.isArray(settings.Skills)) {
        for (const id of settings.Skills) {
            const clean = typeof id === 'string' ? id.trim().toUpperCase() : '';
            if (clean && !out.requestedSkillIDs.includes(clean)) out.requestedSkillIDs.push(clean);
        }
    }
    const limits = settings.Limits ?? {};
    if (typeof limits.MaxIterationsPerRun === 'number' && limits.MaxIterationsPerRun > 0) out.absoluteMaxIterations = Math.floor(limits.MaxIterationsPerRun);
    if (typeof limits.MaxTimePerRun === 'number' && limits.MaxTimePerRun > 0) out.maxExecutionTimeMs = Math.floor(limits.MaxTimePerRun * 1000);
    if (typeof limits.MaxCostPerRun === 'number') out.closed.push('Limits.MaxCostPerRun');
    if (typeof limits.MaxTokensPerRun === 'number') out.closed.push('Limits.MaxTokensPerRun');
    if (typeof settings.MemoryWrites === 'boolean') out.closed.push('MemoryWrites');
    return out;
}
