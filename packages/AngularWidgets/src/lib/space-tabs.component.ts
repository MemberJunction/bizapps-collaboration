import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJTabListDirective, MJTabListRequest } from '@memberjunction/ng-ui-components';
import { TabItem } from './types';

@Component({
  selector: 'mjc-space-tabs',
  standalone: true,
  imports: [CommonModule, MJTabListDirective],
  template: `
    <div
      class="tabs"
      mjTabList
      (TabActivateRequested)="onTabActivateRequested($event)">
      @for (tab of Tabs; track tab.id; let idx = $index) {
        <button
          type="button"
          role="tab"
          class="tab"
          [class.active]="tab.id === ActiveTab"
          [attr.aria-selected]="tab.id === ActiveTab"
          (click)="selectTab(tab.id)">
          @if (tab.iconClass) {
            <i [class]="tab.iconClass"></i>
          }
          {{ tab.label }}
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
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
    }
    .tabs {
      display: flex;
      gap: 22px;
      margin-top: 14px;
      border-bottom: none;
    }
    .tab {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 1px 11px;
      font-weight: 550;
      font-size: 13.5px;
      line-height: 1.45;
      color: var(--mj-text-muted, #64748b);
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
      font-family: inherit;
    }
    .tab:hover {
      color: var(--mj-text-primary, #0f172a);
    }
    .tab i {
      font-size: 13px;
    }
    .tab .c {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--mj-text-muted, #64748b);
      background: var(--mj-bg-surface-sunken, #f1f5f9);
      border-radius: 99px;
      padding: 0 7px;
    }
    .tab.active {
      color: var(--mj-text-primary, #0f172a);
      border-bottom-color: var(--mj-brand-primary, #0076b6);
    }
  `]
})
export class CollabSpaceTabsComponent {
  @Input() Tabs: TabItem[] = [];
  @Input() ActiveTab = '';
  @Output() TabSelectRequested = new EventEmitter<string>();
  @Output() tabChange = this.TabSelectRequested; // Compatibility alias

  // Compatibility aliases
  @Input() set tabs(v: TabItem[]) { this.Tabs = v; }
  get tabs(): TabItem[] { return this.Tabs; }

  @Input() set activeTab(v: string) { this.ActiveTab = v; }
  get activeTab(): string { return this.ActiveTab; }

  selectTab(tabId: string): void {
    if (this.ActiveTab !== tabId) {
      this.ActiveTab = tabId;
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
