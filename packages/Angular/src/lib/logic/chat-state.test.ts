import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLOSED_CHAT_NOTE, SEAT_UNKNOWN_CHAT_NOTE, chatState, noSeatChatNote } from './chat-state.ts';

describe('the state of the Chat tab', () => {
    it('is closed, with the closed note, when the space is closed, whatever the seat', () => {
        assert.deepEqual(chatState({ isClosed: true, seat: 'known', canContribute: true, overList: false }), { kind: 'closed', note: CLOSED_CHAT_NOTE });
        assert.deepEqual(chatState({ isClosed: true, seat: 'pending', canContribute: false, overList: true }), { kind: 'closed', note: CLOSED_CHAT_NOTE });
    });

    it('is pending, with neither composer nor note, until the seat is known: an owner opening a space is not told they cannot post', () => {
        assert.deepEqual(chatState({ isClosed: false, seat: 'pending', canContribute: false, overList: false }), { kind: 'pending' });
        assert.deepEqual(chatState({ isClosed: false, seat: 'pending', canContribute: true, overList: true }), { kind: 'pending' });
    });

    it("says there is no seat that lets them post, in words for one conversation or for the space's list of them", () => {
        assert.deepEqual(chatState({ isClosed: false, seat: 'known', canContribute: false, overList: false }), { kind: 'noSeat', note: noSeatChatNote(false) });
        assert.deepEqual(chatState({ isClosed: false, seat: 'known', canContribute: false, overList: true }), { kind: 'noSeat', note: noSeatChatNote(true) });
        assert.match(noSeatChatNote(false), /this conversation/);
        assert.match(noSeatChatNote(true), /this space's conversations/);
    });

    it("says it couldn't check, not that there is no seat, when the seat lookup failed: an owner whose lookup failed is not told they can't post for want of a seat", () => {
        const failed = chatState({ isClosed: false, seat: 'failed', canContribute: false, overList: false });
        assert.deepEqual(failed, { kind: 'seatUnknown', note: SEAT_UNKNOWN_CHAT_NOTE });
        assert.doesNotMatch(SEAT_UNKNOWN_CHAT_NOTE, /no seat/);
        // A closed space still says it is closed: that is known whatever became of the seat
        assert.equal(chatState({ isClosed: true, seat: 'failed', canContribute: false, overList: false }).kind, 'closed');
    });

    it('is open when the seat is known and may post', () => {
        assert.deepEqual(chatState({ isClosed: false, seat: 'known', canContribute: true, overList: false }), { kind: 'open' });
    });
});
