import { Component, ElementRef, EventEmitter, HostListener, Inject, Input, Optional, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabAvatarStackComponent } from './avatar-stack.component';
import { AvatarItem, SpaceMemberModel } from './types';

export interface AudiencePopoverPersonItem {
  id: string;
  name: string;
  initials: string;
  email: string;
  roleLabel: string;
  status: string;
  avatarUrl?: string;
  isOutside: boolean;
}

@Component({
  selector: 'mjc-audience-pill',
  standalone: true,
  imports: [CommonModule, CollabAvatarStackComponent],
  template: `
    <div class="aud-wrap">
      <button
        type="button"
        class="aud"
        data-testid="audience-pill-trigger"
        [class.is-open]="isOpen"
        [attr.aria-expanded]="isOpen"
        aria-haspopup="dialog"
        title="View space people &amp; access"
        (click)="togglePopover($event)">
        @if (StaffAvatars && StaffAvatars.length > 0) {
          <mjc-avatar-stack [Avatars]="StaffAvatars" [Max]="MaxStaff" Size="sm"></mjc-avatar-stack>
        }
        @if (StaffAvatars && StaffAvatars.length > 0 && OutsideAvatars && OutsideAvatars.length > 0) {
          <span class="aud-div"></span>
        }
        @if (OutsideAvatars && OutsideAvatars.length > 0) {
          <mjc-avatar-stack [Avatars]="OutsideAvatars" [Max]="MaxOutside" Size="sm"></mjc-avatar-stack>
        }
        <div class="aud-t">
          <b>{{ TotalPeople }} {{ TotalPeople === 1 ? 'person' : 'people' }}</b>
          @if (Summary) {
            <span>{{ Summary }}</span>
          }
        </div>
        <i class="fa-solid fa-chevron-down aud-caret" [class.open]="isOpen" aria-hidden="true"></i>
      </button>

      @if (isOpen) {
        <div class="aud-popover" data-testid="audience-pill-popover" role="dialog" aria-label="People in this space">
          <div class="aud-pop-head">
            <div class="aud-pop-head-text">
              <span class="aud-pop-title">People in this space ({{ TotalPeople }})</span>
              @if (Summary) {
                <span class="aud-pop-sub">{{ Summary }}</span>
              }
            </div>
            <button
              type="button"
              class="aud-pop-close"
              (click)="closePopover($event)"
              title="Close"
              aria-label="Close people popover">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <div class="aud-pop-body">
            @if (teamDisplayList.length > 0) {
              <div class="aud-pop-section">
                <div class="aud-pop-sec-head">
                  <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
                  <span>Team ({{ teamDisplayList.length }})</span>
                </div>
                @for (person of teamDisplayList; track person.id) {
                  <button
                    type="button"
                    class="aud-person-row"
                    data-testid="audience-pill-person-row"
                    (click)="onPersonClicked(person, $event)">
                    <span class="aud-person-avatar">
                      @if (person.avatarUrl) {
                        <img [src]="person.avatarUrl" [alt]="person.name" />
                      } @else {
                        {{ person.initials }}
                      }
                    </span>
                    <span class="aud-person-info">
                      <span class="aud-person-name-row">
                        <span class="aud-person-name">{{ person.name }}</span>
                        @if (person.roleLabel) {
                          <span class="aud-person-role">{{ person.roleLabel }}</span>
                        }
                        @if (person.status === 'Invited') {
                          <span class="aud-person-invited">Invited</span>
                        }
                      </span>
                      @if (person.email) {
                        <span class="aud-person-email">{{ person.email }}</span>
                      }
                    </span>
                  </button>
                }
              </div>
            }

            @if (outsideDisplayList.length > 0) {
              <div class="aud-pop-section">
                <div class="aud-pop-sec-head outside">
                  <i class="fa-solid fa-user-group" aria-hidden="true"></i>
                  <span>Outside Participants ({{ outsideDisplayList.length }})</span>
                </div>
                @for (person of outsideDisplayList; track person.id) {
                  <button
                    type="button"
                    class="aud-person-row"
                    data-testid="audience-pill-person-row"
                    (click)="onPersonClicked(person, $event)">
                    <span class="aud-person-avatar outside">
                      @if (person.avatarUrl) {
                        <img [src]="person.avatarUrl" [alt]="person.name" />
                      } @else {
                        {{ person.initials }}
                      }
                    </span>
                    <span class="aud-person-info">
                      <span class="aud-person-name-row">
                        <span class="aud-person-name">{{ person.name }}</span>
                        <span class="aud-person-role outside">{{ person.roleLabel || 'Outside' }}</span>
                        @if (person.status === 'Invited') {
                          <span class="aud-person-invited">Invited</span>
                        }
                      </span>
                      @if (person.email) {
                        <span class="aud-person-email">{{ person.email }}</span>
                      }
                    </span>
                  </button>
                }
              </div>
            }

            @if (teamDisplayList.length === 0 && outsideDisplayList.length === 0) {
              <div class="aud-pop-empty">No people listed in this space yet.</div>
            }
          </div>

          <div class="aud-pop-foot">
            <button
              type="button"
              class="aud-manage-btn"
              data-testid="audience-pill-manage-btn"
              (click)="onManagePeople($event)">
              <i class="fa-solid fa-users-gear" aria-hidden="true"></i>
              <span>Manage People &amp; Access</span>
            </button>
            @if (CanInvite) {
              <button
                type="button"
                class="aud-invite-btn"
                data-testid="audience-pill-invite-btn"
                (click)="onInvite($event)">
                <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
                <span>Invite</span>
              </button>
            }
          </div>
        </div>
      }
    </div>
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
    .aud-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .aud {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-right: 4px;
      padding: 4px 12px 4px 6px;
      border: 1px solid var(--mj-border-default, #e2e8f0);
      border-radius: 99px;
      background: var(--mj-bg-surface, #ffffff);
      height: 38px;
      box-sizing: border-box;
      user-select: none;
      cursor: pointer;
      font: inherit;
      text-align: left;
      transition: border-color 0.14s ease, background 0.14s ease, box-shadow 0.14s ease;
    }
    .aud:hover,
    .aud.is-open {
      border-color: var(--mj-brand-primary, #0076b6);
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 5%, var(--mj-bg-surface, #ffffff));
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }
    .aud-div {
      width: 1px;
      height: 18px;
      background: var(--mj-border-default, #e2e8f0);
    }
    .aud-t {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }
    .aud-t b {
      font-size: 12.5px;
      font-weight: 650;
      color: var(--mj-text-primary, #0f172a);
    }
    .aud-t span {
      font-size: 11px;
      color: var(--mj-text-muted, #64748b);
      white-space: nowrap;
    }
    .aud-caret {
      font-size: 10px;
      color: var(--mj-text-muted, #64748b);
      margin-left: 2px;
      transition: transform 0.14s ease, color 0.14s ease;
    }
    .aud:hover .aud-caret,
    .aud-caret.open {
      color: var(--mj-brand-primary, #0076b6);
    }
    .aud-caret.open {
      transform: rotate(180deg);
    }

    .aud-popover {
      position: absolute;
      top: calc(100% + 8px);
      right: 4px;
      z-index: 60;
      width: 330px;
      max-height: 420px;
      display: flex;
      flex-direction: column;
      background: var(--mj-bg-surface, #ffffff);
      border: 1px solid var(--mj-border-default, #e2e8f0);
      border-radius: 14px;
      box-shadow: var(--mj-shadow-lg, 0 14px 32px -6px rgba(15, 23, 42, 0.18));
      overflow: hidden;
    }

    .aud-pop-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 11px 14px;
      border-bottom: 1px solid var(--mj-border-subtle, #f1f5f9);
      background: var(--mj-bg-surface-sunken, #f8fafc);
    }
    .aud-pop-head-text {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }
    .aud-pop-title {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--mj-text-primary, #0f172a);
    }
    .aud-pop-sub {
      font-size: 11px;
      color: var(--mj-text-muted, #64748b);
    }
    .aud-pop-close {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--mj-text-muted, #64748b);
      cursor: pointer;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .aud-pop-close:hover {
      background: var(--mj-bg-surface-hover, #e2e8f0);
      color: var(--mj-text-primary, #0f172a);
    }

    .aud-pop-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      overflow-y: auto;
      max-height: 290px;
    }

    .aud-pop-section {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .aud-pop-sec-head {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--mj-text-secondary, #475569);
    }
    .aud-pop-sec-head.outside {
      color: var(--mj-status-warning, #b45309);
    }

    .aud-person-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 6px 8px;
      border-radius: 8px;
      border: none;
      background: transparent;
      text-align: left;
      font: inherit;
      cursor: pointer;
      transition: background 0.12s ease;
    }
    .aud-person-row:hover {
      background: var(--mj-bg-surface-hover, #f1f5f9);
    }

    .aud-person-avatar {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-size: 11px;
      font-weight: 700;
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 14%, var(--mj-bg-surface, #ffffff));
      color: var(--mj-brand-primary, #0076b6);
      flex-shrink: 0;
      overflow: hidden;
    }
    .aud-person-avatar.outside {
      background: color-mix(in srgb, var(--mj-status-warning, #d97706) 15%, var(--mj-bg-surface, #ffffff));
      color: var(--mj-status-warning, #b45309);
    }
    .aud-person-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .aud-person-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .aud-person-name-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .aud-person-name {
      font-size: 12.5px;
      font-weight: 650;
      color: var(--mj-text-primary, #0f172a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .aud-person-role {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--mj-bg-surface-sunken, #f1f5f9);
      color: var(--mj-text-secondary, #475569);
    }
    .aud-person-role.outside {
      background: color-mix(in srgb, var(--mj-status-warning, #d97706) 12%, transparent);
      color: var(--mj-status-warning, #b45309);
    }

    .aud-person-invited {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 12%, transparent);
      color: var(--mj-brand-primary, #0076b6);
    }

    .aud-person-email {
      font-size: 11px;
      color: var(--mj-text-muted, #64748b);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .aud-pop-empty {
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: var(--mj-text-muted, #64748b);
    }

    .aud-pop-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 12px;
      border-top: 1px solid var(--mj-border-subtle, #f1f5f9);
      background: var(--mj-bg-surface-sunken, #f8fafc);
    }

    .aud-manage-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid var(--mj-border-default, #cbd5e1);
      background: var(--mj-bg-surface, #ffffff);
      color: var(--mj-text-primary, #0f172a);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      flex: 1;
      justify-content: center;
    }
    .aud-manage-btn:hover {
      border-color: var(--mj-brand-primary, #0076b6);
      color: var(--mj-brand-primary, #0076b6);
    }

    .aud-invite-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--mj-brand-primary, #0076b6);
      background: var(--mj-brand-primary, #0076b6);
      color: var(--mj-text-inverse, #ffffff);
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
    }
    .aud-invite-btn:hover {
      filter: brightness(0.95);
    }
  `]
})
export class CollabAudiencePillComponent {
  constructor(
    @Optional() @Inject(ElementRef) private readonly host?: ElementRef<HTMLElement>,
  ) {}

  @Input() StaffAvatars: AvatarItem[] = [];
  @Input() OutsideAvatars: AvatarItem[] = [];
  @Input() Members: readonly SpaceMemberModel[] = [];
  @Input() CanInvite = false;
  @Input() TotalPeople = 0;
  @Input() Summary = '';
  @Input() MaxStaff = 4;
  @Input() MaxOutside = 4;

  @Output() ManagePeopleRequested = new EventEmitter<void>();
  @Output() InviteRequested = new EventEmitter<void>();
  @Output() MemberSelectRequested = new EventEmitter<AudiencePopoverPersonItem>();

  public isOpen = false;

  public togglePopover(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  public closePopover(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isOpen = false;
  }

  public onManagePeople(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isOpen = false;
    this.ManagePeopleRequested.emit();
  }

  public onInvite(event?: MouseEvent): void {
    event?.stopPropagation();
    this.isOpen = false;
    this.InviteRequested.emit();
  }

  public onPersonClicked(person: AudiencePopoverPersonItem, event?: MouseEvent): void {
    event?.stopPropagation();
    this.isOpen = false;
    this.MemberSelectRequested.emit(person);
    this.ManagePeopleRequested.emit();
  }

  public get teamDisplayList(): AudiencePopoverPersonItem[] {
    const activeMembers = (this.Members ?? []).filter((m) => m.band === 'Team' && m.status !== 'Removed');
    if (activeMembers.length > 0) {
      return activeMembers.map((m) => ({
        id: m.id || m.userId || m.name,
        name: m.name,
        initials: m.initials || 'TM',
        email: m.email || '',
        roleLabel: m.roleName || '',
        status: m.status || 'Active',
        avatarUrl: m.avatarUrl,
        isOutside: false,
      }));
    }
    return (this.StaffAvatars ?? []).map((a, idx) => ({
      id: a.id || `staff-${idx}`,
      name: a.name || a.initials || 'Team Member',
      initials: a.initials || 'TM',
      email: '',
      roleLabel: 'Team',
      status: 'Active',
      avatarUrl: a.avatarUrl,
      isOutside: false,
    }));
  }

  public get outsideDisplayList(): AudiencePopoverPersonItem[] {
    const activeOutside = (this.Members ?? []).filter((m) => m.band === 'Shared' && m.status !== 'Removed');
    if (activeOutside.length > 0) {
      return activeOutside.map((m) => ({
        id: m.id || m.userId || m.name,
        name: m.name,
        initials: m.initials || 'OP',
        email: m.email || '',
        roleLabel: m.roleName || 'Outside',
        status: m.status || 'Active',
        avatarUrl: m.avatarUrl,
        isOutside: true,
      }));
    }
    return (this.OutsideAvatars ?? []).map((a, idx) => ({
      id: a.id || `outside-${idx}`,
      name: a.name || a.initials || 'Outside Participant',
      initials: a.initials || 'OP',
      email: '',
      roleLabel: 'Outside',
      status: 'Active',
      avatarUrl: a.avatarUrl,
      isOutside: true,
    }));
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: Pick<MouseEvent, 'target'>): void {
    if (!this.isOpen) return;
    const target = event.target;
    if (target instanceof Node && this.host?.nativeElement.contains(target)) {
      return;
    }
    this.isOpen = false;
  }

  @HostListener('document:keydown.escape')
  public onEscapeKey(): void {
    if (this.isOpen) {
      this.isOpen = false;
    }
  }
}
