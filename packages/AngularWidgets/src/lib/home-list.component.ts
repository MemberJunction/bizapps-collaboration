import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { COLLAB_TOKENS_CSS } from './tokens';

/** One row of a Home list: what it is, where it is, and what selecting it does. */
export interface HomeListRow {
  key: string;
  title: string;
  /** Who or what, and when: the second line. */
  detail: string;
  /** The space it is in. */
  spaceName: string;
  iconClass: string;
  /** What selecting the row does, said for a screen reader and shown as the row's action ("Review on People"). */
  actionLabel: string;
}

/**
 * The rows behind one of Home's counts. It says how many there are in all when the list is cut short, what went wrong when the
 * read failed (with a way to try again), and what an empty list means. A row selects the thing it names; the host says where that goes.
 */
@Component({
  selector: 'mjc-home-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MJButtonDirective, SharedGenericModule],
  template: `
    <section class="hl" [attr.aria-labelledby]="'hl-title-' + Id">
      <header class="hl-head">
        <h2 class="hl-title" [id]="'hl-title-' + Id">{{ Title }}</h2>
        <button type="button" class="hl-close" aria-label="Close this list" (click)="CloseRequested.emit()">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>
      @if (IsLoading) {
        <div class="hl-state" role="status"><mj-loading Size="small" [showText]="false"></mj-loading> <span>Reading…</span></div>
      } @else if (ErrorMessage) {
        <div class="hl-state hl-error" role="alert">
          <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
          <span>{{ ErrorMessage }}</span>
          <button type="button" mjButton variant="secondary" size="sm" (click)="RetryRequested.emit()">Try again</button>
        </div>
      } @else if (Rows.length === 0) {
        <div class="hl-state" role="status">{{ EmptyMessage }}</div>
      } @else {
        <ul class="hl-rows">
          @for (row of Rows; track row.key) {
            <li>
              <button type="button" class="hl-row" [attr.aria-label]="row.title + ', ' + row.spaceName + '. ' + row.actionLabel" (click)="RowSelected.emit(row.key)">
                <span class="hl-ic"><i [class]="row.iconClass" aria-hidden="true"></i></span>
                <span class="hl-main">
                  <span class="hl-row-title">{{ row.title }}</span>
                  <span class="hl-row-detail">{{ row.detail }}</span>
                </span>
                <span class="hl-space">{{ row.spaceName }}</span>
                <span class="hl-action">{{ row.actionLabel }} <i class="fa-solid fa-chevron-right" aria-hidden="true"></i></span>
              </button>
            </li>
          }
        </ul>
        @if (TotalCount > Rows.length) {
          <p class="hl-more" role="status">Showing {{ Rows.length }} of {{ TotalCount }}.</p>
        }
      }
    </section>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
        font-family: var(--mj-font-family, Inter, sans-serif);
        color: var(--mj-text-primary);
        line-height: var(--mjc-line-height);
      }
      .hl {
        border: 1px solid var(--mj-border-default);
        border-radius: 8px;
        background: var(--mj-bg-surface);
        overflow: hidden;
      }
      .hl-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--mj-border-default);
      }
      .hl-title {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
      }
      .hl-close {
        border: none;
        background: transparent;
        color: var(--mj-text-secondary);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
      }
      .hl-close:hover {
        background: var(--mj-bg-surface-hover);
      }
      .hl-rows {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 360px;
        overflow-y: auto;
      }
      .hl-row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 16px;
        border: none;
        border-bottom: 1px solid var(--mj-border-subtle);
        background: transparent;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .hl-row:hover {
        background: var(--mj-bg-surface-hover);
      }
      .hl-row:focus-visible {
        outline: 2px solid var(--mj-brand-primary);
        outline-offset: -2px;
      }
      .hl-ic {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        flex: none;
        font-size: 13px;
        color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 10%, transparent);
      }
      .hl-main {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
      }
      .hl-row-title {
        font-size: 13.5px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hl-row-detail {
        font-size: 12px;
        color: var(--mj-text-secondary);
      }
      .hl-space {
        font-size: 12px;
        color: var(--mj-text-secondary);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hl-action {
        font-size: 12px;
        font-weight: 600;
        color: var(--mj-brand-primary);
        white-space: nowrap;
      }
      .hl-state {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px;
        font-size: 13px;
        color: var(--mj-text-secondary);
      }
      .hl-error {
        color: var(--mj-status-error-text);
      }
      .hl-more {
        margin: 0;
        padding: 8px 16px;
        font-size: 12px;
        color: var(--mj-text-secondary);
      }
    `,
  ],
})
export class CollabHomeListComponent {
  /** Makes the heading's id unique when two lists are on a page. */
  @Input() Id = 'list';
  @Input() Title = '';
  @Input() Rows: readonly HomeListRow[] = [];
  /** How many there are in all, when the rows are cut short. */
  @Input() TotalCount = 0;
  @Input() IsLoading = false;
  @Input() ErrorMessage = '';
  @Input() EmptyMessage = 'Nothing here.';

  @Output() RowSelected = new EventEmitter<string>();
  @Output() RetryRequested = new EventEmitter<void>();
  @Output() CloseRequested = new EventEmitter<void>();
}
