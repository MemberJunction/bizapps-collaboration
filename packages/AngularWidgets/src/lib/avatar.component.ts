import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { avatarColorClass } from '@mj-biz-apps/collaboration-core';
import type { AvatarItem } from './types';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'mjc-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="av {{ computedColorClass }} {{ Size }} {{ isOutside ? 'ext' : '' }}"
      [attr.title]="name || null"
      [attr.aria-label]="name || initials">
      @if (avatarUrl) {
        <img [src]="avatarUrl" [alt]="name || initials" class="av-img" />
      } @else {
        {{ initials }}
      }
      @if (isOnline) {
        <span class="presence"></span>
      }
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
      font-feature-settings: var(--mjc-font-feature-settings, 'cv11', 'ss01');
      line-height: var(--mjc-line-height, 1.45);
    }
    .av {
      position: relative;
      display: inline-grid;
      place-items: center;
      flex: none;
      width: 28px;
      height: 28px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 650;
      color: var(--mj-brand-on-primary, #ffffff);
      letter-spacing: .01em;
      background: var(--mj-text-muted, #64748b);
      user-select: none;
      box-sizing: border-box;
    }
    .av.xs { width: 20px; height: 20px; font-size: 9px; }
    .av.sm { width: 24px; height: 24px; font-size: 10px; }
    .av.md { width: 32px; height: 32px; font-size: 12px; }
    .av.lg { width: 40px; height: 40px; font-size: 14px; }
    .av.xl { width: 56px; height: 56px; font-size: 19px; }

    /* Outside people carry a cyan ring everywhere */
    .av.ext {
      box-shadow: 0 0 0 2px var(--mj-bg-surface, #ffffff), 0 0 0 3.5px var(--mjc-shared-strong, #0891b2);
    }

    /* 10-color avatar categorical palette */
    .av.c1 { background: #6366f1; }
    .av.c2 { background: #0ea5e9; }
    .av.c3 { background: #f97316; }
    .av.c4 { background: #14b8a6; }
    .av.c5 { background: #e11d48; }
    .av.c6 { background: #8b5cf6; }
    .av.c7 { background: #64748b; }
    .av.c8 { background: #059669; }
    .av.c9 { background: #d97706; }
    .av.c10 { background: #0f766e; }

    .av-img {
      width: 100%;
      height: 100%;
      border-radius: 99px;
      object-fit: cover;
    }

    .presence {
      position: absolute;
      right: -1px;
      bottom: -1px;
      width: 9px;
      height: 9px;
      border-radius: 9px;
      background: var(--mj-status-success, #22c55e);
      box-shadow: 0 0 0 2px var(--mj-bg-surface, #ffffff);
    }
  `]
})
export class CollabAvatarComponent {
  @Input() public Avatar?: AvatarItem;
  @Input() public Initials = '';
  @Input() public Name = '';
  @Input() public AvatarUrl = '';
  @Input() public ColorClass = '';
  @Input() public PersonId = '';
  @Input() public Size: AvatarSize = 'md';
  @Input() public IsOutside = false;
  @Input() public IsOnline = false;

  public get initials(): string {
    return this.Avatar?.initials || this.Initials;
  }

  public get name(): string {
    return this.Avatar?.name || this.Name;
  }

  public get avatarUrl(): string {
    return this.Avatar?.avatarUrl || this.AvatarUrl;
  }

  public get isOutside(): boolean {
    return this.Avatar?.isOutside ?? this.IsOutside;
  }

  public get isOnline(): boolean {
    return this.Avatar?.isOnline ?? this.IsOnline;
  }

  public get computedColorClass(): string {
    const cc = this.Avatar?.colorClass || this.ColorClass;
    if (cc) {
      return cc;
    }
    const pid = this.Avatar?.id || this.PersonId;
    if (pid) {
      return avatarColorClass(pid);
    }
    const n = this.name;
    if (n) {
      return avatarColorClass(n);
    }
    return 'c1';
  }
}

