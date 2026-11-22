/**
 * Pure domain rules and validators for space agent source receipts (CT-2).
 *
 * Enforces fail-closed (space, band) audience validation on every supplied candidate
 * and cited source before receipts can be persisted or returned to callers.
 */

export type SourceReceiptKind = 'SpaceItem' | 'KnowledgeSource';
export type SourceReceiptBand = 'Shared' | 'Team';
export type SourceReceiptRankingMode = 'vector' | 'lexical' | 'grant' | 'none';

export interface ValidatedSuppliedSourceCandidate {
    sourceKind: SourceReceiptKind;
    spaceId: string;
    spaceItemId: string | null;
    contentSourceId: string | null;
    targetEntityId: string | null;
    targetRecordId: string | null;
    sourceTitle: string;
    band: SourceReceiptBand;
    retrievalRank: number | null;
    relevanceScore: number | null;
    rankingMode: SourceReceiptRankingMode;
    estimatedTokens: number;
    wasTruncated: boolean;
}

export interface SpaceAgentSourceReceiptEntry {
    sourceKind: SourceReceiptKind;
    spaceId: string;
    spaceItemId: string | null;
    contentSourceId: string | null;
    targetEntityId: string | null;
    targetRecordId: string | null;
    sourceTitle: string;
    band: SourceReceiptBand;
    wasSupplied: boolean;
    wasCited: boolean;
    retrievalRank: number | null;
    relevanceScore: number | null;
    rankingMode: SourceReceiptRankingMode;
    citationOrdinal: number | null;
    estimatedTokens: number;
    wasTruncated: boolean;
    sequence: number;
}

export interface RejectedSourceCitation {
    rawMarker: string;
    reason: string;
}

export interface SourceReceiptReachContext {
    /** Audience ceiling for the chat: General/Topic/non-Team Assistant chats are strictly Shared. */
    chatAudience: SourceReceiptBand;
    /** Lowercase SpaceID -> allowed visibility bands in reach for this turn/caller. */
    inReachSpaceBands: ReadonlyMap<string, ReadonlySet<SourceReceiptBand>>;
}

export interface ExtractAndValidateSourceReceiptsResult {
    receipts: SpaceAgentSourceReceiptEntry[];
    rejectedCandidates: RejectedSourceCitation[];
    rejectedCitations: RejectedSourceCitation[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE_MARKER_REGEX = /\[(?:source|cite)\s*:\s*([^\]\s]+)\s*\]/gi;

export function normalizeReceiptUuid(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().toLowerCase();
    return UUID_REGEX.test(trimmed) ? trimmed : null;
}

/**
 * Normalizes any non-empty record identifier (UUID or synthetic mock ID) for canonical lookups.
 */
export function normalizeReceiptId(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
}

export function stripRecordKeyPrefix(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    return trimmed.startsWith('ID|') ? trimmed.slice(3).trim() : trimmed;
}

export function isSourceReceiptKind(value: string): value is SourceReceiptKind {
    return value === 'SpaceItem' || value === 'KnowledgeSource';
}

export function isSourceReceiptBand(value: string): value is SourceReceiptBand {
    return value === 'Shared' || value === 'Team';
}

export function isSourceReceiptRankingMode(value: string): value is SourceReceiptRankingMode {
    return value === 'vector' || value === 'lexical' || value === 'grant' || value === 'none';
}

/**
 * Fail-closed reach predicate: a receipt row is visible/persistable ONLY if:
 * 1. Its SpaceID is present in `inReachSpaceBands`,
 * 2. Its Band is permitted for that space, and
 * 3. When `chatAudience === 'Shared'`, its Band is strictly `'Shared'`.
 */
export function canReaderAccessSourceReceipt(
    receipt: { spaceId: string; band: SourceReceiptBand },
    reach: SourceReceiptReachContext,
): boolean {
    const normalizedSpaceId = normalizeReceiptUuid(receipt.spaceId);
    if (!normalizedSpaceId) {
        return false;
    }
    if (reach.chatAudience === 'Shared' && receipt.band !== 'Shared') {
        return false;
    }
    const allowedBands = reach.inReachSpaceBands.get(normalizedSpaceId);
    if (!allowedBands) {
        return false;
    }
    return allowedBands.has(receipt.band);
}

function candidateIdentityKey(candidate: ValidatedSuppliedSourceCandidate): string | null {
    if (candidate.sourceKind === 'SpaceItem') {
        const id = normalizeReceiptUuid(candidate.spaceItemId);
        return id ? `SpaceItem:${id}` : null;
    }
    const id = normalizeReceiptUuid(candidate.contentSourceId);
    return id ? `KnowledgeSource:${id}` : null;
}

function validateCandidateShape(candidate: ValidatedSuppliedSourceCandidate): string | null {
    if (!isSourceReceiptKind(candidate.sourceKind)) {
        return 'Invalid SourceKind';
    }
    if (!isSourceReceiptBand(candidate.band)) {
        return 'Invalid Band';
    }
    if (!normalizeReceiptUuid(candidate.spaceId)) {
        return 'Invalid SpaceID';
    }
    if (candidate.sourceKind === 'SpaceItem') {
        if (!normalizeReceiptUuid(candidate.spaceItemId) || candidate.contentSourceId !== null) {
            return 'SpaceItem receipt requires SpaceItemID and null ContentSourceID';
        }
    } else {
        if (!normalizeReceiptUuid(candidate.contentSourceId) || candidate.spaceItemId !== null) {
            return 'KnowledgeSource receipt requires ContentSourceID and null SpaceItemID';
        }
    }
    if (candidate.sourceTitle.trim().length === 0) {
        return 'SourceTitle cannot be empty';
    }
    return null;
}

function isWordBoundaryChar(ch: string | undefined): boolean {
    if (!ch) return true;
    return !/[0-9a-zA-Z_]/.test(ch);
}

function findTitleFirstOffset(replyLower: string, title: string): number {
    const clean = title.trim().toLowerCase();
    if (clean.length < 3) {
        return -1;
    }
    let searchFrom = 0;
    while (searchFrom <= replyLower.length - clean.length) {
        const idx = replyLower.indexOf(clean, searchFrom);
        if (idx === -1) {
            return -1;
        }
        const before = idx > 0 ? replyLower[idx - 1] : undefined;
        const after = idx + clean.length < replyLower.length ? replyLower[idx + clean.length] : undefined;
        if (isWordBoundaryChar(before) && isWordBoundaryChar(after)) {
            return idx;
        }
        searchFrom = idx + 1;
    }
    return -1;
}

/**
 * Validates every supplied candidate against the turn's fail-closed `(space, band)` reach,
 * detects which validated supplied sources were cited in `replyText`, assigns deterministic
 * 1-based `citationOrdinal` and `sequence` values, and rejects any unverified/out-of-scope
 * candidates or citation markers without ever admitting them into `receipts`.
 */
export function extractAndValidateSourceReceipts(
    candidates: readonly ValidatedSuppliedSourceCandidate[],
    replyText: string,
    reach: SourceReceiptReachContext,
): ExtractAndValidateSourceReceiptsResult {
    const validated: ValidatedSuppliedSourceCandidate[] = [];
    const seenKeys = new Set<string>();
    const rejectedCandidates: RejectedSourceCitation[] = [];

    for (const candidate of candidates) {
        const shapeError = validateCandidateShape(candidate);
        if (shapeError) {
            rejectedCandidates.push({
                rawMarker: candidate.spaceItemId ?? candidate.contentSourceId ?? candidate.sourceTitle,
                reason: shapeError,
            });
            continue;
        }

        const spaceId = normalizeReceiptUuid(candidate.spaceId)!;
        if (!canReaderAccessSourceReceipt({ spaceId, band: candidate.band }, reach)) {
            rejectedCandidates.push({
                rawMarker: candidate.spaceItemId ?? candidate.contentSourceId ?? candidate.sourceTitle,
                reason: `Candidate source in space ${spaceId} band ${candidate.band} is outside chat reach (${reach.chatAudience})`,
            });
            continue;
        }

        const key = candidateIdentityKey(candidate);
        if (!key || seenKeys.has(key)) {
            continue;
        }
        seenKeys.add(key);

        validated.push({
            ...candidate,
            spaceId,
            spaceItemId: normalizeReceiptUuid(candidate.spaceItemId),
            contentSourceId: normalizeReceiptUuid(candidate.contentSourceId),
            targetEntityId: normalizeReceiptUuid(candidate.targetEntityId),
            targetRecordId: candidate.targetRecordId?.trim() || null,
            sourceTitle: candidate.sourceTitle.trim().slice(0, 500),
            rankingMode: isSourceReceiptRankingMode(candidate.rankingMode) ? candidate.rankingMode : 'none',
            retrievalRank: candidate.retrievalRank != null && candidate.retrievalRank >= 1 ? Math.trunc(candidate.retrievalRank) : null,
            relevanceScore: candidate.relevanceScore != null && Number.isFinite(candidate.relevanceScore)
                ? Number(candidate.relevanceScore.toFixed(6))
                : null,
            estimatedTokens: Math.max(0, Math.trunc(candidate.estimatedTokens)),
        });
    }

    // Build lookup indexes strictly over in-reach validated candidates
    const keyByLookupToken = new Map<string, string>();
    const firstMentionOffsetByKey = new Map<string, number>();

    for (const item of validated) {
        const key = candidateIdentityKey(item)!;
        if (item.spaceItemId) {
            keyByLookupToken.set(item.spaceItemId, key);
        }
        if (item.contentSourceId) {
            keyByLookupToken.set(item.contentSourceId, key);
        }
        const strippedTargetId = stripRecordKeyPrefix(item.targetRecordId);
        if (strippedTargetId) {
            const lowerTarget = strippedTargetId.toLowerCase();
            if (!keyByLookupToken.has(lowerTarget)) {
                keyByLookupToken.set(lowerTarget, key);
            }
        }
    }

    const rejectedCitations: RejectedSourceCitation[] = [];
    const safeReply = typeof replyText === 'string' ? replyText : '';

    // 1. Scan explicit [source:<id>] / [cite:<id>] markers
    SOURCE_MARKER_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = SOURCE_MARKER_REGEX.exec(safeReply)) !== null) {
        const rawMarker = match[0];
        const rawToken = match[1]?.trim();
        if (!rawToken) continue;

        const normalizedToken = (stripRecordKeyPrefix(rawToken) ?? rawToken).toLowerCase();
        const matchedKey = keyByLookupToken.get(normalizedToken);
        if (!matchedKey) {
            rejectedCitations.push({
                rawMarker,
                reason: 'Citation marker does not match any in-reach supplied source for this turn',
            });
            continue;
        }
        if (!firstMentionOffsetByKey.has(matchedKey)) {
            firstMentionOffsetByKey.set(matchedKey, match.index);
        }
    }

    // 2. Detect explicit title references to in-reach supplied sources
    const replyLower = safeReply.toLowerCase();
    if (replyLower.length > 0) {
        for (const item of validated) {
            const key = candidateIdentityKey(item)!;
            const offset = findTitleFirstOffset(replyLower, item.sourceTitle);
            if (offset !== -1) {
                const existing = firstMentionOffsetByKey.get(key);
                if (existing === undefined || offset < existing) {
                    firstMentionOffsetByKey.set(key, offset);
                }
            }
        }
    }

    // Assign deterministic 1-based citation ordinals in order of first mention in the reply
    const citedOrder = [...firstMentionOffsetByKey.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([key]) => key);
    const citationOrdinalByKey = new Map<string, number>();
    citedOrder.forEach((key, index) => {
        citationOrdinalByKey.set(key, index + 1);
    });

    const receipts: SpaceAgentSourceReceiptEntry[] = validated.map((item, idx) => {
        const key = candidateIdentityKey(item)!;
        const ordinal = citationOrdinalByKey.get(key) ?? null;
        return {
            sourceKind: item.sourceKind,
            spaceId: item.spaceId,
            spaceItemId: item.spaceItemId,
            contentSourceId: item.contentSourceId,
            targetEntityId: item.targetEntityId,
            targetRecordId: item.targetRecordId,
            sourceTitle: item.sourceTitle,
            band: item.band,
            wasSupplied: true,
            wasCited: ordinal !== null,
            retrievalRank: item.retrievalRank,
            relevanceScore: item.relevanceScore,
            rankingMode: item.rankingMode,
            citationOrdinal: ordinal,
            estimatedTokens: item.estimatedTokens,
            wasTruncated: item.wasTruncated,
            sequence: idx + 1,
        };
    });

    return {
        receipts,
        rejectedCandidates,
        rejectedCitations,
    };
}
