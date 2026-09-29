import { type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { authorizeItemWrite, membershipReaches, requestedItemBand, type Band } from '@mj-biz-apps/collaboration-core';
import {
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceItemEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import { loadWriteContext } from './load-graph.js';

const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const TYPES = 'MJ_BizApps_Collaboration: Space Types';

/**
 * The band a new upload asks for: the one the person chose, or the type's default when they chose none.
 * A band the seat can't hold is refused. The item gate still makes the final decision.
 */
export async function decideUploadBand(
    provider: IMetadataProvider,
    user: UserInfo,
    spaceId: string,
    chosenBand?: Band | null,
): Promise<{ ok: true; band: Band } | { ok: false; message: string }> {
    const item = await provider.GetEntityObject<mjBizAppsCollaborationSpaceItemEntity>(ITEMS, user);
    const space = await provider.GetEntityObject<mjBizAppsCollaborationSpaceEntity>(SPACES, user);
    if (!(await space.Load(spaceId))) {
        return { ok: false, message: 'Upload refused: that space is not visible.' };
    }
    const type = await provider.GetEntityObject<mjBizAppsCollaborationSpaceTypeEntity>(TYPES, user);
    if (!(await type.Load(space.SpaceTypeID))) {
        return { ok: false, message: 'Upload refused: the space type could not be read.' };
    }
    const context = await loadWriteContext(item, user, spaceId, null);
    const reach = membershipReaches(context.spaces, context.memberships, user.ID, spaceId);
    if (!reach) {
        return { ok: false, message: 'Upload refused: the signer does not reach this space.' };
    }
    if (chosenBand === 'Team' && !reach.role.canSeeTeamBand) {
        return { ok: false, message: 'Upload refused: this seat cannot place material in the Team band.' };
    }
    if (chosenBand === 'Shared' && reach.role.canSeeTeamBand && !reach.role.canPromoteBand) {
        return { ok: false, message: 'Upload refused: this seat cannot place material in the Shared band.' };
    }
    const requested = chosenBand ?? requestedItemBand(type.DefaultBand, reach.role.canSeeTeamBand, reach.role.canPromoteBand);
    const decision = authorizeItemWrite({
        callerUserId: user.ID,
        previousSpaceId: null,
        nextSpaceId: spaceId,
        previousBand: null,
        nextBand: requested,
        now: new Date(),
        spaces: context.spaces,
        memberships: context.memberships,
    });
    if ('message' in decision) {
        return { ok: false, message: decision.message };
    }
    return { ok: true, band: decision.band };
}
