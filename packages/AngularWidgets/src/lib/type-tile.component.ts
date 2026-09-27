import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TileSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'mjc-type-tile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="tile {{ Size }} {{ IsClosed ? 'closed' : '' }}"
      [style.--mjc-type-color]="Color || null"
      aria-hidden="true">
      <i [class]="IconClass || 'fa-solid fa-shapes'"></i>
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
      line-height: var(--mjc-line-height, 1.45);
    }
    .tile {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      font-size: 11px;
      color: var(--mj-brand-on-primary);
      background: var(--mjc-type-color, var(--mj-brand-primary));
      box-sizing: border-box;
    }
    .tile.sm { width: 18px; height: 18px; font-size: 9.5px; border-radius: 5px; }
    .tile.lg { width: 44px; height: 44px; font-size: 20px; border-radius: 12px; }
    .tile.xl { width: 52px; height: 52px; font-size: 22px; border-radius: 14px; }
    .tile.closed { --mjc-type-color: var(--mj-text-disabled); }
  `]
})
export class CollabTypeTileComponent {
  @Input() IconClass = 'fa-solid fa-shapes';
  @Input() Color: string | undefined = '';
  @Input() Size: TileSize = 'md';
  @Input() IsClosed = false;
}
