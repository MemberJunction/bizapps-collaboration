/**
 * Pure domain rules and validators for space agent source receipts (CT-2).
 *
 * Enforces fail-closed (space, band) audience validation on every supplied candidate
 * and cited source before receipts can be persisted or returned to callers.
 */

import { type CollaborationSettings, DEFAULT_COLLABORATION_SETTINGS } from './configuration.ts';
import { type GrantRowInput, ResolveSpaceConfiguration, type SpaceLevelInput } from './effective-configuration.ts';

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
const RAW_CITATION_MARKER_REGEX = /\[(?:source|cite)\s*:[^\]]*\]/gi;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((?:[^)]+)\)/g;
const MARKDOWN_HEADING_REGEX = /^#{1,6}\s+/gm;
const MARKDOWN_FENCE_REGEX = /```[\s\S]*?```/g;

/**
 * Strips raw Markdown syntax and `[source:...]` / `[cite:...]` markers from source titles and excerpts
 * so rendered citation chips and plain-text views never leak raw Markdown tokens.
 */
export function stripCitationMarkdown(raw: string | null | undefined): string {
    if (typeof raw !== 'string') return '';
    return raw
        .replace(RAW_CITATION_MARKER_REGEX, '')
        .replace(MARKDOWN_FENCE_REGEX, '')
        .replace(MARKDOWN_LINK_REGEX, '$1')
        .replace(MARKDOWN_HEADING_REGEX, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeReceiptUuid(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim().toLowerCase();
    return UUID_REGEX.test(trimmed) ? trimmed : null;
}

/**
 * Returns true strictly when {@link raw} is a valid RFC-formatted UUID string.
 */
export function isValidReceiptUuid(raw: string | null | undefined): boolean {
    return normalizeReceiptUuid(raw) !== null;
}

/**
 * Validates and normalizes {@link raw} as a strict UUID, throwing if malformed or containing SQL quotes.
 */
export function assertValidReceiptUuid(raw: string | null | undefined, fieldName: string): string {
    const normalized = normalizeReceiptUuid(raw);
    if (!normalized) {
        throw new Error(`Invalid UUID for ${fieldName}.`);
    }
    return normalized;
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

export interface LiveKnowledgeSourceGrantInput {
    ID?: string | null;
    SpaceID?: string | null;
    SpaceTypeID?: string | null;
    Kind?: string | null;
    Mode?: string | null;
    Band?: string | null;
    TargetEntityID?: string | null;
    TargetRecordID?: string | null;
    Sequence?: number | null;
}

export interface LiveSpaceChainNodeInput {
    ID: string;
    ParentID?: string | null;
    SpaceTypeID?: string | null;
    Configuration?: string | CollaborationSettings | null;
}

export interface LiveSpaceTypeConfigInput {
    ID: string;
    Configuration?: string | CollaborationSettings | null;
}

export interface LiveReceiptSourceSnapshot {
    spaceItemsById?: ReadonlyMap<string, { spaceId: string; band: SourceReceiptBand }>;
    knowledgeSourceBandsBySpace?: ReadonlyMap<string, ReadonlyMap<string, SourceReceiptBand>>;
}

function sameUuid(a: string | null | undefined, b: string | null | undefined): boolean {
    const na = normalizeReceiptUuid(a);
    const nb = normalizeReceiptUuid(b);
    return !!na && !!nb && na === nb;
}

function parseConfigJson(raw: string | CollaborationSettings | null | undefined): { ok: true; value: CollaborationSettings | null } | { ok: false } {
    if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
    if (typeof raw !== 'string') return { ok: true, value: raw };
    try {
        const parsed = JSON.parse(raw) as CollaborationSettings | null;
        if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
            return { ok: false };
        }
        return { ok: true, value: parsed };
    } catch {
        return { ok: false };
    }
}

function toGrantRowInput(g: LiveKnowledgeSourceGrantInput, fallbackIdx: number): GrantRowInput | null {
    const normalizedTarget = normalizeReceiptUuid(stripRecordKeyPrefix(g.TargetRecordID));
    if (!normalizedTarget) return null;
    const rawMode = (g.Mode ?? 'Extend').trim();
    const mode = rawMode === 'Revoke' ? 'Remove' : rawMode;
    return {
        ID: normalizeReceiptUuid(g.ID) ?? `ks-grant-${fallbackIdx}`,
        Kind: g.Kind && g.Kind.trim() ? g.Kind.trim() : 'KnowledgeSource',
        Mode: mode,
        TargetEntityID: normalizeReceiptUuid(g.TargetEntityID) ?? 'knowledge-source',
        TargetRecordID: normalizedTarget,
        Band: g.Band ?? '',
        Sequence: g.Sequence ?? 0,
    };
}

/**
 * Computes effective KnowledgeSource grant bands (`ContentSourceID -> Band`) per target space ID
 * by delegating to the authoritative `ResolveSpaceConfiguration` resolver:
 * App -> Type -> unbroken same-type ancestor chain (restarting at `SpaceTypeID` boundaries) -> Space,
 * respecting `ListMode = 'Replace'` vs `'Extend'`, `SpaceOverridable`, and `Extend` / `Remove` overrides.
 */
export function resolveEffectiveKnowledgeSourceBandsBySpace(params: {
    spaceIds: readonly string[];
    spaces: readonly LiveSpaceChainNodeInput[];
    grants: readonly LiveKnowledgeSourceGrantInput[];
    spaceTypes?: readonly LiveSpaceTypeConfigInput[];
    appSettings?: CollaborationSettings | null;
}): Map<string, Map<string, SourceReceiptBand>> {
    const spaceById = new Map<string, LiveSpaceChainNodeInput>();
    for (const s of params.spaces) {
        const id = normalizeReceiptUuid(s.ID);
        if (id) {
            spaceById.set(id, s);
        }
    }

    const typeById = new Map<string, LiveSpaceTypeConfigInput>();
    for (const st of params.spaceTypes ?? []) {
        const id = normalizeReceiptUuid(st.ID);
        if (id) {
            typeById.set(id, st);
        }
    }

    const ksGrants = params.grants.filter((g) => !g.Kind || g.Kind === 'KnowledgeSource');
    const appGrantInputs: GrantRowInput[] = [];
    ksGrants.forEach((g, idx) => {
        if (!normalizeReceiptUuid(g.SpaceID) && !normalizeReceiptUuid(g.SpaceTypeID)) {
            const mapped = toGrantRowInput(g, idx);
            if (mapped) appGrantInputs.push(mapped);
        }
    });

    const result = new Map<string, Map<string, SourceReceiptBand>>();

    for (const rawSpaceId of params.spaceIds) {
        const spaceId = normalizeReceiptUuid(rawSpaceId);
        if (!spaceId || result.has(spaceId)) continue;

        const leaf = spaceById.get(spaceId);
        if (!leaf) {
            result.set(spaceId, new Map<string, SourceReceiptBand>());
            continue;
        }

        // Build full ancestor chain nearest-first: [leaf, parent, grandparent, ...].
        // `ResolveSpaceConfiguration` derives the unbroken same-type run (`sameTypeRun`) from this chain.
        const chainNodes: LiveSpaceChainNodeInput[] = [leaf];
        const visited = new Set<string>([spaceId]);
        let cursor: LiveSpaceChainNodeInput | undefined = leaf;
        while (cursor?.ParentID) {
            const parentId = normalizeReceiptUuid(cursor.ParentID);
            if (!parentId || visited.has(parentId)) break;
            visited.add(parentId);
            const parent = spaceById.get(parentId);
            if (!parent) break;
            chainNodes.push(parent);
            cursor = parent;
        }

        let parseFailed = false;
        const spaceLevels: SpaceLevelInput[] = [];
        for (const node of chainNodes) {
            const parsedSettings = parseConfigJson(node.Configuration);
            if (!parsedSettings.ok) {
                parseFailed = true;
                break;
            }
            const nodeGrants: GrantRowInput[] = [];
            ksGrants.forEach((g, idx) => {
                if (sameUuid(g.SpaceID, node.ID)) {
                    const mapped = toGrantRowInput(g, idx);
                    if (mapped) nodeGrants.push(mapped);
                }
            });
            spaceLevels.push({
                ID: node.ID,
                TypeID: node.SpaceTypeID ?? null,
                Settings: parsedSettings.value,
                Grants: nodeGrants,
            });
        }

        const leafTypeId = normalizeReceiptUuid(leaf.SpaceTypeID);
        let typeInput: { ID: string; Settings: CollaborationSettings | null; Grants: GrantRowInput[] } | null = null;
        if (!parseFailed && leafTypeId) {
            const typeRow = typeById.get(leafTypeId);
            const parsedTypeSettings = parseConfigJson(typeRow?.Configuration);
            if (!parsedTypeSettings.ok) {
                parseFailed = true;
            } else {
                const typeGrantInputs: GrantRowInput[] = [];
                ksGrants.forEach((g, idx) => {
                    if (!normalizeReceiptUuid(g.SpaceID) && sameUuid(g.SpaceTypeID, leafTypeId)) {
                        const mapped = toGrantRowInput(g, idx);
                        if (mapped) typeGrantInputs.push(mapped);
                    }
                });
                typeInput = {
                    ID: leafTypeId,
                    Settings: parsedTypeSettings.value,
                    Grants: typeGrantInputs,
                };
            }
        }

        const bands = new Map<string, SourceReceiptBand>();
        if (!parseFailed) {
            const effective = ResolveSpaceConfiguration({
                App: {
                    Settings: params.appSettings ?? DEFAULT_COLLABORATION_SETTINGS,
                    Grants: appGrantInputs,
                },
                Type: typeInput,
                Spaces: spaceLevels,
            });
            for (const eg of effective.Grants.KnowledgeSource) {
                const cid = normalizeReceiptUuid(stripRecordKeyPrefix(eg.TargetRecordID));
                if (cid && isSourceReceiptBand(eg.Band)) {
                    bands.set(cid, eg.Band);
                }
            }
        }

        result.set(spaceId, bands);
    }

    return result;
}

/**
 * Verifies a persisted or streamed source receipt against current live SpaceItem and/or KnowledgeSource state.
 * Fails closed for KnowledgeSource receipts whenever no validated KnowledgeSource grant snapshot is provided.
 */
export function isReceiptAuthorizedByLiveSources(
    receipt: {
        spaceId: string;
        sourceKind: string;
        spaceItemId?: string | null;
        contentSourceId?: string | null;
        band: SourceReceiptBand;
    },
    snapshot: LiveReceiptSourceSnapshot,
): boolean {
    const receiptSpaceId = normalizeReceiptUuid(receipt.spaceId);
    if (!receiptSpaceId) return false;

    if (receipt.sourceKind === 'SpaceItem') {
        if (!snapshot.spaceItemsById) return true;
        const itemId = normalizeReceiptUuid(receipt.spaceItemId);
        if (!itemId) return false;
        const liveItem = snapshot.spaceItemsById.get(itemId);
        if (!liveItem) return false;
        if (normalizeReceiptUuid(liveItem.spaceId) !== receiptSpaceId) return false;
        if (receipt.band === 'Shared' && liveItem.band !== 'Shared') return false;
        return true;
    }

    if (receipt.sourceKind === 'KnowledgeSource') {
        if (!snapshot.knowledgeSourceBandsBySpace) return false;
        const sourceId = normalizeReceiptUuid(receipt.contentSourceId);
        if (!sourceId) return false;
        const spaceGrants = snapshot.knowledgeSourceBandsBySpace.get(receiptSpaceId);
        if (!spaceGrants) return false;
        const liveBand = spaceGrants.get(sourceId);
        if (!liveBand) return false;
        if (receipt.band === 'Shared' && liveBand !== 'Shared') return false;
        return true;
    }

    return false;
}
