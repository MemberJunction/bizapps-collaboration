/**
 * Notes (B21, D33) and the plan's call 15, made by Ian on 2026-10-13: a Team note can be promoted to Shared. The rule, pure:
 * promotion moves the note itself (one record, its band changes); the space's owner or a seat whose role may promote the band
 * (owner, admin) does it; a private note is its author's alone and is not promoted (it is made a space note first); a Shared note
 * is not promoted again. Demotion is never offered: members may already have read it. Comments and a note's conversation, when
 * they exist, stay in the Team band. The server's SpaceNoteEntityServer applies this verdict; the browser shows the action by it.
 */
import type { Band, RoleFlags } from './rules.ts';

/** The audit log type a promotion is recorded under (metadata/audit-log-types). */
export const NOTE_PROMOTED_AUDIT_LOG_TYPE = 'Collaboration: Note Promoted';

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
    Visibility: 'Space' | 'Private';
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

export interface PageEditViewer {
    userId: string;
    /** Whether the viewer owns the space the page is in. */
    isSpaceOwner: boolean;
    /** The viewer's reaching role in that space, or null when they hold no seat. */
    role: Pick<RoleFlags, 'canPromoteBand' | 'canSeeTeamBand'> | null;
    /** Whether the viewer can edit the space's settings. */
    canEditSpaceSettings?: boolean;
    /** Whether the viewer administers spaces (the host's administrators edit pages in any open space). */
    administers?: boolean;
}

export interface SpaceForPageEdit {
    /** Whether the space is read-only (for example via its status reach or closed state). */
    isReadOnly?: boolean;
    /** When the space was closed, if closed. */
    closedAt?: Date | string | null;
}

export type PageEditVerdict =
    | { ok: true }
    | { ok: false; reason: 'read-only' | 'not-allowed'; message: string };

/** Whether `viewer` may create, edit, publish or delete a page in `space`, and why not. */
export function pageEditVerdict(viewer: PageEditViewer, space: SpaceForPageEdit): PageEditVerdict {
    if (space.isReadOnly || space.closedAt != null) {
        return {
            ok: false,
            reason: 'read-only',
            message: 'The space is closed or read-only; its pages cannot be changed.',
        };
    }
    if (viewer.administers || viewer.isSpaceOwner || viewer.role?.canPromoteBand || viewer.canEditSpaceSettings) {
        return { ok: true };
    }
    return {
        ok: false,
        reason: 'not-allowed',
        message: 'Only the space\'s owner, a seat that may promote the band, someone who can edit the space\'s settings, or a space administrator may create, edit, publish, or delete a page.',
    };
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

/** A file name a note's title makes: ASCII letters, digits and dashes, lower case, `.md`. */
export function noteFileName(title: string): string {
    const slug = title
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return `${slug || 'note'}.md`;
}

/** *Turn into document* (B21): the note as a Markdown file, titled, which the upload path files as a space item on the note's band. */
export function noteDocument(note: { Title: string; Body: string | null }): NoteDocument {
    const body = (note.Body ?? '').replace(/\r\n/g, '\n').trim();
    return { fileName: noteFileName(note.Title), mimeType: 'text/markdown', content: `# ${note.Title.trim()}\n\n${body}${body ? '\n' : ''}` };
}
