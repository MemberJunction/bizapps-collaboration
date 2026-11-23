/**
 * Pure rule-based chat write permission evaluation (CS-3).
 *
 * Evaluates space status, visibility, sealed state (`InheritsMembership`), seat roles,
 * bands (`Team` | `Shared`), chat kind (`General` | `Topic` | `Private` | `Assistant`),
 * and non-loosening write policies (`Contributors` -> `TeamOnly` -> `Owners`).
 *
 * Fail-closed defaults: unrecognized chat kinds, unrecognized policy strings, missing
 * space nodes, non-visible or read-only spaces, or unseated callers are always denied.
 */

import type { ChatWhoCanWrite } from './configuration.ts';
import { idKey, membershipReaches, spaceReach, type MemberSnapshot, type SpaceNode } from './rules.ts';

export type ChatWriteOperation = 'create' | 'update' | 'delete';

export type ChatWriteVerdict =
    | { Decision: 'Allow'; IsOwnerOverride?: boolean; Reason?: string }
    | { Decision: 'Deny'; Reason: string }
    | { Decision: 'Abstain' };

export interface ChatWriteSpaceChatSummary {
    id: string;
    spaceId: string;
    kind: string | null | undefined;
    status: string | null | undefined;
    ownerUserId?: string | null;
}

export interface ChatWriteRuleEvaluationInput {
    callerUserId: string | null | undefined;
    operation: ChatWriteOperation;
    spaceId: string;
    spaceChat: ChatWriteSpaceChatSummary | null;
    /** Target space and its reachable ancestors (stopping at sealed boundaries). */
    spaces: readonly SpaceNode[];
    /** Caller's active seat memberships across `spaces`. */
    memberships: readonly MemberSnapshot[];
    /**
     * Ordered chain of `Chats.WhoCanWrite` policies from broadest/parent level to space level.
     * Evaluated with strict non-loosening semantics; any invalid policy fails closed.
     */
    policyChain?: ReadonlyArray<string | null | undefined>;
    /** Explicit resolved write policy (combined non-loosening with `policyChain` if both supplied). */
    whoCanWritePolicy?: string | null | undefined;
    /** False when the space type's server driver is missing or refused loading. */
    driverValidated?: boolean;
    /** For update/delete: the existing message's author UserID. */
    detailAuthorUserId?: string | null;
    /** For update/delete: the existing message's Role ('User', 'AI', 'Error'). */
    detailRole?: string | null;
    /** True when the server is authoring an AI/Error reply row. */
    isServerAuthoredReply?: boolean;
}

const VALID_CHAT_KINDS = new Set(['General', 'Topic', 'Private', 'Assistant']);

const POLICY_STRICTNESS: Record<ChatWhoCanWrite, number> = {
    Contributors: 0,
    TeamOnly: 1,
    Owners: 2,
};

function parseWhoCanWritePolicy(raw: string | null | undefined): ChatWhoCanWrite | null {
    if (raw === null || raw === undefined) {
        return null;
    }
    const trimmed = raw.trim();
    if (trimmed === 'Contributors' || trimmed === 'TeamOnly' || trimmed === 'Owners') {
        return trimmed;
    }
    return null;
}

/**
 * Resolves a non-loosening `Chats.WhoCanWrite` policy across an inheritance chain.
 * Null/undefined entries inherit; any unrecognized policy literal fails closed.
 * Strictest policy in the chain always wins (`Owners` > `TeamOnly` > `Contributors`).
 */
export function resolveNonLooseningWhoCanWrite(
    policies: ReadonlyArray<string | null | undefined>,
): { ok: true; policy: ChatWhoCanWrite } | { ok: false; reason: string } {
    let effective: ChatWhoCanWrite = 'Contributors';
    for (const raw of policies) {
        if (raw === null || raw === undefined || raw.trim() === '') {
            continue;
        }
        const parsed = parseWhoCanWritePolicy(raw);
        if (!parsed) {
            return {
                ok: false,
                reason: `Unrecognized chat write policy "${raw}"; denying write (fail closed).`,
            };
        }
        if (POLICY_STRICTNESS[parsed] > POLICY_STRICTNESS[effective]) {
            effective = parsed;
        }
    }
    return { ok: true, policy: effective };
}

/**
 * Evaluates whether `callerUserId` is allowed to perform `operation` on a space chat.
 * Never loosens sealed state, band visibility, role contribution flags, or space status.
 */
export function evaluateSpaceChatWriteRules(input: ChatWriteRuleEvaluationInput): ChatWriteVerdict {
    const callerId = idKey(input.callerUserId);
    const spaceId = idKey(input.spaceId);
    if (!callerId || !spaceId) {
        return { Decision: 'Deny', Reason: 'Chat write denied: a signed-in user and valid space ID are required.' };
    }

    if (input.driverValidated === false) {
        return { Decision: 'Deny', Reason: 'Chat write denied: space type driver could not be verified.' };
    }

    const chat = input.spaceChat;
    if (!chat) {
        return { Decision: 'Abstain' };
    }

    if (idKey(chat.spaceId) !== spaceId) {
        return { Decision: 'Deny', Reason: 'Chat write denied: conversation does not belong to the target space.' };
    }

    const chatStatus = (chat.status ?? '').trim();
    if (chatStatus !== 'Active') {
        return { Decision: 'Deny', Reason: `Chat write denied: conversation status "${chatStatus || 'unknown'}" is not Active.` };
    }

    const chatKind = (chat.kind ?? '').trim();
    if (!VALID_CHAT_KINDS.has(chatKind)) {
        return { Decision: 'Deny', Reason: `Chat write denied: unrecognized conversation kind "${chatKind || 'empty'}".` };
    }

    const targetSpace = input.spaces.find((s) => idKey(s.id) === spaceId);
    if (!targetSpace) {
        return { Decision: 'Deny', Reason: 'Chat write denied: target space could not be verified.' };
    }

    const reachStatus = spaceReach(targetSpace);
    if (!reachStatus.Visible) {
        return { Decision: 'Deny', Reason: 'Chat write denied: space is not visible.' };
    }
    if (reachStatus.ReadOnly) {
        return {
            Decision: 'Deny',
            Reason: targetSpace.closedAt
                ? 'Chat write denied: this space is closed and does not accept new writes.'
                : 'Chat write denied: this space is read-only and does not accept new writes.',
        };
    }

    const policyInput: Array<string | null | undefined> = [
        ...(input.policyChain ?? []),
        ...(input.whoCanWritePolicy !== undefined ? [input.whoCanWritePolicy] : []),
    ];
    const policyResolution = resolveNonLooseningWhoCanWrite(policyInput);
    if (!policyResolution.ok) {
        return { Decision: 'Deny', Reason: policyResolution.reason };
    }
    const writePolicy = policyResolution.policy;

    const seat = membershipReaches(input.spaces, input.memberships, callerId, spaceId);
    if (!seat) {
        return { Decision: 'Deny', Reason: 'Chat write denied: caller does not hold an active seat reaching this space.' };
    }

    if (!seat.role.canContribute) {
        return { Decision: 'Deny', Reason: 'Chat write denied: your role on this space cannot post messages.' };
    }

    if (chatKind === 'Private' && (!seat.role.canSeeTeamBand || seat.band !== 'Team')) {
        return { Decision: 'Deny', Reason: 'Chat write denied: internal conversations require Team band visibility.' };
    }

    if (chatKind === 'Assistant' && idKey(chat.ownerUserId) !== callerId) {
        return { Decision: 'Deny', Reason: "Chat write denied: cannot write to another member's assistant conversation." };
    }

    if (writePolicy === 'Owners' && !seat.role.isOwnerRole) {
        return { Decision: 'Deny', Reason: 'Chat write denied: space rules restrict writes in this space to owners.' };
    }

    if (writePolicy === 'TeamOnly' && (!seat.role.canSeeTeamBand || seat.band !== 'Team')) {
        return { Decision: 'Deny', Reason: 'Chat write denied: space rules restrict writes in this space to Team-band seats.' };
    }

    if ((input.operation === 'update' || input.operation === 'delete') && !input.isServerAuthoredReply) {
        const detailRole = (input.detailRole ?? 'User').trim().toLowerCase();
        if (detailRole !== 'user') {
            if (!seat.role.isOwnerRole) {
                return { Decision: 'Deny', Reason: 'Chat write denied: only space owners can modify or remove non-user messages.' };
            }
        } else if (input.detailAuthorUserId && idKey(input.detailAuthorUserId) !== callerId && !seat.role.isOwnerRole) {
            return { Decision: 'Deny', Reason: 'Chat write denied: only the message author or a space owner can modify or delete this message.' };
        }
    }

    return {
        Decision: 'Allow',
        IsOwnerOverride: seat.role.isOwnerRole,
        Reason: `Authorized by ${writePolicy} chat write rule on ${chatKind} space chat.`,
    };
}
