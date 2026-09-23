import type { Band, MemberSnapshot, RoleFlags, SpaceNode } from './rules.ts';

/**
 * Phase 0 is three shapes of the same object: an engagement with a sub-space,
 * a committee with an outside director, and a cohort. No branch on the vocabulary.
 */

export interface Phase0Item {
    id: string;
    spaceId: string;
    label: string;
    band: Band;
    kind: 'file' | 'task' | 'conversation';
    folder: string | null;
}

const owner: RoleFlags = {
    level: 40, maxGrantableLevel: 40, canInvite: true, canPromoteBand: true,
    canSeeTeamBand: true, isOwnerRole: true, canContribute: true,
};
const guest: RoleFlags = {
    level: 10, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false,
    canSeeTeamBand: false, isOwnerRole: false, canContribute: false,
};
const learner: RoleFlags = {
    level: 10, maxGrantableLevel: 0, canInvite: false, canPromoteBand: false,
    canSeeTeamBand: false, isOwnerRole: false, canContribute: true,
};

export const phase0Spaces: SpaceNode[] = [
    { id: 'engagement', parentId: null, inheritsMembership: true, ownerId: 'ada', agentRetrieval: 'Included' },
    { id: 'discovery', parentId: 'engagement', inheritsMembership: true, ownerId: 'ada', agentRetrieval: 'Included' },
    { id: 'committee', parentId: null, inheritsMembership: true, ownerId: 'ada', agentRetrieval: 'Included' },
    { id: 'cohort', parentId: null, inheritsMembership: true, ownerId: 'ada', agentRetrieval: 'Included' },
];

export const phase0Members: MemberSnapshot[] = [
    { spaceId: 'engagement', userId: 'ada', status: 'Active', band: 'Team', role: owner },
    { spaceId: 'discovery', userId: 'bea', status: 'Active', band: 'Shared', role: guest },
    { spaceId: 'committee', userId: 'ada', status: 'Active', band: 'Team', role: owner },
    { spaceId: 'committee', userId: 'director', status: 'Active', band: 'Shared', role: guest },
    { spaceId: 'cohort', userId: 'ada', status: 'Active', band: 'Team', role: owner },
    { spaceId: 'cohort', userId: 'lee', status: 'Active', band: 'Shared', role: learner },
];

export const phase0Items: Phase0Item[] = [
    { id: 'brief', spaceId: 'discovery', label: 'Discovery brief.pdf', band: 'Shared', kind: 'file', folder: 'Deliverables' },
    { id: 'notes', spaceId: 'discovery', label: 'Working notes.docx', band: 'Team', kind: 'file', folder: 'Working' },
    { id: 'plan', spaceId: 'discovery', label: 'Interview plan', band: 'Team', kind: 'task', folder: null },
    { id: 'minutes', spaceId: 'committee', label: 'March minutes.pdf', band: 'Shared', kind: 'file', folder: 'Minutes' },
    { id: 'ballot', spaceId: 'committee', label: 'Draft ballot', band: 'Team', kind: 'task', folder: null },
    { id: 'syllabus', spaceId: 'cohort', label: 'Syllabus.pdf', band: 'Shared', kind: 'file', folder: 'Materials' },
];

export function itemsIn(spaceId: string, kind?: Phase0Item['kind']): Phase0Item[] {
    return phase0Items.filter((item) => item.spaceId === spaceId && (kind ? item.kind === kind : true));
}
