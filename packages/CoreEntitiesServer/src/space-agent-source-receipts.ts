/**
 * Server persistence & fail-closed query service for relational Space Agent Source Receipts (CT-2).
 */

import { type IMetadataProvider, LogError, RunView, type UserInfo } from '@memberjunction/core';
import {
    canReaderAccessSourceReceipt,
    type EffectiveGrant,
    normalizeReceiptId,
    normalizeReceiptUuid,
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

const CONTENT_SOURCES_ENTITY = 'MJ: Content Sources';
const SPACE_CHATS_ENTITY = 'MJ_BizApps_Collaboration: Space Chats';

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
 * Resolves the granted in-reach knowledge sources into validated receipt candidates bounded
 * strictly by `chatAudience`.
 */
export async function resolveSuppliedKnowledgeSources(
    provider: IMetadataProvider,
    systemUser: UserInfo,
    spaceId: string,
    knowledgeGrants: readonly EffectiveGrant[],
    knowledgeSourceIdsInForce: readonly string[],
    chatAudience: SourceReceiptBand,
): Promise<ValidatedSuppliedSourceCandidate[]> {
    const cleanSpaceId = normalizeReceiptUuid(spaceId);
    if (!cleanSpaceId || knowledgeSourceIdsInForce.length === 0) {
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

function receiptNaturalKey(entry: {
    sourceKind: string;
    spaceItemId: string | null;
    contentSourceId: string | null;
}): string | null {
    if (entry.sourceKind === 'SpaceItem') {
        const id = normalizeReceiptId(entry.spaceItemId);
        return id ? `SpaceItem:${id}` : null;
    }
    const id = normalizeReceiptId(entry.contentSourceId);
    return id ? `KnowledgeSource:${id}` : null;
}

/**
 * Idempotently persists validated source receipts for an assistant message detail row.
 * Retries against the same `ConversationDetailID` update existing rows in place instead of
 * creating duplicates.
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
    } = params;

    if (receipts.length === 0) {
        return { ok: true, persistedCount: 0, savedIds: [] };
    }

    const cleanChatId = normalizeReceiptId(spaceChatId);
    const cleanConversationId = normalizeReceiptId(conversationId);
    const cleanDetailId = normalizeReceiptId(conversationDetailId);
    const cleanRunId = normalizeReceiptId(agentRunId);

    if (!cleanChatId || !cleanConversationId || !cleanDetailId) {
        return {
            ok: false,
            errorMessage: 'Cannot persist source receipts without valid SpaceChatID, ConversationID, and ConversationDetailID.',
        };
    }

    try {
        return await runWithCollaborationAgentTurnAuthority(turnUserId, async () => {
            const rv = RunView.FromMetadataProvider(provider);
            const existingRes = await rv.RunView<{
                ID: string;
                SourceKind: string;
                SpaceItemID: string | null;
                ContentSourceID: string | null;
            }>({
                EntityName: COLLABORATION_SOURCE_RECEIPT_ENTITY,
                ExtraFilter: `ConversationDetailID = '${cleanDetailId}'`,
                Fields: ['ID', 'SourceKind', 'SpaceItemID', 'ContentSourceID'],
                ResultType: 'simple',
                // row-cap-ok: bounded by per-turn top-k retrieval plus granted knowledge sources on one message
                MaxRows: 500,
            }, systemUser);

            if (!existingRes.Success) {
                return {
                    ok: false,
                    errorMessage: existingRes.ErrorMessage ?? 'Failed to inspect existing source receipts prior to persistence.',
                };
            }

            const existingIdByKey = new Map<string, string>();
            for (const row of existingRes.Results ?? []) {
                const key = receiptNaturalKey({
                    sourceKind: row.SourceKind,
                    spaceItemId: row.SpaceItemID,
                    contentSourceId: row.ContentSourceID,
                });
                const cleanExistingId = normalizeReceiptId(row.ID);
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

                entity.SpaceID = entry.spaceId;
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
        });
    } catch (error) {
        return {
            ok: false,
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Queries source receipts for a conversation or assistant detail with strict fail-closed
 * caller `(space, band)` filtering layered on top of MJ's entity RLS.
 */
export async function querySpaceAgentSourceReceipts(
    params: QuerySpaceAgentSourceReceiptsParams,
): Promise<QuerySpaceAgentSourceReceiptsResult> {
    const cleanConversationId = normalizeReceiptUuid(params.conversationId);
    if (!cleanConversationId || !params.user) {
        return { ok: false, receipts: [], filteredOutCount: 0, errorMessage: 'Invalid conversation or user.' };
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

    const cleanDetailId = normalizeReceiptUuid(params.conversationDetailId);
    const detailClause = cleanDetailId ? ` AND ConversationDetailID = '${cleanDetailId}'` : '';

    const receiptRes = await rv.RunView<mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType>({
        EntityName: COLLABORATION_SOURCE_RECEIPT_ENTITY,
        ExtraFilter: `ConversationID = '${cleanConversationId}'${detailClause}`,
        OrderBy: 'Sequence ASC, __mj_CreatedAt ASC',
        ResultType: 'simple',
        // row-cap-ok: bounded by conversation message receipt window queried for turn display/audit
        MaxRows: 500,
    }, params.user);

    if (!receiptRes.Success || !receiptRes.Results) {
        return {
            ok: false,
            receipts: [],
            filteredOutCount: 0,
            errorMessage: receiptRes.ErrorMessage ?? 'Failed to query source receipts.',
        };
    }

    const reachContext: SourceReceiptReachContext = {
        chatAudience,
        inReachSpaceBands: params.inReachSpaceBands,
    };

    const allowed: mjBizAppsCollaborationSpaceAgentSourceReceiptEntityType[] = [];
    let filteredOutCount = 0;

    for (const row of receiptRes.Results) {
        const band = row.Band === 'Team' ? 'Team' : row.Band === 'Shared' ? 'Shared' : null;
        if (!band || !canReaderAccessSourceReceipt({ spaceId: row.SpaceID, band }, reachContext)) {
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
