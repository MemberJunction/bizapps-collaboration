import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Chat banner showing audience security boundaries and Assistant access rules (L1).
 * Frame 05 (Shared) vs Frame 11 (Internal).
 */
@Component({
  selector: 'mjc-chat-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: var(--mj-radius-md, 8px);
      font-size: 13px;
      line-height: 1.4;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .banner.shared {
      background: var(--mj-brand-tertiary-subtle, rgba(14, 165, 233, 0.08));
      border: 1px solid color-mix(in srgb, var(--mj-brand-tertiary, #0ea5e9) 35%, transparent);
      color: var(--mj-text-primary, #0f172a);
    }

    .banner.internal {
      background: var(--mj-bg-surface-sunken, rgba(148, 163, 184, 0.1));
      border: 1px solid var(--mj-border-strong, #cbd5e1);
      color: var(--mj-text-primary, #0f172a);
    }

    .icon-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--mj-radius-md, 6px);
      flex-shrink: 0;
      font-size: 13px;
    }

    .banner.shared .icon-badge {
      background: var(--mj-brand-tertiary, #0ea5e9);
      color: var(--mj-text-inverse, #ffffff);
    }

    .banner.internal .icon-badge {
      background: var(--mj-bg-surface-elevated, #334155);
      color: var(--mj-text-inverse, #ffffff);
    }

    .banner-text {
      flex: 1;
    }

    .banner-text strong {
      font-weight: 600;
    }
  `],
  template: `
    <div class="banner" [class.shared]="!IsInternal" [class.internal]="IsInternal">
      <div class="icon-badge">
        @if (!IsInternal) {
          <i class="fa-solid fa-eye"></i>
        } @else {
          <i class="fa-solid fa-lock"></i>
        }
      </div>
      <div class="banner-text">
        @if (!IsInternal) {
          <strong>{{ ClientOrgName }} is in this chat.</strong> The Assistant uses only what all {{ TotalPeople }} people here can open.
        } @else {
          <strong>Only {{ FirmName }} staff are here.</strong> The Assistant can use Team and Shared material.
        }
      </div>
    </div>
  `,
})
export class CollabChatBannerComponent {
  @Input() IsInternal = false;
  @Input() ClientOrgName = 'Northwind';
  @Input() FirmName = 'Meridian';
  @Input() TotalPeople = 9;
}
