import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spaceTurnFailure, spaceTurnInput, spaceTurnResult } from './agent-turn.ts';

describe("the space's agent turn, as the page asks for it", () => {
    it('always runs in the background, so the chat follows the reply row live instead of waiting for the whole run', () => {
        const input = spaceTurnInput('space-1', { ConversationId: 'conv-1', UserMessageId: 'msg-1', AgentId: 'agent-1' });
        assert.equal(input.Background, true);
        assert.deepEqual(input, { SpaceID: 'space-1', ConversationID: 'conv-1', UserMessageID: 'msg-1', AgentID: 'agent-1', Background: true });
    });

    it("answers the chat area in its own words: the reply rows and the run, or the server's refusal", () => {
        assert.deepEqual(spaceTurnResult({ Success: true, ReplyDetailIDs: ['r1'], AgentRunID: 'run-1', QuotedCount: 2 }), { Success: true, ErrorMessage: undefined, ReplyDetailIds: ['r1'], AgentRunId: 'run-1' });
        assert.deepEqual(spaceTurnResult({ Success: false, ErrorMessage: 'No assistant is available.' }), { Success: false, ErrorMessage: 'No assistant is available.', ReplyDetailIds: undefined, AgentRunId: undefined });
    });

    it('turns a thrown error into a failed turn with its message, and a plain reason for anything else', () => {
        assert.deepEqual(spaceTurnFailure(new Error('socket closed')), { Success: false, ErrorMessage: 'socket closed' });
        assert.deepEqual(spaceTurnFailure('?'), { Success: false, ErrorMessage: 'The chat turn failed.' });
    });
});
