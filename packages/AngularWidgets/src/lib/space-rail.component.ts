import { Component, ElementRef, EventEmitter, Input, Output, OnInit, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJClickableDirective } from '@memberjunction/ng-ui-components';
import { UUIDsEqual } from '@memberjunction/global';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { CollabTypeTileComponent } from './type-tile.component';
import { CollabBandChipComponent } from './band-chip.component';
import { RailSpaceNode, SpaceBand, TabItem, SpaceConversationItem } from './types';
import { COLLAB_TOKENS_CSS } from './tokens';

interface SpaceNavPref {
  width: number;
  collapsed: boolean;
}

const DEFAULT_RAIL_TABS: TabItem[] = [
  { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-chart-pie' },
  { id: 'Library', label: 'Library', iconClass: 'fa-solid fa-folder-open' },
  { id: 'Work', label: 'Work', iconClass: 'fa-solid fa-list-check' },
  { id: 'Chat', label: 'Chat', iconClass: 'fa-solid fa-comments' },
  { id: 'People', label: 'People', iconClass: 'fa-solid fa-user-group' },
  { id: 'Settings', label: 'Settings', iconClass: 'fa-solid fa-sliders' },
];

@Component({
  selector: 'mjc-space-rail',
  standalone: true,
  imports: [CommonModule, CollabTypeTileComponent, CollabBandChipComponent, MJClickableDirective],
  template: `
    @if (Mode === 'space') {
      <!-- Space-Dedicated Workspace Rail (Option A) -->
      <nav
        class="space-nav"
        [class.collapsed]="isCollapsed"
        [style.width.px]="isCollapsed ? 58 : navWidth"
        aria-label="Space Workspace Navigation">

        <!-- Drag Resizer -->
        @if (!isCollapsed) {
          <div
            class="nav-resizer"
            (mousedown)="onResizerMouseDown($event)"
            title="Drag to resize navigation">
          </div>
        }

        <!-- Space Identity Cluster -->
        <div class="space-identity-box">
          @if (!isCollapsed) {
            <div class="space-identity-left">
              <button
                type="button"
                class="btn-back-spaces"
                (click)="onBackToSpaces()"
                title="Back to all spaces">
                <i class="fa-solid fa-arrow-left"></i>
                <span>All Spaces</span>
              </button>

              <div class="space-title-row">
                <div class="space-avatar-tile">
                  <i class="fa-solid" [class]="SpaceIcon || 'fa-shapes'"></i>
                </div>
                <div class="space-names">
                  <span class="space-name-text" [title]="SpaceTitle">{{ SpaceTitle || 'Active Space' }}</span>
                  <mjc-band-chip [Band]="SpaceBand" />
                </div>
              </div>
            </div>
          } @else {
            <div
              class="space-avatar-tile collapsed-tile"
              (click)="onBackToSpaces()"
              [title]="SpaceTitle + ' - Click to return to All Spaces'">
              <i class="fa-solid" [class]="SpaceIcon || 'fa-shapes'"></i>
            </div>
          }

          <button
            type="button"
            class="btn-nav-toggle"
            (click)="toggleCollapse()"
            [title]="isCollapsed ? 'Expand navigation' : 'Collapse navigation'">
            <i class="fa-solid" [class]="isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"></i>
          </button>
        </div>

        <!-- Space Navigation Body -->
        <div class="space-nav-body">

          <!-- Core Space Modules -->
          <div class="nav-section-group">
            @if (!isCollapsed) {
              <div class="section-title">WORKSPACE</div>
            }

            <div class="nav-links-list">
              @for (tab of Tabs; track tab.id) {
                @if (tab.id !== 'Settings' || CanConfigure) {
                  <button
                    type="button"
                    class="space-nav-link"
                    [class.active]="ActiveTab === tab.id"
                    [attr.aria-current]="ActiveTab === tab.id ? 'page' : null"
                    (click)="onTabClick(tab.id)"
                    [title]="isCollapsed ? tab.label : ''"
                    [attr.aria-label]="tab.label">
                    <i class="link-icon" [class]="tab.iconClass || 'fa-solid fa-layer-group'" aria-hidden="true"></i>
                    @if (!isCollapsed) {
                      <span class="link-label">{{ tab.label }}</span>
                      @if (badgeFor(tab) > 0) {
                        <span class="link-badge">{{ badgeFor(tab) }}</span>
                      }
                    }
                  </button>
                }
              }
            </div>
          </div>

          <!-- Space Conversations Section -->
          <div class="nav-section-group">
            @if (!isCollapsed) {
              <div class="section-title-row">
                <span class="section-title">CONVERSATIONS</span>
                @if (CanStartConversation) {
                  <button
                    type="button"
                    class="btn-add-section"
                    (click)="onNewConversation()"
                    title="New Conversation"
                    aria-label="New Conversation">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                }
              </div>
            } @else {
              @if (CanStartConversation) {
                <div class="collapsed-add-row">
                  <button
                    type="button"
                    class="btn-collapsed-add"
                    (click)="onNewConversation()"
                    title="New Conversation"
                    aria-label="New Conversation">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                </div>
              }
            }

            <div class="nav-links-list">
              @for (c of Conversations; track c.id) {
                <button
                  type="button"
                  class="space-nav-link convo-link"
                  [class.active]="ActiveTab === 'Chat' && IsActiveConversation(c.id)"
                  (click)="onConversationClick(c.id)"
                  [title]="c.name">
                  @if (c.kind === 'Private') {
                    <i class="fa-solid fa-lock link-icon lock-ic"></i>
                  } @else if (c.kind === 'Agent') {
                    <i class="fa-solid fa-robot link-icon robot-ic"></i>
                  } @else {
                    <span class="convo-hash-prefix">#</span>
                  }

                  @if (!isCollapsed) {
                    <span class="link-label">{{ c.name }}</span>
                    <span
                      class="band-dot"
                      [class.shared]="c.band === 'Shared'"
                      [class.team]="c.band === 'Team'"
                      [title]="c.band === 'Shared' ? 'Shared with outside participants' : 'Team only'">
                    </span>
                  }
                </button>
              }
            </div>
          </div>

        </div>

        @if (!isCollapsed) {
          <div class="space-nav-footer">
            <span class="footer-sync"><i class="fa-solid fa-cloud"></i> Preferences synced</span>
          </div>
        }

      </nav>
    } @else {
      <!-- Default Collab Home Rail (Global Directory & Tools) -->
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
          @if (CanCreateSpace) {
            <button
              type="button"
              class="icon-btn-inline"
              (click)="SpaceCreateRequested.emit()"
              title="New Space"
              aria-label="New Space">
              <i class="fa-solid fa-plus"></i>
            </button>
          }
        </div>

        <div class="tree-list">
          @for (s of visibleSpaces; track s.id) {
            <div
              class="tree-item {{ s.level === 1 ? 'l1' : s.level === 2 ? 'l2' : '' }} {{ IsActiveSpace(s.id) ? 'active' : '' }} {{ s.isDim ? 'dim' : '' }}"
              [mjClickable]="s.name"
              [attr.aria-expanded]="s.hasChildren ? isNodeExpanded(s) : null"
              (keydown.arrowright)="onArrowRight(s, $event)"
              (keydown.arrowleft)="onArrowLeft(s, $event)"
              (click)="selectSpace(s.id)">
              <span
                class="chev"
                aria-hidden="true"
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

      </nav>
    }

    @if (jumpOpen) {
      <div class="jump-scrim" (click)="closeJump()"></div>
      <div class="jump-palette" role="dialog" aria-modal="true" aria-label="Jump to a space">
        <input
          #jumpInput
          type="text"
          class="jump-input"
          placeholder="Jump to a space"
          aria-label="Jump to a space"
          [value]="jumpQuery"
          (input)="onJumpInput($event)"
          (keydown.enter)="jumpToFirst()"
          (keydown.escape)="closeJump()"
        />
        <ul class="jump-list">
          @for (match of jumpMatches; track match.id) {
            <li>
              <button type="button" class="jump-item" (click)="jumpTo(match)">
                <span>{{ match.name }}</span>
              </button>
            </li>
          }
          @if (jumpMatches.length === 0) {
            <li class="jump-none">No space matches.</li>
          }
        </ul>
      </div>
    }
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      user-select: none;
      position: relative;
    }

    /* ─── Mode: Space-Dedicated Workspace Rail ────────────────────────────── */
    .space-nav {
      height: 100%;
      background: var(--mj-bg-surface, #ffffff);
      border-right: 1px solid var(--mj-border-default, #e2e8f0);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: relative;
      transition: width 0.05s linear;
      box-sizing: border-box;
    }
    .space-nav.collapsed {
      width: 58px !important;
    }

    .nav-resizer {
      position: absolute;
      top: 0;
      right: -4px;
      width: 8px;
      bottom: 0;
      cursor: col-resize;
      z-index: 50;
      transition: background 0.15s ease;
    }
    .nav-resizer:hover, .nav-resizer:active {
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 35%, transparent);
    }

    .space-identity-box {
      padding: 12px 14px;
      border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-shrink: 0;
    }
    .space-nav.collapsed .space-identity-box {
      padding: 12px 6px;
      flex-direction: column;
      gap: 10px;
    }

    .space-identity-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      flex: 1;
    }

    .btn-back-spaces {
      background: transparent;
      border: none;
      color: var(--mj-text-muted, #64748b);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0;
      text-align: left;
      transition: color 0.15s ease;
    }
    .btn-back-spaces:hover {
      color: var(--mj-brand-primary, #0076b6);
    }

    .space-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .space-avatar-tile {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--mj-brand-secondary, #0891b2), var(--mj-brand-primary, #0076b6));
      color: var(--mj-text-inverse);
      display: grid;
      place-items: center;
      font-size: 14px;
      flex-shrink: 0;
    }
    .space-avatar-tile.collapsed-tile {
      cursor: pointer;
      width: 36px;
      height: 36px;
      border-radius: 8px;
    }

    .space-names {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      line-height: 1.2;
    }

    .space-name-text {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--mj-text-primary, #0f172a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-nav-toggle {
      background: transparent;
      border: 1px solid transparent;
      color: var(--mj-text-muted, #94a3b8);
      width: 24px;
      height: 24px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-grid;
      place-items: center;
      font-size: 11px;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .btn-nav-toggle:hover {
      background: var(--mj-bg-surface-hover, #f1f5f9);
      color: var(--mj-text-primary, #0f172a);
      border-color: var(--mj-border-strong, #cbd5e1);
    }

    .space-nav-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .space-nav.collapsed .space-nav-body {
      padding: 10px 4px;
      align-items: center;
    }

    .nav-section-group {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mj-text-muted, #94a3b8);
      padding: 4px 10px 2px;
    }

    .section-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 10px 2px;
    }
    .section-title-row .section-title {
      padding: 0;
    }

    .btn-add-section {
      background: transparent;
      border: none;
      color: var(--mj-text-muted, #94a3b8);
      cursor: pointer;
      font-size: 11px;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .btn-add-section:hover {
      color: var(--mj-text-primary, #0f172a);
      background: var(--mj-bg-surface-hover, #f1f5f9);
    }

    .collapsed-add-row {
      display: flex;
      justify-content: center;
      padding: 4px 0;
    }
    .btn-collapsed-add {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: transparent;
      border: 1px dashed var(--mj-text-muted);
      color: var(--mj-text-secondary, #475569);
      cursor: pointer;
      display: inline-grid;
      place-items: center;
      font-size: 12px;
      transition: all 0.15s ease;
    }
    .btn-collapsed-add:hover {
      background: var(--mj-bg-surface-hover, #f1f5f9);
      color: var(--mj-text-primary, #0f172a);
      border-color: var(--mj-brand-primary, #0076b6);
    }

    .nav-links-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .space-nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      border-radius: 6px;
      color: var(--mj-text-secondary, #475569);
      font-size: 13px;
      font-weight: 500;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
      transition: all 0.15s ease;
      position: relative;
    }
    .space-nav-link:hover {
      background: var(--mj-bg-surface-hover, #f1f5f9);
      color: var(--mj-text-primary, #0f172a);
    }
    .space-nav-link.active {
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 12%, transparent);
      color: var(--mj-brand-primary, #0076b6);
      font-weight: 600;
    }
    .space-nav-link.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 6px;
      bottom: 6px;
      width: 3px;
      background: var(--mj-brand-primary, #0076b6);
      border-radius: 0 4px 4px 0;
    }

    .link-icon {
      width: 18px;
      text-align: center;
      font-size: 13.5px;
      flex-shrink: 0;
    }
    .link-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .link-badge {
      background: var(--mj-bg-surface-sunken, #f1f5f9);
      color: var(--mj-text-secondary, #475569);
      font-size: 11px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 99px;
      font-family: var(--mj-font-family-mono, monospace);
    }
    .convo-link {
      padding-left: 12px;
    }
    .convo-hash-prefix {
      font-size: 14px;
      font-weight: 700;
      color: var(--mj-text-muted, #94a3b8);
      width: 18px;
      text-align: center;
    }
    .space-nav-link.active .convo-hash-prefix {
      color: var(--mj-brand-primary, #0076b6);
    }
    .lock-ic {
      color: var(--mjc-team, #7c3aed);
      font-size: 11px;
    }
    .robot-ic {
      color: var(--mj-brand-tertiary, #6366f1);
      font-size: 12px;
    }
    .band-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .band-dot.shared { background: var(--mjc-shared, #0076b6); }
    .band-dot.team { background: var(--mjc-team, #7c3aed); }

    .space-nav-footer {
      padding: 10px 14px;
      border-top: 1px solid var(--mj-border-default, #e2e8f0);
      font-size: 11px;
      color: var(--mj-text-muted, #94a3b8);
    }
    .footer-sync {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ─── Mode: Default Home Rail ─────────────────────────────────────────── */
    .appnav {
      width: 228px;
      border-right: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      display: flex;
      flex-direction: column;
      padding: 8px 6px;
      box-sizing: border-box;
      gap: 2px;
      height: 100%;
      user-select: none;
    }
    .jump-scrim { position: fixed; inset: 0; background: var(--mj-bg-overlay); z-index: 1000; }
    .jump-palette {
      position: fixed; top: 96px; left: 50%; transform: translateX(-50%); width: 420px; max-width: calc(100vw - 32px);
      background: var(--mj-bg-surface); border: 1px solid var(--mj-border-subtle); border-radius: 10px; z-index: 1001; padding: 8px;
    }
    .jump-input { width: 100%; box-sizing: border-box; padding: 8px 10px; }
    .jump-list { list-style: none; margin: 6px 0 0; padding: 0; max-height: 320px; overflow: auto; }
    .jump-item { width: 100%; text-align: left; background: none; border: 0; padding: 8px 10px; cursor: pointer; color: var(--mj-text-primary); border-radius: 6px; }
    .jump-item:hover, .jump-item:focus { background: var(--mj-bg-surface-sunken); }
    .jump-none { padding: 8px 10px; color: var(--mj-text-muted); }
    .jump {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 34px;
      padding: 0 10px;
      margin: 0 2px 8px;
      border-radius: var(--mj-radius-md, 8px);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-muted);
      font-size: 13px;
      cursor: pointer;
    }
    .kbd {
      margin-left: auto;
      font-size: 11px;
      font-weight: 500;
      color: var(--mj-text-muted);
      border: 1px solid var(--mj-border-default);
      border-radius: 5px;
      padding: 1px 6px;
      background: var(--mj-bg-surface-card);
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 34px;
      padding: 0 10px;
      border-radius: var(--mj-radius-md, 8px);
      color: var(--mj-text-secondary);
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
      background: var(--mj-bg-surface-card);
    }
    .nav-item i {
      width: 16px;
      text-align: center;
      color: var(--mj-text-muted);
      font-size: 14px;
    }
    .nav-item.active {
      background: color-mix(in srgb, var(--mj-brand-primary) 10%, transparent);
      color: var(--mj-brand-primary);
    }
    .nav-item.active i {
      color: var(--mj-brand-primary);
    }
    .nav-item .count {
      margin-left: auto;
      font-size: 11.5px;
      font-weight: 600;
      color: var(--mj-text-secondary);
      background: var(--mj-bg-surface-sunken);
      border-radius: 99px;
      padding: 1px 7px;
    }
    .nav-item .count.hot {
      background: var(--mj-brand-primary);
      color: var(--mj-brand-on-primary);
    }
    .nav-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 10px 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--mj-text-muted);
    }
    .icon-btn-inline {
      border: none;
      background: none;
      color: var(--mj-text-muted);
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .icon-btn-inline:hover {
      color: var(--mj-text-primary);
      background: var(--mj-bg-surface-sunken);
    }
    .tree-list {
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .tree-item {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 8px 0 20px;
      border-radius: var(--mj-radius-md, 8px);
      color: var(--mj-text-secondary);
      font-size: 13.5px;
      cursor: pointer;
      position: relative;
    }
    .tree-item:hover {
      background: var(--mj-bg-surface-card);
    }
    .tree-item.active {
      background: color-mix(in srgb, var(--mj-brand-primary) 10%, transparent);
      color: var(--mj-brand-primary);
      font-weight: 600;
    }
    .tree-item.dim {
      opacity: 0.55;
    }
    .tree-item.l1 {
      padding-left: 28px;
    }
    .tree-item.l2 {
      padding-left: 44px;
    }
    .tree-item .chev {
      position: absolute;
      left: 4px;
      width: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: var(--mj-text-muted);
    }
    .tree-item.l1 .chev {
      left: 12px;
    }
    .tree-item.l2 .chev {
      left: 28px;
    }
    .tree-item .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
    }
    .tree-item .unread {
      width: 7px;
      height: 7px;
      border-radius: 99px;
      background: var(--mj-brand-primary);
      flex: none;
    }
    .tree-item .meta {
      margin-left: auto;
      font-size: 11.5px;
      color: var(--mj-text-muted);
    }
    .nav-footer {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-top: 8px;
      border-top: 1px solid var(--mj-border-default);
      flex: none;
    }
    `
  ]
})
export class CollabSpaceRailComponent implements OnInit {
  @Input() Mode: 'home' | 'space' = 'home';
  @Input() ActiveNav = '';
  @Input() ActiveSpaceId = '';
  @Input() SpaceTitle = '';
  @Input() SpaceIcon = 'fa-shapes';
  @Input() SpaceBand: SpaceBand = 'Shared';
  @Input() ActiveTab = 'Overview';
  /** The tabs of the space shown, as its type arranged them: the rail lists exactly these, with these labels. */
  @Input() Tabs: TabItem[] = DEFAULT_RAIL_TABS;

  /** Whether the caller may configure this space. Settings & Assistant is offered only to those who can. */
  @Input() CanConfigure = false;
  @Input() Conversations: SpaceConversationItem[] = [];
  @Input() ActiveConversationId = '';

  /** The URL keeps the casing it was given and the rows keep the database's, so compare IDs, never strings. */
  /** Whether the tree row is the open space. Ids are compared as UUIDs: the URL keeps the casing it was given. */
  public IsActiveSpace(spaceId: string): boolean {
    return !!this.ActiveSpaceId && UUIDsEqual(spaceId, this.ActiveSpaceId);
  }

  public IsActiveConversation(conversationId: string): boolean {
    return !!this.ActiveConversationId && UUIDsEqual(this.ActiveConversationId, conversationId);
  }
  @Input() LibraryCount = 0;
  @Input() TaskCount = 0;
  @Input() MemberCount = 0;
  @Input() InboxCount = 0;
  @Input() Spaces: RailSpaceNode[] = [];
  @Input() CanStartConversation = false;
  /** The new-space dialog isn't built yet, so the + is offered only when a host provides one. */
  @Input() CanCreateSpace = false;

  @Output() NavSelectRequested = new EventEmitter<string>();
  @Output() SpaceOpenRequested = new EventEmitter<string>();
  @Output() SpaceToggleRequested = new EventEmitter<RailSpaceNode>();
  @Output() SpaceCreateRequested = new EventEmitter<void>();
  @Output() JumpOpenRequested = new EventEmitter<void>();

  @Output() TabSelectRequested = new EventEmitter<string>();
  @Output() ConversationSelectRequested = new EventEmitter<string>();
  @Output() NewConversationRequested = new EventEmitter<void>();
  @Output() BackToSpacesRequested = new EventEmitter<void>();

  @ViewChild('jumpInput') private jumpInput?: ElementRef<HTMLInputElement>;

  public navWidth = 280;
  public isCollapsed = false;
  private isDraggingResizer = false;
  private startDragX = 0;
  private startWidth = 280;

  ngOnInit(): void {
    this.loadLayoutPreference();
  }

  /** The count a tab's link shows: the library's items, the tasks, the people, or the tab's own. */
  public badgeFor(tab: TabItem): number {
    switch (tab.id) {
      case 'Library': return this.LibraryCount;
      case 'Work': return this.TaskCount;
      case 'People': return this.MemberCount;
      default: return tab.count ?? 0;
    }
  }

  public onNewConversation(): void {
    this.NewConversationRequested.emit();
  }

  private loadLayoutPreference(): void {
    try {
      const raw = UserInfoEngine.Instance.GetSetting('mjc.spaceNav.state');
      if (raw) {
        const parsed: SpaceNavPref = JSON.parse(raw);
        if (typeof parsed.width === 'number') {
          this.navWidth = Math.min(450, Math.max(180, parsed.width));
        }
        if (typeof parsed.collapsed === 'boolean') {
          this.isCollapsed = parsed.collapsed;
        }
      }
    } catch {
      // ignore parsing error
    }
  }

  private persistLayoutPreference(): void {
    const pref: SpaceNavPref = {
      width: this.navWidth,
      collapsed: this.isCollapsed,
    };
    UserInfoEngine.Instance.SetSettingDebounced('mjc.spaceNav.state', JSON.stringify(pref));
  }

  public toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.persistLayoutPreference();
  }

  public onResizerMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDraggingResizer = true;
    this.startDragX = event.clientX;
    this.startWidth = this.navWidth;
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isDraggingResizer) return;
    const delta = event.clientX - this.startDragX;
    const newWidth = this.startWidth + delta;
    if (newWidth >= 180 && newWidth <= 450) {
      this.navWidth = newWidth;
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (this.isDraggingResizer) {
      this.isDraggingResizer = false;
      this.persistLayoutPreference();
    }
  }

  public onTabClick(tabId: string): void {
    this.TabSelectRequested.emit(tabId);
  }

  public onConversationClick(conversationId: string): void {
    this.ConversationSelectRequested.emit(conversationId);
  }

  public onBackToSpaces(): void {
    this.BackToSpacesRequested.emit();
  }

  public selectNav(nav: string): void {
    this.NavSelectRequested.emit(nav);
  }

  public selectSpace(id: string): void {
    this.SpaceOpenRequested.emit(id);
  }

  public jumpOpen = false;
  public jumpQuery = '';

  /** The spaces whose names contain what was typed, in the tree's order. */
  public get jumpMatches(): RailSpaceNode[] {
    const needle = this.jumpQuery.trim().toLowerCase();
    return this.Spaces.filter((s) => !needle || s.name.toLowerCase().includes(needle));
  }

  public onJumpClick(): void {
    this.OpenJump();
  }

  public OpenJump(): void {
    this.jumpOpen = true;
    this.jumpQuery = '';
    this.JumpOpenRequested.emit();
    setTimeout(() => this.jumpInput?.nativeElement.focus());
  }

  public closeJump(): void {
    this.jumpOpen = false;
  }

  public onJumpInput(event: Event): void {
    this.jumpQuery = (event.target as HTMLInputElement).value;
  }

  public jumpToFirst(): void {
    const first = this.jumpMatches[0];
    if (first) this.jumpTo(first);
  }

  public jumpTo(space: RailSpaceNode): void {
    this.jumpOpen = false;
    this.SpaceOpenRequested.emit(space.id);
  }

  /** ⌘J (Ctrl+J elsewhere) opens the palette from anywhere on the page. */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'preventDefault'>): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      this.OpenJump();
    }
  }

  public toggleSpace(s: RailSpaceNode, event: Event): void {
    event.stopPropagation();
    const current = this.isNodeExpanded(s);
    this._expandedOverrides.set(s.id, !current);
    this.SpaceToggleRequested.emit(s);
  }

  public isNodeExpanded(s: RailSpaceNode): boolean {
    if (this._expandedOverrides.has(s.id)) {
      return this._expandedOverrides.get(s.id)!;
    }
    return s.isExpanded ?? false;
  }

  public onArrowRight(s: RailSpaceNode, event: Event): void {
    if (s.hasChildren && !this.isNodeExpanded(s)) {
      event.preventDefault();
      this._expandedOverrides.set(s.id, true);
      this.SpaceToggleRequested.emit(s);
    }
  }

  public onArrowLeft(s: RailSpaceNode, event: Event): void {
    if (s.hasChildren && this.isNodeExpanded(s)) {
      event.preventDefault();
      this._expandedOverrides.set(s.id, false);
      this.SpaceToggleRequested.emit(s);
    }
  }

  private _expandedOverrides = new Map<string, boolean>();

  get visibleSpaces(): RailSpaceNode[] {
    const result: RailSpaceNode[] = [];
    const stack: { level: number; expanded: boolean }[] = [];

    for (const s of this.Spaces) {
      const level = s.level ?? 0;
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const isVisible = stack.every(a => a.expanded);
      if (isVisible) {
        result.push(s);
      }

      if (s.hasChildren) {
        stack.push({ level, expanded: this.isNodeExpanded(s) });
      }
    }

    return result;
  }
}
