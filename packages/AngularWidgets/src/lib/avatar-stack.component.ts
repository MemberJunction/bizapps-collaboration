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
          [IsOnline]="!!av.isOnline"
          [Stacked]="true">
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
      font-family: var(--mj-font-family);
      font-feature-settings: var(--mjc-font-feature-settings);
      line-height: var(--mjc-line-height);
    }
    .stack {
      display: inline-flex;
      align-items: center;
      padding: 0 var(--mj-space-0-5);
    }
    /* The avatars' own elements are in this template, so they overlap from here; what each draws inside, its ring, is its own (Stacked) */
    .stack mjc-avatar {
      margin-left: -2px;
    }
    .stack mjc-avatar:first-child {
      margin-left: 0;
    }
    .stack mjc-avatar.ext + mjc-avatar.ext {
      margin-left: -2px;
    }
    .more {
      margin-left: var(--mj-space-1);
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
      font-weight: var(--mj-font-semibold);
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
