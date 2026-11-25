import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ContentChild,
    EventEmitter,
    Input,
    Output,
    TemplateRef,
    ViewChild,
    inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { IMetadataProvider } from '@memberjunction/core';
import { MJButtonDirective, MJDropdownComponent, MJFilterChipComponent } from '@memberjunction/ng-ui-components';
import {
    BuildWbsTree,
    ComputeWbsSummary,
    type TaskBadgeDescriptor,
    type TaskWbsSummaryMetrics,
} from '@mj-biz-apps/tasks-core';
import {
    TaskWbsSummaryStripComponent,
    type TaskSummaryTile,
    type TaskWbsFilterDef,
    type TaskWbsGroup,
    type TaskWbsGroupTemplateContext,
    type TaskWbsRowTemplateContext,
    type TaskWbsRowTone,
    type TaskWidgetItem,
} from '@mj-biz-apps/tasks-ng-widgets';
import {
    TaskPanelComponent,
    type AfterKanbanStatusChangeEvent,
    type BeforeCommentPostedEvent,
    type BeforeKanbanStatusChangeEvent,
    type BeforePanelCloseEvent,
    type BeforePanelOpenEvent,
    type BeforeStatusChangeEvent,
    type BeforeTaskSaveEvent,
    type BeforeTaskSelectedEvent,
    type KanbanCardBadgeContext,
    type TaskDetailTopExtensionContext,
    type TaskGanttDependencyInput,
    type TaskRow,
    type TaskViewMode,
} from '@mj-biz-apps/tasks-ng';
import {
    COLLAB_TOKENS_CSS,
    CollabBandChipComponent,
    type SpaceBand,
    type TaskItemModel,
} from '@mj-biz-apps/collaboration-ng-widgets';

/** Audience filter value for `<mjc-space-work-workspace>`. */
export type SpaceWorkBandFilter = 'all' | SpaceBand;

/** Band lookup mapping `TaskID -> SpaceBand` accepted by `<mjc-space-work-workspace [TaskBands]>`. */
export type SpaceWorkBandMap = ReadonlyMap<string, SpaceBand> | Readonly<Record<string, SpaceBand>>;

/** Payload emitted when a user submits the band-aware inline Quick-Add bar. */
export interface SpaceWorkQuickAddEvent {
    Title: string;
    Band: SpaceBand;
    Priority: TaskItemModel['priority'];
}

/** Band dropdown choice shown in the inline Quick-Add bar. */
export interface SpaceWorkBandOption {
    band: SpaceBand;
    label: string;
}

const BUILTIN_SUMMARY_FILTER_KEYS: ReadonlySet<string> = new Set(['all', 'in-progress', 'blocked', 'completed']);
const HUB_GROUP_ID = '__mjc_space_hub__';

function matchesSummaryStatusFilter(task: TaskWidgetItem, filterKey: string): boolean {
    switch (filterKey) {
        case 'in-progress':
            return task.Status === 'InProgress';
        case 'blocked':
            return task.Status === 'Blocked';
        case 'completed':
            return task.Status === 'Completed';
        default:
            return true;
    }
}

/**
 * Reusable Collaboration Space Work Workspace (`WBS | List | Kanban | Gantt`).
 *
 * Wraps `<bizapps-task-panel>` and `<mjt-wbs-summary-strip>` with first-class Space Band
 * security enforcement, Audience filtering, automatic `<mjc-band-chip>` projection across
 * WBS rows, List rows, and Kanban cards, Sub-Space Portfolio Rollup (`[SubSpaceGroups]`),
 * band-aware inline Quick-Add, `UserInfoEngine` view-mode persistence, and full pass-through
 * slots for Space Type drivers and downstream apps.
 */
@Component({
    selector: 'mjc-space-work-workspace',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        NgTemplateOutlet,
        MJButtonDirective,
        MJDropdownComponent,
        MJFilterChipComponent,
        CollabBandChipComponent,
        TaskWbsSummaryStripComponent,
        TaskPanelComponent,
    ],
    template: `
        <div class="mjc-sww-host">
            <bizapps-task-panel
                #taskPanel
                [Provider]="Provider"
                [PersonID]="PersonID"
                [CategoryID]="CategoryID"
                [DefaultTypeID]="DefaultTypeID"
                [AssigneeScope]="AssigneeScope"
                [ParentTaskFilter]="ParentTaskFilter"
                [ExtraFilter]="EffectiveExtraFilter"
                [Tasks]="EffectivePanelSingleTasks"
                [Groups]="EffectivePanelGroups"
                [HubTasks]="EffectivePanelHubTasks"
                [Dependencies]="Dependencies"
                [AllowedViewModes]="AllowedViewModes"
                [ViewMode]="ViewMode"
                [PreferenceKey]="PreferenceKey"
                [PersistViewMode]="PersistViewMode"
                [GanttHeight]="GanttHeight"
                [ReadOnly]="ReadOnly"
                [ShowOpenForm]="EffectiveShowOpenForm"
                [ShowTimeEffort]="EffectiveShowTimeEffort"
                [ShowDelete]="ShowDelete && !ReadOnly"
                [ShowCreateButton]="false"
                [ShowQuickAdd]="false"
                [ShowToolbarActions]="EffectiveShowToolbarActions"
                [ShowWbsCodes]="ShowWbsCodes"
                [ShowTreeConnectors]="ShowTreeConnectors"
                [ShowProgressBars]="ShowProgressBars"
                [ShowWbsToolbar]="ShowWbsToolbar"
                [CustomFilters]="CustomFilters"
                [HasSidePanel]="HasSidePanel"
                [EmptyTitle]="EmptyTitle"
                [EmptyMessage]="EmptyMessage"
                [RowBadgeResolver]="RowBadgeResolver"
                [RowToneResolver]="effectiveRowToneResolver"
                [TaskRowBadgesTemplate]="collabRowBadgesTpl"
                [TaskCardBadgesTemplate]="collabCardBadgesTpl"
                [TaskRowMetaTemplate]="EffectiveRowMetaTemplate"
                [GroupHeaderMetaTemplate]="EffectiveGroupHeaderMetaTemplate"
                [GroupHeaderActionsTemplate]="EffectiveGroupHeaderActionsTemplate"
                [GroupFooterTemplate]="EffectiveGroupFooterTemplate"
                [DetailTopExtensionTemplate]="EffectiveDetailTopExtensionTemplate"
                (ViewModeChange)="onPanelViewModeChange($event)"
                (TaskSelected)="TaskSelected.emit($event)"
                (TaskDoubleClicked)="TaskDoubleClicked.emit($event)"
                (OpenRecordRequested)="OpenRecordRequested.emit($event)"
                (BeforePanelOpen)="BeforePanelOpen.emit($event)"
                (BeforePanelClose)="BeforePanelClose.emit($event)"
                (AfterPanelClosed)="AfterPanelClosed.emit()"
                (BeforeTaskSelected)="BeforeTaskSelected.emit($event)"
                (AfterTaskSelected)="AfterTaskSelected.emit($event)"
                (BeforeStatusChange)="BeforeStatusChange.emit($event)"
                (AfterStatusChange)="onAfterStatusChange($event)"
                (BeforeKanbanStatusChange)="BeforeKanbanStatusChange.emit($event)"
                (AfterKanbanStatusChange)="onAfterKanbanStatusChange($event)"
                (BeforeTaskSave)="BeforeTaskSave.emit($event)"
                (AfterTaskSaved)="onAfterTaskSaved($event)"
                (AfterTaskCreated)="onAfterTaskCreated($event)"
                (BeforeCommentPosted)="BeforeCommentPosted.emit($event)"
                (AfterCommentPosted)="AfterCommentPosted.emit()">

                <!-- Pass-through Header Banner -->
                <div header-banner class="mjc-sww-slot">
                    <ng-content select="[header-banner]"></ng-content>
                </div>

                <!-- Summary Strip + Collapsible Band-Aware Quick-Add Bar -->
                <div summary-strip class="mjc-sww-summary-slot">
                    @if (ShouldRenderSummaryStrip) {
                        <mjt-wbs-summary-strip
                            [Summary]="EffectiveSummary"
                            [LeadingTiles]="LeadingSummaryTiles"
                            [ExtraTiles]="ExtraSummaryTiles"
                            [ActiveFilterKey]="ActiveSummaryFilterKey"
                            (TileClicked)="onSummaryTileClicked($event)">
                        </mjt-wbs-summary-strip>
                    }

                    @if (IsAddingTask && CanCreateTask && !ReadOnly) {
                        <div class="mjc-sww-add-row">
                            <input
                                type="text"
                                class="mj-input mjc-sww-add-input"
                                placeholder="Task title..."
                                aria-label="Task title"
                                [(ngModel)]="NewTaskTitle"
                                (keydown.enter)="SubmitQuickAdd()"
                            />
                            @if (BandChoices.length > 1) {
                                <mj-dropdown
                                    class="mjc-sww-add-select"
                                    AriaLabel="Who can see this task"
                                    [Data]="BandChoices"
                                    TextField="label"
                                    ValueField="band"
                                    [ValuePrimitive]="true"
                                    [(ngModel)]="NewTaskBand">
                                </mj-dropdown>
                            }
                            <mj-dropdown
                                class="mjc-sww-add-select"
                                AriaLabel="Priority"
                                [Data]="PriorityChoices"
                                [ValuePrimitive]="true"
                                [(ngModel)]="NewTaskPriority">
                            </mj-dropdown>
                            <button
                                type="button"
                                mjButton
                                Variant="primary"
                                Size="sm"
                                [disabled]="!NewTaskTitle.trim()"
                                (click)="SubmitQuickAdd()">
                                Add
                            </button>
                            <button
                                type="button"
                                mjButton
                                Variant="flat"
                                Size="sm"
                                (click)="CancelQuickAdd()">
                                Cancel
                            </button>
                        </div>
                    }
                </div>

                <!-- Toolbar Actions: Audience Filter Pills + Quick-Add + Host Pass-Through -->
                <div toolbar-actions class="mjc-sww-toolbar-left">
                    @if (ShowAudienceFilter) {
                        <div class="mjc-sww-audience-group" role="group" aria-label="Audience">
                            <mj-filter-chip
                                Label="All bands"
                                [Active]="EffectiveBandFilter === 'all'"
                                (Clicked)="SetBandFilter('all')" />
                            <mj-filter-chip
                                Label="Shared"
                                [Active]="EffectiveBandFilter === 'Shared'"
                                (Clicked)="SetBandFilter('Shared')" />
                            @if (CanSeeTeamSide) {
                                <mj-filter-chip
                                    Label="Team"
                                    [Active]="EffectiveBandFilter === 'Team'"
                                    (Clicked)="SetBandFilter('Team')" />
                            }
                        </div>
                    }

                    @if (CanCreateTask && !ReadOnly) {
                        <button type="button" mjButton Variant="primary" Size="sm" (click)="ToggleQuickAdd()">
                            <i class="fa-solid fa-plus" aria-hidden="true"></i>
                            <span>Add task</span>
                        </button>
                    }

                    <ng-content select="[toolbar-actions]"></ng-content>
                </div>

                <!-- Pass-through Side Panel -->
                <div side-panel class="mjc-sww-side-slot">
                    <ng-content select="[side-panel]"></ng-content>
                </div>
            </bizapps-task-panel>

            <!-- Band Chip + Host Extra Badges for WBS & List Rows -->
            <ng-template #collabRowBadgesTpl let-task let-node="node" let-wbsCode="wbsCode" let-depth="depth">
                <mjc-band-chip [Band]="ResolveTaskBand(task.ID)" Size="sm" />
                @if (EffectiveExtraRowBadgesTemplate) {
                    <ng-container
                        *ngTemplateOutlet="
                            EffectiveExtraRowBadgesTemplate;
                            context: { $implicit: task, node: node, wbsCode: wbsCode, depth: depth }
                        ">
                    </ng-container>
                }
            </ng-template>

            <!-- Band Chip + Host Extra Badges for Kanban Cards -->
            <ng-template #collabCardBadgesTpl let-card let-taskId="taskId">
                <mjc-band-chip [Band]="ResolveTaskBand(taskId)" Size="sm" />
                @if (EffectiveExtraCardBadgesTemplate) {
                    <ng-container
                        *ngTemplateOutlet="
                            EffectiveExtraCardBadgesTemplate;
                            context: { $implicit: card, card: card, taskId: taskId }
                        ">
                    </ng-container>
                }
            </ng-template>
        </div>
    `,
    styles: [
        COLLAB_TOKENS_CSS,
        `
            :host {
                display: block;
                width: 100%;
                min-width: 0;
            }
            .mjc-sww-host {
                display: flex;
                flex-direction: column;
                width: 100%;
                min-width: 0;
            }
            .mjc-sww-slot:empty,
            .mjc-sww-summary-slot:empty,
            .mjc-sww-side-slot:empty {
                display: none;
            }
            .mjc-sww-summary-slot {
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: 100%;
                min-width: 0;
            }
            .mjc-sww-toolbar-left {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                min-width: 0;
            }
            .mjc-sww-audience-group {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-wrap: wrap;
            }
            .mjc-sww-add-row {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                padding: 10px 14px;
                background: var(--mj-bg-surface);
                border: 1px solid var(--mj-border-strong);
                border-radius: var(--mj-radius-md);
                box-shadow: var(--mj-shadow-md);
            }
            .mjc-sww-add-input {
                flex: 1 1 220px;
                min-width: 180px;
            }
            .mjc-sww-add-select {
                min-width: 148px;
            }
        `,
    ],
})
export class CollabSpaceWorkWorkspaceComponent {
    // ── Space & Data Inputs ─────────────────────────────────

    @Input() SpaceId = '';
    @Input() Tasks: readonly TaskWidgetItem[] | null = null;
    @Input() SubSpaceGroups: readonly TaskWbsGroup[] | null = null;
    @Input() HubTasks: readonly TaskWidgetItem[] | null = null;
    @Input() HubGroupTitle = 'Space-Level Tasks';
    @Input() HubGroupSubtitle = '';
    @Input() Dependencies: readonly TaskGanttDependencyInput[] | null = null;
    @Input() ExtraFilter: string | null = null;
    @Input() Provider: IMetadataProvider | null = null;
    @Input() PersonID: string | null = null;
    @Input() CategoryID: string | null = null;
    @Input() DefaultTypeID: string | null = null;
    @Input() AssigneeScope: string | string[] | null = null;
    @Input() ParentTaskFilter: string | null = null;

    // ── Space Band & Audience Security Inputs ───────────────

    /** Maps `TaskID -> 'Shared' | 'Team'`. Tasks not present default to `DefaultBand`. */
    @Input() TaskBands: SpaceWorkBandMap | null = null;

    /**
     * Defense-in-depth audience boundary (fail-closed default `false`).
     * When `false`:
     * - strips all `'Team'`-band tasks from `Tasks`, `HubTasks`, `SubSpaceGroups`, and summary metrics
     * - hides the `'Team'` audience filter chip
     * - forces `ShowOpenForm = false` and `ShowTimeEffort = false` on `<bizapps-task-panel>`
     */
    @Input() CanSeeTeamSide = false;

    @Input() AllowedBands: readonly SpaceBand[] = ['Shared'];

    @Input()
    public set DefaultBand(value: SpaceBand) {
        this._defaultBand = value || 'Shared';
        this.NewTaskBand = this.resolveStartBand();
    }
    public get DefaultBand(): SpaceBand {
        return this._defaultBand;
    }
    private _defaultBand: SpaceBand = 'Shared';

    @Input() CanCreateTask = false;
    @Input() ReadOnly = false;
    @Input() ShowOpenForm = true;
    @Input() ShowTimeEffort = true;
    @Input() ShowDelete = false;
    @Input() ShowAudienceFilter = true;
    @Input() ShowToolbarActions = false;

    // ── View Mode & Display Inputs ──────────────────────────

    @Input() AllowedViewModes: TaskViewMode[] = ['wbs', 'list', 'kanban', 'gantt'];
    @Input() ViewMode: TaskViewMode = 'wbs';
    @Input() PreferenceKey: string | null = 'Collaboration.SpaceWork.ViewMode';
    @Input() PersistViewMode = true;
    @Input() GanttHeight = '560px';

    @Input() ShowSummaryStrip = true;
    @Input() LeadingSummaryTiles: readonly TaskSummaryTile[] = [];
    @Input() ExtraSummaryTiles: readonly TaskSummaryTile[] = [];
    @Input() CustomFilters: readonly TaskWbsFilterDef[] = [];
    @Input() HasSidePanel = false;
    @Input() ShowWbsCodes = true;
    @Input() ShowTreeConnectors = true;
    @Input() ShowProgressBars = true;
    @Input() ShowWbsToolbar = true;
    @Input() EmptyTitle = 'No tasks found';
    @Input() EmptyMessage = 'Try clearing your filters or add a task to get started.';

    @Input() RowBadgeResolver: ((task: TaskWidgetItem) => readonly TaskBadgeDescriptor[]) | null = null;
    @Input() RowToneResolver: ((task: TaskWidgetItem) => TaskWbsRowTone) | null = null;

    // ── Programmatic & ContentChild Extension Templates ─────

    @Input() ExtraRowBadgesTemplate: TemplateRef<TaskWbsRowTemplateContext> | null = null;
    @Input() ExtraCardBadgesTemplate: TemplateRef<KanbanCardBadgeContext> | null = null;
    @Input() RowMetaTemplate: TemplateRef<TaskWbsRowTemplateContext> | null = null;
    @Input() GroupHeaderMetaTemplate: TemplateRef<TaskWbsGroupTemplateContext> | null = null;
    @Input() GroupHeaderActionsTemplate: TemplateRef<TaskWbsGroupTemplateContext> | null = null;
    @Input() GroupFooterTemplate: TemplateRef<TaskWbsGroupTemplateContext> | null = null;
    @Input() DetailTopExtensionTemplate: TemplateRef<TaskDetailTopExtensionContext> | null = null;

    @ContentChild('extraRowBadges') public contentExtraRowBadges?: TemplateRef<TaskWbsRowTemplateContext>;
    @ContentChild('extraCardBadges') public contentExtraCardBadges?: TemplateRef<KanbanCardBadgeContext>;
    @ContentChild('rowMeta') public contentRowMeta?: TemplateRef<TaskWbsRowTemplateContext>;
    @ContentChild('groupHeaderMeta') public contentGroupHeaderMeta?: TemplateRef<TaskWbsGroupTemplateContext>;
    @ContentChild('groupHeaderActions') public contentGroupHeaderActions?: TemplateRef<TaskWbsGroupTemplateContext>;
    @ContentChild('groupFooter') public contentGroupFooter?: TemplateRef<TaskWbsGroupTemplateContext>;
    @ContentChild('detailTopExtension') public contentDetailTopExtension?: TemplateRef<TaskDetailTopExtensionContext>;

    // ── Outputs ─────────────────────────────────────────────

    @Output() TaskAdd = new EventEmitter<SpaceWorkQuickAddEvent>();
    @Output() ViewModeChange = new EventEmitter<TaskViewMode>();
    @Output() BandFilterChange = new EventEmitter<SpaceWorkBandFilter>();
    @Output() SummaryTileClicked = new EventEmitter<string>();

    @Output() TaskSelected = new EventEmitter<string>();
    @Output() TaskDoubleClicked = new EventEmitter<string>();
    @Output() OpenRecordRequested = new EventEmitter<string>();
    @Output() BeforePanelOpen = new EventEmitter<BeforePanelOpenEvent>();
    @Output() BeforePanelClose = new EventEmitter<BeforePanelCloseEvent>();
    @Output() AfterPanelClosed = new EventEmitter<void>();
    @Output() BeforeTaskSelected = new EventEmitter<BeforeTaskSelectedEvent>();
    @Output() AfterTaskSelected = new EventEmitter<TaskRow>();
    @Output() BeforeStatusChange = new EventEmitter<BeforeStatusChangeEvent>();
    @Output() AfterStatusChange = new EventEmitter<TaskRow>();
    @Output() BeforeKanbanStatusChange = new EventEmitter<BeforeKanbanStatusChangeEvent>();
    @Output() AfterKanbanStatusChange = new EventEmitter<AfterKanbanStatusChangeEvent>();
    @Output() BeforeTaskSave = new EventEmitter<BeforeTaskSaveEvent>();
    @Output() AfterTaskSaved = new EventEmitter<string>();
    @Output() AfterTaskCreated = new EventEmitter<string>();
    @Output() BeforeCommentPosted = new EventEmitter<BeforeCommentPostedEvent>();
    @Output() AfterCommentPosted = new EventEmitter<void>();
    @Output() TaskMutated = new EventEmitter<string>();

    // ── View References & Internal State ────────────────────

    @ViewChild('taskPanel') public taskPanel?: TaskPanelComponent;

    public BandFilter: SpaceWorkBandFilter = 'all';
    public ActiveSummaryFilterKey: string | null = 'all';
    public IsAddingTask = false;
    public NewTaskTitle = '';
    public NewTaskBand: SpaceBand = 'Shared';
    public NewTaskPriority: TaskItemModel['priority'] = 'Medium';
    public readonly PriorityChoices: readonly TaskItemModel['priority'][] = ['Low', 'Medium', 'High', 'Critical'];

    private activeViewMode: TaskViewMode = 'wbs';
    private readonly cdr = inject(ChangeDetectorRef, { optional: true });

    // ── Security & Effective Computed Getters ───────────────

    public get EffectiveBandFilter(): SpaceWorkBandFilter {
        if (!this.CanSeeTeamSide && this.BandFilter === 'Team') {
            return 'all';
        }
        return this.BandFilter;
    }

    public get EffectiveShowOpenForm(): boolean {
        return this.CanSeeTeamSide && this.ShowOpenForm;
    }

    public get EffectiveShowTimeEffort(): boolean {
        return this.CanSeeTeamSide && this.ShowTimeEffort;
    }

    public get EffectiveShowToolbarActions(): boolean {
        return this.ShowAudienceFilter || (this.CanCreateTask && !this.ReadOnly) || this.ShowToolbarActions;
    }

    public get EffectiveExtraFilter(): string | null {
        const trimmed = this.ExtraFilter?.trim();
        return trimmed ? trimmed : null;
    }

    public get EffectiveAllowedBands(): readonly SpaceBand[] {
        const base = this.AllowedBands?.length ? this.AllowedBands : (['Shared'] as const);
        return this.CanSeeTeamSide ? base : base.filter((b) => b === 'Shared');
    }

    public get BandChoices(): SpaceWorkBandOption[] {
        return this.EffectiveAllowedBands.map((band) => ({
            band,
            label: band === 'Shared' ? 'Shared with Outside' : 'Team only',
        }));
    }

    public get EffectiveExtraRowBadgesTemplate(): TemplateRef<TaskWbsRowTemplateContext> | null {
        return this.contentExtraRowBadges ?? this.ExtraRowBadgesTemplate ?? null;
    }

    public get EffectiveExtraCardBadgesTemplate(): TemplateRef<KanbanCardBadgeContext> | null {
        return this.contentExtraCardBadges ?? this.ExtraCardBadgesTemplate ?? null;
    }

    public get EffectiveRowMetaTemplate(): TemplateRef<TaskWbsRowTemplateContext> | null {
        return this.contentRowMeta ?? this.RowMetaTemplate ?? null;
    }

    public get EffectiveGroupHeaderMetaTemplate(): TemplateRef<TaskWbsGroupTemplateContext> | null {
        return this.contentGroupHeaderMeta ?? this.GroupHeaderMetaTemplate ?? null;
    }

    public get EffectiveGroupHeaderActionsTemplate(): TemplateRef<TaskWbsGroupTemplateContext> | null {
        return this.contentGroupHeaderActions ?? this.GroupHeaderActionsTemplate ?? null;
    }

    public get EffectiveGroupFooterTemplate(): TemplateRef<TaskWbsGroupTemplateContext> | null {
        return this.contentGroupFooter ?? this.GroupFooterTemplate ?? null;
    }

    public get EffectiveDetailTopExtensionTemplate(): TemplateRef<TaskDetailTopExtensionContext> | null {
        return this.contentDetailTopExtension ?? this.DetailTopExtensionTemplate ?? null;
    }

    /** Resolves a task's Space Band from `TaskBands` (case-insensitive), falling back to `DefaultBand`. */
    public ResolveTaskBand(taskId: string | null | undefined): SpaceBand {
        if (!taskId || !this.TaskBands) {
            return this._defaultBand;
        }
        if (this.TaskBands instanceof Map) {
            const direct = this.TaskBands.get(taskId);
            if (direct) return direct;
            const lower = taskId.toLowerCase();
            const lowerHit = this.TaskBands.get(lower);
            if (lowerHit) return lowerHit;
            for (const [key, band] of this.TaskBands.entries()) {
                if (key.toLowerCase() === lower) {
                    return band;
                }
            }
            return this._defaultBand;
        }
        const record = this.TaskBands as Readonly<Record<string, SpaceBand>>;
        const direct = record[taskId];
        if (direct) return direct;
        const lower = taskId.toLowerCase();
        const lowerHit = record[lower];
        if (lowerHit) return lowerHit;
        for (const [key, band] of Object.entries(record)) {
            if (key.toLowerCase() === lower) {
                return band;
            }
        }
        return this._defaultBand;
    }

    /** True when the task passes both the fail-closed Team security guard AND the active audience filter chip. */
    public IsTaskVisibleForAudience(task: TaskWidgetItem): boolean {
        const band = this.ResolveTaskBand(task.ID);
        if (!this.CanSeeTeamSide && band === 'Team') {
            return false;
        }
        const activeFilter = this.EffectiveBandFilter;
        if (activeFilter !== 'all' && band !== activeFilter) {
            return false;
        }
        return true;
    }

    /** Audience-filtered single-space tasks (null when in Sub-Space Portfolio mode or self-fetching mode). */
    public get AudienceFilteredTasks(): readonly TaskWidgetItem[] | null {
        if (this.SubSpaceGroups !== null) {
            return null;
        }
        if (this.Tasks === null) {
            return null;
        }
        return this.Tasks.filter((t) => this.IsTaskVisibleForAudience(t));
    }

    /** Audience-filtered hub tasks (supports either `[HubTasks]` or `[Tasks]` alongside `[SubSpaceGroups]`). */
    public get AudienceFilteredHubTasks(): readonly TaskWidgetItem[] | null {
        if (this.SubSpaceGroups === null) {
            return null;
        }
        const rawHub = this.HubTasks ?? this.Tasks;
        if (rawHub === null) {
            return null;
        }
        return rawHub.filter((t) => this.IsTaskVisibleForAudience(t));
    }

    /** Audience-filtered child-space portfolio groups (null in single-space mode). */
    public get AudienceFilteredSubSpaceGroups(): readonly TaskWbsGroup[] | null {
        if (this.SubSpaceGroups === null) {
            return null;
        }
        return this.SubSpaceGroups.map((group) => ({
            ...group,
            Tasks: (group.Tasks ?? []).filter((t) => this.IsTaskVisibleForAudience(t)),
        }));
    }

    /** Flat deduped list of all audience-visible controlled tasks (used for KPI summary metrics). */
    public get AllAudienceVisibleTasks(): readonly TaskWidgetItem[] | null {
        if (this.SubSpaceGroups !== null) {
            const seen = new Set<string>();
            const merged: TaskWidgetItem[] = [];
            const pushUnique = (items: readonly TaskWidgetItem[] | null | undefined): void => {
                if (!items) return;
                for (const item of items) {
                    const key = item.ID.toLowerCase();
                    if (!seen.has(key)) {
                        seen.add(key);
                        merged.push(item);
                    }
                }
            };
            pushUnique(this.AudienceFilteredHubTasks);
            for (const g of this.AudienceFilteredSubSpaceGroups ?? []) {
                pushUnique(g.Tasks);
            }
            return merged;
        }
        return this.AudienceFilteredTasks;
    }

    /** Computed WBS summary metrics over audience-visible tasks (never leaks Team counts to Shared viewers). */
    public get EffectiveSummary(): TaskWbsSummaryMetrics | null {
        const visible = this.AllAudienceVisibleTasks;
        if (visible === null) {
            return null;
        }
        return ComputeWbsSummary(BuildWbsTree(visible));
    }

    public get ShouldRenderSummaryStrip(): boolean {
        if (!this.ShowSummaryStrip) return false;
        return (
            this.EffectiveSummary !== null ||
            (this.LeadingSummaryTiles?.length ?? 0) > 0 ||
            (this.ExtraSummaryTiles?.length ?? 0) > 0
        );
    }

    private get shouldApplySummaryFilterToPanelData(): boolean {
        const mode = this.taskPanel?.ViewMode ?? this.activeViewMode;
        return (
            mode !== 'wbs' &&
            this.ActiveSummaryFilterKey !== null &&
            this.ActiveSummaryFilterKey !== 'all' &&
            BUILTIN_SUMMARY_FILTER_KEYS.has(this.ActiveSummaryFilterKey)
        );
    }

    /** Tasks forwarded to `<bizapps-task-panel [Tasks]>` in single-space mode. */
    public get EffectivePanelSingleTasks(): readonly TaskWidgetItem[] | null {
        const base = this.AudienceFilteredTasks;
        if (base === null) return null;
        if (!this.shouldApplySummaryFilterToPanelData || !this.ActiveSummaryFilterKey) {
            return base;
        }
        const key = this.ActiveSummaryFilterKey;
        return base.filter((t) => matchesSummaryStatusFilter(t, key));
    }

    /** Hub tasks forwarded to `<bizapps-task-panel [HubTasks]>` in portfolio mode. */
    public get EffectivePanelHubTasks(): readonly TaskWidgetItem[] | null {
        const base = this.AudienceFilteredHubTasks;
        if (base === null) return null;
        if (!this.shouldApplySummaryFilterToPanelData || !this.ActiveSummaryFilterKey) {
            return base;
        }
        const key = this.ActiveSummaryFilterKey;
        return base.filter((t) => matchesSummaryStatusFilter(t, key));
    }

    /** Groups forwarded to `<bizapps-task-panel [Groups]>` in Sub-Space Portfolio mode. */
    public get EffectivePanelGroups(): readonly TaskWbsGroup[] | null {
        const baseGroups = this.AudienceFilteredSubSpaceGroups;
        if (baseGroups === null) return null;

        const applyStatus = this.shouldApplySummaryFilterToPanelData && !!this.ActiveSummaryFilterKey;
        const filterKey = this.ActiveSummaryFilterKey ?? 'all';
        const groups = applyStatus
            ? baseGroups.map((g) => ({
                  ...g,
                  Tasks: g.Tasks.filter((t) => matchesSummaryStatusFilter(t, filterKey)),
              }))
            : baseGroups;

        const hubTasks = this.EffectivePanelHubTasks;
        if (hubTasks && hubTasks.length > 0) {
            const hubGroup: TaskWbsGroup = {
                ID: HUB_GROUP_ID,
                Title: this.HubGroupTitle || 'Space-Level Tasks',
                Subtitle: this.HubGroupSubtitle || undefined,
                Tasks: hubTasks,
            };
            return [hubGroup, ...groups];
        }
        return groups;
    }

    /** Highlights Team-band items with a subtle muted tone for internal viewers while letting host tones take precedence. */
    public readonly effectiveRowToneResolver = (task: TaskWidgetItem): TaskWbsRowTone => {
        if (this.RowToneResolver) {
            const hostTone = this.RowToneResolver(task);
            if (hostTone && hostTone !== 'default') {
                return hostTone;
            }
        }
        if (this.CanSeeTeamSide && this.ResolveTaskBand(task.ID) === 'Team') {
            return 'muted';
        }
        return 'default';
    };

    // ── Public Imperative API ───────────────────────────────

    public OpenTaskDetail(taskId: string): void {
        this.taskPanel?.OpenDetail(taskId);
    }

    public CloseTaskDetail(): void {
        this.taskPanel?.CloseDetail();
    }

    public OpenTaskEdit(taskId: string | null): void {
        this.taskPanel?.OpenEdit(taskId);
    }

    public SetViewMode(mode: TaskViewMode): void {
        this.activeViewMode = mode;
        this.taskPanel?.SetViewMode(mode);
        this.cdr?.markForCheck();
    }

    public Refresh(): void {
        this.taskPanel?.Refresh();
    }

    // ── Audience & Quick-Add Controls ───────────────────────

    public SetBandFilter(band: SpaceWorkBandFilter): void {
        const resolved: SpaceWorkBandFilter = !this.CanSeeTeamSide && band === 'Team' ? 'all' : band;
        this.BandFilter = resolved;
        this.BandFilterChange.emit(resolved);
        this.cdr?.markForCheck();
    }

    public ToggleQuickAdd(): void {
        if (!this.CanCreateTask || this.ReadOnly) return;
        this.IsAddingTask = !this.IsAddingTask;
        if (this.IsAddingTask) {
            this.NewTaskBand = this.resolveStartBand();
        }
        this.cdr?.markForCheck();
    }

    public CancelQuickAdd(): void {
        this.IsAddingTask = false;
        this.NewTaskTitle = '';
        this.cdr?.markForCheck();
    }

    public SubmitQuickAdd(): void {
        if (!this.CanCreateTask || this.ReadOnly) return;
        const title = this.NewTaskTitle.trim();
        if (!title) return;
        const allowed = this.EffectiveAllowedBands;
        const band: SpaceBand = allowed.includes(this.NewTaskBand) ? this.NewTaskBand : this.resolveStartBand();
        this.TaskAdd.emit({
            Title: title,
            Band: band,
            Priority: this.NewTaskPriority,
        });
        this.NewTaskTitle = '';
        this.NewTaskBand = this.resolveStartBand();
        this.IsAddingTask = false;
        this.cdr?.markForCheck();
    }

    private resolveStartBand(): SpaceBand {
        const allowed = this.EffectiveAllowedBands;
        if (allowed.length === 0) return 'Shared';
        return allowed.includes(this._defaultBand) ? this._defaultBand : allowed[0];
    }

    // ── Event Handlers ──────────────────────────────────────

    public onSummaryTileClicked(key: string): void {
        this.SummaryTileClicked.emit(key);
        if (BUILTIN_SUMMARY_FILTER_KEYS.has(key)) {
            const nextKey = key !== 'all' && this.ActiveSummaryFilterKey === key ? 'all' : key;
            this.ActiveSummaryFilterKey = nextKey;
            this.taskPanel?.taskWbs?.SetFilter(nextKey);
            this.cdr?.markForCheck();
        }
    }

    public onPanelViewModeChange(mode: TaskViewMode): void {
        this.activeViewMode = mode;
        this.ViewModeChange.emit(mode);
        if (mode === 'wbs' && this.ActiveSummaryFilterKey && BUILTIN_SUMMARY_FILTER_KEYS.has(this.ActiveSummaryFilterKey)) {
            this.taskPanel?.taskWbs?.SetFilter(this.ActiveSummaryFilterKey);
        }
        this.cdr?.markForCheck();
    }

    public onAfterStatusChange(row: TaskRow): void {
        this.AfterStatusChange.emit(row);
        this.TaskMutated.emit(row.ID);
    }

    public onAfterKanbanStatusChange(event: AfterKanbanStatusChangeEvent): void {
        this.AfterKanbanStatusChange.emit(event);
        this.TaskMutated.emit(event.TaskID);
    }

    public onAfterTaskSaved(taskId: string): void {
        this.AfterTaskSaved.emit(taskId);
        this.TaskMutated.emit(taskId);
    }

    public onAfterTaskCreated(taskId: string): void {
        this.AfterTaskCreated.emit(taskId);
        this.TaskMutated.emit(taskId);
    }
}
