/**
 * An agent grant's settings (MJ_BizApps_Collaboration: Space Grants.Settings): each may only narrow the agent's own definition
 * (D31, item 148). The source of truth is packages/Core/src/grants.ts; this copy is what CodeGen reads.
 */

/** An agent grant's settings (D31). Each can only narrow what the agent's own definition allows (item 148). */
export interface AgentGrantSettings {
    /** The skills this space's chats may use: none, or skills the agent accepts. Absent means the agent's own. */
    Skills?: 'None' | string[];
    /** Off, allowed or required; only where the agent sets SupportsPlanMode. */
    PlanMode?: 'Off' | 'Allowed' | 'Required';
    EffortLevel?: number;
    /** Whether the agent may write memory notes in this space. */
    MemoryWrites?: boolean;
    /** Per-run limits, each at most the agent's own, named as MJ's agent columns are. */
    Limits?: Partial<Record<AgentLimitName, number>>;
}

export const AGENT_LIMIT_NAMES = ['MaxCostPerRun', 'MaxTokensPerRun', 'MaxIterationsPerRun', 'MaxTimePerRun'] as const;
export type AgentLimitName = (typeof AGENT_LIMIT_NAMES)[number];
