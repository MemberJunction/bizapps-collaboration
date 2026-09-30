import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SpaceBand, TaskItemModel } from './types';
import { isTaskClosed, isTaskInProgress, taskPriorityClass, taskPriorityLabel, taskStatusClass, taskStatusLabel } from './task-status';
import { CollabAvatarComponent } from './avatar.component';
import { CollabBandChipComponent } from './band-chip.component';
import { MJButtonDirective, MJClickableDirective, MJDropdownComponent, MJEmptyStateComponent, MJFilterChipComponent } from '@memberjunction/ng-ui-components';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-space-work',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CollabAvatarComponent, CollabBandChipComponent, MJButtonDirective, MJClickableDirective, MJDropdownComponent, MJEmptyStateComponent, MJFilterChipComponent],
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
          <i class="fa-solid fa-magnifying-glass search-ic"></i>
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

        <div class="spacer"></div>

        @if (CanCreateTask) {
          <button type="button" mjButton variant="primary" size="sm" (click)="openAddTask()">
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
          <button type="button" mjButton variant="primary" size="sm" [disabled]="!newTaskName.trim()" (click)="submitNewTask()">
            Add
          </button>
          <button type="button" mjButton variant="flat" size="sm" (click)="isAddingTask = false">
            Cancel
          </button>
        </div>
      }

      <!-- Tasks List / Table -->
      <div class="tasks-table-card">
        <div class="table-head">
          <div class="th-check"></div>
          <div class="th-title">Task</div>
          <div class="th-band">Audience</div>
          <div class="th-priority">Priority</div>
          <div class="th-status">Status</div>
          <div class="th-assignee">Assignee</div>
          <div class="th-date">Due</div>
        </div>

        <div class="table-body">
          @if (filteredTasks.length === 0) {
            <mj-empty-state
              Icon="fa-solid fa-list-check"
              Title="No tasks found"
              [Message]="searchQuery || statusFilter !== 'all' || bandFilter !== 'all' ? 'Try clearing your filters or search query.' : 'Get started by adding the first task to this space.'"
              Size="compact" />
          } @else {
            @for (task of filteredTasks; track task.id) {
              <div
                class="task-row"
                [class.is-done]="task.status === 'Completed'"
                (click)="onTaskClick(task)"
              >
                <div class="td-check" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    [checked]="task.status === 'Completed'"
                    [disabled]="ReadOnly"
                    [attr.aria-label]="'Mark ' + task.name + ' as ' + (task.status === 'Completed' ? 'not done' : 'done')"
                    (change)="onToggleTask(task)"
                    class="task-checkbox"
                  />
                </div>

                <div class="td-title" [mjClickable]="task.name">
                  <span class="task-name">{{ task.name }}</span>
                  @if (task.description) {
                    <span class="task-desc">{{ task.description }}</span>
                  }
                </div>

                <div class="td-band" (click)="$event.stopPropagation()">
                  <mjc-band-chip [Band]="task.band" />
                </div>

                <div class="td-priority">
                  <span class="priority-badge" [class]="priorityClass(task.priority)">
                    {{ priorityLabel(task.priority) }}
                  </span>
                </div>

                <div class="td-status">
                  <span class="status-badge" [class]="statusClass(task.status)">
                    {{ statusLabel(task.status) }}
                  </span>
                </div>

                <div class="td-assignee">
                  @if (task.assigneeName) {
                    <div class="assignee-wrap">
                      <mjc-avatar
                        [Initials]="task.assigneeInitials || 'TM'"
                        [ColorClass]="'c1'"
                        Size="sm"
                      />
                      <span class="assignee-name">{{ task.assigneeName }}</span>
                    </div>
                  } @else {
                    <span class="unassigned">Unassigned</span>
                  }
                </div>

                <div class="td-date">
                  <span class="due-text">{{ task.dueDate || '—' }}</span>
                </div>
              </div>
            }
          }
        </div>
      </div>
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
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 8px;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .stat-num {
        font-size: 24px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
      }
      .stat-num.in-progress { color: var(--mj-status-info); }
      .stat-num.completed { color: var(--mj-status-success); }
      .stat-num.shared { color: var(--mjc-shared, #0076b6); }
      .stat-lbl {
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
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
        color: var(--mj-text-muted, #94a3b8);
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
      }
      .spacer { flex: 1 1 auto; }

      .add-task-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-strong, #cbd5e1);
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
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 8px;
        overflow: hidden;
      }
      .table-head {
        display: flex;
        align-items: center;
        padding: 10px 16px;
        background: var(--mj-bg-surface-card, #f8fafc);
        border-bottom: 1px solid var(--mj-border-subtle, #e2e8f0);
        font-size: 12px;
        font-weight: 600;
        color: var(--mj-text-muted, #94a3b8);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .th-check, .td-check { width: 36px; display: flex; align-items: center; }
      .th-title, .td-title { flex: 1 1 300px; min-width: 0; }
      .th-band, .td-band { width: 140px; }
      .th-priority, .td-priority { width: 100px; }
      .th-status, .td-status { width: 120px; }
      .th-assignee, .td-assignee { width: 160px; }
      .th-date, .td-date { width: 100px; text-align: right; }

      .table-body {
        display: flex;
        flex-direction: column;
      }
      .task-row {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--mj-border-subtle, #f1f5f9);
        transition: background 0.15s ease;
        cursor: pointer;
      }
      .task-row:last-child { border-bottom: none; }
      .task-row:hover {
        background: var(--mj-bg-surface-hover, #f8fafc);
      }
      .task-row.is-done {
        opacity: 0.65;
      }
      .task-row.is-done .task-name {
        text-decoration: line-through;
      }
      .task-checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: var(--mj-brand-primary, #0076b6);
      }
      .task-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--mj-text-primary, #0f172a);
        display: block;
      }
      .task-desc {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
        display: block;
        margin-top: 2px;
      }
      .priority-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: capitalize;
      }
      .priority-badge.priority-low { background: var(--mj-bg-surface-sunken); color: var(--mj-text-secondary); }
      .priority-badge.priority-medium { background: var(--mj-status-info-bg); color: var(--mj-status-info-text); }
      .priority-badge.priority-high { background: var(--mj-status-warning-bg); color: var(--mj-status-warning-text); }
      .priority-badge.priority-critical { background: var(--mj-status-error-bg); color: var(--mj-status-error-text); }

      .status-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .status-badge.status-open { background: var(--mj-bg-surface-sunken); color: var(--mj-text-muted); }
      .status-badge.status-inprogress { background: var(--mj-status-info-bg); color: var(--mj-status-info-text); }
      .status-badge.status-completed { background: var(--mj-status-success-bg); color: var(--mj-status-success-text); }
      .status-badge.status-blocked { background: var(--mj-status-warning-bg); color: var(--mj-status-warning-text); }
      .status-badge.status-cancelled { background: var(--mj-bg-surface-sunken); color: var(--mj-text-disabled); }

      .assignee-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .assignee-name {
        font-size: 12px;
        color: var(--mj-text-secondary, #475569);
      }
      .unassigned {
        font-size: 12px;
        color: var(--mj-text-muted, #94a3b8);
      }
      .due-text {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

    `,
  ],
})
export class CollabSpaceWorkComponent {
  @Input() Tasks: TaskItemModel[] = [];
  @Input() SpaceName = '';
  @Input() CanCreateTask = true;
  /** A closed space, or a seat that may not contribute: the checkboxes are off, as they are on the board. */
  @Input() ReadOnly = false;
  /** The bands this seat may file a task on. With one, the choice isn't offered. */
  @Input() AllowedBands: readonly SpaceBand[] = ['Shared', 'Team'];
  /** False for a seat that can't see the Team band: no Team filter. */
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
    return this.AllowedBands.map((band) => ({ band, label: band === 'Shared' ? 'Shared with Outside' : 'Team only' }));
  }
  public newTaskPriority = 'Medium';

  public openAddTask(): void {
    this.isAddingTask = !this.isAddingTask;
    if (this.isAddingTask) {
      this.newTaskBand = this.startBand();
    }
  }

  /** The band a new task starts on: the default when this seat may use it, else the one band it may. */
  private startBand(): SpaceBand {
    return this.AllowedBands.includes(this.DefaultBand) ? this.DefaultBand : (this.AllowedBands[0] ?? this.DefaultBand);
  }

  public get TotalTasks(): number {
    return this.Tasks.length;
  }

  public get InProgressCount(): number {
    return this.Tasks.filter((t) => isTaskInProgress(t.status)).length;
  }

  public get CompletedCount(): number {
    return this.Tasks.filter((t) => t.status === 'Completed').length;
  }

  public get SharedCount(): number {
    return this.Tasks.filter((t) => t.band === 'Shared').length;
  }

  public get filteredTasks(): TaskItemModel[] {
    return this.Tasks.filter((task) => {
      // Search query filter
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        const matchesName = task.name.toLowerCase().includes(q);
        const matchesDesc = task.description ? task.description.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesDesc) return false;
      }

      // Status filter
      if (this.statusFilter === 'active' && isTaskClosed(task.status)) return false;
      if (this.statusFilter === 'completed' && task.status !== 'Completed') return false;

      // Band filter
      if (this.bandFilter !== 'all' && task.band !== this.bandFilter) return false;

      return true;
    });
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
    this.CreateTaskRequested.emit({
      name: this.newTaskName.trim(),
      band: this.AllowedBands.includes(this.newTaskBand) ? this.newTaskBand : this.startBand(),
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
