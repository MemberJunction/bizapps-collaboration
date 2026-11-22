import {
    canReaderAccessSourceReceipt,
    normalizeReceiptUuid,
    type SourceReceiptBand,
    type SourceReceiptKind,
    type SourceReceiptRankingMode,
    type SourceReceiptReachContext,
    type SpaceAgentSourceReceiptEntry,
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

/**
 * Converts persisted `SpaceAgentSourceReceipt` rows into typed UI models, enforcing fail-closed
 * `(space, band)` reach validation so out-of-reach rows are never returned.
 */
export function filterAndMapSourceReceipts(
    rows: readonly mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[],
    reach: SourceReceiptReachContext,
): SpaceChatAnswerSourceReceipt[] {
    const out: SpaceChatAnswerSourceReceipt[] = [];
    for (const row of rows) {
        const band: SourceReceiptBand | null = row.Band === 'Team' ? 'Team' : row.Band === 'Shared' ? 'Shared' : null;
        if (!band) continue;
        if (!canReaderAccessSourceReceipt({ spaceId: row.SpaceID, band }, reach)) {
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
        });
    }
    return out;
}

/**
 * Parses `SourceReceiptsJSON` returned by `ExecuteSpaceChatTurn` and enforces fail-closed reach filtering.
 */
export function parseTurnSourceReceiptsPayload(
    rawJson: string | null | undefined,
    conversationDetailId: string | null | undefined,
    reach: SourceReceiptReachContext,
): SpaceChatAnswerSourceReceipt[] {
    if (!rawJson || !conversationDetailId) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(rawJson);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];

    const out: SpaceChatAnswerSourceReceipt[] = [];
    for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const entry = item as Partial<SpaceAgentSourceReceiptEntry>;
        if (typeof entry.spaceId !== 'string' || (entry.band !== 'Shared' && entry.band !== 'Team')) continue;
        if (!canReaderAccessSourceReceipt({ spaceId: entry.spaceId, band: entry.band }, reach)) {
            continue;
        }
        const cleanTitle = stripCitationMarkdown(entry.sourceTitle) || 'Untitled source';
        const seq = typeof entry.sequence === 'number' && Number.isFinite(entry.sequence) ? entry.sequence : out.length + 1;
        out.push({
            id: `${conversationDetailId}:${entry.sourceKind ?? 'SpaceItem'}:${entry.spaceItemId ?? entry.contentSourceId ?? seq}`,
            conversationDetailId,
            spaceId: entry.spaceId,
            sourceKind: entry.sourceKind === 'KnowledgeSource' ? 'KnowledgeSource' : 'SpaceItem',
            spaceItemId: entry.spaceItemId ?? null,
            contentSourceId: entry.contentSourceId ?? null,
            targetEntityId: entry.targetEntityId ?? null,
            targetRecordId: entry.targetRecordId ?? null,
            sourceTitle: cleanTitle,
            band: entry.band,
            wasSupplied: entry.wasSupplied !== false,
            wasCited: entry.wasCited === true,
            retrievalRank: typeof entry.retrievalRank === 'number' ? entry.retrievalRank : null,
            relevanceScore: typeof entry.relevanceScore === 'number' ? entry.relevanceScore : null,
            rankingMode: normalizeRankingMode(typeof entry.rankingMode === 'string' ? entry.rankingMode : 'none'),
            citationOrdinal: typeof entry.citationOrdinal === 'number' ? entry.citationOrdinal : null,
            estimatedTokens: typeof entry.estimatedTokens === 'number' ? entry.estimatedTokens : 0,
            wasTruncated: entry.wasTruncated === true,
            sequence: seq,
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
