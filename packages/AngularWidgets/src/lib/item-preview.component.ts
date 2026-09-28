import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { AvatarItem, FileKind, RecentUseModel, SpaceBand } from './types';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { CollabAvatarComponent } from './avatar.component';
import { CollabBandChipComponent } from './band-chip.component';
import { CollabFileIconComponent } from './file-icon.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-item-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabAvatarComponent, CollabBandChipComponent, CollabFileIconComponent, MJButtonDirective],
  template: `
    <aside class="drawer">
      <div class="row gap10 header-row">
        <mjc-file-icon [Kind]="Kind" Size="md" />
        <div class="grow">
          <div class="fw7 fs14 ellipsis title">{{ Title }}</div>
          <div class="fs12 muted meta">{{ Meta }}</div>
        </div>
        <button mjButton variant="icon" class="icon-btn-ghost close-btn" (click)="onClose()" ariaLabel="Close preview">
          <i class="fa-solid fa-xmark muted"></i>
        </button>
      </div>

      <div class="doc-prev">
        <div class="dp-page">
          <div class="dp-h"></div>
          @for (p of Paragraphs; track $index) {
            <p>@for (seg of parseParagraph(p); track $index) {@if (seg.isMarked) {<mark class="marked-phrase">{{ seg.text }}</mark>} @else {{{ seg.text }}}}</p>
          }
          <div class="dp-l"></div>
          <div class="dp-l s"></div>
        </div>
      </div>

      <div class="dr-sec">
        <div class="row gap8 band-row">
          <mjc-band-chip [Band]="Band" [Label]="BandLabel" />
          <span class="fs12 muted">{{ AudienceSubtitle }}</span>
          <span class="stack staff-stack">
            @for (av of StaffAvatars; track av.name || av.initials) {
              <mjc-avatar [Avatar]="av" Size="xs" />
            }
          </span>
        </div>

        @if (FlagCount) {
          <div class="flag-box">
            <div class="row gap8">
              <span class="ai-av sm">
                <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                  <path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/>
                  <path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/>
                </svg>
              </span>
              <span class="fw6 fs13">{{ FlagTitle }}</span>
            </div>
            <div class="fs12 secondary flag-desc">{{ FlagDescription }}</div>
          </div>
        }

        <div class="preview-actions">
          <button mjButton variant="primary" class="btn primary share-btn-full" (click)="onShare()">
            <i class="fa-solid fa-share-from-square"></i>
            <span>{{ ShareButtonLabel }}</span>
          </button>
          @if (FileId) {
            <button mjButton variant="secondary" class="btn secondary open-file-btn" (click)="onOpenFile()" title="Open Document">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
              <span>Open Document</span>
            </button>
          }
        </div>
      </div>

      @if (RecentUses && RecentUses.length > 0) {
        <div class="dr-sec">
          <div class="eyebrow">Recent use</div>
          @for (use of RecentUses; track use.id || $index) {
            <div class="use">
              @if (use.isSpark) {
                <span class="ai-av sm">
                  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/>
                    <path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/>
                  </svg>
                </span>
              } @else if (use.avatar) {
                <mjc-avatar [Avatar]="use.avatar" Size="xs" />
              }
              <span class="grow fs12-5">
                @for (part of parseRecentUseText(use.text); track $index) {
                  @if (part.isBold) {
                    <b>{{ part.text }}</b>
                  } @else {
                    {{ part.text }}
                  }
                }
              </span>
              <span class="fs12 muted">{{ use.timestamp }}</span>
            </div>
          }
        </div>
      }
    </aside>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: block;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-size: 14px;
      line-height: var(--mjc-line-height);
    }

    .drawer {
      border-left: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-height: 0;
      overflow: hidden;
      width: 318px;
      box-sizing: border-box;
    }

    .row {
      display: flex;
      align-items: center;
    }

    .gap8 { gap: 8px; }
    .gap10 { gap: 10px; }

    .grow {
      flex: 1;
      min-width: 0;
    }

    .close-btn {
      background: transparent;
      border: 0;
      cursor: pointer;
      font-size: 15px;
      padding: 4px;
      line-height: 1;
    }

    .doc-prev {
      background: var(--mj-bg-surface-sunken);
      border-radius: 12px;
      padding: 14px 16px 0;
      height: 196px;
      overflow: hidden;
      border: 1px solid var(--mj-border-default);
      box-sizing: border-box;
    }

    .dp-page {
      background: var(--mj-bg-surface);
      border-radius: 6px 6px 0 0;
      box-shadow: var(--mj-shadow-md);
      padding: 14px 16px;
      height: 100%;
      font-size: 10.5px;
      line-height: 1.6;
      color: var(--mj-text-secondary);
      font-family: Georgia, 'DejaVu Serif', serif;
      box-sizing: border-box;

      p {
        font-size: 10.5px;
        margin: 0 0 8px;
      }

      .marked-phrase {
        background: color-mix(in srgb, var(--mj-status-warning) 35%, transparent);
        color: var(--mj-text-primary);
        border-radius: 2px;
        padding: 0 1px;
      }
    }

    .dp-h {
      width: 55%;
      height: 9px;
      border-radius: 3px;
      background: var(--mj-text-secondary);
      opacity: 0.55;
      margin-bottom: 10px;
    }

    .dp-l {
      height: 5px;
      border-radius: 3px;
      background: var(--mj-border-default);
      margin-top: 7px;

      &.s {
        width: 60%;
      }
    }

    .dr-sec {
      border-top: 1px solid var(--mj-border-default);
      padding-top: 14px;
    }

    .staff-stack {
      margin-left: auto;
      display: flex;
      align-items: center;
    }

    .flag-box {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--mj-status-warning-bg);
      border: 1px solid color-mix(in srgb, var(--mj-status-warning) 35%, transparent);
    }

    .flag-desc {
      margin-top: 4px;
      color: var(--mj-text-secondary);
    }

    .share-btn-full {
      width: 100%;
      margin-top: 12px;
      min-height: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 600;
      font-size: 14px;
      border-radius: var(--mj-radius-md);
      border: 0;
      background: var(--mj-brand-primary);
      color: var(--mj-brand-on-primary);
      cursor: pointer;

      &:hover {
        background: var(--mj-brand-primary-hover);
      }
    }

    .preview-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .open-file-btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 9px 14px;
      font-weight: 600;
      font-size: 13.5px;
      border-radius: var(--mj-radius-md);
      cursor: pointer;
    }

    .eyebrow {
      font-size: 11px;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mj-text-muted);
      margin-bottom: 8px;
    }

    .use {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 5px 0;
    }

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

    .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .fw6 { font-weight: 600; }
    .fw7 { font-weight: 700; }
    .fs12 { font-size: 12px; }
    .fs12-5 { font-size: 12.5px; }
    .fs13 { font-size: 13px; }
    .fs14 { font-size: 14px; }
    .muted { color: var(--mj-text-muted); }
  `],
})
export class CollabItemPreviewComponent {
  @Input() public Kind: FileKind = 'doc';
  @Input() public Title = '';
  @Input() public Meta = '';
  @Input() public Paragraphs: string[] = [];
  @Input() public Band: SpaceBand = 'Team';
  @Input() public BandLabel = '';
  @Input() public AudienceSubtitle = '';
  @Input() public StaffAvatars: AvatarItem[] = [];
  @Input() public FlagCount = 0;
  @Input() public FlagTitle = '';
  @Input() public FlagDescription = '';
  @Input() public ShareButtonLabel = '';
  @Input() public RecentUses: RecentUseModel[] = [];
  @Input() public FileId = '';

  @Output() public CloseRequested = new EventEmitter<void>();
  @Output() public ShareRequested = new EventEmitter<void>();
  @Output() public OpenFileRequested = new EventEmitter<string>();

  public onClose(): void {
    this.CloseRequested.emit();
  }

  public onShare(): void {
    this.ShareRequested.emit();
  }

  public onOpenFile(): void {
    if (this.FileId) {
      this.OpenFileRequested.emit(this.FileId);
    }
  }

  public parseParagraph(p: string): Array<{ text: string; isMarked: boolean }> {
    const parts: Array<{ text: string; isMarked: boolean }> = [];
    const regex = /<mark>(.*?)<\/mark>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(p)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: p.slice(lastIndex, match.index), isMarked: false });
      }
      parts.push({ text: match[1], isMarked: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < p.length) {
      parts.push({ text: p.slice(lastIndex), isMarked: false });
    }
    return parts.length > 0 ? parts : [{ text: p, isMarked: false }];
  }

  public parseRecentUseText(text: string): Array<{ text: string; isBold: boolean }> {
    const parts: Array<{ text: string; isBold: boolean }> = [];
    const regex = /<b>(.*?)<\/b>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), isBold: false });
      }
      parts.push({ text: match[1], isBold: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), isBold: false });
    }
    return parts.length > 0 ? parts : [{ text, isBold: false }];
  }
}
