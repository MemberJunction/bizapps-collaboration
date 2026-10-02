import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { LogError } from '@memberjunction/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SpaceMemberModel } from './types';
import { MJButtonDirective, MJDropdownComponent, MJEmptyStateComponent, MJFilterChipComponent } from '@memberjunction/ng-ui-components';
import { CollabAvatarComponent } from './avatar.component';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-space-people',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MJButtonDirective, MJDropdownComponent, MJEmptyStateComponent, MJFilterChipComponent, CollabAvatarComponent, CollabBandChipComponent],
  template: `
    <div class="people-container">
      <!-- Summary metrics header -->
      <div class="metrics-row">
        <div class="metric-card">
          <span class="metric-num">{{ TotalMembers }}</span>
          <span class="metric-lbl">Total People</span>
        </div>
        @if (CanSeeTeamSide) {
          <div class="metric-card">
            <span class="metric-num team">{{ TeamCount }}</span>
            <span class="metric-lbl">Team</span>
          </div>
        }
        <div class="metric-card">
          <span class="metric-num outside">{{ OutsideCount }}</span>
          <span class="metric-lbl">Outside Participants</span>
        </div>
        <div class="metric-card">
          <span class="metric-num active">{{ InvitedCount }}</span>
          <span class="metric-lbl">Awaiting Approval</span>
        </div>
      </div>

      <!-- Action & Filter Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass search-ic"></i>
          <input
            type="text"
            placeholder="Search people by name or email..."
            aria-label="Search people by name or email"
            [(ngModel)]="SearchQuery"
            class="mj-input search-input"
          />
        </div>

        <div class="filter-group" role="group" aria-label="Audience">
          <mj-filter-chip Label="All" [Active]="audienceFilter === 'all'" (Clicked)="audienceFilter = 'all'" />
          @if (CanSeeTeamSide) {
            <mj-filter-chip Label="Team" [Active]="audienceFilter === 'Team'" (Clicked)="audienceFilter = 'Team'" />
          }
          <mj-filter-chip Label="Outside / Shared" [Active]="audienceFilter === 'Shared'" (Clicked)="audienceFilter = 'Shared'" />
        </div>

        <div class="spacer"></div>

        @if (CanInvite) {
          <button type="button" mjButton Variant="primary" Size="sm" (click)="ToggleInviteForm()">
            <i class="fa-solid fa-user-plus" aria-hidden="true"></i>
            <span>Invite person</span>
          </button>
        }
      </div>

      @if (InviteOutcome?.ok && !isInviting) {
        <div class="invite-outcome invite-outcome-ok" role="status">
          <span>{{ InviteOutcome!.message }}</span>
          @if (RedemptionUrl) {
            <input type="text" class="invite-link" readonly [value]="RedemptionUrl" aria-label="Sign-in link" />
            <button type="button" mjButton Variant="flat" Size="sm" class="copy-link-btn" (click)="CopyLink()">{{ LinkStatus() === 'copied' ? 'Copied' : 'Copy link' }}</button>
            @if (LinkStatus() === 'failed') {
              <span class="invite-outcome-error" role="alert">Couldn't copy the link. Select it and copy it.</span>
            }
          }
          <button type="button" mjButton Variant="flat" Size="sm" (click)="DismissInviteOutcome()">Dismiss</button>
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
              aria-label="Email address"
              [(ngModel)]="inviteEmail"
              class="mj-input invite-input"
            />
            <mj-dropdown
              class="invite-role"
              AriaLabel="Role"
              [Data]="RoleOptions"
              TextField="label"
              ValueField="code"
              [ValuePrimitive]="true"
              [(ngModel)]="inviteRole" />
            <button
              type="button"
              mjButton
              Variant="primary"
              Size="sm"
              [disabled]="!inviteEmail.trim() || IsSendingInvite"
              [attr.aria-busy]="IsSendingInvite"
              (click)="submitInvite()"
            >
              {{ IsSendingInvite ? 'Sending…' : 'Send Invite' }}
            </button>
            <button type="button" mjButton Variant="flat" Size="sm" [disabled]="IsSendingInvite" (click)="CancelInvite()">
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
          @if (CanManageSeats) {
            <div class="th-actions"></div>
          }
        </div>

        <div class="table-body">
          @if (FilteredMembers.length === 0) {
            <mj-empty-state Icon="fa-solid fa-user-group" Title="No members match your filter" Message="Try changing your search term or audience filter." Size="compact" />
          } @else {
            @for (m of FilteredMembers; track m.id) {
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
                    @if (m.inherited && m.source) {
                      <span class="person-source">from {{ m.source }}</span>
                    }
                    @if (m.ownSeat) {
                      <span class="person-source">
                        Their own seat here is {{ m.ownSeat.status }}
                        @if (m.ownSeat.canApprove && Pending?.id !== m.ownSeat.id) {
                          <button type="button" mjButton Variant="flat" Size="sm" [attr.aria-label]="'Approve the seat of ' + m.name" (click)="Ask(OwnSeatOf(m), 'approve')">Approve</button>
                        }
                        @if (m.ownSeat.canRemove && m.ownSeat.status !== 'Removed' && Pending?.id !== m.ownSeat.id) {
                          <button type="button" mjButton Variant="flat" Size="sm" [attr.aria-label]="'Withdraw the seat of ' + m.name" (click)="Ask(OwnSeatOf(m), 'remove')">Withdraw</button>
                        }
                        @if (Pending?.id === m.ownSeat.id) {
                          {{ PendingQuestion(OwnSeatOf(m)) }}
                          <button type="button" mjButton Variant="primary" Size="sm" [disabled]="IsBusy" (click)="ConfirmPending()">Confirm</button>
                          <button type="button" mjButton Variant="flat" Size="sm" (click)="Pending = null">Cancel</button>
                        }
                      </span>
                    }
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

                @if (CanManageSeats) {
                  <div class="td-actions">
                    @if (!m.inherited && (m.canApprove || m.canRemove || m.canChangeRole)) {
                      @if (Pending?.id === m.id) {
                        <span class="fs12">{{ PendingQuestion(m) }}</span>
                        <button type="button" mjButton Variant="primary" Size="sm" [disabled]="IsBusy" (click)="ConfirmPending()">Confirm</button>
                        <button type="button" mjButton Variant="flat" Size="sm" (click)="Pending = null">Cancel</button>
                      } @else {
                        @if (m.canApprove) {
                          <button type="button" mjButton Variant="flat" Size="sm" [attr.aria-label]="'Approve ' + m.name" (click)="Ask(m, 'approve')">Approve</button>
                        }
                        @if (m.canChangeRole && RoleOptions.length > 0) {
                          <mj-dropdown
                            class="role-select"
                            [AriaLabel]="'Change role for ' + m.name"
                            [Data]="RoleChoicesFor(m)"
                            TextField="label"
                            ValueField="code"
                            [ValuePrimitive]="true"
                            [ngModel]="m.roleCode"
                            (ngModelChange)="AskRole(m, $event)" />
                        }
                        @if (m.canRemove) {
                          <button type="button" mjButton Variant="flat" Size="sm" [attr.aria-label]="(m.status === 'Invited' ? 'Withdraw the seat of ' : 'Remove ') + m.name" (click)="Ask(m, 'remove')">{{ m.status === 'Invited' ? 'Withdraw' : 'Remove' }}</button>
                        }
                      }
                    }
                  </div>
                }
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
      .metric-num.team { color: var(--mjc-team); }
      .metric-num.outside { color: var(--mjc-shared, #0076b6); }
      .metric-num.active { color: var(--mj-status-success); }
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
      /* MJ's .mj-input draws the field; this keeps room for the search icon and a width */
      .search-input {
        padding-left: 32px;
        width: 240px;
      }
      .filter-group {
        display: flex;
        gap: 6px;
      }
      .spacer { flex: 1 1 auto; }

      .invite-form-card {
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-strong, #cbd5e1);
        border-radius: 8px;
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: var(--mj-shadow-md);
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
      }
      .invite-role {
        min-width: 160px;
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
      .th-actions, .td-actions { width: 280px; display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
      .person-source { font-size: 11px; color: var(--mj-text-muted); }
      .invite-link { flex: 1; min-width: 200px; }

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
      .role-chip.owner { background: color-mix(in srgb, var(--mj-brand-accent) 15%, var(--mj-bg-surface)); color: var(--mj-brand-accent); }
      .role-chip.admin { background: color-mix(in srgb, var(--mj-brand-primary) 15%, var(--mj-bg-surface)); color: var(--mj-brand-primary); }
      .role-chip.member { background: var(--mj-bg-surface-sunken); color: var(--mj-text-secondary); }
      .role-chip.client-member, .role-chip.client-admin { background: var(--mjc-shared-bg); color: var(--mjc-shared); }
      .role-chip.guest { background: var(--mj-bg-surface-sunken); color: var(--mj-text-muted); }

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
      .status-pill.active { color: var(--mj-status-success); }
      .status-pill.active .dot { background: var(--mj-status-success); }
      .status-pill.invited { color: var(--mj-status-warning); }
      .status-pill.invited .dot { background: var(--mj-status-warning); }
      .status-pill.removed { color: var(--mj-text-disabled); }
      .status-pill.removed .dot { background: var(--mj-text-disabled); }

      .date-text {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

    `,
  ],
})
export class CollabSpacePeopleComponent {
  @Input() Members: SpaceMemberModel[] = [];
  @Input() SpaceName = '';
  /** Whether the seat may invite. Without it the button isn't offered. */
  @Input() CanInvite = true;
  /** False for a seat that can't see the Team band: no Team card or filter. */
  @Input() CanSeeTeamSide = true;
  /** The roles the seat may hand out, highest first: what the invite form offers and what a role change picks from. */
  @Input() set RoleOptions(options: ReadonlyArray<{ code: string; label: string }>) {
    this._roleOptions = options;
    if (!options.some((o) => o.code === this.inviteRole)) this.inviteRole = options[0]?.code ?? '';
  }
  get RoleOptions(): ReadonlyArray<{ code: string; label: string }> {
    return this._roleOptions;
  }
  private _roleOptions: ReadonlyArray<{ code: string; label: string }> = [
    { code: 'member', label: 'Member' },
    { code: 'admin', label: 'Admin' },
    { code: 'client-member', label: 'Outside member' },
    { code: 'client-admin', label: 'Outside admin' },
    { code: 'guest', label: 'Guest' },
  ];
  /** Shows the Approve / Remove / Change role column. Each row still shows its buttons only when the seat may change it. */
  @Input() CanManageSeats = false;
  /** The sign-in link the server returned when the host has no email channel: shown with a Copy button. */
  @Input() set RedemptionUrl(url: string | null) {
    this._redemptionUrl = url;
    this.LinkStatus.set('idle');
  }
  get RedemptionUrl(): string | null {
    return this._redemptionUrl;
  }
  private _redemptionUrl: string | null = null;

  /** The person's email and the role they are invited to. Which band the seat lands in follows from the role, on the server. */
  @Output() InviteMemberRequested = new EventEmitter<{ email: string; role: string }>();
  /** The person dismissed (or cancelled away) the last invite's message. */
  @Output() InviteOutcomeDismissed = new EventEmitter<void>();
  @Output() ApproveMemberRequested = new EventEmitter<SpaceMemberModel>();
  @Output() RemoveMemberRequested = new EventEmitter<SpaceMemberModel>();
  @Output() ChangeRoleRequested = new EventEmitter<{ member: SpaceMemberModel; roleCode: string }>();

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

  public SearchQuery = '';
  public audienceFilter: 'all' | 'Team' | 'Shared' = 'all';

  public isInviting = false;
  public inviteEmail = '';
  public inviteRole = 'member';

  /** The action waiting for its confirmation. */
  public Pending: { id: string; kind: 'approve' | 'remove' | 'role'; roleCode?: string } | null = null;
  /** True while a confirmed change is with the server: Confirm can't be pressed twice. */
  @Input() IsBusy = false;
  /** How the last Copy went. A signal, so the OnPush view repaints when the clipboard answers. */
  public LinkStatus = signal<'idle' | 'copied' | 'failed'>('idle');
  /** Where Copy writes. The browser's clipboard when there is one (there isn't on a plain-HTTP host). */
  @Input() Clipboard: Pick<Clipboard, 'writeText'> | null = typeof navigator !== 'undefined' ? navigator.clipboard ?? null : null;

  public Ask(member: SpaceMemberModel, kind: 'approve' | 'remove'): void {
    this.Pending = { id: member.id, kind };
  }

  public AskRole(member: SpaceMemberModel, roleCode: string): void {
    if (roleCode === member.roleCode) return;
    this.Pending = { id: member.id, kind: 'role', roleCode };
  }

  /** The person's own seat on this space, as a member row, so it can be approved or withdrawn like any seat. */
  public OwnSeatOf(member: SpaceMemberModel): SpaceMemberModel {
    const seat = member.ownSeat!;
    return { ...member, id: seat.id, status: seat.status, roleName: seat.roleName, roleCode: seat.roleCode, inherited: false, ownSeat: undefined };
  }

  public PendingQuestion(member: SpaceMemberModel): string {
    switch (this.Pending?.kind) {
      case 'approve': return `Approve ${member.name}?`;
      case 'remove': return member.status === 'Invited' ? `Withdraw ${member.name}'s seat?` : `Remove ${member.name}?`;
      case 'role': return `Change ${member.name}'s role?`;
      default: return '';
    }
  }

  /** The role picker's options for one seat: the roles the viewer may hand out, and the seat's own role so it reads as chosen. */
  public RoleChoicesFor(member: SpaceMemberModel): ReadonlyArray<{ code: string; label: string }> {
    return this.RoleOptions.some((o) => o.code === member.roleCode)
      ? this.RoleOptions
      : [{ code: member.roleCode, label: member.roleName }, ...this.RoleOptions];
  }

  public ConfirmPending(): void {
    const pending = this.Pending;
    this.Pending = null;
    const listed = this.Members.find((m) => m.id === pending?.id);
    const member = listed ?? this.Members.filter((m) => m.ownSeat).map((m) => this.OwnSeatOf(m)).find((m) => m.id === pending?.id);
    if (!pending || !member) return;
    if (pending.kind === 'approve') this.ApproveMemberRequested.emit(member);
    else if (pending.kind === 'remove') this.RemoveMemberRequested.emit(member);
    else if (pending.roleCode) this.ChangeRoleRequested.emit({ member, roleCode: pending.roleCode });
  }

  public async CopyLink(): Promise<void> {
    if (!this.RedemptionUrl) return;
    if (!this.Clipboard) {
      LogError('Copy link: this page has no clipboard access (it needs a secure connection).');
      this.LinkStatus.set('failed');
      return;
    }
    try {
      await this.Clipboard.writeText(this.RedemptionUrl);
      this.LinkStatus.set('copied');
    } catch (error) {
      LogError(`Copy link failed: ${error instanceof Error ? error.message : String(error)}`);
      this.LinkStatus.set('failed');
    }
  }

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

  /** Seats that were asked for and wait for an owner or admin to approve them. */
  public get InvitedCount(): number {
    // A person listed under a seat they reach through can still hold an Invited seat of their own here, waiting for approval
    return this.Members.filter((m) => m.status === 'Invited' || m.ownSeat?.status === 'Invited').length;
  }

  public get FilteredMembers(): SpaceMemberModel[] {
    return this.Members.filter((m) => {
      if (this.SearchQuery.trim()) {
        const q = this.SearchQuery.toLowerCase();
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
    if (this.isInviting && this.outcome) {
      this.outcome = null;
      this.InviteOutcomeDismissed.emit();
    }
  }

  /** Closes the form and forgets what the last invite said, so a refusal doesn't greet the next one. */
  public CancelInvite(): void {
    this.isInviting = false;
    this.outcome = null;
    this.InviteOutcomeDismissed.emit();
  }

  /** Forgets the message here and tells the screen to forget it too: People is built again on each visit. */
  public DismissInviteOutcome(): void {
    this.outcome = null;
    this.InviteOutcomeDismissed.emit();
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
