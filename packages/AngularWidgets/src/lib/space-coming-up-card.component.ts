import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClass } from '@memberjunction/global';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { BaseSpaceOverviewCard } from './base-space-overview-card';
import type { SpaceMeetingCardItem } from './space-meetings-tab.component';
import { COLLAB_TOKENS_CSS } from './tokens';

/**
 * Overview card showing the next upcoming meetings in the space (*Coming up*, B23).
 */
@RegisterClass(BaseSpaceOverviewCard, 'SpaceComingUpCardComponent')
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
export class SpaceComingUpCardComponent extends BaseSpaceOverviewCard {
    @Input() public Title = 'Coming up';
    @Input() public UpcomingMeetings: SpaceMeetingCardItem[] = [];

    @Output() public OpenMeetingRequested = new EventEmitter<SpaceMeetingCardItem>();
    @Output() public ViewAllRequested = new EventEmitter<string>();

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
