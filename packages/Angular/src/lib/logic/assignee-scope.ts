import { authorizeTaskAssignment, type Band, type RoleFlags } from '@mj-biz-apps/collaboration-core';

/** A seat through which a person reaches the space a task is filed in: their own, or an inherited one on an ancestor. */
export interface AssignableSeat {
    userId: string;
    /** The space the seat is on: the task's space, or an ancestor when the seat is inherited. */
    seatSpaceId: string;
    role: RoleFlags;
}

export interface AssignableUsersInput {
    taskSpaceId: string;
    taskBand: Band;
    allowParentAssignees: boolean;
    callerMayAdminister: boolean;
}

/**
 * The users a task may be given to: each seat put through the rule the server applies to every assignment, so the picker
 * offers exactly the people the save would accept. A Team task skips anyone who cannot see Team; a seat above the space is
 * offered only when the space allows parent assignees or the caller administers spaces.
 */
export function assignableUsers(seats: readonly AssignableSeat[], input: AssignableUsersInput): string[] {
    return seats
        .filter((seat) =>
            authorizeTaskAssignment({
                callerMayAdminister: input.callerMayAdminister,
                taskSpaceId: input.taskSpaceId,
                assigneeSeatSpaceId: seat.seatSpaceId,
                allowParentAssignees: input.allowParentAssignees,
                taskBand: input.taskBand,
                assigneeRole: seat.role,
            }).ok
        )
        .map((seat) => seat.userId);
}

/**
 * The People filter the Tasks edit panel's assignee picker takes: the given people, or nobody. An empty list is never passed
 * as an empty array, which the panel reads as "everyone".
 */
export function assigneeScopeFilter(personIds: readonly string[]): string {
    const ids = [...new Set(personIds.map((id) => id.trim()).filter(Boolean))];
    return ids.length ? `ID IN (${ids.map((id) => `'${id}'`).join(', ')})` : '1 = 0';
}
