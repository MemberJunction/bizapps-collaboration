import { LogError, RunView, type BaseEntity, type UserInfo } from '@memberjunction/core';
import { NotificationEngine } from '@memberjunction/notifications';
import { authorizeNoticeWrite, shareRecipients, type Band, type MemberSnapshot, type RoleFlags, type SpaceNode } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsCollaborationItemUseEntity, mjBizAppsCollaborationShareNoticeEntity } from '@mj-biz-apps/collaboration-entities';
import { loadAncestorChain, requireSystemUser } from './load-graph.js';
import { asMetadata, parseUuid } from './uuid.js';

const SPACE_RESOURCE = '33642155-617E-4825-A2CC-F071A60F3739';

/** The roster `recordShare` already loaded, keyed by the notice object it is about to save. */
const decidedRosters = new WeakMap<object, { spaces: SpaceNode[]; memberships: MemberSnapshot[] }>();

export function rememberShareRoster(notice: object, roster: { spaces: SpaceNode[]; memberships: MemberSnapshot[] }): void {
    decidedRosters.set(notice, roster);
}

export function rosterForNotice(notice: object): { spaces: SpaceNode[]; memberships: MemberSnapshot[] } | undefined {
    return decidedRosters.get(notice);
}

export function forgetShareRoster(notice: object): void {
    decidedRosters.delete(notice);
}
const SHARE_TYPE = 'Collaboration Share';
const MEMBERS = 'MJ_BizApps_Collaboration: Space Members';
const ROLES = 'MJ_BizApps_Collaboration: Space Role Types';

export async function recordItemUse(
    entity: BaseEntity,
    user: UserInfo,
    itemId: string,
    spaceId: string,
    kind: 'open' | 'upload' | 'promote',
): Promise<boolean> {
    if (!entity.ProviderToUse) return false;
    const metadata = asMetadata(entity.ProviderToUse);
    if (!metadata) return false;
    const use = await metadata.GetEntityObject<mjBizAppsCollaborationItemUseEntity>('MJ_BizApps_Collaboration: Item Uses', user);
    use.NewRecord();
    use.ItemID = itemId;
    use.SpaceID = spaceId;
    use.UserID = user.ID;
    use.UsedAt = new Date();
    use.Kind = kind;
    if (!(await use.Save())) {
        LogError(`Item use was not recorded: ${use.LatestResult?.CompleteMessage ?? 'save returned false'}`);
        return false;
    }
    return true;
}

/** Writes one notice per recipient and asks NotificationEngine to deliver it in app. */
export async function recordShare(
    entity: BaseEntity,
    user: UserInfo,
    itemId: string,
    spaceId: string,
    band: Band,
): Promise<void> {
    const metadata = asMetadata(entity.ProviderToUse);
    const caller = parseUuid(user.ID);
    const space = parseUuid(spaceId);
    const item = parseUuid(itemId);
    if (!metadata || !caller || !space || !item) return;
    const graph = await loadShareRoster(entity, space);
    const recipients = shareRecipients({
        spaces: graph.spaces,
        memberships: graph.memberships,
        spaceId: space,
        promoterUserId: caller,
    }).filter((recipient) => authorizeNoticeWrite({
        callerUserId: caller,
        recipientUserId: recipient,
        spaceId: space,
        itemSpaceId: space,
        itemBand: band,
        spaces: graph.spaces,
        memberships: graph.memberships,
        isNew: true,
    }).ok);
    const label = await shareLabel(entity, space, item);
    const system = await requireSystemUser(entity);
    for (const recipient of recipients) {
        const notice = await metadata.GetEntityObject<mjBizAppsCollaborationShareNoticeEntity>('MJ_BizApps_Collaboration: Share Notices', user);
        notice.NewRecord();
        notice.SpaceID = space;
        notice.ItemID = item;
        notice.RecipientUserID = recipient;
        rememberShareRoster(notice, graph);
        let saved = false;
        try {
            saved = await notice.Save();
        } finally {
            forgetShareRoster(notice);
        }
        if (!saved) {
            LogError(`Share notice was not recorded: ${notice.LatestResult?.CompleteMessage ?? 'save returned false'}`);
            continue;
        }
        await deliverShare(system, recipient, space, label, metadata);
    }
}

async function deliverShare(
    system: UserInfo,
    recipient: string,
    spaceId: string,
    label: { spaceName: string; itemName: string },
    provider: NonNullable<ReturnType<typeof asMetadata>>,
): Promise<void> {
    try {
        await NotificationEngine.Instance.Config(false, system, provider);
        await NotificationEngine.Instance.SendNotification({
            userId: recipient,
            typeNameOrId: SHARE_TYPE,
            title: `${label.itemName} was shared`,
            message: `${label.itemName} was shared in ${label.spaceName}.`,
            resourceTypeId: SPACE_RESOURCE,
            resourceRecordId: spaceId,
            forceDeliveryChannels: { inApp: true, email: false, sms: false },
        }, system);
    } catch (error) {
        LogError(`Share notification was not delivered: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function shareLabel(entity: BaseEntity, spaceId: string, itemId: string): Promise<{ spaceName: string; itemName: string }> {
    const system = await requireSystemUser(entity);
    const view = new RunView(entity.RunViewProviderToUse);
    const spaces = await view.RunView<{ Name: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Spaces',
        ExtraFilter: `ID = '${spaceId}'`,
        MaxRows: 1,
    }, system);
    const items = await view.RunView<{ Entity: string; RecordID: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Items',
        ExtraFilter: `ID = '${itemId}'`,
        MaxRows: 1,
    }, system);
    const item = items.Results?.[0];
    let itemName = 'An item';
    const recordId = item?.RecordID ?? '';
    const fileId = recordId.startsWith('ID|') ? parseUuid(recordId.slice(3)) : null;
    if (item?.Entity === 'MJ: Files' && fileId) {
        const files = await view.RunView<{ Name: string }>({
            EntityName: 'MJ: Files',
            ExtraFilter: `ID = '${fileId}'`,
            MaxRows: 1,
        }, system);
        if (files.Results?.[0]?.Name) itemName = files.Results[0].Name;
    }
    return { spaceName: spaces.Results?.[0]?.Name || 'a space', itemName };
}

/** The space chain and every active member on it. Not the caller's own rows. */
export async function loadShareRoster(entity: BaseEntity, spaceId: string): Promise<{ spaces: SpaceNode[]; memberships: MemberSnapshot[] }> {
    const system = await requireSystemUser(entity);
    const spaces = await loadAncestorChain(entity, spaceId, system);
    const ids = spaces.map((space) => `'${space.id}'`).join(', ');
    if (!ids) return { spaces, memberships: [] };
    const view = new RunView(entity.RunViewProviderToUse);
    const members = await view.RunView<{ SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: MemberSnapshot['band']; SpaceRoleTypeID: string }>({
        EntityName: MEMBERS,
        ExtraFilter: `SpaceID IN (${ids}) AND Status = 'Active'`,
        MaxRows: 2000,
    }, system);
    if (!members.Success) {
        LogError(`Share notices were not recorded: ${members.ErrorMessage ?? 'the roster could not be read'}`);
        return { spaces, memberships: [] };
    }
    const roleIds = [...new Set((members.Results ?? []).map((row) => parseUuid(row.SpaceRoleTypeID)).filter((id): id is string => !!id))];
    const roles = roleIds.length
        ? await view.RunView<{ ID: string; Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean }>({
            EntityName: ROLES,
            ExtraFilter: `ID IN (${roleIds.map((id) => `'${id}'`).join(', ')})`,
            MaxRows: 50,
        }, system)
        : { Results: [] as { ID: string; Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean }[] };
    const flags = new Map<string, RoleFlags>();
    for (const role of roles.Results ?? []) {
        const id = parseUuid(role.ID);
        if (!id) continue;
        flags.set(id, {
            level: role.Level,
            maxGrantableLevel: role.MaxGrantableLevel,
            canInvite: !!role.CanInvite,
            canPromoteBand: !!role.CanPromoteBand,
            canSeeTeamBand: !!role.CanSeeTeamBand,
            isOwnerRole: !!role.IsOwnerRole,
            canContribute: !!role.CanContribute,
        });
    }
    const empty: RoleFlags = { level: 0, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false, canSeeTeamBand: false, isOwnerRole: false, canContribute: false };
    const memberships = (members.Results ?? []).map((row) => ({
        spaceId: parseUuid(row.SpaceID) ?? row.SpaceID,
        userId: parseUuid(row.UserID) ?? row.UserID,
        status: row.Status,
        band: row.Band,
        role: flags.get(parseUuid(row.SpaceRoleTypeID) ?? '') ?? empty,
    }));
    return { spaces, memberships };
}
