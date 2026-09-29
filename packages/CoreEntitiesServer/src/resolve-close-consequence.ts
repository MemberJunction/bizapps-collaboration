import { type IMetadataProvider, LogError, RunView, UserInfo, WellKnownUserSource } from '@memberjunction/core';
import type { CollaborationSettings } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { parseUuid } from './uuid.js';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const USERS_ENTITY = 'MJ: Users';
const USER_ROLES_ENTITY = 'MJ: User Roles';

/** What closing a space would do, worked out as the close will stamp it. */
export interface CloseConsequence {
    /** The post-close access the close would write to the row. */
    access: 'ReadOnly' | 'ReadOnlyWithAgent' | 'None';
    days: number | null;
    /** The person who keeps the row once its access has ended: the space's `OwnerID`. */
    keeperUserId: string;
    keeperName: string;
    /** Whether that person can reopen it: an owner seat (reached even past the space's end) and 'Close and Reopen Spaces'. */
    keeperCanReopen: boolean;
}

/**
 * Works out what closing the space would do, the way `SpaceEntityServer` will stamp it (the space's own settings, then each
 * ancestor's, then the type's and the app's), who keeps the space once its access has ended, and whether that person can reopen it.
 * Read on the server because the page can't hold the ancestors the viewer can't read, or the keeper's seat and roles.
 */
export async function resolveCloseConsequence(provider: IMetadataProvider, viewer: UserInfo, spaceId: string): Promise<CloseConsequence> {
    const id = parseUuid(spaceId);
    if (!id) throw new Error(`'${spaceId}' is not a valid space id.`);
    const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!system) throw new Error('The system user is not available, so the space cannot be read.');
    const rv = RunView.FromMetadataProvider(provider);

    // The viewer must be able to read the space: the read is theirs, and the rest is read as the system user
    const own = await rv.RunView<{ ID: string }>({ EntityName: SPACES_ENTITY, ExtraFilter: `ID = '${id}'`, Fields: ['ID'], ResultType: 'simple' }, viewer);
    if (!own.Success || !own.Results?.length) throw new Error('That space is not one you can read.');

    const spaces = await rv.RunView<{ ParentID: string | null; SpaceTypeID: string | null; OwnerID: string; Configuration: string | null }>({
        EntityName: SPACES_ENTITY,
        ExtraFilter: `ID = '${id}'`,
        Fields: ['ParentID', 'SpaceTypeID', 'OwnerID', 'Configuration'],
        ResultType: 'simple',
    }, system);
    const space = spaces.Results?.[0];
    if (!spaces.Success || !space) throw new Error(`The space could not be read: ${spaces.ErrorMessage ?? 'not found'}.`);

    let currentConfig: CollaborationSettings | null = null;
    if (space.Configuration) {
        try {
            currentConfig = JSON.parse(space.Configuration) as CollaborationSettings;
        } catch (error) {
            throw new Error(`The space's configuration does not parse: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const engine = CollaborationEngine.Instance;
    const stamped = await engine.ResolvePostCloseAccessForSpace({
        spaceId: id,
        currentConfig,
        parentId: space.ParentID,
        spaceTypeId: space.SpaceTypeID,
        provider,
        contextUser: system,
    });

    const keeperId = parseUuid(space.OwnerID);
    if (!keeperId) throw new Error("The space's owner is not a valid user id.");
    const users = await rv.RunView<{ Name: string }>({ EntityName: USERS_ENTITY, ExtraFilter: `ID = '${keeperId}'`, Fields: ['Name'], ResultType: 'simple' }, system);
    const roles = await rv.RunView<{ Role: string; RoleID: string }>({ EntityName: USER_ROLES_ENTITY, ExtraFilter: `UserID = '${keeperId}'`, Fields: ['Role', 'RoleID'], ResultType: 'simple' }, system);
    if (!users.Success || !roles.Success) throw new Error(`The keeper could not be read: ${users.ErrorMessage ?? roles.ErrorMessage ?? 'unknown error'}.`);
    const keeperName = users.Results?.[0]?.Name ?? 'the space\'s owner';

    // The keeper as the security layer sees them: their id, and their roles by name (authorizations) and id (row filters)
    const keeper = new UserInfo(provider, {
        ID: keeperId,
        Name: keeperName,
        UserRoles: (roles.Results ?? []).map((row) => ({ UserID: keeperId, Role: row.Role, RoleID: row.RoleID })),
    });
    let keeperCanReopen = false;
    try {
        keeperCanReopen = await engine.UserCanReopenSpace(keeper, id, provider);
    } catch (error) {
        LogError(`resolveCloseConsequence: could not tell whether ${keeperName} can reopen space ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { access: stamped.access, days: stamped.days, keeperUserId: keeperId, keeperName, keeperCanReopen };
}
