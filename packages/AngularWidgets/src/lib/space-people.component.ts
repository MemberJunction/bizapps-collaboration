import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SpaceMemberModel } from './types';
import { CollabAvatarComponent } from './avatar.component';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-space-people',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CollabAvatarComponent, CollabBandChipComponent],
  template: `
    <div class="people-container">
      <!-- Summary metrics header -->
      <div class="metrics-row">
        <div class="metric-card">
          <span class="metric-num">{{ TotalMembers }}</span>
          <span class="metric-lbl">Total People</span>
        </div>
        <div class="metric-card">
          <span class="metric-num team">{{ TeamCount }}</span>
          <span class="metric-lbl">Team Staff</span>
        </div>
        <div class="metric-card">
          <span class="metric-num outside">{{ OutsideCount }}</span>
          <span class="metric-lbl">Outside Participants</span>
        </div>
        <div class="metric-card">
          <span class="metric-num active">{{ ActiveCount }}</span>
          <span class="metric-lbl">Active Seats</span>
        </div>
      </div>

      <!-- Action & Filter Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass search-ic"></i>
          <input
            type="text"
            placeholder="Search people by name or email..."
            [(ngModel)]="searchQuery"
            class="search-input"
          />
        </div>

        <div class="filter-group">
          <button
            class="pill-btn"
            [class.active]="audienceFilter === 'all'"
            (click)="audienceFilter = 'all'"
          >All</button>
          <button
            class="pill-btn"
            [class.active]="audienceFilter === 'Team'"
            (click)="audienceFilter = 'Team'"
          >Team</button>
          <button
            class="pill-btn"
            [class.active]="audienceFilter === 'Shared'"
            (click)="audienceFilter = 'Shared'"
          >Outside / Shared</button>
        </div>

        <div class="spacer"></div>

        <button class="invite-btn" (click)="ToggleInviteForm()">
          <i class="fa-solid fa-user-plus"></i>
          <span>Invite person</span>
        </button>
      </div>

      @if (InviteOutcome?.ok && !isInviting) {
        <div class="invite-outcome invite-outcome-ok" role="status">
          <span>{{ InviteOutcome!.message }}</span>
          <button type="button" class="cancel-invite-btn" (click)="DismissInviteOutcome()">Dismiss</button>
        </div>
      }

      <!-- Inline Invite Form -->
      @if (isInviting) {
        <div class="invite-form-card">
          <div class="invite-form-title">Invite new person to {{ SpaceName }}</div>
          <div class="invite-form-row">
            <input
              type="email"
              placeholder="Email address..."
              [(ngModel)]="inviteEmail"
              class="invite-input"
            />
            <select [(ngModel)]="inviteRole" class="invite-select">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="client-member">Outside Member</option>
              <option value="client-admin">Outside Admin</option>
              <option value="guest">Guest</option>
            </select>
            <button
              class="send-invite-btn"
              [disabled]="!inviteEmail.trim() || IsSendingInvite"
              [attr.aria-busy]="IsSendingInvite"
              (click)="submitInvite()"
            >
              {{ IsSendingInvite ? 'Sending…' : 'Send Invite' }}
            </button>
            <button class="cancel-invite-btn" [disabled]="IsSendingInvite" (click)="CancelInvite()">
              Cancel
            </button>
          </div>
          @if (InviteOutcome && !InviteOutcome.ok) {
            <div class="invite-outcome invite-outcome-error" role="alert">{{ InviteOutcome.message }}</div>
          }
        </div>
      }

      <!-- Members Table -->
      <div class="members-card">
        <div class="table-head">
          <div class="th-person">Member</div>
          <div class="th-role">Role</div>
          <div class="th-band">Audience</div>
          <div class="th-status">Status</div>
          <div class="th-date">Joined</div>
        </div>

        <div class="table-body">
          @if (filteredMembers.length === 0) {
            <div class="empty-state">
              <i class="fa-solid fa-user-group empty-ic"></i>
              <div class="empty-title">No members match your filter</div>
              <div class="empty-sub">Try changing your search term or audience filter.</div>
            </div>
          } @else {
            @for (m of filteredMembers; track m.id) {
              <div class="member-row">
                <div class="td-person">
                  <mjc-avatar
                    [Initials]="m.initials"
                    [ColorClass]="m.colorClass || 'c1'"
                    Size="md"
                  />
                  <div class="person-details">
                    <span class="person-name">{{ m.name }}</span>
                    <span class="person-email">{{ m.email }}</span>
                  </div>
                </div>

                <div class="td-role">
                  <span class="role-chip" [class]="'role-chip ' + formatRoleClass(m.roleCode)">
                    {{ m.roleName }}
                  </span>
                </div>

                <div class="td-band">
                  <mjc-band-chip [Band]="m.band" />
                </div>

                <div class="td-status">
                  <span class="status-pill" [class]="m.status.toLowerCase()">
                    <span class="dot"></span>
                    {{ m.status }}
                  </span>
                </div>

                <div class="td-date">
                  <span class="date-text">{{ m.joinedDate || 'Recently' }}</span>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      .people-container {
        padding: 24px 32px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 1200px;
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;
      }

      .metrics-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
      .metric-card {
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 8px;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .metric-num {
        font-size: 24px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
      }
      .metric-num.team { color: #475569; }
      .metric-num.outside { color: var(--mjc-shared, #0076b6); }
      .metric-num.active { color: #10b981; }
      .metric-lbl {
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
      }

      .filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .search-box {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-ic {
        position: absolute;
        left: 10px;
        color: var(--mj-text-muted, #94a3b8);
        font-size: 13px;
      }
      .search-input {
        padding: 7px 12px 7px 32px;
        font-size: 13px;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 6px;
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-primary, #0f172a);
        outline: none;
        width: 240px;
      }
      .filter-group {
        display: flex;
        background: var(--mj-bg-surface-sunken, #f1f5f9);
        padding: 3px;
        border-radius: 6px;
        gap: 2px;
      }
      .pill-btn {
        border: none;
        background: transparent;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 4px;
        color: var(--mj-text-secondary, #64748b);
        cursor: pointer;
      }
      .pill-btn.active {
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-primary, #0f172a);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }
      .spacer { flex: 1 1 auto; }
      .invite-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--mj-brand-primary, #0076b6);
        color: #ffffff;
        border: none;
        padding: 7px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .invite-btn:hover {
        background: var(--mj-brand-primary-hover, #005a8c);
      }

      .invite-form-card {
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-strong, #cbd5e1);
        border-radius: 8px;
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }
      .invite-form-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }
      .invite-form-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .invite-input {
        flex: 1 1 200px;
        padding: 6px 10px;
        font-size: 13px;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 4px;
        outline: none;
      }
      .invite-select {
        padding: 6px 10px;
        font-size: 13px;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 4px;
        background: var(--mj-bg-surface, #ffffff);
      }
      .send-invite-btn {
        background: var(--mj-brand-primary, #0076b6);
        color: #ffffff;
        border: none;
        padding: 6px 16px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .send-invite-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .invite-outcome {
        margin-top: 8px;
        font-size: var(--mj-text-sm, 13px);
        color: var(--mj-text-secondary);
      }
      .invite-outcome-error {
        color: var(--mj-status-error);
      }
      .invite-outcome-ok {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        margin-bottom: 12px;
        border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-md);
        background: var(--mj-bg-surface);
      }
      .cancel-invite-btn {
        background: transparent;
        border: none;
        color: var(--mj-text-secondary, #64748b);
        padding: 6px 10px;
        font-size: 13px;
        cursor: pointer;
      }

      .members-card {
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 8px;
        overflow: hidden;
      }
      .table-head {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        background: var(--mj-bg-surface-card, #f8fafc);
        border-bottom: 1px solid var(--mj-border-subtle, #e2e8f0);
        font-size: 12px;
        font-weight: 600;
        color: var(--mj-text-muted, #94a3b8);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .th-person, .td-person { flex: 1 1 300px; display: flex; align-items: center; gap: 12px; min-width: 0; }
      .th-role, .td-role { width: 140px; }
      .th-band, .td-band { width: 150px; }
      .th-status, .td-status { width: 120px; }
      .th-date, .td-date { width: 120px; text-align: right; }

      .table-body {
        display: flex;
        flex-direction: column;
      }
      .member-row {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--mj-border-subtle, #f1f5f9);
        transition: background 0.15s ease;
      }
      .member-row:last-child { border-bottom: none; }
      .member-row:hover {
        background: var(--mj-bg-surface-hover, #f8fafc);
      }
      .person-details {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .person-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }
      .person-email {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }
      .role-chip {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .role-chip.owner { background: #ede9fe; color: #6d28d9; }
      .role-chip.admin { background: #e0f2fe; color: #0284c7; }
      .role-chip.member { background: #f1f5f9; color: #475569; }
      .role-chip.client-member, .role-chip.client-admin { background: #fef3c7; color: #b45309; }
      .role-chip.guest { background: #f3f4f6; color: #6b7280; }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 500;
      }
      .status-pill .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .status-pill.active { color: #16a34a; }
      .status-pill.active .dot { background: #16a34a; }
      .status-pill.invited { color: #d97706; }
      .status-pill.invited .dot { background: #d97706; }
      .status-pill.removed { color: #94a3b8; }
      .status-pill.removed .dot { background: #94a3b8; }

      .date-text {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

      .empty-state {
        padding: 48px 24px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .empty-ic {
        font-size: 32px;
        color: var(--mj-text-muted, #cbd5e1);
        margin-bottom: 4px;
      }
      .empty-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }
      .empty-sub {
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
      }
    `,
  ],
})
export class CollabSpacePeopleComponent {
  @Input() Members: SpaceMemberModel[] = [];
  @Input() SpaceName = '';

  /** The person's email and the role they are invited to. Which band the seat lands in follows from the role, on the server. */
  @Output() InviteMemberRequested = new EventEmitter<{ email: string; role: string }>();

  /** True while the invite is with the server: the form stays as it is. */
  @Input() IsSendingInvite = false;

  /** What the server said. The form clears and closes only when it succeeded; a refusal leaves the form open with the message. */
  @Input() set InviteOutcome(outcome: { ok: boolean; message: string } | null) {
    this.outcome = outcome;
    if (outcome?.ok) {
      this.inviteEmail = '';
      this.isInviting = false;
    }
  }
  get InviteOutcome(): { ok: boolean; message: string } | null {
    return this.outcome;
  }
  private outcome: { ok: boolean; message: string } | null = null;

  public searchQuery = '';
  public audienceFilter: 'all' | 'Team' | 'Shared' = 'all';

  public isInviting = false;
  public inviteEmail = '';
  public inviteRole = 'member';

  // The list shows every seat, invited and removed ones too; these counts, like the header's, count only Active ones.
  public get TotalMembers(): number {
    return this.Members.filter((m) => m.status === 'Active').length;
  }

  public get TeamCount(): number {
    return this.Members.filter((m) => m.status === 'Active' && m.band === 'Team').length;
  }

  public get OutsideCount(): number {
    return this.Members.filter((m) => m.status === 'Active' && m.band === 'Shared').length;
  }

  public get ActiveCount(): number {
    return this.Members.filter((m) => m.status === 'Active').length;
  }

  public get filteredMembers(): SpaceMemberModel[] {
    return this.Members.filter((m) => {
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesEmail = m.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) return false;
      }

      if (this.audienceFilter !== 'all' && m.band !== this.audienceFilter) {
        return false;
      }

      return true;
    });
  }

  /** Opens or closes the form; opening it starts clean, so a refusal from an earlier invite doesn't show. */
  public ToggleInviteForm(): void {
    this.isInviting = !this.isInviting;
    if (this.isInviting) this.outcome = null;
  }

  /** Closes the form and forgets what the last invite said, so a refusal doesn't greet the next one. */
  public CancelInvite(): void {
    this.isInviting = false;
    this.outcome = null;
  }

  public DismissInviteOutcome(): void {
    this.outcome = null;
  }

  public submitInvite(): void {
    if (!this.inviteEmail.trim()) return;
    this.InviteMemberRequested.emit({
      email: this.inviteEmail.trim(),
      role: this.inviteRole,
    });
  }

  public formatRoleClass(roleCode: string): string {
    return (roleCode || 'member').toLowerCase().replace(/\s+/g, '-');
  }
}
