import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabTypeTileComponent } from './type-tile.component';
import type { SpaceHeaderChipDescriptor } from './base-space-type-ui-driver';
import { BreadcrumbItem } from './types';

@Component({
  selector: 'mjc-space-header',
  standalone: true,
  imports: [CommonModule, CollabTypeTileComponent],
  template: `
    <section
      class="space-head"
      [style.background-image]="BackgroundImageUrl ? 'linear-gradient(to bottom, color-mix(in srgb, var(--mj-bg-surface-card) 88%, transparent), var(--mj-bg-surface-card)), url(' + BackgroundImageUrl + ')' : null">

      <!-- Row 1: Identity (Breadcrumbs + Icon + Title + Chips) + Presence & Actions -->
      <div class="masthead-top">
        <div class="masthead-identity">
          <mjc-type-tile
            [IconClass]="TypeIconClass || 'fa-solid fa-compass'"
            [Color]="TypeColor || ''"
            [ImageUrl]="ImageUrl"
            [IsClosed]="Status === 'Closed'"
            Size="lg">
          </mjc-type-tile>
          <div class="grow">
            @if (Breadcrumbs && Breadcrumbs.length > 0) {
              <nav class="crumbs" aria-label="Breadcrumbs">
                <ol>
                  @for (c of Breadcrumbs; track c.label; let last = $last) {
                    <li>
                      @if (!last) {
                        <button type="button" class="crumb-link" (click)="onCrumbClick(c)">{{ c.label }}</button>
                      } @else {
                        <span class="crumb-current" aria-current="page">{{ c.label }}</span>
                      }
                    </li>
                  }
                </ol>
              </nav>
            }
            <div class="title-row">
              <h1 class="h1">{{ Title }}
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
              </h1>
              @if (TypeName) {
                <span class="chip plain">{{ TypeName }}</span>
              }
              @if (Status === 'Active') {
                <span class="chip ok"><i class="fa-solid fa-circle status-dot" aria-hidden="true"></i>Active</span>
              } @else if (Status === 'Paused') {
                <span class="chip warn"><i class="fa-solid fa-pause status-ic" aria-hidden="true"></i>Paused</span>
              } @else if (Status === 'Closed') {
                <span class="chip plain">Closed</span>
              } @else if (Status) {
                <span class="chip plain">{{ Status }}</span>
              }
              @for (chip of Chips; track chip.key) {
                <span [class]="'chip ' + (chip.variant || 'plain')" [style.border-color]="chip.color || null">
                  @if (chip.icon) {
                    <i [class]="chip.icon" aria-hidden="true"></i>
                  }
                  <span>{{ chip.label }}</span>
                </span>
              }
              <ng-content select="[chips]"></ng-content>
            </div>
            @if (Subtitle) {
              <div class="sub">
                @for (part of subtitleParts; track $index; let last = $last) {
                  <span>{{ part }}</span>
                  @if (!last) {
                    <span class="dotsep" aria-hidden="true"></span>
                  }
                }
              </div>
            }
          </div>
        </div>
        <div class="actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      </div>

      <!-- Row 2: Single Flush Horizontal Tablist -->
      <div class="masthead-tabs">
        <ng-content select="mjc-space-tabs"></ng-content>
        <ng-content select="[tabs]"></ng-content>
      </div>
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
      padding: 12px 24px 0;
      box-sizing: border-box;
    }
    .masthead-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-bottom: 8px;
    }
    .masthead-identity {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1 1 320px;
    }
    .grow {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    /* Accessible Breadcrumbs */
    .crumbs ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--mj-text-muted);
      font-weight: 500;
    }
    .crumbs > ol > li {
      display: inline-flex;
      align-items: center;
    }
    .crumbs > ol > li + li::before {
      content: "›" / "";
      margin-inline-end: 6px;
      color: var(--mj-text-muted);
    }
    .crumb-link {
      border: 0;
      background: transparent;
      padding: 0;
      cursor: pointer;
      color: var(--mj-text-muted);
      font-size: 12px;
      font-weight: 500;
      transition: color 0.15s ease;
    }
    .crumb-link:hover {
      color: var(--mj-brand-primary);
      text-decoration: underline;
    }
    .crumb-current {
      color: var(--mj-text-secondary);
      font-weight: 600;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
      color: var(--mj-text-primary);
      line-height: 1.25;
    }
    .star {
      border: 0;
      background: transparent;
      cursor: pointer;
      margin-left: 6px;
      font-size: 16px;
      color: var(--mj-text-muted);
      vertical-align: middle;
      padding: 0 3px;
    }
    .star.on {
      color: var(--mj-status-warning);
    }
    .star:disabled {
      opacity: 0.6;
      cursor: default;
    }
    .sub {
      color: var(--mj-text-secondary);
      font-size: 12.5px;
      display: flex;
      align-items: center;
      gap: 0;
      flex-wrap: wrap;
    }
    .actions {
      margin-left: auto;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .dotsep {
      width: 3px;
      height: 3px;
      border-radius: var(--mj-radius-full);
      background: var(--mj-text-disabled);
      display: inline-block;
      margin: 0 7px;
      vertical-align: middle;
    }
    .status-dot {
      font-size: 6px;
    }
    .status-ic {
      font-size: 8px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 22px;
      padding: 0 9px;
      border-radius: var(--mj-radius-full);
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid var(--mj-border-default);
      color: var(--mj-text-secondary);
      background: var(--mj-bg-surface);
      box-sizing: border-box;
      user-select: none;
    }
    .chip.plain {
      background: var(--mj-bg-surface-sunken);
      border-color: transparent;
    }
    .chip.ok {
      color: var(--mj-status-success-text);
      background: var(--mj-status-success-bg);
      border-color: color-mix(in srgb, var(--mj-status-success) 35%, transparent);
    }
    .chip.warn {
      color: var(--mj-status-warning-text);
      background: var(--mj-status-warning-bg);
      border-color: var(--mj-status-warning-border);
    }
    .chip.info {
      color: var(--mj-status-info-text);
      background: var(--mj-status-info-bg);
      border-color: var(--mj-status-info-border);
    }
    .masthead-tabs {
      display: block;
    }
    @media (max-width: 768px) {
      .space-head {
        padding: 10px 16px 0;
      }
      .masthead-top {
        gap: 10px;
      }
      .actions {
        margin-left: 0;
        width: 100%;
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
  @Input() ImageUrl: string | null = null;
  @Input() Status: 'Active' | 'Paused' | 'Closed' | string = 'Active';
  @Input() Subtitle = '';
  @Input() Breadcrumbs: BreadcrumbItem[] = [];
  @Input() BackgroundImageUrl: string | null = null;
  @Input() Chips: SpaceHeaderChipDescriptor[] = [];

  @Output() BreadcrumbSelectRequested = new EventEmitter<BreadcrumbItem>();
  @Output() StarToggleRequested = new EventEmitter<void>();

  public onCrumbClick(crumb: BreadcrumbItem): void {
    this.BreadcrumbSelectRequested.emit(crumb);
  }

  get subtitleParts(): string[] {
    if (!this.Subtitle) return [];
    if (this.Subtitle.includes('·')) {
      return this.Subtitle.split('·').map((s) => s.trim());
    }
    return [this.Subtitle];
  }
}
