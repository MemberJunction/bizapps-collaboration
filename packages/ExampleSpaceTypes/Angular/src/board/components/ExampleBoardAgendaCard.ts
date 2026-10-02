import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceOverviewCard } from '@mj-biz-apps/collaboration-ng-widgets';

@RegisterClassEx(BaseSpaceOverviewCard, {
    key: 'example-board:agenda',
    metadata: {
        spaceTypes: ['example-board'],
        slot: 'card',
        sortKey: 20,
        contributionKey: 'agenda',
    },
})
@Component({
    selector: 'mjc-example-board-agenda-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="card agenda-card" style="border: 1px solid var(--mj-border-default); border-radius: 12px; background: var(--mj-bg-surface-card); padding: 16px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-size: 16px; font-weight: 700;">Agenda</span>
                <span style="font-size: 12px; color: var(--mj-text-muted);">6 items</span>
                <span style="font-size: 12px; color: var(--mj-brand-primary); font-weight: 600; cursor: pointer;">Download pack</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <div class="ag-row" style="display: flex; align-items: center; gap: 14px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle);">
                    <span style="width: 38px; font-size: 12.5px; font-weight: 650; color: var(--mj-text-secondary);">4:00</span>
                    <div style="flex: 1;"><div style="font-weight: 600; font-size: 13px;">Call to order; minutes of July 17</div><div style="font-size: 12px; color: var(--mj-text-muted);">Margaret Cole, chair</div></div>
                    <span style="padding: 3px 8px; border: 1px solid var(--mj-border-default); border-radius: 6px; font-size: 12px;"><i class="fa-regular fa-file-lines" style="margin-right: 4px;"></i>Minutes</span>
                </div>
                <div class="ag-row" style="display: flex; align-items: center; gap: 14px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle);">
                    <span style="width: 38px; font-size: 12.5px; font-weight: 650; color: var(--mj-text-secondary);">4:05</span>
                    <div style="flex: 1;"><div style="font-weight: 600; font-size: 13px;">External audit plan for FY2026</div><div style="font-size: 12px; color: var(--mj-text-muted);">Hartwell &amp; Co., invited</div></div>
                    <span style="padding: 3px 8px; border: 1px solid var(--mj-border-default); border-radius: 6px; font-size: 12px;"><i class="fa-regular fa-file-lines" style="margin-right: 4px;"></i>Paper 2</span>
                </div>
                <div class="ag-row" style="display: flex; align-items: center; gap: 14px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle);">
                    <span style="width: 38px; font-size: 12.5px; font-weight: 650; color: var(--mj-text-secondary);">4:30</span>
                    <div style="flex: 1;"><div style="font-weight: 600; font-size: 13px;">Internal controls update</div><div style="font-size: 12px; color: var(--mj-text-muted);">Tom Reyes</div></div>
                    <span style="font-size: 11.5px; color: var(--mj-status-warning-text); font-weight: 600;"><i class="fa-regular fa-note-sticky" style="margin-right: 4px;"></i>Your note on p.14</span>
                    <span style="padding: 3px 8px; border: 1px solid var(--mj-border-default); border-radius: 6px; font-size: 12px;"><i class="fa-regular fa-file-lines" style="margin-right: 4px;"></i>Paper 3</span>
                </div>
                <div class="ag-row" style="display: flex; align-items: center; gap: 14px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle);">
                    <span style="width: 38px; font-size: 12.5px; font-weight: 650; color: var(--mj-text-secondary);">4:50</span>
                    <div style="flex: 1;"><div style="font-weight: 600; font-size: 13px;">Motion 2026-14: appoint the external auditor</div><div style="font-size: 12px; color: var(--mj-text-muted);">Margaret Cole</div></div>
                    <span style="padding: 3px 8px; background: var(--mj-status-warning-bg); color: var(--mj-status-warning-text); border-radius: 6px; font-size: 12px; font-weight: 600;"><i class="fa-solid fa-gavel" style="margin-right: 4px;"></i>Vote</span>
                </div>
                <div class="ag-row" style="display: flex; align-items: center; gap: 14px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle);">
                    <span style="width: 38px; font-size: 12.5px; font-weight: 650; color: var(--mj-text-secondary);">5:10</span>
                    <div style="flex: 1;"><div style="font-weight: 600; font-size: 13px;">Risk register review</div><div style="font-size: 12px; color: var(--mj-text-muted);">Ada Lovell</div></div>
                    <span style="padding: 3px 8px; border: 1px solid var(--mj-border-default); border-radius: 6px; font-size: 12px;"><i class="fa-regular fa-file-lines" style="margin-right: 4px;"></i>Paper 5</span>
                </div>
                <div class="ag-row" style="display: flex; align-items: center; gap: 14px; padding: 8px 0; border-top: 1px solid var(--mj-border-subtle);">
                    <span style="width: 38px; font-size: 12.5px; font-weight: 650; color: var(--mj-text-secondary);">5:25</span>
                    <div style="flex: 1;"><div style="font-weight: 600; font-size: 13px;">Closed session — members only</div><div style="font-size: 12px; color: var(--mj-text-muted);">Staff and guests leave</div></div>
                    <span style="padding: 3px 8px; background: var(--mj-status-info-bg); color: var(--mj-status-info-text); border-radius: 6px; font-size: 12px; font-weight: 600;"><i class="fa-solid fa-lock" style="margin-right: 4px;"></i>Members</span>
                </div>
            </div>
        </div>
    `,
})
export class ExampleBoardAgendaCard extends BaseSpaceOverviewCard {}
