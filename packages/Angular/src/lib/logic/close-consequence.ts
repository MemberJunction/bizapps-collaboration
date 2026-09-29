/**
 * What closing a space does, from the post-close access it will be closed under: shown where the person confirms the close.
 * Only the space's owner (its OwnerID) keeps the row of a space whose access has ended, so it is the owner who can reopen it.
 */
export function closeConsequence(access: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None' | null | undefined, days: number | null | undefined): string {
    if (access === 'ReadOnly' || access === 'ReadOnlyWithAgent') {
        return days === null || days === undefined
            ? 'It becomes read-only for everyone.'
            : `It becomes read-only for everyone for ${days} ${days === 1 ? 'day' : 'days'}. After that it disappears for everyone but its owner, who can reopen it.`;
    }
    return 'It disappears for everyone but its owner, who can reopen it.';
}
