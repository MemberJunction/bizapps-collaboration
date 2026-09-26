import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Answer receipt showing data boundary provenance and feedback controls (L1).
 * Frames 05 and 11.
 */
@Component({
  selector: 'mjc-answer-receipt',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .receipt-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      border-radius: var(--mj-radius-md, 8px);
      background: var(--mj-bg-surface-sunken, rgba(148, 163, 184, 0.08));
      border: 1px solid var(--mj-border-subtle, #e2e8f0);
      font-size: 12px;
      color: var(--mj-text-secondary, #64748b);
      margin-top: 8px;
    }

    .info-side {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .shield-icon {
      font-size: 13px;
      color: var(--mj-text-muted, #94a3b8);
      flex-shrink: 0;
    }

    .text-msg {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .text-msg strong {
      color: var(--mj-text-primary, #0f172a);
      font-weight: 600;
    }

    .actions-side {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 6px;
      border-radius: var(--mj-radius-sm, 4px);
      border: 1px solid transparent;
      background: transparent;
      color: var(--mj-text-secondary, #64748b);
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.12s ease, border-color 0.12s ease;
    }

    .action-btn:hover {
      background: var(--mj-bg-surface-hover, rgba(0, 0, 0, 0.05));
      border-color: var(--mj-border-subtle, #e2e8f0);
    }

    .action-btn.active {
      background: color-mix(in srgb, var(--mj-brand-primary, #2563eb) 12%, transparent);
      color: var(--mj-brand-primary, #2563eb);
      border-color: color-mix(in srgb, var(--mj-brand-primary, #2563eb) 30%, transparent);
    }
  `],
  template: `
    <div class="receipt-box">
      <div class="info-side">
        <i class="shield-icon fa-solid fa-shield-halved"></i>
        <div class="text-msg">
          @if (!IsInternal) {
            Used <strong>{{ SharedCount }} Shared items</strong> · Team material wasn't searched, because {{ ClientOrgName }} is here
          } @else {
            Used <strong>{{ TeamCount }} Team</strong> and <strong>{{ SharedCount }} Shared item{{ SharedCount === 1 ? '' : 's' }}</strong> · this chat is Meridian only
          }
        </div>
      </div>

      <div class="actions-side">
        <button
          type="button"
          class="action-btn"
          [class.active]="hasUpvoted"
          (click)="onThumbUp()"
          aria-label="Helpful answer"
        >
          <i class="fa-regular fa-thumbs-up"></i>
          @if (thumbsCount > 0) {
            <span>{{ thumbsCount }}</span>
          }
        </button>

        <button
          type="button"
          class="action-btn"
          (click)="onThumbDown()"
          aria-label="Unhelpful answer"
        >
          <i class="fa-regular fa-thumbs-down"></i>
        </button>

        <button
          type="button"
          class="action-btn"
          (click)="onCopy()"
          aria-label="Copy answer"
        >
          <i class="fa-regular fa-copy"></i>
        </button>

        <button
          type="button"
          class="action-btn"
          (click)="onViewSources()"
          aria-label="View sources"
        >
          <i class="fa-solid fa-list-check"></i>
        </button>
      </div>
    </div>
  `,
})
export class CollabAnswerReceiptComponent {
  @Input() SharedCount = 3;
  @Input() TeamCount = 0;
  @Input() IsInternal = false;
  @Input() ClientOrgName = 'Northwind';
  @Input() ThumbsUpCount = 2;

  @Output() FeedbackGiven = new EventEmitter<'up' | 'down'>();
  @Output() CopyRequested = new EventEmitter<void>();
  @Output() ViewSourcesRequested = new EventEmitter<void>();

  public hasUpvoted = false;
  public thumbsCount = 2;

  public onThumbUp(): void {
    this.hasUpvoted = !this.hasUpvoted;
    this.thumbsCount += this.hasUpvoted ? 1 : -1;
    this.FeedbackGiven.emit('up');
  }

  public onThumbDown(): void {
    this.FeedbackGiven.emit('down');
  }

  public onCopy(): void {
    this.CopyRequested.emit();
  }

  public onViewSources(): void {
    this.ViewSourcesRequested.emit();
  }
}
