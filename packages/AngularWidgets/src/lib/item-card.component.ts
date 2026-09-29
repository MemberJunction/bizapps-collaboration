import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MJClickableDirective } from '@memberjunction/ng-ui-components';
import type { AvatarItem, FileKind, ItemCardModel } from './types';
import { CollabAvatarComponent } from './avatar.component';
import { CollabFileIconComponent } from './file-icon.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-item-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabAvatarComponent, CollabFileIconComponent, MJClickableDirective],
  template: `
    <div class="deliv" [mjClickable]="Title" (click)="onSelect()">
      <div class="thumb" [class]="kindClass">
        <div class="page-lines"><i></i><i></i><i></i><i></i><i></i></div>
        <mjc-file-icon [Kind]="Kind" Size="sm" />
      </div>
      <div class="fw6 fs13 ellipsis title">{{ Title }}</div>
      <div class="fs12 muted ellipsis meta">{{ Meta }}</div>
      <div class="deliv-foot">
        <span class="fs11 secondary ellipsis stamp">{{ Stamp }}</span>
        <span class="row gap6 seen-stack">
          @if (Openers && Openers.length > 0) {
            @for (av of Openers; track av.name || av.initials) {
              <mjc-avatar [Avatar]="av" Size="xs" />
            }
            <span class="fs11 muted">opened</span>
          } @else if (CitationCount) {
            <span class="ai-av sm">
              <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                <path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/>
                <path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/>
              </svg>
            </span>
            <span class="fs11 muted">cited {{ CitationCount }}×</span>
          }
        </span>
      </div>
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: block;
      min-width: 0;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-size: 14px;
      line-height: var(--mjc-line-height);
    }

    .deliv {
      min-width: 0;
      cursor: pointer;
    }

    .thumb {
      position: relative;
      height: 84px;
      border-radius: 10px;
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface-card);
      overflow: hidden;

      &.img {
        background: linear-gradient(135deg, var(--mj-border-strong), var(--mj-text-disabled) 40%, var(--mj-text-muted));
        .page-lines { display: none; }
      }

      .page-lines {
        position: absolute;
        left: 18px;
        right: 30px;
        top: 14px;
        bottom: -10px;
        background: var(--mj-bg-surface);
        border-radius: 4px 4px 0 0;
        box-shadow: var(--mj-shadow-md);
        padding: 12px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;

        i {
          display: block;
          height: 5px;
          border-radius: 3px;
          background: var(--mj-border-default);

          &:first-child {
            width: 60%;
            height: 7px;
            background: var(--mj-text-secondary);
            opacity: 0.5;
          }
          &:nth-child(3) { width: 80%; }
          &:nth-child(5) { width: 45%; }
        }
      }

      mjc-file-icon {
        position: absolute;
        right: 8px;
        bottom: 8px;
        box-shadow: var(--mj-shadow-sm);
      }
    }

    .title {
      margin-top: 10px;
    }

    .deliv-foot {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
    }

    .stamp {
      color: var(--mj-text-secondary);
    }

    .seen-stack {
      margin-left: auto;
    }

    .row {
      display: flex;
      align-items: center;
    }

    .gap6 {
      gap: 6px;
    }

    .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .fw6 { font-weight: 600; }
    .fs11 { font-size: 11px; }
    .fs12 { font-size: 12px; }
    .fs13 { font-size: 13px; }
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
    }
  `],
})
export class CollabItemCardComponent {
  @Input() public Item?: ItemCardModel;
  @Input() public Title = '';
  @Input() public Meta = '';
  @Input() public Stamp = '';
  @Input() public Kind: FileKind = 'doc';
  @Input() public Openers?: AvatarItem[];
  @Input() public CitationCount?: number;
  @Input() public IsImage = false;

  @Output() public ItemSelectRequested = new EventEmitter<void>();

  public get kindClass(): string {
    const k = (this.Item?.kind || this.Kind || 'doc').toLowerCase();
    return `${k} ${this.Item?.isImage || this.IsImage || k === 'img' ? 'img' : ''}`;
  }

  public onSelect(): void {
    this.ItemSelectRequested.emit();
  }
}
