import { Component, EventEmitter, HostListener, Inject, Input, Optional, Output, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
    MJAlertComponent,
    MJButtonDirective,
    MJConfirmService,
    MJMenuComponent,
    MJMenuDividerComponent,
    MJMenuItemComponent,
    MJMenuTriggerDirective,
} from '@memberjunction/ng-ui-components';
import { normalizeContributionKey } from '@mj-biz-apps/collaboration-core';
import {
    assembleSpacePageBlocks,
    BUILT_IN_SPACE_PAGE_BLOCKS,
    type SpacePageBlockContext,
    type SpacePageBlockDescriptor,
} from './base-space-page-block';
import type { SpaceOverviewCardDescriptor } from './base-space-type-ui-driver';
import { CollabBandChipComponent } from './band-chip.component';
import { CollabFileIconComponent } from './file-icon.component';
import { COLLAB_TOKENS_CSS } from './tokens';
import { LibraryRowModel, SpaceBand, SpaceMemberModel } from './types';
import { DiffSegment, DiffWords, HasTextChange, SummarizeDiff } from './page-diff';

export type CollabContentBlockType =
    | 'Heading'
    | 'Text'
    | 'Callout'
    | 'Bullets'
    | 'Facts'
    | 'Contacts'
    | 'Resources'
    | 'Video'
    | 'Image'
    | 'Links'
    | 'Checklist'
    | 'FAQ'
    | 'Table'
    | 'Divider';

export type CollabPageBlockType = string;

export type CollabCalloutVariant = 'info' | 'success' | 'warning' | 'danger';
export type CollabBlockWidth = 'full' | 'half' | 'main' | 'side';

export interface CollabFactPair {
    label: string;
    value: string;
}

export interface CollabContactCard {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
}

export interface CollabLinkItem {
    label: string;
    url: string;
    description?: string;
}

export interface CollabChecklistItem {
    id: string;
    text: string;
    done: boolean;
}

export interface CollabFaqItem {
    q: string;
    a: string;
}

export interface CollabPageBlock {
    id: string;
    type: CollabPageBlockType;
    title: string;
    width?: CollabBlockWidth;
    subtitle?: string;
    body?: string;
    variant?: CollabCalloutVariant;
    items?: string[];
    pairs?: CollabFactPair[];
    people?: CollabContactCard[];
    resourceIds?: string[];
    url?: string;
    caption?: string;
    alt?: string;
    links?: CollabLinkItem[];
    checklist?: CollabChecklistItem[];
    faqs?: CollabFaqItem[];
    headers?: string[];
    rows?: string[][];
}

export interface CollabPageComment {
    id: string;
    authorName: string;
    authorInitials: string;
    band: SpaceBand;
    body: string;
    createdAtLabel: string;
    status: 'Open' | 'Resolved';
    parentId?: string | null;
}

export type CollabPageType = 'Overview' | 'Guide' | 'Onboarding' | 'Roadmap' | 'FAQ' | 'Custom';

export interface CollabPageModel {
    id: string;
    title: string;
    iconClass: string;
    pageType: CollabPageType;
    band: SpaceBand;
    status: 'Published' | 'Draft';
    sequence: number;
    collaborative: boolean;
    summary: string;
    body: string;
    draftTitle?: string | null;
    draftBody?: string | null;
    blocks: CollabPageBlock[];
    comments: CollabPageComment[];
    updatedLabel: string;
    authorName: string;
    canPromote?: boolean;
    isSeed?: boolean;
    /** If set, this page backs one of the space's built-in tabs ('Overview' | 'Library' | 'Work' | 'Notes' | 'Data' | 'People'). */
    builtInTabId?: string | null;
    /** True when the built-in page's base workspace widget blocks have been initialized in `blocks`. */
    widgetsInitialized?: boolean;
}

export interface CollabBlockOption {
    type: CollabPageBlockType;
    label: string;
    icon: string;
    hint: string;
}

export const COLLAB_BLOCK_OPTIONS: CollabBlockOption[] = [
    { type: 'Heading', label: 'Section heading', icon: 'fa-solid fa-heading', hint: 'Large title + subtitle to break up a page' },
    { type: 'Text', label: 'Paragraph', icon: 'fa-solid fa-paragraph', hint: 'Rich prose for intros, context, and notes' },
    { type: 'Callout', label: 'Callout banner', icon: 'fa-solid fa-bullhorn', hint: 'Highlighted info, success, warning, or alert box' },
    { type: 'Bullets', label: 'Bullet list', icon: 'fa-solid fa-list-ul', hint: 'Key takeaways, milestones, or agenda items' },
    { type: 'Checklist', label: 'Checklist', icon: 'fa-solid fa-list-check', hint: 'Interactive to-dos with a completion progress bar' },
    { type: 'Facts', label: 'Key facts', icon: 'fa-solid fa-table-list', hint: 'Two-column label/value grid for quick reference' },
    { type: 'Contacts', label: 'Key contacts', icon: 'fa-solid fa-address-card', hint: 'Team cards with role, email, and phone' },
    { type: 'Resources', label: 'Space files', icon: 'fa-solid fa-paperclip', hint: 'Curated documents and files from this space library' },
    { type: 'Links', label: 'Action links', icon: 'fa-solid fa-arrow-up-right-from-square', hint: 'Buttons out to external tools, forms, or decks' },
    { type: 'Video', label: 'Video embed', icon: 'fa-solid fa-circle-play', hint: 'YouTube, Vimeo, or direct video player' },
    { type: 'Image', label: 'Image', icon: 'fa-solid fa-image', hint: 'Diagram, screenshot, or banner with caption' },
    { type: 'FAQ', label: 'FAQ accordion', icon: 'fa-solid fa-circle-question', hint: 'Expandable question & answer pairs' },
    { type: 'Table', label: 'Table', icon: 'fa-solid fa-table', hint: 'Structured rows & columns for schedules or matrices' },
    { type: 'Divider', label: 'Divider', icon: 'fa-solid fa-minus', hint: 'Subtle horizontal rule between sections' },
];

export const COLLAB_PAGE_ICONS: { icon: string; label: string }[] = [
    { icon: 'fa-solid fa-compass', label: 'Compass' },
    { icon: 'fa-solid fa-book-open', label: 'Guide' },
    { icon: 'fa-solid fa-rocket', label: 'Launch' },
    { icon: 'fa-solid fa-list-check', label: 'Checklist' },
    { icon: 'fa-solid fa-map', label: 'Roadmap' },
    { icon: 'fa-solid fa-circle-question', label: 'FAQ' },
    { icon: 'fa-solid fa-bullhorn', label: 'Updates' },
    { icon: 'fa-solid fa-handshake', label: 'Welcome' },
    { icon: 'fa-solid fa-chart-line', label: 'Metrics' },
    { icon: 'fa-solid fa-shield-halved', label: 'Governance' },
];

const STATIC_CONTENT_BLOCK_TYPES = new Set<string>(COLLAB_BLOCK_OPTIONS.map((o) => o.type));

@Component({
    selector: 'mjc-space-pages',
    standalone: true,
    imports: [
        CommonModule,
        NgComponentOutlet,
        FormsModule,
        MJAlertComponent,
        MJButtonDirective,
        MJMenuComponent,
        MJMenuDividerComponent,
        MJMenuItemComponent,
        MJMenuTriggerDirective,
        CollabBandChipComponent,
        CollabFileIconComponent,
        ...BUILT_IN_SPACE_PAGE_BLOCKS,
    ],
    template: `
        <section class="sp-shell" [class.sp-shell--builtin]="!!activePage?.builtInTabId" aria-label="Space page">
            <ng-template #aboutProjectedTpl>
                <ng-content select="[mjcAbout]"></ng-content>
            </ng-template>
            <ng-template #mainProjectedTpl>
                <ng-content></ng-content>
            </ng-template>

            @if (activePage && canEditPage(activePage) && isCustomizing) {
                <header class="sp-tabbar" data-testid="page-edit-bar">
                    <div class="sp-page-context">
                        <span class="sp-edit-dot" aria-hidden="true"></span>
                        <span class="sp-edit-status" data-testid="page-edit-status">Editing · Draft</span>
                        <span class="sp-edit-hint" data-testid="page-edit-hint">Drafts are visible to everyone who can see this page.</span>
                    </div>
                    <div class="sp-toolbar-right">
                        <button
                            type="button"
                            mjButton
                            Variant="primary"
                            Size="sm"
                            data-testid="page-edit-publish-btn"
                            [disabled]="IsSaving"
                            (click)="publishChanges(activePage)">
                            Publish
                        </button>
                        <button
                            type="button"
                            mjButton
                            Variant="secondary"
                            Size="sm"
                            data-testid="page-edit-discard-btn"
                            [disabled]="IsSaving"
                            (click)="discardChanges(activePage)">
                            Discard
                        </button>
                    </div>
                </header>
            }

            @if (ErrorMessage) {
                <div class="sp-alert-wrap">
                    <mj-alert Variant="error" Role="alert" Title="Could not load pages" [Message]="ErrorMessage" />
                </div>
            }
            @if (SaveError) {
                <div class="sp-alert-wrap">
                    <mj-alert Variant="error" Role="alert" Title="Could not save page" [Message]="SaveError" />
                </div>
            }

            @if (activePage; as page) {
                <ng-template #blockItemTpl let-block="block" let-idx="idx" let-page="page">
                    <section
                        class="sp-block"
                        [class.sp-block--half]="!isOverviewLayout(page) && (block.width === 'half' || block.width === 'main' || block.width === 'side')"
                        [class.sp-block--main-view]="isMainViewBlock(block.type)"
                        [class.sp-block--workspace-padded]="isWorkspaceTabLayout(page) && !isMainViewBlock(block.type)"
                        [class.sp-block--customizing]="isCustomizing && canEditPage(page)"
                        [class.sp-block--dragging]="draggedBlockIndex === idx"
                        [class.sp-block--dragover]="dragOverBlockIndex === idx"
                        [class.sp-block--divider]="block.type === 'Divider'"
                        [attr.draggable]="isCustomizing && canEditPage(page) ? 'true' : null"
                        (dragstart)="onBlockDragStart(idx, $event)"
                        (dragover)="onBlockDragOver(idx, $event)"
                        (drop)="onBlockDrop(page, idx, $event)"
                        (dragend)="onBlockDragEnd()">

                        @if (isCustomizing && canEditPage(page)) {
                            <div class="sp-block-toolbar">
                                <span class="sp-block-type-tag" [title]="block.title || blockTypeLabel(block.type)">
                                    {{ block.title || blockTypeLabel(block.type) }}
                                </span>
                                <div class="sp-block-tools" data-testid="block-toolbar">
                                    <button
                                        type="button"
                                        mjButton
                                        Variant="icon"
                                        Size="sm"
                                        class="sp-tool-btn sp-block-drag-handle"
                                        title="Drag to reorder block"
                                        aria-label="Drag to reorder block">
                                        <i class="fa-solid fa-grip-vertical" aria-hidden="true"></i>
                                    </button>
                                    <button
                                        type="button"
                                        mjButton
                                        Variant="icon"
                                        Size="sm"
                                        class="sp-tool-btn"
                                        [disabled]="!canMoveBlock(page, idx, -1)"
                                        title="Move block up"
                                        aria-label="Move block up"
                                        (click)="moveBlock(page, idx, -1)">
                                        <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
                                    </button>
                                    <button
                                        type="button"
                                        mjButton
                                        Variant="icon"
                                        Size="sm"
                                        class="sp-tool-btn"
                                        [disabled]="!canMoveBlock(page, idx, 1)"
                                        title="Move block down"
                                        aria-label="Move block down"
                                        (click)="moveBlock(page, idx, 1)">
                                        <i class="fa-solid fa-arrow-down" aria-hidden="true"></i>
                                    </button>
                                    <button
                                        type="button"
                                        mjButton
                                        Variant="icon"
                                        Size="sm"
                                        class="sp-tool-btn"
                                        data-testid="block-more-btn"
                                        [mjMenuTriggerFor]="blockMoreMenu"
                                        title="Block options"
                                        aria-label="Block options">
                                        <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
                                    </button>
                                    <ng-template #blockMoreMenu>
                                        <mj-menu AriaLabel="Block options">
                                            @if (!isMainViewBlock(block.type)) {
                                                <mj-menu-item
                                                    Icon="fa-solid fa-table-columns"
                                                    [mjMenuTriggerFor]="blockColumnMenu"
                                                    data-testid="block-menu-column">
                                                    Column ({{ blockWidthLabel(page, block) }})
                                                </mj-menu-item>
                                                <ng-template #blockColumnMenu>
                                                    <mj-menu AriaLabel="Column">
                                                        @if (isOverviewLayout(page)) {
                                                            <mj-menu-item
                                                                [Icon]="overviewZoneFor(block) === 'full' ? 'fa-solid fa-check' : 'fa-solid fa-arrows-left-right'"
                                                                data-testid="block-column-full"
                                                                (Triggered)="setBlockColumn(page, idx, 'full')">
                                                                Full
                                                            </mj-menu-item>
                                                            <mj-menu-item
                                                                [Icon]="overviewZoneFor(block) === 'main' ? 'fa-solid fa-check' : 'fa-solid fa-table-columns'"
                                                                data-testid="block-column-main"
                                                                (Triggered)="setBlockColumn(page, idx, 'main')">
                                                                Main
                                                            </mj-menu-item>
                                                            <mj-menu-item
                                                                [Icon]="overviewZoneFor(block) === 'side' ? 'fa-solid fa-check' : 'fa-solid fa-columns'"
                                                                data-testid="block-column-side"
                                                                (Triggered)="setBlockColumn(page, idx, 'side')">
                                                                Side
                                                            </mj-menu-item>
                                                        } @else {
                                                            <mj-menu-item
                                                                [Icon]="block.width !== 'half' ? 'fa-solid fa-check' : 'fa-solid fa-arrows-left-right'"
                                                                data-testid="block-column-full"
                                                                (Triggered)="setBlockColumn(page, idx, 'full')">
                                                                Full width
                                                            </mj-menu-item>
                                                            <mj-menu-item
                                                                [Icon]="block.width === 'half' ? 'fa-solid fa-check' : 'fa-solid fa-table-columns'"
                                                                data-testid="block-column-half"
                                                                (Triggered)="setBlockColumn(page, idx, 'half')">
                                                                Half width
                                                            </mj-menu-item>
                                                        }
                                                    </mj-menu>
                                                </ng-template>
                                                <mj-menu-divider />
                                            }
                                            <mj-menu-item
                                                Icon="fa-solid fa-pen"
                                                data-testid="block-menu-edit"
                                                (Triggered)="openBlockEditor(block)">
                                                Edit
                                            </mj-menu-item>
                                            @if (!isWidgetBlock(block.type)) {
                                                <mj-menu-item
                                                    Icon="fa-regular fa-copy"
                                                    data-testid="block-menu-duplicate"
                                                    (Triggered)="duplicateBlock(page, idx)">
                                                    Duplicate
                                                </mj-menu-item>
                                            }
                                            @if (!isMainViewBlock(block.type)) {
                                                <mj-menu-item
                                                    Icon="fa-solid fa-trash"
                                                    data-testid="block-menu-remove"
                                                    (Triggered)="deleteBlock(page, idx)">
                                                    Remove
                                                </mj-menu-item>
                                            }
                                        </mj-menu>
                                    </ng-template>
                                </div>
                            </div>
                        }

                        @switch (block.type) {
                            @case ('Heading') {
                                <div class="sp-b-heading">
                                    @if (block.title) {
                                        <h3>{{ block.title }}</h3>
                                    }
                                    @if (block.subtitle) {
                                        <p>{{ block.subtitle }}</p>
                                    }
                                </div>
                            }

                            @case ('Text') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    @if (block.body) {
                                        <div class="sp-b-prose">
                                            @for (p of splitParagraphs(block.body); track $index) {
                                                <p>{{ p }}</p>
                                            }
                                        </div>
                                    }
                                </div>
                            }

                            @case ('Callout') {
                                <div class="sp-b-callout" [attr.data-variant]="block.variant || 'info'">
                                    <div class="sp-b-callout-ic">
                                        <i [class]="calloutIcon(block.variant)"></i>
                                    </div>
                                    <div class="sp-b-callout-body">
                                        @if (block.title) {
                                            <h4>{{ block.title }}</h4>
                                        }
                                        @if (block.body) {
                                            <p>{{ block.body }}</p>
                                        }
                                    </div>
                                </div>
                            }

                            @case ('Bullets') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    <ul class="sp-b-bullets">
                                        @for (item of block.items || []; track $index) {
                                            <li>
                                                <i class="fa-solid fa-circle-check"></i>
                                                <span>{{ item }}</span>
                                            </li>
                                        }
                                    </ul>
                                </div>
                            }

                            @case ('Facts') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    <dl class="sp-b-facts">
                                        @for (pair of block.pairs || []; track $index) {
                                            <div class="sp-b-fact">
                                                <dt>{{ pair.label }}</dt>
                                                <dd>{{ pair.value }}</dd>
                                            </div>
                                        }
                                    </dl>
                                </div>
                            }

                            @case ('Contacts') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    <div class="sp-b-contacts">
                                        @for (person of block.people || []; track $index) {
                                            <div class="sp-b-contact-card">
                                                <div class="sp-b-contact-avatar">{{ initialsFor(person.name) }}</div>
                                                <div class="sp-b-contact-info">
                                                    <div class="sp-b-contact-name">{{ person.name }}</div>
                                                    @if (person.role) {
                                                        <div class="sp-b-contact-role">{{ person.role }}</div>
                                                    }
                                                    <div class="sp-b-contact-links">
                                                        @if (person.email) {
                                                            <a [href]="'mailto:' + person.email"><i class="fa-regular fa-envelope"></i> {{ person.email }}</a>
                                                        }
                                                        @if (person.phone) {
                                                            <span><i class="fa-solid fa-phone"></i> {{ person.phone }}</span>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    </div>
                                </div>
                            }

                            @case ('Resources') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    @if (resolvedResources(block).length === 0) {
                                        <p class="sp-b-muted">No space files linked yet. Click Edit to pick files from this space's Library.</p>
                                    } @else {
                                        <div class="sp-b-resources">
                                            @for (res of resolvedResources(block); track res.id) {
                                                <button
                                                    type="button"
                                                    class="sp-b-resource-row"
                                                    (click)="OpenLibraryFileRequested.emit(res.fileId || res.id)">
                                                    <mjc-file-icon [Kind]="res.kind" Size="sm" />
                                                    <div class="sp-b-resource-main">
                                                        <span class="sp-b-resource-name">{{ res.name }}</span>
                                                        <span class="sp-b-resource-meta">{{ res.folder }} · {{ res.when }}</span>
                                                    </div>
                                                    <mjc-band-chip [Band]="res.band" [Label]="res.band === 'Shared' ? SharedLabel : TeamLabel" />
                                                    <i class="fa-solid fa-arrow-up-right-from-square sp-b-resource-open"></i>
                                                </button>
                                            }
                                        </div>
                                    }
                                </div>
                            }

                            @case ('Video') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    @if (block.url) {
                                        @if (isEmbeddableVideo(block.url)) {
                                            <div class="sp-b-video-frame">
                                                <iframe
                                                    [src]="safeVideoUrl(block.url)"
                                                    frameborder="0"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowfullscreen
                                                    [title]="block.title || 'Embedded video'"></iframe>
                                            </div>
                                        } @else {
                                            <video class="sp-b-video-native" [src]="block.url" controls></video>
                                        }
                                    }
                                    @if (block.caption) {
                                        <p class="sp-b-caption">{{ block.caption }}</p>
                                    }
                                </div>
                            }

                            @case ('Image') {
                                <figure class="sp-b-card sp-b-figure">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    @if (block.url) {
                                        <img class="sp-b-img" [src]="block.url" [alt]="block.alt || block.title || 'Page image'" />
                                    }
                                    @if (block.caption) {
                                        <figcaption class="sp-b-caption">{{ block.caption }}</figcaption>
                                    }
                                </figure>
                            }

                            @case ('Links') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    <div class="sp-b-links">
                                        @for (link of block.links || []; track $index) {
                                            <a
                                                class="sp-b-link-card"
                                                [href]="link.url"
                                                target="_blank"
                                                rel="noopener noreferrer">
                                                <div class="sp-b-link-ic"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
                                                <div class="sp-b-link-text">
                                                    <span class="sp-b-link-lbl">{{ link.label }}</span>
                                                    @if (link.description) {
                                                        <span class="sp-b-link-desc">{{ link.description }}</span>
                                                    }
                                                </div>
                                            </a>
                                        }
                                    </div>
                                </div>
                            }

                            @case ('Checklist') {
                                <div class="sp-b-card">
                                    <div class="sp-b-checklist-head">
                                        @if (block.title) {
                                            <h4 class="sp-b-title">{{ block.title }}</h4>
                                        }
                                        <span class="sp-b-checklist-stat">{{ checklistDoneCount(block) }} / {{ (block.checklist || []).length }} completed ({{ checklistProgress(block) }}%)</span>
                                    </div>
                                    <div class="sp-b-progress">
                                        <div class="sp-b-progress-bar" [style.width.%]="checklistProgress(block)"></div>
                                    </div>
                                    <ul class="sp-b-checklist">
                                        @for (item of block.checklist || []; track item.id) {
                                            <li [class.done]="item.done">
                                                <label class="sp-b-check-label">
                                                    <input
                                                        type="checkbox"
                                                        [checked]="item.done"
                                                        [disabled]="!canParticipateInPage(page)"
                                                        (change)="toggleChecklistItem(page, block, item)" />
                                                    <span>{{ item.text }}</span>
                                                </label>
                                            </li>
                                        }
                                    </ul>
                                </div>
                            }

                            @case ('FAQ') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    <div class="sp-b-faqs">
                                        @for (faq of block.faqs || []; track $index; let fIdx = $index) {
                                            <div class="sp-b-faq" [class.open]="isFaqOpen(block.id, fIdx)">
                                                <button
                                                    type="button"
                                                    class="sp-b-faq-q"
                                                    [attr.aria-expanded]="isFaqOpen(block.id, fIdx)"
                                                    (click)="toggleFaq(block.id, fIdx)">
                                                    <span>{{ faq.q }}</span>
                                                    <i class="fa-solid" [class]="isFaqOpen(block.id, fIdx) ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                                                </button>
                                                @if (isFaqOpen(block.id, fIdx)) {
                                                    <div class="sp-b-faq-a">{{ faq.a }}</div>
                                                }
                                            </div>
                                        }
                                    </div>
                                </div>
                            }

                            @case ('Table') {
                                <div class="sp-b-card">
                                    @if (block.title) {
                                        <h4 class="sp-b-title">{{ block.title }}</h4>
                                    }
                                    <div class="sp-b-table-wrap">
                                        <table class="sp-b-table">
                                            @if ((block.headers || []).length > 0) {
                                                <thead>
                                                    <tr>
                                                        @for (h of block.headers || []; track $index) {
                                                            <th>{{ h }}</th>
                                                        }
                                                    </tr>
                                                </thead>
                                            }
                                            <tbody>
                                                @for (row of block.rows || []; track $index) {
                                                    <tr>
                                                        @for (cell of row; track $index) {
                                                            <td>{{ cell }}</td>
                                                        }
                                                    </tr>
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            }

                            @case ('Divider') {
                                <div class="sp-b-divider" role="separator">
                                    <hr />
                                    @if (block.title) {
                                        <span>{{ block.title }}</span>
                                        <hr />
                                    }
                                </div>
                            }

                            @default {
                                @if (registeredBlockFor(block.type); as reg) {
                                    @if (isRegisteredBlockActive(block, reg)) {
                                        <ng-container *ngComponentOutlet="reg.component; inputs: registeredBlockInputs(block, reg)"></ng-container>
                                    } @else if (isCustomizing && canEditPage(page)) {
                                        <div class="sp-widget-placeholder" data-testid="block-placeholder">
                                            <i [class]="reg.icon" aria-hidden="true"></i>
                                            <span>{{ reg.emptyText }}</span>
                                        </div>
                                    }
                                } @else if (isCustomizing && canEditPage(page)) {
                                    <div class="sp-widget-placeholder sp-widget-unavailable" data-testid="block-unavailable-notice">
                                        <i class="fa-solid fa-circle-minus" aria-hidden="true"></i>
                                        <span>This block is no longer available</span>
                                    </div>
                                }
                            }
                        }
                    </section>
                </ng-template>

                <div
                    class="sp-canvas"
                    [class.sp-canvas--overview]="isOverviewLayout(page)"
                    [class.sp-canvas--workspace]="isWorkspaceTabLayout(page)">
                    <!-- Page Hero / Intro Card (shown on custom pages, or on built-in pages when an intro exists or is being edited) -->
                    @if (!page.builtInTabId || editingIntro || displayBody(page)) {
                    <article class="sp-hero-card" [class.sp-hero-card--workspace]="isWorkspaceTabLayout(page)">
                        <div class="sp-hero-top">
                            <div class="sp-hero-icon">
                                <i [class]="page.iconClass || 'fa-solid fa-compass'"></i>
                            </div>
                            <div class="sp-hero-titles">
                                <div class="sp-hero-badges">
                                    <span class="sp-badge type">{{ page.pageType }}</span>
                                    @if (page.status === 'Draft') {
                                        <span class="sp-badge draft"><i class="fa-solid fa-pen-ruler"></i> Draft</span>
                                    }
                                    @if (page.collaborative) {
                                        <span class="sp-badge collab"><i class="fa-solid fa-users"></i> Collaborative</span>
                                    }
                                    @if (hasUnpublishedDraft(page)) {
                                        <span class="sp-badge dirty"><i class="fa-solid fa-circle-dot"></i> Unpublished edits</span>
                                    }
                                </div>
                                <h2 class="sp-page-title">{{ page.draftTitle || page.title }}</h2>
                                @if (page.summary) {
                                    <p class="sp-page-summary">{{ page.summary }}</p>
                                }
                            </div>
                            @if (isCustomizing && canEditPage(page) && !editingIntro) {
                                <div class="sp-hero-actions">
                                    @if (hasUnpublishedDraft(page)) {
                                        <button type="button" mjButton Variant="primary" Size="sm" (click)="openReviewDiff(page)">
                                            <i class="fa-solid fa-code-compare"></i> Review &amp; Publish
                                        </button>
                                    }
                                    <button type="button" mjButton Variant="secondary" Size="sm" (click)="startIntroEdit(page)">
                                        <i class="fa-solid fa-pen"></i> {{ page.body || page.draftBody ? 'Edit Intro' : 'Add Intro' }}
                                    </button>
                                </div>
                            }
                        </div>

                        @if (editingIntro) {
                            <div class="sp-intro-editor">
                                <label class="sp-field-lbl" for="sp-intro-title">Page Title</label>
                                <input
                                    id="sp-intro-title"
                                    type="text"
                                    class="sp-input"
                                    [(ngModel)]="introTitleDraft"
                                    placeholder="Page title" />
                                <label class="sp-field-lbl" for="sp-intro-summary">Short Subtitle</label>
                                <input
                                    id="sp-intro-summary"
                                    type="text"
                                    class="sp-input"
                                    [(ngModel)]="introSummaryDraft"
                                    placeholder="One-line summary shown under the title" />
                                <label class="sp-field-lbl" for="sp-intro-body">Page Introduction</label>
                                <textarea
                                    id="sp-intro-body"
                                    class="sp-textarea"
                                    rows="5"
                                    [(ngModel)]="introBodyDraft"
                                    placeholder="Write an introduction, executive summary, or instructions for this page..."></textarea>
                                <div class="sp-intro-editor-bar">
                                    <span class="sp-hint">Save as a draft to preview changes with word-by-word diff, or publish immediately.</span>
                                    <div class="sp-btn-row">
                                        <button type="button" mjButton Variant="flat" Size="sm" [disabled]="IsSaving" (click)="cancelIntroEdit()">Cancel</button>
                                        <button type="button" mjButton Variant="secondary" Size="sm" [disabled]="IsSaving" (click)="saveIntroDraft(page)">
                                            <i class="fa-solid fa-floppy-disk"></i> Save Draft
                                        </button>
                                        <button type="button" mjButton Variant="primary" Size="sm" [disabled]="IsSaving" (click)="publishIntroNow(page)">
                                            <i class="fa-solid fa-cloud-arrow-up"></i> Publish Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        } @else if (displayBody(page)) {
                            <div class="sp-intro-body">
                                @for (para of splitParagraphs(displayBody(page)); track $index) {
                                    <p>{{ para }}</p>
                                }
                            </div>
                        }
                    </article>
                    }

                    @if (isOverviewLayout(page)) {
                        @if (overviewBlocksForZone(page, 'full').length > 0 || (isCustomizing && canEditPage(page))) {
                            <div class="sp-ov-full">
                                @if (isCustomizing && canEditPage(page)) {
                                    <div class="sp-insert-line">
                                        <button type="button" class="sp-insert-btn" (click)="openBlockPicker(0, 'full')" title="Add a block here">
                                            <i class="fa-solid fa-plus"></i> Add a block here
                                        </button>
                                    </div>
                                }
                                @for (entry of overviewBlocksForZone(page, 'full'); track entry.block.id) {
                                    <ng-container *ngTemplateOutlet="blockItemTpl; context: { block: entry.block, idx: entry.idx, page: page }"></ng-container>
                                }
                            </div>
                        }
                        <div class="sp-ov-grid">
                            <div class="sp-ov-col sp-ov-col--main">
                                @for (entry of overviewBlocksForZone(page, 'main'); track entry.block.id) {
                                    <ng-container *ngTemplateOutlet="blockItemTpl; context: { block: entry.block, idx: entry.idx, page: page }"></ng-container>
                                }
                                @if (isCustomizing && canEditPage(page)) {
                                    <div class="sp-insert-line">
                                        <button type="button" class="sp-insert-btn" (click)="openBlockPicker(null, 'main')" title="Add block or widget to main column">
                                            <i class="fa-solid fa-plus"></i> Add to main column
                                        </button>
                                    </div>
                                }
                            </div>
                            <div class="sp-ov-col sp-ov-col--side">
                                @for (entry of overviewBlocksForZone(page, 'side'); track entry.block.id) {
                                    <ng-container *ngTemplateOutlet="blockItemTpl; context: { block: entry.block, idx: entry.idx, page: page }"></ng-container>
                                }
                                @if (isCustomizing && canEditPage(page)) {
                                    <div class="sp-insert-line">
                                        <button type="button" class="sp-insert-btn" (click)="openBlockPicker(null, 'side')" title="Add block or widget to right rail">
                                            <i class="fa-solid fa-plus"></i> Add to right column
                                        </button>
                                    </div>
                                }
                            </div>
                        </div>
                    } @else if (!page.builtInTabId || page.blocks.length > 0 || isCustomizing) {
                        <div class="sp-blocks-list" [class.sp-blocks-list--workspace]="isWorkspaceTabLayout(page)">
                            @if (isCustomizing && canEditPage(page) && page.blocks.length > 0) {
                                <div class="sp-insert-line sp-insert-line--workspace">
                                    <button type="button" class="sp-insert-btn" (click)="openBlockPicker(0)" title="Insert block or widget at top">
                                        <i class="fa-solid fa-plus"></i> Insert block above workspace
                                    </button>
                                </div>
                            }

                            @for (block of page.blocks; track block.id; let idx = $index) {
                                @if (shouldRenderBlock(block)) {
                                    <ng-container *ngTemplateOutlet="blockItemTpl; context: { block: block, idx: idx, page: page }"></ng-container>
                                }
                            }

                            @if (isCustomizing && canEditPage(page) && page.blocks.length > 0) {
                                <div class="sp-insert-line sp-insert-line--workspace">
                                    <button type="button" class="sp-insert-btn" (click)="openBlockPicker(page.blocks.length)" title="Add block or widget at bottom">
                                        <i class="fa-solid fa-plus"></i> Add block below workspace
                                    </button>
                                </div>
                            }

                            @if (page.blocks.length === 0) {
                                <div class="sp-empty-blocks">
                                    <i class="fa-solid fa-layer-group"></i>
                                    <h4>Build out this page with customizable blocks &amp; widgets</h4>
                                    <p>Add callouts, checklists, key facts, contacts, space library files, FAQs, tables, or workspace widgets.</p>
                                    @if (canEditPage(page)) {
                                        <button type="button" mjButton Variant="primary" Size="md" (click)="openBlockPicker(0)">
                                            <i class="fa-solid fa-plus"></i> Add First Block
                                        </button>
                                    }
                                </div>
                            }
                        </div>
                    }

                    <!-- Fallback Projected Content (when no collab:main-view block is on the page) -->
                    @if (!hasMainViewBlock(page)) {
                        <div class="sp-projected-content">
                            <ng-container *ngTemplateOutlet="mainProjectedTpl"></ng-container>
                        </div>
                    }
                </div>
            }

            <!-- Drawer 1: Block & Widget Picker -->
            @if (blockPickerOpen && activePage; as page) {
                <div class="sp-drawer-backdrop" (click)="closeBlockPicker()">
                    <aside class="sp-drawer" role="dialog" aria-modal="true" aria-label="Add a content block or widget" (click)="$event.stopPropagation()">
                        <header class="sp-drawer-head">
                            <div>
                                <h3>Add block or widget</h3>
                                <p>Choose a block or live workspace widget to insert into <strong>{{ page.title }}</strong>.</p>
                            </div>
                            <button type="button" class="sp-drawer-close" aria-label="Close block picker" (click)="closeBlockPicker()">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </header>
                        <div class="sp-drawer-body sp-form-stack">
                            @if (availableWidgetBlockOptions(page).length > 0) {
                                <div class="sp-field-lbl">Live space widgets</div>
                                <div class="sp-picker-grid">
                                    @for (opt of availableWidgetBlockOptions(page); track opt.type) {
                                        <button type="button" class="sp-picker-card" (click)="chooseBlockType(page, opt.type)">
                                            <div class="sp-picker-ic"><i [class]="opt.icon"></i></div>
                                            <div class="sp-picker-text">
                                                <span class="sp-picker-lbl" [title]="opt.label">{{ opt.label }}</span>
                                                <span class="sp-picker-hint">{{ opt.hint }}</span>
                                            </div>
                                        </button>
                                    }
                                </div>
                            }
                            <div class="sp-field-lbl">Content blocks</div>
                            <div class="sp-picker-grid">
                                @for (opt of blockOptions; track opt.type) {
                                    <button type="button" class="sp-picker-card" (click)="chooseBlockType(page, opt.type)">
                                        <div class="sp-picker-ic"><i [class]="opt.icon"></i></div>
                                        <div class="sp-picker-text">
                                            <span class="sp-picker-lbl" [title]="opt.label">{{ opt.label }}</span>
                                            <span class="sp-picker-hint">{{ opt.hint }}</span>
                                        </div>
                                    </button>
                                }
                            </div>
                        </div>
                    </aside>
                </div>
            }

            <!-- Drawer 2: Block Editor -->
            @if (editingBlock && activePage; as page) {
                <div class="sp-drawer-backdrop" (click)="closeBlockEditor()">
                    <aside class="sp-drawer" role="dialog" aria-modal="true" aria-label="Edit block" (click)="$event.stopPropagation()">
                        <header class="sp-drawer-head">
                            <div>
                                <h3>Edit {{ blockTypeLabel(editingBlock.type) }}</h3>
                                <p>Customize the heading, layout width, and content for this block.</p>
                            </div>
                            <button type="button" class="sp-drawer-close" aria-label="Close block editor" (click)="closeBlockEditor()">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </header>
                        <div class="sp-drawer-body sp-form-stack">
                            <label class="sp-field-lbl">
                                {{ editingBlock.type === 'Divider' ? 'Optional Label' : (isWidgetBlock(editingBlock.type) ? 'Custom Widget Heading (leave blank for default)' : 'Block Title') }}
                                <input type="text" class="sp-input" [(ngModel)]="editingBlock.title" placeholder="Title or heading" />
                            </label>
                            <label class="sp-field-lbl">
                                Layout Width
                                <select class="sp-input" [ngModel]="editingBlock.width || 'full'" (ngModelChange)="editingBlock.width = $event">
                                    <option value="full">Full Width (spans entire page)</option>
                                    <option value="half">Half Width (2-column side-by-side grid)</option>
                                </select>
                            </label>

                            @switch (editingBlock.type) {
                                @case ('Heading') {
                                    <label class="sp-field-lbl">
                                        Subtitle
                                        <input type="text" class="sp-input" [(ngModel)]="editingBlock.subtitle" placeholder="Supporting subtitle" />
                                    </label>
                                }
                                @case ('Text') {
                                    <label class="sp-field-lbl">
                                        Body Text
                                        <textarea class="sp-textarea" rows="6" [(ngModel)]="editingBlock.body" placeholder="Write paragraphs separated by blank lines..."></textarea>
                                    </label>
                                }
                                @case ('Callout') {
                                    <label class="sp-field-lbl">
                                        Callout Style
                                        <select class="sp-input" [(ngModel)]="editingBlock.variant">
                                            <option value="info">Info (Blue)</option>
                                            <option value="success">Success (Green)</option>
                                            <option value="warning">Warning (Amber)</option>
                                            <option value="danger">Alert (Red)</option>
                                        </select>
                                    </label>
                                    <label class="sp-field-lbl">
                                        Message
                                        <textarea class="sp-textarea" rows="4" [(ngModel)]="editingBlock.body" placeholder="Callout message..."></textarea>
                                    </label>
                                }
                                @case ('Bullets') {
                                    <div class="sp-field-lbl">Bullet Items</div>
                                    @for (item of editingBlock.items || []; track $index; let i = $index) {
                                        <div class="sp-inline-row">
                                            <input type="text" class="sp-input" [(ngModel)]="editingBlock.items![i]" placeholder="Bullet point" />
                                            <button type="button" class="sp-tool-btn danger" (click)="editingBlock.items!.splice(i, 1)">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    }
                                    <button type="button" mjButton Variant="secondary" Size="sm" (click)="addBulletItem()">
                                        <i class="fa-solid fa-plus"></i> Add Bullet
                                    </button>
                                }
                                @case ('Checklist') {
                                    <div class="sp-field-lbl">Checklist Items</div>
                                    @for (item of editingBlock.checklist || []; track item.id; let i = $index) {
                                        <div class="sp-inline-row">
                                            <input type="checkbox" [(ngModel)]="item.done" />
                                            <input type="text" class="sp-input" [(ngModel)]="item.text" placeholder="Action item..." />
                                            <button type="button" class="sp-tool-btn danger" (click)="editingBlock.checklist!.splice(i, 1)">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    }
                                    <button type="button" mjButton Variant="secondary" Size="sm" (click)="addChecklistItem()">
                                        <i class="fa-solid fa-plus"></i> Add Checklist Item
                                    </button>
                                }
                                @case ('Facts') {
                                    <div class="sp-field-lbl">Key / Value Facts</div>
                                    @for (pair of editingBlock.pairs || []; track $index; let i = $index) {
                                        <div class="sp-inline-row">
                                            <input type="text" class="sp-input" [(ngModel)]="pair.label" placeholder="Label (e.g. Target Date)" />
                                            <input type="text" class="sp-input" [(ngModel)]="pair.value" placeholder="Value (e.g. Nov 15, 2026)" />
                                            <button type="button" class="sp-tool-btn danger" (click)="editingBlock.pairs!.splice(i, 1)">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    }
                                    <button type="button" mjButton Variant="secondary" Size="sm" (click)="addFactPair()">
                                        <i class="fa-solid fa-plus"></i> Add Fact
                                    </button>
                                }
                                @case ('Contacts') {
                                    <div class="sp-field-lbl">Contacts</div>
                                    @if (SpaceMembers.length > 0) {
                                        <div class="sp-member-quickpick">
                                            <span class="sp-hint">Quick-add from space members:</span>
                                            <div class="sp-chip-row">
                                                @for (m of SpaceMembers; track m.id) {
                                                    <button type="button" class="sp-mini-chip" (click)="addMemberAsContact(m)">
                                                        <i class="fa-solid fa-user-plus"></i> {{ m.name }}
                                                    </button>
                                                }
                                            </div>
                                        </div>
                                    }
                                    @for (person of editingBlock.people || []; track $index; let i = $index) {
                                        <div class="sp-subcard">
                                            <div class="sp-inline-row">
                                                <input type="text" class="sp-input" [(ngModel)]="person.name" placeholder="Full name" />
                                                <input type="text" class="sp-input" [(ngModel)]="person.role" placeholder="Role / Title" />
                                                <button type="button" class="sp-tool-btn danger" (click)="editingBlock.people!.splice(i, 1)">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                            <div class="sp-inline-row">
                                                <input type="email" class="sp-input" [(ngModel)]="person.email" placeholder="Email address" />
                                                <input type="text" class="sp-input" [(ngModel)]="person.phone" placeholder="Phone (optional)" />
                                            </div>
                                        </div>
                                    }
                                    <button type="button" mjButton Variant="secondary" Size="sm" (click)="addContactPerson()">
                                        <i class="fa-solid fa-plus"></i> Add Contact
                                    </button>
                                }
                                @case ('Resources') {
                                    <div class="sp-field-lbl">Select Files from Space Library</div>
                                    @if (LibraryRows.length === 0) {
                                        <p class="sp-hint">No files in this space's Library yet. Upload files on the Library tab to feature them here.</p>
                                    } @else {
                                        <div class="sp-resource-Checklist">
                                            @for (row of LibraryRows; track row.id) {
                                                <label class="sp-b-check-label">
                                                    <input
                                                        type="checkbox"
                                                        [checked]="isResourceSelected(row.id)"
                                                        (change)="toggleResourceSelection(row.id)" />
                                                    <span>{{ row.name }} <small>({{ row.folder }} · {{ row.band }})</small></span>
                                                </label>
                                            }
                                        </div>
                                    }
                                }
                                @case ('Links') {
                                    <div class="sp-field-lbl">Action Links</div>
                                    @for (link of editingBlock.links || []; track $index; let i = $index) {
                                        <div class="sp-subcard">
                                            <div class="sp-inline-row">
                                                <input type="text" class="sp-input" [(ngModel)]="link.label" placeholder="Button label" />
                                                <input type="url" class="sp-input" [(ngModel)]="link.url" placeholder="https://..." />
                                                <button type="button" class="sp-tool-btn danger" (click)="editingBlock.links!.splice(i, 1)">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                            <input type="text" class="sp-input" [(ngModel)]="link.description" placeholder="Short description (optional)" />
                                        </div>
                                    }
                                    <button type="button" mjButton Variant="secondary" Size="sm" (click)="addLinkItem()">
                                        <i class="fa-solid fa-plus"></i> Add Link
                                    </button>
                                }
                                @case ('Video') {
                                    <label class="sp-field-lbl">
                                        Video URL (YouTube, Vimeo, or direct MP4)
                                        <input type="url" class="sp-input" [(ngModel)]="editingBlock.url" placeholder="https://www.youtube.com/watch?v=..." />
                                    </label>
                                    <label class="sp-field-lbl">
                                        Caption
                                        <input type="text" class="sp-input" [(ngModel)]="editingBlock.caption" placeholder="Optional caption under video" />
                                    </label>
                                }
                                @case ('Image') {
                                    <label class="sp-field-lbl">
                                        Image URL
                                        <input type="url" class="sp-input" [(ngModel)]="editingBlock.url" placeholder="https://..." />
                                    </label>
                                    <label class="sp-field-lbl">
                                        Alt Text
                                        <input type="text" class="sp-input" [(ngModel)]="editingBlock.alt" placeholder="Accessible description of the image" />
                                    </label>
                                    <label class="sp-field-lbl">
                                        Caption
                                        <input type="text" class="sp-input" [(ngModel)]="editingBlock.caption" placeholder="Optional caption" />
                                    </label>
                                }
                                @case ('FAQ') {
                                    <div class="sp-field-lbl">Questions &amp; Answers</div>
                                    @for (faq of editingBlock.faqs || []; track $index; let i = $index) {
                                        <div class="sp-subcard">
                                            <div class="sp-inline-row">
                                                <input type="text" class="sp-input" [(ngModel)]="faq.q" placeholder="Question" />
                                                <button type="button" class="sp-tool-btn danger" (click)="editingBlock.faqs!.splice(i, 1)">
                                                    <i class="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                            <textarea class="sp-textarea" rows="2" [(ngModel)]="faq.a" placeholder="Answer"></textarea>
                                        </div>
                                    }
                                    <button type="button" mjButton Variant="secondary" Size="sm" (click)="addFaqItem()">
                                        <i class="fa-solid fa-plus"></i> Add Question
                                    </button>
                                }
                                @case ('Table') {
                                    <label class="sp-field-lbl">
                                        Column Headers (comma-separated)
                                        <input
                                            type="text"
                                            class="sp-input"
                                            [ngModel]="(editingBlock.headers || []).join(', ')"
                                            (ngModelChange)="onTableHeadersInput($event)"
                                            placeholder="Phase, Owner, Target Date, Status" />
                                    </label>
                                    <label class="sp-field-lbl">
                                        Table Rows (one row per line, cells separated by |)
                                        <textarea
                                            class="sp-textarea"
                                            rows="5"
                                            [ngModel]="tableRowsToText(editingBlock.rows || [])"
                                            (ngModelChange)="onTableRowsInput($event)"
                                            placeholder="Discovery | Ada | Oct 15 | Complete"></textarea>
                                    </label>
                                }
                            }
                        </div>
                        <footer class="sp-drawer-foot">
                            <button type="button" mjButton Variant="flat" Size="sm" (click)="closeBlockEditor()">Cancel</button>
                            <button type="button" mjButton Variant="primary" Size="sm" [disabled]="IsSaving" (click)="saveBlockEdit(page)">
                                <i class="fa-solid fa-check"></i> Save Block
                            </button>
                        </footer>
                    </aside>
                </div>
            }

            <!-- Drawer 3: New Page / Page Settings Drawer -->
            @if (pageSettingsOpen && pageFormDraft) {
                <div class="sp-drawer-backdrop" (click)="closePageSettings()">
                    <aside class="sp-drawer" role="dialog" aria-modal="true" [attr.aria-label]="pageFormMode === 'create' ? 'Create new page' : 'Page settings'" (click)="$event.stopPropagation()">
                        <header class="sp-drawer-head">
                            <div>
                                <h3>{{ pageFormMode === 'create' ? 'Create Custom Page' : 'Page Settings' }}</h3>
                                <p>{{ pageFormMode === 'create' ? 'Add a new customizable page to this space.' : 'Configure visibility, icon, and collaboration options.' }}</p>
                            </div>
                            <button type="button" class="sp-drawer-close" aria-label="Close page settings" (click)="closePageSettings()">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </header>
                        <div class="sp-drawer-body sp-form-stack">
                            <label class="sp-field-lbl">
                                Page Title
                                <input type="text" class="sp-input" [(ngModel)]="pageFormDraft.title" placeholder="e.g. Executive Roadmap, Onboarding Guide, Working Papers" />
                            </label>
                            <label class="sp-field-lbl">
                                Subtitle / Summary
                                <input type="text" class="sp-input" [(ngModel)]="pageFormDraft.summary" placeholder="Short description shown in the page header" />
                            </label>
                            <label class="sp-field-lbl">
                                Page Template / Type
                                <select class="sp-input" [(ngModel)]="pageFormDraft.pageType">
                                    <option value="Overview">Overview</option>
                                    <option value="Guide">Guide &amp; Playbook</option>
                                    <option value="Onboarding">Onboarding &amp; Checklist</option>
                                    <option value="Roadmap">Milestones &amp; Roadmap</option>
                                    <option value="FAQ">FAQ &amp; Knowledge Base</option>
                                    <option value="Custom">Custom Blank Page</option>
                                </select>
                            </label>
                            <div class="sp-field-lbl">Page Icon</div>
                            <div class="sp-icon-grid">
                                @for (ic of pageIcons; track ic.icon) {
                                    <button
                                        type="button"
                                        class="sp-icon-choice"
                                        [class.active]="pageFormDraft.iconClass === ic.icon"
                                        (click)="pageFormDraft.iconClass = ic.icon">
                                        <i [class]="ic.icon"></i>
                                        <span>{{ ic.label }}</span>
                                    </button>
                                }
                            </div>
                            @if (CanSeeTeam) {
                                <label class="sp-field-lbl">
                                    Audience Band
                                    <select class="sp-input" [(ngModel)]="pageFormDraft.band">
                                        <option value="Shared">{{ SharedLabel }} (Everyone in this space)</option>
                                        <option value="Team">{{ TeamLabel }} only (Internal staff)</option>
                                    </select>
                                </label>
                            }
                            <label class="sp-b-check-label">
                                <input type="checkbox" [(ngModel)]="pageFormDraft.collaborative" />
                                <span>Allow space members to check off checklist items and post comments</span>
                            </label>
                        </div>
                        <footer class="sp-drawer-foot">
                            @if (pageFormMode === 'edit' && activePage && !activePage.isSeed && !activePage.builtInTabId && visiblePages.length > 1) {
                                <button type="button" mjButton Variant="danger" Size="sm" (click)="deletePage(activePage)">
                                    <i class="fa-solid fa-trash"></i> Delete Page
                                </button>
                            }
                            <span style="flex: 1"></span>
                            <button type="button" mjButton Variant="flat" Size="sm" (click)="closePageSettings()">Cancel</button>
                            <button
                                type="button"
                                mjButton
                                Variant="primary"
                                Size="sm"
                                [disabled]="!pageFormDraft.title.trim() || IsSaving"
                                (click)="submitPageSettings()">
                                <i class="fa-solid fa-check"></i> {{ pageFormMode === 'create' ? 'Create Page' : 'Save Settings' }}
                            </button>
                        </footer>
                    </aside>
                </div>
            }

            <!-- Drawer 4: Review & Publish Word-Diff Drawer -->
            @if (reviewDiffOpen && activePage; as page) {
                <div class="sp-drawer-backdrop" (click)="closeReviewDiff()">
                    <aside class="sp-drawer" role="dialog" aria-modal="true" aria-label="Review draft changes before publishing" (click)="$event.stopPropagation()">
                        <header class="sp-drawer-head">
                            <div>
                                <h3>Review &amp; Publish Changes</h3>
                                <p>Word-by-word comparison between the live page and your draft (+{{ diffSummary.addedWords }} / -{{ diffSummary.removedWords }} words).</p>
                            </div>
                            <button type="button" class="sp-drawer-close" aria-label="Close review drawer" (click)="closeReviewDiff()">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </header>
                        <div class="sp-drawer-body sp-form-stack">
                            @if (titleDiffSegments.length > 0) {
                                <div class="sp-field-lbl">Title Changes</div>
                                <div class="sp-diff-box">
                                    @for (seg of titleDiffSegments; track $index) {
                                        <span [class]="'sp-diff-' + seg.op">{{ seg.text }}</span>
                                    }
                                </div>
                            }
                            <div class="sp-field-lbl">Introduction Changes</div>
                            <div class="sp-diff-box">
                                @for (seg of bodyDiffSegments; track $index) {
                                    <span [class]="'sp-diff-' + seg.op">{{ seg.text }}</span>
                                }
                            </div>
                        </div>
                        <footer class="sp-drawer-foot">
                            <button type="button" mjButton Variant="danger" Size="sm" (click)="discardDraft(page)">
                                <i class="fa-solid fa-rotate-left"></i> Discard Draft
                            </button>
                            <span style="flex: 1"></span>
                            <button type="button" mjButton Variant="flat" Size="sm" (click)="closeReviewDiff()">Cancel</button>
                            <button type="button" mjButton Variant="primary" Size="sm" [disabled]="IsSaving" (click)="confirmPublishDraft(page)">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Publish Live
                            </button>
                        </footer>
                    </aside>
                </div>
            }
        </section>
    `,
    styles: [
        COLLAB_TOKENS_CSS,
        `
        :host {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            color: var(--mj-text-primary);
            font-family: var(--mj-font-family, Inter, sans-serif);
            font-size: 14px;
            line-height: var(--mjc-line-height);
        }
        .sp-shell {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            background: var(--mj-bg-page);
        }
        .sp-tabbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--mj-space-3);
            padding: var(--mj-space-2) var(--mj-space-5);
            background: var(--mj-bg-surface);
            border-bottom: 1px solid var(--mj-border-default);
            flex-wrap: wrap;
        }
        .sp-page-context {
            display: flex;
            align-items: center;
            gap: var(--mj-space-2);
            min-width: 0;
            flex: 1;
            flex-wrap: wrap;
        }
        .sp-edit-dot {
            width: 8px;
            height: 8px;
            border-radius: var(--mj-radius-full);
            background: var(--mj-status-warning);
            flex-shrink: 0;
        }
        .sp-edit-status {
            font-size: var(--mj-text-sm);
            font-weight: var(--mj-font-semibold);
            color: var(--mj-text-primary);
        }
        .sp-edit-hint {
            font-size: var(--mj-text-xs);
            color: var(--mj-text-muted);
        }
        .sp-context-ic {
            color: var(--mj-brand-primary);
            font-size: 13px;
        }
        .sp-context-title {
            font-size: 13.5px;
            font-weight: 700;
            color: var(--mj-text-primary);
        }
        .sp-context-sep {
            color: var(--mj-text-muted);
            font-size: 12px;
        }
        .sp-context-summary {
            font-size: 12.5px;
            color: var(--mj-text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 420px;
        }
        .sp-context-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 99px;
            font-size: 11px;
            font-weight: 600;
            background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
            color: var(--mj-brand-primary);
        }
        .sp-context-pill.draft {
            background: color-mix(in srgb, var(--mj-status-warning) 16%, var(--mj-bg-surface));
            color: var(--mj-status-warning);
        }
        .sp-tabs {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }
        .sp-tab-wrap {
            display: inline-flex;
            align-items: center;
            gap: 2px;
        }
        .sp-tab-move {
            border: none;
            background: transparent;
            color: var(--mj-text-muted);
            cursor: pointer;
            padding: 4px;
            font-size: 10px;
            border-radius: 4px;
        }
        .sp-tab-move:hover {
            background: var(--mj-bg-surface-hover);
            color: var(--mj-text-primary);
        }
        .sp-tab {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            padding: 6px 12px;
            border-radius: 8px;
            border: 1px solid transparent;
            background: transparent;
            color: var(--mj-text-secondary);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .sp-tab:hover {
            background: var(--mj-bg-surface-hover);
            color: var(--mj-text-primary);
        }
        .sp-tab.active {
            background: color-mix(in srgb, var(--mj-brand-primary) 10%, var(--mj-bg-surface));
            border-color: color-mix(in srgb, var(--mj-brand-primary) 30%, transparent);
            color: var(--mj-brand-primary);
        }
        .sp-tab-add {
            border: 1px dashed var(--mj-border-default);
            color: var(--mj-text-secondary);
            font-weight: 500;
        }
        .sp-tab-add:hover {
            border-color: var(--mj-brand-primary);
            color: var(--mj-brand-primary);
        }
        .sp-tab-dot {
            width: 7px;
            height: 7px;
            border-radius: 99px;
            background: var(--mj-status-warning);
        }
        .sp-tab-band.team {
            font-size: 10px;
            color: var(--mjc-team);
        }
        .sp-toolbar-right {
            display: flex;
            align-items: center;
            gap: var(--mj-space-2);
            flex-wrap: wrap;
        }
        .sp-alert-wrap {
            padding: 12px 20px 0;
        }
        .sp-canvas {
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
            padding: 18px 28px 36px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .sp-canvas--overview {
            max-width: none;
            margin: 0;
            padding: 18px 28px;
            gap: 14px;
        }
        .sp-canvas--workspace {
            max-width: none;
            margin: 0;
            padding: 0;
            gap: 0;
            flex: 1;
            min-height: 0;
        }
        .sp-ov-full {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-width: 0;
        }
        .sp-ov-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 340px;
            gap: 18px;
            align-items: start;
        }
        .sp-ov-col {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-width: 0;
        }
        .sp-projected-content {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .sp-projected-content:empty {
            display: none;
        }
        .sp-hero-card {
            background: var(--mj-bg-surface);
            border: 1px solid var(--mj-border-default);
            border-radius: 12px;
            padding: 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-shadow: var(--mj-shadow-sm);
        }
        .sp-hero-card--workspace {
            margin: 18px 28px 0;
        }
        .sp-hero-top {
            display: flex;
            align-items: flex-start;
            gap: 14px;
        }
        .sp-hero-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
            color: var(--mj-brand-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 17px;
            flex-shrink: 0;
        }
        .sp-hero-titles {
            flex: 1;
            min-width: 0;
        }
        .sp-hero-badges {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
            flex-wrap: wrap;
        }
        .sp-badge {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 99px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .sp-badge.type {
            background: var(--mj-bg-surface-sunken);
            color: var(--mj-text-secondary);
        }
        .sp-badge.draft, .sp-badge.dirty {
            background: color-mix(in srgb, var(--mj-status-warning) 15%, var(--mj-bg-surface));
            color: var(--mj-status-warning);
        }
        .sp-badge.collab {
            background: color-mix(in srgb, var(--mj-status-success) 14%, var(--mj-bg-surface));
            color: var(--mj-status-success);
        }
        .sp-page-title {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: var(--mj-text-primary);
        }
        .sp-page-summary {
            margin: 3px 0 0;
            font-size: 13px;
            color: var(--mj-text-secondary);
        }
        .sp-hero-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        .sp-intro-body {
            border-top: 1px solid var(--mj-border-subtle, var(--mj-border-default));
            padding-top: 12px;
            color: var(--mj-text-secondary);
            font-size: 14px;
            line-height: 1.6;
        }
        .sp-intro-body p {
            margin: 0 0 8px;
        }
        .sp-intro-body p:last-child {
            margin-bottom: 0;
        }
        .sp-intro-editor {
            border-top: 1px solid var(--mj-border-default);
            padding-top: 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .sp-intro-editor-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 4px;
        }
        .sp-btn-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .sp-blocks-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            align-items: start;
        }
        .sp-blocks-list--workspace {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            gap: 0;
            align-items: stretch;
        }
        .sp-insert-line, .sp-empty-blocks {
            grid-column: 1 / -1;
        }
        .sp-insert-line {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            margin: 2px 0;
        }
        .sp-insert-line--workspace {
            margin: 10px 28px;
        }
        .sp-insert-line::before {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            height: 1px;
            background: color-mix(in srgb, var(--mj-brand-primary) 25%, transparent);
        }
        .sp-insert-btn {
            position: relative;
            z-index: 1;
            border: 1px dashed color-mix(in srgb, var(--mj-brand-primary) 45%, var(--mj-border-default));
            background: var(--mj-bg-surface);
            color: var(--mj-brand-primary);
            font-size: 11.5px;
            font-weight: 600;
            padding: 3px 12px;
            border-radius: 99px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 5px;
        }
        .sp-insert-btn:hover {
            background: color-mix(in srgb, var(--mj-brand-primary) 10%, var(--mj-bg-surface));
        }
        .sp-block {
            grid-column: 1 / -1;
            min-width: 0;
            position: relative;
            transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .sp-block.sp-block--half {
            grid-column: span 1;
        }
        .sp-block--main-view {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .sp-block--workspace-padded {
            margin: 14px 28px 0;
        }
        @media (max-width: 960px) {
            .sp-ov-grid {
                grid-template-columns: minmax(0, 1fr);
            }
            .sp-blocks-list {
                grid-template-columns: minmax(0, 1fr);
            }
            .sp-block.sp-block--half {
                grid-column: 1 / -1;
            }
        }
        .sp-widget-placeholder {
            display: flex;
            align-items: center;
            gap: var(--mj-space-3);
            padding: var(--mj-space-3) var(--mj-space-4);
            border-radius: var(--mj-radius-md);
            border: 1px dashed var(--mj-border-default);
            background: var(--mj-bg-surface-sunken);
            color: var(--mj-text-secondary);
            font-size: var(--mj-text-xs);
        }
        .sp-widget-placeholder i {
            font-size: var(--mj-text-base);
            color: var(--mj-brand-primary);
            flex-shrink: 0;
        }
        .sp-widget-unavailable i {
            color: var(--mj-text-muted);
        }
        .sp-block--customizing {
            border: 1px dashed color-mix(in srgb, var(--mj-brand-primary) 40%, var(--mj-border-default));
            border-radius: var(--mj-radius-lg);
            padding: var(--mj-space-2-5);
            background: color-mix(in srgb, var(--mj-bg-surface) 75%, transparent);
        }
        .sp-block--dragover {
            box-shadow: 0 0 0 2px var(--mj-brand-primary);
        }
        .sp-block-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: var(--mj-space-2);
            min-height: 28px;
            padding: var(--mj-space-0-5) var(--mj-space-1-5) var(--mj-space-1-5);
            margin-bottom: var(--mj-space-1-5);
            border-bottom: 1px solid var(--mj-border-subtle);
            min-width: 0;
        }
        .sp-block-drag-handle {
            cursor: grab;
        }
        .sp-block-type-tag {
            font-size: var(--mj-text-xs);
            font-weight: var(--mj-font-semibold);
            color: var(--mj-text-secondary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
            flex: 1;
        }
        .sp-block-tools {
            display: none;
            align-items: center;
            gap: var(--mj-space-1);
            flex-shrink: 0;
        }
        .sp-block--customizing:hover .sp-block-tools,
        .sp-block--customizing:focus-within .sp-block-tools,
        .sp-block--customizing .sp-block-tools:has([aria-expanded="true"]) {
            display: inline-flex;
        }
        .sp-tool-btn {
            width: 26px;
            height: 26px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface);
            color: var(--mj-text-secondary);
            border-radius: var(--mj-radius-sm);
            padding: 0;
            font-size: var(--mj-text-xs);
            cursor: pointer;
            display: inline-grid;
            place-items: center;
        }
        .sp-tool-btn:hover:not(:disabled) {
            background: var(--mj-bg-surface-hover);
            color: var(--mj-text-primary);
        }
        .sp-tool-btn:disabled {
            opacity: 0.4;
            cursor: default;
        }
        .sp-b-card {
            background: var(--mj-bg-surface);
            border: 1px solid var(--mj-border-default);
            border-radius: 12px;
            padding: 14px 16px 16px;
            box-shadow: var(--mj-shadow-sm);
        }
        .sp-b-title {
            margin: 0 0 10px;
            font-size: 14px;
            font-weight: 700;
            color: var(--mj-text-primary);
        }
        .sp-b-heading {
            padding: 6px 4px 2px;
        }
        .sp-b-heading h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 700;
            color: var(--mj-text-primary);
        }
        .sp-b-heading p {
            margin: 4px 0 0;
            font-size: 13px;
            color: var(--mj-text-secondary);
        }
        .sp-b-prose {
            color: var(--mj-text-secondary);
            font-size: 14px;
            line-height: 1.6;
        }
        .sp-b-prose p {
            margin: 0 0 10px;
        }
        .sp-b-prose p:last-child {
            margin-bottom: 0;
        }
        .sp-b-callout {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 18px;
            border-radius: 10px;
            border: 1px solid var(--mj-border-default);
            background: color-mix(in srgb, var(--mj-status-info, var(--mj-brand-primary)) 8%, var(--mj-bg-surface-card));
            border-left: 4px solid var(--mj-status-info, var(--mj-brand-primary));
        }
        .sp-b-callout[data-variant='success'] {
            background: color-mix(in srgb, var(--mj-status-success) 8%, var(--mj-bg-surface-card));
            border-left-color: var(--mj-status-success);
        }
        .sp-b-callout[data-variant='warning'] {
            background: color-mix(in srgb, var(--mj-status-warning) 10%, var(--mj-bg-surface-card));
            border-left-color: var(--mj-status-warning);
        }
        .sp-b-callout[data-variant='danger'] {
            background: color-mix(in srgb, var(--mj-status-error) 8%, var(--mj-bg-surface-card));
            border-left-color: var(--mj-status-error);
        }
        .sp-b-callout-ic {
            font-size: 16px;
            color: var(--mj-brand-primary);
            margin-top: 2px;
        }
        .sp-b-callout[data-variant='success'] .sp-b-callout-ic { color: var(--mj-status-success); }
        .sp-b-callout[data-variant='warning'] .sp-b-callout-ic { color: var(--mj-status-warning); }
        .sp-b-callout[data-variant='danger'] .sp-b-callout-ic { color: var(--mj-status-error); }
        .sp-b-callout-body h4 {
            margin: 0 0 4px;
            font-size: 14px;
            font-weight: 700;
            color: var(--mj-text-primary);
        }
        .sp-b-callout-body p {
            margin: 0;
            font-size: 13.5px;
            color: var(--mj-text-secondary);
            line-height: 1.5;
        }
        .sp-b-bullets {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .sp-b-bullets li {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 13.5px;
            color: var(--mj-text-primary);
        }
        .sp-b-bullets li i {
            color: var(--mj-brand-primary);
            margin-top: 3px;
            font-size: 13px;
        }
        .sp-b-facts {
            margin: 0;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 12px;
        }
        .sp-b-fact {
            background: var(--mj-bg-surface-sunken);
            border: 1px solid var(--mj-border-subtle, var(--mj-border-default));
            border-radius: 8px;
            padding: 10px 12px;
        }
        .sp-b-fact dt {
            font-size: 11.5px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--mj-text-muted);
        }
        .sp-b-fact dd {
            margin: 4px 0 0;
            font-size: 14px;
            font-weight: 700;
            color: var(--mj-text-primary);
        }
        .sp-b-contacts {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 12px;
        }
        .sp-b-contact-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            border-radius: 10px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface-sunken);
        }
        .sp-b-contact-avatar {
            width: 38px;
            height: 38px;
            border-radius: 99px;
            background: var(--mj-brand-primary);
            color: var(--mj-brand-on-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
            flex-shrink: 0;
        }
        .sp-b-contact-info {
            min-width: 0;
            flex: 1;
        }
        .sp-b-contact-name {
            font-weight: 700;
            font-size: 13.5px;
            color: var(--mj-text-primary);
        }
        .sp-b-contact-role {
            font-size: 12px;
            color: var(--mj-text-secondary);
        }
        .sp-b-contact-links {
            margin-top: 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 12px;
            color: var(--mj-brand-primary);
        }
        .sp-b-contact-links a {
            color: var(--mj-brand-primary);
            text-decoration: none;
        }
        .sp-b-resources {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .sp-b-resource-row {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            text-align: left;
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface);
            cursor: pointer;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        .sp-b-resource-row:hover {
            background: var(--mj-bg-surface-hover);
            border-color: var(--mj-brand-primary);
        }
        .sp-b-resource-main {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
        }
        .sp-b-resource-name {
            font-size: 13.5px;
            font-weight: 600;
            color: var(--mj-text-primary);
        }
        .sp-b-resource-meta {
            font-size: 12px;
            color: var(--mj-text-muted);
        }
        .sp-b-resource-open {
            color: var(--mj-text-muted);
            font-size: 12px;
        }
        .sp-b-checklist-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
        }
        .sp-b-checklist-head .sp-b-title {
            margin: 0;
        }
        .sp-b-checklist-stat {
            font-size: 12px;
            font-weight: 600;
            color: var(--mj-text-secondary);
        }
        .sp-b-progress {
            height: 6px;
            border-radius: 99px;
            background: var(--mj-bg-surface-sunken);
            overflow: hidden;
            margin-bottom: 12px;
        }
        .sp-b-progress-bar {
            height: 100%;
            background: var(--mj-status-success);
            transition: width 0.2s ease;
        }
        .sp-b-checklist {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .sp-b-checklist li.done span {
            text-decoration: line-through;
            color: var(--mj-text-muted);
        }
        .sp-b-check-label {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13.5px;
            color: var(--mj-text-primary);
            cursor: pointer;
        }
        .sp-b-links {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
            gap: 10px;
        }
        .sp-b-link-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 10px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface-sunken);
            text-decoration: none;
            color: var(--mj-text-primary);
            transition: border-color 0.15s ease;
        }
        .sp-b-link-card:hover {
            border-color: var(--mj-brand-primary);
        }
        .sp-b-link-ic {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
            color: var(--mj-brand-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .sp-b-link-text {
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        .sp-b-link-lbl {
            font-weight: 600;
            font-size: 13.5px;
        }
        .sp-b-link-desc {
            font-size: 12px;
            color: var(--mj-text-secondary);
        }
        .sp-b-faqs {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .sp-b-faq {
            border: 1px solid var(--mj-border-default);
            border-radius: 8px;
            overflow: hidden;
        }
        .sp-b-faq-q {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            background: var(--mj-bg-surface-sunken);
            border: none;
            font-size: 13.5px;
            font-weight: 600;
            color: var(--mj-text-primary);
            cursor: pointer;
            text-align: left;
        }
        .sp-b-faq-a {
            padding: 12px 14px;
            font-size: 13.5px;
            color: var(--mj-text-secondary);
            line-height: 1.55;
            background: var(--mj-bg-surface-card);
            border-top: 1px solid var(--mj-border-default);
        }
        .sp-b-table-wrap {
            overflow-x: auto;
        }
        .sp-b-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .sp-b-table th, .sp-b-table td {
            padding: 9px 12px;
            border-bottom: 1px solid var(--mj-border-default);
            text-align: left;
        }
        .sp-b-table th {
            font-size: 11.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--mj-text-muted);
            background: var(--mj-bg-surface-sunken);
        }
        .sp-b-divider {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 0;
            color: var(--mj-text-muted);
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .sp-b-divider hr {
            flex: 1;
            border: none;
            border-top: 1px solid var(--mj-border-default);
        }
        .sp-b-video-frame {
            position: relative;
            padding-bottom: 56.25%;
            height: 0;
            overflow: hidden;
            border-radius: 8px;
            background: var(--mj-bg-surface-sunken);
        }
        .sp-b-video-frame iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        .sp-b-video-native, .sp-b-img {
            max-width: 100%;
            border-radius: 8px;
            display: block;
        }
        .sp-b-figure {
            margin: 0;
        }
        .sp-b-caption {
            margin: 8px 0 0;
            font-size: 12.5px;
            color: var(--mj-text-muted);
        }
        .sp-b-muted {
            margin: 0;
            font-size: 13px;
            color: var(--mj-text-muted);
        }
        .sp-empty-blocks {
            background: var(--mj-bg-surface-card);
            border: 1px dashed var(--mj-border-default);
            border-radius: 12px;
            padding: 32px 24px;
            text-align: center;
            color: var(--mj-text-secondary);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
        }
        .sp-empty-blocks i {
            font-size: 26px;
            color: var(--mj-brand-primary);
        }
        .sp-empty-blocks h4 {
            margin: 0;
            font-size: 15px;
            color: var(--mj-text-primary);
        }
        .sp-empty-blocks p {
            margin: 0 0 8px;
            font-size: 13px;
            max-width: 460px;
        }
        .sp-comments-card {
            background: var(--mj-bg-surface-card);
            border: 1px solid var(--mj-border-default);
            border-radius: 12px;
            padding: 18px 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .sp-comments-title {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--mj-text-primary);
        }
        .sp-comments-count {
            font-size: 11.5px;
            padding: 1px 7px;
            border-radius: 99px;
            background: var(--mj-bg-surface-sunken);
            color: var(--mj-text-secondary);
        }
        .sp-comments-sub {
            margin: 2px 0 0;
            font-size: 12.5px;
            color: var(--mj-text-muted);
        }
        .sp-comment-composer {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .sp-comment-composer-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }
        .sp-internal-check {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12.5px;
            color: var(--mjc-team);
            font-weight: 600;
            cursor: pointer;
        }
        .sp-comments-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .sp-comment {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 8px;
            background: var(--mj-bg-surface-sunken);
            border: 1px solid var(--mj-border-subtle, var(--mj-border-default));
        }
        .sp-comment.team-only {
            border-left: 3px solid var(--mjc-team);
        }
        .sp-comment.resolved {
            opacity: 0.72;
        }
        .sp-comment-avatar {
            width: 30px;
            height: 30px;
            border-radius: 99px;
            background: var(--mj-brand-primary);
            color: var(--mj-brand-on-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11.5px;
            font-weight: 700;
            flex-shrink: 0;
        }
        .sp-comment-main {
            flex: 1;
            min-width: 0;
        }
        .sp-comment-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--mj-text-muted);
            flex-wrap: wrap;
        }
        .sp-comment-meta strong {
            color: var(--mj-text-primary);
        }
        .sp-comment-band {
            font-size: 11px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 99px;
        }
        .sp-comment-band.team {
            color: var(--mjc-team);
            background: color-mix(in srgb, var(--mjc-team) 12%, var(--mj-bg-surface));
        }
        .sp-comment-band.resolved {
            color: var(--mj-status-success);
            background: color-mix(in srgb, var(--mj-status-success) 12%, var(--mj-bg-surface));
        }
        .sp-comment-act {
            margin-left: auto;
            border: none;
            background: transparent;
            color: var(--mj-brand-primary);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
        }
        .sp-comment-body {
            margin: 4px 0 0;
            font-size: 13.5px;
            color: var(--mj-text-primary);
        }
        /* Drawers */
        .sp-drawer-backdrop {
            position: fixed;
            inset: 0;
            background: var(--mj-bg-overlay);
            z-index: 1050;
            display: flex;
            justify-content: flex-end;
        }
        .sp-drawer {
            width: 520px;
            max-width: 94vw;
            height: 100%;
            background: var(--mj-bg-surface);
            border-left: 1px solid var(--mj-border-default);
            display: flex;
            flex-direction: column;
            box-shadow: var(--mj-shadow-lg);
        }
        .sp-drawer-head {
            padding: 18px 20px;
            border-bottom: 1px solid var(--mj-border-default);
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
        }
        .sp-drawer-head h3 {
            margin: 0;
            font-size: 17px;
            font-weight: 700;
            color: var(--mj-text-primary);
        }
        .sp-drawer-head p {
            margin: 4px 0 0;
            font-size: 12.5px;
            color: var(--mj-text-secondary);
        }
        .sp-drawer-close {
            border: none;
            background: transparent;
            color: var(--mj-text-muted);
            font-size: 16px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 6px;
        }
        .sp-drawer-close:hover {
            background: var(--mj-bg-surface-hover);
            color: var(--mj-text-primary);
        }
        .sp-drawer-body {
            flex: 1;
            overflow-y: auto;
            padding: 18px 20px;
        }
        .sp-drawer-foot {
            padding: 14px 20px;
            border-top: 1px solid var(--mj-border-default);
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .sp-picker-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 10px;
        }
        .sp-picker-card {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px;
            border-radius: 10px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface-card);
            cursor: pointer;
            text-align: left;
            transition: border-color 0.15s ease, background 0.15s ease;
        }
        .sp-picker-card:hover {
            border-color: var(--mj-brand-primary);
            background: var(--mj-bg-surface-hover);
        }
        .sp-picker-ic {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
            color: var(--mj-brand-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .sp-picker-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
            min-width: 0;
        }
        .sp-picker-lbl {
            font-size: 13px;
            font-weight: 700;
            color: var(--mj-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .sp-picker-hint {
            font-size: 11.5px;
            color: var(--mj-text-secondary);
            line-height: 1.35;
        }
        .sp-form-stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .sp-field-lbl {
            display: flex;
            flex-direction: column;
            gap: 5px;
            font-size: 12.5px;
            font-weight: 600;
            color: var(--mj-text-primary);
        }
        .sp-input, .sp-textarea {
            width: 100%;
            box-sizing: border-box;
            padding: 8px 11px;
            border-radius: 8px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface);
            color: var(--mj-text-primary);
            font-family: inherit;
            font-size: 13.5px;
        }
        .sp-input:focus, .sp-textarea:focus {
            outline: none;
            border-color: var(--mj-brand-primary);
        }
        .sp-inline-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .sp-subcard {
            padding: 10px;
            border-radius: 8px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface-sunken);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .sp-hint {
            font-size: 12px;
            color: var(--mj-text-muted);
        }
        .sp-chip-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 4px;
        }
        .sp-mini-chip {
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface);
            color: var(--mj-text-secondary);
            border-radius: 99px;
            padding: 3px 9px;
            font-size: 11.5px;
            cursor: pointer;
        }
        .sp-mini-chip:hover {
            border-color: var(--mj-brand-primary);
            color: var(--mj-brand-primary);
        }
        .sp-icon-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
            gap: 8px;
        }
        .sp-icon-choice {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 8px;
            border-radius: 8px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface);
            color: var(--mj-text-secondary);
            font-size: 11.5px;
            cursor: pointer;
        }
        .sp-icon-choice.active {
            border-color: var(--mj-brand-primary);
            background: color-mix(in srgb, var(--mj-brand-primary) 10%, var(--mj-bg-surface));
            color: var(--mj-brand-primary);
            font-weight: 600;
        }
        .sp-diff-box {
            padding: 12px 14px;
            border-radius: 8px;
            border: 1px solid var(--mj-border-default);
            background: var(--mj-bg-surface-sunken);
            font-size: 13.5px;
            line-height: 1.6;
            white-space: pre-wrap;
        }
        .sp-diff-insert {
            background: color-mix(in srgb, var(--mj-status-success) 22%, transparent);
            color: var(--mj-text-primary);
            font-weight: 600;
            border-radius: 3px;
            padding: 0 2px;
        }
        .sp-diff-delete {
            background: color-mix(in srgb, var(--mj-status-error) 20%, transparent);
            color: var(--mj-status-error);
            text-decoration: line-through;
            border-radius: 3px;
            padding: 0 2px;
        }
        @media (prefers-reduced-motion: reduce) {
            .sp-tab,
            .sp-block,
            .sp-b-resource-row,
            .sp-b-progress-bar,
            .sp-b-link-card,
            .sp-picker-card {
                transition: none;
            }
        }
        `,
    ],
})
export class CollabSpacePagesComponent {
    constructor(
        @Optional() @Inject(DomSanitizer) private readonly sanitizer?: DomSanitizer,
        @Optional() @Inject(MJConfirmService) private readonly confirmService?: MJConfirmService,
    ) {}

    @Input() Pages: CollabPageModel[] = [];
    @Input() ActivePageId = '';
    @Input() BuiltInTabId = '';
    @Input() ShowPageTabs = false;
    @Input() LibraryRows: LibraryRowModel[] = [];
    @Input() SpaceMembers: SpaceMemberModel[] = [];
    @Input() CurrentUserName = 'Member';
    @Input() CurrentUserInitials = 'ME';
    @Input() CanWrite = false;
    @Input() CanCollaborate = false;
    @Input() CanSeeTeam = false;
    @Input() IsReadOnly = false;
    @Input() IsSaving = false;
    @Input() ErrorMessage = '';
    @Input() SaveError = '';
    @Input() DefaultBand: SpaceBand = 'Shared';
    @Input() SharedLabel = 'Shared';
    @Input() TeamLabel = 'Team';

    @Input()
    public get IsCustomizing(): boolean {
        return this.isCustomizing;
    }
    public set IsCustomizing(value: boolean) {
        const next = Boolean(value);
        if (next && !this.isCustomizing) {
            this.captureEditSnapshot();
        }
        this.isCustomizing = next;
    }
    @Output() IsCustomizingChange = new EventEmitter<boolean>();

    @Input() SpaceId = '';
    @Input() SpaceTypeCode = '*';
    @Input() ContributedCards: readonly SpaceOverviewCardDescriptor[] = [];
    @Input() BlockContext: SpacePageBlockContext | null = null;

    @ViewChild('aboutProjectedTpl', { static: true }) public aboutProjectedTpl?: TemplateRef<unknown>;
    @ViewChild('mainProjectedTpl', { static: true }) public mainProjectedTpl?: TemplateRef<unknown>;

    @Output() PageSelectRequested = new EventEmitter<string>();
    @Output() PageSaveRequested = new EventEmitter<CollabPageModel>();
    @Output() PageDeleteRequested = new EventEmitter<CollabPageModel>();
    @Output() PageReorderRequested = new EventEmitter<CollabPageModel[]>();
    @Output() PromotePageRequested = new EventEmitter<CollabPageModel>();
    @Output() OpenLibraryFileRequested = new EventEmitter<string>();

    public readonly blockOptions = COLLAB_BLOCK_OPTIONS;
    public readonly pageIcons = COLLAB_PAGE_ICONS;

    public isCustomizing = false;
    public editSessionDirty = false;
    private editSessionSnapshot: CollabPageModel | null = null;
    public commentsExpanded = false;
    public editingIntro = false;
    public introTitleDraft = '';
    public introSummaryDraft = '';
    public introBodyDraft = '';

    public blockPickerOpen = false;
    public pendingInsertIndex: number | null = null;
    public pendingInsertZone: 'full' | 'main' | 'side' | undefined = undefined;
    public editingBlock: CollabPageBlock | null = null;

    public pageSettingsOpen = false;
    public pageFormMode: 'create' | 'edit' = 'create';
    public pageFormDraft: {
        title: string;
        summary: string;
        pageType: CollabPageType;
        iconClass: string;
        band: SpaceBand;
        collaborative: boolean;
    } | null = null;

    public reviewDiffOpen = false;
    public titleDiffSegments: DiffSegment[] = [];
    public bodyDiffSegments: DiffSegment[] = [];
    public diffSummary = { addedWords: 0, removedWords: 0 };

    public newCommentBody = '';
    public newCommentTeamOnly = false;

    public draggedBlockIndex: number | null = null;
    public dragOverBlockIndex: number | null = null;

    private openFaqs = new Set<string>();
    private safeUrlCache = new Map<string, SafeResourceUrl>();
    private cachedRegisteredBlocks: {
        spaceTypeCode: string;
        cards: readonly SpaceOverviewCardDescriptor[];
        blocks: SpacePageBlockDescriptor[];
    } | null = null;
    private cachedBlockContext: {
        base: SpacePageBlockContext | null;
        spaceId: string;
        spaceTypeCode: string;
        canSeeTeam: boolean;
        canWrite: boolean;
        isReadOnly: boolean;
        sharedLabel: string;
        teamLabel: string;
        cards: readonly SpaceOverviewCardDescriptor[];
        aboutTpl: TemplateRef<unknown> | null;
        mainTpl: TemplateRef<unknown> | null;
        value: SpacePageBlockContext;
    } | null = null;
    private cachedBlockInputs = new Map<
        string,
        {
            kind: SpacePageBlockDescriptor['kind'];
            spaceId: string;
            block: CollabPageBlock;
            readOnly: boolean;
            context: SpacePageBlockContext;
            sequence: number;
            inputs: Record<string, unknown>;
        }
    >();

    public get effectiveCanSeeTeam(): boolean {
        return this.CanSeeTeam || Boolean(this.BlockContext?.canSeeTeam);
    }

    public get resolvedSpaceId(): string {
        return this.SpaceId || this.BlockContext?.spaceId || '';
    }

    public get resolvedSpaceTypeCode(): string {
        return this.BlockContext?.spaceTypeCode || this.SpaceTypeCode || '*';
    }

    public get resolvedContributedCards(): readonly SpaceOverviewCardDescriptor[] {
        return this.BlockContext?.contributedCards ?? this.ContributedCards;
    }

    public get registeredBlocks(): SpacePageBlockDescriptor[] {
        const spaceTypeCode = this.resolvedSpaceTypeCode;
        const cards = this.resolvedContributedCards;
        if (
            this.cachedRegisteredBlocks &&
            this.cachedRegisteredBlocks.spaceTypeCode === spaceTypeCode &&
            this.cachedRegisteredBlocks.cards === cards
        ) {
            return this.cachedRegisteredBlocks.blocks;
        }
        const blocks = assembleSpacePageBlocks(spaceTypeCode, cards);
        this.cachedRegisteredBlocks = { spaceTypeCode, cards, blocks };
        return blocks;
    }

    public get resolvedBlockContext(): SpacePageBlockContext {
        const base = this.BlockContext;
        const spaceId = this.resolvedSpaceId;
        const spaceTypeCode = this.resolvedSpaceTypeCode;
        const canSeeTeam = this.effectiveCanSeeTeam;
        const canWrite = !this.IsReadOnly && this.CanWrite;
        const isReadOnly = this.IsReadOnly;
        const sharedLabel = base?.sharedLabel ?? this.SharedLabel;
        const teamLabel = base?.teamLabel ?? this.TeamLabel;
        const cards = this.resolvedContributedCards;
        const aboutTpl = base?.aboutTemplate ?? this.aboutProjectedTpl ?? null;
        const mainTpl = base?.mainViewTemplate ?? this.mainProjectedTpl ?? null;
        const cached = this.cachedBlockContext;
        if (
            cached &&
            cached.base === base &&
            cached.spaceId === spaceId &&
            cached.spaceTypeCode === spaceTypeCode &&
            cached.canSeeTeam === canSeeTeam &&
            cached.canWrite === canWrite &&
            cached.isReadOnly === isReadOnly &&
            cached.sharedLabel === sharedLabel &&
            cached.teamLabel === teamLabel &&
            cached.cards === cards &&
            cached.aboutTpl === aboutTpl &&
            cached.mainTpl === mainTpl
        ) {
            return cached.value;
        }
        const value: SpacePageBlockContext = {
            ...(base ?? {}),
            spaceId,
            spaceTypeCode,
            canSeeTeam,
            canWrite,
            isReadOnly,
            sharedLabel,
            teamLabel,
            contributedCards: cards,
            aboutTemplate: aboutTpl,
            mainViewTemplate: mainTpl,
        };
        this.cachedBlockContext = {
            base,
            spaceId,
            spaceTypeCode,
            canSeeTeam,
            canWrite,
            isReadOnly,
            sharedLabel,
            teamLabel,
            cards,
            aboutTpl,
            mainTpl,
            value,
        };
        return value;
    }

    public get visiblePages(): CollabPageModel[] {
        return this.Pages.filter((p) => p.band === 'Shared' || this.effectiveCanSeeTeam);
    }

    public get activePage(): CollabPageModel | null {
        const list = this.visiblePages;
        if (list.length === 0) return null;
        if (this.BuiltInTabId) {
            const builtIn = list.find((p) => p.builtInTabId === this.BuiltInTabId);
            if (builtIn) return builtIn;
        }
        if (this.ActivePageId) {
            const match = list.find((p) => p.id === this.ActivePageId);
            if (match) return match;
        }
        return list[0];
    }

    public isOverviewLayout(page: CollabPageModel | null | undefined): boolean {
        return page?.builtInTabId === 'Overview';
    }

    public isWorkspaceTabLayout(page: CollabPageModel | null | undefined): boolean {
        return Boolean(page?.builtInTabId && page.builtInTabId !== 'Overview');
    }

    public isMainViewBlock(type: CollabPageBlockType): boolean {
        return normalizeContributionKey(type) === 'collab:main-view';
    }

    public hasMainViewBlock(page: CollabPageModel): boolean {
        return page.blocks.some((b) => this.isMainViewBlock(b.type));
    }

    public overviewZoneFor(block: CollabPageBlock): 'full' | 'main' | 'side' {
        if (block.width === 'full') return 'full';
        if (block.width === 'side') return 'side';
        if (block.width === 'main') return 'main';
        const reg = this.registeredBlockFor(block.type);
        return reg ? reg.defaultZone : 'main';
    }

    public overviewBlocksForZone(
        page: CollabPageModel,
        zone: 'full' | 'main' | 'side',
    ): { block: CollabPageBlock; idx: number }[] {
        const entries: { block: CollabPageBlock; idx: number }[] = [];
        page.blocks.forEach((block, idx) => {
            if (this.shouldRenderBlock(block) && this.overviewZoneFor(block) === zone) {
                entries.push({ block, idx });
            }
        });
        return entries;
    }

    public isCommentsOpen(page: CollabPageModel): boolean {
        if (!page.builtInTabId) return true;
        return this.commentsExpanded || this.visibleComments(page).length > 0;
    }

    public selectPage(pageId: string): void {
        this.editingIntro = false;
        this.ActivePageId = pageId;
        this.PageSelectRequested.emit(pageId);
    }

    public setCustomizing(val: boolean): void {
        if (val && !this.isCustomizing) {
            this.captureEditSnapshot();
        }
        this.isCustomizing = val;
        this.IsCustomizingChange.emit(this.isCustomizing);
    }

    public toggleCustomizeMode(): void {
        this.setCustomizing(!this.isCustomizing);
    }

    private captureEditSnapshot(): void {
        const current = this.activePage;
        this.editSessionSnapshot = current ? structuredClone(current) : null;
        this.editSessionDirty = false;
    }

    public hasUnsavedEditChanges(page: CollabPageModel): boolean {
        if (this.editSessionDirty || this.editingIntro || this.hasUnpublishedDraft(page)) {
            return true;
        }
        if (this.editSessionSnapshot && this.editSessionSnapshot.id === page.id) {
            return (
                this.editSessionSnapshot.title !== page.title ||
                this.editSessionSnapshot.summary !== page.summary ||
                this.editSessionSnapshot.body !== page.body ||
                JSON.stringify(this.editSessionSnapshot.blocks) !== JSON.stringify(page.blocks)
            );
        }
        return false;
    }

    public publishChanges(page: CollabPageModel): void {
        const nextTitle = this.editingIntro
            ? this.introTitleDraft.trim() || page.title
            : (page.draftTitle ?? page.title).trim() || page.title;
        const nextSummary = this.editingIntro ? this.introSummaryDraft.trim() : page.summary;
        const nextBody = this.editingIntro ? this.introBodyDraft : page.draftBody ?? page.body;
        const updated: CollabPageModel = {
            ...page,
            title: nextTitle,
            summary: nextSummary,
            body: nextBody,
            draftTitle: null,
            draftBody: null,
            status: 'Published',
        };
        this.editingIntro = false;
        this.reviewDiffOpen = false;
        this.editSessionSnapshot = null;
        this.editSessionDirty = false;
        this.PageSaveRequested.emit(updated);
        this.setCustomizing(false);
    }

    public async discardChanges(page: CollabPageModel): Promise<void> {
        const hasChanges = this.hasUnsavedEditChanges(page);
        if (hasChanges && this.confirmService) {
            const confirmed = await this.confirmService.Confirm({
                title: 'Discard changes?',
                message: 'Your unsaved changes to this page will be lost.',
                confirmText: 'Discard',
                cancelText: 'Keep editing',
                type: 'warning',
            });
            if (!confirmed) {
                return;
            }
        }
        const snapshot = this.editSessionSnapshot && this.editSessionSnapshot.id === page.id ? this.editSessionSnapshot : null;
        if (snapshot || this.hasUnpublishedDraft(page)) {
            const base = snapshot ?? page;
            const restored: CollabPageModel = {
                ...base,
                draftTitle: null,
                draftBody: null,
                status: 'Published',
            };
            this.PageSaveRequested.emit(restored);
        }
        this.editingIntro = false;
        this.reviewDiffOpen = false;
        this.editSessionSnapshot = null;
        this.editSessionDirty = false;
        this.setCustomizing(false);
    }

    /**
     * Only authorized space page admins (`CanWrite`) can customize page layout,
     * add/edit/remove blocks, edit page intros, or publish page changes.
     */
    public canEditPage(_page: CollabPageModel): boolean {
        return !this.IsReadOnly && this.CanWrite;
    }

    /**
     * Contributors can participate in interactive page elements (e.g. checking off
     * collaborative checklists or posting questions/comments) when `page.collaborative` is true.
     */
    public canParticipateInPage(page: CollabPageModel): boolean {
        return !this.IsReadOnly && (this.CanWrite || (this.CanCollaborate && page.collaborative));
    }

    public hasUnpublishedDraft(page: CollabPageModel): boolean {
        return HasTextChange(page.title, page.draftTitle ?? page.title) || HasTextChange(page.body, page.draftBody ?? page.body);
    }

    public displayBody(page: CollabPageModel): string {
        return (page.draftBody ?? page.body ?? '').trim();
    }

    public splitParagraphs(text: string): string[] {
        return text
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean);
    }

    public startIntroEdit(page: CollabPageModel): void {
        if (!this.canEditPage(page)) return;
        this.introTitleDraft = page.draftTitle || page.title;
        this.introSummaryDraft = page.summary || '';
        this.introBodyDraft = page.draftBody ?? page.body ?? '';
        this.editingIntro = true;
    }

    public cancelIntroEdit(): void {
        this.editingIntro = false;
    }

    public saveIntroDraft(page: CollabPageModel): void {
        const updated: CollabPageModel = {
            ...page,
            summary: this.introSummaryDraft.trim(),
            draftTitle: this.introTitleDraft.trim() || page.title,
            draftBody: this.introBodyDraft,
            status: 'Draft',
        };
        this.editingIntro = false;
        this.editSessionDirty = true;
        this.PageSaveRequested.emit(updated);
    }

    public publishIntroNow(page: CollabPageModel): void {
        const updated: CollabPageModel = {
            ...page,
            title: this.introTitleDraft.trim() || page.title,
            summary: this.introSummaryDraft.trim(),
            body: this.introBodyDraft,
            draftTitle: null,
            draftBody: null,
            status: 'Published',
        };
        this.editingIntro = false;
        this.editSessionDirty = false;
        this.PageSaveRequested.emit(updated);
    }

    public openReviewDiff(page: CollabPageModel): void {
        const nextTitle = page.draftTitle ?? page.title;
        const nextBody = page.draftBody ?? page.body;
        this.titleDiffSegments = HasTextChange(page.title, nextTitle) ? DiffWords(page.title, nextTitle) : [];
        this.bodyDiffSegments = DiffWords(page.body, nextBody);
        this.diffSummary = SummarizeDiff([...this.titleDiffSegments, ...this.bodyDiffSegments]);
        this.reviewDiffOpen = true;
    }

    public closeReviewDiff(): void {
        this.reviewDiffOpen = false;
    }

    public confirmPublishDraft(page: CollabPageModel): void {
        const updated: CollabPageModel = {
            ...page,
            title: (page.draftTitle ?? page.title).trim() || page.title,
            body: page.draftBody ?? page.body,
            draftTitle: null,
            draftBody: null,
            status: 'Published',
        };
        this.reviewDiffOpen = false;
        this.editSessionDirty = false;
        this.PageSaveRequested.emit(updated);
    }

    public discardDraft(page: CollabPageModel): void {
        const updated: CollabPageModel = {
            ...page,
            draftTitle: null,
            draftBody: null,
            status: 'Published',
        };
        this.reviewDiffOpen = false;
        this.editSessionDirty = false;
        this.PageSaveRequested.emit(updated);
    }

    // ── Block Picker & Block Editor ───────────────────────────────────────────

    public isWidgetBlock(type: CollabPageBlockType): boolean {
        return !STATIC_CONTENT_BLOCK_TYPES.has(type);
    }

    public registeredBlockFor(type: CollabPageBlockType): SpacePageBlockDescriptor | null {
        if (STATIC_CONTENT_BLOCK_TYPES.has(type)) return null;
        const normalized = normalizeContributionKey(type);
        return this.registeredBlocks.find((b) => normalizeContributionKey(b.key) === normalized) ?? null;
    }

    public blockTypeLabel(type: CollabPageBlockType): string {
        return (
            this.blockOptions.find((o) => o.type === type)?.label ??
            this.registeredBlockFor(type)?.label ??
            type.replace(/^collab:/, '')
        );
    }

    public isRegisteredBlockActive(_block: CollabPageBlock, reg: SpacePageBlockDescriptor): boolean {
        if (reg.side === 'Team' && !this.effectiveCanSeeTeam) {
            return false;
        }
        return reg.isActive ? reg.isActive(this.resolvedBlockContext) : true;
    }

    public registeredBlockInputs(block: CollabPageBlock, reg: SpacePageBlockDescriptor): Record<string, unknown> {
        const key = `${block.id}:${reg.key}`;
        const spaceId = this.resolvedSpaceId;
        const readOnly = this.IsReadOnly || !this.CanWrite;
        const context = this.resolvedBlockContext;
        const sequence = reg.sortKey;
        const cached = this.cachedBlockInputs.get(key);
        if (
            cached &&
            cached.kind === reg.kind &&
            cached.spaceId === spaceId &&
            cached.block === block &&
            cached.readOnly === readOnly &&
            cached.context === context &&
            cached.sequence === sequence
        ) {
            return cached.inputs;
        }
        const inputs: Record<string, unknown> =
            reg.kind === 'card'
                ? {
                      SpaceId: spaceId,
                      Sequence: sequence,
                  }
                : {
                      SpaceId: spaceId,
                      Config: block,
                      ReadOnly: readOnly,
                      Context: context,
                  };
        this.cachedBlockInputs.set(key, {
            kind: reg.kind,
            spaceId,
            block,
            readOnly,
            context,
            sequence,
            inputs,
        });
        return inputs;
    }

    public shouldRenderBlock(block: CollabPageBlock): boolean {
        if (!this.isWidgetBlock(block.type)) return true;
        const reg = this.registeredBlockFor(block.type);
        if (!reg) {
            return this.isCustomizing && this.CanWrite && !this.IsReadOnly;
        }
        if (reg.side === 'Team' && !this.effectiveCanSeeTeam) {
            return false;
        }
        if (this.isCustomizing && this.CanWrite && !this.IsReadOnly) {
            return true;
        }
        return this.isRegisteredBlockActive(block, reg);
    }

    public availableWidgetBlockOptions(page: CollabPageModel): CollabBlockOption[] {
        const existingKeys = new Set<string>(page.blocks.map((b) => normalizeContributionKey(b.type)));
        return this.registeredBlocks
            .filter((reg) => {
                if (reg.side === 'Team' && !this.effectiveCanSeeTeam) return false;
                if (reg.key === 'collab:main-view' && !this.isWorkspaceTabLayout(page)) return false;
                if (existingKeys.has(normalizeContributionKey(reg.key))) return false;
                return true;
            })
            .map((reg) => ({
                type: reg.key,
                label: reg.label,
                icon: reg.icon,
                hint: reg.description || reg.label,
            }));
    }

    public blockWidthLabel(page: CollabPageModel, block: CollabPageBlock): string {
        if (this.isOverviewLayout(page)) {
            const zone = this.overviewZoneFor(block);
            if (zone === 'main') return 'Main';
            if (zone === 'side') return 'Side';
            return 'Full';
        }
        return block.width === 'half' ? 'Half' : 'Full';
    }

    public blockWidthIcon(page: CollabPageModel, block: CollabPageBlock): string {
        if (this.isOverviewLayout(page)) {
            const zone = this.overviewZoneFor(block);
            if (zone === 'main') return 'fa-table-columns';
            if (zone === 'side') return 'fa-columns';
            return 'fa-arrows-left-right';
        }
        return block.width === 'half' ? 'fa-table-columns' : 'fa-arrows-left-right';
    }

    public blockWidthHint(page: CollabPageModel, block: CollabPageBlock): string {
        if (this.isOverviewLayout(page)) {
            const zone = this.overviewZoneFor(block);
            if (zone === 'main') return 'Move to right column';
            if (zone === 'side') return 'Expand to full width';
            return 'Move to main column';
        }
        return block.width === 'half' ? 'Switch to full width' : 'Switch to half width';
    }

    public setBlockColumn(page: CollabPageModel, index: number, width: CollabBlockWidth): void {
        const current = page.blocks[index];
        if (!current) return;
        const blocks = page.blocks.map((b, i) => (i === index ? { ...b, width } : b));
        this.editSessionDirty = true;
        this.PageSaveRequested.emit({ ...page, blocks });
    }

    public toggleBlockWidth(page: CollabPageModel, index: number): void {
        const current = page.blocks[index];
        if (!current) return;
        let nextWidth: CollabBlockWidth;
        if (this.isOverviewLayout(page)) {
            const zone = this.overviewZoneFor(current);
            nextWidth = zone === 'main' ? 'side' : zone === 'side' ? 'full' : 'main';
        } else {
            nextWidth = current.width === 'half' ? 'full' : 'half';
        }
        this.setBlockColumn(page, index, nextWidth);
    }

    public openBlockPicker(insertIndex: number | null, zone?: 'full' | 'main' | 'side'): void {
        this.pendingInsertIndex = insertIndex;
        this.pendingInsertZone = zone;
        this.blockPickerOpen = true;
    }

    public closeBlockPicker(): void {
        this.blockPickerOpen = false;
        this.pendingInsertIndex = null;
        this.pendingInsertZone = undefined;
    }

    public chooseBlockType(page: CollabPageModel, type: CollabPageBlockType): void {
        const newBlock = this.createDefaultBlock(type);
        if (this.isOverviewLayout(page)) {
            newBlock.width = this.pendingInsertZone ?? this.overviewZoneFor(newBlock);
        }
        const blocks = [...page.blocks];
        const idx = this.pendingInsertIndex !== null ? this.pendingInsertIndex : blocks.length;
        blocks.splice(idx, 0, newBlock);
        this.closeBlockPicker();
        const updated: CollabPageModel = { ...page, blocks };
        this.editSessionDirty = true;
        this.PageSaveRequested.emit(updated);
        if (!this.isWidgetBlock(type)) {
            this.openBlockEditor(newBlock);
        }
    }

    public openBlockEditor(block: CollabPageBlock): void {
        this.editingBlock = structuredClone(block);
    }

    public closeBlockEditor(): void {
        this.editingBlock = null;
    }

    public saveBlockEdit(page: CollabPageModel): void {
        if (!this.editingBlock) return;
        const edited = this.editingBlock;
        const blocks = page.blocks.map((b) => (b.id === edited.id ? edited : b));
        this.editingBlock = null;
        this.editSessionDirty = true;
        this.PageSaveRequested.emit({ ...page, blocks });
    }

    public canMoveBlock(page: CollabPageModel, index: number, delta: -1 | 1): boolean {
        const current = page.blocks[index];
        if (!current) return false;
        if (this.isOverviewLayout(page)) {
            const zone = this.overviewZoneFor(current);
            const zoneIndices = this.overviewBlocksForZone(page, zone).map((e) => e.idx);
            const pos = zoneIndices.indexOf(index);
            if (pos < 0) return false;
            const targetPos = pos + delta;
            return targetPos >= 0 && targetPos < zoneIndices.length;
        }
        const target = index + delta;
        return target >= 0 && target < page.blocks.length;
    }

    public moveBlock(page: CollabPageModel, index: number, delta: -1 | 1): void {
        if (this.isOverviewLayout(page)) {
            const current = page.blocks[index];
            if (!current) return;
            const zone = this.overviewZoneFor(current);
            const zoneIndices = this.overviewBlocksForZone(page, zone).map((e) => e.idx);
            const pos = zoneIndices.indexOf(index);
            const targetPos = pos + delta;
            if (pos < 0 || targetPos < 0 || targetPos >= zoneIndices.length) return;
            const targetIndex = zoneIndices[targetPos];
            const blocks = [...page.blocks];
            const temp = blocks[index];
            blocks[index] = blocks[targetIndex];
            blocks[targetIndex] = temp;
            this.editSessionDirty = true;
            this.PageSaveRequested.emit({ ...page, blocks });
            return;
        }
        const target = index + delta;
        if (target < 0 || target >= page.blocks.length) return;
        const blocks = [...page.blocks];
        const [moved] = blocks.splice(index, 1);
        blocks.splice(target, 0, moved);
        this.editSessionDirty = true;
        this.PageSaveRequested.emit({ ...page, blocks });
    }

    public duplicateBlock(page: CollabPageModel, index: number): void {
        const copy: CollabPageBlock = {
            ...structuredClone(page.blocks[index]),
            id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
        const blocks = [...page.blocks];
        blocks.splice(index + 1, 0, copy);
        this.editSessionDirty = true;
        this.PageSaveRequested.emit({ ...page, blocks });
    }

    public deleteBlock(page: CollabPageModel, index: number): Promise<void> | void {
        const target = page.blocks[index];
        if (!target) return;
        if (this.confirmService) {
            return this.confirmAndDeleteBlock(page, index, target);
        }
        this.performDeleteBlock(page, index);
    }

    private async confirmAndDeleteBlock(page: CollabPageModel, index: number, target: CollabPageBlock): Promise<void> {
        if (!this.confirmService) return;
        const label = target.title || this.blockTypeLabel(target.type);
        const confirmed = await this.confirmService.Confirm({
            title: 'Remove block?',
            message: `Remove "${label}" from this page?`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            type: 'warning',
        });
        if (!confirmed) return;
        this.performDeleteBlock(page, index);
    }

    private performDeleteBlock(page: CollabPageModel, index: number): void {
        const blocks = page.blocks.filter((_, i) => i !== index);
        this.editSessionDirty = true;
        this.PageSaveRequested.emit({ ...page, blocks });
    }

    public onBlockDragStart(index: number, event: DragEvent): void {
        this.draggedBlockIndex = index;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
        }
    }

    public onBlockDragOver(index: number, event: DragEvent): void {
        if (this.draggedBlockIndex === null) return;
        event.preventDefault();
        this.dragOverBlockIndex = index;
    }

    public onBlockDrop(page: CollabPageModel, dropIndex: number, event: DragEvent): void {
        event.preventDefault();
        const from = this.draggedBlockIndex;
        this.draggedBlockIndex = null;
        this.dragOverBlockIndex = null;
        if (from === null || from === dropIndex) return;
        const blocks = [...page.blocks];
        const targetBlock = blocks[dropIndex];
        const [moved] = blocks.splice(from, 1);
        if (this.isOverviewLayout(page) && targetBlock) {
            moved.width = this.overviewZoneFor(targetBlock);
        }
        blocks.splice(dropIndex, 0, moved);
        this.editSessionDirty = true;
        this.PageSaveRequested.emit({ ...page, blocks });
    }

    public onBlockDragEnd(): void {
        this.draggedBlockIndex = null;
        this.dragOverBlockIndex = null;
    }

    // ── Block Helpers ─────────────────────────────────────────────────────────

    public calloutIcon(variant?: CollabCalloutVariant): string {
        switch (variant) {
            case 'success': return 'fa-solid fa-circle-check';
            case 'warning': return 'fa-solid fa-triangle-exclamation';
            case 'danger': return 'fa-solid fa-circle-exclamation';
            default: return 'fa-solid fa-circle-info';
        }
    }

    public initialsFor(name: string): string {
        return (name || 'M')
            .split(' ')
            .filter(Boolean)
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    }

    public resolvedResources(block: CollabPageBlock): LibraryRowModel[] {
        const ids = new Set((block.resourceIds || []).map((id) => id.toLowerCase()));
        return this.LibraryRows.filter((r) => ids.has(r.id.toLowerCase()) || (r.fileId && ids.has(r.fileId.toLowerCase())));
    }

    public isResourceSelected(id: string): boolean {
        return (this.editingBlock?.resourceIds || []).some((r) => r.toLowerCase() === id.toLowerCase());
    }

    public toggleResourceSelection(id: string): void {
        if (!this.editingBlock) return;
        const current = this.editingBlock.resourceIds || [];
        if (this.isResourceSelected(id)) {
            this.editingBlock.resourceIds = current.filter((r) => r.toLowerCase() !== id.toLowerCase());
        } else {
            this.editingBlock.resourceIds = [...current, id];
        }
    }

    public checklistDoneCount(block: CollabPageBlock): number {
        return (block.checklist || []).filter((i) => i.done).length;
    }

    public checklistProgress(block: CollabPageBlock): number {
        const items = block.checklist || [];
        if (items.length === 0) return 0;
        return Math.round((this.checklistDoneCount(block) / items.length) * 100);
    }

    public toggleChecklistItem(page: CollabPageModel, block: CollabPageBlock, item: CollabChecklistItem): void {
        const blocks = page.blocks.map((b) => {
            if (b.id !== block.id) return b;
            return {
                ...b,
                checklist: (b.checklist || []).map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)),
            };
        });
        this.PageSaveRequested.emit({ ...page, blocks });
    }

    public isFaqOpen(blockId: string, index: number): boolean {
        return this.openFaqs.has(`${blockId}:${index}`);
    }

    public toggleFaq(blockId: string, index: number): void {
        const key = `${blockId}:${index}`;
        if (this.openFaqs.has(key)) this.openFaqs.delete(key);
        else this.openFaqs.add(key);
    }

    public isEmbeddableVideo(url: string): boolean {
        return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
    }

    public safeVideoUrl(url: string): SafeResourceUrl {
        const cached = this.safeUrlCache.get(url);
        if (cached) return cached;
        let embed = url;
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
        if (ytMatch) embed = `https://www.youtube.com/embed/${ytMatch[1]}`;
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) embed = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        const safe = this.sanitizer ? this.sanitizer.bypassSecurityTrustResourceUrl(embed) : (embed as unknown as SafeResourceUrl);
        this.safeUrlCache.set(url, safe);
        return safe;
    }

    public addBulletItem(): void {
        if (!this.editingBlock) return;
        this.editingBlock.items = [...(this.editingBlock.items || []), 'New item'];
    }

    public addChecklistItem(): void {
        if (!this.editingBlock) return;
        this.editingBlock.checklist = [
            ...(this.editingBlock.checklist || []),
            { id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, text: 'New action item', done: false },
        ];
    }

    public addFactPair(): void {
        if (!this.editingBlock) return;
        this.editingBlock.pairs = [...(this.editingBlock.pairs || []), { label: 'Label', value: 'Value' }];
    }

    public addContactPerson(): void {
        if (!this.editingBlock) return;
        this.editingBlock.people = [...(this.editingBlock.people || []), { name: '', role: '', email: '' }];
    }

    public addMemberAsContact(member: SpaceMemberModel): void {
        if (!this.editingBlock) return;
        this.editingBlock.people = [
            ...(this.editingBlock.people || []),
            { name: member.name, role: member.roleName, email: member.email || '' },
        ];
    }

    public addLinkItem(): void {
        if (!this.editingBlock) return;
        this.editingBlock.links = [...(this.editingBlock.links || []), { label: 'Open Resource', url: 'https://' }];
    }

    public addFaqItem(): void {
        if (!this.editingBlock) return;
        this.editingBlock.faqs = [...(this.editingBlock.faqs || []), { q: 'New question?', a: 'Answer here.' }];
    }

    public onTableHeadersInput(value: string): void {
        if (!this.editingBlock) return;
        this.editingBlock.headers = value.split(',').map((s) => s.trim()).filter(Boolean);
    }

    public tableRowsToText(rows: string[][]): string {
        return rows.map((r) => r.join(' | ')).join('\n');
    }

    public onTableRowsInput(value: string): void {
        if (!this.editingBlock) return;
        this.editingBlock.rows = value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => line.split('|').map((c) => c.trim()));
    }

    // ── Page Settings & Creation ──────────────────────────────────────────────

    public openNewPageModal(): void {
        this.pageFormMode = 'create';
        this.pageFormDraft = {
            title: '',
            summary: '',
            pageType: 'Guide',
            iconClass: 'fa-solid fa-book-open',
            band: this.DefaultBand,
            collaborative: true,
        };
        this.pageSettingsOpen = true;
    }

    public openPageSettings(page: CollabPageModel): void {
        this.pageFormMode = 'edit';
        this.pageFormDraft = {
            title: page.title,
            summary: page.summary,
            pageType: page.pageType,
            iconClass: page.iconClass,
            band: page.band,
            collaborative: page.collaborative,
        };
        this.pageSettingsOpen = true;
    }

    public closePageSettings(): void {
        this.pageSettingsOpen = false;
        this.pageFormDraft = null;
    }

    public submitPageSettings(): void {
        if (!this.pageFormDraft || !this.pageFormDraft.title.trim()) return;
        if (this.pageFormMode === 'create') {
            const newPage: CollabPageModel = {
                id: '',
                title: this.pageFormDraft.title.trim(),
                summary: this.pageFormDraft.summary.trim(),
                pageType: this.pageFormDraft.pageType,
                iconClass: this.pageFormDraft.iconClass,
                band: this.pageFormDraft.band,
                status: 'Published',
                sequence: this.Pages.length,
                collaborative: this.pageFormDraft.collaborative,
                body: '',
                blocks: this.defaultBlocksForTemplate(this.pageFormDraft.pageType),
                comments: [],
                updatedLabel: 'Just now',
                authorName: this.CurrentUserName,
            };
            this.closePageSettings();
            this.setCustomizing(true);
            this.PageSaveRequested.emit(newPage);
        } else if (this.activePage) {
            const updated: CollabPageModel = {
                ...this.activePage,
                title: this.pageFormDraft.title.trim(),
                summary: this.pageFormDraft.summary.trim(),
                pageType: this.pageFormDraft.pageType,
                iconClass: this.pageFormDraft.iconClass,
                band: this.pageFormDraft.band,
                collaborative: this.pageFormDraft.collaborative,
            };
            this.closePageSettings();
            this.PageSaveRequested.emit(updated);
        }
    }

    public deletePage(page: CollabPageModel): void {
        this.closePageSettings();
        this.PageDeleteRequested.emit(page);
    }

    public movePage(page: CollabPageModel, delta: -1 | 1, event: Event): void {
        event.stopPropagation();
        const list = [...this.visiblePages];
        const idx = list.findIndex((p) => p.id === page.id);
        const target = idx + delta;
        if (idx < 0 || target < 0 || target >= list.length) return;
        const [moved] = list.splice(idx, 1);
        list.splice(target, 0, moved);
        const reordered = list.map((p, i) => ({ ...p, sequence: i }));
        this.PageReorderRequested.emit(reordered);
    }

    // ── Comments / Questions ──────────────────────────────────────────────────

    public visibleComments(page: CollabPageModel): CollabPageComment[] {
        return (page.comments || []).filter((c) => c.band === 'Shared' || this.CanSeeTeam);
    }

    public topLevelComments(page: CollabPageModel): CollabPageComment[] {
        return this.visibleComments(page).filter((c) => !c.parentId);
    }

    public submitComment(page: CollabPageModel): void {
        const body = this.newCommentBody.trim();
        if (!body) return;
        const comment: CollabPageComment = {
            id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            authorName: this.CurrentUserName,
            authorInitials: this.CurrentUserInitials,
            band: this.CanSeeTeam && this.newCommentTeamOnly ? 'Team' : page.band,
            body,
            createdAtLabel: 'Just now',
            status: 'Open',
        };
        this.newCommentBody = '';
        this.newCommentTeamOnly = false;
        this.PageSaveRequested.emit({
            ...page,
            comments: [...(page.comments || []), comment],
        });
    }

    public toggleCommentResolved(page: CollabPageModel, comment: CollabPageComment): void {
        const comments = (page.comments || []).map((c) =>
            c.id === comment.id ? { ...c, status: (c.status === 'Resolved' ? 'Open' : 'Resolved') as 'Open' | 'Resolved' } : c,
        );
        this.PageSaveRequested.emit({ ...page, comments });
    }

    @HostListener('document:keydown.escape')
    public onEscape(): void {
        if (this.editingBlock) this.closeBlockEditor();
        else if (this.blockPickerOpen) this.closeBlockPicker();
        else if (this.pageSettingsOpen) this.closePageSettings();
        else if (this.reviewDiffOpen) this.closeReviewDiff();
    }

    private createDefaultBlock(type: CollabPageBlockType): CollabPageBlock {
        const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        switch (type) {
            case 'Heading':
                return { id, type, title: 'Section Heading', subtitle: 'Supporting context for this section', width: 'full' };
            case 'Text':
                return { id, type, title: 'Overview', body: 'Add your notes, guidelines, or narrative here.', width: 'full' };
            case 'Callout':
                return { id, type, title: 'Key Update', body: 'Highlight important milestones, deadlines, or announcements.', variant: 'info', width: 'full' };
            case 'Bullets':
                return { id, type, title: 'Key Takeaways', items: ['First priority item', 'Second priority item', 'Third priority item'], width: 'half' };
            case 'Checklist':
                return {
                    id,
                    type,
                    title: 'Action Checklist',
                    width: 'half',
                    checklist: [
                        { id: `${id}-1`, text: 'Review kickoff materials', done: true },
                        { id: `${id}-2`, text: 'Confirm key milestones and owners', done: false },
                    ],
                };
            case 'Facts':
                return {
                    id,
                    type,
                    title: 'Quick Facts',
                    width: 'half',
                    pairs: [
                        { label: 'Status', value: 'On Track' },
                        { label: 'Cadence', value: 'Weekly Sync' },
                    ],
                };
            case 'Contacts':
                return {
                    id,
                    type,
                    title: 'Key Contacts',
                    width: 'half',
                    people: this.SpaceMembers.slice(0, 2).map((m) => ({
                        name: m.name,
                        role: m.roleName,
                        email: m.email || '',
                    })),
                };
            case 'Resources':
                return {
                    id,
                    type,
                    title: 'Featured Documents',
                    width: 'half',
                    resourceIds: this.LibraryRows.slice(0, 3).map((r) => r.id),
                };
            case 'Links':
                return {
                    id,
                    type,
                    title: 'Quick Links',
                    width: 'half',
                    links: [{ label: 'Project Charter', url: 'https://', description: 'Reference documentation' }],
                };
            case 'Video':
                return { id, type, title: 'Walkthrough Video', url: '', caption: '', width: 'full' };
            case 'Image':
                return { id, type, title: 'Visual Diagram', url: '', alt: 'Diagram', caption: '', width: 'full' };
            case 'FAQ':
                return {
                    id,
                    type,
                    title: 'Frequently Asked Questions',
                    width: 'full',
                    faqs: [{ q: 'Where do we upload deliverables?', a: 'Use the Library tab or click Upload in the space header.' }],
                };
            case 'Table':
                return {
                    id,
                    type,
                    title: 'Milestone Schedule',
                    width: 'full',
                    headers: ['Milestone', 'Owner', 'Target', 'Status'],
                    rows: [
                        ['Kickoff & Alignment', 'Lead', 'Week 1', 'Complete'],
                        ['Working Draft Review', 'Team', 'Week 3', 'In Progress'],
                    ],
                };
            case 'Divider':
                return { id, type, title: '', width: 'full' };
            default: {
                const reg = this.registeredBlockFor(type);
                const width: CollabBlockWidth = reg ? reg.defaultZone : 'main';
                return { id, type, title: '', width };
            }
        }
    }

    private defaultBlocksForTemplate(pageType: CollabPageType): CollabPageBlock[] {
        switch (pageType) {
            case 'Onboarding':
                return [
                    this.createDefaultBlock('Callout'),
                    this.createDefaultBlock('Checklist'),
                    this.createDefaultBlock('Contacts'),
                ];
            case 'Roadmap':
                return [
                    this.createDefaultBlock('Facts'),
                    this.createDefaultBlock('Table'),
                    this.createDefaultBlock('Checklist'),
                ];
            case 'FAQ':
                return [
                    this.createDefaultBlock('FAQ'),
                    this.createDefaultBlock('Contacts'),
                ];
            case 'Guide':
                return [
                    this.createDefaultBlock('Callout'),
                    this.createDefaultBlock('Text'),
                    this.createDefaultBlock('Resources'),
                ];
            default:
                return [
                    this.createDefaultBlock('Callout'),
                    this.createDefaultBlock('Facts'),
                    this.createDefaultBlock('Checklist'),
                ];
        }
    }
}
