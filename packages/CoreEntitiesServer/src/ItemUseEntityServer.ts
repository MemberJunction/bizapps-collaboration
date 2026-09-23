import { BaseEntity, type ValidationResult } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { authorizeUseWrite } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationItemUseEntity } from '@mj-biz-apps/collaboration-entities';
import { callerUuid } from './load-graph.js';
import { failLibrary, libraryDecision, requireIds } from './library-audit.js';
import { parseUuid } from './uuid.js';

const ENTITY = 'MJ_BizApps_Collaboration: Item Uses';

@RegisterClass(BaseEntity, ENTITY)
export class ItemUseEntityServer extends mjBizAppsCollaborationItemUseEntity {
    public override get DefaultSkipAsyncValidation(): boolean {
        return false;
    }

    public override async ValidateAsync(): Promise<ValidationResult> {
        const result = await super.ValidateAsync();
        const user = this.ContextCurrentUser;
        const caller = callerUuid(user);
        const ids = requireIds(this.SpaceID, this.ItemID);
        const userId = parseUuid(this.UserID);
        if (!user || !caller || !ids || !userId) {
            return failLibrary(result, 'Item use refused: the signer, the space, and the item must be real ids.');
        }
        try {
            const message = await libraryDecision(this, user, ids.spaceId, ids.itemId, (item, context) => authorizeUseWrite({
                callerUserId: caller,
                userId,
                spaceId: ids.spaceId,
                itemSpaceId: item.spaceId,
                itemBand: item.band,
                spaces: context.spaces,
                memberships: context.memberships,
                isNew: !this.IsSaved,
            }));
            if (message) return failLibrary(result, message);
        } catch (error) {
            return failLibrary(result, error instanceof Error ? error.message : 'Item use refused.');
        }
        return result;
    }
}

export function LoadItemUseEntityServer(): void {
    void ItemUseEntityServer;
}
