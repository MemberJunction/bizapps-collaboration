import { ChangeDetectionStrategy, Component, Directive, Input, type TemplateRef, type Type, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import { type ClassRegistration, MJGlobal, RegisterClassEx } from '@memberjunction/global';
import { normalizeContributionKey } from '@mj-biz-apps/collaboration-core';
import {
    assembleSpaceContributions,
    type SpaceContributionMetadata,
    type SpaceOverviewCardDescriptor,
} from './base-space-type-ui-driver';
import { CollabPinnedStripComponent } from './pinned-strip.component';
import { CollabSpaceOverviewComponent, type RoomMiniMessage, type SubSpaceSummary } from './space-overview.component';
import { CollabSpaceWorkComponent } from './space-work.component';
import type { ItemCardModel, ItemRowModel, NeedsYouItemModel, PinModel, SpaceBand, TaskItemModel } from './types';

export interface SpacePageBlockConfig {
    id: string;
    type: string;
    title: string;
    width?: 'full' | 'half' | 'main' | 'side';
    [key: string]: unknown;
}

export interface SpacePageBlockEmptyAction {
    label: string;
    run: () => void;
}

export interface SpacePageBlockContext {
    spaceId?: string;
    spaceName?: string;
    spaceTypeCode?: string;
    firmName?: string;
    clientOrgName?: string;
    canSeeTeam?: boolean;
    canWrite?: boolean;
    canAddHere?: boolean;
    isReadOnly?: boolean;
    sharedLabel?: string;
    teamLabel?: string;
    showLibraryLink?: boolean;
    showChatLink?: boolean;
    showWorkLink?: boolean;
    canStartConversation?: boolean;
    agentAvailable?: boolean;
    isSubmittingAsk?: boolean;
    askSuggestions?: string[];
    sharedAudienceCount?: number;
    discussionAudienceCount?: number;
    discussionBand?: SpaceBand;
    pins?: PinModel[];
    pinnedTitle?: string;
    needsYouItems?: NeedsYouItemModel[];
    sharedItems?: ItemCardModel[];
    teamItems?: ItemRowModel[];
    teamTotalCount?: number;
    tasks?: TaskItemModel[];
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
    onNeedsYouAction?: (item: NeedsYouItemModel) => void;
    onItemSelected?: (item: ItemCardModel | ItemRowModel) => void;
    onShareRequested?: (item: ItemRowModel) => void;
    onOpenLibraryRequested?: () => void;
    onUploadFileRequested?: () => void;
    onTaskSelected?: (task: TaskItemModel) => void;
    onTaskToggled?: (task: TaskItemModel) => void;
    onOpenWorkRequested?: () => void;
    onAskRequested?: (question: string) => void;
    onOpenChatRequested?: () => void;
    onSubSpaceSelected?: (subSpace: SubSpaceSummary) => void;
    onNewSubSpaceRequested?: () => void;
    registerAskBoxClearer?: (clearFn: () => void) => void;
}

export interface SpacePageBlockMetadata extends SpaceContributionMetadata {
    slot?: 'page-block';
    contributionKey: string;
    label: string;
    icon: string;
    description: string;
    emptyText?: string;
    side?: 'Shared' | 'Team';
    defaultZone?: 'full' | 'main' | 'side';
    defaultTabs?: readonly string[];
    sortKey?: number;
    spaceTypes: string[];
}

export interface SpacePageBlockDescriptor {
    key: string;
    label: string;
    icon: string;
    description: string;
    emptyText: string;
    side: 'Shared' | 'Team';
    defaultZone: 'full' | 'main' | 'side';
    defaultTabs: readonly string[];
    sortKey: number;
    spaceTypes: string[];
    kind: 'page-block' | 'card';
    component: Type<unknown>;
    canView?: (ctx: SpacePageBlockContext | null) => boolean;
    isActive?: (ctx: SpacePageBlockContext | null) => boolean;
    emptyAction?: (ctx: SpacePageBlockContext | null) => SpacePageBlockEmptyAction | null;
}

/**
 * Base class for live page blocks registered with `@RegisterClassEx(BaseSpacePageBlock, ...)`.
 *
 * Blocks are mounted dynamically with `NgComponentOutlet`, which binds `@Input()` properties (`SpaceId`, `Config`,
 * `ReadOnly`, `Context`) but cannot bind `@Output()` event emitters. User action callbacks are therefore carried on
 * `SpacePageBlockContext`.
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
        label: 'Pinned items',
        icon: 'fa-solid fa-thumbtack',
        description: 'Quick access to items pinned in this space',
        emptyText: 'Pinned items show here when there are any.',
        side: 'Shared',
        defaultZone: 'full',
        defaultTabs: ['Overview'],
        sortKey: 10,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
})
@Component({
    selector: 'mjc-page-block-pinned',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabPinnedStripComponent],
    template: `
        @if ((Context?.pins?.length ?? 0) > 0) {
            <mjc-pinned-strip
                [Pins]="Context?.pins || []"
                [Title]="Config?.title || Context?.pinnedTitle || 'Pinned'"
                (OpenRequested)="Context?.onPinOpen?.($event)"
                (UnpinRequested)="Context?.onUnpin?.($event)"
            />
        }
    `,
})
export class CollabPinnedPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return (ctx?.pins?.length ?? 0) > 0;
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:needs-you',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:needs-you',
        label: 'Needs your attention',
        icon: 'fa-solid fa-bell',
        description: 'Approvals, reviews, or tasks waiting on you',
        emptyText: 'Items needing your attention show here when there are any.',
        side: 'Shared',
        defaultZone: 'main',
        defaultTabs: ['Overview'],
        sortKey: 20,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
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
            (NeedsYouActionRequested)="Context?.onNeedsYouAction?.($event)"
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
        label: 'Shared files',
        icon: 'fa-solid fa-eye',
        description: 'Deliverables and files shared with everyone in this space',
        emptyText: 'Shared files show here when there are any.',
        side: 'Shared',
        defaultZone: 'main',
        defaultTabs: ['Overview'],
        sortKey: 30,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
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
        return ctx ? (ctx.sharedItems?.length ?? 0) > 0 : true;
    }

    public static emptyAction(ctx: SpacePageBlockContext | null): SpacePageBlockEmptyAction | null {
        if (!ctx?.canAddHere || ctx.isReadOnly) return null;
        const fn = ctx.onUploadFileRequested ?? (ctx.showLibraryLink ? ctx.onOpenLibraryRequested : undefined);
        if (!fn) return null;
        return { label: 'Upload a file', run: () => fn() };
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:team-files',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:team-files',
        label: 'Team working files',
        icon: 'fa-solid fa-lock',
        description: 'Internal team-only files and working papers',
        emptyText: 'Team working files show here when there are any.',
        side: 'Team',
        defaultZone: 'main',
        defaultTabs: ['Overview'],
        sortKey: 40,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
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
            [CanSeeTeamSide]="Context?.canSeeTeam ?? true"
            (OpenLibraryRequested)="Context?.onOpenLibraryRequested?.()"
            (ItemSelectRequested)="Context?.onItemSelected?.($event)"
            (ShareRequested)="Context?.onShareRequested?.($event)"
        />
    `,
})
export class CollabTeamFilesPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean(ctx.canSeeTeam && (ctx.teamItems?.length ?? 0) > 0) : true;
    }

    public static emptyAction(ctx: SpacePageBlockContext | null): SpacePageBlockEmptyAction | null {
        if (!ctx?.canSeeTeam || !ctx.canAddHere || ctx.isReadOnly) return null;
        const fn = ctx.onUploadFileRequested ?? (ctx.showLibraryLink ? ctx.onOpenLibraryRequested : undefined);
        if (!fn) return null;
        return { label: 'Upload a file', run: () => fn() };
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:open-tasks',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:open-tasks',
        label: 'Open tasks',
        icon: 'fa-solid fa-list-check',
        description: 'Open tasks in this space',
        emptyText: 'No open tasks',
        side: 'Shared',
        defaultZone: 'main',
        defaultTabs: ['Overview'],
        sortKey: 45,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
})
@Component({
    selector: 'mjc-page-block-open-tasks',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, CollabSpaceWorkComponent],
    template: `
        <mjc-space-work
            [Compact]="true"
            [CustomTitle]="Config?.title || 'Open tasks'"
            [Tasks]="Context?.tasks || []"
            [CanSeeTeamSide]="Context?.canSeeTeam ?? true"
            [CanCreateTask]="(Context?.canAddHere ?? false) && !ReadOnly"
            [ReadOnly]="ReadOnly || (Context?.isReadOnly ?? false)"
            [ShowWorkLink]="Context?.showWorkLink ?? true"
            (TaskSelectRequested)="Context?.onTaskSelected?.($event)"
            (TaskToggleRequested)="Context?.onTaskToggled?.($event)"
            (OpenWorkRequested)="Context?.onOpenWorkRequested?.()"
        />
    `,
})
export class CollabOpenTasksPageBlockComponent extends BaseSpacePageBlock {
    public static canView(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean(ctx.showWorkLink ?? true) : true;
    }

    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        if (!ctx) return true;
        const canSeeTeam = ctx.canSeeTeam ?? true;
        return (ctx.tasks ?? []).some(
            (t) => t.status !== 'Completed' && t.status !== 'Cancelled' && (canSeeTeam || t.band === 'Shared'),
        );
    }

    public static emptyAction(ctx: SpacePageBlockContext | null): SpacePageBlockEmptyAction | null {
        if (!ctx?.showWorkLink || !ctx.onOpenWorkRequested) return null;
        return { label: 'Open Work', run: () => ctx.onOpenWorkRequested?.() };
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:ask',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:ask',
        label: 'Ask about this space',
        icon: 'fa-solid fa-wand-magic-sparkles',
        description: 'Ask questions about this space',
        emptyText: 'The ask box shows here when chat is available.',
        side: 'Shared',
        defaultZone: 'side',
        defaultTabs: ['Overview'],
        sortKey: 50,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
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

    public static canView(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean(ctx.canStartConversation && !ctx.isReadOnly && (ctx.showChatLink ?? true)) : true;
    }

    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean(ctx.canStartConversation && !ctx.isReadOnly && (ctx.showChatLink ?? true) && (ctx.agentAvailable ?? true)) : true;
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
        label: 'Recent discussion',
        icon: 'fa-solid fa-comments',
        description: 'Recent messages in this space',
        emptyText: 'Recent discussion shows here when there are messages.',
        side: 'Shared',
        defaultZone: 'side',
        defaultTabs: ['Overview'],
        sortKey: 60,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
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
        return ctx ? Boolean((ctx.showChatLink ?? true) && (ctx.roomMessages?.length ?? 0) > 0) : true;
    }

    public static emptyAction(ctx: SpacePageBlockContext | null): SpacePageBlockEmptyAction | null {
        if (!ctx?.showChatLink || !ctx.onOpenChatRequested) return null;
        return { label: 'Open chat', run: () => ctx.onOpenChatRequested?.() };
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:sub-spaces',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:sub-spaces',
        label: 'Sub-spaces',
        icon: 'fa-solid fa-sitemap',
        description: 'Sub-spaces inside this space',
        emptyText: 'Sub-spaces show here when there are any.',
        side: 'Shared',
        defaultZone: 'side',
        defaultTabs: [],
        sortKey: 70,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
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
            (SubSpaceSelectRequested)="Context?.onSubSpaceSelected?.($event)"
            (NewSubSpaceRequested)="Context?.onNewSubSpaceRequested?.()"
        />
    `,
})
export class CollabSubSpacesPageBlockComponent extends BaseSpacePageBlock {
    public static isActive(ctx: SpacePageBlockContext | null): boolean {
        return ctx ? Boolean((ctx.subSpaces?.length ?? 0) > 0) : true;
    }

    public static emptyAction(ctx: SpacePageBlockContext | null): SpacePageBlockEmptyAction | null {
        if (!ctx?.canAddSubSpace || ctx.isReadOnly || !ctx.onNewSubSpaceRequested) return null;
        return { label: '+ Sub-space', run: () => ctx.onNewSubSpaceRequested?.() };
    }
}

@RegisterClassEx(BaseSpacePageBlock, {
    key: 'collab:about',
    metadata: {
        slot: 'page-block',
        contributionKey: 'collab:about',
        label: 'About this space',
        icon: 'fa-solid fa-circle-info',
        description: 'Key details for this space',
        emptyText: 'About details show here when there are any.',
        side: 'Shared',
        defaultZone: 'side',
        defaultTabs: ['Overview'],
        sortKey: 80,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
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
        label: 'Page content',
        icon: 'fa-solid fa-window-maximize',
        description: 'Main content area for this page',
        emptyText: 'Page content shows here when available.',
        side: 'Shared',
        defaultZone: 'full',
        defaultTabs: ['Library', 'Data', 'Work', 'Notes', 'People'],
        sortKey: 90,
        spaceTypes: ['*'],
    } satisfies SpacePageBlockMetadata,
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
    CollabOpenTasksPageBlockComponent,
    CollabAskPageBlockComponent,
    CollabDiscussionPageBlockComponent,
    CollabSubSpacesPageBlockComponent,
    CollabAboutPageBlockComponent,
    CollabMainViewPageBlockComponent,
] as const;

function descriptorFromRegistration(reg: ClassRegistration): SpacePageBlockDescriptor {
    const meta = (reg.Metadata ?? {}) as Partial<SpacePageBlockMetadata>;
    const key = (meta.contributionKey ?? reg.Key ?? '').trim();
    const label = (meta.label ?? key).trim() || key;
    const icon = (meta.icon ?? '').trim() || 'fa-solid fa-puzzle-piece';
    const description = (meta.description ?? '').trim();
    const emptyText = (meta.emptyText ?? '').trim() || `${label} items show here when there are any.`;
    // A block that doesn't name its side is a Team block (EXTENSIBILITY_PLAN.md §6)
    const side: 'Shared' | 'Team' = meta.side === 'Shared' ? 'Shared' : 'Team';
    const defaultZone: 'full' | 'main' | 'side' =
        meta.defaultZone === 'full' || meta.defaultZone === 'main' || meta.defaultZone === 'side'
            ? meta.defaultZone
            : 'side';
    const defaultTabs: readonly string[] = Array.isArray(meta.defaultTabs) ? meta.defaultTabs : [];
    const sortKey = typeof meta.sortKey === 'number' ? meta.sortKey : 100;
    const spaceTypes = Array.isArray(meta.spaceTypes) ? meta.spaceTypes : ['*'];
    const subClass = reg.SubClass as Type<unknown> & {
        canView?: (ctx: SpacePageBlockContext | null) => boolean;
        isActive?: (ctx: SpacePageBlockContext | null) => boolean;
        emptyAction?: (ctx: SpacePageBlockContext | null) => SpacePageBlockEmptyAction | null;
    };

    return {
        key,
        label,
        icon,
        description,
        emptyText,
        side,
        defaultZone,
        defaultTabs,
        sortKey,
        spaceTypes,
        kind: 'page-block',
        component: subClass,
        canView: typeof subClass.canView === 'function' ? subClass.canView : undefined,
        isActive: typeof subClass.isActive === 'function' ? subClass.isActive : undefined,
        emptyAction: typeof subClass.emptyAction === 'function' ? subClass.emptyAction : undefined,
    };
}

function builtInBlockDescriptors(): SpacePageBlockDescriptor[] {
    const builtInSet = new Set<unknown>(BUILT_IN_SPACE_PAGE_BLOCKS);
    const allRegs = MJGlobal.Instance.ClassFactory.GetAllRegistrations(BaseSpacePageBlock);
    const builtIns: SpacePageBlockDescriptor[] = [];
    for (const reg of allRegs) {
        if (builtInSet.has(reg.SubClass)) {
            builtIns.push(descriptorFromRegistration(reg));
        }
    }
    return builtIns.sort((a, b) => a.sortKey - b.sortKey);
}

/**
 * Assembles the built-in `BaseSpacePageBlock` parts, any contributed `BaseSpacePageBlock` parts (via `assembleSpaceContributions`),
 * and the UI driver's final `contributedCards` for `spaceTypeCode`.
 */
export function assembleSpacePageBlocks(
    spaceTypeCode: string,
    contributedCards: readonly SpaceOverviewCardDescriptor[] = [],
): SpacePageBlockDescriptor[] {
    const code = (spaceTypeCode || '*').trim() || '*';
    const builtIns = builtInBlockDescriptors();
    const pageBlocks = assembleSpaceContributions(
        BaseSpacePageBlock,
        code,
        builtIns,
        (reg) => descriptorFromRegistration(reg),
    );

    const byKey = new Map<string, SpacePageBlockDescriptor>();
    for (const block of pageBlocks) {
        byKey.set(normalizeContributionKey(block.key), block);
    }

    // Use only the contributedCards passed in (already finalized by the space type's UI driver)
    for (const card of contributedCards) {
        if (!card.key || !card.component) continue;
        const normalized = normalizeContributionKey(card.key);
        if (byKey.has(normalized)) continue;
        const label = card.title || card.key;
        byKey.set(normalized, {
            key: card.key,
            label,
            icon: 'fa-solid fa-puzzle-piece',
            description: card.subtitle || `${label} card for this space`,
            emptyText: `${label} items show here when there are any.`,
            side: card.side === 'Shared' ? 'Shared' : 'Team',
            defaultZone: 'side',
            defaultTabs: ['Overview'],
            sortKey: (card.sortKey ?? 100) + 100,
            spaceTypes: [code],
            kind: 'card',
            component: card.component,
        });
    }

    return [...byKey.values()].sort((a, b) => a.sortKey - b.sortKey);
}

/**
 * Derives the default page blocks for a built-in tab (`'Overview'`, `'Library'`, `'Data'`, `'Work'`, `'Notes'`, `'People'`)
 * directly from the assembled block descriptors.
 */
export function defaultBlocksForBuiltInTab(
    builtInTabId: string,
    descriptors: readonly SpacePageBlockDescriptor[],
): { id: string; type: string; title: string; width: 'full' | 'main' | 'side' }[] {
    return descriptors
        .filter((d) => d.defaultTabs.includes(builtInTabId))
        .map((d) => ({
            id: `seed-blk-${builtInTabId.toLowerCase()}-${d.key}`,
            type: d.key,
            title: '',
            width: d.defaultZone,
        }));
}
