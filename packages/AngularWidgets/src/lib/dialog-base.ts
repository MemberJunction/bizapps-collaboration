import { Directive, HostListener, type ElementRef, type OnDestroy, type OnInit } from '@angular/core';

/**
 * What every dialog here does the same way: remember what had focus when it opened and give it back on close, close on Escape,
 * and keep Tab inside. A dialog extends this, says which element is its box, and says what closing means.
 */
@Directive()
export abstract class CollabDialogBase implements OnInit, OnDestroy {
  private opener: HTMLElement | null = null;

  /** The dialog's box: Tab cycles inside it. */
  protected abstract DialogBox(): ElementRef<HTMLElement> | undefined;

  /** What Escape does: the dialog's own cancel. */
  protected abstract Dismiss(): void;

  /** The control to focus when the dialog opens. */
  protected FirstFocus(): HTMLElement | null {
    return this.DialogBox()?.nativeElement.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), select:not([disabled])') ?? null;
  }

  public ngOnInit(): void {
    if (typeof document === 'undefined') return;
    this.opener = document.activeElement as HTMLElement | null;
    setTimeout(() => this.FirstFocus()?.focus(), 0);
  }

  public ngOnDestroy(): void {
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
