import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CollabSpaceRailComponent,
  CollabSpaceHeaderComponent,
  CollabSpaceTabsComponent,
  CollabSpaceLibraryComponent,
  CollabShareCheckDialogComponent,
  CollabAudiencePillComponent,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { FRAME_04_FIXTURE } from '../fixtures/frame-04.fixture';

@Component({
  selector: 'gallery-frame-04',
  standalone: true,
  imports: [
    CommonModule,
    CollabSpaceRailComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceTabsComponent,
    CollabSpaceLibraryComponent,
    CollabShareCheckDialogComponent,
    CollabAudiencePillComponent,
    MJButtonDirective,
  ],
  template: `
    <div class="shell" style="position: relative">
      <!-- Static Explorer Topbar Stand-in (56px) as required by § 10 -->
      <header class="topbar">
        <span class="mark"></span>
        <span class="app-pill"><i class="fa-solid fa-people-roof"></i>{{ f.topbar.appName }}<i class="fa-solid fa-chevron-down caret"></i></span>
        <span class="spacer"></span>
        <span class="search"><i class="fa-solid fa-magnifying-glass"></i>Search everything…<span class="kbd">⌘K</span></span>
        <span class="icon-btn"><i class="fa-regular fa-bell"></i><span class="dot"></span></span>
        <span class="av c1 md" title="Ada Lovell">{{ f.topbar.userInitials }}</span>
      </header>

      <div class="body">
        <mjc-space-rail
          [Spaces]="f.rail.spaces"
          [ActiveSpaceId]="'discovery'"
          [InboxCount]="f.rail.inboxCount"
          [TaskCount]="f.rail.taskCount"
        ></mjc-space-rail>

        <main class="main">
          <mjc-space-header
            [Breadcrumbs]="f.header.crumbs"
            [TypeColor]="f.header.typeColor"
            [TypeIconClass]="f.header.typeIconClass"
            [Title]="f.header.title"
            [TypeName]="f.header.typeName"
            [Status]="f.header.status"
            [Subtitle]="f.header.subtitle"
          >
            <div actions class="row gap8">
              <mjc-audience-pill
                [StaffAvatars]="f.header.staffAvatars"
                [OutsideAvatars]="f.header.outsideAvatars"
                [TotalPeople]="f.header.totalPeople"
                [Summary]="f.header.audienceSummary"
              ></mjc-audience-pill>
              <button mjButton variant="primary" size="md"><i class="fa-solid fa-arrow-up-from-bracket"></i>Upload</button>
            </div>
            <mjc-space-tabs
              [Tabs]="f.header.tabs"
              [ActiveTab]="'Library'"
            ></mjc-space-tabs>
          </mjc-space-header>

          <mjc-space-library
            [TotalCount]="f.library.allMaterialCount"
            [Collections]="f.library.collections"
            [SmartViews]="f.library.smartViews"
            [Rows]="f.library.rows"
            [SelectedRowId]="'row-3'"
            [ShowDrawer]="true"
            [PreviewMeta]="f.library.selectedItem.meta"
            [PreviewParagraphs]="f.library.selectedItem.snippets"
            [PreviewBandLabel]="f.library.selectedItem.bandLabel"
            [PreviewAudienceSub]="f.library.selectedItem.bandSubtitle"
            [PreviewStaffAvatars]="f.library.selectedItem.bandAvatars"
            [PreviewFlagTitle]="f.library.selectedItem.flagTitle"
            [PreviewFlagDescription]="f.library.selectedItem.flagDescription"
            [PreviewShareButtonLabel]="'Share with Northwind…'"
            [PreviewRecentUses]="f.library.selectedItem.recentUses"
            [TeamBandLegend]="'Meridian only'"
          ></mjc-space-library>
        </main>
      </div>

      <!-- Share Check Dialog Modal Overlay -->
      <mjc-share-check-dialog
        [Title]="f.dialog.title"
        [ItemName]="f.dialog.itemName"
        [Kind]="f.dialog.kind"
        [ClientOrgName]="f.dialog.clientOrgName"
        [RecipientCount]="f.dialog.recipientCount"
        [AudienceHeader]="f.dialog.audienceHeader"
        [AudienceStaffSub]="f.dialog.audienceStaffSub"
        [Recipients]="f.dialog.recipients"
        [ReviewHeader]="f.dialog.reviewHeader"
        [ReviewSub]="f.dialog.reviewSub"
        [Findings]="f.dialog.findings"
        [NotifyRecipients]="f.dialog.notifyRecipients"
        [AuthorName]="f.dialog.authorName"
        [Timestamp]="f.dialog.timestamp"
      ></mjc-share-check-dialog>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 1440px;
      height: 900px;
      overflow: hidden;
      position: relative;
    }
    .shell {
      display: grid;
      grid-template-rows: 56px 1fr;
      width: 1440px;
      height: 900px;
      overflow: hidden;
      position: relative;
    }
    .body {
      display: grid;
      grid-template-columns: 252px 1fr;
      min-height: 0;
      overflow: hidden;
    }
    .main {
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--mj-bg-page, #ffffff);
    }
    .row { display: flex; align-items: center; }
    .gap8 { gap: 8px; }

    /* Topbar stand-in (masked 56px per § 10) */
    .topbar {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 0 16px 0 14px;
      background: var(--mj-bg-surface, #ffffff);
      border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
      height: 56px;
      box-sizing: border-box;
    }
    .topbar .mark {
      width: 34px;
      height: 19px;
      background: url('/assets/mj-mark.svg') center/contain no-repeat;
    }
    :host-context([data-theme="dark"]) .topbar .mark,
    [data-theme="dark"] .topbar .mark {
      background-image: url('/assets/mj-mark-dark.svg');
    }
    .app-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 12px 0 10px;
      border-radius: var(--mj-radius-md, 8px);
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 10%, transparent);
      color: var(--mj-brand-primary, #0076b6);
      font-weight: 600;
      font-size: 13.5px;
    }
    .app-pill .caret {
      font-size: 10px;
      opacity: .7;
      margin-left: 2px;
    }
    .topbar .spacer {
      flex: 1;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 300px;
      height: 34px;
      padding: 0 10px;
      border: 1px solid var(--mj-border-default, #e2e8f0);
      border-radius: var(--mj-radius-md, 8px);
      color: var(--mj-text-muted, #64748b);
      background: var(--mj-bg-surface, #ffffff);
      font-size: 13px;
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
    .icon-btn {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: var(--mj-radius-md, 8px);
      display: inline-grid;
      place-items: center;
      color: var(--mj-text-secondary, #475569);
      font-size: 15px;
    }
    .icon-btn .dot {
      position: absolute;
      top: 6px;
      right: 7px;
      min-width: 8px;
      height: 8px;
      border-radius: 99px;
      background: var(--mj-status-error, #ef4444);
      box-shadow: 0 0 0 2px var(--mj-bg-surface, #ffffff);
    }
    .topbar .av {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 650;
      color: #fff;
      background: #6366f1;
      user-select: none;
    }
    .topbar .av.c1 { background: #6366f1; }
    .topbar .av.md { width: 32px; height: 32px; }
  `]
})
export class Frame04Component {
  readonly f = FRAME_04_FIXTURE;
}
