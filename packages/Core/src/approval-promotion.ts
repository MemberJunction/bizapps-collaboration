/**
 * CA-2, CA-3 & CA-4 Pure Approval Promotion Rules:
 * - Team-band privacy on draft approval tasks and linked draft payloads (CA-3).
 * - Standing TaskDecision & promote-authority gating before promoting Team drafts to Shared (CA-2).
 * - Per-root delivery principal requirement without silent fallback to caller identity (CA-4).
 */
import type { Band, MemberSnapshot } from './rules.ts';

export type ApprovalTaskStatus = 'Open' | 'InProgress' | 'Completed' | 'Cancelled' | 'Blocked';

export interface DraftVisibilityDecision {
    allowed: boolean;
    reason: string;
}

export interface ApprovalPromotionGateInput {
    callerUserId: string | null | undefined;
    callerReach: MemberSnapshot | null;
    isAdmin: boolean;
    isSpaceOwner: boolean;
    spaceReadOnly: boolean;
    itemBand: Band;
    taskStatus: ApprovalTaskStatus | string;
    hasApprovingDecision: boolean;
    hasRejectionDecision: boolean;
    deliveryPrincipalUserId: string | null | undefined;
}

export type ApprovalPromotionGateVerdict =
    | { ok: true; deliveryPrincipalUserId: string }
    | { ok: false; code: 'UNAUTHORIZED' | 'PRIVACY_DENIED' | 'READ_ONLY' | 'INVALID_STATE' | 'MISSING_DECISION' | 'MISSING_PRINCIPAL'; message: string };

/**
 * Evaluates Team-band privacy for reading or enumerating a draft approval task or linked draft payload (CA-3).
 * Shared-band participants and non-Team callers are strictly denied access to Team-band draft approval tasks.
 */
export function evaluateDraftApprovalTaskVisibility(input: {
    callerReach: MemberSnapshot | null;
    itemBand: Band;
    isAdmin: boolean;
}): DraftVisibilityDecision {
    if (input.isAdmin) {
        return { allowed: true, reason: 'Caller holds space administration authorization.' };
    }
    if (!input.callerReach) {
        return { allowed: false, reason: 'Access denied: caller does not hold an active seat reaching this space.' };
    }
    if (input.itemBand === 'Team' && !input.callerReach.role.canSeeTeamBand) {
        return {
            allowed: false,
            reason: 'Access denied: Team-band draft approval tasks and draft payloads are private to Team members prior to promotion.',
        };
    }
    return { allowed: true, reason: `Caller reach permits ${input.itemBand}-band visibility.` };
}

/**
 * Evaluates all pre-promotion invariants for CA-2, CA-3, and CA-4 before promoting a Team-band draft to Shared.
 */
export function evaluateApprovalPromotionGate(input: ApprovalPromotionGateInput): ApprovalPromotionGateVerdict {
    if (!input.callerUserId || !input.callerUserId.trim()) {
        return { ok: false, code: 'UNAUTHORIZED', message: 'Promotion refused: signed-in caller is required.' };
    }
    if (input.spaceReadOnly) {
        return { ok: false, code: 'READ_ONLY', message: 'Promotion refused: space is read-only or closed.' };
    }
    if (!input.callerReach && !input.isAdmin) {
        return { ok: false, code: 'PRIVACY_DENIED', message: 'Promotion refused: caller does not reach this space.' };
    }
    if (!input.isAdmin && input.itemBand === 'Team' && !input.callerReach?.role.canSeeTeamBand) {
        return {
            ok: false,
            code: 'PRIVACY_DENIED',
            message: 'Promotion refused: Shared-band participants cannot access or promote Team-band draft approval tasks.',
        };
    }
    const hasPromoteRight = input.isAdmin || input.isSpaceOwner || Boolean(input.callerReach?.role.canPromoteBand);
    if (!hasPromoteRight) {
        return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Promotion refused: caller lacks CanPromoteBand or owner authority to promote drafts to Shared.',
        };
    }
    if (input.itemBand !== 'Team') {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message: 'Promotion refused: draft item is not on the Team band.',
        };
    }
    if (input.taskStatus === 'Cancelled' || input.hasRejectionDecision) {
        return {
            ok: false,
            code: 'INVALID_STATE',
            message: 'Promotion refused: approval task was rejected or cancelled; draft remains private on Team band.',
        };
    }
    if (!input.hasApprovingDecision) {
        return {
            ok: false,
            code: 'MISSING_DECISION',
            message: 'Promotion refused: approval requires a standing approving TaskDecision before promoting to Shared.',
        };
    }
    const principal = input.deliveryPrincipalUserId?.trim();
    if (!principal) {
        return {
            ok: false,
            code: 'MISSING_PRINCIPAL',
            message: 'Promotion refused: per-root delivery principal is not configured; cannot fall back to approver personal identity.',
        };
    }
    return { ok: true, deliveryPrincipalUserId: principal };
}
