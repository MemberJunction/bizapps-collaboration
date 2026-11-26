import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TileSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'mjc-type-tile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="tile {{ Size }} {{ IsClosed ? 'closed' : '' }}"
      [class.has-image]="showImage"
      [style.--mjc-type-color]="Color || null"
      aria-hidden="true">
      @if (showImage) {
        <img class="tile-img" [src]="ImageUrl" alt="" (error)="onImageError()" />
      } @else {
        <i [class]="IconClass || 'fa-solid fa-shapes'"></i>
      }
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
      overflow: hidden;
    }
    .tile.has-image {
      background: var(--mj-bg-surface-sunken);
    }
    .tile-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: inherit;
      display: block;
    }
    .tile.sm { width: 18px; height: 18px; font-size: 9.5px; border-radius: 5px; }
    .tile.lg { width: 44px; height: 44px; font-size: 20px; border-radius: 12px; }
    .tile.xl { width: 52px; height: 52px; font-size: 22px; border-radius: 14px; }
    .tile.closed { --mjc-type-color: var(--mj-text-disabled); }
    .tile.closed .tile-img { filter: grayscale(1); opacity: 0.72; }
  `]
})
export class CollabTypeTileComponent implements OnChanges {
  @Input() IconClass = 'fa-solid fa-shapes';
  @Input() Color: string | undefined = '';
  @Input() ImageUrl: string | null | undefined = null;
  @Input() Size: TileSize = 'md';
  @Input() IsClosed = false;

  public imageFailed = false;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['ImageUrl']) {
      this.imageFailed = false;
    }
  }

  public get showImage(): boolean {
    return !!this.ImageUrl && this.ImageUrl.trim().length > 0 && !this.imageFailed;
  }

  public onImageError(): void {
    this.imageFailed = true;
  }
}
