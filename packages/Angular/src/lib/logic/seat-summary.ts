import type { SpaceBand } from '@mj-biz-apps/collaboration-ng-widgets';

/** A seat as the header and the People tab read it. */
export interface SeatSummaryInput {
    name: string;
    initials: string;
    band: SpaceBand | string;
    status: string;
}

export interface SeatSummary {
    totalPeople: number;
    staffAvatars: Array<{ initials: string; name: string; colorClass: string }>;
    outsideAvatars: Array<{ initials: string; name: string; isOutside: boolean; colorClass: string }>;
    audienceSummary: string;
    audienceBand: SpaceBand;
}

/**
 * The header's counts, avatars and audience band. Only Active seats count: an invited or removed seat is
 * still a row the People tab shows, so the members read keeps it, and the counts leave it out here.
 */
export function summarizeSeats(seats: readonly SeatSummaryInput[]): SeatSummary {
    const active = seats.filter((seat) => seat.status === 'Active');
    const staffAvatars = active
        .filter((seat) => seat.band === 'Team')
        .map((seat) => ({ initials: seat.initials, name: seat.name, colorClass: 'c1' }));
    const outsideAvatars = active
        .filter((seat) => seat.band === 'Shared')
        .map((seat) => ({ initials: seat.initials, name: seat.name, isOutside: true, colorClass: 'c2' }));
    return {
        totalPeople: active.length,
        staffAvatars,
        outsideAvatars,
        audienceSummary: `${staffAvatars.length} Team · ${outsideAvatars.length} Outside`,
        audienceBand: outsideAvatars.length > 0 ? 'Shared' : 'Team',
    };
}
