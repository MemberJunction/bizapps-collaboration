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
    organization?: string;
    isExternal: boolean;
}

export interface ExternalOrgGroup {
    organization: string;
    count: number;
}

export interface AudienceBreakdown {
    totalCount: number;
    internalCount: number;
    externalCount: number;
    internalOrg: string;
    externalOrgs: ExternalOrgGroup[];
    /** e.g. "9 people · 3 Meridian · 6 Northwind" or "1 person" */
    pillSummary: string;
    /** e.g. "9 people will see this, 6 at Northwind" */
    composerLine: string;
    /** e.g. "Shared with 9 people (6 at Northwind)" */
    uploadLine: string;
}

function formatPeopleCount(count: number): string {
    return count === 1 ? '1 person' : `${count} people`;
}

/**
 * Computes audience summaries, breakdown counts, and descriptive lines for composer and header.
 * Takes names strictly from member data.
 */
export function summarizeAudience(
    members: readonly AudienceMemberInput[],
    viewerIsExternal: boolean = false,
    hostFirmName?: string,
): AudienceBreakdown {
    const totalCount = members.length;
    const internalMembers = members.filter((m) => !m.isExternal);
    const externalMembers = members.filter((m) => m.isExternal);

    const internalCount = internalMembers.length;
    const externalCount = externalMembers.length;

    // Firm is the host's company (from argument, or from internal member data)
    const internalOrg = hostFirmName || internalMembers.find((m) => !!m.organization?.trim())?.organization?.trim() || '';

    // Group outside people by their own organization
    const orgMap = new Map<string, number>();
    for (const m of externalMembers) {
        const org = m.organization?.trim() || '';
        if (org) {
            orgMap.set(org, (orgMap.get(org) ?? 0) + 1);
        }
    }
    const externalOrgs: ExternalOrgGroup[] = Array.from(orgMap.entries()).map(([organization, count]) => ({
        organization,
        count,
    }));

    // Build pill summary
    let pillSummary: string;
    if (totalCount === 0) {
        pillSummary = '0 people';
    } else {
        const parts: string[] = [];
        if (internalCount > 0 && internalOrg) {
            parts.push(`${internalCount} ${internalOrg}`);
        } else if (internalCount > 0 && externalCount > 0) {
            parts.push(`${internalCount} staff`);
        }
        for (const ext of externalOrgs) {
            parts.push(`${ext.count} ${ext.organization}`);
        }
        if (parts.length > 0) {
            pillSummary = `${formatPeopleCount(totalCount)} · ${parts.join(' · ')}`;
        } else {
            pillSummary = formatPeopleCount(totalCount);
        }
    }

    // Build composer and upload lines
    let composerLine: string;
    let uploadLine: string;

    if (totalCount === 0) {
        composerLine = 'No members in this space';
        uploadLine = 'No members in this space';
    } else if (externalCount === 0) {
        const staffLabel = internalOrg ? `${internalOrg} staff` : 'staff';
        const countStr = internalCount === 1 ? '1' : `${internalCount}`;
        composerLine = `Only the ${countStr} ${staffLabel} here will see this`;
        uploadLine = `Only the ${countStr} ${staffLabel} here will see this`;
    } else if (viewerIsExternal) {
        const hostSuffix = internalOrg ? `at ${internalOrg}` : 'staff';
        const internalCountStr = internalCount === 1 ? '1' : `${internalCount}`;
        composerLine = `${formatPeopleCount(totalCount)} will see this, ${internalCountStr} ${hostSuffix}`;
        uploadLine = `Shared with ${formatPeopleCount(totalCount)} (${internalCountStr} ${hostSuffix})`;
    } else {
        // Staff viewer
        let extDesc: string;
        if (externalOrgs.length > 0) {
            extDesc = externalOrgs.map((o) => `${o.count} at ${o.organization}`).join(', ');
        } else {
            extDesc = externalCount === 1 ? '1 external' : `${externalCount} external`;
        }
        composerLine = `${formatPeopleCount(totalCount)} will see this, ${extDesc}`;
        uploadLine = `Shared with ${formatPeopleCount(totalCount)} (${extDesc})`;
    }

    return {
        totalCount,
        internalCount,
        externalCount,
        internalOrg,
        externalOrgs,
        pillSummary,
        composerLine,
        uploadLine,
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

export interface SpaceBatchContext {
    spaceIds: string[];
    viewerId: string;
    provider?: unknown;
}

export abstract class BaseNeedsYouProvider {
    public abstract getItemsForSpaces(context: SpaceBatchContext): Promise<NeedsYouItem[]>;
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

export abstract class BaseAgendaProvider {
    public abstract getItemsForSpaces(context: SpaceBatchContext): Promise<AgendaItem[]>;
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

export abstract class BaseSpaceHeaderChipProvider {
    public abstract getChipsForSpaces(context: SpaceBatchContext): Promise<Map<string, SpaceHeaderChip[]>>;
}

