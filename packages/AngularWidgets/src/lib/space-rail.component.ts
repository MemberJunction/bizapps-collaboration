import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogError } from '@memberjunction/core';
import { MJButtonDirective, MJClickableDirective } from '@memberjunction/ng-ui-components';
import { UUIDsEqual } from '@memberjunction/global';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { CollabTypeTileComponent } from './type-tile.component';
import { RailSpaceNode, SpaceBand, SpaceConversationItem, TabItem } from './types';
import { COLLAB_TOKENS_CSS } from './tokens';

const RAIL_PREF_KEY = 'Collaboration.SpaceRailPrefs';
const LEGACY_RAIL_PREF_KEY = 'mjc.spaceNav.state';
const DEFAULT_RAIL_WIDTH = 260;
const COLLAPSED_RAIL_WIDTH = 56;
const MIN_RAIL_WIDTH = 180;
const MAX_RAIL_WIDTH = 450;

export interface SpaceRailPref {
  width: number;
  collapsed: boolean;
  expandedIds: string[];
}

@Component({
  selector: 'mjc-space-rail',
  standalone: true,
  imports: [CommonModule, CollabTypeTileComponent, MJButtonDirective, MJClickableDirective],
  template: `
    <nav
      class="appnav"
      [class.collapsed]="isCollapsed"
      [style.width.px]="isCollapsed ? collapsedRailWidth : navWidth"
      aria-label="Collaboration Navigation">

      <!-- Drag Resizer -->
      @if (!isCollapsed) {
        <div
          class="nav-resizer"
          data-testid="rail-resizer"
          (mousedown)="onResizerMouseDown($event)"
          title="Drag to resize navigation">
        </div>
      }

      <!-- Top Bar: Jump Trigger + Collapse Toggle -->
      <div class="rail-top">
        @if (!isCollapsed) {
          <button
            type="button"
            class="jump"
            data-testid="rail-jump-btn"
            (click)="onJumpClick()"
            aria-label="Jump to a space">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <span class="jump-text">Jump to a space</span>
            <span class="kbd">{{ JumpHint }}</span>
          </button>
        } @else {
          <button
            type="button"
            class="rail-icon-btn"
            data-testid="rail-jump-btn"
            (click)="onJumpClick()"
            [title]="'Jump to a space (' + JumpHint + ')'"
            aria-label="Jump to a space">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          </button>
        }

        <button
          type="button"
          class="rail-toggle-btn"
          data-testid="rail-collapse-toggle"
          (click)="toggleCollapse()"
          [attr.aria-expanded]="!isCollapsed"
          [title]="isCollapsed ? 'Expand space navigation' : 'Collapse space navigation'"
          [attr.aria-label]="isCollapsed ? 'Expand space navigation' : 'Collapse space navigation'">
          <i class="fa-solid" [class]="isCollapsed ? 'fa-angles-right' : 'fa-angles-left'" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Primary Workspace Views -->
      <div class="nav-primary">
        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'home'"
          [attr.aria-current]="ActiveNav === 'home' ? 'page' : null"
          (click)="selectNav('home')"
          [title]="isCollapsed ? 'Home' : ''"
          [attr.aria-label]="isCollapsed ? 'Home' : null">
          <i class="fa-solid fa-house" aria-hidden="true"></i>
          @if (!isCollapsed) {
            <span class="nav-label">Home</span>
          }
        </button>

        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'inbox'"
          [attr.aria-current]="ActiveNav === 'inbox' ? 'page' : null"
          (click)="selectNav('inbox')"
          [title]="isCollapsed ? (InboxCount > 0 ? 'Inbox (' + InboxCount + ')' : 'Inbox') : ''"
          [attr.aria-label]="isCollapsed ? 'Inbox' : null">
          <i class="fa-solid fa-inbox" aria-hidden="true"></i>
          @if (!isCollapsed) {
            <span class="nav-label">Inbox</span>
            @if (InboxCount > 0) {
              <span class="count hot">{{ InboxCount }}</span>
            }
          } @else if (InboxCount > 0) {
            <span class="collapsed-dot hot" aria-hidden="true"></span>
          }
        </button>

        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'tasks'"
          [attr.aria-current]="ActiveNav === 'tasks' ? 'page' : null"
          (click)="selectNav('tasks')"
          [title]="isCollapsed ? (MyTaskCount > 0 ? 'My tasks (' + MyTaskCount + ')' : 'My tasks') : ''"
          [attr.aria-label]="isCollapsed ? 'My tasks' : null">
          <i class="fa-solid fa-list-check" aria-hidden="true"></i>
          @if (!isCollapsed) {
            <span class="nav-label">My tasks</span>
            @if (MyTaskCount > 0) {
              <span class="count">{{ MyTaskCount }}</span>
            }
          } @else if (MyTaskCount > 0) {
            <span class="collapsed-dot" aria-hidden="true"></span>
          }
        </button>

        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'files'"
          [attr.aria-current]="ActiveNav === 'files' ? 'page' : null"
          (click)="selectNav('files')"
          [title]="isCollapsed ? 'Recent files' : ''"
          [attr.aria-label]="isCollapsed ? 'Recent files' : null">
          <i class="fa-solid fa-folder-open" aria-hidden="true"></i>
          @if (!isCollapsed) {
            <span class="nav-label">Recent files</span>
          }
        </button>
      </div>

      <!-- Spaces Section Header -->
      @if (!isCollapsed) {
        <div class="nav-section">
          <span>Spaces</span>
          @if (CanCreateSpace) {
            <button
              type="button"
              mjButton Variant="icon" Size="sm" class="icon-btn-inline"
              (click)="SpaceCreateRequested.emit()"
              title="New Space"
              aria-label="New Space">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </button>
          }
        </div>
      } @else {
        <div class="rail-divider" role="separator"></div>
      }

      <!-- Persistent Hierarchical Space Tree -->
      <div class="tree-list" aria-label="Spaces">
        @for (s of visibleSpaces; track s.id) {
          @if (!isCollapsed) {
            <div
              class="tree-item {{ s.level === 1 ? 'l1' : s.level === 2 ? 'l2' : '' }} {{ IsActiveSpace(s.id) ? 'active' : '' }} {{ s.isDim ? 'dim' : '' }}"
              [attr.aria-current]="IsActiveSpace(s.id) ? 'page' : null"
              [attr.aria-expanded]="s.hasChildren ? isNodeExpanded(s) : null"
              [mjClickable]="s.name"
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
                [IsClosed]="!!s.isLocked"
                Size="sm">
              </mjc-type-tile>
              <span class="ellipsis" [title]="s.name">{{ s.name }}</span>
              @if (s.unread) {
                <span class="unread"></span>
              } @else if (s.isLocked) {
                <span class="meta"><i class="fa-solid fa-lock" aria-hidden="true"></i><span class="sr-only">(closed)</span></span>
              } @else if (s.meta !== undefined && s.meta !== null && s.meta !== '') {
                <span class="meta">{{ s.meta }}</span>
              }
            </div>
          } @else {
            <button
              type="button"
              class="collapsed-space-tile {{ IsActiveSpace(s.id) ? 'active' : '' }} {{ s.isDim ? 'dim' : '' }}"
              [attr.aria-current]="IsActiveSpace(s.id) ? 'page' : null"
              [title]="s.name"
              [attr.aria-label]="s.name"
              (click)="selectSpace(s.id)">
              <mjc-type-tile
                [IconClass]="s.iconClass"
                [Color]="s.color || ''"
                [IsClosed]="!!s.isLocked"
                Size="sm">
              </mjc-type-tile>
              <span class="sr-only">{{ s.name }}</span>
              @if (s.unread) {
                <span class="collapsed-dot hot" aria-hidden="true"></span>
              }
            </button>
          }
        }
      </div>

      @if (isCollapsed && CanCreateSpace) {
        <div class="rail-bottom-collapsed">
          <button
            type="button"
            class="rail-icon-btn"
            (click)="SpaceCreateRequested.emit()"
            title="New Space"
            aria-label="New Space">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
          </button>
        </div>
      }
    </nav>

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
                <mjc-type-tile
                  [IconClass]="match.iconClass"
                  [Color]="match.color || ''"
                  [IsClosed]="!!match.isLocked"
                  Size="sm">
                </mjc-type-tile>
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
      flex-shrink: 0;
    }

    .appnav {
      width: 260px;
      border-right: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      display: flex;
      flex-direction: column;
      padding: 8px 6px;
      box-sizing: border-box;
      gap: 2px;
      height: 100%;
      position: relative;
      flex-shrink: 0;
      transition: width 0.14s ease;
      overflow: hidden;
    }

    .appnav.collapsed {
      width: 56px !important;
      padding: 8px 6px;
      align-items: center;
    }

    .nav-resizer {
      position: absolute;
      top: 0;
      right: -3px;
      width: 7px;
      bottom: 0;
      cursor: col-resize;
      z-index: 50;
      transition: background 0.15s ease;
    }
    .nav-resizer:hover,
    .nav-resizer:active {
      background: color-mix(in srgb, var(--mj-brand-primary) 35%, transparent);
    }

    .rail-top {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 2px 6px;
      flex-shrink: 0;
    }
    .appnav.collapsed .rail-top {
      flex-direction: column-reverse;
      margin: 0 0 6px;
      gap: 6px;
      width: 100%;
      align-items: center;
    }

    .jump {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 10px;
      border-radius: var(--mj-radius-md);
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-muted);
      font-size: 12.5px;
      font-family: inherit;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s ease, color 0.15s ease;
    }
    .jump:hover {
      border-color: var(--mj-border-strong);
      color: var(--mj-text-secondary);
    }
    .jump-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .kbd {
      margin-left: auto;
      font-size: 10.5px;
      font-weight: 600;
      color: var(--mj-text-muted);
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-sm);
      padding: 1px 5px;
      background: var(--mj-bg-surface);
      flex-shrink: 0;
    }

    .rail-toggle-btn,
    .rail-icon-btn {
      width: 32px;
      height: 32px;
      border-radius: var(--mj-radius-md);
      border: 1px solid var(--mj-border-default);
      background: transparent;
      color: var(--mj-text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12.5px;
      cursor: pointer;
      flex-shrink: 0;
      font-family: inherit;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .rail-toggle-btn:hover,
    .rail-icon-btn:hover {
      background: var(--mj-bg-surface-hover);
      color: var(--mj-text-primary);
    }

    .nav-primary {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      flex-shrink: 0;
    }
    .appnav.collapsed .nav-primary {
      align-items: center;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 33px;
      padding: 0 10px;
      border-radius: var(--mj-radius-md);
      color: var(--mj-text-secondary);
      font-weight: 500;
      font-size: 13px;
      border: none;
      background: none;
      cursor: pointer;
      width: 100%;
      text-align: left;
      font-family: inherit;
      box-sizing: border-box;
      position: relative;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .appnav.collapsed .nav-item {
      width: 36px;
      height: 36px;
      padding: 0;
      justify-content: center;
    }
    .nav-item:hover {
      background: var(--mj-bg-surface-hover);
      color: var(--mj-text-primary);
    }
    .nav-item i {
      width: 16px;
      text-align: center;
      color: var(--mj-text-muted);
      font-size: 13.5px;
      flex-shrink: 0;
    }
    .nav-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .nav-item.active {
      background: color-mix(in srgb, var(--mj-brand-primary) 11%, transparent);
      color: var(--mj-brand-primary);
      font-weight: 600;
    }
    .nav-item.active i {
      color: var(--mj-brand-primary);
    }
    .nav-item .count {
      margin-left: auto;
      font-size: 11px;
      font-weight: 600;
      color: var(--mj-text-secondary);
      background: var(--mj-bg-surface-sunken);
      border-radius: var(--mj-radius-full);
      padding: 1px 7px;
      flex-shrink: 0;
    }
    .nav-item .count.hot {
      background: var(--mj-brand-primary);
      color: var(--mj-brand-on-primary);
    }

    .collapsed-dot {
      position: absolute;
      top: 5px;
      right: 5px;
      width: 7px;
      height: 7px;
      border-radius: var(--mj-radius-full);
      background: var(--mj-text-muted);
      border: 1.5px solid var(--mj-bg-surface);
    }
    .collapsed-dot.hot {
      background: var(--mj-brand-primary);
    }

    .nav-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 10px 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--mj-text-muted);
      flex-shrink: 0;
    }

    .rail-divider {
      width: 28px;
      height: 1px;
      background: var(--mj-border-default);
      margin: 8px 0 6px;
      flex-shrink: 0;
    }

    .tree-list {
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
    }
    .appnav.collapsed .tree-list {
      align-items: center;
      gap: 4px;
    }

    .tree-item {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 8px 0 22px;
      border-radius: var(--mj-radius-md);
      color: var(--mj-text-secondary);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .tree-item:hover {
      background: var(--mj-bg-surface-hover);
      color: var(--mj-text-primary);
    }
    .tree-item.active {
      background: color-mix(in srgb, var(--mj-brand-primary) 11%, transparent);
      color: var(--mj-brand-primary);
      font-weight: 600;
    }
    .tree-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 5px;
      bottom: 5px;
      width: 3px;
      background: var(--mj-brand-primary);
      border-radius: 0 3px 3px 0;
    }
    .tree-item.dim {
      opacity: 0.55;
    }
    .tree-item.l1 {
      padding-left: 34px;
    }
    .tree-item.l2 {
      padding-left: 48px;
    }
    .tree-item .chev {
      position: absolute;
      left: 5px;
      width: 14px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: var(--mj-text-muted);
    }
    .tree-item.l1 .chev {
      left: 17px;
    }
    .tree-item.l2 .chev {
      left: 31px;
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
      border-radius: var(--mj-radius-full);
      background: var(--mj-brand-primary);
      flex: none;
    }
    .tree-item .meta {
      margin-left: auto;
      font-size: 11px;
      color: var(--mj-text-muted);
      flex-shrink: 0;
    }

    .collapsed-space-tile {
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--mj-radius-md);
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      flex-shrink: 0;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .collapsed-space-tile:hover {
      background: var(--mj-bg-surface-hover);
    }
    .collapsed-space-tile.active {
      background: color-mix(in srgb, var(--mj-brand-primary) 12%, transparent);
      border-color: color-mix(in srgb, var(--mj-brand-primary) 40%, transparent);
    }
    .collapsed-space-tile.dim {
      opacity: 0.55;
    }

    .rail-bottom-collapsed {
      padding-top: 6px;
      border-top: 1px solid var(--mj-border-subtle);
      width: 100%;
      display: flex;
      justify-content: center;
      flex-shrink: 0;
    }

    .jump-scrim {
      position: fixed;
      inset: 0;
      background: var(--mj-bg-overlay);
      z-index: var(--mj-z-modal-backdrop);
    }
    .jump-palette {
      position: fixed;
      top: 96px;
      left: 50%;
      transform: translateX(-50%);
      width: 420px;
      max-width: calc(100vw - 32px);
      background: var(--mj-bg-surface);
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-lg);
      box-shadow: var(--mj-shadow-lg);
      z-index: var(--mj-z-modal);
      padding: 8px;
    }
    .jump-input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-md);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-primary);
      font-family: inherit;
      font-size: 13px;
    }
    .jump-input:focus {
      outline: 2px solid var(--mj-brand-primary);
      outline-offset: -1px;
    }
    .jump-list {
      list-style: none;
      margin: 6px 0 0;
      padding: 0;
      max-height: 320px;
      overflow: auto;
    }
    .jump-item {
      width: 100%;
      text-align: left;
      background: none;
      border: 0;
      padding: 7px 10px;
      cursor: pointer;
      color: var(--mj-text-primary);
      border-radius: var(--mj-radius-md);
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: inherit;
      font-size: 13px;
    }
    .jump-item:hover,
    .jump-item:focus {
      background: var(--mj-bg-surface-hover);
    }
    .jump-none {
      padding: 8px 10px;
      color: var(--mj-text-muted);
      font-size: 13px;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
    `
  ]
})
export class CollabSpaceRailComponent implements OnInit, OnChanges {
  @Input() ActiveNav = '';
  @Input() ActiveSpaceId = '';
  /** The viewer's own open tasks across their spaces: the My tasks link's badge. */
  @Input() MyTaskCount = 0;
  @Input() InboxCount = 0;
  @Input() Spaces: RailSpaceNode[] = [];
  /** The + that starts a space is offered only to someone the host says may start one. */
  @Input() CanCreateSpace = false;

  /** @deprecated The rail always renders the persistent hierarchical Space Tree; space tabs live in `<mjc-space-tabs>`. */
  @Input() Mode: 'home' | 'space' = 'home';
  /** @deprecated Kept for additive backward compatibility with existing callers; unused by the Space Tree rail. */
  @Input() SpaceTitle = '';
  /** @deprecated Kept for additive backward compatibility with existing callers; unused by the Space Tree rail. */
  @Input() SpaceIcon = 'fa-shapes';
  /** @deprecated Kept for additive backward compatibility with existing callers; unused by the Space Tree rail. */
  @Input() SpaceBand: SpaceBand = 'Shared';
  /** @deprecated Kept for additive backward compatibility with existing callers; tabs live in `<mjc-space-tabs>`. */
  @Input() ActiveTab = 'Overview';
  /** @deprecated Kept for additive backward compatibility with existing callers; tabs live in `<mjc-space-tabs>`. */
  @Input() Tabs: TabItem[] = [];
  /** @deprecated Kept for additive backward compatibility with existing callers. */
  @Input() CanConfigure = false;
  /** @deprecated Kept for additive backward compatibility; conversations live inside `<mjc-space-chat>`. */
  @Input() Conversations: SpaceConversationItem[] = [];
  /** @deprecated Kept for additive backward compatibility; conversations live inside `<mjc-space-chat>`. */
  @Input() ActiveConversationId = '';
  /** @deprecated Kept for additive backward compatibility; tab counts live in `<mjc-space-tabs>`. */
  @Input() LibraryCount = 0;
  /** @deprecated Kept for additive backward compatibility; use `MyTaskCount` for the My tasks badge. */
  @Input() TaskCount = 0;
  /** @deprecated Kept for additive backward compatibility; member count lives in `<mjc-space-tabs>`. */
  @Input() MemberCount = 0;
  /** @deprecated Kept for additive backward compatibility; new conversations are started in `<mjc-space-chat>`. */
  @Input() CanStartConversation = false;

  @Output() NavSelectRequested = new EventEmitter<string>();
  @Output() SpaceOpenRequested = new EventEmitter<string>();
  @Output() SpaceToggleRequested = new EventEmitter<RailSpaceNode>();
  @Output() SpaceCreateRequested = new EventEmitter<void>();
  @Output() JumpOpenRequested = new EventEmitter<void>();

  /** @deprecated Kept for additive backward compatibility; tabs emit from `<mjc-space-tabs>`. */
  @Output() TabSelectRequested = new EventEmitter<string>();
  /** @deprecated Kept for additive backward compatibility; conversations emit from `<mjc-space-chat>`. */
  @Output() ConversationSelectRequested = new EventEmitter<string>();
  /** @deprecated Kept for additive backward compatibility; new conversations emit from `<mjc-space-chat>`. */
  @Output() NewConversationRequested = new EventEmitter<void>();
  /** @deprecated Kept for additive backward compatibility; Home is always available in the persistent rail. */
  @Output() BackToSpacesRequested = new EventEmitter<void>();

  @ViewChild('jumpInput') private jumpInput?: ElementRef<HTMLInputElement>;

  public readonly collapsedRailWidth = COLLAPSED_RAIL_WIDTH;
  public navWidth = DEFAULT_RAIL_WIDTH;
  public isCollapsed = false;

  private isDraggingResizer = false;
  private startDragX = 0;
  private startWidth = DEFAULT_RAIL_WIDTH;
  private hasExplicitCollapsePref = false;
  private hasSavedExpandedIds = false;
  private savedExpandedIds = new Set<string>();
  private expandedOverrides = new Map<string, boolean>();
  private lastAutoExpandedActiveSpaceId = '';

  ngOnInit(): void {
    this.loadLayoutPreference();
    this.applySingleSpaceAutoCollapse();
    this.ensureActiveAncestorsExpanded();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['Spaces']) {
      this.applySingleSpaceAutoCollapse();
      this.ensureActiveAncestorsExpanded();
    } else if (changes['ActiveSpaceId']) {
      this.ensureActiveAncestorsExpanded();
    }
  }

  /** Whether the tree row is the open space. Ids are compared as UUIDs: the URL keeps the casing it was given. */
  public IsActiveSpace(spaceId: string): boolean {
    return !!this.ActiveSpaceId && UUIDsEqual(spaceId, this.ActiveSpaceId);
  }

  /** The shortcut shown for the palette: ⌘J on a Mac, Ctrl+J elsewhere. */
  public get JumpHint(): string {
    const platform = typeof navigator !== 'undefined' ? navigator.platform ?? '' : '';
    return /mac|iphone|ipad/i.test(platform) ? '⌘J' : 'Ctrl+J';
  }

  private loadLayoutPreference(): void {
    try {
      const raw = UserInfoEngine.Instance.GetSetting(RAIL_PREF_KEY)
        || UserInfoEngine.Instance.GetSetting(LEGACY_RAIL_PREF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SpaceRailPref>;
      if (typeof parsed.width === 'number') {
        this.navWidth = Math.min(MAX_RAIL_WIDTH, Math.max(MIN_RAIL_WIDTH, parsed.width));
      }
      if (typeof parsed.collapsed === 'boolean') {
        this.isCollapsed = parsed.collapsed;
        this.hasExplicitCollapsePref = true;
      }
      if (Array.isArray(parsed.expandedIds)) {
        this.hasSavedExpandedIds = true;
        this.savedExpandedIds = new Set(
          parsed.expandedIds
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
            .map((id) => id.toLowerCase()),
        );
      }
    } catch (error) {
      LogError(`The saved rail layout could not be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private persistLayoutPreference(): void {
    const expandedIds = this.Spaces
      .filter((s) => s.hasChildren && this.isNodeExpanded(s))
      .map((s) => s.id);
    const pref: SpaceRailPref = {
      width: this.navWidth,
      collapsed: this.isCollapsed,
      expandedIds,
    };
    UserInfoEngine.Instance.SetSettingDebounced(RAIL_PREF_KEY, JSON.stringify(pref));
  }

  /** When a user only has access to 1 space total and hasn't saved an explicit collapse preference, default collapsed. */
  private applySingleSpaceAutoCollapse(): void {
    if (this.hasExplicitCollapsePref) return;
    if (this.Spaces.length === 1) {
      this.isCollapsed = true;
    } else if (this.Spaces.length > 1) {
      this.isCollapsed = false;
    }
  }

  /** Auto-expands ancestor chain of ActiveSpaceId so nested spaces stay visible and 1-click switchable. */
  private ensureActiveAncestorsExpanded(): void {
    if (!this.ActiveSpaceId || this.Spaces.length === 0) return;
    const normalizedActive = this.ActiveSpaceId.toLowerCase();
    const activeIndex = this.Spaces.findIndex((s) => UUIDsEqual(s.id, this.ActiveSpaceId));
    if (activeIndex < 0) return;
    if (this.lastAutoExpandedActiveSpaceId === normalizedActive) return;
    this.lastAutoExpandedActiveSpaceId = normalizedActive;

    let currentLevel = this.Spaces[activeIndex].level ?? 0;
    for (let i = activeIndex - 1; i >= 0 && currentLevel > 0; i--) {
      const candidate = this.Spaces[i];
      const candidateLevel = candidate.level ?? 0;
      if (candidateLevel < currentLevel) {
        if (candidate.hasChildren) {
          this.expandedOverrides.set(candidate.id.toLowerCase(), true);
        }
        currentLevel = candidateLevel;
      }
    }
  }

  public toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.hasExplicitCollapsePref = true;
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
    if (newWidth >= MIN_RAIL_WIDTH && newWidth <= MAX_RAIL_WIDTH) {
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
    this.expandedOverrides.set(s.id.toLowerCase(), !current);
    this.persistLayoutPreference();
    this.SpaceToggleRequested.emit(s);
  }

  public isNodeExpanded(s: RailSpaceNode): boolean {
    const key = s.id.toLowerCase();
    if (this.expandedOverrides.has(key)) {
      return this.expandedOverrides.get(key)!;
    }
    if (this.hasSavedExpandedIds) {
      return this.savedExpandedIds.has(key);
    }
    return s.isExpanded ?? false;
  }

  public onArrowRight(s: RailSpaceNode, event: Event): void {
    if (s.hasChildren && !this.isNodeExpanded(s)) {
      event.preventDefault();
      this.expandedOverrides.set(s.id.toLowerCase(), true);
      this.persistLayoutPreference();
      this.SpaceToggleRequested.emit(s);
    }
  }

  public onArrowLeft(s: RailSpaceNode, event: Event): void {
    if (s.hasChildren && this.isNodeExpanded(s)) {
      event.preventDefault();
      this.expandedOverrides.set(s.id.toLowerCase(), false);
      this.persistLayoutPreference();
      this.SpaceToggleRequested.emit(s);
    }
  }

  get visibleSpaces(): RailSpaceNode[] {
    const result: RailSpaceNode[] = [];
    const stack: { level: number; expanded: boolean }[] = [];

    for (const s of this.Spaces) {
      const level = s.level ?? 0;
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const isVisible = stack.every((a) => a.expanded);
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
