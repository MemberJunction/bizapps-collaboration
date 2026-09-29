/** What the server says closing a space would do (see `GetCloseConsequence`). */
export interface CloseConsequenceRead {
    access: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None';
    days: number | null;
    keeperUserId: string;
    keeperName: string;
    keeperCanReopen: boolean;
}

/**
 * What closing a space does, in words for the confirmation: the post-close access the close will stamp, and, once access has
 * ended, who keeps the space and whether they can reopen it. Only the space's owner (its `OwnerID`) keeps the row of a space whose
 * access has ended. The owner is named ("you" when it is the viewer), and anyone else is told they will lose it.
 * `read` is null while the server has not answered, or could not.
 */
export function closeConsequence(read: CloseConsequenceRead | null, viewerUserId: string | null | undefined): string {
    if (!read) return "The server couldn't say what closing does to this space. Closing is undone only by its owner.";
    const viewerKeeps = !!viewerUserId && viewerUserId.toLowerCase() === read.keeperUserId.toLowerCase();
    const keeper = viewerKeeps ? 'you' : read.keeperName;
    const reopen = read.keeperCanReopen
        ? `${keeper}, who can reopen it`
        : `${keeper}, who holds no owner seat or lacks the right to reopen it, so no one can reopen it from the app`;
    const losing = viewerKeeps ? '' : " You won't see it again.";
    if (read.access === 'ReadOnly' || read.access === 'ReadOnlyWithAgent') {
        if (read.days === null || read.days === undefined) return 'It becomes read-only for everyone.';
        return `It becomes read-only for everyone for ${read.days} ${read.days === 1 ? 'day' : 'days'}. After that it disappears for everyone but ${reopen}.${losing}`;
    }
    return `It disappears for everyone but ${reopen}.${losing}`;
}
