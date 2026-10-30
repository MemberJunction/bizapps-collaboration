import { Component, ElementRef, EventEmitter, Input, Output, OnInit, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogError } from '@memberjunction/core';
import { MJButtonDirective, MJClickableDirective } from '@memberjunction/ng-ui-components';
import { UUIDsEqual } from '@memberjunction/global';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { CollabTypeTileComponent } from './type-tile.component';
import { CollabBandChipComponent } from './band-chip.component';
import { RailSpaceNode, SpaceBand, TabItem, SpaceConversationItem } from './types';
import { SubSpaceSummary } from './space-overview.component';
import { COLLAB_TOKENS_CSS } from './tokens';

interface SpaceNavPref {
  width: number;
  collapsed: boolean;
}

export interface SpaceRailCustomPage {
  id: string;
  title: string;
  iconClass: string;
  band: SpaceBand;
  isDraft?: boolean;
}

export interface TreeGuideInfo {
  ancestorCols: boolean[];
  isSubSpace: boolean;
  isLastSibling: boolean;
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
  imports: [CommonModule, CollabTypeTileComponent, CollabBandChipComponent, MJButtonDirective, MJClickableDirective],
  template: `
    @if (Mode === 'space') {
      <!-- Unified Space Workspace Rail -->
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

        <!-- Space Identity & Back Link -->
        <div class="space-identity-box">
          @if (!isCollapsed) {
            <div class="space-identity-left">
              <div class="rail-top-bar">
                <button
                  type="button"
                  mjButton Variant="flat" Size="sm" class="btn-back-spaces"
                  (click)="onBackToSpaces()"
                  title="Back to All Spaces home">
                  <i class="fa-solid fa-arrow-left"></i>
                  <span>All Spaces</span>
                </button>
              </div>

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
              [mjClickable]="'Return to All Spaces from ' + SpaceTitle"
              (click)="onBackToSpaces()"
              [title]="SpaceTitle + ' - Click to return to All Spaces'">
              <i class="fa-solid" [class]="SpaceIcon || 'fa-shapes'"></i>
            </div>
          }

          <button
            type="button"
            mjButton Variant="icon" Size="sm" class="btn-nav-toggle"
            (click)="toggleCollapse()"
            [title]="isCollapsed ? 'Expand navigation' : 'Collapse navigation'">
            <i class="fa-solid" [class]="isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"></i>
          </button>
        </div>

        <!-- Space Navigation Body -->
        <div class="space-nav-body">

          <!-- Customizable Space Pages (Built-in pages like Overview, Documents/Library, Work, etc. + Added Custom Pages) -->
          <div class="nav-section-group">
            @if (!isCollapsed) {
              <div class="section-title-row">
                <span class="section-title">PAGES</span>
                @if (CanEditPages) {
                  <div class="section-title-actions">
                    <button
                      type="button"
                      mjButton Variant="icon" Size="sm"
                      class="btn-add-section"
                      [class.active-customize]="IsCustomizingPages"
                      (click)="onToggleCustomizePages()"
                      [title]="IsCustomizingPages ? 'Done customizing page' : 'Customize current page layout & blocks'"
                      [attr.aria-label]="IsCustomizingPages ? 'Done customizing page' : 'Customize current page'">
                      <i class="fa-solid" [class]="IsCustomizingPages ? 'fa-check' : 'fa-pen-ruler'"></i>
                    </button>
                    <button
                      type="button"
                      mjButton Variant="icon" Size="sm" class="btn-add-section"
                      (click)="onNewPage()"
                      title="Add a new customizable page"
                      aria-label="Add a new customizable page">
                      <i class="fa-solid fa-plus"></i>
                    </button>
                  </div>
                }
              </div>
            }

            <div class="nav-links-list">
              @for (tab of PrimaryTabs; track tab.id) {
                <button
                  type="button"
                  class="space-nav-link"
                  [class.active]="ActiveTab === tab.id"
                  [attr.aria-current]="ActiveTab === tab.id ? 'page' : null"
                  (click)="onTabClick(tab.id)"
                  [title]="isCollapsed ? tab.label : ''"
                  [attr.aria-label]="isCollapsed ? tab.label : null">
                  <i class="fa-solid link-icon" [class]="tab.iconClass || 'fa-layer-group'" aria-hidden="true"></i>
                  @if (!isCollapsed) {
                    <span class="link-label">{{ tab.label }}</span>
                    @if (BadgeFor(tab) > 0) {
                      <span class="link-badge">{{ BadgeFor(tab) }}</span>
                    }
                  }
                </button>
              }

              <!-- Added Custom Pages in the Space -->
              @for (cp of CustomPages; track cp.id) {
                <button
                  type="button"
                  class="space-nav-link custom-page-link"
                  [class.active]="ActiveTab === 'page:' + cp.id"
                  [attr.aria-current]="ActiveTab === 'page:' + cp.id ? 'page' : null"
                  (click)="onTabClick('page:' + cp.id)"
                  [title]="isCollapsed ? cp.title : cp.title">
                  <i class="fa-solid link-icon" [class]="cp.iconClass || 'fa-file-lines'" aria-hidden="true"></i>
                  @if (!isCollapsed) {
                    <span class="link-label">{{ cp.title }}</span>
                    @if (cp.isDraft) {
                      <span class="draft-dot" title="Unpublished draft changes"></span>
                    }
                    <span
                      class="band-dot"
                      [class.shared]="cp.band === 'Shared'"
                      [class.team]="cp.band === 'Team'"
                      [title]="cp.band === 'Shared' ? 'Shared page' : 'Team-only page'">
                    </span>
                  }
                </button>
              }

              @if (SettingsTab; as settingsTab) {
                @if (CanConfigure) {
                  <button
                    type="button"
                    class="space-nav-link"
                    [class.active]="ActiveTab === settingsTab.id"
                    [attr.aria-current]="ActiveTab === settingsTab.id ? 'page' : null"
                    (click)="onTabClick(settingsTab.id)"
                    [title]="isCollapsed ? settingsTab.label : ''"
                    [attr.aria-label]="isCollapsed ? settingsTab.label : null">
                    <i class="fa-solid link-icon" [class]="settingsTab.iconClass || 'fa-sliders'" aria-hidden="true"></i>
                    @if (!isCollapsed) {
                      <span class="link-label">{{ settingsTab.label }}</span>
                    }
                  </button>
                }
              }
            </div>
          </div>

          <!-- Space Conversations Section: only for a space whose type has Chat -->
          @if (HasChatTab) {
          <div class="nav-section-group">
            @if (!isCollapsed) {
              <div class="section-title-row">
                <span class="section-title">CONVERSATIONS</span>
                @if (CanStartConversation) {
                  <button
                    type="button"
                    mjButton Variant="icon" Size="sm" class="btn-add-section"
                    (click)="onNewConversation()"
                    title="New Conversation or Workstream"
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
                    mjButton Variant="icon" Size="sm" class="btn-collapsed-add"
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
                  } @else if (c.kind === 'Topic') {
                    <i class="fa-solid fa-bullseye link-icon topic-ic"></i>
                  } @else {
                    <span class="convo-hash-prefix">#</span>
                  }

                  @if (!isCollapsed) {
                    <span class="link-label">{{ c.name }}</span>
                    <span
                      class="band-dot"
                      [class.shared]="c.band === 'Shared'"
                      [class.team]="c.band === 'Team'"
                      [title]="c.band === 'Shared' ? 'Everyone in this space can see it' : 'Team only'">
                    </span>
                  }
                </button>
              }
            </div>
          </div>
          }

          <!-- Collapsible Spaces Switcher at bottom of Space Rail (collapsed by default to avoid clutter) -->
          @if (!isCollapsed && Spaces && Spaces.length > 0) {
            <div class="nav-section-group spaces-tree-group">
              <div class="section-title-row">
                <button
                  type="button"
                  class="section-toggle-btn"
                  [attr.aria-expanded]="showSpacesTreeInWorkspace"
                  (click)="showSpacesTreeInWorkspace = !showSpacesTreeInWorkspace">
                  <i class="fa-solid" [class]="showSpacesTreeInWorkspace ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                  <span class="section-title">SWITCH SPACE</span>
                </button>
                @if (CanCreateSpace && showSpacesTreeInWorkspace) {
                  <button
                    type="button"
                    mjButton Variant="icon" Size="sm" class="btn-add-section"
                    (click)="SpaceCreateRequested.emit()"
                    title="New Space"
                    aria-label="New Space">
                    <i class="fa-solid fa-plus"></i>
                  </button>
                }
              </div>

              @if (showSpacesTreeInWorkspace) {
                <div class="tree-list">
                  @for (s of visibleSpaces; track s.id) {
                    @let guides = treeGuidesFor($index);
                    <div
                      class="tree-item {{ guides.isSubSpace ? 'is-subspace' : 'is-root' }} {{ IsActiveSpace(s.id) ? 'active' : '' }} {{ s.isDim ? 'dim' : '' }}"
                      [mjClickable]="s.name"
                      [attr.aria-expanded]="s.hasChildren ? isNodeExpanded(s) : null"
                      (keydown.arrowright)="onArrowRight(s, $event)"
                      (keydown.arrowleft)="onArrowLeft(s, $event)"
                      (click)="selectSpace(s.id)">
                      @if (guides.isSubSpace) {
                        <span class="tree-guides" aria-hidden="true">
                          @for (cont of guides.ancestorCols; track $index) {
                            <span class="tree-guide-col" [class.continuation]="cont"></span>
                          }
                          <span class="tree-elbow" [class.last]="guides.isLastSibling"></span>
                        </span>
                      }
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
                      <span class="ellipsis">{{ s.name }}</span>
                      @if (s.unread) {
                        <span class="unread"></span>
                      } @else if (s.isLocked) {
                        <span class="meta"><i class="fa-solid fa-lock" aria-hidden="true"></i><span class="sr-only">(closed)</span></span>
                      } @else if (s.meta !== undefined && s.meta !== null && s.meta !== '') {
                        <span class="meta">{{ s.meta }}</span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }

        </div>

        @if (!isCollapsed) {
          <div class="space-nav-footer">
            <span class="footer-sync"><i class="fa-solid fa-cloud"></i> Preferences synced</span>
          </div>
        }

      </nav>
    } @else {
      <!-- Default Collab Home Rail (Global Directory & Tools) -->
      <nav
        class="appnav"
        [class.collapsed]="isCollapsed"
        [style.width.px]="isCollapsed ? 58 : navWidth"
        aria-label="Collaboration Navigation">
        @if (!isCollapsed) {
          <div
            class="nav-resizer"
            (mousedown)="onResizerMouseDown($event)"
            title="Drag to resize navigation">
          </div>
        }

        <div class="home-rail-top">
          @if (!isCollapsed) {
            <div class="jump" [mjClickable]="'Jump to a space'" (click)="onJumpClick()">
              <i class="fa-solid fa-magnifying-glass"></i>
              <span>Jump to a space</span>
              <span class="kbd">{{ JumpHint }}</span>
            </div>
          }
          <button
            type="button"
            mjButton Variant="icon" Size="sm" class="btn-nav-toggle"
            (click)="toggleCollapse()"
            [title]="isCollapsed ? 'Expand navigation' : 'Collapse navigation'">
            <i class="fa-solid" [class]="isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"></i>
          </button>
        </div>

        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'home'"
          [title]="isCollapsed ? 'Home' : ''"
          (click)="selectNav('home')">
          <i class="fa-solid fa-house"></i>
          @if (!isCollapsed) {
            <span>Home</span>
          }
        </button>

        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'inbox'"
          [title]="isCollapsed ? 'Inbox' : ''"
          (click)="selectNav('inbox')">
          <i class="fa-solid fa-inbox"></i>
          @if (!isCollapsed) {
            <span>Inbox</span>
            @if (InboxCount > 0) {
              <span class="count hot">{{ InboxCount }}</span>
            }
          }
        </button>

        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'tasks'"
          [title]="isCollapsed ? 'My tasks' : ''"
          (click)="selectNav('tasks')">
          <i class="fa-solid fa-list-check"></i>
          @if (!isCollapsed) {
            <span>My tasks</span>
            @if (TaskCount > 0) {
              <span class="count">{{ TaskCount }}</span>
            }
          }
        </button>

        <button
          type="button"
          class="nav-item"
          [class.active]="ActiveNav === 'files'"
          [title]="isCollapsed ? 'Recent files' : ''"
          (click)="selectNav('files')">
          <i class="fa-solid fa-folder-open"></i>
          @if (!isCollapsed) {
            <span>Recent files</span>
          }
        </button>

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
                <i class="fa-solid fa-plus"></i>
              </button>
            }
          </div>

          <div class="tree-list">
            @for (s of visibleSpaces; track s.id) {
              @let guides = treeGuidesFor($index);
              <div
                class="tree-item {{ guides.isSubSpace ? 'is-subspace' : 'is-root' }} {{ IsActiveSpace(s.id) ? 'active' : '' }} {{ s.isDim ? 'dim' : '' }}"
                [mjClickable]="s.name"
                [attr.aria-expanded]="s.hasChildren ? isNodeExpanded(s) : null"
                (keydown.arrowright)="onArrowRight(s, $event)"
                (keydown.arrowleft)="onArrowLeft(s, $event)"
                (click)="selectSpace(s.id)">
                @if (guides.isSubSpace) {
                  <span class="tree-guides" aria-hidden="true">
                    @for (cont of guides.ancestorCols; track $index) {
                      <span class="tree-guide-col" [class.continuation]="cont"></span>
                    }
                    <span class="tree-elbow" [class.last]="guides.isLastSibling"></span>
                  </span>
                }
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
                <span class="ellipsis">{{ s.name }}</span>
                @if (s.unread) {
                  <span class="unread"></span>
                } @else if (s.isLocked) {
                  <span class="meta"><i class="fa-solid fa-lock" aria-hidden="true"></i><span class="sr-only">(closed)</span></span>
                } @else if (s.meta !== undefined && s.meta !== null && s.meta !== '') {
                  <span class="meta">{{ s.meta }}</span>
                }
              </div>
            }
          </div>
        }

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
      padding: 10px 12px;
      border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 6px;
      flex-shrink: 0;
    }
    .space-nav.collapsed .space-identity-box {
      padding: 10px 6px;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .space-identity-left {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      flex: 1;
    }

    .rail-top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }
    .rail-quick-tools {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .rail-quick-btn {
      border: none;
      background: transparent;
      color: var(--mj-text-muted);
      width: 26px;
      height: 26px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    .rail-quick-btn:hover {
      background: var(--mj-bg-surface-hover);
      color: var(--mj-brand-primary);
    }

    .parent-space-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid var(--mj-border-subtle, var(--mj-border-default));
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-secondary);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
      max-width: 100%;
    }
    .parent-space-link:hover {
      border-color: var(--mj-brand-primary);
      color: var(--mj-brand-primary);
    }
    .parent-space-link .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* MJ's buttons draw these controls; only their place in the rail is set here */
    .btn-back-spaces { align-self: flex-start; padding-left: 0; }
    .btn-nav-toggle { flex-shrink: 0; }

    .space-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .space-avatar-tile {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--mj-brand-secondary, #0891b2), var(--mj-brand-primary, #0076b6));
      color: var(--mj-text-inverse);
      display: grid;
      place-items: center;
      font-size: 13.5px;
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

    .space-nav-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .space-nav.collapsed .space-nav-body {
      padding: 10px 4px;
      align-items: center;
    }

    .nav-section-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
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

    .section-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: none;
      background: transparent;
      padding: 0;
      cursor: pointer;
      color: var(--mj-text-muted);
      font-size: 10px;
    }
    .section-toggle-btn:hover .section-title {
      color: var(--mj-text-primary);
    }

    .collapsed-add-row {
      display: flex;
      justify-content: center;
      padding: 4px 0;
    }

    .nav-links-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .space-nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 36px;
      padding: 7px 12px;
      border-radius: 8px;
      color: var(--mj-text-secondary, #475569);
      font-size: 13.5px;
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

    .section-title-actions {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }

    .btn-add-section.active-customize {
      color: var(--mj-brand-primary, #0076b6);
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 14%, transparent);
    }

    .draft-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--mj-status-warning, #f59e0b);
      flex-shrink: 0;
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
    .topic-ic {
      color: var(--mj-brand-tertiary, #059669);
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

    .spaces-tree-group {
      margin-top: auto;
      border-top: 1px solid var(--mj-border-subtle, var(--mj-border-default));
      padding-top: 8px;
    }

    .space-nav-footer {
      padding: 8px 14px;
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
      width: 240px;
      border-right: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      display: flex;
      flex-direction: column;
      padding: 8px 6px;
      box-sizing: border-box;
      gap: 2px;
      height: 100%;
      user-select: none;
      position: relative;
      flex-shrink: 0;
    }
    .appnav.collapsed {
      width: 58px !important;
      align-items: center;
    }
    .home-rail-top {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 6px;
      width: 100%;
    }
    .appnav.collapsed .home-rail-top {
      justify-content: center;
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
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 10px;
      border-radius: var(--mj-radius-md, 8px);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-muted);
      font-size: 12.5px;
      cursor: pointer;
      min-width: 0;
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
    .appnav.collapsed .nav-item {
      justify-content: center;
      padding: 0;
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
    .tree-list {
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 2px 0;
    }
    .tree-item {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      min-height: 36px;
      padding: 0 10px 0 8px;
      border-radius: var(--mj-radius-md, 8px);
      color: var(--mj-text-secondary);
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      position: relative;
      box-sizing: border-box;
      flex-shrink: 0;
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

    /* ─── Hierarchy Tree Connector Lines (│, ├─, └─) for Sub-spaces ─────── */
    .tree-guides {
      display: inline-flex;
      align-items: stretch;
      height: 36px;
      flex-shrink: 0;
      margin-left: 4px;
    }
    .tree-guide-col {
      position: relative;
      width: 16px;
      height: 36px;
      flex-shrink: 0;
    }
    .tree-guide-col.continuation::before {
      content: '';
      position: absolute;
      left: 7px;
      top: -6px;
      bottom: 0;
      width: 1.5px;
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 28%, var(--mj-border-default, #cbd5e1));
    }
    .tree-elbow {
      position: relative;
      width: 16px;
      height: 36px;
      flex-shrink: 0;
    }
    .tree-elbow::before {
      content: '';
      position: absolute;
      left: 7px;
      top: -6px;
      bottom: 0;
      width: 1.5px;
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 35%, var(--mj-border-default, #cbd5e1));
    }
    .subspace-branch-list .subspace-nav-link:first-child .tree-elbow::before {
      top: 0;
    }
    .tree-elbow.last::before {
      bottom: 50%;
    }
    .tree-elbow::after {
      content: '';
      position: absolute;
      left: 7px;
      top: 50%;
      width: 8px;
      height: 1.5px;
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 35%, var(--mj-border-default, #cbd5e1));
    }
    .tree-item.active .tree-elbow::before,
    .tree-item.active .tree-elbow::after,
    .tree-item:hover .tree-elbow::before,
    .tree-item:hover .tree-elbow::after {
      background: var(--mj-brand-primary, #0076b6);
    }

    .tree-item .chev {
      width: 14px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: var(--mj-text-muted);
      flex-shrink: 0;
    }
    .tree-item.is-subspace .chev:empty {
      display: none;
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

    .tree-item .meta {
      margin-left: auto;
      font-size: 11.5px;
      color: var(--mj-text-muted);
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
  /** The tabs of the space shown, as its type arranged them: the rail lists these alongside any custom pages. */
  @Input() Tabs: TabItem[] = DEFAULT_RAIL_TABS;
  /** Additional custom pages created in this space, shown right in the PAGES navigation list. */
  @Input() CustomPages: SpaceRailCustomPage[] = [];
  /** Whether the viewer can add/customize pages in this space (restricted to authorized space admins). */
  @Input() CanEditPages = false;
  /** True when the space admin is currently in Page Studio / Customize Mode. */
  @Input() IsCustomizingPages = false;

  /** Whether the caller may configure this space. Settings is offered only to those who can. */
  @Input() CanConfigure = false;
  @Input() Conversations: SpaceConversationItem[] = [];
  @Input() ActiveConversationId = '';
  @Input() SubSpaces: SubSpaceSummary[] = [];
  @Input() CanAddSubSpace = false;
  @Input() ParentSpaceId = '';
  @Input() ParentSpaceName = '';
  @Input() PagesCount = 0;

  /** Whether the tree row is the open space. Ids are compared as UUIDs: the URL keeps the casing it was given. */
  public IsActiveSpace(spaceId: string): boolean {
    return !!this.ActiveSpaceId && UUIDsEqual(spaceId, this.ActiveSpaceId);
  }

  public IsActiveConversation(conversationId: string): boolean {
    return !!this.ActiveConversationId && UUIDsEqual(conversationId, this.ActiveConversationId);
  }
  @Input() LibraryCount = 0;
  @Input() TaskCount = 0;
  @Input() MemberCount = 0;
  @Input() InboxCount = 0;
  @Input() Spaces: RailSpaceNode[] = [];
  @Input() CanStartConversation = false;
  /** The + that starts a space is offered only to someone the host says may start one. */
  @Input() CanCreateSpace = false;

  @Output() NavSelectRequested = new EventEmitter<string>();
  @Output() SpaceOpenRequested = new EventEmitter<string>();
  @Output() SpaceToggleRequested = new EventEmitter<RailSpaceNode>();
  @Output() SpaceCreateRequested = new EventEmitter<void>();
  @Output() SubSpaceCreateRequested = new EventEmitter<void>();
  @Output() NewPageRequested = new EventEmitter<void>();
  @Output() CustomizePagesToggleRequested = new EventEmitter<void>();
  @Output() JumpOpenRequested = new EventEmitter<void>();

  @Output() TabSelectRequested = new EventEmitter<string>();
  @Output() ConversationSelectRequested = new EventEmitter<string>();
  @Output() NewConversationRequested = new EventEmitter<void>();
  @Output() BackToSpacesRequested = new EventEmitter<void>();

  @ViewChild('jumpInput') private jumpInput?: ElementRef<HTMLInputElement>;

  public navWidth = 264;
  public isCollapsed = false;
  public showSpacesTreeInWorkspace = false;
  private isDraggingResizer = false;
  private startDragX = 0;
  private startWidth = 264;

  ngOnInit(): void {
    this.loadLayoutPreference();
  }

  /** Built-in tabs excluding Settings so custom pages sit right before Settings. */
  public get PrimaryTabs(): TabItem[] {
    return this.Tabs.filter((tab) => tab.id !== 'Settings');
  }

  public get SettingsTab(): TabItem | undefined {
    return this.Tabs.find((tab) => tab.id === 'Settings');
  }

  /** Whether the space's type has a Chat tab: without one the rail lists no conversations. */
  public get HasChatTab(): boolean {
    return this.Tabs.some((tab) => tab.id === 'Chat');
  }

  /** The shortcut shown for the palette: ⌘J on a Mac, Ctrl+J elsewhere. */
  public get JumpHint(): string {
    const platform = typeof navigator !== 'undefined' ? navigator.platform ?? '' : '';
    return /mac|iphone|ipad/i.test(platform) ? '⌘J' : 'Ctrl+J';
  }

  /** The count a tab's link shows: the library's items, the tasks, the people, or the tab's own. */
  public BadgeFor(tab: TabItem): number {
    switch (tab.id) {
      case 'Pages': return this.PagesCount;
      case 'Library': return this.LibraryCount;
      case 'Work': return this.TaskCount;
      case 'People': return this.MemberCount;
      default: return tab.count ?? 0;
    }
  }

  public onNewConversation(): void {
    this.NewConversationRequested.emit();
  }

  public onNewSubSpace(): void {
    this.SubSpaceCreateRequested.emit();
  }

  public onNewPage(): void {
    this.NewPageRequested.emit();
  }

  public onToggleCustomizePages(): void {
    this.CustomizePagesToggleRequested.emit();
  }

  /**
   * Computes tree connector line info (`│`, `├─`, `└─`) for each visible space row
   * so sub-spaces are visually linked to their parent space.
   */
  public treeGuidesFor(index: number): TreeGuideInfo {
    const list = this.visibleSpaces;
    const node = list[index];
    const level = node?.level ?? 0;
    if (!node || level <= 0) {
      return { ancestorCols: [], isSubSpace: false, isLastSibling: true };
    }

    const hasSiblingBelowAtDepth = (depth: number): boolean => {
      for (let j = index + 1; j < list.length; j++) {
        const nextLevel = list[j].level ?? 0;
        if (nextLevel < depth) return false;
        if (nextLevel === depth) return true;
      }
      return false;
    };

    const ancestorCols: boolean[] = [];
    for (let d = 1; d < level; d++) {
      ancestorCols.push(hasSiblingBelowAtDepth(d));
    }

    const isLastSibling = !hasSiblingBelowAtDepth(level);
    return {
      ancestorCols,
      isSubSpace: true,
      isLastSibling,
    };
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
    } catch (error) {
      // A saved layout that doesn't parse leaves the default one, and is said so
      LogError(`The saved rail layout could not be read: ${error instanceof Error ? error.message : String(error)}`);
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
