import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ItemCardModel, ItemRowModel, NeedsYouItemModel } from './types';
import { CollabAvatarComponent } from './avatar.component';
import { CollabBandChipComponent } from './band-chip.component';
import { CollabTypeTileComponent } from './type-tile.component';
import { CollabNeedsYouCardComponent } from './needs-you-card.component';
import { CollabItemCardComponent } from './item-card.component';
import { CollabItemRowComponent } from './item-row.component';
import { CollabAskBoxComponent } from './ask-box.component';
import { COLLAB_TOKENS_CSS } from './tokens';

export interface RoomMiniMessage {
  id?: string;
  senderName: string;
  senderInitials?: string;
  senderColorClass?: string;
  isOutside?: boolean;
  isAssistant?: boolean;
  timestamp: string;
  text: string;
  hasMention?: boolean;
  mentionText?: string;
}

export interface SubSpaceSummary {
  id: string;
  name: string;
  type: string;
  iconClass: string;
  color?: string;
  description: string;
}

@Component({
  selector: 'mjc-space-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CollabAvatarComponent,
    CollabBandChipComponent,
    CollabTypeTileComponent,
    CollabNeedsYouCardComponent,
    CollabItemCardComponent,
    CollabItemRowComponent,
    CollabAskBoxComponent,
  ],
  template: `
    <div class="page ov">
      <div class="ov-grid">
        <div class="col">
          <!-- Attention / Needs-you strip -->
          @if (NeedsYouItems && NeedsYouItems.length > 0) {
            <div class="attn">
              @for (item of NeedsYouItems; track item.id) {
                <mjc-needs-you-card
                  [Item]="item"
                  [Variant]="item.variant"
                  [IconClass]="item.iconClass || ''"
                  [IsSpark]="item.isSpark || false"
                  [Title]="item.title"
                  [Subtitle]="item.subtitle"
                  [ActionLabel]="item.actionLabel"
                  (ActionRequested)="onNeedsYouAction(item)"
                />
              }
            </div>
          }

          <!-- Shared with Client band -->
          <div class="card band-card shared-band">
            <div class="band-h">
              <span class="band-ic">
                <i class="fa-solid fa-eye"></i>
              </span>
              <div class="grow">
                <div class="fw7 fs14">{{ SharedBandTitle }}</div>
                <div class="fs12 band-sub">{{ SharedBandSubtitle }}</div>
              </div>
              <a class="link fs12 preview-link" (click)="onPreviewAsPersona($event)">
                <i class="fa-solid fa-eye"></i>&nbsp;Preview as {{ ClientPersonaName }}
              </a>
            </div>
            <div class="deliv-grid">
              @for (item of SharedItems; track item.id) {
                <mjc-item-card
                  [Item]="item"
                  [Title]="item.title"
                  [Meta]="item.meta"
                  [Stamp]="item.stamp"
                  [Kind]="item.kind"
                  [Openers]="item.openers"
                  [CitationCount]="item.citationCount"
                  [IsImage]="item.isImage || false"
                  (ItemSelectRequested)="onItemSelected(item)"
                />
              }
            </div>
          </div>

          <!-- Team Working Set band -->
          <div class="card band-card team-band">
            <div class="band-h">
              <span class="band-ic team">
                <i class="fa-solid fa-lock"></i>
              </span>
              <div class="grow">
                <div class="fw7 fs14">Team working set</div>
                <div class="fs12 muted">Only {{ FirmName }} staff · {{ TeamTotalCount || 15 }} items · never quoted to {{ ClientOrgName }}</div>
              </div>
              <a class="link fs12 open-lib-link" (click)="onOpenLibrary($event)">Open library</a>
            </div>
            <div class="trows">
              @for (item of TeamItems; track item.id) {
                <mjc-item-row
                  [Item]="item"
                  [Title]="item.title"
                  [Author]="item.author"
                  [Timestamp]="item.timestamp"
                  [Kind]="item.kind"
                  [FlagCount]="item.flagCount"
                  [StatusLabel]="item.statusLabel"
                  [CanShare]="item.canShare !== false"
                  (RowSelectRequested)="onItemSelected(item)"
                  (ShareRequested)="onShareRequested(item)"
                />
              }
            </div>
          </div>
        </div>

        <div class="col">
          <!-- Ask Box -->
          <mjc-ask-box
            [Title]="'Ask about ' + SpaceName"
            [Suggestions]="AskSuggestions"
            (AskRequested)="onAskRequested($event)"
          />

          <!-- Room Card -->
          <div class="card room-card">
            <div class="card-h">
              <span class="h3">Room</span>
              <mjc-band-chip Band="Shared" [Label]="'Everyone · ' + AudienceCount" />
              <a class="link open-chat-link" (click)="onOpenChat($event)">Open chat</a>
            </div>
            <div class="mini-msgs">
              @for (msg of RoomMessages; track msg.id || $index) {
                <div class="mm">
                  @if (msg.isAssistant) {
                    <span class="ai-av sm">
                      <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                        <path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/>
                        <path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/>
                      </svg>
                    </span>
                  } @else {
                    <mjc-avatar
                      [Avatar]="{ initials: msg.senderInitials || '', colorClass: msg.senderColorClass || 'c1', isOutside: msg.isOutside }"
                      Size="sm"
                    />
                  }
                  <div class="grow">
                    <div class="fs12">
                      <b>{{ msg.senderName }}</b>
                      <span class="muted timestamp">&nbsp;{{ msg.timestamp }}</span>
                    </div>
                    <div class="fs12-5 secondary clamp">
                      @if (msg.hasMention) {
                        <span class="mention">{{ msg.mentionText }}</span><span>&nbsp;</span>
                      }
                      <span>{{ msg.text }}</span>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Sub-spaces -->
          @if (SubSpaces && SubSpaces.length > 0) {
            <div class="card sub-card">
              <div class="card-h">
                <span class="h3">Inside {{ SpaceName }}</span>
                <a class="link add-sub-link" (click)="onNewSubSpace($event)">+ Sub-space</a>
              </div>
              @for (sub of SubSpaces; track sub.id) {
                <div class="sub-row" (click)="onSubSpaceSelected(sub)">
                  <mjc-type-tile [IconClass]="sub.iconClass" [Color]="sub.color" Size="lg" />
                  <div class="grow">
                    <div class="fw6 fs13">{{ sub.name }}</div>
                    <div class="fs12 muted">{{ sub.description }}</div>
                  </div>
                  <i class="fa-solid fa-chevron-right muted fs12"></i>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: block;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-size: 14px;
      line-height: var(--mjc-line-height);
    }

    .ov {
      padding: 18px 28px;
    }

    .ov-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 18px;
    }

    .col {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-width: 0;
    }

    .attn {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .card {
      border-radius: 12px;
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      box-shadow: var(--mj-shadow-sm);
    }

    .band-card {
      overflow: hidden;
    }

    .band-h {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
    }

    .shared-band {
      border-color: var(--mjc-shared-border);

      .band-h {
        background: linear-gradient(90deg, var(--mjc-shared-bg), var(--mj-bg-surface));
        border-bottom: 1px solid var(--mjc-shared-border);
      }
    }

    .band-sub {
      color: var(--mjc-shared);
    }

    .band-ic {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      color: var(--mjc-on-strong);
      background: var(--mjc-shared-strong);
      font-size: 13px;
      flex: none;

      &.team {
        background: var(--mjc-team-strong);
      }
    }

    .team-band {
      .band-h {
        border-bottom: 1px solid var(--mj-border-default);
        background: repeating-linear-gradient(135deg, var(--mj-bg-surface-card) 0 8px, var(--mj-bg-surface) 8px 16px);
      }
    }

    .deliv-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      padding: 14px 16px 16px;
    }

    .trows {
      padding: 4px 8px 8px;
    }

    .card-h {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px 10px;
    }

    .h3 {
      font-size: 14px;
      font-weight: 700;
      color: var(--mj-text-primary);
      margin: 0;
    }

    .link {
      color: var(--mj-brand-primary);
      text-decoration: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      margin-left: auto;

      &:hover {
        text-decoration: underline;
      }
    }

    .mini-msgs {
      padding: 2px 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .mm {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .clamp {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-size: 12px;
      line-height: 1.4;
    }

    .mention {
      color: var(--mj-brand-primary, #0076b6);
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 12%, transparent);
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 11.5px;
      display: inline-block;
      margin-right: 2px;
    }

    .sub-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 16px 14px;
      cursor: pointer;
    }

    .grow {
      flex: 1;
      min-width: 0;
    }

    .row {
      display: flex;
      align-items: center;
    }

    .fw6 { font-weight: 600; }
    .fw7 { font-weight: 700; }
    .fs11 { font-size: 11px; }
    .fs12 { font-size: 12px; }
    .fs12-5 { font-size: 12.5px; }
    .fs13 { font-size: 13px; }
    .fs14 { font-size: 14px; }
    .muted { color: var(--mj-text-muted); }
    .secondary { color: var(--mj-text-secondary); }

    .ai-av.sm {
      width: 18px;
      height: 18px;
      font-size: 9px;
      border-radius: 5px;
      display: inline-grid;
      place-items: center;
      background: linear-gradient(135deg, var(--mjc-ai-from), var(--mjc-ai-to));
      color: var(--mj-text-inverse);
      flex: none;
    }
  `],
})
export class CollabSpaceOverviewComponent {
  @Input() public SpaceName = '';
  @Input() public FirmName = '';
  @Input() public ClientOrgName = '';
  @Input() public ClientPersonaName = '';
  @Input() public AudienceCount = 0;

  @Input() public SharedBandTitle = '';
  @Input() public SharedBandSubtitle = '';

  @Input() public NeedsYouItems: NeedsYouItemModel[] = [];
  @Input() public SharedItems: ItemCardModel[] = [];
  @Input() public TeamItems: ItemRowModel[] = [];
  @Input() public TeamTotalCount = 0;
  @Input() public RoomMessages: RoomMiniMessage[] = [];
  @Input() public SubSpaces: SubSpaceSummary[] = [];
  @Input() public AskSuggestions: string[] = [];

  @Output() public NeedsYouActionRequested = new EventEmitter<NeedsYouItemModel>();
  @Output() public ItemSelectRequested = new EventEmitter<ItemCardModel | ItemRowModel>();
  @Output() public ShareRequested = new EventEmitter<ItemRowModel>();
  @Output() public PreviewAsRequested = new EventEmitter<string>();
  @Output() public OpenLibraryRequested = new EventEmitter<void>();
  @Output() public OpenChatRequested = new EventEmitter<void>();
  @Output() public NewSubSpaceRequested = new EventEmitter<void>();
  @Output() public SubSpaceSelectRequested = new EventEmitter<SubSpaceSummary>();
  @Output() public AskRequested = new EventEmitter<string>();

  public onNeedsYouAction(item: NeedsYouItemModel): void {
    this.NeedsYouActionRequested.emit(item);
  }

  public onItemSelected(item: ItemCardModel | ItemRowModel): void {
    this.ItemSelectRequested.emit(item);
  }

  public onShareRequested(item: ItemRowModel): void {
    this.ShareRequested.emit(item);
  }

  public onPreviewAsPersona(event?: MouseEvent): void {
    event?.preventDefault();
    this.PreviewAsRequested.emit(this.ClientPersonaName.toLowerCase());
  }

  public onOpenLibrary(event?: MouseEvent): void {
    event?.preventDefault();
    this.OpenLibraryRequested.emit();
  }

  public onOpenChat(event?: MouseEvent): void {
    event?.preventDefault();
    this.OpenChatRequested.emit();
  }

  public onNewSubSpace(event?: MouseEvent): void {
    event?.preventDefault();
    this.NewSubSpaceRequested.emit();
  }

  public onSubSpaceSelected(sub: SubSpaceSummary): void {
    this.SubSpaceSelectRequested.emit(sub);
  }

  public onAskRequested(query: string): void {
    this.AskRequested.emit(query);
  }
}
