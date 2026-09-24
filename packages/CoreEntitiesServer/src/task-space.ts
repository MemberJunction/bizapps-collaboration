import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { membershipReaches, type Band, type MemberSnapshot, type RoleFlags, type SpaceNode } from '@mj-biz-apps/collaboration-core';
import { mjBizAppsTasksTaskAssignmentEntity } from '@mj-biz-apps/tasks-entities';
import { requireSystemUser } from './load-graph.js';
import { asMetadata, parseUuid } from './uuid.js';

const TASKS = 'MJ_BizApps_Tasks: Tasks';
const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const PEOPLE = 'MJ_BizApps_Common: People';
const USERS = 'MJ: Users';
const SEAT_FIELDS = ['TaskID', 'AssigneeEntityID', 'AssigneeRecordID'] as const;

/** True on a new record, or when one of the named fields is dirty. */
export function relevantFieldsChanged(record: { IsSaved: boolean; Fields: ReadonlyArray<{ Name: string; Dirty?: boolean }> }, names: readonly string[]): boolean {
    if (!record.IsSaved) return true;
    return names.some((name) => record.Fields.some((field) => field.Name === name && field.Dirty));
}

/**
 * The space a task is filed in, if any. Two reads: `RootParentID` on the task
 * view is the root, and that root's space item is the filing. A task with no
 * parent is its own root.
 */
export async function filedTask(provider: IMetadataProvider, reader: UserInfo, taskId: string): Promise<{ spaceId: string; band: Band; root: boolean } | null> {
    const id = parseUuid(taskId);
    if (!id) return null;
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ RootParentID: string | null }>({
        EntityName: TASKS,
        ExtraFilter: `ID = '${id}'`,
        Fields: ['RootParentID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'the task could not be read');
    const row = rows.Results?.[0];
    if (!row) return null;
    const rootId = parseUuid(row.RootParentID);
    if (!rootId) return null;
    const item = await spaceItemFor(provider, reader, rootId);
    if (!item) return null;
    return { spaceId: item.spaceId, band: item.band, root: rootId === id };
}

export async function assigneeSeatMessage(assignment: mjBizAppsTasksTaskAssignmentEntity): Promise<string | null> {
    if (!relevantFieldsChanged(assignment, SEAT_FIELDS)) return null;
    const provider = assignment.ProviderToUse ? asMetadata(assignment.ProviderToUse) : null;
    const user = assignment.ContextCurrentUser;
    if (!provider?.EntityByName || !user || !assignment.TaskID) return null;
    try {
        const system = await requireSystemUser(assignment);
        const place = await filedTask(provider, system, assignment.TaskID);
        if (!place) return null;
        const assigneeUserId = await assigneeUser(provider, system, assignment.AssigneeEntityID, assignment.AssigneeRecordID);
        if (!assigneeUserId) return 'Assignment refused: the assignee is not a person in this space.';
        const reach = await assigneeReach(provider, system, assigneeUserId, place.spaceId);
        if (!reach) return 'Assignment refused: the assignee does not hold a seat in this space.';
        if (place.band === 'Team' && !reach.role.canSeeTeamBand) return 'Assignment refused: a Team task cannot be given to someone who cannot see Team.';
        return null;
    } catch (error) {
        LogError(`Assignment seat check for task ${assignment.TaskID}: ${error instanceof Error ? error.message : String(error)}`);
        return 'Assignment refused: the space could not be read.';
    }
}

async function assigneeReach(provider: IMetadataProvider, reader: UserInfo, assigneeUserId: string, spaceId: string): Promise<MemberSnapshot | null> {
    const userId = parseUuid(assigneeUserId);
    const target = parseUuid(spaceId);
    if (!userId || !target) return null;
    const view = RunView.FromMetadataProvider(provider);
    const memberRows = await view.RunView<{ SpaceID: string; UserID: string; Status: MemberSnapshot['status']; Band: Band; SpaceRoleTypeID: string }>({
        EntityName: 'MJ_BizApps_Collaboration: Space Members',
        ExtraFilter: `UserID = '${userId}' AND Status = 'Active'`,
        MaxRows: 200,
        ResultType: 'simple',
    }, reader);
    if (!memberRows.Success) throw new Error(memberRows.ErrorMessage ?? 'the seats could not be read');
    const roleIds = [...new Set((memberRows.Results ?? []).map((row) => parseUuid(row.SpaceRoleTypeID)).filter((id): id is string => !!id))];
    const roleRows = roleIds.length
        ? await view.RunView<{ ID: string; Level: number; MaxGrantableLevel: number; CanInvite: boolean; CanPromoteBand: boolean; CanSeeTeamBand: boolean; IsOwnerRole: boolean; CanContribute?: boolean }>({
            EntityName: 'MJ_BizApps_Collaboration: Space Role Types',
            ExtraFilter: `ID IN (${roleIds.map((id) => `'${id}'`).join(', ')})`,
            MaxRows: 50,
            ResultType: 'simple',
        }, reader)
        : { Success: true, Results: [] as never[] };
    if (!roleRows.Success) throw new Error('ErrorMessage' in roleRows ? roleRows.ErrorMessage ?? 'the roles could not be read' : 'the roles could not be read');
    const roles = new Map<string, RoleFlags>();
    for (const role of roleRows.Results ?? []) {
        const id = parseUuid(role.ID);
        if (!id) continue;
        roles.set(id, {
            level: role.Level,
            maxGrantableLevel: role.MaxGrantableLevel,
            canInvite: !!role.CanInvite,
            canPromoteBand: !!role.CanPromoteBand,
            canSeeTeamBand: !!role.CanSeeTeamBand,
            isOwnerRole: !!role.IsOwnerRole,
            canContribute: !!role.CanContribute,
        });
    }
    const spaces: SpaceNode[] = [];
    let current: string | null = target;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
        seen.add(current);
        const spaceRows: { Success: boolean; ErrorMessage?: string; Results?: Array<{ ID: string; ParentID: string | null; InheritsMembership: boolean; OwnerID: string; AgentRetrieval: 'Included' | 'ExcludedFromParentScope' | 'ExcludedEntirely' }> } = await view.RunView({
            EntityName: 'MJ_BizApps_Collaboration: Spaces',
            ExtraFilter: `ID = '${current}'`,
            MaxRows: 1,
            ResultType: 'simple',
        }, reader);
        if (!spaceRows.Success) throw new Error(spaceRows.ErrorMessage ?? 'the space could not be read');
        const space = spaceRows.Results?.[0];
        if (!space) break;
        const id = parseUuid(space.ID) ?? space.ID;
        spaces.push({
            id,
            parentId: space.ParentID ? parseUuid(space.ParentID) : null,
            inheritsMembership: !!space.InheritsMembership,
            ownerId: parseUuid(space.OwnerID) ?? space.OwnerID,
            agentRetrieval: space.AgentRetrieval,
        });
        current = space.ParentID ? parseUuid(space.ParentID) : null;
    }
    const empty: RoleFlags = { level: 0, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false, canSeeTeamBand: false, isOwnerRole: false, canContribute: false };
    const memberships: MemberSnapshot[] = (memberRows.Results ?? []).map((row) => ({
        spaceId: parseUuid(row.SpaceID) ?? row.SpaceID,
        userId: parseUuid(row.UserID) ?? row.UserID,
        status: row.Status,
        band: row.Band === 'Team' ? 'Team' : 'Shared',
        role: roles.get(parseUuid(row.SpaceRoleTypeID) ?? '') ?? empty,
    }));
    return membershipReaches(spaces, memberships, userId, target);
}

async function spaceItemFor(provider: IMetadataProvider, reader: UserInfo, taskId: string): Promise<{ spaceId: string; band: Band } | null> {
    const id = parseUuid(taskId);
    const tasks = provider.EntityByName(TASKS);
    const tasksId = parseUuid(tasks?.ID);
    if (!id || !tasksId) return null;
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ SpaceID: string; Band: Band }>({
        EntityName: ITEMS,
        ExtraFilter: `EntityID = '${tasksId}' AND (RecordID = '${id}' OR RecordID = 'ID|${id}')`,
        Fields: ['SpaceID', 'Band'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'the space item could not be read');
    const row = rows.Results?.[0];
    if (!row?.SpaceID) return null;
    return { spaceId: row.SpaceID, band: row.Band === 'Team' ? 'Team' : 'Shared' };
}

async function assigneeUser(provider: IMetadataProvider, reader: UserInfo, entityId: string, recordId: string): Promise<string | null> {
    const people = provider.EntityByName(PEOPLE);
    const users = provider.EntityByName(USERS);
    const raw = recordId.toLowerCase().startsWith('id|') ? recordId.slice(3) : recordId;
    const record = parseUuid(raw);
    const entity = parseUuid(entityId);
    if (!record || !entity) return null;
    if (users && entity === parseUuid(users.ID)) return record;
    if (!people || entity !== parseUuid(people.ID)) return null;
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ LinkedUserID: string | null }>({
        EntityName: PEOPLE,
        ExtraFilter: `ID = '${record}'`,
        Fields: ['LinkedUserID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    if (!rows.Success) throw new Error(rows.ErrorMessage ?? 'the person could not be read');
    return parseUuid(rows.Results?.[0]?.LinkedUserID);
}
