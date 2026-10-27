import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceTab } from '@mj-biz-apps/collaboration-ng-widgets';

@RegisterClassEx(BaseSpaceTab, {
    key: 'example-board:motions',
    metadata: {
        spaceTypes: ['example-board'],
        slot: 'tab',
        sortKey: 30,
        contributionKey: 'motions',
    },
})
@Component({
    selector: 'mjc-example-board-motions-tab',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="board-motions-tab" style="padding: 24px;">
            <div class="h3" style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Motions & E-Ballots</div>
            <div class="motion-card" style="padding: 16px; border: 1px solid var(--mj-border-default); border-radius: 10px; background: var(--mj-bg-surface-card);">
                <div style="font-weight: 700; font-size: 15px;">Motion 2026-14: Appoint External Auditor</div>
                <div style="color: var(--mj-text-secondary); font-size: 13px; margin-top: 4px;">Appoint Hartwell &amp; Co. as external auditor for FY2026, fee not to exceed $184,000.</div>
                <div style="margin-top: 10px; font-size: 12px; color: var(--mj-status-warning-text); font-weight: 600;">Open for voting · Closes Wed 5:00 PM</div>
            </div>
        </div>
    `,
})
export class ExampleBoardMotionsTab extends BaseSpaceTab {}
