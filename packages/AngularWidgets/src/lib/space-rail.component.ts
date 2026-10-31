import { Component, ElementRef, EventEmitter, Input, Output, OnInit, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LogError } from '@memberjunction/core';
import { MJButtonDirective, MJClickableDirective } from '@memberjunction/ng-ui-components';
import { UUIDsEqual } from '@memberjunction/global';
import { UserInfoEngine } from '@memberjunction/core-entities';
import { CollabTypeTileComponent } from './type-tile.component';
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
  imports: [CommonModule, CollabTypeTileComponent, MJButtonDirective, MJClickableDirective],
  template: `
    <nav
      class="rail"
      [class.space-nav]="Mode === 'space'"
      [class.appnav]="Mode === 'home'"
      [class.collapsed]="isCollapsed"
      [style.width.px]="isCollapsed ? 56 : navWidth"
      [attr.aria-label]="Mode === 'space' ? 'Space Workspace Navigation' : 'Collaboration Navigation'">

      @if (!isCollapsed) {
        <div
          class="nav-resizer"
          (mousedown)="onResizerMouseDown($event)"
          title="Drag to resize navigation">
        </div>
      }

      <!-- Head: Unified Space Switcher -->
      <div class="rail-head">
        <button
          type="button"
          class="rail-switcher"
          data-testid="rail-space-switcher"
          [class.collapsed-tile]="isCollapsed"
          [class.open]="jumpOpen"
          [attr.aria-expanded]="jumpOpen"
          aria-haspopup="dialog"
          [title]="isCollapsed ? switcherLabel : 'Switch space (' + JumpHint + ')'"
          [attr.aria-label]="isCollapsed ? switcherLabel : null"
          (click)="onJumpClick()">
          @if (Mode === 'space') {
            <mjc-type-tile
              [IconClass]="computedSpaceIcon"
              [Color]="resolvedSpaceColor"
              [IsClosed]="resolvedSpaceClosed"
              Size="sm">
            </mjc-type-tile>
          } @else {
            <span class="switcher-home-tile" aria-hidden="true">
              <i class="fa-solid fa-layer-group"></i>
            </span>
          }
          @if (!isCollapsed) {
            <span class="switcher-title">{{ switcherLabel }}</span>
            <i class="fa-solid fa-chevron-down switcher-chev" [class.open]="jumpOpen" aria-hidden="true"></i>
          }
        </button>

        <button
          type="button"
          mjButton Variant="icon" Size="sm" class="btn-nav-toggle"
          (click)="toggleCollapse()"
          [title]="isCollapsed ? 'Expand navigation' : 'Collapse navigation'"
          [attr.aria-label]="isCollapsed ? 'Expand navigation' : 'Collapse navigation'">
          <i class="fa-solid" [class]="isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'" aria-hidden="true"></i>
        </button>

        @if (jumpOpen) {
          <div class="jump-scrim" (click)="closeJump()"></div>
          <div class="switcher-popover" data-testid="rail-switcher-popover" role="dialog" aria-modal="true" aria-label="Jump to a space">
            <div class="switcher-search-wrap">
              <i class="fa-solid fa-magnifying-glass switcher-search-icon" aria-hidden="true"></i>
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
              <span class="kbd">{{ JumpHint }}</span>
            </div>

            <button
              type="button"
              class="rail-row switcher-all-spaces"
              data-testid="switcher-all-spaces"
              [class.active]="Mode === 'home' && ActiveNav === 'home'"
              (click)="onSelectAllSpaces()">
              <i class="fa-solid fa-house row-icon" aria-hidden="true"></i>
              <span class="row-label">All spaces</span>
            </button>

            <div class="switcher-divider"></div>

            <div class="tree-list switcher-tree">
              @if (hasJumpQuery) {
                @for (match of jumpMatches; track match.id) {
                  <button
                    type="button"
                    class="rail-row jump-item"
                    [class.active]="IsActiveSpace(match.id)"
                    (click)="jumpTo(match)">
                    <mjc-type-tile
                      [IconClass]="match.iconClass"
                      [Color]="match.color || ''"
                      [IsClosed]="!!match.isLocked"
                      Size="sm">
                    </mjc-type-tile>
                    <span class="row-label">{{ match.name }}</span>
                    @if (match.isStarred) {
                      <i class="fa-solid fa-star row-star" aria-hidden="true"></i>
                    }
                  </button>
                }
                @if (jumpMatches.length === 0) {
                  <div class="jump-none">No space matches.</div>
                }
              } @else {
                @if (starredSpaces.length > 0) {
                  <div class="switcher-starred-group" data-testid="switcher-starred-spaces">
                    <div class="switcher-group-label">Starred</div>
                    @for (st of starredSpaces; track st.id) {
                      <button
                        type="button"
                        class="rail-row jump-item"
                        [class.active]="IsActiveSpace(st.id)"
                        (click)="jumpTo(st)">
                        <mjc-type-tile
                          [IconClass]="st.iconClass"
                          [Color]="st.color || ''"
                          [IsClosed]="!!st.isLocked"
                          Size="sm">
                        </mjc-type-tile>
                        <span class="row-label ellipsis">{{ st.name }}</span>
                        <i class="fa-solid fa-star row-star" aria-hidden="true"></i>
                      </button>
                    }
                  </div>
                  <div class="switcher-divider"></div>
                }
                @for (s of visibleSpaces; track s.id) {
                  @let guides = treeGuidesFor($index);
                  <div
                    class="tree-item rail-row {{ guides.isSubSpace ? 'is-subspace' : 'is-root' }} {{ IsActiveSpace(s.id) ? 'active' : '' }} {{ s.isDim ? 'dim' : '' }}"
                    [mjClickable]="s.name"
                    [attr.aria-expanded]="s.hasChildren ? isNodeExpanded(s) : null"
                    (keydown.arrowright)="onArrowRight(s, $event)"
                    (keydown.arrowleft)="onArrowLeft(s, $event)"
                    (click)="jumpTo(s)">
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
                    <span class="row-label ellipsis">{{ s.name }}</span>
                    @if (s.isStarred) {
                      <i class="fa-solid fa-star row-star" aria-hidden="true"></i>
                    }
                    @if (s.unread) {
                      <span class="unread"></span>
                    } @else if (s.isLocked) {
                      <span class="meta"><i class="fa-solid fa-lock" aria-hidden="true"></i><span class="sr-only">(closed)</span></span>
                    } @else if (s.meta !== undefined && s.meta !== null && s.meta !== '') {
                      <span class="meta">{{ s.meta }}</span>
                    }
                  </div>
                }
                @if (visibleSpaces.length === 0) {
                  <div class="jump-none">No spaces available.</div>
                }
              }
            </div>

            @if (CanCreateSpace) {
              <div class="switcher-foot">
                <button
                  type="button"
                  class="rail-row switcher-create-btn"
                  (click)="onCreateSpaceFromSwitcher()">
                  <i class="fa-solid fa-plus row-icon" aria-hidden="true"></i>
                  <span class="row-label">New space</span>
                </button>
              </div>
            }
          </div>
        }
      </div>

      <!-- Rail Body -->
      <div class="rail-body">
        @if (Mode === 'space') {
          <!-- Group 1: Pages -->
          <div class="rail-group nav-section-group">
            @if (!isCollapsed) {
              <div class="rail-group-head section-title-row">
                <span class="rail-group-label section-title">Pages</span>
              </div>
            }

            <div class="rail-group-list nav-links-list">
              @for (tab of PrimaryTabs; track tab.id) {
                <button
                  type="button"
                  class="rail-row space-nav-link"
                  [class.active]="ActiveTab === tab.id"
                  [attr.aria-current]="ActiveTab === tab.id ? 'page' : null"
                  (click)="onTabClick(tab.id)"
                  [title]="isCollapsed ? tab.label : ''"
                  [attr.aria-label]="isCollapsed ? tab.label : null">
                  <i class="fa-solid row-icon link-icon" [class]="tab.iconClass || 'fa-layer-group'" aria-hidden="true"></i>
                  @if (!isCollapsed) {
                    <span class="row-label link-label">{{ tab.label }}</span>
                    @if (BadgeFor(tab) > 0) {
                      <span class="row-count link-badge">{{ BadgeFor(tab) }}</span>
                    }
                  }
                </button>
              }

              @for (cp of CustomPages; track cp.id) {
                <button
                  type="button"
                  class="rail-row space-nav-link custom-page-link"
                  [class.active]="ActiveTab === 'page:' + cp.id"
                  [attr.aria-current]="ActiveTab === 'page:' + cp.id ? 'page' : null"
                  (click)="onTabClick('page:' + cp.id)"
                  [title]="isCollapsed ? cp.title : ''"
                  [attr.aria-label]="isCollapsed ? cp.title : null">
                  <i class="fa-solid row-icon link-icon" [class]="cp.iconClass || 'fa-file-lines'" aria-hidden="true"></i>
                  @if (!isCollapsed) {
                    <span class="row-label link-label">{{ cp.title }}</span>
                  }
                </button>
              }
            </div>
          </div>

          <!-- Group 2: Conversations -->
          @if (HasChatTab) {
            <div class="rail-group nav-section-group">
              @if (!isCollapsed) {
                <div class="rail-group-head section-title-row">
                  <span class="rail-group-label section-title">Conversations</span>
                  @if (CanStartConversation) {
                    <button
                      type="button"
                      mjButton Variant="icon" Size="sm" class="btn-add-section"
                      (click)="onNewConversation()"
                      title="New conversation"
                      aria-label="New conversation">
                      <i class="fa-solid fa-plus" aria-hidden="true"></i>
                    </button>
                  }
                </div>
              }

              <div class="rail-group-list nav-links-list">
                @for (c of Conversations; track c.id) {
                  <button
                    type="button"
                    class="rail-row space-nav-link convo-link"
                    [class.active]="ActiveTab === 'Chat' && IsActiveConversation(c.id)"
                    [attr.aria-current]="ActiveTab === 'Chat' && IsActiveConversation(c.id) ? 'page' : null"
                    (click)="onConversationClick(c.id)"
                    [title]="isCollapsed ? c.name : ''"
                    [attr.aria-label]="isCollapsed ? c.name : null">
                    @if (c.kind === 'Private' || c.band === 'Team') {
                      <i class="fa-solid fa-lock row-icon link-icon" aria-hidden="true"></i>
                    } @else if (c.kind === 'Agent') {
                      <i class="fa-solid fa-robot row-icon link-icon" aria-hidden="true"></i>
                    } @else if (c.kind === 'Topic') {
                      <i class="fa-solid fa-bullseye row-icon link-icon" aria-hidden="true"></i>
                    } @else {
                      <i class="fa-solid fa-hashtag row-icon link-icon" aria-hidden="true"></i>
                    }

                    @if (!isCollapsed) {
                      <span class="row-label link-label">{{ c.name }}</span>
                    }
                  </button>
                }
              </div>
            </div>
          }

          <!-- Group 3: Sub-spaces (direct children only) -->
          @if (SubSpaces.length > 0) {
            <div class="rail-group nav-section-group">
              @if (!isCollapsed) {
                <div class="rail-group-head section-title-row">
                  <span class="rail-group-label section-title">Sub-spaces</span>
                  @if (CanAddSubSpace) {
                    <button
                      type="button"
                      mjButton Variant="icon" Size="sm" class="btn-add-section"
                      data-testid="rail-add-subspace"
                      (click)="onNewSubSpace()"
                      title="New sub-space"
                      aria-label="New sub-space">
                      <i class="fa-solid fa-plus" aria-hidden="true"></i>
                    </button>
                  }
                </div>
              }

              <div class="rail-group-list nav-links-list">
                @for (sub of openSubSpaces; track sub.id) {
                  <button
                    type="button"
                    class="rail-row space-nav-link subspace-link"
                    data-testid="rail-subspace-row"
                    (click)="selectSpace(sub.id)"
                    [title]="isCollapsed ? sub.name : ''"
                    [attr.aria-label]="isCollapsed ? sub.name : null">
                    <mjc-type-tile
                      [IconClass]="sub.iconClass || 'fa-folder'"
                      [Color]="subSpaceColor(sub)"
                      [IsClosed]="false"
                      Size="sm">
                    </mjc-type-tile>
                    @if (!isCollapsed) {
                      <span class="row-label link-label">{{ sub.name }}</span>
                    }
                  </button>
                }

                @if (closedSubSpaces.length > 0 && !isCollapsed) {
                  <button
                    type="button"
                    class="rail-row space-nav-link subspace-link dim"
                    data-testid="rail-closed-subspaces-toggle"
                    [attr.aria-expanded]="closedSubSpacesExpanded"
                    (click)="toggleClosedSubSpaces()">
                    <i
                      class="fa-solid row-icon"
                      [class]="closedSubSpacesExpanded ? 'fa-chevron-down' : 'fa-chevron-right'"
                      aria-hidden="true"></i>
                    <span class="row-label link-label">Closed ({{ closedSubSpaces.length }})</span>
                  </button>

                  @if (closedSubSpacesExpanded) {
                    @for (sub of closedSubSpaces; track sub.id) {
                      <button
                        type="button"
                        class="rail-row space-nav-link subspace-link dim"
                        data-testid="rail-subspace-row"
                        (click)="selectSpace(sub.id)">
                        <mjc-type-tile
                          [IconClass]="sub.iconClass || 'fa-folder'"
                          [Color]="subSpaceColor(sub)"
                          [IsClosed]="true"
                          Size="sm">
                        </mjc-type-tile>
                        <span class="row-label link-label">{{ sub.name }}</span>
                        <span class="meta"><i class="fa-solid fa-lock" aria-hidden="true"></i><span class="sr-only">(closed)</span></span>
                      </button>
                    }
                  }
                }
              </div>
            </div>
          }
        } @else {
          <!-- Mode === 'home': Home, Inbox, My tasks, Recent files, then Spaces tree -->
          <div class="rail-group">
            <div class="rail-group-list">
              <button
                type="button"
                class="rail-row nav-item"
                [class.active]="ActiveNav === 'home'"
                [title]="isCollapsed ? 'Home' : ''"
                [attr.aria-label]="isCollapsed ? 'Home' : null"
                (click)="selectNav('home')">
                <i class="fa-solid fa-house row-icon" aria-hidden="true"></i>
                @if (!isCollapsed) {
                  <span class="row-label">Home</span>
                }
              </button>

              <button
                type="button"
                class="rail-row nav-item"
                [class.active]="ActiveNav === 'inbox'"
                [title]="isCollapsed ? 'Inbox' : ''"
                [attr.aria-label]="isCollapsed ? 'Inbox' : null"
                (click)="selectNav('inbox')">
                <i class="fa-solid fa-inbox row-icon" aria-hidden="true"></i>
                @if (!isCollapsed) {
                  <span class="row-label">Inbox</span>
                  @if (InboxCount > 0) {
                    <span class="row-count count hot">{{ InboxCount }}</span>
                  }
                }
              </button>

              <button
                type="button"
                class="rail-row nav-item"
                [class.active]="ActiveNav === 'tasks'"
                [title]="isCollapsed ? 'My tasks' : ''"
                [attr.aria-label]="isCollapsed ? 'My tasks' : null"
                (click)="selectNav('tasks')">
                <i class="fa-solid fa-list-check row-icon" aria-hidden="true"></i>
                @if (!isCollapsed) {
                  <span class="row-label">My tasks</span>
                  @if (TaskCount > 0) {
                    <span class="row-count count">{{ TaskCount }}</span>
                  }
                }
              </button>

              <button
                type="button"
                class="rail-row nav-item"
                [class.active]="ActiveNav === 'files'"
                [title]="isCollapsed ? 'Recent files' : ''"
                [attr.aria-label]="isCollapsed ? 'Recent files' : null"
                (click)="selectNav('files')">
                <i class="fa-solid fa-folder-open row-icon" aria-hidden="true"></i>
                @if (!isCollapsed) {
                  <span class="row-label">Recent files</span>
                  @if (LibraryCount > 0) {
                    <span class="row-count count">{{ LibraryCount }}</span>
                  }
                }
              </button>
            </div>
          </div>

          @if (starredSpaces.length > 0 && !isCollapsed) {
            <div class="rail-group" data-testid="rail-starred-spaces">
              <div class="rail-group-head nav-section">
                <span class="rail-group-label section-title">Starred</span>
              </div>
              <div class="rail-group-list">
                @for (st of starredSpaces; track st.id) {
                  <button
                    type="button"
                    class="rail-row nav-item"
                    [class.active]="IsActiveSpace(st.id)"
                    (click)="selectSpace(st.id)">
                    <mjc-type-tile
                      [IconClass]="st.iconClass"
                      [Color]="st.color || ''"
                      [IsClosed]="!!st.isLocked"
                      Size="sm">
                    </mjc-type-tile>
                    <span class="row-label ellipsis">{{ st.name }}</span>
                    <i class="fa-solid fa-star row-star" aria-hidden="true"></i>
                  </button>
                }
              </div>
            </div>
          }

          <div class="rail-group rail-spaces-group">
            @if (!isCollapsed) {
              <div class="rail-group-head nav-section">
                <span class="rail-group-label section-title">Spaces</span>
                @if (CanCreateSpace) {
                  <button
                    type="button"
                    mjButton Variant="icon" Size="sm" class="icon-btn-inline"
                    (click)="SpaceCreateRequested.emit()"
                    title="New space"
                    aria-label="New space">
                    <i class="fa-solid fa-plus" aria-hidden="true"></i>
                  </button>
                }
              </div>

              <div class="tree-list">
                @for (s of visibleSpaces; track s.id) {
                  @let guides = treeGuidesFor($index);
                  <div
                    class="tree-item rail-row {{ guides.isSubSpace ? 'is-subspace' : 'is-root' }} {{ IsActiveSpace(s.id) ? 'active' : '' }} {{ s.isDim ? 'dim' : '' }}"
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
                    <span class="row-label ellipsis">{{ s.name }}</span>
                    @if (s.isStarred) {
                      <i class="fa-solid fa-star row-star" aria-hidden="true"></i>
                    }
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
            } @else {
              <div class="rail-group-list">
                @for (s of visibleSpaces; track s.id) {
                  <button
                    type="button"
                    class="rail-row"
                    [class.active]="IsActiveSpace(s.id)"
                    [title]="s.name"
                    [attr.aria-label]="s.name"
                    (click)="selectSpace(s.id)">
                    <mjc-type-tile
                      [IconClass]="s.iconClass"
                      [Color]="s.color || ''"
                      [IsClosed]="!!s.isLocked"
                      Size="sm">
                    </mjc-type-tile>
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
    </nav>
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
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family);
    }

    .rail {
      height: 100%;
      background: var(--mj-bg-surface);
      border-right: 1px solid var(--mj-border-default);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: relative;
      box-sizing: border-box;
    }
    .rail.collapsed {
      width: 56px !important;
    }

    .nav-resizer {
      position: absolute;
      top: 0;
      right: -4px;
      width: 8px;
      bottom: 0;
      cursor: col-resize;
      z-index: var(--mj-z-dropdown);
      transition: background var(--mj-transition-fast);
    }
    .nav-resizer:hover,
    .nav-resizer:active {
      background: color-mix(in srgb, var(--mj-brand-primary) 35%, transparent);
    }

    /* ─── Head: Space Switcher ───────────────────────────────────────────── */
    .rail-head {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mj-space-1-5);
      padding: var(--mj-space-2-5) var(--mj-space-2-5);
      border-bottom: 1px solid var(--mj-border-default);
      flex-shrink: 0;
    }
    .rail.collapsed .rail-head {
      flex-direction: column;
      padding: var(--mj-space-2) var(--mj-space-1-5);
      gap: var(--mj-space-1-5);
    }

    .rail-switcher {
      display: flex;
      align-items: center;
      gap: var(--mj-space-2-5);
      flex: 1;
      min-width: 0;
      height: var(--mj-space-9);
      padding: 0 var(--mj-space-2);
      border-radius: var(--mj-radius-md);
      border: 1px solid transparent;
      background: transparent;
      color: var(--mj-text-primary);
      font: inherit;
      font-size: var(--mj-text-sm);
      font-weight: var(--mj-font-semibold);
      cursor: pointer;
      text-align: left;
      box-sizing: border-box;
      transition: background var(--mj-transition-fast), border-color var(--mj-transition-fast);
    }
    .rail.collapsed .rail-switcher {
      flex: none;
      width: var(--mj-space-9);
      padding: 0;
      justify-content: center;
    }
    .rail-switcher:hover,
    .rail-switcher.open {
      background: var(--mj-bg-surface-hover);
    }

    .switcher-home-tile {
      width: 24px;
      height: 24px;
      border-radius: var(--mj-radius-sm);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-secondary);
      display: inline-grid;
      place-items: center;
      font-size: var(--mj-text-xs);
      flex-shrink: 0;
    }

    .switcher-title {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .switcher-chev {
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
      flex-shrink: 0;
      transition: transform var(--mj-transition-fast);
    }
    .switcher-chev.open {
      transform: rotate(180deg);
    }

    .btn-nav-toggle {
      flex-shrink: 0;
    }

    /* ─── Space Switcher Popover ─────────────────────────────────────────── */
    .jump-scrim {
      position: fixed;
      inset: 0;
      background: transparent;
      z-index: var(--mj-z-popover);
    }

    .switcher-popover {
      position: absolute;
      top: calc(100% + var(--mj-space-1));
      left: var(--mj-space-2);
      width: 280px;
      max-height: 440px;
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-1-5);
      padding: var(--mj-space-2);
      background: var(--mj-bg-surface);
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-lg);
      box-shadow: var(--mj-shadow-lg);
      z-index: calc(var(--mj-z-popover) + 1);
      box-sizing: border-box;
    }

    .switcher-search-wrap {
      display: flex;
      align-items: center;
      gap: var(--mj-space-2);
      padding: 0 var(--mj-space-2-5);
      height: var(--mj-space-9);
      border-radius: var(--mj-radius-md);
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface-sunken);
      box-sizing: border-box;
    }
    .switcher-search-wrap:focus-within {
      border-color: var(--mj-border-focus);
      background: var(--mj-bg-surface);
    }
    .switcher-search-icon {
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
      flex-shrink: 0;
    }
    .jump-input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      color: var(--mj-text-primary);
      font: inherit;
      font-size: var(--mj-text-sm);
      outline: none;
      padding: 0;
    }
    .kbd {
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-medium);
      color: var(--mj-text-muted);
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-sm);
      padding: 0 var(--mj-space-1-5);
      background: var(--mj-bg-surface);
      flex-shrink: 0;
    }

    .switcher-divider {
      height: 1px;
      background: var(--mj-border-subtle);
      margin: var(--mj-space-0-5) 0;
    }

    .switcher-tree {
      max-height: 280px;
    }

    .switcher-foot {
      border-top: 1px solid var(--mj-border-subtle);
      padding-top: var(--mj-space-1);
    }

    .jump-none {
      padding: var(--mj-space-2) var(--mj-space-2-5);
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
    }

    /* ─── Body & Groups ──────────────────────────────────────────────────── */
    .rail-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: var(--mj-space-3) var(--mj-space-2-5);
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-4);
    }
    .rail.collapsed .rail-body {
      padding: var(--mj-space-2-5) var(--mj-space-1-5);
      align-items: center;
    }

    .rail-group {
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-1);
      width: 100%;
    }
    .rail-spaces-group {
      flex: 1;
      min-height: 0;
    }

    .rail-group-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: var(--mj-space-6);
      padding: 0 var(--mj-space-2-5);
    }

    .rail-group-label {
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-semibold);
      color: var(--mj-text-muted);
    }

    .rail-group-list {
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-0-5);
    }
    .rail.collapsed .rail-group-list {
      align-items: center;
    }

    /* ─── Rows: One height (36px), fixed icon column (18px) ──────────────── */
    .rail-row {
      display: flex;
      align-items: center;
      gap: var(--mj-space-2-5);
      height: var(--mj-space-9);
      min-height: var(--mj-space-9);
      padding: 0 var(--mj-space-2-5);
      border-radius: var(--mj-radius-md);
      color: var(--mj-text-secondary);
      font: inherit;
      font-size: var(--mj-text-sm);
      font-weight: var(--mj-font-medium);
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      width: 100%;
      box-sizing: border-box;
      flex-shrink: 0;
      transition: background var(--mj-transition-fast), color var(--mj-transition-fast);
    }
    .rail.collapsed .rail-body .rail-row {
      width: var(--mj-space-9);
      padding: 0;
      justify-content: center;
    }
    .rail-row:hover {
      background: var(--mj-bg-surface-hover);
      color: var(--mj-text-primary);
    }
    .rail-row.active {
      background: color-mix(in srgb, var(--mj-brand-primary) 10%, transparent);
      color: var(--mj-brand-primary);
      font-weight: var(--mj-font-semibold);
    }

    .row-icon {
      width: 18px;
      text-align: center;
      font-size: var(--mj-text-sm);
      color: var(--mj-text-muted);
      flex-shrink: 0;
    }
    .rail-row:hover .row-icon {
      color: var(--mj-text-primary);
    }
    .rail-row.active .row-icon {
      color: var(--mj-brand-primary);
    }

    .row-label {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-star {
      color: var(--mj-status-warning);
      font-size: var(--mj-text-xs);
      flex-shrink: 0;
    }

    .switcher-starred-group {
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-0-5);
    }

    .switcher-group-label {
      font-size: 11px;
      font-weight: var(--mj-font-bold);
      text-transform: uppercase;
      letter-spacing: var(--mj-tracking-wider);
      color: var(--mj-text-muted);
      padding: var(--mj-space-1) var(--mj-space-2-5);
    }

    .row-count {
      margin-left: auto;
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-secondary);
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-semibold);
      padding: 0 var(--mj-space-1-5);
      border-radius: var(--mj-radius-full);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
    .row-count.hot {
      background: var(--mj-brand-primary);
      color: var(--mj-brand-on-primary);
    }

    /* ─── Spaces Tree ────────────────────────────────────────────────────── */
    .tree-list {
      flex: 1 1 auto;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-0-5);
    }
    .tree-item {
      padding: 0 var(--mj-space-2-5) 0 var(--mj-space-2);
      position: relative;
    }
    .rail-row.dim {
      opacity: 0.55;
    }

    .tree-guides {
      display: inline-flex;
      align-items: stretch;
      height: var(--mj-space-9);
      flex-shrink: 0;
      margin-left: var(--mj-space-1);
    }
    .tree-guide-col {
      position: relative;
      width: var(--mj-space-4);
      height: var(--mj-space-9);
      flex-shrink: 0;
    }
    .tree-guide-col.continuation::before {
      content: '';
      position: absolute;
      left: 7px;
      top: -2px;
      bottom: 0;
      width: 1.5px;
      background: var(--mj-border-strong);
    }
    .tree-elbow {
      position: relative;
      width: var(--mj-space-4);
      height: var(--mj-space-9);
      flex-shrink: 0;
    }
    .tree-elbow::before {
      content: '';
      position: absolute;
      left: 7px;
      top: -2px;
      bottom: 0;
      width: 1.5px;
      background: var(--mj-border-strong);
    }
    .tree-elbow.last::before {
      bottom: 50%;
    }
    .tree-elbow::after {
      content: '';
      position: absolute;
      left: 7px;
      top: 50%;
      width: var(--mj-space-2);
      height: 1.5px;
      background: var(--mj-border-strong);
    }
    .tree-item.active .tree-elbow::before,
    .tree-item.active .tree-elbow::after,
    .tree-item:hover .tree-elbow::before,
    .tree-item:hover .tree-elbow::after {
      background: var(--mj-brand-primary);
    }

    .tree-item .chev {
      width: 14px;
      height: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--mj-text-xs);
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
      border-radius: var(--mj-radius-full);
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

    .rail-row .meta {
      margin-left: auto;
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
    }

    @media (prefers-reduced-motion: reduce) {
      .nav-resizer,
      .rail-switcher,
      .switcher-chev,
      .rail-row {
        transition: none;
      }
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
  @Input() SpaceColor = '';
  @Input() SpaceIsClosed = false;
  @Input() SpaceBand: SpaceBand = 'Shared';
  @Input() ActiveTab = 'Overview';
  /** The tabs of the space shown, as its type arranged them: the rail lists these alongside any custom pages. */
  @Input() Tabs: TabItem[] = DEFAULT_RAIL_TABS;
  /** Additional custom pages created in this space, shown right in the Pages navigation list. */
  @Input() CustomPages: SpaceRailCustomPage[] = [];
  /** Whether the viewer can add/customize pages in this space (restricted to authorized space admins). */
  @Input() CanEditPages = false;
  /** True when the space admin is currently in Page Studio / Customize Mode. */
  @Input() IsCustomizingPages = false;

  /** Whether the caller may configure this space. */
  @Input() CanConfigure = false;
  @Input() Conversations: SpaceConversationItem[] = [];
  @Input() ActiveConversationId = '';
  @Input() SubSpaces: SubSpaceSummary[] = [];
  @Input() CanAddSubSpace = false;
  @Input() ParentSpaceId = '';
  @Input() ParentSpaceName = '';
  @Input() PagesCount = 0;

  /** Whether the tree row is the open space. Only active when Mode is 'space' so Home never highlights two items. */
  public IsActiveSpace(spaceId: string): boolean {
    return this.Mode === 'space' && !!this.ActiveSpaceId && UUIDsEqual(spaceId, this.ActiveSpaceId);
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
  public closedSubSpacesExpanded = false;
  private isDraggingResizer = false;
  private startDragX = 0;
  private startWidth = 264;

  ngOnInit(): void {
    this.loadLayoutPreference();
  }

  public isSubSpaceClosed(sub: SubSpaceSummary): boolean {
    if (sub.isLocked || sub.isDim) return true;
    const node = this.Spaces.find((s) => UUIDsEqual(s.id, sub.id));
    return !!node?.isLocked || !!node?.isDim;
  }

  public subSpaceColor(sub: SubSpaceSummary): string {
    if (sub.color) return sub.color;
    const node = this.Spaces.find((s) => UUIDsEqual(s.id, sub.id));
    return node?.color ?? '';
  }

  public get openSubSpaces(): SubSpaceSummary[] {
    return this.SubSpaces.filter((sub) => !this.isSubSpaceClosed(sub));
  }

  public get closedSubSpaces(): SubSpaceSummary[] {
    return this.SubSpaces.filter((sub) => this.isSubSpaceClosed(sub));
  }

  public toggleClosedSubSpaces(): void {
    this.closedSubSpacesExpanded = !this.closedSubSpacesExpanded;
  }

  public get switcherLabel(): string {
    if (this.Mode === 'space') {
      return this.SpaceTitle || 'Active space';
    }
    return 'All spaces';
  }

  public get computedSpaceIcon(): string {
    const raw = (this.SpaceIcon || 'fa-shapes').trim();
    return raw.includes('fa-solid') || raw.includes('fa-regular') || raw.includes('fa-brands')
      ? raw
      : `fa-solid ${raw}`;
  }

  public get resolvedSpaceColor(): string {
    if (this.SpaceColor) return this.SpaceColor;
    const match = this.Spaces.find((s) => this.IsActiveSpace(s.id));
    return match?.color ?? '';
  }

  public get resolvedSpaceClosed(): boolean {
    if (this.SpaceIsClosed) return true;
    const match = this.Spaces.find((s) => this.IsActiveSpace(s.id));
    return !!match?.isLocked;
  }

  /** Built-in tabs excluding Settings so pages sit cleanly in the Pages group. */
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

  public onSelectAllSpaces(): void {
    this.jumpOpen = false;
    if (this.Mode === 'space') {
      this.BackToSpacesRequested.emit();
    } else {
      this.NavSelectRequested.emit('home');
    }
  }

  public onCreateSpaceFromSwitcher(): void {
    this.jumpOpen = false;
    this.SpaceCreateRequested.emit();
  }

  public selectNav(nav: string): void {
    this.NavSelectRequested.emit(nav);
  }

  public selectSpace(id: string): void {
    this.SpaceOpenRequested.emit(id);
  }

  public jumpOpen = false;
  public jumpQuery = '';

  public get hasJumpQuery(): boolean {
    return this.jumpQuery.trim().length > 0;
  }

  public get starredSpaces(): RailSpaceNode[] {
    return this.Spaces.filter((s) => !!s.isStarred);
  }

  /** The spaces whose names contain what was typed, in the tree's order. */
  public get jumpMatches(): RailSpaceNode[] {
    const needle = this.jumpQuery.trim().toLowerCase();
    return this.Spaces.filter((s) => !needle || s.name.toLowerCase().includes(needle));
  }

  public onJumpClick(): void {
    if (this.jumpOpen) {
      this.closeJump();
    } else {
      this.OpenJump();
    }
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

  /** ⌘J (Ctrl+J elsewhere) opens the palette from anywhere on the page; Escape closes it. */
  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'preventDefault'>): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      this.OpenJump();
    } else if (event.key === 'Escape' && this.jumpOpen) {
      event.preventDefault();
      this.closeJump();
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
