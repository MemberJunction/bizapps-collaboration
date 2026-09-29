import { BaseEntity, LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import type { SpaceAgentCandidateItem } from './space-agent-retrieval.js';
import { resolveSpaceDriver } from './space-driver-call.js';
import { parseUuid } from './uuid.js';

const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
const DETAILS = 'MJ: Conversation Details';
const MESSAGE_CAP = 4000;

export interface PostSpaceMessageInput {
    spaceId: string;
    text: string;
    conversationId?: string;
}

export type PostSpaceMessageResult =
    | { ok: true; detailId: string; conversationId: string }
    | { ok: false; message: string };

/**
 * A message in a space conversation.
 * The system user owns the room, so MJ's own write gate accepts the save.
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

    const reach = membershipReaches(context.spaces, context.memberships, callerId, spaceId);
    if (!reach?.role.canContribute) return { ok: false, message: 'Your role on this space cannot post.' };

    // A type whose driver is missing refuses (fail closed); message hooks wait for MJ to say who wrote a message
    const driver = await resolveSpaceDriver(probe, provider, user, spaceId);
    if (!driver.ok) return { ok: false, message: driver.message };

    if (!input.conversationId) {
        return { ok: false, message: 'A conversation ID is required to post a message.' };
    }

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
    if (foundChat.Kind === 'Private' && !reach.role.canSeeTeamBand) {
        return { ok: false, message: 'Caller cannot post in this internal conversation without Team visibility.' };
    }
    const conversationId = parsedTarget;

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
    return { ok: true, detailId: detail.ID, conversationId };
}

/**
 * An agent's chat reply is visible to everyone who reaches the space (including participants
 * who can only see Shared items). The reply therefore names only items
 * that everyone in the space can read: this space's own Shared items.
 * Items in sub-spaces (even if Shared) have their own audience and cannot be quoted
 * in this space's reply.
 */
export function filterRoomReplyItems(items: readonly SpaceAgentCandidateItem[], roomSpaceId: string): SpaceAgentCandidateItem[] {
    const normRoomId = roomSpaceId.trim().toUpperCase();
    return items.filter((item) => item.Band === 'Shared' && item.SpaceID.trim().toUpperCase() === normRoomId);
}

