/** One row of the conversation as the Overview reads it. */
export interface OverviewMessageRow {
    ID: string;
    Role: string;
    Message: string;
    User?: string;
    UserID?: string | null;
    __mj_CreatedAt: string;
}

/** One line of the Discussion card. */
export interface OverviewMessage {
    id: string;
    senderName: string;
    senderInitials: string;
    senderColorClass: string;
    isOutside: boolean;
    isAssistant: boolean;
    timestamp: string;
    text: string;
}

function initialsOf(name: string): string {
    return name.split(' ').filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * Turns a conversation's newest rows into the card's lines, oldest first, the last five. `toPlainText` turns the stored mention form
 * (`@{"type":"agent",…} question`) into the words a person typed; `isOutsideUser` says whether a sender holds an outside seat.
 */
export function toOverviewMessages(
    rows: readonly OverviewMessageRow[],
    toPlainText: (message: string) => string,
    isOutsideUser: (userId: string) => boolean,
    formatTime: (iso: string) => string,
): OverviewMessage[] {
    return [...rows].reverse().map((row) => {
        const isAssistant = row.Role === 'AI';
        const name = isAssistant ? 'Assistant' : row.User || 'Team Member';
        return {
            id: row.ID,
            senderName: name,
            senderInitials: isAssistant ? 'AI' : (row.User ? initialsOf(row.User) : 'TM'),
            senderColorClass: isAssistant ? 'c1' : 'c2',
            isOutside: !isAssistant && !!row.UserID && isOutsideUser(row.UserID),
            isAssistant,
            timestamp: formatTime(row.__mj_CreatedAt),
            text: toPlainText(row.Message),
        };
    }).slice(-5);
}
