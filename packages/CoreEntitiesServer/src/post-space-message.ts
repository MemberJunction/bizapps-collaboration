import { BaseEntity, LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { resolveSpaceAgentRetrieval, type SpaceAgentCandidateItem } from './space-agent-retrieval.js';
import { parseUuid } from './uuid.js';

const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
const DETAILS = 'MJ: Conversation Details';
const MESSAGE_CAP = 4000;
export const COLLABORATION_SPACE_AGENT_ID = '9E6D761A-197A-40AF-995B-3D3DD9BD7B9E';

export interface PostSpaceMessageInput {
    spaceId: string;
    text: string;
    executeAgent?: boolean;
}

export type PostSpaceMessageResult =
    | { ok: true; detailId: string; assistantDetailId?: string; quotedCount?: number; assistantError?: string }
    | { ok: false; message: string };

/**
 * A message in a space conversation.
 * The system user owns the room, so MJ's own write gate accepts the save.
 * If executeAgent is true, the Collaboration Space Agent is invoked server-side
 * after saving the human message, querying only items allowed by agentMayQuote.
 */
export async function postSpaceMessage(
    provider: IMetadataProvider,
    user: UserInfo,
    input: PostSpaceMessageInput,
): Promise<PostSpaceMessageResult> {
    const spaceId = parseUuid(input.spaceId);
    const callerId = parseUuid(user?.ID);
    const text = input.text.trim();
    if (!spaceId || !callerId) return { ok: false, message: 'The message needs a space and a signed-in person.' };
    if (!text) return { ok: false, message: 'The message is empty.' };
    if (text.length > MESSAGE_CAP) return { ok: false, message: `A message is limited to ${MESSAGE_CAP} characters.` };

    const probe = await provider.GetEntityObject<BaseEntity>('MJ_BizApps_Collaboration: Spaces', user);
    let context;
    try {
        context = await loadWriteContext(probe, user, spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'The space could not be read.' };
    }
    const system = await requireSystemUser(probe);
    const view = RunView.FromMetadataProvider(provider);
    const reach = membershipReaches(context.spaces, context.memberships, callerId, spaceId);
    if (!reach?.role.canContribute) return { ok: false, message: 'Your role on this space cannot post.' };
    const space = await view.RunView<{ ClosedAt: string | null }>({
        EntityName: 'MJ_BizApps_Collaboration: Spaces',
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ClosedAt'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!space.Success) return { ok: false, message: space.ErrorMessage || 'The space could not be read.' };
    if (space.Results?.[0]?.ClosedAt) return { ok: false, message: 'A closed space does not take a new message.' };

    const conversation = await view.RunView<{ ID: string }>({
        EntityName: 'MJ: Conversations',
        ExtraFilter: `LinkedEntityID = '${SPACES_ENTITY_ID}' AND LinkedRecordID = '${spaceId}'`,
        Fields: ['ID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!conversation.Success) return { ok: false, message: conversation.ErrorMessage || 'The conversation could not be read.' };
    const conversationId = parseUuid(conversation.Results?.[0]?.ID);
    if (!conversationId) return { ok: false, message: 'This space does not have a conversation yet.' };

    const detail = await provider.GetEntityObject<MJConversationDetailEntity>(DETAILS, system);
    detail.NewRecord();
    detail.ConversationID = conversationId;
    detail.UserID = callerId;
    detail.Role = 'User';
    detail.Message = text;
    detail.Status = 'Complete';
    detail.HiddenToUser = false;
    detail.IsPinned = false;
    detail.OriginalMessageChanged = false;
    if (!(await detail.Save()) || !detail.ID) {
        const message = detail.LatestResult?.CompleteMessage || 'The message was refused.';
        LogError(`Space message failed for space ${spaceId} and user ${callerId}: ${message}`);
        return { ok: false, message };
    }

    if (input.executeAgent) {
        try {
            const assistantResult = await postAssistantReply(provider, user, system, conversationId, spaceId);
            if (assistantResult.ok) {
                return {
                    ok: true,
                    detailId: detail.ID,
                    assistantDetailId: assistantResult.detailId,
                    quotedCount: assistantResult.quotedItems.length,
                };
            } else {
                LogError(`Space assistant message failed for space ${spaceId}: ${assistantResult.message}`);
                return {
                    ok: true,
                    detailId: detail.ID,
                    assistantError: assistantResult.message,
                };
            }
        } catch (error) {
            const errMessage = error instanceof Error ? error.message : String(error);
            LogError(`Space assistant message threw for space ${spaceId}: ${errMessage}`);
            return {
                ok: true,
                detailId: detail.ID,
                assistantError: errMessage,
            };
        }
    }

    return { ok: true, detailId: detail.ID };
}

/**
 * Room replies are visible to everyone who reaches the space (including participants
 * who can only see Shared items). The room reply therefore strictly names items
 * that everyone in the room can read: this space's own Shared items only.
 * Items in sub-spaces (even if Shared) have their own audience and cannot be quoted
 * in this space's room reply.
 */
export function filterRoomReplyItems(items: readonly SpaceAgentCandidateItem[], roomSpaceId: string): SpaceAgentCandidateItem[] {
    const normRoomId = roomSpaceId.trim().toUpperCase();
    return items.filter((item) => item.Band === 'Shared' && item.SpaceID.trim().toUpperCase() === normRoomId);
}

/**
 * Posts an assistant reply in the room, quoting strictly the items
 * permitted by agentMayQuote for the asking user that everyone in the room can read.
 */
async function postAssistantReply(
    provider: IMetadataProvider,
    user: UserInfo,
    system: UserInfo,
    conversationId: string,
    spaceId: string,
): Promise<{ ok: true; detailId: string; message: string; quotedItems: SpaceAgentCandidateItem[] } | { ok: false; message: string }> {
    const retrieval = await resolveSpaceAgentRetrieval(provider, user, spaceId);
    const roomQuoted = filterRoomReplyItems(retrieval.quotedItems, spaceId);
    let agentMessage: string;
    if (roomQuoted.length === 0) {
        agentMessage = 'I searched this space for materials within your reach, but found no matching items.';
    } else {
        const itemNames = roomQuoted.map((item) => item.Name).join(', ');
        agentMessage = `Based on materials in this space within your reach: ${itemNames}.`;
    }

    const assistantDetail = await provider.GetEntityObject<MJConversationDetailEntity>(DETAILS, system);
    assistantDetail.NewRecord();
    assistantDetail.ConversationID = conversationId;
    assistantDetail.UserID = system.ID;
    assistantDetail.AgentID = COLLABORATION_SPACE_AGENT_ID;
    assistantDetail.Role = 'AI';
    assistantDetail.Message = agentMessage;
    assistantDetail.Status = 'Complete';
    assistantDetail.HiddenToUser = false;
    assistantDetail.IsPinned = false;
    assistantDetail.OriginalMessageChanged = false;

    if (!(await assistantDetail.Save()) || !assistantDetail.ID) {
        const message = assistantDetail.LatestResult?.CompleteMessage || 'Failed to record assistant message';
        return { ok: false, message };
    }

    return {
        ok: true,
        detailId: assistantDetail.ID,
        message: agentMessage,
        quotedItems: roomQuoted,
    };
}

