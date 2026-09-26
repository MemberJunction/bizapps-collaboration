import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpaceBand } from './types';

@Component({
  selector: 'mjc-band-chip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="chip {{ isShared ? 'shared' : 'team' }} {{ size === 'md' ? 'lg' : '' }}"
      role="status">
      @if (showIcon) {
        <i [class]="isShared ? 'fa-solid fa-eye' : 'fa-solid fa-lock'"></i>
      }
      {{ label || band }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
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
      border: 1px solid var(--mj-border-default, #e2e8f0);
      color: var(--mj-text-secondary, #475569);
      background: var(--mj-bg-surface, #ffffff);
      box-sizing: border-box;
      user-select: none;
    }
    .chip i { font-size: 10px; }
    .chip.shared {
      color: var(--mjc-shared, #0e7490);
      background: var(--mjc-shared-bg, #ecfeff);
      border-color: var(--mjc-shared-border, rgba(6, 182, 212, 0.35));
    }
    .chip.team {
      color: var(--mjc-team, #475569);
      background: var(--mjc-team-bg, rgba(100, 116, 139, 0.12));
      border-color: var(--mjc-team-border, #cbd5e1);
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
  @Input() band: SpaceBand = 'Shared';
  @Input() size: 'sm' | 'md' = 'sm';
  @Input() label = '';
  @Input() showIcon = true;

  get isShared(): boolean {
    return this.band === 'Shared';
  }
}
