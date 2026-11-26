import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { type IMetadataProvider, Metadata, RunView } from '@memberjunction/core';
import { MJButtonDirective, MjIconPickerComponent } from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { hasExecuteGQL } from '@mj-biz-apps/collaboration-entities';
import { COLLAB_TOKENS_CSS } from './tokens';
import { CollabTypeTileComponent } from './type-tile.component';

export type SpaceAvatarStudioTab = 'ai' | 'icon' | 'upload';

export interface SpaceAvatarChangePayload {
  imageUrl: string | null;
  iconClass: string;
  color: string;
}

export interface SpaceAvatarStylePreset {
  id: string;
  label: string;
  promptHint: string;
}

export const GENERATE_IMAGE_ACTION_FALLBACK_ID = '048FF309-C2CD-44D8-8A8E-8C771ADA8284';
export const SPACE_AVATAR_MAX_UNDO_STEPS = 10;
export const SPACE_AVATAR_DIMENSION = 128;
export const SPACE_AVATAR_WEBP_QUALITY = 0.85;

export const SPACE_AVATAR_STYLE_PRESETS: readonly SpaceAvatarStylePreset[] = [
  {
    id: 'modern-brand-mark',
    label: 'Modern Brand Mark',
    promptHint: 'modern minimalist SaaS brand mark, crisp centered emblem, balanced negative space, subtle depth gradient',
  },
  {
    id: 'minimal-geometric',
    label: 'Minimal Geometric',
    promptHint: 'clean minimal geometric abstract symbol, bold harmonious shapes, Swiss graphic design, crisp edges',
  },
  {
    id: '3d-isometric-emblem',
    label: '3D Isometric Emblem',
    promptHint: 'sleek 3D isometric glass and satin emblem, soft studio lighting, polished product icon aesthetic',
  },
  {
    id: 'flat-vector-badge',
    label: 'Flat Vector Badge',
    promptHint: 'flat vector badge icon, crisp high-contrast silhouette, contemporary UI app icon design',
  },
  {
    id: 'executive-monogram',
    label: 'Executive Monogram',
    promptHint: 'refined executive monogram crest, understated architectural elegance, timeless editorial emblem',
  },
];

export const CURATED_SPACE_ICONS: readonly string[] = [
  'fa-solid fa-compass',
  'fa-solid fa-briefcase',
  'fa-solid fa-people-group',
  'fa-solid fa-people-roof',
  'fa-solid fa-building',
  'fa-solid fa-diagram-project',
  'fa-solid fa-rocket',
  'fa-solid fa-graduation-cap',
  'fa-solid fa-handshake',
  'fa-solid fa-lightbulb',
  'fa-solid fa-shield-halved',
  'fa-solid fa-layer-group',
  'fa-solid fa-calendar-days',
  'fa-solid fa-chart-line',
  'fa-solid fa-globe',
  'fa-solid fa-crown',
];

export const CURATED_SPACE_COLORS: readonly string[] = [
  '#0076b6', // hex-ok: curated space accent swatch palette
  '#2563eb', // hex-ok: curated space accent swatch palette
  '#4f46e5', // hex-ok: curated space accent swatch palette
  '#7c3aed', // hex-ok: curated space accent swatch palette
  '#9333ea', // hex-ok: curated space accent swatch palette
  '#db2777', // hex-ok: curated space accent swatch palette
  '#dc2626', // hex-ok: curated space accent swatch palette
  '#d97706', // hex-ok: curated space accent swatch palette
  '#059669', // hex-ok: curated space accent swatch palette
  '#0891b2', // hex-ok: curated space accent swatch palette
  '#0f766e', // hex-ok: curated space accent swatch palette
  '#475569', // hex-ok: curated space accent swatch palette
];

const RUN_ACTION_MUTATION = `
mutation RunAction($input: RunActionInput!) {
  RunAction(input: $input) {
    Success
    Message
    ResultCode
    ResultData
  }
}
`;

interface RunActionGraphQLResponse {
  RunAction?: {
    Success?: boolean;
    Message?: string;
    ResultCode?: string;
    ResultData?: string;
  };
}

interface ActionParamResultEntry {
  Name?: string;
  Value?: string | MediaOutputEntry[] | null;
}

interface MediaOutputEntry {
  data?: string;
  url?: string;
  mimeType?: string;
}

/** Builds a contextual square avatar/logo prompt from the space identity and selected preset. */
export function buildSpaceAvatarPrompt(input: {
  name: string;
  description?: string;
  kind?: string;
  stylePresetId?: string;
  color?: string;
}): string {
  const preset =
    SPACE_AVATAR_STYLE_PRESETS.find((p) => p.id === input.stylePresetId) ??
    SPACE_AVATAR_STYLE_PRESETS[0];
  const title = input.name.trim() || 'Collaborative Space';
  const kind = input.kind?.trim() || 'workspace';
  const desc = input.description?.trim();
  const parts: string[] = [
    `Square app icon emblem for "${title}" (${kind}).`,
    `Style: ${preset.promptHint}.`,
  ];
  if (desc) {
    parts.push(`Context: ${desc.slice(0, 180)}.`);
  }
  if (input.color?.trim()) {
    parts.push(`Primary accent color palette anchored around ${input.color.trim()}.`);
  }
  parts.push('Full-bleed square composition, crisp at 44px and 128px, no border, no watermark.');
  return parts.join(' ');
}

/** Extracts an image data URI or URL from MJ's `Generate Image` RunAction `ResultData` payload. */
export function extractGeneratedImageSource(resultDataRaw: string | null | undefined): string | null {
  if (!resultDataRaw) return null;
  let parsed: object | Array<ActionParamResultEntry> | null = null;
  try {
    parsed = JSON.parse(resultDataRaw) as object | Array<ActionParamResultEntry>;
  } catch {
    return null;
  }
  if (!parsed) return null;

  const paramsList: ActionParamResultEntry[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { Params?: ActionParamResultEntry[] }).Params)
      ? ((parsed as { Params?: ActionParamResultEntry[] }).Params ?? [])
      : [];

  let imagesCandidate: MediaOutputEntry[] | null = null;
  const imagesParam = paramsList.find((p) => (p.Name ?? '').toLowerCase() === 'images');
  if (imagesParam && Array.isArray(imagesParam.Value)) {
    imagesCandidate = imagesParam.Value as MediaOutputEntry[];
  } else if (imagesParam && typeof imagesParam.Value === 'string') {
    try {
      const inner = JSON.parse(imagesParam.Value) as MediaOutputEntry[];
      if (Array.isArray(inner)) imagesCandidate = inner;
    } catch {
      if (imagesParam.Value.startsWith('data:image/') || imagesParam.Value.startsWith('http')) {
        return imagesParam.Value;
      }
    }
  } else if (Array.isArray((parsed as { Images?: MediaOutputEntry[] }).Images)) {
    imagesCandidate = (parsed as { Images?: MediaOutputEntry[] }).Images ?? null;
  }

  const first = imagesCandidate?.[0];
  if (!first) return null;
  if (typeof first.data === 'string' && first.data.trim().length > 0) {
    const trimmed = first.data.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;
    const mime = first.mimeType?.trim() || 'image/png';
    return `data:${mime};base64,${trimmed}`;
  }
  if (typeof first.url === 'string' && first.url.trim().length > 0) {
    return first.url.trim();
  }
  return null;
}

/** Center-crops and downscales any image source to a 128x128 WebP (0.85) data URI using an offscreen canvas. */
export async function downscaleImageToSquareWebp(
  imageSrc: string,
  size: number = SPACE_AVATAR_DIMENSION,
  quality: number = SPACE_AVATAR_WEBP_QUALITY,
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return imageSrc;
  }
  return new Promise<string>((resolve) => {
    const img = new Image();
    if (!imageSrc.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageSrc);
          return;
        }
        const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const sx = Math.max(0, Math.floor(((img.naturalWidth || img.width) - side) / 2));
        const sy = Math.max(0, Math.floor(((img.naturalHeight || img.height) - side) / 2));
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        const webp = canvas.toDataURL('image/webp', quality);
        if (webp && webp.startsWith('data:image/webp')) {
          resolve(webp);
          return;
        }
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageSrc);
      }
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

/**
 * 3-Tab Space Avatar Studio:
 * 1. AI Generate & Iterative Refine (Generate Image action -> 128x128 WebP + 10-step undo history)
 * 2. Icon & Color (curated icons + MjIconPickerComponent + accent swatches)
 * 3. Upload / URL (local center-cropped 128x128 WebP upload + external https:// logo URL)
 */
@Component({
  selector: 'mjc-space-avatar-studio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MJButtonDirective,
    MjIconPickerComponent,
    SharedGenericModule,
    CollabTypeTileComponent,
  ],
  template: `
    <div class="studio" [class.compact]="Compact">
      <!-- Preview & Undo Header -->
      <div class="studio-preview-bar">
        <mjc-type-tile
          [IconClass]="currentIconClass"
          [Color]="currentColor"
          [ImageUrl]="currentImageUrl"
          Size="xl"
        ></mjc-type-tile>
        <div class="preview-meta">
          <div class="preview-title">{{ SpaceName || 'Space Avatar' }}</div>
          <div class="preview-sub">
            @if (currentImageUrl) {
              Custom avatar logo
            } @else {
              Icon &amp; accent color
            }
          </div>
        </div>
        <div class="preview-actions">
          @if (undoStack.length > 0) {
            <button
              type="button"
              mjButton
              Variant="flat"
              Size="sm"
              [disabled]="Disabled || isGenerating"
              (click)="undo()"
              title="Undo last avatar change"
            >
              <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
              <span>Undo ({{ undoStack.length }})</span>
            </button>
          }
          @if (currentImageUrl) {
            <button
              type="button"
              mjButton
              Variant="flat"
              Size="sm"
              [disabled]="Disabled || isGenerating"
              (click)="clearImage()"
              title="Switch back to icon"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              <span>Use icon</span>
            </button>
          }
        </div>
      </div>

      <!-- 3-Tab Selector -->
      <div class="studio-tabs" role="tablist" aria-label="Space avatar options">
        <button
          type="button"
          role="tab"
          class="studio-tab"
          [class.active]="activeTab === 'ai'"
          [attr.aria-selected]="activeTab === 'ai'"
          (click)="activeTab = 'ai'"
        >
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          <span>AI Generate</span>
        </button>
        <button
          type="button"
          role="tab"
          class="studio-tab"
          [class.active]="activeTab === 'icon'"
          [attr.aria-selected]="activeTab === 'icon'"
          (click)="activeTab = 'icon'"
        >
          <i class="fa-solid fa-icons" aria-hidden="true"></i>
          <span>Icon &amp; Color</span>
        </button>
        <button
          type="button"
          role="tab"
          class="studio-tab"
          [class.active]="activeTab === 'upload'"
          [attr.aria-selected]="activeTab === 'upload'"
          (click)="activeTab = 'upload'"
        >
          <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
          <span>Upload / URL</span>
        </button>
      </div>

      <!-- Tab 1: AI Generate & Refine -->
      @if (activeTab === 'ai') {
        <div class="tab-panel" role="tabpanel">
          <div class="field-block">
            <div class="field-row">
              <span class="field-label">Style preset</span>
              <button
                type="button"
                class="text-link"
                [disabled]="Disabled || isGenerating"
                (click)="refreshSuggestedPrompt()"
              >
                <i class="fa-solid fa-sparkles" aria-hidden="true"></i> Auto-fill prompt
              </button>
            </div>
            <div class="preset-chips">
              @for (preset of stylePresets; track preset.id) {
                <button
                  type="button"
                  class="preset-chip"
                  [class.selected]="selectedPresetId === preset.id"
                  [disabled]="Disabled || isGenerating"
                  (click)="selectPreset(preset.id)"
                >
                  {{ preset.label }}
                </button>
              }
            </div>
          </div>

          <div class="field-block">
            <label class="field-label" for="avatar-ai-prompt">Prompt</label>
            <textarea
              id="avatar-ai-prompt"
              class="mj-textarea studio-textarea"
              rows="2"
              [(ngModel)]="promptText"
              [disabled]="Disabled || isGenerating"
              placeholder="Describe the logo or emblem for this space..."
            ></textarea>
          </div>

          @if (currentImageUrl) {
            <div class="field-block">
              <label class="field-label" for="avatar-ai-refine">Iterative refinement <span class="opt">optional</span></label>
              <input
                id="avatar-ai-refine"
                type="text"
                class="mj-input studio-input"
                [(ngModel)]="refineInstruction"
                [disabled]="Disabled || isGenerating"
                placeholder="e.g. Make it cleaner with warmer gold accents and less detail"
              />
            </div>
          }

          <div class="ai-actions">
            <button
              type="button"
              mjButton
              Variant="primary"
              Size="sm"
              [disabled]="Disabled || isGenerating || !promptText.trim()"
              (click)="generateAvatar(false)"
            >
              @if (isGenerating && !isRefining) {
                <mj-loading Size="small" [ShowText]="false"></mj-loading>
                <span>Generating...</span>
              } @else {
                <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
                <span>{{ currentImageUrl ? 'Generate new' : 'Generate avatar' }}</span>
              }
            </button>

            @if (currentImageUrl) {
              <button
                type="button"
                mjButton
                Variant="outline"
                Size="sm"
                [disabled]="Disabled || isGenerating || (!refineInstruction.trim() && !promptText.trim())"
                (click)="generateAvatar(true)"
              >
                @if (isGenerating && isRefining) {
                  <mj-loading Size="small" [ShowText]="false"></mj-loading>
                  <span>Refining...</span>
                } @else {
                  <i class="fa-solid fa-sliders" aria-hidden="true"></i>
                  <span>Refine current</span>
                }
              </button>
            }
          </div>
        </div>
      }

      <!-- Tab 2: Icon & Color -->
      @if (activeTab === 'icon') {
        <div class="tab-panel" role="tabpanel">
          <div class="field-block">
            <span class="field-label">Quick icons</span>
            <div class="icon-grid">
              @for (icon of curatedIcons; track icon) {
                <button
                  type="button"
                  class="icon-btn"
                  [class.selected]="!currentImageUrl && currentIconClass === icon"
                  [disabled]="Disabled"
                  [title]="icon"
                  [attr.aria-label]="icon"
                  (click)="selectIcon(icon)"
                >
                  <i [class]="icon" aria-hidden="true"></i>
                </button>
              }
            </div>
          </div>

          <div class="field-block">
            <span class="field-label">All icons</span>
            <mj-icon-picker
              [Value]="currentIconClass"
              [Disabled]="Disabled"
              Placeholder="Search Font Awesome icons..."
              AriaLabel="Space icon"
              (ValueChange)="onIconPickerChange($event)"
            ></mj-icon-picker>
          </div>

          <div class="field-block">
            <span class="field-label">Accent color</span>
            <div class="swatch-row">
              @for (swatch of curatedColors; track swatch) {
                <button
                  type="button"
                  class="swatch-btn"
                  [class.selected]="currentColor.toLowerCase() === swatch.toLowerCase()"
                  [style.background]="swatch"
                  [disabled]="Disabled"
                  [attr.aria-label]="'Color ' + swatch"
                  (click)="selectColor(swatch)"
                ></button>
              }
              <input
                type="color"
                class="native-color"
                aria-label="Custom accent color"
                [value]="normalizedHexColor"
                [disabled]="Disabled"
                (input)="onNativeColorInput($event)"
              />
            </div>
          </div>
        </div>
      }

      <!-- Tab 3: Upload / URL -->
      @if (activeTab === 'upload') {
        <div class="tab-panel" role="tabpanel">
          <div class="field-block">
            <span class="field-label">Upload local image</span>
            <label class="upload-drop" [class.disabled]="Disabled">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                class="sr-only"
                [disabled]="Disabled"
                (change)="onFileSelected($event)"
              />
              <i class="fa-solid fa-image" aria-hidden="true"></i>
              <span>Choose an image file (auto-cropped to 128×128 WebP)</span>
            </label>
          </div>

          <div class="field-block">
            <label class="field-label" for="avatar-url-input">External logo URL</label>
            <div class="url-row">
              <input
                id="avatar-url-input"
                type="url"
                class="mj-input studio-input"
                [(ngModel)]="externalUrlInput"
                [disabled]="Disabled"
                placeholder="https://example.com/logo.png"
                (keydown.enter)="applyExternalUrl()"
              />
              <button
                type="button"
                mjButton
                Variant="secondary"
                Size="sm"
                [disabled]="Disabled || !externalUrlInput.trim()"
                (click)="applyExternalUrl()"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      }

      @if (statusError) {
        <div class="studio-error" role="alert">
          <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
          <span>{{ statusError }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
        font-family: var(--mj-font-family, Inter, sans-serif);
        color: var(--mj-text-primary);
      }

      .studio {
        border: 1px solid var(--mj-border-default);
        border-radius: 10px;
        background: var(--mj-bg-surface-card);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .studio.compact {
        padding: 12px;
      }

      .studio-preview-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--mj-border-subtle);
      }

      .preview-meta {
        flex: 1;
        min-width: 0;
      }

      .preview-title {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--mj-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .preview-sub {
        font-size: 12px;
        color: var(--mj-text-secondary);
      }

      .preview-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }

      .studio-tabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
        padding: 3px;
        border-radius: 8px;
        background: var(--mj-bg-surface-sunken);
      }

      .studio-tab {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 32px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--mj-text-secondary);
        font: inherit;
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.12s ease, color 0.12s ease;
      }

      .studio-tab:hover {
        color: var(--mj-text-primary);
      }

      .studio-tab.active {
        background: var(--mj-bg-surface);
        color: var(--mj-text-primary);
        font-weight: 600;
        box-shadow: var(--mj-shadow-sm);
      }

      .tab-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .field-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .field-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .field-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--mj-text-secondary);
      }

      .opt {
        font-weight: 400;
        color: var(--mj-text-muted);
      }

      .text-link {
        border: 0;
        background: transparent;
        color: var(--mj-brand-primary);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .text-link:disabled {
        opacity: 0.5;
        cursor: default;
      }

      .preset-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .preset-chip {
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        border-radius: 99px;
        padding: 4px 10px;
        font: inherit;
        font-size: 11.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.12s ease;
      }

      .preset-chip:hover {
        border-color: var(--mj-border-strong);
        color: var(--mj-text-primary);
      }

      .preset-chip.selected {
        border-color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 10%, var(--mj-bg-surface));
        color: var(--mj-brand-primary);
        font-weight: 600;
      }

      .studio-input,
      .studio-textarea {
        width: 100%;
        box-sizing: border-box;
      }

      .ai-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .icon-grid {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 6px;
      }

      .icon-btn {
        height: 34px;
        border-radius: 8px;
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        display: grid;
        place-items: center;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.12s ease;
      }

      .icon-btn:hover {
        border-color: var(--mj-border-strong);
        color: var(--mj-text-primary);
      }

      .icon-btn.selected {
        border-color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
        color: var(--mj-brand-primary);
      }

      .swatch-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 7px;
      }

      .swatch-btn {
        width: 24px;
        height: 24px;
        border-radius: 99px;
        border: 2px solid transparent;
        cursor: pointer;
        padding: 0;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mj-text-primary) 15%, transparent);
      }

      .swatch-btn.selected {
        border-color: var(--mj-text-primary);
        transform: scale(1.1);
      }

      .native-color {
        width: 28px;
        height: 28px;
        padding: 0;
        border: 1px solid var(--mj-border-default);
        border-radius: 6px;
        cursor: pointer;
        background: transparent;
      }

      .upload-drop {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 16px;
        border: 1.5px dashed var(--mj-border-strong);
        border-radius: 8px;
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        font-size: 12.5px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.12s ease, background 0.12s ease;
      }

      .upload-drop:hover {
        border-color: var(--mj-brand-primary);
        background: var(--mj-bg-surface-hover);
        color: var(--mj-text-primary);
      }

      .upload-drop.disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      .url-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .url-row .studio-input {
        flex: 1;
      }

      .studio-error {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12.5px;
        color: var(--mj-status-error-text);
        background: var(--mj-status-error-bg);
        border: 1px solid var(--mj-status-error-border);
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
    `,
  ],
})
export class CollabSpaceAvatarStudioComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() public SpaceName = '';
  @Input() public SpaceDescription = '';
  @Input() public SpaceTypeName = '';
  @Input() public IconClass = 'fa-solid fa-compass';
  @Input() public Color = '#0076b6'; // hex-ok: default space brand color
  @Input() public ImageUrl: string | null = null;
  @Input() public Disabled = false;
  @Input() public Compact = false;
  @Input() public Provider: IMetadataProvider | null = null;

  @Output() public AvatarChange = new EventEmitter<SpaceAvatarChangePayload>();

  public activeTab: SpaceAvatarStudioTab = 'ai';
  public selectedPresetId = SPACE_AVATAR_STYLE_PRESETS[0].id;
  public promptText = '';
  public refineInstruction = '';
  public externalUrlInput = '';
  public isGenerating = false;
  public isRefining = false;
  public statusError = '';

  public currentIconClass = 'fa-solid fa-compass';
  public currentColor = '#0076b6'; // hex-ok: default space brand color
  public currentImageUrl: string | null = null;
  public undoStack: SpaceAvatarChangePayload[] = [];

  public readonly stylePresets = SPACE_AVATAR_STYLE_PRESETS;
  public readonly curatedIcons = CURATED_SPACE_ICONS;
  public readonly curatedColors = CURATED_SPACE_COLORS;

  private cachedActionId: string | null = null;
  private promptTouchedByUser = false;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['IconClass']) {
      this.currentIconClass = this.IconClass || 'fa-solid fa-compass';
    }
    if (changes['Color']) {
      this.currentColor = this.Color || '#0076b6'; // hex-ok: default space brand color
    }
    if (changes['ImageUrl']) {
      this.currentImageUrl = this.ImageUrl || null;
      if (this.currentImageUrl && !this.currentImageUrl.startsWith('data:')) {
        this.externalUrlInput = this.currentImageUrl;
      }
    }
    if (
      !this.promptTouchedByUser &&
      (changes['SpaceName'] || changes['SpaceDescription'] || changes['SpaceTypeName'] || !this.promptText)
    ) {
      this.promptText = buildSpaceAvatarPrompt({
        name: this.SpaceName,
        description: this.SpaceDescription,
        kind: this.SpaceTypeName,
        stylePresetId: this.selectedPresetId,
        color: this.currentColor,
      });
    }
  }

  public get normalizedHexColor(): string {
    return /^#[0-9a-f]{6}$/i.test(this.currentColor.trim())
      ? this.currentColor.trim()
      : '#0076b6'; // hex-ok: fallback for native color input
  }

  public selectPreset(presetId: string): void {
    this.selectedPresetId = presetId;
    this.refreshSuggestedPrompt();
  }

  public refreshSuggestedPrompt(): void {
    this.promptTouchedByUser = false;
    this.promptText = buildSpaceAvatarPrompt({
      name: this.SpaceName,
      description: this.SpaceDescription,
      kind: this.SpaceTypeName,
      stylePresetId: this.selectedPresetId,
      color: this.currentColor,
    });
    this.cdr.markForCheck();
  }

  public selectIcon(iconClass: string): void {
    this.statusError = '';
    this.commitChange({
      imageUrl: null,
      iconClass,
      color: this.currentColor,
    });
  }

  public onIconPickerChange(iconClass: string): void {
    const cleaned = (iconClass ?? '').trim();
    if (!cleaned) return;
    this.statusError = '';
    this.commitChange({
      imageUrl: null,
      iconClass: cleaned,
      color: this.currentColor,
    });
  }

  public selectColor(color: string): void {
    this.statusError = '';
    this.commitChange({
      imageUrl: this.currentImageUrl,
      iconClass: this.currentIconClass,
      color,
    });
  }

  public onNativeColorInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.selectColor(val);
    }
  }

  public clearImage(): void {
    if (!this.currentImageUrl) return;
    this.statusError = '';
    this.commitChange({
      imageUrl: null,
      iconClass: this.currentIconClass,
      color: this.currentColor,
    });
  }

  public undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.statusError = '';
    this.currentImageUrl = previous.imageUrl;
    this.currentIconClass = previous.iconClass;
    this.currentColor = previous.color;
    this.AvatarChange.emit({ ...previous });
    this.cdr.markForCheck();
  }

  public async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.statusError = '';
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
      });
      if (!dataUrl) {
        this.statusError = 'Could not read the selected image.';
        this.cdr.markForCheck();
        return;
      }
      const compactWebp = await downscaleImageToSquareWebp(dataUrl);
      this.commitChange({
        imageUrl: compactWebp,
        iconClass: this.currentIconClass,
        color: this.currentColor,
      });
    } catch (error) {
      this.statusError = error instanceof Error ? error.message : 'Failed to process image file.';
    } finally {
      input.value = '';
      this.cdr.markForCheck();
    }
  }

  public applyExternalUrl(): void {
    const url = this.externalUrlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('data:image/')) {
      this.statusError = 'Enter a valid https:// image URL.';
      this.cdr.markForCheck();
      return;
    }
    this.statusError = '';
    this.commitChange({
      imageUrl: url,
      iconClass: this.currentIconClass,
      color: this.currentColor,
    });
  }

  public async generateAvatar(refine: boolean): Promise<void> {
    if (this.isGenerating || this.Disabled) return;
    const basePrompt = this.promptText.trim();
    const refinement = this.refineInstruction.trim();
    const effectivePrompt =
      refine && refinement
        ? `${refinement}. Keep the square app icon emblem clean and legible at 44px and 128px.`
        : basePrompt;
    if (!effectivePrompt) return;

    const provider = this.Provider ?? Metadata.Provider;
    if (!hasExecuteGQL(provider)) {
      this.statusError = 'AI image generation requires an active GraphQL connection.';
      this.cdr.markForCheck();
      return;
    }

    this.isGenerating = true;
    this.isRefining = refine;
    this.statusError = '';
    this.cdr.markForCheck();

    try {
      const actionId = await this.resolveGenerateImageActionId();
      const params: Array<{ Name: string; Value: string; Type: 'Input' }> = [
        { Name: 'Prompt', Value: effectivePrompt, Type: 'Input' },
        { Name: 'Size', Value: '1024x1024', Type: 'Input' },
        { Name: 'OutputFormat', Value: 'base64', Type: 'Input' },
        { Name: 'NumberOfImages', Value: '1', Type: 'Input' },
        { Name: 'NegativePrompt', Value: 'blurry, low quality, watermark, signature, text clutter, border, frame', Type: 'Input' },
      ];
      if (refine && this.currentImageUrl) {
        params.push({ Name: 'SourceImage', Value: this.currentImageUrl, Type: 'Input' });
      }

      const rawResp = (await provider.ExecuteGQL(RUN_ACTION_MUTATION, {
        input: {
          ActionID: actionId,
          Params: params,
          SkipActionLog: false,
        },
      })) as RunActionGraphQLResponse;

      const actionRes = rawResp?.RunAction;
      if (!actionRes?.Success) {
        this.statusError = actionRes?.Message || 'Image generation failed. Please try again.';
        return;
      }

      const rawImageSrc = extractGeneratedImageSource(actionRes.ResultData);
      if (!rawImageSrc) {
        this.statusError = 'The image generator returned no image data.';
        return;
      }

      const webpDataUri = await downscaleImageToSquareWebp(rawImageSrc);
      this.refineInstruction = '';
      this.commitChange({
        imageUrl: webpDataUri,
        iconClass: this.currentIconClass,
        color: this.currentColor,
      });
    } catch (error) {
      this.statusError = error instanceof Error ? error.message : 'Unable to generate image.';
    } finally {
      this.isGenerating = false;
      this.isRefining = false;
      this.cdr.markForCheck();
    }
  }

  private async resolveGenerateImageActionId(): Promise<string> {
    if (this.cachedActionId) return this.cachedActionId;
    try {
      const rv = RunView.FromMetadataProvider(this.Provider ?? Metadata.Provider);
      const res = await rv.RunView<{ ID: string }>({
        EntityName: 'MJ: Actions',
        ExtraFilter: `Name = 'Generate Image'`,
        Fields: ['ID'],
        ResultType: 'simple',
        MaxRows: 1,
      });
      const id = res.Success ? res.Results?.[0]?.ID : null;
      this.cachedActionId = id || GENERATE_IMAGE_ACTION_FALLBACK_ID;
    } catch {
      this.cachedActionId = GENERATE_IMAGE_ACTION_FALLBACK_ID;
    }
    return this.cachedActionId;
  }

  private commitChange(next: SpaceAvatarChangePayload): void {
    const unchanged =
      (this.currentImageUrl ?? null) === (next.imageUrl ?? null) &&
      this.currentIconClass === next.iconClass &&
      this.currentColor === next.color;
    if (unchanged) return;

    this.undoStack.push({
      imageUrl: this.currentImageUrl,
      iconClass: this.currentIconClass,
      color: this.currentColor,
    });
    if (this.undoStack.length > SPACE_AVATAR_MAX_UNDO_STEPS) {
      this.undoStack.shift();
    }

    this.currentImageUrl = next.imageUrl;
    this.currentIconClass = next.iconClass;
    this.currentColor = next.color;
    this.AvatarChange.emit({ ...next });
    this.cdr.markForCheck();
  }
}
