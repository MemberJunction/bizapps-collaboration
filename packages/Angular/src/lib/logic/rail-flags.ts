/** How the space tree draws a space that is closed: dimmed, with a lock. An open space has neither. */
export function railFlags(space: { ClosedAt?: Date | string | null }): { isDim: boolean; isLocked: boolean } {
    const closed = !!space.ClosedAt;
    return { isDim: closed, isLocked: closed };
}

/** Which page the rail shows: the home rail on Home and on the pages that aren't a space (inbox, tasks, files). */
export function railModeFor(activeView: string): 'home' | 'space' {
    return ['space', 'assistant', 'settings'].includes(activeView) ? 'space' : 'home';
}
