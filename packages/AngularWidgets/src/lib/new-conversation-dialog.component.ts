import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective, MJDialogActionsComponent, MJDialogComponent } from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { COLLAB_TOKENS_CSS } from './tokens';

export interface WorkstreamLinkTaskOption {
  id: string;
  name: string;
  status?: string;
  priority?: string;
}

export interface WorkstreamLinkFileOption {
  id: string;
  title: string;
  kind?: string;
}

export interface WorkstreamActionLinkPayload {
  mode: 'task' | 'new-task' | 'file';
  targetId?: string;
  targetTitle?: string;
  newTaskTitle?: string;
  newTaskPriority?: 'Low' | 'Normal' | 'High';
}

export interface NewConversationSubmitPayload {
  name: string;
  kind: 'General' | 'Topic' | 'Private';
  linkedAction?: WorkstreamActionLinkPayload;
}

@Component({
  selector: 'mjc-new-conversation-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent, SharedGenericModule],
  template: `
    <mj-dialog [Visible]="true" Title="New Conversation" [Width]="540" [Closeable]="!IsSubmitting" (Close)="onCancel()">
    <div class="conversation-modal">
      <p class="d-sub">Start a new conversation in {{ SpaceName || 'this space' }}.</p>

      <div class="d-body">
        <div class="form-group">
          <label class="f-label" for="convo-name">Conversation Name</label>
          <div class="input-with-prefix">
            <span class="prefix">#</span>
            <input
              #nameInput
              id="convo-name"
              type="text"
              class="f-input"
              [(ngModel)]="name"
              [disabled]="IsSubmitting"
              placeholder="e.g. project-updates, q3-audit-review"
              (keydown.enter)="onSubmit()"
              autofocus
            />
          </div>
        </div>

        <div class="form-group">
          <label class="f-label" id="channel-type-label">Conversation type</label>
          <div class="kind-options" role="radiogroup" aria-labelledby="channel-type-label">
            <label class="kind-card" [class.selected]="kind === 'General'">
              <input type="radio" name="convoKind" value="General" [(ngModel)]="kind" [disabled]="IsSubmitting" class="sr-only" />
              <div class="kind-card-icon general"><i class="fa-solid fa-comments" aria-hidden="true"></i></div>
              <div class="kind-card-text">
                <div class="kind-title">General Discussion</div>
                <div class="kind-desc">Open channel for ongoing questions, updates, and broad discussion.</div>
              </div>
            </label>

            <label class="kind-card" [class.selected]="kind === 'Topic'">
              <input type="radio" name="convoKind" value="Topic" [(ngModel)]="kind" [disabled]="IsSubmitting" class="sr-only" />
              <div class="kind-card-icon topic"><i class="fa-solid fa-bullseye" aria-hidden="true"></i></div>
              <div class="kind-card-text">
                <div class="kind-title">Topic / Workstream</div>
                <div class="kind-desc">Focused working thread tied to a specific task, deliverable, or initiative.</div>
              </div>
            </label>

            @if (canShowPrivate) {
              <label class="kind-card" [class.selected]="kind === 'Private'">
                <input type="radio" name="convoKind" value="Private" [(ngModel)]="kind" [disabled]="IsSubmitting" class="sr-only" />
                <div class="kind-card-icon private"><i class="fa-solid fa-lock" aria-hidden="true"></i></div>
                <div class="kind-card-text">
                  <div class="kind-title">Team only</div>
                  <div class="kind-desc">Restricted to internal staff and team members.</div>
                </div>
              </label>
            }
          </div>
        </div>

        @if (kind === 'Topic') {
          <div class="workstream-link-box" data-testid="workstream-link-box">
            <div class="workstream-link-header">
              <div class="workstream-link-title">
                <i class="fa-solid fa-link" aria-hidden="true"></i>
                <span>Link Workstream to Actionable Item</span>
              </div>
              <span class="workstream-link-sub">Connect this workstream to a trackable task or document in this space.</span>
            </div>

            <div class="link-mode-pills" role="group" aria-label="Actionable item link type">
              <button
                type="button"
                class="link-mode-pill"
                [class.active]="linkMode === 'task'"
                (click)="setLinkMode('task')">
                <i class="fa-solid fa-list-check" aria-hidden="true"></i>
                <span>Existing Task ({{ Tasks.length }})</span>
              </button>
              <button
                type="button"
                class="link-mode-pill"
                [class.active]="linkMode === 'new-task'"
                (click)="setLinkMode('new-task')">
                <i class="fa-solid fa-plus-circle" aria-hidden="true"></i>
                <span>Create New Task</span>
              </button>
              <button
                type="button"
                class="link-mode-pill"
                [class.active]="linkMode === 'file'"
                (click)="setLinkMode('file')">
                <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
                <span>Document ({{ Files.length }})</span>
              </button>
              <button
                type="button"
                class="link-mode-pill"
                [class.active]="linkMode === 'none'"
                (click)="setLinkMode('none')">
                <span>No Link</span>
              </button>
            </div>

            @if (linkMode === 'task') {
              <div class="link-picker-body">
                @if (Tasks.length > 0) {
                  <label class="f-sublabel" for="workstream-task-select">Select Task from Work Board</label>
                  <select
                    id="workstream-task-select"
                    class="f-select"
                    [(ngModel)]="selectedTaskId"
                    (ngModelChange)="onTaskSelectionChange($event)">
                    @for (t of Tasks; track t.id) {
                      <option [value]="t.id">{{ t.name }} {{ t.status ? '(' + t.status + ')' : '' }}</option>
                    }
                  </select>
                } @else {
                  <div class="link-empty-note">
                    No tasks exist in this space yet. Choose <strong>Create New Task</strong> to create and link one automatically.
                  </div>
                }
              </div>
            }

            @if (linkMode === 'new-task') {
              <div class="link-picker-body new-task-row">
                <div class="new-task-field">
                  <label class="f-sublabel" for="workstream-new-task-title">New Task Title</label>
                  <input
                    id="workstream-new-task-title"
                    type="text"
                    class="f-select"
                    [(ngModel)]="newTaskTitle"
                    [placeholder]="trimmedName ? 'Task: ' + trimmedName : 'e.g. Complete Q3 financial review'" />
                </div>
                <div class="new-task-priority">
                  <label class="f-sublabel" for="workstream-new-task-priority">Priority</label>
                  <select id="workstream-new-task-priority" class="f-select" [(ngModel)]="newTaskPriority">
                    <option value="High">High</option>
                    <option value="Normal">Normal</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
            }

            @if (linkMode === 'file') {
              <div class="link-picker-body">
                @if (Files.length > 0) {
                  <label class="f-sublabel" for="workstream-file-select">Select Document / Deliverable</label>
                  <select
                    id="workstream-file-select"
                    class="f-select"
                    [(ngModel)]="selectedFileId"
                    (ngModelChange)="onFileSelectionChange($event)">
                    @for (f of Files; track f.id) {
                      <option [value]="f.id">{{ f.title }}</option>
                    }
                  </select>
                } @else {
                  <div class="link-empty-note">
                    No documents in this space yet.
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>


    </div>
      <mj-dialog-actions>
        <button
          type="button"
          mjButton
          Variant="primary"
          Size="md"
          [disabled]="!trimmedName || IsSubmitting"
          (click)="onSubmit()"
        >
          @if (IsSubmitting) {
            <mj-loading Size="small" [ShowText]="false"></mj-loading> Creating...
          } @else {
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Create Conversation
          }
        </button>
        <button
          type="button"
          mjButton
          Variant="secondary"
          Size="md"
          [disabled]="IsSubmitting"
          (click)="onCancel()"
        >
          Cancel
        </button>
      </mj-dialog-actions>
    </mj-dialog>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: contents;
      }

      .conversation-modal {
        color: var(--mj-text-primary, #0f172a);
        font-family: var(--mj-font-family, Inter, sans-serif);
        font-size: 14px;
        line-height: var(--mjc-line-height, 1.5);
      }

      .d-sub {
        margin: 0;
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
      }

      .d-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .f-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }

      .f-sublabel {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--mj-text-secondary, #475569);
      }

      .input-with-prefix {
        display: flex;
        align-items: center;
        border: 1px solid var(--mj-border-default, #e2e8f0);
        border-radius: 8px;
        background: var(--mj-bg-surface, #ffffff);
        overflow: hidden;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .input-with-prefix:focus-within {
        border-color: var(--mj-brand-primary, #0076b6);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--mj-brand-primary, #0076b6) 15%, transparent);
      }

      .prefix {
        padding: 0 10px 0 14px;
        font-size: 16px;
        font-weight: 700;
        color: var(--mj-text-muted, #94a3b8);
        user-select: none;
      }

      .f-input {
        border: none;
        outline: none;
        padding: 10px 14px 10px 0;
        font-size: 14px;
        color: var(--mj-text-primary, #0f172a);
        flex: 1;
        background: transparent;
      }

      .kind-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .kind-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border: 1px solid var(--mj-border-default, #e2e8f0);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        background: var(--mj-bg-surface, #ffffff);
      }
      .kind-card:hover {
        background: var(--mj-bg-surface-hover, #f8fafc);
        border-color: var(--mj-border-strong, #cbd5e1);
      }
      .kind-card.selected {
        border-color: var(--mj-brand-primary, #0076b6);
        background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 6%, transparent);
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }

      .kind-card:has(input:focus-visible) {
        outline: 2px solid var(--mj-brand-primary, #0076b6);
        outline-offset: 2px;
      }

      .kind-card-icon {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .kind-card-icon.general {
        background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 12%, transparent);
        color: var(--mj-brand-primary, #0076b6);
      }
      .kind-card-icon.topic {
        background: color-mix(in srgb, var(--mj-brand-tertiary, #059669) 12%, transparent);
        color: var(--mj-brand-tertiary, #059669);
      }
      .kind-card-icon.private {
        background: color-mix(in srgb, var(--mjc-team, #7c3aed) 12%, transparent);
        color: var(--mjc-team, #7c3aed);
      }

      .kind-card-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .kind-title {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }

      .kind-desc {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

      .workstream-link-box {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid color-mix(in srgb, var(--mj-brand-tertiary, #059669) 30%, var(--mj-border-default, #e2e8f0));
        background: color-mix(in srgb, var(--mj-brand-tertiary, #059669) 4%, var(--mj-bg-surface, #ffffff));
      }

      .workstream-link-header {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .workstream-link-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
      }
      .workstream-link-title i {
        color: var(--mj-brand-tertiary, #059669);
        font-size: 12px;
      }

      .workstream-link-sub {
        font-size: 11.5px;
        color: var(--mj-text-secondary, #64748b);
      }

      .link-mode-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .link-mode-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 999px;
        border: 1px solid var(--mj-border-default, #cbd5e1);
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-secondary, #475569);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.12s ease;
      }
      .link-mode-pill:hover {
        border-color: var(--mj-brand-primary, #0076b6);
        color: var(--mj-text-primary, #0f172a);
      }
      .link-mode-pill.active {
        background: var(--mj-brand-primary, #0076b6);
        border-color: var(--mj-brand-primary, #0076b6);
        color: var(--mj-text-inverse, #ffffff);
      }

      .link-picker-body {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding-top: 2px;
      }

      .new-task-row {
        flex-direction: row;
        gap: 10px;
      }
      .new-task-field {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .new-task-priority {
        width: 120px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .f-select {
        width: 100%;
        padding: 7px 10px;
        border-radius: 7px;
        border: 1px solid var(--mj-border-default, #cbd5e1);
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-primary, #0f172a);
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
      }
      .f-select:focus {
        border-color: var(--mj-brand-primary, #0076b6);
      }

      .link-empty-note {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
        padding: 4px 0;
      }

    `,
  ],
})
export class CollabNewConversationDialogComponent implements OnChanges, OnDestroy {
  @Input() public SpaceName = '';
  @Input() public AllowedKinds: readonly ('General' | 'Topic' | 'Private')[] = ['General', 'Topic'];
  @Input() public IsSubmitting = false;
  @Input() public Tasks: readonly WorkstreamLinkTaskOption[] = [];
  @Input() public Files: readonly WorkstreamLinkFileOption[] = [];

  @Output() public CancelRequested = new EventEmitter<void>();
  @Output() public SubmitRequested = new EventEmitter<NewConversationSubmitPayload>();

  @ViewChild('nameInput') private nameInputElement?: ElementRef<HTMLInputElement>;
  private refocusTimer: ReturnType<typeof setTimeout> | undefined;

  public name = '';
  public kind: 'General' | 'Topic' | 'Private' = 'General';
  public linkMode: 'none' | 'task' | 'new-task' | 'file' = 'none';
  public selectedTaskId = '';
  public selectedFileId = '';
  public newTaskTitle = '';
  public newTaskPriority: 'Low' | 'Normal' | 'High' = 'Normal';

  public setLinkMode(mode: 'none' | 'task' | 'new-task' | 'file'): void {
    this.linkMode = mode;
    if (mode === 'task' && !this.selectedTaskId && this.Tasks.length > 0) {
      this.selectedTaskId = this.Tasks[0].id;
      this.onTaskSelectionChange(this.selectedTaskId);
    } else if (mode === 'file' && !this.selectedFileId && this.Files.length > 0) {
      this.selectedFileId = this.Files[0].id;
      this.onFileSelectionChange(this.selectedFileId);
    }
  }

  public onTaskSelectionChange(taskId: string): void {
    this.selectedTaskId = taskId;
    if (!this.trimmedName) {
      const match = this.Tasks.find((t) => t.id === taskId);
      if (match) {
        this.name = match.name;
      }
    }
  }

  public onFileSelectionChange(fileId: string): void {
    this.selectedFileId = fileId;
    if (!this.trimmedName) {
      const match = this.Files.find((f) => f.id === fileId);
      if (match) {
        this.name = match.title;
      }
    }
  }

  /**
   * `mj-dialog` focuses the name field when the dialog opens, keeps Tab inside and gives focus back on close. What it can't know is
   * that a submit ended: the controls come back on, and the name field takes the focus again on the next turn, so a refusal is ready to fix.
   */
  public ngOnChanges(changes: SimpleChanges): void {
    const submitting = changes['IsSubmitting'];
    if (submitting && submitting.previousValue === true && submitting.currentValue === false) {
      this.scheduleRefocus();
    }
  }

  public ngOnDestroy(): void {
    if (this.refocusTimer !== undefined) clearTimeout(this.refocusTimer);
  }

  private scheduleRefocus(): void {
    if (this.refocusTimer !== undefined) clearTimeout(this.refocusTimer);
    this.refocusTimer = setTimeout(() => {
      this.refocusTimer = undefined;
      this.nameInputElement?.nativeElement.focus();
    }, 0);
  }

  public get canShowPrivate(): boolean {
    return this.AllowedKinds.includes('Private');
  }

  public get trimmedName(): string {
    return this.name.trim();
  }

  public onCancel(): void {
    if (!this.IsSubmitting) {
      this.CancelRequested.emit();
    }
  }

  public onSubmit(): void {
    const clean = this.trimmedName;
    if (!clean || this.IsSubmitting) return;

    const payload: NewConversationSubmitPayload = {
      name: clean,
      kind: this.kind,
    };

    if (this.kind === 'Topic' && this.linkMode !== 'none') {
      if (this.linkMode === 'task' && this.selectedTaskId) {
        const task = this.Tasks.find((t) => t.id === this.selectedTaskId);
        payload.linkedAction = {
          mode: 'task',
          targetId: this.selectedTaskId,
          targetTitle: task?.name ?? clean,
        };
      } else if (this.linkMode === 'file' && this.selectedFileId) {
        const file = this.Files.find((f) => f.id === this.selectedFileId);
        payload.linkedAction = {
          mode: 'file',
          targetId: this.selectedFileId,
          targetTitle: file?.title ?? clean,
        };
      } else if (this.linkMode === 'new-task') {
        payload.linkedAction = {
          mode: 'new-task',
          newTaskTitle: this.newTaskTitle.trim() || clean,
          newTaskPriority: this.newTaskPriority,
        };
      }
    }

    this.SubmitRequested.emit(payload);
  }
}
