import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabTypeTileComponent } from './type-tile.component';
import { BreadcrumbItem } from './types';

@Component({
  selector: 'mjc-space-header',
  standalone: true,
  imports: [CommonModule, CollabTypeTileComponent],
  template: `
    <section class="space-head">
      @if (Breadcrumbs && Breadcrumbs.length > 0) {
        <div class="crumbs">
          @for (c of Breadcrumbs; track c.label; let last = $last) {
            @if (!last) {
              <span>{{ c.label }}</span>
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
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
    }
    button {
      font-family: inherit;
    }
    .space-head {
      background: var(--mj-bg-surface, #ffffff);
      border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
      padding: 16px 28px 0;
      box-sizing: border-box;
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      line-height: 1.45;
      color: var(--mj-text-muted, #64748b);
      font-weight: 500;
    }
    .crumbs i {
      font-size: 9px;
      color: var(--mj-text-disabled, #94a3b8);
    }
    .crumbs b {
      color: var(--mj-text-secondary, #475569);
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
      line-height: 1.45;
      margin: 0;
      color: var(--mj-text-primary, #0f172a);
    }
    .sub {
      color: var(--mj-text-secondary, #475569);
      font-size: 13px;
      line-height: 1.45;
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
      background: var(--mj-text-disabled, #94a3b8);
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
      border: 1px solid var(--mj-border-default, #e2e8f0);
      color: var(--mj-text-secondary, #475569);
      background: var(--mj-bg-surface, #ffffff);
      box-sizing: border-box;
      user-select: none;
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

  // Compatibility aliases
  @Input() set title(v: string) { this.Title = v; }
  get title(): string { return this.Title; }

  @Input() set typeName(v: string) { this.TypeName = v; }
  get typeName(): string { return this.TypeName; }

  @Input() set typeIconClass(v: string) { this.TypeIconClass = v; }
  get typeIconClass(): string { return this.TypeIconClass; }

  @Input() set typeColor(v: string) { this.TypeColor = v; }
  get typeColor(): string { return this.TypeColor; }

  @Input() set status(v: 'Active' | 'Closed' | string) { this.Status = v; }
  get status(): 'Active' | 'Closed' | string { return this.Status; }

  @Input() set subtitle(v: string) { this.Subtitle = v; }
  get subtitle(): string { return this.Subtitle; }

  @Input() set breadcrumbs(v: BreadcrumbItem[]) { this.Breadcrumbs = v; }
  get breadcrumbs(): BreadcrumbItem[] { return this.Breadcrumbs; }

  get subtitleParts(): string[] {
    if (!this.Subtitle) return [];
    // If subtitle contains bullet or dot separator, split on it
    if (this.Subtitle.includes('·')) {
      return this.Subtitle.split('·').map(s => s.trim());
    }
    return [this.Subtitle];
  }
}
