import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceTab } from '@mj-biz-apps/collaboration-ng-widgets';

@RegisterClassEx(BaseSpaceTab, {
    key: 'example-board:papers',
    metadata: {
        spaceTypes: ['example-board'],
        slot: 'tab',
        sortKey: 25,
        contributionKey: 'papers',
    },
})
@Component({
    selector: 'mjc-example-board-papers-tab',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="board-papers-tab" style="padding: 24px;">
            <div class="h3" style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Committee Papers &amp; Packs</div>
            <div class="papers-list" style="display: flex; flex-direction: column; gap: 12px;">
                <div style="padding: 14px; border: 1px solid var(--mj-border-default); border-radius: 8px; background: var(--mj-bg-surface-card);">
                    <div style="font-weight: 650; font-size: 14px;">Q3 Board Pack (42 pages, PDF)</div>
                    <div style="font-size: 12px; color: var(--mj-text-muted);">Published today by Ada Lovell, committee secretary</div>
                </div>
            </div>
        </div>
    `,
})
export class ExampleBoardPapersTab extends BaseSpaceTab {}
