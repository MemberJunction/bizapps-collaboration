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
import { COLLABORATION_SPACE_SCOPE_ID } from './turn-tools.js';

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

@RegisterClass(BaseAction, SCOPED_SEARCH_DRIVER_CLASS)
export class CollaborationScopedSearchAction extends ScopedSearchAction {
    protected override async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        unquoteSpaceSearch(params);
        return super.InternalRunAction(params);
    }
}

export function LoadCollaborationScopedSearchAction(): void {
    void CollaborationScopedSearchAction;
}
