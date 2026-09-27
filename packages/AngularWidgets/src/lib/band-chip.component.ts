import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpaceBand } from './types';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-band-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="chip {{ isShared ? 'shared' : 'team' }} {{ Size === 'md' ? 'lg' : '' }}"
      role="status">
      @if (ShowIcon) {
        <i [class]="isShared ? 'fa-solid fa-eye' : 'fa-solid fa-lock'"></i>
      }
      {{ Label || Band }}
    </span>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: inline-flex;
      vertical-align: middle;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
      line-height: var(--mjc-line-height, 1.45);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 22px;
      padding: 0 8px;
      border-radius: 99px;
      font-size: 11.5px;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid var(--mj-border-default);
      color: var(--mj-text-secondary);
      background: var(--mj-bg-surface);
      box-sizing: border-box;
      user-select: none;
    }
    .chip i { font-size: 10px; }
    .chip.shared {
      color: var(--mjc-shared);
      background: var(--mjc-shared-bg);
      border-color: var(--mjc-shared-border);
    }
    .chip.team {
      color: var(--mjc-team);
      background: var(--mjc-team-bg);
      border-color: var(--mjc-team-border);
    }
    .chip.lg {
      height: 26px;
      padding: 0 10px;
      font-size: 12.5px;
      gap: 6px;
    }
  `]
})
export class CollabBandChipComponent {
  @Input() Band: SpaceBand = 'Shared';
  @Input() Size: 'sm' | 'md' = 'sm';
  @Input() Label = '';
  @Input() ShowIcon = true;

  get isShared(): boolean {
    return this.Band === 'Shared';
  }
}
