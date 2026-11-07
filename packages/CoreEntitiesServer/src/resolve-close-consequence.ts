import { type IMetadataProvider, LogError, RunView, UserInfo, WellKnownUserSource } from '@memberjunction/core';
import { reachableStatuses, type SpaceTypeStatusAttributes } from '@mj-biz-apps/collaboration-core';
import { CollaborationEngine } from './CollaborationEngine.js';
import { parseUuid } from './uuid.js';

const SPACES_ENTITY = 'MJ_BizApps_Collaboration: Spaces';
const USERS_ENTITY = 'MJ: Users';
const USER_ROLES_ENTITY = 'MJ: User Roles';

/** What closing a space would do, worked out as the close will stamp it (stage 1: the status it moves to, and what that allows). */
export interface CloseConsequence {
    /** The status the close moves the space to: its type's first terminal status. Null when the type declares none (the space then reads as read-only and visible). */
    status: SpaceTypeStatusAttributes | null;
    /** Whether members may still read the space in that status. */
    readOnly: boolean;
    visible: boolean;
    agentRetrieval: boolean;
    /** The person who keeps the row once it is hidden: the space's `OwnerID`. */
    keeperUserId: string;
    keeperName: string;
    /** Whether that person can reopen it: a status after the close that allows writes, and the owner seat and 'Close and Reopen Spaces' to move there. Null when it could not be checked. */
    keeperCanReopen: boolean | null;
}

/**
 * Works out what closing the space would do, the way `SpaceEntityServer` will stamp it (the type's first terminal status and its
 * attributes), who keeps the space once it is hidden, and whether that person can reopen it. Read on the server because the page
 * can't hold the keeper's seat and roles.
 */
export async function resolveCloseConsequence(provider: IMetadataProvider, viewer: UserInfo, spaceId: string): Promise<CloseConsequence> {
    const id = parseUuid(spaceId);
    if (!id) throw new Error(`'${spaceId}' is not a valid space id.`);
    const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!system) throw new Error('The system user is not available, so the space cannot be read.');
    const rv = RunView.FromMetadataProvider(provider);

    // Only someone who may close the space is told who keeps it and what they hold: the viewer's own reads decide, and the rest is
    // read as the system user. A person who can read the space but not close it is refused, as the page never asks them.
    const own = await rv.RunView<{ ID: string }>({ EntityName: SPACES_ENTITY, ExtraFilter: `ID = '${id}'`, Fields: ['ID'], ResultType: 'simple' }, viewer);
    if (!own.Success || !own.Results?.length) throw new Error('That space is not one you can read.');
    if (!(await CollaborationEngine.Instance.UserCanCloseSpace(viewer, id, provider))) throw new Error('Only someone who may close this space can ask what closing does.');

    const spaces = await rv.RunView<{ SpaceTypeID: string | null; OwnerID: string }>({
        EntityName: SPACES_ENTITY,
        ExtraFilter: `ID = '${id}'`,
        Fields: ['SpaceTypeID', 'OwnerID'],
        ResultType: 'simple',
    }, system);
    const space = spaces.Results?.[0];
    if (!spaces.Success || !space) throw new Error(`The space could not be read: ${spaces.ErrorMessage ?? 'not found'}.`);

    const engine = CollaborationEngine.Instance;
    await engine.EnsureLoaded(system, provider);
    const terminal = engine.FirstTerminalStatusForType(space.SpaceTypeID) ?? null;
    const status: SpaceTypeStatusAttributes | null = terminal ? {
        ID: terminal.ID, Code: terminal.Code, Name: terminal.Name, Sequence: terminal.Sequence, IsDefault: !!terminal.IsDefault,
        ReadOnly: !!terminal.ReadOnly, Visible: !!terminal.Visible, AgentRetrieval: !!terminal.AgentRetrieval,
        CanChangeAfter: !!terminal.CanChangeAfter, NotifyMembersOnEnter: !!terminal.NotifyMembersOnEnter, IsTerminal: !!terminal.IsTerminal,
    } : null;
    // Is there a writable status the space could move to after the close? A terminal status moves forward only
    const all = engine.StatusesForType(space.SpaceTypeID);
    const writableAfter = status ? reachableStatuses(status, all).some((s) => !s.ReadOnly) : false;

    const keeperId = parseUuid(space.OwnerID);
    if (!keeperId) throw new Error("The space's owner is not a valid user id.");
    const [users, roles] = await rv.RunViews([
        { EntityName: USERS_ENTITY, ExtraFilter: `ID = '${keeperId}'`, Fields: ['Name'], ResultType: 'simple' },
        { EntityName: USER_ROLES_ENTITY, ExtraFilter: `UserID = '${keeperId}'`, Fields: ['Role', 'RoleID'], ResultType: 'simple' },
    ], system);
    if (!users.Success || !roles.Success) throw new Error(`The keeper could not be read: ${users.ErrorMessage ?? roles.ErrorMessage ?? 'unknown error'}.`);
    const keeperName = ((users.Results ?? []) as { Name: string }[])[0]?.Name ?? 'the space\'s owner';

    // The keeper as the security layer sees them: their id, and their roles by name (authorizations) and id (row filters)
    const keeper = new UserInfo(provider, {
        ID: keeperId,
        Name: keeperName,
        UserRoles: ((roles.Results ?? []) as { Role: string; RoleID: string }[]).map((row) => ({ UserID: keeperId, Role: row.Role, RoleID: row.RoleID })),
    });
    // A check that fails answers null, not false: "could not check" is not "cannot"
    let keeperCanReopen: boolean | null = null;
    try {
        keeperCanReopen = writableAfter && (await engine.UserCanChangeSpaceStatus(keeper, id, provider));
    } catch (error) {
        LogError(`resolveCloseConsequence: could not tell whether ${keeperName} can reopen space ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {
        status,
        readOnly: status ? status.ReadOnly : true,
        visible: status ? status.Visible : true,
        agentRetrieval: status ? status.AgentRetrieval : true,
        keeperUserId: keeperId,
        keeperName,
        keeperCanReopen,
    };
}
