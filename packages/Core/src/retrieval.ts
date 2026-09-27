/**
 * Retrieval rules by audience for Collaboration agents and chats.
 * Pure TypeScript — no Angular, no SQL, importable from any environment.
 * Follows plans/plan.md B2 and EXTENSIBILITY_PLAN.md § 8.
 */

import type { Band, SpaceNode } from './rules.js';

export type RetrievalMode = 'Private' | 'Shared' | 'Caller' | 'Intersection' | 'Union';

export type ScopeNarrowing = 'ThisSpace' | 'ThisSpaceAndSubspaces' | 'Everything';

export interface PrincipalReach {
    userId: string;
    /** Spaces that this user's active seats reach */
    reachableSpaceIds: string[];
    /** Subset of reachable spaces where this user can see Team-band materials */
    canSeeTeamSpaceIds: string[];
    /** Whether this principal belongs to the host organization */
    isInternalOrg?: boolean;
}

export interface EffectiveRetrievalScopeInput {
    audience: {
        /** User IDs of the conversation participants */
        principals: string[];
        /** Mode: Private (Caller's reach) or Shared (Intersection of participants) */
        mode?: RetrievalMode;
        /** Optional anchor space where the query was initiated */
        anchorSpaceId?: string | null;
        /** Narrowing: ThisSpace, ThisSpaceAndSubspaces, or Everything */
        narrowing?: ScopeNarrowing;
        /** Whether the audience includes an unmapped / unknown principal (e.g. external channel guest) */
        hasUnmappedPrincipal?: boolean;
    };
    spaces: readonly SpaceNode[];
    principalReaches: readonly PrincipalReach[];
}

export interface EffectiveRetrievalScopeResult {
    allowedSpaceIds: string[];
    /** Default allowed band across all allowed spaces ('Team' or 'Shared') */
    allowedBand: Band;
    /** Per-space effective allowed band ('Team' if all participants can see Team; 'Shared' otherwise) */
    spaceBands: Map<string, Band>;
    /** Whether all audience principals belong to the internal organization */
    allInternalOrg: boolean;
}

function normalizeId(id: string): string {
    return id.trim().toLowerCase();
}

function buildDescendantSet(spaces: readonly SpaceNode[], anchorSpaceId: string): Set<string> {
    const parentMap = new Map<string, string[]>();
    for (const s of spaces) {
        if (s.parentId) {
            const p = normalizeId(s.parentId);
            const list = parentMap.get(p) ?? [];
            list.push(normalizeId(s.id));
            parentMap.set(p, list);
        }
    }

    const descendants = new Set<string>();
    const stack = [normalizeId(anchorSpaceId)];
    while (stack.length > 0) {
        const cur = stack.pop()!;
        descendants.add(cur);
        const children = parentMap.get(cur);
        if (children) {
            for (const c of children) {
                if (!descendants.has(c)) {
                    stack.push(c);
                }
            }
        }
    }
    return descendants;
}

/**
 * Computes the effective retrieval scope for an agent turn based on the conversation's audience.
 *
 * Rules:
 * 1. If audience includes an unmapped principal (e.g. unknown member in Teams/Slack):
 *    No space material is reachable (returns empty allowedSpaceIds).
 * 2. Private chat (mode 'Private' | 'Caller' | 'Union', or 1 principal):
 *    Uses caller's union of reachable spaces.
 * 3. Shared chat (mode 'Shared' | 'Intersection', or >1 principals):
 *    Uses intersection of what every listed principal can read.
 * 4. Narrowing:
 *    - 'ThisSpace': strictly the anchor space (if in allowed spaces).
 *    - 'ThisSpaceAndSubspaces': anchor space and its descendants (default when anchor is set).
 *    - 'Everything': all allowed spaces (default when no anchor).
 * 5. Effective Band:
 *    For each allowed space, if EVERY principal in the audience can see Team band in that space,
 *    its effective band is 'Team'. If ANY principal cannot see Team, the band is 'Shared'.
 * 6. Space AgentRetrieval settings:
 *    - 'ExcludedEntirely': omitted from allowed spaces.
 *    - 'ExcludedFromParentScope': omitted if queried from an ancestor space (not the space itself).
 */
export function effectiveRetrievalScope(input: EffectiveRetrievalScopeInput): EffectiveRetrievalScopeResult {
    const { audience, spaces, principalReaches } = input;
    const spaceMap = new Map<string, SpaceNode>();
    for (const s of spaces) {
        spaceMap.set(normalizeId(s.id), s);
    }

    const reachMap = new Map<string, PrincipalReach>();
    for (const r of principalReaches) {
        reachMap.set(normalizeId(r.userId), r);
    }

    const emptyResult: EffectiveRetrievalScopeResult = {
        allowedSpaceIds: [],
        allowedBand: 'Shared',
        spaceBands: new Map(),
        allInternalOrg: false,
    };

    // Rule 1: If there is an unmapped principal, no space material is accessible
    if (audience.hasUnmappedPrincipal || audience.principals.length === 0) {
        return emptyResult;
    }

    const principalIds = audience.principals.map(normalizeId);
    const validPrincipals: PrincipalReach[] = [];
    for (const pid of principalIds) {
        const reach = reachMap.get(pid);
        if (!reach) {
            // Unregistered / unmapped principal in audience
            return emptyResult;
        }
        validPrincipals.push(reach);
    }

    const allInternalOrg = validPrincipals.every((p) => p.isInternalOrg === true);

    const isPrivate =
        audience.mode === 'Private' ||
        audience.mode === 'Caller' ||
        audience.mode === 'Union' ||
        (audience.mode === undefined && validPrincipals.length === 1);

    let candidateSpaceIds: Set<string>;

    if (isPrivate) {
        // Caller's union
        const caller = validPrincipals[0];
        candidateSpaceIds = new Set(caller.reachableSpaceIds.map(normalizeId));
    } else {
        // Intersection across all principals
        const [first, ...rest] = validPrincipals;
        candidateSpaceIds = new Set(first.reachableSpaceIds.map(normalizeId));
        for (const p of rest) {
            const pSpaces = new Set(p.reachableSpaceIds.map(normalizeId));
            for (const spId of candidateSpaceIds) {
                if (!pSpaces.has(spId)) {
                    candidateSpaceIds.delete(spId);
                }
            }
        }
    }

    // Apply narrowing
    const anchorId = audience.anchorSpaceId ? normalizeId(audience.anchorSpaceId) : null;
    const narrowing = audience.narrowing ?? (anchorId ? 'ThisSpaceAndSubspaces' : 'Everything');

    if (narrowing === 'ThisSpace') {
        if (!anchorId || !candidateSpaceIds.has(anchorId)) {
            return {
                allowedSpaceIds: [],
                allowedBand: 'Shared',
                spaceBands: new Map(),
                allInternalOrg,
            };
        }
        candidateSpaceIds = new Set([anchorId]);
    } else if (narrowing === 'ThisSpaceAndSubspaces' && anchorId) {
        const subtree = buildDescendantSet(spaces, anchorId);
        const narrowed = new Set<string>();
        for (const spId of candidateSpaceIds) {
            if (subtree.has(spId)) {
                narrowed.add(spId);
            }
        }
        candidateSpaceIds = narrowed;
    }

    // Apply AgentRetrieval constraints and determine effective bands
    const allowedSpaceIds: string[] = [];
    const spaceBands = new Map<string, Band>();

    for (const spId of candidateSpaceIds) {
        const spaceNode = spaceMap.get(spId);
        if (!spaceNode) {
            continue;
        }

        // Excluded entirely
        if (spaceNode.agentRetrieval === 'ExcludedEntirely') {
            continue;
        }

        // Excluded from parent scope (when queried from an ancestor, not the space itself)
        if (spaceNode.agentRetrieval === 'ExcludedFromParentScope' && anchorId && anchorId !== spId) {
            continue;
        }

        // Determine effective band for this space:
        // 'Team' only if EVERY principal in the audience can see Team in this space
        const everyoneCanSeeTeam = validPrincipals.every((p) =>
            p.canSeeTeamSpaceIds.some((id) => normalizeId(id) === spId)
        );

        const effectiveBand: Band = everyoneCanSeeTeam ? 'Team' : 'Shared';
        spaceBands.set(spId, effectiveBand);
        allowedSpaceIds.push(spId);
    }

    // Overall allowedBand: 'Team' only if all allowed spaces have 'Team' band
    const overallBand: Band =
        allowedSpaceIds.length > 0 &&
        allowedSpaceIds.every((id) => spaceBands.get(id) === 'Team')
            ? 'Team'
            : 'Shared';

    return {
        allowedSpaceIds,
        allowedBand: overallBand,
        spaceBands,
        allInternalOrg,
    };
}

// ============================================================================
// Agent May Quote Decision
// ============================================================================

export interface AgentCandidateItem {
    id: string;
    spaceId: string;
    band: Band;
    title?: string;
    classification?: 'Public' | 'Organization' | 'Restricted';
}

export interface AgentMayQuoteResult {
    allowed: boolean;
    reason?: string;
}

/**
 * Validates whether a candidate item or document can be quoted by the agent to the given audience.
 * Every refusal returns an explicit, audit-recordable reason.
 */
export function agentMayQuoteCandidate(
    item: AgentCandidateItem,
    scope: EffectiveRetrievalScopeResult
): AgentMayQuoteResult {
    // 1. Classification check
    if (item.classification === 'Public') {
        return { allowed: true };
    }

    if (item.classification === 'Organization' && !scope.allInternalOrg) {
        return {
            allowed: false,
            reason: 'Organization-restricted knowledge cannot be quoted to an audience containing external participants.',
        };
    }

    // 2. Space accessibility check
    const normSpaceId = normalizeId(item.spaceId);
    if (!scope.allowedSpaceIds.includes(normSpaceId)) {
        return {
            allowed: false,
            reason: `Space '${item.spaceId}' is not within the effective retrieval scope for this audience.`,
        };
    }

    // 3. Band check
    const allowedBand = scope.spaceBands.get(normSpaceId);
    if (item.band === 'Team' && allowedBand !== 'Team') {
        return {
            allowed: false,
            reason: `Team-band material in space '${item.spaceId}' cannot be quoted to an audience with Shared-only participants.`,
        };
    }

    return { allowed: true };
}
