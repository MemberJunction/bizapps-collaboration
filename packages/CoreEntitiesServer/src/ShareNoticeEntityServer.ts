import { BaseEntity, RunView, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { authorizeNoticeWrite, type Band } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationShareNoticeEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid, requireSystemUser } from './load-graph.js';
import { failLibrary, requireIds } from './library-audit.js';
import { loadShareRoster, rosterForNotice } from './library-events.js';
import { parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Share Notices';

@RegisterClass(BaseEntity, ENTITY)
export class ShareNoticeEntityServer extends mjBizAppsCollaborationShareNoticeEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const caller = callerUuid(user);
        const ids = requireIds(this.SpaceID, this.ItemID);
        const recipient = parseUuid(this.RecipientUserID);
        if (!user || !caller || !ids || !recipient) {
            return failLibrary(result, 'Share notice refused: the signer, the space, and the item must be real ids.');
        }
        try {
            const message = await noticeDecision(this, caller, recipient, ids.spaceId, ids.itemId, !this.IsSaved);
            if (message) return failLibrary(result, message);
        } catch (error) {
            return failLibrary(result, error instanceof Error ? error.message : 'Share notice refused.');
        }
        return result;
    }
}

async function noticeDecision(
    entity: ShareNoticeEntityServer,
    caller: string,
    recipient: string,
    spaceId: string,
    itemId: string,
    isNew: boolean,
): Promise<string | null> {
    const system = await requireSystemUser(entity);
    const found = await new RunView(entity.RunViewProviderToUse).RunView<{ SpaceID: string; Band: Band }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Items',
        ExtraFilter: `ID = '${itemId}'`,
        MaxRows: 1,
    }, system);
    if (!found.Success) return found.ErrorMessage || 'The item could not be read.';
    const item = found.Results?.[0];
    if (!item) return 'The item is not in this space.';
    const roster = rosterForNotice(entity) ?? await loadShareRoster(entity, spaceId);
    const decision = authorizeNoticeWrite({
        callerUserId: caller,
        recipientUserId: recipient,
        spaceId,
        itemSpaceId: item.SpaceID,
        itemBand: item.Band,
        spaces: roster.spaces,
        memberships: roster.memberships,
        isNew,
    });
    return decision.ok ? null : decision.message;
}

export function LoadShareNoticeEntityServer(): void {
    void ShareNoticeEntityServer;
}
