import { type IRunViewProvider, LogError } from '@memberjunction/core';
import { MJGlobal, type ClassRegistration, UUIDsEqual } from '@memberjunction/global';
import {
    BaseNeedsYouProvider,
    BaseSpaceHeaderChipProvider,
    NeedsYouProvider,
    SpaceHeaderChipProvider,
    normalizeContributionKey,
    type NeedsYouItem,
    type SpaceHeaderChip,
} from '@mj-biz-apps/collaboration-core';
import type {
    NeedsYouItemModel,
    SpaceHeaderActionDescriptor,
    SpaceHeaderChipDescriptor,
    SpaceSettingsSectionDescriptor,
} from '@mj-biz-apps/collaboration-ng-widgets';

export interface SpaceExtensionCollectionContext {
    spaceId: string;
    viewerId: string;
    spaceType?: string;
    provider?: IRunViewProvider;
    onError?: (error: Error) => void;
}

export interface CollectedNeedsYouResult {
    models: NeedsYouItemModel[];
    rawById: Map<string, NeedsYouItem>;
}

/**
 * Checks whether a registration's `Metadata.spaceTypes` targets the given space type code (or `'*'`).
 * Registrations without a `spaceTypes` array are treated as matching all space types.
 */
export function matchesSpaceTypeMetadata(meta: ClassRegistration['Metadata'], spaceTypeCode: string): boolean {
    const rawSpaceTypes = meta?.['spaceTypes'];
    if (!Array.isArray(rawSpaceTypes) || rawSpaceTypes.length === 0) {
        return true;
    }
    const normalizedType = spaceTypeCode.toLowerCase().trim();
    return rawSpaceTypes.some((entry) => {
        if (typeof entry !== 'string') return false;
        const normalizedEntry = entry.toLowerCase().trim();
        return normalizedEntry === '*' || (normalizedType.length > 0 && normalizedEntry === normalizedType);
    });
}

function deduplicateRegistrations(registrations: readonly ClassRegistration[]): ClassRegistration[] {
    const byKey = new Map<string, ClassRegistration>();
    const unkeyed: ClassRegistration[] = [];
    for (const reg of registrations) {
        const key = reg.Key ? normalizeContributionKey(reg.Key) : '';
        if (!key) {
            unkeyed.push(reg);
            continue;
        }
        const existing = byKey.get(key);
        if (!existing || reg.Priority > existing.Priority) {
            byKey.set(key, reg);
        }
    }
    return [...byKey.values(), ...unkeyed];
}

function urgencyRank(urgency: NeedsYouItem['urgency']): number {
    if (urgency === 'critical') return 0;
    if (urgency === 'high') return 1;
    return 2;
}

function mapNeedsYouVariant(urgency: NeedsYouItem['urgency']): NeedsYouItemModel['variant'] {
    if (urgency === 'critical') return 'red';
    if (urgency === 'high') return 'warn';
    return 'blue';
}

function mapNeedsYouItemToModel(item: NeedsYouItem): NeedsYouItemModel {
    const metaIcon = item.metadata?.['iconClass'];
    const iconClass = typeof metaIcon === 'string' && metaIcon.trim().length > 0
        ? metaIcon
        : item.actionType === 'vote'
            ? 'fa-solid fa-check-to-slot'
            : 'fa-solid fa-bell';
    return {
        id: item.id,
        variant: mapNeedsYouVariant(item.urgency),
        iconClass,
        isSpark: item.metadata?.['isSpark'] === true,
        title: item.title,
        subtitle: item.description ?? '',
        actionLabel: item.actionLabel ?? 'Open',
    };
}

/**
 * Queries all registered `BaseNeedsYouProvider` and `NeedsYouProvider` plugins matching the space's type,
 * returning deduplicated, urgency-sorted `NeedsYouItemModel` cards and raw item lookup.
 */
export async function collectSpaceNeedsYouItems(context: SpaceExtensionCollectionContext): Promise<CollectedNeedsYouResult> {
    const spaceType = context.spaceType ?? '';
    const factory = MJGlobal.Instance.ClassFactory;
    const batchRegs = deduplicateRegistrations(factory.GetAllRegistrations(BaseNeedsYouProvider));
    const singleRegs = deduplicateRegistrations(factory.GetAllRegistrations(NeedsYouProvider));

    const rawItems: NeedsYouItem[] = [];
    const seenIds = new Set<string>();

    const pushItem = (item: NeedsYouItem): void => {
        if (!item?.id) return;
        if (item.spaceId && !UUIDsEqual(item.spaceId, context.spaceId)) return;
        const key = item.id.toLowerCase();
        if (seenIds.has(key)) return;
        seenIds.add(key);
        rawItems.push(item);
    };

    for (const reg of batchRegs) {
        if (!matchesSpaceTypeMetadata(reg.Metadata, spaceType)) continue;
        try {
            const Ctor = reg.SubClass as new () => BaseNeedsYouProvider;
            const instance = new Ctor();
            const items = await instance.getItemsForSpaces({
                spaceIds: [context.spaceId],
                viewerId: context.viewerId,
                provider: context.provider,
            });
            if (Array.isArray(items)) {
                for (const item of items) pushItem(item);
            }
        } catch (err) {
            if (context.onError) context.onError(err instanceof Error ? err : new Error(String(err)));
            else LogError(`NeedsYou provider '${reg.Key ?? 'unknown'}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    for (const reg of singleRegs) {
        if (!matchesSpaceTypeMetadata(reg.Metadata, spaceType)) continue;
        try {
            const Ctor = reg.SubClass as new () => NeedsYouProvider;
            const instance = new Ctor();
            const items = await instance.getItems(context.spaceId, context.viewerId);
            if (Array.isArray(items)) {
                for (const item of items) pushItem(item);
            }
        } catch (err) {
            if (context.onError) context.onError(err instanceof Error ? err : new Error(String(err)));
            else LogError(`NeedsYou provider '${reg.Key ?? 'unknown'}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    rawItems.sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency));

    const rawById = new Map<string, NeedsYouItem>();
    const models: NeedsYouItemModel[] = [];
    for (const item of rawItems) {
        rawById.set(item.id, item);
        models.push(mapNeedsYouItemToModel(item));
    }
    return { models, rawById };
}

function mapChipToDescriptor(chip: SpaceHeaderChip, sortKey: number): SpaceHeaderChipDescriptor {
    return {
        key: chip.id,
        label: chip.label,
        icon: chip.icon,
        color: chip.color,
        variant: chip.variant,
        sortKey,
    };
}

/**
 * Queries all registered `BaseSpaceHeaderChipProvider` and `SpaceHeaderChipProvider` plugins matching
 * the space's type and returns normalized `SpaceHeaderChipDescriptor` entries.
 */
export async function collectSpaceHeaderChips(context: SpaceExtensionCollectionContext): Promise<SpaceHeaderChipDescriptor[]> {
    const spaceType = context.spaceType ?? '';
    const factory = MJGlobal.Instance.ClassFactory;
    const batchRegs = deduplicateRegistrations(factory.GetAllRegistrations(BaseSpaceHeaderChipProvider));
    const singleRegs = deduplicateRegistrations(factory.GetAllRegistrations(SpaceHeaderChipProvider));

    const collected: SpaceHeaderChipDescriptor[] = [];
    let order = 10;

    for (const reg of batchRegs) {
        if (!matchesSpaceTypeMetadata(reg.Metadata, spaceType)) continue;
        try {
            const Ctor = reg.SubClass as new () => BaseSpaceHeaderChipProvider;
            const instance = new Ctor();
            const map = await instance.getChipsForSpaces({
                spaceIds: [context.spaceId],
                viewerId: context.viewerId,
                provider: context.provider,
            });
            const chips = map?.get(context.spaceId)
                ?? Array.from(map?.entries() ?? []).find(([k]) => UUIDsEqual(k, context.spaceId))?.[1]
                ?? [];
            for (const chip of chips) {
                collected.push(mapChipToDescriptor(chip, order++));
            }
        } catch (err) {
            if (context.onError) context.onError(err instanceof Error ? err : new Error(String(err)));
            else LogError(`SpaceHeaderChip provider '${reg.Key ?? 'unknown'}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    for (const reg of singleRegs) {
        if (!matchesSpaceTypeMetadata(reg.Metadata, spaceType)) continue;
        try {
            const Ctor = reg.SubClass as new () => SpaceHeaderChipProvider;
            const instance = new Ctor();
            const chips = await instance.getChips(context.spaceId, spaceType);
            if (Array.isArray(chips)) {
                for (const chip of chips) {
                    collected.push(mapChipToDescriptor(chip, order++));
                }
            }
        } catch (err) {
            if (context.onError) context.onError(err instanceof Error ? err : new Error(String(err)));
            else LogError(`SpaceHeaderChip provider '${reg.Key ?? 'unknown'}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return normalizeDescriptors(collected);
}

/** Deduplicates extension descriptors by normalized key (later entry wins) and sorts stably by `sortKey`. */
export function normalizeDescriptors<T extends { key: string; sortKey?: number }>(items: readonly T[]): T[] {
    const merged = new Map<string, T>();
    for (const item of items) {
        if (!item?.key) continue;
        merged.set(normalizeContributionKey(item.key), item);
    }
    return [...merged.values()].sort((a, b) => (a.sortKey ?? 100) - (b.sortKey ?? 100));
}

export function normalizeHeaderChips(chips: readonly SpaceHeaderChipDescriptor[]): SpaceHeaderChipDescriptor[] {
    return normalizeDescriptors(chips);
}

export function normalizeHeaderActions(actions: readonly SpaceHeaderActionDescriptor[]): SpaceHeaderActionDescriptor[] {
    return normalizeDescriptors(actions);
}

export function normalizeSettingsSections(sections: readonly SpaceSettingsSectionDescriptor[]): SpaceSettingsSectionDescriptor[] {
    return normalizeDescriptors(sections);
}
