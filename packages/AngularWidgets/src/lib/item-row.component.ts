import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MJClickableDirective } from '@memberjunction/ng-ui-components';
import type { FileKind, ItemRowModel } from './types';
import { CollabFileIconComponent } from './file-icon.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-item-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabFileIconComponent, MJClickableDirective],
  template: `
    <div class="trow" [mjClickable]="Title" (click)="onSelect()">
      <mjc-file-icon [Kind]="Kind" Size="sm" />
      <div class="grow">
        <div class="fw6 fs13 ellipsis title">{{ Title }}</div>
        <div class="fs12 muted sub">{{ Author }}<span class="dotsep"></span>{{ Timestamp }}</div>
      </div>
      @if (FlagCount) {
        <span class="chip warn">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>{{ FlagCount }} names flagged</span>
        </span>
      }
      @if (StatusLabel) {
        <span class="chip plain">{{ StatusLabel }}</span>
      }
      @if (CanShare) {
        <button type="button" class="btn sm share-btn" (click)="onShareClick($event)">
          <i class="fa-solid fa-share-from-square"></i>
          <span>Share…</span>
        </button>
      }
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: block;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      line-height: var(--mjc-line-height);
    }

    .trow {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 8px;
      border-top: 1px solid var(--mj-border-subtle);
      cursor: pointer;

      &:first-child {
        border-top: 0;
      }
    }

    .grow {
      flex: 1;
      min-width: 0;
    }

    .title {
      color: var(--mj-text-primary);
    }

    .sub {
      color: var(--mj-text-muted);
    }

    .dotsep {
      width: 3px;
      height: 3px;
      border-radius: 9px;
      background: var(--mj-text-disabled);
      display: inline-block;
      margin: 0 8px;
      vertical-align: middle;
    }

    .share-btn {
      color: var(--mjc-shared, #0284c7);
      border-color: var(--mjc-shared-border, #bae6fd);
      background: var(--mj-bg-surface-sunken, #f0f9ff);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      min-height: 32px;
      border-radius: var(--mj-radius-md, 8px);
      border: 1px solid var(--mjc-shared-border, #bae6fd);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;

      i {
        color: var(--mjc-shared, #0284c7);
        font-size: 13px;
      }

      &:hover {
        background: var(--mjc-shared-bg, #e0f2fe);
      }
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 99px;
      border: 1px solid transparent;

      &.warn {
        background: var(--mj-status-warning-bg);
        color: var(--mj-status-warning-text);
        border-color: color-mix(in srgb, var(--mj-status-warning) 30%, transparent);

        i {
          font-size: 11px;
        }
      }

      &.plain {
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-secondary);
        border-color: var(--mj-border-default);
      }
    }

    .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .fw6 { font-weight: 600; }
    .fs12 { font-size: 12px; }
    .fs13 { font-size: 13px; }
  `],
})
export class CollabItemRowComponent {
  @Input() public Item?: ItemRowModel;
  @Input() public Title = '';
  @Input() public Author = '';
  @Input() public Timestamp = '';
  @Input() public Kind: FileKind = 'doc';
  @Input() public FlagCount?: number;
  @Input() public StatusLabel?: string;
  @Input() public CanShare = true;

  @Output() public RowSelectRequested = new EventEmitter<void>();
  @Output() public ShareRequested = new EventEmitter<void>();

  public onSelect(): void {
    this.RowSelectRequested.emit();
  }

  public onShareClick(event: MouseEvent): void {
    event.stopPropagation();
    this.ShareRequested.emit();
  }
}
