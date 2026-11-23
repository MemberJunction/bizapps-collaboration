/**
 * CX-13 Pure Band Isolation Rules for MJ Docs (`MJ: Artifacts` Markdown Document + `SpaceItem`).
 *
 * Team members with `canSeeTeamBand` see Team + Shared docs.
 * Shared-band participants (`canSeeTeamBand === false`) see ONLY Shared docs (zero Team leakage).
 */
import type { Band, MemberSnapshot } from './rules.ts';

export type SpaceDocOperation = 'read' | 'create' | 'update' | 'delete' | 'promote';

export interface SpaceDocAccessInput {
    callerReach: MemberSnapshot | null;
    docBand: Band;
    operation: SpaceDocOperation;
    isAdmin: boolean;
    isSpaceOwner?: boolean;
    spaceReadOnly: boolean;
}

export type SpaceDocAccessVerdict =
    | { allowed: true; effectiveBand: Band }
    | { allowed: false; reason: string };

/** Evaluates whether a caller may perform an operation on a space MJ Doc on `docBand`. */
export function evaluateSpaceDocAccess(input: SpaceDocAccessInput): SpaceDocAccessVerdict {
    if (!input.callerReach && !input.isAdmin) {
        return { allowed: false, reason: 'Access denied: caller does not hold an active seat reaching this space.' };
    }

    const canSeeTeam = input.isAdmin || Boolean(input.callerReach?.role.canSeeTeamBand);
    const canContribute = input.isAdmin || Boolean(input.callerReach?.role.canContribute);
    const canPromote = input.isAdmin || Boolean(input.isSpaceOwner) || Boolean(input.callerReach?.role.canPromoteBand);

    if (input.docBand === 'Team' && !canSeeTeam) {
        return {
            allowed: false,
            reason: 'Access denied: Team-band documents are isolated from Shared-band participants.',
        };
    }

    if (input.operation === 'read') {
        return { allowed: true, effectiveBand: input.docBand };
    }

    if (input.spaceReadOnly) {
        return { allowed: false, reason: 'Document write refused: the space is read-only or closed.' };
    }

    if (!canContribute) {
        return { allowed: false, reason: 'Document write refused: caller role cannot contribute in this space.' };
    }

    if (input.operation === 'promote') {
        if (input.docBand !== 'Team') {
            return { allowed: false, reason: 'Document promotion refused: only Team-band documents can be promoted to Shared.' };
        }
        if (!canPromote) {
            return { allowed: false, reason: 'Document promotion refused: caller role lacks CanPromoteBand authority.' };
        }
        return { allowed: true, effectiveBand: 'Shared' };
    }

    return { allowed: true, effectiveBand: input.docBand };
}

/** Filters a list of space documents to only those visible to the viewer's band clearance. */
export function filterVisibleSpaceDocs<T extends { band: Band }>(
    docs: readonly T[],
    canSeeTeamBand: boolean,
    isAdmin: boolean = false,
): T[] {
    if (isAdmin || canSeeTeamBand) {
        return [...docs];
    }
    return docs.filter((d) => d.band === 'Shared');
}
