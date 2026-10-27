import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJClickableDirective } from '@memberjunction/ng-ui-components';
import type { PinModel } from './types';
import { COLLAB_TOKENS_CSS } from './tokens';

/** The viewer's pins (B22): a strip at the top of a space's overview, and *My pins* on Home across spaces. */
@Component({
  selector: 'mjc-pinned-strip',
  standalone: true,
  imports: [CommonModule, MJClickableDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (Pins.length > 0) {
      <div class="strip" role="list" [attr.aria-label]="Title">
        <span class="strip-title"><i class="fa-solid fa-thumbtack"></i> {{ Title }}</span>
        @for (pin of Pins; track pin.id) {
          <div class="pin" role="listitem">
            <span class="pin-main" [mjClickable]="'Open ' + pin.title" (click)="OpenRequested.emit(pin)">
              <i [class]="pin.iconClass"></i>
              <span class="pin-text">
                <span class="pin-title">{{ pin.title }}</span>
                <span class="pin-sub">{{ ShowSpace ? pin.spaceName : pin.subtitle }}</span>
              </span>
            </span>
            @if (CanUnpin) {
              <button type="button" class="unpin" [attr.aria-label]="'Unpin ' + pin.title" title="Unpin" (click)="UnpinRequested.emit(pin)"><i class="fa-solid fa-xmark"></i></button>
            }
          </div>
        }
      </div>
    } @else if (ShowEmpty) {
      <div class="empty">{{ EmptyMessage }}</div>
    }
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host { display: block; }
    .strip { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid var(--mj-border-default, #e5e7eb); border-radius: 10px; background: var(--mj-bg-surface-card, #fff); }
    .strip-title { font-size: 12px; font-weight: 700; color: var(--mj-text-muted, #6b7280); margin-right: 4px; }
    .pin { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; border: 1px solid var(--mj-border-default, #e5e7eb); background: var(--mj-bg-surface-sunken, #f9fafb); padding: 4px 6px 4px 10px; max-width: 320px; }
    .pin-main { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; min-width: 0; }
    .pin-text { display: flex; flex-direction: column; min-width: 0; }
    .pin-title { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--mj-text-primary, #111827); }
    .pin-sub { font-size: 11px; color: var(--mj-text-muted, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .unpin { border: 0; background: transparent; color: var(--mj-text-muted, #6b7280); cursor: pointer; padding: 2px 4px; border-radius: 999px; }
    .unpin:hover { color: var(--mj-status-error-text, #b91c1c); }
    .empty { font-size: 12px; color: var(--mj-text-muted, #6b7280); padding: 6px 0; }
  `],
})
export class CollabPinnedStripComponent {
  @Input() public Title = 'Pinned';
  @Input() public Pins: PinModel[] = [];
  /** On Home, each pin names its space instead of its subtitle. */
  @Input() public ShowSpace = false;
  @Input() public CanUnpin = true;
  @Input() public ShowEmpty = false;
  @Input() public EmptyMessage = 'Nothing pinned yet. Pin a note, a file or a report to keep it here.';
  @Output() public OpenRequested = new EventEmitter<PinModel>();
  @Output() public UnpinRequested = new EventEmitter<PinModel>();
}
