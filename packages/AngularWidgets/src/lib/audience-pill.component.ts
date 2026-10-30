import { Component, ElementRef, EventEmitter, HostListener, Inject, Input, Optional, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CollabAvatarComponent } from './avatar.component';
import { CollabAvatarStackComponent } from './avatar-stack.component';
import { COLLAB_TOKENS_CSS } from './tokens';
import { AvatarItem, SpaceMemberModel } from './types';

export interface AudiencePopoverPersonItem {
  id: string;
  name: string;
  initials: string;
  email: string;
  roleLabel: string;
  status: string;
  avatarUrl?: string;
  iconClass?: string;
  isOutside: boolean;
}

@Component({
  selector: 'mjc-audience-pill',
  standalone: true,
  imports: [CommonModule, CollabAvatarComponent, CollabAvatarStackComponent],
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
                  <i class="fa-solid fa-lock" aria-hidden="true"></i>
                  <span>Team ({{ teamDisplayList.length }})</span>
                </div>
                @for (person of teamDisplayList; track person.id) {
                  <button
                    type="button"
                    class="aud-person-row"
                    data-testid="audience-pill-person-row"
                    (click)="onPersonClicked(person, $event)">
                    <mjc-avatar
                      [PersonId]="person.id"
                      [Name]="person.name"
                      [Initials]="person.initials"
                      [AvatarUrl]="person.avatarUrl || ''"
                      [IconClass]="person.iconClass || ''"
                      [IsOutside]="false"
                      Size="sm">
                    </mjc-avatar>
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
                  <i class="fa-solid fa-eye" aria-hidden="true"></i>
                  <span>Outside participants ({{ outsideDisplayList.length }})</span>
                </div>
                @for (person of outsideDisplayList; track person.id) {
                  <button
                    type="button"
                    class="aud-person-row"
                    data-testid="audience-pill-person-row"
                    (click)="onPersonClicked(person, $event)">
                    <mjc-avatar
                      [PersonId]="person.id"
                      [Name]="person.name"
                      [Initials]="person.initials"
                      [AvatarUrl]="person.avatarUrl || ''"
                      [IconClass]="person.iconClass || ''"
                      [IsOutside]="true"
                      Size="sm">
                    </mjc-avatar>
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
              <span>Manage people &amp; access</span>
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
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      display: inline-flex;
      vertical-align: middle;
      color: var(--mj-text-primary);
      font-family: var(--mj-font-family);
      font-feature-settings: var(--mjc-font-feature-settings);
      line-height: var(--mjc-line-height);
    }
    .aud-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .aud {
      display: flex;
      align-items: center;
      gap: var(--mj-space-2-5);
      margin-right: var(--mj-space-1);
      padding: var(--mj-space-1) var(--mj-space-3) var(--mj-space-1) var(--mj-space-2);
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-full);
      background: var(--mj-bg-surface);
      height: 36px;
      box-sizing: border-box;
      user-select: none;
      cursor: pointer;
      font: inherit;
      text-align: left;
      transition: border-color var(--mj-transition-fast), background var(--mj-transition-fast), box-shadow var(--mj-transition-fast);
    }
    .aud:hover,
    .aud.is-open {
      border-color: var(--mj-brand-primary);
      background: color-mix(in srgb, var(--mj-brand-primary) 5%, var(--mj-bg-surface));
      box-shadow: var(--mj-shadow-sm);
    }
    .aud-div {
      width: 1px;
      height: 18px;
      background: var(--mj-border-default);
    }
    .aud-t {
      display: flex;
      flex-direction: column;
      line-height: var(--mj-leading-tight);
    }
    .aud-t b {
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-semibold);
      color: var(--mj-text-primary);
    }
    .aud-t span {
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
      white-space: nowrap;
    }
    .aud-caret {
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
      margin-left: var(--mj-space-0-5);
      transition: transform var(--mj-transition-fast), color var(--mj-transition-fast);
    }
    .aud:hover .aud-caret,
    .aud-caret.open {
      color: var(--mj-brand-primary);
    }
    .aud-caret.open {
      transform: rotate(180deg);
    }

    .aud-popover {
      position: absolute;
      top: calc(100% + var(--mj-space-2));
      right: var(--mj-space-1);
      z-index: var(--mj-z-popover);
      width: 330px;
      max-height: 420px;
      display: flex;
      flex-direction: column;
      background: var(--mj-bg-surface);
      border: 1px solid var(--mj-border-default);
      border-radius: var(--mj-radius-lg);
      box-shadow: var(--mj-shadow-lg);
      overflow: hidden;
    }

    .aud-pop-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mj-space-2);
      padding: var(--mj-space-3) var(--mj-space-3-5);
      border-bottom: 1px solid var(--mj-border-subtle);
      background: var(--mj-bg-surface-sunken);
    }
    .aud-pop-head-text {
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-0-5);
      min-width: 0;
    }
    .aud-pop-title {
      font-size: var(--mj-text-sm);
      font-weight: var(--mj-font-semibold);
      color: var(--mj-text-primary);
    }
    .aud-pop-sub {
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
    }
    .aud-pop-close {
      width: 24px;
      height: 24px;
      border-radius: var(--mj-radius-sm);
      border: none;
      background: transparent;
      color: var(--mj-text-muted);
      cursor: pointer;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .aud-pop-close:hover {
      background: var(--mj-bg-surface-hover);
      color: var(--mj-text-primary);
    }

    .aud-pop-body {
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-2);
      padding: var(--mj-space-2);
      overflow-y: auto;
      max-height: 290px;
    }

    .aud-pop-section {
      display: flex;
      flex-direction: column;
      gap: var(--mj-space-0-5);
    }

    .aud-pop-sec-head {
      display: flex;
      align-items: center;
      gap: var(--mj-space-1-5);
      padding: var(--mj-space-1) var(--mj-space-2);
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-semibold);
      color: var(--mj-text-muted);
    }
    .aud-pop-sec-head.outside {
      color: var(--mjc-shared);
    }

    .aud-person-row {
      display: flex;
      align-items: center;
      gap: var(--mj-space-2-5);
      width: 100%;
      padding: var(--mj-space-1-5) var(--mj-space-2);
      border-radius: var(--mj-radius-md);
      border: none;
      background: transparent;
      text-align: left;
      font: inherit;
      cursor: pointer;
      transition: background var(--mj-transition-fast);
    }
    .aud-person-row:hover {
      background: var(--mj-bg-surface-hover);
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
      gap: var(--mj-space-1-5);
      flex-wrap: wrap;
    }

    .aud-person-name {
      font-size: var(--mj-text-sm);
      font-weight: var(--mj-font-medium);
      color: var(--mj-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .aud-person-role {
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-medium);
      padding: var(--mj-space-0-5) var(--mj-space-1-5);
      border-radius: var(--mj-radius-full);
      background: var(--mj-bg-surface-sunken);
      color: var(--mj-text-secondary);
    }
    .aud-person-role.outside {
      background: var(--mjc-shared-bg);
      color: var(--mjc-shared);
    }

    .aud-person-invited {
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-medium);
      padding: var(--mj-space-0-5) var(--mj-space-1-5);
      border-radius: var(--mj-radius-full);
      background: color-mix(in srgb, var(--mj-brand-primary) 12%, transparent);
      color: var(--mj-brand-primary);
    }

    .aud-person-email {
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .aud-pop-empty {
      padding: var(--mj-space-4);
      text-align: center;
      font-size: var(--mj-text-xs);
      color: var(--mj-text-muted);
    }

    .aud-pop-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--mj-space-2);
      padding: var(--mj-space-2-5) var(--mj-space-3);
      border-top: 1px solid var(--mj-border-subtle);
      background: var(--mj-bg-surface-sunken);
    }

    .aud-manage-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--mj-space-1-5);
      padding: var(--mj-space-1-5) var(--mj-space-2-5);
      border-radius: var(--mj-radius-md);
      border: 1px solid var(--mj-border-default);
      background: var(--mj-bg-surface);
      color: var(--mj-text-primary);
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-semibold);
      cursor: pointer;
      flex: 1;
      justify-content: center;
      transition: border-color var(--mj-transition-fast), color var(--mj-transition-fast);
    }
    .aud-manage-btn:hover {
      border-color: var(--mj-brand-primary);
      color: var(--mj-brand-primary);
    }

    .aud-invite-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--mj-space-1);
      padding: var(--mj-space-1-5) var(--mj-space-3);
      border-radius: var(--mj-radius-md);
      border: 1px solid var(--mj-brand-primary);
      background: var(--mj-brand-primary);
      color: var(--mj-text-inverse);
      font-size: var(--mj-text-xs);
      font-weight: var(--mj-font-semibold);
      cursor: pointer;
      transition: background var(--mj-transition-fast);
    }
    .aud-invite-btn:hover {
      background: var(--mj-brand-primary-hover);
    }

    @media (prefers-reduced-motion: reduce) {
      .aud,
      .aud-caret,
      .aud-person-row,
      .aud-manage-btn,
      .aud-invite-btn {
        transition: none;
      }
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
        iconClass: m.iconClass,
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
      iconClass: a.iconClass,
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
        iconClass: m.iconClass,
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
      iconClass: a.iconClass,
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
