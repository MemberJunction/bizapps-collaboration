import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CollabSpaceRailComponent,
  CollabSpaceHeaderComponent,
  CollabSpaceTabsComponent,
  CollabSpaceLibraryComponent,
  CollabAudiencePillComponent,
  CollabUploadDialogComponent,
} from '@mj-biz-apps/collaboration-ng-widgets';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { FRAME_03_FIXTURE } from '../fixtures/frame-03.fixture';

@Component({
  selector: 'gallery-frame-09',
  standalone: true,
  imports: [
    CommonModule,
    CollabSpaceRailComponent,
    CollabSpaceHeaderComponent,
    CollabSpaceTabsComponent,
    CollabSpaceLibraryComponent,
    CollabAudiencePillComponent,
    CollabUploadDialogComponent,
    MJButtonDirective,
  ],
  template: `
    <div class="shell">
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
          [MyTaskCount]="f.rail.taskCount"
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
              <button mjButton Variant="primary" Size="md" data-testid="frame-09-open-upload" (click)="showUploadDialog = true">
                <i class="fa-solid fa-arrow-up-from-bracket"></i>Upload
              </button>
            </div>
            <mjc-space-tabs
              [Tabs]="f.header.tabs"
              [ActiveTab]="'Library'"
            ></mjc-space-tabs>
          </mjc-space-header>

          <mjc-space-library
            [TotalCount]="f.allMaterialCount"
            [Collections]="f.collections"
            [SmartViews]="f.smartViews"
            [Rows]="f.rows"
            [SelectedRowId]="'row-3'"
            [ShowDrawer]="true"
            [ShowUploadDisclosure]="true"
            [SpaceName]="f.header.title"
            [DefaultUploadBand]="'Shared'"
            [PreviewMeta]="f.selectedItem.meta"
            [PreviewParagraphs]="f.selectedItem.snippets"
            [PreviewBandLabel]="f.selectedItem.bandLabel"
            [PreviewAudienceSub]="f.selectedItem.bandSubtitle"
            [PreviewStaffAvatars]="f.selectedItem.bandAvatars"
            [PreviewFlagTitle]="f.selectedItem.flagTitle"
            [PreviewFlagDescription]="f.selectedItem.flagDescription"
            [PreviewShareButtonLabel]="'Share with Northwind…'"
            [PreviewRecentUses]="f.selectedItem.recentUses"
            [TeamBandLegend]="'Meridian only'"
          ></mjc-space-library>
        </main>
      </div>

      @if (showUploadDialog) {
        <mjc-upload-dialog
          [SpaceName]="f.header.title"
          [SpaceId]="'discovery'"
          [AllowLinks]="true"
          [AllowedBands]="['Shared', 'Team']"
          [StartBand]="'Shared'"
          [FolderSuggestions]="['Deliverables', 'Process maps', 'Interviews']"
          [AgentRetrieval]="'Included'"
          (CancelRequested)="showUploadDialog = false"
          (SubmitRequested)="showUploadDialog = false"
        ></mjc-upload-dialog>
      }
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
      background: var(--mj-bg-page);
    }
    .row { display: flex; align-items: center; }
    .gap8 { gap: 8px; }
    .topbar {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 0 16px 0 14px;
      background: var(--mj-bg-surface);
      border-bottom: 1px solid var(--mj-border-default);
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
      border-radius: var(--mj-radius-md);
      background: color-mix(in srgb, var(--mj-brand-primary) 10%, transparent);
      color: var(--mj-brand-primary);
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
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-md);
      color: var(--mj-text-muted);
      background: var(--mj-bg-surface);
      font-size: 13px;
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
    .icon-btn {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: var(--mj-radius-md);
      display: inline-grid;
      place-items: center;
      color: var(--mj-text-secondary);
      font-size: 15px;
    }
    .icon-btn .dot {
      position: absolute;
      top: 6px;
      right: 7px;
      min-width: 8px;
      height: 8px;
      border-radius: 99px;
      background: var(--mj-status-error);
      box-shadow: 0 0 0 2px var(--mj-bg-surface);
    }
    .topbar .av {
      display: inline-grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 650;
      color: var(--mj-brand-on-primary);
      background: var(--mj-brand-primary);
      user-select: none;
    }
  `],
})
export class Frame09Component {
  readonly f = FRAME_03_FIXTURE;
  public showUploadDialog = true;
}
