import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Inject,
    Input,
    OnChanges,
    Optional,
    Output,
    SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type IRunViewProvider, RunView } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import {
    MJButtonDirective,
    MJDialogActionsComponent,
    MJDialogComponent,
    MJEmptyStateComponent,
} from '@memberjunction/ng-ui-components';
import { BaseSpaceTab } from './base-space-tab';
import { COLLAB_TOKENS_CSS } from './tokens';

const COLLABORATION_SPACES_ENTITY_ID = '3648DC35-1DC4-4ED6-A1A6-5D87271A54DB';

export interface NewSpaceMeetingDraft {
    Name: string;
    Description: string;
    StartsAt: string;
    EndsAt: string;
    TimeZone: string;
    LocationType: 'Virtual' | 'InPerson' | 'Hybrid';
    Location: string;
    VideoJoinURL: string;
    Visibility: 'Standard' | 'Private';
}

export function validateNewSpaceMeetingDraft(
    draft: NewSpaceMeetingDraft
): { valid: true } | { valid: false; error: string } {
    if (!(draft.Name ?? '').trim()) {
        return { valid: false, error: 'Meeting title is required.' };
    }
    if (!(draft.TimeZone ?? '').trim()) {
        return { valid: false, error: 'Time zone is required.' };
    }
    const startMs = new Date(draft.StartsAt).getTime();
    const endMs = new Date(draft.EndsAt).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        return { valid: false, error: 'Start and end times are required.' };
    }
    if (endMs <= startMs) {
        return { valid: false, error: 'End time must be after start time.' };
    }
    return { valid: true };
}

export function meetingVisibilityToSpaceBand(
    visibility: 'Standard' | 'Private'
): 'Shared' | 'Team' {
    return visibility === 'Private' ? 'Team' : 'Shared';
}

function toLocalDatetimeInputValue(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createDefaultSpaceMeetingDraft(now: Date = new Date()): NewSpaceMeetingDraft {
    const start = new Date(now.getTime());
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    return {
        Name: '',
        Description: '',
        StartsAt: toLocalDatetimeInputValue(start),
        EndsAt: toLocalDatetimeInputValue(end),
        TimeZone: tz,
        LocationType: 'Virtual',
        Location: '',
        VideoJoinURL: '',
        Visibility: 'Standard',
    };
}

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
 * Loads meetings linked to `spaceId` via `MJ_BizApps_Tasks: Meeting Links` and attaches
 * bound `SpaceChat` threads (`Subject = 'meeting:<MeetingID>'`).
 */
export async function loadSpaceMeetingCards(
    spaceId: string,
    provider?: IRunViewProvider | null
): Promise<SpaceMeetingCardItem[]> {
    const cleanSpaceId = (spaceId ?? '').trim();
    if (!cleanSpaceId) return [];

    try {
        const rv = new RunView(provider ?? undefined);
        const candidates = [
            `'${cleanSpaceId}'`,
            `'${cleanSpaceId.toUpperCase()}'`,
            `'ID|${cleanSpaceId}'`,
            `'ID|${cleanSpaceId.toUpperCase()}'`,
        ].join(', ');

        const linksRes = await rv.RunView<{
            ID: string;
            MeetingID: string | null;
            SeriesID: string | null;
        }>({
            EntityName: 'MJ_BizApps_Tasks: Meeting Links',
            ExtraFilter: `EntityID = '${COLLABORATION_SPACES_ENTITY_ID}' AND RecordID IN (${candidates})`,
            ResultType: 'simple',
        });
        if (!linksRes.Success || (linksRes.Results?.length ?? 0) === 0) {
            return [];
        }

        const meetingIds = new Set<string>();
        const seriesIds = new Set<string>();
        for (const link of linksRes.Results ?? []) {
            if (link.MeetingID?.trim()) meetingIds.add(link.MeetingID.trim());
            if (link.SeriesID?.trim()) seriesIds.add(link.SeriesID.trim());
        }

        const clauses: string[] = [];
        if (meetingIds.size > 0) {
            clauses.push(`ID IN (${[...meetingIds].map((id) => `'${id}'`).join(', ')})`);
        }
        if (seriesIds.size > 0) {
            clauses.push(`SeriesID IN (${[...seriesIds].map((id) => `'${id}'`).join(', ')})`);
        }
        if (clauses.length === 0) return [];

        const [meetingsRes, chatsRes] = await Promise.all([
            rv.RunView<{
                ID: string;
                Name: string;
                StartsAt: string | Date;
                EndsAt: string | Date;
                TimeZone?: string;
                Status: string;
                LocationType?: string;
                Location?: string | null;
                VideoJoinURL?: string | null;
                Visibility?: 'Standard' | 'Private';
            }>({
                EntityName: 'MJ_BizApps_Tasks: Meetings',
                ExtraFilter: clauses.join(' OR '),
                OrderBy: 'StartsAt ASC',
                ResultType: 'simple',
            }),
            rv.RunView<{
                ID: string;
                ConversationID: string;
                Subject?: string | null;
            }>({
                EntityName: 'MJ_BizApps_Collaboration: Space Chats',
                ExtraFilter: `SpaceID = '${cleanSpaceId}' AND Status = 'Active' AND Subject LIKE 'meeting:%'`,
                Fields: ['ID', 'ConversationID', 'Subject'],
                ResultType: 'simple',
            }),
        ]);

        if (!meetingsRes.Success || (meetingsRes.Results?.length ?? 0) === 0) {
            return [];
        }

        const chatByMeetingId = new Map<string, { spaceChatId: string; conversationId: string }>();
        if (chatsRes.Success) {
            for (const c of chatsRes.Results ?? []) {
                const sub = (c.Subject ?? '').trim();
                if (sub.toLowerCase().startsWith('meeting:')) {
                    const mId = sub.slice('meeting:'.length).trim().toLowerCase();
                    if (mId) {
                        chatByMeetingId.set(mId, { spaceChatId: c.ID, conversationId: c.ConversationID });
                    }
                }
            }
        }

        return (meetingsRes.Results ?? []).map((row) => {
            const chat = chatByMeetingId.get(row.ID.toLowerCase());
            return {
                ID: row.ID,
                Name: row.Name,
                StartsAt: row.StartsAt instanceof Date ? row.StartsAt.toISOString() : String(row.StartsAt),
                EndsAt: row.EndsAt instanceof Date ? row.EndsAt.toISOString() : String(row.EndsAt),
                TimeZone: row.TimeZone ?? 'UTC',
                Status: row.Status ?? 'Scheduled',
                LocationType: row.LocationType ?? 'Virtual',
                Location: row.Location ?? null,
                VideoJoinURL: row.VideoJoinURL ?? null,
                Visibility: row.Visibility === 'Private' ? 'Private' : 'Standard',
                SpaceChatID: chat?.spaceChatId ?? null,
                ConversationID: chat?.conversationId ?? null,
            };
        });
    } catch {
        return [];
    }
}

/**
 * The Meetings tab in a space (B23): displays upcoming and past meetings linked to the space,
 * with quick actions to join video (`VideoJoinURL`), open the meeting's bound `SpaceChat` thread,
 * or open the full meeting record.
 */
@RegisterClassEx(BaseSpaceTab, {
    key: 'collaboration:meetings',
    priority: -1,
    metadata: {
        spaceTypes: ['*'],
        slot: 'tab',
        sortKey: 45,
        contributionKey: 'meetings',
        label: 'Meetings',
        icon: 'fa-solid fa-calendar-days',
    },
})
@Component({
    selector: 'mjc-space-meetings-tab',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MJButtonDirective,
        MJDialogComponent,
        MJDialogActionsComponent,
        MJEmptyStateComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="meetings-tab">
            <div class="meetings-head">
                <div>
                    <div class="fw7 fs14">{{ Title }}</div>
                    <div class="fs12 muted">{{ Subtitle }}</div>
                </div>
                @if (CanSchedule) {
                    <button mjButton Variant="primary" Size="sm" type="button" (click)="onScheduleClick()">
                        <i class="fa-solid fa-plus"></i>Schedule meeting
                    </button>
                }
            </div>

            @if (IsScheduleDialogOpen) {
                <mj-dialog
                    [Visible]="true"
                    [Title]="dialogTitle"
                    [Width]="560"
                    [Closeable]="!IsSubmitting"
                    (Close)="closeScheduleDialog()"
                >
                    <div class="schedule-modal">
                        <p class="d-sub">
                            @if (SpaceName) {
                                <strong>{{ SpaceName }}</strong> · Space meeting
                            } @else {
                                Schedule a meeting linked to this space
                            }
                        </p>

                        <div class="d-body">
                            <div class="form-group">
                                <label class="f-label" for="schedule-meeting-title">Title *</label>
                                <input
                                    id="schedule-meeting-title"
                                    type="text"
                                    class="f-input"
                                    maxlength="255"
                                    [(ngModel)]="Draft.Name"
                                    [disabled]="IsSubmitting"
                                    placeholder="e.g. Q4 Controls Follow-up"
                                />
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="f-label" for="schedule-meeting-starts-at">Starts At *</label>
                                    <input
                                        id="schedule-meeting-starts-at"
                                        type="datetime-local"
                                        class="f-input"
                                        [(ngModel)]="Draft.StartsAt"
                                        [disabled]="IsSubmitting"
                                    />
                                </div>
                                <div class="form-group">
                                    <label class="f-label" for="schedule-meeting-ends-at">Ends At *</label>
                                    <input
                                        id="schedule-meeting-ends-at"
                                        type="datetime-local"
                                        class="f-input"
                                        [(ngModel)]="Draft.EndsAt"
                                        [disabled]="IsSubmitting"
                                    />
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="f-label" for="schedule-meeting-location-type">Location Type</label>
                                    <select
                                        id="schedule-meeting-location-type"
                                        class="f-input"
                                        [(ngModel)]="Draft.LocationType"
                                        [disabled]="IsSubmitting"
                                    >
                                        <option value="Virtual">Virtual</option>
                                        <option value="InPerson">In-Person</option>
                                        <option value="Hybrid">Hybrid</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="f-label" for="schedule-meeting-visibility">Visibility</label>
                                    <select
                                        id="schedule-meeting-visibility"
                                        class="f-input"
                                        [(ngModel)]="Draft.Visibility"
                                        [disabled]="IsSubmitting || AllowedBands.length <= 1"
                                    >
                                        @if (allowsStandard) {
                                            <option value="Standard">Standard (Space-wide)</option>
                                        }
                                        @if (allowsPrivate) {
                                            <option value="Private">Private (Team attendees)</option>
                                        }
                                    </select>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label class="f-label" for="schedule-meeting-video-url">Video Join URL</label>
                                    <input
                                        id="schedule-meeting-video-url"
                                        type="url"
                                        class="f-input"
                                        [(ngModel)]="Draft.VideoJoinURL"
                                        [disabled]="IsSubmitting"
                                        placeholder="https://zoom.us/j/..."
                                    />
                                </div>
                                <div class="form-group">
                                    <label class="f-label" for="schedule-meeting-location">Location / Room</label>
                                    <input
                                        id="schedule-meeting-location"
                                        type="text"
                                        class="f-input"
                                        [(ngModel)]="Draft.Location"
                                        [disabled]="IsSubmitting"
                                        placeholder="Conference Room B / Remote"
                                    />
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="f-label" for="schedule-meeting-description">Description / Purpose</label>
                                <textarea
                                    id="schedule-meeting-description"
                                    class="f-input f-textarea"
                                    rows="3"
                                    [(ngModel)]="Draft.Description"
                                    [disabled]="IsSubmitting"
                                    placeholder="Agenda overview or goals for this meeting"
                                ></textarea>
                            </div>

                            @if (ScheduleError) {
                                <div class="schedule-error" role="alert">
                                    <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                                    <span>{{ ScheduleError }}</span>
                                </div>
                            }
                        </div>
                    </div>

                    <mj-dialog-actions>
                        <button
                            type="button"
                            mjButton
                            Variant="primary"
                            Size="md"
                            [disabled]="IsSubmitting"
                            (click)="submitScheduleDialog()"
                        >
                            {{ IsSubmitting ? 'Scheduling…' : 'Schedule meeting' }}
                        </button>
                        <button
                            type="button"
                            mjButton
                            Variant="secondary"
                            Size="md"
                            [disabled]="IsSubmitting"
                            (click)="closeScheduleDialog()"
                        >
                            Cancel
                        </button>
                    </mj-dialog-actions>
                </mj-dialog>
            }

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
            .schedule-modal {
                color: var(--mj-text-primary, #0f172a);
                font-family: var(--mj-font-family, Inter, sans-serif);
                font-size: 14px;
            }
            .d-sub {
                margin: 0 0 14px;
                font-size: 13px;
                color: var(--mj-text-secondary, #64748b);
            }
            .d-body {
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .f-label {
                font-size: 12px;
                font-weight: 600;
                color: var(--mj-text-primary, #0f172a);
            }
            .f-input {
                border: 1px solid var(--mj-border-default, #e2e8f0);
                border-radius: 8px;
                background: var(--mj-bg-surface, #ffffff);
                padding: 8px 12px;
                font: inherit;
                font-size: 13px;
                color: var(--mj-text-primary, #0f172a);
            }
            .f-textarea {
                resize: vertical;
                min-height: 64px;
            }
            .schedule-error {
                display: flex;
                gap: 8px;
                align-items: flex-start;
                padding: 10px 12px;
                border-radius: 8px;
                font-size: 13px;
                color: var(--mj-status-error-text, #b91c1c);
                background: var(--mj-status-error-bg, #fef2f2);
                border: 1px solid var(--mj-status-error-border, #fecaca);
            }
        `,
    ],
})
export class SpaceMeetingsTabComponent extends BaseSpaceTab implements OnChanges {
    @Input() public Title = 'Meetings';
    @Input() public Subtitle = 'Agendas, live sessions, notes, and follow-up discussions in this space';
    @Input() public SpaceName = '';
    @Input() public CanSchedule = false;
    @Input() public DefaultBand: 'Shared' | 'Team' = 'Shared';
    @Input() public AllowedBands: readonly ('Shared' | 'Team')[] = ['Shared', 'Team'];
    @Input() public IsLoading = false;
    @Input() public Meetings: SpaceMeetingCardItem[] = [];

    @Output() public ScheduleMeetingRequested = new EventEmitter<string>();
    @Output() public CreateMeetingRequested = new EventEmitter<NewSpaceMeetingDraft>();
    @Output() public OpenMeetingRequested = new EventEmitter<SpaceMeetingCardItem>();
    @Output() public OpenMeetingChatRequested = new EventEmitter<SpaceMeetingCardItem>();

    public IsScheduleDialogOpen = false;
    public IsSubmitting = false;
    public ScheduleError = '';
    public Draft: NewSpaceMeetingDraft = createDefaultSpaceMeetingDraft();

    private hasExplicitMeetings = false;
    private loadToken = 0;

    constructor(@Optional() @Inject(ChangeDetectorRef) private readonly cdr?: ChangeDetectorRef) {
        super();
    }

    public get dialogTitle(): string {
        const name = this.SpaceName?.trim();
        return name ? `Schedule meeting in ${name}` : 'Schedule meeting';
    }

    public get allowsStandard(): boolean {
        return this.AllowedBands.length === 0 || this.AllowedBands.includes('Shared');
    }

    public get allowsPrivate(): boolean {
        return this.AllowedBands.length === 0 || this.AllowedBands.includes('Team');
    }

    private startVisibility(): 'Standard' | 'Private' {
        const startBand = this.AllowedBands.includes(this.DefaultBand)
            ? this.DefaultBand
            : (this.AllowedBands[0] ?? this.DefaultBand);
        return startBand === 'Team' ? 'Private' : 'Standard';
    }

    public onScheduleClick(): void {
        this.ScheduleMeetingRequested.emit(this.SpaceId);
        if (this.CreateMeetingRequested.observed) {
            this.openScheduleDialog();
        }
    }

    public openScheduleDialog(): void {
        this.Draft = {
            ...createDefaultSpaceMeetingDraft(),
            Visibility: this.startVisibility(),
        };
        this.ScheduleError = '';
        this.IsSubmitting = false;
        this.IsScheduleDialogOpen = true;
        this.cdr?.markForCheck();
    }

    public closeScheduleDialog(): void {
        if (this.IsSubmitting) return;
        this.IsScheduleDialogOpen = false;
        this.ScheduleError = '';
        this.cdr?.markForCheck();
    }

    public submitScheduleDialog(): void {
        if (this.IsSubmitting) return;
        const check = validateNewSpaceMeetingDraft(this.Draft);
        if (check.valid === false) {
            this.ScheduleError = check.error;
            this.cdr?.markForCheck();
            return;
        }
        this.ScheduleError = '';
        this.IsSubmitting = true;
        this.cdr?.markForCheck();
        this.CreateMeetingRequested.emit({
            Name: this.Draft.Name.trim(),
            Description: this.Draft.Description.trim(),
            StartsAt: new Date(this.Draft.StartsAt).toISOString(),
            EndsAt: new Date(this.Draft.EndsAt).toISOString(),
            TimeZone: this.Draft.TimeZone.trim(),
            LocationType: this.Draft.LocationType,
            Location: this.Draft.Location.trim(),
            VideoJoinURL: this.Draft.VideoJoinURL.trim(),
            Visibility: this.Draft.Visibility,
        });
    }

    public completeSchedule(): void {
        this.IsSubmitting = false;
        this.IsScheduleDialogOpen = false;
        this.ScheduleError = '';
        this.cdr?.markForCheck();
    }

    public failSchedule(errorMessage: string): void {
        this.IsSubmitting = false;
        this.ScheduleError = errorMessage || 'Meeting scheduling refused.';
        this.cdr?.markForCheck();
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes['Meetings'] && changes['Meetings'].currentValue !== undefined) {
            this.hasExplicitMeetings = true;
        }
        if (changes['SpaceId'] && !this.hasExplicitMeetings) {
            void this.loadForSpace(this.SpaceId);
        }
    }

    public async loadForSpace(spaceId: string): Promise<void> {
        const cleanId = (spaceId ?? '').trim();
        if (!cleanId) {
            this.Meetings = [];
            this.cdr?.markForCheck();
            return;
        }
        const token = ++this.loadToken;
        this.IsLoading = true;
        this.cdr?.markForCheck();
        try {
            const loaded = await loadSpaceMeetingCards(cleanId, this.RunViewToUse);
            if (token !== this.loadToken) return;
            this.Meetings = loaded;
        } finally {
            if (token === this.loadToken) {
                this.IsLoading = false;
                this.cdr?.markForCheck();
            }
        }
    }

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
