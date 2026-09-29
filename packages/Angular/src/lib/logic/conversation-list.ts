import { UUIDsEqual } from '@memberjunction/global';
import type { SpaceConversationItem } from '@mj-biz-apps/collaboration-ng-widgets';

/** A space chat row as the rail reads it. */
export interface ChatRow {
    ConversationID: string;
    Name: string | null;
    Kind: string | null;
}

/** One entry per conversation, whatever the casing of its ID, in the order the rows came. */
export function buildConversationEntries(rows: readonly ChatRow[]): SpaceConversationItem[] {
    const seen = new Set<string>();
    const entries: SpaceConversationItem[] = [];
    for (const row of rows) {
        if (!row.ConversationID) continue;
        const key = row.ConversationID.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({
            id: row.ConversationID,
            name: row.Name || 'General',
            kind: row.Kind || 'General',
            band: row.Kind === 'Private' ? 'Team' : 'Shared',
            unreadCount: 0,
        });
    }
    return entries;
}

/** The conversation to open: the one asked for when the space has it, else the first, else none. */
export function chooseActiveConversation(entries: readonly SpaceConversationItem[], preferredId?: string | null): SpaceConversationItem | null {
    if (preferredId) {
        const preferred = entries.find((entry) => UUIDsEqual(entry.id, preferredId));
        if (preferred) return preferred;
    }
    return entries[0] ?? null;
}
