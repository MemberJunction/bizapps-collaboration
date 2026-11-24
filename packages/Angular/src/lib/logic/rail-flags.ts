/** How the space tree draws a space that is closed: dimmed, with a lock. An open space has neither. */
export function railFlags(space: { ClosedAt?: Date | string | null }): { isDim: boolean; isLocked: boolean } {
    const closed = !!space.ClosedAt;
    return { isDim: closed, isLocked: closed };
}
