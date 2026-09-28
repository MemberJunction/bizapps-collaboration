import {
    type IMetadataProvider,
    LogError,
    RunView,
    WellKnownUserSource,
} from '@memberjunction/core';
import { MJResourcePermissionEntity } from '@memberjunction/core-entities';
import { asMetadata, parseUuid } from './uuid.js';

export const CONVERSATIONS_RESOURCE_TYPE_ID = '81D4BC3D-9FEB-EF11-B01A-286B35C04427';
const RESOURCE_PERMISSIONS_ENTITY = 'MJ: Resource Permissions';
const SPACE_CHATS_ENTITY = 'MJ_BizApps_Collaboration: Space Chats';
const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_MEMBERS_ENTITY = 'MJ_BizApps_Collaboration: Space Members';
const SPACE_ROLES_ENTITY = 'MJ_BizApps_Collaboration: Space Role Types';

interface SpaceRow {
    ID: string;
    Name: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    ClosedAt: string | null;
}

interface MemberRow {
    ID: string;
    UserID: string;
    SpaceRoleTypeID: string;
}

interface RoleRow {
    ID: string;
    CanContribute: boolean;
}

interface ExistingGrantRow {
    ID: string;
    UserID: string;
    PermissionLevel: string;
    Status?: string;
}

/**
 * Synchronizes MJ: Resource Permissions Edit grants for all contributing seats
 * on a space's active Room conversation.
 *
 * Rules:
 * - If the space is closed, all room Edit grants are revoked (deleted).
 * - If the space is open, contributing members who reach the space (direct active
 *   members with CanContribute = 1, plus active members from open ancestors where
 *   InheritsMembership = 1 across the chain) receive Edit grants on the Room conversation.
 * - Non-contributing seats or members who no longer reach have their grants revoked.
 * - Recursively syncs any child spaces that inherit membership from this space.
 */
export async function syncRoomEditGrantsForSpace(
    providerOrObject: IMetadataProvider | object,
    spaceIdInput: string,
    visitedSpaces: Set<string> = new Set<string>()
): Promise<void> {
    const spaceId = parseUuid(spaceIdInput);
    if (!spaceId || visitedSpaces.has(spaceId)) {
        return;
    }
    visitedSpaces.add(spaceId);

    const provider = asMetadata(providerOrObject);
    if (!provider) {
        LogError(`syncRoomEditGrantsForSpace: provider could not be resolved as metadata provider`);
        return;
    }

    const systemUser = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!systemUser) {
        LogError(`syncRoomEditGrantsForSpace: system user not available for space ${spaceId}`);
        return;
    }

    const rv = RunView.FromMetadataProvider(provider);

    // 1. Find the active Room for this space
    const roomRes = await rv.RunView<{ ID: string; ConversationID: string; Status: string }>({
        EntityName: SPACE_CHATS_ENTITY,
        ExtraFilter: `SpaceID = '${spaceId}' AND Kind = 'Room'`,
        Fields: ['ID', 'ConversationID', 'Status'],
        MaxRows: 1,
    }, systemUser);

    if (!roomRes.Success || !roomRes.Results || roomRes.Results.length === 0) {
        return; // No room conversation for this space
    }

    const room = roomRes.Results[0];
    const conversationId = parseUuid(room.ConversationID);
    if (!conversationId) {
        return;
    }

    // 2. Load space and check closure & inheritance chain
    const spaceRes = await rv.RunView<SpaceRow>({
        EntityName: SPACES_ENTITY,
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ID', 'Name', 'ParentID', 'InheritsMembership', 'ClosedAt'],
        MaxRows: 1,
    }, systemUser);

    if (!spaceRes.Success || !spaceRes.Results || spaceRes.Results.length === 0) {
        return;
    }

    const space = spaceRes.Results[0];
    const isClosed = !!space.ClosedAt;

    const targetUserIds = new Set<string>();

    if (!isClosed) {
        // Collect all spaces that can contribute down to spaceId
        const contributingSpaceIds: string[] = [spaceId];
        let currentSpace = space;
        const seenAncestors = new Set<string>([spaceId]);

        while (currentSpace.InheritsMembership && currentSpace.ParentID) {
            const parentId = parseUuid(currentSpace.ParentID);
            if (!parentId || seenAncestors.has(parentId)) break;
            seenAncestors.add(parentId);

            const parentRes = await rv.RunView<SpaceRow>({
                EntityName: SPACES_ENTITY,
                ExtraFilter: `ID = '${parentId}'`,
                Fields: ['ID', 'Name', 'ParentID', 'InheritsMembership', 'ClosedAt'],
                MaxRows: 1,
            }, systemUser);

            if (!parentRes.Success || !parentRes.Results || parentRes.Results.length === 0) {
                break;
            }

            const parent = parentRes.Results[0];
            if (parent.ClosedAt) {
                // Closed ancestor halts inheritance down the branch
                break;
            }

            contributingSpaceIds.push(parent.ID);
            currentSpace = parent;
        }

        // Load active members across all contributing spaces
        const membersRes = await rv.RunView<MemberRow>({
            EntityName: SPACE_MEMBERS_ENTITY,
            ExtraFilter: `SpaceID IN (${contributingSpaceIds.map((id) => `'${id}'`).join(', ')}) AND Status = 'Active'`,
            Fields: ['ID', 'UserID', 'SpaceRoleTypeID'],
            MaxRows: 1000,
        }, systemUser);

        if (membersRes.Success && membersRes.Results && membersRes.Results.length > 0) {
            const roleIds = [...new Set(membersRes.Results.map((m) => parseUuid(m.SpaceRoleTypeID)).filter((id): id is string => !!id))];
            const roleLookup = new Map<string, boolean>();

            if (roleIds.length > 0) {
                const rolesRes = await rv.RunView<RoleRow>({
                    EntityName: SPACE_ROLES_ENTITY,
                    ExtraFilter: `ID IN (${roleIds.map((id) => `'${id}'`).join(', ')})`,
                    Fields: ['ID', 'CanContribute'],
                    MaxRows: roleIds.length + 5,
                }, systemUser);

                if (rolesRes.Success && rolesRes.Results) {
                    for (const r of rolesRes.Results) {
                        const rId = parseUuid(r.ID);
                        if (rId) roleLookup.set(rId, !!r.CanContribute);
                    }
                }
            }

            for (const m of membersRes.Results) {
                const roleId = parseUuid(m.SpaceRoleTypeID);
                const canContribute = roleId ? roleLookup.get(roleId) ?? false : false;
                const userId = parseUuid(m.UserID);
                if (canContribute && userId) {
                    targetUserIds.add(userId);
                }
            }
        }
    }

    // 3. Reconcile existing MJ: Resource Permissions rows for this Room conversation
    const existingGrantsRes = await rv.RunView<ExistingGrantRow>({
        EntityName: RESOURCE_PERMISSIONS_ENTITY,
        ExtraFilter: `ResourceTypeID = '${CONVERSATIONS_RESOURCE_TYPE_ID}' AND ResourceRecordID = '${conversationId}' AND Type = 'User'`,
        Fields: ['ID', 'UserID', 'PermissionLevel', 'Status'],
        MaxRows: 1000,
    }, systemUser);

    if (existingGrantsRes.Success && existingGrantsRes.Results) {
        for (const existing of existingGrantsRes.Results) {
            const existingUserId = parseUuid(existing.UserID);
            if (existingUserId && targetUserIds.has(existingUserId)) {
                // Grant is still required. Check if properties are up to date.
                targetUserIds.delete(existingUserId);
                if (existing.PermissionLevel !== 'Edit' || existing.Status !== 'Approved') {
                    const permObj = await provider.GetEntityObject<MJResourcePermissionEntity>(RESOURCE_PERMISSIONS_ENTITY, systemUser);
                    if (await permObj.Load(existing.ID)) {
                        permObj.PermissionLevel = 'Edit';
                        permObj.Status = 'Approved';
                        await permObj.Save();
                    }
                }
            } else {
                // Grant should be revoked
                const permObj = await provider.GetEntityObject<MJResourcePermissionEntity>(RESOURCE_PERMISSIONS_ENTITY, systemUser);
                if (await permObj.Load(existing.ID)) {
                    await permObj.Delete();
                }
            }
        }
    }

    // 4. Create missing grants for remaining target users
    for (const userId of targetUserIds) {
        const permObj = await provider.GetEntityObject<MJResourcePermissionEntity>(RESOURCE_PERMISSIONS_ENTITY, systemUser);
        permObj.NewRecord();
        permObj.ResourceTypeID = CONVERSATIONS_RESOURCE_TYPE_ID;
        permObj.ResourceRecordID = conversationId;
        permObj.Type = 'User';
        permObj.UserID = userId;
        permObj.PermissionLevel = 'Edit';
        permObj.Status = 'Approved';
        const saved = await permObj.Save();
        if (!saved) {
            LogError(`Failed to save room edit grant for user ${userId} on conversation ${conversationId}: ${permObj.LatestResult?.CompleteMessage ?? ''}`);
        }
    }

    // 5. Recursively sync child spaces that inherit membership
    const childrenRes = await rv.RunView<{ ID: string }>({
        EntityName: SPACES_ENTITY,
        ExtraFilter: `ParentID = '${spaceId}' AND InheritsMembership = 1`,
        Fields: ['ID'],
        MaxRows: 100,
    }, systemUser);

    if (childrenRes.Success && childrenRes.Results) {
        for (const child of childrenRes.Results) {
            const childId = parseUuid(child.ID);
            if (childId) {
                await syncRoomEditGrantsForSpace(provider, childId, visitedSpaces);
            }
        }
    }
}
