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
      @if (breadcrumbs && breadcrumbs.length > 0) {
        <div class="crumbs">
          @for (c of breadcrumbs; track c.label; let last = $last) {
            @if (!last) {
              <span>{{ c.label }}</span>
              <i class="fa-solid fa-chevron-right"></i>
            } @else {
              <b>{{ c.label }}</b>
            }
          }
        </div>
      }
      <div class="top" [style.margin-top]="breadcrumbs && breadcrumbs.length > 0 ? '10px' : '0'">
        <mjc-type-tile
          [iconClass]="typeIconClass || 'fa-solid fa-compass'"
          [color]="typeColor || ''"
          [typeCode]="typeCode || ''"
          size="xl">
        </mjc-type-tile>
        <div class="grow">
          <div class="title-row">
            <h1 class="h1">{{ title }}</h1>
            @if (typeName) {
              <span class="chip plain">{{ typeName }}</span>
            }
            @if (status === 'Active') {
              <span class="chip ok"><i class="fa-solid fa-circle" style="font-size:6px"></i>Active</span>
            } @else if (status === 'Closed') {
              <span class="chip plain">Closed</span>
            } @else if (status) {
              <span class="chip plain">{{ status }}</span>
            }
            <ng-content select="[chips]"></ng-content>
          </div>
          @if (subtitle) {
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
      margin: 0;
      color: var(--mj-text-primary, #0f172a);
    }
    .sub {
      color: var(--mj-text-secondary, #475569);
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
  @Input() title = '';
  @Input() typeName = '';
  @Input() typeIconClass = '';
  @Input() typeColor = '';
  @Input() typeCode = '';
  @Input() status: 'Active' | 'Closed' | string = 'Active';
  @Input() subtitle = '';
  @Input() breadcrumbs: BreadcrumbItem[] = [];

  get subtitleParts(): string[] {
    if (!this.subtitle) return [];
    // If subtitle contains bullet or dot separator, split on it
    if (this.subtitle.includes('·')) {
      return this.subtitle.split('·').map(s => s.trim());
    }
    return [this.subtitle];
  }
}
