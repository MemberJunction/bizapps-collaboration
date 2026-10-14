import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceTab } from '@mj-biz-apps/collaboration-ng-widgets';

@RegisterClassEx(BaseSpaceTab, {
    key: 'example-board:meetings',
    metadata: {
        spaceTypes: ['example-board'],
        slot: 'tab',
        sortKey: 20,
        contributionKey: 'meetings',
    },
})
@Component({
    selector: 'mjc-example-board-meetings-tab',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="board-meetings-tab" style="padding: 24px;">
            <div class="h3" style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Committee Meetings</div>
            <div class="meeting-list" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="meeting-item" style="padding: 16px; border: 1px solid var(--mj-border-default); border-radius: 10px; background: var(--mj-bg-surface-card);">
                    <div style="font-weight: 700; font-size: 15px;">Q3 Audit Committee Meeting</div>
                    <div style="color: var(--mj-text-secondary); font-size: 13px; margin-top: 4px;">Thu Oct 2, 2026 · 4:00 PM – 5:30 PM · Boardroom & Video</div>
                </div>
                <div class="meeting-item" style="padding: 16px; border: 1px solid var(--mj-border-default); border-radius: 10px; background: var(--mj-bg-surface-card);">
                    <div style="font-weight: 700; font-size: 15px;">Q2 Audit Committee Meeting</div>
                    <div style="color: var(--mj-text-muted); font-size: 13px; margin-top: 4px;">Thu Jul 17, 2026 · Minutes approved</div>
                </div>
            </div>
        </div>
    `,
})
export class ExampleBoardMeetingsTab extends BaseSpaceTab {}
