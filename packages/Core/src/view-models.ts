/**
 * L0 domain view-models and extension contracts for the Collaboration UI.
 * Pure TypeScript — no Angular, no DOM, importable from any environment.
 */

// ============================================================================
// Avatar Palette (10-color stable hash)
// ============================================================================

export const AVATAR_COLOR_CLASSES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'] as const;
export type AvatarColorClass = (typeof AVATAR_COLOR_CLASSES)[number];

/**
 * Maps a person's ID (or string key) deterministically to one of 10 avatar palette classes (.c1–.c10).
 */
export function avatarColorClass(personId: string): AvatarColorClass {
    if (!personId) return 'c1';
    let hash = 0;
    for (let i = 0; i < personId.length; i++) {
        hash = (hash << 5) - hash + personId.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % AVATAR_COLOR_CLASSES.length;
    return AVATAR_COLOR_CLASSES[idx];
}

// ============================================================================
// Audience Summary
// ============================================================================

export interface AudienceMemberInput {
    id: string;
    organization: string;
    isExternal: boolean;
}

export interface AudienceBreakdown {
    totalCount: number;
    internalCount: number;
    externalCount: number;
    internalOrg: string;
    externalOrg: string;
    /** e.g. "9 people · 3 Meridian · 6 Northwind" */
    pillSummary: string;
    /** e.g. "9 people will see this, 6 at Northwind" */
    composerLine: string;
    /** e.g. "Shared with 9 people (6 at Northwind)" */
    uploadLine: string;
}

/**
 * Computes audience summaries, breakdown counts, and descriptive lines for composer and header.
 */
export function summarizeAudience(
    members: readonly AudienceMemberInput[],
    viewerIsExternal: boolean = false,
    defaultInternalOrg: string = 'Meridian',
    defaultExternalOrg: string = 'Northwind',
): AudienceBreakdown {
    const totalCount = members.length;
    const internalMembers = members.filter((m) => !m.isExternal);
    const externalMembers = members.filter((m) => m.isExternal);

    const internalCount = internalMembers.length;
    const externalCount = externalMembers.length;

    const internalOrg = internalMembers[0]?.organization || defaultInternalOrg;
    const externalOrg = externalMembers[0]?.organization || defaultExternalOrg;

    const pillSummary = `${totalCount} people · ${internalCount} ${internalOrg} · ${externalCount} ${externalOrg}`;

    let composerLine: string;
    let uploadLine: string;

    if (externalCount === 0) {
        composerLine = `Only the ${internalCount} ${internalOrg} staff here will see this`;
        uploadLine = `Only the ${internalCount} ${internalOrg} staff here will see this`;
    } else if (viewerIsExternal) {
        composerLine = `${totalCount} people will see this, ${internalCount} at ${internalOrg}`;
        uploadLine = `Shared with ${totalCount} people (${internalCount} at ${internalOrg})`;
    } else {
        composerLine = `${totalCount} people will see this, ${externalCount} at ${externalOrg}`;
        uploadLine = `Shared with ${totalCount} people (${externalCount} at ${externalOrg})`;
    }

    return {
        totalCount,
        internalCount,
        externalCount,
        internalOrg,
        externalOrg,
        pillSummary,
        composerLine,
        uploadLine,
    };
}

// ============================================================================
// Band Visibility
// ============================================================================

export interface BandVisibilityResult {
    canUseTeam: boolean;
    canUseShared: boolean;
    explanation: string;
}

/**
 * Determines which data bands the Assistant may access based on chat participants.
 */
export function computeBandVisibility(participants: readonly { isExternal: boolean }[]): BandVisibilityResult {
    const hasExternal = participants.some((p) => p.isExternal);
    if (hasExternal) {
        return {
            canUseTeam: false,
            canUseShared: true,
            explanation: 'It can use Shared material only.',
        };
    }
    return {
        canUseTeam: true,
        canUseShared: true,
        explanation: 'It can use Team and Shared material.',
    };
}

// ============================================================================
// Space Progress
// ============================================================================

export interface SpaceProgressResult {
    totalWeeks: number;
    currentWeek: number;
    percentComplete: number;
    progressLabel: string;
}

/**
 * Computes space lifecycle timeline progress (e.g. "Week 7 of 10").
 */
export function computeSpaceProgress(
    startedAt: Date | string | null | undefined,
    plannedCloseAt: Date | string | null | undefined,
    now: Date | string = new Date(),
): SpaceProgressResult {
    if (!startedAt || !plannedCloseAt) {
        return {
            totalWeeks: 0,
            currentWeek: 0,
            percentComplete: 0,
            progressLabel: '',
        };
    }

    const start = new Date(startedAt).getTime();
    const end = new Date(plannedCloseAt).getTime();
    const current = new Date(now).getTime();

    if (end <= start) {
        return {
            totalWeeks: 1,
            currentWeek: 1,
            percentComplete: 100,
            progressLabel: 'Week 1 of 1',
        };
    }

    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.max(1, Math.round((end - start) / msPerWeek));
    const elapsedWeeks = Math.floor((current - start) / msPerWeek) + 1;
    const currentWeek = Math.min(totalWeeks, Math.max(1, elapsedWeeks));
    const percentComplete = Math.min(100, Math.max(0, Math.round(((current - start) / (end - start)) * 100)));

    return {
        totalWeeks,
        currentWeek,
        percentComplete,
        progressLabel: `Week ${currentWeek} of ${totalWeeks}`,
    };
}

// ============================================================================
// Needs You & Agenda Models + Merging
// ============================================================================

export interface NeedsYouItem {
    id: string;
    spaceId?: string;
    title: string;
    description?: string;
    actionLabel?: string;
    actionType?: string;
    urgency?: 'normal' | 'high' | 'critical';
    sourceProvider?: string;
    createdAt?: Date;
    metadata?: Record<string, string | number | boolean | null>;
}

export abstract class NeedsYouProvider {
    public abstract getItems(spaceId?: string, userId?: string): Promise<NeedsYouItem[]>;
}

export interface AgendaItem {
    id: string;
    spaceId?: string;
    spaceName?: string;
    spaceTypeCode?: string;
    title: string;
    context?: string;
    date: Date;
    typeIcon?: string;
    sourceProvider?: string;
    metadata?: Record<string, string | number | boolean | null>;
}

export abstract class AgendaProvider {
    public abstract getItems(spaceId?: string, userId?: string): Promise<AgendaItem[]>;
}

/**
 * Merges, deduplicates, and sorts agenda items chronologically ascending.
 */
export function mergeAgenda(itemArrays: readonly (readonly AgendaItem[])[]): AgendaItem[] {
    const seen = new Set<string>();
    const merged: AgendaItem[] = [];

    for (const list of itemArrays) {
        for (const item of list) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                merged.push(item);
            }
        }
    }

    return merged.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ============================================================================
// Space Header Chip Extension Point
// ============================================================================

export interface SpaceHeaderChip {
    id: string;
    label: string;
    icon?: string;
    color?: string;
    variant?: 'plain' | 'ok' | 'warn' | 'info';
}

export abstract class SpaceHeaderChipProvider {
    public abstract getChips(spaceId: string, spaceTypeCode: string): Promise<SpaceHeaderChip[]>;
}
