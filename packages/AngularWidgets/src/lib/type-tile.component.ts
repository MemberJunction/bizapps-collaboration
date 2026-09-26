import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TileSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'mjc-type-tile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="tile {{ size }} {{ typeCode }} {{ isClosed ? 'closed' : '' }}"
      [style.--mjc-type-color]="color || null"
      aria-hidden="true">
      <i [class]="iconClass || 'fa-solid fa-shapes'"></i>
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
    .tile {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      font-size: 11px;
      color: var(--mj-brand-on-primary, #ffffff);
      background: var(--mjc-type-color, var(--mj-brand-primary, #0076b6));
      box-sizing: border-box;
    }
    .tile.rel { --mjc-type-color: #092340; }
    .tile.eng { --mjc-type-color: #0076b6; }
    .tile.com { --mjc-type-color: #d97706; }
    .tile.coh { --mjc-type-color: #16a34a; }
    .tile.wks { --mjc-type-color: #7c3aed; }
    .tile.sm { width: 18px; height: 18px; font-size: 9.5px; border-radius: 5px; }
    .tile.lg { width: 44px; height: 44px; font-size: 20px; border-radius: 12px; }
    .tile.xl { width: 52px; height: 52px; font-size: 22px; border-radius: 14px; }
    .tile.closed { --mjc-type-color: var(--mj-text-disabled, #94a3b8); }
  `]
})
export class CollabTypeTileComponent {
  @Input() iconClass = 'fa-solid fa-shapes';
  @Input() color = '';
  @Input() typeCode = '';
  @Input() size: TileSize = 'md';
  @Input() isClosed = false;
}
