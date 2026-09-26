import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabAvatarComponent, AvatarSize } from './avatar.component';
import { AvatarItem } from './types';

@Component({
  selector: 'mjc-avatar-stack',
  standalone: true,
  imports: [CommonModule, CollabAvatarComponent],
  template: `
    <span class="stack">
      @for (av of visibleAvatars; track av.id || av.name || $index) {
        <mjc-avatar
          [initials]="av.initials"
          [name]="av.name || ''"
          [avatarUrl]="av.avatarUrl || ''"
          [colorClass]="av.colorClass || ''"
          [personId]="av.id || ''"
          [size]="size"
          [isOutside]="!!av.isOutside"
          [isOnline]="!!av.isOnline">
        </mjc-avatar>
      }
      @if (computedMoreCount > 0) {
        <span class="more">+{{ computedMoreCount }}</span>
      }
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
    }
    .stack {
      display: inline-flex;
      align-items: center;
    }
    .stack ::ng-deep mjc-avatar {
      margin-left: -6px;
    }
    .stack ::ng-deep mjc-avatar:first-child {
      margin-left: 0;
    }
    .stack ::ng-deep .av {
      box-shadow: 0 0 0 2px var(--mj-bg-surface, #ffffff);
    }
    .stack ::ng-deep .av.ext {
      box-shadow: 0 0 0 1.5px var(--mj-bg-surface, #ffffff), 0 0 0 3px var(--mjc-shared-strong, #0891b2);
    }
    .more {
      margin-left: 4px;
      font-size: 12px;
      color: var(--mj-text-muted, #64748b);
      font-weight: 600;
      user-select: none;
    }
  `]
})
export class CollabAvatarStackComponent {
  @Input() avatars: AvatarItem[] = [];
  @Input() max = 5;
  @Input() size: AvatarSize = 'sm';
  @Input() moreCount: number | null = null;

  get visibleAvatars(): AvatarItem[] {
    if (!this.avatars) return [];
    if (this.avatars.length <= this.max) return this.avatars;
    return this.avatars.slice(0, this.max);
  }

  get computedMoreCount(): number {
    if (this.moreCount !== null && this.moreCount !== undefined) {
      return this.moreCount;
    }
    if (!this.avatars) return 0;
    return Math.max(0, this.avatars.length - this.max);
  }
}
