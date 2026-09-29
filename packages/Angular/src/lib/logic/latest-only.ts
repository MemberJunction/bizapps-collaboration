/**
 * Several reads of the same kind can be in flight at once (the Overview's messages, when the person changes conversation quickly),
 * and they finish in any order. `Begin()` marks a read as the newest; only the newest may write.
 */
export class LatestOnly {
    private latest = 0;

    /** Starts a read. The returned function is true only until a later read starts. */
    public Begin(): () => boolean {
        const mine = ++this.latest;
        return () => this.latest === mine;
    }
}
