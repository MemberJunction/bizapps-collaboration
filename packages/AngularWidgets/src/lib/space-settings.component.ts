import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { SpaceSettingsModel } from './types';
import { COLLAB_TOKENS_CSS } from './tokens';

@Component({
  selector: 'mjc-space-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-container">
      <div class="settings-header">
        <div>
          <div class="settings-title">Settings</div>
          <div class="settings-sub">Manage identity, branding, access inheritance, and AI retrieval behavior for {{ Settings.name }}.</div>
        </div>

        @if (CanEdit) {
        <button
          class="save-btn"
          [disabled]="isSaving"
          (click)="saveChanges()"
        >
          @if (isSaving) {
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Saving...</span>
          } @else {
            <i class="fa-solid fa-check"></i>
            <span>Save changes</span>
          }
        </button>
        }
      </div>

      @if (bannerVisible && saveSuccessMessage) {
        <div class="alert-success" role="status">
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
          <span>{{ saveSuccessMessage }}</span>
        </div>
      }
      @if (bannerVisible && saveInfoMessage) {
        <div class="alert-info" role="status">
          <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>{{ saveInfoMessage }}</span>
        </div>
      }

      @if (!CanEdit) {
        <div class="alert-info" role="status">
          <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
          <span>This space is closed and its access has ended, so its settings can no longer be changed. As an owner you can reopen it.</span>
        </div>
        <div class="settings-sections">
          <div class="settings-card">
            <div class="form-grid">
              <ng-container *ngTemplateOutlet="lifecycle"></ng-container>
            </div>
          </div>
        </div>
      } @else {
      <div class="settings-sections" (input)="onEdit()" (change)="onEdit()">
        <!-- 1. Profile & Appearance -->
        <div class="settings-card">
          <div class="card-title-row">
            <i class="fa-solid fa-palette section-ic"></i>
            <span class="card-title">Profile & Appearance</span>
          </div>

          <div class="form-grid">
            <div class="form-field full-width">
              <label class="field-label" for="settings-name">Space Name</label>
              <input
                type="text"
                class="form-input"
                id="settings-name"
                [(ngModel)]="formData.name"
                placeholder="e.g. Northwind relationship"
              />
            </div>

            <div class="form-field full-width">
              <label class="field-label" for="settings-description">Description</label>
              <textarea
                class="form-textarea"
                id="settings-description"
                [(ngModel)]="formData.description"
                placeholder="Describe what this space is for..."
                rows="2"
              ></textarea>
            </div>

            <div class="form-field">
              <label class="field-label" for="settings-icon">Icon</label>
              <div class="input-with-icon">
                <i [class]="formData.iconClass || 'fa-solid fa-compass'" class="icon-preview"></i>
                <input
                  type="text"
                  class="form-input with-prefix"
                  id="settings-icon"
                [(ngModel)]="formData.iconClass"
                  placeholder="fa-solid fa-compass"
                />
              </div>
            </div>

            <div class="form-field">
              <label class="field-label" for="settings-color-text">Theme Color</label>
              <div class="color-picker-row">
                <input
                  type="color"
                  aria-label="Theme color picker"
                  class="color-input"
                  [(ngModel)]="formData.color"
                />
                <input
                  type="text"
                  class="form-input color-text"
                  id="settings-color-text"
                  [(ngModel)]="formData.color"
                  placeholder="#RRGGBB"
                />
              </div>
            </div>

            <div class="form-field full-width">
              <label class="field-label" for="settings-banner">Background Banner Image URL</label>
              <input
                type="url"
                class="form-input"
                id="settings-banner"
                [(ngModel)]="formData.backgroundImageUrl"
                placeholder="https://images.unsplash.com/..."
              />
              @if (formData.backgroundImageUrl) {
                <div class="banner-preview">
                  <img [src]="formData.backgroundImageUrl" alt="Banner preview" />
                </div>
              }
            </div>
          </div>
        </div>

        <!-- 2. AI & Assistant Scope -->
        <div class="settings-card">
          <div class="card-title-row">
            <i class="fa-solid fa-sparkles section-ic ai-ic"></i>
            <span class="card-title">Assistant & Retrieval Scope</span>
          </div>

          <div class="form-grid">
            <div class="form-field full-width">
              <div class="field-label" id="settings-retrieval-label">Agent Retrieval</div>
              <div class="radio-group" role="radiogroup" aria-labelledby="settings-retrieval-label">
                <label class="radio-label">
                  <input
                    type="radio"
                    name="agentRetrieval"
                    value="Included"
                    [(ngModel)]="formData.agentRetrieval"
                  />
                  <div>
                    <div class="radio-title">Included</div>
                    <div class="radio-sub">The Assistant synthesizes files, conversations, and tasks from this space.</div>
                  </div>
                </label>

                @if (!IsRootSpace) {
                <label class="radio-label">
                  <input
                    type="radio"
                    name="agentRetrieval"
                    value="ExcludedFromParentScope"
                    [(ngModel)]="formData.agentRetrieval"
                  />
                  <div>
                    <div class="radio-title">Excluded from Parent Scope</div>
                    <div class="radio-sub">Files remain searchable directly within this space, but will not be included in questions asked in the parent space.</div>
                  </div>
                </label>
                }

                <label class="radio-label">
                  <input
                    type="radio"
                    name="agentRetrieval"
                    value="ExcludedEntirely"
                    [(ngModel)]="formData.agentRetrieval"
                  />
                  <div>
                    <div class="radio-title">Excluded Entirely</div>
                    <div class="radio-sub">Completely hidden from AI indexing and retrieval.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Lifecycle & Access -->
        <div class="settings-card">
          <div class="card-title-row">
            <i class="fa-solid fa-shield-halved section-ic"></i>
            <span class="card-title">Access & Retention Lifecycle</span>
          </div>

          <div class="form-grid">
            <div class="form-field">
              <label class="field-label" for="settings-retention">Retention Policy</label>
              <select id="settings-retention" [(ngModel)]="formData.retention" class="form-select">
                <option value="">Type default ({{ formData.typeDefaultRetention || 'Indefinite' }})</option>
                <option value="Indefinite">Indefinite (No automatic archiving)</option>
                <option value="Year">1 Year</option>
                <option value="Month">1 Month</option>
              </select>
            </div>

            <div class="form-field">
              <label class="field-label" for="settings-type">Space Type</label>
              <input
                type="text"
                class="form-input"
                id="settings-type"
                [value]="formData.spaceType"
                disabled
              />
            </div>

            @if (!IsRootSpace) {
              <div class="form-field full-width">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    [(ngModel)]="formData.inheritsMembership"
                    class="checkbox-input"
                  />
                  <div>
                    <div class="cb-title">Inherit parent space membership</div>
                    <div class="cb-sub">Members of the parent space automatically receive access to this sub-space.</div>
                  </div>
                </label>
              </div>
            }

            <ng-container *ngTemplateOutlet="lifecycle"></ng-container>
          </div>
        </div>
      </div>
      }

      <ng-template #lifecycle>
            <div class="form-field full-width">
              <div class="cb-title">Status: {{ formData.status }}</div>
              @if (confirmingLifecycle) {
                <div class="cb-sub">{{ formData.status === 'Closed' ? 'Reopen this space? People can add and change things again.' : 'Close this space? It becomes read-only for everyone.' }}</div>
                <button type="button" class="save-btn" [disabled]="IsBusy" (click)="confirmLifecycle()">{{ formData.status === 'Closed' ? 'Reopen space' : 'Close space' }}</button>
                <button type="button" class="cancel-lifecycle-btn" (click)="confirmingLifecycle = false">Cancel</button>
              } @else {
                <button type="button" class="cancel-lifecycle-btn" [disabled]="IsBusy" (click)="confirmingLifecycle = true">{{ formData.status === 'Closed' ? 'Reopen…' : 'Close…' }}</button>
              }
            </div>
      </ng-template>
    </div>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      .settings-container {
        padding: 24px 32px 48px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        max-width: 900px;
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;
      }

      .settings-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .settings-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
      }
      .settings-sub {
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
        margin-top: 4px;
      }

      .save-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--mj-brand-primary, #0076b6);
        color: var(--mj-text-inverse);
        border: none;
        padding: 8px 20px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
        flex-shrink: 0;
      }
      .save-btn:hover:not(:disabled) {
        background: var(--mj-brand-primary-hover, #005a8c);
      }
      .save-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .alert-info {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--mj-status-info-bg);
        border: 1px solid var(--mj-status-info-border);
        color: var(--mj-status-info-text);
        padding: 10px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
      }
      .cancel-lifecycle-btn {
        margin-top: 8px;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-primary);
        cursor: pointer;
      }
      .alert-success {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--mj-status-success-bg);
        border: 1px solid var(--mj-status-success-border);
        color: var(--mj-status-success-text);
        padding: 10px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
      }

      .settings-sections {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .settings-card {
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 8px;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .card-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid var(--mj-border-subtle, #f1f5f9);
        padding-bottom: 12px;
      }
      .section-ic {
        font-size: 15px;
        color: var(--mj-brand-primary, #0076b6);
      }
      .section-ic.ai-ic {
        color: var(--mjc-ai-to);
      }
      .card-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }

      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .full-width {
        grid-column: 1 / -1;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--mj-text-secondary, #475569);
      }

      .form-input, .form-textarea, .form-select {
        padding: 8px 12px;
        font-size: 13px;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 6px;
        background: var(--mj-bg-surface, #ffffff);
        color: var(--mj-text-primary, #0f172a);
        outline: none;
        box-sizing: border-box;
      }
      .form-input:focus, .form-textarea:focus, .form-select:focus {
        border-color: var(--mj-brand-primary, #0076b6);
      }
      .form-input:disabled {
        background: var(--mj-bg-surface-sunken, #f8fafc);
        color: var(--mj-text-muted, #94a3b8);
      }

      .input-with-icon {
        position: relative;
        display: flex;
        align-items: center;
      }
      .icon-preview {
        position: absolute;
        left: 12px;
        color: var(--mj-text-muted, #64748b);
      }
      .form-input.with-prefix {
        padding-left: 36px;
        width: 100%;
      }

      .color-picker-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .color-input {
        width: 38px;
        height: 38px;
        padding: 0;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 6px;
        cursor: pointer;
      }
      .color-text {
        flex: 1 1 auto;
      }

      .banner-preview {
        margin-top: 8px;
        height: 120px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
      }
      .banner-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .radio-label {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 14px;
        border: 1px solid var(--mj-border-subtle, #e2e8f0);
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .radio-label:hover {
        background: var(--mj-bg-surface-hover, #f8fafc);
      }
      .radio-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }
      .radio-sub {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
        margin-top: 2px;
      }

      .checkbox-label {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
        padding: 4px 0;
      }
      .checkbox-input {
        margin-top: 3px;
        accent-color: var(--mj-brand-primary, #0076b6);
      }
      .cb-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }
      .cb-sub {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
        margin-top: 2px;
      }
    `,
  ],
})
export class CollabSpaceSettingsComponent implements OnInit, OnChanges {
  @Input() Settings!: SpaceSettingsModel;
  @Input() isSaving = false;
  @Input() saveSuccessMessage = '';
  /** Something to say that isn't a success, such as "No changes to save.". */
  @Input() saveInfoMessage = '';
  /** A root space has no parent, so the sub-space options aren't offered. */
  @Input() IsRootSpace = false;

  @Output() CloseSpaceRequested = new EventEmitter<void>();
  @Output() ReopenSpaceRequested = new EventEmitter<void>();

  /** The banner shows a message until the person edits, and again for the next message. */
  public bannerVisible = true;
  /** True while a close or reopen is with the server: both buttons are off. */
  @Input() IsBusy = false;
  /** False when the person may only reopen the space (its access has ended): the form is not shown, and there is nothing to save. */
  @Input() CanEdit = true;
  private baselineJson = '';

  /** The fields the person changed from what the form was built from. Status is the space's own, not a field they edit. */
  private changedFields(): Partial<SpaceSettingsModel> {
    if (!this.formData || !this.baselineJson) return {};
    const baseline = JSON.parse(this.baselineJson) as Record<string, unknown>;
    const changed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.formData as unknown as Record<string, unknown>)) {
      if (key === 'status') continue;
      if (JSON.stringify(value) !== JSON.stringify(baseline[key])) changed[key] = value;
    }
    return changed as Partial<SpaceSettingsModel>;
  }

  private isFormDirty(): boolean {
    return Object.keys(this.changedFields()).length > 0;
  }
  public confirmingLifecycle = false;

  public onEdit(): void {
    this.bannerVisible = false;
  }

  public confirmLifecycle(): void {
    this.confirmingLifecycle = false;
    if (this.formData.status === 'Closed') this.ReopenSpaceRequested.emit();
    else this.CloseSpaceRequested.emit();
  }

  @Output() SaveSettingsRequested = new EventEmitter<SpaceSettingsModel>();

  public formData!: SpaceSettingsModel;

  public ngOnInit(): void {
    this.initFormData();
    this.baselineJson = JSON.stringify(this.Settings);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['Settings'] && this.Settings) {
      // The same space's settings arriving again (after a close or reopen) must not throw away what is being typed
      const sameSpace = !!this.formData && this.formData.id === this.Settings.id;
      if (sameSpace && this.isFormDirty()) {
        // The fresh row, with only what the person changed laid over it: another owner's change to a field they left alone stays
        this.formData = { ...this.Settings, ...this.changedFields() };
      } else {
        this.initFormData();
      }
      this.baselineJson = JSON.stringify(this.Settings);
      this.confirmingLifecycle = false;
    }
    if (changes['saveSuccessMessage'] || changes['saveInfoMessage']) this.bannerVisible = true;
  }

  private initFormData(): void {
    this.formData = {
      ...this.Settings,
    };
  }

  public saveChanges(): void {
    this.SaveSettingsRequested.emit(this.formData);
  }
}
