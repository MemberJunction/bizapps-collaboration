/**
 * Space grants (B15, D27, D30, D31): what the app, a type or a space offers in its spaces, and the pure rules on a grant's
 * bindings and settings. The server's `SpaceGrantEntityServer` reads these; the resolver and the chat's turn read the same
 * shapes. Nothing here touches a database.
 */

/** D27's seven kinds of thing a grant can offer. */
export const GRANT_KINDS = ['Agent', 'Action', 'Query', 'View', 'Dashboard', 'Component', 'KnowledgeSource'] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];

/** The MJ entity each kind's target lives in: a grant's `TargetEntityID` must be this entity's (item 149). */
export const GRANT_KIND_ENTITY: Readonly<Record<GrantKind, string>> = {
    Agent: 'MJ: AI Agents',
    Action: 'MJ: Actions',
    Query: 'MJ: Queries',
    View: 'MJ: User Views',
    Dashboard: 'MJ: Dashboards',
    Component: 'MJ: Components',
    KnowledgeSource: 'MJ: Content Sources',
};

export function isGrantKind(value: unknown): value is GrantKind {
    return typeof value === 'string' && (GRANT_KINDS as readonly string[]).includes(value);
}

/** Where a bound value comes from (D27). A literal is a `Value`; anything else is resolved on the server. */
export type BindingExpression =
    | { From: `Anchor:${string}` | `Space.${string}` | `Config:${string}` | 'User.ID' | 'User.Email' | 'User.PersonID' }
    | { Value: string | number | boolean };

/** A grant's bindings: a parameter or property name of the target, mapped to where its value comes from. */
export type SpaceGrantBindings = Record<string, BindingExpression>;

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

const FROM_PREFIXES = ['Anchor:', 'Space.', 'Config:'] as const;
const FROM_EXACT = ['User.ID', 'User.Email', 'User.PersonID'] as const;

/** Reads one binding expression, or says what is wrong with it. */
export function parseBindingExpression(name: string, raw: unknown): { ok: true; expression: BindingExpression } | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: `Binding "${name}" must be an object with From or Value.` };
    const keys = Object.keys(raw);
    const hasFrom = 'From' in raw;
    const hasValue = 'Value' in raw;
    if (hasFrom === hasValue || keys.length !== 1) return { ok: false, error: `Binding "${name}" must have exactly one of From or Value.` };
    if (hasValue) {
        const value = (raw as { Value: unknown }).Value;
        if (!['string', 'number', 'boolean'].includes(typeof value)) return { ok: false, error: `Binding "${name}": Value must be a string, number or boolean.` };
        return { ok: true, expression: { Value: value as string | number | boolean } };
    }
    const from = (raw as { From: unknown }).From;
    if (typeof from !== 'string' || from.trim() === '') return { ok: false, error: `Binding "${name}": From must be a non-empty string.` };
    const exact = (FROM_EXACT as readonly string[]).includes(from);
    const prefixed = FROM_PREFIXES.some((prefix) => from.startsWith(prefix) && from.length > prefix.length);
    if (!exact && !prefixed) {
        return { ok: false, error: `Binding "${name}": From "${from}" is not Anchor:<role>, Space.<column>, Config:<key>, User.ID, User.Email or User.PersonID.` };
    }
    return { ok: true, expression: { From: from as Extract<BindingExpression, { From: string }>['From'] } };
}

/**
 * Validates a grant's bindings: each key names a real parameter or property of the target (when the caller knows them)
 * and each expression parses. `targetNames` is null when the target's names are not known to the caller, as on the client.
 */
export function validateSpaceGrantBindings(bindings: unknown, targetNames: readonly string[] | null): string[] {
    if (bindings === null || bindings === undefined) return [];
    if (typeof bindings !== 'object' || Array.isArray(bindings)) return ['Bindings must be an object keyed by the target\'s parameter or property names.'];
    const errors: string[] = [];
    const known = targetNames ? new Set(targetNames.map((n) => n.toLowerCase())) : null;
    for (const [name, raw] of Object.entries(bindings as Record<string, unknown>)) {
        if (known && !known.has(name.toLowerCase())) errors.push(`Binding "${name}" names nothing the target has.`);
        const parsed = parseBindingExpression(name, raw);
        if (!parsed.ok) errors.push(parsed.error);
    }
    return errors;
}

/** What the server knows of an agent when it judges a grant's settings against it. */
export interface AgentDefinitionForGrant {
    /** MJ's `AcceptsSkills`: `None`, `All` or `Limited`. */
    AcceptsSkills: 'None' | 'All' | 'Limited' | string | null | undefined;
    /** The agent's active `MJ: AI Agent Skills` rows' skill IDs, read when `AcceptsSkills` is `Limited`. */
    LimitedSkillIds?: readonly string[];
    /** The active skills in the catalog, read when `AcceptsSkills` is `All`. */
    ActiveSkillIds?: readonly string[];
    SupportsPlanMode?: boolean | null;
    /** The agent's own per-run limits; a grant may only lower them. */
    Limits?: Partial<Record<AgentLimitName, number | null>>;
}

const sameId = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Validates an agent grant's settings against the agent's own definition: a setting may narrow, never widen (item 148). */
export function validateAgentGrantSettings(settings: unknown, agent: AgentDefinitionForGrant): string[] {
    if (settings === null || settings === undefined) return [];
    if (typeof settings !== 'object' || Array.isArray(settings)) return ['Settings must be an object.'];
    const s = settings as AgentGrantSettings;
    const errors: string[] = [];

    if (s.Skills !== undefined) {
        const accepts = (agent.AcceptsSkills ?? 'None') as string;
        if (s.Skills !== 'None') {
            if (!Array.isArray(s.Skills) || s.Skills.some((id) => typeof id !== 'string' || id.trim() === '')) {
                errors.push("Settings.Skills must be 'None' or an array of skill IDs.");
            } else if (accepts === 'None') {
                errors.push('Settings.Skills names skills, but the agent accepts none.');
            } else {
                const allowed = accepts === 'Limited' ? (agent.LimitedSkillIds ?? []) : (agent.ActiveSkillIds ?? null);
                if (allowed) {
                    for (const id of s.Skills) if (!allowed.some((a) => sameId(a, id))) errors.push(`Settings.Skills: the agent does not accept skill ${id}.`);
                }
            }
        }
    }

    if (s.PlanMode !== undefined) {
        if (!['Off', 'Allowed', 'Required'].includes(s.PlanMode)) errors.push(`Settings.PlanMode must be Off, Allowed or Required, not ${String(s.PlanMode)}.`);
        else if (s.PlanMode !== 'Off' && !agent.SupportsPlanMode) errors.push('Settings.PlanMode is set, but the agent does not support plan mode.');
    }

    if (s.EffortLevel !== undefined && (typeof s.EffortLevel !== 'number' || !Number.isFinite(s.EffortLevel) || s.EffortLevel < 1 || s.EffortLevel > 100)) {
        errors.push('Settings.EffortLevel must be a number from 1 to 100.');
    }

    if (s.MemoryWrites !== undefined && typeof s.MemoryWrites !== 'boolean') errors.push('Settings.MemoryWrites must be a boolean.');

    if (s.Limits !== undefined) {
        if (!s.Limits || typeof s.Limits !== 'object' || Array.isArray(s.Limits)) errors.push('Settings.Limits must be an object.');
        else {
            for (const [name, value] of Object.entries(s.Limits)) {
                if (!(AGENT_LIMIT_NAMES as readonly string[]).includes(name)) { errors.push(`Settings.Limits.${name} is not one of MJ's per-run limits.`); continue; }
                if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) { errors.push(`Settings.Limits.${name} must be a positive number.`); continue; }
                const own = agent.Limits?.[name as AgentLimitName];
                if (own !== null && own !== undefined && value > own) errors.push(`Settings.Limits.${name} (${value}) is above the agent's own (${own}).`);
            }
        }
    }
    return errors;
}
