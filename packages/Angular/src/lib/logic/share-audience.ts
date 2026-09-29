/** The fields of a seat the share dialog reads. */
export interface AudienceSeat {
    id: string;
    name: string;
    status: string;
    band: string;
    roleName?: string;
}

export interface ShareAudience {
    header: string;
    subtitle: string;
    /** The seats that gain access: Active, on the Shared band. Never the sharer's own team, and never an invited or removed seat. */
    people: AudienceSeat[];
}

/** Who a share reaches. With no Active outside seat, nobody new gains access, and the dialog says so. */
export function shareAudience(seats: readonly AudienceSeat[]): ShareAudience {
    const people = seats.filter((seat) => seat.status === 'Active' && seat.band === 'Shared');
    if (people.length === 0) {
        return { header: 'Nobody new gains access', subtitle: 'Only people who can already see this space are in it.', people };
    }
    return {
        header: 'Participants who will gain access',
        subtitle: `${people.length} outside participant${people.length === 1 ? '' : 's'}`,
        people,
    };
}
