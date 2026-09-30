import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLOSED_CHAT_NOTE, chatState, noSeatChatNote } from './chat-state.ts';

describe('the state of the Chat tab', () => {
    it('is closed, with the closed note, when the space is closed, whatever the seat', () => {
        assert.deepEqual(chatState({ isClosed: true, seatKnown: true, canContribute: true, overList: false }), { kind: 'closed', note: CLOSED_CHAT_NOTE });
        assert.deepEqual(chatState({ isClosed: true, seatKnown: false, canContribute: false, overList: true }), { kind: 'closed', note: CLOSED_CHAT_NOTE });
    });

    it('is pending, with neither composer nor note, until the seat is known: an owner opening a space is not told they cannot post', () => {
        assert.deepEqual(chatState({ isClosed: false, seatKnown: false, canContribute: false, overList: false }), { kind: 'pending' });
        assert.deepEqual(chatState({ isClosed: false, seatKnown: false, canContribute: true, overList: true }), { kind: 'pending' });
    });

    it("says there is no seat that lets them post, in words for one conversation or for the space's list of them", () => {
        assert.deepEqual(chatState({ isClosed: false, seatKnown: true, canContribute: false, overList: false }), { kind: 'noSeat', note: noSeatChatNote(false) });
        assert.deepEqual(chatState({ isClosed: false, seatKnown: true, canContribute: false, overList: true }), { kind: 'noSeat', note: noSeatChatNote(true) });
        assert.match(noSeatChatNote(false), /this conversation/);
        assert.match(noSeatChatNote(true), /this space's conversations/);
    });

    it('is open when the seat is known and may post', () => {
        assert.deepEqual(chatState({ isClosed: false, seatKnown: true, canContribute: true, overList: false }), { kind: 'open' });
    });
});
