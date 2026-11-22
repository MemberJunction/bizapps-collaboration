import { BaseEntity, LogError, RunView, type IMetadataProvider, type RunViewParams, type UserInfo } from '@memberjunction/core';
import { UUIDMap, UUIDSet, UUIDsEqual } from '@memberjunction/global';
import {
    agentMayQuote,
    agentMayQuoteCandidate,
    audienceOfConversationKind,
    effectiveRetrievalScope,
    membershipReaches,
    seatSpacesForSubtree,
    spaceAllowsAgentRetrieval,
    type Band,
    type MemberSnapshot,
    type PrincipalReach,
    type RoleFlags,
    type ScopeNarrowing,
    type SpaceNode,
} from '@mj-biz-apps/collaboration-core';
import { IsPeopleEntity } from '@mj-biz-apps/common-entities';
import type { mjBizAppsTasksTaskAssignmentEntity, mjBizAppsTasksTaskEntity } from '@mj-biz-apps/tasks-entities';
import { requireSystemUser, toNode, type SpaceRow } from './load-graph.js';
import { EVERY_ROW_PAGE_SIZE, readEveryRow } from './read-every-row.js';
import {
    applyContextTokenBudget,
    clampContextTokenBudget,
    clampRetrievalTopK,
    clampTokensPerSource,
    DEFAULT_MAX_CONTEXT_TOKENS,
    DEFAULT_MAX_TOKENS_PER_SOURCE,
    DEFAULT_RETRIEVAL_TOP_K,
    resolveActiveVectorSearchAdapter,
    scoreItemsLexically,
    type RankableSpaceItem,
    type RankedCandidateOutcome,
    type RetrievalRankingMode,
    type SpaceAgentRetrievalStats,
    type SpaceAgentSuppliedSource,
    type SpaceAgentVectorSearchAdapter,
} from './space-agent-retrieval-ranking.js';
import { parseUuid } from './uuid.js';

export {
    applyContextTokenBudget,
    clampContextTokenBudget,
    clampRetrievalTopK,
    clampTokensPerSource,
    DEFAULT_MAX_CONTEXT_TOKENS,
    DEFAULT_MAX_TOKENS_PER_SOURCE,
    DEFAULT_RETRIEVAL_TOP_K,
    estimateCandidateItemTokens,
    estimateTokenCount,
    getHostVectorSearchAdapter,
    MAX_CONTEXT_TOKENS_CEILING,
    MAX_RETRIEVAL_TOP_K,
    MAX_TOKENS_PER_SOURCE_CEILING,
    scoreItemsLexically,
    setHostVectorSearchAdapter,
    stripMentionMarkup,
    tokenizeForSearch,
    type RetrievalRankingMode,
    type SpaceAgentRetrievalStats,
    type SpaceAgentSuppliedSource,
    type SpaceAgentVectorHit,
    type SpaceAgentVectorSearchAdapter,
    type SpaceAgentVectorSearchQuery,
} from './space-agent-retrieval-ranking.js';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const ROLES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';
const ITEMS_ENTITY = 'MJ_BizApps_Collaboration: Space Items';
const FILES_ENTITY = 'MJ: Files';
const USERS_ENTITY = 'MJ: Users';
const PEOPLE_ENTITY = 'MJ_BizApps_Common: People';
const TASKS_ENTITY = 'MJ_BizApps_Tasks: Tasks';
const TASK_ASSIGNMENTS_ENTITY = 'MJ_BizApps_Tasks: Task Assignments';

/** Maximum number of explicit IDs included in a single SQL `IN (...)` batch. */
const ID_LOOKUP_BATCH_SIZE = 500;
/** Maximum concurrent views sent in a single `RunViews` round trip. */
const RUN_VIEWS_BATCH_CONCURRENCY = 10;
/** Small-space threshold below which full chunk/assignee enrichment and full refusal audit decisions are loaded eagerly. */
const SMALL_SPACE_FULL_ENRICHMENT_LIMIT = 1000;
const SMALL_SPACE_AUDIT_LIMIT = 200;
const MAX_LARGE_SPACE_REFUSAL_DECISIONS = 50;

export interface SpaceAgentCandidateItem {
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    EntityName?: string | null;
    Name: string;
    Description: string | null;
    Band: Band;
    StoredContentType: string | null;
    Status?: mjBizAppsTasksTaskEntity['Status'] | null;
    Priority?: mjBizAppsTasksTaskEntity['Priority'] | null;
    DueAt?: string | null;
    PercentComplete?: number | null;
    Assignees?: string[];
    ChunkTexts?: string[];
}

export interface SpaceAgentRetrievalDecision {
    item: SpaceAgentCandidateItem;
    allowed: boolean;
    reason: string;
}

export type RetrievalScopeNarrowing = ScopeNarrowing | 'Subtree';

export interface SpaceAgentRetrievalOptions {
    /** Deprecated legacy cap; ignored as a refusal ceiling because items are now paged and top-k ranked. */
    maxRows?: number;
    /** Explicit filter + relevance ranking query (only matching in-scope items are returned). */
    query?: string;
    /** Conversational relevance query (ranks all in-scope items without discarding unmatched items when filling top-k). */
    rankingQuery?: string;
    /** Maximum number of top-ranked items to supply (clamped to `[1, MAX_RETRIEVAL_TOP_K]`). */
    topK?: number;
    /** Maximum prompt tokens allowed per supplied source (clamped to server ceiling). */
    maxTokensPerSource?: number;
    /** Maximum aggregate prompt tokens allowed across all supplied sources (clamped to server ceiling). */
    maxContextTokens?: number;
    /** Optional explicit vector search adapter (overrides host auto-detection). */
    vectorSearch?: SpaceAgentVectorSearchAdapter;
    /**
     * Explicit user IDs in the conversation's audience (B2.3). When provided (or when `conversationKind`
     * is provided), retrieval is bounded to the intersection of what every audience member may reach and see.
     */
    audienceUserIds?: readonly string[];
    participantUserIds?: readonly string[];
    /**
     * Conversation kind (`'General'`, `'Topic'`, `'Private'`, `'Assistant'`). When provided without `audienceUserIds`,
     * the room's audience is everyone with an Active seat that reaches the asked space (or `[callerId]` for `'Assistant'`),
     * read from the seats on that space and on the ancestors it inherits from, and `'General'`/`'Topic'`
     * further bound the allowed band to `'Shared'`.
     */
    conversationKind?: string;
    narrowing?: RetrievalScopeNarrowing;
    /**
     * The seats asked for per round trip (`EVERY_ROW_PAGE_SIZE` when absent). The seats are read to their end at any size, so
     * the result does not depend on it; a test sets it small to walk several pages.
     */
    rosterPageSize?: number;
    /** Optional page size for keyset-paged `Space Items` reads (`EVERY_ROW_PAGE_SIZE` when absent). */
    itemsPageSize?: number;
}

export interface SpaceAgentRetrievalResult {
    spaceId: string;
    askingUserId: string;
    callerCanSeeTeam: boolean;
    audienceUserIds: string[];
    searchedSpaceIds: string[];
    allowedBandsBySpace?: Readonly<Record<string, Band>>;
    candidateItems: SpaceAgentCandidateItem[];
    quotedItems: SpaceAgentCandidateItem[];
    decisions: SpaceAgentRetrievalDecision[];
    suppliedSources?: SpaceAgentSuppliedSource[];
    stats?: SpaceAgentRetrievalStats;
}

interface MemberRow {
    ID?: string | null;
    SpaceID: string;
    UserID: string;
    Status: string;
    Band: string;
    SpaceRoleTypeID: string;
}

interface RoleRow {
    ID: string;
    Level: number;
    MaxGrantableLevel: number;
    CanInvite: boolean;
    CanPromoteBand: boolean;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
    CanContribute: boolean;
}

interface SpaceItemRow {
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Band: Band;
}

interface TargetMetadata {
    name: string;
    description: string | null;
    contentType: string | null;
    status: mjBizAppsTasksTaskEntity['Status'] | null;
    priority: mjBizAppsTasksTaskEntity['Priority'] | null;
    dueAt: string | null;
    percentComplete: number | null;
}

interface TargetLookupRow {
    ID: string;
    Name?: string | null;
    Description?: string | null;
    ContentType?: string | null;
    Status?: mjBizAppsTasksTaskEntity['Status'] | null;
    Priority?: mjBizAppsTasksTaskEntity['Priority'] | null;
    DueAt?: Date | string | null;
    PercentComplete?: number | null;
}

interface PreFilteredSpaceItem {
    raw: SpaceItemRow;
    originalIndex: number;
    entityId: string;
    entityName: string | undefined;
    cleanTargetRecordId: string | null;
    targetKey: string;
    itemSpaceId: string;
    allowed: boolean;
    reason: string;
}

function cleanRecordId(raw: string): string {
    const s = String(raw).trim();
    if (s.toLowerCase().startsWith('id|')) return s.slice(3).trim();
    return s;
}

function formatIsoDate(raw: Date | string | null | undefined): string | null {
    if (raw == null) return null;
    if (raw instanceof Date) {
        return Number.isNaN(raw.getTime()) ? null : raw.toISOString().slice(0, 10);
    }
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function isAncestorOrSelf(index: Map<string, SpaceNode>, ancestorId: string, nodeId: string): boolean {
    let current = index.get(nodeId.toLowerCase());
    const seen = new Set<string>();
    while (current && !seen.has(current.id.toLowerCase())) {
        if (current.id.toLowerCase() === ancestorId.toLowerCase()) {
            return true;
        }
        seen.add(current.id.toLowerCase());
        current = current.parentId ? index.get(current.parentId.toLowerCase()) : undefined;
    }
    return false;
}

function getReachableSubtreeSpaceIds(
    spaces: readonly SpaceNode[],
    askedFromSpaceId: string,
): string[] {
    const index = new Map<string, SpaceNode>();
    for (const s of spaces) {
        index.set(s.id.toLowerCase(), s);
    }
    const cleanAsked = askedFromSpaceId.toLowerCase();
    const candidateIds: string[] = [];

    for (const s of spaces) {
        const sid = s.id.toLowerCase();
        // Item space must have askedFromSpaceId as an ancestor or self
        if (!isAncestorOrSelf(index, cleanAsked, sid)) {
            continue;
        }
        // A status that allows no agent retrieval (Archived) keeps the space out
        if (!spaceAllowsAgentRetrieval(s)) {
            continue;
        }
        // Check ExcludedEntirely up to root
        let current: SpaceNode | undefined = s;
        let excludedEntirely = false;
        const seen = new Set<string>();
        while (current && !seen.has(current.id.toLowerCase())) {
            if (current.agentRetrieval === 'ExcludedEntirely') {
                excludedEntirely = true;
                break;
            }
            seen.add(current.id.toLowerCase());
            current = current.parentId ? index.get(current.parentId.toLowerCase()) : undefined;
        }
        if (excludedEntirely) continue;

        // Check ExcludedFromParentScope between s and cleanAsked
        current = s;
        let excludedFromParent = false;
        const between = new Set<string>();
        while (current && current.id.toLowerCase() !== cleanAsked && !between.has(current.id.toLowerCase())) {
            if (current.agentRetrieval === 'ExcludedFromParentScope') {
                excludedFromParent = true;
                break;
            }
            between.add(current.id.toLowerCase());
            current = current.parentId ? index.get(current.parentId.toLowerCase()) : undefined;
        }
        if (excludedFromParent) continue;

        candidateIds.push(s.id);
    }
    return candidateIds;
}

/** The most space ids one seat or item read names; a larger tree is read in several. */
const SEAT_SPACES_PER_READ = 200;

/** What a refused retrieval tells its caller. The cause goes to the log. */
const AUDIENCE_UNREADABLE = 'Refusing retrieval: the spaces, roles or seats could not be read, so the audience would be incomplete.';

/**
 * The space tree and the role flags, as the system user. A failed read is refused, not answered with less: a caller that
 * went on without them would bound the agent by the asker alone, which is wider than the room.
 */
async function loadSpacesAndRoles(rvSystem: RunView, system: UserInfo): Promise<{ spaceNodes: SpaceNode[]; roleMap: Map<string, RoleFlags> }> {
    const [spacesRes, rolesRes] = await rvSystem.RunViews([
        {
            EntityName: SPACES_ENTITY,
            Fields: ['ID', 'ParentID', 'InheritsMembership', 'OwnerID', 'AgentRetrieval', 'AllowParentAssignees', 'ClosedAt', 'StatusID', 'SpaceTypeID'],
            MaxRows: 2000, // row-cap-ok: refuses on a full page
            ResultType: 'simple',
        },
        {
            EntityName: ROLES_ENTITY,
            Fields: ['ID', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole', 'CanContribute'],
            MaxRows: 200, // row-cap-ok: refuses on a full page
            ResultType: 'simple',
        },
    ], system);
    if (!spacesRes?.Success || !rolesRes?.Success) {
        LogError(`resolveSpaceAgentRetrieval failed to load space context: ${spacesRes?.ErrorMessage || rolesRes?.ErrorMessage || 'no result'}`);
        throw new Error(AUDIENCE_UNREADABLE);
    }
    if ((spacesRes.Results?.length ?? 0) >= 2000) {
        throw new Error('Refusing retrieval: spaces page came back full, so the check would be incomplete.');
    }
    if ((rolesRes.Results?.length ?? 0) >= 200) {
        throw new Error('Refusing retrieval: roles page came back full, so the check would be incomplete.');
    }
    const roleMap = new Map<string, RoleFlags>();
    for (const r of (rolesRes.Results as RoleRow[] ?? [])) {
        const id = parseUuid(r.ID) ?? r.ID;
        roleMap.set(id.toLowerCase(), {
            level: Number(r.Level),
            maxGrantableLevel: Number(r.MaxGrantableLevel),
            canInvite: !!r.CanInvite,
            canPromoteBand: !!r.CanPromoteBand,
            canSeeTeamBand: !!r.CanSeeTeamBand,
            isOwnerRole: !!r.IsOwnerRole,
            canContribute: !!r.CanContribute,
        });
    }
    return { spaceNodes: (spacesRes.Results as SpaceRow[] ?? []).map(toNode), roleMap };
}

/**
 * The seat reads a room's roster needs: the Active seats on the asked space, on the ancestors it inherits membership from and
 * on the spaces below it (`seatSpacesForSubtree`), and the asker's own seats wherever they are, which decide what the asker
 * reaches when nobody else is in the audience.
 */
function rosterSeatFilters(spaceNodes: readonly SpaceNode[], spaceId: string, callerId: string): string[] {
    const filters = [`UserID = '${callerId}' AND Status = 'Active'`];
    const seatSpaceIds = seatSpacesForSubtree(spaceNodes, spaceId)
        .map((id) => parseUuid(id))
        .filter((id): id is string => !!id);
    for (let start = 0; start < seatSpaceIds.length; start += SEAT_SPACES_PER_READ) {
        const inClause = seatSpaceIds.slice(start, start + SEAT_SPACES_PER_READ).map((id) => `'${id}'`).join(', ');
        filters.push(`SpaceID IN (${inClause}) AND Status = 'Active'`);
    }
    return filters;
}

/**
 * Builds SQL `ExtraFilter` predicates strictly scoped to the allowed `(space, band)` pairs so out-of-band items
 * in Shared-only spaces are rejected at the database boundary before any candidate enters ranking.
 */
function buildSpaceBandFilters(searchedSpaceIds: readonly string[], spaceBands: ReadonlyMap<string, Band>): string[] {
    const teamSpaceIds: string[] = [];
    const sharedOnlySpaceIds: string[] = [];

    for (const rawId of searchedSpaceIds) {
        const cleanId = parseUuid(rawId);
        if (!cleanId) continue;
        const band = spaceBands.get(cleanId.toLowerCase());
        if (band === 'Team') {
            teamSpaceIds.push(cleanId);
        } else {
            sharedOnlySpaceIds.push(cleanId);
        }
    }

    const filters: string[] = [];
    for (let start = 0; start < teamSpaceIds.length; start += SEAT_SPACES_PER_READ) {
        const inClause = teamSpaceIds.slice(start, start + SEAT_SPACES_PER_READ).map((id) => `'${id}'`).join(',');
        filters.push(`SpaceID IN (${inClause})`);
    }
    for (let start = 0; start < sharedOnlySpaceIds.length; start += SEAT_SPACES_PER_READ) {
        const inClause = sharedOnlySpaceIds.slice(start, start + SEAT_SPACES_PER_READ).map((id) => `'${id}'`).join(',');
        filters.push(`SpaceID IN (${inClause}) AND Band = 'Shared'`);
    }
    return filters;
}

/**
 * Every seat the filters match, as the system user, each read to its end (`readEveryRow`). A failed read, and a seat whose
 * role was not among the roles read, are refused: either would drop a person from the audience and so widen what the
 * agent may use.
 */
async function loadSeats(
    rvSystem: RunView,
    system: UserInfo,
    filters: readonly string[],
    roleMap: ReadonlyMap<string, RoleFlags>,
    pageSize: number | undefined,
): Promise<MemberSnapshot[]> {
    let pages: MemberRow[][];
    try {
        pages = await Promise.all(filters.map((filter) => readEveryRow<MemberRow>(
            rvSystem,
            { EntityName: MEMBERS_ENTITY, ExtraFilter: filter, Fields: ['ID', 'SpaceID', 'UserID', 'Status', 'Band', 'SpaceRoleTypeID'] },
            system,
            pageSize,
        )));
    } catch (error) {
        LogError(`resolveSpaceAgentRetrieval failed to load the seats: ${error instanceof Error ? error.message : String(error)}`);
        throw new Error(AUDIENCE_UNREADABLE);
    }
    const snapshots: MemberSnapshot[] = [];
    const taken = new Set<string>();
    for (const m of pages.flat()) {
        // The asker's seats on the asked spaces come back from two of the reads
        const seatId = parseUuid(m.ID);
        if (seatId && taken.has(seatId)) continue;
        if (seatId) taken.add(seatId);
        const flags = roleMap.get((parseUuid(m.SpaceRoleTypeID) ?? m.SpaceRoleTypeID).toLowerCase());
        if (!flags) {
            LogError(`resolveSpaceAgentRetrieval: seat ${m.ID ?? '(no id)'} names role ${m.SpaceRoleTypeID}, which was not among the roles read`);
            throw new Error(AUDIENCE_UNREADABLE);
        }
        snapshots.push({
            spaceId: parseUuid(m.SpaceID) ?? m.SpaceID,
            userId: parseUuid(m.UserID) ?? m.UserID,
            status: m.Status as MemberSnapshot['status'],
            band: m.Band as Band,
            role: flags,
        });
    }
    return snapshots;
}

/**
 * Loads target record metadata (`Name`, `Description`, `ContentType`, task fields) in bounded batches of `ID_LOOKUP_BATCH_SIZE`.
 */
async function loadTargetMetadataMap(
    provider: IMetadataProvider,
    rvUser: RunView,
    user: UserInfo,
    rows: readonly PreFilteredSpaceItem[],
): Promise<Map<string, TargetMetadata>> {
    const targetNames = new Map<string, TargetMetadata>();
    if (rows.length === 0) return targetNames;

    const recordIdsByEntity = new Map<string, Set<string>>();
    const entityNameById = new Map<string, string>();
    for (const row of rows) {
        if (!row.cleanTargetRecordId || !row.entityName) continue;
        entityNameById.set(row.entityId, row.entityName);
        let set = recordIdsByEntity.get(row.entityId);
        if (!set) {
            set = new Set<string>();
            recordIdsByEntity.set(row.entityId, set);
        }
        set.add(row.cleanTargetRecordId);
    }

    const viewParams: RunViewParams[] = [];
    const viewEntityIds: string[] = [];

    for (const [entityId, recIdSet] of recordIdsByEntity.entries()) {
        const entityName = entityNameById.get(entityId);
        if (!entityName) continue;
        const fields =
            entityName === FILES_ENTITY
                ? ['ID', 'Name', 'Description', 'ContentType']
                : entityName === TASKS_ENTITY
                    ? ['ID', 'Name', 'Description', 'Status', 'Priority', 'DueAt', 'PercentComplete']
                    : ['ID', 'Name', 'Description'];

        const recIds = Array.from(recIdSet);
        for (let start = 0; start < recIds.length; start += ID_LOOKUP_BATCH_SIZE) {
            const batch = recIds.slice(start, start + ID_LOOKUP_BATCH_SIZE);
            const targetInClause = batch.map((id) => `'${id}'`).join(',');
            viewParams.push({
                EntityName: entityName,
                ExtraFilter: `ID IN (${targetInClause})`,
                Fields: fields,
                // row-cap-ok: bounded batch lookup by <= 500 explicit IDs
                MaxRows: ID_LOOKUP_BATCH_SIZE,
                ResultType: 'simple',
            });
            viewEntityIds.push(entityId);
        }
    }

    for (let start = 0; start < viewParams.length; start += RUN_VIEWS_BATCH_CONCURRENCY) {
        const batchParams = viewParams.slice(start, start + RUN_VIEWS_BATCH_CONCURRENCY);
        const batchEntityIds = viewEntityIds.slice(start, start + RUN_VIEWS_BATCH_CONCURRENCY);
        try {
            const batchResults = await rvUser.RunViews(batchParams, user);
            for (let i = 0; i < batchResults.length; i++) {
                const res = batchResults[i];
                const entityId = batchEntityIds[i];
                if (res?.Success && res.Results) {
                    for (const t of res.Results as TargetLookupRow[]) {
                        const id = (parseUuid(t.ID) ?? t.ID).toLowerCase();
                        const rawName = t.Name ?? 'Unnamed item';
                        const cleanName = typeof rawName === 'string' ? rawName.replace(/\s+/g, ' ').trim() || 'Unnamed item' : 'Unnamed item';
                        const rawDesc = t.Description ?? null;
                        const cleanDesc = typeof rawDesc === 'string' ? rawDesc.replace(/\s+/g, ' ').trim() || null : null;
                        targetNames.set(`${entityId}:${id}`, {
                            name: cleanName,
                            description: cleanDesc,
                            contentType: t.ContentType ?? null,
                            status: t.Status ?? null,
                            priority: t.Priority ?? null,
                            dueAt: formatIsoDate(t.DueAt),
                            percentComplete: typeof t.PercentComplete === 'number' ? t.PercentComplete : null,
                        });
                    }
                } else if (res && !res.Success) {
                    LogError(`Failed to lookup target names for entity ${batchParams[i].EntityName}: ${res.ErrorMessage}`);
                }
            }
        } catch (err) {
            LogError(`resolveSpaceAgentRetrieval batch target lookup failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return targetNames;
}

function buildCandidateItem(
    entry: PreFilteredSpaceItem,
    target: TargetMetadata | undefined,
    chunkTexts: string[] | undefined,
    assignees: string[] | undefined,
    includeEnrichment: boolean,
): SpaceAgentCandidateItem {
    const item: SpaceAgentCandidateItem = {
        ID: entry.raw.ID,
        SpaceID: entry.raw.SpaceID,
        EntityID: entry.raw.EntityID,
        RecordID: entry.raw.RecordID,
        ...(entry.entityName ? { EntityName: entry.entityName } : {}),
        Name: target?.name ?? `Item ${entry.raw.ID}`,
        Description: target?.description ?? null,
        Band: entry.raw.Band,
        StoredContentType: target?.contentType ?? null,
    };
    if (includeEnrichment && entry.entityName === TASKS_ENTITY) {
        item.Status = target?.status ?? null;
        item.Priority = target?.priority ?? null;
        item.DueAt = target?.dueAt ?? null;
        item.PercentComplete = target?.percentComplete ?? null;
        item.Assignees = assignees ?? [];
    }
    if (includeEnrichment && chunkTexts && chunkTexts.length > 0) {
        item.ChunkTexts = chunkTexts;
    }
    return item;
}

function matchesExplicitQuery(item: SpaceAgentCandidateItem, queryLower: string): boolean {
    if (item.Name.toLowerCase().includes(queryLower)) return true;
    if (item.Description && item.Description.toLowerCase().includes(queryLower)) return true;
    if (item.ChunkTexts && item.ChunkTexts.some((t) => t.toLowerCase().includes(queryLower))) return true;
    if (item.Status && item.Status.toLowerCase().includes(queryLower)) return true;
    if (item.Assignees && item.Assignees.some((a) => a.toLowerCase().includes(queryLower))) return true;
    return false;
}

function emptyResult(spaceId: string, askingUserId: string, audienceUserIds: string[] = [], searchedSpaceIds: string[] = []): SpaceAgentRetrievalResult {
    return {
        spaceId,
        askingUserId,
        callerCanSeeTeam: false,
        audienceUserIds,
        searchedSpaceIds,
        candidateItems: [],
        quotedItems: [],
        decisions: [],
        suppliedSources: [],
        stats: {
            topKRequested: DEFAULT_RETRIEVAL_TOP_K,
            topKApplied: DEFAULT_RETRIEVAL_TOP_K,
            maxTokensPerSource: DEFAULT_MAX_TOKENS_PER_SOURCE,
            maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
            totalInScopeCount: 0,
            totalExcludedCount: 0,
            suppliedCount: 0,
            estimatedContextTokens: 0,
            rankingMode: 'none',
            vectorSearchUsed: false,
            durationMs: 0,
        },
    };
}

/**
 * Resolves bounded, relevance-ranked materials that the Collaboration Space Agent is permitted to quote
 * for a specific user (and optional room audience) asking from a specific space.
 *
 * Rules enforced:
 * 1. User must reach the space where the question is asked.
 * 2. Determines candidate subtree spaces (filtering out parent/sibling spaces and excluded scopes in SQL),
 *    intersected across all participants in the room's audience when `audienceUserIds` or `conversationKind` is given (B2.3).
 * 3. Pre-filters `Space Items` strictly by `(SpaceID, Band)` reach via keyset-paged `readEveryRow` (no 2,000-item refusal)
 *    and evaluates `agentMayQuote` / `agentMayQuoteCandidate` BEFORE any vector query or relevance scoring.
 * 4. Ranks only in-scope items using vector similarity when a host vector index/service is configured, falling back
 *    automatically to deterministic BM25 lexical ranking over title, summary, chunk text, and task fields.
 * 5. Enforces server-bounded `topK`, per-source token cap, and aggregate context token ceiling (`O(k)` prompt budget)
 *    and emits structured `suppliedSources` and `stats` metadata.
 *
 * Throws (`"Refusing retrieval: ..."`) when the spaces, roles or seats cannot be read.
 */
export async function resolveSpaceAgentRetrieval(
    provider: IMetadataProvider,
    user: UserInfo,
    spaceId: string,
    options?: SpaceAgentRetrievalOptions,
): Promise<SpaceAgentRetrievalResult> {
    const startMs = Date.now();
    const cleanSpaceId = parseUuid(spaceId);
    const cleanUserId = parseUuid(user?.ID);

    if (!cleanSpaceId || !cleanUserId) {
        return emptyResult(spaceId ?? '', user?.ID ?? '');
    }

    const rawAudienceIds = options?.audienceUserIds ?? options?.participantUserIds;
    const explicitAudienceIds: string[] = [cleanUserId];
    if (rawAudienceIds?.length) {
        const seen = new Set<string>([cleanUserId.toLowerCase()]);
        for (const rawId of rawAudienceIds) {
            const uid = parseUuid(rawId);
            if (uid && !seen.has(uid.toLowerCase())) {
                seen.add(uid.toLowerCase());
                explicitAudienceIds.push(uid);
            }
        }
    }

    const isAssistantChat = (options?.conversationKind ?? '').trim().toLowerCase() === 'assistant';
    const loadRoomRoster = !!options?.conversationKind && !isAssistantChat && !rawAudienceIds?.length;

    // Load space hierarchy and role definitions as system user so full topological metadata is available
    const probe = await provider.GetEntityObject<BaseEntity>(SPACES_ENTITY, user);
    const system = await requireSystemUser(probe);
    const rvSystem = RunView.FromMetadataProvider(provider);
    const { spaceNodes, roleMap } = await loadSpacesAndRoles(rvSystem, system);

    // The seats that decide the audience and what each of its people reaches.
    const seatFilters = loadRoomRoster
        ? rosterSeatFilters(spaceNodes, cleanSpaceId, cleanUserId)
        : explicitAudienceIds.map((uid) => `UserID = '${uid}' AND Status = 'Active'`);
    const memberSnapshots = await loadSeats(rvSystem, system, seatFilters, roleMap, options?.rosterPageSize);

    // Determine caller's reaching role in the asked space
    const reach = membershipReaches(spaceNodes, memberSnapshots, cleanUserId, cleanSpaceId);
    if (!reach) {
        return emptyResult(cleanSpaceId, cleanUserId);
    }

    const callerCanSeeTeam = reach.role.canSeeTeamBand;
    const roomBand = options?.conversationKind && !isAssistantChat ? audienceOfConversationKind(options.conversationKind) : null;

    let principalIds: string[];
    if (rawAudienceIds?.length) {
        principalIds = explicitAudienceIds;
    } else if (loadRoomRoster) {
        const seen = new Set<string>([cleanUserId.toLowerCase()]);
        principalIds = [cleanUserId];
        const candidateUsers = new Set<string>(memberSnapshots.map((m) => m.userId));
        for (const uid of candidateUsers) {
            if (seen.has(uid.toLowerCase())) continue;
            const memberReach = membershipReaches(spaceNodes, memberSnapshots, uid, cleanSpaceId);
            if (!memberReach) continue;
            if (roomBand === 'Team' && !memberReach.role.canSeeTeamBand) continue;
            seen.add(uid.toLowerCase());
            principalIds.push(uid);
        }
    } else {
        principalIds = [cleanUserId];
    }

    const principalReaches: PrincipalReach[] = principalIds.map((uid) => {
        const reachableSpaceIds: string[] = [];
        const canSeeTeamSpaceIds: string[] = [];
        for (const s of spaceNodes) {
            const r = membershipReaches(spaceNodes, memberSnapshots, uid, s.id);
            if (r) {
                reachableSpaceIds.push(s.id);
                if (r.role.canSeeTeamBand) {
                    canSeeTeamSpaceIds.push(s.id);
                }
            }
        }
        return {
            userId: uid,
            reachableSpaceIds,
            canSeeTeamSpaceIds,
            isInternalOrg: true,
        };
    });

    const requestedNarrowing: ScopeNarrowing =
        options?.narrowing === 'Subtree'
            ? 'ThisSpaceAndSubspaces'
            : (options?.narrowing ?? 'ThisSpaceAndSubspaces');
    const effectiveNarrowing: ScopeNarrowing =
        requestedNarrowing === 'Everything' && principalIds.length === 1
            ? 'Everything'
            : requestedNarrowing === 'ThisSpace'
                ? 'ThisSpace'
                : 'ThisSpaceAndSubspaces';

    const scope = effectiveRetrievalScope({
        audience: {
            principals: principalIds,
            mode: principalIds.length > 1 ? 'Intersection' : 'Caller',
            anchorSpaceId: cleanSpaceId,
            narrowing: effectiveNarrowing,
        },
        spaces: spaceNodes,
        principalReaches,
    });
    if (roomBand === 'Shared') {
        scope.allowedBand = 'Shared';
        for (const key of scope.spaceBands.keys()) {
            scope.spaceBands.set(key, 'Shared');
        }
    }

    const candidateSpacePool =
        effectiveNarrowing === 'Everything'
            ? spaceNodes.map((s) => s.id)
            : getReachableSubtreeSpaceIds(spaceNodes, cleanSpaceId);
    const allowedSpaceSet = new Set(scope.allowedSpaceIds.map((id) => id.toLowerCase()));
    const searchedSpaceIds = candidateSpacePool.filter((sid) =>
        !!membershipReaches(spaceNodes, memberSnapshots, cleanUserId, sid) &&
        allowedSpaceSet.has(sid.toLowerCase())
    );
    if (searchedSpaceIds.length === 0) {
        return {
            ...emptyResult(cleanSpaceId, cleanUserId, principalIds, []),
            callerCanSeeTeam,
        };
    }

    const effectiveTopK = clampRetrievalTopK(options?.topK);
    const effectiveMaxTokensPerSource = clampTokensPerSource(options?.maxTokensPerSource);
    const effectiveMaxContextTokens = clampContextTokenBudget(options?.maxContextTokens);
    const topKRequested = typeof options?.topK === 'number' && Number.isFinite(options.topK)
        ? Math.floor(options.topK)
        : effectiveTopK;

    const rvUser = RunView.FromMetadataProvider(provider);
    const itemFilters = buildSpaceBandFilters(searchedSpaceIds, scope.spaceBands);
    const itemPageSize = options?.itemsPageSize ?? EVERY_ROW_PAGE_SIZE;

    let rawItems: SpaceItemRow[];
    try {
        const itemPages = await Promise.all(
            itemFilters.map((filter) =>
                readEveryRow<SpaceItemRow>(
                    rvUser,
                    {
                        EntityName: ITEMS_ENTITY,
                        ExtraFilter: filter,
                        Fields: ['ID', 'SpaceID', 'EntityID', 'RecordID', 'Band'],
                    },
                    user,
                    itemPageSize,
                ),
            ),
        );
        rawItems = itemPages.flat();
    } catch (itemsErr) {
        LogError(`resolveSpaceAgentRetrieval items query failed: ${itemsErr instanceof Error ? itemsErr.message : String(itemsErr)}`);
        return {
            ...emptyResult(cleanSpaceId, cleanUserId, principalIds, searchedSpaceIds),
            callerCanSeeTeam,
        };
    }

    // Strict (space, band) reach pre-filtering BEFORE any target resolution, vector query, or scoring
    const spaceIndex = new Map<string, SpaceNode>();
    for (const s of spaceNodes) {
        spaceIndex.set(s.id.toLowerCase(), s);
    }
    const entityNameByEntityId = new UUIDMap<string>();
    const inScopeRows: PreFilteredSpaceItem[] = [];
    const excludedRows: PreFilteredSpaceItem[] = [];
    const seenItemIds = new Set<string>();

    for (let idx = 0; idx < rawItems.length; idx++) {
        const raw = rawItems[idx];
        const normItemId = (parseUuid(raw.ID) ?? raw.ID).toLowerCase();
        if (seenItemIds.has(normItemId)) continue;
        seenItemIds.add(normItemId);

        const entityId = (parseUuid(raw.EntityID) ?? raw.EntityID).toLowerCase();
        let entityName = entityNameByEntityId.Get(entityId);
        if (entityName === undefined) {
            const entityInfo = provider.EntityByID(entityId);
            if (entityInfo) {
                entityName = entityInfo.Name;
                entityNameByEntityId.Set(entityId, entityName);
            }
        }
        const cleanedRec = cleanRecordId(raw.RecordID);
        const recId = cleanedRec.toLowerCase();
        const cleanTargetRecordId = parseUuid(cleanedRec);
        const itemSpaceId = parseUuid(raw.SpaceID) ?? raw.SpaceID;
        const itemReach = membershipReaches(spaceNodes, memberSnapshots, cleanUserId, itemSpaceId);
        const itemCallerCanSeeTeam = itemReach ? itemReach.role.canSeeTeamBand : false;
        const inAnchorSubtree = isAncestorOrSelf(spaceIndex, cleanSpaceId, itemSpaceId);
        const callerAllowed =
            inAnchorSubtree
                ? agentMayQuote({
                      callerCanRead: !!itemReach,
                      callerCanSeeTeam: itemCallerCanSeeTeam,
                      itemBand: raw.Band,
                      itemSpaceId,
                      askedFromSpaceId: cleanSpaceId,
                      spaces: spaceNodes,
                  })
                : effectiveNarrowing === 'Everything' &&
                  allowedSpaceSet.has(itemSpaceId.toLowerCase()) &&
                  agentMayQuote({
                      callerCanRead: !!itemReach,
                      callerCanSeeTeam: itemCallerCanSeeTeam,
                      itemBand: raw.Band,
                      itemSpaceId,
                      askedFromSpaceId: itemSpaceId,
                      spaces: spaceNodes,
                  });
        const audienceDecision = agentMayQuoteCandidate(
            {
                id: raw.ID,
                spaceId: itemSpaceId,
                band: raw.Band,
            },
            scope,
        );
        const allowed = callerAllowed && audienceDecision.allowed;
        const reason = allowed
            ? 'Allowed: item is within effective retrieval scope and readable by caller.'
            : audienceDecision.reason ?? 'Refused: agentMayQuote excluded item based on space subtree, team band, or retrieval policy.';

        const preFiltered: PreFilteredSpaceItem = {
            raw,
            originalIndex: idx,
            entityId,
            entityName,
            cleanTargetRecordId,
            targetKey: `${entityId}:${recId}`,
            itemSpaceId,
            allowed,
            reason,
        };
        if (allowed) {
            inScopeRows.push(preFiltered);
        } else {
            excludedRows.push(preFiltered);
        }
    }

    const explicitFilterQuery = (options?.query ?? '').trim();
    const rankingQueryText = explicitFilterQuery || (options?.rankingQuery ?? '').trim();
    const allowedSpaceItemIds = new Set(inScopeRows.map((r) => (parseUuid(r.raw.ID) ?? r.raw.ID).toLowerCase()));
    const allowedSpaces: Array<{ spaceId: string; maxBand: Band }> = searchedSpaceIds.map((sid) => ({
        spaceId: sid,
        maxBand: scope.spaceBands.get(sid.toLowerCase()) ?? 'Shared',
    }));

    const inScopeRowById = new Map<string, PreFilteredSpaceItem>();
    for (const row of inScopeRows) {
        inScopeRowById.set((parseUuid(row.raw.ID) ?? row.raw.ID).toLowerCase(), row);
    }

    let rankingMode: RetrievalRankingMode = 'none';
    let vectorSearchUsed = false;
    let rankedCandidates: RankedCandidateOutcome<SpaceAgentCandidateItem>[] = [];

    // Path A: Try vector similarity search when a vector index/service is configured and query text is non-empty
    if (inScopeRows.length > 0 && rankingQueryText.length > 0) {
        const vectorAdapter = await resolveActiveVectorSearchAdapter(provider, user, options?.vectorSearch);
        if (vectorAdapter) {
            try {
                const rawHits = await vectorAdapter.search({
                    queryText: rankingQueryText,
                    allowedSpaces,
                    allowedSpaceItemIds,
                    topK: effectiveTopK,
                    user,
                    provider,
                });
                const bestScoreById = new Map<string, number>();
                for (const hit of rawHits) {
                    const normId = (parseUuid(hit.spaceItemId) ?? hit.spaceItemId).toLowerCase();
                    if (!allowedSpaceItemIds.has(normId)) continue;
                    const prev = bestScoreById.get(normId);
                    if (prev === undefined || hit.score > prev) {
                        bestScoreById.set(normId, hit.score);
                    }
                }
                if (bestScoreById.size > 0) {
                    const hitRows: Array<{ row: PreFilteredSpaceItem; score: number }> = [];
                    for (const [id, score] of bestScoreById.entries()) {
                        const row = inScopeRowById.get(id);
                        if (row) hitRows.push({ row, score });
                    }
                    hitRows.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.row.originalIndex - b.row.originalIndex));
                    const topHitRows = hitRows.slice(0, effectiveTopK);
                    const matchedRows = topHitRows.map((h) => h.row);
                    const matchedItemIds = matchedRows.map((r) => r.raw.ID);
                    const matchedTaskIds = matchedRows
                        .filter((r) => r.entityName === TASKS_ENTITY && r.cleanTargetRecordId != null)
                        .map((r) => r.cleanTargetRecordId!);

                    const [targetNames, chunksBySpaceItemId, assigneesByTaskId] = await Promise.all([
                        loadTargetMetadataMap(provider, rvUser, user, matchedRows),
                        loadChunksBySpaceItemId(provider, rvUser, user, matchedItemIds),
                        loadTaskAssigneesByTaskId(provider, rvUser, user, matchedTaskIds),
                    ]);

                    rankedCandidates = topHitRows.map(({ row, score }) => {
                        const normId = (parseUuid(row.raw.ID) ?? row.raw.ID).toLowerCase();
                        const chunkTexts = chunksBySpaceItemId.get(normId);
                        const assignees = row.cleanTargetRecordId ? assigneesByTaskId.Get(row.cleanTargetRecordId) : undefined;
                        return {
                            item: buildCandidateItem(row, targetNames.get(row.targetKey), chunkTexts, assignees, true),
                            score,
                            rankingMode: 'vector',
                            originalIndex: row.originalIndex,
                        };
                    });
                    rankingMode = 'vector';
                    vectorSearchUsed = true;
                }
            } catch (vectorErr) {
                LogError(`resolveSpaceAgentRetrieval vector search failed; falling back to lexical ranking: ${vectorErr instanceof Error ? vectorErr.message : String(vectorErr)}`);
            }
        }
    }

    // Path B: Deterministic BM25 lexical fallback (or unqueried bounded top-k)
    if (!vectorSearchUsed && inScopeRows.length > 0) {
        const targetNames = await loadTargetMetadataMap(provider, rvUser, user, inScopeRows);

        if (inScopeRows.length <= SMALL_SPACE_FULL_ENRICHMENT_LIMIT) {
            const allowedItemIds = inScopeRows.map((r) => r.raw.ID);
            const allowedTaskIds = inScopeRows
                .filter((r) => r.entityName === TASKS_ENTITY && r.cleanTargetRecordId != null)
                .map((r) => r.cleanTargetRecordId!);

            const [chunksBySpaceItemId, assigneesByTaskId] = await Promise.all([
                loadChunksBySpaceItemId(provider, rvUser, user, allowedItemIds),
                loadTaskAssigneesByTaskId(provider, rvUser, user, allowedTaskIds),
            ]);

            const enrichedItems: RankableSpaceItem<SpaceAgentCandidateItem>[] = inScopeRows.map((row) => {
                const normId = (parseUuid(row.raw.ID) ?? row.raw.ID).toLowerCase();
                const chunkTexts = chunksBySpaceItemId.get(normId);
                const assignees = row.cleanTargetRecordId ? assigneesByTaskId.Get(row.cleanTargetRecordId) : undefined;
                return {
                    item: buildCandidateItem(row, targetNames.get(row.targetKey), chunkTexts, assignees, true),
                    originalIndex: row.originalIndex,
                };
            });

            if (rankingQueryText.length > 0) {
                const lexicalScores = scoreItemsLexically(enrichedItems, rankingQueryText);
                const queryLower = explicitFilterQuery.toLowerCase();
                const filtered = explicitFilterQuery
                    ? enrichedItems.filter((e) => matchesExplicitQuery(e.item, queryLower))
                    : enrichedItems;

                rankedCandidates = filtered
                    .map((e) => {
                        const id = (parseUuid(e.item.ID) ?? e.item.ID).toLowerCase();
                        return {
                            item: e.item,
                            score: lexicalScores.get(id) ?? 0,
                            rankingMode: 'lexical' as const,
                            originalIndex: e.originalIndex,
                        };
                    })
                    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.originalIndex - b.originalIndex));
                rankingMode = 'lexical';
            } else {
                rankedCandidates = enrichedItems.map((e) => ({
                    item: e.item,
                    score: 0,
                    rankingMode: 'none' as const,
                    originalIndex: e.originalIndex,
                }));
                rankingMode = 'none';
            }
        } else {
            // Large library (1,000 .. 50,000+ items): score over title/summary/task fields first, then enrich only the shortlist
            const baseItems: RankableSpaceItem<SpaceAgentCandidateItem>[] = inScopeRows.map((row) => ({
                item: buildCandidateItem(row, targetNames.get(row.targetKey), undefined, undefined, true),
                originalIndex: row.originalIndex,
            }));

            let shortlist: Array<{ row: PreFilteredSpaceItem; score: number }> = [];
            const shortlistCap = Math.max(effectiveTopK * 4, 150);

            if (rankingQueryText.length > 0) {
                const lexicalScores = scoreItemsLexically(baseItems, rankingQueryText);
                const queryLower = explicitFilterQuery.toLowerCase();
                const scoredRows: Array<{ row: PreFilteredSpaceItem; score: number }> = [];
                for (let i = 0; i < inScopeRows.length; i++) {
                    const item = baseItems[i].item;
                    const id = (parseUuid(item.ID) ?? item.ID).toLowerCase();
                    const score = lexicalScores.get(id) ?? 0;
                    if (explicitFilterQuery && !matchesExplicitQuery(item, queryLower)) {
                        continue;
                    }
                    scoredRows.push({ row: inScopeRows[i], score });
                }
                scoredRows.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.row.originalIndex - b.row.originalIndex));
                shortlist = scoredRows.slice(0, shortlistCap);
                rankingMode = 'lexical';
            } else {
                shortlist = inScopeRows.slice(0, effectiveTopK).map((row) => ({ row, score: 0 }));
                rankingMode = 'none';
            }

            if (shortlist.length > 0) {
                const shortlistItemIds = shortlist.map((s) => s.row.raw.ID);
                const shortlistTaskIds = shortlist
                    .filter((s) => s.row.entityName === TASKS_ENTITY && s.row.cleanTargetRecordId != null)
                    .map((s) => s.row.cleanTargetRecordId!);

                const [chunksBySpaceItemId, assigneesByTaskId] = await Promise.all([
                    loadChunksBySpaceItemId(provider, rvUser, user, shortlistItemIds),
                    loadTaskAssigneesByTaskId(provider, rvUser, user, shortlistTaskIds),
                ]);

                const enrichedShortlist: RankableSpaceItem<SpaceAgentCandidateItem>[] = shortlist.map(({ row }) => {
                    const normId = (parseUuid(row.raw.ID) ?? row.raw.ID).toLowerCase();
                    const chunkTexts = chunksBySpaceItemId.get(normId);
                    const assignees = row.cleanTargetRecordId ? assigneesByTaskId.Get(row.cleanTargetRecordId) : undefined;
                    return {
                        item: buildCandidateItem(row, targetNames.get(row.targetKey), chunkTexts, assignees, true),
                        originalIndex: row.originalIndex,
                    };
                });

                if (rankingQueryText.length > 0) {
                    const finalScores = scoreItemsLexically(enrichedShortlist, rankingQueryText);
                    rankedCandidates = enrichedShortlist
                        .map((e) => {
                            const id = (parseUuid(e.item.ID) ?? e.item.ID).toLowerCase();
                            return {
                                item: e.item,
                                score: finalScores.get(id) ?? 0,
                                rankingMode: 'lexical' as const,
                                originalIndex: e.originalIndex,
                            };
                        })
                        .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.originalIndex - b.originalIndex));
                } else {
                    rankedCandidates = enrichedShortlist.map((e) => ({
                        item: e.item,
                        score: 0,
                        rankingMode: 'none' as const,
                        originalIndex: e.originalIndex,
                    }));
                }
            }
        }
    }

    const budgeted = applyContextTokenBudget(rankedCandidates, {
        topK: effectiveTopK,
        maxTokensPerSource: effectiveMaxTokensPerSource,
        maxContextTokens: effectiveMaxContextTokens,
    });

    const quotedItems = budgeted.items;
    const candidateItems: SpaceAgentCandidateItem[] = [...quotedItems];
    const decisions: SpaceAgentRetrievalDecision[] = quotedItems.map((item) => ({
        item,
        allowed: true,
        reason: 'Allowed: item is within effective retrieval scope and readable by caller.',
    }));

    // Include refused decisions for auditability on small spaces (without chunks/task details)
    const totalRawCount = inScopeRows.length + excludedRows.length;
    if (excludedRows.length > 0 && !explicitFilterQuery) {
        const excludedSample = totalRawCount <= SMALL_SPACE_AUDIT_LIMIT
            ? excludedRows
            : excludedRows.slice(0, MAX_LARGE_SPACE_REFUSAL_DECISIONS);
        const excludedTargets = totalRawCount <= SMALL_SPACE_AUDIT_LIMIT
            ? await loadTargetMetadataMap(provider, rvUser, user, excludedSample)
            : new Map<string, TargetMetadata>();

        for (const row of excludedSample) {
            const refusedItem = buildCandidateItem(row, excludedTargets.get(row.targetKey), undefined, undefined, false);
            candidateItems.push(refusedItem);
            decisions.push({ item: refusedItem, allowed: false, reason: row.reason });
        }
    }

    const stats: SpaceAgentRetrievalStats = {
        topKRequested,
        topKApplied: effectiveTopK,
        maxTokensPerSource: effectiveMaxTokensPerSource,
        maxContextTokens: effectiveMaxContextTokens,
        totalInScopeCount: inScopeRows.length,
        totalExcludedCount: excludedRows.length,
        suppliedCount: quotedItems.length,
        estimatedContextTokens: budgeted.totalEstimatedTokens,
        rankingMode,
        vectorSearchUsed,
        durationMs: Date.now() - startMs,
    };

    const allowedBandsBySpace: Record<string, Band> = {};
    for (const entry of allowedSpaces) {
        allowedBandsBySpace[entry.spaceId.toLowerCase()] = entry.maxBand;
    }

    return {
        spaceId: cleanSpaceId,
        askingUserId: cleanUserId,
        callerCanSeeTeam,
        audienceUserIds: principalIds,
        searchedSpaceIds,
        allowedBandsBySpace,
        candidateItems,
        quotedItems,
        decisions,
        suppliedSources: budgeted.suppliedSources,
        stats,
    };
}

interface TaskAssignmentRow {
    TaskID: string;
    AssigneeEntityID: string;
    AssigneeRecordID: string;
    Status?: mjBizAppsTasksTaskAssignmentEntity['Status'] | null;
    AssignedAt?: Date | string | null;
}

interface PersonLookupRow {
    ID: string;
    LinkedUserID?: string | null;
    DisplayName?: string | null;
    FirstName?: string | null;
    LastName?: string | null;
    PreferredName?: string | null;
}

interface UserLookupRow {
    ID: string;
    FirstLast?: string | null;
    Name?: string | null;
}

interface MemberUserLookupRow {
    UserID: string;
    User?: string | null;
}

function formatPersonName(row: PersonLookupRow): string | null {
    const display = (row.DisplayName ?? '').replace(/\s+/g, ' ').trim();
    if (display) return display;
    const given = ((row.PreferredName ?? '').trim() || (row.FirstName ?? '').trim()).replace(/\s+/g, ' ').trim();
    const family = (row.LastName ?? '').replace(/\s+/g, ' ').trim();
    const full = [given, family].filter(Boolean).join(' ').trim();
    return full || null;
}

function classifyAssigneeKind(provider: IMetadataProvider, assigneeEntityId: string): 'person' | 'user' | null {
    const usersEntity = provider.EntityByName(USERS_ENTITY);
    if (usersEntity && UUIDsEqual(assigneeEntityId, usersEntity.ID)) return 'user';
    const entityInfo = provider.EntityByID(assigneeEntityId);
    if (entityInfo?.Name === USERS_ENTITY) return 'user';
    if (IsPeopleEntity(entityInfo)) return 'person';
    return null;
}

async function resolveAssigneeNames(
    provider: IMetadataProvider,
    rvUser: RunView,
    user: UserInfo,
    personIds: readonly string[],
    userIds: readonly string[],
): Promise<{ personNames: UUIDMap<string>; userNames: UUIDMap<string> }> {
    const personNames = new UUIDMap<string>();
    const userNames = new UUIDMap<string>();
    const views: RunViewParams[] = [];
    const tags: Array<'person' | 'user' | 'personByUser' | 'memberByUser'> = [];
    const hasEntity = (name: string): boolean => !!provider.EntityByName(name);

    for (let start = 0; start < personIds.length; start += ID_LOOKUP_BATCH_SIZE) {
        if (!hasEntity(PEOPLE_ENTITY)) break;
        const batch = personIds.slice(start, start + ID_LOOKUP_BATCH_SIZE);
        views.push({
            EntityName: PEOPLE_ENTITY,
            ExtraFilter: `ID IN (${batch.map((id) => `'${id}'`).join(', ')})`,
            Fields: ['ID', 'DisplayName', 'FirstName', 'LastName', 'PreferredName'],
            // row-cap-ok: bounded batch lookup by <= 500 explicit IDs
            MaxRows: ID_LOOKUP_BATCH_SIZE,
            ResultType: 'simple',
        });
        tags.push('person');
    }
    for (let start = 0; start < userIds.length; start += ID_LOOKUP_BATCH_SIZE) {
        const batch = userIds.slice(start, start + ID_LOOKUP_BATCH_SIZE);
        const userIn = batch.map((id) => `'${id}'`).join(', ');
        if (hasEntity(USERS_ENTITY)) {
            views.push({
                EntityName: USERS_ENTITY,
                ExtraFilter: `ID IN (${userIn})`,
                Fields: ['ID', 'FirstLast', 'Name'],
                // row-cap-ok: bounded batch lookup by <= 500 explicit IDs
                MaxRows: ID_LOOKUP_BATCH_SIZE,
                ResultType: 'simple',
            });
            tags.push('user');
        }
        if (hasEntity(PEOPLE_ENTITY)) {
            views.push({
                EntityName: PEOPLE_ENTITY,
                ExtraFilter: `LinkedUserID IN (${userIn})`,
                Fields: ['ID', 'LinkedUserID', 'DisplayName', 'FirstName', 'LastName', 'PreferredName'],
                // row-cap-ok: bounded batch lookup by <= 500 explicit IDs
                MaxRows: ID_LOOKUP_BATCH_SIZE,
                ResultType: 'simple',
            });
            tags.push('personByUser');
        }
        if (hasEntity(MEMBERS_ENTITY)) {
            views.push({
                EntityName: MEMBERS_ENTITY,
                ExtraFilter: `UserID IN (${userIn}) AND Status = 'Active'`,
                Fields: ['UserID', 'User'],
                // row-cap-ok: bounded batch lookup by <= 500 explicit user IDs
                MaxRows: 2000,
                ResultType: 'simple',
            });
            tags.push('memberByUser');
        }
    }
    if (views.length === 0) return { personNames, userNames };

    const results = await rvUser.RunViews(views, user);
    const userFirstLast = new UUIDMap<string>();
    const userRawName = new UUIDMap<string>();
    const personByUser = new UUIDMap<string>();
    const memberByUser = new UUIDMap<string>();

    for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const tag = tags[i];
        if (!res?.Success) {
            LogError(`resolveSpaceAgentRetrieval assignee lookup (${tag}) failed: ${res?.ErrorMessage ?? 'unknown error'}`);
            continue;
        }
        if (tag === 'person') {
            for (const row of (res.Results as PersonLookupRow[]) ?? []) {
                const label = formatPersonName(row);
                if (label) personNames.Set(row.ID, label);
            }
        } else if (tag === 'user') {
            for (const row of (res.Results as UserLookupRow[]) ?? []) {
                const fl = (row.FirstLast ?? '').replace(/\s+/g, ' ').trim();
                const raw = (row.Name ?? '').replace(/\s+/g, ' ').trim();
                if (fl) userFirstLast.Set(row.ID, fl);
                if (raw) userRawName.Set(row.ID, raw);
            }
        } else if (tag === 'personByUser') {
            for (const row of (res.Results as PersonLookupRow[]) ?? []) {
                const linkedId = parseUuid(row.LinkedUserID ?? undefined);
                const label = formatPersonName(row);
                if (linkedId && label) personByUser.Set(linkedId, label);
            }
        } else if (tag === 'memberByUser') {
            for (const row of (res.Results as MemberUserLookupRow[]) ?? []) {
                const label = (row.User ?? '').replace(/\s+/g, ' ').trim();
                if (label && !memberByUser.Has(row.UserID)) memberByUser.Set(row.UserID, label);
            }
        }
    }

    for (const uid of userIds) {
        const chosen = userFirstLast.Get(uid) ?? personByUser.Get(uid) ?? userRawName.Get(uid) ?? memberByUser.Get(uid);
        if (chosen) userNames.Set(uid, chosen);
    }
    return { personNames, userNames };
}

async function loadTaskAssigneesByTaskId(
    provider: IMetadataProvider,
    rvUser: RunView,
    user: UserInfo,
    allowedTaskIds: readonly string[],
): Promise<UUIDMap<string[]>> {
    const result = new UUIDMap<string[]>();
    if (allowedTaskIds.length === 0 || !provider.EntityByName(TASK_ASSIGNMENTS_ENTITY)) {
        return result;
    }

    const uniqueTaskIds = Array.from(new UUIDSet(allowedTaskIds.map((id) => parseUuid(id)).filter((id): id is string => !!id)));
    if (uniqueTaskIds.length === 0) return result;

    try {
        const rows: TaskAssignmentRow[] = [];
        for (let start = 0; start < uniqueTaskIds.length; start += ID_LOOKUP_BATCH_SIZE) {
            const batch = uniqueTaskIds.slice(start, start + ID_LOOKUP_BATCH_SIZE);
            const assignRes = await rvUser.RunView<TaskAssignmentRow>(
                {
                    EntityName: TASK_ASSIGNMENTS_ENTITY,
                    ExtraFilter: `TaskID IN (${batch.map((id) => `'${id}'`).join(', ')})`,
                    Fields: ['TaskID', 'AssigneeEntityID', 'AssigneeRecordID', 'Status', 'AssignedAt'],
                    // row-cap-ok: bounded batch lookup for shortlisted tasks
                    MaxRows: 2000,
                    ResultType: 'simple',
                },
                user,
            );
            if (!assignRes.Success) {
                LogError(`resolveSpaceAgentRetrieval task assignments lookup failed: ${assignRes.ErrorMessage}`);
                return result;
            }
            if (assignRes.Results) rows.push(...assignRes.Results);
        }
        if (rows.length === 0) return result;

        const parsed: Array<{ taskId: string; kind: 'person' | 'user'; recordId: string; completed: boolean; assignedAtMs: number }> = [];
        const personIdSet = new UUIDSet();
        const userIdSet = new UUIDSet();

        for (const row of rows) {
            const taskId = parseUuid(row.TaskID);
            const recordId = parseUuid(cleanRecordId(row.AssigneeRecordID));
            const kind = row.AssigneeEntityID ? classifyAssigneeKind(provider, row.AssigneeEntityID) : null;
            if (!taskId || !recordId || !kind) continue;
            if (kind === 'person') personIdSet.Add(recordId);
            else userIdSet.Add(recordId);
            const ts = row.AssignedAt ? new Date(row.AssignedAt).getTime() : 0;
            parsed.push({
                taskId,
                kind,
                recordId,
                completed: row.Status === 'Completed',
                assignedAtMs: Number.isNaN(ts) ? 0 : ts,
            });
        }
        if (parsed.length === 0) return result;

        const { personNames, userNames } = await resolveAssigneeNames(
            provider,
            rvUser,
            user,
            Array.from(personIdSet),
            Array.from(userIdSet),
        );

        parsed.sort((a, b) => (a.completed === b.completed ? a.assignedAtMs - b.assignedAtMs : a.completed ? 1 : -1));
        for (const entry of parsed) {
            const name = entry.kind === 'person' ? personNames.Get(entry.recordId) : userNames.Get(entry.recordId);
            if (!name) continue;
            const list = result.Get(entry.taskId) ?? [];
            if (!list.includes(name)) {
                list.push(name);
                result.Set(entry.taskId, list);
            }
        }
    } catch (error) {
        LogError(`resolveSpaceAgentRetrieval task assignee lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return result;
}

async function loadChunksBySpaceItemId(
    provider: IMetadataProvider,
    rvUser: RunView,
    user: UserInfo,
    allowedItemIds: readonly string[],
): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (
        allowedItemIds.length === 0 ||
        typeof provider.EntityByName !== 'function' ||
        !provider.EntityByName('MJ: Content Item Chunks')
    ) {
        return result;
    }

    const validIds = allowedItemIds.map((id) => parseUuid(id)).filter((id): id is string => !!id);
    if (validIds.length === 0) {
        return result;
    }

    try {
        const erdRows: Array<{ ID: string; RecordID: string }> = [];
        for (let start = 0; start < validIds.length; start += ID_LOOKUP_BATCH_SIZE) {
            const batch = validIds.slice(start, start + ID_LOOKUP_BATCH_SIZE);
            const recordIdClauses = batch.flatMap((id) => [`'ID|${id}'`, `'${id}'`]).join(', ');
            const erdRes = await rvUser.RunView<{ ID: string; RecordID: string }>(
                {
                    EntityName: 'MJ: Entity Record Documents',
                    ExtraFilter: `Entity = '${ITEMS_ENTITY}' AND RecordID IN (${recordIdClauses})`,
                    Fields: ['ID', 'RecordID'],
                    // row-cap-ok: bounded batch lookup by <= 500 explicit SpaceItem IDs
                    MaxRows: 2000,
                    ResultType: 'simple',
                    BypassCache: true,
                },
                user,
            );
            if (erdRes.Success && erdRes.Results) erdRows.push(...erdRes.Results);
        }
        if (erdRows.length === 0) {
            return result;
        }

        const spaceItemIdByErdId = new Map<string, string>();
        const erdIds: string[] = [];
        for (const erd of erdRows) {
            const erdId = parseUuid(erd.ID);
            const itemId = parseUuid(cleanRecordId(erd.RecordID));
            if (erdId && itemId) {
                spaceItemIdByErdId.set(erdId.toLowerCase(), itemId.toLowerCase());
                erdIds.push(erdId);
            }
        }
        if (erdIds.length === 0) {
            return result;
        }

        const ciRows: Array<{ ID: string; EntityRecordDocumentID: string | null; RootParentID: string | null }> = [];
        for (let start = 0; start < erdIds.length; start += ID_LOOKUP_BATCH_SIZE) {
            const erdInList = erdIds.slice(start, start + ID_LOOKUP_BATCH_SIZE).map((id) => `'${id}'`).join(', ');
            const ciRes = await rvUser.RunView<{ ID: string; EntityRecordDocumentID: string | null; RootParentID: string | null }>(
                {
                    EntityName: 'MJ: Content Items',
                    ExtraFilter: `DeleteStatus IS NULL AND (EntityRecordDocumentID IN (${erdInList}) OR RootParentID IN (SELECT ID FROM [__mj].[vwContentItems] WHERE DeleteStatus IS NULL AND EntityRecordDocumentID IN (${erdInList})))`,
                    Fields: ['ID', 'EntityRecordDocumentID', 'RootParentID'],
                    // row-cap-ok: bounded batch lookup for top candidates' Content Items
                    MaxRows: 2000,
                    ResultType: 'simple',
                    BypassCache: true,
                },
                user,
            );
            if (ciRes.Success && ciRes.Results) ciRows.push(...ciRes.Results);
        }
        if (ciRows.length === 0) {
            return result;
        }

        const erdIdByRootCiId = new Map<string, string>();
        for (const ci of ciRows) {
            const ciId = parseUuid(ci.ID);
            const erdId = ci.EntityRecordDocumentID ? parseUuid(ci.EntityRecordDocumentID) : null;
            if (ciId && erdId) {
                erdIdByRootCiId.set(ciId.toLowerCase(), erdId.toLowerCase());
            }
        }

        const spaceItemIdByCiId = new Map<string, string>();
        const ciIds: string[] = [];
        for (const ci of ciRows) {
            const ciId = parseUuid(ci.ID);
            if (!ciId) continue;
            const directErdId = ci.EntityRecordDocumentID ? parseUuid(ci.EntityRecordDocumentID)?.toLowerCase() : null;
            const rootCiId = ci.RootParentID ? parseUuid(ci.RootParentID)?.toLowerCase() : null;
            const resolvedErdId = directErdId ?? (rootCiId ? erdIdByRootCiId.get(rootCiId) ?? null : null);
            const spaceItemId = resolvedErdId ? spaceItemIdByErdId.get(resolvedErdId) : undefined;
            if (spaceItemId) {
                spaceItemIdByCiId.set(ciId.toLowerCase(), spaceItemId);
                ciIds.push(ciId);
            }
        }
        if (ciIds.length === 0) {
            return result;
        }

        for (let start = 0; start < ciIds.length; start += ID_LOOKUP_BATCH_SIZE) {
            const ciInList = ciIds.slice(start, start + ID_LOOKUP_BATCH_SIZE).map((id) => `'${id}'`).join(', ');
            const chunksRes = await rvUser.RunView<{ ID: string; ContentItemID: string; Text: string | null; Sequence: number }>(
                {
                    EntityName: 'MJ: Content Item Chunks',
                    ExtraFilter: `DeleteStatus IS NULL AND ContentItemID IN (${ciInList})`,
                    Fields: ['ID', 'ContentItemID', 'Text', 'Sequence'],
                    OrderBy: 'Sequence ASC',
                    // row-cap-ok: bounded chunk lookup for shortlisted candidates
                    MaxRows: 2000,
                    ResultType: 'simple',
                    BypassCache: true,
                },
                user,
            );
            if (!chunksRes.Success || !chunksRes.Results) {
                continue;
            }
            for (const chunk of chunksRes.Results) {
                const ciId = parseUuid(chunk.ContentItemID)?.toLowerCase();
                const spaceItemId = ciId ? spaceItemIdByCiId.get(ciId) : undefined;
                const normalizedText = typeof chunk.Text === 'string' ? chunk.Text.replace(/\s+/g, ' ').trim() : '';
                if (!spaceItemId || !normalizedText) continue;
                const list = result.get(spaceItemId) ?? [];
                list.push(normalizedText);
                result.set(spaceItemId, list);
            }
        }
    } catch (err) {
        LogError(`resolveSpaceAgentRetrieval chunk lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
}
