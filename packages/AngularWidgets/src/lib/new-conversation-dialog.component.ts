import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective, MJDialogComponent } from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { CollabDialogBase } from './dialog-base';
import { COLLAB_TOKENS_CSS } from './tokens';

export interface NewConversationSubmitPayload {
  name: string;
  kind: 'General' | 'Topic' | 'Private';
}

@Component({
  selector: 'mjc-new-conversation-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MJButtonDirective, MJDialogComponent, SharedGenericModule],
  template: `
    <mj-dialog [Visible]="true" Title="New Conversation" [Width]="520" [Closeable]="!IsSubmitting" (Close)="onCancel()">
    <div #modalRoot class="conversation-modal">
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
              placeholder="e.g. project-updates, weekly-sync"
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
                <div class="kind-desc">Open conversation for all space participants and team members.</div>
              </div>
            </label>

            <label class="kind-card" [class.selected]="kind === 'Topic'">
              <input type="radio" name="convoKind" value="Topic" [(ngModel)]="kind" [disabled]="IsSubmitting" class="sr-only" />
              <div class="kind-card-icon topic"><i class="fa-solid fa-bullseye" aria-hidden="true"></i></div>
              <div class="kind-card-text">
                <div class="kind-title">Topic / Workstream</div>
                <div class="kind-desc">Focused on a specific deliverable, review, or initiative.</div>
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
      </div>

      <footer class="d-footer">
        <button
          type="button"
          mjButton
          variant="primary"
          size="md"
          [disabled]="!trimmedName || IsSubmitting"
          (click)="onSubmit()"
        >
          @if (IsSubmitting) {
            <mj-loading Size="small" [showText]="false"></mj-loading> Creating...
          } @else {
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Create Conversation
          }
        </button>
        <button
          type="button"
          mjButton
          variant="secondary"
          size="md"
          [disabled]="IsSubmitting"
          (click)="onCancel()"
        >
          Cancel
        </button>
      </footer>
    </div>
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
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
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

      .d-footer {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        padding: 16px 24px;
        border-top: 1px solid var(--mj-border-default, #e2e8f0);
        background: var(--mj-bg-surface-sunken, #f8fafc);
      }
    `,
  ],
})
export class CollabNewConversationDialogComponent extends CollabDialogBase implements OnChanges {
  @Input() public SpaceName = '';
  @Input() public AllowedKinds: readonly ('General' | 'Topic' | 'Private')[] = ['General', 'Topic'];
  @Input() public IsSubmitting = false;

  @Output() public CancelRequested = new EventEmitter<void>();
  @Output() public SubmitRequested = new EventEmitter<NewConversationSubmitPayload>();

  @ViewChild('nameInput') private nameInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('modalRoot') private modalRootElement?: ElementRef<HTMLElement>;

  public name = '';
  public kind: 'General' | 'Topic' | 'Private' = 'General';

  protected override DialogBox(): ElementRef<HTMLElement> | undefined { return this.modalRootElement; }
  /** The name field, so a dialog that opens (or finishes a submit) is ready to type in. */
  protected override FirstFocus(): HTMLElement | null { return this.nameInputElement?.nativeElement ?? null; }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['IsSubmitting']) {
      const prev = changes['IsSubmitting'].previousValue;
      const curr = changes['IsSubmitting'].currentValue;
      if (prev === true && curr === false) {
        this.ScheduleFirstFocus();
      }
    }
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
    this.SubmitRequested.emit({
      name: clean,
      kind: this.kind,
    });
  }
}
