import {
    type IMetadataProvider,
    type UserInfo,
    LogError,
} from '@memberjunction/core';
import type { MJConversationEntity } from '@memberjunction/core-entities';
import type { mjBizAppsCollaborationSpaceChatEntity } from '@mj-biz-apps/collaboration-entities';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { resolveSpaceChatSettings } from './resolve-space-chat-settings.js';
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

/**
 * Creates a new conversation in a space (Item 23).
 *
 * Rules:
 * - Who can start one: a seat that passes Chats.WhoCanStart from the settings chain
 *   and can post in the kind it picks.
 * - Ownership: the system user owns the new conversation, as it owns the room.
 * - Atomicity: the conversation and SpaceChat row save in one transaction, with no fallback.
 * - Edit grants sync to eligible seats based on kind (Private requires Team visibility).
 */
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
    if (!reach) {
        return { ok: false, message: 'Caller does not reach this space.' };
    }

    // 1. Check Chats.WhoCanStart from settings chain
    const chatSettings = await resolveSpaceChatSettings(provider, spaceId, user);
    const whoCanStart = chatSettings.resolvedSettings.Chats?.WhoCanStart ?? 'Anyone';

    if (whoCanStart === 'Owners' && !reach.role.isOwnerRole) {
        return { ok: false, message: 'Only space owners can start conversations in this space.' };
    }
    if (whoCanStart === 'Contributors' && !reach.role.canContribute) {
        return { ok: false, message: 'Only contributors can start conversations in this space.' };
    }

    const targetKind = input.Kind ?? 'General';
    if (targetKind === 'Room') {
        return { ok: false, message: 'Room conversations cannot be created on demand.' };
    }

    // 2. Check if caller can post in the selected kind
    if (!reach.role.canContribute) {
        return { ok: false, message: 'Caller does not have permission to post in this conversation.' };
    }
    if (targetKind === 'Private' && !reach.role.canSeeTeamBand) {
        return { ok: false, message: 'Caller cannot start an Internal Only conversation without Team visibility.' };
    }

    const system = await requireSystemUser(probe);

    // 3. Create Conversation and SpaceChat in one transaction owned by system user
    const conversation = await provider.GetEntityObject<MJConversationEntity>('MJ: Conversations', system);
    conversation.NewRecord();
    // Non-room space conversations link to the space via SpaceChat, preserving the single-room entity link
    conversation.Name = cleanName;
    conversation.UserID = system.ID;
    conversation.ApplicationScope = 'Application';
    conversation.ApplicationID = COLLABORATION_APP_ID;

    const spaceChat = await provider.GetEntityObject<mjBizAppsCollaborationSpaceChatEntity>('MJ_BizApps_Collaboration: Space Chats', system);
    spaceChat.NewRecord();
    spaceChat.SpaceID = spaceId;
    spaceChat.ConversationID = conversation.ID;
    spaceChat.Name = cleanName;
    spaceChat.Kind = targetKind;
    spaceChat.Status = 'Active';

    if (typeof provider.CreateTransactionGroup === 'function') {
        const tg = await provider.CreateTransactionGroup();
        conversation.TransactionGroup = tg;
        spaceChat.TransactionGroup = tg;
        await conversation.Save();
        await spaceChat.Save();
        const submitted = await tg.Submit();
        if (!submitted || !conversation.ID || !spaceChat.ID) {
            const msg = conversation.LatestResult?.CompleteMessage || spaceChat.LatestResult?.CompleteMessage || 'Failed to submit conversation creation transaction.';
            LogError(`createSpaceConversation transaction failed for space ${spaceId}: ${msg}`);
            return { ok: false, message: msg };
        }
    } else {
        LogError(`createSpaceConversation requires CreateTransactionGroup`);
        return { ok: false, message: 'Transaction group not available.' };
    }

    // 4. Sync edit grants across all active space chats
    try {
        await syncRoomEditGrantsForSpace(provider, spaceId);
    } catch (grantErr) {
        LogError(`Failed to sync room edit grants after conversation creation for space ${spaceId}: ${grantErr instanceof Error ? grantErr.message : String(grantErr)}`);
    }

    return {
        ok: true,
        conversationId: conversation.ID,
        spaceChatId: spaceChat.ID,
        name: cleanName,
        kind: targetKind,
    };
}
