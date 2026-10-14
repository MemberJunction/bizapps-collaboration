import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MJButtonDirective, MJClickableDirective, MJEmptyStateComponent } from '@memberjunction/ng-ui-components';
import type { DataEntryModel, DataRunModel } from './types';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

/**
 * The data surface (B19): what the space's grants offer the viewer, listed; the one chosen runs on the server with its bindings
 * and shows its rows here, or its host (a dashboard or a component) in the projected content, or why nothing came. The empty
 * state says what the space's type offers.
 */
@Component({
  selector: 'mjc-space-data',
  standalone: true,
  imports: [CommonModule, MJButtonDirective, MJClickableDirective, MJEmptyStateComponent, CollabBandChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="data">
      @if (Entries.length === 0) {
        <mj-empty-state Icon="fa-solid fa-table-cells" [Title]="EmptyTitle" [Message]="EmptyMessage"></mj-empty-state>
      } @else {
        <aside class="list" role="list" aria-label="What this space offers">
          @for (entry of Entries; track entry.grantId) {
            <div class="entry" role="listitem" [class.on]="entry.grantId === SelectedGrantId">
              <span class="entry-main" [mjClickable]="'Open ' + entry.label" (click)="EntrySelectRequested.emit(entry)">
                <i [class]="iconFor(entry.kind)"></i>
                <span class="entry-text">
                  <span class="entry-title">{{ entry.label }}</span>
                  <span class="entry-sub">{{ kindLabel(entry.kind) }}@if (entry.isDefault) { · default }</span>
                </span>
              </span>
              <mjc-band-chip [Band]="entry.band" [Label]="entry.band === 'Team' ? TeamLabel : SharedLabel"></mjc-band-chip>
              @if (CanPin) {
                <button type="button" class="pin" [class.on]="entry.isPinned" [attr.aria-label]="(entry.isPinned ? 'Unpin ' : 'Pin ') + entry.label" [title]="entry.isPinned ? 'Unpin' : 'Pin'" (click)="PinToggleRequested.emit(entry)"><i class="fa-solid fa-thumbtack"></i></button>
              }
            </div>
          }
        </aside>
        <section class="pane" [attr.aria-label]="SelectedLabel || 'Result'">
          @if (!Run) {
            <div class="hint">Choose something on the left to run it. It runs on the server, scoped to this space.</div>
          } @else {
            <div class="pane-h">
              <span class="fw7 fs14">{{ SelectedLabel }}</span>
              @if (Run.status === 'rows') { <span class="fs12 muted">{{ Run.rowCount }} row{{ Run.rowCount === 1 ? '' : 's' }}</span> }
              <span class="spacer"></span>
              @if (Run.status !== 'running') {
                <button mjButton Variant="secondary" Size="sm" (click)="RerunRequested.emit()"><i class="fa-solid fa-rotate-right"></i>Run again</button>
              }
            </div>
            @switch (Run.status) {
              @case ('running') { <div class="hint">Running…</div> }
              @case ('error') { <div class="callout error" role="alert"><i class="fa-solid fa-triangle-exclamation"></i> {{ Run.message }}</div> }
              @case ('unavailable') { <div class="callout info"><i class="fa-solid fa-circle-info"></i> {{ Run.message }}</div> }
              @case ('embedded') { <div class="host"><ng-content></ng-content></div> }
              @case ('rows') {
                @if (Run.rows.length === 0) {
                  <div class="hint">No rows.</div>
                } @else {
                  <div class="grid-wrap">
                    <table class="grid">
                      <thead><tr>@for (col of Run.columns; track col) { <th>{{ col }}</th> }</tr></thead>
                      <tbody>
                        @for (row of Run.rows; track $index) {
                          <tr>@for (col of Run.columns; track col) { <td>{{ cell(row[col]) }}</td> }</tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
            }
          }
        </section>
      }
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host { display: block; }
    .data { display: grid; grid-template-columns: 280px 1fr; gap: 16px; padding: 16px; min-height: 240px; }
    @media (max-width: 860px) { .data { grid-template-columns: 1fr; } }
    .list { display: flex; flex-direction: column; gap: 6px; }
    .entry { display: flex; align-items: center; gap: 8px; border: 1px solid var(--mj-border-default, #e5e7eb); border-radius: 10px; padding: 8px 10px; background: var(--mj-bg-surface-card, #fff); }
    .entry.on { border-color: var(--mj-brand-primary, #2563eb); box-shadow: 0 0 0 1px var(--mj-brand-primary, #2563eb) inset; }
    .entry-main { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; min-width: 0; }
    .entry-text { display: flex; flex-direction: column; min-width: 0; }
    .entry-title { font-size: 13px; font-weight: 600; color: var(--mj-text-primary, #111827); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .entry-sub { font-size: 11px; color: var(--mj-text-muted, #6b7280); }
    .pin { border: 0; background: transparent; color: var(--mj-text-muted, #6b7280); cursor: pointer; padding: 2px 4px; }
    .pin.on { color: var(--mj-brand-primary, #2563eb); }
    .pane { border: 1px solid var(--mj-border-default, #e5e7eb); border-radius: 10px; background: var(--mj-bg-surface-card, #fff); padding: 12px 14px; min-width: 0; }
    .pane-h { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .fw7 { font-weight: 700; } .fs14 { font-size: 14px; } .fs12 { font-size: 12px; }
    .muted { color: var(--mj-text-muted, #6b7280); }
    .spacer { flex: 1; }
    .hint { font-size: 13px; color: var(--mj-text-muted, #6b7280); padding: 12px 0; }
    .callout { border-radius: 8px; padding: 8px 12px; font-size: 13px; }
    .callout.error { background: var(--mj-status-error-bg, #fef2f2); color: var(--mj-status-error-text, #b91c1c); }
    .callout.info { background: var(--mj-status-info-bg, #eff6ff); color: var(--mj-status-info-text, #1d4ed8); }
    .grid-wrap { overflow: auto; max-height: 60vh; }
    .grid { border-collapse: collapse; width: 100%; font-size: 13px; }
    .grid th, .grid td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--mj-border-default, #e5e7eb); white-space: nowrap; color: var(--mj-text-primary, #111827); }
    .grid th { position: sticky; top: 0; background: var(--mj-bg-surface-sunken, #f9fafb); font-weight: 600; }
    .host { min-height: 200px; }
  `],
})
export class CollabSpaceDataComponent {
  @Input() public Entries: DataEntryModel[] = [];
  @Input() public SelectedGrantId: string | null = null;
  @Input() public SelectedLabel = '';
  @Input() public Run: DataRunModel | null = null;
  @Input() public CanPin = true;
  @Input() public SharedLabel = 'Shared';
  @Input() public TeamLabel = 'Team';
  @Input() public EmptyTitle = 'Nothing to show yet';
  /** What the space's type offers, so an empty tab still says something true. */
  @Input() public EmptyMessage = 'This space offers no views, queries, dashboards or components.';
  @Output() public EntrySelectRequested = new EventEmitter<DataEntryModel>();
  @Output() public PinToggleRequested = new EventEmitter<DataEntryModel>();
  @Output() public RerunRequested = new EventEmitter<void>();

  public iconFor(kind: DataEntryModel['kind']): string {
    switch (kind) {
      case 'View': return 'fa-solid fa-table-list';
      case 'Query': return 'fa-solid fa-magnifying-glass-chart';
      case 'Dashboard': return 'fa-solid fa-chart-pie';
      case 'Component': return 'fa-solid fa-cubes';
    }
  }

  public kindLabel(kind: DataEntryModel['kind']): string {
    return kind === 'View' ? 'View' : kind === 'Query' ? 'Query' : kind === 'Dashboard' ? 'Dashboard' : 'Component';
  }

  /** A cell's text: dates and objects readable, nulls empty. */
  public cell(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
