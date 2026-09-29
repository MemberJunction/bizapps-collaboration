import { flagExceedsGrantor, type RoleFlags } from '@mj-biz-apps/collaboration-core';

/** A role type as the invite form and the role picker read it. */
export interface RoleChoice {
    Code: string;
    Name: string;
    IsActive: boolean;
    Level: number;
    MaxGrantableLevel: number;
    CanInvite: boolean;
    CanPromoteBand: boolean;
    CanSeeTeamBand: boolean;
    IsOwnerRole: boolean;
    CanContribute: boolean;
}

export interface RoleOption {
    code: string;
    label: string;
}

function flagsOf(role: RoleChoice): RoleFlags {
    return {
        level: role.Level,
        maxGrantableLevel: role.MaxGrantableLevel,
        canInvite: role.CanInvite,
        canPromoteBand: role.CanPromoteBand,
        canSeeTeamBand: role.CanSeeTeamBand,
        isOwnerRole: role.IsOwnerRole,
        canContribute: role.CanContribute,
    };
}

/**
 * The roles a seat may hand out: active ones at or below its grant ceiling that don't carry a power it lacks (the server
 * refuses anything else). The highest comes first, as the default.
 */
export function grantableRoles(roles: readonly RoleChoice[], grantor: RoleFlags): RoleOption[] {
    return roles
        .filter((role) => role.IsActive && role.Level <= grantor.maxGrantableLevel && flagExceedsGrantor(flagsOf(role), grantor) === null)
        .sort((a, b) => b.Level - a.Level)
        .map((role) => ({ code: role.Code, label: role.Name }));
}
