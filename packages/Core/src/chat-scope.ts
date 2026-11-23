/**
 * Pure domain types and deterministic (SpaceID, Band) pair mapping helpers for CS-1
 * structural chat scope evaluation.
 */

import type { Band } from './rules.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Canonical (SpaceID, Band) reach pair emitted by fnCollaborationChatScope. */
export interface StructuralChatScopePair {
    SpaceID: string;
    Band: Band;
}

/** Raw row shape returned across SQL Server and PostgreSQL drivers for fnCollaborationChatScope. */
export interface RawStructuralChatScopeRow {
    SpaceID?: string | null;
    spaceid?: string | null;
    space_id?: string | null;
    Band?: string | null;
    band?: string | null;
}

/** Parsed, deduplicated, and deterministically ordered structural chat scope result. */
export interface StructuralChatScopeResolution {
    /** Deduplicated pairs ordered deterministically by SpaceID ASC, then Band ASC ('Shared' before 'Team'). */
    pairs: readonly StructuralChatScopePair[];
    /** Deduplicated reachable SpaceIDs (lowercase UUIDs) ordered deterministically. */
    spaceIds: readonly string[];
    /** Allowed band set per lowercase SpaceID. */
    bandsBySpaceId: ReadonlyMap<string, ReadonlySet<Band>>;
    /** Highest permitted band per lowercase SpaceID ('Team' when both Shared & Team exist, otherwise 'Shared'). */
    maxBandBySpaceId: ReadonlyMap<string, Band>;
}

/** Normalizes and validates a UUID string; returns null for non-UUID inputs (fail closed). */
export function normalizeChatScopeUuid(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim().toLowerCase();
    return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

/** Type guard verifying that a raw string matches a Collaboration Band ('Shared' | 'Team'). */
export function isStructuralChatScopeBand(value: string | null | undefined): value is Band {
    if (typeof value !== 'string') {
        return false;
    }
    const trimmed = value.trim();
    return trimmed === 'Shared' || trimmed === 'Team';
}

function normalizeBandValue(value: string | null | undefined): Band | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (trimmed === 'Shared' || trimmed === 'Team') {
        return trimmed;
    }
    return null;
}

/**
 * Parses raw rows from `fnCollaborationChatScope`, validating UUIDs and Band literals fail-closed,
 * deduplicating `(SpaceID, Band)` pairs, and producing deterministic sorted lookups.
 */
export function parseStructuralChatScopeRows(
    rows: readonly RawStructuralChatScopeRow[],
): StructuralChatScopeResolution {
    const bandsBySpaceId = new Map<string, Set<Band>>();

    for (const row of rows) {
        const rawSpaceId = row.SpaceID ?? row.spaceid ?? row.space_id;
        const rawBand = row.Band ?? row.band;
        const spaceId = normalizeChatScopeUuid(rawSpaceId);
        const band = normalizeBandValue(rawBand);
        if (!spaceId || !band) {
            continue;
        }
        let bands = bandsBySpaceId.get(spaceId);
        if (!bands) {
            bands = new Set<Band>();
            bandsBySpaceId.set(spaceId, bands);
        }
        bands.add(band);
    }

    const spaceIds = Array.from(bandsBySpaceId.keys()).sort((a, b) => a.localeCompare(b));
    const pairs: StructuralChatScopePair[] = [];
    const maxBandBySpaceId = new Map<string, Band>();

    for (const spaceId of spaceIds) {
        const bands = bandsBySpaceId.get(spaceId);
        if (!bands) continue;
        if (bands.has('Shared')) {
            pairs.push({ SpaceID: spaceId, Band: 'Shared' });
        }
        if (bands.has('Team')) {
            pairs.push({ SpaceID: spaceId, Band: 'Team' });
            maxBandBySpaceId.set(spaceId, 'Team');
        } else if (bands.has('Shared')) {
            maxBandBySpaceId.set(spaceId, 'Shared');
        }
    }

    return {
        pairs,
        spaceIds,
        bandsBySpaceId,
        maxBandBySpaceId,
    };
}

/** Returns true iff the resolved structural chat scope authorizes `(spaceId, band)`. */
export function hasStructuralChatScopeAccess(
    resolution: StructuralChatScopeResolution,
    spaceId: string | null | undefined,
    band: Band,
): boolean {
    const normalized = normalizeChatScopeUuid(spaceId);
    if (!normalized) {
        return false;
    }
    return resolution.bandsBySpaceId.get(normalized)?.has(band) ?? false;
}

/** Returns allowed bands for `spaceId` in deterministic order (`'Shared'` before `'Team'`). */
export function allowedBandsForSpace(
    resolution: StructuralChatScopeResolution,
    spaceId: string | null | undefined,
): readonly Band[] {
    const normalized = normalizeChatScopeUuid(spaceId);
    if (!normalized) {
        return [];
    }
    const bands = resolution.bandsBySpaceId.get(normalized);
    if (!bands) {
        return [];
    }
    const ordered: Band[] = [];
    if (bands.has('Shared')) ordered.push('Shared');
    if (bands.has('Team')) ordered.push('Team');
    return ordered;
}

/** Converts a structural chat scope resolution into a mutable `Map<string, Set<Band>>`. */
export function toMutableSpaceBandsMap(
    resolution: StructuralChatScopeResolution,
): Map<string, Set<Band>> {
    const copy = new Map<string, Set<Band>>();
    for (const [spaceId, bands] of resolution.bandsBySpaceId.entries()) {
        copy.set(spaceId, new Set<Band>(bands));
    }
    return copy;
}
