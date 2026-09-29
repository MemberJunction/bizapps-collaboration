import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CollabDialogBase } from './dialog-base';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { CollabBandChipComponent } from './band-chip.component';
import { CollabFileIconComponent } from './file-icon.component';
import { COLLAB_TOKENS_CSS } from './tokens';
import type { FileKind, SpaceBand } from './types';

export interface CollabUploadSubmitPayload {
  mode: 'upload' | 'link';
  title: string;
  /** The band the person has on screen, or null when they made no choice and the space type's default applies. */
  band: SpaceBand | null;
  folder: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  file?: File;
  url?: string;
  kind: FileKind;
}

@Component({
  selector: 'mjc-upload-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MJButtonDirective,
    CollabBandChipComponent,
    CollabFileIconComponent,
  ],
  template: `
    <div class="overlay" (click)="onBackdropClick($event)">
      <div #dialogBox class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header class="d-header">
          <div class="d-title-group">
            <h2 id="dialog-title" class="d-title">Add document to {{ SpaceName || 'Space' }}</h2>
            <p class="d-sub">{{ AllowLinks ? 'Upload a local file or link a cloud document.' : 'Upload a file from your computer.' }}</p>
          </div>
          <button type="button" class="btn-close" (click)="onCancel()" aria-label="Close dialog">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        <!-- Segmented Tab switcher -->
        @if (AllowLinks) {
          <div class="tab-strip" role="tablist">
            <button
              type="button"
              role="tab"
              class="tab-btn"
              [class.active]="activeMode === 'upload'"
              [attr.aria-selected]="activeMode === 'upload'"
              (click)="setMode('upload')"
            >
              <i class="fa-solid fa-arrow-up-from-bracket"></i>
              <span>Upload file</span>
            </button>
            <button
              type="button"
              role="tab"
              class="tab-btn"
              [class.active]="activeMode === 'link'"
              [attr.aria-selected]="activeMode === 'link'"
              (click)="setMode('link')"
            >
              <i class="fa-solid fa-link"></i>
              <span>Link cloud doc</span>
            </button>
          </div>
        }

        <div class="d-body">
          @if (activeMode === 'upload') {
            <!-- File upload pane -->
            <div class="form-group">
              <label class="f-label">File</label>
              @if (!selectedFile) {
                <div
                  class="dropzone"
                  [class.dragover]="isDragging"
                  (dragover)="onDragOver($event)"
                  (dragleave)="onDragLeave($event)"
                  (drop)="onFileDrop($event)"
                  role="button"
                  tabindex="0"
                  aria-label="Choose a file to upload"
                  (click)="fileInput.click()"
                  (keydown.enter)="fileInput.click()"
                  (keydown.space)="fileInput.click(); $event.preventDefault()"
                >
                  <input
                    #fileInput
                    type="file"
                    class="hidden-file-input"
                    (change)="onFileSelected($event)"
                  />
                  <div class="drop-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                  <div class="drop-text"><b>Click to upload</b> or drag and drop</div>
                  <div class="drop-sub">PDF, DOCX, XLSX, PPTX, PNG, JPG (up to {{ formatBytes(MaxBytes) }})</div>
                  @if (fileError) {
                    <div class="file-error" role="alert">{{ fileError }}</div>
                  }
                </div>
              } @else {
                <div class="file-chosen-bar">
                  <mjc-file-icon [Kind]="detectedKind" Size="md" />
                  <div class="file-details">
                    <span class="file-name ellipsis">{{ selectedFile.name }}</span>
                    <span class="file-size">{{ formatBytes(selectedFile.size) }}</span>
                  </div>
                  <button type="button" class="btn-clear" (click)="clearFile()" title="Remove file">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              }
            </div>
          } @else {
            <!-- Link document pane -->
            <div class="form-group">
              <label for="doc-url-input" class="f-label">Document URL</label>
              <div class="url-input-wrap">
                <i class="fa-solid fa-globe url-icon"></i>
                <input
                  id="doc-url-input"
                  type="url"
                  class="mj-input url-field"
                  placeholder="https://docs.google.com/... or https://tenant.sharepoint.com/..."
                  [(ngModel)]="linkUrl"
                  (ngModelChange)="onUrlChange($event)"
                />
              </div>
              <div class="url-hint">
                @if (detectedService) {
                  <span class="service-tag">
                    <i [class]="detectedService.icon"></i> {{ detectedService.label }} detected
                  </span>
                } @else {
                  <span>Supports Google Docs, Sheets, Slides, Microsoft 365, SharePoint, or web links.</span>
                }
              </div>
            </div>
          }

          <!-- Common fields: Title, Folder, Band -->
          <div class="form-group">
            <label for="doc-title-input" class="f-label">Name</label>
            <input
              id="doc-title-input"
              type="text"
              class="mj-input"
              placeholder="e.g. Project Kickoff Brief"
              [(ngModel)]="docTitle"
            />
          </div>

          <div class="form-row">
            <div class="form-group half">
              <label for="doc-folder-input" class="f-label">Folder / Collection</label>
              <input
                id="doc-folder-input"
                type="text"
                class="mj-input"
                placeholder="e.g. Contracts, Photos"
                list="folder-suggestions"
                [(ngModel)]="docFolder"
              />
              <datalist id="folder-suggestions">
                @for (name of FolderSuggestions; track name) {
                  <option [value]="name"></option>
                }
              </datalist>
            </div>

            <div class="form-group half">
              <div class="f-label" id="band-choice-label">Who can see this?</div>
              <div class="band-options" role="radiogroup" aria-labelledby="band-choice-label">
                @if (IsBandAllowed('Shared')) {
                <label class="band-option" [class.selected]="selectedBand === 'Shared'">
                  <input
                    type="radio"
                    name="band-choice"
                    value="Shared"
                    [checked]="selectedBand === 'Shared'"
                    (change)="selectedBand = 'Shared'"
                  />
                  <div class="b-opt-content">
                    <div class="b-opt-title">
                      <mjc-band-chip Band="Shared" Label="Shared" />
                    </div>
                    <div class="b-opt-sub">Visible to all participants</div>
                  </div>
                </label>
                }

                @if (IsBandAllowed('Team')) {
                <label class="band-option" [class.selected]="selectedBand === 'Team'">
                  <input
                    type="radio"
                    name="band-choice"
                    value="Team"
                    [checked]="selectedBand === 'Team'"
                    (change)="selectedBand = 'Team'"
                  />
                  <div class="b-opt-content">
                    <div class="b-opt-title">
                      <mjc-band-chip Band="Team" Label="Team" />
                    </div>
                    <div class="b-opt-sub">Only the team can see it</div>
                  </div>
                </label>
                }
                @if (selectedBand === null) {
                  <div class="b-opt-note">No choice made: this space type's default applies.</div>
                }
              </div>
            </div>
          </div>
        </div>

        <footer class="d-footer">
          <button
            mjButton
            variant="primary"
            size="md"
            (click)="onSubmit()"
            [disabled]="!canSubmit || IsSubmitting"
          >
            @if (IsSubmitting) {
              <i class="fa-solid fa-spinner fa-spin"></i> Saving...
            } @else {
              <i [class]="activeMode === 'upload' ? 'fa-solid fa-arrow-up-from-bracket' : 'fa-solid fa-link'"></i>
              {{ activeMode === 'upload' ? 'Upload file' : 'Link document' }}
            }
          </button>
          <button mjButton variant="secondary" size="md" (click)="onCancel()" [disabled]="IsSubmitting">
            Cancel
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .overlay {
      position: absolute;
      inset: 0;
      background: var(--mj-bg-overlay);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }
    .dialog {
      position: relative;
      background: var(--mj-bg-surface-card, #ffffff);
      border-radius: var(--mj-radius-lg, 12px);
      box-shadow: var(--mj-shadow-xl);
      width: 100%;
      max-width: 540px;
      border: 1px solid var(--mj-border-default, #e2e8f0);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: var(--mj-font-family, Inter, sans-serif);
      color: var(--mj-text-primary, #0f172a);
    }
    .d-header {
      padding: 18px 20px 14px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
    }
    .d-title-group {
      flex: 1;
    }
    .d-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--mj-text-primary, #0f172a);
    }
    .d-sub {
      margin: 4px 0 0;
      font-size: 12.5px;
      color: var(--mj-text-muted, #64748b);
      line-height: 1.4;
    }
    .btn-close {
      background: transparent;
      border: none;
      font-size: 16px;
      color: var(--mj-text-muted, #64748b);
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
    }
    .btn-close:hover {
      background: var(--mj-bg-surface-hover, #f1f5f9);
      color: var(--mj-text-primary, #0f172a);
    }
    .tab-strip {
      display: flex;
      border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
      background: var(--mj-bg-surface-sunken, #f8fafc);
      padding: 0 20px;
      gap: 8px;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--mj-text-secondary, #475569);
      cursor: pointer;
      margin-bottom: -1px;
    }
    .tab-btn.active {
      color: var(--mj-brand-primary, #0076b6);
      border-bottom-color: var(--mj-brand-primary, #0076b6);
      background: var(--mj-bg-surface-card, #ffffff);
      border-radius: 6px 6px 0 0;
    }
    .d-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: calc(85vh - 160px);
      overflow-y: auto;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-row {
      display: flex;
      gap: 14px;
    }
    .form-group.half {
      flex: 1;
    }
    .f-label {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--mj-text-primary, #0f172a);
    }
    .mj-input {
      height: 36px;
      padding: 0 10px;
      border-radius: var(--mj-radius-md, 8px);
      border: 1px solid var(--mj-border-default, #cbd5e1);
      background: var(--mj-bg-surface, #ffffff);
      font-size: 13px;
      color: var(--mj-text-primary, #0f172a);
      box-sizing: border-box;
      outline: none;
    }
    .mj-input:focus {
      border-color: var(--mj-brand-primary, #0076b6);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--mj-brand-primary, #0076b6) 20%, transparent);
    }
    .url-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .url-icon {
      position: absolute;
      left: 10px;
      color: var(--mj-text-muted, #94a3b8);
      font-size: 13px;
      pointer-events: none;
    }
    .url-field {
      padding-left: 32px;
      width: 100%;
    }
    .url-hint {
      font-size: 11.5px;
      color: var(--mj-text-muted, #64748b);
    }
    .service-tag {
      color: var(--mj-brand-primary, #0076b6);
      font-weight: 600;
    }
    .dropzone {
      border: 2px dashed var(--mj-border-default, #cbd5e1);
      border-radius: var(--mj-radius-md, 8px);
      padding: 24px 16px;
      text-align: center;
      background: var(--mj-bg-surface-sunken, #f8fafc);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: border-color 0.15s, background-color 0.15s;
    }
    .dropzone:hover, .dropzone.dragover {
      border-color: var(--mj-brand-primary, #0076b6);
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 5%, transparent);
    }
    .file-error { color: var(--mj-status-error); font-size: 12px; margin-top: 6px; }
    .hidden-file-input {
      display: none;
    }
    .drop-icon {
      font-size: 28px;
      color: var(--mj-brand-primary, #0076b6);
      margin-bottom: 4px;
    }
    .drop-text {
      font-size: 13px;
      color: var(--mj-text-primary, #0f172a);
    }
    .drop-sub {
      font-size: 11.5px;
      color: var(--mj-text-muted, #64748b);
    }
    .file-chosen-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: var(--mj-bg-surface-sunken, #f8fafc);
      border: 1px solid var(--mj-border-default, #e2e8f0);
      border-radius: var(--mj-radius-md, 8px);
    }
    .file-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .file-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--mj-text-primary, #0f172a);
    }
    .file-size {
      font-size: 11.5px;
      color: var(--mj-text-muted, #64748b);
    }
    .btn-clear {
      background: transparent;
      border: none;
      color: var(--mj-text-muted, #94a3b8);
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
    }
    .btn-clear:hover {
      color: var(--mj-status-error);
      background: color-mix(in srgb, var(--mj-status-error) 10%, transparent);
    }
    .band-options {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .band-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid var(--mj-border-default, #e2e8f0);
      background: var(--mj-bg-surface, #ffffff);
      cursor: pointer;
    }
    .band-option.selected {
      border-color: var(--mj-brand-primary, #0076b6);
      background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 5%, transparent);
    }
    .b-opt-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .b-opt-note {
      font-size: var(--mj-text-xs, 12px);
      color: var(--mj-text-muted);
    }
    .b-opt-sub {
      font-size: 11px;
      color: var(--mj-text-muted, #64748b);
    }
    .d-footer {
      padding: 14px 20px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      border-top: 1px solid var(--mj-border-default, #e2e8f0);
      background: var(--mj-bg-surface-sunken, #f8fafc);
    }
    .ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `],
})
export class CollabUploadDialogComponent extends CollabDialogBase {
  @ViewChild('dialogBox') private dialogBox?: ElementRef<HTMLElement>;
  protected override DialogBox(): ElementRef<HTMLElement> | undefined { return this.dialogBox; }
  protected override Dismiss(): void { this.onCancel(); }

  @Input() SpaceName = '';
  @Input() SpaceId = '';
  @Input() ClientOrgName = '';
  @Input() IsSubmitting = false;
  @Input() AllowLinks = false;
  /** The largest file the server takes. A bigger one is refused here, before it is read. */
  @Input() MaxBytes = 10 * 1024 * 1024;
  /** The space's own folders, offered as suggestions. */
  @Input() FolderSuggestions: readonly string[] = [];
  public fileError = '';

  /** The bands this seat may choose. The server refuses any other, so the dialog offers only these. */
  @Input() AllowedBands: readonly SpaceBand[] = ['Shared', 'Team'];

  /**
   * The band the dialog starts on: the space type's default for this seat. When it's null the seat wasn't resolved, nothing
   * is selected, and an upload with no choice made takes the space type's default on the server.
   */
  @Input() set StartBand(band: SpaceBand | null) {
    this.selectedBand = band;
  }

  public IsBandAllowed(band: SpaceBand): boolean {
    return this.AllowedBands.includes(band);
  }

  @Output() CancelRequested = new EventEmitter<void>();
  @Output() SubmitRequested = new EventEmitter<CollabUploadSubmitPayload>();

  public activeMode: 'upload' | 'link' = 'upload';
  public selectedFile: File | null = null;
  public linkUrl = '';
  public docTitle = '';
  public docFolder = 'General';
  public selectedBand: SpaceBand | null = null;
  public detectedKind: FileKind = 'doc';
  public detectedService: { label: string; icon: string } | null = null;
  public isDragging = false;

  public setMode(mode: 'upload' | 'link'): void {
    this.activeMode = mode;
    this.updateDetection();
  }

  public onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('overlay')) {
      this.onCancel();
    }
  }

  /** Closing is refused while the upload is saving, from the close button and the backdrop as well as Escape. */
  public onCancel(): void {
    if (this.IsSubmitting) return;
    this.CancelRequested.emit();
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  public onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  public onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  public clearFile(): void {
    this.selectedFile = null;
    this.detectedKind = 'doc';
  }

  private handleFile(file: File): void {
    if (file.size > this.MaxBytes) {
      this.fileError = `That file is ${this.formatBytes(file.size)}. Files can be up to ${this.formatBytes(this.MaxBytes)}.`;
      return;
    }
    this.fileError = '';
    this.selectedFile = file;
    if (!this.docTitle) {
      // Strip extension for title
      this.docTitle = file.name.replace(/\.[^/.]+$/, '');
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['doc', 'docx'].includes(ext)) this.detectedKind = 'doc';
    else if (['xls', 'xlsx', 'csv'].includes(ext)) this.detectedKind = 'xls';
    else if (['ppt', 'pptx'].includes(ext)) this.detectedKind = 'ppt';
    else if (['pdf'].includes(ext)) this.detectedKind = 'pdf';
    else if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'].includes(ext)) this.detectedKind = 'img';
    else if (['zip', 'tar', 'gz'].includes(ext)) this.detectedKind = 'zip';
    else this.detectedKind = 'doc';
  }

  public onUrlChange(url: string): void {
    this.updateDetection();
    if (!this.docTitle && url) {
      try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          const last = decodeURIComponent(parts[parts.length - 1]).replace(/[-_]/g, ' ');
          if (last.length > 2 && last.length < 50) {
            this.docTitle = last.charAt(0).toUpperCase() + last.slice(1);
          }
        }
      } catch {
        // Not yet a valid URL, ignore
      }
    }
  }

  private updateDetection(): void {
    const url = this.linkUrl.toLowerCase();
    if (!url) {
      this.detectedService = null;
      this.detectedKind = 'doc';
      return;
    }
    if (url.includes('docs.google.com/document')) {
      this.detectedService = { label: 'Google Docs', icon: 'fa-solid fa-file-lines' };
      this.detectedKind = 'doc';
    } else if (url.includes('docs.google.com/spreadsheets')) {
      this.detectedService = { label: 'Google Sheets', icon: 'fa-solid fa-file-excel' };
      this.detectedKind = 'xls';
    } else if (url.includes('docs.google.com/presentation')) {
      this.detectedService = { label: 'Google Slides', icon: 'fa-solid fa-file-powerpoint' };
      this.detectedKind = 'ppt';
    } else if (url.includes('sharepoint.com') || url.includes('onedrive') || url.includes('office.com')) {
      this.detectedService = { label: 'Microsoft 365', icon: 'fa-brands fa-microsoft' };
      if (url.includes('.xlsx') || url.includes('sourcedoc=') && url.includes('excel')) {
        this.detectedKind = 'xls';
      } else if (url.includes('.pptx') || url.includes('powerpoint')) {
        this.detectedKind = 'ppt';
      } else {
        this.detectedKind = 'doc';
      }
    } else {
      this.detectedService = { label: 'Web Link', icon: 'fa-solid fa-link' };
      this.detectedKind = 'doc';
    }
  }

  public get canSubmit(): boolean {
    if (!this.docTitle.trim()) return false;
    if (this.activeMode === 'upload') {
      return !!this.selectedFile;
    } else {
      return !!this.linkUrl.trim() && this.linkUrl.startsWith('http');
    }
  }

  public onSubmit(): void {
    if (!this.canSubmit || this.IsSubmitting) return;

    const payload: CollabUploadSubmitPayload = {
      mode: this.activeMode,
      title: this.docTitle.trim(),
      band: this.selectedBand,
      folder: this.docFolder.trim() || 'General',
      kind: this.detectedKind,
      fileName: this.selectedFile ? this.fileNameFromTitle(this.selectedFile.name) : undefined,
      fileSize: this.selectedFile?.size,
      fileType: this.selectedFile?.type,
      file: this.selectedFile || undefined,
      url: this.activeMode === 'link' ? this.linkUrl.trim() : undefined,
    };

    this.SubmitRequested.emit(payload);
  }

  /** The stored file takes the name typed here, keeping the original's extension. */
  private fileNameFromTitle(original: string): string {
    const extension = /\.[^/.]+$/.exec(original)?.[0] ?? '';
    const title = this.docTitle.trim();
    return title.toLowerCase().endsWith(extension.toLowerCase()) ? title : `${title}${extension}`;
  }

  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
