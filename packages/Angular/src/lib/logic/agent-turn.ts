import type { ExecuteSpaceChatTurnGraphQLInput, ExecuteSpaceChatTurnGraphQLPayload } from '@mj-biz-apps/collaboration-entities';

/** What MemberJunction's chat area asks a host for, of the fields the space's turn reads. */
export interface SpaceTurnRequest {
    ConversationId: string;
    UserMessageId: string;
    AgentId: string;
}

/** What the host answers the chat area with: the reply rows it wrote, and the run that is answering. */
export interface SpaceTurnResult {
    Success: boolean;
    ErrorMessage?: string;
    ReplyDetailIds?: string[];
    AgentRunId?: string;
}

/**
 * The space's turn, as the page asks the server for it. Always in the background: the call answers once the reply row is
 * written In-Progress, and the run's live status and text reach this session as they happen, the way MemberJunction's chat
 * follows any conversation's agent. Without `Background` the row would sit at "Starting…" until the whole run returned.
 */
export function spaceTurnInput(spaceId: string, request: SpaceTurnRequest): ExecuteSpaceChatTurnGraphQLInput {
    return {
        SpaceID: spaceId,
        ConversationID: request.ConversationId,
        UserMessageID: request.UserMessageId,
        AgentID: request.AgentId,
        Background: true,
    };
}

/** The server's answer, in the chat area's words. */
export function spaceTurnResult(payload: ExecuteSpaceChatTurnGraphQLPayload): SpaceTurnResult {
    return {
        Success: payload.Success,
        ErrorMessage: payload.ErrorMessage,
        ReplyDetailIds: payload.ReplyDetailIDs,
        AgentRunId: payload.AgentRunID,
    };
}

/** A turn that threw before the server answered: the chat hears why, and no reply row. */
export function spaceTurnFailure(error: unknown): SpaceTurnResult {
    return { Success: false, ErrorMessage: error instanceof Error ? error.message : 'The chat turn failed.' };
}
