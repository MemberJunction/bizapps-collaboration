/**
 * Which notes the Notes tab shows a viewer. The server's row filter already keeps another person's private note from a UI-role
 * reader; a viewer whose other roles read the entity without that filter (a developer, an owner of the installation) is shown
 * the same: a private note is its author's alone, whatever the reader's roles.
 */
export interface NoteVisibilityRow {
    Visibility: 'Space' | 'Private';
    AuthorUserID: string;
}

const same = (a: string | null | undefined, b: string | null | undefined): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function notesVisibleTo<T extends NoteVisibilityRow>(rows: readonly T[], viewerUserId: string | null | undefined): T[] {
    return rows.filter((row) => row.Visibility !== 'Private' || same(row.AuthorUserID, viewerUserId));
}
