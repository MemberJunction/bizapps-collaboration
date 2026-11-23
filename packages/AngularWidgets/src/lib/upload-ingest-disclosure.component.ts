import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { SPACE_UPLOAD_MAX_BYTES, stripCitationMarkdown } from '@mj-biz-apps/collaboration-core';
import { COLLAB_TOKENS_CSS } from './tokens';
import type { SpaceBand } from './types';

export type UploadIngestMode = 'upload' | 'link';
export type UploadIngestBandDisplay = SpaceBand | 'Default';

export interface UploadIngestDisclosureInput {
  spaceName?: string;
  mode?: UploadIngestMode;
  selectedBand?: SpaceBand | null;
  canSeeTeamBand?: boolean;
  maxBytes?: number;
  agentRetrieval?: string;
}

export interface UploadIngestDisclosureItem {
  id: 'ingest' | 'indexing' | 'visibility' | 'retention';
  title: string;
  description: string;
  iconClass: string;
}

export interface UploadIngestDisclosureModel {
  bandKind: UploadIngestBandDisplay;
  bandLabel: string;
  summary: string;
  items: readonly UploadIngestDisclosureItem[];
}

function formatUploadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = parseFloat((bytes / Math.pow(k, idx)).toFixed(1));
  return `${value} ${units[idx]}`;
}

function cleanPlainLabel(raw: string | undefined, fallback: string): string {
  const cleaned = stripCitationMarkdown(raw ?? '').trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Builds 100% generic, domain-neutral plain-text disclosure copy (zero Markdown syntax)
 * describing how space uploads are ingested, indexed, scoped to participants, and retained.
 */
export function buildUploadIngestDisclosureModel(input: UploadIngestDisclosureInput): UploadIngestDisclosureModel {
  const spaceLabel = cleanPlainLabel(input.spaceName, 'this space');
  const mode: UploadIngestMode = input.mode === 'link' ? 'link' : 'upload';
  const maxBytes = typeof input.maxBytes === 'number' && input.maxBytes > 0 ? input.maxBytes : SPACE_UPLOAD_MAX_BYTES;
  const maxBytesLabel = formatUploadBytes(maxBytes);
  const retrieval = (input.agentRetrieval ?? 'Included').trim();
  const canSeeTeamBand = input.canSeeTeamBand !== false;

  const bandKind: UploadIngestBandDisplay =
    input.selectedBand === 'Shared'
      ? 'Shared'
      : input.selectedBand === 'Team' && canSeeTeamBand
        ? 'Team'
        : 'Default';

  const bandLabel =
    bandKind === 'Shared'
      ? 'Shared band'
      : bandKind === 'Team'
        ? 'Team band'
        : 'Space default band';

  const summary =
    mode === 'link'
      ? `Linked documents in ${spaceLabel} store only the external reference under ${bandLabel.toLowerCase()} visibility without copying bytes or indexing text.`
      : `Uploaded files in ${spaceLabel} are stored in MemberJunction Storage, indexed for space-scoped search and assistant answers, and governed by ${bandLabel.toLowerCase()} reach.`;

  const ingestDescription =
    mode === 'link'
      ? `Linking a cloud document in ${spaceLabel} records the URL as a space library reference without copying binary bytes into MemberJunction Storage.`
      : `Files uploaded to ${spaceLabel} (up to ${maxBytesLabel}) are written to MemberJunction Storage and attached to the space library as a tracked item.`;

  let indexingDescription: string;
  if (mode === 'link') {
    indexingDescription =
      'Linked document URLs are not automatically fetched or chunked into the space search index; participants open the external link under its host permissions.';
  } else if (retrieval === 'ExcludedEntirely') {
    indexingDescription = `Uploaded files are queued in the Content Pipeline (Space files source) for library processing, while assistant retrieval is currently excluded for ${spaceLabel}.`;
  } else if (retrieval === 'ExcludedFromParentScope') {
    indexingDescription = `Uploaded files are extracted, chunked, and indexed by the Content Pipeline (Space files source) for search and assistant answers inside ${spaceLabel} only, excluded from parent-space queries.`;
  } else {
    indexingDescription =
      'Uploaded files are extracted, chunked, and indexed by the Content Pipeline (Space files source) for space-scoped search and assistant answers.';
  }

  let visibilityDescription: string;
  let visibilityIcon: string;
  if (bandKind === 'Shared') {
    visibilityIcon = 'fa-solid fa-eye';
    visibilityDescription =
      'Shared band items are visible to every active member who reaches this space, including external space participants, and are eligible for Shared conversation assistant answers.';
  } else if (bandKind === 'Team') {
    visibilityIcon = 'fa-solid fa-lock';
    visibilityDescription =
      'Team band items are visible only to team seats permitted to read the Team band; external space participants and Shared conversations cannot read or cite them.';
  } else {
    visibilityIcon = 'fa-solid fa-shield-halved';
    visibilityDescription =
      'When no band is selected, the space type default applies on the server. Row-level security filters enforce space reach and band rules across screens, APIs, and assistant turns.';
  }

  const retentionDescription =
    'Access stays bound to active space membership and space lifecycle status. Removing a participant seat revokes access immediately, and deleting the last space item for an uploaded file removes its indexed chunks and tombstones its content item.';

  return {
    bandKind,
    bandLabel,
    summary,
    items: [
      {
        id: 'ingest',
        title: 'Ingest and storage',
        description: ingestDescription,
        iconClass: mode === 'link' ? 'fa-solid fa-link' : 'fa-solid fa-cloud-arrow-up',
      },
      {
        id: 'indexing',
        title: 'Extraction and indexing',
        description: indexingDescription,
        iconClass: 'fa-solid fa-magnifying-glass-chart',
      },
      {
        id: 'visibility',
        title: 'Participant visibility scope',
        description: visibilityDescription,
        iconClass: visibilityIcon,
      },
      {
        id: 'retention',
        title: 'Retention and removal boundaries',
        description: retentionDescription,
        iconClass: 'fa-solid fa-clock-rotate-left',
      },
    ],
  };
}

let nextDisclosureInstanceId = 0;

/**
 * XS-8 Upload Ingest Model Disclosure component.
 * Displays an inline plain-text ingest/visibility summary with an accessible expandable
 * details panel styled strictly with MemberJunction semantic `--mj-*` design tokens.
 */
@Component({
  selector: 'mjc-upload-ingest-disclosure',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="ingest-disclosure"
      [class.compact]="Compact"
      [class.expanded]="isExpanded"
      role="region"
      [attr.aria-labelledby]="Compact ? null : headingId"
      [attr.aria-label]="Compact ? 'Library upload ingest and visibility model' : null"
      data-testid="upload-ingest-disclosure"
    >
      <div class="disclosure-header">
        <div class="disclosure-lead">
          <span class="disclosure-icon-badge" aria-hidden="true">
            <i class="fa-solid fa-shield-halved"></i>
          </span>
          <div class="disclosure-copy">
            <div class="disclosure-title-row">
              <span [id]="headingId" class="disclosure-title">Upload ingest and visibility model</span>
              <span
                class="disclosure-band-pill"
                [class.shared]="model.bandKind === 'Shared'"
                [class.team]="model.bandKind === 'Team'"
                data-testid="disclosure-band-pill"
              >
                {{ model.bandLabel }}
              </span>
            </div>
            <p class="disclosure-summary" data-testid="disclosure-summary">{{ model.summary }}</p>
          </div>
        </div>
        <button
          type="button"
          class="disclosure-toggle"
          data-testid="disclosure-toggle"
          [attr.aria-expanded]="isExpanded"
          [attr.aria-controls]="panelId"
          (click)="toggleExpanded()"
        >
          <span>{{ isExpanded ? 'Hide details' : 'Ingest details' }}</span>
          <i [class]="isExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i>
        </button>
      </div>

      @if (isExpanded) {
        <div
          [id]="panelId"
          class="disclosure-panel"
          role="region"
          [attr.aria-label]="Compact ? 'Library upload ingest details' : 'Upload ingest details'"
          data-testid="disclosure-details-panel"
        >
          <div class="disclosure-grid">
            @for (item of model.items; track item.id) {
              <div class="disclosure-item" [attr.data-testid]="'disclosure-item-' + item.id">
                <div class="disclosure-item-head">
                  <i [class]="item.iconClass" class="disclosure-item-icon" aria-hidden="true"></i>
                  <span class="disclosure-item-title">{{ item.title }}</span>
                </div>
                <p class="disclosure-item-desc">{{ item.description }}</p>
              </div>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
        font-family: var(--mj-font-family);
        color: var(--mj-text-primary);
      }

      .ingest-disclosure {
        display: flex;
        flex-direction: column;
        gap: var(--mj-space-2);
        padding: var(--mj-space-3);
        border-radius: var(--mj-radius-md);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface-card);
      }

      .ingest-disclosure.compact {
        padding: var(--mj-space-2) var(--mj-space-3);
      }

      .disclosure-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--mj-space-3);
        flex-wrap: wrap;
      }

      .disclosure-lead {
        display: flex;
        align-items: flex-start;
        gap: var(--mj-space-2);
        flex: 1 1 200px;
        min-width: 0;
      }

      .disclosure-icon-badge {
        width: 28px;
        height: 28px;
        border-radius: var(--mj-radius-sm);
        display: inline-grid;
        place-items: center;
        flex: none;
        background: var(--mj-status-info-bg);
        color: var(--mj-status-info-text);
        border: 1px solid var(--mj-status-info-border);
        font-size: var(--mj-text-xs);
      }

      .disclosure-copy {
        display: flex;
        flex-direction: column;
        gap: var(--mj-space-0-5);
        min-width: 0;
        flex: 1;
      }

      .disclosure-title-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--mj-space-2);
      }

      .disclosure-title {
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-semibold);
        color: var(--mj-text-primary);
      }

      .disclosure-band-pill {
        display: inline-flex;
        align-items: center;
        padding: 1px var(--mj-space-2);
        border-radius: var(--mj-radius-pill);
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-semibold);
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-secondary);
        border: 1px solid var(--mj-border-default);
      }

      .disclosure-band-pill.shared {
        background: var(--mjc-shared-bg);
        color: var(--mjc-shared);
        border-color: var(--mjc-shared-border);
      }

      .disclosure-band-pill.team {
        background: var(--mjc-team-bg);
        color: var(--mjc-team);
        border-color: var(--mjc-team-border);
      }

      .disclosure-summary {
        margin: 0;
        font-size: var(--mj-text-xs);
        color: var(--mj-text-secondary);
        line-height: var(--mjc-line-height);
      }

      .disclosure-toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--mj-space-1-5);
        padding: var(--mj-space-1) var(--mj-space-2);
        border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-primary);
        font-family: inherit;
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-semibold);
        cursor: pointer;
        flex: none;
        transition: border-color var(--mj-transition-fast), color var(--mj-transition-fast), background-color var(--mj-transition-fast);
      }

      .disclosure-toggle:hover {
        border-color: var(--mj-brand-primary);
        color: var(--mj-brand-primary);
        background: var(--mj-bg-surface-hover);
      }

      .disclosure-toggle:focus-visible {
        outline: 2px solid var(--mj-border-focus);
        outline-offset: 2px;
      }

      .disclosure-panel {
        padding-top: var(--mj-space-2);
        border-top: 1px solid var(--mj-border-subtle);
      }

      .disclosure-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
        gap: var(--mj-space-2);
      }

      .disclosure-item {
        display: flex;
        flex-direction: column;
        gap: var(--mj-space-1);
        padding: var(--mj-space-2);
        border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-subtle);
        background: var(--mj-bg-surface);
      }

      .disclosure-item-head {
        display: flex;
        align-items: center;
        gap: var(--mj-space-1-5);
      }

      .disclosure-item-icon {
        color: var(--mj-brand-primary);
        font-size: var(--mj-text-xs);
        flex: none;
      }

      .disclosure-item-title {
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-semibold);
        color: var(--mj-text-primary);
      }

      .disclosure-item-desc {
        margin: 0;
        font-size: var(--mj-text-xs);
        color: var(--mj-text-secondary);
        line-height: var(--mjc-line-height);
      }
    `,
  ],
})
export class CollabUploadIngestDisclosureComponent implements OnChanges {
  private readonly instanceId = ++nextDisclosureInstanceId;

  @Input() public SpaceName = '';
  @Input() public Mode: UploadIngestMode = 'upload';
  @Input() public SelectedBand: SpaceBand | null = null;
  @Input() public CanSeeTeamBand = true;
  @Input() public MaxBytes: number = SPACE_UPLOAD_MAX_BYTES;
  @Input() public AgentRetrieval = 'Included';
  @Input() public DefaultExpanded = false;
  @Input() public Compact = false;

  @Output() public ExpandedChange = new EventEmitter<boolean>();

  public isExpanded = false;
  private hasUserToggled = false;

  public readonly headingId = `mjc-upload-disclosure-heading-${this.instanceId}`;
  public readonly panelId = `mjc-upload-disclosure-panel-${this.instanceId}`;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['DefaultExpanded'] && !this.hasUserToggled) {
      this.isExpanded = Boolean(this.DefaultExpanded);
    }
  }

  public get model(): UploadIngestDisclosureModel {
    return buildUploadIngestDisclosureModel({
      spaceName: this.SpaceName,
      mode: this.Mode,
      selectedBand: this.SelectedBand,
      canSeeTeamBand: this.CanSeeTeamBand,
      maxBytes: this.MaxBytes,
      agentRetrieval: this.AgentRetrieval,
    });
  }

  public toggleExpanded(): void {
    this.hasUserToggled = true;
    this.isExpanded = !this.isExpanded;
    this.ExpandedChange.emit(this.isExpanded);
  }
}

export { CollabUploadIngestDisclosureComponent as UploadIngestDisclosureComponent };
