import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceOverviewCard } from '@mj-biz-apps/collaboration-ng-widgets';

@RegisterClassEx(BaseSpaceOverviewCard, {
    key: 'example-board:members',
    metadata: {
        spaceTypes: ['example-board'],
        slot: 'card',
        sortKey: 40,
        contributionKey: 'members',
    },
})
@Component({
    selector: 'mjc-example-board-members-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="card members-card" style="border: 1px solid var(--mj-border-default); border-radius: 12px; background: var(--mj-bg-surface-card); padding: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-size: 16px; font-weight: 700;">Members</span>
                <span style="font-size: 12px; color: var(--mj-brand-primary); font-weight: 600; cursor: pointer;">All 7</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="width: 28px; height: 28px; border-radius: 99px; background: #c7d2fe; color: #3730a3; display: grid; place-items: center; font-size: 11px; font-weight: 700;">MC</span>
                    <span style="font-size: 13px;"><b>Margaret Cole</b> · chair</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="width: 28px; height: 28px; border-radius: 99px; background: #fed7aa; color: #9a3412; display: grid; place-items: center; font-size: 11px; font-weight: 700;">KM</span>
                    <span style="font-size: 13px;"><b>Ken Mori</b> · outside director</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; opacity: 0.85;">
                    <span style="width: 28px; height: 28px; border-radius: 99px; background: #fbcfe8; color: #9d174d; display: grid; place-items: center; font-size: 11px; font-weight: 700;">PR</span>
                    <span style="font-size: 13px; flex: 1;"><b>Pat Rivera</b> · you invited</span>
                    <span style="padding: 2px 6px; border: 1px solid var(--mj-border-default); border-radius: 4px; font-size: 11px;">Awaiting staff</span>
                </div>
            </div>
        </div>
    `,
})
export class ExampleBoardMembersCard extends BaseSpaceOverviewCard {}
