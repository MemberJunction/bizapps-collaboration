import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    Optional,
    Output,
    SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { type IRunViewProvider } from '@memberjunction/core';
import { MJGlobal, RegisterClassEx } from '@memberjunction/global';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import {
    type AgendaItem,
    BaseAgendaProvider,
    mergeAgenda,
    type SpaceBatchContext,
} from '@mj-biz-apps/collaboration-core';
import { BaseSpaceOverviewCard } from './base-space-overview-card';
import { loadSpaceMeetingCards, type SpaceMeetingCardItem } from './space-meetings-tab.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@RegisterClassEx(BaseAgendaProvider, {
    key: 'collaboration:meetings-agenda-provider',
    metadata: { spaceTypes: ['*'] },
})
export class SpaceMeetingsWidgetAgendaProvider extends BaseAgendaProvider {
    public override async getItemsForSpaces(context: SpaceBatchContext): Promise<AgendaItem[]> {
        const items: AgendaItem[] = [];
        const provider = context.provider as IRunViewProvider | undefined;
        const now = Date.now();
        for (const spaceId of context.spaceIds) {
            const meetings = await loadSpaceMeetingCards(spaceId, provider);
            for (const m of meetings) {
                const done = m.Status === 'Completed' || m.Status === 'Cancelled';
                const end = new Date(m.EndsAt).getTime();
                if (done || (Number.isFinite(end) && end < now)) continue;
                items.push({
                    id: `meeting:${m.ID}`,
                    spaceId,
                    title: m.Name,
                    context: m.Location ?? m.LocationType,
                    date: new Date(m.StartsAt),
                    typeIcon: 'fa-solid fa-calendar-check',
                    sourceProvider: 'SpaceMeetingsWidgetAgendaProvider',
                    metadata: {
                        meetingId: m.ID,
                        status: m.Status,
                        videoJoinUrl: m.VideoJoinURL ?? null,
                    },
                });
            }
        }
        return items;
    }
}

/**
 * Queries all registered `BaseAgendaProvider` implementations and merges their items chronologically.
 */
export async function collectSpaceAgendaItems(context: SpaceBatchContext): Promise<AgendaItem[]> {
    void SpaceMeetingsWidgetAgendaProvider;
    const registrations = MJGlobal.Instance.ClassFactory.GetAllRegistrations(BaseAgendaProvider);
    const arrays: AgendaItem[][] = [];
    for (const reg of registrations) {
        try {
            const Ctor = reg.SubClass as new () => BaseAgendaProvider;
            const instance = new Ctor();
            const items = await instance.getItemsForSpaces(context);
            if (Array.isArray(items) && items.length > 0) {
                arrays.push(items);
            }
        } catch {
            // A faulty agenda provider never breaks the view
        }
    }
    return mergeAgenda(arrays);
}

/**
 * Overview card showing the next upcoming meetings in the space (*Coming up*, B23).
 */
@RegisterClassEx(BaseSpaceOverviewCard, {
    key: 'collaboration:coming-up',
    priority: -1,
    metadata: {
        spaceTypes: ['*'],
        slot: 'card',
        side: 'Shared',
        sortKey: 25,
        contributionKey: 'coming-up',
        title: 'Coming up',
    },
})
@Component({
    selector: 'mjc-space-coming-up-card',
    standalone: true,
    imports: [CommonModule, MJButtonDirective],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="coming-up-card">
            <div class="card-head">
                <div class="fw7 fs13"><i class="fa-regular fa-calendar-check"></i> {{ Title }}</div>
                @if (UpcomingMeetings.length > 0) {
                    <button mjButton Variant="flat" Size="sm" type="button" (click)="ViewAllRequested.emit(SpaceId)">
                        All meetings
                    </button>
                }
            </div>

            @if (UpcomingMeetings.length === 0) {
                <div class="fs12 muted empty-row">No upcoming meetings scheduled in this space.</div>
            } @else {
                <div class="coming-up-list">
                    @for (m of UpcomingMeetings; track m.ID) {
                        <div class="coming-up-item">
                            <div class="grow">
                                <div class="fw6 fs13">{{ m.Name }}</div>
                                <div class="fs12 muted">{{ formatStart(m.StartsAt) }}</div>
                            </div>
                            <div class="item-actions">
                                @if (m.VideoJoinURL) {
                                    <a
                                        mjButton
                                        Variant="primary"
                                        Size="sm"
                                        [href]="m.VideoJoinURL"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Join
                                    </a>
                                }
                                <button
                                    mjButton
                                    Variant="secondary"
                                    Size="sm"
                                    type="button"
                                    (click)="OpenMeetingRequested.emit(m)"
                                >
                                    Open
                                </button>
                            </div>
                        </div>
                    }
                </div>
            }
        </div>
    `,
    styles: [
        COLLAB_TOKENS_CSS,
        `
            :host {
                display: block;
            }
            .coming-up-card {
                background: var(--mj-bg-surface-card, #ffffff);
                border: 1px solid var(--mj-border-default, #e5e7eb);
                border-radius: 10px;
                padding: 12px 14px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .card-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            .coming-up-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .coming-up-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding-top: 8px;
                border-top: 1px solid var(--mj-border-subtle, #f3f4f6);
            }
            .item-actions {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .fw7 {
                font-weight: 700;
            }
            .fw6 {
                font-weight: 600;
            }
            .fs13 {
                font-size: 13px;
            }
            .fs12 {
                font-size: 12px;
            }
            .muted {
                color: var(--mj-text-muted, #6b7280);
            }
            .grow {
                flex: 1;
                min-width: 0;
            }
        `,
    ],
})
export class SpaceComingUpCardComponent extends BaseSpaceOverviewCard implements OnChanges {
    @Input() public Title = 'Coming up';
    @Input() public UpcomingMeetings: SpaceMeetingCardItem[] = [];

    @Output() public OpenMeetingRequested = new EventEmitter<SpaceMeetingCardItem>();
    @Output() public ViewAllRequested = new EventEmitter<string>();

    private hasExplicitMeetings = false;
    private loadToken = 0;

    constructor(@Optional() private readonly cdr?: ChangeDetectorRef) {
        super();
    }

    public ngOnChanges(changes: SimpleChanges): void {
        if (changes['UpcomingMeetings'] && changes['UpcomingMeetings'].currentValue !== undefined) {
            this.hasExplicitMeetings = true;
        }
        if (changes['SpaceId'] && !this.hasExplicitMeetings) {
            void this.loadForSpace(this.SpaceId);
        }
    }

    public async loadForSpace(spaceId: string): Promise<void> {
        const cleanId = (spaceId ?? '').trim();
        if (!cleanId) {
            this.UpcomingMeetings = [];
            this.cdr?.markForCheck();
            return;
        }
        const token = ++this.loadToken;
        try {
            const [cards, agendaItems] = await Promise.all([
                loadSpaceMeetingCards(cleanId, this.RunViewToUse),
                collectSpaceAgendaItems({ spaceIds: [cleanId], viewerId: '', provider: this.RunViewToUse }),
            ]);
            if (token !== this.loadToken) return;
            const now = Date.now();
            const upcomingCards = cards.filter((m) => {
                const done = m.Status === 'Completed' || m.Status === 'Cancelled';
                const end = new Date(m.EndsAt).getTime();
                return !done && (!Number.isFinite(end) || end >= now);
            });
            const cardMeetingIds = new Set(upcomingCards.map((c) => c.ID.toLowerCase()));
            for (const item of agendaItems) {
                const rawMeetingId = typeof item.metadata?.['meetingId'] === 'string'
                    ? item.metadata['meetingId']
                    : item.id.replace(/^meeting:/i, '');
                if (cardMeetingIds.has(rawMeetingId.toLowerCase())) continue;
                upcomingCards.push({
                    ID: rawMeetingId,
                    Name: item.title,
                    StartsAt: item.date instanceof Date ? item.date.toISOString() : String(item.date),
                    EndsAt: item.date instanceof Date ? item.date.toISOString() : String(item.date),
                    Status: typeof item.metadata?.['status'] === 'string' ? item.metadata['status'] : 'Scheduled',
                    Location: item.context ?? null,
                    VideoJoinURL: typeof item.metadata?.['videoJoinUrl'] === 'string' ? item.metadata['videoJoinUrl'] : null,
                });
            }
            this.UpcomingMeetings = upcomingCards;
            this.cdr?.markForCheck();
        } catch {
            // Non-fatal
        }
    }

    public formatStart(startsAt: string): string {
        const d = new Date(startsAt);
        if (!Number.isFinite(d.getTime())) return startsAt;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    }
}
