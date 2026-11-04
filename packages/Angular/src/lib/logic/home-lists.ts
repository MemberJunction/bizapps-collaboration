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
export type HomeListKind = 'approvals' | 'tasks' | 'pins';

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

/** *My pins* on Home (B22): each pin as a row, its space named, opening where the pin lives. */
export function pinRows(pins: ReadonlyArray<{ id: string; title: string; subtitle: string; spaceName: string; iconClass: string }>): HomeRowModel[] {
    return pins.map((pin) => ({
        key: pin.id,
        title: pin.title,
        detail: pin.subtitle,
        spaceName: pin.spaceName,
        iconClass: pin.iconClass,
        actionLabel: 'Open',
    }));
}

/** One item in Home's *Needs you* section, rendered with `mjc-needs-you-card`. */
export interface HomeNeedsYouCardModel {
    id: string;
    spaceId: string;
    variant: 'blue' | 'warn' | 'red';
    iconClass: string;
    isSpark?: boolean;
    title: string;
    subtitle: string;
    actionLabel: string;
}

/** Builds Home's *Needs you* cards from the invitations waiting on an owner across the viewer's spaces. */
export function needsYouCards(invitations: readonly HomeInvitationGraphQL[], formatDate: DateFormatter): HomeNeedsYouCardModel[] {
    const rows = invitationRows(invitations, formatDate);
    return rows.map((row, idx) => ({
        id: row.key,
        spaceId: invitations[idx]?.SpaceID ?? '',
        variant: 'warn',
        iconClass: row.iconClass,
        title: row.title,
        subtitle: [row.spaceName, row.detail].filter(Boolean).join(' · '),
        actionLabel: row.actionLabel,
    }));
}

export interface HomeSpaceSignalInput {
    isClosed: boolean;
    isSealed: boolean;
    invitationsWaiting: number;
    openTasks: number;
    pinsCount: number;
    childCount: number;
}

export interface HomeSpaceSignal {
    label: string;
    variant: 'brand' | 'warn' | 'team' | 'plain' | 'muted';
    iconClass?: string;
}

/** Computes the single signal badge for a space row on Home (`docs/ux/README.md`, frame 01). */
export function spaceSignal(input: HomeSpaceSignalInput): HomeSpaceSignal | null {
    if (input.isClosed) {
        return { label: 'Closed', variant: 'muted', iconClass: 'fa-solid fa-lock' };
    }
    if (input.invitationsWaiting > 0) {
        return {
            label: `${input.invitationsWaiting} ${input.invitationsWaiting === 1 ? 'invite waiting' : 'invites waiting'}`,
            variant: 'warn',
        };
    }
    if (input.isSealed) {
        return { label: 'Sealed', variant: 'team', iconClass: 'fa-solid fa-lock' };
    }
    if (input.openTasks > 0) {
        return {
            label: `${input.openTasks} open ${input.openTasks === 1 ? 'task' : 'tasks'}`,
            variant: 'brand',
        };
    }
    if (input.pinsCount > 0) {
        return {
            label: `${input.pinsCount} pinned`,
            variant: 'plain',
        };
    }
    if (input.childCount > 0) {
        return {
            label: `${input.childCount} ${input.childCount === 1 ? 'sub-space' : 'sub-spaces'}`,
            variant: 'plain',
        };
    }
    return null;
}
