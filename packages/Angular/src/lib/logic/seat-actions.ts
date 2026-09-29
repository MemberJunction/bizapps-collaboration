import { flagExceedsGrantor, type RoleFlags } from '@mj-biz-apps/collaboration-core';

/** What the person looking may do to one seat, in the terms the seat's gate uses. */
export interface SeatActionInput {
    /** The role of the seat the viewer reaches the space through. */
    caller: RoleFlags;
    /** Whether the space's type holds invites for approval (`InviteApproval: 'Approve'`). */
    typeApprovesInvites: boolean;
    target: {
        status: string;
        role: RoleFlags;
        /** The seat is the viewer's own. */
        isSelf: boolean;
        /** The seat is an Active owner seat and the only one on the space. */
        isOnlyActiveOwner: boolean;
    };
}

export interface SeatActions {
    approve: boolean;
    remove: boolean;
    changeRole: boolean;
}

/**
 * The seat actions to offer, following the gate (`SpaceMemberEntityServer`): the viewer must be able to invite, hold a role at or
 * above the seat's level within their ceiling, and not lack any power the seat's role has. On a type that holds invites for
 * approval, only an owner may leave a seat Active, so Approve and Change role are offered to owners alone there. Nobody may
 * remove or re-role the space's last owner.
 */
export function seatActions(input: SeatActionInput): SeatActions {
    const { caller, target } = input;
    const mayHandle = caller.canInvite
        && target.role.level <= caller.maxGrantableLevel
        && flagExceedsGrantor(target.role, caller) === null;
    const mayActivate = caller.isOwnerRole || !input.typeApprovesInvites;
    const lastOwnerLocked = target.isSelf && target.isOnlyActiveOwner;
    return {
        approve: mayHandle && mayActivate && target.status === 'Invited',
        changeRole: mayHandle && mayActivate && target.status === 'Active' && !lastOwnerLocked,
        remove: mayHandle && target.status !== 'Removed' && !lastOwnerLocked,
    };
}
