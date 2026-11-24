import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJTabListDirective } from '@memberjunction/ng-ui-components';
import { TabItem } from './types';

@Component({
  selector: 'mjc-space-tabs',
  standalone: true,
  imports: [CommonModule, MJTabListDirective],
  template: `
    <div
      class="tabs"
      mjTabList
      [attr.aria-label]="AriaLabel"
      (TabActivateRequested)="onTabActivateRequested($event)">
      @for (tab of Tabs; track tab.id) {
        <button
          type="button"
          role="tab"
          class="tab"
          [class.active]="tab.id === ActiveTab"
          [attr.aria-selected]="tab.id === ActiveTab"
          (click)="selectTab(tab.id)">
          @if (tab.iconClass) {
            <i [class]="tab.iconClass" aria-hidden="true"></i>
          }
          <span>{{ tab.label }}</span>
          @if (tab.count !== undefined && tab.count !== null) {
            <span class="c">{{ tab.count }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
      line-height: var(--mjc-line-height, 1.45);
    }
    .tabs {
      display: flex;
      align-items: center;
      overflow-x: auto;
      gap: 4px;
      scrollbar-width: none;
    }
    .tabs::-webkit-scrollbar {
      display: none;
    }
    .tab {
      flex: none;
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 12px 10px;
      font-weight: 600;
      font-size: 13px;
      line-height: inherit;
      color: var(--mj-text-secondary);
      border: 0;
      background: transparent;
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
      font-family: inherit;
      white-space: nowrap;
      transition: color 0.15s ease;
    }
    .tab:hover {
      color: var(--mj-text-primary);
    }
    .tab i {
      font-size: 12.5px;
    }
    .tab .c {
      font-size: 11px;
      font-weight: 600;
      color: var(--mj-text-secondary);
      background: var(--mj-bg-surface-sunken);
      border-radius: var(--mj-radius-full);
      padding: 0 6px;
      line-height: 1.5;
    }
    .tab[aria-selected="true"],
    .tab.active {
      color: var(--mj-brand-primary);
    }
    .tab[aria-selected="true"]::after,
    .tab.active::after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      border-block-end: 3px solid var(--mj-brand-primary);
      border-radius: 3px 3px 0 0;
    }
    .tab[aria-selected="true"] .c,
    .tab.active .c {
      background: color-mix(in srgb, var(--mj-brand-primary) 12%, transparent);
      color: var(--mj-brand-primary);
    }
    @media (max-width: 768px) {
      .tabs {
        gap: 2px;
      }
      .tab {
        padding: 8px 10px 10px;
      }
    }
  `]
})
export class CollabSpaceTabsComponent {
  @Input() Tabs: TabItem[] = [];
  @Input() ActiveTab = '';
  @Input() AriaLabel = 'Space sections';
  @Output() TabSelectRequested = new EventEmitter<string>();

  selectTab(tabId: string): void {
    if (this.ActiveTab !== tabId) {
      this.TabSelectRequested.emit(tabId);
    }
  }

  onTabActivateRequested(req: { Index: number }): void {
    const target = this.Tabs[req.Index];
    if (target) {
      this.selectTab(target.id);
    }
  }
}
