// @vitest-environment jsdom
import '@angular/compiler';
import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild, signal, type Type } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { UserInfoEngine } from '@memberjunction/core-entities';
import {
    TaskWbsTreeComponent,
    type TaskSummaryTile,
    type TaskWbsGroup,
    type TaskWbsGroupTemplateContext,
    type TaskWbsRowTemplateContext,
    type TaskWbsRowTone,
    type TaskWidgetItem,
} from '@mj-biz-apps/tasks-ng-widgets';
import {
    TaskPanelComponent,
    type KanbanCardBadgeContext,
    type TaskDetailTopExtensionContext,
    type TaskViewMode,
} from '@mj-biz-apps/tasks-ng';
import type { SpaceBand } from '@mj-biz-apps/collaboration-ng-widgets';
import {
    CollabSpaceWorkWorkspaceComponent,
    type SpaceWorkQuickAddEvent,
} from './space-work-workspace.component.ts';

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

const SAMPLE_TASKS: TaskWidgetItem[] = [
    {
        ID: 't-root',
        Name: 'Program Kickoff',
        ParentID: null,
        Status: 'InProgress',
        Priority: 'High',
        PercentComplete: null,
        Sequence: 1,
    },
    {
        ID: 't-shared-1',
        Name: 'Deliver architecture brief',
        ParentID: 't-root',
        Status: 'Completed',
        Priority: 'Medium',
        PercentComplete: 100,
        Sequence: 1,
    },
    {
        ID: 't-team-1',
        Name: 'Internal staffing & cost check',
        ParentID: 't-root',
        Status: 'Blocked',
        Priority: 'Critical',
        BlockedReason: 'Pending staffing sign-off',
        PercentComplete: 10,
        Sequence: 2,
    },
];

const SAMPLE_BANDS: Record<string, SpaceBand> = {
    't-root': 'Shared',
    't-shared-1': 'Shared',
    't-team-1': 'Team',
};

const PORTFOLIO_GROUPS: TaskWbsGroup<{ stage: string }>[] = [
    {
        ID: 'sub-1',
        Title: 'Workstream Alpha',
        Subtitle: 'Delivery sub-space',
        Data: { stage: 'Build' },
        Tasks: [
            { ID: 'g1-s1', Name: 'Alpha shared milestone', Status: 'Completed', PercentComplete: 100, Sequence: 1 },
            { ID: 'g1-t1', Name: 'Alpha team QA', Status: 'InProgress', PercentComplete: 50, Sequence: 2 },
        ],
    },
    {
        ID: 'sub-2',
        Title: 'Workstream Beta',
        Data: { stage: 'Discover' },
        Tasks: [
            { ID: 'g2-s1', Name: 'Beta shared charter', Status: 'Blocked', BlockedReason: 'Awaiting review', PercentComplete: 0, Sequence: 1 },
        ],
    },
];

const PORTFOLIO_HUB_TASKS: TaskWidgetItem[] = [
    { ID: 'hub-1', Name: 'Quarterly steering review', Status: 'Open', PercentComplete: 0, Sequence: 1 },
    { ID: 'hub-team', Name: 'Internal account prep', Status: 'Open', PercentComplete: 0, Sequence: 2 },
];

const PORTFOLIO_BANDS = new Map<string, SpaceBand>([
    ['g1-s1', 'Shared'],
    ['g1-t1', 'Team'],
    ['g2-s1', 'Shared'],
    ['hub-1', 'Shared'],
    ['hub-team', 'Team'],
]);

function declareComponent(target: Type<object>, metadata: Component): void {
    Component({ standalone: true, ...metadata })(target);
}

/** Light stub for host-slot projection & Kanban card badge rendering verification. */
class PortfolioHostComponent {
    @ViewChild('ws') public ws?: CollabSpaceWorkWorkspaceComponent;
    public groups = PORTFOLIO_GROUPS;
    public hubTasks = PORTFOLIO_HUB_TASKS;
    public bands = PORTFOLIO_BANDS;
    public canSeeTeamSide = signal(true);
    public extraTiles: TaskSummaryTile[] = [{ Key: 'external', Label: 'External Links', Value: 4, Tone: 'info' }];
    public clickedSummaryKeys: string[] = [];
}
declareComponent(PortfolioHostComponent, {
    selector: 'test-portfolio-host',
    imports: [CollabSpaceWorkWorkspaceComponent],
    template: `
        <mjc-space-work-workspace
            #ws
            SpaceId="space-hub"
            [SubSpaceGroups]="groups"
            [HubTasks]="hubTasks"
            [TaskBands]="bands"
            [CanSeeTeamSide]="canSeeTeamSide()"
            [HasSidePanel]="true"
            [ExtraSummaryTiles]="extraTiles"
            (SummaryTileClicked)="clickedSummaryKeys.push($event)">
            <div header-banner class="host-banner">Portfolio Banner</div>
            <button toolbar-actions type="button" class="host-toolbar-btn">Sync</button>
            <div side-panel class="host-side-panel">Companion Side Panel</div>
            <ng-template #groupHeaderMeta let-group>
                <span class="host-stage-pill">{{ group.Data?.stage }}</span>
            </ng-template>
            <ng-template #groupHeaderActions let-group>
                <button type="button" class="host-open-btn">Open {{ group.Title }}</button>
            </ng-template>
            <ng-template #groupFooter let-group>
                <div class="host-group-footer">Footer for {{ group.ID }}</div>
            </ng-template>
            <ng-template #extraRowBadges let-task>
                <span class="host-extra-badge">EXT:{{ task.ID }}</span>
            </ng-template>
            <ng-template #detailTopExtension let-taskId>
                <div class="host-detail-ext">DetailExt:{{ taskId }}</div>
            </ng-template>
        </mjc-space-work-workspace>
    `,
});

/** Lightweight TaskPanel stub to test Kanban card badges & drawer delegation without booting DHTMLX/AG-Grid. */
class MockTaskPanelComponent {
    @Input() Tasks: readonly TaskWidgetItem[] | null = null;
    @Input() Groups: readonly TaskWbsGroup[] | null = null;
    @Input() HubTasks: readonly TaskWidgetItem[] | null = null;
    @Input() ShowOpenForm = true;
    @Input() ShowTimeEffort = true;
    @Input() ReadOnly = false;
    @Input() HasSidePanel = false;
    @Input() PreferenceKey: string | null = null;
    @Input() AllowedViewModes: TaskViewMode[] = ['wbs', 'list', 'kanban', 'gantt'];
    @Input() ViewMode: TaskViewMode = 'wbs';
    @Input() RowToneResolver: ((task: TaskWidgetItem) => TaskWbsRowTone) | null = null;
    @Input() TaskRowBadgesTemplate: TemplateRef<TaskWbsRowTemplateContext> | null = null;
    @Input() TaskCardBadgesTemplate: TemplateRef<KanbanCardBadgeContext> | null = null;
    @Input() GroupHeaderMetaTemplate: TemplateRef<TaskWbsGroupTemplateContext> | null = null;
    @Input() GroupHeaderActionsTemplate: TemplateRef<TaskWbsGroupTemplateContext> | null = null;
    @Input() GroupFooterTemplate: TemplateRef<TaskWbsGroupTemplateContext> | null = null;
    @Input() DetailTopExtensionTemplate: TemplateRef<TaskDetailTopExtensionContext> | null = null;
    @Output() ViewModeChange = new EventEmitter<TaskViewMode>();
    @Output() AfterTaskSaved = new EventEmitter<string>();

    public openedDetailId: string | null = null;
    public closedCount = 0;

    public OpenDetail(taskId: string): void {
        this.openedDetailId = taskId;
    }
    public CloseDetail(): void {
        this.openedDetailId = null;
        this.closedCount += 1;
    }
    public SetViewMode(mode: TaskViewMode): void {
        this.ViewMode = mode;
        this.ViewModeChange.emit(mode);
    }
    public Refresh(): void {
        // no-op stub
    }
}
declareComponent(MockTaskPanelComponent, {
    selector: 'bizapps-task-panel',
    imports: [NgTemplateOutlet],
    template: `
        <div class="mock-panel">
            <ng-content select="[header-banner]"></ng-content>
            <ng-content select="[summary-strip]"></ng-content>
            <ng-content select="[toolbar-actions]"></ng-content>
            <div class="mock-cards">
                @for (t of Tasks ?? []; track t.ID) {
                    <div class="mock-card" [attr.data-task-id]="t.ID">
                        @if (TaskCardBadgesTemplate) {
                            <ng-container *ngTemplateOutlet="TaskCardBadgesTemplate; context: { $implicit: { ID: t.ID, Title: t.Name }, card: { ID: t.ID, Title: t.Name }, taskId: t.ID }"></ng-container>
                        }
                    </div>
                }
            </div>
            <ng-content select="[side-panel]"></ng-content>
        </div>
    `,
});

describe('CollabSpaceWorkWorkspaceComponent', () => {
    it('enforces fail-closed Team band isolation when CanSeeTeamSide is false', async () => {
        vi.spyOn(UserInfoEngine.Instance, 'GetSetting').mockReturnValue(undefined);
        vi.spyOn(UserInfoEngine.Instance, 'SetSettingDebounced').mockImplementation(() => undefined);

        const fixture = TestBed.createComponent(CollabSpaceWorkWorkspaceComponent);
        fixture.componentRef.setInput('SpaceId', 'space-1');
        fixture.componentRef.setInput('Tasks', SAMPLE_TASKS);
        fixture.componentRef.setInput('TaskBands', SAMPLE_BANDS);
        fixture.componentRef.setInput('CanSeeTeamSide', false);
        fixture.componentRef.setInput('ShowOpenForm', true);
        fixture.componentRef.setInput('ShowTimeEffort', true);
        fixture.componentRef.setInput('AllowedBands', ['Shared', 'Team']);
        fixture.componentRef.setInput('CanCreateTask', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const comp = fixture.componentInstance;
        const host = fixture.nativeElement as HTMLElement;

        // Team tasks stripped from visible tasks AND summary KPI counts
        expect(comp.AudienceFilteredTasks?.map((t) => t.ID)).toEqual(['t-root', 't-shared-1']);
        expect(comp.EffectiveSummary?.TotalCount).toBe(2);
        expect(comp.EffectiveSummary?.BlockedCount).toBe(0);

        // Team text & blocked reason never reach DOM
        expect(host.textContent).toContain('Program Kickoff');
        expect(host.textContent).toContain('Deliver architecture brief');
        expect(host.textContent).not.toContain('Internal staffing & cost check');
        expect(host.textContent).not.toContain('Pending staffing sign-off');

        // Team filter chip hidden & SetBandFilter('Team') coerced back to 'all'
        const audienceGroup = host.querySelector('[aria-label="Audience"]');
        expect(audienceGroup?.textContent).toContain('Shared');
        expect(audienceGroup?.textContent).not.toContain('Team');
        comp.SetBandFilter('Team');
        expect(comp.EffectiveBandFilter).toBe('all');

        // ShowOpenForm & ShowTimeEffort forced false on TaskPanel
        expect(comp.EffectiveShowOpenForm).toBe(false);
        expect(comp.EffectiveShowTimeEffort).toBe(false);
        expect(comp.taskPanel?.ShowOpenForm).toBe(false);
        expect(comp.taskPanel?.ShowTimeEffort).toBe(false);

        // Quick-add coerces band to Shared when CanSeeTeamSide is false
        const added: SpaceWorkQuickAddEvent[] = [];
        comp.TaskAdd.subscribe((e) => added.push(e));
        comp.NewTaskTitle = 'External deliverable';
        comp.NewTaskBand = 'Team';
        comp.NewTaskPriority = 'High';
        comp.SubmitQuickAdd();
        expect(added).toEqual([{ Title: 'External deliverable', Band: 'Shared', Priority: 'High' }]);
    });

    it('renders all 4 view modes, UserInfoEngine pref persistence, band chips, and muted Team tone for internal viewers', async () => {
        vi.spyOn(UserInfoEngine.Instance, 'GetSetting').mockReturnValue('wbs');
        const setSetting = vi.spyOn(UserInfoEngine.Instance, 'SetSettingDebounced').mockImplementation(() => undefined);

        const fixture = TestBed.createComponent(CollabSpaceWorkWorkspaceComponent);
        fixture.componentRef.setInput('SpaceId', 'space-1');
        fixture.componentRef.setInput('Tasks', SAMPLE_TASKS);
        fixture.componentRef.setInput('TaskBands', SAMPLE_BANDS);
        fixture.componentRef.setInput('CanSeeTeamSide', true);
        fixture.componentRef.setInput('AllowedBands', ['Shared', 'Team']);
        fixture.componentRef.setInput('CanCreateTask', true);
        fixture.componentRef.setInput('PreferenceKey', 'Collaboration.SpaceWork.ViewMode');
        fixture.detectChanges();
        await fixture.whenStable();

        const comp = fixture.componentInstance;
        const host = fixture.nativeElement as HTMLElement;

        // All 4 view modes rendered in mj-view-toggle
        expect(comp.taskPanel?.AllowedViewModes).toEqual(['wbs', 'list', 'kanban', 'gantt']);
        expect(host.textContent).toContain('WBS');
        expect(host.textContent).toContain('List');
        expect(host.textContent).toContain('Board');
        expect(host.textContent).toContain('Timeline');

        // Band chips projected onto WBS rows
        const chips = Array.from(host.querySelectorAll('mjc-band-chip')).map((el) => el.textContent?.trim());
        expect(chips).toEqual(['Shared', 'Shared', 'Team']);

        // Team row gets muted tone
        const teamRow = Array.from(host.querySelectorAll<HTMLElement>('.mjt-wbs-row')).find((el) =>
            el.textContent?.includes('Internal staffing & cost check'),
        );
        expect(teamRow?.getAttribute('data-row-tone')).toBe('muted');

        // Switching audience filter to Team shows only Team task
        comp.SetBandFilter('Team');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(comp.AudienceFilteredTasks?.map((t) => t.ID)).toEqual(['t-team-1']);
        expect(comp.EffectiveSummary?.TotalCount).toBe(1);

        // Switching view mode persists via UserInfoEngine
        comp.SetViewMode('kanban');
        expect(setSetting).toHaveBeenCalledWith('Collaboration.SpaceWork.ViewMode', 'kanban');
    });

    it('supports Sub-Space Portfolio Rollup, flattening across modes, pass-through slots, and summary cross-filtering', async () => {
        vi.spyOn(UserInfoEngine.Instance, 'GetSetting').mockReturnValue(undefined);
        vi.spyOn(UserInfoEngine.Instance, 'SetSettingDebounced').mockImplementation(() => undefined);

        const fixture = TestBed.createComponent(PortfolioHostComponent);
        fixture.detectChanges();
        await fixture.whenStable();

        const hostComp = fixture.componentInstance;
        const ws = hostComp.ws!;
        const hostEl = fixture.nativeElement as HTMLElement;

        // Re-projected header banner, toolbar action, side panel, and group/row templates
        expect(hostEl.querySelector('.host-banner')?.textContent).toContain('Portfolio Banner');
        expect(hostEl.querySelector('.host-toolbar-btn')?.textContent).toContain('Sync');
        expect(hostEl.querySelector('.host-side-panel')?.textContent).toContain('Companion Side Panel');
        expect(hostEl.textContent).toContain('Workstream Alpha');
        expect(hostEl.textContent).toContain('Workstream Beta');
        expect(hostEl.textContent).toContain('Space-Level Tasks');
        expect(hostEl.textContent).toContain('Open Workstream Alpha');
        expect(hostEl.textContent).toContain('Footer for sub-1');
        expect(hostEl.textContent).toContain('EXT:g1-s1');
        expect(hostEl.textContent).toContain('External Links');

        // EffectiveFlatTasks on TaskPanel automatically flattens + dedupes HubTasks + SubSpaceGroups
        const flatIds = ws.taskPanel?.EffectiveFlatTasks?.map((t) => t.ID) ?? [];
        expect(flatIds).toEqual(['hub-1', 'hub-team', 'g1-s1', 'g1-t1', 'g2-s1']);

        // Summary tile click cross-filters and emits SummaryTileClicked
        ws.onSummaryTileClicked('blocked');
        fixture.detectChanges();
        expect(hostComp.clickedSummaryKeys).toContain('blocked');
        expect(ws.ActiveSummaryFilterKey).toBe('blocked');
        const wbsTree = ws.taskPanel?.taskWbs as TaskWbsTreeComponent | undefined;
        expect(wbsTree?.ActiveFilterKey).toBe('blocked');

        // Switching to Shared-only strips Team tasks from HubTasks AND SubSpaceGroups
        hostComp.canSeeTeamSide.set(false);
        fixture.detectChanges();
        await fixture.whenStable();
        const sharedFlatIds = ws.taskPanel?.EffectiveFlatTasks?.map((t) => t.ID) ?? [];
        expect(sharedFlatIds).toEqual(['hub-1', 'g1-s1', 'g2-s1']);
        expect(ws.EffectiveSummary?.TotalCount).toBe(3);
    });

    it('projects mjc-band-chip onto Kanban cards, delegates OpenTaskDetail/CloseTaskDetail, and emits TaskMutated', async () => {
        TestBed.overrideComponent(CollabSpaceWorkWorkspaceComponent, {
            remove: { imports: [TaskPanelComponent] },
            add: { imports: [MockTaskPanelComponent] },
        });

        const fixture = TestBed.createComponent(CollabSpaceWorkWorkspaceComponent);
        fixture.componentRef.setInput('Tasks', SAMPLE_TASKS);
        fixture.componentRef.setInput('TaskBands', SAMPLE_BANDS);
        fixture.componentRef.setInput('CanSeeTeamSide', true);
        fixture.detectChanges();
        await fixture.whenStable();

        const comp = fixture.componentInstance;
        const host = fixture.nativeElement as HTMLElement;
        const mockPanel = fixture.debugElement.query((el) => el.name === 'bizapps-task-panel')
            .componentInstance as MockTaskPanelComponent;

        // Kanban card badges template renders mjc-band-chip per card
        const cardChips = Array.from(host.querySelectorAll('.mock-card mjc-band-chip')).map((el) => el.textContent?.trim());
        expect(cardChips).toEqual(['Shared', 'Shared', 'Team']);

        // Imperative OpenTaskDetail / CloseTaskDetail delegates to TaskPanel
        comp.OpenTaskDetail('t-shared-1');
        expect(mockPanel.openedDetailId).toBe('t-shared-1');
        comp.CloseTaskDetail();
        expect(mockPanel.openedDetailId).toBeNull();
        expect(mockPanel.closedCount).toBe(1);

        // TaskMutated fires on AfterTaskSaved
        const mutated: string[] = [];
        comp.TaskMutated.subscribe((id) => mutated.push(id));
        mockPanel.AfterTaskSaved.emit('t-shared-1');
        expect(mutated).toEqual(['t-shared-1']);
    });
});
