import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { stripCitationMarkdown } from '@mj-biz-apps/collaboration-core';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';
import type { SpaceBand, SpaceChatAnswerSourceReceipt } from './types';

export { stripCitationMarkdown };

/**
 * Fail-closed UI audience guard: a Shared chat must never display a Team receipt chip or inspector row.
 */
export function canDisplaySourceReceiptInAudience(
  receipt: Pick<SpaceChatAnswerSourceReceipt, 'band'>,
  audienceBand: SpaceBand,
): boolean {
  if (audienceBand === 'Shared') {
    return receipt.band === 'Shared';
  }
  return receipt.band === 'Shared' || receipt.band === 'Team';
}

/**
 * Orders receipts deterministically: cited sources first (by citationOrdinal), then supplied sources
 * (by retrievalRank, then sequence).
 */
export function sortAnswerSourceReceipts(
  receipts: readonly SpaceChatAnswerSourceReceipt[],
): SpaceChatAnswerSourceReceipt[] {
  return [...receipts].sort((a, b) => {
    if (a.wasCited !== b.wasCited) return a.wasCited ? -1 : 1;
    const ordA = a.citationOrdinal ?? Number.MAX_SAFE_INTEGER;
    const ordB = b.citationOrdinal ?? Number.MAX_SAFE_INTEGER;
    if (ordA !== ordB) return ordA - ordB;
    const rankA = a.retrievalRank ?? Number.MAX_SAFE_INTEGER;
    const rankB = b.retrievalRank ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return a.sequence - b.sequence;
  });
}

/**
 * Per-answer source citation chips and inspectable provenance receipt drawer for space agent replies (CT-2).
 */
@Component({
  selector: 'mjc-answer-source-receipts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CollabBandChipComponent],
  template: `
    @if (visibleReceipts.length > 0) {
      <div
        class="answer-receipts-wrap"
        data-testid="answer-source-receipts"
        [attr.data-message-id]="MessageId">
        <div class="answer-receipt-summary-row">
          <div class="answer-receipt-summary" data-testid="answer-receipt-summary">
            <i class="fa-solid fa-shield-halved receipt-shield-icon" aria-hidden="true"></i>
            <span>
              Used <strong>{{ visibleReceipts.length }}</strong>
              {{ visibleReceipts.length === 1 ? 'in-reach source' : 'in-reach sources' }}
              · {{ citedReceipts.length }} cited
              · {{ AudienceBand === 'Shared' ? 'Shared reach only' : 'Team + Shared reach' }}
            </span>
          </div>
          <button
            type="button"
            class="receipt-inspect-toggle"
            data-testid="receipt-inspect-toggle"
            [attr.aria-expanded]="isExpanded"
            (click)="toggleInspect()">
            <span>{{ isExpanded ? 'Hide details' : 'Inspect sources' }}</span>
            <i [class]="isExpanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i>
          </button>
        </div>

        @if (citedReceipts.length > 0) {
          <div class="answer-citation-chips" role="list" aria-label="Cited sources">
            @for (receipt of citedReceipts; track receipt.id) {
              <button
                type="button"
                role="listitem"
                class="answer-citation-chip"
                data-testid="answer-citation-chip"
                [attr.data-receipt-id]="receipt.id"
                [attr.data-band]="receipt.band"
                [title]="'Open cited source: ' + cleanTitle(receipt.sourceTitle)"
                (click)="onOpenReceipt(receipt)">
                @if (receipt.citationOrdinal !== null) {
                  <span class="citation-ordinal" data-testid="citation-ordinal">[{{ receipt.citationOrdinal }}]</span>
                }
                <i [class]="sourceIconClass(receipt)" class="citation-kind-icon" aria-hidden="true"></i>
                <span class="citation-chip-title">{{ cleanTitle(receipt.sourceTitle) }}</span>
                <mjc-band-chip [Band]="receipt.band" Size="sm" />
                <i class="fa-solid fa-arrow-up-right-from-square citation-open-icon" aria-hidden="true"></i>
              </button>
            }
          </div>
        }

        @if (isExpanded) {
          <div
            class="answer-receipt-inspector"
            data-testid="answer-receipt-inspector"
            role="region"
            aria-label="Source receipt details">
            @for (receipt of visibleReceipts; track receipt.id) {
              <div
                class="receipt-detail-row"
                data-testid="answer-receipt-row"
                [attr.data-receipt-id]="receipt.id"
                [attr.data-band]="receipt.band">
                <div class="receipt-detail-main">
                  <div class="receipt-detail-title-line">
                    <i [class]="sourceIconClass(receipt)" class="receipt-row-icon" aria-hidden="true"></i>
                    <span class="receipt-detail-title">{{ cleanTitle(receipt.sourceTitle) }}</span>
                    <span
                      class="receipt-status-pill"
                      [class.cited]="receipt.wasCited"
                      data-testid="receipt-status-pill">
                      {{ receipt.wasCited ? (receipt.citationOrdinal !== null ? 'Cited #' + receipt.citationOrdinal : 'Cited') : 'Supplied' }}
                    </span>
                    <mjc-band-chip [Band]="receipt.band" Size="sm" />
                  </div>
                  <div class="receipt-detail-meta">
                    <span>{{ rankingModeLabel(receipt.rankingMode) }}</span>
                    @if (receipt.retrievalRank !== null) {
                      <span>· Rank #{{ receipt.retrievalRank }}</span>
                    }
                    @if (formatScore(receipt.relevanceScore); as scoreText) {
                      <span>· Score {{ scoreText }}</span>
                    }
                    @if (receipt.estimatedTokens > 0) {
                      <span>· ~{{ receipt.estimatedTokens }} tokens</span>
                    }
                    @if (receipt.wasTruncated) {
                      <span>· Excerpt truncated</span>
                    }
                  </div>
                </div>
                <button
                  type="button"
                  class="receipt-open-btn"
                  data-testid="receipt-open-btn"
                  [attr.aria-label]="'Open ' + cleanTitle(receipt.sourceTitle)"
                  (click)="onOpenReceipt(receipt)">
                  <span>Open</span>
                  <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                </button>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
      }

      .answer-receipts-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--mj-space-2);
        padding: var(--mj-space-2) var(--mj-space-3);
        border-radius: var(--mj-radius-md);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface-card);
      }

      .answer-receipt-summary-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--mj-space-2);
        flex-wrap: wrap;
      }

      .answer-receipt-summary {
        display: inline-flex;
        align-items: center;
        gap: var(--mj-space-2);
        font-size: var(--mj-text-xs);
        color: var(--mj-text-secondary);
        min-width: 0;
      }

      .answer-receipt-summary strong {
        color: var(--mj-text-primary);
        font-weight: var(--mj-font-semibold);
      }

      .receipt-shield-icon {
        color: var(--mj-brand-primary);
        font-size: var(--mj-text-xs);
        flex-shrink: 0;
      }

      .receipt-inspect-toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--mj-space-1);
        padding: var(--mj-space-0-5) var(--mj-space-2);
        border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-secondary);
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-semibold);
        cursor: pointer;
        transition: border-color var(--mj-transition-fast), color var(--mj-transition-fast);
      }

      .receipt-inspect-toggle:hover {
        border-color: var(--mj-brand-primary);
        color: var(--mj-brand-primary);
      }

      .answer-citation-chips {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--mj-space-1-5);
      }

      .answer-citation-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--mj-space-1-5);
        padding: var(--mj-space-0-5) var(--mj-space-2);
        border-radius: var(--mj-radius-pill);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-text-primary);
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-medium);
        cursor: pointer;
        max-width: 100%;
        transition: border-color var(--mj-transition-fast), background-color var(--mj-transition-fast);
      }

      .answer-citation-chip:hover {
        border-color: var(--mj-brand-primary);
        background: var(--mj-bg-surface-hover);
      }

      .citation-ordinal {
        font-weight: var(--mj-font-bold);
        color: var(--mj-brand-primary);
        font-variant-numeric: tabular-nums;
      }

      .citation-kind-icon {
        color: var(--mj-text-muted);
        font-size: var(--mj-text-xs);
      }

      .citation-chip-title {
        max-width: 240px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .citation-open-icon {
        color: var(--mj-text-muted);
        font-size: var(--mj-text-xs);
      }

      .answer-receipt-inspector {
        display: flex;
        flex-direction: column;
        gap: var(--mj-space-1-5);
        padding-top: var(--mj-space-2);
        border-top: 1px solid var(--mj-border-subtle);
      }

      .receipt-detail-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--mj-space-3);
        padding: var(--mj-space-1-5) var(--mj-space-2);
        border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-subtle);
        background: var(--mj-bg-surface);
      }

      .receipt-detail-main {
        display: flex;
        flex-direction: column;
        gap: var(--mj-space-0-5);
        min-width: 0;
        flex: 1;
      }

      .receipt-detail-title-line {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--mj-space-1-5);
        min-width: 0;
      }

      .receipt-row-icon {
        color: var(--mj-text-muted);
        font-size: var(--mj-text-xs);
      }

      .receipt-detail-title {
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-semibold);
        color: var(--mj-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 320px;
      }

      .receipt-status-pill {
        display: inline-flex;
        align-items: center;
        padding: 1px var(--mj-space-1-5);
        border-radius: var(--mj-radius-pill);
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-semibold);
        background: var(--mj-bg-surface-sunken);
        color: var(--mj-text-secondary);
        border: 1px solid var(--mj-border-subtle);
      }

      .receipt-status-pill.cited {
        background: var(--mj-status-info-bg);
        color: var(--mj-status-info-text);
        border-color: var(--mj-status-info-border);
      }

      .receipt-detail-meta {
        font-size: var(--mj-text-xs);
        color: var(--mj-text-muted);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--mj-space-1);
      }

      .receipt-open-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--mj-space-1);
        padding: var(--mj-space-1) var(--mj-space-2);
        border-radius: var(--mj-radius-sm);
        border: 1px solid var(--mj-border-default);
        background: var(--mj-bg-surface);
        color: var(--mj-brand-primary);
        font-size: var(--mj-text-xs);
        font-weight: var(--mj-font-semibold);
        cursor: pointer;
        flex-shrink: 0;
        transition: border-color var(--mj-transition-fast), background-color var(--mj-transition-fast);
      }

      .receipt-open-btn:hover {
        border-color: var(--mj-brand-primary);
        background: var(--mj-bg-surface-hover);
      }
    `,
  ],
})
export class CollabAnswerSourceReceiptsComponent {
  @Input() public MessageId = '';
  @Input() public AudienceBand: SpaceBand = 'Shared';
  @Input() public Receipts: readonly SpaceChatAnswerSourceReceipt[] = [];
  @Output() public ReceiptOpenRequested = new EventEmitter<SpaceChatAnswerSourceReceipt>();

  public isExpanded = false;

  public get visibleReceipts(): SpaceChatAnswerSourceReceipt[] {
    return sortAnswerSourceReceipts(
      this.Receipts.filter((receipt) => canDisplaySourceReceiptInAudience(receipt, this.AudienceBand)),
    );
  }

  public get citedReceipts(): SpaceChatAnswerSourceReceipt[] {
    return this.visibleReceipts.filter((receipt) => receipt.wasCited);
  }

  public toggleInspect(): void {
    this.isExpanded = !this.isExpanded;
  }

  public onOpenReceipt(receipt: SpaceChatAnswerSourceReceipt): void {
    this.ReceiptOpenRequested.emit(receipt);
  }

  public cleanTitle(title: string): string {
    return stripCitationMarkdown(title) || 'Untitled source';
  }

  public sourceIconClass(receipt: SpaceChatAnswerSourceReceipt): string {
    return receipt.sourceKind === 'KnowledgeSource'
      ? 'fa-solid fa-book-bookmark'
      : 'fa-solid fa-file-lines';
  }

  public rankingModeLabel(mode: SpaceChatAnswerSourceReceipt['rankingMode']): string {
    switch (mode) {
      case 'vector':
        return 'Vector match';
      case 'lexical':
        return 'Lexical match';
      case 'grant':
        return 'Granted knowledge';
      case 'none':
        return 'In-scope source';
    }
  }

  public formatScore(score: number | null): string | null {
    if (score === null || !Number.isFinite(score)) return null;
    return score.toFixed(2);
  }
}
