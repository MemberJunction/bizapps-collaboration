import { Component, Input } from '@angular/core';

/**
 * Shown before a space is locked down. A missing grant must read as
 * "you don't have this space", not as a broken application.
 */
@Component({
    selector: 'mj-collaboration-no-access',
    standalone: true,
    template: `
      <section class="gate">
        <p class="eyebrow">Collaboration</p>
        <h1>You don't have access to this space.</h1>
        <p>{{ detail }}</p>
      </section>
    `,
    styles: [`
      :host { display: block; color: var(--mj-text-primary, inherit); }
      .gate { max-width: 36rem; padding: 3rem 1.5rem; }
      .eyebrow { letter-spacing: 0.04em; text-transform: uppercase; font-size: 0.75rem; color: var(--mj-text-secondary, inherit); }
      h1 { font-size: 1.6rem; font-weight: 600; }
    `],
})
export class NoAccessComponent {
    @Input() detail = 'Ask a member of the space to invite your account. Signing in is not the same thing as being on the roster.';
}
