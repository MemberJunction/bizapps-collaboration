import { ChangeDetectionStrategy, Component, Directive, Input, type TemplateRef, type Type, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { MJGlobal, RegisterClassEx } from '@memberjunction/global';
import { normalizeContributionKey } from '@mj-biz-apps/collaboration-core';
import { BaseSpaceOverviewCard } from './base-space-overview-card';
import type { SpaceOverviewCardDescriptor } from './base-space-type-ui-driver';
import { CollabPinnedStripComponent } from './pinned-strip.component';
import { CollabSpaceOverviewComponent, type RoomMiniMessage, type SubSpaceSummary } from './space-overview.component';
import type { ItemCardModel, ItemRowModel, NeedsYouItemModel, PinModel, SpaceBand } from './types';

export interface SpacePageBlockConfig {
    id: string;
    type: string;
    title: string;
    width?: 'full' | 'half' | 'main' | 'side';
    [key: string]: unknown;
}

export interface SpacePageBlockContext {
    spaceId?: string;
    spaceName?: string;
    spaceTypeCode?: string;
    firmName?: string;
    clientOrgName?: string;
    canSeeTeam?: boolean;
    canSeeTeamSide?: boolean;
    canWrite?: boolean;
    isReadOnly?: boolean;
    sharedLabel?: string;
    teamLabel?: string;
    showLibraryLink?: boolean;
    showChatLink?: boolean;
    showAskBox?: boolean;
    showDiscussionSnippet?: boolean;
    canSeeSubSpaces?: boolean;
    canStartConversation?: boolean;
    agentAvailable?: boolean;
    isSubmittingAsk?: boolean;
    askSuggestions?: string[];
    sharedAudienceCount?: number;
    discussionAudienceCount?: number;
    discussionBand?: SpaceBand;
    pins?: PinModel[];
    pinnedItems?: PinModel[];
    pinnedLabel?: string;
    pinnedTitle?: string;
    needsYouItems?: NeedsYouItemModel[];
    sharedItems?: ItemCardModel[];
    teamItems?: ItemRowModel[];
    teamTotalCount?: number;
    roomMessages?: RoomMiniMessage[];
    subSpaces?: SubSpaceSummary[];
    canAddSubSpace?: boolean;
    hasAbout?: boolean;
    aboutTitle?: string;
    contributedCards?: readonly SpaceOverviewCardDescriptor[];
    aboutTemplate?: TemplateRef<unknown> | null;
    mainViewTemplate?: TemplateRef<unknown> | null;
    onPinOpen?: (pin: PinModel) => void;
    onUnpin?: (pin: PinModel) => void;
    onPinUnpin?: (pin: PinModel) => void;
    onItemSelected?: (item: any) => void;
    onShareRequested?: (item: any) => void;
    onOpenLibraryRequested?: () => void;
    onAskRequested?: (question: string) => void;
    onOpenChatRequested?: () => void;
    onSubSpaceSelected?: (subSpace: any) => void;
    onNewSubSpaceRequested?: () => void;
    registerAskBoxClearer?: (clearFn: () => void) => void;
}

export interface SpacePageBlockMetadata {
    slot?: string;
    contributionKey?: string;
    legacyType?: string;
    title?: string;
    label?: string;
    icon?: string;
    description?: string;
    emptyText?: string;
    side?: 'Shared' | 'Team';
    defaultZone?: 'full' | 'main' | 'side';
    defaultWidth?: 'full' | 'main' | 'side';
    sortKey?: number;
    spaceTypes?: string[];
}

export interface SpacePageBlockDescriptor {
    key: string;
    legacyType?: string;
    title: string;
    label: string;
    icon: string;
    description: string;
    emptyText: string;
    side: 'Shared' | 'Team';
    defaultZone: 'full' | 'main' | 'side';
    defaultWidth: 'full' | 'main' | 'side';
    sortKey: number;
    spaceTypes: string[];
    kind: 'page-block' | 'card';
    component: Type<unknown>;
    isActive?: (ctx: SpacePageBlockContext | null) => boolean;
}

/**
 * Base class for live page blocks registered with `@RegisterClassEx(BaseSpacePageBlock, ...)`.
 */
@Directive()
export abstract class BaseSpacePageBlock extends BaseAngularComponent {
    @Input() public SpaceId = '';
    @Input() public Config: SpacePageBlockConfig | null = null;
    @Input() public ReadOnly = false;
    @Input() public Context: SpacePageBlockContext | null = null;
}

// ============================================================================
// Built-in Registered Space Page Blocks
// ============================================================================

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:pinned',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:pinned',
        legacyType: 'Widget:Pinned',
        label: 'Pinned items',
        icon: 'fa-solid fa-thumbtack',
        description: 'Quick access to items pinned in this space',
        emptyText: 'Pinned items show here when there are any.',
        side: 'Shared',
        defaultWidth: 'full',
        sortKey: 10,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-pinned',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabPinnedStripComponent],
    template: `
        @if (resolvedPins.length > 0) {
            <mjc-pinned-strip
                [Pins]="resolvedPins"
                [Title]="Config?.title || Context?.pinnedTitle || Context?.pinnedLabel || 'Pinned'"
                (OpenRequested)="Context?.onPinOpen?.($event)"
                (UnpinRequested)="onUnpin($event)"
            />
        }
    `,
})
export class CollabPinnedPageBlockComponent extends BaseSpacePageBlock {
    public get resolvedPins(): PinModel[] {
        return this.Context?.pinnedItems ?? this.Context?.pins ?? [];
    }

    public onUnpin(pin: PinModel): void {
        if (this.Context?.onPinUnpin) {
            this.Context.onPinUnpin(pin);
        } else {
            this.Context?.onUnpin?.(pin);
        }
    }

    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ((ctx?.pinnedItems ?? ctx?.pins)?.length ?? 0) > 0;
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:needs-you',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:needs-you',
        legacyType: 'Widget:NeedsYou',
        label: 'Needs your attention',
        icon: 'fa-solid fa-bell',
        description: 'Approvals, reviews, or tasks waiting on you',
        emptyText: 'Items needing your attention show here when there are any.',
        side: 'Shared',
        defaultWidth: 'main',
        sortKey: 20,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-needs-you',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabSpaceOverviewComponent],
    template: `
        <mjc-space-overview
            [Section]="'NeedsYou'"
            [CustomTitle]="Config?.title || ''"
            [SpaceId]="SpaceId"
            [NeedsYouItems]="Context?.needsYouItems || []"
            (ItemSelectRequested)="Context?.onItemSelected?.($event)"
        />
    `,
})
export class CollabNeedsYouPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return (ctx?.needsYouItems?.length ?? 0) > 0;
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:shared-files',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:shared-files',
        legacyType: 'Widget:SharedFiles',
        label: 'Shared files',
        icon: 'fa-solid fa-eye',
        description: 'Deliverables and files shared with everyone in this space',
        emptyText: 'Shared files show here when there are any.',
        side: 'Shared',
        defaultWidth: 'main',
        sortKey: 30,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-shared-files',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabSpaceOverviewComponent],
    template: `
        <mjc-space-overview
            [Section]="'SharedFiles'"
            [CustomTitle]="Config?.title || ''"
            [SpaceId]="SpaceId"
            [ShowLibraryLink]="Context?.showLibraryLink ?? true"
            [SpaceName]="Context?.spaceName || ''"
            [FirmName]="Context?.firmName || ''"
            [ClientOrgName]="Context?.clientOrgName || ''"
            [SharedAudienceCount]="Context?.sharedAudienceCount ?? 0"
            [SharedItems]="Context?.sharedItems || []"
            (OpenLibraryRequested)="Context?.onOpenLibraryRequested?.()"
            (ItemSelectRequested)="Context?.onItemSelected?.($event)"
        />
    `,
})
export class CollabSharedFilesPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean(ctx.showLibraryLink ?? true) : true;
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:team-files',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:team-files',
        legacyType: 'Widget:TeamFiles',
        label: 'Team working files',
        icon: 'fa-solid fa-lock',
        description: 'Internal team-only files and working papers',
        emptyText: 'Team working files show here when there are any.',
        side: 'Team',
        defaultWidth: 'main',
        sortKey: 40,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-team-files',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabSpaceOverviewComponent],
    template: `
        <mjc-space-overview
            [Section]="'TeamFiles'"
            [CustomTitle]="Config?.title || ''"
            [SpaceId]="SpaceId"
            [ShowLibraryLink]="Context?.showLibraryLink ?? true"
            [FirmName]="Context?.firmName || ''"
            [ClientOrgName]="Context?.clientOrgName || ''"
            [TeamItems]="Context?.teamItems || []"
            [TeamTotalCount]="Context?.teamTotalCount ?? 0"
            [CanSeeTeamSide]="Context?.canSeeTeam ?? Context?.canSeeTeamSide ?? true"
            (OpenLibraryRequested)="Context?.onOpenLibraryRequested?.()"
            (ItemSelectRequested)="Context?.onItemSelected?.($event)"
            (ShareRequested)="Context?.onShareRequested?.($event)"
        />
    `,
})
export class CollabTeamFilesPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean((ctx.canSeeTeam ?? ctx.canSeeTeamSide) && (ctx.showLibraryLink ?? true)) : true;
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:ask',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:ask',
        legacyType: 'Widget:AskBox',
        label: 'Ask about this space',
        icon: 'fa-solid fa-wand-magic-sparkles',
        description: 'Ask questions about this space',
        emptyText: 'The ask box shows here when chat is available.',
        side: 'Shared',
        defaultWidth: 'side',
        sortKey: 50,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-ask',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabSpaceOverviewComponent],
    template: `
        <mjc-space-overview
            #overviewRef
            [Section]="'AskBox'"
            [CustomTitle]="Config?.title || ''"
            [SpaceId]="SpaceId"
            [SpaceName]="Context?.spaceName || ''"
            [CanStartConversation]="(Context?.canStartConversation ?? false) && !ReadOnly"
            [AgentAvailable]="Context?.agentAvailable ?? false"
            [IsSubmittingAsk]="Context?.isSubmittingAsk ?? false"
            (AskRequested)="onAsk($event)"
        />
    `,
})
export class CollabAskPageBlockComponent extends BaseSpacePageBlock {
    @ViewChild('overviewRef') private overviewRef?: CollabSpaceOverviewComponent;

    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean(ctx.canStartConversation) : true;
    }

    public onAsk(question: string): void {
        this.Context?.registerAskBoxClearer?.(() => this.overviewRef?.clearAskBox());
        this.Context?.onAskRequested?.(question);
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:discussion',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:discussion',
        legacyType: 'Widget:Discussion',
        label: 'Recent discussion',
        icon: 'fa-solid fa-comments',
        description: 'Recent messages in this space',
        emptyText: 'Recent discussion shows here when there are messages.',
        side: 'Shared',
        defaultWidth: 'side',
        sortKey: 60,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-discussion',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabSpaceOverviewComponent],
    template: `
        <mjc-space-overview
            [Section]="'Discussion'"
            [CustomTitle]="Config?.title || ''"
            [SpaceId]="SpaceId"
            [ShowChatLink]="Context?.showChatLink ?? true"
            [CanStartConversation]="(Context?.canStartConversation ?? false) && !ReadOnly"
            [AudienceCount]="Context?.discussionAudienceCount ?? 0"
            [RoomMessages]="Context?.roomMessages || []"
            [DiscussionBand]="Context?.discussionBand || 'Shared'"
            (OpenChatRequested)="Context?.onOpenChatRequested?.()"
        />
    `,
})
export class CollabDiscussionPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean(ctx.showChatLink) : true;
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:sub-spaces',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:sub-spaces',
        legacyType: 'Widget:SubSpaces',
        label: 'Sub-spaces',
        icon: 'fa-solid fa-sitemap',
        description: 'Sub-spaces inside this space',
        emptyText: 'Sub-spaces show here when there are any.',
        side: 'Shared',
        defaultWidth: 'side',
        sortKey: 70,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-sub-spaces',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabSpaceOverviewComponent],
    template: `
        <mjc-space-overview
            [Section]="'SubSpaces'"
            [CustomTitle]="Config?.title || ''"
            [SpaceId]="SpaceId"
            [SpaceName]="Context?.spaceName || ''"
            [SubSpaces]="Context?.subSpaces || []"
            [CanAddSubSpace]="(Context?.canAddSubSpace ?? false) && !ReadOnly"
            (SubSpaceSelectRequested)="Context?.onSubSpaceSelected?.($event.id)"
            (NewSubSpaceRequested)="Context?.onNewSubSpaceRequested?.()"
        />
    `,
})
export class CollabSubSpacesPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean((ctx.subSpaces?.length ?? 0) > 0 || ctx.canAddSubSpace) : true;
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:about',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:about',
        legacyType: 'Widget:About',
        label: 'About this space',
        icon: 'fa-solid fa-circle-info',
        description: 'Key details for this space',
        emptyText: 'About details show here when there are any.',
        side: 'Shared',
        defaultWidth: 'side',
        sortKey: 80,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-about',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabSpaceOverviewComponent],
    template: `
        <mjc-space-overview
            [Section]="'About'"
            [CustomTitle]="Config?.title || ''"
            [SpaceId]="SpaceId"
            [HasAbout]="Context?.hasAbout ?? false"
            [AboutTitle]="Context?.aboutTitle || 'About'"
        >
            <div mjcAbout style="display: contents">
                @if (Context?.aboutTemplate; as tpl) {
                    <ng-container *ngTemplateOutlet="tpl"></ng-container>
                }
            </div>
        </mjc-space-overview>
    `,
})
export class CollabAboutPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean(ctx.hasAbout) : true;
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:main-view',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:main-view',
        legacyType: 'Widget:MainView',
        label: 'Page content',
        icon: 'fa-solid fa-window-maximize',
        description: 'Main content area for this page',
        emptyText: 'Page content shows here when available.',
        side: 'Shared',
        defaultWidth: 'full',
        sortKey: 90,
        spaceTypes: ['*'],
    },
})
@Component({
    selector: 'mjc-page-block-main-view',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule],
    template: `
        @if (Context?.mainViewTemplate; as tpl) {
            <ng-container *ngTemplateOutlet="tpl"></ng-container>
        }
    `,
})
export class CollabMainViewPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return Boolean(ctx?.mainViewTemplate);
    }
}

export const BUILT_IN_SPACE_PAGE_BLOCKS = [
    CollabPinnedPageBlockComponent,
    CollabNeedsYouPageBlockComponent,
    CollabSharedFilesPageBlockComponent,
    CollabTeamFilesPageBlockComponent,
    CollabAskPageBlockComponent,
    CollabDiscussionPageBlockComponent,
    CollabSubSpacesPageBlockComponent,
    CollabAboutPageBlockComponent,
    CollabMainViewPageBlockComponent,
] as const;

function matchesSpaceType(spaceTypes: readonly string[], spaceTypeCode: string): boolean {
    if (spaceTypes.length === 0) return true;
    const normalized = (spaceTypeCode || '*').toLowerCase().trim();
    return spaceTypes.some((t) => t === '*' || normalized === '*' || t.toLowerCase().trim() === normalized);
}

/**
 * Assembles all `BaseSpacePageBlock` and `BaseSpaceOverviewCard` registrations from the class factory
 * (plus any driver-supplied `SpaceOverviewCardDescriptor`s) that match `spaceTypeCode`.
 */
export function assembleSpacePageBlocks(
    spaceTypeCode: string,
    contributedCards: readonly SpaceOverviewCardDescriptor[] = [],
): SpacePageBlockDescriptor[] {
    // Reference BUILT_IN_SPACE_PAGE_BLOCKS so the bundler never tree-shakes built-in block registrations
    void BUILT_IN_SPACE_PAGE_BLOCKS;

    const factory = MJGlobal.Instance.ClassFactory;
    const byKey = new Map<string, { priority: number; desc: SpacePageBlockDescriptor }>();

    const pageBlockRegs = factory.GetAllRegistrationsByMetadata(BaseSpacePageBlock, (meta) => {
        if (!meta) return true;
        const m = meta as Record<string, unknown>;
        const spaceTypes = Array.isArray(m['spaceTypes']) ? (m['spaceTypes'] as string[]) : ['*'];
        return matchesSpaceType(spaceTypes, spaceTypeCode);
    });

    for (const reg of pageBlockRegs) {
        const raw = (reg.Metadata ?? {}) as Record<string, unknown>;
        const key =
            typeof raw['contributionKey'] === 'string' && raw['contributionKey'].trim()
                ? raw['contributionKey'].trim()
                : (reg.Key || '').trim();
        if (!key) continue;

        const label =
            typeof raw['label'] === 'string' && raw['label'].trim()
                ? raw['label'].trim()
                : typeof raw['title'] === 'string' && raw['title'].trim()
                  ? raw['title'].trim()
                  : key;
        const icon = typeof raw['icon'] === 'string' && raw['icon'].trim() ? raw['icon'].trim() : 'fa-solid fa-puzzle-piece';
        const description =
            typeof raw['description'] === 'string' && raw['description'].trim()
                ? raw['description'].trim()
                : typeof raw['hint'] === 'string' && raw['hint'].trim()
                  ? raw['hint'].trim()
                  : '';
        const emptyText =
            typeof raw['emptyText'] === 'string' && raw['emptyText'].trim()
                ? raw['emptyText'].trim()
                : `${label} items show here when there are any.`;
        const side: 'Shared' | 'Team' = raw['side'] === 'Team' ? 'Team' : 'Shared';
        const rawZone = raw['defaultZone'] ?? raw['defaultWidth'];
        const defaultWidth: 'full' | 'main' | 'side' =
            rawZone === 'full' || rawZone === 'main' || rawZone === 'side'
                ? rawZone
                : 'side';
        const sortKey = typeof raw['sortKey'] === 'number' ? raw['sortKey'] : 100;
        const spaceTypes = Array.isArray(raw['spaceTypes']) ? (raw['spaceTypes'] as string[]) : ['*'];
        const legacyType = typeof raw['legacyType'] === 'string' ? raw['legacyType'] : undefined;
        const subClass = reg.SubClass as Type<unknown> & { isActive?: (ctx: SpacePageBlockContext | null) => boolean };

        const normalized = normalizeContributionKey(key);
        const existing = byKey.get(normalized);
        if (!existing || reg.Priority > existing.priority) {
            byKey.set(normalized, {
                priority: reg.Priority,
                desc: {
                    key,
                    legacyType,
                    title: label,
                    label,
                    icon,
                    description,
                    emptyText,
                    side,
                    defaultZone: defaultWidth,
                    defaultWidth,
                    sortKey,
                    spaceTypes,
                    kind: 'page-block',
                    component: subClass,
                    isActive: typeof subClass.isActive === 'function' ? subClass.isActive : undefined,
                },
            });
        }
    }

    // Include driver-supplied and class-factory-registered BaseSpaceOverviewCard contributions
    for (const card of contributedCards) {
        if (!card.key || !card.component) continue;
        const normalized = normalizeContributionKey(card.key);
        if (byKey.has(normalized)) continue;
        const label = card.title || card.key;
        byKey.set(normalized, {
            priority: 0,
            desc: {
                key: card.key,
                title: label,
                label,
                icon: 'fa-solid fa-puzzle-piece',
                description: card.subtitle || `${label} card for this space`,
                emptyText: `${label} items show here when there are any.`,
                side: card.side === 'Shared' ? 'Shared' : 'Team',
                defaultZone: 'side',
                defaultWidth: 'side',
                sortKey: (card.sortKey ?? 100) + 100,
                spaceTypes: [spaceTypeCode || '*'],
                kind: 'card',
                component: card.component,
            },
        });
    }

    const cardRegs = factory.GetAllRegistrationsByMetadata(BaseSpaceOverviewCard, (meta) => {
        if (!meta) return false;
        const m = meta as Record<string, unknown>;
        const spaceTypes = Array.isArray(m['spaceTypes']) ? (m['spaceTypes'] as string[]) : [];
        if (spaceTypes.length === 0) return false;
        return matchesSpaceType(spaceTypes, spaceTypeCode);
    });

    for (const reg of cardRegs) {
        const raw = (reg.Metadata ?? {}) as Record<string, unknown>;
        const key =
            typeof raw['contributionKey'] === 'string' && raw['contributionKey'].trim()
                ? raw['contributionKey'].trim()
                : (reg.Key || '').trim();
        if (!key) continue;
        const normalized = normalizeContributionKey(key);
        if (byKey.has(normalized)) continue;
        const label =
            typeof raw['title'] === 'string' && raw['title'].trim()
                ? raw['title'].trim()
                : typeof raw['label'] === 'string' && raw['label'].trim()
                  ? raw['label'].trim()
                  : key;
        const side: 'Shared' | 'Team' = raw['side'] === 'Shared' ? 'Shared' : 'Team';
        const sortKey = (typeof raw['sortKey'] === 'number' ? raw['sortKey'] : 100) + 100;
        const spaceTypes = Array.isArray(raw['spaceTypes']) ? (raw['spaceTypes'] as string[]) : ['*'];
        byKey.set(normalized, {
            priority: reg.Priority,
            desc: {
                key,
                legacyType: reg.Key && reg.Key !== key ? reg.Key : undefined,
                title: label,
                label,
                icon: typeof raw['icon'] === 'string' && raw['icon'].trim() ? raw['icon'].trim() : 'fa-solid fa-puzzle-piece',
                description:
                    typeof raw['description'] === 'string' && raw['description'].trim()
                        ? raw['description'].trim()
                        : `${label} card for this space`,
                emptyText: `${label} items show here when there are any.`,
                side,
                defaultZone: 'side',
                defaultWidth: 'side',
                sortKey,
                spaceTypes,
                kind: 'card',
                component: reg.SubClass as Type<unknown>,
            },
        });
    }

    return [...byKey.values()].map((v) => v.desc).sort((a, b) => a.sortKey - b.sortKey);
}
