import {
    type IMetadataProvider,
    type UserInfo,
    LogError,
    RunView,
} from '@memberjunction/core';
import type { MJConversationEntity, MJResourcePermissionEntity } from '@memberjunction/core-entities';
import type { mjBizAppsCollaborationSpaceChatEntity } from '@mj-biz-apps/collaboration-entities';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { resolveSpaceChatSettings } from './resolve-space-chat-settings.js';
import { syncRoomEditGrantsForSpace, CONVERSATIONS_RESOURCE_TYPE_ID } from './room-edit-grants.js';
import { parseUuid } from './uuid.js';

const COLLABORATION_APP_ID = '94F5906B-38AB-4A9F-BFCA-3D395BBBC198';

export interface CreateSpaceConversationInput {
    SpaceID: string;
    Name: string;
    Kind?: 'General' | 'Topic' | 'Private';
}

export interface CreateSpaceConversationResult {
    ok: boolean;
    message?: string;
    conversationId?: string;
    spaceChatId?: string;
    name?: string;
    kind?: string;
}

export function evaluateCanStartSpaceConversation(
    isSpaceClosed: boolean,
    whoCanStart: string,
    reachRole: { isOwnerRole?: boolean; canContribute?: boolean; canSeeTeamBand?: boolean } | null | undefined
): { canStartConversation: boolean; allowedConversationKinds: ('General' | 'Topic' | 'Private')[] } {
    if (isSpaceClosed || !reachRole || !reachRole.canContribute) {
        return { canStartConversation: false, allowedConversationKinds: [] };
    }
    if (whoCanStart === 'Owners' && !reachRole.isOwnerRole) {
        return { canStartConversation: false, allowedConversationKinds: [] };
    }
    const kinds: ('General' | 'Topic' | 'Private')[] = ['General', 'Topic'];
    if (reachRole.canSeeTeamBand) {
        kinds.push('Private');
    }
    return { canStartConversation: true, allowedConversationKinds: kinds };
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
 * - Fails if grant sync fails.
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

    // 1. Check Chats.WhoCanStart and allowed kinds
    const chatSettings = await resolveSpaceChatSettings(provider, spaceId, user);
    const whoCanStart = chatSettings.resolvedSettings.Chats?.WhoCanStart ?? 'Anyone';

    const startPerms = evaluateCanStartSpaceConversation(
        !!targetSpace.closedAt,
        whoCanStart,
        reach.role
    );
    if (!startPerms.canStartConversation) {
        return { ok: false, message: 'Caller is not permitted to start a conversation in this space.' };
    }

    if (input.Kind !== undefined && input.Kind !== 'General' && input.Kind !== 'Topic' && input.Kind !== 'Private') {
        return { ok: false, message: 'Invalid conversation kind. Only General, Topic, and Private (Internal Only) are permitted.' };
    }

    const targetKind = input.Kind ?? 'General';
    if (!startPerms.allowedConversationKinds.includes(targetKind)) {
        return { ok: false, message: `Caller cannot start a ${targetKind} conversation.` };
    }

    const system = await requireSystemUser(probe);

    // 2. Create Conversation and SpaceChat in one transaction owned by system user
    const conversation = await provider.GetEntityObject<MJConversationEntity>('MJ: Conversations', system);
    conversation.NewRecord();
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

    // 3. Sync edit grants across all space chats - fail if sync fails
    try {
        const grantSync = await syncRoomEditGrantsForSpace(provider, spaceId);
        if (!grantSync.ok) {
            const msg = grantSync.message ?? 'Failed to sync permissions for new conversation.';
            LogError(`createSpaceConversation: grant sync failed for space ${spaceId}: ${msg}`);
            await rollbackFailedConversation(provider, system, spaceChat, conversation, spaceId);
            return { ok: false, message: msg };
        }
    } catch (grantErr) {
        const msg = `Failed to sync room edit grants after conversation creation for space ${spaceId}: ${grantErr instanceof Error ? grantErr.message : String(grantErr)}`;
        LogError(msg);
        await rollbackFailedConversation(provider, system, spaceChat, conversation, spaceId);
        return { ok: false, message: msg };
    }

    return {
        ok: true,
        conversationId: conversation.ID,
        spaceChatId: spaceChat.ID,
        name: cleanName,
        kind: targetKind,
    };
}

async function rollbackFailedConversation(
    provider: IMetadataProvider,
    system: UserInfo,
    spaceChat: mjBizAppsCollaborationSpaceChatEntity,
    conversation: MJConversationEntity,
    spaceId: string
): Promise<void> {
    // 1. Remove any resource permissions that may have been written for this conversation
    try {
        const rv = RunView.FromMetadataProvider(provider);
        const grantsRes = await rv.RunView<{ ID: string }>({
            EntityName: 'MJ: Resource Permissions',
            ExtraFilter: `ResourceTypeID = '${CONVERSATIONS_RESOURCE_TYPE_ID}' AND ResourceRecordID = '${conversation.ID}'`,
            Fields: ['ID'],
            MaxRows: 1000,
        }, system);
        if (grantsRes.Success && grantsRes.Results) {
            for (const g of grantsRes.Results) {
                const perm = await provider.GetEntityObject<MJResourcePermissionEntity>('MJ: Resource Permissions', system);
                if (await perm.Load(g.ID)) {
                    const deleted = await perm.Delete();
                    if (!deleted) {
                        LogError(`createSpaceConversation rollback: failed to delete resource permission ${g.ID}: ${perm.LatestResult?.CompleteMessage ?? ''}`);
                    }
                }
            }
        } else if (!grantsRes.Success) {
            LogError(`createSpaceConversation rollback: failed to read resource permissions for conversation ${conversation.ID}: ${grantsRes.ErrorMessage ?? 'Unknown error'}`);
        }
    } catch (permErr) {
        LogError(`createSpaceConversation rollback: failed to clean up permissions for conversation ${conversation.ID}: ${permErr instanceof Error ? permErr.message : String(permErr)}`);
    }

    // 2. Delete spaceChat and check return value
    try {
        const chatDeleted = await spaceChat.Delete();
        if (!chatDeleted) {
            LogError(`createSpaceConversation rollback: spaceChat.Delete() returned false for ${spaceChat.ID}: ${spaceChat.LatestResult?.CompleteMessage ?? ''}`);
        }
    } catch (chatDelErr) {
        LogError(`createSpaceConversation rollback: error deleting spaceChat ${spaceChat.ID}: ${chatDelErr instanceof Error ? chatDelErr.message : String(chatDelErr)}`);
    }

    // 3. Delete conversation and check return value
    try {
        const convDeleted = await conversation.Delete();
        if (!convDeleted) {
            LogError(`createSpaceConversation rollback: conversation.Delete() returned false for ${conversation.ID}: ${conversation.LatestResult?.CompleteMessage ?? ''}`);
        }
    } catch (convDelErr) {
        LogError(`createSpaceConversation rollback: error deleting conversation ${conversation.ID}: ${convDelErr instanceof Error ? convDelErr.message : String(convDelErr)}`);
    }

    // 4. Re-sync remaining space room grants so the space is left in a consistent state
    try {
        const syncResult = await syncRoomEditGrantsForSpace(provider, spaceId);
        if (!syncResult.ok) {
            LogError(`createSpaceConversation rollback: failed to re-sync space grants: ${syncResult.message ?? ''}`);
        }
    } catch (resyncErr) {
        LogError(`createSpaceConversation rollback: error re-syncing space grants: ${resyncErr instanceof Error ? resyncErr.message : String(resyncErr)}`);
    }
}
