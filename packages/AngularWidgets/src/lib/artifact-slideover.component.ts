/**
 * SPDX-License-Identifier: BUSL-1.1
 *
 * Right-hand in-place slide-over sheet hosting MemberJunction's `<mj-artifact-viewer-panel>`
 * so users can inspect documents, presentations, PDFs, and other artifacts without leaving
 * the active Collaboration space or changing the host application route.
 */
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  InjectionToken,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CompositeKey, type UserInfo } from '@memberjunction/core';
import { ArtifactsModule, type ArtifactVersionSavedEvent } from '@memberjunction/ng-artifacts';
import { COLLAB_TOKENS_CSS } from './tokens';

const ARTIFACTS_ENTITY_NAME = 'mj: artifacts';

/** Request payload for opening an artifact in Collaboration's in-place slide-over sheet. */
export interface SpaceArtifactOpenRequest {
  artifactId: string;
  versionNumber?: number;
  canEdit?: boolean;
  canShare?: boolean;
  title?: string;
}

/** Callback signature provided to contributed space tabs and overview cards to open an artifact in-place. */
export type SpaceArtifactOpenCallback = (request: string | SpaceArtifactOpenRequest) => void;

/**
 * Injection token provided by Collaboration's host surface so contributed `BaseSpaceTab` and
 * `BaseSpaceOverviewCard` components can open any `MJ: Artifacts` record in the shared in-place slide-over.
 */
export const COLLAB_OPEN_ARTIFACT = new InjectionToken<SpaceArtifactOpenCallback>('COLLAB_OPEN_ARTIFACT');

/** Normalizes either a bare artifact ID string or a full open request object, returning `null` when empty. */
export function normalizeArtifactOpenRequest(
  request: string | SpaceArtifactOpenRequest | null | undefined,
): SpaceArtifactOpenRequest | null {
  if (!request) return null;
  if (typeof request === 'string') {
    const trimmed = request.trim();
    return trimmed ? { artifactId: trimmed } : null;
  }
  const trimmed = (request.artifactId ?? '').trim();
  if (!trimmed) return null;
  return {
    ...request,
    artifactId: trimmed,
  };
}

/** Extracts the `ID` value from a `CompositeKey`, returning `null` when missing. */
function extractCompositeKeyId(compositeKey: CompositeKey | null | undefined): string | null {
  if (!compositeKey) return null;
  const direct = compositeKey.GetValueByFieldName('ID');
  if (direct != null && String(direct).trim()) {
    return String(direct).trim();
  }
  const fallback = compositeKey.KeyValuePairs?.[0]?.Value;
  return fallback != null && String(fallback).trim() ? String(fallback).trim() : null;
}

/**
 * Accessible right-hand slide-over sheet embedding `@memberjunction/ng-artifacts`'s
 * `<mj-artifact-viewer-panel>` in place over Collaboration.
 *
 * - Default width: `min(920px, 72vw)` (expands to `100vw` when maximized)
 * - Keyboard accessible: `role="dialog"`, `aria-modal="true"`, closes on `Escape` or backdrop click
 * - 100% `--mj-*` semantic design tokens for Light & Dark themes
 */
@Component({
  selector: 'mjc-artifact-slideover',
  standalone: true,
  imports: [ArtifactsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (IsOpen && activeArtifactId) {
      <div
        class="mjc-slideover-backdrop"
        data-testid="artifact-slideover-backdrop"
        (click)="onBackdropClick($event)">
        <section
          class="mjc-slideover-sheet"
          [class.is-maximized]="isMaximized"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="AriaLabel || Title || 'Artifact viewer'"
          data-testid="artifact-slideover-sheet"
          (click)="$event.stopPropagation()">
          @if (CurrentUser) {
            <mj-artifact-viewer-panel
              class="mjc-slideover-viewer"
              [artifactId]="activeArtifactId"
              [CurrentUser]="CurrentUser"
              [EnvironmentId]="EnvironmentId"
              [VersionNumber]="activeVersionNumber"
              [ShowHeader]="true"
              [ShowTabs]="ShowTabs"
              [ShowCloseButton]="true"
              [ShowMaximizeButton]="ShowMaximizeButton"
              [ShowSaveToCollection]="ShowSaveToCollection"
              [CanEdit]="CanEdit"
              [canShare]="CanShare"
              [IsMaximized]="isMaximized"
              (Closed)="close()"
              (MaximizeToggled)="toggleMaximize()"
              (OpenArtifactRequested)="onRelatedArtifactRequested($event)"
              (OpenEntityRecord)="onViewerOpenEntityRecord($event)"
              (VersionSaved)="VersionSaved.emit($event)">
            </mj-artifact-viewer-panel>
          } @else {
            <div class="mjc-slideover-fallback" data-testid="artifact-slideover-no-user">
              <div class="mjc-slideover-fallback-head">
                <span class="mjc-slideover-fallback-title">{{ Title || 'Artifact' }}</span>
                <button
                  type="button"
                  class="mjc-slideover-fallback-close"
                  aria-label="Close artifact viewer"
                  (click)="close()">
                  <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </div>
              <div class="mjc-slideover-fallback-body">
                Sign in is required to load this artifact.
              </div>
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: contents;
      }

      .mjc-slideover-backdrop {
        position: fixed;
        inset: 0;
        z-index: var(--mj-z-drawer, 1000);
        background: var(--mj-bg-overlay, rgba(15, 23, 42, 0.5));
        display: flex;
        justify-content: flex-end;
        align-items: stretch;
        animation: mjc-slideover-fade-in 0.16s ease-out;
      }

      .mjc-slideover-sheet {
        position: relative;
        z-index: calc(var(--mj-z-drawer, 1000) + 1);
        width: min(920px, 72vw);
        max-width: 100vw;
        height: 100%;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        background: var(--mj-surface-overlay-bg, var(--mj-bg-surface));
        color: var(--mj-text-primary);
        border-left: 1px solid var(--mj-surface-overlay-border, var(--mj-border-default));
        box-shadow: var(--mj-surface-overlay-shadow, var(--mj-shadow-2xl));
        font-family: var(--mj-font-family, Inter, sans-serif);
        transition: width 0.18s ease;
        animation: mjc-slideover-enter 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .mjc-slideover-sheet.is-maximized {
        width: min(100vw, 100%);
        border-left: none;
      }

      .mjc-slideover-viewer {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-width: 0;
        min-height: 0;
        height: 100%;
        width: 100%;
      }

      .mjc-slideover-fallback {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--mj-bg-surface);
        color: var(--mj-text-primary);
      }

      .mjc-slideover-fallback-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface-card);
      }

      .mjc-slideover-fallback-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--mj-text-primary);
      }

      .mjc-slideover-fallback-close {
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        width: 30px;
        height: 30px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .mjc-slideover-fallback-close:hover {
        background: var(--mj-bg-surface-hover);
        color: var(--mj-text-primary);
      }

      .mjc-slideover-fallback-body {
        padding: 24px 18px;
        font-size: 13.5px;
        color: var(--mj-text-secondary);
      }

      @media (max-width: 768px) {
        .mjc-slideover-sheet {
          width: 100vw;
          border-left: none;
        }
      }

      @keyframes mjc-slideover-fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes mjc-slideover-enter {
        from {
          transform: translateX(24px);
          opacity: 0.96;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `,
  ],
})
export class CollabArtifactSlideoverComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() public IsOpen = false;
  @Input() public ArtifactId: string | null = null;
  @Input() public VersionNumber?: number;
  @Input() public CurrentUser: UserInfo | null = null;
  @Input() public EnvironmentId = '';
  @Input() public Title = '';
  @Input() public AriaLabel = '';
  @Input() public CanEdit = false;
  @Input() public CanShare = false;
  @Input() public ShowTabs = true;
  @Input() public ShowMaximizeButton = true;
  @Input() public ShowSaveToCollection = false;

  @Output() public Closed = new EventEmitter<void>();
  @Output() public ArtifactSelected = new EventEmitter<string>();
  @Output() public OpenEntityRecordRequested = new EventEmitter<{ entityName: string; compositeKey: CompositeKey }>();
  @Output() public VersionSaved = new EventEmitter<ArtifactVersionSavedEvent>();

  public isMaximized = false;
  public activeArtifactId: string | null = null;
  public activeVersionNumber: number | undefined = undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ArtifactId']) {
      const nextId = (this.ArtifactId ?? '').trim();
      this.activeArtifactId = nextId || null;
      this.activeVersionNumber = this.VersionNumber;
    } else if (changes['VersionNumber']) {
      this.activeVersionNumber = this.VersionNumber;
    }
    if (changes['IsOpen'] && !this.IsOpen) {
      this.isMaximized = false;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  public onEscapeKey(event: Event): void {
    if (!this.IsOpen) return;
    event.stopPropagation();
    this.close();
  }

  public onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  public close(): void {
    this.isMaximized = false;
    this.Closed.emit();
    this.cdr.markForCheck();
  }

  public toggleMaximize(): void {
    this.isMaximized = !this.isMaximized;
    this.cdr.markForCheck();
  }

  public onRelatedArtifactRequested(artifactId: string): void {
    const cleanId = (artifactId ?? '').trim();
    if (!cleanId) return;
    this.activeArtifactId = cleanId;
    this.activeVersionNumber = undefined;
    this.ArtifactSelected.emit(cleanId);
    this.cdr.markForCheck();
  }

  public onViewerOpenEntityRecord(event: { entityName: string; compositeKey: CompositeKey }): void {
    if (!event?.entityName) return;
    if (event.entityName.trim().toLowerCase() === ARTIFACTS_ENTITY_NAME) {
      const artifactId = extractCompositeKeyId(event.compositeKey);
      if (artifactId) {
        this.onRelatedArtifactRequested(artifactId);
        return;
      }
    }
    this.OpenEntityRecordRequested.emit(event);
  }
}
