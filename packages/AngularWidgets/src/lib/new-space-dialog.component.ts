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
import { CollabSpaceAvatarStudioComponent, type SpaceAvatarChangePayload } from './space-avatar-studio.component';

/** One kind of space a person may start. */
export interface NewSpaceTypeOption {
  id: string;
  name: string;
  description: string;
  iconClass: string;
  color: string;
  imageUrl?: string | null;
}

export interface NewSpaceSubmitPayload {
  typeId: string;
  name: string;
  description: string;
  /** D22, for a sub-space: whether its members come from the parent. Absent for a top-level space. */
  inheritsMembership?: boolean;
  /** Optional customized icon class overriding the space type default. */
  iconClass?: string;
  /** Optional customized accent color overriding the space type default. */
  color?: string;
  /** Optional square avatar/logo URL or 128x128 WebP data URI. */
  imageUrl?: string | null;
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
  imports: [CommonModule, FormsModule, MJButtonDirective, MJDialogComponent, MJDialogActionsComponent, SharedGenericModule, CollabTypeTileComponent, CollabSpaceAvatarStudioComponent],
  template: `
    <mj-dialog
      [Visible]="true"
      [Title]="dialogTitle"
      [Width]="'min(600px, calc(100vw - 24px))'"
      [MinWidth]="320"
      [Closeable]="!IsSubmitting && !isGeneratingAvatar"
      (Close)="onCancel()">
      <div class="space-modal">
        @if (showAvatarStudio) {
          <div class="studio-overlay-view">
            <mjc-space-avatar-studio
              [Frameless]="true"
              [ShowBackButton]="true"
              BackButtonLabel="Back to space details"
              [SpaceName]="trimmedName || selectedType?.name || 'New Space'"
              [SpaceDescription]="description"
              [SpaceTypeName]="selectedType?.name || ''"
              [IconClass]="effectiveIconClass"
              [Color]="effectiveColor"
              [ImageUrl]="customImageUrl"
              [Disabled]="IsSubmitting"
              (AvatarChange)="onAvatarChanged($event)"
              (GeneratingChange)="isGeneratingAvatar = $event"
              (BackClicked)="closeAvatarStudio()"
            ></mjc-space-avatar-studio>
          </div>
        }

        <div class="space-form-view" [class.view-hidden]="showAvatarStudio" [hidden]="showAvatarStudio">
          @if (ParentName) {
            <p class="d-sub">A sub-space of <strong>{{ ParentName }}</strong>. Pick the kind, then give it a name. You are seated as its owner.</p>
          } @else {
            <p class="d-sub">Pick the kind of space, then give it a name. You are seated as its owner.</p>
          }

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
                      <mjc-type-tile [IconClass]="type.iconClass" [Color]="type.color" [ImageUrl]="type.imageUrl || null" Size="lg"></mjc-type-tile>
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
              <!-- Compact Identity Row: 64x64 clickable avatar trigger + Name input -->
              <div class="identity-row">
                <button
                  type="button"
                  class="avatar-trigger-btn"
                  [class.has-image]="!!customImageUrl"
                  [style.--mjc-type-color]="effectiveColor"
                  [disabled]="IsSubmitting"
                  aria-label="Customize space avatar or logo"
                  title="Customize space avatar or logo"
                  (click)="openAvatarStudio()"
                >
                  @if (customImageUrl) {
                    <img class="avatar-trigger-img" [src]="customImageUrl" [alt]="(trimmedName || 'Space') + ' avatar'" />
                  } @else {
                    <i [class]="effectiveIconClass" aria-hidden="true"></i>
                  }
                  <span class="avatar-trigger-badge" aria-hidden="true">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> Edit
                  </span>
                </button>

                <div class="identity-name-col">
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
                  <button
                    type="button"
                    class="avatar-customize-link"
                    [disabled]="IsSubmitting"
                    (click)="openAvatarStudio()"
                  >
                    <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                    <span>{{ customImageUrl ? 'Change custom logo or icon' : 'Customize avatar / logo' }}</span>
                  </button>
                </div>
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

              @if (ParentName) {
                <div class="form-group">
                  <label class="f-check">
                    <input type="checkbox" [(ngModel)]="inheritsMembership" [disabled]="IsSubmitting" />
                    <span>
                      <span class="fw6">Members of {{ ParentName }} receive access</span>
                      <span class="cb-sub">Off, the sub-space starts with you alone and seats people on its own.</span>
                    </span>
                  </label>
                </div>
              }

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
      </div>

      <mj-dialog-actions>
        @if (showAvatarStudio) {
          <button
            type="button"
            mjButton
            Variant="primary"
            Size="md"
            [disabled]="isGeneratingAvatar"
            (click)="closeAvatarStudio()"
          >
            <i class="fa-solid fa-check" aria-hidden="true"></i> Done
          </button>
        } @else {
          <button
            type="button"
            mjButton
            Variant="primary"
            Size="md"
            [disabled]="!canSubmit"
            (click)="onSubmit()"
          >
            @if (IsSubmitting) {
              <mj-loading Size="small" [ShowText]="false"></mj-loading> Creating...
            } @else {
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Create space
            }
          </button>
          <button type="button" mjButton Variant="secondary" Size="md" [disabled]="IsSubmitting" (click)="onCancel()">Cancel</button>
        }
      </mj-dialog-actions>
    </mj-dialog>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: contents;
      }

      .view-hidden {
        display: none;
      }

      .studio-overlay-view {
        min-width: 0;
        width: 100%;
      }

      .f-check {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        cursor: pointer;
      }
      .f-check input {
        margin-top: 3px;
      }
      .f-check .cb-sub {
        display: block;
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

      .space-modal {
        color: var(--mj-text-primary, #0f172a);
        font-family: var(--mj-font-family, Inter, sans-serif);
        font-size: 14px;
        line-height: var(--mjc-line-height, 1.5);
        min-width: 0;
        overflow-x: hidden;
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
        gap: 16px;
        min-width: 0;
      }

      .identity-row {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        min-width: 0;
      }

      .avatar-trigger-btn {
        position: relative;
        flex: 0 0 64px;
        width: 64px;
        height: 64px;
        padding: 0;
        border-radius: 14px;
        border: 2px solid color-mix(in srgb, var(--mjc-type-color, var(--mj-brand-primary)) 65%, var(--mj-border-default));
        background: var(--mjc-type-color, var(--mj-brand-primary));
        color: var(--mj-brand-on-primary);
        font-size: 24px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        cursor: pointer;
        box-shadow: var(--mj-shadow-sm);
        transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
        margin-top: 22px;
      }

      .avatar-trigger-btn.has-image {
        background: var(--mj-bg-surface-sunken);
      }

      .avatar-trigger-btn:hover:not(:disabled) {
        transform: scale(1.03);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--mj-brand-primary) 22%, transparent);
      }

      .avatar-trigger-btn:focus-visible {
        outline: none;
        box-shadow: var(--mj-focus-ring);
      }

      .avatar-trigger-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .avatar-trigger-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .avatar-trigger-badge {
        position: absolute;
        left: 50%;
        bottom: 3px;
        transform: translateX(-50%);
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 1px 6px;
        border-radius: var(--mj-radius-full, 999px);
        background: var(--mj-bg-overlay);
        color: var(--mj-text-inverse);
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }

      .identity-name-col {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .avatar-customize-link {
        appearance: none;
        align-self: flex-start;
        border: 0;
        background: transparent;
        padding: 2px 0;
        color: var(--mj-brand-primary);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }

      .avatar-customize-link:hover:not(:disabled) {
        text-decoration: underline;
      }

      .avatar-customize-link:focus-visible {
        outline: none;
        box-shadow: var(--mj-focus-ring);
        border-radius: var(--mj-radius-sm, 4px);
      }

      .avatar-customize-link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
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
        width: 100%;
        box-sizing: border-box;
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
        max-height: 220px;
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

      @media (max-width: 640px) {
        .identity-row {
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }

        .avatar-trigger-btn {
          margin-top: 0;
        }

        .avatar-customize-link {
          min-height: 44px;
        }

        .kind-card {
          min-height: 44px;
          padding: 10px 12px;
        }
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
  /** The parent's name when the dialog makes a sub-space; empty for a top-level space. */
  @Input() public ParentName = '';

  @Output() public CancelRequested = new EventEmitter<void>();
  @Output() public TypeSelected = new EventEmitter<string>();
  @Output() public SubmitRequested = new EventEmitter<NewSpaceSubmitPayload>();

  @ViewChild('nameInput') private nameInputElement?: ElementRef<HTMLInputElement>;
  private refocusTimer: ReturnType<typeof setTimeout> | undefined;

  public name = '';
  public description = '';
  /** D22: a sub-space is sealed unless its creator asks. */
  public inheritsMembership = false;
  public showAvatarStudio = false;
  public isGeneratingAvatar = false;
  public customIconClass: string | null = null;
  public customColor: string | null = null;
  public customImageUrl: string | null = null;
  private hasCustomAvatar = false;

  public get dialogTitle(): string {
    if (this.showAvatarStudio) {
      return 'Customize Space Avatar';
    }
    return this.ParentName ? 'New sub-space' : 'New space';
  }

  public get selectedType(): NewSpaceTypeOption | undefined {
    return this.Types.find((t) => t.id === this.SelectedTypeId);
  }

  public get effectiveIconClass(): string {
    return this.customIconClass || this.selectedType?.iconClass || 'fa-solid fa-compass';
  }

  public get effectiveColor(): string {
    return this.customColor || this.selectedType?.color || '#0076b6'; // hex-ok: default space brand color
  }

  public openAvatarStudio(): void {
    if (this.IsSubmitting) return;
    this.showAvatarStudio = true;
  }

  public closeAvatarStudio(): void {
    if (this.isGeneratingAvatar) return;
    this.showAvatarStudio = false;
  }

  public onAvatarChanged(payload: SpaceAvatarChangePayload): void {
    this.hasCustomAvatar = true;
    this.customIconClass = payload.iconClass;
    this.customColor = payload.color;
    this.customImageUrl = payload.imageUrl;
  }

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
      if (!this.showAvatarStudio) {
        this.nameInputElement?.nativeElement.focus();
      }
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
    if (!this.hasCustomAvatar) {
      this.customIconClass = null;
      this.customColor = null;
      this.customImageUrl = null;
    }
    this.TypeSelected.emit(typeId);
  }

  public onCancel(): void {
    if (!this.IsSubmitting && !this.isGeneratingAvatar) {
      this.CancelRequested.emit();
    }
  }

  public onSubmit(): void {
    if (!this.canSubmit) return;
    this.SubmitRequested.emit({
      typeId: this.SelectedTypeId,
      name: this.trimmedName,
      description: this.description.trim(),
      ...(this.ParentName ? { inheritsMembership: this.inheritsMembership } : {}),
      ...(this.hasCustomAvatar
        ? {
            iconClass: this.effectiveIconClass,
            color: this.effectiveColor,
            imageUrl: this.customImageUrl,
          }
        : {}),
    });
  }
}
