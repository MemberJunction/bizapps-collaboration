import { createRequire } from 'node:module';
import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import type { Band } from '@mj-biz-apps/collaboration-core';
import { parseUuid } from './uuid.js';

/** Default top-k items injected into a space agent turn when no explicit `topK` is requested. */
export const DEFAULT_RETRIEVAL_TOP_K = 30;
/** Server-enforced ceiling on `topK` regardless of caller input. */
export const MAX_RETRIEVAL_TOP_K = 50;
/** Default per-source token ceiling across title, summary, task fields, and chunks. */
export const DEFAULT_MAX_TOKENS_PER_SOURCE = 350;
/** Server-enforced ceiling on per-source tokens. */
export const MAX_TOKENS_PER_SOURCE_CEILING = 500;
/** Default aggregate token budget for all supplied sources in a single turn. */
export const DEFAULT_MAX_CONTEXT_TOKENS = 6000;
/** Server-enforced ceiling on total injected retrieval context tokens. */
export const MAX_CONTEXT_TOKENS_CEILING = 8000;

const MIN_TOKENS_PER_SOURCE = 32;
const MIN_CONTEXT_TOKENS = 128;
const MAX_TITLE_CHARS = 200;
const CHARS_PER_TOKEN = 4;

const VECTOR_INDEXES_ENTITY = 'MJ: Vector Indexes';
const ENTITY_DOCUMENTS_ENTITY = 'MJ: Entity Documents';
const SPACE_ITEMS_ENTITY_NAME = 'MJ_BizApps_Collaboration: Space Items';
const COLLABORATION_SPACE_SCOPE_ID = '6E5187CF-7E5B-447F-893D-D291994083C0';

const QUERY_STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'for', 'from',
    'how', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'please', 'that', 'the',
    'this', 'to', 'what', 'when', 'where', 'which', 'who', 'with', 'you',
]);

export type RetrievalRankingMode = 'vector' | 'lexical' | 'none';

export interface SpaceAgentItemShape {
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    EntityName?: string | null;
    Name: string;
    Description: string | null;
    Band: Band;
    StoredContentType: string | null;
    Status?: string | null;
    Priority?: string | null;
    DueAt?: string | null;
    PercentComplete?: number | null;
    Assignees?: string[];
    ChunkTexts?: string[];
}

export interface SpaceAgentVectorSearchQuery {
    queryText: string;
    /** Authoritative SpaceChat ID when retrieval runs inside a space chat turn. */
    spaceChatId?: string;
    /** Anchor SpaceID from which retrieval was requested. */
    anchorSpaceId?: string;
    /** Effective chat audience ceiling ('Shared' or 'Team'). */
    chatAudience?: Band;
    /** Strictly pre-filtered `(spaceId, maxBand)` scopes for the current audience. */
    allowedSpaces: ReadonlyArray<{ spaceId: string; maxBand: Band }>;
    /** Per-space maximum allowed visibility band keyed by lowercase SpaceID. */
    allowedBandsBySpaceId?: Readonly<Record<string, Band>>;
    /** Strictly pre-filtered lowercase `SpaceItem.ID` set; out-of-scope items never enter. */
    allowedSpaceItemIds: ReadonlySet<string>;
    /** Audience user IDs in reach intersection. */
    audienceUserIds?: readonly string[];
    /** Optional hydrated audience readers for SearchEngine audience intersection. */
    audienceUsers?: readonly UserInfo[];
    topK: number;
    user: UserInfo;
    provider: IMetadataProvider;
}

export interface SpaceAgentVectorHit {
    spaceItemId: string;
    score: number;
}

export interface SpaceAgentVectorSearchAdapter {
    readonly name?: string;
    isConfigured?(provider: IMetadataProvider, user: UserInfo): Promise<boolean> | boolean;
    search(query: SpaceAgentVectorSearchQuery): Promise<readonly SpaceAgentVectorHit[]>;
}

export interface SpaceAgentSuppliedSource {
    spaceItemId: string;
    spaceId: string;
    entityId: string;
    recordId: string;
    entityName?: string | null;
    name: string;
    band: Band;
    rank: number;
    score: number;
    rankingMode: RetrievalRankingMode;
    estimatedTokens: number;
    truncated: boolean;
}

export interface SpaceAgentRetrievalStats {
    topKRequested: number;
    topKApplied: number;
    maxTokensPerSource: number;
    maxContextTokens: number;
    totalInScopeCount: number;
    totalExcludedCount: number;
    suppliedCount: number;
    estimatedContextTokens: number;
    rankingMode: RetrievalRankingMode;
    vectorSearchUsed: boolean;
    durationMs: number;
}

export interface RankableSpaceItem<TItem extends SpaceAgentItemShape = SpaceAgentItemShape> {
    item: TItem;
    originalIndex: number;
}

export interface RankedCandidateOutcome<TItem extends SpaceAgentItemShape = SpaceAgentItemShape> {
    item: TItem;
    score: number;
    rankingMode: RetrievalRankingMode;
    originalIndex: number;
}

/** Optional process-wide host vector adapter registered at server startup. */
let registeredHostVectorAdapter: SpaceAgentVectorSearchAdapter | null = null;

export function setHostVectorSearchAdapter(adapter: SpaceAgentVectorSearchAdapter | null): void {
    registeredHostVectorAdapter = adapter;
}

export function getHostVectorSearchAdapter(): SpaceAgentVectorSearchAdapter | null {
    return registeredHostVectorAdapter;
}

/** Clamps a caller's `topK` to `[1, MAX_RETRIEVAL_TOP_K]`, defaulting to `DEFAULT_RETRIEVAL_TOP_K`. */
export function clampRetrievalTopK(requested?: number): number {
    if (typeof requested !== 'number' || !Number.isFinite(requested)) {
        return DEFAULT_RETRIEVAL_TOP_K;
    }
    const floored = Math.floor(requested);
    if (floored < 1) return 1;
    if (floored > MAX_RETRIEVAL_TOP_K) return MAX_RETRIEVAL_TOP_K;
    return floored;
}

/** Clamps per-source token limit to `[MIN_TOKENS_PER_SOURCE, MAX_TOKENS_PER_SOURCE_CEILING]`. */
export function clampTokensPerSource(requested?: number): number {
    if (typeof requested !== 'number' || !Number.isFinite(requested)) {
        return DEFAULT_MAX_TOKENS_PER_SOURCE;
    }
    const floored = Math.floor(requested);
    if (floored < MIN_TOKENS_PER_SOURCE) return MIN_TOKENS_PER_SOURCE;
    if (floored > MAX_TOKENS_PER_SOURCE_CEILING) return MAX_TOKENS_PER_SOURCE_CEILING;
    return floored;
}

/** Clamps aggregate retrieval-context token limit to `[MIN_CONTEXT_TOKENS, MAX_CONTEXT_TOKENS_CEILING]`. */
export function clampContextTokenBudget(requested?: number): number {
    if (typeof requested !== 'number' || !Number.isFinite(requested)) {
        return DEFAULT_MAX_CONTEXT_TOKENS;
    }
    const floored = Math.floor(requested);
    if (floored < MIN_CONTEXT_TOKENS) return MIN_CONTEXT_TOKENS;
    if (floored > MAX_CONTEXT_TOKENS_CEILING) return MAX_CONTEXT_TOKENS_CEILING;
    return floored;
}

/** Conservative deterministic token count estimator (~4 characters per token). */
export function estimateTokenCount(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return Math.ceil(trimmed.length / CHARS_PER_TOKEN);
}

/** Strips `@{"type":"...","id":"...","name":"..."}` mention JSON tokens from a chat message for retrieval ranking. */
export function stripMentionMarkup(text: string): string {
    return text
        .replace(/@\{[^}]*\}/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Tokenizes text into normalized lowercase search terms. */
export function tokenizeForSearch(text: string): string[] {
    if (!text) return [];
    const raw = text.toLowerCase().match(/[a-z0-9]+/g);
    if (!raw) return [];
    const filtered = raw.filter((tok) => tok.length >= 2 && !QUERY_STOPWORDS.has(tok));
    if (filtered.length > 0) return filtered;
    return raw.filter((tok) => tok.length >= 2);
}

/**
 * Renders an item into the exact single-line representation used by the Collaboration Ask prompt template.
 */
export function renderCandidateItemPromptLine(item: SpaceAgentItemShape): string {
    if (item.EntityName === 'MJ_BizApps_Tasks: Tasks') {
        const statusPart = `Status: ${item.Status ?? 'Open'}`;
        const priorityPart = item.Priority ? ` | Priority: ${item.Priority}` : '';
        const ownerPart = ` | Owner: ${item.Assignees && item.Assignees.length > 0 ? item.Assignees.join(', ') : 'Unassigned'}`;
        const duePart = item.DueAt ? ` | Due: ${item.DueAt}` : '';
        const progressPart = typeof item.PercentComplete === 'number' ? ` | Progress: ${item.PercentComplete}%` : '';
        const descPart = item.Description ? ` (${item.Description})` : '';
        const chunkPart = item.ChunkTexts && item.ChunkTexts.length > 0 ? `: ${item.ChunkTexts.join(' | ')}` : '';
        return `- [Task] ${item.Name} [${statusPart}${priorityPart}${ownerPart}${duePart}${progressPart}]${descPart}${chunkPart}`;
    }
    const descPart = item.Description ? ` (${item.Description})` : '';
    const chunkPart = item.ChunkTexts && item.ChunkTexts.length > 0 ? `: ${item.ChunkTexts.join(' | ')}` : '';
    return `- ${item.Name}${descPart}${chunkPart}`;
}

/**
 * Estimates total prompt tokens consumed when an item is rendered into the Ask template
 * (including its trailing line break so per-item totals strictly upper-bound the joined prompt block).
 */
export function estimateCandidateItemTokens(item: SpaceAgentItemShape): number {
    const line = renderCandidateItemPromptLine(item).trim();
    if (!line) return 0;
    return Math.ceil((line.length + 1) / CHARS_PER_TOKEN);
}

interface TermFrequencies {
    weightedTf: Map<string, number>;
    docLength: number;
    lowerName: string;
    lowerDesc: string;
    lowerChunks: string;
    lowerTaskMeta: string;
}

function buildItemTermFrequencies(item: SpaceAgentItemShape): TermFrequencies {
    const weightedTf = new Map<string, number>();
    let docLength = 0;

    const addField = (text: string | null | undefined, weight: number): void => {
        if (!text) return;
        const tokens = tokenizeForSearch(text);
        docLength += tokens.length;
        for (const tok of tokens) {
            weightedTf.set(tok, (weightedTf.get(tok) ?? 0) + weight);
        }
    };

    addField(item.Name, 3.0);
    addField(item.Description, 2.0);
    if (item.ChunkTexts) {
        for (const chunk of item.ChunkTexts) {
            addField(chunk, 1.5);
        }
    }
    if (item.Status) addField(item.Status, 1.2);
    if (item.Priority) addField(item.Priority, 1.0);
    if (item.Assignees) {
        for (const assignee of item.Assignees) {
            addField(assignee, 1.4);
        }
    }

    return {
        weightedTf,
        docLength: Math.max(1, docLength),
        lowerName: item.Name.toLowerCase().replace(/[-_.]+/g, ' '),
        lowerDesc: (item.Description ?? '').toLowerCase(),
        lowerChunks: (item.ChunkTexts ?? []).join(' ').toLowerCase(),
        lowerTaskMeta: [item.Status ?? '', item.Priority ?? '', ...(item.Assignees ?? [])].join(' ').toLowerCase(),
    };
}

/**
 * Deterministic BM25 multi-field lexical scorer over item title (`Name`), summary (`Description`),
 * chunk text (`ChunkTexts`), and task attributes (`Status`, `Priority`, `Assignees`).
 * Returns a map from normalized `SpaceItem.ID` to relevance score (`>= 0`).
 */
export function scoreItemsLexically<TItem extends SpaceAgentItemShape>(
    items: readonly RankableSpaceItem<TItem>[],
    queryText: string,
): Map<string, number> {
    const scores = new Map<string, number>();
    const cleanQuery = queryText.trim().toLowerCase();
    const queryTerms = Array.from(new Set(tokenizeForSearch(cleanQuery)));
    if (items.length === 0 || (!cleanQuery && queryTerms.length === 0)) {
        return scores;
    }

    const docs: Array<{ id: string; tf: TermFrequencies }> = [];
    const docFreq = new Map<string, number>();
    let totalDocLength = 0;
    const queryTermSet = new Set(queryTerms);

    for (const entry of items) {
        const tf = buildItemTermFrequencies(entry.item);
        const id = (parseUuid(entry.item.ID) ?? entry.item.ID).toLowerCase();
        docs.push({ id, tf });
        totalDocLength += tf.docLength;
        for (const term of queryTermSet) {
            if (tf.weightedTf.has(term)) {
                docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
            }
        }
    }

    const docCount = docs.length;
    const avgDocLength = Math.max(1, totalDocLength / docCount);
    const k1 = 1.2;
    const b = 0.75;

    const idfByTerm = new Map<string, number>();
    for (const term of queryTermSet) {
        const df = docFreq.get(term) ?? 0;
        if (df > 0) {
            idfByTerm.set(term, Math.log(1 + (docCount - df + 0.5) / (df + 0.5)));
        }
    }

    for (const doc of docs) {
        let score = 0;
        const normLen = doc.tf.docLength / avgDocLength;
        for (const term of queryTermSet) {
            const idf = idfByTerm.get(term);
            if (!idf) continue;
            const tfVal = doc.tf.weightedTf.get(term) ?? 0;
            if (tfVal <= 0) continue;
            score += idf * ((tfVal * (k1 + 1)) / (tfVal + k1 * (1 - b + b * normLen)));
        }
        if (cleanQuery.length >= 2) {
            if (doc.tf.lowerName.includes(cleanQuery)) score += 5.0;
            if (doc.tf.lowerDesc.includes(cleanQuery)) score += 3.0;
            if (doc.tf.lowerTaskMeta.includes(cleanQuery)) score += 2.5;
            if (doc.tf.lowerChunks.includes(cleanQuery)) score += 2.0;
        }
        scores.set(doc.id, Number(score.toFixed(6)));
    }

    return scores;
}

function truncateTextToTokens(text: string, maxTokens: number): { text: string; truncated: boolean } {
    if (maxTokens <= 0) return { text: '', truncated: text.length > 0 };
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    if (text.length <= maxChars) return { text, truncated: false };
    if (maxChars <= 1) return { text: text.slice(0, maxChars), truncated: true };
    const slice = text.slice(0, maxChars - 1).trimEnd();
    return { text: slice ? `${slice}…` : text.slice(0, maxChars), truncated: true };
}

function budgetAssigneesToFit<TItem extends SpaceAgentItemShape>(
    item: TItem,
    tokenCeiling: number,
): { item: TItem; truncated: boolean } {
    if (!item.Assignees || item.Assignees.length === 0) {
        return { item, truncated: false };
    }
    if (estimateCandidateItemTokens(item) <= tokenCeiling) {
        return { item, truncated: false };
    }

    const total = item.Assignees.length;
    for (let keep = Math.min(total - 1, 10); keep >= 1; keep--) {
        const suffix = `+${total - keep} more`;
        const candidateList = [...item.Assignees.slice(0, keep).map((a) => truncateTextToTokens(a, 10).text), suffix];
        const candidate: TItem = { ...item, Assignees: candidateList };
        if (estimateCandidateItemTokens(candidate) <= tokenCeiling) {
            return { item: candidate, truncated: true };
        }
    }

    for (let keep = Math.min(total, 3); keep >= 1; keep--) {
        const candidateList = item.Assignees.slice(0, keep).map((a) => truncateTextToTokens(a, 8).text);
        const candidate: TItem = { ...item, Assignees: candidateList };
        if (estimateCandidateItemTokens(candidate) <= tokenCeiling) {
            return { item: candidate, truncated: true };
        }
    }

    return { item: { ...item, Assignees: [] }, truncated: true };
}

/**
 * Orders a candidate item's chunks so passages matching the query (exact phrase first,
 * then distinct matching query terms, then total term matches) are placed ahead of
 * non-matching chunks, preserving original sequence order within ties.
 */
export function prioritizeChunksForQuery(chunks: readonly string[], queryText?: string): string[] {
    if (chunks.length <= 1 || !queryText) {
        return [...chunks];
    }
    const cleanQuery = queryText.trim().toLowerCase();
    const queryTerms = Array.from(new Set(tokenizeForSearch(cleanQuery)));
    if (!cleanQuery && queryTerms.length === 0) {
        return [...chunks];
    }

    const scored = chunks.map((chunk, index) => {
        const lower = chunk.toLowerCase();
        const exactPhraseScore = cleanQuery.length >= 2 && lower.includes(cleanQuery) ? 1000 : 0;
        let distinctTermHits = 0;
        let totalTermHits = 0;
        if (queryTerms.length > 0) {
            const chunkTokens = tokenizeForSearch(lower);
            const tokenCounts = new Map<string, number>();
            for (const tok of chunkTokens) {
                tokenCounts.set(tok, (tokenCounts.get(tok) ?? 0) + 1);
            }
            for (const term of queryTerms) {
                const count = tokenCounts.get(term) ?? 0;
                if (count > 0) {
                    distinctTermHits += 1;
                    totalTermHits += count;
                } else if (lower.includes(term)) {
                    distinctTermHits += 1;
                    totalTermHits += 1;
                }
            }
        }
        const score = exactPhraseScore + distinctTermHits * 20 + totalTermHits;
        return { chunk, index, score };
    });

    scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index));
    return scored.map((entry) => entry.chunk);
}

function budgetSingleItem<TItem extends SpaceAgentItemShape>(
    item: TItem,
    tokenCeiling: number,
    queryText?: string,
): { item: TItem; estimatedTokens: number; truncated: boolean; fits: boolean } {
    let truncated = false;
    let working: TItem =
        item.ChunkTexts && item.ChunkTexts.length > 1 && queryText
            ? { ...item, ChunkTexts: prioritizeChunksForQuery(item.ChunkTexts, queryText) }
            : { ...item };

    if (working.Name.length > MAX_TITLE_CHARS) {
        working.Name = `${working.Name.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`;
        truncated = true;
    }

    if (estimateCandidateItemTokens(working) <= tokenCeiling) {
        return { item: working, estimatedTokens: estimateCandidateItemTokens(working), truncated, fits: true };
    }

    // Reserve base overhead without Description or ChunkTexts so text budget is realistic.
    const baseWithoutText = estimateCandidateItemTokens({
        ...working,
        Description: null,
        ChunkTexts: undefined,
    });
    let remainingForText = Math.max(0, tokenCeiling - baseWithoutText);

    if (working.Description) {
        const descCap = working.ChunkTexts && working.ChunkTexts.length > 0
            ? Math.min(remainingForText, Math.max(16, Math.floor(remainingForText * 0.4)))
            : remainingForText;
        const descRes = truncateTextToTokens(working.Description, descCap);
        working.Description = descRes.text || null;
        if (descRes.truncated) truncated = true;
        remainingForText = Math.max(0, remainingForText - estimateTokenCount(working.Description ?? ''));
    }

    if (working.ChunkTexts && working.ChunkTexts.length > 0) {
        const keptChunks: string[] = [];
        for (const rawChunk of working.ChunkTexts) {
            if (remainingForText < 4) {
                truncated = true;
                break;
            }
            const chunkRes = truncateTextToTokens(rawChunk, remainingForText);
            if (chunkRes.text) {
                keptChunks.push(chunkRes.text);
                remainingForText = Math.max(0, remainingForText - estimateTokenCount(chunkRes.text));
            }
            if (chunkRes.truncated) {
                truncated = true;
                break;
            }
        }
        working = {
            ...working,
            ChunkTexts: keptChunks.length > 0 ? keptChunks : undefined,
        };
    }

    // Enforce strict ceiling across every remaining rendered field:
    // 1. Trim or drop ChunkTexts if still over ceiling
    while (estimateCandidateItemTokens(working) > tokenCeiling && working.ChunkTexts && working.ChunkTexts.length > 0) {
        const overTokens = estimateCandidateItemTokens(working) - tokenCeiling;
        const lastIdx = working.ChunkTexts.length - 1;
        const excessChars = overTokens * CHARS_PER_TOKEN + 2;
        const trimmed = working.ChunkTexts[lastIdx].slice(0, Math.max(0, working.ChunkTexts[lastIdx].length - excessChars)).trimEnd();
        const nextChunks = trimmed.length >= 4 ? [...working.ChunkTexts.slice(0, lastIdx), `${trimmed}…`] : working.ChunkTexts.slice(0, lastIdx);
        working = { ...working, ChunkTexts: nextChunks.length > 0 ? nextChunks : undefined };
        truncated = true;
    }

    // 2. Trim or drop Description if still over ceiling
    if (estimateCandidateItemTokens(working) > tokenCeiling && working.Description) {
        const overTokens = estimateCandidateItemTokens(working) - tokenCeiling;
        const excessChars = overTokens * CHARS_PER_TOKEN + 3;
        const trimmed = working.Description.slice(0, Math.max(0, working.Description.length - excessChars)).trimEnd();
        working = { ...working, Description: trimmed.length >= 4 ? `${trimmed}…` : null };
        truncated = true;
    }

    // 3. Trim or drop oversized Assignees list if still over ceiling
    if (estimateCandidateItemTokens(working) > tokenCeiling && working.Assignees && working.Assignees.length > 0) {
        const assigneeRes = budgetAssigneesToFit(working, tokenCeiling);
        working = assigneeRes.item;
        if (assigneeRes.truncated) truncated = true;
    }

    // 4. Drop optional Task metadata fields if still over ceiling
    if (estimateCandidateItemTokens(working) > tokenCeiling && working.EntityName === 'MJ_BizApps_Tasks: Tasks') {
        if (typeof working.PercentComplete === 'number') {
            working = { ...working, PercentComplete: null };
            truncated = true;
        }
        if (estimateCandidateItemTokens(working) > tokenCeiling && working.DueAt) {
            working = { ...working, DueAt: null };
            truncated = true;
        }
        if (estimateCandidateItemTokens(working) > tokenCeiling && working.Priority) {
            working = { ...working, Priority: null };
            truncated = true;
        }
    }

    // 5. Trim Name until rendered prompt line strictly satisfies tokenCeiling
    if (estimateCandidateItemTokens(working) > tokenCeiling && working.Name.length > 1) {
        const emptyNameTokens = estimateCandidateItemTokens({ ...working, Name: '' });
        const maxNameChars = Math.max(1, (tokenCeiling - emptyNameTokens) * CHARS_PER_TOKEN);
        if (working.Name.length > maxNameChars) {
            const prefix = working.Name.slice(0, Math.max(1, maxNameChars - 1)).trimEnd();
            working = { ...working, Name: maxNameChars >= 3 && prefix ? `${prefix}…` : working.Name.slice(0, maxNameChars) };
            truncated = true;
        }
        while (estimateCandidateItemTokens(working) > tokenCeiling && working.Name.length > 1) {
            const nextLen = Math.max(1, working.Name.length - 4);
            const prefix = working.Name.slice(0, Math.max(1, nextLen - 1)).trimEnd();
            working = { ...working, Name: nextLen >= 3 && prefix ? `${prefix}…` : working.Name.slice(0, nextLen) };
            truncated = true;
        }
    }

    const estimatedTokens = estimateCandidateItemTokens(working);
    return {
        item: working,
        estimatedTokens,
        truncated,
        fits: estimatedTokens <= tokenCeiling,
    };
}

/**
 * Enforces `topK`, `maxTokensPerSource`, and `maxContextTokens` so injected prompt context
 * remains strictly bounded `O(k)` regardless of source sizes or space library cardinality.
 */
export function applyContextTokenBudget<TItem extends SpaceAgentItemShape>(
    ranked: readonly RankedCandidateOutcome<TItem>[],
    options: { topK: number; maxTokensPerSource: number; maxContextTokens: number; queryText?: string },
): {
    items: TItem[];
    suppliedSources: SpaceAgentSuppliedSource[];
    totalEstimatedTokens: number;
} {
    const items: TItem[] = [];
    const suppliedSources: SpaceAgentSuppliedSource[] = [];
    let totalEstimatedTokens = 0;

    for (const entry of ranked) {
        if (items.length >= options.topK) break;
        const remainingContext = options.maxContextTokens - totalEstimatedTokens;
        if (remainingContext < 4) break;

        const itemBudget = Math.min(options.maxTokensPerSource, remainingContext);
        const budgeted = budgetSingleItem(entry.item, itemBudget, options.queryText);
        if (!budgeted.fits || budgeted.estimatedTokens > itemBudget || totalEstimatedTokens + budgeted.estimatedTokens > options.maxContextTokens) {
            continue;
        }

        totalEstimatedTokens += budgeted.estimatedTokens;
        items.push(budgeted.item);
        suppliedSources.push({
            spaceItemId: budgeted.item.ID,
            spaceId: budgeted.item.SpaceID,
            entityId: budgeted.item.EntityID,
            recordId: budgeted.item.RecordID,
            ...(budgeted.item.EntityName ? { entityName: budgeted.item.EntityName } : {}),
            name: budgeted.item.Name,
            band: budgeted.item.Band,
            rank: items.length,
            score: entry.score,
            rankingMode: entry.rankingMode,
            estimatedTokens: budgeted.estimatedTokens,
            truncated: budgeted.truncated,
        });
    }

    return { items, suppliedSources, totalEstimatedTokens };
}

export interface SearchEngineSearchParams {
    Query: string;
    MaxResults?: number;
    ScopeIDs?: string[];
    Filters?: {
        SourceTypes?: string[];
        EntityNames?: string[];
        AllowedSpaceItemIDs?: string[];
        AllowedBandsBySpaceID?: Readonly<Record<string, Band>>;
    };
    SearchContext?: {
        PrimaryScopeRecordID?: string;
        SecondaryScopes?: Record<string, string[]>;
    };
    Audience?: {
        Readers: UserInfo[];
    };
}

export interface SearchEngineLike {
    Config(config: Record<string, never>, contextUser: UserInfo): Promise<void>;
    Search(
        params: SearchEngineSearchParams,
        contextUser: UserInfo,
    ): Promise<{
        Success: boolean;
        Results: Array<{
            EntityName: string;
            RecordID: string;
            Score: number;
            SourceType: string;
            RawMetadata?: Record<string, string | number | boolean | null>;
        }>;
    }>;
    GetAvailableProviders?(): Array<{ SourceType: string; IsAvailable: boolean }>;
}

interface SearchEngineModule {
    SearchEngine?: { Instance?: SearchEngineLike };
}

function tryLoadHostSearchEngine(): SearchEngineLike | null {
    try {
        const reqFromHere = createRequire(import.meta.url);
        const agentsEntry = reqFromHere.resolve('@memberjunction/ai-agents');
        const reqFromAgents = createRequire(agentsEntry);
        const mod = reqFromAgents('@memberjunction/search-engine') as SearchEngineModule;
        return mod.SearchEngine?.Instance ?? null;
    } catch {
        return null;
    }
}

function buildAllowedBandsMap(query: SpaceAgentVectorSearchQuery): Record<string, Band> {
    const out: Record<string, Band> = {};
    if (query.allowedBandsBySpaceId) {
        for (const [spaceId, band] of Object.entries(query.allowedBandsBySpaceId)) {
            const clean = parseUuid(spaceId)?.toLowerCase();
            if (!clean) continue;
            out[clean] = query.chatAudience === 'Shared' ? 'Shared' : band;
        }
    }
    for (const space of query.allowedSpaces) {
        const clean = parseUuid(space.spaceId)?.toLowerCase();
        if (!clean) continue;
        const effectiveBand: Band = query.chatAudience === 'Shared' ? 'Shared' : space.maxBand;
        if (!out[clean] || effectiveBand === 'Shared') {
            out[clean] = effectiveBand;
        }
    }
    return out;
}

export class HostSearchEngineVectorAdapter implements SpaceAgentVectorSearchAdapter {
    public readonly name = 'mj-host-vector-search';

    public constructor(private readonly engineOverride?: SearchEngineLike | null) {}

    private resolveEngine(): SearchEngineLike | null {
        return this.engineOverride !== undefined ? this.engineOverride : tryLoadHostSearchEngine();
    }

    public async isConfigured(provider: IMetadataProvider, user: UserInfo): Promise<boolean> {
        if (typeof provider.EntityByName !== 'function') return false;
        const hasVectorIndexEntity = !!provider.EntityByName(VECTOR_INDEXES_ENTITY);
        const hasEntityDocsEntity = !!provider.EntityByName(ENTITY_DOCUMENTS_ENTITY);
        if (!hasVectorIndexEntity || !hasEntityDocsEntity) return false;

        try {
            const rv = RunView.FromMetadataProvider(provider);
            const [idxRes, docRes] = await rv.RunViews([
                {
                    EntityName: VECTOR_INDEXES_ENTITY,
                    Fields: ['ID'],
                    MaxRows: 1,
                    ResultType: 'simple',
                },
                {
                    EntityName: ENTITY_DOCUMENTS_ENTITY,
                    ExtraFilter: `Entity = '${SPACE_ITEMS_ENTITY_NAME}' AND Status = 'Active' AND VectorIndexID IS NOT NULL`,
                    Fields: ['ID', 'VectorIndexID'],
                    MaxRows: 1,
                    ResultType: 'simple',
                },
            ], user);
            const hasIndex = !!idxRes?.Success && (idxRes.Results?.length ?? 0) > 0;
            const hasSpaceItemDoc = !!docRes?.Success && (docRes.Results?.length ?? 0) > 0;
            if (!hasIndex || !hasSpaceItemDoc) return false;
        } catch {
            return false;
        }

        const engine = this.resolveEngine();
        if (!engine) return false;
        try {
            await engine.Config({}, user);
            const providers = engine.GetAvailableProviders?.() ?? [];
            return providers.some((p) => p.SourceType === 'vector' && p.IsAvailable);
        } catch {
            return false;
        }
    }

    public async search(query: SpaceAgentVectorSearchQuery): Promise<readonly SpaceAgentVectorHit[]> {
        const engine = this.resolveEngine();
        if (!engine || query.allowedSpaces.length === 0 || query.allowedSpaceItemIds.size === 0) {
            return [];
        }

        const allowedBandsBySpaceId = buildAllowedBandsMap(query);
        const allowedSpaceIds = Object.keys(allowedBandsBySpaceId);
        if (allowedSpaceIds.length === 0) {
            return [];
        }

        const allowsAnyTeam =
            query.chatAudience !== 'Shared' &&
            Object.values(allowedBandsBySpaceId).some((band) => band === 'Team');
        const allowedAudiences: Band[] = allowsAnyTeam ? ['Shared', 'Team'] : ['Shared'];
        const primaryScopeRecordId =
            parseUuid(query.spaceChatId) ??
            parseUuid(query.anchorSpaceId) ??
            allowedSpaceIds[0];

        const overfetchTopK = Math.min(query.topK * 3, MAX_RETRIEVAL_TOP_K * 3);
        const bestScoreById = new Map<string, number>();
        try {
            const result = await engine.Search({
                Query: query.queryText,
                MaxResults: overfetchTopK,
                ScopeIDs: [COLLABORATION_SPACE_SCOPE_ID],
                Filters: {
                    SourceTypes: ['vector'],
                    EntityNames: [SPACE_ITEMS_ENTITY_NAME],
                    AllowedSpaceItemIDs: Array.from(query.allowedSpaceItemIds),
                    AllowedBandsBySpaceID: allowedBandsBySpaceId,
                },
                SearchContext: {
                    PrimaryScopeRecordID: primaryScopeRecordId,
                    SecondaryScopes: {
                        SpaceID: allowedSpaceIds,
                        Audience: allowedAudiences,
                    },
                },
                ...(query.audienceUsers && query.audienceUsers.length > 0
                    ? { Audience: { Readers: [...query.audienceUsers] } }
                    : {}),
            }, query.user);
            if (!result.Success) return [];

            for (const row of result.Results) {
                if (row.EntityName && row.EntityName !== SPACE_ITEMS_ENTITY_NAME) {
                    continue;
                }
                const candidateId = parseUuid(row.RecordID)?.toLowerCase();
                if (!candidateId || !query.allowedSpaceItemIds.has(candidateId)) {
                    continue;
                }
                if (row.RawMetadata) {
                    const metaSpaceRaw = row.RawMetadata['SpaceID'];
                    if (typeof metaSpaceRaw === 'string') {
                        const metaSpace = parseUuid(metaSpaceRaw)?.toLowerCase();
                        if (!metaSpace || !allowedBandsBySpaceId[metaSpace]) {
                            continue;
                        }
                        const metaBand = row.RawMetadata['Band'];
                        if (metaBand === 'Team' && allowedBandsBySpaceId[metaSpace] !== 'Team') {
                            continue;
                        }
                    } else if (row.RawMetadata['Band'] === 'Team' && !allowsAnyTeam) {
                        continue;
                    }
                }
                const prev = bestScoreById.get(candidateId);
                if (prev === undefined || row.Score > prev) {
                    bestScoreById.set(candidateId, row.Score);
                }
            }
        } catch (err) {
            LogError(`HostSearchEngineVectorAdapter failed; falling back to lexical ranking: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }

        return Array.from(bestScoreById.entries())
            .map(([spaceItemId, score]) => ({ spaceItemId, score }))
            .sort((a, b) => b.score - a.score)
            .slice(0, query.topK);
    }
}

const defaultHostVectorAdapter = new HostSearchEngineVectorAdapter();

/**
 * Resolves the active vector search adapter when one is supplied or configured on the host;
 * returns `null` when no vector index/service is configured so retrieval falls back to lexical BM25.
 */
export async function resolveActiveVectorSearchAdapter(
    provider: IMetadataProvider,
    user: UserInfo,
    explicitAdapter?: SpaceAgentVectorSearchAdapter | null,
): Promise<SpaceAgentVectorSearchAdapter | null> {
    const candidate = explicitAdapter ?? registeredHostVectorAdapter ?? defaultHostVectorAdapter;
    if (candidate.isConfigured) {
        try {
            const configured = await candidate.isConfigured(provider, user);
            return configured ? candidate : null;
        } catch {
            return null;
        }
    }
    return candidate;
}
