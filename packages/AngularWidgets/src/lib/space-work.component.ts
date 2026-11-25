import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TaskWbsTreeComponent,
  type TaskPriorityValue,
  type TaskStatusValue,
  type TaskWbsKindLabel,
  type TaskWidgetItem,
} from '@mj-biz-apps/tasks-ng-widgets';
import type { SpaceBand, TaskItemModel } from './types';
import { isTaskClosed, isTaskInProgress, taskPriorityClass, taskPriorityLabel, taskStatusClass, taskStatusLabel } from './task-status';
import { CollabBandChipComponent } from './band-chip.component';
import { MJButtonDirective, MJDropdownComponent, MJFilterChipComponent } from '@memberjunction/ng-ui-components';
import { COLLAB_TOKENS_CSS } from './tokens';

function normalizeWbsStatus(status: string): TaskStatusValue {
  switch (status) {
    case 'InProgress':
    case 'In Progress':
      return 'InProgress';
    case 'Completed':
      return 'Completed';
    case 'Blocked':
      return 'Blocked';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return 'Open';
  }
}

function normalizeWbsPriority(priority: string): TaskPriorityValue {
  switch (priority) {
    case 'Low':
      return 'Low';
    case 'High':
      return 'High';
    case 'Critical':
    case 'Urgent':
      return 'Critical';
    default:
      return 'Medium';
  }
}

function normalizeWbsKindLabel(kind: string | null | undefined): TaskWbsKindLabel | null {
  if (kind === 'Phase' || kind === 'Milestone' || kind === 'Task' || kind === 'Subtask') {
    return kind;
  }
  return null;
}

@Component({
  selector: 'mjc-space-work',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CollabBandChipComponent, MJButtonDirective, MJDropdownComponent, MJFilterChipComponent, TaskWbsTreeComponent],
  template: `
    <div class="work-container">
      <!-- Header stats -->
      <div class="work-stats">
        <div class="stat-card">
          <span class="stat-num">{{ TotalTasks }}</span>
          <span class="stat-lbl">Total Tasks</span>
        </div>
        <div class="stat-card">
          <span class="stat-num in-progress">{{ InProgressCount }}</span>
          <span class="stat-lbl">In progress</span>
        </div>
        <div class="stat-card">
          <span class="stat-num completed">{{ CompletedCount }}</span>
          <span class="stat-lbl">Completed</span>
        </div>
        <div class="stat-card">
          <span class="stat-num shared">{{ SharedCount }}</span>
          <span class="stat-lbl">Shared with Outside</span>
        </div>
      </div>

      <!-- Action & Filter Bar -->
      <div class="filter-bar">
        <div class="search-box">
          <i class="fa-solid fa-magnifying-glass search-ic" aria-hidden="true"></i>
          <input
            type="text"
            placeholder="Search tasks..."
            aria-label="Search tasks"
            [(ngModel)]="searchQuery"
            class="mj-input search-input"
          />
        </div>

        <div class="filter-group" role="group" aria-label="Status">
          <mj-filter-chip Label="All" [Active]="statusFilter === 'all'" (Clicked)="statusFilter = 'all'" />
          <mj-filter-chip Label="Active" [Active]="statusFilter === 'active'" (Clicked)="statusFilter = 'active'" />
          <mj-filter-chip Label="Completed" [Active]="statusFilter === 'completed'" (Clicked)="statusFilter = 'completed'" />
        </div>

        <div class="filter-group" role="group" aria-label="Audience">
          <mj-filter-chip Label="All bands" [Active]="bandFilter === 'all'" (Clicked)="bandFilter = 'all'" />
          <mj-filter-chip Label="Shared" [Active]="bandFilter === 'Shared'" (Clicked)="bandFilter = 'Shared'" />
          @if (CanSeeTeamSide) {
            <mj-filter-chip Label="Team" [Active]="bandFilter === 'Team'" (Clicked)="bandFilter = 'Team'" />
          }
        </div>

        @if (hasHierarchy) {
          <div class="filter-group" role="group" aria-label="Tree expansion">
            <button type="button" mjButton Variant="outline" Size="sm" (click)="expandAll()">
              <i class="fa-solid fa-angles-down" aria-hidden="true"></i>
              <span>Expand All</span>
            </button>
            <button type="button" mjButton Variant="outline" Size="sm" (click)="collapseAll()">
              <i class="fa-solid fa-angles-up" aria-hidden="true"></i>
              <span>Collapse All</span>
            </button>
          </div>
        }

        <div class="spacer"></div>

        @if (CanCreateTask) {
          <button type="button" mjButton Variant="primary" Size="sm" (click)="openAddTask()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i>
            <span>Add task</span>
          </button>
        }
      </div>

      <!-- Inline Add Task Row -->
      @if (isAddingTask && CanCreateTask) {
        <div class="add-task-row">
          <input
            type="text"
            placeholder="Task title..."
            aria-label="Task title"
            [(ngModel)]="newTaskName"
            (keydown.enter)="submitNewTask()"
            class="mj-input new-task-input"
            autofocus
          />
          @if (AllowedBands.length > 1) {
            <mj-dropdown
              class="new-task-select"
              AriaLabel="Who can see this task"
              [Data]="bandChoices"
              TextField="label"
              ValueField="band"
              [ValuePrimitive]="true"
              [(ngModel)]="newTaskBand" />
          }
          <mj-dropdown
            class="new-task-select"
            AriaLabel="Priority"
            [Data]="priorityChoices"
            [ValuePrimitive]="true"
            [(ngModel)]="newTaskPriority" />
          <button type="button" mjButton Variant="primary" Size="sm" [disabled]="!newTaskName.trim()" (click)="submitNewTask()">
            Add
          </button>
          <button type="button" mjButton Variant="flat" Size="sm" (click)="isAddingTask = false">
            Cancel
          </button>
        </div>
      }

      <!-- Hierarchical WBS Tree with Band Chip projection -->
      <div class="tasks-table-card">
        <mjt-wbs-tree
          #wbsTree
          [Tasks]="wbsTasks"
          [ShowToolbar]="false"
          [ShowWbsCodes]="true"
          [ShowTreeConnectors]="true"
          [ShowProgressBars]="true"
          [ReadOnly]="ReadOnly"
          [RowBadgesTemplate]="bandBadgeTemplate"
          EmptyTitle="No tasks found"
          [EmptyMessage]="searchQuery || statusFilter !== 'all' || bandFilter !== 'all' ? 'Try clearing your filters or search query.' : 'Get started by adding the first task to this space.'"
          (TaskClicked)="onWbsTaskClicked($event)"
          (StatusToggled)="onWbsStatusToggled($event)"
        />
      </div>

      <ng-template #bandBadgeTemplate let-task>
        <mjc-band-chip [Band]="bandForTaskId(task.ID)" Size="sm" />
      </ng-template>
    </div>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      .work-container {
        padding: 24px 32px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 1200px;
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;
      }
      .work-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
      .stat-card {
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-subtle);
        border-radius: 8px;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .stat-num {
        font-size: 24px;
        font-weight: 700;
        color: var(--mj-text-primary);
      }
      .stat-num.in-progress { color: var(--mj-status-info); }
      .stat-num.completed { color: var(--mj-status-success); }
      .stat-num.shared { color: var(--mjc-shared); }
      .stat-lbl {
        font-size: 13px;
        color: var(--mj-text-secondary);
      }

      .filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .search-box {
        position: relative;
        display: flex;
        align-items: center;
      }
      .search-ic {
        position: absolute;
        left: 10px;
        color: var(--mj-text-muted);
        font-size: 13px;
      }
      /* MJ's .mj-input draws the field; this keeps room for the search icon and a width */
      .search-input {
        padding-left: 32px;
        width: 240px;
      }
      .filter-group {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .spacer { flex: 1 1 auto; }

      .add-task-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-strong);
        border-radius: 6px;
        padding: 10px 14px;
        box-shadow: var(--mj-shadow-md);
      }
      .new-task-input {
        flex: 1 1 200px;
      }
      .new-task-select {
        min-width: 150px;
      }

      .tasks-table-card {
        background: var(--mj-bg-surface);
        border: 1px solid var(--mj-border-subtle);
        border-radius: 8px;
        padding: 12px;
      }
    `,
  ],
})
export class CollabSpaceWorkComponent {
  @Input() Tasks: TaskItemModel[] = [];
  @Input() SpaceName = '';
  @Input() CanCreateTask = true;
  /** A closed space, or a seat that may not contribute: the completion rings are off, as they are on the board. */
  @Input() ReadOnly = false;
  /** The bands this seat may file a task on. With one, the choice isn't offered. */
  @Input() AllowedBands: readonly SpaceBand[] = ['Shared', 'Team'];
  /** False for a seat that can't see the Team band: no Team filter and Team tasks are stripped. */
  @Input() CanSeeTeamSide = true;
  @Input() public set DefaultBand(val: SpaceBand) {
    this._defaultBand = val || 'Shared';
    this.newTaskBand = this._defaultBand;
  }
  public get DefaultBand(): SpaceBand {
    return this._defaultBand;
  }
  private _defaultBand: SpaceBand = 'Shared';

  @Output() TaskSelectRequested = new EventEmitter<TaskItemModel>();
  @Output() TaskToggleRequested = new EventEmitter<TaskItemModel>();
  @Output() CreateTaskRequested = new EventEmitter<{ name: string; band: SpaceBand; priority: string }>();

  @ViewChild('wbsTree') public wbsTree?: TaskWbsTreeComponent;

  public searchQuery = '';
  public statusFilter: 'all' | 'active' | 'completed' = 'all';
  public bandFilter: 'all' | 'Shared' | 'Team' = 'all';

  public isAddingTask = false;
  public newTaskName = '';
  public newTaskBand: SpaceBand = 'Shared';
  /** The priorities a new task may take, as the dropdown lists them. */
  public readonly priorityChoices: readonly string[] = ['Low', 'Medium', 'High', 'Critical'];

  /** The bands a new task may be on, each with the words the screen uses for it. */
  public get bandChoices(): Array<{ band: SpaceBand; label: string }> {
    const allowed = this.CanSeeTeamSide ? this.AllowedBands : this.AllowedBands.filter((b) => b === 'Shared');
    return allowed.map((band) => ({ band, label: band === 'Shared' ? 'Shared with Outside' : 'Team only' }));
  }
  public newTaskPriority = 'Medium';

  public openAddTask(): void {
    this.isAddingTask = !this.isAddingTask;
    if (this.isAddingTask) {
      this.newTaskBand = this.startBand();
    }
  }

  public expandAll(): void {
    this.wbsTree?.ExpandAll();
  }

  public collapseAll(): void {
    this.wbsTree?.CollapseAll();
  }

  /** The band a new task starts on: the default when this seat may use it, else the one band it may. */
  private startBand(): SpaceBand {
    const allowed = this.CanSeeTeamSide ? this.AllowedBands : this.AllowedBands.filter((b) => b === 'Shared');
    if (allowed.length === 0) return 'Shared';
    return allowed.includes(this.DefaultBand) ? this.DefaultBand : allowed[0];
  }

  /** Audience-enforced task set: strips Team tasks whenever the seat cannot see the Team band. */
  private get visibleTasks(): TaskItemModel[] {
    if (this.CanSeeTeamSide) {
      return this.Tasks ?? [];
    }
    return (this.Tasks ?? []).filter((t) => t.band !== 'Team');
  }

  public get TotalTasks(): number {
    return this.visibleTasks.length;
  }

  public get InProgressCount(): number {
    return this.visibleTasks.filter((t) => isTaskInProgress(t.status)).length;
  }

  public get CompletedCount(): number {
    return this.visibleTasks.filter((t) => t.status === 'Completed').length;
  }

  public get SharedCount(): number {
    return this.visibleTasks.filter((t) => t.band === 'Shared').length;
  }

  public get hasHierarchy(): boolean {
    return this.visibleTasks.some((t) => !!t.parentId);
  }

  public get filteredTasks(): TaskItemModel[] {
    const effectiveBandFilter = !this.CanSeeTeamSide && this.bandFilter === 'Team' ? 'all' : this.bandFilter;
    return this.visibleTasks.filter((task) => {
      // Search query filter
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        const matchesName = task.name.toLowerCase().includes(q);
        const matchesDesc = task.description ? task.description.toLowerCase().includes(q) : false;
        const matchesBlocked = task.blockedReason ? task.blockedReason.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesDesc && !matchesBlocked) return false;
      }

      // Status filter
      if (this.statusFilter === 'active' && isTaskClosed(task.status)) return false;
      if (this.statusFilter === 'completed' && task.status !== 'Completed') return false;

      // Band filter
      if (effectiveBandFilter !== 'all' && task.band !== effectiveBandFilter) return false;

      return true;
    });
  }

  /** Projects filtered Collaboration tasks into `<mjt-wbs-tree>` `TaskWidgetItem[]` preserving WBS hierarchy. */
  public get wbsTasks(): TaskWidgetItem[] {
    return this.filteredTasks.map((task) => {
      const assignees = task.assigneeNames && task.assigneeNames.length > 0
        ? task.assigneeNames
        : task.assigneeName
          ? [task.assigneeName]
          : undefined;
      return {
        ID: task.id,
        Name: task.name,
        Description: task.description ?? null,
        ParentID: task.parentId ?? null,
        Status: normalizeWbsStatus(task.status),
        Priority: normalizeWbsPriority(task.priority),
        PercentComplete: task.percentComplete ?? null,
        DueDate: task.dueDate ?? null,
        BlockedReason: task.blockedReason ?? null,
        KindLabel: normalizeWbsKindLabel(task.kindLabel),
        Sequence: task.sequence ?? null,
        AssigneeNames: assignees,
        ChildCount: task.subtaskCount,
      };
    });
  }

  public bandForTaskId(taskId: string): SpaceBand {
    const target = taskId.toLowerCase();
    const match = this.visibleTasks.find((t) => t.id.toLowerCase() === target);
    return match?.band ?? 'Shared';
  }

  public onWbsTaskClicked(item: TaskWidgetItem): void {
    const match = this.findTaskById(item.ID);
    if (match) {
      this.onTaskClick(match);
    }
  }

  public onWbsStatusToggled(event: { TaskID: string; NewStatus: TaskStatusValue }): void {
    if (this.ReadOnly) return;
    const match = this.findTaskById(event.TaskID);
    if (match) {
      this.onToggleTask(match);
    }
  }

  private findTaskById(taskId: string): TaskItemModel | undefined {
    const target = taskId.toLowerCase();
    return this.visibleTasks.find((t) => t.id.toLowerCase() === target);
  }

  public onToggleTask(task: TaskItemModel): void {
    if (this.ReadOnly) return;
    this.TaskToggleRequested.emit(task);
  }

  public onTaskClick(task: TaskItemModel): void {
    this.TaskSelectRequested.emit(task);
  }

  public submitNewTask(): void {
    if (!this.newTaskName.trim()) return;
    const allowed = this.CanSeeTeamSide ? this.AllowedBands : this.AllowedBands.filter((b) => b === 'Shared');
    const resolvedBand = allowed.includes(this.newTaskBand) ? this.newTaskBand : this.startBand();
    this.CreateTaskRequested.emit({
      name: this.newTaskName.trim(),
      band: resolvedBand,
      priority: this.newTaskPriority,
    });
    this.newTaskName = '';
    this.newTaskBand = this.startBand();
    this.isAddingTask = false;
  }

  public statusLabel(status: string): string {
    return taskStatusLabel(status);
  }

  public statusClass(status: string): string {
    return taskStatusClass(status);
  }

  public priorityLabel(priority: string): string {
    return taskPriorityLabel(priority);
  }

  public priorityClass(priority: string): string {
    return taskPriorityClass(priority);
  }
}
