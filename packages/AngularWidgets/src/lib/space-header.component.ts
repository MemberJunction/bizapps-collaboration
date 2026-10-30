import { Component, ElementRef, EventEmitter, HostListener, Inject, Input, Optional, Output } from '@angular/core';
import { MJButtonDirective, MJClickableDirective } from '@memberjunction/ng-ui-components';
import { CommonModule } from '@angular/common';
import { CollabTypeTileComponent } from './type-tile.component';
import { COLLAB_TOKENS_CSS } from './tokens';
import { BreadcrumbItem } from './types';
import { SubSpaceSummary } from './space-overview.component';

@Component({
  selector: 'mjc-space-header',
  standalone: true,
  imports: [CommonModule, CollabTypeTileComponent, MJButtonDirective, MJClickableDirective],
  template: `
    <section
      class="space-head"
      [style.background-image]="BackgroundImageUrl ? 'linear-gradient(to bottom, color-mix(in srgb, var(--mj-bg-surface-card) 88%, transparent), var(--mj-bg-surface-card)), url(' + BackgroundImageUrl + ')' : null">

      <!-- Line 1: Breadcrumb (only when the space has a parent) -->
      @if (hasParentSpace) {
        <nav class="crumbs" aria-label="Breadcrumb">
          @for (c of Breadcrumbs; track c.label; let last = $last) {
            @if (!last) {
              <span class="crumb-link" [mjClickable]="c.label" (click)="onCrumbClick(c)">{{ c.label }}</span>
              <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            } @else {
              <span class="crumb-current">{{ c.label }}</span>
            }
          }
        </nav>
      }

      <!-- Line 2: Type tile, title, star, non-Active status chip, and right actions -->
      <div class="top">
        <div class="title-row">
          <mjc-type-tile
            [IconClass]="TypeIconClass || 'fa-solid fa-compass'"
            [Color]="TypeColor || ''"
            [IsClosed]="Status === 'Closed'"
            Size="md">
          </mjc-type-tile>

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

          @if (Status && Status !== 'Active') {
            <span class="chip status-chip">{{ Status }}</span>
          }

          <ng-content select="[chips]"></ng-content>
        </div>

        <div class="actions">
          <ng-content select="[actions]"></ng-content>

          @if (hasMoreMenu) {
            <div class="more-menu-wrap">
              <button
                type="button"
                mjButton Variant="icon" Size="sm"
                class="more-menu-btn"
                data-testid="space-header-more-btn"
                [attr.aria-expanded]="moreMenuOpen"
                aria-haspopup="menu"
                aria-label="More actions"
                title="More actions"
                (click)="toggleMoreMenu($event)">
                <i class="fa-solid fa-ellipsis" aria-hidden="true"></i>
              </button>

              @if (moreMenuOpen) {
                <div class="more-menu-popover" data-testid="space-header-more-menu" role="menu" aria-label="Space actions">
                  @if (CanInvite) {
                    <button
                      type="button"
                      role="menuitem"
                      class="more-menu-item"
                      data-testid="header-menu-invite"
                      (click)="onMenuAction('invite', $event)">
                      <i class="fa-solid fa-user-plus menu-icon" aria-hidden="true"></i>
                      <span>Invite</span>
                    </button>
                  }
                  @if (CanAddSubSpace) {
                    <button
                      type="button"
                      role="menuitem"
                      class="more-menu-item"
                      data-testid="header-menu-new-subspace"
                      (click)="onMenuAction('subspace', $event)">
                      <i class="fa-solid fa-folder-plus menu-icon" aria-hidden="true"></i>
                      <span>New sub-space</span>
                    </button>
                  }
                  @if (CanEditPages && CanEditCurrentPage) {
                    <button
                      type="button"
                      role="menuitem"
                      class="more-menu-item"
                      data-testid="header-menu-edit-page"
                      (click)="onMenuAction('edit-page', $event)">
                      <i class="fa-solid fa-pen menu-icon" aria-hidden="true"></i>
                      <span>Edit page</span>
                    </button>
                  }
                  @if (CanEditPages) {
                    <button
                      type="button"
                      role="menuitem"
                      class="more-menu-item"
                      data-testid="header-menu-new-page"
                      (click)="onMenuAction('new-page', $event)">
                      <i class="fa-solid fa-file-circle-plus menu-icon" aria-hidden="true"></i>
                      <span>New page</span>
                    </button>
                  }
                  @if (CanConfigure) {
                    <button
                      type="button"
                      role="menuitem"
                      class="more-menu-item"
                      data-testid="header-menu-settings"
                      (click)="onMenuAction('settings', $event)">
                      <i class="fa-solid fa-sliders menu-icon" aria-hidden="true"></i>
                      <span>Space settings</span>
                    </button>
                  }
                </div>
              }
            </div>
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
    .crumb-current {
      color: var(--mj-text-secondary);
      font-weight: var(--mj-font-medium);
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
    .actions {
      margin-left: auto;
      display: flex;
      gap: var(--mj-space-2);
      align-items: center;
      flex-shrink: 0;
    }

    .more-menu-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .more-menu-popover {
      position: absolute;
      top: calc(100% + var(--mj-space-1-5));
      right: 0;
      z-index: var(--mj-z-popover);
      min-width: 190px;
      padding: var(--mj-space-1);
      background: var(--mj-bg-surface);
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-md);
      box-shadow: var(--mj-shadow-lg);
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-0-5);
    }
    .more-menu-item {
      display: flex;
      align-items: center;
      gap: var(--mj-space-2-5);
      height: var(--mj-space-9);
      padding: 0 var(--mj-space-2-5);
      border: none;
      border-radius: var(--mj-radius-sm);
      background: transparent;
      color: var(--mj-text-primary);
      font: inherit;
      font-size: var(--mj-text-sm);
      font-weight: var(--mj-font-medium);
      cursor: pointer;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
      transition: background var(--mj-transition-fast), color var(--mj-transition-fast);
    }
    .more-menu-item:hover {
      background: var(--mj-bg-surface-hover);
      color: var(--mj-brand-primary);
    }
    .menu-icon {
      width: 18px;
      text-align: center;
      font-size: var(--mj-text-sm);
      color: var(--mj-text-muted);
      flex-shrink: 0;
    }
    .more-menu-item:hover .menu-icon {
      color: var(--mj-brand-primary);
    }

    @media (prefers-reduced-motion: reduce) {
      .crumb-link,
      .star,
      .more-menu-item {
        transition: none;
      }
    }
  `]
})
export class CollabSpaceHeaderComponent {
  constructor(
    @Optional() @Inject(ElementRef) private readonly host?: ElementRef<HTMLElement>,
  ) {}

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

  public moreMenuOpen = false;

  /** True when the space sits under a parent space (`Spaces › Parent › Child`). */
  public get hasParentSpace(): boolean {
    return this.parentCrumb !== null;
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

  public toggleMoreMenu(event?: MouseEvent): void {
    event?.stopPropagation();
    this.moreMenuOpen = !this.moreMenuOpen;
  }

  public closeMoreMenu(): void {
    this.moreMenuOpen = false;
  }

  public onMenuAction(action: 'invite' | 'subspace' | 'edit-page' | 'new-page' | 'settings', event?: MouseEvent): void {
    event?.stopPropagation();
    this.moreMenuOpen = false;
    switch (action) {
      case 'invite':
        this.InviteRequested.emit();
        break;
      case 'subspace':
        this.NewSubSpaceRequested.emit();
        break;
      case 'edit-page':
        this.EditPageRequested.emit();
        break;
      case 'new-page':
        this.NewPageRequested.emit();
        break;
      case 'settings':
        this.SpaceSettingsRequested.emit();
        break;
    }
  }

  public onCrumbClick(crumb: BreadcrumbItem): void {
    this.BreadcrumbSelectRequested.emit(crumb);
  }

  public onSubSpaceClick(sub: SubSpaceSummary): void {
    this.SubSpaceSelectRequested.emit(sub);
  }

  /** Immediate parent space breadcrumb when inside a nested child space (`Spaces > Parent > Child`). */
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

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: Pick<MouseEvent, 'target'>): void {
    if (!this.moreMenuOpen) return;
    const target = event.target;
    if (target instanceof Node && this.host?.nativeElement.contains(target)) {
      return;
    }
    this.moreMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  public onEscapeKey(): void {
    if (this.moreMenuOpen) {
      this.moreMenuOpen = false;
    }
  }
}
