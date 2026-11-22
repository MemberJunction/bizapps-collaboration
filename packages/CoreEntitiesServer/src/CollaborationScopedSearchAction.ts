/**
 * INTERIM until MemberJunction's fix for quoted searches (MemberJunction/MJ#6408, which adds `UnwrapPhraseQuotes` to
 * `@memberjunction/global`) is in the pinned release. Then delete this file, its exports and the
 * `@memberjunction/core-actions` dependency.
 *
 * MJ's LIKE search matches quote marks as text, so an agent that quotes its search (Sage sends `"Executive Steering Review"`) finds
 * nothing in a space, though the same words unquoted find the task. In a space turn, which carries the space's search scope, this
 * drops one pair of double quotes wrapping the whole query, by MJ's rule, and then runs MJ's Scoped Search unchanged. The space
 * scope's lanes (Space Items, Tasks, Content Item Chunks) are LIKE-searched, not full-text, so the result is what MJ's fix gives.
 * Other searches, and every other part of the query, are left as they were.
 */
import { RegisterClass, UUIDsEqual } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import type { ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { ScopedSearchAction } from '@memberjunction/core-actions';
import { COLLABORATION_SPACE_SCOPE_ID, type TurnToolSourceHit } from './turn-tools.js';
import { parseUuid } from './uuid.js';

/** The key MJ registers Scoped Search under; registering after it here outranks it. */
const SCOPED_SEARCH_DRIVER_CLASS = '__Scoped_Search';

/**
 * `"Steering Review"` or `“Steering Review”` becomes `Steering Review`, as MJ's `UnwrapPhraseQuotes` does: one wrapping pair of
 * straight or curly double quotes. A quote inside the query, and quotes around nothing but whitespace, stay.
 */
export function unwrapPhraseQuotes(query: string): string {
    const inner = /^\s*["“”]([\s\S]*)["“”]\s*$/.exec(query)?.[1].trim();
    return inner ? inner : query;
}

/** Unquotes the run's `Query` in place, only when the run searches a space. */
export function unquoteSpaceSearch(params: Pick<RunActionParams, 'Params' | 'RunScope'>): void {
    if (!params.RunScope?.SearchScopeIDs?.some((id) => UUIDsEqual(id, COLLABORATION_SPACE_SCOPE_ID))) return;
    const query = params.Params.find((p) => p.Name.trim().toLowerCase() === 'query');
    if (query && typeof query.Value === 'string') query.Value = unwrapPhraseQuotes(query.Value);
}

interface ScopedSearchResultLike {
    EntityName?: string | null;
    RecordID?: string | null;
    Title?: string | null;
    RecordName?: string | null;
    Score?: number | null;
    SourceType?: string | null;
    RawMetadata?: string | Record<string, string | number | boolean | null> | null;
}

interface TurnContextWithToolHits {
    toolSourceHits?: TurnToolSourceHit[];
}

function readRawMetaContentSourceId(rawMeta: ScopedSearchResultLike['RawMetadata']): string | null {
    if (!rawMeta) return null;
    if (typeof rawMeta === 'string') {
        try {
            const parsed = JSON.parse(rawMeta) as Record<string, string | number | boolean | null>;
            return typeof parsed['ContentSourceID'] === 'string' ? parseUuid(parsed['ContentSourceID']) : null;
        } catch {
            return null;
        }
    }
    return typeof rawMeta['ContentSourceID'] === 'string' ? parseUuid(rawMeta['ContentSourceID']) : null;
}

export function recordScopedSearchHitsOnContext(
    params: Pick<RunActionParams, 'Context' | 'RunScope'>,
    result: ActionResultSimple,
): void {
    if (!result.Success || !params.RunScope?.SearchScopeIDs?.some((id) => UUIDsEqual(id, COLLABORATION_SPACE_SCOPE_ID))) {
        return;
    }
    const ctx = params.Context as TurnContextWithToolHits | undefined;
    if (!ctx || !Array.isArray(ctx.toolSourceHits)) {
        return;
    }
    const resultsParam = result.Params?.find((p) => p.Name.trim().toLowerCase() === 'results');
    if (!resultsParam || !Array.isArray(resultsParam.Value)) {
        return;
    }
    for (const rawItem of resultsParam.Value as ScopedSearchResultLike[]) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const entityName = typeof rawItem.EntityName === 'string' ? rawItem.EntityName.trim() : '';
        const recordId = typeof rawItem.RecordID === 'string' ? rawItem.RecordID.trim() : '';
        const title = (typeof rawItem.Title === 'string' && rawItem.Title.trim()) ||
            (typeof rawItem.RecordName === 'string' && rawItem.RecordName.trim()) ||
            null;
        const score = typeof rawItem.Score === 'number' && Number.isFinite(rawItem.Score) ? rawItem.Score : null;
        const rankingMode: TurnToolSourceHit['rankingMode'] = rawItem.SourceType === 'vector' ? 'vector' : 'lexical';
        const contentSourceId = readRawMetaContentSourceId(rawItem.RawMetadata);

        if (entityName === 'MJ: Content Sources' || (contentSourceId && !recordId)) {
            const cid = contentSourceId ?? parseUuid(recordId);
            if (cid) {
                ctx.toolSourceHits.push({
                    sourceKind: 'KnowledgeSource',
                    contentSourceId: cid,
                    entityName: 'MJ: Content Sources',
                    recordId: recordId || cid,
                    title,
                    score,
                    rankingMode: 'grant',
                });
            }
            continue;
        }

        if (recordId) {
            ctx.toolSourceHits.push({
                sourceKind: 'SpaceItem',
                ...(entityName === 'MJ_BizApps_Collaboration: Space Items' ? { spaceItemId: parseUuid(recordId) } : {}),
                ...(contentSourceId ? { contentSourceId } : {}),
                entityName: entityName || null,
                recordId,
                title,
                score,
                rankingMode,
            });
        }
    }
}

@RegisterClass(BaseAction, SCOPED_SEARCH_DRIVER_CLASS)
export class CollaborationScopedSearchAction extends ScopedSearchAction {
    protected override async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        unquoteSpaceSearch(params);
        const result = await super.InternalRunAction(params);
        recordScopedSearchHitsOnContext(params, result);
        return result;
    }
}

export function LoadCollaborationScopedSearchAction(): void {
    void CollaborationScopedSearchAction;
}
