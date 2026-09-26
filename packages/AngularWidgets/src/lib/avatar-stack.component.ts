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
          [class.ext]="!!av.isOutside"
          [Initials]="av.initials"
          [Name]="av.name || ''"
          [AvatarUrl]="av.avatarUrl || ''"
          [ColorClass]="av.colorClass || ''"
          [PersonId]="av.id || ''"
          [Size]="Size"
          [IsOutside]="!!av.isOutside"
          [IsOnline]="!!av.isOnline">
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
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family, Inter, sans-serif);
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
      line-height: var(--mjc-line-height, 1.45);
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
    .stack ::ng-deep mjc-avatar.ext + mjc-avatar.ext {
      margin-left: -2px;
    }
    .stack ::ng-deep .av {
      box-shadow: 0 0 0 2px var(--mj-bg-surface);
    }
    .stack ::ng-deep .av.ext {
      box-shadow: 0 0 0 1.5px var(--mj-bg-surface), 0 0 0 3px var(--mjc-shared-strong);
    }
    .more {
      margin-left: 4px;
      font-size: 12px;
      color: var(--mj-text-muted);
      font-weight: 600;
      user-select: none;
    }
  `]
})
export class CollabAvatarStackComponent {
  @Input() Avatars: AvatarItem[] = [];
  @Input() Max = 5;
  @Input() Size: AvatarSize = 'sm';
  @Input() MoreCount: number | null = null;

  get visibleAvatars(): AvatarItem[] {
    if (!this.Avatars) return [];
    if (this.Avatars.length <= this.Max) return this.Avatars;
    return this.Avatars.slice(0, this.Max);
  }

  get computedMoreCount(): number {
    if (this.MoreCount !== null && this.MoreCount !== undefined) {
      return this.MoreCount;
    }
    if (!this.Avatars) return 0;
    return Math.max(0, this.Avatars.length - this.Max);
  }
}
