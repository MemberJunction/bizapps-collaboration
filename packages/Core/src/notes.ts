/**
 * Notes (B21, D33) and the plan's call 15, made by Ian on 2026-10-13: a Team note can be promoted to Shared. The rule, pure:
 * promotion moves the note itself (one record, its band changes); the space's owner or a seat whose role may promote the band
 * (owner, admin) does it; a private note is its author's alone and is not promoted (it is made a space note first); a Shared note
 * is not promoted again. Demotion is never offered: members may already have read it. Comments and a note's conversation, when
 * they exist, stay in the Team band. The server's SpaceNoteEntityServer applies this verdict; the browser shows the action by it.
 *
 * Turn into document (native MJ: Artifacts Markdown Document): promoting a SpaceNote produces a native, editable
 * `MJ: Artifacts` (`Markdown Document`) record, an initial v1 `MJ: Artifact Versions` (`ContentMode: 'Text'`) record,
 * and a `SpaceItem` inheriting `SpaceID`, `Band`, and `Visibility` with `DelegateEntityID`/`DelegateRecordID` permission
 * delegation via `space-docs.ts` rather than uploading a raw `.md` binary via `upload-space-file.ts`.
 */
import type { Band, RoleFlags } from './rules.ts';

/** The audit log type a promotion is recorded under (metadata/audit-log-types). */
export const NOTE_PROMOTED_AUDIT_LOG_TYPE = 'Collaboration: Note Promoted';

/** Default deterministic title used when a SpaceNote has an empty or whitespace-only title. */
export const DEFAULT_NOTE_DOCUMENT_TITLE = 'Untitled Note';

/** Default SpaceItem folder label for documents promoted from SpaceNotes. */
export const DEFAULT_NOTE_DOCUMENT_FOLDER = 'Notes';

/** Canonical MJ Artifact Type name for editable Markdown documents. */
export const MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME = 'Markdown Document';

/** Canonical ContentMode for native editable Markdown Document artifact versions. */
export const NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE = 'Text' as const;

export type NoteVisibility = 'Space' | 'Private';

export interface NotePromotionViewer {
    userId: string;
    /** Whether the viewer owns the space the note is in. */
    isSpaceOwner: boolean;
    /** The viewer's reaching role in that space, or null when they hold no seat (an administrator reaches without one). */
    role: Pick<RoleFlags, 'canPromoteBand' | 'canSeeTeamBand'> | null;
    /** Whether the viewer administers spaces (the host's administrators promote in any space). */
    administers?: boolean;
}

export interface NoteForPromotion {
    Band: Band;
    Visibility: NoteVisibility;
    AuthorUserID: string;
}

export type NotePromotionVerdict =
    | { ok: true }
    | { ok: false; reason: 'already-shared' | 'private' | 'not-allowed'; message: string };

/** Whether `viewer` may promote `note` from Team to Shared, and why not. */
export function notePromotionVerdict(viewer: NotePromotionViewer, note: NoteForPromotion): NotePromotionVerdict {
    if (note.Band === 'Shared') return { ok: false, reason: 'already-shared', message: 'The note is already shared with everyone in the space.' };
    if (note.Visibility === 'Private') return { ok: false, reason: 'private', message: 'A private note is not promoted. Make it a space note first.' };
    if (viewer.administers || viewer.isSpaceOwner || viewer.role?.canPromoteBand) return { ok: true };
    return { ok: false, reason: 'not-allowed', message: 'Only the space\'s owner or a seat that may promote the band moves a note to Shared.' };
}

/** What a promotion makes visible, for the confirmation: the note's own body; its comments and conversation stay with the team. */
export function promotionConsequence(note: { Title: string }, sharedLabel: string): string {
    return `"${note.Title}" will be visible to ${sharedLabel}. Its text moves; any comments or conversation on it stay with the team. This is not undone: members may read it as soon as it is shared.`;
}

export interface NoteDocument {
    fileName: string;
    mimeType: 'text/markdown';
    content: string;
}

export interface SpaceNoteForDocument {
    ID?: string | null;
    SpaceID: string;
    Title?: string | null;
    Body?: string | null;
    Band: Band;
    Visibility: NoteVisibility;
    AuthorUserID?: string | null;
}

export interface NoteArtifactDocumentOptions {
    /** Optional SpaceItem folder label; defaults to `'Notes'`. Pass `null` for an unfiled SpaceItem. */
    folder?: string | null;
    /** Optional deterministic fallback title when `Title` is empty or whitespace-only. Defaults to `'Untitled Note'`. */
    fallbackTitle?: string;
    /** Optional deterministic fallback Markdown body when `Body` is empty or whitespace-only. */
    fallbackBody?: string;
}

/**
 * Pure, isomorphic specification for promoting a `SpaceNote` into a native, editable
 * `MJ: Artifacts` (`Markdown Document`) + v1 `MJ: Artifact Versions` + `SpaceItem`.
 */
export interface NoteArtifactDocument {
    spaceId: string;
    sourceNoteId: string | null;
    title: string;
    content: string;
    band: Band;
    visibility: NoteVisibility;
    folder: string | null;
    artifactTypeName: typeof MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME;
    contentMode: typeof NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE;
    mimeType: 'text/markdown';
    /** Backward-compatible slugified `.md` file name derived from the resolved title. */
    fileName: string;
}

export interface NoteTurnIntoDocumentViewer {
    userId: string;
    isSpaceOwner: boolean;
    role: Pick<RoleFlags, 'canSeeTeamBand' | 'canContribute'> | null;
    administers?: boolean;
    spaceReadOnly?: boolean;
}

export type NoteTurnIntoDocumentVerdict =
    | { ok: true; effectiveBand: Band; visibility: NoteVisibility }
    | { ok: false; reason: 'read-only' | 'not-author' | 'band-isolated' | 'not-allowed'; message: string };

/** Normalizes a SpaceNote title to a non-empty document title with a deterministic fallback. */
export function normalizeNoteDocumentTitle(title: string | null | undefined, fallbackTitle: string = DEFAULT_NOTE_DOCUMENT_TITLE): string {
    const trimmed = (title ?? '').trim();
    if (trimmed.length > 0) return trimmed;
    const resolvedFallback = fallbackTitle.trim();
    return resolvedFallback.length > 0 ? resolvedFallback : DEFAULT_NOTE_DOCUMENT_TITLE;
}

/** Normalizes a SpaceNote Markdown body to LF line endings, falling back deterministically when empty or whitespace-only. */
export function normalizeNoteDocumentBody(body: string | null | undefined, fallbackBody: string = ''): string {
    const normalized = (body ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (normalized.length > 0) return normalized;
    return fallbackBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/** Formats a SpaceNote's title and body into a normalized editable Markdown document payload. */
export function formatNoteMarkdownDocument(
    title: string | null | undefined,
    body: string | null | undefined,
    options?: Pick<NoteArtifactDocumentOptions, 'fallbackTitle' | 'fallbackBody'>,
): { title: string; content: string } {
    const resolvedTitle = normalizeNoteDocumentTitle(title, options?.fallbackTitle);
    const resolvedBody = normalizeNoteDocumentBody(body, options?.fallbackBody);
    return {
        title: resolvedTitle,
        content: `# ${resolvedTitle}\n\n${resolvedBody}${resolvedBody ? '\n' : ''}`,
    };
}

/**
 * Resolves the effective `SpaceItem.Band` for a document created from a `SpaceNote`.
 * A `Private` note is always locked to the `Team` band so private drafts can never leak to `Shared`.
 */
export function resolveNoteDocumentBand(note: Pick<SpaceNoteForDocument, 'Band' | 'Visibility'>): Band {
    if (note.Visibility === 'Private') return 'Team';
    return note.Band === 'Shared' ? 'Shared' : 'Team';
}

/**
 * Pure authorization rule for turning a `SpaceNote` into a native `MJ: Artifacts` Markdown Document:
 * - Refuses when the space is read-only / closed.
 * - Requires an active seat reaching the space (or space administrator authority).
 * - Requires `canContribute` (or space administrator authority).
 * - Restricts `Private` notes strictly to their author (or space administrator) on the `Team` band.
 * - Enforces `Team` vs. `Shared` band isolation (`Shared` participants cannot create `Team` documents).
 */
export function noteTurnIntoDocumentVerdict(
    viewer: NoteTurnIntoDocumentViewer,
    note: Pick<SpaceNoteForDocument, 'Band' | 'Visibility' | 'AuthorUserID'>,
): NoteTurnIntoDocumentVerdict {
    if (viewer.spaceReadOnly) {
        return {
            ok: false,
            reason: 'read-only',
            message: 'Document creation refused: the space is read-only or closed.',
        };
    }

    const isAdmin = Boolean(viewer.administers);
    if (!isAdmin && !viewer.role) {
        return {
            ok: false,
            reason: 'not-allowed',
            message: 'Document creation refused: caller does not hold an active seat reaching this space.',
        };
    }

    if (note.Visibility === 'Private') {
        const authorId = (note.AuthorUserID ?? '').trim().toLowerCase();
        const callerId = viewer.userId.trim().toLowerCase();
        if (!isAdmin && (!authorId || authorId !== callerId)) {
            return {
                ok: false,
                reason: 'not-author',
                message: 'Document creation refused: only the author of a private note may turn it into a document.',
            };
        }
    }

    const effectiveBand = resolveNoteDocumentBand(note);
    const canSeeTeam = isAdmin || Boolean(viewer.role?.canSeeTeamBand);
    if (effectiveBand === 'Team' && !canSeeTeam) {
        return {
            ok: false,
            reason: 'band-isolated',
            message: 'Document creation refused: Shared-band participants cannot create Team-band documents.',
        };
    }

    const canContribute = isAdmin || Boolean(viewer.role?.canContribute);
    if (!canContribute) {
        return {
            ok: false,
            reason: 'not-allowed',
            message: 'Document creation refused: caller role cannot contribute in this space.',
        };
    }

    return { ok: true, effectiveBand, visibility: note.Visibility };
}

/** A file name a note's title makes: ASCII letters, digits and dashes, lower case, `.md`. */
export function noteFileName(title: string): string {
    const slug = (title ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return `${slug || 'note'}.md`;
}

/**
 * *Turn into document* (B21): formats a note as a titled Markdown payload.
 * Preserved for full backward compatibility; handles empty/whitespace titles deterministically.
 */
export function noteDocument(note: { Title: string; Body: string | null }): NoteDocument {
    const formatted = formatNoteMarkdownDocument(note.Title, note.Body);
    return {
        fileName: noteFileName(note.Title),
        mimeType: 'text/markdown',
        content: formatted.content,
    };
}

/**
 * Builds the canonical native `MJ: Artifacts` Markdown Document specification for promoting
 * a `SpaceNote` via `promoteSpaceNoteToDoc` (`packages/CoreEntitiesServer/src/space-docs.ts`).
 */
export function noteToArtifactDocument(
    note: SpaceNoteForDocument,
    options?: NoteArtifactDocumentOptions,
): NoteArtifactDocument {
    const formatted = formatNoteMarkdownDocument(note.Title, note.Body, options);
    const band = resolveNoteDocumentBand(note);
    const hasExplicitFolder = options !== undefined && Object.prototype.hasOwnProperty.call(options, 'folder');
    const folder = hasExplicitFolder
        ? (options.folder?.trim() || null)
        : DEFAULT_NOTE_DOCUMENT_FOLDER;
    const rawNoteId = (note.ID ?? '').trim();

    return {
        spaceId: note.SpaceID.trim(),
        sourceNoteId: rawNoteId.length > 0 ? rawNoteId : null,
        title: formatted.title,
        content: formatted.content,
        band,
        visibility: note.Visibility,
        folder,
        artifactTypeName: MARKDOWN_DOCUMENT_ARTIFACT_TYPE_NAME,
        contentMode: NOTE_ARTIFACT_DOCUMENT_CONTENT_MODE,
        mimeType: 'text/markdown',
        fileName: noteFileName(note.Title ?? formatted.title),
    };
}
