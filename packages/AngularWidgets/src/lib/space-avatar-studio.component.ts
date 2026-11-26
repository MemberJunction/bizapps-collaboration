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

export interface CachedAvatarPngSource {
  DataUri: string;
  PngBase64: string;
}

export const GENERATE_IMAGE_ACTION_FALLBACK_ID = '048FF309-C2CD-44D8-8A8E-8C771ADA8284';
export const SPACE_AVATAR_MAX_UNDO_STEPS = 10;
export const SPACE_AVATAR_DIMENSION = 128;
export const SPACE_AVATAR_WEBP_QUALITY = 0.85;
export const SPACE_AVATAR_REFINE_PNG_SIZE = 256;

export const SPACE_AVATAR_QUICK_REFINEMENTS: readonly string[] = [
  'Simpler',
  'Bolder contrast',
  'Warmer palette',
  '3D depth',
];

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

/**
 * Matches MJServer's `ActionResultOutput` GraphQL schema (`Success`, `Message`, `ResultCode`, `ResultData`).
 * Note: `ActionResolver.createActionResult` serializes output parameters via `CopyScalarsAndArrays(projected)`
 * into `ResultData`, which yields an indexed map (`{ "0": { Name: "Images", ... }, ... }`) or array.
 */
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

export interface MediaOutputEntry {
  data?: string;
  url?: string;
  mimeType?: string;
}

export interface ActionParamResultEntry {
  Name?: string;
  Type?: string;
  Value?: string | MediaOutputEntry[] | Record<string, MediaOutputEntry> | MediaOutputEntry | number | boolean | null;
}

export interface RunActionResultLike {
  Success?: boolean;
  Message?: string;
  ResultCode?: string;
  ResultData?: string | null;
  Params?: ActionParamResultEntry[] | null;
}

interface RunActionGraphQLResponse {
  RunAction?: RunActionResultLike;
}

interface ParsedActionPayloadObject {
  Params?: ActionParamResultEntry[] | Record<string, ActionParamResultEntry> | null;
  Images?: MediaOutputEntry[] | Record<string, MediaOutputEntry> | null;
  [key: string]:
    | ActionParamResultEntry
    | ActionParamResultEntry[]
    | Record<string, ActionParamResultEntry>
    | MediaOutputEntry[]
    | Record<string, MediaOutputEntry>
    | string
    | number
    | boolean
    | null
    | undefined;
}

export type ExtractImageSourceInput =
  | string
  | RunActionResultLike
  | ActionParamResultEntry[]
  | Record<string, ActionParamResultEntry>
  | ParsedActionPayloadObject
  | null
  | undefined;

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

function isActionParamEntry(value: object | string | number | boolean | null | undefined): value is ActionParamResultEntry {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'Name' in value);
}

function isMediaOutputEntry(value: object | string | number | boolean | null | undefined): value is MediaOutputEntry {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      ('data' in value || 'url' in value),
  );
}

function normalizeMediaEntries(
  raw: string | MediaOutputEntry[] | Record<string, MediaOutputEntry> | MediaOutputEntry | number | boolean | null | undefined,
): MediaOutputEntry[] | string | null {
  if (raw == null || typeof raw === 'number' || typeof raw === 'boolean') return null;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is MediaOutputEntry => isMediaOutputEntry(item));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    try {
      const inner = JSON.parse(trimmed) as MediaOutputEntry[] | Record<string, MediaOutputEntry> | MediaOutputEntry;
      return normalizeMediaEntries(inner);
    } catch {
      return null;
    }
  }
  if (isMediaOutputEntry(raw)) {
    return [raw];
  }
  const values = Object.values(raw).filter((item): item is MediaOutputEntry => isMediaOutputEntry(item));
  return values.length > 0 ? values : null;
}

function extractImageFromParamList(paramsList: readonly ActionParamResultEntry[]): string | null {
  const imagesParam = paramsList.find(
    (p) => typeof p?.Name === 'string' && p.Name.trim().toLowerCase() === 'images',
  );
  if (!imagesParam || imagesParam.Value == null) return null;
  const normalized = normalizeMediaEntries(imagesParam.Value);
  if (typeof normalized === 'string') return normalized;
  return formatFirstMediaEntry(normalized);
}

function formatFirstMediaEntry(entries: readonly MediaOutputEntry[] | null): string | null {
  if (!entries || entries.length === 0) return null;
  const first = entries.find((item) => Boolean(item && (item.data?.trim() || item.url?.trim())));
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

function extractImageFromParsedPayload(
  parsed: ActionParamResultEntry[] | ParsedActionPayloadObject | null | undefined,
): string | null {
  if (!parsed || typeof parsed !== 'object') return null;

  if (Array.isArray(parsed)) {
    return extractImageFromParamList(parsed);
  }

  // 1. Direct Params array or indexed object (e.g. { Params: [...] } or { Params: { "0": ... } })
  if (parsed.Params && typeof parsed.Params === 'object') {
    const paramEntries = Array.isArray(parsed.Params)
      ? parsed.Params
      : Object.values(parsed.Params).filter((v): v is ActionParamResultEntry => isActionParamEntry(v));
    const fromParams = extractImageFromParamList(paramEntries);
    if (fromParams) return fromParams;
  }

  // 2. Indexed object from MJServer's CopyScalarsAndArrays(projected): { "0": { Name: "Images", ... }, ... }
  const indexedEntries = Object.values(parsed).filter((v): v is ActionParamResultEntry => isActionParamEntry(v));
  if (indexedEntries.length > 0) {
    const fromIndexed = extractImageFromParamList(indexedEntries);
    if (fromIndexed) return fromIndexed;
  }

  // 3. Direct Images property fallback
  if (parsed.Images) {
    const normalized = normalizeMediaEntries(parsed.Images);
    if (typeof normalized === 'string') return normalized;
    const fromImages = formatFirstMediaEntry(normalized);
    if (fromImages) return fromImages;
  }

  return null;
}

/**
 * Extracts an image data URI or URL from MJ's `Generate Image` RunAction result.
 * Inspects `Params` FIRST (if present on a result object), then falls back to parsing `ResultData`
 * across all MJ serialization shapes:
 * - Indexed map `{ "0": { Name: "Images", Value: [...] } }` (produced by `CopyScalarsAndArrays` in MJServer `ActionResolver`)
 * - Param array `[{ Name: "Images", Value: [...] | "[...]" }]`
 * - Wrapped `{ Params: [...] }` or `{ Images: [...] }`
 */
export function extractGeneratedImageSource(input: ExtractImageSourceInput): string | null {
  if (!input) return null;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as ActionParamResultEntry[] | ParsedActionPayloadObject;
      return extractImageFromParsedPayload(parsed);
    } catch {
      return null;
    }
  }

  if (Array.isArray(input)) {
    return extractImageFromParamList(input);
  }

  // RunActionResultLike: inspect Params FIRST, then fall back to ResultData
  const asResult = input as RunActionResultLike;
  if (Array.isArray(asResult.Params) && asResult.Params.length > 0) {
    const fromDirectParams = extractImageFromParamList(asResult.Params);
    if (fromDirectParams) return fromDirectParams;
  }

  if (typeof asResult.ResultData === 'string' && asResult.ResultData.trim().length > 0) {
    const fromResultData = extractGeneratedImageSource(asResult.ResultData);
    if (fromResultData) return fromResultData;
  }

  return extractImageFromParsedPayload(input as ParsedActionPayloadObject);
}

/** Strips a `data:<mime>;base64,` prefix, returning only the raw base64 payload. */
function stripDataUrlPrefix(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
}

/**
 * Converts any `data:image/*` URI (including `data:image/webp;base64,...`) onto a square PNG canvas
 * (`256×256` by default) and returns raw PNG base64 (stripped of the `data:image/png;base64,` prefix)
 * so image-edit models never fail on WebP data URIs.
 */
export async function convertDataUrlToPngBase64(
  dataUrl: string,
  size: number = SPACE_AVATAR_REFINE_PNG_SIZE,
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  return new Promise<string | null>((resolve) => {
    const img = new Image();
    if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        const pngUri = canvas.toDataURL('image/png');
        resolve(pngUri.startsWith('data:image/png;base64,') ? stripDataUrlPrefix(pngUri) : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Builds a provider-ready `SourceImage` value (raw base64 PNG or HTTPS URL) for iterative
 * image-to-image refinement via MJ's `Generate Image` action.
 */
export async function buildSourceImageForEdit(
  currentUrl: string,
  cachedPngSource?: CachedAvatarPngSource | null,
): Promise<string | null> {
  const current = currentUrl.trim();
  if (!current) {
    return null;
  }
  if (cachedPngSource && cachedPngSource.DataUri === current) {
    return cachedPngSource.PngBase64;
  }
  if (current.startsWith('http://') || current.startsWith('https://')) {
    return current;
  }
  if (current.startsWith('data:image/')) {
    const pngBase64 = await convertDataUrlToPngBase64(current);
    if (pngBase64) {
      return pngBase64;
    }
    return stripDataUrlPrefix(current);
  }
  return current;
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
  ],
  template: `
    <div class="studio" [class.compact]="Compact" [class.frameless]="Frameless" role="region" aria-label="Space Avatar Studio">
      <!-- Top Navigation Bar (shown in full-dialog overlay mode or when ShowBackButton is true) -->
      @if (ShowBackButton || Frameless) {
        <div class="studio-topbar">
          @if (ShowBackButton) {
            <button
              type="button"
              class="studio-back-btn"
              [disabled]="Disabled || isGenerating"
              (click)="onBackClick()"
            >
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              <span>{{ BackButtonLabel }}</span>
            </button>
          } @else {
            <span></span>
          }
          <span class="studio-status-pill">{{ avatarStatusLabel }}</span>
        </div>
      }

      <!-- Live 64x64 Preview & Undo Header -->
      <div class="studio-preview-bar">
        <div class="preview-tile-wrap" [class.is-busy]="isGenerating">
          <div class="preview-tile-frame" [style.--mjc-type-color]="currentColor || null" [class.has-image]="!!currentImageUrl">
            @if (currentImageUrl) {
              <img [src]="currentImageUrl" [alt]="(SpaceName || 'Space') + ' avatar preview'" class="preview-tile-img" />
            } @else {
              <i [class]="currentIconClass || 'fa-solid fa-compass'" aria-hidden="true"></i>
            }
          </div>
          @if (isGenerating) {
            <span class="preview-tile-spinner" aria-hidden="true">
              <i class="fa-solid fa-spinner fa-spin"></i>
            </span>
          }
        </div>
        <div class="preview-meta">
          <div class="preview-title">{{ SpaceName || 'Space Avatar' }}</div>
          <div class="preview-sub">
            @if (SpaceTypeName) {
              <span>{{ SpaceTypeName }}</span>
              <span aria-hidden="true"> · </span>
            }
            @if (currentImageUrl) {
              <span>Custom avatar logo</span>
            } @else {
              <span>Icon &amp; accent color</span>
            }
          </div>
          @if (!ShowBackButton && !Frameless) {
            <span class="studio-status-pill studio-status-pill--inline">{{ avatarStatusLabel }}</span>
          }
        </div>
        <div class="preview-actions">
          @if (undoStack.length > 0) {
            <button
              type="button"
              mjButton
              Variant="outline"
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
              title="Reset back to icon"
            >
              <i class="fa-solid fa-icons" aria-hidden="true"></i>
              <span>Reset to icon</span>
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

      @if (statusError) {
        <div class="studio-error" role="alert">
          <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
          <span>{{ statusError }}</span>
        </div>
      }

      <!-- Scrollable Tab Body -->
      <div class="studio-tab-body">
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
                  <i class="fa-solid fa-rotate" aria-hidden="true"></i> Auto-fill prompt
                </button>
              </div>
              <div class="preset-chips" role="group" aria-label="Style presets">
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
                rows="3"
                [(ngModel)]="promptText"
                (input)="onPromptUserInput()"
                [disabled]="Disabled || isGenerating"
                placeholder="Describe the logo or emblem for this space..."
              ></textarea>
            </div>

            <div class="ai-actions">
              <button
                type="button"
                mjButton
                Variant="primary"
                Size="sm"
                class="ai-generate-btn"
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
            </div>

            @if (currentImageUrl) {
              <div class="refine-box">
                <label class="refine-label" for="avatar-ai-refine">
                  <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
                  <span>Refine current avatar</span>
                </label>
                <div class="refine-row">
                  <input
                    id="avatar-ai-refine"
                    type="text"
                    class="mj-input studio-input"
                    [(ngModel)]="refineInstruction"
                    [disabled]="Disabled || isGenerating"
                    placeholder="e.g. Cleaner silhouette, warmer gold accents..."
                    (keydown.enter)="generateAvatar(true)"
                  />
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
                      <span>Refine</span>
                    }
                  </button>
                </div>
                <div class="preset-chips" role="group" aria-label="Quick refinements">
                  @for (chip of quickRefinements; track chip) {
                    <button
                      type="button"
                      class="preset-chip"
                      [disabled]="Disabled || isGenerating"
                      (click)="applyQuickRefinement(chip)"
                    >
                      {{ chip }}
                    </button>
                  }
                </div>
              </div>
            }
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
                <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
                <span class="upload-drop-copy">
                  <strong>Choose an image file</strong>
                  <span class="upload-drop-sub">Auto-cropped &amp; compressed to 128×128 WebP</span>
                </span>
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
      </div>
    </div>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
        font-family: var(--mj-font-family, Inter, sans-serif);
        color: var(--mj-text-primary);
        min-width: 0;
        max-width: 100%;
      }

      .studio {
        border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-md, 10px);
        background: var(--mj-bg-surface-card);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-width: 0;
        box-sizing: border-box;
      }

      .studio.compact {
        padding: 12px;
        gap: 12px;
      }

      .studio.frameless {
        border: 0;
        border-radius: 0;
        background: transparent;
        padding: 0;
        gap: 14px;
      }

      .studio-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }

      .studio-back-btn {
        appearance: none;
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-primary);
        border-radius: var(--mj-radius-full, 999px);
        padding: 6px 13px;
        min-height: 34px;
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        cursor: pointer;
        transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
      }

      .studio-back-btn:hover:not(:disabled) {
        border-color: var(--mj-brand-primary);
        color: var(--mj-brand-primary);
        background: var(--mj-bg-surface-hover);
      }

      .studio-back-btn:focus-visible {
        outline: none;
        box-shadow: var(--mj-focus-ring);
      }

      .studio-back-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .studio-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: var(--mj-radius-full, 999px);
        background: var(--mj-status-info-bg);
        color: var(--mj-status-info-text);
        white-space: nowrap;
      }

      .studio-status-pill--inline {
        margin-top: 4px;
      }

      .studio-preview-bar {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 14px;
        border-radius: var(--mj-radius-md, 10px);
        border: 1px solid var(--mj-border-default);
        background: color-mix(in srgb, var(--mj-brand-primary) 6%, var(--mj-bg-surface-card));
      }

      .preview-tile-wrap {
        position: relative;
        width: 64px;
        height: 64px;
        flex: 0 0 64px;
      }

      .preview-tile-frame {
        width: 64px;
        height: 64px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        font-size: 26px;
        color: var(--mj-brand-on-primary);
        background: var(--mjc-type-color, var(--mj-brand-primary));
        overflow: hidden;
        box-shadow: var(--mj-shadow-sm);
        box-sizing: border-box;
      }

      .preview-tile-frame.has-image {
        background: var(--mj-bg-surface-sunken);
        border: 2px solid var(--mj-border-default);
      }

      .preview-tile-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .preview-tile-spinner {
        position: absolute;
        inset: 0;
        border-radius: 14px;
        background: color-mix(in srgb, var(--mj-bg-surface) 75%, transparent);
        color: var(--mj-brand-primary);
        font-size: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .preview-meta {
        flex: 1 1 auto;
        min-width: 0;
      }

      .preview-title {
        font-size: 14.5px;
        font-weight: 700;
        color: var(--mj-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .preview-sub {
        font-size: 12px;
        color: var(--mj-text-secondary);
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .preview-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .studio-tabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
        padding: 4px;
        border-radius: var(--mj-radius-md, 10px);
        background: var(--mj-bg-surface-sunken);
      }

      .studio-tab {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 36px;
        padding: 6px 10px;
        border: 0;
        border-radius: var(--mj-radius-sm, 7px);
        background: transparent;
        color: var(--mj-text-secondary);
        font: inherit;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
      }

      .studio-tab:hover {
        color: var(--mj-text-primary);
      }

      .studio-tab:focus-visible {
        outline: none;
        box-shadow: var(--mj-focus-ring);
      }

      .studio-tab.active {
        background: var(--mj-bg-surface);
        color: var(--mj-text-primary);
        box-shadow: var(--mj-shadow-sm);
      }

      .studio-tab-body {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }

      .tab-panel {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-width: 0;
      }

      .field-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
      }

      .field-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }

      .field-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--mj-text-secondary);
      }

      .text-link {
        border: 0;
        background: transparent;
        color: var(--mj-brand-primary);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        padding: 2px 4px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .text-link:hover:not(:disabled) {
        text-decoration: underline;
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
        border-radius: var(--mj-radius-full, 999px);
        padding: 5px 11px;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
      }

      .preset-chip:hover:not(:disabled) {
        border-color: var(--mj-border-strong);
        background: var(--mj-bg-surface-hover);
        color: var(--mj-text-primary);
      }

      .preset-chip.selected {
        border-color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 12%, var(--mj-bg-surface));
        color: var(--mj-brand-primary);
        font-weight: 600;
      }

      .preset-chip:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .studio-input,
      .studio-textarea {
        width: 100%;
        box-sizing: border-box;
      }

      .studio-textarea {
        min-height: 76px;
        line-height: 1.45;
      }

      .ai-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      .refine-box {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 12px;
        border-top: 1px solid var(--mj-border-default);
      }

      .refine-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        color: var(--mj-brand-primary);
      }

      .refine-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .refine-row .studio-input {
        flex: 1 1 auto;
        min-width: 0;
      }

      .icon-grid {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        gap: 6px;
      }

      .icon-btn {
        min-height: 38px;
        border-radius: var(--mj-radius-md, 8px);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        display: grid;
        place-items: center;
        cursor: pointer;
        font-size: 15px;
        transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
      }

      .icon-btn:hover:not(:disabled) {
        border-color: var(--mj-border-strong);
        background: var(--mj-bg-surface-hover);
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
        gap: 8px;
      }

      .swatch-btn {
        width: 28px;
        height: 28px;
        border-radius: var(--mj-radius-full, 999px);
        border: 2px solid transparent;
        cursor: pointer;
        padding: 0;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mj-text-primary) 15%, transparent);
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }

      .swatch-btn:hover:not(:disabled) {
        transform: scale(1.08);
      }

      .swatch-btn.selected {
        box-shadow: 0 0 0 2px var(--mj-bg-surface), 0 0 0 4px var(--mj-brand-primary);
        transform: scale(1.08);
      }

      .native-color {
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid var(--mj-border-default);
        border-radius: var(--mj-radius-sm, 6px);
        cursor: pointer;
        background: transparent;
      }

      .upload-drop {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border: 1.5px dashed var(--mj-border-strong);
        border-radius: var(--mj-radius-md, 8px);
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-primary);
        font-size: 13px;
        cursor: pointer;
        transition: border-color 0.12s ease, background 0.12s ease;
      }

      .upload-drop > i {
        font-size: 20px;
        color: var(--mj-brand-primary);
        flex-shrink: 0;
      }

      .upload-drop-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .upload-drop-sub {
        font-size: 11.5px;
        color: var(--mj-text-muted);
      }

      .upload-drop:hover {
        border-color: var(--mj-brand-primary);
        background: color-mix(in srgb, var(--mj-brand-primary) 7%, var(--mj-bg-surface-sunken));
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
        flex: 1 1 auto;
        min-width: 0;
      }

      .studio-error {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 9px 12px;
        border-radius: var(--mj-radius-md, 8px);
        font-size: 12.5px;
        line-height: 1.4;
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

      @media (max-width: 640px) {
        .studio-topbar {
          gap: 8px;
        }

        .studio-back-btn {
          min-height: 44px;
          padding: 8px 14px;
        }

        .studio-preview-bar {
          flex-wrap: wrap;
          align-items: center;
          gap: 10px 12px;
          padding: 10px 12px;
        }

        .preview-actions {
          flex: 1 0 100%;
          justify-content: flex-start;
        }

        .studio-tab {
          min-height: 44px;
          font-size: 12px;
          padding: 6px 6px;
          gap: 5px;
        }

        .preset-chip {
          min-height: 36px;
          padding: 6px 12px;
        }

        .ai-actions {
          justify-content: stretch;
        }

        .ai-generate-btn {
          width: 100%;
          min-height: 44px;
        }

        .refine-row,
        .url-row {
          flex-direction: column;
          align-items: stretch;
        }

        .refine-row button,
        .url-row button {
          min-height: 44px;
        }

        .icon-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .icon-btn {
          min-height: 44px;
          font-size: 16px;
        }

        .swatch-btn {
          width: 34px;
          height: 34px;
        }

        .native-color {
          width: 36px;
          height: 36px;
        }
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
  /** Removes the outer card border/padding when rendered as a full-dialog overlay. */
  @Input() public Frameless = false;
  /** Shows a back-navigation button in the studio topbar. */
  @Input() public ShowBackButton = false;
  @Input() public BackButtonLabel = 'Back to space details';
  @Input() public Provider: IMetadataProvider | null = null;

  @Output() public AvatarChange = new EventEmitter<SpaceAvatarChangePayload>();
  @Output() public BackClicked = new EventEmitter<void>();
  @Output() public GeneratingChange = new EventEmitter<boolean>();

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
  public readonly quickRefinements = SPACE_AVATAR_QUICK_REFINEMENTS;
  public readonly curatedIcons = CURATED_SPACE_ICONS;
  public readonly curatedColors = CURATED_SPACE_COLORS;

  private cachedActionId: string | null = null;
  private promptTouchedByUser = false;
  private lastGeneratedPngSource: CachedAvatarPngSource | null = null;

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

  public get avatarStatusLabel(): string {
    const img = this.currentImageUrl?.trim() ?? '';
    if (!img) {
      return 'Icon & color';
    }
    if (img.startsWith('data:image/')) {
      const commaIdx = img.indexOf(',');
      const base64Len = commaIdx >= 0 ? img.length - commaIdx - 1 : img.length;
      const kb = Math.max(0.1, ((base64Len * 3) / 4) / 1024).toFixed(1);
      const format = img.startsWith('data:image/webp')
        ? 'WebP'
        : img.startsWith('data:image/png')
          ? 'PNG'
          : 'Image';
      return `${SPACE_AVATAR_DIMENSION}×${SPACE_AVATAR_DIMENSION} ${format} · ${kb} KB`;
    }
    return 'External logo URL';
  }

  public get normalizedHexColor(): string {
    return /^#[0-9a-f]{6}$/i.test(this.currentColor.trim())
      ? this.currentColor.trim()
      : '#0076b6'; // hex-ok: fallback for native color input
  }

  public onBackClick(): void {
    if (this.isGenerating || this.Disabled) return;
    this.BackClicked.emit();
  }

  public onPromptUserInput(): void {
    this.promptTouchedByUser = true;
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

  public applyQuickRefinement(chip: string): void {
    if (this.isGenerating || this.Disabled || !this.currentImageUrl) return;
    this.refineInstruction = chip;
    void this.generateAvatar(true);
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
    this.GeneratingChange.emit(true);
    this.cdr.markForCheck();

    try {
      const actionId = await this.resolveGenerateImageActionId();
      const params: Array<{ Name: string; Value: string; Type: 'Input' }> = [
        { Name: 'Prompt', Value: effectivePrompt, Type: 'Input' },
        { Name: 'NumberOfImages', Value: '1', Type: 'Input' },
        { Name: 'Size', Value: '1024x1024', Type: 'Input' },
        { Name: 'OutputFormat', Value: 'base64', Type: 'Input' },
      ];
      if (refine && this.currentImageUrl) {
        const sourceImage = await buildSourceImageForEdit(this.currentImageUrl, this.lastGeneratedPngSource);
        if (!sourceImage) {
          this.statusError = 'Could not prepare the current avatar image for refinement.';
          return;
        }
        params.push({ Name: 'SourceImage', Value: sourceImage, Type: 'Input' });
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

      const rawImageSrc = extractGeneratedImageSource(actionRes);
      if (!rawImageSrc) {
        this.statusError = 'The image generator returned no image data.';
        return;
      }

      const webpDataUri = await downscaleImageToSquareWebp(rawImageSrc);
      if (rawImageSrc.startsWith('data:image/png;base64,')) {
        this.lastGeneratedPngSource = {
          DataUri: webpDataUri,
          PngBase64: stripDataUrlPrefix(rawImageSrc),
        };
      } else {
        this.lastGeneratedPngSource = null;
      }
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
      this.GeneratingChange.emit(false);
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
        SkipTotalRowCount: true,
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
