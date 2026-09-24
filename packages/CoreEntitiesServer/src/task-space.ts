import { RunView, type IMetadataProvider, type UserInfo, type BaseEntity } from '@memberjunction/core';
import { membershipReaches, type Band } from '@mj-biz-apps/collaboration-core';
import { loadWriteContext, requireSystemUser } from './load-graph.js';
import { asMetadata } from './uuid.js';

const TASKS = 'MJ_BizApps_Tasks: Tasks';
const ITEMS = 'MJ_BizApps_Collaboration: Space Items';
const PEOPLE = 'MJ_BizApps_Common: People';
const USERS = 'MJ: Users';

export async function filedTask(provider: IMetadataProvider, reader: UserInfo, taskId: string): Promise<{ spaceId: string; band: Band; root: boolean } | null> {
    let current: string | null = taskId;
    for (let step = 0; step < 32 && current; step++) {
        const item = await spaceItemFor(provider, reader, current);
        if (item) return { spaceId: item.spaceId, band: item.band, root: current.toLowerCase() === taskId.toLowerCase() };
        current = await parentOf(provider, reader, current);
    }
    return null;
}

export async function assigneeSeatMessage(assignment: BaseEntity): Promise<string | null> {
    const provider = assignment.ProviderToUse ? asMetadata(assignment.ProviderToUse) : null;
    const user = assignment.ContextCurrentUser;
    if (!provider?.EntityByName || !user) return null;
    const taskId = String(assignment.Get('TaskID') ?? '');
    if (!taskId) return null;
    let system: UserInfo;
    try {
        system = await requireSystemUser(assignment);
    } catch {
        return 'Assignment refused: the space could not be read.';
    }
    const place = await filedTask(provider, system, taskId);
    if (!place) return null;
    const assigneeUserId = await assigneeUser(provider, system, String(assignment.Get('AssigneeEntityID') ?? ''), String(assignment.Get('AssigneeRecordID') ?? ''));
    if (!assigneeUserId) return 'Assignment refused: the assignee is not a person in this space.';
    const context = await loadWriteContext(assignment, system, place.spaceId, null);
    const reach = membershipReaches(context.spaces, context.memberships, assigneeUserId, place.spaceId);
    if (!reach) return 'Assignment refused: the assignee does not hold a seat in this space.';
    if (place.band === 'Team' && !reach.role.canSeeTeamBand) return 'Assignment refused: a Team task cannot be given to someone who cannot see Team.';
    return null;
}

async function spaceItemFor(provider: IMetadataProvider, reader: UserInfo, taskId: string): Promise<{ spaceId: string; band: Band } | null> {
    const tasks = provider.EntityByName(TASKS);
    if (!tasks) return null;
    const view = RunView.FromMetadataProvider(provider);
    const id = taskId.replace(/'/g, "''");
    const rows = await view.RunView<{ SpaceID: string; Band: Band }>({
        EntityName: ITEMS,
        ExtraFilter: `EntityID = '${tasks.ID}' AND (RecordID = '${id}' OR RecordID = 'ID|${id}')`,
        Fields: ['SpaceID', 'Band'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    const row = rows.Success ? rows.Results?.[0] : undefined;
    if (!row?.SpaceID) return null;
    return { spaceId: row.SpaceID, band: row.Band === 'Team' ? 'Team' : 'Shared' };
}

async function parentOf(provider: IMetadataProvider, reader: UserInfo, taskId: string): Promise<string | null> {
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ ParentID: string | null }>({
        EntityName: TASKS,
        ExtraFilter: `ID = '${taskId}'`,
        Fields: ['ParentID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    return rows.Success ? rows.Results?.[0]?.ParentID ?? null : null;
}

async function assigneeUser(provider: IMetadataProvider, reader: UserInfo, entityId: string, recordId: string): Promise<string | null> {
    const people = provider.EntityByName(PEOPLE);
    const users = provider.EntityByName(USERS);
    const raw = recordId.toLowerCase().startsWith('id|') ? recordId.slice(3) : recordId;
    if (users && entityId.toLowerCase() === users.ID.toLowerCase()) return raw;
    if (!people || entityId.toLowerCase() !== people.ID.toLowerCase()) return null;
    const view = RunView.FromMetadataProvider(provider);
    const rows = await view.RunView<{ LinkedUserID: string | null }>({
        EntityName: PEOPLE,
        ExtraFilter: `ID = '${raw}'`,
        Fields: ['LinkedUserID'],
        MaxRows: 1,
        ResultType: 'simple',
    }, reader);
    return rows.Success ? rows.Results?.[0]?.LinkedUserID ?? null : null;
}
