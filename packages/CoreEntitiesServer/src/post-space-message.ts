import { BaseEntity, LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { membershipReaches, ResolveSpaceRules, type ISpaceConfiguration, type ISpaceTypeConfiguration } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
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
    conversationId?: string;
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
    const space = await view.RunView<{ ClosedAt: string | null; SpaceTypeID: string | null; Configuration: string | null }>({
        EntityName: 'MJ_BizApps_Collaboration: Spaces',
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ClosedAt', 'SpaceTypeID', 'Configuration'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!space.Success) return { ok: false, message: space.ErrorMessage || 'The space could not be read.' };
    const targetSpace = space.Results?.[0];
    if (targetSpace?.ClosedAt) return { ok: false, message: 'A closed space does not take a new message.' };

    let conversationId: string | null = null;
    if (input.conversationId) {
        const parsedTarget = parseUuid(input.conversationId);
        if (!parsedTarget) {
            return { ok: false, message: 'The conversation ID is invalid.' };
        }
        const chatCheck = await view.RunView<{ ID: string; ConversationID: string; Kind: string }>({
            EntityName: 'MJ_BizApps_Collaboration: Space Chats',
            ExtraFilter: `SpaceID = '${spaceId}' AND ConversationID = '${parsedTarget}' AND Status = 'Active'`,
            Fields: ['ID', 'ConversationID', 'Kind'],
            MaxRows: 1,
            ResultType: 'simple',
        }, system);
        if (!chatCheck.Success) return { ok: false, message: chatCheck.ErrorMessage || 'The space chat could not be read.' };
        const foundChat = chatCheck.Results?.[0];
        if (!foundChat?.ConversationID) {
            return { ok: false, message: 'The conversation does not belong to this space.' };
        }
        if (foundChat.Kind !== 'Room') {
            return { ok: false, message: 'Only the space Room accepts messages.' };
        }
        conversationId = parsedTarget;
    } else {
        const roomChat = await view.RunView<{ ID: string; ConversationID: string }>({
            EntityName: 'MJ_BizApps_Collaboration: Space Chats',
            ExtraFilter: `SpaceID = '${spaceId}' AND Kind = 'Room' AND Status = 'Active'`,
            Fields: ['ID', 'ConversationID'],
            MaxRows: 1,
            ResultType: 'simple',
        }, system);
        if (!roomChat.Success) return { ok: false, message: roomChat.ErrorMessage || 'The space room could not be read.' };
        conversationId = parseUuid(roomChat.Results?.[0]?.ConversationID);
        if (!conversationId) return { ok: false, message: 'This space does not have an active room yet.' };
    }

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
    const saved = await detail.Save();
    if (!saved || !detail.ID) {
        const message = detail.LatestResult?.CompleteMessage || detail.LatestResult?.Message || 'The message was refused.';
        LogError(`Space message failed for space ${spaceId} and user ${callerId}: ${message}`);
        return { ok: false, message };
    }

    let typeConfig: ISpaceTypeConfiguration | null = null;
    if (targetSpace?.SpaceTypeID) {
        await CollaborationEngine.Instance.EnsureLoaded(undefined, provider);
        const spaceType = CollaborationEngine.Instance.SpaceTypeById(targetSpace.SpaceTypeID);
        if (spaceType?.Configuration) {
            try {
                typeConfig = JSON.parse(spaceType.Configuration) as ISpaceTypeConfiguration;
            } catch {
                typeConfig = null;
            }
        }
    }
    let spaceConfig: ISpaceConfiguration | null = null;
    if (targetSpace?.Configuration) {
        try {
            spaceConfig = JSON.parse(targetSpace.Configuration) as ISpaceConfiguration;
        } catch {
            spaceConfig = null;
        }
    }
    const rules = ResolveSpaceRules(typeConfig, spaceConfig);
    const hasMention = /(@(assistant|agent)|^\/ask)/i.test(text);
    const shouldExecuteAgent = rules.Chats.AgentReplyMode === 'Always'
        ? true
        : Boolean(input.executeAgent || hasMention);

    if (shouldExecuteAgent) {
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

