import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { AvatarItem, LibraryRowModel, SpaceBand } from './types';
import { MJButtonDirective, MJTabNavComponent, type TabConfig } from '@memberjunction/ng-ui-components';
import { CollabAvatarStackComponent } from './avatar-stack.component';
import { CollabBandChipComponent } from './band-chip.component';
import { CollabFileIconComponent } from './file-icon.component';
import { CollabItemPreviewComponent } from './item-preview.component';
import { COLLAB_TOKENS_CSS } from './tokens';

export interface LibraryCollection {
  id: string;
  name: string;
  band: SpaceBand;
  count: number;
}

export interface LibrarySmartView {
  id: string;
  name: string;
  iconClass: string;
  count: number;
}

@Component({
  selector: 'mjc-space-library',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CollabAvatarStackComponent,
    CollabBandChipComponent,
    CollabFileIconComponent,
    CollabItemPreviewComponent,
    MJButtonDirective,
    MJTabNavComponent,
  ],
  template: `
    <div class="lib">
      <!-- Left sidebar: Collections and Smart Views -->
      <aside class="folders">
        <div
          class="fold"
          [class.on]="ActiveFolderId === 'all'"
          (click)="onSelectFolder('all')"
        >
          <i class="fa-solid fa-layer-group"></i>
          <span>All material</span>
          <span class="n">{{ TotalCount }}</span>
        </div>

        <div class="fold-h">Collections</div>
        @for (col of Collections; track col.id) {
          <div
            class="fold"
            [class.on]="ActiveFolderId === col.id"
            (click)="onSelectFolder(col.id)"
          >
            <i class="fa-solid fa-folder"></i>
            <span>{{ col.name }}</span>
            <span class="dotc" [class.shared]="col.band === 'Shared'" [class.team]="col.band === 'Team'"></span>
            <span class="n">{{ col.count }}</span>
          </div>
        }

        <div class="fold-h">Smart views</div>
        @for (view of SmartViews; track view.id) {
          <div
            class="fold"
            [class.on]="ActiveFolderId === view.id"
            (click)="onSelectFolder(view.id)"
          >
            <i [class]="view.iconClass"></i>
            <span>{{ view.name }}</span>
            <span class="n">{{ view.count }}</span>
          </div>
        }

        <div class="legend">
          <div class="row gap8">
            <mjc-band-chip Band="Shared" Label="Shared" />
            <span class="fs12 muted">Both firms</span>
          </div>
          <div class="row gap8">
            <mjc-band-chip Band="Team" Label="Team" />
            <span class="fs12 muted">{{ TeamBandLegend || 'Team only' }}</span>
          </div>
        </div>
      </aside>

      <!-- Center section: Files table and tools -->
      <section class="files">
        <div class="lib-tools">
          <div class="input search-input">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" class="mj-input" placeholder="Search the library" />
          </div>
          <mj-tab-nav
            class="seg"
            [Tabs]="bandNavTabs"
            [ActiveKey]="ActiveBandFilter"
            (TabChange)="onFilterBand($event)"
          />
          <button mjButton variant="secondary" size="sm" class="btn sm filter-btn" (click)="onOpenFilter()">
            <i class="fa-solid fa-sliders"></i>
            <span>Filter</span>
          </button>
        </div>

        <div class="card table-card">
          <table class="table">
            <thead>
              <tr>
                <th style="padding-top:12px">Name</th>
                <th style="padding-top:12px;width:150px">Who can see it</th>
                <th style="padding-top:12px;width:130px">Used by</th>
                <th style="width:36px"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of FilteredRows; track row.id) {
                <tr [class.sel]="row.id === SelectedRowId" (click)="onSelectRow(row)">
                  <td>
                    <div class="row gap10">
                      <mjc-file-icon [Kind]="row.kind" Size="sm" />
                      <div class="grow">
                        <div class="fw6 fs13 ellipsis title">{{ row.name }}</div>
                        <div class="fs12 muted ellipsis sub">
                          <span>{{ row.folder }}</span>
                          <span class="dotsep"></span>
                          <span>{{ row.who }}, {{ row.when }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="row gap6">
                      <mjc-band-chip [Band]="row.band" [Label]="row.band" />
                      @if (row.flagCount) {
                        <span class="chip warn">
                          <i class="fa-solid fa-triangle-exclamation"></i>
                          <span>{{ row.flagCount }}</span>
                        </span>
                      }
                    </div>
                  </td>
                  <td>
                    <div class="row gap8">
                      @if (row.openers && row.openers.length > 0) {
                        <mjc-avatar-stack [Avatars]="row.openers" [Max]="3" Size="xs" />
                      }
                      @if (row.aiSeenCount) {
                        <span class="ai-chip">
                          <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                            <path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/>
                            <path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/>
                          </svg>
                          <span>{{ row.aiSeenCount }}</span>
                        </span>
                      }
                    </div>
                  </td>
                  <td style="text-align:right;width:36px">
                    <i class="fa-solid fa-ellipsis muted"></i>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Right drawer: Document preview and recent use -->
      @if (ShowDrawer) {
        <mjc-item-preview
          [Kind]="SelectedRow?.kind || 'doc'"
          [Title]="SelectedRow?.name || ''"
          [Meta]="PreviewMeta"
          [Paragraphs]="PreviewParagraphs"
          [Band]="SelectedRow?.band || 'Team'"
          [BandLabel]="PreviewBandLabel"
          [AudienceSubtitle]="PreviewAudienceSub"
          [StaffAvatars]="PreviewStaffAvatars"
          [FlagCount]="SelectedRow?.flagCount || 0"
          [FlagTitle]="PreviewFlagTitle"
          [FlagDescription]="PreviewFlagDescription"
          [ShareButtonLabel]="PreviewShareButtonLabel"
          [RecentUses]="PreviewRecentUses"
          (CloseRequested)="onCloseDrawer()"
          (ShareRequested)="onShareFromPreview()"
        />
      }
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-size: 14px;
      line-height: var(--mjc-line-height);
    }

    .lib {
      display: grid;
      grid-template-columns: 206px minmax(0, 1fr) 318px;
      min-height: 0;
      flex: 1;
    }

    .folders {
      padding: 16px 10px 16px 14px;
      border-right: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .fold {
      display: flex;
      align-items: center;
      gap: 9px;
      height: 32px;
      padding: 0 9px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--mj-text-secondary);
      cursor: pointer;

      i {
        color: var(--mj-text-muted);
        width: 14px;
        font-size: 13px;
      }

      &.on {
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-primary);
        font-weight: 600;
      }

      .n {
        margin-left: auto;
        font-size: 11.5px;
        color: var(--mj-text-muted);
        font-weight: 600;
      }
    }

    .fold-h {
      font-size: 11px;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mj-text-muted);
      margin: 14px 9px 4px;
    }

    .dotc {
      width: 7px;
      height: 7px;
      border-radius: 9px;
      margin-left: 2px;

      &.shared { background: var(--mjc-shared-strong); }
      &.team { background: var(--mj-text-disabled); }
    }

    .legend {
      margin-top: auto;
      padding: 12px 8px 4px;
      border-top: 1px solid var(--mj-border-default);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .files {
      padding: 16px 18px;
      min-width: 0;
    }

    .lib-tools {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .search-input {
      width: 220px;
      display: flex;
      align-items: center;
      gap: 8px;
      height: 38px;
      padding: 0 12px;
      border-radius: var(--mj-radius-sm);
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      color: var(--mj-text-disabled);
      font-size: 13px;
      box-sizing: border-box;

      i { font-size: 12px; }
    }

    .seg {
      display: inline-flex;
      padding: 2px;
      gap: 2px;
      border-radius: var(--mj-radius-lg);
      background: var(--mj-bg-surface-card);
      border: 1px solid var(--mj-border-default);

      span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 12px;
        border-radius: 99px;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--mj-text-secondary);
        cursor: pointer;

        &.on {
          background: var(--mj-bg-surface);
          color: var(--mj-text-primary);
          font-weight: 600;
          box-shadow: var(--mj-shadow-sm);
        }

        .n {
          font-size: 11px;
          color: var(--mj-text-muted);
        }
      }
    }

    .filter-btn {
      margin-left: auto;
      height: 32px;
      padding: 0 12px;
      border-radius: var(--mj-radius-sm);
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      color: var(--mj-text-primary);
      font-size: 12.5px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &:hover {
        background: var(--mj-bg-surface-hover);
      }
    }

    .table-card {
      overflow: hidden;
      border-radius: 12px;
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      box-shadow: var(--mj-shadow-sm);
    }

    .table {
      width: 100%;
      border-collapse: collapse;

      th {
        text-align: left;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--mj-text-muted);
        padding: 0 14px 8px;
        letter-spacing: 0.02em;
      }

      td {
        padding: 9px 14px;
        border-top: 1px solid var(--mj-border-subtle);
        vertical-align: middle;
        font-size: 13px;
      }

      tr {
        cursor: pointer;

        &.sel td {
          background: color-mix(in srgb, var(--mj-brand-primary) 6%, var(--mj-bg-surface));
        }

        &.sel td:first-child {
          box-shadow: inset 3px 0 0 var(--mj-brand-primary);
        }
      }
    }

    .ai-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      color: var(--mj-brand-primary);
      background: color-mix(in srgb, var(--mj-brand-primary) 9%, var(--mj-bg-surface));
      border-radius: 6px;
      padding: 2px 6px;

      svg {
        width: 11px;
        height: 11px;
      }
    }

    .chip.warn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11.5px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 99px;
      background: var(--mj-status-warning-bg);
      color: var(--mj-status-warning-text);
      border: 1px solid color-mix(in srgb, var(--mj-status-warning) 30%, transparent);

      i { font-size: 10px; }
    }

    .dotsep::before {
      content: '·';
      margin: 0 2px;
    }

    .grow { flex: 1; min-width: 0; }
    .row { display: flex; align-items: center; }
    .gap6 { gap: 6px; }
    .gap8 { gap: 8px; }
    .gap10 { gap: 10px; }

    .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .fw6 { font-weight: 600; }
    .fs12 { font-size: 12px; }
    .fs13 { font-size: 13px; }
    .muted { color: var(--mj-text-muted); }
  `],
})
export class CollabSpaceLibraryComponent {
  @Input() public TotalCount = 24;
  @Input() public SharedCount = 9;
  @Input() public TeamCount = 15;

  @Input() public ActiveFolderId = 'all';
  @Input() public ActiveBandFilter: 'All' | 'Shared' | 'Team' = 'All';

  @Input() public Collections: LibraryCollection[] = [
    { id: 'deliv', name: 'Deliverables', band: 'Shared', count: 5 },
    { id: 'proc', name: 'Process maps', band: 'Shared', count: 3 },
    { id: 'int', name: 'Interviews', band: 'Team', count: 9 },
    { id: 'vendor', name: 'Vendor scoring', band: 'Team', count: 3 },
    { id: 'contracts', name: 'Contracts', band: 'Team', count: 2 },
  ];

  @Input() public SmartViews: LibrarySmartView[] = [];

  @Input() public Rows: LibraryRowModel[] = [];
  @Input() public SelectedRowId = '';
  @Input() public ShowDrawer = true;

  @Input() public PreviewMeta = '';
  @Input() public PreviewParagraphs: string[] = [];
  @Input() public PreviewBandLabel = '';
  @Input() public PreviewAudienceSub = '';
  @Input() public PreviewStaffAvatars: AvatarItem[] = [];
  @Input() public PreviewFlagTitle = '';
  @Input() public PreviewFlagDescription = '';
  @Input() public PreviewShareButtonLabel = '';
  @Input() public PreviewRecentUses: Array<{ id: string; isSpark?: boolean; avatar?: AvatarItem; text: string; timestamp: string }> = [];
  @Input() public SharedBandLegend = '';
  @Input() public TeamBandLegend = '';

  @Output() public FolderSelectRequested = new EventEmitter<string>();
  @Output() public BandFilterChangeRequested = new EventEmitter<'All' | 'Shared' | 'Team'>();
  @Output() public RowSelectRequested = new EventEmitter<LibraryRowModel>();
  @Output() public ShareRequested = new EventEmitter<LibraryRowModel>();
  @Output() public CloseDrawerRequested = new EventEmitter<void>();
  @Output() public FilterButtonClickRequested = new EventEmitter<void>();

  public get FilteredRows(): LibraryRowModel[] {
    if (this.ActiveBandFilter === 'All') {
      return this.Rows;
    }
    return this.Rows.filter((r) => r.band === this.ActiveBandFilter);
  }

  public get bandNavTabs(): TabConfig[] {
    return [
      { key: 'All', label: 'All', badge: this.TotalCount },
      { key: 'Shared', label: 'Shared', icon: 'fa-solid fa-eye', badge: this.SharedCount },
      { key: 'Team', label: 'Team', icon: 'fa-solid fa-lock', badge: this.TeamCount },
    ];
  }

  public get SelectedRow(): LibraryRowModel | undefined {
    return this.Rows.find((r) => r.id === this.SelectedRowId);
  }

  public onSelectFolder(id: string): void {
    this.ActiveFolderId = id;
    this.FolderSelectRequested.emit(id);
  }

  public onFilterBand(band: 'All' | 'Shared' | 'Team' | string): void {
    const validBand = (band === 'Shared' || band === 'Team') ? band : 'All';
    this.ActiveBandFilter = validBand;
    this.BandFilterChangeRequested.emit(validBand);
  }

  public onSelectRow(row: LibraryRowModel): void {
    this.SelectedRowId = row.id;
    this.ShowDrawer = true;
    this.RowSelectRequested.emit(row);
  }

  public onCloseDrawer(): void {
    this.ShowDrawer = false;
    this.CloseDrawerRequested.emit();
  }

  public onShareFromPreview(): void {
    if (this.SelectedRow) {
      this.ShareRequested.emit(this.SelectedRow);
    }
  }

  public onOpenFilter(): void {
    this.FilterButtonClickRequested.emit();
  }
}
