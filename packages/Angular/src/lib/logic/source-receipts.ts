import {
    canReaderAccessSourceReceipt,
    type EffectiveSpaceConfiguration,
    isReceiptAuthorizedByLiveSources,
    isSourceReceiptBand,
    normalizeReceiptUuid,
    type SourceReceiptBand,
    type SourceReceiptKind,
    type SourceReceiptRankingMode,
    type SourceReceiptReachContext,
    stripCitationMarkdown,
    stripRecordKeyPrefix,
} from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType } from '@mj-biz-apps/collaboration-entities';
import type {
    LibraryRowModel,
    SpaceBand,
    SpaceChatAnswerSourceReceipt,
} from '@mj-biz-apps/collaboration-ng-widgets';

export type SourceReceiptOpenTarget =
    | { kind: 'library-preview'; spaceItemId: string }
    | { kind: 'space-item'; spaceId: string; spaceItemId: string }
    | { kind: 'entity-record'; entityName: string; recordId: string }
    | { kind: 'unavailable'; message: string };

export interface ClientReceiptReachInput {
    chatAudience: SpaceBand;
    activeSpaceId: string;
    canSeeTeamOnActiveSpace: boolean;
    reachableSpaces?: ReadonlyArray<{ id: string; canSeeTeam: boolean }>;
}

/**
 * Builds a fail-closed client `(space, band)` reach context for filtering source receipts before rendering.
 * General/Topic chats clamp all spaces strictly to `'Shared'`.
 */
export function buildClientReceiptReachContext(input: ClientReceiptReachInput): SourceReceiptReachContext {
    const chatAudience: SourceReceiptBand = input.chatAudience === 'Team' ? 'Team' : 'Shared';
    const inReachSpaceBands = new Map<string, Set<SourceReceiptBand>>();

    const addSpace = (rawSpaceId: string, canSeeTeam: boolean): void => {
        const clean = normalizeReceiptUuid(rawSpaceId);
        if (!clean) return;
        const bands = new Set<SourceReceiptBand>(['Shared']);
        if (chatAudience === 'Team' && canSeeTeam) {
            bands.add('Team');
        }
        inReachSpaceBands.set(clean, bands);
    };

    addSpace(input.activeSpaceId, input.canSeeTeamOnActiveSpace);
    for (const space of input.reachableSpaces ?? []) {
        addSpace(space.id, space.canSeeTeam);
    }

    return { chatAudience, inReachSpaceBands };
}

function normalizeKind(raw: string): SourceReceiptKind {
    return raw === 'KnowledgeSource' ? 'KnowledgeSource' : 'SpaceItem';
}

function normalizeRankingMode(raw: string): SourceReceiptRankingMode {
    if (raw === 'vector' || raw === 'lexical' || raw === 'grant' || raw === 'none') {
        return raw;
    }
    return 'none';
}

export interface LiveReceiptSourcesContext {
    spaceItems?: ReadonlyArray<{ id: string; spaceId?: string; band: SourceReceiptBand }>;
    scopedSpaceId?: string;
    knowledgeSourceBandsBySpace?: Readonly<Record<string, Readonly<Record<string, SourceReceiptBand>>>>;
}

/**
 * Extracts active `KnowledgeSource` grant bands (`ContentSourceID -> Band`) from a resolved space configuration.
 */
export function buildActiveKnowledgeSourceBands(
    configuration: EffectiveSpaceConfiguration | null | undefined,
): Record<string, SourceReceiptBand> {
    const out: Record<string, SourceReceiptBand> = {};
    for (const grant of configuration?.Grants?.KnowledgeSource ?? []) {
        const id = normalizeReceiptUuid(stripRecordKeyPrefix(grant.TargetRecordID));
        if (id && isSourceReceiptBand(grant.Band)) {
            out[id] = grant.Band;
        }
    }
    return out;
}

function isReceiptAuthorizedByClientLiveSources(
    receipt: {
        spaceId: string;
        sourceKind: string;
        spaceItemId?: string | null;
        contentSourceId?: string | null;
        band: SourceReceiptBand;
    },
    liveSources: LiveReceiptSourcesContext | undefined,
): boolean {
    const normSpaceId = normalizeReceiptUuid(receipt.spaceId);
    if (!normSpaceId) return false;

    if (receipt.sourceKind === 'KnowledgeSource') {
        if (!liveSources?.knowledgeSourceBandsBySpace) {
            return false;
        }
        const spaceGrantsMap = new Map<string, Map<string, SourceReceiptBand>>();
        for (const [rawSpaceId, rawGrants] of Object.entries(liveSources.knowledgeSourceBandsBySpace)) {
            const cleanSpaceId = normalizeReceiptUuid(rawSpaceId);
            if (!cleanSpaceId) continue;
            const inner = new Map<string, SourceReceiptBand>();
            for (const [rawSourceId, grantBand] of Object.entries(rawGrants)) {
                const cleanSourceId = normalizeReceiptUuid(rawSourceId);
                if (cleanSourceId && isSourceReceiptBand(grantBand)) {
                    inner.set(cleanSourceId, grantBand);
                }
            }
            spaceGrantsMap.set(cleanSpaceId, inner);
        }
        return isReceiptAuthorizedByLiveSources(receipt, { knowledgeSourceBandsBySpace: spaceGrantsMap });
    }

    if (receipt.sourceKind === 'SpaceItem') {
        if (!liveSources?.spaceItems) return true;
        const scopedSpaceId = liveSources.scopedSpaceId ? normalizeReceiptUuid(liveSources.scopedSpaceId) : null;
        if (!scopedSpaceId || normSpaceId === scopedSpaceId) {
            const spaceItemsById = new Map<string, { spaceId: string; band: SourceReceiptBand }>();
            for (const item of liveSources.spaceItems) {
                const itemId = normalizeReceiptUuid(item.id);
                const itemSpaceId = normalizeReceiptUuid(item.spaceId) ?? normSpaceId;
                if (itemId && isSourceReceiptBand(item.band)) {
                    spaceItemsById.set(itemId, { spaceId: itemSpaceId, band: item.band });
                }
            }
            return isReceiptAuthorizedByLiveSources(receipt, { spaceItemsById });
        }
        return true;
    }

    return false;
}

/**
 * Converts persisted `SpaceAgentSourceReceipt` rows into typed UI models, enforcing fail-closed
 * `(space, band)` reach validation and optional current live source authorization.
 */
export function filterAndMapSourceReceipts(
    rows: readonly mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[],
    reach: SourceReceiptReachContext,
    liveSources?: LiveReceiptSourcesContext,
): SpaceChatAnswerSourceReceipt[] {
    const out: SpaceChatAnswerSourceReceipt[] = [];
    for (const row of rows) {
        const band: SourceReceiptBand | null = row.Band === 'Team' ? 'Team' : row.Band === 'Shared' ? 'Shared' : null;
        if (!band) continue;
        if (!canReaderAccessSourceReceipt({ spaceId: row.SpaceID, band }, reach)) {
            continue;
        }
        if (
            !isReceiptAuthorizedByClientLiveSources(
                {
                    spaceId: row.SpaceID,
                    sourceKind: row.SourceKind,
                    spaceItemId: row.SpaceItemID,
                    contentSourceId: row.ContentSourceID,
                    band,
                },
                liveSources,
            )
        ) {
            continue;
        }
        const cleanTitle = stripCitationMarkdown(row.SourceTitle) || 'Untitled source';
        out.push({
            id: row.ID,
            conversationDetailId: row.ConversationDetailID,
            spaceId: row.SpaceID,
            sourceKind: normalizeKind(row.SourceKind),
            spaceItemId: row.SpaceItemID ?? null,
            contentSourceId: row.ContentSourceID ?? null,
            targetEntityId: row.TargetEntityID ?? null,
            targetRecordId: row.TargetRecordID ?? null,
            sourceTitle: cleanTitle,
            band,
            wasSupplied: Boolean(row.WasSupplied),
            wasCited: Boolean(row.WasCited),
            retrievalRank: row.RetrievalRank ?? null,
            relevanceScore: row.RelevanceScore ?? null,
            rankingMode: normalizeRankingMode(row.RankingMode),
            citationOrdinal: row.CitationOrdinal ?? null,
            estimatedTokens: Number.isFinite(row.EstimatedTokens) ? row.EstimatedTokens : 0,
            wasTruncated: Boolean(row.WasTruncated),
            sequence: Number.isFinite(row.Sequence) ? row.Sequence : 0,
            originatingScopeId: normalizeReceiptUuid(row.OriginatingScopeID),
            originatingScopeName: typeof row.OriginatingScopeName === 'string' && row.OriginatingScopeName.trim()
                ? stripCitationMarkdown(row.OriginatingScopeName)
                : null,
        });
    }
    return out;
}

interface RawJsonReceiptCandidate {
    spaceId?: string | number | boolean | null;
    band?: string | number | boolean | null;
    sourceKind?: string | number | boolean | null;
    spaceItemId?: string | number | boolean | null;
    contentSourceId?: string | number | boolean | null;
    targetEntityId?: string | number | boolean | null;
    targetRecordId?: string | number | boolean | null;
    sourceTitle?: string | number | boolean | null;
    wasSupplied?: string | number | boolean | null;
    wasCited?: string | number | boolean | null;
    retrievalRank?: string | number | boolean | null;
    relevanceScore?: string | number | boolean | null;
    rankingMode?: string | number | boolean | null;
    citationOrdinal?: string | number | boolean | null;
    estimatedTokens?: string | number | boolean | null;
    wasTruncated?: string | number | boolean | null;
    sequence?: string | number | boolean | null;
    originatingScopeId?: string | number | boolean | null;
    originatingScopeName?: string | number | boolean | null;
}

type JsonParsedPayload =
    | string
    | number
    | boolean
    | null
    | Array<RawJsonReceiptCandidate | string | number | boolean | null>
    | RawJsonReceiptCandidate;

/**
 * Parses `SourceReceiptsJSON` returned by `ExecuteSpaceChatTurn` and enforces fail-closed reach filtering.
 */
export function parseTurnSourceReceiptsPayload(
    rawJson: string | null | undefined,
    conversationDetailId: string | null | undefined,
    reach: SourceReceiptReachContext,
    liveSources?: LiveReceiptSourcesContext,
): SpaceChatAnswerSourceReceipt[] {
    if (!rawJson || !conversationDetailId) return [];
    let parsed: JsonParsedPayload;
    try {
        parsed = JSON.parse(rawJson) as JsonParsedPayload;
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];

    const out: SpaceChatAnswerSourceReceipt[] = [];
    for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const spaceId = typeof item.spaceId === 'string' ? normalizeReceiptUuid(item.spaceId) : null;
        if (!spaceId || (item.band !== 'Shared' && item.band !== 'Team')) continue;
        if (!canReaderAccessSourceReceipt({ spaceId, band: item.band }, reach)) {
            continue;
        }
        const sourceKind: SourceReceiptKind | null =
            item.sourceKind === 'SpaceItem' || item.sourceKind === 'KnowledgeSource' ? item.sourceKind : null;
        if (!sourceKind) continue;

        const spaceItemId = typeof item.spaceItemId === 'string' ? normalizeReceiptUuid(item.spaceItemId) : null;
        const contentSourceId = typeof item.contentSourceId === 'string' ? normalizeReceiptUuid(item.contentSourceId) : null;
        if (sourceKind === 'SpaceItem' && (!spaceItemId || item.contentSourceId != null)) continue;
        if (sourceKind === 'KnowledgeSource' && (!contentSourceId || item.spaceItemId != null)) continue;
        if (
            !isReceiptAuthorizedByClientLiveSources(
                {
                    spaceId,
                    sourceKind,
                    spaceItemId,
                    contentSourceId,
                    band: item.band,
                },
                liveSources,
            )
        ) {
            continue;
        }

        if (typeof item.sourceTitle !== 'string' || !item.sourceTitle.trim()) continue;
        const cleanTitle = stripCitationMarkdown(item.sourceTitle) || 'Untitled source';

        const seq =
            typeof item.sequence === 'number' && Number.isInteger(item.sequence) && item.sequence >= 1
                ? item.sequence
                : out.length + 1;
        const estimatedTokens =
            typeof item.estimatedTokens === 'number' && Number.isFinite(item.estimatedTokens) && item.estimatedTokens >= 0
                ? item.estimatedTokens
                : 0;
        const retrievalRank =
            typeof item.retrievalRank === 'number' && Number.isFinite(item.retrievalRank) && item.retrievalRank >= 1
                ? item.retrievalRank
                : null;
        const relevanceScore =
            typeof item.relevanceScore === 'number' && Number.isFinite(item.relevanceScore)
                ? item.relevanceScore
                : null;
        const wasCited = item.wasCited === true;
        const citationOrdinal =
            wasCited &&
            typeof item.citationOrdinal === 'number' &&
            Number.isFinite(item.citationOrdinal) &&
            item.citationOrdinal >= 1
                ? item.citationOrdinal
                : null;
        const targetEntityId = typeof item.targetEntityId === 'string' ? normalizeReceiptUuid(item.targetEntityId) : null;
        const targetRecordId = typeof item.targetRecordId === 'string' ? item.targetRecordId.trim() || null : null;

        out.push({
            id: `${conversationDetailId}:${sourceKind}:${spaceItemId ?? contentSourceId ?? seq}`,
            conversationDetailId,
            spaceId,
            sourceKind,
            spaceItemId,
            contentSourceId,
            targetEntityId,
            targetRecordId,
            sourceTitle: cleanTitle,
            band: item.band,
            wasSupplied: item.wasSupplied !== false,
            wasCited,
            retrievalRank,
            relevanceScore,
            rankingMode: normalizeRankingMode(typeof item.rankingMode === 'string' ? item.rankingMode : 'none'),
            citationOrdinal,
            estimatedTokens,
            wasTruncated: item.wasTruncated === true,
            sequence: seq,
            originatingScopeId: typeof item.originatingScopeId === 'string' ? normalizeReceiptUuid(item.originatingScopeId) : null,
            originatingScopeName: typeof item.originatingScopeName === 'string' && item.originatingScopeName.trim()
                ? stripCitationMarkdown(item.originatingScopeName)
                : null,
        });
    }
    return out;
}

/**
 * Merges newly received turn receipts into the conversation's current receipt list without duplicating
 * receipts for the same `ConversationDetailID`.
 */
export function mergeAnswerSourceReceipts(
    existing: readonly SpaceChatAnswerSourceReceipt[],
    incoming: readonly SpaceChatAnswerSourceReceipt[],
): SpaceChatAnswerSourceReceipt[] {
    if (incoming.length === 0) return [...existing];
    const replacedDetailIds = new Set(incoming.map((r) => r.conversationDetailId.trim().toLowerCase()));
    const kept = existing.filter((r) => !replacedDetailIds.has(r.conversationDetailId.trim().toLowerCase()));
    return [...kept, ...incoming];
}

/**
 * Resolves how a reader opens an in-reach source receipt from the Space Chat UI.
 */
export function resolveSourceReceiptOpenTarget(
    receipt: SpaceChatAnswerSourceReceipt,
    activeSpaceId: string,
    libraryRows: readonly LibraryRowModel[],
    hasLibraryTab: boolean,
): SourceReceiptOpenTarget {
    if (receipt.sourceKind === 'SpaceItem' && receipt.spaceItemId) {
        const cleanItemId = receipt.spaceItemId.trim().toLowerCase();
        const inActiveLibrary = libraryRows.some((row) => row.id.trim().toLowerCase() === cleanItemId);
        if ((inActiveLibrary || receipt.spaceId.trim().toLowerCase() === activeSpaceId.trim().toLowerCase()) && hasLibraryTab) {
            return { kind: 'library-preview', spaceItemId: receipt.spaceItemId };
        }
        return { kind: 'space-item', spaceId: receipt.spaceId, spaceItemId: receipt.spaceItemId };
    }

    if (receipt.sourceKind === 'KnowledgeSource') {
        const cleanSourceId = stripRecordKeyPrefix(receipt.contentSourceId ?? receipt.targetRecordId);
        if (cleanSourceId) {
            return { kind: 'entity-record', entityName: 'MJ: Content Sources', recordId: cleanSourceId };
        }
    }

    return { kind: 'unavailable', message: 'This cited source does not have an openable target record.' };
}
