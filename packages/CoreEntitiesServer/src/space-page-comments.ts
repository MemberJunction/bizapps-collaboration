/**
 * Server rules for the comments a Space Page carries inside its blocks payload (`PublishedBlocks` / `DraftBlocks`).
 * Every reader of a page receives the whole payload, so the payload must hold nothing a reader may not see, and the
 * author on a comment must be who wrote it rather than what a client claimed.
 */
interface PayloadComment {
    id?: unknown;
    band?: unknown;
    authorName?: unknown;
    authorInitials?: unknown;
}

interface PayloadWithComments {
    comments: PayloadComment[];
}

function payloadOf(raw: string | null | undefined): PayloadWithComments | null {
    if (!raw || !raw.trim()) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray((parsed as PayloadWithComments).comments)) {
            return parsed as PayloadWithComments;
        }
    } catch {
        // An unreadable payload shows no comments to anyone.
    }
    return null;
}

/** True when the payload carries a Team comment: on a Shared page every outside reader would receive it. */
export function hasTeamComment(raw: string | null | undefined): boolean {
    return (payloadOf(raw)?.comments ?? []).some((c) => c?.band === 'Team');
}

/** The initials a client shows for a display name: the first letter of the first two words. */
export function authorInitials(name: string): string {
    return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'ME';
}

/**
 * The payload with every comment's author set by the server: a comment already stored (by id, in any of `previous`)
 * keeps its stored author, and a new comment gets the saving user's. Returns `raw` unchanged when there is nothing to
 * correct.
 */
export function stampCommentAuthors(
    raw: string | null | undefined,
    previous: Array<string | null | undefined>,
    author: { name: string; initials: string },
): string | null | undefined {
    const payload = payloadOf(raw);
    if (!payload) return raw;
    const stored = new Map<string, { authorName: unknown; authorInitials: unknown }>();
    for (const old of previous) {
        for (const c of payloadOf(old)?.comments ?? []) {
            if (typeof c?.id === 'string' && !stored.has(c.id)) stored.set(c.id, { authorName: c.authorName, authorInitials: c.authorInitials });
        }
    }
    let changed = false;
    const comments = payload.comments.map((c) => {
        if (!c || typeof c !== 'object') return c;
        const keep = typeof c.id === 'string' ? stored.get(c.id) : undefined;
        const authorName = keep ? keep.authorName : author.name;
        const initials = keep ? keep.authorInitials : author.initials;
        if (c.authorName === authorName && c.authorInitials === initials) return c;
        changed = true;
        return { ...c, authorName, authorInitials: initials };
    });
    return changed ? JSON.stringify({ ...payload, comments }) : raw;
}
