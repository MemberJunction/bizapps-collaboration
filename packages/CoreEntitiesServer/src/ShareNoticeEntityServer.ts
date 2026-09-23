import { BaseEntity, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { authorizeNoticeWrite } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationShareNoticeEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid } from './load-graph.js';
import { failLibrary, libraryDecision, requireIds } from './library-audit.js';
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
            const message = await libraryDecision(this, user, ids.spaceId, ids.itemId, (item, context) => authorizeNoticeWrite({
                callerUserId: caller,
                recipientUserId: recipient,
                spaceId: ids.spaceId,
                itemSpaceId: item.spaceId,
                itemBand: item.band,
                spaces: context.spaces,
                memberships: context.memberships,
                isNew: !this.IsSaved,
            }));
            if (message) return failLibrary(result, message);
        } catch (error) {
            return failLibrary(result, error instanceof Error ? error.message : 'Share notice refused.');
        }
        return result;
    }
}

export function LoadShareNoticeEntityServer(): void {
    void ShareNoticeEntityServer;
}
