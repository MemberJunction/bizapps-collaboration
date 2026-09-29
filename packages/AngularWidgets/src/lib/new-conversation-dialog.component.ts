import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MJButtonDirective } from '@memberjunction/ng-ui-components';
import { SharedGenericModule } from '@memberjunction/ng-shared-generic';
import { COLLAB_TOKENS_CSS } from './tokens';

export interface NewConversationSubmitPayload {
  name: string;
  kind: 'General' | 'Topic' | 'Private';
}

@Component({
  selector: 'mjc-new-conversation-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MJButtonDirective, SharedGenericModule],
  template: `
    <div class="scrim" (click)="onCancel()"></div>
    <div #modalRoot class="modal conversation-modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <header class="d-header">
        <div class="d-title-group">
          <h2 id="dialog-title" class="d-title">New Conversation</h2>
          <p class="d-sub">Start a new discussion channel in {{ SpaceName || 'this space' }}.</p>
        </div>
        <button type="button" class="btn-close" (click)="onCancel()" aria-label="Close dialog">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div class="d-body">
        <div class="form-group">
          <label class="f-label" for="convo-name">Conversation Name</label>
          <div class="input-with-prefix">
            <span class="prefix">#</span>
            <input
              #nameInput
              id="convo-name"
              type="text"
              class="f-input"
              [(ngModel)]="name"
              [disabled]="IsSubmitting"
              placeholder="e.g. project-updates, weekly-sync"
              (keydown.enter)="onSubmit()"
              autofocus
            />
          </div>
        </div>

        <div class="form-group">
          <label class="f-label" id="channel-type-label">Channel Type</label>
          <div class="kind-options" role="radiogroup" aria-labelledby="channel-type-label">
            <label class="kind-card" [class.selected]="kind === 'General'">
              <input type="radio" name="convoKind" value="General" [(ngModel)]="kind" [disabled]="IsSubmitting" class="sr-only" />
              <div class="kind-card-icon general"><i class="fa-solid fa-comments" aria-hidden="true"></i></div>
              <div class="kind-card-text">
                <div class="kind-title">General Discussion</div>
                <div class="kind-desc">Open channel for all space participants and team members.</div>
              </div>
            </label>

            <label class="kind-card" [class.selected]="kind === 'Topic'">
              <input type="radio" name="convoKind" value="Topic" [(ngModel)]="kind" [disabled]="IsSubmitting" class="sr-only" />
              <div class="kind-card-icon topic"><i class="fa-solid fa-bullseye" aria-hidden="true"></i></div>
              <div class="kind-card-text">
                <div class="kind-title">Topic / Workstream</div>
                <div class="kind-desc">Focused on a specific deliverable, review, or initiative.</div>
              </div>
            </label>

            @if (canShowPrivate) {
              <label class="kind-card" [class.selected]="kind === 'Private'">
                <input type="radio" name="convoKind" value="Private" [(ngModel)]="kind" [disabled]="IsSubmitting" class="sr-only" />
                <div class="kind-card-icon private"><i class="fa-solid fa-lock" aria-hidden="true"></i></div>
                <div class="kind-card-text">
                  <div class="kind-title">Team only</div>
                  <div class="kind-desc">Restricted to internal staff and team members.</div>
                </div>
              </label>
            }
          </div>
        </div>
      </div>

      <footer class="d-footer">
        <button
          type="button"
          mjButton
          variant="primary"
          size="md"
          [disabled]="!trimmedName || IsSubmitting"
          (click)="onSubmit()"
        >
          @if (IsSubmitting) {
            <mj-loading Size="small" [showText]="false"></mj-loading> Creating...
          } @else {
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Create Conversation
          }
        </button>
        <button
          type="button"
          mjButton
          variant="secondary"
          size="md"
          [disabled]="IsSubmitting"
          (click)="onCancel()"
        >
          Cancel
        </button>
      </footer>
    </div>
  `,
  styles: [
    COLLAB_TOKENS_CSS,
    `
      :host {
        display: block;
        position: absolute;
        inset: 0;
        z-index: 1000;
        color: var(--mj-text-primary, #0f172a);
        font-family: var(--mj-font-family, Inter, sans-serif);
        font-size: 14px;
        line-height: var(--mjc-line-height, 1.5);
      }

      .scrim {
        position: absolute;
        inset: 0;
        background: var(--mj-bg-overlay, rgba(15, 23, 42, 0.4));
        backdrop-filter: blur(2px);
      }

      .modal.conversation-modal {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 520px;
        max-width: calc(100vw - 32px);
        background: var(--mj-bg-surface, #ffffff);
        border: 1px solid var(--mj-border-default, #e2e8f0);
        border-radius: 12px;
        box-shadow: var(--mj-shadow-2xl);
        overflow: hidden;
        z-index: 1001;
        display: flex;
        flex-direction: column;
      }

      .d-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 20px 24px 16px;
        border-bottom: 1px solid var(--mj-border-default, #e2e8f0);
        background: var(--mj-bg-surface, #ffffff);
      }

      .d-title-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .d-title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: var(--mj-text-primary, #0f172a);
      }

      .d-sub {
        margin: 0;
        font-size: 13px;
        color: var(--mj-text-secondary, #64748b);
      }

      .btn-close {
        background: transparent;
        border: none;
        color: var(--mj-text-muted, #94a3b8);
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 16px;
        transition: all 0.15s ease;
      }
      .btn-close:hover {
        background: var(--mj-bg-surface-hover, #f1f5f9);
        color: var(--mj-text-primary, #0f172a);
      }

      .d-body {
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .f-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--mj-text-primary, #0f172a);
      }

      .input-with-prefix {
        display: flex;
        align-items: center;
        border: 1px solid var(--mj-border-default, #e2e8f0);
        border-radius: 8px;
        background: var(--mj-bg-surface, #ffffff);
        overflow: hidden;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .input-with-prefix:focus-within {
        border-color: var(--mj-brand-primary, #0076b6);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--mj-brand-primary, #0076b6) 15%, transparent);
      }

      .prefix {
        padding: 0 10px 0 14px;
        font-size: 16px;
        font-weight: 700;
        color: var(--mj-text-muted, #94a3b8);
        user-select: none;
      }

      .f-input {
        border: none;
        outline: none;
        padding: 10px 14px 10px 0;
        font-size: 14px;
        color: var(--mj-text-primary, #0f172a);
        flex: 1;
        background: transparent;
      }

      .kind-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
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

      .kind-card:has(input:focus-visible) {
        outline: 2px solid var(--mj-brand-primary, #0076b6);
        outline-offset: 2px;
      }

      .kind-card-icon {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .kind-card-icon.general {
        background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 12%, transparent);
        color: var(--mj-brand-primary, #0076b6);
      }
      .kind-card-icon.topic {
        background: color-mix(in srgb, var(--mj-brand-tertiary, #059669) 12%, transparent);
        color: var(--mj-brand-tertiary, #059669);
      }
      .kind-card-icon.private {
        background: color-mix(in srgb, var(--mjc-team, #7c3aed) 12%, transparent);
        color: var(--mjc-team, #7c3aed);
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
        color: var(--mj-text-primary, #0f172a);
      }

      .kind-desc {
        font-size: 12px;
        color: var(--mj-text-secondary, #64748b);
      }

      .d-footer {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        padding: 16px 24px;
        border-top: 1px solid var(--mj-border-default, #e2e8f0);
        background: var(--mj-bg-surface-sunken, #f8fafc);
      }
    `,
  ],
})
export class CollabNewConversationDialogComponent implements OnInit, OnDestroy, OnChanges {
  @Input() public SpaceName = '';
  @Input() public AllowedKinds: readonly ('General' | 'Topic' | 'Private')[] = ['General', 'Topic'];
  @Input() public IsSubmitting = false;

  @Output() public CancelRequested = new EventEmitter<void>();
  @Output() public SubmitRequested = new EventEmitter<NewConversationSubmitPayload>();

  @ViewChild('nameInput') private nameInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('modalRoot') private modalRootElement?: ElementRef<HTMLElement>;

  public name = '';
  public kind: 'General' | 'Topic' | 'Private' = 'General';

  private previousActiveElement: HTMLElement | null = null;

  public ngOnInit(): void {
    if (typeof document !== 'undefined') {
      this.previousActiveElement = document.activeElement as HTMLElement | null;
      this.scheduleNameFocus();
    }
  }

  private focusTimer: ReturnType<typeof setTimeout> | undefined;

  /** Focuses the name field on the next turn, replacing any focus still pending so the timer can be cleared on destroy. */
  private scheduleNameFocus(): void {
    if (this.focusTimer !== undefined) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => {
      this.focusTimer = undefined;
      this.nameInputElement?.nativeElement?.focus();
    }, 0);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['IsSubmitting']) {
      const prev = changes['IsSubmitting'].previousValue;
      const curr = changes['IsSubmitting'].currentValue;
      if (prev === true && curr === false) {
        this.scheduleNameFocus();
      }
    }
  }

  public ngOnDestroy(): void {
    if (this.focusTimer !== undefined) clearTimeout(this.focusTimer);
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

  public get canShowPrivate(): boolean {
    return this.AllowedKinds.includes('Private');
  }

  public get trimmedName(): string {
    return this.name.trim();
  }

  // The document listener alone: a key pressed inside the dialog bubbles to it, so a host listener would run this twice
  @HostListener('document:keydown', ['$event'])
  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Tab' && this.modalRootElement?.nativeElement) {
      const focusable = this.modalRootElement.nativeElement.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!this.modalRootElement.nativeElement.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  public onEscape(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.onCancel();
  }

  public onCancel(): void {
    if (!this.IsSubmitting) {
      this.CancelRequested.emit();
    }
  }

  public onSubmit(): void {
    const clean = this.trimmedName;
    if (!clean || this.IsSubmitting) return;
    this.SubmitRequested.emit({
      name: clean,
      kind: this.kind,
    });
  }
}
