import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterClassEx } from '@memberjunction/global';
import { BaseSpaceOverviewCard } from '@mj-biz-apps/collaboration-ng-widgets';

/**
 * A card another app contributes to spaces of any type ('*'): it adds a part to every Overview and replaces none.
 * Its key is its own, so it can't clash with a built-in part.
 */
@RegisterClassEx(BaseSpaceOverviewCard, {
    key: 'example-any:notice',
    metadata: {
        spaceTypes: ['*'],
        slot: 'card',
        sortKey: 90,
        contributionKey: 'example-notice',
        title: 'Notice from another app',
    },
})
@Component({
    selector: 'mjc-example-any-space-notice-card',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="card any-space-notice-card" style="border: 1px solid var(--mj-border-default); border-radius: 12px; background: var(--mj-bg-surface-card); padding: 16px;">
            <span style="font-size: 14px; font-weight: 700;">Notice from another app</span>
            <div style="font-size: 12px; color: var(--mj-text-muted); margin-top: 4px;">This card was contributed to every space type without Collaboration knowing the app.</div>
        </div>
    `,
})
export class ExampleAnySpaceNoticeCard extends BaseSpaceOverviewCard {}
