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
import { CollabTypeTileComponent } from './type-tile.component';

/** One kind of space a person may start. */
export interface NewSpaceTypeOption {
  id: string;
  name: string;
  description: string;
  iconClass: string;
  color: string;
}

export interface NewSpaceSubmitPayload {
  typeId: string;
  name: string;
  description: string;
}

/**
 * The dialog that starts a space: pick a kind, name it, and fill in whatever details that kind keeps of its own.
 *
 * A kind that keeps its own details (a space type with a subtype) has them drawn by the host and projected into the
 * `[mjcDetails]` slot, so this widget knows nothing about entities or forms. The host answers `TypeSelected` by making
 * the draft, then sets `HasDetails` and `DetailsTitle`; it holds the primary action off (`DetailsIncomplete`) until they
 * are filled in.
 */
@Component({
  selector: 'mjc-new-space-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent, SharedGenericModule, CollabTypeTileComponent],
  template: `
    <mj-dialog [Visible]="true" Title="New space" [Width]="600" [Closeable]="!IsSubmitting" (Close)="onCancel()">
      <div class="space-modal">
        <p class="d-sub">Pick the kind of space, then give it a name. You are seated as its owner.</p>

        <div class="d-body">
          <div class="form-group">
            <span class="f-label" id="new-space-kind-label">Kind of space</span>
            @if (Types.length === 0) {
              <p class="d-empty">There is no kind of space you can start.</p>
            } @else {
              <div class="kind-options" role="radiogroup" aria-labelledby="new-space-kind-label">
                @for (type of Types; track type.id) {
                  <label class="kind-card" [class.selected]="type.id === SelectedTypeId">
                    <input
                      type="radio"
                      name="newSpaceKind"
                      class="sr-only"
                      [value]="type.id"
                      [checked]="type.id === SelectedTypeId"
                      [disabled]="IsSubmitting"
                      (change)="onSelectType(type.id)"
                    />
                    <mjc-type-tile [IconClass]="type.iconClass" [Color]="type.color" Size="lg"></mjc-type-tile>
                    <div class="kind-card-text">
                      <div class="kind-title">{{ type.name }}</div>
                      @if (type.description) {
                        <div class="kind-desc">{{ type.description }}</div>
                      }
                    </div>
                  </label>
                }
              </div>
            }
          </div>

          @if (SelectedTypeId) {
            <div class="form-group">
              <label class="f-label" for="new-space-name">Name</label>
              <input
                #nameInput
                id="new-space-name"
                type="text"
                class="f-input"
                maxlength="255"
                [(ngModel)]="name"
                [disabled]="IsSubmitting"
                placeholder="e.g. 2026 Board of Directors"
                (keydown.enter)="onSubmit()"
              />
            </div>

            <div class="form-group">
              <label class="f-label" for="new-space-description">Description <span class="optional">optional</span></label>
              <textarea
                id="new-space-description"
                class="f-input f-textarea"
                rows="2"
                [(ngModel)]="description"
                [disabled]="IsSubmitting"
              ></textarea>
            </div>

            <div class="details" [class.details-hidden]="!HasDetails">
              @if (HasDetails) {
                <div class="details-title">{{ DetailsTitle || 'Details' }}</div>
              }
              <ng-content select="[mjcDetails]"></ng-content>
            </div>
          }

          @if (ErrorMessage) {
            <div class="error" role="alert">
              <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
              <span>{{ ErrorMessage }}</span>
            </div>
          }
        </div>
      </div>

      <mj-dialog-actions>
        <button
          type="button"
          mjButton
          variant="primary"
          size="md"
          [disabled]="!canSubmit"
          (click)="onSubmit()"
        >
          @if (IsSubmitting) {
            <mj-loading Size="small" [showText]="false"></mj-loading> Creating...
          } @else {
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Create space
          }
        </button>
        <button type="button" mjButton variant="secondary" size="md" [disabled]="IsSubmitting" (click)="onCancel()">Cancel</button>
      </mj-dialog-actions>
    </mj-dialog>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: contents;
      }

      .space-modal {
        color: var(--mj-text-primary, #0f172a);
        font-family: var(--mj-font-family, Inter, sans-serif);
        font-size: 14px;
        line-height: var(--mjc-line-height, 1.5);
      }

      .d-sub {
        margin: 0 0 14px;
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
      }

      .d-empty {
        margin: 0;
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
      }

      .d-body {
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

      .optional {
        font-weight: 400;
        color: var(--mj-text-muted, #94a3b8);
        margin-left: 4px;
      }

      .f-input {
        border: 1px solid var(--mj-border-default, #e2e8f0);
        border-radius: 8px;
        background: var(--mj-bg-surface, #ffffff);
        padding: 10px 14px;
        font: inherit;
        color: var(--mj-text-primary, #0f172a);
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .f-input:focus {
        outline: none;
        border-color: var(--mj-brand-primary, #0076b6);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--mj-brand-primary, #0076b6) 15%, transparent);
      }
      .f-textarea {
        resize: vertical;
        min-height: 56px;
      }

      .kind-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 260px;
        overflow-y: auto;
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
      .kind-card:has(input:focus-visible) {
        outline: 2px solid var(--mj-brand-primary, #0076b6);
        outline-offset: 2px;
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

      .kind-card-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .kind-title {
        font-size: 13.5px;
        font-weight: 600;
      }
      .kind-desc {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

      .details {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-top: 14px;
        border-top: 1px solid var(--mj-border-default, #e2e8f0);
      }
      .details.details-hidden {
        display: none;
      }
      .details-title {
        font-size: 13px;
        font-weight: 600;
      }

      .error {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 13px;
        color: var(--mj-status-error-text, #b91c1c);
        background: var(--mj-status-error-bg, #fef2f2);
        border: 1px solid var(--mj-status-error-border, #fecaca);
      }
    `,
  ],
})
export class CollabNewSpaceDialogComponent implements OnChanges, OnDestroy {
  /** The kinds this person may start, in the order to show. */
  @Input() public Types: readonly NewSpaceTypeOption[] = [];
  @Input() public SelectedTypeId = '';
  /** The selected kind keeps details of its own: the host has put them in the `[mjcDetails]` slot. */
  @Input() public HasDetails = false;
  @Input() public DetailsTitle = '';
  /** The details the kind requires aren't filled in yet. */
  @Input() public DetailsIncomplete = false;
  @Input() public IsSubmitting = false;
  @Input() public ErrorMessage = '';

  @Output() public CancelRequested = new EventEmitter<void>();
  @Output() public TypeSelected = new EventEmitter<string>();
  @Output() public SubmitRequested = new EventEmitter<NewSpaceSubmitPayload>();

  @ViewChild('nameInput') private nameInputElement?: ElementRef<HTMLInputElement>;
  private refocusTimer: ReturnType<typeof setTimeout> | undefined;

  public name = '';
  public description = '';

  /**
   * `mj-dialog` focuses the first kind when the dialog opens, keeps Tab inside and gives focus back on close. What it can't know is
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

  public get trimmedName(): string {
    return this.name.trim();
  }

  public get canSubmit(): boolean {
    return !!this.SelectedTypeId && !!this.trimmedName && !this.DetailsIncomplete && !this.IsSubmitting;
  }

  public onSelectType(typeId: string): void {
    if (this.IsSubmitting || typeId === this.SelectedTypeId) return;
    this.TypeSelected.emit(typeId);
  }

  public onCancel(): void {
    if (!this.IsSubmitting) this.CancelRequested.emit();
  }

  public onSubmit(): void {
    if (!this.canSubmit) return;
    this.SubmitRequested.emit({ typeId: this.SelectedTypeId, name: this.trimmedName, description: this.description.trim() });
  }
}
