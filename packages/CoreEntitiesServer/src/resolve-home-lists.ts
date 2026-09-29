import type { IMetadataProvider, IRunQueryProvider, UserInfo } from '@memberjunction/core';
import { runHomeQuery } from './home-query.js';

const INVITATIONS_QUERY = 'Collaboration Home Invitations';
const OPEN_TASKS_QUERY = 'Collaboration Home Open Tasks';

/** How many rows of each list Home shows. The counts say how many there are in all. */
export const HOME_LIST_LIMIT = 50;

/** An invitation waiting on an owner, in a space where the person's role may invite. */
export interface HomeInvitation {
    seatId: string;
    spaceId: string;
    spaceName: string;
    /** The invited person's name, else their email. */
    person: string;
    roleName: string;
    invitedAt: string | null;
}

/** An open task filed in one of the person's spaces. A task filed in two spaces is one row, under the first space by name. */
export interface HomeOpenTask {
    taskId: string;
    name: string;
    status: string;
    priority: string | null;
    dueAt: string | null;
    spaceId: string;
    spaceName: string;
}

export interface HomeLists {
    invitations: HomeInvitation[];
    openTasks: HomeOpenTask[];
}

interface InvitationRow {
    SeatID: string;
    SpaceID: string;
    SpaceName: string;
    Person: string | null;
    RoleName: string | null;
    InvitedAt: Date | string | null;
}

interface OpenTaskRow {
    TaskID: string;
    TaskName: string;
    Status: string;
    Priority: string | null;
    DueAt: Date | string | null;
    SpaceID: string;
    SpaceName: string;
}

const asIso = (value: Date | string | null): string | null => (value === null || value === undefined ? null : new Date(value).toISOString());

/**
 * What Home's counts count: the invitations waiting and the open tasks, each up to {@link HOME_LIST_LIMIT} rows, from two approved
 * MJ queries run for the signed-in person (see `runHomeQuery`). The queries apply the same rules as 'Collaboration Home Counts', so
 * a list is the rows behind its count.
 */
export async function resolveHomeLists(provider: IMetadataProvider & IRunQueryProvider, user: UserInfo): Promise<HomeLists> {
    const [invitations, tasks] = await Promise.all([
        runHomeQuery<InvitationRow>(provider, user, INVITATIONS_QUERY, "Home's invitations"),
        runHomeQuery<OpenTaskRow>(provider, user, OPEN_TASKS_QUERY, "Home's open tasks"),
    ]);
    return {
        invitations: invitations.map((row) => ({
            seatId: row.SeatID,
            spaceId: row.SpaceID,
            spaceName: row.SpaceName,
            person: row.Person ?? 'Someone',
            roleName: row.RoleName ?? '',
            invitedAt: asIso(row.InvitedAt),
        })),
        openTasks: tasks.map((row) => ({
            taskId: row.TaskID,
            name: row.TaskName,
            status: row.Status,
            priority: row.Priority,
            dueAt: asIso(row.DueAt),
            spaceId: row.SpaceID,
            spaceName: row.SpaceName,
        })),
    };
}
