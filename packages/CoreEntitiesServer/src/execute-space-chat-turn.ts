import {
    BaseEntity,
    LogError,
    RunView,
    type IMetadataProvider,
    type UserInfo,
} from '@memberjunction/core';
import { MJConversationDetailEntity } from '@memberjunction/core-entities';
import {
    membershipReaches,
    type CollaborationSettings,
    ValidateCollaborationSettings,
} from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { resolveAllowedAgents, COLLABORATION_DEFAULT_AGENT_ID } from './resolve-allowed-agents.js';
import { resolveSpaceAgentRetrieval } from './space-agent-retrieval.js';
import { filterRoomReplyItems } from './post-space-message.js';
import { parseUuid } from './uuid.js';

const DETAILS = 'MJ: Conversation Details';
const SPACE_CHATS = 'MJ_BizApps_Collaboration: Space Chats';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';

export interface ExecuteSpaceChatTurnInput {
    spaceId: string;
    conversationId: string;
    userMessageId: string;
    agentId?: string;
}

export type ExecuteSpaceChatTurnResult =
    | { ok: true; replyDetailIds: string[]; agentRunId?: string; quotedCount?: number }
    | { ok: false; message: string };

/**
 * Executes a server turn for an agent in a space's Room chat.
 *
 * Verifies all security and context boundaries against the persisted user message:
 * 1. Caller reaches the space and can contribute (closed spaces refuse).
 * 2. conversationId belongs to the space's active Room.
 * 3. userMessageId exists, matches the conversation, and was authored by the caller.
 * 4. Agent is allowed in this space via resolveAllowedAgents.
 * 5. Reply mode check: if MentionOnly, verifies user message tags the agent. If Never, refuses.
 * 6. Runs agent under audience rule (filterRoomReplyItems) and records reply as system user.
 */
export async function executeSpaceChatTurn(
    provider: IMetadataProvider,
    user: UserInfo,
    input: ExecuteSpaceChatTurnInput
): Promise<ExecuteSpaceChatTurnResult> {
    const spaceId = parseUuid(input.spaceId);
    const conversationId = parseUuid(input.conversationId);
    const userMessageId = parseUuid(input.userMessageId);
    const callerId = parseUuid(user?.ID);

    if (!spaceId || !conversationId || !userMessageId || !callerId) {
        return { ok: false, message: 'Invalid turn parameters: space, conversation, message, and caller IDs are required.' };
    }

    const probe = await provider.GetEntityObject<BaseEntity>(SPACES, user);
    let context;
    try {
        context = await loadWriteContext(probe, user, spaceId, null);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : 'The space could not be read.' };
    }

    const reach = membershipReaches(context.spaces, context.memberships, callerId, spaceId);
    if (!reach?.role.canContribute) {
        return { ok: false, message: 'Your role on this space cannot run an agent turn.' };
    }

    const system = await requireSystemUser(probe);
    const view = RunView.FromMetadataProvider(provider);

    // 1. Verify space is open
    const spaceRes = await view.RunView<{ ClosedAt: string | null; SpaceTypeID: string | null; Configuration: string | null }>({
        EntityName: SPACES,
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ClosedAt', 'SpaceTypeID', 'Configuration'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (!spaceRes.Success || !spaceRes.Results?.[0]) {
        return { ok: false, message: spaceRes.ErrorMessage || 'The space could not be read.' };
    }

    const targetSpace = spaceRes.Results[0];
    if (targetSpace.ClosedAt) {
        return { ok: false, message: 'A closed space does not take a new turn.' };
    }

    // 2. Verify conversation belongs to this space's active Room
    const roomCheck = await view.RunView<{ ID: string; ConversationID: string; Kind: string; Status: string }>({
        EntityName: SPACE_CHATS,
        ExtraFilter: `SpaceID = '${spaceId}' AND ConversationID = '${conversationId}' AND Kind = 'Room' AND Status = 'Active'`,
        Fields: ['ID', 'ConversationID', 'Kind', 'Status'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);

    if (!roomCheck.Success || !roomCheck.Results?.[0]) {
        return { ok: false, message: 'Only the space active Room accepts agent turns.' };
    }

    // 3. Load persisted user message
    const userDetail = await provider.GetEntityObject<MJConversationDetailEntity>(DETAILS, system);
    if (!(await userDetail.Load(userMessageId))) {
        return { ok: false, message: 'The specified message could not be loaded.' };
    }

    if (parseUuid(userDetail.ConversationID) !== conversationId) {
        return { ok: false, message: 'The message does not belong to this conversation.' };
    }

    if (parseUuid(userDetail.UserID) !== callerId && userDetail.Role !== 'User') {
        return { ok: false, message: 'Only messages authored by the caller can initiate an agent turn.' };
    }

    const messageText = userDetail.Message ?? '';

    // 4. Resolve allowed agents
    const allowed = await resolveAllowedAgents(provider, spaceId, system);
    const targetAgentId = parseUuid(input.agentId) ?? parseUuid(allowed.defaultAgentId) ?? COLLABORATION_DEFAULT_AGENT_ID;

    const isAgentAllowed = allowed.allowedAgentIds.some((id) => parseUuid(id) === targetAgentId);
    if (!isAgentAllowed) {
        return { ok: false, message: `The agent ${targetAgentId} is not allowed in this space.` };
    }

    // 5. Resolve settings & reply mode
    await CollaborationEngine.Instance.EnsureLoaded(system, provider);

    let spaceConfig: CollaborationSettings | null = null;
    if (targetSpace.Configuration) {
        try {
            const parsed: unknown = JSON.parse(targetSpace.Configuration);
            const val = ValidateCollaborationSettings(parsed, 'space');
            if (val.valid) {
                spaceConfig = parsed as CollaborationSettings;
            }
        } catch {
            // ignore malformed space configuration
        }
    }

    const resolvedSettings = CollaborationEngine.Instance.ResolveSettingsForSpace(
        spaceConfig ? [spaceConfig] : [],
        targetSpace.SpaceTypeID
    );

    const replyMode = resolvedSettings?.Chats?.AgentReplyMode ?? 'MentionOrOneToOne';

    if (replyMode === 'MentionOnly') {
        const hasMention = /(@(assistant|agent)|^\/ask)/i.test(messageText);
        if (!hasMention) {
            return { ok: false, message: 'The message does not mention the agent.' };
        }
    }

    // 6. Run agent retrieval bounded by room audience rule
    const retrieval = await resolveSpaceAgentRetrieval(provider, user, spaceId);
    const roomQuoted = filterRoomReplyItems(retrieval.quotedItems, spaceId);

    let agentReplyText: string;
    if (roomQuoted.length === 0) {
        agentReplyText = 'I searched this space for materials within your reach, but found no matching items.';
    } else {
        const itemNames = roomQuoted.map((item) => item.Name).join(', ');
        agentReplyText = `Based on materials in this space within your reach: ${itemNames}.`;
    }

    // 7. Write reply detail as system user
    const assistantDetail = await provider.GetEntityObject<MJConversationDetailEntity>(DETAILS, system);
    assistantDetail.NewRecord();
    assistantDetail.ConversationID = conversationId;
    assistantDetail.UserID = system.ID;
    assistantDetail.AgentID = targetAgentId;
    assistantDetail.Role = 'AI';
    assistantDetail.Message = agentReplyText;
    assistantDetail.Status = 'Complete';
    assistantDetail.HiddenToUser = false;
    assistantDetail.IsPinned = false;
    assistantDetail.OriginalMessageChanged = false;

    if (!(await assistantDetail.Save()) || !assistantDetail.ID) {
        const errMsg = assistantDetail.LatestResult?.CompleteMessage ?? 'Failed to save assistant reply';
        LogError(`executeSpaceChatTurn: failed to save assistant reply: ${errMsg}`);
        return { ok: false, message: errMsg };
    }

    return {
        ok: true,
        replyDetailIds: [assistantDetail.ID],
        quotedCount: roomQuoted.length,
    };
}
