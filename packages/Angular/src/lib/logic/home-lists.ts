import type { HomeInvitationGraphQL, HomeOpenTaskGraphQL } from '@mj-biz-apps/collaboration-entities';

/** A row of a Home list, before the widget draws it. */
export interface HomeRowModel {
    key: string;
    title: string;
    detail: string;
    spaceName: string;
    iconClass: string;
    actionLabel: string;
}

/** Which list Home has open. */
export type HomeListKind = 'approvals' | 'tasks';

/** Reads a date for a row's second line. Returns an empty string for none or for one that isn't a date. */
export type DateFormatter = (iso: string | null | undefined) => string;

const STATUS_LABELS: Record<string, string> = { Pending: 'Not started', InProgress: 'In progress', Blocked: 'Blocked', OnHold: 'On hold' };

/** The invitations waiting on an owner, each as a row that opens the People tab of its space, where a seat is approved. */
export function invitationRows(invitations: readonly HomeInvitationGraphQL[], formatDate: DateFormatter): HomeRowModel[] {
    return invitations.map((invitation) => {
        const when = formatDate(invitation.InvitedAt);
        const role = invitation.RoleName ? ` as ${invitation.RoleName}` : '';
        return {
            key: invitation.SeatID,
            title: `${invitation.Person} is invited${role}`,
            detail: when ? `Invited ${when}` : 'Waiting for an owner',
            spaceName: invitation.SpaceName,
            iconClass: 'fa-solid fa-user-plus',
            actionLabel: 'Review on People',
        };
    });
}

/** The open tasks in the person's spaces, each as a row that opens the Work tab of the space it is filed in. */
export function taskRows(tasks: readonly HomeOpenTaskGraphQL[], formatDate: DateFormatter): HomeRowModel[] {
    return tasks.map((task) => {
        const due = formatDate(task.DueAt);
        const status = STATUS_LABELS[task.Status] ?? task.Status;
        return {
            key: task.TaskID,
            title: task.Name,
            detail: [status, task.Priority ? `${task.Priority} priority` : '', due ? `due ${due}` : ''].filter(Boolean).join(' · '),
            spaceName: task.SpaceName,
            iconClass: 'fa-solid fa-list-check',
            actionLabel: 'Open in Work',
        };
    });
}

/** What a count pill shows: the number, or a dash while the read failed (a zero would say there is nothing). */
export function countText(count: number, failed: boolean): string {
    return failed ? '—' : String(count);
}

/** What a count pill says to a screen reader: the number and what it counts, or that it could not be read. */
export function countLabel(count: number, failed: boolean, singular: string, plural: string): string {
    if (failed) return `${plural}: could not be read`;
    return `${count} ${count === 1 ? singular : plural}`;
}
