export type UploadBand = 'Shared' | 'Team';

/** The flags of a seat's role that decide which bands it may put material in. */
export interface UploadRoleFlags {
    CanSeeTeamBand: boolean;
    CanPromoteBand: boolean;
}

/**
 * The bands a seat may choose for an upload. A seat that can't see Team can only share; one that can see Team
 * but can't promote can only keep material on Team. With no known role, both are offered and the server decides.
 */
export function allowedUploadBands(role: UploadRoleFlags | null | undefined): readonly UploadBand[] {
    if (!role) return ['Shared', 'Team'];
    if (!role.CanSeeTeamBand) return ['Shared'];
    return role.CanPromoteBand ? ['Shared', 'Team'] : ['Team'];
}
