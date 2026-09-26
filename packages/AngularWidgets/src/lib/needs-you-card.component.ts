import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { NeedsYouItemModel } from './types';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-needs-you-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="attn-card">
      <span class="ic" [class]="Variant">
        @if (IsSpark) {
          <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5c.4 3.9 1.5 6.2 3.1 7.6 1.4 1.3 3.5 2 6.4 2.4-2.9.4-5 1.1-6.4 2.4-1.6 1.4-2.7 3.7-3.1 7.6-.4-3.9-1.5-6.2-3.1-7.6-1.4-1.3-3.5-2-6.4-2.4 2.9-.4 5-1.1 6.4-2.4 1.6-1.4 2.7-3.7 3.1-7.6z"/>
            <path d="M19 1.8c.15 1.3.5 2 1.05 2.5.5.45 1.2.7 2.2.85-1 .15-1.7.4-2.2.85-.55.5-.9 1.2-1.05 2.5-.15-1.3-.5-2-1.05-2.5-.5-.45-1.2-.7-2.2-.85 1-.15 1.7-.4 2.2-.85.55-.5.9-1.2 1.05-2.5z" opacity=".8"/>
          </svg>
        } @else {
          <i [class]="IconClass"></i>
        }
      </span>
      <div class="grow">
        <div class="fw6 fs13 ellipsis title">{{ Title }}</div>
        <div class="fs12 muted ellipsis sub">{{ Subtitle }}</div>
      </div>
      <button type="button" class="btn sm" (click)="onAction()">{{ ActionLabel }}</button>
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: block;
      min-width: 0;
      line-height: var(--mjc-line-height);
    }

    .attn-card {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 10px 10px 12px;
      border-radius: 12px;
      background: var(--mj-bg-surface);
      border: 1px solid var(--mj-border-default);
      box-shadow: var(--mj-shadow-sm);
    }

    .ic {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      display: grid;
      place-items: center;
      font-size: 13px;
      flex: none;

      &.blue {
        background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
        color: var(--mj-brand-primary);
      }
      &.warn {
        background: var(--mj-status-warning-bg);
        color: var(--mj-status-warning-text);
      }
      &.red {
        background: var(--mj-status-error-bg);
        color: var(--mj-status-error-text);
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

    .btn.sm {
      height: 30px;
      padding: 0 12px;
      border-radius: 8px;
      border: 0;
      background: var(--mj-bg-surface-active, #f1f5f9);
      color: var(--mj-text-primary, #0f172a);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      flex: none;

      &:hover {
        background: var(--mj-bg-surface-hover, #e2e8f0);
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
export class CollabNeedsYouCardComponent {
  @Input() public Item?: NeedsYouItemModel;
  @Input() public Variant: 'blue' | 'warn' | 'red' = 'blue';
  @Input() public IconClass = 'fa-solid fa-comment-dots';
  @Input() public IsSpark = false;
  @Input() public Title = '';
  @Input() public Subtitle = '';
  @Input() public ActionLabel = '';

  @Output() public ActionRequested = new EventEmitter<void>();

  public onAction(): void {
    this.ActionRequested.emit();
  }
}
