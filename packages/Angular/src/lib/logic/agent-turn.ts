import type { ExecuteSpaceChatTurnGraphQLInput, ExecuteSpaceChatTurnGraphQLPayload } from '@mj-biz-apps/collaboration-entities';

/** What MemberJunction's chat area asks a host for, of the fields the space's turn reads. */
export interface SpaceTurnRequest {
    ConversationId: string;
    UserMessageId: string;
    AgentId: string;
    Route?: string;
}

export interface SpaceTurnCitation {
    SpaceItemID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Name: string;
    Band: 'Shared' | 'Team';
}

/** What the host answers the chat area with: the reply rows it wrote, and the run that is answering. */
export interface SpaceTurnResult {
    Success: boolean;
    ErrorMessage?: string;
    ReplyDetailIds?: string[];
    AgentRunId?: string;
    Citations?: SpaceTurnCitation[];
}

/**
 * The space's turn, as the page asks the server for it. Always in the background: the call answers once the reply row is
 * written In-Progress, and the run's live status and text reach this session as they happen, the way MemberJunction's chat
 * follows any conversation's agent. Without `Background` the row would sit at "Starting…" until the whole run returned.
 */
export function spaceTurnInput(
    spaceId: string,
    request: SpaceTurnRequest,
    retrievalScope?: 'ThisSpace' | 'Subtree' | 'Everything',
): ExecuteSpaceChatTurnGraphQLInput {
    return {
        SpaceID: spaceId,
        ConversationID: request.ConversationId,
        UserMessageID: request.UserMessageId,
        AgentID: request.AgentId,
        ...(request.Route ? { Route: request.Route } : {}),
        ...(retrievalScope ? { RetrievalScope: retrievalScope } : {}),
        Background: true,
    };
}

/** The server's answer, in the chat area's words. */
export function spaceTurnResult(payload: ExecuteSpaceChatTurnGraphQLPayload): SpaceTurnResult {
    let citations: SpaceTurnCitation[] | undefined;
    if (payload.CitationsJSON) {
        try {
            const parsed = JSON.parse(payload.CitationsJSON) as SpaceTurnCitation[];
            if (Array.isArray(parsed)) {
                citations = parsed;
            }
        } catch {
            citations = undefined;
        }
    }
    return {
        Success: payload.Success,
        ErrorMessage: payload.ErrorMessage,
        ReplyDetailIds: payload.ReplyDetailIDs,
        AgentRunId: payload.AgentRunID,
        ...(citations ? { Citations: citations } : {}),
    };
}

/** A turn that threw before the server answered: the chat hears why, and no reply row. */
export function spaceTurnFailure(error: unknown): SpaceTurnResult {
    return { Success: false, ErrorMessage: error instanceof Error ? error.message : 'The chat turn failed.' };
}
