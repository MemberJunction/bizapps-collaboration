import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective, MJEmptyStateComponent } from '@memberjunction/ng-ui-components';
import type { NoteDraft, NoteModel, SpaceBand } from './types';
import { CollabBandChipComponent } from './band-chip.component';
import { COLLAB_TOKENS_CSS } from './tokens';

/**
 * The Notes tab (B21): the space's notes the viewer may read, a composer for a new note or an edit, and each note's actions:
 * promote (call 15: a Team note moves to Shared, after a confirmation that says what becomes visible), turn into a document,
 * pin, edit and delete. The section owns the data; this draws it and asks.
 */
@Component({
  selector: 'mjc-space-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, MJButtonDirective, MJEmptyStateComponent, CollabBandChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="notes">
      <div class="notes-head">
        <div>
          <div class="fw7 fs14">{{ Title }}</div>
          <div class="fs12 muted">{{ Subtitle }}</div>
        </div>
        @if (CanWrite && !draft) {
          <button mjButton Variant="primary" Size="sm" (click)="openComposer(null)"><i class="fa-solid fa-plus"></i>New note</button>
        }
      </div>

      @if (ErrorMessage) {
        <div class="callout error" role="alert"><i class="fa-solid fa-triangle-exclamation"></i> {{ ErrorMessage }}</div>
      }
      @if (SaveError && !draft) {
        <div class="callout error" role="alert"><i class="fa-solid fa-triangle-exclamation"></i> {{ SaveError }}</div>
      }

      @if (draft; as d) {
        <form class="composer card" (ngSubmit)="submit()" aria-label="Note composer">
          <input class="title-input" name="title" [(ngModel)]="d.title" placeholder="Title" maxlength="200" required autocomplete="off" />
          <textarea class="body-input" name="body" [(ngModel)]="d.body" rows="6" placeholder="Write the note (Markdown is kept as text)"></textarea>
          <div class="composer-row">
            @if (CanSeeTeam) {
              <div class="seg" role="group" aria-label="Who can see this note">
                <button type="button" [class.on]="d.band === 'Shared'" (click)="setBand(d, 'Shared')">{{ SharedLabel }}</button>
                <button type="button" [class.on]="d.band === 'Team'" (click)="setBand(d, 'Team')">{{ TeamLabel }}</button>
              </div>
              @if (d.band === 'Team') {
                <label class="check"><input type="checkbox" name="private" [checked]="d.visibility === 'Private'" (change)="togglePrivate(d)" /> Only me</label>
              }
            } @else {
              <span class="fs12 muted">Shared with {{ SharedLabel }}</span>
            }
            <span class="spacer"></span>
            <button mjButton type="button" Variant="secondary" Size="sm" [disabled]="IsSaving" (click)="cancel()">Cancel</button>
            <button mjButton type="submit" Variant="primary" Size="sm" [disabled]="IsSaving || !d.title.trim()">{{ IsSaving ? 'Saving…' : (d.id ? 'Save changes' : 'Add note') }}</button>
          </div>
          @if (SaveError) { <div class="callout error">{{ SaveError }}</div> }
        </form>
      }

      @if (IsLoading) {
        <div class="muted fs12 pad">Loading notes…</div>
      } @else if (Notes.length === 0 && !draft) {
        <mj-empty-state Icon="fa-solid fa-note-sticky" Title="No notes yet" [Message]="EmptyMessage"></mj-empty-state>
      }

      @for (note of Notes; track note.id) {
        <article class="card note" [class.team]="note.band === 'Team'" [attr.aria-label]="'Note: ' + note.title">
          <div class="note-h">
            <div class="grow">
              <div class="fw7 fs14 note-title">{{ note.title }}</div>
              <div class="fs12 muted">{{ note.authorName }} · {{ note.updatedLabel }}@if (note.visibility === 'Private') { · only you }</div>
            </div>
            <mjc-band-chip [Band]="note.band" [Label]="note.band === 'Team' ? TeamLabel : SharedLabel"></mjc-band-chip>
            @if (note.isPinned) { <i class="fa-solid fa-thumbtack pinned" title="Pinned"></i> }
          </div>
          @if (note.body) { <div class="note-body">{{ note.body }}</div> }
          <div class="note-actions">
            @if (note.canPromote && note.band === 'Team' && note.visibility === 'Space' && !IsReadOnly) {
              <button mjButton Variant="secondary" Size="sm" (click)="askPromote(note)"><i class="fa-solid fa-arrow-up-right-from-square"></i>Share with {{ SharedLabel }}</button>
            }
            @if (CanWrite && !IsReadOnly) {
              <button mjButton Variant="secondary" Size="sm" (click)="TurnIntoDocumentRequested.emit(note)"><i class="fa-solid fa-file-lines"></i>Turn into document</button>
            }
            <button mjButton Variant="secondary" Size="sm" (click)="PinToggleRequested.emit(note)"><i class="fa-solid fa-thumbtack"></i>{{ note.isPinned ? 'Unpin' : 'Pin' }}</button>
            @if (note.isMine && !IsReadOnly) {
              <button mjButton Variant="secondary" Size="sm" (click)="openComposer(note)"><i class="fa-solid fa-pen"></i>Edit</button>
              <button mjButton Variant="secondary" Size="sm" (click)="DeleteRequested.emit(note)"><i class="fa-solid fa-trash"></i>Delete</button>
            }
          </div>
          @if (promoting?.id === note.id) {
            <div class="confirm" role="dialog" aria-label="Share this note?">
              <div class="fw7 fs13">Share this note with {{ SharedLabel }}?</div>
              <div class="fs12">{{ PromotionConsequence(note) }}</div>
              <div class="confirm-row">
                <button mjButton Variant="primary" Size="sm" [disabled]="IsSaving" (click)="confirmPromote(note)">Share it</button>
                <button mjButton Variant="secondary" Size="sm" [disabled]="IsSaving" (click)="promoting = null">Keep it with the team</button>
              </div>
            </div>
          }
        </article>
      }
    </div>
  `,
  styles: [COLLAB_TOKENS_CSS, `
    :host { display: block; }
    .notes { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .notes-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .fw7 { font-weight: 700; } .fs14 { font-size: 14px; } .fs13 { font-size: 13px; } .fs12 { font-size: 12px; }
    .muted { color: var(--mj-text-muted, #6b7280); }
    .pad { padding: 8px 0; }
    .grow { flex: 1; min-width: 0; }
    .spacer { flex: 1; }
    .card { background: var(--mj-bg-surface-card, #fff); border: 1px solid var(--mj-border-default, #e5e7eb); border-radius: 10px; padding: 12px 14px; }
    .note.team { border-left: 3px solid var(--mjc-team, #7c3aed); }
    .note-h { display: flex; align-items: flex-start; gap: 10px; }
    .note-title { overflow-wrap: anywhere; }
    .note-body { margin-top: 8px; white-space: pre-wrap; font-size: 13px; line-height: 1.45; color: var(--mj-text-primary, #111827); }
    .note-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .pinned { color: var(--mj-brand-primary, #2563eb); }
    .composer { display: flex; flex-direction: column; gap: 8px; }
    .title-input, .body-input { font: inherit; width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--mj-border-default, #e5e7eb); border-radius: 8px; background: var(--mj-bg-surface-card, #fff); color: var(--mj-text-primary, #111827); }
    .body-input { resize: vertical; min-height: 96px; }
    .composer-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .seg { display: inline-flex; border: 1px solid var(--mj-border-default, #e5e7eb); border-radius: 999px; overflow: hidden; }
    .seg button { font: inherit; font-size: 12px; padding: 4px 12px; border: 0; background: transparent; color: var(--mj-text-primary, #111827); cursor: pointer; }
    .seg button.on { background: var(--mj-brand-primary, #2563eb); color: var(--mj-brand-on-primary, #fff); }
    .check { font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
    .callout { border-radius: 8px; padding: 8px 12px; font-size: 13px; }
    .callout.error { background: var(--mj-status-error-bg, #fef2f2); color: var(--mj-status-error-text, #b91c1c); }
    .confirm { margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: var(--mj-bg-surface-sunken, #f9fafb); border: 1px dashed var(--mj-border-default, #e5e7eb); display: flex; flex-direction: column; gap: 6px; }
    .confirm-row { display: flex; gap: 8px; margin-top: 4px; }
  `],
})
export class CollabSpaceNotesComponent implements OnInit {
  /** The quick add from another tab: the composer opens as the tab appears. */
  @Input() public AutoOpen = false;

  public ngOnInit(): void {
    if (this.AutoOpen) this.openComposer(null);
  }

  @Input() public Title = 'Notes';
  @Input() public Subtitle = 'Light notes that live in this space.';
  @Input() public EmptyMessage = 'Write the first note: a quick thought, a decision, a reminder for the space.';
  @Input() public Notes: NoteModel[] = [];
  @Input() public IsLoading = false;
  @Input() public ErrorMessage = '';
  @Input() public IsSaving = false;
  @Input() public SaveError = '';
  @Input() public CanWrite = false;
  @Input() public CanSeeTeam = false;
  @Input() public IsReadOnly = false;
  @Input() public DefaultBand: SpaceBand = 'Shared';
  @Input() public SharedLabel = 'everyone in this space';
  @Input() public TeamLabel = 'the team';
  /** What a promotion makes visible, for the confirmation; the section words it from the rule. */
  @Input() public PromotionConsequence: (note: NoteModel) => string = (note) => `"${note.title}" becomes visible to everyone in the space. This is not undone.`;

  @Output() public SaveRequested = new EventEmitter<NoteDraft>();
  @Output() public DeleteRequested = new EventEmitter<NoteModel>();
  @Output() public PromoteRequested = new EventEmitter<NoteModel>();
  @Output() public TurnIntoDocumentRequested = new EventEmitter<NoteModel>();
  @Output() public PinToggleRequested = new EventEmitter<NoteModel>();
  @Output() public ComposerOpenChanged = new EventEmitter<boolean>();

  public draft: NoteDraft | null = null;
  public promoting: NoteModel | null = null;

  /** Opens the composer for a new note (the quick add from anywhere in the space) or to edit one. */
  public openComposer(note: NoteModel | null): void {
    this.promoting = null;
    const band: SpaceBand = note ? note.band : (this.CanSeeTeam ? this.DefaultBand : 'Shared');
    this.draft = note
      ? { id: note.id, title: note.title, body: note.body, band: note.band, visibility: note.visibility }
      : { id: null, title: '', body: '', band, visibility: 'Space' };
    this.ComposerOpenChanged.emit(true);
  }

  public cancel(): void {
    this.draft = null;
    this.ComposerOpenChanged.emit(false);
  }

  /** Called by the section once a save lands, so the composer closes on success and stays on failure. */
  public closeComposer(): void {
    this.draft = null;
    this.ComposerOpenChanged.emit(false);
  }

  public setBand(draft: NoteDraft, band: SpaceBand): void {
    draft.band = band;
    if (band === 'Shared') draft.visibility = 'Space';
  }

  public togglePrivate(draft: NoteDraft): void {
    draft.visibility = draft.visibility === 'Private' ? 'Space' : 'Private';
    if (draft.visibility === 'Private') draft.band = 'Team';
  }

  public submit(): void {
    if (!this.draft || !this.draft.title.trim() || this.IsSaving) return;
    this.SaveRequested.emit({ ...this.draft, title: this.draft.title.trim() });
  }

  public askPromote(note: NoteModel): void {
    this.draft = null;
    this.promoting = note;
  }

  public confirmPromote(note: NoteModel): void {
    this.promoting = null;
    this.PromoteRequested.emit(note);
  }
}
