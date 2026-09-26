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
      color: var(--mj-brand-on-primary, #ffffff);
      background: var(--mjc-type-color, var(--mj-brand-primary, #0076b6));
      box-sizing: border-box;
    }
    .tile.sm { width: 18px; height: 18px; font-size: 9.5px; border-radius: 5px; }
    .tile.lg { width: 44px; height: 44px; font-size: 20px; border-radius: 12px; }
    .tile.xl { width: 52px; height: 52px; font-size: 22px; border-radius: 14px; }
    .tile.closed { --mjc-type-color: var(--mj-text-disabled, #94a3b8); }
  `]
})
export class CollabTypeTileComponent {
  @Input() IconClass = 'fa-solid fa-shapes';
  @Input() Color = '';
  @Input() Size: TileSize = 'md';
  @Input() IsClosed = false;

  // Compatibility aliases
  @Input() set iconClass(v: string) { this.IconClass = v; }
  get iconClass(): string { return this.IconClass; }

  @Input() set color(v: string) { this.Color = v; }
  get color(): string { return this.Color; }

  @Input() set size(v: TileSize) { this.Size = v; }
  get size(): TileSize { return this.Size; }

  @Input() set isClosed(v: boolean) { this.IsClosed = v; }
  get isClosed(): boolean { return this.IsClosed; }
}
