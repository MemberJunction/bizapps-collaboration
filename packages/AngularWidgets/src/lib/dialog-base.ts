import { Directive, HostListener, type ElementRef, type OnDestroy, type OnInit } from '@angular/core';

/**
 * What every dialog here does the same way: remember what had focus when it opened and give it back on close, close on Escape,
 * and keep Tab inside. A dialog extends this, says which element is its box, and says what closing means.
 */
@Directive()
export abstract class CollabDialogBase implements OnInit, OnDestroy {
  private opener: HTMLElement | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | undefined;

  /** The dialog's box: Tab cycles inside it. */
  protected abstract DialogBox(): ElementRef<HTMLElement> | undefined;

  /** What Escape does: the dialog's own cancel. */
  protected abstract Dismiss(): void;

  /**
   * The control to focus when the dialog opens: one marked `data-autofocus`, else the first field, else the first button that
   * isn't the header's close button. Landing on the close button would make Enter, right after a dialog opens, close it.
   */
  protected FirstFocus(): HTMLElement | null {
    const box = this.DialogBox()?.nativeElement;
    if (!box) return null;
    return box.querySelector<HTMLElement>('[data-autofocus]:not([disabled])')
      ?? box.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')
      ?? box.querySelector<HTMLElement>('button:not([disabled]):not(.btn-close)');
  }

  /** Focuses the first control on the next turn, replacing any focus still pending so the timer can be cleared on destroy. */
  protected ScheduleFirstFocus(): void {
    if (this.focusTimer !== undefined) clearTimeout(this.focusTimer);
    this.focusTimer = setTimeout(() => {
      this.focusTimer = undefined;
      this.FirstFocus()?.focus();
    }, 0);
  }

  public ngOnInit(): void {
    if (typeof document === 'undefined') return;
    this.opener = document.activeElement as HTMLElement | null;
    this.ScheduleFirstFocus();
  }

  public ngOnDestroy(): void {
    if (this.focusTimer !== undefined) clearTimeout(this.focusTimer);
    if (this.opener && typeof this.opener.focus === 'function') this.opener.focus();
  }

  @HostListener('document:keydown', ['$event'])
  public OnDialogKeyDown(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.Dismiss();
      return;
    }
    if (event.key !== 'Tab') return;
    const box = this.DialogBox()?.nativeElement;
    if (!box) return;
    const focusable = box.querySelectorAll<HTMLElement>('input:not([disabled]):not([type="hidden"]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!box.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
