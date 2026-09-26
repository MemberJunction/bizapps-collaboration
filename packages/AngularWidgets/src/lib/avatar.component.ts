import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { avatarColorClass } from '@mj-biz-apps/collaboration-core';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'mjc-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="av {{ computedColorClass }} {{ size }} {{ isOutside ? 'ext' : '' }}"
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
  @Input() Initials = '';
  @Input() Name = '';
  @Input() AvatarUrl = '';
  @Input() ColorClass = '';
  @Input() PersonId = '';
  @Input() Size: AvatarSize = 'md';
  @Input() IsOutside = false;
  @Input() IsOnline = false;

  // Compatibility aliases
  @Input() set initials(v: string) { this.Initials = v; }
  get initials(): string { return this.Initials; }

  @Input() set name(v: string) { this.Name = v; }
  get name(): string { return this.Name; }

  @Input() set avatarUrl(v: string) { this.AvatarUrl = v; }
  get avatarUrl(): string { return this.AvatarUrl; }

  @Input() set colorClass(v: string) { this.ColorClass = v; }
  get colorClass(): string { return this.ColorClass; }

  @Input() set personId(v: string) { this.PersonId = v; }
  get personId(): string { return this.PersonId; }

  @Input() set size(v: AvatarSize) { this.Size = v; }
  get size(): AvatarSize { return this.Size; }

  @Input() set isOutside(v: boolean) { this.IsOutside = v; }
  get isOutside(): boolean { return this.IsOutside; }

  @Input() set isOnline(v: boolean) { this.IsOnline = v; }
  get isOnline(): boolean { return this.IsOnline; }

  get computedColorClass(): string {
    if (this.ColorClass) {
      return this.ColorClass;
    }
    if (this.PersonId) {
      return avatarColorClass(this.PersonId);
    }
    if (this.Name) {
      return avatarColorClass(this.Name);
    }
    return 'c1';
  }
}
