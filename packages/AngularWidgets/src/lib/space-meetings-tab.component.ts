import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    HostListener,
    Inject,
    Input,
    OnChanges,
    Optional,
    Output,
    SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type IMetadataProvider, type IRunViewProvider, Metadata } from '@memberjunction/core';
import { RegisterClassEx } from '@memberjunction/global';
import {
    MJButtonDirective,
    MJDialogActionsComponent,
    MJDialogComponent,
} from '@memberjunction/ng-ui-components';
import {
    type AgendaItemDraft,
    type AgendaItemModel,
    type AgendaMove,
    type AgendaReorder,
    type AttendanceChange,
    type AttendeeModel,
    type FollowUpDraft,
    type FollowUpModel,
    type InviteRequest,
    type LiveAttendanceChange,
    type LiveFollowUp,
    type LiveItemChange,
    type LiveQuickNote,
    MeetingAgendaComponent,
    MeetingFollowUpsComponent,
    MeetingHeaderComponent,
    MeetingListComponent,
    MeetingLiveComponent,
    MeetingNotesComponent,
    MeetingPeopleComponent,
    type MeetingPermissions,
    type MeetingResponseChange,
    type MeetingRow,
    type NoteDraft,
    type NoteModel,
    type ResponseStatus,
} from '@mj-biz-apps/tasks-ng-widgets';
import { CollabBandChipComponent } from './band-chip.component';
import { BaseSpaceTab } from './base-space-tab';
import {
    buildMeetingIcsContent,
    computeMeetingPermissions,
    type EditableAgendaItemEntity,
    type EditableAttendeeEntity,
    type EditableNoteEntity,
    filterSpaceMeetings,
    isUpcomingMeeting,
    loadSpaceMeetingDetail,
    loadSpaceMeetingsWithRollup,
    resolveViewerPersonId,
    saveAgendaItemDraft,
    saveAttendeeResponse,
    saveMeetingFollowUpDraft,
    saveMeetingNoteDraft,
    saveMeetingStatusTransition,
    type SpaceChildSummary,
    type SpaceMeetingCardItem,
    type SpaceMeetingDetailBundle,
    type SpaceMeetingsBandFilter,
    type SpaceMeetingsFilterMode,
    toMeetingRow,
    updateAgendaItemLiveState,
} from './space-meetings-data';
import { COLLAB_TOKENS_CSS } from './tokens';

export type {
    SpaceChildSummary,
    SpaceMeetingCardItem,
    SpaceMeetingDetailBundle,
    SpaceMeetingsBandFilter,
    SpaceMeetingsFilterMode,
} from './space-meetings-data';
export {
    buildMeetingIcsContent,
    computeMeetingPermissions,
    filterSpaceMeetings,
    isUpcomingMeeting,
    loadSpaceChildSpaces,
    loadSpaceMeetingDetail,
    loadSpaceMeetingsWithRollup,
    toMeetingRow,
} from './space-meetings-data';

export type MeetingDrawerSection = 'all' | 'agenda' | 'people' | 'notes' | 'followups';

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
    draft: NewSpaceMeetingDraft,
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
    visibility: 'Standard' | 'Private' | undefined,
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

/**
 * Loads meetings linked to `spaceId` via `MJ_BizApps_Tasks: Meeting Links` and attaches
 * bound `SpaceChat` threads (`Subject = 'meeting:<MeetingID>'`).
 */
export async function loadSpaceMeetingCards(
    spaceId: string,
    provider?: IRunViewProvider | null,
): Promise<SpaceMeetingCardItem[]> {
    const result = await loadSpaceMeetingsWithRollup(spaceId, provider, {
        IncludeSubSpaces: false,
        CanSeeTeamSide: true,
    });
    return result.Meetings;
}

/**
 * The Meetings tab in a space (B23): composes `@mj-biz-apps/tasks-ng-widgets` (`<bizapps-meeting-list>`,
 * `<bizapps-meeting-header>`, `<bizapps-meeting-agenda>`, `<bizapps-meeting-people>`,
 * `<bizapps-meeting-notes>`, `<bizapps-meeting-followups>`, and `<bizapps-meeting-live>`) with an
 * in-place slide-over meeting workspace, inline RSVP, child-space rollup, and strict Band & ReadOnly isolation.
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
        CollabBandChipComponent,
        MeetingListComponent,
        MeetingHeaderComponent,
        MeetingAgendaComponent,
        MeetingPeopleComponent,
        MeetingNotesComponent,
        MeetingFollowUpsComponent,
        MeetingLiveComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="meetings-tab" data-testid="space-meetings-tab">
            <div class="meetings-head">
                <div class="head-copy">
                    <div class="fw7 fs15">{{ Title }}</div>
                    <div class="fs12 muted">{{ Subtitle }}</div>
                </div>
                <div class="head-actions">
                    @if (ChildSpaces.length > 0) {
                        <label class="subspace-toggle" data-testid="include-subspaces-toggle">
                            <input
                                type="checkbox"
                                [checked]="IncludeSubSpaces"
                                (change)="onToggleIncludeSubSpaces($event)"
                            />
                            <i class="fa-solid fa-folder-tree" aria-hidden="true"></i>
                            <span>Include sub-spaces ({{ ChildSpaces.length }})</span>
                        </label>
                    }
                    @if (CanSchedule) {
                        <button
                            mjButton
                            Variant="primary"
                            Size="sm"
                            type="button"
                            data-testid="schedule-meeting-btn"
                            (click)="onScheduleClick()"
                        >
                            <i class="fa-solid fa-plus"></i>Schedule meeting
                        </button>
                    }
                </div>
            </div>

            <div class="meetings-toolbar">
                <div class="seg-group" role="tablist" aria-label="Meeting timeframe filter">
                    <button
                        type="button"
                        role="tab"
                        class="seg-btn"
                        [class.active]="FilterMode === 'upcoming'"
                        [attr.aria-selected]="FilterMode === 'upcoming'"
                        data-testid="meetings-filter-upcoming"
                        (click)="setFilterMode('upcoming')"
                    >
                        Upcoming ({{ UpcomingMeetings.length }})
                    </button>
                    <button
                        type="button"
                        role="tab"
                        class="seg-btn"
                        [class.active]="FilterMode === 'past'"
                        [attr.aria-selected]="FilterMode === 'past'"
                        data-testid="meetings-filter-past"
                        (click)="setFilterMode('past')"
                    >
                        Past ({{ PastMeetings.length }})
                    </button>
                    <button
                        type="button"
                        role="tab"
                        class="seg-btn"
                        [class.active]="FilterMode === 'all'"
                        [attr.aria-selected]="FilterMode === 'all'"
                        data-testid="meetings-filter-all"
                        (click)="setFilterMode('all')"
                    >
                        All ({{ VisibleMeetings.length }})
                    </button>
                </div>

                @if (CanSeeTeamSide && HasPrivateMeetings) {
                    <div class="band-filter" role="group" aria-label="Visibility filter">
                        <button
                            type="button"
                            class="pill-btn"
                            [class.active]="BandFilter === 'all'"
                            (click)="setBandFilter('all')"
                        >
                            All bands
                        </button>
                        <button
                            type="button"
                            class="pill-btn"
                            [class.active]="BandFilter === 'Shared'"
                            (click)="setBandFilter('Shared')"
                        >
                            <mjc-band-chip Band="Shared" Label="Shared" Size="sm"></mjc-band-chip>
                        </button>
                        <button
                            type="button"
                            class="pill-btn"
                            [class.active]="BandFilter === 'Team'"
                            (click)="setBandFilter('Team')"
                        >
                            <mjc-band-chip Band="Team" Label="Private" Size="sm"></mjc-band-chip>
                        </button>
                    </div>
                }

                <div class="search-wrap">
                    <i class="fa-solid fa-magnifying-glass search-icon" aria-hidden="true"></i>
                    <input
                        type="search"
                        class="search-input"
                        [(ngModel)]="SearchQuery"
                        (ngModelChange)="onSearchChange()"
                        placeholder="Search meetings, rooms, or organizers…"
                        aria-label="Search meetings"
                        data-testid="meetings-search-input"
                    />
                </div>
            </div>

            @if (IncludeSubSpaces && SubSpaceFilterOptions.length > 1) {
                <div class="room-filter-bar" aria-label="Filter by room">
                    <button
                        type="button"
                        class="room-pill"
                        [class.active]="!ActiveRoomFilterId"
                        (click)="setRoomFilter(null)"
                    >
                        All rooms ({{ VisibleMeetings.length }})
                    </button>
                    @for (room of SubSpaceFilterOptions; track room.id) {
                        <button
                            type="button"
                            class="room-pill"
                            [class.active]="ActiveRoomFilterId === room.id"
                            (click)="setRoomFilter(room.id)"
                        >
                            @if (room.isChild) {
                                <i class="fa-solid fa-folder-tree" aria-hidden="true"></i>
                            }
                            <span>{{ room.name }}</span>
                            <span class="room-count">{{ room.count }}</span>
                        </button>
                    }
                </div>
            }

            @if (RsvpError) {
                <div class="status-banner status-banner--error" role="alert">
                    <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                    <span>{{ RsvpError }}</span>
                </div>
            }

            <div class="meetings-list-host" data-testid="meetings-list-host">
                <bizapps-meeting-list
                    [Meetings]="FilteredMeetingRows"
                    [IsLoading]="IsLoading"
                    [SelectedID]="SelectedMeeting?.ID ?? null"
                    [ShowResponse]="true"
                    [ResponseBusyID]="RsvpBusyMeetingId"
                    [Order]="FilterMode === 'past' ? 'desc' : 'asc'"
                    [EmptyTitle]="EmptyStateTitle"
                    [EmptyMessage]="EmptyStateMessage"
                    (Selected)="onMeetingRowSelected($event)"
                    (OpenRequested)="onMeetingRowSelected($event)"
                    (ResponseChanged)="onListResponseChanged($event)"
                ></bizapps-meeting-list>
            </div>

            @if (FilteredMeetings.length > 0) {
                <div class="quick-chat-strip" aria-label="Meeting discussion threads">
                    <span class="strip-label">
                        <i class="fa-regular fa-comments" aria-hidden="true"></i>
                        Meeting discussions
                    </span>
                    <div class="strip-chips">
                        @for (m of FilteredMeetings; track m.ID) {
                            <div class="chat-chip-item" [class.private]="m.Visibility === 'Private'">
                                <button
                                    type="button"
                                    class="chat-chip-title"
                                    (click)="openMeetingDrawer(m)"
                                    [title]="'Inspect ' + m.Name"
                                >
                                    <span>{{ m.Name }}</span>
                                    @if (m.Visibility === 'Private') {
                                        <mjc-band-chip Band="Team" Label="Team" Size="sm"></mjc-band-chip>
                                    }
                                    @if (isChildSpaceMeeting(m) && m.SpaceName) {
                                        <span class="subspace-pill">
                                            <i class="fa-solid fa-folder-tree" aria-hidden="true"></i>
                                            {{ m.SpaceName }}
                                        </span>
                                    }
                                </button>
                                <button
                                    mjButton
                                    Variant="secondary"
                                    Size="sm"
                                    type="button"
                                    [attr.data-testid]="'meeting-chat-btn-' + m.ID"
                                    (click)="onOpenChatClick(m)"
                                >
                                    <i class="fa-regular fa-comments"></i>{{ m.SpaceChatID ? 'Open chat' : 'Start chat' }}
                                </button>
                            </div>
                        }
                    </div>
                </div>
            }

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
                                        [disabled]="IsSubmitting || EffectiveAllowedBands.length <= 1"
                                    >
                                        @if (allowsStandard) {
                                            <option value="Standard">Standard (Shared)</option>
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
                                        placeholder="https://meet.example.com/..."
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

            @if (SelectedMeeting; as selected) {
                <div
                    class="mjc-meeting-backdrop"
                    data-testid="meeting-drawer-backdrop"
                    (click)="onDrawerBackdropClick($event)"
                >
                    <section
                        class="mjc-meeting-sheet"
                        [class.is-maximized]="IsDrawerMaximized"
                        role="dialog"
                        aria-modal="true"
                        [attr.aria-label]="'Meeting details: ' + selected.Name"
                        data-testid="meeting-drawer-sheet"
                        (click)="$event.stopPropagation()"
                    >
                        <header class="drawer-topbar">
                            <div class="drawer-topbar-left">
                                <mjc-band-chip
                                    [Band]="bandOf(selected)"
                                    [Label]="selected.Visibility === 'Private' ? 'Team · Private' : 'Shared'"
                                    Size="sm"
                                ></mjc-band-chip>
                                @if (isChildSpaceMeeting(selected) && selected.SpaceName) {
                                    <span class="subspace-pill" data-testid="drawer-subspace-pill">
                                        <i class="fa-solid fa-folder-tree" aria-hidden="true"></i>
                                        {{ selected.SpaceName }}
                                    </span>
                                }
                                @if (IsLiveMode) {
                                    <span class="live-pill" data-testid="drawer-live-indicator">
                                        <i class="fa-solid fa-circle" aria-hidden="true"></i>
                                        Live Session
                                    </span>
                                }
                            </div>
                            <div class="drawer-topbar-actions">
                                <button
                                    mjButton
                                    Variant="secondary"
                                    Size="sm"
                                    type="button"
                                    data-testid="drawer-chat-btn"
                                    (click)="onOpenChatClick(selected)"
                                >
                                    <i class="fa-regular fa-comments"></i>{{ selected.SpaceChatID ? 'Open chat' : 'Start chat' }}
                                </button>
                                @if (CanToggleLiveRunner) {
                                    <button
                                        mjButton
                                        [Variant]="IsLiveMode ? 'secondary' : 'primary'"
                                        Size="sm"
                                        type="button"
                                        data-testid="drawer-live-toggle-btn"
                                        (click)="toggleLiveMode()"
                                    >
                                        <i [class]="IsLiveMode ? 'fa-solid fa-list' : 'fa-solid fa-gauge-high'"></i>
                                        {{ IsLiveMode ? 'Back to details' : 'Run live meeting' }}
                                    </button>
                                }
                                @if (CanShowOpenFormLink) {
                                    <button
                                        mjButton
                                        Variant="flat"
                                        Size="sm"
                                        type="button"
                                        data-testid="drawer-open-form-btn"
                                        (click)="OpenMeetingRequested.emit(selected)"
                                    >
                                        <i class="fa-solid fa-arrow-up-right-from-square"></i>Open form
                                    </button>
                                }
                                <button
                                    type="button"
                                    class="drawer-icon-btn"
                                    [attr.aria-label]="IsDrawerMaximized ? 'Restore drawer width' : 'Maximize drawer'"
                                    (click)="toggleDrawerMaximize()"
                                >
                                    <i [class]="IsDrawerMaximized ? 'fa-solid fa-compress' : 'fa-solid fa-expand'" aria-hidden="true"></i>
                                </button>
                                <button
                                    type="button"
                                    class="drawer-icon-btn"
                                    aria-label="Close meeting details"
                                    data-testid="drawer-close-btn"
                                    (click)="closeMeetingDrawer()"
                                >
                                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                                </button>
                            </div>
                        </header>

                        <div class="drawer-body">
                            @if (IsDetailLoading && !DetailBundle) {
                                <div class="drawer-loading">Loading meeting workspace…</div>
                            } @else if (DetailError && !DetailBundle) {
                                <div class="status-banner status-banner--error" role="alert">
                                    <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                                    <span>{{ DetailError }}</span>
                                </div>
                            } @else if (DetailBundle; as bundle) {
                                @if (DetailError) {
                                    <div class="status-banner status-banner--error" role="alert">
                                        <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                                        <span>{{ DetailError }}</span>
                                    </div>
                                }

                                @if (IsLiveMode && DrawerPermissions.canRun) {
                                    <bizapps-meeting-live
                                        [Meeting]="bundle.MeetingRow"
                                        [Items]="bundle.AgendaItems"
                                        [Attendees]="bundle.Attendees"
                                        [StartedAt]="bundle.ActualStartedAt ?? bundle.MeetingRow.startsAt"
                                        [CanRun]="DrawerPermissions.canRun"
                                        [Busy]="DrawerBusy"
                                        [ErrorMessage]="LiveError"
                                        (ItemChanged)="onLiveItemChanged($event)"
                                        (AttendanceChanged)="onLiveAttendanceChanged($event)"
                                        (NoteRequested)="onLiveNoteRequested($event)"
                                        (FollowUpRequested)="onLiveFollowUpRequested($event)"
                                        (EndRequested)="onEndMeetingRequested()"
                                        (CloseRequested)="exitLiveMode()"
                                    ></bizapps-meeting-live>
                                } @else {
                                    <bizapps-meeting-header
                                        [Meeting]="bundle.MeetingRow"
                                        [Permissions]="DrawerPermissions"
                                        [CancellationReason]="bundle.CancellationReason"
                                        [Busy]="DrawerBusy"
                                        (StartRequested)="onStartMeetingRequested()"
                                        (RunRequested)="enterLiveMode()"
                                        (EndRequested)="onEndMeetingRequested()"
                                        (CancelRequested)="onCancelMeetingRequested()"
                                        (CalendarFileRequested)="onCalendarFileRequested(bundle.Meeting)"
                                        (ResponseChanged)="onDrawerResponseChanged($event)"
                                    ></bizapps-meeting-header>

                                    @if (bundle.Meeting.Description) {
                                        <div class="meeting-description-card">
                                            <div class="desc-label">Purpose</div>
                                            <p class="desc-body">{{ bundle.Meeting.Description }}</p>
                                        </div>
                                    }

                                    <nav class="drawer-sections-nav" aria-label="Meeting workspace sections">
                                        <button
                                            type="button"
                                            class="sec-pill"
                                            [class.active]="DrawerSection === 'all'"
                                            (click)="setDrawerSection('all')"
                                        >
                                            All
                                        </button>
                                        <button
                                            type="button"
                                            class="sec-pill"
                                            [class.active]="DrawerSection === 'agenda'"
                                            (click)="setDrawerSection('agenda')"
                                        >
                                            Agenda ({{ bundle.AgendaItems.length }})
                                        </button>
                                        <button
                                            type="button"
                                            class="sec-pill"
                                            [class.active]="DrawerSection === 'people'"
                                            (click)="setDrawerSection('people')"
                                        >
                                            People ({{ bundle.Attendees.length }})
                                        </button>
                                        <button
                                            type="button"
                                            class="sec-pill"
                                            [class.active]="DrawerSection === 'notes'"
                                            (click)="setDrawerSection('notes')"
                                        >
                                            Notes ({{ bundle.Notes.length }})
                                        </button>
                                        <button
                                            type="button"
                                            class="sec-pill"
                                            [class.active]="DrawerSection === 'followups'"
                                            (click)="setDrawerSection('followups')"
                                        >
                                            Follow-ups ({{ bundle.FollowUps.length }})
                                        </button>
                                    </nav>

                                    @if (DrawerSection === 'all' || DrawerSection === 'agenda') {
                                        <section class="drawer-section-card" data-testid="drawer-section-agenda">
                                            <bizapps-meeting-agenda
                                                [Items]="bundle.AgendaItems"
                                                [ItemTypes]="bundle.AgendaItemTypes"
                                                [People]="bundle.People"
                                                [MeetingMinutes]="meetingDurationMinutes(bundle.Meeting)"
                                                [CanEdit]="DrawerPermissions.canEdit"
                                                [Busy]="DrawerBusy"
                                                [ErrorMessage]="AgendaError"
                                                (SaveRequested)="onAgendaSaveRequested($event)"
                                                (RemoveRequested)="onAgendaRemoveRequested($event)"
                                                (ReorderRequested)="onAgendaReorderRequested($event)"
                                                (MoveRequested)="onAgendaMoveRequested($event)"
                                            ></bizapps-meeting-agenda>
                                        </section>
                                    }

                                    @if (DrawerSection === 'all' || DrawerSection === 'people') {
                                        <section class="drawer-section-card" data-testid="drawer-section-people">
                                            <bizapps-meeting-people
                                                [Attendees]="bundle.Attendees"
                                                [People]="bundle.People"
                                                [CanInvite]="DrawerPermissions.canInvite"
                                                [CanMarkAttendance]="DrawerPermissions.canRun"
                                                [ShowAttendance]="CanSeeTeamSide"
                                                [Busy]="DrawerBusy"
                                                [ErrorMessage]="PeopleError"
                                                (InviteRequested)="onInviteAttendeeRequested($event)"
                                                (RemoveRequested)="onRemoveAttendeeRequested($event)"
                                                (AttendanceChanged)="onAttendanceChanged($event)"
                                            ></bizapps-meeting-people>
                                        </section>
                                    }

                                    @if (DrawerSection === 'all' || DrawerSection === 'notes') {
                                        <section class="drawer-section-card" data-testid="drawer-section-notes">
                                            <bizapps-meeting-notes
                                                [Notes]="bundle.Notes"
                                                [AgendaItems]="bundle.AgendaItems"
                                                [People]="bundle.People"
                                                [CanWrite]="DrawerPermissions.canWriteNotes"
                                                [CanEditAll]="DrawerPermissions.canRun"
                                                [Busy]="DrawerBusy"
                                                [ErrorMessage]="NotesError"
                                                (SaveRequested)="onNoteSaveRequested($event)"
                                                (DeleteRequested)="onNoteDeleteRequested($event)"
                                                (OpenTaskRequested)="OpenTaskRequested.emit($event)"
                                            ></bizapps-meeting-notes>
                                        </section>
                                    }

                                    @if (DrawerSection === 'all' || DrawerSection === 'followups') {
                                        <section class="drawer-section-card" data-testid="drawer-section-followups">
                                            <bizapps-meeting-followups
                                                [FollowUps]="bundle.FollowUps"
                                                [AgendaItems]="bundle.AgendaItems"
                                                [People]="bundle.People"
                                                [CanAdd]="DrawerPermissions.canAddFollowUps"
                                                [Busy]="DrawerBusy"
                                                [ErrorMessage]="FollowUpsError"
                                                (AddRequested)="onFollowUpAddRequested($event)"
                                                (OpenRequested)="onFollowUpOpenRequested($event)"
                                            ></bizapps-meeting-followups>
                                        </section>
                                    }
                                }
                            }
                        </div>
                    </section>
                </div>
            }
        </div>
    `,
    styles: [
        COLLAB_TOKENS_CSS,
        `
            :host {
                display: block;
                color: var(--mj-text-primary);
                font-family: var(--mj-font-family, Inter, sans-serif);
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
                flex-wrap: wrap;
            }
            .head-copy {
                min-width: 0;
            }
            .head-actions {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .subspace-toggle {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 10px;
                border-radius: 999px;
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-card);
                color: var(--mj-text-secondary);
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                user-select: none;
            }
            .subspace-toggle:hover {
                border-color: var(--mj-border-strong);
                color: var(--mj-text-primary);
            }
            .meetings-toolbar {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .seg-group {
                display: inline-flex;
                background: var(--mj-bg-surface-sunken);
                border: 1px solid var(--mj-border-default);
                border-radius: 8px;
                padding: 2px;
                gap: 2px;
            }
            .seg-btn {
                border: 0;
                background: transparent;
                color: var(--mj-text-secondary);
                font: inherit;
                font-size: 12.5px;
                font-weight: 600;
                padding: 5px 11px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.12s ease, color 0.12s ease;
            }
            .seg-btn:hover {
                color: var(--mj-text-primary);
            }
            .seg-btn.active {
                background: var(--mj-bg-surface-card);
                color: var(--mj-brand-primary);
                box-shadow: var(--mj-shadow-sm);
            }
            .band-filter {
                display: inline-flex;
                align-items: center;
                gap: 6px;
            }
            .pill-btn {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-card);
                color: var(--mj-text-secondary);
                border-radius: 999px;
                padding: 3px 9px;
                font: inherit;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
            }
            .pill-btn.active {
                border-color: var(--mj-brand-primary);
                background: var(--mj-bg-surface-hover);
                color: var(--mj-text-primary);
            }
            .search-wrap {
                position: relative;
                flex: 1 1 220px;
                max-width: 340px;
                margin-left: auto;
            }
            .search-icon {
                position: absolute;
                left: 10px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--mj-text-muted);
                font-size: 12.5px;
                pointer-events: none;
            }
            .search-input {
                width: 100%;
                box-sizing: border-box;
                padding: 6px 10px 6px 30px;
                border-radius: 8px;
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface);
                color: var(--mj-text-primary);
                font: inherit;
                font-size: 13px;
            }
            .search-input:focus {
                outline: 2px solid var(--mj-brand-primary);
                outline-offset: -1px;
            }
            .room-filter-bar {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .room-pill {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-card);
                color: var(--mj-text-secondary);
                border-radius: 999px;
                padding: 3px 10px;
                font: inherit;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
            }
            .room-pill.active {
                border-color: var(--mj-brand-primary);
                color: var(--mj-brand-primary);
                background: var(--mj-bg-surface-hover);
            }
            .room-count {
                font-size: 11px;
                color: var(--mj-text-muted);
            }
            .subspace-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 999px;
                background: var(--mj-bg-surface-sunken);
                border: 1px solid var(--mj-border-default);
                color: var(--mj-text-secondary);
            }
            .quick-chat-strip {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 12px 14px;
                border-radius: 10px;
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-sunken);
            }
            .strip-label {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 11.5px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: var(--mj-text-muted);
            }
            .strip-chips {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .chat-chip-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 7px 10px;
                border-radius: 8px;
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-card);
                flex-wrap: wrap;
            }
            .chat-chip-item.private {
                border-left: 3px solid var(--mjc-team);
            }
            .chat-chip-title {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                border: 0;
                background: transparent;
                color: var(--mj-text-primary);
                font: inherit;
                font-size: 13px;
                font-weight: 600;
                padding: 0;
                cursor: pointer;
                text-align: left;
            }
            .chat-chip-title:hover {
                color: var(--mj-brand-primary);
            }
            .fw7 {
                font-weight: 700;
            }
            .fs15 {
                font-size: 15px;
            }
            .fs12 {
                font-size: 12px;
            }
            .muted {
                color: var(--mj-text-muted);
            }
            .status-banner {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 10px 12px;
                border-radius: 8px;
                font-size: 13px;
            }
            .status-banner--error {
                color: var(--mj-status-error-text);
                background: var(--mj-status-error-bg);
                border: 1px solid var(--mj-status-error-border);
            }
            .schedule-modal {
                color: var(--mj-text-primary);
                font-family: var(--mj-font-family, Inter, sans-serif);
                font-size: 14px;
            }
            .d-sub {
                margin: 0 0 14px;
                font-size: 13px;
                color: var(--mj-text-secondary);
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
                color: var(--mj-text-primary);
            }
            .f-input {
                border: 1px solid var(--mj-border-default);
                border-radius: 8px;
                background: var(--mj-bg-surface);
                padding: 8px 12px;
                font: inherit;
                font-size: 13px;
                color: var(--mj-text-primary);
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
                color: var(--mj-status-error-text);
                background: var(--mj-status-error-bg);
                border: 1px solid var(--mj-status-error-border);
            }
            .mjc-meeting-backdrop {
                position: fixed;
                inset: 0;
                z-index: var(--mj-z-drawer, 1000);
                background: var(
                    --mj-bg-overlay,
                    color-mix(in srgb, var(--mj-text-primary) 50%, transparent)
                );
                display: flex;
                justify-content: flex-end;
                align-items: stretch;
                animation: mjc-meeting-fade 0.16s ease-out;
            }
            .mjc-meeting-sheet {
                position: relative;
                z-index: calc(var(--mj-z-drawer, 1000) + 1);
                width: min(880px, 76vw);
                max-width: 100vw;
                height: 100%;
                display: flex;
                flex-direction: column;
                min-width: 0;
                min-height: 0;
                overflow: hidden;
                background: var(--mj-bg-surface);
                color: var(--mj-text-primary);
                border-left: 1px solid var(--mj-border-default);
                box-shadow: var(--mj-shadow-2xl);
                transition: width 0.18s ease;
                animation: mjc-meeting-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .mjc-meeting-sheet.is-maximized {
                width: 100vw;
                border-left: none;
            }
            .drawer-topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 12px 18px;
                border-bottom: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-card);
                flex-wrap: wrap;
                flex-shrink: 0;
            }
            .drawer-topbar-left,
            .drawer-topbar-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .live-pill {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                font-size: 11.5px;
                font-weight: 700;
                padding: 2px 9px;
                border-radius: 999px;
                background: var(--mj-status-error-bg);
                color: var(--mj-status-error-text);
                border: 1px solid var(--mj-status-error-border);
            }
            .live-pill i {
                font-size: 8px;
            }
            .drawer-icon-btn {
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface);
                color: var(--mj-text-secondary);
                width: 30px;
                height: 30px;
                border-radius: 6px;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .drawer-icon-btn:hover {
                background: var(--mj-bg-surface-hover);
                color: var(--mj-text-primary);
            }
            .drawer-body {
                flex: 1 1 auto;
                overflow-y: auto;
                padding: 16px 18px 28px;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .drawer-loading {
                padding: 32px 16px;
                text-align: center;
                color: var(--mj-text-muted);
                font-size: 13px;
            }
            .meeting-description-card {
                padding: 12px 14px;
                border-radius: 10px;
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-sunken);
            }
            .desc-label {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: var(--mj-text-muted);
                margin-bottom: 4px;
            }
            .desc-body {
                margin: 0;
                font-size: 13.5px;
                line-height: 1.5;
                color: var(--mj-text-primary);
                white-space: pre-wrap;
            }
            .drawer-sections-nav {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .sec-pill {
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-card);
                color: var(--mj-text-secondary);
                border-radius: 999px;
                padding: 4px 12px;
                font: inherit;
                font-size: 12.5px;
                font-weight: 600;
                cursor: pointer;
            }
            .sec-pill.active {
                border-color: var(--mj-brand-primary);
                background: var(--mj-bg-surface-hover);
                color: var(--mj-brand-primary);
            }
            .drawer-section-card {
                padding: 14px 16px;
                border-radius: 10px;
                border: 1px solid var(--mj-border-default);
                background: var(--mj-bg-surface-card);
            }
            @media (max-width: 768px) {
                .mjc-meeting-sheet {
                    width: 100vw;
                    border-left: none;
                }
                .form-row {
                    grid-template-columns: 1fr;
                }
            }
            @keyframes mjc-meeting-fade {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            @keyframes mjc-meeting-enter {
                from {
                    transform: translateX(24px);
                    opacity: 0.96;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `,
    ],
})
export class SpaceMeetingsTabComponent extends BaseSpaceTab implements OnChanges {
    @Input() public Title = 'Meetings';
    @Input() public Subtitle = 'Agendas, live sessions, notes, and follow-up discussions in this space';
    @Input() public SpaceName = '';
    @Input() public CanSchedule = false;
    @Input() public CanSeeTeamSide = false;
    @Input() public IncludeSubSpaces = true;
    @Input() public ShowOpenFormButton = false;
    @Input() public CurrentUserId = '';
    @Input() public DefaultBand: 'Shared' | 'Team' = 'Shared';
    @Input() public AllowedBands: readonly ('Shared' | 'Team')[] = ['Shared', 'Team'];
    @Input() public IsLoading = false;
    @Input() public Meetings: SpaceMeetingCardItem[] = [];

    @Output() public ScheduleMeetingRequested = new EventEmitter<string>();
    @Output() public CreateMeetingRequested = new EventEmitter<NewSpaceMeetingDraft>();
    @Output() public OpenMeetingRequested = new EventEmitter<SpaceMeetingCardItem>();
    @Output() public OpenMeetingChatRequested = new EventEmitter<SpaceMeetingCardItem>();
    @Output() public OpenTaskRequested = new EventEmitter<string>();

    public FilterMode: SpaceMeetingsFilterMode = 'upcoming';
    public BandFilter: SpaceMeetingsBandFilter = 'all';
    public SearchQuery = '';
    public ActiveRoomFilterId: string | null = null;
    public ChildSpaces: SpaceChildSummary[] = [];

    public IsScheduleDialogOpen = false;
    public IsSubmitting = false;
    public ScheduleError = '';
    public Draft: NewSpaceMeetingDraft = createDefaultSpaceMeetingDraft();

    public RsvpBusyMeetingId: string | null = null;
    public RsvpError = '';

    public SelectedMeeting: SpaceMeetingCardItem | null = null;
    public DetailBundle: SpaceMeetingDetailBundle | null = null;
    public IsDetailLoading = false;
    public IsDrawerMaximized = false;
    public IsLiveMode = false;
    public DrawerSection: MeetingDrawerSection = 'all';
    public DrawerBusy = false;
    public DetailError = '';
    public AgendaError = '';
    public PeopleError = '';
    public NotesError = '';
    public FollowUpsError = '';
    public LiveError = '';

    private hasExplicitMeetings = false;
    private loadToken = 0;
    private detailToken = 0;

    constructor(@Optional() @Inject(ChangeDetectorRef) private readonly cdr?: ChangeDetectorRef) {
        super();
    }

    public get dialogTitle(): string {
        const name = this.SpaceName?.trim();
        return name ? `Schedule meeting in ${name}` : 'Schedule meeting';
    }

    public get EffectiveAllowedBands(): readonly ('Shared' | 'Team')[] {
        if (!this.CanSeeTeamSide) {
            return ['Shared'];
        }
        return this.AllowedBands.length > 0 ? this.AllowedBands : ['Shared', 'Team'];
    }

    public get allowsStandard(): boolean {
        return this.EffectiveAllowedBands.includes('Shared');
    }

    public get allowsPrivate(): boolean {
        return this.CanSeeTeamSide && this.EffectiveAllowedBands.includes('Team');
    }

    public get VisibleMeetings(): SpaceMeetingCardItem[] {
        return filterSpaceMeetings(this.Meetings, {
            CanSeeTeamSide: this.CanSeeTeamSide,
            FilterMode: 'all',
        });
    }

    public get UpcomingMeetings(): SpaceMeetingCardItem[] {
        return filterSpaceMeetings(this.Meetings, {
            CanSeeTeamSide: this.CanSeeTeamSide,
            FilterMode: 'upcoming',
        });
    }

    public get PastMeetings(): SpaceMeetingCardItem[] {
        return filterSpaceMeetings(this.Meetings, {
            CanSeeTeamSide: this.CanSeeTeamSide,
            FilterMode: 'past',
        });
    }

    public get HasPrivateMeetings(): boolean {
        return this.CanSeeTeamSide && this.VisibleMeetings.some((m) => m.Visibility === 'Private');
    }

    public get FilteredMeetings(): SpaceMeetingCardItem[] {
        return filterSpaceMeetings(this.Meetings, {
            CanSeeTeamSide: this.CanSeeTeamSide,
            FilterMode: this.FilterMode,
            BandFilter: this.CanSeeTeamSide ? this.BandFilter : 'all',
            SearchQuery: this.SearchQuery,
            SpaceFilterId: this.ActiveRoomFilterId,
        });
    }

    public get FilteredMeetingRows(): MeetingRow[] {
        return this.FilteredMeetings.map((m) => toMeetingRow(m, this.SpaceId));
    }

    public get SubSpaceFilterOptions(): Array<{ id: string; name: string; count: number; isChild: boolean }> {
        const counts = new Map<string, { id: string; name: string; count: number; isChild: boolean }>();
        const rootLower = (this.SpaceId ?? '').trim().toLowerCase();
        for (const m of this.VisibleMeetings) {
            const sid = (m.SpaceID ?? this.SpaceId ?? '').trim();
            if (!sid) continue;
            const key = sid.toLowerCase();
            const isChild = Boolean(rootLower) && key !== rootLower;
            const label = isChild
                ? m.SpaceName || 'Sub-space'
                : this.SpaceName?.trim() || 'This space';
            const existing = counts.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                counts.set(key, { id: sid, name: label, count: 1, isChild });
            }
        }
        return [...counts.values()].sort((a, b) =>
            a.isChild === b.isChild ? a.name.localeCompare(b.name) : a.isChild ? 1 : -1,
        );
    }

    public get EmptyStateTitle(): string {
        if (this.SearchQuery.trim()) return 'No matching meetings';
        if (this.FilterMode === 'upcoming') return 'No upcoming meetings';
        if (this.FilterMode === 'past') return 'No past meetings';
        return 'No meetings scheduled';
    }

    public get EmptyStateMessage(): string {
        if (this.SearchQuery.trim()) {
            return 'Try clearing your search or switching the timeframe filter.';
        }
        return 'Meetings linked to this space will appear here with their agendas, notes, and discussions.';
    }

    public get DrawerPermissions(): MeetingPermissions {
        return computeMeetingPermissions({
            CanSeeTeamSide: this.CanSeeTeamSide,
            CanSchedule: this.CanSchedule,
            IsOrganizer: this.SelectedMeeting?.IsMine,
        });
    }

    public get CanToggleLiveRunner(): boolean {
        const s = this.SelectedMeeting?.Status;
        return this.DrawerPermissions.canRun && s !== 'Cancelled' && s !== 'Completed';
    }

    public get CanShowOpenFormLink(): boolean {
        return (
            this.CanSeeTeamSide &&
            (this.ShowOpenFormButton || this.OpenMeetingRequested.observed)
        );
    }

    public bandOf(meeting: SpaceMeetingCardItem): 'Shared' | 'Team' {
        return meetingVisibilityToSpaceBand(meeting.Visibility);
    }

    public isChildSpaceMeeting(meeting: SpaceMeetingCardItem): boolean {
        const rootLower = (this.SpaceId ?? '').trim().toLowerCase();
        const meetingSpaceLower = (meeting.SpaceID ?? '').trim().toLowerCase();
        return Boolean(rootLower && meetingSpaceLower && rootLower !== meetingSpaceLower);
    }

    public meetingDurationMinutes(meeting: SpaceMeetingCardItem): number | null {
        const s = new Date(meeting.StartsAt).getTime();
        const e = new Date(meeting.EndsAt).getTime();
        if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
        return Math.round((e - s) / 60000);
    }

    private startVisibility(): 'Standard' | 'Private' {
        if (!this.CanSeeTeamSide) return 'Standard';
        const allowed = this.EffectiveAllowedBands;
        const startBand = allowed.includes(this.DefaultBand)
            ? this.DefaultBand
            : (allowed[0] ?? 'Shared');
        return startBand === 'Team' ? 'Private' : 'Standard';
    }

    public setFilterMode(mode: SpaceMeetingsFilterMode): void {
        this.FilterMode = mode;
        this.cdr?.markForCheck();
    }

    public setBandFilter(band: SpaceMeetingsBandFilter): void {
        this.BandFilter = band;
        this.cdr?.markForCheck();
    }

    public setRoomFilter(spaceId: string | null): void {
        this.ActiveRoomFilterId = spaceId;
        this.cdr?.markForCheck();
    }

    public onSearchChange(): void {
        this.cdr?.markForCheck();
    }

    public onToggleIncludeSubSpaces(event: Event): void {
        const target = event.target as HTMLInputElement | null;
        this.IncludeSubSpaces = Boolean(target?.checked);
        this.ActiveRoomFilterId = null;
        if (!this.hasExplicitMeetings && this.SpaceId) {
            void this.loadForSpace(this.SpaceId);
        } else {
            this.cdr?.markForCheck();
        }
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
        const visibility: 'Standard' | 'Private' =
            !this.CanSeeTeamSide || !this.allowsPrivate ? 'Standard' : this.Draft.Visibility;
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
            Visibility: visibility,
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
            this.autoSelectInitialFilterMode();
        }
        if ((changes['SpaceId'] || changes['IncludeSubSpaces']) && !this.hasExplicitMeetings) {
            this.ActiveRoomFilterId = null;
            this.closeMeetingDrawer();
            void this.loadForSpace(this.SpaceId);
        }
        if (changes['CanSeeTeamSide'] && !this.CanSeeTeamSide) {
            this.BandFilter = 'all';
            if (this.SelectedMeeting?.Visibility === 'Private') {
                this.closeMeetingDrawer();
            }
            if (this.IsLiveMode) {
                this.IsLiveMode = false;
            }
        }
    }

    public async loadForSpace(spaceId: string): Promise<void> {
        const cleanId = (spaceId ?? '').trim();
        if (!cleanId) {
            this.Meetings = [];
            this.ChildSpaces = [];
            this.cdr?.markForCheck();
            return;
        }
        const token = ++this.loadToken;
        this.IsLoading = true;
        this.RsvpError = '';
        this.cdr?.markForCheck();
        try {
            const loaded = await loadSpaceMeetingsWithRollup(cleanId, this.RunViewToUse, {
                IncludeSubSpaces: this.IncludeSubSpaces,
                CurrentUserId: this.effectiveUserId(),
                CanSeeTeamSide: this.CanSeeTeamSide,
                RootSpaceName: this.SpaceName,
            });
            if (token !== this.loadToken) return;
            this.Meetings = loaded.Meetings;
            this.ChildSpaces = loaded.ChildSpaces;
            this.autoSelectInitialFilterMode();
        } finally {
            if (token === this.loadToken) {
                this.IsLoading = false;
                this.cdr?.markForCheck();
            }
        }
    }

    private autoSelectInitialFilterMode(): void {
        if (
            this.FilterMode === 'upcoming' &&
            this.UpcomingMeetings.length === 0 &&
            this.PastMeetings.length > 0
        ) {
            this.FilterMode = 'all';
        }
    }

    private effectiveUserId(): string {
        return (this.CurrentUserId || Metadata.Provider?.CurrentUser?.ID || '').trim();
    }

    private effectiveMetadataProvider(): IMetadataProvider | null {
        const prov = this.ProviderToUse as IMetadataProvider | null | undefined;
        return prov ?? Metadata.Provider ?? null;
    }

    public onMeetingRowSelected(row: MeetingRow): void {
        const card = this.VisibleMeetings.find((m) => m.ID.toLowerCase() === row.id.toLowerCase());
        if (!card) return;
        this.openMeetingDrawer(card);
    }

    public openMeetingDrawer(meeting: SpaceMeetingCardItem): void {
        if (!this.CanSeeTeamSide && meeting.Visibility === 'Private') {
            return;
        }
        this.SelectedMeeting = meeting;
        this.IsLiveMode = false;
        this.DrawerSection = 'all';
        this.clearDrawerErrors();
        this.DetailBundle = {
            Meeting: meeting,
            MeetingRow: toMeetingRow(meeting, this.SpaceId),
            AgendaItems: [],
            AgendaItemTypes: [],
            Attendees: [],
            Notes: [],
            FollowUps: [],
            People: [],
            CancellationReason: meeting.CancellationReason ?? null,
            ActualStartedAt: meeting.ActualStartedAt ? new Date(meeting.ActualStartedAt) : null,
        };
        this.cdr?.markForCheck();
        void this.refreshMeetingDetail(meeting);
    }

    public closeMeetingDrawer(): void {
        this.detailToken += 1;
        this.SelectedMeeting = null;
        this.DetailBundle = null;
        this.IsDetailLoading = false;
        this.IsDrawerMaximized = false;
        this.IsLiveMode = false;
        this.DrawerBusy = false;
        this.clearDrawerErrors();
        this.cdr?.markForCheck();
    }

    @HostListener('document:keydown.escape', ['$event'])
    public onEscapeKey(event: Event): void {
        if (!this.SelectedMeeting || this.IsScheduleDialogOpen) return;
        event.stopPropagation();
        this.closeMeetingDrawer();
    }

    public onDrawerBackdropClick(event: MouseEvent): void {
        if (event.target === event.currentTarget) {
            this.closeMeetingDrawer();
        }
    }

    public toggleDrawerMaximize(): void {
        this.IsDrawerMaximized = !this.IsDrawerMaximized;
        this.cdr?.markForCheck();
    }

    public setDrawerSection(section: MeetingDrawerSection): void {
        this.DrawerSection = section;
        this.cdr?.markForCheck();
    }

    public toggleLiveMode(): void {
        if (!this.CanToggleLiveRunner) return;
        this.IsLiveMode = !this.IsLiveMode;
        this.LiveError = '';
        this.cdr?.markForCheck();
    }

    public enterLiveMode(): void {
        if (!this.CanToggleLiveRunner) return;
        this.IsLiveMode = true;
        this.LiveError = '';
        this.cdr?.markForCheck();
    }

    public exitLiveMode(): void {
        this.IsLiveMode = false;
        this.LiveError = '';
        this.cdr?.markForCheck();
    }

    public onOpenChatClick(meeting: SpaceMeetingCardItem): void {
        this.OpenMeetingChatRequested.emit(meeting);
    }

    private clearDrawerErrors(): void {
        this.DetailError = '';
        this.AgendaError = '';
        this.PeopleError = '';
        this.NotesError = '';
        this.FollowUpsError = '';
        this.LiveError = '';
    }

    public async refreshMeetingDetail(meeting: SpaceMeetingCardItem): Promise<void> {
        const token = ++this.detailToken;
        this.IsDetailLoading = true;
        this.cdr?.markForCheck();
        try {
            const bundle = await loadSpaceMeetingDetail(meeting, this.RunViewToUse, {
                CurrentUserId: this.effectiveUserId(),
                CanSeeTeamSide: this.CanSeeTeamSide,
                RootSpaceId: this.SpaceId,
            });
            if (token !== this.detailToken) return;
            this.DetailBundle = bundle;
            this.SelectedMeeting = bundle.Meeting;
            this.patchLocalMeeting(bundle.Meeting);
        } catch (err) {
            if (token !== this.detailToken) return;
            this.DetailError =
                err instanceof Error ? err.message : 'Unable to load meeting details.';
        } finally {
            if (token === this.detailToken) {
                this.IsDetailLoading = false;
                this.cdr?.markForCheck();
            }
        }
    }

    private patchLocalMeeting(updated: SpaceMeetingCardItem): void {
        this.Meetings = this.Meetings.map((m) =>
            m.ID.toLowerCase() === updated.ID.toLowerCase() ? { ...m, ...updated } : m,
        );
    }

    public async onListResponseChanged(change: MeetingResponseChange): Promise<void> {
        const card = this.Meetings.find(
            (m) => m.ID.toLowerCase() === change.meeting.id.toLowerCase(),
        );
        if (!card?.MyAttendeeID) {
            this.RsvpError = 'Could not locate your attendee invitation for this meeting.';
            this.cdr?.markForCheck();
            return;
        }
        await this.persistRsvp(card, change.response);
    }

    public async onDrawerResponseChanged(response: ResponseStatus): Promise<void> {
        if (!this.SelectedMeeting?.MyAttendeeID) {
            this.DetailError = 'Could not locate your attendee invitation for this meeting.';
            this.cdr?.markForCheck();
            return;
        }
        await this.persistRsvp(this.SelectedMeeting, response);
    }

    private async persistRsvp(
        meeting: SpaceMeetingCardItem,
        response: ResponseStatus,
    ): Promise<void> {
        if (!meeting.MyAttendeeID) return;
        this.RsvpBusyMeetingId = meeting.ID;
        this.DrawerBusy = true;
        this.RsvpError = '';
        this.DetailError = '';
        this.cdr?.markForCheck();
        try {
            const res = await saveAttendeeResponse(
                meeting.MyAttendeeID,
                response,
                this.effectiveMetadataProvider(),
            );
            if (!res.ok) {
                this.RsvpError = res.error ?? 'Could not save your RSVP.';
                this.DetailError = this.RsvpError;
                return;
            }
            const nextCard: SpaceMeetingCardItem = { ...meeting, MyResponse: response };
            this.patchLocalMeeting(nextCard);
            if (this.SelectedMeeting?.ID.toLowerCase() === meeting.ID.toLowerCase()) {
                this.SelectedMeeting = nextCard;
                if (this.DetailBundle) {
                    this.DetailBundle = {
                        ...this.DetailBundle,
                        Meeting: nextCard,
                        MeetingRow: toMeetingRow(nextCard, this.SpaceId),
                        Attendees: this.DetailBundle.Attendees.map((a) =>
                            a.id.toLowerCase() === meeting.MyAttendeeID?.toLowerCase()
                                ? { ...a, responseStatus: response }
                                : a,
                        ),
                    };
                }
            }
        } catch (err) {
            this.RsvpError = err instanceof Error ? err.message : 'Could not save your RSVP.';
            this.DetailError = this.RsvpError;
        } finally {
            this.RsvpBusyMeetingId = null;
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onStartMeetingRequested(): Promise<void> {
        if (!this.SelectedMeeting || !this.DrawerPermissions.canRun) return;
        await this.transitionMeetingStatus('InProgress', true);
    }

    public async onEndMeetingRequested(): Promise<void> {
        if (!this.SelectedMeeting || !this.DrawerPermissions.canRun) return;
        await this.transitionMeetingStatus('Completed', false);
    }

    public async onCancelMeetingRequested(): Promise<void> {
        if (!this.SelectedMeeting || !this.DrawerPermissions.canRun) return;
        await this.transitionMeetingStatus('Cancelled', false);
    }

    private async transitionMeetingStatus(
        nextStatus: 'InProgress' | 'Completed' | 'Cancelled',
        openLiveAfter: boolean,
    ): Promise<void> {
        const meeting = this.SelectedMeeting;
        if (!meeting) return;
        this.DrawerBusy = true;
        this.DetailError = '';
        this.LiveError = '';
        this.cdr?.markForCheck();
        try {
            const res = await saveMeetingStatusTransition(
                meeting.ID,
                nextStatus,
                this.effectiveMetadataProvider(),
            );
            if (!res.ok) {
                this.DetailError = res.error ?? 'Could not update meeting status.';
                this.LiveError = this.DetailError;
                return;
            }
            const updated: SpaceMeetingCardItem = {
                ...meeting,
                Status: nextStatus,
                ActualStartedAt:
                    nextStatus === 'InProgress' && !meeting.ActualStartedAt
                        ? new Date().toISOString()
                        : meeting.ActualStartedAt,
            };
            this.SelectedMeeting = updated;
            this.patchLocalMeeting(updated);
            if (openLiveAfter) {
                this.IsLiveMode = true;
            } else if (nextStatus === 'Completed' || nextStatus === 'Cancelled') {
                this.IsLiveMode = false;
            }
            await this.refreshMeetingDetail(updated);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public onCalendarFileRequested(meeting: SpaceMeetingCardItem): void {
        if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
            return;
        }
        const ics = buildMeetingIcsContent(meeting);
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const slug = (meeting.Name || 'meeting')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug || 'meeting'}.ics`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    public async onAgendaSaveRequested(draft: AgendaItemDraft): Promise<void> {
        const meeting = this.SelectedMeeting;
        if (!meeting || !this.DrawerPermissions.canEdit) return;
        this.DrawerBusy = true;
        this.AgendaError = '';
        this.cdr?.markForCheck();
        try {
            const maxSeq = (this.DetailBundle?.AgendaItems ?? []).reduce(
                (max, i) => Math.max(max, i.sequence),
                0,
            );
            const res = await saveAgendaItemDraft(
                meeting.ID,
                draft,
                maxSeq + 100,
                this.effectiveMetadataProvider(),
            );
            if (!res.ok) {
                this.AgendaError = res.error ?? 'Could not save agenda item.';
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onAgendaRemoveRequested(item: AgendaItemModel): Promise<void> {
        const meeting = this.SelectedMeeting;
        const md = this.effectiveMetadataProvider();
        if (!meeting || !md || !this.DrawerPermissions.canEdit) return;
        this.DrawerBusy = true;
        this.AgendaError = '';
        this.cdr?.markForCheck();
        try {
            const entity = await md.GetEntityObject<EditableAgendaItemEntity>(
                'MJ_BizApps_Tasks: Meeting Agenda Items',
            );
            if (!(await entity.Load(item.id)) || !(await entity.Delete())) {
                this.AgendaError =
                    entity.LatestResult?.CompleteMessage || 'Could not remove agenda item.';
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onAgendaReorderRequested(reorder: AgendaReorder): Promise<void> {
        const meeting = this.SelectedMeeting;
        const md = this.effectiveMetadataProvider();
        if (!meeting || !md || !this.DrawerPermissions.canEdit) return;
        this.DrawerBusy = true;
        this.AgendaError = '';
        this.cdr?.markForCheck();
        try {
            for (let idx = 0; idx < reorder.orderedIds.length; idx += 1) {
                const entity = await md.GetEntityObject<EditableAgendaItemEntity>(
                    'MJ_BizApps_Tasks: Meeting Agenda Items',
                );
                if (await entity.Load(reorder.orderedIds[idx])) {
                    entity.Sequence = (idx + 1) * 100;
                    await entity.Save();
                }
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onAgendaMoveRequested(move: AgendaMove): Promise<void> {
        const meeting = this.SelectedMeeting;
        const md = this.effectiveMetadataProvider();
        if (!meeting || !md || !this.DrawerPermissions.canEdit) return;
        this.DrawerBusy = true;
        this.AgendaError = '';
        this.cdr?.markForCheck();
        try {
            const entity = await md.GetEntityObject<EditableAgendaItemEntity>(
                'MJ_BizApps_Tasks: Meeting Agenda Items',
            );
            if (await entity.Load(move.item.id)) {
                entity.ParentID = move.parentId;
                await entity.Save();
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onInviteAttendeeRequested(req: InviteRequest): Promise<void> {
        const meeting = this.SelectedMeeting;
        const md = this.effectiveMetadataProvider();
        if (!meeting || !md || !this.DrawerPermissions.canInvite) return;
        this.DrawerBusy = true;
        this.PeopleError = '';
        this.cdr?.markForCheck();
        try {
            const entity = await md.GetEntityObject<EditableAttendeeEntity>(
                'MJ_BizApps_Tasks: Meeting Attendees',
            );
            entity.NewRecord();
            entity.MeetingID = meeting.ID;
            entity.PersonID = req.personId;
            entity.Email = req.email;
            entity.DisplayName = req.displayName;
            entity.Role = req.role;
            entity.ResponseStatus = 'None';
            entity.AttendanceStatus = 'Unknown';
            if (!(await entity.Save())) {
                this.PeopleError =
                    entity.LatestResult?.CompleteMessage || 'Could not invite attendee.';
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onRemoveAttendeeRequested(attendee: AttendeeModel): Promise<void> {
        const meeting = this.SelectedMeeting;
        const md = this.effectiveMetadataProvider();
        if (!meeting || !md || !this.DrawerPermissions.canInvite) return;
        this.DrawerBusy = true;
        this.PeopleError = '';
        this.cdr?.markForCheck();
        try {
            const entity = await md.GetEntityObject<EditableAttendeeEntity>(
                'MJ_BizApps_Tasks: Meeting Attendees',
            );
            if (!(await entity.Load(attendee.id)) || !(await entity.Delete())) {
                this.PeopleError =
                    entity.LatestResult?.CompleteMessage || 'Could not remove attendee.';
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onAttendanceChanged(change: AttendanceChange): Promise<void> {
        await this.persistAttendance(change.attendee, change.attendance);
    }

    public async onLiveAttendanceChanged(change: LiveAttendanceChange): Promise<void> {
        await this.persistAttendance(change.attendee, change.attendance);
    }

    private async persistAttendance(
        attendee: AttendeeModel,
        attendance: AttendanceChange['attendance'],
    ): Promise<void> {
        const meeting = this.SelectedMeeting;
        const md = this.effectiveMetadataProvider();
        if (!meeting || !md || !this.DrawerPermissions.canRun) return;
        this.DrawerBusy = true;
        this.PeopleError = '';
        this.LiveError = '';
        this.cdr?.markForCheck();
        try {
            const entity = await md.GetEntityObject<EditableAttendeeEntity>(
                'MJ_BizApps_Tasks: Meeting Attendees',
            );
            if (!(await entity.Load(attendee.id))) {
                this.PeopleError = 'Attendee could not be loaded.';
                this.LiveError = this.PeopleError;
                return;
            }
            entity.AttendanceStatus = attendance;
            if (!(await entity.Save())) {
                this.PeopleError =
                    entity.LatestResult?.CompleteMessage || 'Could not update attendance.';
                this.LiveError = this.PeopleError;
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onNoteSaveRequested(draft: NoteDraft): Promise<void> {
        const meeting = this.SelectedMeeting;
        if (!meeting || !this.DrawerPermissions.canWriteNotes) return;
        this.DrawerBusy = true;
        this.NotesError = '';
        this.cdr?.markForCheck();
        try {
            const authorPersonId = await resolveViewerPersonId(
                this.effectiveUserId(),
                this.RunViewToUse,
            );
            const res = await saveMeetingNoteDraft(
                meeting.ID,
                draft,
                authorPersonId,
                this.effectiveMetadataProvider(),
            );
            if (!res.ok) {
                this.NotesError = res.error ?? 'Could not save meeting note.';
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onNoteDeleteRequested(note: NoteModel): Promise<void> {
        const meeting = this.SelectedMeeting;
        const md = this.effectiveMetadataProvider();
        if (!meeting || !md || !this.DrawerPermissions.canWriteNotes) return;
        this.DrawerBusy = true;
        this.NotesError = '';
        this.cdr?.markForCheck();
        try {
            const entity = await md.GetEntityObject<EditableNoteEntity>(
                'MJ_BizApps_Tasks: Meeting Notes',
            );
            if (!(await entity.Load(note.id)) || !(await entity.Delete())) {
                this.NotesError =
                    entity.LatestResult?.CompleteMessage || 'Could not delete note.';
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onFollowUpAddRequested(draft: FollowUpDraft): Promise<void> {
        const meeting = this.SelectedMeeting;
        if (!meeting || !this.DrawerPermissions.canAddFollowUps) return;
        this.DrawerBusy = true;
        this.FollowUpsError = '';
        this.cdr?.markForCheck();
        try {
            const authorPersonId = await resolveViewerPersonId(
                this.effectiveUserId(),
                this.RunViewToUse,
            );
            const res = await saveMeetingFollowUpDraft(
                meeting.ID,
                draft,
                authorPersonId,
                this.effectiveMetadataProvider(),
            );
            if (!res.ok) {
                this.FollowUpsError = res.error ?? 'Could not create follow-up task.';
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public onFollowUpOpenRequested(task: FollowUpModel): void {
        if (task?.id) {
            this.OpenTaskRequested.emit(task.id);
        }
    }

    public async onLiveItemChanged(change: LiveItemChange): Promise<void> {
        const meeting = this.SelectedMeeting;
        if (!meeting || !this.DrawerPermissions.canRun) return;
        this.DrawerBusy = true;
        this.LiveError = '';
        this.cdr?.markForCheck();
        try {
            const res = await updateAgendaItemLiveState(
                change.item.id,
                change.status,
                change.outcome,
                this.effectiveMetadataProvider(),
            );
            if (!res.ok) {
                this.LiveError = res.error ?? 'Could not update agenda item.';
                return;
            }
            await this.refreshMeetingDetail(meeting);
        } finally {
            this.DrawerBusy = false;
            this.cdr?.markForCheck();
        }
    }

    public async onLiveNoteRequested(note: LiveQuickNote): Promise<void> {
        if (!this.SelectedMeeting || !this.DrawerPermissions.canWriteNotes) return;
        this.LiveError = '';
        await this.onNoteSaveRequested({
            id: null,
            agendaItemId: note.item?.id ?? null,
            kind: 'Notes',
            title: note.item ? `Note: ${note.item.name}` : 'Live note',
            body: note.body,
            status: 'Draft',
        });
        if (this.NotesError) {
            this.LiveError = this.NotesError;
            this.cdr?.markForCheck();
        }
    }

    public async onLiveFollowUpRequested(followUp: LiveFollowUp): Promise<void> {
        if (!this.SelectedMeeting || !this.DrawerPermissions.canAddFollowUps) return;
        this.LiveError = '';
        await this.onFollowUpAddRequested({
            name: followUp.name,
            agendaItemId: followUp.item?.id ?? null,
            assigneePersonId: null,
            dueAt: null,
        });
        if (this.FollowUpsError) {
            this.LiveError = this.FollowUpsError;
            this.cdr?.markForCheck();
        }
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

    public isUpcoming(meeting: SpaceMeetingCardItem): boolean {
        return isUpcomingMeeting(meeting);
    }
}
