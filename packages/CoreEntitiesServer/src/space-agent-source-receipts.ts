/**
 * Server persistence & fail-closed query service for relational Space Agent Source Receipts (CT-2).
 */

import { type IMetadataProvider, LogError, RunView, type UserInfo, WellKnownUserSource } from '@memberjunction/core';
import {
    canReaderAccessSourceReceipt,
    type EffectiveGrant,
    isReceiptAuthorizedByLiveSources,
    isSourceReceiptBand,
    type LiveKnowledgeSourceGrantInput,
    type LiveReceiptSourceSnapshot,
    type LiveSpaceChainNodeInput,
    normalizeReceiptUuid,
    resolveEffectiveKnowledgeSourceBandsBySpace,
    type SourceReceiptBand,
    type SourceReceiptReachContext,
    type SpaceAgentSourceReceiptEntry,
    stripRecordKeyPrefix,
    type ValidatedSuppliedSourceCandidate,
} from '@mj-biz-apps/collaboration-core';
import {
    mjBizAppsCollaborationSpaceAgentSourceReceiptEntity,
    type mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType,
} from '@mj-biz-apps/collaboration-entities';
import { COLLABORATION_SOURCE_RECEIPT_ENTITY, runWithCollaborationAgentTurnAuthority } from './ai-run-lockdown.js';
import { readEveryRow } from './read-every-row.js';
import type { TurnToolSourceHit } from './turn-tools.js';

const CONTENT_SOURCES_ENTITY = 'MJ: Content Sources';
const SPACE_CHATS_ENTITY = 'MJ_BizApps_Collaboration: Space Chats';
const SPACE_GRANTS_ENTITY = 'MJ_BizApps_Collaboration: Space Grants';
const SPACE_ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';
const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const TASKS_ENTITY = 'MJ_BizApps_Tasks: Tasks';
const FILES_ENTITY = 'MJ: Files';
const LIVE_CHECK_BATCH_SIZE = 200;

interface ContentSourceRow {
    ID: string;
    Name: string | null;
}

export interface PersistSpaceAgentSourceReceiptsParams {
    provider: IMetadataProvider;
    systemUser: UserInfo;
    turnUserId: string;
    spaceChatId: string;
    conversationId: string;
    conversationDetailId: string;
    agentRunId?: string | null;
    receipts: readonly SpaceAgentSourceReceiptEntry[];
    reachContext?: SourceReceiptReachContext;
}

export type PersistSpaceAgentSourceReceiptsResult =
    | { ok: true; persistedCount: number; savedIds: string[] }
    | { ok: false; errorMessage: string };

export interface QuerySpaceAgentSourceReceiptsParams {
    provider: IMetadataProvider;
    user: UserInfo;
    conversationId: string;
    conversationDetailId?: string;
    inReachSpaceBands: ReadonlyMap<string, ReadonlySet<SourceReceiptBand>>;
    callerCanSeeTeam: boolean;
}

export interface QuerySpaceAgentSourceReceiptsResult {
    ok: boolean;
    receipts: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[];
    filteredOutCount: number;
    errorMessage?: string;
}

/**
 * Resolves only the granted in-reach knowledge sources that were actually supplied/retrieved
 * in the turn context or tool results, strictly bounded by `chatAudience`.
 */
export async function resolveSuppliedKnowledgeSources(
    provider: IMetadataProvider,
    systemUser: UserInfo,
    spaceId: string,
    knowledgeGrants: readonly EffectiveGrant[],
    knowledgeSourceIdsInForce: readonly string[],
    chatAudience: SourceReceiptBand,
    suppliedKnowledgeSourceIds?: ReadonlySet<string>,
): Promise<ValidatedSuppliedSourceCandidate[]> {
    const cleanSpaceId = normalizeReceiptUuid(spaceId);
    if (!cleanSpaceId || knowledgeSourceIdsInForce.length === 0) {
        return [];
    }
    if (suppliedKnowledgeSourceIds && suppliedKnowledgeSourceIds.size === 0) {
        return [];
    }

    const inForceSet = new Set(
        knowledgeSourceIdsInForce
            .map((id) => normalizeReceiptUuid(id))
            .filter((id): id is string => id !== null),
    );

    const eligibleGrants: Array<{ contentSourceId: string; grant: EffectiveGrant }> = [];
    for (const grant of knowledgeGrants) {
        if (chatAudience === 'Shared' && grant.Band !== 'Shared') {
            continue;
        }
        const strippedId = normalizeReceiptUuid(stripRecordKeyPrefix(grant.TargetRecordID));
        if (!strippedId || !inForceSet.has(strippedId)) {
            continue;
        }
        if (suppliedKnowledgeSourceIds && !suppliedKnowledgeSourceIds.has(strippedId)) {
            continue;
        }
        eligibleGrants.push({ contentSourceId: strippedId, grant });
    }

    if (eligibleGrants.length === 0) {
        return [];
    }

    const idFilter = eligibleGrants.map((e) => `'${e.contentSourceId}'`).join(',');
    const rv = RunView.FromMetadataProvider(provider);
    const titleById = new Map<string, string>();
    try {
        const res = await rv.RunView<ContentSourceRow>({
            EntityName: CONTENT_SOURCES_ENTITY,
            ExtraFilter: `ID IN (${idFilter})`,
            Fields: ['ID', 'Name'],
            ResultType: 'simple',
            // row-cap-ok: bounded by the configuration's granted KnowledgeSource IDs for one space
            MaxRows: 500,
        }, systemUser);
        if (res.Success && res.Results) {
            for (const row of res.Results) {
                const cid = normalizeReceiptUuid(row.ID);
                if (cid && row.Name?.trim()) {
                    titleById.set(cid, row.Name.trim());
                }
            }
        }
    } catch (err) {
        LogError(`resolveSuppliedKnowledgeSources lookup warning: ${err instanceof Error ? err.message : String(err)}`);
    }

    const candidates: ValidatedSuppliedSourceCandidate[] = [];
    const seen = new Set<string>();
    for (const { contentSourceId, grant } of eligibleGrants) {
        if (seen.has(contentSourceId)) continue;
        seen.add(contentSourceId);
        const title = titleById.get(contentSourceId) ?? grant.Label?.trim() ?? `Knowledge Source ${contentSourceId.slice(0, 8)}`;
        candidates.push({
            sourceKind: 'KnowledgeSource',
            spaceId: cleanSpaceId,
            spaceItemId: null,
            contentSourceId,
            targetEntityId: normalizeReceiptUuid(grant.TargetEntityID),
            targetRecordId: grant.TargetRecordID,
            sourceTitle: title,
            band: grant.Band,
            retrievalRank: null,
            relevanceScore: null,
            rankingMode: 'grant',
            estimatedTokens: 0,
            wasTruncated: false,
        });
    }
    return candidates;
}

/**
 * Builds the turn's `(spaceId -> allowedBands)` reach context from retrieval scope results.
 */
export function buildSourceReceiptReachContext(
    chatAudience: SourceReceiptBand,
    anchorSpaceId: string,
    allowedBandsBySpace: Readonly<Record<string, SourceReceiptBand>> | undefined,
    searchedSpaceIds: readonly string[],
): SourceReceiptReachContext {
    const inReachSpaceBands = new Map<string, Set<SourceReceiptBand>>();

    if (allowedBandsBySpace) {
        for (const [rawSpaceId, maxBand] of Object.entries(allowedBandsBySpace)) {
            const cleanId = normalizeReceiptUuid(rawSpaceId);
            if (!cleanId) continue;
            const bands = new Set<SourceReceiptBand>(['Shared']);
            if (chatAudience === 'Team' && maxBand === 'Team') {
                bands.add('Team');
            }
            inReachSpaceBands.set(cleanId, bands);
        }
    } else {
        for (const rawSpaceId of searchedSpaceIds) {
            const cleanId = normalizeReceiptUuid(rawSpaceId);
            if (!cleanId) continue;
            const bands = new Set<SourceReceiptBand>(['Shared']);
            if (chatAudience === 'Team') {
                bands.add('Team');
            }
            inReachSpaceBands.set(cleanId, bands);
        }
    }

    const cleanAnchor = normalizeReceiptUuid(anchorSpaceId);
    if (cleanAnchor && !inReachSpaceBands.has(cleanAnchor)) {
        const bands = new Set<SourceReceiptBand>(['Shared']);
        if (chatAudience === 'Team') {
            bands.add('Team');
        }
        inReachSpaceBands.set(cleanAnchor, bands);
    }

    return {
        chatAudience,
        inReachSpaceBands,
    };
}

export interface ResolveToolSuppliedSourcesParams {
    provider: IMetadataProvider;
    systemUser: UserInfo;
    toolHits: readonly TurnToolSourceHit[];
    reachContext: SourceReceiptReachContext;
    alreadySuppliedSpaceItemIds: ReadonlySet<string>;
}

export interface ResolveToolSuppliedSourcesResult {
    spaceItemCandidates: ValidatedSuppliedSourceCandidate[];
    suppliedKnowledgeSourceIds: Set<string>;
    rejectedCount: number;
}

/**
 * Resolves and fail-closed validates sources returned by in-turn search or knowledge tools
 * (e.g. `CollaborationScopedSearchAction`) against the turn's `(space, band)` reach before
 * merging them into receipt candidates.
 */
export async function resolveToolSuppliedSourceCandidates(
    params: ResolveToolSuppliedSourcesParams,
): Promise<ResolveToolSuppliedSourcesResult> {
    const spaceItemCandidates: ValidatedSuppliedSourceCandidate[] = [];
    const suppliedKnowledgeSourceIds = new Set<string>();
    let rejectedCount = 0;

    if (params.toolHits.length === 0) {
        return { spaceItemCandidates, suppliedKnowledgeSourceIds, rejectedCount };
    }

    const directSpaceItemIds = new Set<string>();
    const taskRecordIds = new Set<string>();
    const chunkIds = new Set<string>();
    const contentItemIds = new Set<string>();
    const hitBySpaceItemId = new Map<string, TurnToolSourceHit>();
    const hitByTaskRecordId = new Map<string, TurnToolSourceHit>();

    for (const hit of params.toolHits) {
        if (hit.sourceKind === 'KnowledgeSource') {
            const cid = normalizeReceiptUuid(stripRecordKeyPrefix(hit.contentSourceId ?? hit.recordId));
            if (cid) suppliedKnowledgeSourceIds.add(cid);
            continue;
        }
        const directItemId = normalizeReceiptUuid(stripRecordKeyPrefix(hit.spaceItemId));
        if (directItemId) {
            directSpaceItemIds.add(directItemId);
            if (!hitBySpaceItemId.has(directItemId)) hitBySpaceItemId.set(directItemId, hit);
            continue;
        }
        const recId = normalizeReceiptUuid(stripRecordKeyPrefix(hit.recordId));
        if (!recId) continue;
        if (hit.entityName === SPACE_ITEMS_ENTITY) {
            directSpaceItemIds.add(recId);
            if (!hitBySpaceItemId.has(recId)) hitBySpaceItemId.set(recId, hit);
        } else if (hit.entityName === TASKS_ENTITY) {
            taskRecordIds.add(recId);
            if (!hitByTaskRecordId.has(recId)) hitByTaskRecordId.set(recId, hit);
        } else if (hit.entityName === 'MJ: Content Item Chunks') {
            chunkIds.add(recId);
        } else if (hit.entityName === 'MJ: Content Items') {
            contentItemIds.add(recId);
        } else {
            const cid = normalizeReceiptUuid(stripRecordKeyPrefix(hit.contentSourceId));
            if (cid) suppliedKnowledgeSourceIds.add(cid);
        }
    }

    const rv = RunView.FromMetadataProvider(params.provider);

    // Resolve chunk -> contentItem -> ERD -> SpaceItem / ContentSource if any chunk hits arrived
    if (chunkIds.size > 0) {
        try {
            const chunkFilter = Array.from(chunkIds).map((id) => `'${id}'`).join(', ');
            const chunksRes = await rv.RunView<{ ID: string; ContentItemID: string }>({
                EntityName: 'MJ: Content Item Chunks',
                ExtraFilter: `ID IN (${chunkFilter})`,
                Fields: ['ID', 'ContentItemID'],
                ResultType: 'simple',
                // row-cap-ok: bounded by tool hit count in a single turn
                MaxRows: 500,
            }, params.systemUser);
            for (const row of chunksRes.Success && chunksRes.Results ? chunksRes.Results : []) {
                const ciId = normalizeReceiptUuid(row.ContentItemID);
                if (ciId) contentItemIds.add(ciId);
            }
        } catch (err) {
            LogError(`resolveToolSuppliedSourceCandidates chunk lookup warning: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    if (contentItemIds.size > 0) {
        try {
            const ciFilter = Array.from(contentItemIds).map((id) => `'${id}'`).join(', ');
            const ciRes = await rv.RunView<{ ID: string; ContentSourceID: string | null; EntityRecordDocumentID: string | null }>({
                EntityName: 'MJ: Content Items',
                ExtraFilter: `ID IN (${ciFilter})`,
                Fields: ['ID', 'ContentSourceID', 'EntityRecordDocumentID'],
                ResultType: 'simple',
                // row-cap-ok: bounded by tool hit count in a single turn
                MaxRows: 500,
            }, params.systemUser);
            const erdIds: string[] = [];
            for (const row of ciRes.Success && ciRes.Results ? ciRes.Results : []) {
                const csId = normalizeReceiptUuid(row.ContentSourceID);
                if (csId) suppliedKnowledgeSourceIds.add(csId);
                const erdId = normalizeReceiptUuid(row.EntityRecordDocumentID);
                if (erdId) erdIds.push(erdId);
            }
            if (erdIds.length > 0) {
                const erdFilter = erdIds.map((id) => `'${id}'`).join(', ');
                const erdRes = await rv.RunView<{ ID: string; Entity: string; RecordID: string }>({
                    EntityName: 'MJ: Entity Record Documents',
                    ExtraFilter: `ID IN (${erdFilter}) AND Entity = '${SPACE_ITEMS_ENTITY}'`,
                    Fields: ['ID', 'Entity', 'RecordID'],
                    ResultType: 'simple',
                    // row-cap-ok: bounded by tool hit count in a single turn
                    MaxRows: 500,
                }, params.systemUser);
                for (const erd of erdRes.Success && erdRes.Results ? erdRes.Results : []) {
                    const siId = normalizeReceiptUuid(stripRecordKeyPrefix(erd.RecordID));
                    if (siId) directSpaceItemIds.add(siId);
                }
            }
        } catch (err) {
            LogError(`resolveToolSuppliedSourceCandidates content item lookup warning: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    interface SpaceItemLookupRow {
        ID: string;
        SpaceID: string;
        EntityID: string;
        RecordID: string;
        Band: string;
    }

    const resolvedItems: SpaceItemLookupRow[] = [];
    if (directSpaceItemIds.size > 0) {
        const idList = Array.from(directSpaceItemIds).map((id) => `'${id}'`).join(', ');
        const siRes = await rv.RunView<SpaceItemLookupRow>({
            EntityName: SPACE_ITEMS_ENTITY,
            ExtraFilter: `ID IN (${idList})`,
            Fields: ['ID', 'SpaceID', 'EntityID', 'RecordID', 'Band'],
            ResultType: 'simple',
            // row-cap-ok: bounded by tool hit count in a single turn
            MaxRows: 500,
        }, params.systemUser);
        if (siRes.Success && siRes.Results) {
            resolvedItems.push(...siRes.Results);
        }
    }

    if (taskRecordIds.size > 0) {
        const tasksEntity = typeof params.provider.EntityByName === 'function'
            ? params.provider.EntityByName(TASKS_ENTITY)
            : undefined;
        const taskRecClauses = Array.from(taskRecordIds).flatMap((id) => [`'ID|${id}'`, `'${id}'`]).join(', ');
        const entityFilter = tasksEntity?.ID ? ` AND EntityID = '${normalizeReceiptUuid(tasksEntity.ID) ?? tasksEntity.ID}'` : '';
        const taskSiRes = await rv.RunView<SpaceItemLookupRow>({
            EntityName: SPACE_ITEMS_ENTITY,
            ExtraFilter: `RecordID IN (${taskRecClauses})${entityFilter}`,
            Fields: ['ID', 'SpaceID', 'EntityID', 'RecordID', 'Band'],
            ResultType: 'simple',
            // row-cap-ok: bounded by tool hit count in a single turn
            MaxRows: 500,
        }, params.systemUser);
        if (taskSiRes.Success && taskSiRes.Results) {
            resolvedItems.push(...taskSiRes.Results);
        }
    }

    // Resolve target titles when missing from tool hits
    const fileRecordIds = new Set<string>();
    const taskTargetIds = new Set<string>();
    const filesEntityId = typeof params.provider.EntityByName === 'function'
        ? normalizeReceiptUuid(params.provider.EntityByName(FILES_ENTITY)?.ID)
        : null;
    const tasksEntityId = typeof params.provider.EntityByName === 'function'
        ? normalizeReceiptUuid(params.provider.EntityByName(TASKS_ENTITY)?.ID)
        : null;

    for (const item of resolvedItems) {
        const targetId = normalizeReceiptUuid(stripRecordKeyPrefix(item.RecordID));
        const entId = normalizeReceiptUuid(item.EntityID);
        if (!targetId) continue;
        if (filesEntityId && entId === filesEntityId) fileRecordIds.add(targetId);
        else if (tasksEntityId && entId === tasksEntityId) taskTargetIds.add(targetId);
    }

    const titleByTargetId = new Map<string, string>();
    const lookupTitles = async (entityName: string, ids: Set<string>): Promise<void> => {
        if (ids.size === 0) return;
        try {
            const inClause = Array.from(ids).map((id) => `'${id}'`).join(', ');
            const res = await rv.RunView<{ ID: string; Name: string | null }>({
                EntityName: entityName,
                ExtraFilter: `ID IN (${inClause})`,
                Fields: ['ID', 'Name'],
                ResultType: 'simple',
                // row-cap-ok: bounded by tool hit count in a single turn
                MaxRows: 500,
            }, params.systemUser);
            for (const row of res.Success && res.Results ? res.Results : []) {
                const rid = normalizeReceiptUuid(row.ID);
                if (rid && row.Name?.trim()) titleByTargetId.set(rid, row.Name.trim());
            }
        } catch (err) {
            LogError(`resolveToolSuppliedSourceCandidates title lookup warning: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    await Promise.all([
        lookupTitles(FILES_ENTITY, fileRecordIds),
        lookupTitles(TASKS_ENTITY, taskTargetIds),
    ]);

    const seenCandidateIds = new Set<string>(params.alreadySuppliedSpaceItemIds);
    for (const item of resolvedItems) {
        const cleanItemId = normalizeReceiptUuid(item.ID);
        const cleanSpaceId = normalizeReceiptUuid(item.SpaceID);
        const band: SourceReceiptBand | null = item.Band === 'Team' ? 'Team' : item.Band === 'Shared' ? 'Shared' : null;
        if (!cleanItemId || !cleanSpaceId || !band) {
            rejectedCount += 1;
            continue;
        }
        if (!canReaderAccessSourceReceipt({ spaceId: cleanSpaceId, band }, params.reachContext)) {
            rejectedCount += 1;
            continue;
        }
        if (seenCandidateIds.has(cleanItemId)) {
            continue;
        }
        seenCandidateIds.add(cleanItemId);

        const cleanTargetId = normalizeReceiptUuid(stripRecordKeyPrefix(item.RecordID));
        const hitMeta =
            hitBySpaceItemId.get(cleanItemId) ??
            (cleanTargetId ? hitByTaskRecordId.get(cleanTargetId) : undefined);
        const title =
            (cleanTargetId ? titleByTargetId.get(cleanTargetId) : undefined) ??
            hitMeta?.title?.trim() ??
            `Item ${cleanItemId.slice(0, 8)}`;

        spaceItemCandidates.push({
            sourceKind: 'SpaceItem',
            spaceId: cleanSpaceId,
            spaceItemId: cleanItemId,
            contentSourceId: null,
            targetEntityId: normalizeReceiptUuid(item.EntityID),
            targetRecordId: item.RecordID || null,
            sourceTitle: title,
            band,
            retrievalRank: null,
            relevanceScore: hitMeta?.score ?? null,
            rankingMode: hitMeta?.rankingMode ?? 'lexical',
            estimatedTokens: 0,
            wasTruncated: false,
        });
    }

    return { spaceItemCandidates, suppliedKnowledgeSourceIds, rejectedCount };
}

function receiptNaturalKey(entry: {
    sourceKind: string;
    spaceItemId: string | null;
    contentSourceId: string | null;
}): string | null {
    if (entry.sourceKind === 'SpaceItem') {
        const id = normalizeReceiptUuid(entry.spaceItemId);
        return id ? `SpaceItem:${id}` : null;
    }
    const id = normalizeReceiptUuid(entry.contentSourceId);
    return id ? `KnowledgeSource:${id}` : null;
}

/**
 * Idempotently persists validated source receipts for an assistant message detail row.
 * Validates all UUID identifiers strictly before executing any database queries, and uses
 * keyset-paged lookup so retries update existing rows in place without truncation or duplicates.
 */
export async function persistSpaceAgentSourceReceipts(
    params: PersistSpaceAgentSourceReceiptsParams,
): Promise<PersistSpaceAgentSourceReceiptsResult> {
    const {
        provider,
        systemUser,
        turnUserId,
        spaceChatId,
        conversationId,
        conversationDetailId,
        agentRunId,
        receipts,
        reachContext,
    } = params;

    const cleanChatId = normalizeReceiptUuid(spaceChatId);
    const cleanConversationId = normalizeReceiptUuid(conversationId);
    const cleanDetailId = normalizeReceiptUuid(conversationDetailId);
    const hasAgentRunId = agentRunId !== undefined && agentRunId !== null && String(agentRunId).trim().length > 0;
    const cleanRunId = hasAgentRunId ? normalizeReceiptUuid(agentRunId) : null;

    if (!cleanChatId || !cleanConversationId || !cleanDetailId || (hasAgentRunId && !cleanRunId)) {
        return {
            ok: false,
            errorMessage: 'Cannot persist source receipts without valid UUIDs for SpaceChatID, ConversationID, ConversationDetailID, and AgentRunID.',
        };
    }

    if (receipts.length === 0) {
        return { ok: true, persistedCount: 0, savedIds: [] };
    }

    for (const entry of receipts) {
        if (!normalizeReceiptUuid(entry.spaceId)) {
            return { ok: false, errorMessage: 'Cannot persist source receipt with invalid SpaceID UUID.' };
        }
        if (entry.sourceKind === 'SpaceItem' && !normalizeReceiptUuid(entry.spaceItemId)) {
            return { ok: false, errorMessage: 'Cannot persist SpaceItem source receipt with invalid SpaceItemID UUID.' };
        }
        if (entry.sourceKind === 'KnowledgeSource' && !normalizeReceiptUuid(entry.contentSourceId)) {
            return { ok: false, errorMessage: 'Cannot persist KnowledgeSource receipt with invalid ContentSourceID UUID.' };
        }
    }

    try {
        return await runWithCollaborationAgentTurnAuthority(turnUserId, async () => {
            const rv = RunView.FromMetadataProvider(provider);
            const existingRows = await readEveryRow<{
                ID: string;
                SourceKind: string;
                SpaceItemID: string | null;
                ContentSourceID: string | null;
            }>(
                rv,
                {
                    EntityName: COLLABORATION_SOURCE_RECEIPT_ENTITY,
                    ExtraFilter: `ConversationDetailID = '${cleanDetailId}'`,
                    Fields: ['ID', 'SourceKind', 'SpaceItemID', 'ContentSourceID'],
                },
                systemUser,
            );

            const existingIdByKey = new Map<string, string>();
            for (const row of existingRows) {
                const key = receiptNaturalKey({
                    sourceKind: row.SourceKind,
                    spaceItemId: row.SpaceItemID,
                    contentSourceId: row.ContentSourceID,
                });
                const cleanExistingId = normalizeReceiptUuid(row.ID);
                if (key && cleanExistingId) {
                    existingIdByKey.set(key, cleanExistingId);
                }
            }

            const savedIds: string[] = [];
            for (const entry of receipts) {
                const entity = await provider.GetEntityObject<mjBizAppsCollaborationSpaceAgentSourceReceiptEntity>(
                    COLLABORATION_SOURCE_RECEIPT_ENTITY,
                    systemUser,
                );
                if (!entity) {
                    return { ok: false, errorMessage: 'Unable to instantiate Space Agent Source Receipt entity.' };
                }

                const key = receiptNaturalKey(entry);
                const existingId = key ? existingIdByKey.get(key) : undefined;
                if (existingId) {
                    const loaded = await entity.Load(existingId);
                    if (!loaded) {
                        return { ok: false, errorMessage: `Failed to load existing source receipt ${existingId} for retry upsert.` };
                    }
                } else {
                    entity.NewRecord();
                }

                entity.SpaceID = normalizeReceiptUuid(entry.spaceId)!;
                entity.SpaceChatID = cleanChatId;
                entity.ConversationID = cleanConversationId;
                entity.ConversationDetailID = cleanDetailId;
                entity.AgentRunID = cleanRunId;
                entity.SourceKind = entry.sourceKind;
                entity.SpaceItemID = entry.spaceItemId;
                entity.ContentSourceID = entry.contentSourceId;
                entity.TargetEntityID = entry.targetEntityId;
                entity.TargetRecordID = entry.targetRecordId;
                entity.SourceTitle = entry.sourceTitle;
                entity.Band = entry.band;
                entity.WasSupplied = entry.wasSupplied;
                entity.WasCited = entry.wasCited;
                entity.RetrievalRank = entry.retrievalRank;
                entity.RelevanceScore = entry.relevanceScore;
                entity.RankingMode = entry.rankingMode;
                entity.CitationOrdinal = entry.citationOrdinal;
                entity.EstimatedTokens = entry.estimatedTokens;
                entity.WasTruncated = entry.wasTruncated;
                entity.Sequence = entry.sequence;

                const saved = await entity.Save();
                if (!saved || !entity.ID) {
                    return {
                        ok: false,
                        errorMessage: entity.LatestResult?.CompleteMessage ?? 'Failed to save Space Agent Source Receipt row.',
                    };
                }
                savedIds.push(entity.ID);
            }

            return {
                ok: true,
                persistedCount: savedIds.length,
                savedIds,
            };
        }, { spaceChatId: cleanChatId, ...(reachContext ? { reachContext } : {}) });
    } catch (error) {
        return {
            ok: false,
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Queries source receipts for a conversation or assistant detail with strict UUID validation,
 * deterministic keyset pagination (no 500-row truncation), and fail-closed caller `(space, band)` filtering.
 */
export async function querySpaceAgentSourceReceipts(
    params: QuerySpaceAgentSourceReceiptsParams,
): Promise<QuerySpaceAgentSourceReceiptsResult> {
    const cleanConversationId = normalizeReceiptUuid(params.conversationId);
    if (!cleanConversationId || !params.user) {
        return { ok: false, receipts: [], filteredOutCount: 0, errorMessage: 'Invalid conversation or user.' };
    }

    const hasDetailId =
        params.conversationDetailId !== undefined &&
        params.conversationDetailId !== null;
    const cleanDetailId = hasDetailId ? normalizeReceiptUuid(params.conversationDetailId) : null;
    if (hasDetailId && !cleanDetailId) {
        return { ok: false, receipts: [], filteredOutCount: 0, errorMessage: 'Invalid conversationDetailId UUID.' };
    }

    const rv = RunView.FromMetadataProvider(params.provider);
    const chatRes = await rv.RunView<{ ID: string; SpaceID: string; Kind: string; OwnerUserID: string | null }>({
        EntityName: SPACE_CHATS_ENTITY,
        ExtraFilter: `ConversationID = '${cleanConversationId}'`,
        Fields: ['ID', 'SpaceID', 'Kind', 'OwnerUserID'],
        ResultType: 'simple',
        // row-cap-ok: unique ConversationID lookup on SpaceChat returns at most one row
        MaxRows: 2,
    }, params.user);

    const chat = chatRes.Success && chatRes.Results ? chatRes.Results[0] : undefined;
    if (!chat) {
        return {
            ok: false,
            receipts: [],
            filteredOutCount: 0,
            errorMessage: 'SpaceChat not in caller reach.',
        };
    }

    const chatAudience: SourceReceiptBand =
        chat.Kind === 'General' || chat.Kind === 'Topic'
            ? 'Shared'
            : params.callerCanSeeTeam
                ? 'Team'
                : 'Shared';

    const detailClause = cleanDetailId ? ` AND ConversationDetailID = '${cleanDetailId}'` : '';

    let allRows: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[];
    try {
        allRows = await readEveryRow<mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType>(
            rv,
            {
                EntityName: COLLABORATION_SOURCE_RECEIPT_ENTITY,
                ExtraFilter: `ConversationID = '${cleanConversationId}'${detailClause}`,
                Fields: [
                    'ID', 'SpaceID', 'SpaceChatID', 'ConversationID', 'ConversationDetailID',
                    'AgentRunID', 'SourceKind', 'SpaceItemID', 'ContentSourceID',
                    'TargetEntityID', 'TargetRecordID', 'SourceTitle', 'Band',
                    'WasSupplied', 'WasCited', 'RetrievalRank', 'RelevanceScore',
                    'RankingMode', 'CitationOrdinal', 'EstimatedTokens', 'WasTruncated', 'Sequence',
                    '__mj_CreatedAt',
                ],
            },
            params.user,
        );
    } catch (readErr) {
        return {
            ok: false,
            receipts: [],
            filteredOutCount: 0,
            errorMessage: readErr instanceof Error ? readErr.message : String(readErr),
        };
    }

    allRows.sort((a, b) => {
        const detailCmp = (a.ConversationDetailID ?? '').localeCompare(b.ConversationDetailID ?? '');
        if (detailCmp !== 0) return detailCmp;
        const seqA = typeof a.Sequence === 'number' ? a.Sequence : 0;
        const seqB = typeof b.Sequence === 'number' ? b.Sequence : 0;
        if (seqA !== seqB) return seqA - seqB;
        return (a.ID ?? '').localeCompare(b.ID ?? '');
    });

    const reachContext: SourceReceiptReachContext = {
        chatAudience,
        inReachSpaceBands: params.inReachSpaceBands,
    };

    const liveSnapshot: LiveReceiptSourceSnapshot = {};
    const spaceItemIds = [
        ...new Set(
            allRows
                .filter((r) => r.SourceKind === 'SpaceItem')
                .map((r) => normalizeReceiptUuid(r.SpaceItemID))
                .filter((id): id is string => !!id),
        ),
    ];
    if (spaceItemIds.length > 0) {
        const spaceItemsById = new Map<string, { spaceId: string; band: SourceReceiptBand }>();
        for (let offset = 0; offset < spaceItemIds.length; offset += LIVE_CHECK_BATCH_SIZE) {
            const batch = spaceItemIds.slice(offset, offset + LIVE_CHECK_BATCH_SIZE);
            const itemsRes = await rv.RunView<{ ID: string; SpaceID: string; Band: string }>({
                EntityName: SPACE_ITEMS_ENTITY,
                ExtraFilter: `ID IN (${batch.map((id) => `'${id}'`).join(', ')})`,
                Fields: ['ID', 'SpaceID', 'Band'],
                ResultType: 'simple',
                // row-cap-ok: bounded by deduplicated SpaceItemID batch (<= 200)
                MaxRows: LIVE_CHECK_BATCH_SIZE,
            }, params.user);
            if (!itemsRes.Success || !itemsRes.Results) {
                return {
                    ok: false,
                    receipts: [],
                    filteredOutCount: 0,
                    errorMessage: itemsRes.ErrorMessage ?? 'Failed to verify live SpaceItem visibility.',
                };
            }
            for (const row of itemsRes.Results) {
                const id = normalizeReceiptUuid(row.ID);
                const itemSpaceId = normalizeReceiptUuid(row.SpaceID);
                if (id && itemSpaceId && isSourceReceiptBand(row.Band)) {
                    spaceItemsById.set(id, { spaceId: itemSpaceId, band: row.Band });
                }
            }
        }
        liveSnapshot.spaceItemsById = spaceItemsById;
    }

    const knowledgeSpaceIds = [
        ...new Set(
            allRows
                .filter((r) => r.SourceKind === 'KnowledgeSource')
                .map((r) => normalizeReceiptUuid(r.SpaceID))
                .filter((id): id is string => !!id),
        ),
    ];
    if (knowledgeSpaceIds.length > 0) {
        let grantReader = params.user;
        try {
            const resolvedSystem = await WellKnownUserSource.Instance?.GetSystemUser(params.provider);
            if (resolvedSystem) grantReader = resolvedSystem;
        } catch {
            // Fall back to caller user in mocked test providers without WellKnownUserSource initialization
        }

        let spaceNodes: Array<LiveSpaceChainNodeInput & { ID: string }> = [];
        try {
            spaceNodes = await readEveryRow<LiveSpaceChainNodeInput & { ID: string }>(
                rv,
                {
                    EntityName: SPACES_ENTITY,
                    ExtraFilter: '',
                    Fields: ['ID', 'ParentID', 'SpaceTypeID'],
                },
                grantReader,
            );
        } catch (spaceErr) {
            return {
                ok: false,
                receipts: [],
                filteredOutCount: 0,
                errorMessage: spaceErr instanceof Error ? spaceErr.message : String(spaceErr),
            };
        }

        let grantRows: Array<LiveKnowledgeSourceGrantInput & { ID: string }>;
        try {
            grantRows = await readEveryRow<LiveKnowledgeSourceGrantInput & { ID: string }>(
                rv,
                {
                    EntityName: SPACE_GRANTS_ENTITY,
                    ExtraFilter: `Kind = 'KnowledgeSource'`,
                    Fields: ['ID', 'SpaceID', 'SpaceTypeID', 'Kind', 'Mode', 'Band', 'TargetRecordID', 'Sequence'],
                },
                grantReader,
            );
        } catch (grantErr) {
            return {
                ok: false,
                receipts: [],
                filteredOutCount: 0,
                errorMessage: grantErr instanceof Error ? grantErr.message : String(grantErr),
            };
        }

        liveSnapshot.knowledgeSourceBandsBySpace = resolveEffectiveKnowledgeSourceBandsBySpace({
            spaceIds: knowledgeSpaceIds,
            spaces: spaceNodes,
            grants: grantRows,
        });
    }

    const allowed: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[] = [];
    let filteredOutCount = 0;

    for (const row of allRows) {
        const band = row.Band === 'Team' ? 'Team' : row.Band === 'Shared' ? 'Shared' : null;
        if (
            !band ||
            !canReaderAccessSourceReceipt({ spaceId: row.SpaceID, band }, reachContext) ||
            !isReceiptAuthorizedByLiveSources(
                {
                    spaceId: row.SpaceID,
                    sourceKind: row.SourceKind,
                    spaceItemId: row.SpaceItemID,
                    contentSourceId: row.ContentSourceID,
                    band,
                },
                liveSnapshot,
            )
        ) {
            filteredOutCount += 1;
            continue;
        }
        allowed.push(row);
    }

    return {
        ok: true,
        receipts: allowed,
        filteredOutCount,
    };
}
