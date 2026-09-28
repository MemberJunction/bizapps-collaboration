import { RunView, type IMetadataProvider, type UserInfo, LogError } from '@memberjunction/core';
import type { MJConversationEntity } from '@memberjunction/core-entities';
import type { mjBizAppsCollaborationSpaceChatEntity } from '@mj-biz-apps/collaboration-entities';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { syncRoomEditGrantsForSpace } from './room-edit-grants.js';
import { parseUuid } from './uuid.js';

const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';

export interface CreateSpaceConversationInput {
    SpaceID: string;
    Name: string;
    Kind?: 'Room' | 'General' | 'Topic' | 'Private';
}

export interface CreateSpaceConversationResult {
    ok: boolean;
    message?: string;
    conversationId?: string;
    spaceChatId?: string;
    name?: string;
    kind?: string;
}

export async function createSpaceConversation(
    provider: IMetadataProvider,
    user: UserInfo,
    input: CreateSpaceConversationInput,
): Promise<CreateSpaceConversationResult> {
    const spaceId = parseUuid(input.SpaceID);
    if (!spaceId) {
        return { ok: false, message: 'Invalid Space ID.' };
    }

    const rawName = input.Name?.trim() ?? '';
    const cleanName = rawName.startsWith('#') ? rawName.slice(1).trim() : rawName;
    if (!cleanName) {
        return { ok: false, message: 'Conversation name cannot be empty.' };
    }

    const probe = await provider.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>('MJ_BizApps_Collaboration: Space Chats', user);
    let context;
    try {
        context = await loadWriteContext(probe, user, spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'The space could not be read.' };
    }

    const targetSpace = context.spaces.find(s => s.id === spaceId);
    if (!targetSpace) {
        return { ok: false, message: 'Space not found or caller cannot access this space.' };
    }
    if (targetSpace.closedAt) {
        return { ok: false, message: 'Cannot create conversation in a closed space.' };
    }

    const reach = membershipReaches(context.spaces, context.memberships, user.ID, spaceId);
    if (!reach?.role.canContribute) {
        return { ok: false, message: 'Caller does not have permission to create conversations in this space.' };
    }

    const system = await requireSystemUser(probe);
    const view = RunView.FromMetadataProvider(provider);

    // Check if an active Room already exists for this space
    const roomCheck = await view.RunView<{ ID: string; ConversationID: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Chats',
        ExtraFilter: `SpaceID = '${spaceId}' AND Kind = 'Room' AND Status = 'Active'`,
        Fields: ['ID', 'ConversationID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    const hasActiveRoom = roomCheck.Success && (roomCheck.Results?.length ?? 0) > 0;

    let targetKind = input.Kind ?? (hasActiveRoom ? 'General' : 'Room');
    if (targetKind === 'Room' && hasActiveRoom) {
        // Space already has an active room; fallback to General so we don't violate the single active room rule
        targetKind = 'General';
    }

    // Create Conversation
    const conversation = await provider.GetEntityObject<MJConversationEntity>('MJ: Conversations', system);
    conversation.NewRecord();
    conversation.LinkedEntityID = SPACES_ENTITY_ID;
    conversation.LinkedRecordID = spaceId;
    conversation.Name = cleanName;
    conversation.UserID = targetKind === 'Room' ? system.ID : user.ID;
    conversation.ApplicationScope = 'Application';
    conversation.ApplicationID = COLLABORATION_APP_ID;
    const convSaved = await conversation.Save();
    if (!convSaved || !conversation.ID) {
        const msg = conversation.LatestResult?.CompleteMessage || 'Failed to create conversation record.';
        LogError(`createSpaceConversation failed for space ${spaceId}: ${msg}`);
        return { ok: false, message: msg };
    }

    const convId = conversation.ID;

    // Create Space Chat
    const spaceChat = await provider.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>('MJ_BizApps_Collaboration: Space Chats', system);
    spaceChat.NewRecord();
    spaceChat.SpaceID = spaceId;
    spaceChat.ConversationID = convId;
    spaceChat.Name = cleanName;
    spaceChat.Kind = targetKind;
    spaceChat.Status = 'Active';
    const chatSaved = await spaceChat.Save();
    if (!chatSaved || !spaceChat.ID) {
        const msg = spaceChat.LatestResult?.CompleteMessage || 'Failed to create space chat record.';
        LogError(`createSpaceConversation chat save failed for space ${spaceId}: ${msg}`);
        await conversation.Delete();
        return { ok: false, message: msg };
    }

    if (targetKind === 'Room') {
        try {
            await syncRoomEditGrantsForSpace(provider, spaceId);
        } catch (grantErr) {
            LogError(`Failed to sync room edit grants after room creation for space ${spaceId}: ${grantErr instanceof Error ? grantErr.message : String(grantErr)}`);
        }
    }

    return {
        ok: true,
        conversationId: convId,
        spaceChatId: spaceChat.ID,
        name: cleanName,
        kind: targetKind,
    };
}
