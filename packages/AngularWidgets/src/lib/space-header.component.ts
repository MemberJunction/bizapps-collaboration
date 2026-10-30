import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MJClickableDirective } from '@memberjunction/ng-ui-components';
import { CommonModule } from '@angular/common';
import { CollabTypeTileComponent } from './type-tile.component';
import { BreadcrumbItem } from './types';
import { SubSpaceSummary } from './space-overview.component';

@Component({
  selector: 'mjc-space-header',
  standalone: true,
  imports: [CommonModule, CollabTypeTileComponent, MJClickableDirective],
  template: `
    <section class="space-head" [style.background-image]="BackgroundImageUrl ? 'linear-gradient(to bottom, color-mix(in srgb, var(--mj-bg-surface-card) 88%, transparent), var(--mj-bg-surface-card)), url(' + BackgroundImageUrl + ')' : null">
      <div class="top">
        <mjc-type-tile
          [IconClass]="TypeIconClass || 'fa-solid fa-compass'"
          [Color]="TypeColor || ''"
          [IsClosed]="Status === 'Closed'"
          Size="md">
        </mjc-type-tile>
        <div class="grow">
          @if ((Breadcrumbs && Breadcrumbs.length > 0) || (SubSpaces && SubSpaces.length > 0) || CanAddSubSpace) {
            <div class="header-hierarchy-row">
              @if (Breadcrumbs && Breadcrumbs.length > 0) {
                <div class="crumbs">
                  @for (c of Breadcrumbs; track c.label; let last = $last) {
                    @if (!last) {
                      <span class="crumb-link" [mjClickable]="c.label" (click)="onCrumbClick(c)">{{ c.label }}</span>
                      <i class="fa-solid fa-chevron-right"></i>
                    } @else {
                      <b>{{ c.label }}</b>
                    }
                  }
                </div>
              }

              @if ((SubSpaces && SubSpaces.length > 0) || CanAddSubSpace) {
                <div class="subspaces-bar" aria-label="Space hierarchy and sub-spaces">
                  <span class="subspaces-divider" aria-hidden="true">·</span>
                  @for (sub of SubSpaces; track sub.id) {
                    <button
                      type="button"
                      class="subspace-pill"
                      [title]="'Open sub-space: ' + sub.name + (sub.type ? ' (' + sub.type + ')' : '')"
                      (click)="onSubSpaceClick(sub)">
                      <span class="pill-dot" [style.background]="sub.color || 'var(--mj-brand-primary)'">
                        <i [class]="sub.iconClass || 'fa-solid fa-compass'"></i>
                      </span>
                      <span class="pill-name">{{ sub.name }}</span>
                    </button>
                  }
                  @if (CanAddSubSpace) {
                    <button
                      type="button"
                      class="subspace-pill add-pill"
                      title="Create a new sub-space inside this space"
                      (click)="NewSubSpaceRequested.emit()">
                      <i class="fa-solid fa-plus"></i>
                      <span>Sub-space</span>
                    </button>
                  }
                </div>
              }
            </div>
          }
          <div class="title-row">
            <h1 class="h1">{{ Title }}
              @if (ShowStar) {
                <button type="button" class="star" [class.on]="IsStarred" [disabled]="StarBusy" [attr.aria-pressed]="IsStarred" [attr.aria-label]="IsStarred ? 'Unstar this space' : 'Star this space'" [title]="IsStarred ? 'Starred: in your favorites' : 'Star this space'" (click)="StarToggleRequested.emit()">
                  <i [class]="IsStarred ? 'fa-solid fa-star' : 'fa-regular fa-star'"></i>
                </button>
              }
            </h1>
            @if (TypeName) {
              <span class="chip plain">{{ TypeName }}</span>
            }
            @if (Status === 'Closed') {
              <span class="chip plain">Closed</span>
            } @else if (Status && Status !== 'Active') {
              <span class="chip plain">{{ Status }}</span>
            }
            <ng-content select="[chips]"></ng-content>
            @if (Subtitle) {
              <span class="sub-inline" [title]="Subtitle">
                <span>{{ subtitleParts[0] }}</span>
              </span>
            }
          </div>
        </div>
        <div class="actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      </div>

      <ng-content select="mjc-space-tabs"></ng-content>
      <ng-content select="[tabs]"></ng-content>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
      line-height: var(--mjc-line-height, 1.45);
    }
    button {
      font-family: inherit;
      line-height: inherit;
    }
    .space-head {
      background: var(--mj-bg-surface);
      border-bottom: 1px solid var(--mj-border-default);
      padding: 10px 24px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .header-hierarchy-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 22px;
    }
    .crumbs {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      color: var(--mj-text-muted);
      font-weight: 500;
      line-height: 1.2;
    }
    .crumbs i {
      font-size: 8px;
      color: var(--mj-text-disabled);
    }
    .crumbs b {
      color: var(--mj-text-secondary);
      font-weight: 600;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 40px;
    }
    .grow {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      min-width: 0;
    }
    .h1 {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.015em;
      margin: 0;
      color: var(--mj-text-primary);
      line-height: 1.25;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .star {
      border: 0;
      background: transparent;
      cursor: pointer;
      margin-left: 5px;
      font-size: 14px;
      color: var(--mj-text-muted, #6b7280);
      vertical-align: middle;
      padding: 0 3px;
    }
    .star.on { color: var(--mj-status-warning, #f59e0b); }
    .star:disabled { opacity: .6; cursor: default; }
    .sub-inline {
      color: var(--mj-text-muted);
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 280px;
      padding-left: 8px;
      border-left: 1px solid var(--mj-border-default);
    }
    .actions {
      margin-left: auto;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 20px;
      padding: 0 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid var(--mj-border-default);
      color: var(--mj-text-secondary);
      background: var(--mj-bg-surface);
      box-sizing: border-box;
      user-select: none;
      flex-shrink: 0;
    }
    .crumb-link {
      cursor: pointer;
      color: var(--mj-text-secondary, #475569);
      transition: color 0.15s;
    }
    .crumb-link:hover {
      color: var(--mj-brand-primary, #0076b6);
      text-decoration: underline;
    }
    .chip.plain {
      background: var(--mj-bg-surface-sunken, #f1f5f9);
      border-color: transparent;
    }
    /* Inline Subspaces quick-access pills */
    .subspaces-bar {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }
    .subspaces-divider {
      color: var(--mj-text-disabled, #cbd5e1);
      font-weight: 700;
      margin: 0 2px;
    }
    .subspace-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 21px;
      padding: 0 8px 0 4px;
      border-radius: 99px;
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-secondary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .subspace-pill:hover {
      background: var(--mj-bg-surface-hover);
      border-color: var(--mj-brand-primary);
      color: var(--mj-brand-primary);
    }
    .subspace-pill.add-pill {
      padding: 0 7px;
      border-style: dashed;
      background: transparent;
      color: var(--mj-text-muted);
      font-weight: 500;
      font-size: 11px;
    }
    .subspace-pill.add-pill:hover {
      border-color: var(--mj-brand-primary);
      color: var(--mj-brand-primary);
    }
    .pill-dot {
      width: 14px;
      height: 14px;
      border-radius: 99px;
      color: var(--mj-brand-on-primary, #ffffff);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      flex-shrink: 0;
    }
    .pill-name {
      white-space: nowrap;
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
  @Input() CanAddSubSpace = false;

  @Output() BreadcrumbSelectRequested = new EventEmitter<BreadcrumbItem>();
  @Output() StarToggleRequested = new EventEmitter<void>();
  @Output() SubSpaceSelectRequested = new EventEmitter<SubSpaceSummary>();
  @Output() NewSubSpaceRequested = new EventEmitter<void>();

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
}
