import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SpaceBand, TaskItemModel } from './types';
import { CollabAvatarComponent } from './avatar.component';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-space-work',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CollabAvatarComponent, CollabBandChipComponent],
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
          <span class="stat-lbl">In Progress</span>
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
            [(ngModel)]="searchQuery"
            class="search-input"
          />
        </div>

        <div class="filter-group">
          <button
            class="pill-btn"
            [class.active]="statusFilter === 'all'"
            (click)="statusFilter = 'all'"
          >All</button>
          <button
            class="pill-btn"
            [class.active]="statusFilter === 'active'"
            (click)="statusFilter = 'active'"
          >Active</button>
          <button
            class="pill-btn"
            [class.active]="statusFilter === 'completed'"
            (click)="statusFilter = 'completed'"
          >Completed</button>
        </div>

        <div class="filter-group">
          <button
            class="pill-btn"
            [class.active]="bandFilter === 'all'"
            (click)="bandFilter = 'all'"
          >All bands</button>
          <button
            class="pill-btn"
            [class.active]="bandFilter === 'Shared'"
            (click)="bandFilter = 'Shared'"
          >Shared</button>
          <button
            class="pill-btn"
            [class.active]="bandFilter === 'Team'"
            (click)="bandFilter = 'Team'"
          >Team</button>
        </div>

        <div class="spacer"></div>

        @if (CanCreateTask) {
          <button class="add-task-btn" (click)="openAddTask()">
            <i class="fa-solid fa-plus"></i>
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
            [(ngModel)]="newTaskName"
            (keydown.enter)="submitNewTask()"
            class="new-task-input"
            autofocus
          />
          <select [(ngModel)]="newTaskBand" class="new-task-select">
            <option value="Shared">Shared with Outside</option>
            <option value="Team">Team only</option>
          </select>
          <select [(ngModel)]="newTaskPriority" class="new-task-select">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
          <button class="save-task-btn" [disabled]="!newTaskName.trim()" (click)="submitNewTask()">
            Add
          </button>
          <button class="cancel-task-btn" (click)="isAddingTask = false">
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
            <div class="no-tasks">
              <i class="fa-solid fa-list-check empty-ic"></i>
              <div class="empty-title">No tasks found</div>
              <div class="empty-sub">
                @if (searchQuery || statusFilter !== 'all' || bandFilter !== 'all') {
                  Try clearing your filters or search query.
                } @else {
                  Get started by adding the first task to this space.
                }
              </div>
            </div>
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
                    (change)="onToggleTask(task)"
                    class="task-checkbox"
                  />
                </div>

                <div class="td-title">
                  <span class="task-name">{{ task.name }}</span>
                  @if (task.description) {
                    <span class="task-desc">{{ task.description }}</span>
                  }
                </div>

                <div class="td-band" (click)="$event.stopPropagation()">
                  <mjc-band-chip [Band]="task.band" />
                </div>

                <div class="td-priority">
                  <span class="priority-badge" [class]="task.priority.toLowerCase()">
                    {{ task.priority }}
                  </span>
                </div>

                <div class="td-status">
                  <span class="status-badge" [class]="formatStatusClass(task.status)">
                    {{ task.status }}
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
      .stat-num.in-progress { color: #0284c7; }
      .stat-num.completed { color: #10b981; }
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
      .search-input {
        padding: 7px 12px 7px 32px;
        font-size: 13px;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 6px;
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-primary, #0f172a);
        outline: none;
        width: 200px;
      }
      .search-input:focus {
        border-color: var(--mj-brand-primary, #0076b6);
      }
      .filter-group {
        display: flex;
        background: var(--mj-bg-surface-sunken, #f1f5f9);
        padding: 3px;
        border-radius: 6px;
        gap: 2px;
      }
      .pill-btn {
        border: none;
        background: transparent;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 500;
        border-radius: 4px;
        color: var(--mj-text-secondary, #64748b);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .pill-btn.active {
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-primary, #0f172a);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }
      .spacer { flex: 1 1 auto; }
      .add-task-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--mj-brand-primary, #0076b6);
        color: #ffffff;
        border: none;
        padding: 7px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .add-task-btn:hover {
        background: var(--mj-brand-primary-hover, #005a8c);
      }

      .add-task-row {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-strong, #cbd5e1);
        border-radius: 6px;
        padding: 10px 14px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
      }
      .new-task-input {
        flex: 1 1 auto;
        padding: 6px 10px;
        font-size: 13px;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 4px;
        outline: none;
      }
      .new-task-select {
        padding: 6px 10px;
        font-size: 13px;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 4px;
        background: var(--mj-bg-surface, #ffffff);
      }
      .save-task-btn {
        background: var(--mj-brand-primary, #0076b6);
        color: #ffffff;
        border: none;
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .save-task-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .cancel-task-btn {
        background: transparent;
        border: none;
        color: var(--mj-text-secondary, #64748b);
        padding: 6px 10px;
        font-size: 13px;
        cursor: pointer;
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
      .priority-badge.low { background: #f1f5f9; color: #475569; }
      .priority-badge.medium { background: #e0f2fe; color: #0284c7; }
      .priority-badge.high { background: #fef3c7; color: #d97706; }
      .priority-badge.urgent { background: #fee2e2; color: #dc2626; }

      .status-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .status-badge.in-progress { background: #e0f2fe; color: #0284c7; }
      .status-badge.completed { background: #dcfce7; color: #16a34a; }
      .status-badge.not-started { background: #f1f5f9; color: #64748b; }
      .status-badge.deferred { background: #fef3c7; color: #b45309; }

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

      .no-tasks {
        padding: 48px 24px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .empty-ic {
        font-size: 32px;
        color: var(--mj-text-muted, #cbd5e1);
        margin-bottom: 4px;
      }
      .empty-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }
      .empty-sub {
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
      }
    `,
  ],
})
export class CollabSpaceWorkComponent {
  @Input() Tasks: TaskItemModel[] = [];
  @Input() SpaceName = '';
  @Input() CanCreateTask = true;
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
  public newTaskPriority = 'Medium';

  public openAddTask(): void {
    this.isAddingTask = !this.isAddingTask;
    if (this.isAddingTask) {
      this.newTaskBand = this.DefaultBand;
    }
  }

  public get TotalTasks(): number {
    return this.Tasks.length;
  }

  public get InProgressCount(): number {
    return this.Tasks.filter((t) => t.status === 'In Progress').length;
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
      if (this.statusFilter === 'active' && task.status === 'Completed') return false;
      if (this.statusFilter === 'completed' && task.status !== 'Completed') return false;

      // Band filter
      if (this.bandFilter !== 'all' && task.band !== this.bandFilter) return false;

      return true;
    });
  }

  public onToggleTask(task: TaskItemModel): void {
    this.TaskToggleRequested.emit(task);
  }

  public onTaskClick(task: TaskItemModel): void {
    this.TaskSelectRequested.emit(task);
  }

  public submitNewTask(): void {
    if (!this.newTaskName.trim()) return;
    this.CreateTaskRequested.emit({
      name: this.newTaskName.trim(),
      band: this.newTaskBand,
      priority: this.newTaskPriority,
    });
    this.newTaskName = '';
    this.newTaskBand = this.DefaultBand;
    this.isAddingTask = false;
  }

  public formatStatusClass(status: string): string {
    const s = status.toLowerCase().replace(/\s+/g, '-');
    return s;
  }
}
