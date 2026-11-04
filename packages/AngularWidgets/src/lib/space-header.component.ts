import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  MJButtonDirective,
  MJClickableDirective,
  MJMenuComponent,
  MJMenuDividerComponent,
  MJMenuItemComponent,
  MJMenuTriggerDirective,
} from '@memberjunction/ng-ui-components';
import { CommonModule } from '@angular/common';
import { CollabTypeTileComponent } from './type-tile.component';
import { COLLAB_TOKENS_CSS } from './tokens';
import { BreadcrumbItem } from './types';
import { SubSpaceSummary } from './space-overview.component';

@Component({
  selector: 'mjc-space-header',
  standalone: true,
  imports: [
    CommonModule,
    CollabTypeTileComponent,
    MJButtonDirective,
    MJClickableDirective,
    MJMenuComponent,
    MJMenuDividerComponent,
    MJMenuItemComponent,
    MJMenuTriggerDirective,
  ],
  template: `
    <section
      class="space-head"
      [style.background-image]="BackgroundImageUrl ? 'linear-gradient(to bottom, color-mix(in srgb, var(--mj-bg-surface-card) 88%, transparent), var(--mj-bg-surface-card)), url(' + BackgroundImageUrl + ')' : null">

      <!-- Line 1: Breadcrumb trail ('All spaces' on root spaces, 'All spaces › Parent' on sub-spaces) -->
      <nav class="crumbs" aria-label="Breadcrumb" data-testid="space-header-breadcrumbs">
        @for (c of headerBreadcrumbs; track c.label; let last = $last) {
          <span
            class="crumb-link"
            data-testid="space-header-crumb"
            [mjClickable]="c.label"
            (click)="onCrumbClick(c)">{{ c.label }}</span>
          @if (!last) {
            <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
          }
        }
      </nav>

      <!-- Line 2: Type tile, title, star, type chip, non-Active status chip, subtitle, and right actions -->
      <div class="top">
        <div class="title-row">
          <button
            type="button"
            class="type-tile-btn"
            data-testid="space-header-tile-btn"
            title="All spaces"
            aria-label="All spaces"
            (click)="onAllSpacesClick()">
            <mjc-type-tile
              [IconClass]="TypeIconClass || 'fa-solid fa-compass'"
              [Color]="TypeColor || ''"
              [IsClosed]="Status === 'Closed'"
              Size="md">
            </mjc-type-tile>
          </button>

          <h1 class="h1">{{ Title }}</h1>

          @if (ShowStar) {
            <button
              type="button"
              class="star"
              [class.on]="IsStarred"
              [disabled]="StarBusy"
              [attr.aria-pressed]="IsStarred"
              [attr.aria-label]="IsStarred ? 'Unstar this space' : 'Star this space'"
              [title]="IsStarred ? 'Starred: in your favorites' : 'Star this space'"
              (click)="StarToggleRequested.emit()">
              <i [class]="IsStarred ? 'fa-solid fa-star' : 'fa-regular fa-star'" aria-hidden="true"></i>
            </button>
          }

          @if (TypeName) {
            <span class="chip type-chip" data-testid="space-header-type-chip">{{ TypeName }}</span>
          }

          @if (Status && Status !== 'Active') {
            <span class="chip status-chip">{{ Status }}</span>
          }

          @if (Subtitle) {
            <span class="sub-inline" data-testid="space-header-subtitle" [title]="Subtitle">{{ Subtitle }}</span>
          }

          <ng-content select="[chips]"></ng-content>
        </div>

        <div class="actions">
          <ng-content select="[actions]"></ng-content>

          @if (hasMoreMenu) {
            <button
              type="button"
              mjButton Variant="icon" Size="sm"
              class="more-menu-btn"
              data-testid="space-header-more-btn"
              aria-label="More actions"
              title="More actions"
              [mjMenuTriggerFor]="headerMoreMenu">
              <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
            </button>
            <ng-template #headerMoreMenu>
              <mj-menu AriaLabel="More actions" data-testid="space-header-more-menu">
                @if (CanInvite) {
                  <mj-menu-item
                    data-testid="header-menu-invite"
                    Icon="fa-solid fa-user-plus"
                    (Triggered)="InviteRequested.emit()">
                    Invite
                  </mj-menu-item>
                }
                @if (CanAddSubSpace) {
                  <mj-menu-item
                    data-testid="header-menu-new-subspace"
                    Icon="fa-solid fa-folder-plus"
                    (Triggered)="NewSubSpaceRequested.emit()">
                    New sub-space
                  </mj-menu-item>
                }
                @if (CanEditPages && CanEditCurrentPage) {
                  <mj-menu-item
                    data-testid="header-menu-edit-page"
                    Icon="fa-solid fa-pen"
                    (Triggered)="EditPageRequested.emit()">
                    Edit page
                  </mj-menu-item>
                }
                @if (CanEditPages) {
                  <mj-menu-item
                    data-testid="header-menu-new-page"
                    Icon="fa-solid fa-file-circle-plus"
                    (Triggered)="NewPageRequested.emit()">
                    New page
                  </mj-menu-item>
                }
                @if (CanConfigure) {
                  @if (CanInvite || CanAddSubSpace || CanEditPages) {
                    <mj-menu-divider></mj-menu-divider>
                  }
                  <mj-menu-item
                    data-testid="header-menu-settings"
                    Icon="fa-solid fa-sliders"
                    (Triggered)="SpaceSettingsRequested.emit()">
                    Space settings
                  </mj-menu-item>
                }
              </mj-menu>
            </ng-template>
          }
        </div>
      </div>

      <ng-content select="mjc-space-tabs"></ng-content>
      <ng-content select="[tabs]"></ng-content>
    </section>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: block;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family);
      font-feature-settings: var(--mjc-font-feature-settings);
      line-height: var(--mjc-line-height);
    }
    button {
      font-family: inherit;
      line-height: inherit;
    }
    .space-head {
      background: var(--mj-bg-surface);
      border-bottom: 1px solid var(--mj-border-default);
      padding: var(--mj-space-3) var(--mj-space-6);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-1-5);
    }
    .crumbs {
      display: inline-flex;
      align-items: center;
      gap: var(--mj-space-1-5);
      font-size: var(--mj-text-sm);
      color: var(--mj-text-muted);
      font-weight: var(--mj-font-medium);
      line-height: var(--mj-leading-tight);
    }
    .crumbs i {
      font-size: var(--mj-text-xs);
      color: var(--mj-text-disabled);
    }
    .crumb-link {
      cursor: pointer;
      color: var(--mj-text-muted);
      transition: color var(--mj-transition-fast);
    }
    .crumb-link:hover {
      color: var(--mj-brand-primary);
      text-decoration: underline;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mj-space-4);
      min-height: var(--mj-space-10);
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: var(--mj-space-2-5);
      flex: 1;
      min-width: 0;
    }
    .type-tile-btn {
      border: 0;
      padding: 0;
      margin: 0;
      background: transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      border-radius: var(--mj-radius-md);
      flex-shrink: 0;
      transition: opacity var(--mj-transition-fast);
    }
    .type-tile-btn:hover {
      opacity: 0.85;
    }
    .h1 {
      font-size: var(--mj-text-lg);
      font-weight: var(--mj-font-bold);
      letter-spacing: var(--mj-tracking-tight);
      margin: 0;
      color: var(--mj-text-primary);
      line-height: var(--mj-leading-tight);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
    .star {
      border: 0;
      background: transparent;
      cursor: pointer;
      font-size: var(--mj-text-sm);
      color: var(--mj-text-muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--mj-space-1);
      border-radius: var(--mj-radius-sm);
      flex-shrink: 0;
      transition: color var(--mj-transition-fast), background var(--mj-transition-fast);
    }
    .star:hover {
      background: var(--mj-bg-surface-hover);
      color: var(--mj-text-primary);
    }
    .star.on {
      color: var(--mj-status-warning);
    }
    .star:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--mj-space-1);
      height: var(--mj-space-5);
      padding: 0 var(--mj-space-2);
      border-radius: var(--mj-radius-full);
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-semibold);
      white-space: nowrap;
      border: 1px solid var(--mj-border-default);
      color: var(--mj-text-secondary);
      background: var(--mj-bg-surface-sunken);
      box-sizing: border-box;
      user-select: none;
      flex-shrink: 0;
    }
    .sub-inline {
      font-size: var(--mj-text-sm);
      color: var(--mj-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }
    .actions {
      margin-left: auto;
      display: flex;
      gap: var(--mj-space-2);
      align-items: center;
      flex-shrink: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .crumb-link,
      .type-tile-btn,
      .star {
        transition: none;
      }
    }
  `]
})
export class CollabSpaceHeaderComponent {
  @Input() Title = '';
  /** The star (B22): the space in MJ's User Favorites, offered to a signed-in viewer. */
  @Input() ShowStar = false;
  @Input() IsStarred = false;
  @Input() StarBusy = false;
  @Input() TypeName = '';
  @Input() TypeIconClass = '';
  @Input() TypeColor = '';
  @Input() Status: 'Active' | 'Closed' | string = 'Active';
  @Input() Subtitle = '';
  @Input() Breadcrumbs: BreadcrumbItem[] = [];
  @Input() BackgroundImageUrl: string | null = null;
  @Input() SubSpaces: SubSpaceSummary[] = [];
  @Input() CanInvite = false;
  @Input() CanAddSubSpace = false;
  @Input() CanEditPages = false;
  @Input() CanEditCurrentPage = true;
  @Input() CanConfigure = false;

  @Output() BreadcrumbSelectRequested = new EventEmitter<BreadcrumbItem>();
  @Output() StarToggleRequested = new EventEmitter<void>();
  @Output() SubSpaceSelectRequested = new EventEmitter<SubSpaceSummary>();
  @Output() InviteRequested = new EventEmitter<void>();
  @Output() NewSubSpaceRequested = new EventEmitter<void>();
  @Output() EditPageRequested = new EventEmitter<void>();
  @Output() NewPageRequested = new EventEmitter<void>();
  @Output() SpaceSettingsRequested = new EventEmitter<void>();

  /** True when the space sits under a parent space (`All spaces › Parent › Child`). */
  public get hasParentSpace(): boolean {
    return this.parentCrumb !== null;
  }

  /**
   * Breadcrumb trail rendered on every space:
   * - Top-level space: `['All spaces']`
   * - Sub-space: `['All spaces', 'Parent Space', ...]` (excludes the current space's own repeated title)
   */
  public get headerBreadcrumbs(): BreadcrumbItem[] {
    if (this.Breadcrumbs && this.Breadcrumbs.length > 1) {
      return this.Breadcrumbs.slice(0, -1).map((crumb, idx) =>
        idx === 0 && (crumb.label === 'Spaces' || crumb.label === 'All spaces')
          ? { ...crumb, label: 'All spaces' }
          : crumb,
      );
    }
    return [{ label: 'All spaces' }];
  }

  /** Breadcrumb trail ending at the parent space (excluding the current space's own repeated title). */
  public get parentBreadcrumbs(): BreadcrumbItem[] {
    if (!this.hasParentSpace) return [];
    return this.headerBreadcrumbs;
  }

  public get hasMoreMenu(): boolean {
    return (
      this.CanInvite ||
      this.CanAddSubSpace ||
      (this.CanEditPages && this.CanEditCurrentPage) ||
      this.CanEditPages ||
      this.CanConfigure
    );
  }

  public onCrumbClick(crumb: BreadcrumbItem): void {
    this.BreadcrumbSelectRequested.emit(crumb);
  }

  public onAllSpacesClick(): void {
    const firstCrumb = this.headerBreadcrumbs[0] ?? { label: 'All spaces' };
    this.BreadcrumbSelectRequested.emit(firstCrumb);
  }

  public onSubSpaceClick(sub: SubSpaceSummary): void {
    this.SubSpaceSelectRequested.emit(sub);
  }

  /** Immediate parent space breadcrumb when inside a nested child space (`All spaces > Parent > Child`). */
  public get parentCrumb(): BreadcrumbItem | null {
    if (!this.Breadcrumbs || this.Breadcrumbs.length < 3) return null;
    const candidate = this.Breadcrumbs[this.Breadcrumbs.length - 2];
    return candidate?.spaceId ? candidate : null;
  }

  get subtitleParts(): string[] {
    if (!this.Subtitle) return [];
    if (this.Subtitle.includes('·')) {
      return this.Subtitle.split('·').map(s => s.trim());
    }
    return [this.Subtitle];
  }
}
