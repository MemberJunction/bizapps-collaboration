import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceOverviewCard } from '@mj-biz-apps/collaboration-ng-widgets';

@RegisterClassEx(BaseSpaceOverviewCard, {
    key: 'example-board:next-meeting',
    metadata: {
        spaceTypes: ['example-board'],
        slot: 'card',
        sortKey: 10,
        contributionKey: 'next-meeting',
    },
})
@Component({
    selector: 'mjc-example-board-next-meeting-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="card meet" style="border: 1px solid var(--mj-border-default); border-radius: 12px; background: var(--mj-bg-surface-card); overflow: hidden;">
            <div class="meet-top" style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 16px 18px; border-bottom: 1px solid var(--mj-border-default);">
                <div class="bigdate" style="width: 62px; height: 68px; border-radius: 14px; background: var(--mj-bg-surface); border: 1px solid var(--mj-border-default); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; flex: none;">
                    <span style="font-size: 11px; font-weight: 700; color: var(--mj-status-error); letter-spacing: .08em;">OCT</span>
                    <b style="font-size: 26px; font-weight: 750; margin-top: 3px;">2</b>
                    <em style="font-style: normal; font-size: 10.5px; color: var(--mj-text-muted); margin-top: 3px; font-weight: 600;">Thu</em>
                </div>
                <div style="flex: 1 1 220px; min-width: 0;">
                    <div style="color: var(--mj-status-warning-text); font-size: 12px; font-weight: 600;">Next meeting · in 6 days</div>
                    <div style="font-size: 19px; font-weight: 700; margin-top: 2px;">Q3 Audit Committee meeting</div>
                    <div style="font-size: 13px; color: var(--mj-text-secondary); margin-top: 2px;">4:00–5:30 PM · Boardroom, 12th floor, and video</div>
                </div>
                <div style="display: flex; gap: 8px; flex: none;">
                    <button type="button" style="padding: 6px 12px; border: 1px solid var(--mj-border-default); border-radius: 8px; background: var(--mj-bg-surface); font-size: 13px; font-weight: 600; cursor: pointer;">
                        <i class="fa-regular fa-calendar-plus" style="margin-right: 6px;"></i>Add to calendar
                    </button>
                    <button type="button" style="padding: 6px 12px; border: 1px solid var(--mj-border-default); border-radius: 8px; background: var(--mj-bg-surface); font-size: 13px; font-weight: 600; opacity: 0.6; cursor: pointer;">
                        <i class="fa-solid fa-video" style="margin-right: 6px;"></i>Join at 3:55
                    </button>
                </div>
            </div>
            <div class="pack" style="display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 14px 18px;">
                <span style="width: 36px; height: 36px; border-radius: 8px; background: var(--mj-status-error-bg); color: var(--mj-status-error-text); display: grid; place-items: center; font-size: 16px;">
                    <i class="fa-solid fa-file-pdf"></i>
                </span>
                <div style="flex: 1 1 220px; min-width: 0;">
                    <div style="font-weight: 700; font-size: 13.5px;">Q3 board pack</div>
                    <div style="font-size: 12px; color: var(--mj-text-muted);">42 pages · published today by Ada Lovell, committee secretary</div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 8px;">
                        <div style="flex: 1; max-width: 260px; height: 6px; background: var(--mj-border-subtle); border-radius: 99px; overflow: hidden;">
                            <div style="width: 29%; height: 100%; background: var(--mj-status-warning); border-radius: 99px;"></div>
                        </div>
                        <span style="font-size: 12px; color: var(--mj-text-secondary);">You’ve read 12 of 42 pages</span>
                    </div>
                </div>
                <button type="button" style="padding: 8px 14px; background: var(--mj-brand-primary); color: var(--mj-brand-on-primary); border: none; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
                    <i class="fa-solid fa-book-open" style="margin-right: 6px;"></i>Continue reading
                </button>
            </div>
        </div>
    `,
})
export class ExampleBoardNextMeetingCard extends BaseSpaceOverviewCard {}
