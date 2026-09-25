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
    | { ok: true; detailId: string; assistantDetailId?: string; quotedCount?: number }
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
    const reach = membershipReaches(context.spaces, context.memberships, callerId, spaceId);
    if (!reach?.role.canContribute) return { ok: false, message: 'Your role on this space cannot post.' };

    const system = await requireSystemUser(probe);
    const view = RunView.FromMetadataProvider(provider);
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
        const retrieval = await resolveSpaceAgentRetrieval(provider, user, spaceId);
        let agentMessage: string;
        if (retrieval.quotedItems.length === 0) {
            agentMessage = 'I searched this space for materials within your reach, but found no matching items.';
        } else {
            const itemNames = retrieval.quotedItems.map((item) => item.Name).join(', ');
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
            const message = assistantDetail.LatestResult?.CompleteMessage || 'The assistant message was refused.';
            LogError(`Space assistant message failed for space ${spaceId}: ${message}`);
            return { ok: false, message };
        }

        return {
            ok: true,
            detailId: detail.ID,
            assistantDetailId: assistantDetail.ID,
            quotedCount: retrieval.quotedItems.length,
        };
    }

    return { ok: true, detailId: detail.ID };
}

/**
 * Runs the Collaboration Space Agent in the room, quoting strictly the items
 * permitted by agentMayQuote for the asking user.
 */
export async function executeRoomAgent(
    provider: IMetadataProvider,
    user: UserInfo,
    input: { spaceId: string; userMessage?: string },
): Promise<{ ok: true; detailId: string; message: string; quotedItems: SpaceAgentCandidateItem[] } | { ok: false; message: string }> {
    const spaceId = parseUuid(input.spaceId);
    const callerId = parseUuid(user?.ID);
    if (!spaceId || !callerId) return { ok: false, message: 'Invalid space ID or user' };

    const probe = await provider.GetEntityObject<BaseEntity>('MJ_BizApps_Collaboration: Spaces', user);
    let context;
    try {
        context = await loadWriteContext(probe, user, spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'The space could not be read.' };
    }
    const reach = membershipReaches(context.spaces, context.memberships, callerId, spaceId);
    if (!reach?.role.canContribute) return { ok: false, message: 'Your role on this space cannot invoke the agent.' };

    const system = await requireSystemUser(probe);
    const view = RunView.FromMetadataProvider(provider);
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

    const retrieval = await resolveSpaceAgentRetrieval(provider, user, spaceId);
    let agentMessage: string;
    if (retrieval.quotedItems.length === 0) {
        agentMessage = 'I searched this space for materials within your reach, but found no matching items.';
    } else {
        const itemNames = retrieval.quotedItems.map((item) => item.Name).join(', ');
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
        LogError(`executeRoomAgent failed for space ${spaceId}: ${message}`);
        return { ok: false, message };
    }

    return {
        ok: true,
        detailId: assistantDetail.ID,
        message: agentMessage,
        quotedItems: retrieval.quotedItems,
    };
}
