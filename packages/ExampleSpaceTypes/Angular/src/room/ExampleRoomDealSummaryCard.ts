import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceOverviewCard } from '@mj-biz-apps/collaboration-ng-widgets';

@RegisterClassEx(BaseSpaceOverviewCard, {
    key: 'example-room:deal-summary',
    metadata: {
        spaceTypes: ['example-room'],
        slot: 'card',
        side: 'Shared',
        sortKey: 15,
        contributionKey: 'deal-summary',
    },
})
@Component({
    selector: 'mjc-example-room-deal-summary-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="card deal-summary-card" style="border: 1px solid var(--mj-border-default); border-radius: 12px; background: var(--mj-bg-surface-card); padding: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 16px; font-weight: 700;">Deal Overview</span>
                <span style="padding: 3px 8px; background: var(--mj-status-info-bg); color: var(--mj-status-info-text); border-radius: 6px; font-size: 12px; font-weight: 600;">Proposal Review</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px;">
                <div>
                    <div style="font-size: 12px; color: var(--mj-text-muted);">Target Close</div>
                    <div style="font-weight: 650; font-size: 14px; margin-top: 2px;">Nov 15, 2026</div>
                </div>
                <div>
                    <div style="font-size: 12px; color: var(--mj-text-muted);">Deal Value</div>
                    <div style="font-weight: 650; font-size: 14px; margin-top: 2px;">$250,000</div>
                </div>
            </div>
        </div>
    `,
})
export class ExampleRoomDealSummaryCard extends BaseSpaceOverviewCard {}
