import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceOverviewCard } from '@mj-biz-apps/collaboration-ng-widgets';

@RegisterClassEx(BaseSpaceOverviewCard, {
    key: 'example-board:vote',
    metadata: {
        spaceTypes: ['example-board'],
        slot: 'card',
        sortKey: 30,
        contributionKey: 'vote',
    },
})
@Component({
    selector: 'mjc-example-board-vote-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="card vote-card" style="border: 1px solid var(--mj-status-warning); border-radius: 12px; background: var(--mj-bg-surface-card); padding: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="padding: 4px 10px; background: var(--mj-status-warning-bg); color: var(--mj-status-warning-text); border-radius: 99px; font-size: 12px; font-weight: 700;">
                    <i class="fa-solid fa-gavel" style="margin-right: 6px;"></i>Your vote is needed
                </span>
                <span style="font-size: 12px; color: var(--mj-text-muted);">Closes Wed 5:00 PM</span>
            </div>
            <div style="font-weight: 700; font-size: 15px; margin-top: 12px;">Motion 2026-14</div>
            <div style="font-size: 13px; color: var(--mj-text-secondary); margin-top: 4px; line-height: 1.5;">
                Appoint Hartwell &amp; Co. as external auditor for FY2026, fee not to exceed <b>$184,000</b>.
            </div>
            <div style="font-size: 12px; color: var(--mj-text-muted); margin-top: 6px;">Moved by Margaret Cole · seconded by Tom Reyes</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
                <span style="font-size: 12px; color: var(--mj-text-secondary);">4 of 7 have voted</span>
                <div style="flex: 1; height: 6px; background: var(--mj-border-subtle); border-radius: 99px; overflow: hidden;">
                    <div style="width: 57%; height: 100%; background: var(--mj-status-warning); border-radius: 99px;"></div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 14px;">
                <button type="button" style="padding: 8px; border: 1px solid var(--mj-border-default); border-radius: 8px; background: var(--mj-bg-surface); font-weight: 600; font-size: 13px; cursor: pointer;">
                    <i class="fa-solid fa-check" style="color: var(--mj-status-success); margin-right: 6px;"></i>For
                </button>
                <button type="button" style="padding: 8px; border: 1px solid var(--mj-border-default); border-radius: 8px; background: var(--mj-bg-surface); font-weight: 600; font-size: 13px; cursor: pointer;">
                    <i class="fa-solid fa-xmark" style="color: var(--mj-status-error); margin-right: 6px;"></i>Against
                </button>
                <button type="button" style="padding: 8px; border: 1px solid var(--mj-border-default); border-radius: 8px; background: var(--mj-bg-surface); font-weight: 600; font-size: 13px; cursor: pointer;">
                    Abstain
                </button>
            </div>
        </div>
    `,
})
export class ExampleBoardVoteCard extends BaseSpaceOverviewCard {}
