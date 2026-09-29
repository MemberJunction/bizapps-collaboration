import {
    type IMetadataProvider,
    LogError,
    RunView,
    WellKnownUserSource,
} from '@memberjunction/core';
import { MJResourcePermissionEntity } from '@memberjunction/core-entities';
import {
    membershipReaches,
    type MemberSnapshot,
    type SpaceNode,
    type RoleFlags,
} from '@mj-biz-apps/collaboration-core';
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
    OwnerID?: string;
    ClosedAt: string | null;
}

interface MemberRow {
    ID: string;
    SpaceID?: string;
    UserID: string;
    SpaceRoleTypeID: string;
    Band?: string;
}

interface RoleRow {
    ID: string;
    CanContribute?: boolean;
    Level?: number;
    MaxGrantableLevel?: number;
    CanInvite?: boolean;
    CanPromoteBand?: boolean;
    CanSeeTeamBand?: boolean;
    IsOwnerRole?: boolean;
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
 * - If the space is open, contributing members who reach the space (evaluated via
 *   membershipReaches so the nearest seat on the inheritance chain governs) receive
 *   Edit grants on the Room conversation.
 * - Non-contributing seats or members who no longer reach have their grants revoked.
 * - Recursively syncs any child spaces that inherit membership from this space.
 * - Statically checks every read, save, and delete, stopping on failed reads to avoid
 *   accidental total revocation or duplicate grant creation.
 */
export async function syncRoomEditGrantsForSpace(
    providerOrObject: IMetadataProvider | object,
    spaceIdInput: string,
    visitedSpaces: Set<string> = new Set<string>()
): Promise<{ ok: boolean; message?: string }> {
    const spaceId = parseUuid(spaceIdInput);
    if (!spaceId || visitedSpaces.has(spaceId)) {
        return { ok: true };
    }
    visitedSpaces.add(spaceId);

    const provider = asMetadata(providerOrObject);
    if (!provider) {
        const msg = `syncRoomEditGrantsForSpace: provider could not be resolved as metadata provider`;
        LogError(msg);
        return { ok: false, message: msg };
    }

    const systemUser = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!systemUser) {
        const msg = `syncRoomEditGrantsForSpace: system user not available for space ${spaceId}`;
        LogError(msg);
        return { ok: false, message: msg };
    }

    const rv = RunView.FromMetadataProvider(provider);

    // 1. Find all conversations for this space
    const chatsRes = await rv.RunView<{ ID: string; ConversationID: string; Kind: string; Status: string }>({
        EntityName: SPACE_CHATS_ENTITY,
        ExtraFilter: `SpaceID = '${spaceId}'`,
        Fields: ['ID', 'ConversationID', 'Kind', 'Status'],
        MaxRows: 200,
    }, systemUser);

    if (!chatsRes.Success) {
        const msg = `syncRoomEditGrantsForSpace: failed to read chats for space ${spaceId}: ${chatsRes.ErrorMessage ?? 'RunView failed'}`;
        LogError(msg);
        return { ok: false, message: msg };
    }

    // 2. Load space and check closure & inheritance chain
    const spaceRes = await rv.RunView<SpaceRow>({
        EntityName: SPACES_ENTITY,
        ExtraFilter: `ID = '${spaceId}'`,
        Fields: ['ID', 'Name', 'ParentID', 'InheritsMembership', 'OwnerID', 'ClosedAt'],
        MaxRows: 1,
    }, systemUser);

    if (!spaceRes.Success) {
        const msg = `syncRoomEditGrantsForSpace: failed to read space ${spaceId}: ${spaceRes.ErrorMessage ?? 'RunView failed'}`;
        LogError(msg);
        return { ok: false, message: msg };
    }
    if (!spaceRes.Results || spaceRes.Results.length === 0) {
        const msg = `syncRoomEditGrantsForSpace: space ${spaceId} not found`;
        LogError(msg);
        return { ok: false, message: msg };
    }

    const space = spaceRes.Results[0];
    const isClosed = !!space.ClosedAt;

    const allContributingUserIds = new Set<string>();
    const teamContributingUserIds = new Set<string>();

    if (!isClosed) {
        const spaceNodes: SpaceNode[] = [];
        const chainSpaceIds: string[] = [spaceId];
        let currentSpace: SpaceRow = space;
        const seenAncestors = new Set<string>([spaceId]);

        spaceNodes.push({
            id: spaceId,
            parentId: space.ParentID ? parseUuid(space.ParentID) : null,
            inheritsMembership: !!space.InheritsMembership,
            ownerId: parseUuid(space.OwnerID) ?? space.OwnerID ?? '',
            agentRetrieval: 'Included',
            allowParentAssignees: true,
            closedAt: space.ClosedAt ? String(space.ClosedAt) : null,
        });

        let ancestorReadFailed = false;
        while (currentSpace.InheritsMembership && currentSpace.ParentID) {
            const parentId = parseUuid(currentSpace.ParentID);
            if (!parentId || seenAncestors.has(parentId)) break;
            seenAncestors.add(parentId);

            const parentRes = await rv.RunView<SpaceRow>({
                EntityName: SPACES_ENTITY,
                ExtraFilter: `ID = '${parentId}'`,
                Fields: ['ID', 'Name', 'ParentID', 'InheritsMembership', 'OwnerID', 'ClosedAt'],
                MaxRows: 1,
            }, systemUser);

            if (!parentRes.Success) {
                LogError(`syncRoomEditGrantsForSpace: failed to read ancestor space ${parentId}: ${parentRes.ErrorMessage ?? 'RunView failed'}`);
                ancestorReadFailed = true;
                break;
            }
            if (!parentRes.Results || parentRes.Results.length === 0) {
                LogError(`syncRoomEditGrantsForSpace: ancestor space ${parentId} not found`);
                ancestorReadFailed = true;
                break;
            }

            const parent = parentRes.Results[0];
            spaceNodes.push({
                id: parent.ID,
                parentId: parent.ParentID ? parseUuid(parent.ParentID) : null,
                inheritsMembership: !!parent.InheritsMembership,
                ownerId: parseUuid(parent.OwnerID) ?? parent.OwnerID ?? '',
                agentRetrieval: 'Included',
                allowParentAssignees: true,
                closedAt: parent.ClosedAt ? String(parent.ClosedAt) : null,
            });

            if (parent.ClosedAt) {
                // Closed ancestor halts inheritance down the branch
                break;
            }

            chainSpaceIds.push(parent.ID);
            currentSpace = parent;
        }

        if (ancestorReadFailed) {
            return { ok: false, message: 'Failed to read ancestor space for grant sync.' };
        }

        // Load active members across all contributing spaces
        const membersRes = await rv.RunView<MemberRow>({
            EntityName: SPACE_MEMBERS_ENTITY,
            ExtraFilter: `SpaceID IN (${chainSpaceIds.map((id) => `'${id}'`).join(', ')}) AND Status = 'Active'`,
            Fields: ['ID', 'SpaceID', 'UserID', 'SpaceRoleTypeID', 'Band'],
            MaxRows: 2000,
        }, systemUser);

        if (!membersRes.Success) {
            const msg = `syncRoomEditGrantsForSpace: failed to read members for space ${spaceId}: ${membersRes.ErrorMessage ?? 'RunView failed'}`;
            LogError(msg);
            return { ok: false, message: msg };
        }

        const memberRows = membersRes.Results ?? [];
        if (memberRows.length > 0) {
            const roleIds = [...new Set(memberRows.map((m) => parseUuid(m.SpaceRoleTypeID)).filter((id): id is string => !!id))];
            const roleLookup = new Map<string, RoleFlags>();

            if (roleIds.length > 0) {
                const rolesRes = await rv.RunView<RoleRow>({
                    EntityName: SPACE_ROLES_ENTITY,
                    ExtraFilter: `ID IN (${roleIds.map((id) => `'${id}'`).join(', ')})`,
                    Fields: ['ID', 'CanContribute', 'Level', 'MaxGrantableLevel', 'CanInvite', 'CanPromoteBand', 'CanSeeTeamBand', 'IsOwnerRole'],
                    MaxRows: roleIds.length + 5,
                }, systemUser);

                if (!rolesRes.Success) {
                    const msg = `syncRoomEditGrantsForSpace: failed to read roles for space ${spaceId}: ${rolesRes.ErrorMessage ?? 'RunView failed'}`;
                    LogError(msg);
                    return { ok: false, message: msg };
                }

                if (rolesRes.Results) {
                    for (const r of rolesRes.Results) {
                        const rId = parseUuid(r.ID);
                        if (rId) {
                            roleLookup.set(rId, {
                                level: r.Level ?? 0,
                                maxGrantableLevel: r.MaxGrantableLevel ?? 0,
                                canInvite: !!r.CanInvite,
                                canPromoteBand: !!r.CanPromoteBand,
                                canSeeTeamBand: !!r.CanSeeTeamBand,
                                isOwnerRole: !!r.IsOwnerRole,
                                canContribute: !!r.CanContribute,
                            });
                        }
                    }
                }
            }

            const memberships: MemberSnapshot[] = memberRows.map((m) => ({
                spaceId: parseUuid(m.SpaceID) ?? m.SpaceID ?? spaceId,
                userId: parseUuid(m.UserID) ?? m.UserID,
                status: 'Active',
                band: m.Band === 'Team' ? 'Team' : 'Shared',
                role: roleLookup.get(parseUuid(m.SpaceRoleTypeID) ?? '') ?? {
                    level: 0,
                    maxGrantableLevel: 0,
                    canInvite: false,
                    canPromoteBand: false,
                    canSeeTeamBand: false,
                    isOwnerRole: false,
                    canContribute: false,
                },
            }));

            const uniqueUserIds = new Set(memberRows.map((m) => parseUuid(m.UserID)).filter((id): id is string => !!id));
            for (const uid of uniqueUserIds) {
                const reach = membershipReaches(spaceNodes, memberships, uid, spaceId);
                if (reach?.role.canContribute) {
                    allContributingUserIds.add(uid);
                    if (reach.role.canSeeTeamBand) {
                        teamContributingUserIds.add(uid);
                    }
                }
            }
        }
    }

    // 3. Reconcile existing MJ: Resource Permissions rows for each active conversation
    for (const chat of (chatsRes.Results ?? [])) {
        const conversationId = parseUuid(chat.ConversationID);
        if (!conversationId) continue;

        const isPrivate = chat.Kind === 'Private';
        const isChatActive = chat.Status === 'Active';
        const targetUserIds = new Set<string>(
            !isChatActive ? [] : isPrivate ? teamContributingUserIds : allContributingUserIds
        );

        const existingGrantsRes = await rv.RunView<ExistingGrantRow>({
            EntityName: RESOURCE_PERMISSIONS_ENTITY,
            ExtraFilter: `ResourceTypeID = '${CONVERSATIONS_RESOURCE_TYPE_ID}' AND ResourceRecordID = '${conversationId}' AND Type = 'User'`,
            Fields: ['ID', 'UserID', 'PermissionLevel', 'Status'],
            MaxRows: 2000,
        }, systemUser);

        if (!existingGrantsRes.Success) {
            const msg = `syncRoomEditGrantsForSpace: failed to read existing grants for space ${spaceId} conversation ${conversationId}: ${existingGrantsRes.ErrorMessage ?? 'RunView failed'}`;
            LogError(msg);
            return { ok: false, message: msg };
        }

        if (existingGrantsRes.Results) {
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
                            const saved = await permObj.Save();
                            if (!saved) {
                                const msg = `syncRoomEditGrantsForSpace: failed to update grant ${existing.ID}: ${permObj.LatestResult?.CompleteMessage ?? ''}`;
                                LogError(msg);
                                return { ok: false, message: msg };
                            }
                        } else {
                            const msg = `syncRoomEditGrantsForSpace: failed to load grant ${existing.ID} for update`;
                            LogError(msg);
                            return { ok: false, message: msg };
                        }
                    }
                } else {
                    // Grant should be revoked
                    const permObj = await provider.GetEntityObject<MJResourcePermissionEntity>(RESOURCE_PERMISSIONS_ENTITY, systemUser);
                    if (await permObj.Load(existing.ID)) {
                        const deleted = await permObj.Delete();
                        if (!deleted) {
                            const msg = `syncRoomEditGrantsForSpace: failed to delete grant ${existing.ID}: ${permObj.LatestResult?.CompleteMessage ?? ''}`;
                            LogError(msg);
                            return { ok: false, message: msg };
                        }
                    } else {
                        const msg = `syncRoomEditGrantsForSpace: failed to load grant ${existing.ID} for revocation`;
                        LogError(msg);
                        return { ok: false, message: msg };
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
                const msg = `syncRoomEditGrantsForSpace: failed to save edit grant for user ${userId} on conversation ${conversationId}: ${permObj.LatestResult?.CompleteMessage ?? ''}`;
                LogError(msg);
                return { ok: false, message: msg };
            }
        }
    }

    // 5. Recursively sync child spaces that inherit membership
    const childrenRes = await rv.RunView<{ ID: string }>({
        EntityName: SPACES_ENTITY,
        ExtraFilter: `ParentID = '${spaceId}' AND InheritsMembership = 1`,
        Fields: ['ID'],
        MaxRows: 100,
    }, systemUser);

    if (!childrenRes.Success) {
        const msg = `syncRoomEditGrantsForSpace: failed to read child spaces for space ${spaceId}: ${childrenRes.ErrorMessage ?? 'RunView failed'}`;
        LogError(msg);
        return { ok: false, message: msg };
    }

    if (childrenRes.Results) {
        for (const child of childrenRes.Results) {
            const childId = parseUuid(child.ID);
            if (childId) {
                const childRes = await syncRoomEditGrantsForSpace(provider, childId, visitedSpaces);
                if (!childRes.ok) {
                    return childRes;
                }
            }
        }
    }

    return { ok: true };
}
