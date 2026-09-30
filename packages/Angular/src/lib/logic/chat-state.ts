/**
 * What the Chat tab is in, decided once, from what the page knows: the space's closure, whether the caller's seat is known yet,
 * and whether that seat may post. Until the seat is known, the chat shows neither a composer nor a note: for a moment after a
 * space opens, nobody, owners included, is told they can't post. A closed space says so. A person with no seat that lets them
 * post is told that, in words that fit where the lock is: over one conversation, or over the list of them.
 */
export type ChatState =
    | { kind: 'closed'; note: string }
    | { kind: 'pending' }
    | { kind: 'noSeat'; note: string }
    | { kind: 'open' };

export interface ChatStateInput {
    /** The space is closed: conversations are read-only for everyone. */
    isClosed: boolean;
    /** The caller's seat on this space has been resolved, whether or not they have one. */
    seatKnown: boolean;
    /** The resolved seat may post. Meaningless while `seatKnown` is false. */
    canContribute: boolean;
    /** The lock stands over the list of conversations rather than over one of them. */
    overList: boolean;
}

export const CLOSED_CHAT_NOTE = 'This space is closed. Conversations are read-only.';

export function noSeatChatNote(overList: boolean): string {
    return overList
        ? "You can read this space's conversations but can't post in them: you have no seat in this space that lets you post."
        : "You can read this conversation but can't post in it: you have no seat in this space that lets you post.";
}

export function chatState(input: ChatStateInput): ChatState {
    if (input.isClosed) return { kind: 'closed', note: CLOSED_CHAT_NOTE };
    if (!input.seatKnown) return { kind: 'pending' };
    if (!input.canContribute) return { kind: 'noSeat', note: noSeatChatNote(input.overList) };
    return { kind: 'open' };
}
