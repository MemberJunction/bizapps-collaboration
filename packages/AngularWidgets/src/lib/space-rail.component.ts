import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJClickableDirective } from '@memberjunction/ng-ui-components';
import { CollabTypeTileComponent } from './type-tile.component';
import { RailSpaceNode } from './types';

@Component({
  selector: 'mjc-space-rail',
  standalone: true,
  imports: [CommonModule, CollabTypeTileComponent, MJClickableDirective],
  template: `
    <nav class="appnav" aria-label="Collaboration Navigation">
      <div class="jump" [mjClickable]="'Jump to a space'" (click)="onJumpClick()">
        <i class="fa-solid fa-magnifying-glass"></i>
        <span>Jump to a space</span>
        <span class="kbd">⌘J</span>
      </div>

      <button
        type="button"
        class="nav-item"
        [class.active]="ActiveNav === 'home'"
        (click)="selectNav('home')">
        <i class="fa-solid fa-house"></i>
        <span>Home</span>
      </button>

      <button
        type="button"
        class="nav-item"
        [class.active]="ActiveNav === 'inbox'"
        (click)="selectNav('inbox')">
        <i class="fa-solid fa-inbox"></i>
        <span>Inbox</span>
        @if (InboxCount > 0) {
          <span class="count hot">{{ InboxCount }}</span>
        }
      </button>

      <button
        type="button"
        class="nav-item"
        [class.active]="ActiveNav === 'tasks'"
        (click)="selectNav('tasks')">
        <i class="fa-solid fa-list-check"></i>
        <span>My tasks</span>
        @if (TaskCount > 0) {
          <span class="count">{{ TaskCount }}</span>
        }
      </button>

      <button
        type="button"
        class="nav-item"
        [class.active]="ActiveNav === 'files'"
        (click)="selectNav('files')">
        <i class="fa-solid fa-folder-open"></i>
        <span>Recent files</span>
      </button>

      <div class="nav-section">
        <span>Spaces</span>
        <button
          type="button"
          class="icon-btn-inline"
          (click)="SpaceCreateRequested.emit()"
          title="New Space"
          aria-label="New Space">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>

      <div class="tree-list">
        @for (s of Spaces; track s.id) {
          <div
            class="tree-item {{ s.level === 1 ? 'l1' : s.level === 2 ? 'l2' : '' }} {{ s.id === ActiveSpaceId ? 'active' : '' }} {{ s.isDim ? 'dim' : '' }}"
            [mjClickable]="s.name"
            (click)="selectSpace(s.id)">
            <span
              class="chev"
              [mjClickable]="(isNodeExpanded(s) ? 'Collapse ' : 'Expand ') + s.name"
              [attr.aria-expanded]="s.hasChildren ? isNodeExpanded(s) : null"
              (click)="toggleSpace(s, $event)">
              @if (s.hasChildren) {
                <i [class]="isNodeExpanded(s) ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right'"></i>
              }
            </span>
            <mjc-type-tile
              [IconClass]="s.iconClass"
              [Color]="s.color || ''"
              Size="sm">
            </mjc-type-tile>
            <span class="ellipsis">{{ s.name }}</span>
            @if (s.unread) {
              <span class="unread"></span>
            } @else if (s.isLocked) {
              <span class="meta"><i class="fa-solid fa-lock"></i></span>
            } @else if (s.meta !== undefined && s.meta !== null && s.meta !== '') {
              <span class="meta">{{ s.meta }}</span>
            }
          </div>
        }
      </div>

      <div class="nav-footer">
        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'assistant'"
          (click)="selectNav('assistant')">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span>Assistant</span>
        </button>
        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'settings'"
          (click)="selectNav('settings')">
          <i class="fa-solid fa-gear"></i>
          <span>Space types & settings</span>
        </button>
      </div>
    </nav>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
      line-height: var(--mjc-line-height, 1.45);
    }
    button {
      font-family: inherit;
      line-height: inherit;
    }
    .appnav {
      background: var(--mj-bg-surface, #ffffff);
      border-right: 1px solid var(--mj-border-default, #e2e8f0);
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: 0;
      box-sizing: border-box;
      width: 252px;
      height: 100%;
      user-select: none;
    }
    .jump {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 34px;
      padding: 0 10px;
      margin: 0 2px 8px;
      border-radius: var(--mj-radius-md, 8px);
      background: var(--mj-bg-surface-sunken, #f1f5f9);
      color: var(--mj-text-muted, #64748b);
      font-size: 13px;
      cursor: pointer;
    }
    .kbd {
      margin-left: auto;
      font-size: 11px;
      font-weight: 500;
      color: var(--mj-text-muted, #64748b);
      border: 1px solid var(--mj-border-default, #e2e8f0);
      border-radius: 5px;
      padding: 1px 6px;
      background: var(--mj-bg-surface-card, #f8fafc);
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 34px;
      padding: 0 10px;
      border-radius: var(--mj-radius-md, 8px);
      color: var(--mj-text-secondary, #475569);
      font-weight: 500;
      font-size: 13.5px;
      border: none;
      background: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
      font-family: inherit;
      box-sizing: border-box;
    }
    .nav-item:hover {
      background: var(--mj-bg-surface-card, #f8fafc);
    }
    .nav-item i {
      width: 16px;
      text-align: center;
      color: var(--mj-text-muted, #64748b);
      font-size: 14px;
    }
    .nav-item.active {
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 10%, transparent);
      color: var(--mj-brand-primary, #0076b6);
    }
    .nav-item.active i {
      color: var(--mj-brand-primary, #0076b6);
    }
    .nav-item .count {
      margin-left: auto;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--mj-text-secondary, #475569);
      background: var(--mj-bg-surface-sunken, #f1f5f9);
      border-radius: 99px;
      padding: 1px 7px;
    }
    .nav-item .count.hot {
      background: var(--mj-brand-primary, #0076b6);
      color: var(--mj-brand-on-primary, #ffffff);
    }
    .nav-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 14px 10px 4px;
      font-size: 11px;
      line-height: 1.45;
      font-weight: 600;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--mj-text-muted, #64748b);
    }
    .nav-section .icon-btn-inline {
      background: none;
      border: none;
      color: var(--mj-text-muted, #64748b);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .nav-section .icon-btn-inline:hover {
      color: var(--mj-text-primary, #0f172a);
    }
    .tree-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    .tree-item {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 8px;
      border-radius: var(--mj-radius-md, 8px);
      color: var(--mj-text-secondary, #475569);
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      box-sizing: border-box;
    }
    .tree-item:hover {
      background: var(--mj-bg-surface-card, #f8fafc);
    }
    .tree-item .chev {
      width: 10px;
      font-size: 9px;
      color: var(--mj-text-disabled, #94a3b8);
      display: inline-flex;
      justify-content: center;
    }
    .tree-item.active {
      background: var(--mj-bg-surface-sunken, #f1f5f9);
      color: var(--mj-text-primary, #0f172a);
      font-weight: 600;
    }
    .tree-item .unread {
      margin-left: auto;
      width: 7px;
      height: 7px;
      border-radius: 99px;
      background: var(--mj-brand-primary, #0076b6);
    }
    .tree-item .meta {
      margin-left: auto;
      font-size: 11px;
      color: var(--mj-text-muted, #64748b);
      font-weight: 500;
    }
    .tree-item.dim {
      color: var(--mj-text-muted, #64748b);
    }
    .l1 { padding-left: 22px; }
    .l2 { padding-left: 40px; }
    .nav-footer {
      margin-top: auto;
      border-top: 1px solid var(--mj-border-default, #e2e8f0);
      padding-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .ellipsis {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }
  `]
})
export class CollabSpaceRailComponent {
  @Input() ActiveNav = '';
  @Input() ActiveSpaceId = '';
  @Input() InboxCount = 0;
  @Input() TaskCount = 0;
  @Input() Spaces: RailSpaceNode[] = [];

  @Output() NavSelectRequested = new EventEmitter<string>();
  @Output() SpaceOpenRequested = new EventEmitter<string>();
  @Output() SpaceToggleRequested = new EventEmitter<RailSpaceNode>();
  @Output() SpaceCreateRequested = new EventEmitter<void>();
  @Output() JumpOpenRequested = new EventEmitter<void>();

  // Compatibility aliases
  @Input() set activeNav(v: string) { this.ActiveNav = v; }
  get activeNav(): string { return this.ActiveNav; }

  @Input() set activeSpaceId(v: string) { this.ActiveSpaceId = v; }
  get activeSpaceId(): string { return this.ActiveSpaceId; }

  @Input() set inboxCount(v: number) { this.InboxCount = v; }
  get inboxCount(): number { return this.InboxCount; }

  @Input() set taskCount(v: number) { this.TaskCount = v; }
  get taskCount(): number { return this.TaskCount; }

  @Input() set spaces(v: RailSpaceNode[]) { this.Spaces = v; }
  get spaces(): RailSpaceNode[] { return this.Spaces; }

  @Output() navSelect = this.NavSelectRequested;
  @Output() spaceSelect = this.SpaceOpenRequested;
  @Output() spaceToggle = this.SpaceToggleRequested;
  @Output() newSpace = this.SpaceCreateRequested;
  @Output() jumpClick = this.JumpOpenRequested;

  private _expandedOverrides = new Map<string, boolean>();

  isNodeExpanded(s: RailSpaceNode): boolean {
    if (this._expandedOverrides.has(s.id)) {
      return this._expandedOverrides.get(s.id)!;
    }
    return !!s.isExpanded;
  }

  selectNav(nav: string): void {
    this.NavSelectRequested.emit(nav);
  }

  selectSpace(spaceId: string): void {
    this.SpaceOpenRequested.emit(spaceId);
  }

  toggleSpace(s: RailSpaceNode, event?: { stopPropagation?: () => void }): void {
    event?.stopPropagation?.();
    if (s.hasChildren) {
      const next = !this.isNodeExpanded(s);
      this._expandedOverrides.set(s.id, next);
      this.SpaceToggleRequested.emit(s);
    }
  }

  onJumpClick(): void {
    this.JumpOpenRequested.emit();
  }
}
