import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MJClickableDirective } from '@memberjunction/ng-ui-components';
import { CommonModule } from '@angular/common';
import { CollabTypeTileComponent } from './type-tile.component';
import { BreadcrumbItem } from './types';

@Component({
  selector: 'mjc-space-header',
  standalone: true,
  imports: [CommonModule, CollabTypeTileComponent, MJClickableDirective],
  template: `
    <section class="space-head" [style.background-image]="BackgroundImageUrl ? 'linear-gradient(to bottom, color-mix(in srgb, var(--mj-bg-surface-card) 88%, transparent), var(--mj-bg-surface-card)), url(' + BackgroundImageUrl + ')' : null">
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
      <div class="top" [style.margin-top]="Breadcrumbs && Breadcrumbs.length > 0 ? '10px' : '0'">
        <mjc-type-tile
          [IconClass]="TypeIconClass || 'fa-solid fa-compass'"
          [Color]="TypeColor || ''"
          Size="xl">
        </mjc-type-tile>
        <div class="grow">
          <div class="title-row">
            <h1 class="h1">{{ Title }}</h1>
            @if (TypeName) {
              <span class="chip plain">{{ TypeName }}</span>
            }
            @if (Status === 'Active') {
              <span class="chip ok"><i class="fa-solid fa-circle" style="font-size:6px"></i>Active</span>
            } @else if (Status === 'Closed') {
              <span class="chip plain">Closed</span>
            } @else if (Status) {
              <span class="chip plain">{{ Status }}</span>
            }
            <ng-content select="[chips]"></ng-content>
          </div>
          @if (Subtitle) {
            <div class="sub">
              @for (part of subtitleParts; track $index; let last = $last) {
                <span>{{ part }}</span>
                @if (!last) {
                  <span class="dotsep"></span>
                }
              }
            </div>
          }
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
      padding: 16px 28px 0;
      box-sizing: border-box;
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: var(--mj-text-muted);
      font-weight: 500;
    }
    .crumbs i {
      font-size: 9px;
      color: var(--mj-text-disabled);
    }
    .crumbs b {
      color: var(--mj-text-secondary);
      font-weight: 600;
    }
    .top {
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }
    .grow {
      flex: 1;
      min-width: 0;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 2px;
      flex-wrap: wrap;
    }
    .h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.015em;
      margin: 0;
      color: var(--mj-text-primary);
    }
    .sub {
      color: var(--mj-text-secondary);
      font-size: 13px;
      margin-top: 3px;
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
      padding-top: 6px;
    }
    .dotsep {
      width: 3px;
      height: 3px;
      border-radius: 9px;
      background: var(--mj-text-disabled);
      display: inline-block;
      margin: 0 8px;
      vertical-align: middle;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 22px;
      padding: 0 8px;
      border-radius: 99px;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid var(--mj-border-default);
      color: var(--mj-text-secondary);
      background: var(--mj-bg-surface);
      box-sizing: border-box;
      user-select: none;
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
    .chip.ok {
      color: var(--mj-status-success-text, #15803d);
      background: var(--mj-status-success-bg, #f0fdf4);
      border-color: color-mix(in srgb, var(--mj-status-success, #22c55e) 35%, transparent);
    }
  `]
})
export class CollabSpaceHeaderComponent {
  @Input() Title = '';
  @Input() TypeName = '';
  @Input() TypeIconClass = '';
  @Input() TypeColor = '';
  @Input() Status: 'Active' | 'Closed' | string = 'Active';
  @Input() Subtitle = '';
  @Input() Breadcrumbs: BreadcrumbItem[] = [];
  @Input() BackgroundImageUrl: string | null = null;

  @Output() BreadcrumbSelectRequested = new EventEmitter<BreadcrumbItem>();

  public onCrumbClick(crumb: BreadcrumbItem): void {
    this.BreadcrumbSelectRequested.emit(crumb);
  }

  get subtitleParts(): string[] {
    if (!this.Subtitle) return [];
    // If subtitle contains bullet or dot separator, split on it
    if (this.Subtitle.includes('·')) {
      return this.Subtitle.split('·').map(s => s.trim());
    }
    return [this.Subtitle];
  }
}
