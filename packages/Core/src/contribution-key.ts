/**
 * The one way keys of tabs and cards are compared, everywhere: the section, the deep links, the UI drivers and `Labels.Tabs`.
 * Case and padding don't matter, and `discussions` is another spelling of the Chat tab.
 */
export function normalizeContributionKey(key: string): string {
    const normalized = key.trim().toLowerCase();
    return normalized === 'discussions' ? 'chat' : normalized;
}
