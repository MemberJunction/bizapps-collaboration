import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClass } from '@memberjunction/global';
import { MJButtonDirective, MJEmptyStateComponent } from '@memberjunction/ng-ui-components';
import { BaseSpaceTab } from './base-space-tab';
import { COLLAB_TOKENS_CSS } from './tokens';

export interface SpaceMeetingCardItem {
    ID: string;
    Name: string;
    StartsAt: string;
    EndsAt: string;
    TimeZone?: string;
    Status: string;
    LocationType?: string;
    Location?: string | null;
    VideoJoinURL?: string | null;
    Visibility?: 'Standard' | 'Private';
    SpaceChatID?: string | null;
    ConversationID?: string | null;
    AgendaCount?: number;
    NoteCount?: number;
}

/**
 * The Meetings tab in a space (B23): displays upcoming and past meetings linked to the space,
 * with quick actions to join video (`VideoJoinURL`), open the meeting's bound `SpaceChat` thread,
 * or open the full meeting record.
 */
@RegisterClass(BaseSpaceTab, 'SpaceMeetingsTabComponent')
@Component({
    selector: 'mjc-space-meetings-tab',
    standalone: true,
    imports: [CommonModule, MJButtonDirective, MJEmptyStateComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="meetings-tab">
            <div class="meetings-head">
                <div>
                    <div class="fw7 fs14">{{ Title }}</div>
                    <div class="fs12 muted">{{ Subtitle }}</div>
                </div>
                @if (CanSchedule) {
                    <button mjButton Variant="primary" Size="sm" (click)="ScheduleMeetingRequested.emit(SpaceId)">
                        <i class="fa-solid fa-plus"></i>Schedule meeting
                    </button>
                }
            </div>

            @if (IsLoading) {
                <div class="muted fs12 pad">Loading meetings…</div>
            } @else if (UpcomingMeetings.length === 0 && PastMeetings.length === 0) {
                <mj-empty-state
                    Icon="fa-solid fa-calendar-days"
                    Title="No meetings scheduled"
                    Message="Meetings linked to this space will appear here with their agendas, notes, and discussions."
                ></mj-empty-state>
            } @else {
                @if (UpcomingMeetings.length > 0) {
                    <section class="meetings-section" aria-label="Upcoming meetings">
                        <div class="section-label">Upcoming ({{ UpcomingMeetings.length }})</div>
                        @for (m of UpcomingMeetings; track m.ID) {
                            <article class="card meeting-card" [class.private]="m.Visibility === 'Private'">
                                <div class="meeting-main">
                                    <div class="grow">
                                        <div class="meeting-title-row">
                                            <span class="fw7 fs14">{{ m.Name }}</span>
                                            <span class="status-pill">{{ m.Status }}</span>
                                            @if (m.Visibility === 'Private') {
                                                <span class="private-pill"><i class="fa-solid fa-lock"></i> Private</span>
                                            }
                                        </div>
                                        <div class="fs12 muted">
                                            <i class="fa-regular fa-clock"></i> {{ formatWindow(m.StartsAt, m.EndsAt) }}
                                            @if (m.Location) {
                                                · <i class="fa-solid fa-location-dot"></i> {{ m.Location }}
                                            }
                                        </div>
                                    </div>
                                    <div class="meeting-actions">
                                        @if (m.VideoJoinURL) {
                                            <a
                                                mjButton
                                                Variant="primary"
                                                Size="sm"
                                                [href]="m.VideoJoinURL"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <i class="fa-solid fa-video"></i>Join
                                            </a>
                                        }
                                        <button
                                            mjButton
                                            Variant="secondary"
                                            Size="sm"
                                            type="button"
                                            (click)="OpenMeetingChatRequested.emit(m)"
                                        >
                                            <i class="fa-regular fa-comments"></i>{{ m.SpaceChatID ? 'Open chat' : 'Start chat' }}
                                        </button>
                                        <button
                                            mjButton
                                            Variant="secondary"
                                            Size="sm"
                                            type="button"
                                            (click)="OpenMeetingRequested.emit(m)"
                                        >
                                            <i class="fa-solid fa-arrow-up-right-from-square"></i>Open
                                        </button>
                                    </div>
                                </div>
                            </article>
                        }
                    </section>
                }

                @if (PastMeetings.length > 0) {
                    <section class="meetings-section" aria-label="Past meetings">
                        <div class="section-label">Past ({{ PastMeetings.length }})</div>
                        @for (m of PastMeetings; track m.ID) {
                            <article class="card meeting-card past" [class.private]="m.Visibility === 'Private'">
                                <div class="meeting-main">
                                    <div class="grow">
                                        <div class="meeting-title-row">
                                            <span class="fw7 fs14">{{ m.Name }}</span>
                                            <span class="status-pill">{{ m.Status }}</span>
                                        </div>
                                        <div class="fs12 muted">
                                            <i class="fa-regular fa-clock"></i> {{ formatWindow(m.StartsAt, m.EndsAt) }}
                                        </div>
                                    </div>
                                    <div class="meeting-actions">
                                        <button
                                            mjButton
                                            Variant="secondary"
                                            Size="sm"
                                            type="button"
                                            (click)="OpenMeetingChatRequested.emit(m)"
                                        >
                                            <i class="fa-regular fa-comments"></i>Discussion
                                        </button>
                                        <button
                                            mjButton
                                            Variant="secondary"
                                            Size="sm"
                                            type="button"
                                            (click)="OpenMeetingRequested.emit(m)"
                                        >
                                            <i class="fa-solid fa-file-lines"></i>Notes & Agenda
                                        </button>
                                    </div>
                                </div>
                            </article>
                        }
                    </section>
                }
            }
        </div>
    `,
    styles: [
        COLLAB_TOKENS_CSS,
        `
            :host {
                display: block;
            }
            .meetings-tab {
                display: flex;
                flex-direction: column;
                gap: 14px;
                padding: 16px;
            }
            .meetings-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .meetings-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .section-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: var(--mj-text-muted, #6b7280);
            }
            .fw7 {
                font-weight: 700;
            }
            .fs14 {
                font-size: 14px;
            }
            .fs12 {
                font-size: 12px;
            }
            .muted {
                color: var(--mj-text-muted, #6b7280);
            }
            .pad {
                padding: 8px 0;
            }
            .grow {
                flex: 1;
                min-width: 0;
            }
            .card {
                background: var(--mj-bg-surface-card, #ffffff);
                border: 1px solid var(--mj-border-default, #e5e7eb);
                border-radius: 10px;
                padding: 12px 14px;
            }
            .meeting-card.private {
                border-left: 3px solid var(--mjc-team, #7c3aed);
            }
            .meeting-main {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                flex-wrap: wrap;
            }
            .meeting-title-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 4px;
            }
            .status-pill,
            .private-pill {
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 999px;
                background: var(--mj-bg-surface-sunken, #f3f4f6);
                color: var(--mj-text-secondary, #374151);
            }
            .meeting-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
        `,
    ],
})
export class SpaceMeetingsTabComponent extends BaseSpaceTab {
    @Input() public Title = 'Meetings';
    @Input() public Subtitle = 'Agendas, live sessions, notes, and follow-up discussions in this space';
    @Input() public CanSchedule = false;
    @Input() public IsLoading = false;
    @Input() public Meetings: SpaceMeetingCardItem[] = [];

    @Output() public ScheduleMeetingRequested = new EventEmitter<string>();
    @Output() public OpenMeetingRequested = new EventEmitter<SpaceMeetingCardItem>();
    @Output() public OpenMeetingChatRequested = new EventEmitter<SpaceMeetingCardItem>();

    public get UpcomingMeetings(): SpaceMeetingCardItem[] {
        const now = Date.now();
        return this.Meetings.filter((m) => {
            const done = m.Status === 'Completed' || m.Status === 'Cancelled';
            const end = new Date(m.EndsAt).getTime();
            return !done && (!Number.isFinite(end) || end >= now);
        });
    }

    public get PastMeetings(): SpaceMeetingCardItem[] {
        const upcomingIds = new Set(this.UpcomingMeetings.map((m) => m.ID));
        return this.Meetings.filter((m) => !upcomingIds.has(m.ID));
    }

    public formatWindow(startsAt: string, endsAt: string): string {
        const s = new Date(startsAt);
        const e = new Date(endsAt);
        if (!Number.isFinite(s.getTime())) return startsAt;
        const dateStr = s.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
        const startStr = s.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
        if (!Number.isFinite(e.getTime())) return `${dateStr}, ${startStr}`;
        const endStr = e.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        });
        return `${dateStr} · ${startStr} – ${endStr}`;
    }
}
