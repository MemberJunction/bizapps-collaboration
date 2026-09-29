import type { LatestOnly } from './latest-only.js';

/** What a pick came to: its value while it is still the latest, or that a later pick (or a reset) has replaced it. */
export type PickOutcome<T> = { status: 'current'; value: T } | { status: 'failed'; error: unknown } | { status: 'stale' };

/**
 * The kinds picked in the New space dialog. Making a draft for a kind takes a moment, so picks overlap, and they finish in any
 * order: only the latest may put its draft on the screen. A `Reset` (the dialog closed, or opened again) makes every pick still
 * in flight stale, so a draft from an earlier opening can't land in a later one.
 */
export class NewSpacePicks {
    private readonly latest: LatestOnly;

    /** `latest` is the page's own `LatestOnly`: the rule that only the newest of overlapping reads may write. */
    constructor(latest: LatestOnly) {
        this.latest = latest;
    }

    /** Drops every pick still in flight. */
    public Reset(): void {
        this.latest.Begin();
    }

    /** Runs a pick. A pick that fails after a later one started is stale too: its error is nobody's to show. */
    public async Pick<T>(start: () => Promise<T>): Promise<PickOutcome<T>> {
        const isLatest = this.latest.Begin();
        try {
            const value = await start();
            return isLatest() ? { status: 'current', value } : { status: 'stale' };
        } catch (error) {
            return isLatest() ? { status: 'failed', error } : { status: 'stale' };
        }
    }
}
