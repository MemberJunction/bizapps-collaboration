import { BaseEntity, LogError, RunView, type EntitySaveOptions, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { MJConversationDetailEntity, MJConversationDetailEntityExtended } from '@memberjunction/core-entities';
import { RegisterClass } from '@memberjunction/global';
import { membershipReaches } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { parseUuid } from './uuid.js';

const SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';
const DETAILS = 'MJ: Conversation Details';
const MESSAGE_CAP = 4000;
const VOUCH = Symbol('spacePost');

/**
 * A human message in a space conversation. The chat area routes every save
 * to an agent, so the room does not use it. This save skips that route.
 * The system user writes the row. The message names the person who sent it.
 */
@RegisterClass(BaseEntity, DETAILS, 100)
export class SpaceConversationDetailServer extends MJConversationDetailEntityExtended {
    override async Save(options?: EntitySaveOptions): Promise<boolean> {
        if ((this as unknown as { [VOUCH]?: boolean })[VOUCH]) {
            return MJConversationDetailEntity.prototype.Save.call(this, options);
        }
        return super.Save(options);
    }
}

export function vouchSpacePost(detail: object): void {
    (detail as { [VOUCH]?: boolean })[VOUCH] = true;
}

export async function postSpaceMessage(
    provider: IMetadataProvider,
    user: UserInfo,
    input: { spaceId: string; text: string },
): Promise<{ ok: true; detailId: string } | { ok: false; message: string }> {
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
    const view = new RunView();
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

    const prior = await view.RunView<{ Sequence: number }>({
        EntityName: DETAILS,
        ExtraFilter: `ConversationID = '${conversationId}'`,
        OrderBy: 'Sequence DESC',
        Fields: ['Sequence'],
        MaxRows: 1,
        ResultType: 'simple',
    }, system);
    if (!prior.Success) return { ok: false, message: prior.ErrorMessage || 'The conversation could not be read.' };
    const sequence = (prior.Results?.[0]?.Sequence ?? 0) + 1;

    const detail = await provider.GetEntityObject<SpaceConversationDetailServer>(DETAILS, system);
    detail.NewRecord();
    detail.ConversationID = conversationId;
    detail.UserID = callerId;
    detail.Role = 'User';
    detail.Message = text;
    detail.Status = 'Complete';
    detail.HiddenToUser = false;
    detail.IsPinned = false;
    detail.OriginalMessageChanged = false;
    detail.Set('Sequence', sequence);
    vouchSpacePost(detail);
    if (!(await detail.Save()) || !detail.ID) {
        const message = detail.LatestResult?.CompleteMessage || 'The message was refused.';
        LogError(`Space message failed for space ${spaceId} and user ${callerId}: ${message}`);
        return { ok: false, message };
    }
    return { ok: true, detailId: detail.ID };
}

export function LoadSpaceConversationDetailServer(): void {
    void SpaceConversationDetailServer;
}
