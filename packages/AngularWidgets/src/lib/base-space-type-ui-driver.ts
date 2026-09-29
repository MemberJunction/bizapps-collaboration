import type { Type } from '@angular/core';
import type { BaseAngularComponent } from '@memberjunction/ng-base-types';
import type { EffectiveSpaceRules } from '@mj-biz-apps/collaboration-core';
import type { mjBizAppsCollaborationSpaceEntity, mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import type { UserInfo } from '@memberjunction/core';
import { BaseSingleton, MJGlobal, type ClassRegistration } from '@memberjunction/global';
import { BaseSpaceTab } from './base-space-tab';
import { BaseSpaceOverviewCard } from './base-space-overview-card';
import { BaseSpaceSettingsSection } from './base-space-settings-section';

// ============================================================================
// UI Context & Descriptors
// ============================================================================

export interface SpaceUIContext {
    space?: mjBizAppsCollaborationSpaceEntity | null;
    type?: mjBizAppsCollaborationSpaceTypeEntity | null;
    spaceTypeCode: string;
    rules: EffectiveSpaceRules;
    viewer?: UserInfo | null;
}

export interface SpaceTabDescriptor {
    key: string;
    label: string;
    icon?: string;
    badgeCount?: number;
    sortKey?: number;
    component?: Type<BaseSpaceTab>;
}

export interface SpaceOverviewCardDescriptor {
    key: string;
    title: string;
    subtitle?: string;
    sortKey?: number;
    component?: Type<BaseSpaceOverviewCard>;
}

export interface SpaceHeaderChipDescriptor {
    key: string;
    label: string;
    icon?: string;
    variant?: 'plain' | 'ok' | 'warn' | 'info';
    color?: string;
    sortKey?: number;
}

export interface SpaceHeaderActionDescriptor {
    key: string;
    label: string;
    icon?: string;
    action: () => void | Promise<void>;
    disabled?: boolean;
    primary?: boolean;
    sortKey?: number;
}

export interface SpaceSettingsSectionDescriptor {
    key: string;
    title: string;
    description?: string;
    sortKey?: number;
    component?: Type<BaseSpaceSettingsSection>;
}

export interface SpaceNewStepDescriptor {
    key: string;
    title: string;
    stepNumber: number;
    component?: Type<BaseAngularComponent>;
}

export interface SpaceDetailsFormDescriptor {
    entityName: string;
    hiddenSectionKeys?: string[];
}

// ============================================================================
// Cancellable UI Events
// ============================================================================

export interface CancellableSpaceUIEvent {
    cancel: boolean;
    cancelReason?: string;
}

export interface BeforeInviteEvent extends CancellableSpaceUIEvent {
    spaceId: string;
    email?: string;
    role?: string;
    band?: 'Team' | 'Shared';
}

export interface BeforeCreateChildSpaceEvent extends CancellableSpaceUIEvent {
    parentSpaceId: string;
    childTypeCode: string;
    name: string;
}

export interface BeforeStartChatEvent extends CancellableSpaceUIEvent {
    spaceId: string;
    name?: string;
    kind: 'General' | 'Topic' | 'Private';
    participantUserIds?: string[];
}

export interface BeforeAddToChatEvent extends CancellableSpaceUIEvent {
    spaceId: string;
    chatId: string;
    userId: string;
    historyFrom?: Date | null;
}

export interface BeforePostMessageEvent extends CancellableSpaceUIEvent {
    spaceId: string;
    chatId: string;
    messageText: string;
}

export interface BeforeCloseSpaceEvent extends CancellableSpaceUIEvent {
    spaceId: string;
    reason?: string;
}

export interface AfterSpaceOpenedEvent {
    spaceId: string;
    spaceTypeCode: string;
}

// ============================================================================
// BaseSpaceTypeUIDriver
// ============================================================================

/**
 * Base UI driver for space types.
 * Downstream apps can subclass this and register it using the UIDriverClass name
 * specified in SpaceType.
 */
export class BaseSpaceTypeUIDriver {
    public GetTabs(ctx: SpaceUIContext, defaultTabs: SpaceTabDescriptor[]): SpaceTabDescriptor[] {
        return defaultTabs;
    }

    public GetOverviewCards(ctx: SpaceUIContext, defaultCards: SpaceOverviewCardDescriptor[]): SpaceOverviewCardDescriptor[] {
        return defaultCards;
    }

    public GetHeaderChips(ctx: SpaceUIContext, defaultChips: SpaceHeaderChipDescriptor[]): SpaceHeaderChipDescriptor[] {
        return defaultChips;
    }

    public GetHeaderActions(ctx: SpaceUIContext, defaultActions: SpaceHeaderActionDescriptor[]): SpaceHeaderActionDescriptor[] {
        return defaultActions;
    }

    public GetSettingsSections(ctx: SpaceUIContext, defaultSections: SpaceSettingsSectionDescriptor[]): SpaceSettingsSectionDescriptor[] {
        return defaultSections;
    }

    public GetNewSpaceSteps(ctx: SpaceUIContext, defaultSteps: SpaceNewStepDescriptor[]): SpaceNewStepDescriptor[] {
        return defaultSteps;
    }

    public GetDetailsForm(ctx: SpaceUIContext, defaultForm?: SpaceDetailsFormDescriptor): SpaceDetailsFormDescriptor | undefined {
        return defaultForm;
    }

    public BeforeInvite(event: BeforeInviteEvent): void {}
    public BeforeCreateChildSpace(event: BeforeCreateChildSpaceEvent): void {}
    public BeforeStartChat(event: BeforeStartChatEvent): void {}
    public BeforeAddToChat(event: BeforeAddToChatEvent): void {}
    public BeforePostMessage(event: BeforePostMessageEvent): void {}
    public BeforeCloseSpace(event: BeforeCloseSpaceEvent): void {}
    public AfterSpaceOpened(event: AfterSpaceOpenedEvent): void {}

    public GetVocabulary(ctx: SpaceUIContext, defaultVocabulary?: string): string {
        return defaultVocabulary ?? ctx.type?.Vocabulary ?? 'Space';
    }

    public GetTabLabel(ctx: SpaceUIContext, tabKey: string, defaultLabel: string): string {
        const labels = ctx.rules?.Labels?.Tabs;
        const wanted = normalizeContributionKey(tabKey);
        const match = labels ? Object.keys(labels).find((key) => normalizeContributionKey(key) === wanted) : undefined;
        return match && labels?.[match] ? labels[match] : defaultLabel;
    }
}

/** Keys are compared without case or padding, everywhere: the section, the deep links, the drivers and Labels.Tabs. */
export function normalizeContributionKey(key: string): string {
    return key.trim().toLowerCase();
}

/**
 * The type's own driver has the final say over the parts it is handed: what it names replaces the part with the same key, and the
 * rest (the built-in parts and what other apps contributed) stays. Sorted by `sortKey`.
 */
export function overlayDescriptors<TDescriptor extends { key: string; sortKey?: number }>(
    defaults: readonly TDescriptor[],
    own: readonly TDescriptor[],
): TDescriptor[] {
    const merged = new Map<string, TDescriptor>();
    for (const item of defaults) merged.set(normalizeContributionKey(item.key), item);
    for (const item of own) merged.set(normalizeContributionKey(item.key), item);
    return [...merged.values()].sort((a, b) => (a.sortKey ?? 100) - (b.sortKey ?? 100));
}

// ============================================================================
// Contribution Metadata & Assembler
// ============================================================================

export interface SpaceContributionMetadata {
    spaceTypes: string[];
    slot?: string;
    sortKey?: number;
    contributionKey: string;
    label?: string;
    icon?: string;
    title?: string;
}

export function assembleSpaceContributions<TDescriptor extends { key: string; sortKey?: number }>(
    baseClass: object,
    spaceTypeCode: string,
    defaultItems: TDescriptor[],
    descriptorFactory: (reg: ClassRegistration, metadata: SpaceContributionMetadata) => TDescriptor
): TDescriptor[] {
    const factory = MJGlobal.Instance.ClassFactory;
    const normalizedCode = spaceTypeCode.toLowerCase().trim();

    const registrations = factory.GetAllRegistrationsByMetadata(baseClass, (meta) => {
        if (!meta) return false;
        const m = meta as Record<string, string | number | boolean | string[] | undefined>;
        const contributionKey = typeof m['contributionKey'] === 'string' ? m['contributionKey'] : '';
        const spaceTypes = Array.isArray(m['spaceTypes']) ? (m['spaceTypes'] as string[]) : [];
        if (!contributionKey || spaceTypes.length === 0) return false;
        return spaceTypes.some((t) => t === '*' || t.toLowerCase().trim() === normalizedCode);
    });

    // Deduplicate on contributionKey (compared without case): highest Priority wins (if tied, latest)
    const map = new Map<string, { reg: ClassRegistration; meta: SpaceContributionMetadata }>();
    for (const reg of registrations) {
        const raw = reg.Metadata as Record<string, string | number | boolean | string[] | undefined>;
        const meta: SpaceContributionMetadata = {
            contributionKey: String(raw['contributionKey']),
            spaceTypes: Array.isArray(raw['spaceTypes']) ? (raw['spaceTypes'] as string[]) : [],
            slot: typeof raw['slot'] === 'string' ? raw['slot'] : undefined,
            sortKey: typeof raw['sortKey'] === 'number' ? raw['sortKey'] : undefined,
            label: typeof raw['label'] === 'string' ? raw['label'] : undefined,
            icon: typeof raw['icon'] === 'string' ? raw['icon'] : undefined,
            title: typeof raw['title'] === 'string' ? raw['title'] : undefined,
        };
        const key = normalizeContributionKey(meta.contributionKey);
        const existing = map.get(key);
        if (!existing || reg.Priority > existing.reg.Priority) {
            map.set(key, { reg, meta });
        }
    }

    const contributedItems: TDescriptor[] = [];
    for (const { reg, meta } of map.values()) {
        const desc = descriptorFactory(reg, meta);
        contributedItems.push(desc);
    }

    // Contributions only add. One whose key clashes with a built-in part is refused and logged: any installed app could otherwise
    // remove the chat from every space. Only the type's own UI driver may replace a built-in part (see overlayDescriptors).
    const mergedMap = new Map<string, TDescriptor>();
    for (const def of defaultItems) {
        mergedMap.set(normalizeContributionKey(def.key), def);
    }
    for (const contrib of contributedItems) {
        const key = normalizeContributionKey(contrib.key);
        if (mergedMap.has(key)) {
            console.warn(`[assembleSpaceContributions] A contribution keyed '${contrib.key}' clashes with an existing part in '${spaceTypeCode}' spaces and was refused. Contributions add parts; they do not replace them.`);
            continue;
        }
        mergedMap.set(key, contrib);
    }

    const result = Array.from(mergedMap.values());
    result.sort((a, b) => (a.sortKey ?? 100) - (b.sortKey ?? 100));
    return result;
}

// ============================================================================
// UIDriverRegistry
// ============================================================================

export class UIDriverRegistry extends BaseSingleton<UIDriverRegistry> {
    private _instances = new Map<string, BaseSpaceTypeUIDriver>();
    private _loggedMissing = new Set<string>();

    protected constructor() {
        super();
    }

    public static get Instance(): UIDriverRegistry {
        return super.getInstance<UIDriverRegistry>();
    }

    public ResolveDriver(driverClassName?: string | null): BaseSpaceTypeUIDriver {
        if (!driverClassName || driverClassName.trim() === '') {
            return this.GetDefaultDriver();
        }

        const normalized = driverClassName.trim();
        const cached = this._instances.get(normalized);
        if (cached) {
            return cached;
        }

        const res = MJGlobal.Instance.ClassFactory.TryCreateInstance<BaseSpaceTypeUIDriver>(BaseSpaceTypeUIDriver, normalized);
        if (res.Resolved && res.Instance) {
            this._instances.set(normalized, res.Instance);
            return res.Instance;
        }

        if (!this._loggedMissing.has(normalized)) {
            this._loggedMissing.add(normalized);
            console.warn(`[UIDriverRegistry] UI driver '${normalized}' not registered. Falling back to BaseSpaceTypeUIDriver.`);
        }

        return this.GetDefaultDriver();
    }

    public GetDefaultDriver(): BaseSpaceTypeUIDriver {
        const key = '__default__';
        let def = this._instances.get(key);
        if (!def) {
            def = new BaseSpaceTypeUIDriver();
            this._instances.set(key, def);
        }
        return def;
    }

    public ClearCache(): void {
        this._instances.clear();
        this._loggedMissing.clear();
    }
}
