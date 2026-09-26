import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CollabSpaceRailComponent,
  CollabSpaceHeaderComponent,
  CollabSpaceTabsComponent,
  CollabAudiencePillComponent,
  type BreadcrumbItem,
  type TabItem,
  type RailSpaceNode,
  type AvatarItem,
} from '@mj-biz-apps/collaboration-ng-widgets';

@Component({
  selector: 'gallery-frame-02',
  standalone: true,
  imports: [
    CommonModule,
    CollabSpaceRailComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceTabsComponent,
    CollabAudiencePillComponent,
  ],
  template: `
    <div class="shell">
      <!-- Static Explorer Topbar Stand-in (56px) as required by § 10 -->
      <header class="topbar">
        <div class="row gap10">
          <span class="app-pill"><i class="fa-solid fa-shapes"></i>Collaboration</span>
          <span class="muted fs12">/</span>
          <span class="fs13 fw6">Northwind</span>
        </div>
        <div class="search"><i class="fa-solid fa-magnifying-glass"></i><span>Search everything…</span><span class="kbd">⌘K</span></div>
        <div class="row gap12" style="margin-left:auto">
          <span class="btn ghost sm"><i class="fa-solid fa-bell"></i></span>
          <span class="btn ghost sm"><i class="fa-solid fa-gear"></i></span>
          <span class="av c1 md">A</span>
        </div>
      </header>

      <div class="body">
        <mjc-space-rail
          [spaces]="spaces"
          [activeSpaceId]="'discovery'"
          [inboxCount]="4"
          [taskCount]="6"
        ></mjc-space-rail>

        <main class="main">
          <mjc-space-header
            [breadcrumbs]="breadcrumbs"
            [typeCode]="'eng'"
            [typeIconClass]="'fa-solid fa-compass'"
            [title]="'Discovery'"
            [typeName]="'Engagement'"
            [status]="'Active'"
            [subtitle]="subtitle"
          >
            <div actions class="row gap8">
              <mjc-audience-pill
                [staffAvatars]="staffAvatars"
                [outsideAvatars]="outsideAvatars"
                [totalPeople]="9"
                [summary]="'3 Meridian · 6 Northwind'"
              ></mjc-audience-pill>
              <button type="button" class="btn"><i class="fa-solid fa-user-plus"></i>Invite</button>
              <button type="button" class="btn primary"><i class="fa-solid fa-plus"></i>New</button>
            </div>
            <mjc-space-tabs
              [tabs]="tabs"
              [activeTab]="activeTab"
              (tabChange)="activeTab = $event"
            ></mjc-space-tabs>
          </mjc-space-header>

          <div class="page ov">
            <!-- Full overview cards land in Slice A -->
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
    .shell {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      background: var(--mj-bg-surface-sunken, #f8fafc);
      overflow-y: auto;
    }
    .page.ov {
      padding: 24px 28px;
      flex: 1;
    }
    .row { display: flex; align-items: center; }
    .gap8 { gap: 8px; }
    .gap10 { gap: 10px; }
    .gap12 { gap: 12px; }
    .fs12 { font-size: 12px; }
    .fs13 { font-size: 13px; }
    .fw6 { font-weight: 600; }
    .muted { color: var(--mj-text-muted, #64748b); }

    /* Topbar stand-in (masked in § 10) */
    .topbar {
      height: 56px;
      padding: 0 16px;
      border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
      background: var(--mj-bg-surface, #ffffff);
      display: flex;
      align-items: center;
      gap: 16px;
      box-sizing: border-box;
      flex: none;
    }
    .app-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 99px;
      background: var(--mj-brand-accent-subtle, #f1f5f9);
      color: var(--mj-brand-primary, #0284c7);
      font-size: 12.5px;
      font-weight: 650;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 280px;
      height: 32px;
      padding: 0 10px;
      border-radius: 8px;
      border: 1px solid var(--mj-border-default, #e2e8f0);
      background: var(--mj-bg-surface-sunken, #f8fafc);
      color: var(--mj-text-muted, #64748b);
      font-size: 12.5px;
    }
    .search .kbd {
      margin-left: auto;
      font-size: 11px;
      padding: 1px 4px;
      border: 1px solid var(--mj-border-default, #e2e8f0);
      border-radius: 4px;
      background: var(--mj-bg-surface, #ffffff);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border-radius: 8px;
      border: 1px solid var(--mj-border-default, #e2e8f0);
      background: var(--mj-bg-surface, #ffffff);
      color: var(--mj-text-primary, #0f172a);
      font-size: 12.5px;
      font-weight: 550;
      cursor: pointer;
    }
    .btn.primary {
      background: var(--mj-brand-primary, #0284c7);
      color: var(--mj-brand-on-primary, #ffffff);
      border-color: var(--mj-brand-primary, #0284c7);
    }
    .btn.ghost {
      background: transparent;
      border: none;
      color: var(--mj-text-secondary, #475569);
    }
    .btn.sm {
      height: 28px;
      padding: 0 8px;
    }
    .av {
      display: inline-grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 650;
      color: #fff;
    }
    .av.c1 { background: #6366f1; }
    .av.md { width: 30px; height: 30px; }
  `]
})
export class Frame02Component {
  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Spaces' },
    { label: 'Northwind' },
    { label: 'Discovery' },
  ];
  subtitle = 'Supply-chain operating model diagnostic · Week 7 of 10 · Readout Oct 9';
  activeTab = 'Overview';

  tabs: TabItem[] = [
    { id: 'Overview', label: 'Overview', iconClass: 'fa-solid fa-gauge-high' },
    { id: 'Library', label: 'Library', iconClass: 'fa-solid fa-folder-open', count: 24 },
    { id: 'Work', label: 'Work', iconClass: 'fa-solid fa-list-check', count: 10 },
    { id: 'Chat', label: 'Chat', iconClass: 'fa-solid fa-comments', count: 3 },
    { id: 'People', label: 'People', iconClass: 'fa-solid fa-user-group', count: 9 },
    { id: 'Settings', label: 'Settings', iconClass: 'fa-solid fa-sliders' },
  ];

  spaces: RailSpaceNode[] = [
    { id: 'northwind', name: 'Northwind', typeCode: 'rel', iconClass: 'fa-solid fa-building', level: 0, hasChildren: true, isExpanded: true },
    { id: 'discovery', name: 'Discovery', typeCode: 'eng', iconClass: 'fa-solid fa-compass', level: 1, unread: true },
    { id: 'delivery', name: 'Delivery', typeCode: 'eng', iconClass: 'fa-solid fa-truck-fast', level: 1, meta: 'Oct 20' },
  ];

  staffAvatars: AvatarItem[] = [
    { initials: 'A', name: 'Ada Lovelace', colorClass: 'c1' },
    { initials: 'S', name: 'Sam Taylor', colorClass: 'c2' },
    { initials: 'P', name: 'Priya Patel', colorClass: 'c3' },
  ];

  outsideAvatars: AvatarItem[] = [
    { initials: 'C', name: 'Casey Morgan', colorClass: 'c4', isOutside: true },
    { initials: 'B', name: 'Bea Vance', colorClass: 'c5', isOutside: true },
    { initials: 'O', name: 'Omar Ortiz', colorClass: 'c6', isOutside: true },
    { initials: 'L', name: 'Lena Chen', colorClass: 'c7', isOutside: true },
  ];
}
