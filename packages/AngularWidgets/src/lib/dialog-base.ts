import { Directive, HostListener, type ElementRef, type OnDestroy, type OnInit } from '@angular/core';

/**
 * What every dialog here does the same way, on top of `mj-dialog`, which draws it, closes it on Escape, the backdrop and its close
 * button, and locks the page's scroll. It does three things `mj-dialog` doesn't: it remembers what had focus when the dialog opened
 * and gives it back on close, focuses the first control, and keeps Tab inside. A dialog extends this and says which element is its
 * box: `mj-dialog`'s own element, so that its close button is inside the trap.
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
    if (typeof document === 'undefined') return;
    // The opener may be gone (a row's Share button after the share): the focus falls back to the page's main area, not to the body
    if (this.opener && typeof this.opener.focus === 'function' && document.contains(this.opener)) {
      this.opener.focus();
      return;
    }
    const main = document.querySelector<HTMLElement>('main, [role="main"]');
    if (main) {
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus();
    }
  }

  @HostListener('document:keydown', ['$event'])
  public OnDialogKeyDown(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>): void {
    if (event.key !== 'Tab') return;
    const box = this.DialogBox()?.nativeElement;
    if (!box) return;
    const container = box.querySelector<HTMLElement>('.mj-dialog-container');
    const focusable = box.querySelectorAll<HTMLElement>('input:not([disabled]):not([type="hidden"]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    // While every control is off (a save is under way) Tab has nowhere to go: the focus stays on the dialog itself
    if (focusable.length === 0) {
      event.preventDefault();
      // The container takes focus without joining the tab order; a dialog that opened on a field never made it focusable
      if (container && !container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      container?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // The container is where the focus starts when no control takes it: from there Tab goes to the first control, Shift+Tab to the last
    if (!box.contains(active) || active === container) {
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
