import { Directive, HostListener, type ElementRef, type OnDestroy, type OnInit } from '@angular/core';

/**
 * What every dialog here does the same way, on top of `mj-dialog` (the box is `mj-dialog`'s own element, so its close button is inside the trap) (which draws it, closes it on Escape, the backdrop and its close
 * button, and locks the page's scroll): remember what had focus when it opened and give it back on close, focus the first
 * control, and keep Tab inside. `mj-dialog` does none of these three today. A dialog extends this and says which element is its box.
 */
@Directive()
export abstract class CollabDialogBase implements OnInit, OnDestroy {
  private opener: HTMLElement | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | undefined;

  /** The dialog's box: Tab cycles inside it. */
  protected abstract DialogBox(): ElementRef<HTMLElement> | undefined;

  /**
   * The control to focus when the dialog opens: one marked `data-autofocus`, else the first field, else the dialog's own container
   * (made focusable, not tabbable), so that Enter right after it opens activates nothing: not the close button, not the primary action.
   */
  protected FirstFocus(): HTMLElement | null {
    const box = this.DialogBox()?.nativeElement;
    if (!box) return null;
    const marked = box.querySelector<HTMLElement>('[data-autofocus]:not([disabled])');
    if (marked) return marked;
    const field = box.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])');
    if (field) return field;
    const container = box.querySelector<HTMLElement>('.mj-dialog-container');
    if (container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    return container;
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
