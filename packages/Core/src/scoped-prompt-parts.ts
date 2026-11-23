/**
 * Deterministic Scoped Prompt Parts resolution hierarchy (CX-4):
 * traverses `SpaceType -> Root -> Space` with strict scope isolation,
 * override/append merge semantics per logical part Name, deduplication,
 * band safety, and role-faithful message assembly.
 */

import type { Band } from './rules.ts';

export type ScopedPromptPartScopeLevel = 'SpaceType' | 'Root' | 'Space';
export type ScopedPromptPartRole = 'System' | 'User' | 'Assistant';
export type ScopedPromptPartMergeBehavior = 'Override' | 'Append';
export type ScopedPromptPartStatus = 'Active' | 'Provisional' | 'Archived';

export type ScopedPromptSecondaryValue = string | number | boolean;

export interface ScopedPromptPartInput {
    ID?: string | null;
    PromptID?: string | null;
    Name: string;
    Role: ScopedPromptPartRole;
    Text: string;
    Sort: number;
    Priority: number;
    MergeBehavior: ScopedPromptPartMergeBehavior;
    Status: ScopedPromptPartStatus;
    ScopeLevel: ScopedPromptPartScopeLevel;
    /** Exact UUID/ID of the SpaceType, Root Space, or Space this part belongs to. */
    ScopeRecordID: string;
    /** Band restriction; defaults to 'Shared' when omitted. 'Team' parts are excluded in 'Shared' audience runs. */
    Band?: Band | null;
    /** Optional secondary scope constraints that must all match the target run scope. */
    SecondaryScopes?: Record<string, ScopedPromptSecondaryValue> | null;
}

export interface ScopedPromptPartTargetScope {
    spaceTypeId: string;
    rootSpaceId: string;
    spaceId: string;
    promptId?: string | null;
    /** Defaults to 'Shared' (fail closed / least privilege). */
    audience?: Band;
    secondaryScopes?: Record<string, ScopedPromptSecondaryValue> | null;
    /** Optional maximum combined character budget across assembled messages. */
    maxTotalChars?: number;
}

export interface ResolvedScopedPromptPart extends ScopedPromptPartInput {
    /** Numeric hierarchy rank: SpaceType = 1, Root = 2, Space = 3. */
    ScopeRank: 1 | 2 | 3;
}

export interface AssembledPromptMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ScopedPromptResolutionResult {
    parts: readonly ResolvedScopedPromptPart[];
    messages: readonly AssembledPromptMessage[];
    instructions: readonly string[];
    excludedCount: number;
}

const SCOPE_RANK: Record<ScopedPromptPartScopeLevel, 1 | 2 | 3> = {
    SpaceType: 1,
    Root: 2,
    Space: 3,
};

function normId(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function coerceMessageRole(role: ScopedPromptPartRole): 'system' | 'user' | 'assistant' {
    if (role === 'User') return 'user';
    if (role === 'Assistant') return 'assistant';
    return 'system';
}

function matchesTargetScope(part: ScopedPromptPartInput, target: ScopedPromptPartTargetScope): boolean {
    const scopeId = normId(part.ScopeRecordID);
    if (!scopeId) {
        return false;
    }

    if (part.Status !== 'Active' && part.Status !== 'Provisional') {
        return false;
    }

    if (!part.Name.trim() || !part.Text.trim()) {
        return false;
    }

    if (target.promptId && part.PromptID && normId(part.PromptID) !== normId(target.promptId)) {
        return false;
    }

    const audience = target.audience ?? 'Shared';
    if (audience === 'Shared' && part.Band === 'Team') {
        return false;
    }

    if (part.ScopeLevel === 'SpaceType') {
        if (scopeId !== normId(target.spaceTypeId)) return false;
    } else if (part.ScopeLevel === 'Root') {
        if (scopeId !== normId(target.rootSpaceId)) return false;
    } else if (part.ScopeLevel === 'Space') {
        if (scopeId !== normId(target.spaceId)) return false;
    } else {
        return false;
    }

    if (part.SecondaryScopes) {
        for (const [key, expected] of Object.entries(part.SecondaryScopes)) {
            const actual = target.secondaryScopes?.[key];
            if (actual === undefined || String(actual) !== String(expected)) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Resolves scoped prompt parts deterministically along `SpaceType -> Root -> Space`.
 *
 * Isolation & merge rules:
 * - Zero leakage across unrelated `SpaceType`, `Root`, or `Space` records.
 * - `'Team'` band parts never leak into `'Shared'` audience runs.
 * - Within each logical `Name` (case-insensitive), the highest-ranked match
 *   (`Space > Root > SpaceType`, then `Priority DESC`, `Sort ASC`) governs `MergeBehavior`:
 *   - `'Override'` replaces inherited parts of the same `Name`.
 *   - `'Append'` retains all active in-scope parts of the same `Name` ordered
 *     `SpaceType -> Root -> Space`, deduplicating identical `(Role, Text)`.
 * - Final part order is deterministic: `Sort ASC`, `ScopeRank ASC`, `Priority DESC`, `Name ASC`.
 */
export function resolveScopedPromptParts(
    candidates: readonly ScopedPromptPartInput[],
    target: ScopedPromptPartTargetScope,
): ScopedPromptResolutionResult {
    const spaceTypeId = normId(target.spaceTypeId);
    const rootSpaceId = normId(target.rootSpaceId);
    const spaceId = normId(target.spaceId);

    if (!spaceTypeId || !rootSpaceId || !spaceId) {
        return { parts: [], messages: [], instructions: [], excludedCount: candidates.length };
    }

    const inScope: ResolvedScopedPromptPart[] = [];
    let excludedCount = 0;

    for (const candidate of candidates) {
        if (!matchesTargetScope(candidate, target)) {
            excludedCount += 1;
            continue;
        }
        inScope.push({
            ...candidate,
            Name: candidate.Name.trim(),
            Text: candidate.Text.trim(),
            ScopeRank: SCOPE_RANK[candidate.ScopeLevel],
        });
    }

    // Deduplicate identical rows when Root === Space (same SpaceID queried at both levels)
    const dedupedByIdentity = new Map<string, ResolvedScopedPromptPart>();
    for (const part of inScope) {
        const partId = normId(part.ID);
        const identityKey = partId
            ? `id:${partId}:${part.ScopeLevel}`
            : `sig:${part.ScopeLevel}:${normId(part.ScopeRecordID)}:${normId(part.Name)}:${part.Role}:${part.Text}`;
        if (!dedupedByIdentity.has(identityKey)) {
            dedupedByIdentity.set(identityKey, part);
        }
    }

    // If rootSpaceId === spaceId, collapse Root and Space copies of the exact same part ID, keeping Space rank
    const collapsed = new Map<string, ResolvedScopedPromptPart>();
    for (const part of dedupedByIdentity.values()) {
        const partId = normId(part.ID);
        const collapseKey =
            rootSpaceId === spaceId && partId && (part.ScopeLevel === 'Root' || part.ScopeLevel === 'Space')
                ? `same-space-id:${partId}`
                : `${part.ScopeLevel}:${partId || `${normId(part.ScopeRecordID)}:${normId(part.Name)}:${part.Role}:${part.Text}`}`;
        const existing = collapsed.get(collapseKey);
        if (!existing || part.ScopeRank > existing.ScopeRank) {
            collapsed.set(collapseKey, part);
        }
    }

    // Group by logical Name (case-insensitive)
    const byName = new Map<string, ResolvedScopedPromptPart[]>();
    for (const part of collapsed.values()) {
        const key = part.Name.toLowerCase();
        const list = byName.get(key) ?? [];
        list.push(part);
        byName.set(key, list);
    }

    const selected: ResolvedScopedPromptPart[] = [];
    for (const group of byName.values()) {
        group.sort((a, b) =>
            b.ScopeRank - a.ScopeRank ||
            b.Priority - a.Priority ||
            a.Sort - b.Sort ||
            a.Text.localeCompare(b.Text)
        );
        const winner = group[0];
        if (winner.MergeBehavior === 'Append') {
            const orderedAppend = [...group].sort((a, b) =>
                a.ScopeRank - b.ScopeRank ||
                a.Sort - b.Sort ||
                b.Priority - a.Priority ||
                a.Text.localeCompare(b.Text)
            );
            const seenContent = new Set<string>();
            for (const item of orderedAppend) {
                const contentKey = `${item.Role}:${item.Text}`;
                if (!seenContent.has(contentKey)) {
                    seenContent.add(contentKey);
                    selected.push(item);
                }
            }
        } else {
            selected.push(winner);
        }
    }

    selected.sort((a, b) =>
        a.Sort - b.Sort ||
        a.ScopeRank - b.ScopeRank ||
        b.Priority - a.Priority ||
        a.Name.localeCompare(b.Name) ||
        a.Text.localeCompare(b.Text)
    );

    const budget = typeof target.maxTotalChars === 'number' && target.maxTotalChars > 0
        ? Math.floor(target.maxTotalChars)
        : null;

    const includedParts: ResolvedScopedPromptPart[] = [];
    const instructions: string[] = [];
    const messages: AssembledPromptMessage[] = [];
    let totalChars = 0;

    for (const part of selected) {
        if (budget !== null && totalChars + part.Text.length > budget && includedParts.length > 0) {
            break;
        }
        const clippedText =
            budget !== null && totalChars + part.Text.length > budget
                ? part.Text.slice(0, Math.max(0, budget - totalChars))
                : part.Text;
        if (!clippedText.trim()) continue;

        totalChars += clippedText.length;
        includedParts.push({ ...part, Text: clippedText });
        instructions.push(clippedText);

        const role = coerceMessageRole(part.Role);
        const last = messages[messages.length - 1];
        if (last && last.role === role) {
            last.content = `${last.content}\n\n${clippedText}`;
        } else {
            messages.push({ role, content: clippedText });
        }
    }

    return {
        parts: includedParts,
        messages,
        instructions,
        excludedCount,
    };
}
